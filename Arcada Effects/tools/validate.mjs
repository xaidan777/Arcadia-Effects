// Arcaidia Effector — headless-валидатор файлов эффектов (library/*.json или голый doc).
// Ноль зависимостей: поднимает js/core в Node (без DOM) и проверяет документ
// структурно + прогоняет детерминированную симуляцию каждого эмиттера.
//
//   node tools/validate.mjs library/Sparks.json [ещё файлы...]
//   node tools/validate.mjs            (все library/*.json)
//
// Exit code: 0 — без ошибок (warnings допустимы), 1 — есть ошибки.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// classic scripts вешаются на window.AFX; canvas на этапе загрузки не нужен
globalThis.window = globalThis;
for (const f of ['utils', 'track', 'curve', 'path', 'sprites', 'model', 'sim']) {
    const p = path.join(ROOT, 'js', 'core', f + '.js');
    vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: 'js/core/' + f + '.js' });
}
const AFX = globalThis.AFX;
const M = AFX.Model, T = AFX.Track;

// ---------- справочники схемы ----------
const ENUMS = {
    'layer.type': ['emitter', 'sprite', 'atlas', 'postfx'],
    'layer.blend': ['normal', 'add', 'screen', 'multiply'],
    'em.shape': ['point', 'circle', 'ring', 'box', 'line'],
    'em.dir': ['out', 'in', 'omni', 'dir'],
    'path.mode': ['emit', 'guide', 'both'],
    'path.along': ['random', 'even', 'start'],
    'path.aim': ['none', 'tangent', 'normal'],
    'pt.render': ['sprite', 'trail'],
    'pt.turbMode': ['noise', 'curl'],
    'sub.emit': ['life', 'death', 'both'],
    'sub.dir': ['omni', 'inherit', 'back', 'out'],
    'fx.effect': ['mblur', 'displace'],
    'fx.mode': ['directional', 'radial'],
    'fx.field': ['swirl', 'tear'],
    'exp.mode': ['rgba', 'black', 'mask'],
    'keyMode': ['lin', 'ease', 'hold', 'cust']
};
// какие поля — анимируемые треки (число ИЛИ {keys}); всё прочее числовое — только статика
const TRACKABLE = {
    layer: ['opacity', 'glowL', 'fadeX', 'fadeY', 'fadeR'],
    em: ['x', 'y', 'sx', 'sy', 'angle', 'spread', 'speed', 'rate'],
    pt: ['size', 'gravX', 'gravY', 'turbAmp'],
    sub: ['rate', 'speed'],
    path: ['jitter', 'attract', 'lock', 'flow'],
    sp: ['x', 'y', 'scale', 'rot', 'glow', 'color'],
    fx: ['length', 'angle', 'spin', 'x', 'y', 'amount', 'y0']
};
// статические числовые поля блока частицы (треки здесь не поддерживаются)
const PT_STATIC = ['life', 'lifeRnd', 'sizeRnd', 'rot', 'rotRnd', 'spin', 'spinRnd', 'stretch', 'drag', 'turbFreq', 'zigzag', 'squash', 'glow', 'glowSize', 'glowBlur', 'trailCore', 'fps',
    'turbScale', 'turbOct', 'turbRise', 'turbWind', 'turbSeed', 'turbRamp'];
const COLOR_TRACKS = new Set(['sp.color']);
const WRAPPER_KEYS = new Set(['app', 'v', 'doc', 'tex', 'thumb']);
const FX_STATIC = ['scale', 'aspect', 'oct', 'evo', 'rise', 'ramp', 'soft', 'seed']; // displace: статика
const FX_SAMPLES = [2, 4, 8, 16, 32, 64]; // engine.js: сэмплы смаза — степень двойки
const MAX_PARTS = 5000; // sim.js: жёсткий кап частиц на слой

// ---------- отчёт ----------
function makeReport(file) {
    return { file, errors: [], warns: [], infos: [] };
}
const err = (r, m) => r.errors.push(m);
const warn = (r, m) => r.warns.push(m);
const info = (r, m) => r.infos.push(m);

const isNum = v => typeof v === 'number' && isFinite(v);
const isPlainObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isColorV = v => Array.isArray(v) && v.length === 3 && v.every(isNum);

