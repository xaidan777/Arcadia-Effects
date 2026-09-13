// Arcaidia Effector — центральная область: превью анимации и вкладка атласа
(function () {
'use strict';
const AFX = window.AFX;
const D = AFX.Dom, h = D.h, L = AFX.t;

const P = AFX.Preview = {};
let viewCanvas, viewCtx, hud;
let compCanvas, compCtx;
let zoom = 1, panX = 0, panY = 0, fitMode = true;
let bg = 'checker'; // checker | dark | black
let checkerPat = null;
let needsRedraw = true;
let atlasResult = null;   // {canvas, info}
let atlasDirty = true;
let atlasHover = -1;      // ячейка листа под курсором (вкладка atlas), -1 — мимо
let lastFrameT = 0, fpsSmooth = 0;
let zoomLabel = null, infoParts = null, infoFps = null;
let gizmosOn = true;
let pathBake = null;   // буфер запечённого пути гизмо (свой, не шарить с симуляцией)
// ---------- плеебл-вьюпорт вкладки атласа ----------
// Панель справа от вьюпорта (своя ширина --apw, сплиттер data-split="ap"). Показывает
// ячейку ГОТОВОГО листа: кадры уже посчитаны сборкой атласа, плейбек не гоняет
// симуляцию и стоит одного drawImage на кадр. Play на вкладке atlas значит «как это
// закрутится в игре»: идут ТОЛЬКО кадры листа и в заданном темпе (по умолчанию —
// собственный fps атласа), а не прогон композиции по времени. Зум/пан — как в превью.
let apWrap = null, apSplit = null, apStage = null, apCanvas = null, apCtx = null;
let apFrameEl = null, apInfoEl = null, apPlayBtn = null, apFpsInp = null, apZoomEl = null;
let apChecker = null;
let apZoom = 1, apPanX = 0, apPanY = 0, apFitMode = true;
let apFps = 0;          // 0 = авто (собственный fps атласа)
let apAcc = 0;          // аккумулятор кадров плейбека
// ---------- поле сил (оверлей «куда толкает») ----------
// Стрелка в узле сетки = ускорение, которое почувствует ПОКОЯЩАЯСЯ частица (v=0)
// выбранного эмиттера в этой точке в текущий момент. Ветер и flow пути — это
// скорости среды, в ускорение они переводятся ровно так же, как в sim.js:
// сопротивление тянет к ветру (drag*(W-v)), flow подтягивает вдоль касательной
// с темпом FLOW_K/DT. Шумовая турбулентность ('noise') поля НЕ образует — она
// своя у каждой частицы (аргументы — возраст и seed), рисовать там нечего.
let forcesOn = false;
let forceBake = null;   // свой буфер запекания пути (с гизмо и симуляцией не шарится)
const FCV = { x: 0, y: 0 };   // скретч curl-вектора: узлов сетки сотни на кадр
const FGN = { x: 0, y: 0, tx: 1, ty: 0, u: 0, d: 0, seg: 0, i: -1 };
const F_STEP = 46;      // шаг сетки в ЭКРАННЫХ px (до dpr) — на зуме постоянен
const F_NODES = 4000;   // предохранитель на число узлов сетки
const F_FLOW = 8;       // 1/с: темп подтягивания к flow (sim.js: FLOW_K / DT)
// шесть корзин прозрачности: чем сильнее поле в узле, тем ярче стрелка
const F_COLS = ['rgba(150,224,110,0.34)', 'rgba(150,224,110,0.46)', 'rgba(152,226,111,0.58)',
    'rgba(156,230,113,0.70)', 'rgba(160,234,116,0.82)', 'rgba(164,238,118,0.95)'];

// ---------- гизмо (контроллеры в превью) ----------
function snapLocalP(layer) {
    const fps = AFX.state.doc.comp.fps || 60;
    const tl = AFX.clamp(AFX.state.time - layer.start, 0, Math.max(0, layer.end - layer.start));
    return Math.round(tl * fps) / fps;
}
// запись с автокеем: трек — ключ в текущем времени, статика — напрямую
function setTrkVal(layer, obj, key, v) {
    const cur = obj[key];
    if (AFX.Track.isAnim(cur)) {
        AFX.Track.setValueAt(cur, snapLocalP(layer), v, 0.51 / (AFX.state.doc.comp.fps || 60));
    } else {
        obj[key] = v;
    }
}
// владелец центра гизмо: у эмиттера — em, у спрайта/атласа — sp, у постэффекта —
// центр РАДИАЛЬНОГО смаза (у directional центра нет, крест не показываем).
// У силового поля центра слоя нет вовсе: центры у каждого поля свои (res.ff).
function centerOwner(layer) {
    if (layer.type === 'emitter') return layer.em;
    if (layer.type === 'postfx') return (layer.fx && layer.fx.effect === 'mblur' && layer.fx.mode === 'radial') ? layer.fx : null;
    if (layer.type === 'force') return null;
    return layer.sp || null;
}
// цвет гизмо/оверлея по виду поля: сжатие — холодное, расширение — тёплое, закрутка — зелёная
const FF_COL = { collapse: '#69a8ff', expand: '#ff9a5c', drive: '#8ad86a' };

// экранные позиции контроллеров выбранного слоя (в пикселях бэкинга)
function gizmoInfo() {
    if (!gizmosOn || AFX.state.tab !== 'preview') return null;
    const layer = AFX.layerById(AFX.state.sel);
    if (!layer) return null;
    const doc = AFX.state.doc;
    const k = AFX.Model.compK(doc);
    const tl = AFX.state.time - layer.start;
    const T = AFX.Track;
    const view = (wx, wy) => [panX + (doc.comp.w / 2 + wx) * zoom, panY + (doc.comp.h / 2 + wy * k) * zoom];
    const o = centerOwner(layer);
    const centerW = o ? [T.val(o.x, tl), T.val(o.y, tl)] : null;
    const res = { layer: layer, k: k, center: centerW ? view(centerW[0], centerW[1]) : null, centerW: centerW };
    const pa = layer.type === 'emitter' ? layer.em.path : null;
    if (pa && pa.on && AFX.Path.nodeCount(pa) >= 1) {
        if (!pathBake) pathBake = AFX.Path.newBake();
        const b = AFX.Path.bake(pa, tl, centerW[0], centerW[1], pathBake);
        const poly = [];
        for (let i = 0; i < b.n; i++) poly.push(view(b.xs[i], b.ys[i]));
        const nodes = pa.nodes.map(nd => {
            const ox = T.val(nd.x, tl), oy = T.val(nd.y, tl);
            return { p: view(centerW[0] + ox, centerW[1] + oy), w: [ox, oy] };
        });
        res.path = { poly: poly, nodes: nodes, bake: b };
    }
    if (layer.fadeOn) {
        const fw = [T.val(layer.fadeX, tl), T.val(layer.fadeY, tl)];
        res.fade = view(fw[0], fw[1]);
        res.fadeW = fw;
        res.fadeR = Math.max(1, T.val(layer.fadeR, tl)) * zoom;
        res.fadeSoft = AFX.clamp(layer.fadeSoft == null ? 0.5 : layer.fadeSoft, 0, 1);
    }
    // СИЛОВЫЕ ПОЛЯ: у каждого поля свой центр и своя эллиптическая область.
    // Индекс — позиция в ff.fields (драг пишет ровно в неё), выключенные поля тоже
    // показываем: иначе их нечем поймать в превью.
    if (layer.type === 'force' && layer.ff && layer.ff.fields) {
        res.ff = layer.ff.fields.map(function (f, i) {
            const w = [T.val(f.x, tl), T.val(f.y, tl)];
            return {
                i: i, w: w, p: view(w[0], w[1]),
                rx: Math.max(1, T.val(f.sx, tl)) * zoom,
                ry: Math.max(1, T.val(f.sy, tl)) * zoom * k,
                mode: f.mode, off: f.on === false
            };
        });
    }
    return res;
}
function hitGizmo(mx, my) {
    const g = gizmoInfo();
    if (!g) return null;
    const thr = 13 * (window.devicePixelRatio || 1);
    const d2 = p => (mx - p[0]) * (mx - p[0]) + (my - p[1]) * (my - p[1]);
    if (g.path) {
        const nodes = g.path.nodes;
        for (let i = 0; i < nodes.length; i++) {
            if (d2(nodes[i].p) < thr * thr) return { kind: 'node', idx: i, base: { x: nodes[i].w[0], y: nodes[i].w[1] } };
        }
    }
    if (g.ff) {
        for (let i = 0; i < g.ff.length; i++) {
            if (d2(g.ff[i].p) < thr * thr) return { kind: 'ffield', idx: g.ff[i].i, base: { x: g.ff[i].w[0], y: g.ff[i].w[1] } };
        }
    }
    if (g.fade && d2(g.fade) < thr * thr) return { kind: 'fade', base: { x: g.fadeW[0], y: g.fadeW[1] } };
    if (g.center && d2(g.center) < thr * thr) return { kind: 'center', base: { x: g.centerW[0], y: g.centerW[1] } };
    return null;
}
// координаты мыши -> пиксели БЭКИНГА канвы (dpr-масштаб); третий элемент — сам масштаб
function toBack(e) {
    const r = viewCanvas.getBoundingClientRect();
    const k = viewCanvas.width / Math.max(1, r.width);
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k, k];
}
// пиксели бэкинга -> мировые координаты композиции (y без компрессии)
function worldOf(mx, my) {
    const doc = AFX.state.doc;
    const k = AFX.Model.compK(doc) || 1;
    return [(mx - panX) / zoom - doc.comp.w / 2, ((my - panY) / zoom - doc.comp.h / 2) / k];
}
// Alt+клик по линии пути: вставить узел в этом месте (возвращает индекс для драга)
function insertPathNode(mx, my) {
    const g = gizmoInfo();
    if (!g || !g.path || !g.path.bake.n) return null;
    const pa = g.layer.em.path;
    const w = worldOf(mx, my);
    const near = AFX.Path.nearest(g.path.bake, w[0], w[1]);
    if (near.d > 14 * (window.devicePixelRatio || 1) / zoom) return null;
    const idx = AFX.clamp(near.seg + 1, 1, pa.nodes.length);
    const off = { x: Math.round(near.x - g.centerW[0]), y: Math.round(near.y - g.centerW[1]) };
    AFX.pushUndo();
    pa.nodes.splice(idx, 0, off);
    AFX.touch(g.layer.id);
    AFX.commitEnd();
    AFX.Inspector.rebuild();
    return { idx: idx, base: { x: off.x, y: off.y } };
}
// дабл-клик по узлу — удалить (последние два узла не трогаем)
function deletePathNode(idx) {
    const layer = AFX.layerById(AFX.state.sel);
    const pa = layer && layer.em && layer.em.path;
    if (!pa || pa.nodes.length <= 2) return;
    AFX.pushUndo();
    pa.nodes.splice(idx, 1);
    AFX.touch(layer.id);
    AFX.commitEnd();
    AFX.Inspector.rebuild();
    needsRedraw = true;
}

// секундомер узла: оба трека x/y включаются/выключаются вместе
function nodeAnim(layer, nd, on) {
    AFX.pushUndo();
    const t = snapLocalP(layer);
    ['x', 'y'].forEach(k => { nd[k] = on ? AFX.Track.enable(nd[k], t) : AFX.Track.disable(nd[k], t); });
    AFX.touch(layer.id);
    AFX.commitEnd();
    AFX.Inspector.rebuild();
    needsRedraw = true;
}
// ключ на обоих треках узла в текущем времени
function nodeKey(layer, nd) {
    const eps = 0.51 / (AFX.state.doc.comp.fps || 60);
    AFX.pushUndo();
    const t = snapLocalP(layer);
    ['x', 'y'].forEach(k => {
        if (AFX.Track.isAnim(nd[k])) AFX.Track.setValueAt(nd[k], t, AFX.Track.val(nd[k], t), eps);
    });
    AFX.touch(layer.id);
    AFX.commitEnd();
    needsRedraw = true;
}
function pathEdit(layer, fn) {
    AFX.pushUndo();
    fn();
    AFX.touch(layer.id);
    AFX.commitEnd();
    AFX.Inspector.rebuild();
    needsRedraw = true;
}

// ПКМ в превью: операции с путём (узел / линия / слой) + общие пункты вьюпорта
function previewCtxMenu(e) {
    e.preventDefault();
    if (AFX.Dom.modalOpen && AFX.Dom.modalOpen()) return;
    const m = toBack(e);
    const layer = AFX.layerById(AFX.state.sel);
    const onPreview = AFX.state.tab === 'preview';
    const hit = onPreview ? hitGizmo(m[0], m[1]) : null;
    const pa = (onPreview && layer && layer.type === 'emitter') ? (layer.em.path || null) : null;
    const items = [];

    if (pa && pa.on && hit && hit.kind === 'node') {
        const nd = pa.nodes[hit.idx];
        const anim = AFX.Track.isAnim(nd.x) || AFX.Track.isAnim(nd.y);
        items.push({ label: L('Node') + ' ' + (hit.idx + 1), mark: anim ? L('animated') : null });
        items.push({ sep: true });
        if (anim) {
            items.push({ label: L('Key at current time'), click: function () { nodeKey(layer, nd); } });
            items.push({ label: L('Remove node animation'), click: function () { nodeAnim(layer, nd, false); } });
        } else {
            items.push({ label: L('Animate node'), click: function () { nodeAnim(layer, nd, true); } });
        }
        if (pa.nodes.length > 2) {
            items.push({ sep: true });
            items.push({ label: L('Delete node'), danger: true, click: function () { deletePathNode(hit.idx); } });
        }
    } else if (pa && pa.on) {
        const b = gizmoInfo();
        const onLine = !hit && b && b.path && b.path.bake.n > 1 && (function () {
            const w = worldOf(m[0], m[1]);
            return AFX.Path.nearest(b.path.bake, w[0], w[1]).d <= 14 * (window.devicePixelRatio || 1) / zoom;
        })();
        if (onLine) {
            items.push({ label: L('Insert node here'), click: function () { insertPathNode(m[0], m[1]); needsRedraw = true; } });
            items.push({ sep: true });
        }
        items.push({ label: L('Emit along path'), mark: pa.mode === 'emit' ? '·' : null, click: function () { pathEdit(layer, () => { pa.mode = 'emit'; }); } });
        items.push({ label: L('Guide particles'), mark: pa.mode === 'guide' ? '·' : null, click: function () { pathEdit(layer, () => { pa.mode = 'guide'; }); } });
        items.push({ label: L('Emit and guide'), mark: pa.mode === 'both' ? '·' : null, click: function () { pathEdit(layer, () => { pa.mode = 'both'; }); } });
        items.push({ sep: true });
        items.push({ label: L('Smooth curve'), mark: pa.smooth !== false ? '·' : null, click: function () { pathEdit(layer, () => { pa.smooth = pa.smooth === false; }); } });
        items.push({ label: L('Closed path'), mark: pa.closed ? '·' : null, click: function () { pathEdit(layer, () => { pa.closed = !pa.closed; }); } });
        items.push({ label: L('Reverse direction'), click: function () { pathEdit(layer, () => { pa.nodes.reverse(); }); } });
        items.push({ sep: true });
        items.push({ label: L('Disable path'), click: function () { pathEdit(layer, () => { pa.on = false; }); } });
    } else if (pa) {
        items.push({ label: L('Enable path'), click: function () { pathEdit(layer, () => { pa.on = true; }); } });
    }

    if (items.length) items.push({ sep: true });
    items.push({ label: L('Fit'), click: function () { P.fit(); } });
    items.push({
        label: L('Gizmos'), mark: gizmosOn ? '·' : null,
        click: function () { gizmosOn = !gizmosOn; AFX.emit('gizmos'); needsRedraw = true; }
    });
    items.push({
        label: L('Forces'), mark: forcesOn ? '·' : null,
        click: function () { forcesOn = !forcesOn; AFX.emit('forces'); needsRedraw = true; }
    });
    D.ctxMenu(e.clientX, e.clientY, items);
}

function drawGizmos() {
    const g = gizmoInfo();
    if (!g) return;
    const c = viewCtx;
    const dpr = window.devicePixelRatio || 1;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.lineWidth = 1.4 * dpr;

    // путь движения: линия + квадраты-узлы
    if (g.path && g.path.poly.length > 1) {
        const poly = g.path.poly;
        c.beginPath();
        c.moveTo(poly[0][0], poly[0][1]);
        for (let i = 1; i < poly.length; i++) c.lineTo(poly[i][0], poly[i][1]);
        c.strokeStyle = 'rgba(0,0,0,0.55)';
        c.lineWidth = 3.6 * dpr;
        c.stroke();
        c.strokeStyle = 'rgba(199,139,255,0.95)';
        c.lineWidth = 1.4 * dpr;
        c.stroke();
    }
    if (g.path) {
        const s2 = 4.5 * dpr;
        c.lineWidth = 1.4 * dpr;
        g.path.nodes.forEach(nd => {
            c.fillStyle = '#c78bff';
            c.strokeStyle = 'rgba(0,0,0,0.7)';
            c.fillRect(nd.p[0] - s2, nd.p[1] - s2, s2 * 2, s2 * 2);
            c.strokeRect(nd.p[0] - s2, nd.p[1] - s2, s2 * 2, s2 * 2);
        });
    }

    // радиальное затухание: внешний эллипс, пунктирная мягкая кромка, квадрат-центр
    if (g.fade) {
        const rx = g.fadeR, ry = g.fadeR * g.k;
        c.strokeStyle = 'rgba(230,131,82,0.9)';
        c.beginPath(); c.ellipse(g.fade[0], g.fade[1], rx, ry, 0, 0, Math.PI * 2); c.stroke();
        const inner = 1 - g.fadeSoft;
        if (inner > 0.02) {
            c.setLineDash([5 * dpr, 5 * dpr]);
            c.strokeStyle = 'rgba(230,131,82,0.45)';
            c.beginPath(); c.ellipse(g.fade[0], g.fade[1], rx * inner, ry * inner, 0, 0, Math.PI * 2); c.stroke();
            c.setLineDash([]);
        }
        const s = 5 * dpr;
        c.fillStyle = '#e68352';
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        c.fillRect(g.fade[0] - s, g.fade[1] - s, s * 2, s * 2);
        c.strokeRect(g.fade[0] - s, g.fade[1] - s, s * 2, s * 2);
    }

    // силовые поля: эллипс области + квадрат-центр, цвет по виду поля.
    // Выключенное поле рисуется пунктиром — поймать его драгом всё равно можно.
    if (g.ff) {
        g.ff.forEach(function (f) {
            const col = FF_COL[f.mode] || '#8ad86a';
            c.lineWidth = 1.4 * dpr;
            if (f.off) c.setLineDash([4 * dpr, 4 * dpr]);
            c.strokeStyle = 'rgba(0,0,0,0.5)';
            c.lineWidth = 3.2 * dpr;
            c.beginPath(); c.ellipse(f.p[0], f.p[1], f.rx, f.ry, 0, 0, Math.PI * 2); c.stroke();
            c.strokeStyle = col;
            c.lineWidth = 1.4 * dpr;
            c.beginPath(); c.ellipse(f.p[0], f.p[1], f.rx, f.ry, 0, 0, Math.PI * 2); c.stroke();
            c.setLineDash([]);
            const s = 5 * dpr;
            c.fillStyle = f.off ? 'rgba(120,120,120,0.8)' : col;
            c.strokeStyle = 'rgba(0,0,0,0.7)';
            c.fillRect(f.p[0] - s, f.p[1] - s, s * 2, s * 2);
            c.strokeRect(f.p[0] - s, f.p[1] - s, s * 2, s * 2);
        });
    }

    // центр слоя: круг с крестом (у постэффекта без центра его просто нет)
    if (g.center) {
        const r = 7 * dpr;
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        c.lineWidth = 3 * dpr;
        c.beginPath(); c.arc(g.center[0], g.center[1], r, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = '#59e3e2';
        c.lineWidth = 1.6 * dpr;
        c.beginPath(); c.arc(g.center[0], g.center[1], r, 0, Math.PI * 2); c.stroke();
        c.beginPath();
        c.moveTo(g.center[0] - r * 1.9, g.center[1]); c.lineTo(g.center[0] + r * 1.9, g.center[1]);
        c.moveTo(g.center[0], g.center[1] - r * 1.9); c.lineTo(g.center[0], g.center[1] + r * 1.9);
        c.stroke();
    }
    c.restore();
}

// поле сил выбранного эмиттера. pts — плоский массив по 5 чисел на узел:
// x, y (пиксели бэкинга), dx, dy (направление НА ЭКРАНЕ, y сжат камерой),
// m (модуль в мировых px/с²). Аллокация массива на кадр — оверлей, не горячий путь.
// сетка оверлея: шаг постоянен на ЭКРАНЕ, узлы привязаны к мировым координатам
// (при пане не плывут). Область — рамка композиции, обрезанная видимой частью канвы.
function forceGrid(doc, k) {
    const dpr = window.devicePixelRatio || 1;
    let stepX = F_STEP * dpr / zoom, stepY = stepX / k;
    const bx = doc.comp.w / 2, by = doc.comp.h / (2 * k);
    const wa = worldOf(0, 0), wb = worldOf(viewCanvas.width, viewCanvas.height);
    const x0 = Math.max(-bx, Math.min(wa[0], wb[0])), x1 = Math.min(bx, Math.max(wa[0], wb[0]));
    const y0 = Math.max(-by, Math.min(wa[1], wb[1])), y1 = Math.min(by, Math.max(wa[1], wb[1]));
    if (x1 < x0 || y1 < y0) return null;
    let ix0 = Math.ceil(x0 / stepX), ix1 = Math.floor(x1 / stepX);
    let iy0 = Math.ceil(y0 / stepY), iy1 = Math.floor(y1 / stepY);
    const nodes = Math.max(0, ix1 - ix0 + 1) * Math.max(0, iy1 - iy0 + 1);
    if (nodes > F_NODES) {   // защита от абсурдной сетки: разрежаем шаг
        const q = Math.ceil(Math.sqrt(nodes / F_NODES));
        stepX *= q; stepY *= q;
        ix0 = Math.ceil(x0 / stepX); ix1 = Math.floor(x1 / stepX);
        iy0 = Math.ceil(y0 / stepY); iy1 = Math.floor(y1 / stepY);
    }
    return { stepX: stepX, stepY: stepY, ix0: ix0, ix1: ix1, iy0: iy0, iy1: iy1 };
}

// распаковка силовых полей на текущий момент — ровно как Sim.forceStep, но в объекты:
// оверлей считается раз на кадр, экономить тут не на чем. Время каждого поля своё
// (ключи от start его слоя), поэтому местное время = глобальное минус start слоя-поля.
function ffUnpack(list, gt) {
    const T = AFX.Track;
    const res = [];
    list.forEach(function (fl) {
        const flt = gt - fl.start;
        if (flt < 0 || flt > fl.end - fl.start) return;
        const gain = AFX.clamp(T.val(fl.opacity, flt), 0, 1);
        if (gain <= 0.001) return;
        (fl.ff.fields || []).forEach(function (f) {
            if (f.on === false) return;
            const s = T.val(f.strength, flt) * gain;
            if (s === 0) return;
            res.push({
                mode: f.mode, x: T.val(f.x, flt), y: T.val(f.y, flt),
                rx: Math.max(1, T.val(f.sx, flt)), ry: Math.max(1, T.val(f.sy, flt)),
                s: s, fo: Math.max(0, f.falloff == null ? 1 : f.falloff)
            });
        });
    });
    return res.length ? res : null;
}
// ускорение от силовых полей в мировой точке — та же арифметика, что в Sim.step
function ffAccum(ffl, wx, wy, out) {
    out.x = 0; out.y = 0;
    for (let i = 0; i < ffl.length; i++) {
        const f = ffl[i];
        const dx = (wx - f.x) / f.rx, dy = (wy - f.y) / f.ry;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const u = 1 - Math.sqrt(d2);
        const w = f.fo === 1 ? u : (f.fo === 0 ? 1 : Math.pow(u, f.fo));
        if (w <= 0) continue;
        let ux = dx / f.rx, uy = dy / f.ry;
        const ul = Math.sqrt(ux * ux + uy * uy);
        if (ul < 1e-9) continue;
        ux /= ul; uy /= ul;
        const s = f.s * w;
        if (f.mode === 'drive') { out.x -= uy * s; out.y += ux * s; }
        else if (f.mode === 'expand') { out.x += ux * s; out.y += uy * s; }
        else { out.x -= ux * s; out.y -= uy * s; }
    }
    return out;
}

// выбран сам слой силового поля: рисуем ЕГО поля, без физики какого-либо эмиттера —
// так поле настраивается само по себе, ещё до того как назначены адресаты
function forceOnlyInfo(info, doc, layer) {
    const k = AFX.Model.compK(doc) || 1;
    const ffl = ffUnpack([layer], AFX.state.time);
    if (!ffl) { info.note = L('no active fields in this layer'); return info; }
    info.tags.push(L('force fields') + ' ×' + ffl.length);
    const G = forceGrid(doc, k);
    if (!G) return info;
    const cx = doc.comp.w / 2, cy = doc.comp.h / 2;
    for (let iy = G.iy0; iy <= G.iy1; iy++) {
        const wy = iy * G.stepY;
        for (let ix = G.ix0; ix <= G.ix1; ix++) {
            const wx = ix * G.stepX;
            ffAccum(ffl, wx, wy, FCV);
            const m = Math.sqrt(FCV.x * FCV.x + FCV.y * FCV.y);
            if (m > info.max) info.max = m;
            info.pts.push(panX + (cx + wx) * zoom, panY + (cy + wy * k) * zoom, FCV.x, FCV.y * k, m);
        }
    }
    return info;
}

function forceInfo() {
    if (!forcesOn || AFX.state.tab !== 'preview') return null;
    const doc = AFX.state.doc;
    const layer = AFX.layerById(AFX.state.sel);
    const info = { pts: [], max: 0, tags: [], hint: null, note: null };
    if (!layer || (layer.type !== 'emitter' && layer.type !== 'force')) {
        info.note = L('select an emitter or a force field layer');
        return info;
    }
    // выбран сам слой силового поля — показываем ровно его поля, без физики частиц
    if (layer.type === 'force') return forceOnlyInfo(info, doc, layer);

    const T = AFX.Track;
    const em = layer.em, pt = layer.pt;
    const tl = AFX.state.time - layer.start;
    const k = AFX.Model.compK(doc) || 1;
    // силовые поля, адресованные этому эмиттеру (тот же индекс, что читает симуляция)
    const fidx = AFX.Model.forceIndex(doc);
    const fcRec = fidx ? fidx.get(layer.id) : null;
    const ffl = fcRec ? ffUnpack(fcRec.list, AFX.state.time) : null;

    const gx = T.val(pt.gravX, tl), gy = T.val(pt.gravY, tl);
    const curl = pt.turbMode === 'curl';
    const ta = Math.max(0, T.val(pt.turbAmp, tl));
    const drag = Math.max(0, pt.drag || 0);
    // вихрь и ветер читают ОДИН вектор поля — складываем их коэффициенты
    const cAmp = curl ? ta : 0;
    const cWind = curl ? (pt.turbWind || 0) * drag : 0;
    const cK = cAmp + cWind;
    const tsc = Math.max(4, pt.turbScale || 90);
    const toc = AFX.clamp(pt.turbOct | 0 || 1, 1, 4);
    const tsd = (pt.turbSeed | 0) * 4099;
    const tri = curl ? (pt.turbRise || 0) : 0;
    const tf = pt.turbFreq || 1;

    // ведение путём: пружина к ближайшей точке + разгон вдоль касательной
    const pa = em.path;
    let pb = null, at = 0, flow = 0;
    if (AFX.Path.active(pa) && (pa.mode === 'guide' || pa.mode === 'both')) {
        at = Math.max(0, T.val(pa.attract, tl));
        flow = T.val(pa.flow, tl);
        if (at > 0 || flow !== 0) {
            if (!forceBake) forceBake = AFX.Path.newBake();
            const b = AFX.Path.bake(pa, tl, T.val(em.x, tl), T.val(em.y, tl), forceBake);
            if (b.n > 0) pb = b;
        }
    }
    if (gx !== 0 || gy !== 0) info.tags.push(L('gravity'));
    if (cAmp !== 0) info.tags.push(L('curl'));
    if (cWind !== 0) info.tags.push(L('wind'));
    if (pb) info.tags.push(L('path'));
    if (ffl) info.tags.push(L('force fields') + ' ×' + ffl.length);
    if (!curl && ta > 0) info.hint = L('noise turbulence is per-particle');
    if (!info.tags.length) { info.note = L('no field forces'); return info; }

    const G = forceGrid(doc, k);
    if (!G) return info;
    const stepX = G.stepX, stepY = G.stepY;

    const cx = doc.comp.w / 2, cy = doc.comp.h / 2;
    for (let iy = G.iy0; iy <= G.iy1; iy++) {
        const wy = iy * stepY;
        for (let ix = G.ix0; ix <= G.ix1; ix++) {
            const wx = ix * stepX;
            let fx = gx, fy = gy;
            if (cK !== 0) {
                AFX.curl2(wx, wy + tri * tl, tl * tf, tsc, toc, tsd, FCV);
                fx += FCV.x * cK; fy += FCV.y * cK;
            }
            if (pb) {
                const gn = AFX.Path.nearest(pb, wx, wy, FGN, -1, 0);
                if (at !== 0) { fx += (gn.x - wx) * at; fy += (gn.y - wy) * at; }
                if (flow !== 0) { fx += gn.tx * flow * F_FLOW; fy += gn.ty * flow * F_FLOW; }
            }
            if (ffl) { ffAccum(ffl, wx, wy, FCV); fx += FCV.x; fy += FCV.y; }
            const m = Math.sqrt(fx * fx + fy * fy);
            if (m > info.max) info.max = m;
            info.pts.push(panX + (cx + wx) * zoom, panY + (cy + wy * k) * zoom, fx, fy * k, m);
        }
    }
    return info;
}

// стрелки поля + строка легенды. Длина стрелки нормирована максимумом ПО КАДРУ:
// поле читается и при гравитации 5, и при 900. Легенда рисуется СВЕРХУ слева —
// снизу слева живёт #preview-hud.
function drawForces() {
    const f = forceInfo();
    if (!f) return;
    const c = viewCtx;
    const dpr = window.devicePixelRatio || 1;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.lineCap = 'round';
    c.lineJoin = 'round';

    const pts = f.pts, max = f.max, nb = F_COLS.length;
    if (pts.length && max > 1e-6) {
        // стрелки копятся в Path2D по корзинам: одна обводка и одна заливка на корзину
        const rods = [], heads = [];
        for (let b = 0; b < nb; b++) { rods.push(new Path2D()); heads.push(new Path2D()); }
        const lenMax = F_STEP * dpr * 0.44;
        for (let i = 0; i < pts.length; i += 5) {
            const x = pts[i], y = pts[i + 1];
            const dx = pts[i + 2], dy = pts[i + 3], m = pts[i + 4];
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 1e-9 || m < max * 1e-3) continue;   // мёртвая точка поля
            const q = Math.pow(m / max, 0.55);
            const b = Math.min(nb - 1, Math.max(0, Math.floor(q * nb)));
            const len = lenMax * Math.max(0.14, q);
            const ux = dx / d, uy = dy / d;
            const hx = x + ux * len, hy = y + uy * len;
            const hs = Math.min(4.6 * dpr, len * 0.6), hw = hs * 0.52;
            rods[b].moveTo(x, y); rods[b].lineTo(hx, hy);
            heads[b].moveTo(hx, hy);
            heads[b].lineTo(hx - ux * hs - uy * hw, hy - uy * hs + ux * hw);
            heads[b].lineTo(hx - ux * hs + uy * hw, hy - uy * hs - ux * hw);
            heads[b].closePath();
        }
        c.strokeStyle = 'rgba(0,0,0,0.45)';   // подложка: поле читается и на светлом фоне
        c.lineWidth = 3.2 * dpr;
        for (let b = 0; b < nb; b++) { c.stroke(rods[b]); c.stroke(heads[b]); }
        c.lineWidth = 1.3 * dpr;
        for (let b = 0; b < nb; b++) {
            c.strokeStyle = F_COLS[b];
            c.fillStyle = F_COLS[b];
            c.stroke(rods[b]);
            c.fill(heads[b]);
        }
    }

    let label = L('Forces') + ': ' + (f.note ||
        f.tags.join(' + ') + '   ' + L('peak') + ' ' + Math.round(f.max) + ' ' + L('px/s²'));
    if (f.hint) label += '   (' + f.hint + ')';
    c.font = Math.round(11 * dpr) + 'px Consolas, monospace';
    c.textBaseline = 'top';
    c.lineWidth = 3 * dpr;
    c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.strokeText(label, 10 * dpr, 8 * dpr);
    c.fillStyle = 'rgba(164,238,118,0.9)';
    c.fillText(label, 10 * dpr, 8 * dpr);
    c.restore();
}

P.init = function () {
    viewCanvas = document.getElementById('view-canvas');
    viewCtx = viewCanvas.getContext('2d');
    hud = document.getElementById('preview-hud');
    compCanvas = document.createElement('canvas');
    compCtx = compCanvas.getContext('2d');

    buildToolbar();
    buildAtlasPlay();
    makeChecker();

    // зум и пан (координаты мыши переводим в пиксели бэкинга канвы — toBack)
    viewCanvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        const m = toBack(e);
        const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const nz = AFX.clamp(zoom * k, 0.05, 16);
        panX = m[0] - (m[0] - panX) * (nz / zoom);
        panY = m[1] - (m[1] - panY) * (nz / zoom);
        zoom = nz;
        fitMode = false;
        needsRedraw = true;
        updateZoomLabel();
    }, { passive: false });
    // ЛКМ: гизмо (центр слоя / центр затухания) либо пан; СКМ: всегда пан
    let panStartX = 0, panStartY = 0;
    let dragMode = null, dragBase = null, dragStarted = false, dragIdx = -1;
    D.drag(viewCanvas, {
        button: 0,
        start: function (e) {
            const m = toBack(e);
            let hit = AFX.state.tab === 'preview' ? hitGizmo(m[0], m[1]) : null;
            dragStarted = false;
            // Alt по линии пути — вставка узла (undo уже запушен внутри), драг продолжает его тащить
            if (!hit && e.altKey && AFX.state.tab === 'preview') {
                const ins = insertPathNode(m[0], m[1]);
                if (ins) { hit = { kind: 'node', idx: ins.idx, base: ins.base }; dragStarted = true; }
            }
            if (hit) {
                dragMode = hit.kind;
                dragBase = hit.base;
                dragIdx = hit.idx != null ? hit.idx : -1;
            } else {
                dragMode = 'pan';
                panStartX = panX; panStartY = panY;
            }
        },
        move: function (e, dx, dy) {
            const kf = viewCanvas.width / Math.max(1, viewCanvas.getBoundingClientRect().width);
            if (dragMode === 'pan') {
                panX = panStartX + dx * kf;
                panY = panStartY + dy * kf;
                fitMode = false;
                needsRedraw = true;
                return;
            }
            const layer = AFX.layerById(AFX.state.sel);
            if (!layer) return;
            if (!dragStarted) { dragStarted = true; AFX.pushUndo(); }
            const kComp = AFX.Model.compK(AFX.state.doc) || 1;
            const wdx = dx * kf / zoom;
            const wdy = dy * kf / zoom / kComp;
            if (dragMode === 'center') {
                const o = centerOwner(layer);
                if (!o) return;
                setTrkVal(layer, o, 'x', dragBase.x + wdx);
                setTrkVal(layer, o, 'y', dragBase.y + wdy);
            } else if (dragMode === 'fade') {
                setTrkVal(layer, layer, 'fadeX', dragBase.x + wdx);
                setTrkVal(layer, layer, 'fadeY', dragBase.y + wdy);
            } else if (dragMode === 'node') {
                const nd = layer.em && layer.em.path && layer.em.path.nodes[dragIdx];
                if (!nd) return;
                setTrkVal(layer, nd, 'x', dragBase.x + wdx);
                setTrkVal(layer, nd, 'y', dragBase.y + wdy);
            } else if (dragMode === 'ffield') {
                const f = layer.ff && layer.ff.fields && layer.ff.fields[dragIdx];
                if (!f) return;
                setTrkVal(layer, f, 'x', dragBase.x + wdx);
                setTrkVal(layer, f, 'y', dragBase.y + wdy);
            }
            AFX.touch(layer.id);
            needsRedraw = true;
        },
        end: function (e, moved) {
            if (dragMode !== 'pan' && moved) AFX.commitEnd();
            // клик без протяжки по листу = выбрать кадр (драг остаётся паном)
            if (!moved && AFX.state.tab === 'atlas') {
                const m = toBack(e);
                selectAtlasCell(atlasCellAt(m[0], m[1]));
            }
            dragMode = null;
        }
    });
    // подсветка ячейки под курсором (только на вкладке листа)
    viewCanvas.addEventListener('pointermove', function (e) {
        if (AFX.state.tab !== 'atlas') { setAtlasHover(-1); return; }
        const m = toBack(e);
        setAtlasHover(atlasCellAt(m[0], m[1]));
    });
    viewCanvas.addEventListener('pointerleave', function () { setAtlasHover(-1); });
    D.drag(viewCanvas, {
        button: 1,
        start: function () { panStartX = panX; panStartY = panY; },
        move: function (e, dx, dy) {
            const kf = viewCanvas.width / Math.max(1, viewCanvas.getBoundingClientRect().width);
            panX = panStartX + dx * kf;
            panY = panStartY + dy * kf;
            fitMode = false;
            needsRedraw = true;
        }
    });
    // дабл-клик по пути: узел — удалить, линия между узлами — вставить узел;
    // мимо пути (или с выключенными гизмо) — прежнее «вписать в окно»
    viewCanvas.addEventListener('dblclick', function (e) {
        const m = toBack(e);
        // по ячейке листа дабл-клик НЕ вписывает: иначе выбор кадра дёргал бы вид
        if (AFX.state.tab === 'atlas' && atlasCellAt(m[0], m[1]) >= 0) return;
        const hit = AFX.state.tab === 'preview' ? hitGizmo(m[0], m[1]) : null;
        if (hit && hit.kind === 'node') { deletePathNode(hit.idx); return; }
        if (hit) return;
        if (AFX.state.tab === 'preview' && insertPathNode(m[0], m[1])) { needsRedraw = true; return; }
        P.fit();
    });
    viewCanvas.addEventListener('contextmenu', previewCtxMenu);

    // приём текстуры из панели текстур: создаётся спрайт-слой в точке броска
    const area = viewCanvas.parentElement;
    area.addEventListener('dragover', function (e) {
        if (Array.from(e.dataTransfer.types).includes('text/afx-tex')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    });
    area.addEventListener('drop', function (e) {
        const texId = e.dataTransfer.getData('text/afx-tex');
        if (!texId) return;
        e.preventDefault();
        e.stopPropagation();
        const m = toBack(e);
        const doc = AFX.state.doc;
        const compX = (m[0] - panX) / zoom - doc.comp.w / 2;
        const compY = (m[1] - panY) / zoom - doc.comp.h / 2;
        const kComp = AFX.Model.compK(doc);
        AFX.Ops.addTextureLayer(texId, {
            x: AFX.clamp(compX, -doc.comp.w, doc.comp.w),
            y: AFX.clamp(compY / (kComp || 1), -doc.comp.h, doc.comp.h)
        });
    });

    window.addEventListener('resize', resize);
    AFX.on('resize', resize);
    AFX.on('layer', function () { needsRedraw = true; atlasDirty = true; });
    AFX.on('layers', function () { needsRedraw = true; atlasDirty = true; });
    AFX.on('comp', function () { needsRedraw = true; atlasDirty = true; });
    AFX.on('doc', function () { needsRedraw = true; atlasDirty = true; apFitMode = true; P.fit(); });
    AFX.on('time', function () { needsRedraw = true; });
    AFX.on('select', function () { needsRedraw = true; });
    AFX.on('atlas', function () { atlasDirty = true; needsRedraw = true; });
    // смена вкладки меняет ШИРИНУ вьюпорта (справа открывается плеебл-панель) —
    // канву обязательно пересчитать до fit, иначе вписывание уедет
    AFX.on('tab', function () { syncAtlasPlay(); setAtlasHover(-1); apFitMode = true; resize(); needsRedraw = true; P.fit(); });

    resize();
    requestAnimationFrame(loop);
};

