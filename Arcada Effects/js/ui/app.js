// Arcaidia Effector — состояние приложения, undo/redo, клавиатура, загрузка
(function () {
'use strict';
const AFX = window.AFX;
const L = function (k) { return AFX.t(k); };

AFX.state = {
    doc: null,
    time: 0,
    playing: false,
    loop: true,
    sel: null,              // id первичного выбранного слоя
    selLayers: new Set(),   // мультивыделение слоёв (Shift+клик на таймлайне)
    selKeys: [],            // выбранные ключи [{layerId, path, tr, key}]
    graphSel: null,         // {layerId, path} | {layerId, curve:'sizeOL'|'opacityOL'}
    tab: 'preview',
    dirty: false            // есть несохранённые изменения
};

AFX.previewEngine = null;

AFX.layerById = function (id) {
    if (!id || !AFX.state.doc) return null;
    return AFX.state.doc.layers.find(l => l.id === id) || null;
};

// ---------- undo / redo ----------
const undoStack = [];
const redoStack = [];
const UNDO_MAX = 60;
let autosaveTimer = 0;

AFX.pushUndo = function () {
    try {
        undoStack.push(AFX.Model.stripJson(AFX.state.doc));
        if (undoStack.length > UNDO_MAX) undoStack.shift();
        redoStack.length = 0;
        AFX.state.docTs = Date.now(); // метка последней правки (мультивкладочный merge сессии)
        if (!AFX.state.dirty) {
            AFX.state.dirty = true;
            AFX.emit('dirty');
        }
        updateUndoBtns();
    } catch (e) { console.error(e); }
};
AFX.commitEnd = function () {
    scheduleAutosave();
};
AFX.undo = function () {
    if (!undoStack.length) return;
    redoStack.push(AFX.Model.stripJson(AFX.state.doc));
    restore(undoStack.pop());
};
AFX.redo = function () {
    if (!redoStack.length) return;
    undoStack.push(AFX.Model.stripJson(AFX.state.doc));
    restore(redoStack.pop());
};
function restore(json) {
    const doc = AFX.Model.migrate(JSON.parse(json));
    AFX.state.doc = doc;
    AFX.state.selKeys = [];
    if (!AFX.layerById(AFX.state.sel)) AFX.state.sel = doc.layers.length ? doc.layers[0].id : null;
    AFX.state.selLayers = new Set(AFX.state.sel ? [AFX.state.sel] : []);
    AFX.Model.syncTexSheets(doc);
    // рабочая копия в сессии должна ссылаться на актуальный объект
    const ws = workspace.get(doc.id);
    if (ws) ws.doc = doc;
    AFX.touchAll();
    AFX.emit('doc');
    AFX.emit('select');
    updateUndoBtns();
    scheduleAutosave();
}
function updateUndoBtns() {
    const u = document.getElementById('btn-undo'), r = document.getElementById('btn-redo');
    if (u) u.disabled = !undoStack.length;
    if (r) r.disabled = !redoStack.length;
}

// ---------- мутации ----------
AFX.touch = function (layerId) {
    const layer = AFX.layerById(layerId);
    if (layer) layer._rev = (layer._rev || 0) + 1;
    AFX.emit('layer', layerId);
    scheduleAutosave();
};
AFX.touchAll = function () {
    if (!AFX.state.doc) return;
    AFX.state.doc.layers.forEach(l => { l._rev = (l._rev || 0) + 1; });
    AFX.emit('comp');
    scheduleAutosave();
};

// ---------- рабочая сессия (workspace) ----------
// Несохранённые правки каждого эффекта живут в памяти между переключениями каталога
// и попадают в файл/каталог только по кнопке "Сохранить".
const workspace = new Map(); // docId -> {doc, dirty, undo, redo, time, sel}
const WS_MAX = 12;

// нетронутый пустой док (свежий "New Effect"): не dirty, ни слоёв, ни текстур.
// Такой не стешим в сессию, не пишем в localStorage и не восстанавливаем на
// старте — иначе несохранённый "New Effect" воскресает при каждом запуске.
function pristineDoc(doc, dirty) {
    return !dirty && !(doc.layers && doc.layers.length) && !(doc.textures && doc.textures.length);
}

function stashCurrent() {
    const d = AFX.state.doc;
    if (!d) return;
    workspace.delete(d.id); // переставить в конец (LRU)
    // нетронутый "New Effect" в сессии не держим: воссоздаётся кнопкой New
    if (pristineDoc(d, AFX.state.dirty) && !undoStack.length && !redoStack.length) return;
    workspace.set(d.id, {
        doc: d,
        dirty: AFX.state.dirty,
        ts: AFX.state.docTs || 0,
        undo: undoStack.slice(),
        redo: redoStack.slice(),
        time: AFX.state.time,
        sel: AFX.state.sel
    });
    // вытесняем только чистые записи
    if (workspace.size > WS_MAX) {
        for (const [id, e] of workspace) {
            if (workspace.size <= WS_MAX) break;
            if (id !== d.id && !e.dirty) workspace.delete(id);
        }
    }
}

// открыть эффект. ГРЯЗНАЯ рабочая копия в сессии побеждает (несохранённые правки),
// ЧИСТАЯ — уступает свежезагруженному контенту (файл/заводской пресет авторитетнее):
// иначе после Save клик по каталогу показывал бы устаревшую копию.
AFX.openDoc = function (doc, opts) {
    opts = opts || {};
    // тот же эффект уже открыт: перечитываем содержимое, если правок нет — иначе
    // устаревшая ЧИСТАЯ копия сессии остаётся на экране навсегда (клик по строке
    // каталога никогда не перечитал бы файл). Свой же объект и грязную копию не трогаем.
    if (AFX.state.doc && doc && AFX.state.doc.id === doc.id && !opts.fresh) {
        if (AFX.state.doc === doc || AFX.state.dirty) return;
    }
    stashCurrent();
    if (opts.fresh) workspace.delete(doc.id);
    const entry = workspace.get(doc.id);
    if (entry && entry.dirty) {
        applyDoc(entry.doc, entry);
    } else {
        const keep = entry || {};
        workspace.delete(doc.id);
        applyDoc(doc, {
            dirty: false,
            undo: keep.undo || [], redo: keep.redo || [],
            time: keep.time || 0, sel: keep.sel || null,
            ts: Date.now()
        });
    }
};

AFX.wsDirty = function (id) {
    if (AFX.state.doc && AFX.state.doc.id === id) return AFX.state.dirty;
    const e = workspace.get(id);
    return !!(e && e.dirty);
};
AFX.wsSyncSaved = function (id) {
    const e = workspace.get(id);
    if (e) e.dirty = false;
};
// выбросить рабочую копию из сессии (например, эффект удалён из каталога).
// id запоминаем: merge в saveWorkspaceLS не должен реанимировать копию из stored
const wsDeleted = new Set();
AFX.wsDelete = function (id) {
    if (AFX.state.doc && AFX.state.doc.id === id) return; // открытый док не трогаем
    wsDeleted.add(id);
    workspace.delete(id);
    scheduleAutosave();
};
// все эффекты сессии (текущий + рабочие копии), от новых к старым — для каталога
AFX.wsList = function () {
    const out = [];
    const seen = new Set();
    const cur = AFX.state.doc;
    if (cur) {
        out.push({ id: cur.id, name: cur.name, dirty: AFX.state.dirty, current: true });
        seen.add(cur.id);
    }
    Array.from(workspace.values()).reverse().forEach(e => {
        if (!e.doc || seen.has(e.doc.id)) return;
        seen.add(e.doc.id);
        out.push({ id: e.doc.id, name: e.doc.name, dirty: e.dirty, current: false });
    });
    return out;
};
AFX.wsGetDoc = function (id) {
    if (AFX.state.doc && AFX.state.doc.id === id) return AFX.state.doc;
    const e = workspace.get(id);
    return e ? e.doc : null;
};

function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveWorkspaceLS, 700);
}
// немедленный сброс сессии в localStorage (например, перед сменой языка с перезагрузкой)
AFX.flushAutosave = function () {
    clearTimeout(autosaveTimer);
    saveWorkspaceLS();
};