// ---------- треки / кривые / градиенты ----------
function checkTrack(r, at, tr, colorOk) {
    if (isNum(tr)) return;
    if (colorOk && isColorV(tr)) return;
    if (!isPlainObj(tr) || !Array.isArray(tr.keys)) {
        err(r, `${at}: expected number${colorOk ? ' | [r,g,b]' : ''} | {keys:[...]}, got ${JSON.stringify(tr)}`);
        return;
    }
    if (!tr.keys.length) { warn(r, `${at}: track has no keys (evaluates to 0)`); return; }
    let prev = -Infinity;
    tr.keys.forEach((k, i) => {
        const kat = `${at}.keys[${i}]`;
        if (!isPlainObj(k)) { err(r, `${kat}: expected {t,v,...}`); return; }
        for (const kk of Object.keys(k)) if (!['t', 'v', 'i', 'o'].includes(kk)) warn(r, `${kat}: unknown key "${kk}"`);
        if (!isNum(k.t)) err(r, `${kat}.t: not a finite number`);
        else {
            if (k.t < 0) warn(r, `${kat}.t=${k.t}: key time < 0 (editor clamps keys to >= 0)`);
            if (k.t < prev) err(r, `${at}: keys not sorted by t (key[${i}] t=${k.t} after ${prev}) — sort ascending`);
            prev = Math.max(prev, k.t);
        }
        if (colorOk ? !(isColorV(k.v) || isNum(k.v)) : !isNum(k.v)) err(r, `${kat}.v: bad value ${JSON.stringify(k.v)}`);
        for (const side of ['i', 'o']) {
            const s = k[side];
            if (s == null) continue;
            if (!isPlainObj(s) || (s.m != null && !ENUMS.keyMode.includes(s.m))) err(r, `${kat}.${side}: mode must be one of ${ENUMS.keyMode.join('|')}`);
            if (s.m === 'hold' && side === 'i') warn(r, `${kat}.i: "hold" is an out-mode (o), ignored on i`);
            if (s.m === 'cust' && !(Array.isArray(s.h) && s.h.length === 2 && s.h.every(isNum))) err(r, `${kat}.${side}: cust needs h=[x,y]`);
        }
    });
}
function checkCurve(r, at, c) {
    if (!isPlainObj(c) || !Array.isArray(c.pts) || !c.pts.length) { err(r, `${at}: expected {pts:[{t,v},...]}`); return; }
    let prev = -Infinity;
    c.pts.forEach((p, i) => {
        if (!isPlainObj(p) || !isNum(p.t) || !isNum(p.v)) { err(r, `${at}.pts[${i}]: expected {t:0..1, v:number}`); return; }
        if (p.t < 0 || p.t > 1) warn(r, `${at}.pts[${i}].t=${p.t}: life curve time is 0..1`);
        if (p.t < prev) err(r, `${at}: pts not sorted by t`);
        prev = Math.max(prev, p.t);
        if (p.v < 0) warn(r, `${at}.pts[${i}].v=${p.v}: negative (engine clamps to >= 0)`);
    });
}
function checkGrad(r, at, g) {
    if (!isPlainObj(g) || !Array.isArray(g.stops) || !g.stops.length) { err(r, `${at}: expected {stops:[{t,c:[r,g,b]},...]}`); return; }
    let prev = -Infinity;
    g.stops.forEach((s, i) => {
        if (!isPlainObj(s) || !isNum(s.t) || !isColorV(s.c)) { err(r, `${at}.stops[${i}]: expected {t:0..1, c:[r,g,b]}`); return; }
        if (s.t < 0 || s.t > 1) warn(r, `${at}.stops[${i}].t=${s.t}: gradient time is 0..1`);
        if (s.t < prev) err(r, `${at}: stops not sorted by t`);
        prev = Math.max(prev, s.t);
        if (s.c.some(x => x < 0 || x > 255)) warn(r, `${at}.stops[${i}].c: channels must be 0..255`);
    });
}
function checkSpriteRef(r, at, ref, doc, wrapper) {
    if (!isPlainObj(ref) || (ref.kind !== 'shape' && ref.kind !== 'tex')) { err(r, `${at}: expected {kind:'shape',id,p} | {kind:'tex',texId}`); return; }
    if (ref.kind === 'shape') {
        const def = AFX.Sprites.shapeDef(ref.id);
        if (!def) { err(r, `${at}.id="${ref.id}": unknown shape (known: ${AFX.Sprites.shapeDefs.map(d => d.id).join(', ')})`); return; }
        const known = new Set(['var', ...(def.params || []).map(p => p.k)]);
        for (const k of Object.keys(ref.p || {})) {
            if (!known.has(k)) { warn(r, `${at}.p.${k}: shape "${ref.id}" has no such param`); continue; }
            const spec = (def.params || []).find(p => p.k === k);
            if (spec && isNum(ref.p[k]) && (ref.p[k] < spec.min || ref.p[k] > spec.max)) warn(r, `${at}.p.${k}=${ref.p[k]}: outside ${spec.min}..${spec.max}`);
        }
    } else {
        if (!(doc.textures || []).some(t => t.id === ref.texId)) err(r, `${at}.texId="${ref.texId}": not in doc.textures`);
        else if (wrapper && !(wrapper.tex && wrapper.tex[ref.texId])) warn(r, `${at}: texture payload for "${ref.texId}" missing in file.tex (relies on session registry)`);
    }
}

