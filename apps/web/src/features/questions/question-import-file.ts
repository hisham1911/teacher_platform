const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const QUESTION_IMPORT_HEADERS = [
  'type', 'prompt', 'A', 'B', 'C', 'D', 'correct', 'difficulty', 'language', 'tags', 'explanation',
] as const;

export async function readQuestionImportFile(file: File): Promise<string> {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension === 'csv') return (await file.text()).replace(/^\uFEFF/, '');
  if (extension !== 'xlsx') throw new Error('UnsupportedFileType');

  const entries = await readZipEntries(await file.arrayBuffer());
  const workbookXml = decodeRequired(entries, 'xl/workbook.xml');
  const workbookRelsXml = decodeRequired(entries, 'xl/_rels/workbook.xml.rels');
  const sheetPath = resolveFirstWorksheetPath(workbookXml, workbookRelsXml);
  const worksheetXml = decodeRequired(entries, sheetPath);
  const sharedStrings = entries.has('xl/sharedStrings.xml')
    ? parseSharedStrings(decodeRequired(entries, 'xl/sharedStrings.xml'))
    : [];
  const rows = parseWorksheetRows(worksheetXml, sharedStrings);
  if (rows.length === 0) return '';
  return rows.map((row) => row.map(toTsvCell).join('\t')).join('\n');
}

export function createCsvQuestionTemplate(): Blob {
  const header = `${QUESTION_IMPORT_HEADERS.join(',')}\n`;
  return new Blob([`\uFEFF${header}`], { type: 'text/csv;charset=utf-8' });
}

function toTsvCell(value: string): string {
  const normalized = value.replace(/\r?\n/g, ' ').trim();
  if (!/[\t"]/u.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

type ZipEntry = {
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

async function readZipEntries(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const decoder = new TextDecoder('utf-8');
  const entries = new Map<string, Uint8Array>();
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('InvalidXlsxArchive');
    const compressionMethod = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const fileNameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const fileName = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
    const entry: ZipEntry = { compressionMethod, compressedSize, localHeaderOffset };
    entries.set(normalizeZipPath(fileName), await extractZipEntry(bytes, view, entry));
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimumOffset = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error('InvalidXlsxArchive');
}

async function extractZipEntry(bytes: Uint8Array, view: DataView, entry: ZipEntry): Promise<Uint8Array> {
  const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error('InvalidXlsxArchive');
  const fileNameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod !== 8) throw new Error('UnsupportedXlsxCompression');

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function decodeRequired(entries: Map<string, Uint8Array>, path: string): string {
  const bytes = entries.get(normalizeZipPath(path));
  if (!bytes) throw new Error('InvalidXlsxWorkbook');
  return new TextDecoder('utf-8').decode(bytes);
}

function normalizeZipPath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return segments.join('/');
}

function parseXml(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length > 0) throw new Error('InvalidXlsxXml');
  return document;
}

function resolveFirstWorksheetPath(workbookXml: string, relationshipsXml: string): string {
  const workbook = parseXml(workbookXml);
  const firstSheet = workbook.getElementsByTagNameNS('*', 'sheet')[0];
  if (!firstSheet) throw new Error('XlsxHasNoWorksheet');
  const relationshipId = firstSheet.getAttribute('r:id')
    ?? firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  if (!relationshipId) throw new Error('InvalidXlsxWorkbook');

  const relationships = parseXml(relationshipsXml);
  const relation = Array.from(relationships.getElementsByTagNameNS('*', 'Relationship'))
    .find((item) => item.getAttribute('Id') === relationshipId);
  const target = relation?.getAttribute('Target');
  if (!target) throw new Error('InvalidXlsxWorkbook');
  return normalizeZipPath(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
}

function parseSharedStrings(xml: string): string[] {
  const document = parseXml(xml);
  return Array.from(document.getElementsByTagNameNS('*', 'si')).map((item) =>
    Array.from(item.getElementsByTagNameNS('*', 't')).map((text) => text.textContent ?? '').join(''),
  );
}

function parseWorksheetRows(xml: string, sharedStrings: string[]): string[][] {
  const document = parseXml(xml);
  const result: string[][] = [];
  for (const rowElement of Array.from(document.getElementsByTagNameNS('*', 'row'))) {
    const row: string[] = [];
    for (const cell of Array.from(rowElement.children).filter((element) => element.localName === 'c')) {
      const cellReference = cell.getAttribute('r') ?? '';
      const columnIndex = columnIndexFromReference(cellReference);
      const type = cell.getAttribute('t');
      let value = '';
      if (type === 'inlineStr') {
        value = Array.from(cell.getElementsByTagNameNS('*', 't')).map((text) => text.textContent ?? '').join('');
      } else {
        const raw = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent ?? '';
        value = type === 's' ? sharedStrings[Number(raw)] ?? '' : raw;
      }
      while (row.length <= columnIndex) row.push('');
      row[columnIndex] = value;
    }
    if (row.some((cell) => cell.trim().length > 0)) result.push(row);
  }
  return result;
}

function columnIndexFromReference(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? 'A';
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return Math.max(0, result - 1);
}

export { XLSX_MIME };
