import JSZip from 'jszip';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from '../config/database';
import { UmlAtomicService } from './UmlAtomicService';
import {
  DiagramModel,
  UmlClass,
  UmlAttribute,
  UmlRelationship,
} from '../types/uml';

export interface GeneratedFile {
  path: string;
  content: string;
  category: 'entity' | 'repository' | 'service' | 'dto' | 'controller' | 'config' | 'root';
}

export interface BackendGenerationResult {
  success: boolean;
  message: string;
  generationId: number;
  projectId: number;
  versionSpringBoot: string;
  sha256: string;
  zipFileName: string;
  totalFiles: number;
  files: Array<{ path: string; category: string; preview: string }>;
  zipBuffer: Buffer;
}

export class SpringBootGeneratorService {
  private static BASE_PACKAGE = 'com.uagrm.casecase';
  private static SPRING_BOOT_VERSION = '3.3.4';

  /**
   * Mapeo de tipos UML a tipos Java / JPA
   */
  public static mapToJavaType(umlType: string): string {
    const t = umlType.toLowerCase().trim();
    if (t === 'long' || t === 'bigint' || t === 'id') return 'Long';
    if (t === 'integer' || t === 'int' || t === 'entero' || t === 'numero') return 'Integer';
    if (t === 'string' || t === 'varchar' || t === 'text' || t === 'texto') return 'String';
    if (t === 'boolean' || t === 'bool') return 'Boolean';
    if (t === 'localdate' || t === 'date' || t === 'fecha') return 'LocalDate';
    if (t === 'localdatetime' || t === 'datetime' || t === 'timestamp') return 'LocalDateTime';
    if (t === 'bigdecimal' || t === 'double' || t === 'float' || t === 'decimal') return 'BigDecimal';
    return umlType.charAt(0).toUpperCase() + umlType.slice(1);
  }

  /**
   * Genera la solución completa en 5 capas y empaqueta en ZIP
   */
  static async generateBackend(
    projectId: number,
    userId: number = 1
  ): Promise<BackendGenerationResult> {
    const diagram = await UmlAtomicService.getDiagram(projectId);
    if (!diagram || !diagram.classes || diagram.classes.length === 0) {
      throw new Error(`El proyecto con ID ${projectId} no contiene clases UML modeladas para generar el backend.`);
    }

    const classes = diagram.classes;
    const relationships = diagram.relationships || [];
    const generatedFiles: GeneratedFile[] = [];

    // 1. pom.xml
    generatedFiles.push({
      path: 'pom.xml',
      category: 'root',
      content: this.generatePomXml(diagram.name || 'sistema-case'),
    });

    // 2. application.properties
    generatedFiles.push({
      path: 'src/main/resources/application.properties',
      category: 'config',
      content: this.generateApplicationProperties(diagram.name || 'sistema_case'),
    });

    // 3. CaseApplication.java
    generatedFiles.push({
      path: `src/main/java/com/uagrm/casecase/CaseApplication.java`,
      category: 'root',
      content: this.generateMainClass(),
    });

    // 4. README.md
    generatedFiles.push({
      path: 'README.md',
      category: 'root',
      content: this.generateReadme(diagram.name || 'Sistema Colaborativo CASE UML', classes.length),
    });

    // 5. Generación de las 5 Capas por cada clase UML
    for (const cls of classes) {
      // Capa 1: Entity
      generatedFiles.push({
        path: `src/main/java/com/uagrm/casecase/entity/${cls.name}.java`,
        category: 'entity',
        content: this.generateEntity(cls, classes, relationships),
      });

      // Capa 2: Repository
      generatedFiles.push({
        path: `src/main/java/com/uagrm/casecase/repository/${cls.name}Repository.java`,
        category: 'repository',
        content: this.generateRepository(cls),
      });

      // Capa 3: Service (Interface e Impl)
      generatedFiles.push({
        path: `src/main/java/com/uagrm/casecase/service/${cls.name}Service.java`,
        category: 'service',
        content: this.generateServiceInterface(cls),
      });
      generatedFiles.push({
        path: `src/main/java/com/uagrm/casecase/service/impl/${cls.name}ServiceImpl.java`,
        category: 'service',
        content: this.generateServiceImpl(cls),
      });

      // Capa 4: DTOs (RequestDTO y ResponseDTO)
      generatedFiles.push({
        path: `src/main/java/com/uagrm/casecase/dto/request/${cls.name}RequestDTO.java`,
        category: 'dto',
        content: this.generateRequestDto(cls),
      });
      generatedFiles.push({
        path: `src/main/java/com/uagrm/casecase/dto/response/${cls.name}ResponseDTO.java`,
        category: 'dto',
        content: this.generateResponseDto(cls),
      });

      // Capa 5: Controller
      generatedFiles.push({
        path: `src/main/java/com/uagrm/casecase/controller/${cls.name}Controller.java`,
        category: 'controller',
        content: this.generateController(cls),
      });
    }

    // 6. Empaquetar en archivo ZIP mediante JSZip
    const zip = new JSZip();
    for (const f of generatedFiles) {
      zip.file(f.path, f.content);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    // 7. Cálculo de Integridad Criptográfica SHA-256
    const hashSha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');

    // 8. Almacenamiento local del archivo ZIP
    const archivesDir = path.resolve(__dirname, '../../generated_archives');
    if (!fs.existsSync(archivesDir)) {
      fs.mkdirSync(archivesDir, { recursive: true });
    }

    const sanitizedTitle = (diagram.name || 'sistema')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 30);
    const zipFileName = `backend_spring_boot_${sanitizedTitle}_${Date.now()}.zip`;
    const zipFilePath = path.join(archivesDir, zipFileName);
    fs.writeFileSync(zipFilePath, zipBuffer);

    // 9. Registro en la tabla de auditoría `generaciones_backend` de PostgreSQL 17
    const insertRes = await db.query(
      `INSERT INTO generaciones_backend (
         proyecto_id, usuario_id, version_spring_boot, ruta_archivo_zip, hash_sha256, descargas_conteo
       ) VALUES ($1, $2, $3, $4, $5, 0)
       RETURNING id, creado_en`,
      [projectId, userId, this.SPRING_BOOT_VERSION, zipFilePath, hashSha256]
    );

    const generationId = Number(insertRes.rows[0].id);

    return {
      success: true,
      message: `Arquitectura Spring Boot 3.3.4 (5 capas) generada con éxito para ${classes.length} entidades.`,
      generationId,
      projectId,
      versionSpringBoot: this.SPRING_BOOT_VERSION,
      sha256: hashSha256,
      zipFileName,
      totalFiles: generatedFiles.length,
      files: generatedFiles.map((f) => ({
        path: f.path,
        category: f.category,
        preview: f.content.slice(0, 350) + (f.content.length > 350 ? '...' : ''),
      })),
      zipBuffer,
    };
  }

