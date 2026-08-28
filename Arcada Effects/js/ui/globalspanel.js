// Arcaidia Effector — глобальные настройки: композиция, камера, текстуры, экспорт атласа
(function () {
'use strict';
const AFX = window.AFX;
const D = AFX.Dom, h = D.h, W = AFX.W, L = AFX.t;

const G = AFX.GlobalsPanel = {};
let bodyEl = null;

G.init = function () {
    bodyEl = document.getElementById('globals-body');
    AFX.on('doc', G.rebuild);
    AFX.on('tex', G.rebuild);
    G.rebuild();
};

function touchComp() { AFX.touchAll(); }

G.rebuild = function () {
    if (!bodyEl) return;
    bodyEl.innerHTML = '';
    const doc = AFX.state.doc;

    // --- композиция ---
    const secC = h('div', { cls: 'g-section' });
    secC.appendChild(h('div', { cls: 'g-title', text: L('Composition') }));
    secC.appendChild(W.num({
        label: L('Width'), min: 32, max: 2048, step: 8, int: true, unit: 'px',
        get: () => doc.comp.w, set: v => { doc.comp.w = Math.round(v); touchComp(); }
    }));
    secC.appendChild(W.num({
        label: L('Height'), min: 32, max: 2048, step: 8, int: true, unit: 'px',
        get: () => doc.comp.h, set: v => { doc.comp.h = Math.round(v); touchComp(); }
    }));
    secC.appendChild(W.num({
        label: L('Duration'), min: 0.2, max: 12, step: 0.02, prec: 2, unit: L('s'),
        get: () => doc.comp.dur,
        set: v => {
            doc.comp.dur = v;
            AFX.state.time = Math.min(AFX.state.time, v);
            touchComp();
            AFX.emit('time');
        }
    }));
    secC.appendChild(W.num({
        label: L('Project FPS'), min: 12, max: 120, step: 1, int: true,
        get: () => doc.comp.fps, set: v => { doc.comp.fps = Math.round(v); touchComp(); }
    }));
    bodyEl.appendChild(secC);

    // --- камера ---
    const secCam = h('div', { cls: 'g-section' });
    secCam.appendChild(h('div', { cls: 'g-title', text: L('Camera') }));
    const compRow = W.num({
        label: L('Compression'), min: 0, max: 70, step: 0.5, prec: 1, unit: L('deg'),
        tip: L('Camera tilt to the effect plane. 0 — side view, 37 — game isometry (scaleY 0.8).'),
        get: () => doc.cam.comp,
        set: v => { doc.cam.comp = v; kLabel.textContent = kText(); touchComp(); }
    });
    secCam.appendChild(compRow);
    const kText = () => 'scaleY = ' + AFX.Model.compK(doc).toFixed(3);
    const kLabel = h('div', { style: 'padding:0 10px 4px 124px;color:#6b644f;font-size:11px;', text: kText() });
    secCam.appendChild(kLabel);
    bodyEl.appendChild(secCam);

    // --- экспорт атласа ---
    const e = doc.exp;
    const secX = h('div', { cls: 'g-section' });
    secX.appendChild(h('div', { cls: 'g-title', text: L('Atlas Export') }));
    const syncFrames = () => {
        e.frames = Math.min(e.frames, e.cols * e.rows);
        AFX.emit('atlas');
    };
    secX.appendChild(W.num({
        label: L('Columns'), min: 1, max: 16, step: 1, int: true,
        get: () => e.cols, set: v => { e.cols = Math.round(v); e.frames = e.cols * e.rows; syncFrames(); }
    }));
    secX.appendChild(W.num({
        label: L('Rows'), min: 1, max: 16, step: 1, int: true,
        get: () => e.rows, set: v => { e.rows = Math.round(v); e.frames = e.cols * e.rows; syncFrames(); }
    }));
    secX.appendChild(W.num({
        label: L('Frames'), min: 1, max: 256, step: 1, int: true, tip: L('No more than cells in the grid'),
        get: () => e.frames, set: v => { e.frames = Math.round(v); syncFrames(); }
    }));
    secX.appendChild(W.num({
        label: L('Cell W'), min: 8, max: 1024, step: 8, int: true, unit: 'px',
        get: () => e.cellW, set: v => { e.cellW = Math.round(v); AFX.emit('atlas'); }
    }));
    secX.appendChild(W.num({
        label: L('Cell H'), min: 8, max: 1024, step: 8, int: true, unit: 'px',
        get: () => e.cellH, set: v => { e.cellH = Math.round(v); AFX.emit('atlas'); }
    }));
    secX.appendChild(W.num({
        label: L('Start (s)'), min: 0, step: 0.02, prec: 2,
        get: () => e.t0, set: v => { e.t0 = v; AFX.emit('atlas'); }
    }));
    secX.appendChild(W.num({
        label: L('End (s)'), min: -1, step: 0.02, prec: 2, tip: L('-1 — to the end of the composition'),
        get: () => (e.t1 == null ? -1 : e.t1), set: v => { e.t1 = v; AFX.emit('atlas'); }
    }));
    secX.appendChild(W.sel({
        label: L('Mode'),
        options: [['rgba', L('Color, transparent bg')], ['black', L('Color on black')], ['mask', L('Mask (white on black)')]],
        get: () => e.mode, set: v => { e.mode = v; AFX.emit('atlas'); G.rebuild(); }
    }));
    if (e.mode === 'mask') {
        secX.appendChild(W.num({
            label: L('Mask threshold'), min: 0, max: 1, step: 0.02, prec: 2, tip: L('0 — soft mask, higher — hard binarization'),
            get: () => e.thr, set: v => { e.thr = v; AFX.emit('atlas'); }
        }));
    }
    secX.appendChild(W.chk({
        label: L('Supersample 2x'),
        get: () => e.ss === 2, set: v => { e.ss = v ? 2 : 1; AFX.emit('atlas'); }
    }));
    const xBtns = h('div', { cls: 'btn-row' });
    const bBuild = h('button', { cls: 'tb', text: L('Show atlas') });
    bBuild.addEventListener('click', function () { AFX.setTab('atlas'); });
    const bMeta = h('button', { cls: 'tb', text: L('Meta JSON') });
    bMeta.addEventListener('click', function () { AFX.exportAtlasMeta(); });
    xBtns.appendChild(bBuild);
    xBtns.appendChild(bMeta);
    // Download PNG живёт в топбаре (рядом с Save) вместе с экспортом секвенции
    secX.appendChild(xBtns);
    bodyEl.appendChild(secX);
};

// ---------- экспорт PNG-секвенции ----------
// Настройки НЕ живут в документе: экспорт — это вывод, он не должен править эффект
// (и пачкать undo/dirty). Помним их на сессию, переинициализируя при смене дока.
const SEQ_MAX = 600;
let seqOpts = null, seqDocId = null;

function seqDefaults(doc) {
    const e = doc.exp;
    const t1 = (e.t1 == null || e.t1 < 0) ? doc.comp.dur : Math.min(doc.comp.dur, e.t1);
    return {
        w: doc.comp.w, h: doc.comp.h,
        t0: Math.max(0, e.t0 || 0), t1: t1,
        fps: doc.comp.fps || 30,
        mode: e.mode || 'rgba', thr: e.thr || 0, ss: e.ss === 2 ? 2 : 1,
        prefix: AFX.safeFileName(doc.name)
    };
}

G.openSequenceDialog = function () {
    const doc = AFX.state.doc;
    if (!seqOpts || seqDocId !== doc.id) { seqOpts = seqDefaults(doc); seqDocId = doc.id; }
    const o = seqOpts;
    o.t0 = AFX.clamp(o.t0, 0, doc.comp.dur);
    o.t1 = AFX.clamp(o.t1 <= o.t0 ? doc.comp.dur : o.t1, 0, doc.comp.dur);

    const body = h('div', { cls: 'seq-dlg' });
    const fields = h('div', { cls: 'seq-fields' });
    const info = h('div', { cls: 'seq-info' });
    const prog = h('div', { cls: 'seq-prog hidden' });
    const bar = h('div', { cls: 'seq-bar' }, h('i'));
    const progText = h('div', { cls: 'seq-info' });
    prog.appendChild(bar);
    prog.appendChild(progText);

    const frameCount = () => Math.max(1, Math.round(Math.max(0, o.t1 - o.t0) * Math.max(1, o.fps)));

    // поля ввода: type=text — глобальные хоткеи не перехватывают текстовый ввод
    const mkNum = function (key, min, max, frac) {
        const inp = h('input', { cls: 'seq-inp', type: 'text', inputmode: 'decimal', spellcheck: 'false' });
        const show = function () {
            if (document.activeElement === inp) return;
            inp.value = String(frac ? Math.round(o[key] * 100) / 100 : Math.round(o[key]));
        };
        const read = function (commit) {
            const v = parseFloat(String(inp.value).replace(',', '.'));
            if (isFinite(v)) o[key] = AFX.clamp(frac ? v : Math.round(v), min, max);
            if (commit) show();
            refresh();
        };
        inp.addEventListener('input', function () { read(false); });
        inp.addEventListener('blur', function () { read(true); });
        show();
        inp._show = show;
        return inp;
    };
    const inpW = mkNum('w', 8, 4096, false), inpH = mkNum('h', 8, 4096, false);
    const inpT0 = mkNum('t0', 0, doc.comp.dur, true), inpT1 = mkNum('t1', 0, doc.comp.dur, true);
    const inpFps = mkNum('fps', 1, 120, false);
    const inpThr = mkNum('thr', 0, 1, true);

    const inpName = h('input', { cls: 'seq-inp wide', type: 'text', spellcheck: 'false', value: o.prefix });
    inpName.addEventListener('input', function () { o.prefix = inpName.value; });

    const selMode = h('select', { cls: 'w-select' });
    [['rgba', L('Color, transparent bg')], ['black', L('Color on black')], ['mask', L('Mask (white on black)')]]
        .forEach(op => selMode.appendChild(h('option', { value: op[0], text: op[1] })));
    selMode.value = o.mode;
    selMode.addEventListener('change', function () { o.mode = selMode.value; refresh(); });

    const chkSS = h('input', { type: 'checkbox' });
    chkSS.checked = o.ss === 2;
    chkSS.addEventListener('change', function () { o.ss = chkSS.checked ? 2 : 1; });

    const field = (label, el) => h('label', { cls: 'seq-field' }, h('span', { text: label }), el);
    const rowThr = h('div', { cls: 'seq-row' }, field(L('Mask threshold'), inpThr));
    fields.appendChild(h('div', { cls: 'seq-row' },
        field(L('Frame W'), inpW), field(L('Frame H'), inpH), field(L('FPS'), inpFps)));
    fields.appendChild(h('div', { cls: 'seq-row' },
        field(L('Start (s)'), inpT0), field(L('End (s)'), inpT1)));
    fields.appendChild(h('div', { cls: 'seq-row' },
        field(L('Mode'), selMode),
        h('label', { cls: 'seq-field' }, h('span', { text: L('Supersample 2x') }), h('label', { cls: 'w-check' }, chkSS))));
    fields.appendChild(rowThr);
    fields.appendChild(h('div', { cls: 'seq-row' }, field(L('File name'), inpName)));
    body.appendChild(fields);
    body.appendChild(info);
    body.appendChild(prog);

    let dlg = null, job = null, running = false;

    function refresh() {
        rowThr.classList.toggle('hidden', o.mode !== 'mask');
        [inpW, inpH, inpT0, inpT1, inpFps, inpThr].forEach(i => i._show());
        const n = frameCount();
        const over = n > SEQ_MAX;
        info.textContent = n + ' ' + L('frames') + '   ·   ' + Math.round(o.w) + '×' + Math.round(o.h)
            + '   ·   ' + (Math.round(Math.max(0, o.t1 - o.t0) * 100) / 100) + ' ' + L('s')
            + '   ·   ' + L('one .zip archive')
            + (over ? '   ·   ' + L('too many frames — lower the fps or shorten the range') : '');
        info.className = 'seq-info' + (over ? ' warn' : '');
        if (dlg && !running) dlg.acceptBtn.disabled = over;
    }

    function start() {
        const n = frameCount();
        if (n > SEQ_MAX) return;
        running = true;
        fields.classList.add('hidden');
        prog.classList.remove('hidden');
        dlg.acceptBtn.disabled = true;
        const setProg = function (done, total) {
            bar.firstChild.style.width = Math.round(done / total * 100) + '%';
            progText.textContent = L('Rendering frames') + '   ' + done + ' / ' + total;
        };
        setProg(0, n);
        job = AFX.Atlas.buildSequence(doc, {
            t0: o.t0, t1: o.t1, frames: n, w: Math.round(o.w), h: Math.round(o.h),
            mode: o.mode, thr: o.thr, ss: o.ss, prefix: o.prefix
        }, {
            progress: setProg,
            error: function (e) {
                running = false; job = null;
                console.warn('sequence export', e);
                AFX.setStatus(L('Sequence export failed'));
                dlg.close();
            },
            done: function (files, inf) {
                job = null;
                progText.textContent = L('Packing the archive');
                files.push({ name: 'meta.json', data: new TextEncoder().encode(AFX.Atlas.seqMetaJSON(doc, inf, inf.pad)) });
                AFX.downloadBlob(AFX.safeFileName(o.prefix) + '_seq.zip', AFX.Zip.blob(files, { date: new Date() }));
                running = false;
                AFX.setStatus(L('Sequence saved') + ': ' + inf.frames + ' ' + L('frames'));
                dlg.close();
            }
        });
    }

    dlg = D.modal({
        title: L('Export PNG sequence'), body: body,
        acceptLabel: L('Export'), cancelLabel: L('Cancel'),
        onAccept: function () { if (!running) start(); return false; }, // закроемся сами, по готовности
        onCancel: function () {
            if (job) { job.cancel(); job = null; AFX.setStatus(L('Sequence export cancelled')); }
            running = false;
        }
    });
    refresh();
    return dlg;
};

})();
