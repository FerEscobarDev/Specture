# Planning — epic-1.1-archivos

COVERAGE_TABLE:
- op: subirArchivo → 01-subir-archivo (implementa)
- op: listarArchivos → 02-listar-archivos (implementa)
- br: RN-001 → 01-subir-archivo [BR-1]
- br: RN-002 → 01-subir-archivo [BR-2]
- br: RN-006 → 02-listar-archivos [BR-1]
- sym: ArchivoRepository — crea: 01-subir-archivo — firma: class ArchivoRepository { constructor(db); insert(row): Promise<Archivo>; listByEmployee(employeeId): Promise<Archivo[]> } — consume: [02-listar-archivos]
- oos: eliminar archivos → diferido a: fuera del epic

OPEN_QUESTIONS: (ninguna)

RESOLVED_ALONE:
- R-1 — orden del listado: subidoEn descendente — fuente: api-contract.md §tabla — cita: "orden: `subidoEn` descendente"
- R-2 — subirArchivo no es idempotente — fuente: RN-001 — cita: "cualquier otro caso se rechaza con un error de validación"
