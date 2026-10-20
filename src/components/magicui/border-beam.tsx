import {cn} from '@/lib/utils';

type BorderBeamProps = {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  anchor?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
};

/** Magic UI Border Beam. The beam rides the frame edge and stays out of the picture. */
export function BorderBeam({className, size = 200, duration = 12, anchor = 90, borderWidth = 1.5, colorFrom = '#ffaa40', colorTo = '#9c40ff', delay = 0}: BorderBeamProps) {
  return <div
    ref={node => {
      if (!node) return;
      node.style.setProperty('--size', String(size));
      node.style.setProperty('--duration', String(duration));
      node.style.setProperty('--anchor', String(anchor));
      node.style.setProperty('--border-width', String(borderWidth));
      node.style.setProperty('--color-from', colorFrom);
      node.style.setProperty('--color-to', colorTo);
      node.style.setProperty('--delay', `-${delay}s`);
    }}
    className={cn(
      'pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width)*1px)_solid_transparent]',
      '![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]',
      'after:absolute after:aspect-square after:w-[calc(var(--size)*1px)] after:animate-border-beam after:[animation-delay:var(--delay)] after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)] after:[offset-anchor:calc(var(--anchor)*1%)_50%] after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]',
      'motion-reduce:after:animate-none',
      className,
    )}
  />;
}
