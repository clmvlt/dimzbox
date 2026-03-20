import { getFileStyle } from "@/lib/file-icons";
import { getFileExtension } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FileIcon as LucideFileIcon } from "lucide-react";

interface FileIconProps {
  fileName: string;
  mimeType?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 rounded-lg text-[10px]",
  md: "h-12 w-12 rounded-xl text-xs",
  lg: "h-16 w-16 rounded-2xl text-sm",
} as const;

export function FileIcon({ fileName, mimeType, size = "md", className }: FileIconProps) {
  const style = getFileStyle(fileName, mimeType);
  const ext = getFileExtension(fileName);

  return (
    <div
      className={cn(
        "flex items-center justify-center shrink-0 border font-bold uppercase",
        sizeClasses[size],
        style.bg,
        style.border,
        style.text,
        className
      )}
    >
      {ext ? (
        <span>{ext.length > 4 ? ext.slice(0, 4) : ext}</span>
      ) : (
        <LucideFileIcon className={size === "sm" ? "h-3.5 w-3.5" : size === "md" ? "h-5 w-5" : "h-6 w-6"} />
      )}
    </div>
  );
}
