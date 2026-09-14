import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../server';
import http from 'http';

describe('Fase 10: Cliente Móvil Offline-First con Asistente de Voz y Outbox Pattern', () => {
  const { app } = createServer();
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0);
    const addr = server.address() as any;
    baseUrl = `http://localhost:${addr.port}/api/v1/mobile`;
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  it('1. Debe recibir transacciones individuales del Outbox móvil y confirmar con HTTP 201', async () => {
    const txUuid = 'uuid-tx-paciente-101';
    const res = await fetch(`${baseUrl}/pacientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Transaction-UUID': txUuid,
      },
      body: JSON.stringify({
        nombreCompleto: 'Carlos Mendoza',
        documentoIdentidad: '5482910',
        activo: true,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.transactionUuid).toBe(txUuid);
    expect(json.nombreCompleto).toBe('Carlos Mendoza');
    expect(json.syncedAt).toBeDefined();
  });

  it('2. Debe procesar transacciones de consultas médicas capturadas por voz', async () => {
    const txUuid = 'uuid-tx-consulta-202';
    const res = await fetch(`${baseUrl}/consultas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Transaction-UUID': txUuid,
      },
      body: JSON.stringify({
        motivo: 'dolor torácico agudo',
        costo: 180.0,
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.motivo).toBe('dolor torácico agudo');
    expect(json.costo).toBe(180.0);
  });

  it('3. Debe procesar lotes acumulados durante el Modo Avión (Batch Outbox Synchronization)', async () => {
    const offlineBatch = [
      {
        transactionUuid: 'uuid-offline-1',
        entityType: 'Paciente',
        action: 'CREATE',
        payload: { nombreCompleto: 'María Rodríguez', documentoIdentidad: '7392014' },
      },
      {
        transactionUuid: 'uuid-offline-2',
        entityType: 'ConsultaMedica',
        action: 'CREATE',
        payload: { motivo: 'Control prenatal mensual', costo: 120 },
      },
    ];

    const res = await fetch(`${baseUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: offlineBatch }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.syncedTransactions.length).toBe(2);
    expect(json.syncedTransactions[0].status).toBe('SYNCED');
    expect(json.syncedTransactions[1].status).toBe('SYNCED');
  });
});
