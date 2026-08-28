// Arcaidia Effector — таймлайн: транспорт, управление слоями, dope sheet, графовый редактор
// Здесь же живёт весь менеджмент слоёв (видимость, соло, порядок, добавление, удаление).
(function () {
'use strict';
const AFX = window.AFX;
const D = AFX.Dom, h = D.h, T = AFX.Track, L = AFX.t;

const TL = AFX.Timeline = {};
let rootEl, scrollEl, contentEl, rulerDiv, rulerCanvas, playheadEl, timeLabel;
let ppsVal = 300;           // пикселей на секунду
let timeMin = 0;            // левая граница шкалы (отрицательная при пре-ролле)
let graphCanvas = null;
let mode = 'dope';          // dope | graph
let rebuildQueued = false;
let pendingRebuild = false;
let interacting = false;    // идёт драг внутри таймлайна: ребилды откладываем
let btnPlayIcon = null;
let graphView = null;       // замороженный диапазон значений при драге
let keyElMap = new Map();   // key -> DOM (живое обновление при мультидраге)
let barPlaceMap = new Map();// layerId -> fn перестановки бара
let graphPan = 0;           // сдвиг оси значений графика (ед. свойства): пан средней кнопкой
let graphPanKey = '';       // цель, к которой относится сдвиг (смена цели — автофит заново)
let hintsEl = null;         // полупрозрачная шпаргалка по хоткеям

const NAMES_W = 210;
const TYPE_BADGE = { emitter: 'E', sprite: 'S', atlas: 'A', postfx: 'F' };

const PROP_LABELS = {
    'opacity': 'Opacity',
    'glowL': 'Layer glow',
    'fadeX': 'Fade X', 'fadeY': 'Fade Y', 'fadeR': 'Fade radius',
    'em.x': 'Emitter X', 'em.y': 'Emitter Y',
    'em.sx': 'Size X', 'em.sy': 'Size Y',
    'em.angle': 'Angle', 'em.spread': 'Spread',
    'em.speed': 'Speed', 'em.rate': 'Rate',
    'pt.size': 'Particle size',
    'pt.gravX': 'Gravity X', 'pt.gravY': 'Gravity Y',
    'pt.turbAmp': 'Turbulence',
    'em.path.jitter': 'Path jitter', 'em.path.attract': 'Path attract',
    'em.path.lock': 'Path lock', 'em.path.flow': 'Path flow',
    'em.sub.rate': 'Sub rate', 'em.sub.speed': 'Sub speed',
    'em.sub.pt.size': 'Sub particle size',
    'em.sub.pt.gravX': 'Sub gravity X', 'em.sub.pt.gravY': 'Sub gravity Y',
    'em.sub.pt.turbAmp': 'Sub turbulence',
    'sp.x': 'Position X', 'sp.y': 'Position Y',
    'sp.scale': 'Scale', 'sp.rot': 'Rotation',
    'sp.glow': 'Glow', 'sp.color': 'Color',
    'fx.length': 'Blur length', 'fx.angle': 'Blur angle', 'fx.spin': 'Spin',
    'fx.x': 'Center X', 'fx.y': 'Center Y',
    'fx.amount': 'Displace amount', 'fx.y0': 'Calm line Y'
};
const PROP_PATHS = {
    emitter: ['opacity', 'glowL', 'fadeX', 'fadeY', 'fadeR', 'em.x', 'em.y', 'em.sx', 'em.sy', 'em.angle', 'em.spread', 'em.speed', 'em.rate', 'pt.size', 'pt.gravX', 'pt.gravY', 'pt.turbAmp',
        'em.sub.rate', 'em.sub.speed', 'em.sub.pt.size', 'em.sub.pt.gravX', 'em.sub.pt.gravY', 'em.sub.pt.turbAmp'],
    sprite: ['opacity', 'glowL', 'fadeX', 'fadeY', 'fadeR', 'sp.x', 'sp.y', 'sp.scale', 'sp.rot', 'sp.glow', 'sp.color'],
    atlas: ['opacity', 'glowL', 'fadeX', 'fadeY', 'fadeR', 'sp.x', 'sp.y', 'sp.scale', 'sp.rot'],
    // у постэффекта opacity — СИЛА эффекта; blend/свечение/затухание для него мертвы
    postfx: ['opacity', 'fx.length', 'fx.angle', 'fx.spin', 'fx.x', 'fx.y', 'fx.amount', 'fx.y0']
};
const CURVE_DEFS = [
    { key: 'sizeOL', label: 'Size over life', yMax: 1.6 },
    { key: 'sizeOT', label: 'Size over trail', yMax: 1.6, trailOnly: true, tip: 'Width along the trail: 0 — start (base), 1 — tip' },
    { key: 'opacityOL', label: 'Opacity over life', yMax: 1.15 }
];
// sizeOT имеет смысл только у трейл-рендера
function curveDefsFor(layer) {
    return CURVE_DEFS.filter(cd => !cd.trailOnly || (layer.pt && layer.pt.render === 'trail'));
}

// путь любой глубины: 'opacity', 'em.rate', 'em.sub.pt.size', 'em.path.nodes.0.x'
function resolve(layer, path) {
    const parts = path.split('.');
    let obj = layer;
    for (let i = 0; i < parts.length - 1 && obj; i++) obj = obj[parts[i]];
    return { obj: obj, key: parts[parts.length - 1] };
}
// свойства ПУТИ ДВИЖЕНИЯ динамические: число узлов задаёт пользователь
function pathPropPaths(layer) {
    const pa = layer.em && layer.em.path;
    if (!pa) return [];
    const res = ['em.path.jitter', 'em.path.attract', 'em.path.lock', 'em.path.flow'];
    (pa.nodes || []).forEach((nd, i) => {
        res.push('em.path.nodes.' + i + '.x');
        res.push('em.path.nodes.' + i + '.y');
    });
    return res;
}
function propLabel(path, layer) {
    const m = /^em\.path\.nodes\.(\d+)\.([xy])$/.exec(path);
    if (m) return L('Path node') + ' ' + (+m[1] + 1) + ' ' + m[2].toUpperCase();
    // у постэффекта opacity — сила эффекта, а не прозрачность (слой ничего не рисует)
    if (layer && layer.type === 'postfx' && path === 'opacity') return L('Effect strength');
    return L(PROP_LABELS[path] || path);
}
TL.animTracks = function (layer) {
    const res = [];
    const paths = (PROP_PATHS[layer.type] || []).concat(layer.type === 'emitter' ? pathPropPaths(layer) : []);
    paths.forEach(path => {
        const r = resolve(layer, path);
        if (r.obj && T.isAnim(r.obj[r.key])) res.push({ path: path, label: propLabel(path, layer), obj: r.obj, key: r.key, tr: r.obj[r.key] });
    });
    return res;
};

const fpsOf = () => AFX.state.doc.comp.fps || 60;
const snapTime = t => Math.round(t * fpsOf()) / fpsOf();
const snapKey = t => Math.max(0, snapTime(t));
const xOf = t => (t - timeMin) * ppsVal;
const tOf = x => x / ppsVal + timeMin;

TL.init = function () {
    rootEl = document.getElementById('timeline');
    buildHead();
    scrollEl = h('div', { id: 'tl-scroll' });
    contentEl = h('div', { id: 'tl-content' });
    scrollEl.appendChild(contentEl);
    rootEl.appendChild(scrollEl);
    buildHints();

    scrollEl.addEventListener('wheel', function (e) {
        if (!e.ctrlKey && !e.altKey) return;
        e.preventDefault();
        const r = scrollEl.getBoundingClientRect();
        const mx = e.clientX - r.left + scrollEl.scrollLeft;
        const tAt = tOf(mx - NAMES_W);
        ppsVal = AFX.clamp(ppsVal * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 40, 3000);
        TL.rebuild();
        scrollEl.scrollLeft = NAMES_W + xOf(tAt) - (e.clientX - r.left);
    }, { passive: false });

    // средняя кнопка = пан листа (X — время, Y — прокрутка строк). В режиме графика
    // событие перехватывает канвас (там Y двигает ось значений) и сюда не доходит.
    // mousedown гасим сами: иначе Chrome включит свой autoscroll на скроллящемся контейнере.
    rootEl.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); });
    let panSx = 0, panSy = 0;
    D.drag(scrollEl, {
        button: 1,
        start: function () {
            panSx = scrollEl.scrollLeft; panSy = scrollEl.scrollTop;
            beginInteract(); setPanning(true);
        },
        move: function (e, dx, dy) {
            scrollEl.scrollLeft = panSx - dx;
            scrollEl.scrollTop = panSy - dy;
        },
        end: function () { setPanning(false); endInteract(); }
    });

    // приём текстуры из панели текстур: слой стартует в точке броска
    scrollEl.addEventListener('dragover', function (e) {
        if (Array.from(e.dataTransfer.types).includes('text/afx-tex')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    });
    scrollEl.addEventListener('drop', function (e) {
        const texId = e.dataTransfer.getData('text/afx-tex');
        if (!texId) return;
        e.preventDefault();
        e.stopPropagation();
        const r = contentEl.getBoundingClientRect();
        const t = snapTime(tOf(e.clientX - r.left - NAMES_W));
        AFX.Ops.addTextureLayer(texId, { start: AFX.clamp(t, timeMin - 2, AFX.state.doc.comp.dur) });
    });

    AFX.on('doc', function () { fitZoom(); queueRebuild(); });
    AFX.on('layers', queueRebuild);
    AFX.on('select', queueRebuild);
    AFX.on('layer', queueRebuild);
    AFX.on('comp', queueRebuild);
    AFX.on('resize', queueRebuild);
    AFX.on('time', updateTimeUI);
    AFX.on('play', function () {
        btnPlayIcon.innerHTML = '';
        btnPlayIcon.appendChild(D.icon(AFX.state.playing ? 'pause' : 'play'));
    });
    window.addEventListener('resize', queueRebuild);

    fitZoom();
    TL.rebuild();
};

