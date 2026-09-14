import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { db } from '../config/database';
import { UmlAtomicService } from './UmlAtomicService';
import {
  DiagramModel,
  UmlClass,
  UmlAttribute,
  UmlMethod,
  UmlRelationship,
  UmlVisibility,
  UmlRelationshipType,
} from '../types/uml';

export interface ParsedXmiAttribute {
  id?: string;
  name: string;
  type: string;
  visibility: UmlVisibility;
  isPk: boolean;
  isNullable: boolean;
  defaultValue?: string;
}

export interface ParsedXmiMethod {
  id?: string;
  name: string;
  returnType: string;
  visibility: UmlVisibility;
}

export interface ParsedXmiClass {
  xmiId: string;
  name: string;
  stereotype?: string;
  isAbstract: boolean;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  attributes: ParsedXmiAttribute[];
  methods: ParsedXmiMethod[];
}

export interface ParsedXmiRelationship {
  xmiId: string;
  name?: string;
  type: UmlRelationshipType;
  sourceClassXmiId: string;
  targetClassXmiId: string;
  sourceMultiplicity: string;
  targetMultiplicity: string;
  isBidirectional?: boolean;
}

export interface XmiValidationResult {
  isValid: boolean;
  classes: ParsedXmiClass[];
  relationships: ParsedXmiRelationship[];
  warnings: string[];
  summary: {
    classesCount: number;
    attributesCount: number;
    methodsCount: number;
    relationshipsCount: number;
  };
}

export interface XmiImportResult {
  success: boolean;
  message: string;
  projectId: number;
  importedClasses: number;
  importedAttributes: number;
  importedMethods: number;
  importedRelationships: number;
  warnings?: string[];
}

export class XmiInteroperabilityService {
  /**
   * Mapeo de visibilidad UML a estándar XMI / OMG
   */
  private static visibilityToXmi(v?: UmlVisibility): string {
    switch (v) {
      case '+':
        return 'public';
      case '#':
        return 'protected';
      case '~':
        return 'package';
      case '-':
      default:
        return 'private';
    }
  }

  /**
   * Mapeo de visibilidad XMI / OMG a símbolo UML
   */
  private static xmiToVisibility(raw?: string): UmlVisibility {
    if (!raw) return '-';
    const l = raw.toLowerCase().trim();
    if (l === 'public' || l === '+') return '+';
    if (l === 'protected' || l === '#') return '#';
    if (l === 'package' || l === '~') return '~';
    return '-';
  }

  /**
   * Normaliza tipos de datos para interoperabilidad
   */
  public static normalizeDataType(raw?: string): string {
    if (!raw) return 'String';
    const clean = raw.includes('#') ? raw.split('#').pop()! : raw;
    const lower = clean.toLowerCase().trim();
    if (lower === 'string' || lower === 'varchar' || lower === 'text') return 'String';
    if (lower === 'integer' || lower === 'int') return 'Integer';
    if (lower === 'long' || lower === 'bigint') return 'Long';
    if (lower === 'boolean' || lower === 'bool') return 'Boolean';
    if (lower === 'date' || lower === 'localdate') return 'LocalDate';
    if (lower === 'datetime' || lower === 'timestamp' || lower === 'localdatetime') return 'LocalDateTime';
    if (lower === 'double' || lower === 'float' || lower === 'decimal' || lower === 'real') return 'BigDecimal';
    if (lower === 'void') return 'void';
    return clean;
  }

