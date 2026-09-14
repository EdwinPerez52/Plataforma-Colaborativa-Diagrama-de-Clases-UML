import { Router } from 'express';
import { UmlController } from '../controllers/umlController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Diagrama completo normalizado
router.get('/projects/:id/diagram', authMiddleware, UmlController.getDiagram);

// Operaciones atómicas de Clases
router.post('/projects/:id/classes', authMiddleware, UmlController.createClass);
router.put('/classes/:id', authMiddleware, UmlController.updateClass);
router.delete('/classes/:id', authMiddleware, UmlController.deleteClass);

// Operaciones atómicas de Atributos
router.post('/classes/:id/attributes', authMiddleware, UmlController.createAttribute);
router.put('/attributes/:id', authMiddleware, UmlController.updateAttribute);
router.delete('/attributes/:id', authMiddleware, UmlController.deleteAttribute);

// Operaciones atómicas de Métodos
router.post('/classes/:id/methods', authMiddleware, UmlController.createMethod);
router.put('/methods/:id', authMiddleware, UmlController.updateMethod);
router.delete('/methods/:id', authMiddleware, UmlController.deleteMethod);

// Operaciones atómicas de Relaciones
router.post('/projects/:id/relationships', authMiddleware, UmlController.createRelationship);
router.put('/relationships/:id', authMiddleware, UmlController.updateRelationship);
router.delete('/relationships/:id', authMiddleware, UmlController.deleteRelationship);

export default router;
