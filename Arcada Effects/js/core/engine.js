// Arcaidia Effector — рендер композиции в произвольный момент времени
// Каждый Engine держит свои кэши симуляций (превью/атлас/миниатюры независимы).
(function () {
'use strict';
const AFX = window.AFX;
const T = AFX.Track;
const S = AFX.Sprites;

const BLEND = { normal: 'source-over', add: 'lighter', screen: 'screen', multiply: 'multiply' };

function Engine() {
    this.sims = new Map();
    this.lastCount = 0;
}

Engine.prototype.simFor = function (layer) {
    let sim = this.sims.get(layer.id);
    if (!sim) { sim = new AFX.Sim(layer); this.sims.set(layer.id, sim); }
    return sim;
};

Engine.prototype.dropMissing = function (doc) {
    const ids = new Set(doc.layers.map(l => l.id));
    Array.from(this.sims.keys()).forEach(id => { if (!ids.has(id)) this.sims.delete(id); });
};

// видимость с учётом solo
function visibleLayers(doc) {
    const anySolo = doc.layers.some(l => l.solo && l.on);
    return doc.layers.filter(l => l.on && (!anySolo || l.solo));
}

// переиспользуемый оффскрин нужного размера
Engine.prototype.scratch = function (name, w, h) {
    let s = this[name];
    if (!s) {
        const c = document.createElement('canvas');
        s = this[name] = { canvas: c, ctx: c.getContext('2d') };
    }
    if (s.canvas.width !== w || s.canvas.height !== h) {
        s.canvas.width = w;
        s.canvas.height = h;
    }
    return s;
};

Engine.prototype.render = function (doc, t, ctx) {
    const cw = doc.comp.w, ch = doc.comp.h;
    const cx = cw / 2, cy = ch / 2;
    const k = AFX.Model.compK(doc);
    this.dropMissing(doc);
    ctx.clearRect(0, 0, cw, ch);
    let count = 0;

    const layers = visibleLayers(doc);
    // ПОСТЭФФЕКТЫ: если в стеке есть слой postfx, которому в этот момент есть что делать,
    // композиция копится в оффскрине (постэффект обрабатывает его пиксели на своём месте
    // в стеке) и блитится в ctx. Нет такого слоя — рисуем прямо в ctx, путь прежний
    // и старые файлы попиксельно неизменны.
    // Через оффскрин идут ТОЛЬКО слои под самым верхним активным постэффектом: рисование
    // в побочную канву стоит примерно в полтора раза дороже за draw-call (замерено),
    // поэтому всё, что выше по стеку, после сброса оффскрина рисуется прямо в ctx.
    let out = ctx, topPost = -1;
    for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === 'postfx' && postParams(layers[i], t)) { topPost = i; break; }
    }
    if (topPost >= 0) {
        const pc = this.scratch('_post', cw, ch);
        prepCtx(pc.ctx, cw, ch);
        out = pc.ctx;
    }

    // порядок массива: 0 = верхний; рисуем снизу вверх
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const tl = t - layer.start;
        if (layer.type === 'postfx') {
            const pp = postParams(layer, t);
            if (pp) this.applyPostFx(out, pp, cw, ch, cx, cy, k);
            if (i === topPost) {
                // постэффектов выше нет — сбрасываем оффскрин и дорисовываем стек прямо в ctx
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(out.canvas, 0, 0);
                out = ctx;
            }
            continue;
        }
        const gAmt = layer.glowL != null ? AFX.clamp(T.val(layer.glowL, tl), 0, 3) : 0;
        const fadeOn = !!layer.fadeOn;

        if (gAmt <= 0.01 && !fadeOn) {
            if (layer.type === 'emitter') count += this.drawEmitter(doc, layer, t, out, cx, cy, k);
            else this.drawSprite(doc, layer, t, out, cx, cy, k);
            continue;
        }

        // оффскрин-путь: радиальное затухание и/или послойное свечение
        const lc = this.scratch('_layFx', cw, ch);
        lc.ctx.setTransform(1, 0, 0, 1, 0, 0);
        lc.ctx.globalAlpha = 1;
        lc.ctx.globalCompositeOperation = 'source-over';
        lc.ctx.clearRect(0, 0, cw, ch);
        if (layer.type === 'emitter') count += this.drawEmitter(doc, layer, t, lc.ctx, cx, cy, k);
        else this.drawSprite(doc, layer, t, lc.ctx, cx, cy, k);

        // маска затухания режет слой ДО свечения, чтобы ореол тоже гас
        if (fadeOn) applyRadialFade(lc.ctx, layer, tl, cx, cy, k, cw, ch);

        out.globalAlpha = 1;
        out.globalCompositeOperation = BLEND[layer.blend] || 'source-over';
        out.drawImage(lc.canvas, 0, 0);

        const bc = this.scratch('_blurFx', cw, ch);
        bc.ctx.setTransform(1, 0, 0, 1, 0, 0);
        bc.ctx.globalAlpha = 1;
        bc.ctx.globalCompositeOperation = 'source-over';
        bc.ctx.clearRect(0, 0, cw, ch);
        bc.ctx.filter = 'blur(' + Math.max(1, layer.glowLR || 24) + 'px)';
        bc.ctx.drawImage(lc.canvas, 0, 0);
        bc.ctx.filter = 'none';

        out.globalCompositeOperation = 'lighter';
        for (let rem = gAmt; rem > 0.01; rem -= 1) {
            out.globalAlpha = Math.min(1, rem);
            out.drawImage(bc.canvas, 0, 0);
        }
        out.globalAlpha = 1;
    }
    out.globalAlpha = 1;
    out.globalCompositeOperation = 'source-over';
    if (out !== ctx) {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(out.canvas, 0, 0);
    }
    this.lastCount = count;
    return count;
};

