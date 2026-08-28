// Arcaidia Effector — каталог эффектов: заводские пресеты + библиотека пользователя
// Переключение НЕ теряет правки: рабочие копии живут в сессии (AFX.openDoc),
// несохранённые эффекты помечены точкой; в каталог пишет только кнопка "Сохранить".
(function () {
'use strict';
const AFX = window.AFX;
const D = AFX.Dom, h = D.h, L = AFX.t;

const Cat = AFX.Catalog = {};
let bodyEl = null;
let fsMode = false;      // сервер доступен
let userItems = [];      // [{file?, id?, name, data?, thumb?}]
const LS_KEY = 'afx.library';

Cat.init = function () {
    bodyEl = document.getElementById('catalog-body');
    const btns = document.getElementById('catalog-btns');

    const bNew = h('span', { cls: 'mini-btn', title: L('New empty effect (current edits stay in the session)') }, D.icon('plus'), L('New'));
    bNew.addEventListener('click', function () {
        AFX.openDoc(AFX.Model.newDoc());
    });
    const bImp = h('span', { cls: 'mini-btn', title: L('Import an effect from JSON') }, L('Import'));
    const fileInp = h('input', { type: 'file', accept: '.json', style: 'display:none;' });
    bImp.addEventListener('click', function () { fileInp.click(); });
    fileInp.addEventListener('change', function () {
        if (fileInp.files[0]) Cat.importJsonFile(fileInp.files[0]);
        fileInp.value = '';
    });
    const bExp = h('span', { cls: 'mini-btn', title: L('Export the current effect to JSON') }, L('Export'));
    bExp.addEventListener('click', function () {
        const file = AFX.Model.effectFile(AFX.state.doc);
        AFX.downloadText(AFX.safeFileName(AFX.state.doc.name) + '.json', JSON.stringify(file));
    });
    btns.appendChild(bNew);
    btns.appendChild(bImp);
    btns.appendChild(bExp);
    btns.appendChild(fileInp);

    AFX.on('doc', Cat.rebuild);
    AFX.on('dirty', Cat.rebuild);
    Cat.detectServer(function () {
        Cat.refresh();
    });
};

Cat.detectServer = function (done) {
    fetch('api/list', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject())
        .then(list => { fsMode = true; userItems = list; done(); })
        .catch(() => {
            fsMode = false;
            try { userItems = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
            catch (e) { userItems = []; }
            done();
        });
};

Cat.refresh = function () {
    if (fsMode) {
        fetch('api/list', { cache: 'no-store' }).then(r => r.json()).then(list => {
            userItems = list;
            Cat.rebuild();
        }).catch(Cat.rebuild);
    } else {
        Cat.rebuild();
    }
};

Cat.rebuild = function () {
    if (!bodyEl) return;
    bodyEl.innerHTML = '';

    // черновики сессии: рабочие копии без строки в каталоге (новые/импортированные)
    const knownIds = new Set();
    userItems.forEach(item => {
        const id = item.id || (item.data && item.data.doc && item.data.doc.id);
        if (id) knownIds.add(id);
    });
    AFX.Factory.forEach(p => knownIds.add('factory:' + p.id));
    const drafts = (AFX.wsList ? AFX.wsList() : []).filter(d => !knownIds.has(d.id));
    if (drafts.length) {
        bodyEl.appendChild(h('div', { cls: 'cat-group', text: L('Unsaved') }));
        drafts.forEach(d => bodyEl.appendChild(draftRow(d)));
    }

    bodyEl.appendChild(h('div', { cls: 'cat-group', text: fsMode ? L('Mine') + ' (library/)' : L('Mine') + ' (localStorage)' }));
    if (!userItems.length) {
        bodyEl.appendChild(h('div', { cls: 'catalog-empty', text: L('Empty. The Save button adds the current effect.') }));
    }
    userItems.forEach(item => bodyEl.appendChild(userRow(item)));

    bodyEl.appendChild(h('div', { cls: 'cat-group', text: L('Factory') }));
    AFX.Factory.forEach(p => bodyEl.appendChild(factoryRow(p)));
};

// живая миниатюра черновика (без кэша: док меняется)
function liveThumb(id) {
    const c = h('canvas', { width: 42, height: 42 });
    setTimeout(function () {
        try {
            const doc = AFX.wsGetDoc(id);
            if (!doc) return;
            const img = AFX.Engine.renderThumb(doc, 42, doc.comp.dur * 0.35);
            c.getContext('2d').drawImage(img, 0, 0);
        } catch (e) {}
    }, 30);
    return c;
}

function draftRow(d) {
    const row = h('div', { cls: 'cat-row' + (isCurrent(d.id) ? ' current' : '') });
    row.appendChild(liveThumb(d.id));
    row.appendChild(nameSpan(d.name, d.id, L('not saved')));
    const discard = function () {
        if (!confirm(L('Discard unsaved effect') + ' "' + d.name + '"?')) return;
        AFX.wsDelete(d.id);
        Cat.rebuild();
    };
    if (!d.current) {
        const del = h('span', { cls: 'mini-btn del', title: L('Remove from session') }, D.icon('del'));
        del.addEventListener('click', function (e) {
            e.stopPropagation();
            discard();
        });
        row.appendChild(del);
    }
    row.addEventListener('click', function () {
        const doc = AFX.wsGetDoc(d.id);
        if (doc) AFX.openDoc(doc);
    });
    row.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        const items = [{ label: L('Open'), click: function () { const doc = AFX.wsGetDoc(d.id); if (doc) AFX.openDoc(doc); } }];
        if (!d.current) {
            items.push({ label: L('Remove from session'), danger: true, click: discard });
        }
        D.ctxMenu(e.clientX, e.clientY, items);
    });
    return row;
}

const thumbCache = new Map();
function thumbCanvas(key, makeDoc, thumbT) {
    let c = thumbCache.get(key);
    if (c) return c;
    c = h('canvas', { width: 42, height: 42 });
    thumbCache.set(key, c);
    setTimeout(function () {
        try {
            const doc = makeDoc();
            if (!doc) return;
            const t = thumbT != null ? thumbT : doc.comp.dur * 0.35;
            const img = AFX.Engine.renderThumb(doc, 42, t);
            c.getContext('2d').drawImage(img, 0, 0);
        } catch (e) { console.warn('thumb', e); }
    }, 30);
    return c;
}

function nameSpan(name, id, sub) {
    const nm = h('span', { cls: 'cname' });
    const line = h('span', { style: 'display:flex;align-items:center;gap:5px;' });
    if (id != null && AFX.wsDirty(id)) {
        line.appendChild(h('span', { cls: 'dirty-dot', title: L('Unsaved edits (kept in the session)') }));
    }
    line.appendChild(h('span', { text: name }));
    nm.appendChild(line);
    if (sub) nm.appendChild(h('span', { cls: 'csub', text: sub }));
    return nm;
}

function isCurrent(id, name) {
    const d = AFX.state.doc;
    if (!d) return false;
    if (id != null) return d.id === id;
    return d.name === name;
}

function factoryRow(p) {
    const fid = 'factory:' + p.id;
    const row = h('div', { cls: 'cat-row' + (isCurrent(fid) ? ' current' : '') });
    row.appendChild(thumbCanvas('factory:' + p.id, () => p.build(), p.thumbT));
    row.appendChild(nameSpan(p.name, fid, L('factory preset')));
    const open = function (fresh) {
        const d = p.build();
        d.id = fid;
        AFX.openDoc(d, { fresh: fresh });
    };
    row.addEventListener('click', function () { open(false); });
    row.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        const items = [{ label: L('Open'), click: function () { open(false); } }];
        if (AFX.wsDirty(fid)) {
            items.push({ label: L('Reset edits (to factory)'), danger: true, click: function () { open(true); } });
        }
        D.ctxMenu(e.clientX, e.clientY, items);
    });
    return row;
}

