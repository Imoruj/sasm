"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFileUpload } from "@/hooks/useFileUpload";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1024;
const JPEG_QUALITY = 0.82;

async function optimizeImage(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") {
    return file;
  }

  const bitmap = await createImageBitmap(file);

  try {
    const largestSide = Math.max(bitmap.width, bitmap.height);
    if (largestSide <= MAX_IMAGE_DIMENSION && file.size <= 350 * 1024) {
      return file;
    }

    const scale = Math.min(1, MAX_IMAGE_DIMENSION / largestSide);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);

    const targetType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      context.canvas.toBlob(resolve, targetType, targetType === "image/jpeg" ? JPEG_QUALITY : undefined);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const extension = targetType === "image/png" ? "png" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "upload";

    return new File([blob], `${baseName}.${extension}`, {
      type: targetType,
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

interface AvatarUploadProps {
  /** Text shown when there is no image (e.g. "AN" for initials, or a ReactNode icon) */
  fallback: React.ReactNode;
  currentUrl?: string | null;
  /** Storage folder name, e.g. "avatar" or "org-logo" */
  folder: string;
  /** API endpoint to PATCH with { [saveField]: url } after upload */
  saveEndpoint: string;
  saveField?: string;
  /** Width/height in px */
  size?: number;
  shape?: "circle" | "square";
  imageFit?: "cover" | "contain";
  onSaved?: (url: string) => void;
  className?: string;
}

export default function AvatarUpload({
  fallback,
  currentUrl,
  folder,
  saveEndpoint,
  saveField = "avatarUrl",
  size = 64,
  shape = "circle",
  imageFit = "cover",
  onSaved,
  className,
}: AvatarUploadProps) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(currentUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading } = useFileUpload();

  const iconSize = Math.round(size * 0.3);
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-xl";

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only JPG or PNG images are allowed");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Image must be smaller than 5 MB");
      return;
    }

    const previousUrl = url;
    let previewUrl: string | null = null;

    try {
      const optimizedFile = await optimizeImage(file);
      previewUrl = URL.createObjectURL(optimizedFile);
      setUrl(previewUrl);

      const { publicUrl } = await upload(optimizedFile, folder);
      const res = await fetch(saveEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [saveField]: publicUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        setUrl(previousUrl);
        toast.error(json.error?.message ?? "Failed to save image");
        return;
      }
      setUrl(publicUrl);
      onSaved?.(publicUrl);
      router.refresh();
      toast.success("Image updated successfully");
    } catch {
      setUrl(previousUrl);
      toast.error("Upload failed. Please try again.");
    } finally {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    }
  }

  return (
    <div
      role="button"
      aria-label="Change image"
      tabIndex={0}
      className={cn("relative group shrink-0", isUploading ? "cursor-wait" : "cursor-pointer", className)}
      style={{ width: size, height: size }}
      onClick={() => !isUploading && inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && !isUploading && inputRef.current?.click()}
    >
      {/* Image or fallback */}
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden bg-[#1B4332]/10 text-[#1B4332] font-bold select-none",
          shapeClass,
        )}
        style={{ fontSize: size * 0.32 }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Uploaded"
            className={cn(
              "h-full w-full",
              imageFit === "contain" ? "object-contain p-1" : "object-cover",
              shapeClass,
            )}
          />
        ) : (
          fallback
        )}
      </div>

      {/* Hover overlay */}
      {!isUploading && (
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity",
            shapeClass,
          )}
        >
          <Camera className="text-white" style={{ width: iconSize, height: iconSize }} />
          <span className="text-white font-medium" style={{ fontSize: Math.max(iconSize * 0.55, 10) }}>
            Change
          </span>
        </div>
      )}

      {/* Uploading overlay */}
      {isUploading && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/45",
            shapeClass,
          )}
        >
          <Loader2 className="animate-spin text-white" style={{ width: iconSize, height: iconSize }} />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
