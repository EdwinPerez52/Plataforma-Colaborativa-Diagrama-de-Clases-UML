import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/outbox_transaction.dart';

class LocalDatabase {
  static final LocalDatabase instance = LocalDatabase._init();
  static Database? _database;

  LocalDatabase._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('case_mobile_offline.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future _createDB(Database db, int version) async {
    await db.execute('''
      CREATE TABLE outbox_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_uuid TEXT NOT NULL UNIQUE,
        entity_type TEXT NOT NULL,
        action TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        http_method TEXT NOT NULL DEFAULT 'POST',
        payload_json TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        last_error TEXT,
        transcript_voice TEXT
      )
    ''');

    await db.execute('''
      CREATE INDEX idx_outbox_status ON outbox_transactions (sync_status, created_at)
    ''');
  }

  // Insertar una nueva transacción en estado PENDING
  Future<int> insertTransaction(OutboxTransaction tx) async {
    final db = await instance.database;
    return await db.insert(
      'outbox_transactions',
      tx.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Obtener transacciones pendientes de sincronización (FIFO)
  Future<List<OutboxTransaction>> getPendingTransactions() async {
    final db = await instance.database;
    final result = await db.query(
      'outbox_transactions',
      where: 'sync_status = ? OR sync_status = ?',
      whereArgs: ['PENDING', 'FAILED'],
      orderBy: 'created_at ASC',
    );

    return result.map((m) => OutboxTransaction.fromMap(m)).toList();
  }

  // Marcar como sincronizada exitosamente
  Future<int> markAsSynced(int id, DateTime syncedAt) async {
    final db = await instance.database;
    return await db.update(
      'outbox_transactions',
      {
        'sync_status': 'SYNCED',
        'synced_at': syncedAt.toIso8601String(),
        'last_error': null,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // Marcar como fallida e incrementar reintentos
  Future<int> markAsFailed(int id, String errorMessage) async {
    final db = await instance.database;
    return await db.rawUpdate('''
      UPDATE outbox_transactions
      SET sync_status = 'FAILED',
          retry_count = retry_count + 1,
          last_error = ?
      WHERE id = ?
    ''', [errorMessage, id]);
  }

  // Marcar como en proceso
  Future<int> markAsSyncing(int id) async {
    final db = await instance.database;
    return await db.update(
      'outbox_transactions',
      {'sync_status': 'SYNCING'},
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // Obtener todas las transacciones (para el monitor/historial)
  Future<List<OutboxTransaction>> getAllTransactions() async {
    final db = await instance.database;
    final result = await db.query(
      'outbox_transactions',
      orderBy: 'created_at DESC',
    );
    return result.map((m) => OutboxTransaction.fromMap(m)).toList();
  }

  // Conteo de transacciones pendientes
  Future<int> getPendingCount() async {
    final db = await instance.database;
    final count = Sqflite.firstIntValue(await db.rawQuery(
      "SELECT COUNT(*) FROM outbox_transactions WHERE sync_status IN ('PENDING', 'FAILED')"
    ));
    return count ?? 0;
  }

  Future close() async {
    final db = await instance.database;
    db.close();
  }
}