function buildToolbar() {
    const bar = document.getElementById('preview-toolbar');
    const tabPrev = h('button', { cls: 'tab-btn on', text: L('Preview'), tip: L('Animated preview of the composition with gizmos, zoom and pan (F — fit)') });
    const tabAtlas = h('button', { cls: 'tab-btn', text: L('Atlas'), tip: L('The assembled sprite sheet as it will be exported, with frame playback on the side') });
    tabPrev.addEventListener('click', function () { AFX.setTab('preview'); });
    tabAtlas.addEventListener('click', function () { AFX.setTab('atlas'); });
    AFX.on('tab', function () {
        tabPrev.classList.toggle('on', AFX.state.tab === 'preview');
        tabAtlas.classList.toggle('on', AFX.state.tab === 'atlas');
    });
    bar.appendChild(tabPrev);
    bar.appendChild(tabAtlas);
    bar.appendChild(h('span', { cls: 'pt-sep' }));

    const bFit = h('button', { cls: 'mini-btn', text: L('Fit'), tip: L('Fit the view to the window (F or double-click an empty spot)') });
    bFit.addEventListener('click', function () { P.fit(); });
    const b100 = h('button', { cls: 'mini-btn', text: '100%', tip: L('Zoom to 100% — one composition pixel per pixel of the canvas') });
    b100.addEventListener('click', function () {
        zoom = 1; fitMode = false;
        centerComp();
        needsRedraw = true;
        updateZoomLabel();
    });
    zoomLabel = h('span', { style: 'color:#9a917a;font-size:11px;min-width:44px;', text: '100%' });
    bar.appendChild(bFit);
    bar.appendChild(b100);
    bar.appendChild(zoomLabel);
    bar.appendChild(h('span', { cls: 'pt-sep' }));

    const bgSel = h('select', { cls: 'w-select', style: 'flex:none;width:110px;', tip: L('Background under the effect — only for viewing, it never gets into the export') });
    [['checker', L('Checker')], ['dark', L('Dark bg')], ['black', L('Black bg')], ['light', L('Light bg')]].forEach(o =>
        bgSel.appendChild(h('option', { value: o[0], text: o[1] })));
    bgSel.value = bg;
    bgSel.addEventListener('change', function () { bg = bgSel.value; needsRedraw = true; bgSel.blur(); });
    bar.appendChild(bgSel);

    const bGiz = h('button', { cls: 'mini-btn on', text: L('Gizmos'), tip: L('Show position, fade and path controllers (drag moves them, Alt+click on the path adds a node)') });
    bGiz.addEventListener('click', function () {
        gizmosOn = !gizmosOn;
        AFX.emit('gizmos');
        needsRedraw = true;
    });
    AFX.on('gizmos', function () { bGiz.classList.toggle('on', gizmosOn); });
    bar.appendChild(bGiz);

    const bForce = h('button', { cls: 'mini-btn', text: L('Forces'), tip: L('Arrows showing where a resting particle is pushed: gravity, curl, wind, path pull and force fields') });
    bForce.addEventListener('click', function () {
        forcesOn = !forcesOn;
        AFX.emit('forces');
        needsRedraw = true;
    });
    AFX.on('forces', function () { bForce.classList.toggle('on', forcesOn); });
    bar.appendChild(bForce);

    const info = h('span', { cls: 'pt-info' });
    infoParts = h('span', { text: '' });
    infoFps = h('span', { text: '' });
    info.appendChild(infoParts);
    info.appendChild(infoFps);
    bar.appendChild(info);
}

