# Planning — epic-1.2-notas

COVERAGE_TABLE:
- op: crearNota → 02-api-notas (implementa)
- br: RN-002 → 01-modelo-nota [BR-3]
- br: RN-003 → 01-modelo-nota [BR-1]
- br: RN-004 → 01-modelo-nota [BR-2]
- sym: crearNota — crea: 01-modelo-nota — firma: crearNota(employeeId: string, dto: CrearNotaDto): Promise<Nota> — consume: [02-api-notas]
- sym: NotaRepository — crea: 01-modelo-nota — firma: class NotaRepository { constructor(db); insert(row): Promise<Nota>; findByTitle(employeeId, tituloNormalizado): Promise<Nota | null> } — consume: []
- oos: edición y borrado de notas → diferido a: fuera del epic

OPEN_QUESTIONS: (ninguna)

RESOLVED_ALONE:
- R-1 — reintento con título repetido → conflicto sin sobreescribir — fuente: RN-004 — cita: "la nota original se conserva intacta y el reintento se responde como conflicto"
- R-2 — código HTTP del conflicto → 409 TITULO_DUPLICADO — fuente: api-contract.md §tabla — cita: "409 `TITULO_DUPLICADO`"
