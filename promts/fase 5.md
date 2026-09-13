# FASE 05: Sincronización WebSockets y Exclusión Mutua Distribuida
**Directiva para el Agente:** Implementación del motor de concurrencia y control de exclusión mutua para 20 ingenieros concurrentes sobre `sesiones_activas` y `bloqueos_nodos`.

---

## 1. Arquitectura de Sincronización Sincrónica
* Canal de comunicación bidireccional WebSockets segmentado por `codigo_sala`[cite: 1, 7].
* Al conectarse un cliente, se valida su JWT y se registra en la tabla `sesiones_activas`[cite: 7].

## 2. Protocolo de Bloqueo por Arrendamiento (Lease: 5 Segundos)
1. **Solicitud (`node:lock:request`):** Al hacer clic o iniciar edición sobre una clase, el cliente envía `claseId`[cite: 7].
   * El servidor valida si existe un registro activo en `bloqueos_nodos` para ese `clase_id` con `expira_en > NOW()`[cite: 7].
   * Si está libre: Inserta el registro en `bloqueos_nodos` con `expira_en = NOW() + INTERVAL '5 seconds'` y difunde `node:locked` a la sala[cite: 7].
   * Si está ocupado por otro usuario: Devuelve `node:lock:denied`[cite: 7].
2. **Latido de Renovación (`node:heartbeat`):** Mientras el modal de edición esté abierto, el cliente emite pulsos cada 2 segundos ejecutando:
   `UPDATE bloqueos_nodos SET expira_en = NOW() + INTERVAL '5 seconds' WHERE clase_id = :id AND usuario_id = :uid`[cite: 7].
3. **Liberación y Actualización (`node:update:release`):** El cliente emite las modificaciones atómicas; el servidor actualiza `uml_clases` / `uml_atributos`, elimina la fila en `bloqueos_nodos` y difunde `node:updated` a los demás participantes[cite: 7].
4. **Recuperación ante Caídas:** Si un ingeniero pierde conexión, el temporizador de 5 segundos expira automáticamente; una rutina en el servidor o Redis elimina el bloqueo y difunde `node:unlocked`[cite: 7].

## 3. Tareas Técnicas para el Agente
1. Programar el servidor WebSocket con gestión de eventos de bloqueo, actualización y liberación.
2. Renderizar retroalimentación visual en el canvas: marcos de color con avatar del ingeniero sobre nodos bloqueados[cite: 7].
3. Diseñar pruebas de concurrencia simultánea con dos clientes compitiendo por el mismo nodo[cite: 7].

## 4. Criterios de Aceptación
* Cero condiciones de carrera: dos ingenieros no pueden editar la misma entidad al mismo tiempo[cite: 7].
* Latencia de propagación entre los 20 participantes inferior a 100 ms[cite: 4, 7].