"use client";

import { Upload, XCircle } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "./FileUploadDropzone";
import { FilePreview } from "./FilePreview";

interface ParserOption {
  value: string;
  label: string;
  description: string;
}

interface UploadSectionProps {
  file: File | null;
  selectedParser: string;
  parserOptions: ParserOption[];
  isUploading: boolean;
  error: string | null;
  onFileSelect: (file: File | null) => void;
  onParserChange: (parser: string) => void;
  onUpload: () => void;
}

export function UploadSection({
  file,
  selectedParser,
  parserOptions,
  isUploading,
  error,
  onFileSelect,
  onParserChange,
  onUpload,
}: UploadSectionProps) {
  return (
    <div className="flex gap-6 h-full">
      {/* Left side - Upload controls with background */}
      <div className="w-96 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-dark dark:text-white uppercase tracking-wide">
            Upload Statement
          </h3>
        </div>

        <div className="flex-1 bg-white dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3 p-6 flex flex-col">
          <div className="flex-1 flex flex-col gap-4">
            {/* Parser selection on top */}
            <div className="w-full">
              <label className="block text-sm font-medium text-dark dark:text-white mb-2">
                Select Parser
              </label>
              <Select
                value={selectedParser}
                options={parserOptions}
                onChange={onParserChange}
                className="w-full"
                buttonClassName="w-full min-w-0"
              />
            </div>

            {/* Drag/drop area below - takes remaining space */}
            <div className="flex-1 min-h-40">
              <FileUploadDropzone file={file} onFileSelect={onFileSelect} />
            </div>

            <Button
              onClick={onUpload}
              disabled={!file}
              isLoading={isUploading}
              leftIcon={<Upload className="h-4 w-4" />}
              className="w-full"
            >
              {isUploading ? "Parsing..." : "Parse File"}
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red/10 dark:bg-red/20 border border-red/30 dark:border-red/40 rounded-lg flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red flex-shrink-0" />
              <p className="text-red text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Right side - File preview (no background) */}
      <div className="flex-1 min-w-0 flex flex-col">
        <FilePreview file={file} />
      </div>
    </div>
  );
}