function saveWorkspaceLS() {
    try {
        stashCurrent();
        // merge с localStorage по ts: параллельная вкладка не должна затирать
        // более свежие правки (last-writer-wins ПО ЗАПИСИ, а не по всему файлу)
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem('afx.workspace') || 'null'); } catch (e) {}
        const out = new Map();
        ((stored && stored.entries) || []).forEach(en => {
            if (en && en.doc && en.doc.id && !wsDeleted.has(en.doc.id)) out.set(en.doc.id, en);
        });
        workspace.forEach(e => {
            if (!e.doc) return;
            const prev = out.get(e.doc.id);
            if (!prev || (e.ts || 0) >= (prev.ts || 0)) {
                out.set(e.doc.id, { doc: JSON.parse(AFX.Model.stripJson(e.doc)), dirty: e.dirty, ts: e.ts || 0 });
            }
        });
        // нетронутые пустые доки не пишем (и вычищаем залежавшиеся из прошлых сессий)
        let entries = Array.from(out.values()).filter(en => en.doc && !pristineDoc(en.doc, en.dirty));
        // кап: грязные держим все, чистые — новейшие
        const dirtyE = entries.filter(e => e.dirty);
        const cleanE = entries.filter(e => !e.dirty).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, WS_MAX);
        entries = dirtyE.concat(cleanE);

        const texIds = new Set();
        entries.forEach(en => (en.doc.textures || []).forEach(t => texIds.add(t.id)));
        localStorage.removeItem('afx.autosave'); // legacy-формат одной копии больше не нужен
        // мёртвые пейлоады текстур (нет ни в одной копии сессии) освобождают квоту
        Object.keys(localStorage).forEach(k => {
            if (k.lastIndexOf('afx.tex.', 0) === 0 && !texIds.has(k.slice(8))) localStorage.removeItem(k);
        });
        // квота: молча потерять запись сессии нельзя — устаревшая копия перебивает
        // сохранённый файл при следующем открытии. Не влезло — режем чистые копии,
        // не влезло и так — говорим вслух и убираем протухшую запись.
        if (!writeWorkspace(entries)) {
            if (!writeWorkspace(entries.filter(e => e.dirty))) {
                try { localStorage.removeItem('afx.workspace'); } catch (e) {}
                console.warn('afx: workspace does not fit in localStorage');
                AFX.setStatus(L('Session does not fit in localStorage: save your effects to the catalog.'));
                return;
            }
        }
        texIds.forEach(id => {
            const rec = AFX.Sprites.texs.get(id);
            if (rec) {
                try { localStorage.setItem('afx.tex.' + id, rec.dataURL); } catch (e) {}
            }
        });
    } catch (e) { /* переполнение — не критично */ }
}
function writeWorkspace(entries) {
    try {
        localStorage.setItem('afx.workspace', JSON.stringify({ cur: AFX.state.doc.id, entries: entries }));
        return true;
    } catch (e) { return false; }
}

