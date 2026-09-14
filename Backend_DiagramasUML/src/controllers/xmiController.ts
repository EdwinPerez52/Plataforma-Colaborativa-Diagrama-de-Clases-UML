import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { XmiInteroperabilityService } from '../services/XmiInteroperabilityService';

export class XmiController {
  /**
   * GET /api/v1/xmi/projects/:id/export
   * Exporta el diagrama en formato XMI 2.1 compatible con Sparx Enterprise Architect
   */
  static async exportXmi(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.id);
      if (!projectId || isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'ID de proyecto inválido' });
        return;
      }

      const xml = await XmiInteroperabilityService.exportToXmi(projectId);

      // Si el cliente pide JSON explícitamente
      if (req.query.format === 'json') {
        res.status(200).json({
          success: true,
          projectId,
          xml,
        });
        return;
      }

      // Descarga directa de archivo .xmi / .xml
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="diagrama-proyecto-${projectId}-ea.xmi"`
      );
      res.status(200).send(xml);
    } catch (err: any) {
      console.error('[XmiController.exportXmi] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al exportar diagrama a XMI' });
    }
  }

  /**
   * POST /api/v1/xmi/validate
   * Valida un archivo XMI y previsualiza las entidades antes de importar
   */
  static async validateXmi(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { xmlContent } = req.body;
      if (!xmlContent || typeof xmlContent !== 'string') {
        res.status(400).json({ success: false, error: 'Contenido XML/XMI no provisto' });
        return;
      }

      const result = XmiInteroperabilityService.parseXmi(xmlContent);
      res.status(200).json({
        success: true,
        validation: result,
      });
    } catch (err: any) {
      console.error('[XmiController.validateXmi] Error:', err);
      res.status(400).json({ success: false, error: err.message || 'Error al validar archivo XMI' });
    }
  }

  /**
   * POST /api/v1/xmi/projects/:id/import
   * Importa de forma transaccional un archivo XMI de Enterprise Architect a PostgreSQL 17
   */
  static async importXmi(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.id);
      if (!projectId || isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'ID de proyecto inválido' });
        return;
      }

      const { xmlContent, mode } = req.body;
      if (!xmlContent || typeof xmlContent !== 'string') {
        res.status(400).json({ success: false, error: 'Contenido XML/XMI no provisto' });
        return;
      }

      const result = await XmiInteroperabilityService.importXmi(
        projectId,
        xmlContent,
        mode === 'overwrite' ? 'overwrite' : 'merge'
      );

      res.status(201).json(result);
    } catch (err: any) {
      console.error('[XmiController.importXmi] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al importar esquema XMI' });
    }
  }
}
