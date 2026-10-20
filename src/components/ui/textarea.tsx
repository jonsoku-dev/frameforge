import * as React from 'react';
import {cn} from '@/lib/utils';

export function Textarea({className, ...props}: React.ComponentProps<'textarea'>) {
  return <textarea className={cn('flex min-h-16 w-full rounded-md border border-input bg-raised px-2 py-1.5 text-[13px] placeholder:text-subtle-foreground', className)} {...props} />;
}