function fitZoom() {
    const w = rootEl.getBoundingClientRect().width - NAMES_W - 60;
    if (w > 100) ppsVal = AFX.clamp(w / Math.max(0.2, AFX.state.doc.comp.dur), 40, 3000);
}

function queueRebuild() {
    if (interacting) { pendingRebuild = true; return; }
    if (rebuildQueued) return;
    rebuildQueued = true;
    requestAnimationFrame(function () {
        rebuildQueued = false;
        if (interacting) { pendingRebuild = true; return; }
        TL.rebuild();
    });
}
function setPanning(on) { rootEl.classList.toggle('panning', on); }

function beginInteract() { interacting = true; }
function endInteract() {
    interacting = false;
    if (pendingRebuild) { pendingRebuild = false; TL.rebuild(); }
}

// ---------- шапка ----------
function buildHead() {
    const head = h('div', { id: 'tl-head' });
    const btn = function (icon, title, cb) {
        const b = h('button', { cls: 'tr-btn', title: title }, D.icon(icon));
        b.addEventListener('click', cb);
        return b;
    };
    head.appendChild(btn('toStart', L('To start (Home)'), function () { AFX.setTime(0); }));
    head.appendChild(btn('stepBack', L('Frame back (Left arrow)'), function () { AFX.stepFrame(-1); }));
    const bPlay = h('button', { cls: 'tr-btn', title: L('Play / pause (Space)') });
    btnPlayIcon = bPlay;
    bPlay.appendChild(D.icon('play'));
    bPlay.addEventListener('click', function () { AFX.setPlaying(!AFX.state.playing); });
    head.appendChild(bPlay);
    head.appendChild(btn('stop', L('Stop (to start)'), function () { AFX.setPlaying(false); AFX.setTime(0); }));
    head.appendChild(btn('stepFwd', L('Frame forward (Right arrow)'), function () { AFX.stepFrame(1); }));
    head.appendChild(btn('toEnd', L('To end (End)'), function () { AFX.setTime(AFX.state.doc.comp.dur); }));
    const bLoop = h('button', { cls: 'tr-btn on', title: L('Loop') }, D.icon('loop'));
    bLoop.addEventListener('click', function () {
        AFX.state.loop = !AFX.state.loop;
        bLoop.classList.toggle('on', AFX.state.loop);
    });
    head.appendChild(bLoop);

    timeLabel = h('div', { cls: 'tl-time' });
    head.appendChild(timeLabel);

    // добавление слоёв
    const addEm = h('button', { cls: 'mini-btn', title: L('New particle emitter') }, D.icon('plus'), L('Emitter'));
    addEm.addEventListener('click', function () { AFX.Ops.addLayer(AFX.Model.newEmitter(AFX.state.doc)); });
    const addSp = h('button', { cls: 'mini-btn', title: L('New sprite layer') }, D.icon('plus'), L('Sprite'));
    addSp.addEventListener('click', function () { AFX.Ops.addLayer(AFX.Model.newSprite(AFX.state.doc)); });
    const addAt = h('button', { cls: 'mini-btn', title: L('New sprite atlas layer (sheet frames, no preset animation)') }, D.icon('plus'), L('Atlas'));
    addAt.addEventListener('click', function () {
        // всегда через диалог: источник (файл/drop/лист проекта) + сетка, приём создаёт слой
        AFX.TexturesPanel.openAtlasPicker({ accept: function (id) { AFX.Ops.addAtlasLayer(id); } });
    });
    const addFx = h('button', { cls: 'mini-btn', title: L('New post-effect layer (processes everything below it)') }, D.icon('plus'), L('Post FX'));
    addFx.addEventListener('click', function () { AFX.Ops.addLayer(AFX.Model.newPostFx(AFX.state.doc)); });
    const addPre = h('button', { cls: 'mini-btn', title: L('Layer from preset') }, L('Presets'));
    addPre.addEventListener('click', function () {
        const r = addPre.getBoundingClientRect();
        D.ctxMenu(r.left, r.top - 6 - AFX.Model.layerPresets.length * 26, AFX.Model.layerPresets.map(p => ({
            label: L(p.label),
            click: function () { AFX.Ops.addLayer(p.make(AFX.state.doc)); }
        })));
    });
    head.appendChild(h('span', { style: 'width:8px;' }));
    head.appendChild(addEm);
    head.appendChild(addSp);
    head.appendChild(addAt);
    head.appendChild(addFx);
    head.appendChild(addPre);

    const modeBtns = h('div', { cls: 'tl-mode-btns' });
    const bDope = h('button', { cls: 'tr-btn on', title: L('Dope sheet: keys and bars. Right-click a key for easing. Shift+click for multi-select.') }, D.icon('dope'));
    const bGraph = h('button', { cls: 'tr-btn', title: L('Animation graphs and over-life curves') }, D.icon('graph'));
    bDope.addEventListener('click', function () { setMode('dope'); });
    bGraph.addEventListener('click', function () { setMode('graph'); });
    AFX.on('tlmode', function () {
        bDope.classList.toggle('on', mode === 'dope');
        bGraph.classList.toggle('on', mode === 'graph');
    });
    modeBtns.appendChild(bDope);
    modeBtns.appendChild(bGraph);
    head.appendChild(modeBtns);
    rootEl.appendChild(head);
    updateTimeUI();
}

