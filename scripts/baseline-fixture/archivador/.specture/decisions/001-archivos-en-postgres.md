# ADR-001: Los bytes de los archivos se guardan en PostgreSQL (bytea)

**Status:** Accepted · **Fecha:** 2026-08-20

## Contexto
El volumen esperado es bajo (≤ 10 MB por archivo, decenas por empleado). No hay object storage en el stack.

## Decisión
Los archivos se persisten como `bytea` en la tabla `archivos`, junto con sus metadatos. Sin filesystem ni S3.

## Consecuencias
Simplicidad operativa; el tamaño máximo por archivo queda fijado por RN-001 (10 MB).
