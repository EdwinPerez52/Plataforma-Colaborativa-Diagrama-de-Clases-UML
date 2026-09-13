import { db } from '../config/database';
import { AiNlpService, ParsedAiCommand } from './AiNlpService';
import { UmlAtomicService } from './UmlAtomicService';
import { UmlClass, UmlAttribute, UmlMethod, UmlRelationship } from '../types/uml';

export interface AiCommandExecutionResult {
  success: boolean;
  message: string;
  auditId: number;
  parsedCommand: ParsedAiCommand;
  mutatedEntity?: {
    type: 'CLASS' | 'ATTRIBUTE' | 'METHOD' | 'RELATIONSHIP';
    action: 'CREATED' | 'UPDATED' | 'DELETED';
    data: any;
  };
}

export class AiCommandExecutionService {
  /**
   * Ejecuta un comando en lenguaje natural (voz o texto) y lo audita en auditoria_comandos_ia
   */
  static async executeCommand(
    projectId: number,
    userId: number,
    channel: 'VOZ' | 'TEXTO',
    transcript: string
  ): Promise<AiCommandExecutionResult> {
    const parsed = AiNlpService.parseIntent(transcript);
    let success = false;
    let message = '';
    let mutatedEntity: AiCommandExecutionResult['mutatedEntity'] = undefined;

    try {
      switch (parsed.intent) {
        case 'CREAR_CLASE': {
          const className = parsed.entities.className!;
          // Calcular posición escalonada según clases existentes
          const countRes = await db.query(
            'SELECT COUNT(*) AS total FROM uml_clases WHERE proyecto_id = $1',
            [projectId]
          );
          const total = parseInt(countRes.rows[0].total, 10) || 0;
          const posX = 120 + (total % 4) * 230;
          const posY = 100 + Math.floor(total / 4) * 200;

          const createdClass = await UmlAtomicService.createClass(projectId, {
            name: className,
            stereotype: parsed.entities.stereotype || 'entity',
            posX,
            posY,
          });

          success = true;
          message = `Clase '${className}' creada exitosamente en el diagrama.`;
          mutatedEntity = {
            type: 'CLASS',
            action: 'CREATED',
            data: createdClass,
          };
          break;
        }

        case 'AGREGAR_ATRIBUTO': {
          const { className, attributeName, attributeType, isPk, visibility } = parsed.entities;
          // Buscar clase por nombre
          const classRes = await db.query(
            'SELECT id FROM uml_clases WHERE proyecto_id = $1 AND LOWER(nombre) = LOWER($2)',
            [projectId, className]
          );

          if (classRes.rowCount === 0) {
            throw new Error(`La clase '${className}' no existe en este proyecto.`);
          }

          const classId = Number(classRes.rows[0].id);
          const createdAttr = await UmlAtomicService.createAttribute(classId, {
            name: attributeName!,
            type: attributeType || 'String',
            isPk: Boolean(isPk),
            visibility: visibility || (isPk ? '-' : '-'),
          });

          success = true;
          message = `Atributo '${attributeName}: ${attributeType}' añadido a la clase '${className}'.`;
          mutatedEntity = {
            type: 'ATTRIBUTE',
            action: 'CREATED',
            data: { classId, attribute: createdAttr },
          };
          break;
        }

        case 'AGREGAR_METODO': {
          const { className, methodName, returnType, visibility } = parsed.entities;
          const classRes = await db.query(
            'SELECT id FROM uml_clases WHERE proyecto_id = $1 AND LOWER(nombre) = LOWER($2)',
            [projectId, className]
          );

          if (classRes.rowCount === 0) {
            throw new Error(`La clase '${className}' no existe en este proyecto.`);
          }

          const classId = Number(classRes.rows[0].id);
          const createdMethod = await UmlAtomicService.createMethod(classId, {
            name: methodName!,
            returnType: returnType || 'void',
            visibility: visibility || '+',
          });

          success = true;
          message = `Método '${methodName}(): ${returnType}' añadido a la clase '${className}'.`;
          mutatedEntity = {
            type: 'METHOD',
            action: 'CREATED',
            data: { classId, method: createdMethod },
          };
          break;
        }

        case 'CREAR_RELACION': {
          const { className: sourceName, targetClassName: targetName, relationshipType, sourceMultiplicity, targetMultiplicity } = parsed.entities;

          const sourceRes = await db.query(
            'SELECT id FROM uml_clases WHERE proyecto_id = $1 AND LOWER(nombre) = LOWER($2)',
            [projectId, sourceName]
          );
          const targetRes = await db.query(
            'SELECT id FROM uml_clases WHERE proyecto_id = $1 AND LOWER(nombre) = LOWER($2)',
            [projectId, targetName]
          );

          if (sourceRes.rowCount === 0) {
            throw new Error(`Clase origen '${sourceName}' no encontrada.`);
          }
          if (targetRes.rowCount === 0) {
            throw new Error(`Clase destino '${targetName}' no encontrada.`);
          }

          const sourceClassId = Number(sourceRes.rows[0].id);
          const targetClassId = Number(targetRes.rows[0].id);

          const createdRel = await UmlAtomicService.createRelationship(projectId, {
            sourceClassId,
            targetClassId,
            type: relationshipType as any,
            sourceMultiplicity: sourceMultiplicity || '1..1',
            targetMultiplicity: targetMultiplicity || '1..*',
            name: 'relaciona',
          });

          success = true;
          message = `Relación entre '${sourceName}' y '${targetName}' (${sourceMultiplicity} a ${targetMultiplicity}) creada exitosamente.`;
          mutatedEntity = {
            type: 'RELATIONSHIP',
            action: 'CREATED',
            data: createdRel,
          };
          break;
        }

        case 'ELIMINAR_ATRIBUTO': {
          const { className, attributeName } = parsed.entities;
          const classRes = await db.query(
            'SELECT id FROM uml_clases WHERE proyecto_id = $1 AND LOWER(nombre) = LOWER($2)',
            [projectId, className]
          );

          if (classRes.rowCount === 0) {
            throw new Error(`La clase '${className}' no existe en este proyecto.`);
          }

          const classId = Number(classRes.rows[0].id);
          const attrRes = await db.query(
            'SELECT id FROM uml_atributos WHERE clase_id = $1 AND LOWER(nombre) = LOWER($2)',
            [classId, attributeName]
          );

          if (attrRes.rowCount === 0) {
            throw new Error(`El atributo '${attributeName}' no fue encontrado en '${className}'.`);
          }

          const attrId = Number(attrRes.rows[0].id);
          await UmlAtomicService.deleteAttribute(attrId);

          success = true;
          message = `Atributo '${attributeName}' eliminado de la clase '${className}'.`;
          mutatedEntity = {
            type: 'ATTRIBUTE',
            action: 'DELETED',
            data: { classId, attributeId: attrId },
          };
          break;
        }

        case 'ELIMINAR_CLASE': {
          const { className } = parsed.entities;
          const classRes = await db.query(
            'SELECT id FROM uml_clases WHERE proyecto_id = $1 AND LOWER(nombre) = LOWER($2)',
            [projectId, className]
          );

          if (classRes.rowCount === 0) {
            throw new Error(`La clase '${className}' no existe en este proyecto.`);
          }

          const classId = Number(classRes.rows[0].id);
          await UmlAtomicService.deleteClass(classId);

          success = true;
          message = `Clase '${className}' eliminada correctamente del diagrama.`;
          mutatedEntity = {
            type: 'CLASS',
            action: 'DELETED',
            data: { classId },
          };
          break;
        }

        case 'RENOMBRAR_CLASE': {
          const { className, newClassName } = parsed.entities;
          const classRes = await db.query(
            'SELECT id FROM uml_clases WHERE proyecto_id = $1 AND LOWER(nombre) = LOWER($2)',
            [projectId, className]
          );

          if (classRes.rowCount === 0) {
            throw new Error(`La clase '${className}' no existe en este proyecto.`);
          }

          const classId = Number(classRes.rows[0].id);
          const updatedClass = await UmlAtomicService.updateClass(classId, { name: newClassName });

          success = true;
          message = `Clase '${className}' renombrada a '${newClassName}'.`;
          mutatedEntity = {
            type: 'CLASS',
            action: 'UPDATED',
            data: updatedClass,
          };
          break;
        }

        default: {
          success = false;
          message = `No se pudo reconocer la intención del comando: "${transcript}". Intente con: "Crea la clase [Nombre]" o "Añade a [Clase] el atributo [Nombre] tipo [Tipo]".`;
          break;
        }
      }
    } catch (err: any) {
      success = false;
      message = err.message || 'Error al ejecutar la mutación solicitada.';
    }

    // 2. Registrar en auditoria_comandos_ia según directiva de Fase 6
    const auditRes = await db.query(
      `INSERT INTO auditoria_comandos_ia (
         proyecto_id, usuario_id, canal_entrada, comando_transcrito,
         intencion_reconocida, payload_json, ejecutado_con_exito
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        projectId,
        userId,
        channel,
        transcript,
        parsed.intent,
        JSON.stringify(parsed.entities),
        success,
      ]
    );

    const auditId = Number(auditRes.rows[0].id);

    return {
      success,
      message,
      auditId,
      parsedCommand: parsed,
      mutatedEntity,
    };
  }

  /**
   * Consulta el historial de auditoría de comandos IA para un proyecto
   */
  static async getAuditHistory(projectId: number, limit = 50) {
    const res = await db.query(
      `SELECT a.id, a.proyecto_id, a.usuario_id, a.canal_entrada, a.comando_transcrito,
              a.intencion_reconocida, a.payload_json, a.ejecutado_con_exito, a.creado_en,
              u.nombre AS usuario_nombre, u.cargo AS usuario_cargo
       FROM auditoria_comandos_ia a
       INNER JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.proyecto_id = $1
       ORDER BY a.id DESC
       LIMIT $2`,
      [projectId, limit]
    );

    return res.rows.map((r: any) => ({
      id: Number(r.id),
      projectId: Number(r.proyecto_id),
      userId: Number(r.usuario_id),
      userName: r.usuario_nombre,
      userCargo: r.usuario_cargo,
      channel: r.canal_entrada,
      transcript: r.comando_transcrito,
      intent: r.intencion_reconocida,
      payload: r.payload_json,
      success: Boolean(r.ejecutado_con_exito),
      createdAt: r.creado_en.toISOString(),
    }));
  }
}