// ---------- шпаргалка по хоткеям ----------
// полупрозрачный оверлей в углу листа; состав зависит от режима (dope / график)
const HINTS = {
    dope: [['Space', 'play'], ['U', 'parameters'], ['Del', 'delete'], ['Shift+click', 'multi-select'],
        ['RMB key', 'easing'], ['Ctrl+wheel', 'zoom'], ['MMB drag', 'pan']],
    graph: [['MMB drag', 'pan'], ['MMB click', 'reset view'], ['Dbl-click', 'add / remove point'],
        ['Shift+drag', 'no snap'], ['Ctrl+wheel', 'zoom']]
};
function buildHints() {
    hintsEl = h('div', { id: 'tl-hints' });
    rootEl.appendChild(hintsEl);
    AFX.on('tlmode', updateHints);
    updateHints();
}
function updateHints() {
    if (!hintsEl) return;
    hintsEl.innerHTML = '';
    (HINTS[mode] || []).forEach(hk => {
        hintsEl.appendChild(h('span', { cls: 'hk' }, h('b', { text: L(hk[0]) }), h('i', { text: L(hk[1]) })));
    });
}

function setMode(m) {
    mode = m;
    if (m === 'graph' && !AFX.state.graphSel) {
        const layer = AFX.layerById(AFX.state.sel);
        if (layer) {
            const tracks = TL.animTracks(layer).filter(t => t.path !== 'sp.color');
            if (tracks.length) AFX.state.graphSel = { layerId: layer.id, path: tracks[0].path };
            else if (layer.type === 'emitter') AFX.state.graphSel = { layerId: layer.id, curve: 'sizeOL' };
        }
    }
    AFX.emit('tlmode');
    TL.rebuild();
}
TL.openGraph = function (graphSel) {
    AFX.state.graphSel = graphSel;
    setMode('graph');
};

function updateTimeUI() {
    if (!timeLabel) return;
    const doc = AFX.state.doc;
    const fr = Math.round(AFX.state.time * fpsOf());
    timeLabel.innerHTML = '';
    timeLabel.appendChild(document.createTextNode(AFX.fmtTime(AFX.state.time)));
    timeLabel.appendChild(h('span', { text: ' / ' + AFX.fmtTime(doc.comp.dur) + '  ' + L('f') + fr }));
    if (playheadEl) playheadEl.style.left = (NAMES_W + xOf(AFX.state.time)) + 'px';
    if (rulerCanvas) drawRuler();
    if (mode === 'graph' && graphCanvas) drawGraph();
}

// ---------- контент ----------
TL.rebuild = function () {
    if (!contentEl) return;
    const doc = AFX.state.doc;
    // левая граница шкалы: минимальный старт слоёв (пре-ролл), с шагом 0.25с
    const minStart = Math.min(0, ...doc.layers.map(l => l.start || 0));
    timeMin = Math.floor(minStart * 4) / 4;
    const timeW = Math.max((doc.comp.dur - timeMin) * ppsVal + 140, scrollEl.clientWidth - NAMES_W);
    contentEl.style.width = (NAMES_W + timeW) + 'px';
    contentEl.innerHTML = '';
    keyElMap = new Map();
    barPlaceMap = new Map();

    // линейка
    const rulerRow = h('div', { id: 'tl-ruler-row' });
    rulerRow.appendChild(h('div', { id: 'tl-corner', text: mode === 'dope' ? L('Layers') : L('Graph') }));
    rulerDiv = h('div', { id: 'tl-ruler' });
    rulerCanvas = h('canvas');
    rulerCanvas.width = timeW;
    rulerCanvas.height = 24;
    rulerDiv.appendChild(rulerCanvas);
    rulerRow.appendChild(rulerDiv);
    contentEl.appendChild(rulerRow);

    D.drag(rulerDiv, {
        start: function (e) { scrub(e); },
        move: function (e) { scrub(e); }
    });
    rulerDiv.addEventListener('pointerdown', function (e) { if (e.button === 0) scrub(e); });

    if (mode === 'dope') buildDope(doc, timeW);
    else buildGraph(doc, timeW);

    // зона пре-ролла (t < 0)
    if (timeMin < 0) {
        contentEl.appendChild(h('div', {
            cls: 'tl-preroll',
            style: 'left:' + NAMES_W + 'px;width:' + xOf(0) + 'px;top:24px;'
        }));
    }

    playheadEl = h('div', { id: 'tl-playhead' });
    contentEl.appendChild(playheadEl);
    updateTimeUI();
};

function scrub(e) {
    const r = rulerDiv.getBoundingClientRect();
    let t = tOf(e.clientX - r.left);
    if (!e.shiftKey) t = snapTime(t);
    AFX.setTime(AFX.clamp(t, 0, AFX.state.doc.comp.dur));
}

function drawRuler() {
    const ctx = rulerCanvas.getContext('2d');
    const w = rulerCanvas.width;
    const doc = AFX.state.doc;
    ctx.clearRect(0, 0, w, 24);

    // пре-ролл затемняем
    if (timeMin < 0) {
        ctx.fillStyle = 'rgba(255,68,68,0.08)';
        ctx.fillRect(0, 0, xOf(0), 24);
    }
    const minLabelPx = 60;
    let stepS = 0.1;
    const steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5];
    for (const s of steps) { if (s * ppsVal >= minLabelPx) { stepS = s; break; } }
    ctx.font = '10px Consolas, monospace';
    for (let t = Math.ceil(timeMin / stepS) * stepS; t <= doc.comp.dur + 1e-6; t += stepS) {
        const x = Math.round(xOf(t)) + 0.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x, 24); ctx.stroke();
        ctx.fillStyle = t < -1e-9 ? '#8a5050' : '#6b644f';
        const label = (Math.round(t * 100) / 100) + L('s');
        ctx.fillText(label, x + 3, 10);
    }
    if (ppsVal / fpsOf() > 5) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let f = Math.ceil(timeMin * fpsOf()); f <= doc.comp.dur * fpsOf(); f++) {
            const x = Math.round(xOf(f / fpsOf())) + 0.5;
            ctx.beginPath(); ctx.moveTo(x, 18); ctx.lineTo(x, 24); ctx.stroke();
        }
    }
    const xe = Math.round(xOf(doc.comp.dur)) + 0.5;
    ctx.strokeStyle = 'rgba(255,68,68,0.5)';
    ctx.beginPath(); ctx.moveTo(xe, 0); ctx.lineTo(xe, 24); ctx.stroke();
    const xz = Math.round(xOf(0)) + 0.5;
    ctx.strokeStyle = 'rgba(89,227,226,0.4)';
    ctx.beginPath(); ctx.moveTo(xz, 0); ctx.lineTo(xz, 24); ctx.stroke();

    const xp = Math.round(xOf(AFX.state.time));
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(xp - 5, 0); ctx.lineTo(xp + 5, 0); ctx.lineTo(xp, 8);
    ctx.closePath(); ctx.fill();
}

// ---------- dope sheet ----------
function buildDope(doc, timeW) {
    const rowsBox = h('div');
    contentEl.appendChild(rowsBox);
    doc.layers.forEach(layer => {
        rowsBox.appendChild(layerRow(doc, layer));
        if (layer._tlOpen) {
            TL.animTracks(layer).forEach(td => rowsBox.appendChild(propRow(doc, layer, td)));
            if (layer.type === 'emitter') {
                curveDefsFor(layer).forEach(cd => rowsBox.appendChild(curveRow(doc, layer, cd)));
                rowsBox.appendChild(gradRow(doc, layer));
            }
        }
    });
    if (!doc.layers.length) {
        rowsBox.appendChild(h('div', { style: 'padding:12px;color:#6b644f;position:sticky;left:0;', text: L('No layers. Add buttons are at the top of the timeline.') }));
    }
}