function userRow(item) {
    const itemId = item.id || (item.data && item.data.doc && item.data.doc.id) || null;
    const row = h('div', { cls: 'cat-row' + (isCurrent(itemId, item.name) ? ' current' : '') });
    if (item.thumb) {
        row.appendChild(h('img', { src: item.thumb }));
    } else {
        row.appendChild(h('canvas', { width: 42, height: 42 }));
    }
    row.appendChild(nameSpan(item.name, itemId));

    const del = h('span', { cls: 'mini-btn del', title: L('Delete from catalog') }, D.icon('del'));
    del.addEventListener('click', function (e) {
        e.stopPropagation();
        removeItem(item);
    });
    row.appendChild(del);

    const open = function (fresh) {
        loadItem(item, function (doc) {
            if (doc) AFX.openDoc(doc, { fresh: fresh });
            else alert(L('Failed to read the effect.'));
        });
    };
    row.addEventListener('click', function () { open(false); });
    row.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        const items = [{ label: L('Open'), click: function () { open(false); } }];
        if (itemId != null && AFX.wsDirty(itemId)) {
            items.push({ label: L('Reset edits (to saved)'), danger: true, click: function () { open(true); } });
        }
        items.push({ sep: true });
        items.push({ label: L('Delete from catalog'), danger: true, click: function () { removeItem(item); } });
        D.ctxMenu(e.clientX, e.clientY, items);
    });
    return row;
}

