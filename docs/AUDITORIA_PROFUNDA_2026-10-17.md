# Auditoría profunda de FM27 — 17 de octubre de 2026

Versión revisada: `8c9252f76e6d21f68cc8d6332b66c1558e966efa`. El análisis no modifica la lógica del juego, sus datos, pruebas ni el HTML publicado. Este documento es el único archivo agregado por la auditoría.

La prioridad es conectar las decisiones del DT con el motor que realmente resuelve los partidos, preservar los acuerdos firmados y respetar las dependencias del calendario. El juego tiene bastante contenido implementado, pero existen conexiones incompletas entre sistemas que pueden volver ineficaz una decisión o producir información contradictoria.

## Alcance y evidencia

Se revisaron los 30 módulos JavaScript principales, su integración con el núcleo de `index.html`, la base incorporada y las pruebas relacionadas. Se usaron carreras nuevas aisladas en Chromium y reproducciones dirigidas de módulos originales en Node VM. Los estados controlados fuerzan casos concretos; no miden con qué frecuencia aparecen espontáneamente. No se ejecutaron los 343 métodos de prueba existentes ni una campaña mundial de muchas temporadas. Tampoco se cotejaron en fuentes federativas externas todos los reglamentos nacionales.

Catálogo incorporado: 565 clubes, 30 competiciones y 15.183 identidades reales. En la carrera de navegador observada había 15.630 jugadores contando reservas ficticias identificadas. El archivo autocontenido ocupa 12.474.027 bytes. Esas cifras describen tamaño y cobertura; por sí solas no prueban un problema de rendimiento.

Clasificación utilizada:

- **Reproducido:** comportamiento observado en navegador o ejecución de módulos originales con un estado controlado.
- **Confirmado por código:** recorrido inequívoco sin prueba completa en navegador; se identifica expresamente.
- **Robustez de importación:** requiere un archivo alterado/incompatible; no demuestra corrupción durante juego normal.
- **Ampliación pendiente:** capacidad ausente o simplificada, aunque el comportamiento actual esté documentado.
- **Pendiente de verificar:** indicio que no debe presentarse como error ya demostrado.

## Hallazgos funcionales y de robustez

### 1. Algunos modificadores tácticos no llegan al motor efectivo — alta

**Reproducido.** Los roles, la bonificación de liderazgo del capitán y los modificadores de ataque/construcción/defensa de las arengas alteran la fuerza calculada, pero el motor moderno de secuencias recibe esos factores y no los utiliza. Con la misma semilla, cambiar los roles, quitar el capitán o incluso inyectar una bonificación extrema produjo las mismas ocasiones, estadísticas y fatiga: 1–1 y 11–18 tiros. La fuerza teórica pasó de 63,969 a 64,534, 63,540 o 993,039 respectivamente.

Esto no afecta a todas las instrucciones: ritmo, formación, presión y varias fases sí intervienen; las arengas normales también pueden cambiar moral o faltas. La familiaridad de pelota parada sí produjo diferencias y no se incluye entre las decisiones ineficaces.

**Código:** `src/match-simulation.js:118`, `index.html:17705`, `17709`, `17747`, `17808`, `17981`. **Trabajo necesario:** unificar los factores tácticos que consumen las jugadas, remates y conversiones; comprobar consecuencias con pruebas deterministas, no sólo cambios en la fuerza mostrada.

### 2. Una reprogramación puede cerrar una liga sin campeón — alta

**Reproducido.** En CHI1 se movió la última fecha regular del 5 al 19 de diciembre. El desempate previsto para el 9 se procesó vacío y quedó finalizado. Al terminar la liga con igualdad por el título se agregó el desempate a ese evento ya cerrado. Resultado: un partido pendiente dentro de un evento `done`, liga `completed` y campeón `null`.

**Código:** `src/season-calendar.js:62`, `69`; `src/world-engine.js:386–408`; `src/domestic-regulations.js:72`. **Trabajo necesario:** representar dependencias entre fases, impedir que se cierre un evento sin participantes definitivos y reprogramar fases dependientes al mover una fecha previa. Las variantes argentinas no se ejecutaron; no se afirma que ya hayan fallado de la misma manera.

### 3. Una venta futura firmada puede destruirse mediante rescisión — alta

