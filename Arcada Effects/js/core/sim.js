// Arcaidia Effector — детерминированная симуляция эмиттера
// Фиксированный шаг DT; перемотка назад = ресет и пересчёт от нуля (дёшево).
(function () {
'use strict';
const AFX = window.AFX;
const T = AFX.Track;
const P = AFX.Path;

const DT = 1 / 120;
const MAX_PARTS = 5000;
// золотое сечение: равномерная (низкодискрепантная) раскладка точек рождения вдоль пути
const PHI = 0.6180339887498949;
// с какой резвостью скорость подтягивается к flow пути (доля за шаг, ~8/с)
const FLOW_K = Math.min(1, 8 * DT);
// окно поиска ближайшей точки пути вокруг подсказки прошлого шага (path.fast)
const PWIN = 4;
// скретч под вектор curl-поля: горячий путь, аллокации на частицу тут недопустимы
const CV = { x: 0, y: 0 };

function Sim(layer) {
    this.layerId = layer.id;
    this.rev = -1;
    this.reset(layer);
}

Sim.prototype.reset = function (layer) {
    this.t = 0;
    this.rng = AFX.mulberry32((layer.em.seed | 0) * 7919 + 1013);
    this.acc = 0;
    this.bi = 0;
    this.bursts = (layer.em.bursts || []).slice().sort((a, b) => a.t - b.t);
    this.parts = [];
    this.subN = 0; // живых дочерних частиц (tier > 0) — для sub.budget
    // путь движения: свой буфер запечённой геометрии + счётчик точек рождения
    this.pbuf = P.newBake();
    this.pbuf2 = P.newBake();   // поза пути на КОНЦЕ шага (суб-шаговое рождение)
    this.pq = { x: 0, y: 0, tx: 1, ty: 0 };
    this.pq2 = { x: 0, y: 0, tx: 1, ty: 0 };
    this.pn = { x: 0, y: 0, tx: 1, ty: 0, u: 0, d: 0, seg: 0 };
    this.pn2 = { x: 0, y: 0, tx: 1, ty: 0, u: 0, d: 0, seg: 0 };
    this.pe = null;   // путь эмиссии на текущем шаге (ставит step, читает spawn)
    this.pe2 = null;  // он же на конце шага — точка рождения ложится между позами
    this.pjit = 0;
    this.pathIdx = 0;
    this.rev = layer._rev || 0;
};

// блок частицы по ярусу: 0 — основная частица слоя, >0 — дочерняя (суб-эмиттер)
function ptOf(layer, tier) { return tier > 0 ? layer.em.sub.pt : layer.pt; }

// покадрово постоянные величины блока частицы (хойстятся на шаг, свои для каждого яруса)
// turbMode — поле СЛОЯ (между reset постоянно), ветвиться по нему в цикле законно;
// 'noise' идёт ровно прежней арифметикой, старые файлы попиксельно те же.
function physOf(pt, tl) {
    const curl = pt.turbMode === 'curl';
    return {
        gx: T.val(pt.gravX, tl), gy: T.val(pt.gravY, tl),
        ta: T.val(pt.turbAmp, tl), tf: pt.turbFreq || 1,
        curl: curl,
        tsc: curl ? Math.max(4, pt.turbScale || 90) : 0,
        toc: curl ? AFX.clamp(pt.turbOct | 0 || 1, 1, 4) : 1,
        tri: curl ? (pt.turbRise || 0) : 0,
        tsd: curl ? (pt.turbSeed | 0) * 4099 : 0,
        // ВЕТЕР (px/с): поле как скорость среды, а не как удар. Сопротивление
        // считается ОТНОСИТЕЛЬНО ветра — частицу несёт потоком, а не колотит им,
        // поэтому она не перелетает через вихрь и не начинает дребезжать.
        tw: curl ? (pt.turbWind || 0) : 0,
        // разгон турбулентности по жизни частицы: 0 — ровно как раньше,
        // 1 — у основания ламинарно, к вершине рвётся в клочья (плюм реального огня)
        tramp: AFX.clamp(pt.turbRamp || 0, 0, 1),
        dragF: pt.drag > 0 ? Math.exp(-pt.drag * DT) : 1,
        zig: (pt.zigzag || 0) * AFX.DEG,
        trail: pt.render === 'trail'
    };
}

// контекст суб-эмиттера на шаг: всё, что не зависит от конкретной частицы
function subCtx(em, tl) {
    const sub = em.sub, spt = sub.pt;
    const maxGen = Math.max(1, Math.min(4, sub.maxGen | 0 || 1));
    const g = Math.max(0.05, sub.genScale == null ? 0.6 : sub.genScale);
    const gsc = [1, 1];
    for (let i = 2; i <= maxGen; i++) gsc[i] = gsc[i - 1] * g;
    const emit = sub.emit || 'death';
    return {
        ex: T.val(em.x, tl), ey: T.val(em.y, tl),
        speed: Math.max(0, T.val(sub.speed, tl)),
        rate: Math.max(0, T.val(sub.rate, tl)),
        size: Math.max(1, T.val(spt.size, tl)),
        count: Math.max(0, Math.round(sub.count || 0)),
        startAt: AFX.clamp(sub.startAt || 0, 0, 1),
        nVar: AFX.Sprites.variants(spt.sprite),
        trail: spt.render === 'trail',
        budget: Math.max(0, sub.budget | 0),
        maxGen: maxGen, genScale: gsc,
        emitLife: emit === 'life' || emit === 'both',
        emitDeath: emit === 'death' || emit === 'both'
    };
}

// sA0/sInc — суб-шаговое рождение: аккумулятор ДО шага и его прирост за шаг.
// sInc<=0 — вся пачка рождается в начале шага (вспышки, legacy-эмиссия).
Sim.prototype.spawn = function (layer, n, tl, sA0, sInc) {
    const em = layer.em, pt = layer.pt;
    const r = this.rng;
    const ex = T.val(em.x, tl), ey = T.val(em.y, tl);
    const sx = Math.max(0, T.val(em.sx, tl)), sy = Math.max(0, T.val(em.sy, tl));
    const angle = T.val(em.angle, tl) * AFX.DEG;
    const spread = T.val(em.spread, tl) * AFX.DEG;
    const baseSpeed = T.val(em.speed, tl);
    const baseSize = T.val(pt.size, tl);
    const nVar = AFX.Sprites.variants(pt.sprite);
    // ПУТЬ как источник эмиссии: точка рождения берётся с кривой, форма эмиттера не участвует.
    // Число вызовов rng на частицу в этой ветке ФИКСИРОВАНО (2), режимы пути между reset постоянны.
    const pb = this.pe, pb2 = this.pe2;
    const pAim = pb ? (em.path.aim || 'none') : 'none';
    const pAlong = pb ? (em.path.along || 'random') : 'random';
    const jit = this.pjit;
    // суб-шаг: гравитация шага (откат скорости) и поза эмиттера на конце шага
    const sgx = sInc > 0 ? T.val(pt.gravX, tl) : 0;
    const sgy = sInc > 0 ? T.val(pt.gravY, tl) : 0;
    const ex2 = sInc > 0 ? T.val(em.x, tl + DT) : ex;
    const ey2 = sInc > 0 ? T.val(em.y, tl + DT) : ey;

    for (let i = 0; i < n; i++) {
        if (this.parts.length >= MAX_PARTS) return;
        // доля шага, на которой аккумулятор пересёк (i+1)-ю единицу = момент рождения частицы
        const f = sInc > 0 ? AFX.clamp((i + 1 - sA0) / sInc, 0, 1) : 0;
        const cex = ex + (ex2 - ex) * f, cey = ey + (ey2 - ey) * f;
        let x = cex, y = cey;
        let ptx = 1, pty = 0, side = 1;
        if (pb) {
            const ru = r(), rj = r() * 2 - 1;
            const u = pAlong === 'even' ? (this.pathIdx * PHI) % 1 : (pAlong === 'start' ? 0 : ru);
            this.pathIdx++;
            const q = P.at(pb, u, this.pq);
            let qx = q.x, qy = q.y;
            ptx = q.tx; pty = q.ty;
            // путь за шаг уезжает: сажаем частицу на его позу в момент её рождения
            if (pb2 && f > 0) {
                const q2 = P.at(pb2, u, this.pq2);
                qx += (q2.x - qx) * f; qy += (q2.y - qy) * f;
                const tx = ptx + (q2.tx - ptx) * f, ty = pty + (q2.ty - pty) * f;
                const tn = Math.sqrt(tx * tx + ty * ty);
                if (tn > 1e-6) { ptx = tx / tn; pty = ty / tn; }
            }
            side = rj < 0 ? -1 : 1;
            x = qx - pty * rj * jit;
            y = qy + ptx * rj * jit;
        } else if (em.shape === 'circle') {
            const a = r() * Math.PI * 2, d = Math.sqrt(r());
            x = cex + Math.cos(a) * d * sx; y = cey + Math.sin(a) * d * sy;
        } else if (em.shape === 'ring') {
            const a = r() * Math.PI * 2, d = sx + (r() - 0.5) * sy;
            x = cex + Math.cos(a) * d; y = cey + Math.sin(a) * d;
        } else if (em.shape === 'box') {
            x = cex + (r() * 2 - 1) * sx; y = cey + (r() * 2 - 1) * sy;
        } else if (em.shape === 'line') {
            const d = (r() * 2 - 1) * sx;
            x = cex + Math.cos(angle) * d; y = cey + Math.sin(angle) * d;
        }

        let ang;
        if (pAim === 'tangent') ang = Math.atan2(pty, ptx) + (r() - 0.5) * spread;
        else if (pAim === 'normal') ang = Math.atan2(ptx * side, -pty * side) + (r() - 0.5) * spread;
        else if (em.dir === 'dir') ang = angle + (r() - 0.5) * spread;
        else if (em.dir === 'omni') ang = r() * Math.PI * 2;
        else { // out / in
            const dx = x - cex, dy = y - cey;
            ang = (dx * dx + dy * dy > 1e-6) ? Math.atan2(dy, dx) : r() * Math.PI * 2;
            if (em.dir === 'in') ang += Math.PI;
        }
        const spd = Math.max(0, baseSpeed * (1 + em.speedRnd * (r() * 2 - 1)));
        const life = Math.max(0.05, pt.life * (1 + pt.lifeRnd * (r() * 2 - 1)));
        const size0 = Math.max(1, baseSize * (1 + pt.sizeRnd * (r() * 2 - 1)));
        const rot0 = (pt.rot + 360 * pt.rotRnd * (r() - 0.5)) * AFX.DEG;
        const spin = pt.spin * (1 + pt.spinRnd * (r() * 2 - 1)) * AFX.DEG;
        const seed = Math.floor(r() * 1e6);
        const varI = Math.floor(r() * nVar);

        // Частица родилась в середине шага и к его концу прожила (1-f)*DT — откатываем
        // её на f*DT, общая интеграция ниже добавит полный DT и приведёт к верному состоянию.
        const bvx = Math.cos(ang) * spd, bvy = Math.sin(ang) * spd;
        const back = f * DT;

        this.parts.push({
            x: x - bvx * back, y: y - bvy * back,
            vx: bvx - sgx * back, vy: bvy - sgy * back,
            age: -back, life: life,
            size0: size0, rot: rot0 - spin * back, spin: spin,
            seed: seed, vi: varI,
            gen: 0, stepN: 0,
            tier: 0, subAcc: 0, pseg: -1,
            hist: pt.render === 'trail' ? [x, y] : null
        });
    }
};

// СУБ-ЭМИТТЕР: частица сама сыплет частицы из блока em.sub.pt.
// Кубики — СВОЙ prng частицы (основной поток rng слоя не трогается), число вызовов
// на одного ребёнка ФИКСИРОВАНО — иначе поехал бы детерминизм.
Sim.prototype.spawnSub = function (layer, p, n, salt, sc) {
    const sub = layer.em.sub, spt = sub.pt;
    const tier = p.tier + 1;
    const gs = sc.genScale[tier] || 1;
    for (let i = 0; i < n; i++) {
        if (this.parts.length >= MAX_PARTS || this.subN >= sc.budget) return;
        const cr = AFX.mulberry32(((p.seed | 0) * 65599 + p.stepN * 40503 + i * 8191 + salt) | 0);
        const rA = cr(), rS = cr(), rL = cr(), rZ = cr(), rR = cr(), rP = cr(), rV = cr(), rD = cr();

        let ang;
        if (sub.dir === 'omni') {
            ang = rA * Math.PI * 2;
        } else {
            let base;
            if (sub.dir === 'out') {
                const dx = p.x - sc.ex, dy = p.y - sc.ey;
                base = (dx * dx + dy * dy > 1e-6) ? Math.atan2(dy, dx) : rA * Math.PI * 2;
            } else { // inherit / back — вдоль скорости родителя
                base = (p.vx * p.vx + p.vy * p.vy > 1e-6) ? Math.atan2(p.vy, p.vx) : rA * Math.PI * 2;
                if (sub.dir === 'back') base += Math.PI;
            }
            ang = base + (rA - 0.5) * (sub.spread || 0) * AFX.DEG;
        }
        const spd = Math.max(0, sc.speed * gs * (1 + sub.speedRnd * (rS * 2 - 1)));
        const inh = sub.inherit || 0;

        this.subN++;
        this.parts.push({
            x: p.x, y: p.y,
            vx: Math.cos(ang) * spd + p.vx * inh,
            vy: Math.sin(ang) * spd + p.vy * inh,
            age: 0,
            life: Math.max(0.05, spt.life * gs * (1 + spt.lifeRnd * (rL * 2 - 1))),
            size0: Math.max(1, sc.size * gs * (1 + spt.sizeRnd * (rZ * 2 - 1))),
            rot: (spt.rot + 360 * spt.rotRnd * (rR - 0.5)) * AFX.DEG,
            spin: spt.spin * (1 + spt.spinRnd * (rP * 2 - 1)) * AFX.DEG,
            seed: Math.floor(rD * 1e6), vi: Math.floor(rV * sc.nVar),
            gen: 0, stepN: 0,
            tier: tier, subAcc: 0, pseg: -1,
            hist: sc.trail ? [p.x, p.y] : null
        });
    }
};

// дочерняя частица-ветка: кубики бросает СВОЙ prng (основной поток rng не трогаем)
Sim.prototype.spawnBranch = function (layer, p) {
    if (this.parts.length >= MAX_PARTS) return;
    const pt = ptOf(layer, p.tier), br = layer.em.branch;
    const cr = AFX.mulberry32(((p.seed | 0) * 31 + p.stepN * 10007) | 0);
    const ang = Math.atan2(p.vy, p.vx) + (cr() * 2 - 1) * (br.spread || 35) * AFX.DEG;
    const spd = Math.hypot(p.vx, p.vy) * (br.speedScale || 1) * (0.75 + 0.5 * cr());
    const remain = Math.max(0.05, p.life - p.age);
    const life = Math.max(0.05, remain * (br.lifeScale || 0.6) * (0.6 + 0.8 * cr()));
    this.parts.push({
        x: p.x, y: p.y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        age: 0, life: life,
        size0: Math.max(1, p.size0 * (br.sizeScale || 0.7)),
        rot: p.rot, spin: p.spin,
        seed: Math.floor(cr() * 1e6), vi: p.vi,
        gen: p.gen + 1, stepN: 0,
        tier: p.tier, subAcc: 0, pseg: p.pseg,
        hist: pt.render === 'trail' ? [p.x, p.y] : null
    });
    if (p.tier > 0) this.subN++;
};

Sim.prototype.step = function (layer) {
    const tl = this.t;
    const em = layer.em, pt = layer.pt;
    const win = Math.max(0, layer.end - layer.start);

    // ПУТЬ: запекается один раз на шаг (узлы анимируемы) — общий для эмиссии и ведения.
    // Выключен — ни одной лишней операции, старые эффекты попиксельно те же.
    const path = em.path;
    let pb = null, guide = null;
    this.pe = null;
    this.pe2 = null;
    if (P.active(path)) {
        pb = P.bake(path, tl, T.val(em.x, tl), T.val(em.y, tl), this.pbuf);
        const mode = path.mode || 'emit';
        if (mode === 'emit' || mode === 'both') {
            this.pe = pb;
            this.pjit = Math.max(0, T.val(path.jitter, tl));
            // движущийся путь за шаг уезжает дальше ширины частицы — нужна и поза конца шага
            if (em.subStep) this.pe2 = P.bake(path, tl + DT, T.val(em.x, tl + DT), T.val(em.y, tl + DT), this.pbuf2);
        }
        if (mode === 'guide' || mode === 'both') {
            const at = Math.max(0, T.val(path.attract, tl));
            const lock = AFX.clamp(T.val(path.lock, tl), 0, 1);
            const flow = T.val(path.flow, tl);
            if (at > 0 || lock > 0 || flow !== 0) {
                guide = { at: at, lock: lock, flow: flow, fast: path.fast !== false };
            }
        }
    }

    // эмиссия в пределах окна слоя
    if (tl <= win + 1e-9) {
        const rate = Math.max(0, T.val(em.rate, tl));
        if (rate > 0) {
            const a0 = this.acc, inc = rate * DT;
            this.acc += inc;
            const n = Math.floor(this.acc);
            if (n > 0) { this.acc -= n; this.spawn(layer, n, tl, a0, em.subStep ? inc : 0); }
        }
        // вспышка — событие одного момента: раздавать её по шагу нечего
        while (this.bi < this.bursts.length && this.bursts[this.bi].t <= tl + 1e-9) {
            const b = this.bursts[this.bi++];
            if (b.t <= win + 1e-9) this.spawn(layer, Math.max(0, Math.round(b.n)), tl, 0, 0);
        }
    }

    // интеграция; физика хойстится ПО ЯРУСАМ (0 — своя частица, 1 — дочерняя)
    const ph0 = physOf(pt, tl);
    const subOn = !!(em.sub && em.sub.on);
    const ph1 = subOn ? physOf(em.sub.pt, tl) : ph0;
    const sc = subOn ? subCtx(em, tl) : null;
    const br = em.branch;
    const brOn = br && br.chance > 0;
    const maxGen = br ? Math.max(1, br.maxGen || 2) : 0;
    const parts = this.parts;
    // дети пушатся в конец и на этом шаге не итерируются (i идёт вниз)
    for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        const ph = p.tier > 0 ? ph1 : ph0;
        p.age += DT;
        p.stepN++;
        if (p.age >= p.life) {
            // суб-эмиссия «при гибели»: выброс до удаления родителя
            if (sc && sc.emitDeath && p.tier < sc.maxGen) this.spawnSub(layer, p, sc.count, 20001, sc);
            if (p.tier > 0) this.subN--;
            parts.splice(i, 1);
            continue;
        }
        // суб-эмиссия «по жизни»: свой аккумулятор у каждой частицы
        if (sc && sc.emitLife && p.tier < sc.maxGen && p.age >= p.life * sc.startAt) {
            p.subAcc += sc.rate * sc.genScale[p.tier + 1] * DT;
            const n = Math.floor(p.subAcc);
            if (n > 0) { p.subAcc -= n; this.spawnSub(layer, p, n, 1, sc); }
        }
        // ветвление: детерминированный кубик от seed+номера шага
        if (brOn && p.gen < maxGen && AFX.hash01(p.stepN * 7.13, p.seed) < br.chance * DT) {
            this.spawnBranch(layer, p);
        }
        // зигзаг: покадровый белый шум поворота скорости (изломы, не дуги)
        if (ph.zig > 0) {
            const dAng = (AFX.hash01(p.stepN * 3.7, p.seed + 555) * 2 - 1) * ph.zig * DT;
            const ca = Math.cos(dAng), sa = Math.sin(dAng);
            const nvx = p.vx * ca - p.vy * sa;
            p.vy = p.vx * sa + p.vy * ca;
            p.vx = nvx;
        }
        let ax = ph.gx, ay = ph.gy;
        let wx = 0, wy = 0;
        if (ph.curl ? (ph.ta > 0 || ph.tw !== 0) : ph.ta > 0) {
            // ламинарное основание: у молодой частицы турбулентности почти нет,
            // к ~1/3 жизни она в полную силу — низ пламени стоит, верх рвётся
            const g = ph.tramp > 0
                ? (1 - ph.tramp + ph.tramp * AFX.smoothstep(0.04, 0.34, p.age > 0 ? p.age / p.life : 0))
                : 1;
            if (ph.curl) {
                // поле в МИРОВЫХ координатах: соседние частицы читают один вихрь и
                // уезжают вместе — отсюда языки. y смещается со временем: поле
                // всплывает вверх (tri, px/с), структуры лижут вверх вместе с плюмом.
                AFX.curl2(p.x, p.y + ph.tri * tl, tl * ph.tf, ph.tsc, ph.toc, ph.tsd, CV);
                if (ph.ta > 0) { ax += ph.ta * g * CV.x; ay += ph.ta * g * CV.y; }
                if (ph.tw !== 0) { const w = ph.tw * g; wx = CV.x * w; wy = CV.y * w; }
            } else {
                ax += ph.ta * g * AFX.noise1(p.age * ph.tf, p.seed);
                ay += ph.ta * g * AFX.noise1(p.age * ph.tf, p.seed + 7777);
            }
        }
        // ПУТЬ КАК НАПРАВЛЯЮЩАЯ (только свои частицы слоя, ярус 0 — дети суб-эмиттера свободны):
        // attract — пружина к ближайшей точке, flow — разгон вдоль касательной,
        // lock — гашение поперечной скорости + прилипание позиции после интеграции.
        const gn = (guide && p.tier === 0)
            ? P.nearest(pb, p.x, p.y, this.pn, guide.fast ? p.pseg : -1, PWIN) : null;
        if (gn && guide.fast) p.pseg = gn.i;
        if (gn && guide.at > 0) {
            ax += (gn.x - p.x) * guide.at;
            ay += (gn.y - p.y) * guide.at;
        }
        // сопротивление считается ОТНОСИТЕЛЬНО среды: v = W + (v + a·dt - W)·e^(-drag·dt).
        // Точное решение dv/dt = a - drag·(v - W) при постоянном W на шаге.
        // Ветра нет (W=0) — формула тождественно сворачивается в прежнюю строку.
        if (wx !== 0 || wy !== 0) {
            p.vx = wx + (p.vx + ax * DT - wx) * ph.dragF;
            p.vy = wy + (p.vy + ay * DT - wy) * ph.dragF;
        } else {
            p.vx = (p.vx + ax * DT) * ph.dragF;
            p.vy = (p.vy + ay * DT) * ph.dragF;
        }
        if (gn) {
            if (guide.flow !== 0) {
                const dv = (guide.flow - (p.vx * gn.tx + p.vy * gn.ty)) * FLOW_K;
                p.vx += gn.tx * dv;
                p.vy += gn.ty * dv;
            }
            if (guide.lock > 0) {
                const vn = p.vx * -gn.ty + p.vy * gn.tx;
                p.vx -= -gn.ty * vn * guide.lock;
                p.vy -= gn.tx * vn * guide.lock;
            }
        }
        p.x += p.vx * DT;
        p.y += p.vy * DT;
        if (gn && guide.lock > 0) {
            const sn = P.nearest(pb, p.x, p.y, this.pn2, guide.fast ? gn.i : -1, PWIN);
            p.x += (sn.x - p.x) * guide.lock;
            p.y += (sn.y - p.y) * guide.lock;
            if (guide.fast) p.pseg = sn.i;
        }
        p.rot += p.spin * DT;
        // история пути для трейла: вершина каждые 2 шага (даёт изломы на зигзаге)
        if (ph.trail) {
            if (!p.hist) p.hist = [p.x, p.y];
            else if ((p.stepN & 1) === 0) {
                p.hist.push(p.x, p.y);
                if (p.hist.length > 480) p.hist.splice(0, 2);
            }
        }
    }
    this.t += DT;
};

// довести симуляцию до последнего узла сетки <= tl; вернуть остаток для экстраполяции отрисовки
Sim.prototype.ensure = function (layer, tl) {
    const rev = layer._rev || 0;
    if (rev !== this.rev || tl < this.t - 1e-6) this.reset(layer);
    let guard = 0;
    while (this.t + DT <= tl + 1e-9 && guard++ < 4000) this.step(layer);
    return Math.max(0, tl - this.t);
};

AFX.Sim = Sim;
AFX.Sim.DT = DT;
})();
