import { db } from '../config/database';
import {
  UmlClass,
  UmlAttribute,
  UmlMethod,
  UmlRelationship,
  UmlVisibility,
  UmlRelationshipType,
  DiagramModel,
} from '../types/uml';
import { UmlRepository } from '../repositories/UmlRepository';

export interface CreateClassDTO {
  name: string;
  stereotype?: string;
  isAbstract?: boolean;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
  attributes?: Array<{
    name: string;
    type: string;
    visibility?: UmlVisibility;
    isPk?: boolean;
    isNullable?: boolean;
  }>;
}

export interface UpdateClassDTO {
  name?: string;
  stereotype?: string;
  isAbstract?: boolean;
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  backgroundColor?: string;
}

export interface CreateAttributeDTO {
  name: string;
  type: string;
  visibility?: UmlVisibility;
  isPk?: boolean;
  isFk?: boolean;
  isNullable?: boolean;
  defaultValue?: string;
  order?: number;
}

export interface UpdateAttributeDTO {
  name?: string;
  type?: string;
  visibility?: UmlVisibility;
  isPk?: boolean;
  isFk?: boolean;
  isNullable?: boolean;
  defaultValue?: string;
  order?: number;
}

export interface CreateMethodDTO {
  name: string;
  returnType?: string;
  visibility?: UmlVisibility;
  order?: number;
}

export interface UpdateMethodDTO {
  name?: string;
  returnType?: string;
  visibility?: UmlVisibility;
  order?: number;
}

export interface CreateRelationshipDTO {
  sourceClassId: number;
  targetClassId: number;
  type: UmlRelationshipType;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  name?: string;
  isBidirectional?: boolean;
  intermediateClassId?: number | string;
  intermediateTableId?: number | string;
}

export interface UpdateRelationshipDTO {
  type?: UmlRelationshipType;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  name?: string;
  isBidirectional?: boolean;
  intermediateClassId?: number | string | null;
  intermediateTableId?: number | string | null;
}

export class UmlAtomicService {
  /**
   * Obtiene el diagrama completo normalizado de un proyecto
   */
  static async getDiagram(projectId: number): Promise<DiagramModel | null> {
    return UmlRepository.getDiagramByProjectId(projectId);
  }

  /**
   * Inserta una nueva clase en uml_clases y sus atributos iniciales si se proveen
   */
  static async createClass(projectId: number, dto: CreateClassDTO): Promise<UmlClass> {
    const {
      name,
      stereotype = 'entity',
      isAbstract = false,
      posX = 100,
      posY = 100,
      width = 200,
      height = 160,
      backgroundColor = '#FFFFFF',
      attributes = [],
    } = dto;

    return await db.transaction(async (client) => {
      const insertClassRes = await client.query(
        `INSERT INTO uml_clases (proyecto_id, nombre, estereotipo, es_abstracta, pos_x, pos_y, ancho, alto, color_fondo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, proyecto_id, nombre, estereotipo, es_abstracta, pos_x, pos_y, ancho, alto, color_fondo`,
        [projectId, name, stereotype, isAbstract, posX, posY, width, height, backgroundColor]
      );

      const classRow = insertClassRes.rows[0];
      const classId = Number(classRow.id);

      const createdAttributes: UmlAttribute[] = [];

      // Si no vienen atributos, creamos por defecto un id PK como buena práctica UML 2.5
      const attrsToInsert = attributes.length > 0 ? attributes : [
        { name: 'id', type: 'Long', visibility: '-' as UmlVisibility, isPk: true, isNullable: false }
      ];

      let order = 1;
      for (const attr of attrsToInsert) {
        const attrRes = await client.query(
          `INSERT INTO uml_atributos (clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, es_clave_foranea, es_nulo, orden)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, nombre, tipo_dato, visibilidad, es_clave_primaria, COALESCE(es_clave_foranea, false) as es_clave_foranea, es_nulo, valor_defecto, orden`,
          [
            classId,
            attr.name,
            attr.type,
            attr.visibility || '-',
            attr.isPk || false,
            (attr as any).isFk || false,
            attr.isNullable !== undefined ? attr.isNullable : !attr.isPk,
            order++,
          ]
        );
        const aRow = attrRes.rows[0];
        createdAttributes.push({
          id: String(aRow.id),
          dbId: Number(aRow.id),
          name: aRow.nombre,
          type: aRow.tipo_dato,
          visibility: aRow.visibilidad as UmlVisibility,
          isPk: Boolean(aRow.es_clave_primaria),
          isFk: Boolean(aRow.es_clave_foranea),
          isNullable: Boolean(aRow.es_nulo),
          defaultValue: aRow.valor_defecto || undefined,
          order: aRow.orden,
        });
      }

      return {
        id: String(classRow.id),
        dbId: classId,
        name: classRow.nombre,
        stereotype: classRow.estereotipo,
        isAbstract: Boolean(classRow.es_abstracta),
        position: { x: classRow.pos_x, y: classRow.pos_y },
        dimensions: { width: classRow.ancho, height: classRow.alto },
        backgroundColor: classRow.color_fondo,
        attributes: createdAttributes,
        methods: [],
      };
    });
  }

