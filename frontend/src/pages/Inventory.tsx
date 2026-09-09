import { FormEvent, useEffect, useMemo, useState } from "react";

import { LowStockBadge } from "../components/LowStockBadge";
import {
  archiveInventorySpool,
  buildInventoryCsv,
  createInventorySpool,
  getInventorySourceConfig,
  getInventorySpools,
  updateInventorySpool,
} from "../api/client";
import type { InventorySpool, InventorySpoolInput } from "../types";

const STATUS_OPTIONS = ["In storage", "Loaded", "Low stock", "Empty", "Archived"] as const;
const SORT_OPTIONS = [
  { value: "spoolId", label: "Spool ID" },
  { value: "material", label: "Material" },
  { value: "estimatedRemaining", label: "Remaining" },
  { value: "status", label: "Status" },
] as const;

function createBlankSpool(): InventorySpoolInput {
  return {
    material: "",
    color: "",
    brand: "",
    startingWeight: 1000,
    estimatedRemaining: 1000,
    status: "In storage",
    storageLocation: "",
    loadedPrinter: "",
    dateOpened: "",
    notes: "",
    lowStockThreshold: 200,
  };
}

function createEditableCopy(spool: InventorySpool): InventorySpoolInput {
  return {
    material: spool.material,
    color: spool.color,
    brand: spool.brand,
    startingWeight: spool.startingWeight,
    estimatedRemaining: spool.estimatedRemaining,
    status: spool.status,
    storageLocation: spool.storageLocation,
    loadedPrinter: spool.loadedPrinter,
    dateOpened: spool.dateOpened,
    notes: spool.notes,
    lowStockThreshold: spool.lowStockThreshold,
  };
}

function toNumber(value: string, fallback: number): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getComputedStatus(spool: InventorySpool): string {
  if (spool.status === "Archived") {
    return "Archived";
  }
  if (spool.estimatedRemaining <= 0) {
    return "Empty";
  }
  if (spool.estimatedRemaining <= spool.lowStockThreshold) {
    return "Low stock";
  }
  return spool.status;
}