// ---------- время и плейбек ----------
AFX.setTime = function (t) {
    AFX.state.time = AFX.clamp(t, 0, AFX.state.doc.comp.dur);
    AFX.emit('time');
};
AFX.stepFrame = function (dir) {
    const fps = AFX.state.doc.comp.fps || 60;
    const fr = Math.round(AFX.state.time * fps) + dir;
    AFX.setPlaying(false);
    AFX.setTime(fr / fps);
};
AFX.setPlaying = function (on) {
    if (AFX.state.playing === on) return;
    AFX.state.playing = on;
    if (on && AFX.state.time >= AFX.state.doc.comp.dur - 1e-4) AFX.state.time = 0;
    AFX.emit('play');
};
AFX.setTab = function (tab) {
    if (AFX.state.tab === tab) return;
    AFX.state.tab = tab;
    AFX.emit('tab');
};

// ---------- операции ----------
AFX.deleteSelKeys = function () {
    const sel = AFX.state.selKeys;
    if (!sel.length) return;
    AFX.pushUndo();
    const byTrack = new Map();
    sel.forEach(s => {
        if (!byTrack.has(s.tr)) byTrack.set(s.tr, s);
        AFX.Track.removeKey(s.tr, s.key);
    });
    // трек без ключей -> статика
    byTrack.forEach((s, tr) => {
        if (!tr.keys.length) {
            const layer = AFX.layerById(s.layerId);
            if (layer) {
                // путь любой глубины: 'opacity', 'em.rate', 'em.sub.pt.size', 'em.path.nodes.0.x'
                const parts = s.path.split('.');
                let obj = layer;
                for (let i = 0; i < parts.length - 1 && obj; i++) obj = obj[parts[i]];
                const key = parts[parts.length - 1];
                if (obj) obj[key] = Array.isArray(s.key.v) ? s.key.v.slice() : s.key.v;
            }
        }
    });
    const lids = new Set(sel.map(s => s.layerId));
    AFX.state.selKeys = [];
    lids.forEach(id => AFX.touch(id));
    AFX.commitEnd();
    AFX.emit('layers');
};

