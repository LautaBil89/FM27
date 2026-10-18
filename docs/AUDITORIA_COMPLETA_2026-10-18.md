# Auditoría completa de FM27 — 18 de octubre de 2026

Versión revisada: `86206010e8de65fc3c0649c0580c68d764c3d0bb`.

La mayor debilidad actual es la coherencia entre subsistemas: pertenecer al club, estar inscrito, estar disponible, desarrollarse y conservar el progreso no siempre usan las mismas reglas. Agregar más pantallas antes de resolverlo aumentaría la cantidad de estados contradictorios.

Esta revisión **no modifica el juego**. Distingue 20 hallazgos de corrección u optimización y 16 mejoras de producto. Los hallazgos 18–20 se fundamentan en el código; los demás incluyen reproducciones controladas o mediciones, con los límites explicados en cada caso. Las prioridades consideran impacto y alcance, no una frecuencia de ocurrencia medida.

## Alcance y evidencia

- Revisión de la arquitectura de 36 archivos JavaScript propios, las rutas activas del HTML, y los sistemas de carrera, guardado, fichajes, renovaciones, empleados, inscripción, competiciones, partido, medicina, desarrollo, ojeo, finanzas y bandeja. Comprobación sintáctica de los 36 archivos sin errores.
- Lectura de la auditoría anterior y de su seguimiento. Los defectos antiguos ya resueltos no se presentan como descubrimientos nuevos.
- **10 pruebas de regresión aprobadas**, de `test_audit_integration` y `test_match_regulations_depth`: persistencia del mundo, navegación continental, clasificación preliminar futura, simulación rápida, incorporación en fecha de consulta, factores tácticos, penales, arquero de emergencia, cambios y abandono con menos de siete.
- Reproducciones adicionales en Chromium con partidas aisladas y datos de prueba controlados. Incluyeron promoción, paso de año, inscripción, lesiones/fatiga de reserva, importación inválida, renovación del DT, clasificación de mensajes y dos pestañas.
- **14 vistas principales en dos tamaños:** 1440 × 900 y 390 × 844. Las 28 aperturas no arrojaron excepciones ni desborde de la página completa; se encontró una acción importante fuera del área visible en el dashboard móvil.
- Medición puntual en este entorno: 645 clubes, 17.390 jugadores y 1.345 eventos. No representa rendimiento garantizado en otros equipos.

Evidencia: [resultados de las sondas](evidencias-auditoria-2026-10-18/resultados.json), [regresiones](evidencias-auditoria-2026-10-18/regresiones.txt) y [captura del dashboard móvil](evidencias-auditoria-2026-10-18/dashboard-movil.png).

No se ejecutaron todas las baterías históricas ni una carrera de diez temporadas. Tampoco se contrastaron otra vez todos los reglamentos con sus federaciones. La revisión identifica defectos reproducibles y trabajo pendiente; no certifica ausencia de otros errores.

## Hallazgos que corregiría

### 1. Dos pestañas pueden sobrescribir la misma carrera — alta, reproducido

Ambas pestañas cargaron el mismo `careerId`. La A guardó USD 1.234.567 y la B guardó USD 987.654; las dos devolvieron éxito. A siguió mostrando su estado anterior sin aviso. Un autoguardado o cierre posterior de A puede reemplazar el progreso de B.

**Impacto:** pérdida silenciosa de avance aunque existan varias carreras y checkpoints. La protección del Web Worker evita algunas carreras entre tareas de una pestaña; no coordina dos pestañas.

**Corregir:** propietario de edición por carrera, revisión persistida y comprobación antes de escribir; aviso de conflicto y opción de abrir una copia. `BroadcastChannel` puede comunicar cambios, acompañado de una protección efectiva de escritura.

**Verificación:** dos pestañas modifican la misma revisión; la segunda escritura conflictiva debe rechazarse o crear otra carrera. **Código:** `src/world-storage.js`: `save`, autoguardado; `src/career-library.js`: `onSaved`, `saveCurrent`.

### 2. La importación acepta algunos estados internos que después rompen el juego — alta, reproducido

Una copia con `world.registration.clubs.boca.domestic = null` superó `WORLD_STORAGE.decode`. Al consultar elegibilidad produjo `Cannot read properties of null (reading 'includes')`.

