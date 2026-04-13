"use client";

import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";

type InputSize = "sm" | "md" | "lg";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSearch?: () => void;
  showButton?: boolean;
  buttonLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  size?: InputSize;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  onSearch,
  showButton = false,
  buttonLabel = "Search",
  isLoading = false,
  disabled = false,
  className = "",
  inputClassName = "",
  size = "md",
}: SearchBarProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <TextInput
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onSearch) {
            onSearch();
          }
        }}
        placeholder={placeholder}
        leftIcon={<Search className="h-4 w-4" />}
        size={size}
        className="flex-1"
        inputClassName={inputClassName}
        disabled={disabled}
      />

      {showButton && onSearch && (
        <Button
          variant="secondary"
          onClick={onSearch}
          disabled={disabled || isLoading}
          className={size === "sm" ? "h-9" : size === "lg" ? "h-12" : "h-11"}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonLabel}
        </Button>
      )}
    </div>
  );
}

