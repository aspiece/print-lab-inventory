import { FormEvent, useEffect, useState } from "react";

import {
  createPrintRequest,
  fulfillRequest,
  getMaterials,
  getPrintRequests,
  getSpools,
  releaseReservation,
  reserveForRequest,
} from "../api/client";
import { ReservationForm } from "../components/ReservationForm";
import type { Material, PrintRequest, Spool } from "../types";

async function loadRequestPageData() {
  const [materials, requests, spools] = await Promise.all([
    getMaterials(),
    getPrintRequests(),
    getSpools(),
  ]);
  return { materials, requests, spools };
}

export function PrintRequests() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [requests, setRequests] = useState<PrintRequest[]>([]);
  const [spools, setSpools] = useState<Spool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<number | null>(null);
  const [newRequest, setNewRequest] = useState({
    requested_by: "student",
    project_name: "",
    material_id: "",
    amount_required: "100",
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await loadRequestPageData();
      setMaterials(data.materials);
      setRequests(data.requests);
      setSpools(data.spools);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load requests.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createPrintRequest({
        requested_by: newRequest.requested_by.trim(),
        project_name: newRequest.project_name.trim(),
        material_id: Number(newRequest.material_id),
        amount_required: Number(newRequest.amount_required),
      });
      setNewRequest((current) => ({
        ...current,
        project_name: "",
        amount_required: "100",
      }));
      await refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to create request.",
      );
    }
  };

  const runAction = async (requestId: number, action: () => Promise<void>) => {
    try {
      setBusyRequestId(requestId);
      await action();
      await refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Request action failed.",
      );
    } finally {
      setBusyRequestId(null);
    }
  };

  return (
    <div className="stack-lg">
      <form className="card stack-sm" onSubmit={handleCreate}>
        <h2>Create print request</h2>
        <div className="grid cards-2 compact-grid">
          <label className="stack-xs">
            <span>Requested by</span>
            <input
              required
              value={newRequest.requested_by}
              onChange={(event) =>
                setNewRequest((current) => ({
                  ...current,
                  requested_by: event.target.value,
                }))
              }
            />
          </label>
          <label className="stack-xs">
            <span>Project name</span>
            <input
              required
              value={newRequest.project_name}
              onChange={(event) =>
                setNewRequest((current) => ({
                  ...current,
                  project_name: event.target.value,
                }))
              }
            />
          </label>
          <label className="stack-xs">
            <span>Material</span>
            <select
              required
              value={newRequest.material_id}
              onChange={(event) =>
                setNewRequest((current) => ({
                  ...current,
                  material_id: event.target.value,
                }))
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
          <label className="stack-xs">
            <span>Amount required (g)</span>
            <input
              required
              min="1"
              type="number"
              value={newRequest.amount_required}
              onChange={(event) =>
                setNewRequest((current) => ({
                  ...current,
                  amount_required: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <button type="submit" disabled={materials.length === 0}>
          Create request
        </button>
      </form>

      {error ? <p className="error-banner">{error}</p> : null}
      {loading ? <p>Loading requests…</p> : null}

      <section className="stack-md">
        <h2>Requests</h2>
        {requests.length === 0 && !loading ? (
          <p className="muted">No requests yet.</p>
        ) : (
          requests.map((request) => (
            <article key={request.id} className="card stack-sm">
              <div className="row-between gap-sm wrap">
                <div>
                  <h3>{request.project_name}</h3>
                  <p>
                    {request.requested_by} · {request.material_name}
                    {request.material_color ? ` · ${request.material_color}` : ""} · {request.amount_required}g
                  </p>
                </div>
                <span className="badge badge-neutral">{request.status}</span>
              </div>

              {request.active_reservation_id ? (
                <div className="card surface-muted stack-xs">
                  <p>
                    Reserved {request.active_reserved_amount}g on spool #
                    {request.reserved_spool_id}
                  </p>
                  <div className="row gap-sm wrap">
                    <button
                      type="button"
                      disabled={busyRequestId === request.id}
                      onClick={() =>
                        void runAction(request.id, async () => {
                          await releaseReservation({
                            requestId: request.id,
                            reservation_id: request.active_reservation_id ?? undefined,
                            user_id: request.requested_by,
                          });
                        })
                      }
                    >
                      Release
                    </button>
                    <button
                      type="button"
                      disabled={busyRequestId === request.id}
                      onClick={() =>
                        void runAction(request.id, async () => {
                          await fulfillRequest({
                            requestId: request.id,
                            reservation_id: request.active_reservation_id ?? undefined,
                            user_id: request.requested_by,
                          });
                        })
                      }
                    >
                      Fulfill
                    </button>
                  </div>
                </div>
              ) : (
                <ReservationForm
                  busy={busyRequestId === request.id}
                  request={request}
                  spools={spools}
                  onReserve={async (spoolId) => {
                    await runAction(request.id, async () => {
                      await reserveForRequest({
                        requestId: request.id,
                        spool_id: spoolId,
                        user_id: request.requested_by,
                      });
                    });
                  }}
                />
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
