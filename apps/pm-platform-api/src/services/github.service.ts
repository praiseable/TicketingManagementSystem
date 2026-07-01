import { prisma, NotificationType } from '@pm-platform/db';
import { AppError } from '../utils/apiResponse.js';
import { notificationService } from './notification.service.js';
import { webhookService } from './webhook.service.js';

type CommitInput = {
  sha: string;
  message: string;
  url?: string;
  author?: string;
  repo?: string;
  branch?: string;
};

function extractKeys(projectKey: string, text: string) {
  const rx = new RegExp(`\\b${projectKey}-\\d+\\b`, 'gi');
  return [...new Set((text.match(rx) ?? []).map((key) => key.toUpperCase()))];
}

function normalizeCommits(input: any): CommitInput[] {
  const commits = Array.isArray(input?.commits) ? input.commits : [input];
  return commits
    .filter(Boolean)
    .map((commit: any) => ({
      sha: String(commit.sha ?? commit.id ?? '').trim(),
      message: String(commit.message ?? commit.title ?? '').trim(),
      url: commit.url ? String(commit.url) : commit.html_url ? String(commit.html_url) : undefined,
      author: commit.author ? (typeof commit.author === 'string' ? commit.author : String(commit.author.name ?? commit.author.email ?? '')) : undefined,
      repo: commit.repo ? String(commit.repo) : input?.repository?.full_name ? String(input.repository.full_name) : undefined,
      branch: commit.branch ? String(commit.branch) : undefined
    }))
    .filter((commit) => commit.sha && commit.message);
}

export const githubService = {
  async linkCommits(projectId: string, userId: string, input: any) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, key: true } });
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    const commits = normalizeCommits(input);
    const linked: any[] = [];
    const ignored: any[] = [];

    for (const commit of commits) {
      const keys = extractKeys(project.key, commit.message);
      if (!keys.length) {
        ignored.push({ sha: commit.sha, reason: 'NO_ISSUE_KEY' });
        continue;
      }

      const issues = await prisma.issue.findMany({
        where: { projectId, key: { in: keys } },
        include: { assignee: { select: { id: true } }, reporter: { select: { id: true } } }
      });
      if (!issues.length) {
        ignored.push({ sha: commit.sha, reason: 'ISSUE_KEY_NOT_FOUND', keys });
        continue;
      }

      for (const issue of issues) {
        const payload = {
          sha: commit.sha,
          message: commit.message,
          url: commit.url ?? null,
          author: commit.author ?? null,
          repo: commit.repo ?? null,
          branch: commit.branch ?? null,
          linkedById: userId
        };
        await prisma.issueHistory.create({
          data: {
            issueId: issue.id,
            userId,
            field: 'github.commit',
            oldValue: null,
            newValue: JSON.stringify(payload)
          }
        });
        const notificationUserIds = [...new Set([issue.assignee?.id, issue.reporter?.id].filter(Boolean))] as string[];
        for (const targetUserId of notificationUserIds) {
          if (targetUserId !== userId) {
            await notificationService.notify(targetUserId, NotificationType.ISSUE_UPDATED, `${issue.key} linked to commit`, commit.message.slice(0, 160), 'issue', issue.id);
          }
        }
        linked.push({ issueId: issue.id, issueKey: issue.key, sha: commit.sha, url: commit.url ?? null, message: commit.message });
      }
    }

    if (linked.length) await webhookService.queueProjectEvent(projectId, 'github.commit.linked', { projectId, linked, ignored, commits });
    return { linked, ignored, count: linked.length };
  },

  async listIssueCommits(projectId: string, issueId: string) {
    const issue = await prisma.issue.findFirst({ where: { id: issueId, projectId }, select: { id: true } });
    if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Issue not found');
    const rows = await prisma.issueHistory.findMany({
      where: { issueId, field: 'github.commit' },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, name: true } } }
    });
    return rows.map((row) => {
      let commit: any = {};
      try { commit = JSON.parse(row.newValue ?? '{}'); } catch { commit = { raw: row.newValue }; }
      return { id: row.id, at: row.createdAt, linkedBy: row.user, ...commit };
    });
  }
};
