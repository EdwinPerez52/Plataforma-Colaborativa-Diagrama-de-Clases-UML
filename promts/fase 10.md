# FASE 10: Cliente Móvil Offline-First con Asistente de Voz Local en Flutter
**Directiva para el Agente:** Desarrollo de la aplicación móvil de consumo del backend generado, sin formularios tradicionales y con soporte sin conexión.

---

## 1. Requerimientos de la Aplicación Móvil
* Framework: Flutter 3.x (Android / iOS)[cite: 7].
* Interacción por voz (Hands-Free): Diseñada para contextos operativos donde no se utilizan pantallas de captura tradicionales (ej: barbería, triage médico o taller)[cite: 7].
* IA Local en el Dispositivo: Motor de reconocimiento y parsing de voz embebido (modelo reducido que opere 100% desconectado de Internet)[cite: 7].
* Persistencia Local: Base de datos local (SQLite / Isar) para almacenar transacciones en modo desconectado[cite: 7].

## 2. Arquitectura de Sincronización Diferida (Outbox Pattern)
1. El usuario dicta una acción por voz (ej: *"Registrar consulta para el paciente Carlos Mendoza"*); el asistente local extrae la intención y la guarda en la BD local con estado `sync_status = 'PENDING'`[cite: 7].
2. Un observador de conectividad (`connectivity_plus`) detecta el restablecimiento de red Wi-Fi/móvil[cite: 7].
3. El servicio en segundo plano envía las transacciones acumuladas hacia los endpoints REST de Spring Boot generados en la Fase 09[cite: 7].
4. Al recibir confirmación HTTP 200/201, actualiza el estado local a `sync_status = 'SYNCED'`[cite: 7].

## 3. Tareas Técnicas para el Agente
1. Crear el proyecto en `/mobile` estructurado por capas reactivas.
2. Integrar el motor de comandos de voz offline y la interfaz con botón central de dictado[cite: 7].
3. Implementar el motor de sincronización contra los controladores de Spring Boot[cite: 7].

## 4. Criterios de Aceptación
* Dictar transacciones en modo avión; verificar persistencia local y sincronización inmediata al reactivar la conexión[cite: 7].