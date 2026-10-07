export interface ApplicationExportRow {
  applicationNumber: string;
  studentName: string;
  email: string;
  campus: string;
  className: string;
  session: string;
  status: string;
  updatedAt: Date;
  details: Record<string, string>;
}

const HEADERS = [
  "Application #",
  "Student",
  "Email",
  "Campus",
  "Class",
  "Session",
  "Status",
  "Updated",
];

function headersForRows(rows: ApplicationExportRow[]): string[] {
  const detailHeaders = new Set<string>();
  rows.forEach((row) => Object.keys(row.details).forEach((header) => detailHeaders.add(header)));
  return [...HEADERS, ...detailHeaders];
}

function cellValues(row: ApplicationExportRow, headers: string[]): string[] {
  const summary: Record<string, string> = {
    "Application #": row.applicationNumber,
    Student: row.studentName,
    Email: row.email,
    Campus: row.campus,
    Class: row.className,
    Session: row.session,
    Status: row.status,
    Updated: row.updatedAt.toISOString().slice(0, 10),
  };

  return headers.map((header) => summary[header] ?? row.details[header] ?? "");
}

function exportMatrix(rows: ApplicationExportRow[]): string[][] {
  const headers = headersForRows(rows);
  return [headers, ...rows.map((row) => cellValues(row, headers))];
}

