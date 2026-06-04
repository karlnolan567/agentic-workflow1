const ROUTE_LABELS: Record<string, string> = {
  billing: "Billing support",
  tech: "Technical support",
  feature: "Product specialist",
  misc: "General support",
};

export function RouteBadge({ route }: { route: string }) {
  const label = ROUTE_LABELS[route] ?? route;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand dark:text-teal-300">
      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
      {label} · sticky for this chat
    </span>
  );
}