**Reproducido en navegador.** Boca acordó vender a Di Lollo a River por USD 500.000 el 10 de abril, con incorporación el 1 de julio. Mientras el acuerdo figuraba firmado, se permitió rescindir su contrato pagando USD 444.600. Al llegar julio, la inscripción simplemente fracasó porque el jugador había quedado libre.

No hubo ingreso duplicado: el problema es que una obligación firmada se cancela por una acción que no exige resolverla con el comprador.

**Código:** `src/market-contracts.js:453–454`, `535`; contrastar con la protección de renovaciones en `src/renewal-negotiations.js:23`. **Trabajo necesario:** bloquear la rescisión o abrir una cancelación contractual coherente con consentimiento y consecuencias.

### 4. Las finales continentales carecen de sede neutral — media/alta

**Reproducido.** Ni el evento ni el partido generado de la final LIB/SUD contienen `neutral:true`. En una final construida por el propio motor, Flamengo figuró local y cobró USD 1.334.376 de recaudación por 74.132 espectadores. El motor en vivo también permite la pequeña ventaja de pase local; no se midió estadísticamente su impacto en resultados.

**Código:** `src/world-engine.js:123`, `143–149`, `357`, `438`; `src/match-simulation.js:168`. **Trabajo necesario:** sede y condición neutral explícitas, reparto de entradas/premios y viajes coherentes.

### 5. La trayectoria puede registrar un puesto distinto del que corresponde por desempate — alta

**Reproducido.** Palmeiras quedó primero en Brasil por mayor cantidad de victorias, pero la copia de la tabla usada para cerrar la temporada lo colocó segundo por diferencia de gol. El historial del DT registró el segundo puesto. El ranking deportivo archivado y el campeón pueden permanecer correctos: no se afirma que todos los títulos se cambien.

La ordenación reconoce la liga por identidad del objeto `standings`; una copia histórica pierde esa relación y usa el desempate genérico. Afecta también los criterios distintos de puntos/DG/GF.

**Código:** `src/world-engine.js:92`; `src/season-calendar.js:65–70`. **Trabajo necesario:** ordenar siempre con identificador de liga, temporada y reglamento, y reutilizar el ranking ya archivado.

### 6. El descanso indicado en Medicina no suspende el entrenamiento — media/alta

**Reproducido.** Un jugador sano con descanso médico de dos días realizó entrenamiento físico alto: condición 100 → 98,9875, carga 47, progreso físico +0,079 y reporte de cero jugadores en recuperación. Medicina guarda el descanso en un lugar y Desarrollo consulta otro.

El riesgo de entrenamiento continúa activo pese a la prescripción. Además, una fecha de descanso vencida puede seguir mostrándose como si hubiera que quitarla.

**Código:** `src/sports-medicine.js:39`, `60`, `115`, `118`; `src/development-centre.js:109`, `118`. **Trabajo necesario:** una sola fuente de descanso vigente para entrenamiento, medicina y convocatoria.

### 7. Los puestos aprendidos se reconocen de manera desigual — media

**Reproducido.** Un MC reconvertido a ED aparece como MC/ED en la API usada por tácticas, pero la ficha y las recomendaciones siguen usando su posición original. El encaje de Extremo/ED permaneció en 41 antes y después de aprenderlo, y la cancha de la ficha no mostró ED.

**Código:** `src/development-centre.js:120`, `225`; `src/player-profile.js:73–86`, `154`, `228`. **Trabajo necesario:** una función compartida de posiciones y familiaridad, distinguiendo puesto de origen, aprendido y en formación.

### 8. Algunas exigencias tácticas no pagan su desgaste físico adicional — media

**Reproducido.** Bloque alto, contrapresión y determinadas instrucciones individuales calculan costos de resistencia, pero la ruta médica activa no los consume. Un plan pasivo y uno agresivo, con modificadores calculados muy distintos, terminaron 90 minutos con idéntica condición 86,05 y fatiga tisular 9.

La presión numérica colectiva y el estilo Gegenpress sí desgastan; faltan los costos adicionales de fases e instrucciones.

**Código:** `src/tactics-workbench.js:214–224`, `255`; `src/sports-medicine.js:64–65`; `index.html:18016`. **Trabajo necesario:** integrar todos los costos en una única liquidación física, evitando sumarlos dos veces.

