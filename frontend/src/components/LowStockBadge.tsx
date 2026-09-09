interface LowStockBadgeProps {
  currentWeight: number;
  threshold: number;
}

export function LowStockBadge({
  currentWeight,
  threshold,
}: LowStockBadgeProps) {
  let label = "Healthy";
  let toneClass = "badge-success";

  if (currentWeight <= 0) {
    label = "Empty";
    toneClass = "badge-neutral";
  } else if (currentWeight <= threshold) {
    label = "Low stock";
    toneClass = "badge-danger";
  } else if (currentWeight <= threshold * 1.5) {
    label = "Watch";
    toneClass = "badge-warning";
  }

  return <span className={`badge ${toneClass}`}>{label}</span>;
}