  /**
   * CAPA 1: ENTITY (JPA)
   */
  private static generateEntity(
    cls: UmlClass,
    allClasses: UmlClass[],
    relationships: UmlRelationship[]
  ): string {
    const tableName = toSnakeCase(cls.name) + 's';
    const attrs = cls.attributes || [];
    const pkAttr = attrs.find((a) => a.isPk) || { name: 'id', type: 'Long' };
    const pkType = this.mapToJavaType(pkAttr.type);

    // Relaciones entrantes y salientes
    const outgoingRels = relationships.filter((r) => String(r.sourceClassId) === String(cls.id));
    const incomingRels = relationships.filter((r) => String(r.targetClassId) === String(cls.id));

    // Herencia
    const inheritanceRel = outgoingRels.find((r) => r.type === 'inheritance');
    let extendsClause = '';
    if (inheritanceRel) {
      const parentCls = allClasses.find((c) => String(c.id) === String(inheritanceRel.targetClassId));
      if (parentCls) {
        extendsClause = ` extends ${parentCls.name}`;
      }
    }

    const isAbstract = cls.isAbstract ? 'abstract ' : '';

    let code = `package com.uagrm.casecase.entity;\n\n`;
    code += `import jakarta.persistence.*;\n`;
    code += `import lombok.*;\n`;
    code += `import java.time.LocalDate;\n`;
    code += `import java.time.LocalDateTime;\n`;
    code += `import java.math.BigDecimal;\n`;
    code += `import java.util.List;\n`;
    code += `import java.util.ArrayList;\n\n`;

    code += `/**\n * Entidad JPA generada automáticamente para la clase UML: ${cls.name}\n * Capa 1: Entidad de Dominio / Persistencia\n */\n`;
    code += `@Entity\n`;
    code += `@Table(name = "${tableName}")\n`;
    if (cls.isAbstract) {
      code += `@Inheritance(strategy = InheritanceType.JOINED)\n`;
    }
    code += `@Getter\n@Setter\n@NoArgsConstructor\n@AllArgsConstructor\n@Builder\n`;
    code += `public ${isAbstract}class ${cls.name}${extendsClause} {\n\n`;

    // Clave primaria si no hereda de otra clase
    if (!inheritanceRel) {
      code += `    @Id\n`;
      code += `    @GeneratedValue(strategy = GenerationType.IDENTITY)\n`;
      code += `    @Column(name = "id")\n`;
      code += `    private ${pkType} id;\n\n`;
    }

    // Atributos de la clase
    for (const a of attrs) {
      if (a.isPk && !inheritanceRel && a.name.toLowerCase() === 'id') continue;
      const jType = this.mapToJavaType(a.type);
      const colName = toSnakeCase(a.name);
      const nullable = a.isNullable !== false ? 'true' : 'false';

      code += `    @Column(name = "${colName}", nullable = ${nullable})\n`;
      code += `    private ${jType} ${a.name};\n\n`;
    }

    // Relaciones JPA
    // 1. Relaciones salientes no herencia
    for (const rel of outgoingRels) {
      if (rel.type === 'inheritance') continue;
      const targetCls = allClasses.find((c) => String(c.id) === String(rel.targetClassId));
      if (!targetCls) continue;

      const isTargetMany = rel.targetMultiplicity?.includes('*');
      const fieldName = toCamelCase(rel.name || targetCls.name) + (isTargetMany ? 'List' : '');

      if (isTargetMany) {
        // OneToMany / ManyToMany
        if (rel.sourceMultiplicity?.includes('*')) {
          code += `    @ManyToMany\n`;
          code += `    @JoinTable(\n`;
          code += `        name = "${tableName}_${toSnakeCase(targetCls.name)}s",\n`;
          code += `        joinColumns = @JoinColumn(name = "${toSnakeCase(cls.name)}_id"),\n`;
          code += `        inverseJoinColumns = @JoinColumn(name = "${toSnakeCase(targetCls.name)}_id")\n`;
          code += `    )\n`;
          code += `    @Builder.Default\n`;
          code += `    private List<${targetCls.name}> ${fieldName} = new ArrayList<>();\n\n`;
        } else {
          code += `    @OneToMany(mappedBy = "${toCamelCase(cls.name)}", cascade = CascadeType.ALL, orphanRemoval = true)\n`;
          code += `    @Builder.Default\n`;
          code += `    private List<${targetCls.name}> ${fieldName} = new ArrayList<>();\n\n`;
        }
      } else {
        // ManyToOne / OneToOne
        code += `    @ManyToOne(fetch = FetchType.LAZY)\n`;
        code += `    @JoinColumn(name = "${toSnakeCase(targetCls.name)}_id")\n`;
        code += `    private ${targetCls.name} ${toCamelCase(targetCls.name)};\n\n`;
      }
    }

    // 2. Relaciones entrantes (inversas si no son herencia)
    for (const rel of incomingRels) {
      if (rel.type === 'inheritance') continue;
      const srcCls = allClasses.find((c) => String(c.id) === String(rel.sourceClassId));
      if (!srcCls) continue;

      const isTargetMany = rel.targetMultiplicity?.includes('*');
      if (isTargetMany && !rel.sourceMultiplicity?.includes('*')) {
        code += `    @ManyToOne(fetch = FetchType.LAZY)\n`;
        code += `    @JoinColumn(name = "${toSnakeCase(srcCls.name)}_id")\n`;
        code += `    private ${srcCls.name} ${toCamelCase(srcCls.name)};\n\n`;
      }
    }

    code += `}\n`;
    return code;
  }

