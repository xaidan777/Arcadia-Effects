// Arcaidia Effector — базовые утилиты, события, math, цвет, easing
(function () {
'use strict';
const AFX = window.AFX = window.AFX || {};
// версия редактора: единственный источник — <meta name="afx-version"> в index.html
AFX.VERSION = (function () {
    // headless (tools/*.mjs) грузит js/core в Node без DOM — там версия не нужна
    const m = typeof document !== 'undefined' && document.querySelector('meta[name="afx-version"]');
    return (m && m.getAttribute('content')) || '0.0.0';
})();

// --- события ---
const listeners = {};
AFX.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return fn; };
AFX.emit = function (ev, arg) {
    const list = listeners[ev];
    if (!list) return;
    for (const fn of list) {
        try { fn(arg); } catch (e) { console.error('[AFX:' + ev + ']', e); }
    }
};

// --- базовое ---
let uidCounter = Math.floor(Math.random() * 1e5);
AFX.uid = p => (p || 'id') + '_' + Date.now().toString(36) + '_' + (uidCounter++).toString(36);
AFX.clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
AFX.lerp = (a, b, t) => a + (b - a) * t;
AFX.deepClone = o => JSON.parse(JSON.stringify(o));
AFX.DEG = Math.PI / 180;

// --- детерминированный rng ---
AFX.mulberry32 = function (seed) {
    let a = (seed | 0) + 0x9E3779B9;
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
};
AFX.hash01 = function (i, seed) {
    const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453123;
    return s - Math.floor(s);
};
// value-noise 1D, результат -1..1
AFX.noise1 = function (x, seed) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return AFX.lerp(AFX.hash01(i, seed), AFX.hash01(i + 1, seed), u) * 2 - 1;
};

// --- пространственный шум (curl-турбулентность) ---
// Целочисленный хэш вместо sin-хэша: побитово одинаков в любом движке и втрое
// дешевле — curl зовёт его десятками тысяч раз за шаг симуляции.
AFX.hash2 = function (i, j, seed) {
    let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
    h = Math.imul(h ^ h >>> 15, 0x85ebca6b);
    h = Math.imul(h ^ h >>> 13, 0xc2b2ae35);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
};
// value-noise 2D, результат 0..1
AFX.noise2 = function (x, y, seed) {
    const i = Math.floor(x), j = Math.floor(y);
    const fx = x - i, fy = y - j;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const H = AFX.hash2;
    const a = H(i, j, seed), b = H(i + 1, j, seed);
    const c = H(i, j + 1, seed), d = H(i + 1, j + 1, seed);
    return AFX.lerp(a + (b - a) * ux, c + (d - c) * ux, uy);
};
// value-noise 3D: z — ось ВРЕМЕНИ, два 2D-слоя лерпуются (поле «кипит», а не застыло)
AFX.noise3 = function (x, y, z, seed) {
    const k = Math.floor(z), fz = z - k, uz = fz * fz * (3 - 2 * fz);
    // слои разведены большим шагом сида — соседние слои некоррелированы
    return AFX.lerp(AFX.noise2(x, y, seed + k * 1013), AFX.noise2(x, y, seed + (k + 1) * 1013), uz);
};

// CURL-ШУМ: вихревое поле из скалярного потенциала ψ, v = (dψ/dy, -dψ/dx).
// Поле БЕЗДИВЕРГЕНТНО (div v = 0) — у потока нет источников и стоков, поэтому
// частицы не «расталкиваются» и не «слипаются», а закручиваются в вихри. Именно
// это отличает языки пламени от дрожания: соседние частицы читают ОДНУ точку
// поля и уезжают вместе связной струёй.
// Октавы: лакунарность 2.17, НЕ ровно 2 — на кратной двойке решётки октав
// совпадают и value-noise даёт видимую сетку по осям. Время ускоряется вместе с
// частотой (мелкий вихрь оборачивается быстрее), каждая октава сдвинута по фазе.
// Итог нормирован суммой амплитуд, диапазон ~-1..1 — сопоставим с noise1, так что
// turbAmp переносится между режимами почти как есть.
const CURL_E = 0.5;   // полушаг центральной разности в единицах шума (делитель 2E = 1)
const CURL_LAC = 2.17;
AFX.curl2 = function (x, y, z, scale, oct, seed, out) {
    const inv = 1 / Math.max(1e-3, scale);
    const n = oct < 1 ? 1 : (oct > 4 ? 4 : oct | 0);
    let vx = 0, vy = 0, amp = 1, fr = inv, tz = z, norm = 0, ox = 0, oy = 0;
    const N = AFX.noise3;
    for (let o = 0; o < n; o++) {
        const px = x * fr + ox, py = y * fr + oy;
        vx += amp * (N(px, py + CURL_E, tz, seed) - N(px, py - CURL_E, tz, seed));
        vy -= amp * (N(px + CURL_E, py, tz, seed) - N(px - CURL_E, py, tz, seed));
        norm += amp;
        amp *= 0.5; fr *= CURL_LAC; tz *= CURL_LAC; seed += 7717;
        ox += 31.416; oy += 17.234;
    }
    const k = norm > 0 ? 1 / norm : 0;
    out.x = vx * k; out.y = vy * k;
    return out;
};
// ТУРБУЛЕНТНЫЙ ШУМ (fBm по МОДУЛЮ шума): на нулях шума образуются ГРЕБНИ —
// складки и рвань вместо мягких холмов обычного fBm. Результат 0..1, среднее ~0.5.
// Это то, чем гнут кадр в постэффекте искажения: складки читаются как языки.
AFX.turb3 = function (x, y, z, oct, seed) {
    const n = oct < 1 ? 1 : (oct > 4 ? 4 : oct | 0);
    let v = 0, amp = 1, fr = 1, tz = z, norm = 0;
    for (let o = 0; o < n; o++) {
        v += amp * Math.abs(AFX.noise3(x * fr, y * fr, tz, seed) * 2 - 1);
        norm += amp;
        amp *= 0.5; fr *= 2.13; tz *= 2.13; seed += 5387;
    }
    return v / norm;
};

