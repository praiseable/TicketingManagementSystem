import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectTrigger = ({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) => <SelectPrimitive.Trigger className={cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm', className)} {...props}>{children}<SelectPrimitive.Icon><ChevronDown className="h-4 w-4 opacity-50" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>;
export const SelectContent = ({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) => <SelectPrimitive.Portal><SelectPrimitive.Content className={cn('z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md', className)} {...props} /></SelectPrimitive.Portal>;
export const SelectItem = ({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) => <SelectPrimitive.Item className={cn('relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none focus:bg-accent', className)} {...props} />;
