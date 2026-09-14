export type AiIntentType =
  | 'CREAR_CLASE'
  | 'AGREGAR_ATRIBUTO'
  | 'AGREGAR_METODO'
  | 'CREAR_RELACION'
  | 'ELIMINAR_ATRIBUTO'
  | 'ELIMINAR_CLASE'
  | 'RENOMBRAR_CLASE'
  | 'DESCONOCIDO';

export interface ParsedAiCommand {
  intent: AiIntentType;
  entities: {
    className?: string;
    targetClassName?: string;
    newClassName?: string;
    attributeName?: string;
    attributeType?: string;
    isPk?: boolean;
    visibility?: '+' | '-' | '#' | '~';
    methodName?: string;
    returnType?: string;
    relationshipType?: string;
    sourceMultiplicity?: string;
    targetMultiplicity?: string;
    stereotype?: string;
  };
  confidence: number;
  rawTranscript: string;
}

export class AiNlpService {
  /**
   * Normaliza texto eliminando signos de puntuación periféricos y múltiples espacios
   */
  private static cleanText(text: string): string {
    return text
      .trim()
      .replace(/[.,;:¿?¡!]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Mapea expresiones coloquiales de tipos de datos a tipos estándar Java / SQL
   */
  public static mapDataType(rawType: string): string {
    const t = rawType.toLowerCase().trim();
    if (['string', 'cadena', 'texto', 'varchar'].includes(t)) return 'String';
    if (['int', 'entero', 'integer', 'numero'].includes(t)) return 'Integer';
    if (['long', 'bigint', 'id', 'identificador'].includes(t)) return 'Long';
    if (['boolean', 'booleano', 'flag'].includes(t)) return 'Boolean';
    if (['double', 'float', 'decimal', 'precio', 'monto', 'saldo'].includes(t)) return 'BigDecimal';
    if (['date', 'fecha'].includes(t)) return 'LocalDate';
    if (['datetime', 'fechahora', 'timestamp', 'hora'].includes(t)) return 'LocalDateTime';
    if (['void', 'vacio', 'vacío', 'nada'].includes(t)) return 'void';
    return rawType.charAt(0).toUpperCase() + rawType.slice(1);
  }

  /**
   * Mapea expresiones de multiplicidad a notación estándar UML
   */
  public static mapMultiplicities(raw: string): { source: string; target: string } {
    const r = raw.toLowerCase().trim();
    if (r.includes('muchos a muchos') || r.includes('n a n') || r.includes('* a *')) {
      return { source: '1..*', target: '1..*' };
    }
    if (r.includes('muchos a 1') || r.includes('muchos a uno') || r.includes('n a 1')) {
      return { source: '1..*', target: '1..1' };
    }
    if (r.includes('1 a 1') || r.includes('uno a uno') || r.includes('uno a 1')) {
      return { source: '1..1', target: '1..1' };
    }
    // Por defecto: 1 a muchos
    return { source: '1..1', target: '1..*' };
  }

  /**
   * Extrae la intención y las entidades del comando de voz o texto
   */
  public static parseIntent(transcript: string): ParsedAiCommand {
    const cleaned = this.cleanText(transcript);
    const lower = cleaned.toLowerCase();

    // 1. CREAR CLASE: "Crea la clase Paciente", "Crear clase Medico con estereotipo service"
    const createClassRegex = /^(?:crea|crear|añade|añadir|agrega|agregar)\s+(?:la\s+)?clase\s+([a-zA-Z0-9_]+)(?:\s+(?:con\s+estereotipo|estereotipo)\s+([a-zA-Z0-9_]+))?/i;
    const matchClass = cleaned.match(createClassRegex);
    if (matchClass) {
      return {
        intent: 'CREAR_CLASE',
        entities: {
          className: matchClass[1],
          stereotype: matchClass[2] || 'entity',
        },
        confidence: 0.95,
        rawTranscript: transcript,
      };
    }

    // 2. RENOMBRAR CLASE: "Renombra la clase Paciente a PacienteAmbulatorio"
    const renameClassRegex = /^(?:renombra|renombrar|cambia el nombre de|cambiar el nombre de)\s+(?:la\s+clase\s+)?([a-zA-Z0-9_]+)\s+a\s+([a-zA-Z0-9_]+)/i;
    const matchRename = cleaned.match(renameClassRegex);
    if (matchRename) {
      return {
        intent: 'RENOMBRAR_CLASE',
        entities: {
          className: matchRename[1],
          newClassName: matchRename[2],
        },
        confidence: 0.92,
        rawTranscript: transcript,
      };
    }

    // 3. ELIMINAR ATRIBUTO: "Elimina el atributo obsoleto en HistoriaClinica" o "Elimina el atributo direccion de Paciente"
    const delAttrRegex = /^(?:elimina|eliminar|borra|borrar|quita|quitar)\s+el\s+atributo\s+([a-zA-Z0-9_]+)\s+(?:en|de)\s+([a-zA-Z0-9_]+)/i;
    const matchDelAttr = cleaned.match(delAttrRegex);
    if (matchDelAttr) {
      return {
        intent: 'ELIMINAR_ATRIBUTO',
        entities: {
          attributeName: matchDelAttr[1],
          className: matchDelAttr[2],
        },
        confidence: 0.94,
        rawTranscript: transcript,
      };
    }

    // 4. ELIMINAR CLASE: "Elimina la clase Temporal", "Borrar clase Auditoria"
    const delClassRegex = /^(?:elimina|eliminar|borra|borrar)\s+(?:la\s+)?clase\s+([a-zA-Z0-9_]+)/i;
    const matchDelClass = cleaned.match(delClassRegex);
    if (matchDelClass) {
      return {
        intent: 'ELIMINAR_CLASE',
        entities: {
          className: matchDelClass[1],
        },
        confidence: 0.95,
        rawTranscript: transcript,
      };
    }

    // 5. AGREGAR ATRIBUTO:
    // "Añade a Paciente el atributo direccion tipo string"
    // "Agrega a Consulta el atributo fecha de tipo datetime como clave primaria"
    // "Crea en Medico el atributo telefono tipo varchar"
    const addAttrRegex1 = /^(?:añade|añadir|agrega|agregar|crea|crear)\s+(?:a|en)\s+([a-zA-Z0-9_]+)\s+(?:el\s+atributo\s+)?([a-zA-Z0-9_]+)\s+(?:tipo|de\s+tipo)\s+([a-zA-Z0-9_()]+)(.*)?/i;
    const matchAttr1 = cleaned.match(addAttrRegex1);
    if (matchAttr1) {
      const isPk = matchAttr1[4] ? /clave primaria|primary key|pk/i.test(matchAttr1[4]) : false;
      return {
        intent: 'AGREGAR_ATRIBUTO',
        entities: {
          className: matchAttr1[1],
          attributeName: matchAttr1[2],
          attributeType: this.mapDataType(matchAttr1[3]),
          isPk,
          visibility: isPk ? '-' : '-',
        },
        confidence: 0.95,
        rawTranscript: transcript,
      };
    }

    // Variante 5b: "Añade el atributo direccion tipo string a Paciente"
    const addAttrRegex2 = /^(?:añade|añadir|agrega|agregar|crea|crear)\s+el\s+atributo\s+([a-zA-Z0-9_]+)\s+(?:tipo|de\s+tipo)\s+([a-zA-Z0-9_()]+)\s+(?:a|en)\s+([a-zA-Z0-9_]+)(.*)?/i;
    const matchAttr2 = cleaned.match(addAttrRegex2);
    if (matchAttr2) {
      const isPk = matchAttr2[4] ? /clave primaria|primary key|pk/i.test(matchAttr2[4]) : false;
      return {
        intent: 'AGREGAR_ATRIBUTO',
        entities: {
          className: matchAttr2[3],
          attributeName: matchAttr2[1],
          attributeType: this.mapDataType(matchAttr2[2]),
          isPk,
          visibility: isPk ? '-' : '-',
        },
        confidence: 0.95,
        rawTranscript: transcript,
      };
    }

    // 6. AGREGAR MÉTODO:
    // "Añade el método calcularEdad a Paciente que retorna int"
    // "Agrega a Medico el metodo registrarConsulta de retorno void"
    const addMethodRegex = /^(?:añade|añadir|agrega|agregar|crea|crear)\s+(?:el\s+m[eé]todo\s+([a-zA-Z0-9_]+)\s+(?:a|en)\s+([a-zA-Z0-9_]+)|(?:a|en)\s+([a-zA-Z0-9_]+)\s+el\s+m[eé]todo\s+([a-zA-Z0-9_]+))(?:\s+(?:que\s+retorna|de\s+retorno|retorno)\s+([a-zA-Z0-9_<>]+))?/i;
    const matchMethod = cleaned.match(addMethodRegex);
    if (matchMethod) {
      const methodName = matchMethod[1] || matchMethod[4];
      const className = matchMethod[2] || matchMethod[3];
      const rawRet = matchMethod[5] || 'void';
      return {
        intent: 'AGREGAR_METODO',
        entities: {
          className,
          methodName,
          returnType: this.mapDataType(rawRet),
          visibility: '+',
        },
        confidence: 0.92,
        rawTranscript: transcript,
      };
    }

    // 7. CREAR RELACIÓN:
    // "Relaciona Medico con Consulta de 1 a muchos"
    // "Relaciona Medico y Consulta de 1 a muchos tipo composicion"
    // "Conecta Paciente con HistorialClinico de 1 a 1"
    const relRegex = /^(?:relaciona|relacionar|conecta|conectar|vincula|vincular|asocia|asociar)\s+([a-zA-Z0-9_]+)\s+(?:con|y)\s+([a-zA-Z0-9_]+)(?:\s+(?:de\s+)?(1\s+a\s+muchos|muchos\s+a\s+muchos|1\s+a\s+1|muchos\s+a\s+1|n\s+a\s+n|1\s+a\s+n))?(?:\s+(?:tipo\s+([a-zA-Z0-9_]+)|como\s+([a-zA-Z0-9_]+)))?/i;
    const matchRel = cleaned.match(relRegex);
    if (matchRel) {
      const sourceClass = matchRel[1];
      const targetClass = matchRel[2];
      const rawMult = matchRel[3] || '1 a muchos';
      const rawType = matchRel[4] || matchRel[5] || 'association';

      const mults = this.mapMultiplicities(rawMult);

      let relType = 'association';
      if (/composici[oó]n|composition/i.test(rawType)) relType = 'composition';
      else if (/agregaci[oó]n|aggregation/i.test(rawType)) relType = 'aggregation';
      else if (/herencia|generalizaci[oó]n|inheritance/i.test(rawType)) relType = 'generalization';
      else if (/dependencia|dependency/i.test(rawType)) relType = 'dependency';

      return {
        intent: 'CREAR_RELACION',
        entities: {
          className: sourceClass,
          targetClassName: targetClass,
          sourceMultiplicity: mults.source,
          targetMultiplicity: mults.target,
          relationshipType: relType,
        },
        confidence: 0.93,
        rawTranscript: transcript,
      };
    }

    // No reconocida
    return {
      intent: 'DESCONOCIDO',
      entities: {},
      confidence: 0.2,
      rawTranscript: transcript,
    };
  }
}
