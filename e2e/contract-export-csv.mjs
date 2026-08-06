import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { TextDecoder } from "node:util";

import { contractHeaders } from "./contract-export-db.mjs";

const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);

export function assertCsvExport(path, expectedRows) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(0, 3).equals(utf8Bom), true, "CSV BOM missing");
  assert.equal(bytes.subarray(3, 6).equals(utf8Bom), false, "duplicate CSV BOM");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(3));
  assert.equal(text.startsWith("\ufeff"), false, "duplicate decoded CSV BOM");
  assert.equal(text.endsWith("\r\n"), true, "CSV must end with CRLF");
  const rows = parseStrictCsv(text);
  assert.deepEqual(rows[0], contractHeaders);
  assert.equal(rows.length, expectedRows.length + 1);
  rows.forEach((row) => assert.equal(row.length, contractHeaders.length));
  assert.deepEqual(rows.slice(1), expectedRows.map(csvRow));
}

function csvRow(row) {
  return row.map((value) => value ?? "");
}

function parseStrictCsv(text) {
  const rows = [];
  let index = 0;
  while (index < text.length) {
    const row = [];
    while (true) {
      const parsed = text[index] === '"'
        ? parseQuotedField(text, index)
        : parsePlainField(text, index);
      row.push(parsed.value);
      index = parsed.next;
      if (text[index] === ",") {
        index += 1;
        continue;
      }
      assert.equal(text.slice(index, index + 2), "\r\n", "CSV record needs CRLF");
      index += 2;
      rows.push(row);
      break;
    }
  }
  return rows;
}

function parsePlainField(text, start) {
  let index = start;
  while (index < text.length && text[index] !== "," && text[index] !== "\r") {
    assert.notEqual(text[index], "\n", "lone LF in CSV");
    assert.notEqual(text[index], '"', "quote in unquoted CSV field");
    index += 1;
  }
  return { value: text.slice(start, index), next: index };
}

function parseQuotedField(text, start) {
  let index = start + 1;
  let value = "";
  while (index < text.length) {
    if (text[index] === '"') {
      if (text[index + 1] === '"') {
        value += '"';
        index += 2;
        continue;
      }
      return { value, next: index + 1 };
    }
    // RFC 4180 escaped fields may contain CR and LF independently. Only
    // record delimiters outside quoted fields are required to be CRLF.
    value += text[index];
    index += 1;
  }
  assert.fail("unterminated quoted CSV field");
}
