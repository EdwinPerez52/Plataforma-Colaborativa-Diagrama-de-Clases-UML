import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Rutas públicas
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/guest-token', AuthController.getGuestToken);

// Rutas protegidas con JWT
router.get('/me', authMiddleware, AuthController.getProfile);

export default router;
