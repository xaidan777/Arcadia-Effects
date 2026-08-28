// Arcaidia Effector — панель текстур: импорт, сетка футажа, перетаскивание в проект
(function () {
'use strict';
const AFX = window.AFX;
const D = AFX.Dom, h = D.h, L = AFX.t;

const TP = AFX.TexturesPanel = {};
const MAXG = 64;            // потолок колонок/рядов сетки
const PREV_W = 560, PREV_H = 340;
let bodyEl = null;

TP.init = function () {
    bodyEl = document.getElementById('textures-body');
    const btns = document.getElementById('textures-btns');

    const imp = h('span', { cls: 'mini-btn', title: L('Import images (or drop files into the window)') }, D.icon('plus'), L('Import'));
    const fileInp = h('input', { type: 'file', accept: 'image/*', multiple: 'multiple', style: 'display:none;' });
    imp.addEventListener('click', function () { fileInp.click(); });
    fileInp.addEventListener('change', function () {
        Array.from(fileInp.files || []).forEach(f => TP.importFile(f));
        fileInp.value = '';
    });
    btns.appendChild(imp);
    btns.appendChild(fileInp);

    const atl = h('span', { cls: 'mini-btn', title: L('Add a sprite atlas: the grid is guessed from the aspect ratio and confirmed in a dialog') }, D.icon('grid'), L('Atlas'));
    atl.addEventListener('click', function () { TP.openAtlasPicker({ title: L('Add sprite atlas') }); });
    btns.appendChild(atl);

    AFX.on('doc', TP.rebuild);
    AFX.on('tex', TP.rebuild);
    TP.initDrop();
    TP.rebuild();
};

TP.rebuild = function () {
    if (!bodyEl) return;
    bodyEl.innerHTML = '';
    const doc = AFX.state.doc;
    if (!doc.textures || !doc.textures.length) {
        bodyEl.appendChild(h('div', { cls: 'catalog-empty', text: L('No textures. Import a PNG or drop a file into the window. Drag a texture from the list into the preview or onto the timeline to create a sprite layer.') }));
        return;
    }
    bodyEl.appendChild(h('div', { style: 'padding:4px 10px 2px;color:#6b644f;font-size:10px;', text: L('Drag a row into the preview or onto the timeline to create a layer.') }));
    doc.textures.forEach(meta => bodyEl.appendChild(texRow(doc, meta)));
};

function texRow(doc, meta) {
    const rec = AFX.Sprites.texs.get(meta.id);
    const wrap = h('div');
    const row = h('div', { cls: 'tex-row draggable' });
    row.draggable = true;
    row.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/afx-tex', meta.id);
        e.dataTransfer.effectAllowed = 'copy';
    });

    row.appendChild(h('img', { src: rec ? rec.dataURL : '', title: meta.name }));
    const nm = h('span', { cls: 'tname' });
    nm.appendChild(h('span', { text: meta.name }));
    nm.appendChild(h('span', {
        style: 'display:block;color:#6b644f;font-size:10px;',
        text: rec ? (rec.img.width + 'x' + rec.img.height + (meta.sheet ? '  ' + L('footage') + ' ' + meta.sheet.cols + 'x' + meta.sheet.rows + ' @' + meta.sheet.fps : '')) : L('no data')
    }));
    row.appendChild(nm);

    const sheetBtn = h('span', { cls: 'mini-btn' + (meta.sheet ? ' on' : ''), title: L('Mark as footage atlas: grid and fps'), text: L('Grid') });
    sheetBtn.addEventListener('click', function () {
        if (meta.sheet) {                       // снять пометку футажа
            AFX.pushUndo();
            meta.sheet = null;
            applySheet(doc);
            return;
        }
        if (!rec) return;                       // пейлоад ещё не загружен — показывать нечего
        TP.editSheet(meta.id);
    });
    row.appendChild(sheetBtn);

    const del = h('span', { cls: 'mini-btn', title: L('Delete texture') }, D.icon('del'));
    del.addEventListener('click', function () {
        AFX.pushUndo();
        doc.textures = doc.textures.filter(t => t.id !== meta.id);
        AFX.Sprites.removeTexture(meta.id);
        AFX.touchAll();
        AFX.commitEnd();
        TP.rebuild();
    });
    row.appendChild(del);
    wrap.appendChild(row);

    if (meta.sheet) {
        const sh = meta.sheet;
        const mk = (key, label, max) => {
            const f = h('div', { cls: 'num-field', text: sh[key] });
            let base = 0, started = false;
            D.drag(f, {
                start: function () { base = sh[key]; started = false; },
                move: function (e, dx) {
                    if (!started) { started = true; AFX.pushUndo(); }
                    sh[key] = AFX.clamp(Math.round(base + dx * 0.1), 1, max);
                    f.textContent = sh[key];
                    AFX.Model.syncTexSheets(doc);
                    AFX.touchAll();
                },
                end: function (e, m) { if (m) { AFX.commitEnd(); TP.rebuild(); } }
            });
            f.addEventListener('dblclick', function () {
                let v = null;
                try { v = prompt(label + ':', sh[key]); } catch (e) { return; }
                if (v == null) return;
                const num = parseInt(v, 10);
                if (!isFinite(num)) return;
                AFX.pushUndo();
                sh[key] = AFX.clamp(num, 1, max);
                AFX.Model.syncTexSheets(doc);
                AFX.touchAll();
                AFX.commitEnd();
                TP.rebuild();
            });
            return f;
        };
        wrap.appendChild(h('div', { cls: 'tex-sheet' },
            h('span', { text: L('cols') }), mk('cols', L('Columns'), MAXG),
            h('span', { text: L('rows') }), mk('rows', L('Rows'), MAXG),
            h('span', { text: 'fps' }), mk('fps', 'FPS', 120)));
    }
    return wrap;
}

