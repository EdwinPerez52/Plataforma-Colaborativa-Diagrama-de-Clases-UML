import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectMember,
  ProjectMemberRole,
} from '../types/auth';

export class ProjectService {
  /**
   * Crea un nuevo proyecto y genera automáticamente el identificador de sala UUID v4 (CU02)
   * Registra atómicamente al usuario como ANFITRION en proyecto_miembros.
   */
  static async createProject(userId: number, dto: CreateProjectDto): Promise<Project> {
    const { titulo, descripcion } = dto;

    if (!titulo || titulo.trim().length === 0) {
      throw new Error('El título del proyecto es obligatorio');
    }

    const codigoSala = uuidv4();

    return db.transaction(async (client) => {
      // 1. Insertar el proyecto
      const projRes = await client.query(
        `INSERT INTO proyectos (codigo_sala, titulo, descripcion, propietario_id, estado)
         VALUES ($1, $2, $3, $4, 'EN_DISENO')
         RETURNING id, codigo_sala, titulo, descripcion, propietario_id, estado, creado_en, actualizado_en`,
        [codigoSala, titulo.trim(), descripcion || null, userId]
      );

      const project: Project = projRes.rows[0];

      // 2. Registrar al creador como ANFITRION en proyecto_miembros
      await client.query(
        `INSERT INTO proyecto_miembros (proyecto_id, usuario_id, rol)
         VALUES ($1, $2, 'ANFITRION')`,
        [project.id, userId]
      );

      project.rol_usuario = 'ANFITRION';
      project.miembros_conteo = 1;

      return project;
    });
  }

  /**
   * Obtiene todos los proyectos asociados a un usuario (donde es propietario o miembro) (CU02)
   */
  static async getUserProjects(userId: number): Promise<Project[]> {
    const res = await db.query(
      `SELECT p.id, p.codigo_sala, p.titulo, p.descripcion, p.propietario_id, p.estado,
              p.creado_en, p.actualizado_en,
              pm.rol AS rol_usuario,
              (SELECT COUNT(*) FROM proyecto_miembros WHERE proyecto_id = p.id) AS miembros_conteo
       FROM proyectos p
       INNER JOIN proyecto_miembros pm ON pm.proyecto_id = p.id
       WHERE pm.usuario_id = $1
       ORDER BY p.actualizado_en DESC`,
      [userId]
    );

    return res.rows.map((r: any) => ({
      ...r,
      id: Number(r.id),
      propietario_id: Number(r.propietario_id),
      miembros_conteo: Number(r.miembros_conteo),
    }));
  }

  /**
   * Obtiene los detalles de un proyecto por su ID o por su código de sala UUID v4 (CU02/CU03)
   */
  static async getProjectDetails(
    identifier: string | number,
    userId?: number
  ): Promise<{ project: Project; members: ProjectMember[] }> {
    const isNumeric = typeof identifier === 'number' || /^\d+$/.test(String(identifier));
    const query = isNumeric
      ? 'SELECT * FROM proyectos WHERE id = $1'
      : 'SELECT * FROM proyectos WHERE codigo_sala = $1';

    const projRes = await db.query(query, [identifier]);

    if (projRes.rowCount === 0) {
      const error: any = new Error('Proyecto o sala de modelado no encontrada');
      error.statusCode = 404;
      throw error;
    }

    const project: Project = {
      ...projRes.rows[0],
      id: Number(projRes.rows[0].id),
      propietario_id: Number(projRes.rows[0].propietario_id),
    };

    // Obtener miembros de la sala
    const membersRes = await db.query(
      `SELECT pm.id, pm.proyecto_id, pm.usuario_id, pm.rol, pm.unido_en,
              u.nombre, u.email, u.cargo
       FROM proyecto_miembros pm
       INNER JOIN usuarios u ON u.id = pm.usuario_id
       WHERE pm.proyecto_id = $1
       ORDER BY pm.unido_en ASC`,
      [project.id]
    );

    const members: ProjectMember[] = membersRes.rows.map((r: any) => ({
      id: Number(r.id),
      proyecto_id: Number(r.proyecto_id),
      usuario_id: Number(r.usuario_id),
      rol: r.rol as ProjectMemberRole,
      unido_en: r.unido_en,
      usuario: {
        id: Number(r.usuario_id),
        nombre: r.nombre,
        email: r.email,
        cargo: r.cargo,
      },
    }));

    if (userId) {
      const userMembership = members.find((m) => m.usuario_id === userId);
      project.rol_usuario = userMembership ? userMembership.rol : undefined;
    }

    project.miembros_conteo = members.length;

    return { project, members };
  }