  /**
   * CAPA 2: REPOSITORY (Spring Data JPA)
   */
  private static generateRepository(cls: UmlClass): string {
    const pkAttr = cls.attributes?.find((a) => a.isPk) || { type: 'Long' };
    const pkType = this.mapToJavaType(pkAttr.type);

    let code = `package com.uagrm.casecase.repository;\n\n`;
    code += `import com.uagrm.casecase.entity.${cls.name};\n`;
    code += `import org.springframework.data.jpa.repository.JpaRepository;\n`;
    code += `import org.springframework.stereotype.Repository;\n`;
    code += `import java.util.Optional;\n\n`;

    code += `/**\n * Capa 2: Repositorio Spring Data JPA para la entidad ${cls.name}\n */\n`;
    code += `@Repository\n`;
    code += `public interface ${cls.name}Repository extends JpaRepository<${cls.name}, ${pkType}> {\n\n`;

    // Si tiene atributos tipo String significativos, agregar buscador
    const stringAttr = cls.attributes?.find((a) => !a.isPk && this.mapToJavaType(a.type) === 'String');
    if (stringAttr) {
      const capName = capitalize(stringAttr.name);
      code += `    Optional<${cls.name}> findBy${capName}(String ${stringAttr.name});\n\n`;
    }

    code += `}\n`;
    return code;
  }

