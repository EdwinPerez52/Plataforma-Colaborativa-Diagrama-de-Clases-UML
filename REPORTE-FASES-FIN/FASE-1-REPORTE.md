# Reporte de Fase 1: Servidor Colaborativo en Tiempo Real y Control de Concurrencia (Exclusión Mutua)

**Fecha:** 8 de Septiembre de 2026  
**Estado:** ✅ **COMPLETADO (100% Tests Aprobados - Cero Errores)**  
**Proyecto:** Software Colaborativo CASE para Ingenieros de Software  

---

## 1. Objetivos Alcanzados en la Fase 1

En esta primera fase se ha desarrollado la infraestructura central del sistema colaborativo, enfocada en la comunicación en tiempo real, el control estricto de concurrencia y la lógica de evolución de esquemas de bases de datos.

### Componentes Implementados:
1. **Servidor HTTP + WebSocket (Node.js, Express, TypeScript, Socket.IO)**:
   - Manejo de salas de trabajo concurrentes (`rooms`).
   - Sincronización bidireccional en tiempo real del estado del diagrama.
   - Seguimiento de presencia de ingenieros colaboradores y cursores remotos con colores identificativos.

2. **Control de Concurrencia y Exclusión Mutua (`LockManager`)**:
   - Garantía de que dos o más ingenieros no colisionen al editar el mismo nodo o entidad conceptual.
   - Adquisición atómica de bloqueo (`acquireLock`).
   - Rechazo inmediato (`lock_denied`) a cualquier usuario que intente editar un nodo ya bloqueado, informándole quién lo tiene en edición y en qué momento fue tomado.
   - Liberación controlada (`releaseLock`) por parte del propietario del lock.
   - **Liberación automática (Heartbeat / Disconnect)**: Si un ingeniero sufre un corte de red o cierra el navegador inesperadamente, el servidor libera automáticamente todos sus locks y notifica a la sala para evitar bloqueos perpetuos ("locks huérfanos").

3. **Evolución Inteligente de Esquemas y Tablas Intermedias N a N (`DiagramManager`)**:
   - Cumplimiento de la regla clave: cuando un usuario o la IA modifica una cardinalidad a **Muchos a Muchos (`*` a `*` o `1..*` a `1..*`)**, el sistema genera o actualiza automáticamente una **Tabla Intermedia / Clase Asociativa** (`NombreA_NombreB`) con:
     - Clave primaria autoincremental (`id: Long`).
     - Clave foránea hacia la Entidad A (`entidad_a_id: Long, isFk: true`).
     - Clave foránea hacia la Entidad B (`entidad_b_id: Long, isFk: true`).
     - Atributo de auditoría (`fecha_registro: LocalDate`).
     - Estereotipo `intermediate_table`.
     - Dos relaciones de composición 1 a N conectando ambas entidades hacia la tabla intermedia.
   - Reversión limpia: Si se vuelve a cambiar la cardinalidad a 1 a N o 1 a 1, la tabla intermedia generada se desacopla o remueve sin corromper el modelo.

4. **Metamodelo Conceptual UML (`types/uml.ts`)**:
   - Definición formal de clases, atributos (con tipos de datos, visibilidad `+ - # ~`, PK, FK, nullabilidad), métodos, relaciones (asociación, agregación, composición, herencia) y cardinalidades (`1`, `0..1`, `1..*`, `*`, `0..*`).

---

## 2. Estructura de Archivos Desarrollados

```text
server/
├── src/
│   ├── types/
│   │   ├── uml.ts                     # Metamodelo UML conceptual
│   │   └── collaboration.ts           # Protocolo de sockets, eventos y locks
│   ├── services/
│   │   ├── LockManager.ts             # Motor de Exclusión Mutua
│   │   ├── DiagramManager.ts          # Gestión de diagramas y reglas N a N
│   │   └── RoomManager.ts             # Orquestación de salas y usuarios
│   ├── sockets/
│   │   └── socketHandler.ts           # Handlers de eventos WebSocket
│   ├── server.ts                      # Servidor Express + Socket.IO
│   └── __tests__/
│       ├── lockManager.test.ts        # Tests de exclusión mutua
│       ├── diagramManager.test.ts     # Tests de evolución y tablas intermedias
│       └── collaborationSocket.test.ts# Tests de integración Socket.IO
├── package.json
├── tsconfig.json
└── dist/                              # Build compilado de TypeScript
```

---

## 3. Resultados del Testing Automatizado

Se ejecutó la suite completa de pruebas utilizando **Vitest** y clientes Socket.IO en memoria:

```bash
> case-collaborative-server@1.0.0 test
> vitest run

 RUN  v3.2.7 C:/Users/jospe/Documents/1er Parcial Sw1/server

 ✓ src/__tests__/lockManager.test.ts (7 tests) 47ms
   - debe permitir que un usuario adquiera el lock sobre un nodo libre
   - debe denegar el lock a un segundo usuario si el nodo ya está bloqueado (Exclusión Mutua)
   - debe permitir renovar el lock al mismo usuario que lo posee
   - debe liberar el lock correctamente cuando el dueño lo solicita
   - no debe permitir que otro usuario libere el lock de un nodo ajeno
   - debe liberar automáticamente todos los locks de un usuario al desconectarse
   - debe expirar el lock cuando transcurre el TTL

 ✓ src/__tests__/diagramManager.test.ts (5 tests) 8ms
   - debe agregar y actualizar clases correctamente
   - debe agregar relación 1 a Muchos sin crear tabla intermedia
   - debe generar automáticamente una tabla intermedia cuando la cardinalidad es N a N (* a *)
   - debe actualizar una relación existente de 1-N a N-N y generar la tabla intermedia dinámicamente
   - debe revertir y eliminar la tabla intermedia si se cambia de N-N de vuelta a 1-N

 ✓ src/__tests__/collaborationSocket.test.ts (5 tests) 151ms
   - debe conectar dos clientes a la misma sala y sincronizar el estado
   - debe permitir que el Ingeniero A bloquee un nodo y denegar el bloqueo al Ingeniero B
   - debe liberar el bloqueo y permitir que el Ingeniero B lo adquiera tras la liberación
   - debe propagar la creación de una clase en tiempo real a todos los clientes
   - debe liberar automáticamente el lock si un usuario se desconecta de imprevisto

 Test Files  3 passed (3)
      Tests  17 passed (17)
   Duration  6.39s
```

### Compilación TypeScript:
```bash
> npm run build
> tsc
# Salida limpia con código de salida 0 (cero errores de compilación).
```

---

## 4. Próxima Fase: Fase 2

Conforme a la instrucción establecida:
> *"si una de las fases del desarrollo no esta terminado o libres de errores al 100% no puedes pasar a la siguiente fase, a no ser que yo te diga, 'pasa a la siguiente fase' entonces ahi puedes pasar a la siguiente fase del desarrollo y ya despues arreglas los errores que dejaste al final."*

La Fase 1 se encuentra **completamente terminada y libre de errores al 100%**.

La **Fase 2** comprenderá:
- **Cliente Web Frontend (React + Vite + TypeScript + TailwindCSS + @xyflow/react)**.
- Lienzo visual interactivo para diagramas de clases UML estilo Enterprise Architect.
- Nodos personalizados con compartimentos de atributos tipados (PK/FK), visibilidad y métodos.
- Conexión directa vía WebSocket al servidor de la Fase 1.
- Visualización de la **Exclusión Mutua** en pantalla (borde de color del usuario que edita y etiqueta *"Editando por [Nombre]"* impidiendo la edición concurrente al otro usuario).
- Cursors y presencia de colaboradores en tiempo real.
