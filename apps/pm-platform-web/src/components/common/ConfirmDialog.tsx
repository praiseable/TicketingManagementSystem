import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
export function ConfirmDialog({ children, title, onConfirm }: { children: React.ReactNode; title: string; onConfirm: () => void }) { return <Dialog><DialogTrigger asChild>{children}</DialogTrigger><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="flex justify-end gap-2"><Button variant="destructive" onClick={onConfirm}>Confirm</Button></div></DialogContent></Dialog>; }
