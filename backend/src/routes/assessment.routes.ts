import { Router } from 'express';
import {
  runAssetAssessment,
  runAllAssetAssessments,
  getAssessments,
  getAssessmentById,
  getFindings,
  updateFinding,
  getRecommendations,
} from '../controllers/assessment.controller';

const router = Router();

router.post('/assessments/run/:assetId', runAssetAssessment);
router.post('/assessments/run-all', runAllAssetAssessments);
router.get('/assessments', getAssessments);
router.get('/assessments/:id', getAssessmentById);
router.get('/findings', getFindings);
router.patch('/findings/:id', updateFinding);
router.get('/recommendations', getRecommendations);

export default router;
