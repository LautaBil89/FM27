/* Visual management desk. Charts use career records; no remote images or fonts. */
window.FM_VISUAL = (() => {
  const previousDashboard = dashboard, previousRender = render;
  const ui = { dashboard: 'overview' };
  const active = () => Boolean(GameState?.worldVersion === 1);
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const pct = value => Math.round(clamp(num(value), 0, 100));
  const cash = value => Math.abs(num(value)) >= 1e6 ? `USD ${(num(value)/1e6).toLocaleString('es-AR', {maximumFractionDigits:1})} M` : money(num(value));
  const icon = name => FMUI.icon(name);
  const color = (value, fallback) => /^#[\da-f]{3,8}$/i.test(value || '') ? value : fallback;
  const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('');
  const names = {dashboard:'Tu oficina',inbox:'Comunicaciones',squad:'Primer equipo',tactics:'Pizarra táctica',training:'Centro de entrenamiento',scouting:'Departamento de ojeo',market:'Mercado de pases',tables:'Centro de competiciones',finances:'Dirección financiera',match:'Centro de partido',office:'DT y empleados',career:'Tu carrera', 'dressing-room':'Vestuario', archive:'Archivo de partidos',professional:'Dirección deportiva',player:'Ficha del jugador'};
  const navIcons = {office:'training',career:'trust','dressing-room':'users',archive:'calendar',professional:'tactics'};
  function shirt(p, large = false) {
    const team = club(p.clubId) || club(GameState.userClub.id);
    return `<span class="v-shirt ${large?'v-shirt-large':''}" style="--shirt:${color(team?.color,'#345b89')};--stripe:${color(team?.secondary,'#e8bf55')}" aria-hidden="true"><svg viewBox="0 0 64 66"><path d="M19 6 9 11 2 26l11 6 5-8v36h28V24l5 8 11-6-7-15-10-5c-5 9-21 9-26 0Z" fill="var(--shirt)" stroke="#ffffff40" stroke-width="1.5"/><path d="M18 28h28v10H18Z" fill="var(--stripe)"/><path d="M24 8q8 10 16 0" fill="none" stroke="#ffffff70" stroke-width="2"/></svg><b>${esc(initials(p.nombre))}</b></span>`;
  }
  function ring(value, label, tone='mint') {
    const v=pct(value);
    return `<div class="v-ring ${tone}" role="img" aria-label="${esc(label)}: ${v}%"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18"/><circle cx="22" cy="22" r="18" pathLength="100" stroke-dasharray="${v} 100"/></svg><b>${v}<small>%</small></b></div>`;
  }
  function results(id, limit=5) {
    const out=[];
    for (const event of GameState.calendar) for (const game of event.games || []) {
      if (game.result && (game.home===id || game.away===id)) out.push({event,game});
    }
    return out.sort((a,b)=>a.event.date.localeCompare(b.event.date)).slice(-limit);
  }
  function form(id) {
    const records=results(id);
    return `<div class="v-form" aria-label="Últimos resultados">${records.length ? records.map(({game})=>{
      const own=game.home===id?'home':'away', other=own==='home'?'away':'home', a=num(game.result[own]),b=num(game.result[other]);
      return `<span class="${a>b?'win':a<b?'loss':'draw'}" title="${esc(club(game.home)?.nombre)} ${game.result.home}–${game.result.away} ${esc(club(game.away)?.nombre)}">${a>b?'G':a<b?'P':'E'}</span>`;
    }).join('') : '<small>Sin partidos disputados</small>'}</div>`;
  }
  function cardTitle(title, action='', destination='') {
    return `<div class="v-card-heading"><h3>${esc(title)}</h3>${action?`<button class="v-link" data-view="${destination}">${esc(action)} ${icon('chevron')}</button>`:''}</div>`;
  }
  function upcoming(limit=4) {
    const out=[];
    for (const event of GameState.calendar) {
      if(event.done)continue;
      const game=fixture(event);
      if(game && !game.result)out.push({event,game});
    }
    return out.sort((a,b)=>a.event.date.localeCompare(b.event.date)).slice(0,limit);
  }
  function matchHero(next) {
    if(!next)return `<section class="card v-match-hero"><div class="v-hero-heading"><span class="v-eyebrow">TU PRÓXIMO DESAFÍO</span>${icon('trophy')}</div><h2>${GameState.finished?'Temporada completada':'El club sigue en marcha'}</h2><p>${GameState.finished?esc(seasonReport()):'No hay un partido pendiente para tu club. Revisá la agenda y las decisiones del día.'}</p><div class="world-next-match-actions"><button class="primary" data-action="${GameState.finished?'season':'continue'}">${GameState.finished?'Nueva temporada':'Continuar'} ${icon('arrow')}</button></div></section>`;
    const {event,game}=next, home=club(game.home),away=club(game.away), ready=WORLD_CLOCK.ready(event);
    const days=Math.max(0,Math.round((Date.parse(event.date)-Date.parse(GameState.today))/86400000));
    return `<section class="card fm-fixture-card v-match-hero"><div class="v-stadium" aria-hidden="true"><div class="v-stadium-stand"></div><div class="v-stadium-pitch"><i></i></div></div><div class="v-hero-heading"><span class="v-eyebrow">PRÓXIMO PARTIDO</span><span class="v-live-label">${isDerby(game)?'CLÁSICO':ready?'DÍA DE PARTIDO':days?`EN ${days} DÍAS`:'HOY'}</span></div><div class="v-match-meta">${esc(WORLD_ENGINE.competitionLabel(event))} · ${date(event.date)}</div><div class="v-versus"><div>${FMUI.shield(game.home,'large')}<strong>${esc(home?.nombre || game.home)}</strong><small>LOCAL</small></div><span><b>VS</b><small>${event.type==='LPF'?'18:00':'21:00'}</small></span><div>${FMUI.shield(game.away,'large')}<strong>${esc(away?.nombre || game.away)}</strong><small>VISITANTE</small></div></div><div class="v-match-bottom"><div><span class="v-eyebrow">${icon('match')} ${esc(home?.stadium || 'Estadio del local')}</span><small>${esc(GameState.tactics.formation)} · ${esc(GameState.tactics.style)}</small></div><div class="world-next-match-actions"><button class="primary" data-view="match">${ready?'Ir al partido':'Preparar partido'} ${icon('arrow')}</button></div></div></section>`;
  }
  function readiness(members) {
    const available=members.filter(p=>WORLD_ENGINE.canPlay(p,WORLD_CLOCK.nextFixture())), injured=members.filter(p=>p.injury).length, banned=members.filter(p=>p.ban).length;
    return `<section class="card v-readiness">${cardTitle('Disponibilidad','Plantilla','squad')}<div class="v-readiness-main">${ring(100*available.length/Math.max(1,members.length),'Jugadores disponibles')}<div><strong>${available.length}<small> / ${members.length}</small></strong><span>listos para competir</span></div></div><div class="v-segment" role="img" aria-label="${available.length} disponibles, ${injured} lesionados, ${banned} con sanción">${members.map(p=>`<i class="${p.injury?'injured':p.ban?'banned':WORLD_ENGINE.canPlay(p,WORLD_CLOCK.nextFixture())?'available':'other'}" title="${esc(p.nombre)} · ${p.injury?'Lesionado':p.ban?'Sancionado':'Condición '+pct(p.condicion_fisica)+'%'}"></i>`).join('')}</div><div class="v-legend"><span><i class="available"></i>Disponibles</span><span><i class="injured"></i>${injured} lesiones</span><span><i class="banned"></i>${banned} sanciones</span></div></section>`;
  }
  function leaders(members) {
    const top=members.slice().sort((a,b)=>num(b.goals)-num(a.goals)||overall(b)-overall(a)).slice(0,3);
    return `<section class="card v-leaders">${cardTitle('Nombres propios','Ver plantel','squad')}<div class="v-player-cards">${top.map(p=>`<button data-player="${p.id}" class="v-player-card">${shirt(p,true)}<span><strong>${esc(p.nombre)}</strong><small>${esc(p.posicion)} · ${p.edad} años</small></span><b>${num(p.goals)}<small>goles</small></b></button>`).join('')}</div></section>`;
  }
  function leaguePanel(table,league) {
    const id=GameState.userClub.id,index=table.findIndex(r=>r.id===id),start=Math.max(0,Math.min(index-2,table.length-5));
    return `<section class="card v-league">${cardTitle('La pelea en la liga','Tabla completa','tables')}<p class="v-subtitle">${esc(league?.name || '')}</p><div class="v-mini-table"><div class="v-table-labels"><span>#</span><span>CLUB</span><span>PJ</span><span>PTS</span></div>${table.slice(start,start+5).map((r,i)=>`<button data-world-club="${esc(r.id)}" class="${r.id===id?'mine':''}"><span>${start+i+1}</span><span>${FMUI.shield(r.id,'small-shield')}<strong>${esc(club(r.id)?.nombre || r.id)}</strong></span><span>${num(r.pj)}</span><b>${num(r.pts)}</b></button>`).join('')}</div><div class="v-table-form"><span>Últimos 5 partidos</span>${form(id)}</div></section>`;
  }
  function briefing() {
    const unread=(GameState.inbox||[]).filter(m=>!m.read).length,news=(GameState.inbox||[]).slice().sort((a,b)=>Number(!b.read)-Number(!a.read)||String(b.date).localeCompare(String(a.date))).slice(0,3);
    return `<section class="card v-briefing">${cardTitle('En el radar',`${unread} sin leer`,'inbox')}<div class="v-briefing-list">${news.map(n=>`<button data-v-message="${n.id}"><span class="v-news-dot">${icon(FM_INBOX.isPending(n)?'trust':'news')}</span><span><time>${date(n.date)}${FM_INBOX.isPending(n)?' · REQUIERE ATENCIÓN':''}</time><strong>${esc(n.title)}</strong></span>${icon('chevron')}</button>`).join('') || '<p class="muted">Las novedades del club aparecerán acá.</p>'}</div><button class="v-briefing-footer" data-view="professional">${icon('tactics')} Revisar dirección deportiva ${icon('arrow')}</button></section>`;
  }
  function agenda(next) {
    return `<section class="card v-agenda">${cardTitle('En el horizonte','Competiciones','tables')}<div class="v-agenda-list">${next.map(({event,game},index)=>{const rival=game.home===GameState.userClub.id?game.away:game.home;return `<button ${index===0?'data-view="match"':'data-world-club="'+esc(rival)+'"'} title="${index===0?'Preparar próximo partido':'Ver rival: '+esc(club(rival)?.nombre || rival)}"><time><b>${event.date.slice(8)}</b><small>${new Intl.DateTimeFormat('es-AR',{month:'short',timeZone:'UTC'}).format(new Date(event.date+'T12:00:00Z'))}</small></time>${FMUI.shield(rival,'small-shield')}<span><strong>${esc(club(rival)?.nombre || rival)}</strong><small>${game.home===GameState.userClub.id?'Local':'Visitante'} · ${esc(WORLD_ENGINE.competitionLabel(event))}</small></span>${icon('chevron')}</button>`}).join('') || '<p class="muted">Sin compromisos pendientes.</p>'}</div></section>`;
  }
  dashboard = function() {
    if(!active())return previousDashboard();
    const pending=(GameState.inbox||[]).filter(m=>FM_INBOX.isPending(m)).length,user=GameState.userClub,members=mine(),league=WORLD_ENGINE.league(GameState.world.userLeagueId),table=Object.values(WORLD_ENGINE.tableFor(league?.id)||{}).sort((a,b)=>b.pts-a.pts||(b.gf-b.gc)-(a.gf-a.gc)||b.gf-a.gf||String(club(a.id)?.nombre).localeCompare(String(club(b.id)?.nombre))),row=table.find(r=>r.id===user.id),place=table.indexOf(row)+1,next=upcoming();
    const condition=members.reduce((n,p)=>n+num(p.condicion_fisica),0)/Math.max(1,members.length),info=WORLD_CLOCK.info();
    return `<section class="v-dashboard" data-dashboard-panel="${ui.dashboard}"><header class="v-welcome"><div><span class="v-eyebrow">OFICINA DEL ENTRENADOR · ${esc(league?.country || '')}</span><h2>${info.slot===3?'Buenas noches':info.slot===2?'Buenas tardes':'Buen día'}, ${esc(GameState.manager.split(' ')[0])}<span>.</span></h2></div><button data-view="inbox" class="v-day-link">${icon('news')} ${pending?pending+' decisiones pendientes':'Bandeja al día'} ${icon('chevron')}</button></header><nav class="v-dashboard-tabs" aria-label="Paneles del inicio">${[['overview','Panorama'],['club','El club'],['agenda','Agenda y prensa']].map(([id,label])=>`<button data-v-dashboard="${id}" aria-pressed="${ui.dashboard===id}">${label}</button>`).join('')}</nav><div class="v-metrics"><button class="v-metric" data-view="tables"><span>${icon('trophy')}Posición en la liga</span><div><strong>${row?.pj?place+'º':'—'}</strong><small>${num(row?.pts)} puntos · ${num(row?.pj)} PJ</small></div><div class="v-metric-track"><i style="width:${row?.pj?100*(table.length-place+1)/Math.max(1,table.length):0}%"></i></div></button><button class="v-metric" data-view="professional"><span>${icon('trust')}Confianza directiva</span><div><strong>${pct(user.confianza_directiva)}<em>%</em></strong><small>${esc(user.objective)}</small></div><div class="v-metric-track"><i style="width:${pct(user.confianza_directiva)}%"></i></div></button><button class="v-metric v-gold" data-view="dressing-room"><span>${icon('users')}Presión de la hinchada</span><div><strong>${pct(user.presion_hinchada)}<em>%</em></strong><small>${user.presion_hinchada>70?'Exigencia alta':'Pulso de la tribuna'}</small></div><div class="v-metric-track"><i style="width:${pct(user.presion_hinchada)}%"></i></div></button><button class="v-metric" data-view="training"><span>${icon('heart')}Condición del plantel</span><div><strong>${pct(condition)}<em>%</em></strong><small>${members.length} jugadores</small></div><div class="v-metric-track"><i style="width:${pct(condition)}%"></i></div></button></div><div class="v-desk"><div class="v-desk-main">${matchHero(next[0])}<div class="v-club-panels">${readiness(members)}${leaders(members)}</div></div><div class="v-desk-rail">${leaguePanel(table,league)}${briefing()}</div></div>${agenda(next)}</section>`;
  };
  function enrichPlayers(root=document) {
    for(const button of root.querySelectorAll('table button[data-player]')) {
      if(button.querySelector('.v-player-initial'))continue;
      const p=player(button.dataset.player);if(!p)continue;
      const badge=document.createElement('span');badge.className='v-player-initial v-pos-'+p.posicion;badge.textContent=initials(p.nombre);badge.setAttribute('aria-hidden','true');button.prepend(badge);
    }
  }
  function contextStrip(host) {
    if(!['squad','market','scouting'].includes(view)||host.querySelector('.v-context'))return;
    const workspace=host.querySelector(':scope>.ws-workspace');if(!workspace)return;
    const members=mine(),user=GameState.userClub;
    let items;
    if(view==='squad')items=['POR','DEF','MED','DEL'].map((pos,i)=>({icon:'squad',label:['Arqueros','Defensores','Mediocampistas','Delanteros'][i],value:members.filter(p=>p.posicion===pos).length,extra:'en el primer equipo',tone:pos}));
    else if(view==='market')items=[{icon:'finances',label:'Caja disponible',value:cash(user.presupuesto_dolares),extra:'Saldo de la carrera'},{icon:'users',label:'Plantel profesional',value:`${members.length} / 40`,extra:'Inscripción independiente'},{icon:'market',label:'Negociaciones',value:(GameState.offers||[]).filter(o=>['pending','counter','player','accepted'].includes(o.status)).length,extra:'Consultá el estado en ofertas'},{icon:'calendar',label:'Ventana de pases',value:transferWindowOpen()?'Abierta':'Cerrada',extra:'Aplican las reglas de inscripción'}];
    else {const scouts=(FM_OFFICE.office()?.staff||[]).filter(e=>e.role==='Ojeador');items=[{icon:'scouting',label:'Equipo de ojeo',value:scouts.length,extra:'Ojeadores del club'},{icon:'trophy',label:'Ligas disponibles',value:GameState.world.leagues.length,extra:'Red de competiciones'},{icon:'users',label:'Plan del equipo',value:GameState.tactics.formation,extra:GameState.tactics.style}];}
    const strip=document.createElement('div');strip.className='v-context';strip.setAttribute('aria-label','Resumen de '+names[view]);strip.innerHTML=items.map(item=>`<div class="${item.tone?'v-pos-'+item.tone:''}">${icon(item.icon)}<span><small>${esc(item.label)}</small><strong>${esc(String(item.value))}</strong><em>${esc(item.extra)}</em></span></div>`).join('');
    const intro=workspace.querySelector(':scope>.fm-page-intro,:scope>.fm-section-head');if(intro)intro.after(strip);else workspace.prepend(strip);
  }
  function profileVisual(host) {
    if(view!=='player')return;
    const p=player(FM_PLAYER.state.id);if(!p)return;
    const monogram=host.querySelector('.fp-monogram');if(monogram&&!monogram.querySelector('.v-shirt'))monogram.innerHTML=shirt(p,true);
    const card=host.querySelector('.fp-rating-card');
    // The radar is limited to owned players: it never reveals unobserved attributes.
    if(!card||p.clubId!==GameState.userClub.id||card.querySelector('.v-radar'))return;
    const keys=['ritmo','tiro','pase','regate','defensa','fisico'],labels=['Ritmo','Tiro','Pase','Regate','Defensa','Físico'];
    const point=(i,r)=>[100+Math.sin(i*Math.PI/3)*r,94-Math.cos(i*Math.PI/3)*r];
    const polygon=r=>keys.map((_,i)=>point(i,r).join(',')).join(' ');
    const chart=document.createElement('figure');chart.className='v-radar';chart.setAttribute('aria-label','Atributos simulados del jugador');chart.innerHTML=`<svg viewBox="0 0 200 190" role="img" aria-label="${esc(keys.map((k,i)=>labels[i]+': '+num(p[k])).join(', '))}">${[20,40,60].map(r=>`<polygon class="v-radar-grid" points="${polygon(r)}"/>`).join('')}${keys.map((_,i)=>`<path class="v-radar-grid" d="M100 94L${point(i,60).join(' ')}"/>`).join('')}<polygon class="v-radar-values" points="${keys.map((k,i)=>point(i,60*clamp(num(p[k]),0,99)/99).join(',')).join(' ')}"/>${keys.map((k,i)=>{const [x,y]=point(i,81);return `<text x="${x}" y="${y}" text-anchor="middle">${labels[i]} ${num(p[k])}</text>`}).join('')}</svg><figcaption>Atributos simulados · escala 1–99</figcaption>`;card.querySelector('h2')?.after(chart);
  }
  function financeVisual(host) {
    if(view!=='finances'||FM_FINANCES.ui.tab!=='summary'||host.querySelector('.v-cash-chart'))return;
    const book=FM_FINANCES.account(),rows=book.ledger.filter(r=>r.kind==='cash').slice().reverse();
    const points=[{date:book.openingDate,cash:book.openingCash}];let balance=book.trackedCash-rows.reduce((n,r)=>n+r.amount,0);
    // The ledger may be compacted. Its retained interval starts at the reconciled balance.
    if(rows.length){points[0]={date:rows[0].date,cash:balance};for(const r of rows){balance+=r.amount;points.push({date:r.date,cash:balance});}}
    const min=Math.min(...points.map(p=>p.cash)),max=Math.max(...points.map(p=>p.cash)),span=max-min||Math.max(1,Math.abs(max)*.1);
    const coords=points.map((p,i)=>`${16+i*468/Math.max(1,points.length-1)},${76-(p.cash-min)*56/span}`).join(' ');
    const chart=document.createElement('section');chart.className='v-cash-chart';chart.innerHTML=`<div><span class="v-eyebrow">EVOLUCIÓN DE CAJA · USD</span><strong>${cash(book.trackedCash)}</strong><small>${rows.length?`${date(points[0].date)} → ${date(points.at(-1).date)} · movimientos registrados`:'El historial se construye al avanzar la carrera'}</small></div><svg viewBox="0 0 500 100" role="img" aria-label="${rows.length?'Saldo inicial del período '+cash(points[0].cash)+'; saldo final '+cash(book.trackedCash):'Sin movimientos registrados'}"><path d="M16 20H484M16 48H484M16 76H484"/><polyline points="${coords}"/>${points.length===1?'<circle cx="16" cy="76" r="3"/>':''}</svg>`;
    host.querySelector('.cf-body')?.prepend(chart);
  }
  function departments(host) {
    const week=host.querySelector('.dev-microcycle table');
    if(week&&!week.classList.contains('v-training-week')){
      week.classList.add('v-training-week');week.setAttribute('aria-label','Plan de entrenamiento de los próximos siete días');
      for(const row of week.querySelectorAll('tbody tr')){
        const cells=[...row.cells];if(cells.length!==4)continue;
        cells.forEach((cell,i)=>cell.dataset.label=['Fecha','Fase recomendada','Trabajo','Carga'][i]);
        row.dataset.load=cells[3].textContent.trim();
        const load=document.createElement('span');load.className='v-load-bars';load.setAttribute('aria-hidden','true');load.innerHTML='<i></i><i></i><i></i>';cells[3].prepend(load);
      }
    }
    const empty=host.querySelector('.fm-inbox-empty');
    if(empty&&!empty.querySelector('.v-empty-icon')){empty.classList.add('v-empty-inbox');empty.insertAdjacentHTML('afterbegin','<span class="v-empty-icon" aria-hidden="true">'+icon('news')+'</span>');}
    if(view==='scouting')for(const cell of host.querySelectorAll('tbody td[colspan]')){
      if(!cell.querySelector('button')&&/Seguí jugadores/.test(cell.textContent))cell.innerHTML='<div class="v-empty-state"><span class="v-empty-icon" aria-hidden="true">'+icon('scouting')+'</span><strong>Tu próximo refuerzo empieza acá</strong><p>Buscá jugadores, añadilos a seguimiento y encargá un informe a tu equipo de ojeo.</p><button data-view="market">Explorar el mercado '+icon('arrow')+'</button></div>';
    }
    if(view==='professional'&&GameState.world.proWorkspace?.tab==='club')for(const button of host.querySelectorAll('[data-pro-project]')){
      const article=button.closest('article');if(!article||article.querySelector('.v-investment-icon'))continue;
      const type=button.dataset.proProject,icons={stadium:'match',academy:'training',medical:'heart',scouting:'scouting'};
      article.classList.add('v-investment');article.insertAdjacentHTML('afterbegin',`<span class="v-investment-icon" aria-hidden="true">${icon(icons[type]||'trust')}</span>`);
    }
  }
  function decorate() {
    if(!active()){document.body.classList.add('v-design');return;}
    const shell=document.querySelector('.shell'),host=document.querySelector('#content');if(!shell||!host)return;
    document.body.classList.add('v-design');shell.dataset.visualView=view;
    const team=club(GameState.userClub.id);shell.style.setProperty('--club-primary',color(team?.color,'#345b89'));shell.style.setProperty('--club-secondary',color(team?.secondary,'#e5bd5d'));
    const heading=shell.querySelector('.fm-topbar h1');if(heading&&names[view])heading.textContent=names[view];
    for(const [id,name] of Object.entries(names))for(const b of shell.querySelectorAll('aside [data-view="'+id+'"]')) {
      b.title=name;
      if(navIcons[id])b.innerHTML=icon(navIcons[id])+`<span class="fm-nav-label">${esc(name)}</span>`;
      b.setAttribute('aria-current',view===id?'page':'false');
    }
    const nav=shell.querySelector('aside>.fm-nav');
    if(nav&&!nav.querySelector('.v-nav-label'))for(const [id,label] of [['dashboard','EL CLUB'],['squad','ÁREA DEPORTIVA'],['office','DIRECCIÓN']]) {
      const b=nav.querySelector('[data-view="'+id+'"]');if(b){const tag=document.createElement('span');tag.className='v-nav-label';tag.textContent=label;b.before(tag);}
    }
    enrichPlayers(host);contextStrip(host);profileVisual(host);financeVisual(host);departments(host);
    const advance=shell.querySelector('.fm-continue');if(advance&&advance.dataset.action==='continue'&&!GameState.match)advance.innerHTML='<span>Continuar</span>'+icon('arrow');
    const pro=host.querySelector('.pro-heading');if(pro&&!pro.querySelector('.v-section-icon'))pro.insertAdjacentHTML('afterbegin',`<span class="v-section-icon" aria-hidden="true">${icon('tactics')}</span>`);
    for(const [i,tab] of [...host.querySelectorAll('.pro-tabs button')].entries())if(!tab.querySelector('svg'))tab.insertAdjacentHTML('afterbegin',icon(['trust','trophy','market','scouting','training','users','tactics','news','calendar'][i]));
  }
  render=function(){previousRender();decorate();};
  document.addEventListener('click',event=>{
    const message=event.target.closest('[data-v-message]');if(message){FM_INBOX.ensure();Object.assign(GameState.world.inboxUI,{selected:Number(message.dataset.vMessage),filter:'all',category:'all',query:'',reportOpen:null});FM_INBOX.markRead(Number(message.dataset.vMessage));FM_WORKSPACE.ui.tabs['inbox-mobile']='reading';view='inbox';render();return;}
    const b=event.target.closest('[data-v-dashboard]');if(!b)return;ui.dashboard=b.dataset.vDashboard;render();document.querySelector('[data-v-dashboard="'+ui.dashboard+'"]')?.focus({preventScroll:true});
  });
  // The inbox changes its reading layout at this breakpoint, rather than on every resize.
  matchMedia('(max-width:650px)').addEventListener('change',()=>{if(active()&&view==='inbox')render();});
  return {decorate,enrichPlayers,shirt,ring,ui};
})();
