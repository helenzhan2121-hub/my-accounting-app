/* xlsx-export.js —— 零依赖手写 .xlsx（ZIP store 模式 + OOXML）
 * 仅支持：二维数组/对象数组 -> 单 sheet 工作簿。
 * 不依赖任何第三方库。导出文件名由调用方决定。
 */
(function (global) {
  'use strict';

  // ---------- CRC32 (用于 ZIP) ----------
  const crcTable = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ---------- UTF-8 编码 ----------
  function strToU8(s) {
    return new TextEncoder().encode(s);
  }

  // ---------- ZIP (store, no compression) ----------
  function zipStore(files) {
    const chunks = [];
    const central = [];
    let offset = 0;
    const u16 = (n) => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]);
    const u32 = (n) => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]);

    for (const f of files) {
      const nameBytes = strToU8(f.name);
      const data = f.data;
      const crc = crc32(data);
      const lh = concat([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0), nameBytes, data
      ]);
      chunks.push(lh);
      const cd = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length),
        u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
        nameBytes
      ]);
      central.push({ cd, offset });
      offset += lh.length;
    }

    const cdStart = offset;
    let cdSize = 0;
    for (const c of central) { chunks.push(c.cd); cdSize += c.cd.length; offset += c.cd.length; }

    const eo = concat([
      u32(0x06054b50), u16(0), u16(0),
      u16(central.length), u16(central.length),
      u32(cdSize), u32(cdStart), u16(0)
    ]);
    chunks.push(eo);
    return concat(chunks);
  }
  function concat(arrs) {
    let len = 0; for (const a of arrs) len += a.length;
    const out = new Uint8Array(len);
    let p = 0; for (const a of arrs) { out.set(a, p); p += a.length; }
    return out;
  }

  // ---------- OOXML 部件 ----------
  function escapeXml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function colLetter(idx) {
    let s = '';
    idx += 1;
    while (idx > 0) { const m = (idx - 1) % 26; s = String.fromCharCode(65 + m) + s; idx = Math.floor((idx - 1) / 26); }
    return s;
  }
  function cellXml(r, c, value) {
    const ref = colLetter(c) + (r + 1);
    if (typeof value === 'number' && isFinite(value)) {
      return `<c r="${ref}"><v>${value}</v></c>`;
    }
    const t = String(value == null ? '' : value);
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(t)}</t></is></c>`;
  }
  function sheetXml(rows) {
    let body = '';
    rows.forEach((row, r) => {
      let cells = '';
      row.forEach((v, c) => { cells += cellXml(r, c, v); });
      body += `<row r="${r + 1}">${cells}</row>`;
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  }
  function workbookXml(sheetName) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  }
  function workbookRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  }
  function contentTypesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  }
  function rootRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  }

  // ---------- 对外 API ----------
  function buildXlsx(rows, sheetName) {
    sheetName = sheetName || 'Sheet1';
    const files = [
      { name: '[Content_Types].xml', data: strToU8(contentTypesXml()) },
      { name: '_rels/.rels', data: strToU8(rootRelsXml()) },
      { name: 'xl/workbook.xml', data: strToU8(workbookXml(sheetName)) },
      { name: 'xl/_rels/workbook.xml.rels', data: strToU8(workbookRelsXml()) },
      { name: 'xl/worksheets/sheet1.xml', data: strToU8(sheetXml(rows)) }
    ];
    return zipStore(files);
  }

  function exportObjects(objs, sheetName, fileName) {
    if (!objs || !objs.length) { alert('没有数据可导出'); return; }
    const headers = Object.keys(objs[0]);
    const rows = [headers];
    for (const o of objs) rows.push(headers.map(h => o[h]));
    const blob = new Blob([buildXlsx(rows, sheetName)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    triggerDownload(blob, fileName || 'export.xlsx');
  }

  function triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  global.YJXLSX = { buildXlsx, exportObjects, triggerDownload };
})(window);
