import * as React from 'react';
import {cn} from '@/lib/utils';

type MagicCardProps = React.ComponentProps<'div'> & {
  gradientSize?: number;
  gradientColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
};

/** Magic UI Magic Card. The border light follows the pointer. */
export function MagicCard({className, children, gradientSize = 180, gradientColor = '#262626', gradientFrom = '#9E7AFF', gradientTo = '#FE8BBB', ...props}: MagicCardProps) {
  const move = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--y', `${event.clientY - rect.top}px`);
  };
  return <div
    onMouseMove={move}
    ref={node => {
      if (!node) return;
      node.style.setProperty('--gradient-size', `${gradientSize}px`);
      node.style.setProperty('--gradient-color', gradientColor);
      node.style.setProperty('--gradient-from', gradientFrom);
      node.style.setProperty('--gradient-to', gradientTo);
    }}
    className={cn('group relative rounded-xl bg-[radial-gradient(var(--gradient-size)_circle_at_var(--x,-1000px)_var(--y,-1000px),var(--gradient-from),var(--gradient-to),transparent_100%)] p-px', className)}
    {...props}
  >
    <div className="relative h-full rounded-[11px] bg-card" style={{backgroundImage: 'radial-gradient(var(--gradient-size) circle at var(--x, -1000px) var(--y, -1000px), var(--gradient-color), transparent 100%)'}}>{children}</div>
  </div>;
}
