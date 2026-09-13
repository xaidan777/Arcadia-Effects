// Arcaidia Effector — DOM-хелперы: h(), SVG-иконки, контекст-меню, драг, поповеры
(function () {
'use strict';
const AFX = window.AFX;
const D = AFX.Dom = {};

D.h = function (tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
        for (const k in attrs) {
            const v = attrs[k];
            if (k === 'cls') el.className = v;
            else if (k === 'text') el.textContent = v;
            else if (k === 'html') el.innerHTML = v;
            else if (k === 'style') el.setAttribute('style', v);
            else if (k === 'tip') { if (v) el.setAttribute('data-tip', v); }           // подсказка (D.tip)
            else if (k === 'tipHead') { if (v) el.setAttribute('data-tip-head', v); }
            else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
            else if (v != null) el.setAttribute(k, v);
        }
    }
    for (let i = 2; i < arguments.length; i++) {
        const c = arguments[i];
        if (c == null) continue;
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
};

// --- SVG-иконки (без эмодзи) ---
const ICONS = {
    play: '<path d="M3 1.5 L13 8 L3 14.5 Z"/>',
    pause: '<rect x="3" y="2" width="3.4" height="12"/><rect x="9.6" y="2" width="3.4" height="12"/>',
    stop: '<rect x="3" y="3" width="10" height="10"/>',
    toStart: '<rect x="2" y="2" width="2.4" height="12"/><path d="M14 2 L6 8 L14 14 Z"/>',
    toEnd: '<rect x="11.6" y="2" width="2.4" height="12"/><path d="M2 2 L10 8 L2 14 Z"/>',
    stepBack: '<path d="M11 2 L4 8 L11 14 Z"/>',
    stepFwd: '<path d="M5 2 L12 8 L5 14 Z"/>',
    loop: '<path d="M3 7 A5 5 0 0 1 12.6 5.5 L11 6 L14.5 8 L14.6 3.6 L13.4 4.5 A6.2 6.2 0 0 0 1.8 7 Z"/><path d="M13 9 A5 5 0 0 1 3.4 10.5 L5 10 L1.5 8 L1.4 12.4 L2.6 11.5 A6.2 6.2 0 0 0 14.2 9 Z"/>',
    eye: '<path d="M8 3.5 C4.5 3.5 2 6.5 1.2 8 C2 9.5 4.5 12.5 8 12.5 C11.5 12.5 14 9.5 14.8 8 C14 6.5 11.5 3.5 8 3.5 Z M8 10.8 A2.8 2.8 0 1 1 8 5.2 A2.8 2.8 0 0 1 8 10.8 Z"/>',
    eyeOff: '<path d="M2 2 L14 14 L13 15 L1 3 Z M8 3.5 C11.5 3.5 14 6.5 14.8 8 C14.4 8.8 13.5 10 12.2 11 L10.8 9.6 A2.8 2.8 0 0 0 6.9 5.7 L5.6 4.4 C6.3 4 7.1 3.5 8 3.5 Z M3.8 5.6 L5.4 7.2 A2.8 2.8 0 0 0 8.8 10.6 L10 11.8 C9.4 12.2 8.7 12.5 8 12.5 C4.5 12.5 2 9.5 1.2 8 C1.6 7.2 2.5 6.4 3.8 5.6 Z"/>',
    clock: '<path d="M8 1.5 A6.5 6.5 0 1 0 8 14.5 A6.5 6.5 0 0 0 8 1.5 Z M8 13 A5 5 0 1 1 8 3 A5 5 0 0 1 8 13 Z M8.6 4.5 L7.4 4.5 L7.4 8.6 L10.6 10.4 L11.2 9.4 L8.6 7.9 Z"/>',
    key: '<rect x="4" y="4" width="8" height="8"/>',
    plus: '<rect x="7" y="2" width="2" height="12"/><rect x="2" y="7" width="12" height="2"/>',
    minus: '<rect x="2" y="7" width="12" height="2"/>',
    del: '<path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" stroke-width="2" fill="none"/>',
    dup: '<rect x="2" y="2" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="5.5" y="5.5" width="9" height="9"/>',
    up: '<path d="M8 3 L14 11 L2 11 Z"/>',
    down: '<path d="M8 13 L14 5 L2 5 Z"/>',
    graph: '<path d="M2 13 C5 13 5 4 8 4 C11 4 11 10 14 10" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="1" y="1" width="2.4" height="2.4"/><rect x="12.6" y="12.6" width="2.4" height="2.4"/>',
    grid: '<rect x="1.4" y="1.4" width="5.6" height="5.6"/><rect x="9" y="1.4" width="5.6" height="5.6"/><rect x="1.4" y="9" width="5.6" height="5.6"/><rect x="9" y="9" width="5.6" height="5.6"/>',
    dope: '<rect x="2" y="3" width="12" height="2"/><rect x="2" y="7" width="12" height="2"/><rect x="2" y="11" width="12" height="2"/>',
    solo: '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2"/>',
    help: '<path d="M8 0.9 A7.1 7.1 0 1 0 8 15.1 A7.1 7.1 0 0 0 8 0.9 Z M8 13.7 A5.7 5.7 0 1 1 8 2.3 A5.7 5.7 0 0 1 8 13.7 Z"/><path d="M6.1 6.2 A1.95 1.95 0 1 1 8 8.95 L8 10.1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="12" r="0.9"/>',
    gear: '<path d="M8 5 A3 3 0 1 0 8 11 A3 3 0 0 0 8 5 Z M8 9.4 A1.4 1.4 0 1 1 8 6.6 A1.4 1.4 0 0 1 8 9.4 Z"/><path d="M6.8 1.5 L9.2 1.5 L9.6 3.1 A5.2 5.2 0 0 1 10.9 3.85 L12.5 3.3 L13.7 5.4 L12.5 6.5 A5.2 5.2 0 0 1 12.5 8 L12.5 9.5 L13.7 10.6 L12.5 12.7 L10.9 12.15 A5.2 5.2 0 0 1 9.6 12.9 L9.2 14.5 L6.8 14.5 L6.4 12.9 A5.2 5.2 0 0 1 5.1 12.15 L3.5 12.7 L2.3 10.6 L3.5 9.5 A5.2 5.2 0 0 1 3.5 8 L3.5 6.5 L2.3 5.4 L3.5 3.3 L5.1 3.85 A5.2 5.2 0 0 1 6.4 3.1 Z M8 4 A4 4 0 1 0 8 12 A4 4 0 0 0 8 4 Z" fill-rule="evenodd"/>'
};
D.icon = function (name) {
    const span = document.createElement('span');
    span.style.display = 'inline-flex';
    span.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor">' + (ICONS[name] || '') + '</svg>';
    return span;
};

// --- ПОДСКАЗКИ ПРИ НАВЕДЕНИИ ---
// Один элемент подсказки на документ и делегированные слушатели: ребилды панелей
// ничего не ломают — владелец ищется от e.target вверх по дереву на каждом наведении.
// Текст — атрибут data-tip (h(tag, {tip}) или D.tip(el, text, head)); head — первая
// строка акцентом (полное имя параметра: узкий лейбл инспектора обрезается).
// Нативный title тоже подхватывается: при наведении он переезжает в data-tip, иначе
// поверх нашей всплыла бы ещё и системная. Пустой data-tip глушит подсказку предка.
// Тексты подсказок — английские через L() + словарь TIPS в i18n.js (30–120 символов).
const TIP_DELAY = 420;   // мс до первого показа
const TIP_WARM = 500;    // мс после скрытия, когда соседняя подсказка всплывает сразу
const TIP_HOLD_PX = 6;   // после нажатия / клавиши / колеса молчим, пока курсор не сдвинется на столько
let tipEl = null, tipOwner = null, tipTimer = 0, tipCheck = 0, tipWarmUntil = 0;
let tipMX = 0, tipMY = 0;
let tipHold = false, tipHoldX = 0, tipHoldY = 0;

D.tip = function (el, text, head) {
    if (!el) return el;
    el.removeAttribute('title');
    if (text) el.setAttribute('data-tip', text); else el.removeAttribute('data-tip');
    if (head) el.setAttribute('data-tip-head', head); else el.removeAttribute('data-tip-head');
    if (el === tipOwner && tipEl && tipEl.classList.contains('on')) renderTip(el);
    return el;
};

function findTipOwner(node) {
    for (let el = node; el && el.nodeType === 1; el = el.parentElement) {
        if (el.hasAttribute('title')) {
            const t = el.getAttribute('title');
            el.removeAttribute('title');
            if (t) el.setAttribute('data-tip', t);
        }
        if (el.hasAttribute('data-tip')) return el.getAttribute('data-tip') ? el : null;
    }
    return null;
}
function renderTip(owner) {
    if (!tipEl) {
        tipEl = D.h('div', { cls: 'afx-tip' });
        document.body.appendChild(tipEl);
    }
    tipEl.textContent = '';
    const head = owner.getAttribute('data-tip-head');
    if (head) tipEl.appendChild(D.h('b', { text: head }));
    tipEl.appendChild(document.createTextNode(owner.getAttribute('data-tip') || ''));
    // под курсором; не влезает снизу — над ним, по горизонтали прижимается к краю окна.
    // Мерить от (0,0): у fixed-блока ширина переноса зависит от прошлого left
    tipEl.style.left = '0px';
    tipEl.style.top = '0px';
    const r = tipEl.getBoundingClientRect();
    let x = tipMX + 12, y = tipMY + 18;
    if (x + r.width > window.innerWidth - 6) x = Math.max(6, window.innerWidth - 6 - r.width);
    if (y + r.height > window.innerHeight - 6) y = Math.max(6, tipMY - r.height - 10);
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
    tipEl.classList.add('on');
}
function showTip(owner) {
    tipTimer = 0;
    if (owner !== tipOwner || !owner.isConnected) return;
    renderTip(owner);
    // владелец мог уйти из DOM при ребилде панели — подсказка не должна висеть в воздухе
    clearInterval(tipCheck);
    tipCheck = setInterval(function () { if (!tipOwner || !tipOwner.isConnected) hideTip(true); }, 250);
}
function hideTip(forget) {
    clearTimeout(tipTimer); tipTimer = 0;
    clearInterval(tipCheck); tipCheck = 0;
    if (tipEl && tipEl.classList.contains('on')) {
        tipEl.classList.remove('on');
        tipWarmUntil = performance.now() + TIP_WARM;
    }
    if (forget) tipOwner = null;
}
// Нажатие, клавиша, колесо: прячем и «держим» подсказки, пока курсор не сдвинется.
// Иначе после драга бара или Ctrl+Z панель пересобирается, под НЕПОДВИЖНЫМ курсором
// оказывается новый элемент, браузер шлёт ему pointerover — и подсказка всплывает сама.
function holdTips() { hideTip(false); tipHold = true; tipHoldX = tipMX; tipHoldY = tipMY; }
function releaseHold(e) {
    if (tipHold && !e.buttons && Math.abs(e.clientX - tipHoldX) + Math.abs(e.clientY - tipHoldY) > TIP_HOLD_PX) tipHold = false;
}
document.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    tipMX = e.clientX; tipMY = e.clientY;
    releaseHold(e);
    const owner = findTipOwner(e.target);
    if (owner === tipOwner) return;
    hideTip(false);
    tipOwner = owner;
    if (!owner || e.buttons || tipHold) return;   // во время драга и сразу после нажатия — молчим
    tipTimer = setTimeout(function () { showTip(owner); }, performance.now() < tipWarmUntil ? 40 : TIP_DELAY);
}, true);
document.addEventListener('pointermove', function (e) { tipMX = e.clientX; tipMY = e.clientY; releaseHold(e); }, { capture: true, passive: true });
document.addEventListener('pointerup', function (e) { tipMX = e.clientX; tipMY = e.clientY; holdTips(); }, true);
document.addEventListener('pointerout', function (e) { if (!e.relatedTarget) hideTip(true); }, true);
document.addEventListener('pointerdown', holdTips, true);
document.addEventListener('keydown', holdTips, true);
document.addEventListener('wheel', holdTips, { capture: true, passive: true });
['dragstart', 'scroll'].forEach(function (ev) { document.addEventListener(ev, function () { hideTip(false); }, true); });
window.addEventListener('blur', function () { hideTip(true); });