### 9. Los partidos rápidos de la IA no generan tarjetas nuevas — media, confirmado por código

La ruta de simulación rápida actualiza goles, minutos, forma instantánea y medicina, pero no genera amarillas, rojas ni sanciones nuevas. Las sanciones que ya existen sí pueden cumplirse. Los equipos enfrentados en el partido interactivo están expuestos a disciplina; los demás no acumulan el mismo desgaste reglamentario.

**Código:** `src/world-engine.js:369–371`, `393–405`; `src/sports-medicine.js:103–105`. **Trabajo necesario:** una simulación disciplinaria rápida coherente con la competición, sin pretender que deba calcular cada jugada del mundo.

### 10. La IA selecciona jugadores para 4-3-3 aunque su DT use otra formación — media, confirmado por código

La elección de once rival usa siempre la estructura 4-3-3. Después se aplica el 4-4-2 o 4-2-3-1 del entrenador, que interpreta esos mismos once en otros puestos. Es más relevante tras cambios de DT, porque inicialmente predominan los 4-3-3.

**Código:** `src/world-engine.js:232–238`, `438`; `src/club-ai.js:58`, `275`; `src/match-simulation.js:31`, `43`. **Trabajo necesario:** seleccionar y distribuir el plantel según el plan real del técnico rival.

### 11. El filtro de nota media deja fuera a jugadores de partidos rápidos con rendimiento registrado — media

**Reproducido con el módulo original.** Un jugador disputó 90 minutos, sumó una aparición y obtuvo forma 7,69, pero conservó `form:[]` y `lastRating:null`. El filtro de nota media mínima cero lo rechazó porque sólo mira el historial `form[]`, que los partidos rápidos no actualizan. También quedan vacíos los gráficos y últimas notas de muchas fichas remotas.

**Código:** `src/world-engine.js:365`, `369–371`; `src/market-filters.js:99`; `src/player-profile.js:176`, `201`. **Trabajo necesario:** producir el mismo registro mínimo de rendimiento en partidos rápidos e interactivos.

### 12. Una repetición de penal puede mostrar al ejecutante equivocado — media

**Reproducido.** Si el ejecutante designado ya no está en cancha, la secuencia elige uno y el motor del resultado elige otro. En la prueba el remate de la repetición pertenecía al jugador 2, mientras el penal lo convirtió el 7.

Gol, tiro y valoración se asignaron correctamente al 7; el fallo está en la identidad de la acción/repetición, no en una corrupción demostrada de los goles de carrera.

**Código:** `src/match-simulation.js:92`, `112`, `186`; `src/match-centre.js:21`; `index.html:17812`. **Trabajo necesario:** elegir una sola vez al ejecutante y compartirlo con resultado, relato, estadísticas y repetición.

### 13. El partido continúa con menos de siete jugadores activos — regla faltante, media

**Reproducido.** Con cinco expulsados y seis jugadores restantes, el reloj pasó del minuto 25 al 26 y el encuentro siguió. También debe contemplarse la combinación de expulsiones y lesiones sin cambios disponibles.

**Código:** `src/match-simulation.js:8`; ruta `tick` de `index.html:17983` en adelante. **Trabajo necesario:** interrupción y resolución reglamentaria del abandono; no se observó un bloqueo del reloj.

### 14. El ascenso español omite la prórroga que describe su reglamento — media

**Reproducidas las condiciones de resolución.** En un playoff ES2 empatado, el módulo informa que corresponde prórroga, pero la ventaja deportiva hace que `needsPenalties` sea falso. Ese mismo retorno se usa para habilitar la prórroga: se avanza directamente al mejor clasificado.

**Código:** `src/football-pyramid.js:136–139`, `256`; `src/domestic-regulations.js:120–127`. **Trabajo necesario:** separar «necesita prórroga» de «necesita penales» y aplicar la ventaja deportiva en el momento correcto.

### 15. La rivalidad está mal comparada en ofertas entrantes — media

**Reproducido en navegador.** Una venta Boca → River tenía resistencia 0,57 tanto con Boca como rival de River como sin rivalidad. Al configurar artificialmente a River como rival de sí mismo, subió a 0,72. Se compara al comprador consigo mismo.

