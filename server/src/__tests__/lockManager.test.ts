import { describe, it, expect, beforeEach } from 'vitest';
import { LockManager } from '../services/LockManager';
import { User } from '../types/collaboration';

describe('LockManager - Control de Exclusión Mutua', () => {
  let lockManager: LockManager;
  const userA: User = {
    id: 'user-1',
    name: 'Ingeniero Juan',
    color: '#2563eb',
    currentRoom: 'room-1',
    connectedAt: Date.now()
  };

  const userB: User = {
    id: 'user-2',
    name: 'Ingeniera Maria',
    color: '#dc2626',
    currentRoom: 'room-1',
    connectedAt: Date.now()
  };

  beforeEach(() => {
    lockManager = new LockManager(60000); // 1 minuto de TTL
  });

  it('debe permitir que un usuario adquiera el lock sobre un nodo libre', () => {
    const result = lockManager.acquireLock('room-1', 'node-paciente', userA);

    expect(result.success).toBe(true);
    expect(result.lock).toBeDefined();
    expect(result.lock?.nodeId).toBe('node-paciente');
    expect(result.lock?.userId).toBe(userA.id);
    expect(result.lock?.userName).toBe(userA.name);
  });

  it('debe denegar el lock a un segundo usuario si el nodo ya está bloqueado (Exclusión Mutua)', () => {
    // Usuario A bloquea el nodo
    const resA = lockManager.acquireLock('room-1', 'node-paciente', userA);
    expect(resA.success).toBe(true);

    // Usuario B intenta bloquear el mismo nodo
    const resB = lockManager.acquireLock('room-1', 'node-paciente', userB);
    expect(resB.success).toBe(false);
    expect(resB.lockedBy).toBeDefined();
    expect(resB.lockedBy?.userId).toBe(userA.id);
    expect(resB.lockedBy?.userName).toBe('Ingeniero Juan');
  });

  it('debe permitir renovar el lock al mismo usuario que lo posee', () => {
    lockManager.acquireLock('room-1', 'node-paciente', userA);
    const renew = lockManager.acquireLock('room-1', 'node-paciente', userA);

    expect(renew.success).toBe(true);
    expect(renew.lock?.userId).toBe(userA.id);
  });

  it('debe liberar el lock correctamente cuando el dueño lo solicita', () => {
    lockManager.acquireLock('room-1', 'node-paciente', userA);

    const releaseRes = lockManager.releaseLock('room-1', 'node-paciente', userA.id);
    expect(releaseRes.success).toBe(true);
    expect(releaseRes.released).toBe(true);

    // Ahora Usuario B sí puede adquirir el lock
    const resB = lockManager.acquireLock('room-1', 'node-paciente', userB);
    expect(resB.success).toBe(true);
    expect(resB.lock?.userId).toBe(userB.id);
  });

  it('no debe permitir que otro usuario libere el lock de un nodo ajeno', () => {
    lockManager.acquireLock('room-1', 'node-paciente', userA);

    // Usuario B intenta liberar el lock de A
    const releaseRes = lockManager.releaseLock('room-1', 'node-paciente', userB.id);
    expect(releaseRes.success).toBe(false);
    expect(releaseRes.released).toBe(false);

    // El lock sigue perteneciendo a A
    const currentLock = lockManager.getLock('room-1', 'node-paciente');
    expect(currentLock?.userId).toBe(userA.id);
  });

  it('debe liberar automáticamente todos los locks de un usuario al desconectarse', () => {
    lockManager.acquireLock('room-1', 'node-1', userA);
    lockManager.acquireLock('room-1', 'node-2', userA);
    lockManager.acquireLock('room-1', 'node-3', userB);

    const released = lockManager.releaseAllUserLocks('room-1', userA.id);
    expect(released).toContain('node-1');
    expect(released).toContain('node-2');
    expect(released).not.toContain('node-3');

    // node-1 y node-2 ahora están libres
    expect(lockManager.getLock('room-1', 'node-1')).toBeUndefined();
    expect(lockManager.getLock('room-1', 'node-2')).toBeUndefined();
    // node-3 sigue bloqueado por B
    expect(lockManager.getLock('room-1', 'node-3')?.userId).toBe(userB.id);
  });

  it('debe expirar el lock cuando transcurre el TTL', () => {
    const fastLockManager = new LockManager(50); // 50ms TTL
    fastLockManager.acquireLock('room-1', 'node-temporal', userA, 10);

    // Esperar a que expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const lock = fastLockManager.getLock('room-1', 'node-temporal');
        expect(lock).toBeUndefined();

        // Usuario B ahora puede adquirirlo
        const resB = fastLockManager.acquireLock('room-1', 'node-temporal', userB);
        expect(resB.success).toBe(true);
        resolve();
      }, 25);
    });
  });
});
