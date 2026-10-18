/* Existing contracts change only after both sides agree. Agency expectations are simulated. */
window.FM_RENEWALS=(()=>{
  const DAY=86400000,roles=['Titular','Rotación','Proyecto'];
  const fields=['years','wage','bonus','annualIncrease','releaseClause','playingTime','appearanceBonus','goalBonus','cleanSheetBonus','titleBonus'];
  const active=()=>GameState?.worldVersion===1;
  const ownership=p=>MARKET_CONTRACTS.ownerClub(p);
  const own=p=>p&&ownership(p)===GameState.userClub.id;
  const outgoing=p=>MARKET_CONTRACTS.activeLoan(p);
  const addDays=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
  const state=()=>{const s=MARKET_CONTRACTS.ensure();if(s){s.renewals??=[];s.renewalCooldown??={}}return s};
  const all=()=>state()?.renewals||[];
  const byId=id=>all().find(r=>r.id===id);
  const current=pid=>all().find(r=>r.playerId===Number(pid)&&r.status==='pending');
  function notify(r,title,body){MANAGEMENT.addMessage(title,body,'contratos',{playerId:r.playerId,offerId:r.id,action:'offer'});r.lastMessageId=GameState.inbox.find(m=>m.offerId===r.id)?.id}
  function contractEnd(p,years,day=GameState.today){
    const cross=['Inglaterra','España','Italia','Alemania','Francia'].includes(club(ownership(p))?.country);
    return `${Number(day.slice(0,4))+years}-${cross?'06-30':'12-31'}`;
  }
  function termsFor(p,raw={}){
    const loan=outgoing(p),prior=loan?.ownerBonuses||p.contractBonuses||{},role=loan?.ownerRole||GameState.world.dressingRoom?.players?.[p.id]?.role||p.squadRole||'Rotación';
    const defaults={years:Math.max(1,Math.min(p.edad<18?3:5,p.contract-Number(GameState.today.slice(0,4))+1)),wage:Math.ceil(p.salario*1.1/100)*100,bonus:p.salario*6,annualIncrease:p.contractWageEscalator?.percent||0,releaseClause:p.clausula_rescision,playingTime:role,appearanceBonus:prior.appearance||0,goalBonus:prior.goal||0,cleanSheetBonus:prior.cleanSheet||0,titleBonus:prior.title||0};
    return {...Object.fromEntries(fields.map(k=>[k,k==='playingTime'?String(raw[k]??defaults[k]):Number(raw[k]??defaults[k])])),endDate:contractEnd(p,Number(raw.years??defaults.years))};
  }
  function reason(p,t,id=null){
    if(!active()||!p||!own(p)||locked())return 'No se puede renovar este contrato ahora';
    if(MARKET_CONTRACTS.committed(p.id))return 'El jugador ya firmó su salida para la próxima ventana';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(MARKET_CONTRACTS.contractEnd(p)||''))return 'No se pudo verificar el vencimiento del contrato';
    if(MARKET_CONTRACTS.contractEnd(p)<GameState.today)return 'El contrato ya venció; debe negociarse una incorporación como agente libre';
    if(!Number.isInteger(t.years)||t.years<1||t.years>(p.edad<18?3:5))return 'Revisá la duración del contrato';
    if(!fields.filter(k=>k!=='playingTime').every(k=>Number.isFinite(t[k]))||!Number.isInteger(t.wage)||t.wage<100||t.wage>1e7||!Number.isInteger(t.bonus)||t.bonus<0||t.bonus>1e9||t.annualIncrease<0||t.annualIncrease>15||t.releaseClause<0||t.releaseClause>1e10)return 'Revisá salario, prima, cláusula y aumento anual';
    if(!roles.includes(t.playingTime)||!['appearanceBonus','goalBonus','cleanSheetBonus'].every(k=>Number.isInteger(t[k])&&t[k]>=0&&t[k]<=100000)||!Number.isInteger(t.titleBonus)||t.titleBonus<0||t.titleBonus>500000)return 'Revisá el rol y las primas por rendimiento';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(t.endDate||'')||!Number.isFinite(Date.parse(t.endDate)))return 'Revisá la fecha propuesta de vencimiento';
    if(t.endDate<MARKET_CONTRACTS.contractEnd(p))return 'Una renovación debe mantener o ampliar el vencimiento actual';
    const loan=outgoing(p),borrowerCost=loan?MARKET_CONTRACTS.loanWageFor(p,loan.borrowerClub):0;
    if(CLUB_AI.wageBill()+CLUB_AI.reservedWages(GameState.userClub.id,id)-MARKET_CONTRACTS.loanWageFor(p,GameState.userClub.id)+Math.max(0,t.wage-borrowerCost)>GameState.userClub.wageBudget)return 'La renovación supera el presupuesto salarial, incluyendo otras negociaciones';
    if(CLUB_AI.availableBudget(GameState.userClub.id,id)<t.bonus)return 'No hay fondos disponibles para la prima';
    return '';
  }
  function expectations(p,t){
    const profile=MARKET_CONTRACTS.negotiationProfile(p,{stage:'player',toClub:ownership(p),renewal:true,...t}),room=GameState.world.dressingRoom?.players?.[p.id];
    const peers=squad(ownership(p)).filter(q=>q.id!==p.id&&q.posicion===p.posicion).sort((a,b)=>a.salario-b.salario),median=peers.length?peers[Math.floor(peers.length/2)].salario:p.salario;
    const established=t.playingTime==='Titular'&&p.edad>=23,reference=Math.min(p.salario*1.55,Math.max(p.salario,established?median*.75:0));
    const roleCut=t.playingTime==='Proyecto'&&p.edad>=27?1.08:1;
    const incentive=Math.min(.06,t.bonus/Math.max(1,p.salario*104)*.08+t.appearanceBonus/Math.max(100,p.salario)*.03+t.annualIncrease*.002);
    const wage=Math.max(100,Math.ceil(Math.max(profile.wage,reference*1.04)*roleCut*(1-incentive)/100)*100);
    const minYears=Math.max(MARKET_CONTRACTS.contractEnd(p).slice(0,4)-Number(GameState.today.slice(0,4)),p.edad<=23?3:1);
    return {wage,bonus:Math.round(p.salario*(p.edad>=33?2:4)),years:Math.min(p.edad<18?3:5,minYears),maxClause:Math.round(Math.max(p.valor_mercado*2.5,p.clausula_rescision||0,10000)),patience:Math.max(4,Math.floor(profile.patience/2)),reasons:[...profile.reasons,...(established&&reference>p.salario?['Compara su salario con el de otros jugadores del puesto']:[]),...(p.edad<=23?['Busca estabilidad para su desarrollo']:[])],refuse:room?.trust<25&&p.moral<35?'La relación con el DT está demasiado deteriorada para renovar ahora':profile.refuse};
  }
  function record(r,actor,t=r){r.negotiationHistory.push({date:GameState.today,actor,terms:{...Object.fromEntries(fields.map(k=>[k,t[k]])),endDate:t.endDate||r.endDate}});r.negotiationHistory=r.negotiationHistory.slice(-24)}
  function finish(r,status,why,cooldown=7){
    r.status=status;r.reason=why;r.resolvedDate=GameState.today;r.awaitingUser=false;delete r.counter;
    state().renewalCooldown[r.playerId]=addDays(GameState.today,cooldown);
    notify(r,status==='expired'?'Renovación vencida':status==='cancelled'?'Renovación retirada':'El jugador no renueva',`${player(r.playerId)?.nombre||'Jugador'}: ${why}. La renovación no se ejecutó ni cobró una prima.`);
  }
  function submit(pid,raw={}){
    const p=player(Number(pid));if(!p||!active())return {ok:false,reason:'Jugador no disponible'};
    const r=current(p.id),previous=r?.counter||r,t=termsFor(p,{...(previous||{}),...raw});
    if(previous&&previous.years===t.years&&previous.endDate)t.endDate=previous.endDate;
    const error=reason(p,t,r?.id);
    if(error)return {ok:false,reason:error};
    if(!raw.confirmed)return {ok:false,reason:'Enviá la propuesta para que el jugador la evalúe',quote:t};
    if(r&&(!r.awaitingUser||!r.counter))return {ok:false,reason:'El representante todavía está evaluando tu propuesta'};
    if(r&&r.expiresDate<GameState.today)return {ok:false,reason:'Venció el plazo para negociar esta renovación'};
    if(!r&&state().renewalCooldown[p.id]>GameState.today)return {ok:false,reason:'El representante retomará las conversaciones desde el '+date(state().renewalCooldown[p.id])};
    if(r&&fields.every(k=>t[k]===r.counter[k]))return {ok:false,reason:'Modificá una condición o aceptá la contraoferta del representante'};
    let row=r;
    if(!row){const s=state();row={id:`renewal-${GameState.year}-${s.nextId++}`,type:'renewal',stage:'player',playerId:p.id,fromClub:ownership(p),toClub:ownership(p),fee:0,status:'pending',createdDate:GameState.today,expiresDate:addDays(GameState.today,MARKET_CONTRACTS.negotiationProfile(p,{...t,toClub:ownership(p),renewal:true}).patience),counterRounds:0,negotiationHistory:[],baselineEnd:MARKET_CONTRACTS.contractEnd(p)};s.renewals.unshift(row)}else row.counterRounds++;
    Object.assign(row,t,{awaitingUser:false,responseDate:addDays(GameState.today,1),acceptedCounter:false});delete row.counter;record(row,'DT');
    notify(row,r?'Nueva propuesta de renovación':'Renovación propuesta',`${p.nombre}: salario ${money(t.wage)}/semana, prima ${money(t.bonus)}, hasta ${date(t.endDate)} y papel de ${t.playingTime.toLowerCase()}. El representante responderá desde el ${date(row.responseDate)}. Se reserva la prima y sólo el incremento salarial; todavía no se paga ni se cambia el vínculo.`);
    WORLD_STORAGE.scheduleSave();return {ok:true,negotiation:row};
  }
  function respond(id,accept){
    const r=byId(id),p=r&&player(r.playerId);if(!r||r.status!=='pending'||locked())return {ok:false,reason:'La renovación ya no está disponible'};
    if(!accept){finish(r,'cancelled','Retiraste la propuesta',3);WORLD_STORAGE.scheduleSave();render();return {ok:true}}
    if(!r.awaitingUser||!r.counter||r.expiresDate<GameState.today)return {ok:false,reason:'La contraoferta no está disponible o venció'};
    const error=reason(p,r.counter,r.id);if(error)return {ok:false,reason:error};
    Object.assign(r,r.counter,{awaitingUser:false,acceptedCounter:true,responseDate:addDays(GameState.today,1)});delete r.counter;record(r,'DT acepta');
    notify(r,'Condiciones de renovación aceptadas',`${p.nombre}: aceptaste las condiciones del representante. Se revalidarán y firmarán desde el ${date(r.responseDate)}; el contrato vigente continúa hasta entonces.`);WORLD_STORAGE.scheduleSave();render();return {ok:true};
  }
  function process(){
    if(!active())return;
    for(const r of all().filter(r=>r.status==='pending')){
      const p=player(r.playerId);
      if(!p||r.fromClub!==GameState.userClub.id||ownership(p)!==r.fromClub||MARKET_CONTRACTS.committed(r.playerId)){finish(r,'cancelled','Cambió la situación contractual o el jugador dejó el club',0);continue}
      if(r.baselineEnd!==MARKET_CONTRACTS.contractEnd(p)){finish(r,'cancelled','El contrato fue modificado por otro acuerdo',0);continue}
      if(r.expiresDate<GameState.today){finish(r,'expired','El representante dio por terminado el plazo');continue}
      if(r.awaitingUser||r.responseDate>GameState.today)continue;
      const error=reason(p,r,r.id);if(error){finish(r,'rejected',error);continue}
      const wanted=expectations(p,r),round=r.counterRounds||0;
      if(wanted.refuse){finish(r,'rejected',wanted.refuse);continue}
      if(round>wanted.patience){finish(r,'rejected','Las posiciones no se acercaron y el representante se retiró');continue}
      const wage=Math.ceil(wanted.wage*(1-Math.min(.06,round*.015))/100)*100,bonus=Math.round(wanted.bonus*(1-Math.min(.15,round*.035)));
      const credit=Math.max(0,r.wage-wage)*Math.min(104,r.years*52),bonusNeeded=Math.max(0,bonus-credit);
      if(!r.acceptedCounter&&(r.wage<wage||r.bonus<bonusNeeded||r.years<wanted.years||r.releaseClause>wanted.maxClause)){
        r.counter={...Object.fromEntries(fields.map(k=>[k,r[k]])),wage:Math.max(r.wage,wage),bonus:Math.max(r.bonus,bonusNeeded),years:Math.max(r.years,wanted.years),releaseClause:Math.min(r.releaseClause,wanted.maxClause),endDate:contractEnd(p,Math.max(r.years,wanted.years),`${Number(r.endDate.slice(0,4))-r.years}-01-01`)};r.awaitingUser=true;r.counterDate=GameState.today;r.expectations=wanted;record(r,'Representante',r.counter);
        notify(r,'Contraoferta de renovación',`${p.nombre} propone ${money(r.counter.wage)}/semana, prima ${money(r.counter.bonus)}, ${r.counter.years} años y papel de ${r.counter.playingTime.toLowerCase()}. ${wanted.reasons.join('. ')}. Podés aceptar, contraofertar o retirarte antes del ${date(r.expiresDate)}.`);continue;
      }
      if(!CLUB_AI.transaction(r.fromClub,-r.bonus,`Prima de renovación: ${p.nombre}`,'contratos')){finish(r,'rejected','La caja no alcanza para la prima');continue}
      const loan=outgoing(p),borrowerCost=loan?MARKET_CONTRACTS.loanWageFor(p,loan.borrowerClub):0;
      p.salario=r.wage;MARKET_CONTRACTS.setContract(p,r.years,GameState.today,{annualIncrease:r.annualIncrease,releaseClause:r.releaseClause,ownerClub:r.fromClub});
      if(loan){loan.ownerWage=p.salario;loan.wageShare=Math.min(p.salario,borrowerCost)/Math.max(1,p.salario)*100;loan.ownerContractEnd=p.contractEnd}
      p.contractEnd=r.endDate;p.contract=Number(r.endDate.slice(0,4));
      const bonuses={appearance:r.appearanceBonus,goal:r.goalBonus,cleanSheet:r.cleanSheetBonus,title:r.titleBonus};if(loan){loan.ownerBonuses=bonuses;loan.ownerRole=r.playingTime}else{p.contractBonuses=bonuses;p.squadRole=r.playingTime;window.FM_DRESSING_ROOM?.onRenewal?.(p,r.playingTime)}p.moral=clamp(p.moral+4);
      window.FM_FINANCES?.onRenewal(p,r.years,r.bonus,r.fromClub);
      r.status='accepted';r.resolvedDate=GameState.today;r.awaitingUser=false;record(r,'Firma');state().renewalCooldown[p.id]=addDays(GameState.today,30);
      for(const o of GameState.offers.filter(o=>o.status==='pending'&&o.playerId===p.id&&o.type==='sell'&&!o.awaitingRegistration)){o.status='cancelled';o.reason='El jugador renovó y cambiaron las condiciones del contrato';MANAGEMENT.addMessage('Oferta anterior sin efecto',`${p.nombre} renovó. La propuesta de ${club(o.toClub)?.nombre||'otro club'} debe negociarse de nuevo con las condiciones actuales.`,'mercado',{playerId:p.id,offerId:o.id,action:'offer'})}
      notify(r,'Renovación firmada',`${p.nombre} aceptó y renovó hasta el ${date(p.contractEnd)}. Salario ${money(p.salario)}/semana, prima ${money(r.bonus)} y papel de ${r.playingTime.toLowerCase()}. Se conservan la confianza, las promesas y la participación de su etapa en el club.`);
    }
    const s=state();s.renewals=[...s.renewals.filter(r=>r.status==='pending'),...s.renewals.filter(r=>r.status!=='pending').slice(0,80)];
  }
  function invalidatePlayer(pid,why='El jugador dejó de estar disponible para renovar'){const r=current(pid);if(r)finish(r,'cancelled',why,0)}
  const input=(key,label,value,min=0,max=1e9)=>`<label class="field">${label}<input name="${key}" type="number" min="${min}" max="${max}" step="1" value="${Math.round(value)}" required></label>`;
  function open(pid){
    const p=player(Number(pid));if(!p||!own(p)||locked())return toast('El contrato no está disponible para renovar');
    const r=current(p.id),t=r?(r.counter||r):termsFor(p),waiting=r&&!r.awaitingUser;
    const history=(r?.negotiationHistory||[]).slice(-8).map(h=>`<li>${date(h.date)} · ${esc(h.actor)} · ${money(h.terms.wage)}/sem. · prima ${money(h.terms.bonus)} · ${h.terms.years} años · ${h.terms.endDate?date(h.terms.endDate):''} · ${esc(h.terms.playingTime)}</li>`).join('');
    $('#details').innerHTML=`<div class="nw-heading"><span class="fm-kicker">RENOVACIÓN · ${r?'RONDA '+(r.counterRounds+1):'PROPUESTA AL JUGADOR'}</span><h2>${esc(p.nombre)}</h2><p>Vínculo actual: ${date(MARKET_CONTRACTS.contractEnd(p))} · ${money(p.salario)}/semana${outgoing(p)?' · cedido en '+esc(club(p.clubId)?.nombre)+'. El aumento se abona por el propietario; se conserva el aporte salarial del prestatario.':''}</p></div><form id="contract-renewal" class="nw-form" data-player-id="${p.id}" data-original-years="${t.years}" data-original-end="${esc(t.endDate)}"><nav class="nw-tabs"><button type="button" data-renew-pane="terms" class="selected">Contrato y rol</button><button type="button" data-renew-pane="bonuses">Primas</button><button type="button" data-renew-pane="history">Negociación</button></nav><div class="nw-body"><section class="nw-fields" data-renew-section="terms">${input('years','Duración pactada (años)',t.years,1,p.edad<18?3:5)}${input('wage','Salario semanal (USD)',t.wage,100,1e7)}${input('bonus','Prima de firma (USD)',t.bonus)}<label class="field">Papel prometido<select name="playingTime">${roles.map(role=>`<option ${t.playingTime===role?'selected':''}>${role}</option>`).join('')}</select></label>${input('annualIncrease','Aumento anual (%)',t.annualIncrease,0,15)}${input('releaseClause','Cláusula bilateral (USD)',t.releaseClause,0,1e10)}</section><section class="nw-fields" data-renew-section="bonuses" hidden>${input('appearanceBonus','Prima por aparición (USD)',t.appearanceBonus,0,100000)}${input('goalBonus','Prima por gol (USD)',t.goalBonus,0,100000)}${input('cleanSheetBonus','Prima por valla invicta (USD)',t.cleanSheetBonus,0,100000)}${input('titleBonus','Prima por título (USD)',t.titleBonus,0,500000)}<p class="nw-note">El nuevo contrato sustituye las primas anteriores. Se liquidan cuando ocurre el hecho deportivo.</p></section><section data-renew-section="history" hidden><p class="nw-note">${r?'Plazo: '+date(r.expiresDate):'El jugador evalúa salario, estabilidad, rol y primas. Las preferencias del representante son simuladas.'}</p>${r?.expectations?.reasons.length?`<p class="nw-note">${esc(r.expectations.reasons.join('. '))}</p>`:''}${history?`<ol>${history}</ol>`:'Todavía no hay propuestas enviadas.'}</section><p class="nw-note" data-renew-end>Nuevo vencimiento propuesto: ${date(t.endDate)}</p><p class="nw-note" role="status">${waiting?'El representante está evaluando la propuesta. Respuesta desde el '+date(r.responseDate)+'.':r?.counter?'Contraoferta recibida. Podés aceptarla o cambiar las condiciones para proponer otra alternativa.':'La propuesta se evalúa desde el día siguiente; el vínculo y el salario actual se mantienen hasta la firma.'} La prima y el incremento salarial quedan reservados.</p></div><div class="world-offer-feedback nw-feedback" data-offer-feedback role="alert" tabindex="-1" hidden><strong data-offer-error></strong><p data-offer-hint hidden></p><button type="button" data-contract-help hidden></button></div><div class="nw-footer">${r?.counter?`<button type="button" data-renew-decision="accept" data-renew-id="${esc(r.id)}">Aceptar condiciones</button>`:''}<button class="primary" type="submit" ${waiting?'disabled':''}>${r?'Enviar contraoferta':'Enviar propuesta'}</button>${r?`<button type="button" data-renew-decision="cancel" data-renew-id="${esc(r.id)}">Retirar</button>`:`<button type="button" data-contract-termination-review="${p.id}">Rescisión</button>`}<button type="button" data-action="close">Cerrar</button></div></form>`;
    if(waiting)for(const node of $('#contract-renewal').querySelectorAll('input,select'))node.disabled=true;
    $('#details').showModal();
  }
  function summary(){
    return all().filter(r=>r.status==='pending').map(r=>`<div class="fm-list-row row between"><div><strong>${esc(player(r.playerId)?.nombre||'Jugador')} · Renovación</strong><div class="small muted">${r.awaitingUser?'Contraoferta del representante':'Evaluando · respuesta desde '+date(r.responseDate)} · ${money((r.counter||r).wage)}/sem. · prima ${money((r.counter||r).bonus)}</div></div><button data-renew-open="${r.playerId}">${r.awaitingUser?'Negociar renovación':'Ver propuesta'}</button></div>`).join('');
  }
  document.addEventListener('submit',e=>{if(e.target.id!=='contract-renewal')return;e.preventDefault();e.stopImmediatePropagation();const form=e.target,result=submit(form.dataset.playerId,{...Object.fromEntries(new FormData(form).entries()),confirmed:true});if(!result.ok)return MARKET_CONTRACTS.offerFeedback(form,result.reason);$('#details').close();render();toast('Propuesta enviada al representante')},true);
  document.addEventListener('click',e=>{
    const pane=e.target.closest('[data-renew-pane]');if(pane){const form=pane.closest('form');for(const node of form.querySelectorAll('[data-renew-section]'))node.hidden=node.dataset.renewSection!==pane.dataset.renewPane;for(const node of form.querySelectorAll('[data-renew-pane]'))node.classList.toggle('selected',node===pane)}
    const button=e.target.closest('[data-renew-open]');if(button)open(button.dataset.renewOpen);
    const choice=e.target.closest('[data-renew-decision]');if(choice){const result=respond(choice.dataset.renewId,choice.dataset.renewDecision==='accept');if(!result.ok)return MARKET_CONTRACTS.offerFeedback(choice.closest('form'),result.reason);$('#details')?.close()}
  });
  document.addEventListener('input',e=>{const form=e.target.closest('#contract-renewal');if(form&&e.target.name==='years'){const p=player(Number(form.dataset.playerId)),years=Number(e.target.value),end=years===Number(form.dataset.originalYears)?form.dataset.originalEnd:contractEnd(p,years);if(Number.isInteger(years)&&years>0)form.querySelector('[data-renew-end]').textContent='Nuevo vencimiento propuesto: '+date(end)}});
  document.addEventListener('invalid',e=>{const panel=e.target.closest('[data-renew-section]');if(!panel)return;const form=panel.closest('form');form.querySelector(`[data-renew-pane="${panel.dataset.renewSection}"]`)?.click();MARKET_CONTRACTS.offerFeedback(form,'Revisá el valor de '+(e.target.closest('label')?.firstChild?.textContent||'este campo'))},true);
  MARKET_CONTRACTS.openRenewal=open;
  return {all,byId,current,submit,respond,process,invalidatePlayer,open,summary,expectations,termsFor,reason};
})();
