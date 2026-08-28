// Arcaidia Effector — хэш состояния симуляции: регрессия «старые файлы попиксельно те же».
// Прогоняет каждый эмиттер файла по сетке времени и печатает хэш всех полей частиц.
// Ноль зависимостей, тот же bootstrap, что у validate.mjs.
//
//   node tools/simhash.mjs                     (все library/*.json)
//   node tools/simhash.mjs library/flame.json  > before.txt
//
// Порядок применения: снять базу до правки ядра, повторить после, сравнить diff.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = globalThis;
for (const f of ['utils', 'track', 'curve', 'path', 'sprites', 'model', 'sim']) {
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', 'core', f + '.js'), 'utf8'),
        { filename: 'js/core/' + f + '.js' });
}
const AFX = globalThis.AFX;

// FNV-1a по байтам float64: ловит расхождение в последнем бите мантиссы
const buf = new ArrayBuffer(8);
const f64 = new Float64Array(buf), u32 = new Uint32Array(buf);
function mix(h, v) {
    f64[0] = typeof v === 'number' ? v : NaN;
    for (let i = 0; i < 2; i++) {
        let x = u32[i];
        for (let b = 0; b < 4; b++) { h = ((h ^ (x & 255)) >>> 0); h = Math.imul(h, 16777619) >>> 0; x >>>= 8; }
    }
    return h;
}

const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : fs.readdirSync(path.join(ROOT, 'library')).filter(f => f.endsWith('.json')).map(f => 'library/' + f);

const STEPS = 24; // узлов времени на слой
for (const rel of files) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(ROOT, rel), 'utf8'));
    const doc = AFX.Model.migrate(raw.doc || raw);
    const out = [];
    doc.layers.forEach((l, li) => {
        if (l.type !== 'emitter') return;
        const sim = new AFX.Sim(l);
        const dur = Math.max(0.05, (l.end - l.start) + (l.pt.life || 1) * 1.6);
        let h = 2166136261;
        let total = 0;
        for (let s = 1; s <= STEPS; s++) {
            sim.ensure(l, dur * s / STEPS);
            h = mix(h, sim.parts.length);
            total += sim.parts.length;
            for (const p of sim.parts) {
                h = mix(h, p.x); h = mix(h, p.y); h = mix(h, p.vx); h = mix(h, p.vy);
                h = mix(h, p.age); h = mix(h, p.life); h = mix(h, p.size0);
                h = mix(h, p.rot); h = mix(h, p.tier); h = mix(h, p.gen); h = mix(h, p.vi);
            }
        }
        out.push(`  L${li} "${l.name}" n=${total} ${('00000000' + h.toString(16)).slice(-8)}`);
    });
    console.log(rel);
    out.forEach(s => console.log(s));
}
