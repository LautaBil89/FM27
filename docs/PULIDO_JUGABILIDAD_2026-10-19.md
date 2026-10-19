# Pulido de jugabilidad · 19 de octubre de 2026

Esta entrega mejora sistemas existentes. Conserva la interfaz visual, las ligas, las identidades de jugadores y las carreras anteriores.

## Negociaciones

- Las concesiones se calculan desde el mejor paquete que presentó el DT en cada etapa. Una propuesta igual o inferior consume paciencia, pero no reduce automáticamente las exigencias por acumular rondas. El registro persiste al guardar y cargar.
- El club considera el pase, el valor temporal de las cuotas, la participación de una venta futura y, en préstamos, el ahorro salarial. El representante considera salario garantizado, duración, aumentos y prima. Las bonificaciones por actuaciones conservan su tratamiento específico; no se confunden con dinero garantizado.
- Las primas de firma pueden compensar parcialmente la exigencia salarial en un fichaje. Las renovaciones mantienen su compensación específica para evitar contabilizarlas dos veces.
- La etapa del club y la etapa personal tienen memoria independiente. El importe acordado entre clubes sigue protegido cuando se negocia el contrato del jugador.
- Los mensajes explican la firmeza del vendedor y por qué repetir ofertas peores no ayuda. Las ofertas cerradas muestran su estado final y no se presentan como una revisión médica o inscripción pendiente por conservar campos antiguos.

## Decisiones de los clubes

- La evaluación de un plantel asigna jugadores a puestos concretos de su formación y después busca recambios. Un polivalente no cubre varios lugares simultáneamente. Se priorizan jugadores libres para cubrir el banco antes de reorganizar a los titulares.
- La calidad del equipo tiene en cuenta la cobertura del once; un puesto sin cubrir no se oculta con otro futbolista de una posición distinta.
- Un puesto cubierto también admite interés por una mejora clara de calidad. Tener recambios ya no cancela por sí solo la evaluación de un candidato superior; caja, salarios, capacidad y encaje siguen condicionando la oferta.
- Un club de la IA conserva su único especialista si venderlo deja un puesto de su formación sin cobertura natural. Siguen vigentes la cobertura general, las finanzas y el mínimo de jugadores.
- La búsqueda de compradores para cesiones usa el cargo de préstamo y el salario correspondiente, en lugar del precio de compra del jugador completo.
- El mercado autónomo aplica el límite de 40 contratos. Presupuesto, necesidad, reservas de retornos y acuerdos pendientes siguen limitando incorporaciones.
- La recaudación de un partido jugado entra en el cierre financiero aunque otros encuentros de su jornada sigan pendientes. Las sedes neutrales no se cobran como una localía ordinaria del club nominalmente local.

## Partido y condición

- La calibración usa la competición del encuentro en disputa, aunque otro evento del calendario aparezca como actual. Sus parámetros se calculan una vez por minuto simulado, en vez de repetirse en cada acción de circulación.
- El DT rival evalúa la condición real de sus jugadores de campo. Baja la presión sostenida ante fatiga, reorganiza el bloque con inferioridad numérica y limita la presión al buscar un empate si el equipo está agotado o con menos jugadores.
- Las decisiones tácticas repetidas que no cambian instrucciones dejan de generar nuevos avisos.
- En sede neutral ambos equipos reciben una carga de viaje simétrica. Es una aproximación basada en la distancia entre clubes: no se afirma conocer una sede sin geolocalización. El registro médico sigue protegido contra la doble aplicación del mismo partido.

## Entrenamiento

- Los microciclos personalizados usan la evolución individual del sistema de desarrollo: edad, margen de mejora, entorno, entrenador y condiciones del jugador.
- Se respetan recuperación individual, descanso planificado, política médica y carga reducida o intensa. La carga semanal también decae con los días sin trabajo.
- Cambiar entre entrenamiento ordinario y personalizado no permite aplicar sesiones adicionales a la misma mañana. El modo personalizado conserva sus dos sesiones diarias y su protección contra repeticiones.
- Tras disputar el propio encuentro se aplica recuperación, incluso si la jornada completa aún no terminó. Un encuentro ya jugado no se mantiene como preparación pendiente.
- La referencia de minutos para el desarrollo se calcula desde el comienzo de la temporada local, compatible con calendarios que atraviesan dos años.

## Bandeja y fluidez

- Los mensajes del motor y de la gestión pasan por el mismo escritor. Se conservan remitentes y referencias a eventos, empleados y negociaciones.
- Sólo el mensaje actual de una oferta pendiente presenta la decisión. Los anteriores enlazan al estado actual. Los acuerdos finalizados conservan su historia, con el estado final y sin botones de aceptación antiguos.
- Los mensajes pendientes tienen prioridad al conservar los 150 mensajes de la bandeja. La alerta de alineación sigue un episodio hasta resolverlo, en lugar de duplicarse cada día; comprueba elegibilidad en la próxima competición.
- Se distingue al representante del club, se usa el plazo personal cuando corresponde y los avisos de competición y preparación llevan a la pantalla pertinente.
- La búsqueda de mensajes actualiza su lista tras una pausa breve, conserva el mismo campo y respeta composición de texto y selección del cursor. No dispara un render completo del mundo por cada letra.

## Validación y reproducción

El detalle de ejecución se conserva en `evidencias-pulido-2026-10-19/`. Las pruebas nuevas cubren ofertas peores, persistencia, renovaciones, cobertura de puestos, préstamos, cambios de modo de entrenamiento, recuperación de jornadas parciales, viajes neutrales, reacción táctica, calibración y mensajes.

Resultado consolidado: **93 pruebas distintas aprobadas**, sin casos pendientes de resolver en esta selección. El [registro por caso](evidencias-pulido-2026-10-19/regresiones.json) cuenta una sola vez las ejecuciones repetidas y conserva el enlace a la última comprobación. Incluye pruebas de navegador y ensayos del modelo estadístico; no equivale a una auditoría exhaustiva de toda carrera posible. Los registros iniciales con fallos y su diagnóstico se conservan en la misma carpeta.

```sh
python3 tools/build_world.py
python3 -m http.server 8070 --directory .
```

En otra terminal:

```sh
FM27_TEST_URL=http://127.0.0.1:8070/index.html PYTHONPATH=tests python3 -m unittest test_gameplay_polish test_negotiation_rounds.NegotiationRounds -v
```

La regresión comprueba también negociación íntegra, renovaciones, frecuencia del mercado, contabilidad de la IA, simulación y reglamento del partido, cargas médicas, desarrollo, guardado y las pantallas de la actualización visual. Las pruebas de ida y vuelta de negociación verifican el reconocimiento médico y el consentimiento personal antes del cambio de club.

La prueba estadística de calibración recorre 3.000 muestras equivalentes a temporadas del modelo de marcadores; no representa 3.000 carreras completas con finanzas y traspasos. Las pruebas del motor en vivo incluyen ocho partidos con semillas controladas. No se agregan dependencias para jugar ni se necesita crear una carrera nueva.
