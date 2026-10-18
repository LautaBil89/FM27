# Renovación de interfaz · 18 de octubre de 2026

## Cambios

- Sistema de diseño compartido: superficies azul oscuro, acciones verde agua, estados y contraste más claros, tipografía y espaciado consistentes. Barra lateral agrupada por área, encabezados legibles y colores del club.
- Inicio compuesto por paneles útiles: próximo partido con estadio ilustrado, indicadores del club, disponibilidad de jugadores, referentes, clasificación, mensajes que abren su expediente y próximos compromisos. Antes del primer partido no se presenta el desempate alfabético como una posición deportiva consolidada.
- Plantilla y mercado: identidad por jugador, colores por posición, composición del plantel y contexto de caja/capacidad/ventana. Las búsquedas actualizan las filas conservando el campo y el cursor.
- Táctica: cancha con mayor contraste, camisetas con colores del club, banco en dos columnas cuando hay espacio y reserva al lado del once. Convocatorias según las reglas de cada competición; listas con desplazamiento interno en pantallas pequeñas.
- Partido: marcador, cancha, jugadores, controles y paneles con el mismo lenguaje visual. Se conservan pausas, velocidades, repeticiones y decisiones tácticas.
- Fichas: camiseta ilustrada y radar de seis atributos simulados del primer equipo propio. El radar no aparece en jugadores ajenos: no revela información que el ojeo todavía desconoce.
- Entrenamiento: semana en tarjetas con fecha, fase, trabajo y carga expresada en texto y barras.
- Finanzas: gráfico del saldo calculado desde el libro contable. Si aún no hay movimientos se muestra ese estado; no se inventan series históricas. Si se compactó el libro, el gráfico utiliza el intervalo de movimientos conservado y su saldo conciliado.
- Bandeja: lista y lectura diferenciadas, ficha de decisiones, mejor espacio de lectura y estados vacíos ilustrados. El inicio enlaza al mensaje exacto y marca su lectura.
- Dirección deportiva: pestañas con iconos, inversiones ilustradas y formularios consistentes. Competiciones, empleados, carrera, vestuario, archivo y biblioteca de carreras reciben los mismos materiales y controles.

## Alcance y compatibilidad

La actualización conserva la base de datos, las reglas deportivas, las negociaciones y las carreras anteriores. No agrega fotografías ni escudos oficiales: las camisetas y emblemas son ilustraciones. Los gráficos usan datos de la carrera y las estadísticas simuladas mantienen su identificación.

La página ocupa la altura del dispositivo. Las listas, formularios y expedientes largos pueden desplazarse dentro de su panel. En móvil se distribuye el inicio entre tres vistas, manteniendo la preparación del partido visible en Panorama. Las vistas de baja altura priorizan el próximo partido; la agenda completa sigue accesible desde Competiciones.

No se agregan dependencias, fuentes ni imágenes remotas. El módulo visual trabaja con el plantel propio, los registros de la carrera y las filas visibles. No serializa el mundo al decorar la interfaz y la búsqueda conserva su actualización parcial. El mercado calcula una sola clave de orden por jugador y aplica primero la búsqueda por texto, antes de los filtros deportivos. Las observaciones se validan en cada ordenamiento, incluidos cambios de atributos sobre el mismo objeto.

## Validación

Las capturas y resultados están en [evidencias de interfaz](evidencias-interfaz-2026-10-18/). La matriz recorre 16 vistas en 1440×900, 1366×768, 390×844 y 360×640. Incluye capturas adicionales de partido en vivo y lectura de mensajes.

Las pruebas funcionales cubren el escritorio, enlaces a mensajes, radar sin filtración de atributos, gráfico contable, entrenamiento, estados vacíos, decoración repetida, búsqueda, convocatoria, controles del partido, formularios y navegación móvil. Las pruebas anteriores de táctica se actualizan a las convocatorias por competición y al banco y reserva en la misma pantalla. La prueba de plantel completo utiliza 40 jugadores, separado de la inscripción deportiva.

Para repetir las pruebas visuales nuevas, con el servidor iniciado:

```sh
FM27_TEST_URL=http://127.0.0.1:8070/index.html PYTHONPATH=tests python3 -m unittest test_visual_workspace -v
```

## Rendimiento medido

En Chromium local, a 1440×960 y con la misma semilla, se midieron tres calentamientos y quince renders completos por pantalla, incluyendo el cálculo de layout. La mediana del mercado pasó de **692 ms a 127,9 ms** (aproximadamente 81 % menos tiempo). El [registro completo](evidencias-interfaz-2026-10-18/rendimiento.json) conserva también inicio, plantilla, táctica y bandeja. Es una medición local, no una garantía de rendimiento para otros equipos; no incluye carga inicial, autoguardado ni simulación.

Resultado consolidado: **42 escenarios funcionales aprobados**, contando una sola vez los repetidos. El [detalle por escenario](evidencias-interfaz-2026-10-18/regresiones.json) enlaza los registros de ejecución. La matriz de 64 combinaciones de vista y tamaño terminó sin desbordamientos de documento ni errores JavaScript. La prueba de controles se repitió tras actualizar el selector de formación a Convocatoria; se conserva el registro inicial junto con la ejecución corregida.