// применение изменённого meta.sheet (pushUndo уже сделан вызывающим)
function applySheet(doc) {
    AFX.Model.syncTexSheets(doc);
    AFX.touchAll();
    AFX.commitEnd();
    TP.rebuild();
}

// диалог сетки для уже импортированной текстуры; done(sheet) — на приёме
TP.editSheet = function (texId, done) {
    const doc = AFX.state.doc;
    const meta = (doc.textures || []).filter(t => t.id === texId)[0];
    const rec = AFX.Sprites.texs.get(texId);
    if (!meta || !rec) return;
    TP.openSheetDialog({
        title: L('Atlas grid'), name: meta.name, img: rec.img,
        sheet: meta.sheet || TP.guessSheet(rec.img.width, rec.img.height),
        accept: function (sheet) {
            AFX.pushUndo();
            meta.sheet = sheet;
            applySheet(doc);
            if (done) done(sheet);
        }
    });
};

// ---------- сетка спрайт-атласа ----------

function gcd(a, b) { a = Math.abs(a | 0); b = Math.abs(b | 0); while (b) { const t = a % b; a = b; b = t; } return a || 1; }

// минимальная сетка с квадратными ячейками — всё, что вообще известно
// из соотношения сторон листа (1024x512 -> 2x1, 640x384 -> 5x3)
TP.baseGrid = function (w, h) {
    w = Math.max(1, w | 0); h = Math.max(1, h | 0);
    const g = gcd(w, h);
    const cols = w / g, rows = h / g;
    if (cols <= MAXG && rows <= MAXG) return { cols: cols, rows: rows };
    // «некруглый» размер (1023x511 и т.п.) — ближайшее отношение малыми числами
    let best = { cols: 1, rows: 1 }, bestErr = Infinity;
    for (let r = 1; r <= 16; r++) {
        for (let c = 1; c <= 16; c++) {
            const err = Math.abs(Math.log((w / c) / (h / r))) + c * r * 1e-4;
            if (err < bestErr) { bestErr = err; best = { cols: c, rows: r }; }
        }
    }
    return best;
};