  /**
   * Permite que un colaborador se una a una sala de modelado mediante el código de sala (CU03)
   */
  static async joinProject(
    userId: number,
    codigoSala: string,
    requestedRole: ProjectMemberRole = 'EDITOR'
  ): Promise<{ project: Project; rol: ProjectMemberRole; isNewMember: boolean }> {
    if (!codigoSala || codigoSala.trim().length === 0) {
      throw new Error('El código de sala es obligatorio');
    }

    // 1. Validar que la sala exista
    const projRes = await db.query(
      'SELECT id, codigo_sala, titulo, descripcion, propietario_id, estado FROM proyectos WHERE codigo_sala = $1',
      [codigoSala.trim()]
    );

    if (projRes.rowCount === 0) {
      const error: any = new Error('No se encontró ninguna sala de modelado con ese código');
      error.statusCode = 404;
      throw error;
    }

    const project: Project = {
      ...projRes.rows[0],
      id: Number(projRes.rows[0].id),
      propietario_id: Number(projRes.rows[0].propietario_id),
    };

    // 2. Verificar membresía previa
    const checkMember = await db.query(
      'SELECT rol FROM proyecto_miembros WHERE proyecto_id = $1 AND usuario_id = $2',
      [project.id, userId]
    );

    let roleToAssign: ProjectMemberRole = requestedRole;
    let isNew = false;

    if (checkMember.rowCount && checkMember.rowCount > 0) {
      roleToAssign = checkMember.rows[0].rol as ProjectMemberRole;
    } else {
      // Si es el propietario, siempre es ANFITRION
      if (project.propietario_id === userId) {
        roleToAssign = 'ANFITRION';
      }
      await db.query(
        `INSERT INTO proyecto_miembros (proyecto_id, usuario_id, rol)
         VALUES ($1, $2, $3)
         ON CONFLICT (proyecto_id, usuario_id) DO NOTHING`,
        [project.id, userId, roleToAssign]
      );
      isNew = true;
    }

    project.rol_usuario = roleToAssign;

    return { project, rol: roleToAssign, isNewMember: isNew };
  }

  /**
   * Actualiza los datos de un proyecto (Solo el anfitrión) (CU02)
   */
  static async updateProject(
    projectId: number,
    userId: number,
    dto: UpdateProjectDto
  ): Promise<Project> {
    await this.verifyHostRole(projectId, userId);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dto.titulo) {
      updates.push(`titulo = $${paramIndex++}`);
      values.push(dto.titulo.trim());
    }

    if (dto.descripcion !== undefined) {
      updates.push(`descripcion = $${paramIndex++}`);
      values.push(dto.descripcion);
    }

    if (dto.estado) {
      updates.push(`estado = $${paramIndex++}`);
      values.push(dto.estado);
    }

    if (updates.length === 0) {
      throw new Error('No se enviaron campos para actualizar');
    }

    updates.push(`actualizado_en = CURRENT_TIMESTAMP`);
    values.push(projectId);

    const query = `
      UPDATE proyectos
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, codigo_sala, titulo, descripcion, propietario_id, estado, creado_en, actualizado_en
    `;

    const res = await db.query(query, values);
    return res.rows[0];
  }

  /**
   * Elimina un proyecto y sus entidades en cascada (Solo el anfitrión) (CU02)
   */
  static async deleteProject(projectId: number, userId: number): Promise<void> {
    await this.verifyHostRole(projectId, userId);

    const res = await db.query('DELETE FROM proyectos WHERE id = $1', [projectId]);
    if (res.rowCount === 0) {
      const error: any = new Error('Proyecto no encontrado');
      error.statusCode = 404;
      throw error;
    }
  }

  /**
   * Valida si el usuario es ANFITRION del proyecto
   */
  private static async verifyHostRole(projectId: number, userId: number): Promise<void> {
    const res = await db.query(
      `SELECT rol FROM proyecto_miembros WHERE proyecto_id = $1 AND usuario_id = $2`,
      [projectId, userId]
    );

    if (res.rowCount === 0 || res.rows[0].rol !== 'ANFITRION') {
      const error: any = new Error('Operación denegada: Solo el anfitrión del proyecto puede realizar esta acción');
      error.statusCode = 403;
      throw error;
    }
  }
}
