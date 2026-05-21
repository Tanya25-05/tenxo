export default function MetricCard({ accent = "green", label, value, helper, icon: Icon }) {
  return (
    <div className={`tenxo-metric tenxo-metric-${accent}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-soft)]">
            {label}
          </p>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</div>
        </div>
        {Icon && (
          <div className="tenxo-icon-tile">
            <Icon size={18} />
          </div>
        )}
      </div>
      {helper && <p className="mt-4 text-sm text-[var(--text-muted)]">{helper}</p>}
    </div>
  );
}
