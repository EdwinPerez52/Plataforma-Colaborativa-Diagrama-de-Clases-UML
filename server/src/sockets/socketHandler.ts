import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { RoomManager } from '../services/RoomManager';
import { SOCKET_EVENTS } from '../types/collaboration';
import { UmlClass, UmlRelationship } from '../types/uml';
import { DistributedLockService } from '../services/DistributedLockService';
import { UmlAtomicService } from '../services/UmlAtomicService';
import { AuthPayload } from '../types/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_case_collaborative_2026';

export function setupSocketHandlers(io: Server, roomManager: RoomManager) {
  // Routine reaper cada 2.5 segundos para limpiar locks vencidos en PostgreSQL
  setInterval(async () => {
    try {
      const purged = await DistributedLockService.purgeExpiredLocks();
      for (const item of purged) {
        io.emit('node:unlocked', { classId: item.classId, nodeId: String(item.classId) });
        io.emit(SOCKET_EVENTS.LOCK_RELEASED, { nodeId: String(item.classId) });
      }
    } catch {
      // Ignorar errores transitorios de polling
    }
  }, 2500);

  io.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null;
    let currentProjectId: number = 1;
    let authUser: AuthPayload | null = null;

    // Extraer y verificar JWT del handshake si se provee
    const rawToken =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.headers?.authorization?.replace('Bearer ', '') as string);

    if (rawToken) {
      try {
        authUser = jwt.verify(rawToken, JWT_SECRET) as AuthPayload;
      } catch {
        // Token no provisto o inválido
      }
    }

    // 1. Unirse a una sala de diseño y registrar sesión activa
    socket.on(
      SOCKET_EVENTS.JOIN_ROOM,
      async (data: { roomId: string; projectId?: number; userName?: string; userColor?: string; token?: string }) => {
        const { roomId, projectId, userName, userColor, token } = data;
        if (!roomId) return;

        if (token && !authUser) {
          try {
            authUser = jwt.verify(token, JWT_SECRET) as AuthPayload;
          } catch {
            // Ignorar token malformado
          }
        }

        if (currentRoomId && currentRoomId !== roomId) {
          await handleLeaveRoom(socket, currentRoomId);
        }

        currentRoomId = roomId;
        if (projectId) currentProjectId = projectId;
        socket.join(roomId);

        const effectiveUserId = authUser?.userId || 1;
        const effectiveName = userName || authUser?.email?.split('@')[0] || 'Ingeniero Colaborador';

        // Registrar en sesiones_activas de PostgreSQL
        try {
          await DistributedLockService.registerSession(
            currentProjectId,
            effectiveUserId,
            socket.id,
            socket.handshake.address
          );
        } catch {
          // Si la BD no tiene el proyecto aún, continuar
        }

        const { user, state } = roomManager.joinRoom(roomId, socket.id, effectiveName, userColor);

        // Enviar estado de sala y locks activos de PostgreSQL
        try {
          const activeLocks = await DistributedLockService.getActiveLocks(currentProjectId);
          socket.emit('active_locks', activeLocks);
        } catch {
          // Fallback a memoria
        }

        socket.emit(SOCKET_EVENTS.ROOM_STATE, state);
        socket.to(roomId).emit(SOCKET_EVENTS.USER_JOINED, user);

        console.log(`[Colaboración] Ingeniero '${user.name}' conectado a la sala '${roomId}'`);
      }
    );

    // 2. Movimiento de Cursor en Tiempo Real
    socket.on(
      SOCKET_EVENTS.CURSOR_MOVE,
      (data: { roomId: string; cursor: { x: number; y: number } }) => {
        const { roomId, cursor } = data;
        if (!roomId || !cursor) return;

        const user = roomManager.updateCursor(roomId, socket.id, cursor);
        if (user) {
          socket.to(roomId).emit(SOCKET_EVENTS.CURSOR_UPDATED, {
            userId: socket.id,
            cursor: user.cursor,
          });
        }
      }
    );

    // 3. Exclusión Mutua: Solicitud de Bloqueo por Arrendamiento (Lease: 5s)
    const handleLockRequest = async (data: {
      roomId: string;
      projectId?: number;
      classId?: number;
      nodeId?: string;
    }) => {
      const roomId = data.roomId || currentRoomId;
      const nodeId = data.nodeId || (data.classId ? String(data.classId) : '');
      const numClassId = data.classId || (data.nodeId && !isNaN(Number(data.nodeId)) ? Number(data.nodeId) : null);
      const pId = data.projectId || currentProjectId;
      const effectiveUserId = authUser?.userId || (data as any)?.userId || 1;

      if (!roomId || !nodeId) return;

      // Adquisición en memoria (RoomManager) para garantizar exclusión mutua instantánea
      const memResult = roomManager.acquireNodeLock(roomId, nodeId, socket.id);

      // Si es un ID numérico, persistir también en bloqueos_nodos de PostgreSQL
      if (numClassId) {
        try {
          await DistributedLockService.acquireLock(pId, numClassId, effectiveUserId);
        } catch {
          // Ignorar si el test usa IDs no relacionales
        }
      }

      if (memResult.success && memResult.lock) {
        const lockPayload = {
          classId: numClassId || nodeId,
          nodeId,
          userId: String(effectiveUserId),
          userName: memResult.lock.userName,
          userColor: memResult.lock.userColor,
          expiraEn: new Date(memResult.lock.expiresAt).toISOString(),
        };

        io.in(roomId).emit('node:locked', lockPayload);
        io.in(roomId).emit(SOCKET_EVENTS.LOCK_ACQUIRED, {
          nodeId,
          lock: memResult.lock,
        });
      } else {
        const lockedBy = memResult.lockedBy;
        const deniedPayload = {
          classId: numClassId || nodeId,
          nodeId,
          reason: `El elemento está siendo editado por ${lockedBy?.userName || 'otro ingeniero'}`,
          lockedBy,
        };

        socket.emit('node:lock:denied', deniedPayload);
        socket.emit(SOCKET_EVENTS.LOCK_DENIED, deniedPayload);
      }
    };

    socket.on('node:lock:request', handleLockRequest);
    socket.on(SOCKET_EVENTS.ACQUIRE_LOCK, handleLockRequest);

    // 4. Latido de Renovación (Heartbeat cada 2s)
    socket.on(
      'node:heartbeat',
      async (data: { roomId?: string; projectId?: number; classId: number }) => {
        const pId = data.projectId || currentProjectId;
        const classId = data.classId;
        const effectiveUserId = authUser?.userId || 1;

        if (!classId) return;

        try {
          const renewed = await DistributedLockService.renewHeartbeat(pId, classId, effectiveUserId);
          socket.emit('node:heartbeat:ack', { classId, renewed });
          if (renewed && currentRoomId) {
            io.in(currentRoomId).emit('node:lock:renewed', { classId, userId: effectiveUserId });
          }
        } catch {
          // Silencioso
        }
      }
    );

    // 5. Liberación y Actualización Atómica ('node:update:release')
    socket.on(
      'node:update:release',
      async (data: { roomId?: string; projectId?: number; classId: number; updates?: any }) => {
        const roomId = data.roomId || currentRoomId;
        const pId = data.projectId || currentProjectId;
        const classId = data.classId;
        const effectiveUserId = authUser?.userId || 1;

        if (!classId || !roomId) return;

        try {
          if (data.updates) {
            const updatedClass = await UmlAtomicService.updateClass(classId, data.updates);
            io.in(roomId).emit('node:updated', { classId, class: updatedClass });
            io.in(roomId).emit(SOCKET_EVENTS.NODE_UPDATED, updatedClass);
          }

          await DistributedLockService.releaseLock(pId, classId, effectiveUserId);
        } catch (err: any) {
          console.error('[node:update:release] Error:', err);
        }

        roomManager.releaseNodeLock(roomId, String(classId), socket.id);
        io.in(roomId).emit('node:unlocked', { classId, nodeId: String(classId) });
        io.in(roomId).emit(SOCKET_EVENTS.LOCK_RELEASED, { nodeId: String(classId) });
      }
    );

    // 6. Liberación simple de Lock ('node:release' y 'release_lock')
    const handleReleaseLock = async (data: {
      roomId?: string;
      projectId?: number;
      classId?: number;
      nodeId?: string;
    }) => {
      const roomId = data.roomId || currentRoomId;
      const nodeId = data.nodeId || (data.classId ? String(data.classId) : '');
      const numClassId = data.classId || (data.nodeId && !isNaN(Number(data.nodeId)) ? Number(data.nodeId) : null);
      const pId = data.projectId || currentProjectId;
      const effectiveUserId = authUser?.userId || (data as any)?.userId || 1;

      if (!roomId || !nodeId) return;

      if (numClassId) {
        try {
          await DistributedLockService.releaseLock(pId, numClassId, effectiveUserId);
        } catch {
          // ignore
        }
      }

      const memResult = roomManager.releaseNodeLock(roomId, nodeId, socket.id);
      if (memResult.success && memResult.released) {
        io.in(roomId).emit('node:unlocked', { classId: numClassId || nodeId, nodeId });
        io.in(roomId).emit(SOCKET_EVENTS.LOCK_RELEASED, { nodeId });
      }
    };

    socket.on('node:release', handleReleaseLock);
    socket.on('node:unlock', handleReleaseLock);
    socket.on(SOCKET_EVENTS.RELEASE_LOCK, handleReleaseLock);

    // 7. Eventos de Diagrama (Agregar, Actualizar, Eliminar)
    socket.on(SOCKET_EVENTS.ADD_NODE, (data: { roomId: string; node: UmlClass }) => {
      const { roomId, node } = data;
      if (!roomId || !node) return;
      roomManager.diagramManager.addClass(roomId, node);
      io.in(roomId).emit(SOCKET_EVENTS.NODE_ADDED, node);
    });

    socket.on(
      SOCKET_EVENTS.UPDATE_NODE,
      (data: { roomId: string; node: UmlClass; releaseLockAfter?: boolean }) => {
        const { roomId, node, releaseLockAfter } = data;
        if (!roomId || !node) return;

        const result = roomManager.diagramManager.updateClass(roomId, node);
        if (result.updatedClass) {
          io.in(roomId).emit(SOCKET_EVENTS.NODE_UPDATED, result.updatedClass);
        }

        if (releaseLockAfter) {
          handleReleaseLock({ roomId, nodeId: node.id });
        }
      }
    );

    socket.on(SOCKET_EVENTS.DELETE_NODE, (data: { roomId: string; nodeId: string }) => {
      const { roomId, nodeId } = data;
      if (!roomId || !nodeId) return;
      handleReleaseLock({ roomId, nodeId });
      roomManager.diagramManager.deleteClass(roomId, nodeId);
      io.in(roomId).emit(SOCKET_EVENTS.NODE_DELETED, { nodeId });
    });

    socket.on(SOCKET_EVENTS.ADD_EDGE, (data: { roomId: string; edge: UmlRelationship }) => {
      const { roomId, edge } = data;
      if (!roomId || !edge) return;
      const result = roomManager.diagramManager.addRelationship(roomId, edge);
      if (result.createdIntermediateClass) {
        io.in(roomId).emit(SOCKET_EVENTS.NODE_ADDED, result.createdIntermediateClass);
        if (result.createdRelationships) {
          for (const r of result.createdRelationships) {
            io.in(roomId).emit(SOCKET_EVENTS.EDGE_ADDED, r);
          }
        }
      }
      io.in(roomId).emit(SOCKET_EVENTS.EDGE_ADDED, edge);
    });

    socket.on(SOCKET_EVENTS.UPDATE_EDGE, (data: { roomId: string; edge: UmlRelationship }) => {
      const { roomId, edge } = data;
      if (!roomId || !edge) return;
      const result = roomManager.diagramManager.updateRelationship(roomId, edge);
      if (result.createdIntermediateClass) {
        io.in(roomId).emit(SOCKET_EVENTS.NODE_ADDED, result.createdIntermediateClass);
        if (result.createdRelationships) {
          for (const r of result.createdRelationships) {
            io.in(roomId).emit(SOCKET_EVENTS.EDGE_ADDED, r);
          }
        }
      }
      if (result.removedIntermediateClassId) {
        io.in(roomId).emit(SOCKET_EVENTS.NODE_DELETED, { nodeId: result.removedIntermediateClassId });
      }
      io.in(roomId).emit(SOCKET_EVENTS.EDGE_UPDATED, edge);
    });

    socket.on(SOCKET_EVENTS.DELETE_EDGE, (data: { roomId: string; edgeId: string }) => {
      const { roomId, edgeId } = data;
      if (!roomId || !edgeId) return;
      roomManager.diagramManager.deleteRelationship(roomId, edgeId);
      io.in(roomId).emit(SOCKET_EVENTS.EDGE_DELETED, { edgeId });
    });

    // 8. Desconexión del cliente y liberación automática de recursos
    socket.on('disconnect', async () => {
      if (currentRoomId) {
        await handleLeaveRoom(socket, currentRoomId);
      }
    });

    async function handleLeaveRoom(s: Socket, roomId: string) {
      // 1. Cerrar sesión en PostgreSQL
      try {
        await DistributedLockService.closeSession(s.id);
        const effectiveUserId = authUser?.userId || 1;
        const releasedIds = await DistributedLockService.releaseAllUserLocks(currentProjectId, effectiveUserId);
        for (const cid of releasedIds) {
          io.in(roomId).emit('node:unlocked', { classId: cid, nodeId: String(cid) });
          io.in(roomId).emit(SOCKET_EVENTS.LOCK_RELEASED, { nodeId: String(cid) });
        }
      } catch {
        // Silencioso
      }

      // 2. Notificar salida en memoria
      const { user, releasedLocks } = roomManager.leaveRoom(roomId, s.id);
      s.leave(roomId);

      if (user) {
        s.to(roomId).emit(SOCKET_EVENTS.USER_LEFT, { userId: user.id });
        console.log(`[Colaboración] Ingeniero '${user.name}' salió de la sala '${roomId}'`);
      }

      for (const nodeId of releasedLocks) {
        io.in(roomId).emit(SOCKET_EVENTS.LOCK_RELEASED, { nodeId });
      }
    }
  });
}
