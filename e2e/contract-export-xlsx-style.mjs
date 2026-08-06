import assert from "node:assert/strict";
import { TextDecoder } from "node:util";

const columnCount = 21;
const expectedColumnWidth = 8.85156;
const expectedDefaultRowHeight = 15;
// rust_xlsxwriter serializes the reference's ~13.55 pt height at its
// pixel-equivalent OOXML height of 13.5 pt.
const expectedUsedRowHeight = 13.5;

export function assertXlsxStyle(sheetBytes, styleBytes, rowCount) {
  const sheet = normalizedXml(sheetBytes);
  const styles = normalizedXml(styleBytes);
  assertNoUnsupportedSheetFeatures(sheet);
  assertColumns(sheet);
  assertRows(sheet, rowCount);
  const styleIds = rowStyleIds(sheet, rowCount);
  const fonts = elements(section(styles, "fonts"), "font");
  const fills = elements(section(styles, "fills"), "fill");
  const borders = elements(section(styles, "borders"), "border");
  const xfs = elements(section(styles, "cellXfs"), "xf");
  const header = resolvedStyle(styleIds.header, xfs, fonts, fills, borders);
  const firstData = resolvedStyle(styleIds.firstData, xfs, fonts, fills, borders);
  const body = styleIds.body === null
    ? null
    : resolvedStyle(styleIds.body, xfs, fonts, fills, borders);

  [header, firstData, body].filter(Boolean).forEach((style) => assertWhiteFill(style.fill));
  [header, firstData, body].filter(Boolean).forEach((style) => assertCalibriEleven(style.font));
  assert.equal(header.fontId, firstData.fontId);
  assertAlignment(header.xf.body, "center", "center");
  assertAlignment(firstData.xf.body, null, "center");
  assertBorder(header.border, {
    left: "FF000000", right: "FF000000", top: "FF000000", bottom: "FF000000",
  });
  assertBorder(firstData.border, {
    left: "FFFF0000", right: "FFFF0000", top: "FF000000", bottom: "FFFF0000",
  });
  if (body !== null) {
    assert.equal(firstData.fontId, body.fontId);
    assertAlignment(body.xf.body, null, "center");
    assertBorder(body.border, {
      left: "FFFF0000", right: "FFFF0000", top: "FFFF0000", bottom: "FFFF0000",
    });
  }
}

function assertNoUnsupportedSheetFeatures(sheet) {
  for (const name of [
    "mergeCells", "autoFilter", "pane", "pageSetup", "printOptions", "headerFooter",
  ]) {
    assert.equal(new RegExp(`<${name}\\b`).test(sheet), false, `unexpected XLSX ${name}`);
  }
}

function assertColumns(sheet) {
  const widths = Array.from({ length: columnCount }, () => null);
  for (const column of sheet.matchAll(/<col\b([^>]*)\/?\s*>/g)) {
    const minimum = integerAttribute(column[1], "min");
    const maximum = integerAttribute(column[1], "max");
    const width = numberAttribute(column[1], "width");
    assert.ok(minimum >= 1 && maximum <= columnCount && minimum <= maximum);
    for (let index = minimum - 1; index < maximum; index += 1) {
      assert.equal(widths[index], null, `duplicate XLSX column width ${index + 1}`);
      widths[index] = width;
    }
  }
  widths.forEach((width, index) => {
    assert.notEqual(width, null, `missing XLSX column width ${index + 1}`);
    assert.ok(Math.abs(width - expectedColumnWidth) <= 0.02, `XLSX column ${index + 1} width`);
  });
  const format = sheet.match(/<sheetFormatPr\b([^>]*)\/?\s*>/);
  assert.ok(format, "XLSX sheet format missing");
  assertNear(numberAttribute(format[1], "defaultRowHeight"), expectedDefaultRowHeight);
}

function assertRows(sheet, rowCount) {
  const rows = [...sheet.matchAll(/<row\b([^>]*)>/g)];
  assert.equal(rows.length, rowCount);
  rows.forEach((row, index) => {
    assert.equal(integerAttribute(row[1], "r"), index + 1);
    assertNear(numberAttribute(row[1], "ht"), expectedUsedRowHeight);
    assert.ok(new Set(["1", "true"]).has(attribute(row[1], "customHeight")));
  });
}

function rowStyleIds(sheet, rowCount) {
  const rows = Array.from({ length: rowCount }, () => []);
  const seen = new Set();
  for (const cell of sheet.matchAll(/<c\b([^>]*?)(?:\/\s*>|>[\s\S]*?<\/c\s*>)/g)) {
    const reference = attribute(cell[1], "r");
    assert.equal(seen.has(reference), false, `duplicate styled XLSX cell ${reference}`);
    seen.add(reference);
    const position = cellPosition(reference);
    if (position.row < rowCount && position.column < columnCount) {
      rows[position.row][position.column] = integerAttribute(cell[1], "s");
    }
  }
  rows.forEach((row, index) => {
    assert.equal(row.length, columnCount, `styled XLSX row ${index + 1} width`);
    assert.equal(row.every(Number.isInteger), true, `missing XLSX style in row ${index + 1}`);
    assert.equal(new Set(row).size, 1, `mixed XLSX styles in row ${index + 1}`);
  });
  assert.ok(rowCount >= 2, "XLSX export needs a header and one data row");
  const ids = {
    header: rows[0][0],
    firstData: rows[1][0],
    body: rowCount > 2 ? rows[2][0] : null,
  };
  assert.notEqual(ids.header, ids.firstData);
  if (ids.body !== null) assert.notEqual(ids.firstData, ids.body);
  return ids;
}

