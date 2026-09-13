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
    else if (layer.type === 'force') buildForce(layer, reg);
    else buildSprite(layer, reg);
};

// трек-дескриптор
function tr(layer, obj, key) { return { layer: layer, obj: obj, key: key }; }

const BLEND_OPTS = [['normal', 'Normal'], ['add', 'Add (lighter)'], ['screen', 'Screen'], ['multiply', 'Multiply']];

function commonSection(layer, reg) {
    // слои-корректоры (постэффект, силовое поле) ничего своего не рисуют: смешивание,
    // свечение и затухание слоя для них мертвы, а opacity работает силой
    // (см. Model.newPostFx / Model.newForce)
    const isFx = layer.type === 'postfx';
    const isFF = layer.type === 'force';
    const sec = W.section(L('Layer'), true);
    if (!isFx && !isFF) sec._body.appendChild(W.sel({
        label: L('Blend'),
        tip: L('How the layer mixes with the layers below: Add and Screen brighten, Multiply darkens'),
        options: BLEND_OPTS.map(o => [o[0], L(o[1])]),
        get: () => layer.blend,
        set: v => { layer.blend = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: isFF ? L('Master strength') : (isFx ? L('Effect strength') : L('Opacity')),
        min: 0, max: 1, step: 0.02, prec: 2,
        tip: isFF ? L('Common multiplier for every field of this layer (0 — bypass). Animate it to fade the forces in')
            : (isFx ? L('Mix of the processed frame with the clean one (0 — bypass)')
                : L('Layer opacity multiplier; animate it to fade the whole layer in or out')),
        track: tr(layer, layer, 'opacity'), reg: reg
    }));
    if (isFx || isFF) {
        sec._body.appendChild(W.num({
            label: L('Start (s)'), step: 0.02, prec: 2,
            tip: L('When the layer window opens, in seconds; moving it keeps the window length'),
            get: () => layer.start,
            set: v => { const len = layer.end - layer.start; layer.start = v; layer.end = v + len; AFX.touch(layer.id); }
        }));
        sec._body.appendChild(W.num({
            label: L('End (s)'), step: 0.02, prec: 2,
            tip: L('When the layer window closes, in seconds — the end of the bar on the timeline'),
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
        tip: L('Blur radius of the layer glow in pixels — larger means a wider, softer halo'),
        get: () => layer.glowLR, set: v => { layer.glowLR = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.chk({
        label: L('Radial fade'),
        tip: L('Fade the whole layer by distance from a movable center (drag the orange gizmo in the preview)'),
        get: () => layer.fadeOn,
        set: v => { layer.fadeOn = v; AFX.touch(layer.id); AFX.Inspector.rebuild(); }
    }));
    if (layer.fadeOn) {
        sec._body.appendChild(W.num({
            label: L('Fade X'), step: 2, track: tr(layer, layer, 'fadeX'), reg: reg,
            tip: L('Horizontal position of the fade center, px from the composition center')
        }));
        sec._body.appendChild(W.num({
            label: L('Fade Y'), step: 2, track: tr(layer, layer, 'fadeY'), reg: reg,
            tip: L('Vertical position of the fade center, px from the composition center')
        }));
        sec._body.appendChild(W.num({
            label: L('Fade radius'), min: 4, step: 2, unit: 'px', track: tr(layer, layer, 'fadeR'), reg: reg,
            tip: L('Distance from the center at which the layer fades out completely')
        }));
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
        tip: layer.type === 'emitter' ? L('When the emitter stops spawning; live particles still finish their life')
            : L('When the layer window closes, in seconds — the end of the bar on the timeline'),
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
        tip: L('Where particles are born: a point, inside an ellipse, on a ring, inside a box or along a line'),
        options: [['point', L('Point')], ['circle', L('Circle / Ellipse')], ['ring', L('Ring')], ['box', L('Box')], ['line', L('Line')]],
        get: () => em.shape,
        set: v => { em.shape = v; AFX.touch(layer.id); }
    }));
    secE._body.appendChild(W.num({
        label: L('Position X'), step: 2, track: tr(layer, em, 'x'), reg: reg,
        tip: L('Horizontal position, px from the composition center (positive is right)')
    }));
    secE._body.appendChild(W.num({
        label: L('Position Y'), step: 2, track: tr(layer, em, 'y'), reg: reg,
        tip: L('Vertical position, px from the composition center (positive is down)')
    }));
    secE._body.appendChild(W.num({
        label: L('Size X'), min: 0, step: 2, track: tr(layer, em, 'sx'), reg: reg,
        tip: L('Shape radius or half-width; for a ring — its radius, for a line — half its length')
    }));
    secE._body.appendChild(W.num({
        label: L('Size Y'), min: 0, step: 2, track: tr(layer, em, 'sy'), reg: reg,
        tip: L('Shape half-height; for a ring — the thickness of its band')
    }));
    secE._body.appendChild(W.sel({
        label: L('Direction'),
        tip: L('Launch direction: away from the center, toward it, any way, or by Angle within the spread'),
        options: [['out', L('Outward')], ['in', L('Inward')], ['omni', L('Omni')], ['dir', L('By angle')]],
        get: () => em.dir,
        set: v => { em.dir = v; AFX.touch(layer.id); }
    }));
    secE._body.appendChild(W.num({
        label: L('Angle'), step: 2, unit: L('deg'), track: tr(layer, em, 'angle'), reg: reg,
        tip: L('Launch angle for the By angle direction, also tilts the Line shape: 0 — right, 90 — down')
    }));
    secE._body.appendChild(W.num({
        label: L('Angle spread'), min: 0, max: 360, step: 2, unit: L('deg'), track: tr(layer, em, 'spread'), reg: reg,
        tip: L('Width of the random cone around the launch angle, in degrees (360 — full circle)')
    }));
    secE._body.appendChild(W.num({
        label: L('Speed'), min: 0, step: 4, unit: L('px/s'), track: tr(layer, em, 'speed'), reg: reg,
        tip: L('Launch speed of new particles in pixels per second')
    }));
    secE._body.appendChild(W.num({
        label: L('Speed random'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: L('Random speed spread per particle: 0.5 gives from 50% to 150% of Speed'),
        get: () => em.speedRnd, set: v => { em.speedRnd = v; AFX.touch(layer.id); }
    }));
    secE._body.appendChild(W.num({
        label: L('Rate (per sec)'), min: 0, step: 2, track: tr(layer, em, 'rate'), reg: reg,
        tip: L('Particles born per second while the emission window is open')
    }));
    secE._body.appendChild(W.chk({
        label: L('Smooth emission'),
        tip: L('Spawn each particle at its exact moment inside a step — removes rows behind fast emitters'),
        get: () => !!em.subStep,
        set: v => { em.subStep = v; AFX.touch(layer.id); }
    }));
    secE._body.appendChild(W.bursts({ layerId: layer.id, get: () => em.bursts }));
    secE._body.appendChild(W.num({
        label: L('Seed'), min: 0, max: 9999, step: 1, int: true,
        tip: L('Random seed: another value gives a new particle layout with the same settings'),
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
        tip: L('Largest angle between a branch and the direction of its parent, in degrees'),
        get: () => br.spread, set: v => { br.spread = v; AFX.touch(layer.id); }
    }));
    secB._body.appendChild(W.num({
        label: L('Branch life scale'), min: 0.05, max: 1, step: 0.02, prec: 2,
        tip: L('Branch lifetime as a fraction of the remaining life of its parent'),
        get: () => br.lifeScale, set: v => { br.lifeScale = v; AFX.touch(layer.id); }
    }));
    secB._body.appendChild(W.num({
        label: L('Branch size scale'), min: 0.1, max: 1.5, step: 0.02, prec: 2,
        tip: L('Branch size as a fraction of the size of its parent'),
        get: () => br.sizeScale, set: v => { br.sizeScale = v; AFX.touch(layer.id); }
    }));
    secB._body.appendChild(W.num({
        label: L('Branch speed scale'), min: 0.2, max: 2, step: 0.02, prec: 2,
        tip: L('Branch speed as a fraction of the speed of its parent'),
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
        tip: L('Connect the last node back to the first one, closing the path into a loop'),
        get: () => !!pa.closed,
        set: v => { pa.closed = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(pathNodesUI(layer, pa, reg));

    if (mode === 'emit' || mode === 'both') {
        sec._body.appendChild(W.sel({
            label: L('Spawn along'),
            tip: L('How births spread along the path: at random, evenly spaced, or all at its start'),
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
            tip: L('Look for the nearest path point near the last one: about 3x faster; turn off if the path crosses itself'),
            get: () => pa.fast !== false,
            set: v => { pa.fast = v; AFX.touch(layer.id); }
        }));
    }
    return sec;
}

function pathNodesUI(layer, pa, reg) {
    const box = h('div');
    box.appendChild(h('div', { cls: 'bursts-head', tip: L('Path nodes: offsets from the emitter position; X and Y of each can be animated') },
        h('span', { text: L('Nodes — offsets from the emitter position') })));
    pa.nodes.forEach((nd, i) => {
        const del = h('span', { cls: 'mini-btn', tip: L('Delete this node (a path always keeps at least two)') }, D.icon('del'));
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
        box.appendChild(W.num({
            label: 'X', step: 2, track: tr(layer, nd, 'x'), reg: reg,
            tip: L('Node offset from the emitter position along X, px; you can also drag the node in the preview')
        }));
        box.appendChild(W.num({
            label: 'Y', step: 2, track: tr(layer, nd, 'y'), reg: reg,
            tip: L('Node offset from the emitter position along Y, px; you can also drag the node in the preview')
        }));
    });
    const add = h('button', { cls: 'mini-btn', tip: L('Add a node after the last one, continuing the direction of the path') }, D.icon('plus'), L('Node'));
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
        tip: L('Draw each particle as a sprite, or as a trail line along the path it has travelled'),
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
        tip: L('Particle image: a procedural shape or an imported texture — click to choose'),
        get: () => pt.sprite,
        set: ref => { pt.sprite = ref; }
    }));
    secP._body.appendChild(W.num({
        label: L('Life (s)'), min: 0.05, step: 0.02, prec: 2,
        tip: L('How long each particle lives, in seconds'),
        get: () => pt.life, set: v => { pt.life = v; AFX.touch(layer.id); }
    }));
    secP._body.appendChild(W.num({
        label: L('Life random'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: L('Random lifetime spread per particle: 0.5 gives from 50% to 150% of Life'),
        get: () => pt.lifeRnd, set: v => { pt.lifeRnd = v; AFX.touch(layer.id); }
    }));
    secP._body.appendChild(W.num({
        label: L('Size'), min: 1, step: 2, unit: 'px', track: tr(layer, pt, 'size'), reg: reg,
        tip: L('Particle size at birth in pixels; the Size over life curve scales it')
    }));
    secP._body.appendChild(W.num({
        label: L('Size random'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: L('Random size spread per particle: 0.5 gives from 50% to 150% of Size'),
        get: () => pt.sizeRnd, set: v => { pt.sizeRnd = v; AFX.touch(layer.id); }
    }));
    secP._body.appendChild(W.curve({
        label: L('Size over life'), layerId: layer.id, curve: () => pt.sizeOL, yMax: 1.6,
        tip: L('Size multiplier over the particle life: the left edge is birth, the right edge is death')
    }));
    if ((pt.render || 'sprite') === 'trail') {
        secP._body.appendChild(W.curve({
            label: L('Size over trail'), layerId: layer.id, curve: () => pt.sizeOT, yMax: 1.6,
            tip: L('Width along the trail: 0 — start (base), 1 — tip')
        }));
    }
    secP._body.appendChild(W.curve({
        label: L('Opacity over life'), layerId: layer.id, curve: () => pt.opacityOL, yMax: 1.1,
        tip: L('Opacity over the particle life: the left edge is birth, the right edge is death')
    }));
    secP._body.appendChild(W.grad({
        label: L('Color over life'), layerId: layer.id, grad: () => pt.grad,
        tip: L('Particle color over its life: the left end at birth, the right end at death')
    }));
    if (pt.sprite && pt.sprite.kind === 'tex') {
        secP._body.appendChild(W.chk({
            label: L('Tint texture'),
            tip: L('Color the texture by Color over life instead of its own colors (not for footage sheets)'),
            get: () => pt.tintTex, set: v => { pt.tintTex = v; AFX.touch(layer.id); }
        }));
        secP._body.appendChild(W.num({
            label: L('Footage FPS'), min: 0, max: 120, step: 1, int: true,
            tip: L('Frame rate of a footage texture per particle; 0 stretches all frames over its life'),
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
        tip: L('Starting rotation of each particle, in degrees'),
        get: () => pt.rot, set: v => { pt.rot = v; AFX.touch(layer.id); }
    }));
    secR._body.appendChild(W.num({
        label: L('Random rotation'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: L('Random start rotation: 1 — any angle, 0.5 — within ±90° of Rotation'),
        get: () => pt.rotRnd, set: v => { pt.rotRnd = v; AFX.touch(layer.id); }
    }));
    secR._body.appendChild(W.num({
        label: L('Spin (deg/s)'), step: 4,
        tip: L('Rotation speed of each particle in degrees per second (negative spins the other way)'),
        get: () => pt.spin, set: v => { pt.spin = v; AFX.touch(layer.id); }
    }));
    secR._body.appendChild(W.num({
        label: L('Spin random'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: L('Random spin spread per particle: 1 gives from zero to double the Spin'),
        get: () => pt.spinRnd, set: v => { pt.spinRnd = v; AFX.touch(layer.id); }
    }));
    secR._body.appendChild(W.chk({
        label: L('Align to velocity'),
        tip: L('Turn each particle to face its direction of motion instead of using rotation and spin'),
        get: () => pt.alignVel, set: v => { pt.alignVel = v; AFX.touch(layer.id); }
    }));
    secR._body.appendChild(W.num({
        label: L('Stretch'), min: 0, max: 6, step: 0.05, prec: 2,
        tip: L('Elongate particles along their velocity — faster ones stretch more (motion blur)'),
        get: () => pt.stretch, set: v => { pt.stretch = v; AFX.touch(layer.id); }
    }));
    return secR;
}

// физика
function physicsSection(layer, pt, reg, title, open) {
    const secF = W.section(title, open);
    secF._body.appendChild(W.num({
        label: L('Gravity X'), step: 4, track: tr(layer, pt, 'gravX'), reg: reg,
        tip: L('Constant horizontal acceleration in px/s² (positive pulls right)')
    }));
    secF._body.appendChild(W.num({
        label: L('Gravity Y'), step: 4, track: tr(layer, pt, 'gravY'), reg: reg,
        tip: L('Constant vertical acceleration in px/s² (positive pulls down)')
    }));
    secF._body.appendChild(W.num({
        label: L('Drag'), min: 0, max: 12, step: 0.05, prec: 2,
        tip: L('Air resistance: how quickly particles lose speed (0 — none)'),
        get: () => pt.drag, set: v => { pt.drag = v; AFX.touch(layer.id); }
    }));
    secF._body.appendChild(W.sel({
        label: L('Turbulence type'),
        tip: L('Noise — own wiggle per particle; Curl — a swirling field shared by neighbours (flame tongues)'),
        options: [['noise', L('Noise (per particle)')], ['curl', L('Curl field (vortices)')]],
        get: () => pt.turbMode || 'noise',
        set: v => { pt.turbMode = v; AFX.touch(layer.id); AFX.Inspector.rebuild(); }
    }));
    secF._body.appendChild(W.num({
        label: L('Turbulence'), min: 0, step: 4, track: tr(layer, pt, 'turbAmp'), reg: reg,
        tip: L('Strength of the turbulent push in px/s² — how hard the particles are shaken')
    }));
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
        label: L('Glow'), min: 0, max: 3, step: 0.02, prec: 2,
        tip: L('Additive glow halo around each particle; above 1 adds extra passes (not for textures)'),
        get: () => pt.glow, set: v => { pt.glow = v; AFX.touch(layer.id); }
    }));
    secV._body.appendChild(W.num({
        label: L('Glow size'), min: 0.2, max: 4, step: 0.05, prec: 2,
        tip: L('Size of the glow halo relative to the sprite size'),
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
        tip: L('When children are born: all at once as the parent dies, steadily during its life, or both'),
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
        tip: L('Where children fly: any way, along the motion of the parent, against it, or away from the emitter'),
        options: [['omni', L('Omni')], ['inherit', L('Along parent velocity')], ['back', L('Opposite parent velocity')], ['out', L('Away from emitter')]],
        get: () => sub.dir,
        set: v => { sub.dir = v; AFX.touch(layer.id); AFX.Inspector.rebuild(); }
    }));
    if (sub.dir !== 'omni') {
        sec._body.appendChild(W.num({
            label: L('Sub spread'), min: 0, max: 360, step: 2, unit: L('deg'),
            tip: L('Width of the random cone around the sub direction, in degrees'),
            get: () => sub.spread, set: v => { sub.spread = v; AFX.touch(layer.id); }
        }));
    }
    sec._body.appendChild(W.num({
        label: L('Sub speed'), min: 0, step: 4, unit: L('px/s'), track: tr(layer, sub, 'speed'), reg: reg,
        tip: L('Launch speed of child particles in pixels per second')
    }));
    sec._body.appendChild(W.num({
        label: L('Sub speed random'), min: 0, max: 1, step: 0.02, prec: 2,
        tip: L('Random speed spread per child: 0.5 gives from 50% to 150% of Sub speed'),
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
        tip: L('Draw the child particles beneath their parents instead of on top of them'),
        get: () => sub.under, set: v => { sub.under = v; AFX.touch(layer.id); }
    }));
    return sec;
}

// АДРЕСАЦИЯ слоя-корректора: пусто — всё, что ниже по стеку (как было всегда),
// отмеченные слои сужают выбор. У адресованного постэффекта появляется блендинг
// ГРУППЫ: адресаты рисуются в изолированный оффскрин и композитятся на месте
// корректора, поэтому аддитивным слоям нужен Add (см. Engine.postGroups).
function targetsSection(layer, kinds, groupBlend) {
    const sec = W.section(L('Affected layers'), true);
    sec._body.appendChild(W.targets({
        layer: layer, kinds: kinds,
        tip: L('Nothing checked — every matching layer below. Check layers to narrow it down'),
        onToggleEmpty: function () { Insp.rebuild(); }
    }));
    if (groupBlend && layer.targets && layer.targets.length) {
        sec._body.appendChild(W.sel({
            label: L('Group blend'),
            tip: L('How the processed group composites back into the stack: the picked layers are isolated, so additive ones need Add'),
            options: BLEND_OPTS.map(o => [o[0], L(o[1])]),
            get: () => layer.blend,
            set: v => { layer.blend = v; AFX.touch(layer.id); }
        }));
    }
    return sec;
}

// СИЛОВОЕ ПОЛЕ: слой-корректор ФИЗИКИ. Ускорения добавляются внутри симуляции
// эмиттеров-адресатов, поэтому частицы реально огибают поле; пикселей слой не трогает.
const FORCE_MODES = [
    ['collapse', 'Collapse (pull in)'],
    ['expand', 'Expand (push out)'],
    ['drive', 'Drive (orbit)']
];
const FORCE_SHORT = { collapse: 'Collapse', expand: 'Expand', drive: 'Drive' };

function buildForce(layer, reg) {
    const ff = layer.ff;
    bodyEl.appendChild(commonSection(layer, reg));
    bodyEl.appendChild(targetsSection(layer, ['emitter'], false));

    ff.fields.forEach((f, i) => bodyEl.appendChild(forceFieldSection(layer, ff, f, i, reg)));
    if (!ff.fields.length) {
        bodyEl.appendChild(h('div', { cls: 'layers-empty', text: L('No fields — the layer does nothing.') }));
    }
    const add = h('button', { cls: 'mini-btn', style: 'margin:6px;', tip: L('Add one more radial field to this layer (Collapse by default)') }, D.icon('plus'), L('Force field'));
    add.addEventListener('click', function () {
        AFX.pushUndo();
        ff.fields.push(AFX.Model.newForceField('collapse'));
        AFX.touch(layer.id);
        AFX.commitEnd();
        Insp.rebuild();
    });
    bodyEl.appendChild(add);
}

function forceFieldSection(layer, ff, f, i, reg) {
    const sec = W.section(L('Field') + ' ' + (i + 1) + ' — ' + L(FORCE_SHORT[f.mode] || f.mode), true);
    sec._body.appendChild(W.chk({
        label: L('Enabled'),
        tip: L('Turn this field on or off without deleting it'),
        get: () => f.on !== false,
        set: v => { f.on = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.sel({
        label: L('Type'),
        tip: L('Collapse pulls to the center, Expand pushes away, Drive swirls around; negative strength flips it'),
        options: FORCE_MODES.map(o => [o[0], L(o[1])]),
        get: () => f.mode,
        set: v => { f.mode = v; AFX.touch(layer.id); Insp.rebuild(); }
    }));
    sec._body.appendChild(W.num({
        label: L('Strength'), step: 10, unit: L('px/s²'),
        tip: L('Acceleration at the center of the field. Negative reverses the direction'),
        track: tr(layer, f, 'strength'), reg: reg
    }));
    sec._body.appendChild(W.num({
        label: L('Falloff'), min: 0, max: 8, step: 0.1, prec: 2,
        tip: L('How fast the force dies toward the edge: 0 — flat field with a hard rim, 1 — linear, 3+ — a narrow core'),
        get: () => f.falloff, set: v => { f.falloff = v; AFX.touch(layer.id); }
    }));
    sec._body.appendChild(W.num({
        label: L('Position X'), step: 2, track: tr(layer, f, 'x'), reg: reg,
        tip: L('Field center, px from the composition center; you can drag the field in the preview')
    }));
    sec._body.appendChild(W.num({
        label: L('Position Y'), step: 2, track: tr(layer, f, 'y'), reg: reg,
        tip: L('Field center, px from the composition center; you can drag the field in the preview')
    }));
    sec._body.appendChild(W.num({
        label: L('Scale X'), min: 1, step: 4, unit: 'px',
        tip: L('Half-width of the area of effect: outside the ellipse the force is exactly zero'),
        track: tr(layer, f, 'sx'), reg: reg
    }));
    sec._body.appendChild(W.num({
        label: L('Scale Y'), min: 1, step: 4, unit: 'px', track: tr(layer, f, 'sy'), reg: reg,
        tip: L('Half-height of the area of effect in px; on screen the camera compression flattens it')
    }));

    const del = h('button', { cls: 'mini-btn', style: 'margin:4px 0;', tip: L('Delete this field from the force layer') }, D.icon('del'), L('Delete field'));
    del.addEventListener('click', function () {
        AFX.pushUndo();
        ff.fields.splice(i, 1);
        AFX.touch(layer.id);
        AFX.commitEnd();
        Insp.rebuild();
    });
    sec._body.appendChild(del);
    return sec;
}

// POST_FX: слой-корректор над всем, что ниже по стеку. Размытие идёт по пикселям
// готового кадра, поэтому направление у него ОДНО на кадр — это не смаз каждой
// частицы по её скорости (для него есть pt.stretch / alignVel в блоке частицы).
function buildPostFx(layer, reg) {
    const fx = layer.fx;
    bodyEl.appendChild(commonSection(layer, reg));
    bodyEl.appendChild(targetsSection(layer, ['emitter', 'sprite', 'atlas'], true));

    const secE = W.section(L('Post effect'), true);
    secE._body.appendChild(W.sel({
        label: L('Effect'),
        tip: L('Which post effect processes the layers below: motion blur, turbulent displace or pixel art'),
        options: [['mblur', L('Motion blur')], ['displace', L('Turbulent displace')], ['pixelate', L('Pixel art')]],
        get: () => fx.effect || 'mblur',
        set: v => { fx.effect = v; AFX.touch(layer.id); Insp.rebuild(); }
    }));
    bodyEl.appendChild(secE);
    if ((fx.effect || 'mblur') === 'displace') return buildDisplace(layer, fx, reg);
    if (fx.effect === 'pixelate') return buildPixelate(layer, fx, reg);

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
        tip: fx.mode === 'radial' ? L('Zoom smear measured at the far corner of the frame (0 — off)')
            : L('Total smear length in pixels along the blur angle (0 — off)'),
        track: tr(layer, fx, 'length'), reg: reg
    }));
    if (fx.mode === 'radial') {
        sec._body.appendChild(W.num({
            label: L('Spin'), step: 1, unit: L('deg'), tip: L('Angular smear around the center'),
            track: tr(layer, fx, 'spin'), reg: reg
        }));
        sec._body.appendChild(W.num({
            label: L('Center X'), step: 2, track: tr(layer, fx, 'x'), reg: reg,
            tip: L('Center of the radial blur, px from the composition center; drag it in the preview')
        }));
        sec._body.appendChild(W.num({
            label: L('Center Y'), step: 2, track: tr(layer, fx, 'y'), reg: reg,
            tip: L('Center of the radial blur, px from the composition center; drag it in the preview')
        }));
    } else {
        sec._body.appendChild(W.num({
            label: L('Angle'), step: 2, unit: L('deg'), track: tr(layer, fx, 'angle'), reg: reg,
            tip: L('Direction of the smear in degrees: 0 — horizontal, 90 — vertical')
        }));
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
        tip: L('Swirl keeps the area, so no black holes appear; Tear rips sharper but can punch voids in the mass'),
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
        tip: L('Different value — a different field for the same design'),
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
        label: L('Calm line Y'), step: 2, unit: 'px', track: tr(layer, fx, 'y0'), reg: reg,
        tip: L('Height of the calm line, px from the composition center; below it the distortion is damped')
    }));
    secB._body.appendChild(W.num({
        label: L('Calm falloff'), min: 1, max: 600, step: 4, unit: 'px',
        tip: L('Distance below the line over which the damping reaches full strength'),
        get: () => fx.soft, set: v => { fx.soft = v; AFX.touch(layer.id); }
    }));
    bodyEl.appendChild(secB);
}

// ПИКСЕЛЬ-АРТ: разрешение задаёт только сетку, а «настоящий пиксель» делают
// отдельные секции — выборка блока, квантование альфы, квантование цвета и обводка.
// Простой downscale даёт мыльную полупрозрачную кромку и неровные блоки; именно
// поэтому здесь есть и порог альфы, и привязка блока к целому числу пикселей.
function buildPixelate(layer, fx, reg) {
    const doc = AFX.state.doc;

    const secG = W.section(L('Pixel grid'), true);
    secG._body.appendChild(W.num({
        label: L('Art resolution'), min: 4, max: 1024, step: 1, int: true, unit: L('cells'),
        tip: L('Pixel-art width in cells; the height follows the composition and pixel aspect. Atlas 1:1 exports it'),
        get: () => fx.pxW, set: v => { fx.pxW = v; AFX.touch(layer.id); syncInfo(); }
    }));
    secG._body.appendChild(W.chk({
        label: L('Square blocks'),
        tip: L('Keep every block a whole number of composition pixels so the pixel staircase stays even'),
        get: () => fx.pxSnap !== false,
        set: v => { fx.pxSnap = v; AFX.touch(layer.id); syncInfo(); }
    }));
    const info = h('div', { cls: 'px-info' });
    const syncInfo = function () {
        const g = AFX.Model.pixelGridOf(doc, fx);
        const even = Math.abs(g.bx - Math.round(g.bx)) < 1e-6 && Math.abs(g.by - Math.round(g.by)) < 1e-6;
        info.textContent = g.gw + ' × ' + g.gh + ' ' + L('cells') + '  ·  ' +
            (Math.round(g.bx * 100) / 100) + '×' + (Math.round(g.by * 100) / 100) + ' px ' + L('per cell') +
            (even ? '' : '  — ' + L('uneven blocks'));
        info.classList.toggle('warn', !even);
    };
    syncInfo();
    reg.push(syncInfo);
    secG._body.appendChild(info);
    secG._body.appendChild(W.num({
        label: L('Pixel aspect'), min: 0.25, max: 4, step: 0.05, prec: 2,
        tip: L('Height / width of one art pixel. 1 — square; 2 — tall pixels, a match for a compressed isometric camera'),
        get: () => fx.pxAspect, set: v => { fx.pxAspect = v; AFX.touch(layer.id); syncInfo(); }
    }));
    secG._body.appendChild(W.num({
        label: L('Grid offset X'), min: -0.5, max: 0.5, step: 0.05, prec: 2, unit: L('cell'),
        tip: L('Shift the grid inside one cell to line the blocks up with the center of the effect'),
        get: () => fx.pxOffX, set: v => { fx.pxOffX = v; AFX.touch(layer.id); syncInfo(); }
    }));
    secG._body.appendChild(W.num({
        label: L('Grid offset Y'), min: -0.5, max: 0.5, step: 0.05, prec: 2, unit: L('cell'),
        tip: L('Shift the grid inside one cell to line the blocks up with the center of the effect'),
        get: () => fx.pxOffY, set: v => { fx.pxOffY = v; AFX.touch(layer.id); syncInfo(); }
    }));
    bodyEl.appendChild(secG);

    const secS = W.section(L('Sampling'), true);
    secS._body.appendChild(W.sel({
        label: L('Sample'),
        tip: L('How a block gets its color: Peak keeps bright sparks, Average is smooth, Point is the hardest'),
        options: [['peak', L('Peak (keep detail)')], ['box', L('Average (area)')], ['point', L('Point (nearest)')]],
        get: () => fx.pxSample || 'peak',
        set: v => { fx.pxSample = v; AFX.touch(layer.id); }
    }));
    secS._body.appendChild(W.num({
        label: L('Alpha gain'), min: 0, max: 4, step: 0.05, prec: 2,
        tip: L('Multiplies alpha before the cutoff — raise it to turn thin faded strokes back into solid pixels'),
        get: () => fx.pxGain, set: v => { fx.pxGain = v; AFX.touch(layer.id); }
    }));
    secS._body.appendChild(W.sel({
        label: L('Alpha'),
        tip: L('Cut — 1-bit alpha like real pixel art; Steps — a few transparency levels; Soft — keep the gradient'),
        options: [['cut', L('Cut (1-bit)')], ['steps', L('Steps')], ['soft', L('Soft (keep)')]],
        get: () => fx.pxAlpha || 'cut',
        set: v => { fx.pxAlpha = v; AFX.touch(layer.id); Insp.rebuild(); }
    }));
    if ((fx.pxAlpha || 'cut') === 'cut') {
        secS._body.appendChild(W.num({
            label: L('Alpha cutoff'), min: 0, max: 1, step: 0.02, prec: 2,
            tip: L('Coverage a block needs to become a pixel. Lower — fatter silhouette; animate it for a dissolve'),
            track: tr(layer, fx, 'pxThr'), reg: reg
        }));
    } else if (fx.pxAlpha === 'steps') {
        secS._body.appendChild(W.num({
            label: L('Alpha steps'), min: 2, max: 16, step: 1, int: true,
            tip: L('How many transparency levels a block can take'),
            get: () => fx.pxALev, set: v => { fx.pxALev = v; AFX.touch(layer.id); }
        }));
    }
    bodyEl.appendChild(secS);

    const secC = W.section(L('Color quantize'), true);
    secC._body.appendChild(W.num({
        label: L('Saturation'), min: 0, max: 3, step: 0.05, prec: 2,
        tip: L('Applied before quantizing: averaging a block washes the chroma out, this puts it back'),
        get: () => fx.pxSat, set: v => { fx.pxSat = v; AFX.touch(layer.id); }
    }));
    secC._body.appendChild(W.num({
        label: L('Contrast'), min: 0.2, max: 3, step: 0.05, prec: 2,
        tip: L('Contrast boost applied before quantizing; 1 leaves the colors unchanged'),
        get: () => fx.pxCon, set: v => { fx.pxCon = v; AFX.touch(layer.id); }
    }));
    secC._body.appendChild(W.sel({
        label: L('Quantize'),
        tip: L('Reduce colors: Levels posterize the channels, Palette snaps to fixed colors, Ramp maps brightness'),
        options: [['none', L('None')], ['levels', L('Levels (posterize)')], ['palette', L('Palette')], ['ramp', L('Ramp by brightness')]],
        get: () => fx.pxColor || 'none',
        set: v => { fx.pxColor = v; AFX.touch(layer.id); Insp.rebuild(); }
    }));
    if (fx.pxColor === 'levels') {
        secC._body.appendChild(W.num({
            label: L('Levels per channel'), min: 2, max: 32, step: 1, int: true,
            tip: L('How many brightness levels each color channel keeps'),
            get: () => fx.pxLev, set: v => { fx.pxLev = v; AFX.touch(layer.id); }
        }));
    } else if (fx.pxColor === 'palette') {
        const sw = h('div', { cls: 'px-swatches' });
        const drawSw = function () {
            sw.innerHTML = '';
            AFX.Model.pixelPalette(fx.pxPal).colors.forEach(c => sw.appendChild(h('i', { style: 'background:' + c })));
        };
        secC._body.appendChild(W.sel({
            label: L('Palette'),
            tip: L('Fixed palette: every pixel takes the nearest of its colors'),
            options: AFX.Model.PIXEL_PALETTES.map(p => [p.id, L(p.label)]),
            get: () => fx.pxPal, set: v => { fx.pxPal = v; AFX.touch(layer.id); drawSw(); }
        }));
        drawSw();
        secC._body.appendChild(sw);
    } else if (fx.pxColor === 'ramp') {
        secC._body.appendChild(W.grad({
            label: L('Brightness ramp'), layerId: layer.id, grad: () => fx.pxRamp,
            tip: L('Colors for brightness: dark pixels take the left end of the gradient, bright ones the right')
        }));
        secC._body.appendChild(W.num({
            label: L('Ramp steps'), min: 2, max: 32, step: 1, int: true,
            tip: L('How many separate colors are taken from the brightness ramp'),
            get: () => fx.pxRampN, set: v => { fx.pxRampN = v; AFX.touch(layer.id); }
        }));
    }
    secC._body.appendChild(W.sel({
        label: L('Dither'),
        tip: L('Ordered Bayer dither on the art grid — reads as a pixel pattern; works on colors and alpha'),
        options: [['0', L('None')], ['2', '2×2'], ['4', '4×4'], ['8', '8×8']],
        get: () => String(fx.pxDither | 0),
        set: v => { fx.pxDither = +v; AFX.touch(layer.id); Insp.rebuild(); }
    }));
    if (fx.pxDither) {
        secC._body.appendChild(W.num({
            label: L('Dither amount'), min: 0, max: 2, step: 0.05, prec: 2,
            tip: L('Strength of the dither pattern; 0 turns dithering off'),
            get: () => fx.pxDitherAmt, set: v => { fx.pxDitherAmt = v; AFX.touch(layer.id); }
        }));
    }
    bodyEl.appendChild(secC);

    const secO = W.section(L('Outline'), true);
    secO._body.appendChild(W.num({
        label: L('Outline'), min: 0, max: 1, step: 0.05, prec: 2,
        tip: L('One art pixel along the silhouette — the readability trick almost every sprite sheet uses'),
        get: () => fx.pxOut, set: v => { fx.pxOut = v; AFX.touch(layer.id); Insp.rebuild(); }
    }));
    if (fx.pxOut > 0) {
        secO._body.appendChild(W.sel({
            label: L('Outline side'),
            tip: L('Draw the outline outside the silhouette or along its inner edge'),
            options: [['outer', L('Outside silhouette')], ['inner', L('Inside edge')]],
            get: () => fx.pxOutMode || 'outer',
            set: v => { fx.pxOutMode = v; AFX.touch(layer.id); }
        }));
        secO._body.appendChild(W.color({
            label: L('Outline color'),
            tip: L('Color of the one-pixel silhouette outline'),
            get: () => fx.pxOutCol, set: v => { fx.pxOutCol = v; AFX.touch(layer.id); }
        }));
    }
    bodyEl.appendChild(secO);

    const secX = W.section(L('Export'), true);
    const xInfo = h('div', { cls: 'px-info' });
    const syncX = function () {
        const g = AFX.Model.pixelGridOf(doc, fx);
        const top = AFX.Model.pixelGrid(doc);
        const mine = top && top.gw === g.gw && top.gh === g.gh;
        xInfo.textContent = doc.exp.pixelArt
            ? (mine ? L('Atlas exports 1:1 at') + ' ' + g.gw + '×' + g.gh
                    : L('Atlas uses the topmost pixel-art layer, not this one'))
            : L('Turn on Pixel art 1:1 in Atlas Export to ship this resolution');
        xInfo.classList.toggle('warn', !doc.exp.pixelArt || !mine);
    };
    syncX();
    reg.push(syncX);
    secX._body.appendChild(xInfo);
    secX._body.appendChild(W.chk({
        label: L('Pixel art 1:1'),
        tip: L('Atlas cell = the art grid, nearest filtering; keep this layer on top — layers above stay smooth'),
        get: () => !!doc.exp.pixelArt,
        set: v => { doc.exp.pixelArt = v; AFX.emit('atlas'); syncX(); }
    }));
    bodyEl.appendChild(secX);
}

function buildSprite(layer, reg) {
    const sp = layer.sp;
    bodyEl.appendChild(commonSection(layer, reg));

    const secS = W.section(L('Sprite'), true);
    secS._body.appendChild(W.sprite({
        label: L('Source'), layerId: layer.id,
        tip: L('Sprite image: a procedural shape or an imported texture — click to choose'),
        get: () => sp.sprite,
        set: ref => { sp.sprite = ref; }
    }));
    secS._body.appendChild(W.num({
        label: L('Base size'), min: 2, step: 2, unit: 'px',
        tip: L('Sprite size in pixels along its longer side, before Scale is applied'),
        get: () => sp.size, set: v => { sp.size = v; AFX.touch(layer.id); }
    }));
    if (sp.sprite && sp.sprite.kind === 'tex') {
        secS._body.appendChild(W.num({
            label: L('Footage FPS'), min: 0, max: 120, step: 1, int: true,
            tip: L('Frame rate of a footage texture; 0 stretches all frames over the layer window'),
            get: () => sp.fps, set: v => { sp.fps = v; AFX.touch(layer.id); }
        }));
    }
    bodyEl.appendChild(secS);

    bodyEl.appendChild(transformSection(layer, sp, reg, false));

    const secC = W.section(L('Color & Look'), true);
    secC._body.appendChild(W.colorTrack({
        label: L('Color'), track: tr(layer, sp, 'color'), reg: reg,
        tip: L('Tint of the procedural shape; imported textures keep their own colors')
    }));
    secC._body.appendChild(W.num({
        label: L('Sprite squash'), min: 0, max: 1, step: 0.02, prec: 2, tip: L('How much camera compression flattens the sprite (1 — lying on the ground)'),
        get: () => sp.squash, set: v => { sp.squash = v; AFX.touch(layer.id); }
    }));
    secC._body.appendChild(W.num({
        label: L('Glow'), min: 0, max: 3, step: 0.02, prec: 2, track: tr(layer, sp, 'glow'), reg: reg,
        tip: L('Additive glow halo around the shape; above 1 adds extra passes (not for textures)')
    }));
    secC._body.appendChild(W.num({
        label: L('Glow size'), min: 0.2, max: 4, step: 0.05, prec: 2,
        tip: L('Size of the glow halo relative to the sprite size'),
        get: () => sp.glowSize, set: v => { sp.glowSize = v; AFX.touch(layer.id); }
    }));
    secC._body.appendChild(W.num({
        label: L('Glow softness'), min: 0.02, max: 0.6, step: 0.01, prec: 2, tip: L('Blur radius as a fraction of sprite size'),
        get: () => sp.glowBlur, set: v => { sp.glowBlur = v; AFX.touch(layer.id); }
    }));
    bodyEl.appendChild(secC);
}

// трансформ спрайта и атласа (общий блок sp); у атласа сюда же уезжает сжатие спрайта —
// секции «Цвет и вид» у него нет
function transformSection(layer, sp, reg, withSquash) {
    const secT = W.section(L('Transform'), true);
    secT._body.appendChild(W.num({
        label: L('Position X'), step: 2, track: tr(layer, sp, 'x'), reg: reg,
        tip: L('Horizontal position, px from the composition center (positive is right)')
    }));
    secT._body.appendChild(W.num({
        label: L('Position Y'), step: 2, track: tr(layer, sp, 'y'), reg: reg,
        tip: L('Vertical position, px from the composition center (positive is down)')
    }));
    secT._body.appendChild(W.num({
        label: L('Scale'), min: 0, step: 0.02, prec: 2, track: tr(layer, sp, 'scale'), reg: reg,
        tip: L('Size multiplier on top of the base size; animate it to grow or shrink the layer')
    }));
    secT._body.appendChild(W.num({
        label: L('Aspect X/Y'), min: 0.1, max: 10, step: 0.02, prec: 2,
        tip: L('Width-to-height ratio: above 1 stretches the image wide, below 1 makes it tall'),
        get: () => sp.aspect, set: v => { sp.aspect = v; AFX.touch(layer.id); }
    }));
    secT._body.appendChild(W.num({
        label: L('Rotation'), step: 2, unit: L('deg'), track: tr(layer, sp, 'rot'), reg: reg,
        tip: L('Rotation of the layer image in degrees (positive turns clockwise)')
    }));
    if (withSquash) {
        secT._body.appendChild(W.num({
            label: L('Sprite squash'), min: 0, max: 1, step: 0.02, prec: 2,
            tip: L('How much camera compression flattens the sprite (1 — lying on the ground)'),
            get: () => sp.squash, set: v => { sp.squash = v; AFX.touch(layer.id); }
        }));
    }
    return secT;
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
        tip: L('Sprite sheet the frames come from — click to pick a texture or import a new one'),
        get: () => sp.sprite,
        set: ref => { sp.sprite = ref; AFX.Ops.fitAtlasFrame(AFX.state.doc, layer, false); syncInfo(); }
    }));
    secS._body.appendChild(info);

    const btns = h('div', { cls: 'btn-row' });
    const bImp = h('button', { cls: 'tb', text: L('Choose sheet...'), tip: L('Open the sheet dialog: pick or drop an image and set its grid') });
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
    const bGrid = h('button', { cls: 'tb', text: L('Grid'), tip: L('Edit the frame grid (columns, rows, fps) of the current sheet') });
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
        tip: L('Frame rate of a footage texture; 0 stretches all frames over the layer window'),
        get: () => sp.fps, set: v => { sp.fps = v; AFX.touch(layer.id); syncInfo(); }
    }));
    bodyEl.appendChild(secS);
    syncInfo();

    bodyEl.appendChild(transformSection(layer, sp, reg, true));
}

})();