  /**
   * EXPORTACIÓN: Genera un documento XML compatible con Sparx Enterprise Architect (XMI 2.1 / UML 2.5)
   */
  static async exportToXmi(projectId: number): Promise<string> {
    const diagram = await UmlAtomicService.getDiagram(projectId);
    if (!diagram) {
      throw new Error(`Proyecto con ID ${projectId} no encontrado`);
    }

    const projectTitle = diagram.name || 'DiagramaConceptual';
    const classes = diagram.classes || [];
    const relationships = diagram.relationships || [];

    // Mapas para IDs de XMI
    const classIdToXmiId = new Map<string, string>();
    classes.forEach((c) => {
      classIdToXmiId.set(String(c.id), `EAID_${c.id}_CLASS`);
    });

    // Construcción del documento XMI 2.1
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<xmi:XMI xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1">\n`;
    xml += `  <xmi:Documentation exporter="CollaborativeCASE" exporterVersion="1.0"/>\n`;
    xml += `  <uml:Model xmi:type="uml:Model" xmi:id="model_root" name="${escapeXml(projectTitle)}">\n`;

    // 1. Clases con atributos, métodos y generalizaciones
    for (const cls of classes) {
      const clsXmiId = classIdToXmiId.get(String(cls.id)) || `EAID_${cls.id}_CLASS`;
      xml += `    <packagedElement xmi:type="uml:Class" xmi:id="${clsXmiId}" name="${escapeXml(cls.name)}" isAbstract="${cls.isAbstract ? 'true' : 'false'}">\n`;

      // Atributos
      if (cls.attributes && cls.attributes.length > 0) {
        for (const attr of cls.attributes) {
          const attrXmiId = `EAID_${cls.id}_ATTR_${attr.id}`;
          const vis = this.visibilityToXmi(attr.visibility);
          const isIdAttr = attr.isPk ? ` isID="true"` : '';
          xml += `      <ownedAttribute xmi:type="uml:Property" xmi:id="${attrXmiId}" name="${escapeXml(attr.name)}" visibility="${vis}"${isIdAttr}>\n`;
          xml += `        <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#${escapeXml(attr.type)}"/>\n`;
          xml += `      </ownedAttribute>\n`;
        }
      }

      // Métodos
      if (cls.methods && cls.methods.length > 0) {
        for (const m of cls.methods) {
          const methodXmiId = `EAID_${cls.id}_METH_${m.id}`;
          const vis = this.visibilityToXmi(m.visibility);
          xml += `      <ownedOperation xmi:type="uml:Operation" xmi:id="${methodXmiId}" name="${escapeXml(m.name)}" visibility="${vis}">\n`;
          xml += `        <ownedParameter xmi:type="uml:Parameter" xmi:id="${methodXmiId}_ret" direction="return">\n`;
          xml += `          <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#${escapeXml(m.returnType)}"/>\n`;
          xml += `        </ownedParameter>\n`;
          xml += `      </ownedOperation>\n`;
        }
      }

      // Generalizaciones salientes de esta clase
      const inheritances = relationships.filter(
        (r) => String(r.sourceClassId) === String(cls.id) && r.type === 'inheritance'
      );
      for (const inh of inheritances) {
        const targetXmiId = classIdToXmiId.get(String(inh.targetClassId));
        if (targetXmiId) {
          xml += `      <generalization xmi:type="uml:Generalization" xmi:id="EAID_GEN_${inh.id}" general="${targetXmiId}"/>\n`;
        }
      }

      xml += `    </packagedElement>\n`;
    }

    // 2. Asociaciones, Agregaciones, Composiciones y Dependencias
    const associationRels = relationships.filter((r) => r.type !== 'inheritance');
    for (const rel of associationRels) {
      const srcXmiId = classIdToXmiId.get(String(rel.sourceClassId));
      const tgtXmiId = classIdToXmiId.get(String(rel.targetClassId));
      if (!srcXmiId || !tgtXmiId) continue;

      const assocXmiId = `EAID_ASSOC_${rel.id}`;
      const endSrcId = `${assocXmiId}_src`;
      const endTgtId = `${assocXmiId}_tgt`;
      const relName = rel.name ? escapeXml(rel.name) : '';

      // Tipo de agregación en el extremo destino
      let aggregationType = 'none';
      if (rel.type === 'composition') aggregationType = 'composite';
      else if (rel.type === 'aggregation') aggregationType = 'shared';

      xml += `    <packagedElement xmi:type="uml:Association" xmi:id="${assocXmiId}" name="${relName}">\n`;
      xml += `      <memberEnd xmi:idref="${endSrcId}"/>\n`;
      xml += `      <memberEnd xmi:idref="${endTgtId}"/>\n`;

      // Extremo Origen
      const [srcLower, srcUpper] = parseMultiplicity(rel.sourceMultiplicity || '1..1');
      xml += `      <ownedEnd xmi:type="uml:Property" xmi:id="${endSrcId}" type="${srcXmiId}" aggregation="none">\n`;
      xml += `        <lowerValue xmi:type="uml:LiteralInteger" xmi:id="${endSrcId}_lv" value="${srcLower}"/>\n`;
      xml += `        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="${endSrcId}_uv" value="${srcUpper}"/>\n`;
      xml += `      </ownedEnd>\n`;

      // Extremo Destino
      const [tgtLower, tgtUpper] = parseMultiplicity(rel.targetMultiplicity || '1..*');
      xml += `      <ownedEnd xmi:type="uml:Property" xmi:id="${endTgtId}" type="${tgtXmiId}" aggregation="${aggregationType}">\n`;
      xml += `        <lowerValue xmi:type="uml:LiteralInteger" xmi:id="${endTgtId}_lv" value="${tgtLower}"/>\n`;
      xml += `        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="${endTgtId}_uv" value="${tgtUpper}"/>\n`;
      xml += `      </ownedEnd>\n`;

      xml += `    </packagedElement>\n`;
    }

    xml += `  </uml:Model>\n`;

    // 3. Extensión Sparx Enterprise Architect para Geometría y Diagrama Visual
    xml += `  <xmi:Extension extender="Enterprise Architect" extenderID="6.5">\n`;
    xml += `    <diagrams>\n`;
    xml += `      <diagram xmi:id="EAID_DIAGRAM_1">\n`;
    xml += `        <model package="model_root" name="${escapeXml(projectTitle)}" style="0"/>\n`;
    xml += `        <elements>\n`;

    for (const cls of classes) {
      const clsXmiId = classIdToXmiId.get(String(cls.id))!;
      const left = cls.position.x;
      const top = cls.position.y;
      const right = left + (cls.dimensions?.width || 200);
      const bottom = top + (cls.dimensions?.height || 160);
      xml += `          <element geometry="Left=${left};Top=${top};Right=${right};Bottom=${bottom};" subject="${clsXmiId}" seqno="1" style="DUID=${clsXmiId};"/>\n`;
    }

    xml += `        </elements>\n`;
    xml += `      </diagram>\n`;
    xml += `    </diagrams>\n`;
    xml += `  </xmi:Extension>\n`;

    xml += `</xmi:XMI>\n`;

    return xml;
  }

