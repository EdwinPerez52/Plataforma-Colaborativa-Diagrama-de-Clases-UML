import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT || '5432', 10);
const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASSWORD || 'postgres';
const dbName = process.env.DB_NAME || 'case_collaborative_db';

export async function ensureDatabaseExists(): Promise<void> {
  const adminClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres', // Conectamos a la BD por defecto para verificar/crear la BD destino
  });

  try {
    await adminClient.connect();
    const checkRes = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (checkRes.rowCount === 0) {
      console.log(`[Migrador] Creando base de datos '${dbName}'...`);
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[Migrador] Base de datos '${dbName}' creada con éxito.`);
    } else {
      console.log(`[Migrador] Base de datos '${dbName}' ya existe.`);
    }
  } catch (err: any) {
    console.error(`[Migrador] Error al verificar/crear base de datos: ${err.message}`);
    throw err;
  } finally {
    await adminClient.end();
  }
}

export async function runMigrations(): Promise<void> {
  await ensureDatabaseExists();

  const targetClient = new Client({
    host,
    port,
    user,
    password,
    database: dbName,
  });

  try {
    await targetClient.connect();
    console.log(`[Migrador] Conectado a '${dbName}'. Ejecutando scripts DDL...`);

    const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      console.log(`[Migrador] Aplicando migración: ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf-8');
      await targetClient.query(sql);
      console.log(`[Migrador] Migración '${file}' aplicada correctamente.`);
    }

    // Listar las tablas creadas
    const tablesRes = await targetClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`[Migrador] ✅ Migración completada. Tablas verificadas (${tablesRes.rowCount}):`);
    tablesRes.rows.forEach(r => console.log(`   - ${r.table_name}`));

  } catch (err: any) {
    console.error(`[Migrador] Error ejecutando migraciones: ${err.message}`);
    throw err;
  } finally {
    await targetClient.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[Migrador] Proceso finalizado.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migrador] Fallo en migración:', err);
      process.exit(1);
    });
}
