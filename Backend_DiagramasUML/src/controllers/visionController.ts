import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { VisionSketchService } from '../services/VisionSketchService';

export class VisionController {
  /**
   * POST /api/v1/vision/sketch-to-diagram
   */
  static async processSketchToDiagram(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { projectId, image, confirm, classes, relationships } = req.body;

      if (!projectId || isNaN(Number(projectId))) {
        res.status(400).json({ success: false, error: 'ID de proyecto inválido' });
        return;
      }

      const pId = Number(projectId);
      const userId = req.user?.userId || 1;

      // Si confirm es true, inyectamos y persistimos en PostgreSQL
      if (confirm) {
        if (!classes || !Array.isArray(classes)) {
          res.status(400).json({ success: false, error: 'Lista de clases a confirmar no provista' });
          return;
        }

        const injectResult = await VisionSketchService.confirmAndInject(
          pId,
          userId,
          classes,
          relationships || []
        );

        res.status(201).json({
          success: true,
          message: 'Boceto confirmado e inyectado exitosamente en PostgreSQL.',
          createdClasses: injectResult.createdClasses,
          createdRelationships: injectResult.createdRelationships,
          auditId: injectResult.auditId,
        });
        return;
      }

      // Si confirm es false o no provisto: modo análisis / previsualización
      const previewResult = await VisionSketchService.processSketch(
        pId,
        image || 'data:image/png;base64,sample'
      );

      res.status(200).json(previewResult);
    } catch (err: any) {
      console.error('[VisionController.processSketchToDiagram] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al procesar boceto de visión' });
    }
  }
}
