// Arcaidia Effector — визуальная проверка эффекта БЕЗ экрана.
// Вкладка рендерит эффект в оффскрин-канву и кладёт PNG/JPEG в .snap/ через
// POST /api/snap — дальше картинку смотрят снаружи любым просмотрщиком.
// Нужно, когда панель браузера не композитит кадры (скриншот недоступен), и для
// покадрового сравнения итераций: детерминизм гарантирует, что одинаковый JSON
// даёт одинаковые пиксели, поэтому снимки итераций сравнимы напрямую.
//
// Подключение (в консоли вкладки редактора):
//   await import('/tools/devsnap.js')
// Дальше:
//   AFXDev.reload('Flame Pro.json')          подтянуть файл эффекта поверх сессии
//   AFXDev.sheet('name')                     контактный лист окна атласа
//   AFXDev.frames('name', [2.8, 3.05], 1.4)  крупные стоп-кадры в ряд
//   AFXDev.variants('name', 3.05, [[label, applyFn], ...])   перебор параметров
(function () {
'use strict';
const AFX = window.AFX;
const D = window.AFXDev = {};

function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function bg(ctx, w, h) { ctx.fillStyle = '#0c0c10'; ctx.fillRect(0, 0, w, h); }

// Каждый снимок — СВОЙ Engine: превью-движок гоняет своё время, шарить нельзя.
function renderTo(ctx, doc, t) {
    const cell = cnv(doc.comp.w, doc.comp.h);
    new AFX.Engine().render(doc, t, cell.getContext('2d'));
    return cell;
}

D.save = async function (name, canvas, png) {
    const res = await fetch('/api/snap', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, data: canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9) })
    });
    return await res.json();
};

// подтянуть эффект из library поверх рабочей сессии (правки файла видны без F5)
D.reload = function (file) {
    return fetch('/api/effect?f=' + encodeURIComponent(file))
        .then(r => r.json())
        .then(f => new Promise(ok => AFX.Model.loadEffectFile(f, d => {
            AFX.state.doc = d; AFX.touchAll(); ok(d.id + ' / ' + d.layers.length + ' layers');
        })));
};

// контактный лист окна атласа: вся анимация одним экраном
D.sheet = async function (name, o) {
    o = o || {};
    const doc = AFX.state.doc;
    const cols = o.cols || doc.exp.cols, rows = o.rows || doc.exp.rows;
    const n = o.n || Math.min(doc.exp.frames, cols * rows);
    const t0 = o.t0 != null ? o.t0 : doc.exp.t0;
    const t1 = o.t1 != null ? o.t1 : (doc.exp.t1 < 0 ? doc.comp.dur : doc.exp.t1);
    const cw = o.cw || doc.exp.cellW, ch = o.ch || doc.exp.cellH;
    const c = cnv(cols * cw, rows * ch), ctx = c.getContext('2d');
    bg(ctx, c.width, c.height);
    const eng = new AFX.Engine();
    const cell = cnv(doc.comp.w, doc.comp.h), cc = cell.getContext('2d');
    const step = (t1 - t0) / n;
    const T = performance.now();
    for (let i = 0; i < n; i++) {
        cc.clearRect(0, 0, cell.width, cell.height);
        eng.render(doc, t0 + (i + 0.5) * step, cc);   // сэмплинг по ЦЕНТРАМ, как в atlas.js
        const k = Math.min(cw / cell.width, ch / cell.height);
        ctx.drawImage(cell, (i % cols) * cw + (cw - cell.width * k) / 2,
            ((i / cols) | 0) * ch + (ch - cell.height * k) / 2, cell.width * k, cell.height * k);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect((i % cols) * cw + 0.5, ((i / cols) | 0) * ch + 0.5, cw - 1, ch - 1);
    }
    const r = await D.save(name, c, o.png);
    r.ms = Math.round(performance.now() - T);
    return r;
};

// крупные стоп-кадры в ряд — для разбора силуэта и артефактов
D.frames = async function (name, times, scale, png) {
    const doc = AFX.state.doc, k = scale || 1;
    const c = cnv(doc.comp.w * k * times.length, doc.comp.h * k), ctx = c.getContext('2d');
    bg(ctx, c.width, c.height);
    const T = performance.now();
    times.forEach(function (t, i) {
        ctx.drawImage(renderTo(ctx, doc, t), i * doc.comp.w * k, 0, doc.comp.w * k, doc.comp.h * k);
    });
    const r = await D.save(name, c, png);
    r.ms = Math.round(performance.now() - T);
    return r;
};

// перебор параметров одним кадром: variants('x', 3.05, [['label', () => {...}], ...])
// Функция варианта мутирует док; после прогона состояние дока НЕ восстанавливается —
// перечитать файл через D.reload.
D.variants = async function (name, t, list, scale, png) {
    const doc = AFX.state.doc, k = scale || 1.5;
    const c = cnv(doc.comp.w * k * list.length, doc.comp.h * k), ctx = c.getContext('2d');
    bg(ctx, c.width, c.height);
    list.forEach(function (v, i) {
        v[1](); AFX.touchAll();
        ctx.drawImage(renderTo(ctx, doc, t), i * doc.comp.w * k, 0, doc.comp.w * k, doc.comp.h * k);
        ctx.fillStyle = '#9ab'; ctx.font = '18px sans-serif';
        ctx.fillText(v[0], i * doc.comp.w * k + 10, 26);
    });
    return await D.save(name, c, png);
};
console.log('AFXDev ready: reload / sheet / frames / variants');
})();
