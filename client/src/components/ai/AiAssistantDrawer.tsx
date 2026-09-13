import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  X,
  History,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Radio,
} from 'lucide-react';
import { api } from '../../services/api';

interface AiAssistantDrawerProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onCommandExecuted: () => void;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  projectId,
  isOpen,
  onClose,
  onCommandExecuted,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'prompt' | 'audit'>('prompt');

  // Cargar historial de auditoría
  const loadAudit = async () => {
    try {
      const res = await api.getAiAudit(projectId);
      if (res.success && res.history) {
        setAuditLogs(res.history);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAudit();
    }
  }, [isOpen, projectId]);

  // Manejador de Dictado por Voz (Web Speech API)
  const toggleVoiceRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Tu navegador no soporta Web Speech API. Por favor usa Google Chrome o Microsoft Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-BO'; // Español Bolivia
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechTranscript('Escuchando orden de voz...');
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setSpeechTranscript(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('[WebSpeech] Error:', event.error);
        setIsListening(false);
        setSpeechTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        if (speechTranscript && speechTranscript !== 'Escuchando orden de voz...') {
          handleExecute(speechTranscript, 'VOZ');
        }
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  // Enviar comando para ejecución
  const handleExecute = async (command: string, channel: 'VOZ' | 'TEXTO') => {
    if (!command.trim()) return;
    setLoading(true);
    setFeedback(null);

    try {
      const res = await api.executeAiCommand(projectId, channel, command.trim());
      setFeedback({
        success: res.success,
        message: res.message || 'Comando procesado.',
      });

      if (res.success) {
        setInputText('');
        setSpeechTranscript('');
        onCommandExecuted();
        loadAudit();
      }
    } catch (err: any) {
      setFeedback({
        success: false,
        message: err.message || 'Error al comunicar con el Asistente IA',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900/98 backdrop-blur-xl border-l border-slate-800 z-50 flex flex-col shadow-2xl font-sans text-xs">
      {/* 1. Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
              Asistente IA (CU05)
            </h2>
            <p className="text-[10px] text-emerald-400 font-mono">Voz y Lenguaje Natural</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Pestañas: Prompt vs Auditoría */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold">
        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'prompt'
              ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Comandos / Voz</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('audit');
            loadAudit();
          }}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'audit'
              ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/5'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Auditoría ({auditLogs.length})</span>
        </button>
      </div>

      {/* 3. Contenido de Pestañas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'prompt' && (
          <>
            {/* Widget de Grabación por Voz */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-center space-y-3">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Dictado por Voz en Tiempo Real
              </span>

              <button
                onClick={toggleVoiceRecording}
                className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-105'
                }`}
              >
                {isListening ? <Radio className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>

              <div className="text-[11px] text-slate-400 min-h-[30px] flex items-center justify-center px-2 italic">
                {speechTranscript || (isListening ? 'Hable ahora...' : 'Presione el micrófono para dictar')}
              </div>
            </div>

            {/* Input de Texto */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                O escriba el comando textual:
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleExecute(inputText, 'TEXTO');
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="ej: Crea la clase Medico"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={loading || !inputText.trim()}
                  className="px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg flex items-center justify-center transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Feedback Alert */}
            {feedback && (
              <div
                className={`p-3 rounded-lg border flex items-start gap-2 ${
                  feedback.success
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                }`}
              >
                {feedback.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span className="text-[11px] leading-relaxed">{feedback.message}</span>
              </div>
            )}

            {/* Sugerencias Rápidas */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Órdenes Sugeridas (Haga Clic):
              </span>
              <div className="space-y-1.5">
                {[
                  'Crea la clase Paciente',
                  'Añade a Paciente el atributo direccion tipo string',
                  'Añade a Paciente el atributo ci tipo string como clave primaria',
                  'Añade el método calcularEdad a Paciente que retorna int',
                  'Crea la clase Consulta',
                  'Relaciona Paciente con Consulta de 1 a muchos',
                  'Elimina el atributo obsoleto en HistoriaClinica',
                ].map((sug) => (
                  <button
                    key={sug}
                    onClick={() => handleExecute(sug, 'TEXTO')}
                    className="w-full text-left p-2 rounded bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-emerald-300 transition-colors text-[11px] truncate"
                  >
                    👉 "{sug}"
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Registros en auditoria_comandos_ia
            </span>

            {auditLogs.length === 0 ? (
              <div className="text-center text-slate-500 py-8 italic text-xs">
                No hay órdenes registradas aún.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold font-mono ${
                        log.channel === 'VOZ'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      [{log.channel}]
                    </span>
                    <span
                      className={`font-semibold ${
                        log.success ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {log.success ? '✅ Exitoso' : '❌ Fallido'}
                    </span>
                  </div>

                  <div className="text-slate-200 font-medium text-[11px]">
                    "{log.transcript}"
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                    <span>Intención: {log.intent}</span>
                    <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
