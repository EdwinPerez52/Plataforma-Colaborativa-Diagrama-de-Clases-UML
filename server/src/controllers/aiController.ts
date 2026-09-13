import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { AiCommandExecutionService } from '../services/AiCommandExecutionService';

export class AiController {
  /**
   * POST /api/v1/ai/command
   */
  static async executeCommand(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { projectId, canal, transcript } = req.body;

      if (!projectId || isNaN(Number(projectId))) {
        res.status(400).json({ success: false, error: 'ID de proyecto inválido o no provisto' });
        return;
      }

      if (!transcript || typeof transcript !== 'string' || transcript.trim() === '') {
        res.status(400).json({ success: false, error: 'El comando de texto/voz no puede estar vacío' });
        return;
      }

      const channel = (canal === 'VOZ' ? 'VOZ' : 'TEXTO') as 'VOZ' | 'TEXTO';
      const userId = req.user?.userId || 1;

      const result = await AiCommandExecutionService.executeCommand(
        Number(projectId),
        userId,
        channel,
        transcript.trim()
      );

      res.status(result.success ? 200 : 422).json(result);
    } catch (err: any) {
      console.error('[AiController.executeCommand] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al procesar comando IA' });
    }
  }

  /**
   * GET /api/v1/projects/:id/ai-audit
   */
  static async getAudit(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params.id, 10);
      if (isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'ID de proyecto inválido' });
        return;
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const history = await AiCommandExecutionService.getAuditHistory(projectId, limit);

      res.status(200).json({ success: true, history });
    } catch (err: any) {
      console.error('[AiController.getAudit] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al obtener auditoría de IA' });
    }
  }
}