// ---------- неизвестные ключи (до гидрации): ловим опечатки ----------
function checkUnknownKeys(r, doc) {
    const docT = M.newDoc();
    const scanObj = (at, obj, tmpl) => {
        if (!isPlainObj(obj)) return;
        for (const k of Object.keys(obj)) {
            if (k.charAt(0) === '_') continue;
            if (!(k in tmpl)) warn(r, `${at}.${k}: unknown key (typo?)`);
        }
    };
    scanObj('doc', doc, docT);
    for (const sub of ['comp', 'cam', 'exp']) scanObj('doc.' + sub, doc[sub], docT[sub]);
    (doc.textures || []).forEach((t, i) => scanObj(`textures[${i}]`, t, { id: 1, name: 1, sheet: 1 }));
    const emT = M.newEmitter(docT), spT = M.newSprite(docT), atT = M.newAtlas(docT), fxT = M.newPostFx(docT);
    (doc.layers || []).forEach((l, i) => {
        if (!isPlainObj(l)) { err(r, `layers[${i}]: not an object`); return; }
        const type = ENUMS['layer.type'].includes(l.type) ? l.type : (l.type == null && l.sp ? 'sprite' : 'emitter');
        const lt = type === 'emitter' ? emT : (type === 'atlas' ? atT : (type === 'postfx' ? fxT : spT));
        const at = `layers[${i}]"${l.name || ''}"`;
        scanObj(at, l, lt);
        if (type === 'postfx') {
            scanObj(at + '.fx', l.fx, fxT.fx);
        } else if (type === 'emitter') {
            scanObj(at + '.em', l.em, emT.em);
            if (l.em) scanObj(at + '.em.branch', l.em.branch, emT.em.branch);
            if (l.em) scanObj(at + '.em.sub', l.em.sub, emT.em.sub);
            if (l.em && l.em.sub) scanObj(at + '.em.sub.pt', l.em.sub.pt, emT.em.sub.pt);
            scanObj(at + '.pt', l.pt, emT.pt);
        } else {
            scanObj(at + '.sp', l.sp, lt.sp);
            // фабричные дефолты СПРАЙТА анимированы — неявное появление/затухание (у atlas — статика)
            if (type === 'sprite') {
                if (l.opacity == null) warn(r, `${at}: no explicit opacity — factory default is an animated fade-out`);
                if (l.sp && l.sp.scale == null) warn(r, `${at}: no explicit sp.scale — factory default is an animated scale-up`);
            }
        }
    });
}

