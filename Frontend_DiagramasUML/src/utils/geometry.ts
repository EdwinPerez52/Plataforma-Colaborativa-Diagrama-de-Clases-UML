export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface OrthogonalPathResult {
  path: string;
  sourceAnchor: Point;
  targetAnchor: Point;
  sourceLabelPos: Point;
  targetLabelPos: Point;
  centerLabelPos: Point;
  sourceAngle: number;
  targetAngle: number;
}

/**
 * Calcula el punto de anclaje más cercano en el borde de un rectángulo hacia otro punto/rectángulo
 */
export function getRectAnchor(rect: Rect, targetCenter: Point): Point {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = targetCenter.x - cx;
  const dy = targetCenter.y - cy;

  // Evaluar si la salida es más horizontal o vertical
  if (Math.abs(dx) * (rect.height / 2) > Math.abs(dy) * (rect.width / 2)) {
    // Salida por borde izquierdo o derecho
    return {
      x: dx > 0 ? rect.x + rect.width : rect.x,
      y: cy,
    };
  } else {
    // Salida por borde superior o inferior
    return {
      x: cx,
      y: dy > 0 ? rect.y + rect.height : rect.y,
    };
  }
}

/**
 * Traza un camino ortogonal (a 90 grados) entre dos entidades rectangulares UML,
 * o un lazo rectangular externo si se trata de una auto-relación / recursividad.
 */
export function calculateOrthogonalPath(
  source: Rect,
  target: Rect,
  isSelfLoop = false
): OrthogonalPathResult {
  // Manejo de clase recursiva (auto-asociación a sí misma)
  if (isSelfLoop || (source.x === target.x && source.y === target.y && source.width === target.width && source.height === target.height)) {
    const exitX = source.x + source.width;
    const exitY = source.y + 35;
    const loopRight = source.x + source.width + 45;
    const loopTop = source.y - 30;
    const entryX = source.x + source.width - 35;
    const entryY = source.y;

    const sAnchor: Point = { x: exitX, y: exitY };
    const tAnchor: Point = { x: entryX, y: entryY };

    const pathD = `M ${sAnchor.x} ${sAnchor.y} L ${loopRight} ${exitY} L ${loopRight} ${loopTop} L ${entryX} ${loopTop} L ${tAnchor.x} ${tAnchor.y}`;

    return {
      path: pathD,
      sourceAnchor: sAnchor,
      targetAnchor: tAnchor,
      sourceLabelPos: { x: loopRight + 12, y: exitY + 12 },
      targetLabelPos: { x: entryX - 22, y: loopTop - 12 },
      centerLabelPos: { x: (loopRight + entryX) / 2 + 10, y: loopTop - 14 },
      sourceAngle: 0,
      targetAngle: 90,
    };
  }

  const sCenter: Point = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const tCenter: Point = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

  const sAnchor = getRectAnchor(source, tCenter);
  const tAnchor = getRectAnchor(target, sCenter);

  let pathPoints: Point[] = [];

  const isSourceHorizontal = sAnchor.y === sCenter.y;
  const isTargetHorizontal = tAnchor.y === tCenter.y;

  if (isSourceHorizontal && isTargetHorizontal) {
    // Ambos salen por los costados: doblar a la mitad en X
    const midX = (sAnchor.x + tAnchor.x) / 2;
    pathPoints = [
      sAnchor,
      { x: midX, y: sAnchor.y },
      { x: midX, y: tAnchor.y },
      tAnchor,
    ];
  } else if (!isSourceHorizontal && !isTargetHorizontal) {
    // Ambos salen por arriba/abajo: doblar a la mitad en Y
    const midY = (sAnchor.y + tAnchor.y) / 2;
    pathPoints = [
      sAnchor,
      { x: sAnchor.x, y: midY },
      { x: tAnchor.x, y: midY },
      tAnchor,
    ];
  } else if (isSourceHorizontal && !isTargetHorizontal) {
    // Origen horizontal, destino vertical: un codo
    pathPoints = [
      sAnchor,
      { x: tAnchor.x, y: sAnchor.y },
      tAnchor,
    ];
  } else {
    // Origen vertical, destino horizontal: un codo
    pathPoints = [
      sAnchor,
      { x: sAnchor.x, y: tAnchor.y },
      tAnchor,
    ];
  }

  // Generar string SVG 'd'
  const pathD = pathPoints
    .map((pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`))
    .join(' ');

  // Posición para etiqueta de multiplicidad origen (cerca del ancla inicial)
  const sourceLabelPos: Point = {
    x: sAnchor.x + (sAnchor.x < sCenter.x ? -24 : sAnchor.x > sCenter.x ? 14 : 10),
    y: sAnchor.y + (sAnchor.y < sCenter.y ? -16 : sAnchor.y > sCenter.y ? 20 : -10),
  };

  // Posición para etiqueta de multiplicidad destino (cerca del ancla final)
  const targetLabelPos: Point = {
    x: tAnchor.x + (tAnchor.x < tCenter.x ? -24 : tAnchor.x > tCenter.x ? 14 : 10),
    y: tAnchor.y + (tAnchor.y < tCenter.y ? -16 : tAnchor.y > tCenter.y ? 20 : -10),
  };

  // Posición para etiqueta central (nombre de relación)
  const centerIdx = Math.floor(pathPoints.length / 2);
  const p1 = pathPoints[centerIdx - 1];
  const p2 = pathPoints[centerIdx];
  const centerLabelPos: Point = {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2 - 10,
  };

  const pStart0 = pathPoints[0];
  const pStart1 = pathPoints[1];
  const sourceAngle = Math.round(Math.atan2(pStart1.y - pStart0.y, pStart1.x - pStart0.x) * (180 / Math.PI));

  const pEndN1 = pathPoints[pathPoints.length - 2];
  const pEndN = pathPoints[pathPoints.length - 1];
  const targetAngle = Math.round(Math.atan2(pEndN.y - pEndN1.y, pEndN.x - pEndN1.x) * (180 / Math.PI));

  return {
    path: pathD,
    sourceAnchor: sAnchor,
    targetAnchor: tAnchor,
    sourceLabelPos,
    targetLabelPos,
    centerLabelPos,
    sourceAngle,
    targetAngle,
  };
}

/**
 * Calcula la conexión punteada de derivación hacia una clase intermedia (Clase de Asociación UML)
 */
export function calculateIntermediateBranch(
  source: Rect,
  target: Rect,
  intermediate: Rect,
  isSelfLoop = false
): { junctionPoint: Point; intermAnchor: Point; branchPath: string } {
  const ortho = calculateOrthogonalPath(source, target, isSelfLoop);
  
  // Punto de unión en la línea principal de la relación
  const junctionPoint: Point = {
    x: ortho.centerLabelPos.x,
    y: ortho.centerLabelPos.y + 10,
  };

  // Punto de anclaje más conveniente en la clase intermedia
  const intermAnchor = getRectAnchor(intermediate, junctionPoint);

  const branchPath = `M ${junctionPoint.x} ${junctionPoint.y} L ${intermAnchor.x} ${intermAnchor.y}`;

  return {
    junctionPoint,
    intermAnchor,
    branchPath,
  };
}

