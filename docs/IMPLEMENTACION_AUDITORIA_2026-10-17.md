# Implementación de la auditoría de FM27

Seguimiento de los 44 puntos de [la auditoría original](AUDITORIA_PROFUNDA_2026-10-17.md), sobre los cambios posteriores a `8c9252f`. El informe original conserva los defectos de aquella versión; este documento describe los mecanismos incorporados y las adaptaciones de la simulación.

La columna de evidencia identifica código revisado, no sustituye el resultado de las pruebas. La integración y las pruebas de la actualización se registran al terminar la revisión. «Implementado» significa que existe una ruta de juego conectada, no que se reproduzca todo el reglamento oficial ni que sus estimaciones sean datos publicados.

| Nº | Cambio y mecanismo | Código principal |
| --- | --- | --- |
| 1 | Las secuencias reciben los factores efectivos de construcción, ataque y defensa: cambian la precisión de pases, la oposición y la calidad de ocasiones. Incluyen roles, liderazgo y arengas calculados por el motor. | `match-simulation.js`: `context`, `step`, `shot` |
| 2 | Dependencias entre fases y rondas; un evento espera los resultados previos. Reprogramar desplaza las fases dependientes y evita completar una eliminatoria vacía antes de definir sus participantes. | `season-calendar.js`: `dependencies`, `eventReady`, `reconcileDependencies`; `world-engine.js`: `completeOne` |
| 3 | La rescisión comprueba las incorporaciones futuras firmadas y bloquea destruir unilateralmente el acuerdo pendiente. | `market-contracts.js`: `terminationQuote`, `terminateContract` |
| 4 | Finales LIB/SUD con condición neutral explícita en evento y partido. La simulación elimina la ventaja local y el usuario no cobra una recaudación local ordinaria. Las nuevas finales UEFA también son neutrales. | `world-engine.js`: `makeContinentalCalendar`, `buildStage`, `startMatch`, `userImpact`; `continental-competitions.js` |
| 5 | El orden de una tabla histórica recibe el identificador de liga y conserva sus criterios de desempate al determinar el puesto del DT. | `world-engine.js`: `sortedRows`; `season-calendar.js`: `finishUserSeason` |
| 6 | Entrenamiento consulta el descanso médico vigente; Medicina aplica recuperación y carga cero durante la prescripción. Al vencer se retira la indicación. | `sports-medicine.js`: `resting`, `trainingLoad`, `recoverPlayer`; `development-centre.js` |
| 7 | La ficha y las recomendaciones usan las posiciones de origen y aprendidas compartidas con Tácticas. | `player-profile.js`: `naturalPositions`, recomendaciones; `development-centre.js` |
| 8 | Una carga táctica común combina estilo, presión, fases e instrucciones; Medicina la consume por minuto y en partidos rápidos. | `tactics-workbench.js`: `matchLoad`; `sports-medicine.js`: `intensity`, `afterQuickMatch` |
| 9 | Los encuentros rápidos generan amarillas, dobles amarillas, rojas y acumulaciones por competición; las nuevas sanciones se cumplen en partidos posteriores. | `world-engine.js`: `simulatedStats`, disciplina |
| 10 | La IA construye el once con las casillas de la formación efectiva de su entrenador, encaje por puesto, condición y cupo extranjero. | `world-engine.js`: `aiXI`; `club-ai.js`: `tacticsFor` |
| 11 | Los partidos rápidos actualizan últimas notas, `lastRating`, forma, minutos, goles y asistencias. Los filtros y las fichas disponen de historial real de la carrera. | `world-engine.js`: `simulatedStats` |
| 12 | El ejecutante se elige una sola vez; resultado, ocasión, relato y secuencia comparten su identidad. | `match-simulation.js`: `shot`, `shotContext`, `recordChance`; núcleo de partido de `index.html` |
| 13 | Menos de siete participantes activos causa la suspensión y una resolución administrativa. El marcador disputado se conserva y el resultado reglamentario no inventa goleadores. | Núcleo de partido de `index.html`; `match-simulation.js` |
| 14 | Se separa la necesidad de prórroga de la de penales: el playoff español puede jugar prórroga y aplicar después la ventaja deportiva. | `domestic-regulations.js`: `extraRequired`; `football-pyramid.js` |
| 15 | La resistencia en una venta compara al comprador con el propietario vendedor; la rivalidad incrementa su dificultad. | `market-contracts.js`: `clubNegotiation` |
| 16 | El ejercicio financiero acumula desde la apertura hasta el cierre, incluyendo ambos años de una temporada europea. Las migraciones indican si usan agregados antiguos. | `club-finances.js`: `account`, `onSeason` |
| 17 | Se devengan todos los vencimientos del crédito antes de intentar cobrarlos. Las cuotas impagas se acumulan y se pagan por antigüedad, con política de interés visible. | `club-finances.js`: `settleLoans`, `arrears` |
| 18 | La deuda operativa heredada conserva capital, devenga interés y amortiza excedentes durante el control del usuario. Los cambios de club transfieren la responsabilidad sin borrar la obligación. | `club-finances.js`: `beforeClubChange`, `afterClubChange`, `settleInheritedDebt`; `football-depth.js`: `switchClub` |
| 19 | Alertas por episodios: recuperarse cierra el anterior; recaer crea un mensaje nuevo. El aviso activo actualiza su condición y puede detener el avance por una nueva novedad. | `action-inbox.js`: `refreshAlerts`; `management-office.js` |
| 20 | Una promesa de minutos cuenta encuentros futuros donde el futbolista está realmente habilitado, incluida una lista continental independiente. | `dressing-room.js`: promesas; `world-engine.js`: `canPlay` |
| 21 | El ojeo lee `minutesPlayed` y sólo registra observaciones con participación positiva. | `scouting-network.js`: `observeMatch` |
| 22 | El filtro distingue la ausencia del pie preferido de la etiqueta «Sin dato publicado». | `market-filters.js`: filtro de pie |
| 23 | El orden deportivo usa la calidad conocida por el ojeo; las columnas y la dirección de orden elegidas se aplican a la tabla. El potencial verdadero no se utiliza para jerarquizar jugadores desconocidos. | `market-filters.js`: `snapshot`, `compare`; `world-ui.js`: mercado |
| 24 | La importación comprueba definiciones de sucesos, fechas, decisiones y seguimientos opcionales antes de reemplazar la carrera. La interfaz tolera definiciones desconocidas cancelándolas. | `world-storage.js`: `validateIncidents`; `unexpected-events.js`: `ensureMessages` |
| 25 | Aceptar una venta o préstamo abre una fase de consentimiento personal. El comprador y el representante revisan salario y proyecto antes de firmar; mientras tanto no se cambia de club ni se cobra el pase. | `market-contracts.js`: `beginSaleConsent`, `processSaleConsent`; bandeja y negociación |
| 26 | Se guardan 36 atributos específicos independientes; entrenamiento puede mejorar uno sin reconstruir todos desde seis medias. Pases, decisiones, remate, penales, arqueros y resistencia se consumen en la simulación. La migración conserva una base derivada de estimaciones previas. | `player-lifecycle.js`: `FM_ATTRIBUTES`; `player-profile.js`; motor y Medicina |
| 27 | Revisión mensual del valor por edad, evolución, notas, lesión y contrato; cambio mensual limitado y 18 registros de historial. La tasación histórica de Transfermarkt permanece separada. | `player-lifecycle.js`: `valuation`, `updateValuations` |
| 28 | Los partidos rápidos notifican minutos efectivos al ojeo. Sólo se crea una observación del objetivo con encargo activo o del propio plantel, identificada por partido. | `world-engine.js`: `simulatedStats`; `player-lifecycle.js`: `observeQuickMatch`; `scouting-network.js` |
| 29 | La IA detecta necesidades de puestos exactos y limita operaciones por liga y club, en lugar de un único cupo global para todo el mundo. | `club-ai.js`: necesidades, evaluación y `simulateMarket` |
| 30 | Retiros con anuncio previo, salida del conjunto activo, conservación de ficha y trayectoria, y cancelación de gestiones sin firma. Los préstamos y acuerdos firmados pendientes impiden retirar prematuramente al jugador. | `player-lifecycle.js`: `retirementReview`, `retire`, `archive`; `world-engine.js`: búsqueda de jugadores |
| 31 | Champions, Europa y Conference con 36 equipos, ocho/ocho/seis rivales distintos, tabla única, ocho clasificados directos y playoff del 9º al 24º. Eliminatorias, prórroga, premios, coeficiente de carrera y final neutral. | `continental-competitions.js`; `uefa-guest-clubs.js`; calendario y Tabla/Copas |
| 32 | Copas nacionales con cuadro progresivo y rondas según los clubes incluidos. Desde los ciclos posteriores al inicial: Libertadores con tres previas y cuatro clasificados; Sudamericana con cruces nacionales y llegada de cuatro eliminados de Libertadores. | `continental-competitions.js`: copas nacionales, `prepareContinental`, `advancePreliminary`; motor y calendario |
| 33 | El campeón LIB y el campeón SUD tienen acceso por título a la siguiente Libertadores. Se consideran ganadores de copas domésticas donde el perfil de clasificación los incluye. | `world-engine.js`: `qualifiedTeams`; `continental-competitions.js`: `prepareContinental`, `domesticWinner` |
| 34 | Con el partido pausado se cambia formación, se reubican jugadores, se aplican planes y se designa arquero de emergencia. Banco, sustituciones, ventanas y cambio adicional en prórroga dependen del perfil de competición; las tandas tienen orden individual. | `tactics-workbench.js`: `FM_MATCH_RULES`, cambios en vivo; `match-centre.js`; núcleo de partido |
| 35 | Renegociación de plazo, cargo y reparto salarial de la cesión, contraofertas y contrato de compra futura. El propietario puede renovar al cedido conservando el reparto. La gracia vence a los 14 días: con contrato personal firmado se conserva el importe exigible como deuda y cuenta a cobrar; sin ese acuerdo o sin inscripción posible, vuelve al propietario y queda una reclamación explícita. El cierre por indemnización es un acuerdo simulado del 20 %, requiere confirmación y fondos reales. | `market-contracts.js`: `proposeLoanAmendment`, `processLoanAmendments`, `purchaseLoan`, `returnLoans`; `renewal-negotiations.js` |
| 36 | Reconocimiento después del acuerdo personal y antes de ejecutar el pase. Se muestra lesión, baja y riesgo; el DT confirma o cancela sin pagar el pase. Si cambia la lesión, exige revisar el dictamen actualizado. | `market-contracts.js`: `requestMedical`, `processMedical`, `respondMedical`; negociación y bandeja |
| 37 | Contratación y renovación de empleados con salario, duración, prima, vencimiento y contraoferta. Delegación con límites de precio, edad, puesto, nacionalidad, conocimiento, salario y gasto; firmar requiere autorización explícita dentro del juego. | `club-governance.js`: contratos y delegación; `development-centre.js`; `management-office.js` |
| 38 | Vacantes durante la temporada, candidatura, entrevista, contraoferta, salario y fecha futura de incorporación. Compensación entre clubes y salario del DT registrado; los clubes continentales invitados no se ofrecen como empleo. | `club-governance.js`: carrera y `careerDay`; `football-depth.js`: cambio de club |
| 39 | Reserva y Sub-19 con calendario, resultados, tabla y estadísticas separadas. Se puede habilitar a profesionales, observar minutos y promover juveniles pagando la prima; los encuentros generan desarrollo, carga y posibles lesiones. | `player-lifecycle.js`: competiciones y `reserveGame`; Desarrollo |
| 40 | Archivo por ID de partido con hasta 120 informes completos: notas, minutos, estadísticas, relato, ocasiones, planes y ajustes. Mensajes y fichas enlazan el encuentro original; informes antiguos incompletos se identifican. | `match-archive.js`; `action-inbox.js`; `viewport-workspace.js`; `world-engine.js`: `recordLiveMatch` |
| 41 | Hasta 20 búsquedas nombradas por club/sección, varios puestos, grupos Y/O, orden configurable y columnas elegidas. Se conservan query y filtros por carrera. | `market-filters.js`; `market-filters.css`; mercado y ojeo |
| 42 | Las 25 situaciones tienen elegibilidad contextual, afectado identificado, antecedentes y seguimiento fechado. Un cumpleaños requiere proximidad a su fecha; los homenajes necesitan títulos de la carrera. Se cancela el seguimiento individual si deja el club. | `unexpected-events.js`: `contextFor`, `processFollowups`; bandeja y validación |
| 43 | Al crear carrera se elige pretemporada con planteles de referencia adaptados, o fecha de consulta de la base. La segunda opción simula resultados previos y permite asumir con la competición en marcha. La edad inicial usa esa fecha; la simulación previa conserva los resultados deportivos sin imputar premios, honorarios ni títulos al nuevo DT. | `world-ui.js`: inicio; `world-engine.js`: `createWorldCareer`, simulación de fondo; `season-calendar.js`: `warmStart` |
| 44 | Reasignación entre autorización de pases y margen salarial; coste anual de 52 semanas y cargas, confianza de directiva, reservas y proyección a 90 días. La reasignación no consume caja ni constituye un ingreso. | `club-finances.js`: `reallocate`, `projection`, interfaz de presupuesto |

