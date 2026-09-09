import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { correctSpoolEvent, getSpool, updateSpoolWeight } from "../api/client";
import { LowStockBadge } from "../components/LowStockBadge";
import type { SpoolDetail as SpoolDetailType } from "../types";

export function SpoolDetail() {
  const params = useParams();
  const spoolId = Number(params.id);
  const [spool, setSpool] = useState<SpoolDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weightForm, setWeightForm] = useState({ user_id: "teacher", amount: "50" });
  const [scaleForm, setScaleForm] = useState({ user_id: "teacher", new_total_weight: "700" });
  const [correctionForm, setCorrectionForm] = useState({
    user_id: "teacher",
    related_event_id: "",
    amount: "0",
    reason: "",
  });

  const refresh = async () => {
    if (!Number.isFinite(spoolId)) {
      setError("Invalid spool id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextSpool = await getSpool(spoolId);
      setSpool(nextSpool);
      setError(null);
      if (nextSpool.inventory_history[0]) {
        setCorrectionForm((current) => ({
          ...current,
          related_event_id: String(nextSpool.inventory_history[0].id),
        }));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load spool.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [spoolId]);

  const handleUseFilament = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await updateSpoolWeight(spoolId, {
        mode: "use_filament",
        user_id: weightForm.user_id,
        amount: Number(weightForm.amount),
      });
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to update spool.",
      );
    }
  };

  const handleScaleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await updateSpoolWeight(spoolId, {
        mode: "set_total_weight",
        user_id: scaleForm.user_id,
        new_total_weight: Number(scaleForm.new_total_weight),
      });
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to record scale reading.",
      );
    }
  };

  const handleCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await correctSpoolEvent({
        spoolId,
        user_id: correctionForm.user_id,
        related_event_id: Number(correctionForm.related_event_id),
        amount: Number(correctionForm.amount),
        reason: correctionForm.reason,
      });
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create correction.",
      );
    }
  };

  if (loading) {
    return <p>Loading spool…</p>;
  }

  if (error) {
    return <p className="error-banner">{error}</p>;
  }

  if (!spool) {
    return <p className="muted">Spool not found.</p>;
  }

  return (
    <div className="stack-lg">
      <div className="row-between gap-sm wrap">
        <div>
          <p>
            <Link to="/inventory">← Back to inventory</Link>
          </p>
          <h2>Spool #{spool.id}</h2>
          <p>
            {spool.material_name}
            {spool.material_color ? ` · ${spool.material_color}` : ""}
          </p>
        </div>
        <LowStockBadge
          currentWeight={spool.current_weight}
          threshold={spool.low_stock_threshold}
        />
      </div>

      <section className="grid cards-3">
        <article className="card stack-xs">
          <h3>Current weight</h3>
          <p className="metric">{spool.current_weight}g</p>
        </article>
        <article className="card stack-xs">
          <h3>Available</h3>
          <p className="metric">{spool.available}g</p>
        </article>
        <article className="card stack-xs">
          <h3>Machine</h3>
          <p className="metric">{spool.current_machine_id ?? "None"}</p>
        </article>
      </section>

      <section className="grid cards-3">
        <form className="card stack-sm" onSubmit={handleUseFilament}>
          <h3>Record filament used</h3>
          <label className="stack-xs">
            <span>User</span>
            <input
              required
              value={weightForm.user_id}
              onChange={(event) =>
                setWeightForm((current) => ({ ...current, user_id: event.target.value }))
              }
            />
          </label>
          <label className="stack-xs">
            <span>Amount used (g)</span>
            <input
              required
              min="1"
              type="number"
              value={weightForm.amount}
              onChange={(event) =>
                setWeightForm((current) => ({ ...current, amount: event.target.value }))
              }
            />
          </label>
          <button type="submit">Record usage</button>
        </form>

        <form className="card stack-sm" onSubmit={handleScaleUpdate}>
          <h3>Record scale reading</h3>
          <label className="stack-xs">
            <span>User</span>
            <input
              required
              value={scaleForm.user_id}
              onChange={(event) =>
                setScaleForm((current) => ({ ...current, user_id: event.target.value }))
              }
            />
          </label>
          <label className="stack-xs">
            <span>New total scale weight (g)</span>
            <input
              required
              min="0"
              type="number"
              value={scaleForm.new_total_weight}
              onChange={(event) =>
                setScaleForm((current) => ({
                  ...current,
                  new_total_weight: event.target.value,
                }))
              }
            />
          </label>
          <button type="submit">Save reading</button>
        </form>

        <form className="card stack-sm" onSubmit={handleCorrection}>
          <h3>Correct event</h3>
          <label className="stack-xs">
            <span>User</span>
            <input
              required
              value={correctionForm.user_id}
              onChange={(event) =>
                setCorrectionForm((current) => ({ ...current, user_id: event.target.value }))
              }
            />
          </label>
          <label className="stack-xs">
            <span>Event id</span>
            <input
              required
              min="1"
              type="number"
              value={correctionForm.related_event_id}
              onChange={(event) =>
                setCorrectionForm((current) => ({
                  ...current,
                  related_event_id: event.target.value,
                }))
              }
            />
          </label>
          <label className="stack-xs">
            <span>Correction amount (g)</span>
            <input
              required
              type="number"
              value={correctionForm.amount}
              onChange={(event) =>
                setCorrectionForm((current) => ({ ...current, amount: event.target.value }))
              }
            />
          </label>
          <label className="stack-xs">
            <span>Reason</span>
            <input
              required
              value={correctionForm.reason}
              onChange={(event) =>
                setCorrectionForm((current) => ({ ...current, reason: event.target.value }))
              }
            />
          </label>
          <button type="submit">Create correction</button>
        </form>
      </section>

      <section className="grid cards-2">
        <article className="card stack-sm">
          <h3>Inventory history</h3>
          <ul className="plain-list stack-sm">
            {spool.inventory_history.map((event) => (
              <li key={event.id} className="surface-muted card stack-xs">
                <strong>
                  #{event.id} · {event.event_type}
                </strong>
                <span>
                  Δ {event.quantity_change ?? "—"}g · user {event.user_id}
                </span>
                <span>{new Date(event.created_at).toLocaleString()}</span>
                {event.note ? <span>{event.note}</span> : null}
              </li>
            ))}
          </ul>
        </article>
        <article className="card stack-sm">
          <h3>Reservation history</h3>
          {spool.reservation_history.length === 0 ? (
            <p className="muted">No reservation events yet.</p>
          ) : (
            <ul className="plain-list stack-sm">
              {spool.reservation_history.map((event) => (
                <li key={event.id} className="surface-muted card stack-xs">
                  <strong>
                    #{event.id} · {event.event_type}
                  </strong>
                  <span>
                    Request #{event.print_request_id} · {event.amount}g
                  </span>
                  <span>{new Date(event.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