// радиальное затухание слоя: destination-in градиентом от подвижного центра
// (fadeR — внешний радиус, мягкая кромка = fadeSoft-доля радиуса; эллипс по компрессии)
function applyRadialFade(lctx, layer, tl, cx, cy, k, cw, ch) {
    const r = Math.max(1, T.val(layer.fadeR, tl));
    const soft = AFX.clamp(layer.fadeSoft == null ? 0.5 : layer.fadeSoft, 0, 1);
    const fx = T.val(layer.fadeX, tl), fy = T.val(layer.fadeY, tl);
    const inner = Math.max(0, r * (1 - soft));
    const kk = Math.max(0.2, k);
    lctx.save();
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = 'destination-in';
    lctx.translate(cx + fx, cy + fy * k);
    lctx.scale(1, kk);
    const g = lctx.createRadialGradient(0, 0, inner, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    lctx.fillStyle = g;
    const R = Math.max(cw, ch) * 2;
    lctx.fillRect(-R, -R / kk, R * 2, R * 2 / kk);
    lctx.restore();
}

// ---------- ПОСТЭФФЕКТЫ (слой type 'postfx') ----------
// Слой-корректор: своего изображения нет, обрабатывает пиксели всего, что накоплено
// ПОД ним. layer.opacity здесь — сила эффекта (подмешивание к чистому кадру).

// сброс оффскрина в нейтральное состояние
function prepCtx(c, w, h) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.filter = 'none';
    c.clearRect(0, 0, w, h);
}

// параметры постэффекта на момент t; null — делать нечего (вне окна слоя, сила 0
// или нулевой смаз), и тогда оффскрин композиции не заводится вовсе
function postParams(layer, t) {
    const fx = layer.fx;
    if (!fx) return null;
    if (fx.effect === 'displace') return displaceParams(layer, fx, t);
    if (fx.effect !== 'mblur') return null;
    const tl = t - layer.start;
    const win = Math.max(0.0001, layer.end - layer.start);
    if (tl < 0 || tl > win) return null;
    const mix = AFX.clamp(T.val(layer.opacity, tl), 0, 1);
    if (mix <= 0.004) return null;
    const len = Math.max(0, T.val(fx.length, tl));
    const radial = fx.mode === 'radial';
    const spin = radial ? T.val(fx.spin, tl) : 0;
    if (len < 0.5 && Math.abs(spin) < 0.05) return null;
    return {
        mix: mix, radial: radial, len: len,
        angle: T.val(fx.angle, tl) * AFX.DEG,
        spin: spin * AFX.DEG,
        x: T.val(fx.x, tl), y: T.val(fx.y, tl),
        passes: AFX.clamp(Math.round(Math.log(Math.max(2, fx.samples | 0)) / Math.LN2), 1, 6),
        half: !!fx.half
    };
}

// ---------- ТУРБУЛЕНТНОЕ ИСКАЖЕНИЕ (postfx 'displace') ----------
// Кадр под слоем гнётся полем турбулентного шума. ЯЗЫКИ ПЛАМЕНИ РОЖДАЮТСЯ ЗДЕСЬ:
// частицы дают мягкую светящуюся массу нужного силуэта, а форму — складки, рвань,
// отрывающиеся лоскуты — режет уже искажение. Возить по полю целые спрайты вместо
// этого бесполезно: получится мозаика из одинаковых капель, а не огонь.
// Поле уплывает вверх (rise) — складки лижут вместе с плюмом, а не стоят на месте
// волнистым стеклом.
function displaceParams(layer, fx, t) {
    const tl = t - layer.start;
    const win = Math.max(0.0001, layer.end - layer.start);
    if (tl < 0 || tl > win) return null;
    const mix = AFX.clamp(T.val(layer.opacity, tl), 0, 1);
    if (mix <= 0.004) return null;
    const amount = Math.max(0, T.val(fx.amount, tl)) * mix;
    if (amount < 0.4) return null;
    return {
        effect: 'displace',
        amount: amount,
        scale: Math.max(4, fx.scale || 60),
        aspect: AFX.clamp(fx.aspect || 1, 0.2, 8),
        oct: AFX.clamp(fx.oct | 0 || 1, 1, 4),
        swirl: fx.field === 'swirl',
        z: t * (fx.evo || 0),
        scroll: -(fx.rise || 0) * t,
        ramp: AFX.clamp(fx.ramp || 0, 0, 1),
        y0: T.val(fx.y0, tl),
        soft: Math.max(1, fx.soft || 120),
        seed: (fx.seed | 0) * 3571
    };
}

