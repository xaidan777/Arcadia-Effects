// Arcaidia Effector — минимальный ZIP-писатель (метод store, без сжатия).
// Нужен для экспорта PNG-секвенции одним файлом: PNG уже сжат, deflate ничего
// не дал бы, а store пишется в полсотни строк и не тянет зависимостей.
(function () {
'use strict';
const AFX = window.AFX;
const Z = AFX.Zip = {};

let TABLE = null;
function crcTable() {
    if (TABLE) return TABLE;
    TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        TABLE[n] = c >>> 0;
    }
    return TABLE;
}

Z.crc32 = function (buf) {
    const t = crcTable();
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
};

// дата/время в формате DOS; по умолчанию — фиксированная (архив воспроизводим)
function dosStamp(d) {
    if (!d) return { time: 0, date: (1 << 5) | 1 }; // 1980-01-01 00:00
    const y = Math.max(1980, d.getFullYear());
    return {
        time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31),
        date: (((y - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)
    };
}

// files: [{name, data: Uint8Array}]  ->  Blob (application/zip)
Z.blob = function (files, opts) {
    const enc = new TextEncoder();
    const stamp = dosStamp(opts && opts.date);
    const items = files.map(f => {
        const name = enc.encode(String(f.name));
        return { name: name, data: f.data, crc: Z.crc32(f.data) };
    });

    let total = 22; // EOCD
    items.forEach(it => { total += 30 + it.name.length + it.data.length + 46 + it.name.length; });

    const buf = new Uint8Array(total);
    const dv = new DataView(buf.buffer);
    let p = 0;
    const u16 = v => { dv.setUint16(p, v, true); p += 2; };
    const u32 = v => { dv.setUint32(p, v >>> 0, true); p += 4; };
    const bytes = b => { buf.set(b, p); p += b.length; };

    // локальные заголовки + данные
    items.forEach(it => {
        it.offset = p;
        u32(0x04034b50); u16(20); u16(0x0800); u16(0);            // sig, ver, flags (UTF-8), store
        u16(stamp.time); u16(stamp.date);
        u32(it.crc); u32(it.data.length); u32(it.data.length);
        u16(it.name.length); u16(0);
        bytes(it.name); bytes(it.data);
    });

    // центральный каталог
    const cdOffset = p;
    items.forEach(it => {
        u32(0x02014b50); u16(20); u16(20); u16(0x0800); u16(0);
        u16(stamp.time); u16(stamp.date);
        u32(it.crc); u32(it.data.length); u32(it.data.length);
        u16(it.name.length); u16(0); u16(0);                       // name, extra, comment
        u16(0); u16(0); u32(0);                                    // disk, int attrs, ext attrs
        u32(it.offset);
        bytes(it.name);
    });

    // конец каталога
    const cdSize = p - cdOffset;
    u32(0x06054b50); u16(0); u16(0);
    u16(items.length); u16(items.length);
    u32(cdSize); u32(cdOffset); u16(0);

    return new Blob([buf], { type: 'application/zip' });
};
})();
