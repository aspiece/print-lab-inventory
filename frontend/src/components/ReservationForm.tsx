import { useMemo, useState } from "react";

import type { PrintRequest, Spool } from "../types";

interface ReservationFormProps {
  request: PrintRequest;
  spools: Spool[];
  onReserve: (spoolId?: number) => Promise<void>;
  busy: boolean;
}

export function ReservationForm({
  request,
  spools,
  onReserve,
  busy,
}: ReservationFormProps) {
  const [selectedSpoolId, setSelectedSpoolId] = useState<string>("");

  const matchingSpools = useMemo(
    () =>
      spools.filter(
        (spool) =>
          spool.material_id === request.material_id &&
          spool.available >= request.amount_required,
      ),
    [request.amount_required, request.material_id, spools],
  );

  return (
    <div className="stack-sm">
      <label className="stack-xs">
        <span>Reserve from spool</span>
        <select
          value={selectedSpoolId}
          onChange={(event) => setSelectedSpoolId(event.target.value)}
        >
          <option value="">Auto-pick fullest compatible spool</option>
          {matchingSpools.map((spool) => (
            <option key={spool.id} value={spool.id}>
              Spool #{spool.id} · {spool.available}g available
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={busy || matchingSpools.length === 0}
        onClick={() => onReserve(selectedSpoolId ? Number(selectedSpoolId) : undefined)}
      >
        Reserve filament
      </button>
      {matchingSpools.length === 0 ? (
        <p className="muted">No spool currently has enough available filament.</p>
      ) : null}
    </div>
  );
}