// все сетки с квадратными ячейками, делящие лист нацело (кратные базовой)
TP.gridFamily = function (w, h) {
    const b = TP.baseGrid(w, h);
    const out = [];
    for (let k = 1; k <= MAXG; k++) {
        const c = b.cols * k, r = b.rows * k;
        if (c > MAXG || r > MAXG || w / c < 8 || h / r < 8) break;
        if (w % c || h % r) continue;
        out.push({ cols: c, rows: r });
        if (out.length >= 8) break;
    }
    if (!out.length) out.push(b);
    return out;
};

// стартовое предложение: первая сетка семейства, где кадров больше одного
// (квадратный лист по соотношению сторон неотличим от 1x1, а 1x1 — не атлас)
TP.guessSheet = function (w, h) {
    const fam = TP.gridFamily(w, h);
    const g = fam.filter(x => x.cols * x.rows > 1)[0] || fam[0];
    return { cols: g.cols, rows: g.rows, fps: 30 };
};

function fmtCell(v) { return Math.round(v * 100) / 100; }

function strokeGrid(ctx, dw, dh, cols, rows) {
    ctx.beginPath();
    for (let c = 1; c < cols; c++) { const x = Math.round(dw * c / cols) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, dh); }
    for (let r = 1; r < rows; r++) { const y = Math.round(dh * r / rows) + 0.5; ctx.moveTo(0, y); ctx.lineTo(dw, y); }
    ctx.stroke();
    ctx.strokeRect(0.5, 0.5, dw - 1, dh - 1);
}

function drawSheetPreview(cvs, img, sheet) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = Math.min(PREV_W / img.width, PREV_H / img.height, 4);
    const dw = Math.max(32, Math.round(img.width * k)), dh = Math.max(32, Math.round(img.height * k));
    cvs.style.width = dw + 'px'; cvs.style.height = dh + 'px';
    cvs.width = Math.round(dw * dpr); cvs.height = Math.round(dh * dpr);
    const ctx = cvs.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const q = 8;                                    // шахматка под прозрачность
    ctx.fillStyle = '#181510'; ctx.fillRect(0, 0, dw, dh);
    ctx.fillStyle = '#221e17';
    for (let y = 0; y < dh; y += q) {
        for (let x = ((y / q) & 1) ? q : 0; x < dw; x += q * 2) ctx.fillRect(x, y, q, q);
    }
    ctx.imageSmoothingEnabled = k < 1;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, dw, dh);

    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    strokeGrid(ctx, dw, dh, sheet.cols, sheet.rows);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(89,227,226,0.92)';
    strokeGrid(ctx, dw, dh, sheet.cols, sheet.rows);
}

// редактор сетки: превью с линиями + инфо + чипы кратных сеток + поля cols/rows/fps.
// Мутирует переданный объект sheet; возвращает элемент.
function buildGridEditor(img, sheet) {
    const body = h('div', { cls: 'sheet-dlg' });
    const cvs = h('canvas', { cls: 'sheet-canvas' });
    body.appendChild(h('div', { cls: 'sheet-prev' }, cvs));
    const info = h('div', { cls: 'sheet-info' });
    body.appendChild(info);

    const fam = TP.gridFamily(img.width, img.height);
    const chips = [];
    if (fam.length > 1) {
        const chipRow = h('div', { cls: 'sheet-chips' });
        chipRow.appendChild(h('span', { cls: 'sheet-hint', text: L('Square cells:') }));
        fam.forEach(g => {
            const el = h('span', { cls: 'mini-btn', text: g.cols + '×' + g.rows });
            el.addEventListener('click', function () { sheet.cols = g.cols; sheet.rows = g.rows; refresh(); });
            chipRow.appendChild(el);
            chips.push({ el: el, g: g });
        });
        body.appendChild(chipRow);
    }

    // поля ввода: type=text — глобальные горячие клавиши не перехватывают текстовый ввод
    const mkInp = function (key, max) {
        const inp = h('input', { cls: 'sheet-inp', type: 'text', inputmode: 'numeric', spellcheck: 'false' });
        inp.value = String(sheet[key]);
        inp.addEventListener('input', function () {
            const v = parseInt(inp.value, 10);
            if (!isFinite(v) || v < 1 || v > max) return;
            sheet[key] = v;
            refresh();
        });
        inp.addEventListener('blur', function () {
            const v = parseInt(inp.value, 10);
            if (isFinite(v)) sheet[key] = AFX.clamp(v, 1, max);
            inp.value = String(sheet[key]);
            refresh();
        });
        return inp;
    };
    const inpCols = mkInp('cols', MAXG), inpRows = mkInp('rows', MAXG), inpFps = mkInp('fps', 120);
    body.appendChild(h('div', { cls: 'sheet-fields' },
        h('label', {}, h('span', { text: L('Columns') }), inpCols),
        h('label', {}, h('span', { text: L('Rows') }), inpRows),
        h('label', {}, h('span', { text: 'FPS' }), inpFps)));

    function setVal(inp, v) { if (document.activeElement !== inp) inp.value = String(v); }
    function refresh() {
        drawSheetPreview(cvs, img, sheet);
        const exact = !(img.width % sheet.cols) && !(img.height % sheet.rows);
        let txt = L('cell') + ' ' + fmtCell(img.width / sheet.cols) + '×' + fmtCell(img.height / sheet.rows)
            + '   ·   ' + (sheet.cols * sheet.rows) + ' ' + L('frames');
        if (!exact) txt += '   ·   ' + L('the image is not evenly divisible by this grid');
        info.textContent = txt;
        info.className = 'sheet-info' + (exact ? '' : ' warn');
        chips.forEach(c => c.el.classList.toggle('on', c.g.cols === sheet.cols && c.g.rows === sheet.rows));
        setVal(inpCols, sheet.cols); setVal(inpRows, sheet.rows); setVal(inpFps, sheet.fps);
    }
    refresh();
    return body;
}