**Impacto:** un JSON dañado, una migración incompleta o un editor externo pueden pasar la validación inicial y fallar después de activar la carrera. La biblioteca conserva otras partidas, pero eso no vuelve válida a la importada.

**Corregir:** validar los estados opcionales de inscripción, desarrollo, medicina, empleados y finanzas antes de reemplazar la partida; migrar versiones conocidas y rechazar estructuras incompatibles.

**Verificación:** importar datos inválidos no debe cambiar estado, guardado activo ni carrera seleccionada. **Código:** `src/world-storage.js`: `validateWorld`; `src/registration-rules.js`: `clubState`, `eligible`.

### 3. Los jugadores generados pueden conservar su edad al avanzar el calendario realista — alta para carreras largas, reproducido

Un juvenil promovido, nacido en 2010 y con edad 16, siguió teniendo 16 al pasar al 1 de enero de 2027. La recuperación diaria actualiza los nacimientos completos, pero no el `birthYear` de los generados. El reinicio por liga tampoco actualiza esa edad como sí hacía la ruta anual antigua.

**Impacto:** distorsiona desarrollo, retiros, valor, filtros y exenciones sub-21. Debe comprobarse también en reservas ficticias y juveniles promovidos por las dos rutas.

**Corregir:** una función común de edad, con fecha de nacimiento simulada para los nuevos jugadores y migración explícita de quienes sólo tienen año.

**Verificación:** pasar varias temporadas en Argentina y Europa; todos envejecen una vez y las exenciones vencen cuando corresponde. **Código:** `src/world-engine.js`: `recoverTo`; `src/season-calendar.js`: `resetClubSeason`; `src/development-centre.js`: `exactAge`.

### 4. Promover un juvenil puede decir «inscrito» sin habilitarlo — alta, reproducido

Se verificó por las dos rutas: academia y reserva. Después de promover, `registered` era `true`, pero su ID no estaba en la lista doméstica y `eligible` devolvía `false`.

**Impacto:** el DT recibe mensajes contradictorios y no puede convocar a quien acaba de subir. Es especialmente importante después de separar los 40 contratos de las listas deportivas.

**Corregir:** todas las incorporaciones y promociones deben pasar por el mismo servicio de inscripción. Si queda pendiente, decirlo; si es exento, aplicar esa condición de forma coherente.

**Verificación:** promover con lista libre, lista llena, ventana cerrada y exención juvenil; ficha, lista, táctica y motor deben coincidir. **Código:** `src/development-centre.js`: `promote`; `src/player-lifecycle.js`: `promoteYouth`.

### 5. La promoción recupera artificialmente toda la condición física — media, reproducido

Un juvenil con condición 35 terminó con 100 al subir desde academia; otro con condición 20 terminó con 100 desde reserva. Esto no demuestra que se borre su lesión: el problema comprobado es el reinicio de condición.

**Corregir:** conservar condición, carga, ritmo y antecedentes médicos al cambiar de categoría. **Verificación:** promover antes y después de un partido de reserva no debe otorgar recuperación gratuita. **Código:** las dos funciones de promoción del punto 4.

### 6. Un sub-21 puede ser exento y, al mismo tiempo, no elegible por falta de inscripción — media, reproducido

Nico O’Reilly, de 20 años en la partida de prueba, fue considerado exento por el perfil inglés y obtuvo autorización de `canRegister`, pero al retirarlo de la lista `eligible` devolvió `false`. Se evalúa `registered === false` antes de la exención.

**Corregir:** separar «no ocupa plaza sénior», «excluido voluntariamente» e «inhabilitado». La interfaz y el motor deben explicar qué significa cada estado.

**Verificación:** un sub-21 inglés elegible por exención no debe necesitar una plaza de la lista sénior. **Código:** `src/registration-rules.js`: `canRegister`, `eligible`.

### 7. La exención juvenil permite saltar el cupo italiano de altas extracomunitarias — media, reproducido

Se incorporaron e inscribieron tres argentinos menores de 21 años procedentes del exterior. Los tres fueron aceptados, aunque el perfil italiano del propio juego limita esas altas a dos por ciclo. El retorno anticipado de «Exento sub-21» evita el control posterior.

**Corregir:** evaluar por separado plaza sénior, nacionalidad y alta internacional. Ser exento de una lista no debe eximir de todas las demás restricciones.

