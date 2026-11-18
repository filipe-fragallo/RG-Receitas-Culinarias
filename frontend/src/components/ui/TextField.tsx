import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '../../lib/cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  endAdornment?: ReactNode;
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { id, label, error, hint, endAdornment, className, required, ...props },
  ref,
) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={cn(
          'block text-sm font-semibold text-ink',
          required && "after:ml-0.5 after:text-terracotta-600 after:content-['*']",
        )}
      >
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          required={required}
          className={cn(
            'input-base',
            Boolean(endAdornment) && 'pr-12',
            error && 'input-invalid',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          {...props}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-2 flex items-center">{endAdornment}</div>
        )}
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

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'endAdornment'>;

export function PasswordField({ id, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      id={id}
      type={visible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="rounded-lg p-2 text-ink-muted transition hover:bg-cream-100 hover:text-ink focus-visible:ring-2 focus-visible:ring-olive-500"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      }
    />
  );
}
