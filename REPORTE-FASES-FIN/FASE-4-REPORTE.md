# Reporte de Fase 4: Motor Gráfico del Lienzo UML Interactivo (CU04)

**Fecha:** 12 de Septiembre de 2026  
**Estado:** ✅ **COMPLETADO (100% Tests Aprobados - Compilación Limpia)**  
**Proyecto:** Plataforma Web Colaborativa CASE UML Asistida por IA  
**Materia:** Ingeniería de Software 1 — UAGRM (FICCT)  
**Metodología:** PUDS (Fase de Elaboración / Ciclo 1)  
**Documento Técnico:** `FASE-4-REPORTE.md`  

---

## 1. Resumen Ejecutivo de la Fase 4

En esta fase se ha desarrollado e integrado el **Motor Gráfico del Lienzo UML Interactivo** en el frontend web (`client/`) y la capa de **Endpoints REST Atómicos** en el backend (`server/`), permitiendo el modelado visual en tiempo real de diagramas de clases según la especificación formal **UML 2.5** con persistencia atómica en las tablas normalizadas de PostgreSQL (`uml_clases`, `uml_atributos`, `uml_metodos`, `uml_relaciones`).

### Logros Técnicos Principales:
1. **Lienzo Reactivo (Canvas / SVG)**:
   * **Zoom Infinito:** Escalado suave centrado dinámicamente en la posición del puntero del mouse (rango 20% a 300%).
   * **Paneo Infinito:** Desplazamiento multidireccional fluido arrastrando el fondo del lienzo con botón principal o central.
   * **Ajuste a Rejilla (*Grid Snapping*):** Rejilla visual responsiva de puntos y líneas con pasos de 20px para alineación visual simétrica de entidades.
2. **Componente de Clase Estructurado según UML 2.5**:
   * **Encabezado:** Nombre de la entidad, soporte de clases abstractas (cursiva y estilo visual) y estereotipo configurable (`<<entity>>`, `<<service>>`, `<<repository>>`, `<<intermediate_table>>`, `<<dto>>`, etc.).
   * **Compartimento de Atributos:** Representación estándar con visibilidad (`+`, `-`, `#`, `~`), nombre, tipo de dato y etiqueta visual distintiva **`[PK]`** para claves primarias.
   * **Compartimento de Métodos:** Visibilidad, nombre, parámetros formales y tipo de retorno (`void`, `Long`, etc.).
3. **Conectores de Relación con Trazado Ortogonal y Marcadores Tipados**:
   * Algoritmo de enrutamiento ortogonal a 90° con cálculo geométrico vectorial entre las cajas delimitadoras (*bounding boxes*).
   * Marcadores vectoriales SVG de alta fidelidad:
     * **Asociación Simple:** Flecha abierta.
     * **Agregación:** Rombo hueco (`stroke` dorado/ámbar).
     * **Composición:** Rombo relleno (`fill` oscuro con borde carmesí).
     * **Generalización / Herencia:** Flecha triangular hueca cerrada.
     * **Dependencia:** Trazo discontinuo (*dashed stroke*) con flecha abierta.
   * Multiplicidades configurables en ambos extremos (`1..1`, `0..1`, `1..*`, `0..*`, `*`) y etiqueta flotante para el nombre o rol de la asociación.
4. **Panel Inspector Lateral**:
   * Edición en tiempo real de nombres, estereotipos y estado abstracto de la entidad seleccionada.
   * Altas y bajas atómicas de atributos con selector de tipos SQL (`BIGINT`, `VARCHAR`, `TIMESTAMP`, etc.) y tipos Java (`Long`, `String`, `LocalDateTime`, etc.), visibilidad y casilla de Clave Primaria.
   * Altas y bajas de métodos con visibilidad y tipo de retorno.
   * Herramienta de trazado interactivo de relaciones seleccionando origen y destino con un clic.
5. **Persistencia Atómica Directa en PostgreSQL**:
   * Cada acción gráfica (arrastre de posición, adición de atributo, creación de relación) se persiste atómicamente en PostgreSQL mediante endpoints REST específicos, garantizando tolerancia a desconexiones y sincronización instantánea.

---

## 2. Endpoints REST Atómicos Implementados

| Endpoint | Método | Tabla PostgreSQL | Descripción Funcional | Estado |
|---|---|---|---|:---:|
| `/api/v1/projects/:id/diagram` | `GET` | Metamodelo Completo | Retorna el diagrama normalizado completo (clases, atributos, métodos y relaciones). | ✅ Aprobado |
| `/api/v1/projects/:id/classes` | `POST` | `uml_clases`, `uml_atributos` | Inserta una nueva entidad con coordenadas `pos_x`, `pos_y`, dimensiones y atributos iniciales. | ✅ Aprobado |
| `/api/v1/classes/:id` | `PUT` | `uml_clases` | Actualiza la posición del nodo al arrastrar (*drag & drop*), dimensiones o metadatos. | ✅ Aprobado |
| `/api/v1/classes/:id` | `DELETE` | `uml_clases` | Elimina la entidad propagando el borrado en cascada (`ON DELETE CASCADE`) a sus relaciones. | ✅ Aprobado |
| `/api/v1/classes/:id/attributes` | `POST` | `uml_atributos` | Inserta atómicamente un atributo con tipo de dato, visibilidad y marca `[PK]`. | ✅ Aprobado |
| `/api/v1/attributes/:id` | `PUT` | `uml_atributos` | Modifica nombre, tipo de dato, visibilidad o clave primaria de un atributo. | ✅ Aprobado |
| `/api/v1/attributes/:id` | `DELETE` | `uml_atributos` | Elimina un atributo específico sin afectar el resto de la clase. | ✅ Aprobado |
| `/api/v1/classes/:id/methods` | `POST` | `uml_metodos` | Inserta un método con visibilidad y tipo de retorno. | ✅ Aprobado |
| `/api/v1/methods/:id` | `PUT` | `uml_metodos` | Modifica firma y retorno de un método. | ✅ Aprobado |
| `/api/v1/methods/:id` | `DELETE` | `uml_metodos` | Elimina un método específico de la entidad. | ✅ Aprobado |
| `/api/v1/projects/:id/relationships` | `POST` | `uml_relaciones` | Inserta una relación ortogonal con tipo y multiplicidades configuradas. | ✅ Aprobado |
| `/api/v1/relationships/:id` | `PUT` | `uml_relaciones` | Actualiza multiplicidades, tipo o nombre de la relación. | ✅ Aprobado |
| `/api/v1/relationships/:id` | `DELETE` | `uml_relaciones` | Elimina la relación entre dos entidades. | ✅ Aprobado |

