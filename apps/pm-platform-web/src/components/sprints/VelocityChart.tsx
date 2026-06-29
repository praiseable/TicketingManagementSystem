import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/common/EmptyState';
export function VelocityChart({ data = [] }: { data?: { name: string; committed: number; completed: number }[] }) { if (!data.length) return <EmptyState title="No velocity data" />; return <div className="h-72 rounded-lg border p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="committed" /><Bar dataKey="completed" /></BarChart></ResponsiveContainer></div>; }
