# FASE 01: Especificación del Problema, Requisitos y Modelo de Casos de Uso
**Metodología:** PUDS (Fase de Inicio / Ciclo 1)  
**Proyecto:** Plataforma Web Colaborativa para el Modelado de Clases UML Asistido por IA y la Generación Automática de Backend Multicapa

---

## 1. Contexto de Negocio y Restricciones
* **Problema:** Licitación nacional de digitalización de salud (historia clínica, citas, telemedicina, triaje con IA) con entrega estricta en 6 meses frente a una estimación técnica de 12 meses para 20 ingenieros sénior.
* **Restricción de Recursos:** Inviabilidad de contratar más personal por la curva de aprendizaje (Ley de Brooks) e imposibilidad de concentrarlos físicamente por sobrecostos y desatención de sedes regionales.
* **Solución CASE:** Herramienta web colaborativa centrada en el diseño conceptual de datos con Diagramas de Clases UML, exclusión mutua semafórica, asistencia por IA y generación de backend en 5 capas.
* **Desafíos Académicos:** Calidad (ISO 25010), Productividad (reducción de 12 a 6 meses) e Innovación (voz, visión y cliente offline)[cite: 4, 7].

## 2. Definición Formal de Actores
* **A1. Ingeniero Diseñador / Anfitrión:** Ingeniero sénior que crea salas de modelado, administra proyectos, coordina el diseño conceptual, importa/exporta modelos y ejecuta la generación de código[cite: 1, 7].
* **A2. Ingeniero Colaborador:** Ingeniero sénior que ingresa a salas compartidas mediante código de invitación para diseñar clases concurrentemente en tiempo real[cite: 1, 7].

## 3. Catálogo Consolidado de Casos de Uso
* **Ciclo #1: Fundación Arquitectónica y Modelado Concurrente**
  * `CU01`: Autenticar usuario y gestionar sesión[cite: 1].
  * `CU02`: Administrar proyectos y salas de trabajo[cite: 1].
  * `CU03`: Unirse a sala de modelado colaborativo[cite: 1, 7].
  * `CU04`: Modelar diagrama de clases colaborativamente (con exclusión mutua).
* **Ciclo #2: Inteligencia Artificial, Interoperabilidad y Generador Backend**
  * `CU05`: Modificar diagrama mediante Asistente de IA (Voz / Texto).
  * `CU06`: Digitalizar boceto físico mediante fotografía[cite: 1, 7].
  * `CU07`: Intercambiar modelo con Enterprise Architect (XMI).
  * `CU08`: Generar y descargar arquitectura backend Spring Boot (5 capas).

## 4. Tareas Técnicas para el Agente
1. Estructurar el espacio de trabajo monorepo: `/frontend` (Lienzo interactivo), `/backend` (API REST y WebSockets), `/ai-service` (FastAPI con NLP y OCR) y `/mobile` (Cliente Flutter)[cite: 7].
2. Configurar el archivo `docker-compose.yml` base con los servicios PostgreSQL 15, Redis 7, Backend y Frontend[cite: 7].
3. Documentar las especificaciones formales de los casos de uso CU01 a CU08 con precondiciones, flujos principales, alternos y excepciones bajo el estándar PUDS[cite: 1, 3].

## 5. Criterios de Aceptación
* Repositorio base configurado con linter y tipado estricto.
* Documento de especificación de requisitos aprobado sin ambigüedades.