Engine.prototype.applyDisplace = function (octx, p, cw, ch) {
    const src = octx.getImageData(0, 0, cw, ch);
    const S = src.data;

    // рабочая область — только непустая часть кадра, расширенная на смещение:
    // у огня полкадра прозрачно, гонять по нему выборку незачем
    let bx0 = cw, by0 = ch, bx1 = -1, by1 = -1;
    for (let y = 0; y < ch; y++) {
        const row = y * cw;
        for (let x = 0; x < cw; x++) {
            if (S[((row + x) << 2) + 3] !== 0) {
                if (x < bx0) bx0 = x;
                if (x > bx1) bx1 = x;
                if (y < by0) by0 = y;
                if (y > by1) by1 = y;
            }
        }
    }
    if (bx1 < 0) return;
    const pad = Math.ceil(p.amount) + 2;
    bx0 = Math.max(0, bx0 - pad); by0 = Math.max(0, by0 - pad);
    bx1 = Math.min(cw - 1, bx1 + pad); by1 = Math.min(ch - 1, by1 + pad);

    // Смещение считаем на РЕДКОЙ сетке и тянем на пиксели: поле гладкое, звать шум
    // на каждый пиксель незачем (дешевле в десятки раз). Интерполяция —
    // СГЛАЖЕННАЯ (smoothstep по дробной части), а НЕ билинейная: у билинейной
    // производная рвётся на границах ячеек, и при смещении в десятки пикселей эти
    // изломы вылезают в кадр сеткой складок-«горизонталей». Уже чинили — не менять.
    const GS = Math.max(2, Math.min(12, Math.round(p.scale / 16)));
    const gw = Math.ceil(cw / GS) + 2, gh = Math.ceil(ch / GS) + 2;
    const GX = new Float32Array(gw * gh), GY = new Float32Array(gw * gh);
    const invS = 1 / p.scale, invSY = invS / p.aspect;
    const cy2 = ch / 2;
    const TB = AFX.turb3;
    const CV = { x: 0, y: 0 };   // скретч под вектор вихря: сетка обходится в горячем цикле
    for (let j = 0; j < gh; j++) {
        const py = j * GS;
        // затухание у основания: складки не должны отрывать пламя от земли
        const m = p.ramp > 0 ? 1 - p.ramp * AFX.clamp((py - cy2 - p.y0) / p.soft, 0, 1) : 1;
        const a = p.amount * m;
        const ny = (py + p.scroll) * invSY;
        for (let i = 0; i < gw; i++) {
            const nx = i * GS * invS;
            const g = j * gw + i;
            if (p.swirl) {
                // ВИХРЕВОЕ поле: дивергенция нулевая, поэтому картинку не рвёт
                // на дыры и не сминает в комки — материал только закручивает.
                AFX.turbCurl3(nx, ny, p.z, p.oct, p.seed, CV);
                GX[g] = a * CV.x; GY[g] = a * CV.y;
            } else {
                // РВУЩЕЕ поле: по каждой оси свой шум. Даёт резкие разрывы и лоскуты,
                // но умеет вырывать в массе чёрные дыры — это его цена.
                GX[g] = a * (TB(nx, ny, p.z, p.oct, p.seed) * 2 - 1);
                GY[g] = a * (TB(nx, ny, p.z, p.oct, p.seed + 91193) * 2 - 1);
            }
        }
    }

    const dst = octx.createImageData(cw, ch);
    const D = dst.data;
    const invGS = 1 / GS;
    for (let y = by0; y <= by1; y++) {
        const gj = y * invGS, j0 = gj | 0, ty0 = gj - j0;
        const fy = ty0 * ty0 * (3 - 2 * ty0);
        const r0 = j0 * gw, r1 = r0 + gw;
        for (let x = bx0; x <= bx1; x++) {
            const gi = x * invGS, i0 = gi | 0, tx0 = gi - i0;
            const fx = tx0 * tx0 * (3 - 2 * tx0);
            const a00 = r0 + i0, a10 = r1 + i0;
            const dx = (GX[a00] + (GX[a00 + 1] - GX[a00]) * fx) * (1 - fy)
                     + (GX[a10] + (GX[a10 + 1] - GX[a10]) * fx) * fy;
            const dy = (GY[a00] + (GY[a00 + 1] - GY[a00]) * fx) * (1 - fy)
                     + (GY[a10] + (GY[a10 + 1] - GY[a10]) * fx) * fy;

            const sx = x + dx, sy = y + dy;
            const ix = Math.floor(sx), iy = Math.floor(sy);
            if (ix < -1 || iy < -1 || ix >= cw || iy >= ch) continue;
            const tx = sx - ix, ty = sy - iy;

            // Тапы берём ПРЕМУЛЬТИПЛИЦИРОВАННЫМИ: в ImageData альфа прямая, и
            // интерполяция через кромку подмешала бы чёрный из прозрачных пикселей —
            // по контуру пошла бы тёмная кайма.
            let ar = 0, ag = 0, ab = 0, aa = 0;
            for (let q = 0; q < 4; q++) {
                const qx = ix + (q & 1), qy = iy + (q >> 1);
                if (qx < 0 || qy < 0 || qx >= cw || qy >= ch) continue;
                const w = ((q & 1) ? tx : 1 - tx) * ((q >> 1) ? ty : 1 - ty);
                if (w <= 0) continue;
                const s = (qy * cw + qx) << 2;
                const al = S[s + 3];
                if (al === 0) continue;
                const wa = w * al;
                ar += S[s] * wa; ag += S[s + 1] * wa; ab += S[s + 2] * wa; aa += wa;
            }
            if (aa <= 0) continue;
            const d = (y * cw + x) << 2;
            // aa — уже интерполированная альфа (веса тапов дают в сумме 1)
            D[d] = ar / aa; D[d + 1] = ag / aa; D[d + 2] = ab / aa;
            D[d + 3] = aa;
        }
    }
    octx.putImageData(dst, 0, 0);
};

