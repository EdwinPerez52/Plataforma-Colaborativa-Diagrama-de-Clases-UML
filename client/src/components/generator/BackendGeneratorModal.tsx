import React, { useState, useEffect } from 'react';
import {
  Zap,
  Download,
  FileCode,
  Folder,
  FolderOpen,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Database,
  Layers,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';

interface BackendGeneratorModalProps {
  isOpen: boolean;
  projectId: number;
  projectTitle: string;
  onClose: () => void;
}

interface GeneratedFileSummary {
  path: string;
  category: string;
  preview: string;
}

export const BackendGeneratorModal: React.FC<BackendGeneratorModalProps> = ({
  isOpen,
  projectId,
  projectTitle,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [generatedResult, setGeneratedResult] = useState<{
    generationId: number;
    versionSpringBoot: string;
    sha256: string;
    zipFileName: string;
    totalFiles: number;
    files: GeneratedFileSummary[];
  } | null>(null);

  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    entity: true,
    repository: true,
    service: true,
    dto: true,
    controller: true,
    config: true,
    root: true,
  });

  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const loadHistory = async () => {
    try {
      const res = await api.getBackendHistory(projectId);
      if (res.success && res.history) {
        setHistory(res.history);
      }
    } catch {
      // Silencioso si no hay historial
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.generateBackend(projectId);
      if (res.success) {
        setGeneratedResult({
          generationId: res.generationId,
          versionSpringBoot: res.versionSpringBoot,
          sha256: res.sha256,
          zipFileName: res.zipFileName,
          totalFiles: res.totalFiles,
          files: res.files,
        });
        setSelectedFileIndex(0);
        setSuccessMessage(`¡Arquitectura de 5 capas generada exitosamente! ${res.totalFiles} archivos creados.`);
        loadHistory();
      } else {
        setError(res.error || 'Error al generar la arquitectura backend');
      }
    } catch (err: any) {
      setError(err.message || 'Error de comunicación con el motor generador');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    try {
      await api.downloadBackendZip(projectId, generatedResult?.zipFileName);
      loadHistory();
    } catch (err: any) {
      setError(err.message || 'Error al descargar archivo ZIP');
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // Agrupar archivos por categoría de capa
  const categoriesMap: Record<string, { title: string; files: { index: number; file: GeneratedFileSummary }[] }> = {
    entity: { title: '1. Entidades JPA (@Entity)', files: [] },
    repository: { title: '2. Repositorios Spring Data (@Repository)', files: [] },
    service: { title: '3. Servicios e Impl (@Service, @Transactional)', files: [] },
    dto: { title: '4. DTOs de Entrada y Salida (Validaciones)', files: [] },
    controller: { title: '5. Controladores RESTful (@RestController)', files: [] },
    config: { title: 'Configuración y Base de Datos (application.properties)', files: [] },
    root: { title: 'Build Maven & Entrada (pom.xml, Application.java)', files: [] },
  };

  if (generatedResult) {
    generatedResult.files.forEach((f, idx) => {
      const cat = f.category || 'root';
      if (categoriesMap[cat]) {
        categoriesMap[cat].files.push({ index: idx, file: f });
      } else {
        categoriesMap.root.files.push({ index: idx, file: f });
      }
    });
  }

  const selectedFile = generatedResult ? generatedResult.files[selectedFileIndex] : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera del Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Generador de Backend Spring Boot en 5 Capas
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono border border-amber-800/60">
                  Spring Boot 3.3.4 (CU08)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Entity • Repository • Service • DTO • Controller • PostgreSQL 17 • Maven ZIP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition-all ${
                isGenerating
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold active:scale-95'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Compilando Capas...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>{generatedResult ? 'Regenerar Backend' : 'Generar Backend (5 Capas)'}</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pestañas de Vista */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-4 pt-2">
          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-2 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'preview'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Explorador de Capas y Archivos ({generatedResult?.totalFiles || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Historial y Auditoría SHA-256 ({history.length})</span>
          </button>
        </div>

        {/* Alertas */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-4 mt-3 p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Contenido Principal */}
        {activeTab === 'preview' && (
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 gap-0">
            {/* Columna Izquierda: Árbol de Directorios y Capas */}
            <div className="md:col-span-4 border-r border-slate-800 bg-slate-950/40 p-3 overflow-y-auto max-h-[460px] space-y-2">
              {!generatedResult ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                  <Zap className="w-8 h-8 mb-2 opacity-30 text-amber-400" />
                  <p>Aún no has generado el backend para este proyecto.</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Haz clic en "Generar Backend (5 Capas)" para crear automáticamente la arquitectura.
                  </p>
                </div>
              ) : (
                Object.entries(categoriesMap).map(([catKey, group]) => {
                  if (group.files.length === 0) return null;
                  const isOpen = openCategories[catKey] !== false;
                  return (
                    <div key={catKey} className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900/40">
                      <button
                        onClick={() => toggleCategory(catKey)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 flex items-center justify-between text-[11px] font-semibold text-slate-300 hover:bg-slate-800/80"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-amber-400" /> : <Folder className="w-3.5 h-3.5 text-amber-400" />}
                          <span className="truncate">{group.title}</span>
                        </span>
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded text-slate-400 font-mono">
                          {group.files.length}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="p-1 space-y-0.5">
                          {group.files.map(({ index, file }) => (
                            <button
                              key={index}
                              onClick={() => setSelectedFileIndex(index)}
                              className={`w-full text-left px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1.5 transition-colors ${
                                selectedFileIndex === index
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                              }`}
                            >
                              <FileCode className="w-3 h-3 shrink-0" />
                              <span className="truncate">{file.path.split('/').pop()}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Columna Derecha: Previsualización de Código */}
            <div className="md:col-span-8 flex flex-col bg-slate-950 overflow-hidden">
              {selectedFile ? (
                <>
                  <div className="p-2.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-amber-300 flex items-center gap-1.5 truncate">
                      <FileCode className="w-3.5 h-3.5 text-amber-400" />
                      {selectedFile.path}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      Capa: {selectedFile.category.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 p-3 overflow-y-auto max-h-[420px] font-mono text-[11px] text-slate-200 select-text">
                    <pre className="whitespace-pre">{selectedFile.preview}</pre>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs p-6 text-center">
                  <p>Selecciona un archivo del árbol para previsualizar el código fuente generado.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pestaña Historial */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 max-h-[460px] space-y-2">
            {history.length === 0 ? (
              <div className="text-center p-8 text-slate-500 text-xs">
                <Clock className="w-8 h-8 mb-2 mx-auto opacity-30" />
                <p>No hay descargas o generaciones registradas para este proyecto.</p>
              </div>
            ) : (
              history.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-400">Spring Boot {item.version_spring_boot}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(item.creado_en).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>SHA-256: {item.hash_sha256}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Generado por: <span className="text-slate-300 font-semibold">{item.usuario_nombre}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">
                      📥 {item.descargas_conteo} descargas
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pie de Página con Botón de Descarga */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
            {generatedResult?.sha256 ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SHA-256 Verificado: {generatedResult.sha256.slice(0, 16)}...</span>
              </span>
            ) : (
              <span>Patrón: Entity • Repository • Service • DTO • Controller</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={handleDownload}
              disabled={!generatedResult || isDownloading}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all ${
                !generatedResult || isDownloading
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 active:scale-95'
              }`}
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Descargando ZIP...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Solución Spring Boot (.zip)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
