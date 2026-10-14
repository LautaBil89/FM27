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

La fuente principal es **Transfermarkt**: 400 perfiles con ID y enlace de origen, fecha de nacimiento, posición específica, nacionalidades y, cuando están publicados, pie y altura. Los planteles jugables se seleccionan entre los participantes de **2025** que aparecen en sus páginas históricas. Se prioriza el núcleo histórico de la versión anterior cuando coincide con Transfermarkt, corrigiendo fechas, posiciones y participantes que no aparecen en esa temporada. No se presenta como una nómina activa al 31 de diciembre ni como fichajes actuales de 2026.

Los valores de las tablas históricas de planteles pueden corresponder a fechas anteriores y no incluyen una fecha individual de tasación. Por eso se consultó el **historial público de valoración de los 400 perfiles**, conservando la última publicación no posterior al **31/12/2025** y su fecha exacta. Hay **397 referencias positivas fechadas**: 396 publicadas en 2025 y una en 2024. Damián Fernández, Germán Barbas y Julio Daguer no tienen una cotización publicada antes de ese corte; su referencia Transfermarkt permanece `null` (un guion en el historial no se convierte en un precio cero) y su valor de juego es una estimación explícita. Lucas Lavagnino e Imanol Machuca tienen una revisión posterior sin cotización; se muestra su último valor positivo anterior como referencia histórica, con la fecha y una aclaración en la ficha.

Cada ficha separa el **valor publicado en EUR** del valor utilizado por la carrera en USD. La conversión fija de simulación es **EUR 1 = USD 1,10**; no representa un tipo de cambio financiero vigente. Las cotizaciones de Transfermarkt son valoraciones de referencia, no precios de venta ni cláusulas garantizadas. Los atributos, personalidad, potencial, roles tácticos, contratos, salarios, cláusulas y presupuestos siguen siendo **estimaciones del juego**: Transfermarkt no publica atributos de Football Manager ni todos esos términos contractuales.

Las edades se calculan desde la fecha completa de nacimiento en la fecha de la carrera. La fecha de consulta aparece separada de la fecha de valoración. La aplicación conserva una instantánea y no solicita datos de Transfermarkt durante la partida.

La base auditable está en [data/transfermarkt-2025.json](data/transfermarkt-2025.json) y también está completamente incorporada en `index.html`; no hace falta descargar ese JSON para jugar. Las partidas existentes conservan sus fichajes, presupuestos y valores de carrera. Cuando una identidad real de una partida anterior coincide con seguridad, se añaden referencias Transfermarkt sin cambiar sus términos económicos. Para usar los planteles y valores iniciales nuevos, comenzá una nueva carrera después de exportar la anterior.

Las fichas conservan las nacionalidades publicadas y tienen en cuenta la ciudadanía argentina al calcular los cupos. La edición usa seis extranjeros inscritos y como máximo 32 jugadores en el plantel. Los futbolistas sin inscripción no pueden jugar. La ventana de pases simplificada abre de enero a marzo y de julio a agosto. El tipo de cambio de simulación es USD 1 = ARS 1.200.

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

## Archivo complementario y método de extracción

