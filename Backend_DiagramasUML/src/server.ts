import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RoomManager } from './services/RoomManager';
import { setupSocketHandlers } from './sockets/socketHandler';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import umlRoutes from './routes/umlRoutes';
import aiRoutes from './routes/aiRoutes';
import visionRoutes from './routes/visionRoutes';
import xmiRoutes from './routes/xmiRoutes';
import backendGeneratorRoutes from './routes/backendGeneratorRoutes';
import mobileRoutes from './routes/mobileRoutes';

dotenv.config();

export function createServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json());

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  const roomManager = new RoomManager();
  setupSocketHandlers(io, roomManager);

  // Rutas REST v1 (Fases 3-10: Autenticación, Proyectos, UML, IA, Visión, XMI, Backend Generator y Móvil)
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/projects', projectRoutes);
  app.use('/api/v1', umlRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/vision', visionRoutes);
  app.use('/api/v1/xmi', xmiRoutes);
  app.use('/api/v1/backend', backendGeneratorRoutes);
  app.use('/api/v1/mobile', mobileRoutes);

  // Endpoint de salud / monitoreo
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'Collaborative CASE Tool Server'
    });
  });

  // Endpoint para inspeccionar el estado del diagrama de una sala
  app.get('/api/rooms/:roomId/diagram', (req, res) => {
    const { roomId } = req.params;
    const state = roomManager.getRoomState(roomId);
    res.json(state);
  });

  return { app, server, io, roomManager };
}

// Iniciar servidor si se ejecuta directamente
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  const { server } = createServer();

  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Servidor CASE Colaborativo corriendo en el puerto ${PORT}`);
    console.log(`📡 WebSocket y API REST listos para sincronización`);
    console.log(`🔒 Control de Exclusión Mutua activo`);
    console.log(`====================================================`);
  });
}
