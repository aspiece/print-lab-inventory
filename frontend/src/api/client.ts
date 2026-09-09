import type { InventorySourceConfig, InventorySpool, InventorySpoolInput } from "../types";

export const INVENTORY_SHEET_HEADERS = [
  "Spool ID",
  "Material",
  "Color",
  "Brand",
  "Starting Weight (g)",
  "Estimated Remaining (g)",
  "Status",
  "Storage Location",
  "Loaded Printer",
  "Date Opened",
  "Notes",
  "Low Stock Threshold (g)",
] as const;

const configuredCsvUrl = import.meta.env.VITE_GOOGLE_SHEET_CSV_URL?.trim() ?? "";
const configuredAppsScriptUrl =
  import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL?.trim() ?? "";

function normalizeUrl(value: string): string | null {
  return value ? value.replace(/\/$/, "") : null;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizeDateValue(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  const isoDateMatch = trimmedValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
  }

  const slashDateMatch = trimmedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashDateMatch) {
    const month = slashDateMatch[1].padStart(2, "0");
    const day = slashDateMatch[2].padStart(2, "0");
    return `${slashDateMatch[3]}-${month}-${day}`;
  }

  const parsedDate = new Date(trimmedValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  const normalizedText = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];

    if (character === '"') {
      if (inQuotes && normalizedText[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && normalizedText[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentValue.trim());
      if (currentRow.some((value) => value.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  currentRow.push(currentValue.trim());
  if (currentRow.some((value) => value.length > 0)) {
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return [];
  }

  const [headers, ...dataRows] = rows;

  return dataRows.map((values) => {
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function mapRecordToSpool(record: Record<string, string>): InventorySpool {
  const normalizedEntries = new Map(
    Object.entries(record).map(([key, value]) => [normalizeHeader(key), value]),
  );

  return {
    spoolId: normalizedEntries.get(normalizeHeader("Spool ID")) ?? "",
    material: normalizedEntries.get(normalizeHeader("Material")) ?? "",
    color: normalizedEntries.get(normalizeHeader("Color")) ?? "",
    brand: normalizedEntries.get(normalizeHeader("Brand")) ?? "",
    startingWeight: parseNumber(
      normalizedEntries.get(normalizeHeader("Starting Weight (g)")),
      0,
    ),
    estimatedRemaining: parseNumber(
      normalizedEntries.get(normalizeHeader("Estimated Remaining (g)")),
      0,
    ),
    status: normalizedEntries.get(normalizeHeader("Status")) ?? "In storage",
    storageLocation:
      normalizedEntries.get(normalizeHeader("Storage Location")) ?? "",
    loadedPrinter: normalizedEntries.get(normalizeHeader("Loaded Printer")) ?? "",
    dateOpened: normalizeDateValue(normalizedEntries.get(normalizeHeader("Date Opened"))),
    notes: normalizedEntries.get(normalizeHeader("Notes")) ?? "",
    lowStockThreshold: parseNumber(
      normalizedEntries.get(normalizeHeader("Low Stock Threshold (g)")),
      200,
    ),
  };
}

function serializeCsvValue(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function toRowValues(
  spool: InventorySpool | InventorySpoolInput,
  spoolId?: string,
): Array<string | number> {
  return [
    spoolId ?? ("spoolId" in spool ? spool.spoolId : ""),
    spool.material,
    spool.color,
    spool.brand,
    spool.startingWeight,
    spool.estimatedRemaining,
    spool.status,
    spool.storageLocation,
    spool.loadedPrinter,
    spool.dateOpened,
    spool.notes,
    spool.lowStockThreshold,
  ];
}

export function getInventorySourceConfig(): InventorySourceConfig {
  return {
    csvUrl: normalizeUrl(configuredCsvUrl),
    appsScriptUrl: normalizeUrl(configuredAppsScriptUrl),
  };
}

export function buildInventoryCsv(spools: InventorySpool[]): string {
  const rows = spools.map((spool) => toRowValues(spool));
  return [INVENTORY_SHEET_HEADERS, ...rows]
    .map((row) => row.map((value) => serializeCsvValue(value)).join(","))
    .join("\n");
}

async function fetchInventoryFromCsv(csvUrl: string): Promise<InventorySpool[]> {
  const response = await fetch(csvUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load the published Google Sheet CSV.");
  }

  const text = await response.text();
  return parseCsv(text)
    .map(mapRecordToSpool)
    .filter((spool) => spool.spoolId || spool.material);
}

async function requestAppsScript<T>(
  payload: Record<string, unknown>,
  method: "GET" | "POST" = "POST",
): Promise<T> {
  const { appsScriptUrl } = getInventorySourceConfig();
  if (!appsScriptUrl) {
    throw new Error("Set VITE_GOOGLE_APPS_SCRIPT_URL to enable sheet write-back.");
  }

  const requestUrl =
    method === "GET"
      ? `${appsScriptUrl}?${new URLSearchParams(
          Object.entries(payload).reduce<Record<string, string>>((params, [key, value]) => {
            params[key] = String(value);
            return params;
          }, {}),
        ).toString()}`
      : appsScriptUrl;

  const response = await fetch(requestUrl, {
    method,
    headers:
      method === "POST"
        ? { "Content-Type": "text/plain;charset=utf-8" }
        : undefined,
    body: method === "POST" ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
    throw new Error("Google Apps Script request failed.");
  }

  const result = (await response.json()) as { ok?: boolean; data?: T; error?: string };
  if (result.ok === false) {
    throw new Error(result.error ?? "Google Apps Script request failed.");
  }

  if (result.data === undefined) {
    throw new Error("Google Apps Script returned no data.");
  }

  return result.data;
}

export async function getInventorySpools(): Promise<InventorySpool[]> {
  const { csvUrl, appsScriptUrl } = getInventorySourceConfig();

  if (csvUrl) {
    return fetchInventoryFromCsv(csvUrl);
  }

  if (appsScriptUrl) {
    const data = await requestAppsScript<{ spools: InventorySpool[] }>(
      { action: "list" },
      "GET",
    );
    return data.spools;
  }

  throw new Error(
    "Set VITE_GOOGLE_SHEET_CSV_URL for reads and VITE_GOOGLE_APPS_SCRIPT_URL for edits.",
  );
}

export async function createInventorySpool(payload: InventorySpoolInput): Promise<void> {
  await requestAppsScript({ action: "create", spool: payload });
}

export async function updateInventorySpool(
  spoolId: string,
  changes: InventorySpoolInput,
): Promise<void> {
  await requestAppsScript({ action: "update", spoolId, spool: changes });
}

export async function archiveInventorySpool(spoolId: string): Promise<void> {
  await requestAppsScript({ action: "archive", spoolId });
}