// ---------- проверки после migrate/hydrate ----------
function checkDoc(r, doc, wrapper) {
    if (!isNum(doc.comp.dur) || doc.comp.dur <= 0) err(r, `comp.dur=${doc.comp.dur}: must be > 0`);
    if (!isNum(doc.comp.w) || !isNum(doc.comp.h) || doc.comp.w < 8 || doc.comp.h < 8) err(r, `comp ${doc.comp.w}x${doc.comp.h}: bad size`);
    if (!ENUMS['exp.mode'].includes(doc.exp.mode)) err(r, `exp.mode="${doc.exp.mode}": ${ENUMS['exp.mode'].join('|')}`);
    const cells = (doc.exp.cols | 0) * (doc.exp.rows | 0);
    if ((doc.exp.frames | 0) > cells) warn(r, `exp.frames=${doc.exp.frames} > cols*rows=${cells}: atlas clamps to ${cells}`);
    if (isNum(doc.exp.t1) && doc.exp.t1 >= 0 && doc.exp.t1 <= doc.exp.t0) warn(r, `exp: t1=${doc.exp.t1} <= t0=${doc.exp.t0}`);

    const ids = new Set();
    if (ids.has(doc.id)) err(r, `doc.id duplicate`); ids.add(doc.id);
    (doc.layers || []).forEach((l, i) => {
        const at = `layers[${i}]"${l.name}"`;
        if (ids.has(l.id)) err(r, `${at}: duplicate id "${l.id}"`); ids.add(l.id);
        if (!ENUMS['layer.type'].includes(l.type)) { err(r, `${at}.type="${l.type}"`); return; }
        if (!ENUMS['layer.blend'].includes(l.blend)) err(r, `${at}.blend="${l.blend}": ${ENUMS['layer.blend'].join('|')}`);
        if (l.end <= l.start) warn(r, `${at}: end=${l.end} <= start=${l.start} (${l.type === 'emitter' ? 'no emission window' : 'never visible'})`);
        if (l.start >= doc.comp.dur) warn(r, `${at}: start=${l.start} >= comp.dur=${doc.comp.dur} (never active)`);
        TRACKABLE.layer.forEach(k => checkTrack(r, `${at}.${k}`, l[k], false));

        if (l.type === 'emitter') {
            const em = l.em, pt = l.pt;
            if (!ENUMS['em.shape'].includes(em.shape)) err(r, `${at}.em.shape="${em.shape}": ${ENUMS['em.shape'].join('|')}`);
            if (!ENUMS['em.dir'].includes(em.dir)) err(r, `${at}.em.dir="${em.dir}": ${ENUMS['em.dir'].join('|')}`);
            if (!ENUMS['pt.render'].includes(pt.render)) err(r, `${at}.pt.render="${pt.render}": ${ENUMS['pt.render'].join('|')}`);
            if (!ENUMS['pt.turbMode'].includes(pt.turbMode)) err(r, `${at}.pt.turbMode="${pt.turbMode}": ${ENUMS['pt.turbMode'].join('|')}`);
            TRACKABLE.em.forEach(k => checkTrack(r, `${at}.em.${k}`, em[k], false));
            TRACKABLE.pt.forEach(k => checkTrack(r, `${at}.pt.${k}`, pt[k], false));
            // статические числовые поля не принимают треки
            for (const [obj, keys, tag] of [[em, ['speedRnd', 'seed'], 'em'], [pt, PT_STATIC, 'pt']])
                keys.forEach(k => { if (!isNum(obj[k])) err(r, `${at}.${tag}.${k}: static number expected (tracks not supported here), got ${JSON.stringify(obj[k])}`); });
            (em.bursts || []).forEach((b, bi) => {
                if (!isPlainObj(b) || !isNum(b.t) || !isNum(b.n)) { err(r, `${at}.em.bursts[${bi}]: expected {t,n}`); return; }
                if (b.t > l.end - l.start + 1e-9) warn(r, `${at}.em.bursts[${bi}].t=${b.t}: beyond emission window ${(l.end - l.start).toFixed(3)}s — never fires`);
            });
            const staticRate = isNum(em.rate) ? em.rate : null;
            const liveBursts = (em.bursts || []).some(b => isNum(b.n) && b.n > 0 && b.t <= l.end - l.start + 1e-9);
            if (staticRate === 0 && !liveBursts) warn(r, `${at}: rate=0 and no bursts in window — emitter spawns nothing`);
            checkCurve(r, `${at}.pt.sizeOL`, pt.sizeOL);
            checkCurve(r, `${at}.pt.sizeOT`, pt.sizeOT);
            checkCurve(r, `${at}.pt.opacityOL`, pt.opacityOL);
            checkGrad(r, `${at}.pt.grad`, pt.grad);
            checkSpriteRef(r, `${at}.pt.sprite`, pt.sprite, doc, wrapper);
            if (pt.render === 'trail' && pt.glow === 0 && T.val(l.glowL, 0) === 0) info(r, `${at}: trail without glow/glowL — lightning-style layers usually use layer glow (glowL)`);

            // ПУТЬ ДВИЖЕНИЯ: узлы — пары анимируемых треков x/y
            const pa = em.path;
            if (isPlainObj(pa)) {
                const pat = `${at}.em.path`;
                if (!ENUMS['path.mode'].includes(pa.mode)) err(r, `${pat}.mode="${pa.mode}": ${ENUMS['path.mode'].join('|')}`);
                if (!ENUMS['path.along'].includes(pa.along)) err(r, `${pat}.along="${pa.along}": ${ENUMS['path.along'].join('|')}`);
                if (!ENUMS['path.aim'].includes(pa.aim)) err(r, `${pat}.aim="${pa.aim}": ${ENUMS['path.aim'].join('|')}`);
                TRACKABLE.path.forEach(k => checkTrack(r, `${pat}.${k}`, pa[k], false));
                if (!Array.isArray(pa.nodes)) err(r, `${pat}.nodes: expected an array of {x,y}`);
                else {
                    pa.nodes.forEach((nd, ni) => {
                        if (!isPlainObj(nd)) { err(r, `${pat}.nodes[${ni}]: expected {x,y}`); return; }
                        checkTrack(r, `${pat}.nodes[${ni}].x`, nd.x, false);
                        checkTrack(r, `${pat}.nodes[${ni}].y`, nd.y, false);
                    });
                    if (pa.on && pa.nodes.length < 2) warn(r, `${pat}: enabled with ${pa.nodes.length} node(s) — a path needs at least 2`);
                }
                if (pa.on) {
                    const mode = pa.mode || 'emit';
                    if ((mode === 'guide' || mode === 'both')
                        && isNum(pa.attract) && pa.attract <= 0
                        && isNum(pa.lock) && pa.lock <= 0
                        && isNum(pa.flow) && pa.flow === 0) {
                        warn(r, `${pat}: guide mode with attract=0, lock=0, flow=0 — particles are not guided`);
                    }
                    if (mode !== 'emit' && em.shape !== 'point') info(r, `${pat}: em.shape="${em.shape}" still shapes the spawn area (path guides motion only)`);
                }
            }

            // СУБ-ЭМИТТЕР: свой блок частицы, те же правила, что у pt
            const sub = em.sub, spt = sub && sub.pt;
            if (isPlainObj(sub) && isPlainObj(spt)) {
                const sat = `${at}.em.sub`;
                if (!ENUMS['sub.emit'].includes(sub.emit)) err(r, `${sat}.emit="${sub.emit}": ${ENUMS['sub.emit'].join('|')}`);
                if (!ENUMS['sub.dir'].includes(sub.dir)) err(r, `${sat}.dir="${sub.dir}": ${ENUMS['sub.dir'].join('|')}`);
                if (!ENUMS['pt.render'].includes(spt.render)) err(r, `${sat}.pt.render="${spt.render}": ${ENUMS['pt.render'].join('|')}`);
                if (!ENUMS['pt.turbMode'].includes(spt.turbMode)) err(r, `${sat}.pt.turbMode="${spt.turbMode}": ${ENUMS['pt.turbMode'].join('|')}`);
                TRACKABLE.sub.forEach(k => checkTrack(r, `${sat}.${k}`, sub[k], false));
                TRACKABLE.pt.forEach(k => checkTrack(r, `${sat}.pt.${k}`, spt[k], false));
                for (const [obj, keys, tag] of [[sub, ['count', 'startAt', 'spread', 'speedRnd', 'inherit', 'maxGen', 'genScale', 'budget'], 'em.sub'], [spt, PT_STATIC, 'em.sub.pt']])
                    keys.forEach(k => { if (!isNum(obj[k])) err(r, `${at}.${tag}.${k}: static number expected (tracks not supported here), got ${JSON.stringify(obj[k])}`); });
                checkCurve(r, `${sat}.pt.sizeOL`, spt.sizeOL);
                checkCurve(r, `${sat}.pt.sizeOT`, spt.sizeOT);
                checkCurve(r, `${sat}.pt.opacityOL`, spt.opacityOL);
                checkGrad(r, `${sat}.pt.grad`, spt.grad);
                checkSpriteRef(r, `${sat}.pt.sprite`, spt.sprite, doc, wrapper);
                if (sub.on) {
                    const byLife = sub.emit === 'life' || sub.emit === 'both';
                    const byDeath = sub.emit === 'death' || sub.emit === 'both';
                    const liveRate = byLife && (isNum(sub.rate) ? sub.rate > 0 : true);
                    if (!liveRate && !(byDeath && sub.count > 0)) warn(r, `${sat}: enabled but emits nothing (rate=0 / count=0 for emit="${sub.emit}")`);
                    if (sub.budget <= 0) warn(r, `${sat}.budget=${sub.budget}: no child particles will ever be born`);
                }
            }
        } else if (l.type === 'postfx') {
            const fx = l.fx;
            if (!ENUMS['fx.effect'].includes(fx.effect)) err(r, `${at}.fx.effect="${fx.effect}": ${ENUMS['fx.effect'].join('|')}`);
            if (!ENUMS['fx.mode'].includes(fx.mode)) err(r, `${at}.fx.mode="${fx.mode}": ${ENUMS['fx.mode'].join('|')}`);
            TRACKABLE.fx.forEach(k => checkTrack(r, `${at}.fx.${k}`, fx[k], false));
            if (!FX_SAMPLES.includes(fx.samples | 0)) err(r, `${at}.fx.samples=${fx.samples}: one of ${FX_SAMPLES.join('|')}`);
            if (typeof fx.half !== 'boolean') err(r, `${at}.fx.half: boolean expected, got ${JSON.stringify(fx.half)}`);
            FX_STATIC.forEach(k => { if (!isNum(fx[k])) err(r, `${at}.fx.${k}: static number expected (tracks not supported here), got ${JSON.stringify(fx[k])}`); });
            if (fx.effect === 'displace') {
                if (!ENUMS['fx.field'].includes(fx.field)) err(r, `${at}.fx.field="${fx.field}": ${ENUMS['fx.field'].join('|')}`);
                const constAmt = isNum(fx.amount) ? fx.amount : null;
                if (constAmt === 0) warn(r, `${at}: displace amount is 0 — the layer does nothing`);
                if (fx.oct < 1 || fx.oct > 4) warn(r, `${at}.fx.oct=${fx.oct}: outside 1..4 (engine clamps)`);
                if (fx.aspect <= 0) err(r, `${at}.fx.aspect=${fx.aspect}: must be > 0`);
                if (fx.scale < 4) warn(r, `${at}.fx.scale=${fx.scale}: below 4px (engine clamps) — folds smaller than a pixel grid`);
            } else {
                const constLen = isNum(fx.length) ? fx.length : null;
                const constSpin = isNum(fx.spin) ? fx.spin : null;
                if (constLen === 0 && (fx.mode !== 'radial' || constSpin === 0)) warn(r, `${at}: blur length is 0 — the layer does nothing`);
            }
            if (isNum(l.opacity) && l.opacity === 0) warn(r, `${at}: effect strength (opacity) is 0 — the layer does nothing`);
            const below = doc.layers.slice(i + 1).filter(x => x.on).length;
            if (!below) warn(r, `${at}: no visible layers below — a post-effect processes only what is under it`);
        } else {
            const sp = l.sp;
            TRACKABLE.sp.forEach(k => checkTrack(r, `${at}.sp.${k}`, sp[k], COLOR_TRACKS.has('sp.' + k)));
            ['size', 'aspect', 'squash', 'glowSize', 'glowBlur', 'fps'].forEach(k => { if (!isNum(sp[k])) err(r, `${at}.sp.${k}: static number expected, got ${JSON.stringify(sp[k])}`); });
            checkSpriteRef(r, `${at}.sp.sprite`, sp.sprite, doc, wrapper);
        }
    });

    // NaN/Infinity в любом числовом листе
    (function walk(v, at) {
        if (typeof v === 'number') { if (!isFinite(v)) err(r, `${at}: non-finite number`); return; }
        if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`)); return; }
        if (isPlainObj(v)) for (const k of Object.keys(v)) { if (k.charAt(0) !== '_') walk(v[k], `${at}.${k}`); }
    })(doc, 'doc');
}

// ---------- прогон симуляции ----------
function simLayer(r, doc, l, i) {
    if (l.type !== 'emitter') return;
    const at = `layers[${i}]"${l.name}"${l.on ? '' : ' (off)'}`;
    const layer = JSON.parse(M.stripJson(l));
    const tlEnd = doc.comp.dur - layer.start;
    if (tlEnd <= 0) { warn(r, `${at}: layer starts after composition end — skipped sim`); return; }
    let sim;
    try { sim = new AFX.Sim(layer); } catch (e) { err(r, `${at}: Sim crashed on reset: ${e.message}`); return; }
    let spawned = 0;
    for (const m of ['spawn', 'spawnBranch', 'spawnSub']) {
        const orig = sim[m] ? sim[m].bind(sim) : AFX.Sim.prototype[m].bind(sim);
        sim[m] = function () { const b = sim.parts.length; orig.apply(null, arguments); spawned += sim.parts.length - b; };
    }
    let peak = 0, peakT = 0, peakSub = 0;
    try {
        const STEPS = 48;
        for (let s = 1; s <= STEPS; s++) {
            const tl = tlEnd * s / STEPS;
            sim.ensure(layer, tl);
            if (sim.parts.length > peak) { peak = sim.parts.length; peakT = tl + layer.start; }
            if (sim.subN > peakSub) peakSub = sim.subN;
        }
    } catch (e) { err(r, `${at}: Sim crashed while stepping: ${e.message}`); return; }
    for (const p of sim.parts) {
        if (![p.x, p.y, p.vx, p.vy, p.age, p.life, p.size0].every(isFinite)) {
            err(r, `${at}: non-finite particle state after sim (check numeric fields of em/pt)`);
            break;
        }
    }
    if (spawned === 0) warn(r, `${at}: spawned 0 particles over the composition`);
    if (peak >= MAX_PARTS) warn(r, `${at}: hit the ${MAX_PARTS}-particle cap (excess spawns are dropped)`);
    const subBudget = l.em && l.em.sub && l.em.sub.on ? (l.em.sub.budget | 0) : 0;
    if (subBudget && peakSub >= subBudget) warn(r, `${at}: sub-emitter hit its budget of ${subBudget} child particles (excess children are dropped)`);
    info(r, `${at}: spawned ${spawned}, peak ${peak} alive at t=${peakT.toFixed(2)}s${peakSub ? ` (peak ${peakSub} sub)` : ''}`);
}

// ---------- один файл ----------
function validateFile(fp) {
    const r = makeReport(fp);
    let raw;
    try { raw = JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch (e) { err(r, 'JSON parse failed: ' + e.message); return r; }

    let wrapper = null, doc = null;
    if (isPlainObj(raw) && raw.doc) {
        wrapper = raw;
        if (raw.app !== 'arcadia-effects') err(r, `file.app="${raw.app}": expected "arcadia-effects"`);
        for (const k of Object.keys(raw)) if (!WRAPPER_KEYS.has(k)) warn(r, `file.${k}: unknown wrapper key`);
        doc = raw.doc;
    } else if (isPlainObj(raw) && Array.isArray(raw.layers)) {
        doc = raw; // голый doc тоже валидируем, но напоминаем про обёртку
        warn(r, 'bare doc without {app,v,doc,tex} wrapper — the catalog/deep-link loader needs the wrapper');
    } else {
        err(r, 'not an effect file: expected {app:"arcadia-effects",v,doc,...} or a bare doc with layers');
        return r;
    }

    checkUnknownKeys(r, doc);
    try { doc = M.migrate(doc); } catch (e) { err(r, 'migrate/hydrate crashed: ' + e.message); return r; }
    checkDoc(r, doc, wrapper);
    if (!r.errors.length) (doc.layers || []).forEach((l, i) => simLayer(r, doc, l, i));

    r.summary = `"${doc.name}" — ${(doc.layers || []).length} layers, dur ${doc.comp.dur}s, ` +
        `atlas ${doc.exp.cols}x${doc.exp.rows}@${doc.exp.cellW}x${doc.exp.cellH} (${doc.exp.mode})`;
    return r;
}

// ---------- CLI ----------
let files = process.argv.slice(2).filter(a => a !== '--all');
if (!files.length) {
    const lib = path.join(ROOT, 'library');
    files = fs.existsSync(lib) ? fs.readdirSync(lib).filter(f => /\.json$/i.test(f)).map(f => path.join(lib, f)) : [];
    if (!files.length) { console.log('usage: node tools/validate.mjs <effect.json> ...   (no args = all library/*.json)'); process.exit(0); }
}

let failed = 0;
for (const fp of files) {
    const r = validateFile(fp);
    const status = r.errors.length ? 'FAIL' : (r.warns.length ? 'ok (warnings)' : 'ok');
    console.log(`\n${path.relative(ROOT, fp)}: ${status}${r.summary ? '  ' + r.summary : ''}`);
    r.errors.forEach(m => console.log('  [error] ' + m));
    r.warns.forEach(m => console.log('  [warn]  ' + m));
    r.infos.forEach(m => console.log('  [sim]   ' + m));
    if (r.errors.length) failed++;
}
console.log(`\n${files.length} file(s), ${failed} with errors`);
process.exit(failed ? 1 : 0);
