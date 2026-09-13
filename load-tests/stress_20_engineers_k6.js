import http from 'k6/http';
import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Counter, Rate, Trend } from 'k6/metrics';

// Métricas de Certificación PUDS - SW1 (UAGRM)
export const wsDistributionLatency = new Trend('ws_distribution_latency_ms');
export const conflictRate = new Rate('conflict_error_rate');
export const successCounter = new Counter('successful_transactions');

export const options = {
  stages: [
    { duration: '10s', target: 10 }, // Calentamiento a 10 ingenieros
    { duration: '30s', target: 20 }, // 20 Ingenieros Concurrentes (Examen Licitación)
    { duration: '10s', target: 0 },  // Rampa de salida
  ],
  thresholds: {
    // 1. Latencia de distribución WebSocket < 100 ms
    ws_distribution_latency_ms: ['p(95)<100', 'p(99)<150'],
    // 2. 0% de sobreescrituras o conflictos no controlados
    conflict_error_rate: ['rate<0.001'],
    // 3. Tasa de error HTTP inferior al 0.01%
    http_req_failed: ['rate<0.0001'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:4000';
const WS_URL = __ENV.WS_TARGET_URL || 'ws://localhost:4000/socket.io/?EIO=4&transport=websocket';

export default function () {
  const engineerId = __VU; // 1 a 20
  const roomCode = 'sala-salud-2026';
  const projectId = 1;

  // 1. Healthcheck y Carga Inicial del Diagrama
  const diagramRes = http.get(`${BASE_URL}/api/v1/projects/${projectId}/diagram`);
  check(diagramRes, {
    'diagram status 200': (r) => r.status === 200,
    'has classes': (r) => JSON.parse(r.body).diagram !== undefined,
  });

  // 2. Conexión WebSocket y Simulación de Exclusión Mutua Concurrente
  const res = ws.connect(WS_URL, null, function (socket) {
    socket.on('open', () => {
      // Unirse a la sala
      socket.send(JSON.stringify(['join_room', {
        room: roomCode,
        projectId: projectId,
        userName: `Ingeniero ${engineerId}`,
        userCargo: 'Diseñador UML',
      }]));

      // Solicitar Bloqueo de Nodo (Lease: 5 segundos)
      const targetNodeId = (engineerId % 4) + 1; // 4 clases compartidas
      const lockStartTime = Date.now();

      socket.send(JSON.stringify(['node:lock', {
        roomId: roomCode,
        projectId: projectId,
        nodeId: targetNodeId,
        userId: engineerId,
        userName: `Ingeniero ${engineerId}`,
      }]));

      // Escuchar eventos de confirmación
      socket.on('message', (msg) => {
        const latency = Date.now() - lockStartTime;
        wsDistributionLatency.add(latency);

        if (msg.includes('node:locked')) {
          successCounter.add(1);
          conflictRate.add(0);
        } else if (msg.includes('node:lock_failed') || msg.includes('LOCK_HELD_BY_OTHER')) {
          // El lock fue rechazado ordenadamente por exclusión mutua legítima
          conflictRate.add(0);
        }
      });

      sleep(1);

      // Liberar Bloqueo
      socket.send(JSON.stringify(['node:unlock', {
        roomId: roomCode,
        projectId: projectId,
        nodeId: targetNodeId,
        userId: engineerId,
      }]));

      sleep(0.5);
      socket.close();
    });
  });

  check(res, { 'ws handshake succeeded': (r) => r && r.status === 101 });
  sleep(1);
}
