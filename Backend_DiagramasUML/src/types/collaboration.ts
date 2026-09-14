import { DiagramModel, UmlClass, UmlRelationship } from './uml';

export interface User {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  currentRoom: string;
  connectedAt: number;
}

export interface NodeLock {
  nodeId: string;
  userId: string;
  userName: string;
  userColor: string;
  acquiredAt: number;
  expiresAt: number; // TTL para evitar bloqueos perpetuos (por ejemplo 2 minutos renovables)
}

export interface RoomState {
  roomId: string;
  diagram: DiagramModel;
  users: User[];
  locks: Record<string, NodeLock>; // Clave: nodeId
}

export interface TransformationPayload {
  type: 'CHANGE_TO_MANY_TO_MANY' | 'RENAME_CLASS' | 'SPLIT_RELATIONSHIP';
  data: any;
}

// Eventos de Socket.IO
export const SOCKET_EVENTS = {
  // Conexión y salas
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_STATE: 'room_state',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',

  // Colaboración y cursores
  CURSOR_MOVE: 'cursor_move',
  CURSOR_UPDATED: 'cursor_updated',

  // Exclusión Mutua (Locks)
  ACQUIRE_LOCK: 'acquire_lock',
  RELEASE_LOCK: 'release_lock',
  LOCK_ACQUIRED: 'lock_acquired',
  LOCK_RELEASED: 'lock_released',
  LOCK_DENIED: 'lock_denied',

  // Modificación del Diagrama (Nodos / Clases)
  ADD_NODE: 'add_node',
  UPDATE_NODE: 'update_node',
  DELETE_NODE: 'delete_node',
  NODE_ADDED: 'node_added',
  NODE_UPDATED: 'node_updated',
  NODE_DELETED: 'node_deleted',

  // Modificación del Diagrama (Relaciones)
  ADD_EDGE: 'add_edge',
  UPDATE_EDGE: 'update_edge',
  DELETE_EDGE: 'delete_edge',
  EDGE_ADDED: 'edge_added',
  EDGE_UPDATED: 'edge_updated',
  EDGE_DELETED: 'edge_deleted',

  // Transformaciones Inteligentes (ej. N a N con tabla intermedia)
  APPLY_TRANSFORMATION: 'apply_transformation',
  TRANSFORMATION_APPLIED: 'transformation_applied',

  // Errores
  ERROR: 'error_message'
} as const;
