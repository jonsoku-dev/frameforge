import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import {cn} from '@/lib/utils';

export function Slider({className, 'aria-label': ariaLabel, ...props}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return <SliderPrimitive.Root aria-label={ariaLabel} className={cn('relative flex w-full touch-none items-center select-none', className)} {...props}>
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb aria-label={ariaLabel} className="block size-4 rounded-full border border-primary bg-background shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
  </SliderPrimitive.Root>;
}
