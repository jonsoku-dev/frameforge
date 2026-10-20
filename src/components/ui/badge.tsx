import * as React from 'react';
import {cn} from '@/lib/utils';

export function Badge({className, ...props}: React.ComponentProps<'span'>) {
  return <span className={cn('inline-flex items-center rounded-[4px] border border-border bg-secondary px-1.5 text-[11px] leading-4 font-normal text-secondary-foreground', className)} {...props} />;
}
