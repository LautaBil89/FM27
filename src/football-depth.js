/* Career-only estimates and decisions. All real identities remain in the embedded database. */
window.FM_DEPTH=(()=>{
  const DAY=86400000,ui={tab:'priorities',position:'ALL',age:40,budget:1e9,compare:[],notice:''};
  const active=()=>GameState?.worldVersion===1;
  const hash=s=>{let h=0;for(const c of String(s))h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;return h};
  const addDays=(s,n)=>new Date(Date.parse(s+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
  const names={contender:'Competir por títulos',academy:'Desarrollar y vender',balance:'Equilibrar las cuentas'};
  function ensure(){
    if(!active())return null;
    const s=GameState.world.depth??={version:1,projects:{},reports:{},jobs:[],stints:[],honours:[],reviews:[],preferences:{},lastDay:GameState.today};
    s.projects??={};s.reports??={};s.jobs??=[];s.stints??=[];s.honours??=[];s.reviews??=[];s.rivalBids??=[];s.relationships??={};s.preferences??={};if(s!==ui.loaded){Object.assign(ui,s.preferences.scouting||{});ui.loaded=s;}
    if(!s.stints.length)s.stints.push({clubId:GameState.userClub.id,start:GameState.today,end:null});
    return s;
  }
  function project(id){
    const s=ensure();if(!s)return null;
    if(!s.projects[id]){const c=club(id),h=hash(id),rep=c?.reputation||c?.rating||60;
      s.projects[id]={policy:rep>=82?'contender':h%3===0?'balance':'academy',academy:['Técnica','Físico','Defensa'][h%3],manager:1,appointments:[],lastReview:null};}
    return s.projects[id];
  }
  function projectScore(p,id){
    const policy=project(id).policy,e=CLUB_AI.economy(id),cash=id===GameState.userClub.id?e.presupuesto_dolares:e.cash;
    const age=p.edad,upside=Math.max(0,(p.potential||overall(p))-overall(p));
    return policy==='academy'?(age<=23?6+Math.min(6,upside*.5):age>29?-9:-1):policy==='balance'?(p.valor_mercado>cash*.3?-12:3)+(age>32?-4:0):age>=24&&age<=31?5:age<21?-3:0;
  }
  function continental(id){return Object.values(GameState.world.cups||{}).some(c=>c.participants?.includes(id))}
  function personal(p,offer){
    const id=offer.toClub||GameState.userClub.id,e=CLUB_AI.economy(id),rep=id===GameState.userClub.id?e.reputacion:e.reputation;
    const former=CLUB_AI.economy(p.clubId),origin=(p.clubId===GameState.userClub.id?former?.reputacion:former?.reputation)||club(p.clubId)?.reputation||club(p.clubId)?.rating||60,role=offer.playingTime||'Rotación';
    const group=squad(id).filter(q=>q.posicion===p.posicion).sort((a,b)=>overall(b)-overall(a));
    const rank=group.filter(q=>overall(q)>overall(p)).length,slots={POR:1,DEF:4,MED:3,DEL:3}[p.posicion];
    const rivals=(GameState.world.ai?.competition?.filter(r=>r.playerId===p.id&&r.date>=addDays(GameState.today,-21)).length||0)+ensure().rivalBids.filter(b=>b.playerId===p.id&&b.status==='open'&&b.expires>=GameState.today).length;
    const relation=id===GameState.userClub.id?GameState.world.dressingRoom?.players?.[p.id]?.trust??ensure().relationships[p.id]?.trust??60:60;
    const reasons=[],gap=Math.max(0,origin-rep-8);let factor=1.05+gap*.012+(rivals? .08:0)+(relation<40?.12:0);
    if(gap)reasons.push('La reputación del destino es inferior a la de su club actual');
    if(rivals)reasons.push('Recibió interés competitivo reciente');
    if(continental(id)){factor-=.05;reasons.push('Le atrae disputar una copa continental')}
    if(role==='Titular'){factor-=.06;reasons.push('Valora el compromiso de titularidad')}
    if(role==='Proyecto'&&p.edad>26){factor+=.18;reasons.push('Busca un papel mayor que el de proyecto')}
    if(role==='Proyecto'&&p.edad<=23){factor-=.03;reasons.push('Acepta un proyecto de desarrollo')}
    if(relation<40)reasons.push('La relación con el DT exige una compensación');
    const refuse=offer.stage==='player'&&role==='Titular'&&rank>=slots+3?'No cree en la promesa de titularidad: hay demasiados jugadores de su puesto por delante':offer.stage==='player'&&gap>30&&role==='Proyecto'&&p.edad>=24?'No acepta bajar tanto de nivel sin un papel importante':'';
    return {wage:Math.max(100,Math.ceil(p.salario*Math.max(.98,factor)/100)*100),reasons,refuse,role,rank};
  }
  function inviteRival(p,offer){
    if(offer.dealType==='loan'||!p.clubId)return null;const s=ensure();if(s.rivalBids.some(b=>b.offerId===offer.id))return null;
    const interest=CLUB_AI.interestFor(p.id).find(c=>c.score>=12&&CLUB_AI.availableBudget(c.id)>=Math.max(c.offer,offer.fee)+c.wage*4);
    if(!interest)return null;
    const bid={id:'rival-'+offer.id,offerId:offer.id,playerId:p.id,fromClub:p.clubId,toClub:interest.id,fee:Math.max(interest.offer,offer.fee),wage:interest.wage,bonus:interest.wage*4,years:p.edad<28?3:2,releaseClause:Math.max(p.clausula_rescision,p.valor_mercado*1.2),type:'buy',dealType:'permanent',playingTime:'Rotación',date:GameState.today,expires:addDays(GameState.today,7),status:'open'};
    s.rivalBids.unshift(bid);s.rivalBids=s.rivalBids.slice(0,40);
    MANAGEMENT.addMessage('Otro club presenta condiciones',`${club(bid.toClub).nombre} propone ${money(bid.wage)} semanales a ${p.nombre}. Comparará el proyecto y el rol con tu contrato. La propuesta rival está sujeta a fondos y vence el ${bid.expires}.`,'mercado',{playerId:p.id,offerId:offer.id,action:'offer'});return bid;
  }
  function choiceScore(p,o){const e=CLUB_AI.economy(o.toClub),rep=o.toClub===GameState.userClub.id?e.reputacion:e.reputation;return rep+Math.min(24,(o.wage/Math.max(100,p.salario)-1)*12)+(continental(o.toClub)?5:0)+(o.playingTime==='Titular'?8:o.playingTime==='Proyecto'?(p.edad<24?2:-8):3)}
  function chooseRival(p,offer){const bid=ensure().rivalBids.find(b=>b.offerId===offer.id&&b.status==='open'&&b.expires>=GameState.today);if(!bid||choiceScore(p,bid)<=choiceScore(p,offer)+8)return null;const result=MARKET_CONTRACTS.executeTransfer({...bid,status:undefined});if(!result.ok){bid.status='unavailable';return null}bid.status='accepted';return `Eligió el proyecto de ${club(bid.toClub).nombre}, con ${money(bid.wage)} semanales y un papel de rotación`}
  function knowledge(p){
    if(p.clubId===GameState.userClub.id)return {level:100,spread:0,label:'Conocido por tu cuerpo técnico'};
    const r=ensure().reports[p.id],legacy=GameState.scouting.reports?.[p.id];
    if(!r&&legacy)return {level:100,spread:0,label:'Informe previo conservado'};
    const stale=r?.completed?Math.max(0,Math.floor((Date.parse(GameState.today)-Date.parse(r.updated))/(30*DAY)))*10:0;
    const level=Math.max(15,(r?.level||15)-Math.min(45,stale));
    return {level,spread:level>=100?0:Math.ceil((100-level)/7),label:level>=100?'Evaluación completa':r?.status==='active'?'Observación en curso':'Conocimiento parcial'};
  }
  function range(p,value=overall(p),scale=99){const k=knowledge(p),spread=Math.ceil(k.spread*scale/99);return spread?`${Math.max(1,Math.round(value)-spread)}–${Math.min(scale,Math.round(value)+spread)}`:String(Math.round(value))}
  function scout(id){
    const p=player(Number(id)),s=ensure();if(!p||locked()||!s)return false;
    if(p.clubId===GameState.userClub.id){toast('Tu cuerpo técnico ya conoce a este jugador');return false}
    if(s.reports[p.id]?.status==='active'){toast('La observación ya está en marcha');return false}
    if(Object.values(s.reports).filter(r=>r.status==='active').length>=5){toast('Los cinco ojeadores están ocupados');return false}
    if(CLUB_AI.availableBudget()<1500){toast('No alcanza el presupuesto del informe');return false}
    if(knowledge(p).level>=100){toast('El informe está actualizado; no hace falta otra observación');return false}
    MANAGEMENT.transaction(-1500,`Observación de siete días: ${p.nombre}`,'ojeo');
    const prior=knowledge(p).level;s.reports[p.id]={level:prior,status:'active',started:GameState.today,updated:GameState.today,days:0,completed:false};
    if(!GameState.scouting.shortlist.includes(p.id))GameState.scouting.shortlist.push(p.id);
    MANAGEMENT.addMessage('Observación iniciada',`${p.nombre}: primer informe en dos días, seguimiento en cuatro y evaluación completa en siete. Costo total USD 1.500.`,'ojeo',{playerId:p.id,action:'scout'});
    saveGame(true);render();return true;
  }
  function progress(day){
    const s=ensure();if(!s||s.lastDay>=day)return false;s.lastDay=day;
    for(const [id,r]of Object.entries(s.reports)){
      if(r.status!=='active')continue;const p=player(Number(id));if(!p){r.status='cancelled';continue}
      const elapsed=Math.floor((Date.parse(day)-Date.parse(r.started))/DAY),level=elapsed>=7?100:elapsed>=4?70:elapsed>=2?40:r.level;
      if(level<=r.level)continue;r.level=level;r.updated=day;r.days=elapsed;
      const verdict=fit(p);GameState.scouting.reports[id]={date:day,rating:range(p),potential:range(p,p.potential||overall(p)),verdict:`Conocimiento ${level}% · ${verdict.label}`,risk:p.injury?'Lesión activa':p.edad>31?'Revisar horizonte deportivo':'Sin alerta médica actual'};
      if(level===100){r.completed=true;r.status='complete'}
      MANAGEMENT.addMessage(level===100?'Evaluación completa':'Avance de observación',`${p.nombre}: conocimiento ${level}%, calidad ${range(p)}, potencial ${range(p,p.potential||overall(p))}. ${verdict.label}.`,'ojeo',{playerId:p.id,action:'scout'});
    }
    return true;
  }
  function fit(p){const group=mine().filter(q=>q.posicion===p.posicion),quality=group.length?group.reduce((n,q)=>n+overall(q),0)/group.length:45,k=knowledge(p),delta=overall(p)-quality;return {label:k.level<40?'Falta observación para recomendar':delta>4?'Mejora probable del puesto':delta>=-3?'Alternativa de rotación':'No mejora la cobertura actual',score:Math.round(delta),cost:p.valor_mercado+p.salario*52}}
  function scouting(){
    const list=GameState.scouting.shortlist.map(player).filter(Boolean).filter(p=>(ui.position==='ALL'||p.posicion===ui.position)&&p.edad<=ui.age&&fit(p).cost<=ui.budget);
    const chosen=ui.compare.map(player).filter(Boolean);
    return `<div class="fm-section-head"><h2>Red de ojeo</h2><button data-view="market">Buscar jugadores</button></div><div class="depth-controls"><select data-depth-filter="position" aria-label="Puesto de ojeo">${['ALL','POR','DEF','MED','DEL'].map(p=>`<option ${p===ui.position?'selected':''}>${p}</option>`).join('')}</select><select data-depth-filter="age" aria-label="Edad máxima">${[21,25,30,40].map(n=>`<option value="${n}" ${n===ui.age?'selected':''}>Hasta ${n} años</option>`).join('')}</select><select data-depth-filter="budget" aria-label="Costo máximo anual">${[1e6,5e6,20e6,1e9].map(n=>`<option value="${n}" ${n===ui.budget?'selected':''}>${n===1e9?'Cualquier costo':money(n)+' primer año'}</option>`).join('')}</select><span class="small">${Object.values(ensure().reports).filter(r=>r.status==='active').length}/5 observadores ocupados</span></div><div class="card depth-scout"><h2>Candidatos y seguimiento</h2><div class="scroll"><table><thead><tr><th>Jugador</th><th>Conocimiento</th><th>Calidad / potencial</th><th>Encaje</th><th>Costo primer año</th><th>Acciones</th></tr></thead><tbody>${list.map(p=>`<tr><td><button data-player="${p.id}">${esc(p.nombre)}</button><small>${p.posicion} · ${p.edad} años</small></td><td>${knowledge(p).level}% · ${knowledge(p).label}</td><td>${range(p)} / ${range(p,p.potential||overall(p))}</td><td>${fit(p).label}</td><td>${money(fit(p).cost)}<small>Pase estimado + 52 salarios; sin primas</small></td><td><button data-scout="${p.id}">Observar</button><button data-depth-compare="${p.id}">${ui.compare.includes(p.id)?'Quitar':'Comparar'}</button><button data-buy="${p.id}">Negociar</button></td></tr>`).join('')||'<tr><td colspan="6">Seguí jugadores desde el mercado o cambiá los filtros.</td></tr>'}</tbody></table></div></div><div class="card depth-scout"><h2>Comparación de candidatos</h2>${chosen.length?`<div class="scroll"><table><thead><tr><th>Jugador</th><th>Puesto</th><th>Calidad</th><th>Potencial</th><th>Salario</th><th>Encaje</th></tr></thead><tbody>${chosen.map(p=>`<tr><td>${esc(p.nombre)}</td><td>${p.posicion}</td><td>${range(p)}</td><td>${range(p,p.potential||overall(p))}</td><td>${money(p.salario)}</td><td>${fit(p).label}</td></tr>`).join('')}</tbody></table></div>`:'<p>Seleccioná hasta tres candidatos para comparar costo y encaje con la misma información disponible.</p>'}</div>`;
  }
  function analysis(m=GameState.match){
    if(!m)return [];
    const shots=(m.chances||[]).filter(c=>c.type!=='VAR'),own=shots.filter(c=>c.side===m.userSide),opp=shots.filter(c=>c.side!==m.userSide),sum=a=>a.reduce((n,c)=>n+Number(c.xg||0),0);
    const rows=[{text:`Ocasiones: ${own.length}–${opp.length}; xG ${sum(own).toFixed(2)}–${sum(opp).toFixed(2)}.`,evidence:'Registros de remates del motor',action:null}];
    if(m.minute<15||shots.length<3)rows.push({text:'Todavía hay poca evidencia. Esperá antes de modificar el plan.',evidence:`${m.minute} minutos disputados`,action:null});
    else {
      if(sum(opp)>sum(own)+.5)rows.push({text:'El rival está creando más peligro. Bajá la línea y protegé espacios.',evidence:`Diferencia de xG ${(sum(opp)-sum(own)).toFixed(2)}`,action:'protect'});
      if(own.length>=3&&sum(own)/own.length<.12)rows.push({text:'Rematás desde situaciones de poca calidad. Reducí el ritmo y buscá una ocasión más clara.',evidence:`xG medio por tiro ${(sum(own)/own.length).toFixed(2)}`,action:'patient'});
      const tired=(m.lineups[m.userSide]||[]).map(player).filter(p=>p&&p.condicion_fisica<55);
      if(tired.length)rows.push({text:`Revisá los cambios: ${tired.map(p=>p.nombre).join(', ')} tienen menos de 55% de condición.`,evidence:'Condición actual de los jugadores en cancha',action:null});
      const attackers=(m.lineups[m.userSide]||[]).map(player).filter(p=>p?.posicion==='DEL'),isolated=attackers.filter(p=>!own.some(c=>c.playerId===p.id));
      if(m.minute>=35&&isolated.length)rows.push({text:`${isolated.map(p=>p.nombre).join(', ')} no registran remates. Revisá sus roles y el enlace con el mediocampo.`,evidence:'Participación en remates; no mide pases recibidos',action:null});
    }
    return rows;
  }
  function analysisHTML(){return `<div class="card depth-analysis"><h2>Lectura del ayudante</h2><div class="scroll">${analysis().map(r=>`<article class="depth-row"><p>${esc(r.text)}</p><small>${esc(r.evidence)}</small>${r.action?`<button data-depth-adjust="${r.action}">Aplicar sugerencia</button>`:''}</article>`).join('')}<p class="small muted">No se registran zonas de pases o pérdidas: el informe utiliza remates, xG y condición disponibles.</p></div></div>`}
  function adjust(kind){const m=GameState.match;if(!m||m.done||!['protect','patient'].includes(kind))return false;m.paused=true;if(kind==='protect'){GameState.tactics.line=35;GameState.tactics.mentality='Cauta'}else GameState.tactics.tempo=40;log(`📋 El DT aplica la sugerencia del ayudante: ${kind==='protect'?'proteger espacios':'elaborar con paciencia'}.`);saveGame(true);render();return true}
  function youth(c,p){const a=project(c.id).academy;for(const key of a==='Técnica'?['pase','regate']:a==='Físico'?['ritmo','fisico']:['defensa','fisico'])p[key]=clamp(p[key]+3,1,99);p.academyOrigin={clubId:c.id,style:a,year:GameState.year};return p}
  function seasonReview(){
    const s=ensure(),h=GameState.history[0];if(!h||!GameState.finished||s.reviews.some(r=>r.year===h.year))return;
    const user=GameState.userClub.id,formats=h.sportingFormats,won=[];
    if(formats&&['ARG1','ARG2'].includes(h.leagueId||GameState.world.userLeagueId)){for(const [name,id]of Object.entries(formats.champions||{}))if(id===user)won.push(name);if(formats.nacionalChampion===user)won.push('Primera Nacional')}
    else if(h.champion===user)won.push(WORLD_ENGINE.userLeague().name);
    if(h.cup===user)won.push('Libertadores');if(h.sudCup===user)won.push('Sudamericana');
    const titlePrizes=won.length*mine().filter(p=>(p.appearances||0)>0).reduce((n,p)=>n+(p.contractBonuses?.title||0),0);if(titlePrizes)MANAGEMENT.transaction(-titlePrizes,'Primas por títulos de la temporada','primas');
    for(const title of won)s.honours.push({year:h.year,clubId:user,title});s.honours=s.honours.slice(-80);
    const dismissed=GameState.userClub.confianza_directiva<20&&!h.objectiveMet;
    s.reviews.push({year:h.year,clubId:user,position:h.position,success:h.objectiveMet,dismissed});s.reviews=s.reviews.slice(-30);
    const rep=GameState.userClub.reputacion+(h.objectiveMet?5:-5),candidates=GameState.world.clubs.filter(c=>c.id!==user).sort((a,b)=>{const da=Math.abs((a.reputation||a.rating)-rep),db=Math.abs((b.reputation||b.rating)-rep);return (da>=18)-(db>=18)||(da>=18?da-db:hash(h.year+a.id)-hash(h.year+b.id))}).slice(0,3);
    s.jobs=candidates.map(c=>({clubId:c.id,year:h.year,status:'open',objective:(c.reputation||c.rating)>=80?'Salir Campeón':c.leagueId==='ARG2'?'Lograr el ascenso':'Terminar en la mitad superior'}));
    s.dismissed=dismissed;
    MANAGEMENT.addMessage(dismissed?'La directiva finaliza tu ciclo':'Propuestas para tu carrera',dismissed?'La confianza cayó por debajo de 20 y no cumpliste el objetivo. Elegí un proyecto en Carrera para continuar el próximo año.':'Otros clubes te ofrecen iniciar un proyecto la próxima temporada. Podés seguir en tu club o aceptar una propuesta en Carrera.','directiva',{action:'career'});
    for(const c of GameState.world.clubs){const p=project(c.id);if(p.lastReview===h.year)continue;p.lastReview=h.year;const rank=h.worldRankings?.[c.leagueId]||[],place=rank.indexOf(c.id)+1;
      if(c.id!==user&&place>rank.length*.75&&p.policy==='contender'){p.manager++;p.appointments.push({year:h.year,reason:'Rendimiento por debajo del proyecto'});p.appointments=p.appointments.slice(-8);const e=CLUB_AI.economy(c.id);e.mentality='Equilibrada';e.pressing=60}
      if(CLUB_AI.cash(c.id)<CLUB_AI.wageBill(c.id)*8)p.policy='balance';
    }
  }
  function acceptJob(id){const s=ensure(),j=s.jobs.find(j=>j.clubId===id&&j.status==='open'&&j.year===GameState.year);if(!GameState.finished||!j||locked())return false;s.nextClub=id;for(const offer of s.jobs)offer.status=offer===j?'accepted':'declined';ui.notice='Proyecto aceptado. El cambio se concreta al iniciar la próxima temporada.';saveGame(true);render();return true}
  function switchClub(id){
    const s=ensure(),c=club(id),e=CLUB_AI.economy(id),old=GameState.userClub;if(!c||id===old.id)return false;
    Object.assign(CLUB_AI.ensure().clubs[old.id],{cash:old.presupuesto_dolares,wageBudget:old.wageBudget,reputation:old.reputacion});
    const stint=s.stints.at(-1);if(stint)stint.end=GameState.today;s.stints.push({clubId:id,start:GameState.today,end:null});s.stints=s.stints.slice(-30);
    GameState.userClub={...structuredClone(c),presupuesto_dolares:e.cash,presupuesto_pesos:e.cash*FX,wageBudget:e.wageBudget,reputacion:e.reputation,confianza_directiva:65,presion_hinchada:35,cupos_extranjeros_usados:0,ticketPrice:18,objective:s.jobs.find(j=>j.clubId===id)?.objective||'Terminar en la mitad superior'};
    GameState.world.userLeagueId=c.leagueId;GameState.world.dressingRoom=null;GameState.finance={ledger:[],openingBalance:e.cash,seasonIncome:0,seasonExpense:0};GameState.scouting.shortlist=[];GameState.tactics.xi=[];GameState.tactics.bench=[];GameState.tactics.roles={};GameState.transferListed=[];
    WORLD_ENGINE.hydrate(GameState);WORLD_ENGINE.reindex();autoLineup();WORLD_ENGINE.seekUserFixture();s.nextClub=null;s.dismissed=false;return true;
  }
  const oldNext=nextSeason;
  nextSeason=function(){if(!active())return oldNext();const s=ensure();seasonReview();if(s.dismissed&&!s.nextClub){view='career';render();return toast('Elegí un nuevo proyecto para continuar tu carrera')};const id=s.nextClub,year=GameState.year;oldNext();if(id&&GameState.year>year){switchClub(id);view='career';saveGame(true);render()}};
  actions.season=()=>nextSeason();
  function priorities(){const list=[],s=ensure();for(const o of GameState.offers.filter(o=>o.status==='pending'&&o.awaitingUser))list.push({label:o.awaitingPlayerTerms?`Negociar contrato: ${player(o.playerId)?.nombre}`:`Responder oferta: ${player(o.playerId)?.nombre}`,view:'market'});const injuries=mine().filter(p=>p.injury||p.ban);if(injuries.some(p=>GameState.tactics.xi.includes(p.id)))list.push({label:'Hay bajas en el once titular',view:'tactics'});for(const p of mine().filter(p=>p.contract<=GameState.year&&!p.loanId).slice(0,3))list.push({label:`Vence este año: ${p.nombre}`,playerId:p.id});if(s.jobs.some(j=>j.status==='open'))list.push({label:'Propuestas de trabajo pendientes',view:'career'});return list.slice(0,12)}
  function career(){const s=ensure(),p=project(GameState.userClub.id),projects=GameState.world.clubs.filter(c=>c.leagueId===GameState.world.userLeagueId);return `<div class="fm-page-intro"><div><h2>Carrera y proyectos</h2><p>Trayectoria de ${esc(GameState.manager)} · decisiones de esta simulación</p></div></div><div class="card"><h2>Prioridades</h2>${ui.notice?`<p role="status">${esc(ui.notice)}</p>`:''}${priorities().map(r=>`<div class="depth-row"><span>${esc(r.label)}</span><button ${r.playerId?`data-player="${r.playerId}"`:`data-depth-open="${r.view}"`}>Resolver</button></div>`).join('')||'<p>No hay decisiones urgentes.</p>'}<h3>Proyecto actual</h3><p>${names[p.policy]} · cantera: ${p.academy}.</p>${s.dismissed?'<p class="red">Tu ciclo terminó. Elegí una propuesta para la próxima temporada.</p>':''}</div><div class="card"><h2>Ofertas laborales</h2>${s.jobs.map(j=>`<div class="depth-row"><div><b>${esc(club(j.clubId)?.nombre)}</b><p>${esc(j.objective)} · ${j.status==='open'?'Disponible hasta comenzar el próximo año':j.status==='accepted'?'Aceptada':'Descartada'}</p></div>${j.status==='open'?`<button data-depth-job="${esc(j.clubId)}">Aceptar proyecto</button>`:''}</div>`).join('')||'<p>Las propuestas llegan al cierre de temporada según tu nivel y resultados.</p>'}${GameState.finished?'<button data-action="season" class="primary">Iniciar próxima temporada</button>':''}</div><div class="card"><h2>Trayectoria y títulos</h2><div class="scroll">${s.stints.map(r=>`<p>${esc(club(r.clubId)?.nombre)} · ${r.start} — ${r.end||'actualidad'}</p>`).join('')}${s.honours.map(r=>`<p>🏆 ${r.year} · ${esc(r.title)} · ${esc(club(r.clubId)?.nombre)}</p>`).join('')||'<p>Todavía no hay títulos registrados en esta etapa de tu carrera.</p>'}${s.reviews.map(r=>`<p>${r.year}: puesto ${r.position} · ${r.success?'objetivo cumplido':'objetivo pendiente'}</p>`).join('')}</div></div><div class="card"><h2>Proyectos de la liga</h2><div class="scroll"><table><thead><tr><th>Club</th><th>Política</th><th>Cantera</th><th>DT de la carrera</th></tr></thead><tbody>${projects.map(c=>{const r=project(c.id);return `<tr><td>${esc(c.nombre)}</td><td>${names[r.policy]}</td><td>${r.academy}</td><td>${c.id===GameState.userClub.id?esc(GameState.manager):'Ciclo '+r.manager}</td></tr>`}).join('')}</tbody></table></div></div>`}
  function decorate(){
    if(!active())return;const state=ensure();for(const [id,r]of Object.entries(GameState.world.dressingRoom?.players||{}))state.relationships[id]={trust:r.trust,date:GameState.today};const relations=Object.entries(state.relationships);if(relations.length>400)state.relationships=Object.fromEntries(relations.sort((a,b)=>b[1].date.localeCompare(a[1].date)).slice(0,400));seasonReview();
    const intro=document.querySelector('#content .fm-page-intro');if(intro&&view==='dashboard'){const b=document.createElement('button');b.dataset.view='career';b.className='depth-attention';b.textContent=`${priorities().length} decisiones pendientes · revisar`;intro.append(b)}
    const form=document.querySelector('#negotiation[data-stage="player"]');if(form&&!form.querySelector('.depth-agent')){const p=player(Number(form.dataset.playerId)),o=GameState.offers.find(o=>o.id===form.dataset.offerId),r=personal(p,{...o,playingTime:form.elements.playingTime.value});const note=document.createElement('p');note.className='nw-note depth-agent';const rival=ensure().rivalBids.find(b=>b.offerId===o.id&&b.status==='open'&&b.expires>=GameState.today);note.textContent=`Representante: ${r.reasons.join('. ')||'Valora la estabilidad del contrato'}. Referencia salarial: ${money(r.wage)}/semana.${rival?' Propuesta rival: '+club(rival.toClub).nombre+' · '+money(rival.wage)+'/semana.':''}`;form.querySelector('[data-nw-pane="terms"]').append(note)}
  }
  document.addEventListener('click',e=>{if(!active())return;const purchase=e.target.closest('[data-depth-purchase]');if(purchase){const result=MARKET_CONTRACTS.purchaseLoan(purchase.dataset.depthPurchase);if(!result.ok)toast(result.reason)}const cmp=e.target.closest('[data-depth-compare]');if(cmp){const id=Number(cmp.dataset.depthCompare);if(ui.compare.includes(id))ui.compare=ui.compare.filter(n=>n!==id);else if(ui.compare.length<3)ui.compare.push(id);else toast('Compará hasta tres jugadores a la vez');ensure().preferences.scouting={...(ensure().preferences.scouting||{}),compare:[...ui.compare]};saveGame(true);render()}const job=e.target.closest('[data-depth-job]');if(job)acceptJob(job.dataset.depthJob);const adjuster=e.target.closest('[data-depth-adjust]');if(adjuster)adjust(adjuster.dataset.depthAdjust);const open=e.target.closest('[data-depth-open]');if(open){view=open.dataset.depthOpen;if(view==='market')FM_WORKSPACE.ui.tabs.market='offers';render()}});
  document.addEventListener('change',e=>{const key=e.target.dataset.depthFilter;if(key){ui[key]=key==='position'?e.target.value:Number(e.target.value);ensure().preferences.scouting={position:ui.position,age:ui.age,budget:ui.budget,compare:[...ui.compare]};saveGame(true);render()}const f=e.target.closest('#negotiation');if(f&&e.target.name==='playingTime'){f.querySelector('.depth-agent')?.remove();decorate()}});
  return {ensure,project,projectScore,personal,inviteRival,chooseRival,choiceScore,knowledge,range,scout,progress,fit,scouting,analysis,analysisHTML,adjust,youth,seasonReview,acceptJob,switchClub,priorities,career,decorate,ui};
})();