**Código:** `src/market-contracts.js:324`, `330–331`. **Trabajo necesario:** determinar el otro club de la negociación según su dirección. No afecta por igual la ruta de compra del usuario.

### 16. Los cierres financieros europeos agrupan mal los meses — media

**Reproducido.** Un gasto de enero de 2026 perteneciente a 2025/26 produjo 11.500 de gasto mensual, pero el cierre anual de esa temporada mostró gasto cero porque buscó únicamente meses de 2025.

La caja no desaparece: falla el informe y puede inducir decisiones equivocadas.

**Código:** `src/club-finances.js:117`; `src/season-calendar.js:27–30`, `83`. **Trabajo necesario:** definir el ejercicio y sumar su rango real de fechas.

### 17. Una cuota bancaria impaga frena el registro de vencimientos posteriores — media

**Reproducido.** Préstamo de 12.000 a doce meses; sin fondos en febrero, al llegar mayo sólo seguía registrada la cuota de febrero, capital 1.000 e interés 100. No aparecían los vencimientos de marzo, abril y mayo.

El capital no se borra; queda incompleta la mora y el devengamiento visible de intereses.

**Código:** `src/club-finances.js:93–98`, `52`. **Trabajo necesario:** separar el calendario de obligaciones de la aplicación de pagos y definir expresamente la política de mora.

### 18. La deuda operativa de un club IA se congela al asumir el usuario — media

**Reproducido en núcleo económico y confirmado en la transición de club.** Una deuda heredada de 120.000 siguió en ese importe de enero a mayo, sin intereses ni amortización. La IA excluye al club del usuario y la deuda heredada no se convierte en un préstamo con cronograma.

Los créditos bancarios explícitos del usuario tienen otra ruta y no están todos afectados.

**Código:** `src/football-depth.js:168`; `src/club-ai.js:258–263`; `src/club-finances.js:52`, `93–101`. **Trabajo necesario:** conservar el servicio de la misma obligación al cambiar de DT/control.

### 19. Una nueva fatiga puede reactivar un aviso viejo sin detener el avance — media

**Reproducido en navegador.** Fatiga al 60% generó mensaje 8. El jugador se recuperó y volvió a fatigarse al 55% en el mismo mes. Se reutilizó el mensaje 8, con el cuerpo todavía indicando 60%. El avance automático busca identificadores nuevos y no reconoce esa segunda novedad como tal.

Esto se refiere a avisos genéricos de fatiga; una nueva lesión puede generar otro parte independiente.

**Código:** `src/action-inbox.js:28`, `57–59`, `100`; `src/management-office.js:74`. **Trabajo necesario:** identificar episodios, actualizar contenido/lectura y emitir una revisión de notificación.

### 20. Una promesa de minutos ignora la habilitación continental independiente — media/baja

**Reproducido.** Un jugador fuera de la lista doméstica pero habilitado para dos encuentros de Copa no pudo recibir una promesa: se consulta el booleano doméstico `registered` en vez de los encuentros que realmente puede jugar.

**Código:** `src/dressing-room.js:83`; contrastar `src/world-engine.js:225–228`. **Trabajo necesario:** prometer sobre oportunidades válidas por competición y calendario.

### 21. El ojeo guarda minutos nulos tras partidos jugados — baja/media

**Reproducido.** Un futbolista con 90 minutos disputados quedó registrado en la observación con `minutes:null`. El ojeo lee `playerMinutes`, mientras el motor usa `minutesPlayed`.

La confianza actual cuenta muestras, no esos minutos; no se demostró una ecuación de confianza errónea causada por el nulo. Sí queda incompleta la evidencia guardada y un jugador de cero minutos podría contar como muestra.

**Código:** `src/scouting-network.js:106`; `src/world-engine.js:365`. **Trabajo necesario:** compartir el registro de minutos y excluir muestras sin participación.

### 22. «Sin dato publicado» del pie preferido excluye precisamente esos jugadores — media/baja

**Reproducido.** La ausencia de dato se convierte en el texto `Sin dato publicado`; el filtro interpreta cualquier texto no vacío como dato existente. Con ese texto el jugador no pasa; con `null`, sí. Hay 1.031 identidades del catálogo sin pie publicado.