// матрица одного сэмпла (в пикселях рабочего буфера): сдвиг для directional,
// поворот+зум вокруг центра для radial. Обе операции коммутативны сами с собой,
// поэтому их можно набирать удвоением (см. ниже).
function tapMat(c, radial, pcx, pcy, dx, dy, rot, sc) {
    if (radial) {
        c.translate(pcx, pcy);
        c.rotate(rot);
        c.scale(sc, sc);
        c.translate(-pcx, -pcy);
    } else {
        c.translate(dx, dy);
    }
}

// СМАЗ: N = 2^passes сэмплов набираются passes проходами «удвоения» — каждый проход
// усредняет буфер с его же сдвинутой копией (шаг 1, 2, 4... сэмпла), поэтому
// 16 сэмплов стоят 4 прохода, а не 16 отрисовок кадра. Усреднение ТОЧНОЕ: две
// отрисовки с globalAlpha 0.5 в режиме 'lighter' складывают премультиплицированные
// цвет и альфу без клампа (0.5 + 0.5 = 1).
Engine.prototype.applyPostFx = function (octx, p, cw, ch, cx, cy, k) {
    if (p.effect === 'displace') return this.applyDisplace(octx, p, cw, ch);
    const n = 1 << p.passes;                    // фактическое число сэмплов
    const q = p.half ? 0.5 : 1;                 // масштаб рабочего буфера
    const bw = Math.max(1, Math.round(cw * q)), bh = Math.max(1, Math.round(ch * q));
    const pcx = (cx + p.x) * q, pcy = (cy + p.y * k) * q;   // центр radial, px буфера
    const half = (n - 1) / 2;                   // смаз центрируем вокруг чистого кадра

    let dx = 0, dy = 0, step = 1, rot = 0;
    if (p.radial) {
        // len — смаз на самом дальнем углу кадра. Зум мультипликативный, смаз центрирован,
        // поэтому точка радиуса R разъезжается на R*(sqrt(G) - 1/sqrt(G)); решаем это
        // относительно полного отношения G, чтобы px в поле реально были px на краю.
        const R = Math.max(1, Math.hypot(Math.max(pcx, bw - pcx), Math.max(pcy, bh - pcy)));
        const u = p.len * q / R;
        step = Math.pow(Math.pow((u + Math.sqrt(u * u + 4)) / 2, 2), 1 / (n - 1));
        rot = p.spin / (n - 1);
    } else {
        dx = Math.cos(p.angle) * p.len * q / (n - 1);
        dy = Math.sin(p.angle) * p.len * q / (n - 1);
    }

    // оригинал нужен только при силе < 1 (точный lerp через 'lighter')
    let orig = null;
    if (p.mix < 0.999) {
        orig = this.scratch('_pfC', cw, ch);
        prepCtx(orig.ctx, cw, ch);
        orig.ctx.drawImage(octx.canvas, 0, 0);
    }

    let a = this.scratch('_pfA', bw, bh), b = this.scratch('_pfB', bw, bh);
    prepCtx(a.ctx, bw, bh);
    a.ctx.imageSmoothingQuality = 'high';
    tapMat(a.ctx, p.radial, pcx, pcy, -dx * half, -dy * half, -rot * half, Math.pow(step, -half));
    a.ctx.scale(q, q);                          // источник — композиция, буфер может быть half-res
    a.ctx.drawImage(octx.canvas, 0, 0);

    for (let j = 0; j < p.passes; j++) {
        const m = 1 << j;                       // этот проход сдвигает на 2^j сэмплов
        prepCtx(b.ctx, bw, bh);
        b.ctx.imageSmoothingQuality = 'high';
        b.ctx.globalCompositeOperation = 'lighter';
        b.ctx.globalAlpha = 0.5;
        b.ctx.drawImage(a.canvas, 0, 0);
        tapMat(b.ctx, p.radial, pcx, pcy, dx * m, dy * m, rot * m, Math.pow(step, m));
        b.ctx.drawImage(a.canvas, 0, 0);
        const tmp = a; a = b; b = tmp;
    }

    prepCtx(octx, cw, ch);
    octx.imageSmoothingQuality = 'high';
    octx.globalAlpha = p.mix;
    octx.drawImage(a.canvas, 0, 0, cw, ch);
    if (orig) {
        octx.globalCompositeOperation = 'lighter';
        octx.globalAlpha = 1 - p.mix;
        octx.drawImage(orig.canvas, 0, 0);
    }
    octx.globalAlpha = 1;
    octx.globalCompositeOperation = 'source-over';
};

