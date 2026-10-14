# FM27 · Pasión continental

Simulador de dirección técnica con **310 clubes, 16 ligas y 9.220 jugadores reales**, Libertadores y Sudamericana jugables. La aplicación completa está en **index.html**: no hay que instalar paquetes ni compilar para jugar.

## Jugar

1. [Descargá el juego](https://github.com/LautaBil89/FM27/archive/refs/heads/main.zip), extraé el ZIP y abrí **index.html** con Chrome, Edge o Firefox.
2. En **Nueva carrera**, elegí país, liga, club, nombre del DT y objetivo. Podés buscar un equipo directamente por nombre.
3. Usá **Continuar** para avanzar un turno: mañana, mediodía, tarde y noche. Revisá informes, negociá fichajes y prepará el equipo entre partidos.
4. Cuando llegue el horario de inicio, entrá al Centro de partido. Pausá para ajustar el planteo y realizar sustituciones.

**La ampliación se aplica a carreras nuevas.** Las partidas anteriores conservan sus equipos, calendarios, jugadores y condiciones. Exportá tu carrera antes de empezar otra. El guardado pertenece al navegador y a esa ubicación del archivo; Exportar e Importar permiten trasladarlo a otro dispositivo.

También se puede servir en desarrollo con `python3 -m http.server 8000 --directory .`.

## Avance diario

Las carreras ampliadas tienen **cuatro turnos por día**: Mañana (08:00), Mediodía (12:00), Tarde (18:00) y Noche (21:00). Cada pulsación de Continuar avanza un turno; desde Noche pasa a la mañana del día siguiente. La fecha, hora y progreso diario aparecen en el encabezado, y el dashboard muestra la agenda y la actividad reciente del club.

Las carreras nuevas comienzan con una semana de preparación. El entrenamiento y la familiaridad táctica se trabajan una vez al día, al mediodía. La condición, las lesiones, las edades, los vencimientos y la actividad de los clubes se actualizan al pasar al siguiente día. Los salarios y patrocinios siguen siendo semanales, y los pagos de cuotas conservan sus fechas: cuatro turnos no multiplican esas operaciones. Las ofertas y las contraofertas aceptadas reciben respuesta a partir del día siguiente, aunque no haya partido.

Los partidos locales se juegan en el turno Tarde y los continentales en Noche. Las otras competiciones se simulan cuando llega su fecha y turno, incluso si tu equipo todavía no juega. Podés consultar el próximo rival y preparar la táctica antes, pero no iniciar el encuentro anticipadamente. Al llegar a tu partido, Continuar abre la previa y espera tu intervención. Después del informe permanecés en esa misma fecha y turno; el juego no salta al siguiente encuentro. Si tu club termina su calendario antes que otras competiciones, el mundo sigue avanzando hasta el cierre de temporada.

Esta mejora se aplica también a las partidas ampliadas existentes: al importar o cargar una carrera sin reloj, conserva la fecha, los resultados, los jugadores y la economía. Si ya estabas en un día de partido, comienza en el turno del encuentro. El turno actual se guarda y se conserva al exportar e importar. Las carreras antiguas de 12 clubes mantienen su funcionamiento anterior.

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

Las ligas se juegan con un **calendario anual adaptado**: una vuelta en las dos divisiones argentinas y dos vueltas en las demás ligas. No reproduce los torneos zonales, Apertura/Clausura ni el calendario europeo agosto–mayo. Los dos últimos de Primera argentina intercambian categoría con los dos primeros de Primera Nacional al comenzar el año siguiente. Las ligas restantes conservan sus participantes: no se han incluido sus divisiones inferiores. Los objetivos disponibles reflejan esas reglas.

## Libertadores y Sudamericana

La temporada inicial utiliza los **ocho grupos reales de 2026 y sus 32 participantes en cada copa**, contrastados con el calendario público de Transfermarkt. La carrera simula sus propios resultados, sin importar marcadores históricos.

- Cada grupo tiene cuatro clubes y seis jornadas de ida y vuelta. Se ordena por puntos, diferencia de gol y goles a favor.
- Libertadores: los dos primeros de cada grupo pasan a octavos; los terceros acceden al playoff de Sudamericana.
- Sudamericana: los ganadores de grupo pasan a octavos. Los segundos juegan un playoff contra los terceros de Libertadores.
- Playoff, octavos, cuartos y semifinales se juegan a ida y vuelta; la final es única. Empate en el global: penales, sin regla de gol visitante. Los grupos y partidos de ida permiten empates.
- Las fechas continentales alternan con el torneo local, de martes a jueves; las finales se juegan en fin de semana.
- En temporadas siguientes, la tabla anual de cada país decide las plazas. Se conserva la distribución nacional de los grupos iniciales, con sorteos simulados sin repetir países dentro de un grupo.

La edición comienza directamente en grupos: no incluye las fases preliminares. Las copas UEFA no están incluidas; las tablas europeas señalan zonas de referencia para objetivos deportivos.

## Fichas, tácticas y decisiones del club

Las carreras ampliadas incorporan una ficha de jugador completa, con pestañas Resumen, Atributos, Evolución, Estadísticas, Contrato y Fuentes. Podés comparar con cualquier futbolista del mundo, revisar posiciones naturales y aptitud de roles, y ver estrellas relativas a tu plantel. Los 36 atributos detallados son estimaciones derivadas de la simulación; las biografías y tasaciones siguen separadas en Fuentes. La evolución registra tus propios meses de carrera, sin inventar un historial previo. Abrir una ficha durante el partido lo pausa y permite volver al encuentro.

La cancha táctica permite intercambiar jugadores mediante arrastre, selección por toque o teclado. Muestra adaptación al puesto y alternativas, y permite guardar, cargar, renombrar o eliminar hasta cinco planes. Cada jugador tiene instrucciones de desmarques, pases, riesgo, entradas, marcaje y deber. La familiaridad mejora con la práctica. Las instrucciones y la aptitud afectan ataque, defensa, movimiento, desgaste y riesgo de tarjetas. La convocatoria elegida se conserva al avanzar mientras siga disponible; la selección automática se aplica cuando la pedís o hace falta reemplazar bajas. Durante el partido la convocatoria permanece bloqueada: las sustituciones se hacen desde el banco; los ajustes individuales sí están disponibles.

La bandeja tiene listado y panel de lectura, búsqueda y filtros de pendientes, no leídos y categoría. Sus acciones permiten aceptar o rechazar propuestas, resolver contraofertas, renovar, abrir fichas e informes, encargar ojeo y asignar recuperación. Las acciones revisan la situación actual y una oferta cerrada no vuelve a ejecutarse. La recuperación modifica el plan y no cura una lesión inmediatamente.

## IA de los clubes y contratos

Los clubes rivales administran caja, presupuesto salarial, necesidades de posición y preferencias de juego. Analizan oportunidades en las ventanas del simulador, compiten por jugadores, compran, piden préstamos y renuevan a futbolistas importantes. Buscan mantener cobertura y respetar el máximo de 32 jugadores, cupos y reservas para retornos de préstamos. Los jugadores de tu equipo permanecen bajo tu control: la IA envía una oferta y la venta requiere tu decisión.

El mercado ofrece compras o préstamos de seis/doce meses, reparto salarial, pagos al contado o en 3/6/12 cuotas mensuales, porcentajes de futura venta y cláusulas de rescisión. Las contraofertas necesitan aceptación y pueden retirarse antes del acuerdo. Los compromisos completos reservan presupuesto; las cuotas tienen vencimientos y se cobran o pagan efectivamente. La devolución de un préstamo restaura su club propietario y las condiciones que corresponden. El dueño y el prestatario pagan su parte del salario. Un jugador cedido no puede revenderse ni renovar su vínculo con el club prestatario.

El registro del mercado muestra las últimas operaciones y renovaciones de la IA, enlazadas a las fichas. Los historiales se limitan para mantener el guardado compacto. La IA y los contratos pertenecen a la simulación, no a un mercado real ni a fichajes posteriores verificados en Transfermarkt.

Las partidas ampliadas anteriores a esta actualización conservan jugadores, resultados, contratos y economía al importar o continuar; los módulos nuevos se inicializan sin reiniciar la carrera.

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
python3 tests/test_daily_clock.py
python3 tests/test_management.py
python3 tests/test_world_game.py
python3 tests/test_world_storage.py
python3 tests/test_game.py
```

`FM27_TEST_URL` permite seleccionar otro servidor y `FM27_CHROMIUM` otro ejecutable. Las pruebas de compatibilidad recuperan los HTML originales del historial Git; requieren la copia Git, no sólo el ZIP de distribución. Los escenarios comprueban los cuatro turnos diarios, partidos a su hora, recuperación y salarios sin duplicación, respuestas entre partidos y migración del reloj; también carreras y planteles, partidos, copas, temporadas, ascensos, navegación, exportación/importación y guardados anteriores, decisiones de la bandeja, instrucciones, planes, fichas, IA, cuotas, préstamos, reventa y reservas de fondos. El codec se prueba también con 10.000 jugadores, cambios económicos, partidos pausados y falta de espacio sin perder el guardado anterior.
