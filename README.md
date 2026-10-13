# FM27 · Pasión continental

Simulador de dirección técnica del fútbol argentino, con una interfaz de gestión inspirada en Football Manager. La aplicación completa está en **index.html**: no hay que instalar paquetes ni compilar.

## Jugar

1. Descargá el ZIP del repositorio desde **Code → Download ZIP**, o desde https://github.com/LautaBil89/FM27/archive/refs/heads/main.zip.
2. Extraelo y abrí **index.html** con Chrome, Edge o Firefox.
3. Elegí el nombre del DT, club y objetivo. Prepará el equipo en Tácticas y entrá al Centro de partido.
4. Continuá el encuentro, pausá para ajustar el planteo o hacer cambios y revisá el informe al finalizar.

El guardado automático pertenece a ese navegador y a esa ubicación del archivo. Usá **Exportar** para descargar una copia JSON y **Importar** para recuperarla en otro navegador o computadora. Las carreras de la primera versión se conservan; para usar el nuevo plantel real, empezá una carrera nueva. Sus planteles ficticios no se sustituyen durante la migración.

También se puede servir en desarrollo:

```bash
python3 -m http.server 8000 --directory .
```

## Qué incluye

- **400 jugadores reales**: 376 en 16 planteles argentinos y continentales, y 24 objetivos de mercado vinculados a sus clubes externos. Los nombres no se generan al empezar una carrera.
- Liga de 12 clubes, ida y vuelta, tabla anual, clasificación a copas, calendario y eliminatorias de Libertadores. La clasificación de una temporada determina la participación continental en la siguiente.
- Bandeja de entrada, informes del segundo entrenador, contratos, estados médicos, inscripción, filtros, ordenación y estadísticas individuales.
- Seis formaciones, roles, mentalidad, amplitud, ritmo, línea defensiva, presión, capitán y lanzador de penales con efectos en el motor.
- Entrenamiento colectivo e individual, recuperación, desarrollo limitado por potencial y riesgo de sobrecarga.
- Mercado con oferta de pase, salario, prima, duración y respuesta posterior; ofertas por transferibles, presupuesto salarial y límite de extranjeros.
- Ojeo, informes pagados, lista de seguimiento y contabilidad de salarios, fichajes, premios, patrocinio y recaudación.
- Partidos con xG, tiros al arco, atajadas, córners, asistencias, tarjetas, lesiones, cambios de la IA, entretiempo, tiempo añadido y penales. Hasta cinco sustituciones en tres ventanas; el descanso no consume ventana.
- Cambios tácticos y arengas en vivo, desgaste físico y sanciones por acumulación de amarillas o expulsión.
- Exportación/importación de carreras y guardados incompatibles rechazados sin reemplazar la carrera actual.

## Base y reglas de simulación

La base se reconstruyó a partir de **planteles de 2025**, principalmente revisiones históricas de diciembre, y biografías públicas para el año de nacimiento. No representa fichajes actualizados en vivo a 2026. Las edades se calculan por año y pueden diferir en un año antes del cumpleaños. Los atributos, pie preferido, personalidad, potencial, contratos, valores, salarios y presupuestos son **estimaciones de juego**, no datos oficiales.

Las nacionalidades deportivas y la ciudadanía argentina se distinguen al calcular los cupos. La edición usa seis extranjeros inscritos y como máximo 32 jugadores en el plantel. Los futbolistas sin inscripción no pueden jugar. La ventana de pases simplificada abre de enero a marzo y de julio a agosto. El tipo de cambio de simulación es USD 1 = ARS 1.200.

La primera Libertadores utiliza cuatro clubes argentinos elegibles y cuatro invitados continentales en una fase final abreviada. La Sudamericana figura como plaza clasificatoria, sin torneo jugable. La zona de descenso tiene consecuencias deportivas, económicas y para la confianza; esta edición conserva los mismos 12 clubes en la temporada siguiente. Los juveniles creados por las inferiores en temporadas posteriores son ficticios y se identifican como tales.

La interfaz usa emblemas y monogramas dibujados para el juego. Los estilos e iconos necesarios están incorporados: la jugabilidad no depende de los CDN de Tailwind o Lucide.

## Validación

Pruebas de navegador con Playwright y Chromium: carreras, navegación de escritorio y móvil, tácticas, entrenamiento, ojeo, negociación, presupuestos, cupos, partido, sustituciones, persistencia, temporada completa, clasificación, exportación/importación y migración de la primera versión.

El motor se contrastó además con cientos de partidos de simulación para comprobar tasas de goles, tiros, xG, lesiones y tarjetas; no predice resultados de partidos reales.

