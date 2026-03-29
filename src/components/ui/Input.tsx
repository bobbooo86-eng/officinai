import { useId, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id: propId, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = propId || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-4 py-2.5 rounded-xl border border-gray-300
          bg-white text-gray-900 text-sm
          placeholder:text-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:bg-gray-100 disabled:text-gray-500
          transition-all
          ${error ? 'border-red-400 focus:ring-red-500' : ''}
          ${className}
        `}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {error && <p id={errorId} className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
    </div>
  );
}
