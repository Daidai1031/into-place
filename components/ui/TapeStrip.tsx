/** Translucent masking-tape strip, absolutely positioned by the caller. */
export function TapeStrip({
  className = "",
  rotate = -3,
}: {
  className?: string;
  rotate?: number;
}) {
  return (
    <div
      aria-hidden
      className={`absolute h-6 w-24 bg-tape/70 shadow-sm ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        backgroundImage:
          "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.12) 0 2px, transparent 2px 5px)",
      }}
    />
  );
}
