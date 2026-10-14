/* Relationships and commitments describe this career, never historical biographies. */
window.FM_DRESSING_ROOM=(()=>{
  const ui={pane:'players',selected:null,notice:''},roles={Titular:55,'Rotación':30,Proyecto:10},DAY=86400000;
  const day=(date,n=0)=>new Date(Date.parse(date+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
  const current=()=>GameState?.worldVersion===1;
  function ensure(){
    if(!current())return null;
    const s=GameState.world.dressingRoom??={version:1,players:{},history:[],matches:[],lastMeeting:null};
    s.players??={};s.history??=[];s.matches??=[];const ids=new Set(mine().map(p=>String(p.id)));
    for(const id of Object.keys(s.players))if(!ids.has(id))delete s.players[id];
    s.history=s.history.filter(h=>!h.playerId||ids.has(String(h.playerId))).slice(-80);s.matches=s.matches.slice(-80);
    for(const p of mine()){
      if(!s.players[p.id])s.players[p.id]={trust:60,role:p.squadRole|| (GameState.tactics.xi.includes(p.id)?'Titular':'Rotación'),joined:GameState.today,lastTalk:null,lastConcern:null,minutes:0,opportunities:0,lastMinutes:p.minutes||0,promise:null};
      const r=s.players[p.id];r.trust=clamp(Number(r.trust)||0);if(!roles[r.role])r.role='Rotación';if((p.minutes||0)<r.lastMinutes)r.lastMinutes=p.minutes||0;
    }
    return s;
  }
  function log(text,playerId=null){const s=ensure();s.history.push({date:GameState.today,text,playerId});s.history=s.history.slice(-80)}
  function reply(text){ui.notice=text;saveGame(true);render();return text}
  function selected(id){const p=player(Number(id));return p?.clubId===GameState.userClub.id?p:null}
  function talk(id,kind){
    const p=selected(id),s=ensure(),r=s?.players[id];if(!p||!r||locked())return false;
    if(r.lastTalk===GameState.today)return reply('Ya conversaron hoy. Dale tiempo para asimilar el mensaje.');
    const rating=Number(p.lastRating||p.estado_forma||6.5);let trust=0,morale=0,text='';
    if(kind==='praise'){const fair=rating>=7;trust=fair?4:-3;morale=fair?3:-2;text=fair?'Agradece que reconozcas su rendimiento.':'No entiende el elogio: su rendimiento reciente no lo justifica.'}
    else if(kind==='criticize'){const fair=rating<=6.3;trust=fair?2:-5;morale=fair?-1:-3;text=fair?'Reconoce que tiene que mejorar y acepta la exigencia.':'Considera injusta la crítica y la relación se enfría.'}
    else if(kind==='support'){trust=p.injury||p.moral<50?4:1;morale=p.injury||p.moral<50?4:1;text=p.injury?'Valora que lo acompañes durante la recuperación.':'Agradece el respaldo y se siente parte del proyecto.'}
    else return false;
    r.lastTalk=GameState.today;r.trust=clamp(r.trust+trust);p.moral=clamp(p.moral+morale);log(`${p.nombre}: ${text}`,p.id);return reply(text);
  }
  function promiseMinutes(id){
    const p=selected(id),s=ensure(),r=s?.players[id];if(!p||!r||locked())return false;
    if(p.injury||p.registered===false)return reply('Primero necesita recuperarse y estar inscrito para asumir un compromiso de minutos.');
    if(r.promise?.status==='active')return reply('Ya tiene una promesa de minutos en curso.');
    const deadline=day(GameState.today,21),fixtures=GameState.calendar.filter(e=>!e.done&&e.date<=deadline&&fixture(e));if(fixtures.length<2)return reply('No hay suficientes partidos confirmados en las próximas tres semanas.');
    r.promise={status:'active',start:GameState.today,deadline,target:180,baseline:r.minutes};log(`Prometiste 180 minutos a ${p.nombre} hasta el ${date(deadline)}, inclusive.`,p.id);return reply('Promesa registrada: 180 minutos en 21 días. La convocatoria sigue bajo tu control.');
  }
  function setRole(id,role){const p=selected(id),r=ensure()?.players[id];if(!p||!r||locked()||!Object.hasOwn(roles,role))return false;r.role=role;p.squadRole=role;log(`${p.nombre}: papel acordado de ${role.toLowerCase()}.`,p.id);saveGame(true);render();return true}
  function onSigning(p,role){if(!current()||p.clubId!==GameState.userClub.id)return;WORLD_ENGINE.reindex();const s=ensure();s.players[p.id]={trust:60,role:Object.hasOwn(roles,role)?role:'Rotación',joined:GameState.today,lastTalk:null,lastConcern:null,minutes:0,opportunities:0,lastMinutes:p.minutes||0,promise:null}}
  function onDayAdvance(dateValue=GameState.today){
    const s=ensure();if(!s)return;
    for(const p of mine()){const r=s.players[p.id],pr=r.promise;if(!pr||pr.status!=='active')continue;
      const played=r.minutes-pr.baseline;
      if(played>=pr.target){pr.status='fulfilled';r.trust=clamp(r.trust+8);p.moral=clamp(p.moral+5);log(`Cumpliste la promesa de minutos a ${p.nombre}.`,p.id);MANAGEMENT.addMessage('Promesa cumplida',`${p.nombre} alcanzó los 180 minutos acordados y refuerza su confianza en el DT.`,'plantel',{playerId:p.id});}
      else if(dateValue>pr.deadline){pr.status='broken';r.trust=clamp(r.trust-12);p.moral=clamp(p.moral-8);log(`No se cumplió la promesa de minutos a ${p.nombre}.`,p.id);MANAGEMENT.addMessage('Promesa incumplida',`${p.nombre} disputó ${played} de los 180 minutos prometidos. La relación y su moral se resienten.`,'plantel',{playerId:p.id});}
    }
  }
  function onMatchResult(event){
    const s=ensure();if(!s||s.matches.includes(event.id))return;s.matches.push(event.id);s.matches=s.matches.slice(-80);
    for(const p of mine()){
      const r=s.players[p.id],minutes=Math.max(0,(p.minutes||0)-r.lastMinutes);r.lastMinutes=p.minutes||0;r.minutes+=minutes;
      if(minutes||(!p.injury&&!p.ban&&p.registered!==false))r.opportunities++;
      if(r.opportunities>=3&&r.minutes/r.opportunities<roles[r.role]&&(!r.lastConcern||GameState.today>=day(r.lastConcern,7))){r.lastConcern=GameState.today;r.trust=clamp(r.trust-3);p.moral=clamp(p.moral-2);log(`${p.nombre} espera más participación como ${r.role.toLowerCase()}.`,p.id)}
    }
    onDayAdvance();
  }
  function teamMeeting(kind){
    const s=ensure();if(!s||locked())return false;if(s.lastMeeting&&GameState.today<day(s.lastMeeting,7))return reply('La última reunión fue hace menos de una semana. Evitá repetir el mensaje.');
    const recent=GameState.world.clubs.find(c=>c.id===GameState.userClub.id)?.form?.slice(-3)||[],bad=recent.filter(x=>x==='P').length;
    const delta=kind==='encourage'?3:kind==='demand'?(bad>=2?2:-3):kind==='relieve'?(GameState.userClub.presion_hinchada>=60?4:1):null;if(delta===null)return false;
    for(const p of mine()){p.moral=clamp(p.moral+delta);s.players[p.id].trust=clamp(s.players[p.id].trust+(delta>0?1:-2))}s.lastMeeting=GameState.today;const text=delta>0?'El grupo recibió bien el mensaje.':'El grupo consideró excesiva la exigencia con el rendimiento reciente.';log('Reunión del plantel: '+text);return reply(text);
  }
  function renderRoom(){
    const s=ensure();if(!s)return'';const members=mine(),p=selected(ui.selected)||members[0],r=s.players[p.id];ui.selected=p.id;
    const disabled=locked()?'disabled':'',history=s.history.filter(h=>h.playerId===p.id).slice(-8).reverse();
    return `<section class="dr-root"><div class="fm-page-intro"><div><h2>Vestuario</h2><p>Confianza, participación y compromisos de esta carrera.</p></div><span class="badge">${members.length} jugadores</span></div><nav class="ws-tabs">${[['players','Plantel'],['talk','Charla'],['group','Grupo']].map(([k,label])=>`<button data-social-pane="${k}" class="${ui.pane===k?'selected':''}">${label}</button>`).join('')}</nav>${ui.notice?`<p class="dr-notice" role="status">${esc(ui.notice)}</p>`:''}<div class="dr-content"><section class="card dr-list ${ui.pane==='players'?'active':''}"><div class="fm-panel-title"><h2>Relación con el DT</h2></div><div class="ws-list" data-list-region="dressing-players">${members.map(q=>`<button data-social-select="${q.id}" class="dr-person ${q.id===p.id?'selected':''}"><strong>${esc(q.nombre)}</strong><span>${esc(s.players[q.id].role)} · Confianza ${Math.round(s.players[q.id].trust)}%</span><small>${Math.round(q.moral)}% de moral</small></button>`).join('')}</div></section><section class="card dr-talk ${ui.pane==='talk'?'active':''}"><h2>${esc(p.nombre)}</h2><label class="field">Jugador<select data-social-player>${members.map(q=>`<option value="${q.id}" ${q.id===p.id?'selected':''}>${esc(q.nombre)}</option>`).join('')}</select></label><div class="dr-facts"><span>Confianza <b>${Math.round(r.trust)}%</b></span><span>Moral <b>${Math.round(p.moral)}%</b></span><span>Minutos observados <b>${r.minutes}</b></span></div><label class="field">Papel acordado<select data-social-role ${disabled}>${Object.keys(roles).map(role=>`<option ${role===r.role?'selected':''}>${role}</option>`).join('')}</select></label><div class="dr-actions"><button data-social-talk="praise" ${disabled}>Elogiar rendimiento</button><button data-social-talk="criticize" ${disabled}>Exigir una mejora</button><button data-social-talk="support" ${disabled}>Dar confianza</button><button data-social-promise ${disabled}>Prometer 180 minutos</button></div><p class="small muted">Una charla por jugador y día. Las promesas se evalúan con minutos reales durante 21 días.</p>${r.promise?`<div class="dr-promise">${r.promise.status==='active'?'Promesa en curso':r.promise.status==='fulfilled'?'Promesa cumplida':'Promesa incumplida'} · ${r.minutes-r.promise.baseline}/${r.promise.target} minutos · hasta ${date(r.promise.deadline)}</div>`:''}<div class="dr-history ws-list" data-list-region="relationship-history">${history.map(h=>`<p><small>${date(h.date)}</small> ${esc(h.text)}</p>`).join('')||'<p class="muted">Todavía no registraste conversaciones con este jugador.</p>'}</div></section><section class="card dr-group ${ui.pane==='group'?'active':''}"><h2>Reunión del plantel</h2><p>El resultado depende del momento del equipo. No se puede repetir dentro de la misma semana.</p><div class="dr-actions"><button data-social-meeting="encourage" ${disabled}>Animar al grupo</button><button data-social-meeting="demand" ${disabled}>Exigir una reacción</button><button data-social-meeting="relieve" ${disabled}>Bajar la presión</button></div><p class="small muted">Última reunión: ${s.lastMeeting?date(s.lastMeeting):'ninguna en esta carrera'}.</p><h3>Referentes</h3><p>${esc(player(GameState.tactics.captain)?.nombre||'Sin capitán')} · capitán</p><div class="ws-list">${s.history.filter(h=>!h.playerId).slice(-8).reverse().map(h=>`<p>${date(h.date)} · ${esc(h.text)}</p>`).join('')}</div></section></div></section>`;
  }
  document.addEventListener('click',e=>{if(!current())return;const b=e.target.closest('button');if(!b)return;if(b.dataset.socialPane){ui.pane=b.dataset.socialPane;ui.notice='';render()}if(b.dataset.socialSelect){ui.selected=Number(b.dataset.socialSelect);ui.pane='talk';ui.notice='';render()}if(b.dataset.socialTalk)talk(ui.selected,b.dataset.socialTalk);if(b.hasAttribute('data-social-promise'))promiseMinutes(ui.selected);if(b.dataset.socialMeeting)teamMeeting(b.dataset.socialMeeting)});
  document.addEventListener('change',e=>{if(e.target.hasAttribute('data-social-player')){ui.selected=Number(e.target.value);ui.notice='';render()}if(e.target.hasAttribute('data-social-role'))setRole(ui.selected,e.target.value)});
  return{ensure,render:renderRoom,talk,promiseMinutes,setRole,onSigning,onDayAdvance,onMatchResult,teamMeeting,ui};
})();
