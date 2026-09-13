# FASE 04: Motor Gráfico del Lienzo UML Interactivo
**Directiva para el Agente:** Construcción del editor visual de clases vinculado directamente a las tablas `uml_clases`, `uml_atributos`, `uml_metodos` y `uml_relaciones`.

---

## 1. Requerimientos del Canvas Visual
* Renderizado reactivo sobre Canvas/SVG con soporte de paneo, zoom infinito y ajuste a rejilla (*grid snapping*).
* Componente de Clase estructurado según UML 2.5:
  * Encabezado: Nombre de entidad y estereotipo (`<<entity>>`)[cite: 7].
  * Compartimento de Atributos: Visibilidad, nombre, tipo y etiqueta visual `[PK]` para claves primarias[cite: 7].
  * Compartimento de Métodos: Visibilidad, nombre, parámetros y tipo de retorno[cite: 7].
* Conectores de Relación: Trazado ortogonal y marcadores según tipo (Asociación simple, Agregación con rombo hueco, Composición con rombo relleno, Generalización con flecha triangular hueca y Dependencia con trazo discontinuo)[cite: 7].
* Multiplicidades configurables en ambos extremos (`1..1`, `0..1`, `1..*`, `0..*`)[cite: 7].

## 2. Tareas Técnicas para el Agente
1. Desarrollar el componente Canvas en el frontend consumiendo la API para poblar clases y relaciones desde las tablas `uml_*`[cite: 7].
2. Implementar panel inspector lateral para editar propiedades de clase, agregar/eliminar atributos y seleccionar tipos SQL/Java válidos[cite: 1, 7].
3. Crear endpoints REST para operaciones atómicas locales:
   * `POST /api/v1/projects/:id/classes` (inserta en `uml_clases`)[cite: 7].
   * `PUT /api/v1/classes/:id` (actualiza posiciones `pos_x`, `pos_y` o dimensiones)[cite: 7].
   * `POST /api/v1/classes/:id/attributes` (inserta en `uml_atributos`)[cite: 7].
   * `POST /api/v1/projects/:id/relationships` (inserta en `uml_relaciones`)[cite: 7].

## 3. Criterios de Aceptación
* El usuario modela clases y relaciones complejas manualmente con respuesta instantánea de renderizado[cite: 1, 7].
* Cada acción manual persiste atómicamente en las tablas correspondientes de PostgreSQL[cite: 7].