function isLayerSel(layer) { return AFX.state.selLayers.has(layer.id); }

function layerRow(doc, layer) {
    const row = h('div', { cls: 'tl-row' + (isLayerSel(layer) ? ' sel' : '') + (layer.on ? '' : ' off') });
    const tracks = TL.animTracks(layer);
    const expandable = layer.type === 'emitter' || tracks.length > 0;

    const exp = h('span', { cls: 'exp', title: L('Expand parameters (U)'), text: expandable ? (layer._tlOpen ? '▼' : '►') : '' });
    exp.addEventListener('click', function (e) {
        e.stopPropagation();
        layer._tlOpen = !layer._tlOpen;
        TL.rebuild();
    });

    const eye = h('span', { cls: 'eye-btn' + (layer.on ? ' on' : ''), title: L('Layer visibility') }, D.icon(layer.on ? 'eye' : 'eyeOff'));
    eye.addEventListener('click', function (e) {
        e.stopPropagation();
        AFX.pushUndo();
        layer.on = !layer.on;
        AFX.touch(layer.id);
        AFX.commitEnd();
        AFX.emit('layers');
    });
    const solo = h('span', { cls: 'solo-btn' + (layer.solo ? ' on' : ''), title: L('Solo') }, D.icon('solo'));
    solo.addEventListener('click', function (e) {
        e.stopPropagation();
        AFX.pushUndo();
        layer.solo = !layer.solo;
        AFX.touch(layer.id);
        AFX.commitEnd();
        AFX.emit('layers');
    });

    const nm = h('span', { cls: 'nm', text: layer.name, title: layer.name });
    nm.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        startRename(nm, layer);
    });

    const del = h('span', { cls: 'del-btn', title: L('Delete layer (Del)') }, D.icon('del'));
    del.addEventListener('click', function (e) {
        e.stopPropagation();
        AFX.Ops.remove(layer);
    });

    const nameCell = h('div', { cls: 'tl-name' }, exp, eye, solo,
        h('span', { cls: 'type-badge sm ' + layer.type, text: TYPE_BADGE[layer.type] || 'S' }),
        nm, del);

    nameCell.addEventListener('click', function (e) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) AFX.Ops.selectToggle(layer.id);
        else AFX.Ops.selectOnly(layer.id);
    });
    nameCell.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (!isLayerSel(layer)) AFX.Ops.selectOnly(layer.id);
        D.ctxMenu(e.clientX, e.clientY, [
            { label: L('Rename'), click: function () { startRename(nm, layer); } },
            { label: L('Duplicate'), mark: 'Ctrl+D', click: function () { AFX.Ops.duplicate(layer); } },
            { sep: true },
            { label: L('Move up'), click: function () { AFX.Ops.move(layer, -1); } },
            { label: L('Move down'), click: function () { AFX.Ops.move(layer, 1); } },
            { sep: true },
            { label: L('Delete'), mark: 'Del', danger: true, click: function () { AFX.Ops.removeMany(AFX.Ops.selectedLayers()); } }
        ]);
    });

    // перетаскивание порядка (вертикально, за колонку имён)
    nameCell.draggable = true;
    nameCell.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/afx-layer', layer.id);
        e.dataTransfer.effectAllowed = 'move';
    });
    nameCell.addEventListener('dragover', function (e) {
        if (!e.dataTransfer.types.includes('text/afx-layer')) return;
        e.preventDefault();
        const r = nameCell.getBoundingClientRect();
        const top = e.clientY < r.top + r.height / 2;
        row.classList.toggle('dragover-top', top);
        row.classList.toggle('dragover-bot', !top);
    });
    nameCell.addEventListener('dragleave', function () {
        row.classList.remove('dragover-top', 'dragover-bot');
    });
    nameCell.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const srcId = e.dataTransfer.getData('text/afx-layer');
        row.classList.remove('dragover-top', 'dragover-bot');
        if (!srcId) return;
        const r = nameCell.getBoundingClientRect();
        AFX.Ops.reorder(srcId, layer.id, e.clientY >= r.top + r.height / 2);
    });
    row.appendChild(nameCell);

    // бар
    const track = h('div', { cls: 'tl-track' });
    const barTitle = layer.type === 'emitter' ? L('Emission window (particles outlive it)')
        : (layer.type === 'postfx' ? L('Post-effect window') : L('Visibility window'));
    const bar = h('div', { cls: 'tl-bar ' + layer.type, title: barTitle });
    const place = function () {
        bar.style.left = xOf(layer.start) + 'px';
        bar.style.width = Math.max(6, (layer.end - layer.start) * ppsVal) + 'px';
    };
    place();
    barPlaceMap.set(layer.id, place);

    const minLen = () => 1 / fpsOf();
    const mkEdge = function (side) {
        const eEl = h('div', { cls: 'bh ' + side });
        let base = 0, started = false;
        D.drag(eEl, {
            start: function () { base = side === 'l' ? layer.start : layer.end; started = false; beginInteract(); },
            move: function (e, dx) {
                if (!started) { started = true; AFX.pushUndo(); }
                const nt = snapTime(base + dx / ppsVal);
                if (side === 'l') layer.start = Math.min(nt, layer.end - minLen());
                else layer.end = Math.max(nt, layer.start + minLen());
                place();
                AFX.touch(layer.id);
            },
            end: function (e, m) { endInteract(); if (m) AFX.commitEnd(); TL.rebuild(); }
        });
        return eEl;
    };
    bar.appendChild(mkEdge('l'));
    bar.appendChild(mkEdge('r'));

    let bases = null, startedMove = false;
    D.drag(bar, {
        start: function (e) {
            // драг двигает все выделенные слои, если бар среди них
            if (!isLayerSel(layer)) {
                if (e.shiftKey || e.ctrlKey || e.metaKey) AFX.Ops.selectToggle(layer.id);
                else AFX.Ops.selectOnly(layer.id);
            }
            const targets = isLayerSel(layer) ? AFX.Ops.selectedLayers() : [layer];
            bases = targets.map(l => ({ l: l, s: l.start, e: l.end }));
            startedMove = false;
            beginInteract();
        },
        move: function (e, dx) {
            if (!startedMove) { startedMove = true; AFX.pushUndo(); }
            const grab = bases.find(b => b.l === layer) || bases[0];
            const dt = snapTime(grab.s + dx / ppsVal) - grab.s;
            bases.forEach(b => {
                b.l.start = b.s + dt;
                b.l.end = b.e + dt;
                const pl = barPlaceMap.get(b.l.id);
                if (pl) pl();
                AFX.touch(b.l.id);
            });
        },
        end: function (e, moved) {
            endInteract();
            if (moved) AFX.commitEnd();
            else if (!(e.shiftKey || e.ctrlKey || e.metaKey)) AFX.Ops.selectOnly(layer.id);
            TL.rebuild();
        }
    });

    track.appendChild(bar);
    row.appendChild(track);
    return row;
}

function startRename(nmEl, layer) {
    const inp = h('input', { value: layer.name });
    nmEl.textContent = '';
    nmEl.appendChild(inp);
    inp.focus(); inp.select();
    let done = false;
    const finish = function (apply) {
        if (done) return;
        done = true;
        const v = inp.value.trim();
        if (apply && v && v !== layer.name) {
            AFX.pushUndo();
            layer.name = v;
            AFX.commitEnd();
        }
        AFX.emit('layers');
        AFX.emit('select');
    };
    inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
    });
    inp.addEventListener('blur', function () { finish(true); });
    inp.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
}