**Código:** `src/world-engine.js:41`; `src/market-filters.js:89–90`. **Trabajo necesario:** separar valor ausente de etiqueta de presentación.

### 23. El orden del mercado revela la calidad real que el ojeo intenta ocultar — media

**Reproducido en navegador y confirmado por código.** Las filas se ordenan por `overall` real, aunque muestran estimaciones de ojeo. Ordenar la base por ese valor ofrece una jerarquía de capacidad oculta sin observar jugadores. No se muestran necesariamente sus números exactos: la filtración es el orden relativo.

**Código:** `src/world-ui.js:197`. **Trabajo necesario:** orden por estimación conocida o columna elegida, y búsquedas que respeten el mismo conocimiento que la ficha.

### 24. Importaciones con sucesos opcionales inválidos pasan la validación — robustez

**Reproducido con un JSON alterado.** Una carrera válida con un suceso pendiente cuya definición no existe pasó `WORLD_STORAGE.validate`. Al consultar las opciones, el juego lanzó un error al leer `choices` de una definición inexistente.

No se observó que el juego genere ese archivo durante uso normal ni una pérdida espontánea de guardado. El defecto es de validación/migración frente a archivos incompatibles o alterados.

**Código:** `src/world-storage.js:160–240`; `src/unexpected-events.js:33–38`. **Trabajo necesario:** validar o migrar módulos opcionales antes de sustituir la carrera activa; archivar eventos desconocidos de forma recuperable.

## Ampliaciones de profundidad y realismo

Estos puntos no se contabilizan como fallos de ejecución. Algunos son simplificaciones expresamente documentadas.