function csvCell(value: string): string {
  const safeValue = /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + safeValue.replace(/"/g, '""') + '"';
}

export function createCsv(rows: ApplicationExportRow[]): Uint8Array {
  const lines = exportMatrix(rows).map((line) => line.map(csvCell).join(","));
  return new TextEncoder().encode("\uFEFF" + lines.join("\r\n"));
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function excelColumnName(index: number): string {
  let column = index + 1;
  let name = "";
  while (column > 0) {
    const remainder = (column - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    column = Math.floor((column - 1) / 26);
  }
  return name;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function littleEndian(value: number, size: 2 | 4): Uint8Array {
  const output = new Uint8Array(size);
  const view = new DataView(output.buffer);
  if (size === 2) view.setUint16(0, value, true);
  else view.setUint32(0, value, true);
  return output;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(files: Array<{ name: string; contents: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const contents = encoder.encode(file.contents);
    const crc = crc32(contents);
    const localHeader = concatBytes([
      littleEndian(0x04034b50, 4),
      littleEndian(20, 2),
      littleEndian(0x0800, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(crc, 4),
      littleEndian(contents.length, 4),
      littleEndian(contents.length, 4),
      littleEndian(name.length, 2),
      littleEndian(0, 2),
      name,
    ]);
    localParts.push(localHeader, contents);

    const centralHeader = concatBytes([
      littleEndian(0x02014b50, 4),
      littleEndian(20, 2),
      littleEndian(20, 2),
      littleEndian(0x0800, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(crc, 4),
      littleEndian(contents.length, 4),
      littleEndian(contents.length, 4),
      littleEndian(name.length, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(0, 2),
      littleEndian(0, 4),
      littleEndian(localOffset, 4),
      name,
    ]);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + contents.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord = concatBytes([
    littleEndian(0x06054b50, 4),
    littleEndian(0, 2),
    littleEndian(0, 2),
    littleEndian(files.length, 2),
    littleEndian(files.length, 2),
    littleEndian(centralDirectory.length, 4),
    littleEndian(localOffset, 4),
    littleEndian(0, 2),
  ]);

  return concatBytes([...localParts, centralDirectory, endRecord]);
}

export function createXlsx(rows: ApplicationExportRow[]): Uint8Array {
  const rowValues = exportMatrix(rows);
  const worksheetRows = rowValues
    .map((values, rowIndex) => {
      const cells = values
        .map((value, columnIndex) => {
          const reference = excelColumnName(columnIndex) + String(rowIndex + 1);
          const style = rowIndex === 0 ? ' s="1"' : "";
          return '<c r="' + reference + '" t="inlineStr"' + style + "><is><t xml:space=\"preserve\">" +
            xmlEscape(value) +
            "</t></is></c>";
        })
        .join("");
      return '<row r="' + String(rowIndex + 1) + '">' + cells + "</row>";
    })
    .join("");

  const files = [
    {
      name: "[Content_Types].xml",
      contents:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      contents:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    },
    {
      name: "xl/workbook.xml",
      contents:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Applications" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      contents:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>",
    },
    {
      name: "xl/styles.xml",
      contents:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B4332"/><bgColor indexed="64"/></patternFill></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    },
    {
      name: "xl/worksheets/sheet1.xml",
      contents:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        "<sheetData>" +
        worksheetRows +
        "</sheetData></worksheet>",
    },
  ];

  return zipStored(files);
}

function pdfSafe(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/[\\()]/g, "\\$&");
}

function pdfText(value: string, x: number, y: number, size = 8): string {
  return "BT /F1 " + String(size) + " Tf " + String(x) + " " + String(y) +
    " Td (" + value + ") Tj ET\n";
}

function wrapText(value: string, maxCharacters: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (word.length > maxCharacters) {
      if (line) lines.push(line);
      line = "";
      for (let offset = 0; offset < word.length; offset += maxCharacters) {
        const chunk = word.slice(offset, offset + maxCharacters);
        if (chunk.length === maxCharacters) lines.push(chunk);
        else line = chunk;
      }
      continue;
    }
    if (line && line.length + word.length + 1 > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export function createPdf(rows: ApplicationExportRow[], title: string): Uint8Array {
  const pageContent: string[] = [];
  let content = "0.82 w\n";
  let y = 0;

  const startPage = (studentIndex: number, row: ApplicationExportRow, continued: boolean) => {
    content = "0.82 w\n";
    content += pdfText(pdfSafe(title), 36, 558, 15);
    const studentHeader =
      "Student " + String(studentIndex + 1) + " of " + String(rows.length) +
      "  |  " + row.applicationNumber + "  |  " + row.studentName +
      (continued ? "  (continued)" : "");
    content += pdfText(pdfSafe(studentHeader), 36, 540, 9);
    content += "36 529 m 806 529 l S\n";
    y = 512;
  };

  rows.forEach((row, rowIndex) => {
    startPage(rowIndex, row, false);
    const fields = [
      ["Application #", row.applicationNumber],
      ["Student", row.studentName],
      ["Email", row.email],
      ["Campus", row.campus],
      ["Class", row.className],
      ["Session", row.session],
      ["Status", row.status],
      ["Updated", row.updatedAt.toISOString().slice(0, 10)],
      ...Object.entries(row.details),
    ].filter(([, value]) => value !== "");

    fields.forEach(([label, value]) => {
      const labelLines = wrapText(label, 30);
      const valueLines = wrapText(value, 108);
      const lineCount = Math.max(labelLines.length, valueLines.length);
      for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
        if (y - 11 < 48) {
          pageContent.push(content);
          startPage(rowIndex, row, true);
          content += pdfText(pdfSafe(label + " (continued)"), 39, y, 8);
        } else if (labelLines[lineIndex]) {
          content += pdfText(pdfSafe(labelLines[lineIndex]), 39, y, 8);
        }
        if (valueLines[lineIndex]) {
          content += pdfText(pdfSafe(valueLines[lineIndex]), 230, y, 8);
        }
        y -= 11;
      }
      y -= 4;
      content += "36 " + String(y + 2) + " m 806 " + String(y + 2) + " l S\n";
    });
    pageContent.push(content);
  });

  if (rows.length === 0) {
    content += pdfText(pdfSafe(title), 36, 558, 15);
    content += pdfText("No student records found.", 36, 530, 10);
    pageContent.push(content);
  }

  const generatedDate = new Date().toISOString().slice(0, 10);
  const pageCount = pageContent.length;
  const pagesWithFooters = pageContent.map((page, index) => page +
    pdfText("SAMS  |  Student applications", 36, 27, 7) +
    pdfText("Generated " + generatedDate + "  |  Page " + String(index + 1) + " of " + String(pageCount), 590, 27, 7));

  const encoder = new TextEncoder();
  const objectContents: string[] = [];
  const pageObjectIds = pagesWithFooters.map((_, index) => 4 + index * 2);
  objectContents.push("<< /Type /Catalog /Pages 2 0 R >>");
  objectContents.push(
    "<< /Type /Pages /Kids [" + pageObjectIds.map((id) => String(id) + " 0 R").join(" ") +
      "] /Count " + String(pageCount) + " >>",
  );
  objectContents.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  pagesWithFooters.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const streamId = pageId + 1;
    const streamLength = encoder.encode(page).length;
    objectContents.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents " +
        String(streamId) + " 0 R >>",
    );
    objectContents.push("<< /Length " + String(streamLength) + " >>\nstream\n" + page + "endstream");
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objectContents.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += String(index + 1) + " 0 obj\n" + object + "\nendobj\n";
  });
  const xrefOffset = encoder.encode(pdf).length;
  pdf += "xref\n0 " + String(objectContents.length + 1) + "\n";
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += String(offset).padStart(10, "0") + " 00000 n \n";
  });
  pdf +=
    "trailer\n<< /Size " + String(objectContents.length + 1) +
    " /Root 1 0 R >>\nstartxref\n" + String(xrefOffset) + "\n%%EOF";
  return encoder.encode(pdf);
}
