import { Router } from 'express';
import {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetHistory,
} from '../controllers/asset.controller';

const router = Router();

router.get('/assets', getAssets);
router.get('/assets/:id/history', getAssetHistory);
router.get('/assets/:id', getAssetById);
router.post('/assets', createAsset);
router.put('/assets/:id', updateAsset);
router.delete('/assets/:id', deleteAsset);

export default router;
