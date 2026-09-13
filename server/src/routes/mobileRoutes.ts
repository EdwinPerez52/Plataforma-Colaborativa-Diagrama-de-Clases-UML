import { Router } from 'express';
import { MobileController } from '../controllers/mobileController';

const router = Router();

// Sincronización batch del Outbox
router.post('/sync', MobileController.processSyncBatch);

// Endpoints REST de consumo móvil directo
router.post('/pacientes', MobileController.createPaciente);
router.post('/consultas', MobileController.createConsulta);

export default router;
