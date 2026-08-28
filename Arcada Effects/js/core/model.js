// Arcaidia Effector — модель документа: композиция, слои, пресеты слоёв, сериализация
// Координаты: (0,0) = центр композиции, Y вниз. Время треков — от начала слоя.
(function () {
'use strict';
const AFX = window.AFX;
const M = AFX.Model = {};

M.SCHEMA = 2;

M.newDoc = function () {
    return {
        v: M.SCHEMA,
        id: AFX.uid('fx'),
        name: 'New Effect',
        comp: { w: 512, h: 512, dur: 1.2, fps: 60 },
        cam: { comp: 0 }, // градусы наклона камеры: scaleY = cos
        exp: { cols: 3, rows: 3, frames: 9, cellW: 256, cellH: 256, t0: 0, t1: -1, mode: 'rgba', thr: 0, ss: 2 },
        textures: [],
        layers: []
    };
};

M.compK = doc => Math.cos(AFX.clamp(doc.cam.comp, 0, 75) * AFX.DEG);

// ---------- слои ----------
// Блок частицы. Общий для основной частицы эмиттера (layer.pt) и для дочерней
// частицы суб-эмиттера (layer.em.sub.pt) — один набор полей, один UI, один рендер.
M.newParticle = function () {
    return {
        life: 0.8, lifeRnd: 0.3,
        render: 'sprite',
        sprite: { kind: 'shape', id: 'smoke', p: {} },
        trailCore: 0,
        size: 90, sizeRnd: 0.4,
        sizeOL: AFX.Curve.presets.grow.make(),
        sizeOT: AFX.Curve.presets.const1.make(),
        opacityOL: AFX.Curve.presets.fadeOut.make(),
        grad: AFX.Grad.presets.fire.make(),
        tintTex: false,
        rot: 0, rotRnd: 1, spin: 40, spinRnd: 1,
        alignVel: false, stretch: 0,
        gravX: 0, gravY: 0, drag: 2,
        turbAmp: 0, turbFreq: 1.5, zigzag: 0,
        // ТУРБУЛЕНТНОСТЬ. 'noise' — независимый шум по возрасту частицы (дрожание);
        // 'curl' — вихревое поле в мировых координатах: соседние частицы едут вместе
        // связной струёй, отсюда языки пламени и завитки дыма. Дефолт 'noise' —
        // старые файлы попиксельно те же, curl-поля в них просто не читаются.
        turbMode: 'noise',
        turbScale: 90,   // px: размер вихря (ширина языка) — curl
        turbOct: 2,      // 1..4 октавы: крупная струя + мелкая рвань — curl
        turbRise: 0,     // px/с: поле всплывает вверх вместе с плюмом — curl
        turbWind: 0,     // px/с: поле как СКОРОСТЬ среды (сопротивление тянет к ней) — curl
        turbSeed: 0,     // вариация поля (разные слои — разные seed) — curl
        turbRamp: 0,     // 0..1: разгон амплитуды по жизни частицы (ламинарный низ)
        squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15,
        fps: 0
    };
};

// ПУТЬ ДВИЖЕНИЯ (motion path): анимируемая ломаная/кривая эмиттера.
// Узлы — смещения от центра эмиттера (em.x/em.y), у каждого свои треки x/y:
// путь целиком анимируется (клинок меча = два узла с ключами, S-кривая = 4 узла).
// on:false — путь симуляции прежний, старые файлы попиксельно те же.
M.newPath = function () {
    return {
        on: false,
        mode: 'emit',       // emit — рождение вдоль пути | guide — ведение частиц | both
        closed: false,
        smooth: true,       // Catmull-Rom через узлы (от 3 узлов); false — ломаная
        nodes: [{ x: -140, y: 0 }, { x: 140, y: 0 }],
        along: 'random',    // random — случайно вдоль пути | even — равномерно (низкая дискрепанция)
        jitter: 0,          // трек: разброс точки рождения поперёк пути, px
        aim: 'none',        // none — обычный em.dir | tangent — вдоль пути | normal — поперёк
        attract: 0,         // трек: пружина к ближайшей точке пути, 1/с^2
        lock: 0,            // трек 0..1: жёсткое прилипание к пути на каждом шаге
        flow: 0,            // трек: скорость вдоль касательной, px/с
        fast: true          // ведение: искать ближайшую точку рядом с прошлой (в 3-5 раз дешевле)
    };
};

// СУБ-ЭМИТТЕР: каждая частица слоя сама работает эмиттером дочерних частиц
// (aux-система). on:false — путь симуляции/рендера прежний, файл попиксельно тот же.
M.newSub = function () {
    const pt = M.newParticle();
    pt.sprite = { kind: 'shape', id: 'dot', p: {} };
    pt.life = 0.35; pt.lifeRnd = 0.4;
    pt.size = 18; pt.sizeRnd = 0.5;
    pt.sizeOL = AFX.Curve.presets.shrink.make();
    pt.opacityOL = AFX.Curve.presets.fadeOut.make();
    pt.grad = AFX.Grad.presets.spark.make();
    pt.drag = 1.5; pt.spin = 0; pt.spinRnd = 0;
    return {
        on: false,
        emit: 'death',      // life — по ходу жизни родителя | death — при гибели | both
        rate: 20,           // частиц/сек с КАЖДОЙ родительской частицы (life/both)
        count: 8,           // выброс в момент гибели родителя (death/both)
        startAt: 0,         // с какой доли жизни родителя начинать сыпать (0..1)
        dir: 'omni',        // omni | inherit (вдоль скорости родителя) | back | out
        spread: 60,
        speed: 90, speedRnd: 0.6,
        inherit: 0.25,      // доля скорости родителя в стартовой скорости ребёнка
        maxGen: 1,          // 1 — только дети; 2+ — дети детей тем же sub.pt
        genScale: 0.6,      // множитель size/life/rate на каждое следующее поколение
        budget: 1500,       // кап живых дочерних частиц слоя
        under: false,       // рисовать детей ПОД родителями
        pt: pt
    };
};

M.newEmitter = function (doc, name) {
    return {
        id: AFX.uid('lr'),
        name: name || 'Emitter',
        type: 'emitter',
        on: true, solo: false,
        start: 0, end: doc.comp.dur,
        blend: 'add',
        opacity: 1,
        glowL: 0, glowLR: 24,
        fadeOn: false, fadeX: 0, fadeY: 0, fadeR: 220, fadeSoft: 0.5,
        em: {
            x: 0, y: 0,
            shape: 'point', sx: 60, sy: 60,
            dir: 'out', angle: -90, spread: 40,
            speed: 300, speedRnd: 0.5,
            rate: 0,
            subStep: true,      // рождения распределены внутри шага (файлы v<2 — false)
            bursts: [{ t: 0, n: 24 }],
            branch: { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 },
            path: M.newPath(),
            sub: M.newSub(),
            seed: 1
        },
        pt: M.newParticle()
    };
};

M.newSprite = function (doc, name) {
    return {
        id: AFX.uid('lr'),
        name: name || 'Sprite',
        type: 'sprite',
        on: true, solo: false,
        start: 0, end: doc.comp.dur,
        blend: 'add',
        opacity: { keys: [AFX.Track.newKey(0, 1), AFX.Track.newKey(0.4, 0)] },
        glowL: 0, glowLR: 24,
        fadeOn: false, fadeX: 0, fadeY: 0, fadeR: 220, fadeSoft: 0.5,
        sp: {
            sprite: { kind: 'shape', id: 'soft', p: {} },
            size: 220,
            x: 0, y: 0,
            scale: { keys: [AFX.Track.newKey(0, 0.3), AFX.Track.newKey(0.4, 1.4)] },
            aspect: 1,
            rot: 0,
            color: [255, 255, 255],
            squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15,
            fps: 0
        }
    };
};

// ATLAS-слой: рендерится тем же путём, что спрайт, но источник — только лист-текстура
// и НИКАКОЙ фабричной преданимации (scale/opacity — статика, blend normal).
M.newAtlas = function (doc, name) {
    return {
        id: AFX.uid('lr'),
        name: name || 'Atlas',
        type: 'atlas',
        on: true, solo: false,
        start: 0, end: doc.comp.dur,
        blend: 'normal',
        opacity: 1,
        glowL: 0, glowLR: 24,
        fadeOn: false, fadeX: 0, fadeY: 0, fadeR: 220, fadeSoft: 0.5,
        sp: {
            sprite: { kind: 'tex', texId: null },
            size: 256,
            x: 0, y: 0,
            scale: 1,
            aspect: 1,
            rot: 0,
            color: [255, 255, 255],
            squash: 0, glow: 0, glowSize: 1.6, glowBlur: 0.15,
            fps: 0
        }
    };
};

// POST_FX-слой: не рисует ничего своего, а обрабатывает ПИКСЕЛИ всего, что уже
// накоплено ПОД ним (слои ниже по стеку) — аналог adjustment layer.
// layer.opacity здесь = сила эффекта (0 — байпас), blend/glowL/fadeOn не действуют.
// Дискриминатор вида эффекта — fx.effect (НЕ 'kind': поле с именем kind делает
// объект "атомом" для Model.hydrate, и разреженные файлы остались бы без дефолтов).
M.newPostFx = function (doc, name) {
    return {
        id: AFX.uid('lr'),
        name: name || 'Motion Blur',
        type: 'postfx',
        on: true, solo: false,
        start: 0, end: doc.comp.dur,
        blend: 'normal',
        opacity: 1,         // трек 0..1: подмешивание обработанного кадра к чистому
        glowL: 0, glowLR: 24,
        fadeOn: false, fadeX: 0, fadeY: 0, fadeR: 220, fadeSoft: 0.5,
        fx: {
            effect: 'mblur',
            mode: 'directional',    // directional — смаз по углу | radial — от центра (зум + вращение)
            angle: 0,               // трек: направление смаза, градусы (directional)
            length: 24,             // трек: длина смаза, px (у radial — на самом краю кадра)
            spin: 0,                // трек: угловой смаз вокруг центра, градусы (radial)
            x: 0, y: 0,             // треки: центр радиального смаза (гизмо в превью)
            samples: 16,            // сэмплов, степень двойки: набираются log2(N) проходами
            half: false,            // считать на половинном разрешении (быстрее, мягче)
            // --- ИСКАЖЕНИЕ (effect: 'displace'): кадр под слоем гнётся турбулентным
            // шумом. Именно оно режет языки пламени из мягкой массы частиц.
            amount: 26,             // трек: величина смещения, px
            scale: 60,              // размер складки по горизонтали, px
            aspect: 2.4,            // вытянутость складки по вертикали (у огня 2-3)
            field: 'swirl',         // swirl — бездивергентное вихревое поле (не рвёт дыр)
                                    // | tear — свой шум по каждой оси (резкие разрывы)
            oct: 3,                 // октавы: крупная волна + мелкая рвань
            evo: 0.6,               // Гц: с какой скоростью поле перерождается
            rise: 150,              // px/с: поле уплывает вверх вместе с плюмом
            ramp: 0,                // 0..1: насколько гасить искажение ниже линии y0
            y0: 0,                  // трек: линия, ниже которой искажение затухает, px
            soft: 120,              // на какой высоте затухание доходит до ramp, px
            seed: 0
        }
    };
};

// ---------- пресеты слоёв ----------
function K(t, v, mode) { const k = AFX.Track.newKey(t, v); if (mode) AFX.Track.setEase(k, mode); return k; }

M.layerPresets = [
    {
        id: 'flash', label: 'Flash',
        make: function (doc) {
            const l = M.newSprite(doc, 'Flash');
            l.end = Math.min(doc.comp.dur, 0.35);
            l.sp.size = 260;
            l.sp.scale = { keys: [K(0, 0.25, 'easeOut'), K(0.16, 1.5)] };
            l.opacity = { keys: [K(0, 1), K(0.05, 1), K(0.3, 0)] };
            l.sp.color = AFX.hexToRgb('#fff2c8');
            l.sp.glow = 0.8;
            return l;
        }
    },
    {
        id: 'shockwave', label: 'Shockwave',
        make: function (doc) {
            const l = M.newSprite(doc, 'Shockwave');
            l.end = Math.min(doc.comp.dur, 0.6);
            l.sp.sprite = { kind: 'shape', id: 'ring', p: { th: 0.1 } };
            l.sp.size = 200;
            l.sp.squash = 1;
            l.sp.scale = { keys: [K(0, 0.12, 'easeOut'), K(0.5, 2.4)] };
            l.opacity = { keys: [K(0, 0.95), K(0.2, 0.7), K(0.55, 0)] };
            l.sp.color = AFX.hexToRgb('#ffd9a0');
            return l;
        }
    },
    {
        id: 'fireball', label: 'Fireball',
        make: function (doc) {
            const l = M.newEmitter(doc, 'Fire');
            l.end = Math.min(doc.comp.dur, 0.3);
            l.em.shape = 'circle'; l.em.sx = 26; l.em.sy = 26;
            l.em.bursts = [{ t: 0, n: 22 }];
            l.em.speed = 260; l.em.speedRnd = 0.6;
            l.pt.life = 0.55; l.pt.lifeRnd = 0.35;
            l.pt.size = 100; l.pt.sizeRnd = 0.45;
            l.pt.sizeOL = AFX.Curve.presets.growFast.make();
            l.pt.opacityOL = AFX.Curve.presets.fadeOut.make();
            l.pt.grad = AFX.Grad.presets.fire.make();
            l.pt.drag = 4; l.pt.glow = 0.35;
            return l;
        }
    },
    {
        id: 'smokeCloud', label: 'Smoke',
        make: function (doc) {
            const l = M.newEmitter(doc, 'Smoke');
            l.blend = 'normal';
            l.start = 0.1; l.end = Math.min(doc.comp.dur, 0.4);
            l.em.shape = 'circle'; l.em.sx = 40; l.em.sy = 40;
            l.em.bursts = [{ t: 0, n: 14 }];
            l.em.speed = 130; l.em.speedRnd = 0.6;
            l.pt.life = 0.9; l.pt.lifeRnd = 0.3;
            l.pt.size = 120; l.pt.sizeRnd = 0.4;
            l.pt.sizeOL = AFX.Curve.presets.grow.make();
            l.pt.opacityOL = AFX.Curve.presets.bell.make();
            l.pt.grad = AFX.Grad.presets.smoke.make();
            l.pt.drag = 3; l.pt.gravY = -60; l.pt.spin = 60;
            return l;
        }
    },
    {
        id: 'sparks', label: 'Sparks',
        make: function (doc) {
            const l = M.newEmitter(doc, 'Sparks');
            l.end = Math.min(doc.comp.dur, 0.2);
            l.em.bursts = [{ t: 0, n: 30 }];
            l.em.speed = 640; l.em.speedRnd = 0.6;
            l.pt.life = 0.5; l.pt.lifeRnd = 0.5;
            l.pt.sprite = { kind: 'shape', id: 'streak', p: {} };
            l.pt.size = 46; l.pt.sizeRnd = 0.5;
            l.pt.sizeOL = AFX.Curve.presets.shrink.make();
            l.pt.opacityOL = AFX.Curve.presets.fadeOut.make();
            l.pt.grad = AFX.Grad.presets.spark.make();
            l.pt.alignVel = true; l.pt.stretch = 1.6;
            l.pt.drag = 2.5; l.pt.gravY = 380; l.pt.glow = 0.4;
            return l;
        }
    },
    {
        id: 'debris', label: 'Debris',
        make: function (doc) {
            const l = M.newEmitter(doc, 'Debris');
            l.blend = 'normal';
            l.end = Math.min(doc.comp.dur, 0.15);
            l.em.bursts = [{ t: 0, n: 12 }];
            l.em.speed = 420; l.em.speedRnd = 0.7;
            l.pt.sprite = { kind: 'shape', id: 'shard', p: {} };
            l.pt.life = 0.7; l.pt.lifeRnd = 0.4;
            l.pt.size = 30; l.pt.sizeRnd = 0.6;
            l.pt.sizeOL = AFX.Curve.presets.const1.make();
            l.pt.opacityOL = AFX.Curve.presets.fadeOut.make();
            l.pt.grad = AFX.Grad.make([[0, '#7a5a40'], [1, '#33241a']]);
            l.pt.spin = 420; l.pt.spinRnd = 1;
            l.pt.drag = 1.5; l.pt.gravY = 900;
            return l;
        }
    },
    {
        id: 'ringBurst', label: 'Particle Ring',
        make: function (doc) {
            const l = M.newEmitter(doc, 'Particle Ring');
            l.end = Math.min(doc.comp.dur, 0.2);
            l.em.shape = 'ring'; l.em.sx = 70; l.em.sy = 10;
            l.em.bursts = [{ t: 0, n: 40 }];
            l.em.dir = 'out';
            l.em.speed = 220; l.em.speedRnd = 0.2;
            l.pt.life = 0.6; l.pt.lifeRnd = 0.2;
            l.pt.sprite = { kind: 'shape', id: 'soft', p: {} };
            l.pt.size = 40; l.pt.sizeRnd = 0.3;
            l.pt.sizeOL = AFX.Curve.presets.shrink.make();
            l.pt.opacityOL = AFX.Curve.presets.fadeOut.make();
            l.pt.grad = AFX.Grad.presets.energy.make();
            l.pt.drag = 3; l.pt.glow = 0.5;
            return l;
        }
    },
    {
        id: 'flame', label: 'Flame (stream)',
        make: function (doc) {
            const l = M.newEmitter(doc, 'Flame');
            l.em.rate = 90; l.em.bursts = [];
            l.em.shape = 'circle'; l.em.sx = 24; l.em.sy = 12;
            l.em.dir = 'dir'; l.em.angle = -90; l.em.spread = 26;
            l.em.speed = 260; l.em.speedRnd = 0.35;
            l.pt.life = 0.6; l.pt.lifeRnd = 0.3;
            l.pt.size = 80; l.pt.sizeRnd = 0.35;
            l.pt.sizeOL = AFX.Curve.presets.shrink.make();
            l.pt.opacityOL = AFX.Curve.presets.bell.make();
            l.pt.grad = AFX.Grad.presets.fireHot.make();
            l.pt.drag = 1.2; l.pt.turbAmp = 300; l.pt.turbFreq = 2.5;
            l.pt.glow = 0.3;
            return l;
        }
    },
    {
        id: 'lightning', label: 'Lightning',
        make: function (doc) {
            const l = M.newEmitter(doc, 'Lightning');
            l.blend = 'add';
            l.end = Math.min(doc.comp.dur, 0.15);
            l.em.shape = 'point';
            l.em.y = -210;
            l.em.dir = 'dir'; l.em.angle = 90; l.em.spread = 16;
            l.em.speed = 1100; l.em.speedRnd = 0.15;
            l.em.bursts = [{ t: 0, n: 2 }];
            l.em.branch = { chance: 7, spread: 45, lifeScale: 0.55, sizeScale: 0.6, speedScale: 1.05, maxGen: 3 };
            l.pt.render = 'trail';
            l.pt.trailCore = 0.85;
            l.pt.life = 0.42; l.pt.lifeRnd = 0.25;
            l.pt.size = 8; l.pt.sizeRnd = 0.3;
            l.pt.sizeOL = AFX.Curve.presets.const1.make();
            // конус: толстое основание у эмиттера, тонкий кончик
            l.pt.sizeOT = AFX.Curve.make([[0, 1], [0.55, 0.7], [1, 0.15]]);
            // мерцание и обрыв в конце жизни
            l.pt.opacityOL = AFX.Curve.make([[0, 1], [0.5, 1], [0.62, 0.35], [0.72, 0.95], [0.85, 0.5], [1, 0]]);
            l.pt.grad = AFX.Grad.make([[0, '#ffffff'], [0.5, '#9fd8ff'], [1, '#3f6ad8']]);
            l.pt.zigzag = 900;
            l.pt.drag = 0; l.pt.gravY = 0; l.pt.spin = 0;
            l.pt.glow = 0.7; l.pt.glowSize = 1.8; l.pt.glowBlur = 0.25;
            l.glowL = 1.4; l.glowLR = 16;
            l.fadeOn = true; l.fadeX = 0; l.fadeY = 0; l.fadeR = 320; l.fadeSoft = 0.4;
            return l;
        }
    },
    {
        id: 'firework', label: 'Firework (sub-emitter)',
        make: function (doc) {
            const l = M.newEmitter(doc, 'Firework');
            l.end = Math.min(doc.comp.dur, 0.1);
            l.em.dir = 'omni';
            l.em.bursts = [{ t: 0, n: 10 }];
            l.em.speed = 420; l.em.speedRnd = 0.35;
            l.pt.sprite = { kind: 'shape', id: 'dot', p: {} };
            l.pt.life = 0.55; l.pt.lifeRnd = 0.2;
            l.pt.size = 22; l.pt.sizeRnd = 0.3;
            l.pt.sizeOL = AFX.Curve.presets.const1.make();
            l.pt.opacityOL = AFX.Curve.presets.fadeOut.make();
            l.pt.grad = AFX.Grad.presets.fireHot.make();
            l.pt.drag = 2.2; l.pt.gravY = 260; l.pt.glow = 0.5;
            // каждая искра сама эмиттер: шлейф по жизни + вспышка в момент гибели
            const sub = l.em.sub;
            sub.on = true; sub.emit = 'both';
            sub.rate = 26; sub.count = 10;
            sub.dir = 'omni'; sub.speed = 70; sub.speedRnd = 0.7; sub.inherit = 0.2;
            sub.budget = 1200;
            sub.pt.life = 0.32; sub.pt.lifeRnd = 0.4;
            sub.pt.size = 12; sub.pt.sizeRnd = 0.5;
            sub.pt.gravY = 180; sub.pt.drag = 2; sub.pt.glow = 0.4;
            return l;
        }
    },
    {
        id: 'blade', label: 'Blade (path)',
        make: function (doc) {
            // клинок = два узла пути: рукоять на месте, кончик проходит дугу замаха
            const l = M.newEmitter(doc, 'Blade');
            l.end = Math.min(doc.comp.dur, 0.28);
            l.em.speed = 0; l.em.speedRnd = 0;
            l.em.rate = 2600; l.em.bursts = [];
            const pa = l.em.path;
            pa.on = true; pa.mode = 'emit'; pa.along = 'even'; pa.jitter = 4;
            const hx = 0, hy = 150, R = 215, dur = Math.min(l.end - l.start, 0.26);
            const kx = [], ky = [];
            for (let i = 0; i <= 6; i++) {
                const f = i / 6;
                const a = (205 + 130 * f) * AFX.DEG;
                const t = Math.round(dur * f * 1000) / 1000;
                kx.push(K(t, Math.round(hx + Math.cos(a) * R), 'lin'));
                ky.push(K(t, Math.round(hy + Math.sin(a) * R), 'lin'));
            }
            pa.nodes = [{ x: hx, y: hy }, { x: { keys: kx }, y: { keys: ky } }];
            l.pt.sprite = { kind: 'shape', id: 'soft', p: {} };
            l.pt.life = 0.07; l.pt.lifeRnd = 0.3;
            l.pt.size = 30; l.pt.sizeRnd = 0.25;
            l.pt.sizeOL = AFX.Curve.presets.shrink.make();
            l.pt.opacityOL = AFX.Curve.presets.fadeOut.make();
            l.pt.grad = AFX.Grad.make([[0, '#ffffff'], [0.35, '#9fd8ff'], [1, '#2f5bd0']]);
            l.pt.drag = 0; l.pt.spin = 0; l.pt.spinRnd = 0;
            l.pt.glow = 0.7; l.pt.glowSize = 1.9; l.pt.glowBlur = 0.22;
            l.glowL = 1.3; l.glowLR = 18;
            return l;
        }
    },
    {
        id: 'pathFlow', label: 'Path Flow (S-curve)',
        make: function (doc) {
            // частицы рождаются в начале S-кривой и едут по ней (lock + flow)
            const l = M.newEmitter(doc, 'Path Flow');
            l.em.rate = 70; l.em.bursts = [];
            l.em.speed = 0; l.em.speedRnd = 0;
            const pa = l.em.path;
            pa.on = true; pa.mode = 'both'; pa.smooth = true;
            pa.nodes = [{ x: -210, y: 130 }, { x: -70, y: -140 }, { x: 70, y: 140 }, { x: 210, y: -130 }];
            pa.along = 'start'; pa.aim = 'tangent'; pa.jitter = 6;
            pa.lock = 1; pa.flow = 900;
            l.pt.sprite = { kind: 'shape', id: 'dot', p: {} };
            l.pt.life = 1.1; l.pt.lifeRnd = 0.15;
            l.pt.size = 18; l.pt.sizeRnd = 0.4;
            l.pt.sizeOL = AFX.Curve.presets.const1.make();
            l.pt.opacityOL = AFX.Curve.presets.bell.make();
            l.pt.grad = AFX.Grad.presets.energy.make();
            l.pt.drag = 0; l.pt.spin = 0;
            l.pt.glow = 0.6; l.pt.glowSize = 1.8;
            return l;
        }
    },
    {
        id: 'snow', label: 'Snow / Ash',
        make: function (doc) {
            const l = M.newEmitter(doc, 'Snow');
            l.blend = 'normal';
            l.em.rate = 40; l.em.bursts = [];
            l.em.shape = 'box'; l.em.sx = 250; l.em.sy = 20;
            l.em.y = -240;
            l.em.dir = 'dir'; l.em.angle = 90; l.em.spread = 20;
            l.em.speed = 120; l.em.speedRnd = 0.5;
            l.pt.life = 2.4; l.pt.lifeRnd = 0.3;
            l.pt.sprite = { kind: 'shape', id: 'dot', p: {} };
            l.pt.size = 10; l.pt.sizeRnd = 0.6;
            l.pt.sizeOL = AFX.Curve.presets.const1.make();
            l.pt.opacityOL = AFX.Curve.presets.bell.make();
            l.pt.grad = AFX.Grad.presets.white.make();
            l.pt.drag = 0.5; l.pt.turbAmp = 160; l.pt.turbFreq = 0.8;
            return l;
        }
    }
];

// ---------- сериализация ----------
M.stripJson = function (doc) {
    return JSON.stringify(doc, (k, v) => (k && k.charAt(0) === '_') ? undefined : v);
};
M.cleanClone = function (doc) { return JSON.parse(M.stripJson(doc)); };

// файл эффекта: документ + пейлоады текстур
M.effectFile = function (doc) {
    const tex = {};
    (doc.textures || []).forEach(t => {
        const rec = AFX.Sprites.texs.get(t.id);
        if (rec) tex[t.id] = rec.dataURL;
    });
    return { app: 'arcadia-effects', v: M.SCHEMA, doc: M.cleanClone(doc), tex: tex };
};

// загрузка файла эффекта: восстановить текстуры, вернуть doc через cb
M.loadEffectFile = function (file, cb) {
    if (!file || file.app !== 'arcadia-effects' || !file.doc) { cb(null); return; }
    const doc = M.migrate(file.doc);
    const texList = doc.textures || [];
    let waiting = 0;
    let finished = false;
    const tryDone = function () { if (waiting === 0 && !finished) { finished = true; cb(doc); } };
    texList.forEach(meta => {
        const payload = file.tex && file.tex[meta.id];
        if (!payload || AFX.Sprites.texs.has(meta.id)) return;
        waiting++;
        AFX.Sprites.restoreTexture(meta, payload, function () { waiting--; tryDone(); });
    });
    tryDone();
};

// ---------- гидрация разреженных документов ----------
// Дозаполняет недостающие поля дефолтами из фабрик (newDoc/newEmitter/newSprite),
// чтобы файл эффекта мог задавать только отличия от дефолтов (авторинг инструментами).
// Для полных документов — строгий no-op: существующие значения не трогаются.
function isPlainObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
// "атомы" не мержатся поключево: трек {keys}, кривая {pts}, градиент {stops}, спрайт-реф {kind}
function isAtomicObj(v) {
    return isPlainObj(v) && (Array.isArray(v.keys) || Array.isArray(v.pts) || Array.isArray(v.stops) || typeof v.kind === 'string');
}
function fillFrom(dst, tmpl) {
    for (const k in tmpl) {
        if (k.charAt(0) === '_') continue;
        const tv = tmpl[k];
        if (dst[k] == null) dst[k] = AFX.deepClone(tv);
        else if (isPlainObj(tv) && isPlainObj(dst[k]) && !isAtomicObj(tv) && !isAtomicObj(dst[k])) fillFrom(dst[k], tv);
    }
    return dst;
}
M.LAYER_TYPES = { emitter: 1, sprite: 1, atlas: 1, postfx: 1 };
M.layerTemplate = function (doc, type) {
    if (type === 'emitter') return M.newEmitter(doc);
    if (type === 'postfx') return M.newPostFx(doc);
    return type === 'atlas' ? M.newAtlas(doc) : M.newSprite(doc);
};
M.hydrate = function (doc) {
    const dTmpl = M.newDoc();
    // id/name дозаполняются fillFrom из шаблона; свежий uid шаблона уникален
    fillFrom(doc, dTmpl);
    (doc.layers || []).forEach(l => {
        if (!M.LAYER_TYPES[l.type]) l.type = l.sp ? 'sprite' : 'emitter';
        fillFrom(l, M.layerTemplate(doc, l.type));
    });
    return doc;
};

M.migrate = function (doc) {
    // v<2 не знал про em.subStep: старым файлам оставляем пошаговую эмиссию — попиксельно как были
    if ((doc.v | 0) < 2) (doc.layers || []).forEach(l => { if (l.em && l.em.subStep == null) l.em.subStep = false; });
    M.hydrate(doc);
    if (!doc.exp) doc.exp = M.newDoc().exp;
    if (!doc.cam) doc.cam = { comp: 0 };
    if (!doc.textures) doc.textures = [];
    (doc.layers || []).forEach(l => {
        if (l.solo == null) l.solo = false;
        if (l.glowL == null) l.glowL = 0;
        if (l.glowLR == null) l.glowLR = 24;
        if (l.fadeOn == null) { l.fadeOn = false; l.fadeX = 0; l.fadeY = 0; l.fadeR = 220; l.fadeSoft = 0.5; }
        if (l.pt && l.pt.glowBlur == null) l.pt.glowBlur = 0.15;
        if (l.sp && l.sp.glowBlur == null) l.sp.glowBlur = 0.15;
        if (l.pt) {
            if (l.pt.render == null) l.pt.render = 'sprite';
            if (l.pt.trailCore == null) l.pt.trailCore = 0;
            if (l.pt.zigzag == null) l.pt.zigzag = 0;
            if (l.pt.sizeOT == null) l.pt.sizeOT = AFX.Curve.presets.const1.make();
            // файлы до curl-турбулентности: режим шума прежний (hydrate уже дозаполнил
            // и l.pt, и l.em.sub.pt из фабрики — здесь только явная страховка)
            if (l.pt.turbMode == null) l.pt.turbMode = 'noise';
        }
        if (l.em && !l.em.branch) {
            l.em.branch = { chance: 0, spread: 35, lifeScale: 0.6, sizeScale: 0.7, speedScale: 1, maxGen: 2 };
        }
        if (l.type === 'postfx' && !l.fx) l.fx = M.newPostFx(doc).fx;
        if (l.em && !l.em.path) l.em.path = M.newPath();
        else if (l.em && l.em.path.fast == null) l.em.path.fast = true;
        if (l.em && !l.em.sub) l.em.sub = M.newSub();
        else if (l.em && !l.em.sub.pt) l.em.sub.pt = M.newSub().pt;
    });
    doc.v = M.SCHEMA;
    return doc;
};

// синхронизация meta.sheet текстуры документа с реестром
M.syncTexSheets = function (doc) {
    (doc.textures || []).forEach(t => {
        const rec = AFX.Sprites.texs.get(t.id);
        if (rec) rec.sheet = t.sheet || null;
    });
};
})();
