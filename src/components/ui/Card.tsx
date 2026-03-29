import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: boolean;
  hover?: boolean;
}

export function Card({ children, padding = true, hover = false, className = '', ...props }: CardProps) {
  return (
    <div
      className={`
        bg-white rounded-2xl border border-gray-200 shadow-sm
        ${padding ? 'p-5' : ''}
        ${hover ? 'hover:shadow-md hover:border-gray-300 transition-all cursor-pointer' : ''}
        ${className}
      `}
      {...(hover ? { role: 'region' } : {})}
      {...props}
    >
      {children}
    </div>
  );
}
