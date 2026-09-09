import { FormEvent, useEffect, useState } from "react";

import {
  assignSpoolToMachine,
  createMaterial,
  createSpool,
  getMachines,
  getMaterials,
  getSpools,
  unassignSpoolFromMachine,
} from "../api/client";
import { SpoolCard } from "../components/SpoolCard";
import type { Machine, Material, Spool } from "../types";

async function loadInventoryData() {
  const [materials, spools, machines] = await Promise.all([
    getMaterials(),
    getSpools(),
    getMachines(),
  ]);
  return { materials, spools, machines };
}

export function Inventory() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [spools, setSpools] = useState<Spool[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySpoolId, setBusySpoolId] = useState<number | null>(null);
  const [newMaterial, setNewMaterial] = useState({ name: "", color: "" });
  const [newSpool, setNewSpool] = useState({
    material_id: "",
    original_filament_weight: "1000",
    empty_spool_weight: "100",
    low_stock_threshold: "200",
    user_id: "teacher",
  });
  const [machineSelections, setMachineSelections] = useState<Record<number, string>>({});

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await loadInventoryData();
      setMaterials(data.materials);
      setSpools(data.spools);
      setMachines(data.machines);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load inventory.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleCreateMaterial = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createMaterial({
        name: newMaterial.name.trim(),
        color: newMaterial.color.trim() || undefined,
      });
      setNewMaterial({ name: "", color: "" });
      setStatusMessage("Material created.");
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create material.",
      );
    }
  };

  const handleCreateSpool = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createSpool({
        material_id: Number(newSpool.material_id),
        original_filament_weight: Number(newSpool.original_filament_weight),
        empty_spool_weight: Number(newSpool.empty_spool_weight),
        low_stock_threshold: Number(newSpool.low_stock_threshold),
        user_id: newSpool.user_id.trim(),
      });
      setStatusMessage("Spool created.");
      setNewSpool((current) => ({
        ...current,
        original_filament_weight: "1000",
        empty_spool_weight: "100",
        low_stock_threshold: "200",
      }));
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create spool.",
      );
    }
  };

  const handleAssign = async (spoolId: number) => {
    const selectedMachineId = machineSelections[spoolId];
    if (!selectedMachineId) {
      setError("Select a machine before assigning a spool.");
      return;
    }

    try {
      setBusySpoolId(spoolId);
      await assignSpoolToMachine({
        spoolId,
        machine_id: Number(selectedMachineId),
        user_id: newSpool.user_id.trim(),
      });
      setStatusMessage(`Spool #${spoolId} assigned.`);
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to assign spool.",
      );
    } finally {
      setBusySpoolId(null);
    }
  };

  const handleUnassign = async (spoolId: number) => {
    try {
      setBusySpoolId(spoolId);
      await unassignSpoolFromMachine({
        spoolId,
        user_id: newSpool.user_id.trim(),
      });
      setStatusMessage(`Spool #${spoolId} unassigned.`);
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to unassign spool.",
      );
    } finally {
      setBusySpoolId(null);
    }
  };

  return (
    <div className="stack-lg">
      <section className="grid cards-2">
        <form className="card stack-sm" onSubmit={handleCreateMaterial}>
          <h2>Create material</h2>
          <label className="stack-xs">
            <span>Name</span>
            <input
              required
              value={newMaterial.name}
              onChange={(event) =>
                setNewMaterial((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label className="stack-xs">
            <span>Color</span>
            <input
              value={newMaterial.color}
              onChange={(event) =>
                setNewMaterial((current) => ({ ...current, color: event.target.value }))
              }
            />
          </label>
          <button type="submit">Add material</button>
        </form>

        <form className="card stack-sm" onSubmit={handleCreateSpool}>
          <h2>Create spool</h2>
          <label className="stack-xs">
            <span>Material</span>
            <select
              required
              value={newSpool.material_id}
              onChange={(event) =>
                setNewSpool((current) => ({ ...current, material_id: event.target.value }))
              }
            >
              <option value="">Select a material</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                  {material.color ? ` · ${material.color}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="grid cards-2 compact-grid">
            <label className="stack-xs">
              <span>Filament weight (g)</span>
              <input
                required
                min="1"
                type="number"
                value={newSpool.original_filament_weight}
                onChange={(event) =>
                  setNewSpool((current) => ({
                    ...current,
                    original_filament_weight: event.target.value,
                  }))
                }
              />
            </label>
            <label className="stack-xs">
              <span>Empty spool weight (g)</span>
              <input
                required
                min="0"
                type="number"
                value={newSpool.empty_spool_weight}
                onChange={(event) =>
                  setNewSpool((current) => ({
                    ...current,
                    empty_spool_weight: event.target.value,
                  }))
                }
              />
            </label>
            <label className="stack-xs">
              <span>Low-stock threshold (g)</span>
              <input
                required
                min="0"
                type="number"
                value={newSpool.low_stock_threshold}
                onChange={(event) =>
                  setNewSpool((current) => ({
                    ...current,
                    low_stock_threshold: event.target.value,
                  }))
                }
              />
            </label>
            <label className="stack-xs">
              <span>Recorded by</span>
              <input
                required
                value={newSpool.user_id}
                onChange={(event) =>
                  setNewSpool((current) => ({ ...current, user_id: event.target.value }))
                }
              />
            </label>
          </div>
          <button type="submit" disabled={materials.length === 0}>
            Add spool
          </button>
          {materials.length === 0 ? (
            <p className="muted">Create a material first.</p>
          ) : null}
        </form>
      </section>

      {statusMessage ? <p className="success-banner">{statusMessage}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p>Loading inventory…</p> : null}

      <section className="stack-md">
        <h2>Spools</h2>
        {spools.length === 0 && !loading ? (
          <p className="muted">No spools yet.</p>
        ) : (
          <div className="grid cards-2">
            {spools.map((spool) => (
              <div key={spool.id} className="stack-sm">
                <SpoolCard spool={spool} />
                <div className="card stack-sm surface-muted">
                  <label className="stack-xs">
                    <span>Assign to machine</span>
                    <select
                      value={machineSelections[spool.id] ?? ""}
                      onChange={(event) =>
                        setMachineSelections((current) => ({
                          ...current,
                          [spool.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select machine</option>
                      {machines.map((machine) => (
                        <option key={machine.id} value={machine.id}>
                          {machine.name} ({machine.status})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="row gap-sm wrap">
                    <button
                      type="button"
                      disabled={busySpoolId === spool.id || machines.length === 0}
                      onClick={() => void handleAssign(spool.id)}
                    >
                      Assign
                    </button>
                    <button
                      type="button"
                      disabled={busySpoolId === spool.id || spool.current_machine_id === null}
                      onClick={() => void handleUnassign(spool.id)}
                    >
                      Unassign
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
