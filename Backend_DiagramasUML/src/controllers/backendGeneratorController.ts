import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { SpringBootGeneratorService } from '../services/SpringBootGeneratorService';
import { db } from '../config/database';
import fs from 'fs';
import path from 'path';

export class BackendGeneratorController {
  /**
   * POST /api/v1/backend/projects/:id/generate
   * Genera la solución en 5 capas, empaqueta en ZIP y registra en auditoría
   */
  static async generateBackend(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.id);
      if (!projectId || isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'ID de proyecto inválido' });
        return;
      }

      const userId = req.user?.userId || 1;

      const result = await SpringBootGeneratorService.generateBackend(projectId, userId);

      res.status(201).json({
        success: true,
        message: result.message,
        generationId: result.generationId,
        projectId: result.projectId,
        versionSpringBoot: result.versionSpringBoot,
        sha256: result.sha256,
        zipFileName: result.zipFileName,
        totalFiles: result.totalFiles,
        files: result.files,
      });
    } catch (err: any) {
      console.error('[BackendGeneratorController.generateBackend] Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Error al generar backend Spring Boot',
      });
    }
  }

  /**
   * GET /api/v1/backend/projects/:id/download
   * Descarga el último archivo ZIP generado e incrementa el contador de descargas
   */
  static async downloadZip(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.id);
      if (!projectId || isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'ID de proyecto inválido' });
        return;
      }

      // Buscar el último registro generado para el proyecto
      const genRes = await db.query(
        `SELECT id, ruta_archivo_zip, hash_sha256
         FROM generaciones_backend
         WHERE proyecto_id = $1
         ORDER BY creado_en DESC
         LIMIT 1`,
        [projectId]
      );

      let zipPath: string;
      let zipFileName: string = `backend_spring_boot_${projectId}.zip`;

      if (genRes.rowCount && genRes.rowCount > 0) {
        const row = genRes.rows[0];
        zipPath = row.ruta_archivo_zip;
        zipFileName = path.basename(zipPath);

        // Incrementar contador de descargas
        await db.query(
          `UPDATE generaciones_backend
           SET descargas_conteo = descargas_conteo + 1
           WHERE id = $1`,
          [row.id]
        );
      } else {
        // Generar al vuelo si no existe previo
        const userId = req.user?.userId || 1;
        const result = await SpringBootGeneratorService.generateBackend(projectId, userId);
        zipPath = path.resolve(__dirname, '../../generated_archives', result.zipFileName);
        zipFileName = result.zipFileName;
      }

      if (!fs.existsSync(zipPath)) {
        // Si el archivo físico no está, regenerar
        const userId = req.user?.userId || 1;
        const result = await SpringBootGeneratorService.generateBackend(projectId, userId);
        zipPath = path.resolve(__dirname, '../../generated_archives', result.zipFileName);
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      const fileStream = fs.createReadStream(zipPath);
      fileStream.pipe(res);
    } catch (err: any) {
      console.error('[BackendGeneratorController.downloadZip] Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Error al descargar archivo ZIP del backend',
      });
    }
  }

  /**
   * GET /api/v1/backend/projects/:id/history
   * Obtiene el historial de generaciones y hashes SHA-256
   */
  static async getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = Number(req.params.id);
      const rows = await db.query(
        `SELECT g.id, g.version_spring_boot, g.hash_sha256, g.descargas_conteo, g.creado_en, u.nombre as usuario_nombre
         FROM generaciones_backend g
         JOIN usuarios u ON g.usuario_id = u.id
         WHERE g.proyecto_id = $1
         ORDER BY g.creado_en DESC`,
        [projectId]
      );

      res.status(200).json({
        success: true,
        history: rows.rows,
      });
    } catch (err: any) {
      console.error('[BackendGeneratorController.getHistory] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