// матрица: translate(px,py) * scale(1,q) * rotate(a) * scale(sx,sy)
function setMat(ctx, px, py, a, sx, sy, q) {
    const c = Math.cos(a), s = Math.sin(a);
    ctx.setTransform(c * sx, s * sx * q, -s * sy, c * sy * q, px, py);
}

function sheetFrame(tex, idx) {
    const sh = tex.sheet;
    const cols = Math.max(1, sh.cols | 0), rows = Math.max(1, sh.rows | 0);
    const total = cols * rows;
    const i = AFX.clamp(idx | 0, 0, total - 1);
    const fw = tex.img.width / cols, fh = tex.img.height / rows;
    return { sx: (i % cols) * fw, sy: Math.floor(i / cols) * fh, fw: fw, fh: fh };
}

Engine.prototype.drawEmitter = function (doc, layer, t, ctx, cx, cy, k) {
    const tl = t - layer.start;
    if (tl < 0) return 0;
    const sim = this.simFor(layer);
    const ext = sim.ensure(layer, tl);
    const parts = sim.parts;
    if (!parts.length) return 0;

    const layerAlpha = AFX.clamp(T.val(layer.opacity, tl), 0, 1);
    if (layerAlpha <= 0) return parts.length;

    const blend = BLEND[layer.blend] || 'source-over';
    const sub = layer.em.sub;
    // СУБ-ЭМИТТЕР: два прохода с разными блоками частицы (ярус 0 — свои, 1 — дочерние).
    // Выключён — ровно один проход по всем частицам, путь прежний.
    if (!sub || !sub.on) {
        drawPass(ctx, parts, layer.pt, -1, layerAlpha, ext, cx, cy, k, blend);
    } else if (sub.under) {
        drawPass(ctx, parts, sub.pt, 1, layerAlpha, ext, cx, cy, k, blend);
        drawPass(ctx, parts, layer.pt, 0, layerAlpha, ext, cx, cy, k, blend);
    } else {
        drawPass(ctx, parts, layer.pt, 0, layerAlpha, ext, cx, cy, k, blend);
        drawPass(ctx, parts, sub.pt, 1, layerAlpha, ext, cx, cy, k, blend);
    }
    return parts.length;
};

