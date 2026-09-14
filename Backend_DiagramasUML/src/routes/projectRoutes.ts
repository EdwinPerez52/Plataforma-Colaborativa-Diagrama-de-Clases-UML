import { Router } from 'express';
import { ProjectController } from '../controllers/projectController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Todas las rutas de proyectos requieren autenticación JWT
router.use(authMiddleware);

router.post('/', ProjectController.createProject);
router.get('/', ProjectController.getMyProjects);
router.post('/join', ProjectController.joinProject);
router.get('/:id', ProjectController.getProjectDetails);
router.put('/:id', ProjectController.updateProject);
router.delete('/:id', ProjectController.deleteProject);

export default router;
