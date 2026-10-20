import * as React from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cva, type VariantProps} from 'class-variance-authority';
import {cn} from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-[13px] font-normal whitespace-nowrap transition-colors duration-[80ms] ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-[13px]',
        icon: 'size-7',
      },
    },
    defaultVariants: {variant: 'default', size: 'default'},
  },
);

export function Button({className, variant, size, asChild = false, ...props}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & {asChild?: boolean}) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({variant, size}), className)} {...props} />;
}
