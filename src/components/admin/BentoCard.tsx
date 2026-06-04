import type { ReactNode, CSSProperties, MouseEventHandler } from 'react';

interface BentoCardProps {
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
  children: ReactNode;
  padding?: boolean;
}

export function BentoCard({
  className = '',
  style,
  onClick,
  children,
  padding = true,
}: BentoCardProps) {
  return (
    <div
      className={`rounded-xl border border-border/50 bg-card shadow-sm ${padding ? 'p-5' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}