// один проход отрисовки частиц одного яруса (tierSel: -1 — все, 0 — свои, 1 — дочерние)
function drawPass(ctx, parts, pt, tierSel, layerAlpha, ext, cx, cy, k, blend) {
    const squashK = 1 - (1 - k) * AFX.clamp(pt.squash, 0, 1);
    const isTex = pt.sprite && pt.sprite.kind === 'tex';
    const tex = isTex ? S.texs.get(pt.sprite.texId) : null;
    const useSheet = !!(tex && tex.sheet);
    const glowOn = pt.glow > 0.01;
    const fixVar = (!isTex && pt.sprite.p && pt.sprite.p.var >= 0) ? pt.sprite.p.var : -1;
    const trailMode = pt.render === 'trail';

    ctx.globalCompositeOperation = blend;
    if (trailMode) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
    }

    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (tierSel >= 0 && (p.tier > 0 ? 1 : 0) !== tierSel) continue;
        const age = p.age + ext;
        const lf = AFX.clamp(age / p.life, 0, 1);
        const alpha = layerAlpha * AFX.clamp(AFX.Curve.val(pt.opacityOL, lf), 0, 1);
        if (alpha <= 0.004) continue;
        const size = p.size0 * Math.max(0, AFX.Curve.val(pt.sizeOL, lf));
        if (size < 0.5) continue;

        if (trailMode) {
            drawTrail(ctx, p, pt, lf, alpha, size, cx, cy, k, ext, blend);
            continue;
        }

        const wx = p.x + p.vx * ext, wy = p.y + p.vy * ext;
        const px = cx + wx, py = cy + wy * k;

        let ang = p.rot;
        let stretchX = 1;
        if (pt.alignVel || pt.stretch > 0) {
            const svx = p.vx, svy = p.vy * k;
            const spd = Math.sqrt(svx * svx + svy * svy);
            if (spd > 1) {
                const velAng = Math.atan2(svy, svx);
                if (pt.alignVel) ang = velAng;
                if (pt.stretch > 0) { ang = velAng; stretchX = 1 + Math.min(3.5, pt.stretch * spd / 600); }
            }
        }

        const hex = AFX.Grad.hexAt(pt.grad, lf);
        let img = null, srcRect = null;
        if (isTex) {
            if (!tex) continue;
            if (useSheet) {
                const total = Math.max(1, (tex.sheet.cols | 0) * (tex.sheet.rows | 0));
                const idx = pt.fps > 0 ? Math.floor(age * pt.fps) % total : Math.min(total - 1, Math.floor(lf * total));
                srcRect = sheetFrame(tex, idx);
                img = tex.img;
            } else if (pt.tintTex) {
                img = S.getTinted('tex:' + tex.id, hex);
            } else {
                img = tex.img;
            }
        } else {
            img = S.getTinted(S.sig(pt.sprite, fixVar >= 0 ? fixVar : p.vi), hex);
        }
        if (!img) continue;

        const iw = srcRect ? srcRect.fw : img.width;
        const ih = srcRect ? srcRect.fh : img.height;
        const scale = size / Math.max(iw, ih);
        setMat(ctx, px, py, ang, scale * stretchX, scale, squashK);
        ctx.globalAlpha = alpha;
        if (srcRect) ctx.drawImage(img, srcRect.sx, srcRect.sy, iw, ih, -iw / 2, -ih / 2, iw, ih);
        else ctx.drawImage(img, -iw / 2, -ih / 2);

        if (glowOn && !isTex) {
            const gimg = S.getGlow(S.sig(pt.sprite, fixVar >= 0 ? fixVar : p.vi), hex, pt.glowBlur);
            if (gimg) {
                const gs = size * (pt.glowSize || 1.5) / (gimg.width * 0.5);
                setMat(ctx, px, py, ang, gs * stretchX, gs, squashK);
                ctx.globalCompositeOperation = 'lighter';
                // сила > 1 — дополнительные аддитивные проходы
                for (let rem = pt.glow; rem > 0.01; rem -= 1) {
                    ctx.globalAlpha = alpha * Math.min(1, rem);
                    ctx.drawImage(gimg, -gimg.width / 2, -gimg.height / 2);
                }
                ctx.globalCompositeOperation = blend;
            }
        }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// трейл: полилиния пути частицы (молнии, следы) — свечение + основной штрих + белое ядро.
// sizeOT (кривая ширины вдоль пути, 0 — основание/спавн, 1 — кончик/голова):
// константная кривая — прежний однородный штрих (старые файлы попиксельно неизменны),
// непостоянная — заливка ленты с переменной полушириной.
function drawTrail(ctx, p, pt, lf, alpha, width, cx, cy, k, ext, blend) {
    const cv = curveConstVal(pt.sizeOT);
    if (cv != null) {
        width *= cv;
        if (width < 0.5) return;
        drawTrailUniform(ctx, p, pt, lf, alpha, width, cx, cy, k, ext, blend);
        return;
    }
    if (ribbonBuild(p, cx, cy, k, ext) < 2) {
        drawTrailUniform(ctx, p, pt, lf, alpha, width, cx, cy, k, ext, blend);
        return;
    }
    ribbonShape(pt.sizeOT, width);

    const hex = AFX.Grad.hexAt(pt.grad, lf);
    if (pt.glow > 0.01) {
        ribbonPath(ctx, 1 + (pt.glowSize || 1.5), false);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = hex;
        for (let rem = pt.glow; rem > 0.01; rem -= 1) {
            ctx.globalAlpha = alpha * 0.5 * Math.min(1, rem);
            ctx.fill();
        }
        ctx.globalCompositeOperation = blend;
    }
    ribbonPath(ctx, 1, false);
    ctx.fillStyle = hex;
    ctx.globalAlpha = alpha;
    ctx.fill();
    if (pt.trailCore > 0.01) {
        ribbonPath(ctx, 0.35, true);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = alpha * AFX.clamp(pt.trailCore, 0, 1);
        ctx.fill();
    }
}