export function Inventory() {
  const [spools, setSpools] = useState<InventorySpool[]>([]);
  const [drafts, setDrafts] = useState<Record<string, InventorySpoolInput>>({});
  const [newSpool, setNewSpool] = useState<InventorySpoolInput>(createBlankSpool());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortKey, setSortKey] = useState<(typeof SORT_OPTIONS)[number]["value"]>("spoolId");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceConfig = getInventorySourceConfig();
  const hasWriteback = Boolean(sourceConfig.appsScriptUrl);

  const refresh = async () => {
    setLoading(true);
    try {
      const nextSpools = await getInventorySpools();
      setSpools(nextSpools);
      setDrafts(
        nextSpools.reduce<Record<string, InventorySpoolInput>>((nextDrafts, spool) => {
          nextDrafts[spool.spoolId] = createEditableCopy(spool);
          return nextDrafts;
        }, {}),
      );
      setError(null);
    } catch (loadError) {
      setStatusMessage(null);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load inventory sheet.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const displayedSpools = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return [...spools]
      .map((spool) => ({ ...spool, status: getComputedStatus(spool) }))
      .filter((spool) => (showArchived ? true : spool.status !== "Archived"))
      .filter((spool) => (statusFilter === "All" ? true : spool.status === statusFilter))
      .filter((spool) => {
        if (!searchTerm) {
          return true;
        }

        return [
          spool.spoolId,
          spool.material,
          spool.color,
          spool.brand,
          spool.status,
          spool.storageLocation,
          spool.loadedPrinter,
          spool.notes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm);
      })
      .sort((left, right) => {
        if (sortKey === "estimatedRemaining") {
          return left.estimatedRemaining - right.estimatedRemaining;
        }

        if (sortKey === "spoolId") {
          return toNumber(left.spoolId, 0) - toNumber(right.spoolId, 0);
        }

        return left[sortKey].localeCompare(right[sortKey]);
      });
  }, [search, showArchived, sortKey, spools, statusFilter]);

  const stats = useMemo(() => {
    const activeSpools = spools.filter((spool) => getComputedStatus(spool) !== "Archived");
    const lowStockCount = activeSpools.filter(
      (spool) => getComputedStatus(spool) === "Low stock",
    ).length;

    return {
      total: activeSpools.length,
      lowStock: lowStockCount,
      totalWeight: activeSpools.reduce(
        (sum, spool) => sum + spool.estimatedRemaining,
        0,
      ),
    };
  }, [spools]);

  const handleDraftChange = (
    spoolId: string,
    field: keyof InventorySpoolInput,
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [spoolId]: {
        ...current[spoolId],
        [field]:
          field === "startingWeight" ||
          field === "estimatedRemaining" ||
          field === "lowStockThreshold"
            ? toNumber(value, 0)
            : value,
      },
    }));
  };

  const handleNewSpoolChange = (
    field: keyof InventorySpoolInput,
    value: string,
  ) => {
    setNewSpool((current) => ({
      ...current,
      [field]:
        field === "startingWeight" ||
        field === "estimatedRemaining" ||
        field === "lowStockThreshold"
          ? toNumber(value, 0)
          : value,
    }));
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setError(null);
      await createInventorySpool(newSpool);
      setNewSpool(createBlankSpool());
      setStatusMessage("Spool added to the Google Sheet.");
      await refresh();
    } catch (submitError) {
      setStatusMessage(null);
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create spool.",
      );
    }
  };

  const handleSave = async (spoolId: string) => {
    const draft = drafts[spoolId];
    if (!draft) {
      return;
    }

    try {
      setSavingId(spoolId);
      setError(null);
      await updateInventorySpool(spoolId, draft);
      setStatusMessage(`Spool #${spoolId} updated in the sheet.`);
      await refresh();
    } catch (submitError) {
      setStatusMessage(null);
      setError(
        submitError instanceof Error ? submitError.message : "Failed to update spool.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleArchive = async (spoolId: string) => {
    try {
      setSavingId(spoolId);
      setError(null);
      await archiveInventorySpool(spoolId);
      setStatusMessage(`Spool #${spoolId} archived.`);
      await refresh();
    } catch (submitError) {
      setStatusMessage(null);
      setError(
        submitError instanceof Error ? submitError.message : "Failed to archive spool.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleResetDraft = (spool: InventorySpool) => {
    setDrafts((current) => ({
      ...current,
      [spool.spoolId]: createEditableCopy(spool),
    }));
  };

  const handleExport = () => {
    downloadCsv("material-inventory-sheet-view.csv", buildInventoryCsv(spools));
    setStatusMessage("Sheet-view CSV exported.");
  };

  return (
    <div className="stack-lg">
      <section className="card stack-sm">
        <div className="row-between gap-sm wrap">
          <div className="stack-xs">
            <h2>Sheet connection</h2>
            <p className="muted">
              Reads from a published Google Sheet CSV and writes back through a Google
              Apps Script web app.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()}>
            Sync from sheet
          </button>
        </div>
        <dl className="stats-grid source-grid">
          <div>
            <dt>CSV feed</dt>
            <dd>{sourceConfig.csvUrl ?? "Not configured"}</dd>
          </div>
          <div>
            <dt>Write-back endpoint</dt>
            <dd>{sourceConfig.appsScriptUrl ?? "Not configured"}</dd>
          </div>
        </dl>
        {!hasWriteback ? (
          <p className="muted">
            Configure <code>VITE_GOOGLE_APPS_SCRIPT_URL</code> to enable adding,
            editing, and archiving rows.
          </p>
        ) : null}
      </section>

      {statusMessage ? <p className="success-banner">{statusMessage}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p>Loading inventory…</p> : null}

      <section className="grid cards-3">
        <article className="card stack-xs">
          <h3>Active spools</h3>
          <p className="metric">{stats.total}</p>
        </article>
        <article className="card stack-xs">
          <h3>Low stock</h3>
          <p className="metric">{stats.lowStock}</p>
        </article>
        <article className="card stack-xs">
          <h3>Remaining filament</h3>
          <p className="metric">{stats.totalWeight}g</p>
        </article>
      </section>

      <section className="grid cards-2 inventory-panels">
        <form className="card stack-sm" onSubmit={handleCreate}>
          <div className="row-between gap-sm wrap">
            <h2>Add spool</h2>
            <button type="submit" disabled={!hasWriteback}>
              Add to sheet
            </button>
          </div>
          <div className="grid cards-2 compact-grid">
            <label className="stack-xs">
              <span>Material</span>
              <input
                required
                value={newSpool.material}
                onChange={(event) => handleNewSpoolChange("material", event.target.value)}
              />
            </label>
            <label className="stack-xs">
              <span>Color</span>
              <input
                value={newSpool.color}
                onChange={(event) => handleNewSpoolChange("color", event.target.value)}
              />
            </label>
            <label className="stack-xs">
              <span>Brand</span>
              <input
                value={newSpool.brand}
                onChange={(event) => handleNewSpoolChange("brand", event.target.value)}
              />
            </label>
            <label className="stack-xs">
              <span>Status</span>
              <select
                value={newSpool.status}
                onChange={(event) => handleNewSpoolChange("status", event.target.value)}
              >
                {STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-xs">
              <span>Starting Weight (g)</span>
              <input
                min="0"
                required
                type="number"
                value={newSpool.startingWeight}
                onChange={(event) =>
                  handleNewSpoolChange("startingWeight", event.target.value)
                }
              />
            </label>
            <label className="stack-xs">
              <span>Estimated Remaining (g)</span>
              <input
                min="0"
                required
                type="number"
                value={newSpool.estimatedRemaining}
                onChange={(event) =>
                  handleNewSpoolChange("estimatedRemaining", event.target.value)
                }
              />
            </label>
            <label className="stack-xs">
              <span>Low Stock Threshold (g)</span>
              <input
                min="0"
                required
                type="number"
                value={newSpool.lowStockThreshold}
                onChange={(event) =>
                  handleNewSpoolChange("lowStockThreshold", event.target.value)
                }
              />
            </label>
            <label className="stack-xs">
              <span>Date Opened</span>
              <input
                type="date"
                value={newSpool.dateOpened}
                onChange={(event) => handleNewSpoolChange("dateOpened", event.target.value)}
              />
            </label>
            <label className="stack-xs">
              <span>Storage Location</span>
              <input
                value={newSpool.storageLocation}
                onChange={(event) =>
                  handleNewSpoolChange("storageLocation", event.target.value)
                }
              />
            </label>
            <label className="stack-xs">
              <span>Loaded Printer</span>
              <input
                value={newSpool.loadedPrinter}
                onChange={(event) =>
                  handleNewSpoolChange("loadedPrinter", event.target.value)
                }
              />
            </label>
          </div>
          <label className="stack-xs">
            <span>Notes</span>
            <textarea
              rows={3}
              value={newSpool.notes}
              onChange={(event) => handleNewSpoolChange("notes", event.target.value)}
            />
          </label>
        </form>

        <article className="card stack-sm">
          <div className="row-between gap-sm wrap">
            <h2>Inventory tools</h2>
            <button type="button" onClick={handleExport} disabled={spools.length === 0}>
              Export CSV
            </button>
          </div>
          <div className="grid cards-2 compact-grid">
            <label className="stack-xs">
              <span>Search</span>
              <input
                placeholder="Material, brand, notes, location…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="stack-xs">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All</option>
                {STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-xs">
              <span>Sort by</span>
              <select
                value={sortKey}
                onChange={(event) =>
                  setSortKey(event.target.value as (typeof SORT_OPTIONS)[number]["value"])
                }
              >
                {SORT_OPTIONS.map((sortOption) => (
                  <option key={sortOption.value} value={sortOption.value}>
                    {sortOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack-xs">
              <span>Archived rows</span>
              <select
                value={showArchived ? "show" : "hide"}
                onChange={(event) => setShowArchived(event.target.value === "show")}
              >
                <option value="hide">Hide archived</option>
                <option value="show">Show archived</option>
              </select>
            </label>
          </div>
          <div className="row gap-sm wrap">
            <button type="button" onClick={() => setStatusFilter("Low stock")}>
              Quick view: low stock
            </button>
            <button type="button" onClick={() => setStatusFilter("Empty")}>
              Quick view: empty
            </button>
            <button type="button" onClick={() => setStatusFilter("All")}>
              Clear filters
            </button>
          </div>
        </article>
      </section>

      <section className="card stack-sm">
        <div className="row-between gap-sm wrap">
          <h2>Interactive sheet view</h2>
          <p className="muted">
            Edit a row, then save it back to the Google Sheet.
          </p>
        </div>
        {displayedSpools.length === 0 && !loading ? (
          <p className="muted">No matching spools found.</p>
        ) : (
          <div className="table-scroll">
            <table className="inventory-table editable-table">
              <thead>
                <tr>
                  <th>Spool ID</th>
                  <th>Material</th>
                  <th>Color</th>
                  <th>Brand</th>
                  <th>Starting</th>
                  <th>Remaining</th>
                  <th>Threshold</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Printer</th>
                  <th>Date Opened</th>
                  <th>Notes</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedSpools.map((spool) => {
                  const draft = drafts[spool.spoolId] ?? createEditableCopy(spool);
                  return (
                    <tr key={spool.spoolId}>
                      <td>{spool.spoolId}</td>
                      <td>
                        <input
                          value={draft.material}
                          onChange={(event) =>
                            handleDraftChange(spool.spoolId, "material", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={draft.color}
                          onChange={(event) =>
                            handleDraftChange(spool.spoolId, "color", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={draft.brand}
                          onChange={(event) =>
                            handleDraftChange(spool.spoolId, "brand", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          min="0"
                          type="number"
                          value={draft.startingWeight}
                          onChange={(event) =>
                            handleDraftChange(
                              spool.spoolId,
                              "startingWeight",
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          min="0"
                          type="number"
                          value={draft.estimatedRemaining}
                          onChange={(event) =>
                            handleDraftChange(
                              spool.spoolId,
                              "estimatedRemaining",
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          min="0"
                          type="number"
                          value={draft.lowStockThreshold}
                          onChange={(event) =>
                            handleDraftChange(
                              spool.spoolId,
                              "lowStockThreshold",
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            handleDraftChange(spool.spoolId, "status", event.target.value)
                          }
                        >
                          {STATUS_OPTIONS.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>
                              {statusOption}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={draft.storageLocation}
                          onChange={(event) =>
                            handleDraftChange(
                              spool.spoolId,
                              "storageLocation",
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={draft.loadedPrinter}
                          onChange={(event) =>
                            handleDraftChange(
                              spool.spoolId,
                              "loadedPrinter",
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={draft.dateOpened}
                          onChange={(event) =>
                            handleDraftChange(
                              spool.spoolId,
                              "dateOpened",
                              event.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <textarea
                          rows={2}
                          value={draft.notes}
                          onChange={(event) =>
                            handleDraftChange(spool.spoolId, "notes", event.target.value)
                          }
                        />
                      </td>
                      <td>
                        {spool.status === "Archived" ? (
                          <span className="badge badge-neutral">Archived</span>
                        ) : (
                          <LowStockBadge
                            currentWeight={spool.estimatedRemaining}
                            threshold={spool.lowStockThreshold}
                          />
                        )}
                      </td>
                      <td>
                        <div className="stack-xs row-actions">
                          <button
                            type="button"
                            disabled={!hasWriteback || savingId === spool.spoolId}
                            onClick={() => void handleSave(spool.spoolId)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="button-secondary"
                            onClick={() => handleResetDraft(spool)}
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            className="button-danger"
                            disabled={!hasWriteback || savingId === spool.spoolId}
                            onClick={() => void handleArchive(spool.spoolId)}
                          >
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
