"use client";

const COLORS = ["#2b2620", "#a5432c", "#31572c", "#faf6ec", "#b8c8cf"];

export function CanvasToolbar({
  tool,
  onTool,
  brushColor,
  onBrushColor,
  brushSize,
  onBrushSize,
  canUndo,
  onUndo,
  hasSelection,
  onLayerOrder,
  onRemove,
  onClearBrush,
}: {
  tool: "select" | "brush";
  onTool: (tool: "select" | "brush") => void;
  brushColor: string;
  onBrushColor: (color: string) => void;
  brushSize: number;
  onBrushSize: (size: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  hasSelection: boolean;
  onLayerOrder: (dir: 1 | -1) => void;
  onRemove: () => void;
  onClearBrush: () => void;
}) {
  const btn = (active: boolean) =>
    `cursor-pointer px-2.5 py-1.5 font-typewriter text-xs uppercase tracking-wider transition-colors ${
      active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-2 border border-ink/15 bg-paper/80 px-3 py-2">
      <button className={btn(tool === "select")} onClick={() => onTool("select")}>
        Select
      </button>
      <button className={btn(tool === "brush")} onClick={() => onTool("brush")}>
        Brush
      </button>

      {tool === "brush" && (
        <>
          <span className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Brush color ${c}`}
                onClick={() => onBrushColor(c)}
                className={`h-5 w-5 cursor-pointer rounded-full border-2 ${brushColor === c ? "border-stamp" : "border-ink/20"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </span>
          <input
            type="range"
            min={2}
            max={24}
            value={brushSize}
            onChange={(e) => onBrushSize(Number(e.target.value))}
            className="w-20 accent-stamp"
            aria-label="Brush size"
          />
          <button
            className="cursor-pointer font-hand text-sm text-ink-soft underline decoration-dotted hover:text-stamp"
            onClick={onClearBrush}
          >
            clear drawing
          </button>
        </>
      )}

      <span className="mx-1 h-5 w-px bg-ink/15" />
      <button
        className="cursor-pointer font-typewriter text-xs uppercase tracking-wider text-ink-soft hover:text-ink disabled:opacity-30"
        disabled={!canUndo}
        onClick={onUndo}
      >
        ↩ Undo
      </button>

      {hasSelection && tool === "select" && (
        <>
          <span className="mx-1 h-5 w-px bg-ink/15" />
          <button className={btn(false)} onClick={() => onLayerOrder(1)} title="Bring forward">
            Forward
          </button>
          <button className={btn(false)} onClick={() => onLayerOrder(-1)} title="Send backward">
            Back
          </button>
          <button
            className="cursor-pointer px-2.5 py-1.5 font-typewriter text-xs uppercase tracking-wider text-stamp hover:bg-stamp/10"
            onClick={onRemove}
          >
            Remove
          </button>
        </>
      )}
    </div>
  );
}
