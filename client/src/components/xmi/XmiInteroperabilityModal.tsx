import React, { useState, useEffect, useRef } from 'react';
import {
  FileCode,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  X,
  Copy,
  Check,
  RefreshCw,
  Database,
  Layers,
  ArrowRight,
  Sparkles,
  FileText,
} from 'lucide-react';
import { api } from '../../services/api';

interface XmiModalProps {
  isOpen: boolean;
  projectId: number;
  projectTitle: string;
  onClose: () => void;
  onDiagramUpdated: () => void;
}

export const XmiInteroperabilityModal: React.FC<XmiModalProps> = ({
  isOpen,
  projectId,
  projectTitle,
  onClose,
  onDiagramUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // Estado para Exportación
  const [exportedXml, setExportedXml] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Estado para Importación
  const [importXmlContent, setImportXmlContent] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('merge');
  const [validationResult, setValidationResult] = useState<any | null>(null);

  // Mensajes de Feedback
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar XML al abrir pestaña de exportación
  useEffect(() => {
    if (isOpen && activeTab === 'export') {
      handleFetchExportXml();
    }
  }, [isOpen, activeTab, projectId]);

  if (!isOpen) return null;

  const handleFetchExportXml = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const xml = await api.exportXmi(projectId);
      setExportedXml(xml);
    } catch (err: any) {
      setError(err.message || 'Error al exportar esquema XMI');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadFile = () => {
    if (!exportedXml) return;
    const blob = new Blob([exportedXml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagrama-${projectTitle.toLowerCase().replace(/\s+/g, '-')}-ea.xmi`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyXml = () => {
    if (!exportedXml) return;
    navigator.clipboard.writeText(exportedXml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Manejar archivo subido para importar
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setImportXmlContent(text);
      await validateXmlContent(text);
    };
    reader.readAsText(file);
  };

  // Cargar XML de muestra de Enterprise Architect
  const handleLoadSampleEaXml = async () => {
    const sample = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1">
  <xmi:Documentation exporter="Enterprise Architect" exporterVersion="6.5"/>
  <uml:Model xmi:type="uml:Model" xmi:id="EA_MODEL_1" name="ModeloClinicoEA">
    <packagedElement xmi:type="uml:Class" xmi:id="EAID_MEDICO" name="MedicoEspecialista" isAbstract="false">
      <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_M_ID" name="id" visibility="private" isID="true">
        <type xmi:type="uml:PrimitiveType" href="#Long"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_M_NOM" name="nombre" visibility="private">
        <type xmi:type="uml:PrimitiveType" href="#String"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_M_ESP" name="especialidad" visibility="public">
        <type xmi:type="uml:PrimitiveType" href="#String"/>
      </ownedAttribute>
      <ownedOperation xmi:type="uml:Operation" xmi:id="EAID_M_OP1" name="programarCirugia" visibility="public">
        <ownedParameter direction="return">
          <type xmi:type="uml:PrimitiveType" href="#Boolean"/>
        </ownedParameter>
      </ownedOperation>
    </packagedElement>

    <packagedElement xmi:type="uml:Class" xmi:id="EAID_QUIROFANO" name="Quirofano" isAbstract="false">
      <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_Q_ID" name="id" visibility="private" isID="true">
        <type xmi:type="uml:PrimitiveType" href="#Long"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_Q_NUM" name="numeroSala" visibility="private">
        <type xmi:type="uml:PrimitiveType" href="#Integer"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_Q_EST" name="disponible" visibility="private">
        <type xmi:type="uml:PrimitiveType" href="#Boolean"/>
      </ownedAttribute>
    </packagedElement>

    <packagedElement xmi:type="uml:Association" xmi:id="EAID_AS_MED_QUI" name="operaEn">
      <memberEnd xmi:idref="END_1"/>
      <memberEnd xmi:idref="END_2"/>
      <ownedEnd xmi:id="END_1" type="EAID_MEDICO" aggregation="none">
        <lowerValue value="1"/>
        <upperValue value="*"/>
      </ownedEnd>
      <ownedEnd xmi:id="END_2" type="EAID_QUIROFANO" aggregation="none">
        <lowerValue value="1"/>
        <upperValue value="1"/>
      </ownedEnd>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;

    setImportXmlContent(sample);
    await validateXmlContent(sample);
  };

  const validateXmlContent = async (xml: string) => {
    setIsValidating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.validateXmi(xml);
      if (res.success && res.validation) {
        setValidationResult(res.validation);
      } else {
        setError(res.error || 'El archivo XMI no cumple con el esquema OMG UML 2.1 / EA');
        setValidationResult(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error al validar contenido XMI');
      setValidationResult(null);
    } finally {
      setIsValidating(false);
    }
  };

  // Ejecutar Importación en PostgreSQL
  const handleExecuteImport = async () => {
    if (!importXmlContent || !validationResult?.isValid) {
      setError('Por favor valida un archivo XMI válido antes de importar.');
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      const res = await api.importXmi(projectId, importXmlContent, importMode);
      if (res.success) {
        setSuccessMessage(res.message);
        onDiagramUpdated();
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setError(res.error || 'Error al importar esquema XMI');
      }
    } catch (err: any) {
      setError(err.message || 'Error durante la persistencia transaccional');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera del Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Interoperabilidad Enterprise Architect
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono border border-cyan-800/60">
                  XMI 2.1 / UML 2.5 (CU07)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Exportación e importación estandarizada OMG UML 2.1 compatible con Sparx EA
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

        {/* Selector de Pestañas */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-4 pt-2">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'export'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar a Enterprise Architect (.xmi)</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'import'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar desde Enterprise Architect</span>
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

        {/* Contenido Pestaña 1: EXPORTACIÓN */}
        {activeTab === 'export' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-200">
                  Documento XMI 2.1 Generado para Sparx Enterprise Architect
                </span>
                <p className="text-[11px] text-slate-400">
                  Incluye elementos <code className="text-cyan-300">&lt;uml:Class&gt;</code>, atributos con clave primaria <code className="text-cyan-300">isID="true"</code>, generalizaciones y extensión de geometría.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyXml}
                  disabled={!exportedXml || isExporting}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copied ? 'Copiado' : 'Copiar XML'}</span>
                </button>
                <button
                  onClick={handleDownloadFile}
                  disabled={!exportedXml || isExporting}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Archivo .xmi</span>
                </button>
              </div>
            </div>

            {/* Visor de Código XML */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-cyan-200 overflow-x-auto max-h-[380px] shadow-inner select-text">
              {isExporting ? (
                <div className="h-full flex items-center justify-center text-slate-500 gap-2 py-12">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Generando documento XML compatible con Enterprise Architect...</span>
                </div>
              ) : (
                <pre className="whitespace-pre">{exportedXml}</pre>
              )}
            </div>
          </div>
        )}

        {/* Contenido Pestaña 2: IMPORTACIÓN */}
        {activeTab === 'import' && (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna Izquierda: Carga y Opciones de Modo */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" /> Archivo XMI / XML de EA
                </span>
                <button
                  type="button"
                  onClick={handleLoadSampleEaXml}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Cargar XMI de Ejemplo (EA 6.5)
                </button>
              </div>

              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500/70 bg-slate-950/40 rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] cursor-pointer transition-colors text-center"
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  Seleccionar archivo .xmi o .xml de Enterprise Architect
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Formato XMI 2.1 / UML 2.1 - 2.5</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xmi,.xml"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Modo de Inserción */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                <span className="text-[11px] font-bold text-slate-300 block">
                  Estrategia de Inserción en PostgreSQL 17:
                </span>
                <div className="flex flex-col gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-cyan-500 focus:ring-cyan-400"
                    />
                    <span>
                      <strong className="text-slate-200">Combinar (Merge):</strong> Agrega las nuevas clases manteniendo las existentes.
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="importMode"
                      value="overwrite"
                      checked={importMode === 'overwrite'}
                      onChange={() => setImportMode('overwrite')}
                      className="text-rose-500 focus:ring-rose-400"
                    />
                    <span>
                      <strong className="text-rose-300">Sobrescribir (Overwrite):</strong> Limpia el diagrama actual y carga exclusivamente el archivo XMI.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Resumen de Validación y Clases Detectadas */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" /> Resumen de Validación del Modelo
              </span>

              <div className="flex-1 border border-slate-800 bg-slate-950/60 rounded-xl p-3 overflow-y-auto max-h-[300px] space-y-2">
                {isValidating ? (
                  <div className="h-full flex items-center justify-center text-slate-500 gap-2 py-8 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>Validando estructura XMI 2.1...</span>
                  </div>
                ) : validationResult ? (
                  <>
                    {/* Tarjeta de Métricas */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="bg-slate-900 border border-slate-800 p-2 rounded text-center">
                        <span className="text-[10px] text-slate-400 block">Clases</span>
                        <span className="font-bold text-cyan-400 text-sm">
                          {validationResult.summary?.classesCount || 0}
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-2 rounded text-center">
                        <span className="text-[10px] text-slate-400 block">Atributos</span>
                        <span className="font-bold text-emerald-400 text-sm">
                          {validationResult.summary?.attributesCount || 0}
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-2 rounded text-center">
                        <span className="text-[10px] text-slate-400 block">Métodos</span>
                        <span className="font-bold text-purple-400 text-sm">
                          {validationResult.summary?.methodsCount || 0}
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-2 rounded text-center">
                        <span className="text-[10px] text-slate-400 block">Relaciones</span>
                        <span className="font-bold text-amber-400 text-sm">
                          {validationResult.summary?.relationshipsCount || 0}
                        </span>
                      </div>
                    </div>

                    {/* Lista de Clases a Importar */}
                    {validationResult.classes?.map((cls: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-900 border border-slate-800 rounded p-2 text-xs"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
                          <span className="font-bold text-slate-100">{cls.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {cls.attributes.length} attrs, {cls.methods.length} ops
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {cls.attributes.map((a: any, aIdx: number) => (
                            <div
                              key={aIdx}
                              className="text-[10px] font-mono text-slate-400 flex items-center justify-between"
                            >
                              <span>
                                {a.visibility} {a.name}
                                {a.isPk && <span className="text-amber-400 font-bold ml-1">[PK]</span>}
                              </span>
                              <span className="text-cyan-400">{a.type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                    <FileCode className="w-8 h-8 mb-2 opacity-30" />
                    <p>No hay archivo XMI cargado.</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Sube un archivo o presiona "Cargar XMI de Ejemplo".
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pie de Página */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>Motor: PostgreSQL 17 (`uml_clases`, `uml_atributos`, `uml_relaciones`)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            {activeTab === 'import' && (
              <button
                onClick={handleExecuteImport}
                disabled={!validationResult?.isValid || isImporting}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-all ${
                  !validationResult?.isValid || isImporting
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white active:scale-95'
                }`}
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importando a PostgreSQL...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Confirmar e Importar a Diagrama</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
