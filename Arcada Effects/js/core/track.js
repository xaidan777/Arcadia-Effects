// Arcaidia Effector — анимационные треки (ключи, изинги)
// Трек = число (статика) ИЛИ {keys:[{t,v,i:{m,h?},o:{m,h?}}]}.
// t ключей — в секундах ОТ НАЧАЛА СЛОЯ. Цветовой трек: v = [r,g,b].
// Режимы i/o: lin | ease | hold | cust (h=[x,y] — нормализованная ручка сегмента).
(function () {
'use strict';
const AFX = window.AFX;

const Track = AFX.Track = {};

Track.isAnim = v => !!(v && typeof v === 'object' && Array.isArray(v.keys));

Track.newKey = function (t, v) {
    return { t: t, v: Array.isArray(v) ? v.slice() : v, i: { m: 'ease' }, o: { m: 'ease' } };
};

// контрольные точки сегмента A->B (в нормализованном пространстве сегмента)
function segControls(A, B) {
    let p1x = 1 / 3, p1y = 1 / 3, p2x = 2 / 3, p2y = 2 / 3;
    const o = A.o || {}, i = B.i || {};
    if (o.m === 'ease') { p1x = 0.38; p1y = 0; }
    else if (o.m === 'cust' && o.h) { p1x = AFX.clamp(o.h[0], 0, 1); p1y = o.h[1]; }
    if (i.m === 'ease') { p2x = 0.62; p2y = 1; }
    else if (i.m === 'cust' && i.h) { p2x = AFX.clamp(i.h[0], 0, 1); p2y = i.h[1]; }
    return [p1x, p1y, p2x, p2y];
}

function evalKeys(keys, t, isColor) {
    const n = keys.length;
    if (!n) return isColor ? [255, 255, 255] : 0;
    if (t <= keys[0].t) return cloneV(keys[0].v);
    if (t >= keys[n - 1].t) return cloneV(keys[n - 1].v);
    let lo = 0;
    for (let k = 1; k < n; k++) { if (keys[k].t > t) { lo = k - 1; break; } }
    const A = keys[lo], B = keys[lo + 1];
    if ((A.o && A.o.m) === 'hold') return cloneV(A.v);
    const span = B.t - A.t;
    const u = span > 1e-9 ? (t - A.t) / span : 1;
    const c = segControls(A, B);
    const f = AFX.bezierEase(c[0], c[1], c[2], c[3], u);
    if (isColor) return AFX.rgbLerp(A.v, B.v, f);
    return A.v + (B.v - A.v) * f;
}

function cloneV(v) { return Array.isArray(v) ? v.slice() : v; }

// значение трека в момент t (t — относительное время слоя)
Track.val = function (tr, t) {
    if (Track.isAnim(tr)) return evalKeys(tr.keys, t, Array.isArray(tr.keys[0] && tr.keys[0].v));
    return typeof tr === 'number' ? tr : cloneV(tr);
};

Track.sort = function (tr) { tr.keys.sort((a, b) => a.t - b.t); };

// включить анимацию: статика -> трек с одним ключом в t
Track.enable = function (tr, t) {
    const v = Track.val(tr, t);
    return { keys: [Track.newKey(Math.max(0, t), v)] };
};
// выключить: трек -> статика со значением в t
Track.disable = function (tr, t) {
    return Track.val(tr, t);
};

Track.keyAt = function (tr, t, eps) {
    if (!Track.isAnim(tr)) return null;
    eps = eps || 1e-4;
    for (const k of tr.keys) if (Math.abs(k.t - t) <= eps) return k;
    return null;
};

// установить значение в t: обновить существующий ключ или создать новый (автокей)
Track.setValueAt = function (tr, t, v, eps) {
    let k = Track.keyAt(tr, t, eps);
    if (k) { k.v = cloneV(v); return k; }
    k = Track.newKey(Math.max(0, t), v);
    tr.keys.push(k);
    Track.sort(tr);
    return k;
};

Track.removeKey = function (tr, key) {
    const i = tr.keys.indexOf(key);
    if (i >= 0) tr.keys.splice(i, 1);
    return tr.keys.length;
};

// применить режим изинга к ключу (обе стороны)
Track.setEase = function (key, mode) {
    if (mode === 'easeIn') { key.i = { m: 'ease' }; if ((key.o && key.o.m) !== 'hold') key.o = { m: 'lin' }; return; }
    if (mode === 'easeOut') { key.o = { m: 'ease' }; key.i = { m: 'lin' }; return; }
    if (mode === 'hold') { key.o = { m: 'hold' }; return; }
    key.i = { m: mode }; key.o = { m: mode };
};

// сводный режим ключа для UI
Track.easeLabel = function (key) {
    const im = key.i && key.i.m, om = key.o && key.o.m;
    if (om === 'hold') return 'hold';
    if (im === 'cust' || om === 'cust') return 'cust';
    if (im === 'ease' && om === 'ease') return 'ease';
    if (im === 'ease') return 'easeIn';
    if (om === 'ease') return 'easeOut';
    return 'lin';
};

Track.segControls = segControls;
})();
