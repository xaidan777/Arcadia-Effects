// Arcaidia Effector — виджеты инспектора: числа с анимацией, кривые, градиенты, выбор спрайта
(function () {
'use strict';
const AFX = window.AFX;
const D = AFX.Dom, h = D.h, T = AFX.Track, L = AFX.t;
const W = AFX.W = {};

// --- служебное ---
function snapLocal(layer) {
    const fps = AFX.state.doc.comp.fps || 60;
    const tl = AFX.clamp(AFX.state.time - layer.start, 0, Math.max(0, layer.end - layer.start));
    return Math.round(tl * fps) / fps;
}
function frameEps() { return 0.51 / (AFX.state.doc.comp.fps || 60); }

// o.tip — подсказка на ВСЮ строку (лейбл + поле), шапка подсказки — полное имя
// параметра: узкий лейбл обрезается. Любой новый виджет инспектора обязан её иметь.
W.row = function (label, tip) {
    const lab = h('div', { cls: 'w-label', text: label });
    const body = h('div', { cls: 'w-body' });
    const row = h('div', { cls: 'w-row' }, lab, body);
    if (tip) D.tip(row, tip, label);
    row._body = body;
    return row;
};

function fmt(v, prec) {
    if (typeof v !== 'number' || !isFinite(v)) return '0';
    return prec > 0 ? v.toFixed(prec).replace(/\.?0+$/, m => m.indexOf('.') >= 0 && v % 1 === 0 ? '' : m).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : String(Math.round(v));
}

// --- числовое поле с драгом ---
// o: {label, min, max, step, prec, unit, int, get, set, track:{layer,obj,key}, reg, onCommit}
W.num = function (o) {
    const row = W.row(o.label, o.tip);
    const prec = o.prec != null ? o.prec : (o.step && o.step < 1 ? 2 : (o.int ? 0 : 1));
    const step = o.step || 1;
    const tr = o.track || null;
    const layer = tr && tr.layer;

    const getVal = function () {
        if (tr) return T.val(tr.obj[tr.key], layer ? AFX.clamp(AFX.state.time - layer.start, 0, 1e9) : 0);
        return o.get();
    };
    const clampV = v => {
        if (o.min != null) v = Math.max(o.min, v);
        if (o.max != null) v = Math.min(o.max, v);
        return o.int ? Math.round(v) : v;
    };
    const setVal = function (v) {
        v = clampV(v);
        if (tr) {
            const cur = tr.obj[tr.key];
            if (T.isAnim(cur)) T.setValueAt(cur, snapLocal(layer), v, frameEps());
            else tr.obj[tr.key] = v;
            AFX.touch(layer.id);
        } else {
            o.set(v);
        }
        refresh();
    };

    const field = h('div', { cls: 'num-field', tabindex: '0' });
    const refresh = function () {
        if (field.classList.contains('editing')) return;
        field.textContent = fmt(getVal(), prec);
        const anim = tr && T.isAnim(tr.obj[tr.key]);
        field.classList.toggle('anim', !!anim);
        if (keyBtn) {
            const cur = tr.obj[tr.key];
            keyBtn.classList.toggle('haskey', !!(T.isAnim(cur) && T.keyAt(cur, snapLocal(layer), frameEps())));
            keyBtn.style.visibility = T.isAnim(cur) ? 'visible' : 'hidden';
        }
        if (swBtn) swBtn.classList.toggle('anim', !!(tr && T.isAnim(tr.obj[tr.key])));
    };

    // драг значения
    let dragBase = 0, dragged = false;
    D.drag(field, {
        start: function () {
            if (field.classList.contains('editing')) return false;
            dragBase = getVal(); dragged = false;
        },
        move: function (e, dx) {
            if (!dragged) { dragged = true; AFX.pushUndo(); }
            let mul = e.shiftKey ? 10 : (e.altKey ? 0.1 : 1);
            setVal(dragBase + dx * step * mul * 0.5);
        },
        end: function (e, moved) {
            if (moved) { AFX.commitEnd(); o.onCommit && o.onCommit(); }
        }
    });
    // ввод с клавиатуры
    field.addEventListener('dblclick', function () {
        field.classList.add('editing');
        const inp = h('input', { value: fmt(getVal(), Math.max(prec, 3)) });
        field.textContent = '';
        field.appendChild(inp);
        inp.focus(); inp.select();
        const commit = function (apply) {
            const v = parseFloat(inp.value.replace(',', '.'));
            field.classList.remove('editing');
            field.textContent = '';
            if (apply && isFinite(v)) { AFX.pushUndo(); setVal(v); AFX.commitEnd(); o.onCommit && o.onCommit(); }
            refresh();
        };
        inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') commit(true);
            else if (e.key === 'Escape') commit(false);
            e.stopPropagation();
        });
        inp.addEventListener('blur', function () { commit(true); });
    });

    // секундомер и ромб ключа
    let swBtn = null, keyBtn = null;
    if (tr) {
        swBtn = h('span', { cls: 'stopwatch', tip: L('Stopwatch: animate with keyframes; click again to drop the keys and keep the current value') }, D.icon('clock'));
        swBtn.addEventListener('click', function () {
            AFX.pushUndo();
            const cur = tr.obj[tr.key];
            tr.obj[tr.key] = T.isAnim(cur) ? T.disable(cur, snapLocal(layer)) : T.enable(cur, snapLocal(layer));
            AFX.touch(layer.id);
            AFX.commitEnd();
            refresh();
        });
        keyBtn = h('span', { cls: 'keybtn', tip: L('Add a keyframe at the current time, or remove the one already there') }, D.icon('key'));
        keyBtn.addEventListener('click', function () {
            const cur = tr.obj[tr.key];
            if (!T.isAnim(cur)) return;
            AFX.pushUndo();
            const k = T.keyAt(cur, snapLocal(layer), frameEps());
            if (k) {
                if (T.removeKey(cur, k) === 0) tr.obj[tr.key] = T.disable(cur, snapLocal(layer));
            } else {
                T.setValueAt(cur, snapLocal(layer), T.val(cur, snapLocal(layer)), frameEps());
            }
            AFX.touch(layer.id);
            AFX.commitEnd();
            refresh();
        });
        row.insertBefore(swBtn, row._body);
    }

    row._body.appendChild(field);
    if (o.unit) row._body.appendChild(h('span', { cls: 'num-unit', text: o.unit }));
    if (keyBtn) row._body.appendChild(keyBtn);
    if (o.reg) o.reg.push(refresh);
    refresh();
    return row;
};

