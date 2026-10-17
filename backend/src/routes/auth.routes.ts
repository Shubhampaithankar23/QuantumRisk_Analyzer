import { Router } from 'express';
import { login, getMe, seedDemo } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authenticateToken, getMe);
router.post('/seed-demo', seedDemo);

export default router;
