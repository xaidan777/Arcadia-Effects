// Arcaidia Effector — путь движения (motion path): анимируемая ломаная/кривая эмиттера.
// Узлы (path.nodes) — СМЕЩЕНИЯ от центра эмиттера (em.x/em.y), у каждого свои треки x/y,
// поэтому путь целиком анимируется (клинок меча = два узла с ключами).
// Модуль без DOM, без Math.random/Date.now — работает в пути симуляции (детерминизм).
(function () {
'use strict';
const AFX = window.AFX;
const T = AFX.Track;

const Path = AFX.Path = {};

const SUB = 12;        // сэмплов на один пролёт при сглаживании
const MAX_SAMP = 600;  // жёсткий кап сэмплов запечённого пути

// буфер запечённого пути. СВОЙ у каждой симуляции и у каждой панели:
// шарить нельзя (симуляции разных Engine идут по разному времени).
Path.newBake = function () {
    return { xs: [], ys: [], cum: [], si: [], n: 0, len: 0, closed: false };
};

Path.nodeCount = function (path) { return (path && path.nodes) ? path.nodes.length : 0; };
// путь работает от двух узлов (одиночный узел = просто точка, тоже допустим)
Path.active = function (path) { return !!(path && path.on && Path.nodeCount(path) >= 1); };

// узлы в мировых координатах в момент tl (время ОТ НАЧАЛА СЛОЯ)
Path.nodesAt = function (path, tl, ox, oy, outX, outY) {
    const nodes = path.nodes || [];
    for (let i = 0; i < nodes.length; i++) {
        outX[i] = ox + T.val(nodes[i].x, tl);
        outY[i] = oy + T.val(nodes[i].y, tl);
    }
    return nodes.length;
};

// равномерный Catmull-Rom
function cr(p0, p1, p2, p3, u) {
    const u2 = u * u, u3 = u2 * u;
    return 0.5 * ((2 * p1) + (-p0 + p2) * u +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

const CX = [], CY = [];

// запечь путь в полилинию с накопленной длиной дуги (буфер b переиспользуется)
Path.bake = function (path, tl, ox, oy, b) {
    b = b || Path.newBake();
    const nn = Path.nodesAt(path, tl, ox || 0, oy || 0, CX, CY);
    const xs = b.xs, ys = b.ys, si = b.si, cum = b.cum;
    b.n = 0; b.len = 0;
    b.closed = !!path.closed && nn > 2;
    if (!nn) return b;

    let n = 0;
    const push = function (x, y, seg) {
        if (n && Math.abs(x - xs[n - 1]) < 1e-4 && Math.abs(y - ys[n - 1]) < 1e-4) return;
        xs[n] = x; ys[n] = y; si[n] = seg; n++;
    };
    if (nn === 1) {
        push(CX[0], CY[0], 0);
    } else {
        const spans = b.closed ? nn : nn - 1;
        const smooth = path.smooth !== false && nn > 2;
        const idx = i => b.closed ? ((i % nn) + nn) % nn : AFX.clamp(i, 0, nn - 1);
        for (let s = 0; s < spans && n < MAX_SAMP; s++) {
            if (!smooth) { push(CX[s], CY[s], s); continue; }
            const i0 = idx(s - 1), i1 = idx(s), i2 = idx(s + 1), i3 = idx(s + 2);
            for (let k = 0; k < SUB && n < MAX_SAMP; k++) {
                const u = k / SUB;
                push(cr(CX[i0], CX[i1], CX[i2], CX[i3], u), cr(CY[i0], CY[i1], CY[i2], CY[i3], u), s);
            }
        }
        // финальная вершина: конец последнего пролёта (у замкнутого — возврат в первый узел)
        if (b.closed) push(xs[0], ys[0], spans - 1);
        else push(CX[nn - 1], CY[nn - 1], spans - 1);
    }

    cum[0] = 0;
    let len = 0;
    for (let i = 1; i < n; i++) {
        const dx = xs[i] - xs[i - 1], dy = ys[i] - ys[i - 1];
        len += Math.sqrt(dx * dx + dy * dy);
        cum[i] = len;
    }
    b.n = n; b.len = len;
    return b;
};

// точка пути по доле длины дуги u (0..1; у замкнутого — заворачивается)
Path.at = function (b, u, out) {
    out = out || { x: 0, y: 0, tx: 1, ty: 0 };
    const n = b.n;
    if (n <= 0) { out.x = 0; out.y = 0; out.tx = 1; out.ty = 0; return out; }
    if (n === 1 || b.len < 1e-6) {
        out.x = b.xs[0]; out.y = b.ys[0]; out.tx = 1; out.ty = 0;
        return out;
    }
    u = b.closed ? u - Math.floor(u) : AFX.clamp(u, 0, 1);
    const d = u * b.len;
    let lo = 0, hi = n - 1;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (b.cum[mid] <= d) lo = mid; else hi = mid;
    }
    const seg = b.cum[lo + 1] - b.cum[lo];
    const f = seg > 1e-9 ? (d - b.cum[lo]) / seg : 0;
    const dx = b.xs[lo + 1] - b.xs[lo], dy = b.ys[lo + 1] - b.ys[lo];
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    out.x = b.xs[lo] + dx * f;
    out.y = b.ys[lo] + dy * f;
    out.tx = dx / l; out.ty = dy / l;
    return out;
};

// скан диапазона сегментов; результат кладётся в NB (без аллокаций — зовётся сотни тысяч раз)
const NB = { d2: 0, i: -1, f: 0, k: -1 };
function scanRange(b, x, y, lo, hi, segN, wrap) {
    let best = Infinity, bi = -1, bf = 0, bk = -1;
    for (let k = lo; k <= hi; k++) {
        let i = k;
        if (wrap) i = ((k % segN) + segN) % segN;
        else if (k < 0 || k >= segN) continue;
        const ax = b.xs[i], ay = b.ys[i];
        const dx = b.xs[i + 1] - ax, dy = b.ys[i + 1] - ay;
        const l2 = dx * dx + dy * dy;
        let f = l2 > 1e-12 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
        f = f < 0 ? 0 : (f > 1 ? 1 : f);
        const px = ax + dx * f - x, py = ay + dy * f - y;
        const dd = px * px + py * py;
        if (dd < best) { best = dd; bi = i; bf = f; bk = k; }
    }
    NB.d2 = best; NB.i = bi; NB.f = bf; NB.k = bk;
    return bi;
}

// ближайшая точка пути к (x,y): позиция, касательная, доля длины, расстояние,
// индекс пролёта (seg — для UI) и индекс сегмента полилинии (i — подсказка на след. шаг).
// hint >= 0 и win > 0 — искать ТОЛЬКО в окне ±win сегментов вокруг подсказки
// (частица за шаг сдвигается на единицы пикселей). Минимум на краю окна = подсказка
// протухла, тогда идёт полный скан — результат совпадает с глобальным поиском.
Path.nearest = function (b, x, y, out, hint, win) {
    out = out || { x: 0, y: 0, tx: 1, ty: 0, u: 0, d: 0, seg: 0, i: -1 };
    const n = b.n;
    if (n <= 0) {
        out.x = x; out.y = y; out.tx = 1; out.ty = 0; out.u = 0; out.d = 0; out.seg = 0; out.i = -1;
        return out;
    }
    if (n === 1) {
        out.x = b.xs[0]; out.y = b.ys[0]; out.tx = 1; out.ty = 0; out.u = 0; out.seg = b.si[0]; out.i = 0;
        out.d = Math.sqrt((x - out.x) * (x - out.x) + (y - out.y) * (y - out.y));
        return out;
    }
    const segN = n - 1;
    let windowed = hint >= 0 && win > 0 && segN > win * 2 + 2;
    if (windowed) {
        scanRange(b, x, y, hint - win, hint + win, segN, !!b.closed);
        if (NB.i < 0 || NB.k === hint - win || NB.k === hint + win) windowed = false;
    }
    if (!windowed) scanRange(b, x, y, 0, segN - 1, segN, false);

    const i = NB.i, f = NB.f;
    const ax = b.xs[i], ay = b.ys[i];
    const dx = b.xs[i + 1] - ax, dy = b.ys[i + 1] - ay;
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    out.x = ax + dx * f; out.y = ay + dy * f;
    out.tx = dx / l; out.ty = dy / l;
    out.u = b.len > 1e-6 ? (b.cum[i] + l * f) / b.len : 0;
    out.d = Math.sqrt(NB.d2);
    out.seg = b.si[i];
    out.i = i;
    return out;
};
})();