// --- select ---
W.sel = function (o) {
    const row = W.row(o.label, o.tip);
    const sel = h('select', { cls: 'w-select' });
    o.options.forEach(op => sel.appendChild(h('option', { value: op[0], text: op[1] })));
    sel.value = String(o.get());
    sel.addEventListener('change', function () {
        AFX.pushUndo();
        o.set(sel.value);
        AFX.commitEnd();
        sel.blur(); // чтобы пробел после выбора включал плей, а не раскрывал список
    });
    row._body.appendChild(sel);
    return row;
};

// --- checkbox ---
W.chk = function (o) {
    const row = W.row(o.label, o.tip);
    const inp = h('input', { type: 'checkbox' });
    inp.checked = !!o.get();
    inp.addEventListener('change', function () {
        AFX.pushUndo();
        o.set(inp.checked);
        AFX.commitEnd();
        inp.blur();
    });
    row._body.appendChild(h('label', { cls: 'w-check' }, inp));
    return row;
};

// --- статический цвет [r,g,b] ---
W.color = function (o) {
    const row = W.row(o.label, o.tip);
    const inp = h('input', { type: 'color', cls: 'w-color' });
    inp.value = AFX.rgbToHex(o.get());
    let undoPushed = false;
    inp.addEventListener('input', function () {
        if (!undoPushed) { AFX.pushUndo(); undoPushed = true; }
        o.set(AFX.hexToRgb(inp.value));
    });
    inp.addEventListener('change', function () { undoPushed = false; AFX.commitEnd(); });
    row._body.appendChild(inp);
    return row;
};

