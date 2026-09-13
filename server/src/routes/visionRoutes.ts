import { Router } from 'express';
import { VisionController } from '../controllers/visionController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Pipeline de digitalización de fotos/bocetos de pizarra (CU06)
router.post('/sketch-to-diagram', authMiddleware, VisionController.processSketchToDiagram);

export default router;