  /**
   * CAPA 3: SERVICE INTERFACE
   */
  private static generateServiceInterface(cls: UmlClass): string {
    const pkAttr = cls.attributes?.find((a) => a.isPk) || { type: 'Long' };
    const pkType = this.mapToJavaType(pkAttr.type);

    let code = `package com.uagrm.casecase.service;\n\n`;
    code += `import com.uagrm.casecase.dto.request.${cls.name}RequestDTO;\n`;
    code += `import com.uagrm.casecase.dto.response.${cls.name}ResponseDTO;\n`;
    code += `import java.util.List;\n`;
    code += `import java.util.Optional;\n\n`;

    code += `/**\n * Capa 3: Contrato de Servicio de Negocio para ${cls.name}\n */\n`;
    code += `public interface ${cls.name}Service {\n\n`;
    code += `    List<${cls.name}ResponseDTO> findAll();\n\n`;
    code += `    Optional<${cls.name}ResponseDTO> findById(${pkType} id);\n\n`;
    code += `    ${cls.name}ResponseDTO create(${cls.name}RequestDTO request);\n\n`;
    code += `    ${cls.name}ResponseDTO update(${pkType} id, ${cls.name}RequestDTO request);\n\n`;
    code += `    void delete(${pkType} id);\n`;
    code += `}\n`;
    return code;
  }

