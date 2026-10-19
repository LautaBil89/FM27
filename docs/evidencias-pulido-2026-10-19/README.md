# Evidencias del pulido de jugabilidad

Resultado consolidado: **93 casos distintos aprobados**. `regresiones.json` identifica cada caso, su último resultado y el registro de ejecución. Las repeticiones de fixtures importados no aumentan el total.

| Área | Casos distintos |
| --- | ---: |
| Pulido de jugabilidad nuevo | 15 |
| Rondas de negociación | 4 |
| Formulario real de ofertas | 6 |
| Integridad de condiciones | 6 |
| Renovaciones | 10 |
| Frecuencia, competencia y mejora de calidad | 5 |
| Mercado semanal y contabilidad de la IA | 1 |
| Presentación de operaciones | 3 |
| Medicina y cargas | 5 |
| Desarrollo y microciclo | 3 |
| Interfaz visual | 7 |
| Motor de acciones de partido | 9 |
| Reglamento y controles del partido | 6 |
| Programa de entrenamiento y mensajes de empleados | 2 |
| Guardado en segundo plano | 4 |
| Calibración estadística | 7 |

Se utilizó Chromium local con las peticiones de recursos externos bloqueadas. Los fixtures de carrera conservan las identidades reales y modifican sólo las condiciones necesarias para provocar cada situación. Las pruebas de frecuencia usan un mundo pequeño controlado en Node; la contabilidad y los traspasos autónomos se verifican también en el mundo completo del navegador.

## Diagnóstico de los primeros resultados

Los registros iniciales se conservan; no representan el resultado final de los casos corregidos y repetidos:

- `nuevas-inicial.log`: la oferta de prueba de US$ 10.000 ya era suficiente para comprar al jugador barato elegido. El fixture pasó a establecer una tasación de US$ 100.000 y ofertas de US$ 100, 50 y 200 para comprobar una negociación que sigue abierta. La prueba final comprueba memoria, paciencia, descuento y persistencia.
- `mercado-inicial.log`: dos pruebas antiguas esperaban cambio de club antes del reconocimiento médico o consentimiento personal. Ahora comprueban que el jugador permanece en origen y completan las etapas reales antes de exigir el traspaso. El resultado está en `nuevas-y-negociacion-final.log`.
- En esa ejecución, la prueba de entrenamiento auxiliar exigía un punto entero en un atributo agregado tras repartir pequeñas mejoras entre todo el plantel. El fixture actualizado a los 36 atributos deja un único entrenable cerca de una mejora y verifica el límite 99 tanto en los atributos detallados como en los seis agregados. `atributos-final.log` conserva la repetición aprobada.
- El mundo aislado de frecuencia no proporcionaba `WORLD_ENGINE.hasContinentalCompetition`, utilizado por la negociación personal actual. Se completó el doble de prueba. La ejecución aislada también mostró que un puesto cubierto descartaba candidatos claramente superiores. Se corrigió la evaluación real de interés y contratación, con una prueba que acepta una mejora clara y rechaza duplicados de igual calidad. Los cinco casos pasan en `frecuencia-final.log` y el mercado completo conserva caja conciliada en `ia-final.log`.

La comparación estadística de calibración incluye 3.000 muestras equivalentes a temporadas y un ensayo adicional de ligas equilibradas. Son pruebas del modelo de marcadores, no miles de carreras completas con fichajes y lesiones. El motor en vivo se comprueba por separado, incluyendo ocho encuentros con semillas controladas, exclusión de expulsados, acciones, cambios tácticos y guardado de un partido con prórroga.

## Repetir la selección

Con `index.html` construido y el servidor local en el puerto 8070:

```sh
FM27_TEST_URL=http://127.0.0.1:8070/index.html PYTHONPATH=tests python3 -m unittest \
  test_gameplay_polish.GameplayPolish \
  test_negotiation_rounds.NegotiationRounds \
  test_offer_form.OfferFormScenarios \
  test_negotiation_integrity.NegotiationIntegrity \
  test_renewal_negotiations.RenewalNegotiations \
  test_market_frequency.MarketFrequency \
  test_club_market_snapshot.ClubMarketSnapshot \
  test_offer_presentation.OfferPresentation \
  test_match_simulation.MatchSimulation \
  test_match_regulations_depth.MatchRegulationsDepth \
  test_background_save.BackgroundSave \
  test_match_calibration.MatchCalibration \
  test_visual_workspace.VisualWorkspace -v
```

Las ocho comprobaciones médicas y de desarrollo seleccionadas y las dos de programa/empleados figuran por nombre en los registros `salud-interfaz.log` y `partido-guardado-calibracion.log`. Se eligieron esos casos por los cambios realizados; no se afirma haber ejecutado toda la colección histórica de pruebas del repositorio.
