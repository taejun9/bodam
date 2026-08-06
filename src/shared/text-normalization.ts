export const trimEcmascriptWhitespace = (value: string): string => value.trim();

export function isUnicodeScalarText(value: string): boolean {
  return Array.from(value).every((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined &&
      (codePoint < 0xd800 || codePoint > 0xdfff);
  });
}
