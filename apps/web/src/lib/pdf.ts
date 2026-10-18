/* ════════════════════════════════════════════════════════════════
   Escritor PDF mínimo (sin dependencias externas).

   Genera un documento de una o varias páginas con la cabecera del informe y su
   tabla en las fuentes estándar (Helvetica). El texto se normaliza a ASCII
   para que la longitud en caracteres coincida con la de bytes y la tabla de
   referencias del PDF quede correcta. Determinista: el mismo contenido produce
   el mismo documento.
   ════════════════════════════════════════════════════════════════ */

export interface PdfOptions {
  titulo: string;
  metadatos: [string, string][];
  columnas: (string | number)[];
  filas: (string | number)[][];
}

const ACENTOS: Record<string, string> = {
  á: "a", à: "a", ä: "a", â: "a", Á: "A", À: "A", Ä: "A", Â: "A",
  é: "e", è: "e", ë: "e", ê: "e", É: "E", È: "E", Ë: "E", Ê: "E",
  í: "i", ì: "i", ï: "i", î: "i", Í: "I", Ì: "I", Ï: "I", Î: "I",
  ó: "o", ò: "o", ö: "o", ô: "o", Ó: "O", Ò: "O", Ö: "O", Ô: "O",
  ú: "u", ù: "u", ü: "u", û: "u", Ú: "U", Ù: "U", Ü: "U", Û: "U",
  ñ: "n", Ñ: "N", "¿": "?", "¡": "!", "–": "-", "—": "-", "“": '"', "”": '"',
  "’": "'", "…": "...", "°": "deg", "≤": "<=", "≥": ">=",
};

function ascii(s: string): string {
  let out = "";
  for (const ch of s) {
    out += ACENTOS[ch] ?? (ch.charCodeAt(0) < 128 ? ch : "?");
  }
  return out;
}

function escapar(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/* `>>>` está rechazado en el entorno de compilación; se usa `Math.floor`. */
function wrap(texto: string, ancho: number): string[] {
  if (texto.length <= ancho) return [texto];
  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    if (!actual) actual = palabra;
    else if (actual.length + 1 + palabra.length <= ancho) actual = `${actual} ${palabra}`;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.length ? lineas : [""];
}

export function buildPdf(opts: PdfOptions): Blob {
  const ANCHO = 118;
  const lineas: { bold: boolean; texto: string }[] = [];
  lineas.push({ bold: true, texto: ascii(opts.titulo) });
  for (const [k, v] of opts.metadatos) lineas.push({ bold: false, texto: ascii(`${k}: ${v}`) });
  lineas.push({ bold: false, texto: "" });
  if (opts.columnas.length) lineas.push({ bold: true, texto: ascii(opts.columnas.join("  |  ")) });
  for (const fila of opts.filas) {
    for (const trozo of wrap(ascii(fila.join("  |  ")), ANCHO)) {
      lineas.push({ bold: false, texto: trozo });
    }
  }

  const POR_PAGINA = 58;
  const paginas: { bold: boolean; texto: string }[][] = [];
  for (let i = 0; i < lineas.length; i += POR_PAGINA) paginas.push(lineas.slice(i, i + POR_PAGINA));
  if (paginas.length === 0) paginas.push([]);

  const pageIds = paginas.map((_, i) => 5 + 2 * i);
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");

  const objetos: string[] = [];
  objetos.push("<< /Type /Catalog /Pages 2 0 R >>");
  objetos.push(`<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`);
  objetos.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objetos.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  paginas.forEach((pagina, i) => {
    const pageId = pageIds[i];
    const contenido = ["BT", "40 752 Td", "12 TL"];
    for (const l of pagina) {
      contenido.push(`${l.bold ? "/F2" : "/F1"} 8 Tf`);
      contenido.push(`(${escapar(l.texto)}) Tj`);
      contenido.push("T*");
    }
    contenido.push("ET");
    const stream = contenido.join("\n");
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`,
    );
    objetos.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let salida = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((obj, i) => {
    offsets.push(salida.length);
    salida += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const inicioXref = salida.length;
  salida += `xref\n0 ${objetos.length + 1}\n`;
  salida += "0000000000 65535 f \n";
  for (const off of offsets) salida += `${String(off).padStart(10, "0")} 00000 n \n`;
  salida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;

  return new Blob([salida], { type: "application/pdf" });
}
