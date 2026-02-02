"use client";

import { useState } from "react";
import { Upload, FileText } from "lucide-react";

interface FileUploadDropzoneProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  accept?: string;
}

export function FileUploadDropzone({
  file,
  onFileSelect,
  accept = ".csv,.pdf",
}: FileUploadDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`flex-1 min-w-[280px] h-24 border-2 border-dashed rounded-lg px-4 flex items-center transition-colors ${
        dragActive
          ? "border-primary bg-primary/10 dark:bg-primary/20"
          : "border-stroke dark:border-dark-3 hover:border-primary/50"
      }`}
    >
      {file ? (
        <div className="flex items-center gap-2 w-full">
          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-dark dark:text-white truncate flex-1">
            {file.name}
          </span>
          <button
            onClick={() => onFileSelect(null)}
            className="text-red hover:text-red/80 text-xs font-medium transition-colors"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-dark-5 dark:text-dark-6" />
          <span className="text-sm text-dark-5 dark:text-dark-6">
            Drop file or{" "}
            <label className="text-primary cursor-pointer hover:underline font-medium">
              browse
              <input
                type="file"
                accept={accept}
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </span>
        </div>
      )}
    </div>
  );
}
