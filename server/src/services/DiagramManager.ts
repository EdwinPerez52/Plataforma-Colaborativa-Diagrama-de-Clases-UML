import { v4 as uuidv4 } from 'uuid';
import { DiagramModel, UmlAttribute, UmlClass, UmlRelationship, UmlMultiplicity } from '../types/uml';

export class DiagramManager {
  private diagrams: Map<string, DiagramModel> = new Map();

  /**
   * Obtiene o inicializa el diagrama de una sala.
   */
  public getDiagram(roomId: string, name: string = 'Diagrama Conceptual'): DiagramModel {
    let diagram = this.diagrams.get(roomId);
    if (!diagram) {
      diagram = {
        id: roomId,
        name,
        classes: [],
        relationships: [],
        version: 1,
        updatedAt: new Date().toISOString()
      };
      this.diagrams.set(roomId, diagram);
    }
    return diagram;
  }

  /**
   * Agrega una nueva clase al diagrama.
   */
  public addClass(roomId: string, umlClass: UmlClass): DiagramModel {
    const diagram = this.getDiagram(roomId);
    // Verificar si ya existe por ID
    const existingIndex = diagram.classes.findIndex(c => c.id === umlClass.id);
    if (existingIndex >= 0) {
      diagram.classes[existingIndex] = umlClass;
    } else {
      diagram.classes.push(umlClass);
    }
    diagram.version++;
    diagram.updatedAt = new Date().toISOString();
    return diagram;
  }

  /**
   * Actualiza una clase existente.
   */
  public updateClass(roomId: string, umlClass: UmlClass): { diagram: DiagramModel; updatedClass?: UmlClass } {
    const diagram = this.getDiagram(roomId);
    const index = diagram.classes.findIndex(c => c.id === umlClass.id);
    if (index >= 0) {
      diagram.classes[index] = { ...diagram.classes[index], ...umlClass };
      diagram.version++;
      diagram.updatedAt = new Date().toISOString();
      return { diagram, updatedClass: diagram.classes[index] };
    }
    return { diagram };
  }

  /**
   * Elimina una clase y sus relaciones asociadas.
   */
  public deleteClass(roomId: string, classId: string): DiagramModel {
    const diagram = this.getDiagram(roomId);
    diagram.classes = diagram.classes.filter(c => c.id !== classId);
    diagram.relationships = diagram.relationships.filter(
      r => r.sourceClassId !== classId && r.targetClassId !== classId
    );
    diagram.version++;
    diagram.updatedAt = new Date().toISOString();
    return diagram;
  }

  /**
   * Agrega una relación. Si es de muchos a muchos (N a N),
   * genera automáticamente la tabla intermedia y ajusta las relaciones.
   */
  public addRelationship(roomId: string, rel: UmlRelationship): {
    diagram: DiagramModel;
    createdIntermediateClass?: UmlClass;
    createdRelationships?: UmlRelationship[];
  } {
    const diagram = this.getDiagram(roomId);
    const isManyToMany = this.isManyToManyMultiplicity(rel.sourceMultiplicity, rel.targetMultiplicity);

    if (isManyToMany) {
      return this.handleManyToManyRelationship(roomId, rel);
    }

    // Relación normal (1 a 1, 1 a N, N a 1)
    const existingIndex = diagram.relationships.findIndex(r => r.id === rel.id);
    if (existingIndex >= 0) {
      diagram.relationships[existingIndex] = rel;
    } else {
      diagram.relationships.push(rel);
    }

    diagram.version++;
    diagram.updatedAt = new Date().toISOString();
    return { diagram };
  }

  /**
   * Actualiza una relación existente. Si la cardinalidad cambia a muchos a muchos (N a N),
   * genera o edita la tabla intermedia requerida.
   */
  public updateRelationship(roomId: string, rel: UmlRelationship): {
    diagram: DiagramModel;
    createdIntermediateClass?: UmlClass;
    createdRelationships?: UmlRelationship[];
    removedIntermediateClassId?: string;
  } {
    const diagram = this.getDiagram(roomId);
    const existingRelIndex = diagram.relationships.findIndex(r => r.id === rel.id);
    const oldRel = existingRelIndex >= 0 ? diagram.relationships[existingRelIndex] : undefined;

    const wasManyToMany = oldRel
      ? this.isManyToManyMultiplicity(oldRel.sourceMultiplicity, oldRel.targetMultiplicity)
      : false;
    const isNowManyToMany = this.isManyToManyMultiplicity(rel.sourceMultiplicity, rel.targetMultiplicity);

    // Caso 1: Cambio de 1-N a N-N -> Generar tabla intermedia
    if (!wasManyToMany && isNowManyToMany) {
      return this.handleManyToManyRelationship(roomId, rel);
    }

    // Caso 2: Cambio de N-N a 1-N -> Revertir tabla intermedia si existía
    if (wasManyToMany && !isNowManyToMany && oldRel?.intermediateTableId) {
      const intermediateId = oldRel.intermediateTableId;
      diagram.classes = diagram.classes.filter(c => c.id !== intermediateId);
      diagram.relationships = diagram.relationships.filter(
        r => r.sourceClassId !== intermediateId && r.targetClassId !== intermediateId && r.id !== rel.id
      );
      rel.intermediateTableId = undefined;
      diagram.relationships.push(rel);
      diagram.version++;
      diagram.updatedAt = new Date().toISOString();
      return { diagram, removedIntermediateClassId: intermediateId };
    }

    // Actualización regular
    if (existingRelIndex >= 0) {
      diagram.relationships[existingRelIndex] = rel;
    } else {
      diagram.relationships.push(rel);
    }

    diagram.version++;
    diagram.updatedAt = new Date().toISOString();
    return { diagram };
  }

