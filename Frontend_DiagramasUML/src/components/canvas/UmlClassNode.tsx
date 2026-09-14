import React, { useState, useRef } from 'react';
import { UmlClass } from '../../types/uml';
import { Lock, Trash2, Link as LinkIcon } from 'lucide-react';

export interface NodeLockVisual {
  userId: string;
  userName: string;
  userCargo?: string;
  userColor?: string;
  expiraEn?: string;
}

interface UmlClassNodeProps {
  umlClass: UmlClass;
  allClasses?: UmlClass[];
  isSelected: boolean;
  selectedClassIds?: string[];
  gridSnap?: number;
  zoom: number;
  theme?: 'dark' | 'light';
  activeLock?: NodeLockVisual | null;
  isLockedByMe?: boolean;
  onSelect: (cls: UmlClass, isMulti?: boolean) => void;
  onMove: (classId: string, newPos: { x: number; y: number }) => void;
  onMoveEnd: (classId: string, newPos: { x: number; y: number }) => void;
  onMoveMultiple?: (positions: Record<string, { x: number; y: number }>) => void;
  onMoveMultipleEnd?: (positions: Record<string, { x: number; y: number }>) => void;
  onResize?: (classId: string, dimensions: { width: number; height: number }) => void;
  onResizeEnd?: (classId: string, dimensions: { width: number; height: number }) => void;
  onDelete?: (classId: string) => void;
  onStartConnect?: (classId: string) => void;
}