// ---------- строки ключей ----------
function propRow(doc, layer, td) {
    const row = h('div', { cls: 'tl-row prop-row' });
    const gs = AFX.state.graphSel;
    const isGraphed = gs && gs.layerId === layer.id && gs.path === td.path;
    const nameCell = h('div', { cls: 'tl-name' + (isGraphed ? ' graphed' : ''), title: L('Click to open in the graph') },
        h('span', { cls: 'nm', text: td.label }));
    nameCell.addEventListener('click', function () {
        if (td.path === 'sp.color') return;
        TL.openGraph({ layerId: layer.id, path: td.path });
    });
    row.appendChild(nameCell);

    const track = h('div', { cls: 'tl-track' });
    track.addEventListener('dblclick', function (e) {
        const r = track.getBoundingClientRect();
        const tl = snapKey(tOf(e.clientX - r.left) - layer.start);
        AFX.pushUndo();
        T.setValueAt(td.tr, tl, T.val(td.tr, tl), 0.4 / fpsOf());
        AFX.touch(layer.id);
        AFX.commitEnd();
        queueRebuild();
    });
    td.tr.keys.forEach(key => track.appendChild(keyEl(doc, layer, td, key)));
    row.appendChild(track);
    return row;
}

function isSelKey(key) {
    return AFX.state.selKeys.some(s => s.key === key);
}
function selectKey(layer, td, key, additive) {
    if (!additive) AFX.state.selKeys = [];
    const idx = AFX.state.selKeys.findIndex(s => s.key === key);
    if (idx >= 0 && additive) AFX.state.selKeys.splice(idx, 1);
    else AFX.state.selKeys.push({ layerId: layer.id, path: td.path, tr: td.tr, key: key });
    AFX.emit('keysel');
}

function keyEl(doc, layer, td, key) {
    const el = h('div', { cls: 'tl-key' + (isSelKey(key) ? ' sel' : '') + ((key.o && key.o.m) === 'hold' ? ' hold' : '') });
    const place = function () { el.style.left = xOf(layer.start + key.t) + 'px'; };
    place();
    el.title = td.label + ' = ' + (Array.isArray(key.v) ? AFX.rgbToHex(key.v) : (Math.round(key.v * 100) / 100)) + ' @ ' + key.t.toFixed(3) + L('s') + ' [' + T.easeLabel(key) + ']';
    keyElMap.set(key, { el: el, layer: layer });

    let bases = null, started = false;
    D.drag(el, {
        start: function (e) {
            if (!isSelKey(key)) selectKey(layer, td, key, e.ctrlKey || e.metaKey || e.shiftKey);
            bases = AFX.state.selKeys.map(s => ({ s: s, t0: s.key.t }));
            started = false;
            beginInteract();
            refreshKeySelStyles();
        },
        move: function (e, dx) {
            if (!started) { started = true; AFX.pushUndo(); }
            const grab = bases.find(b => b.s.key === key);
            const snapped = snapTime(grab.t0 + dx / ppsVal) - grab.t0;
            bases.forEach(b => { b.s.key.t = Math.max(0, b.t0 + snapped); });
            const trs = new Set(bases.map(b => b.s.tr));
            trs.forEach(tr => T.sort(tr));
            const lids = new Set(bases.map(b => b.s.layerId));
            lids.forEach(id => AFX.touch(id));
            // живое перемещение всех выделенных ромбов
            bases.forEach(b => {
                const rec = keyElMap.get(b.s.key);
                if (rec) rec.el.style.left = xOf(rec.layer.start + b.s.key.t) + 'px';
            });
        },
        end: function (e, moved) {
            endInteract();
            if (moved) AFX.commitEnd();
            else selectKey(layer, td, key, e.ctrlKey || e.metaKey || e.shiftKey);
            TL.rebuild();
        }
    });
    el.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!isSelKey(key)) selectKey(layer, td, key, false);
        keyMenu(e.clientX, e.clientY);
    });
    return el;
}

function refreshKeySelStyles() {
    keyElMap.forEach(function (rec, key) {
        rec.el.classList.toggle('sel', isSelKey(key));
    });
}

function keyMenu(x, y) {
    const sel = AFX.state.selKeys;
    if (!sel.length) return;
    const cur = sel.length === 1 ? T.easeLabel(sel[0].key) : null;
    const apply = function (m) {
        AFX.pushUndo();
        sel.forEach(s => T.setEase(s.key, m));
        const lids = new Set(sel.map(s => s.layerId));
        lids.forEach(id => AFX.touch(id));
        AFX.commitEnd();
        queueRebuild();
    };
    D.ctxMenu(x, y, [
        { label: L('Linear'), mark: cur === 'lin' ? '·' : null, click: function () { apply('lin'); } },
        { label: L('Easy Ease'), mark: cur === 'ease' ? '·' : null, click: function () { apply('ease'); } },
        { label: L('Easy In'), mark: cur === 'easeIn' ? '·' : null, click: function () { apply('easeIn'); } },
        { label: L('Easy Out'), mark: cur === 'easeOut' ? '·' : null, click: function () { apply('easeOut'); } },
        { label: L('Hold / Flat'), mark: cur === 'hold' ? '·' : null, click: function () { apply('hold'); } },
        { sep: true },
        { label: L('Delete key(s)'), danger: true, click: function () { AFX.deleteSelKeys(); } }
    ]);
}

// ---------- строки кривых "за жизнь" и градиента ----------
function stripGeom() {
    const doc = AFX.state.doc;
    return { x: xOf(0), w: Math.max(40, doc.comp.dur * ppsVal) };
}

function curveRow(doc, layer, cd) {
    const row = h('div', { cls: 'tl-row ol-row' });
    const gs = AFX.state.graphSel;
    const isGraphed = gs && gs.layerId === layer.id && gs.curve === cd.key;
    const nameCell = h('div', { cls: 'tl-name' + (isGraphed ? ' graphed' : ''), title: L(cd.tip || 'Over-life curve (0..1). Click to edit in the graph.') },
        h('span', { cls: 'nm', text: L(cd.label) }));
    nameCell.addEventListener('click', function () {
        TL.openGraph({ layerId: layer.id, curve: cd.key });
    });
    row.appendChild(nameCell);

    const track = h('div', { cls: 'tl-track' });
    const g = stripGeom();
    const strip = h('div', { cls: 'ol-strip', style: 'left:' + g.x + 'px;width:' + g.w + 'px;', title: L(cd.tip || 'Particle life: 0 on the left, 1 on the right. Click to open the graph.') });
    const cw = Math.min(1200, Math.max(60, Math.round(g.w)));
    const canvas = h('canvas', { width: cw, height: 21, style: 'width:100%;height:100%;' });
    const ctx = canvas.getContext('2d');
    const curve = layer.pt[cd.key];
    ctx.strokeStyle = '#59e3e2';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 0; x <= cw; x += 2) {
        const v = AFX.Curve.val(curve, x / cw);
        const y = 19 - AFX.clamp(v / cd.yMax, 0, 1) * 17;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#fdcf82';
    curve.pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.t * cw, 19 - AFX.clamp(p.v / cd.yMax, 0, 1) * 17, 2, 0, Math.PI * 2);
        ctx.fill();
    });
    strip.appendChild(canvas);
    strip.addEventListener('click', function () { TL.openGraph({ layerId: layer.id, curve: cd.key }); });
    track.appendChild(strip);
    row.appendChild(track);
    return row;
}

