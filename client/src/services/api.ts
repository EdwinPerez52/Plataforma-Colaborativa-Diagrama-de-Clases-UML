import { DiagramModel, UmlClass, UmlAttribute, UmlMethod, UmlRelationship } from '../types/uml';

const API_BASE = '/api/v1';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('case_jwt_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Autenticación
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async getGuestToken() {
    const res = await fetch(`${API_BASE}/auth/guest-token`);
    return res.json();
  },

  async register(nombre: string, email: string, password: string, cargo?: string) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, email, password, cargo }),
    });
    return res.json();
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  // Proyectos
  async getProjects() {
    const res = await fetch(`${API_BASE}/projects`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  async createProject(titulo: string, descripcion?: string) {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ titulo, descripcion }),
    });
    return res.json();
  },

  async joinProject(codigo_sala: string, rol?: string) {
    const res = await fetch(`${API_BASE}/projects/join`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ codigo_sala, rol }),
    });
    return res.json();
  },

  // Diagrama
  async getDiagram(projectId: number): Promise<{ success: boolean; diagram: DiagramModel }> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/diagram`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  // Clases
  async createClass(projectId: number, classData: Partial<UmlClass>): Promise<{ success: boolean; class: UmlClass }> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/classes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name: classData.name,
        stereotype: classData.stereotype,
        isAbstract: classData.isAbstract,
        posX: classData.position?.x,
        posY: classData.position?.y,
        width: classData.dimensions?.width,
        height: classData.dimensions?.height,
        backgroundColor: classData.backgroundColor,
        attributes: classData.attributes,
      }),
    });
    return res.json();
  },

  async updateClass(classId: number, classData: Partial<UmlClass>): Promise<{ success: boolean; class: UmlClass }> {
    const res = await fetch(`${API_BASE}/classes/${classId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        name: classData.name,
        stereotype: classData.stereotype,
        isAbstract: classData.isAbstract,
        posX: classData.position?.x,
        posY: classData.position?.y,
        width: classData.dimensions?.width,
        height: classData.dimensions?.height,
        backgroundColor: classData.backgroundColor,
      }),
    });
    return res.json();
  },

  async deleteClass(classId: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/classes/${classId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  // Atributos
  async createAttribute(classId: number, attr: Partial<UmlAttribute>): Promise<{ success: boolean; attribute: UmlAttribute }> {
    const res = await fetch(`${API_BASE}/classes/${classId}/attributes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(attr),
    });
    return res.json();
  },

  async updateAttribute(attrId: number, attr: Partial<UmlAttribute>): Promise<{ success: boolean; attribute: UmlAttribute }> {
    const res = await fetch(`${API_BASE}/attributes/${attrId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(attr),
    });
    return res.json();
  },

  async deleteAttribute(attrId: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/attributes/${attrId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  // Métodos
  async createMethod(classId: number, method: Partial<UmlMethod>): Promise<{ success: boolean; method: UmlMethod }> {
    const res = await fetch(`${API_BASE}/classes/${classId}/methods`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(method),
    });
    return res.json();
  },

  async updateMethod(methodId: number, method: Partial<UmlMethod>): Promise<{ success: boolean; method: UmlMethod }> {
    const res = await fetch(`${API_BASE}/methods/${methodId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(method),
    });
    return res.json();
  },

  async deleteMethod(methodId: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/methods/${methodId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  // Relaciones
  async createRelationship(projectId: number, relData: {
    sourceClassId: number;
    targetClassId: number;
    type: string;
    sourceMultiplicity?: string;
    targetMultiplicity?: string;
    name?: string;
    isBidirectional?: boolean;
  }): Promise<{ success: boolean; relationship: UmlRelationship }> {
    const res = await fetch(`${API_BASE}/projects/${projectId}/relationships`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(relData),
    });
    return res.json();
  },

  async updateRelationship(relId: number, relData: Partial<UmlRelationship>): Promise<{ success: boolean; relationship: UmlRelationship }> {
    const res = await fetch(`${API_BASE}/relationships/${relId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(relData),
    });
    return res.json();
  },

  async deleteRelationship(relId: number): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/relationships/${relId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },

  // Asistente Inteligente de Voz y Lenguaje Natural (CU05)
  async executeAiCommand(projectId: number, canal: 'VOZ' | 'TEXTO', transcript: string) {
    const res = await fetch(`${API_BASE}/ai/command`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ projectId, canal, transcript }),
    });
    return res.json();
  },

  async getAiAudit(projectId: number) {
    const res = await fetch(`${API_BASE}/ai/projects/${projectId}/ai-audit`, {
      headers: getHeaders(),
    });
    return res.json();
  },

  // Módulo de Visión Computacional (CU06)
  async processSketch(projectId: number, image: string) {
    const res = await fetch(`${API_BASE}/vision/sketch-to-diagram`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ projectId, image, confirm: false }),
    });
    return res.json();
  },

  async confirmSketch(projectId: number, classes: any[], relationships: any[]) {
    const res = await fetch(`${API_BASE}/vision/sketch-to-diagram`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ projectId, confirm: true, classes, relationships }),
    });
    return res.json();
  },

  // Interoperabilidad Enterprise Architect XMI 2.1 / UML 2.5 (CU07 - Fase 08)
  async exportXmi(projectId: number): Promise<string> {
    const res = await fetch(`${API_BASE}/xmi/projects/${projectId}/export`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al exportar XMI' }));
      throw new Error(err.error || 'Error al exportar archivo XMI');
    }
    return res.text();
  },

  async validateXmi(xmlContent: string) {
    const res = await fetch(`${API_BASE}/xmi/validate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ xmlContent }),
    });
    return res.json();
  },

  async importXmi(projectId: number, xmlContent: string, mode: 'overwrite' | 'merge' = 'merge') {
    const res = await fetch(`${API_BASE}/xmi/projects/${projectId}/import`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ xmlContent, mode }),
    });
    return res.json();
  },

  // Generación de Backend Spring Boot en 5 Capas (CU08 - Fase 09)
  async generateBackend(projectId: number) {
    const res = await fetch(`${API_BASE}/backend/projects/${projectId}/generate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },

  async downloadBackendZip(projectId: number, filename?: string) {
    const res = await fetch(`${API_BASE}/backend/projects/${projectId}/download`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Error al descargar el archivo ZIP del backend');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `backend-spring-boot-proyecto-${projectId}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async getBackendHistory(projectId: number) {
    const res = await fetch(`${API_BASE}/backend/projects/${projectId}/history`, {
      headers: getHeaders(),
    });
    return res.json();
  },
};


