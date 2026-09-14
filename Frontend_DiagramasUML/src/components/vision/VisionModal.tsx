import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  FileImage,
  CheckCircle,
  AlertTriangle,
  X,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  Key,
  Database,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../services/api';

interface VisionModalProps {
  isOpen: boolean;
  projectId: number;
  onClose: () => void;
  onDiagramUpdated: () => void;
}

interface DetectedAttribute {
  name: string;
  type: string;
  visibility: string;
  isPk: boolean;
}

interface DetectedMethod {
  name: string;
  returnType: string;
  visibility: string;
}

interface DetectedClass {
  name: string;
  stereotype?: string;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  attributes: DetectedAttribute[];
  methods?: DetectedMethod[];
}

interface DetectedRelationship {
  sourceClassName: string;
  targetClassName: string;
  type: string;
  sourceMultiplicity: string;
  targetMultiplicity: string;
}

export const VisionModal: React.FC<VisionModalProps> = ({
  isOpen,
  projectId,
  onClose,
  onDiagramUpdated,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [detectedClasses, setDetectedClasses] = useState<DetectedClass[]>([]);
  const [detectedRelationships, setDetectedRelationships] = useState<DetectedRelationship[]>([]);
  const [pipelineMetrics, setPipelineMetrics] = useState<{
    processedVia?: string;
    otsuBinarization?: boolean;
    contourSegmentation?: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Manejar subida de archivo y conversión a base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setError(null);
      setDetectedClasses([]);
      setDetectedRelationships([]);
      setPipelineMetrics(null);
    };
    reader.readAsDataURL(file);
  };

  // Cargar una imagen de boceto sintética/demostrativa
  const handleLoadSampleSketch = () => {
    // Generar un canvas dataURL con un boceto representativo
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;

      // Clase 1: Medico
      ctx.strokeRect(50, 40, 180, 140);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('Medico', 100, 70);
      ctx.beginPath();
      ctx.moveTo(50, 85);
      ctx.lineTo(230, 85);
      ctx.stroke();
      ctx.font = '11px monospace';
      ctx.fillText('- id: Long [PK]', 60, 110);
      ctx.fillText('- nombre: String', 60, 130);
      ctx.fillText('- matricula: String', 60, 150);

      // Clase 2: Turno
      ctx.strokeRect(360, 40, 180, 140);
      ctx.font = 'bold 14px monospace';
      ctx.fillText('Turno', 420, 70);
      ctx.beginPath();
      ctx.moveTo(360, 85);
      ctx.lineTo(540, 85);
      ctx.stroke();
      ctx.font = '11px monospace';
      ctx.fillText('- id: Long [PK]', 370, 110);
      ctx.fillText('- fechaHora: LocalDateTime', 370, 130);
      ctx.fillText('- estado: String', 370, 150);

      // Línea de relación
      ctx.beginPath();
      ctx.moveTo(230, 110);
      ctx.lineTo(360, 110);
      ctx.stroke();
      ctx.font = '10px monospace';
      ctx.fillText('1..1', 240, 100);
      ctx.fillText('0..*', 330, 100);

      const sampleUrl = canvas.toDataURL('image/png');
      setImagePreview(sampleUrl);
      setError(null);
      setDetectedClasses([]);
      setDetectedRelationships([]);
      setPipelineMetrics(null);
    }
  };

  // Procesar imagen mediante el pipeline de visión
  const handleProcessSketch = async () => {
    if (!imagePreview) {
      setError('Por favor selecciona o carga una fotografía de boceto primero.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await api.processSketch(projectId, imagePreview);
      if (res.success) {
        setDetectedClasses(res.classes || []);
        setDetectedRelationships(res.relationships || []);
        setPipelineMetrics(res.pipelineMetrics || null);
      } else {
        setError(res.error || res.message || 'Error al procesar el boceto.');
      }
    } catch (err: any) {
      setError(err.message || 'Fallo de comunicación con el servicio de visión.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmar e inyectar en PostgreSQL
  const handleConfirmAndInject = async () => {
    if (detectedClasses.length === 0) {
      setError('No hay clases detectadas para inyectar.');
      return;
    }

    setIsInjecting(true);
    setError(null);

    try {
      const res = await api.confirmSketch(projectId, detectedClasses, detectedRelationships);
      if (res.success) {
        setSuccessMessage(
          `¡Éxito! Se crearon ${res.createdClasses?.length || detectedClasses.length} clases y ${
            res.createdRelationships?.length || detectedRelationships.length
          } relaciones en PostgreSQL 17.`
        );
        onDiagramUpdated();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(res.error || 'No se pudo confirmar el diagrama.');
      }
    } catch (err: any) {
      setError(err.message || 'Fallo al persistir el diagrama en la base de datos.');
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera del Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Digitalización de Bocetos a UML
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 font-mono border border-indigo-700/50">
                  CU06 — Fase 07
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Segmentación Otsu + Detección de Rectángulos y Extracción OCR asistida por OpenCV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensajes de Alerta */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-rose-950/50 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-4 mt-4 p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Cuerpo del Modal con Doble Columna */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Columna Izquierda: Carga de Imagen y Vista Previa */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileImage className="w-3.5 h-3.5 text-indigo-400" /> Fotografía del Boceto
              </span>
              <button
                type="button"
                onClick={handleLoadSampleSketch}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Cargar Boceto de Ejemplo
              </button>
            </div>

            {/* Zona Dropzone / Preview */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500/70 bg-slate-950/40 rounded-xl p-4 flex flex-col items-center justify-center min-h-[220px] max-h-[260px] cursor-pointer transition-colors relative overflow-hidden group"
            >
              {imagePreview ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Boceto cargado"
                    className="max-h-[220px] max-w-full object-contain rounded-lg shadow"
                  />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-xs font-medium text-white">
                    <Upload className="w-4 h-4" /> Cambiar Fotografía
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-200">
                    Haz clic para subir foto de libreta o pizarra
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">Soporta PNG, JPG o WEBP (máx. 10MB)</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Botón de Ejecutar Análisis de Visión */}
            <button
              onClick={handleProcessSketch}
              disabled={!imagePreview || isProcessing}
              className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                !imagePreview || isProcessing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white active:scale-98'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-200" />
                  <span>Procesando Contornos y OCR con OpenCV...</span>
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  <span>Analizar y Reconocer Boceto</span>
                </>
              )}
            </button>

            {/* Métricas de Pipeline OpenCV */}
            {pipelineMetrics && (
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Motor de Procesamiento:</span>
                  <span className="text-indigo-400 font-bold">{pipelineMetrics.processedVia}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Binarización Otsu:</span>
                  <span className="text-emerald-400">
                    {pipelineMetrics.otsuBinarization ? 'APLICADA ✓' : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Segmentación de Contornos:</span>
                  <span className="text-emerald-400">
                    {pipelineMetrics.contourSegmentation ? 'DETECTADOS ✓' : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Previsualización de Entidades y Relaciones Detectadas */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" /> Clases y Atributos Detectados (
              {detectedClasses.length})
            </span>

            <div className="flex-1 border border-slate-800 bg-slate-950/60 rounded-xl p-3 overflow-y-auto max-h-[320px] space-y-3">
              {detectedClasses.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                  <Layers className="w-8 h-8 mb-2 opacity-30" />
                  <p>Aún no se ha realizado el análisis.</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Carga una imagen y presiona "Analizar y Reconocer Boceto".
                  </p>
                </div>
              ) : (
                <>
                  {detectedClasses.map((cls, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold border border-emerald-800/40">
                            class
                          </span>
                          <span className="font-bold text-xs text-slate-100">{cls.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({cls.position?.x || 100}, {cls.position?.y || 100})
                        </span>
                      </div>

                      {/* Atributos */}
                      <div className="space-y-1">
                        {cls.attributes?.map((attr, aIdx) => (
                          <div
                            key={aIdx}
                            className="flex items-center justify-between text-[11px] font-mono bg-slate-950/60 px-2 py-1 rounded"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500">{attr.visibility || '-'}</span>
                              <span className="text-slate-200">{attr.name}</span>
                              {attr.isPk && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] px-1 bg-amber-950 text-amber-400 border border-amber-800/50 rounded font-bold">
                                  <Key className="w-2.5 h-2.5" /> PK
                                </span>
                              )}
                            </div>
                            <span className="text-indigo-400 font-semibold">{attr.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Relaciones si existen */}
                  {detectedRelationships.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <span className="text-[11px] font-semibold text-slate-400 mb-1 block">
                        Relaciones Detectadas ({detectedRelationships.length}):
                      </span>
                      <div className="space-y-1">
                        {detectedRelationships.map((rel, rIdx) => (
                          <div
                            key={rIdx}
                            className="text-[10px] font-mono bg-slate-900 border border-slate-800 px-2 py-1 rounded flex items-center justify-between"
                          >
                            <span className="text-slate-300 font-bold">{rel.sourceClassName}</span>
                            <span className="text-slate-500 flex items-center gap-1">
                              <span>{rel.sourceMultiplicity || '1..1'}</span>
                              <ArrowRight className="w-3 h-3 text-indigo-400" />
                              <span>{rel.targetMultiplicity || '0..*'}</span>
                            </span>
                            <span className="text-slate-300 font-bold">{rel.targetClassName}</span>
                            <span className="text-emerald-400 text-[9px] uppercase px-1 rounded bg-emerald-950/40">
                              {rel.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pie de Página con Botones de Confirmación */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>Destino: PostgreSQL 17 (`uml_clases` & `uml_atributos`)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmAndInject}
              disabled={detectedClasses.length === 0 || isInjecting}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-all ${
                detectedClasses.length === 0 || isInjecting
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
            >
              {isInjecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Persistiendo en PostgreSQL...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Confirmar e Inyectar en Lienzo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
