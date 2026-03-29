interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  className?: string;
}

export function Badge({ children, color, bg, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={{ color: color || '#374151', backgroundColor: bg || '#f3f4f6' }}
    >
      {children}
    </span>
  );
}
