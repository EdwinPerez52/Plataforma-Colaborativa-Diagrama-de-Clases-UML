import { db } from '../config/database';
import {
  DiagramModel,
  UmlClass,
  UmlAttribute,
  UmlMethod,
  UmlRelationship,
  UmlVisibility,
} from '../types/uml';

export class UmlRepository {
  /**
   * Carga el diagrama completo normalizado de un proyecto desde PostgreSQL (13 tablas)
   */
  static async getDiagramByProjectId(projectId: number): Promise<DiagramModel | null> {
    const projectRes = await db.query(
      'SELECT id, codigo_sala, titulo FROM proyectos WHERE id = $1',
      [projectId]
    );

    if (projectRes.rowCount === 0) {
      return null;
    }

    const project = projectRes.rows[0];

    // 1. Obtener clases del proyecto
    const classesRes = await db.query(
      `SELECT id, nombre, estereotipo, es_abstracta, pos_x, pos_y, ancho, alto, color_fondo
       FROM uml_clases
       WHERE proyecto_id = $1
       ORDER BY id ASC`,
      [projectId]
    );

    const classIds = classesRes.rows.map((r: any) => r.id);
    const classesMap = new Map<number, UmlClass>();

    for (const r of classesRes.rows) {
      const cls: UmlClass = {
        id: String(r.id),
        dbId: Number(r.id),
        name: r.nombre,
        stereotype: r.estereotipo || 'entity',
        isAbstract: Boolean(r.es_abstracta),
        position: { x: r.pos_x, y: r.pos_y },
        dimensions: { width: r.ancho, height: r.alto },
        backgroundColor: r.color_fondo || '#FFFFFF',
        attributes: [],
        methods: [],
      };
      classesMap.set(Number(r.id), cls);
    }

    if (classIds.length > 0) {
      // 2. Atributos
      const attrsRes = await db.query(
        `SELECT id, clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, COALESCE(es_clave_foranea, false) AS es_clave_foranea, es_nulo, valor_defecto, orden
         FROM uml_atributos
         WHERE clase_id = ANY($1::bigint[])
         ORDER BY orden ASC, id ASC`,
        [classIds]
      );

      for (const attrRow of attrsRes.rows) {
        const cls = classesMap.get(Number(attrRow.clase_id));
        if (cls) {
          cls.attributes.push({
            id: String(attrRow.id),
            dbId: Number(attrRow.id),
            name: attrRow.nombre,
            type: attrRow.tipo_dato,
            visibility: (attrRow.visibilidad || '-') as UmlVisibility,
            isPk: Boolean(attrRow.es_clave_primaria),
            isFk: Boolean(attrRow.es_clave_foranea),
            isNullable: Boolean(attrRow.es_nulo),
            defaultValue: attrRow.valor_defecto || undefined,
            order: attrRow.orden,
          });
        }
      }

      // 3. Métodos
      const methodsRes = await db.query(
        `SELECT id, clase_id, nombre, tipo_retorno, visibilidad, orden
         FROM uml_metodos
         WHERE clase_id = ANY($1::bigint[])
         ORDER BY orden ASC, id ASC`,
        [classIds]
      );

      for (const mRow of methodsRes.rows) {
        const cls = classesMap.get(Number(mRow.clase_id));
        if (cls) {
          cls.methods.push({
            id: String(mRow.id),
            dbId: Number(mRow.id),
            name: mRow.nombre,
            returnType: mRow.tipo_retorno || 'void',
            visibility: (mRow.visibilidad || '+') as UmlVisibility,
            order: mRow.orden,
          });
        }
      }
    }

    // 4. Relaciones
    const relsRes = await db.query(
      `SELECT id, clase_origen_id, clase_destino_id, tipo_relacion,
              multiplicidad_origen, multiplicidad_destino, nombre_relacion, es_bidireccional, clase_intermedia_id
       FROM uml_relaciones
       WHERE proyecto_id = $1
       ORDER BY id ASC`,
      [projectId]
    );

    const relationships: UmlRelationship[] = relsRes.rows.map((r: any) => ({
      id: String(r.id),
      dbId: Number(r.id),
      sourceClassId: String(r.clase_origen_id),
      targetClassId: String(r.clase_destino_id),
      type: r.tipo_relacion,
      sourceMultiplicity: r.multiplicidad_origen,
      targetMultiplicity: r.multiplicidad_destino,
      name: r.nombre_relacion || undefined,
      isBidirectional: Boolean(r.es_bidireccional),
      intermediateClassId: r.clase_intermedia_id ? String(r.clase_intermedia_id) : undefined,
      intermediateTableId: r.clase_intermedia_id ? String(r.clase_intermedia_id) : undefined,
    }));

    return {
      id: String(project.codigo_sala),
      projectId: Number(project.id),
      name: project.titulo,
      classes: Array.from(classesMap.values()),
      relationships,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Guarda o actualiza atómicamente el estado completo del diagrama en las tablas normalizadas
   */
  static async persistCompleteDiagram(
    projectId: number,
    diagram: DiagramModel,
    userId: number = 1,
    motive: string = 'Sincronización colaborativa'
  ): Promise<void> {
    await db.transaction(async (client) => {
      // 1. Guardar Snapshot histórico en snapshots_versiones
      const countRes = await client.query(
        'SELECT COALESCE(MAX(numero_version), 0) + 1 AS next_ver FROM snapshots_versiones WHERE proyecto_id = $1',
        [projectId]
      );
      const nextVersion = countRes.rows[0].next_ver;

      await client.query(
        `INSERT INTO snapshots_versiones (proyecto_id, autor_id, numero_version, motivo, snapshot_completo)
         VALUES ($1, $2, $3, $4, $5)`,
        [projectId, userId, nextVersion, motive, JSON.stringify(diagram)]
      );

      // Mapa para traducir IDs string en memoria a bigint autoincremental de Postgres
      const memoryIdToDbId = new Map<string, number>();

      // Sincronizar Clases en uml_clases
      for (const cls of diagram.classes) {
        let classDbId: number;

        if (cls.dbId) {
          await client.query(
            `UPDATE uml_clases
             SET nombre = $1, estereotipo = $2, es_abstracta = $3, pos_x = $4, pos_y = $5, ancho = $6, alto = $7, color_fondo = $8, actualizado_en = CURRENT_TIMESTAMP
             WHERE id = $9 AND proyecto_id = $10`,
            [
              cls.name,
              cls.stereotype || 'entity',
              cls.isAbstract || false,
              cls.position.x,
              cls.position.y,
              cls.dimensions?.width || 180,
              cls.dimensions?.height || 140,
              cls.backgroundColor || '#FFFFFF',
              cls.dbId,
              projectId,
            ]
          );
          classDbId = cls.dbId;
        } else {
          const insertRes = await client.query(
            `INSERT INTO uml_clases (proyecto_id, nombre, estereotipo, es_abstracta, pos_x, pos_y, ancho, alto, color_fondo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id`,
            [
              projectId,
              cls.name,
              cls.stereotype || 'entity',
              cls.isAbstract || false,
              cls.position.x,
              cls.position.y,
              cls.dimensions?.width || 180,
              cls.dimensions?.height || 140,
              cls.backgroundColor || '#FFFFFF',
            ]
          );
          classDbId = Number(insertRes.rows[0].id);
        }

        memoryIdToDbId.set(cls.id, classDbId);

        // Limpiar atributos y métodos viejos para reinsertar ordenadamente
        await client.query('DELETE FROM uml_atributos WHERE clase_id = $1', [classDbId]);
        await client.query('DELETE FROM uml_metodos WHERE clase_id = $1', [classDbId]);

        // Insertar atributos
        let attrOrder = 1;
        for (const attr of cls.attributes) {
          await client.query(
            `INSERT INTO uml_atributos (clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, es_clave_foranea, es_nulo, valor_defecto, orden)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              classDbId,
              attr.name,
              attr.type,
              attr.visibility || '-',
              attr.isPk || false,
              attr.isFk || false,
              attr.isNullable !== undefined ? attr.isNullable : true,
              attr.defaultValue || null,
              attrOrder++,
            ]
          );
        }

        // Insertar métodos
        let methodOrder = 1;
        for (const method of cls.methods) {
          await client.query(
            `INSERT INTO uml_metodos (clase_id, nombre, tipo_retorno, visibilidad, orden)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              classDbId,
              method.name,
              method.returnType || 'void',
              method.visibility || '+',
              methodOrder++,
            ]
          );
        }
      }

      // 3. Sincronizar Relaciones en uml_relaciones
      // Limpiamos relaciones previas del proyecto para consistencia relacional completa
      await client.query('DELETE FROM uml_relaciones WHERE proyecto_id = $1', [projectId]);

      for (const rel of diagram.relationships) {
        const sourceDbId = memoryIdToDbId.get(rel.sourceClassId) || Number(rel.sourceClassId);
        const targetDbId = memoryIdToDbId.get(rel.targetClassId) || Number(rel.targetClassId);
        const intermRaw = rel.intermediateClassId || rel.intermediateTableId;
        const intermDbId = intermRaw ? (memoryIdToDbId.get(intermRaw) || Number(intermRaw) || null) : null;

        if (sourceDbId && targetDbId) {
          await client.query(
            `INSERT INTO uml_relaciones (proyecto_id, clase_origen_id, clase_destino_id, tipo_relacion, multiplicidad_origen, multiplicidad_destino, nombre_relacion, es_bidireccional, clase_intermedia_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              projectId,
              sourceDbId,
              targetDbId,
              rel.type,
              rel.sourceMultiplicity || '1..1',
              rel.targetMultiplicity || '1..*',
              rel.name || null,
              rel.isBidirectional || false,
              intermDbId,
            ]
          );
        }
      }
    });
  }
}
