export interface InventorySpool {
  spoolId: string;
  material: string;
  color: string;
  brand: string;
  startingWeight: number;
  estimatedRemaining: number;
  status: string;
  storageLocation: string;
  loadedPrinter: string;
  dateOpened: string;
  notes: string;
  lowStockThreshold: number;
}

export interface InventorySpoolInput {
  material: string;
  color: string;
  brand: string;
  startingWeight: number;
  estimatedRemaining: number;
  status: string;
  storageLocation: string;
  loadedPrinter: string;
  dateOpened: string;
  notes: string;
  lowStockThreshold: number;
}

export interface InventorySourceConfig {
  csvUrl: string | null;
  appsScriptUrl: string | null;
}
