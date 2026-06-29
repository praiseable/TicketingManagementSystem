import { Badge } from '@/components/ui/badge';
import type { Label } from '@/types';
export function LabelSelect({ labels = [] }: { labels?: Label[] }) { return <div className="flex flex-wrap gap-1">{labels.map((label) => <Badge key={label.id}>{label.name}</Badge>)}</div>; }
