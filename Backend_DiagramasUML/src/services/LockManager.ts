import { NodeLock, User } from '../types/collaboration';

export class LockManager {
  // Mapa de roomId -> (nodeId -> NodeLock)
  private locks: Map<string, Map<string, NodeLock>> = new Map();
  private defaultTtlMs: number = 5 * 1000; // 5 segundos por defecto (Lease PUDS)

  constructor(defaultTtlMs?: number) {
    if (defaultTtlMs) {
      this.defaultTtlMs = defaultTtlMs;
    }
  }

  /**
   * Intenta adquirir un lock sobre un nodo.
   * Si ya está bloqueado por otro usuario y no ha expirado, retorna success: false.
   */
  public acquireLock(
    roomId: string,
    nodeId: string,
    user: User,
    ttlMs?: number
  ): { success: boolean; lock?: NodeLock; lockedBy?: NodeLock } {
    const roomLocks = this.getOrCreateRoomLocks(roomId);
    this.cleanExpiredLocks(roomId);

    const existingLock = roomLocks.get(nodeId);
    const now = Date.now();

    if (existingLock && existingLock.expiresAt > now) {
      // Ya está bloqueado
      if (existingLock.userId === user.id || existingLock.userName === user.name) {
        // Renovación de lock por el mismo usuario
        existingLock.expiresAt = now + (ttlMs || this.defaultTtlMs);
        existingLock.userId = user.id;
        return { success: true, lock: existingLock };
      }
      // Bloqueado por otro usuario (Exclusión mutua activa)
      return { success: false, lockedBy: existingLock };
    }

    // Crear nuevo lock
    const newLock: NodeLock = {
      nodeId,
      userId: user.id,
      userName: user.name,
      userColor: user.color,
      acquiredAt: now,
      expiresAt: now + (ttlMs || this.defaultTtlMs)
    };

    roomLocks.set(nodeId, newLock);
    return { success: true, lock: newLock };
  }

  /**
   * Libera el lock de un nodo específico si pertenece al usuario solicitante.
   */
  public releaseLock(
    roomId: string,
    nodeId: string,
    userId: string
  ): { success: boolean; released: boolean } {
    const roomLocks = this.locks.get(roomId);
    if (!roomLocks) return { success: true, released: false };

    const lock = roomLocks.get(nodeId);
    if (!lock) return { success: true, released: false };

    if (lock.userId === userId || lock.userName === userId) {
      roomLocks.delete(nodeId);
      return { success: true, released: true };
    }

    // El usuario intentó liberar un lock que no le pertenece
    return { success: false, released: false };
  }

  /**
   * Libera todos los locks que posea un usuario en una sala (ej. cuando se desconecta).
   * Retorna la lista de nodeIds liberados para notificar a los demás clientes.
   */
  public releaseAllUserLocks(roomId: string, userId: string): string[] {
    const roomLocks = this.locks.get(roomId);
    if (!roomLocks) return [];

    const releasedNodeIds: string[] = [];
    for (const [nodeId, lock] of roomLocks.entries()) {
      if (lock.userId === userId) {
        roomLocks.delete(nodeId);
        releasedNodeIds.push(nodeId);
      }
    }
    return releasedNodeIds;
  }

  /**
   * Obtiene el lock actual de un nodo si está activo.
   */
  public getLock(roomId: string, nodeId: string): NodeLock | undefined {
    const roomLocks = this.locks.get(roomId);
    if (!roomLocks) return undefined;

    const lock = roomLocks.get(nodeId);
    if (!lock) return undefined;

    if (lock.expiresAt <= Date.now()) {
      roomLocks.delete(nodeId);
      return undefined;
    }

    return lock;
  }

  /**
   * Obtiene todos los locks activos de una sala en formato objeto clave-valor.
   */
  public getAllLocks(roomId: string): Record<string, NodeLock> {
    const roomLocks = this.locks.get(roomId);
    if (!roomLocks) return {};

    const now = Date.now();
    const result: Record<string, NodeLock> = {};

    for (const [nodeId, lock] of roomLocks.entries()) {
      if (lock.expiresAt > now) {
        result[nodeId] = lock;
      } else {
        roomLocks.delete(nodeId);
      }
    }

    return result;
  }

  /**
   * Limpia locks expirados en una sala.
   */
  public cleanExpiredLocks(roomId: string): string[] {
    const roomLocks = this.locks.get(roomId);
    if (!roomLocks) return [];

    const now = Date.now();
    const expired: string[] = [];

    for (const [nodeId, lock] of roomLocks.entries()) {
      if (lock.expiresAt <= now) {
        roomLocks.delete(nodeId);
        expired.push(nodeId);
      }
    }

    return expired;
  }

  private getOrCreateRoomLocks(roomId: string): Map<string, NodeLock> {
    let roomLocks = this.locks.get(roomId);
    if (!roomLocks) {
      roomLocks = new Map<string, NodeLock>();
      this.locks.set(roomId, roomLocks);
    }
    return roomLocks;
  }
}
