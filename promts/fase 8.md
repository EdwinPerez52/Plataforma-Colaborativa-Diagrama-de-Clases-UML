# FASE 08: Interoperabilidad Bidireccional con Enterprise Architect (XMI)
**Directiva para el Agente:** Implementación de CU07 para importar y exportar esquemas XMI 2.1 / UML 2.5 utilizando las tablas `uml_clases` y `uml_relaciones`.

---

## 1. Especificación del Formato XMI
* **Importación:** Parsear archivos XML/XMI exportados por Enterprise Architect (EA) e insertar masivamente en `uml_clases`, `uml_atributos` y `uml_relaciones` reconstruyendo el diagrama web[cite: 7].
* **Exportación:** Consultar las tablas `uml_*` del proyecto y generar el documento XML compatible con Sparx Enterprise Architect[cite: 7]:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.1" xmlns:uml="[http://schema.omg.org/spec/UML/2.1](http://schema.omg.org/spec/UML/2.1)" xmlns:xmi="[http://schema.omg.org/spec/XMI/2.1](http://schema.omg.org/spec/XMI/2.1)">
  <xmi:Documentation exporter="CollaborativeCASE" exporterVersion="1.0"/>
  <uml:Model xmi:type="uml:Model" xmi:id="model_root" name="DiagramaConceptual">
    <!-- Nodos Class con sus Property generados dinámicamente -->
  </uml:Model>
</xmi:XMI>