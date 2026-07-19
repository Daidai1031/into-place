/** Rubber-stamp label (APPROVED / PENDING REVIEW / GENERATED). */
export function Stamp({
  text,
  color = "stamp",
  animate = false,
  className = "",
}: {
  text: string;
  color?: "stamp" | "accent" | "ink";
  animate?: boolean;
  className?: string;
}) {
  const colorClass =
    color === "accent"
      ? "border-accent text-accent"
      : color === "ink"
        ? "border-ink-soft text-ink-soft"
        : "border-stamp text-stamp";
  return (
    <span
      className={`inline-block -rotate-[8deg] border-[3px] px-2 py-0.5 font-typewriter text-xs font-bold uppercase tracking-widest opacity-85 ${colorClass} ${animate ? "animate-stamp-in" : ""} ${className}`}
      style={{ maskImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Cfilter id='r'%3E%3CfeTurbulence baseFrequency='0.4' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0.05'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23r)'/%3E%3C/svg%3E\")" }}
    >
      {text}
    </span>
  );
}
