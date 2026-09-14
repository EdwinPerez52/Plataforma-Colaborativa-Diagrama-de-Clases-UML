import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Parsear automáticamente BIGINT (OID 20) de PostgreSQL como number de JavaScript
types.setTypeParser(20, (val: string) => parseInt(val, 10));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'case_collaborative_db',
  max: 20, // Cobertura de pool para los 20 ingenieros concurrentes
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
};

export const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('[PostgreSQL] Error inesperado en el pool de conexiones:', err.message);
});

export const db = {
  /**
   * Ejecuta una consulta directa sobre el pool
   */
  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return pool.query<T>(text, params);
  },

  /**
   * Obtiene un cliente del pool para transacciones atómicas
   */
  async getClient(): Promise<PoolClient> {
    return pool.connect();
  },

  /**
   * Ejecuta una función dentro de una transacción atómica (BEGIN/COMMIT/ROLLBACK)
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Prueba el estado de conexión con la base de datos
   */
  async testConnection(): Promise<boolean> {
    try {
      const res = await pool.query('SELECT NOW() AS now, current_database() AS db');
      console.log(`[PostgreSQL] Conexión establecida con éxito a BD: ${res.rows[0].db}`);
      return true;
    } catch (err: any) {
      console.warn(`[PostgreSQL] No se pudo conectar a PostgreSQL (${err.message}). Verifique sus credenciales en .env.`);
      return false;
    }
  },

  /**
   * Cierra el pool ordenadamente
   */
  async close(): Promise<void> {
    await pool.end();
  }
};