// ВИХРЬ ТУРБУЛЕНТНОГО ШУМА: v = (dψ/dy, -dψ/dx), ψ — турбулентный fBm.
// Дивергенция нулевая: поле не имеет источников и стоков, поэтому им можно гнуть
// картинку, не разрывая её на дыры и не сминая в комки — площадь сохраняется.
// Разность берётся ВНУТРИ КАЖДОЙ ОКТАВЫ, в её собственных координатах. Если
// продифференцировать готовый fBm целиком, каждая следующая октава входит с
// множителем частоты и забивает предыдущие — картинку рвёт в лапшу.
AFX.turbCurl3 = function (x, y, z, oct, seed, out) {
    const n = oct < 1 ? 1 : (oct > 4 ? 4 : oct | 0);
    const E = 0.4, N = AFX.noise3;
    let vx = 0, vy = 0, amp = 1, fr = 1, tz = z, norm = 0;
    for (let o = 0; o < n; o++) {
        const px = x * fr, py = y * fr;
        vx += amp * (Math.abs(N(px, py + E, tz, seed) * 2 - 1) - Math.abs(N(px, py - E, tz, seed) * 2 - 1));
        vy -= amp * (Math.abs(N(px + E, py, tz, seed) * 2 - 1) - Math.abs(N(px - E, py, tz, seed) * 2 - 1));
        norm += amp;
        amp *= 0.5; fr *= 2.13; tz *= 2.13; seed += 5387;
    }
    const k = norm > 0 ? 1.7 / norm : 0;   // 1.7 — чтобы размах совпал с режимом 'tear'
    out.x = vx * k; out.y = vy * k;
    return out;
};

// smoothstep(a,b,x) — им гасится турбулентность у основания плюма
AFX.smoothstep = function (a, b, x) {
    const t = AFX.clamp(b === a ? (x < a ? 0 : 1) : (x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
};

// --- цвет ---
AFX.hexToRgb = function (hex) {
    if (Array.isArray(hex)) return hex;
    let h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
AFX.rgbToHex = function (c) {
    const b = v => ('0' + Math.round(AFX.clamp(v, 0, 255)).toString(16)).slice(-2);
    return '#' + b(c[0]) + b(c[1]) + b(c[2]);
};
AFX.rgbLerp = function (a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
};

// --- кубический безье-изинг (как CSS cubic-bezier) ---
AFX.bezierEase = function (p1x, p1y, p2x, p2y, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bx = t => 3 * p1x * (1 - t) * (1 - t) * t + 3 * p2x * (1 - t) * t * t + t * t * t;
    const by = t => 3 * p1y * (1 - t) * (1 - t) * t + 3 * p2y * (1 - t) * t * t + t * t * t;
    let t = x;
    for (let i = 0; i < 8; i++) {
        const err = bx(t) - x;
        if (Math.abs(err) < 1e-5) return by(t);
        const d = 3 * (1 - t) * (1 - t) * p1x + 6 * (1 - t) * t * (p2x - p1x) + 3 * t * t * (1 - p2x);
        if (Math.abs(d) < 1e-6) break;
        t = AFX.clamp(t - err / d, 0, 1);
    }
    // фолбэк — бисекция
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
        t = (lo + hi) / 2;
        if (bx(t) < x) lo = t; else hi = t;
    }
    return by(t);
};

// --- форматирование времени ---
AFX.fmtTime = function (t) {
    const s = Math.max(0, t);
    const sec = Math.floor(s);
    const ms = Math.floor((s - sec) * 1000);
    return sec + '.' + ('00' + ms).slice(-3);
};

// --- скачивание файлов ---
AFX.downloadBlob = function (name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
};
AFX.downloadText = function (name, text, mime) {
    AFX.downloadBlob(name, new Blob([text], { type: mime || 'application/json' }));
};

AFX.safeFileName = function (name) {
    return String(name || 'effect').trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'effect';
};
})();
