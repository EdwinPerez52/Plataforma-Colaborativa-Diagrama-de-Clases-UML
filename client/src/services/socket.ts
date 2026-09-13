import { io, Socket } from 'socket.io-client';

export interface RemoteLock {
  classId: number;
  nodeId: string;
  userId: string;
  userName: string;
  userCargo?: string;
  userColor?: string;
  expiraEn?: string;
}

export interface RemoteCursor {
  userId: string;
  userName?: string;
  color?: string;
  cursor: { x: number; y: number };
}

class CollaborationSocketService {
  private socket: Socket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  public connect(roomId: string, projectId: number, userName: string, token?: string): Socket {
    if (this.socket) {
      this.socket.disconnect();
    }

    const jwtToken = token || localStorage.getItem('case_jwt_token') || '';

    this.socket = io({
      auth: { token: jwtToken },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Conectado con ID:', this.socket?.id);
      this.socket?.emit('join_room', {
        roomId,
        projectId,
        userName,
        userColor: '#' + Math.floor(Math.random() * 16777215).toString(16),
        token: jwtToken,
      });
    });

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public requestLock(roomId: string, projectId: number, classId: number): void {
    if (!this.socket) return;
    this.socket.emit('node:lock:request', { roomId, projectId, classId, nodeId: String(classId) });
  }

  public startHeartbeat(projectId: number, classId: number): void {
    this.stopHeartbeat();
    // Latido cada 2 segundos según especificación PUDS Fase 5
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('node:heartbeat', { projectId, classId });
      }
    }, 2000);
  }

  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public releaseLock(roomId: string, projectId: number, classId: number): void {
    this.stopHeartbeat();
    if (!this.socket) return;
    this.socket.emit('node:release', { roomId, projectId, classId, nodeId: String(classId) });
  }

  public updateAndRelease(roomId: string, projectId: number, classId: number, updates: any): void {
    this.stopHeartbeat();
    if (!this.socket) return;
    this.socket.emit('node:update:release', {
      roomId,
      projectId,
      classId,
      updates,
    });
  }

  public emitCursorMove(roomId: string, cursor: { x: number; y: number }): void {
    if (!this.socket?.connected) return;
    this.socket.emit('cursor_move', { roomId, cursor });
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const collabSocket = new CollaborationSocketService();