Se revisó el ZIP de datos aportado durante el desarrollo: 12 CSV, 50.149 perfiles, 796 clubes, 65 competiciones y 656.301 tasaciones. Sus CSV principales coinciden con el dataset público de [David Cariboo](https://github.com/dcaribou/transfermarkt-datasets). Las fechas del contenido llegan al **12/06/2026** para tasaciones y al **06/07/2026** para partidos; el timestamp del ZIP, **05/09/2026**, es una fecha de empaquetado y no acredita datos actualizados hasta ese día.

Coinciden 369 perfiles del juego y hay 362 contratos de referencia disponibles. Se incorporan esos datos como complemento en las fichas, con sus fechas y su última temporada declarada. La carrera mantiene sus propios contratos y valores. Los registros antiguos, los futbolistas retirados y las transferencias futuras —incluidos retornos previstos hasta 2030— no se usan para reasignar planteles automáticamente. Los clubes uruguayos y la Libertadores no tienen cobertura completa en el archivo; se conservan las fuentes directas de Transfermarkt.

El archivo contiene partidos y eventos parciales de la LPF: pueden recuperar goles, asistencias informadas y tarjetas. No aporta minutos individuales domésticos argentinos ni brasileños y no contiene atributos técnicos o mentales de Football Manager. Se evita deducir valoraciones oficiales de esos campos ausentes.

La guía de [worldfootballR para extraer Transfermarkt](https://jaseziv.github.io/worldfootballR/articles/extract-transfermarkt-data.html) sirve de referencia para descubrir perfiles, biografías y valoraciones por equipo. El proyecto worldfootballR fue archivado en septiembre de 2025, por lo que la guía se usa como referencia del método. La aplicación utiliza la instantánea incorporada y no depende de R ni de consultas durante la partida. El historial individual permite seleccionar valores con una fecha verificable, evitando asignar la temporada visible de una tabla a una cotización sin fecha.

La base JSON revisada puede reincorporarse al HTML con:

```bash
python3 tools/embed_database.py
```

Esta operación es local, valida identidades únicas y conserva el archivo autocontenido.

## Fuentes Transfermarkt

Páginas de participantes 2025 consultadas por HTTPS. En esta fuente, `saison_id/2024` selecciona la temporada visible 2025 para estos clubes sudamericanos; se comprobaron el título y la temporada seleccionada.

- [CA Boca Juniors](https://www.transfermarkt.com.ar/boca/kader/verein/189/saison_id/2024/plus/1)
- [CA River Plate](https://www.transfermarkt.com.ar/river/kader/verein/209/saison_id/2024/plus/1)
- [Racing Club](https://www.transfermarkt.com.ar/racing/kader/verein/1444/saison_id/2024/plus/1)
- [CA Independiente](https://www.transfermarkt.com.ar/independiente/kader/verein/1234/saison_id/2024/plus/1)
- [CA San Lorenzo de Almagro](https://www.transfermarkt.com.ar/sanlorenzo/kader/verein/1775/saison_id/2024/plus/1)
- [CA Huracán](https://www.transfermarkt.com.ar/huracan/kader/verein/2063/saison_id/2024/plus/1)
- [CA Newell's Old Boys](https://www.transfermarkt.com.ar/newells/kader/verein/1286/saison_id/2024/plus/1)
- [CA Rosario Central](https://www.transfermarkt.com.ar/central/kader/verein/1418/saison_id/2024/plus/1)
- [CA Talleres](https://www.transfermarkt.com.ar/talleres/kader/verein/3938/saison_id/2024/plus/1)
- [CA Belgrano](https://www.transfermarkt.com.ar/belgrano/kader/verein/2417/saison_id/2024/plus/1)
- [CA Vélez Sarsfield](https://www.transfermarkt.com.ar/velez/kader/verein/1029/saison_id/2024/plus/1)
- [Club Estudiantes de La Plata](https://www.transfermarkt.com.ar/estudiantes/kader/verein/288/saison_id/2024/plus/1)
- [CR Flamengo](https://www.transfermarkt.com.ar/flamengo/kader/verein/614/saison_id/2024/plus/1)
- [SE Palmeiras](https://www.transfermarkt.com.ar/palmeiras/kader/verein/1023/saison_id/2024/plus/1)
- [Club Nacional](https://www.transfermarkt.com.ar/nacional/kader/verein/866/saison_id/2024/plus/1)
- [CA Peñarol](https://www.transfermarkt.com.ar/penarol/kader/verein/861/saison_id/2024/plus/1)
- [Inter Miami CF](https://www.transfermarkt.com.ar/intermiami/kader/verein/69261/saison_id/2024/plus/1)
- [Santos FC](https://www.transfermarkt.com.ar/santos/kader/verein/221/saison_id/2024/plus/1)
- [Fluminense](https://www.transfermarkt.com.ar/fluminense/kader/verein/2462/saison_id/2024/plus/1)
- [Cruzeiro](https://www.transfermarkt.com.ar/cruzeiro/kader/verein/609/saison_id/2024/plus/1)
- [Atlético Mineiro](https://www.transfermarkt.com.ar/atleticomineiro/kader/verein/330/saison_id/2024/plus/1)
- [Vasco da Gama](https://www.transfermarkt.com.ar/vasco/kader/verein/978/saison_id/2024/plus/1)
- [São Paulo](https://www.transfermarkt.com.ar/saopaulo/kader/verein/585/saison_id/2024/plus/1)
- [Corinthians](https://www.transfermarkt.com.ar/corinthians/kader/verein/199/saison_id/2024/plus/1)
- [Lanús](https://www.transfermarkt.com.ar/lanus/kader/verein/333/saison_id/2024/plus/1)
- [Tigre](https://www.transfermarkt.com.ar/tigre/kader/verein/11831/saison_id/2024/plus/1)
- [Argentinos Juniors](https://www.transfermarkt.com.ar/argentinos/kader/verein/1030/saison_id/2024/plus/1)

Las fichas enlazan el perfil y el historial de tasaciones específicos de cada jugador. Los 400 IDs y sus referencias están en el JSON de la base. La valoración se obtiene del endpoint público de historial `https://www.transfermarkt.com/ceapi/marketValueDevelopment/graph/<ID>` y conserva la fecha publicada, no sólo la fecha de descarga.
