export interface ApplicationExportRow {
  applicationNumber: string;
  studentName: string;
  email: string;
  campus: string;
  className: string;
  session: string;
  status: string;
  updatedAt: Date;
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

function cellValues(row: ApplicationExportRow): string[] {
  return [
    row.applicationNumber,
    row.studentName,
    row.email,
    row.campus,
    row.className,
    row.session,
    row.status,
    row.updatedAt.toISOString().slice(0, 10),
  ];
}

function csvCell(value: string): string {
  const safeValue = /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + safeValue.replace(/"/g, '""') + '"';
}

export function createCsv(rows: ApplicationExportRow[]): Uint8Array {
  const lines = [HEADERS, ...rows.map(cellValues)].map((line) => line.map(csvCell).join(","));
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
  const rowValues = [HEADERS, ...rows.map(cellValues)];
  const worksheetRows = rowValues
    .map((values, rowIndex) => {
      const cells = values
        .map((value, columnIndex) => {
          const reference = String.fromCharCode(65 + columnIndex) + String(rowIndex + 1);
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
        '<cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="2" width="28" customWidth="1"/><col min="3" max="3" width="32" customWidth="1"/><col min="4" max="4" width="24" customWidth="1"/><col min="5" max="6" width="16" customWidth="1"/><col min="7" max="8" width="18" customWidth="1"/></cols>' +
        "<sheetData>" +
        worksheetRows +
        "</sheetData></worksheet>",
    },
  ];

  return zipStored(files);
}

function pdfSafe(value: string, maxCharacters: number): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/[\\()]/g, "\\$&");
  return normalized.length > maxCharacters
    ? normalized.slice(0, Math.max(1, maxCharacters - 1)) + "."
    : normalized;
}

function pdfText(value: string, x: number, y: number, size = 8): string {
  return "BT /F1 " + String(size) + " Tf " + String(x) + " " + String(y) +
    " Td (" + value + ") Tj ET\n";
}

export function createPdf(rows: ApplicationExportRow[], title: string): Uint8Array {
  const columns = [
    { label: "Application #", width: 108, max: 20 },
    { label: "Student", width: 150, max: 28 },
    { label: "Campus", width: 124, max: 23 },
    { label: "Class", width: 95, max: 18 },
    { label: "Session", width: 85, max: 16 },
    { label: "Status", width: 110, max: 20 },
    { label: "Updated", width: 98, max: 16 },
  ];
  const left = 36;
  const rowsPerPage = 34;
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const pageContent: string[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageRows = rows.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    let content = "0.82 w\n";
    content += pdfText(pdfSafe(title, 72), left, 558, 15);
    content += pdfText(
      pdfSafe(String(rows.length) + " records  |  Page " + String(pageIndex + 1) + " of " + String(pageCount), 90),
      left,
      541,
      8,
    );

    let x = left;
    for (const column of columns) {
      content += pdfText(pdfSafe(column.label, column.max), x + 3, 518, 8);
      x += column.width;
    }
    content += "36 510 m 806 510 l S\n";

    pageRows.forEach((row, rowIndex) => {
      const values = [
        row.applicationNumber,
        row.studentName,
        row.campus,
        row.className,
        row.session,
        row.status,
        row.updatedAt.toISOString().slice(0, 10),
      ];
      const y = 494 - rowIndex * 13;
      let cellX = left;
      values.forEach((value, columnIndex) => {
        content += pdfText(pdfSafe(value, columns[columnIndex].max), cellX + 3, y, 8);
        cellX += columns[columnIndex].width;
      });
      content += String(left) + " " + String(y - 5) + " m 806 " + String(y - 5) + " l S\n";
    });
    content += pdfText("SAMS  |  Student applications", left, 27, 7);
    content += pdfText(
      "Generated " + new Date().toISOString().slice(0, 10),
      700,
      27,
      7,
    );
    pageContent.push(content);
  }

  const encoder = new TextEncoder();
  const objectContents: string[] = [];
  const pageObjectIds = pageContent.map((_, index) => 4 + index * 2);
  objectContents.push("<< /Type /Catalog /Pages 2 0 R >>");
  objectContents.push(
    "<< /Type /Pages /Kids [" + pageObjectIds.map((id) => String(id) + " 0 R").join(" ") +
      "] /Count " + String(pageCount) + " >>",
  );
  objectContents.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  pageContent.forEach((content, index) => {
    const pageId = 4 + index * 2;
    const streamId = pageId + 1;
    const streamLength = encoder.encode(content).length;
    objectContents.push(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents " +
        String(streamId) + " 0 R >>",
    );
    objectContents.push("<< /Length " + String(streamLength) + " >>\nstream\n" + content + "endstream");
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