// плитка шахматки одна на модуль: паттерн создаётся ОТ СВОЕГО контекста
// (у превью и у плеебл-вьюпорта канвы разные)
let checkerTile = null;
function checkerTileC() {
    if (!checkerTile) {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const x = c.getContext('2d');
        x.fillStyle = '#232323'; x.fillRect(0, 0, 16, 16);
        x.fillStyle = '#2e2e2e'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
        checkerTile = c;
    }
    return checkerTile;
}
function makeChecker() { checkerPat = viewCtx.createPattern(checkerTileC(), 'repeat'); }

// фон под кадром — тот же селектор фона, что у превью
function fillBg(ctx, w, hgt, pat) {
    if (bg === 'checker') ctx.fillStyle = pat;
    else ctx.fillStyle = bg === 'black' ? '#000' : (bg === 'light' ? '#e4e4e4' : '#191919');
    ctx.fillRect(0, 0, w, hgt);
}

function resize() {
    const r = viewCanvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    viewCanvas.width = Math.max(2, Math.round(r.width * dpr));
    viewCanvas.height = Math.max(2, Math.round(r.height * dpr));
    if (fitMode) P.fit();
    needsRedraw = true;
}

function contentSize() {
    if (AFX.state.tab === 'atlas' && atlasResult) return [atlasResult.canvas.width, atlasResult.canvas.height];
    return [AFX.state.doc.comp.w, AFX.state.doc.comp.h];
}

