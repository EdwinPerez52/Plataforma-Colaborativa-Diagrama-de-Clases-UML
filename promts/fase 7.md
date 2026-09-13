# FASE 07: Módulo de Visión Computacional para Digitalización de Bocetos
**Directiva para el Agente:** Implementación de CU06 para transformar fotos de diagramas en registros formales de `uml_clases` y `uml_atributos`.

---

## 1. Pipeline de Detección y OCR
1. **Recepción:** Carga de imagen fotográfica de pizarra o libreta mediante `POST /api/v1/vision/sketch-to-diagram`[cite: 1, 7].
2. **Preprocesamiento (OpenCV):** Binarización Otsu, eliminación de sombras y corrección geométrica de perspectiva[cite: 1].
3. **Segmentación de Contornos:** Detección de rectángulos cerrados para ubicar clases y líneas de enlace para asociaciones[cite: 1, 7].
4. **Reconocimiento Óptico (OCR):** Extracción del nombre de la entidad en la parte superior y atributos en el cuerpo[cite: 1, 7].
5. **Persistencia e Inyección:** Registro en `auditoria_comandos_ia` (`canal_entrada = 'FOTO_BOCETO'`), persistencia en `uml_clases` y `uml_atributos`, y emisión por WebSockets al lienzo[cite: 1, 7].

## 2. Tareas Técnicas para el Agente
1. Construir el microservicio en Python (FastAPI + OpenCV + PyTesseract / EasyOCR).
2. Normalizar los tipos de datos detectados hacia tipos válidos de UML (`String`, `Integer`, `Date`, etc.)[cite: 7].
3. Desarrollar modal en el frontend para previsualizar los elementos detectados antes de confirmar su inserción en el lienzo[cite: 1, 7].

## 3. Criterios de Aceptación
* Una fotografía de una pizarra con 3 clases dibujadas a mano genera los nodos correspondientes en el lienzo interactivo[cite: 7].