// --- контекст-меню ---
let openMenu = null;
D.closeMenu = function () { if (openMenu) { openMenu.remove(); openMenu = null; } };
document.addEventListener('pointerdown', function (e) {
    if (openMenu && !openMenu.contains(e.target)) D.closeMenu();
}, true);

// items: [{label, mark, danger, sep, click}]
D.ctxMenu = function (x, y, items) {
    D.closeMenu();
    const m = D.h('div', { cls: 'ctx-menu' });
    items.forEach(it => {
        if (it.sep) { m.appendChild(D.h('div', { cls: 'ctx-sep' })); return; }
        const row = D.h('div', { cls: 'ctx-item' + (it.danger ? ' danger' : '') },
            D.h('span', { text: it.label }),
            it.mark ? D.h('span', { cls: 'mark', text: it.mark }) : null);
        row.addEventListener('pointerup', function (e) {
            e.stopPropagation();
            D.closeMenu();
            it.click && it.click();
        });
        m.appendChild(row);
    });
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, window.innerWidth - r.width - 6) + 'px';
    m.style.top = Math.min(y, window.innerHeight - r.height - 6) + 'px';
    openMenu = m;
    return m;
};

// --- поповер (закрывается кликом мимо) ---
let openPop = null;
D.closePopover = function () { if (openPop) { openPop.remove(); openPop = null; } };
document.addEventListener('pointerdown', function (e) {
    if (openPop && !openPop.contains(e.target)) D.closePopover();
}, true);
D.popover = function (x, y, contentEl) {
    D.closePopover();
    const p = D.h('div', { cls: 'popover' }, contentEl);
    document.body.appendChild(p);
    const r = p.getBoundingClientRect();
    p.style.left = Math.max(6, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
    p.style.top = Math.max(6, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
    openPop = p;
    return p;
};

// --- модальный диалог (overlay + бокс + кнопки принять/отмена) ---
// opts: {title, body, wide, acceptLabel, cancelLabel, acceptTip, cancelTip,
//        onAccept()->false отменяет закрытие, onCancel()}
let openModals = 0;
D.modalOpen = function () { return openModals > 0; };
D.modal = function (opts) {
    const box = D.h('div', { cls: 'modal-box' + (opts.wide ? ' wide' : '') });
    if (opts.title) box.appendChild(D.h('div', { cls: 'modal-title', text: opts.title }));
    if (opts.body) box.appendChild(opts.body);
    const bCancel = D.h('button', { cls: 'tb', text: opts.cancelLabel || AFX.t('Cancel'), tip: opts.cancelTip });
    const bAccept = D.h('button', { cls: 'tb accent', text: opts.acceptLabel || 'OK', tip: opts.acceptTip });
    box.appendChild(D.h('div', { cls: 'modal-btns' }, bCancel, bAccept));
    const ov = D.h('div', { cls: 'modal-overlay' }, box);

    let closed = false;
    const close = function () {
        if (closed) return;
        closed = true;
        openModals = Math.max(0, openModals - 1);
        window.removeEventListener('keydown', onKey, true);
        ov.remove();
    };
    const cancel = function () { if (closed) return; close(); opts.onCancel && opts.onCancel(); };
    const accept = function () {
        if (closed) return;
        if (opts.onAccept && opts.onAccept() === false) return; // валидация не пустила
        close();
    };
    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); accept(); }
    }
    bCancel.addEventListener('click', cancel);
    bAccept.addEventListener('click', accept);
    ov.addEventListener('pointerdown', function (e) { if (e.target === ov) cancel(); });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(ov);
    openModals++;
    return { el: ov, box: box, close: close, accept: accept, cancel: cancel, acceptBtn: bAccept, cancelBtn: bCancel };
};

