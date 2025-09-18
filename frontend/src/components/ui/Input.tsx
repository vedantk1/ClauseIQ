/**
 * Enhanced Input component with variants and states
 */

import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "size"
  > {
  variant?: "default" | "outline" | "filled";
  size?: "sm" | "md" | "lg";
  error?: string;
  success?: boolean;
  helpText?: string;
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  validate?: (value: string) => string | null;
  onChange?: (value: string) => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      error,
      success = false,
      helpText,
      label,
      leftIcon,
      rightIcon,
      disabled,
      required,
      validate,
      onChange,
      onBlur,
      value,
      id,
      ...props
    },
    ref
  ) => {
    const [validationError, setValidationError] = React.useState<string | null>(
      null
    );
    const [internalValue, setInternalValue] = React.useState(value || "");

    // Generate unique id if not provided and label exists
    const inputId = React.useMemo(() => {
      if (id) return id;
      if (label) return `input-${Math.random().toString(36).substr(2, 9)}`;
      return undefined;
    }, [id, label]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      if (onChange) {
        onChange(newValue);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (validate) {
        const validationResult = validate(e.target.value);
        setValidationError(validationResult);
      }
      if (onBlur) {
        onBlur(e);
      }
    };

    const displayError = error || validationError;
    const hasError = !!displayError;
    const baseStyles =
      "flex w-full rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

    const variants = {
      default: hasError
        ? "border-red-500 bg-bg-surface text-text-primary placeholder:text-text-secondary focus-visible:ring-red-500"
        : success
        ? "border-green-500 bg-bg-surface text-text-primary placeholder:text-text-secondary focus-visible:ring-green-500"
        : "border-gray-300 bg-bg-surface text-text-primary placeholder:text-text-secondary focus-visible:ring-accent-purple",
      outline: hasError
        ? "border-red-500 bg-transparent text-text-primary placeholder:text-text-secondary focus-visible:ring-red-500"
        : success
        ? "border-green-500 bg-transparent text-text-primary placeholder:text-text-secondary focus-visible:ring-green-500"
        : "border-border-default bg-transparent text-text-primary placeholder:text-text-secondary focus-visible:ring-accent-purple",
      filled: hasError
        ? "border-red-500 bg-surface-secondary text-text-primary placeholder:text-text-secondary focus-visible:ring-red-500"
        : success
        ? "border-green-500 bg-surface-secondary text-text-primary placeholder:text-text-secondary focus-visible:ring-green-500"
        : "border-transparent bg-surface-secondary text-text-primary placeholder:text-text-secondary focus-visible:ring-accent-purple focus-visible:ring-offset-bg-primary",
    };

    const sizes = {
      sm: "h-8 px-3 py-1.5 text-sm",
      md: "h-10 px-3 py-2",
      lg: "h-12 px-4 py-3 text-lg",
    };

    const inputClasses = cn(
      baseStyles,
      variants[variant],
      sizes[size],
      leftIcon && "pl-10",
      rightIcon && "pr-10",
      disabled && "bg-gray-100",
      className
    );

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-text-primary mb-1"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            className={inputClasses}
            ref={ref}
            disabled={disabled}
            required={required}
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary">
              {rightIcon}
            </div>
          )}
        </div>
        {(helpText || displayError) && (
          <p
            id={inputId ? `${inputId}-helper` : undefined}
            className={cn(
              "mt-1 text-sm",
              displayError ? "text-red-500" : "text-text-secondary"
            )}
            aria-describedby={inputId}
          >
            {displayError || helpText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export default Input;