export const UmlClassNode: React.FC<UmlClassNodeProps> = ({
  umlClass,
  allClasses = [],
  isSelected,
  selectedClassIds = [],
  gridSnap = 20,
  zoom,
  theme = 'dark',
  activeLock,
  isLockedByMe,
  onSelect,
  onMove,
  onMoveEnd,
  onMoveMultiple,
  onMoveMultipleEnd,
  onResize,
  onResizeEnd,
  onDelete,
  onStartConnect,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    initialX: number;
    initialY: number;
    isMulti: boolean;
    multiInitialPositions?: Record<string, { x: number; y: number }>;
  } | null>(null);

  const isLockedByOther = Boolean(activeLock && !isLockedByMe);
  const isMultiSelected = selectedClassIds.length > 1 && selectedClassIds.includes(umlClass.id);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Si está bloqueado por otro usuario, impedir arrastre
    if (isLockedByOther) return;

    const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;
    onSelect(umlClass, isMultiKey);

    if (e.button !== 0) return; // Solo clic primario (izquierdo)

    setIsDragging(true);

    const isMovingGroup = (selectedClassIds.length > 1 && selectedClassIds.includes(umlClass.id)) ||
      (isMultiKey && selectedClassIds.length > 0);

    const multiPositions: Record<string, { x: number; y: number }> = {};
    if (isMovingGroup) {
      const activeIds = selectedClassIds.includes(umlClass.id)
        ? selectedClassIds
        : [...selectedClassIds, umlClass.id];

      activeIds.forEach((id) => {
        const target = allClasses.find((c) => c.id === id);
        if (target) {
          multiPositions[id] = { x: target.position.x, y: target.position.y };
        }
      });
    }

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: umlClass.position.x,
      initialY: umlClass.position.y,
      isMulti: isMovingGroup && Object.keys(multiPositions).length > 1,
      multiInitialPositions: multiPositions,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start) return;

      const dx = (moveEvent.clientX - start.mouseX) / zoom;
      const dy = (moveEvent.clientY - start.mouseY) / zoom;

      if (start.isMulti && start.multiInitialPositions && onMoveMultiple) {
        const updatedPositions: Record<string, { x: number; y: number }> = {};
        for (const [id, initPos] of Object.entries(start.multiInitialPositions)) {
          let rawX = initPos.x + dx;
          let rawY = initPos.y + dy;
          if (gridSnap > 1) {
            rawX = Math.round(rawX / gridSnap) * gridSnap;
            rawY = Math.round(rawY / gridSnap) * gridSnap;
          }
          updatedPositions[id] = { x: rawX, y: rawY };
        }
        onMoveMultiple(updatedPositions);
      } else {
        let rawX = start.initialX + dx;
        let rawY = start.initialY + dy;
        if (gridSnap > 1) {
          rawX = Math.round(rawX / gridSnap) * gridSnap;
          rawY = Math.round(rawY / gridSnap) * gridSnap;
        }
        onMove(umlClass.id, { x: rawX, y: rawY });
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      const start = dragStartRef.current;
      if (!start) return;

      const dx = (upEvent.clientX - start.mouseX) / zoom;
      const dy = (upEvent.clientY - start.mouseY) / zoom;

      if (start.isMulti && start.multiInitialPositions && onMoveMultipleEnd) {
        const finalPositions: Record<string, { x: number; y: number }> = {};
        for (const [id, initPos] of Object.entries(start.multiInitialPositions)) {
          let rawX = initPos.x + dx;
          let rawY = initPos.y + dy;
          if (gridSnap > 1) {
            rawX = Math.round(rawX / gridSnap) * gridSnap;
            rawY = Math.round(rawY / gridSnap) * gridSnap;
          }
          finalPositions[id] = { x: rawX, y: rawY };
        }
        onMoveMultipleEnd(finalPositions);
      } else {
        let finalX = start.initialX + dx;
        let finalY = start.initialY + dy;
        if (gridSnap > 1) {
          finalX = Math.round(finalX / gridSnap) * gridSnap;
          finalY = Math.round(finalY / gridSnap) * gridSnap;
        }
        onMoveEnd(umlClass.id, { x: finalX, y: finalY });
      }

      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Redimensionamiento interactivo con el cursor del ratón (esquinas y bordes)
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    initialWidth: number;
    initialHeight: number;
    direction: 'se' | 'e' | 's';
  } | null>(null);

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    direction: 'se' | 'e' | 's'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (isLockedByOther) return;

    setIsResizing(true);
    const initialWidth = umlClass.dimensions?.width || 210;
    const initialHeight = umlClass.dimensions?.height || 160;

    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialWidth,
      initialHeight,
      direction,
    };

    const handleResizeMouseMove = (moveEvent: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;

      const dx = (moveEvent.clientX - start.mouseX) / zoom;
      const dy = (moveEvent.clientY - start.mouseY) / zoom;

      let newWidth = start.initialWidth;
      let newHeight = start.initialHeight;

      if (start.direction === 'se' || start.direction === 'e') {
        newWidth = Math.max(160, Math.min(800, start.initialWidth + dx));
      }
      if (start.direction === 'se' || start.direction === 's') {
        newHeight = Math.max(90, Math.min(800, start.initialHeight + dy));
      }

      if (gridSnap > 1) {
        if (start.direction === 'se' || start.direction === 'e') {
          newWidth = Math.round(newWidth / gridSnap) * gridSnap;
        }
        if (start.direction === 'se' || start.direction === 's') {
          newHeight = Math.round(newHeight / gridSnap) * gridSnap;
        }
      }

      onResize?.(umlClass.id, { width: newWidth, height: newHeight });
    };

    const handleResizeMouseUp = (upEvent: MouseEvent) => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);

      const start = resizeStartRef.current;
      if (!start) return;

      const dx = (upEvent.clientX - start.mouseX) / zoom;
      const dy = (upEvent.clientY - start.mouseY) / zoom;

      let finalWidth = start.initialWidth;
      let finalHeight = start.initialHeight;

      if (start.direction === 'se' || start.direction === 'e') {
        finalWidth = Math.max(160, Math.min(800, start.initialWidth + dx));
      }
      if (start.direction === 'se' || start.direction === 's') {
        finalHeight = Math.max(90, Math.min(800, start.initialHeight + dy));
      }

      if (gridSnap > 1) {
        if (start.direction === 'se' || start.direction === 'e') {
          finalWidth = Math.round(finalWidth / gridSnap) * gridSnap;
        }
        if (start.direction === 'se' || start.direction === 's') {
          finalHeight = Math.round(finalHeight / gridSnap) * gridSnap;
        }
      }

      onResizeEnd?.(umlClass.id, { width: finalWidth, height: finalHeight });
      resizeStartRef.current = null;
    };

    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
  };

  const width = umlClass.dimensions?.width || 210;
  const height = umlClass.dimensions?.height;
  const lockColor = activeLock?.userColor || '#f43f5e';
  const isLight = theme === 'light';

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        transform: `translate(${umlClass.position.x}px, ${umlClass.position.y}px)`,
        width: `${width}px`,
        height: height ? `${height}px` : undefined,
        minHeight: '100px',
        borderColor: isLockedByOther ? lockColor : undefined,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
      className={`group uml-class-node absolute select-none rounded-lg font-sans text-xs transition-shadow pointer-events-auto ${
        isLight
          ? 'bg-white shadow-md'
          : 'bg-slate-900/95 backdrop-blur-sm'
      } ${
        isLockedByOther
          ? 'cursor-not-allowed border-2 shadow-2xl ring-2 animate-pulse'
          : isSelected || isMultiSelected
          ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-emerald-500/25 shadow-xl cursor-grab active:cursor-grabbing border'
          : isLight
          ? 'border border-slate-300 hover:border-slate-400 hover:shadow-lg cursor-grab active:cursor-grabbing'
          : 'border border-slate-700 hover:border-slate-500 cursor-grab active:cursor-grabbing'
      } ${isDragging || isResizing ? 'opacity-90 z-40' : 'z-20'}`}
    >
      {/* Insignia Flotante de Bloqueo por Otro Ingeniero (Fase 5) */}
      {isLockedByOther && activeLock && (
        <div
          className="absolute -top-8 left-0 right-0 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-white shadow-xl z-50 pointer-events-none"
          style={{ backgroundColor: lockColor }}
        >
          <Lock className="w-3.5 h-3.5" />
          <span className="truncate">Editando: {activeLock.userName}</span>
        </div>
      )}

      {/* Indicador de Bloqueo Propio Adquirido */}
      {isLockedByMe && (
        <div className={`absolute -top-7 right-1 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-md ${
          isLight
            ? 'text-emerald-800 bg-emerald-100 border border-emerald-300'
            : 'text-emerald-300 bg-emerald-950/90 border border-emerald-500/50'
        }`}>
          <Lock className="w-3 h-3 text-emerald-500" />
          <span>Lock Activo</span>
        </div>
      )}

      {/* 1. Encabezado de Clase UML */}
      <div className={`p-2.5 rounded-t-lg border-b text-center relative group/header shrink-0 ${
        isLight
          ? 'bg-slate-100 border-slate-200'
          : 'bg-gradient-to-r from-slate-800 to-slate-850 border-slate-700'
      }`}>
        {onStartConnect && (
          <button
            type="button"
            title="Trazar relación desde esta clase"
            onClick={(e) => {
              e.stopPropagation();
              onStartConnect(umlClass.id);
            }}
            className={`absolute top-2 left-2 p-1 rounded transition-colors ${
              isLight
                ? 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            title="Eliminar esta tabla / clase"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(umlClass.id);
            }}
            className={`absolute top-2 right-2 p-1 rounded transition-colors ${
              isLight
                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {umlClass.stereotype && (
          <div className={`text-xs italic font-normal leading-tight mb-0.5 ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}>
            &laquo;{umlClass.stereotype}&raquo;
          </div>
        )}

        <div
          className={`font-bold text-base tracking-wide px-6 py-0.5 leading-snug ${
            isLight ? 'text-slate-900' : 'text-slate-100'
          } ${umlClass.isAbstract ? (isLight ? 'italic text-emerald-800' : 'italic text-emerald-200') : ''}`}
        >
          {umlClass.name}
        </div>
      </div>

      {/* 2. Compartimento de Atributos */}
      <div className={`p-2.5 space-y-1.5 min-h-[36px] border-b flex-1 overflow-y-auto ${
        isLight
          ? 'bg-white border-slate-200'
          : 'border-slate-800 bg-slate-900/60'
      }`}>
        {umlClass.attributes.length === 0 ? (
          <div className={`text-xs italic py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Sin atributos
          </div>
        ) : (
          [...umlClass.attributes.filter((a) => a.isPk), ...umlClass.attributes.filter((a) => !a.isPk)].map((attr) => (
            <div key={attr.id} className="flex items-center justify-between gap-1 text-xs font-mono py-0.5">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={`font-bold text-sm ${
                    attr.visibility === '+'
                      ? isLight ? 'text-emerald-600' : 'text-green-400'
                      : attr.visibility === '-'
                      ? isLight ? 'text-rose-600' : 'text-rose-400'
                      : attr.visibility === '#'
                      ? isLight ? 'text-amber-600' : 'text-amber-400'
                      : isLight ? 'text-sky-600' : 'text-sky-400'
                  }`}
                >
                  {attr.visibility}
                </span>
                <span className={`truncate font-medium ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>{attr.name}:</span>
                <span className={`font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>{attr.type}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {attr.isPk && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight border ${
                    isLight
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    PK
                  </span>
                )}
                {attr.isFk && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight border ${
                    isLight
                      ? 'bg-sky-100 text-sky-800 border-sky-300'
                      : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  }`}>
                    FK
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Compartimento de Métodos */}
      <div className={`p-2.5 space-y-1.5 min-h-[32px] overflow-y-auto rounded-b-lg shrink-0 ${
        isLight ? 'bg-slate-50/60' : 'bg-slate-950/40'
      }`}>
        {umlClass.methods.length === 0 ? (
          <div className={`text-xs italic py-1 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Sin métodos
          </div>
        ) : (
          umlClass.methods.map((method) => (
            <div key={method.id} className="flex items-center gap-1.5 text-xs font-mono truncate py-0.5">
              <span
                className={`font-bold text-sm ${
                  method.visibility === '+'
                    ? isLight ? 'text-emerald-600' : 'text-green-400'
                    : method.visibility === '-'
                    ? isLight ? 'text-rose-600' : 'text-rose-400'
                    : method.visibility === '#'
                    ? isLight ? 'text-amber-600' : 'text-amber-400'
                    : isLight ? 'text-sky-600' : 'text-sky-400'
                }`}
              >
                {method.visibility}
              </span>
              <span className={`truncate font-medium ${isLight ? 'text-slate-800' : 'text-slate-100'}`}>
                {method.name}({method.parameters || ''}):
              </span>
              <span className={`font-semibold ${isLight ? 'text-sky-700' : 'text-sky-300'}`}>{method.returnType}</span>
            </div>
          ))
        )}
      </div>

      {/* Manijas de Redimensionamiento Interactivo con el ratón */}
      {!isLockedByOther && (
        <>
          {/* Manija Esquina Inferior Derecha (Ancho y Alto simultáneos) */}
          <div
            title="Arrastrar con el ratón para cambiar tamaño (ancho y alto)"
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-2 cursor-se-resize transition-all z-30 flex items-center justify-center ${
              isSelected || isMultiSelected
                ? 'opacity-100 scale-100'
                : 'opacity-0 group-hover:opacity-90 scale-90 hover:scale-115'
            } ${
              isLight
                ? 'bg-emerald-500 border-white shadow-md'
                : 'bg-emerald-400 border-slate-900 shadow-md'
            }`}
          />

          {/* Manija Borde Derecho (Solo Ancho) */}
          <div
            title="Arrastrar para cambiar ancho"
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
            className={`absolute top-1/2 -right-1 w-2 h-7 -translate-y-1/2 rounded-full cursor-ew-resize transition-all z-30 ${
              isSelected || isMultiSelected
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-75'
            } ${
              isLight
                ? 'bg-slate-400 hover:bg-emerald-500'
                : 'bg-slate-500 hover:bg-emerald-400'
            }`}
          />

          {/* Manija Borde Inferior (Solo Alto) */}
          <div
            title="Arrastrar para cambiar alto"
            onMouseDown={(e) => handleResizeMouseDown(e, 's')}
            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-7 h-2 rounded-full cursor-ns-resize transition-all z-30 ${
              isSelected || isMultiSelected
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-75'
            } ${
              isLight
                ? 'bg-slate-400 hover:bg-emerald-500'
                : 'bg-slate-500 hover:bg-emerald-400'
            }`}
          />
        </>
      )}
    </div>
  );
};
