# FM27 · Pasión continental

Simulador de dirección técnica con **310 clubes, 16 ligas y 9.220 jugadores reales**, Libertadores y Sudamericana jugables. La aplicación completa está en **index.html**: no hay que instalar paquetes ni compilar para jugar.

## Jugar

1. [Descargá el juego](https://github.com/LautaBil89/FM27/archive/refs/heads/main.zip), extraé el ZIP y abrí **index.html** con Chrome, Edge o Firefox.
2. En **Nueva carrera**, elegí país, liga, club, nombre del DT. La directiva fija el objetivo de cada club; en **Tu DT** elegís estilo y distribuís 60 puntos de atributos. Podés buscar un equipo directamente por nombre.
3. Usá **Continuar** para avanzar automáticamente por mañana, mediodía, tarde y noche hasta una novedad o tu próximo partido. **Parar** detiene el avance. Revisá informes, negociá fichajes y prepará el equipo entre partidos.
4. Cuando llegue el horario de inicio, entrá al Centro de partido. Pausá para ajustar el planteo y realizar sustituciones.

Las partidas anteriores conservan sus equipos, calendarios, jugadores y condiciones. La nueva interfaz y la gestión se incorporan sin reiniciar. Los formatos deportivos por país se eligen al crear carrera; en una carrera anterior podés activarlos para la próxima temporada desde Competiciones, conservando la temporada actual. Exportá tu carrera antes de empezar otra. El guardado pertenece al navegador y a esa ubicación del archivo; Exportar e Importar permiten trasladarlo a otro dispositivo.

También se puede servir en desarrollo con `python3 -m http.server 8000 --directory .`.

## Avance diario

Las carreras ampliadas tienen **cuatro turnos por día**: Mañana (08:00), Mediodía (12:00), Tarde (18:00) y Noche (21:00). **Continuar** procesa los turnos hasta recibir una novedad en la bandeja (incluidos informes, ofertas y altas médicas) o llegar al próximo partido. El botón cambia a **Parar** durante la simulación; también se pausa al abrir otra gestión o salir de la ventana. Desde Noche pasa a la mañana del día siguiente. La API interna `WORLD_CLOCK.advance()` sigue avanzando exactamente un turno. La fecha, hora y progreso diario aparecen en el encabezado, y el dashboard muestra la agenda y la actividad reciente del club.

Las carreras nuevas comienzan con una semana de preparación. El entrenamiento y la familiaridad táctica se trabajan una vez al día, al mediodía. La condición, las lesiones, las edades, los vencimientos y la actividad de los clubes se actualizan al pasar al siguiente día. Los salarios y patrocinios siguen siendo semanales, y los pagos de cuotas conservan sus fechas: cuatro turnos no multiplican esas operaciones. Las ofertas y las contraofertas aceptadas reciben respuesta a partir del día siguiente, aunque no haya partido.

Los partidos locales se juegan en el turno Tarde y los continentales en Noche. Las otras competiciones se simulan cuando llega su fecha y turno, incluso si tu equipo todavía no juega. Podés consultar el próximo rival y preparar la táctica antes, pero no iniciar el encuentro anticipadamente. Al llegar a tu partido, Continuar abre la previa y espera tu intervención. Después del informe permanecés en esa misma fecha y turno; el juego no salta al siguiente encuentro. Si tu club termina su calendario antes que otras competiciones, el mundo sigue avanzando hasta el cierre de temporada.

Esta mejora se aplica también a las partidas ampliadas existentes: al importar o cargar una carrera sin reloj, conserva la fecha, los resultados, los jugadores y la economía. Si ya estabas en un día de partido, comienza en el turno del encuentro. El turno actual se guarda y se conserva al exportar e importar. Las carreras antiguas de 12 clubes mantienen su funcionamiento anterior.

## DT, empleados y decisiones del club

Cada club recibe objetivos de directiva según su nivel relativo en la liga: título, clasificación continental, ascenso, mitad superior o permanencia. Se muestran antes de empezar y se revisan al cambiar de temporada o club. No son datos oficiales de sus directivas: son expectativas de esta simulación.

El DT tiene estilo preferido y seis atributos de 1 a 20, con un máximo de 60 puntos. Táctica acelera la adaptación al estilo; entrenamiento mejora el desarrollo juvenil; motivación y disciplina afectan la moral; negociación modifica las expectativas salariales; evaluación influye en los plazos de ojeo. Al comenzar quedan fijados. Las partidas anteriores pueden definirlos una vez desde **DT y empleados**, sin reiniciar.

**DT y empleados** muestra ayudante, cinco ojeadores, atributos, conocimiento regional, encargos activos y salarios semanales. El personal es generado para la carrera. Cada ojeador ocupa una observación y sus características, región y el perfil del DT modifican su duración; los avances llegan a la bandeja. El coste de cada informe sigue siendo USD 1.500. Podés delegar el entrenamiento diario, un encargo de ojeo semanal con puesto/nacionalidad/edad/valor máximo y la revisión mensual de vencimientos. Los empleados preparan informes; el DT conserva la firma de contratos y transferencias.

Desde la ficha del jugador o **Lista de préstamos**, ofrecé un futbolista para cesión. Los clubes pueden presentar ofertas de compra por jugadores no listados y propuestas de préstamo por los ofrecidos, con cargo, duración, salario y regreso registrados. Los contactos pueden llegar en distintos turnos y fuera de la ventana de pases; los fichajes iniciados por el DT conservan las reglas de mercado existentes. Esta versión conserva la simplificación de ejecutar las ofertas entrantes aceptadas en la fecha de decisión.

Mercado y ojeo filtran por puesto exacto (DFC, LI, LD, MCD, MC, MP, EI, ED, DC o POR) y por nacionalidad, incluyendo dobles nacionalidades, además de sus filtros anteriores. La bandeja muestra remitente, estado actual, vencimiento cuando está registrado, próximo paso y condiciones reales de la operación. Distingue acuerdo con el club, contrato con el jugador y contraoferta.

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

Son las primeras divisiones completas de los diez países de CONMEBOL, la segunda división argentina completa y las cinco grandes ligas europeas completas. Todos los clubes pueden dirigirse. Las tablas, partidos y estadísticas de las otras ligas se simulan en paralelo y pueden consultarse en Competiciones. El mercado permite filtrar por país, liga y club y muestra resultados paginados.

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

**El calendario civil sigue siendo anual y adaptado**: todavía no reproduce agosto–mayo en Europa, el fixture oficial ni todos los descansos internacionales. Fuera de Argentina no se incluyen divisiones inferiores: se registra el descenso deportivo y la posición de promoción, pero los clubes no se intercambian al año siguiente. Las copas nacionales no están cargadas; sus cupos continentales se cubren con la clasificación de liga. Los promedios usan únicamente puntos efectivamente jugados en la carrera. Estas limitaciones también aparecen en Reglamento: las fases deportivas nuevas no equivalen a una reproducción completa de cada reglamento federativo.

En **Competiciones → Ligas nacionales**, elegí la liga y alterná Fases y finales, Acumulada, Calendario, Promedios y Reglamento. Las etapas finales reciben únicamente equipos clasificados; los cruces opcionales quedan sin jugar cuando el reglamento resuelve el título automáticamente. Cada campeón se registra por su torneo y los objetivos consideran sus títulos, no únicamente la posición anual.

Las carreras anteriores conservan la temporada actual. **Activar formatos por país el próximo año** aplica las estructuras nuevas al comenzar la siguiente temporada. La actualización mantiene exactamente los 310 clubes y las 9.220 identidades de referencia.

## Libertadores y Sudamericana

La temporada inicial utiliza los **ocho grupos reales de 2026 y sus 32 participantes en cada copa**, contrastados con el calendario público de Transfermarkt. La carrera simula sus propios resultados, sin importar marcadores históricos.

- Cada grupo tiene cuatro clubes y seis jornadas de ida y vuelta. Se ordena por puntos, diferencia de gol y goles a favor.
- Libertadores: los dos primeros de cada grupo pasan a octavos; los terceros acceden al playoff de Sudamericana.
- Sudamericana: los ganadores de grupo pasan a octavos. Los segundos juegan un playoff contra los terceros de Libertadores.
- Playoff, octavos, cuartos y semifinales se juegan a ida y vuelta; la final es única. Empate en el global: penales, sin regla de gol visitante. Con los nuevos reglamentos, las finales continentales tienen 30 minutos de prórroga antes de los penales. Los grupos y partidos de ida permiten empates.
- Las fechas continentales alternan con el torneo local, de martes a jueves; las finales se juegan en fin de semana.
- En temporadas siguientes, los campeones y la clasificación deportiva de cada país ordenan las plazas. Se conserva la distribución nacional de los grupos iniciales, con sorteos simulados sin repetir países dentro de un grupo.

La edición comienza directamente en grupos: no incluye las fases preliminares. Las copas UEFA no están incluidas; las tablas europeas señalan zonas de referencia para objetivos deportivos.

## Fichas, tácticas y decisiones del club

Las carreras ampliadas incorporan una ficha de jugador completa, con pestañas Resumen, Atributos, Evolución, Estadísticas, Contrato y Fuentes. Podés comparar con cualquier futbolista del mundo, revisar posiciones naturales y aptitud de roles, y ver estrellas relativas a tu plantel. Los 36 atributos detallados son estimaciones derivadas de la simulación; las biografías y tasaciones siguen separadas en Fuentes. La evolución registra tus propios meses de carrera, sin inventar un historial previo. Abrir una ficha durante el partido lo pausa y permite volver al encuentro.

La cancha táctica permite intercambiar jugadores mediante arrastre, selección por toque o teclado. Muestra adaptación al puesto y alternativas, y permite guardar, cargar, renombrar o eliminar hasta cinco planes. Cada jugador tiene instrucciones de desmarques, pases, riesgo, entradas, marcaje y deber. La familiaridad mejora con la práctica. Las instrucciones y la aptitud afectan ataque, defensa, movimiento, desgaste y riesgo de tarjetas. La convocatoria elegida se conserva al avanzar mientras siga disponible; la selección automática se aplica cuando la pedís o hace falta reemplazar bajas. Durante el partido la convocatoria permanece bloqueada: las sustituciones se hacen desde el banco; los ajustes individuales sí están disponibles.

La bandeja tiene listado y panel de lectura, búsqueda y filtros de pendientes, no leídos y categoría. Sus acciones permiten aceptar o rechazar propuestas, resolver contraofertas, renovar, abrir fichas e informes, encargar ojeo y asignar recuperación. Las acciones revisan la situación actual y una oferta cerrada no vuelve a ejecutarse. La recuperación modifica el plan y no cura una lesión inmediatamente.

## IA de los clubes y contratos

Los clubes rivales administran caja, presupuesto salarial, necesidades de posición y preferencias de juego. Analizan oportunidades en las ventanas del simulador, compiten por jugadores, compran, piden préstamos y renuevan a futbolistas importantes. Buscan mantener cobertura y respetar el máximo de 32 jugadores, cupos y reservas para retornos de préstamos. Los jugadores de tu equipo permanecen bajo tu control: la IA envía una oferta y la venta requiere tu decisión.

La negociación tiene **dos etapas**: primero se acuerdan con el club el precio, las cuotas, el porcentaje de futura venta o las condiciones del préstamo. Cuando el club acepta, se habilita **Negociar contrato** en Ofertas para presentar salario, duración, rol, cláusula y primas al jugador. Cada etapa recibe respuesta desde el día siguiente y puede generar una contraoferta. La aceptación del club reserva fondos, pero no transfiere al jugador ni cobra el pase; la firma completa la operación una sola vez. Los agentes libres negocian directamente sus condiciones personales.

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

Las membresías y planteles se verificaron en páginas públicas de **Transfermarkt**: Sudamérica 2026, Europa 2025/26. Cada jugador tiene identidad numérica única, perfil, nacimiento, posición, nacionalidades y, cuando están publicados, pie, altura y valor de referencia. Hay **9.220 identidades iniciales únicas**, seleccionadas en planteles de 18–32 con al menos dos arqueros y cobertura de posiciones. Los jugadores de temporadas superpuestas o transferidos aparecen en un solo club.

Son selecciones de participantes de la temporada de referencia, **no listas de inscripción actualizadas en vivo**. En Águilas Doradas, Sebastián Guerra completa la segunda plaza de arquero como participante histórico de 2025, identificado por su fuente. Libertad incluye canteranos reales publicados en 2026. Los juveniles que aparecen en años futuros son generados por la simulación y se identifican expresamente.

Hay **3.670 tasaciones con fecha individual**, procedentes del archivo CSV complementario. Las cifras disponibles únicamente en las tablas de planteles conservan `valuationDate: null` y la ficha aclara que su fecha de consulta no es la fecha de valoración. Los valores sin cotización permanecen ausentes en la referencia, con un valor de juego estimado. No se convierten guiones en precios cero ni jugadores libres.

Las edades se calculan con el nacimiento completo y la fecha de carrera. Los atributos técnicos, mentales, potencial, personalidad, salarios, cláusulas, presupuestos y condiciones contractuales del juego son **estimaciones**, no atributos oficiales de Football Manager. Transfermarkt no contiene esos atributos de FM. La referencia se publica en EUR y el valor de carrera se expresa en USD usando EUR 1 = USD 1,10; USD 1 = ARS 1.200. Son conversiones fijas de simulación, no tipos de cambio financieros vigentes.

La aplicación es autocontenida: no consulta Transfermarkt, Google Drive ni servidores de datos durante una partida. Los estilos e iconos necesarios están incorporados, con emblemas ilustrados propios.

## Base auditable y reconstrucción

- [data/world-database.json](data/world-database.json): base final deduplicada, clubes, ligas, jugadores, fuentes y reglas de selección.
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
