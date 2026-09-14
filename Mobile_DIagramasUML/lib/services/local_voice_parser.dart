import 'package:uuid/uuid.dart';
import '../models/outbox_transaction.dart';

class LocalVoiceParseResult {
  final bool isRecognized;
  final String actionTitle;
  final String description;
  final OutboxTransaction? transaction;
  final String? errorMessage;

  LocalVoiceParseResult({
    required this.isRecognized,
    required this.actionTitle,
    required this.description,
    this.transaction,
    this.errorMessage,
  });
}

class LocalVoiceParser {
  static final _uuid = Uuid();

  /**
   * Parser NLP offline embebido en el dispositivo
   * Extrae intenciones y entidades sin requerir conexión a internet
   */
  static LocalVoiceParseResult parseSpokenCommand(String spokenText) {
    final clean = spokenText.trim().toLowerCase();

    if (clean.isEmpty) {
      return LocalVoiceParseResult(
        isRecognized: false,
        actionTitle: 'Comando no detectado',
        description: 'No se capturó ninguna frase comprensible.',
        errorMessage: 'Dictado vacío',
      );
    }

    // 1. REGISTRAR / CREAR PACIENTE
    if (clean.contains('paciente') && (clean.contains('registrar') || clean.contains('crear') || clean.contains('nuevo') || clean.contains('ingresar'))) {
      String nombre = 'Paciente Sin Nombre';
      String ci = '0000000';

      // Extraer CI si se menciona
      final ciMatch = RegExp(r'(?:ci|c\.i\.|cédula|documento|identidad)\s*(?:es|de|es de|:|)?\s*(\d+)').firstMatch(clean);
      if (ciMatch != null && ciMatch.group(1) != null) {
        ci = ciMatch.group(1)!;
      }

      // Extraer nombre del paciente
      final nombreMatch = RegExp(r'(?:paciente|llamado|nombre)\s+([a-záéíóúñ\s]+?)(?:\s+(?:con|ci|cédula|de|fecha|$))').firstMatch(clean);
      if (nombreMatch != null && nombreMatch.group(1) != null) {
        nombre = _capitalizeWords(nombreMatch.group(1)!.trim());
      } else {
        // Fallback: tomar después de "paciente"
        final pIdx = clean.indexOf('paciente');
        if (pIdx != -1) {
          final sub = clean.substring(pIdx + 8).trim();
          final stopWords = ['con', 'ci', 'cédula'];
          var candidate = sub;
          for (final sw in stopWords) {
            if (candidate.contains(' $sw ')) {
              candidate = candidate.split(' $sw ')[0];
            }
          }
          if (candidate.isNotEmpty) {
            nombre = _capitalizeWords(candidate);
          }
        }
      }

      final payload = {
        'nombreCompleto': nombre,
        'documentoIdentidad': ci,
        'activo': true,
        'fechaNacimiento': '1995-01-01',
      };

      final tx = OutboxTransaction(
        transactionUuid: _uuid.v4(),
        entityType: 'Paciente',
        action: 'CREATE',
        endpoint: '/pacientes',
        httpMethod: 'POST',
        payload: payload,
        syncStatus: 'PENDING',
        createdAt: DateTime.now(),
        transcriptVoice: spokenText,
      );

      return LocalVoiceParseResult(
        isRecognized: true,
        actionTitle: 'Crear Paciente (Modo Offline)',
        description: 'Paciente: $nombre (CI: $ci)',
        transaction: tx,
      );
    }

    // 2. REGISTRAR CONSULTA MÉDICA
    if (clean.contains('consulta') || clean.contains('atención') || clean.contains('diagnóstico') || clean.contains('triage')) {
      String motivo = 'Consulta médica general';
      double costo = 100.0;

      // Extraer costo si se especifica
      final costoMatch = RegExp(r'(?:costo|precio|monto|bs|bolivianos)\s*(?:de|es|:)?\s*(\d+(?:\.\d+)?)').firstMatch(clean);
      if (costoMatch != null && costoMatch.group(1) != null) {
        costo = double.tryParse(costoMatch.group(1)!) ?? 100.0;
      }

      // Extraer motivo o diagnóstico
      final motivoMatch = RegExp(r'(?:por|motivo|diagnóstico|con síntoma|síntoma)\s+([a-záéíóúñ\s]+?)(?:\s+(?:con|costo|precio|fecha|$))').firstMatch(clean);
      if (motivoMatch != null && motivoMatch.group(1) != null) {
        motivo = motivoMatch.group(1)!.trim();
      }

      final payload = {
        'motivo': motivo,
        'costo': costo,
        'fechaHora': DateTime.now().toIso8601String(),
      };

      final tx = OutboxTransaction(
        transactionUuid: _uuid.v4(),
        entityType: 'ConsultaMedica',
        action: 'CREATE',
        endpoint: '/consultas',
        httpMethod: 'POST',
        payload: payload,
        syncStatus: 'PENDING',
        createdAt: DateTime.now(),
        transcriptVoice: spokenText,
      );

      return LocalVoiceParseResult(
        isRecognized: true,
        actionTitle: 'Registrar Consulta Médica',
        description: 'Motivo: $motivo (Costo: Bs. $costo)',
        transaction: tx,
      );
    }

    // 3. GENÉRICO DE REGISTRO
    final genericPayload = {
      'descripcion': spokenText,
      'origen': 'MOBILE_VOICE_HANDS_FREE',
      'fechaHora': DateTime.now().toIso8601String(),
    };

    final tx = OutboxTransaction(
      transactionUuid: _uuid.v4(),
      entityType: 'RegistroOperativo',
      action: 'CREATE',
      endpoint: '/registros',
      httpMethod: 'POST',
      payload: genericPayload,
      syncStatus: 'PENDING',
      createdAt: DateTime.now(),
      transcriptVoice: spokenText,
    );

    return LocalVoiceParseResult(
      isRecognized: true,
      actionTitle: 'Registro Operativo por Voz',
      description: spokenText,
      transaction: tx,
    );
  }

  static String _capitalizeWords(String input) {
    if (input.isEmpty) return '';
    return input.split(' ').map((word) {
      if (word.isEmpty) return '';
      return word[0].toUpperCase() + word.substring(1).toLowerCase();
    }).join(' ');
  }
}
