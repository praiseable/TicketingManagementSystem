export * from '@prisma/client';

export interface SearchIssueDocument {
  id: string;
  key: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: string;
  assigneeId?: string | null;
  priority: string;
  labels: string[];
  sprintId?: string | null;
}

export interface StoredAttachmentRef {
  bucket: string;
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: bigint;
}