**Verificación:** con el perfil actual, la tercera alta afectada debe permanecer sin inscripción; la compra puede permitirse dentro del plantel de 40. **Código:** `src/registration-rules.js`: `canRegister`, `recordIntake`.

### 8. Las reservas pueden resolver partidos sin el mínimo de participantes — alta, reproducido

Al dejar sin jugadores disponibles a un equipo, se registró un 0–6 con un once vacío frente a sólo cuatro futbolistas. Se actualizaron la tabla y los goleadores.

**Impacto:** resultados y progresión deportiva que no corresponden a un partido disputable. El primer equipo sí tiene control de abandono; la reserva usa otra ruta.

**Corregir:** mínimo de participantes, resolución administrativa o reprogramación, y garantía de que no se inventen goleadores o minutos.

**Verificación:** cero, seis y siete disponibles, incluyendo ausencia de arquero. **Código:** `src/player-lifecycle.js`: `reserveXI`, `reserveGame`.

### 9. La condición cero se interpreta como condición completa en la fuerza de reserva — media, reproducción parcial y código confirmado

La selección de reserva aceptó varios juveniles con condición cero. Además, el cálculo de fuerza usa `(p.condicion_fisica || 100)`: para cero devuelve 100.

**Impacto:** la fatiga extrema puede mejorar artificialmente la fuerza calculada respecto de una condición baja positiva. La sonda comprobó la selección; la equivalencia cero→100 surge directamente de la expresión.

**Corregir:** tratar cero como dato válido y ponderar condición, ritmo y descanso al elegir el once. **Código:** `src/player-lifecycle.js`: `reservePool`, `reserveXI`, `reserveGame`.

### 10. Un jugador puede recibir dos expulsiones en el mismo partido rápido — media, reproducido

Con una secuencia aleatoria controlada, un mismo jugador recibió doble amarilla y después roja directa. La selección para la roja no excluye a los ya expulsados. Además, esta ruta suma 90 o 120 minutos a todos los titulares, sin descontar la expulsión; esto último se confirma por código.

**Corregir:** estado activo por jugador, minuto de tarjeta y minutos efectivos. La probabilidad de este caso no se midió: forzar la secuencia demuestra que el estado imposible está permitido.

**Verificación:** nadie recibe acciones posteriores a su expulsión, ni más de una roja en el informe; minutos y carga se corresponden. **Código:** `src/world-engine.js`: `simulatedStats`.

### 11. Reprogramar por un estadio desplaza toda la fecha — alta, reproducido

Reprogramar un evento de ARG1 con motivo «lluvia en un estadio» cambió la fecha de sus 15 partidos, del 24 al 27 de enero. La unidad de calendario es la jornada completa. El aplazamiento meteorológico también opera sobre esa unidad.

**Impacto:** un problema local altera a otros 28 clubes, descansos, copas y fases dependientes.

**Corregir:** fecha, horario, estado y aplazamiento por partido; conservar la jornada como agrupación visual. **Verificación:** suspender un encuentro no mueve los otros catorce. **Código:** `src/season-calendar.js`: `postpone`, `onDay`; estructura de `calendar[].games`.

### 12. Los filtros pueden usar una valoración deportiva desactualizada durante el mismo día — media, reproducido

Se consultó un filtro de calidad mínima 95, se cambió controladamente la calidad del jugador a 99 y el filtro siguió rechazándolo. Al invalidar el contexto del día, lo aceptó. La clave de caché no incluye una revisión de atributos.

**Corregir:** invalidación por cambios de datos deportivos, informes o contratos, evitando reconstruir toda la búsqueda en cada tecla.

**Verificación:** una mejora o nueva observación debe afectar filtros y orden al instante. **Código:** `src/market-filters.js`: `refreshContext`, `snapshot`.

### 13. Renovar al DT puede aplicar el aumento a días anteriores — media, reproducido

Con seis días pendientes a USD 1.000 semanales, renovar elevó el salario a USD 1.050. Al pagar al día siguiente se cobraron USD 1.050 por la semana completa; el prorrateo de seis días antiguos y uno nuevo daba aproximadamente USD 1.007.

**Corregir:** liquidar hasta la fecha de modificación o conservar tramos salariales. **Verificación:** renovar cualquier día de la semana no altera salarios ya devengados. **Código:** `src/club-governance.js`: `renewManager`, `payManager`, `careerDay`.

### 14. La bandeja clasifica mal algunas decisiones — media, reproducido

