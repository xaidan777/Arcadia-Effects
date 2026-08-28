// Arcaidia Effector — сборка спрайт-атласа из футажа эффекта
// Кадры сэмплируются в центрах интервалов: t = t0 + (i + 0.5) * step.
(function () {
'use strict';
const AFX = window.AFX;
const Atlas = AFX.Atlas = {};

// центры интервалов: t = t0 + (i + 0.5) * step (общее правило для атласа и секвенции)
Atlas.centers = function (t0, t1, frames) {
    const stepT = Math.max(0, t1 - t0) / frames;
    const times = [];
    for (let i = 0; i < frames; i++) times.push(t0 + (i + 0.5) * stepT);
    return { times: times, t0: t0, t1: t1, frames: frames, fps: stepT > 0 ? 1 / stepT : 0 };
};

Atlas.frameTimes = function (doc) {
    const e = doc.exp;
    const t0 = Math.max(0, e.t0 || 0);
    const t1 = (e.t1 == null || e.t1 < 0) ? doc.comp.dur : Math.min(doc.comp.dur, e.t1);
    const frames = Math.max(1, Math.min(e.frames | 0 || 1, (e.cols | 0) * (e.rows | 0)));
    return Atlas.centers(t0, t1, frames);
};

// построить атлас; возвращает {canvas, info}
Atlas.build = function (doc) {
    const e = doc.exp;
    const cols = Math.max(1, e.cols | 0), rows = Math.max(1, e.rows | 0);
    const cw = Math.max(8, e.cellW | 0), chh = Math.max(8, e.cellH | 0);
    const ss = e.ss === 2 ? 2 : 1;
    const ft = Atlas.frameTimes(doc);

    const eng = new AFX.Engine();
    const comp = document.createElement('canvas');
    comp.width = doc.comp.w; comp.height = doc.comp.h;
    const compCtx = comp.getContext('2d');

    // рендер ячейки с суперсэмплингом
    const cell = document.createElement('canvas');
    cell.width = cw * ss; cell.height = chh * ss;
    const cellCtx = cell.getContext('2d', { willReadFrequently: true });

    const atlas = document.createElement('canvas');
    atlas.width = cols * cw; atlas.height = rows * chh;
    const ctx = atlas.getContext('2d');
    ctx.clearRect(0, 0, atlas.width, atlas.height);

    if (e.mode === 'black' || e.mode === 'mask') {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, atlas.width, atlas.height);
    }

    const fitK = Math.min(cell.width / comp.width, cell.height / comp.height);
    for (let i = 0; i < ft.times.length; i++) {
        eng.render(doc, ft.times[i], compCtx);
        cellCtx.clearRect(0, 0, cell.width, cell.height);
        if (e.mode === 'black') {
            cellCtx.fillStyle = '#000';
            cellCtx.fillRect(0, 0, cell.width, cell.height);
        }
        cellCtx.imageSmoothingQuality = 'high';
        cellCtx.drawImage(comp, (cell.width - comp.width * fitK) / 2, (cell.height - comp.height * fitK) / 2,
            comp.width * fitK, comp.height * fitK);
        if (e.mode === 'mask') maskify(cellCtx, cell.width, cell.height, e.thr || 0);
        const cxI = (i % cols) * cw, cyI = Math.floor(i / cols) * chh;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(cell, cxI, cyI, cw, chh);
    }

    return {
        canvas: atlas,
        info: {
            frameWidth: cw, frameHeight: chh,
            cols: cols, rows: rows,
            frames: ft.frames, fps: Math.round(ft.fps * 100) / 100,
            duration: Math.round((ft.t1 - ft.t0) * 1000) / 1000,
            mode: e.mode
        }
    };
};

// альфа -> белое на чёрном; thr>0 — бинаризация
function maskify(ctx, w, h, thr) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const cut = Math.round(AFX.clamp(thr, 0, 1) * 255);
    for (let i = 0; i < d.length; i += 4) {
        let a = d[i + 3];
        if (cut > 0) a = a >= cut ? 255 : 0;
        d[i] = a; d[i + 1] = a; d[i + 2] = a; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
}

Atlas.downloadPNG = function (doc, canvas) {
    const name = AFX.safeFileName(doc.name) + '_' + canvas.width + 'x' + canvas.height + '.png';
    canvas.toBlob(function (blob) {
        if (blob) AFX.downloadBlob(name, blob);
    }, 'image/png');
};

// ---------- PNG-секвенция ----------
// Кадры отдельными файлами, сэмплинг ТОТ ЖЕ, что у атласа (центры интервалов):
// при равных настройках кадр N секвенции попиксельно совпадает с ячейкой N атласа.
// Рендер асинхронный — по кадру за тик, чтобы длинный экспорт не морозил UI и
// его можно было отменить. o: {t0,t1,frames,w,h,mode,thr,ss,prefix}
// cb: {progress(done, total), done(files, info), error(e)}; возвращает {cancel()}.
Atlas.buildSequence = function (doc, o, cb) {
    const frames = Math.max(1, Math.min(o.frames | 0 || 1, 4096));
    const w = Math.max(8, o.w | 0), hh = Math.max(8, o.h | 0);
    const ss = o.ss === 2 ? 2 : 1;
    const mode = o.mode || 'rgba';
    const dur = doc.comp.dur;
    const t0 = AFX.clamp(o.t0 || 0, 0, dur);
    const t1 = AFX.clamp((o.t1 == null || o.t1 < 0) ? dur : o.t1, t0, dur);
    const ft = Atlas.centers(t0, t1, frames);
    const prefix = AFX.safeFileName(o.prefix || doc.name);
    const pad = Math.max(4, String(frames - 1).length);

    const eng = new AFX.Engine();
    const comp = document.createElement('canvas');
    comp.width = doc.comp.w; comp.height = doc.comp.h;
    const compCtx = comp.getContext('2d');

    const cell = document.createElement('canvas');
    cell.width = w * ss; cell.height = hh * ss;
    const cellCtx = cell.getContext('2d', { willReadFrequently: true });

    // при ss=1 лишней копии нет — cell и есть кадр
    const out = ss === 1 ? cell : document.createElement('canvas');
    const outCtx = ss === 1 ? cellCtx : (function () { out.width = w; out.height = hh; return out.getContext('2d'); })();

    const fitK = Math.min(cell.width / comp.width, cell.height / comp.height);
    const files = [];
    let i = 0, cancelled = false;

    const drawFrame = function (t) {
        eng.render(doc, t, compCtx);
        cellCtx.clearRect(0, 0, cell.width, cell.height);
        if (mode === 'black') { cellCtx.fillStyle = '#000'; cellCtx.fillRect(0, 0, cell.width, cell.height); }
        cellCtx.imageSmoothingQuality = 'high';
        cellCtx.drawImage(comp, (cell.width - comp.width * fitK) / 2, (cell.height - comp.height * fitK) / 2,
            comp.width * fitK, comp.height * fitK);
        if (mode === 'mask') maskify(cellCtx, cell.width, cell.height, o.thr || 0);
        if (out !== cell) {
            outCtx.clearRect(0, 0, w, hh);
            if (mode === 'black' || mode === 'mask') { outCtx.fillStyle = '#000'; outCtx.fillRect(0, 0, w, hh); }
            outCtx.imageSmoothingQuality = 'high';
            outCtx.drawImage(cell, 0, 0, w, hh);
        }
    };

    const step = function () {
        if (cancelled) return;
        try { drawFrame(ft.times[i]); }
        catch (e) { cb.error && cb.error(e); return; }
        const name = prefix + '_' + String(i).padStart(pad, '0') + '.png';
        out.toBlob(function (blob) {
            if (cancelled) return;
            if (!blob) { cb.error && cb.error(new Error('toBlob failed')); return; }
            blob.arrayBuffer().then(function (ab) {
                if (cancelled) return;
                files.push({ name: name, data: new Uint8Array(ab) });
                i++;
                cb.progress && cb.progress(i, frames);
                if (i >= frames) {
                    cb.done && cb.done(files, {
                        frameWidth: w, frameHeight: hh, frames: frames,
                        fps: Math.round(ft.fps * 100) / 100,
                        duration: Math.round((ft.t1 - ft.t0) * 1000) / 1000,
                        mode: mode, prefix: prefix, pad: pad
                    });
                } else setTimeout(step, 0);
            }, function (e) { cb.error && cb.error(e); });
        }, 'image/png');
    };
    setTimeout(step, 0);
    return { cancel: function () { cancelled = true; } };
};

// мета секвенции (кладётся в архив рядом с кадрами)
Atlas.seqMetaJSON = function (doc, info, pad) {
    return JSON.stringify({
        name: doc.name,
        pattern: info.prefix + '_%0' + (pad || 4) + 'd.png',
        frameWidth: info.frameWidth, frameHeight: info.frameHeight,
        frames: info.frames, fps: info.fps, duration: info.duration,
        mode: info.mode, compression: doc.cam.comp
    }, null, 2);
};

Atlas.metaJSON = function (doc, info) {
    return JSON.stringify({
        name: doc.name,
        frameWidth: info.frameWidth, frameHeight: info.frameHeight,
        cols: info.cols, rows: info.rows, frames: info.frames,
        fps: info.fps, duration: info.duration,
        compression: doc.cam.comp
    }, null, 2);
};
})();
