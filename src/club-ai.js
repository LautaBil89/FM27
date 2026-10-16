/* Autonomous club decisions. Real identities stay in the world; only contracts and sporting choices evolve. */
(() => {
  const DAY=86400000, MINIMUM={POR:2,DEF:4,MED:3,DEL:2}, TARGET={POR:3,DEF:8,MED:8,DEL:6};
  const active=()=>GameState?.worldVersion===1;
  const iso=n=>new Date(n).toISOString().slice(0,10);
  const stamp=d=>Date.parse(`${d}T12:00:00Z`);
  const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(stamp(d))&&iso(stamp(d))===d;
  const week=d=>Math.floor(stamp(d)/(7*DAY));
  const seed=value=>{let n=2166136261;for(const char of String(value)){n^=char.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0};
  const userId=()=>GameState?.userClub?.id||null;
  const positive=n=>Number.isFinite(Number(n))?Math.max(0,Math.round(Number(n))):0;
  const roundMoney=n=>Math.max(0,Math.round(n/100)*100);
  const getClubs=()=>GameState.world.clubs;
  const liveLoans=()=>GameState.world.ai?.contracts?.loans?.filter(l=>l.status==='active')||[];
  let ensuredState=null,ensuredAI=null,ensuredClubCount=0;
  const pendingOffer=p=>GameState.offers?.some(o=>o.playerId===p.id&&o.type==='buy'&&o.status==='pending');

  function ensure(){
    if(!active())return null;
    const w=GameState.world;w.ai??={};const ai=w.ai;
    if(ensuredState===GameState&&ensuredAI===ai&&ensuredClubCount===w.clubs.length)return ai;
    ai.version=1;ai.clubs??={};ai.log??=[];ai.competition??=[];ai.cooldown??={};ai.nextId??=1;
    ai.lastDay??=GameState.today;ai.lastFinancialDate??=GameState.today;ai.lastMarketWeek??=week(GameState.today);ai.lastMonth??=GameState.today.slice(0,7);
    const grouped=new Map();for(const p of GameState.players){if(!grouped.has(p.clubId))grouped.set(p.clubId,[]);grouped.get(p.clubId).push(p)}
    for(const c of getClubs()){
      if(ai.clubs[c.id])continue;
      const wages=(grouped.get(c.id)||[]).reduce((n,p)=>n+positive(p.salario),0),n=seed(c.id),rep=positive(c.reputation||c.rating||60);
      const style=rep>=82?'Tiki-Taka':rep<=60?'Salida de Contragolpe':['Gegenpress','Garra/Huevo','Salida de Contragolpe'][n%3];
      ai.clubs[c.id]={cash:positive(c.budget),wageBudget:Math.max(positive(c.wageBudget),Math.ceil(wages*1.12/1000)*1000),reputation:rep,formation:'4-3-3',style,mentality:rep>=80?'Ofensiva':rep<=60?'Defensiva':'Equilibrada',tempo:style==='Tiki-Taka'?45:style==='Gegenpress'?72:58,width:48+n%15,line:style==='Salida de Contragolpe'?35:style==='Gegenpress'?68:52,pressing:style==='Gegenpress'?78:style==='Garra/Huevo'?67:style==='Tiki-Taka'?58:42,season:window.FM_SEASONS?.leagueSeason(c.leagueId)?.year||GameState.year};
    }
    ai.log=ai.log.slice(0,180);ai.competition=ai.competition.slice(0,80);
    ensuredState=GameState;ensuredAI=ai;ensuredClubCount=w.clubs.length;
    return ai;
  }
  function economy(id=userId()){if(!active())return null;const ai=ensure();return id===userId()?GameState.userClub:ai.clubs[id]||null}
  function cash(id=userId()){const e=economy(id);return e?(id===userId()?Number(e.presupuesto_dolares)||0:Number(e.cash)||0):0}
  function wageBill(id=userId()){
    if(!active())return 0;
    const contracts=window.MARKET_CONTRACTS,ids=new Set(),pool=squad(id);let sum=0;
    for(const p of pool){ids.add(p.id);sum+=contracts?contracts.loanWageFor(p,id):positive(p.salario)}
    for(const loan of liveLoans())if(loan.ownerClub===id&&!ids.has(loan.playerId)){const p=player(loan.playerId);if(p)sum+=contracts?contracts.loanWageFor(p,id):positive(loan.ownerWage)*(1-positive(loan.wageShare)/100)}
    return Math.round(sum);
  }
  function reservation(id=userId(),excludeOfferId=null){
    if(!active())return 0;
    const contractReserved=window.MARKET_CONTRACTS?window.MARKET_CONTRACTS.reserved(id,excludeOfferId):GameState.offers.filter(o=>o.type==='buy'&&o.status==='pending'&&(o.toClub||userId())===id&&o.id!==excludeOfferId).reduce((n,o)=>n+positive(o.fee)+positive(o.bonus),0);
    const sales=GameState.offers.filter(o=>o.type==='sell'&&o.status==='pending'&&o.toClub===id&&o.id!==excludeOfferId).reduce((n,o)=>n+positive(o.fee)+positive(o.bonus)+(['mandatory','conditional'].includes(o.purchaseMode)?positive(o.purchaseFee):0),0);
    return contractReserved+sales;
  }
  let marketEvaluation=null;
  function availableBudget(id=userId(),excludeOfferId=null){if(marketEvaluation&&!excludeOfferId&&marketEvaluation.budgets.has(id))return marketEvaluation.budgets.get(id);const value=window.FM_FINANCES?FM_FINANCES.available(id,excludeOfferId):Math.max(0,cash(id)-reservation(id,excludeOfferId));if(marketEvaluation&&!excludeOfferId)marketEvaluation.budgets.set(id,value);return value}
  function transaction(id,amount,label='Movimiento de club',category='general'){
    if(!active()||!Number.isFinite(amount)||!economy(id))return false;
    amount=Math.round(amount);if(amount<0&&cash(id)+amount<0)return false;
    if(id===userId())MANAGEMENT.transaction(amount,label,category);else economy(id).cash=Math.round(cash(id)+amount);
    return true;
  }
  function tacticsFor(id){const e=economy(id);if(!e)return null;return{formation:e.formation||'4-3-3',style:e.style||'Gegenpress',mentality:e.mentality||'Equilibrada',tempo:e.tempo??50,width:e.width??50,line:e.line??50,pressing:e.pressing??50}}
  function notify(title,body,options={}){MANAGEMENT.addMessage(title,body,'mercado',options)}
  function recordEvent(row){const ai=ensure();if(!ai)return;ai.log.unshift({id:`ai-event-${ai.nextId++}`,date:GameState.today,...row});ai.log=ai.log.slice(0,180)}
  function recordTransfer(row){recordEvent({type:'transfer',...row})}
  function loanFor(p){return liveLoans().find(l=>l.playerId===p.id)||null}
  function incomingSlots(id,excludedOfferId=null){return GameState.offers.filter(o=>o.status==='pending'&&(o.toClub||(o.type==='buy'?userId():null))===id&&o.id!==excludedOfferId).length}
  function reservedWages(id,excludeOfferId=null){
    let wages=window.MARKET_CONTRACTS?window.MARKET_CONTRACTS.pendingWages(id,excludeOfferId):GameState.offers.filter(o=>o.status==='pending'&&o.type==='buy'&&(o.toClub||userId())===id&&o.id!==excludeOfferId).reduce((n,o)=>n+positive(o.wage),0);
    wages+=GameState.offers.filter(o=>o.status==='pending'&&o.type==='sell'&&o.toClub===id&&o.id!==excludeOfferId).reduce((n,o)=>n+(o.dealType==='loan'?Math.round((player(o.playerId)?.salario||o.wage)*Number(o.wageShare??100)/100):positive(o.wage)),0);
    return wages;
  }
  function canReceive(p,id,wage=p?.salario,options={}){
    const e=economy(id);if(!p||!e)return{ok:false,reason:'el club o el jugador ya no está disponible'};
    const excluded=options.excludeOfferId||null,returnSlots=liveLoans().filter(l=>l.ownerClub===id&&l.playerId!==p.id).length;
    if(p.clubId===id)return{ok:false,reason:'el jugador ya pertenece al club'};
    if(squad(id).length+returnSlots+incomingSlots(id,excluded)>=32)return{ok:false,reason:'no quedan plazas: también se reservan los retornos de préstamos'};
    const registry=window.FM_REGISTRATION?.canRegister(p,id);if(registry&&!registry.ok)return registry;
    const foreign=WORLD_ENGINE.isForeign(p,id),limit=WORLD_ENGINE.foreignLimit(id),pendingForeign=GameState.offers.filter(o=>o.status==='pending'&&(o.toClub||(o.type==='buy'?userId():null))===id&&o.id!==excluded).filter(o=>WORLD_ENGINE.isForeign(player(o.playerId),id)).length;
    const returningForeign=liveLoans().filter(l=>l.ownerClub===id&&l.playerId!==p.id&&WORLD_ENGINE.isForeign(player(l.playerId),id)).length;
    if(foreign&&foreigners(id)+pendingForeign+returningForeign>=limit)return{ok:false,reason:'no quedan cupos de extranjeros'};
    if(!Number.isFinite(wage)||wage<0)return{ok:false,reason:'el salario no es válido'};
    if(wageBill(id)+reservedWages(id,excluded)+wage>positive(e.wageBudget))return{ok:false,reason:'se supera el presupuesto salarial'};
    return{ok:true,reason:''};
  }
  function canRelease(p,id=p?.clubId){
    if(!p||p.clubId!==id)return{ok:false,reason:'el jugador cambió de club'};
    if(loanFor(p))return{ok:false,reason:'un jugador cedido no puede venderse antes del retorno'};
    const roster=squad(id).filter(q=>!loanFor(q));
    if(roster.length<=18)return{ok:false,reason:'la salida dejaría menos de 18 jugadores'};
    if(roster.filter(q=>q.posicion===p.posicion).length<=(MINIMUM[p.posicion]||2))return{ok:false,reason:`faltaría cobertura en ${p.posicion}; se conservan dos arqueros y un once equilibrado`};
    return{ok:true,reason:''};
  }
  function summaryOf(id){
    const roster=squad(id),sorted=[...roster].sort((a,b)=>overall(b)-overall(a)),positions={};
    for(const pos of Object.keys(TARGET)){const group=sorted.filter(p=>p.posicion===pos),starters=group.slice(0,pos==='POR'?1:pos==='DEF'?4:3),quality=starters.length?starters.reduce((n,p)=>n+overall(p),0)/starters.length:35;positions[pos]={count:group.length,quality,group}}
    const top=sorted.slice(0,11),quality=top.length?top.reduce((n,p)=>n+overall(p),0)/top.length:45;
    const needs=Object.keys(TARGET).map(pos=>({pos,count:positions[pos].count,quality:positions[pos].quality,score:Math.max(0,TARGET[pos]-positions[pos].count)*2.8+Math.max(0,quality-positions[pos].quality)*1.4+(positions[pos].count<(MINIMUM[pos]||2)?20:0)})).sort((a,b)=>b.score-a.score||a.pos.localeCompare(b.pos));
    return{id,roster,positions,quality,needs};
  }
  function observedQuality(p,id){return window.FM_SCOUT_NETWORK?FM_SCOUT_NETWORK.assessment(p,{observerClub:id}).estimate:overall(p)}
  function observedFuture(p,id){return window.FM_SCOUT_NETWORK?FM_SCOUT_NETWORK.assessment(p,{kind:'potential',observerClub:id}).estimate:Math.min(97,observedQuality(p,id)+(p.edad<=21?9:p.edad<=24?5:0))}
  function askingPrice(p,from=p.clubId){
    if(!from)return 0;if(marketEvaluation&&marketEvaluation.prices.has(p.id))return marketEvaluation.prices.get(p.id);
    const roster=squad(from).filter(q=>q.posicion===p.posicion).sort((a,b)=>overall(b)-overall(a)),rank=roster.findIndex(q=>q.id===p.id),rotation=rank>({POR:0,DEF:3,MED:2,DEL:2}[p.posicion]??2);
    const youngster=p.edad<24&&observedFuture(p,from)>observedQuality(p,from)+8;
    const policy=window.FM_DEPTH?.project(from)?.policy,value=roundMoney(p.valor_mercado*(rotation?.88:1.12)*(youngster?1.15:1)*(policy==='balance'?.88:policy==='academy'&&youngster?1.14:1));if(marketEvaluation)marketEvaluation.prices.set(p.id,value);return value;
  }
  function appeal(p,id,wage){const c=club(id),e=economy(id),from=club(p.clubId);return positive(e.reputation||c?.reputation||c?.rating)+Math.min(18,(wage/Math.max(100,p.salario)-1)*25)+(from?.country===c?.country?4:0)+(p.edad<24?4:0)}
  function expectedWage(p,id){const rep=economy(id)?.reputation||club(id)?.reputation||60,origin=(p.clubId===userId()?economy(p.clubId)?.reputacion:economy(p.clubId)?.reputation)||club(p.clubId)?.reputation||60;return Math.max(100,roundMoney(p.salario*(rep+12<origin?1.35:p.clubId?1.08:1.02)))}
  function interestFor(playerId){
    if(!active())return[];const p=player(Number(playerId));if(!p||loanFor(p)||p.edad>40)return[];ensure();const fee=askingPrice(p);
    const result=[];
    for(const c of getClubs()){
      if(c.id===userId()||c.id===p.clubId)continue;
      const wage=expectedWage(p,c.id),bonus=wage*4;
      if(window.MARKET_CONTRACTS?.committed(p.id)||!canReceive(p,c.id,wage).ok||availableBudget(c.id)<fee+bonus)continue;
      const s=summaryOf(c.id),need=s.needs.find(n=>n.pos===p.posicion),quality=observedQuality(p,c.id),future=observedFuture(p,c.id),rep=economy(c.id).reputation;
      if(future>=88&&rep<65&&wage<p.salario*1.7)continue;
      if(quality<s.positions[p.posicion].quality-4&&need.count>=TARGET[p.posicion])continue;
      if(quality>s.quality+15&&rep<70)continue;
      const score=(window.FM_DEPTH?.projectScore(p,c.id)||0)+need.score+(quality-s.positions[p.posicion].quality)*1.7+(p.edad<25?3:0)+(c.country===club(p.clubId)?.country?3:0);
      if(score<3)continue;
      result.push({id:c.id,nombre:c.nombre,score:Math.round(score),need:need.count<TARGET[p.posicion]?'Profundidad de plantel':'Mejora del once',offer:fee,wage,style:economy(c.id).style});
    }
    return result.sort((a,b)=>b.score-a.score||b.wage-a.wage||a.id.localeCompare(b.id)).slice(0,5);
  }
  function competingBid(p,clubId,summary){
    if(p.clubId===clubId||p.clubId===userId()||pendingOffer(p)||loanFor(p)||p.edad>36||(p.posicion!=='POR'&&p.edad>34))return null;
    if(p.clubId&&!(marketEvaluation?.releasable.has(p.id)||canRelease(p,p.clubId).ok))return null;
    const e=economy(clubId),need=summary.needs.find(n=>n.pos===p.posicion),quality=observedQuality(p,clubId),future=observedFuture(p,clubId),fee=askingPrice(p),wage=expectedWage(p,clubId),bonus=wage*4;
    if(!need||need.score<2)return null;
    if(quality<summary.positions[p.posicion].quality-3&&need.count>=TARGET[p.posicion]-1)return null;
    if(quality>summary.quality+15&&e.reputation<70)return null;
    if(future>=88&&e.reputation<65&&wage<p.salario*1.7)return null;
    const countryBonus=club(p.clubId)?.country===club(clubId)?.country?4:0;
    const score=(window.FM_DEPTH?.projectScore(p,clubId)||0)+need.score+(quality-summary.positions[p.posicion].quality)*2+(p.edad<24?Math.min(6,(future-quality)*.35):0)+countryBonus-(p.edad>31?3:0);
    if(score<4)return null;
    const bid={playerId:p.id,fromClub:p.clubId,toClub:clubId,type:'buy',dealType:'permanent',fee,wage,bonus,years:p.edad<25?4:p.edad<31?3:2,installments:0,upfrontPercent:100,sellOnPercent:0,releaseClause:roundMoney(Math.max(fee,p.valor_mercado)*2.2),score,appeal:appeal(p,clubId,wage)};
    const tooExpensive=availableBudget(clubId)<fee+bonus+Math.max(wage*6,10000)||fee>availableBudget(clubId)*.55&&need.count>=MINIMUM[p.posicion];
    if(tooExpensive){
      const end=window.MARKET_CONTRACTS?.addMonths(GameState.today,6),loanFee=roundMoney(Math.max(p.salario*4,p.valor_mercado*.03)),loanWage=Math.round(p.salario*.65);
      if(!p.clubId||p.edad>28||!end||(window.MARKET_CONTRACTS?.contractEnd(p)||`${p.contract}-12-31`)<end||availableBudget(clubId)<loanFee+Math.max(loanWage*6,10000)||!canReceive(p,clubId,loanWage).ok)return null;
      Object.assign(bid,{dealType:'loan',fee:loanFee,wage:p.salario,bonus:0,loanMonths:6,wageShare:65,sellOnPercent:0,score:score-1,appeal:appeal(p,clubId,p.salario)});
    }else if(!canReceive(p,clubId,wage).ok)return null;
    return bid;
  }
  function move(offer){
    if(window.MARKET_CONTRACTS)return MARKET_CONTRACTS.agreeTransfer(offer);
    const p=player(offer.playerId),receiving=canReceive(p,offer.toClub,offer.wage,{excludeOfferId:offer.id});
    if(!receiving.ok)return receiving;if(p.clubId&&(!canRelease(p,p.clubId).ok))return canRelease(p,p.clubId);
    if(availableBudget(offer.toClub,offer.id)<offer.fee+offer.bonus)return{ok:false,reason:'los fondos disponibles no alcanzan'};
    if(!transaction(offer.toClub,-offer.fee-offer.bonus,`Fichaje: ${p.nombre}`,'fichajes'))return{ok:false,reason:'la caja no alcanza'};
    if(p.clubId)transaction(p.clubId,offer.fee,`Venta: ${p.nombre}`,'ventas');
    const from=p.clubId;p.clubId=offer.toClub;p.salario=offer.wage;p.contract=GameState.year+offer.years;p.clausula_rescision=offer.releaseClause;p.registered=true;p.moral=78;
    WORLD_ENGINE.reindex();window.FM_FINANCES?.onTransfer({id:offer.id||'transfer-'+p.id+'-'+GameState.today,playerId:p.id,fromClub:from,toClub:p.clubId,fee:offer.fee,bonus:offer.bonus,years:offer.years,dealType:'permanent',installments:0,date:GameState.today,contractEnd:p.contractEnd});recordTransfer({playerId:p.id,fromClub:from,toClub:p.clubId,fee:offer.fee,dealType:'permanent'});return{ok:true};
  }
  function poolForMarket(summaries){
    const pool=GameState.players.filter(p=>!p.clubId&&!loanFor(p)&&!pendingOffer(p)&&p.edad<=36);
    for(const c of getClubs()){
      if(c.id===userId())continue;
      const s=summaries.get(c.id);for(const pos of Object.keys(TARGET)){
        const group=s.positions[pos].group;
        const first=Math.max(MINIMUM[pos],Math.ceil(group.length*.65));
        for(const p of group.slice(first).filter(p=>canRelease(p,c.id).ok&&!pendingOffer(p)&&!loanFor(p)).slice(-2))pool.push(p);
      }
    }
    return pool;
  }
  function makeSaleOffers(day){
    const ai=ensure();if(GameState.offers.filter(o=>o.type==='sell'&&o.status==='pending').length>=12)return;
    const listed=[...new Set([...(GameState.transferListed||[]),...(window.FM_OFFICE?.office()?.loanListed||[])])].map(player).filter(p=>p?.clubId===userId()),unsolicited=mine().filter(p=>canRelease(p,userId()).ok&&!listed.some(q=>q.id===p.id)).sort((a,b)=>seed(day+':'+a.id)-seed(day+':'+b.id)).slice(0,2);
    let created=0;
    for(const p of [...listed,...unsolicited]){
      if(created>=1)break;
      if(loanFor(p)||GameState.offers.some(o=>o.playerId===p.id&&o.type==='sell'&&o.status==='pending'))continue;
      if(ai.cooldown[p.id]&&stamp(day)-stamp(ai.cooldown[p.id])<21*DAY)continue;
      if(!canRelease(p,userId()).ok)continue;
      const bidders=interestFor(p.id);if(!bidders.length)continue;
      const loan=window.FM_OFFICE?.isLoanListed(p.id),selected=bidders[0],e=economy(selected.id),fee=loan?Math.max(p.salario*4,Math.round(p.valor_mercado*.025)):selected.offer,wage=selected.wage,bonus=wage*4;
      if(availableBudget(selected.id)<fee+bonus||!canReceive(p,selected.id,wage).ok)continue;
      const offer={id:`ai-sale-${ai.nextId++}`,playerId:p.id,type:'sell',dealType:loan?'loan':'permanent',loanMonths:6,wageShare:100,purchaseMode:'none',purchaseFee:0,fromClub:userId(),toClub:selected.id,fee,wage,bonus,years:p.edad<30?3:2,installments:0,upfrontPercent:100,sellOnPercent:0,releaseClause:roundMoney(Math.max(fee,p.valor_mercado)*2.2),status:'pending',createdAt:GameState.eventIndex,createdDate:day,expiresAt:iso(stamp(day)+14*DAY),rivals:bidders.slice(1,3).map(b=>b.id),unsolicited:!listed.some(q=>q.id===p.id)};
      GameState.offers.unshift(offer);ai.cooldown[p.id]=day;created++;
      notify(loan?'Propuesta de préstamo':'Oferta recibida',`${club(selected.id).nombre} quiere incorporar a ${p.nombre} ${loan?'a préstamo durante seis meses, pagando el 100% del salario, con cargo de':'por'} ${money(fee)}. La propuesta vence el ${date(offer.expiresAt)}; el jugador seguirá en tu club hasta que decidas.`,{playerId:p.id,offerId:offer.id,action:'sale'});
      if(bidders.length>1){ai.competition.unshift({date:day,playerId:p.id,bidders:bidders.slice(0,3).map(b=>b.id),winner:null});ai.competition=ai.competition.slice(0,80)}
    }
    const cooldown=Object.entries(ai.cooldown).filter(([,d])=>validDay(d)&&stamp(day)-stamp(d)<90*DAY).sort((a,b)=>b[1].localeCompare(a[1])).slice(0,160);ai.cooldown=Object.fromEntries(cooldown);
  }
  function expireSales(day){
    for(const offer of GameState.offers.filter(o=>o.type==='sell'&&o.status==='pending'&&!o.awaitingRegistration)){
      const p=player(offer.playerId);if(p?.clubId!==userId()||(offer.expiresAt&&offer.expiresAt<day)){
        offer.status='expired';offer.reason=p?.clubId!==userId()?'el jugador cambió de club':'la propuesta venció';
        if(p)notify('Propuesta retirada',`${club(offer.toClub)?.nombre||'El comprador'} retira su oferta por ${p.nombre}: ${offer.reason}.`,{playerId:p.id,offerId:offer.id,action:'offer'});
      }
    }
  }
  function simulateMarket(day){
    const summaries=new Map(getClubs().map(c=>[c.id,summaryOf(c.id)])),pool=poolForMarket(summaries),bids=new Map(),currentWeek=week(day);
    const buyers=getClubs().filter(c=>c.id!==userId()&&squad(c.id).length<32&&(!window.MARKET_CONTRACTS||MARKET_CONTRACTS.registrationOpen(day,c.id))).sort((a,b)=>(seed(`${currentWeek}:${a.id}`)%997)-(seed(`${currentWeek}:${b.id}`)%997));
    // Evaluate a read-only market snapshot, then clear it before any transfer changes money or ownership.
    marketEvaluation={prices:new Map(),budgets:new Map(),releasable:new Set(pool.map(p=>p.id))};
    try{for(const c of buyers){
      const s=summaries.get(c.id),need=s.needs[0];if(!need||need.score<2)continue;
      const candidates=pool.filter(p=>p.posicion===need.pos).map(p=>competingBid(p,c.id,s)).filter(Boolean).sort((a,b)=>b.score-a.score||b.appeal-a.appeal||a.fee-b.fee).slice(0,2);
      for(const bid of candidates){if(!bids.has(bid.playerId))bids.set(bid.playerId,[]);bids.get(bid.playerId).push(bid)}
    }
    }finally{marketEvaluation=null}
    let completed=0;const changedClubs=new Set(),targets=[...bids.entries()].sort((a,b)=>b[1].length-a[1].length||Math.max(...b[1].map(x=>x.score))-Math.max(...a[1].map(x=>x.score)));
    for(const [playerId,options]of targets){
      if(completed>=14)break;const p=player(playerId);if(!p||pendingOffer(p)||p.clubId===userId())continue;
      const sorted=options.sort((a,b)=>b.appeal-a.appeal||b.fee-a.fee||a.toClub.localeCompare(b.toClub));
      for(const bid of sorted){
        if(changedClubs.has(bid.toClub)||p.clubId!==bid.fromClub)continue;
        bid.id=`ai-transfer-${ensure().nextId++}`;const result=move(bid);if(!result.ok)continue;
        changedClubs.add(bid.toClub);completed++;
        if(sorted.length>1){const ai=ensure();ai.competition.unshift({date:day,playerId:p.id,bidders:sorted.slice(0,4).map(b=>b.toClub),winner:bid.toClub});ai.competition=ai.competition.slice(0,80)}
        break;
      }
    }
    if(completed){const recent=ensure().log.filter(r=>r.type==='transfer').slice(0,3);notify('Movimiento en el mercado',`${completed} operaciones entre clubes esta semana. ${recent.map(r=>`${player(r.playerId)?.nombre||'Un jugador'} → ${club(r.toClub)?.nombre||'nuevo club'}`).join('; ')}. El resto está en el registro del mercado.`,{action:'offer',section:'market'})}

    const terminal=GameState.offers.filter(o=>o.status!=='pending').slice(0,100),pending=GameState.offers.filter(o=>o.status==='pending');GameState.offers=[...pending,...terminal];
  }
  function renewClub(c,force=false){
    if(c.id===userId())return 0;const ai=ensure(),e=economy(c.id),roster=squad(c.id).sort((a,b)=>overall(b)-overall(a));let renewed=0;
    const expiring=roster.filter(p=>!loanFor(p)&&!window.MARKET_CONTRACTS?.committed(p.id)&&(force||(window.MARKET_CONTRACTS?.contractEnd(p)||`${p.contract}-12-31`)<=iso(stamp(GameState.today)+180*DAY)));
    for(const p of expiring){
      const rank=roster.filter(q=>q.posicion===p.posicion).findIndex(q=>q.id===p.id),keep=force||rank<({POR:2,DEF:6,MED:6,DEL:4}[p.posicion])||p.edad<25&&observedFuture(p,c.id)>observedQuality(p,c.id)+4;
      if(!keep||p.edad>40)continue;
      const years=p.edad<26?3:p.edad<34?2:1,releaseClause=roundMoney(p.valor_mercado*(p.edad<26?2.5:1.8)),proposedEnd=`${Number(GameState.today.slice(0,4))+years}-${['Inglaterra','España','Italia','Alemania','Francia'].includes(c.country)?'06-30':'12-31'}`;
      if((window.MARKET_CONTRACTS?.contractEnd(p)||`${p.contract}-12-31`)>=proposedEnd)continue;
      const wage=Math.max(100,roundMoney(p.salario*(p.edad>33?1:1.04))),bonus=p.salario*2;
      if(wageBill(c.id)-p.salario+wage>e.wageBudget||availableBudget(c.id)<bonus)continue;
      if(!transaction(c.id,-bonus,`Renovación: ${p.nombre}`,'contratos'))continue;
      p.salario=wage;if(window.MARKET_CONTRACTS?.setContract)MARKET_CONTRACTS.setContract(p,years,GameState.today,{releaseClause});else{p.contract=Number(GameState.today.slice(0,4))+years;p.contractEnd=`${p.contract}-${['Inglaterra','España','Italia','Alemania','Francia'].includes(c.country)?'06-30':'12-31'}`;p.clausula_rescision=releaseClause;p.releaseClauseBilateral=true}p.moral=clamp(p.moral+4);p.contractSignedDate=GameState.today;p.contractDateSource='career-renewal';window.FM_FINANCES?.onRenewal(p,years,bonus);
      recordEvent({type:'renewal',clubId:c.id,playerId:p.id,until:p.contract,wage,fee:bonus});renewed++;
    }
    return renewed;
  }
  function settleOperating(day){
    const ai=ensure(),weeks=Math.floor((stamp(day)-stamp(ai.lastFinancialDate))/(7*DAY));if(weeks<=0)return;
    const settled=iso(stamp(ai.lastFinancialDate)+weeks*7*DAY),from=ai.lastFinancialDate,gate=new Map();
    for(const event of GameState.calendar.filter(event=>event.done&&event.date>=from&&event.date<settled))for(const game of event.games||[]){
      if(!game.result||game.neutral||game.home===userId())continue;
      const c=club(game.home),e=c&&economy(c.id);if(!c||!e)continue;
      const attendance=clamp(.46+(e.reputation||c.rating||60)*.004, .45,.92),ticket=WORLD_ENGINE.league(c.leagueId)?.confederation==='UEFA'?27:12;
      gate.set(c.id,(gate.get(c.id)||0)+Math.round((c.capacity||15000)*attendance*ticket));
    }
    for(const c of getClubs()){
      if(c.id===userId())continue;const e=economy(c.id),wages=wageBill(c.id),league=WORLD_ENGINE.league(c.leagueId);
      e.commercialBase??=Math.round(wages*.86+(c.capacity||15000)*(league?.confederation==='UEFA'?.9:.6)+(c.reputation||c.rating||60)*300);
      const commercial=Math.round(e.commercialBase*(e.sponsorFactor||1)*weeks),matchday=gate.get(c.id)||0,interest=Math.round((e.debt||0)*.08*weeks/52),expense=wages*weeks+interest;
      const balance=Math.round(e.cash+commercial+matchday-expense);e.debt=positive(e.debt)+Math.max(0,-balance);e.cash=Math.max(0,balance);
      const repayment=Math.min(e.debt,Math.max(0,e.cash-wages*8));e.debt-=repayment;e.cash-=repayment;
      e.operatingReport={from,to:settled,weeks,commercial,matchday,wages:wages*weeks,interest,repayment,debt:e.debt};
      if(e.debt>0&&window.FM_DEPTH)FM_DEPTH.project(c.id).policy='balance';
    }
    ai.lastFinancialDate=settled;
  }
  function syncCoaches(){
    if(!window.FM_DEPTH)return;
    for(const c of getClubs()){
      if(c.id===userId())continue;const e=economy(c.id),project=FM_DEPTH.project(c.id),cycle=project.manager||1;
      if(e.coachCycle==null){e.coachCycle=cycle;continue}
      if(e.coachCycle===cycle)continue;
      const n=seed(c.id+':coach:'+cycle),styles=['Gegenpress','Garra/Huevo','Tiki-Taka','Salida de Contragolpe'],style=styles[n%styles.length];
      Object.assign(e,{coachCycle:cycle,style,formation:['4-3-3','4-4-2','4-2-3-1'][n%3],mentality:'Equilibrada',tempo:style==='Tiki-Taka'?45:style==='Gegenpress'?72:58,line:style==='Salida de Contragolpe'?35:style==='Gegenpress'?68:52,pressing:style==='Gegenpress'?78:style==='Garra/Huevo'?67:style==='Tiki-Taka'?58:42});
      recordEvent({type:'coach',clubId:c.id,cycle,style,formation:e.formation});
    }
  }
  function onDayAdvance(day=GameState?.today){
    if(!active()||!validDay(day))return false;const ai=ensure();if(validDay(ai.lastDay)&&day<=ai.lastDay)return false;
    syncCoaches();settleOperating(day);window.MARKET_CONTRACTS?.settle(day);window.MARKET_CONTRACTS?.returnLoans(day);expireSales(day);if(!GameState.finished&&seed('contact:'+day)%3===0)makeSaleOffers(day);
    const month=day.slice(0,7);if(ai.lastMonth!==month){for(const c of getClubs())renewClub(c);ai.lastMonth=month}
    const currentWeek=week(day),open=getClubs().some(c=>window.MARKET_CONTRACTS?MARKET_CONTRACTS.registrationOpen(day,c.id):[1,2,6,7].includes(Number(day.slice(5,7))));
    if(ai.lastMarketWeek!==currentWeek){ai.lastMarketWeek=currentWeek;if(open&&!GameState.finished)simulateMarket(day)}
    ai.lastDay=day;return true;
  }
  function beforeNextSeason(nextDay=`${GameState.year+1}-01-24`){
    if(!active())return;ensure();if(!validDay(nextDay))nextDay=`${GameState.year+1}-01-24`;
    window.MARKET_CONTRACTS?.returnLoans(nextDay);
    for(const c of getClubs())renewClub(c,true);
  }
  function afterLeagueSeason(leagueId,history,newSeasonYear){
    if(!active()||!history?.ranking?.length)return false;const ai=ensure(),key=leagueId+':'+history.year;ai.seasonReviewKeys??=[];if(ai.seasonReviewKeys.includes(key))return false;
    const l=WORLD_ENGINE.league(leagueId),rankings=history.ranking,expectedOrder=[...rankings].sort((a,b)=>(club(b)?.rating||0)-(club(a)?.rating||0)||a.localeCompare(b)),slots=WORLD_ENGINE.qualificationSlots(l);
    for(const id of history.clubIds||rankings){const c=club(id);if(!c||id===userId())continue;const e=economy(id),place=rankings.indexOf(id)+1,expected=expectedOrder.indexOf(id)+1,goal=c.objective||window.FM_OFFICE?.objectiveFor(id)||'Terminar en la mitad superior',champion=history.champion===id||Object.values(history.sporting?.champions||{}).includes(id),continental=Object.values(GameState.world.cups||{}).some(cup=>cup.year===history.year&&cup.winner===id);
      const met=goal.toLowerCase().includes('campe')?champion:goal.includes('ascenso')?(history.promoted?.length?history.promoted.includes(id):place<=Number(slots.promotion||0)):goal.includes('descenso')?(history.relegated?.length?!history.relegated.includes(id):place<=rankings.length-Number(slots.relegation||0)):goal.includes('mitad')?place<=Math.ceil(rankings.length/2):goal.includes('europeos')?place<=Number(slots.champions||0)+Number(slots.europa||0)+Number(slots.conference||0):place<=Number(slots.lib||0);
      const delta=clamp((champion?2:0)+(continental?2:0)+(place&&expected?Math.round((expected-place)/Math.max(5,rankings.length*.25)):0)+(met?1:-1),-3,4),review={year:history.year,leagueId,position:place,expected,reputationDelta:delta,champion:!!champion,continental,objective:goal,objectiveMet:!!met,grant:0,debt:e.debt||0};
      e.reputation=clamp((e.reputation||c.reputation||60)+delta,20,98);c.reputation=e.reputation;e.sponsorFactor=clamp((e.sponsorFactor||1)*(1+delta*.025),.7,1.45);e.wageBudget=Math.max(Math.ceil(wageBill(id)*1.05/1000)*1000,Math.round(e.wageBudget*(e.debt>0?.96:1+Math.max(0,delta)*.015)/1000)*1000);e.seasonReviews??=[];e.seasonReviews.push(review);e.seasonReviews=e.seasonReviews.slice(-12);e.season=newSeasonYear;
      if(window.FM_DEPTH)FM_DEPTH.project(id).boardReview={year:history.year,leagueId,objective:goal,position:place,met:!!met};recordEvent({type:'board-review',clubId:id,...review});
    }
    ai.seasonReviewKeys.push(key);ai.seasonReviewKeys=ai.seasonReviewKeys.slice(-240);return true;
  }
  function afterNextSeason(){
    if(!active())return;const ai=ensure();
    for(const c of getClubs()){
      if(c.id===userId())continue;const e=economy(c.id);if(e.season===GameState.year)continue;
      const history=GameState.history[0],previousLeague=Object.keys(history?.worldRankings||{}).find(id=>history.worldRankings[id].includes(c.id))||c.leagueId,rankings=history?.worldRankings?.[previousLeague]||[],place=rankings.indexOf(c.id)+1;
      const expected=[...rankings].sort((a,b)=>(club(b)?.rating||0)-(club(a)?.rating||0)||a.localeCompare(b)).indexOf(c.id)+1;
      const domestic=history?.domesticFormats?.[previousLeague],arg=history?.sportingFormats,champion=domestic?.champion===c.id||previousLeague==='ARG1'&&Object.values(arg?.champions||{}).includes(c.id)||previousLeague==='ARG2'&&arg?.nacionalChampion===c.id||!domestic&&!arg&&place===1;
      const continental=history?.cup===c.id||history?.sudCup===c.id,review=window.FM_OFFICE?.reviewObjective(c.id,history),delta=clamp((champion?2:0)+(continental?2:0)+(place&&expected?Math.round((expected-place)/Math.max(5,rankings.length*.25)):0)+(review?.met?1:review?-1:0),-3,4);
      const grant=roundMoney((c.budget||500000)*(place&&place<=4?.32:.2));e.cash+=grant;e.reputation=clamp((e.reputation||c.reputation||60)+delta,20,98);c.reputation=e.reputation;
      e.sponsorFactor=clamp((e.sponsorFactor||1)*(1+delta*.025),.7,1.45);e.wageBudget=Math.max(Math.ceil(wageBill(c.id)*1.05/1000)*1000,Math.round(e.wageBudget*(e.debt>0?.96:1+Math.max(0,delta)*.015)/1000)*1000);
      e.seasonReviews??=[];e.seasonReviews.push({year:history?.year||GameState.year-1,position:place,expected,reputationDelta:delta,champion:!!champion,continental,objectiveMet:review?.met??null,grant,debt:e.debt||0});e.seasonReviews=e.seasonReviews.slice(-12);e.season=GameState.year;
    }
    syncCoaches();window.MARKET_CONTRACTS?.restoreAgreements();
    ai.lastDay=GameState.today;ai.lastFinancialDate=GameState.today;ai.lastMarketWeek=week(GameState.today);ai.lastMonth=GameState.today.slice(0,7);
    window.MARKET_CONTRACTS?.settle(GameState.today);window.MARKET_CONTRACTS?.returnLoans(GameState.today);
  }
  function respondToSaleOffer(id,accept){
    if(!active())return false;if(locked())return toast('Terminá el partido antes de negociar');const ai=ensure(),offer=GameState.offers.find(o=>o.id===id&&o.type==='sell');
    if(!offer||offer.status!=='pending'||offer.awaitingRegistration)return false;const p=player(offer.playerId);
    if(!accept){offer.status='rejected';ai.cooldown[offer.playerId]=GameState.today;notify('Oferta rechazada',`Decidiste conservar a ${p?.nombre||'tu jugador'}.`,{playerId:offer.playerId,offerId:id,action:'sale'});saveGame(true);render();return true}
    if(!p||p.clubId!==userId())return toast('La propuesta ya no corresponde a tu plantel');
    const release=canRelease(p,userId());if(!release.ok)return toast(release.reason);
    offer.fromClub=userId();offer.toClub??=GameState.league.find(c=>c.id!==userId())?.id;offer.wage??=expectedWage(p,offer.toClub);offer.bonus??=0;offer.years??=p.edad<30?3:2;offer.dealType??='permanent';offer.releaseClause??=roundMoney(p.valor_mercado*2.2);
    const result=window.MARKET_CONTRACTS?MARKET_CONTRACTS.agreeTransfer(offer):move(offer);if(!result.ok)return toast(result.reason||'No se puede completar el pase');
    if(result.deferred){saveGame(true);render();return true}
    offer.status='accepted';GameState.transferListed=GameState.transferListed.filter(x=>x!==p.id);autoLineup();notify(offer.dealType==='loan'?'Préstamo acordado':'Venta acordada',`${p.nombre} pasa a ${club(offer.toClub).nombre} ${offer.dealType==='loan'?'a préstamo por '+offer.loanMonths+' meses, con cargo de':'por'} ${money(offer.fee)}.`,{playerId:p.id,offerId:offer.id,action:'sale'});news('Transferencia confirmada',`${p.nombre} se marcha a ${club(offer.toClub).nombre}.`);saveGame(true);render();return true;
  }
  function cancelUserOffer(id){
    if(!active()||locked())return false;const offer=GameState.offers.find(o=>o.id===id&&o.type==='buy'&&o.status==='pending'&&!o.awaitingRegistration);if(!offer)return false;
    offer.status='cancelled';offer.awaitingUser=false;notify('Oferta retirada',`Retiraste la propuesta por ${player(offer.playerId)?.nombre||'el jugador'}. Los fondos reservados quedan disponibles.`,{playerId:offer.playerId,offerId:offer.id,action:'offer'});saveGame(true);render();return true;
  }
  function submitOffer(form){return window.MARKET_CONTRACTS?MARKET_CONTRACTS.submitOffer(form):toast('El mercado se está preparando')}
  function processUserOffers(){if(!active())return;ensure();window.MARKET_CONTRACTS?.processOffers();expireSales(GameState.today)}
  function summary(){const ai=ensure();if(!ai)return null;return{clubs:Object.keys(ai.clubs).length,transfers:ai.log.filter(r=>r.type==='transfer'),renewals:ai.log.filter(r=>r.type==='renewal'),competition:ai.competition.slice(0,8),lastMarketWeek:ai.lastMarketWeek,availableBudget:availableBudget(),commitments:reservation()}}
  window.CLUB_AI={ensure,economy,cash,availableBudget,transaction,wageBill,reservation,reservedWages,canReceive,canRelease,tacticsFor,askingPrice,interestFor,recordTransfer,recordEvent,onDayAdvance,beforeNextSeason,afterNextSeason,afterLeagueSeason,submitOffer,processUserOffers,respondToSaleOffer,cancelUserOffer,summary,renewClub,makeSaleOffers,syncCoaches};
})();