function gradRow(doc, layer) {
    const row = h('div', { cls: 'tl-row ol-row' });
    row.appendChild(h('div', { cls: 'tl-name', title: L('Particle color over life (0..1). Click the strip to add a stop, right-click removes, double-click picks a color.') },
        h('span', { cls: 'nm', text: L('Color over life') })));

    const track = h('div', { cls: 'tl-track' });
    const g = stripGeom();
    const strip = h('div', { cls: 'ol-strip', style: 'left:' + g.x + 'px;width:' + g.w + 'px;' });
    const cw = Math.min(1200, Math.max(60, Math.round(g.w)));
    const canvas = h('canvas', { width: cw, height: 21, style: 'width:100%;height:100%;cursor:copy;' });
    const ctx = canvas.getContext('2d');
    const grad = layer.pt.grad;

    const redraw = function () {
        const grd = ctx.createLinearGradient(0, 0, cw, 0);
        grad.stops.forEach(s => grd.addColorStop(AFX.clamp(s.t, 0, 1), AFX.rgbToHex(s.c)));
        ctx.clearRect(0, 0, cw, 21);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, cw, 21);
    };
    redraw();
    strip.appendChild(canvas);

    const placeStop = function (el, s) { el.style.left = (AFX.clamp(s.t, 0, 1) * 100) + '%'; };
    const stopEls = new Map();
    grad.stops.slice().forEach(s => {
        const el = h('div', { cls: 'grad-strip-stop', title: L('Drag to move. Right-click to remove. Double-click for color.') });
        el.style.background = AFX.rgbToHex(s.c);
        placeStop(el, s);
        stopEls.set(s, el);
        let base = 0, started = false;
        D.drag(el, {
            start: function () { base = s.t; started = false; beginInteract(); },
            move: function (e, dx) {
                if (!started) { started = true; AFX.pushUndo(); }
                const r = strip.getBoundingClientRect();
                s.t = AFX.clamp(base + dx / r.width, 0, 1);
                AFX.Grad.sort(grad);
                placeStop(el, s);
                redraw();
                AFX.touch(layer.id);
            },
            end: function (e, m) { endInteract(); if (m) AFX.commitEnd(); queueRebuild(); }
        });
        el.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (grad.stops.length <= 2) return;
            AFX.pushUndo();
            grad.stops.splice(grad.stops.indexOf(s), 1);
            AFX.touch(layer.id);
            AFX.commitEnd();
            queueRebuild();
        });
        el.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            const inp = h('input', { type: 'color', style: 'position:fixed;left:' + e.clientX + 'px;top:' + (e.clientY - 30) + 'px;width:1px;height:1px;opacity:0;' });
            inp.value = AFX.rgbToHex(s.c);
            document.body.appendChild(inp);
            let pushed = false;
            inp.addEventListener('input', function () {
                if (!pushed) { pushed = true; AFX.pushUndo(); }
                s.c = AFX.hexToRgb(inp.value);
                el.style.background = inp.value;
                redraw();
                AFX.touch(layer.id);
            });
            inp.addEventListener('change', function () { AFX.commitEnd(); inp.remove(); queueRebuild(); });
            inp.click();
        });
        strip.appendChild(el);
    });

    canvas.addEventListener('click', function (e) {
        const r = strip.getBoundingClientRect();
        const t = AFX.clamp((e.clientX - r.left) / r.width, 0, 1);
        AFX.pushUndo();
        grad.stops.push({ t: t, c: AFX.Grad.val(grad, t) });
        AFX.Grad.sort(grad);
        AFX.touch(layer.id);
        AFX.commitEnd();
        queueRebuild();
    });

    track.appendChild(strip);
    row.appendChild(track);
    return row;
}

// ---------- график ----------
function getGraphTarget() {
    const gs = AFX.state.graphSel;
    if (!gs) return null;
    const layer = AFX.layerById(gs.layerId);
    if (!layer) return null;
    if (gs.curve) {
        if (layer.type !== 'emitter' || !layer.pt[gs.curve]) return null;
        const cd = CURVE_DEFS.find(c => c.key === gs.curve);
        return { kind: 'curve', layer: layer, curve: layer.pt[gs.curve], label: cd ? L(cd.label) : gs.curve, yMax: cd ? cd.yMax : 1.5 };
    }
    const r = resolve(layer, gs.path);
    if (!r.obj || !T.isAnim(r.obj[r.key])) return null;
    if (Array.isArray(r.obj[r.key].keys[0] && r.obj[r.key].keys[0].v)) return null;
    return { kind: 'track', layer: layer, tr: r.obj[r.key], path: gs.path, label: propLabel(gs.path, layer) };
}

function buildGraph(doc, timeW) {
    const bodyH = Math.max(90, scrollEl.clientHeight - 26);
    const row = h('div', { cls: 'tl-row', style: 'height:' + bodyH + 'px;' });
    const names = h('div', { cls: 'tl-name', style: 'display:block;overflow-y:auto;padding:4px 0;' });

    const selLayer = AFX.layerById(AFX.state.sel);
    if (selLayer) {
        names.appendChild(h('div', { style: 'padding:2px 8px;color:#6b644f;font-size:10px;text-transform:uppercase;', text: selLayer.name }));
        const gs = AFX.state.graphSel || {};
        const item = function (label, sel2, cb, dim) {
            const el = h('div', {
                style: 'padding:3px 10px;cursor:pointer;font-size:11px;border-radius:3px;margin:0 4px;' +
                    (sel2 ? 'background:#24302e;color:#59e3e2;' : 'color:' + (dim ? '#6b644f' : '#9a917a') + ';'),
                text: label
            });
            el.addEventListener('click', cb);
            return el;
        };
        const tracks = TL.animTracks(selLayer);
        tracks.forEach(td => {
            const isCur = gs.layerId === selLayer.id && gs.path === td.path;
            names.appendChild(item(td.label + (td.path === 'sp.color' ? ' (' + L('color') + ')' : ''), isCur, function () {
                if (td.path === 'sp.color') return;
                AFX.state.graphSel = { layerId: selLayer.id, path: td.path };
                TL.rebuild();
            }, td.path === 'sp.color'));
        });
        if (selLayer.type === 'emitter') {
            names.appendChild(h('div', { style: 'padding:4px 8px 2px;color:#6b644f;font-size:10px;text-transform:uppercase;', text: L('Over particle life') }));
            curveDefsFor(selLayer).forEach(cd => {
                const isCur = gs.layerId === selLayer.id && gs.curve === cd.key;
                names.appendChild(item(L(cd.label), isCur, function () {
                    AFX.state.graphSel = { layerId: selLayer.id, curve: cd.key };
                    TL.rebuild();
                }));
            });
        }
        if (!tracks.length && selLayer.type !== 'emitter') {
            names.appendChild(h('div', { style: 'padding:6px 8px;color:#6b644f;font-size:11px;', text: L('No animated properties. Enable a stopwatch on a parameter.') }));
        }
    } else {
        names.appendChild(h('div', { style: 'padding:6px 8px;color:#6b644f;font-size:11px;', text: L('Select a layer.') }));
    }
    row.appendChild(names);

    const wrap = h('div', { id: 'graph-wrap', cls: 'tl-track' });
    graphCanvas = h('canvas', { id: 'graph-canvas' });
    graphCanvas.width = timeW;
    graphCanvas.height = bodyH;
    wrap.appendChild(graphCanvas);
    row.appendChild(wrap);
    contentEl.appendChild(row);

    initGraphInteractions();
    drawGraph();
}

