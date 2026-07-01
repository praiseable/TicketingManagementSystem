import { worklogService, isWorklogAdmin } from '../services/worklog.service.js';
import { asyncHandler, created, noContent, ok } from '../utils/apiResponse.js';

export const worklogsController = {
  list: asyncHandler(async (req, res) => ok(res, await worklogService.list(req.params.issueId))),
  create: asyncHandler(async (req, res) => created(res, await worklogService.create(req.params.issueId, req.user!.id, req.body))),
  update: asyncHandler(async (req, res) => ok(res, await worklogService.update(req.params.worklogId, req.user!.id, isWorklogAdmin(req.user!.role), req.body))),
  remove: asyncHandler(async (req, res) => { await worklogService.delete(req.params.worklogId, req.user!.id, isWorklogAdmin(req.user!.role)); noContent(res); })
};
