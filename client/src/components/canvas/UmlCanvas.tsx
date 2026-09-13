import React, { useRef, useState, useCallback, useEffect } from 'react';
import { UmlClass, UmlRelationship, CanvasTransform } from '../../types/uml';
import { UmlMarkers } from './UmlMarkers';
import { UmlClassNode, NodeLockVisual } from './UmlClassNode';
import { UmlRelationshipConnector } from './UmlRelationshipConnector';

export interface RemoteCursorVisual {
  x: number;
  y: number;
  userName: string;
  color: string;
}

interface UmlCanvasProps {
  classes: UmlClass[];
  relationships: UmlRelationship[];
  selectedClassId: string | null;
  selectedClassIds?: string[];
  selectedRelationshipId: string | null;
  gridSnap?: number;
  theme?: 'dark' | 'light';
  activeLocks?: Record<string, NodeLockVisual>;
  currentUserId?: string;
  currentUserName?: string;
  remoteCursors?: Record<string, RemoteCursorVisual>;
  onSelectClass: (cls: UmlClass | null, isMulti?: boolean) => void;
  onSelectRelationship: (rel: UmlRelationship | null) => void;
  onClearSelection?: () => void;
  onMoveClass: (classId: string, pos: { x: number; y: number }) => void;
  onMoveClassEnd: (classId: string, pos: { x: number; y: number }) => void;
  onMoveMultipleClasses?: (positions: Record<string, { x: number; y: number }>) => void;
  onMoveMultipleClassesEnd?: (positions: Record<string, { x: number; y: number }>) => void;
  onResizeClass?: (classId: string, dimensions: { width: number; height: number }) => void;
  onResizeClassEnd?: (classId: string, dimensions: { width: number; height: number }) => void;
  connectingSourceId: string | null;
  onCompleteConnection?: (targetId: string) => void;
  onCursorMove?: (pos: { x: number; y: number }) => void;
  onDeleteClass?: (classId: string) => void;
  onStartConnection?: (sourceId: string) => void;
}