function normSheet(src) {
    src = src || {};
    return {
        cols: AFX.clamp((src.cols | 0) || 1, 1, MAXG),
        rows: AFX.clamp((src.rows | 0) || 1, 1, MAXG),
        fps: AFX.clamp((src.fps | 0) || 30, 1, 120)
    };
}

// модалка сетки для КОНКРЕТНОЙ картинки. opts: {title, name, img, sheet, accept(sheet), cancel()}
TP.openSheetDialog = function (opts) {
    const img = opts.img;
    const sheet = normSheet(opts.sheet);
    const body = h('div');
    body.appendChild(h('div', { cls: 'sheet-file' },
        h('b', { text: opts.name || '' }),
        h('span', { text: '   ' + img.width + '×' + img.height + ' px' })));
    body.appendChild(buildGridEditor(img, sheet));

    return D.modal({
        title: opts.title || L('Atlas grid'), body: body, wide: true,
        acceptLabel: L('Accept'), cancelLabel: L('Cancel'),
        onAccept: function () { opts.accept && opts.accept({ cols: sheet.cols, rows: sheet.rows, fps: sheet.fps }); },
        onCancel: function () { opts.cancel && opts.cancel(); }
    });
};

// ГЛАВНАЯ модалка атласа: сначала источник (файл с диска / drop / лист из проекта),
// потом сетка. opts: {title, accept(texId), cancel()}
TP.openAtlasPicker = function (opts) {
    const doc = AFX.state.doc;
    let src = null;                     // {kind:'new'|'tex', name, img, dataURL, texId}
    let sheet = normSheet(null);
    let dlg = null;

    const body = h('div');

    // --- источник: файл ---
    const drop = h('div', { cls: 'atlas-drop' });
    const dropLabel = h('div', { cls: 'atlas-drop-label', text: L('Drop a sprite sheet here') });
    const fileBtn = h('button', { cls: 'tb accent', text: L('Choose file...') });
    const fileInp = h('input', { type: 'file', accept: 'image/*', style: 'display:none;' });
    fileBtn.addEventListener('click', function () { fileInp.click(); });
    fileInp.addEventListener('change', function () {
        const f = (fileInp.files || [])[0];
        fileInp.value = '';
        if (f) loadFile(f);
    });
    drop.appendChild(dropLabel);
    drop.appendChild(fileBtn);
    drop.appendChild(fileInp);
    drop.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();                     // не отдавать файл глобальному импорту текстур
        drop.classList.remove('over');
        const f = Array.from(e.dataTransfer.files || []).filter(x => /^image\//.test(x.type))[0];
        if (f) loadFile(f);
    });
    body.appendChild(drop);

    // --- источник: уже загруженные листы проекта ---
    const inProject = (doc.textures || []).filter(t => AFX.Sprites.texs.get(t.id));
    const texCells = [];
    if (inProject.length) {
        const strip = h('div', { cls: 'atlas-strip' });
        strip.appendChild(h('span', { cls: 'sheet-hint', text: L('or take one from the project:') }));
        inProject.forEach(meta => {
            const rec = AFX.Sprites.texs.get(meta.id);
            const cell = h('div', { cls: 'atlas-cell', title: meta.name },
                h('img', { src: rec.dataURL }),
                h('div', { cls: 'cap', text: meta.name }));
            cell.addEventListener('click', function () {
                src = { kind: 'tex', name: meta.name, img: rec.img, texId: meta.id };
                sheet = normSheet(meta.sheet || TP.guessSheet(rec.img.width, rec.img.height));
                texCells.forEach(c => c.el.classList.toggle('sel', c.id === meta.id));
                renderGrid();
            });
            strip.appendChild(cell);
            texCells.push({ el: cell, id: meta.id });
        });
        body.appendChild(strip);
    }

    // --- сетка выбранного источника ---
    const gridBox = h('div');
    body.appendChild(gridBox);

    function renderGrid() {
        gridBox.innerHTML = '';
        if (!src) {
            gridBox.appendChild(h('div', { cls: 'atlas-empty', text: L('Load a PNG sheet or pick one from the project — the grid is guessed from the aspect ratio.') }));
            if (dlg) dlg.acceptBtn.disabled = true;
            return;
        }
        gridBox.appendChild(h('div', { cls: 'sheet-file' },
            h('b', { text: src.name }),
            h('span', { text: '   ' + src.img.width + '×' + src.img.height + ' px' })));
        gridBox.appendChild(buildGridEditor(src.img, sheet));
        if (dlg) dlg.acceptBtn.disabled = false;
    }

    function loadFile(file) {
        if (!file || !/^image\//.test(file.type)) return;
        const reader = new FileReader();
        reader.onload = function () {
            const img = new Image();
            img.onerror = function () { console.warn('Failed to read image', file.name); };
            img.onload = function () {
                src = { kind: 'new', name: file.name.replace(/\.[^.]+$/, ''), img: img, dataURL: reader.result };
                sheet = normSheet(TP.guessSheet(img.width, img.height));
                texCells.forEach(c => c.el.classList.remove('sel'));
                renderGrid();
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    }

    renderGrid();
    dlg = D.modal({
        title: opts.title || L('Sprite atlas'), body: body, wide: true,
        acceptLabel: L('Accept'), cancelLabel: L('Cancel'),
        onAccept: function () {
            if (!src) return false;                       // источник не выбран — не закрывать
            const out = { cols: sheet.cols, rows: sheet.rows, fps: sheet.fps };
            if (src.kind === 'tex') {
                const meta = (AFX.state.doc.textures || []).filter(t => t.id === src.texId)[0];
                const same = meta && meta.sheet && meta.sheet.cols === out.cols && meta.sheet.rows === out.rows && meta.sheet.fps === out.fps;
                if (meta && !same) {
                    AFX.pushUndo();
                    meta.sheet = out;
                    applySheet(AFX.state.doc);
                }
                if (opts.accept) opts.accept(src.texId);
                return;
            }
            AFX.Sprites.addTexture(src.name, src.dataURL, function (id) {
                if (!id) return;
                const d = AFX.state.doc;
                AFX.pushUndo();
                d.textures.push({ id: id, name: src.name, sheet: out });
                AFX.Model.syncTexSheets(d);
                AFX.touchAll();
                AFX.commitEnd();
                TP.rebuild();
                if (opts.accept) opts.accept(id);
            });
        },
        onCancel: function () { opts.cancel && opts.cancel(); }
    });
    dlg.acceptBtn.disabled = !src;
    return dlg;
};

// импорт файла картинки как текстуры
TP.importFile = function (file) {
    if (!file || !/^image\//.test(file.type)) return;
    const reader = new FileReader();
    reader.onload = function () {
        AFX.pushUndo();
        const name = file.name.replace(/\.[^.]+$/, '');
        AFX.Sprites.addTexture(name, reader.result, function (id) {
            if (!id) return;
            AFX.state.doc.textures.push({ id: id, name: name, sheet: null });
            AFX.touchAll();
            AFX.commitEnd();
            TP.rebuild();
        });
    };
    reader.readAsDataURL(file);
};

// импорт спрайт-атласа: сетка предлагается по соотношению сторон и подтверждается в модалке.
// done(texId) — вызывается после принятия (используется кнопкой "+ Atlas" на таймлайне)
TP.importAtlasFile = function (file, done) {
    if (!file || !/^image\//.test(file.type)) return;
    const reader = new FileReader();
    reader.onload = function () {
        const dataURL = reader.result;
        const name = file.name.replace(/\.[^.]+$/, '');
        const img = new Image();
        img.onerror = function () { console.warn('Failed to read image', name); };
        img.onload = function () {
            TP.openSheetDialog({
                title: L('Add sprite atlas'), name: name, img: img,
                sheet: TP.guessSheet(img.width, img.height),
                accept: function (sheet) {
                    AFX.Sprites.addTexture(name, dataURL, function (id) {
                        if (!id) return;
                        const doc = AFX.state.doc;
                        AFX.pushUndo();
                        doc.textures.push({ id: id, name: name, sheet: sheet });
                        AFX.Model.syncTexSheets(doc);
                        AFX.touchAll();
                        AFX.commitEnd();
                        TP.rebuild();
                        if (done) done(id);
                    });
                }
            });
        };
        img.src = dataURL;
    };
    reader.readAsDataURL(file);
};

// выбор файла -> диалог сетки -> текстура-лист; done(texId) на приёме
let pickInp = null, pickDone = null;
TP.pickAtlasFile = function (done) {
    if (!pickInp) {
        pickInp = h('input', { type: 'file', accept: 'image/*', style: 'display:none;' });
        pickInp.addEventListener('change', function () {
            const f = (pickInp.files || [])[0];
            const cb = pickDone;
            pickDone = null;
            pickInp.value = '';
            if (f) TP.importAtlasFile(f, cb);
        });
        document.body.appendChild(pickInp);
    }
    pickDone = done || null;
    pickInp.click();
};

// последняя текстура-лист в проекте (кандидат для нового ATLAS-слоя)
TP.lastSheetTexture = function (doc) {
    const list = (doc || AFX.state.doc).textures || [];
    for (let i = list.length - 1; i >= 0; i--) {
        const rec = AFX.Sprites.texs.get(list[i].id);
        if (rec && rec.sheet) return list[i].id;
    }
    for (let i = list.length - 1; i >= 0; i--) {
        if (AFX.Sprites.texs.get(list[i].id)) return list[i].id;
    }
    return null;
};

// drag-and-drop файлов в окно
TP.initDrop = function () {
    const overlay = h('div', { cls: 'drop-overlay hidden', text: L('Drop to import') });
    document.body.appendChild(overlay);
    let depth = 0;
    window.addEventListener('dragenter', function (e) {
        if (D.modalOpen()) return;                  // в модалке атласа своя зона броска
        if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
            depth++;
            overlay.classList.remove('hidden');
        }
    });
    window.addEventListener('dragleave', function () {
        depth = Math.max(0, depth - 1);
        if (!depth) overlay.classList.add('hidden');
    });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) {
        if (D.modalOpen()) return;
        e.preventDefault();
        depth = 0;
        overlay.classList.add('hidden');
        const files = Array.from(e.dataTransfer.files || []);
        files.filter(f => /^image\//.test(f.type)).forEach(f => TP.importFile(f));
        files.filter(f => /\.json$/i.test(f.name)).forEach(f => AFX.Catalog.importJsonFile(f));
    });
};
})();