  /**
   * Elimina una relación y su tabla intermedia asociada si correspondía a un N a N automático.
   */
  public deleteRelationship(roomId: string, relId: string): DiagramModel {
    const diagram = this.getDiagram(roomId);
    const rel = diagram.relationships.find(r => r.id === relId);
    if (rel && rel.intermediateTableId) {
      diagram.classes = diagram.classes.filter(c => c.id !== rel.intermediateTableId);
      diagram.relationships = diagram.relationships.filter(
        r => r.sourceClassId !== rel.intermediateTableId && r.targetClassId !== rel.intermediateTableId
      );
    }
    diagram.relationships = diagram.relationships.filter(r => r.id !== relId);
    diagram.version++;
    diagram.updatedAt = new Date().toISOString();
    return diagram;
  }

  /**
   * Maneja la generación de tabla intermedia para una relación de Muchos a Muchos.
   */
  private handleManyToManyRelationship(roomId: string, rel: UmlRelationship): {
    diagram: DiagramModel;
    createdIntermediateClass: UmlClass;
    createdRelationships: UmlRelationship[];
  } {
    const diagram = this.getDiagram(roomId);
    const sourceClass = diagram.classes.find(c => c.id === rel.sourceClassId);
    const targetClass = diagram.classes.find(c => c.id === rel.targetClassId);

    const sourceName = sourceClass ? sourceClass.name : 'EntidadA';
    const targetName = targetClass ? targetClass.name : 'EntidadB';

    // Calcular posición intermedia
    const posX = sourceClass && targetClass ? (sourceClass.position.x + targetClass.position.x) / 2 : 250;
    const posY = sourceClass && targetClass ? (sourceClass.position.y + targetClass.position.y) / 2 + 100 : 250;

    const intermediateId = rel.intermediateTableId || `class-interm-${uuidv4().substring(0, 8)}`;
    const intermediateName = `${sourceName}_${targetName}`;

    // Atributos de la tabla intermedia (ID autoincremental + Llaves foráneas a ambas entidades + timestamp)
    const intermediateAttributes: UmlAttribute[] = [
      {
        id: `attr-${uuidv4().substring(0, 8)}`,
        name: 'id',
        type: 'Long',
        visibility: '+',
        isPk: true,
        isNullable: false
      },
      {
        id: `attr-${uuidv4().substring(0, 8)}`,
        name: `${this.toSnakeCase(sourceName)}_id`,
        type: 'Long',
        visibility: '+',
        isPk: true,
        isFk: true,
        isNullable: false
      },
      {
        id: `attr-${uuidv4().substring(0, 8)}`,
        name: `${this.toSnakeCase(targetName)}_id`,
        type: 'Long',
        visibility: '+',
        isPk: true,
        isFk: true,
        isNullable: false
      },
      {
        id: `attr-${uuidv4().substring(0, 8)}`,
        name: 'fecha_registro',
        type: 'LocalDate',
        visibility: '+',
        isNullable: false
      }
    ];

    const intermediateClass: UmlClass = {
      id: intermediateId,
      name: intermediateName,
      stereotype: 'intermediate_table',
      attributes: intermediateAttributes,
      methods: [],
      position: { x: posX, y: posY }
    };

    // Agregar o actualizar clase intermedia en el diagrama
    const existingClassIdx = diagram.classes.findIndex(c => c.id === intermediateId);
    if (existingClassIdx >= 0) {
      diagram.classes[existingClassIdx] = intermediateClass;
    } else {
      diagram.classes.push(intermediateClass);
    }

    // Crear las 2 relaciones 1 a N:
    // 1) SourceClass (1) -> (1..*) IntermediateClass
    // 2) TargetClass (1) -> (1..*) IntermediateClass
    const rel1Id = `rel-${uuidv4().substring(0, 8)}`;
    const rel2Id = `rel-${uuidv4().substring(0, 8)}`;

    const relToSource: UmlRelationship = {
      id: rel1Id,
      sourceClassId: rel.sourceClassId,
      targetClassId: intermediateId,
      type: 'composition',
      sourceMultiplicity: '1',
      targetMultiplicity: '1..*',
      name: `posee_${this.toSnakeCase(intermediateName)}`
    };

    const relToTarget: UmlRelationship = {
      id: rel2Id,
      sourceClassId: rel.targetClassId,
      targetClassId: intermediateId,
      type: 'composition',
      sourceMultiplicity: '1',
      targetMultiplicity: '1..*',
      name: `posee_${this.toSnakeCase(intermediateName)}`
    };

    // Asignar el intermediateTableId a la relación original o registrar las nuevas
    rel.intermediateTableId = intermediateId;

    // Eliminar relaciones previas asociadas a esta tabla intermedia para no duplicar
    diagram.relationships = diagram.relationships.filter(
      r => r.id !== rel.id && r.targetClassId !== intermediateId
    );

    diagram.relationships.push(rel);
    diagram.relationships.push(relToSource);
    diagram.relationships.push(relToTarget);

    diagram.version++;
    diagram.updatedAt = new Date().toISOString();

    return {
      diagram,
      createdIntermediateClass: intermediateClass,
      createdRelationships: [relToSource, relToTarget]
    };
  }

  private isManyToManyMultiplicity(src?: UmlMultiplicity | string, tgt?: UmlMultiplicity | string): boolean {
    const isMany = (m?: UmlMultiplicity | string) => m === '*' || m === '1..*' || m === '0..*';
    return Boolean(src && tgt && isMany(src) && isMany(tgt));
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
}
