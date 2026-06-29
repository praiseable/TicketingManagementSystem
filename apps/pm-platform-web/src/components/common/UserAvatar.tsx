import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { User } from '@/types';
export function UserAvatar({ user, className }: { user?: User | null; className?: string }) { const initials = user?.name?.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase() || '?'; return <Avatar className={className}><AvatarImage src={user?.avatarUrl ?? undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar>; }