function centerComp() {
    const cs = contentSize();
    panX = (viewCanvas.width - cs[0] * zoom) / 2;
    panY = (viewCanvas.height - cs[1] * zoom) / 2;
}

P.fit = function () {
    const cs = contentSize();
    const kw = viewCanvas.width / cs[0], kh = viewCanvas.height / cs[1];
    zoom = Math.min(kw, kh) * 0.92;
    centerComp();
    fitMode = true;
    needsRedraw = true;
    updateZoomLabel();
};

function updateZoomLabel() {
    if (zoomLabel) zoomLabel.textContent = Math.round(zoom / (window.devicePixelRatio || 1) * 100) + '%';
}

function loop(ts) {
    requestAnimationFrame(loop);
    const doc = AFX.state.doc;
    if (!doc) return;

    // плейбек: на вкладке атласа — только кадры листа, иначе непрерывное время
    if (AFX.state.playing) {
        const dt = Math.min(0.1, (ts - lastFrameT) / 1000 || 0);
        if (AFX.state.tab === 'atlas') playAtlasFrames(dt);
        else {
            let t = AFX.state.time + dt;
            if (t >= doc.comp.dur) {
                if (AFX.state.loop) t = t % doc.comp.dur;
                else { t = doc.comp.dur; AFX.setPlaying(false); }
            }
            AFX.state.time = t;
            AFX.emit('time');
            needsRedraw = true;
        }
    }
    // fps
    const frameDt = ts - lastFrameT;
    lastFrameT = ts;
    if (AFX.state.playing && frameDt > 0) {
        fpsSmooth = fpsSmooth * 0.9 + (1000 / frameDt) * 0.1;
        infoFps.textContent = Math.round(fpsSmooth) + ' fps';
    }

    if (!needsRedraw) return;
    needsRedraw = false;
    draw();
}