## Adaptaciones de formato y procedencia

- Las identidades principales y tasaciones de referencia siguen siendo históricas. Los atributos, potencial, salarios, presupuestos, resultados y evolución se estiman para esta carrera; no se presentan como atributos oficiales de Football Manager ni contratos verificados de Transfermarkt.
- Los invitados continentales europeos tienen identidad respaldada por el directorio oficial de UEFA. Sus planteles sin cobertura incorporada son reservas ficticias expresamente identificadas. No se inventa una liga doméstica jugable para ellos ni se ofrecen como destinos del DT.
- La fase liga UEFA y su recorrido eliminatorio son jugables. Acceso de las cinco grandes ligas, relleno de invitados, coeficientes iniciales, distribución de adversarios y fechas se adaptan al universo incluido; no se reproduce íntegramente la lista federativa, sus cuatro bombos ni las rondas previas UEFA.
- Las copas nacionales usan las divisiones presentes en el catálogo. No incluyen clubes de categorías ausentes ni reproducen todos los accesos, exenciones, grupos regionales y excepciones federativas. La copa de Perú es una variante de carrera identificada como copa nacional adaptada. Sus fechas y sorteos son generados.
- Los grupos continentales de referencia de 2026 se conservan. Las preliminares se aplican a los ciclos siguientes, cuyas plazas y sorteos dependen de resultados de la carrera.
- Reserva y Sub-19 son competiciones propias de la simulación, con estadísticas separadas. No se atribuyen sus participantes, calendario ni reglamento a una federación.
- Las reclamaciones heredadas por cesiones sin contrato personal firmado admiten un cierre simulado por el 20 % del importe. Es una mecánica de acuerdo entre clubes, no una predicción de indemnización judicial.
- Los perfiles de inscripción, bancos, cambios, ventanas de transferencias y la resolución administrativa de una suspensión son reglas explícitas de la partida. No constituyen una actualización en vivo de reglamentos federativos.
- El archivo tiene límite de 120 informes completos. Los resultados de calendario y las estadísticas de temporada pueden durar más que el detalle de una actuación antigua; no se reconstruyen datos que versiones previas nunca guardaron.

