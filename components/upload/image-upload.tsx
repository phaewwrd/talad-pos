"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { useErrorMessage } from "@/lib/use-error-message";

const MAX_SIDE = 1200;

/** Square center-crop + downscale in the browser before upload. */
async function cropSquare(file: File): Promise<Blob> {
  // TODO(decision): interactive crop UI; for now a centered square crop.
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(side, MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    out,
    out,
  );
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.88),
  );
}

export function ImageUpload({
  value,
  onChange,
  kind = "products",
  label,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  kind?: "products" | "logo";
  label: string;
}) {
  const t = useTranslations("upload");
  const errorMessage = useErrorMessage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error(t("notImage"));
      return;
    }
    setUploading(true);
    try {
      const blob = await cropSquare(file);
      setPreview(URL.createObjectURL(blob));
      const signRes = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const sign = await signRes.json();
      if (!signRes.ok) throw new Error(errorMessage(sign.code, sign.details));

      const form = new FormData();
      form.append("file", blob);
      form.append("api_key", sign.apiKey);
      form.append("timestamp", String(sign.timestamp));
      form.append("signature", sign.signature);
      form.append("folder", sign.folder);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
        {
          method: "POST",
          body: form,
        },
      );
      const data = await res.json();
      if (!res.ok || !data.secure_url) throw new Error(t("failed"));
      onChange(data.secure_url as string);
    } catch (err) {
      setPreview(null);
      toast.error(err instanceof Error ? err.message : t("failed"));
    } finally {
      setUploading(false);
    }
  }

  const shown = preview ?? cloudinaryUrl(value, 240);

  return (
    <div className="grid gap-1.5">
      <span className="font-medium text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-muted text-muted-foreground hover:border-primary"
          aria-label={t("choose")}
        >
          {shown ? (
            // biome-ignore lint/performance/noImgElement: local blob preview / transformed CDN URL
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6" aria-hidden />
          )}
          {uploading && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-5 animate-spin" />
            </span>
          )}
        </button>
        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {value ? t("replace") : t("choose")}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full text-muted-foreground"
              onClick={() => {
                setPreview(null);
                onChange(null);
              }}
            >
              <X className="size-4" /> {t("remove")}
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
