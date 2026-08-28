// Arcaidia Effector — заводские пресеты эффектов (каталог, раздел "Заводские")
(function () {
'use strict';
const AFX = window.AFX;
const M = AFX.Model;
const Curve = AFX.Curve, Grad = AFX.Grad;

function K(t, v, mode) { const k = AFX.Track.newKey(t, v); if (mode) AFX.Track.setEase(k, mode); return k; }
function preset(id) { return M.layerPresets.find(p => p.id === id); }

AFX.Factory = [
    {
        id: 'fx_explosion_top',
        name: 'Explosion — Top-Down',
        thumbT: 0.3,
        build: function () {
            const d = M.newDoc();
            d.name = 'Explosion — Top-Down';
            d.comp.dur = 1.1;
            d.cam.comp = 37; // как изометрия игры (scaleY 0.8)
            d.exp = Object.assign(d.exp, { cols: 3, rows: 3, frames: 9, cellW: 256, cellH: 256 });

            const flash = preset('flash').make(d);
            const shock = preset('shockwave').make(d);

            const fireCore = preset('fireball').make(d);
            fireCore.name = 'Core';
            fireCore.em.bursts = [{ t: 0, n: 16 }];
            fireCore.em.speed = 150;
            fireCore.pt.size = 130; fireCore.pt.life = 0.5;
            fireCore.pt.grad = Grad.presets.fireHot.make();
            fireCore.pt.squash = 0.7; fireCore.pt.glow = 0.5;

            const fire = preset('fireball').make(d);
            fire.name = 'Flame';
            fire.blend = 'normal';
            fire.em.bursts = [{ t: 0.02, n: 20 }];
            fire.em.shape = 'circle'; fire.em.sx = 60; fire.em.sy = 44;
            fire.em.speed = 240;
            fire.pt.life = 0.7; fire.pt.size = 110;
            fire.pt.grad = Grad.presets.fire.make();
            fire.pt.squash = 0.55; fire.pt.spin = 90;

            const sparks = preset('sparks').make(d);
            sparks.em.bursts = [{ t: 0, n: 34 }];
            sparks.pt.gravY = 60; sparks.pt.squash = 0;
            sparks.pt.grad = Grad.make([[0, '#ffffff'], [0.35, '#bfefff'], [0.7, '#ffcf6a'], [1, '#c05018']]);

            const smoke = preset('smokeCloud').make(d);
            smoke.start = 0.16; smoke.end = 0.5;
            smoke.pt.life = 0.85; smoke.pt.squash = 0.4;

            d.layers = [flash, sparks, shock, fireCore, fire, smoke];
            return d;
        }
    },
    {
        id: 'fx_explosion_side',
        name: 'Explosion — Side (Cartoon)',
        thumbT: 0.28,
        build: function () {
            const d = M.newDoc();
            d.name = 'Explosion — Side (Cartoon)';
            d.comp.dur = 0.9;
            d.cam.comp = 0;
            d.exp = Object.assign(d.exp, { cols: 8, rows: 1, frames: 8, cellW: 160, cellH: 160 });

            const core = M.newEmitter(d, 'Core (yellow)');
            core.blend = 'normal';
            core.end = 0.25;
            core.em.shape = 'circle'; core.em.sx = 34; core.em.sy = 26;
            core.em.bursts = [{ t: 0, n: 12 }, { t: 0.08, n: 6 }];
            core.em.speed = 170; core.em.speedRnd = 0.5;
            core.pt.sprite = { kind: 'shape', id: 'blob', p: {} };
            core.pt.life = 0.5; core.pt.lifeRnd = 0.3;
            core.pt.size = 95; core.pt.sizeRnd = 0.4;
            core.pt.sizeOL = Curve.presets.popShrink.make();
            core.pt.opacityOL = Curve.make([[0, 1], [0.8, 1], [1, 0]]);
            core.pt.grad = Grad.make([[0, '#fff7d9'], [0.3, '#ffdf6b'], [0.65, '#ffb03a'], [1, '#e2701d']]);
            core.pt.drag = 4; core.pt.gravY = -90; core.pt.spin = 60;

            const outer = M.newEmitter(d, 'Puffs (orange)');
            outer.blend = 'normal';
            outer.end = 0.3;
            outer.em.shape = 'circle'; outer.em.sx = 52; outer.em.sy = 40;
            outer.em.bursts = [{ t: 0, n: 14 }, { t: 0.12, n: 8 }];
            outer.em.speed = 230; outer.em.speedRnd = 0.55;
            outer.pt.sprite = { kind: 'shape', id: 'blob', p: {} };
            outer.pt.life = 0.65; outer.pt.lifeRnd = 0.35;
            outer.pt.size = 105; outer.pt.sizeRnd = 0.45;
            outer.pt.sizeOL = Curve.presets.growFast.make();
            outer.pt.opacityOL = Curve.make([[0, 1], [0.75, 1], [1, 0]]);
            outer.pt.grad = Grad.make([[0, '#ffb03a'], [0.45, '#f07020'], [0.8, '#8a3414'], [1, '#402019']]);
            outer.pt.drag = 3.4; outer.pt.gravY = -120; outer.pt.spin = 80;

            const dark = M.newEmitter(d, 'Soot');
            dark.blend = 'normal';
            dark.start = 0.18; dark.end = 0.45;
            dark.em.shape = 'circle'; dark.em.sx = 66; dark.em.sy = 50;
            dark.em.bursts = [{ t: 0, n: 12 }];
            dark.em.speed = 150; dark.em.speedRnd = 0.5;
            dark.pt.sprite = { kind: 'shape', id: 'blob', p: {} };
            dark.pt.life = 0.55; dark.pt.lifeRnd = 0.3;
            dark.pt.size = 90; dark.pt.sizeRnd = 0.45;
            dark.pt.sizeOL = Curve.presets.grow.make();
            dark.pt.opacityOL = Curve.make([[0, 0.9], [0.7, 0.8], [1, 0]]);
            dark.pt.grad = Grad.make([[0, '#6b4a33'], [0.5, '#453029'], [1, '#241a16']]);
            dark.pt.drag = 3; dark.pt.gravY = -140; dark.pt.spin = 70;

            const debris = preset('debris').make(d);
            debris.em.bursts = [{ t: 0, n: 10 }];

            d.layers = [core, outer, debris, dark];
            return d;
        }
    },
    {
        id: 'fx_smoke_mask',
        name: 'Smoke — Mask',
        thumbT: 0.4,
        build: function () {
            const d = M.newDoc();
            d.name = 'Smoke — Mask';
            d.comp.dur = 1.4;
            d.cam.comp = 0;
            d.exp = Object.assign(d.exp, { cols: 4, rows: 3, frames: 12, cellW: 256, cellH: 192, mode: 'mask', thr: 0.45 });

            const puffs = M.newEmitter(d, 'Puffs');
            puffs.blend = 'normal';
            puffs.end = 0.35;
            puffs.em.shape = 'circle'; puffs.em.sx = 44; puffs.em.sy = 34;
            puffs.em.bursts = [{ t: 0, n: 10 }, { t: 0.12, n: 8 }];
            puffs.em.speed = 190; puffs.em.speedRnd = 0.55;
            puffs.pt.sprite = { kind: 'shape', id: 'smoke', p: {} };
            puffs.pt.life = 1.05; puffs.pt.lifeRnd = 0.3;
            puffs.pt.size = 130; puffs.pt.sizeRnd = 0.4;
            puffs.pt.sizeOL = Curve.presets.grow.make();
            puffs.pt.opacityOL = Curve.make([[0, 1], [0.6, 0.95], [1, 0]]);
            puffs.pt.grad = Grad.presets.white.make();
            puffs.pt.drag = 2.8; puffs.pt.gravY = -70;
            puffs.pt.spin = 50; puffs.pt.turbAmp = 120; puffs.pt.turbFreq = 1.2;

            d.layers = [puffs];
            return d;
        }
    },
    {
        id: 'fx_shockwave',
        name: 'Shockwave',
        thumbT: 0.35,
        build: function () {
            const d = M.newDoc();
            d.name = 'Shockwave';
            d.comp.dur = 0.6;
            d.cam.comp = 37;
            d.exp = Object.assign(d.exp, { cols: 4, rows: 2, frames: 8, cellW: 256, cellH: 208 });
            const shock = preset('shockwave').make(d);
            const ring = preset('ringBurst').make(d);
            ring.pt.squash = 1;
            const flash = preset('flash').make(d);
            flash.sp.squash = 0.6;
            d.layers = [flash, ring, shock];
            return d;
        }
    },
    {
        id: 'fx_sparks',
        name: 'Spark Burst',
        thumbT: 0.25,
        build: function () {
            const d = M.newDoc();
            d.name = 'Spark Burst';
            d.comp.dur = 0.8;
            d.exp = Object.assign(d.exp, { cols: 4, rows: 2, frames: 8, cellW: 192, cellH: 192 });
            const sparks = preset('sparks').make(d);
            sparks.em.bursts = [{ t: 0, n: 40 }];
            const flash = preset('flash').make(d);
            flash.sp.size = 160;
            d.layers = [flash, sparks];
            return d;
        }
    },
    {
        id: 'fx_flame_loop',
        name: 'Flame — Loop',
        thumbT: 2.0,
        build: function () {
            const d = M.newDoc();
            d.name = 'Flame — Loop';
            d.comp.dur = 3;
            d.exp = Object.assign(d.exp, { cols: 4, rows: 4, frames: 16, cellW: 128, cellH: 192, t0: 1.5, t1: 2.5 });
            const flame = preset('flame').make(d);
            flame.em.y = 140;
            const glowL = M.newSprite(d, 'Underglow');
            glowL.sp.size = 240;
            glowL.sp.x = 0; glowL.sp.y = 120;
            glowL.opacity = 0.35;
            glowL.sp.scale = 1;
            glowL.sp.color = AFX.hexToRgb('#ff9c3f');
            glowL.sp.glow = 0.5;
            d.layers = [flame, glowL];
            return d;
        }
    },
    {
        id: 'fx_energy_ring',
        name: 'Energy Ring',
        thumbT: 0.3,
        build: function () {
            const d = M.newDoc();
            d.name = 'Energy Ring';
            d.comp.dur = 0.8;
            d.cam.comp = 37;
            d.exp = Object.assign(d.exp, { cols: 3, rows: 3, frames: 9, cellW: 192, cellH: 160 });

            const ring = preset('ringBurst').make(d);
            ring.pt.squash = 1;
            ring.pt.grad = Grad.presets.energy.make();

            const wave = preset('shockwave').make(d);
            wave.sp.color = AFX.hexToRgb('#59e3e2');
            wave.sp.glow = { keys: [K(0, 0.9), K(0.5, 0)] };

            const spark2 = preset('sparks').make(d);
            spark2.em.bursts = [{ t: 0, n: 18 }];
            spark2.pt.grad = Grad.presets.ice.make();
            spark2.pt.gravY = 0;

            d.layers = [wave, spark2, ring];
            return d;
        }
    },
    {
        id: 'fx_lightning',
        name: 'Lightning Strike',
        thumbT: 0.32,
        build: function () {
            const d = M.newDoc();
            d.name = 'Lightning Strike';
            d.comp.dur = 0.8;
            d.cam.comp = 0;
            d.exp = Object.assign(d.exp, { cols: 4, rows: 2, frames: 8, cellW: 160, cellH: 256 });

            // небо мерцает в такт разряду
            const sky = M.newSprite(d, 'Sky flash');
            sky.blend = 'add';
            sky.end = 0.5;
            sky.sp.sprite = { kind: 'shape', id: 'soft', p: {} };
            sky.sp.size = 460;
            sky.sp.y = -140;
            sky.sp.scale = 1.4;
            sky.sp.color = AFX.hexToRgb('#cfe4ff');
            sky.opacity = { keys: [K(0, 0.55), K(0.07, 0.1), K(0.13, 0.4), K(0.2, 0.08), K(0.3, 0.25), K(0.5, 0)] };
            sky.sp.glow = 0.5;

            const bolt = preset('lightning').make(d);

            // удар в землю: вспышка и искры в момент прихода разряда
            const impact = M.newSprite(d, 'Impact flash');
            impact.blend = 'add';
            impact.start = 0.3; impact.end = 0.62;
            impact.sp.sprite = { kind: 'shape', id: 'soft', p: {} };
            impact.sp.size = 260;
            impact.sp.y = 205;
            impact.sp.scale = { keys: [K(0, 0.35, 'easeOut'), K(0.2, 1.2)] };
            impact.opacity = { keys: [K(0, 1), K(0.08, 0.9), K(0.32, 0)] };
            impact.sp.color = AFX.hexToRgb('#eaf4ff');
            impact.sp.squash = 0.55;
            impact.sp.glow = 1;

            const sparks = preset('sparks').make(d);
            sparks.name = 'Impact sparks';
            sparks.start = 0.3; sparks.end = 0.42;
            sparks.em.y = 205;
            sparks.em.bursts = [{ t: 0, n: 20 }];
            sparks.em.speed = 520;
            sparks.pt.grad = Grad.make([[0, '#ffffff'], [0.4, '#bfe2ff'], [1, '#3f6ad8']]);
            sparks.pt.gravY = 700;
            sparks.pt.life = 0.4;

            d.layers = [impact, sparks, bolt, sky];
            return d;
        }
    }
];
})();
