import { timerService } from '../services/timer.service.js';
import { asyncHandler, created, ok } from '../utils/apiResponse.js';

export const timersController = {
  start: asyncHandler(async (req, res) => created(res, await timerService.startTimer(req.user!.id, req.body.issueId))),
  pause: asyncHandler(async (req, res) => ok(res, await timerService.pauseTimer(req.user!.id, req.body.issueId))),
  stop: asyncHandler(async (req, res) => created(res, await timerService.stopTimer(req.user!.id, req.body.issueId))),
  active: asyncHandler(async (req, res) => ok(res, await timerService.getActiveTimers(req.user!.id)))
};
