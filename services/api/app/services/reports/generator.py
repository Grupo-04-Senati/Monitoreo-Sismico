"""Serialización de informes a CSV, XLSX y PDF.

Los escritores son deliberadamente mínimos y sin dependencias externas: el XLSX
usa ZIP + XML con cadenas en línea y el PDF un flujo de texto con las fuentes
estándar. Ambos son deterministas, de modo que el mismo contenido produce el
mismo archivo.
"""

from __future__ import annotations

import csv
import io
import os
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from app.core.clock import now as clock_now
from app.services.reports.base import ReportData

_SUBDIR = "sismora_reportes"


def directorio_reportes() -> Path:
    """Directorio temporal donde se guardan los archivos de informe."""
    base = Path(os.environ.get("SISMORA_REPORTS_DIR") or tempfile.gettempdir()) / _SUBDIR
    base.mkdir(parents=True, exist_ok=True)
    return base


# ──────────────────────────────────────────────────────────────────────── CSV
def _csv_bytes(data: ReportData) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    for clave, valor in data.metadatos:
        writer.writerow([f"# {clave}: {valor}"])
    if data.metadatos:
        writer.writerow([])
    writer.writerow(data.columnas)
    writer.writerows(data.filas)
    return buffer.getvalue().encode("utf-8-sig")


# ─────────────────────────────────────────────────────────────────────── XLSX
def _xml_escape(valor: str) -> str:
    return (
        valor.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _col_letter(index: int) -> str:
    letras = ""
    index += 1
    while index:
        index, resto = divmod(index - 1, 26)
        letras = chr(65 + resto) + letras
    return letras


def _cell(col: int, row: int, valor: str, estilo: int = 0) -> str:
    ref = f"{_col_letter(col)}{row}"
    s = f' s="{estilo}"' if estilo else ""
    return (
        f'<c r="{ref}" t="inlineStr"{s}><is><t xml:space="preserve">'
        f"{_xml_escape(valor)}</t></is></c>"
    )


def _xlsx_bytes(data: ReportData) -> bytes:
    filas_xml: list[str] = []
    numero = 1
    for clave, valor in data.metadatos:
        filas_xml.append(f'<row r="{numero}">{_cell(0, numero, f"{clave}: {valor}")}</row>')
        numero += 1
    filas_xml.append(f'<row r="{numero}"></row>')
    numero += 1
    cabecera = "".join(_cell(i, numero, c, 1) for i, c in enumerate(data.columnas))
    filas_xml.append(f'<row r="{numero}">{cabecera}</row>')
    for fila in data.filas:
        numero += 1
        celdas = "".join(_cell(i, numero, str(c)) for i, c in enumerate(fila))
        filas_xml.append(f'<row r="{numero}">{celdas}</row>')

    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(filas_xml)}</sheetData></worksheet>'
    )
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets><sheet name="{_xml_escape(data.nombre[:31])}" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="10"/><name val="Calibri"/></font>'
        '<font><b/><sz val="10"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        '<borders count="1"><border/></borders>'
        '<cellStyleXfs count="1"><xf/></cellStyleXfs>'
        '<cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs>'
        "</styleSheet>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        "</Relationships>"
    )
    wb_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("xl/workbook.xml", workbook)
        zf.writestr("xl/_rels/workbook.xml.rels", wb_rels)
        zf.writestr("xl/styles.xml", styles)
        zf.writestr("xl/worksheets/sheet1.xml", sheet)
    return buffer.getvalue()


# ──────────────────────────────────────────────────────────────────────── PDF
def _pdf_escape(texto: str) -> str:
    return texto.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _wrap(texto: str, ancho: int) -> list[str]:
    if len(texto) <= ancho:
        return [texto]
    palabras = texto.split(" ")
    lineas: list[str] = []
    actual = ""
    for palabra in palabras:
        if not actual:
            actual = palabra
        elif len(actual) + 1 + len(palabra) <= ancho:
            actual = f"{actual} {palabra}"
        else:
            lineas.append(actual)
            actual = palabra
    if actual:
        lineas.append(actual)
    return lineas or [""]


def _pdf_bytes(data: ReportData) -> bytes:
    ancho = 118
    lineas: list[tuple[int, str]] = []  # (estilo, texto) estilo 0 normal / 1 negrita
    lineas.append((1, data.nombre))
    for clave, valor in data.metadatos:
        lineas.append((0, f"{clave}: {valor}"))
    lineas.append((0, ""))
    if data.columnas:
        lineas.append((1, "  |  ".join(data.columnas)))
    for fila in data.filas:
        lineas.extend((0, trozo) for trozo in _wrap("  |  ".join(str(c) for c in fila), ancho))

    por_pagina = 58
    paginas = [lineas[i : i + por_pagina] for i in range(0, len(lineas), por_pagina)] or [[]]

    # Ids fijos: 1 Catalog, 2 Pages, 3 Font normal, 4 Font bold;
    # a partir de 5, por cada página: Page (impar) + Contents (par).
    page_ids = [5 + 2 * i for i in range(len(paginas))]
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)

    objetos: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{kids}] /Count {len(paginas)} >>".encode("latin-1"),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ]

    for page_id, pagina in zip(page_ids, paginas):
        contenido = ["BT", "40 752 Td", "12 TL"]
        for estilo, texto in pagina:
            contenido.append(("/F2 " if estilo else "/F1 ") + "8 Tf")
            contenido.append(f"({_pdf_escape(texto)}) Tj")
            contenido.append("T*")
        contenido.append("ET")
        stream = "\n".join(contenido).encode("latin-1", "replace")
        objetos.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {page_id + 1} 0 R >>"
            ).encode("latin-1")
        )
        objetos.append(
            f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1")
            + stream
            + b"\nendstream"
        )

    salida = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(objetos, start=1):
        offsets.append(len(salida))
        salida += f"{i} 0 obj\n".encode("latin-1") + obj + b"\nendobj\n"
    inicio_xref = len(salida)
    salida += f"xref\n0 {len(objetos) + 1}\n".encode("latin-1")
    salida += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        salida += f"{offset:010d} 00000 n \n".encode("latin-1")
    salida += (
        f"trailer\n<< /Size {len(objetos) + 1} /Root 1 0 R >>\n"
        f"startxref\n{inicio_xref}\n%%EOF"
    ).encode("latin-1")
    return bytes(salida)


def _sanitizar(nombre: str) -> str:
    limpio = "".join(c if c.isalnum() or c in "-_" else "_" for c in nombre)
    return limpio.strip("_")[:80] or "informe"


def escribir_archivo(
    data: ReportData,
    formato: str,
    directorio: Path | None = None,
    nombre_base: str | None = None,
) -> tuple[Path, int]:
    """Escribe el informe y devuelve (ruta, tamaño en bytes)."""
    destino = directorio or directorio_reportes()
    destino.mkdir(parents=True, exist_ok=True)
    marca = clock_now().strftime("%Y%m%d%H%M%S")
    slug = _sanitizar(nombre_base or data.nombre)
    ruta = destino / f"{slug}_{marca}.{formato}"

    if formato == "csv":
        contenido = _csv_bytes(data)
    elif formato == "xlsx":
        contenido = _xlsx_bytes(data)
    elif formato == "pdf":
        contenido = _pdf_bytes(data)
    else:  # pragma: no cover - validado antes
        raise ValueError(f"Formato no soportado: {formato}")

    ruta.write_bytes(contenido)
    return ruta, len(contenido)


__all__ = ["directorio_reportes", "escribir_archivo"]
