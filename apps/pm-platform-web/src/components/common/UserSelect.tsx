import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { User } from '@/types';
export function UserSelect({ users = [], value, onValueChange }: { users?: User[]; value?: string; onValueChange?: (value: string) => void }) { return <Select value={value} onValueChange={onValueChange}><SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger><SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>; }
