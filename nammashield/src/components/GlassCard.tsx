import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export function GlassCard({ children, className }: { children: ReactNode; className?: string }) {
  // Removed framer-motion animations to respect "subtle, fast motion" and "reduced-motion" settings natively
  // Removed heavy glass effects, replacing with solid high-contrast backgrounds
  return (
    <div
      className={cn(
        "bg-white border border-stone-200 shadow-sm rounded-xl overflow-hidden transition-shadow duration-200",
        className
      )}
    >
      {children}
    </div>
  );
}