## Verificación y continuidad

Cierre de integración: 18 de octubre de 2026. Se aprobaron 121 métodos distintos, sin sumar las repeticiones realizadas después de una corrección.

| Grupo | Casos | Resultado |
| --- | ---: | --- |
| Dependencias de calendario, copas y almacenamiento en Node | 28 | Aprobados |
| Consentimiento, médicos y renegociación de préstamos | 13 | Aprobados |
| Gestión, atributos, economía, retiros e inferiores | 12 | Aprobados |
| Cambio de club y conservación de acuerdos/archivos | 12 | Aprobados |
| Búsquedas, situaciones e informes con controles reales | 3 | Aprobados |
| Integración mundial, fecha de la base, forma y previas | 4 | Aprobados |
| Renovación continental y simulación de varias temporadas | 2 | Aprobados |
| Reglas de partido, disciplina, búsqueda/velocidad y guardado | 20 | Aprobados |
| Mercado y reconciliación financiera de clubes IA | 1 | Aprobado |
| Contratos anteriores y continuidad de préstamos/inscripción | 26 | Aprobados |

Las verificaciones cubren una carrera sudamericana, la temporada europea que cruza de año, la resolución de previas hacia dos cuadros de 32, clasificación de campeones, exportación/importación y movimientos entre categorías durante varias temporadas. El guardado con 120 informes completos pasa el ensayo de cuota; los imports inválidos conservan la partida anterior. Chromium ejecuta las pruebas de interfaz sin recursos externos HTTPS.

Durante la integración se corrigieron además la nómina retroactiva al volver a un club, la recuperación y edad de juveniles fuera del plantel profesional, la reposición de Sub-19, la cobertura de invitados UEFA en futuras ediciones y un acuerdo diferido que conservaba incorrectamente el estado de reconocimiento médico pendiente.

Las reglas oficiales completas y las identidades ausentes no se deducen de los resultados de estas pruebas. Las adaptaciones de acceso UEFA, copas domésticas, reserva, inscripción y reclamaciones se describen arriba y en la interfaz.
