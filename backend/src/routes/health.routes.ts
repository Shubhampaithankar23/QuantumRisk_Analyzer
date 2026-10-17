import { Router } from 'express';
import { getHealth, getRules } from '../controllers/health.controller';

const router = Router();

router.get('/health', getHealth);
router.get('/system/rules', getRules);

export default router;
