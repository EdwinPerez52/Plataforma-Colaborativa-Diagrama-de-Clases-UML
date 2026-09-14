import { Response } from 'express';
import { ProjectService } from '../services/ProjectService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class ProjectController {
  /**
   * POST /api/v1/projects
   */
  static async createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const project = await ProjectService.createProject(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Sala de modelado creada exitosamente con código UUID v4',
        data: project,
      });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        success: false,
        error: err.message,
      });
    }
  }

  /**
   * GET /api/v1/projects
   */
  static async getMyProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const projects = await ProjectService.getUserProjects(userId);
      res.status(200).json({
        success: true,
        data: projects,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        error: err.message,
      });
    }
  }

  /**
   * GET /api/v1/projects/:id (puede ser ID numérico o código UUID de sala)
   */
  static async getProjectDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const identifier = req.params.id;
      const details = await ProjectService.getProjectDetails(identifier, userId);
      res.status(200).json({
        success: true,
        data: details,
      });
    } catch (err: any) {
      res.status(err.statusCode || 404).json({
        success: false,
        error: err.message,
      });
    }
  }

  /**
   * POST /api/v1/projects/join
   */
  static async joinProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { codigo_sala, rol } = req.body;
      const result = await ProjectService.joinProject(userId, codigo_sala, rol);
      res.status(200).json({
        success: true,
        message: result.isNewMember
          ? 'Te has unido exitosamente a la sala de modelado'
          : 'Ya eres miembro de esta sala',
        data: result,
      });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        success: false,
        error: err.message,
      });
    }
  }

  /**
   * PUT /api/v1/projects/:id
   */
  static async updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const projectId = parseInt(req.params.id, 10);
      const updated = await ProjectService.updateProject(projectId, userId, req.body);
      res.status(200).json({
        success: true,
        message: 'Proyecto actualizado correctamente',
        data: updated,
      });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        success: false,
        error: err.message,
      });
    }
  }

  /**
   * DELETE /api/v1/projects/:id
   */
  static async deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const projectId = parseInt(req.params.id, 10);
      await ProjectService.deleteProject(projectId, userId);
      res.status(200).json({
        success: true,
        message: 'Proyecto eliminado con éxito',
      });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({
        success: false,
        error: err.message,
      });
    }
  }
}
