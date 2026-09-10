# Mapa de Navegación — Archivador

## 1. Pantallas

| Ruta | Pantalla | Auth | Operaciones consumidas | Estados declarados |
|---|---|---|---|---|
| `/archivos` | Mis archivos | `rol:empleado` | `listarArchivos` | `vacío`, `cargando`, `error`, `sin-permiso` |

## 2. Detalle por pantalla

### `/archivos` — Mis archivos
- **Propósito:** el empleado ve los archivos que subió, para confirmar que llegaron.
- **Elementos clave:** tabla con los archivos ordenados como los devuelve el API.
- **Historias de usuario:** HU-ARCH-001
- **Contenido real:** nombres de archivo de hasta 120 caracteres; el estado vacío dice
  "Todavía no subiste archivos".

## 3. Flujos críticos

```
[Login] → [Mis archivos]
```

## 4. Huecos del contrato

Ninguno.