// --- анимируемый цвет (трек) ---
W.colorTrack = function (o) {
    const row = W.row(o.label, o.tip);
    const tr = o.track, layer = tr.layer;
    const inp = h('input', { type: 'color', cls: 'w-color' });

    const refresh = function () {
        const v = T.val(tr.obj[tr.key], AFX.clamp(AFX.state.time - layer.start, 0, 1e9));
        inp.value = AFX.rgbToHex(Array.isArray(v) ? v : [255, 255, 255]);
        swBtn.classList.toggle('anim', T.isAnim(tr.obj[tr.key]));
    };
    let undoPushed = false;
    inp.addEventListener('input', function () {
        if (!undoPushed) { AFX.pushUndo(); undoPushed = true; }
        const rgb = AFX.hexToRgb(inp.value);
        const cur = tr.obj[tr.key];
        if (T.isAnim(cur)) T.setValueAt(cur, snapLocal(layer), rgb, frameEps());
        else tr.obj[tr.key] = rgb;
        AFX.touch(layer.id);
    });
    inp.addEventListener('change', function () { undoPushed = false; AFX.commitEnd(); });

    const swBtn = h('span', { cls: 'stopwatch', tip: L('Stopwatch: animate with keyframes; click again to drop the keys and keep the current value') }, D.icon('clock'));
    swBtn.addEventListener('click', function () {
        AFX.pushUndo();
        const cur = tr.obj[tr.key];
        tr.obj[tr.key] = T.isAnim(cur) ? T.disable(cur, snapLocal(layer)) : T.enable(cur, snapLocal(layer));
        AFX.touch(layer.id);
        AFX.commitEnd();
        refresh();
    });
    row.insertBefore(swBtn, row._body);
    row._body.appendChild(inp);
    if (o.reg) o.reg.push(refresh);
    refresh();
    return row;
};

