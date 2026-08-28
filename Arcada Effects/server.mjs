// Arcaidia Effector — статика + файловая библиотека эффектов (library/*.json)
// Ноль зависимостей. Запуск: node server.mjs  (порт 5179)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.join(ROOT, 'library');
const PORT = 5179;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

if (!fs.existsSync(LIB)) fs.mkdirSync(LIB, { recursive: true });

const safeName = n => String(n || 'effect').trim().replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'effect';

function json(res, code, obj) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', c => {
            data += c;
            if (data.length > 80 * 1024 * 1024) { reject(new Error('too big')); req.destroy(); }
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

// файл в library/ строго по имени, без выхода из папки
function libPath(file) {
    const base = path.basename(String(file || ''));
    if (!/\.json$/i.test(base)) return null;
    return path.join(LIB, base);
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);

    try {
        if (p === '/api/list') {
            const items = fs.readdirSync(LIB).filter(f => /\.json$/i.test(f)).map(f => {
                let name = f.replace(/\.json$/i, ''), thumb = null, id = null;
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(LIB, f), 'utf8'));
                    if (data.doc && data.doc.name) name = data.doc.name;
                    if (data.doc && data.doc.id) id = data.doc.id;
                    if (data.thumb) thumb = data.thumb;
                } catch (e) {}
                return { file: f, name, id, thumb, mtime: fs.statSync(path.join(LIB, f)).mtimeMs };
            }).sort((a, b) => b.mtime - a.mtime);
            return json(res, 200, items);
        }
        if (p === '/api/effect') {
            const fp = libPath(url.searchParams.get('f'));
            if (!fp || !fs.existsSync(fp)) return json(res, 404, { error: 'not found' });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(fs.readFileSync(fp));
        }
        if (p === '/api/save' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req));
            const file = safeName(body.name) + '.json';
            const payload = body.data || {};
            if (body.thumb) payload.thumb = body.thumb;
            fs.writeFileSync(path.join(LIB, file), JSON.stringify(payload));
            return json(res, 200, { ok: true, file });
        }
        // dev-инструмент: сохранить кадр/контактный лист из браузера на диск.
        // Нужен для «пиксельной проверки без экрана» — вкладка рендерит эффект
        // в оффскрин-канву и кладёт PNG в .snap/, дальше его смотрят снаружи.
        if (p === '/api/snap' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req));
            const m = /^data:image\/(png|jpeg);base64,/.exec(String(body.data || ''));
            if (!m) return json(res, 400, { error: 'expected png/jpeg dataURL' });
            const dir = path.join(ROOT, '.snap');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            const file = safeName(body.name || 'snap').replace(/\.(png|jpe?g)$/i, '')
                + (m[1] === 'png' ? '.png' : '.jpg');
            const fp = path.join(dir, file);
            fs.writeFileSync(fp, Buffer.from(body.data.slice(m[0].length), 'base64'));
            return json(res, 200, { ok: true, file: fp, bytes: fs.statSync(fp).size });
        }
        if (p === '/api/delete' && req.method === 'POST') {
            const body = JSON.parse(await readBody(req));
            const fp = libPath(body.file);
            if (fp && fs.existsSync(fp)) fs.unlinkSync(fp);
            return json(res, 200, { ok: true });
        }

        // статика
        let rel = p === '/' ? '/index.html' : p;
        const fp = path.join(ROOT, rel);
        if (!fp.startsWith(ROOT)) return json(res, 403, { error: 'forbidden' });
        if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) return json(res, 404, { error: 'not found' });
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store' // dev-инструмент: правки кода видны по обычному F5
        });
        fs.createReadStream(fp).pipe(res);
    } catch (e) {
        json(res, 500, { error: String(e && e.message || e) });
    }
});

server.listen(PORT, () => {
    console.log('Arcaidia Effector: http://localhost:' + PORT + '/');
    console.log('Effects library: ' + LIB);
});
