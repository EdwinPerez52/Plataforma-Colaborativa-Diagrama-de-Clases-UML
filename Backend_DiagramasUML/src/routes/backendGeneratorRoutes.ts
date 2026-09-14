import { Router } from 'express';
import { BackendGeneratorController } from '../controllers/backendGeneratorController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Generar proyecto Spring Boot en 5 capas y empaquetar en ZIP (CU08)
router.post('/projects/:id/generate', authMiddleware, BackendGeneratorController.generateBackend);

// Descargar archivo ZIP empaquetado (CU08)
router.get('/projects/:id/download', authMiddleware, BackendGeneratorController.downloadZip);

// Historial de trazabilidad y descargas (CU08)
router.get('/projects/:id/history', authMiddleware, BackendGeneratorController.getHistory);

export default router;
