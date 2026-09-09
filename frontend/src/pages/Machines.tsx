import { FormEvent, useEffect, useState } from "react";

import { createMachine, getMachines } from "../api/client";
import type { Machine } from "../types";

export function Machines() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMachine, setNewMachine] = useState({ name: "", status: "online" });

  const refresh = async () => {
    setLoading(true);
    try {
      const nextMachines = await getMachines();
      setMachines(nextMachines);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load machines.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createMachine(newMachine);
      setNewMachine({ name: "", status: "online" });
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create machine.",
      );
    }
  };

  return (
    <div className="stack-lg">
      <form className="card stack-sm" onSubmit={handleSubmit}>
        <h2>Add machine</h2>
        <label className="stack-xs">
          <span>Name</span>
          <input
            required
            value={newMachine.name}
            onChange={(event) =>
              setNewMachine((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>
        <label className="stack-xs">
          <span>Status</span>
          <select
            value={newMachine.status}
            onChange={(event) =>
              setNewMachine((current) => ({ ...current, status: event.target.value }))
            }
          >
            <option value="online">online</option>
            <option value="offline">offline</option>
          </select>
        </label>
        <button type="submit">Create machine</button>
      </form>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p>Loading machines…</p> : null}

      <section className="grid cards-2">
        {machines.map((machine) => (
          <article key={machine.id} className="card stack-xs">
            <h3>{machine.name}</h3>
            <p>Status: {machine.status}</p>
            <p>
              Assigned spool: {machine.current_spool_id ? `#${machine.current_spool_id}` : "None"}
            </p>
            {machine.current_spool_material_name ? (
              <p>
                Material: {machine.current_spool_material_name} · Available: {machine.current_spool_available}g
              </p>
            ) : null}
          </article>
        ))}
        {!loading && machines.length === 0 ? (
          <p className="muted">No machines added yet.</p>
        ) : null}
      </section>
    </div>
  );
}
