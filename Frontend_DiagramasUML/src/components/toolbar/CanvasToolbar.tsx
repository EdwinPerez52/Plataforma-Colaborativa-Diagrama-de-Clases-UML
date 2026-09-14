import React, { useState } from 'react';
import {
  Plus,
  Share2,
  Sparkles,
  Camera,
  FileCode,
  Zap,
  Sun,
  Moon,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  FolderTree,
  Download,
  ChevronDown,
  FileText,
  Image,
} from 'lucide-react';

interface CanvasToolbarProps {
  projectTitle: string;
  roomCode?: string;
  theme?: 'dark' | 'light';
  isAiDrawerOpen: boolean;
  isInspectorOpen: boolean;
  isWorkingDiagramsOpen: boolean;
  workingDiagramsCount?: number;
  isAllSelected?: boolean;
  selectedCount?: number;
  onAddClass: () => void;
  onToggleAiDrawer: () => void;
  onToggleInspector: () => void;
  onToggleWorkingDiagrams: () => void;
  onToggleTheme: () => void;
  onSelectAll: () => void;
  onOpenVisionModal: () => void;
  onOpenXmiModal: () => void;
  onOpenBackendModal: () => void;
  onExportDiagram: (format: 'pdf' | 'png' | 'jpeg' | 'svg') => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  projectTitle,
  roomCode,
  theme = 'dark',
  isAiDrawerOpen,
  isInspectorOpen,
  isWorkingDiagramsOpen,
  workingDiagramsCount = 1,
  isAllSelected = false,
  selectedCount = 0,
  onAddClass,
  onToggleAiDrawer,
  onToggleInspector,
  onToggleWorkingDiagrams,
  onToggleTheme,
  onSelectAll,
  onOpenVisionModal,
  onOpenXmiModal,
  onOpenBackendModal,
  onExportDiagram,
}) => {
  const isLight = theme === 'light';
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  return (
    <header className={`h-15 py-2 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none border-b transition-colors duration-150 ${
      isLight
        ? 'bg-white/95 border-slate-200 text-slate-800 shadow-sm'
        : 'bg-slate-900/90 border-slate-800 text-slate-100'
    }`}>
      {/* 1. Información del Proyecto y Sala */}
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm border transition-colors ${
            isLight
              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
              : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
          }`}>
            UML
          </div>
          <div>
            <h1 className={`font-bold text-base leading-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              {projectTitle}
            </h1>
            {roomCode && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-2 py-0.5 rounded font-mono border flex items-center gap-1 font-medium ${
                  isLight
                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  <Share2 className="w-3 h-3 text-slate-400" /> {roomCode}
                </span>
              </div>
            )}
          </div>
        </div>
        {/* Botón Toggle Working Diagrams */}
        <button
          onClick={onToggleWorkingDiagrams}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold border transition-all active:scale-95 ${
            isWorkingDiagramsOpen
              ? isLight
                ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm'
                : 'bg-blue-950/60 text-blue-400 border-blue-800'
              : isLight
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-slate-700'
          }`}
          title="Ver o gestionar diagramas de trabajo (StarUML Style)"
        >
          <FolderTree className="w-4 h-4 text-blue-500" />
          <span className="hidden sm:inline">Working Diagrams</span>
          <span className={`text-xs px-2 py-0.2 rounded-full font-bold ${
            isWorkingDiagramsOpen
              ? isLight ? 'bg-blue-200 text-blue-800' : 'bg-blue-500/20 text-blue-400'
              : isLight ? 'bg-slate-200 text-slate-600' : 'bg-slate-700 text-slate-300'
          }`}>
            {workingDiagramsCount}
          </span>
        </button>
      </div>

      {/* 2. Barra Central de Herramientas de Modelado */}
      <div className={`flex items-center gap-1.5 border rounded-lg p-1.5 transition-colors ${
        isLight
          ? 'bg-slate-50 border-slate-200'
          : 'bg-slate-950/70 border-slate-800'
      }`}>
        {/* Botón Nueva Clase UML */}
        <button
          onClick={onAddClass}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
          title="Crear una nueva clase UML"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Clase UML</span>
        </button>

        {/* Botón Seleccionar Todo (con soporte para mover en grupo) */}
        <button
          onClick={onSelectAll}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs sm:text-sm font-semibold transition-all active:scale-95 border ${
            isAllSelected
              ? 'bg-emerald-600/20 text-emerald-600 border-emerald-400'
              : isLight
              ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
          }`}
          title="Seleccionar todas las clases para moverlas juntas (Ctrl + A)"
        >
          <Layers className="w-4 h-4 text-emerald-500" />
          <span>{isAllSelected ? 'Deseleccionar Todo' : 'Seleccionar Todo'}</span>
          {selectedCount > 1 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-500 text-xs font-bold">
              {selectedCount}
            </span>
          )}
        </button>

        <div className={`h-4 w-[1px] mx-1 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

        <button
          onClick={onOpenVisionModal}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-all active:scale-95 border ${
            isLight
              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
              : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border-indigo-500/40'
          }`}
          title="Digitalizar foto de boceto a clases UML"
        >
          <Camera className="w-3.5 h-3.5 text-indigo-500" />
          <span>Digitalizar Boceto</span>
        </button>

        <button
          onClick={onOpenXmiModal}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-all active:scale-95 border ${
            isLight
              ? 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200'
              : 'bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border-cyan-500/40'
          }`}
          title="Interoperabilidad con Sparx Enterprise Architect (XMI 2.1)"
        >
          <FileCode className="w-3.5 h-3.5 text-cyan-500" />
          <span>XMI (EA)</span>
        </button>

        <button
          onClick={onOpenBackendModal}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-all active:scale-95 border ${
            isLight
              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
              : 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border-amber-500/40'
          }`}
          title="Generar solución backend en Spring Boot"
        >
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Generar Backend</span>
        </button>

        <div className={`h-4 w-[1px] mx-1 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

        {/* Botón Asistente IA */}
        <button
          onClick={onToggleAiDrawer}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-all active:scale-95 ${
            isAiDrawerOpen
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white ring-2 ring-purple-400'
              : isLight
              ? 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200'
              : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40'
          }`}
          title="Asistente de Inteligencia Artificial para modelado"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span>Asistente IA</span>
        </button>
      </div>

      {/* 3. Acciones Derecha: Menú Exportar, Selector de Tema y Panel Inspector */}
      <div className="flex items-center gap-2">
        {/* Menú Desplegable Exportar Lienzo */}
        <div className="relative">
          <button
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
              isExportMenuOpen
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                : isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Exportar diagrama activo en múltiples formatos"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Exportar</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isExportMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsExportMenuOpen(false)}
              />
              <div
                className={`absolute right-0 top-full mt-1.5 w-60 rounded-xl shadow-2xl border p-2 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-slate-900 border-slate-700 text-slate-100'
                }`}
              >
                <div className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Exportar Diagrama Como...
                </div>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onExportDiagram('pdf');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                    isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <FileText className="w-5 h-5 text-red-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Documento PDF (.pdf)</div>
                    <div className="text-xs text-slate-400">Membrete formal e impresión</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onExportDiagram('png');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                    isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <Image className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Imagen PNG HD (.png)</div>
                    <div className="text-xs text-slate-400">Resolución 2x de alta fidelidad</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onExportDiagram('jpeg');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                    isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <Image className="w-5 h-5 text-blue-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Imagen JPEG (.jpeg)</div>
                    <div className="text-xs text-slate-400">Fondo blanco comprimido</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onExportDiagram('svg');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                    isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <FileCode className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-sm">Vector SVG (.svg)</div>
                    <div className="text-xs text-slate-400">Escalable sin pérdida</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Selector de Tema Claro / Oscuro */}
        <button
          onClick={onToggleTheme}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
            isLight
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
          title={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        >
          {isLight ? (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span>Tema Oscuro</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Tema Claro</span>
            </>
          )}
        </button>

        {/* Botón para Mostrar/Ocultar Panel de Propiedades */}
        <button
          onClick={onToggleInspector}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition-all active:scale-95 ${
            isInspectorOpen
              ? isLight
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-800 text-emerald-400 border-slate-700'
              : isLight
              ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
          }`}
          title={isInspectorOpen ? 'Ocultar panel de propiedades' : 'Mostrar panel de propiedades'}
        >
          {isInspectorOpen ? (
            <>
              <PanelRightClose className="w-4 h-4" />
              <span className="hidden md:inline">Ocultar Panel</span>
            </>
          ) : (
            <>
              <PanelRightOpen className="w-4 h-4" />
              <span className="hidden md:inline">Propiedades</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
