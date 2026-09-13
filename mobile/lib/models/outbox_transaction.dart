import 'dart:convert';

class OutboxTransaction {
  final int? id;
  final String transactionUuid;
  final String entityType;
  final String action;
  final String endpoint;
  final String httpMethod;
  final Map<String, dynamic> payload;
  final String syncStatus; // 'PENDING', 'SYNCING', 'SYNCED', 'FAILED'
  final int retryCount;
  final DateTime createdAt;
  final DateTime? syncedAt;
  final String? lastError;
  final String? transcriptVoice;

  OutboxTransaction({
    this.id,
    required this.transactionUuid,
    required this.entityType,
    required this.action,
    required this.endpoint,
    this.httpMethod = 'POST',
    required this.payload,
    this.syncStatus = 'PENDING',
    this.retryCount = 0,
    required this.createdAt,
    this.syncedAt,
    this.lastError,
    this.transcriptVoice,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'transaction_uuid': transactionUuid,
      'entity_type': entityType,
      'action': action,
      'endpoint': endpoint,
      'http_method': httpMethod,
      'payload_json': jsonEncode(payload),
      'sync_status': syncStatus,
      'retry_count': retryCount,
      'created_at': createdAt.toIso8601String(),
      'synced_at': syncedAt?.toIso8601String(),
      'last_error': lastError,
      'transcript_voice': transcriptVoice,
    };
  }

  factory OutboxTransaction.fromMap(Map<String, dynamic> map) {
    return OutboxTransaction(
      id: map['id'] as int?,
      transactionUuid: map['transaction_uuid'] as String,
      entityType: map['entity_type'] as String,
      action: map['action'] as String,
      endpoint: map['endpoint'] as String,
      httpMethod: map['http_method'] as String? ?? 'POST',
      payload: jsonDecode(map['payload_json'] as String) as Map<String, dynamic>,
      syncStatus: map['sync_status'] as String? ?? 'PENDING',
      retryCount: map['retry_count'] as int? ?? 0,
      createdAt: DateTime.parse(map['created_at'] as String),
      syncedAt: map['synced_at'] != null ? DateTime.parse(map['synced_at'] as String) : null,
      lastError: map['last_error'] as String?,
      transcriptVoice: map['transcript_voice'] as String?,
    );
  }

  OutboxTransaction copyWith({
    int? id,
    String? syncStatus,
    int? retryCount,
    DateTime? syncedAt,
    String? lastError,
  }) {
    return OutboxTransaction(
      id: id ?? this.id,
      transactionUuid: transactionUuid,
      entityType: entityType,
      action: action,
      endpoint: endpoint,
      httpMethod: httpMethod,
      payload: payload,
      syncStatus: syncStatus ?? this.syncStatus,
      retryCount: retryCount ?? this.retryCount,
      createdAt: createdAt,
      syncedAt: syncedAt ?? this.syncedAt,
      lastError: lastError ?? this.lastError,
      transcriptVoice: transcriptVoice,
    );
  }
}
