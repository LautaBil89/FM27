# FM27 · Pasión continental

Simulador de dirección técnica con **565 clubes dirigibles, 30 ligas y 15.183 identidades reales**, Libertadores, Sudamericana y copas UEFA jugables. Se suman 80 invitados continentales con identidad documentada en UEFA y planteles ficticios de cobertura identificados. La aplicación completa está en **index.html**: no hay que instalar paquetes ni compilar para jugar.

## Jugar

1. [Descargá el juego](https://github.com/LautaBil89/FM27/archive/refs/heads/main.zip), extraé el ZIP y abrí **index.html** con Chrome, Edge o Firefox.
2. En **Nueva carrera**, elegí país, liga, club, nombre del DT. La directiva fija el objetivo de cada club; en **Tu DT** elegís estilo y distribuís 60 puntos de atributos. Podés buscar un equipo directamente por nombre.
3. Usá **Continuar** para avanzar automáticamente por mañana, mediodía, tarde y noche hasta una novedad o tu próximo partido. **Parar** detiene el avance. Revisá informes, negociá fichajes y prepará el equipo entre partidos.
4. Cuando llegue el horario de inicio, entrá al Centro de partido. Pausá para ajustar el planteo y realizar sustituciones.

Las partidas anteriores conservan sus equipos, calendarios, jugadores y condiciones. La nueva interfaz y la gestión se incorporan sin reiniciar. Los formatos deportivos por país se eligen al crear carrera; en una carrera anterior podés activarlos para la próxima temporada desde Competiciones, conservando la temporada actual. Exportá tu carrera antes de empezar otra. El guardado pertenece al navegador y a esa ubicación del archivo; Exportar e Importar permiten trasladarlo a otro dispositivo.

También se puede servir en desarrollo con `python3 -m http.server 8000 --directory .`.


## Varias carreras guardadas

**Mis carreras** está disponible en la barra lateral, en el menú móvil y en la pantalla de nueva carrera. Cada partida tiene un identificador propio, aunque uses el mismo DT y club, y su autoguardado no reemplaza a las demás.

- **Nueva carrera** guarda y archiva primero la actual; después abre la elección de DT y club.
- **Cargar** recupera una carrera con su fecha, dinero, plantel, tácticas y, si corresponde, el partido pausado.
- **Renombrar**, **Exportar** y **Eliminar** actúan sobre la carrera elegida. Eliminar requiere confirmación y conserva las demás.
- **Importar carrera** agrega una partida independiente: incluso importar una copia de la actual crea otro registro.

La partida del sistema anterior se incorpora automáticamente al archivo sin reiniciarla. IndexedDB conserva las carreras completas; localStorage mantiene la partida activa para compatibilidad y reapertura. Si el archivo de carreras no puede escribirse, no se abandona la partida actual al intentar crear otra. Los puntos de recuperación también se separan: hasta seis por carrera, sin permitir restaurar los de una sobre otra. Exportar JSON permite llevar una partida a otro navegador o dispositivo.

## Actualización de la auditoría

Los [44 puntos revisados](docs/IMPLEMENTACION_AUDITORIA_2026-10-17.md) incorporan consentimiento personal en ventas, revisión médica antes de fichar, contratos futuros y renegociación de préstamos, 36 atributos individuales, tasaciones mensuales, retiros e inferiores con competiciones propias. Los empleados negocian contratos y responsabilidades, y la carrera del DT dispone de vacantes, entrevistas y fechas de incorporación.

En el partido hay cambios de formación y posición, arquero de emergencia, reglas de convocatoria por competición y orden de penales. El archivo conserva 120 informes completos; las búsquedas admiten puestos múltiples, condiciones Y/O, orden, columnas y perfiles guardados. Las 25 situaciones aleatorias tienen contexto y consecuencias posteriores. La matriz enlazada distingue implementaciones, formatos adaptados y procedencia de los datos.

## Avance diario

Las carreras ampliadas tienen **cuatro turnos por día**: Mañana (08:00), Mediodía (12:00), Tarde (18:00) y Noche (21:00). **Continuar** procesa los turnos hasta recibir una novedad en la bandeja (incluidos informes, ofertas y altas médicas) o llegar al próximo partido. El botón cambia a **Parar** durante la simulación; también se pausa al abrir otra gestión o salir de la ventana. Desde Noche pasa a la mañana del día siguiente. La API interna `WORLD_CLOCK.advance()` sigue avanzando exactamente un turno. La fecha, hora y progreso diario aparecen en el encabezado, y el dashboard muestra la agenda y la actividad reciente del club.

Las carreras nuevas permiten elegir la pretemporada de su país o la fecha de consulta de la base. En el segundo caso se simulan resultados previos sin imputarlos al DT recién incorporado; los planteles de referencia siguen identificados como una selección histórica. El entrenamiento y la familiaridad táctica se trabajan una vez al día, al mediodía. La condición, las lesiones, las edades, los vencimientos y la actividad de los clubes se actualizan al pasar al siguiente día. Los salarios y patrocinios siguen siendo semanales, y los pagos de cuotas conservan sus fechas: cuatro turnos no multiplican esas operaciones. Las ofertas y las contraofertas aceptadas reciben respuesta a partir del día siguiente, aunque no haya partido.

Los partidos locales se juegan en el turno Tarde y los continentales en Noche. Las otras competiciones se simulan cuando llega su fecha y turno, incluso si tu equipo todavía no juega. Podés consultar el próximo rival y preparar la táctica antes, pero no iniciar el encuentro anticipadamente. Al llegar a tu partido, Continuar abre la previa y espera tu intervención. Después del informe permanecés en esa misma fecha y turno; el juego no salta al siguiente encuentro. Si tu club termina su calendario antes que otras competiciones, el mundo sigue avanzando hasta el cierre de temporada.

Esta mejora se aplica también a las partidas ampliadas existentes: al importar o cargar una carrera sin reloj, conserva la fecha, los resultados, los jugadores y la economía. Si ya estabas en un día de partido, comienza en el turno del encuentro. El turno actual se guarda y se conserva al exportar e importar. Las carreras antiguas de 12 clubes mantienen su funcionamiento anterior.

## DT, empleados y decisiones del club

Cada club recibe objetivos de directiva según su nivel relativo en la liga: título, clasificación continental, ascenso, mitad superior o permanencia. Se muestran antes de empezar y se revisan al cambiar de temporada o club. Una partida anterior conserva el objetivo ya pactado durante la temporada en curso; la siguiente adopta los objetivos automáticos. La evaluación de todos los clubes usa títulos, ascensos, descensos y clasificación efectivos; incumplimientos reiterados pueden provocar cambios de DT en la IA. No son datos oficiales de sus directivas: son expectativas de esta simulación.

El DT tiene estilo preferido y seis atributos de 1 a 20, con un máximo de 60 puntos. Táctica acelera la adaptación al estilo; entrenamiento mejora el desarrollo juvenil; motivación y disciplina afectan la moral; negociación modifica las expectativas salariales; evaluación influye en los plazos de ojeo. Al comenzar quedan fijados. Las partidas anteriores pueden definirlos una vez desde **DT y empleados**, sin reiniciar.

**DT y empleados** muestra ayudante, cinco ojeadores, atributos, conocimiento regional, encargos activos y salarios semanales. El personal es generado para la carrera. Cada ojeador ocupa una observación y sus características, región y el perfil del DT modifican su duración; los avances llegan a la bandeja. Podés elegir el empleado desde Ojeo, consultar la fecha prevista y cancelar una observación conservando el conocimiento obtenido, sin devolución del cargo. Si el empleado elegido está ocupado o faltan fondos, el encargo delegado queda en espera y reintenta sin anunciar un trabajo que no inició. El coste de cada informe sigue siendo USD 1.500. Podés delegar el entrenamiento diario, un encargo de ojeo semanal con puesto/nacionalidad/edad/valor máximo y la revisión mensual de vencimientos. Los empleados preparan informes; el DT conserva la firma de contratos y transferencias.

Desde la ficha del jugador o **Lista de préstamos**, ofrecé un futbolista para cesión. Los clubes pueden presentar ofertas de compra por jugadores no listados y propuestas de préstamo por los ofrecidos, con cargo, duración, salario y regreso registrados. Los contactos pueden llegar en distintos turnos y fuera de la ventana de pases; los fichajes iniciados por el DT conservan las reglas de mercado existentes. Esta versión conserva la simplificación de ejecutar las ofertas entrantes aceptadas en la fecha de decisión.

Mercado y ojeo reúnen la búsqueda avanzada en **Filtros**. La ventana permite combinar puesto exacto y línea, doble nacionalidad, país/liga/club, edad, agentes libres, contratos próximos a vencer, cesión activa, valor, salario, cláusula y presupuesto; también pie, altura, condición, moral, rendimiento y conocimiento de ojeo. Los rangos deportivos usan las estimaciones disponibles, con condiciones individuales para 36 atributos de 1 a 20; no revelan el potencial oculto. Aplicar guarda los criterios; Cancelar conserva la búsqueda anterior y Limpiar quita las restricciones. El buscador por nombre actualiza únicamente los resultados, conserva el cursor y admite nombres sin tildes. La bandeja muestra remitente, estado actual, vencimiento cuando está registrado, próximo paso y condiciones reales de la operación. Distingue acuerdo con el club, contrato con el jugador y contraoferta.

Los contactos de compra y préstamo de la IA se evalúan una vez al día, con un máximo de tres nuevos contactos en treinta días y separación entre propuestas. Los jugadores ofrecidos atraen más consultas; los no listados siguen pudiendo recibirlas. Cada negociación de compra tiene una comprobación persistente de competencia rival: la mayoría no tiene una puja competidora, y abrir el formulario o contraofertar no vuelve a sortearla. Las referencias salariales sólo consideran propuestas rivales activas.

## Dirección técnica: partidos y proyecto

El motor de los partidos del usuario construye secuencias de acciones y posesiones, con pases, conducciones, presión, recuperaciones y remates ligados a los jugadores en cancha. La posición de la pelota y los futbolistas sigue esas acciones. El origen de la ocasión, sus participantes y el resultado quedan registrados: pases, remates, xG y comentarios utilizan los mismos eventos. Las repeticiones recuperan jugadas registradas y pausan el reloj; las estadísticas se conservan al volver al directo.

En **Tácticas → Convocatoria**, la cancha y la formación aparecen a la izquierda; los siete suplentes, a la derecha, y las reservas debajo. Podés intercambiar puestos o asignar una reserva sin cambiar de pestaña. Las listas largas se desplazan dentro del panel. También aparecen las pestañas **Fases** y **Pelota parada**. Podés definir salida, progresión, último tercio, bloque, orientación de la presión y reacción a pérdidas y recuperaciones. Las instrucciones individuales y las marcas sobre rivales concretos modifican las probabilidades y los espacios. Las rutinas a balón parado tienen especialistas, movimientos, coberturas y familiaridad propia. Priorizar esos ensayos consume tiempo de adaptación del plan general. Los rivales revisan las ocasiones, pérdidas, fatiga y marcador en momentos concretos para hacer ajustes limitados y explicables.

La velocidad **1×** del partido avanza un minuto simulado cada 1,5 segundos; **3×** conserva el ritmo del anterior 1× (0,5 segundos). También hay 10× y 30× para acelerar. Cambiar la velocidad no modifica las probabilidades deportivas.

El **Centro de partido** incorpora una cancha más amplia, trayectorias de las acciones, acceso a cambios y ajustes, lectura del ayudante, mapa de remates y repeticiones. Las jugadas conservan sus participantes y contexto; el control de reproducción permite inspeccionarlas sin avanzar el partido. El motor sigue siendo una simulación probabilística por secuencias: ninguna instrucción garantiza una victoria.

En **Vestuario** podés revisar jerarquías, liderazgo, grupos de trabajo, adaptación, expectativas de minutos y rasgos simulados. Las conversaciones y promesas utilizan minutos y valoraciones efectivamente registrados. Las mentorías tienen referentes, capacidad limitada y seguimiento de 21 días; sus resultados influyen de forma acotada en confianza y desarrollo. Personalidades, liderazgo y relaciones pertenecen a esta carrera, no a la base histórica del jugador.

**Entrenamiento** reúne microciclo, planes individuales, inferiores y empleados. El calendario determina cuándo preparar, recuperar o reducir carga; las decisiones individuales contemplan fatiga, riesgo, aprendizaje de posiciones, edad y potencial. Las inferiores reciben prospectos simulados por temporada y permiten promoverlos cuando hay presupuesto y plazas. La contratación de empleados tiene costes, salarios, límites y efectos sobre el trabajo. La delegación ejecuta tareas según los criterios elegidos; los costes del cuerpo técnico se liquidan una sola vez por semana.

El **mercado** añade representantes con prioridades y plazos, propuesta deportiva y competencia entre proyectos. Los acuerdos firmados fuera del período de inscripción se incorporan al abrir la siguiente ventana: el jugador permanece en su club, y fondos, salario, plaza y cupos quedan comprometidos. La inscripción revalida la operación y evita cobrarla dos veces. Los períodos siguen la regla anual adaptada del simulador: enero–marzo y julio–agosto, común a las ligas incluidas. La reputación, actividad económica y planteos de los clubes evolucionan durante la carrera.

En **Carrera y proyectos** hay puntos de recuperación e historial de decisiones. Las copias locales usan IndexedDB y conservan hasta seis estados por carrera; una recuperación valida la carrera antes de sustituirla. La falta de espacio o de IndexedDB no sustituye ni daña el guardado principal. **Exportar JSON** permite conservar una copia fuera del navegador y trasladar la carrera. El historial guarda los acuerdos y novedades con su fecha y evidencia, con un límite para evitar crecimiento indefinido.

## Realismo de las carreras

Las carreras nuevas usan **temporadas por país**. Europa cruza de agosto a mayo; las ligas sudamericanas mantienen sus fases anuales. Cada país cierra e inicia sus categorías sin reiniciar las demás. Se conservan resultados por temporada, hay preparación, ventanas internacionales, receso mundialista 2026 y reprogramaciones con descanso mínimo. Las fechas, cruces y proyecciones futuras se generan: no son el fixture oficial. **Competiciones → Temporadas** permite consultar todos los ciclos. El calendario anual de legado sigue disponible; las partidas anteriores lo conservan y pueden programar la migración al cerrar una temporada.

- **Inscripción:** listas domésticas y continentales separadas, nacionalidades múltiples, cupos extranjeros por país y reservas de formación sólo cuando existe historia verificable. Las listas iniciales se conservan para no invalidar carreras. Algunos perfiles nacionales y plazos continentales son simplificaciones expresamente indicadas; no se reproduce todo el derecho federativo.
- **Contratos:** vencimientos exactos, renovación negociada, aumentos por aniversario, precontratos de últimos seis meses, consentimiento efectivo del club en los supuestos ingleses, rescisión y préstamos que no pueden superar el vínculo del propietario. La fecha contractual publicada queda separada del contrato de carrera.
- **Medicina:** carga individual, viajes, descanso, ritmo competitivo, diagnóstico, intervalo de recuperación, rehabilitación y riesgo de recaída. La condición física y la preparación competitiva son variables distintas. La pestaña médica del entrenamiento y la ficha propia permiten seguir el tratamiento.
- **Economía:** caja, autorización para fichar y resultado contable separados; cuotas, amortización de pases, valor contable al vender, obligaciones, créditos y proyecciones. No se inventan costos históricos de los jugadores iniciales. Impuestos, monedas y acuerdos comerciales son escenarios ficticios declarados, no finanzas publicadas de cada club.
- **Ojeo y desarrollo:** atributos observados e intervalos, confianza y opiniones de empleados distintos. La IA también decide con estimaciones y no consulta el potencial oculto. El crecimiento depende de edad, posición, minutos, entorno, preparación y lesiones; un cambio de año no cura automáticamente ni resta atributos a todos los veteranos.
- **Ascensos:** las primeras y segundas categorías intercambian clubes una sola vez después de resolver fases y promociones; los filiales inhabilitados no ocupan plazas de ascenso. No se simulan terceras categorías ni sanciones administrativas.

El simulador rápido se calibra con **4.076 partidos reales representados de 15 primeras divisiones**, con cobertura y fuente por liga. Football-Data aporta Europa 2025/26 y Argentina/Brasil 2025; Transfermarkt y RSSSF aportan muestras sudamericanas fechadas o tablas reconciliadas. Cuando sólo existe tabla, la localía se estima y se declara; las divisiones sin muestra usan una referencia prestada. **Competiciones → Motor y referencias** muestra esta distinción. Las pruebas estadísticas ejecutan 200 temporadas por liga; esto valida la distribución del modelo rápido. El partido minuto a minuto aplica ajustes acotados de frecuencia y conversión, manteniendo las causas tácticas, sin afirmar igualdad exacta con las medias históricas.

La incidencia médica usa como referencia histórica el estudio de [Ekstrand, Hägglund y Waldén, 2011](https://bjsm.bmj.com/content/45/7/553), DOI 10.1136/bjsm.2009.060582: 23 clubes europeos masculinos, temporadas 2001–2008, 27,5 lesiones de partido y 4,1 de entrenamiento por mil horas de exposición. No son tasas medidas de cada liga de este juego.

## Ligas y clubes incluidos

| País | Liga | Clubes | Planteles de referencia |
|---|---|---:|---|
| Argentina | Liga Profesional | 30 | 2026 |
| Argentina | Primera Nacional | 36 | 2026 |
| Brasil | Série A | 20 | 2026 |
| Uruguay | Primera División | 16 | 2026 |
| Chile | Primera División | 16 | 2026 |
| Paraguay | Primera División | 12 | 2026 |
| Bolivia | Primera División | 16 | 2026 |
| Ecuador | Serie A | 16 | 2026 |
| Perú | Liga 1 | 18 | 2026 |
| Colombia | Primera A | 20 | 2026 |
| Venezuela | Primera División | 14 | 2026 |
| Inglaterra | Premier League | 20 | 2025/26 |
| España | LaLiga | 20 | 2025/26 |
| Italia | Serie A | 20 | 2025/26 |
| Alemania | Bundesliga | 18 | 2025/26 |
| Francia | Ligue 1 | 18 | 2025/26 |

La base original conserva las primeras divisiones completas de los diez países de CONMEBOL, la segunda división argentina completa y las cinco grandes ligas europeas completas. Todos los clubes pueden dirigirse. Las tablas, partidos y estadísticas de las otras ligas se simulan en paralelo y pueden consultarse en Competiciones. El mercado permite filtrar por país, liga y club y muestra resultados paginados.

Al crear carrera podés elegir **Formatos por país** (predeterminado) o **Calendario clásico**. En Argentina:

- LPF: Apertura y Clausura, cada uno con dos zonas de 15, 16 fechas regulares por club y eliminatorias de los ocho primeros de cada zona. La tabla anual suma las 32 fechas regulares; las eliminatorias deciden los campeones.
- Primera Nacional: dos zonas de 18, 34 fechas por club, final entre ganadores de zona para el primer ascenso y reducido para el segundo. El perdedor de la final se incorpora al reducido.
- Descienden dos clubes de LPF: el último anual y el peor promedio restante. Los promedios usan hasta tres temporadas efectivamente jugadas en la carrera; no se inventan puntos históricos. Los campeones tienen prioridad para la clasificación continental.

Las zonas y fechas son una adaptación jugable, no una importación del fixture oficial. No se incluyen descensos de Nacional a una tercera categoría. El modo clásico mantiene una vuelta en ambas divisiones y dos ascensos/descensos por tabla. Las demás ligas incorporan estas estructuras deportivas:

| Liga | Estructura implementada |
|---|---|
| Brasil | 38 fechas, título por tabla y victorias como primer desempate |
| Chile | 30 fechas y desempate neutral si hay igualdad de puntos por el título |
| Bolivia | Torneo largo de 30 fechas |
| Paraguay | Apertura y Clausura independientes de 22 fechas cada uno, anual de 44 y promedios |
| Uruguay | Apertura 15, Intermedio de dos grupos con siete fechas y final, Clausura 15 y definición contra el líder anual |
| Colombia | Apertura 19 + playoffs de ocho a ida/vuelta; Finalización 19 + cuadrangulares de seis fechas y final de ida/vuelta |
| Ecuador | Fase inicial de 30 fechas; hexagonales de título y descenso de diez fechas y cuadrangular internacional de seis, conservando puntos |
| Perú | Apertura y Clausura de 17 fechas; playoffs condicionales según campeones y acumulada, con finales directas o pases de ronda |
| Venezuela | Apertura y Clausura de 13 fechas, cuadrangulares de seis fechas, finales únicas y final absoluta condicional |
| Inglaterra, España e Italia | 38 fechas; minitablas de enfrentamientos directos en España e Italia, y desempates italianos por título y salvación |
| Alemania y Francia | 34 fechas y posiciones diferenciadas de descenso directo y promoción |

La ampliación añade estas **14 competiciones de ascenso**:

| País | Competición | Clubes |
|---|---|---:|
| Inglaterra | Championship | 24 |
| España | Segunda División | 22 |
| Italia | Serie B | 20 |
| Alemania | 2. Bundesliga | 18 |
| Francia | Ligue 2 | 18 |
| Brasil | Série B | 20 |
| Chile | Liga de Ascenso | 16 |
| Uruguay | Segunda División | 14 |
| Paraguay | Intermedia | 16 |
| Ecuador | Serie B | 12 |
| Perú | Liga 2 | 18 |
| Colombia | Primera B | 16 |
| Venezuela | Liga FUTVE 2 | 17 |
| Bolivia | Pool de fase nacional de Copa Simón Bolívar | 24 |

El catálogo combinado contiene **565 clubes, 30 competiciones y 15.183 identidades reales únicas**. Se agregan 5.963 identidades sin cambiar ninguna de las 9.220 originales. Los planteles adicionales con cobertura incompleta se completan con reservas ficticias marcadas; no se cuentan como jugadores reales.

**Bolivia:** no se pudo verificar la nómina nacional 2026. Se emplea un pool histórico RSSSF 2025 adaptado (Real Potosí, ya en Primera, se sustituye por Wilstermann). No equivale a los participantes, sorteo ni ligas departamentales oficiales 2026; sus planteles no verificados usan reservas ficticias. Otros suplementos históricos y adaptaciones de fases se identifican en la competición y la fuente.

Hay Champions, Europa League y Conference con fase liga y eliminatorias, además de copas nacionales adaptadas a las divisiones incluidas. El acceso y los coeficientes UEFA son escenarios de carrera, sin reproducir íntegramente la lista federativa ni los bombos oficiales. Los campeones continentales y algunas copas domésticas influyen en la clasificación siguiente. Los promedios usan únicamente temporadas jugadas. Las fases y ventanas no equivalen a una reproducción completa de cada reglamento federativo.

En **Competiciones → Ligas nacionales**, elegí la liga y alterná Fases y finales, Acumulada, Calendario, Promedios y Reglamento. Las etapas finales reciben únicamente equipos clasificados; los cruces opcionales quedan sin jugar cuando el reglamento resuelve el título automáticamente. Cada campeón se registra por su torneo y los objetivos consideran sus títulos, no únicamente la posición anual.

Las carreras anteriores conservan la temporada actual. **Activar formatos por país el próximo año** aplica las estructuras nuevas al comenzar la siguiente temporada. La actualización conserva los 310 clubes y las 9.220 identidades originales sin alterar sus datos; el catálogo adicional se incorpora únicamente a carreras nuevas.

## Libertadores y Sudamericana

La temporada inicial utiliza los **ocho grupos reales de 2026 y sus 32 participantes en cada copa**, contrastados con el calendario público de Transfermarkt. La carrera simula sus propios resultados, sin importar marcadores históricos.

- Cada grupo tiene cuatro clubes y seis jornadas de ida y vuelta. Se ordena por puntos, diferencia de gol y goles a favor.
- Libertadores: los dos primeros de cada grupo pasan a octavos; los terceros acceden al playoff de Sudamericana.
- Sudamericana: los ganadores de grupo pasan a octavos. Los segundos juegan un playoff contra los terceros de Libertadores.
- Playoff, octavos, cuartos y semifinales se juegan a ida y vuelta; la final es única. Empate en el global: penales, sin regla de gol visitante. Con los nuevos reglamentos, las finales continentales tienen 30 minutos de prórroga antes de los penales. Los grupos y partidos de ida permiten empates.
- Las fechas continentales alternan con el torneo local, de martes a jueves; las finales se juegan en fin de semana.
- En temporadas siguientes, los campeones y la clasificación deportiva de cada país ordenan las plazas. Se conserva la distribución nacional de los grupos iniciales, con sorteos simulados sin repetir países dentro de un grupo.

La edición CONMEBOL de 2026 conserva los grupos de referencia. Desde el siguiente ciclo se juegan las tres fases previas de Libertadores y los cruces nacionales de Sudamericana, incluyendo cuatro eliminados de la última previa de Libertadores. Las copas UEFA usan 36 equipos y ocho rivales en Champions/Europa, seis en Conference; los ocho primeros avanzan directamente a octavos y el 9º–24º juega playoff. Accesos, adversarios y fechas se adaptan al universo incluido.

## Fichas, tácticas y decisiones del club

Las carreras ampliadas incorporan una ficha de jugador completa, con pestañas Resumen, Atributos, Evolución, Estadísticas, Contrato y Fuentes. Podés comparar con cualquier futbolista del mundo, revisar posiciones naturales y aptitud de roles, y ver estrellas relativas a tu plantel. Los 36 atributos detallados son estimaciones derivadas de la simulación; las biografías y tasaciones siguen separadas en Fuentes. La evolución registra tus propios meses de carrera, sin inventar un historial previo. Abrir una ficha durante el partido lo pausa y permite volver al encuentro.

La cancha táctica permite intercambiar jugadores mediante arrastre, selección por toque o teclado. Muestra adaptación al puesto y alternativas, y permite guardar, cargar, renombrar o eliminar hasta cinco planes. Cada jugador tiene instrucciones de desmarques, pases, riesgo, entradas, marcaje y deber. La familiaridad mejora con la práctica. Las instrucciones y la aptitud afectan ataque, defensa, movimiento, desgaste y riesgo de tarjetas. La convocatoria elegida se conserva al avanzar mientras siga disponible; la selección automática se aplica cuando la pedís o hace falta reemplazar bajas. Durante el partido la convocatoria permanece bloqueada: las sustituciones se hacen desde el banco; los ajustes individuales sí están disponibles.

La bandeja tiene listado y panel de lectura, búsqueda y filtros de pendientes, no leídos y categoría. Sus acciones permiten aceptar o rechazar propuestas, resolver contraofertas, renovar, abrir fichas e informes, encargar ojeo y asignar recuperación. Las acciones revisan la situación actual y una oferta cerrada no vuelve a ejecutarse. La recuperación modifica el plan y no cura una lesión inmediatamente.

## IA de los clubes y contratos

Los clubes rivales administran caja, presupuesto salarial, necesidades de posición y preferencias de juego. Analizan oportunidades en las ventanas del simulador, compiten por jugadores, compran, piden préstamos y renuevan a futbolistas importantes. Buscan mantener cobertura y respetar el máximo de 32 jugadores, cupos y reservas para retornos de préstamos. Los jugadores de tu equipo permanecen bajo tu control: la IA envía una oferta y la venta requiere tu decisión.

Las **renovaciones** ya no se firman al pulsar el botón. El representante evalúa la propuesta desde el día siguiente, puede contraofertar y admite nuevas rondas dentro de su plazo. Se negocian salario, prima, duración, rol, aumento anual, cláusula y primas deportivas. Mientras se negocia sólo se reservan prima e incremento salarial; la firma revalida el presupuesto y conserva la confianza, los minutos y las promesas del vestuario. Los avisos utilizan la fecha exacta de vencimiento y el expediente se consulta desde la ficha, la bandeja o **Ofertas y contratos**. Una salida ya firmada impide renovar y una salida efectiva cancela las conversaciones pendientes.

La [revisión de jugabilidad por sistema](docs/REVISION_JUGABILIDAD.md) distingue los problemas corregidos de las decisiones y consecuencias que siguen pendientes, con los módulos implicados y una prioridad concreta.

La negociación tiene **dos etapas**: primero se acuerdan con el club el precio, las cuotas, el porcentaje de futura venta o las condiciones del préstamo. Cuando el club acepta, se habilita **Negociar contrato** en Ofertas para presentar salario, duración, rol, cláusula y primas al jugador. Cada etapa recibe respuesta desde el día siguiente y puede generar una contraoferta. La aceptación del club reserva fondos, pero no transfiere al jugador ni cobra el pase; la firma completa la operación una sola vez. Los agentes libres negocian directamente sus condiciones personales.

Podés **Contraofertar** tanto las ofertas por tus jugadores como las contrapropuestas del club vendedor y del representante, desde la bandeja o **Ofertas y contratos**. Cada ronda conserva el mismo expediente y un historial con fechas e importes. El comprador responde desde el día siguiente; mientras evalúa no podés confirmar la venta de una propuesta que todavía no aceptó. Las rondas no cambian la propiedad ni cobran el pase y funcionan en carreras guardadas.

La firmeza de cada club es simulada y cambia con su liquidez, deuda, cobertura de la posición, contrato restante y situación de transferible. Las compras también consideran cuotas y futura venta; los compradores tienen un límite según valoración y presupuesto. Hay concesiones limitadas y plazos: insistir indefinidamente o pedir cifras desproporcionadas puede terminar la negociación. Las preferencias simuladas no representan políticas comerciales verificadas de los clubes reales.

Se admiten pagos al contado o en 3/6/12 cuotas y préstamos de seis/doce meses con reparto salarial. En un préstamo se conserva el contrato y salario del propietario, se acuerda el rol con el jugador y se restaura su club al vencimiento. Las primas por aparición, gol y valla invicta se pagan por su participación real y se registran en finanzas. Un cedido no puede revenderse ni renovar con el prestatario. Las ofertas guardadas con el flujo anterior conservan su resolución compatible.

La negociación muestra plazas del plantel, extranjeros inscritos, margen salarial y fondos disponibles. Si una oferta no puede enviarse, el motivo permanece visible dentro de la ventana, con acceso a Plantilla o Finanzas cuando corresponde. Algunos clubes comienzan con las 32 plazas ocupadas: deben concretar una salida antes de incorporar otro jugador. Los importes inválidos se explican en el mismo formulario y los salarios permiten valores enteros, sin exigir múltiplos de 100.

El registro del mercado muestra las últimas operaciones y renovaciones de la IA, enlazadas a las fichas. Los historiales se limitan para mantener el guardado compacto. La IA y los contratos pertenecen a la simulación, no a un mercado real ni a fichajes posteriores verificados en Transfermarkt.

Las partidas ampliadas anteriores a esta actualización conservan jugadores, resultados, contratos y economía al importar o continuar; los módulos nuevos se inicializan sin reiniciar la carrera.

## Proyectos, representantes y carrera

La IA tiene políticas deportivas persistentes: **competir por títulos**, **desarrollar y vender** o **equilibrar las cuentas**. La política modifica la puntuación de candidatos y los precios de venta. Al revisar la temporada, un club con poca liquidez puede pasar a ahorrar; un aspirante a títulos que termina en el último cuarto de su liga cambia de ciclo técnico y ajusta su planteo. Son decisiones del simulador, no nombres o noticias de entrenadores reales. Cada cantera prioriza técnica, físico o defensa, y eso afecta a los juveniles generados en años siguientes.

Los jugadores valoran reputación, rol ofrecido, nivel competitivo, participación continental, relación disponible con el DT e interés rival reciente. Pueden pedir más salario o rechazar una promesa de titularidad poco creíble. Un rival con necesidad y fondos puede presentar condiciones por tu objetivo: al resolver el contrato, el jugador compara ambas propuestas. Si elige al rival, se valida y ejecuta esa operación; tu pase no se cobra. El representante explica sus preferencias y su referencia salarial. Las primas incluyen un importe por título, liquidado una vez al cerrar la temporada a los integrantes que hayan participado.

Los préstamos admiten **opción** u **obligación de compra**. Se acuerdan precio y modalidad con el propietario, quedan bloqueados durante la negociación personal y se conservan al guardar. Una opción se ejecuta desde Préstamos activos en Ofertas y contratos. Una obligación reserva también su precio futuro y se intenta cobrar al vencimiento. Si faltan fondos, permanece pendiente y no se transforma en una devolución gratuita. La compra mantiene salario y condiciones personales pactadas, con el plazo restante de contrato y un mínimo de un año.

En **Carrera y proyectos** podés consultar prioridades, políticas de tu liga, ciclos técnicos, trayectoria y títulos registrados desde esta actualización. Al terminar cada temporada llegan hasta tres propuestas acordes con tu nivel; aceptarlas cambia de club al iniciar el próximo año y conserva el mundo, resultados e historial. La caja y el plantel pertenecen al club, no al entrenador. Con confianza inferior a 20 y objetivo incumplido, la directiva termina el ciclo y necesitás elegir un nuevo proyecto para continuar. Los cambios de trabajo se realizan entre temporadas.

## Ojeo progresivo

Las identidades y referencias públicas siguen visibles. La calidad y el potencial de futbolistas externos empiezan como rangos con 15% de conocimiento; tus propios jugadores están evaluados. Cada encargo cuesta USD 1.500 en total y ocupa uno de cinco observadores. El seguimiento avanza al pasar días: 40% en dos días, 70% en cuatro y evaluación completa en siete. Repetir el botón no duplica cargos. Los informes completos pierden precisión con los meses y pueden renovarse; los informes de partidas anteriores se conservan.

El centro de ojeo permite filtrar por puesto, edad y costo estimado del primer año, y comparar hasta tres objetivos por calidad conocida, potencial, salario y encaje en tu plantel. El costo orientativo suma pase estimado y 52 salarios, sin primas. Mercado, fichas y comparaciones muestran rangos de atributos mientras falta observación; las estadísticas de partidos son registros públicos de la carrera. Los filtros de mercado y ojeo se guardan con la partida.

## Interfaz, vestuario y jugadas

El inicio muestra un acceso a las decisiones pendientes y Carrera ofrece botones para resolver contratos, ofertas y bajas. La interfaz ocupa la ventana: las pantallas se dividen en pestañas y paneles, con las acciones principales visibles. Las tablas, listados y lectores extensos tienen desplazamiento interno. En celular hay un menú desplegable y pestañas adaptadas; tácticas separa cancha, banco, equipo, jugador y planes. El diálogo de negociación mantiene el envío visible y separa condiciones de primas.

**Vestuario** incorpora confianza, expectativas de minutos, charlas individuales y reuniones de grupo. Elogiar, exigir o apoyar tiene consecuencias según rendimiento y situación; las charlas y reuniones tienen límites de frecuencia. Podés prometer 180 minutos en 21 días: sólo cuentan minutos efectivamente disputados, y cumplir o incumplir modifica la relación. Los roles negociados influyen en las expectativas. Son relaciones simuladas, no datos personales de Transfermarkt.

El partido muestra trayectorias de las ocasiones realmente generadas por el motor, con protagonista, resultado y xG. Podés usar presentación animada o estática; respeta pausa y movimiento reducido. La IA rival ajusta su planteo alrededor de los minutos 60 y 75 según el marcador. El panel Lectura del ayudante explica diferencias de xG, calidad media de remates, delanteros sin tiros y fatiga, con los datos que sustentan cada consejo. Aplicar una sugerencia pausa el encuentro y modifica tu planteo sólo cuando lo pedís. No se inventan mapas de pérdidas ni pases recibidos: el motor todavía no registra esos datos.

## Centro de partido

El marcador y los controles de pausa y velocidad permanecen visibles. El botón del encabezado también pausa, reanuda o cierra el informe según el estado. En escritorio la cancha horizontal comparte espacio con el relato; en celular las vistas se organizan en Cancha, Relato, Cambios, Estadísticas, Jugadores y Ayudante, sin desplazar toda la página. Los listados largos tienen desplazamiento interno.

- Los 22 marcadores abren fichas y reflejan expulsiones, lesiones y sustituciones. La ubicación representa el esquema; no pretende ser seguimiento posicional real.
- La cronología muestra goles, tarjetas y cambios del motor. El relato puede filtrarse a momentos clave.
- Abrir Cambios pausa el partido y conserva la selección. Podés realizar varios cambios en la misma pausa, respetando cinco cambios y tres ventanas, con la excepción del descanso.
- Estilo, mentalidad, ritmo, presión y línea defensiva se ajustan desde la misma pantalla; las arengas conservan sus efectos y tiempos de espera.
- Las estadísticas incluyen posesión, remates, xG, córners y disciplina. El gráfico de xG acumulado usa las ocasiones realmente registradas y diferencia a ambos equipos.
- Las finales continentales y argentinas incluyen prórroga con los nuevos reglamentos. El reducido de Nacional aplica ventaja deportiva en las rondas anteriores a su final.

## Gestión y partidos

- Bandeja de entrada, noticias, presión de la hinchada, confianza directiva, finanzas y estadios.
- Once inicial, siete suplentes, seis formaciones, roles, mentalidad, amplitud, ritmo, presión, capitán y lanzador de penales.
- Entrenamiento colectivo e individual, recuperación, desarrollo limitado por potencial y riesgo de sobrecarga.
- Ojeo, informes pagados, seguimiento, negociación de pase, salario, prima y duración; respuestas posteriores y ofertas por jugadores transferibles.
- Inscripción y cupos por país. En Argentina se conservan seis extranjeros inscritos; las otras ligas sudamericanas usan los límites definidos por el simulador. Las ligas europeas permiten el plantel internacional completo y no reproducen requisitos laborales ni todos sus reglamentos de inscripción.
- Motor minuto a minuto con xG, tiros al arco, atajadas, córners, asistencias, lesiones, tarjetas, entretiempo, tiempo añadido y penales.
- Cinco sustituciones en tres ventanas, además del descanso; ajustes tácticos y arengas en vivo. Los rivales respetan disponibilidad e inscripción.
- Clásicos con más intensidad, tarjetas, presión mediática y consecuencias sobre la moral.
- Premios diferenciados para Libertadores y Sudamericana, recaudación, salarios, fichajes y aportes de directiva.

## Datos reales y estimaciones

Las membresías y planteles se verificaron en páginas públicas de **Transfermarkt**: Sudamérica 2026, Europa 2025/26. Cada jugador tiene identidad numérica única, perfil, nacimiento, posición, nacionalidades y, cuando están publicados, pie, altura y valor de referencia. El núcleo conserva **9.220 identidades únicas**, seleccionadas en planteles de 18–32 con al menos dos arqueros y cobertura de posiciones; el catálogo ampliado suma **15.183 identidades reales**. Los suplementos sin cobertura suficiente usan reservas ficticias, identificadas como tales. Los jugadores de temporadas superpuestas o transferidos aparecen en un solo club.

Son selecciones de participantes de la temporada de referencia, **no listas de inscripción actualizadas en vivo**. En Águilas Doradas, Sebastián Guerra completa la segunda plaza de arquero como participante histórico de 2025, identificado por su fuente. Libertad incluye canteranos reales publicados en 2026. Los juveniles que aparecen en años futuros son generados por la simulación y se identifican expresamente.

Hay **3.670 tasaciones con fecha individual**, procedentes del archivo CSV complementario. Las cifras disponibles únicamente en las tablas de planteles conservan `valuationDate: null` y la ficha aclara que su fecha de consulta no es la fecha de valoración. Los valores sin cotización permanecen ausentes en la referencia, con un valor de juego estimado. No se convierten guiones en precios cero ni jugadores libres.

Las edades se calculan con el nacimiento completo y la fecha de carrera. Los atributos técnicos, mentales, potencial, personalidad, salarios, cláusulas, presupuestos y condiciones contractuales negociadas del juego son **estimaciones**, no atributos oficiales de Football Manager. Transfermarkt no contiene esos atributos de FM. La referencia se publica en EUR y el valor de carrera se expresa en USD usando EUR 1 = USD 1,10; la contabilidad usa los coeficientes por país declarados en Finanzas (ARS 1.100 por USD en el escenario actual). Son conversiones fijas de simulación, no tipos de cambio financieros vigentes.

La aplicación es autocontenida: no consulta Transfermarkt, Google Drive ni servidores de datos durante una partida. Los estilos e iconos necesarios están incorporados, con emblemas ilustrados propios.

## Base auditable y reconstrucción

- [data/world-database.json](data/world-database.json): núcleo original deduplicado de 310 clubes y 9.220 jugadores.
- [data/world/pyramids.json](data/world/pyramids.json): suplemento auditado de ascenso, procedencia y cobertura por club. El builder valida y combina ambos catálogos antes de incorporar el guardado.
- [data/world/match-benchmarks.json](data/world/match-benchmarks.json): muestras estadísticas, registros originales o tablas, fechas, hashes y fuentes del motor.
- [data/world/](data/world/): instantáneas regionales revisadas, reservas verificadas, IDs compatibles y participantes continentales.
- [src/](src/): módulos de mundo, competiciones, IA, contratos, fichas, tácticas, bandeja y persistencia, incorporados en el HTML.
- [data/transfermarkt-2025.json](data/transfermarkt-2025.json): referencia anterior de 400 jugadores, conservada para las carreras previas.

Reconstrucción local de las instantáneas revisadas, sin red:

```bash
python3 tools/build_world.py
```

Reincorporar la base antigua: `python3 tools/embed_database.py`. Ambos comandos conservan el único HTML necesario para jugar.

Los importadores regionales `tools/build_argentina.py`, `tools/build_south_america.py` y `tools/build_europe.py` permiten refrescar datos públicos con caché y verificación de temporadas. Requieren Python y `lxml`; usan tres trabajadores y HTTPS verificado. Argentina y Europa pueden complementar las páginas con `--archive /ruta/archive.zip`. Una actualización requiere revisar la coherencia de temporada y la selección antes de reconstruir.

El ZIP aportado durante el desarrollo contiene 12 CSV de Transfermarkt: 50.149 perfiles, 796 clubes, 65 competiciones y 656.301 tasaciones. Sus CSV principales coinciden con el dataset público de [David Cariboo](https://github.com/dcaribou/transfermarkt-datasets). Las tasaciones llegan al 12/06/2026 y los partidos al 06/07/2026; el timestamp de empaquetado 05/09/2026 no acredita datos hasta ese día. No se reasignan equipos a partir de perfiles retirados, campos históricos `current_club_id` o transferencias futuras. El archivo no incluye atributos FM.

La guía de [worldfootballR](https://jaseziv.github.io/worldfootballR/articles/extract-transfermarkt-data.html) sirvió de referencia del método. Ese proyecto fue archivado en septiembre de 2025; el juego no depende de R ni de consultas durante la partida.

Los grupos iniciales se contrastaron con [Libertadores](https://www.transfermarkt.com.ar/copa-libertadores/gesamtspielplan/pokalwettbewerb/CLI/saison_id/2025) y [Sudamericana](https://www.transfermarkt.com.ar/copa-sudamericana/gesamtspielplan/pokalwettbewerb/CS/saison_id/2025). Sus fuentes y participantes están en [continental-2026.json](data/world/continental-2026.json).

## Validación de desarrollo

Instalá Playwright y su Chromium, y serví el repositorio:

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
python3 -m http.server 8000
```

En otra terminal:

```bash
python3 tests/test_career_library.py
python3 tests/test_real_calendars.py
python3 tests/test_football_pyramids.py
python3 tests/test_pyramid_integration.py
python3 tests/test_realism_workspace.py
python3 tests/test_real_contracts.py
python3 tests/test_club_market_snapshot.py
python3 tests/test_sports_medicine.py
python3 tests/test_medical_profile_integration.py
python3 tests/test_club_finances.py
python3 tests/test_scouting_uncertainty.py
python3 tests/test_match_calibration.py
python3 tests/test_compressed_storage.py
python3 tests/test_match_persistence.py
python3 tests/test_match_simulation.py
python3 tests/test_match_centre_depth.py
python3 tests/test_tactical_plans.py
python3 tests/test_development_centre.py
python3 tests/test_dressing_room_depth.py
python3 tests/test_football_world.py
python3 tests/test_career_integrity.py
python3 tests/test_management_office.py
python3 tests/test_match_formats.py
python3 tests/test_football_depth.py
python3 tests/test_workspace_update.py
python3 tests/test_offer_form.py
python3 tests/test_daily_clock.py
python3 tests/test_management.py
python3 tests/test_world_game.py
python3 tests/test_world_storage.py
python3 tests/test_game.py
```

`FM27_TEST_URL` permite seleccionar otro servidor y `FM27_CHROMIUM` otro ejecutable. Las pruebas de compatibilidad recuperan los HTML originales del historial Git; requieren la copia Git, no sólo el ZIP de distribución. Los escenarios comprueban los cuatro turnos diarios, partidos a su hora, recuperación y salarios sin duplicación, respuestas entre partidos y migración del reloj; también carreras y planteles, partidos, copas, temporadas, ascensos, navegación, exportación/importación y guardados anteriores, decisiones de la bandeja, instrucciones, planes, fichas, IA, cuotas, préstamos, reventa y reservas de fondos. El codec se prueba también con 10.000 jugadores, cambios económicos, partidos pausados y falta de espacio sin perder el guardado anterior.

La batería de paneles verifica escritorio y celular, controles visibles, ofertas en dos etapas, préstamos, primas sin duplicación, vestuario y temporadas completas con los nuevos formatos. Las regresiones del calendario anterior eligen explícitamente el modo clásico.

La batería de formatos comprueba que la base permanezca intacta, los 22 marcadores y controles sean accesibles en cuatro tamaños de pantalla, los cambios compartan ventana y las estadísticas correspondan al motor. Simula temporadas completas, verifica todos los campeones y fases, prueba minitablas, prórroga y activación desde una partida anterior.

El reloj respeta partidos locales de tarde y continentales de noche aun cuando un calendario anterior los almacenó en otro orden; terminar un partido no salta ni omite el encuentro nocturno pendiente.

Las búsquedas, filtros, lecturas de la bandeja, ajustes tácticos y paradas del avance agrupan sus autoguardados y procesan la validación, compactación y compresión en un Web Worker local. La interfaz sigue respondiendo durante ese trabajo. Las revisiones impiden que una tarea atrasada reemplace un guardado manual, una importación o una carrera nueva. Al salir se completa el guardado pendiente; el botón Guardar y las firmas económicas conservan el guardado inmediato. Si el navegador bloquea workers, se utiliza el guardado convencional. El formato de las partidas anteriores se mantiene.

Los guardados grandes usan compresión UTF-16 mediante lz-string 1.5.0 (MIT), incorporado localmente con límite de descompresión para importaciones. La licencia y la procedencia están en `src/vendor/`. Las copias JSON anteriores siguen admitidas; la exportación conserva el estado completo para trasladarlo.
