export function columnIndexToA1(index: number): string {
  if (index < 0) {
    throw new Error("Column index must be >= 0");
  }
  let n = index + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

export function a1Cell(sheetName: string, columnIndex: number, rowNumber: number): string {
  const quoted = sheetName.includes(" ") || sheetName.includes("!") ? `'${sheetName}'` : sheetName;
  return `${quoted}!${columnIndexToA1(columnIndex)}${rowNumber}`;
}