function drawTrailUniform(ctx, p, pt, lf, alpha, width, cx, cy, k, ext, blend) {
    const hist = p.hist;
    ctx.beginPath();
    if (hist && hist.length >= 2) {
        ctx.moveTo(cx + hist[0], cy + hist[1] * k);
        for (let j = 2; j < hist.length; j += 2) ctx.lineTo(cx + hist[j], cy + hist[j + 1] * k);
    } else {
        ctx.moveTo(cx + p.x, cy + p.y * k);
    }
    ctx.lineTo(cx + p.x + p.vx * ext, cy + (p.y + p.vy * ext) * k);

    const hex = AFX.Grad.hexAt(pt.grad, lf);
    if (pt.glow > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = hex;
        ctx.lineWidth = width * (1 + (pt.glowSize || 1.5));
        for (let rem = pt.glow; rem > 0.01; rem -= 1) {
            ctx.globalAlpha = alpha * 0.5 * Math.min(1, rem);
            ctx.stroke();
        }
        ctx.globalCompositeOperation = blend;
    }
    ctx.strokeStyle = hex;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.stroke();
    if (pt.trailCore > 0.01) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = alpha * AFX.clamp(pt.trailCore, 0, 1);
        ctx.lineWidth = Math.max(1, width * 0.35);
        ctx.stroke();
    }
}

// значение константной кривой либо null, если кривая реально меняется
function curveConstVal(c) {
    if (!c || !c.pts || !c.pts.length) return 1;
    const v = c.pts[0].v;
    for (let i = 1; i < c.pts.length; i++) if (Math.abs(c.pts[i].v - v) > 1e-6) return null;
    return v;
}

// скретч конусной ленты: экранные точки пути + нормали (с митером) + полуширины.
// Перезаписывается на каждую частицу; вызовы синхронны — между инстансами Engine не течёт.
const RIB = { x: [], y: [], nx: [], ny: [], hw: [], n: 0 };

function ribbonBuild(p, cx, cy, k, ext) {
    const xs = RIB.x, ys = RIB.y, hist = p.hist;
    let n = 0;
    if (hist) {
        for (let j = 0; j < hist.length; j += 2) {
            const x = cx + hist[j], y = cy + hist[j + 1] * k;
            if (n && Math.abs(x - xs[n - 1]) < 0.01 && Math.abs(y - ys[n - 1]) < 0.01) continue;
            xs[n] = x; ys[n] = y; n++;
        }
    }
    const hx = cx + p.x + p.vx * ext, hy = cy + (p.y + p.vy * ext) * k;
    if (!n || Math.abs(hx - xs[n - 1]) >= 0.01 || Math.abs(hy - ys[n - 1]) >= 0.01) {
        xs[n] = hx; ys[n] = hy; n++;
    }
    RIB.n = n;
    return n;
}

function ribbonShape(curve, width) {
    const n = RIB.n, xs = RIB.x, ys = RIB.y, nxs = RIB.nx, nys = RIB.ny, hws = RIB.hw;
    // длина дуги -> u (0 у основания, 1 у головы) -> полуширина
    let len = 0;
    hws[0] = 0;
    for (let i = 1; i < n; i++) {
        const dx = xs[i] - xs[i - 1], dy = ys[i] - ys[i - 1];
        len += Math.sqrt(dx * dx + dy * dy);
        hws[i] = len;
    }
    const invLen = len > 1e-6 ? 1 / len : 0;
    for (let i = 0; i < n; i++) hws[i] = 0.5 * width * AFX.Curve.val(curve, hws[i] * invLen);
    // усреднённые нормали сегментов, митер зажат 2x (шпильки зигзага не дают шипов)
    let pdx = 0, pdy = 0;
    for (let i = 0; i < n; i++) {
        let d1x, d1y, d2x, d2y;
        if (i > 0) { d1x = xs[i] - xs[i - 1]; d1y = ys[i] - ys[i - 1]; } else { d1x = xs[1] - xs[0]; d1y = ys[1] - ys[0]; }
        if (i < n - 1) { d2x = xs[i + 1] - xs[i]; d2y = ys[i + 1] - ys[i]; } else { d2x = d1x; d2y = d1y; }
        const l1 = Math.sqrt(d1x * d1x + d1y * d1y), l2 = Math.sqrt(d2x * d2x + d2y * d2y);
        if (l1 > 1e-6) { d1x /= l1; d1y /= l1; } else { d1x = pdx; d1y = pdy; }
        if (l2 > 1e-6) { d2x /= l2; d2y /= l2; } else { d2x = d1x; d2y = d1y; }
        pdx = d2x; pdy = d2y;
        const mx = -d1y - d2y, my = d1x + d2x;
        const ml = Math.sqrt(mx * mx + my * my);
        if (ml < 1e-6) { nxs[i] = -d1y; nys[i] = d1x; continue; }
        const ux = mx / ml, uy = my / ml;
        const miter = 1 / Math.max(0.5, ux * -d1y + uy * d1x);
        nxs[i] = ux * miter; nys[i] = uy * miter;
    }
}