Tres casos: una compra esperando respuesta del club figura como pendiente de atención; una vacante laboral nueva no figura como pendiente porque se consultan los empleos antiguos de `world.depth`; una contraoferta de empleado esperando al DT aparece sin atención pendiente y conduce a «Revisar proyectos».

**Corregir:** un estado compartido para «esperando al club», «esperando al jugador», «tu decisión» y «resuelto», con enlaces al expediente exacto de empleados, empleo o pase.

**Verificación:** cada expediente con respuesta requerida aparece una vez y abre la decisión correcta. **Código:** `src/action-inbox.js`: `isPending`, `actionsFor`; `src/club-governance.js`: `message`.

### 15. El guardado inmediato sigue bloqueando perceptiblemente — alta para usabilidad, medido

En una carrera de 17.390 jugadores, la serialización tardó 2.716 ms y una llamada de guardado inmediato 2.362 ms. Tres reconstrucciones del mercado tardaron 706, 221 y 177 ms. Son mediciones puntuales de este entorno, no un benchmark estadístico ni una garantía para otros dispositivos.

El Web Worker ya mejora los autoguardados agrupados; siguen existiendo rutas síncronas. Por código, la biblioteca y los checkpoints también usan `getAll()` sobre registros que contienen las partidas completas, aunque sólo vayan a mostrar metadatos.

**Corregir:** persistencia asíncrona con revisiones, separación de metadatos y payload, lectura de la carrera elegida y renderizados parciales. Mantener la verificación económica sin comprimir todo el mundo dentro del evento del botón.

**Verificación:** medir percentiles de bloqueo con varias carreras, varios años de historial y teléfonos modestos. **Código:** `src/world-storage.js`: `save`, `serialize`; `src/career-library.js`: `list`; `src/career-integrity.js`: `list`, `checkpoint`; render del mercado.

### 16. En móvil, «Preparar partido» queda fuera de la primera vista — media, reproducido visualmente

En 390 × 844, el botón empezaba en y=941, con el área útil terminando en y=844. La página completa no desbordaba: esa métrica por sí sola no detecta un control fuera del panel visible. Existen otras vías de navegación al partido; el problema es la accesibilidad directa del dashboard.

**Corregir:** métricas compactas, menos filas de pestañas y acción principal fija. **Verificación:** rectángulo visible y foco accesible de las acciones importantes, además de medir scroll. **Código:** dashboard en `src/world-ui.js`, `src/viewport-workspace.js` y estilos correspondientes. Ver captura adjunta.

### 17. Eliminar una carrera deja sus checkpoints ocupando espacio — media, reproducido

Después de eliminar una carrera seguían existiendo tres copias con su `careerId` en `fm27-career-checkpoints`. La interfaz ya no las ofrece porque filtra por la carrera activa.

**Corregir:** borrar sus copias o permitir conservarlas explícitamente con un mecanismo de recuperación visible. **Verificación:** eliminar A limpia sólo los registros de A; B conserva todos los suyos. **Código:** `src/career-library.js`: `remove`; `src/career-integrity.js`: base de checkpoints.

### 18. La formación local se exige pero no se acumula durante la carrera — media, confirmado por código

La inscripción lee `trainingHistory`, meses y edad de formación. No se encontró una ruta que escriba ese historial conforme transcurre la partida. Por tanto, los juveniles creados por el propio juego no obtienen automáticamente esa acreditación al completar tres años.

**Impacto:** las plazas reservadas a formación local pueden quedar permanentemente sin cubrir, incluso desarrollando jugadores en el club. La falta de biografías verificadas de jugadores reales es un problema distinto y no justifica perder los años simulados.

**Corregir:** contabilizar períodos por club y país con edad y fechas, preservados en préstamos, promociones y traspasos. **Verificación:** una cohorte completa 36 meses antes de la edad límite y obtiene la condición correcta. **Código:** `src/registration-rules.js`: `trained`; desarrollo y ciclo de jugadores.

### 19. La IA no tiene una revisión continua de sus listas — media, confirmado por código

Se intenta inscribir al jugador al llegar; si no hay cupo, queda fuera. La actualización diaria de inscripción sólo cambia `lastDay`; no selecciona otra lista al liberarse plazas. El registro general de plantel aparece en reinicios de temporada.