AFX.exportAtlasPNG = function () {
    const res = AFX.Preview.getAtlas();
    if (res) AFX.Atlas.downloadPNG(AFX.state.doc, res.canvas);
};
AFX.exportAtlasMeta = function () {
    const res = AFX.Preview.getAtlas();
    if (!res) return;
    const json = AFX.Atlas.metaJSON(AFX.state.doc, res.info);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(json).then(
            () => AFX.setStatus(L('Meta copied to clipboard')),
            () => AFX.downloadText(AFX.safeFileName(AFX.state.doc.name) + '_meta.json', json)
        );
    } else {
        AFX.downloadText(AFX.safeFileName(AFX.state.doc.name) + '_meta.json', json);
    }
};

let statusTimer = 0;
AFX.setStatus = function (text) {
    const el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { el.textContent = ''; }, 4000);
};

// ---------- буфер слоёв (Ctrl+C / Ctrl+V, работает между эффектами) ----------
let layerClipboard = null; // {layers:[clean json], tex:[meta]}

AFX.copyLayers = function () {
    const doc = AFX.state.doc;
    let sel = AFX.Ops.selectedLayers();
    if (!sel.length && AFX.state.sel) {
        const l = AFX.layerById(AFX.state.sel);
        if (l) sel = [l];
    }
    if (!sel.length) return false;
    const picked = doc.layers.filter(l => sel.includes(l)); // порядок как в доке
    const texIds = new Set();
    picked.forEach(l => {
        const ref = l.pt ? l.pt.sprite : (l.sp ? l.sp.sprite : null);
        if (ref && ref.kind === 'tex') texIds.add(ref.texId);
    });
    layerClipboard = {
        layers: picked.map(l => AFX.Model.cleanClone(l)),
        tex: (doc.textures || []).filter(t => texIds.has(t.id)).map(t => AFX.deepClone(t))
    };
    AFX.setStatus(L('Copied layers') + ': ' + picked.length);
    return true;
};

AFX.pasteLayers = function () {
    if (!layerClipboard || !layerClipboard.layers.length) return false;
    const doc = AFX.state.doc;
    AFX.pushUndo();
    // перенести мету текстур, если её нет в целевом эффекте (пейлоады живут в общем реестре)
    layerClipboard.tex.forEach(meta => {
        if (!doc.textures.some(t => t.id === meta.id)) doc.textures.push(AFX.deepClone(meta));
    });
    AFX.Model.syncTexSheets(doc);
    let at = doc.layers.findIndex(l => l.id === AFX.state.sel);
    if (at < 0) at = 0;
    const pasted = layerClipboard.layers.map(j => {
        const c = AFX.deepClone(j);
        c.id = AFX.uid('lr');
        return c;
    });
    doc.layers.splice.apply(doc.layers, [at, 0].concat(pasted));
    pasted.forEach(p => AFX.touch(p.id));
    AFX.commitEnd();
    AFX.state.sel = pasted[0].id;
    AFX.state.selLayers = new Set(pasted.map(p => p.id));
    AFX.emit('layers');
    AFX.emit('select');
    AFX.emit('tex');
    AFX.setStatus(L('Pasted layers') + ': ' + pasted.length);
    return true;
};