// --- универсальный драг ---
// opts: {start(e), move(e, dx, dy), end(e, moved)}
D.drag = function (el, opts) {
    el.addEventListener('pointerdown', function (e) {
        if (opts.button != null && e.button !== opts.button) return;
        if (opts.button == null && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const sx = e.clientX, sy = e.clientY;
        let moved = false;
        if (opts.start && opts.start(e) === false) return;
        const onMove = function (ev) {
            const dx = ev.clientX - sx, dy = ev.clientY - sy;
            if (!moved && Math.abs(dx) + Math.abs(dy) > 2) moved = true;
            if (moved && opts.move) opts.move(ev, dx, dy);
        };
        const onUp = function (ev) {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            opts.end && opts.end(ev, moved);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    });
};

// --- сплиттеры панелей (пишут в CSS-переменные) ---
D.initSplitters = function () {
    const root = document.documentElement;
    const cfg = {
        lw: { var: '--lw', min: 220, max: 480, dir: 1, axis: 'x' },
        rw: { var: '--rw', min: 240, max: 520, dir: -1, axis: 'x' },
        tl: { var: '--tlh', min: 140, max: 460, dir: -1, axis: 'y' },
        ap: { var: '--apw', min: 150, max: 900, dir: -1, axis: 'x' },
        left: { var: '--left-top', min: 20, max: 80, axis: 'pct', panel: 'left-col' },
        right: { var: '--right-top', min: 15, max: 80, axis: 'pct', panel: 'right-col' }
    };
    document.querySelectorAll('.v-split, .h-split').forEach(sp => {
        const c = cfg[sp.dataset.split];
        if (!c) return;
        let startVal = 0, colRect = null;
        D.drag(sp, {
            start: function () {
                sp.classList.add('active');
                const cur = getComputedStyle(root).getPropertyValue(c.var).trim();
                startVal = parseFloat(cur) || 0;
                if (c.axis === 'pct') colRect = document.getElementById(c.panel).getBoundingClientRect();
            },
            move: function (e, dx, dy) {
                if (c.axis === 'x') {
                    root.style.setProperty(c.var, AFX.clamp(startVal + dx * c.dir, c.min, c.max) + 'px');
                } else if (c.axis === 'y') {
                    root.style.setProperty(c.var, AFX.clamp(startVal + dy * c.dir, c.min, c.max) + 'px');
                } else {
                    const pct = startVal + dy / colRect.height * 100;
                    root.style.setProperty(c.var, AFX.clamp(pct, c.min, c.max) + '%');
                }
                AFX.emit('resize');
            },
            end: function () { sp.classList.remove('active'); AFX.emit('resize'); }
        });
    });
};
})();
