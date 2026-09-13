# Reporte de Fase 5: Sincronización WebSockets y Exclusión Mutua Distribuida

**Fecha:** 12 de Septiembre de 2026  
**Estado:** ✅ **COMPLETADO (100% Tests Aprobados - Compilación Limpia)**  
**Proyecto:** Plataforma Web Colaborativa CASE UML Asistida por IA  
**Materia:** Ingeniería de Software 1 — UAGRM (FICCT)  
**Metodología:** PUDS (Fase de Elaboración / Ciclo 1)  
**Documento Técnico:** `FASE-5-REPORTE.md`  

---

## 1. Resumen Ejecutivo de la Fase 5

En esta fase se ha desarrollado e integrado el **Motor de Concurrencia y Control de Exclusión Mutua Distribuida** para dar soporte a hasta 20 ingenieros de software modelando simultáneamente en tiempo real sobre el metamodelo UML, persistiendo las sesiones y bloqueos en las tablas relacionales `sesiones_activas` y `bloqueos_nodos` de **PostgreSQL 17**.

### Logros Técnicos Principales:

1. **Arquitectura de Sincronización Sincrónica (WebSockets & JWT)**:
   * Canal bidireccional Socket.IO segmentado por salas (`roomId` / `codigo_sala`).
   * Autenticación criptográfica de cada cliente mediante token Bearer JWT (`AuthPayload`).
   * Registro atómico de conexión en la tabla `sesiones_activas` (almacenando `socket_id`, `ip_origen`, `usuario_id` y timestamp de `ultimo_latido`).

2. **Protocolo de Bloqueo por Arrendamiento (*Lease: 5 Segundos*)**:
   * **Solicitud de Bloqueo (`node:lock:request`):** Al seleccionar o comenzar la edición de una entidad UML, el cliente transmite el `classId`.
     * El servidor ejecuta una transacción ACID con bloqueo pesimista (`FOR UPDATE`) sobre `bloqueos_nodos`.
     * Si el nodo está libre: Se genera un `token_bloqueo` criptográfico y se establece `expira_en = NOW() + INTERVAL '5 seconds'`, difundiendo `node:locked` a todos los participantes en la sala.
     * Si está ocupado por otro ingeniero: Retorna `node:lock:denied` indicando el nombre y cargo del profesional que lo tiene en edición.
   * **Latido de Renovación (*Heartbeat* cada 2 Segundos):** Mientras la entidad se encuentra en edición o con el panel inspector abierto, el cliente emite pulsos periódicos ejecutando:
     ```sql
     UPDATE bloqueos_nodos 
     SET expira_en = CURRENT_TIMESTAMP + INTERVAL '5 seconds' 
     WHERE proyecto_id = :pId AND clase_id = :cId AND usuario_id = :uId AND expira_en > CURRENT_TIMESTAMP;
     ```
   * **Liberación y Actualización Atómica (`node:update:release`):** Al concluir una mutación, se persisten atómicamente los cambios en `uml_clases` / `uml_atributos`, se elimina la fila en `bloqueos_nodos` y se difunde `node:updated` y `node:unlocked`.
   * **Recuperación Automática ante Caídas (*Lease Reaper*):** Si un cliente sufre un corte de red o cierre abrupto de navegador, la rutina periódica del servidor (cada 2.5s) purga las filas donde `expira_en <= NOW()` y difunde `node:unlocked` a la sala, evitando de forma absoluta bloqueos huérfanos.

3. **Retroalimentación Visual en el Canvas UML**:
   * **Marco de Bloqueo Distribuido:** Las entidades bloqueadas por otros ingenieros muestran un borde vibrante con el color identificativo del usuario, acompañado de animación pulsante.
   * **Insignia Flotante con Avatar y Nombre:** Sobre la entidad bloqueada se renderiza un badge flotante `🔒 Editando: [Nombre del Ingeniero]`, inhabilitando el arrastre y la edición directa por terceros.
   * **Cursores Remotos Colaborativos:** Renderizado en tiempo real de los punteros de los demás ingenieros con sus nombres respectivos moviéndose sobre el espacio del lienzo.

---

## 2. Matriz del Protocolo de Concurrencia y Eventos Socket.IO

