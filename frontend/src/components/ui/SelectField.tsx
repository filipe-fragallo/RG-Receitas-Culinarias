import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '../../lib/cn';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id: string;
  label?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: SelectOption[];
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { id, label, error, hint, placeholder, options, className, required, ...props },
  ref,
) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'block text-sm font-semibold text-ink',
            required && "after:ml-0.5 after:text-terracotta-600 after:content-['*']",
          )}
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          required={required}
          className={cn(
            'input-base cursor-pointer appearance-none pr-10',
            error && 'input-invalid',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
            undefined
          }
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
          aria-hidden
        />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-terracotta-700">
          {error}
        </p>
      )}
    </div>
  );
});