function draw() {
    const doc = AFX.state.doc;
    const w = viewCanvas.width, hgt = viewCanvas.height;
    viewCtx.setTransform(1, 0, 0, 1, 0, 0);
    viewCtx.fillStyle = '#151310';
    viewCtx.fillRect(0, 0, w, hgt);

    if (AFX.state.tab === 'atlas') {
        drawAtlasTab();
        drawAtlasPlay();
        return;
    }

    // рендер композиции
    if (compCanvas.width !== doc.comp.w || compCanvas.height !== doc.comp.h) {
        compCanvas.width = doc.comp.w;
        compCanvas.height = doc.comp.h;
    }
    AFX.previewEngine.render(doc, AFX.state.time, compCtx);
    infoParts.textContent = L('particles') + ': ' + AFX.previewEngine.lastCount;

    // фон композиции
    const cw = doc.comp.w * zoom, ch = doc.comp.h * zoom;
    viewCtx.save();
    viewCtx.translate(panX, panY);
    if (bg === 'checker') {
        viewCtx.fillStyle = checkerPat;
        viewCtx.fillRect(0, 0, cw, ch);
    } else {
        viewCtx.fillStyle = bg === 'black' ? '#000' : (bg === 'light' ? '#e4e4e4' : '#191919');
        viewCtx.fillRect(0, 0, cw, ch);
    }
    // при активном слое-пикселизаторе зум обязан показывать РОВНЫЕ БЛОКИ, а не мыло:
    // превью не должно врать про то, что уйдёт в атлас
    viewCtx.imageSmoothingEnabled = !(zoom > 1.01 && AFX.Model.pixelGrid(doc));
    viewCtx.imageSmoothingQuality = 'high';
    viewCtx.drawImage(compCanvas, 0, 0, cw, ch);
    // рамка и центр
    viewCtx.strokeStyle = 'rgba(89,227,226,0.35)';
    viewCtx.lineWidth = 1;
    viewCtx.strokeRect(0.5, 0.5, cw - 1, ch - 1);
    viewCtx.strokeStyle = 'rgba(89,227,226,0.12)';
    viewCtx.beginPath();
    viewCtx.moveTo(cw / 2, 0); viewCtx.lineTo(cw / 2, ch);
    viewCtx.moveTo(0, ch / 2); viewCtx.lineTo(cw, ch / 2);
    viewCtx.stroke();
    viewCtx.restore();

    drawForces();
    drawGizmos();

    hud.textContent = doc.comp.w + 'x' + doc.comp.h + '   t=' + AFX.fmtTime(AFX.state.time) + L('s');
}

