// Arcaidia Effector — проверка локализации и подсказок при наведении (Node, без DOM).
//
//   node tools/i18ncheck.mjs           ошибки -> exit 1, предупреждения -> exit 0
//   node tools/i18ncheck.mjs --list    все подсказки: длина EN / RU и текст
//
// Правила (см. skills/afx-workspace-catalog-i18n/SKILL.md):
//  1. каждый литерал L('...') / AFX.t('...') в js/ есть в словаре RU или TIPS (js/core/i18n.js);
//  2. текст подсказки лежит в TIPS, а не в RU. Подсказкой считается литерал в «tip-контексте»:
//     значение ключа *tip: (tip:, acceptTip:, cancelTip:), ВТОРОЙ аргумент вызова *tip(
//     (D.tip(el, text, head) — шапка head не подсказка), присваивание *tip = / *TIP = ,
//     а также строки таблиц NAME_TIPS = {...};
//  3. каждая запись TIPS — от 30 до 120 символов И по-английски, И по-русски;
//  4. ключ не лежит одновременно в RU и в TIPS;
//  5. в строковых литералах js/ вне i18n.js нет кириллицы (исключение — 'Русский' в выборе языка).
// Предупреждения: записи TIPS, которых нет ни в одном tip-контексте, и записи RU,
// строки которых не встречаются в коде ни одним литералом (кандидаты на удаление).
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIP_MIN = 30, TIP_MAX = 120;
const LIST = process.argv.includes('--list');

// --- словари: i18n.js исполняется в песочнице с минимальным window ---
const sandbox = { window: { AFX: {} }, localStorage: { getItem: () => 'en', setItem() {} }, location: { reload() {} } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/core/i18n.js'), 'utf8'), sandbox);
const RU = sandbox.window.AFX._i18nDict || {};
const TIPS = sandbox.window.AFX._i18nTips || {};

// --- исходники без комментариев (строки не трогаем) ---
function stripComments(src) {
    let out = '', i = 0, q = null;
    while (i < src.length) {
        const c = src[i], n = src[i + 1];
        if (q) {
            out += c;
            if (c === '\\') { out += n || ''; i += 2; continue; }
            if (c === q) q = null;
            i++; continue;
        }
        if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && n === '*') {
            const end = src.indexOf('*/', i + 2);
            const chunk = src.slice(i, end < 0 ? src.length : end + 2);
            out += chunk.replace(/[^\n]/g, ' ');           // номера строк сохраняются
            i += chunk.length; continue;
        }
        if (c === "'" || c === '"' || c === '`') q = c;
        out += c; i++;
    }
    return out;
}

// конец выражения от позиции start: для '(' — до парной скобки, иначе до ',' / ';' на нулевой глубине
function exprEnd(src, start, untilParen) {
    let depth = 0, q = null;
    for (let i = start; i < src.length; i++) {
        const c = src[i];
        if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
        if (c === "'" || c === '"' || c === '`') { q = c; continue; }
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') { if (--depth < 0) return i; }
        else if (!untilParen && depth === 0 && (c === ',' || c === ';')) return i;
    }
    return src.length;
}
const unquote = lit => new Function('return ' + lit)();
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;
const len = s => [...s].length;

const files = [];
(function walk(dir) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
        const rel = dir + '/' + f;
        if (fs.statSync(path.join(ROOT, rel)).isDirectory()) walk(rel);
        else if (f.endsWith('.js') && rel !== 'js/core/i18n.js') files.push(rel);
    }
})('js');

const errors = [], warns = [];
const usedL = new Map();        // ключ -> первое место
const tipUse = new Map();       // текст подсказки -> первое место
const allLiterals = new Set();
const L_RE = /(?:\bL|\bAFX\.t)\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")\s*\)/g;
const STR_RE = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;

