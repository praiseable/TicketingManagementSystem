import { asyncHandler, created, ok } from '../utils/apiResponse.js';
import { githubService } from '../services/github.service.js';

function str(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
}

export const githubController = {
  receiveCommits: asyncHandler(async (req, res) => {
    const projectId = str(req.params.projectId);
    const result = await githubService.linkCommits(projectId, req.user!.id, req.body);
    created(res, result);
  }),

  issueCommits: asyncHandler(async (req, res) => {
    ok(res, await githubService.listIssueCommits(str(req.params.projectId), str(req.params.issueId)));
  })
};
