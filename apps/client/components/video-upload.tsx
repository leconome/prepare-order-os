"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2, Trash2, Upload, Video } from "lucide-react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { uploadProductVideo } from "@/lib/api";

interface VideoUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_SIZE_MB = 200;

export function VideoUpload({ value, onChange, disabled }: VideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadProductVideo(file),
    onSuccess: (result) => onChange(result.url),
  });

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        alert("Format non supporté. Utilisez MP4, WebM ou MOV.");
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

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative group rounded-lg border bg-muted overflow-hidden">
          <video
            src={value}
            controls
            className="w-full max-h-64 object-contain"
          />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploadMutation.isPending}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="h-8 w-8"
              onClick={handleRemove}
              disabled={disabled || uploadMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploadMutation.isPending}
          className={`flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
        >
          {uploadMutation.isPending ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Upload en cours...</span>
            </>
          ) : (
            <>
              <Video className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm text-muted-foreground text-center">
                <span className="font-medium">Cliquez</span> pour ajouter une vidéo
                <br />
                <span className="text-xs">MP4, WebM, MOV — Max {MAX_SIZE_MB}MB</span>
              </div>
            </>
          )}
        </button>
      )}

      {uploadMutation.isError && (
        <p className="text-sm text-destructive">
          Erreur: {(uploadMutation.error as Error).message}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
