# Design System y Navegación: [Nombre del Proyecto]

> *Nota: Esta plantilla se usa principalmente para la Ruta 2 (Full VibeCoding). Si se usa la Ruta 1, este documento se simplifica y delega el UI/UX a Claude Design.*

## 1. Identidad de Marca y Tokens
- **Colores Principales:**
  - Primario: [HEX]
  - Secundario: [HEX]
  - Acento/Error/Éxito: [HEX]
- **Tipografía:**
  - Fuentes principales: [Ej. Inter para UI, Merriweather para títulos]
- **Librería UI Elegida:** [Ej. Tailwind CSS + Shadcn]

## 2. Componentes Base (Atoms & Molecules)
- **Botones:** [Estilo, bordes, estados hover]
- **Inputs/Formularios:** [Reglas de validación visual, padding]
- **Tarjetas (Cards):** [Sombra, radio de borde]

## 3. Mapa de Navegación (Arquitectura de Información)
*Estructura de las pantallas principales de la aplicación frontend.*

1. **`/` (Home/Landing)**
   - Contenido clave: [Hero section, call to actions]
2. **`/dashboard`**
   - Requiere Auth: Sí
   - Contenido clave: [Resumen de datos del usuario]
3. **`/profile`**
   - Requiere Auth: Sí
   - Contenido clave: [Ajustes de cuenta]

## 4. Reglas de Accesibilidad y Responsividad
- Enfoque *Mobile First*.
- Soporte para Modo Oscuro: [Sí/No]
- Contraste WCAG AA mínimo.