// лента как замкнутый контур: левая кромка -> круглый кап головы -> правая кромка -> кап хвоста.
// coreMode: 35% локальной ширины, минимум 1px, но не шире самой ленты (белое ядро)
function ribbonPath(ctx, scale, coreMode) {
    const n = RIB.n, xs = RIB.x, ys = RIB.y, nxs = RIB.nx, nys = RIB.ny, hws = RIB.hw;
    const hwAt = coreMode
        ? (i => Math.min(hws[i], Math.max(0.5, hws[i] * scale)))
        : (i => hws[i] * scale);
    ctx.beginPath();
    let h = hwAt(0);
    ctx.moveTo(xs[0] + nxs[0] * h, ys[0] + nys[0] * h);
    for (let i = 1; i < n; i++) {
        h = hwAt(i);
        ctx.lineTo(xs[i] + nxs[i] * h, ys[i] + nys[i] * h);
    }
    const aH = Math.atan2(nys[n - 1], nxs[n - 1]);
    ctx.arc(xs[n - 1], ys[n - 1], hwAt(n - 1), aH, aH - Math.PI, true);
    for (let i = n - 2; i >= 0; i--) {
        h = hwAt(i);
        ctx.lineTo(xs[i] - nxs[i] * h, ys[i] - nys[i] * h);
    }
    const aT = Math.atan2(nys[0], nxs[0]);
    ctx.arc(xs[0], ys[0], hwAt(0), aT - Math.PI, aT, true);
    ctx.closePath();
}

Engine.prototype.drawSprite = function (doc, layer, t, ctx, cx, cy, k) {
    const tl = t - layer.start;
    const win = Math.max(0.0001, layer.end - layer.start);
    if (tl < 0 || tl > win) return;
    const sp = layer.sp;

    const alpha = AFX.clamp(T.val(layer.opacity, tl), 0, 1);
    if (alpha <= 0.004) return;
    const x = T.val(sp.x, tl), y = T.val(sp.y, tl);
    const scale = Math.max(0, T.val(sp.scale, tl));
    const rot = T.val(sp.rot, tl) * AFX.DEG;
    const glow = AFX.clamp(T.val(sp.glow, tl), 0, 3);
    const col = T.val(sp.color, tl);
    const hex = AFX.rgbToHex(Array.isArray(col) ? col : [255, 255, 255]);

    const squashK = 1 - (1 - k) * AFX.clamp(sp.squash, 0, 1);
    const px = cx + x, py = cy + y * k;
    const blend = BLEND[layer.blend] || 'source-over';

    const isTex = sp.sprite && sp.sprite.kind === 'tex';
    const tex = isTex ? S.texs.get(sp.sprite.texId) : null;
    let img = null, srcRect = null, sig = null;

    if (isTex) {
        if (!tex) return;
        if (tex.sheet) {
            const total = Math.max(1, (tex.sheet.cols | 0) * (tex.sheet.rows | 0));
            const idx = sp.fps > 0 ? Math.floor(tl * sp.fps) % total : Math.min(total - 1, Math.floor(tl / win * total));
            srcRect = sheetFrame(tex, idx);
            img = tex.img;
        } else {
            img = tex.img;
        }
    } else {
        sig = S.sig(sp.sprite, Math.max(0, (sp.sprite.p && sp.sprite.p.var) || 0));
        img = S.getTinted(sig, hex);
    }
    if (!img) return;

    const iw = srcRect ? srcRect.fw : img.width;
    const ih = srcRect ? srcRect.fh : img.height;
    const base = sp.size * scale / Math.max(iw, ih);
    const sxm = base * (sp.aspect || 1);

    ctx.globalCompositeOperation = blend;
    setMat(ctx, px, py, rot, sxm, base, squashK);
    ctx.globalAlpha = alpha;
    if (srcRect) ctx.drawImage(img, srcRect.sx, srcRect.sy, iw, ih, -iw / 2, -ih / 2, iw, ih);
    else ctx.drawImage(img, -iw / 2, -ih / 2);

    if (glow > 0.01 && sig) {
        const gimg = S.getGlow(sig, hex, sp.glowBlur);
        if (gimg) {
            const gs = sp.size * scale * (sp.glowSize || 1.5) / (gimg.width * 0.5);
            setMat(ctx, px, py, rot, gs * (sp.aspect || 1), gs, squashK);
            ctx.globalCompositeOperation = 'lighter';
            for (let rem = glow; rem > 0.01; rem -= 1) {
                ctx.globalAlpha = alpha * Math.min(1, rem);
                ctx.drawImage(gimg, -gimg.width / 2, -gimg.height / 2);
            }
        }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
};

// миниатюра эффекта
Engine.renderThumb = function (doc, size, t) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const comp = document.createElement('canvas');
    comp.width = doc.comp.w; comp.height = doc.comp.h;
    const eng = new Engine();
    const time = t == null ? doc.comp.dur * 0.35 : t;
    eng.render(doc, time, comp.getContext('2d'));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    const kf = Math.min(size / comp.width, size / comp.height);
    ctx.drawImage(comp, (size - comp.width * kf) / 2, (size - comp.height * kf) / 2, comp.width * kf, comp.height * kf);
    return c;
};

AFX.Engine = Engine;
})();
