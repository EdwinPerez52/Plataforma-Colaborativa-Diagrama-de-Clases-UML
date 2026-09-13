import { Router } from 'express';
import { AiController } from '../controllers/aiController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Ejecución atómica de comando en lenguaje natural (voz o texto)
router.post('/command', authMiddleware, AiController.executeCommand);

// Consulta de auditoría histórica para el proyecto
router.get('/projects/:id/ai-audit', authMiddleware, AiController.getAudit);

export default router;
