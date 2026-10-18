/* ════════════════════════════════════════════════════════════════
   Escritor XLSX mínimo (sin dependencias externas).

   Genera un libro de Excel (.xlsx) con una hoja por bloque usando el
   formato Open XML: un contenedor ZIP (método "store", sin compresión)
   con los XML requeridos y celdas de texto en línea (`inlineStr`), de
   modo que no hace falta la tabla de cadenas compartidas.

   Pensado para exportaciones pequeñas (miles de filas): no comprime.
   ════════════════════════════════════════════════════════════════ */

export interface XlsxSheet {
  name: string;
  cols: string[];
  rows: (string | number | null)[][];
}

/* ════ CRC-32 (tabla perezosa) ════ */
let CRC_TABLE: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    CRC_TABLE = t;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

const ENC = new TextEncoder();

/** Puente de tipos: `Uint8Array` es un `BlobPart` válido en tiempo de ejecución. */
const asPart = (u: Uint8Array): BlobPart => u as unknown as BlobPart;

/* ════ ZIP (método store) ════ */
function zipStore(entries: { name: string; data: Uint8Array }[]): Blob {
  const partes: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const FECHA = 0; // 1980-01-01 (marca fija, reproducible)
  const HORA = 0;

  for (const e of entries) {
    const nameBytes = ENC.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // nombres en UTF-8
    lv.setUint16(8, 0, true); // sin compresión
    lv.setUint16(10, HORA, true);
    lv.setUint16(12, FECHA, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    partes.push(asPart(local), asPart(e.data));

    const c = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, HORA, true);
    cv.setUint16(14, FECHA, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    c.set(nameBytes, 46);
    central.push(c);

    offset += local.length + e.data.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const fv = new DataView(fin.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, entries.length, true);
  fv.setUint16(10, entries.length, true);
  fv.setUint32(12, centralSize, true);
  fv.setUint32(16, offset, true);

  return new Blob([...partes, ...central.map(asPart), asPart(fin)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/* ════ Utilidades XML ════ */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\u0000-\u0008|\u000b|\u000c|\u000e-\u001f/g, "");
}

/** 0 → A, 25 → Z, 26 → AA… */
function colRef(n: number): string {
  let s = "";
  n += 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function nombreHoja(name: string): string {
  return (name.replace(/[\\/?*[\]:]/g, " ").trim() || "Hoja").slice(0, 31);
}

/* ════ Contenido de la hoja ════ */
function hojaXml(sheet: XlsxSheet): string {
  const filas: string[] = [];

  const filaXml = (vals: (string | number | null)[], r: number, forzarTexto = false) =>
    `<row r="${r}">` +
    vals
      .map((v, ci) => {
        const ref = `${colRef(ci)}${r}`;
        if (v == null || v === "") return "";
        if (!forzarTexto && typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
        const texto = typeof v === "number" ? String(v) : v;
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(texto)}</t></is></c>`;
      })
      .join("") +
    `</row>`;

  filas.push(filaXml(sheet.cols, 1, true));
  sheet.rows.forEach((fila, i) => filas.push(filaXml(fila, i + 2)));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filas.join("")}</sheetData></worksheet>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>`;

/** Construye el Blob de un libro .xlsx con una hoja por bloque. */
export function buildXlsx(sheets: XlsxSheet[]): Blob {
  const hojas = sheets.length ? sheets : [{ name: "Hoja1", cols: [""], rows: [] }];
  const nombres = new Set<string>();
  const titulos = hojas.map((s) => {
    let n = nombreHoja(s.name);
    let i = 2;
    while (nombres.has(n)) n = `${nombreHoja(s.name).slice(0, 28)}_${i++}`;
    nombres.add(n);
    return n;
  });

  const entries = hojas.map((s, i) => ({
    name: `xl/worksheets/sheet${i + 1}.xml`,
    data: ENC.encode(hojaXml(s)),
  }));

  const overrides = hojas
    .map(
      (_s, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");

  entries.push({
    name: "[Content_Types].xml",
    data: ENC.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`,
    ),
  });

  entries.push({
    name: "_rels/.rels",
    data: ENC.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
  });

  entries.push({
    name: "xl/workbook.xml",
    data: ENC.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${titulos
        .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    ),
  });

  const sheetRels = hojas
    .map(
      (_s, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("");

  entries.push({
    name: "xl/_rels/workbook.xml.rels",
    data: ENC.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
  });

  entries.push({ name: "xl/styles.xml", data: ENC.encode(ESTILOS) });

  return zipStore(entries);
}