// ---------- загрузка документа ----------
// applyDoc — низкоуровневое применение дока с состоянием сессии (dirty, undo, время, выбор)
function applyDoc(doc, st) {
    st = st || {};
    AFX.state.doc = AFX.Model.migrate(doc);
    AFX.state.playing = false;
    AFX.state.selKeys = [];
    AFX.state.graphSel = null;
    AFX.state.dirty = !!st.dirty;
    AFX.state.docTs = st.ts || Date.now();
    AFX.state.time = AFX.clamp(st.time || 0, 0, doc.comp.dur);
    const selOk = st.sel && doc.layers.some(l => l.id === st.sel);
    AFX.state.sel = selOk ? st.sel : (doc.layers.length ? doc.layers[0].id : null);
    AFX.state.selLayers = new Set(AFX.state.sel ? [AFX.state.sel] : []);
    AFX.Model.syncTexSheets(doc);
    undoStack.length = 0;
    redoStack.length = 0;
    if (st.undo && st.undo.length) undoStack.push.apply(undoStack, st.undo);
    if (st.redo && st.redo.length) redoStack.push.apply(redoStack, st.redo);
    updateUndoBtns();
    const nameInp = document.getElementById('fx-name');
    if (nameInp) nameInp.value = doc.name;
    AFX.touchAll();
    AFX.emit('doc');
    AFX.emit('select');
    AFX.emit('time');
    AFX.emit('play');
    AFX.emit('dirty');
    scheduleAutosave();
}

// свежая загрузка без стеша текущего (используется на старте)
AFX.loadDoc = function (doc) { applyDoc(doc, null); };
AFX._applyDoc = applyDoc;

// ---------- клавиатура ----------
function initKeyboard() {
    window.addEventListener('keydown', function (e) {
        // модальный диалог перехватывает клавиатуру целиком (Esc/Enter — его собственные)
        if (AFX.Dom.modalOpen && AFX.Dom.modalOpen()) return;
        const el = e.target;
        const tag = (el.tagName || '').toLowerCase();
        const type = (el.type || '').toLowerCase();
        // текстовый ввод не перехватываем вообще
        const isTyping = tag === 'textarea' || (tag === 'input' && type === 'text');
        if (isTyping) return;
        if (e.code === 'Space') {
            // пробел = всегда плей/пауза; снимаем фокус с кнопок и селектов,
            // иначе пробел раскрывает список / жмёт кнопку повторно
            e.preventDefault();
            if (el && el.blur && tag !== 'body') el.blur();
            if (!e.repeat) AFX.setPlaying(!AFX.state.playing);
            return;
        }
        if (tag === 'select' || tag === 'input') return;
        if (e.ctrlKey || e.metaKey) {
            if (e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? AFX.redo() : AFX.undo(); return; }
            if (e.code === 'KeyY') { e.preventDefault(); AFX.redo(); return; }
            if (e.code === 'KeyS') { e.preventDefault(); AFX.saveCurrent(); return; }
            if (e.code === 'KeyD') {
                e.preventDefault();
                const layer = AFX.layerById(AFX.state.sel);
                if (layer) AFX.Ops.duplicate(layer);
                return;
            }
            if (e.code === 'KeyC') {
                // не мешаем копированию выделенного текста
                if (String(window.getSelection && window.getSelection() || '') === '') {
                    if (AFX.copyLayers()) e.preventDefault();
                }
                return;
            }
            if (e.code === 'KeyV') {
                if (AFX.pasteLayers()) e.preventDefault();
                return;
            }
        }
        if (e.code === 'Home') { e.preventDefault(); AFX.setPlaying(false); AFX.setTime(0); }
        else if (e.code === 'End') { e.preventDefault(); AFX.setPlaying(false); AFX.setTime(AFX.state.doc.comp.dur); }
        else if (e.code === 'ArrowLeft') { e.preventDefault(); AFX.stepFrame(e.shiftKey ? -10 : -1); }
        else if (e.code === 'ArrowRight') { e.preventDefault(); AFX.stepFrame(e.shiftKey ? 10 : 1); }
        else if (e.code === 'Delete' || e.code === 'Backspace') {
            e.preventDefault();
            if (AFX.state.selKeys.length) AFX.deleteSelKeys();
            else {
                const layers = AFX.Ops.selectedLayers();
                if (layers.length) AFX.Ops.removeMany(layers);
            }
        } else if (e.code === 'KeyU') {
            // U — раскрыть/свернуть параметры выбранных слоёв на таймлайне
            const layers = AFX.Ops.selectedLayers();
            if (layers.length) {
                const open = !layers[0]._tlOpen;
                layers.forEach(l => { l._tlOpen = open; });
                AFX.Timeline.rebuild();
            }
        } else if (e.code === 'KeyF') { AFX.Preview.fit(); }
    });
}

