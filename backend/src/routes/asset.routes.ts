import { Router } from 'express';
import {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetHistory,
} from '../controllers/asset.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.get('/assets', authenticateToken, requireRole(['ADMIN', 'ANALYST', 'VIEWER']), getAssets);
router.get('/assets/:id/history', authenticateToken, requireRole(['ADMIN', 'ANALYST', 'VIEWER']), getAssetHistory);
router.get('/assets/:id', authenticateToken, requireRole(['ADMIN', 'ANALYST', 'VIEWER']), getAssetById);
router.post('/assets', authenticateToken, requireRole(['ADMIN']), createAsset);
router.put('/assets/:id', authenticateToken, requireRole(['ADMIN']), updateAsset);
router.delete('/assets/:id', authenticateToken, requireRole(['ADMIN']), deleteAsset);

export default router;
