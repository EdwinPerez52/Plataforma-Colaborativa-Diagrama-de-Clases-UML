import { UmlClass, UmlRelationship } from '../types/uml';
import { calculateOrthogonalPath, calculateIntermediateBranch, Rect } from './geometry';
import { jsPDF } from 'jspdf';

interface ExportOptions {
  theme?: 'dark' | 'light';
  backgroundColor?: string;
}

/**
 * Escapa caracteres especiales para texto SVG XML
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Genera el documento SVG completo, autónomo e independiente para exportación
 */
export function generateStandaloneSvg(
  classes: UmlClass[],
  relationships: UmlRelationship[],
  diagramName = 'Diagrama',
  options: ExportOptions = {}
): string {
  const isLight = options.theme !== 'dark';
  const bgColor = options.backgroundColor || (isLight ? '#ffffff' : '#090d16');
  const textColor = isLight ? '#0f172a' : '#f8fafc';
  const textMuted = isLight ? '#64748b' : '#94a3b8';
  const cardBorder = isLight ? '#cbd5e1' : '#334155';
  const cardBg = isLight ? '#ffffff' : '#0f172a';
  const headerBg = isLight ? '#f8fafc' : '#1e293b';

  // Si no hay clases, generar lienzo vacío de 800x600 con mensaje
  if (classes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <rect width="800" height="600" fill="${bgColor}" />
      <text x="400" y="300" fill="${textMuted}" font-family="sans-serif" font-size="16" text-anchor="middle">
        Lienzo vacío (${escapeXml(diagramName)})
      </text>
    </svg>`;
  }

  // 1. Calcular caja envolvente (Bounding Box) de todos los elementos con margen
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  classes.forEach((c) => {
    const w = c.dimensions?.width || 210;
    const h = c.dimensions?.height || 160;
    minX = Math.min(minX, c.position.x);
    minY = Math.min(minY, c.position.y);
    maxX = Math.max(maxX, c.position.x + w);
    maxY = Math.max(maxY, c.position.y + h);
  });

  const padding = 70;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  const totalWidth = Math.max(600, maxX - minX);
  const totalHeight = Math.max(450, maxY - minY);

  // Mapa rápido de clases para búsqueda de relaciones
  const classMap = new Map<string, UmlClass>();
  classes.forEach((c) => {
    classMap.set(c.id, c);
    if (c.dbId) classMap.set(String(c.dbId), c);
  });

  // 2. Trazado SVG de Relaciones
  const relsSvg = relationships
    .map((rel) => {
      const sourceClass = classMap.get(rel.sourceClassId);
      const targetClass = classMap.get(rel.targetClassId);
      if (!sourceClass || !targetClass) return '';

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

      const isSelfLoop = rel.sourceClassId === rel.targetClassId;
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

      const rawType = (rel.type || '').toLowerCase();
      const isComposition = rawType === 'composition' || rawType === 'composicion';
      const isAggregation = rawType === 'aggregation' || rawType === 'agregacion';
      const isGeneralization =
        rawType === 'generalization' ||
        rawType === 'generalizacion' ||
        rawType === 'inheritance' ||
        rawType === 'herencia';
      const isDependency = rawType === 'dependency' || rawType === 'dependencia';

      let strokeColor = isLight ? '#0f172a' : '#f8fafc';
      let strokeWidth = '2';
      let strokeDash = '';

      if (isGeneralization) {
        strokeColor = isLight ? '#0284c7' : '#38bdf8';
      } else if (isAggregation) {
        strokeColor = isLight ? '#d97706' : '#fbbf24';
      } else if (isComposition) {
        strokeColor = isLight ? '#0f172a' : '#f8fafc';
        strokeWidth = '2.4';
      } else if (isDependency) {
        strokeColor = isLight ? '#475569' : '#94a3b8';
        strokeDash = 'stroke-dasharray="6,4"';
      }

      // Cabezas de relación
      let headSvg = '';
      if (isComposition) {
        headSvg = `<g transform="translate(${sourceAnchor.x}, ${sourceAnchor.y}) rotate(${sourceAngle})">
          <polygon points="0,0 10,-6 20,0 10,6" fill="${strokeColor}" stroke="${strokeColor}" stroke-width="1.5" stroke-linejoin="round" />
        </g>`;
      } else if (isAggregation) {
        headSvg = `<g transform="translate(${sourceAnchor.x}, ${sourceAnchor.y}) rotate(${sourceAngle})">
          <polygon points="0,0 10,-6 20,0 10,6" fill="${bgColor}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round" />
        </g>`;
      } else if (isGeneralization) {
        headSvg = `<g transform="translate(${targetAnchor.x}, ${targetAnchor.y}) rotate(${targetAngle})">
          <polygon points="0,0 -16,-8 -16,8" fill="${bgColor}" stroke="${strokeColor}" stroke-width="2" stroke-linejoin="round" />
        </g>`;
      } else if (isDependency) {
        headSvg = `<g transform="translate(${targetAnchor.x}, ${targetAnchor.y}) rotate(${targetAngle})">
          <path d="M -12 -7 L 0 0 L -12 7" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </g>`;
      }

      // Rama de Clase Intermedia
      let intermediateSvg = '';
      const intermId = rel.intermediateClassId || rel.intermediateTableId;
      const intermClass = intermId ? classMap.get(intermId) : null;
      if (intermClass) {
        const intermRect: Rect = {
          x: intermClass.position.x,
          y: intermClass.position.y,
          width: intermClass.dimensions?.width || 210,
          height: intermClass.dimensions?.height || 160,
        };
        const branch = calculateIntermediateBranch(sourceRect, targetRect, intermRect, isSelfLoop);
        intermediateSvg = `
          <circle cx="${branch.junctionPoint.x}" cy="${branch.junctionPoint.y}" r="3.5" fill="${strokeColor}" />
          <path d="${branch.branchPath}" fill="none" stroke="${strokeColor}" stroke-width="1.8" stroke-dasharray="5,4" />
        `;
      }

      // Badges de Multiplicidad
      const badgeBg = isLight ? '#ffffff' : '#090d16';
      const badgeBorder = isLight ? '#cbd5e1' : '#334155';
      const badgeTxt = isLight ? '#0f172a' : '#e2e8f0';

      let sourceMultSvg = '';
      if (rel.sourceMultiplicity && rel.sourceMultiplicity.trim()) {
        sourceMultSvg = `
          <g transform="translate(${sourceLabelPos.x}, ${sourceLabelPos.y})">
            <rect x="-16" y="-10" width="32" height="18" rx="4" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1" />
            <text x="0" y="2" fill="${badgeTxt}" font-size="10" font-weight="bold" font-family="monospace" text-anchor="middle" dominant-baseline="middle">${escapeXml(rel.sourceMultiplicity)}</text>
          </g>`;
      }

      let targetMultSvg = '';
      if (rel.targetMultiplicity && rel.targetMultiplicity.trim()) {
        targetMultSvg = `
          <g transform="translate(${targetLabelPos.x}, ${targetLabelPos.y})">
            <rect x="-16" y="-10" width="32" height="18" rx="4" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1" />
            <text x="0" y="2" fill="${badgeTxt}" font-size="10" font-weight="bold" font-family="monospace" text-anchor="middle" dominant-baseline="middle">${escapeXml(rel.targetMultiplicity)}</text>
          </g>`;
      }

      let nameSvg = '';
      if (rel.name && rel.name.trim()) {
        const textW = Math.max(60, rel.name.length * 8 + 16);
        nameSvg = `
          <g transform="translate(${centerLabelPos.x}, ${centerLabelPos.y - 12})">
            <rect x="${-textW / 2}" y="-10" width="${textW}" height="18" rx="4" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1" />
            <text x="0" y="2" fill="${badgeTxt}" font-size="10" font-family="monospace" text-anchor="middle" dominant-baseline="middle">${escapeXml(rel.name)}</text>
          </g>`;
      }

      return `
        <g class="uml-relationship">
          <path d="${path}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" ${strokeDash} />
          ${headSvg}
          ${intermediateSvg}
          ${sourceMultSvg}
          ${targetMultSvg}
          ${nameSvg}
        </g>
      `;
    })
    .join('\n');

  // 3. Trazado SVG de Nodos de Clase
  const classesSvg = classes
    .map((cls) => {
      const x = cls.position.x;
      const y = cls.position.y;
      const w = cls.dimensions?.width || 210;
      const h = cls.dimensions?.height || 160;
      const headerHeight = cls.stereotype ? 48 : 38;

      const attrCount = cls.attributes.length;
      const methodCount = cls.methods.length;

      let currentY = y + headerHeight;

      // Renderizar Atributos
      const attrsSvg = cls.attributes
        .slice(0, 8)
        .map((a) => {
          const lineY = currentY + 14;
          currentY += 18;
          const pkSymbol = a.isPk ? '🔑 ' : '';
          const lineText = `${pkSymbol}${a.visibility} ${a.name}: ${a.type}`;
          return `<text x="${x + 10}" y="${lineY}" fill="${textColor}" font-size="11" font-family="monospace">${escapeXml(lineText)}</text>`;
        })
        .join('\n');

      const attrCompartmentHeight = Math.max(26, attrCount * 18 + 6);
      const attrDividerY = y + headerHeight + attrCompartmentHeight;

      // Renderizar Métodos
      let methodY = attrDividerY;
      const methodsSvg = cls.methods
        .slice(0, 6)
        .map((m) => {
          const lineY = methodY + 14;
          methodY += 18;
          const lineText = `${m.visibility} ${m.name}(): ${m.returnType}`;
          return `<text x="${x + 10}" y="${lineY}" fill="${textColor}" font-size="11" font-family="monospace">${escapeXml(lineText)}</text>`;
        })
        .join('\n');

      const isInterm = cls.stereotype === 'association_class' || cls.stereotype === 'intermediate_table';
      const borderStroke = isInterm ? (isLight ? '#059669' : '#10b981') : cardBorder;
      const strokeW = isInterm ? '2' : '1.5';

      return `
        <g class="uml-class-node" transform="translate(0, 0)">
          <!-- Sombra suave -->
          <rect x="${x + 3}" y="${y + 3}" width="${w}" height="${h}" rx="6" fill="rgba(0,0,0,0.08)" />
          
          <!-- Fondo de la tarjeta -->
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${cardBg}" stroke="${borderStroke}" stroke-width="${strokeW}" />

          <!-- Cabecera -->
          <path d="M ${x + 6} ${y} L ${x + w - 6} ${y} Q ${x + w} ${y} ${x + w} ${y + 6} L ${x + w} ${y + headerHeight} L ${x} ${y + headerHeight} L ${x} ${y + 6} Q ${x} ${y} ${x + 6} ${y} Z" fill="${headerBg}" />

          ${cls.stereotype ? `<text x="${x + w / 2}" y="${y + 16}" fill="${textMuted}" font-size="10" font-family="sans-serif" font-style="italic" text-anchor="middle">«${escapeXml(cls.stereotype)}»</text>` : ''}
          <text x="${x + w / 2}" y="${y + (cls.stereotype ? 34 : 24)}" fill="${textColor}" font-size="13" font-weight="bold" font-family="sans-serif" text-anchor="middle">${escapeXml(cls.name)}</text>

          <!-- Divisor de Atributos -->
          <line x1="${x}" y1="${y + headerHeight}" x2="${x + w}" y2="${y + headerHeight}" stroke="${cardBorder}" stroke-width="1" />
          ${attrsSvg}

          <!-- Divisor de Métodos -->
          <line x1="${x}" y1="${attrDividerY}" x2="${x + w}" y2="${attrDividerY}" stroke="${cardBorder}" stroke-width="1" />
          ${methodsSvg}
        </g>
      `;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
  </style>
  <rect x="${minX}" y="${minY}" width="${totalWidth}" height="${totalHeight}" fill="${bgColor}" />
  ${relsSvg}
  ${classesSvg}
</svg>`;
}

/**
 * Descarga directamente un archivo en el navegador
 */
function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1. Exportar a SVG
 */
export function exportToSvg(
  classes: UmlClass[],
  relationships: UmlRelationship[],
  diagramName = 'diagrama-uml',
  options: ExportOptions = {}
) {
  const svgContent = generateStandaloneSvg(classes, relationships, diagramName, options);
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  downloadFile(blob, `${diagramName.toLowerCase().replace(/\s+/g, '-')}.svg`);
}

/**
 * Helper interno: convierte el SVG a un elemento HTML5 Canvas con escalado Retina (2x)
 */
function renderSvgToCanvas(
  svgContent: string,
  scale = 2,
  fillWhiteBg = true
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElem = doc.documentElement;

    const width = parseFloat(svgElem.getAttribute('width') || '800');
    const height = parseFloat(svgElem.getAttribute('height') || '600');

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('No se pudo inicializar el contexto 2D del canvas'));
      return;
    }

    if (fillWhiteBg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ canvas, width, height });
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * 2. Exportar a PNG (Resolución nítida 2x)
 */