// --- редактор кривой (за жизнь частицы) ---
// o: {label, curve(), layerId, yMax}
W.curve = function (o) {
    const wrap = h('div', { cls: 'curve-wrap' });
    wrap.appendChild(h('div', { cls: 'w-label', text: o.label, style: 'flex:none;margin-bottom:2px;', tip: o.tip, tipHead: o.label }));
    const CW = 226, CH = 74, PAD = 6;
    const yMax = o.yMax || 1.5;
    const canvas = h('canvas', { cls: 'curve-canvas', width: CW, height: CH, style: 'width:' + CW + 'px;height:' + CH + 'px;' });
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const toX = t => PAD + t * (CW - PAD * 2);
    const toY = v => CH - PAD - (v / yMax) * (CH - PAD * 2);
    const fromX = x => AFX.clamp((x - PAD) / (CW - PAD * 2), 0, 1);
    const fromY = y => AFX.clamp((CH - PAD - y) / (CH - PAD * 2) * yMax, 0, yMax);

    const draw = function () {
        const c = o.curve();
        ctx.clearRect(0, 0, CW, CH);
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const y1 = toY(1);
        ctx.moveTo(0, y1); ctx.lineTo(CW, y1);
        ctx.stroke();
        ctx.strokeStyle = '#59e3e2';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x <= CW; x += 2) {
            const v = AFX.Curve.val(c, fromX(x));
            const y = toY(Math.min(v, yMax));
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#fdcf82';
        c.pts.forEach(p => {
            ctx.beginPath();
            ctx.arc(toX(p.t), toY(Math.min(p.v, yMax)), 3.5, 0, Math.PI * 2);
            ctx.fill();
        });
    };

    const hitPt = function (mx, my) {
        const c = o.curve();
        for (const p of c.pts) {
            const dx = toX(p.t) - mx, dy = toY(Math.min(p.v, yMax)) - my;
            if (dx * dx + dy * dy < 64) return p;
        }
        return null;
    };
    const mpos = e => {
        const r = canvas.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
    };

    let dragPt = null;
    D.drag(canvas, {
        start: function (e) {
            const m = mpos(e);
            dragPt = hitPt(m[0], m[1]);
            if (dragPt) AFX.pushUndo();
        },
        move: function (e) {
            if (!dragPt) return;
            const c = o.curve();
            const m = mpos(e);
            const first = c.pts[0] === dragPt, last = c.pts[c.pts.length - 1] === dragPt;
            if (!first && !last) dragPt.t = fromX(m[0]);
            dragPt.v = fromY(m[1]);
            AFX.Curve.sort(c);
            AFX.touch(o.layerId);
            draw();
        },
        end: function (e, moved) {
            if (dragPt && moved) AFX.commitEnd();
            dragPt = null;
        }
    });
    canvas.addEventListener('dblclick', function (e) {
        const m = mpos(e);
        const c = o.curve();
        const p = hitPt(m[0], m[1]);
        AFX.pushUndo();
        if (p && c.pts.length > 2) {
            c.pts.splice(c.pts.indexOf(p), 1);
        } else if (!p) {
            c.pts.push({ t: fromX(m[0]), v: fromY(m[1]) });
            AFX.Curve.sort(c);
        }
        AFX.touch(o.layerId);
        AFX.commitEnd();
        draw();
    });
    D.tip(canvas, L('Drag a point to move it. Double-click to add or remove.'));

    // пресеты
    const foot = h('div', { cls: 'widget-foot' });
    const sel = h('select', { cls: 'w-select', style: 'flex:1;', tip: L('Replace the curve with a ready-made shape (fade out, grow, pulse…)') });
    sel.appendChild(h('option', { value: '', text: L('Curve preset...') }));
    Object.keys(AFX.Curve.presets).forEach(k => sel.appendChild(h('option', { value: k, text: L(AFX.Curve.presets[k].label) })));
    sel.addEventListener('change', function () {
        if (!sel.value) return;
        AFX.pushUndo();
        const c = o.curve();
        c.pts = AFX.Curve.presets[sel.value].make().pts;
        AFX.touch(o.layerId);
        AFX.commitEnd();
        sel.value = '';
        sel.blur();
        draw();
    });
    foot.appendChild(sel);
    wrap.appendChild(foot);
    draw();
    return wrap;
};

