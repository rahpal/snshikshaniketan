import { useId } from 'react';

/**
 * A labelled input with room for an error message. The label is always a real
 * <label> tied to the input, and the error is announced, so the form works for
 * someone using a screen reader or filling it in on a phone.
 */
export default function Field({
  label,
  error,
  hint,
  type = 'text',
  as = 'input',
  children,
  className = '',
  ...rest
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  const control =
    as === 'select' ? (
      <select
        id={id}
        className="field-input"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      >
        {children}
      </select>
    ) : (
      <input
        id={id}
        type={type}
        className="field-input"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
    );

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