export async function exportToPng(
  classes: UmlClass[],
  relationships: UmlRelationship[],
  diagramName = 'diagrama-uml',
  options: ExportOptions = {}
) {
  const svgContent = generateStandaloneSvg(classes, relationships, diagramName, {
    ...options,
    backgroundColor: '#ffffff',
  });
  const { canvas } = await renderSvgToCanvas(svgContent, 2, true);

  canvas.toBlob((blob) => {
    if (blob) {
      downloadFile(blob, `${diagramName.toLowerCase().replace(/\s+/g, '-')}.png`);
    }
  }, 'image/png');
}

/**
 * 3. Exportar a JPEG (Alta calidad con compresión 0.95)
 */
export async function exportToJpeg(
  classes: UmlClass[],
  relationships: UmlRelationship[],
  diagramName = 'diagrama-uml',
  options: ExportOptions = {}
) {
  const svgContent = generateStandaloneSvg(classes, relationships, diagramName, {
    ...options,
    backgroundColor: '#ffffff',
  });
  const { canvas } = await renderSvgToCanvas(svgContent, 2, true);

  canvas.toBlob(
    (blob) => {
      if (blob) {
        downloadFile(blob, `${diagramName.toLowerCase().replace(/\s+/g, '-')}.jpeg`);
      }
    },
    'image/jpeg',
    0.95
  );
}

/**
 * 4. Exportar a PDF (Documento centrado A4 horizontal / vertical vía jsPDF)
 */
export async function exportToPdf(
  classes: UmlClass[],
  relationships: UmlRelationship[],
  diagramName = 'diagrama-uml',
  options: ExportOptions = {}
) {
  const svgContent = generateStandaloneSvg(classes, relationships, diagramName, {
    ...options,
    backgroundColor: '#ffffff',
  });
  const { canvas, width, height } = await renderSvgToCanvas(svgContent, 2, true);
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const isLandscape = width >= height;
  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = 10;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2 - 12; // espacio para título y fecha

  const ratio = Math.min(maxWidth / width, maxHeight / height);
  const printW = width * ratio;
  const printH = height * ratio;
  const printX = (pageWidth - printW) / 2;
  const printY = margin + 8;

  // Cabecera formal del documento PDF
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(diagramName, margin, margin + 4);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Generado: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth - margin, margin + 4, { align: 'right' });

  // Imagen vectorial rasterizada de alta definición
  pdf.addImage(imgData, 'JPEG', printX, printY, printW, printH);

  pdf.save(`${diagramName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}
