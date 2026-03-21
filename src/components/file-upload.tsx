"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloudIcon, Loader2Icon, CheckCircleIcon } from "lucide-react";
import { CLIENT_CONFIG } from "@/lib/config.client";
import { formatFileSize } from "@/lib/format";
import { toast } from "sonner";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

interface FileUploadProps {
  onFileUploaded: (file: UploadedFile) => void;
}

export function FileUpload({ onFileUploaded }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    name: string;
    loaded: number;
    total: number;
  } | null>(null);
  const [justFinished, setJustFinished] = useState(false);
  // MEM-01: Stocker la référence XHR pour pouvoir l'annuler au démontage
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Annuler l'upload en cours si le composant est démonté
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
    };
  }, []);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        if (file.size > CLIENT_CONFIG.maxFileSize) {
          toast.error(`${file.name} est trop volumineux (max 100 Go)`);
          continue;
        }

        const ext = file.name.split(".").pop()?.toLowerCase();
        if (
          ext &&
          CLIENT_CONFIG.blockedExtensions.includes(`.${ext}`)
        ) {
          toast.error(`${file.name} : type de fichier non autorisé`);
          continue;
        }

        setUploading(true);
        setUploadProgress({ name: file.name, loaded: 0, total: file.size });

        try {
          const formData = new FormData();
          formData.append("file", file);

          const response = await new Promise<UploadedFile>(
            (resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhrRef.current = xhr;
              xhr.open("POST", "/api/upload");

              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && mountedRef.current) {
                  setUploadProgress({
                    name: file.name,
                    loaded: e.loaded,
                    total: e.total,
                  });
                }
              };

              xhr.onload = () => {
                xhrRef.current = null;
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve(JSON.parse(xhr.responseText));
                } else {
                  try {
                    const data = JSON.parse(xhr.responseText);
                    reject(new Error(data.error || "Erreur upload"));
                  } catch {
                    reject(new Error("Erreur upload"));
                  }
                }
              };

              xhr.onerror = () => {
                xhrRef.current = null;
                reject(new Error("Erreur réseau"));
              };
              xhr.onabort = () => {
                xhrRef.current = null;
                reject(new Error("Upload annulé"));
              };
              xhr.send(formData);
            }
          );

          if (!mountedRef.current) return;

          // Transition douce : bref état "terminé" avant de revenir au dropzone
          setJustFinished(true);
          onFileUploaded(response);
          toast.success(`${file.name} uploadé`);
        } catch (error) {
          if (!mountedRef.current) return;
          toast.error(
            error instanceof Error ? error.message : "Erreur lors de l'upload"
          );
        }
      }

      if (!mountedRef.current) return;

      // Petit délai pour que l'état "terminé" soit visible avant le reset
      setTimeout(() => {
        if (!mountedRef.current) return;
        setUploading(false);
        setUploadProgress(null);
        setJustFinished(false);
      }, 600);
    },
    [onFileUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploading,
  });

  const percent = uploadProgress
    ? Math.round((uploadProgress.loaded / uploadProgress.total) * 100)
    : 0;

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-xl p-5 sm:p-8 text-center
        transition-all duration-300 ease-out
        ${isDragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}
        ${uploading ? "pointer-events-none" : "cursor-pointer"}
      `}
    >
      <input {...getInputProps()} />

      <div className="relative overflow-hidden">
        {/* État upload en cours */}
        <div
          className={`transition-all duration-300 ease-out ${
            uploading && !justFinished
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 absolute inset-0"
          }`}
        >
          <div className="space-y-3">
            <Loader2Icon className="h-10 w-10 mx-auto text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium truncate max-w-xs mx-auto">
                {uploadProgress?.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {uploadProgress &&
                  `${formatFileSize(uploadProgress.loaded)} / ${formatFileSize(uploadProgress.total)} — ${percent}%`}
              </p>
            </div>
            <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* État terminé */}
        <div
          className={`transition-all duration-300 ease-out ${
            justFinished
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 absolute inset-0"
          }`}
        >
          <div className="space-y-2">
            <CheckCircleIcon className="h-10 w-10 mx-auto text-emerald-500" />
            <p className="text-sm font-medium text-emerald-500">
              Upload terminé
            </p>
          </div>
        </div>

        {/* État par défaut (dropzone) */}
        <div
          className={`transition-all duration-300 ease-out ${
            !uploading && !justFinished
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2 absolute inset-0"
          }`}
        >
          <div className="space-y-2">
            <UploadCloudIcon className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive
                ? "Déposez vos fichiers ici"
                : "Glissez-déposez vos fichiers ici"}
            </p>
            <p className="text-xs text-muted-foreground">
              ou cliquez pour parcourir — max{" "}
              {formatFileSize(CLIENT_CONFIG.maxFileSize)} par fichier
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
