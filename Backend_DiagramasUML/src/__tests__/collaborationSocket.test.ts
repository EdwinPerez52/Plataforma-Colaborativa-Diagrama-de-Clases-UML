import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { createServer } from '../server';
import { SOCKET_EVENTS } from '../types/collaboration';
import { UmlClass } from '../types/uml';
import http from 'http';

describe('Socket.IO - Colaboración en Tiempo Real y Exclusión Mutua', () => {
  let httpServer: http.Server;
  let clientSocketA: ClientSocket;
  let clientSocketB: ClientSocket;
  const PORT = 4567;
  const SERVER_URL = `http://localhost:${PORT}`;
  const ROOM_ID = 'sala-ingenieria-test';

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      const { server } = createServer();
      httpServer = server;
      httpServer.listen(PORT, () => {
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      if (clientSocketA && clientSocketA.connected) clientSocketA.disconnect();
      if (clientSocketB && clientSocketB.connected) clientSocketB.disconnect();
      httpServer.close(() => resolve());
    });
  });

  it('debe conectar dos clientes a la misma sala y sincronizar el estado', () => {
    return new Promise<void>((resolve) => {
      let clientAJoined = false;
      let clientBJoined = false;

      clientSocketA = Client(SERVER_URL);
      clientSocketB = Client(SERVER_URL);

      clientSocketA.on('connect', () => {
        clientSocketA.emit(SOCKET_EVENTS.JOIN_ROOM, {
          roomId: ROOM_ID,
          userName: 'Ingeniero Carlos'
        });
      });

      clientSocketA.on(SOCKET_EVENTS.ROOM_STATE, (state) => {
        expect(state.roomId).toBe(ROOM_ID);
        clientAJoined = true;
        if (clientAJoined && clientBJoined) resolve();
      });

      clientSocketB.on('connect', () => {
        clientSocketB.emit(SOCKET_EVENTS.JOIN_ROOM, {
          roomId: ROOM_ID,
          userName: 'Ingeniera Ana'
        });
      });

      clientSocketB.on(SOCKET_EVENTS.ROOM_STATE, (state) => {
        expect(state.roomId).toBe(ROOM_ID);
        clientBJoined = true;
        if (clientAJoined && clientBJoined) resolve();
      });
    });
  });

  it('debe permitir que el Ingeniero A bloquee un nodo y denegar el bloqueo al Ingeniero B (Exclusión Mutua)', () => {
    return new Promise<void>((resolve) => {
      const nodeId = 'clase-paciente-1';

      // Ingeniero A adquiere el lock
      clientSocketA.emit(SOCKET_EVENTS.ACQUIRE_LOCK, { roomId: ROOM_ID, nodeId });

      clientSocketA.once(SOCKET_EVENTS.LOCK_ACQUIRED, (data) => {
        expect(data.nodeId).toBe(nodeId);
        expect(data.lock.userName).toBe('Ingeniero Carlos');

        // Ingeniero B intenta adquirir el lock sobre el mismo nodo mientras A lo tiene
        clientSocketB.emit(SOCKET_EVENTS.ACQUIRE_LOCK, { roomId: ROOM_ID, nodeId });
      });

      clientSocketB.once(SOCKET_EVENTS.LOCK_DENIED, (data) => {
        expect(data.nodeId).toBe(nodeId);
        expect(data.reason).toContain('Ingeniero Carlos');
        expect(data.lockedBy.userName).toBe('Ingeniero Carlos');
        resolve();
      });
    });
  });

  it('debe liberar el bloqueo y permitir que el Ingeniero B lo adquiera tras la liberación', () => {
    return new Promise<void>((resolve) => {
      const nodeId = 'clase-paciente-1';

      // Ingeniero A libera el lock
      clientSocketA.emit(SOCKET_EVENTS.RELEASE_LOCK, { roomId: ROOM_ID, nodeId });

      // Ingeniero B escucha la liberación del lock
      clientSocketB.once(SOCKET_EVENTS.LOCK_RELEASED, (data) => {
        expect(data.nodeId).toBe(nodeId);

        // Ahora Ingeniero B sí puede adquirirlo
        clientSocketB.emit(SOCKET_EVENTS.ACQUIRE_LOCK, { roomId: ROOM_ID, nodeId });
      });

      clientSocketB.once(SOCKET_EVENTS.LOCK_ACQUIRED, (data) => {
        expect(data.nodeId).toBe(nodeId);
        expect(data.lock.userName).toBe('Ingeniera Ana');
        resolve();
      });
    });
  });

  it('debe propagar la creación de una clase en tiempo real a todos los clientes', () => {
    return new Promise<void>((resolve) => {
      const nuevaClase: UmlClass = {
        id: 'clase-historia-clinica',
        name: 'HistoriaClinica',
        attributes: [
          { id: 'att-1', name: 'id', type: 'Long', visibility: '+', isPk: true }
        ],
        methods: [],
        position: { x: 300, y: 300 }
      };

      // Ingeniero B escucha la llegada de la nueva clase emitida por A
      clientSocketB.once(SOCKET_EVENTS.NODE_ADDED, (claseRecibida: UmlClass) => {
        expect(claseRecibida.id).toBe(nuevaClase.id);
        expect(claseRecibida.name).toBe('HistoriaClinica');
        resolve();
      });

      // Ingeniero A agrega la clase
      clientSocketA.emit(SOCKET_EVENTS.ADD_NODE, { roomId: ROOM_ID, node: nuevaClase });
    });
  });

  it('debe liberar automáticamente el lock si un usuario se desconecta de imprevisto', () => {
    return new Promise<void>((resolve) => {
      const nodeId = 'clase-paciente-1';

      // Ingeniera B tenía el lock. Al desconectarse, el servidor debe emitir lock_released a A
      clientSocketA.once(SOCKET_EVENTS.LOCK_RELEASED, (data) => {
        expect(data.nodeId).toBe(nodeId);
        resolve();
      });

      // Desconexión abrupta de cliente B
      clientSocketB.disconnect();
    });
  });
});
