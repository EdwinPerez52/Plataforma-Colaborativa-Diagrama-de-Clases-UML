import React from 'react';
import { DiagramModel } from '../../types/uml';
import { FolderTree, Plus, X, FileBox } from 'lucide-react';

interface DiagramTabBarProps {
  theme?: 'dark' | 'light';
  diagrams: DiagramModel[];
  activeDiagramId: string;
  onSelectDiagram: (id: string) => void;
  onCloseDiagram: (id: string) => void;
  onNewDiagram: () => void;
}

export const DiagramTabBar: React.FC<DiagramTabBarProps> = ({
  theme = 'dark',
  diagrams,
  activeDiagramId,
  onSelectDiagram,
  onCloseDiagram,
  onNewDiagram,
}) => {
  const isLight = theme === 'light';

  return (
    <div
      className={`h-10 flex items-center px-2 border-b select-none overflow-x-auto no-scrollbar z-20 ${
        isLight
          ? 'bg-slate-100/90 border-slate-200 text-slate-700'
          : 'bg-[#131722] border-slate-800 text-slate-300'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {diagrams.map((diag) => {
          const isActive = diag.id === activeDiagramId;

          return (
            <div
              key={diag.id}
              onClick={() => onSelectDiagram(diag.id)}
              className={`group flex items-center gap-2.5 px-3.5 py-2 rounded-t-md text-sm font-semibold cursor-pointer transition-all border-t-2 ${
                isActive
                  ? isLight
                    ? 'bg-white border-t-emerald-500 text-slate-900 border-x border-slate-200 shadow-sm'
                    : 'bg-[#181d28] border-t-emerald-400 text-slate-100 border-x border-slate-800 shadow-sm'
                  : isLight
                  ? 'border-t-transparent hover:bg-slate-200/50 text-slate-600'
                  : 'border-t-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
              }`}
            >
              {diag.type === 'usecase' ? (
                <FileBox className="w-4 h-4 text-emerald-400" />
              ) : (
                <FolderTree
                  className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}
                />
              )}
              <span className="truncate max-w-[180px] font-sans">{diag.name}</span>

              {/* Botón Cerrar Tab (si hay más de 1 diagrama) */}
              {diagrams.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseDiagram(diag.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all ml-0.5"
                  title="Cerrar diagrama"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* Botón Nuevo Diagrama (+) */}
        <button
          onClick={onNewDiagram}
          title="Crear nuevo diagrama de trabajo"
          className={`p-1.5 rounded hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-400 transition-colors ml-1`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