function loadItem(item, cb) {
    if (fsMode) {
        fetch('api/effect?f=' + encodeURIComponent(item.file), { cache: 'no-store' })
            .then(r => r.json())
            .then(file => AFX.Model.loadEffectFile(file, cb))
            .catch(() => cb(null));
    } else {
        AFX.Model.loadEffectFile(item.data, cb);
    }
}

function removeItem(item) {
    if (!confirm(L('Delete effect') + ' "' + item.name + '"?')) return;
    const itemId = item.id || (item.data && item.data.doc && item.data.doc.id) || null;
    if (itemId) AFX.wsDelete(itemId);
    if (fsMode) {
        fetch('api/delete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file: item.file })
        }).then(() => Cat.refresh());
    } else {
        userItems = userItems.filter(x => x !== item);
        saveLS();
        Cat.rebuild();
    }
}

function saveLS() {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(userItems));
        return true;
    } catch (e) {
        alert(L('localStorage is full (likely textures). Use run.bat: the server stores effects as files.'));
        return false;
    }
}

// сохранить текущий эффект в каталог; done(ok) — по факту записи (fs-режим асинхронный)
Cat.saveCurrent = function (done) {
    const doc = AFX.state.doc;
    const file = AFX.Model.effectFile(doc);
    const ok = function (v) { if (done) done(v); };
    let thumb = null;
    try { thumb = AFX.Engine.renderThumb(doc, 42).toDataURL('image/png'); } catch (e) {}

    if (fsMode) {
        fetch('api/save', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: doc.name, data: file, thumb: thumb })
        }).then(r => r.json()).then(res => {
            AFX.setStatus(L('Saved') + ': library/' + res.file);
            ok(true);
            Cat.refresh();
        }).catch(() => { AFX.setStatus(L('Server save error')); ok(false); });
    } else {
        const existing = userItems.find(x => (x.data && x.data.doc && x.data.doc.id) === doc.id) ||
            userItems.find(x => x.name === doc.name);
        const item = existing || {};
        item.name = doc.name;
        item.data = file;
        item.id = doc.id;
        item.thumb = thumb;
        if (!existing) userItems.unshift(item);
        const written = saveLS();                 // не влезло — saveLS уже сказал об этом алертом
        if (!written && !existing) userItems = userItems.filter(x => x !== item); // строки быть не должно
        if (written) AFX.setStatus(L('Saved to localStorage'));
        ok(written);
        Cat.rebuild();
    }
};

Cat.importJsonFile = function (f) {
    const reader = new FileReader();
    reader.onload = function () {
        try {
            const file = JSON.parse(reader.result);
            AFX.Model.loadEffectFile(file, function (doc) {
                if (doc) AFX.openDoc(doc);
                else alert(L('Not an Arcaidia Effector file.'));
            });
        } catch (e) {
            alert(L('Failed to parse JSON.'));
        }
    };
    reader.readAsText(f);
};
})();
