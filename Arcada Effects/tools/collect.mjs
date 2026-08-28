// Arcaidia Effector — «Collect Files»: выгружает текстуры эффектов из library/*.json
// в отдельные файлы library/textures/ и пишет манифест textures/index.json.
// Ноль зависимостей, чистое чтение JSON (js/core не поднимается).
//
//   node tools/collect.mjs                 все library/*.json
//   node tools/collect.mjs library/X.json  только указанные файлы
//   node tools/collect.mjs --prune         удалить осиротевшие файлы в textures/
//
// Файлы эффектов САМОДОСТАТОЧНЫ: пейлоад текстуры лежит в самом JSON (ключ "tex"),
// редактор берёт картинку оттуда. Выгрузка — это КОПИЯ исходников для передачи
// проекта и для работы с картинками вне редактора; JSON не переписывается.
//
// Exit code: 0 — коллект целый (warnings допустимы), 1 — есть ошибки
// (например, слой ссылается на текстуру, пейлоада которой в файле нет).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'library');
const OUT = path.join(LIB, 'textures');
const MANIFEST = 'index.json';

const EXT = {
    'image/png': '.png', 'image/webp': '.webp', 'image/jpeg': '.jpg',
    'image/jpg': '.jpg', 'image/gif': '.gif', 'image/svg+xml': '.svg',
    'image/bmp': '.bmp', 'image/avif': '.avif'
};

const safeFile = n => String(n || 'texture').trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 60) || 'texture';
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

// data:image/png;base64,XXXX -> {mime, buf}
function decodeDataUrl(s) {
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(String(s || ''));
    if (!m) return null;
    return { mime: m[1].toLowerCase(), buf: Buffer.from(m[2], 'base64') };
}

// все texId, на которые реально ссылаются слои (sprite: {kind:'tex', texId})
function collectRefs(node, out) {
    if (!node || typeof node !== 'object') return out;
    if (Array.isArray(node)) { node.forEach(v => collectRefs(v, out)); return out; }
    if (node.kind === 'tex' && node.texId) out.add(node.texId);
    for (const k in node) collectRefs(node[k], out);
    return out;
}

// ---------- CLI ----------
const args = process.argv.slice(2);
const prune = args.includes('--prune');
let files = args.filter(a => a.charAt(0) !== '-');
if (!files.length) {
    files = fs.existsSync(LIB)
        ? fs.readdirSync(LIB).filter(f => /\.json$/i.test(f)).sort().map(f => path.join(LIB, f))
        : [];
}
if (!files.length) { console.log('library/: нет файлов эффектов'); process.exit(0); }

// ---------- сбор ----------
const errors = [], warns = [];
const byId = new Map();   // texId -> запись манифеста
const takenNames = new Map(); // имя файла -> texId (детект коллизий имён)

for (const fp of files) {
    let file;
    try { file = JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch (e) { errors.push(`${rel(fp)}: не читается (${e.message})`); continue; }
    const doc = file.doc;
    if (!doc) { warns.push(`${rel(fp)}: нет doc — пропущен`); continue; }

    const used = collectRefs(doc.layers, new Set());
    const metas = doc.textures || [];
    const metaIds = new Set(metas.map(t => t.id));
    // ссылка на текстуру без меты/пейлоада = эффект приедет битым
    used.forEach(id => {
        if (!metaIds.has(id)) errors.push(`${rel(fp)}: слой ссылается на текстуру ${id}, которой нет в doc.textures`);
        else if (!(file.tex && file.tex[id])) errors.push(`${rel(fp)}: нет пейлоада текстуры ${id} (${(metas.find(t => t.id === id) || {}).name || '?'})`);
    });

    for (const meta of metas) {
        const payload = file.tex && file.tex[meta.id];
        const prev = byId.get(meta.id);
        if (prev) { // одна текстура в нескольких эффектах — выгружаем один раз
            if (!prev.usedBy.includes(path.basename(fp))) prev.usedBy.push(path.basename(fp));
            if (used.has(meta.id)) prev.referenced = true;
            continue;
        }
        if (!payload) {
            if (!used.has(meta.id)) warns.push(`${rel(fp)}: текстура ${meta.name || meta.id} без пейлоада (в слоях не используется)`);
            continue;
        }
        const dec = decodeDataUrl(payload);
        if (!dec) { errors.push(`${rel(fp)}: пейлоад текстуры ${meta.name || meta.id} не data-URL`); continue; }
        const ext = EXT[dec.mime] || '.bin';
        if (!EXT[dec.mime]) warns.push(`${rel(fp)}: неизвестный тип ${dec.mime} у ${meta.name || meta.id}`);

        let base = safeFile(meta.name || meta.id);
        if (takenNames.has(base + ext) && takenNames.get(base + ext) !== meta.id) {
            base += '__' + meta.id.slice(-4); // разные текстуры с одинаковым именем
        }
        const name = base + ext;
        takenNames.set(name, meta.id);
        byId.set(meta.id, {
            file: name, id: meta.id, name: meta.name || '', mime: dec.mime,
            bytes: dec.buf.length, sheet: meta.sheet || null,
            referenced: used.has(meta.id), usedBy: [path.basename(fp)],
            _buf: dec.buf
        });
    }
}

// ---------- запись ----------
const recs = [...byId.values()].sort((a, b) => a.file.localeCompare(b.file));
if (recs.length && !fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

let written = 0, same = 0;
for (const r of recs) {
    const fp = path.join(OUT, r.file);
    const old = fs.existsSync(fp) ? fs.readFileSync(fp) : null;
    if (old && old.equals(r._buf)) { same++; r.status = 'unchanged'; }
    else { fs.writeFileSync(fp, r._buf); written++; r.status = old ? 'updated' : 'written'; }
}

// осиротевшие файлы: лежат в textures/, но ни один эффект их не даёт
const keep = new Set(recs.map(r => r.file).concat([MANIFEST, 'README.md']));
const stale = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter(f => !keep.has(f)) : [];
if (prune) stale.forEach(f => fs.unlinkSync(path.join(OUT, f)));

if (recs.length) {
    const manifest = {
        app: 'arcadia-effects',
        kind: 'texture-collect',
        note: 'Extracted copies of the textures embedded in library/*.json. The effect files stay self-contained.',
        textures: recs.map(r => ({
            file: r.file, id: r.id, name: r.name, mime: r.mime, bytes: r.bytes,
            sheet: r.sheet, referenced: r.referenced, usedBy: r.usedBy.slice().sort()
        }))
    };
    fs.writeFileSync(path.join(OUT, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
}

// ---------- отчёт ----------
console.log(`\n${rel(OUT)}/ — ${recs.length} texture(s): ${written} written, ${same} unchanged`);
for (const r of recs) {
    const sheet = r.sheet ? `sheet ${r.sheet.cols}x${r.sheet.rows}@${r.sheet.fps}fps` : 'single';
    console.log(`  ${r.file.padEnd(28)} ${String(Math.round(r.bytes / 1024) + ' KB').padStart(8)}  ${sheet.padEnd(24)} ${r.usedBy.join(', ')}${r.referenced ? '' : '  [not used by layers]'}`);
}
stale.forEach(f => console.log(prune ? `  [pruned] ${f}` : `  [stale]  ${f} — ни один эффект его не даёт (удалить: --prune)`));
warns.forEach(m => console.log('  [warn]  ' + m));
errors.forEach(m => console.log('  [error] ' + m));
console.log(`\n${files.length} effect file(s), ${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
