export const CODE_LENGTH = 8;

const BANGLA = /[\u0980-\u09FF]/;

/** Class for text containing Bangla, which needs normal letter spacing to render cleanly. */
export function bn(text: string, base = "") {
  return BANGLA.test(text) ? `${base} bn`.trim() : base;
}

export function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

export function formatCode(code: string) {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