AFX.saveCurrent = function () {
    const nameInp = document.getElementById('fx-name');
    if (nameInp && nameInp.value.trim()) AFX.state.doc.name = nameInp.value.trim();
    const id = AFX.state.doc.id;
    // чистим флаг только по факту успешной записи (ошибка сервера/квоты обязана
    // оставить эффект несохранённым), после чего НЕМЕДЛЕННО сбрасываем сессию в
    // localStorage: иначе там остаётся копия с dirty=true и содержимым ДО сохранения,
    // и при следующем открытии она перебивает только что записанный файл.
    AFX.Catalog.saveCurrent(function (ok) {
        if (!ok) return;
        AFX.wsSyncSaved(id);
        if (AFX.state.doc && AFX.state.doc.id === id) AFX.state.dirty = false;
        AFX.emit('dirty');
        AFX.flushAutosave();
    });
};

// ---------- старт ----------
function applyStaticTexts() {
    const set = function (id, text, title) {
        const el = document.getElementById(id);
        if (!el) return;
        if (text != null) el.textContent = text;
        if (title != null) el.title = title;
    };
    set('btn-undo', L('Undo'), L('Undo') + ' (Ctrl+Z)');
    set('btn-redo', L('Redo'), L('Redo') + ' (Ctrl+Y)');
    set('btn-save', L('Save'), L('Save to catalog (Ctrl+S)'));
    set('btn-png', L('Download PNG'), L('Save the atlas as a PNG file'));
    set('btn-seq', L('Export sequence'), L('Save the effect as a numbered PNG sequence (.zip)'));
    set('fx-name', null, L('Effect name'));
    set('globals-title', L('Global Settings'));
    set('catalog-title', L('Effects Catalog'));
    set('textures-title', L('Textures'));
    set('inspector-title', L('Inspector'));
    set('btn-settings', null, L('Settings'));
    set('btn-help', null, L('Help'));
    set('app-ver', 'v' + AFX.VERSION, L('Version') + ' ' + AFX.VERSION);
}

function initSettingsButton() {
    const btn = document.getElementById('btn-settings');
    if (!btn) return;
    btn.appendChild(AFX.Dom.icon('gear'));
    btn.addEventListener('click', function (e) {
        const hEl = AFX.Dom.h;
        const content = hEl('div', { style: 'min-width:200px;' });
        content.appendChild(hEl('h4', { text: L('Settings') }));
        const row = hEl('div', { style: 'display:flex;align-items:center;gap:8px;padding:4px 0;' });
        row.appendChild(hEl('span', { style: 'color:#9a917a;font-size:12px;flex:0 0 70px;', text: L('Language') }));
        const sel = hEl('select', { cls: 'w-select' });
        sel.appendChild(hEl('option', { value: 'en', text: 'English' }));
        sel.appendChild(hEl('option', { value: 'ru', text: 'Русский' }));
        sel.value = AFX.lang;
        sel.addEventListener('change', function () {
            if (sel.value !== AFX.lang) AFX.setLang(sel.value); // сохранит сессию и перезагрузит страницу
        });
        row.appendChild(sel);
        content.appendChild(row);
        const r = btn.getBoundingClientRect();
        AFX.Dom.popover(r.right - 210, r.bottom + 6, content);
    });
}

