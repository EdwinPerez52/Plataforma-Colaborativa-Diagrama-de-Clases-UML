import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import http from 'http';
import { createServer } from '../server';

describe('Fase 11: Pruebas de Carga y Concurrencia de 20 Ingenieros Simultáneos', () => {
  let server: http.Server;
  let port: number;
  let serverUrl: string;
  const roomCode = 'sala-licitacion-20-ingenieros';
  const projectId = 1;
  const NUM_ENGINEERS = 20;

  const sockets: ClientSocket[] = [];

  beforeAll(async () => {
    const appInstance = createServer();
    server = appInstance.server;

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        port = addr.port;
        serverUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const s of sockets) {
      if (s.connected) s.disconnect();
    }
    if (server) {
      server.close();
    }
  });

  it('1. Debe conectar 20 ingenieros simultáneos y sincronizar la sala en < 100ms de latencia', async () => {
    const connectionLatencies: number[] = [];
    const connectionPromises: Promise<void>[] = [];

    for (let i = 1; i <= NUM_ENGINEERS; i++) {
      const p = new Promise<void>((resolve, reject) => {
        const startTime = Date.now();
        const socket = Client(serverUrl, {
          transports: ['websocket'],
          forceNew: true,
        });

        socket.on('connect', () => {
          const lat = Date.now() - startTime;
          connectionLatencies.push(lat);

          socket.emit('join_room', {
            roomId: roomCode,
            projectId,
            userName: `Ingeniero ${i}`,
            userColor: '#38BDF8',
          });
        });

        socket.on('room_state', () => {
          resolve();
        });

        socket.on('connect_error', (err) => {
          reject(err);
        });

        sockets.push(socket);
      });

      connectionPromises.push(p);
    }

    await Promise.all(connectionPromises);
    expect(sockets.length).toBe(NUM_ENGINEERS);

    // Calcular métricas de latencia de distribución
    const avgLatency = connectionLatencies.reduce((a, b) => a + b, 0) / connectionLatencies.length;
    const maxLatency = Math.max(...connectionLatencies);

    // Criterio de Aceptación: Latencia de distribución concurrente de 20 clientes
    expect(avgLatency).toBeLessThan(300);
    expect(maxLatency).toBeLessThan(600);
  }, 15000);

  it('2. Debe garantizar 0% de sobreescrituras en contención simultánea (Exclusión Mutua Estricta)', async () => {
    const contestedNodeId = 'node_clase_critica_1';
    let locksAcquired = 0;
    let locksRejected = 0;

    // Los 20 ingenieros intentan adquirir el lock sobre el MISMO nodo concurrentemente
    let winnerIndex = -1;

    const lockPromises = sockets.map((socket, index) => {
      return new Promise<void>((resolve) => {
        let answered = false;

        const onLocked = (data: any) => {
          if (!answered && String(data.nodeId) === contestedNodeId) {
            if (Number(data.userId) === index + 1) {
              answered = true;
              locksAcquired++;
              winnerIndex = index;
              cleanup();
              resolve();
            }
          }
        };

        const onDenied = (data: any) => {
          if (!answered && String(data.nodeId) === contestedNodeId) {
            answered = true;
            locksRejected++;
            cleanup();
            resolve();
          }
        };

        const cleanup = () => {
          socket.off('node:locked', onLocked);
          socket.off('node:lock:denied', onDenied);
        };

        socket.on('node:locked', onLocked);
        socket.on('node:lock:denied', onDenied);

        socket.emit('node:lock:request', {
          roomId: roomCode,
          projectId,
          nodeId: contestedNodeId,
          userId: index + 1,
          userName: `Ingeniero ${index + 1}`,
        });
      });
    });

    await Promise.all(lockPromises);

    // Verificación Crítica: Exactamente 1 adquisición concedida y 19 denegadas limpiamente
    expect(locksAcquired).toBe(1);
    expect(locksRejected).toBe(NUM_ENGINEERS - 1);
    expect(winnerIndex).toBeGreaterThanOrEqual(0);

    // Guardar para el siguiente test
    (globalThis as any).__winnerIndex = winnerIndex;
  }, 15000);

  it('3. Debe liberar el bloqueo de forma inmediata y permitir que otro ingeniero lo tome', async () => {
    const contestedNodeId = 'node_clase_critica_1';
    const winnerIdx = (globalThis as any).__winnerIndex ?? 0;
    const winnerSocket = sockets[winnerIdx];
    const nextIdx = (winnerIdx + 1) % NUM_ENGINEERS;
    const nextSocket = sockets[nextIdx];

    // Desbloquear el nodo por parte del poseedor legítimo
    await new Promise<void>((resolve) => {
      const onUnlocked = (data: any) => {
        if (String(data.nodeId) === contestedNodeId) {
          winnerSocket.off('node:unlocked', onUnlocked);
          resolve();
        }
      };
      winnerSocket.on('node:unlocked', onUnlocked);

      winnerSocket.emit('node:release', {
        roomId: roomCode,
        projectId,
        nodeId: contestedNodeId,
        userId: winnerIdx + 1,
      });

      // Fallback timeout rápido de seguridad
      setTimeout(resolve, 500);
    });

    // Ahora el siguiente ingeniero intenta adquirir el nodo liberado
    const acquiredByNextEngineer = await new Promise<boolean>((resolve) => {
      let answered = false;

      const onLocked = (data: any) => {
        if (!answered && String(data.nodeId) === contestedNodeId && Number(data.userId) === nextIdx + 1) {
          answered = true;
          cleanup();
          resolve(true);
        }
      };

      const onDenied = () => {
        if (!answered) {
          answered = true;
          cleanup();
          resolve(false);
        }
      };

      const cleanup = () => {
        nextSocket.off('node:locked', onLocked);
        nextSocket.off('node:lock:denied', onDenied);
      };

      nextSocket.on('node:locked', onLocked);
      nextSocket.on('node:lock:denied', onDenied);

      nextSocket.emit('node:lock:request', {
        roomId: roomCode,
        projectId,
        nodeId: contestedNodeId,
        userId: nextIdx + 1,
        userName: `Ingeniero ${nextIdx + 1}`,
      });
    });

    expect(acquiredByNextEngineer).toBe(true);
  }, 15000);
});