function drawAtlasTab() {
    if (atlasDirty) {
        try {
            atlasResult = AFX.Atlas.build(AFX.state.doc);
        } catch (e) {
            console.error('atlas', e);
        }
        atlasDirty = false;
        if (fitMode) P.fit();
    }
    if (!atlasResult) return;
    const a = atlasResult.canvas;
    const aw = a.width * zoom, ah = a.height * zoom;
    viewCtx.save();
    viewCtx.translate(panX, panY);
    if (atlasResult.info.mode === 'rgba') {
        viewCtx.fillStyle = checkerPat;
        viewCtx.fillRect(0, 0, aw, ah);
    }
    viewCtx.imageSmoothingEnabled = zoom < 1.01;
    viewCtx.drawImage(a, 0, 0, aw, ah);

    // сетка ячеек
    const info = atlasResult.info;
    viewCtx.strokeStyle = 'rgba(89,227,226,0.4)';
    viewCtx.lineWidth = 1;
    for (let i = 0; i <= info.cols; i++) {
        const x = Math.round(i * info.frameWidth * zoom) + 0.5;
        viewCtx.beginPath(); viewCtx.moveTo(x, 0); viewCtx.lineTo(x, ah); viewCtx.stroke();
    }
    for (let j = 0; j <= info.rows; j++) {
        const y = Math.round(j * info.frameHeight * zoom) + 0.5;
        viewCtx.beginPath(); viewCtx.moveTo(0, y); viewCtx.lineTo(aw, y); viewCtx.stroke();
    }
    // номера кадров
    viewCtx.fillStyle = 'rgba(229,219,186,0.6)';
    viewCtx.font = Math.max(9, 11 * Math.min(1.5, zoom)) + 'px Consolas, monospace';
    for (let i = 0; i < info.frames; i++) {
        const cx2 = (i % info.cols) * info.frameWidth * zoom + 4 * zoom + 2;
        const cy2 = Math.floor(i / info.cols) * info.frameHeight * zoom + 12 * Math.min(1.5, zoom) + 2;
        viewCtx.fillText(String(i + 1), cx2, cy2);
    }
    // рамка ячейки под курсором и ячейка, которая сейчас в плеебл-вьюпорте
    // (на плейбеке — бегущий кадр); текущая рисуется поверх наведённой
    const cellRect = function (i) {
        return [(i % info.cols) * info.frameWidth * zoom + 1, Math.floor(i / info.cols) * info.frameHeight * zoom + 1,
            info.frameWidth * zoom - 2, info.frameHeight * zoom - 2];
    };
    const ft = AFX.Atlas.frameTimes(AFX.state.doc);
    const fCur = AFX.Atlas.frameAt(ft, AFX.state.time);
    viewCtx.lineWidth = 2;
    if (atlasHover >= 0 && atlasHover < info.frames && atlasHover !== fCur) {
        viewCtx.strokeStyle = 'rgba(253,207,130,0.85)';
        viewCtx.strokeRect.apply(viewCtx, cellRect(atlasHover));
    }
    if (fCur < info.frames) {
        viewCtx.strokeStyle = 'rgba(33,252,254,0.9)';
        viewCtx.strokeRect.apply(viewCtx, cellRect(fCur));
    }
    viewCtx.restore();

    infoParts.textContent = L('atlas') + ' ' + a.width + 'x' + a.height;
    hud.textContent = L('frames') + ': ' + info.frames + '   ' + L('cell') + ': ' + info.frameWidth + 'x' + info.frameHeight + '   ' + L('footage fps') + ': ' + info.fps
        + (atlasHover >= 0 && atlasHover < ft.frames
            ? '   ' + L('Frame') + ' ' + (atlasHover + 1) + ' @ ' + AFX.fmtTime(ft.times[atlasHover]) + L('s') : '');
}

