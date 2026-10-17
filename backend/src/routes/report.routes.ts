import { Router } from 'express';
import { getReportSummary, exportPdfReport } from '../controllers/report.controller';

const router = Router();

router.get('/reports/summary', getReportSummary);
router.get('/reports/export/pdf', exportPdfReport);

export default router;
