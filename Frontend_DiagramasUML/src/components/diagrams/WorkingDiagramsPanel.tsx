import React, { useState } from 'react';
import { DiagramModel, DiagramType } from '../../types/uml';
import {
  FolderTree,
  Plus,
  Trash2,
  Edit2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Download,
  Check,
  X,
  FileBox,
} from 'lucide-react';

interface WorkingDiagramsPanelProps {
  isOpen: boolean;
  theme?: 'dark' | 'light';
  diagrams: DiagramModel[];
  activeDiagramId: string;
  onSelectDiagram: (id: string) => void;
  onCreateDiagram: (name: string, type: DiagramType) => void;
  onRenameDiagram: (id: string, newName: string) => void;
  onDuplicateDiagram: (id: string) => void;
  onDeleteDiagram: (id: string) => void;
  onExportDiagram: (id: string, format: 'pdf' | 'png' | 'jpeg' | 'svg') => void;
  onToggleCollapse: () => void;
}

export const WorkingDiagramsPanel: React.FC<WorkingDiagramsPanelProps> = ({
  isOpen,
  theme = 'dark',
  diagrams,
  activeDiagramId,
  onSelectDiagram,
  onCreateDiagram,
  onRenameDiagram,
  onDuplicateDiagram,
  onDeleteDiagram,
  onExportDiagram,
  onToggleCollapse,
}) => {
  const isLight = theme === 'light';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newDiagramName, setNewDiagramName] = useState('');
  const [newDiagramType, setNewDiagramType] = useState<DiagramType>('class');
  const [exportMenuId, setExportMenuId] = useState<string | null>(null);

  const handleStartRename = (diag: DiagramModel, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(diag.id);
    setEditName(diag.name);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editName.trim()) {
      onRenameDiagram(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = newDiagramName.trim() || `Diagrama_${diagrams.length + 1}`;
    onCreateDiagram(finalName, newDiagramType);
    setNewDiagramName('');
    setIsCreating(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggleCollapse}
        title="Mostrar Working Diagrams (Lienzos)"
        className={`fixed left-0 top-16 z-20 flex items-center gap-2 px-3 py-2.5 rounded-r-lg border-y border-r text-sm font-semibold shadow-xl backdrop-blur transition-all active:scale-95 ${
          isLight
            ? 'bg-white/95 text-slate-700 border-slate-300 hover:bg-slate-50'
            : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
        }`}
      >
        <FolderTree className="w-5 h-5 text-emerald-500" />
        <span className="hidden sm:inline">Working Diagrams</span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  return (
    <aside
      className={`w-72 h-full border-r flex flex-col z-20 select-none transition-colors duration-150 ${
        isLight
          ? 'bg-slate-50/95 border-slate-200 text-slate-800'
          : 'bg-[#181d28]/95 border-slate-800 text-slate-200'
      }`}
    >
      {/* 1. Cabecera Estilo StarUML: Working Diagrams */}
      <div
        className={`px-3.5 py-3 border-b flex items-center justify-between ${
          isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-[#131722] border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-emerald-400" />
          <h2 className={`text-sm font-bold uppercase tracking-wider ${
            isLight ? 'text-slate-700' : 'text-slate-200'
          }`}>
            Working Diagrams
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsCreating(true)}
            title="Nuevo Lienzo de Diagrama"
            className={`p-1.5 rounded hover:bg-emerald-600/20 text-emerald-400 transition-colors`}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleCollapse}
            title="Ocultar Panel"
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Formulario para Crear Nuevo Diagrama */}
      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="p-3 border-b border-slate-800 bg-emerald-950/20 space-y-2.5">
          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Nuevo Lienzo</span>
          </div>
          <input
            type="text"
            autoFocus
            placeholder="Ej: DiagramaCine, UseCase1"
            value={newDiagramName}
            onChange={(e) => setNewDiagramName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
          />
          <div className="flex items-center gap-2">
            <select
              value={newDiagramType}
              onChange={(e) => setNewDiagramType(e.target.value as DiagramType)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 font-medium"
            >
              <option value="class">Clases (UML)</option>
              <option value="usecase">Casos de Uso</option>
              <option value="domain">Modelo de Dominio</option>
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-colors"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-2 py-1.5 text-slate-400 hover:text-slate-200 text-xs transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* 3. Lista de Diagramas de Trabajo (StarUML Tree View) */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {diagrams.map((diag) => {
          const isActive = diag.id === activeDiagramId;
          const isEditing = editingId === diag.id;

          return (
            <div
              key={diag.id}
              onClick={() => onSelectDiagram(diag.id)}
              className={`group relative flex items-center justify-between px-2.5 py-2 rounded-md cursor-pointer transition-all ${
                isActive
                  ? isLight
                    ? 'bg-sky-100/90 text-sky-900 border border-sky-300 font-semibold shadow-sm'
                    : 'bg-[#0e2a47] text-sky-300 border border-sky-600/50 font-semibold shadow-sm'
                  : isLight
                  ? 'hover:bg-slate-200/60 text-slate-700'
                  : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {/* Ícono de Diagrama según tipo */}
              <div className="flex items-center gap-2.5 truncate flex-1 mr-1">
                <span className="shrink-0">
                  {diag.type === 'usecase' ? (
                    <FileBox className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <FolderTree
                      className={`w-5 h-5 ${isActive ? 'text-sky-400' : 'text-emerald-400'}`}
                    />
                  )}
                </span>

                {isEditing ? (
                  <form
                    onSubmit={(e) => handleSaveRename(diag.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 flex-1"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-slate-900 border border-emerald-500 rounded px-2 py-1 text-sm text-white flex-1 font-mono"
                    />
                    <button
                      type="submit"
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-1 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="truncate flex flex-col leading-snug">
                    <span className="text-sm font-semibold truncate">{diag.name}</span>
                    <span className="text-xs opacity-75 font-mono">
                      {diag.type === 'usecase' ? 'UseCaseDiagram' : 'ClassDiagram'} —{' '}
                      {diag.classes.length} clases
                    </span>
                  </div>
                )}
              </div>

              {/* Botones de acción contextuales en hover */}
              {!isEditing && (
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                  {/* Renombrar */}
                  <button
                    onClick={(e) => handleStartRename(diag, e)}
                    title="Renombrar diagrama"
                    className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Duplicar */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateDiagram(diag.id);
                    }}
                    title="Duplicar diagrama"
                    className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Exportar */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExportMenuId(exportMenuId === diag.id ? null : diag.id);
                      }}
                      title="Exportar este diagrama"
                      className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {exportMenuId === diag.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-7 z-50 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-1.5 text-xs space-y-1"
                      >
                        <button
                          onClick={() => {
                            onExportDiagram(diag.id, 'pdf');
                            setExportMenuId(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-200 flex items-center justify-between font-medium"
                        >
                          <span>PDF Document</span>
                          <span className="text-[10px] text-slate-400 font-mono">.pdf</span>
                        </button>
                        <button
                          onClick={() => {
                            onExportDiagram(diag.id, 'png');
                            setExportMenuId(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-200 flex items-center justify-between font-medium"
                        >
                          <span>PNG Image (2x)</span>
                          <span className="text-[10px] text-slate-400 font-mono">.png</span>
                        </button>
                        <button
                          onClick={() => {
                            onExportDiagram(diag.id, 'jpeg');
                            setExportMenuId(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-200 flex items-center justify-between font-medium"
                        >
                          <span>JPEG Image</span>
                          <span className="text-[10px] text-slate-400 font-mono">.jpeg</span>
                        </button>
                        <button
                          onClick={() => {
                            onExportDiagram(diag.id, 'svg');
                            setExportMenuId(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-200 flex items-center justify-between font-medium"
                        >
                          <span>SVG Vector</span>
                          <span className="text-[10px] text-slate-400 font-mono">.svg</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Eliminar (solo si hay más de 1 diagrama) */}
                  {diagrams.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar el diagrama "${diag.name}"?`)) {
                          onDeleteDiagram(diag.id);
                        }
                      }}
                      title="Eliminar diagrama"
                      className="p-1.5 hover:bg-rose-900/40 rounded text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Pie con botón rápido de agregar nuevo diagrama */}
      <div className={`p-2.5 border-t text-sm ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <button
          onClick={() => setIsCreating(true)}
          className="w-full py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors text-xs sm:text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Diagrama de Trabajo</span>
        </button>
      </div>
    </aside>
  );
};