**Impacto:** la IA puede tener un refuerzo sin inscribir y no reaccionar después de vender a otro jugador. Separar propiedad e inscripción requiere también un responsable de listas para los clubes rivales.

**Corregir:** revisión durante las ventanas por calidad, puesto, formación y cupos, con decisiones estables. **Verificación pendiente:** fichaje sin cupo → salida que libera plaza → inscripción del reemplazo sin esperar otra temporada. **Código:** `src/registration-rules.js`: `onTransfer`, `onDayAdvance`; `src/world-engine.js`: `registerSquad`.

### 20. Conviven dos caminos distintos para cambiar de empleo — media, confirmado por código

`FM_DEPTH` conserva propuestas de fin de temporada y aceptación de próximo club; `FM_GOVERNANCE` ofrece candidaturas, entrevista, salario, compensación y fecha de incorporación. La pantalla suma ambos recorridos y la bandeja todavía consulta el antiguo en algunos casos.

**Impacto:** diferente negociación y condiciones según el botón utilizado; más riesgo de inconsistencias al cambiar de club. No se afirma aquí una pérdida monetaria reproducida por esta vía.

**Corregir:** migrar los empleos antiguos a expedientes laborales únicos. **Verificación pendiente:** un cambio de club tiene exactamente un contrato, una incorporación, una liquidación y una política de compensación. **Código:** `src/football-depth.js`: `seasonReview`, `acceptJob`, `switchClub`, `career`; `src/club-governance.js`.

## Funciones y profundidad que agregaría después

### 21. Estadísticas permanentes por club, temporada y competición

El jugador acumula goles, minutos y notas, y el reinicio de su liga limpia esos campos. Haría un registro independiente por participación y etapa en cada club: liga, copa nacional, continental y reserva. Evitaría mezclar números de un traspaso y permitiría consultar carreras completas sin depender del límite de informes detallados.

### 22. Distribuciones realistas para los partidos rápidos

Actualmente los goleadores se eligen entre los jugadores de campo sin ponderación equivalente a la del motor interactivo. Haría que posición, rol y atributos influyan en goles, asistencias, tarjetas y minutos; introduciría cambios y efectos de expulsiones. Compararía por liga contra muestras reales y contra el motor jugado, no sólo el promedio de goles.

### 23. Planificación de la IA a varias ventanas

Ya existen necesidades por puesto, proyectos y resistencia de negociación. Agregaría sucesión de veteranos, protección de juveniles, costo total del contrato, valor de reventa y priorización de competencias a dos o tres temporadas. Cada operación debería poder explicarse mediante ese plan y su situación económica.

### 24. Representantes con honorarios y relaciones propias

La negociación personal ya puede contraofertar. Falta una contraparte persistente con honorarios, vínculos entre clientes, paciencia e historial. Mostraría el costo total de la operación y distinguiría salario del jugador, prima y comisión del agente.

### 25. Acuerdos contingentes más variados

Sobre cuotas, reventa y préstamos ya implementados: bonos por clasificación o títulos, objetivos deportivos y opciones de recompra donde corresponda. Cada cláusula necesita disparador verificable, vencimiento, reserva de fondos y asiento contable; no añadiría opciones de formulario sin liquidación efectiva.

### 26. Pruebas, ofertas de contrato y búsqueda de club para agentes libres

Los agentes libres ya se pueden contratar. Profundizaría el período de prueba, negociación de expectativa salarial y rol, preparación física y competencia real por sus servicios. La información obtenida debe depender del tiempo observado, con fecha de salida clara si no se firma.

### 27. Ojeo con territorio, desplazamientos y capacidad de trabajo

Ya hay empleados, encargos y opiniones inciertas. Agregaría rutas por país, calendario de partidos observables, tiempo y costo de viaje, conocimiento regional acumulado y entrega progresiva. La recomendación debería explicar qué vio el empleado y qué falta verificar.

### 28. Compromisos con consecuencias consistentes entre temporadas

El vestuario ya maneja confianza, roles y promesas. Ampliaría el seguimiento para ventas prometidas, competencias específicas y proyectos de carrera, conservando los compromisos al cerrar temporadas. Separaría lo que el DT puede garantizar de lo que depende de resultados o lesiones.

### 29. Sesiones de entrenamiento con objetivo y evaluación deportiva