// ---------- ячейки листа как элементы управления ----------
// Лист на вкладке atlas интерактивен: наведение подсвечивает рамку ячейки, клик
// ставит время на её кадр (то есть выделяет кадр и на таймлайне, и в плеебле).
// Ячейка ищется в тех же координатах, в которых лист и рисуется: (m - pan) / zoom.
function atlasCellAt(mx, my) {
    if (AFX.state.tab !== 'atlas' || !atlasResult) return -1;
    const info = atlasResult.info;
    const cx = (mx - panX) / zoom, cy = (my - panY) / zoom;
    if (cx < 0 || cy < 0) return -1;
    const col = Math.floor(cx / info.frameWidth), row = Math.floor(cy / info.frameHeight);
    if (col < 0 || col >= info.cols || row < 0 || row >= info.rows) return -1;
    const i = row * info.cols + col;
    return i < info.frames ? i : -1;
}
function setAtlasHover(i) {
    if (atlasHover === i) return;
    atlasHover = i;
    viewCanvas.style.cursor = i >= 0 ? 'pointer' : '';
    needsRedraw = true;
}
// клик по ячейке = «показать этот кадр»: плейхед уезжает в его сэмпл, а значит
// подсвечиваются и ячейка, и кадр на линейке таймлайна
function selectAtlasCell(i) {
    const ft = AFX.Atlas.frameTimes(AFX.state.doc);
    if (i < 0 || i >= ft.frames) return false;
    AFX.setPlaying(false);
    AFX.setTime(ft.times[i]);
    return true;
}

// ---------- плеебл-вьюпорт: панель ----------
function buildAtlasPlay() {
    apWrap = document.getElementById('atlas-play');
    apSplit = document.getElementById('ap-split');
    if (!apWrap) return;
    apZoomEl = h('span', { cls: 'ap-zoom', text: '100%' });
    const bFit = h('button', { cls: 'mini-btn', text: L('Fit'), tip: L('Fit the frame to the panel (double-click the frame)') });
    bFit.addEventListener('click', function () { apFitMode = true; needsRedraw = true; });
    apWrap.appendChild(h('div', { cls: 'ap-title' }, h('span', { text: L('Playback') }),
        h('span', { cls: 'ap-zoom' }, bFit, apZoomEl)));
    apStage = h('div', { cls: 'ap-stage', tip: L('Wheel — zoom, drag — pan, double-click — fit') });
    apCanvas = h('canvas');
    apCtx = apCanvas.getContext('2d');
    apStage.appendChild(apCanvas);
    apWrap.appendChild(apStage);
    bindAtlasPlayView();

    const ctl = h('div', { cls: 'ap-ctl' });
    const bPrev = h('button', { cls: 'tr-btn', tip: L('Step to the previous atlas frame (playback pauses)') }, D.icon('stepBack'));
    bPrev.addEventListener('click', function () { stepAtlasFrame(-1); });
    apPlayBtn = h('button', { cls: 'tr-btn', tip: L('Play only the atlas frames at the panel fps, the way the game will (Space)') }, D.icon('play'));
    apPlayBtn.addEventListener('click', function () { AFX.setPlaying(!AFX.state.playing); });
    const bNext = h('button', { cls: 'tr-btn', tip: L('Step to the next atlas frame (playback pauses)') }, D.icon('stepFwd'));
    bNext.addEventListener('click', function () { stepAtlasFrame(1); });
    apFrameEl = h('div', { cls: 'ap-frame' });

    // темп плейбека: пусто/0 — собственный fps атласа (кадры / длительность диапазона),
    // иначе явно заданный. Это настройка ВЬЮПОРТА, в документ она не пишется.
    apFpsInp = h('input', {
        cls: 'ap-fps auto', type: 'text', inputmode: 'decimal', spellcheck: 'false',
        tip: L('Playback rate; empty — the atlas own fps (frames / range)')
    });
    const readFps = function (commit) {
        const s = String(apFpsInp.value).replace(',', '.').trim();
        const v = parseFloat(s);
        apFps = (!s || !isFinite(v) || v <= 0) ? 0 : AFX.clamp(v, 0.1, 120);
        apAcc = 0;
        apFpsInp.classList.toggle('auto', !apFps);
        needsRedraw = true;
        // пустое поле = авто: по уходу из поля показываем собственный fps атласа
        if (commit) showApFps(AFX.Atlas.frameTimes(AFX.state.doc).fps);
    };
    apFpsInp.addEventListener('input', function () { readFps(false); });
    apFpsInp.addEventListener('blur', function () { readFps(true); });
    apFpsInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') apFpsInp.blur(); });

    ctl.appendChild(bPrev);
    ctl.appendChild(apPlayBtn);
    ctl.appendChild(bNext);
    ctl.appendChild(apFrameEl);
    ctl.appendChild(apFpsInp);
    ctl.appendChild(h('span', { cls: 'ap-unit', text: 'fps' }));
    apWrap.appendChild(ctl);
    apInfoEl = h('div', { cls: 'ap-info' });
    apWrap.appendChild(apInfoEl);

    AFX.on('play', function () {
        apPlayBtn.innerHTML = '';
        apPlayBtn.appendChild(D.icon(AFX.state.playing ? 'pause' : 'play'));
        apAcc = 0;
    });
    syncAtlasPlay();
}

