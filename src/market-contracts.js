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
    state.payments ??= []; state.loans ??= []; state.completedTransfers ??= []; state.nextId ??= 1;
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
    return obligations + offers.reduce((sum,o)=>sum+amount(o.fee)+amount(o.bonus),0);
  }
  function pendingWages(id=GameState?.userClub.id, excludingId=null) {
    if (!world()) return 0;
    return GameState.offers.filter(o=>pending(o)&&o.type==='buy'&&(o.toClub||GameState.userClub.id)===id&&o.id!==excludingId)
      .reduce((sum,o)=>sum+(o.dealType==='loan'?amount((player(o.playerId)?.salario||o.wage)*Number(o.wageShare??100)/100):amount(o.wage)),0);
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
    if (p.clubId) {
      const releasable = ai().canRelease(p,p.clubId);
      if (releasable===false || (releasable && releasable.ok===false)) return 'El club necesita conservar cobertura en esa posición';
    }
    const receiving=ai().canReceive(p,to,wage,{excludeOfferId:offer.id});
    if (receiving===false||(receiving&&receiving.ok===false)) return receiving?.reason||'El club no puede inscribir al jugador';
    if (amount(offer.fee)+amount(offer.bonus)>ai().availableBudget(to,offer.id)) return 'No hay fondos para cubrir el pase y sus obligaciones';
    return '';
  }
  function normalise(raw) {
    raw=raw&&typeof raw==='object'?raw:{};
    const p=player(Number(raw.playerId)), type=raw.type==='sell'?'sell':'buy', dealType=raw.dealType==='loan'?'loan':'permanent';
    const parseMoney=(value,fallback=0)=>Math.round(Number(value??fallback));
    return {...raw,playerId:Number(raw.playerId),type,dealType,fromClub:Object.prototype.hasOwnProperty.call(raw,'fromClub')?raw.fromClub:p?.clubId??null,toClub:raw.toClub||GameState.userClub.id,
      fee:parseMoney(raw.fee),bonus:parseMoney(raw.bonus),wage:parseMoney(raw.wage,p?.salario),years:Number(raw.years??3),
      installments:Number(raw.installments??0),upfrontPercent:Number(raw.upfrontPercent??50),sellOnPercent:Number(raw.sellOnPercent??0),
      releaseClause:parseMoney(raw.releaseClause,p?.clausula_rescision),loanMonths:Number(raw.loanMonths??6),wageShare:Number(raw.wageShare??100),activateClause:raw.activateClause===true||raw.activateClause==='on'};
  }
  function termsReason(offer,p) {
    if (!p) return 'Jugador no encontrado';
    if (![offer.fee,offer.bonus,offer.wage,offer.years,offer.installments,offer.upfrontPercent,offer.sellOnPercent,offer.releaseClause,offer.loanMonths,offer.wageShare].every(Number.isFinite)) return 'Revisá los importes de la oferta';
    if (offer.fee<0||offer.fee>1e10||offer.bonus<0||offer.bonus>1e9||offer.wage<100||offer.wage>1e7) return 'Revisá el pase, la prima y el salario';
    if (!Number.isInteger(offer.years)||offer.years<1||offer.years>5||![0,3,6,12].includes(offer.installments)||offer.upfrontPercent<25||offer.upfrontPercent>100||offer.sellOnPercent<0||offer.sellOnPercent>30||offer.releaseClause<0) return 'Revisá la duración, las cuotas y las cláusulas';
    if (offer.dealType==='loan') {
      if (!p.clubId) return 'Un agente libre no puede llegar a préstamo';
      if (![6,12].includes(offer.loanMonths)||offer.wageShare<0||offer.wageShare>100) return 'Revisá la duración y el reparto salarial del préstamo';
      if (`${p.contract}-12-31`<addMonths(GameState.today,offer.loanMonths)) return 'El contrato del jugador vence antes de terminar el préstamo';
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
  function submitOffer(formOrObject) {
    if (!world()||locked()) return {ok:false,reason:'Terminá el partido antes de negociar'};
    ensure();ai().ensure();
    const reject = reason => {toast(reason);return {ok:false,reason}};
    if (!transferWindowOpen()) return reject('El mercado está cerrado: enero–marzo y julio–agosto');
    const raw = typeof HTMLFormElement!=='undefined'&&formOrObject instanceof HTMLFormElement ? formValues(formOrObject) : formOrObject;
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
  function demands(p,offer) {
    const selling=club(p.clubId),position=squad(p.clubId).filter(q=>q.posicion===p.posicion).sort((a,b)=>overall(b)-overall(a)),rank=position.findIndex(q=>q.id===p.id);
    if (offer.dealType==='loan') {
      const firstTeam=rank<Math.min(2,position.length-2);
      return {fee:Math.max(p.salario*4,Math.round(p.valor_mercado*(firstTeam?.09:.025))),wage:p.salario,wageShare:firstTeam?100:50,refuse:firstTeam&&overall(p)>=(selling?.rating||65)+4?'El club considera al jugador esencial y no acepta cederlo':''};
    }
    const competition=ai().interestFor?.(p.id),interestCount=Array.isArray(competition)?competition.length:0;
    const clause=offer.activateClause;
    const basePrice=typeof ai().askingPrice==='function'?ai().askingPrice(p):transferCost(p)*.9;
    const fee=!p.clubId?0:clause?p.clausula_rescision:Math.round(basePrice*(1+Math.min(.12,interestCount*.03))*(1-offer.sellOnPercent*.003)+(offer.installments?basePrice*.025:0));
    const reputation=offer.toClub===GameState.userClub.id?GameState.userClub.reputacion:ai().economy(offer.toClub)?.reputation||65;
    const lowReputation=p.potential>=88&&reputation<65;
    const wage=Math.max(100,Math.ceil(p.salario*(lowReputation?1.7:p.moral<40?1:1.05)/100)*100);
    return {fee,wage,releaseClause:Math.round(p.valor_mercado*1.2),refuse:''};
  }
  function rejectOffer(offer,reason) {
    offer.status='rejected';offer.reason=reason;offer.resolvedDate=GameState.today;delete offer.awaitingUser;
    message('Negociación rechazada',`${player(offer.playerId)?.nombre||'Jugador'}: ${reason}.`,offer);
  }
  function processOffers() {
    if (!world()) return;
    ensure();expireOffers(GameState.today);
    for (const offer of GameState.offers.filter(o=>pending(o)&&o.type==='buy'&&!o.awaitingUser&&responseDue(o))) {
      const p=player(offer.playerId);Object.assign(offer,normalise(offer));
      let reason=termsReason(offer,p);
      if (!reason) reason=statusReason(p,offer.toClub,offer.dealType==='loan'?amount(p.salario*offer.wageShare/100):offer.wage,offer);
      if (reason) {rejectOffer(offer,reason);continue}
      const requested=demands(p,offer);
      if (requested.refuse) {rejectOffer(offer,requested.refuse);continue}
      const insufficient=offer.fee<requested.fee || (offer.dealType==='loan' ? offer.wageShare<requested.wageShare : offer.wage<requested.wage||offer.releaseClause<requested.releaseClause);
      if (insufficient) {
        if (offer.counterAccepted) {rejectOffer(offer,'Las condiciones cambiaron antes de la firma');continue}
        offer.counter={fee:Math.max(offer.fee,requested.fee),wage:Math.max(offer.wage,requested.wage),releaseClause:Math.max(offer.releaseClause,requested.releaseClause||0),wageShare:Math.max(offer.wageShare,requested.wageShare||0)};
        offer.awaitingUser=true;offer.counterDate=GameState.today;
        message('Contraoferta recibida',`${p.nombre}: ${cash(offer.counter.fee)} de pase${offer.dealType==='loan'?` y ${offer.counter.wageShare}% del salario`:`, ${cash(offer.counter.wage)} semanales y cláusula ${cash(offer.counter.releaseClause)}`}. Revisá el mercado para aceptar o retirar la propuesta.`,offer);
        continue;
      }
      const result=executeTransfer(offer);
      if (!result.ok) {rejectOffer(offer,result.reason);continue}
      offer.status='accepted';offer.resolvedDate=GameState.today;
      message(offer.dealType==='loan'?'Préstamo firmado':'Fichaje cerrado',`${p.nombre} se incorpora a ${clubName(offer.toClub)}${offer.dealType==='loan'?` hasta ${addMonths(GameState.today,offer.loanMonths)}`:` por ${offer.years} temporadas`}.`,offer);
      news(offer.dealType==='loan'?'Refuerzo a préstamo':'Transferencia confirmada',`${p.nombre} llega a ${clubName(offer.toClub)} por ${cash(offer.fee)}${offer.installments?`, con ${offer.installments} cuotas mensuales`:''}.`);
    }
    trim();
  }
  function respondCounter(id,accept) {
    if (!world()||locked()) return false;
    const offer=byId(id);if (!offer||!pending(offer)||!offer.awaitingUser) return false;
    if (!accept) {rejectOffer(offer,'Retiraste la oferta');saveGame(true);render();return true}
    const candidate={...offer,...offer.counter},p=player(offer.playerId),wage=candidate.dealType==='loan'?amount(p.salario*candidate.wageShare/100):candidate.wage;
    const reason=termsReason(candidate,p)||statusReason(p,candidate.toClub,wage,candidate);
    if (reason) {toast(reason);return false}
    Object.assign(offer,candidate,{awaitingUser:false,counterAccepted:true,dueAt:GameState.eventIndex+1,responseDate:nextDay(GameState.today)});delete offer.counter;
    message('Contraoferta aceptada',`${p.nombre}: confirmaste las condiciones. La firma se resolverá ${dailyClock()?`a partir del ${date(offer.responseDate)}`:'en la próxima jornada'}.`,offer);
    saveGame(true);render();return true;
  }
  function cancelOffer(id) {
    if (!world()||locked()) return false;
    const offer=byId(id);
    if (!offer||!pending(offer)||offer.type!=='buy') return false;
    rejectOffer(offer,'Retiraste la oferta');saveGame(true);render();return true;
  }
  function expireOffers(day) {
    for (const offer of GameState.offers.filter(o=>pending(o)&&o.type==='buy')) {
      const start=offer.awaitingUser?offer.counterDate:offer.createdDate;
      if (!validDay(start)) continue;
      const elapsed=Math.round((Date.parse(day)-Date.parse(start))/86400000);
      if (elapsed>(offer.awaitingUser?14:30)) rejectOffer(offer,offer.awaitingUser?'La contraoferta venció sin respuesta':'La negociación venció sin una firma');
    }
  }
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
    p.clubId=offer.toClub;p.registered=true;p.moral=85;
    if (offer.dealType==='loan') {
      const loan={id:nextId('loan'),playerId:p.id,ownerClub:before,borrowerClub:offer.toClub,startDate:GameState.today,endDate:addMonths(GameState.today,offer.loanMonths),wageShare:offer.wageShare,ownerWage:p.salario,status:'active'};
      ensure().loans.push(loan);p.loanId=loan.id;
    } else {
      p.salario=offer.wage;p.contract=GameState.year+offer.years;p.clausula_rescision=offer.releaseClause;
      delete p.sellOnClause;
      if (before&&offer.sellOnPercent>0)p.sellOnClause={beneficiaryClub:before,ownerClub:offer.toClub,percent:offer.sellOnPercent};
    }
    GameState.transferListed=GameState.transferListed.filter(id=>id!==p.id);
    if (offer.id) {state.completedTransfers.push(offer.id);state.completedTransfers=state.completedTransfers.slice(-160)}
    WORLD_ENGINE.reindex();
    if (before===GameState.userClub.id||offer.toClub===GameState.userClub.id) {GameState.userClub.cupos_extranjeros_usados=foreigners(GameState.userClub.id);autoLineup()}
    ai().recordTransfer({date:GameState.today,playerId:p.id,playerName:p.nombre,fromClub:before,toClub:offer.toClub,fee:offer.fee,wage:offer.wage,dealType:offer.dealType,installments,sellOnPercent:offer.sellOnPercent});
    return {ok:true,offer};
  }
  function settle(day=GameState.today) {
    if (!world()||!validDay(day)) return;
    const state=ensure();expireOffers(day);
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
  function returnLoans(day=GameState.today) {
    if (!world()||!validDay(day)) return;
    let changed=false;
    for (const loan of ensure().loans.filter(row=>row.status==='active'&&row.endDate<=day)) {
      const p=player(loan.playerId);loan.status='returned';loan.returnDate=day;
      if (!p) continue;
      if (p.clubId===loan.borrowerClub) {p.clubId=loan.ownerClub;p.salario=loan.ownerWage;p.registered=true;changed=true}
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
  function summary() {
    if (!world()) return legacySummary?legacySummary():'';
    const user=GameState.userClub.id,rows=GameState.offers.filter(pending),obligations=ensure().payments.filter(row=>row.fromClub===user&&row.status!=='paid'),receivables=ensure().payments.filter(row=>row.toClub===user&&row.status!=='paid');
    const numbers=`<div class="fm-offer-summary"><strong>${cash(ai().availableBudget(user))} disponibles para nuevos pases</strong><span class="small muted">${cash(reserved(user))} reservados · ${cash(obligations.reduce((s,r)=>s+r.amount,0))} en cuotas por pagar · ${cash(receivables.reduce((s,r)=>s+r.amount,0))} por cobrar</span></div>`;
    const offers=rows.map(o=>{const p=player(o.playerId);if(!p)return '';const loan=o.dealType==='loan';return `<div class="fm-list-row row between"><div><strong>${esc(p.nombre)}</strong><div class="small muted">${o.type==='buy'?(o.awaitingUser?'Contraoferta recibida':dailyClock()&&validDay(o.responseDate)?'Oferta enviada · respuesta a partir del '+esc(date(o.responseDate)):'Oferta enviada · respuesta próxima jornada'):'Oferta de '+esc(clubName(o.toClub))} · ${loan?'Préstamo':'Compra'} · ${cash(o.counter?.fee??o.fee)}${loan?` · ${o.loanMonths||6} meses · ${o.counter?.wageShare??o.wageShare??100}% del salario`:o.installments?` · ${o.installments} cuotas`:''}</div></div>${o.awaitingUser?`<div class="row"><button data-contract-counter="${esc(o.id)}" data-decision="accept" ${locked()?'disabled':''}>Aceptar condiciones</button><button data-contract-counter="${esc(o.id)}" data-decision="reject" ${locked()?'disabled':''}>Retirar oferta</button></div>`:o.type==='sell'?`<div class="row"><button data-sale="${esc(o.id)}" data-decision="accept" ${locked()?'disabled':''}>Aceptar</button><button data-sale="${esc(o.id)}" data-decision="reject" ${locked()?'disabled':''}>Rechazar</button></div>`:`<div class="row"><span class="badge">En negociación</span><button data-contract-cancel="${esc(o.id)}" ${locked()?'disabled':''}>Retirar</button></div>`}</div>`}).join('');
    const schedule=obligations.length?`<details class="card"><summary>Calendario de cuotas (${obligations.length})</summary><div class="scroll"><table><thead><tr><th>Jugador</th><th>Vencimiento</th><th>Importe</th><th>Estado</th></tr></thead><tbody>${obligations.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,36).map(row=>`<tr><td>${esc(player(row.playerId)?.nombre||'Traspaso')}</td><td>${esc(row.dueDate)}</td><td>${cash(row.amount)}</td><td class="${row.dueDate<GameState.today?'red':'muted'}">${row.dueDate<GameState.today?'Vencida':'Programada'}</td></tr>`).join('')}</tbody></table></div></details>`:'';
    const loans=ensure().loans.filter(row=>row.status==='active'&&(row.borrowerClub===user||row.ownerClub===user));
    const loanRows=loans.length?`<details class="card"><summary>Préstamos activos (${loans.length})</summary>${loans.map(row=>`<div class="fm-list-row"><strong>${esc(player(row.playerId)?.nombre||'Jugador')}</strong><p class="small muted">${esc(clubName(row.ownerClub))} → ${esc(clubName(row.borrowerClub))} · regreso ${esc(row.endDate)} · tu parte salarial ${cash(loanWageFor(player(row.playerId),user))}/semana</p></div>`).join('')}</details>`:'';
    const movements=GameState.world.ai.log?.filter(row=>row.type==='transfer'||row.type==='renewal').slice(0,12)||[],battles=GameState.world.ai.competition?.slice(0,4)||[];
    const activity=`<details class="card"><summary>Mercado entre clubes · ${movements.length} operaciones recientes</summary>${movements.length?`<div class="scroll"><table><thead><tr><th>Fecha</th><th>Jugador</th><th>Clubes / contrato</th><th>Operación</th><th>Importe</th></tr></thead><tbody>${movements.map(row=>`<tr><td>${esc(row.date)}</td><td><button class="fm-player-link" data-player="${row.playerId}">${esc(player(row.playerId)?.nombre||row.playerName||'Jugador')}</button></td><td>${row.type==='renewal'?`${clubLink(row.clubId)} · hasta ${row.until}`:`${clubLink(row.fromClub)} → ${clubLink(row.toClub)}`}</td><td>${row.type==='renewal'?'Renovación':row.dealType==='loan'?'Préstamo':'Compra'}${row.installments?` · ${row.installments} cuotas`:''}</td><td>${cash(row.fee)}${row.type==='renewal'?'<span class="fm-player-sub">Prima de firma</span>':''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted">Los clubes buscan refuerzos y negocian durante el mercado. El registro se actualiza al avanzar el calendario.</p>'}${battles.length?`<h3>Disputas por jugadores</h3>${battles.map(row=>`<div class="fm-list-row"><button class="fm-player-link" data-player="${row.playerId}">${esc(player(row.playerId)?.nombre||'Jugador')}</button><p class="small muted">${esc((row.bidders||[]).map(clubName).join(' · '))}${row.winner?` · destino elegido: ${esc(clubName(row.winner))}`:' · propuesta en evaluación'}</p></div>`).join('')}`:''}</details>`;
    return numbers+offers+schedule+loanRows+activity;
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
    if (!transferWindowOpen()) return toast('El mercado está cerrado: enero–marzo y julio–agosto');
    ai().ensure();ensure();const p=player(Number(id));
    if (!p||p.clubId===GameState.userClub.id) return;
    if (activeLoan(p)) return toast('El jugador ya está cedido a préstamo');
    if (GameState.offers.some(o=>pending(o)&&o.playerId===p.id)) return toast('Ya hay una oferta pendiente; revisala en el mercado');
    const fee=p.clubId?transferCost(p):0;
    $('#details').innerHTML=`<div class="small gold">NEGOCIACIÓN CON ${esc(clubName(p.clubId)).toUpperCase()}</div><h2>${esc(p.nombre)}</h2><p class="muted">${esc(p.posicion)} · ${p.edad} años · ${esc(p.nacionalidad)}. ${p.clubId?'Elegí un pase definitivo o una cesión temporal.':'Agente libre: no requiere traspaso.'}</p><form id="negotiation" data-player-id="${p.id}"><label class="field">Tipo de incorporación<select name="dealType"><option value="permanent">Compra definitiva</option>${p.clubId?'<option value="loan">Préstamo</option>':''}</select></label><label class="field"><span data-contract-fee-label>Oferta de traspaso (USD)</span><input name="fee" type="number" min="0" max="10000000000" step="1" value="${fee}" ${!p.clubId?'readonly':''} required></label><div data-contract-group="permanent"><label class="field">Salario semanal (USD)<input name="wage" type="number" min="100" max="10000000" step="100" value="${Math.ceil(p.salario*1.15/100)*100}" required></label><div class="grid cols2"><label class="field">Duración<select name="years">${[1,2,3,4,5].map(n=>`<option ${n===3?'selected':''}>${n}</option>`).join('')}</select></label><label class="field">Prima de firma (USD)<input name="bonus" type="number" min="0" max="1000000000" step="1" value="${p.salario*6}" required></label></div><div class="grid cols2"><label class="field">Pago del pase<select name="installments"><option value="0">Al contado</option><option value="3">3 cuotas mensuales</option><option value="6">6 cuotas mensuales</option><option value="12">12 cuotas mensuales</option></select></label><label class="field">Pago inicial (%)<input name="upfrontPercent" type="number" min="25" max="100" step="5" value="50"></label></div><div class="grid cols2"><label class="field">Futura venta para el club vendedor (%)<input name="sellOnPercent" type="number" min="0" max="30" step="1" value="0"></label><label class="field">Cláusula de rescisión del nuevo contrato (USD)<input name="releaseClause" type="number" min="0" step="1" value="${p.clausula_rescision}" required></label></div>${p.clubId?`<label class="row small"><input name="activateClause" type="checkbox"> Activar cláusula actual: ${cash(p.clausula_rescision)} al contado</label>`:''}</div><div data-contract-group="loan" hidden><div class="grid cols2"><label class="field">Duración del préstamo<select name="loanMonths"><option value="6">6 meses</option><option value="12">12 meses</option></select></label><label class="field">Salario a tu cargo (%)<input name="wageShare" type="number" min="0" max="100" step="5" value="100" required></label></div><p class="small muted">Salario actual: ${cash(p.salario)} por semana. El club propietario paga el resto. El jugador regresa automáticamente al finalizar; la cesión no transfiere sus derechos.</p></div><p class="small muted">Fondos disponibles: ${cash(ai().availableBudget(GameState.userClub.id))}. Las ofertas y todas las cuotas del pase reservan presupuesto. Las cuotas se pagan mes a mes; no permiten comprometer dinero que no tenés. Respuesta en la próxima jornada.</p><div class="row"><button class="primary" type="submit">Enviar oferta</button><button type="button" data-action="close">Cancelar</button></div></form>`;
    updateForm($('#negotiation'));$('#details').showModal();
  };
  transferSummary=summary;
  document.addEventListener('change',event=>{const form=event.target.closest?.('#negotiation');if(world()&&form&&['dealType','installments','activateClause'].includes(event.target.name)){if(event.target.name==='dealType'){const p=player(Number(form.dataset.playerId));form.elements.fee.value=event.target.value==='loan'?Math.max(p.salario*4,Math.round(p.valor_mercado*.025)):p.clubId?transferCost(p):0}updateForm(form)}});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-contract-counter],[data-contract-cancel]');if(!button||button.disabled||!world())return;if(button.dataset.contractCounter)respondCounter(button.dataset.contractCounter,button.dataset.decision==='accept');else cancelOffer(button.dataset.contractCancel)});
  window.MARKET_CONTRACTS={ensure,submitOffer,processOffers,settle,returnLoans,executeTransfer,onResale,reserved,pendingWages,loanWageFor,returnSlots,respondCounter,cancelOffer,expireOffers,summary,addMonths};
})();