// --- окно справки (кнопка "?" в топбаре) ---
// Строки английские + L(); версия берётся из AFX.VERSION (meta в index.html).
// Контакты и имя ссылок — данные, не переводятся.
const ABOUT_1 = 'Arcaidia Effector is an editor for authoring 2D effects for game projects. '
    + 'Its architecture is designed to be as efficient as possible for hybrid work with agentic LLM systems.';
const ABOUT_2 = 'It ships with orchestrators and skills that let an LLM not only author effects, '
    + 'but also change the functionality of the editor itself.';
const LINKS = [
    { href: 'https://t.me/tearevo', text: 't.me/tearevo' },
    { href: 'mailto:tearevo@yandex.ru', text: 'tearevo@yandex.ru' },
    { href: 'https://tearevo.com', text: 'tearevo.com' }
];

function openHelp() {
    const h = AFX.Dom.h;
    const body = h('div', { cls: 'about' });

    const head = h('div', { cls: 'about-head' });
    head.appendChild(h('div', { cls: 'about-logo', html: 'ARCAIDIA <span>EFFECTOR</span>' }));
    head.appendChild(h('div', { cls: 'about-ver', text: L('Version') + ' ' + AFX.VERSION }));
    body.appendChild(head);

    body.appendChild(h('p', { cls: 'about-p', text: L(ABOUT_1) }));
    body.appendChild(h('p', { cls: 'about-p', text: L(ABOUT_2) }));

    body.appendChild(h('div', { cls: 'about-author', text: L('Author') + ': ' + L('Anton Chuev') + ' (Tearevo)' }));
    const links = h('div', { cls: 'about-links' });
    LINKS.forEach(function (l) {
        links.appendChild(h('a', { href: l.href, target: '_blank', rel: 'noopener noreferrer', text: l.text }));
    });
    body.appendChild(links);

    const m = AFX.Dom.modal({ title: L('Help'), body: body, acceptLabel: L('Close') });
    m.cancelBtn.style.display = 'none'; // информационное окно: одна кнопка
}

function initHelpButton() {
    const btn = document.getElementById('btn-help');
    if (!btn) return;
    btn.appendChild(AFX.Dom.icon('help'));
    btn.addEventListener('click', openHelp);
}

// deep-link автоматизации: ?open=<file.json>&t=<сек>&tab=preview|atlas&fresh=1
// open — файл из library/ (нужен сервер); fresh=1 — выбросить рабочую копию
// (иначе действует правило победителя: грязная копия сессии побеждает файл).
function handleDeepLink() {
    let q = null;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    const file = q.get('open');
    const tab = q.get('tab');
    const t = parseFloat(q.get('t'));
    const apply = function () {
        if (tab === 'preview' || tab === 'atlas') AFX.setTab(tab);
        if (isFinite(t)) { AFX.setPlaying(false); AFX.setTime(t); }
    };
    if (!file) {
        if (tab || isFinite(t)) apply();
        return;
    }
    fetch('api/effect?f=' + encodeURIComponent(file), { cache: 'no-store' })
        .then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(f => AFX.Model.loadEffectFile(f, function (doc) {
            if (!doc) { AFX.setStatus(L('Failed to open the effect from URL')); return; }
            // чистая копия уступает файлу и при совпадении id (итерации по deep-link:
            // перезапись файла + reload обязаны показать новый контент);
            // грязную копию перебивает только явный fresh=1
            const fresh = q.get('fresh') === '1' || !AFX.wsDirty(doc.id);
            AFX.openDoc(doc, { fresh: fresh });
            if (!fresh) console.warn('deep link: dirty session copy shown instead of the file; add &fresh=1 to discard it');
            apply();
        }))
        .catch(function (e) {
            console.warn('deep link', e);
            AFX.setStatus(L('Failed to open the effect from URL'));
        });
}

