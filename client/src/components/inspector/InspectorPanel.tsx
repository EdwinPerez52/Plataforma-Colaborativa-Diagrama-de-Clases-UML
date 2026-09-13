import React, { useState, useEffect } from 'react';
import {
  UmlClass,
  UmlRelationship,
  UmlVisibility,
  UmlRelationshipType,
  UmlMultiplicity,
  UmlAttribute,
} from '../../types/uml';
import {
  X,
  Plus,
  Trash2,
  Key,
  Link,
  Layers,
  Settings,
  HelpCircle,
  FolderTree,
  PanelRightClose,
  GripVertical,
  Lock,
  ArrowLeftRight,
} from 'lucide-react';

interface InspectorPanelProps {
  isOpen?: boolean;
  theme?: 'dark' | 'light';
  onToggleCollapse?: () => void;
  selectedClass: UmlClass | null;
  selectedRelationship: UmlRelationship | null;
  allClasses: UmlClass[];
  allRelationships?: UmlRelationship[];
  onClose: () => void;
  onUpdateClass: (classId: string, data: Partial<UmlClass>) => void;
  onDeleteClass: (classId: string) => void;
  onAddAttribute: (classId: string, attr: { name: string; type: string; visibility: UmlVisibility; isPk: boolean; isFk?: boolean }) => void;
  onUpdateAttribute?: (attrId: string, data: Partial<UmlAttribute>) => void;
  onDeleteAttribute: (attrId: string) => void;
  onAddMethod: (classId: string, method: { name: string; returnType: string; visibility: UmlVisibility }) => void;
  onDeleteMethod: (methodId: string) => void;
  onUpdateRelationship: (relId: string, data: Partial<UmlRelationship>) => void;
  onDeleteRelationship: (relId: string) => void;
  onStartConnection: (sourceId: string) => void;
  onAddRelationship?: (rel: {
    sourceClassId: string;
    targetClassId: string;
    type: UmlRelationshipType;
    sourceMultiplicity?: UmlMultiplicity | string;
    targetMultiplicity?: UmlMultiplicity | string;
    name?: string;
  }) => void;
  onCreateIntermediateClass?: (data: {
    sourceClassId: string;
    targetClassId: string;
    intermediateName?: string;
    originalRelId?: string;
  }) => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}

// Catálogo de tipos de datos válidos (Java y SQL)
const DATA_TYPES = [
  'Long',
  'String',
  'Integer',
  'Boolean',
  'Double',
  'BigDecimal',
  'LocalDate',
  'LocalDateTime',
  'BIGINT',
  'VARCHAR(255)',
  'INTEGER',
  'BOOLEAN',
  'TIMESTAMP',
  'NUMERIC(12,2)',
  'TEXT',
];

