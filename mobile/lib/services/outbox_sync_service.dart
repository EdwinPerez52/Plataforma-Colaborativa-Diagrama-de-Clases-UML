import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../config/api_constants.dart';
import '../database/local_database.dart';
import '../models/outbox_transaction.dart';
import 'connectivity_service.dart';

class OutboxSyncService extends ChangeNotifier {
  final LocalDatabase _db = LocalDatabase.instance;
  final ConnectivityService _connectivity = ConnectivityService.instance;

  bool _isSyncing = false;
  int _pendingCount = 0;
  String? _lastSyncMessage;

  bool get isSyncing => _isSyncing;
  int get pendingCount => _pendingCount;
  String? get lastSyncMessage => _lastSyncMessage;
  bool get isOnline => _connectivity.hasConnection;

  Timer? _periodicTimer;

  OutboxSyncService() {
    _init();
  }

  void _init() {
    refreshPendingCount();

    // Escuchar cambios de conectividad (ej: salida de modo avión)
    _connectivity.connectionStream.listen((hasConnection) {
      notifyListeners();
      if (hasConnection) {
        syncPendingTransactions();
      }
    });

    // Reintento periódico en segundo plano
    _periodicTimer = Timer.periodic(ApiConstants.syncInterval, (_) {
      if (_connectivity.hasConnection && !_isSyncing) {
        syncPendingTransactions();
      }
    });
  }

  Future<void> refreshPendingCount() async {
    _pendingCount = await _db.getPendingCount();
    notifyListeners();
  }

  // Encolar una nueva transacción offline dictada por voz
  Future<int> enqueueVoiceTransaction(OutboxTransaction tx) async {
    final id = await _db.insertTransaction(tx);
    await refreshPendingCount();

    // Si hay conexión inmediata, intentar sincronizar al instante
    if (_connectivity.hasConnection) {
      syncPendingTransactions();
    }
    return id;
  }

  // Sincronizar todas las transacciones pendientes en orden FIFO
  Future<void> syncPendingTransactions() async {
    if (_isSyncing) return;
    if (!_connectivity.hasConnection) {
      _lastSyncMessage = 'Sin conexión. Las transacciones se mantendrán en Outbox.';
      notifyListeners();
      return;
    }

    _isSyncing = true;
    notifyListeners();

    try {
      final pendingList = await _db.getPendingTransactions();
      if (pendingList.isEmpty) {
        _lastSyncMessage = 'Todas las transacciones están sincronizadas.';
        _isSyncing = false;
        notifyListeners();
        return;
      }

      int syncedCount = 0;

      for (final tx in pendingList) {
        // Marcar en proceso
        if (tx.id != null) {
          await _db.markAsSyncing(tx.id!);
        }

        final success = await _dispatchHttpRequest(tx);

        if (success) {
          if (tx.id != null) {
            await _db.markAsSynced(tx.id!, DateTime.now());
          }
          syncedCount++;
        } else {
          // Si falla la conexión de red, abortamos para respetar el orden causal
          if (!_connectivity.hasConnection) {
            break;
          }
        }
      }

      await refreshPendingCount();
      _lastSyncMessage = syncedCount > 0
          ? 'Sincronizadas $syncedCount transacciones exitosamente con PostgreSQL.'
          : 'Reintento completado con transacciones pendientes.';
    } catch (e) {
      _lastSyncMessage = 'Error durante el ciclo de sincronización: $e';
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  // Enviar HTTP hacia Spring Boot o backend Node.js
  Future<bool> _dispatchHttpRequest(OutboxTransaction tx) async {
    try {
      final uri = Uri.parse('${ApiConstants.baseUrlAndroid}${tx.endpoint}');
      final headers = {
        'Content-Type': 'application/json',
        'X-Transaction-UUID': tx.transactionUuid,
        'X-Client-Platform': 'Flutter-Mobile-HandsFree',
      };

      http.Response response;
      if (tx.httpMethod == 'POST') {
        response = await http.post(
          uri,
          headers: headers,
          body: jsonEncode(tx.payload),
        ).timeout(ApiConstants.connectionTimeout);
      } else if (tx.httpMethod == 'PUT') {
        response = await http.put(
          uri,
          headers: headers,
          body: jsonEncode(tx.payload),
        ).timeout(ApiConstants.connectionTimeout);
      } else {
        response = await http.get(uri).timeout(ApiConstants.connectionTimeout);
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return true;
      } else {
        if (tx.id != null) {
          await _db.markAsFailed(tx.id!, 'HTTP ${response.statusCode}: ${response.body}');
        }
        return false;
      }
    } catch (e) {
      if (tx.id != null) {
        await _db.markAsFailed(tx.id!, 'Falla de conexión: $e');
      }
      return false;
    }
  }

  @override
  void dispose() {
    _periodicTimer?.cancel();
    super.dispose();
  }
}