  /**
   * Actualiza propiedades o posición de una clase en uml_clases
   */
  static async updateClass(classId: number, dto: UpdateClassDTO): Promise<UmlClass> {
    const currentRes = await db.query('SELECT * FROM uml_clases WHERE id = $1', [classId]);
    if (currentRes.rowCount === 0) {
      throw new Error(`Clase con ID ${classId} no encontrada`);
    }

    const current = currentRes.rows[0];
    const name = dto.name !== undefined ? dto.name : current.nombre;
    const stereotype = dto.stereotype !== undefined ? dto.stereotype : current.estereotipo;
    const isAbstract = dto.isAbstract !== undefined ? dto.isAbstract : current.es_abstracta;
    const posX = dto.posX !== undefined ? dto.posX : current.pos_x;
    const posY = dto.posY !== undefined ? dto.posY : current.pos_y;
    const width = dto.width !== undefined ? dto.width : current.ancho;
    const height = dto.height !== undefined ? dto.height : current.alto;
    const backgroundColor = dto.backgroundColor !== undefined ? dto.backgroundColor : current.color_fondo;

    await db.query(
      `UPDATE uml_clases
       SET nombre = $1, estereotipo = $2, es_abstracta = $3, pos_x = $4, pos_y = $5,
           ancho = $6, alto = $7, color_fondo = $8, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $9`,
      [name, stereotype, isAbstract, posX, posY, width, height, backgroundColor, classId]
    );

    // Cargar atributos y métodos
    const attrsRes = await db.query(
      `SELECT id, nombre, tipo_dato, visibilidad, es_clave_primaria, COALESCE(es_clave_foranea, false) AS es_clave_foranea, es_nulo, valor_defecto, orden
       FROM uml_atributos WHERE clase_id = $1 ORDER BY orden ASC, id ASC`,
      [classId]
    );
    const methodsRes = await db.query(
      `SELECT id, nombre, tipo_retorno, visibilidad, orden
       FROM uml_metodos WHERE clase_id = $1 ORDER BY orden ASC, id ASC`,
      [classId]
    );

    return {
      id: String(classId),
      dbId: classId,
      name,
      stereotype,
      isAbstract: Boolean(isAbstract),
      position: { x: posX, y: posY },
      dimensions: { width, height },
      backgroundColor,
      attributes: attrsRes.rows.map((r: any) => ({
        id: String(r.id),
        dbId: Number(r.id),
        name: r.nombre,
        type: r.tipo_dato,
        visibility: r.visibilidad as UmlVisibility,
        isPk: Boolean(r.es_clave_primaria),
        isFk: Boolean(r.es_clave_foranea),
        isNullable: Boolean(r.es_nulo),
        defaultValue: r.valor_defecto || undefined,
        order: r.orden,
      })),
      methods: methodsRes.rows.map((r: any) => ({
        id: String(r.id),
        dbId: Number(r.id),
        name: r.nombre,
        returnType: r.tipo_retorno,
        visibility: r.visibilidad as UmlVisibility,
        order: r.orden,
      })),
    };
  }

