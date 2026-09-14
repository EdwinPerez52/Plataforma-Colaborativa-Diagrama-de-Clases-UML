import React, { useState, useEffect, useCallback } from 'react';
import { UmlCanvas, RemoteCursorVisual } from './components/canvas/UmlCanvas';
import { ErrorBoundary } from './components/canvas/ErrorBoundary';
import { InspectorPanel } from './components/inspector/InspectorPanel';
import { CanvasToolbar } from './components/toolbar/CanvasToolbar';
import { AiAssistantDrawer } from './components/ai/AiAssistantDrawer';
import { VisionModal } from './components/vision/VisionModal';
import { XmiInteroperabilityModal } from './components/xmi/XmiInteroperabilityModal';
import { BackendGeneratorModal } from './components/generator/BackendGeneratorModal';
import { WorkingDiagramsPanel } from './components/diagrams/WorkingDiagramsPanel';
import { DiagramTabBar } from './components/diagrams/DiagramTabBar';
import { NodeLockVisual } from './components/canvas/UmlClassNode';
import { UmlClass, UmlRelationship, UmlVisibility, UmlAttribute, DiagramModel, DiagramType } from './types/uml';
import { exportToPdf, exportToPng, exportToJpeg, exportToSvg } from './utils/exportDiagram';
import { api } from './services/api';
import { collabSocket } from './services/socket';
import { PanelRightOpen } from 'lucide-react';