  /**
   * CAPA 3: SERVICE IMPLEMENTATION
   */
  private static generateServiceImpl(cls: UmlClass): string {
    const pkAttr = cls.attributes?.find((a) => a.isPk) || { type: 'Long' };
    const pkType = this.mapToJavaType(pkAttr.type);
    const repoVar = toCamelCase(cls.name) + 'Repository';
    const attrs = cls.attributes || [];

    let code = `package com.uagrm.casecase.service.impl;\n\n`;
    code += `import com.uagrm.casecase.entity.${cls.name};\n`;
    code += `import com.uagrm.casecase.repository.${cls.name}Repository;\n`;
    code += `import com.uagrm.casecase.service.${cls.name}Service;\n`;
    code += `import com.uagrm.casecase.dto.request.${cls.name}RequestDTO;\n`;
    code += `import com.uagrm.casecase.dto.response.${cls.name}ResponseDTO;\n`;
    code += `import org.springframework.stereotype.Service;\n`;
    code += `import org.springframework.transaction.annotation.Transactional;\n`;
    code += `import lombok.RequiredTransConstructor;\n`;
    code += `import lombok.extern.slf4j.Slf4j;\n`;
    code += `import java.util.List;\n`;
    code += `import java.util.Optional;\n`;
    code += `import java.util.stream.Collectors;\n\n`;

    code += `/**\n * Capa 3: Implementación Transaccional de Servicios para ${cls.name}\n */\n`;
    code += `@Slf4j\n`;
    code += `@Service\n`;
    code += `@Transactional\n`;
    code += `public class ${cls.name}ServiceImpl implements ${cls.name}Service {\n\n`;
    code += `    private final ${cls.name}Repository ${repoVar};\n\n`;
    code += `    public ${cls.name}ServiceImpl(${cls.name}Repository ${repoVar}) {\n`;
    code += `        this.${repoVar} = ${repoVar};\n`;
    code += `    }\n\n`;

    // findAll
    code += `    @Override\n`;
    code += `    @Transactional(readOnly = true)\n`;
    code += `    public List<${cls.name}ResponseDTO> findAll() {\n`;
    code += `        return ${repoVar}.findAll().stream()\n`;
    code += `                .map(this::mapToResponse)\n`;
    code += `                .collect(Collectors.toList());\n`;
    code += `    }\n\n`;

    // findById
    code += `    @Override\n`;
    code += `    @Transactional(readOnly = true)\n`;
    code += `    public Optional<${cls.name}ResponseDTO> findById(${pkType} id) {\n`;
    code += `        return ${repoVar}.findById(id).map(this::mapToResponse);\n`;
    code += `    }\n\n`;

    // create
    code += `    @Override\n`;
    code += `    public ${cls.name}ResponseDTO create(${cls.name}RequestDTO request) {\n`;
    code += `        ${cls.name} entity = ${cls.name}.builder()\n`;
    for (const a of attrs) {
      if (a.isPk && a.name.toLowerCase() === 'id') continue;
      code += `                .${a.name}(request.get${capitalize(a.name)}())\n`;
    }
    code += `                .build();\n\n`;
    code += `        ${cls.name} saved = ${repoVar}.save(entity);\n`;
    code += `        log.info("[${cls.name}Service] Creada entidad con ID: {}", saved.getId());\n`;
    code += `        return mapToResponse(saved);\n`;
    code += `    }\n\n`;

    // update
    code += `    @Override\n`;
    code += `    public ${cls.name}ResponseDTO update(${pkType} id, ${cls.name}RequestDTO request) {\n`;
    code += `        ${cls.name} entity = ${repoVar}.findById(id)\n`;
    code += `                .orElseThrow(() -> new RuntimeException("${cls.name} no encontrado con ID: " + id));\n\n`;
    for (const a of attrs) {
      if (a.isPk && a.name.toLowerCase() === 'id') continue;
      code += `        entity.set${capitalize(a.name)}(request.get${capitalize(a.name)}());\n`;
    }
    code += `\n        ${cls.name} updated = ${repoVar}.save(entity);\n`;
    code += `        return mapToResponse(updated);\n`;
    code += `    }\n\n`;

    // delete
    code += `    @Override\n`;
    code += `    public void delete(${pkType} id) {\n`;
    code += `        if (!${repoVar}.existsById(id)) {\n`;
    code += `            throw new RuntimeException("${cls.name} no encontrado con ID: " + id);\n`;
    code += `        }\n`;
    code += `        ${repoVar}.deleteById(id);\n`;
    code += `        log.info("[${cls.name}Service] Eliminada entidad con ID: {}", id);\n`;
    code += `    }\n\n`;

    // Mapper privado
    code += `    private ${cls.name}ResponseDTO mapToResponse(${cls.name} entity) {\n`;
    code += `        return ${cls.name}ResponseDTO.builder()\n`;
    code += `                .id(entity.getId())\n`;
    for (const a of attrs) {
      if (a.isPk && a.name.toLowerCase() === 'id') continue;
      code += `                .${a.name}(entity.get${capitalize(a.name)}())\n`;
    }
    code += `                .build();\n`;
    code += `    }\n`;

    code += `}\n`;
    return code;
  }

  /**
   * CAPA 4: DTO REQUEST (Validaciones Jakarta)
   */
  private static generateRequestDto(cls: UmlClass): string {
    const attrs = cls.attributes || [];

    let code = `package com.uagrm.casecase.dto.request;\n\n`;
    code += `import jakarta.validation.constraints.*;\n`;
    code += `import lombok.*;\n`;
    code += `import java.time.LocalDate;\n`;
    code += `import java.time.LocalDateTime;\n`;
    code += `import java.math.BigDecimal;\n\n`;

    code += `/**\n * Capa 4: DTO de Entrada para creación y actualización de ${cls.name}\n */\n`;
    code += `@Getter\n@Setter\n@NoArgsConstructor\n@AllArgsConstructor\n@Builder\n`;
    code += `public class ${cls.name}RequestDTO {\n\n`;

    for (const a of attrs) {
      if (a.isPk && a.name.toLowerCase() === 'id') continue;
      const jType = this.mapToJavaType(a.type);

      if (!a.isNullable) {
        if (jType === 'String') {
          code += `    @NotBlank(message = "El campo '${a.name}' no puede estar vacío")\n`;
        } else {
          code += `    @NotNull(message = "El campo '${a.name}' es obligatorio")\n`;
        }
      }
      code += `    private ${jType} ${a.name};\n\n`;
    }

    code += `}\n`;
    return code;
  }