  /**
   * Elimina una clase de uml_clases (en cascada elimina atributos, métodos y relaciones)
   */
  static async deleteClass(classId: number): Promise<boolean> {
    const res = await db.query('DELETE FROM uml_clases WHERE id = $1', [classId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Agrega un nuevo atributo a una clase en uml_atributos
   */
  static async createAttribute(classId: number, dto: CreateAttributeDTO): Promise<UmlAttribute> {
    // Determinar orden correlativo si no se especifica
    let order = dto.order;
    if (order === undefined) {
      const orderRes = await db.query(
        'SELECT COALESCE(MAX(orden), 0) + 1 AS next_order FROM uml_atributos WHERE clase_id = $1',
        [classId]
      );
      order = Number(orderRes.rows[0].next_order);
    }

    const res = await db.query(
      `INSERT INTO uml_atributos (clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, es_clave_foranea, es_nulo, valor_defecto, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, COALESCE(es_clave_foranea, false) AS es_clave_foranea, es_nulo, valor_defecto, orden`,
      [
        classId,
        dto.name,
        dto.type,
        dto.visibility || '-',
        dto.isPk || false,
        dto.isFk || false,
        dto.isNullable !== undefined ? dto.isNullable : !dto.isPk,
        dto.defaultValue || null,
        order,
      ]
    );

    const r = res.rows[0];
    return {
      id: String(r.id),
      dbId: Number(r.id),
      name: r.nombre,
      type: r.tipo_dato,
      visibility: r.visibilidad as UmlVisibility,
      isPk: Boolean(r.es_clave_primaria),
      isFk: Boolean(r.es_clave_foranea),
      isNullable: Boolean(r.es_nulo),
      defaultValue: r.valor_defecto || undefined,
      order: r.orden,
    };
  }

  /**
   * Actualiza un atributo en uml_atributos
   */
  static async updateAttribute(attributeId: number, dto: UpdateAttributeDTO): Promise<UmlAttribute> {
    const currentRes = await db.query('SELECT * FROM uml_atributos WHERE id = $1', [attributeId]);
    if (currentRes.rowCount === 0) {
      throw new Error(`Atributo con ID ${attributeId} no encontrado`);
    }

    const current = currentRes.rows[0];
    const name = dto.name !== undefined ? dto.name : current.nombre;
    const type = dto.type !== undefined ? dto.type : current.tipo_dato;
    const visibility = dto.visibility !== undefined ? dto.visibility : current.visibilidad;
    const isPk = dto.isPk !== undefined ? dto.isPk : current.es_clave_primaria;
    const isFk = dto.isFk !== undefined ? dto.isFk : current.es_clave_foranea;
    const isNullable = dto.isNullable !== undefined ? dto.isNullable : current.es_nulo;
    const defaultValue = dto.defaultValue !== undefined ? dto.defaultValue : current.valor_defecto;
    const order = dto.order !== undefined ? dto.order : current.orden;

    const res = await db.query(
      `UPDATE uml_atributos
       SET nombre = $1, tipo_dato = $2, visibilidad = $3, es_clave_primaria = $4,
           es_clave_foranea = $5, es_nulo = $6, valor_defecto = $7, orden = $8
       WHERE id = $9
       RETURNING id, clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, COALESCE(es_clave_foranea, false) AS es_clave_foranea, es_nulo, valor_defecto, orden`,
      [name, type, visibility, isPk, isFk || false, isNullable, defaultValue, order, attributeId]
    );

    const r = res.rows[0];
    return {
      id: String(r.id),
      dbId: Number(r.id),
      name: r.nombre,
      type: r.tipo_dato,
      visibility: r.visibilidad as UmlVisibility,
      isPk: Boolean(r.es_clave_primaria),
      isFk: Boolean(r.es_clave_foranea),
      isNullable: Boolean(r.es_nulo),
      defaultValue: r.valor_defecto || undefined,
      order: r.orden,
    };
  }

  /**
   * Elimina un atributo de uml_atributos
   */
  static async deleteAttribute(attributeId: number): Promise<boolean> {
    const res = await db.query('DELETE FROM uml_atributos WHERE id = $1', [attributeId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Agrega un nuevo método a una clase en uml_metodos
   */
  static async createMethod(classId: number, dto: CreateMethodDTO): Promise<UmlMethod> {
    let order = dto.order;
    if (order === undefined) {
      const orderRes = await db.query(
        'SELECT COALESCE(MAX(orden), 0) + 1 AS next_order FROM uml_metodos WHERE clase_id = $1',
        [classId]
      );
      order = Number(orderRes.rows[0].next_order);
    }

    const res = await db.query(
      `INSERT INTO uml_metodos (clase_id, nombre, tipo_retorno, visibilidad, orden)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, clase_id, nombre, tipo_retorno, visibilidad, orden`,
      [classId, dto.name, dto.returnType || 'void', dto.visibility || '+', order]
    );

    const r = res.rows[0];
    return {
      id: String(r.id),
      dbId: Number(r.id),
      name: r.nombre,
      returnType: r.tipo_retorno,
      visibility: r.visibilidad as UmlVisibility,
      order: r.orden,
    };
  }

  /**
   * Actualiza un método en uml_metodos
   */
  static async updateMethod(methodId: number, dto: UpdateMethodDTO): Promise<UmlMethod> {
    const currentRes = await db.query('SELECT * FROM uml_metodos WHERE id = $1', [methodId]);
    if (currentRes.rowCount === 0) {
      throw new Error(`Método con ID ${methodId} no encontrado`);
    }

    const current = currentRes.rows[0];
    const name = dto.name !== undefined ? dto.name : current.nombre;
    const returnType = dto.returnType !== undefined ? dto.returnType : current.tipo_retorno;
    const visibility = dto.visibility !== undefined ? dto.visibility : current.visibilidad;
    const order = dto.order !== undefined ? dto.order : current.orden;

    const res = await db.query(
      `UPDATE uml_metodos
       SET nombre = $1, tipo_retorno = $2, visibilidad = $3, orden = $4
       WHERE id = $5
       RETURNING id, clase_id, nombre, tipo_retorno, visibilidad, orden`,
      [name, returnType, visibility, order, methodId]
    );

    const r = res.rows[0];
    return {
      id: String(r.id),
      dbId: Number(r.id),
      name: r.nombre,
      returnType: r.tipo_retorno,
      visibility: r.visibilidad as UmlVisibility,
      order: r.orden,
    };
  }

  /**
   * Elimina un método de uml_metodos
   */
  static async deleteMethod(methodId: number): Promise<boolean> {
    const res = await db.query('DELETE FROM uml_metodos WHERE id = $1', [methodId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Crea una relación entre dos clases en uml_relaciones
   */
  static async createRelationship(projectId: number, dto: CreateRelationshipDTO): Promise<UmlRelationship> {
    const intermId = dto.intermediateClassId || dto.intermediateTableId ? Number(dto.intermediateClassId || dto.intermediateTableId) : null;
    const res = await db.query(
      `INSERT INTO uml_relaciones (proyecto_id, clase_origen_id, clase_destino_id, tipo_relacion, multiplicidad_origen, multiplicidad_destino, nombre_relacion, es_bidireccional, clase_intermedia_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, clase_origen_id, clase_destino_id, tipo_relacion, multiplicidad_origen, multiplicidad_destino, nombre_relacion, es_bidireccional, clase_intermedia_id`,
      [
        projectId,
        dto.sourceClassId,
        dto.targetClassId,
        dto.type,
        dto.sourceMultiplicity !== undefined ? dto.sourceMultiplicity : '',
        dto.targetMultiplicity !== undefined ? dto.targetMultiplicity : '',
        dto.name || null,
        dto.isBidirectional || false,
        intermId,
      ]
    );

    const r = res.rows[0];
    return {
      id: String(r.id),
      dbId: Number(r.id),
      sourceClassId: String(r.clase_origen_id),
      targetClassId: String(r.clase_destino_id),
      type: r.tipo_relacion as UmlRelationshipType,
      sourceMultiplicity: r.multiplicidad_origen,
      targetMultiplicity: r.multiplicidad_destino,
      name: r.nombre_relacion || undefined,
      isBidirectional: Boolean(r.es_bidireccional),
      intermediateClassId: r.clase_intermedia_id ? String(r.clase_intermedia_id) : undefined,
      intermediateTableId: r.clase_intermedia_id ? String(r.clase_intermedia_id) : undefined,
    };
  }

  /**
   * Actualiza una relación en uml_relaciones
   */
  static async updateRelationship(relationshipId: number, dto: UpdateRelationshipDTO): Promise<UmlRelationship> {
    const currentRes = await db.query('SELECT * FROM uml_relaciones WHERE id = $1', [relationshipId]);
    if (currentRes.rowCount === 0) {
      throw new Error(`Relación con ID ${relationshipId} no encontrada`);
    }

    const current = currentRes.rows[0];
    const type = dto.type !== undefined ? dto.type : current.tipo_relacion;
    const sourceMultiplicity = dto.sourceMultiplicity !== undefined ? dto.sourceMultiplicity : current.multiplicidad_origen;
    const targetMultiplicity = dto.targetMultiplicity !== undefined ? dto.targetMultiplicity : current.multiplicidad_destino;
    const name = dto.name !== undefined ? dto.name : current.nombre_relacion;
    const isBidirectional = dto.isBidirectional !== undefined ? dto.isBidirectional : current.es_bidireccional;
    const intermId = dto.intermediateClassId !== undefined
      ? (dto.intermediateClassId ? Number(dto.intermediateClassId) : null)
      : (dto.intermediateTableId !== undefined ? (dto.intermediateTableId ? Number(dto.intermediateTableId) : null) : current.clase_intermedia_id);

    const res = await db.query(
      `UPDATE uml_relaciones
       SET tipo_relacion = $1, multiplicidad_origen = $2, multiplicidad_destino = $3,
           nombre_relacion = $4, es_bidireccional = $5, clase_intermedia_id = $6
       WHERE id = $7
       RETURNING id, clase_origen_id, clase_destino_id, tipo_relacion, multiplicidad_origen, multiplicidad_destino, nombre_relacion, es_bidireccional, clase_intermedia_id`,
      [type, sourceMultiplicity, targetMultiplicity, name, isBidirectional, intermId, relationshipId]
    );

    const r = res.rows[0];
    return {
      id: String(r.id),
      dbId: Number(r.id),
      sourceClassId: String(r.clase_origen_id),
      targetClassId: String(r.clase_destino_id),
      type: r.tipo_relacion as UmlRelationshipType,
      sourceMultiplicity: r.multiplicidad_origen,
      targetMultiplicity: r.multiplicidad_destino,
      name: r.nombre_relacion || undefined,
      isBidirectional: Boolean(r.es_bidireccional),
      intermediateClassId: r.clase_intermedia_id ? String(r.clase_intermedia_id) : undefined,
      intermediateTableId: r.clase_intermedia_id ? String(r.clase_intermedia_id) : undefined,
    };
  }

  /**
   * Elimina una relación de uml_relaciones
   */
  static async deleteRelationship(relationshipId: number): Promise<boolean> {
    const res = await db.query('DELETE FROM uml_relaciones WHERE id = $1', [relationshipId]);
    return (res.rowCount ?? 0) > 0;
  }
}
