# FASE 11: Despliegue Cloud en AWS y Pruebas de Carga
**Directiva para el Agente:** Despliegue en producción sobre Amazon Web Services y pruebas de estrés para certificar la concurrencia de los 20 ingenieros.

---

## 1. Arquitectura de Despliegue en la Nube
* **Application Load Balancer (ALB):** Terminación de certificados SSL/TLS con soporte para HTTPS y WebSockets seguros (WSS)[cite: 7].
* **Cómputo (AWS ECS Fargate / EC2):** Contenedores Docker para Frontend, Backend, WebSockets y Microservicio de IA[cite: 7].
* **Persistencia Relacional (Amazon RDS PostgreSQL):** Base de datos Multi-AZ alojando las 13 tablas con copias de seguridad continuas[cite: 7].
* **Gestión de Sesiones (AWS ElastiCache Redis):** Soporte en memoria para candados semafóricos de exclusión mutua[cite: 7].

## 2. Batería de Pruebas de Carga (k6 / Artillery)
* **Escenario:** Simular 20 conexiones simultáneas sobre la misma sala de modelado interactuando sobre las tablas `bloqueos_nodos` y `uml_clases`[cite: 7].
* **Métricas requeridas:**
  * Latencia de distribución WebSocket < 100 ms[cite: 4, 7].
  * 0% de sobreescrituras o conflictos de edición simultánea[cite: 4, 7].
  * Tasa de error HTTP/WSS inferior al 0.01%[cite: 4].

## 3. Tareas Técnicas para el Agente
1. Redactar manifiestos Docker y scripts de despliegue en AWS[cite: 7].
2. Configurar variables de entorno de producción y pools de conexiones HikariCP en PostgreSQL[cite: 7].
3. Ejecutar suite de pruebas de carga y generar informe de rendimiento[cite: 7].

## 4. Criterios de Aceptación
* Plataforma en línea y accesible vía HTTPS/WSS en dominio público de AWS[cite: 7].
* Concurrencia de 20 ingenieros certificada sin degradación del sistema[cite: 7].