function graphRange(tr) {
    if (graphView) return graphView;
    let vMin = Infinity, vMax = -Infinity;
    tr.keys.forEach(k => { vMin = Math.min(vMin, k.v); vMax = Math.max(vMax, k.v); });
    if (!isFinite(vMin)) { vMin = 0; vMax = 1; }
    if (vMax - vMin < 1e-6) { vMin -= 1; vMax += 1; }
    const pad = (vMax - vMin) * 0.18;
    return { vMin: vMin - pad + graphPan, vMax: vMax + pad + graphPan };
}

const GPAD = 16;
function vToY(v, rng, H) { return GPAD + (rng.vMax - v) / (rng.vMax - rng.vMin) * (H - GPAD * 2); }
function yToV(y, rng, H) { return rng.vMax - (y - GPAD) / (H - GPAD * 2) * (rng.vMax - rng.vMin); }

// маппинг кривой за жизнь: t 0..1 по всей ширине с полями
const CPAD = 46;
function cToX(t, W) { return CPAD + t * (W - CPAD - 24); }
function xToC(x, W) { return AFX.clamp((x - CPAD) / (W - CPAD - 24), 0, 1); }

// сдвиг оси значений живёт до смены цели: другой трек/кривая — снова автофит
function graphTargetKey() {
    const gs = AFX.state.graphSel;
    return gs ? (gs.layerId + '|' + (gs.path || gs.curve || '')) : '';
}
function syncGraphPan() {
    const k = graphTargetKey();
    if (k !== graphPanKey) { graphPanKey = k; graphPan = 0; }
}

function drawGraph() {
    syncGraphPan();
    const g = getGraphTarget();
    const ctx = graphCanvas.getContext('2d');
    const W = graphCanvas.width, H = graphCanvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#14110d';
    ctx.fillRect(0, 0, W, H);
    if (!g) {
        ctx.fillStyle = '#6b644f';
        ctx.font = '12px Segoe UI';
        ctx.fillText(L('Select a property or a curve on the left.'), 24, 30);
        return;
    }
    if (g.kind === 'curve') { drawCurveGraph(ctx, g, W, H); return; }

    const layer = g.layer, tr = g.tr;
    const rng = graphRange(tr);

    const stepsV = niceStep((rng.vMax - rng.vMin) / 4);
    ctx.font = '10px Consolas, monospace';
    for (let v = Math.ceil(rng.vMin / stepsV) * stepsV; v <= rng.vMax; v += stepsV) {
        const y = Math.round(vToY(v, rng, H)) + 0.5;
        ctx.strokeStyle = Math.abs(v) < stepsV / 2 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.fillStyle = '#6b644f';
        ctx.fillText(trim2(v), 4, y - 3);
    }
    const x0 = xOf(layer.start), x1 = xOf(layer.end);
    ctx.fillStyle = 'rgba(89,227,226,0.04)';
    ctx.fillRect(x0, 0, x1 - x0, H);
    if (timeMin < 0) {
        ctx.fillStyle = 'rgba(255,68,68,0.05)';
        ctx.fillRect(0, 0, xOf(0), H);
    }

    ctx.strokeStyle = '#59e3e2';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) {
        const t = tOf(x) - layer.start;
        const v = T.val(tr, t);
        const y = vToY(v, rng, H);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    tr.keys.forEach((k, i) => {
        const kx = xOf(layer.start + k.t);
        const ky = vToY(k.v, rng, H);
        const sel = isSelKey(k);
        if (sel) {
            const prev = tr.keys[i - 1], next = tr.keys[i + 1];
            ctx.strokeStyle = 'rgba(253,207,130,0.7)';
            ctx.fillStyle = '#fdcf82';
            if (next) {
                const hd = handlePos(layer, k, next, 'out', rng, H);
                ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
                ctx.beginPath(); ctx.arc(hd[0], hd[1], 3.4, 0, Math.PI * 2); ctx.fill();
            }
            if (prev) {
                const hd = handlePos(layer, prev, k, 'in', rng, H);
                ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
                ctx.beginPath(); ctx.arc(hd[0], hd[1], 3.4, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.fillStyle = sel ? '#21fcfe' : '#fdcf82';
        ctx.fillRect(kx - 3.5, ky - 3.5, 7, 7);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(kx - 3.5, ky - 3.5, 7, 7);
    });

    const xp = xOf(AFX.state.time);
    ctx.strokeStyle = 'rgba(255,68,68,0.8)';
    ctx.beginPath(); ctx.moveTo(xp, 0); ctx.lineTo(xp, H); ctx.stroke();

    ctx.fillStyle = '#89e5dc';
    ctx.font = '11px Segoe UI';
    ctx.fillText(layer.name + ' → ' + g.label, 8, H - 6);
}

function drawCurveGraph(ctx, g, W, H) {
    const yMaxLim = Math.max(g.yMax, ...g.curve.pts.map(p => p.v * 1.15));
    const rng = { vMin: 0, vMax: yMaxLim };
    ctx.font = '10px Consolas, monospace';
    const stepsV = niceStep(yMaxLim / 4);
    for (let v = 0; v <= rng.vMax + 1e-9; v += stepsV) {
        const y = Math.round(vToY(v, rng, H)) + 0.5;
        ctx.strokeStyle = Math.abs(v - 1) < 1e-9 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.moveTo(CPAD - 6, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.fillStyle = '#6b644f';
        ctx.fillText(trim2(v), 6, y - 3);
    }
    // вертикали 0, 0.25 .. 1 жизни
    for (let t = 0; t <= 1.001; t += 0.25) {
        const x = Math.round(cToX(t, W)) + 0.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath(); ctx.moveTo(x, GPAD - 6); ctx.lineTo(x, H - GPAD + 6); ctx.stroke();
        ctx.fillStyle = '#6b644f';
        ctx.fillText(String(t), x - 6, H - 2);
    }

    ctx.strokeStyle = '#59e3e2';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let x = cToX(0, W); x <= cToX(1, W); x += 2) {
        const v = AFX.Curve.val(g.curve, xToC(x, W));
        const y = vToY(Math.min(v, rng.vMax), rng, H);
        x <= cToX(0, W) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#fdcf82';
    g.curve.pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(cToX(p.t, W), vToY(Math.min(p.v, rng.vMax), rng, H), 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    });

    ctx.fillStyle = '#89e5dc';
    ctx.font = '11px Segoe UI';
    ctx.fillText(g.layer.name + ' → ' + g.label + '   ' + L('(X axis — particle life 0..1, drag points, double-click to add/remove)'), 8, 12);
}

function handlePos(layer, A, B, side, rng, H) {
    const c = T.segControls(A, B);
    const dt = B.t - A.t, dv = B.v - A.v;
    if (side === 'out') {
        return [xOf(layer.start + A.t + dt * c[0]), vToY(A.v + dv * c[1], rng, H)];
    }
    return [xOf(layer.start + A.t + dt * c[2]), vToY(A.v + dv * c[3], rng, H)];
}

function trim2(v) {
    const a = Math.abs(v);
    if (a >= 100) return String(Math.round(v));
    return String(Math.round(v * 100) / 100);
}
function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, raw))));
    const n = raw / p;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