25. **Consentimiento personal en ventas y cesiones salientes.** Aceptar el DT debe abrir la respuesta del jugador. En una prueba Brey se vendió por 3.700 semanales pese a que la demanda calculada era 7.600. Las compras del usuario ya separan club y jugador; falta cerrar la otra dirección. Código: `club-ai.js:319–328`, `market-contracts.js:306–312`.
26. **Atributos independientes y perfiles deportivos diferenciados.** Las 36 características detalladas derivan de seis valores y una variación por ID. Transfermarkt aporta identidades y referencia de valor, no atributos oficiales de FM. Hace falta que visión, decisiones, serenidad, pie débil y capacidades específicas evolucionen de forma propia y tengan efectos medibles. Código: `player-profile.js:42–55`, `world-engine.js:46–62`.
27. **Revalorización del futbolista durante la carrera.** El valor base se fija al crearlo y no se recalcula periódicamente por evolución, edad, actuaciones o lesiones. El precio exigido sí tiene modificadores de rotación, juventud, proyecto y negociación; eso no reemplaza una valoración dinámica. Código: `world-engine.js:61`, `club-ai.js:100–106`.
28. **Ojeo vinculado a partidos reales del objetivo.** Actualmente avanza por días, y las observaciones de partidos se registran en el encuentro interactivo del usuario. Falta que observar un objetivo remoto incluya sus partidos rápidos, minutos, viajes y oportunidades efectivamente presenciadas. Código: `football-depth.js:89–98`, `world-engine.js:401`, `scouting-network.js:103–106`.
29. **Planificación de la IA por puesto exacto y rol.** El mercado rival evalúa POR/DEF/MED/DEL. Un equipo puede necesitar un lateral izquierdo y tratar a cualquier defensor como cobertura. El usuario ya busca puestos exactos; conviene que la IA también construya el plantel así. Además, el mercado autónomo limita a catorce operaciones globales por ejecución semanal: conviene calibrar actividad por liga y categoría sin volver a saturar al usuario de ofertas. Código: `club-ai.js:3`, `91–106`, `211–224`.
30. **Retiros y ciclo sostenible de jugadores.** El envejecimiento y la generación de juveniles NPC existen. Falta el retiro con aviso, archivo de trayectoria y salida del conjunto activo. Hoy los vencimientos dejan libres y se agregan reemplazos sin una retirada equivalente. Existe un límite de 40.000 jugadores, pero no se midió cuándo se alcanza; no se pronostica un bloqueo inminente. Código: `development-centre.js:67–88`, `world-engine.js:429`, `437`, `world-storage.js:169`.
31. **Champions, Europa y Conference jugables.** Hoy hay zonas de referencia en las tablas, sin esas competiciones. Faltan formatos, cupos, calendario, coeficientes y premios que hagan significativas las carreras europeas. Código: `world-engine.js:34`, `114–125`.
32. **Copas nacionales y fases preliminares continentales.** Copa Argentina, copas domésticas de otros países y rondas anteriores a grupos añaden cargas, ingresos y vías de clasificación hoy sustituidas por tabla de liga. Código: `domestic-regulations.js:133`, `world-engine.js:120`.
33. **Clasificación del campeón continental.** El campeón LIB/SUD no obtiene automáticamente el acceso por título: el selector sólo toma plazas domésticas. Un campeón fijado al final de la tabla quedó fuera de la próxima Libertadores. Es una regla incompleta, no pérdida de la copa ganada. Código: `world-engine.js:102–111`, `season-calendar.js:89`.
34. **Dirección de partidos más flexible.** Cambio de formación y reubicación de los mismos jugadores con el encuentro pausado, planes alternativos en vivo, arquero de emergencia y tandas con ejecutantes individuales. El motor de tandas hoy usa una referencia de tiro para todos los lanzamientos de cada equipo. Reglas de banco, cambios y prórroga deben depender de la competición. Código: `tactics-workbench.js:268–275`, `339`, `383`; `match-centre.js:47`; `index.html:18078–18093`.
35. **Renegociación completa de préstamos.** Ampliar duración o reparto con el propietario, renovar al jugador propio cedido y acordar expresamente el contrato de una compra futura. Las opciones/obligaciones y reservas ya funcionan; falta negociar el siguiente vínculo y resolver obligaciones impagas sin cesiones indefinidas. Código: `market-contracts.js:578`; restricciones en `renewal-negotiations.js`.
36. **Reconocimiento médico como decisión de fichaje.** Conectar diagnóstico, riesgo y condiciones acordadas con un examen que pueda motivar aplazamiento, precio distinto o cancelación. Las lesiones actuales no equivalen a esa fase de mercado.
37. **Contratos de empleados y autoridad delegada.** Ya se puede contratar/despedir personal desde Desarrollo y delegar tareas concretas. Faltan negociación y renovación de empleados, autoridad del director deportivo para ofertas/renovaciones dentro de límites y objetivos comprobables de su gestión. Código: `development-centre.js:154–182`, `management-office.js:62–70`.
38. **Carrera laboral del DT durante la temporada.** Vacantes reales, entrevistas, duración/sueldo, objetivos negociados y fecha de incorporación. Hoy las propuestas aparecen al cierre y la llegada se concreta desde la fecha actual. Código: `football-depth.js:137–149`, `190`.
39. **Competición de inferiores y reservas.** La academia tiene inversión, ingresos de juveniles, entrenamiento y promoción. Falta un calendario propio con minutos, convocatorias y rendimiento; el progreso no debería depender únicamente de pasar días. Código: `development-centre.js:128–139`, `194–208`.
40. **Archivo completo de partidos e informes útiles.** Se conserva el resultado en calendario, pero el informe detallado de `lastMatch` se sobrescribe. Mensajes antiguos no recuperan sus notas y estadísticas originales. Conviene un archivo acotado por ID de partido, enlazado con fichas y análisis de cambios. Código: `world-engine.js:364`, `action-inbox.js:165–166`.
41. **Búsquedas guardadas, orden y columnas configurables.** Nombres para filtros, selecciones de varios puestos, grupos Y/O, vigencia del informe, columnas y orden elegidos por el DT. El nuevo modal funciona y combina criterios; estas capacidades ampliarían su uso habitual. Código: `market-filters.js:112–157`, `world-ui.js:197`, `200`.
42. **Sucesos con contexto y consecuencias posteriores.** Las 25 situaciones existen con rarezas distintas, pero aplican efectos inmediatos al grupo y no comprueban cumpleaños reales, antecedentes o afectados concretos. Faltan elegibilidad contextual, decisiones individuales y seguimiento a días/semanas. Código: `unexpected-events.js:5–31`, `47–60`.
43. **Fecha de inicio coherente con la base elegida.** La base es una selección histórica, no planteles vivos. Hay 4.924 incorporaciones fechadas después del 3/1/2026 y 1.373 posteriores al 1/7/2026 ya incluidas desde el inicio. Ejemplos en Boca: Montero y Villa 17/7; Valencia 9/8. Hace falta definir si se juega con fotografía de octubre, con planteles al día inicial o con incorporaciones futuras programadas. Son datos de referencia del catálogo, no una verificación de pertenencia actual en Transfermarkt. Código: `world-engine.js:46–54`, `330–331`; campos `joinedDate` del catálogo.
44. **Presupuestos negociados con la directiva.** Reasignar autorización de fichajes y salarios con proyección del costo, deuda, vencimientos y reservas. El canje fijo actual de caja por límite salarial es una simplificación de diseño, no un botón roto. La plantilla financiera debería ayudar a decidir por temporada y moneda. Código: núcleo de `index.html:17603`, `club-finances.js`.

