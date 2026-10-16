/* Relationships, personalities and work groups describe this simulated career, never real biographies. */
window.FM_DRESSING_ROOM=(()=>{
  const ui={pane:'players',selected:null,notice:'',conversation:'support'},roles={Titular:55,'Rotación':30,Proyecto:10},DAY=86400000;
  const day=(value,n=0)=>new Date(Date.parse(value+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
  const days=(a,b)=>Math.max(0,Math.floor((Date.parse(b)-Date.parse(a))/DAY));
  const current=()=>GameState?.worldVersion===1;
  const hash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h};
  const bounded=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
  const selected=id=>{const p=player(Number(id));return p?.clubId===GameState.userClub.id?p:null};
  function relationship(p,arrival=false){return {trust:60,role:p.squadRole||(GameState.tactics.xi.includes(p.id)?'Titular':GameState.tactics.bench.includes(p.id)?'Rotación':'Proyecto'),joined:GameState.today,lastTalk:null,lastConcern:null,minutes:0,opportunities:0,lastMinutes:p.minutes||0,promise:null,recent:[],arrival,adaptation:arrival?55:100}}
  function ensure(){
    if(!current())return null;
    const s=GameState.world.dressingRoom??={version:2,players:{},history:[],matches:[],mentoring:[],lastMeeting:null};
    s.version=2;s.players??={};s.history??=[];s.matches??=[];s.mentoring??=[];
    const members=mine(),ids=new Set(members.map(p=>String(p.id)));
    for(const id of Object.keys(s.players))if(!ids.has(id))delete s.players[id];
    s.history=s.history.filter(h=>!h.playerId||ids.has(String(h.playerId))).slice(-120);s.matches=s.matches.slice(-120);
    for(const p of members){
      const r=s.players[p.id]??=relationship(p),seed=hash('room:'+p.id);
      r.trust=clamp(Number(r.trust)||0);if(!Object.hasOwn(roles,r.role))r.role='Rotación';
      if((p.minutes||0)<r.lastMinutes)r.lastMinutes=p.minutes||0;
      r.recent??=[];r.minutes=Math.max(0,Number(r.minutes)||0);r.opportunities=Math.max(0,Number(r.opportunities)||0);
      r.traits??={professionalism:8+seed%11,ambition:7+(seed>>>5)%12,composure:7+(seed>>>10)%12,sociability:7+(seed>>>15)%12};
      for(const key of ['professionalism','ambition','composure','sociability'])r.traits[key]=bounded(r.traits[key],1,20);
      r.leadership=bounded(r.leadership??(7+Math.round((p.edad-20)*.48)+(seed>>>20)%5),4,20);
      r.adaptation=bounded(r.adaptation??100,0,100);
      r.group=r.arrival&&r.adaptation<80?'Adaptación':p.edad<=23?'Nueva generación':WORLD_ENGINE.isForeign(p)?'Comunidad internacional':'Núcleo local';
    }
    return s;
  }
  function log(text,playerId=null){const s=ensure();s.history.push({date:GameState.today,text,playerId});s.history=s.history.slice(-120)}
  function reply(text){ui.notice=text;saveGame(true);render();return text}
  function notify(title,body,extra={}){MANAGEMENT.addMessage(title,body,'plantel',{sender:'Cuerpo técnico · vestuario',...extra})}
  function influence(p,r=ensure()?.players[p.id]){return r?r.leadership*3+Math.min(15,(p.appearances||0)*.4)+Math.min(15,(p.edad-18)*.6):0}
  function hierarchy(){
    const s=ensure();if(!s)return[];
    const sorted=mine().slice().sort((a,b)=>influence(b,s.players[b.id])-influence(a,s.players[a.id])||b.edad-a.edad),leaders=new Set(sorted.filter(p=>p.id!==GameState.tactics.captain).slice(0,3).map(p=>p.id));
    return sorted.map(p=>({id:p.id,name:p.nombre,leadership:s.players[p.id].leadership,group:s.players[p.id].group,rank:p.id===GameState.tactics.captain?'Capitán':leaders.has(p.id)?'Referente':p.edad<=23?'Emergente':'Plantel',trust:s.players[p.id].trust}));
  }
  function summary(){
    const s=ensure(),members=mine();if(!s||!members.length)return {cohesion:50,trust:50,concerns:0,groups:[]};
    const avg=key=>members.reduce((n,p)=>n+s.players[p.id][key],0)/members.length;
    const trust=avg('trust'),cohesion=Math.round(clamp(trust*.7+avg('adaptation')*.3)),groups=[...new Set(members.map(p=>s.players[p.id].group))].map(name=>{
      const list=members.filter(p=>s.players[p.id].group===name);return {name,ids:list.map(p=>p.id),trust:Math.round(list.reduce((n,p)=>n+s.players[p.id].trust,0)/list.length)};
    });
    return {cohesion,trust:Math.round(trust),concerns:members.filter(p=>s.players[p.id].concern?.active).length,groups};
  }
  function participation(id){
    const r=ensure()?.players[id];if(!r)return null;
    const matches=r.recent.filter(m=>m.eligible),minutes=matches.reduce((n,m)=>n+m.minutes,0),target=matches.length*roles[r.role];
    return {matches:matches.length,minutes,target,average:matches.length?Math.round(minutes/matches.length):0,expected:roles[r.role],required:({Titular:3,'Rotación':4,Proyecto:6}[r.role]||3),enough:matches.length>=({Titular:3,'Rotación':4,Proyecto:6}[r.role]||3)};
  }
  function talk(id,kind){
    const p=selected(id),s=ensure(),r=s?.players[id];if(!p||!r||locked())return false;
    if(r.lastTalk===GameState.today)return reply('Ya conversaron hoy. Dale tiempo para asimilar el mensaje.');
    const rating=Number(p.lastRating),evidence=participation(id);let trust=0,morale=0,text='';
    if(['praise','criticize'].includes(kind)&&(!Number.isFinite(rating)||rating<=0))return reply('Todavía no hay una nota individual de partido registrada para fundamentar esta charla. La forma inicial es una estimación del simulador. Podés acompañarlo o conversar sobre sus oportunidades.');
    if(kind==='praise'){const fair=rating>=7;trust=fair?4:-3;morale=fair?3:-2;text=fair?`Agradece el reconocimiento: su última nota registrada es ${rating.toFixed(1)}.`:`No entiende el elogio: su última nota registrada es ${rating.toFixed(1)}, por debajo de 7,0.`}
    else if(kind==='criticize'){const fair=rating<=6.3;trust=fair?2:-5;morale=fair?-1:-3;text=fair?`Acepta mejorar después de una nota de ${rating.toFixed(1)}.`:`Considera injusta la crítica con una nota registrada de ${rating.toFixed(1)}.`}
    else if(kind==='support'){trust=p.injury||p.moral<50?4:1;morale=p.injury||p.moral<50?4:1;text=p.injury?'Valora el apoyo durante su recuperación. La charla no reduce los días de lesión.':p.moral<50?`Agradece el respaldo con su moral en ${Math.round(p.moral)}%.`:'Agradece el respaldo y se siente parte del proyecto.'}
    else if(kind==='minutes'){
      if(!evidence.enough){trust=1;text=`Escucha tu explicación. Sólo hay ${evidence.matches} partidos disponibles para evaluar su participación; todavía no hay una queja fundada.`}
      else if(evidence.minutes<evidence.target){trust=r.traits.composure>=12?1:0;text=`Espera más minutos: jugó ${evidence.minutes} de los ${evidence.target} previstos para su papel en ${evidence.matches} partidos. La charla no sustituye una promesa ni borra la queja.`}
      else {trust=2;text=`Reconoce que recibió oportunidades: ${evidence.minutes} minutos frente a ${evidence.target} previstos. Acepta competir por su lugar.`}
    }
    else if(kind==='adaptation'){
      if(r.adaptation<100){r.adaptation=clamp(r.adaptation+4);trust=2;morale=1;text=`Acordaron acompañar su integración al grupo. Adaptación actual: ${Math.round(r.adaptation)}%; progresará con el tiempo.`}
      else {trust=1;text='Ya está integrado al plantel y agradece que consultes cómo se siente.'}
    }
    else if(kind==='leadership'){
      const leader=hierarchy().find(q=>q.id===p.id);if(!['Capitán','Referente'].includes(leader.rank))return reply('Este jugador todavía no ocupa un lugar de referencia. La jerarquía depende del liderazgo, la experiencia y la capitanía de esta carrera.');
      if(s.lastLeadership&&days(s.lastLeadership,GameState.today)<7)return reply('Ya pediste ayuda a los referentes esta semana. El grupo necesita hechos antes de otra intervención.');
      const fair=r.trust>=55&&r.promise?.status!=='broken',delta=fair?1:-1;
      for(const q of mine())if(s.players[q.id].group===r.group&&q.id!==p.id){q.moral=clamp(q.moral+delta);s.players[q.id].trust=clamp(s.players[q.id].trust+delta)}
      s.lastLeadership=GameState.today;trust=fair?2:-2;text=fair?`Acepta respaldar tu mensaje en ${r.group.toLowerCase()}. La confianza del referente es ${Math.round(r.trust)}%.`:`No puede defender tu mensaje con confianza ${Math.round(r.trust)}%${r.promise?.status==='broken'?' y una promesa incumplida':''}. Su grupo recibe la intervención con reservas.`;
    }else return false;
    if(trust>0&&kind==='criticize'&&r.traits.professionalism>=15)trust++;
    if(morale>0&&kind==='praise'&&r.traits.ambition>=15&&rating>=8)morale++;
    r.lastTalk=GameState.today;r.trust=clamp(r.trust+trust);p.moral=clamp(p.moral+morale);log(`${p.nombre}: ${text}`,p.id);return reply(text);
  }
  function promiseMinutes(id){
    const p=selected(id),s=ensure(),r=s?.players[id];if(!p||!r||locked())return false;
    if(p.injury||p.registered===false)return reply('Primero necesita recuperarse y estar inscrito para asumir un compromiso de minutos.');
    if(r.promise?.status==='active')return reply('Ya tiene una promesa de minutos en curso.');
    const deadline=day(GameState.today,21),fixtures=GameState.calendar.filter(e=>!e.done&&e.date<=deadline&&fixture(e));if(fixtures.length<2)return reply('No hay suficientes partidos confirmados en las próximas tres semanas.');
    r.promise={status:'active',start:GameState.today,deadline,target:180,baseline:r.minutes,paused:0,lastEvaluated:GameState.today};log(`Prometiste 180 minutos a ${p.nombre} hasta el ${date(deadline)}, inclusive.`,p.id);return reply('Promesa registrada: 180 minutos en 21 días. Una lesión puede prorrogar el plazo hasta siete días; los minutos siguen bajo tu control.');
  }
  function setRole(id,role){
    const p=selected(id),r=ensure()?.players[id];if(!p||!r||locked()||!Object.hasOwn(roles,role))return false;
    if(r.role===role)return true;const previous=r.role;
    if(roles[role]<roles[previous]&&r.concern?.active){r.trust=clamp(r.trust-3);p.moral=clamp(p.moral-2);log(`${p.nombre} no acepta que cambiar su papel de ${previous.toLowerCase()} a ${role.toLowerCase()} borre la falta de minutos.`,p.id)}
    r.role=role;p.squadRole=role;log(`${p.nombre}: papel ofrecido de ${role.toLowerCase()}. La participación reciente sigue registrada.`,p.id);saveGame(true);render();return true;
  }
  function setCaptain(id){
    const p=selected(id),s=ensure();if(!p||!s||locked())return false;
    if(GameState.tactics.captain===p.id)return true;
    if(s.lastCaptainChange===GameState.today)return reply('Ya modificaste la capitanía hoy. Evitá cambiar otra vez el mensaje al grupo.');
    const previous=selected(GameState.tactics.captain);if(previous){s.players[previous.id].trust=clamp(s.players[previous.id].trust-2);log(`${previous.nombre} deja la capitanía. Confianza −2.`,previous.id)}
    GameState.tactics.captain=p.id;s.players[p.id].trust=clamp(s.players[p.id].trust+2);s.lastCaptainChange=GameState.today;log(`${p.nombre} asume la capitanía con liderazgo simulado ${s.players[p.id].leadership}/20.`,p.id);return reply(`${p.nombre} es el nuevo capitán. El liderazgo se gana también con participación y confianza.`);
  }
  function onSigning(p,role){if(!current()||p.clubId!==GameState.userClub.id)return;WORLD_ENGINE.reindex();const s=ensure();s.players[p.id]=relationship(p,true);s.players[p.id].role=Object.hasOwn(roles,role)?role:'Rotación';ensure()}
  function startMentoring(mentorId,youngId){
    const mentor=selected(mentorId),young=selected(youngId),s=ensure();if(!mentor||!young||!s||locked())return false;
    const mr=s.players[mentor.id];
    if(mentor.id===young.id||mentor.edad<26||young.edad>23||mr.leadership<12||mr.traits.professionalism<12)return reply('Elegí un referente de 26 años o más, liderazgo y profesionalismo de al menos 12, y un jugador de hasta 23 años.');
    if(s.mentoring.some(m=>m.status==='active'&&m.youngId===young.id))return reply('El juvenil ya tiene una mentoría en curso.');
    if(s.mentoring.filter(m=>m.status==='active'&&m.mentorId===mentor.id).length>=2)return reply('Un referente puede acompañar a dos juveniles al mismo tiempo.');
    if(mr.trust<50)return reply('El referente necesita al menos 50% de confianza en el DT para aceptar la tarea.');
    s.nextMentoringId=(s.nextMentoringId||s.mentoring.length)+1;
    s.mentoring.push({id:'mentoring-'+mentor.id+'-'+young.id+'-'+s.nextMentoringId,mentorId:mentor.id,youngId:young.id,start:GameState.today,deadline:day(GameState.today,21),status:'active',lastReport:null});s.mentoring=s.mentoring.slice(-60);
    log(`${mentor.nombre} acompañará a ${young.nombre} durante 21 días.`,young.id);return reply('Mentoría iniciada: el seguimiento mejora el entorno de aprendizaje; no garantiza una subida de atributos deportivos.');
  }
  function cancelMentoring(id){const s=ensure(),m=s?.mentoring.find(q=>q.id===id);if(!m||m.status!=='active'||locked())return false;m.status='cancelled';log(`Cancelaste la mentoría de ${player(m.youngId)?.nombre||'un juvenil'}.`,selected(m.youngId)?.id||null);saveGame(true);render();return true}
  function progressMentoring(s,dateValue){
    for(const m of s.mentoring){if(m.status!=='active')continue;const mentor=selected(m.mentorId),young=selected(m.youngId);
      if(!mentor||!young){m.status='interrupted';notify('Mentoría interrumpida','Uno de los participantes dejó el plantel. El acompañamiento terminó y no se aplicaron mejoras.');continue}
      const mr=s.players[mentor.id],yr=s.players[young.id];
      if(dateValue>=m.deadline){m.status=mr.trust>=50?'completed':'unsuccessful';if(m.status==='completed'){yr.traits.professionalism=Math.min(20,yr.traits.professionalism+1);yr.trust=clamp(yr.trust+3);yr.adaptation=clamp(yr.adaptation+8)}
        const text=m.status==='completed'?`${young.nombre} completó 21 días de acompañamiento con ${mentor.nombre}. Profesionalismo simulado +1, confianza +3; no se garantiza una mejora deportiva.`:`La mentoría de ${young.nombre} finalizó sin mejora: la confianza de ${mentor.nombre} en el DT cayó por debajo de 50%.`;
        log(text,young.id);notify('Balance de mentoría',text,{playerId:young.id});
      }else if(!m.lastReport&&days(m.start,dateValue)>=7){m.lastReport=dateValue;notify('Seguimiento de mentoría',`${young.nombre} lleva ${days(m.start,dateValue)} días con ${mentor.nombre}. Adaptación ${Math.round(yr.adaptation)}%; confianza del referente ${Math.round(mr.trust)}%. Cierre previsto: ${date(m.deadline)}.`,{playerId:young.id})}
    }
  }
  function onDayAdvance(dateValue=GameState.today){
    const s=ensure();if(!s)return;const first=s.lastDay!==dateValue;
    for(const p of mine()){
      const r=s.players[p.id];if(first&&r.adaptation<100)r.adaptation=clamp(r.adaptation+1+r.traits.sociability/20);
      const pr=r.promise;if(!pr||pr.status!=='active')continue;const played=r.minutes-pr.baseline;
      if(played>=pr.target){pr.status='fulfilled';r.trust=clamp(r.trust+8);p.moral=clamp(p.moral+5);log(`Cumpliste la promesa de minutos a ${p.nombre}.`,p.id);notify('Promesa cumplida',`${p.nombre} alcanzó los ${pr.target} minutos acordados. Confianza +8 y moral +5.`,{playerId:p.id});}
      else {
        if(p.injury&&dateValue>pr.start&&pr.lastEvaluated!==dateValue&&(pr.paused||0)<7){pr.deadline=day(pr.deadline,1);pr.paused=(pr.paused||0)+1;if(pr.paused===1)notify('Promesa prorrogada por lesión',`${p.nombre} está lesionado. El plazo se extiende un día por cada jornada de recuperación observada, hasta siete días. Revisá el compromiso en Vestuario.`,{playerId:p.id})}
        if(dateValue>pr.deadline){pr.status='broken';r.trust=clamp(r.trust-12);p.moral=clamp(p.moral-8);log(`No se cumplió la promesa de minutos a ${p.nombre}.`,p.id);notify('Promesa incumplida',`${p.nombre} disputó ${played} de los ${pr.target} minutos prometidos. Confianza −12 y moral −8. Las próximas oportunidades pueden recomponer la relación.`,{playerId:p.id})}
      }pr.lastEvaluated=dateValue;
    }
    if(first){progressMentoring(s,dateValue);s.lastDay=dateValue}
  }
  function onMatchResult(event){
    const s=ensure();if(!s||s.matches.includes(event.id))return;s.matches.push(event.id);s.matches=s.matches.slice(-120);const concerns=[];
    for(const p of mine()){
      const r=s.players[p.id],minutes=Math.max(0,(p.minutes||0)-r.lastMinutes);r.lastMinutes=p.minutes||0;r.minutes+=minutes;
      const eligible=!!(minutes||(!p.injury&&!p.ban&&p.registered!==false));if(eligible)r.opportunities++;
      if(eligible){r.recent.push({id:event.id,date:GameState.today,minutes,eligible});r.recent=r.recent.slice(-6)}const evidence=participation(p.id);
      if(evidence.enough&&evidence.minutes<evidence.target*.7&&(!r.lastConcern||GameState.today>=day(r.lastConcern,7))){
        r.lastConcern=GameState.today;r.concern={active:true,since:r.concern?.since||GameState.today,kind:'minutes',minutes:evidence.minutes,target:evidence.target,matches:evidence.matches};r.trust=clamp(r.trust-3);p.moral=clamp(p.moral-2);
        log(`${p.nombre} espera más participación como ${r.role.toLowerCase()}: ${evidence.minutes}/${evidence.target} minutos en ${evidence.matches} partidos disponibles.`,p.id);concerns.push(p);
      }else if(r.concern?.active&&evidence.enough&&evidence.minutes>=evidence.target){r.concern.active=false;r.concern.resolved=GameState.today;r.trust=clamp(r.trust+2);p.moral=clamp(p.moral+2);log(`${p.nombre} reconoce que sus oportunidades recientes vuelven a estar a la altura de su papel.`,p.id)}
    }
    if(concerns.length){const text=concerns.slice().sort((a,b)=>influence(b)-influence(a)).slice(0,3).map(p=>{const e=participation(p.id);return `${p.nombre}: ${e.minutes}/${e.target} minutos en ${e.matches} partidos`}).join('; ');notify('Participación y expectativas del plantel',`${concerns.length} jugadores esperan más oportunidades. ${text}. Revisá sus papeles y conversá con ellos; una charla no reemplaza los minutos.`,{sourceKey:'room-minutes:'+event.id})}
    s.meetingBoost=0;onDayAdvance();
  }
  function teamMeeting(kind){
    const s=ensure();if(!s||locked())return false;if(s.lastMeeting&&GameState.today<day(s.lastMeeting,7))return reply('La última reunión fue hace menos de una semana. Evitá repetir el mensaje.');
    const recent=GameState.world.clubs.find(c=>c.id===GameState.userClub.id)?.form?.slice(-3)||[],bad=recent.filter(x=>x==='P').length;
    const delta=kind==='encourage'?3:kind==='demand'?(bad>=2?2:-3):kind==='relieve'?(GameState.userClub.presion_hinchada>=60?4:1):null;if(delta===null)return false;
    for(const p of mine()){p.moral=clamp(p.moral+delta);s.players[p.id].trust=clamp(s.players[p.id].trust+(delta>0?1:-2))}s.lastMeeting=GameState.today;s.meetingBoost=delta>0?1:-1;
    const evidence=kind==='demand'?`${bad} derrotas en los últimos ${recent.length} resultados registrados`:kind==='relieve'?`presión de la hinchada ${Math.round(GameState.userClub.presion_hinchada)}%`:`confianza media del grupo ${summary().trust}%`;
    const text=(delta>0?'El grupo recibió bien el mensaje.':'El grupo consideró excesiva la exigencia.')+` Evidencia: ${evidence}. Moral ${delta>0?'+':''}${delta}.`;log('Reunión del plantel: '+text);return reply(text);
  }
  function matchModifier(p){
    if(!current()||p?.clubId!==GameState.userClub.id)return 1;const s=ensure(),r=s.players[p.id];if(!r)return 1;
    return bounded(1+(r.trust-60)*.00045+(r.adaptation-100)*.0001+(s.meetingBoost||0)*.004-(r.concern?.active ? .004 : 0),.97,1.03);
  }
  function developmentModifier(p){
    if(!current()||p?.clubId!==GameState.userClub.id)return 1;const s=ensure(),r=s.players[p.id];if(!r)return 1;
    const mentored=s.mentoring.some(m=>m.status==='active'&&m.youngId===p.id&&selected(m.mentorId)&&s.players[m.mentorId]?.trust>=50);
    return bounded(1+(r.traits.professionalism-12)*.006+(r.trust-60)*.0004+(mentored ? .025 : 0),.90,1.10);
  }
  function playerList(s,members,p){return `<section class="card dr-list ${ui.pane==='players'?'active':''}"><div class="fm-panel-title"><h2>Relación con el DT</h2><span class="badge">${summary().concerns} inquietudes</span></div><div class="ws-list" data-list-region="dressing-players">${members.map(q=>{const r=s.players[q.id];return `<button data-social-select="${q.id}" class="dr-person ${q.id===p.id?'selected':''}"><strong>${esc(q.nombre)}</strong><span>${esc(r.role)} · Confianza ${Math.round(r.trust)}%</span><small>${Math.round(q.moral)}% moral · ${esc(r.group)}${r.concern?.active?' · Pide minutos':''}</small></button>`}).join('')}</div></section>`}
  function talkPanel(s,members,p){const r=s.players[p.id],disabled=locked()?'disabled':'',history=s.history.filter(h=>h.playerId===p.id).slice(-12).reverse(),e=participation(p.id);return `<section class="card dr-talk ${ui.pane==='talk'?'active':''}"><h2>${esc(p.nombre)}</h2><label class="field">Jugador<select data-social-player>${members.map(q=>`<option value="${q.id}" ${q.id===p.id?'selected':''}>${esc(q.nombre)}</option>`).join('')}</select></label><div class="dr-facts"><span>Confianza <b>${Math.round(r.trust)}%</b></span><span>Moral <b>${Math.round(p.moral)}%</b></span><span>Últimos ${e.matches} partidos <b>${e.minutes}/${e.target} min</b></span></div><label class="field dr-role-field">Papel ofrecido<select data-social-role ${disabled}>${Object.keys(roles).map(role=>`<option ${role===r.role?'selected':''}>${role}</option>`).join('')}</select></label><label class="field">Tema de conversación<select data-social-conversation ${disabled}>${[['support','Dar confianza'],['praise','Elogiar rendimiento'],['criticize','Exigir una mejora'],['minutes','Hablar de participación'],['adaptation','Acompañar adaptación'],['leadership','Pedir respaldo al referente']].map(([key,label])=>`<option value="${key}" ${ui.conversation===key?'selected':''}>${label}</option>`).join('')}</select></label><div class="dr-actions"><button data-social-converse ${disabled}>Conversar</button><button data-social-promise ${disabled}>Prometer 180 minutos</button></div>${r.promise?`<div class="dr-promise">${r.promise.status==='active'?'Promesa en curso':r.promise.status==='fulfilled'?'Promesa cumplida':'Promesa incumplida'} · ${r.minutes-r.promise.baseline}/${r.promise.target} minutos · hasta ${date(r.promise.deadline)}</div>`:''}<div class="dr-history ws-list" data-list-region="relationship-history"><p class="muted">Un diálogo por día. ${esc(r.group)} · adaptación ${Math.round(r.adaptation)}%. ${e.enough?'La participación se evalúa sobre los últimos seis partidos disponibles.':`Se necesitan ${e.required} partidos disponibles para evaluar una queja.`}</p>${history.map(h=>`<p><small>${date(h.date)}</small> ${esc(h.text)}</p>`).join('')||'<p class="muted">Todavía no registraste conversaciones con este jugador.</p>'}</div></section>`}
  function groupPanel(s){const facts=summary(),disabled=locked()?'disabled':'';return `<section class="card dr-group ${ui.pane==='group'?'active':''}"><div class="fm-panel-title"><h2>Jerarquías y grupos</h2><span class="badge">Cohesión ${facts.cohesion}%</span></div><div class="dr-group-controls"><label class="field">Capitán<select data-social-captain ${disabled}>${mine().map(p=>`<option value="${p.id}" ${GameState.tactics.captain===p.id?'selected':''}>${esc(p.nombre)} · liderazgo ${s.players[p.id].leadership}</option>`).join('')}</select></label><div class="dr-actions dr-meeting-actions"><button data-social-meeting="encourage" ${disabled}>Animar</button><button data-social-meeting="demand" ${disabled}>Exigir reacción</button><button data-social-meeting="relieve" ${disabled}>Bajar presión</button></div></div><p class="small muted">Grupos y liderazgo simulados. Última reunión: ${s.lastMeeting?date(s.lastMeeting):'ninguna'}. Una por semana.</p><div class="dr-cohorts">${facts.groups.map(g=>`<span>${esc(g.name)} <b>${g.ids.length}</b> · confianza ${g.trust}%</span>`).join('')}</div><div class="ws-list" data-list-region="dressing-hierarchy"><table><thead><tr><th>Jugador</th><th>Jerarquía</th><th>Liderazgo</th><th>Grupo de trabajo</th><th>Confianza</th></tr></thead><tbody>${hierarchy().map(q=>`<tr><td><button class="fm-player-link" data-social-select="${q.id}">${esc(q.name)}</button></td><td>${q.rank}</td><td>${q.leadership}/20</td><td>${esc(q.group)}</td><td>${Math.round(q.trust)}%</td></tr>`).join('')}</tbody></table></div></section>`}
  function commitmentsPanel(s){
    const members=mine(),mentors=members.filter(p=>p.edad>=26&&s.players[p.id].leadership>=12&&s.players[p.id].traits.professionalism>=12),young=members.filter(p=>p.edad<=23),disabled=locked()?'disabled':'';
    const promises=members.filter(p=>s.players[p.id].promise),rows=s.mentoring.slice().reverse();
    return `<section class="card dr-commitments ${ui.pane==='commitments'?'active':''}"><div class="fm-panel-title"><h2>Compromisos y mentorías</h2><span class="badge">${s.mentoring.filter(m=>m.status==='active').length} activas</span></div><div class="dr-mentor-controls"><label class="field">Referente<select data-social-mentor ${disabled}>${mentors.map(p=>`<option value="${p.id}">${esc(p.nombre)} · ${s.players[p.id].leadership}/20</option>`).join('')||'<option value="">Sin referentes aptos</option>'}</select></label><label class="field">Jugador de hasta 23 años<select data-social-young ${disabled}>${young.map(p=>`<option value="${p.id}">${esc(p.nombre)}</option>`).join('')||'<option value="">Sin juveniles disponibles</option>'}</select></label><button data-social-mentoring ${disabled||!mentors.length||!young.length?'disabled':''}>Iniciar · 21 días</button></div><p class="small muted">Cada referente acompaña a dos juveniles como máximo. Profesionalismo, confianza y adaptación pertenecen a esta simulación.</p><div class="ws-list" data-list-region="dressing-commitments"><h3>Promesas de minutos</h3>${promises.map(p=>{const r=s.players[p.id],pr=r.promise;return `<div class="dr-commitment"><button class="fm-player-link" data-social-select="${p.id}">${esc(p.nombre)}</button><span>${pr.status==='active'?'En curso':pr.status==='fulfilled'?'Cumplida':'Incumplida'} · ${r.minutes-pr.baseline}/${pr.target} minutos · ${date(pr.deadline)}</span></div>`}).join('')||'<p class="muted">No hay promesas registradas.</p>'}<h3>Acompañamiento de juveniles</h3>${rows.map(m=>`<div class="dr-commitment"><strong>${esc(player(m.mentorId)?.nombre||'Fuera del plantel')} → ${esc(player(m.youngId)?.nombre||'Fuera del plantel')}</strong><span>${({active:'En curso',completed:'Completada',unsuccessful:'Sin mejora',interrupted:'Interrumpida',cancelled:'Cancelada'})[m.status]} · hasta ${date(m.deadline)}</span>${m.status==='active'?`<button data-social-cancel-mentoring="${esc(m.id)}" ${disabled}>Cancelar</button>`:''}</div>`).join('')||'<p class="muted">Elegí un referente y un juvenil para iniciar el seguimiento.</p>'}<h3>Personalidad de esta carrera</h3><table><thead><tr><th>Jugador</th><th>Profesionalismo</th><th>Ambición</th><th>Templanza</th></tr></thead><tbody>${members.map(p=>{const r=s.players[p.id];return `<tr><td>${esc(p.nombre)}</td><td>${r.traits.professionalism}/20</td><td>${r.traits.ambition}/20</td><td>${r.traits.composure}/20</td></tr>`}).join('')}</tbody></table></div></section>`;
  }
  function renderRoom(){
    const s=ensure();if(!s)return'';const members=mine(),p=selected(ui.selected)||members[0];if(!p)return '<section class="card"><h2>Vestuario</h2><p>No hay jugadores en el plantel.</p></section>';ui.selected=p.id;
    return `<section class="dr-root" data-dr-pane="${esc(ui.pane)}"><div class="fm-page-intro"><div><h2>Vestuario</h2><p>Participación, jerarquías y relaciones de esta carrera.</p></div><span class="badge">Confianza ${summary().trust}%</span></div><nav class="ws-tabs">${[['players','Plantel'],['talk','Charla'],['group','Jerarquías'],['commitments','Compromisos']].map(([key,label])=>`<button data-social-pane="${key}" class="${ui.pane===key?'selected':''}">${label}</button>`).join('')}</nav>${ui.notice?`<p class="dr-notice" role="status">${esc(ui.notice)}</p>`:''}<div class="dr-content">${playerList(s,members,p)}${talkPanel(s,members,p)}${groupPanel(s)}${commitmentsPanel(s)}</div></section>`;
  }
  document.addEventListener('click',e=>{
    if(!current())return;const b=e.target.closest('button');if(!b)return;
    if(b.dataset.socialPane){ui.pane=b.dataset.socialPane;ui.notice='';render()}
    else if(b.dataset.socialSelect){ui.selected=Number(b.dataset.socialSelect);ui.pane='talk';ui.notice='';render()}
    else if(b.dataset.socialTalk)talk(ui.selected,b.dataset.socialTalk);
    else if(b.hasAttribute('data-social-converse'))talk(ui.selected,ui.conversation);
    else if(b.hasAttribute('data-social-promise'))promiseMinutes(ui.selected);
    else if(b.dataset.socialMeeting)teamMeeting(b.dataset.socialMeeting);
    else if(b.hasAttribute('data-social-mentoring'))startMentoring(document.querySelector('[data-social-mentor]')?.value,document.querySelector('[data-social-young]')?.value);
    else if(b.dataset.socialCancelMentoring)cancelMentoring(b.dataset.socialCancelMentoring);
  });
  document.addEventListener('change',e=>{
    if(e.target.hasAttribute('data-social-player')){ui.selected=Number(e.target.value);ui.notice='';render()}
    else if(e.target.hasAttribute('data-social-role'))setRole(ui.selected,e.target.value);
    else if(e.target.hasAttribute('data-social-conversation'))ui.conversation=e.target.value;
    else if(e.target.hasAttribute('data-social-captain'))setCaptain(e.target.value);
  });
  return {ensure,render:renderRoom,talk,promiseMinutes,setRole,setCaptain,onSigning,onDayAdvance,onMatchResult,teamMeeting,startMentoring,cancelMentoring,hierarchy,summary,participation,matchModifier,developmentModifier,ui};
})();
