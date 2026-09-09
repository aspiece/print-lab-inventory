import { Link } from "react-router-dom";

import type { Spool } from "../types";
import { LowStockBadge } from "./LowStockBadge";

interface SpoolCardProps {
  spool: Spool;
}

export function SpoolCard({ spool }: SpoolCardProps) {
  return (
    <article className="card stack-sm">
      <div className="row-between gap-sm wrap">
        <h3>Spool #{spool.id}</h3>
        <LowStockBadge
          currentWeight={spool.current_weight}
          threshold={spool.low_stock_threshold}
        />
      </div>
      <p>
        {spool.material_name}
        {spool.material_color ? ` · ${spool.material_color}` : ""}
        {spool.brand ? ` · ${spool.brand}` : ""}
      </p>
      <dl className="stats-grid">
        <div>
          <dt>Current</dt>
          <dd>{spool.current_weight}g</dd>
        </div>
        <div>
          <dt>Available</dt>
          <dd>{spool.available}g</dd>
        </div>
        <div>
          <dt>Reserved</dt>
          <dd>{spool.reserved_amount}g</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{spool.status}</dd>
        </div>
        <div>
          <dt>Printer</dt>
          <dd>{spool.loaded_printer ?? "Unassigned"}</dd>
        </div>
      </dl>
      <Link className="button-link" to={`/spools/${spool.id}`}>
        Open detail
      </Link>
    </article>
  );
}