## Casos que todavía requieren verificación completa

**R1. Activar cláusula y veto de cobertura del propietario.** El código aplica el control de cobertura del vendedor incluso al activar una cláusula española/bilateral. Se observó el rechazo, pero el comprador del probe no tenía suficiente autorización financiera efectiva para demostrar un fichaje que cumpliera todos los otros requisitos. Debe repetirse con cláusula barata o presupuesto autorizado suficiente. Fuentes: `market-contracts.js:129–131`, `166`, `178`. No se presenta como transferencia viable que haya sido rechazada con todo validado.

**R2. Evaluación anticipada de permanencia antes de una promoción interdivisional.** Puede no existir aún el partido de promoción si la otra categoría no definió al rival. El cierre de objetivos podría ocurrir antes del cruce. Es una hipótesis de lectura sin reproducción completa: `season-calendar.js:70`, `football-pyramid.js:222`.

## Observaciones de datos y rendimiento

- 3.670 identidades tienen tasación con fecha individual; 10.327 tienen cifra sin esa fecha y 1.186 carecen de valor utilizable. 4.883 no tienen vencimiento contractual publicado. Estos campos deben seguir distinguiendo fuente y estimación; no son por sí mismos errores del juego.
- En nueve pantallas comprobadas a 1440×960 y 390×844 no apareció desplazamiento global indebido. Las listas/lectores extensos tienen desplazamiento propio.
- El mercado se dibujó en unos 80–90 ms en este entorno; una primera búsqueda deportiva más compleja llegó a unos 152 ms y luego alrededor de 55 ms al reutilizar cálculos. No se detectó una creación masiva de 15.000 informes al abrir el buscador. No equivale a una garantía para equipos lentos o carreras de veinte temporadas.
- La revisión de worker, revisiones de guardado e importación no encontró una nueva pérdida de carrera durante uso normal. El caso 24 depende de un archivo inválido. No se confunde con una corrupción espontánea.
- La arquitectura conserva núcleo heredado, módulos que reemplazan funciones/exportaciones y varios manejadores globales. Esto explica parte de las conexiones perdidas. Conviene centralizar reglas y efectos manteniendo la exportación final autocontenida; no se requiere adoptar un framework para solucionar estos problemas.

## Orden propuesto de trabajo

1. **Consistencia del juego:** motor táctico y físico, calendario dependiente, neutralidad, acuerdos firmados, posiciones aprendidas y registros comunes de partido. Añadir una regresión por caso que antes falla y después pasa.
2. **Economía y gestiones:** cierres por período correcto, obligaciones vencidas, continuidad de deuda, respuesta del jugador vendedor, descansos y notificaciones por episodio.
3. **Campañas largas:** retiro, valores dinámicos, IA por puestos exactos, reglas deportivas versionadas y datos compatibles con la fecha inicial.
4. **Profundidad y presentación:** cambios de sistema en vivo, archivo de partidos, búsquedas guardadas, formación juvenil, delegación y competiciones que faltan.

La comprobación posterior debe incluir tres recorridos completos: temporada sudamericana, temporada europea cruzando año y continuidad de cinco temporadas. Debe revisar invariantes de caja/propiedad, fases resueltas, clasificación, minutos, disciplina y restauración de guardados; contar clics o validar que no haya errores de consola no alcanza para detectar los defectos anteriores.
