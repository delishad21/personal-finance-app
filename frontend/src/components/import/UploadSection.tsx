"use client";

import { Upload, XCircle } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "./FileUploadDropzone";

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
    <div className="bg-white dark:bg-dark-2 rounded-lg border border-stroke dark:border-dark-3 p-6 mb-6">
      <h3 className="text-sm font-semibold text-dark dark:text-white mb-4 uppercase tracking-wide">
        Upload Statement
      </h3>
      <div className="flex flex-wrap items-center gap-4">
        <Select
          label="Parser:"
          value={selectedParser}
          options={parserOptions}
          onChange={onParserChange}
        />

        <FileUploadDropzone file={file} onFileSelect={onFileSelect} />

        <Button
          onClick={onUpload}
          disabled={!file}
          isLoading={isUploading}
          leftIcon={<Upload className="h-4 w-4" />}
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
  );
}