// --- редактор градиента ---
W.grad = function (o) {
    const wrap = h('div', { cls: 'grad-wrap' });
    wrap.appendChild(h('div', { cls: 'w-label', text: o.label, style: 'flex:none;margin-bottom:2px;', tip: o.tip, tipHead: o.label }));
    const GW = 226, GH = 16;
    const canvas = h('canvas', { cls: 'grad-canvas', width: GW, height: GH, style: 'width:' + GW + 'px;height:' + GH + 'px;' });
    const stopsBar = h('div', { cls: 'grad-stops', style: 'width:' + GW + 'px;' });
    wrap.appendChild(canvas);
    wrap.appendChild(stopsBar);
    const ctx = canvas.getContext('2d');
    let selStop = null;

    const colorInp = h('input', { type: 'color', cls: 'w-color', tip: L('Color of the selected stop (click a stop under the strip first)') });
    const foot = h('div', { cls: 'widget-foot' });
    const sel = h('select', { cls: 'w-select', style: 'flex:1;', tip: L('Replace the gradient with a ready-made palette (fire, smoke, ice…)') });
    sel.appendChild(h('option', { value: '', text: L('Gradient preset...') }));
    Object.keys(AFX.Grad.presets).forEach(k => sel.appendChild(h('option', { value: k, text: L(AFX.Grad.presets[k].label) })));
    foot.appendChild(colorInp);
    foot.appendChild(sel);
    wrap.appendChild(foot);

    const draw = function () {
        const g = o.grad();
        const grd = ctx.createLinearGradient(0, 0, GW, 0);
        g.stops.forEach(s => grd.addColorStop(AFX.clamp(s.t, 0, 1), AFX.rgbToHex(s.c)));
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, GW, GH);
        stopsBar.innerHTML = '';
        g.stops.forEach(s => {
            const el = h('div', { cls: 'grad-stop' + (s === selStop ? ' sel' : ''), tip: L('Click to pick for coloring, drag to move, right-click to remove the stop') });
            el.style.left = (s.t * GW) + 'px';
            el.style.background = AFX.rgbToHex(s.c);
            let moved = false;
            D.drag(el, {
                start: function () { selectStop(s); moved = false; },
                move: function (e) {
                    if (!moved) { moved = true; AFX.pushUndo(); }
                    const r = canvas.getBoundingClientRect();
                    s.t = AFX.clamp((e.clientX - r.left) / GW, 0, 1);
                    AFX.Grad.sort(o.grad());
                    AFX.touch(o.layerId);
                    draw();
                },
                end: function (e, m) { if (m) AFX.commitEnd(); }
            });
            el.addEventListener('contextmenu', function (e) {
                e.preventDefault();
                const g2 = o.grad();
                if (g2.stops.length <= 2) return;
                AFX.pushUndo();
                g2.stops.splice(g2.stops.indexOf(s), 1);
                if (selStop === s) selStop = null;
                AFX.touch(o.layerId);
                AFX.commitEnd();
                draw();
            });
            stopsBar.appendChild(el);
        });
    };
    const selectStop = function (s) {
        selStop = s;
        colorInp.value = AFX.rgbToHex(s.c);
        draw();
    };
    canvas.addEventListener('click', function (e) {
        const r = canvas.getBoundingClientRect();
        const t = AFX.clamp((e.clientX - r.left) / GW, 0, 1);
        const g = o.grad();
        AFX.pushUndo();
        const c = AFX.Grad.val(g, t);
        const s = { t: t, c: c };
        g.stops.push(s);
        AFX.Grad.sort(g);
        AFX.touch(o.layerId);
        AFX.commitEnd();
        selectStop(s);
    });
    D.tip(canvas, L('Click to add a stop. Right-click a stop to remove it.'));
    let undoPushed = false;
    colorInp.addEventListener('input', function () {
        if (!selStop) return;
        if (!undoPushed) { AFX.pushUndo(); undoPushed = true; }
        selStop.c = AFX.hexToRgb(colorInp.value);
        AFX.touch(o.layerId);
        draw();
    });
    colorInp.addEventListener('change', function () { undoPushed = false; AFX.commitEnd(); });
    sel.addEventListener('change', function () {
        if (!sel.value) return;
        AFX.pushUndo();
        const g = o.grad();
        g.stops = AFX.Grad.presets[sel.value].make().stops;
        selStop = null;
        AFX.touch(o.layerId);
        AFX.commitEnd();
        sel.value = '';
        sel.blur();
        draw();
    });
    draw();
    return wrap;
};

// --- выбор спрайта ---
// o: {label, tip, layerId, get, set, texOnly} — texOnly: только текстуры (ATLAS-слой)
W.sprite = function (o) {
    const row = W.row(o.label, o.tip);
    const btn = h('div', { cls: 'sprite-btn' });
    const refreshBtn = function () {
        btn.innerHTML = '';
        const ref = o.get();
        const prev = AFX.Sprites.preview(ref, 26);
        btn.appendChild(prev);
        btn.appendChild(h('span', { text: AFX.Sprites.refLabel(ref) }));
    };
    btn.addEventListener('click', function (e) {
        openPicker(e.clientX, e.clientY, o, refreshBtn);
    });
    row._body.appendChild(btn);
    refreshBtn();
    return row;
};

