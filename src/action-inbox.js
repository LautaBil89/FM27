/* Bandeja del entrenador: decisiones respaldadas por el estado de la carrera. */
window.FM_INBOX = (() => {
  const legacyInbox = window.inboxView, legacyRender = render;
  const categories = {mercado:'Mercado',contratos:'Contratos',ojeo:'Ojeo',plantel:'Plantel',partidos:'Partidos',directiva:'Directiva',sistema:'Sistema',prensa:'Prensa'};
  const supported = new Set(['sale','offer','scout','contract','tactics','medical','match','finance','recovery','career']);
  const active = () => !!GameState?.world && GameState.version === 3;
  const owned = p => !!p && p.clubId === GameState.userClub.id;
  const lookup = id => Number.isSafeInteger(Number(id)) ? player(Number(id)) : null;
  const offerFor = message => GameState.offers.find(o => String(o.id) === String(message.offerId));
  const clubName = id => GameState.world.clubs.find(c => c.id === id)?.nombre || 'Club';
  const category = m => ['medico','médico','lesion','lesión','entrenamiento'].includes(m.type) ? 'plantel' : m.action==='match' ? 'partidos' : categories[m.type] ? m.type : 'prensa';
  const identifier = m => `message-${m.id}`;
  let pushing = false;

  function ui() {
    if(!GameState.world.inboxUI||typeof GameState.world.inboxUI!=='object'||Array.isArray(GameState.world.inboxUI))GameState.world.inboxUI={selected:null,filter:'all',category:'all',query:'',lastAlertDay:null};
    const s=GameState.world.inboxUI;
    if (!['all','pending','unread'].includes(s.filter)) s.filter='all';
    if (s.category!=='all'&&!categories[s.category]) s.category='all';
    if (typeof s.query!=='string') s.query='';
    s.query=s.query.slice(0,120);
    return s;
  }
  function push(message) {
    if (!active() || !message || typeof message.title!=='string' || typeof message.body!=='string') return null;
    GameState.inbox ??= [];
    const sourceKey = typeof message.sourceKey==='string' ? message.sourceKey.slice(0,150) : null;
    if (sourceKey) { const previous=GameState.inbox.find(m=>m.sourceKey===sourceKey);if(previous)return previous; }
    GameState.nextMessageId=Math.max(Number.isSafeInteger(GameState.nextMessageId)?GameState.nextMessageId:1,...GameState.inbox.map(m=>(Number.isSafeInteger(m.id)?m.id:0)+1));
    const m={id:GameState.nextMessageId++,title:message.title.slice(0,1000),body:message.body.slice(0,12000),type:typeof message.type==='string'?message.type.slice(0,30):'club',date:/^\d{4}-\d{2}-\d{2}$/.test(message.date||'')?message.date:GameState.today,read:false};
    if(sourceKey)m.sourceKey=sourceKey;
    if(supported.has(message.action))m.action=message.action;
    if(lookup(message.playerId))m.playerId=Number(message.playerId);
    if(typeof message.offerId==='string'||Number.isSafeInteger(message.offerId))m.offerId=String(message.offerId).slice(0,160);
    for(const key of ['contractAtCreation','issue','matchDate'])if(typeof message[key]==='string'||Number.isSafeInteger(message[key]))m[key]=message[key];
    GameState.inbox.unshift(m);GameState.inbox=GameState.inbox.slice(0,150);return m;
  }
  function onMessage(message) {
    if(!active()||!message)return;
    if(supported.has(message.action)&&!message.sourceKey&&message.offerId)message.sourceKey=`offer:${message.offerId}`;
  }
  function lineupNeedsAttention() {
    const ids=GameState.tactics?.xi||[];
    return ids.length!==11 || new Set(ids).size!==11 || ids.some(id=>!owned(lookup(id))||!available(lookup(id)));
  }
  function refreshAlerts(force=false) {
    if(!active())return;
    const settings=ui();
    if(!force&&settings.lastAlertDay===GameState.today)return;
    settings.lastAlertDay=GameState.today;
    const members=mine(),month=GameState.today.slice(0,7);
    const important=members.filter(p=>!p.loanId&&Number.isInteger(p.contract)&&p.contract<=GameState.year+1).sort((a,b)=>a.contract-b.contract||overall(b)-overall(a)).slice(0,8);
    for(const p of important) {
      if(GameState.inbox.some(m=>m.action==='contract'&&m.playerId===p.id&&m.contractAtCreation===p.contract&&!m.dismissed))continue;
      push({title:`Revisar contrato: ${p.nombre}`,body:`El vínculo termina en diciembre de ${p.contract}. Su salario es ${money(p.salario)} por semana. Podés renovar desde este mensaje; revisá la prima y el margen salarial antes de firmar.`,type:'contratos',action:'contract',playerId:p.id,contractAtCreation:p.contract,sourceKey:`contract:${p.id}:${p.contract}:${month}`});
    }
    for(const p of members.filter(p=>p.injury>0||p.condicion_fisica<65).sort((a,b)=>b.injury-a.injury||a.condicion_fisica-b.condicion_fisica).slice(0,4)) {
      if(GameState.inbox.some(m=>m.action==='medical'&&m.playerId===p.id&&!m.dismissed&&isPending(m)))continue;
      push({title:p.injury>0?`Parte médico: ${p.nombre}`:`Fatiga: ${p.nombre}`,body:p.injury>0?`Tiene ${p.injury} días de lesión. No estará disponible hasta recuperarse. Prepará un reemplazo y asigná un plan individual de recuperación.`:`Su condición está en ${Math.round(p.condicion_fisica)}%. Un plan de recuperación ayuda al avanzar los días; evaluá darle descanso en el próximo partido.`,type:'medico',action:'medical',playerId:p.id,sourceKey:`medical:${p.id}:${month}`});
    }
    if(lineupNeedsAttention()&&!GameState.match)push({title:'La alineación necesita una revisión',body:'El once tiene plazas vacías o futbolistas no disponibles. Revisá titulares y banco antes de confirmar el próximo partido.',type:'plantel',action:'tactics',issue:'lineup',sourceKey:`lineup:${GameState.today}`});
    if(members.length&&members.reduce((sum,p)=>sum+p.condicion_fisica,0)/members.length<73)push({title:'El plantel necesita bajar la carga',body:'La condición media del equipo está por debajo del 73%. Podés aplicar recuperación colectiva con intensidad baja y revisar quiénes necesitan descansar.',type:'plantel',action:'recovery',sourceKey:`recovery:${month}`});
    if(GameState.userClub.presupuesto_dolares<0||MANAGEMENT.wageBill()>GameState.userClub.wageBudget)push({title:'Revisar el equilibrio financiero',body:GameState.userClub.presupuesto_dolares<0?'La caja está en negativo. Revisá gastos, ventas y compromisos pendientes.':'Los salarios semanales superan el margen aprobado por la directiva. Revisá contratos y el presupuesto salarial.',type:'directiva',action:'finance',sourceKey:`finance:${month}`});
  }
  function ensure() {
    if(!active())return false;
    if(!Array.isArray(GameState.inbox))GameState.inbox=[];
    GameState.inbox=GameState.inbox.filter(m=>m&&typeof m==='object'&&typeof m.title==='string'&&typeof m.body==='string').slice(0,150);
    GameState.offers??=[];GameState.scouting??={shortlist:[],reports:{}};
    GameState.nextMessageId=Math.max(Number.isSafeInteger(GameState.nextMessageId)?GameState.nextMessageId:1,...GameState.inbox.map(m=>(Number.isSafeInteger(m.id)?m.id:0)+1));
    const seen=new Set();
    for(const m of GameState.inbox){
      if(!Number.isSafeInteger(m.id)||m.id<1||seen.has(m.id))m.id=GameState.nextMessageId++;
      seen.add(m.id);m.title=m.title.slice(0,1000);m.body=m.body.slice(0,12000);m.read=!!m.read;
      if(typeof m.type!=='string')m.type='club';
      if(typeof m.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m.date))m.date=GameState.today;
    }
    ui();
    if(pushing)return true;
    pushing=true;
    try {
      for(const o of GameState.offers.filter(o=>o.status==='pending')) {
        const p=lookup(o.playerId);if(!p)continue;
        if(GameState.inbox.some(m=>String(m.offerId)===String(o.id)))continue;
        push({title:o.type==='sell'?`Oferta por ${p.nombre}`:`Negociación por ${p.nombre}`,body:o.type==='sell'?`${clubName(o.toClub)} ofrece ${money(o.fee)}. La venta necesita tu decisión y debe respetar la cobertura del plantel y el presupuesto del comprador.`:`La propuesta está en evaluación. Podés revisar sus condiciones o retirarla antes de que se cierre.`,type:'mercado',action:o.type==='sell'?'sale':'offer',offerId:o.id,playerId:p.id,sourceKey:`offer:${o.id}`});
      }
      refreshAlerts();
    } finally {pushing=false;}
    return true;
  }
  function isPending(m) {
    if(!active()||m.dismissed)return false;
    const p=lookup(m.playerId),o=m.offerId?offerFor(m):null;
    if(m.offerId)return !!o&&o.status==='pending'&&(o.type!=='sell'||owned(p));
    if(m.action==='career')return m.date.slice(0,4)===String(GameState.year)&&!!GameState.world.depth?.jobs?.some(j=>j.status==='open');
    if(m.action==='contract')return owned(p)&&!p.loanId&&p.contract<=GameState.year+1&&(!Number.isInteger(m.contractAtCreation)||p.contract===m.contractAtCreation);
    if(m.action==='medical')return owned(p)&&(p.injury>0||p.condicion_fisica<65)&&p.trainingFocus!=='Recuperación';
    if(m.action==='recovery'){const members=mine();return GameState.training.focus!=='Recuperación'&&members.length>0&&members.reduce((sum,p)=>sum+p.condicion_fisica,0)/members.length<73;}
    if(m.action==='tactics')return m.issue==='lineup'&&lineupNeedsAttention();
    if(m.action==='finance')return GameState.userClub.presupuesto_dolares<0||MANAGEMENT.wageBill()>GameState.userClub.wageBudget;
    return false;
  }
  function status(m) {
    if(m.offerId) {
      const o=offerFor(m);if(!o)return 'Oferta archivada';
      return ({pending:o.type==='sell'||o.awaitingUser?'Tu decisión':'En negociación',accepted:'Acuerdo cerrado',rejected:'Oferta rechazada',expired:'Oferta vencida',cancelled:'Oferta retirada',canceled:'Oferta retirada'})[o.status]||'Negociación finalizada';
    }
    if(m.dismissed)return 'Revisado';
    if(isPending(m))return 'Requiere atención';
    if(m.action==='contract')return 'Contrato revisado';
    if(m.action==='medical'||m.action==='recovery')return 'Plan revisado';
    return m.read?'Leído':'Sin leer';
  }
  function actionsFor(m) {
    const result=[],p=lookup(m.playerId),o=m.offerId?offerFor(m):null,blocked=locked();
    const add=(id,label,disabled=false,primary=false)=>result.push({id,label,disabled,primary});
    if(o?.status==='pending') {
      if(o.type==='sell'&&owned(p)){add('sale-accept','Aceptar oferta',blocked,true);add('sale-reject','Rechazar oferta',blocked);}
      else if(o.type==='buy'){if(o.awaitingUser&&o.counter){add('counter-accept','Aceptar contraoferta',blocked,true);add('counter-reject','Rechazar contraoferta',blocked);}add('offer-cancel','Retirar oferta',blocked);}
      if(o.type==='buy'&&o.awaitingPlayerTerms)add('personal-contract','Negociar contrato',blocked,true);
    }
    if(p) {
      if(window.FM_DEPTH?.ensure()?.reports?.[p.id]?.status==='active')add('scout-cancel','Cancelar observación · sin reintegro',blocked);
      add('profile','Ficha del jugador');
      if(owned(p)&&m.action==='contract'&&isPending(m))add('renew','Renovar contrato',blocked,true);
      if(!owned(p)) {
        if(!GameState.offers.some(q=>q.playerId===p.id&&q.status==='pending')&&(!m.offerId||o?.type==='buy'))add('negotiate','Negociar',blocked,true);
        add('shortlist',GameState.scouting.shortlist.includes(p.id)?'Dejar de seguir':'Seguir jugador');
        if(!GameState.scouting.reports[p.id])add('scout','Pedir informe · USD 1.500',blocked);
        else add('report','Ver informe de ojeo');
      }
      if(owned(p)&&m.action==='medical'&&isPending(m))add('recovery','Asignar recuperación',blocked,true);
    }
    if(m.action==='medical'||m.action==='tactics')add('go-tactics','Revisar alineación');
    if(m.action==='recovery'&&isPending(m))add('team-recovery','Aplicar recuperación colectiva',blocked,true);
    if(m.action==='recovery'||m.action==='medical')add('go-training','Plan de entrenamiento');
    if(m.action==='finance')add('go-finances','Revisar finanzas');
    if(m.action==='career')add('go-career','Revisar proyectos',false,true);
    if(m.action==='match')add('report','Ver informe del partido');
    if(m.action==='match'||m.type==='partidos')add('go-match','Centro de partido');
    if(!m.offerId&&isPending(m))add('dismiss','Revisado por el DT');
    return result;
  }
  function markRead(id,read=true) {
    if(!active())return;const m=GameState.inbox.find(q=>q.id===Number(id));if(m)m.read=read;saveGame(true);
  }
  function readAll() {if(!active())return;GameState.inbox.forEach(m=>m.read=true);saveGame(true);render();}
  function filtered() {
    const s=ui(),query=s.query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
    return GameState.inbox.filter(m=>(s.filter!=='pending'||isPending(m))&&(s.filter!=='unread'||!m.read)&&(s.category==='all'||category(m)===s.category)&&(!query||`${m.title} ${m.body} ${lookup(m.playerId)?.nombre||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').includes(query)));
  }
  function offerInfo(m) {
    const o=offerFor(m);if(!o)return '';
    const terms=o.awaitingUser&&o.counter?{...o,...o.counter}:o;
    const parts=[['Traspaso',money(terms.fee||0)],['Salario semanal',money(terms.wage||lookup(o.playerId)?.salario||0)]];
    if(o.awaitingPlayerTerms)parts.unshift(['Etapa','Club de acuerdo · falta negociar con el jugador']);else if(o.awaitingUser&&o.counter)parts.unshift(['Etapa','Contraoferta del club pendiente']);else if(o.status==='pending')parts.unshift(['Etapa',o.type==='sell'?'Propuesta recibida · tu decisión':o.stage==='player'?'Representante evaluando contrato':'Club evaluando el pase']);
    if(terms.releaseClause)parts.push(['Cláusula de rescisión',money(terms.releaseClause)]);
    if(o.bonus)parts.push(['Prima',money(o.bonus)]);
    if(o.years)parts.push(['Duración',`${o.years} años`]);
    if(o.kind==='loan'||o.dealType==='loan')parts.push(['Modalidad','Préstamo']);
    if(o.installments)parts.push(['Cuotas',typeof o.installments==='number'?String(o.installments):String(o.installments.count||'Acordadas')]);
    if(o.sellOnPercent||o.sellOnPct||o.futureSalePct)parts.push(['Venta futura',`${o.sellOnPercent||o.sellOnPct||o.futureSalePct}%`]);
    if(o.dealType==='loan'&&o.wageShare!=null)parts.push(['Salario a cargo',`${o.wageShare}%`]);
    if(o.loanMonths)parts.push(['Duración del préstamo',`${o.loanMonths} meses`]);
    if(o.upfrontPercent!=null&&o.installments)parts.push(['Pago inicial',`${o.upfrontPercent}%`]);
    return `<div class="fm-inbox-facts">${parts.map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>${o.reason?`<p class="fm-inbox-note">${esc(o.reason)}</p>`:''}`;
  }
  function reportInfo(m) {
    if(m.action==='match') {
      const r=GameState.lastMatch;if(!r||r.date!==(m.matchDate||m.date))return '<p class="muted">Este informe ya quedó en el historial de la temporada. Consultá las competiciones para revisar sus resultados.</p><button data-inbox-go="tables">Ver resultados</button>';
      const score=r.result||{},stats=r.stats||[{},{}];
      return `<section class="fm-inbox-report"><h3>${esc(clubName(r.home))} ${Number(score.home)||0}–${Number(score.away)||0} ${esc(clubName(r.away))}</h3><div class="fm-inbox-facts">${[['Tiros',stats[0]?.shots,stats[1]?.shots],['Faltas',stats[0]?.fouls,stats[1]?.fouls],['Amarillas',stats[0]?.yellow,stats[1]?.yellow],['Expulsiones',stats[0]?.red,stats[1]?.red]].map(([label,a,b])=>`<div><span>${label}</span><strong>${Number(a)||0} – ${Number(b)||0}</strong></div>`).join('')}</div>${r.motm&&lookup(r.motm)?`<p>Figura: <button data-inbox-player="${r.motm}">${esc(lookup(r.motm).nombre)}</button></p>`:''}${(r.feed||[]).slice(0,6).map(f=>`<p class="small"><strong>${Number(f.minute)||0}′</strong> ${esc(f.text||'')}</p>`).join('')}</section>`;
    }
    const report=GameState.scouting.reports[m.playerId];
    return report?`<section class="fm-inbox-report"><h3>Informe de ojeo · ${date(report.date)}</h3><div class="fm-inbox-facts"><div><span>Media</span><strong>${Number(report.rating)||0}</strong></div><div><span>Potencial</span><strong>${Number(report.potential)||0}</strong></div></div><p>${esc(report.verdict||'')}</p><p class="muted">${esc(report.risk||'')}</p></section>`:'';
  }
  function messageContext(m){
    const o=m.offerId?offerFor(m):null,p=lookup(m.playerId),pending=isPending(m),r=p&&window.FM_DEPTH?FM_DEPTH.ensure()?.reports?.[p.id]:null;
    const sender=o?clubName(o.type==='sell'?o.toClub:o.fromClub):r?.staffName&&category(m)==='ojeo'?r.staffName:({ojeo:'Secretaría técnica',contratos:'Secretaría técnica',directiva:'Directiva del club',plantel:'Cuerpo técnico y servicios médicos',partidos:'Analista de rendimiento',mercado:'Departamento de fichajes',prensa:'Resumen de prensa',sistema:'Secretaría del club'})[category(m)]||'Secretaría del club';
    const deadline=o?.status==='pending'?(o.expiresAt||o.expiresDate):null;
    const next=o?.status==='pending'?(o.type==='sell'?'Evaluá las condiciones y aceptá o rechazá la propuesta.':o.awaitingPlayerTerms?'El pase está acordado. Abrí la negociación del contrato con el jugador.':o.awaitingUser&&o.counter?'Revisá la contraoferta del club.':'La contraparte está evaluando la propuesta; avanzá el tiempo para recibir respuesta.'):pending?'Revisá el informe y elegí una de las acciones disponibles.':'Mensaje informativo; no requiere una decisión pendiente.';
    return `<section class="office-inbox-context"><p><b>De:</b> ${esc(sender)} · <b>${pending?'Requiere atención':'Información'}</b></p>${deadline?`<p><b>Vencimiento:</b> ${date(deadline)}</p>`:''}<p><b>Próximo paso:</b> ${esc(next)}</p>${r&&category(m)==='ojeo'?`<p>Observación: ${r.level}% · ${r.status==='active'?'en curso':r.status==='cancelled'?'cancelada':'finalizada'}${r.duration?' · plazo '+r.duration+' días':''}${r.status==='active'&&r.dueDate?' · fecha prevista '+date(r.dueDate):''}.</p>`:''}</section>`;
  }
  function readPanel(m) {
    if(!m)return '<section class="fm-inbox-reader"><div class="fm-inbox-empty"><h3>Tu despacho, al día</h3><p>Seleccioná un mensaje para consultar el informe y tomar una decisión.</p></div></section>';
    const p=lookup(m.playerId),buttons=actionsFor(m);
    return `<article class="fm-inbox-reader" aria-labelledby="${identifier(m)}"><div class="fm-inbox-reader-meta"><span>${esc(categories[category(m)]||'Club')} · ${date(m.date)}</span><span class="badge ${isPending(m)?'gold':''}">${esc(status(m))}</span></div><h2 id="${identifier(m)}">${esc(m.title)}</h2>${messageContext(m)}<p class="fm-inbox-body">${esc(m.body)}</p>${p?`<div class="fm-inbox-player"><div class="fm-profile-avatar">${esc(p.nombre.split(' ').slice(0,2).map(w=>w[0]).join(''))}</div><div><strong>${esc(p.nombre)}</strong><span>${esc(p.posicion)} · ${p.edad} años · ${esc(p.clubId?clubName(p.clubId):'Agente libre')}</span></div><strong>${window.FM_DEPTH?FM_DEPTH.range(p):overall(p)}<small>Calidad estimada</small></strong></div>`:''}${m.offerId?offerInfo(m):''}${buttons.length?`<div class="fm-inbox-actions">${buttons.map(a=>`<button ${a.primary?'class="primary" ':''}data-inbox-action="${a.id}" data-inbox-message="${m.id}" ${a.disabled?'disabled':''}>${esc(a.label)}</button>`).join('')}</div>`:''}${locked()&&buttons.some(a=>a.disabled)?'<p class="small muted">Las decisiones de contrato y entrenamiento estarán disponibles al terminar el partido.</p>':''}${ui().reportOpen===m.id?reportInfo(m):''}<div class="fm-inbox-reader-footer"><button data-inbox-read="${m.id}" data-read-value="${m.read?'unread':'read'}">${m.read?'Marcar como no leído':'Marcar como leído'}</button><span>Las decisiones pendientes se actualizan con la situación del club.</span></div></article>`;
  }
  function renderInbox() {
    if(!active())return legacyInbox?.()||'';
    ensure();const s=ui(),list=filtered(),unread=GameState.inbox.filter(m=>!m.read).length,pending=GameState.inbox.filter(isPending).length;
    const selected=GameState.inbox.find(m=>m.id===s.selected)||null;
    return `<section class="fm-inbox"><div class="fm-section-head"><div><span class="small muted">DESPACHO DEL ENTRENADOR</span><h2>Mensajes y decisiones</h2></div><button data-inbox-read-all>Marcar todo como leído</button></div><div class="fm-inbox-tools"><div class="fm-inbox-tabs" role="group" aria-label="Filtrar mensajes">${[['all','Todos',GameState.inbox.length],['pending','Pendientes',pending],['unread','Sin leer',unread]].map(([key,label,count])=>`<button class="${s.filter===key?'active':''}" data-inbox-filter="${key}" aria-pressed="${s.filter===key}">${label}<span>${count}</span></button>`).join('')}</div><div class="fm-inbox-search"><label><span class="sr-only">Buscar en mensajes</span><input id="inboxSearch" type="search" maxlength="120" value="${esc(s.query)}" placeholder="Buscar mensaje o jugador…"></label><label><span class="sr-only">Categoría de mensajes</span><select id="inboxCategory"><option value="all">Todas las categorías</option>${Object.entries(categories).map(([key,label])=>`<option value="${key}" ${s.category===key?'selected':''}>${label}</option>`).join('')}</select></label></div></div><div class="fm-inbox-layout"><div class="fm-inbox-list" aria-label="Lista de mensajes">${list.map(m=>`<button class="fm-inbox-item ${m.read?'':'unread'} ${selected?.id===m.id?'selected':''}" data-inbox-open="${m.id}" aria-pressed="${selected?.id===m.id}"><span class="fm-inbox-item-top"><span>${esc(categories[category(m)]||'Club')}</span><time>${date(m.date)}</time></span><strong>${esc(m.title)}</strong><span class="fm-inbox-preview">${esc(m.body.slice(0,150))}</span><span class="fm-inbox-item-status ${isPending(m)?'gold':''}">${isPending(m)?'● ':''}${esc(status(m))}</span></button>`).join('')||'<div class="fm-inbox-empty"><strong>No hay mensajes con este filtro.</strong><p>Podés cambiar la categoría o buscar otro término.</p></div>'}</div>${readPanel(selected)}</div></section>`;
  }
  function execute(id,action) {
    if(!active())return;ensure();const m=GameState.inbox.find(q=>q.id===Number(id));if(!m)return;
    const allowed=actionsFor(m).find(a=>a.id===action&&!a.disabled);if(!allowed)return toast('La situación cambió. Revisá el estado del mensaje.');
    const p=lookup(m.playerId);m.read=true;
    if(action==='scout-cancel')return window.FM_OFFICE?.cancelObservation(p.id);
    if(action==='profile'){saveGame(true);return details(p.id);}
    if(action==='personal-contract')return MARKET_CONTRACTS.openPlayerNegotiation(m.offerId);
    if(action==='sale-accept'||action==='sale-reject'){window.CLUB_AI.respondToSaleOffer(m.offerId,action==='sale-accept');saveGame(true);return render();}
    if(action==='counter-accept'||action==='counter-reject'){window.MARKET_CONTRACTS.respondCounter(m.offerId,action==='counter-accept');saveGame(true);return render();}
    if(action==='offer-cancel'){window.CLUB_AI.cancelUserOffer(m.offerId);saveGame(true);return render();}
    if(action==='renew'){saveGame(true);return renew(p.id);}
    if(action==='negotiate'){saveGame(true);return buy(p.id);}
    if(action==='shortlist'){return MANAGEMENT.shortlist(p.id);}
    if(action==='scout'){return MANAGEMENT.scout(p.id);}
    if(action==='recovery'){p.trainingFocus='Recuperación';push({title:`Recuperación planificada: ${p.nombre}`,body:'El plan individual de recuperación está asignado. Se aplicará al avanzar los días; una lesión necesita completar su recuperación antes del regreso.',type:'plantel',playerId:p.id});toast('Plan individual de recuperación asignado');}
    if(action==='team-recovery'){GameState.training.focus='Recuperación';GameState.training.intensity='Baja';toast('Recuperación colectiva e intensidad baja aplicadas');}
    if(action==='report')ui().reportOpen=ui().reportOpen===m.id?null:m.id;
    if(action==='dismiss')m.dismissed=true;
    if(action.startsWith('go-'))view=action.slice(3);
    saveGame(true);render();
  }
  document.addEventListener('click',event=>{
    if(!active())return;const b=event.target.closest('button');if(!b||b.disabled)return;
    if(b.hasAttribute('data-inbox-read-all'))return readAll();
    if(b.dataset.inboxOpen){ui().selected=Number(b.dataset.inboxOpen);ui().reportOpen=null;markRead(ui().selected);render();}
    if(b.dataset.inboxFilter){ui().filter=b.dataset.inboxFilter;saveGame(true);render();}
    if(b.dataset.inboxAction)execute(Number(b.dataset.inboxMessage),b.dataset.inboxAction);
    if(b.dataset.inboxRead){markRead(Number(b.dataset.inboxRead),b.dataset.readValue==='read');render();}
    if(b.dataset.inboxGo){view=b.dataset.inboxGo;render();}
    if(b.dataset.inboxPlayer)details(Number(b.dataset.inboxPlayer));
  });
  document.addEventListener('input',event=>{if(active()&&event.target.id==='inboxSearch'){ui().query=event.target.value.slice(0,120);saveGame(true);render();}});
  document.addEventListener('change',event=>{if(active()&&event.target.id==='inboxCategory'){ui().category=event.target.value;saveGame(true);render();}});
  window.inboxView=renderInbox;
  render=function(){
    const focus=document.activeElement,searching=focus?.id==='inboxSearch',caret=searching?focus.selectionStart:null;
    if(active())ensure();legacyRender();
    if(searching){const replacement=document.getElementById('inboxSearch');if(replacement){replacement.focus({preventScroll:true});if(typeof caret==='number')replacement.setSelectionRange(caret,caret);}}
  };
  return {ensure,push,onMessage,refreshAlerts,render:renderInbox,readAll,markRead,actionsFor,isPending,execute};
})();
