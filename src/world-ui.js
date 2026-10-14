/* Expanded careers share the existing management screens and match controls. */
(() => {
  const legacy = { render, dashboard, tables, market, roster, details, matchView };
  const ui = {
    country: 'Argentina', leagueId: 'ARG1', clubId: 'boca', manager: '', objective: '', careerSearch: '',
    tab: 'domestic', tableLeague: '', fixtureRound: '', worldCountry: 'all', worldLeague: 'all',
    worldQuery: '', worldPage: 0, worldClub: '', marketCountry: 'all', marketLeague: 'all',
    marketClub: 'all', marketAge: 'all', marketBudget: false, marketPage: 0
  };
  let preferencesState=null;
  function retainFilters(){if(!GameState?.worldVersion||!window.FM_DEPTH)return;const prefs=FM_DEPTH.ensure().preferences;if(preferencesState!==GameState){Object.assign(ui,prefs.worldFilters||{});marketQuery=prefs.marketQuery||'';marketPos=prefs.marketPos||'ALL';preferencesState=GameState}else{prefs.worldFilters=Object.fromEntries(['marketCountry','marketLeague','marketClub','marketAge','marketBudget','tableLeague','worldCountry','worldLeague'].map(k=>[k,ui[k]]));prefs.marketQuery=marketQuery;prefs.marketPos=marketPos}}
  const expanded = () => Boolean(GameState?.worldVersion && GameState.world);
  const database = () => typeof WORLD_DATABASE === 'undefined' ? null : WORLD_DATABASE;
  const leagues = () => expanded() ? GameState.world.leagues : database()?.leagues || [];
  const clubs = () => expanded() ? GameState.world.clubs : database()?.clubs || [];
  const leagueOf = id => leagues().find(item => item.id === id);
  const clubOf = id => clubs().find(item => item.id === id);
  const userLeague = () => leagueOf(GameState.world.userLeagueId);
  const icon = name => window.FMUI.icon(name);
  const emblem = (id, size = '') => {
    const team = clubOf(id);
    if (!team) return window.FMUI.shield(id, size);
    const safeColor = value => /^#[\da-f]{3,8}$/i.test(value || '') ? value : '#aa99cf';
    const initials = team.short || team.nombre.split(' ').map(word => word[0]).slice(0,3).join('');
    return `<svg class="fm-shield ${size}" viewBox="0 0 60 72" role="img" aria-label="Emblema ilustrado de ${esc(team.nombre)}"><path d="M5 4h50v38c0 13-13 22-25 27C18 64 5 55 5 42Z" fill="${safeColor(team.color)}" stroke="#ffffff70" stroke-width="2"/><path d="M6 27h48v17H6Z" fill="${safeColor(team.secondary)}"/><text x="30" y="39" text-anchor="middle" fill="#fff" font-size="14" font-family="Arial" font-weight="bold">${esc(initials)}</text></svg>`;
  };
  const cash = value => Number(value) >= 1e6 ? `USD ${(value/1e6).toLocaleString('es-AR',{maximumFractionDigits:1})} M` : money(Number(value) || 0);
  const eur = value => Number.isFinite(value) ? new Intl.NumberFormat('es-AR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value) : 'Sin tasación publicada';
  const sourceLink = (url, label) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !['transfermarkt.com','www.transfermarkt.com','transfermarkt.com.ar','www.transfermarkt.com.ar','transfermarkt.es','www.transfermarkt.es','transfermarkt.de','www.transfermarkt.de','github.com'].includes(parsed.hostname)) return esc(label);
      return `<a class="fm-source-link" href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
    } catch { return esc(label); }
  };
  const countryList = () => [...new Set(leagues().map(item => item.country))].sort((a,b)=>a.localeCompare(b));
  const limitFor = id => typeof foreignLimit === 'function' ? foreignLimit(id) : leagueOf(clubOf(id)?.leagueId)?.foreignLimit ?? 6;
  const quotaText = id => {
    const limit = limitFor(id);
    return limit >= 32 || !Number.isFinite(limit) ? 'Sin límite de extranjeros en el simulador' : `${foreigners(id)} de ${limit} cupos de extranjeros`;
  };
  const slotsFor = league => window.WORLD_ENGINE.qualificationSlots(league);
  const competitionName = event => window.WORLD_ENGINE.competitionLabel(event);
  const dailyPeriods = () => window.WORLD_CLOCK?.periods || [{label:'Mañana',time:'08:00'},{label:'Mediodía',time:'12:00'},{label:'Tarde',time:'18:00'},{label:'Noche',time:'21:00'}];
  const clockInfo = () => window.WORLD_CLOCK?.info() || {slot:0,label:'Mañana',time:'08:00',date:GameState.today,nextLabel:'Mediodía',ready:false};
  const nextFixture = () => window.WORLD_CLOCK?.nextFixture() || GameState.calendar.find(event=>!event.done && fixture(event));
  const fixtureTime = event => event?.type==='LPF' ? '18:00' : '21:00';
  const readyToPlay = event => Boolean(event && window.WORLD_CLOCK?.ready(event));
  const daysTo = event => Math.max(0,Math.round((new Date(`${event.date}T12:00:00Z`)-new Date(`${GameState.today}T12:00:00Z`))/864e5));
  const nextMatchText = event => {
    if (!event) return 'Sin partidos pendientes';
    if (readyToPlay(event)) return 'El equipo está listo para salir a la cancha';
    const days = daysTo(event);
    return `${days ? `En ${days} ${days===1?'día':'días'}` : 'Hoy'} · ${fixtureTime(event)} · ${event.type==='LPF'?'Tarde':'Noche'}`;
  };
  function clockSegments(info, compact = false) {
    return `<ol class="world-day-progress ${compact?'world-day-progress-compact':''}" aria-label="Turnos del día">${dailyPeriods().map((period,index)=>`<li class="${index===info.slot?'active':index<info.slot?'complete':''}" title="${esc(period.label)} · ${esc(period.time)}" aria-label="${esc(period.label)} · ${esc(period.time)}" ${index===info.slot?'aria-current="step"':''}><span>${esc(period.label)}</span><small>${esc(period.time)}</small></li>`).join('')}</ol>`;
  }
  function dailyAgenda() {
    const info = clockInfo(), members = mine(), available = members.filter(p=>!p.injury && !p.ban).length;
    const pending = (GameState.offers || []).filter(offer=>offer.status==='pending' || offer.status==='counter').length;
    const unread = (GameState.inbox || []).filter(item=>!item.read).length;
    const tasks = [
      ['training','Entrenamiento',`${GameState.training?.focus || 'Posesión'} · intensidad ${String(GameState.training?.intensity || 'Normal').toLocaleLowerCase('es')}`,'training'],
      ['finances','Negociaciones',`${pending} ${pending===1?'oferta pendiente':'ofertas pendientes'} · ${transferWindowOpen()?'mercado abierto':'mercado cerrado'}`,'market'],
      ['heart','Preparación y recuperación',`${available} disponibles de ${members.length} · ${members.filter(p=>p.injury).length} lesionados`,'squad'],
      ['news','Informe del día',`${unread} ${unread===1?'mensaje sin leer':'mensajes sin leer'} en la bandeja`,'inbox']
    ];
    const recent = (window.WORLD_CLOCK?.latest() || []).slice(0,4);
    return `<section class="card world-daily-agenda" aria-label="Agenda diaria"><div class="fm-panel-title"><div><h2>El día en el club</h2><p class="small muted">${date(GameState.today)} · ${esc(info.label)} · ${esc(info.time)} · turno ${info.slot+1} de 4</p></div><span class="badge">4 TURNOS DIARIOS</span></div>${clockSegments(info)}<div class="world-daily-tasks">${tasks.map(([taskIcon,title,description,destination],index)=>`<button data-view="${destination}" class="world-daily-task ${index===info.slot?'active':''}">${icon(taskIcon)}<span><small>${esc(dailyPeriods()[index].label)}</small><strong>${esc(title)}</strong><p>${esc(description)}</p></span>${icon('chevron')}</button>`).join('')}</div>${recent.length?`<div class="world-daily-reports" aria-live="polite">${recent.map(item=>`<article><time>${date(item.date)} · ${esc(dailyPeriods()[item.slot]?.label || '')}</time><strong>${esc(item.title)}</strong><p>${esc(item.body)}</p></article>`).join('')}</div>`:`<p class="world-daily-hint">Continuar avanza un turno. Entre partidos tenés tiempo para entrenar, revisar mensajes y negociar fichajes.</p>`}</section>`;
  }
  const standingsFor = id => window.WORLD_ENGINE.tableFor(id);
  const ordered = table => Object.values(table || {}).sort((a,b)=>b.pts-a.pts||(b.gf-b.gc)-(a.gf-a.gc)||b.gf-a.gf||(clubOf(a.id)?.nombre || '').localeCompare(clubOf(b.id)?.nombre || ''));
  const tableZone = (index, total, league) => {
    const slots = slotsFor(league);
    if (league.confederation==='UEFA' && index < (slots.champions || 0) + (slots.europa || 0) + (slots.conference || 0)) return 'world-europe';
    if (index < (slots.promotion || 0)) return 'world-promote';
    if (index < (slots.lib || 0)) return 'lib';
    if (index < (slots.lib || 0) + (slots.sud || 0)) return 'sud';
    if (index >= total - (slots.relegation || 0)) return 'down';
    return '';
  };
  const recentForm = id => {
    const results = GameState.calendar.filter(event=>event.type==='LPF' && event.done).flatMap(event=>event.games || []).filter(game=>(game.home===id || game.away===id) && game.result).slice(-5);
    return `<div class="fm-form">${results.length ? results.map(game=>{
      const home = game.home === id, scored = game.result[home?'home':'away'], conceded = game.result[home?'away':'home'];
      return `<span class="${scored>conceded?'win':scored<conceded?'loss':'draw'}">${scored>conceded?'G':scored<conceded?'P':'E'}</span>`;
    }).join('') : '<span>–</span><span>–</span><span>–</span><span>–</span><span>–</span>'}</div>`;
  };
  const domesticTable = (table, league, compact = false) => {
    const rows = ordered(table);
    return `<div class="scroll"><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th>${compact?'':'<th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th>'}<th>DG</th><th>PTS</th>${compact?'':'<th>Últimos 5</th>'}</tr></thead><tbody>${rows.map((row,index)=>`<tr class="${tableZone(index,rows.length,league)} ${row.id===GameState.userClub.id?'mine':''}"><td>${index+1}</td><td>${emblem(row.id,'small-shield')} <button class="fm-player-link world-club-link" data-world-club="${esc(row.id)}">${esc(clubOf(row.id)?.nombre || row.id)}</button></td><td>${row.pj}</td>${compact?'':['g','e','p','gf','gc'].map(key=>`<td>${row[key]}</td>`).join('')}<td>${row.gf-row.gc>0?'+':''}${row.gf-row.gc}</td><td><b>${row.pts}</b></td>${compact?'':`<td>${recentForm(row.id)}</td>`}</tr>`).join('')}</tbody></table></div>`;
  };
  const qualificationDescription = league => {
    const slots = slotsFor(league), parts = [];
    if (slots.promotion) parts.push(`<span class="green">${slots.promotion} ascensos</span>`);
    if (slots.lib) parts.push(`<span class="gold">${slots.lib} plazas Libertadores</span>`);
    if (slots.sud) parts.push(`<span class="green">${slots.sud} plazas Sudamericana</span>`);
    if (league.confederation==='UEFA') parts.push(`<span class="gold">${(slots.champions || 0)+(slots.europa || 0)+(slots.conference || 0)} puestos europeos de referencia · sin copas UEFA</span>`);
    if (slots.relegation) parts.push(`<span class="red">${slots.relegation} puestos de descenso</span>`);
    return parts.join(' · ') || 'Clasificación por puntos, diferencia de gol y goles a favor';
  };
  function profileSource(p) {
    const ref = p.transfermarkt;
    if (!ref) return `<section class="fm-data-source"><h3>${p.realIdentity?'Identidad de la base':'Jugador de la cantera'}</h3><p>${p.realIdentity?'Esta ficha no tiene una tasación publicada asociada.':'Identidad y atributos creados por la simulación.'}</p></section>`;
    const season = ref.sourceSeason || ref.season || leagueOf(clubOf(p.clubId)?.leagueId)?.sourceSeason || 'base histórica';
    const valueExplanation = ref.valuationDate
      ? `Tasación publicada con fecha ${ref.valuationDate}. ${ref.valuationSourceType==='archive' || String(ref.valuationSourceUrl || '').includes('github.com')?'El importe fechado procede del archivo público de Transfermarkt.':'La ficha conserva la fecha informada por la fuente.'}`
      : Number.isFinite(ref.marketValueEUR) ? 'Valor publicado en la tabla del plantel. Esa tabla no informa una fecha individual de cotización; la fecha de consulta no es la fecha de la tasación.' : 'La fuente no ofrece una tasación publicada. El valor en USD de la carrera es una estimación del juego.';
    return `<section class="fm-data-source"><div class="row between"><h3>Transfermarkt · datos de referencia</h3>${sourceLink(ref.profileUrl,'Abrir perfil oficial')}</div><div class="fm-source-fields"><div><span>Fecha de nacimiento</span><strong>${esc(p.fecha_nacimiento || ref.dateOfBirth || 'Sin dato publicado')}</strong></div><div><span>Posición publicada</span><strong>${esc(ref.positionDetail || 'Sin dato publicado')}</strong></div><div><span>Nacionalidades publicadas</span><strong>${esc((ref.nationalities || [p.nacionalidad]).join(' / '))}</strong></div><div><span>Pie / altura publicados</span><strong>${esc(ref.foot || 'Sin dato')} · ${Number.isFinite(ref.heightCm)?`${ref.heightCm} cm`:'Sin altura publicada'}</strong></div><div><span>Valor de mercado publicado</span><strong>${esc(eur(ref.marketValueEUR))}</strong></div><div><span>Fecha de valoración</span><strong>${esc(ref.valuationDate || 'No informada en la fuente')}</strong></div></div><p>${sourceLink(ref.sourceUrl,`Plantel de referencia · ${season}`)}<br>Consulta: ${esc(String(ref.retrievedAt || '').slice(0,10) || 'Sin fecha registrada')}. ${ref.sourceType==='archive'?'La identidad procede del archivo de Transfermarkt; la pertenencia al club se contrastó con el plantel de referencia.':'La lista publicada corresponde a participantes de la temporada de referencia.'}<br>${esc(valueExplanation)} ${ref.valuationSourceUrl?sourceLink(ref.valuationSourceUrl,'Fuente de la tasación'):''} La carrera evoluciona por separado.</p></section>`;
  }
  const retainWelcome = () => {
    if ($('#manager')) ui.manager = $('#manager').value;
    if ($('#objective')) ui.objective = $('#objective').value;
  };
  function welcome() {
    const db = database();
    if (!db?.clubs?.length) return legacy.render();
    const countries = countryList();
    if (!countries.includes(ui.country)) ui.country = countries[0];
    const choices = leagues().filter(item=>item.country===ui.country).sort((a,b)=>a.tier-b.tier);
    if (!choices.some(item=>item.id===ui.leagueId)) ui.leagueId = choices[0]?.id;
    const league = leagueOf(ui.leagueId), availableClubs = clubs().filter(item=>item.leagueId===ui.leagueId).sort((a,b)=>a.nombre.localeCompare(b.nombre));
    if (!availableClubs.some(item=>item.id===ui.clubId)) ui.clubId = availableClubs[0]?.id;
    const selected = clubOf(ui.clubId);
    const objectives = league?.tier === 2 ? ['Conseguir el ascenso','Salir campeón'] : league?.confederation === 'UEFA' ? ['Salir campeón','Terminar en la mitad superior','Clasificar a puestos europeos'] : league?.id==='ARG1' ? ['Salir campeón','Clasificar a Libertadores','Evitar el descenso'] : ['Salir campeón','Clasificar a Libertadores','Terminar en la mitad superior'];
    if (!objectives.includes(ui.objective)) ui.objective = objectives[league?.tier===2?0:1];
    const search = ui.careerSearch.trim().toLocaleLowerCase('es'), found = search ? clubs().filter(item=>`${item.nombre} ${item.country} ${leagueOf(item.leagueId)?.name || ''}`.toLocaleLowerCase('es').includes(search)) : [];
    $('#app').innerHTML = `<div class="welcome fm-welcome world-welcome"><section class="fm-welcome-story"><div class="brand">FM<span style="color:#c2a5ed">27</span><span class="fm-brand-badge" style="margin-left:13px">Pasión continental</span></div><div class="fm-kicker" style="margin-top:30px">Simulador de dirección técnica</div><h1 class="fm-welcome-title">Tu próxima<br>historia empieza<br><span>en cualquier cancha.</span></h1><p>Desde el ascenso argentino hasta las grandes ligas europeas. Armá tu equipo, negociá los fichajes y competí por una noche inolvidable de Copa.</p><div class="fm-welcome-tags"><span>PLANTELES REALES</span><span>LIBERTADORES</span><span>SUDAMERICANA</span><span>ASCENSOS</span></div><div class="fm-welcome-preview"><div><strong>${db.clubs.length}</strong><small>Clubes para dirigir</small></div><div><strong>${db.leagues.length}</strong><small>Ligas incluidas</small></div><div><strong>${db.players.length.toLocaleString('es-AR')}</strong><small>Jugadores reales</small></div></div><p class="fm-welcome-disclosure">Experiencia independiente inspirada en los simuladores de gestión futbolística. Emblemas ilustrados propios. Ligas y copas con calendario y reglas adaptados para jugar una temporada completa.</p></section><section class="fm-welcome-form"><div class="fm-kicker">Escribí tu historia</div><h2>Nueva carrera</h2><p class="muted">Elegí un país, una liga y el club de tu próxima aventura.</p><label class="field">Nombre del entrenador<input id="manager" maxlength="40" value="${esc(ui.manager)}" placeholder="Nombre y apellido" autocomplete="name"></label><div class="world-career-selectors"><label class="field">País<select id="worldCareerCountry">${countries.map(country=>`<option ${country===ui.country?'selected':''}>${esc(country)}</option>`).join('')}</select></label><label class="field">Liga<select id="worldCareerLeague">${choices.map(item=>`<option value="${esc(item.id)}" ${item.id===ui.leagueId?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label></div><label class="field">Club a dirigir<select id="club">${availableClubs.map(item=>`<option value="${esc(item.id)}" ${item.id===ui.clubId?'selected':''}>${esc(item.nombre)}</option>`).join('')}</select></label><label class="field">Buscar en todos los clubes<input id="worldCareerSearch" value="${esc(ui.careerSearch)}" placeholder="Nombre del club, país o liga" autocomplete="off"></label>${search?`<div class="world-career-results" aria-live="polite">${found.slice(0,12).map(item=>`<button type="button" data-world-select-club="${esc(item.id)}">${emblem(item.id,'small-shield')}<span><strong>${esc(item.nombre)}</strong><small>${esc(item.country)} · ${esc(leagueOf(item.leagueId)?.name || '')}</small></span>${icon('chevron')}</button>`).join('') || '<p class="muted">No se encontraron clubes.</p>'}${found.length>12?`<p class="small muted">${found.length} coincidencias. Escribí un nombre más preciso para ver tu club.</p>`:''}</div>`:''}<div class="fm-selected-club" id="selectedClubPreview">${selected?`${emblem(selected.id,'large')}<div><strong>${esc(selected.nombre)}</strong><p>${esc(selected.stadium || selected.country)} · ${esc(league.name)}</p><span class="badge">${esc(league.sourceSeason || selected.sourceSeason || 'Base histórica')}</span></div>`:''}</div><label class="field">Objetivo fijado por la directiva<output id="boardObjective">${esc(window.FM_OFFICE?.objectiveFor(selected?.id)||ui.objective)}</output></label><button class="primary" data-action="new" ${selected?'':'disabled'}>Comenzar carrera ${icon('arrow')}</button><button class="fm-import-label" data-action="import">Importar una carrera guardada</button><div class="world-source-summary"><strong>Transfermarkt · identidades y equipos reales</strong><p>Sudamérica: afiliación de la base 2026. Europa: temporada 2025/26. Cada ficha conserva su fuente y la fecha de tasación disponible. La selección de jugadores y los registros históricos pueden diferir de una convocatoria actual.</p><p>Atributos, potencial, salarios, presupuestos y condiciones de la carrera se estiman para la simulación. Calendario anual adaptado; las cinco ligas europeas se juegan en el mismo año del simulador. Las copas UEFA no están incluidas. ${sourceLink(league.sourceUrl,'Consultar equipos de esta liga')}</p></div><p class="fm-welcome-disclosure">Guardado automático en este navegador. Exportá tu carrera para llevarla a otro dispositivo. Las carreras anteriores conservan sus planteles y competiciones; la ampliación se aplica al comenzar una nueva.</p></section></div>`;
  }

  dashboard = function() {
    if (!expanded()) return legacy.dashboard();
    const league = userLeague(), user = GameState.userClub, table = ordered(standingsFor(league.id)), place = table.findIndex(row=>row.id===user.id)+1, row = table[place-1];
    const event = nextFixture(), game = fixture(event), members = mine(), condition = Math.round(members.reduce((sum,p)=>sum+p.condicion_fisica,0)/Math.max(1,members.length));
    const agenda = GameState.calendar.filter(item=>!item.done && fixture(item)).slice(0,4);
    const near = table.slice(Math.max(0,place-3),Math.max(0,place-3)+6), leaders = members.slice().sort((a,b)=>(b.goals||0)-(a.goals||0)||overall(b)-overall(a)).slice(0,3);
    const cup = Object.values(GameState.world.cups || {}).find(item=>item.participants?.includes(user.id));
    return `<div class="fm-page-intro"><div><div class="fm-kicker">Oficina del entrenador · ${esc(league.country)}</div><h2>${clockInfo().slot===3?'Buenas noches':clockInfo().slot===2?'Buenas tardes':'Buen día'}, ${esc(GameState.manager.split(' ')[0])}.</h2><p>${esc(league.name)} · ${GameState.finished?'Prepará el próximo desafío.':'Estas son las prioridades antes del próximo compromiso.'}</p></div>${recentForm(user.id)}</div><div class="fm-metrics"><div class="fm-metric">${icon('trophy')}<label>Posición en la liga</label><div class="stat">${place}<span class="small">º / ${table.length}</span></div><span class="small">${row?.pts || 0} puntos · ${row?.pj || 0} partidos</span></div><div class="fm-metric">${icon('trust')}<label>Confianza directiva</label><div class="stat ${user.confianza_directiva<40?'red':'green'}">${Math.round(user.confianza_directiva)}%</div>${bar(user.confianza_directiva)}<p class="small muted">${esc(user.objective)}</p></div><div class="fm-metric">${icon('users')}<label>Presión de la hinchada</label><div class="stat ${user.presion_hinchada>70?'red':'gold'}">${Math.round(user.presion_hinchada)}%</div>${bar(user.presion_hinchada,'#e0b786')}<p class="small muted">Los clásicos tienen un impacto mayor en la moral.</p></div><div class="fm-metric">${icon('heart')}<label>Estado del plantel</label><div class="stat">${condition}%</div><span class="small">${members.filter(p=>p.injury).length} lesionados · ${members.filter(p=>p.ban).length} suspendidos</span></div></div>${dailyAgenda()}<div class="fm-dashboard-grid"><div><div class="card fm-fixture-card"><div class="fm-panel-title"><h2>${GameState.finished?'Balance de temporada':event?'Próximo partido':'Cierre de temporada'}</h2>${icon('match')}</div>${event?`<div class="fm-fixture-meta"><span>${esc(competitionName(event))}</span><span>${date(event.date)} · ${fixtureTime(event)}</span></div>${game?`<div class="fm-fixture-teams"><div class="fm-fixture-team">${emblem(game.home,'large')}<strong>${esc(clubOf(game.home)?.nombre || game.home)}</strong><small>LOCAL</small></div><div class="fm-fixture-vs">VS</div><div class="fm-fixture-team">${emblem(game.away,'large')}<strong>${esc(clubOf(game.away)?.nombre || game.away)}</strong><small>VISITANTE</small></div></div><div class="fm-fixture-footer"><p class="small muted">${esc(clubOf(game.home)?.stadium || 'Estadio del local')}${isDerby(game)?' · <span class="gold">CLÁSICO</span>':''}</p><div class="world-next-match-actions"><span class="small ${readyToPlay(event)?'green':'muted'}">${esc(nextMatchText(event))}</span><button class="primary" data-view="match">${readyToPlay(event)?'Ir al partido':'Preparar partido'} ${icon('arrow')}</button></div></div>`:`<p class="muted">Revisá la agenda y seguí con la actividad del club.</p><button class="primary" data-action="advance">Continuar al próximo turno</button>`}`:GameState.finished?`<p class="muted">${esc(seasonReport())}</p><button class="primary" data-action="season">Nueva temporada</button>`:`<p class="muted">Tu club completó sus compromisos. Seguí la actividad mientras se definen las competiciones.</p><button class="primary" data-action="continue">Continuar al próximo turno</button>`}</div><div class="card"><div class="fm-panel-title"><h2>Noticias del club</h2><button class="fm-text-button" data-view="inbox">Bandeja de entrada ${icon('chevron')}</button></div>${GameState.news.slice(0,4).map(item=>`<article class="fm-news-row">${icon('news')}<div><time>${date(item.date)}</time><h3>${esc(item.title)}</h3><p>${esc(item.body)}</p></div></article>`).join('')}</div></div><div><div class="card fm-table-card"><div class="fm-panel-title"><h2>${esc(league.name)}</h2><button class="fm-text-button" data-world-own-table>Tabla completa</button></div><div class="scroll"><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>PTS</th></tr></thead><tbody>${near.map(item=>{const index=table.indexOf(item);return `<tr class="${tableZone(index,table.length,league)} ${item.id===user.id?'mine':''}"><td>${index+1}</td><td>${emblem(item.id,'small-shield')} <button class="fm-player-link" data-world-club="${esc(item.id)}">${esc(clubOf(item.id)?.nombre || item.id)}</button></td><td>${item.pj}</td><td>${item.gf-item.gc}</td><td><b>${item.pts}</b></td></tr>`}).join('')}</tbody></table></div><div class="fm-table-footer world-qualification">${qualificationDescription(league)}</div></div><div class="card"><div class="fm-panel-title"><h2>Referentes del plantel</h2><button class="fm-text-button" data-view="squad">Plantilla</button></div>${leaders.map(p=>`<div class="fm-player-leader"><div class="fm-profile-avatar">${esc(p.nombre.split(' ').map(word=>word[0]).slice(0,2).join(''))}</div><div><button class="fm-player-link" data-player="${p.id}">${esc(p.nombre)}</button><span class="fm-player-sub">${esc(p.posicion)} · ${p.appearances || 0} partidos</span></div><strong>${p.goals || 0}<span class="small muted" style="display:block">goles</span></strong></div>`).join('')}</div></div><div><div class="card"><div class="fm-panel-title"><h2>Agenda del club</h2>${icon('calendar')}</div><ul class="fm-mini-list">${agenda.map(item=>{const match=fixture(item),rival=match.home===user.id?match.away:match.home;return `<li><div><span class="fm-schedule-date">${date(item.date)} · ${fixtureTime(item)}</span><p>${esc(competitionName(item))}</p><strong>${esc(clubOf(rival)?.nombre || rival)}</strong><p>${match.home===user.id?'Local':'Visitante'}</p></div>${emblem(rival)}</li>`}).join('') || '<li class="muted">Sin próximos partidos.</li>'}</ul></div><div class="card"><h2>Informe del cuerpo técnico</h2><ul class="fm-mini-list"><li><div><strong>Plan de juego</strong><p>${esc(GameState.tactics.formation)} · ${esc(GameState.tactics.style)}</p></div><button class="fm-text-button" data-view="tactics">${icon('chevron')}</button></li><li><div><strong>Inscripción</strong><p>${esc(quotaText(user.id))}</p></div></li><li><div><strong>${league.confederation==='UEFA'?'Competición nacional':'Competición continental'}</strong><p>${esc(cup?.name || (league.confederation==='UEFA'?'Ligas nacionales europeas':'Sin clasificación continental'))}</p></div></li><li><div><strong>Presupuesto disponible</strong><p>${cash(user.presupuesto_dolares)}</p></div><button class="fm-text-button" data-view="finances">${icon('chevron')}</button></li></ul></div></div></div>`;
  };

  matchView = function() {
    if (!expanded() || GameState.match || GameState.finished) return legacy.matchView();
    const event = nextFixture(), game = fixture(event), info = clockInfo();
    if (!event || !game) return `<div class="card"><h2>Centro de partido</h2><p class="muted">Tu club no tiene partidos pendientes. El resto de las competiciones sigue su calendario.</p><button class="primary" data-action="continue">Continuar al próximo turno ${icon('arrow')}</button><button data-view="tables">Ver competiciones</button></div>`;
    const ready = readyToPlay(event);
    return `<div class="card world-prematch"><div class="fm-panel-title"><div><div class="fm-kicker">${esc(competitionName(event))}</div><h2>${ready?'Día de partido':'Preparación del próximo partido'}</h2></div><span class="badge ${ready?'green':''}">${ready?'LISTOS PARA JUGAR':'PRÓXIMO COMPROMISO'}</span></div><div class="world-prematch-time"><span>${date(event.date)} · ${fixtureTime(event)} · ${event.type==='LPF'?'Tarde':'Noche'}</span><span>Ahora: ${date(GameState.today)} · ${esc(info.label)} · ${esc(info.time)}</span></div><div class="fm-fixture-teams"><div class="fm-fixture-team">${emblem(game.home,'large')}<strong>${esc(clubOf(game.home)?.nombre || game.home)}</strong><small>LOCAL</small></div><div class="fm-fixture-vs">VS</div><div class="fm-fixture-team">${emblem(game.away,'large')}<strong>${esc(clubOf(game.away)?.nombre || game.away)}</strong><small>VISITANTE</small></div></div><p class="muted">${esc(clubOf(game.home)?.stadium || 'Estadio del local')}${isDerby(game)?' · <span class="gold">CLÁSICO · La rivalidad eleva la intensidad y la presión.</span>':''}</p><div class="world-prematch-status"><div>${icon(ready?'match':'calendar')}<span><strong>${esc(nextMatchText(event))}</strong><p>${ready?'Confirmá el once y las instrucciones antes de comenzar.':'La actividad del club sigue entre partidos. Avanzá los turnos para llegar al horario de inicio.'}</p></span></div><p>${esc(GameState.tactics.formation)} · ${esc(GameState.tactics.style)}</p></div><div class="world-prematch-actions"><button class="${ready?'primary':''}" data-action="kickoff" ${ready?'':'disabled'}>${icon('match')} Jugar partido</button>${ready?'':`<button class="primary" data-action="continue">Continuar a ${esc(info.nextLabel || 'el próximo turno')} ${icon('arrow')}</button>`}<button data-view="tactics">Preparar equipo</button><button data-view="training">Entrenamiento</button></div></div>${ready?'':dailyAgenda()}`;
  };

  function domesticView() {
    if (!leagueOf(ui.tableLeague)) ui.tableLeague = GameState.world.userLeagueId;
    const league = leagueOf(ui.tableLeague), events = GameState.calendar.filter(event=>event.type==='LPF' && event.leagueId===league.id);
    if (!events.some(event=>event.id===ui.fixtureRound)) ui.fixtureRound = (events.find(event=>!event.done) || events[events.length-1])?.id || '';
    const event = events.find(item=>item.id===ui.fixtureRound);
    const rounds = events.length, format = rounds>=2*(league.clubIds.length-1) ? 'ida y vuelta' : 'una rueda';
    return `<div class="card fm-table-card"><div class="fm-filters"><label class="world-inline-label">Liga<select id="worldTableLeague">${leagues().map(item=>`<option value="${esc(item.id)}" ${item.id===league.id?'selected':''}>${esc(item.country)} · ${esc(item.name)}</option>`).join('')}</select></label><span class="badge">${league.clubIds.length} equipos · ${rounds} fechas</span><button data-world-own-table>Mi liga</button></div>${domesticTable(standingsFor(league.id),league)}<div class="fm-table-footer world-qualification">${qualificationDescription(league)}</div></div><div class="card"><div class="fm-panel-title"><div><h2>Calendario y resultados</h2><p class="small muted world-calendar-today">Hoy: ${date(GameState.today)} · ${esc(clockInfo().label)} · ${esc(clockInfo().time)}</p></div><select id="worldFixtureRound" aria-label="Fecha de liga">${events.map(item=>`<option value="${esc(item.id)}" ${item.id===ui.fixtureRound?'selected':''}>Fecha ${item.round} · ${date(item.date)}${item.done?' · finalizada':''}</option>`).join('')}</select></div><p class="world-round-time">${event?.date===GameState.today?'<span class="badge">HOY</span> ':''}${event?`${date(event.date)} · Tarde · ${fixtureTime(event)}`:''}</p><div class="world-fixtures">${(event?.games || []).map(game=>`<div class="world-fixture ${game.home===GameState.userClub.id || game.away===GameState.userClub.id?'world-user-fixture':''}"><div>${emblem(game.home,'small-shield')}<span>${esc(clubOf(game.home)?.nombre || game.home)}</span></div><strong>${game.result?`${game.result.home} – ${game.result.away}`:'vs'}</strong><div><span>${esc(clubOf(game.away)?.nombre || game.away)}</span>${emblem(game.away,'small-shield')}</div></div>`).join('')}</div></div><div class="fm-notice">Formato del simulador: todos contra todos a ${format}, con calendario anual adaptado. Las posiciones y los resultados evolucionan durante la carrera. ${league.id==='ARG1' || league.id==='ARG2'?'Los ascensos y descensos conectan las dos divisiones argentinas.':''} ${sourceLink(league.sourceUrl,`Equipos de referencia · ${league.sourceSeason || 'base histórica'}`)}</div>`;
  }
  function cupView(id) {
    const cup = GameState.world.cups[id];
    if (!cup) return '<div class="card"><p>No se disputa esta copa en la carrera actual.</p></div>';
    const groups = cup.groups || [], stageNames = [['PLAYOFF','Playoff de acceso'],['R16','Octavos de final'],['QF','Cuartos de final'],['SF','Semifinales'],['FINAL','Final']], stages = stageNames.filter(([key])=>id==='SUD' || key!=='PLAYOFF').map(([key,name])=>cup.stages.find(stage=>stage.key===key) || {key,name,ties:[]});
    return `<div class="world-cup-header card"><div>${icon('trophy')}<h2>${esc(cup.name)}</h2><p class="muted">${cup.participants.length} participantes · fase de grupos y eliminatorias</p></div>${cup.winner?`<div class="world-cup-champion"><span class="gold">CAMPEÓN</span>${emblem(cup.winner)}<strong>${esc(clubOf(cup.winner)?.nombre || cup.winner)}</strong></div>`:`<span class="badge">${cup.groupDone?'ELIMINATORIAS':'FASE DE GRUPOS'}</span>`}</div><div class="world-cup-groups">${groups.map(group=>`<div class="card fm-table-card"><div class="fm-panel-title"><h2>Grupo ${esc(group.id)}</h2><span class="small muted">${id==='LIB'?'1º y 2º → octavos · 3º → SUD':'1º → octavos · 2º → repechaje'}</span></div><div class="scroll"><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>PTS</th></tr></thead><tbody>${ordered(cup.groupTables[group.id]).map((row,index)=>`<tr class="${index===0 || id==='LIB' && index===1?'lib':index===(id==='LIB'?2:1)?'sud':''} ${row.id===GameState.userClub.id?'mine':''}"><td>${index+1}</td><td>${emblem(row.id,'small-shield')} <button class="fm-player-link" data-world-club="${esc(row.id)}">${esc(clubOf(row.id)?.nombre || row.id)}</button></td><td>${row.pj}</td><td>${row.gf-row.gc}</td><td><b>${row.pts}</b></td></tr>`).join('')}</tbody></table></div></div>`).join('')}</div><div class="card"><div class="fm-panel-title"><h2>Cuadro de eliminatorias</h2><span class="small muted">Ida y vuelta · final a partido único</span></div><div class="world-bracket" tabindex="0" aria-label="Cuadro completo de ${esc(cup.name)}">${stages.map(stage=>`<section class="world-bracket-stage"><h3>${esc(stage.name)}</h3>${stage.ties?.length?stage.ties.map(tie=>`<article class="world-cup-tie"><div class="fm-cup-game">${['home','away'].map(side=>`<div class="fm-cup-team ${tie.winner===tie[side]?'winner':''}">${emblem(tie[side],'small-shield')}<span>${esc(clubOf(tie[side])?.nombre || tie[side])}</span><strong>${tie.aggregate?.[side] ?? '–'}</strong></div>`).join('')}</div><div class="world-tie-legs">${(tie.legs || []).map((leg,index)=>`<span title="${esc(clubOf(leg.home)?.nombre || leg.home)} – ${esc(clubOf(leg.away)?.nombre || leg.away)}">${tie.legs.length===1?'Final':index===0?'Ida':'Vuelta'}: ${leg.result?`${leg.result.home}–${leg.result.away}${leg.result.pen?` · pen ${leg.result.pen.home}–${leg.result.pen.away}`:''}`:'por jugar'}</span>`).join('')}</div></article>`).join(''):`<p class="world-round-pending">${cup.groupDone?'Cruces pendientes de clasificación.':'Los cruces se definen al terminar los grupos.'}</p>`}</section>`).join('')}</div></div><div class="fm-notice">Copas del simulador: grupos de cuatro, seis partidos por equipo y eliminatorias. Los terceros de Libertadores ingresan al repechaje de Sudamericana. ${cup.realStartingGroups?'Los participantes y grupos iniciales corresponden a la edición 2026; los resultados se simulan desde el inicio. '+sourceLink(cup.sourceUrl,'Grupos de referencia'):'Los participantes se clasifican por las tablas de tu carrera y el sorteo se simula dentro de las ligas incluidas.'}</div>`;
  }
  function worldClubView(id) {
    const team = clubOf(id), league = leagueOf(team?.leagueId);
    if (!team) return '';
    const members = squad(id).slice().sort((a,b)=>overall(b)-overall(a)), table = ordered(standingsFor(league?.id)), rowIndex = table.findIndex(row=>row.id===id);
    return `<div class="card"><button class="fm-text-button" data-world-back-clubs>← Volver a los clubes</button><div class="world-club-profile">${emblem(id,'large')}<div><div class="fm-kicker">${esc(team.country)} · ${esc(league?.name || '')}</div><h2>${esc(team.nombre)}</h2><p class="muted">${esc(team.stadium || '')}${team.capacity?` · ${Number(team.capacity).toLocaleString('es-AR')} espectadores`:''}</p>${sourceLink(team.sourceUrl,'Plantel de referencia en Transfermarkt')}</div><div class="world-club-rank"><strong>${rowIndex>=0?rowIndex+1:'–'}º</strong><span>${table[rowIndex]?.pts || 0} puntos</span></div></div></div><div class="card fm-table-card"><div class="fm-panel-title"><h2>Plantilla del club</h2><span class="small muted">${members.length} jugadores · ${esc(quotaText(id))}</span></div><div class="scroll"><table><thead><tr><th>Jugador</th><th>Posición</th><th>Edad / País</th><th>Media estimada</th><th>Valor del juego</th><th>Transfermarkt</th></tr></thead><tbody>${members.map(p=>`<tr><td><button class="fm-player-link" data-player="${p.id}">${esc(p.nombre)}</button><span class="fm-player-sub">${p.realIdentity?'Identidad real':'Juvenil generado'}</span></td><td>${esc(p.posicion)}</td><td>${p.edad}<span class="fm-player-sub">${esc(p.nacionalidad)}</span></td><td>${window.FM_DEPTH?FM_DEPTH.range(p):overall(p)}</td><td>${cash(p.valor_mercado)}</td><td>${sourceLink(p.transfermarkt?.profileUrl,eur(p.transfermarkt?.marketValueEUR))}<span class="fm-player-sub">${esc(p.transfermarkt?.valuationDate || 'Fecha de valor no informada')}</span></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function worldView() {
    if (ui.worldClub) return worldClubView(ui.worldClub);
    const countries = countryList(), options = leagues().filter(item=>ui.worldCountry==='all' || item.country===ui.worldCountry);
    if (ui.worldLeague!=='all' && !options.some(item=>item.id===ui.worldLeague)) ui.worldLeague='all';
    const query = ui.worldQuery.toLocaleLowerCase('es'), candidates = clubs().filter(item=>(ui.worldCountry==='all' || item.country===ui.worldCountry) && (ui.worldLeague==='all' || item.leagueId===ui.worldLeague) && `${item.nombre} ${item.country}`.toLocaleLowerCase('es').includes(query)).sort((a,b)=>a.country.localeCompare(b.country)||a.nombre.localeCompare(b.nombre));
    const pages = Math.max(1,Math.ceil(candidates.length/12)); ui.worldPage=Math.min(ui.worldPage,pages-1);
    return `<div class="card"><div class="fm-filters world-browse-filters"><input id="worldClubSearch" value="${esc(ui.worldQuery)}" placeholder="Buscar club" aria-label="Buscar club en el mundo"><select id="worldBrowseCountry" aria-label="País de los clubes"><option value="all">Todos los países</option>${countries.map(country=>`<option ${country===ui.worldCountry?'selected':''}>${esc(country)}</option>`).join('')}</select><select id="worldBrowseLeague" aria-label="Liga de los clubes"><option value="all">Todas las ligas</option>${options.map(item=>`<option value="${esc(item.id)}" ${item.id===ui.worldLeague?'selected':''}>${esc(item.name)}</option>`).join('')}</select></div><div class="world-club-grid">${candidates.slice(ui.worldPage*12,(ui.worldPage+1)*12).map(team=>`<button class="world-club-card" data-world-club="${esc(team.id)}">${emblem(team.id)}<span><strong>${esc(team.nombre)}</strong><small>${esc(team.country)} · ${esc(leagueOf(team.leagueId)?.name || '')}</small><small>${squad(team.id).length} jugadores · nivel ${team.rating}/99</small></span>${icon('chevron')}</button>`).join('') || '<p class="muted">No se encontraron clubes.</p>'}</div><div class="fm-table-footer"><span>${candidates.length} clubes · Página ${ui.worldPage+1} de ${pages}</span><div class="row"><button data-world-page="${ui.worldPage-1}" ${ui.worldPage===0?'disabled':''}>Anterior</button><button data-world-page="${ui.worldPage+1}" ${ui.worldPage>=pages-1?'disabled':''}>Siguiente</button></div></div></div>`;
  }
  tables = function() {
    if (!expanded()) return legacy.tables();
    const tabs = [['domestic','Ligas nacionales'],['LIB','Libertadores'],['SUD','Sudamericana'],['world','Clubes del mundo']];
    return `<div class="fm-page-intro"><div><h2>Competiciones</h2><p>${leagues().length} ligas · ${clubs().length} clubes · resultados de la carrera</p></div><span class="badge">TEMPORADA ${GameState.year}</span></div><div class="fm-tabbar world-tabs">${tabs.map(([key,label])=>`<button class="${ui.tab===key?'active':''}" data-world-tab="${key}">${label}</button>`).join('')}</div>${ui.tab==='domestic'?domesticView():ui.tab==='world'?worldView():cupView(ui.tab)}`;
  };

  market = function() {
    if (!expanded()) return legacy.market();retainFilters();
    const user = GameState.userClub, countries = countryList(), filteredLeagues = leagues().filter(item=>ui.marketCountry==='all' || item.country===ui.marketCountry);
    if (ui.marketLeague!=='all' && !filteredLeagues.some(item=>item.id===ui.marketLeague)) ui.marketLeague='all';
    const sourceClubs = clubs().filter(item=>item.id!==user.id && (ui.marketCountry==='all' || item.country===ui.marketCountry) && (ui.marketLeague==='all' || item.leagueId===ui.marketLeague)).sort((a,b)=>a.nombre.localeCompare(b.nombre)), clubIndex = new Map(clubs().map(item=>[item.id,item]));
    if (!['all','free'].includes(ui.marketClub) && !sourceClubs.some(item=>item.id===ui.marketClub)) ui.marketClub='all';
    const query = marketQuery.toLocaleLowerCase('es'), candidates = GameState.players.filter(p=>{
      if (window.FM_OFFICE&&!FM_OFFICE.matches(p,FM_OFFICE.filters.market))return false;
      if (p.clubId===user.id || marketPos!=='ALL' && p.posicion!==marketPos || ui.marketAge!=='all' && p.edad>Number(ui.marketAge) || ui.marketBudget && transferCost(p)>user.presupuesto_dolares) return false;
      const team = clubIndex.get(p.clubId);
      if (ui.marketCountry!=='all' && team?.country!==ui.marketCountry || ui.marketLeague!=='all' && team?.leagueId!==ui.marketLeague || ui.marketClub==='free' && p.clubId || !['all','free'].includes(ui.marketClub) && p.clubId!==ui.marketClub) return false;
      return `${p.nombre} ${p.nacionalidad} ${team?.nombre || 'Agente libre'}`.toLocaleLowerCase('es').includes(query);
    }).sort((a,b)=>overall(b)-overall(a)||a.nombre.localeCompare(b.nombre));
    const pages = Math.max(1,Math.ceil(candidates.length/25)); ui.marketPage=Math.min(ui.marketPage,pages-1);
    const displayed=candidates.slice(ui.marketPage*25,(ui.marketPage+1)*25), limit=limitFor(user.id);
    return `<div class="fm-page-intro"><div><h2>Centro de fichajes</h2><p>Explorá jugadores de las ligas incluidas y negociá las condiciones del pase.</p></div><button data-view="scouting">${icon('scouting')} Ver ojeo</button></div><div class="fm-metrics"><div class="fm-metric">${icon('finances')}<label>Presupuesto</label><div class="stat world-money-stat">${cash(user.presupuesto_dolares)}</div><span class="small">Fondos disponibles</span></div><div class="fm-metric">${icon('users')}<label>Inscripción extranjera</label><div class="stat">${limit>=32?'Libre':`${foreigners(user.id)} / ${limit}`}</div><span class="small">${esc(userLeague().country)} · regla del simulador</span></div><div class="fm-metric">${icon('squad')}<label>Plantel</label><div class="stat">${mine().length} / 32</div><span class="small">Capacidad máxima</span></div><div class="fm-metric">${icon('scouting')}<label>Seguimiento</label><div class="stat">${GameState.scouting?.shortlist?.length || 0}</div><span class="small">Objetivos observados</span></div></div>${typeof transferSummary==='function'?transferSummary():''}${typeof transferWindowOpen==='function'?`<div class="fm-offer-summary">${icon('calendar')} ${transferWindowOpen()?'Mercado de pases abierto.':'Mercado de pases cerrado · prepará negociaciones para la próxima ventana.'}</div>`:''}<div class="card fm-table-card"><div class="fm-filters world-market-filters"><input id="marketQuery" placeholder="Nombre, club o nacionalidad" value="${esc(marketQuery)}" aria-label="Buscar en el mercado"><select id="marketPos" aria-label="Posición del jugador"><option value="ALL">Todas las posiciones</option>${['POR','DEF','MED','DEL'].map(pos=>`<option ${pos===marketPos?'selected':''}>${pos}</option>`).join('')}</select>${window.FM_OFFICE?FM_OFFICE.filterHTML('market'):''}<select id="worldMarketCountry" aria-label="País de la liga"><option value="all">Todos los países</option>${countries.map(country=>`<option ${country===ui.marketCountry?'selected':''}>${esc(country)}</option>`).join('')}</select><select id="worldMarketLeague" aria-label="Liga de origen"><option value="all">Todas las ligas</option>${filteredLeagues.map(item=>`<option value="${esc(item.id)}" ${item.id===ui.marketLeague?'selected':''}>${esc(item.name)}</option>`).join('')}</select><select id="worldMarketClub" aria-label="Club de origen"><option value="all">Todos los clubes</option><option value="free" ${ui.marketClub==='free'?'selected':''}>Agentes libres</option>${sourceClubs.map(item=>`<option value="${esc(item.id)}" ${item.id===ui.marketClub?'selected':''}>${esc(item.nombre)}</option>`).join('')}</select><select id="worldMarketAge" aria-label="Edad máxima"><option value="all">Todas las edades</option>${[21,25,30].map(age=>`<option value="${age}" ${ui.marketAge===String(age)?'selected':''}>Hasta ${age} años</option>`).join('')}</select><label class="row small"><input type="checkbox" id="worldMarketBudget" ${ui.marketBudget?'checked':''}> Dentro del presupuesto</label></div><div class="scroll"><table><thead><tr><th>Jugador / Club</th><th>Posición</th><th>Edad / País</th><th>Calidad estimada</th><th>Precio del juego / Transfermarkt</th><th>Salario est. / sem.</th><th>Acciones</th></tr></thead><tbody>${displayed.map(p=>`<tr><td><button class="fm-player-link" data-player="${p.id}">${esc(p.nombre)}</button><span class="fm-player-sub">${esc(clubIndex.get(p.clubId)?.nombre || 'Agente libre')}${p.realIdentity?'':' · Juvenil generado'}</span></td><td><span class="fm-status-pill">${p.posicion}</span><span class="fm-player-sub">${esc(p.transfermarkt?.positionDetail || p.role || '')}</span></td><td>${p.edad}<span class="fm-player-sub">${esc(p.nacionalidad)}</span></td><td>${window.FM_DEPTH?FM_DEPTH.range(p):overall(p)}<span class="fm-player-sub">Potencial ${window.FM_DEPTH?FM_DEPTH.range(p,p.potential||overall(p)):p.potential||overall(p)} · ${window.FM_DEPTH?FM_DEPTH.knowledge(p).level:100}% conocido</span></td><td>${cash(transferCost(p))}<span class="fm-player-sub">${sourceLink(p.transfermarkt?.profileUrl,eur(p.transfermarkt?.marketValueEUR))}</span></td><td>${money(p.salario)}</td><td><button data-buy="${p.id}" ${locked()?'disabled':''}>Negociar</button> <button data-shortlist="${p.id}" aria-label="Seguir a ${esc(p.nombre)}">${icon(GameState.scouting?.shortlist?.includes(p.id)?'trust':'star')}</button> <button data-scout="${p.id}" aria-label="Pedir informe de ${esc(p.nombre)}">${icon('scouting')}</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No se encontraron jugadores con estos filtros.</td></tr>'}</tbody></table></div><div class="fm-table-footer"><span>${candidates.length.toLocaleString('es-AR')} resultados · Página ${ui.marketPage+1} de ${pages}</span><div class="row"><button data-world-market-page="${ui.marketPage-1}" ${ui.marketPage===0?'disabled':''}>Anterior</button><button data-world-market-page="${ui.marketPage+1}" ${ui.marketPage>=pages-1?'disabled':''}>Siguiente</button></div></div></div><div class="fm-notice">Los valores y salarios en USD son estimaciones del juego. La cifra en EUR conserva la valoración publicada por Transfermarkt y su fuente; abrí la ficha para revisar la fecha. Un jugador sin tasación publicada recibe un valor estimado para jugar. Las incorporaciones respetan el presupuesto, la capacidad del plantel y la inscripción de tu liga.</div>`;
  };
  roster = function() {
    const html = legacy.roster();
    if (!expanded()) return html;
    return html.replace(`${foreigners(GameState.userClub.id)} extranjeros de 6`,esc(quotaText(GameState.userClub.id)));
  };
  details = function(id) {
    legacy.details(id);
    if (!expanded()) return;
    const p = player(id), ref = p?.transfermarkt;
    if (!p) return;
    const section = $('#details .fm-data-source');
    if (section) section.outerHTML = profileSource(p);
    const disclosure = $('#details .fm-portrait-disclosure');
    if (disclosure) disclosure.textContent = `${p.realIdentity?'Identidad real y afiliación de referencia.':'Juvenil generado por la cantera del juego.'} Atributos, potencial, personalidad, contrato, salario y cláusula estimados para la simulación. La inscripción extranjera se calcula para el país de la liga de tu club. Estadísticas de tu carrera. Monograma ilustrado propio.`;
  };

  let rendering = false;
  render = function() {
    if (rendering) return;
    rendering = true;
    const active = document.activeElement, focusId = active?.id, caret = active?.selectionStart;
    try {
      if (!GameState) welcome();
      else {
        legacy.render();
        if (expanded()) {
          const info = clockInfo(), next = nextFixture(), headerDate = $('.fm-date');
          if (headerDate) headerDate.innerHTML = `<strong>${date(GameState.today)}</strong><span class="world-header-time">${esc(info.time)} · ${esc(info.label)} <small>${info.slot+1}/4</small></span>${clockSegments(info,true)}`;
          const continueButton = $('.fm-continue');
          if (continueButton && !GameState.match && !GameState.finished) {
            const nextPeriod = dailyPeriods()[(info.slot+1)%4];
            const ready = readyToPlay(next);
            continueButton.innerHTML = `<span class="world-continue-copy"><strong>${ready?'Ir al partido':'Continuar'}</strong><small>${ready?'Hora del inicio':`${info.slot===3?'Mañana · ':''}${esc(nextPeriod.label)} · ${esc(nextPeriod.time)}`}</small></span>${icon('arrow')}`;
            continueButton.title = ready ? 'Abrir el partido programado para este turno' : `Avanzar un turno: ${nextPeriod.label}, ${nextPeriod.time}${info.slot===3?' del día siguiente':''}`;
          }
          const toolbar = $('.fm-toolbar > .fm-toolbar-label');
          if (toolbar) toolbar.innerHTML = `${icon('calendar')} ${next?`${esc(competitionName(next))} · ${date(next.date)} · ${fixtureTime(next)}`:GameState.finished?'Fin de temporada':'Sin próximos partidos'}`;
        }
      }
      if (focusId && ['worldCareerSearch','worldClubSearch','marketQuery','manager'].includes(focusId)) {
        const replacement = document.getElementById(focusId);
        if (replacement) { replacement.focus({preventScroll:true}); if (typeof caret==='number') replacement.setSelectionRange(caret,caret); }
      }
    } finally { rendering = false; }
  };
  document.addEventListener('click',event=>{
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.worldSelectClub) {
      retainWelcome(); const team=clubOf(button.dataset.worldSelectClub); if(!team)return;
      ui.country=team.country;ui.leagueId=team.leagueId;ui.clubId=team.id;ui.careerSearch='';render();
    }
    if (!expanded()) return;
    if (button.dataset.worldTab) { ui.tab=button.dataset.worldTab;ui.worldClub='';render(); }
    if (button.hasAttribute('data-world-own-table')) { view='tables';ui.tab='domestic';ui.tableLeague=GameState.world.userLeagueId;ui.fixtureRound='';render(); }
    if (button.dataset.worldClub) { view='tables';ui.tab='world';ui.worldClub=button.dataset.worldClub;render(); }
    if (button.hasAttribute('data-world-back-clubs')) { ui.worldClub='';render(); }
    if (button.dataset.worldPage!==undefined) { ui.worldPage=Math.max(0,Number(button.dataset.worldPage));render(); }
    if (button.dataset.worldMarketPage!==undefined) { ui.marketPage=Math.max(0,Number(button.dataset.worldMarketPage));render(); }
  });
  document.addEventListener('change',event=>{
    const node=event.target;
    if (!GameState && ['worldCareerCountry','worldCareerLeague','club','objective'].includes(node.id)) {
      retainWelcome();
      if(node.id==='worldCareerCountry')ui.country=node.value;
      if(node.id==='worldCareerLeague')ui.leagueId=node.value;
      if(node.id==='club')ui.clubId=node.value;
      render();return;
    }
    if (!expanded()) return;
    const mapping={worldTableLeague:'tableLeague',worldFixtureRound:'fixtureRound',worldBrowseCountry:'worldCountry',worldBrowseLeague:'worldLeague',worldMarketCountry:'marketCountry',worldMarketLeague:'marketLeague',worldMarketClub:'marketClub',worldMarketAge:'marketAge'};
    if(mapping[node.id]) {ui[mapping[node.id]]=node.value;ui.worldPage=0;ui.marketPage=0;if(node.id==='worldTableLeague')ui.fixtureRound='';render();saveGame(true);}
    if(node.id==='worldMarketBudget'){ui.marketBudget=node.checked;ui.marketPage=0;render();saveGame(true);}
    if(node.id==='marketPos' || node.id==='marketQuery'){ui.marketPage=0;render();saveGame(true);}
  });
  let searchTimer;
  document.addEventListener('input',event=>{
    const node=event.target;
    if(!GameState && node.id==='manager'){ui.manager=node.value;return;}
    if(!['worldCareerSearch','worldClubSearch','marketQuery'].includes(node.id))return;
    if(node.id==='marketQuery' && !expanded())return;
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{
      if(node.id==='worldCareerSearch'){retainWelcome();ui.careerSearch=node.value;}
      if(node.id==='worldClubSearch'){ui.worldQuery=node.value;ui.worldPage=0;}
      if(node.id==='marketQuery'){marketQuery=node.value;ui.marketPage=0;}
      render();if(GameState)saveGame(true);
    },180);
  });
  window.WORLD_UI = { state:ui, welcome, domesticTable, profileSource };
})();