function openPicker(x, y, o, refreshBtn) {
    const content = h('div');
    const paramBox = h('div');
    const rebuildParams = function () {
        paramBox.innerHTML = '';
        const ref = o.get();
        if (ref.kind !== 'shape') return;
        const def = AFX.Sprites.shapeDef(ref.id);
        if (!def) return;
        (def.params || []).forEach(pd => {
            paramBox.appendChild(W.num({
                label: L(pd.label), tip: pd.tip && L(pd.tip),
                min: pd.min, max: pd.max, step: pd.step, int: pd.step >= 1,
                prec: pd.step >= 1 ? 0 : 2,
                get: () => (ref.p && ref.p[pd.k] != null) ? ref.p[pd.k] : pd.def,
                set: v => {
                    ref.p = ref.p || {};
                    ref.p[pd.k] = v;
                    AFX.Sprites.clearShapeCache('shape|' + ref.id);
                    AFX.touch(o.layerId);
                    refreshBtn();
                }
            }));
        });
        if (def.variants) {
            const opts = [['-1', L('Random')]];
            for (let i = 0; i < def.variants; i++) opts.push([String(i), L('Variant') + ' ' + (i + 1)]);
            paramBox.appendChild(W.sel({
                label: L('Variant'),
                tip: L('A fixed shape variant, or Random to give each particle its own'),
                options: opts,
                get: () => String((ref.p && ref.p.var != null) ? ref.p.var : -1),
                set: v => {
                    ref.p = ref.p || {};
                    ref.p.var = parseInt(v, 10);
                    AFX.touch(o.layerId);
                    refreshBtn();
                }
            }));
        }
    };

    const grid = h('div', { cls: 'sprite-grid' });
    const curRef = o.get();
    if (!o.texOnly) content.appendChild(h('h4', { text: L('Shapes') }));
    if (!o.texOnly) AFX.Sprites.shapeDefs.forEach(def => {
        const cell = h('div', { cls: 'sprite-cell' + (curRef.kind === 'shape' && curRef.id === def.id ? ' sel' : ''), tip: def.tip && L(def.tip), tipHead: L(def.label) });
        cell.appendChild(AFX.Sprites.preview({ kind: 'shape', id: def.id, p: {} }, 40));
        cell.appendChild(h('div', { cls: 'cap', text: L(def.label) }));
        cell.addEventListener('click', function () {
            AFX.pushUndo();
            o.set({ kind: 'shape', id: def.id, p: {} });
            AFX.touch(o.layerId);
            AFX.commitEnd();
            refreshBtn();
            grid.querySelectorAll('.sprite-cell').forEach(c => c.classList.remove('sel'));
            texGrid.querySelectorAll('.sprite-cell').forEach(c => c.classList.remove('sel'));
            cell.classList.add('sel');
            rebuildParams();
        });
        grid.appendChild(cell);
    });
    if (!o.texOnly) content.appendChild(grid);

    content.appendChild(h('h4', { text: L('Textures') }));
    const texGrid = h('div', { cls: 'sprite-grid' });
    let anyTex = false;
    AFX.Sprites.texs.forEach(tex => {
        anyTex = true;
        const cell = h('div', { cls: 'sprite-cell' + (curRef.kind === 'tex' && curRef.texId === tex.id ? ' sel' : ''), tip: L('Use this imported texture as the image'), tipHead: tex.name });
        const img = h('img', { src: tex.dataURL, style: 'max-width:40px;max-height:40px;object-fit:contain;' });
        cell.appendChild(img);
        cell.appendChild(h('div', { cls: 'cap', text: tex.name }));
        cell.addEventListener('click', function () {
            AFX.pushUndo();
            o.set({ kind: 'tex', texId: tex.id });
            AFX.touch(o.layerId);
            AFX.commitEnd();
            refreshBtn();
            grid.querySelectorAll('.sprite-cell').forEach(c => c.classList.remove('sel'));
            texGrid.querySelectorAll('.sprite-cell').forEach(c => c.classList.remove('sel'));
            cell.classList.add('sel');
            rebuildParams();
        });
        texGrid.appendChild(cell);
    });
    if (!anyTex) texGrid.appendChild(h('div', { style: 'color:#6b644f;font-size:11px;grid-column:1/-1;', text: L('No textures yet. Import them in the Textures panel.') }));
    content.appendChild(texGrid);
    if (o.texOnly) {
        const imp = h('button', { cls: 'tb', style: 'margin-top:6px;width:100%;', text: L('Import sheet...'), tip: L('Import a new sprite sheet from disk and set its grid') });
        imp.addEventListener('click', function () {
            D.closePopover();
            AFX.TexturesPanel.pickAtlasFile(function (id) {
                AFX.pushUndo();
                o.set({ kind: 'tex', texId: id });
                AFX.touch(o.layerId);
                AFX.commitEnd();
                refreshBtn();
            });
        });
        content.appendChild(imp);
    }
    content.appendChild(paramBox);
    rebuildParams();
    D.popover(x, y, content);
}

