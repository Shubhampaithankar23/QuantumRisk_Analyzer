import { Router } from 'express';
import { getHealth, getRules, getAuditLogs, getInstitution } from '../controllers/health.controller';

const router = Router();

router.get('/health', getHealth);
router.get('/system/rules', getRules);
router.get('/system/audit-logs', getAuditLogs);
router.get('/system/institution', getInstitution);

export default router;
