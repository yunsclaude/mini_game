type StatusBadgeProps = {
  label: string;
};

export function StatusBadge({ label }: StatusBadgeProps) {
  return (
    <span className="badge">
      <span className="badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
