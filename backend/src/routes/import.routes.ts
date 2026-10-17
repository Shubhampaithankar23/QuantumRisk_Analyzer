import { Router } from 'express';
import multer from 'multer';
import {
  previewFiles,
  executeImport,
  getImportHistory,
} from '../controllers/import.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max file size
    files: 10, // Max 10 files per request
  },
});

router.post('/imports/preview', upload.array('files', 10), previewFiles);
router.post('/imports/execute', executeImport);
router.get('/imports/history', getImportHistory);

export default router;