export const App: React.FC = () => {
  const [projectId, setProjectId] = useState<number>(1);
  const [projectTitle, setProjectTitle] = useState<string>('Diagrama CASE UML');
  const [roomCode, setRoomCode] = useState<string>('sala-colaborativa-1');
  const [currentUserId, setCurrentUserId] = useState<string>('1');
  const [currentUserName, setCurrentUserName] = useState<string>('Ingeniero Diseñador');
  const [classes, setClasses] = useState<UmlClass[]>([]);
  const [relationships, setRelationships] = useState<UmlRelationship[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramModel[]>(() => {
    try {
      const saved = localStorage.getItem(`case_diagrams_${1}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return [
      {
        id: 'diagram-main',
        name: 'Main — Model',
        type: 'class',
        classes: [],
        relationships: [],
      },
    ];
  });
  const [activeDiagramId, setActiveDiagramId] = useState<string>(() => diagrams[0]?.id || 'diagram-main');
  const [isWorkingDiagramsOpen, setIsWorkingDiagramsOpen] = useState<boolean>(true);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [gridSnap] = useState<number>(20);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [inspectorWidth, setInspectorWidth] = useState<number>(360);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('case_theme') as 'dark' | 'light') || 'dark';
  });
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [activeLocks, setActiveLocks] = useState<Record<string, NodeLockVisual>>({});
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursorVisual>>({});
  const [lockWarning, setLockWarning] = useState<string | null>(null);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [isVisionModalOpen, setIsVisionModalOpen] = useState<boolean>(false);
  const [isXmiModalOpen, setIsXmiModalOpen] = useState<boolean>(false);
  const [isBackendModalOpen, setIsBackendModalOpen] = useState<boolean>(false);

  // Guardar diagramas en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`case_diagrams_${projectId}`, JSON.stringify(diagrams));
    } catch (e) {
      // ignore
    }
  }, [diagrams, projectId]);

  // Mantener el diagrama activo sincronizado con el estado del lienzo
  useEffect(() => {
    setDiagrams((prev) =>
      prev.map((diag) =>
        diag.id === activeDiagramId
          ? { ...diag, classes, relationships }
          : diag
      )
    );
  }, [classes, relationships, activeDiagramId]);

  // Sincronizar tema con localStorage y documentElement
  useEffect(() => {
    localStorage.setItem('case_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // 1. Cargar diagrama inicial desde PostgreSQL
  const loadDiagram = useCallback(async (pId: number) => {
    try {
      const res = await api.getDiagram(pId);
      if (res && res.success && res.diagram && res.diagram.classes && res.diagram.classes.length > 0) {
        const diagramTitle = res.diagram.name && !res.diagram.name.includes('Sistema Nacional')
          ? res.diagram.name
          : 'Diagrama CASE UML';
        setProjectTitle(diagramTitle);
        setClasses(res.diagram.classes || []);
        setRelationships(res.diagram.relationships || []);
        setDiagrams((prev) => {
          if (prev.length <= 1 && (prev[0]?.classes.length === 0 || prev[0]?.id === 'diagram-main')) {
            return [
              {
                id: 'diagram-main',
                name: diagramTitle,
                type: 'class',
                classes: res.diagram.classes || [],
                relationships: res.diagram.relationships || [],
              },
            ];
          }
          return prev;
        });
        return;
      }
    } catch (err) {
      console.warn('Fallo al cargar diagrama remoto, cargando plantilla demo:', err);
    }

    // Fallback genérico si no hay clases en el servidor
    const defaultClasses: UmlClass[] = [
      {
        id: '1',
        dbId: 1,
        name: 'Usuario',
        stereotype: 'entity',
        isAbstract: false,
        position: { x: 140, y: 120 },
        dimensions: { width: 220, height: 180 },
        attributes: [
          { id: 'a1', name: 'id', type: 'Long', visibility: '-', isPk: true, isNullable: false },
          { id: 'a2', name: 'nombre', type: 'String', visibility: '-', isPk: false, isNullable: false },
          { id: 'a3', name: 'email', type: 'String', visibility: '-', isPk: false, isNullable: false },
        ],
        methods: [
          { id: 'm1', name: 'autenticar', returnType: 'Boolean', visibility: '+' },
        ],
      },
      {
        id: '2',
        dbId: 2,
        name: 'Rol',
        stereotype: 'entity',
        isAbstract: false,
        position: { x: 520, y: 120 },
        dimensions: { width: 230, height: 180 },
        attributes: [
          { id: 'a4', name: 'id', type: 'Long', visibility: '-', isPk: true, isNullable: false },
          { id: 'a5', name: 'nombreRol', type: 'String', visibility: '-', isPk: false, isNullable: false },
        ],
        methods: [
          { id: 'm2', name: 'obtenerPermisos', returnType: 'List', visibility: '+' },
        ],
      },
    ];

    const defaultRels: UmlRelationship[] = [
      {
        id: 'r1',
        dbId: 1,
        sourceClassId: '1',
        targetClassId: '2',
        type: 'association',
        sourceMultiplicity: '1..*',
        targetMultiplicity: '1..1',
        name: 'tiene',
        isBidirectional: true,
      },
    ];

    setClasses(defaultClasses);
    setRelationships(defaultRels);
    setDiagrams((prev) => {
      if (prev.length <= 1 && (prev[0]?.classes.length === 0 || prev[0]?.id === 'diagram-main')) {
        return [
          {
            id: 'diagram-main',
            name: 'Main — Model',
            type: 'class',
            classes: defaultClasses,
            relationships: defaultRels,
          },
        ];
      }
      return prev;
    });
  }, []);

  // 2. Conectar WebSockets con control de exclusión mutua distribuida
  useEffect(() => {
    const initAuthAndDiagram = async () => {
      let token = localStorage.getItem('case_jwt_token');
      if (!token) {
        try {
          const authRes = await api.getGuestToken();
          if (authRes && authRes.success && authRes.data?.token) {
            token = authRes.data.token;
            localStorage.setItem('case_jwt_token', token || '');
            if (authRes.data.user) {
              setCurrentUserId(String(authRes.data.user.id));
              setCurrentUserName(authRes.data.user.nombre);
            }
          }
        } catch (e) {
          console.error('Error al inicializar sesión:', e);
        }
      }
      await loadDiagram(projectId);
    };

    initAuthAndDiagram();

    // Conectar Socket.IO
    const socket = collabSocket.connect(roomCode, projectId, currentUserName);

    socket.on('active_locks', (locks: any[]) => {
      const lockMap: Record<string, NodeLockVisual> = {};
      locks.forEach((l) => {
        lockMap[String(l.classId)] = {
          userId: String(l.userId),
          userName: l.userName,
          userCargo: l.userCargo,
          userColor: '#f43f5e',
          expiraEn: l.expiraEn,
        };
      });
      setActiveLocks(lockMap);
    });

    socket.on('node:locked', (data: any) => {
      setActiveLocks((prev) => ({
        ...prev,
        [String(data.classId || data.nodeId)]: {
          userId: String(data.userId),
          userName: data.userName,
          userCargo: data.userCargo,
          userColor: '#f43f5e',
          expiraEn: data.expiraEn,
        },
      }));
    });

    socket.on('node:released', (data: any) => {
      setActiveLocks((prev) => {
        const next = { ...prev };
        delete next[String(data.classId || data.nodeId)];
        return next;
      });
    });

    socket.on('diagram:updated', () => {
      loadDiagram(projectId);
    });

    socket.on('cursor_moved', (data: { userId: string; userName: string; color: string; cursor: { x: number; y: number } }) => {
      if (data.userId === currentUserId) return;
      setRemoteCursors((prev) => ({
        ...prev,
        [data.userId]: {
          x: data.cursor.x,
          y: data.cursor.y,
          userName: data.userName || 'Colega',
          color: data.color || '#38bdf8',
        },
      }));
    });

    return () => {
      collabSocket.disconnect();
    };
  }, [loadDiagram, projectId, roomCode, currentUserName, currentUserId]);

  // 3. Selección y Solicitud de Bloqueo Atómico
  const handleSelectClass = (cls: UmlClass | null, isMulti = false) => {
    if (!cls) {
      if (selectedClassId) {
        const prevClass = classes.find((c) => c.id === selectedClassId);
        const cId = prevClass?.dbId || parseInt(selectedClassId, 10);
        if (!isNaN(cId)) {
          collabSocket.releaseLock(roomCode, projectId, cId);
        }
      }
      setSelectedClassId(null);
      setSelectedClassIds([]);
      return;
    }

    if (isMulti) {
      setSelectedClassIds((prev) => {
        const exists = prev.includes(cls.id);
        const next = exists ? prev.filter((id) => id !== cls.id) : [...prev, cls.id];
        setSelectedClassId(next[next.length - 1] || null);
        return next;
      });
      setIsInspectorOpen(true); // Se despliega automáticamente
      return;
    }

    // Selección simple
    if (selectedClassId && selectedClassId !== cls.id) {
      const prevClass = classes.find((c) => c.id === selectedClassId);
      const cId = prevClass?.dbId || parseInt(selectedClassId, 10);
      if (!isNaN(cId)) {
        collabSocket.releaseLock(roomCode, projectId, cId);
      }
    }

    const classKey = cls.dbId ? String(cls.dbId) : cls.id;
    const existingLock = activeLocks[classKey] || activeLocks[cls.id];

    // Exclusión mutua: Solo bloquear si pertenece a otro usuario
    const isLockedByOther = Boolean(
      existingLock &&
      existingLock.userId !== currentUserId &&
      String(existingLock.userId) !== String(currentUserId) &&
      (!currentUserName ||
        (existingLock.userName &&
          existingLock.userName.trim().toLowerCase() !== currentUserName.trim().toLowerCase()))
    );

    if (isLockedByOther) {
      setLockWarning(`No puedes editar '${cls.name}'. Está siendo editada por ${existingLock.userName}`);
      setTimeout(() => setLockWarning(null), 3500);
      return;
    }

    setSelectedClassId(cls.id);
    setSelectedClassIds([cls.id]);
    setIsInspectorOpen(true); // Se despliega automáticamente para editar atributos y métodos

    const numId = cls.dbId || parseInt(cls.id, 10);
    if (!isNaN(numId)) {
      collabSocket.requestLock(roomCode, projectId, numId);
      collabSocket.startHeartbeat(projectId, numId);
    }
  };

  const handleSelectRelationship = (rel: UmlRelationship | null) => {
    setSelectedRelationshipId(rel ? rel.id : null);
    if (rel) {
      setSelectedClassId(null);
      setSelectedClassIds([]);
      setIsInspectorOpen(true); // Se despliega automáticamente
    }
  };

  const handleClearSelection = () => {
    if (selectedClassId) {
      const prevClass = classes.find((c) => c.id === selectedClassId);
      const cId = prevClass?.dbId || parseInt(selectedClassId, 10);
      if (!isNaN(cId)) {
        collabSocket.releaseLock(roomCode, projectId, cId);
      }
    }
    setSelectedClassId(null);
    setSelectedClassIds([]);
    setSelectedRelationshipId(null);
  };

  // Seleccionar todas las clases (Ctrl+A o botón en toolbar)
  const handleSelectAll = () => {
    if (selectedClassIds.length === classes.length && classes.length > 0) {
      handleClearSelection();
    } else {
      const allIds = classes.map((c) => c.id);
      setSelectedClassIds(allIds);
      setSelectedClassId(classes[0]?.id || null);
      setSelectedRelationshipId(null);
      setIsInspectorOpen(true);
    }
  };

  // 3.1 Gestión de Múltiples Diagramas de Trabajo (Working Diagrams)
  const handleSelectDiagram = useCallback((targetId: string) => {
    if (targetId === activeDiagramId) return;
    handleClearSelection();
    setDiagrams((prev) => {
      const target = prev.find((d) => d.id === targetId);
      if (target) {
        setActiveDiagramId(target.id);
        setClasses(target.classes || []);
        setRelationships(target.relationships || []);
        setProjectTitle(target.name);
      }
      return prev;
    });
  }, [activeDiagramId]);

  const handleCreateDiagram = useCallback((name: string, type: DiagramType = 'class') => {
    handleClearSelection();
    const newId = `diag-${Date.now()}`;
    const newDiagram: DiagramModel = {
      id: newId,
      name,
      type,
      classes: [],
      relationships: [],
    };
    setDiagrams((prev) => [...prev, newDiagram]);
    setActiveDiagramId(newId);
    setClasses([]);
    setRelationships([]);
    setProjectTitle(name);
  }, []);

  const handleRenameDiagram = useCallback((id: string, newName: string) => {
    setDiagrams((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: newName } : d))
    );
    if (activeDiagramId === id) {
      setProjectTitle(newName);
    }
  }, [activeDiagramId]);

  const handleDuplicateDiagram = useCallback((id: string) => {
    setDiagrams((prev) => {
      const source = prev.find((d) => d.id === id);
      if (!source) return prev;
      const newId = `diag-${Date.now()}`;
      const duplicatedClasses = JSON.parse(JSON.stringify(source.classes || []));
      const duplicatedRels = JSON.parse(JSON.stringify(source.relationships || []));
      const newDiagram: DiagramModel = {
        id: newId,
        name: `${source.name} (Copia)`,
        type: source.type || 'class',
        classes: duplicatedClasses,
        relationships: duplicatedRels,
      };
      setActiveDiagramId(newId);
      setClasses(duplicatedClasses);
      setRelationships(duplicatedRels);
      setProjectTitle(newDiagram.name);
      return [...prev, newDiagram];
    });
  }, []);

  const handleDeleteDiagram = useCallback((id: string) => {
    setDiagrams((prev) => {
      if (prev.length <= 1) {
        alert('No se puede eliminar el único diagrama de trabajo.');
        return prev;
      }
      const remaining = prev.filter((d) => d.id !== id);
      if (activeDiagramId === id) {
        const nextActive = remaining[0];
        setActiveDiagramId(nextActive.id);
        setClasses(nextActive.classes || []);
        setRelationships(nextActive.relationships || []);
        setProjectTitle(nextActive.name);
      }
      return remaining;
    });
  }, [activeDiagramId]);

  // Exportar Diagrama a PDF, PNG, JPEG o SVG
  const handleExportDiagram = useCallback((format: 'pdf' | 'png' | 'jpeg' | 'svg', targetDiagramId?: string) => {
    const targetId = targetDiagramId || activeDiagramId;
    const target = diagrams.find((d) => d.id === targetId);
    const targetClasses = targetId === activeDiagramId ? classes : (target?.classes || []);
    const targetRels = targetId === activeDiagramId ? relationships : (target?.relationships || []);
    const title = target?.name || projectTitle || 'Diagrama';

    switch (format) {
      case 'pdf':
        exportToPdf(targetClasses, targetRels, title);
        break;
      case 'png':
        exportToPng(targetClasses, targetRels, title);
        break;
      case 'jpeg':
        exportToJpeg(targetClasses, targetRels, title);
        break;
      case 'svg':
        exportToSvg(targetClasses, targetRels, title);
        break;
    }
  }, [activeDiagramId, diagrams, classes, relationships, projectTitle]);

  // 4. Operaciones de Creación y Movimiento
  const handleAddClassAtPosition = async (pos: { x: number; y: number }) => {
    let counter = 1;
    let newName = `Clase${classes.length + counter}`;
    while (classes.some((c) => c.name.toLowerCase() === newName.toLowerCase())) {
      counter++;
      newName = `Clase${classes.length + counter}`;
    }

    try {
      const res = await api.createClass(projectId, {
        name: newName,
        stereotype: 'entity',
        isAbstract: false,
        position: pos,
        dimensions: { width: 210, height: 160 },
        attributes: [
          { id: 'tmp-id', name: 'id', type: 'Long', visibility: '-', isPk: true, isNullable: false },
        ],
      });

      if (res && res.success && res.class) {
        setClasses((prev) => [...prev, res.class!]);
        handleSelectClass(res.class!);
        return;
      }
    } catch (err) {
      console.warn('Error de red al crear clase:', err);
    }

    // Fallback local
    const localClass: UmlClass = {
      id: String(Date.now()),
      name: newName,
      stereotype: 'entity',
      isAbstract: false,
      position: pos,
      dimensions: { width: 210, height: 160 },
      attributes: [
        { id: String(Date.now()), name: 'id', type: 'Long', visibility: '-', isPk: true, isNullable: false },
      ],
      methods: [],
    };
    setClasses((prev) => [...prev, localClass]);
    handleSelectClass(localClass);
  };

  const handleAddClass = () => {
    const offset = classes.length;
    const x = 180 + (offset % 5) * 50;
    const y = 140 + Math.floor(offset / 5) * 40;
    handleAddClassAtPosition({ x, y });
  };

  const handleMoveClass = (classId: string, newPos: { x: number; y: number }) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === classId ? { ...c, position: newPos } : c))
    );
  };

  const handleMoveClassEnd = async (classId: string, newPos: { x: number; y: number }) => {
    const targetClass = classes.find((c) => c.id === classId);
    if (!targetClass) return;

    const dbId = targetClass.dbId || parseInt(classId, 10);
    if (!isNaN(dbId)) {
      try {
        await api.updateClass(dbId, { position: newPos });
      } catch (err) {
        console.error('Error al persistir posición:', err);
      }
    }
  };

  // Movimiento múltiple en grupo de todas las clases seleccionadas
  const handleMoveMultipleClasses = (positions: Record<string, { x: number; y: number }>) => {
    setClasses((prev) =>
      prev.map((c) => (positions[c.id] ? { ...c, position: positions[c.id] } : c))
    );
  };

  const handleMoveMultipleClassesEnd = async (positions: Record<string, { x: number; y: number }>) => {
    setClasses((prev) =>
      prev.map((c) => (positions[c.id] ? { ...c, position: positions[c.id] } : c))
    );

    for (const [id, pos] of Object.entries(positions)) {
      const target = classes.find((c) => c.id === id);
      const dbId = target?.dbId || parseInt(id, 10);
      if (!isNaN(dbId)) {
        try {
          await api.updateClass(dbId, { position: pos });
        } catch (err) {
          console.error(`Error al persistir posición de clase ${id}:`, err);
        }
      }
    }
  };

  const handleResizeClass = (classId: string, dimensions: { width: number; height: number }) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === classId ? { ...c, dimensions } : c))
    );
  };

  const handleResizeClassEnd = async (classId: string, dimensions: { width: number; height: number }) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === classId ? { ...c, dimensions } : c))
    );

    const targetClass = classes.find((c) => c.id === classId);
    const dbId = targetClass?.dbId || parseInt(classId, 10);
    if (!isNaN(dbId)) {
      try {
        await api.updateClass(dbId, { dimensions });
      } catch (err) {
        console.error(`Error al persistir dimensiones de clase ${classId}:`, err);
      }
    }
  };

  const handleUpdateClass = async (classId: string, data: Partial<UmlClass>) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === classId ? { ...c, ...data } : c))
    );

    const targetClass = classes.find((c) => c.id === classId);
    if (targetClass?.dbId) {
      try {
        await api.updateClass(targetClass.dbId, data);
      } catch (err) {
        console.error('Error al actualizar clase en PostgreSQL:', err);
      }
    }
  };

  const handleDeleteClass = async (classId: string) => {
    const targetClass = classes.find((c) => c.id === classId);
    const dbId = targetClass?.dbId || parseInt(classId, 10);

    if (!isNaN(dbId)) {
      collabSocket.releaseLock(roomCode, projectId, dbId);
    }

    setClasses((prev) => prev.filter((c) => c.id !== classId));
    setRelationships((prev) =>
      prev.filter((r) => r.sourceClassId !== classId && r.targetClassId !== classId)
    );
    setSelectedClassId(null);
    setSelectedClassIds((prev) => prev.filter((id) => id !== classId));

    if (targetClass?.dbId) {
      try {
        await api.deleteClass(targetClass.dbId);
      } catch (err) {
        console.error('Error al eliminar clase en PostgreSQL:', err);
      }
    }
  };

  // 5. Atributos
  const handleAddAttribute = async (
    classId: string,
    attr: { name: string; type: string; visibility: UmlVisibility; isPk: boolean; isFk?: boolean }
  ) => {
    const targetClass = classes.find((c) => c.id === classId);
    if (!targetClass) return;

    try {
      if (targetClass.dbId) {
        const res = await api.createAttribute(targetClass.dbId, attr);
        if (res.success && res.attribute) {
          setClasses((prev) =>
            prev.map((c) =>
              c.id === classId ? { ...c, attributes: [...c.attributes, res.attribute] } : c
            )
          );
          return;
        }
      }
    } catch {
      // fallback
    }

    const localAttr: UmlAttribute = {
      id: String(Date.now()),
      name: attr.name,
      type: attr.type,
      visibility: attr.visibility,
      isPk: attr.isPk,
      isFk: attr.isFk || false,
    };
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId ? { ...c, attributes: [...c.attributes, localAttr] } : c
      )
    );
  };

  const handleUpdateAttribute = async (attrId: string, data: Partial<UmlAttribute>) => {
    setClasses((prev) =>
      prev.map((c) => ({
        ...c,
        attributes: c.attributes.map((a) => (a.id === attrId ? { ...a, ...data } : a)),
      }))
    );

    const numericId = parseInt(attrId, 10);
    if (!isNaN(numericId)) {
      try {
        await api.updateAttribute(numericId, data);
      } catch (err) {
        console.error('Error al actualizar atributo:', err);
      }
    }
  };

  const handleDeleteAttribute = async (attrId: string) => {
    setClasses((prev) =>
      prev.map((c) => ({
        ...c,
        attributes: c.attributes.filter((a) => a.id !== attrId),
      }))
    );

    const numericId = parseInt(attrId, 10);
    if (!isNaN(numericId)) {
      try {
        await api.deleteAttribute(numericId);
      } catch (err) {
        console.error('Error al eliminar atributo:', err);
      }
    }
  };

  // 6. Métodos
  const handleAddMethod = async (
    classId: string,
    method: { name: string; returnType: string; visibility: UmlVisibility }
  ) => {
    const targetClass = classes.find((c) => c.id === classId);
    if (!targetClass) return;

    try {
      if (targetClass.dbId) {
        const res = await api.createMethod(targetClass.dbId, method);
        if (res.success && res.method) {
          setClasses((prev) =>
            prev.map((c) =>
              c.id === classId ? { ...c, methods: [...c.methods, res.method] } : c
            )
          );
          return;
        }
      }
    } catch {
      // fallback
    }

    const localMethod = {
      id: String(Date.now()),
      name: method.name,
      returnType: method.returnType,
      visibility: method.visibility,
    };
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId ? { ...c, methods: [...c.methods, localMethod] } : c
      )
    );
  };

  const handleDeleteMethod = async (methodId: string) => {
    setClasses((prev) =>
      prev.map((c) => ({
        ...c,
        methods: c.methods.filter((m) => m.id !== methodId),
      }))
    );

    const numericId = parseInt(methodId, 10);
    if (!isNaN(numericId)) {
      try {
        await api.deleteMethod(numericId);
      } catch (err) {
        console.error('Error al eliminar método:', err);
      }
    }
  };

  // 7. Relaciones
  const handleStartConnection = (sourceId: string) => {
    setConnectingSourceId(sourceId);
  };

  const handleAddDirectRelationship = async (relData: {
    sourceClassId: string;
    targetClassId: string;
    type: any;
    sourceMultiplicity?: any;
    targetMultiplicity?: any;
    name?: string;
    intermediateClassId?: string;
    intermediateTableId?: string;
  }) => {
    const sourceClass = classes.find((c) => c.id === relData.sourceClassId);
    const targetClass = classes.find((c) => c.id === relData.targetClassId);
    if (!sourceClass || !targetClass) return;

    let createdRel: UmlRelationship | null = null;
    if (sourceClass.dbId && targetClass.dbId) {
      try {
        const res = await api.createRelationship(projectId, {
          sourceClassId: sourceClass.dbId,
          targetClassId: targetClass.dbId,
          type: relData.type || 'association',
          sourceMultiplicity: relData.sourceMultiplicity !== undefined ? relData.sourceMultiplicity : '',
          targetMultiplicity: relData.targetMultiplicity !== undefined ? relData.targetMultiplicity : '',
          name: relData.name || '',
          isBidirectional: false,
        });

        if (res && res.success && res.relationship) {
          createdRel = {
            ...res.relationship,
            intermediateClassId: relData.intermediateClassId,
            intermediateTableId: relData.intermediateTableId,
          };
        }
      } catch (err) {
        console.warn('Fallo al persistir relación en BD, usando modo local:', err);
      }
    }

    if (!createdRel) {
      createdRel = {
        id: 'rel-' + Date.now(),
        sourceClassId: sourceClass.id,
        targetClassId: targetClass.id,
        type: relData.type || 'association',
        sourceMultiplicity: relData.sourceMultiplicity !== undefined ? relData.sourceMultiplicity : '',
        targetMultiplicity: relData.targetMultiplicity !== undefined ? relData.targetMultiplicity : '',
        name: relData.name || '',
        isBidirectional: false,
        intermediateClassId: relData.intermediateClassId,
        intermediateTableId: relData.intermediateTableId,
      };
    }

    setRelationships((prev) => [...prev, createdRel!]);
    setSelectedRelationshipId(createdRel.id);
    setIsInspectorOpen(true);
  };

  const handleCompleteConnection = async (targetId: string) => {
    if (!connectingSourceId) return;

    const isRecursive = connectingSourceId === targetId;

    await handleAddDirectRelationship({
      sourceClassId: connectingSourceId,
      targetClassId: targetId,
      type: 'association',
      sourceMultiplicity: isRecursive ? '0..1' : '1..1',
      targetMultiplicity: isRecursive ? '0..*' : '1..*',
      name: isRecursive ? 'recursiva' : 'relaciona',
    });

    setConnectingSourceId(null);
  };

  const handleCreateIntermediateClass = async (data: {
    sourceClassId: string;
    targetClassId: string;
    intermediateName?: string;
    originalRelId?: string;
  }) => {
    const sourceClass = classes.find((c) => c.id === data.sourceClassId);
    const targetClass = classes.find((c) => c.id === data.targetClassId);
    if (!sourceClass || !targetClass) return;

    const sourceName = sourceClass.name;
    const targetName = targetClass.name;
    const intermName = data.intermediateName || `${sourceName}_${targetName}`;

    // Posición intermedia centrada entre ambas clases con desfase Y
    const posX = Math.round((sourceClass.position.x + targetClass.position.x) / 2);
    const posY = Math.round((sourceClass.position.y + targetClass.position.y) / 2 + 130);

    let createdClass: UmlClass | null = null;
    if (projectId) {
      try {
        const res = await api.createClass(projectId, {
          name: intermName,
          stereotype: 'intermediate_table',
          isAbstract: false,
          position: { x: posX, y: posY },
          dimensions: { width: 210, height: 160 },
          backgroundColor: '#0f172a',
        });
        if (res && res.success && res.class) {
          createdClass = res.class;
          if (createdClass.dbId) {
            try {
              await api.createAttribute(createdClass.dbId, {
                name: `${sourceName.toLowerCase()}_id`,
                type: 'Long',
                visibility: '+',
                isPk: true,
                isFk: true,
                isNullable: false,
              });
              await api.createAttribute(createdClass.dbId, {
                name: `${targetName.toLowerCase()}_id`,
                type: 'Long',
                visibility: '+',
                isPk: true,
                isFk: true,
                isNullable: false,
              });
              await api.createAttribute(createdClass.dbId, {
                name: 'fecha_registro',
                type: 'LocalDate',
                visibility: '+',
                isNullable: false,
              });
            } catch (e) {
              console.warn('Error al insertar atributos en clase intermedia:', e);
            }
          }
        }
      } catch (err) {
        console.warn('Fallo al crear clase intermedia en BD, creando en local:', err);
      }
    }

    if (!createdClass) {
      createdClass = {
        id: 'class-interm-' + Date.now(),
        name: intermName,
        stereotype: 'association_class',
        isAbstract: false,
        attributes: [
          {
            id: 'attr-' + Date.now(),
            name: 'rol',
            type: 'String',
            visibility: '+',
            isPk: false,
            isNullable: true,
          },
        ],
        methods: [],
        position: { x: posX, y: posY },
        dimensions: { width: 190, height: 120 },
      };
    }

    // Si había una relación directa original, la actualizamos vinculándole la clase intermedia
    if (data.originalRelId) {
      await handleUpdateRelationship(data.originalRelId, {
        intermediateClassId: createdClass.id,
        intermediateTableId: createdClass.id,
      });
      setClasses((prev) => [...prev, createdClass!]);
      setSelectedClassId(createdClass.id);
      setSelectedClassIds([createdClass.id]);
      setSelectedRelationshipId(data.originalRelId);
      setIsInspectorOpen(true);
      return;
    }

    // Si no había relación directa previa, creamos la asociación principal entre Origen y Destino vinculada a la clase intermedia
    const newRelId = 'rel-' + Date.now();
    let createdRel: UmlRelationship | null = null;
    if (sourceClass.dbId && targetClass.dbId) {
      try {
        const res = await api.createRelationship(projectId, {
          sourceClassId: sourceClass.dbId,
          targetClassId: targetClass.dbId,
          type: 'association',
          sourceMultiplicity: '1..*',
          targetMultiplicity: '1..*',
          name: '',
          isBidirectional: false,
        });
        if (res && res.success && res.relationship) {
          createdRel = {
            ...res.relationship,
            intermediateClassId: createdClass.id,
            intermediateTableId: createdClass.id,
          };
        }
      } catch (e) {
        console.warn('Error al persistir relación con clase intermedia en BD:', e);
      }
    }

    if (!createdRel) {
      createdRel = {
        id: newRelId,
        sourceClassId: sourceClass.id,
        targetClassId: targetClass.id,
        type: 'association',
        sourceMultiplicity: '1..*',
        targetMultiplicity: '1..*',
        name: '',
        isBidirectional: false,
        intermediateClassId: createdClass.id,
        intermediateTableId: createdClass.id,
      };
    }

    setClasses((prev) => [...prev, createdClass!]);
    setRelationships((prev) => [...prev, createdRel!]);
    setSelectedClassId(createdClass.id);
    setSelectedClassIds([createdClass.id]);
    setSelectedRelationshipId(createdRel.id);
    setIsInspectorOpen(true);
  };

  const handleUpdateRelationship = async (relId: string, data: Partial<UmlRelationship>) => {
    setRelationships((prev) =>
      prev.map((r) => (r.id === relId ? { ...r, ...data } : r))
    );

    const targetRel = relationships.find((r) => r.id === relId);
    if (targetRel?.dbId) {
      try {
        await api.updateRelationship(targetRel.dbId, data);
      } catch (err) {
        console.error('Error al actualizar relación:', err);
      }
    }
  };

  const handleDeleteRelationship = async (relId: string) => {
    const targetRel = relationships.find((r) => r.id === relId);
    setRelationships((prev) => prev.filter((r) => r.id !== relId));
    setSelectedRelationshipId(null);

    if (targetRel?.dbId) {
      try {
        await api.deleteRelationship(targetRel.dbId);
      } catch (err) {
        console.error('Error al eliminar relación:', err);
      }
    }
  };

  // Difusión del cursor del mouse
  const handleCursorMove = (pos: { x: number; y: number }) => {
    collabSocket.emitCursorMove(roomCode, pos);
  };

  // Atajos de teclado: Delete / Backspace para borrar, Ctrl+A para seleccionar todo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute('contenteditable') === 'true';

      if (isInput) return;

      // Ctrl+A o Cmd+A: Seleccionar todas las clases
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Delete o Backspace: Eliminar entidades o relaciones seleccionadas
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClassIds.length > 0) {
          e.preventDefault();
          selectedClassIds.forEach((id) => handleDeleteClass(id));
          setSelectedClassIds([]);
        } else if (selectedClassId) {
          e.preventDefault();
          handleDeleteClass(selectedClassId);
        } else if (selectedRelationshipId) {
          e.preventDefault();
          handleDeleteRelationship(selectedRelationshipId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClassId, selectedClassIds, selectedRelationshipId, classes, relationships]);

  const selectedClass = classes.find((c) => c.id === selectedClassId) || null;
  const selectedRelationship =
    relationships.find((r) => r.id === selectedRelationshipId) || null;

  return (
    <div className={`flex flex-col w-screen h-screen overflow-hidden font-sans transition-colors duration-150 ${
      theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
    }`}>
      {/* Notificación Toast de Lock Denegado */}
      {lockWarning && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-rose-600/95 text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 border border-rose-400/40 animate-bounce">
          <span>⚠️ {lockWarning}</span>
        </div>
      )}

      {/* 1. Barra de Herramientas Superior */}
      <CanvasToolbar
        projectTitle={projectTitle}
        roomCode={roomCode}
        theme={theme}
        isAiDrawerOpen={isAiDrawerOpen}
        isInspectorOpen={isInspectorOpen}
        isWorkingDiagramsOpen={isWorkingDiagramsOpen}
        workingDiagramsCount={diagrams.length}
        isAllSelected={classes.length > 0 && selectedClassIds.length === classes.length}
        selectedCount={selectedClassIds.length}
        onAddClass={handleAddClass}
        onSelectAll={handleSelectAll}
        onToggleWorkingDiagrams={() => setIsWorkingDiagramsOpen((prev) => !prev)}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onToggleInspector={() => {
          setInspectorWidth((w) => (w < 260 ? 360 : w));
          setIsInspectorOpen((prev) => !prev);
        }}
        onToggleAiDrawer={() => setIsAiDrawerOpen((prev) => !prev)}
        onOpenVisionModal={() => setIsVisionModalOpen(true)}
        onOpenXmiModal={() => setIsXmiModalOpen(true)}
        onOpenBackendModal={() => setIsBackendModalOpen(true)}
        onExportDiagram={handleExportDiagram}
      />

      {/* 2. Área Central de Trabajo: Working Diagrams Lateral + Lienzo con Pestañas + Inspector Lateral */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Panel Lateral Working Diagrams (StarUML Style) */}
        {isWorkingDiagramsOpen && (
          <WorkingDiagramsPanel
            diagrams={diagrams}
            activeDiagramId={activeDiagramId}
            theme={theme}
            isOpen={isWorkingDiagramsOpen}
            onToggleCollapse={() => setIsWorkingDiagramsOpen(false)}
            onSelectDiagram={handleSelectDiagram}
            onCreateDiagram={handleCreateDiagram}
            onRenameDiagram={handleRenameDiagram}
            onDuplicateDiagram={handleDuplicateDiagram}
            onDeleteDiagram={handleDeleteDiagram}
            onExportDiagram={(diagId, format) => handleExportDiagram(format, diagId)}
          />
        )}

        <main className="flex-1 h-full relative flex flex-col overflow-hidden">
          {/* Barra de pestañas superiores de diagramas (StarUML Style) */}
          <DiagramTabBar
            diagrams={diagrams}
            activeDiagramId={activeDiagramId}
            theme={theme}
            onSelectDiagram={handleSelectDiagram}
            onCloseDiagram={handleDeleteDiagram}
            onNewDiagram={() => handleCreateDiagram(`Diagrama ${diagrams.length + 1}`, 'class')}
          />

          <div className="flex-1 relative overflow-hidden">
            <ErrorBoundary>
              <UmlCanvas
                classes={classes}
                relationships={relationships}
                selectedClassId={selectedClassId}
                selectedClassIds={selectedClassIds}
                selectedRelationshipId={selectedRelationshipId}
                gridSnap={gridSnap}
                theme={theme}
                activeLocks={activeLocks}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                remoteCursors={remoteCursors}
                onSelectClass={handleSelectClass}
                onSelectRelationship={handleSelectRelationship}
                onClearSelection={handleClearSelection}
                onMoveClass={handleMoveClass}
                onMoveClassEnd={handleMoveClassEnd}
                onMoveMultipleClasses={handleMoveMultipleClasses}
                onMoveMultipleClassesEnd={handleMoveMultipleClassesEnd}
                onResizeClass={handleResizeClass}
                onResizeClassEnd={handleResizeClassEnd}
                connectingSourceId={connectingSourceId}
                onCompleteConnection={handleCompleteConnection}
                onCursorMove={handleCursorMove}
                onDeleteClass={handleDeleteClass}
                onStartConnection={handleStartConnection}
              />
            </ErrorBoundary>

            {/* Botón flotante para reabrir el inspector cuando está oculto */}
            {!isInspectorOpen && (
              <button
                onClick={() => {
                  setInspectorWidth((w) => (w < 260 ? 360 : w));
                  setIsInspectorOpen(true);
                }}
                title="Mostrar panel de propiedades"
                className={`absolute top-4 right-4 z-20 flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-semibold shadow-xl backdrop-blur transition-all active:scale-95 ${
                  theme === 'light'
                    ? 'bg-white/95 text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                    : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <PanelRightOpen className="w-4 h-4 text-emerald-500" />
                <span>Propiedades</span>
              </button>
            )}
          </div>
        </main>

        {/* 3. Panel Inspector Lateral */}
        <InspectorPanel
          isOpen={isInspectorOpen}
          theme={theme}
          width={inspectorWidth}
          onWidthChange={setInspectorWidth}
          onToggleCollapse={() => setIsInspectorOpen(false)}
          selectedClass={selectedClass}
          selectedRelationship={selectedRelationship}
          allClasses={classes}
          allRelationships={relationships}
          onClose={() => {
            handleSelectClass(null);
            setSelectedRelationshipId(null);
          }}
          onUpdateClass={handleUpdateClass}
          onDeleteClass={handleDeleteClass}
          onAddAttribute={handleAddAttribute}
          onUpdateAttribute={handleUpdateAttribute}
          onDeleteAttribute={handleDeleteAttribute}
          onAddMethod={handleAddMethod}
          onDeleteMethod={handleDeleteMethod}
          onUpdateRelationship={handleUpdateRelationship}
          onDeleteRelationship={handleDeleteRelationship}
          onStartConnection={handleStartConnection}
          onAddRelationship={handleAddDirectRelationship}
          onCreateIntermediateClass={handleCreateIntermediateClass}
        />

        {/* 4. Asistente Inteligente de Voz y Lenguaje Natural */}
        <AiAssistantDrawer
          projectId={projectId}
          isOpen={isAiDrawerOpen}
          onClose={() => setIsAiDrawerOpen(false)}
          onCommandExecuted={() => loadDiagram(projectId)}
        />

        {/* 5. Modal de Digitalización de Bocetos por Visión Computacional */}
        <VisionModal
          isOpen={isVisionModalOpen}
          projectId={projectId}
          onClose={() => setIsVisionModalOpen(false)}
          onDiagramUpdated={() => loadDiagram(projectId)}
        />

        {/* 6. Modal de Interoperabilidad con Enterprise Architect XMI 2.1 */}
        <XmiInteroperabilityModal
          isOpen={isXmiModalOpen}
          projectId={projectId}
          projectTitle={projectTitle}
          onClose={() => setIsXmiModalOpen(false)}
          onDiagramUpdated={() => loadDiagram(projectId)}
        />

        {/* 7. Modal de Generación de Backend Spring Boot */}
        <BackendGeneratorModal
          isOpen={isBackendModalOpen}
          projectId={projectId}
          projectTitle={projectTitle}
          onClose={() => setIsBackendModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default App;
