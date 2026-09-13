import { LockManager } from './LockManager';
import { DiagramManager } from './DiagramManager';
import { RoomState, User, NodeLock } from '../types/collaboration';

// Paleta de colores distintivos para los ingenieros colaboradores
const USER_COLORS = [
  '#2563eb', // Azul
  '#dc2626', // Rojo
  '#16a34a', // Verde
  '#d97706', // Ámbar
  '#9333ea', // Púrpura
  '#0891b2', // Cian
  '#db2777', // Rosa
  '#ea580c'  // Naranja
];

export class RoomManager {
  private usersBySocket: Map<string, User> = new Map();
  private usersByRoom: Map<string, Map<string, User>> = new Map(); // roomId -> (userId -> User)
  public lockManager: LockManager;
  public diagramManager: DiagramManager;

  constructor() {
    this.lockManager = new LockManager();
    this.diagramManager = new DiagramManager();
  }

  /**
   * Une un usuario a una sala específica.
   */
  public joinRoom(
    roomId: string,
    socketId: string,
    userName: string,
    requestedColor?: string
  ): { user: User; state: RoomState } {
    let roomUsers = this.usersByRoom.get(roomId);
    if (!roomUsers) {
      roomUsers = new Map();
      this.usersByRoom.set(roomId, roomUsers);
    }

    const color =
      requestedColor ||
      USER_COLORS[roomUsers.size % USER_COLORS.length];

    const user: User = {
      id: socketId,
      name: userName || `Ingeniero-${socketId.substring(0, 4)}`,
      color,
      currentRoom: roomId,
      connectedAt: Date.now()
    };

    roomUsers.set(socketId, user);
    this.usersBySocket.set(socketId, user);

    const state = this.getRoomState(roomId);
    return { user, state };
  }

  /**
   * Remueve al usuario de la sala y libera todos sus locks de exclusión mutua.
   */
  public leaveRoom(
    roomId: string,
    socketId: string
  ): { user?: User; releasedLocks: string[]; remainingUsers: User[] } {
    const user = this.usersBySocket.get(socketId);
    this.usersBySocket.delete(socketId);

    const roomUsers = this.usersByRoom.get(roomId);
    if (roomUsers) {
      roomUsers.delete(socketId);
    }

    // Liberar de inmediato todos los locks que el usuario poseía (evita bloqueos huérfanos)
    const releasedLocks = this.lockManager.releaseAllUserLocks(roomId, socketId);
    const remainingUsers = roomUsers ? Array.from(roomUsers.values()) : [];

    return { user, releasedLocks, remainingUsers };
  }

  /**
   * Actualiza la posición del cursor de un usuario.
   */
  public updateCursor(
    roomId: string,
    socketId: string,
    cursor: { x: number; y: number }
  ): User | undefined {
    const roomUsers = this.usersByRoom.get(roomId);
    if (!roomUsers) return undefined;

    const user = roomUsers.get(socketId);
    if (user) {
      user.cursor = cursor;
    }
    return user;
  }

  /**
   * Obtiene el estado actual completo de una sala.
   */
  public getRoomState(roomId: string): RoomState {
    const roomUsers = this.usersByRoom.get(roomId);
    const users = roomUsers ? Array.from(roomUsers.values()) : [];
    const diagram = this.diagramManager.getDiagram(roomId);
    const locks = this.lockManager.getAllLocks(roomId);

    return {
      roomId,
      diagram,
      users,
      locks
    };
  }

  /**
   * Solicita el bloqueo de exclusión mutua para un nodo.
   */
  public acquireNodeLock(
    roomId: string,
    nodeId: string,
    socketId: string
  ): { success: boolean; lock?: NodeLock; lockedBy?: NodeLock } {
    const user = this.usersBySocket.get(socketId);
    if (!user) {
      return { success: false };
    }
    return this.lockManager.acquireLock(roomId, nodeId, user);
  }

  /**
   * Libera el bloqueo de exclusión mutua de un nodo.
   */
  public releaseNodeLock(
    roomId: string,
    nodeId: string,
    socketId: string
  ): { success: boolean; released: boolean } {
    return this.lockManager.releaseLock(roomId, nodeId, socketId);
  }

  public getUserBySocket(socketId: string): User | undefined {
    return this.usersBySocket.get(socketId);
  }
}
