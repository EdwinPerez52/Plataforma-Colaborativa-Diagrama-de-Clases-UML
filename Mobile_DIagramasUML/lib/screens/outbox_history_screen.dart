import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/outbox_transaction.dart';
import '../database/local_database.dart';
import '../services/outbox_sync_service.dart';

class OutboxHistoryScreen extends StatefulWidget {
  const OutboxHistoryScreen({Key? key}) : super(key: key);

  @override
  State<OutboxHistoryScreen> createState() => _OutboxHistoryScreenState();
}

class _OutboxHistoryScreenState extends State<OutboxHistoryScreen> {
  List<OutboxTransaction> _transactions = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTransactions();
  }

  Future<void> _loadTransactions() async {
    setState(() => _isLoading = true);
    final list = await LocalDatabase.instance.getAllTransactions();
    setState(() {
      _transactions = list;
      _isLoading = false;
    });
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'SYNCED':
        return Colors.emerald;
      case 'SYNCING':
        return Colors.lightBlue;
      case 'FAILED':
        return Colors.redAccent;
      case 'PENDING':
      default:
        return Colors.amber;
    }
  }

  @override
  Widget build(BuildContext context) {
    final syncService = Provider.of<OutboxSyncService>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('Monitor Outbox (SQLite)', style: TextStyle(fontSize: 16)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadTransactions,
          ),
        ],
      ),
      body: Column(
        children: [
          // Banner de Sincronización Manual
          Container(
            padding: const EdgeInsets.all(14),
            color: const Color(0xFF1E293B),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${syncService.pendingCount} Transacciones Pendientes',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white),
                    ),
                    Text(
                      syncService.isOnline ? 'Conexión a Backend Activa' : 'Modo Desconectado',
                      style: TextStyle(
                        fontSize: 11,
                        color: syncService.isOnline ? Colors.emerald : Colors.amber,
                      ),
                    ),
                  ],
                ),
                ElevatedButton.icon(
                  onPressed: syncService.isSyncing
                      ? null
                      : () async {
                          await syncService.syncPendingTransactions();
                          _loadTransactions();
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amber,
                    foregroundColor: Colors.black,
                  ),
                  icon: syncService.isSyncing
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.sync, size: 16),
                  label: const Text('Sincronizar', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),

          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.amber))
                : _transactions.isEmpty
                    ? const Center(
                        child: Text(
                          'No hay transacciones registradas en SQLite.',
                          style: TextStyle(color: Colors.grey, fontSize: 13),
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(12),
                        itemCount: _transactions.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, idx) {
                          final tx = _transactions[idx];
                          final statusColor = _getStatusColor(tx.syncStatus);

                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E293B),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFF334155)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: statusColor.withOpacity(0.2),
                                            borderRadius: BorderRadius.circular(4),
                                            border: Border.all(color: statusColor.withOpacity(0.6)),
                                          ),
                                          child: Text(
                                            tx.syncStatus,
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: statusColor,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          '${tx.httpMethod} ${tx.endpoint}',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                            fontFamily: 'monospace',
                                          ),
                                        ),
                                      ],
                                    ),
                                    Text(
                                      'Reintentos: ${tx.retryCount}',
                                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                if (tx.transcriptVoice != null)
                                  Text(
                                    '"${tx.transcriptVoice}"',
                                    style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.amberAccent),
                                  ),
                                const SizedBox(height: 4),
                                Text(
                                  'Payload: ${tx.payload.toString()}',
                                  style: const TextStyle(fontSize: 11, color: Colors.white70, fontFamily: 'monospace'),
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Creado: ${tx.createdAt.toLocal().toString().split('.')[0]}',
                                      style: const TextStyle(fontSize: 9, color: Colors.grey),
                                    ),
                                    if (tx.syncedAt != null)
                                      Text(
                                        'Sincronizado: ${tx.syncedAt!.toLocal().toString().split('.')[0]}',
                                        style: const TextStyle(fontSize: 9, color: Colors.emerald),
                                      ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
