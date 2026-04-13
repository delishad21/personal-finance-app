"use client";

import { forwardRef } from "react";

type InputSize = "sm" | "md" | "lg";

interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
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

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      label,
      error,
      size = "md",
      leftIcon,
      rightIcon,
      className = "",
      inputClassName = "",
      inputMode = "decimal",
      ...props
    },
    ref,
  ) => {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {label && (
          <label className="whitespace-nowrap text-sm font-medium text-dark dark:text-white">
            {label}
          </label>
        )}
        <div className="relative flex w-full items-center">
          {leftIcon && (
            <span className="absolute left-3 text-dark-5 dark:text-dark-6">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            type="number"
            inputMode={inputMode}
            className={`
              w-full rounded-lg border border-stroke bg-white text-dark outline-none transition-colors
              hover:border-dark-4 focus:border-primary focus:ring-2 focus:ring-primary
              dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:border-dark-4
              placeholder:text-dark-5 dark:placeholder:text-dark-6
              disabled:cursor-not-allowed disabled:bg-gray-2 dark:disabled:bg-dark-3
              [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none
              ${leftIcon ? "pl-10" : ""}
              ${rightIcon ? "pr-10" : ""}
              ${error ? "border-red focus:border-red focus:ring-red" : ""}
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
        {error && <span className="mt-1 text-xs text-red">{error}</span>}
      </div>
    );
  },
);

NumberInput.displayName = "NumberInput";

