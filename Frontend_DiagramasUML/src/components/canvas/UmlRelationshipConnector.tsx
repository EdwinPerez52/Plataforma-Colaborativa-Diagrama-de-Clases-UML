import React from 'react';
import { UmlRelationship, UmlClass } from '../../types/uml';
import { calculateOrthogonalPath, calculateIntermediateBranch, Rect } from '../../utils/geometry';

interface UmlRelationshipConnectorProps {
  relationship: UmlRelationship;
  sourceClass: UmlClass;
  targetClass: UmlClass;
  intermediateClass?: UmlClass;
  isSelected: boolean;
  theme?: 'dark' | 'light';
  onSelect: (rel: UmlRelationship) => void;
}

export const UmlRelationshipConnector: React.FC<UmlRelationshipConnectorProps> = ({
  relationship,
  sourceClass,
  targetClass,
  intermediateClass,
  isSelected,
  theme = 'dark',
  onSelect,
}) => {
  const isLight = theme === 'light';

  const sourceRect: Rect = {
    x: sourceClass.position.x,
    y: sourceClass.position.y,
    width: sourceClass.dimensions?.width || 210,
    height: sourceClass.dimensions?.height || 160,
  };

  const targetRect: Rect = {
    x: targetClass.position.x,
    y: targetClass.position.y,
    width: targetClass.dimensions?.width || 210,
    height: targetClass.dimensions?.height || 160,
  };

  const isSelfLoop = relationship.sourceClassId === relationship.targetClassId;
  const {
    path,
    sourceAnchor,
    targetAnchor,
    sourceLabelPos,
    targetLabelPos,
    centerLabelPos,
    sourceAngle,
    targetAngle,
  } = calculateOrthogonalPath(sourceRect, targetRect, isSelfLoop);

  // Normalización estricta del tipo de relación para soportar inglés y español
  const rawType = (relationship.type || '').toLowerCase();
  const isComposition = rawType === 'composition' || rawType === 'composicion';
  const isAggregation = rawType === 'aggregation' || rawType === 'agregacion';
  const isGeneralization =
    rawType === 'generalization' ||
    rawType === 'generalizacion' ||
    rawType === 'inheritance' ||
    rawType === 'herencia';
  const isDependency = rawType === 'dependency' || rawType === 'dependencia';
  const isAssociation = !isComposition && !isAggregation && !isGeneralization && !isDependency;

  let strokeDasharray: string | undefined = undefined;
  let strokeColor = isSelected ? '#10b981' : (isLight ? '#1e293b' : '#94a3b8');
  let strokeWidth = isSelected ? 2.5 : 1.8;

  if (isAssociation) {
    strokeColor = isSelected ? '#10b981' : (isLight ? '#0f172a' : '#60a5fa');
    strokeWidth = isSelected ? 2.5 : 1.8;
  } else if (isGeneralization) {
    strokeColor = isSelected ? '#10b981' : (isLight ? '#0284c7' : '#38bdf8');
    strokeWidth = isSelected ? 2.5 : 1.8;
  } else if (isAggregation) {
    strokeColor = isSelected ? '#10b981' : (isLight ? '#d97706' : '#fbbf24');
    strokeWidth = isSelected ? 2.5 : 1.8;
  } else if (isComposition) {
    // Composición UML: Alto contraste en la línea y rombo sólido
    strokeColor = isSelected ? '#10b981' : (isLight ? '#0f172a' : '#f8fafc');
    strokeWidth = isSelected ? 2.8 : 2.0;
  } else if (isDependency) {
    strokeDasharray = '6,4';
    strokeColor = isSelected ? '#10b981' : (isLight ? '#475569' : '#94a3b8');
    strokeWidth = isSelected ? 2.5 : 1.8;
  }

  const badgeFill = isLight ? '#ffffff' : '#090d16';
  const badgeStroke = isSelected ? '#10b981' : (isLight ? '#cbd5e1' : '#334155');
  const badgeText = isLight ? '#0f172a' : '#e2e8f0';

  // Cálculo de rama punteada hacia clase intermedia (Clase de Asociación) si existe
  let intermediateBranchData: { junctionPoint: { x: number; y: number }; branchPath: string } | null = null;
  if (intermediateClass) {
    const intermRect: Rect = {
      x: intermediateClass.position.x,
      y: intermediateClass.position.y,
      width: intermediateClass.dimensions?.width || 210,
      height: intermediateClass.dimensions?.height || 160,
    };
    intermediateBranchData = calculateIntermediateBranch(sourceRect, targetRect, intermRect, isSelfLoop);
  }

  return (
    <g
      className="cursor-pointer group pointer-events-auto"
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(relationship);
      }}
    >
      {/* Línea invisible más ancha para facilitar el clic */}
      <path d={path} fill="none" stroke="transparent" strokeWidth="16" />

      {/* Trazo visible ortogonal principal */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        className="transition-colors group-hover:stroke-emerald-400"
      />

      {/* 1. Composición: Rombo Relleno Sólido UML Directo (100% visible, sin fallas de marker) */}
      {isComposition && (
        <g transform={`translate(${sourceAnchor.x}, ${sourceAnchor.y}) rotate(${sourceAngle})`}>
          <polygon
            points="0,0 10,-6 20,0 10,6"
            fill={isSelected ? '#10b981' : (isLight ? '#0f172a' : '#f8fafc')}
            stroke={isSelected ? '#10b981' : (isLight ? '#0f172a' : '#f8fafc')}
            strokeWidth={1.5}
            strokeLinejoin="round"
            className="transition-colors group-hover:fill-emerald-400 group-hover:stroke-emerald-400"
          />
        </g>
      )}

      {/* 2. Agregación: Rombo Hueco UML Directo */}
      {isAggregation && (
        <g transform={`translate(${sourceAnchor.x}, ${sourceAnchor.y}) rotate(${sourceAngle})`}>
          <polygon
            points="0,0 10,-6 20,0 10,6"
            fill={isLight ? '#ffffff' : '#0f172a'}
            stroke={isSelected ? '#10b981' : (isLight ? '#d97706' : '#fbbf24')}
            strokeWidth={2}
            strokeLinejoin="round"
            className="transition-colors group-hover:stroke-emerald-400"
          />
        </g>
      )}

      {/* 3. Generalización / Herencia: Triángulo Hueco Cerrado UML Directo */}
      {isGeneralization && (
        <g transform={`translate(${targetAnchor.x}, ${targetAnchor.y}) rotate(${targetAngle})`}>
          <polygon
            points="0,0 -16,-8 -16,8"
            fill={isLight ? '#ffffff' : '#0f172a'}
            stroke={isSelected ? '#10b981' : (isLight ? '#0284c7' : '#38bdf8')}
            strokeWidth={2}
            strokeLinejoin="round"
            className="transition-colors group-hover:stroke-emerald-400"
          />
        </g>
      )}

      {/* 4. Dependencia: Flecha Abierta UML Directa */}
      {isDependency && (
        <g transform={`translate(${targetAnchor.x}, ${targetAnchor.y}) rotate(${targetAngle})`}>
          <path
            d="M -12 -7 L 0 0 L -12 7"
            fill="none"
            stroke={isSelected ? '#10b981' : (isLight ? '#475569' : '#94a3b8')}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-colors group-hover:stroke-emerald-400"
          />
        </g>
      )}

      {/* Trazo secundario punteado hacia la Clase Intermedia (Clase de Asociación) */}
      {intermediateBranchData && (
        <g className="intermediate-branch group-hover:opacity-100">
          {/* Línea invisible de clic para la derivación */}
          <path
            d={intermediateBranchData.branchPath}
            fill="none"
            stroke="transparent"
            strokeWidth="14"
          />
          {/* Nodo central de unión en la línea principal */}
          <circle
            cx={intermediateBranchData.junctionPoint.x}
            cy={intermediateBranchData.junctionPoint.y}
            r={3.5}
            fill={strokeColor}
            className="transition-colors group-hover:fill-emerald-400"
          />
          {/* Trazo discontinuo hacia la cabecera de la clase intermedia */}
          <path
            d={intermediateBranchData.branchPath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={isSelected ? 2.2 : 1.8}
            strokeDasharray="5,4"
            className="transition-colors group-hover:stroke-emerald-400"
          />
        </g>
      )}

      {/* Multiplicidad Origen */}
      {Boolean(relationship.sourceMultiplicity && relationship.sourceMultiplicity.trim()) && (
        <g transform={`translate(${sourceLabelPos.x}, ${sourceLabelPos.y})`}>
          <rect
            x={-19}
            y={-12}
            width={38}
            height={22}
            rx={5}
            fill={badgeFill}
            stroke={badgeStroke}
            strokeWidth={1.2}
          />
          <text
            x={0}
            y={2}
            fill={badgeText}
            fontSize="12"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
            alignmentBaseline="middle"
            className="select-none pointer-events-none"
          >
            {relationship.sourceMultiplicity}
          </text>
        </g>
      )}

      {/* Multiplicidad Destino */}
      {Boolean(relationship.targetMultiplicity && relationship.targetMultiplicity.trim()) && (
        <g transform={`translate(${targetLabelPos.x}, ${targetLabelPos.y})`}>
          <rect
            x={-19}
            y={-12}
            width={38}
            height={22}
            rx={5}
            fill={badgeFill}
            stroke={badgeStroke}
            strokeWidth={1.2}
          />
          <text
            x={0}
            y={2}
            fill={badgeText}
            fontSize="12"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
            alignmentBaseline="middle"
            className="select-none pointer-events-none"
          >
            {relationship.targetMultiplicity}
          </text>
        </g>
      )}

      {/* Nombre de la Relación (solo si no se superpone o si tiene nombre explícito) */}
      {Boolean(relationship.name && relationship.name.trim()) && (
        <g transform={`translate(${centerLabelPos.x}, ${intermediateBranchData ? centerLabelPos.y - 14 : centerLabelPos.y})`}>
          <rect
            x={-35}
            y={-13}
            width={70}
            height={22}
            rx={5}
            fill={badgeFill}
            stroke={badgeStroke}
            strokeWidth={1.2}
          />
          <text
            x={0}
            y={1}
            fill={badgeText}
            fontSize="12"
            fontWeight="600"
            textAnchor="middle"
            alignmentBaseline="middle"
            className="select-none font-mono pointer-events-none"
          >
            {relationship.name}
          </text>
        </g>
      )}
    </g>
  );
};