  /**
   * CAPA 4: DTO RESPONSE
   */
  private static generateResponseDto(cls: UmlClass): string {
    const pkAttr = cls.attributes?.find((a) => a.isPk) || { type: 'Long' };
    const pkType = this.mapToJavaType(pkAttr.type);
    const attrs = cls.attributes || [];

    let code = `package com.uagrm.casecase.dto.response;\n\n`;
    code += `import lombok.*;\n`;
    code += `import java.time.LocalDate;\n`;
    code += `import java.time.LocalDateTime;\n`;
    code += `import java.math.BigDecimal;\n\n`;

    code += `/**\n * Capa 4: DTO de Salida para representar ${cls.name} en contratos API REST\n */\n`;
    code += `@Getter\n@Setter\n@NoArgsConstructor\n@AllArgsConstructor\n@Builder\n`;
    code += `public class ${cls.name}ResponseDTO {\n\n`;
    code += `    private ${pkType} id;\n\n`;

    for (const a of attrs) {
      if (a.isPk && a.name.toLowerCase() === 'id') continue;
      const jType = this.mapToJavaType(a.type);
      code += `    private ${jType} ${a.name};\n\n`;
    }

    code += `}\n`;
    return code;
  }

  /**
   * CAPA 5: REST CONTROLLER
   */
  private static generateController(cls: UmlClass): string {
    const pkAttr = cls.attributes?.find((a) => a.isPk) || { type: 'Long' };
    const pkType = this.mapToJavaType(pkAttr.type);
    const serviceVar = toCamelCase(cls.name) + 'Service';
    const basePath = `/api/v1/${toKebabCase(cls.name)}s`;

    let code = `package com.uagrm.casecase.controller;\n\n`;
    code += `import com.uagrm.casecase.service.${cls.name}Service;\n`;
    code += `import com.uagrm.casecase.dto.request.${cls.name}RequestDTO;\n`;
    code += `import com.uagrm.casecase.dto.response.${cls.name}ResponseDTO;\n`;
    code += `import org.springframework.http.HttpStatus;\n`;
    code += `import org.springframework.http.ResponseEntity;\n`;
    code += `import org.springframework.web.bind.annotation.*;\n`;
    code += `import jakarta.validation.Valid;\n`;
    code += `import java.util.List;\n\n`;

    code += `/**\n * Capa 5: Controlador RESTful para la entidad ${cls.name}\n * Endpoints CRUD desacoplados bajo estándar OpenAPI / Spring Web\n */\n`;
    code += `@RestController\n`;
    code += `@RequestMapping("${basePath}")\n`;
    code += `@CrossOrigin(origins = "*")\n`;
    code += `public class ${cls.name}Controller {\n\n`;
    code += `    private final ${cls.name}Service ${serviceVar};\n\n`;
    code += `    public ${cls.name}Controller(${cls.name}Service ${serviceVar}) {\n`;
    code += `        this.${serviceVar} = ${serviceVar};\n`;
    code += `    }\n\n`;

    // GET all
    code += `    @GetMapping\n`;
    code += `    public ResponseEntity<List<${cls.name}ResponseDTO>> getAll() {\n`;
    code += `        return ResponseEntity.ok(${serviceVar}.findAll());\n`;
    code += `    }\n\n`;

    // GET by ID
    code += `    @GetMapping("/{id}")\n`;
    code += `    public ResponseEntity<${cls.name}ResponseDTO> getById(@PathVariable ${pkType} id) {\n`;
    code += `        return ${serviceVar}.findById(id)\n`;
    code += `                .map(ResponseEntity::ok)\n`;
    code += `                .orElse(ResponseEntity.notFound().build());\n`;
    code += `    }\n\n`;

    // POST create
    code += `    @PostMapping\n`;
    code += `    public ResponseEntity<${cls.name}ResponseDTO> create(@Valid @RequestBody ${cls.name}RequestDTO request) {\n`;
    code += `        ${cls.name}ResponseDTO created = ${serviceVar}.create(request);\n`;
    code += `        return ResponseEntity.status(HttpStatus.CREATED).body(created);\n`;
    code += `    }\n\n`;

    // PUT update
    code += `    @PutMapping("/{id}")\n`;
    code += `    public ResponseEntity<${cls.name}ResponseDTO> update(\n`;
    code += `            @PathVariable ${pkType} id,\n`;
    code += `            @Valid @RequestBody ${cls.name}RequestDTO request) {\n`;
    code += `        try {\n`;
    code += `            return ResponseEntity.ok(${serviceVar}.update(id, request));\n`;
    code += `        } catch (RuntimeException e) {\n`;
    code += `            return ResponseEntity.notFound().build();\n`;
    code += `        }\n`;
    code += `    }\n\n`;

    // DELETE
    code += `    @DeleteMapping("/{id}")\n`;
    code += `    public ResponseEntity<Void> delete(@PathVariable ${pkType} id) {\n`;
    code += `        try {\n`;
    code += `            ${serviceVar}.delete(id);\n`;
    code += `            return ResponseEntity.noContent().build();\n`;
    code += `        } catch (RuntimeException e) {\n`;
    code += `            return ResponseEntity.notFound().build();\n`;
    code += `        }\n`;
    code += `    }\n`;

    code += `}\n`;
    return code;
  }

