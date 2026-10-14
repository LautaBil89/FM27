/* Club agreement precedes personal terms. No transfer happens between the steps. */
(() => {
  const previousBuy=buy,ui={tab:'terms'};
  const moneyInput=(name,label,value,min=0,max=1e9)=>`<label class="field">${label}<input name="${name}" type="number" min="${min}" max="${max}" step="1" value="${Math.round(value)}" required></label>`;
  const feedback=()=>'<div class="world-offer-feedback nw-feedback" data-offer-feedback role="alert" tabindex="-1" hidden><strong data-offer-error></strong><p data-offer-hint hidden></p><button type="button" data-contract-help hidden></button></div>';
  function show(title,p,body,stage,id='') {
    $('#details').innerHTML=`<div class="nw-heading"><span class="fm-kicker">CENTRO DE FICHAJES</span><h2>${esc(p.nombre)}</h2><p>${esc(title)}</p></div><ol class="nw-steps"><li class="${stage==='club'?'active':'complete'}">1 · Club</li><li class="${stage==='player'?'active':''}">2 · Jugador</li><li>3 · Firma</li></ol><form id="negotiation" class="nw-form" data-stage="${stage}" data-player-id="${p.id}" ${id?`data-offer-id="${esc(id)}"`:''}>${MARKET_CONTRACTS.offerResources()}${body}${feedback()}<div class="nw-footer"><button class="primary" type="submit">${stage==='club'?'Enviar oferta al club':'Proponer contrato'}</button><button type="button" data-action="close">Cerrar</button></div></form>`;
    $('#details').showModal();refresh($('#negotiation'));window.FM_DEPTH?.decorate();
  }
  function refresh(form) {
    if(form.dataset.stage==='club'){
      const loan=form.elements.dealType.value==='loan';
      for(const block of form.querySelectorAll('[data-contract-group]')){const visible=block.dataset.contractGroup===(loan?'loan':'permanent');block.hidden=!visible;for(const input of block.querySelectorAll('input,select'))input.disabled=!visible}
      form.elements.upfrontPercent.disabled=loan||form.elements.installments.value==='0';form.elements.upfrontPercent.closest('label').hidden=form.elements.upfrontPercent.disabled;
    }
    for(const panel of form.querySelectorAll('[data-nw-pane]'))panel.hidden=panel.dataset.nwPane!==ui.tab;
    for(const button of form.querySelectorAll('[data-nw-tab]'))button.classList.toggle('selected',button.dataset.nwTab===ui.tab);
  }
  buy=function(id){
    if(!GameState?.worldVersion)return previousBuy(id);
    if(locked())return toast('Terminá el partido antes de negociar');
    if(!transferWindowOpen())return toast('El mercado está cerrado: enero–marzo y julio–agosto');
    CLUB_AI.ensure();MARKET_CONTRACTS.ensure();const p=player(Number(id));if(!p||p.clubId===GameState.userClub.id)return;
    const existing=GameState.offers.find(o=>o.playerId===p.id&&o.status==='pending');
    if(existing?.awaitingPlayerTerms)return openPlayerNegotiation(existing.id);
    if(existing)return toast('Ya hay una oferta pendiente; revisala en Ofertas y contratos');
    if(p.loanId)return toast('El jugador está cedido hasta completar su préstamo');
    ui.tab='terms';
    const body=`<div class="nw-body"><div class="nw-fields"><label class="field">Incorporación<select name="dealType"><option value="permanent">Compra definitiva</option>${p.clubId?'<option value="loan">Préstamo</option>':''}</select></label><label class="field"><span data-contract-fee-label>Oferta de traspaso (USD)</span><input name="fee" type="number" min="0" max="10000000000" step="1" value="${p.clubId?transferCost(p):0}" ${p.clubId?'':'readonly'} required></label></div><div data-contract-group="permanent" class="nw-fields"><label class="field">Pago del pase<select name="installments"><option value="0">Al contado</option><option value="3">3 cuotas mensuales</option><option value="6">6 cuotas mensuales</option><option value="12">12 cuotas mensuales</option></select></label>${moneyInput('upfrontPercent','Pago inicial (%)',50,25,100)}${moneyInput('sellOnPercent','Futura venta para el club (%)',0,0,30)}${p.clubId?`<label class="row small"><input name="activateClause" type="checkbox">Activar cláusula: ${money(p.clausula_rescision)}</label>`:''}</div><div data-contract-group="loan" class="nw-fields" hidden><label class="field">Duración<select name="loanMonths"><option value="6">6 meses</option><option value="12">12 meses</option></select></label>${moneyInput('wageShare','Salario a tu cargo (%)',100,0,100)}<label class="field">Compra futura<select name="purchaseMode"><option value="none">Sin compra</option><option value="option">Opción del prestatario</option><option value="mandatory">Obligación al vencimiento</option></select></label>${moneyInput('purchaseFee','Precio de compra futura (USD)',Math.max(10000,p.valor_mercado))}<p class="nw-note">La compra futura mantiene el salario del propietario y el vínculo restante (mínimo un año). La obligación se cobra al vencer; debe presupuestarse además del cargo.</p></div><p class="nw-note">Primero responde ${p.clubId?esc(club(p.clubId).nombre):'el jugador libre'}. El contrato personal se negocia en la segunda etapa. El pase se reserva, pero se paga únicamente al firmar.</p></div>`;
    show(p.clubId?`Oferta a ${club(p.clubId).nombre}`:'Agente libre · sin pago de traspaso',p,body,'club');
  };
  function openPlayerNegotiation(id) {
    const offer=GameState.offers.find(o=>o.id===id),p=offer&&player(offer.playerId);
    if(!offer||!p||offer.status!=='pending'||!offer.clubAccepted||!offer.awaitingPlayerTerms)return toast('El acuerdo personal no está disponible');
    if(locked())return toast('Terminá el partido antes de negociar');ui.tab='terms';const loan=offer.dealType==='loan';
    const terms=`<section data-nw-pane="terms" class="nw-fields">${moneyInput('wage',loan?'Salario del propietario (USD/sem.)':'Salario semanal (USD)',loan?p.salario:Math.ceil(p.salario*1.15/100)*100,100,1e7)}<label class="field">Papel en el plantel<select name="playingTime"><option>Titular</option><option selected>Rotación</option><option>Proyecto</option></select></label>${loan?`<p class="nw-note">Préstamo de ${offer.loanMonths} meses. Abonás el ${offer.wageShare}% del salario. Su contrato y sus derechos siguen perteneciendo a ${esc(club(offer.fromClub).nombre)}.</p>`:`<label class="field">Duración<select name="years">${[1,2,3,4,5].map(n=>`<option ${n===3?'selected':''}>${n}</option>`).join('')}</select></label>${moneyInput('releaseClause','Cláusula del nuevo contrato (USD)',p.clausula_rescision)}`}</section>`;
    const bonuses=`<section data-nw-pane="bonuses" class="nw-fields" hidden>${loan?'':moneyInput('bonus','Prima de firma (USD)',p.salario*4)}${moneyInput('appearanceBonus','Prima por partido (USD)',0,0,100000)}${moneyInput('goalBonus','Prima por gol (USD)',0,0,100000)}${moneyInput('cleanSheetBonus','Prima por valla invicta (USD)',0,0,100000)}${moneyInput('titleBonus','Prima por título (USD)',0,0,500000)}<p class="nw-note">Las primas por rendimiento se pagan solo por participaciones reales. El salario propuesto no se comunica al club vendedor.</p></section>`;
    show(`Club aceptó ${money(offer.fee)}${loan&&offer.purchaseMode!=='none'?` · compra ${offer.purchaseMode==='mandatory'?'obligatoria':'opcional'} ${money(offer.purchaseFee)}`:''} · negociá con ${p.nombre}`,p,`<nav class="nw-tabs"><button type="button" data-nw-tab="terms">Contrato y rol</button><button type="button" data-nw-tab="bonuses">Primas y bonos</button></nav><div class="nw-body">${terms}${bonuses}</div>`,'player',id);
    if(loan)$('#negotiation').elements.wage.readOnly=true;
  }
  MARKET_CONTRACTS.openPlayerNegotiation=openPlayerNegotiation;
  MARKET_CONTRACTS.onMatchResult=function(event,game,result,before){
    if(!before||!game||!result)return 0;const state=MARKET_CONTRACTS.ensure(),key=event.id;state.bonusFixtures??=[];if(state.bonusFixtures.includes(key))return 0;
    let total=0;const against=game.home===GameState.userClub.id?result.away:result.home;
    for(const p of mine()){
      const old=before[p.id],bonus=p.contractBonuses;if(!old||!bonus)continue;
      const minutes=Math.max(0,(p.minutes||0)-(old.minutes||0)),goals=Math.max(0,(p.goals||0)-(old.goals||0));
      if(minutes>0)total+=(bonus.appearance||0)+goals*(bonus.goal||0)+(against===0?(bonus.cleanSheet||0):0);
    }
    state.bonusFixtures.push(key);state.bonusFixtures=state.bonusFixtures.slice(-80);
    if(total)MANAGEMENT.transaction(-total,`Primas por rendimiento · ${WORLD_ENGINE.competitionLabel(event)}`,'primas');return total;
  };
  document.addEventListener('change',e=>{const f=e.target.closest('#negotiation');if(f?.dataset.stage==='club'&&['dealType','installments','activateClause'].includes(e.target.name))refresh(f)});
  document.addEventListener('click',e=>{const tab=e.target.closest('[data-nw-tab]');if(tab){ui.tab=tab.dataset.nwTab;refresh(tab.closest('form'))}const button=e.target.closest('[data-contract-player]');if(button)openPlayerNegotiation(button.dataset.contractPlayer)});
  document.addEventListener('invalid',e=>{const panel=e.target.closest('[data-nw-pane]');if(panel){ui.tab=panel.dataset.nwPane;refresh(panel.closest('form'))}},true);
})();
