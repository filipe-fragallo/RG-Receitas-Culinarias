import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  showCount?: boolean;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField(
    { id, label, error, hint, showCount = false, className, required, value, ...props },
    ref,
  ) {
    const length = typeof value === 'string' ? value.length : 0;
    const maxLength = props.maxLength;

    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-4">
          <label
            htmlFor={id}
            className={cn(
              'block text-sm font-semibold text-ink',
              required && "after:ml-0.5 after:text-terracotta-600 after:content-['*']",
            )}
          >
            {label}
          </label>
          {showCount && maxLength && (
            <span
              className={cn(
                'text-xs tabular-nums text-ink-muted',
                length > maxLength && 'font-semibold text-terracotta-700',
              )}
              aria-hidden
            >
              {length}/{maxLength}
            </span>
          )}
        </div>
        <textarea
          ref={ref}
          id={id}
          required={required}
          value={value}
          className={cn(
            'input-base min-h-32 resize-y leading-relaxed',
            error && 'input-invalid',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
            undefined
          }
          {...props}
        />
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
  },
);
