// Arcaidia Effector — процедурные спрайты, текстуры, кэш тонировки и свечения
// Все базовые спрайты — белые (тонируются градиентом). База 128px.
(function () {
'use strict';
const AFX = window.AFX;
const S = AFX.Sprites = {};
const BASE = 128;

// ---------- реестр текстур ----------
S.texs = new Map(); // id -> {id, name, img, dataURL, sheet:null|{cols,rows,fps}}

S.addTexture = function (name, dataURL, done) {
    const id = AFX.uid('tex');
    const img = new Image();
    img.onload = function () {
        S.texs.set(id, { id: id, name: name, img: img, dataURL: dataURL, sheet: null });
        if (done) done(id);
        AFX.emit('tex');
    };
    img.onerror = function () { console.warn('Failed to load texture', name); if (done) done(null); };
    img.src = dataURL;
    return id;
};
S.restoreTexture = function (meta, dataURL, done) {
    const img = new Image();
    img.onload = function () {
        S.texs.set(meta.id, { id: meta.id, name: meta.name, img: img, dataURL: dataURL, sheet: meta.sheet || null });
        if (done) done(meta.id);
    };
    img.onerror = function () { if (done) done(null); };
    img.src = dataURL;
};
S.removeTexture = function (id) { S.texs.delete(id); clearCachesFor('tex:' + id); AFX.emit('tex'); };

// ---------- фигуры ----------
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }

function softCircle(ctx, cx, cy, r, alpha, stops) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    (stops || [[0, 1], [0.3, 0.9], [0.65, 0.42], [1, 0]]).forEach(s => {
        g.addColorStop(s[0], 'rgba(255,255,255,' + (s[1] * (alpha == null ? 1 : alpha)) + ')');
    });
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

const drawers = {
    soft: function (ctx, p) { softCircle(ctx, 64, 64, 62); },
    dot: function (ctx, p) {
        softCircle(ctx, 64, 64, 59, 1, [[0, 1], [0.86, 1], [1, 0]]);
    },
    ring: function (ctx, p) {
        const th = AFX.clamp(p.th == null ? 0.14 : p.th, 0.02, 0.9);
        const rOut = 60, rIn = rOut * (1 - th);
        const rm = (rOut + rIn) / 2, half = (rOut - rIn) / 2;
        const g = ctx.createRadialGradient(64, 64, Math.max(0, rIn - 2), 64, 64, rOut + 2);
        const a = t => AFX.clamp(1 - Math.abs(t), 0, 1);
        for (let i = 0; i <= 10; i++) {
            const rr = rIn - 2 + (rOut + 2 - (rIn - 2)) * i / 10;
            g.addColorStop(i / 10, 'rgba(255,255,255,' + a((rr - rm) / (half + 2)).toFixed(3) + ')');
        }
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(64, 64, rOut + 2, 0, Math.PI * 2); ctx.fill();
    },
    square: function (ctx, p) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(20, 20, 88, 88);
    },
    poly: function (ctx, p) {
        const n = AFX.clamp(Math.round(p.n || 6), 3, 16);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + i / n * Math.PI * 2;
            const x = 64 + Math.cos(a) * 58, y = 64 + Math.sin(a) * 58;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill();
    },
    star: function (ctx, p) {
        const n = AFX.clamp(Math.round(p.n || 5), 3, 12);
        const inner = AFX.clamp(p.inr == null ? 0.5 : p.inr, 0.05, 0.95);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        for (let i = 0; i < n * 2; i++) {
            const a = -Math.PI / 2 + i / (n * 2) * Math.PI * 2;
            const r = (i % 2 === 0 ? 1 : inner) * 58;
            const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill();
    },
    streak: function (ctx, p) {
        ctx.save();
        ctx.translate(64, 64); ctx.scale(1, 0.16);
        softCircle(ctx, 0, 0, 62, 1, [[0, 1], [0.25, 0.95], [0.7, 0.4], [1, 0]]);
        ctx.restore();
    },
    spark: function (ctx, p) {
        ctx.save();
        ctx.translate(64, 64);
        ctx.scale(1, 0.1); softCircle(ctx, 0, 0, 62);
        ctx.restore();
        ctx.save();
        ctx.translate(64, 64);
        ctx.scale(0.1, 1); softCircle(ctx, 0, 0, 62);
        ctx.restore();
        softCircle(ctx, 64, 64, 18);
    },
    smoke: function (ctx, p) {
        const rng = AFX.mulberry32(1000 + (p.var || 0) * 77);
        for (let i = 0; i < 9; i++) {
            const a = rng() * Math.PI * 2;
            const d = 8 + rng() * 24;
            const r = 22 + rng() * 22;
            softCircle(ctx, 64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0.55 + rng() * 0.4,
                [[0, 1], [0.45, 0.8], [1, 0]]);
        }
    },
    blob: function (ctx, p) {
        const rng = AFX.mulberry32(500 + (p.var || 0) * 31);
        const bumps = 7 + Math.floor(rng() * 3);
        const phase = rng() * Math.PI * 2;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        const STEPS = 48;
        for (let i = 0; i <= STEPS; i++) {
            const a = i / STEPS * Math.PI * 2;
            const w = Math.sin(a * bumps + phase) * 0.5 + Math.sin(a * (bumps - 3) - phase * 2) * 0.5;
            const r = 44 + w * 9;
            const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill();
        for (let i = 0; i < 4; i++) {
            const a = rng() * Math.PI * 2, d = 30 + rng() * 14, r = 10 + rng() * 14;
            ctx.beginPath(); ctx.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, Math.PI * 2); ctx.fill();
        }
    },
    // ЯЗЫК ПЛАМЕНИ: капля, острый конец смотрит в +X (как streak) — с alignVel
    // частица ложится по скорости и «лижет» вдоль потока. Кромка мягкая: жёсткий
    // силуэт на add даёт картонную аппликацию, а не огонь.
    flame: function (ctx, p) {
        const rng = AFX.mulberry32(300 + (p.var || 0) * 97);
        const taper = AFX.clamp(p.taper == null ? 0.55 : p.taper, 0.1, 1);
        // 4 варианта — разный изгиб и «горб» языка: строй частиц не выглядит штамповкой
        const bend = (rng() * 2 - 1) * 18;
        const hump = 0.3 + rng() * 0.22;          // где самая толстая часть
        const wob = 0.6 + rng() * 0.8;            // мелкая волна кромки
        const wph = rng() * Math.PI * 2;
        const half = 31 * (0.85 + rng() * 0.3);   // ~2:1 — язык, а не капля
        // профиль полуширины вдоль языка: 0 — тупой хвост, 1 — острие
        const prof = function (t) {
            const body = Math.pow(Math.sin(Math.PI * Math.pow(t, hump)), 0.75);
            const tip = Math.pow(1 - t, taper);
            return Math.max(0, body * tip + 0.12 * (1 - t) * (1 - t));
        };
        // Силуэт набирается ЦЕПОЧКОЙ мягких кругов вдоль хребта, а не заливкой
        // полигона: у полигона жёсткая кромка, и на add строй частиц читается
        // угловатыми плашками. Кромка обязана быть мягкой — это огонь, не аппликация.
        const N = 26;
        for (let i = 0; i <= N; i++) {
            const t = i / N;
            const r = prof(t) * half * (1 + 0.1 * Math.sin(t * 9 * wob + wph));
            if (r < 1.2) continue;
            // t=0 — толстое основание слева, t=1 — остриё справа (+X). С alignVel
            // частица ложится по скорости, и вести обязано ОСТРИЁ, а не комель.
            softCircle(ctx, 14 + t * 108, 64 + Math.sin(t * 2.1 + wph) * bend * t, r,
                0.3, [[0, 1], [0.42, 0.72], [1, 0]]);
        }
    },
    // УГОЛЁК: белое ядро + тёплый ореол. На add ядро выбивается в белый —
    // искра «раскалена», а не просто окрашена в оранжевый как dot.
    ember: function (ctx, p) {
        softCircle(ctx, 64, 64, 62, 1, [[0, 1], [0.12, 1], [0.22, 0.55], [0.45, 0.2], [1, 0]]);
    },
    shard: function (ctx, p) {
        const rng = AFX.mulberry32(900 + (p.var || 0) * 53);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        const n = 4 + Math.floor(rng() * 2);
        for (let i = 0; i < n; i++) {
            const a = i / n * Math.PI * 2 + rng() * 0.8;
            const r = (i % 2 ? 24 : 52) * (0.6 + rng() * 0.5);
            const x = 64 + Math.cos(a) * r * 1.15, y = 64 + Math.sin(a) * r * 0.7;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath(); ctx.fill();
    }
};

S.shapeDefs = [
    { id: 'soft',   label: 'Soft Circle' },
    { id: 'dot',    label: 'Circle' },
    { id: 'ring',   label: 'Ring', params: [{ k: 'th', label: 'Thickness', min: 0.02, max: 0.9, step: 0.01, def: 0.14 }] },
    { id: 'square', label: 'Square' },
    { id: 'poly',   label: 'Polygon', params: [{ k: 'n', label: 'Sides', min: 3, max: 16, step: 1, def: 6 }] },
    { id: 'star',   label: 'Star', params: [{ k: 'n', label: 'Points', min: 3, max: 12, step: 1, def: 5 }, { k: 'inr', label: 'Inner radius', min: 0.05, max: 0.95, step: 0.01, def: 0.5 }] },
    { id: 'streak', label: 'Streak' },
    { id: 'spark',  label: 'Spark' },
    { id: 'flame',  label: 'Flame Tongue', variants: 4, params: [{ k: 'taper', label: 'Taper', min: 0.1, max: 1, step: 0.02, def: 0.55 }] },
    { id: 'ember',  label: 'Ember' },
    { id: 'smoke',  label: 'Smoke Puff', variants: 4 },
    { id: 'blob',   label: 'Cartoon Puff', variants: 4 },
    { id: 'shard',  label: 'Shard', variants: 4 }
];
S.shapeDef = id => S.shapeDefs.find(d => d.id === id);

// ---------- сигнатуры и кэши ----------
// sprite ref: {kind:'shape', id, p:{...}} | {kind:'tex', texId}
S.sig = function (ref, variant) {
    if (!ref) return 'shape|soft|{}';
    if (ref.kind === 'tex') return 'tex:' + ref.texId;
    const p = Object.assign({}, ref.p || {});
    const def = S.shapeDef(ref.id);
    if (def && def.variants) p.var = variant == null ? (p.var || 0) : variant;
    return 'shape|' + ref.id + '|' + JSON.stringify(p);
};
S.variants = function (ref) {
    if (!ref || ref.kind !== 'shape') return 1;
    const def = S.shapeDef(ref.id);
    return def && def.variants ? def.variants : 1;
};

const baseCache = new Map();   // sig -> canvas (белый)
const tintCache = new Map();   // sig|hex -> canvas
const glowCache = new Map();   // sig|hex -> canvas (блюр, 2x)
const CACHE_MAX = 700;

function trimCache(map) {
    if (map.size <= CACHE_MAX) return;
    const keys = Array.from(map.keys()).slice(0, Math.floor(CACHE_MAX / 2));
    keys.forEach(k => map.delete(k));
}
function clearCachesFor(prefix) {
    [baseCache, tintCache, glowCache].forEach(m => {
        Array.from(m.keys()).forEach(k => { if (k.indexOf(prefix) === 0) m.delete(k); });
    });
}
S.clearShapeCache = clearCachesFor;

S.getBase = function (sig) {
    let c = baseCache.get(sig);
    if (c) return c;
    if (sig.indexOf('tex:') === 0) {
        const tex = S.texs.get(sig.slice(4));
        if (!tex) return null;
        return tex.img; // текстуры не перерисовываем
    }
    const parts = sig.split('|');
    const id = parts[1];
    const p = JSON.parse(parts[2] || '{}');
    c = cnv(BASE);
    const ctx = c.getContext('2d');
    (drawers[id] || drawers.soft)(ctx, p);
    baseCache.set(sig, c);
    trimCache(baseCache);
    return c;
};

S.getTinted = function (sig, hex) {
    if (hex === '#ffffff') return S.getBase(sig);
    const key = sig + '|' + hex;
    let c = tintCache.get(key);
    if (c) return c;
    const base = S.getBase(sig);
    if (!base) return null;
    const w = Math.min(base.width, 256), h = Math.min(base.height, 256);
    c = cnv(w, h);
    const ctx = c.getContext('2d');
    ctx.drawImage(base, 0, 0, w, h);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, w, h);
    tintCache.set(key, c);
    trimCache(tintCache);
    return c;
};

// свечение: тонированный спрайт с блюром, холст 2x
// blurFrac — радиус блюра как доля размера спрайта (0.02..0.6), квантуется для кэша
S.getGlow = function (sig, hex, blurFrac) {
    const bq = Math.round(AFX.clamp(blurFrac == null ? 0.15 : blurFrac, 0.02, 0.6) * 40) / 40;
    const key = sig + '|' + hex + '|' + bq;
    let c = glowCache.get(key);
    if (c) return c;
    const tinted = S.getTinted(sig, hex);
    if (!tinted) return null;
    const w = 192;
    c = cnv(w);
    const ctx = c.getContext('2d');
    ctx.filter = 'blur(' + Math.max(0.5, bq * w * 0.5) + 'px)';
    ctx.drawImage(tinted, w * 0.25, w * 0.25, w * 0.5, w * 0.5);
    ctx.filter = 'none';
    glowCache.set(key, c);
    trimCache(glowCache);
    return c;
};

// превью для UI (на тёмном)
S.preview = function (ref, size) {
    size = size || 40;
    const c = cnv(size);
    const ctx = c.getContext('2d');
    const sig = S.sig(ref, 0);
    const img = S.getBase(sig);
    if (img) {
        const iw = img.width, ih = img.height;
        const k = Math.min(size / iw, size / ih) * 0.92;
        ctx.drawImage(img, (size - iw * k) / 2, (size - ih * k) / 2, iw * k, ih * k);
    }
    return c;
};

S.refLabel = function (ref) {
    if (!ref) return '—';
    if (ref.kind === 'tex') {
        const t = S.texs.get(ref.texId);
        return t ? t.name : AFX.t('texture?');
    }
    const def = S.shapeDef(ref.id);
    return def ? AFX.t(def.label) : ref.id;
};
})();