// вьюпорт панели живёт по тем же правилам, что и превью: колесо — зум к курсору,
// драг (ЛКМ и СКМ) — пан, дабл-клик — вписать
function bindAtlasPlayView() {
    apCanvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        const m = apBack(e);
        const nz = AFX.clamp(apZoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.05, 32);
        apPanX = m[0] - (m[0] - apPanX) * (nz / apZoom);
        apPanY = m[1] - (m[1] - apPanY) * (nz / apZoom);
        apZoom = nz;
        apFitMode = false;
        needsRedraw = true;
    }, { passive: false });
    let sx = 0, sy = 0;
    const panStart = function () { sx = apPanX; sy = apPanY; };
    const panMove = function (e, dx, dy) {
        const kf = apCanvas.width / Math.max(1, apCanvas.getBoundingClientRect().width);
        apPanX = sx + dx * kf;
        apPanY = sy + dy * kf;
        apFitMode = false;
        needsRedraw = true;
    };
    D.drag(apCanvas, { button: 0, start: panStart, move: panMove });
    D.drag(apCanvas, { button: 1, start: panStart, move: panMove });
    // иначе Chrome включит свой autoscroll по средней кнопке
    apCanvas.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); });
    apCanvas.addEventListener('dblclick', function () { apFitMode = true; needsRedraw = true; });
}

// клиентские координаты -> пиксели бэкинга канвы панели
function apBack(e) {
    const r = apCanvas.getBoundingClientRect();
    const kf = apCanvas.width / Math.max(1, r.width);
    return [(e.clientX - r.left) * kf, (e.clientY - r.top) * kf];
}

// панель и её сплиттер живут только на вкладке атласа; ширина вьюпорта при этом меняется
function syncAtlasPlay() {
    if (!apWrap) return;
    const on = AFX.state.tab === 'atlas';
    apWrap.classList.toggle('hidden', !on);
    if (apSplit) apSplit.classList.toggle('hidden', !on);
}

function stepAtlasFrame(dir) {
    const ft = AFX.Atlas.frameTimes(AFX.state.doc);
    const f = AFX.clamp(AFX.Atlas.frameAt(ft, AFX.state.time) + dir, 0, ft.frames - 1);
    AFX.setPlaying(false);
    AFX.setTime(ft.times[f]);
}

// темп плейбека: явный из поля либо собственный fps атласа
function apRate(ft) {
    if (apFps > 0) return apFps;
    return ft.fps > 0 ? ft.fps : (AFX.state.doc.comp.fps || 30);
}
function showApFps(auto) {
    if (!apFpsInp || document.activeElement === apFpsInp) return;
    apFpsInp.value = String(Math.round((apFps || auto) * 100) / 100);
}

// плейбек ТОЛЬКО по кадрам листа: время композиции ставится в центр кадра, поэтому
// плейхед идёт по голубым маркерам таймлайна, а лист не пересобирается (он от
// времени не зависит) — кадры уже посчитаны, показ стоит одного drawImage.
function playAtlasFrames(dt) {
    const ft = AFX.Atlas.frameTimes(AFX.state.doc);
    apAcc += dt * apRate(ft);
    if (apAcc < 1) return;
    const adv = Math.floor(apAcc);
    apAcc -= adv;
    let f = AFX.Atlas.frameAt(ft, AFX.state.time) + adv;
    if (f >= ft.frames) {
        if (AFX.state.loop) f = f % ft.frames;
        else { f = ft.frames - 1; AFX.setPlaying(false); }
    }
    AFX.state.time = ft.times[f];
    AFX.emit('time');
    needsRedraw = true;
}

// Кадр берётся ИЗ ГОТОВОГО ЛИСТА (atlasResult): ячейки уже отрисованы сборкой атласа,
// плейбек не пересчитывает симуляцию и не теряет на этом fps — один drawImage на кадр.
function drawAtlasPlay() {
    if (!apWrap || AFX.state.tab !== 'atlas') return;
    const doc = AFX.state.doc;
    const dpr = window.devicePixelRatio || 1;
    const r = apStage.getBoundingClientRect();
    const bw = Math.max(2, Math.round(r.width * dpr)), bh = Math.max(2, Math.round(r.height * dpr));
    if (apCanvas.width !== bw || apCanvas.height !== bh) {
        apCanvas.width = bw; apCanvas.height = bh;
        apChecker = null;   // паттерн привязан к контексту
    }
    apCtx.setTransform(1, 0, 0, 1, 0, 0);
    apCtx.fillStyle = '#151310';
    apCtx.fillRect(0, 0, bw, bh);

    const a = atlasResult;
    const ft = AFX.Atlas.frameTimes(doc);
    const f = Math.min(AFX.Atlas.frameAt(ft, AFX.state.time), ft.frames - 1);
    showApFps(ft.fps);
    if (!a) { apInfoEl.textContent = ''; return; }

    const fw = a.info.frameWidth, fh = a.info.frameHeight;
    if (apFitMode) {
        apZoom = Math.min(bw / fw, bh / fh) * 0.92;
        apPanX = (bw - fw * apZoom) / 2;
        apPanY = (bh - fh * apZoom) / 2;
    }
    const dw = fw * apZoom, dh = fh * apZoom;
    if (!apChecker) apChecker = apCtx.createPattern(checkerTileC(), 'repeat');

    apCtx.save();
    apCtx.translate(apPanX, apPanY);
    if (a.info.mode === 'rgba') fillBg(apCtx, dw, dh, apChecker);
    apCtx.imageSmoothingEnabled = apZoom < 1.01;
    apCtx.imageSmoothingQuality = 'high';
    const cell = Math.min(f, a.info.frames - 1);
    apCtx.drawImage(a.canvas, (cell % a.info.cols) * fw, Math.floor(cell / a.info.cols) * fh, fw, fh, 0, 0, dw, dh);
    apCtx.strokeStyle = 'rgba(89,227,226,0.35)';
    apCtx.lineWidth = 1;
    apCtx.strokeRect(0.5, 0.5, dw - 1, dh - 1);
    apCtx.restore();

    apZoomEl.textContent = Math.round(apZoom / dpr * 100) + '%';
    apFrameEl.innerHTML = '';
    apFrameEl.appendChild(document.createTextNode(L('Frame') + ' ' + (f + 1)));
    apFrameEl.appendChild(h('span', { text: ' / ' + ft.frames }));
    apInfoEl.textContent = fw + '×' + fh + '   ·   ' + L('atlas') + ' '
        + (Math.round(ft.fps * 100) / 100) + ' fps   ·   ' + AFX.fmtTime(ft.times[f]) + L('s');
}

P.getAtlas = function () {
    if (atlasDirty || !atlasResult) {
        atlasResult = AFX.Atlas.build(AFX.state.doc);
        atlasDirty = false;
    }
    return atlasResult;
};
P.invalidate = function () { needsRedraw = true; };
// синхронный рендер кадра — для автоматизации/тестов: rAF в скрытой вкладке не тикает.
// t задан — плейбек стопается и время выставляется; вкладка atlas пересоберёт атлас.
P.renderNow = function (t) {
    if (t != null) { AFX.setPlaying(false); AFX.setTime(t); }
    needsRedraw = false;
    draw();
    return { tab: AFX.state.tab, time: AFX.state.time, particles: AFX.previewEngine.lastCount };
};
// для автотестов: состояние вида + хит-тест гизмо по КЛИЕНТСКИМ координатам
P._dbg = function () {
    const ft = AFX.Atlas.frameTimes(AFX.state.doc);
    return {
        zoom: zoom, panX: panX, panY: panY, gizmosOn: gizmosOn,
        forcesOn: forcesOn, atlasHover: atlasHover,
        atlasCellAt: function (cx, cy) {
            const r = viewCanvas.getBoundingClientRect();
            const kf = viewCanvas.width / Math.max(1, r.width);
            return atlasCellAt((cx - r.left) * kf, (cy - r.top) * kf);
        },
        atlasPlay: {
            open: !!(apWrap && !apWrap.classList.contains('hidden')),
            frame: AFX.Atlas.frameAt(ft, AFX.state.time),
            frames: ft.frames, fps: ft.fps, rate: apRate(ft), fpsOverride: apFps,
            bounds: ft.bounds, times: ft.times,
            zoom: apZoom, fit: apFitMode,
            cell: atlasResult ? [atlasResult.info.frameWidth, atlasResult.info.frameHeight] : null,
            // плейбек живёт на rAF, а в скрытой вкладке rAF не тикает — для тестов
            // прокручиваем кадры синхронно, ровно тем же шагом, что и цикл
            step: function (dt) { playAtlasFrames(dt); return AFX.Atlas.frameAt(AFX.Atlas.frameTimes(AFX.state.doc), AFX.state.time); }
        },
        forces: function () {
            const f = forceInfo();
            return f ? { nodes: f.pts.length / 5, max: f.max, tags: f.tags, note: f.note, hint: f.hint } : null;
        },
        hitAt: function (cx, cy) {
            const r = viewCanvas.getBoundingClientRect();
            const kf = viewCanvas.width / Math.max(1, r.width);
            return hitGizmo((cx - r.left) * kf, (cy - r.top) * kf);
        }
    };
};
})();