for (const rel of files) {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    let m;
    for (const s of src.match(STR_RE) || []) {
        let v = null;
        try { v = unquote(s); allLiterals.add(v); } catch (e) {}
        if (v && /[А-Яа-яЁё]/.test(v) && v !== 'Русский') errors.push(`${rel}:${lineOf(src, src.indexOf(s))}: Cyrillic in a code literal (use English + L()): ${s}`);
    }
    // длинные ключи, склеенные из кусков: 'часть 1 ' + 'часть 2'
    for (const s of src.match(/'(?:[^'\\\n]|\\.)*'(?:\s*\+\s*'(?:[^'\\\n]|\\.)*')+/g) || []) {
        try { allLiterals.add(unquote(s)); } catch (e) {}
    }
    while ((m = L_RE.exec(src))) {
        const key = unquote(m[1]);
        if (!usedL.has(key)) usedL.set(key, rel + ':' + lineOf(src, m.index));
    }
    const addTip = (text, idx) => { if (!tipUse.has(text)) tipUse.set(text, rel + ':' + lineOf(src, idx)); };
    // tip-контексты: *tip: / *tip( / *tip = (регистр не важен, tipHead: сюда не попадает)
    const CTX_RE = /\b\w*tip\s*(:|\(|=(?!=))/gi;
    while ((m = CTX_RE.exec(src))) {
        let from = m.index + m[0].length;
        let expr = src.slice(from, exprEnd(src, from, m[1] === '('));
        if (m[1] === '(') {
            // вызов: текст подсказки — второй аргумент (D.tip(el, text, head))
            const cut = [];
            for (let i = 0, e = 0; e < expr.length; i = e + 1) { e = exprEnd(expr, i, false); cut.push([i, e]); }
            const arg = cut.length > 1 ? cut[1] : cut[0];
            if (!arg) continue;
            from += arg[0];
            expr = expr.slice(arg[0], arg[1]);
        }
        const plain = /^\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")\s*$/.exec(expr);
        if (plain && m[1] === ':') addTip(unquote(plain[1]), from);   // данные: tip: '...'
        let k;
        const inner = new RegExp(L_RE.source, 'g');
        while ((k = inner.exec(expr))) addTip(unquote(k[1]), from + k.index);
    }
    // таблицы подсказок NAME_TIPS = { ключ: 'текст', ... }
    const TBL_RE = /\b\w+_TIPS\s*=\s*\{/g;
    while ((m = TBL_RE.exec(src))) {
        const from = m.index + m[0].length;
        const body = src.slice(from, exprEnd(src, from, true));
        for (const s of body.match(STR_RE) || []) addTip(unquote(s), from);
    }
}

// 1. литералы L() без перевода
for (const [key, at] of usedL) {
    if (!(key in RU) && !(key in TIPS)) errors.push(`${at}: no translation for L(${JSON.stringify(key)})`);
}
// 2. подсказка должна лежать в TIPS
for (const [text, at] of tipUse) {
    if (text in TIPS) continue;
    errors.push(`${at}: tooltip is not in TIPS: ${JSON.stringify(text)}` + (text in RU ? ' (it is in RU — move it to TIPS)' : ''));
}
// 3. длины и 4. дубли
for (const key of Object.keys(TIPS)) {
    const en = len(key), ru = len(TIPS[key] || '');
    if (en < TIP_MIN || en > TIP_MAX) errors.push(`TIPS EN ${en} chars (need ${TIP_MIN}..${TIP_MAX}): ${JSON.stringify(key)}`);
    if (ru < TIP_MIN || ru > TIP_MAX) errors.push(`TIPS RU ${ru} chars (need ${TIP_MIN}..${TIP_MAX}): ${JSON.stringify(TIPS[key])}`);
    if (key in RU) errors.push(`key is both in RU and TIPS: ${JSON.stringify(key)}`);
    if (!tipUse.has(key)) warns.push(`TIPS entry is not used as a tooltip: ${JSON.stringify(key)}`);
}
for (const key of Object.keys(RU)) {
    if (!allLiterals.has(key)) warns.push(`RU entry is not found in the code: ${JSON.stringify(key)}`);
}

if (LIST) {
    [...tipUse.keys()].sort().forEach(t => {
        console.log(String(len(t)).padStart(4), String(len(TIPS[t] || '')).padStart(4), ' ', t, '\n          ', TIPS[t] || '— NO RU —');
    });
    console.log('');
}
warns.forEach(w => console.log('warn  ' + w));
errors.forEach(e => console.log('ERROR ' + e));
console.log(`i18n: ${usedL.size} L() keys, ${tipUse.size} tooltips, RU ${Object.keys(RU).length}, TIPS ${Object.keys(TIPS).length}` +
    ` — ${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