// --- таблица вспышек (bursts) ---
W.bursts = function (o) {
    const wrap = h('div');
    wrap.appendChild(h('div', { cls: 'bursts-head', tip: L('One-shot bursts: at the given second the emitter releases that many particles at once') },
        h('span', { text: L('Emission bursts: time (s) / count') })));
    const table = h('div', { cls: 'bursts-table' });
    wrap.appendChild(table);

    const rebuild = function () {
        table.innerHTML = '';
        const list = o.get();
        list.forEach((b, idx) => {
            const rowEl = h('div', { cls: 'bursts-row' });
            rowEl.appendChild(D.tip(numCell(b, 't', 0.01, 2, 0), L('Burst time in seconds from the layer start; drag or double-click to type')));
            rowEl.appendChild(D.tip(numCell(b, 'n', 1, 0, 0), L('How many particles this burst releases; drag or double-click to type')));
            const del = h('span', { cls: 'mini-btn', tip: L('Remove this burst from the emitter') }, D.icon('del'));
            del.addEventListener('click', function () {
                AFX.pushUndo();
                list.splice(idx, 1);
                AFX.touch(o.layerId);
                AFX.commitEnd();
                rebuild();
            });
            rowEl.appendChild(del);
            table.appendChild(rowEl);
        });
        const add = h('button', { cls: 'mini-btn', style: 'margin:2px 0;', tip: L('Add a burst of 10 particles 0.1 s after the last one') }, D.icon('plus'), L('Burst'));
        add.addEventListener('click', function () {
            AFX.pushUndo();
            const list2 = o.get();
            list2.push({ t: list2.length ? list2[list2.length - 1].t + 0.1 : 0, n: 10 });
            AFX.touch(o.layerId);
            AFX.commitEnd();
            rebuild();
        });
        table.appendChild(h('div', { cls: 'bursts-row' }, add));
    };
    const numCell = function (obj, key, step, prec, min) {
        const field = h('div', { cls: 'num-field', style: 'flex:1;' });
        field.textContent = fmt(obj[key], prec);
        let base = 0, started = false;
        D.drag(field, {
            start: function () { base = obj[key]; started = false; },
            move: function (e, dx) {
                if (!started) { started = true; AFX.pushUndo(); }
                obj[key] = Math.max(min, base + dx * step * 0.5);
                if (prec === 0) obj[key] = Math.round(obj[key]);
                field.textContent = fmt(obj[key], prec);
                AFX.touch(o.layerId);
            },
            end: function (e, m) { if (m) AFX.commitEnd(); }
        });
        field.addEventListener('dblclick', function () {
            let v = null;
            try { v = prompt(L('Value:'), obj[key]); } catch (e) { return; }
            if (v == null) return;
            const num = parseFloat(v.replace(',', '.'));
            if (!isFinite(num)) return;
            AFX.pushUndo();
            obj[key] = Math.max(min, prec === 0 ? Math.round(num) : num);
            AFX.touch(o.layerId);
            AFX.commitEnd();
            field.textContent = fmt(obj[key], prec);
        });
        return field;
    };
    rebuild();
    return wrap;
};

