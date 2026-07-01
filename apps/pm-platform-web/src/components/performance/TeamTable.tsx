import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { TeamPerformanceRow } from '@/types';

const helper = createColumnHelper<TeamPerformanceRow>();

const columns = [
  helper.accessor((row) => row.user.name || row.user.email, { id: 'member', header: 'Member' }),
  helper.accessor('projectRole', { header: 'Role' }),
  helper.accessor((row) => row.summary.issuesAssigned, { id: 'assigned', header: 'Assigned' }),
  helper.accessor((row) => row.summary.issuesCompleted, { id: 'completed', header: 'Completed' }),
  helper.accessor((row) => row.summary.hoursLogged, { id: 'hours', header: 'Hours', cell: (info) => Number(info.getValue()).toFixed(1) }),
  helper.accessor((row) => row.summary.onTimePct, { id: 'onTime', header: 'On-time %', cell: (info) => `${Math.round(Number(info.getValue()))}%` }),
  helper.accessor((row) => row.summary.storyPointsDelivered, { id: 'points', header: 'Points' })
];

export function TeamTable({ data = [] }: { data?: TeamPerformanceRow[] }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>{group.headers.map((h) => <th key={h.id} className="border-b p-3 text-left font-medium">{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id} className="border-b p-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
          ))}
          {!data.length && <tr><td className="p-6 text-center text-muted-foreground" colSpan={columns.length}>No team performance data for this range.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
