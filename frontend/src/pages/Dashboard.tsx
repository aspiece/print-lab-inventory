import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  getConfiguredApiBaseUrl,
  getMachines,
  getPrintRequests,
  getSpools,
} from "../api/client";
import { SpoolCard } from "../components/SpoolCard";
import type { Machine, PrintRequest, Spool } from "../types";

export function Dashboard() {
  const [spools, setSpools] = useState<Spool[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [requests, setRequests] = useState<PrintRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [nextSpools, nextMachines, nextRequests] = await Promise.all([
          getSpools(),
          getMachines(),
          getPrintRequests(),
        ]);

        if (!cancelled) {
          setSpools(nextSpools);
          setMachines(nextMachines);
          setRequests(nextRequests);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load dashboard.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const lowStockSpools = spools.filter(
    (spool) => spool.current_weight <= spool.low_stock_threshold,
  );
  const activeReservations = requests.filter(
    (request) => request.active_reservation_id !== null,
  );

  return (
    <div className="stack-lg">
      <section className="card stack-sm">
        <h2>Hosted setup</h2>
        <p>
          Frontend base path is configured for GitHub Pages. API target: {" "}
          <strong>{getConfiguredApiBaseUrl() ?? "Not configured"}</strong>
        </p>
        <p className="muted">
          Set <code>VITE_API_BASE_URL</code> in your GitHub repository variables to
          point at the deployed FastAPI backend.
        </p>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p>Loading dashboard…</p> : null}

      <section className="grid cards-3">
        <article className="card stack-xs">
          <h3>Spools</h3>
          <p className="metric">{spools.length}</p>
          <Link to="/inventory">Open inventory</Link>
        </article>
        <article className="card stack-xs">
          <h3>Machines</h3>
          <p className="metric">{machines.length}</p>
          <Link to="/machines">Open machines</Link>
        </article>
        <article className="card stack-xs">
          <h3>Requests</h3>
          <p className="metric">{requests.length}</p>
          <Link to="/requests">Open requests</Link>
        </article>
      </section>

      <section className="grid cards-2">
        <article className="card stack-sm">
          <h3>Low-stock spools</h3>
          {lowStockSpools.length === 0 ? (
            <p className="muted">No low-stock spools right now.</p>
          ) : (
            lowStockSpools.map((spool) => <SpoolCard key={spool.id} spool={spool} />)
          )}
        </article>
        <article className="card stack-sm">
          <h3>Active reservations</h3>
          {activeReservations.length === 0 ? (
            <p className="muted">No active reservations.</p>
          ) : (
            <ul className="stack-sm plain-list">
              {activeReservations.map((request) => (
                <li key={request.id} className="card surface-muted stack-xs">
                  <strong>{request.project_name}</strong>
                  <span>
                    {request.material_name} · {request.amount_required}g on spool #
                    {request.reserved_spool_id}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