function initGraphInteractions() {
    const canvas = graphCanvas;
    let dragKey = null, dragHandle = null, dragPt = null, started = false;

    const mpos = function (e) {
        const r = canvas.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
    };
    const dist2 = (x, y, p) => (x - p[0]) * (x - p[0]) + (y - p[1]) * (y - p[1]);

    const hitTest = function (mx, my) {
        const g = getGraphTarget();
        if (!g) return null;
        const H = canvas.height, W = canvas.width;
        if (g.kind === 'curve') {
            const yMaxLim = Math.max(g.yMax, ...g.curve.pts.map(p => p.v * 1.15));
            const rng = { vMin: 0, vMax: yMaxLim };
            for (const p of g.curve.pts) {
                if (dist2(mx, my, [cToX(p.t, W), vToY(Math.min(p.v, rng.vMax), rng, H)]) < 70) return { pt: p, g: g, rng: rng };
            }
            return { g: g, rng: rng }; // пустое место кривой
        }
        const rng = graphRange(g.tr);
        for (const s of AFX.state.selKeys) {
            const i = g.tr.keys.indexOf(s.key);
            if (i < 0) continue;
            const prev = g.tr.keys[i - 1], next = g.tr.keys[i + 1];
            if (next) {
                const hd = handlePos(g.layer, s.key, next, 'out', rng, H);
                if (dist2(mx, my, hd) < 60) return { handle: 'out', A: s.key, B: next, g: g };
            }
            if (prev) {
                const hd = handlePos(g.layer, prev, s.key, 'in', rng, H);
                if (dist2(mx, my, hd) < 60) return { handle: 'in', A: prev, B: s.key, g: g };
            }
        }
        for (const k of g.tr.keys) {
            const kx = xOf(g.layer.start + k.t), ky = vToY(k.v, rng, H);
            if (dist2(mx, my, [kx, ky]) < 60) return { key: k, g: g };
        }
        return null;
    };

    D.drag(canvas, {
        start: function (e) {
            const m = mpos(e);
            const hit = hitTest(m[0], m[1]);
            dragKey = null; dragHandle = null; dragPt = null; started = false;
            if (!hit) { AFX.state.selKeys = []; drawGraph(); return; }
            const g = hit.g;
            beginInteract();
            if (hit.pt) {
                dragPt = { p: hit.pt, g: g, rng: hit.rng };
            } else if (hit.key) {
                if (!isSelKey(hit.key)) {
                    AFX.state.selKeys = [{ layerId: g.layer.id, path: AFX.state.graphSel.path, tr: g.tr, key: hit.key }];
                }
                graphView = graphRange(g.tr);
                dragKey = hit.key;
            } else if (hit.handle) {
                graphView = graphRange(g.tr);
                dragHandle = hit;
            } else {
                endInteract();
            }
            drawGraph();
        },
        move: function (e) {
            const g = getGraphTarget();
            if (!g) return;
            const m = mpos(e);
            const H = canvas.height, W = canvas.width;
            if (dragPt) {
                if (!started) { started = true; AFX.pushUndo(); }
                const pts = dragPt.g.curve.pts;
                const first = pts[0] === dragPt.p, last = pts[pts.length - 1] === dragPt.p;
                if (!first && !last) dragPt.p.t = xToC(m[0], W);
                dragPt.p.v = AFX.clamp(yToV(m[1], dragPt.rng, H), 0, dragPt.rng.vMax);
                AFX.Curve.sort(dragPt.g.curve);
                AFX.touch(g.layer.id);
                drawGraph();
            } else if (dragKey) {
                if (!started) { started = true; AFX.pushUndo(); }
                const rng = graphView || graphRange(g.tr);
                let t = tOf(m[0]) - g.layer.start;
                if (!e.shiftKey) t = snapTime(t);
                dragKey.t = Math.max(0, t);
                dragKey.v = yToV(m[1], rng, H);
                T.sort(g.tr);
                AFX.touch(g.layer.id);
                drawGraph();
            } else if (dragHandle) {
                if (!started) { started = true; AFX.pushUndo(); }
                const rng = graphView || graphRange(g.tr);
                const A = dragHandle.A, B = dragHandle.B;
                const dt = B.t - A.t, dv = B.v - A.v;
                const t = tOf(m[0]) - g.layer.start;
                const v = yToV(m[1], rng, H);
                const hx = AFX.clamp(dt > 1e-9 ? (t - A.t) / dt : 0.5, 0, 1);
                const hy = Math.abs(dv) > 1e-9 ? (v - A.v) / dv : (v - A.v);
                if (dragHandle.handle === 'out') A.o = { m: 'cust', h: [hx, hy] };
                else B.i = { m: 'cust', h: [hx, hy] };
                AFX.touch(g.layer.id);
                drawGraph();
            }
        },
        end: function (e, moved) {
            if (dragPt || dragKey || dragHandle) {
                endInteract();
                if (moved) AFX.commitEnd();
            }
            dragKey = null; dragHandle = null; dragPt = null;
            graphView = null;
            drawGraph();
        }
    });

    // средняя кнопка = пан графика: X — прокрутка по времени, Y — сдвиг оси значений
    // (у кривой за жизнь ось Y фиксирована 0..yMax, двигаем только время).
    // Клик СКМ без движения возвращает автофит. Документ не мутируется — undo не пушим.
    let pan0 = null;
    D.drag(canvas, {
        button: 1,
        start: function () {
            const g = getGraphTarget();
            let vpp = 0;
            if (g && g.kind === 'track') {
                const rng = graphRange(g.tr);
                vpp = (rng.vMax - rng.vMin) / Math.max(1, canvas.height - GPAD * 2);
            }
            pan0 = { sx: scrollEl.scrollLeft, pan: graphPan, vpp: vpp };
            beginInteract();
            setPanning(true);
        },
        move: function (e, dx, dy) {
            scrollEl.scrollLeft = pan0.sx - dx;
            if (pan0.vpp) { graphPan = pan0.pan + dy * pan0.vpp; drawGraph(); }
        },
        end: function (e, moved) {
            setPanning(false);
            endInteract();
            if (!moved && pan0 && pan0.vpp) { graphPan = 0; drawGraph(); }
            pan0 = null;
        }
    });

    canvas.addEventListener('dblclick', function (e) {
        const g = getGraphTarget();
        if (!g) return;
        const m = mpos(e);
        const hit = hitTest(m[0], m[1]);
        const W = canvas.width, H = canvas.height;
        AFX.pushUndo();
        if (g.kind === 'curve') {
            const pts = g.curve.pts;
            if (hit && hit.pt) {
                if (pts.length > 2) pts.splice(pts.indexOf(hit.pt), 1);
            } else {
                const yMaxLim = Math.max(g.yMax, ...pts.map(p => p.v * 1.15));
                pts.push({ t: xToC(m[0], W), v: AFX.clamp(yToV(m[1], { vMin: 0, vMax: yMaxLim }, H), 0, yMaxLim) });
                AFX.Curve.sort(g.curve);
            }
        } else if (hit && hit.key) {
            if (g.tr.keys.length > 1) {
                T.removeKey(g.tr, hit.key);
                AFX.state.selKeys = AFX.state.selKeys.filter(s => s.key !== hit.key);
            }
        } else {
            const rng = graphRange(g.tr);
            const t = snapKey(tOf(m[0]) - g.layer.start);
            T.setValueAt(g.tr, t, yToV(m[1], rng, H), 0.4 / fpsOf());
        }
        AFX.touch(g.layer.id);
        AFX.commitEnd();
        drawGraph();
    });
    canvas.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        const g = getGraphTarget();
        if (!g || g.kind === 'curve') return;
        const m = mpos(e);
        const hit = hitTest(m[0], m[1]);
        if (hit && hit.key) {
            if (!isSelKey(hit.key)) AFX.state.selKeys = [{ layerId: g.layer.id, path: AFX.state.graphSel.path, tr: g.tr, key: hit.key }];
            keyMenu(e.clientX, e.clientY);
        }
    });
}

TL.getMode = function () { return mode; };
// для автотестов
TL._dbg = function () { return { pps: ppsVal, timeMin: timeMin, interacting: interacting, graphPan: graphPan }; };
})();