function boot() {
    AFX.previewEngine = new AFX.Engine();
    applyStaticTexts();
    initSettingsButton();
    initHelpButton();

    // верхняя панель
    const nameInp = document.getElementById('fx-name');
    nameInp.addEventListener('change', function () {
        const v = nameInp.value.trim();
        if (v && v !== AFX.state.doc.name) {
            AFX.pushUndo();
            AFX.state.doc.name = v;
            AFX.commitEnd();
            AFX.emit('dirty'); // обновить имя в каталоге (черновики/подсветка)
        }
    });
    document.getElementById('btn-undo').addEventListener('click', AFX.undo);
    document.getElementById('btn-redo').addEventListener('click', AFX.redo);
    const saveBtn = document.getElementById('btn-save');
    saveBtn.addEventListener('click', AFX.saveCurrent);
    document.getElementById('btn-png').addEventListener('click', function () { AFX.exportAtlasPNG(); });
    document.getElementById('btn-seq').addEventListener('click', function () { AFX.GlobalsPanel.openSequenceDialog(); });
    AFX.on('dirty', function () {
        saveBtn.classList.toggle('attn', !!AFX.state.dirty);
        saveBtn.title = AFX.state.dirty ? L('Unsaved changes (Ctrl+S)') : L('Save to catalog (Ctrl+S)');
    });

    // восстановление рабочей сессии: все эффекты с несохранёнными правками
    let bootEntry = null;
    const restoreTex = function (doc) {
        (doc.textures || []).forEach(meta => {
            if (AFX.Sprites.texs.has(meta.id)) return;
            const payload = localStorage.getItem('afx.tex.' + meta.id);
            if (payload) AFX.Sprites.restoreTexture(meta, payload, function () { AFX.touchAll(); });
        });
    };
    try {
        const ws = JSON.parse(localStorage.getItem('afx.workspace') || 'null');
        if (ws && ws.entries && ws.entries.length) {
            ws.entries.forEach(en => {
                if (!en.doc || !en.doc.layers) return;
                const d = AFX.Model.migrate(en.doc);
                if (pristineDoc(d, !!en.dirty)) return; // несохранённый пустой "New Effect" не воскрешаем
                workspace.set(d.id, { doc: d, dirty: !!en.dirty, ts: en.ts || 0, undo: [], redo: [], time: 0, sel: null });
                restoreTex(d);
            });
            bootEntry = workspace.get(ws.cur) || workspace.values().next().value || null;
        }
    } catch (e) { bootEntry = null; }
    if (!bootEntry) {
        // legacy-автосейв одной копии
        try {
            const saved = localStorage.getItem('afx.autosave');
            if (saved) {
                const d = AFX.Model.migrate(JSON.parse(saved));
                if (d && d.layers && !pristineDoc(d, false)) {
                    restoreTex(d);
                    bootEntry = { doc: d, dirty: false, undo: [], redo: [], time: 0, sel: null };
                }
            }
        } catch (e) { bootEntry = null; }
    }
    if (!bootEntry) {
        const d = AFX.Factory[0].build();
        d.id = 'factory:' + AFX.Factory[0].id;
        bootEntry = { doc: d, dirty: false, undo: [], redo: [], time: 0, sel: null };
    }

    AFX.state.doc = bootEntry.doc; // до init панелей
    AFX.Dom.initSplitters();
    AFX.GlobalsPanel.init();
    AFX.Catalog.init();
    AFX.TexturesPanel.init();
    AFX.Inspector.init();
    AFX.Preview.init();
    AFX.Timeline.init();
    initKeyboard();
    updateUndoBtns();

    applyDoc(bootEntry.doc, bootEntry);
    handleDeepLink();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
