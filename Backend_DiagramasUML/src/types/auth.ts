export type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';
export type ProjectMemberRole = 'ANFITRION' | 'EDITOR' | 'OBSERVADOR';
export type ProjectStatus = 'EN_DISENO' | 'FINALIZADO' | 'ARCHIVADO';

export interface User {
  id: number;
  nombre: string;
  email: string;
  cargo: string;
  estado: UserStatus;
  creado_en?: string;
  actualizado_en?: string;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

export interface AuthPayload {
  userId: number;
  email: string;
  nombre: string;
  cargo: string;
}

export interface Project {
  id: number;
  codigo_sala: string;
  titulo: string;
  descripcion?: string;
  propietario_id: number;
  estado: ProjectStatus;
  creado_en?: string;
  actualizado_en?: string;
  rol_usuario?: ProjectMemberRole;
  miembros_conteo?: number;
}

export interface ProjectMember {
  id: number;
  proyecto_id: number;
  usuario_id: number;
  rol: ProjectMemberRole;
  unido_en: string;
  usuario?: {
    id: number;
    nombre: string;
    email: string;
    cargo: string;
  };
}

export interface RegisterDto {
  nombre: string;
  email: string;
  password: string;
  cargo?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface CreateProjectDto {
  titulo: string;
  descripcion?: string;
}

export interface JoinProjectDto {
  codigo_sala: string;
  rol?: ProjectMemberRole;
}

export interface UpdateProjectDto {
  titulo?: string;
  descripcion?: string;
  estado?: ProjectStatus;
}
