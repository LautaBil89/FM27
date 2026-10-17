/* Negotiated contracts and dated cash obligations for world careers. */
(() => {
  const legacyBuy = buy, legacySummary = typeof transferSummary === 'function' ? transferSummary : null;
  const world = () => GameState?.worldVersion === 1;
  const ai = () => window.CLUB_AI;
  const pending = offer => offer.status === 'pending';
  const amount = value => Math.round(Number(value) || 0);
  const cash = value => money(amount(value));
  const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0,10)===day;
  const dailyClock = () => world() && Boolean(window.WORLD_CLOCK);
  const clubName = id => club(id)?.nombre || 'Agente libre';
  const clubLink = id => id&&club(id)?`<button class="fm-player-link" data-world-club="${esc(id)}">${esc(clubName(id))}</button>`:esc(clubName(id));
  const byId = id => GameState.offers.find(offer => offer.id === id);
  const message = (title, body, offer = null, type = 'mercado') => MANAGEMENT.addMessage(title, body, type, offer ? {playerId:offer.playerId,offerId:offer.id,action:'offer'} : {});

  function ensure() {
    if (!world()) return null;
    GameState.world.ai ??= {};
    const state = GameState.world.ai.contracts ??= {payments:[],loans:[],completedTransfers:[],nextId:1};
    state.payments ??= []; state.loans ??= []; state.registrations ??= []; state.terminations ??= []; state.lastContractDay ??= null; state.consentRequests ??= []; state.completedTransfers ??= []; state.nextId ??= 1;
    GameState.offers ??= [];
    if (dailyClock()) {
      for (const offer of GameState.offers.filter(o=>pending(o)&&o.type==='buy'&&!validDay(o.responseDate))) {
        offer.responseDate=nextDay(validDay(offer.createdDate)?offer.createdDate:GameState.today);
      }
    }
    return state;
  }
  function nextId(prefix) { const state=ensure(); return `${prefix}-${GameState.year}-${state.nextId++}`; }
  function nextDay(day) {
    const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+1);
    return date.toISOString().slice(0,10);
  }
  function addDays(day,days) {return new Date(Date.parse(`${day}T12:00:00Z`)+days*86400000).toISOString().slice(0,10)}
  function registrationOpen(day=GameState.today,clubId=GameState.userClub.id) {if(window.FM_REGISTRATION)return FM_REGISTRATION.registrationOpen(day,clubId);const month=Number(day.slice(5,7));return month<=3||month===7||month===8}
  function nextRegistrationDate(day=GameState.today,clubId=GameState.userClub.id) {
    if(window.FM_REGISTRATION)return FM_REGISTRATION.nextRegistrationDate(day,clubId);
    if(registrationOpen(day,clubId))return day;
    const year=Number(day.slice(0,4)),month=Number(day.slice(5,7));
    return month<7?`${year}-07-01`:`${year+1}-01-01`;
  }
  function committed(playerId,excludingId=null) {return ensure()?.registrations.find(row=>row.playerId===playerId&&row.status==='agreed'&&row.offerId!==excludingId)||null}
  function futureSlots(id=GameState?.userClub.id) {return ensure()?.registrations.filter(row=>row.status==='agreed'&&row.offer.toClub===id).length||0}
  function restoreAgreements() {
    const state=ensure();if(!state)return;
    for(const row of state.registrations.filter(row=>row.status==='agreed')){
      const existing=byId(row.offerId);
      if(!existing)GameState.offers.unshift(structuredClone(row.offer));
      else if(existing.status==='expired')Object.assign(existing,structuredClone(row.offer));
    }
  }
  function negotiationProfile(p,offer={}) {
    if(!p)return null;
    const target=offer.toClub||GameState.userClub.id,c=club(target),origin=club(p.clubId),n=Math.abs(Math.imul(p.id,2654435761))>>>0;
    const priority=p.personalidad==='Ambicioso'?'ambition':p.personalidad==='Líder'?'minutes':p.personalidad==='Reservado'?'adaptation':'stability';
    const labels={ambition:'Proyecto y competiciones',minutes:'Minutos y jerarquía',adaptation:'Adaptación y entorno',stability:'Estabilidad contractual'};
    const reasons=[],base=window.FM_DEPTH?.personal(p,{...offer,toClub:target})||{wage:Math.ceil(p.salario*1.05/100)*100,reasons:[],refuse:''};
    let factor=1;
    const continental=Object.values(GameState.world.cups||{}).some(cup=>cup.participants?.includes(target));
    const rep=target===GameState.userClub.id?GameState.userClub.reputacion:ai().economy(target)?.reputation||60;
    if(priority==='ambition'&&!continental&&rep<(origin?.reputation||origin?.rating||60)){factor+=.08;reasons.push('Compensa la pérdida de exposición deportiva')}
    if(priority==='stability'&&p.edad<31&&Number(offer.years||3)<3){factor+=.04;reasons.push('Prefiere al menos tres temporadas de estabilidad')}
    const nationalities=p.nationalities||[p.nacionalidad];
    if(priority==='adaptation'&&origin?.country!==c?.country&&!nationalities.includes(c?.country)){factor+=.04;reasons.push('El cambio de país requiere una compensación por adaptación')}
    if(priority==='minutes'&&offer.playingTime==='Proyecto'&&p.edad>=24){factor+=.05;reasons.push('Busca responsabilidades de primera plantilla')}
    const incentive=Math.min(.04,(Number(offer.appearanceBonus)||0)/Math.max(100,p.salario)*.025);
    const wage=Math.max(100,Math.ceil(base.wage*Math.max(.96,factor-incentive)/100)*100);
    return {name:['Río Gestión Deportiva','Fútbol Global','Proyecto Once','Puente Sports'][n%4],simulated:true,priority,label:labels[priority],patience:7+n%8,wage,reasons:[...(base.reasons||[]),...reasons],refuse:base.refuse||'',project:window.FM_DEPTH?.project(target)?.policy||'academy',style:target===GameState.userClub.id?GameState.tactics.style:ai().economy(target)?.style,continental};
  }
  function responseDue(offer) {
    return dailyClock() ? validDay(offer.responseDate)&&offer.responseDate<=GameState.today : offer.dueAt<=GameState.eventIndex;
  }
  function addMonths(day, months) {
    const date = new Date(`${day}T12:00:00Z`), original = date.getUTCDate();
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth()+months);
    const last = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(Math.min(original,last)); return date.toISOString().slice(0,10);
  }
  function reserved(id=GameState?.userClub.id, excludingId=null) {
    if (!world()) return 0;
    const state = ensure();
    const obligations = state.payments.filter(row=>row.fromClub===id&&row.status!=='paid').reduce((sum,row)=>sum+row.amount,0);
    const offers = GameState.offers.filter(o=>pending(o)&&o.type==='buy'&&(o.toClub||GameState.userClub.id)===id&&o.id!==excludingId);
    const purchases=state.loans.filter(l=>l.status==='active'&&l.borrowerClub===id&&['mandatory','conditional'].includes(l.purchaseMode)).reduce((n,l)=>n+amount(l.purchaseFee),0);
    const renewals=(state.renewals||[]).filter(r=>r.status==='pending'&&r.fromClub===id&&r.id!==excludingId).reduce((sum,r)=>sum+amount(r.bonus),0);
    return obligations+purchases+renewals+offers.reduce((sum,o)=>sum+amount(o.fee)+amount(o.bonus)+(o.dealType==='loan'&&['mandatory','conditional'].includes(o.purchaseMode)?amount(o.purchaseFee):0),0);
  }
  function pendingWages(id=GameState?.userClub.id, excludingId=null) {
    if (!world()) return 0;
    return GameState.offers.filter(o=>pending(o)&&o.type==='buy'&&o.stage!=='club'&&!o.awaitingPlayerTerms&&(o.toClub||GameState.userClub.id)===id&&o.id!==excludingId)
      .reduce((sum,o)=>sum+(o.dealType==='loan'?amount((player(o.playerId)?.salario||o.wage)*Number(o.wageShare??100)/100):amount(o.wage)),0)+(ensure().renewals||[]).filter(r=>r.status==='pending'&&r.fromClub===id&&r.id!==excludingId).reduce((sum,r)=>sum+Math.max(0,r.wage-(player(r.playerId)?.salario||0)),0);
  }
  function activeLoan(p) { return ensure()?.loans.find(row=>row.playerId===p.id&&row.status==='active'); }
  function loanWageFor(p,id) {
    if (!p) return 0;
    const loan = world() && activeLoan(p);
    if (!loan) return p.clubId===id ? p.salario : 0;
    return loan.borrowerClub===id ? amount(loan.ownerWage*loan.wageShare/100) : loan.ownerClub===id ? loan.ownerWage-amount(loan.ownerWage*loan.wageShare/100) : 0;
  }
  function returnSlots(id) { return ensure()?.loans.filter(row=>row.status==='active'&&row.ownerClub===id).length || 0; }
  function statusReason(p,to,wage,offer) {
    if (!p || (p.clubId!==offer.fromClub && !(p.clubId==null&&offer.fromClub==null))) return 'La situación del jugador cambió';
    if (!club(to)) return 'El club de destino no está disponible';
    if (p.clubId===to) return 'El jugador ya pertenece a este club';
    if (activeLoan(p)) return 'El jugador está cedido hasta completar su préstamo';
    if (committed(p.id,offer.id)) return 'El jugador ya firmó un acuerdo para la próxima ventana';
    if(offer.precontract){const legal=precontractEligibility(p,to,GameState.today,offer.ownerConsent===true);if(!legal.ok)return legal.reason;}
    if (p.clubId&&!offer.precontract) {
      const releasable = ai().canRelease(p,p.clubId);
      if (releasable===false || (releasable && releasable.ok===false)) return 'El club necesita conservar cobertura en esa posición';
    }
    const registration=window.FM_REGISTRATION?.canRegister(p,to);if(registration&&!registration.ok)return registration.reason;
    const receiving=ai().canReceive(p,to,wage,{excludeOfferId:offer.id});
    if (receiving===false||(receiving&&receiving.ok===false)) return receiving?.reason||'El club no puede inscribir al jugador';
    if (amount(offer.fee)+amount(offer.bonus)+(offer.dealType==='loan'&&['mandatory','conditional'].includes(offer.purchaseMode)?amount(offer.purchaseFee):0)>ai().availableBudget(to,offer.id)) return 'No hay fondos para cubrir el pase y sus obligaciones';
    return '';
  }
  function normalise(raw) {
    raw=raw&&typeof raw==='object'?raw:{};
    const p=player(Number(raw.playerId)), type=raw.type==='sell'?'sell':'buy', dealType=raw.dealType==='loan'?'loan':'permanent';
    const parseMoney=(value,fallback=0)=>Math.round(Number(value??fallback));
    return {...raw,playerId:Number(raw.playerId),type,dealType,fromClub:Object.prototype.hasOwnProperty.call(raw,'fromClub')?raw.fromClub:p?.clubId??null,toClub:raw.toClub||GameState.userClub.id,
      fee:parseMoney(raw.fee),bonus:parseMoney(raw.bonus),wage:parseMoney(raw.wage,p?.salario),years:Number(raw.years??3),
      installments:Number(raw.installments??0),upfrontPercent:Number(raw.upfrontPercent??50),sellOnPercent:Number(raw.sellOnPercent??0),
      releaseClause:parseMoney(raw.releaseClause,p?.clausula_rescision),loanMonths:Number(raw.loanMonths??6),wageShare:Number(raw.wageShare??100),purchaseMode:raw.purchaseMode||'none',purchaseFee:parseMoney(raw.purchaseFee),annualIncrease:Number(raw.annualIncrease??0),recallAllowed:raw.recallAllowed===true||raw.recallAllowed==='on',purchaseAppearances:Number(raw.purchaseAppearances??10),precontract:raw.precontract===true||raw.precontract==='on',ownerConsent:raw.ownerConsent===true||raw.ownerConsent==='on',activateClause:raw.activateClause===true||raw.activateClause==='on'};
  }
  function termsReason(offer,p) {
    if (!p) return 'Jugador no encontrado';
    // A loan never rewrites the owner's employment contract or carries transfer clauses.
    if(offer.dealType==='loan'){
      offer.wage=p.salario;offer.years=1;offer.bonus=0;offer.annualIncrease=0;
      offer.releaseClause=p.clausula_rescision;offer.installments=0;offer.upfrontPercent=100;offer.sellOnPercent=0;offer.activateClause=false;
      if(offer.purchaseMode==='none')offer.purchaseFee=0;
    }else{offer.purchaseMode='none';offer.purchaseFee=0}
    if(offer.playingTime&&!['Titular','Rotación','Proyecto'].includes(offer.playingTime))return 'Revisá el papel en el plantel';
    for(const key of ['appearanceBonus','goalBonus','cleanSheetBonus','titleBonus']){
      const value=Number(offer[key]??0),limit=key==='titleBonus'?500000:100000;
      if(!Number.isInteger(value)||value<0||value>limit)return key==='titleBonus'?'La prima por título debe estar entre 0 y USD 500.000':'Las primas por rendimiento deben estar entre 0 y USD 100.000';
    }
    if (![offer.fee,offer.bonus,offer.wage,offer.years,offer.installments,offer.upfrontPercent,offer.sellOnPercent,offer.releaseClause,offer.loanMonths,offer.wageShare].every(Number.isFinite)) return 'Revisá los importes de la oferta';
    if (offer.fee<0||offer.fee>1e10||offer.bonus<0||offer.bonus>1e9||offer.wage<100||offer.wage>1e7) return 'Revisá el pase, la prima y el salario';
    if (!Number.isInteger(offer.years)||offer.years<1||offer.years>5||![0,3,6,12].includes(offer.installments)||offer.upfrontPercent<25||offer.upfrontPercent>100||offer.sellOnPercent<0||offer.sellOnPercent>30||offer.releaseClause<0) return 'Revisá la duración, las cuotas y las cláusulas';
    if(!Number.isFinite(offer.annualIncrease)||offer.annualIncrease<0||offer.annualIncrease>15)return 'El aumento salarial anual debe estar entre 0 y 15%';
    const maxYears=p.edad<18?3:5;if(offer.years>maxYears)return 'Los menores de 18 años sólo pueden firmar hasta tres años';
    if(offer.activateClause&&window.FM_REGISTRATION?.profile(p.clubId).country!=='España'&&!p.releaseClauseBilateral)return 'Fuera de España sólo se puede activar una cláusula bilateral pactada en la carrera';
    if(offer.precontract){const legal=precontractEligibility(p,offer.toClub,GameState.today,offer.ownerConsent);if(!legal.ok)return legal.reason;if(offer.dealType==='loan')return 'Un precontrato no puede ser un préstamo';offer.fee=0;offer.installments=0;offer.sellOnPercent=0;offer.activateClause=false}
    if (offer.dealType==='loan') {
      if (!p.clubId) return 'Un agente libre no puede llegar a préstamo';
      if(!['none','option','mandatory','conditional'].includes(offer.purchaseMode)||!Number.isFinite(offer.purchaseFee)||offer.purchaseFee<0||offer.purchaseFee>1e10)return 'Revisá la cláusula de compra del préstamo';
      if(offer.purchaseMode!=='none'&&offer.purchaseFee<Math.max(p.valor_mercado*.8,10000))return 'La compra futura debe alcanzar al menos el 80% del valor estimado (mínimo USD 10.000)';
      if(offer.purchaseMode==='conditional'&&(!Number.isInteger(offer.purchaseAppearances)||offer.purchaseAppearances<1||offer.purchaseAppearances>50))return 'La condición de compra debe ser entre 1 y 50 partidos';
      if (![6,12].includes(offer.loanMonths)||offer.wageShare<0||offer.wageShare>100) return 'Revisá la duración y el reparto salarial del préstamo';
      if (contractEnd(p)<addMonths(offer.registrationDate>GameState.today?offer.registrationDate:GameState.today,offer.loanMonths)) return 'El contrato del jugador vence antes de terminar el préstamo';
      offer.installments=0;offer.sellOnPercent=0;offer.bonus=0;offer.activateClause=false;
    } else if (!p.clubId) {offer.fee=0;offer.installments=0;offer.sellOnPercent=0}
    if (offer.upfrontPercent===100) offer.installments=0;
    if (offer.activateClause && (!p.clubId||p.clausula_rescision<=0||offer.fee<p.clausula_rescision||offer.installments!==0)) return 'Activar la cláusula exige pagar su importe completo al contado';
    return '';
  }
  function formValues(form) {
    const fd = new FormData(form), data = Object.fromEntries(fd.entries());
    return {...data,playerId:Number(form.dataset.playerId),type:'buy',toClub:GameState.userClub.id};
  }
  function offerFeedback(form,reason,focus=true) {
    const panel=form?.querySelector('[data-offer-feedback]');
    if(!panel){toast(reason);return}
    let hint='',destination='',label='';
    if(reason.includes('plazas')){hint='Vendé un jugador para liberar una plaza antes de incorporar otro. También cuentan las ofertas pendientes y los jugadores que deben regresar de un préstamo.';destination='squad';label='Ver plantilla'}
    else if(reason.includes('extranjeros')){hint='Revisá la inscripción de extranjeros o buscá un jugador que no ocupe un cupo en tu liga.';destination='squad';label='Revisar inscripción'}
    else if(reason.includes('salarial')){hint='Reducí el salario ofrecido o ampliá el margen salarial desde Finanzas.';destination='finances';label='Ver finanzas'}
    else if(reason.includes('fondos')){hint='Reducí el pase y la prima, o liberá fondos reservados por otras ofertas. Las cuotas también reservan el importe completo del pase.';destination='finances';label='Ver finanzas'}
    panel.querySelector('[data-offer-error]').textContent=reason;
    const detail=panel.querySelector('[data-offer-hint]');detail.textContent=hint;detail.hidden=!hint;
    const help=panel.querySelector('[data-contract-help]');help.hidden=!destination;help.dataset.contractHelp=destination;help.textContent=label;
    panel.hidden=false;
    if(focus){panel.focus({preventScroll:true});panel.scrollIntoView({block:'nearest'})}
  }
  function offerResources() {
    const id=GameState.userClub.id,returns=returnSlots(id),incoming=GameState.offers.filter(o=>pending(o)&&(o.toClub||(o.type==='buy'?id:null))===id).length;
    const occupied=mine().length+returns+incoming,limit=WORLD_ENGINE.foreignLimit(id),wages=Math.max(0,GameState.userClub.wageBudget-ai().wageBill(id)-ai().reservedWages(id));
    return `<div class="world-offer-resources" data-offer-resources><div><span>Plazas del plantel</span><strong>${occupied} / 32</strong><small>${returns+incoming} reservadas para regresos y ofertas</small></div><div><span>Extranjeros inscritos</span><strong>${limit>=32?'Sin límite':`${foreigners(id)} / ${limit}`}</strong></div><div><span>Margen salarial semanal</span><strong>${cash(wages)}</strong></div><div><span>Fondos disponibles</span><strong>${cash(ai().availableBudget(id))}</strong></div></div>`;
  }
  function submitOffer(formOrObject) {
    const stage=typeof HTMLFormElement!=='undefined'&&formOrObject instanceof HTMLFormElement?formOrObject.dataset.stage:formOrObject?.stage;
    if(stage==='player')return submitPlayerTerms(formOrObject.dataset?.offerId||formOrObject.offerId,formOrObject);
    if(stage==='club')return submitClubOffer(formOrObject);
    const form=typeof HTMLFormElement!=='undefined'&&formOrObject instanceof HTMLFormElement?formOrObject:null;
    const reject = reason => {if(form)offerFeedback(form,reason);else toast(reason);return {ok:false,reason}};
    if (!world()||locked()) return reject('Terminá el partido antes de negociar');
    ensure();ai().ensure();
    const raw = form ? formValues(form) : formOrObject;
    const offer=normalise(raw),p=player(offer.playerId);
    if (GameState.offers.some(o=>pending(o)&&o.playerId===offer.playerId)) return reject('Ya hay una oferta pendiente por este jugador');
    if (GameState.offers.filter(pending).length>=20) return reject('Resolvé las negociaciones pendientes antes de enviar otra oferta');
    let reason=termsReason(offer,p);
    if (!reason) reason=statusReason(p,offer.toClub,offer.dealType==='loan'?amount(p.salario*offer.wageShare/100):offer.wage,offer);
    if (reason) return reject(reason);
    Object.assign(offer,{id:nextId('offer'),status:'pending',createdAt:GameState.eventIndex,dueAt:GameState.eventIndex+1,createdDate:GameState.today,responseDate:nextDay(GameState.today)});
    GameState.offers.unshift(offer);
    const description=offer.dealType==='loan'?`${offer.loanMonths} meses, ${cash(offer.fee)} de cargo y ${offer.wageShare}% del salario a tu cargo`:`${cash(offer.fee)} de pase, ${cash(offer.wage)} semanales${offer.installments?`, ${offer.installments} cuotas mensuales`:''}`;
    message('Oferta enviada',`${p.nombre}: ${description}. El club y el jugador responderán ${dailyClock()?`a partir del ${date(offer.responseDate)}`:'en la próxima jornada'}.`,offer);
    $('#details')?.close();saveGame(true);render();toast(dailyClock()?'Oferta enviada; respuesta a partir de mañana':'Oferta enviada; respuesta en la próxima jornada');
    return {ok:true,offer};
  }
  function clubTerms(formOrObject) {
    const raw=typeof HTMLFormElement!=='undefined'&&formOrObject instanceof HTMLFormElement?formValues(formOrObject):formOrObject;
    const offer=normalise({...raw,stage:'club',bonus:0,wage:100,years:3});return offer;
  }
  function submitClubOffer(raw) {
    const form=typeof HTMLFormElement!=='undefined'&&raw instanceof HTMLFormElement?raw:null;
    const reject=reason=>{if(form)offerFeedback(form,reason);else toast(reason);return {ok:false,reason}};
    if(!world()||locked())return reject('Terminá el partido antes de negociar');
    ensure();ai().ensure();
    const offer=clubTerms(raw),p=player(offer.playerId);
    if(offer.precontract){const legal=precontractEligibility(p,offer.toClub,GameState.today,offer.ownerConsent);if(!legal.ok)return reject(legal.reason);offer.fee=0;offer.installments=0;offer.sellOnPercent=0;offer.activateClause=false}
    if(GameState.offers.some(o=>pending(o)&&o.playerId===offer.playerId))return reject('Ya hay una oferta pendiente por este jugador');
    if(GameState.offers.filter(pending).length>=20)return reject('Resolvé las negociaciones pendientes antes de enviar otra oferta');
    const reason=termsReason(offer,p)||statusReason(p,offer.toClub,0,offer);if(reason)return reject(reason);
    Object.assign(offer,{id:nextId('offer'),status:'pending',createdAt:GameState.eventIndex,dueAt:GameState.eventIndex+1,createdDate:GameState.today,responseDate:nextDay(GameState.today),clubAccepted:!p.clubId||offer.precontract,playerTermsSubmitted:false,awaitingPlayerTerms:!p.clubId||offer.precontract,awaitingUser:!p.clubId||offer.precontract});
    if(!p.clubId||offer.precontract){offer.stage='player';offer.personalDeadline=addDays(GameState.today,negotiationProfile(p,offer).patience)}GameState.offers.unshift(offer);
    message(offer.precontract?'Precontrato habilitado':p.clubId?'Oferta al club enviada':'Jugador libre disponible',offer.precontract?`${p.nombre}: aviso al club propietario registrado. Podés negociar un vínculo que comenzará después de su vencimiento, el ${date(addDays(contractEnd(p),1))}. No hay pago de pase.`:p.clubId?`${clubName(p.clubId)} evaluará el ${date(offer.responseDate)} tu propuesta por ${p.nombre}. Si la acepta, podrás negociar el contrato personal.`:`${p.nombre} no necesita acuerdo de traspaso. Negociá sus condiciones personales para completar la incorporación.`,offer);
    $('#details')?.close();saveGame(true);render();return {ok:true,offer};
  }
  function submitPlayerTerms(id,raw) {
    const offer=byId(id),form=typeof HTMLFormElement!=='undefined'&&raw instanceof HTMLFormElement?raw:null;
    const reject=reason=>{if(form)offerFeedback(form,reason);else toast(reason);return {ok:false,reason}};
    if(!offer||!pending(offer)||!offer.clubAccepted||!offer.awaitingPlayerTerms||locked())return reject('El acuerdo con el club no está disponible para negociar el contrato');
    if(offer.personalDeadline&&offer.personalDeadline<GameState.today){rejectOffer(offer,'El representante dio por terminado el plazo para el contrato personal');saveGame(true);render();return reject('Venció el plazo para negociar el contrato personal')}
    const fields=form?Object.fromEntries(new FormData(form).entries()):raw,p=player(offer.playerId),candidate=normalise({...offer,...fields,fee:offer.fee,fromClub:offer.fromClub,toClub:offer.toClub,dealType:offer.dealType,installments:offer.installments,upfrontPercent:offer.upfrontPercent,sellOnPercent:offer.sellOnPercent,loanMonths:offer.loanMonths,wageShare:offer.wageShare,activateClause:offer.activateClause,purchaseMode:offer.purchaseMode,purchaseFee:offer.purchaseFee,precontract:offer.precontract,ownerConsent:offer.ownerConsent,recallAllowed:offer.recallAllowed,purchaseAppearances:offer.purchaseAppearances,stage:'player'});
    if(offer.dealType==='loan'){candidate.wage=p.salario;candidate.years=1;candidate.bonus=0;candidate.releaseClause=p.clausula_rescision}
    candidate.playingTime=fields.playingTime||'Rotación';candidate.appearanceBonus=Number(fields.appearanceBonus||0);candidate.goalBonus=Number(fields.goalBonus||0);candidate.cleanSheetBonus=Number(fields.cleanSheetBonus||0);candidate.titleBonus=Number(fields.titleBonus||0);
    if(!Number.isInteger(candidate.titleBonus)||candidate.titleBonus<0||candidate.titleBonus>500000)return reject('La prima por título debe estar entre 0 y USD 500.000');
    if(!['Titular','Rotación','Proyecto'].includes(candidate.playingTime)||![candidate.appearanceBonus,candidate.goalBonus,candidate.cleanSheetBonus].every(n=>Number.isInteger(n)&&n>=0&&n<=100000))return reject('Revisá el papel en el plantel y las primas (entre 0 y USD 100.000)');
    const reason=termsReason(candidate,p)||statusReason(p,candidate.toClub,candidate.dealType==='loan'?amount(p.salario*candidate.wageShare/100):candidate.wage,candidate);if(reason)return reject(reason);
    Object.assign(offer,candidate,{playerTermsSubmitted:true,awaitingPlayerTerms:false,awaitingUser:false,counterAccepted:false,responseDate:nextDay(GameState.today)});delete offer.counter;
    message('Contrato personal propuesto',`${p.nombre} evaluará ${candidate.dealType==='loan'?'el papel y las primas durante la cesión; conserva el contrato del propietario. Papel propuesto:':'salario, duración y papel de'} ${candidate.playingTime.toLowerCase()} a partir del ${date(offer.responseDate)}. El acuerdo con el club se conserva y todavía no se paga el pase.`,offer);
    $('#details')?.close();saveGame(true);render();return {ok:true,offer};
  }
  function demands(p,offer) {
    const selling=club(p.clubId),position=squad(p.clubId).filter(q=>q.posicion===p.posicion).sort((a,b)=>overall(b)-overall(a)),rank=position.findIndex(q=>q.id===p.id);
    if (offer.dealType==='loan') {
      const firstTeam=rank<Math.min(2,position.length-2);
      return {fee:Math.max(p.salario*4,Math.round(p.valor_mercado*(firstTeam?.09:.025))),wage:p.salario,wageShare:firstTeam?100:50,refuse:firstTeam&&overall(p)>=(selling?.rating||65)+4?'El club considera al jugador esencial y no acepta cederlo':offer.stage==='player'&&window.FM_DEPTH?FM_DEPTH.personal(p,offer).refuse:''};
    }
    const competition=ai().interestFor?.(p.id),interestCount=Array.isArray(competition)?competition.length:0;
    const clause=offer.activateClause;
    const basePrice=typeof ai().askingPrice==='function'?ai().askingPrice(p):transferCost(p)*.9;
    const fee=!p.clubId||offer.precontract?0:clause?p.clausula_rescision:Math.round(basePrice*clubNegotiation(p,offer).priceFactor*(1+Math.min(.12,interestCount*.03))*(1-offer.sellOnPercent*.003)+(offer.installments?basePrice*(.015+offer.installments*.003)*(1-offer.upfrontPercent/100):0));
    const reputation=offer.toClub===GameState.userClub.id?GameState.userClub.reputacion:ai().economy(offer.toClub)?.reputation||65;
    const lowReputation=(window.FM_SCOUT_NETWORK?.assessment(p,{kind:'potential',observerClub:offer.toClub})?.estimate||overall(p))>=88&&reputation<65;
    const wage=Math.max(100,Math.ceil(p.salario*(lowReputation?1.7:p.moral<40?1:1.05)/100)*100);
    const personal=offer.stage==='player'?negotiationProfile(p,offer):null;return {fee,wage:personal?.wage??wage,releaseClause:window.FM_REGISTRATION?.profile(offer.toClub).country==='España'?Math.round(p.valor_mercado*1.2):0,refuse:personal?.refuse||''};
  }
  function rejectOffer(offer,reason) {
    offer.status='rejected';offer.reason=reason;offer.resolvedDate=GameState.today;delete offer.awaitingUser;
    message('Negociación rechazada',`${player(offer.playerId)?.nombre||'Jugador'}: ${reason}.`,offer);
  }
  function processOffers() {
    if (!world()) return;
    ensure();window.FM_RENEWALS?.process();expireOffers(GameState.today);processSaleCounters();
    for (const offer of GameState.offers.filter(o=>pending(o)&&o.type==='buy'&&!o.awaitingUser&&!o.awaitingRegistration&&responseDue(o))) {
      const p=player(offer.playerId);Object.assign(offer,normalise(offer));
      let reason=termsReason(offer,p);
      if (!reason) reason=statusReason(p,offer.toClub,offer.stage==='club'?0:offer.dealType==='loan'?amount(p.salario*offer.wageShare/100):offer.wage,offer);
      if (reason) {rejectOffer(offer,reason);continue}
      const requested=demands(p,offer),profile=clubNegotiation(p,offer);
      if((offer.counterRounds||0)>(offer.stage==='player'?Math.max(4,Math.floor(negotiationProfile(p,offer).patience/2)):profile.patience)){rejectOffer(offer,'La contraparte agotó su paciencia tras varias rondas sin acuerdo');continue}
      if(offer.stage==='club'&&offer.counterRounds&&!offer.counterAccepted)requested.fee=Math.round(requested.fee*(1-Math.min(.12,offer.counterRounds*(1-profile.resistance)*.035)));
      if(offer.stage==='player'&&offer.counterRounds&&!offer.counterAccepted)requested.wage=Math.ceil(requested.wage*(1-Math.min(.06,offer.counterRounds*.015))/100)*100;
      if (requested.refuse) {rejectOffer(offer,requested.refuse);continue}
      if(offer.counterAccepted){requested.fee=Math.min(requested.fee,offer.fee);requested.wage=Math.min(requested.wage,offer.wage);requested.wageShare=Math.min(requested.wageShare||0,offer.wageShare||0)}
      if(offer.stage==='club'){
        if(offer.fee<requested.fee||offer.dealType==='loan'&&offer.wageShare<requested.wageShare){
          offer.counter={fee:Math.max(offer.fee,requested.fee),wageShare:Math.max(offer.wageShare,requested.wageShare||0)};offer.awaitingUser=true;offer.counterDate=GameState.today;
          message('Contraoferta del club',`${clubName(p.clubId)} pide ${cash(offer.counter.fee)}${offer.dealType==='loan'?` y ${offer.counter.wageShare}% del salario`:' por el pase'}. El contrato con el jugador se negociará después.`,offer);
        }else{
          Object.assign(offer,{clubCounterRounds:offer.counterRounds||0,counterRounds:0,stage:'player',clubAccepted:true,awaitingPlayerTerms:true,awaitingUser:true,counterAccepted:false,counterDate:GameState.today,personalDeadline:addDays(GameState.today,negotiationProfile(p,offer).patience)});delete offer.counter;
          window.FM_DEPTH?.inviteRival(p,offer);
          message('Acuerdo con el club',`${clubName(p.clubId)} aceptó la propuesta por ${p.nombre}. Abrí «Negociar contrato» para ofrecer condiciones al jugador antes del ${date(offer.personalDeadline)}. Todavía no se pagó el pase ni cambió de club.`,offer);
        }
        continue;
      }
      const insufficient=(!offer.clubAccepted&&offer.fee<requested.fee) || (offer.dealType==='loan' ? !offer.clubAccepted&&offer.wageShare<requested.wageShare : offer.wage<requested.wage||offer.releaseClause<requested.releaseClause);
      if (insufficient) {
        if (offer.counterAccepted) {rejectOffer(offer,'Las condiciones cambiaron antes de la firma');continue}
        offer.counter={fee:offer.clubAccepted?offer.fee:Math.max(offer.fee,requested.fee),wage:Math.max(offer.wage,requested.wage),releaseClause:Math.max(offer.releaseClause,requested.releaseClause||0),wageShare:offer.clubAccepted?offer.wageShare:Math.max(offer.wageShare,requested.wageShare||0)};
        offer.awaitingUser=true;offer.counterDate=GameState.today;
        message('Contraoferta recibida',`${p.nombre}: ${cash(offer.counter.fee)} ${offer.dealType==='loan'?'de cargo de cesión':'de pase'}${offer.dealType==='loan'?` y ${offer.counter.wageShare}% del salario`:`, ${cash(offer.counter.wage)} semanales y cláusula ${cash(offer.counter.releaseClause)}`}. Podés aceptar, hacer otra contraoferta o retirar la propuesta.`,offer);
        continue;
      }
      const alternative=offer.stage==='player'?window.FM_DEPTH?.chooseRival(p,offer):null;if(alternative){rejectOffer(offer,alternative);continue}
      const result=agreeTransfer(offer);
      if (!result.ok) {rejectOffer(offer,result.reason);continue}
      if(result.deferred)continue;
      offer.status='accepted';offer.resolvedDate=GameState.today;
      message(offer.dealType==='loan'?'Préstamo firmado':'Fichaje cerrado',`${p.nombre} se incorpora a ${clubName(offer.toClub)}${offer.dealType==='loan'?` hasta ${addMonths(GameState.today,offer.loanMonths)}`:` por ${offer.years} temporadas`}.`,offer);
      news(offer.dealType==='loan'?'Refuerzo a préstamo':'Transferencia confirmada',`${p.nombre} llega a ${clubName(offer.toClub)} por ${cash(offer.fee)}${offer.installments?`, con ${offer.installments} cuotas mensuales`:''}.`);
    }
    trim();
  }
  // Stable club policy, adjusted by the circumstances of this particular deal.
  function clubNegotiation(p,offer={}) {
    const id=offer.type==='sell'?offer.toClub:p.clubId,c=club(id),e=ai().economy(id)||{};
    let seed=0;for(const char of String(id))seed=(Math.imul(seed,31)+char.charCodeAt(0))>>>0;
    const firmness=.35+(seed%51)/100,roster=squad(p.clubId).filter(q=>q.posicion===p.posicion).sort((a,b)=>overall(b)-overall(a));
    const important=roster.findIndex(q=>q.id===p.id)<({POR:1,DEF:4,MED:3,DEL:2}[p.posicion]||2);
    const months=Math.max(0,(Date.parse(contractEnd(p))-Date.parse(GameState.today))/2629800000);
    const pressured=(Number(e.debt)||0)>Math.max(1,ai().cash(id))||ai().cash(id)<ai().wageBill(id)*6;
    const listed=GameState.transferListed?.includes(p.id),rival=(c?.rivales||c?.rivals||[c?.rival]).includes(offer.toClub);
    const resistance=Math.min(.95,Math.max(.15,firmness+(important?.12:-.08)+(rival?.15:0)-(pressured?.18:0)-(listed?.15:0)-(months<12?.12:0)));
    return {resistance,patience:4+Math.round((1-resistance)*5),label:resistance>.72?'Postura firme':resistance<.42?'Dispuesto a negociar':'Negociación equilibrada',reasons:[important?'Jugador importante en su posición':'Cuenta con alternativas en su posición',months<12?'Contrato próximo a vencer':'Contrato protegido',pressured?'Necesita liquidez':'Sin urgencia de liquidez',...(listed?['Jugador transferible']:[])],priceFactor:Math.max(.65,1+(resistance-.5)*.3-(months<6?.18:months<12?.08:0))};
  }
  function logNegotiation(o,actor,terms=o) {
    o.negotiationHistory??=[];o.negotiationHistory.push({date:GameState.today,actor,stage:o.stage||'club',fee:amount(terms.fee),wage:amount(terms.wage),wageShare:terms.wageShare,installments:terms.installments,sellOnPercent:terms.sellOnPercent});
    o.negotiationHistory=o.negotiationHistory.slice(-24);
  }
  function preserveClubAgreement(o,candidate){
    if(o.clubAccepted)for(const key of ['fee','installments','upfrontPercent','sellOnPercent','dealType','loanMonths','wageShare','purchaseMode','purchaseFee','recallAllowed','purchaseAppearances','activateClause','precontract','fromClub','toClub'])candidate[key]=o[key]??candidate[key];
    return candidate;
  }
  function counterOffer(id,raw={}) {
    const o=byId(id),form=typeof HTMLFormElement!=='undefined'&&raw instanceof HTMLFormElement?raw:null;
    const fail=reason=>{if(form)offerFeedback(form,reason);else toast(reason);return {ok:false,reason}};
    if(!world()||locked()||!o||!pending(o)||o.awaitingRegistration||o.awaitingPlayerTerms||o.saleResponsePending||o.type==='buy'&&(!o.awaitingUser||!o.counter))return fail('La negociación no está esperando una contraoferta');
    const fields=form?Object.fromEntries(new FormData(form).entries()):raw,p=player(o.playerId);
    const allowed=o.type==='buy'&&o.stage==='player'&&o.dealType==='loan'?['playingTime','appearanceBonus','goalBonus','cleanSheetBonus','titleBonus']:o.type==='buy'&&!o.stage?['fee','wage','years','bonus','releaseClause','installments','upfrontPercent','sellOnPercent','wageShare']:o.type==='sell'||o.stage==='club'?['fee','installments','upfrontPercent','sellOnPercent','wageShare','purchaseFee']:['wage','years','bonus','releaseClause','annualIncrease','playingTime','appearanceBonus','goalBonus','cleanSheetBonus','titleBonus'];
    const changes={};for(const key of allowed)if(fields[key]!==undefined)changes[key]=key==='playingTime'?fields[key]:Number(fields[key]);
    const candidate=normalise({...o,...o.counter,...changes});
    preserveClubAgreement(o,candidate);
    if(o.type==='sell'&&o.expiresAt<GameState.today)return fail('La propuesta venció');
    if(o.personalDeadline&&o.personalDeadline<GameState.today)return fail('Venció el plazo para negociar el contrato personal');
    const reason=termsReason(candidate,p)||(o.type==='buy'?statusReason(p,candidate.toClub,candidate.stage==='club'?0:candidate.dealType==='loan'?amount(p.salario*candidate.wageShare/100):candidate.wage,candidate):p?.clubId!==GameState.userClub.id?'El jugador ya no pertenece al club':'');
    if(reason)return fail(reason);
    if(!allowed.some(key=>String(candidate[key]??'')!==String((o.counter||o)[key]??o[key]??'')))return fail('Modificá al menos una condición para enviar una contraoferta');
    if(o.counter)logNegotiation(o,'Contraparte',{...o,...o.counter});else if(!o.negotiationHistory?.length)logNegotiation(o,'Contraparte');
    o.previousBid={fee:o.fee,wage:o.wage,wageShare:o.wageShare};
    Object.assign(o,candidate,{counterRounds:(o.counterRounds||0)+1,awaitingUser:false,counterAccepted:false,responseDate:nextDay(GameState.today),dueAt:GameState.eventIndex+1,lastNegotiationDate:GameState.today});
    delete o.counter;if(o.type==='sell')o.saleResponsePending=true;
    logNegotiation(o,'DT');message('Contraoferta enviada',`${p.nombre}: la contraparte responderá a partir del ${date(o.responseDate)}. El jugador continúa en su club y todavía no se cobra ni paga el pase.`,o);
    if(form)$('#details')?.close();saveGame(true);render();return {ok:true,offer:o};
  }
  function processSaleCounters() {
    for(const o of GameState.offers.filter(o=>pending(o)&&o.type==='sell'&&o.saleResponsePending&&responseDue(o))){
      const p=player(o.playerId);o.saleResponsePending=false;
      if(!p||p.clubId!==GameState.userClub.id){rejectOffer(o,'El jugador cambió de club');continue}
      const profile=clubNegotiation(p,o),budget=Math.max(0,ai().availableBudget(o.toClub,o.id)-amount(o.bonus)-(o.dealType==='loan'&&['mandatory','conditional'].includes(o.purchaseMode)?amount(o.purchaseFee):0));
      const ceiling=Math.min(budget,Math.round((o.dealType==='loan'?Math.max(p.salario*4,p.valor_mercado*.065)*(o.loanMonths/6):ai().askingPrice(p))*(1.28-profile.resistance*.22)));
      const wageCapacity=ai().canReceive(p,o.toClub,o.dealType==='loan'?amount(p.salario*o.wageShare/100):o.wage,{excludeOfferId:o.id});
      if(wageCapacity?.ok===false){rejectOffer(o,wageCapacity.reason||'El comprador no puede inscribir al jugador');continue}
      const equivalent=o.fee*(o.installments?1-(1-o.upfrontPercent/100)*.08:1)+p.valor_mercado*o.sellOnPercent*.002+(o.dealType==='loan'?p.salario*o.wageShare/100*(o.loanMonths/6)*26:0);
      const totalCeiling=ceiling+(o.dealType==='loan'?p.salario*26*(o.loanMonths/6):0);
      if(o.counterRounds>profile.patience||o.fee>Math.max(ceiling*2,10000)){rejectOffer(o,'El comprador se retiró: la distancia entre las posiciones es demasiado grande');continue}
      if(equivalent<=totalCeiling&&o.fee<=budget){o.awaitingUser=true;logNegotiation(o,'Club acepta');message('El comprador acepta tu contraoferta',`${clubName(o.toClub)} acepta ${cash(o.fee)} ${o.dealType==='loan'?'de cargo por la cesión de':'por'} ${p.nombre}. Confirmá ${o.dealType==='loan'?'el préstamo':'la venta'} o volvé a negociar antes del vencimiento.`,o)}
      else {const previous=amount(o.previousBid?.fee),fee=Math.min(ceiling,Math.round(previous+(ceiling-previous)*(1-profile.resistance)*.7));o.fee=Math.max(0,fee);o.installments=0;o.upfrontPercent=100;o.sellOnPercent=0;o.awaitingUser=true;logNegotiation(o,'Club');message('Nueva propuesta del comprador',`${clubName(o.toClub)} ofrece ${cash(o.fee)} ${o.dealType==='loan'?'de cargo por la cesión de':'al contado por'} ${p.nombre}. Podés aceptar, rechazar o contraofertar.`,o)}
    }
  }
  function respondCounter(id,accept) {
    if (!world()||locked()) return false;
    const offer=byId(id);if (!offer||!pending(offer)||!offer.awaitingUser||!offer.counter) return false;
    if (!accept) {rejectOffer(offer,'Retiraste la oferta');saveGame(true);render();return true}
    if(offer.personalDeadline&&offer.personalDeadline<GameState.today){toast('Venció el plazo para negociar el contrato personal');return false}
    const candidate=preserveClubAgreement(offer,{...offer,...offer.counter}),p=player(offer.playerId),wage=candidate.stage==='club'?0:candidate.dealType==='loan'?amount(p?.salario*candidate.wageShare/100):candidate.wage;
    const reason=termsReason(candidate,p)||statusReason(p,candidate.toClub,wage,candidate);
    if (reason) {toast(reason);return false}
    logNegotiation(offer,'DT acepta',candidate);
    Object.assign(offer,candidate,{awaitingUser:false,counterAccepted:true,dueAt:GameState.eventIndex+1,responseDate:nextDay(GameState.today)});delete offer.counter;
    message('Contraoferta aceptada',`${p.nombre}: confirmaste las condiciones. ${offer.stage==='club'?'El club confirmará el acuerdo para habilitar el contrato personal':'El jugador confirmará sus condiciones para completar la firma'} ${dailyClock()?`a partir del ${date(offer.responseDate)}`:'en la próxima jornada'}.`,offer);
    saveGame(true);render();return true;
  }
  function cancelOffer(id) {
    if (!world()||locked()) return false;
    const offer=byId(id);
    if (!offer||!pending(offer)||offer.type!=='buy'||offer.awaitingRegistration) return false;
    rejectOffer(offer,'Retiraste la oferta');saveGame(true);render();return true;
  }
  function expireOffers(day) {
    for (const offer of GameState.offers.filter(o=>pending(o)&&o.type==='buy'&&!o.awaitingRegistration)) {
      if(offer.personalDeadline&&offer.personalDeadline<day){rejectOffer(offer,'El representante dio por terminado el plazo para el contrato personal');continue}
      const start=offer.awaitingUser?offer.counterDate:offer.lastNegotiationDate||offer.createdDate;
      if (!validDay(start)) continue;
      const elapsed=Math.round((Date.parse(day)-Date.parse(start))/86400000);
      if (elapsed>(offer.awaitingUser?14:30)) rejectOffer(offer,offer.awaitingUser?'La contraoferta venció sin respuesta':'La negociación venció sin una firma');
    }
  }
  function contractEnd(p) {
    if(!p)return null;
    if(validDay(p.contractEnd)&&Number(p.contractEnd.slice(0,4))===Number(p.contract))return p.contractEnd;
    return Number.isInteger(Number(p.contract))?`${Number(p.contract)}-12-31`:null;
  }
  function migrateContracts() {
    if(!world())return;
    for(const p of GameState.players){if(!validDay(p.contractEnd)||Number(p.contractEnd.slice(0,4))!==Number(p.contract)){p.contractEnd=contractEnd(p);p.contractDateSource='career-estimate'}p.contractSignedDate??=GameState.today}
  }
  function setContract(p,years,start=GameState.today,terms={}) {
    years=Math.max(1,Math.min(p.edad<18?3:5,Number(years)||1));
    const profile=window.FM_SEASONS?.profile(club(p.clubId)?.leagueId),cross=profile?.cycle==='cross-year'||['Inglaterra','España','Italia','Alemania','Francia'].includes(club(p.clubId)?.country);
    const startYear=Number(start.slice(0,4)),endYear=startYear+years;
    p.contractEnd=`${endYear}-${cross?'06-30':'12-31'}`;p.contract=Number(p.contractEnd.slice(0,4));p.contractSignedDate=start;p.contractDateSource='career-contract';
    if(terms.releaseClause!==undefined){p.clausula_rescision=amount(terms.releaseClause);p.releaseClauseBilateral=p.clausula_rescision>0}
    if(Number(terms.annualIncrease)>0)p.contractWageEscalator={percent:Number(terms.annualIncrease),nextDate:addMonths(start,12)};else delete p.contractWageEscalator;
    return p.contractEnd;
  }
  function precontractEligibility(p,to=GameState.userClub.id,day=GameState.today,ownerConsent=false) {
    if(!p||!p.clubId)return {ok:false,reason:'El jugador libre negocia un contrato inmediato'};
    if(p.clubId===to||activeLoan(p))return {ok:false,reason:'El jugador no está disponible para un precontrato'};
    const end=contractEnd(p);if(!validDay(day)||!validDay(end))return {ok:false,reason:'No se pudo verificar el vencimiento contractual'};
    if(day>end)return {ok:false,reason:'El vínculo ya venció; la secretaría debe liberar al jugador antes de negociar como agente libre'};
    if(day<addMonths(end,-6))return {ok:false,reason:'El precontrato sin pase sólo se permite en los seis meses anteriores al vencimiento'};
    const country=club(to)?.country,domestic=club(p.clubId)?.country===country;
    if(domestic&&country==='Inglaterra'&&day<`${end.slice(0,7)}-01`&&!ensure().consentRequests.some(row=>row.playerId===p.id&&row.toClub===to&&row.fromClub===p.clubId&&row.status==='accepted'&&row.expiresDate>=day))return {ok:false,reason:'Entre clubes ingleses, antes del último mes se necesita permiso registrado del propietario'};
    if(p.edad<18)return {ok:false,reason:'Los precontratos internacionales de menores no están automatizados'};
    if(committed(p.id))return {ok:false,reason:'El jugador ya tiene un acuerdo futuro firmado'};
    return {ok:true,reason:'Aviso al propietario y negociación de incorporación al vencer',startDate:addDays(end,1),requiresNotice:true};
  }
  function progressContracts(day=GameState.today) {
    const state=ensure();if(!state||!validDay(day)||state.lastContractDay===day)return 0;
    migrateContracts();let count=0,reindex=false;
    for(const row of state.consentRequests.filter(row=>row.status==='pending'&&row.responseDate<=day)){const p=player(row.playerId),ok=p?.clubId===row.fromClub&&ai().canRelease(p,row.fromClub).ok;row.status=ok?'accepted':'rejected';row.resolvedDate=day;row.expiresDate=addDays(day,14);message(ok?'Permiso de negociación concedido':'Permiso de negociación rechazado',`${clubName(row.fromClub)} ${ok?'autoriza conversar con':'no autoriza conversaciones anticipadas con'} ${p?.nombre||'el jugador'}${ok?' hasta el '+date(row.expiresDate):'. Conserva su cobertura deportiva'}. El permiso no es un fichaje.`,{playerId:row.playerId},'mercado')}
    for(const p of GameState.players){
      const escalator=p.contractWageEscalator,end=contractEnd(p);
      if(escalator&&Number.isFinite(escalator.percent)&&escalator.percent>0&&escalator.percent<=15&&validDay(escalator.nextDate)){
        let n=0;while(escalator.nextDate<=day&&escalator.nextDate<=end&&n++<25){p.salario=Math.round(p.salario*(1+escalator.percent/100));escalator.nextDate=addMonths(escalator.nextDate,12);count++;if(p.clubId===GameState.userClub.id)message('Aumento salarial pactado',`${p.nombre}: se aplica el ${escalator.percent}% anual firmado. Nuevo salario: ${cash(p.salario)} por semana.`,{playerId:p.id},'contratos')}
      }
      if(p.clubId&&end<day&&!activeLoan(p)){
        const from=p.clubId;p.clubId=null;p.registered=false;p.contractExpiredDate=end;window.FM_REGISTRATION?.onTransfer(p,from,null);reindex=true;count++;
        if(from===GameState.userClub.id){GameState.transferListed=GameState.transferListed.filter(id=>id!==p.id);message('Contrato vencido',`${p.nombre} quedó libre al vencer su vínculo el ${date(end)}. No ingresó dinero por traspaso.`,{playerId:p.id},'contratos')}
      }
    }
    if(reindex){WORLD_ENGINE.reindex();autoLineup()}state.lastContractDay=day;return count;
  }
  function requestPrecontractConsent(pid,to=GameState.userClub.id){const p=player(Number(pid)),state=ensure();if(!p?.clubId||p.clubId===to||locked())return{ok:false,reason:'El jugador no está disponible'};if(state.consentRequests.some(row=>row.playerId===p.id&&row.toClub===to&&row.status==='pending'))return{ok:false,reason:'Ya se solicitó permiso al propietario'};const row={id:nextId('consent'),playerId:p.id,fromClub:p.clubId,toClub:to,status:'pending',createdDate:GameState.today,responseDate:nextDay(GameState.today)};state.consentRequests.push(row);message('Permiso de negociación solicitado',`${clubName(p.clubId)} responderá a partir del ${date(row.responseDate)} si permite negociar anticipadamente con ${p.nombre}.`,{playerId:p.id},'mercado');saveGame(true);render();return{ok:true}}
  function terminationQuote(p,day=GameState.today){if(!p||p.clubId!==GameState.userClub.id||activeLoan(p))return {ok:false,reason:'Sólo se puede rescindir un contrato propio sin cesión'};const weeks=Math.max(0,Math.ceil((Date.parse(contractEnd(p))-Date.parse(day))/(7*86400000))),fee=Math.round(p.salario*Math.min(weeks,52)*.5);return{ok:true,fee,weeks,remainingWages:weeks*p.salario,reason:'Acuerdo mutuo simulado: 50% de hasta 52 semanas pendientes; el jugador puede rechazarlo'} }
  function terminateContract(pid,confirmTerms=false){const p=player(Number(pid)),q=terminationQuote(p);if(!q.ok)return q;if(locked())return {ok:false,reason:'Terminá el partido antes de rescindir'};if(!confirmTerms)return{...q,ok:false,reason:'Confirmá la indemnización antes de rescindir'};if(!ai().canRelease(p).ok)return{ok:false,reason:ai().canRelease(p).reason};if(ai().availableBudget(GameState.userClub.id,window.FM_RENEWALS?.current(p.id)?.id)<q.fee)return{ok:false,reason:'No hay fondos disponibles para la indemnización'};if(p.personalidad==='Ambicioso'&&p.moral>85)return{ok:false,reason:'El representante rechazó una rescisión de mutuo acuerdo'};const state=ensure(),id='termination-'+p.id+'-'+GameState.today;if(state.terminations.some(row=>row.id===id))return{ok:false,reason:'La rescisión ya fue liquidada'};const from=p.clubId;if(!ai().transaction(from,-q.fee,`Indemnización por rescisión: ${p.nombre}`,'indemnizaciones'))return{ok:false,reason:'La caja no alcanza'};state.terminations.push({id,playerId:p.id,clubId:from,date:GameState.today,fee:q.fee});p.clubId=null;p.registered=false;p.contractEnd=GameState.today;window.FM_RENEWALS?.invalidatePlayer(p.id,'Se rescindió el contrato vigente');p.contract=Number(GameState.today.slice(0,4));window.FM_REGISTRATION?.onTransfer(p,from,null);window.FM_FINANCES?.onTermination(p,q.fee,from);WORLD_ENGINE.reindex();autoLineup();message('Rescisión acordada',`${p.nombre} queda libre. Indemnización liquidada: ${cash(q.fee)}.`,{playerId:p.id},'contratos');saveGame(true);render();return{ok:true,fee:q.fee}}
  function recallLoan(id){const loan=ensure()?.loans.find(l=>l.id===id&&l.status==='active'),p=loan&&player(loan.playerId);if(!loan||!p||loan.ownerClub!==GameState.userClub.id||!loan.recallAllowed)return{ok:false,reason:'El préstamo no incluye derecho de regreso'};if(locked()||GameState.today<loan.recallFrom||!registrationOpen(GameState.today,loan.ownerClub))return{ok:false,reason:'El regreso requiere tres meses cumplidos y ventana abierta del propietario'};if(['mandatory','conditional'].includes(loan.purchaseMode))return{ok:false,reason:'No puede revocarse una obligación de compra pactada'};loan.endDate=GameState.today;loan.recalled=true;returnLoans(GameState.today);saveGame(true);render();return{ok:true}}
  function royaltyFor(p,fromClub) {
    const clause=p.sellOnClause;
    return clause&&clause.ownerClub===fromClub&&clause.beneficiaryClub&&clause.beneficiaryClub!==fromClub&&Number.isFinite(clause.percent)&&clause.percent>0?{clubId:clause.beneficiaryClub,percent:clause.percent}:null;
  }
  function payRoyalty(seller,fee,royalty,label) {
    if (!royalty||!club(royalty.clubId)) return 0;
    const share=Math.round(fee*royalty.percent/100);if (!share) return 0;
    if (!ai().transaction(seller,-share,`Porcentaje de futura venta: ${label}`,'clausulas')) return 0;
    ai().transaction(royalty.clubId,share,`Cobro por futura venta: ${label}`,'clausulas');
    if (royalty.clubId===GameState.userClub.id) message('Cobro de una cláusula',`Ingresaron ${cash(share)} por el porcentaje de futura venta de ${label}.`,null,'finanzas');
    return share;
  }
  function onResale(p,from,to,fee) {
    if (!world()||activeLoan(p)) return 0;
    const royalty=royaltyFor(p,from),paid=payRoyalty(from,amount(fee),royalty,p.nombre);
    if (royalty) delete p.sellOnClause;return paid;
  }
  function executeTransfer(raw) {
    if (!world()) return {ok:false,reason:'Carrera incompatible'};
    const state=ensure(),offer=normalise(raw),p=player(offer.playerId);
    if (['accepted','rejected','cancelled'].includes(raw?.status)||(offer.id&&state.completedTransfers.includes(offer.id))) return {ok:false,reason:'Esta transferencia ya está resuelta'};
    const reason=termsReason(offer,p)||statusReason(p,offer.toClub,offer.dealType==='loan'?amount(p?.salario*offer.wageShare/100):offer.wage,offer);
    if (reason) return {ok:false,reason};
    if (p.clubId===GameState.userClub.id&&offer.toClub!==GameState.userClub.id&&offer.type!=='sell') return {ok:false,reason:'La venta requiere una oferta aceptada por el entrenador'};
    const before=p.clubId,royalty=offer.dealType==='permanent'?royaltyFor(p,before):null;
    const installments=offer.dealType==='permanent'?offer.installments:0;
    const initialFee=installments?Math.round(offer.fee*offer.upfrontPercent/100):offer.fee;
    const payment=initialFee+offer.bonus;
    if (!ai().transaction(offer.toClub,-payment,`${offer.dealType==='loan'?'Cargo de préstamo':'Fichaje y prima'}: ${p.nombre}`,offer.dealType==='loan'?'prestamos':'fichajes')) return {ok:false,reason:'La caja no alcanza para el pago inicial'};
    if (before&&initialFee) {ai().transaction(before,initialFee,`${offer.dealType==='loan'?'Cargo de préstamo cobrado':'Venta'}: ${p.nombre}`,offer.dealType==='loan'?'prestamos':'ventas');if(royalty)payRoyalty(before,initialFee,royalty,p.nombre)}
    if (installments&&offer.fee>initialFee) {
      const remaining=offer.fee-initialFee,base=Math.floor(remaining/installments);
      for (let n=1;n<=installments;n++) ensure().payments.push({id:nextId('payment'),offerId:offer.id||nextId('transfer'),playerId:p.id,fromClub:offer.toClub,toClub:before,amount:n===installments?remaining-base*(installments-1):base,dueDate:addMonths(GameState.today,n),status:'pending',...(royalty?{royalty}:{} )});
    }
    p.clubId=offer.toClub;window.FM_RENEWALS?.invalidatePlayer(p.id,'El jugador cambió de club');p.registered=true;p.moral=85;window.FM_REGISTRATION?.onTransfer(p,before,offer.toClub);
    if (offer.dealType==='loan') {
      const loan={id:nextId('loan'),playerId:p.id,ownerClub:before,borrowerClub:offer.toClub,startDate:GameState.today,endDate:addMonths(GameState.today,offer.loanMonths),wageShare:offer.wageShare,ownerWage:p.salario,ownerRole:p.squadRole||null,ownerBonuses:structuredClone(p.contractBonuses||{}),status:'active',purchaseMode:offer.purchaseMode||'none',purchaseFee:offer.purchaseFee||0,playingTime:offer.playingTime||'Rotación',recallAllowed:offer.recallAllowed,recallFrom:addMonths(GameState.today,Math.min(3,offer.loanMonths)),purchaseAppearances:offer.purchaseAppearances||10,startAppearances:p.appearances||0,ownerContractEnd:contractEnd(p)};
      ensure().loans.push(loan);p.loanId=loan.id;
    } else {
      p.salario=offer.wage;setContract(p,offer.years,GameState.today,{annualIncrease:offer.annualIncrease,releaseClause:offer.releaseClause});
      delete p.sellOnClause;
      if (before&&offer.sellOnPercent>0)p.sellOnClause={beneficiaryClub:before,ownerClub:offer.toClub,percent:offer.sellOnPercent};
    }
    GameState.transferListed=GameState.transferListed.filter(id=>id!==p.id);
    if (offer.id) {state.completedTransfers.push(offer.id);state.completedTransfers=state.completedTransfers.slice(-160)}
    WORLD_ENGINE.reindex();
    if(offer.playingTime){p.squadRole=offer.playingTime;p.contractBonuses={appearance:amount(offer.appearanceBonus),goal:amount(offer.goalBonus),cleanSheet:amount(offer.cleanSheetBonus),title:amount(offer.titleBonus)};if(p.clubId===GameState.userClub.id)window.FM_DRESSING_ROOM?.onSigning?.(p,offer.playingTime)}
    if (before===GameState.userClub.id||offer.toClub===GameState.userClub.id) {GameState.userClub.cupos_extranjeros_usados=foreigners(GameState.userClub.id);autoLineup()}
    window.FM_FINANCES?.onTransfer({id:offer.id||'transfer-'+p.id+'-'+GameState.today,playerId:p.id,fromClub:before,toClub:offer.toClub,fee:offer.fee,bonus:offer.bonus,years:offer.years,dealType:offer.dealType,installments,date:GameState.today,contractEnd:contractEnd(p)});
    ai().recordTransfer({date:GameState.today,playerId:p.id,playerName:p.nombre,fromClub:before,toClub:offer.toClub,fee:offer.fee,wage:offer.wage,dealType:offer.dealType,installments,sellOnPercent:offer.sellOnPercent});
    return {ok:true,offer};
  }
  function agreeTransfer(raw) {
    if(!world())return {ok:false,reason:'Carrera incompatible'};
    const state=ensure(),offer=normalise(raw),p=player(offer.playerId);
    if(!p)return {ok:false,reason:'Jugador no encontrado'};
    if(['accepted','rejected','cancelled','expired'].includes(raw?.status)||(offer.id&&state.completedTransfers.includes(offer.id)))return {ok:false,reason:'Esta transferencia ya está resuelta'};
    if(raw.awaitingRegistration||state.registrations.some(row=>row.offerId===offer.id&&row.status==='agreed'))return {ok:false,reason:'El acuerdo ya está firmado y espera inscripción'};
    if(!offer.precontract&&(registrationOpen(GameState.today,offer.toClub)||!p.clubId))return executeTransfer(raw);
    offer.registrationDate=offer.precontract?nextRegistrationDate(addDays(contractEnd(p),1),offer.toClub):nextRegistrationDate(GameState.today,offer.toClub);
    const reason=termsReason(offer,p)||statusReason(p,offer.toClub,offer.dealType==='loan'?amount(p.salario*offer.wageShare/100):offer.wage,offer);
    if(reason)return {ok:false,reason};
    if(!offer.precontract&&contractEnd(p)<offer.registrationDate)return {ok:false,reason:'El contrato actual vence antes de la inscripción: el club no puede comprometer su pase para esa fecha'};
    if(p.clubId===GameState.userClub.id&&offer.toClub!==GameState.userClub.id&&offer.type!=='sell')return {ok:false,reason:'La venta requiere una oferta aceptada por el entrenador'};
    offer.id ||= nextId('agreement');
    Object.assign(offer,{status:'pending',stage:'registration',awaitingRegistration:true,awaitingUser:false,awaitingPlayerTerms:false,agreedDate:GameState.today});delete offer.counter;
    Object.assign(raw,offer);
    if(!byId(offer.id))GameState.offers.unshift(raw);
    state.registrations.push({id:nextId('registration'),offerId:offer.id,playerId:p.id,status:'agreed',registrationDate:offer.registrationDate,agreedDate:GameState.today,offer:structuredClone(offer)});
    message(offer.precontract?'Precontrato firmado':'Acuerdo para la próxima ventana',`${p.nombre} firmó su ${offer.dealType==='loan'?'préstamo':'traspaso'} a ${clubName(offer.toClub)}. La inscripción será el ${date(offer.registrationDate)}. Hasta entonces continúa en ${clubName(offer.fromClub)}. El pase, la prima, la plaza y el salario quedan comprometidos; el pago comienza al incorporarse.`,offer);
    return {ok:true,deferred:true,offer};
  }
  function registerAgreements(day=GameState.today) {
    if(!world()||!validDay(day))return 0;
    const state=ensure();restoreAgreements();let count=0;
    for(const row of state.registrations.filter(row=>row.status==='agreed'&&row.registrationDate<=day)){
      const offer=byId(row.offerId),p=player(row.playerId);
      if(!offer||!registrationOpen(day,offer.toClub))continue;
      if(offer.precontract&&p?.clubId==null){offer.fromClub=null;row.offer.fromClub=null}
      if(!p||p.clubId!==offer.fromClub){row.status='failed';row.reason='El jugador ya no pertenece al club que firmó';offer.status='cancelled';offer.awaitingRegistration=false;message('Acuerdo de inscripción sin efecto',`${p?.nombre||'Jugador'}: ${row.reason}. Se liberan los compromisos reservados.`,offer);continue}
      const executionOffer=offer.precontract?{...offer,precontract:false,fromClub:p.clubId,fee:0}:offer;
      const result=executeTransfer(executionOffer);
      if(!result.ok){if(row.lastNotice!==result.reason){row.lastNotice=result.reason;message('Inscripción pendiente de resolver',`${p.nombre}: ${result.reason}. El acuerdo sigue vigente y los fondos reservados. La secretaría volverá a intentar la inscripción al avanzar el día.`,offer)}continue}
      row.status='registered';row.registeredDate=day;offer.status='accepted';offer.awaitingRegistration=false;offer.resolvedDate=day;count++;
      message('Incorporación inscrita',`${p.nombre} ya pertenece a ${clubName(offer.toClub)}. Se ejecutó el acuerdo firmado el ${date(row.agreedDate)} por ${cash(offer.fee)}${offer.dealType==='loan'?`, hasta ${date(addMonths(day,offer.loanMonths))}`:''}.`,offer);
    }
    state.registrations=[...state.registrations.filter(row=>row.status==='agreed'),...state.registrations.filter(row=>row.status!=='agreed').slice(-80)];
    return count;
  }
  function settle(day=GameState.today) {
    if (!world()||!validDay(day)) return;
    const state=ensure();progressContracts(day);window.FM_RENEWALS?.process();registerAgreements(day);expireOffers(day);
    for (const row of state.payments.filter(row=>row.status!=='paid'&&row.dueDate<=day).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))) {
      const p=player(row.playerId),label=p?.nombre||'Traspaso';
      if (!ai().transaction(row.fromClub,-row.amount,`Cuota de traspaso: ${label} (${row.dueDate})`,'cuotas')) {
        if (!row.overdueNotified&&row.fromClub===GameState.userClub.id) {message('Cuota pendiente de pago',`La cuota de ${cash(row.amount)} por ${label}, vencida el ${row.dueDate}, sigue pendiente por falta de caja. Se abonará cuando haya fondos.`,null,'finanzas');row.overdueNotified=true}
        continue;
      }
      if (row.toClub) {ai().transaction(row.toClub,row.amount,`Cobro de cuota: ${label}`,'cuotas');payRoyalty(row.toClub,row.amount,row.royalty,label)}
      row.status='paid';row.paidDate=day;
      if (row.fromClub===GameState.userClub.id||row.toClub===GameState.userClub.id) message(row.fromClub===GameState.userClub.id?'Cuota abonada':'Cuota cobrada',`${label}: ${cash(row.amount)}. Vencimiento original ${row.dueDate}.`,null,'finanzas');
    }
    trim();
  }
  function purchaseLoan(id,automatic=false){
    const loan=ensure()?.loans.find(l=>l.id===id&&l.status==='active'),p=loan&&player(loan.playerId);
    const fail=reason=>({ok:false,reason});
    if(!loan||!p||p.clubId!==loan.borrowerClub||!['option','mandatory','conditional'].includes(loan.purchaseMode))return fail('La compra no está disponible');
    if(loan.purchaseMode==='conditional'&&(p.appearances||0)-(loan.startAppearances||0)<loan.purchaseAppearances)return fail('Todavía no se alcanzó la condición de partidos');
    if(!automatic&&(locked()||loan.borrowerClub!==GameState.userClub.id))return fail('Sólo el club prestatario puede ejecutar la opción fuera de un partido');
    const beforeClub=p.clubId,loanId=p.loanId;loan.status='purchasing';p.clubId=loan.ownerClub;delete p.loanId;WORLD_ENGINE.reindex();
    const result=executeTransfer({id:'purchase-'+loan.id,type:loan.ownerClub===GameState.userClub.id?'sell':'buy',dealType:'permanent',playerId:p.id,fromClub:loan.ownerClub,toClub:loan.borrowerClub,fee:loan.purchaseFee,wage:loan.ownerWage,bonus:0,years:Math.max(1,Math.min(5,p.contract-GameState.year)),releaseClause:p.clausula_rescision,playingTime:loan.playingTime,appearanceBonus:p.contractBonuses?.appearance||0,goalBonus:p.contractBonuses?.goal||0,cleanSheetBonus:p.contractBonuses?.cleanSheet||0,titleBonus:p.contractBonuses?.title||0});
    if(!result.ok){p.clubId=beforeClub;p.loanId=loanId;loan.status='active';WORLD_ENGINE.reindex();return result}
    loan.status='purchased';loan.purchaseDate=GameState.today;
    if([loan.ownerClub,loan.borrowerClub].includes(GameState.userClub.id))message('Compra de cedido ejecutada',`${p.nombre}: pase definitivo por ${cash(loan.purchaseFee)}. Se mantienen el salario y las condiciones personales pactadas.`,{playerId:p.id},'contratos');
    if(!automatic){saveGame(true);render()}return result;
  }
  function returnLoans(day=GameState.today) {
    if (!world()||!validDay(day)) return;
    let changed=false;
    for (const loan of ensure().loans.filter(row=>row.status==='active'&&row.endDate<=day)) {
      const p=player(loan.playerId);if((loan.purchaseMode==='mandatory'||loan.purchaseMode==='conditional'&&(p?.appearances||0)-(loan.startAppearances||0)>=loan.purchaseAppearances)&&p?.clubId===loan.borrowerClub){const result=purchaseLoan(loan.id,true);if(!result.ok&&!loan.purchaseNotice){loan.purchaseNotice=true;if([loan.ownerClub,loan.borrowerClub].includes(GameState.userClub.id))message('Compra obligatoria pendiente',`${p.nombre}: ${result.reason}. Sigue cedido hasta resolver el compromiso; la obligación no se cancela por falta de fondos.`,{id:loan.id,playerId:p.id},'contratos')}continue}loan.status='returned';loan.returnDate=day;
      if (!p) continue;
      if (p.clubId===loan.borrowerClub) {p.clubId=loan.ownerClub;p.salario=loan.ownerWage;p.registered=true;window.FM_REGISTRATION?.onTransfer(p,loan.borrowerClub,loan.ownerClub);if(loan.ownerRole)p.squadRole=loan.ownerRole;else delete p.squadRole;if(loan.ownerBonuses)p.contractBonuses=structuredClone(loan.ownerBonuses);changed=true}
      delete p.loanId;
      if ([loan.ownerClub,loan.borrowerClub].includes(GameState.userClub.id)) message('Fin del préstamo',`${p.nombre} regresa a ${clubName(loan.ownerClub)} al cumplirse el préstamo.`,{id:loan.id,playerId:p.id},'contratos');
    }
    if (changed) {WORLD_ENGINE.reindex();GameState.userClub.cupos_extranjeros_usados=foreigners(GameState.userClub.id);autoLineup()}
    trim();
  }
  function trim() {
    const state=ensure();if (!state) return;
    state.payments=[...state.payments.filter(row=>row.status!=='paid'),...state.payments.filter(row=>row.status==='paid').slice(-120)];
    state.loans=[...state.loans.filter(row=>row.status==='active'),...state.loans.filter(row=>row.status!=='active').slice(-80)];
    GameState.offers=[...GameState.offers.filter(pending),...GameState.offers.filter(o=>!pending(o)).slice(0,100)];
  }
  // Display only terms that belong to this operation; legacy saves retain defaults.
  function offerPresentation(o) {
    const t=o.awaitingUser&&o.counter?{...o,...o.counter}:o,p=player(o.playerId);
    const renewal=o.type==='renewal',loan=!renewal&&t.dealType==='loan',free=!renewal&&!loan&&(t.precontract||!t.fromClub);
    const label=renewal?'Renovación':loan?'Préstamo':t.precontract?'Precontrato':free?'Incorporación libre':o.type==='sell'?'Venta definitiva':'Compra definitiva';
    const facts=[['Modalidad',label]],personal=renewal||(!loan&&(o.stage==='player'||o.type==='sell'||o.awaitingRegistration||o.status==='accepted'||free));
    if(!renewal)facts.push([loan?'Cargo de cesión':'Importe del pase',money(free?0:t.fee||0)]);
    if(loan){
      facts.push(['Duración del préstamo',`${t.loanMonths||6} meses`]);
      const share=Number(t.wageShare??100),wage=p?.salario||t.wage||0;
      facts.push(['Salario vigente del propietario',`${money(wage)} / semana`]);
      facts.push([o.type==='sell'?'Salario a cargo del club receptor':'Salario a tu cargo',`${share}% · ${money(Math.round(wage*share/100))} / semana`]);
      facts.push([o.type==='sell'?'Salario que conserva tu club':'Salario a cargo del propietario',`${100-share}% · ${money(Math.round(wage*(100-share)/100))} / semana`]);
      const modes={option:'Opción de compra',mandatory:'Obligación de compra',conditional:'Obligación por partidos'};
      facts.push(['Compra futura',modes[t.purchaseMode]||'Sin opción ni obligación']);
      if(modes[t.purchaseMode])facts.push(['Precio de compra futura',money(t.purchaseFee||0)]);
      if(t.purchaseMode==='conditional')facts.push(['Partidos para activar compra',String(t.purchaseAppearances||10)]);
    }else{
      if(!renewal&&!free){
        facts.push(['Forma de pago',t.installments?`${typeof t.installments==='number'?t.installments:t.installments.count||''} cuotas mensuales`:'Al contado']);
        if(t.installments&&t.upfrontPercent!=null)facts.push(['Pago inicial',`${t.upfrontPercent}%`]);
        const future=t.sellOnPercent||t.sellOnPct||t.futureSalePct;if(future)facts.push(['Venta futura para el vendedor',`${future}%`]);
      }
      if(personal){
        facts.push(['Salario semanal',money(t.wage||p?.salario||0)]);
        if(t.years)facts.push(['Duración del contrato',`${t.years} años`]);
        if(t.annualIncrease)facts.push(['Aumento anual',`${t.annualIncrease}%`]);
        if(t.releaseClause)facts.push(['Cláusula de rescisión',money(t.releaseClause)]);
        if(t.bonus)facts.push(['Prima de firma',money(t.bonus)]);
      }
    }
    if(t.playingTime&&(personal||loan&&o.stage==='player'))facts.push(['Papel en el plantel',t.playingTime]);
    if(t.precontract&&t.registrationDate)facts.push(['Incorporación',date(t.registrationDate)]);
    const compact=facts.filter(([key])=>!['Modalidad','Salario vigente del propietario','Salario a cargo del propietario','Salario que conserva tu club'].includes(key)).map(([key,value])=>`${key}: ${value}`).join(' · ');
    return {terms:t,label,facts,compact,loan};
  }
  function summary() {
    if (!world()) return legacySummary?legacySummary():'';
    const user=GameState.userClub.id,rows=GameState.offers.filter(pending),obligations=ensure().payments.filter(row=>row.fromClub===user&&row.status!=='paid'),receivables=ensure().payments.filter(row=>row.toClub===user&&row.status!=='paid');
    const numbers=`<div class="fm-offer-summary"><strong>${cash(ai().availableBudget(user))} disponibles para nuevos pases</strong><span class="small muted">${cash(reserved(user))} reservados · ${cash(obligations.reduce((s,r)=>s+r.amount,0))} en cuotas por pagar · ${cash(receivables.reduce((s,r)=>s+r.amount,0))} por cobrar</span></div>`;
    const offers=rows.map(o=>{const p=player(o.playerId);if(!p)return '';const presentation=offerPresentation(o),loan=presentation.loan;return `<div class="fm-list-row row between"><div><strong>${esc(p.nombre)}</strong><div class="small muted">${o.awaitingRegistration?'Acuerdo firmado · inscripción '+esc(date(o.registrationDate)):o.type==='buy'?(o.awaitingPlayerTerms?(loan?'Club aceptó · falta acordar con el jugador':'Club aceptó · falta negociar el contrato'):o.awaitingUser?'Contraoferta recibida':dailyClock()&&validDay(o.responseDate)?'Oferta enviada · respuesta a partir del '+esc(date(o.responseDate)):'Oferta enviada · respuesta próxima jornada'):'Oferta de '+esc(clubName(o.toClub))} · ${esc(presentation.label)} · ${esc(presentation.compact)}</div></div>${o.awaitingRegistration?`<span class="badge">${esc(date(o.registrationDate))} · fondos comprometidos</span>`:o.awaitingPlayerTerms?`<div class="row"><button class="primary" data-contract-player="${esc(o.id)}" ${locked()?'disabled':''}>Negociar contrato</button><button data-contract-cancel="${esc(o.id)}">Retirar</button></div>`:o.type==='sell'&&o.saleResponsePending?`<span class="badge">Esperando respuesta del comprador</span>`:o.type==='buy'&&o.awaitingUser?`<div class="row"><button data-negotiate-counter="${esc(o.id)}">Contraofertar</button><button data-contract-counter="${esc(o.id)}" data-decision="accept" ${locked()?'disabled':''}>Aceptar condiciones</button><button data-contract-counter="${esc(o.id)}" data-decision="reject" ${locked()?'disabled':''}>Retirar oferta</button></div>`:o.type==='sell'?`<div class="row"><button data-negotiate-counter="${esc(o.id)}">Contraofertar</button><button data-sale="${esc(o.id)}" data-decision="accept" ${locked()?'disabled':''}>Aceptar</button><button data-sale="${esc(o.id)}" data-decision="reject" ${locked()?'disabled':''}>Rechazar</button></div>`:`<div class="row"><span class="badge">En negociación</span><button data-contract-cancel="${esc(o.id)}" ${locked()?'disabled':''}>Retirar</button></div>`}</div>`}).join('');
    const schedule=obligations.length?`<details class="card"><summary>Calendario de cuotas (${obligations.length})</summary><div class="scroll"><table><thead><tr><th>Jugador</th><th>Vencimiento</th><th>Importe</th><th>Estado</th></tr></thead><tbody>${obligations.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,36).map(row=>`<tr><td>${esc(player(row.playerId)?.nombre||'Traspaso')}</td><td>${esc(row.dueDate)}</td><td>${cash(row.amount)}</td><td class="${row.dueDate<GameState.today?'red':'muted'}">${row.dueDate<GameState.today?'Vencida':'Programada'}</td></tr>`).join('')}</tbody></table></div></details>`:'';
    const loans=ensure().loans.filter(row=>row.status==='active'&&(row.borrowerClub===user||row.ownerClub===user));
    const loanRows=loans.length?`<details class="card"><summary>Préstamos activos (${loans.length})</summary>${loans.map(row=>`<div class="fm-list-row"><strong>${esc(player(row.playerId)?.nombre||'Jugador')}</strong><p class="small muted">${esc(clubName(row.ownerClub))} → ${esc(clubName(row.borrowerClub))} · regreso ${esc(row.endDate)} · tu parte salarial ${cash(loanWageFor(player(row.playerId),user))}/semana${row.purchaseMode&&row.purchaseMode!=='none'?` · ${row.purchaseMode==='mandatory'?'Obligación':row.purchaseMode==='conditional'?'Compra a '+row.purchaseAppearances+' partidos':'Opción'} de compra: ${cash(row.purchaseFee)}`:''}</p>${row.recallAllowed&&row.ownerClub===user?`<button data-contract-recall="${esc(row.id)}">Solicitar regreso</button>`:''}${row.purchaseMode==='option'&&row.borrowerClub===user?`<button data-depth-purchase="${esc(row.id)}">Ejecutar opción de compra</button>`:''}</div>`).join('')}</details>`:'';
    const movements=GameState.world.ai.log?.filter(row=>row.type==='transfer'||row.type==='renewal').slice(0,12)||[],battles=GameState.world.ai.competition?.slice(0,4)||[];
    const activity=`<details class="card"><summary>Mercado entre clubes · ${movements.length} operaciones recientes</summary>${movements.length?`<div class="scroll"><table><thead><tr><th>Fecha</th><th>Jugador</th><th>Clubes / contrato</th><th>Operación</th><th>Importe</th></tr></thead><tbody>${movements.map(row=>`<tr><td>${esc(row.date)}</td><td><button class="fm-player-link" data-player="${row.playerId}">${esc(player(row.playerId)?.nombre||row.playerName||'Jugador')}</button></td><td>${row.type==='renewal'?`${clubLink(row.clubId)} · hasta ${row.until}`:`${clubLink(row.fromClub)} → ${clubLink(row.toClub)}`}</td><td>${row.type==='renewal'?'Renovación':row.dealType==='loan'?'Préstamo':'Compra'}${row.installments?` · ${row.installments} cuotas`:''}</td><td>${cash(row.fee)}${row.type==='renewal'?'<span class="fm-player-sub">Prima de firma</span>':''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted">Los clubes buscan refuerzos y negocian durante el mercado. El registro se actualiza al avanzar el calendario.</p>'}${battles.length?`<h3>Disputas por jugadores</h3>${battles.map(row=>`<div class="fm-list-row"><button class="fm-player-link" data-player="${row.playerId}">${esc(player(row.playerId)?.nombre||'Jugador')}</button><p class="small muted">${esc((row.bidders||[]).map(clubName).join(' · '))}${row.winner?` · destino elegido: ${esc(clubName(row.winner))}`:' · propuesta en evaluación'}</p></div>`).join('')}`:''}</details>`;
    return (window.FM_RENEWALS?.summary()||'')+numbers+offers+schedule+loanRows+activity;
  }
  function updateForm(form) {
    const loan=form.elements.dealType.value==='loan';
    for (const block of form.querySelectorAll('[data-contract-group]')) {const visible=block.dataset.contractGroup===(loan?'loan':'permanent');block.hidden=!visible;for(const input of block.querySelectorAll('input,select'))input.disabled=!visible}
    const fee=form.elements.fee,p=player(Number(form.dataset.playerId));
    fee.readOnly=!p.clubId;form.querySelector('[data-contract-fee-label]').textContent=loan?'Cargo por préstamo (USD)':'Oferta de traspaso (USD)';
    const installments=form.elements.installments;
    if (installments) {form.elements.upfrontPercent.disabled=loan||installments.value==='0';form.elements.upfrontPercent.closest('label').hidden=loan||installments.value==='0'}
    if (!loan&&form.elements.activateClause?.checked) {fee.value=p.clausula_rescision;installments.value='0';form.elements.upfrontPercent.closest('label').hidden=true;form.elements.upfrontPercent.disabled=true}
  }
  buy=function(id) {
    if (!world()) return legacyBuy(id);
    if (locked()) return toast('Terminá el partido antes de negociar');
    ai().ensure();ensure();const p=player(Number(id));
    if (!p||p.clubId===GameState.userClub.id) return;
    if (activeLoan(p)) return toast('El jugador ya está cedido a préstamo');
    if (GameState.offers.some(o=>pending(o)&&o.playerId===p.id)) return toast('Ya hay una oferta pendiente; revisala en el mercado');
    const fee=p.clubId?transferCost(p):0;
    $('#details').innerHTML=`<div class="small gold">NEGOCIACIÓN CON ${esc(clubName(p.clubId)).toUpperCase()}</div><h2>${esc(p.nombre)}</h2><p class="muted">${esc(p.posicion)} · ${p.edad} años · ${esc(p.nacionalidad)}. ${p.clubId?'Elegí un pase definitivo o una cesión temporal.':'Agente libre: no requiere traspaso.'}</p><form id="negotiation" data-player-id="${p.id}">${offerResources()}<label class="field">Tipo de incorporación<select name="dealType"><option value="permanent">Compra definitiva</option>${p.clubId?'<option value="loan">Préstamo</option>':''}</select></label><label class="field"><span data-contract-fee-label>Oferta de traspaso (USD)</span><input name="fee" type="number" min="0" max="10000000000" step="1" value="${fee}" ${!p.clubId?'readonly':''} required></label><div data-contract-group="permanent"><label class="field">Salario semanal (USD)<input name="wage" type="number" min="100" max="10000000" step="1" value="${Math.ceil(p.salario*1.15/100)*100}" required></label><div class="grid cols2"><label class="field">Duración<select name="years">${[1,2,3,4,5].map(n=>`<option ${n===3?'selected':''}>${n}</option>`).join('')}</select></label><label class="field">Prima de firma (USD)<input name="bonus" type="number" min="0" max="1000000000" step="1" value="${p.salario*6}" required></label></div><div class="grid cols2"><label class="field">Pago del pase<select name="installments"><option value="0">Al contado</option><option value="3">3 cuotas mensuales</option><option value="6">6 cuotas mensuales</option><option value="12">12 cuotas mensuales</option></select></label><label class="field">Pago inicial (%)<input name="upfrontPercent" type="number" min="25" max="100" step="5" value="50"></label></div><div class="grid cols2"><label class="field">Futura venta para el club vendedor (%)<input name="sellOnPercent" type="number" min="0" max="30" step="1" value="0"></label><label class="field">Cláusula de rescisión del nuevo contrato (USD)<input name="releaseClause" type="number" min="0" step="1" value="${p.clausula_rescision}" required></label></div>${p.clubId?`<label class="row small"><input name="activateClause" type="checkbox"> Activar cláusula actual: ${cash(p.clausula_rescision)} al contado</label>`:''}</div><div data-contract-group="loan" hidden><div class="grid cols2"><label class="field">Duración del préstamo<select name="loanMonths"><option value="6">6 meses</option><option value="12">12 meses</option></select></label><label class="field">Salario a tu cargo (%)<input name="wageShare" type="number" min="0" max="100" step="5" value="100" required></label></div><p class="small muted">Salario actual: ${cash(p.salario)} por semana. El club propietario paga el resto. El jugador regresa automáticamente al finalizar; la cesión no transfiere sus derechos.</p></div><p class="small muted">Fondos disponibles: ${cash(ai().availableBudget(GameState.userClub.id))}. Las ofertas y todas las cuotas del pase reservan presupuesto. Las cuotas se pagan mes a mes; no permiten comprometer dinero que no tenés. Respuesta ${dailyClock()?'a partir del día siguiente':'en la próxima jornada'}.</p><div class="world-offer-feedback" data-offer-feedback role="alert" tabindex="-1" hidden><strong data-offer-error></strong><p data-offer-hint hidden></p><button type="button" data-contract-help hidden></button></div><div class="row"><button class="primary" type="submit">Enviar oferta</button><button type="button" data-action="close">Cancelar</button></div></form>`;
    updateForm($('#negotiation'));$('#details').showModal();
  };
  transferSummary=summary;
  document.addEventListener('change',event=>{const form=event.target.closest?.('#negotiation');if(world()&&form&&form.dataset.stage!=='club'&&['dealType','installments','activateClause'].includes(event.target.name)){if(event.target.name==='dealType'){const p=player(Number(form.dataset.playerId));form.elements.fee.value=event.target.value==='loan'?Math.max(p.salario*4,Math.round(p.valor_mercado*.025)):p.clubId?transferCost(p):0}updateForm(form)}});
  document.addEventListener('click',event=>{const recall=event.target.closest?.('[data-contract-recall]');if(recall){const result=recallLoan(recall.dataset.contractRecall);if(!result.ok)toast(result.reason)}const button=event.target.closest?.('[data-contract-counter],[data-contract-cancel]');if(!button||button.disabled||!world())return;if(button.dataset.contractCounter)respondCounter(button.dataset.contractCounter,button.dataset.decision==='accept');else cancelOffer(button.dataset.contractCancel)});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-contract-help]');if(!button||button.disabled||button.hidden||!world())return;const destination=button.dataset.contractHelp;if(!['squad','finances'].includes(destination))return;$('#details').close();view=destination;render()});
  document.addEventListener('invalid',event=>{
    const field=event.target,form=field.closest?.('#negotiation');if(!form||!world())return;
    event.preventDefault();
    const names={fee:'el importe del pase',wage:'el salario semanal',bonus:'la prima de firma',releaseClause:'la cláusula de rescisión',upfrontPercent:'el pago inicial',sellOnPercent:'el porcentaje de futura venta',wageShare:'el reparto salarial'};
    let reason=`Revisá ${names[field.name]||'este campo'}.`;
    if(field.validity.valueMissing)reason+=' Completá el valor antes de enviar la oferta.';
    else if(field.validity.rangeUnderflow)reason+=` El mínimo permitido es ${field.min}.`;
    else if(field.validity.rangeOverflow)reason+=` El máximo permitido es ${field.max}.`;
    else if(field.validity.stepMismatch)reason+=' Usá un valor compatible con el incremento del campo.';
    else reason+=' Ingresá un número válido.';
    offerFeedback(form,reason);
  },true);
  function renewContract(pid,terms={}) {return window.FM_RENEWALS?FM_RENEWALS.submit(pid,terms):{ok:false,reason:'La negociación de renovación no está disponible'}}
  const legacyRenew=renew;renew=function(pid){if(!world())return legacyRenew(pid);if(typeof MARKET_CONTRACTS.openRenewal==='function')return MARKET_CONTRACTS.openRenewal(pid);return legacyRenew(pid)};
  window.MARKET_CONTRACTS={offerPresentation,ensure,contractEnd,setContract,migrateContracts,renewContract,precontractEligibility,requestPrecontractConsent,progressContracts,terminationQuote,terminateContract,recallLoan,submitOffer,submitPlayerTerms,processOffers,settle,returnLoans,purchaseLoan,executeTransfer,agreeTransfer,registerAgreements,restoreAgreements,registrationOpen,nextRegistrationDate,negotiationProfile,committed,futureSlots,onResale,reserved,pendingWages,loanWageFor,returnSlots,respondCounter,counterOffer,clubNegotiation,processSaleCounters,cancelOffer,expireOffers,summary,addMonths,offerFeedback,offerResources};
})();
