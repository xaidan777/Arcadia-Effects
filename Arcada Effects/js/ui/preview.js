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
let lastFrameT = 0, fpsSmooth = 0;
let zoomLabel = null, infoParts = null, infoFps = null;
let gizmosOn = true;
let pathBake = null;   // буфер запечённого пути гизмо (свой, не шарить с симуляцией)

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
// центр РАДИАЛЬНОГО смаза (у directional центра нет, крест не показываем)
function centerOwner(layer) {
    if (layer.type === 'emitter') return layer.em;
    if (layer.type === 'postfx') return (layer.fx && layer.fx.effect === 'mblur' && layer.fx.mode === 'radial') ? layer.fx : null;
    return layer.sp || null;
}

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

P.init = function () {
    viewCanvas = document.getElementById('view-canvas');
    viewCtx = viewCanvas.getContext('2d');
    hud = document.getElementById('preview-hud');
    compCanvas = document.createElement('canvas');
    compCtx = compCanvas.getContext('2d');

    buildToolbar();
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
            }
            AFX.touch(layer.id);
            needsRedraw = true;
        },
        end: function (e, moved) {
            if (dragMode !== 'pan' && moved) AFX.commitEnd();
            dragMode = null;
        }
    });
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
    AFX.on('doc', function () { needsRedraw = true; atlasDirty = true; P.fit(); });
    AFX.on('time', function () { needsRedraw = true; });
    AFX.on('select', function () { needsRedraw = true; });
    AFX.on('atlas', function () { atlasDirty = true; needsRedraw = true; });
    AFX.on('tab', function () { needsRedraw = true; P.fit(); });

    resize();
    requestAnimationFrame(loop);
};

function buildToolbar() {
    const bar = document.getElementById('preview-toolbar');
    const tabPrev = h('button', { cls: 'tab-btn on', text: L('Preview') });
    const tabAtlas = h('button', { cls: 'tab-btn', text: L('Atlas') });
    tabPrev.addEventListener('click', function () { AFX.setTab('preview'); });
    tabAtlas.addEventListener('click', function () { AFX.setTab('atlas'); });
    AFX.on('tab', function () {
        tabPrev.classList.toggle('on', AFX.state.tab === 'preview');
        tabAtlas.classList.toggle('on', AFX.state.tab === 'atlas');
    });
    bar.appendChild(tabPrev);
    bar.appendChild(tabAtlas);
    bar.appendChild(h('span', { cls: 'pt-sep' }));

    const bFit = h('button', { cls: 'mini-btn', text: L('Fit'), title: L('Fit to window (double-click the preview)') });
    bFit.addEventListener('click', function () { P.fit(); });
    const b100 = h('button', { cls: 'mini-btn', text: '100%' });
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

    const bgSel = h('select', { cls: 'w-select', style: 'flex:none;width:110px;' });
    [['checker', L('Checker')], ['dark', L('Dark bg')], ['black', L('Black bg')], ['light', L('Light bg')]].forEach(o =>
        bgSel.appendChild(h('option', { value: o[0], text: o[1] })));
    bgSel.value = bg;
    bgSel.addEventListener('change', function () { bg = bgSel.value; needsRedraw = true; bgSel.blur(); });
    bar.appendChild(bgSel);

    const bGiz = h('button', { cls: 'mini-btn on', text: L('Gizmos'), title: L('Show position, fade and path controllers (drag moves them, Alt+click on the path adds a node)') });
    bGiz.addEventListener('click', function () {
        gizmosOn = !gizmosOn;
        AFX.emit('gizmos');
        needsRedraw = true;
    });
    AFX.on('gizmos', function () { bGiz.classList.toggle('on', gizmosOn); });
    bar.appendChild(bGiz);

    const info = h('span', { cls: 'pt-info' });
    infoParts = h('span', { text: '' });
    infoFps = h('span', { text: '' });
    info.appendChild(infoParts);
    info.appendChild(infoFps);
    bar.appendChild(info);
}

function makeChecker() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const x = c.getContext('2d');
    x.fillStyle = '#232323'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#2e2e2e'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
    checkerPat = viewCtx.createPattern(c, 'repeat');
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

    // плейбек
    if (AFX.state.playing) {
        const dt = Math.min(0.1, (ts - lastFrameT) / 1000 || 0);
        let t = AFX.state.time + dt;
        if (t >= doc.comp.dur) {
            if (AFX.state.loop) t = t % doc.comp.dur;
            else { t = doc.comp.dur; AFX.setPlaying(false); }
        }
        AFX.state.time = t;
        AFX.emit('time');
        needsRedraw = true;
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
    viewCtx.imageSmoothingEnabled = true;
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
    viewCtx.restore();

    infoParts.textContent = L('atlas') + ' ' + a.width + 'x' + a.height;
    hud.textContent = L('frames') + ': ' + info.frames + '   ' + L('cell') + ': ' + info.frameWidth + 'x' + info.frameHeight + '   ' + L('footage fps') + ': ' + info.fps;
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
    return {
        zoom: zoom, panX: panX, panY: panY, gizmosOn: gizmosOn,
        hitAt: function (cx, cy) {
            const r = viewCanvas.getBoundingClientRect();
            const kf = viewCanvas.width / Math.max(1, r.width);
            return hitGizmo((cx - r.left) * kf, (cy - r.top) * kf);
        }
    };
};
})();
