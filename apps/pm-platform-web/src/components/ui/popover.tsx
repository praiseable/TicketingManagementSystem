import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/utils/cn';
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverContent = ({ className, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) => <PopoverPrimitive.Portal><PopoverPrimitive.Content className={cn('z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none', className)} sideOffset={4} {...props} /></PopoverPrimitive.Portal>;