---

## 3. Estructura de Artefactos Desarrollados

```text
client/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── src/
    ├── main.tsx                           # Punto de entrada de la SPA React
    ├── App.tsx                            # Orquestación del estado del diagrama y sincronización API
    ├── index.css                          # Estilos globales y utilidades Tailwind
    ├── types/
    │   └── uml.ts                         # Metamodelo UML del cliente y transformaciones de lienzo
    ├── services/
    │   └── api.ts                         # Cliente HTTP REST para comunicación con el backend
    ├── utils/
    │   └── geometry.ts                    # Algoritmo de enrutamiento ortogonal y cálculo de anclajes
    └── components/
        ├── canvas/
        │   ├── UmlCanvas.tsx              # Lienzo SVG/Canvas con zoom y paneo infinito
        │   ├── UmlClassNode.tsx           # Componente de clase UML 2.5 con [PK] y drag & drop
        │   ├── UmlRelationshipConnector.tsx # Conector ortogonal y multiplicidades
        │   └── UmlMarkers.tsx             # Marcadores SVG (asociación, agregación, composición, herencia)
        ├── inspector/
        │   └── InspectorPanel.tsx         # Panel lateral para edición de propiedades, atributos y relaciones
        └── toolbar/
            └── CanvasToolbar.tsx          # Barra superior con estado del proyecto y herramientas

server/
└── src/
    ├── types/
    │   └── uml.ts                         # Tipos ampliados para relaciones ortogonales (dependencia)
    ├── services/
    │   └── UmlAtomicService.ts            # Capa de servicio para operaciones atómicas locales en PostgreSQL
    ├── controllers/
    │   └── umlController.ts               # Controladores HTTP de la API REST v1
    ├── routes/
    │   └── umlRoutes.ts                   # Router Express con middleware de autenticación JWT
    ├── server.ts                          # Montaje de /api/v1/projects y /api/v1/classes
    └── __tests__/
        └── umlAtomicEndpoints.test.ts     # Suite de 11 pruebas de persistencia atómica en PostgreSQL
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
 ✓ src/__tests__/umlAtomicEndpoints.test.ts (11 tests)  # Fase 4: Persistencia Atómica UML
 ✓ src/__tests__/authAndProjects.test.ts (11 tests)     # Fase 3: Autenticación y Salas
 ✓ src/__tests__/collaborationSocket.test.ts (5 tests)  # Fase 1: Concurrencia y Sockets

 Test Files  6 passed (6)
      Tests  44 passed (44)
   Duration  1.90s
```

### Frontend (`client`):
```bash
> case-collaborative-client@1.0.0 build
> tsc && vite build

vite v6.4.3 building for production...
transforming...
✓ 1596 modules transformed.
rendering chunks...
dist/index.html                   0.54 kB │ gzip:  0.36 kB
dist/assets/index-D2uQedPT.css   19.91 kB │ gzip:  4.30 kB
dist/assets/index-clotwbSK.js   187.47 kB │ gzip: 57.15 kB
✓ built in 22.11s
```

---

## 5. Criterios de Aceptación Cumplidos (Fase 4)

* [x] **Renderizado reactivo sobre Canvas/SVG** con soporte comprobado de paneo, zoom infinito y ajuste a rejilla (*grid snapping*).
* [x] **Componente de Clase UML 2.5** con encabezado de entidad y estereotipos, compartimento de atributos tipados con etiqueta visual `[PK]` y compartimento de métodos.
* [x] **Conectores de relación con trazado ortogonal** y marcadores vectoriales para Asociación, Agregación (rombo hueco), Composición (rombo relleno), Generalización (flecha triangular hueca) y Dependencia (trazo discontinuo).
* [x] **Multiplicidades configurables** en ambos extremos (`1..1`, `0..1`, `1..*`, `0..*`, `*`).
* [x] **Panel inspector lateral** para edición en vivo de propiedades, atributos con tipos válidos SQL/Java y configuración de relaciones.
* [x] **Endpoints REST atómicos** con persistencia directa en las tablas `uml_clases`, `uml_atributos`, `uml_metodos` y `uml_relaciones` de PostgreSQL 17.
* [x] **100% de tests aprobados (44/44)** y compilación limpia tanto en TypeScript (`tsc --noEmit`) como en el empaquetado de producción de Vite.
