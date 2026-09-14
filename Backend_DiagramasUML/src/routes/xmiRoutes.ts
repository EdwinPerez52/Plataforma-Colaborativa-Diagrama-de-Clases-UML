import { Router } from 'express';
import { XmiController } from '../controllers/xmiController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Exportación XMI 2.1 compatible con Enterprise Architect
router.get('/projects/:id/export', authMiddleware, XmiController.exportXmi);

// Validación y previsualización previa de archivo XMI
router.post('/validate', authMiddleware, XmiController.validateXmi);

// Importación transaccional de esquema XMI a PostgreSQL 17
router.post('/projects/:id/import', authMiddleware, XmiController.importXmi);

export default router;
