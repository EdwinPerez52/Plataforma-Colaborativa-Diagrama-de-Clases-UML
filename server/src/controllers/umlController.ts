import { Request, Response } from 'express';
import { UmlAtomicService } from '../services/UmlAtomicService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class UmlController {
  /**
   * GET /api/v1/projects/:id/diagram
   */
  static async getDiagram(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params.id, 10);
      if (isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'ID de proyecto inválido' });
        return;
      }

      const diagram = await UmlAtomicService.getDiagram(projectId);
      if (!diagram) {
        res.status(404).json({ success: false, error: 'Proyecto no encontrado' });
        return;
      }

      res.status(200).json({ success: true, diagram });
    } catch (err: any) {
      console.error('[UmlController.getDiagram] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al obtener diagrama' });
    }
  }

  /**
   * POST /api/v1/projects/:id/classes
   */
  static async createClass(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params.id, 10);
      if (isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'ID de proyecto inválido' });
        return;
      }

      const { name, stereotype, isAbstract, posX, posY, width, height, backgroundColor, attributes } = req.body;
      if (!name || typeof name !== 'string' || name.trim() === '') {
        res.status(400).json({ success: false, error: 'El nombre de la clase es obligatorio' });
        return;
      }

      const umlClass = await UmlAtomicService.createClass(projectId, {
        name: name.trim(),
        stereotype,
        isAbstract,
        posX,
        posY,
        width,
        height,
        backgroundColor,
        attributes,
      });

      res.status(201).json({ success: true, class: umlClass });
    } catch (err: any) {
      console.error('[UmlController.createClass] Error:', err);
      if (err.code === '23505') {
        res.status(409).json({ success: false, error: 'Ya existe una clase con ese nombre en este proyecto' });
        return;
      }
      res.status(500).json({ success: false, error: err.message || 'Error al crear clase' });
    }
  }

  /**
   * PUT /api/v1/classes/:id
   */
  static async updateClass(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const classId = parseInt(req.params.id, 10);
      if (isNaN(classId)) {
        res.status(400).json({ success: false, error: 'ID de clase inválido' });
        return;
      }

      const { name, stereotype, isAbstract, posX, posY, width, height, backgroundColor } = req.body;

      const umlClass = await UmlAtomicService.updateClass(classId, {
        name,
        stereotype,
        isAbstract,
        posX,
        posY,
        width,
        height,
        backgroundColor,
      });

      res.status(200).json({ success: true, class: umlClass });
    } catch (err: any) {
      console.error('[UmlController.updateClass] Error:', err);
      if (err.code === '23505') {
        res.status(409).json({ success: false, error: 'Ya existe una clase con ese nombre en este proyecto' });
        return;
      }
      res.status(500).json({ success: false, error: err.message || 'Error al actualizar clase' });
    }
  }

  /**
   * DELETE /api/v1/classes/:id
   */
  static async deleteClass(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const classId = parseInt(req.params.id, 10);
      if (isNaN(classId)) {
        res.status(400).json({ success: false, error: 'ID de clase inválido' });
        return;
      }

      const deleted = await UmlAtomicService.deleteClass(classId);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Clase no encontrada' });
        return;
      }

      res.status(200).json({ success: true, message: 'Clase eliminada exitosamente' });
    } catch (err: any) {
      console.error('[UmlController.deleteClass] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al eliminar clase' });
    }
  }

  /**
   * POST /api/v1/classes/:id/attributes
   */
  static async createAttribute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const classId = parseInt(req.params.id, 10);
      if (isNaN(classId)) {
        res.status(400).json({ success: false, error: 'ID de clase inválido' });
        return;
      }

      const { name, type, visibility, isPk, isFk, isNullable, defaultValue, order } = req.body;
      if (!name || !type) {
        res.status(400).json({ success: false, error: 'Nombre y tipo de dato del atributo son obligatorios' });
        return;
      }

      const attribute = await UmlAtomicService.createAttribute(classId, {
        name: name.trim(),
        type: type.trim(),
        visibility,
        isPk,
        isFk,
        isNullable,
        defaultValue,
        order,
      });

      res.status(201).json({ success: true, attribute });
    } catch (err: any) {
      console.error('[UmlController.createAttribute] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al crear atributo' });
    }
  }

  /**
   * PUT /api/v1/attributes/:id
   */
  static async updateAttribute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const attributeId = parseInt(req.params.id, 10);
      if (isNaN(attributeId)) {
        res.status(400).json({ success: false, error: 'ID de atributo inválido' });
        return;
      }

      const { name, type, visibility, isPk, isFk, isNullable, defaultValue, order } = req.body;

      const attribute = await UmlAtomicService.updateAttribute(attributeId, {
        name,
        type,
        visibility,
        isPk,
        isFk,
        isNullable,
        defaultValue,
        order,
      });

      res.status(200).json({ success: true, attribute });
    } catch (err: any) {
      console.error('[UmlController.updateAttribute] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al actualizar atributo' });
    }
  }

  /**
   * DELETE /api/v1/attributes/:id
   */
  static async deleteAttribute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const attributeId = parseInt(req.params.id, 10);
      if (isNaN(attributeId)) {
        res.status(400).json({ success: false, error: 'ID de atributo inválido' });
        return;
      }

      const deleted = await UmlAtomicService.deleteAttribute(attributeId);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Atributo no encontrado' });
        return;
      }

      res.status(200).json({ success: true, message: 'Atributo eliminado exitosamente' });
    } catch (err: any) {
      console.error('[UmlController.deleteAttribute] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al eliminar atributo' });
    }
  }

  /**
   * POST /api/v1/classes/:id/methods
   */
  static async createMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const classId = parseInt(req.params.id, 10);
      if (isNaN(classId)) {
        res.status(400).json({ success: false, error: 'ID de clase inválido' });
        return;
      }

      const { name, returnType, visibility, order } = req.body;
      if (!name) {
        res.status(400).json({ success: false, error: 'El nombre del método es obligatorio' });
        return;
      }

      const method = await UmlAtomicService.createMethod(classId, {
        name: name.trim(),
        returnType,
        visibility,
        order,
      });

      res.status(201).json({ success: true, method });
    } catch (err: any) {
      console.error('[UmlController.createMethod] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al crear método' });
    }
  }

  /**
   * PUT /api/v1/methods/:id
   */
  static async updateMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const methodId = parseInt(req.params.id, 10);
      if (isNaN(methodId)) {
        res.status(400).json({ success: false, error: 'ID de método inválido' });
        return;
      }

      const { name, returnType, visibility, order } = req.body;

      const method = await UmlAtomicService.updateMethod(methodId, {
        name,
        returnType,
        visibility,
        order,
      });

      res.status(200).json({ success: true, method });
    } catch (err: any) {
      console.error('[UmlController.updateMethod] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al actualizar método' });
    }
  }

  /**
   * DELETE /api/v1/methods/:id
   */
  static async deleteMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const methodId = parseInt(req.params.id, 10);
      if (isNaN(methodId)) {
        res.status(400).json({ success: false, error: 'ID de método inválido' });
        return;
      }

      const deleted = await UmlAtomicService.deleteMethod(methodId);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Método no encontrado' });
        return;
      }

      res.status(200).json({ success: true, message: 'Método eliminado exitosamente' });
    } catch (err: any) {
      console.error('[UmlController.deleteMethod] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al eliminar método' });
    }
  }

  /**
   * POST /api/v1/projects/:id/relationships
   */
  static async createRelationship(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const projectId = parseInt(req.params.id, 10);
      if (isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'ID de proyecto inválido' });
        return;
      }

      const { sourceClassId, targetClassId, type, sourceMultiplicity, targetMultiplicity, name, isBidirectional } = req.body;
      if (!sourceClassId || !targetClassId || !type) {
        res.status(400).json({ success: false, error: 'sourceClassId, targetClassId y type son obligatorios' });
        return;
      }

      const relationship = await UmlAtomicService.createRelationship(projectId, {
        sourceClassId: Number(sourceClassId),
        targetClassId: Number(targetClassId),
        type,
        sourceMultiplicity,
        targetMultiplicity,
        name,
        isBidirectional,
      });

      res.status(201).json({ success: true, relationship });
    } catch (err: any) {
      console.error('[UmlController.createRelationship] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al crear relación' });
    }
  }

  /**
   * PUT /api/v1/relationships/:id
   */
  static async updateRelationship(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const relationshipId = parseInt(req.params.id, 10);
      if (isNaN(relationshipId)) {
        res.status(400).json({ success: false, error: 'ID de relación inválido' });
        return;
      }

      const { type, sourceMultiplicity, targetMultiplicity, name, isBidirectional } = req.body;

      const relationship = await UmlAtomicService.updateRelationship(relationshipId, {
        type,
        sourceMultiplicity,
        targetMultiplicity,
        name,
        isBidirectional,
      });

      res.status(200).json({ success: true, relationship });
    } catch (err: any) {
      console.error('[UmlController.updateRelationship] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al actualizar relación' });
    }
  }

  /**
   * DELETE /api/v1/relationships/:id
   */
  static async deleteRelationship(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const relationshipId = parseInt(req.params.id, 10);
      if (isNaN(relationshipId)) {
        res.status(400).json({ success: false, error: 'ID de relación inválido' });
        return;
      }

      const deleted = await UmlAtomicService.deleteRelationship(relationshipId);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Relación no encontrada' });
        return;
      }

      res.status(200).json({ success: true, message: 'Relación eliminada exitosamente' });
    } catch (err: any) {
      console.error('[UmlController.deleteRelationship] Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Error al eliminar relación' });
    }
  }
}
