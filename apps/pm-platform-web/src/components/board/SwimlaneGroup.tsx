import type { Issue } from '@/types';
export function SwimlaneGroup({ label, children }: { label: string; issues?: Issue[]; children: React.ReactNode }) { return <div className="min-w-max"><div className="sticky left-0 z-10 mb-2 rounded-md bg-background px-2 py-1 text-sm font-semibold shadow-sm">{label}</div>{children}</div>; }
