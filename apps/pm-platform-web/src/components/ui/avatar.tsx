import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/utils/cn';
export const Avatar = ({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) => <AvatarPrimitive.Root className={cn('relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full', className)} {...props} />;
export const AvatarImage = AvatarPrimitive.Image;
export const AvatarFallback = ({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) => <AvatarPrimitive.Fallback className={cn('flex h-full w-full items-center justify-center rounded-full bg-muted text-xs font-semibold', className)} {...props} />;
