"use client";

import { forwardRef } from "react";

type InputSize = "sm" | "md" | "lg";

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  size?: InputSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  inputClassName?: string;
}

const sizeStyles: Record<InputSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-4 text-base",
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      error,
      size = "md",
      leftIcon,
      rightIcon,
      className = "",
      inputClassName = "",
      ...props
    },
    ref
  ) => {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {label && (
          <label className="text-sm font-medium text-dark dark:text-white whitespace-nowrap">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-dark-5 dark:text-dark-6">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            className={`
              w-full border border-stroke dark:border-dark-3 rounded-lg
              bg-white dark:bg-dark-2 text-dark dark:text-white
              placeholder:text-dark-5 dark:placeholder:text-dark-6
              outline-none transition-colors
              hover:border-dark-4 dark:hover:border-dark-4
              focus:ring-2 focus:ring-primary focus:border-primary
              disabled:bg-gray-2 dark:disabled:bg-dark-3 disabled:cursor-not-allowed
              ${leftIcon ? "pl-10" : ""}
              ${rightIcon ? "pr-10" : ""}
              ${error ? "border-red focus:ring-red focus:border-red" : ""}
              ${sizeStyles[size]}
              ${inputClassName}
            `}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 text-dark-5 dark:text-dark-6">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <span className="text-xs text-red mt-1">{error}</span>
        )}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";
