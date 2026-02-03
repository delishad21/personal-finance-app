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
      className={`w-full h-full border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${
        dragActive
          ? "border-primary bg-primary/10 dark:bg-primary/20"
          : "border-stroke dark:border-dark-3 hover:border-primary/50"
      }`}
    >
      {file ? (
        <div className="flex flex-col items-center gap-2 w-full px-8">
          <FileText className="h-8 w-8 text-primary" />
          <div className="text-center w-full">
            <p className="text-sm font-medium text-dark dark:text-white truncate">
              {file.name}
            </p>
            <p className="text-xs text-dark-5 dark:text-dark-6 mt-1">
              {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
          <button
            onClick={() => onFileSelect(null)}
            className="text-red hover:text-red/80 text-sm font-medium transition-colors"
          >
            Remove File
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-gray-1 dark:bg-dark-3 rounded-full">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-dark dark:text-white mb-1">
              Drop your file here
            </p>
            <p className="text-xs text-dark-5 dark:text-dark-6">
              or{" "}
              <label className="text-primary cursor-pointer hover:underline font-medium">
                browse files
                <input
                  type="file"
                  accept={accept}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </p>
            <p className="text-xs text-dark-5 dark:text-dark-6 mt-2">
              Supported formats: CSV, PDF
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
