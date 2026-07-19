"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { CollageButton } from "@/components/ui/CollageButton";
import type { UserUpload } from "@/lib/local-store";

const UPLOAD_ROLES = [
  { value: "texture", label: "Texture / material" },
  { value: "protagonist_ref", label: "Protagonist reference" },
  { value: "bridge", label: "Bridge between eras" },
  { value: "ending", label: "Ending image" },
  { value: "inspiration", label: "Inspiration" },
];

/** Client-side resize to ≤1600px JPEG so localStorage stays under quota. */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function UploadModal({
  open,
  placeName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  placeName: string;
  onClose: () => void;
  onSubmit: (upload: UserUpload) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [era, setEra] = useState("");
  const [role, setRole] = useState("texture");
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(f: File) {
    setFile(f);
    setPreview(await fileToDataUrl(f));
  }

  async function submit() {
    if (!file || !preview || !title.trim()) return;
    setBusy(true);
    onSubmit({
      id: `upload_${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      era: era.trim() || `${new Date().getFullYear()} (contemporary)`,
      dataUrl: preview,
      shareToPlace: share,
      uploadRole: role,
      moderation: "uploading",
      createdAt: new Date().toISOString(),
    });
    setBusy(false);
    setFile(null);
    setPreview(null);
    setTitle("");
    setDescription("");
    setEra("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} className="w-[28rem] max-w-full">
      <h3 className="text-xl">Add your photograph</h3>
      <p className="mt-1 font-typewriter text-xs text-ink-soft">
        Your image joins the public archive of {placeName} with your name on
        it — sources stay visible forever.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-4 flex h-40 w-full cursor-pointer items-center justify-center border-2 border-dashed border-ink/30 bg-paper-deep/20 transition-colors hover:border-stamp/60"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f?.type.startsWith("image/")) void pick(f);
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Upload preview" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="font-hand text-lg text-ink-soft">
            Drop an image here, or click to choose
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
        }}
      />

      <label className="mt-4 block font-typewriter text-xs uppercase tracking-wider text-ink-soft">
        Title *
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full border-b border-ink/30 bg-transparent py-1 font-display text-base outline-none focus:border-ink"
          placeholder="What are we looking at?"
        />
      </label>
      <label className="mt-3 block font-typewriter text-xs uppercase tracking-wider text-ink-soft">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none border-b border-ink/30 bg-transparent py-1 font-typewriter text-sm outline-none focus:border-ink"
          placeholder="When was it taken? What does it mean to you?"
        />
      </label>
      <div className="mt-3 flex gap-3">
        <label className="flex-1 font-typewriter text-xs uppercase tracking-wider text-ink-soft">
          Year / era
          <input
            value={era}
            onChange={(e) => setEra(e.target.value)}
            className="mt-1 w-full border-b border-ink/30 bg-transparent py-1 font-typewriter text-sm outline-none focus:border-ink"
            placeholder="e.g. 2026"
          />
        </label>
        <label className="flex-1 font-typewriter text-xs uppercase tracking-wider text-ink-soft">
          Role in the film
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="mt-1 w-full border-b border-ink/30 bg-transparent py-1 font-typewriter text-sm outline-none focus:border-ink"
          >
            {UPLOAD_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 flex items-start gap-2 font-typewriter text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={share}
          onChange={(e) => setShare(e.target.checked)}
          className="mt-0.5 accent-stamp"
        />
        Share this image into the public archive of {placeName}, credited to me.
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <CollageButton variant="ghost" onClick={onClose}>
          Cancel
        </CollageButton>
        <CollageButton onClick={() => void submit()} disabled={!preview || !title.trim() || busy}>
          Submit for review
        </CollageButton>
      </div>
    </Modal>
  );
}
