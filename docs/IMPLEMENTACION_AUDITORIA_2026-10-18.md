# Actualización de carrera y Dirección deportiva — 18 de octubre de 2026

Esta actualización desarrolla los 36 puntos de la [auditoría de la versión anterior](AUDITORIA_COMPLETA_2026-10-18.md). Mantiene las identidades y las ligas instaladas. Los nuevos sistemas se incorporan de forma progresiva a los guardados existentes; no inventan estadísticas previas a su instalación.

## Uso

**Dirección deportiva** reúne Proyecto, Estadísticas, Pruebas y agentes, Ojeo territorial, Microciclo, Selecciones, Análisis, Prensa y Base de datos. En escritorio los paneles relacionados comparten pantalla; en móvil se alternan mediante botones, con desplazamiento dentro de listas y formularios.

Las cláusulas del pase se ofrecen al propietario en la primera etapa. El contrato personal conserva ese acuerdo y añade honorarios del representante. Los bonos comprometidos reservan fondos y generan obligaciones cuando se cumplen; la recompra exige acuerdo personal. Una cesión conserva sus condiciones propias y no añade cláusulas de venta al contrato del propietario.

Una carrera admite una sola pestaña editora. Otra pestaña presenta un aviso y permite crear una copia independiente. Mis carreras continúa archivando cada partida por separado; las operaciones de cambio esperan la confirmación del guardado.

## Seguimiento de los 36 puntos