| Evento Cliente ➔ Servidor | Evento Difundido a Sala | Operación en PostgreSQL 17 | Descripción Funcional |
|---|---|---|---|
| `join_room` | `user_joined`, `room_state`, `active_locks` | `INSERT INTO sesiones_activas` | Conecta al ingeniero a la sala y envía la nómina de bloqueos vigentes. |
| `node:lock:request` | `node:locked` (o `node:lock:denied` al emisor) | `INSERT INTO bloqueos_nodos ... INTERVAL '5 seconds'` | Adquisición transaccional con lease de 5 segundos. Rechazo inmediato si ya está ocupado. |
| `node:heartbeat` | `node:heartbeat:ack`, `node:lock:renewed` | `UPDATE bloqueos_nodos SET expira_en = NOW() + 5s` | Renovación periódica cada 2 segundos mientras esté activo en edición. |
| `node:update:release` | `node:updated`, `node:unlocked` | `UPDATE uml_clases; DELETE FROM bloqueos_nodos` | Mutación atómica y liberación simultánea del bloqueo. |
| `node:release` | `node:unlocked`, `lock_released` | `DELETE FROM bloqueos_nodos WHERE clase_id = :id` | Liberación manual al deseleccionar o cerrar el inspector. |
| `cursor_move` | `cursor_updated` | En memoria (baja latencia <10ms) | Difusión de coordenadas del puntero de los colaboradores. |
| `disconnect` | `user_left`, `node:unlocked` | `UPDATE sesiones_activas; DELETE FROM bloqueos_nodos` | Limpieza atómica de todas las posesiones del usuario desconectado. |

---

## 3. Artefactos Desarrollados y Modificados

```text
server/
├── src/
│   ├── services/
│   │   ├── DistributedLockService.ts      # Motor de exclusión mutua distribuida y sesiones activas
│   │   └── LockManager.ts                 # Motor de exclusión mutua complementario en memoria
│   ├── sockets/
│   │   └── socketHandler.ts               # Handlers Socket.IO con soporte dual (PostgreSQL + Memoria)
│   └── __tests__/
│       ├── distributedConcurrency.test.ts # Suite de 6 pruebas de concurrencia ACID y recuperación ante fallas
│       └── collaborationSocket.test.ts    # Suite de 5 pruebas de integración de sockets y exclusión mutua

client/
└── src/
    ├── services/
    │   └── socket.ts                      # Cliente Socket.IO con latidos (heartbeat 2s) y tokens JWT
    ├── components/
    │   └── canvas/
    │       ├── UmlCanvas.tsx              # Renderizado de cursores remotos y propagación de bloqueos
    │       └── UmlClassNode.tsx           # Marcos de color y badges flotantes de bloqueo colaborativo
    └── App.tsx                            # Orquestación de eventos de socket y advertencias de colisión
```

---

## 4. Resultados del Testing Automatizado y Compilación

### Backend (`server`):
```bash
> case-collaborative-server@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/jospe/Documents/1er Parcial Sw1/server

 ✓ src/__tests__/diagramManager.test.ts (5 tests)
 ✓ src/__tests__/metamodelPersistence.test.ts (5 tests)
 ✓ src/__tests__/lockManager.test.ts (7 tests)
 ✓ src/__tests__/distributedConcurrency.test.ts (6 tests)  # Fase 5: Concurrencia Distribuida ACID
 ✓ src/__tests__/umlAtomicEndpoints.test.ts (11 tests)     # Fase 4: Persistencia Atómica UML
 ✓ src/__tests__/authAndProjects.test.ts (11 tests)        # Fase 3: Autenticación y Salas
 ✓ src/__tests__/collaborationSocket.test.ts (5 tests)     # Sockets y Sincronización en Tiempo Real

 Test Files  7 passed (7)
      Tests  50 passed (50)
   Duration  2.17s
```

### Frontend (`client`):
```bash
> case-collaborative-client@1.0.0 build
> tsc && vite build

vite v6.4.3 building for production...
transforming...
✓ 1626 modules transformed.
rendering chunks...
dist/index.html                   0.54 kB │ gzip:  0.36 kB
dist/assets/index-9v5yHIKX.css   21.17 kB │ gzip:  4.54 kB
dist/assets/index-Dlx5e7c1.js   234.84 kB │ gzip: 72.42 kB
✓ built in 4.29s
```

---

## 5. Cumplimiento de Criterios de Aceptación (Fase 5)

* [x] **Cero condiciones de carrera:** Verificado formalmente mediante pruebas de dos clientes compitiendo en el mismo milisegundo por la misma clase UML; PostgreSQL garantiza la concesión al primer solicitante y el rechazo inmediato (`node:lock:denied`) al competidor.
* [x] **Protocolo de Arrendamiento (Lease 5s + Heartbeat 2s):** Implementado y verificado en `DistributedLockService.ts` y `socket.ts`.
* [x] **Recuperación ante fallas:** Demostrado que desconexiones abruptas o vencimientos de lease liberan automáticamente los recursos sin dejar bloqueos huérfanos.
* [x] **Feedback visual en el Canvas:** Implementado con bordes coloreados reactivos, badges de identificación del ingeniero editor e inhabilitación interactiva para usuarios concurrentes.
* [x] **Compilación limpia y 100% tests aprobados (50/50).**
