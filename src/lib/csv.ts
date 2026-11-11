/** CSV compatible con Excel: todos los textos se escapan y no pueden convertirse en fórmulas. */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (typeof value !== "number" && /^\s*[=+\-@\t\r]/.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export const csvLine = (values: (string | number | null | undefined)[]) =>
  values.map(csvCell).join(";") + "\r\n";

export function downloadCsv(
  filename: string,
  rows: (string | number | null | undefined)[][],
) {
  const url = URL.createObjectURL(
    new Blob(["\ufeff", ...rows.map(csvLine)], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
