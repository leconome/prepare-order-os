"use client";

import { useMutation } from "@tanstack/react-query";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { uploadProductImage } from "@/lib/api";

interface GalleryUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
  max?: number;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;

export function GalleryUpload({
  value,
  onChange,
  disabled,
  max = 8,
}: GalleryUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadProductImage(file),
    onSuccess: (result) => onChange([...value, result.url]),
  });

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        alert("Format non supporté. Utilisez JPEG, PNG ou WebP.");
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`Fichier trop volumineux. Maximum: ${MAX_SIZE_MB}MB`);
        return;
      }
      uploadMutation.mutate(file);
    },
    [uploadMutation],
  );

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {value.map((url, index) => (
          <div key={url} className="relative group aspect-square rounded-lg border overflow-hidden bg-muted">
            <Image
              src={url}
              alt={`Galerie ${index + 1}`}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploadMutation.isPending}
            className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ajouter</span>
              </>
            )}
          </button>
        )}
      </div>

      {uploadMutation.isError && (
        <p className="text-sm text-destructive">
          Erreur: {(uploadMutation.error as Error).message}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {value.length}/{max} images — JPEG, PNG, WebP — Max {MAX_SIZE_MB}MB
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}