Hay focos individuales, carga, aprendizaje y evolución. Agregaría sesiones concretas con microciclos editables, reparto entre personal, objetivos de juego y comparación posterior. El beneficio debe aparecer en familiaridad o atributos que consume el motor, con costo físico y retorno decreciente medible.

### 30. Más profundidad táctica a partir de datos del partido

Extendería la preparación del rival y el análisis: xA, progresión por carril, pérdidas bajo presión, combinaciones y rendimiento de las parejas. Sobre las jugadas de pelota parada existentes, permitiría variantes ensayadas y responsabilidades espaciales. Cada gráfico debe provenir de acciones registradas, con aviso cuando la muestra es pequeña.

### 31. Convocatorias y competiciones de selecciones

El calendario contempla ventanas internacionales; no equivale a simular convocatorias, minutos, viajes y regresos. Añadiría selecciones como sistema deportivo, con ausencias y carga compartida con el club, sin inventar fechas oficiales futuras.

### 32. Proyectos institucionales y financiación negociada

Ya hay caja, préstamos, impuestos estimados, presupuesto y mejoras de inferiores. Profundizaría decisiones plurianuales: infraestructura, compromisos del presidente, aportes condicionados, convenios y obras con fechas y efecto real. Las restricciones y los rescates financieros deben tener consecuencias, evitando financiación ilimitada sin costo deportivo.

### 33. Prensa y reputación ligadas a hechos persistentes

Las noticias y sucesos existen. Agregaría conferencias vinculadas a decisiones anteriores, periodistas con seguimiento y efectos proporcionados sobre vestuario, directiva y mercado. Evitaría penalizaciones opacas por una respuesta aislada o textos que atribuyan conductas reales a personas de referencia.

### 34. Interfaz centrada en la próxima decisión y accesibilidad

Conservaría el marco oscuro y las listas con scroll local. Reduciría pestañas simultáneas, daría una jerarquía clara a «tu decisión / esperando respuesta / resuelto», y agregaría accesos contextuales coherentes. Verificaría teclado, foco, tamaño de controles, contraste y nombres accesibles. El diagnóstico móvil del punto 16 debe resolverse antes de una renovación visual general.

### 35. Simulación prolongada y validación automática antes de publicar

Hay una batería extensa de pruebas, pero no encontré un flujo CI en `.github`. Incorporaría un conjunto corto de comprobaciones obligatorias y simulaciones reproducibles de 5–10 temporadas en distintos países. Comprobaría conservación del dinero, edades, población de jugadores, inscripciones, cierre de ligas/copas, cambios de club y carga de guardados. Reduciría la dependencia del orden de wrappers globales con servicios de dominio y eventos bien definidos, conservando la distribución en un solo HTML.

### 36. Base de datos versionada, actualizable y editable con control de procedencia

Las identidades de referencia y las estimaciones deportivas ya se distinguen. Agregaría importaciones incrementales por ID, un informe de cobertura por club y fecha, correcciones editables y validación de nacionalidades, posiciones y contratos. Una actualización de planteles debería poder aplicarse a una carrera nueva sin reescribir los traspasos ni la historia de una partida en marcha. Los atributos y salarios simulados deben seguir identificados como estimaciones; disponer del perfil de Transfermarkt no equivale a tener atributos oficiales de Football Manager.

## Orden de ejecución recomendado

1. **Protección del progreso:** puntos 1–2 y 17, acompañados de pruebas de importación y concurrencia.
2. **Planteles y cantera coherentes:** 3–9 y 18–19. Unificar edad, pertenencia, inscripción y estado físico antes de ampliar sus opciones.
3. **Simulación y calendario:** 10–11, 21–22 y pruebas de descanso entre reserva y primer equipo. La reserva hoy exige descanso después de encuentros sénior, pero la elegibilidad sénior no consulta el partido de reserva anterior; conviene compartir límites y advertencias de carga.
4. **Gestión sin contradicciones:** 12–14 y 20; después 23–28.
5. **Rendimiento y experiencia:** 15–16 y 34–35, con mediciones continuas desde el primer bloque.
6. **Profundidad adicional:** 29–33 y 36, una vez estables los contratos, las listas y la economía.

Para considerar cerrado cada bloque exigiría reproducciones fallidas antes del arreglo, correctas después, y regresiones sobre partidas ya existentes. No daría por resuelto un punto sólo por añadir una propiedad al estado o un botón a la interfaz.
