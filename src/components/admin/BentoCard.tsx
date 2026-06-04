import type { ReactNode, CSSProperties, MouseEventHandler } from 'react';

export function BentoCard({
  className = '',
  style,
  onClick,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-border/60 bg-card p-5 shadow-[0_8px_28px_-18px_rgba(15,23,42,0.35)] ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