export const UmlCanvas: React.FC<UmlCanvasProps> = ({
  classes,
  relationships,
  selectedClassId,
  selectedClassIds = [],
  selectedRelationshipId,
  gridSnap = 20,
  theme = 'dark',
  activeLocks = {},
  currentUserId,
  currentUserName,
  remoteCursors = {},
  onSelectClass,
  onSelectRelationship,
  onClearSelection,
  onMoveClass,
  onMoveClassEnd,
  onMoveMultipleClasses,
  onMoveMultipleClassesEnd,
  onResizeClass,
  onResizeClassEnd,
  connectingSourceId,
  onCompleteConnection,
  onCursorMove,
  onDeleteClass,
  onStartConnection,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<CanvasTransform>({ x: 80, y: 80, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number } | null>(null);

  // Manejo de Zoom con rueda del ratón (centrado en el cursor)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    setTransform((prev) => {
      const newZoom = Math.min(Math.max(0.2, prev.zoom * zoomFactor), 3.0);
      const newX = cursorX - (cursorX - prev.x) * (newZoom / prev.zoom);
      const newY = cursorY - (cursorY - prev.y) * (newZoom / prev.zoom);
      return { x: newX, y: newY, zoom: newZoom };
    });
  }, []);

  // Manejo de Paneo (arrastre del fondo del lienzo con clic izquierdo o botón del medio)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Evitar paneo si se hace clic sobre un nodo de clase, botón, input u otro control interactivo
    const target = e.target as HTMLElement;
    const isInteractive = Boolean(
      target.closest('.uml-class-node') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea')
    );

    if (isInteractive) return;

    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      panStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        initialX: transform.x,
        initialY: transform.y,
      };

      // Si se hace clic directamente en el fondo sin teclas de selección múltiple, deseleccionar
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        onSelectClass(null);
        onSelectRelationship(null);
        if (onClearSelection) onClearSelection();
      }
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current && onCursorMove) {
        const rect = containerRef.current.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - transform.x) / transform.zoom;
        const worldY = (e.clientY - rect.top - transform.y) / transform.zoom;
        onCursorMove({ x: worldX, y: worldY });
      }

      if (!isPanning || !panStartRef.current) return;
      const start = panStartRef.current;
      if (!start) return;

      const dx = e.clientX - start.mouseX;
      const dy = e.clientY - start.mouseY;
      const nextX = start.initialX + dx;
      const nextY = start.initialY + dy;

      setTransform((prev) => ({
        ...prev,
        x: nextX,
        y: nextY,
      }));
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, onCursorMove, transform]);

  // Mapa rápido de clases para calcular conectores
  const classMap = new Map<string, UmlClass>();
  classes.forEach((c) => {
    classMap.set(c.id, c);
    if (c.dbId) classMap.set(String(c.dbId), c);
  });

  const isLight = theme === 'light';

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      className={`canvas-container relative w-full h-full overflow-hidden select-none transition-colors duration-150 ${
        isLight ? 'bg-slate-100' : 'bg-slate-950'
      } ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
    >
      {/* 1. Fondo Rejilla Dinámica (Grid) */}
      <div
        className="canvas-bg absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: isLight
            ? `radial-gradient(circle, rgba(100, 116, 139, 0.22) 1.2px, transparent 1.2px)`
            : `radial-gradient(circle, rgba(148, 163, 184, 0.18) 1.2px, transparent 1.2px)`,
          backgroundSize: `${gridSnap * transform.zoom}px ${gridSnap * transform.zoom}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
      />

      {/* Indicador de modo de conexión de relaciones */}
      {connectingSourceId && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600/95 text-white px-4 py-2 rounded-full text-xs font-semibold shadow-lg backdrop-blur-sm animate-pulse flex items-center gap-2">
          <span>Modo Conexión: Haga clic en la clase destino para trazar la relación</span>
        </div>
      )}

      {/* 2. Capa Transformada (Zoom + Paneo Infinito) */}
      <div
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        {/* Capa SVG para conectores y relaciones ortogonales en espacio infinito */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
          <UmlMarkers />

          {relationships.map((rel) => {
            const sourceClass = classMap.get(rel.sourceClassId);
            const targetClass = classMap.get(rel.targetClassId);
            const intermId = rel.intermediateClassId || rel.intermediateTableId;
            const intermediateClass = intermId ? classMap.get(intermId) : undefined;

            if (!sourceClass || !targetClass) return null;

            return (
              <UmlRelationshipConnector
                key={rel.id}
                relationship={rel}
                sourceClass={sourceClass}
                targetClass={targetClass}
                intermediateClass={intermediateClass}
                isSelected={rel.id === selectedRelationshipId}
                theme={theme}
                onSelect={(r) => {
                  onSelectRelationship(r);
                  onSelectClass(null);
                }}
              />
            );
          })}
        </svg>

        {/* Capa de Nodos de Clase UML */}
        {classes.map((cls) => {
          const classKey = cls.dbId ? String(cls.dbId) : cls.id;
          const nodeLock = activeLocks[classKey] || activeLocks[cls.id] || null;
          const isLockedByMe = Boolean(
            nodeLock && (
              (currentUserId && (nodeLock.userId === currentUserId || String(nodeLock.userId) === String(currentUserId))) ||
              (currentUserName && nodeLock.userName === currentUserName)
            )
          );

          const isNodeSelected = cls.id === selectedClassId || selectedClassIds.includes(cls.id);

          return (
            <UmlClassNode
              key={cls.id}
              umlClass={cls}
              allClasses={classes}
              isSelected={isNodeSelected}
              selectedClassIds={selectedClassIds}
              gridSnap={gridSnap}
              zoom={transform.zoom}
              theme={theme}
              activeLock={nodeLock}
              isLockedByMe={isLockedByMe}
              onSelect={(selected, isMulti) => {
                if (connectingSourceId && onCompleteConnection) {
                  onCompleteConnection(selected.id);
                } else {
                  onSelectClass(selected, isMulti);
                  onSelectRelationship(null);
                }
              }}
              onMove={onMoveClass}
              onMoveEnd={onMoveClassEnd}
              onMoveMultiple={onMoveMultipleClasses}
              onMoveMultipleEnd={onMoveMultipleClassesEnd}
              onResize={onResizeClass}
              onResizeEnd={onResizeClassEnd}
              onDelete={onDeleteClass}
              onStartConnect={onStartConnection}
            />
          );
        })}

        {/* Capa de Cursores Remotos Colaborativos */}
        {Object.entries(remoteCursors).map(([uid, c]) => (
          <div
            key={uid}
            className="absolute pointer-events-none z-50 flex items-center gap-1 transition-all duration-75"
            style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
          >
            <svg className="w-4 h-4 drop-shadow-md" viewBox="0 0 24 24" fill={c.color || '#38bdf8'}>
              <polygon points="0,0 18,7 10,10 7,18" />
            </svg>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded shadow text-white font-sans truncate max-w-[140px]"
              style={{ backgroundColor: c.color || '#38bdf8' }}
            >
              {c.userName}
            </span>
          </div>
        ))}
      </div>

      {/* Mini indicador de zoom */}
      <div className={`absolute bottom-4 right-4 backdrop-blur-md border px-3 py-1.5 rounded-md text-xs font-mono flex items-center gap-3 pointer-events-none select-none transition-colors ${
        isLight
          ? 'bg-white/90 border-slate-300 text-slate-700 shadow-sm'
          : 'bg-slate-900/80 border-slate-800 text-slate-400'
      }`}>
        <span>Zoom: {Math.round(transform.zoom * 100)}%</span>
        {selectedClassIds.length > 1 && (
          <span className="text-emerald-500 font-bold font-sans">
            {selectedClassIds.length} seleccionadas
          </span>
        )}
      </div>
    </div>
  );
};
