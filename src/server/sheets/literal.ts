const FORMULA_PREFIX = new Set(["=", "+", "-", "@"]);

export function asLiteralSheetValue(value: string): string {
  if (value === "") {
    return value;
  }
  const first = value[0];
  if (first && FORMULA_PREFIX.has(first)) {
    return `'${value}`;
  }
  return value;
}

export function storedSheetValueLooksLike(intended: string, stored: string): boolean {
  if (stored === intended) {
    return true;
  }
  if (asLiteralSheetValue(intended) === stored) {
    return true;
  }
  if (stored === `'${intended}`) {
    return true;
  }
  return false;
}
