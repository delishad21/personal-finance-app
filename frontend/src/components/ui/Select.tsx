"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

type SelectSize = "sm" | "md" | "lg";

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  size?: SelectSize;
  className?: string;
  buttonClassName?: string;
}

const sizeStyles: Record<SelectSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-4 text-base",
};

export function Select({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  label,
  size = "md",
  className = "",
  buttonClassName = "",
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`${label ? "flex items-center gap-2" : ""} ${className}`}>
      {label && (
        <label className="text-sm font-medium text-dark dark:text-white whitespace-nowrap">
          {label}
        </label>
      )}
      <div ref={containerRef} className={`relative ${!label ? "w-full" : ""}`}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            flex items-center gap-2 text-left
            bg-white dark:bg-dark-3 border border-stroke dark:border-dark-3 rounded-lg
            text-dark dark:text-white outline-none cursor-pointer
            hover:border-primary dark:hover:border-primary focus:ring-2 focus:ring-primary
            transition-colors
            ${sizeStyles[size]}
            ${buttonClassName || "min-w-[180px]"}
          `}
        >
          <span className="flex-1 truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-dark-5 dark:text-dark-6 flex-shrink-0 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 py-1 bg-white dark:bg-dark-2 border border-stroke dark:border-dark-3 rounded-lg shadow-dropdown max-h-60 overflow-auto min-w-[220px]">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className="w-full flex items-start px-3 py-2.5 text-sm text-left hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-dark dark:text-white truncate">
                    {option.label}
                  </div>
                  {option.description && (
                    <div className="text-xs text-dark-5 dark:text-dark-6 mt-0.5 truncate">
                      {option.description}
                    </div>
                  )}
                </div>
                {value === option.value && (
                  <Check className="h-4 w-4 text-primary ml-2 flex-shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
