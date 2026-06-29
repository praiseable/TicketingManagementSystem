import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '@/components/common/EmptyState';
export function TimeLoggedChart({ data = [] }: { data?: { date: string; hours: number }[] }) { if (!data.length) return <EmptyState title="No time logged" />; return <div className="h-72 rounded-lg border p-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="hours" /></BarChart></ResponsiveContainer></div>; }
