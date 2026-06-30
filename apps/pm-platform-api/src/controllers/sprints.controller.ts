import { sprintService } from '../services/sprint.service.js';
import { asyncHandler, created, noContent, ok } from '../utils/apiResponse.js';

export const sprintsController = {
  list: asyncHandler(async (req, res) => ok(res, await sprintService.list(String(req.params.projectId)))),
  create: asyncHandler(async (req, res) => created(res, await sprintService.create(String(req.params.projectId), req.body))),
  get: asyncHandler(async (req, res) => ok(res, await sprintService.get(String(req.params.projectId), String(req.params.sprintId)))),
  update: asyncHandler(async (req, res) => ok(res, await sprintService.update(String(req.params.projectId), String(req.params.sprintId), req.body))),
  start: asyncHandler(async (req, res) => ok(res, await sprintService.start(String(req.params.projectId), String(req.params.sprintId)))),
  complete: asyncHandler(async (req, res) => ok(res, await sprintService.complete(String(req.params.projectId), String(req.params.sprintId), req.body.moveToSprintId))),
  remove: asyncHandler(async (req, res) => { await sprintService.delete(String(req.params.projectId), String(req.params.sprintId)); noContent(res); }),
  burndown: asyncHandler(async (req, res) => ok(res, await sprintService.burndown(String(req.params.sprintId)))),
  velocity: asyncHandler(async (req, res) => ok(res, await sprintService.velocity(String(req.params.projectId))))
};
