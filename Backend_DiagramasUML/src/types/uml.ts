export type UmlVisibility = '+' | '-' | '#' | '~';

export interface UmlAttribute {
  id: string;
  dbId?: number;
  name: string;
  type: string; // e.g. 'Long', 'Integer', 'String', 'Boolean', 'LocalDate', 'BigDecimal'
  visibility: UmlVisibility;
  isPk?: boolean;
  isFk?: boolean;
  isNullable?: boolean;
  defaultValue?: string;
  order?: number;
}

export interface UmlMethodParameter {
  id?: string;
  name: string;
  type: string;
  order?: number;
}

export interface UmlMethod {
  id: string;
  dbId?: number;
  name: string;
  returnType: string;
  visibility: UmlVisibility;
  parameters?: string;
  parameterList?: UmlMethodParameter[];
  order?: number;
}

export interface UmlClass {
  id: string;
  dbId?: number;
  name: string;
  stereotype?: string; // e.g. 'entity', 'intermediate_table', 'enum', 'abstract'
  isAbstract?: boolean;
  attributes: UmlAttribute[];
  methods: UmlMethod[];
  position: { x: number; y: number };
  dimensions?: { width: number; height: number };
  backgroundColor?: string;
}

export type UmlRelationshipType =
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'inheritance'
  | 'dependency'
  | 'ASOCIACION'
  | 'AGREGACION'
  | 'COMPOSICION'
  | 'HERENCIA'
  | 'GENERALIZACION'
  | 'DEPENDENCIA';

export type UmlMultiplicity = '1' | '0..1' | '1..*' | '*' | '0..*' | '1..1' | '';

export interface UmlRelationship {
  id: string;
  dbId?: number;
  sourceClassId: string;
  targetClassId: string;
  type: UmlRelationshipType;
  sourceMultiplicity?: UmlMultiplicity | string;
  targetMultiplicity?: UmlMultiplicity | string;
  name?: string;
  isBidirectional?: boolean;
  intermediateClassId?: string;
  intermediateTableId?: string; // ID de la tabla intermedia generada si es N a N
}

export interface DiagramModel {
  id: string;
  projectId?: number;
  name: string;
  classes: UmlClass[];
  relationships: UmlRelationship[];
  version: number;
  updatedAt: string;
}
