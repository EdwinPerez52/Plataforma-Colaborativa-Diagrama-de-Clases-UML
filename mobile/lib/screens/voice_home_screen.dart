import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/outbox_sync_service.dart';
import '../services/connectivity_service.dart';
import '../services/local_voice_parser.dart';
import 'outbox_history_screen.dart';

class VoiceHomeScreen extends StatefulWidget {
  const VoiceHomeScreen({Key? key}) : super(key: key);

  @override
  State<VoiceHomeScreen> createState() => _VoiceHomeScreenState();
}

class _VoiceHomeScreenState extends State<VoiceHomeScreen> with SingleTickerProviderStateMixin {
  bool _isListening = false;
  String _currentSpeechText = '';
  LocalVoiceParseResult? _lastParsedResult;
  late AnimationController _pulseController;

  // Frases de prueba para demostración rápida y examen
  final List<String> _demoVoicePhrases = [
    "Registrar paciente Carlos Mendoza con ci 5482910",
    "Registrar consulta médica para Carlos Mendoza por dolor torácico con costo 180",
    "Registrar paciente María Rodríguez con documento 7392014",
    "Registrar consulta para María Rodríguez por control prenatal con costo 120",
  ];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
      lowerBound: 0.9,
      upperBound: 1.15,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  // Simulación de dictado por voz (Hands-Free)
  void _startListeningSimulated(String text) {
    setState(() {
      _isListening = true;
      _currentSpeechText = 'Escuchando dictado en vivo...';
      _lastParsedResult = null;
    });

    Future.delayed(const Duration(milliseconds: 600), () {
      if (!mounted) return;
      setState(() {
        _currentSpeechText = text;
        _lastParsedResult = LocalVoiceParser.parseSpokenCommand(text);
        _isListening = false;
      });

      // Si se reconoció una transacción, persistir en el Outbox local SQLite
      if (_lastParsedResult?.transaction != null) {
        final syncService = Provider.of<OutboxSyncService>(context, listen: false);
        syncService.enqueueVoiceTransaction(_lastParsedResult!.transaction!);

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF0F172A),
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.amber, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Transacción guardada localmente en SQLite (Outbox: PENDING)',
                    style: const TextStyle(fontSize: 12, color: Colors.white),
                  ),
                ),
              ],
            ),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final syncService = Provider.of<OutboxSyncService>(context);
    final isOnline = syncService.isOnline;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A), // Slate 900
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B), // Slate 800
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: Colors.amber.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.mic, color: Colors.amber, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'CASE Móvil Hands-Free',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                Text(
                  'Offline-First • Outbox Pattern (CU10)',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Conmutador interactivo para simular "Modo Avión" (Criterio de Aceptación)
          Row(
            children: [
              Text(
                isOnline ? 'Online' : 'Avión',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: isOnline ? Colors.emerald : Colors.redAccent,
                ),
              ),
              Switch(
                value: isOnline,
                activeColor: Colors.emerald,
                inactiveThumbColor: Colors.redAccent,
                onChanged: (val) {
                  ConnectivityService.instance.simulateAirplaneMode(!val);
                },
              ),
            ],
          ),
          IconButton(
            icon: Stack(
              children: [
                const Icon(Icons.outbox, color: Colors.white),
                if (syncService.pendingCount > 0)
                  Positioned(
                    right: 0,
                    top: 0,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: const BoxDecoration(
                        color: Colors.amber,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '${syncService.pendingCount}',
                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.black),
                      ),
                    ),
                  ),
              ],
            ),
            tooltip: 'Monitor Outbox',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const OutboxHistoryScreen()),
              );
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            children: [
              // Barra de Estado de Conectividad y Sincronización
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: isOnline
                      ? Colors.emerald.withOpacity(0.12)
                      : Colors.amber.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isOnline
                        ? Colors.emerald.withOpacity(0.4)
                        : Colors.amber.withOpacity(0.4),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isOnline ? Icons.wifi : Icons.airplanemode_active,
                          color: isOnline ? Colors.emerald : Colors.amber,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          isOnline ? 'Conexión Activa (PostgreSQL 17)' : 'Modo Desconectado (Offline Seguro)',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isOnline ? Colors.emerald : Colors.amber,
                          ),
                        ),
                      ],
                    ),
                    if (syncService.isSyncing)
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    else
                      Text(
                        '${syncService.pendingCount} en cola',
                        style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.bold),
                      ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Área Central: Texto de Dictado y Transcripción
              Expanded(
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Transcripción de Voz en Tiempo Real',
                            style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'NLP Local Embebido',
                              style: TextStyle(fontSize: 10, color: Colors.amber, fontFamily: 'monospace'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        _currentSpeechText.isEmpty
                          ? 'Presiona el botón central o selecciona una frase de prueba para dictar sin usar las manos.'
                          : '"$_currentSpeechText"',
                        style: TextStyle(
                          fontSize: 15,
                          color: _currentSpeechText.isEmpty ? Colors.grey : Colors.white,
                          fontStyle: _currentSpeechText.isEmpty ? FontStyle.italic : FontStyle.normal,
                          height: 1.4,
                        ),
                      ),
                      const Spacer(),

                      // Tarjeta de Acción Reconocida
                      if (_lastParsedResult != null)
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.amber.withOpacity(0.3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.check_circle_outline, color: Colors.amber, size: 16),
                                  const SizedBox(width: 6),
                                  Text(
                                    _lastParsedResult!.actionTitle,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.amber,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _lastParsedResult!.description,
                                style: const TextStyle(fontSize: 12, color: Colors.white70),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // Botón Central de Dictado por Voz (Hands-Free)
              Center(
                child: ScaleTransition(
                  scale: _isListening ? _pulseController : const AlwaysStoppedAnimation(1.0),
                  child: GestureDetector(
                    onTap: () {
                      final randomPhrase = _demoVoicePhrases[DateTime.now().millisecond % _demoVoicePhrases.length];
                      _startListeningSimulated(randomPhrase);
                    },
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: _isListening
                              ? [Colors.amber, Colors.orange]
                              : [const Color(0xFF38BDF8), const Color(0xFF0284C7)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: (_isListening ? Colors.amber : Colors.lightBlue).withOpacity(0.4),
                            blurRadius: 20,
                            spreadRadius: 4,
                          ),
                        ],
                      ),
                      child: Icon(
                        _isListening ? Icons.mic : Icons.mic_none,
                        color: Colors.white,
                        size: 36,
                      ),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Frases de Prueba Rápida (Demostración de Examen)
              const Text(
                'Frases Rápidas para Demostración en Modo Avión:',
                style: TextStyle(fontSize: 11, color: Colors.grey),
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 38,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _demoVoicePhrases.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, idx) {
                    final phrase = _demoVoicePhrases[idx];
                    return ActionChip(
                      backgroundColor: const Color(0xFF1E293B),
                      side: const BorderSide(color: Color(0xFF334155)),
                      label: Text(
                        phrase.split(' ')[0] + ' ' + phrase.split(' ')[1] + ' ' + (phrase.split(' ').length > 2 ? phrase.split(' ')[2] : ''),
                        style: const TextStyle(fontSize: 11, color: Colors.white70),
                      ),
                      onPressed: () => _startListeningSimulated(phrase),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