  /**
   * Main Spring Boot Application Class
   */
  private static generateMainClass(): string {
    return `package com.uagrm.casecase;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Clase principal de inicio para la aplicación generada por Collaborative CASE UML
 * Arquitectura de 5 Capas: Entity, Repository, Service, DTO, Controller
 */
@SpringBootApplication
public class CaseApplication {

    public static void main(String[] args) {
        SpringApplication.run(CaseApplication.class, args);
        System.out.println(">>> Backend Spring Boot 3.3.4 (5 Capas) iniciado exitosamente.");
    }
}
`;
  }

  /**
   * application.properties
   */
  private static generateApplicationProperties(projectName: string): string {
    const dbName = 'case_collaborative_db';
    return `# ==============================================================================
# CONFIGURACIÓN DE BACKEND SPRING BOOT 3.3.4 (UAGRM - SW1)
# Proyecto: ${projectName}
# Generado automáticamente por Plataforma Web CASE UML Colaborativa
# ==============================================================================

spring.application.name=case-collaborative-backend

# Servidor HTTP
server.port=8080

# Conexión PostgreSQL 17 Local
spring.datasource.url=jdbc:postgresql://localhost:5432/${dbName}
spring.datasource.username=postgres
spring.datasource.password=postgres
spring.datasource.driver-class-name=org.postgresql.Driver

# Configuración Hibernate / JPA
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.open-in-view=false

# Logging
logging.level.com.uagrm.casecase=DEBUG
logging.level.org.springframework.web=INFO
`;
  }

  /**
   * pom.xml
   */
  private static generatePomXml(projectName: string): string {
    const artifactId = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .slice(0, 30) || 'case-backend';

    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.4</version>
        <relativePath/>
    </parent>

    <groupId>com.uagrm.casecase</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <name>${projectName}</name>
    <description>Backend Spring Boot en 5 capas generado por Collaborative CASE UML</description>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Starters -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Driver PostgreSQL -->
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>

        <!-- Lombok para código limpio -->
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
`;
  }

  /**
   * README.md
   */
  private static generateReadme(projectName: string, classesCount: number): string {
    return `# Solución Backend Spring Boot 3 (Patrón 5 Capas)

**Proyecto:** ${projectName}  
**Materia:** Ingeniería de Software 1 — UAGRM  
**Entidades Generadas:** ${classesCount}  
**Patrón Arquitectónico:** 5 Capas Desacopladas (Entity, Repository, Service, DTO, Controller)  

---

## 1. Estructura Arquitectónica

\`\`\`text
src/main/java/com/uagrm/casecase/
├── entity/          # Capa 1: Entidades JPA con relaciones y claves foráneas
├── repository/      # Capa 2: Repositorios Spring Data JPA
├── service/         # Capa 3: Interfaces y lógica transaccional de negocio
│   └── impl/
├── dto/             # Capa 4: Contratos de entrada (Request) y salida (Response)
│   ├── request/
│   └── response/
└── controller/      # Capa 5: Endpoints RESTful con validaciones y códigos HTTP
\`\`\`

---

## 2. Requisitos Previos

* Java Development Kit (JDK) 17 o 21
* Maven 3.8+
* PostgreSQL 17 en ejecución en \`localhost:5432\` con base de datos \`case_collaborative_db\`

---

## 3. Ejecución del Proyecto

\`\`\`bash
# Compilar e iniciar en modo desarrollo
./mvnw spring-boot:run

# O con Maven instalado:
mvn clean spring-boot:run
\`\`\`

La API REST estará disponible en \`http://localhost:8080/api/v1/\`.
`;
  }
}

// Helpers de formato de strings
function toSnakeCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function toCamelCase(str: string): string {
  if (!str) return '';
  const s = str.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''));
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function toKebabCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\\s]+/g, '-')
    .toLowerCase();
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