| Punto | Resultado implementado | Verificación principal |
|---|---|---|
| 1 | Exclusión por carrera con Web Locks, comunicación entre pestañas y arrendamiento de compatibilidad. Guardado, carga, renombre y eliminación respetan la propiedad. Copia independiente desde el aviso. | Dos pestañas, escritura rechazada y bifurcación sin sobrescribir. |
| 2 | Validación de listas de inscripción, empleados, desarrollo, medicina, cuentas y nuevos subsistemas antes de activar una importación. | Importaciones dañadas conservan el estado y el dinero anteriores. |
| 3 | Edad calculada por el mismo servicio para identidades reales y generadas, con año estimado explícito cuando falta el día. | Cambio de año, carreras prolongadas y nacimiento el 29 de febrero. |
| 4 | Promociones por academia y reserva pasan por las reglas de inscripción; los estados pendiente y exento se distinguen. | Promoción con lista doméstica activa y comprobación de elegibilidad. |
| 5 | La promoción conserva condición y situación médica. | Juvenil con condición 35 después de subir. |
| 6 | La exención sub-21 se evalúa antes de exigir una plaza sénior, manteniendo las autorizaciones administrativas aplicables. | Sub-21 inglés elegible sin ocupar lista sénior. |
| 7 | La exención juvenil no omite el control italiano de altas extracomunitarias internacionales. | Dos altas aceptadas; la tercera puede comprarse pero queda sin inscripción. |
| 8 | Reserva y juvenil resuelven administrativamente la falta del mínimo de siete, sin goleadores ni minutos ficticios. | Dos equipos sin disponibles: cero minutos y cero puntos. |
| 9 | Condición cero se trata como cero; la selección pondera condición y descanso. | Disponibilidad de reserva y ausencia de recuperación gratuita. |
| 10 | Tarjetas con minuto, estado de expulsión y tiempo efectivo; se cancela un cambio si habría reemplazado a un expulsado. | Aleatoriedad forzada, una expulsión por jugador y minutos legales. |
| 11 | El aplazamiento separa un encuentro de su jornada; el resto conserva la fecha. Las fases esperan los partidos necesarios. | Aplazamientos individuales y dependencias de semifinal/final. |
| 12 | La caché de búsqueda incorpora cambios de atributos y observaciones. | Un cambio de calidad afecta el filtro durante el mismo día. |
| 13 | La renovación del DT liquida los días trabajados al salario anterior antes de aplicar el aumento. | Seis días a USD 1.000 y nueva semana a USD 1.050. |
| 14 | La bandeja distingue espera externa de decisión del DT y enlaza la negociación concreta de empleados y empleos. | Compra pendiente de respuesta y contraoferta de empleado. |
| 15 | Acciones de gestión con autoguardado agrupado en segundo plano; commits asíncronos para cambiar de carrera; metadatos separados de los payloads. | Respuesta del navegador, revisión nueva frente a worker anterior, falta de espacio y recuperación. |
| 16 | Dashboard móvil compacto con la acción del próximo encuentro visible. | Pantalla de 390 × 844. |
| 17 | Eliminar una carrera borra también payloads y metadatos de sus checkpoints y bloquea escrituras tardías. | Eliminación de la carrera y consultas a ambos almacenes. |
| 18 | Se acumulan intervalos de formación observados por club y país entre los 15 y 21 años. | Tres años de formación y conservación tras promoción. |
| 19 | La IA vuelve a revisar las listas cuando cambia su plantilla durante una ventana abierta. | Alta no inscrita incorporada a la lista y elegibilidad posterior. |
| 20 | Las propuestas laborales antiguas se canalizan a vacantes y entrevistas; no cambian de club al avanzar. | Propuesta, respuesta, firma y fecha efectiva, más migración de un destino antiguo. |
| 21 | Agregados permanentes por jugador, club, temporada y competición, incluidos reserva y juvenil, separados del archivo de informes. | Idempotencia, trayectoria y serialización. |
| 22 | Partidos rápidos con goleadores y asistencias ponderados por posición y atributos, cambios, minutos y expulsiones. | Composición del once, suma de minutos y muestras de varias temporadas. |
| 23 | Planes a tres temporadas, sucesión por posición, contratos próximos y costo total; sus prioridades influyen en el interés de la IA. | Revisión mensual, guardado y operaciones del mercado. |
| 24 | Agencias simuladas persistentes, clientes compartidos, relación, honorarios e historial. La relación afecta salario y paciencia. | Comisión liquidada una vez y comparación entre relación baja y alta. |
| 25 | Bonos por participaciones y clasificación, vencimiento, reserva, obligación y recompra; el vendedor pondera su valor esperado. | Activación y pago único; acuerdo del club preservado en la etapa personal. |
| 26 | Pruebas de agentes libres por 7 o 14 días, hasta tres, alojamiento, observación progresiva y salida definida. | Prueba completada sin incorporación automática. |
| 27 | Rutas por país con viaje, llegada, estadía, conocimiento regional y encuentros observables. Los partidos rápidos jugados alimentan los informes activos. | Llegada del ojeador, costo de las semanas y partido observado una sola vez. |
| 28 | Compromisos de minutos del primer equipo, salida y competición continental; el seguimiento no se reinicia al cerrar una temporada. | Cumplimiento a partir de estadísticas persistentes y efectos de confianza. |
| 29 | Microciclo semanal editable de dos sesiones con carga, responsable, descanso médico y preparación de partido. | Dos sesiones distintas; repetición sin duplicar trabajo. |
| 30 | Análisis de secuencias registradas, xA, asociaciones, progresión y variantes guardadas con responsables. | Muestra conocida de pases y rechazo de una rutina cuyo responsable dejó el club. |
| 31 | Convocatorias nacionales, amistosos, torneo adaptado, ausencias del club, minutos y medicina independientes. | Caps, bloqueo deportivo y regreso al club. |
| 32 | Proyectos de estadio, cantera, medicina y ojeo con autorización, costo, plazo y efecto efectivo. | Una obra terminada modifica la capacidad sin segundo cobro. |
| 33 | Conferencias con memoria de compromisos y revisión de resultados posteriores al anuncio. | Las victorias anteriores no cumplen una promesa nueva. |
| 34 | Interfaz unificada, paneles móviles, foco visible, navegación de pestañas por teclado y movimiento reducido. | Aperturas de vistas y capturas en escritorio y móvil. |
| 35 | Dependencias de desarrollo fijadas, workflow de calidad y simulador configurable de 1 a 20 temporadas. | Regresiones funcionales y ensayos deportivos prolongados documentados. |
| 36 | Importación/exportación de correcciones de referencia con fuente y fecha, edición validada e instalación en IndexedDB para nuevas carreras. | Una carrera nueva recibe la corrección; la anterior conserva sus datos. |

## Defectos adicionales encontrados durante la integración

- Los aniversarios de un nacimiento del 29 de febrero generaban un cierre de formación imposible en un año no bisiesto. El cálculo ahora usa una fecha válida y se comprueba con una regresión específica.
- El límite de diccionario del descompresor podía rechazar un guardado legítimo de varias temporadas. Se ajustó el límite manteniendo los topes de longitud y de entradas.
- La reposición de reservas de ligas suplementarias usaba una secuencia distinta de la cantera y podía repetir identidades al cerrar temporadas. Comparte ahora el asignador que conserva también retirados y juveniles.
- Un ascenso podía esperar innecesariamente una copa nacional, porque la finalización de la liga consultaba eventos de cualquier competición con su identificador. La dependencia ahora corresponde a partidos de liga y promoción.
- Un primer autoguardado podía descartarse mientras se obtenía el permiso de edición. La espera forma parte del trabajo pendiente y vuelve a programar la escritura al obtener el permiso.

