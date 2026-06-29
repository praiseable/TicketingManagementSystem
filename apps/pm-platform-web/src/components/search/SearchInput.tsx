import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
export function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={value} onChange={(e) => onChange(e.target.value)} className="pl-9" placeholder="Search issues, projects, pages…" /></div>; }
