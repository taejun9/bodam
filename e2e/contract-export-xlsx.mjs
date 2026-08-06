import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { TextDecoder } from "node:util";
import { inflateRawSync } from "node:zlib";

import { contractHeaders } from "./contract-export-db.mjs";
import { assertXlsxStyle } from "./contract-export-xlsx-style.mjs";

const worksheetName = "계약조회(엑셀변환)_장기";

export function assertXlsxExport(path, expectedRows) {
  const entries = readZipEntries(readFileSync(path));
  const workbook = normalizedXml(requiredEntry(entries, "xl/workbook.xml"));
  const relationships = normalizedXml(requiredEntry(entries, "xl/_rels/workbook.xml.rels"));
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/g)];
  assert.equal(sheets.length, 1);
  assert.equal(attribute(sheets[0][1], "name"), worksheetName);
  const relationshipId = attribute(sheets[0][1], "r:id");
  const target = relationshipTarget(relationships, relationshipId);
  const sheetPath = target.startsWith("/")
    ? posix.normalize(target.slice(1))
    : posix.normalize(posix.join("xl", target));
  assert.equal(sheetPath.startsWith("xl/worksheets/"), true);
  const sheet = normalizedXml(requiredEntry(entries, sheetPath));
  assert.equal((sheet.match(/<f\b/g) ?? []).length, 0, "XLSX formulas are forbidden");
  assertXlsxStyle(
    requiredEntry(entries, sheetPath),
    requiredEntry(entries, "xl/styles.xml"),
    expectedRows.length + 1,
  );

  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? parseSharedStrings(normalizedXml(entries.get("xl/sharedStrings.xml")))
    : [];
  const actualRows = parseSheetRows(sheet, sharedStrings, expectedRows.length + 1);
  assert.deepEqual(actualRows[0], contractHeaders);
  assert.deepEqual(actualRows.slice(1), expectedRows);
}

function parseSheetRows(xml, sharedStrings, rowCount) {
  const rows = Array.from(
    { length: rowCount },
    () => Array.from({ length: contractHeaders.length }, () => null),
  );
  const seen = new Set();
  let stringCellCount = 0;
  const cells = xml.matchAll(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c\s*>)/g);
  for (const cell of cells) {
    const reference = attribute(cell[1], "r");
    const position = cellPosition(reference);
    assert.ok(position.row < rowCount, `unexpected XLSX row ${position.row + 1}`);
    assert.ok(position.column < contractHeaders.length, `unexpected XLSX cell ${reference}`);
    assert.equal(seen.has(reference), false, `duplicate XLSX cell ${reference}`);
    seen.add(reference);
    const body = cell[2] ?? "";
    assert.equal(/<f\b/.test(body), false, `formula cell ${reference}`);
    const type = attribute(cell[1], "t", false);
    const value = cellValue(type, body, sharedStrings);
    if (value !== null) {
      assert.ok(new Set(["inlineStr", "s", "str"]).has(type), `non-string cell ${reference}`);
      stringCellCount += 1;
    }
    rows[position.row][position.column] = value;
  }
  assert.ok(stringCellCount >= contractHeaders.length, "XLSX string cells missing");
  return rows;
}

function cellValue(type, body, sharedStrings) {
  if (!body) return null;
  if (type === "inlineStr") return textRuns(body);
  const value = elementText(body, "v");
  if (value === null || value === "") return null;
  if (type === "s") {
    assert.match(value, /^(0|[1-9]\d*)$/);
    const shared = sharedStrings[Number(value)];
    assert.notEqual(shared, undefined, "shared string index out of range");
    return shared;
  }
  if (type === "str") return decodeSpreadsheetText(value);
  assert.fail(`unsupported populated XLSX cell type ${type ?? "missing"}`);
}

function parseSharedStrings(xml) {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si\s*>/g)]
    .map((match) => textRuns(match[1]));
}

function textRuns(xml) {
  const runs = [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t\s*>/g)];
  if (runs.length === 0) return "";
  return runs.map((match) => decodeSpreadsheetText(match[1])).join("");
}

function elementText(xml, name) {
  const match = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`));
  return match ? match[1] : null;
}

function cellPosition(reference) {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(reference);
  assert.ok(match, `invalid XLSX cell reference ${reference}`);
  let column = 0;
  for (const character of match[1]) column = column * 26 + character.charCodeAt(0) - 64;
  return { row: Number(match[2]) - 1, column: column - 1 };
}

function relationshipTarget(xml, relationshipId) {
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)) {
    if (attribute(match[1], "Id") === relationshipId) return attribute(match[1], "Target");
  }
  assert.fail("worksheet relationship missing");
}

function attribute(source, name, required = true) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:^|\\s)${escaped}=(['"])(.*?)\\1`));
  if (required) assert.ok(match, `missing XML attribute ${name}`);
  return match?.[2] ? decodeXml(match[2]) : null;
}

function decodeXml(value) {
  return value.replace(/&(?:#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (entity) => {
    if (entity === "&amp;") return "&";
    if (entity === "&lt;") return "<";
    if (entity === "&gt;") return ">";
    if (entity === "&quot;") return '"';
    if (entity === "&apos;") return "'";
    const hexadecimal = entity.startsWith("&#x");
    const digits = entity.slice(hexadecimal ? 3 : 2, -1);
    return String.fromCodePoint(Number.parseInt(digits, hexadecimal ? 16 : 10));
  });
}

function decodeSpreadsheetText(value) {
  return decodeXml(value).replace(
    /_x([0-9a-fA-F]{4})_/g,
    (_, codeUnit) => String.fromCharCode(Number.parseInt(codeUnit, 16)),
  );
}

function normalizedXml(bytes) {
  return new TextDecoder("utf-8", { fatal: true })
    .decode(bytes)
    .replace(/(<\/?)[A-Za-z_][\w.-]*:/g, "$1");
}

function requiredEntry(entries, name) {
  const value = entries.get(name);
  assert.ok(value, `missing XLSX entry ${name}`);
  return value;
}

function readZipEntries(archive) {
  const eocd = findEndOfCentralDirectory(archive);
  const entryCount = archive.readUInt16LE(eocd + 10);
  let offset = archive.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(archive.readUInt32LE(offset), 0x02014b50, "invalid ZIP central entry");
    const flags = archive.readUInt16LE(offset + 8);
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const uncompressedSize = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    assert.equal(flags & 1, 0, "encrypted XLSX entry");
    assert.ok(uncompressedSize <= 20 * 1024 * 1024, "oversized XLSX entry");
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    assert.equal(entries.has(name), false, `duplicate XLSX entry ${name}`);
    entries.set(name, readLocalEntry(archive, localOffset, method, compressedSize, uncompressedSize));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readLocalEntry(archive, offset, method, compressedSize, uncompressedSize) {
  assert.equal(archive.readUInt32LE(offset), 0x04034b50, "invalid ZIP local entry");
  const nameLength = archive.readUInt16LE(offset + 26);
  const extraLength = archive.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = archive.subarray(start, start + compressedSize);
  const value = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
  assert.ok(value, `unsupported ZIP compression ${method}`);
  assert.equal(value.length, uncompressedSize, "XLSX entry size mismatch");
  return value;
}

function findEndOfCentralDirectory(archive) {
  const minimum = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimum; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  assert.fail("XLSX central directory missing");
}
