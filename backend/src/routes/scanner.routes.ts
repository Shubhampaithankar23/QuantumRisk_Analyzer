import { Router } from 'express';
import {
  startScan,
  getScans,
  getScanById,
  deleteScan,
  clearAllScans,
} from '../controllers/scanner.controller';
import { scanLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/scans', scanLimiter, startScan);
router.get('/scans', getScans);
router.get('/scans/:id', getScanById);
router.delete('/scans', clearAllScans);
router.delete('/scans/:id', deleteScan);

export default router;
