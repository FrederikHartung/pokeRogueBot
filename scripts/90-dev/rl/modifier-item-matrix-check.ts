// Gleicht die Spalte "Strategic Collector" in docs/select-modifier-shop-item-matrix.md mit den Collector-Regeln ab
// (src/main/ts/lib/modifier-collector-policy.ts), wie sie die Item-Suite fuer echte Spiel-Items ermittelt.

export const COLLECTOR_COLUMN = "Strategic Collector";

export type CollectorVerdict = "ja" | "nein" | "teilweise";

export interface CollectorExecutabilityEntry {
  item_id: string;
  source: "reward" | "shop";
  executable: boolean;
  reason: string | null;
}

export interface MatrixRowCheck {
  line: number;
  item_ids: string[];
  source: "reward" | "shop";
  documented: string;
  expected: CollectorVerdict | null;
  unchecked_item_ids: string[];
}

export interface MatrixCheckResult {
  rows: MatrixRowCheck[];
  mismatches: MatrixRowCheck[];
  unchecked_rows: MatrixRowCheck[];
}

const SHOP_SECTION_HEADING = "## Kaufpflichtige Shop-Items";
const ITEM_ID = /`([A-Z][A-Z0-9_]+)`/g;
const HAS_ITEM_ID = /`[A-Z][A-Z0-9_]+`/;

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
}

/** Erwartetes Urteil fuer eine Zeile: alle geprueften IDs ausfuehrbar, keine oder gemischt. */
export function expectedVerdict(executable: boolean[]): CollectorVerdict | null {
  if (executable.length === 0) return null;
  if (executable.every(Boolean)) return "ja";
  if (executable.every(value => !value)) return "nein";
  return "teilweise";
}

export function checkItemMatrix(markdown: string, entries: CollectorExecutabilityEntry[]): MatrixCheckResult {
  const lookup = new Map<string, boolean[]>();
  for (const entry of entries) {
    const key = `${entry.source}:${entry.item_id}`;
    lookup.set(key, [...(lookup.get(key) ?? []), entry.executable]);
  }

  const rows: MatrixRowCheck[] = [];
  let source: "reward" | "shop" = "reward";
  let columnIndex = -1;
  const lines = markdown.split("\n");
  lines.forEach((line, index) => {
    if (line.startsWith("## ")) {
      source = line.startsWith(SHOP_SECTION_HEADING) ? "shop" : "reward";
    }
    if (!line.trim().startsWith("|")) {
      columnIndex = -1;
      return;
    }
    const cells = splitRow(line);
    if (columnIndex === -1) {
      // Kopfzeile der Tabelle
      columnIndex = cells.indexOf(COLLECTOR_COLUMN);
      return;
    }
    if (columnIndex < 0 || cells.every(cell => /^-+$/.test(cell))) {
      return;
    }
    // Die Item-Spalte ist die erste Spalte mit Item-IDs (bei den Shop-Items die zweite).
    const itemCell = cells.find(cell => HAS_ITEM_ID.test(cell)) ?? "";
    const itemIds = [...itemCell.matchAll(ITEM_ID)].map(match => match[1]!);
    const results: boolean[] = [];
    const unchecked: string[] = [];
    for (const itemId of itemIds) {
      const values = lookup.get(`${source}:${itemId}`);
      if (values) {
        results.push(...values);
      } else {
        unchecked.push(itemId);
      }
    }
    rows.push({
      line: index + 1,
      item_ids: itemIds,
      source,
      documented: (cells[columnIndex] ?? "").split(/\s/)[0] ?? "",
      expected: expectedVerdict(results),
      unchecked_item_ids: unchecked,
    });
  });

  return {
    rows,
    mismatches: rows.filter(row => row.expected !== null && row.documented !== row.expected),
    unchecked_rows: rows.filter(row => row.expected === null),
  };
}