  /**
   * PARSEO Y VALIDACIÓN DE XMI (Enterprise Architect / OMG UML 2.1 / 2.5)
   */
  public static parseXmi(xmlContent: string): XmiValidationResult {
    if (!xmlContent || typeof xmlContent !== 'string' || xmlContent.trim().length === 0) {
      throw new Error('El contenido del archivo XMI está vacío');
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      parseAttributeValue: true,
      trimValues: true,
    });

    let doc: any;
    try {
      doc = parser.parse(xmlContent);
    } catch (err: any) {
      throw new Error(`Error de sintaxis XML al parsear XMI: ${err.message}`);
    }

    // Localizar la raíz XMI y el Modelo UML
    const xmiRoot = doc['xmi:XMI'] || doc['XMI'] || doc;
    const model =
      xmiRoot['uml:Model'] ||
      xmiRoot['Model'] ||
      xmiRoot['uml:Package'] ||
      xmiRoot['Package'] ||
      xmiRoot;

    const warnings: string[] = [];
    const classes: ParsedXmiClass[] = [];
    const relationships: ParsedXmiRelationship[] = [];

    // Diccionario de coordenadas extraídas de la extensión de EA (si existen)
    const geometryMap = new Map<string, { x: number; y: number; width: number; height: number }>();
    try {
      const eaExtension = xmiRoot['xmi:Extension'] || xmiRoot['Extension'];
      if (eaExtension) {
        const diagrams = eaExtension.diagrams?.diagram;
        const diagramList = Array.isArray(diagrams) ? diagrams : diagrams ? [diagrams] : [];
        for (const diag of diagramList) {
          const elements = diag.elements?.element;
          const elemList = Array.isArray(elements) ? elements : elements ? [elements] : [];
          for (const el of elemList) {
            const subject = el['@_subject'];
            const geom = el['@_geometry'];
            if (subject && geom && typeof geom === 'string') {
              const parts = geom.split(';').reduce((acc: any, cur: string) => {
                const [k, v] = cur.split('=');
                if (k && v) acc[k.trim()] = parseInt(v.trim(), 10);
                return acc;
              }, {});
              if (!isNaN(parts.Left) && !isNaN(parts.Top)) {
                const x = Math.max(20, Math.abs(parts.Left));
                const y = Math.max(20, Math.abs(parts.Top));
                const width = parts.Right ? Math.max(160, Math.abs(parts.Right - parts.Left)) : 200;
                const height = parts.Bottom ? Math.max(120, Math.abs(parts.Bottom - parts.Top)) : 160;
                geometryMap.set(subject, { x, y, width, height });
              }
            }
          }
        }
      }
    } catch {
      // Si falla la extracción de geometría, el auto-layout tomará el relevo
    }

