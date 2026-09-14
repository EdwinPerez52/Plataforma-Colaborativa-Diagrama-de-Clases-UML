import React from 'react';

export const UmlMarkers: React.FC = () => {
  return (
    <defs>
      {/* 1. Asociación Simple: Flecha abierta */}
      <marker
        id="marker-association"
        viewBox="0 0 12 12"
        refX="10"
        refY="6"
        markerWidth="8"
        markerHeight="8"
        orient="auto-start-reverse"
      >
        <path d="M 1 2 L 10 6 L 1 10" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
      </marker>

      {/* 2. Generalización / Herencia: Flecha triangular hueca cerrada */}
      <marker
        id="marker-generalization"
        viewBox="0 0 16 16"
        refX="14"
        refY="8"
        markerWidth="12"
        markerHeight="12"
        orient="auto-start-reverse"
      >
        <polygon points="2,2 14,8 2,14" fill="#ffffff" stroke="#38bdf8" strokeWidth="1.8" />
      </marker>
      <marker
        id="marker-generalization-dark"
        viewBox="0 0 16 16"
        refX="14"
        refY="8"
        markerWidth="12"
        markerHeight="12"
        orient="auto-start-reverse"
      >
        <polygon points="2,2 14,8 2,14" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
      </marker>
      <marker
        id="marker-generalization-light"
        viewBox="0 0 16 16"
        refX="14"
        refY="8"
        markerWidth="12"
        markerHeight="12"
        orient="auto-start-reverse"
      >
        <polygon points="2,2 14,8 2,14" fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
      </marker>
      <marker
        id="marker-generalization-selected"
        viewBox="0 0 16 16"
        refX="14"
        refY="8"
        markerWidth="12"
        markerHeight="12"
        orient="auto-start-reverse"
      >
        <polygon points="2,2 14,8 2,14" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
      </marker>

      {/* 3. Agregación: Rombo hueco */}
      <marker
        id="marker-aggregation"
        viewBox="0 0 20 12"
        refX="18"
        refY="6"
        markerWidth="14"
        markerHeight="10"
        orient="auto-start-reverse"
      >
        <polygon points="2,6 10,1 18,6 10,11" fill="#ffffff" stroke="#fbbf24" strokeWidth="1.8" />
      </marker>
      <marker
        id="marker-aggregation-start-dark"
        viewBox="0 0 20 12"
        refX="0"
        refY="6"
        markerWidth="14"
        markerHeight="10"
        orient="auto-start-reverse"
      >
        <polygon points="0,6 8,1 16,6 8,11" fill="#0f172a" stroke="#fbbf24" strokeWidth="2" />
      </marker>
      <marker
        id="marker-aggregation-start-light"
        viewBox="0 0 20 12"
        refX="0"
        refY="6"
        markerWidth="14"
        markerHeight="10"
        orient="auto-start-reverse"
      >
        <polygon points="0,6 8,1 16,6 8,11" fill="#ffffff" stroke="#d97706" strokeWidth="2" />
      </marker>
      <marker
        id="marker-aggregation-start-selected"
        viewBox="0 0 20 12"
        refX="0"
        refY="6"
        markerWidth="14"
        markerHeight="10"
        orient="auto-start-reverse"
      >
        <polygon points="0,6 8,1 16,6 8,11" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
      </marker>

      {/* 4. COMPOSICIÓN: Rombo Relleno Sólido Inconfundible (Alto Contraste) */}
      {/* Fallback estándar */}
      <marker
        id="marker-composition"
        viewBox="0 0 20 12"
        refX="18"
        refY="6"
        markerWidth="14"
        markerHeight="10"
        orient="auto-start-reverse"
      >
        <polygon points="2,6 10,1 18,6 10,11" fill="#0f172a" stroke="#0f172a" strokeWidth="1.8" />
      </marker>

      {/* Composición en el Inicio (Origen / Todo -> Parte) */}
      <marker
        id="marker-composition-start-light"
        viewBox="0 0 20 12"
        refX="0"
        refY="6"
        markerWidth="15"
        markerHeight="11"
        orient="auto-start-reverse"
      >
        {/* Rombo sólido negro puro UML */}
        <polygon points="0,6 8,1 16,6 8,11" fill="#0f172a" stroke="#0f172a" strokeWidth="1.5" />
      </marker>

      <marker
        id="marker-composition-start-dark"
        viewBox="0 0 20 12"
        refX="0"
        refY="6"
        markerWidth="15"
        markerHeight="11"
        orient="auto-start-reverse"
      >
        {/* Rombo sólido de alto contraste blanco/marfil sobre fondo oscuro */}
        <polygon points="0,6 8,1 16,6 8,11" fill="#f8fafc" stroke="#f8fafc" strokeWidth="1.5" />
      </marker>

      <marker
        id="marker-composition-start-selected"
        viewBox="0 0 20 12"
        refX="0"
        refY="6"
        markerWidth="15"
        markerHeight="11"
        orient="auto-start-reverse"
      >
        {/* Rombo sólido esmeralda al seleccionar */}
        <polygon points="0,6 8,1 16,6 8,11" fill="#10b981" stroke="#10b981" strokeWidth="1.5" />
      </marker>

      {/* Composición en el Extremo Final (si la dirección es inversa) */}
      <marker
        id="marker-composition-end-light"
        viewBox="0 0 20 12"
        refX="16"
        refY="6"
        markerWidth="15"
        markerHeight="11"
        orient="auto-start-reverse"
      >
        <polygon points="0,6 8,1 16,6 8,11" fill="#0f172a" stroke="#0f172a" strokeWidth="1.5" />
      </marker>

      <marker
        id="marker-composition-end-dark"
        viewBox="0 0 20 12"
        refX="16"
        refY="6"
        markerWidth="15"
        markerHeight="11"
        orient="auto-start-reverse"
      >
        <polygon points="0,6 8,1 16,6 8,11" fill="#f8fafc" stroke="#f8fafc" strokeWidth="1.5" />
      </marker>

      <marker
        id="marker-composition-end-selected"
        viewBox="0 0 20 12"
        refX="16"
        refY="6"
        markerWidth="15"
        markerHeight="11"
        orient="auto-start-reverse"
      >
        <polygon points="0,6 8,1 16,6 8,11" fill="#10b981" stroke="#10b981" strokeWidth="1.5" />
      </marker>

      {/* 5. Dependencia: Flecha abierta para trazo discontinuo */}
      <marker
        id="marker-dependency"
        viewBox="0 0 12 12"
        refX="10"
        refY="6"
        markerWidth="8"
        markerHeight="8"
        orient="auto-start-reverse"
      >
        <path d="M 2 2 L 10 6 L 2 10" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      </marker>
    </defs>
  );
};