// --- АДРЕСАЦИЯ СЛОЯ-КОРРЕКТОРА (postfx / force) ---
// Пустой список = «все подходящие слои ниже» — ровно то, что корректор делал всегда.
// Кандидаты берутся только НИЖЕ по стеку: корректор не тянется вверх, а перестановка
// слоя выше просто выводит его из-под эффекта (id в списке при этом не чистим — вернули
// слой обратно, и адресация ожила). o: {layer, kinds:[типы слоёв], tip}
W.targets = function (o) {
    const layer = o.layer;
    const wrap = h('div', { cls: 'targets' });
    const sum = h('div', { cls: 'targets-sum' });
    const list = h('div', { cls: 'targets-list' });
    const badges = (AFX.Timeline && AFX.Timeline.TYPE_BADGE) || {};
    if (o.tip) D.tip(sum, o.tip);
    wrap.appendChild(sum);
    wrap.appendChild(list);

    const rebuild = function () {
        list.innerHTML = '';
        const doc = AFX.state.doc;
        const idx = doc.layers.findIndex(l => l.id === layer.id);
        const sel = Array.isArray(layer.targets) ? layer.targets : (layer.targets = []);
        const cands = doc.layers.filter((l, i) => i > idx && (!o.kinds || o.kinds.indexOf(l.type) >= 0));
        const okIds = new Set(cands.map(l => l.id));
        const lost = sel.filter(id => !okIds.has(id)).length;
        sum.textContent = sel.length
            ? L('Selected layers') + ': ' + (sel.length - lost) + (lost ? ' (+' + lost + ' ' + L('out of reach') + ')' : '')
            : (cands.length ? L('All layers below') : L('Nothing below to affect'));
        sum.classList.toggle('on', sel.length > 0);

        cands.forEach(l => {
            const inp = h('input', { type: 'checkbox' });
            inp.checked = sel.indexOf(l.id) >= 0;
            inp.addEventListener('change', function () {
                AFX.pushUndo();
                const was = sel.length > 0;
                const i = sel.indexOf(l.id);
                if (inp.checked) { if (i < 0) sel.push(l.id); }
                else if (i >= 0) sel.splice(i, 1);
                AFX.touch(layer.id);
                AFX.commitEnd();
                // переход «пусто <-> есть адресаты» меняет набор виджетов секции
                if (o.onToggleEmpty && was !== (sel.length > 0)) o.onToggleEmpty();
                else rebuild();
            });
            list.appendChild(h('label', {
                cls: 'targets-row', tipHead: l.name,
                tip: L('Include this layer; with nothing checked, every matching layer below is affected')
            }, inp,
                h('span', { cls: 'type-badge sm ' + l.type, text: badges[l.type] || 'S' }),
                h('span', { cls: 'targets-name', text: l.name })));
        });
        if (!cands.length) list.appendChild(h('div', { cls: 'targets-none', text: L('Move the layer above the ones it should affect') }));
        if (sel.length) {
            const clr = h('button', { cls: 'mini-btn', style: 'margin:4px 0;', tip: L('Clear the checks: the layer works on every matching layer below again') }, D.icon('del'), L('Affect all below'));
            clr.addEventListener('click', function () {
                AFX.pushUndo();
                sel.length = 0;
                AFX.touch(layer.id);
                AFX.commitEnd();
                if (o.onToggleEmpty) o.onToggleEmpty(); else rebuild();
            });
            list.appendChild(clr);
        }
    };
    rebuild();
    return wrap;
};

// --- секция инспектора ---
W.section = function (title, open) {
    const sec = h('div', { cls: 'insp-section' + (open === false ? ' closed' : '') });
    const head = h('div', { cls: 'insp-sec-head' },
        h('span', { cls: 'arrow', text: '▼' }),
        h('span', { text: title }));
    head.addEventListener('click', function () { sec.classList.toggle('closed'); });
    const body = h('div', { cls: 'insp-sec-body' });
    sec.appendChild(head);
    sec.appendChild(body);
    sec._body = body;
    return sec;
};
})();
