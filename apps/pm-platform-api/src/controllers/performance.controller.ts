import { stringify } from 'csv-stringify/sync';
import { performanceService } from '../services/performance.service.js';
import { asyncHandler, ok } from '../utils/apiResponse.js';

export const performanceController = {
  me: asyncHandler(async (req, res) => ok(res, await performanceService.getMyPerformance(req.user!, req.query as Record<string, unknown>))),
  team: asyncHandler(async (req, res) => ok(res, await performanceService.getTeamPerformance(req.user!, req.query as Record<string, unknown>))),
  timeReport: asyncHandler(async (req, res) => ok(res, await performanceService.getTimeReport(req.user!, req.query as Record<string, unknown>))),
  exportTime: asyncHandler(async (req, res) => {
    const { csv } = await performanceService.timeReportCsv(req.user!, req.query as Record<string, unknown>, stringify);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('time-report.csv');
    res.send(csv);
  })
};
