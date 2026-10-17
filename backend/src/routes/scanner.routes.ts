import { Router } from 'express';
import { startScan, getScans, getScanById } from '../controllers/scanner.controller';
import { scanLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/scans', scanLimiter, startScan);
router.get('/scans', getScans);
router.get('/scans/:id', getScanById);

export default router;
