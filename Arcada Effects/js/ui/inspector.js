// Arcaidia Effector — инспектор выбранного слоя
(function () {
'use strict';
const AFX = window.AFX;
const D = AFX.Dom, h = D.h, W = AFX.W, L = AFX.t;

const Insp = AFX.Inspector = {};
let bodyEl = null, titleEl = null;
let timeUpdaters = [];
let builtFor = null;

Insp.init = function () {
    bodyEl = document.getElementById('inspector-body');
    titleEl = document.getElementById('inspector-title');
    AFX.on('select', Insp.rebuild);
    AFX.on('doc', Insp.rebuild);
    AFX.on('layers', function () {
        // выбранный слой мог исчезнуть
        if (!AFX.layerById(AFX.state.sel)) Insp.rebuild();
    });
    AFX.on('time', function () { timeUpdaters.forEach(f => f()); });
    AFX.on('layer', function (id) {
        if (id && builtFor === id) timeUpdaters.forEach(f => f());
    });
    Insp.rebuild();
};

Insp.rebuild = function () {
    if (!bodyEl) return;
    bodyEl.innerHTML = '';
    timeUpdaters = [];
    const layer = AFX.layerById(AFX.state.sel);
    builtFor = layer ? layer.id : null;
    if (!layer) {
        titleEl.textContent = L('Inspector');
        bodyEl.appendChild(h('div', { cls: 'layers-empty', text: L('Select a layer to edit its parameters.') }));
        return;
    }
    titleEl.textContent = L('Inspector') + ' — ' + layer.name;
    const reg = timeUpdaters;

    if (layer.type === 'emitter') buildEmitter(layer, reg);
    else if (layer.type === 'atlas') buildAtlas(layer, reg);
    else if (layer.type === 'postfx') buildPostFx(layer, reg);
    else buildSprite(layer, reg);
};

// трек-дескриптор
function tr(layer, obj, key) { return { layer: layer, obj: obj, key: key }; }

function commonSection(layer, reg) {
    // постэффект ничего своего не рисует: смешивание, свечение и затухание слоя для
    // него мертвы, а opacity работает силой эффекта (см. Model.newPostFx)
    const isFx = layer.type === 'postfx';
    const sec = W.section(L('Layer'), true);
    if (!isFx) sec._body.appendChild(W.sel({
        label: L('Blend'),
        options: [['normal', L('Normal')], ['add', L('Add (lighter)')], ['screen', L('Screen')], ['multiply', L('Multiply')]],
        get: () => layer.blend,
        set: v => { layer.blend = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: isFx ? L('Effect strength') : L('Opacity'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: isFx ? L('Mix of the processed frame with the clean one (0 — bypass)') : null,
        track: tr(layer, layer, 'opacity'), reg: reg
    }));
    if (isFx) {
        sec._body.appendChild(W.num({
            label: L('Start (s)'), step: 0.02, prec: 2,
            get: () => layer.start,
            set: v => { const len = layer.end - layer.start; layer.start = v; layer.end = v + len; AFX.touch(layer.id); }
        }));
        sec._body.appendChild(W.num({
            label: L('End (s)'), step: 0.02, prec: 2,
            get: () => layer.end,
            set: v => { layer.end = Math.max(layer.start, v); AFX.touch(layer.id); }
        }));
        return sec;
    }
    sec._body.appendChild(W.num({
        label: L('Layer glow'), min: 0, max: 3, step: 0.02, prec: 2,
        tip: L('Post-process: blurred additive glow of the whole layer (best for trails)'),
        track: tr(layer, layer, 'glowL'), reg: reg
    }));
    sec._body.appendChild(W.num({
        label: L('Glow radius (px)'), min: 2, max: 120, step: 1, int: true,
        get: () => layer.glowLR, set: v => { layer.glowLR = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.chk({
        label: L('Radial fade'),
        tip: L('Fade the whole layer by distance from a movable center (drag the orange gizmo in the preview)'),
        get: () => layer.fadeOn,
        set: v => { layer.fadeOn = v; AFX.touch(layer.id); AFX.Inspector.rebuild(); }
    }));
    if (layer.fadeOn) {
        sec._body.appendChild(W.num({ label: L('Fade X'), step: 2, track: tr(layer, layer, 'fadeX'), reg: reg }));
        sec._body.appendChild(W.num({ label: L('Fade Y'), step: 2, track: tr(layer, layer, 'fadeY'), reg: reg }));
        sec._body.appendChild(W.num({ label: L('Fade radius'), min: 4, step: 2, unit: 'px', track: tr(layer, layer, 'fadeR'), reg: reg }));
        sec._body.appendChild(W.num({
            label: L('Softness'), min: 0, max: 1, step: 0.02, prec: 2,
            tip: L('Soft edge as a fraction of the radius (0 — hard cut)'),
            get: () => layer.fadeSoft, set: v => { layer.fadeSoft = v; AFX.touch(layer.id); }
        }));
    }
    sec._body.appendChild(W.num({
        label: L('Start (s)'), step: 0.02, prec: 2,
        tip: L('Can be negative: the simulation starts before composition zero'),
        get: () => layer.start,
        set: v => {
            const len = layer.end - layer.start;
            layer.start = v;
            layer.end = v + len;
            AFX.touch(layer.id);
        }
    }));
    sec._body.appendChild(W.num({
        label: layer.type === 'emitter' ? L('Emission end (s)') : L('End (s)'), step: 0.02, prec: 2,
        get: () => layer.end,
        set: v => { layer.end = Math.max(layer.start, v); AFX.touch(layer.id); }
    }));
    return sec;
}

function buildEmitter(layer, reg) {
    const em = layer.em, pt = layer.pt;
    bodyEl.appendChild(commonSection(layer, reg));

    // --- эмиттер ---
    const secE = W.section(L('Emitter'), true);
    secE._body.appendChild(W.sel({
        label: L('Shape'),
        options: [['point', L('Point')], ['circle', L('Circle / Ellipse')], ['ring', L('Ring')], ['box', L('Box')], ['line', L('Line')]],
        get: () => em.shape,
        set: v => { em.shape = v; AFX.touch(layer.id); }
    }));
    secE._body.appendChild(W.num({ label: L('Position X'), step: 2, track: tr(layer, em, 'x'), reg: reg }));
    secE._body.appendChild(W.num({ label: L('Position Y'), step: 2, track: tr(layer, em, 'y'), reg: reg }));
    secE._body.appendChild(W.num({ label: L('Size X'), min: 0, step: 2, track: tr(layer, em, 'sx'), reg: reg, tip: L('Radius / half-width of the shape. For a ring: radius.') }));
    secE._body.appendChild(W.num({ label: L('Size Y'), min: 0, step: 2, track: tr(layer, em, 'sy'), reg: reg, tip: L('Half-height. For a ring: thickness.') }));
    secE._body.appendChild(W.sel({
        label: L('Direction'),
        options: [['out', L('Outward')], ['in', L('Inward')], ['omni', L('Omni')], ['dir', L('By angle')]],
        get: () => em.dir,
        set: v => { em.dir = v; AFX.touch(layer.id); }
    }));
    secE._body.appendChild(W.num({ label: L('Angle'), step: 2, unit: L('deg'), track: tr(layer, em, 'angle'), reg: reg }));
    secE._body.appendChild(W.num({ label: L('Angle spread'), min: 0, max: 360, step: 2, unit: L('deg'), track: tr(layer, em, 'spread'), reg: reg }));
    secE._body.appendChild(W.num({ label: L('Speed'), min: 0, step: 4, unit: L('px/s'), track: tr(layer, em, 'speed'), reg: reg }));
    secE._body.appendChild(W.num({
        label: L('Speed random'), min: 0, max: 1, step: 0.02, prec: 2,
        get: () => em.speedRnd, set: v => { em.speedRnd = v; AFX.touch(layer.id); }
    }));
    secE._body.appendChild(W.num({ label: L('Rate (per sec)'), min: 0, step: 2, track: tr(layer, em, 'rate'), reg: reg }));
    secE._body.appendChild(W.chk({
        label: L('Smooth emission'),
        tip: L('Each particle is born at its own moment inside the simulation step, on the emitter pose of that moment. Removes the rows a fast-moving emitter or path leaves behind. Bursts are not affected.'),
        get: () => !!em.subStep,
        set: v => { em.subStep = v; AFX.touch(layer.id); }
    }));
    secE._body.appendChild(W.bursts({ layerId: layer.id, get: () => em.bursts }));
    secE._body.appendChild(W.num({
        label: 'Seed', min: 0, max: 9999, step: 1, int: true,
        get: () => em.seed, set: v => { em.seed = v; AFX.touch(layer.id); }
    }));
    bodyEl.appendChild(secE);

    // --- путь движения: анимируемая кривая как источник эмиссии и/или направляющая ---
    bodyEl.appendChild(pathSection(layer, reg));

    bodyEl.appendChild(particleSection(layer, pt, reg, L('Particle'), true));
    bodyEl.appendChild(rotationSection(layer, pt, reg, L('Rotation & Shape'), false));
    bodyEl.appendChild(physicsSection(layer, pt, reg, L('Physics'), false));

    // --- ветвление ---
    const br = em.branch;
    const secB = W.section(L('Branching'), br.chance > 0);
    secB._body.appendChild(W.num({
        label: L('Branch chance (per sec)'), min: 0, max: 30, step: 0.1, prec: 1,
        tip: L('Each particle may spawn a branch from its position'),
        get: () => br.chance, set: v => { br.chance = v; AFX.touch(layer.id); }
    }));
    secB._body.appendChild(W.num({
        label: L('Branch spread'), min: 0, max: 180, step: 2, unit: L('deg'),
        get: () => br.spread, set: v => { br.spread = v; AFX.touch(layer.id); }
    }));
    secB._body.appendChild(W.num({
        label: L('Branch life scale'), min: 0.05, max: 1, step: 0.02, prec: 2,
        get: () => br.lifeScale, set: v => { br.lifeScale = v; AFX.touch(layer.id); }
    }));
    secB._body.appendChild(W.num({
        label: L('Branch size scale'), min: 0.1, max: 1.5, step: 0.02, prec: 2,
        get: () => br.sizeScale, set: v => { br.sizeScale = v; AFX.touch(layer.id); }
    }));
    secB._body.appendChild(W.num({
        label: L('Branch speed scale'), min: 0.2, max: 2, step: 0.02, prec: 2,
        get: () => br.speedScale, set: v => { br.speedScale = v; AFX.touch(layer.id); }
    }));
    secB._body.appendChild(W.num({
        label: L('Max generations'), min: 1, max: 4, step: 1, int: true,
        tip: L('How deep branches can branch further'),
        get: () => br.maxGen, set: v => { br.maxGen = v; AFX.touch(layer.id); }
    }));
    bodyEl.appendChild(secB);

    bodyEl.appendChild(appearanceSection(layer, pt, reg, L('Appearance'), false));

    // --- суб-эмиттер: каждая частица сама эмиттер ---
    bodyEl.appendChild(subSection(layer, reg));
    if (em.sub.on) {
        const spt = em.sub.pt;
        bodyEl.appendChild(particleSection(layer, spt, reg, L('Sub particle'), true));
        bodyEl.appendChild(rotationSection(layer, spt, reg, L('Sub rotation & shape'), false));
        bodyEl.appendChild(physicsSection(layer, spt, reg, L('Sub physics'), false));
        bodyEl.appendChild(appearanceSection(layer, spt, reg, L('Sub appearance'), false));
    }
}

// ПУТЬ ДВИЖЕНИЯ: узлы (анимируемые пары треков x/y) + режимы эмиссии и ведения.
// Узлы правятся и в превью — драг за квадрат, Alt+клик по линии вставляет узел,
// дабл-клик по узлу удаляет (см. preview.js).
function pathSection(layer, reg) {
    // ленивый ремонт: у слоя из чужого/битого файла блока пути может не быть
    const pa = layer.em.path || (layer.em.path = AFX.Model.newPath());
    const sec = W.section(L('Motion Path'), !!pa.on);
    sec._body.appendChild(W.chk({
        label: L('Enable path'),
        tip: L('Animated path: particles are born along it and/or follow it (drag the nodes in the preview)'),
        get: () => pa.on,
        set: v => { pa.on = v; AFX.touch(layer.id); Insp.rebuild(); }
    }));
    if (!pa.on) return sec;
    const mode = pa.mode || 'emit';
    sec._body.appendChild(W.sel({
        label: L('Path mode'),
        tip: L('Emit — the emitter shape is replaced by the path; Guide — particles are pulled along it'),
        options: [['emit', L('Emit along path')], ['guide', L('Guide particles')], ['both', L('Emit and guide')]],
        get: () => mode,
        set: v => { pa.mode = v; AFX.touch(layer.id); Insp.rebuild(); }
    }));
    sec._body.appendChild(W.chk({
        label: L('Smooth curve'),
        tip: L('Catmull-Rom curve through the nodes (from 3 nodes) — off gives a straight polyline'),
        get: () => pa.smooth !== false,
        set: v => { pa.smooth = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.chk({
        label: L('Closed path'),
        get: () => !!pa.closed,
        set: v => { pa.closed = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(pathNodesUI(layer, pa, reg));

    if (mode === 'emit' || mode === 'both') {
        sec._body.appendChild(W.sel({
            label: L('Spawn along'),
            options: [['random', L('Random')], ['even', L('Even')], ['start', L('At path start')]],
            get: () => pa.along || 'random',
            set: v => { pa.along = v; AFX.touch(layer.id); }
        }));
        sec._body.appendChild(W.num({
            label: L('Spawn jitter'), min: 0, step: 1, unit: 'px',
            tip: L('Scatter of the birth point across the path'),
            track: tr(layer, pa, 'jitter'), reg: reg
        }));
        sec._body.appendChild(W.sel({
            label: L('Emit direction'),
            tip: L('Where the path aims new particles; the emitter Direction is used when this is off'),
            options: [['none', L('Use emitter direction')], ['tangent', L('Along the path')], ['normal', L('Across the path')]],
            get: () => pa.aim || 'none',
            set: v => { pa.aim = v; AFX.touch(layer.id); }
        }));
    }
    if (mode === 'guide' || mode === 'both') {
        sec._body.appendChild(W.num({
            label: L('Attract'), min: 0, max: 200, step: 0.5, prec: 2,
            tip: L('Spring pulling particles to the nearest point of the path (damped by Drag)'),
            track: tr(layer, pa, 'attract'), reg: reg
        }));
        sec._body.appendChild(W.num({
            label: L('Lock to path'), min: 0, max: 1, step: 0.02, prec: 2,
            tip: L('Hard follow: 1 — particles stick to the path and move only along it'),
            track: tr(layer, pa, 'lock'), reg: reg
        }));
        sec._body.appendChild(W.num({
            label: L('Flow speed'), step: 10, unit: L('px/s'),
            tip: L('Speed along the path tangent (negative — backwards)'),
            track: tr(layer, pa, 'flow'), reg: reg
        }));
        sec._body.appendChild(W.chk({
            label: L('Fast search'),
            tip: L('Look for the nearest point of the path next to the previous one — about 3x cheaper on rewind, same result on paths that do not cross themselves. Turn off for a strict global search.'),
            get: () => pa.fast !== false,
            set: v => { pa.fast = v; AFX.touch(layer.id); }
        }));
    }
    return sec;
}

function pathNodesUI(layer, pa, reg) {
    const box = h('div');
    box.appendChild(h('div', { cls: 'bursts-head' },
        h('span', { text: L('Nodes — offsets from the emitter position') })));
    pa.nodes.forEach((nd, i) => {
        const del = h('span', { cls: 'mini-btn', title: L('Delete node') }, D.icon('del'));
        del.addEventListener('click', function () {
            if (pa.nodes.length <= 2) return;
            AFX.pushUndo();
            pa.nodes.splice(i, 1);
            AFX.touch(layer.id);
            AFX.commitEnd();
            Insp.rebuild();
        });
        const head = h('div', { cls: 'bursts-row' },
            h('span', { cls: 'w-label', style: 'flex:1;', text: L('Node') + ' ' + (i + 1) }), del);
        box.appendChild(h('div', { cls: 'bursts-table' }, head));
        box.appendChild(W.num({ label: 'X', step: 2, track: tr(layer, nd, 'x'), reg: reg }));
        box.appendChild(W.num({ label: 'Y', step: 2, track: tr(layer, nd, 'y'), reg: reg }));
    });
    const add = h('button', { cls: 'mini-btn' }, D.icon('plus'), L('Node'));
    add.addEventListener('click', function () {
        AFX.pushUndo();
        const tl = Math.max(0, AFX.state.time - layer.start);
        const ns = pa.nodes;
        const last = ns[ns.length - 1], prev = ns[ns.length - 2] || last;
        const lx = AFX.Track.val(last.x, tl), ly = AFX.Track.val(last.y, tl);
        let dx = lx - AFX.Track.val(prev.x, tl), dy = ly - AFX.Track.val(prev.y, tl);
        if (Math.abs(dx) + Math.abs(dy) < 1) { dx = 80; dy = 0; }
        ns.push({ x: Math.round(lx + dx), y: Math.round(ly + dy) });
        AFX.touch(layer.id);
        AFX.commitEnd();
        Insp.rebuild();
    });
    box.appendChild(h('div', { cls: 'btn-row' }, add));
    return box;
}

// СЕКЦИИ БЛОКА ЧАСТИЦЫ — одни и те же для layer.pt и для em.sub.pt (дочерняя частица)
function particleSection(layer, pt, reg, title, open) {
    const secP = W.section(title, open);
    secP._body.appendChild(W.sel({
        label: L('Render'),
        options: [['sprite', L('Sprite')], ['trail', L('Trail (path line)')]],
        get: () => pt.render || 'sprite',
        set: v => { pt.render = v; AFX.touch(layer.id); AFX.Inspector.rebuild(); }
    }));
    if ((pt.render || 'sprite') === 'trail') {
        secP._body.appendChild(W.num({
            label: L('Trail core'), min: 0, max: 1, step: 0.02, prec: 2,
            tip: L('White core line on top of the trail (lightning)'),
            get: () => pt.trailCore, set: v => { pt.trailCore = v; AFX.touch(layer.id); }
        }));
    }
    secP._body.appendChild(W.sprite({
        label: L('Sprite'), layerId: layer.id,
        get: () => pt.sprite,
        set: ref => { pt.sprite = ref; }
    }));
    secP._body.appendChild(W.num({
        label: L('Life (s)'), min: 0.05, step: 0.02, prec: 2,
        get: () => pt.life, set: v => { pt.life = v; AFX.touch(layer.id); }
    }));
    secP._body.appendChild(W.num({
        label: L('Life random'), min: 0, max: 1, step: 0.02, prec: 2,
        get: () => pt.lifeRnd, set: v => { pt.lifeRnd = v; AFX.touch(layer.id); }
    }));
    secP._body.appendChild(W.num({ label: L('Size'), min: 1, step: 2, unit: 'px', track: tr(layer, pt, 'size'), reg: reg }));
    secP._body.appendChild(W.num({
        label: L('Size random'), min: 0, max: 1, step: 0.02, prec: 2,
        get: () => pt.sizeRnd, set: v => { pt.sizeRnd = v; AFX.touch(layer.id); }
    }));
    secP._body.appendChild(W.curve({ label: L('Size over life'), layerId: layer.id, curve: () => pt.sizeOL, yMax: 1.6 }));
    if ((pt.render || 'sprite') === 'trail') {
        secP._body.appendChild(W.curve({
            label: L('Size over trail'), layerId: layer.id, curve: () => pt.sizeOT, yMax: 1.6,
            tip: L('Width along the trail: 0 — start (base), 1 — tip')
        }));
    }
    secP._body.appendChild(W.curve({ label: L('Opacity over life'), layerId: layer.id, curve: () => pt.opacityOL, yMax: 1.1 }));
    secP._body.appendChild(W.grad({ label: L('Color over life'), layerId: layer.id, grad: () => pt.grad }));
    if (pt.sprite && pt.sprite.kind === 'tex') {
        secP._body.appendChild(W.chk({
            label: L('Tint texture'),
            get: () => pt.tintTex, set: v => { pt.tintTex = v; AFX.touch(layer.id); }
        }));
        secP._body.appendChild(W.num({
            label: L('Footage FPS'), min: 0, max: 120, step: 1, int: true, tip: L('0 — stretch frames over particle life'),
            get: () => pt.fps, set: v => { pt.fps = v; AFX.touch(layer.id); }
        }));
    }
    return secP;
}

// вращение и растяжение
function rotationSection(layer, pt, reg, title, open) {
    const secR = W.section(title, open);
    secR._body.appendChild(W.num({
        label: L('Rotation'), step: 2, unit: L('deg'),
        get: () => pt.rot, set: v => { pt.rot = v; AFX.touch(layer.id); }
    }));
    secR._body.appendChild(W.num({
        label: L('Random rotation'), min: 0, max: 1, step: 0.02, prec: 2,
        get: () => pt.rotRnd, set: v => { pt.rotRnd = v; AFX.touch(layer.id); }
    }));
    secR._body.appendChild(W.num({
        label: L('Spin (deg/s)'), step: 4,
        get: () => pt.spin, set: v => { pt.spin = v; AFX.touch(layer.id); }
    }));
    secR._body.appendChild(W.num({
        label: L('Spin random'), min: 0, max: 1, step: 0.02, prec: 2,
        get: () => pt.spinRnd, set: v => { pt.spinRnd = v; AFX.touch(layer.id); }
    }));
    secR._body.appendChild(W.chk({
        label: L('Align to velocity'),
        get: () => pt.alignVel, set: v => { pt.alignVel = v; AFX.touch(layer.id); }
    }));
    secR._body.appendChild(W.num({
        label: L('Stretch'), min: 0, max: 6, step: 0.05, prec: 2, tip: L('Stretch along velocity (motion blur)'),
        get: () => pt.stretch, set: v => { pt.stretch = v; AFX.touch(layer.id); }
    }));
    return secR;
}

// физика
function physicsSection(layer, pt, reg, title, open) {
    const secF = W.section(title, open);
    secF._body.appendChild(W.num({ label: L('Gravity X'), step: 4, track: tr(layer, pt, 'gravX'), reg: reg }));
    secF._body.appendChild(W.num({ label: L('Gravity Y'), step: 4, track: tr(layer, pt, 'gravY'), reg: reg }));
    secF._body.appendChild(W.num({
        label: L('Drag'), min: 0, max: 12, step: 0.05, prec: 2,
        get: () => pt.drag, set: v => { pt.drag = v; AFX.touch(layer.id); }
    }));
    secF._body.appendChild(W.sel({
        label: L('Turbulence type'),
        tip: L('Noise — independent wiggle per particle. Curl — a swirling field in world space: neighbours travel together, which is what makes flame tongues.'),
        options: [['noise', L('Noise (per particle)')], ['curl', L('Curl field (vortices)')]],
        get: () => pt.turbMode || 'noise',
        set: v => { pt.turbMode = v; AFX.touch(layer.id); AFX.Inspector.rebuild(); }
    }));
    secF._body.appendChild(W.num({ label: L('Turbulence'), min: 0, step: 4, track: tr(layer, pt, 'turbAmp'), reg: reg }));
    secF._body.appendChild(W.num({
        label: L('Turb. frequency'), min: 0.05, max: 12, step: 0.05, prec: 2,
        tip: L('How fast the field boils in place'),
        get: () => pt.turbFreq, set: v => { pt.turbFreq = v; AFX.touch(layer.id); }
    }));
    if ((pt.turbMode || 'noise') === 'curl') {
        secF._body.appendChild(W.num({
            label: L('Vortex size'), min: 4, max: 600, step: 4,
            tip: L('Eddy diameter in px — roughly the width of one flame tongue'),
            get: () => pt.turbScale == null ? 90 : pt.turbScale, set: v => { pt.turbScale = v; AFX.touch(layer.id); }
        }));
        secF._body.appendChild(W.num({
            label: L('Turb. octaves'), min: 1, max: 4, step: 1, int: true,
            tip: L('1 — one big stream; 3 — big stream plus fine shredding'),
            get: () => pt.turbOct || 1, set: v => { pt.turbOct = v; AFX.touch(layer.id); }
        }));
        secF._body.appendChild(W.num({
            label: L('Field rise (px/s)'), step: 10,
            tip: L('The field floats up with the plume. Best at 0.6-0.7 of the particle rise speed'),
            get: () => pt.turbRise || 0, set: v => { pt.turbRise = v; AFX.touch(layer.id); }
        }));
        secF._body.appendChild(W.num({
            label: L('Wind (px/s)'), step: 10,
            tip: L('The field as a medium velocity: drag pulls the particle toward the flow instead of kicking it. Needs Drag > 0.'),
            get: () => pt.turbWind || 0, set: v => { pt.turbWind = v; AFX.touch(layer.id); }
        }));
        secF._body.appendChild(W.num({
            label: L('Field seed'), min: 0, max: 999, step: 1, int: true,
            tip: L('Different value — a different field for the same design'),
            get: () => pt.turbSeed || 0, set: v => { pt.turbSeed = v; AFX.touch(layer.id); }
        }));
    }
    secF._body.appendChild(W.num({
        label: L('Laminar base'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: L('Ramps turbulence in over the particle life: 0 — full from birth, 1 — calm at the base, shredded at the tip'),
        get: () => pt.turbRamp || 0, set: v => { pt.turbRamp = v; AFX.touch(layer.id); }
    }));
    secF._body.appendChild(W.num({
        label: L('Zigzag (deg/s)'), min: 0, max: 2000, step: 10,
        tip: L('Per-step random kinks of the velocity direction (lightning)'),
        get: () => pt.zigzag, set: v => { pt.zigzag = v; AFX.touch(layer.id); }
    }));
    return secF;
}

// вид
function appearanceSection(layer, pt, reg, title, open) {
    const secV = W.section(title, open);
    secV._body.appendChild(W.num({
        label: L('Sprite squash'), min: 0, max: 1, step: 0.02, prec: 2, tip: L('How much camera compression flattens the particle sprite'),
        get: () => pt.squash, set: v => { pt.squash = v; AFX.touch(layer.id); }
    }));
    secV._body.appendChild(W.num({
        label: L('Glow'), min: 0, max: 3, step: 0.02, prec: 2, tip: L('Above 1 — extra additive passes'),
        get: () => pt.glow, set: v => { pt.glow = v; AFX.touch(layer.id); }
    }));
    secV._body.appendChild(W.num({
        label: L('Glow size'), min: 0.2, max: 4, step: 0.05, prec: 2,
        get: () => pt.glowSize, set: v => { pt.glowSize = v; AFX.touch(layer.id); }
    }));
    secV._body.appendChild(W.num({
        label: L('Glow softness'), min: 0.02, max: 0.6, step: 0.01, prec: 2, tip: L('Blur radius as a fraction of sprite size'),
        get: () => pt.glowBlur, set: v => { pt.glowBlur = v; AFX.touch(layer.id); }
    }));
    return secV;
}

// СУБ-ЭМИТТЕР: каждая частица слоя сама эмитит частицы блока em.sub.pt
function subSection(layer, reg) {
    const sub = layer.em.sub;
    const sec = W.section(L('Sub-emitter'), sub.on);
    sec._body.appendChild(W.chk({
        label: L('Enable sub-emitter'),
        tip: L('Every particle of this layer emits its own particles with their own sprite, curves and physics'),
        get: () => sub.on,
        set: v => { sub.on = v; AFX.touch(layer.id); AFX.Inspector.rebuild(); }
    }));
    if (!sub.on) return sec;

    sec._body.appendChild(W.sel({
        label: L('Emit'),
        options: [['death', L('At parent death')], ['life', L('Along parent life')], ['both', L('Both')]],
        get: () => sub.emit,
        set: v => { sub.emit = v; AFX.touch(layer.id); }
    }));
    if (sub.emit === 'life' || sub.emit === 'both') {
        sec._body.appendChild(W.num({
            label: L('Sub rate (per sec)'), min: 0, step: 2,
            tip: L('Per PARENT particle — the total load scales with the number of parents'),
            track: tr(layer, sub, 'rate'), reg: reg
        }));
        sec._body.appendChild(W.num({
            label: L('Start at (life)'), min: 0, max: 1, step: 0.02, prec: 2,
            tip: L('Fraction of the parent life before children start spawning'),
            get: () => sub.startAt, set: v => { sub.startAt = v; AFX.touch(layer.id); }
        }));
    }
    if (sub.emit === 'death' || sub.emit === 'both') {
        sec._body.appendChild(W.num({
            label: L('Count at death'), min: 0, max: 200, step: 1, int: true,
            tip: L('Burst emitted at the moment the parent dies'),
            get: () => sub.count, set: v => { sub.count = v; AFX.touch(layer.id); }
        }));
    }
    sec._body.appendChild(W.sel({
        label: L('Sub direction'),
        options: [['omni', L('Omni')], ['inherit', L('Along parent velocity')], ['back', L('Opposite parent velocity')], ['out', L('Away from emitter')]],
        get: () => sub.dir,
        set: v => { sub.dir = v; AFX.touch(layer.id); AFX.Inspector.rebuild(); }
    }));
    if (sub.dir !== 'omni') {
        sec._body.appendChild(W.num({
            label: L('Sub spread'), min: 0, max: 360, step: 2, unit: L('deg'),
            get: () => sub.spread, set: v => { sub.spread = v; AFX.touch(layer.id); }
        }));
    }
    sec._body.appendChild(W.num({ label: L('Sub speed'), min: 0, step: 4, unit: L('px/s'), track: tr(layer, sub, 'speed'), reg: reg }));
    sec._body.appendChild(W.num({
        label: L('Sub speed random'), min: 0, max: 1, step: 0.02, prec: 2,
        get: () => sub.speedRnd, set: v => { sub.speedRnd = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Inherit velocity'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: L('How much of the parent velocity is added to the child'),
        get: () => sub.inherit, set: v => { sub.inherit = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Max generations'), min: 1, max: 4, step: 1, int: true,
        tip: L('Above 1 children emit children too, reusing the same sub particle block'),
        get: () => sub.maxGen, set: v => { sub.maxGen = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Generation scale'), min: 0.05, max: 1, step: 0.02, prec: 2,
        tip: L('Size / life / rate multiplier applied to each deeper generation'),
        get: () => sub.genScale, set: v => { sub.genScale = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Sub budget'), min: 0, max: 5000, step: 50, int: true,
        tip: L('Hard cap on live child particles — over it new children are dropped'),
        get: () => sub.budget, set: v => { sub.budget = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.chk({
        label: L('Draw under parents'),
        get: () => sub.under, set: v => { sub.under = v; AFX.touch(layer.id); }
    }));
    return sec;
}

// POST_FX: слой-корректор над всем, что ниже по стеку. Размытие идёт по пикселям
// готового кадра, поэтому направление у него ОДНО на кадр — это не смаз каждой
// частицы по её скорости (для него есть pt.stretch / alignVel в блоке частицы).
function buildPostFx(layer, reg) {
    const fx = layer.fx;
    bodyEl.appendChild(commonSection(layer, reg));

    const secE = W.section(L('Post effect'), true);
    secE._body.appendChild(W.sel({
        label: L('Effect'),
        options: [['mblur', L('Motion blur')], ['displace', L('Turbulent displace')]],
        get: () => fx.effect || 'mblur',
        set: v => { fx.effect = v; AFX.touch(layer.id); Insp.rebuild(); }
    }));
    bodyEl.appendChild(secE);
    if ((fx.effect || 'mblur') === 'displace') return buildDisplace(layer, fx, reg);

    const sec = W.section(L('Motion blur'), true);
    sec._body.appendChild(W.sel({
        label: L('Mode'),
        tip: L('Directional — one smear angle for the whole frame; Radial — zoom and spin around a center'),
        options: [['directional', L('Directional')], ['radial', L('Radial (zoom / spin)')]],
        get: () => fx.mode,
        set: v => { fx.mode = v; AFX.touch(layer.id); Insp.rebuild(); }
    }));
    sec._body.appendChild(W.num({
        label: L('Length'), min: 0, max: 400, step: 1, unit: 'px',
        tip: fx.mode === 'radial' ? L('Zoom smear measured at the far corner of the frame (0 — off)') : L('Total smear length (0 — off)'),
        track: tr(layer, fx, 'length'), reg: reg
    }));
    if (fx.mode === 'radial') {
        sec._body.appendChild(W.num({
            label: L('Spin'), step: 1, unit: L('deg'), tip: L('Angular smear around the center'),
            track: tr(layer, fx, 'spin'), reg: reg
        }));
        sec._body.appendChild(W.num({ label: L('Center X'), step: 2, track: tr(layer, fx, 'x'), reg: reg }));
        sec._body.appendChild(W.num({ label: L('Center Y'), step: 2, track: tr(layer, fx, 'y'), reg: reg }));
    } else {
        sec._body.appendChild(W.num({ label: L('Angle'), step: 2, unit: L('deg'), track: tr(layer, fx, 'angle'), reg: reg }));
    }
    bodyEl.appendChild(sec);

    const secQ = W.section(L('Quality'), true);
    secQ._body.appendChild(W.sel({
        label: L('Samples'),
        tip: L('Samples are gathered by doubling passes: 16 samples cost 4 full-frame passes. Raise it if the smear looks stepped'),
        options: [['2', '2'], ['4', '4'], ['8', '8'], ['16', '16'], ['32', '32'], ['64', '64']],
        get: () => fx.samples,
        set: v => { fx.samples = +v; AFX.touch(layer.id); }
    }));
    secQ._body.appendChild(W.chk({
        label: L('Half resolution'),
        tip: L('Blur on a half-size buffer: 4x fewer pixels, slightly softer. Affects the exported atlas too'),
        get: () => fx.half,
        set: v => { fx.half = v; AFX.touch(layer.id); }
    }));
    bodyEl.appendChild(secQ);
}

// ИСКАЖЕНИЕ: кадр под слоем гнётся полем турбулентного шума. Мягкая масса частиц
// превращается в рваные языки — форму режет именно этот слой, а не спрайты.
function buildDisplace(layer, fx, reg) {
    const sec = W.section(L('Turbulent displace'), true);
    sec._body.appendChild(W.num({
        label: L('Amount'), min: 0, max: 300, step: 1, unit: 'px',
        tip: L('How far the frame is pushed. Layer opacity scales it — animate opacity to fade the distortion in'),
        track: tr(layer, fx, 'amount'), reg: reg
    }));
    sec._body.appendChild(W.sel({
        label: L('Field'),
        tip: L('Swirl — divergence-free: area is preserved, so the image is never torn into black holes. Tear — independent noise per axis: sharper rips, but it can punch voids in the mass'),
        options: [['swirl', L('Swirl (no holes)')], ['tear', L('Tear (sharper rips)')]],
        get: () => fx.field || 'swirl',
        set: v => { fx.field = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Fold size'), min: 4, max: 400, step: 2, unit: 'px',
        tip: L('Horizontal size of one fold — roughly the width of a flame tongue'),
        get: () => fx.scale, set: v => { fx.scale = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Fold stretch'), min: 0.2, max: 8, step: 0.1, prec: 2,
        tip: L('Vertical stretch of the folds. Fire wants 2-3: tall thin tongues, not round blobs'),
        get: () => fx.aspect, set: v => { fx.aspect = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Detail octaves'), min: 1, max: 4, step: 1, int: true,
        tip: L('1 — one big wave; 3 — big wave plus fine shredding'),
        get: () => fx.oct, set: v => { fx.oct = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Evolution (Hz)'), min: 0, max: 8, step: 0.05, prec: 2,
        tip: L('How fast the folds are reborn in place'),
        get: () => fx.evo, set: v => { fx.evo = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Field rise (px/s)'), step: 10,
        tip: L('The field floats up so the folds lick with the plume instead of standing still like wavy glass'),
        get: () => fx.rise, set: v => { fx.rise = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Field seed'), min: 0, max: 999, step: 1, int: true,
        get: () => fx.seed, set: v => { fx.seed = v; AFX.touch(layer.id); }
    }));
    bodyEl.appendChild(sec);

    const secB = W.section(L('Calm base'), true);
    secB._body.appendChild(W.num({
        label: L('Calm amount'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: L('Damps the distortion below the line so the flame stays welded to the ground'),
        get: () => fx.ramp, set: v => { fx.ramp = v; AFX.touch(layer.id); }
    }));
    secB._body.appendChild(W.num({
        label: L('Calm line Y'), step: 2, unit: 'px', track: tr(layer, fx, 'y0'), reg: reg
    }));
    secB._body.appendChild(W.num({
        label: L('Calm falloff'), min: 1, max: 600, step: 4, unit: 'px',
        tip: L('Distance below the line over which the damping reaches full strength'),
        get: () => fx.soft, set: v => { fx.soft = v; AFX.touch(layer.id); }
    }));
    bodyEl.appendChild(secB);
}

function buildSprite(layer, reg) {
    const sp = layer.sp;
    bodyEl.appendChild(commonSection(layer, reg));

    const secS = W.section(L('Sprite'), true);
    secS._body.appendChild(W.sprite({
        label: L('Source'), layerId: layer.id,
        get: () => sp.sprite,
        set: ref => { sp.sprite = ref; }
    }));
    secS._body.appendChild(W.num({
        label: L('Base size'), min: 2, step: 2, unit: 'px',
        get: () => sp.size, set: v => { sp.size = v; AFX.touch(layer.id); }
    }));
    if (sp.sprite && sp.sprite.kind === 'tex') {
        secS._body.appendChild(W.num({
            label: L('Footage FPS'), min: 0, max: 120, step: 1, int: true, tip: L('0 — stretch frames over layer duration'),
            get: () => sp.fps, set: v => { sp.fps = v; AFX.touch(layer.id); }
        }));
    }
    bodyEl.appendChild(secS);

    const secT = W.section(L('Transform'), true);
    secT._body.appendChild(W.num({ label: L('Position X'), step: 2, track: tr(layer, sp, 'x'), reg: reg }));
    secT._body.appendChild(W.num({ label: L('Position Y'), step: 2, track: tr(layer, sp, 'y'), reg: reg }));
    secT._body.appendChild(W.num({ label: L('Scale'), min: 0, step: 0.02, prec: 2, track: tr(layer, sp, 'scale'), reg: reg }));
    secT._body.appendChild(W.num({
        label: L('Aspect X/Y'), min: 0.1, max: 10, step: 0.02, prec: 2,
        get: () => sp.aspect, set: v => { sp.aspect = v; AFX.touch(layer.id); }
    }));
    secT._body.appendChild(W.num({ label: L('Rotation'), step: 2, unit: L('deg'), track: tr(layer, sp, 'rot'), reg: reg }));
    bodyEl.appendChild(secT);

    const secC = W.section(L('Color & Look'), true);
    secC._body.appendChild(W.colorTrack({ label: L('Color'), track: tr(layer, sp, 'color'), reg: reg }));
    secC._body.appendChild(W.num({
        label: L('Sprite squash'), min: 0, max: 1, step: 0.02, prec: 2, tip: L('How much camera compression flattens the sprite (1 — lying on the ground)'),
        get: () => sp.squash, set: v => { sp.squash = v; AFX.touch(layer.id); }
    }));
    secC._body.appendChild(W.num({ label: L('Glow'), min: 0, max: 3, step: 0.02, prec: 2, track: tr(layer, sp, 'glow'), reg: reg }));
    secC._body.appendChild(W.num({
        label: L('Glow size'), min: 0.2, max: 4, step: 0.05, prec: 2,
        get: () => sp.glowSize, set: v => { sp.glowSize = v; AFX.touch(layer.id); }
    }));
    secC._body.appendChild(W.num({
        label: L('Glow softness'), min: 0.02, max: 0.6, step: 0.01, prec: 2, tip: L('Blur radius as a fraction of sprite size'),
        get: () => sp.glowBlur, set: v => { sp.glowBlur = v; AFX.touch(layer.id); }
    }));
    bodyEl.appendChild(secC);
}

// ATLAS-слой: те же настройки, что у спрайта, но источник — только лист-текстура,
// без выбора фигуры и без мёртвых для текстур регуляторов (тонировка/свечение спрайта)
function buildAtlas(layer, reg) {
    const sp = layer.sp;
    bodyEl.appendChild(commonSection(layer, reg));

    const secS = W.section(L('Atlas'), true);
    const info = h('div', { cls: 'atlas-info' });
    const curTexId = function () {
        const ref = sp.sprite;
        return (ref && ref.kind === 'tex') ? ref.texId : null;
    };
    const syncInfo = function () {
        const tex = curTexId() ? AFX.Sprites.texs.get(curTexId()) : null;
        info.className = 'atlas-info';
        if (!tex) {
            info.className = 'atlas-info warn';
            info.textContent = L('No sheet selected — pick a texture or import one.');
            return;
        }
        const sh = tex.sheet;
        if (!sh) {
            info.className = 'atlas-info warn';
            info.textContent = tex.img.width + '×' + tex.img.height + '  ·  ' + L('no grid on this texture — press Grid');
            return;
        }
        const cols = Math.max(1, sh.cols | 0), rows = Math.max(1, sh.rows | 0);
        info.textContent = cols + '×' + rows + '  ·  ' + (cols * rows) + ' ' + L('frames')
            + '  ·  ' + L('cell') + ' ' + Math.round(tex.img.width / cols) + '×' + Math.round(tex.img.height / rows)
            + '  ·  ' + (sp.fps > 0 ? sp.fps + ' fps (' + L('loops') + ')' : L('stretched over the layer window'));
    };
    secS._body.appendChild(W.sprite({
        label: L('Sheet'), layerId: layer.id, texOnly: true,
        get: () => sp.sprite,
        set: ref => { sp.sprite = ref; AFX.Ops.fitAtlasFrame(AFX.state.doc, layer, false); syncInfo(); }
    }));
    secS._body.appendChild(info);

    const btns = h('div', { cls: 'btn-row' });
    const bImp = h('button', { cls: 'tb', text: L('Choose sheet...') });
    bImp.addEventListener('click', function () {
        AFX.TexturesPanel.openAtlasPicker({ accept: function (id) {
            AFX.pushUndo();
            sp.sprite = { kind: 'tex', texId: id };
            AFX.Ops.fitAtlasFrame(AFX.state.doc, layer, false);
            AFX.touch(layer.id);
            AFX.commitEnd();
            Insp.rebuild();
        } });
    });
    const bGrid = h('button', { cls: 'tb', text: L('Grid') });
    bGrid.addEventListener('click', function () {
        const id = curTexId();
        if (!id) return;
        AFX.TexturesPanel.editSheet(id, function () {
            AFX.Ops.fitAtlasFrame(AFX.state.doc, layer, false);
            AFX.touch(layer.id);
            Insp.rebuild();
        });
    });
    btns.appendChild(bImp);
    btns.appendChild(bGrid);
    secS._body.appendChild(btns);

    secS._body.appendChild(W.num({
        label: L('Frame size'), min: 2, step: 2, unit: 'px', tip: L('On-screen size of one frame (its longer side)'),
        get: () => sp.size, set: v => { sp.size = v; AFX.touch(layer.id); }
    }));
    secS._body.appendChild(W.num({
        label: L('Footage FPS'), min: 0, max: 120, step: 1, int: true,
        tip: L('0 — stretch frames over layer duration'),
        get: () => sp.fps, set: v => { sp.fps = v; AFX.touch(layer.id); syncInfo(); }
    }));
    bodyEl.appendChild(secS);
    syncInfo();

    const secT = W.section(L('Transform'), true);
    secT._body.appendChild(W.num({ label: L('Position X'), step: 2, track: tr(layer, sp, 'x'), reg: reg }));
    secT._body.appendChild(W.num({ label: L('Position Y'), step: 2, track: tr(layer, sp, 'y'), reg: reg }));
    secT._body.appendChild(W.num({ label: L('Scale'), min: 0, step: 0.02, prec: 2, track: tr(layer, sp, 'scale'), reg: reg }));
    secT._body.appendChild(W.num({
        label: L('Aspect X/Y'), min: 0.1, max: 10, step: 0.02, prec: 2,
        get: () => sp.aspect, set: v => { sp.aspect = v; AFX.touch(layer.id); }
    }));
    secT._body.appendChild(W.num({ label: L('Rotation'), step: 2, unit: L('deg'), track: tr(layer, sp, 'rot'), reg: reg }));
    secT._body.appendChild(W.num({
        label: L('Sprite squash'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: L('How much camera compression flattens the sprite (1 — lying on the ground)'),
        get: () => sp.squash, set: v => { sp.squash = v; AFX.touch(layer.id); }
    }));
    bodyEl.appendChild(secT);
}

})();
