import { useRef, useState } from 'react';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { attachmentsApi } from '@/api/attachments.api';
import { queryKeys } from '@/api/queryKeys';
import { formatBytes } from '@/utils/formatters';
import type { Attachment } from '@/types';

export function AttachmentUpload({ issueId, attachments = [] }: { issueId: string; attachments?: Attachment[] }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.issue(issueId) });
  const upload = useMutation({ mutationFn: (file: File) => attachmentsApi.upload(issueId, file), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => attachmentsApi.remove(issueId, id), onSuccess: refresh });
  async function openAttachment(id: string) {
    const { url } = await attachmentsApi.url(issueId, id);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function handleFiles(files: FileList | null) { if (files?.[0]) upload.mutate(files[0]); }

  return <div className="space-y-3 rounded-xl border bg-card p-4">
    <div className="flex items-center justify-between"><h3 className="font-semibold">Attachments <span className="text-xs text-muted-foreground">({attachments.length})</span></h3><Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Upload</Button></div>
    <div className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-sm transition ${dragging ? 'border-primary bg-primary/10' : 'text-muted-foreground'}`} onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}>
      <Upload className="mb-2 h-5 w-5" />
      {upload.isPending ? 'Uploading…' : 'Drop files here or click to upload'}
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {attachments.map((a) => <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-3 text-xs">
        <div className="min-w-0"><div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{a.filename}</span></div><div className="text-muted-foreground">{formatBytes(Number(a.sizeBytes))} · {a.user?.name ?? 'User'}</div></div>
        <div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" onClick={() => openAttachment(a.id)}><Download className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button></div>
      </div>)}
      {!attachments.length && <p className="text-sm text-muted-foreground">No attachments yet.</p>}
    </div>
  </div>;
}