## Alcance de las simulaciones

Las posiciones, tarifas de viaje, políticas de club, agencias, declaraciones, inversiones y competiciones nacionales de selecciones pertenecen al simulador. No describen hechos o contratos de las personas reales.

La competición de selecciones utiliza 16 países con cobertura suficiente, con cuatro grupos y eliminatorias. **No reproduce el Mundial oficial de 48 participantes.** Los partidos y convocatorias se generan dentro de la carrera. No se modifican los formatos existentes de las ligas de clubes con esta incorporación.

El análisis calcula xA con los remates abastecidos registrados. La amenaza posicional es una heurística geométrica, no xT de un proveedor; los pases por acción defensiva no se presentan como PPDA oficial. Los partidos rápidos reciben una distribución más coherente de sus participantes; no se afirma que las nuevas distribuciones hayan sido contrastadas de nuevo con una base estadística externa completa.

El ojeo conserva incertidumbre incluso con cobertura completa. Una ruta permite observar encuentros de los encargos activos dentro de sus fechas; otros avances pueden proceder del trabajo de seguimiento. No se atribuyen partidos observados si no se registró su participación.

Las actualizaciones de referencia conservan la procedencia declarada, validan identidades y pertenencias, y nunca sustituyen las transferencias de una partida en curso. No añaden atributos oficiales de FM ni sincronización en vivo con Transfermarkt.

## Compatibilidad y pruebas

Los agregados estadísticos nuevos empiezan con los partidos posteriores a esta actualización. Se conservan los totales anteriores que ya tenía cada ficha, pero no se reconstruye una distribución histórica por competición que no fue almacenada. La formación local se acredita con tiempo observado en la carrera; no se supone que nacionalidad equivalga a formación.

El guardado asíncrono puede tardar en terminar la compresión. El indicador de trabajo pendiente incluye la adquisición del permiso de edición. Antes de cambiar de carrera se espera la escritura; al salir se intenta completar el guardado pendiente. Si no hay Web Workers se usa la ruta compatible. La exportación supera el límite de tamaño mediante el formato compacto cuando la representación expandida sería demasiado grande para importarla.

Los ensayos largos son **deportivos y enfocados por país**: simulan sus dos divisiones, con selección y recuperación asistidas y las copas incluidas por el escenario. Mantienen el resto del mundo en el guardado, pero no completan todas sus ligas. Las liquidaciones económicas y la interacción del DT se verifican en escenarios funcionales específicos. Una prueba aprobada no certifica ausencia de otros defectos ni rendimiento idéntico en todos los dispositivos.

Las capturas y resultados finales se archivan en [evidencias de la actualización](evidencias-actualizacion-2026-10-18/). El workflow se incorpora para repetir la validación; su ejecución remota depende de GitHub Actions.

### Resultados de los ensayos prolongados

| Escenario | Temporadas | Encuentros contabilizados | Último estado |
|---|---|---|---|
| Argentina: LPF, Primera Nacional y rondas continentales de sus clubes | 2026–2030 | 5.981 | Guardado y decodificación aprobados en los cinco cierres |
| Inglaterra: Premier, Championship, copa nacional y rondas continentales de sus clubes | 2026/27–2030/31 | 6.896 | Guardado y decodificación aprobados en los cinco cierres |

Las comprobaciones anuales de estos diez cierres no encontraron duplicados de identidad, exceso de los 40 contratos comprobados ni edades incoherentes en la muestra de cada país. Cada escenario conserva los resultados anuales en su JSON. La ejecución argentina precede la corrección del selector de copas nacionales del simulador de pruebas y **no incluye la Copa Argentina**; el selector actual sí la incluye. La física de estos ensayos usa recuperación asistida y no representa una campaña interactiva completa del DT.

Además se aprobaron **88 escenarios funcionales únicos** de guardado, negociaciones, inscripción, interfaz, empleados, medicina, estadísticas y calendarios. El inventario exacto está en `regresiones.json`; no se presenta como una ejecución de todas las baterías históricas del repositorio.