const MULTIPLICITIES: { label: string; value: UmlMultiplicity }[] = [
  { label: '(Sin cardinalidad)', value: '' },
  { label: '1..1', value: '1..1' },
  { label: '0..1', value: '0..1' },
  { label: '1..*', value: '1..*' },
  { label: '0..*', value: '0..*' },
  { label: '*', value: '*' },
  { label: '1', value: '1' },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  isOpen = true,
  theme = 'dark',
  onToggleCollapse,
  selectedClass,
  selectedRelationship,
  allClasses,
  allRelationships = [],
  onClose,
  onUpdateClass,
  onDeleteClass,
  onAddAttribute,
  onUpdateAttribute,
  onDeleteAttribute,
  onAddMethod,
  onDeleteMethod,
  onUpdateRelationship,
  onDeleteRelationship,
  onStartConnection,
  onAddRelationship,
  onCreateIntermediateClass,
  width,
  onWidthChange,
}) => {
  // ── Redimensionamiento horizontal del panel ──
  const MIN_WIDTH = 260;
  const MAX_WIDTH = 800;
  const DEFAULT_WIDTH = 360;
  const HIDE_THRESHOLD = 160;
  const MIN_CANVAS_SPACE = 380;

  const [internalWidth, setInternalWidth] = useState(DEFAULT_WIDTH);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const currentWidth = width ?? internalWidth;

  const setEffectiveWidth = React.useCallback((w: number) => {
    if (onWidthChange) {
      onWidthChange(w);
    } else {
      setInternalWidth(w);
    }
  }, [onWidthChange]);

  // Restaurar ancho saludable al reabrir el panel tras haber sido ocultado
  useEffect(() => {
    if (isOpen && currentWidth < MIN_WIDTH) {
      setEffectiveWidth(DEFAULT_WIDTH);
    }
  }, [isOpen, currentWidth, setEffectiveWidth]);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSplitter(true);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = window.innerWidth - moveEvent.clientX;
      const maxLimit = Math.max(MIN_WIDTH, Math.min(window.innerWidth - MIN_CANVAS_SPACE, MAX_WIDTH));

      // Ocultar el panel al desplazarlo hacia la derecha más allá del umbral
      if (newWidth < HIDE_THRESHOLD) {
        cleanup();
        onToggleCollapse?.();
        return;
      }

      const clamped = Math.min(Math.max(MIN_WIDTH, newWidth), maxLimit);
      setEffectiveWidth(clamped);
    };

    const handleMouseUp = () => cleanup();

    const cleanup = () => {
      setIsDraggingSplitter(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Estado local para agregar nuevo atributo
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrType, setNewAttrType] = useState('String');
  const [newAttrIsPk, setNewAttrIsPk] = useState(false);
  const [newAttrIsFk, setNewAttrIsFk] = useState(false);

  // Estado local para agregar nuevo método
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodType, setNewMethodType] = useState('void');

  // Estado local para agregar relación directa y cardinalidad
  const [relTargetClassId, setRelTargetClassId] = useState('');
  const [relType, setRelType] = useState<UmlRelationshipType>('association');
  const [relSourceMult, setRelSourceMult] = useState<UmlMultiplicity>('1..1');
  const [relTargetMult, setRelTargetMult] = useState<UmlMultiplicity>('0..*');
  const [relName, setRelName] = useState('');
  const [createIntermediateTable, setCreateIntermediateTable] = useState(false);
  const [intermediateClassName, setIntermediateClassName] = useState('');

  // Estado local para drag and drop (reordenar con el mouse)
  const [draggedAttrIdx, setDraggedAttrIdx] = useState<number | null>(null);
  const [dragOverAttrIdx, setDragOverAttrIdx] = useState<number | null>(null);
  const [draggedMethodIdx, setDraggedMethodIdx] = useState<number | null>(null);
  const [dragOverMethodIdx, setDragOverMethodIdx] = useState<number | null>(null);

  const classRelationships = selectedClass
    ? allRelationships.filter(
        (r) => r.sourceClassId === selectedClass.id || r.targetClassId === selectedClass.id
      )
    : [];

  const handleAddDirectRelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !relTargetClassId) return;

    if (createIntermediateTable && onCreateIntermediateClass && relTargetClassId !== selectedClass.id) {
      onCreateIntermediateClass({
        sourceClassId: selectedClass.id,
        targetClassId: relTargetClassId,
        intermediateName: intermediateClassName.trim() || undefined,
      });
      setRelTargetClassId('');
      setRelName('');
      setCreateIntermediateTable(false);
      setIntermediateClassName('');
      return;
    }

    if (!onAddRelationship) return;
    onAddRelationship({
      sourceClassId: selectedClass.id,
      targetClassId: relTargetClassId,
      type: relType,
      sourceMultiplicity: relSourceMult,
      targetMultiplicity: relTargetMult,
      name: relName.trim() || undefined,
    });
    setRelTargetClassId('');
    setRelName('');
    setCreateIntermediateTable(false);
    setIntermediateClassName('');
  };

  const handleAddAttrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !newAttrName.trim()) return;
    onAddAttribute(selectedClass.id, {
      name: newAttrName.trim(),
      type: newAttrType,
      visibility: '+',
      isPk: newAttrIsPk,
      isFk: newAttrIsFk,
    });
    setNewAttrName('');
    setNewAttrIsPk(false);
    setNewAttrIsFk(false);
  };

  const handleAddMethodSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !newMethodName.trim()) return;
    onAddMethod(selectedClass.id, {
      name: newMethodName.trim(),
      returnType: newMethodType,
      visibility: '+',
    });
    setNewMethodName('');
  };

  // Reordenar atributos con el ratón: La PK siempre permanece en 1er lugar arriba
  const handleAttrDragStart = (e: React.DragEvent, index: number, isPk: boolean) => {
    if (isPk) {
      e.preventDefault();
      return;
    }
    setDraggedAttrIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleAttrDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedAttrIdx === null || draggedAttrIdx === targetIndex) return;
    // La llave primaria siempre se mantiene fija en la cima (índice 0)
    if (targetIndex === 0 && selectedClass?.attributes[0]?.isPk) return;
    setDragOverAttrIdx(targetIndex);
  };

  const handleAttrDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedAttrIdx === null || !selectedClass) {
      setDraggedAttrIdx(null);
      setDragOverAttrIdx(null);
      return;
    }

    const items = [...selectedClass.attributes];
    let actualTarget = targetIndex;
    if (actualTarget === 0 && items[0]?.isPk) {
      actualTarget = 1;
    }

    if (draggedAttrIdx === actualTarget) {
      setDraggedAttrIdx(null);
      setDragOverAttrIdx(null);
      return;
    }

    const [movedItem] = items.splice(draggedAttrIdx, 1);
    items.splice(actualTarget, 0, movedItem);

    // Garantía estricta: PK siempre primero
    const pkItems = items.filter((a) => a.isPk);
    const nonPkItems = items.filter((a) => !a.isPk);
    const finalAttributes = [...pkItems, ...nonPkItems];

    onUpdateClass(selectedClass.id, { attributes: finalAttributes });
    setDraggedAttrIdx(null);
    setDragOverAttrIdx(null);
  };

  // Reordenar métodos con el ratón
  const handleMethodDragStart = (e: React.DragEvent, index: number) => {
    setDraggedMethodIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleMethodDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedMethodIdx === null || draggedMethodIdx === targetIndex) return;
    setDragOverMethodIdx(targetIndex);
  };

  const handleMethodDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedMethodIdx === null || !selectedClass || draggedMethodIdx === targetIndex) {
      setDraggedMethodIdx(null);
      setDragOverMethodIdx(null);
      return;
    }

    const items = [...selectedClass.methods];
    const [movedItem] = items.splice(draggedMethodIdx, 1);
    items.splice(targetIndex, 0, movedItem);

    onUpdateClass(selectedClass.id, { methods: items });
    setDraggedMethodIdx(null);
    setDragOverMethodIdx(null);
  };

  if (!isOpen) return null;

  const isLight = theme === 'light';

  return (
    <aside
      style={{ width: `${currentWidth}px` }}
      className={`relative shrink-0 h-full flex flex-col z-30 shadow-2xl font-sans text-sm select-none border-l transition-[background-color,border-color] duration-150 ${
        isLight
          ? 'bg-white border-slate-200 text-slate-800'
          : 'bg-slate-900 border-slate-800 text-slate-300'
      }`}
    >
      {/* Tirador / Splitter de arrastre lateral para redimensionar con el cursor */}
      <div
        onMouseDown={handleSplitterMouseDown}
        className={`absolute -left-1.5 top-0 bottom-0 w-3 cursor-ew-resize group z-50 flex items-center justify-center transition-colors ${
          isDraggingSplitter ? 'bg-emerald-500/30' : 'hover:bg-emerald-500/20'
        }`}
        title="Arrastra con el ratón a la izquierda para expandir o a la derecha hasta ocultar"
      >
        <div
          className={`w-1 rounded-full transition-all ${
            isDraggingSplitter
              ? 'bg-emerald-500 h-16 w-1.5 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
              : 'bg-slate-400/50 h-10 group-hover:bg-emerald-400 group-hover:h-14'
          }`}
        />
      </div>
      {/* 1. Header del Inspector */}
      <div className={`p-3.5 border-b flex items-center justify-between transition-colors ${
        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
      }`}>
        <div className="flex items-center gap-2">
          <Settings className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          <span className={`font-bold uppercase tracking-wider text-xs ${
            isLight ? 'text-slate-800' : 'text-slate-200'
          }`}>
            {selectedClass
              ? 'Inspector de Clase'
              : selectedRelationship
              ? 'Inspector de Relación'
              : 'Propiedades del Modelo'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Ocultar panel de propiedades"
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                isLight
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <PanelRightClose className="w-3.5 h-3.5" />
              <span>Ocultar</span>
            </button>
          )}
          {(selectedClass || selectedRelationship) && (
            <button
              onClick={onClose}
              title="Cerrar selección actual"
              className={`p-1.5 rounded transition-colors ${
                isLight
                  ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-200'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Contenido Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* CASO A: Clase Seleccionada */}
        {selectedClass && (
          <>
            {/* Propiedades Principales de la Clase */}
            <div className="space-y-3">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  Nombre de la Clase
                </label>
                <input
                  type="text"
                  value={selectedClass.name}
                  onChange={(e) => onUpdateClass(selectedClass.id, { name: e.target.value })}
                  placeholder="Ej: Paciente, Factura, Usuario"
                  className={`w-full border rounded px-3 py-2 text-sm font-semibold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              {/* Indicador si actúa como Clase Intermedia / Clase de Asociación */}
              {(() => {
                const linkedRel = allRelationships.find(
                  (r) => r.intermediateClassId === selectedClass.id || r.intermediateTableId === selectedClass.id
                );
                if (!linkedRel) return null;
                const src = allClasses.find((c) => c.id === linkedRel.sourceClassId);
                const tgt = allClasses.find((c) => c.id === linkedRel.targetClassId);
                return (
                  <div className="bg-emerald-950/40 border border-emerald-700/60 rounded-lg p-2.5 space-y-1 text-xs text-emerald-200">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-[11px]">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Clase de Asociación UML (Intermedia)</span>
                    </div>
                    <p className="text-[10px] text-slate-300">
                      Conectada por línea discontinua a la relación entre:
                    </p>
                    <div className="font-mono text-[11px] text-white font-semibold flex items-center gap-1.5">
                      <span className="text-sky-300">{src?.name || 'Origen'}</span>
                      <span className="text-slate-400">──────</span>
                      <span className="text-sky-300">{tgt?.name || 'Destino'}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Botón Trazar Relación */}
              <button
                onClick={() => onStartConnection(selectedClass.id)}
                className="w-full py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded flex items-center justify-center gap-1.5 font-medium transition-colors"
              >
                <Link className="w-3.5 h-3.5" />
                <span>Trazar Relación desde esta Clase</span>
              </button>
            </div>

            <hr className="border-slate-800" />

            {/* Sección de Atributos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Compartimento de Atributos ({selectedClass.attributes.length})
                </span>
              </div>

              {/* Lista actual con Drag and Drop */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {selectedClass.attributes.map((attr, idx) => {
                  const isPk = Boolean(attr.isPk);
                  const isDraggingThis = draggedAttrIdx === idx;
                  const isOverThis = dragOverAttrIdx === idx;

                  return (
                    <div
                      key={attr.id}
                      draggable={!isPk}
                      onDragStart={(e) => handleAttrDragStart(e, idx, isPk)}
                      onDragOver={(e) => handleAttrDragOver(e, idx)}
                      onDragLeave={() => setDragOverAttrIdx(null)}
                      onDrop={(e) => handleAttrDrop(e, idx)}
                      onDragEnd={() => {
                        setDraggedAttrIdx(null);
                        setDragOverAttrIdx(null);
                      }}
                      className={`flex items-center justify-between border rounded p-2 group transition-all select-none ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      } ${
                        isDraggingThis ? 'opacity-30 scale-95' : ''
                      } ${
                        isOverThis ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-500/10' : ''
                      } ${
                        isPk ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {isPk ? (
                          <span title="Llave Primaria (Fija en 1er lugar)" className="text-amber-400 p-0.5 shrink-0">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span title="Arrastrar con el ratón para reordenar" className="text-slate-500 hover:text-slate-300 p-0.5 cursor-grab shrink-0">
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <span className="font-mono text-emerald-400 font-bold text-sm">{attr.visibility}</span>
                        <span className={`font-mono text-xs font-semibold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                          {attr.name}
                        </span>
                        <span className="text-slate-400 font-mono text-xs">:{attr.type}</span>
                        {/* Insignias y controles PK y FK */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onUpdateAttribute && onUpdateAttribute(attr.id, { isPk: !isPk })}
                            title={isPk ? 'Quitar Llave Primaria (PK)' : 'Marcar como Llave Primaria (PK)'}
                            className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-all ${
                              isPk
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50'
                                : 'opacity-0 group-hover:opacity-100 bg-slate-900 hover:bg-amber-500/10 text-slate-400 hover:text-amber-300 border-slate-700'
                            }`}
                          >
                            PK
                          </button>

                          <button
                            type="button"
                            onClick={() => onUpdateAttribute && onUpdateAttribute(attr.id, { isFk: !attr.isFk })}
                            title={attr.isFk ? 'Quitar Llave Foránea (FK)' : 'Marcar como Llave Foránea (FK)'}
                            className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-all ${
                              attr.isFk
                                ? 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border-sky-500/50'
                                : 'opacity-0 group-hover:opacity-100 bg-slate-900 hover:bg-sky-500/10 text-slate-400 hover:text-sky-300 border-slate-700'
                            }`}
                          >
                            FK
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteAttribute(attr.id)}
                        title="Eliminar atributo"
                        className="text-slate-500 hover:text-rose-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Formulario Agregar Atributo */}
              <form onSubmit={handleAddAttrSubmit} className="space-y-2.5 bg-slate-950/40 p-2.5 rounded border border-slate-800">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="nombreAtributo"
                    value={newAttrName}
                    onChange={(e) => setNewAttrName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 items-center">
                  <select
                    value={newAttrType}
                    onChange={(e) => setNewAttrType(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs"
                  >
                    {DATA_TYPES.map((dt) => (
                      <option key={dt} value={dt}>
                        {dt}
                      </option>
                    ))}
                  </select>

                  <label
                    title="Marcar como Llave Primaria (PK)"
                    className="flex items-center gap-1.5 cursor-pointer bg-slate-900 border border-slate-700 hover:border-amber-500/40 px-2.5 py-1.5 rounded select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={newAttrIsPk}
                      onChange={(e) => setNewAttrIsPk(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span className="text-xs text-amber-300 font-bold flex items-center gap-0.5">
                      <Key className="w-3 h-3" /> PK
                    </span>
                  </label>

                  <label
                    title="Marcar como Llave Foránea (FK)"
                    className="flex items-center gap-1.5 cursor-pointer bg-slate-900 border border-slate-700 hover:border-sky-500/40 px-2.5 py-1.5 rounded select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={newAttrIsFk}
                      onChange={(e) => setNewAttrIsFk(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0"
                    />
                    <span className="text-xs text-sky-300 font-bold flex items-center gap-0.5">
                      <Link className="w-3 h-3" /> FK
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold flex items-center justify-center gap-1 text-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Atributo</span>
                </button>
              </form>
            </div>

            <hr className="border-slate-800" />

            {/* Sección de Métodos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Compartimento de Métodos ({selectedClass.methods.length})
                </span>
              </div>

              {/* Lista actual con Drag and Drop */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {selectedClass.methods.map((method, idx) => {
                  const isDraggingThis = draggedMethodIdx === idx;
                  const isOverThis = dragOverMethodIdx === idx;

                  return (
                    <div
                      key={method.id}
                      draggable={true}
                      onDragStart={(e) => handleMethodDragStart(e, idx)}
                      onDragOver={(e) => handleMethodDragOver(e, idx)}
                      onDragLeave={() => setDragOverMethodIdx(null)}
                      onDrop={(e) => handleMethodDrop(e, idx)}
                      onDragEnd={() => {
                        setDraggedMethodIdx(null);
                        setDragOverMethodIdx(null);
                      }}
                      className={`flex items-center justify-between border rounded p-2 group transition-all select-none cursor-grab active:cursor-grabbing ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      } ${
                        isDraggingThis ? 'opacity-30 scale-95' : ''
                      } ${
                        isOverThis ? 'border-sky-500 ring-1 ring-sky-500 bg-sky-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate font-mono text-xs">
                        <span title="Arrastrar con el ratón para reordenar" className="text-slate-500 hover:text-slate-300 p-0.5 cursor-grab shrink-0">
                          <GripVertical className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-sky-400 font-bold text-sm">{method.visibility}</span>
                        <span className={`truncate font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                          {method.name}()
                        </span>
                        <span className="text-slate-400 text-xs">:{method.returnType}</span>
                      </div>
                      <button
                        onClick={() => onDeleteMethod(method.id)}
                        title="Eliminar método"
                        className="text-slate-500 hover:text-rose-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Formulario Agregar Método */}
              <form onSubmit={handleAddMethodSubmit} className="space-y-2 bg-slate-950/40 p-2.5 rounded border border-slate-800">
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="nombreMetodo"
                    value={newMethodName}
                    onChange={(e) => setNewMethodName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Tipo retorno (void, Long...)"
                    value={newMethodType}
                    onChange={(e) => setNewMethodType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-semibold flex items-center justify-center gap-1 text-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Método</span>
                </button>
              </form>
            </div>

            <hr className="border-slate-800" />

            {/* Sección de Relaciones y Cardinalidades */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Link className="w-4 h-4 text-emerald-400" />
                  Relaciones y Cardinalidades ({classRelationships.length})
                </span>
              </div>

              {/* Lista de relaciones existentes vinculadas a esta clase */}
              {classRelationships.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {classRelationships.map((rel) => {
                    const isSource = rel.sourceClassId === selectedClass.id;
                    const isSelf = rel.sourceClassId === rel.targetClassId;
                    const otherClass = allClasses.find((c) =>
                      c.id === (isSource ? rel.targetClassId : rel.sourceClassId)
                    );
                    const otherName = otherClass?.name || 'Entidad';
                    const relTitle = isSelf
                      ? `↺ Recursiva (${selectedClass.name})`
                      : isSource
                      ? `→ hacia ${otherName}`
                      : `← desde ${otherName}`;

                    return (
                      <div
                        key={rel.id}
                        className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded p-2.5 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-400 truncate text-xs">
                            {relTitle}
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteRelationship(rel.id)}
                            title="Eliminar relación"
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Tipo de relación */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-xs font-medium">Tipo:</span>
                          <select
                            value={rel.type}
                            onChange={(e) =>
                              onUpdateRelationship(rel.id, {
                                type: e.target.value as UmlRelationshipType,
                              })
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs flex-1"
                          >
                            <option value="association">Asociación (Línea)</option>
                            <option value="aggregation">Agregación</option>
                            <option value="composition">Composición</option>
                            <option value="generalization">Generalización</option>
                            <option value="dependency">Dependencia</option>
                          </select>
                        </div>

                        {/* Multiplicidades / Cardinalidades */}
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <div>
                            <label className="block text-xs text-slate-400 font-medium mb-0.5">Card. Origen</label>
                            <select
                              value={rel.sourceMultiplicity ?? ''}
                              onChange={(e) =>
                                onUpdateRelationship(rel.id, {
                                  sourceMultiplicity: e.target.value as UmlMultiplicity,
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                            >
                              {MULTIPLICITIES.map((m) => (
                                <option key={m.label} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 font-medium mb-0.5">Card. Destino</label>
                            <select
                              value={rel.targetMultiplicity ?? ''}
                              onChange={(e) =>
                                onUpdateRelationship(rel.id, {
                                  targetMultiplicity: e.target.value as UmlMultiplicity,
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                            >
                              {MULTIPLICITIES.map((m) => (
                                <option key={m.label} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic bg-slate-950/40 p-2 rounded border border-slate-800">
                  Esta clase aún no tiene relaciones ni cardinalidades asignadas.
                </div>
              )}

              {/* Formulario para añadir nueva relación y cardinalidad */}
              {allClasses.length > 0 && onAddRelationship && (
                <form
                  onSubmit={handleAddDirectRelSubmit}
                  className="space-y-2.5 bg-slate-950/50 p-3 rounded border border-slate-800"
                >
                  <span className="block text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Nueva Relación con Cardinalidad
                  </span>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1">Clase Destino</label>
                    <select
                      value={relTargetClassId}
                      onChange={(e) => {
                        const newTargetId = e.target.value;
                        setRelTargetClassId(newTargetId);
                        const other = allClasses.find((c) => c.id === newTargetId);
                        if (other && selectedClass) {
                          setIntermediateClassName(`${selectedClass.name}_${other.name}`);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Seleccionar clase destino --</option>
                      {allClasses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.id === selectedClass.id ? '↺ (Misma clase - Recursiva)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">Tipo</label>
                      <select
                        value={relType}
                        onChange={(e) => setRelType(e.target.value as UmlRelationshipType)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-xs"
                      >
                        <option value="association">Asociación (Línea)</option>
                        <option value="composition">Composición (Rombo)</option>
                        <option value="aggregation">Agregación</option>
                        <option value="generalization">Herencia</option>
                        <option value="dependency">Dependencia</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">Rol (Opcional)</label>
                      <input
                        type="text"
                        placeholder="ej: tiene"
                        value={relName}
                        onChange={(e) => setRelName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">Card. Origen</label>
                      <select
                        value={relSourceMult}
                        onChange={(e) => {
                          const val = e.target.value as UmlMultiplicity;
                          setRelSourceMult(val);
                          if (['*', '0..*', '1..*'].includes(val) && ['*', '0..*', '1..*'].includes(relTargetMult)) {
                            setCreateIntermediateTable(true);
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono text-xs"
                      >
                        {MULTIPLICITIES.map((m) => (
                          <option key={m.label} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 font-medium mb-1">Card. Destino</label>
                      <select
                        value={relTargetMult}
                        onChange={(e) => {
                          const val = e.target.value as UmlMultiplicity;
                          setRelTargetMult(val);
                          if (['*', '0..*', '1..*'].includes(relSourceMult) && ['*', '0..*', '1..*'].includes(val)) {
                            setCreateIntermediateTable(true);
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 font-mono text-xs"
                      >
                        {MULTIPLICITIES.map((m) => (
                          <option key={m.label} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Opción de Clase Intermedia para Muchos a Muchos */}
                  {relTargetClassId && relTargetClassId !== selectedClass.id && (
                    <div className={`p-2.5 rounded border text-xs space-y-2 transition-colors ${
                      ['*', '0..*', '1..*'].includes(relSourceMult) && ['*', '0..*', '1..*'].includes(relTargetMult)
                        ? 'bg-emerald-950/40 border-emerald-700/60'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-200">
                        <input
                          type="checkbox"
                          checked={createIntermediateTable}
                          onChange={(e) => setCreateIntermediateTable(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                        />
                        <span className="text-xs text-emerald-300 font-semibold">Crear clase intermedia asociativa (Muchos a Muchos / N:M)</span>
                      </label>
                      {createIntermediateTable && (
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-xs text-slate-400">Nombre de la entidad intermedia:</label>
                          <input
                            type="text"
                            value={intermediateClassName}
                            onChange={(e) => setIntermediateClassName(e.target.value)}
                            placeholder={`${selectedClass.name}_${allClasses.find((c) => c.id === relTargetClassId)?.name || 'Intermedia'}`}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                          />
                          <p className="text-[11px] text-slate-400">
                            Crea una entidad intermedia con llaves foráneas y dos relaciones 1:N hacia ambas entidades.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!relTargetClassId}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-semibold flex items-center justify-center gap-1.5 text-xs transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {createIntermediateTable ? 'Crear Entidad Intermedia y Relaciones' : 'Asignar Relación y Cardinalidad'}
                    </span>
                  </button>
                </form>
              )}
            </div>

            <hr className="border-slate-800" />

            {/* Eliminar Clase */}
            <button
              onClick={() => onDeleteClass(selectedClass.id)}
              className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded flex items-center justify-center gap-2 font-semibold text-xs transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar Clase del Modelo</span>
            </button>
          </>
        )}

        {/* CASO B: Relación Seleccionada */}
        {selectedRelationship && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Tipo de Relación UML
              </label>
              <select
                value={selectedRelationship.type}
                onChange={(e) =>
                  onUpdateRelationship(selectedRelationship.id, {
                    type: e.target.value as UmlRelationshipType,
                  })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="association">Asociación Simple (Línea)</option>
                <option value="aggregation">Agregación (Rombo Hueco)</option>
                <option value="composition">Composición (Rombo Relleno)</option>
                <option value="generalization">Generalización / Herencia (Triángulo)</option>
                <option value="dependency">Dependencia (Trazo Discontinuo)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Nombre / Rol de la Relación
              </label>
              <input
                type="text"
                placeholder="ej: pertenece_a, gestiona"
                value={selectedRelationship.name || ''}
                onChange={(e) =>
                  onUpdateRelationship(selectedRelationship.id, { name: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Multiplicidad Origen
                </label>
                <select
                  value={selectedRelationship.sourceMultiplicity ?? ''}
                  onChange={(e) =>
                    onUpdateRelationship(selectedRelationship.id, {
                      sourceMultiplicity: e.target.value as UmlMultiplicity,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs font-semibold"
                >
                  {MULTIPLICITIES.map((m) => (
                    <option key={m.label} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Multiplicidad Destino
                </label>
                <select
                  value={selectedRelationship.targetMultiplicity ?? ''}
                  onChange={(e) =>
                    onUpdateRelationship(selectedRelationship.id, {
                      targetMultiplicity: e.target.value as UmlMultiplicity,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono text-xs font-semibold"
                >
                  {MULTIPLICITIES.map((m) => (
                    <option key={m.label} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Invertir Dirección Origen <-> Destino */}
            <button
              type="button"
              onClick={() => {
                onUpdateRelationship(selectedRelationship.id, {
                  sourceClassId: selectedRelationship.targetClassId,
                  targetClassId: selectedRelationship.sourceClassId,
                  sourceMultiplicity: selectedRelationship.targetMultiplicity,
                  targetMultiplicity: selectedRelationship.sourceMultiplicity,
                });
              }}
              title="Intercambia el origen y el destino de la relación"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded flex items-center justify-center gap-2 font-semibold text-xs transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4 text-sky-400" />
              <span>Invertir Sentido (Origen ⇄ Destino)</span>
            </button>

            {/* Vinculación de Clase Intermedia / Clase de Asociación */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>Clase Intermedia / Asociación</span>
                </label>
                {(selectedRelationship.intermediateClassId || selectedRelationship.intermediateTableId) && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-semibold">
                    Conectada
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  Clase intermedia conectada con línea discontinua:
                </label>
                <select
                  value={selectedRelationship.intermediateClassId || selectedRelationship.intermediateTableId || ''}
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    onUpdateRelationship(selectedRelationship.id, {
                      intermediateClassId: val,
                      intermediateTableId: val,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                >
                  <option value="">(Ninguna - Sin derivación punteada)</option>
                  {allClasses
                    .filter(
                      (c) =>
                        c.id !== selectedRelationship.sourceClassId &&
                        c.id !== selectedRelationship.targetClassId
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.stereotype ? `«${c.stereotype}»` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Botón rápido para crear una nueva clase intermedia y asociarla de inmediato */}
              {onCreateIntermediateClass &&
                selectedRelationship.sourceClassId !== selectedRelationship.targetClassId &&
                !(selectedRelationship.intermediateClassId || selectedRelationship.intermediateTableId) && (
                  <button
                    type="button"
                    onClick={() =>
                      onCreateIntermediateClass({
                        sourceClassId: selectedRelationship.sourceClassId,
                        targetClassId: selectedRelationship.targetClassId,
                        originalRelId: selectedRelationship.id,
                      })
                    }
                    className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded flex items-center justify-center gap-2 font-semibold text-xs transition-colors"
                  >
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <span>Crear y Vincular Nueva Clase Intermedia</span>
                  </button>
                )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => onDeleteRelationship(selectedRelationship.id)}
                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded flex items-center justify-center gap-2 font-semibold text-xs transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar Relación</span>
              </button>
            </div>
          </div>
        )}

        {/* CASO C: Nada seleccionado (Panel de Ayuda y Métricas) */}
        {!selectedClass && !selectedRelationship && (
          <div className="space-y-6 text-slate-400">
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                <FolderTree className="w-4 h-4 text-emerald-400" />
                <span>Métricas del Diagrama</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-center">
                  <div className="text-2xl font-bold text-emerald-400">{allClasses.length}</div>
                  <div className="text-xs uppercase font-semibold text-slate-400">Clases UML</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-center">
                  <div className="text-2xl font-bold text-sky-400">
                    {allClasses.reduce((acc, c) => acc + c.attributes.length, 0)}
                  </div>
                  <div className="text-xs uppercase font-semibold text-slate-400">Atributos</div>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                <HelpCircle className="w-4 h-4 text-sky-400" />
                <span>Guía Rápida de Interacción</span>
              </div>
              <ul className="space-y-2.5 text-xs leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span><strong>Cambiar Tamaño de Clase:</strong> Arrastra con el cursor la manija circular inferior derecha de cualquier clase.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span><strong>Doble Clic en Lienzo:</strong> Crea una nueva clase en las coordenadas seleccionadas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span><strong>Arrastrar Fondo:</strong> Paneo infinito para explorar el diagrama.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span><strong>Rueda del Mouse:</strong> Zoom centrado en la posición del puntero.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span><strong>Clic en Clase:</strong> Abre este inspector para editar atributos (PK/FK), métodos y relaciones.</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
