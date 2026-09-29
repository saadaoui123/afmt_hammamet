import * as XLSX from "xlsx";

export interface Sheet {
  name: string;
  rows: Array<Array<string | number>>;
  merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
}

export function exportExcel(sheets: Sheet[], filename: string) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    const colCount = Math.max(...s.rows.map((r) => r.length), 0);
    const widths: Array<{ wch: number }> = [];
    for (let c = 0; c < colCount; c++) {
      let maxLen = 8;
      for (let r = 0; r < s.rows.length; r++) {
        const val = s.rows[r]?.[c];
        if (val !== undefined && val !== null) {
          const l = String(val).length;
          if (l > maxLen) maxLen = l;
        }
      }
      widths.push({ wch: Math.min(maxLen + 2, 35) });
    }
    ws["!cols"] = widths;
    if (s.merges && s.merges.length > 0) {
      ws["!merges"] = s.merges;
    }
    wb.SheetNames.push(s.name);
    wb.Sheets[s.name] = ws;
  }
  XLSX.writeFile(wb, filename);
}

export function printPDF() {
  window.print();
}
