"use client";

import { useState } from "react";

interface UploadResult {
  key: string;
  publicUrl: string;
}

interface UseFileUploadReturn {
  upload: (file: File, folder: string) => Promise<UploadResult>;
  progress: number;
  isUploading: boolean;
  error: string | null;
  reset: () => void;
}

export function useFileUpload(): UseFileUploadReturn {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File, folder: string): Promise<UploadResult> => {
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      setProgress(30);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      setProgress(90);

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? "Upload failed");
      }

      const { data } = await res.json();
      setProgress(100);
      return { key: data.key, publicUrl: data.publicUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      throw e;
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setProgress(0);
    setIsUploading(false);
    setError(null);
  };

  return { upload, progress, isUploading, error, reset };
}
