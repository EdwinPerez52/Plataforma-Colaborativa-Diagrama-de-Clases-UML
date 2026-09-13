# Reporte de Fase 3: Autenticación Segura, Control de Acceso y Gestión de Salas de Modelado (CU01, CU02, CU03)

**Fecha:** 9 de Septiembre de 2026  
**Estado:** ✅ **COMPLETADO (100% Tests Aprobados - Compilación Limpia)**  
**Proyecto:** Plataforma Web Colaborativa CASE UML Asistida por IA  
**Materia:** Ingeniería de Software 1 — UAGRM (FICCT)  
**Metodología:** PUDS (Fase de Elaboración / Ciclo 1)  
**Documento Técnico:** `FASE-3-REPORTE.md`  

---

## 1. Resumen Ejecutivo de la Fase 3

En esta fase se ha implementado la capa completa de seguridad, gestión de identidades y administración de salas de modelado colaborativo, garantizando el control de acceso para los 20 ingenieros de software concurrentes sobre el esquema de PostgreSQL.

Se han cubierto al 100% los siguientes tres casos de uso fundamentales:
1. **`CU01: Autenticar usuario y gestionar sesión`**: Registro seguro de credenciales con hashing unidireccional `bcrypt` (salt factor 10), inicio de sesión con expedición de tokens criptográficos `JWT` (vencimiento de 24 horas), verificación estricta del estado de cuenta (`ACTIVO`, `INACTIVO`, `BLOQUEADO`) y recuperación de perfil autenticado.
2. **`CU02: Administrar proyectos y salas de trabajo`**: Creación transaccional de salas con generación de identificadores públicos **UUID v4** (`codigo_sala`), asignación atómica del creador como `ANFITRION`, listado de proyectos con volumetría de miembros y control de permisos exclusivos de anfitrión para modificar o archivar el proyecto.
3. **`CU03: Unirse a sala de modelado colaborativo`**: Validación de códigos de invitación de sala, asignación de roles de colaboración (`EDITOR` u `OBSERVADOR`), prevención de duplicidad de membresía (*idempotencia*) y exposición de la nómina de colaboradores.

---

## 2. Casos de Uso Implementados y Verificados

| Caso de Uso | Método / Endpoint | Descripción Funcional | Estado |
|---|---|---|:---:|
| **CU01** | `POST /api/v1/auth/register` | Registro de ingeniero con validación de email único y password hasheado con bcrypt. | ✅ Aprobado |
| **CU01** | `POST /api/v1/auth/login` | Validación de credenciales, control de cuenta bloqueada y expedición de JWT. | ✅ Aprobado |
| **CU01** | `GET /api/v1/auth/me` | Inspección de identidad y cargo del usuario autenticado vía token Bearer. | ✅ Aprobado |
| **CU02** | `POST /api/v1/projects` | Creación de proyecto con código de sala UUID v4 y registro del anfitrión. | ✅ Aprobado |
| **CU02** | `GET /api/v1/projects` | Consulta de salas y proyectos a los que pertenece el ingeniero con roles y conteo. | ✅ Aprobado |
| **CU02** | `GET /api/v1/projects/:id` | Detalle del proyecto por ID numérico o código UUID v4 de sala compartida. | ✅ Aprobado |
| **CU02** | `PUT /api/v1/projects/:id` | Modificación del proyecto (Título, Descripción, Estado) reservada al anfitrión. | ✅ Aprobado |
| **CU02** | `DELETE /api/v1/projects/:id` | Eliminación del proyecto con borrado en cascada (`CASCADE`) de clases y miembros. | ✅ Aprobado |
| **CU03** | `POST /api/v1/projects/join` | Incorporación de un ingeniero colaborador mediante `codigo_sala` y rol asignado. | ✅ Aprobado |

---

## 3. Artefactos Desarrollados

```text
server/
├── src/
│   ├── types/
│   │   └── auth.ts                     # Interfaces de Usuario, Proyecto, Roles y DTOs
│   ├── middleware/
│   │   └── authMiddleware.ts           # Middleware Express de validación Bearer JWT
│   ├── services/
│   │   ├── AuthService.ts              # Lógica de CU01 (bcrypt + JWT + control de estado)
│   │   └── ProjectService.ts           # Lógica de CU02 y CU03 (UUID v4 + Membresías transaccionales)
│   ├── controllers/
│   │   ├── authController.ts           # Controladores HTTP de autenticación
│   │   └── projectController.ts        # Controladores HTTP de proyectos y salas
│   ├── routes/
│   │   ├── authRoutes.ts               # Router Express para /api/v1/auth
│   │   └── projectRoutes.ts            # Router Express para /api/v1/projects
│   ├── config/
│   │   └── database.ts                 # Configuración de Pool con type parser para BIGINT
│   ├── server.ts                       # Montaje de endpoints REST v1
│   └── __tests__/
│       └── authAndProjects.test.ts     # Suite de 11 tests unitarios y de integración de Fase 3
```

---

## 4. Resultados de Pruebas Automatizadas

Se ejecutó la suite completa de pruebas de regresión e integración con Vitest:

```bash
> case-collaborative-server@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/jospe/Documents/1er Parcial Sw1/server

 ✓ src/__tests__/lockManager.test.ts (7 tests)
 ✓ src/__tests__/diagramManager.test.ts (5 tests)
 ✓ src/__tests__/metamodelPersistence.test.ts (5 tests)
 ✓ src/__tests__/collaborationSocket.test.ts (5 tests)
 ✓ src/__tests__/authAndProjects.test.ts (11 tests)
   - CU01: debe registrar un nuevo usuario con contraseña hasheada y retornar token JWT
   - CU01: debe rechazar el registro de un email duplicado con error 409
   - CU01: debe permitir iniciar sesión con credenciales correctas y expedir nuevo JWT
   - CU01: debe rechazar credenciales con contraseña incorrecta (401)
   - CU01: debe bloquear el acceso si el estado de cuenta no es ACTIVO (403)
   - CU02: debe crear un proyecto, generar UUID v4 de sala y asignar rol ANFITRION al creador
   - CU02: debe listar los proyectos del usuario incluyendo su rol y conteo de miembros
   - CU02: debe obtener detalles del proyecto por su código de sala UUID v4
   - CU03: debe registrar a un segundo usuario y permitirle unirse a la sala con rol EDITOR
   - CU03: debe manejar membresía repetida de forma idempotente sin error de clave duplicada
   - CU03: solo el ANFITRION puede actualizar o archivar el proyecto

 Test Files  5 passed (5)
      Tests  33 passed (33)
   Duration  1.44s
```

Compilación TypeScript: **`tsc` exitosa con cero errores.**
Persistencia en base de datos: **Operando directamente sobre PostgreSQL 17 local (`case_collaborative_db`).**
