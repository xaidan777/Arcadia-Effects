// Arcaidia Effector — кривые "за жизнь частицы" и градиенты цвета
// Curve = {pts:[{t,v}]}, t: 0..1. Gradient = {stops:[{t,c:[r,g,b]}]}.
(function () {
'use strict';
const AFX = window.AFX;

const Curve = AFX.Curve = {};

Curve.make = pts => ({ pts: pts.map(p => ({ t: p[0], v: p[1] })) });

// Catmull-Rom с зажатыми концами
Curve.val = function (c, t) {
    const pts = c.pts;
    const n = pts.length;
    if (!n) return 1;
    if (n === 1 || t <= pts[0].t) return pts[0].v;
    if (t >= pts[n - 1].t) return pts[n - 1].v;
    let i = 0;
    while (i < n - 2 && pts[i + 1].t <= t) i++;
    const p1 = pts[i], p2 = pts[i + 1];
    const p0 = pts[Math.max(0, i - 1)], p3 = pts[Math.min(n - 1, i + 2)];
    const span = p2.t - p1.t;
    if (span < 1e-9) return p2.v;
    const u = (t - p1.t) / span;
    const u2 = u * u, u3 = u2 * u;
    const v = 0.5 * ((2 * p1.v) + (-p0.v + p2.v) * u +
        (2 * p0.v - 5 * p1.v + 4 * p2.v - p3.v) * u2 +
        (-p0.v + 3 * p1.v - 3 * p2.v + p3.v) * u3);
    return Math.max(0, v);
};

Curve.sort = c => c.pts.sort((a, b) => a.t - b.t);

Curve.presets = {
    const1:   { label: 'Constant 1',   make: () => Curve.make([[0, 1], [1, 1]]) },
    fadeOut:  { label: 'Fade Out',     make: () => Curve.make([[0, 1], [0.55, 0.85], [1, 0]]) },
    fadeIn:   { label: 'Fade In',      make: () => Curve.make([[0, 0], [0.35, 0.9], [1, 1]]) },
    inOut:    { label: 'Flash Pulse',  make: () => Curve.make([[0, 0], [0.12, 1], [0.6, 0.75], [1, 0]]) },
    bell:     { label: 'Bell',         make: () => Curve.make([[0, 0], [0.4, 1], [1, 0]]) },
    grow:     { label: 'Grow',         make: () => Curve.make([[0, 0.25], [0.5, 0.8], [1, 1]]) },
    growFast: { label: 'Fast Grow',    make: () => Curve.make([[0, 0.15], [0.25, 0.9], [1, 1.15]]) },
    shrink:   { label: 'Shrink',       make: () => Curve.make([[0, 1], [0.6, 0.7], [1, 0.1]]) },
    popShrink:{ label: 'Pop & Decay',  make: () => Curve.make([[0, 0.4], [0.18, 1], [1, 0.35]]) }
};

const Grad = AFX.Grad = {};

Grad.make = stops => ({ stops: stops.map(s => ({ t: s[0], c: AFX.hexToRgb(s[1]) })) });

Grad.val = function (g, t) {
    const st = g.stops;
    const n = st.length;
    if (!n) return [255, 255, 255];
    if (t <= st[0].t) return st[0].c.slice();
    if (t >= st[n - 1].t) return st[n - 1].c.slice();
    for (let i = 0; i < n - 1; i++) {
        if (st[i + 1].t >= t) {
            const span = st[i + 1].t - st[i].t;
            const u = span > 1e-9 ? (t - st[i].t) / span : 1;
            return AFX.rgbLerp(st[i].c, st[i + 1].c, u);
        }
    }
    return st[n - 1].c.slice();
};

Grad.sort = g => g.stops.sort((a, b) => a.t - b.t);

// квантованный hex — для кэша тонировки
Grad.hexAt = function (g, t, steps) {
    steps = steps || 24;
    const q = Math.round(AFX.clamp(t, 0, 1) * steps) / steps;
    return AFX.rgbToHex(Grad.val(g, q));
};

Grad.presets = {
    fire:    { label: 'Fire',     make: () => Grad.make([[0, '#fff8e0'], [0.2, '#ffd257'], [0.45, '#ff8a2a'], [0.7, '#c93a12'], [1, '#3a2018']]) },
    fireHot: { label: 'Plasma',   make: () => Grad.make([[0, '#ffffff'], [0.25, '#ffe98a'], [0.55, '#ff9c3f'], [1, '#8a2500']]) },
    smoke:   { label: 'Smoke',    make: () => Grad.make([[0, '#8a8a8a'], [0.5, '#565049'], [1, '#262220']]) },
    smokeLight: { label: 'Light Smoke', make: () => Grad.make([[0, '#e8e4da'], [0.6, '#a89f90'], [1, '#5c564c']]) },
    spark:   { label: 'Sparks',   make: () => Grad.make([[0, '#ffffff'], [0.3, '#ffe37a'], [0.7, '#ff9030'], [1, '#b03010']]) },
    ice:     { label: 'Ice',      make: () => Grad.make([[0, '#ffffff'], [0.4, '#9ef2f0'], [1, '#2e7fbe']]) },
    energy:  { label: 'Energy',   make: () => Grad.make([[0, '#ffffff'], [0.35, '#59e3e2'], [1, '#1a5f96']]) },
    poison:  { label: 'Poison',   make: () => Grad.make([[0, '#eaffb0'], [0.4, '#7ed957'], [1, '#1d4d20']]) },
    white:   { label: 'White',    make: () => Grad.make([[0, '#ffffff'], [1, '#ffffff']]) },
    gold:    { label: 'Gold',     make: () => Grad.make([[0, '#fff7d9'], [0.5, '#fdcf82'], [1, '#a1690f']]) }
};
})();