    // Localizar elementos empaquetados (packagedElement u ownedMember)
    let rawElements: any[] = [];
    if (model['packagedElement']) {
      rawElements = Array.isArray(model['packagedElement'])
        ? model['packagedElement']
        : [model['packagedElement']];
    } else if (model['ownedMember']) {
      rawElements = Array.isArray(model['ownedMember'])
        ? model['ownedMember']
        : [model['ownedMember']];
    }

    // Auto-layout: distribución en cuadrícula
    let autoCol = 0;
    let autoRow = 0;
    const COL_SPACING = 260;
    const ROW_SPACING = 230;
    const COLS_PER_ROW = 3;

    // 1. Extraer Clases
    for (const elem of rawElements) {
      const type = elem['@_xmi:type'] || elem['@_type'];
      if (type === 'uml:Class' || type === 'Class') {
        const xmiId = String(elem['@_xmi:id'] || elem['@_id'] || `class_${classes.length + 1}`);
        const className = String(elem['@_name'] || `Clase_${classes.length + 1}`).trim();
        const isAbstract = elem['@_isAbstract'] === true || elem['@_isAbstract'] === 'true';
        const stereotype = elem['@_stereotype'] || 'entity';

        // Determinar posición
        let pos = geometryMap.get(xmiId);
        if (!pos) {
          pos = {
            x: 80 + autoCol * COL_SPACING,
            y: 80 + autoRow * ROW_SPACING,
            width: 200,
            height: 160,
          };
          autoCol++;
          if (autoCol >= COLS_PER_ROW) {
            autoCol = 0;
            autoRow++;
          }
        }

        // Extraer Atributos
        const attributes: ParsedXmiAttribute[] = [];
        let rawAttrs = elem['ownedAttribute'] || elem['attribute'] || [];
        if (!Array.isArray(rawAttrs)) rawAttrs = [rawAttrs];

        for (const ra of rawAttrs) {
          const attrName = String(ra['@_name'] || '').trim();
          if (!attrName) continue;

          let attrType = 'String';
          if (ra['type'] && typeof ra['type'] === 'object') {
            const href = ra['type']['@_href'];
            if (href) attrType = this.normalizeDataType(href);
            else if (ra['type']['@_name']) attrType = this.normalizeDataType(ra['type']['@_name']);
          } else if (ra['@_type']) {
            attrType = this.normalizeDataType(ra['@_type']);
          }

          const visibility = this.xmiToVisibility(ra['@_visibility']);
          const isPk =
            ra['@_isID'] === true ||
            ra['@_isID'] === 'true' ||
            attrName.toLowerCase() === 'id' ||
            attrName.toLowerCase() === `id_${className.toLowerCase()}`;

          attributes.push({
            id: ra['@_xmi:id'] || ra['@_id'],
            name: attrName,
            type: attrType,
            visibility,
            isPk,
            isNullable: !isPk,
          });
        }

        // Extraer Métodos / Operaciones
        const methods: ParsedXmiMethod[] = [];
        let rawOps = elem['ownedOperation'] || elem['operation'] || [];
        if (!Array.isArray(rawOps)) rawOps = [rawOps];

        for (const ro of rawOps) {
          const opName = String(ro['@_name'] || '').trim();
          if (!opName) continue;

          let returnType = 'void';
          let rawParams = ro['ownedParameter'] || ro['parameter'] || [];
          if (!Array.isArray(rawParams)) rawParams = [rawParams];

          for (const rp of rawParams) {
            if (rp['@_direction'] === 'return') {
              if (rp['type'] && typeof rp['type'] === 'object') {
                const href = rp['type']['@_href'];
                if (href) returnType = this.normalizeDataType(href);
                else if (rp['type']['@_name']) returnType = this.normalizeDataType(rp['type']['@_name']);
              } else if (rp['@_type']) {
                returnType = this.normalizeDataType(rp['@_type']);
              }
            }
          }

          methods.push({
            id: ro['@_xmi:id'] || ro['@_id'],
            name: opName,
            returnType,
            visibility: this.xmiToVisibility(ro['@_visibility']),
          });
        }

        // Generalización dentro de la clase (Herencia)
        let rawGen = elem['generalization'] || [];
        if (!Array.isArray(rawGen)) rawGen = [rawGen];
        for (const rg of rawGen) {
          const generalTarget = String(rg['@_general'] || '');
          if (generalTarget) {
            relationships.push({
              xmiId: String(rg['@_xmi:id'] || `gen_${relationships.length + 1}`),
              name: 'heredaDe',
              type: 'inheritance',
              sourceClassXmiId: xmiId,
              targetClassXmiId: generalTarget,
              sourceMultiplicity: '1..1',
              targetMultiplicity: '1..1',
            });
          }
        }

        classes.push({
          xmiId,
          name: className,
          stereotype,
          isAbstract,
          position: { x: pos.x, y: pos.y },
          dimensions: { width: pos.width, height: pos.height },
          attributes,
          methods,
        });
      }
    }

