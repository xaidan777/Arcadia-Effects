// Arcaidia Effector — операции со слоями (добавить, дублировать, удалить, порядок)
(function () {
'use strict';
const AFX = window.AFX;
const Ops = AFX.Ops = {};

// выделение слоёв: primary = state.sel, множественное = state.selLayers (Set id)
Ops.selectOnly = function (id) {
    AFX.state.sel = id;
    AFX.state.selLayers = new Set(id ? [id] : []);
    AFX.emit('select');
};
Ops.selectToggle = function (id) {
    const set = AFX.state.selLayers;
    if (set.has(id) && set.size > 1) {
        set.delete(id);
        if (AFX.state.sel === id) AFX.state.sel = set.values().next().value;
    } else {
        set.add(id);
        AFX.state.sel = id;
    }
    AFX.emit('select');
};
Ops.selectedLayers = function () {
    return AFX.state.doc.layers.filter(l => AFX.state.selLayers.has(l.id));
};

Ops.addLayer = function (layer) {
    AFX.pushUndo();
    const doc = AFX.state.doc;
    const selIdx = doc.layers.findIndex(l => l.id === AFX.state.sel);
    doc.layers.splice(selIdx >= 0 ? selIdx : 0, 0, layer);
    AFX.touch(layer.id);
    AFX.commitEnd();
    Ops.selectOnly(layer.id);
    AFX.emit('layers');
    return layer;
};

Ops.duplicate = function (layer) {
    AFX.pushUndo();
    const doc = AFX.state.doc;
    const copy = AFX.Model.cleanClone(layer);
    copy.id = AFX.uid('lr');
    copy.name = layer.name + ' copy';
    if (copy.em) copy.em.seed = (copy.em.seed | 0) + 1;
    const idx = doc.layers.findIndex(l => l.id === layer.id);
    doc.layers.splice(idx, 0, copy);
    AFX.touch(copy.id);
    AFX.commitEnd();
    Ops.selectOnly(copy.id);
    AFX.emit('layers');
    return copy;
};

Ops.removeMany = function (layers) {
    if (!layers.length) return;
    AFX.pushUndo();
    const doc = AFX.state.doc;
    const ids = new Set(layers.map(l => l.id));
    doc.layers = doc.layers.filter(l => !ids.has(l.id));
    AFX.touch(null);
    AFX.commitEnd();
    Ops.selectOnly(doc.layers.length ? doc.layers[0].id : null);
    AFX.emit('layers');
};
Ops.remove = function (layer) { Ops.removeMany([layer]); };

Ops.move = function (layer, dir) {
    const doc = AFX.state.doc;
    const idx = doc.layers.findIndex(l => l.id === layer.id);
    const dst = idx + dir;
    if (dst < 0 || dst >= doc.layers.length) return;
    AFX.pushUndo();
    doc.layers.splice(idx, 1);
    doc.layers.splice(dst, 0, layer);
    AFX.touch(layer.id);
    AFX.commitEnd();
    AFX.emit('layers');
};

// переставить srcId перед/после dstId (drag-and-drop порядка)
Ops.reorder = function (srcId, dstId, after) {
    const doc = AFX.state.doc;
    if (srcId === dstId) return;
    const srcIdx = doc.layers.findIndex(l => l.id === srcId);
    if (srcIdx < 0) return;
    AFX.pushUndo();
    const src = doc.layers.splice(srcIdx, 1)[0];
    let dstIdx = doc.layers.findIndex(l => l.id === dstId);
    if (after) dstIdx++;
    doc.layers.splice(Math.max(0, dstIdx), 0, src);
    AFX.touch(src.id);
    AFX.commitEnd();
    AFX.emit('layers');
};

// подогнать ATLAS-слой под кадр его текстуры: базовый размер = размер кадра,
// retime — выставить бар в натуральную длительность листа (кадры / fps)
Ops.fitAtlasFrame = function (doc, layer, retime) {
    const ref = layer.sp && layer.sp.sprite;
    const tex = (ref && ref.kind === 'tex') ? AFX.Sprites.texs.get(ref.texId) : null;
    if (!tex) return layer;
    const sh = tex.sheet;
    const cols = sh ? Math.max(1, sh.cols | 0) : 1, rows = sh ? Math.max(1, sh.rows | 0) : 1;
    const fw = tex.img.width / cols, fh = tex.img.height / rows;
    layer.sp.size = Math.round(Math.min(Math.max(doc.comp.w, doc.comp.h), Math.max(fw, fh)));
    // fps=0 растягивает кадры ровно на бар слоя, поэтому длительность задаём баром
    if (retime && sh && sh.fps > 0) {
        const dur = cols * rows / sh.fps;
        layer.end = layer.start + Math.min(Math.max(0.02, doc.comp.dur - layer.start), Math.round(dur * 1000) / 1000);
    }
    return layer;
};

// ATLAS-слой из текстуры-листа: кадры, натуральная длительность, без преданимации
Ops.atlasFromTexture = function (doc, texId) {
    const tex = texId ? AFX.Sprites.texs.get(texId) : null;
    const layer = AFX.Model.newAtlas(doc, tex ? tex.name : null);
    if (!tex) return layer;
    layer.sp.sprite = { kind: 'tex', texId: texId };
    return Ops.fitAtlasFrame(doc, layer, true);
};
Ops.addAtlasLayer = function (texId) { return Ops.addLayer(Ops.atlasFromTexture(AFX.state.doc, texId)); };

// слой из текстуры (drag-and-drop из панели текстур): лист-футаж -> ATLAS, обычная картинка -> спрайт
Ops.addTextureLayer = function (texId, opts) {
    opts = opts || {};
    const doc = AFX.state.doc;
    const tex = AFX.Sprites.texs.get(texId);
    if (!tex) return null;
    let layer;
    if (tex.sheet) {
        layer = Ops.atlasFromTexture(doc, texId);
    } else {
        layer = AFX.Model.newSprite(doc, tex.name);
        layer.blend = 'normal';
        layer.sp.sprite = { kind: 'tex', texId: texId };
        layer.sp.size = Math.min(300, Math.max(tex.img.width, tex.img.height));
        layer.sp.scale = 1;
        layer.opacity = 1;
    }
    if (opts.x != null) layer.sp.x = Math.round(opts.x);
    if (opts.y != null) layer.sp.y = Math.round(opts.y);
    if (opts.start != null) {
        const span = layer.end - layer.start;          // длительность сохраняем (у атласа она натуральная)
        layer.start = opts.start;
        layer.end = Math.min(doc.comp.dur, opts.start + span);
    }
    return Ops.addLayer(layer);
};
})();
