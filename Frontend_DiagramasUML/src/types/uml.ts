export type UmlVisibility = '+' | '-' | '#' | '~';

export interface UmlAttribute {
  id: string;
  dbId?: number;
  name: string;
  type: string;
  visibility: UmlVisibility;
  isPk?: boolean;
  isFk?: boolean;
  isNullable?: boolean;
  defaultValue?: string;
  order?: number;
}

export interface UmlMethod {
  id: string;
  dbId?: number;
  name: string;
  returnType: string;
  visibility: UmlVisibility;
  parameters?: string;
  order?: number;
}

export interface UmlClass {
  id: string;
  dbId?: number;
  name: string;
  stereotype?: string;
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
  intermediateTableId?: string;
}

export type DiagramType = 'class' | 'usecase' | 'domain';

export interface CanvasTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface DiagramModel {
  id: string;
  projectId?: number;
  name: string;
  type?: DiagramType;
  classes: UmlClass[];
  relationships: UmlRelationship[];
  transform?: CanvasTransform;
  version?: number;
  updatedAt?: string;
}