    // 2. Extraer Asociaciones y Relaciones Empaquetadas
    for (const elem of rawElements) {
      const type = elem['@_xmi:type'] || elem['@_type'];
      if (type === 'uml:Association' || type === 'Association') {
        const assocXmiId = String(elem['@_xmi:id'] || elem['@_id'] || `assoc_${relationships.length + 1}`);
        const assocName = elem['@_name'] || '';

        let ends = elem['ownedEnd'] || [];
        if (!Array.isArray(ends)) ends = [ends];

        if (ends.length >= 2) {
          const srcEnd = ends[0];
          const tgtEnd = ends[1];

          const srcTypeId = String(srcEnd['@_type'] || '');
          const tgtTypeId = String(tgtEnd['@_type'] || '');

          if (srcTypeId && tgtTypeId) {
            const tgtAgg = (tgtEnd['@_aggregation'] || '').toLowerCase();
            let relType: UmlRelationshipType = 'association';
            if (tgtAgg === 'composite') relType = 'composition';
            else if (tgtAgg === 'shared') relType = 'aggregation';

            const srcMult = extractMultiplicityFromEnd(srcEnd);
            const tgtMult = extractMultiplicityFromEnd(tgtEnd);

            relationships.push({
              xmiId: assocXmiId,
              name: assocName,
              type: relType,
              sourceClassXmiId: srcTypeId,
              targetClassXmiId: tgtTypeId,
              sourceMultiplicity: srcMult,
              targetMultiplicity: tgtMult,
              isBidirectional: true,
            });
          }
        }
      }
    }

    const totalAttributes = classes.reduce((acc, c) => acc + c.attributes.length, 0);
    const totalMethods = classes.reduce((acc, c) => acc + c.methods.length, 0);

