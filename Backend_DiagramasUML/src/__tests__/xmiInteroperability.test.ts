import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../config/database';
import { XmiInteroperabilityService } from '../services/XmiInteroperabilityService';
import { UmlAtomicService } from '../services/UmlAtomicService';

describe('Fase 8: Interoperabilidad Bidireccional con Enterprise Architect (XMI 2.1 / UML 2.5)', () => {
  let testUserId: number;
  let testProjectId: number;
  let targetImportProjectId: number;

  beforeAll(async () => {
    // 0. Crear usuario de prueba
    const userRes = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, cargo)
       VALUES ('Ingeniero XMI Test', $1, 'hashedpass123', 'Diseñador UML')
       RETURNING id`,
      [`xmi_test_${Date.now()}@uagrm.edu.bo`]
    );
    testUserId = Number(userRes.rows[0].id);

    // 1. Crear proyecto de prueba para exportación
    const projRes = await db.query(
      `INSERT INTO proyectos (codigo_sala, titulo, descripcion, propietario_id)
       VALUES ('sala-xmi-export-' || floor(random()*10000), 'Sistema Clínico XMI', 'Proyecto de prueba para interoperabilidad con Sparx EA', $1)
       RETURNING id`,
      [testUserId]
    );
    testProjectId = Number(projRes.rows[0].id);

    // Crear segundo proyecto para importar
    const targetProjRes = await db.query(
      `INSERT INTO proyectos (codigo_sala, titulo, descripcion, propietario_id)
       VALUES ('sala-xmi-import-' || floor(random()*10000), 'Proyecto Destino XMI', 'Proyecto vacío para importar XMI', $1)
       RETURNING id`,
      [testUserId]
    );
    targetImportProjectId = Number(targetProjRes.rows[0].id);

    // 2. Sembrar clases, atributos, métodos y relaciones en testProjectId
    const c1 = await UmlAtomicService.createClass(testProjectId, {
      name: 'Paciente',
      stereotype: 'entity',
      isAbstract: false,
      posX: 120,
      posY: 100,
      width: 220,
      height: 180,
      attributes: [
        { name: 'id', type: 'Long', visibility: '-', isPk: true, isNullable: false },
        { name: 'nombreCompleto', type: 'String', visibility: '-', isPk: false, isNullable: false },
        { name: 'fechaNacimiento', type: 'LocalDate', visibility: '-', isPk: false, isNullable: true },
      ],
    });

    await UmlAtomicService.createMethod(c1.id, {
      name: 'obtenerEdad',
      returnType: 'Integer',
      visibility: '+',
    });

    const c2 = await UmlAtomicService.createClass(testProjectId, {
      name: 'ConsultaMedica',
      stereotype: 'entity',
      isAbstract: false,
      posX: 450,
      posY: 100,
      width: 230,
      height: 180,
      attributes: [
        { name: 'id', type: 'Long', visibility: '-', isPk: true, isNullable: false },
        { name: 'diagnostico', type: 'String', visibility: '-', isPk: false, isNullable: false },
      ],
    });

    const c3 = await UmlAtomicService.createClass(testProjectId, {
      name: 'Persona',
      stereotype: 'abstract',
      isAbstract: true,
      posX: 120,
      posY: 340,
      width: 200,
      height: 140,
      attributes: [
        { name: 'ci', type: 'String', visibility: '#', isPk: false, isNullable: false },
      ],
    });

    // Relación 1: Paciente tiene Consulta (Composición)
    await UmlAtomicService.createRelationship(testProjectId, {
      sourceClassId: c1.id,
      targetClassId: c2.id,
      type: 'composition',
      sourceMultiplicity: '1..1',
      targetMultiplicity: '0..*',
      name: 'registra',
      isBidirectional: true,
    });

    // Relación 2: Paciente hereda de Persona (Herencia)
    await UmlAtomicService.createRelationship(testProjectId, {
      sourceClassId: c1.id,
      targetClassId: c3.id,
      type: 'inheritance',
      sourceMultiplicity: '1..1',
      targetMultiplicity: '1..1',
      name: 'heredaDe',
    });
  });

  afterAll(async () => {
    if (testProjectId) {
      await db.query('DELETE FROM proyectos WHERE id = $1', [testProjectId]);
    }
    if (targetImportProjectId) {
      await db.query('DELETE FROM proyectos WHERE id = $1', [targetImportProjectId]);
    }
    if (testUserId) {
      await db.query('DELETE FROM usuarios WHERE id = $1', [testUserId]);
    }
  });

  it('1. Debe exportar el diagrama a formato XMI 2.1 conforme a Sparx Enterprise Architect', async () => {
    const xml = await XmiInteroperabilityService.exportToXmi(testProjectId);

    // Validar cabeceras y namespaces OMG / EA
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<xmi:XMI xmi:version="2.1"');
    expect(xml).toContain('xmlns:uml="http://schema.omg.org/spec/UML/2.1"');
    expect(xml).toContain('xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"');
    expect(xml).toContain('<xmi:Documentation exporter="CollaborativeCASE"');

    // Validar clases
    expect(xml).toContain('name="Paciente"');
    expect(xml).toContain('name="ConsultaMedica"');
    expect(xml).toContain('name="Persona"');
    expect(xml).toContain('isAbstract="true"');

    // Validar atributos y clave primaria isID="true"
    expect(xml).toContain('name="id" visibility="private" isID="true"');
    expect(xml).toContain('name="nombreCompleto"');
    expect(xml).toContain('name="ci" visibility="protected"');

    // Validar operaciones y valor de retorno
    expect(xml).toContain('name="obtenerEdad" visibility="public"');
    expect(xml).toContain('direction="return"');

    // Validar generalización (herencia)
    expect(xml).toContain('<generalization xmi:type="uml:Generalization"');

    // Validar asociación con composición (aggregation="composite")
    expect(xml).toContain('<packagedElement xmi:type="uml:Association"');
    expect(xml).toContain('aggregation="composite"');

    // Validar extensión de geometría Sparx EA
    expect(xml).toContain('<xmi:Extension extender="Enterprise Architect"');
    expect(xml).toContain('Left=120;Top=100;');
  });

  it('2. Debe parsear y validar un archivo XML/XMI de Enterprise Architect', () => {
    const sampleEaXml = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1">
  <xmi:Documentation exporter="Enterprise Architect" exporterVersion="6.5"/>
  <uml:Model xmi:type="uml:Model" xmi:id="MX_1" name="ModeloPruebaEA">
    <packagedElement xmi:type="uml:Class" xmi:id="EAID_CLASE_DOC" name="Doctor" isAbstract="false">
      <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_AT_1" name="id" visibility="private" isID="true">
        <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#Integer"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_AT_2" name="especialidad" visibility="public">
        <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#String"/>
      </ownedAttribute>
      <ownedOperation xmi:type="uml:Operation" xmi:id="EAID_OP_1" name="atenderPaciente" visibility="public">
        <ownedParameter xmi:type="uml:Parameter" xmi:id="EAID_OP_1_RET" direction="return">
          <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#Boolean"/>
        </ownedParameter>
      </ownedOperation>
    </packagedElement>

    <packagedElement xmi:type="uml:Class" xmi:id="EAID_CLASE_REC" name="RecetaMedica" isAbstract="false">
      <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_AT_3" name="codigo" visibility="private" isID="true">
        <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#String"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_AT_4" name="indicaciones" visibility="private">
        <type xmi:type="uml:PrimitiveType" href="http://schema.omg.org/spec/UML/2.1/uml.xml#String"/>
      </ownedAttribute>
    </packagedElement>

    <packagedElement xmi:type="uml:Association" xmi:id="EAID_AS_1" name="emite">
      <memberEnd xmi:idref="EAID_AS_1_src"/>
      <memberEnd xmi:idref="EAID_AS_1_tgt"/>
      <ownedEnd xmi:type="uml:Property" xmi:id="EAID_AS_1_src" type="EAID_CLASE_DOC" aggregation="none">
        <lowerValue xmi:type="uml:LiteralInteger" value="1"/>
        <upperValue xmi:type="uml:LiteralUnlimitedNatural" value="1"/>
      </ownedEnd>
      <ownedEnd xmi:type="uml:Property" xmi:id="EAID_AS_1_tgt" type="EAID_CLASE_REC" aggregation="shared">
        <lowerValue xmi:type="uml:LiteralInteger" value="0"/>
        <upperValue xmi:type="uml:LiteralUnlimitedNatural" value="*"/>
      </ownedEnd>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;

    const validation = XmiInteroperabilityService.parseXmi(sampleEaXml);

    expect(validation.isValid).toBe(true);
    expect(validation.classes.length).toBe(2);
    expect(validation.summary.classesCount).toBe(2);
    expect(validation.summary.attributesCount).toBe(4);
    expect(validation.summary.methodsCount).toBe(1);
    expect(validation.summary.relationshipsCount).toBe(1);

    const docClass = validation.classes.find((c) => c.name === 'Doctor')!;
    expect(docClass).toBeDefined();
    expect(docClass.attributes.find((a) => a.name === 'id')?.isPk).toBe(true);
    expect(docClass.attributes.find((a) => a.name === 'especialidad')?.visibility).toBe('+');
    expect(docClass.methods[0].name).toBe('atenderPaciente');
    expect(docClass.methods[0].returnType).toBe('Boolean');

    const rel = validation.relationships[0];
    expect(rel.name).toBe('emite');
    expect(rel.type).toBe('aggregation'); // shared -> aggregation
    expect(rel.sourceMultiplicity).toBe('1..1');
    expect(rel.targetMultiplicity).toBe('0..*');
  });

  it('3. Debe importar masivamente el esquema XMI en PostgreSQL 17', async () => {
    const sampleEaXml = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1">
  <uml:Model xmi:type="uml:Model" xmi:id="MX_2" name="ModeloFarmacia">
    <packagedElement xmi:type="uml:Class" xmi:id="C_MEDICAMENTO" name="Medicamento" isAbstract="false">
      <ownedAttribute xmi:type="uml:Property" xmi:id="A_MED_1" name="id" visibility="private" isID="true">
        <type xmi:type="uml:PrimitiveType" href="#Long"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="A_MED_2" name="nombreGenerico" visibility="private">
        <type xmi:type="uml:PrimitiveType" href="#String"/>
      </ownedAttribute>
      <ownedOperation xmi:type="uml:Operation" xmi:id="O_MED_1" name="verificarStock" visibility="public">
        <ownedParameter direction="return">
          <type xmi:type="uml:PrimitiveType" href="#Boolean"/>
        </ownedParameter>
      </ownedOperation>
    </packagedElement>

    <packagedElement xmi:type="uml:Class" xmi:id="C_LOTE" name="Lote" isAbstract="false">
      <ownedAttribute xmi:type="uml:Property" xmi:id="A_LOT_1" name="id" visibility="private" isID="true">
        <type xmi:type="uml:PrimitiveType" href="#Long"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="A_LOT_2" name="cantidad" visibility="private">
        <type xmi:type="uml:PrimitiveType" href="#Integer"/>
      </ownedAttribute>
    </packagedElement>

    <packagedElement xmi:type="uml:Association" xmi:id="A_MED_LOTE" name="contiene">
      <memberEnd xmi:idref="E_1"/>
      <memberEnd xmi:idref="E_2"/>
      <ownedEnd xmi:id="E_1" type="C_MEDICAMENTO" aggregation="none">
        <lowerValue value="1"/>
        <upperValue value="1"/>
      </ownedEnd>
      <ownedEnd xmi:id="E_2" type="C_LOTE" aggregation="composite">
        <lowerValue value="1"/>
        <upperValue value="*"/>
      </ownedEnd>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;

    const importRes = await XmiInteroperabilityService.importXmi(
      targetImportProjectId,
      sampleEaXml,
      'overwrite'
    );

    expect(importRes.success).toBe(true);
    expect(importRes.importedClasses).toBe(2);
    expect(importRes.importedAttributes).toBe(4);
    expect(importRes.importedMethods).toBe(1);
    expect(importRes.importedRelationships).toBe(1);

    // Verificar en la BD directamente
    const diagram = await UmlAtomicService.getDiagram(targetImportProjectId);
    expect(diagram).toBeDefined();
    expect(diagram!.classes.length).toBe(2);
    expect(diagram!.relationships.length).toBe(1);

    const medClass = diagram!.classes.find((c) => c.name === 'Medicamento')!;
    expect(medClass).toBeDefined();
    expect(medClass.attributes.length).toBe(2);
    expect(medClass.attributes[0].isPk).toBe(true);
    expect(medClass.methods.length).toBe(1);
    expect(medClass.methods[0].name).toBe('verificarStock');

    const rel = diagram!.relationships[0];
    expect(rel.name).toBe('contiene');
    expect(rel.type).toBe('composition');
  });

  it('4. Debe realizar una prueba de ida y vuelta (Round-Trip) sin pérdida semántica', async () => {
    // Exportar testProjectId
    const exportedXml = await XmiInteroperabilityService.exportToXmi(testProjectId);

    // Crear un nuevo proyecto temporal para el round-trip
    const roundTripProjRes = await db.query(
      `INSERT INTO proyectos (codigo_sala, titulo, descripcion, propietario_id)
       VALUES ('sala-round-trip-' || floor(random()*10000), 'Round Trip XMI', 'Prueba de ida y vuelta', $1)
       RETURNING id`,
      [testUserId]
    );
    const roundTripId = Number(roundTripProjRes.rows[0].id);

    try {
      // Importar el XML exportado en el nuevo proyecto
      const importResult = await XmiInteroperabilityService.importXmi(
        roundTripId,
        exportedXml,
        'overwrite'
      );

      expect(importResult.success).toBe(true);

      const roundTripDiagram = await UmlAtomicService.getDiagram(roundTripId);
      expect(roundTripDiagram!.classes.length).toBe(3);
      expect(roundTripDiagram!.classes.map((c) => c.name).sort()).toEqual(
        ['ConsultaMedica', 'Paciente', 'Persona'].sort()
      );

      // Verificar que los atributos PK se mantuvieron
      const pacienteClass = roundTripDiagram!.classes.find((c) => c.name === 'Paciente')!;
      expect(pacienteClass.attributes.find((a) => a.name === 'id')?.isPk).toBe(true);

      // Verificar que las relaciones se preservaron
      expect(roundTripDiagram!.relationships.length).toBe(2);
      const types = roundTripDiagram!.relationships.map((r) => r.type).sort();
      expect(types).toContain('composition');
      expect(types).toContain('inheritance');
    } finally {
      await db.query('DELETE FROM proyectos WHERE id = $1', [roundTripId]);
    }
  });
});