Para volver a ejecutar las pruebas en una copia Git del repositorio:

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
python3 -m http.server 8000
```

En otra terminal:

```bash
python3 tests/test_game.py
```

Se puede seleccionar un Chromium ya instalado con `FM27_CHROMIUM` y otra dirección de servidor con `FM27_TEST_URL`. Las pruebas de migración recuperan el HTML original desde el historial Git; por eso requieren la copia Git y no sólo el ZIP de distribución.

## Fuentes de la base histórica

- [Boca Juniors](https://en.wikipedia.org/w/index.php?title=Boca+Juniors&oldid=1329612050) · revisión 2025-12-27
- [Club Atlético River Plate](https://en.wikipedia.org/w/index.php?title=Club+Atl%C3%A9tico+River+Plate&oldid=1330274954) · revisión 2025-12-30
- [Racing Club de Avellaneda](https://en.wikipedia.org/w/index.php?title=Racing+Club+de+Avellaneda&oldid=1330119331) · revisión 2025-12-29
- [Club Atlético Independiente](https://en.wikipedia.org/w/index.php?title=Club+Atl%C3%A9tico+Independiente&oldid=1329184488) · revisión 2025-12-24
- [San Lorenzo de Almagro](https://en.wikipedia.org/w/index.php?title=San+Lorenzo+de+Almagro&oldid=1330312135) · revisión 2025-12-30
- [Club Atlético Huracán](https://en.wikipedia.org/w/index.php?title=Club+Atl%C3%A9tico+Hurac%C3%A1n&oldid=1329366048) · revisión 2025-12-25
- [Newell's Old Boys](https://en.wikipedia.org/w/index.php?title=Newell%27s+Old+Boys&oldid=1327963298) · revisión 2025-12-17
- [Rosario Central](https://en.wikipedia.org/w/index.php?title=Rosario+Central&oldid=1330013090) · revisión 2025-12-29
- [Talleres de Córdoba](https://en.wikipedia.org/w/index.php?title=Talleres+de+C%C3%B3rdoba&oldid=1330304881) · revisión 2025-12-30
- [Club Atlético Belgrano](https://en.wikipedia.org/w/index.php?title=Club+Atl%C3%A9tico+Belgrano&oldid=1329701468) · revisión 2025-12-27
- [Club Atlético Vélez Sarsfield](https://en.wikipedia.org/w/index.php?title=Club+Atl%C3%A9tico+V%C3%A9lez+Sarsfield&oldid=1329940588) · revisión 2025-12-28
- [Estudiantes de La Plata](https://en.wikipedia.org/w/index.php?title=Estudiantes+de+La+Plata&oldid=1329366949) · revisión 2025-12-25
- [CR Flamengo](https://en.wikipedia.org/w/index.php?title=CR+Flamengo&oldid=1330304717) · revisión 2025-12-30
- [2025 Sociedade Esportiva Palmeiras season](https://en.wikipedia.org/wiki/2025_Sociedade_Esportiva_Palmeiras_season) · revisión 2025-seaso
- [Club Nacional de Football](https://en.wikipedia.org/w/index.php?title=Club+Nacional+de+Football&oldid=1329729166) · revisión 2025-12-27
- [Peñarol](https://en.wikipedia.org/w/index.php?title=Pe%C3%B1arol&oldid=1330270080) · revisión 2025-12-30
- [Huracán · plantel de la temporada 2025 (Spina y datos de posiciones)](https://en.wikipedia.org/wiki/2025_Club_Atl%C3%A9tico_Hurac%C3%A1n_season) · revisión Temporada 
- [Francisco Perruzzi · datos biográficos](https://es.wikipedia.org/wiki/Francisco_Perruzzi)
- [Andrés Madruga · datos biográficos](https://es.wikipedia.org/wiki/Andrés_Madruga)
- [Julián Millán · datos biográficos](https://es.wikipedia.org/wiki/Julián_Millán)
- [Nicolás Goitea · datos biográficos](https://es.wikipedia.org/wiki/Nicolás_Goitea)
- [Nahuel Arias · datos biográficos](https://es.wikipedia.org/wiki/Nahuel_Arias)
- [Daniel Zabala · datos biográficos](https://es.wikipedia.org/wiki/Daniel_Zabala)
- [Bruno Arady · datos biográficos](https://es.wikipedia.org/wiki/Bruno_Arady)
- [Paolo Calione · datos biográficos](https://es.wikipedia.org/wiki/Paolo_Calione)
- [Jaime Peralta · datos biográficos](https://es.wikipedia.org/wiki/Jaime_Peralta)
- [Plantel intermiami · temporada 2025](https://en.wikipedia.org/wiki/2025_Inter_Miami_CF_season) · revisión Temporada 
- [Plantel santos · temporada 2025](https://en.wikipedia.org/wiki/2025_Santos_FC_season) · revisión Temporada 
- [Plantel fluminense · temporada 2025](https://en.wikipedia.org/wiki/2025_Fluminense_FC_season) · revisión Temporada 
- [Plantel cruzeiro · temporada 2025](https://en.wikipedia.org/wiki/2025_Cruzeiro_Esporte_Clube_season) · revisión Temporada 
- [Plantel atleticomineiro · temporada 2025](https://en.wikipedia.org/wiki/2025_Clube_Atl%C3%A9tico_Mineiro_season) · revisión Temporada 
- [Plantel vasco · temporada 2025](https://en.wikipedia.org/wiki/2025_CR_Vasco_da_Gama_season) · revisión Temporada 
- [Plantel saopaulo · temporada 2025](https://en.wikipedia.org/wiki/2025_S%C3%A3o_Paulo_FC_season) · revisión Temporada 
- [Plantel corinthians · temporada 2025](https://en.wikipedia.org/wiki/2025_Sport_Club_Corinthians_Paulista_season) · revisión Temporada 
- [Plantel lanus · temporada 2025](https://en.wikipedia.org/wiki/2025_Club_Atl%C3%A9tico_Lan%C3%BAs_season) · revisión Temporada 
- [Plantel tigre · temporada 2025](https://en.wikipedia.org/wiki/2025_Club_Atl%C3%A9tico_Tigre_season) · revisión Temporada 
- [Plantel argentinos · temporada 2025](https://en.wikipedia.org/wiki/2025_Argentinos_Juniors_season) · revisión Temporada 