    return {
      isValid: classes.length > 0,
      classes,
      relationships,
      warnings,
      summary: {
        classesCount: classes.length,
        attributesCount: totalAttributes,
        methodsCount: totalMethods,
        relationshipsCount: relationships.length,
      },
    };
  }

  /**
   * IMPORTACIÓN TRANSACCIONAL A POSTGRESQL 17
   */
  static async importXmi(
    projectId: number,
    xmlContent: string,
    mode: 'overwrite' | 'merge' = 'merge'
  ): Promise<XmiImportResult> {
    const validation = this.parseXmi(xmlContent);
    if (!validation.isValid || validation.classes.length === 0) {
      throw new Error('El archivo XMI no contiene clases válidas para importar');
    }

    return db.transaction(async (client) => {
      // Si mode es overwrite, limpiar el diagrama previo
      if (mode === 'overwrite') {
        await client.query('DELETE FROM uml_relaciones WHERE proyecto_id = $1', [projectId]);
        await client.query('DELETE FROM uml_clases WHERE proyecto_id = $1', [projectId]);
      }

      // Mapa de xmiId -> id en BD de PostgreSQL
      const xmiIdToDbId = new Map<string, number>();

      let importedClasses = 0;
      let importedAttributes = 0;
      let importedMethods = 0;
      let importedRelationships = 0;

      // 1. Insertar Clases
      for (const cls of validation.classes) {
        // Verificar si la clase ya existe por nombre en el proyecto (si es merge)
        let classDbId: number;
        const existRes = await client.query(
          'SELECT id FROM uml_clases WHERE proyecto_id = $1 AND nombre = $2',
          [projectId, cls.name]
        );

        if (existRes.rowCount && existRes.rowCount > 0) {
          classDbId = Number(existRes.rows[0].id);
          await client.query(
            `UPDATE uml_clases
             SET estereotipo = $1, es_abstracta = $2, pos_x = $3, pos_y = $4, ancho = $5, alto = $6, actualizado_en = CURRENT_TIMESTAMP
             WHERE id = $7`,
            [cls.stereotype || 'entity', cls.isAbstract, cls.position.x, cls.position.y, cls.dimensions.width, cls.dimensions.height, classDbId]
          );
        } else {
          const insertRes = await client.query(
            `INSERT INTO uml_clases (proyecto_id, nombre, estereotipo, es_abstracta, pos_x, pos_y, ancho, alto)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
            [projectId, cls.name, cls.stereotype || 'entity', cls.isAbstract, cls.position.x, cls.position.y, cls.dimensions.width, cls.dimensions.height]
          );
          classDbId = Number(insertRes.rows[0].id);
          importedClasses++;
        }

        xmiIdToDbId.set(cls.xmiId, classDbId);

        // 2. Insertar Atributos
        let attrOrder = 0;
        for (const attr of cls.attributes) {
          // Si no existe, insertar
          const attrExist = await client.query(
            'SELECT id FROM uml_atributos WHERE clase_id = $1 AND nombre = $2',
            [classDbId, attr.name]
          );
          if (attrExist.rowCount === 0) {
            await client.query(
              `INSERT INTO uml_atributos (clase_id, nombre, tipo_dato, visibilidad, es_clave_primaria, es_nulo, orden)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [classDbId, attr.name, attr.type, attr.visibility, attr.isPk, attr.isNullable, attrOrder++]
            );
            importedAttributes++;
          }
        }

        // 3. Insertar Métodos
        let methodOrder = 0;
        for (const m of cls.methods) {
          const mExist = await client.query(
            'SELECT id FROM uml_metodos WHERE clase_id = $1 AND nombre = $2',
            [classDbId, m.name]
          );
          if (mExist.rowCount === 0) {
            await client.query(
              `INSERT INTO uml_metodos (clase_id, nombre, tipo_retorno, visibilidad, orden)
               VALUES ($1, $2, $3, $4, $5)`,
              [classDbId, m.name, m.returnType, m.visibility, methodOrder++]
            );
            importedMethods++;
          }
        }
      }

      // 4. Insertar Relaciones
      for (const rel of validation.relationships) {
        const srcDbId = xmiIdToDbId.get(rel.sourceClassXmiId);
        const tgtDbId = xmiIdToDbId.get(rel.targetClassXmiId);

        if (srcDbId && tgtDbId) {
          const relExist = await client.query(
            `SELECT id FROM uml_relaciones
             WHERE proyecto_id = $1 AND clase_origen_id = $2 AND clase_destino_id = $3 AND tipo_relacion = $4`,
            [projectId, srcDbId, tgtDbId, rel.type]
          );

          if (relExist.rowCount === 0) {
            await client.query(
              `INSERT INTO uml_relaciones (proyecto_id, clase_origen_id, clase_destino_id, tipo_relacion, multiplicidad_origen, multiplicidad_destino, nombre_relacion, es_bidireccional)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                projectId,
                srcDbId,
                tgtDbId,
                rel.type,
                rel.sourceMultiplicity || '1..1',
                rel.targetMultiplicity || '1..*',
                rel.name || null,
                rel.isBidirectional || false,
              ]
            );
            importedRelationships++;
          }
        }
      }

      return {
        success: true,
        message: `Importación completada con éxito en PostgreSQL 17: ${importedClasses} clases nuevas, ${importedAttributes} atributos, ${importedMethods} métodos y ${importedRelationships} relaciones.`,
        projectId,
        importedClasses,
        importedAttributes,
        importedMethods,
        importedRelationships,
      };
    });
  }
}

// Helpers de escape y formateo
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseMultiplicity(mult: string): [number, string] {
  if (!mult) return [1, '1'];
  if (mult === '1..1' || mult === '1') return [1, '1'];
  if (mult === '0..1') return [0, '1'];
  if (mult === '0..*' || mult === '*') return [0, '*'];
  if (mult === '1..*') return [1, '*'];
  const parts = mult.split('..');
  const lower = parseInt(parts[0], 10) || 0;
  const upper = parts[1] || '1';
  return [lower, upper];
}

function extractMultiplicityFromEnd(end: any): string {
  let lower = '1';
  let upper = '1';

  if (end.lowerValue && end.lowerValue['@_value'] !== undefined) {
    lower = String(end.lowerValue['@_value']);
  } else if (end['@_lower'] !== undefined) {
    lower = String(end['@_lower']);
  }

  if (end.upperValue && end.upperValue['@_value'] !== undefined) {
    upper = String(end.upperValue['@_value']);
  } else if (end['@_upper'] !== undefined) {
    upper = String(end['@_upper']);
  }

  if (upper === '-1') upper = '*';

  return `${lower}..${upper}`;
}