function resolvedStyle(id, xfs, fonts, fills, borders) {
  const xf = xfs[id];
  assert.ok(xf, `missing XLSX cell style ${id}`);
  const fontId = integerAttribute(xf.attributes, "fontId");
  const font = fonts[fontId];
  const fill = fills[integerAttribute(xf.attributes, "fillId")];
  const border = borders[integerAttribute(xf.attributes, "borderId")];
  assert.ok(font, `missing XLSX font for style ${id}`);
  assert.ok(fill, `missing XLSX fill for style ${id}`);
  assert.ok(border, `missing XLSX border for style ${id}`);
  return { xf, fontId, font, fill, border };
}

function assertCalibriEleven(font) {
  const name = font.body.match(/<name\b([^>]*)\/?\s*>/);
  const size = font.body.match(/<sz\b([^>]*)\/?\s*>/);
  assert.ok(name, "XLSX font name missing");
  assert.ok(size, "XLSX font size missing");
  assert.equal(attribute(name[1], "val"), "Calibri");
  assertNear(numberAttribute(size[1], "val"), 11);
}

function assertWhiteFill(fill) {
  const pattern = fill.body.match(/<patternFill\b([^>]*)>([\s\S]*?)<\/patternFill\s*>/);
  assert.ok(pattern, "XLSX solid fill missing");
  assert.equal(attribute(pattern[1], "patternType"), "solid");
  const color = pattern[2].match(/<fgColor\b([^>]*)\/?\s*>/);
  assert.ok(color, "XLSX foreground color missing");
  assert.equal(normalizedColor(attribute(color[1], "rgb")), "FFFFFFFF");
}

function assertAlignment(xfBody, horizontal, vertical) {
  const alignment = xfBody.match(/<alignment\b([^>]*)\/?\s*>/);
  assert.ok(alignment, "XLSX alignment missing");
  assert.equal(attribute(alignment[1], "horizontal", false), horizontal);
  assert.equal(attribute(alignment[1], "vertical", false), vertical);
  assert.ok(new Set([null, "0", "false"]).has(attribute(alignment[1], "wrapText", false)));
}

function assertBorder(border, colors) {
  for (const [edge, expectedColor] of Object.entries(colors)) {
    const match = border.body.match(new RegExp(`<${edge}\\b([^>]*)>([\\s\\S]*?)<\\/${edge}\\s*>`));
    assert.ok(match, `XLSX ${edge} border missing`);
    assert.equal(attribute(match[1], "style"), "thin");
    const color = match[2].match(/<color\b([^>]*)\/?\s*>/);
    assert.ok(color, `XLSX ${edge} border color missing`);
    assert.equal(normalizedColor(attribute(color[1], "rgb")), expectedColor);
  }
}

function section(xml, name) {
  const match = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`));
  assert.ok(match, `missing XLSX style section ${name}`);
  return match[1];
}

function elements(xml, name) {
  return [...xml.matchAll(new RegExp(
    `<${name}\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/${name}\\s*>)`,
    "g",
  ))].map((match) => ({ attributes: match[1], body: match[2] ?? "" }));
}

function cellPosition(reference) {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(reference);
  assert.ok(match, `invalid styled XLSX cell ${reference}`);
  let column = 0;
  for (const character of match[1]) column = column * 26 + character.charCodeAt(0) - 64;
  return { row: Number(match[2]) - 1, column: column - 1 };
}

function integerAttribute(source, name) {
  const value = attribute(source, name);
  assert.match(value, /^\d+$/);
  return Number(value);
}

function numberAttribute(source, name) {
  const value = Number(attribute(source, name));
  assert.equal(Number.isFinite(value), true);
  return value;
}

function attribute(source, name, required = true) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:^|\\s)${escaped}=(['"])(.*?)\\1`));
  if (required) assert.ok(match, `missing XML attribute ${name}`);
  return match?.[2] ?? null;
}

function normalizedColor(value) {
  return value.length === 6 ? `FF${value.toUpperCase()}` : value.toUpperCase();
}

function assertNear(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= 0.02, `expected ${expected}, got ${actual}`);
}

function normalizedXml(bytes) {
  return new TextDecoder("utf-8", { fatal: true })
    .decode(bytes)
    .replace(/(<\/?)[A-Za-z_][\w.-]*:/g, "$1");
}
