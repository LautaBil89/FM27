/* Career-only medical simulation. Prognoses and player health are fictional game events. */
window.FM_MEDICINE=(()=>{
  const INCIDENCE={match:27.5,training:4.1,unit:'Lesiones por 1000 horas de exposición individual',scope:'Referencia UEFA masculina de élite, 2001–2008; calibración orientativa del juego, no dato específico de liga',source:'Ekstrand, Hägglund y Waldén (2011), British Journal of Sports Medicine 45:553–558',url:'https://doi.org/10.1136/bjsm.2009.060582'};
  const DAY=86400000, bound=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
  const elapsed=(a,b)=>Math.max(0,Math.round((Date.parse(a)-Date.parse(b))/DAY));
  const add=(day,n)=>new Date(Date.parse(day)+n*DAY).toISOString().slice(0,10);
  const hash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h};
  const types={contusion:{label:'Contusión',min:2,max:7,group:'contacto'},overload:{label:'Sobrecarga muscular',min:3,max:9,group:'muscular'},strain:{label:'Distensión muscular',min:8,max:21,group:'muscular'},hamstring:{label:'Lesión de isquiotibiales',min:15,max:38,group:'muscular'},ankle:{label:'Esguince de tobillo',min:12,max:35,group:'articular'},ligament:{label:'Lesión ligamentaria',min:35,max:84,group:'articular'},fracture:{label:'Fractura',min:42,max:100,group:'ósea'},knee:{label:'Lesión grave de rodilla',min:140,max:240,group:'articular'},legacy:{label:'Lesión de una partida anterior',min:1,max:365,group:'sin diagnóstico'}};
  // Approximate city centres, used only to estimate journey burden, never claimed as official routes.
  const cities={'buenos aires':[-34.60,-58.38],'la plata':[-34.92,-57.95],rosario:[-32.96,-60.64],cordoba:[-31.42,-64.18],córdoba:[-31.42,-64.18],mendoza:[-32.89,-68.85],tucuman:[-26.83,-65.22],tucumán:[-26.83,-65.22],santa_fe:[-31.63,-60.70],'santa fe':[-31.63,-60.70],santiago:[-33.45,-70.67],montevideo:[-34.90,-56.16],asuncion:[-25.26,-57.58],asunción:[-25.26,-57.58],lima:[-12.05,-77.04],quito:[-.18,-78.47],guayaquil:[-2.17,-79.92],bogota:[4.71,-74.07],bogotá:[4.71,-74.07],medellin:[6.24,-75.58],medellín:[6.24,-75.58],caracas:[10.48,-66.90],'la paz':[-16.50,-68.15],'santa cruz':[-17.78,-63.18],'rio de janeiro':[-22.91,-43.17],'são paulo':[-23.55,-46.63],'sao paulo':[-23.55,-46.63],'belo horizonte':[-19.92,-43.94],'porto alegre':[-30.03,-51.23],curitiba:[-25.43,-49.27],fortaleza:[-3.73,-38.53],recife:[-8.05,-34.88],salvador:[-12.98,-38.50],london:[51.51,-.13],londres:[51.51,-.13],manchester:[53.48,-2.24],liverpool:[53.41,-2.98],birmingham:[52.49,-1.89],newcastle:[54.98,-1.61],madrid:[40.42,-3.70],barcelona:[41.39,2.17],sevilla:[37.39,-5.98],valencia:[39.47,-.38],bilbao:[43.26,-2.93],rome:[41.90,12.50],roma:[41.90,12.50],milan:[45.46,9.19],milano:[45.46,9.19],turin:[45.07,7.69],torino:[45.07,7.69],naples:[40.85,14.27],napoli:[40.85,14.27],paris:[48.86,2.35],marseille:[43.30,5.37],lyon:[45.76,4.84],lille:[50.63,3.06],berlin:[52.52,13.41],munich:[48.14,11.58],münchen:[48.14,11.58],dortmund:[51.51,7.47],frankfurt:[50.11,8.68],leipzig:[51.34,12.37]};
  const countries={Argentina:[-34.60,-58.38],Brasil:[-15.79,-47.88],Brazil:[-15.79,-47.88],Uruguay:[-34.90,-56.16],Paraguay:[-25.26,-57.58],Chile:[-33.45,-70.67],Bolivia:[-16.50,-68.15],Perú:[-12.05,-77.04],Peru:[-12.05,-77.04],Ecuador:[-.18,-78.47],Colombia:[4.71,-74.07],Venezuela:[10.48,-66.90],Inglaterra:[51.51,-.13],England:[51.51,-.13],España:[40.42,-3.70],Spain:[40.42,-3.70],Italia:[41.90,12.50],Italy:[41.90,12.50],Francia:[48.86,2.35],France:[48.86,2.35],Alemania:[52.52,13.41],Germany:[52.52,13.41]};
  const active=()=>!!GameState?.worldVersion;
  function ensure(){if(!active())return null;const s=GameState.world.medicine??={version:1,players:{},receipts:{},lastDay:GameState.today};s.players??={};s.receipts??={};return s}
  function notify(p,title,body){if(p.clubId!==GameState.userClub.id)return;window.FM_INBOX?.push({title,body,type:'medico',playerId:p.id,action:'medical'})}
  function state(p,day=GameState.today){
    const s=ensure();if(!s||!p)return null;
    const r=s.players[p.id]??={sharpness:bound(75+Math.min(20,Number(p.minutes||0)/45)),tissueFatigue:0,lastDay:day,lastMatch:null,work:[],history:[],injury:null,returnUntil:null,rehab:'Normal',restUntil:null,lostDays:0};
    r.work??=[];r.history??=[];r.sharpness=bound(r.sharpness);r.tissueFatigue=bound(r.tissueFatigue);
    if(p.injury>0&&!r.injury){const duration=Math.max(1,Math.ceil(Number(p.injury)));r.injury={id:`legacy-${p.id}-${day}`,type:'legacy',label:'Lesión de una partida anterior',group:'sin diagnóstico',started:day,days:duration,remaining:duration,expectedReturn:add(day,duration),earliest:add(day,Math.max(1,Math.floor(duration*.85))),latest:add(day,Math.ceil(duration*1.2)),stage:'Tratamiento',recurrence:false,source:'migración',legacy:true};}
    return r;
  }
  function loads(p,day=GameState.today){const r=state(p),rows=r.work.filter(x=>elapsed(day,x.date)<=27&&x.date<=day),acute=rows.filter(x=>elapsed(day,x.date)<=6).reduce((s,x)=>s+x.load,0),chronic=rows.reduce((s,x)=>s+x.load,0)/4;return {acute:Math.round(acute),chronic:Math.round(chronic),ratio:Math.round(100*acute/Math.max(220,chronic))/100,minutes:rows.filter(x=>elapsed(day,x.date)<=6).reduce((s,x)=>s+(x.minutes||0),0),travel:rows.filter(x=>elapsed(day,x.date)<=6).reduce((s,x)=>s+(x.distance||0),0)}}
  function risk(p,day=GameState.today){const r=state(p),l=loads(p,day),previous=r.history.filter(x=>x.group==='muscular'&&elapsed(day,x.date)<120).length,returning=r.returnUntil&&day<=r.returnUntil;
    const score=bound((100-p.condicion_fisica)*.85+r.tissueFatigue*.52+Math.max(0,l.ratio-1.15)*26+Math.max(0,l.minutes-210)*.055+previous*7+(returning?22:0)+Math.max(0,(p.edad||25)-30)*.65);
    return {score:Math.round(score),label:p.injury?'Lesionado':score>=48?'Alto':score>=25?'Medio':'Bajo',multiplier:bound(1+score/40,.7,4.8),...l,returning:!!returning};}
  function kind(source,random){const n=random();if(source==='training')return n<.68?'overload':n<.92?'strain':'hamstring';return n<.38?'contusion':n<.63?'strain':n<.82?'hamstring':n<.95?'ankle':n<.984?'ligament':n<.997?'fracture':'knee'}
  function injure(p,options={}){
    if(!p||!active())return null;const r=state(p);if(r.injury||p.injury>0)return r.injury;
    const random=options.random||Math.random,type=Object.hasOwn(types,options.type)?options.type:kind(options.source||'match',random),definition=types[type],day=options.date||GameState.today;
    const last=r.history.find(x=>x.group===definition.group&&elapsed(day,x.date)<=90),recurrence=!!(last&&r.returnUntil&&day<=r.returnUntil);
    const duration=Math.max(1,Math.round(options.days||definition.min+random()*(definition.max-definition.min))+(recurrence?Math.ceil(definition.min*.35):0));
    const id=`inj-${p.id}-${day}-${r.history.length}-${hash(type+duration)}`,spread=Math.max(1,Math.ceil(duration*.18));
    r.injury={id,type,label:definition.label,group:definition.group,started:day,days:duration,remaining:duration,expectedReturn:add(day,duration),earliest:add(day,Math.max(1,duration-spread)),latest:add(day,duration+spread),stage:'Tratamiento',recurrence,source:options.source||'match',legacy:false};
    r.rehab='Normal';p.injury=duration;p.injuryType=definition.label;p.condicion_fisica=bound(Math.min(p.condicion_fisica,recurrence?58:68));r.sharpness=bound(r.sharpness-6);r.history.unshift({id,type,group:definition.group,date:day,days:duration,recurrence});r.history=r.history.slice(0,12);
    if(options.notify!==false)notify(p,recurrence?'Recaída en la recuperación':'Parte médico: '+definition.label,`${p.nombre}: ${definition.label.toLowerCase()}${recurrence?' en una zona recientemente afectada':''}. Pronóstico inicial: entre ${Math.max(1,duration-spread)} y ${duration+spread} días. Primero tratamiento, después trabajo individual y reintegración progresiva; el alta no equivale a recuperar ritmo competitivo.`);
    return r.injury;
  }
  function work(p,entry){const r=state(p);if(r.work.some(x=>x.id===entry.id))return false;r.work.push(entry);r.work=r.work.filter(x=>elapsed(entry.date,x.date)<=34).slice(-100);return true}
  function trainingLoad(p,load,{date=GameState.today,recovery=false,random=Math.random}={}){
    const r=state(p,date);if(!r||p.injury>0)return {applied:false,injured:false};const dose=bound(load,0,3),entry={id:'training-'+date,date,load:Math.round(dose*35),minutes:0,distance:0};
    if(!work(p,entry))return {applied:false,injured:false};
    if(recovery){r.tissueFatigue=bound(r.tissueFatigue-5);p.condicion_fisica=bound(p.condicion_fisica+2.5);r.sharpness=bound(r.sharpness-.15)}
    else {r.tissueFatigue=bound(r.tissueFatigue+dose*2.4);p.condicion_fisica=bound(p.condicion_fisica-Math.max(0,dose-.6)*1.35);r.sharpness=bound(r.sharpness+Math.min(.5,dose*.4));}
    const injured=!recovery&&random()<(INCIDENCE.training/60000)*35*dose*risk(p,date).multiplier;
    if(injured)injure(p,{source:'training',date,random});return {applied:true,injured};
  }
  function recoverPlayer(p,day){
    const r=state(p,GameState.today),count=Math.min(400,elapsed(day,r.lastDay));if(!count)return false;
    for(let n=1;n<=count;n++){
      const current=add(r.lastDay,n),load=r.work.filter(x=>elapsed(current,x.date)<=1&&x.date<=current).reduce((s,x)=>s+x.load,0),rest=r.restUntil&&current<=r.restUntil;
      const ageRate=bound(1.08-Math.max(0,(p.edad||25)-27)*.018,.72,1.1),recovery=(rest?7.0:5.5)*ageRate*(1-r.tissueFatigue/210)/(load>160?1.15:1);
      p.condicion_fisica=bound(p.condicion_fisica+recovery);r.tissueFatigue=bound(r.tissueFatigue-(rest?8:5.3)*ageRate);
      r.sharpness=bound(r.sharpness-(r.injury?.75:r.lastMatch&&elapsed(current,r.lastMatch)>4?.42:.12));
      if(r.injury){
        const injury=r.injury;r.lostDays++;injury.remaining=Math.max(0,injury.remaining-1);p.injury=Math.ceil(injury.remaining);
        const fraction=1-injury.remaining/injury.days;injury.stage=fraction<.45?'Tratamiento':fraction<.8?'Rehabilitación individual':'Reintegración al grupo';
        if(!p.injury){r.returnUntil=add(current,Math.min(28,Math.max(7,Math.round(injury.days*.35))));r.injury=null;p.injuryType=null;p.condicion_fisica=Math.min(88,p.condicion_fisica);notify(p,'Alta médica con vuelta progresiva',`${p.nombre} tiene el alta tras ${injury.label.toLowerCase()}. Ritmo competitivo ${Math.round(r.sharpness)}%; límite recomendado ${minuteLimit(p)} minutos. El riesgo de recaída continúa elevado durante la reintegración.`)}
      }
    }
    r.lastDay=day;r.work=r.work.filter(x=>elapsed(day,x.date)<=34);if(r.returnUntil&&day>r.returnUntil)r.returnUntil=null;return true;
  }
  function onDay(day){const s=ensure();if(!s)return false;let changed=false;for(const p of GameState.players){if(!s.players[p.id]&&p.injury===0&&p.condicion_fisica>=100)continue;changed=recoverPlayer(p,day)||changed;}if(day>s.lastDay)s.lastDay=day;return changed}
  function minuteLimit(p){const r=state(p);if(p.injury)return 0;return r.returnUntil&&GameState.today<=r.returnUntil?Math.max(20,Math.min(60,Math.round(r.sharpness*.65))):r.sharpness<55?45:r.sharpness<70?65:90}
  function intensity(m,side){const t=side===m.userSide?GameState.tactics:m.aiTactics||{},press=Number(t.pressing??50);return (t.style==='Gegenpress'||side===m.userSide&&GameState.tactics.style==='Gegenpress'?1.16:1)*(m.derby?1.15:1)*(.88+press*.0024)}
  function minuteFatigue(p,m,side){const r=state(p),rate=p.posicion==='POR'?.075:.155+Math.max(0,65-(p.fisico||65))*.0007,load=intensity(m,side);p.condicion_fisica=bound(p.condicion_fisica-rate*load*(r.sharpness<60?1.1:1));r.tissueFatigue=bound(r.tissueFatigue+(p.posicion==='POR'?.025:.10)*load)}
  function onMinute(m){
    if(!active()||!m||!m.lineups||m.minute<=0)return false;m.medical??={minutes:{},lastMinute:0,closed:false};if(m.medical.lastMinute>=m.minute)return false;
    // The engine calls once after advancing its actual minute; no extra time is invented here.
    const delta=Math.min(2,Math.max(1,m.minute-m.medical.lastMinute));m.medical.lastMinute=m.minute;
    for(let side=0;side<2;side++)for(const id of m.lineups[side]){
      if(m.red?.includes(id)||m.injured?.includes(id))continue;const p=player(id);if(!p||p.injury>0)continue;
      m.medical.minutes[id]=(m.medical.minutes[id]||0)+delta;for(let j=0;j<delta;j++)minuteFatigue(p,m,side);
    }return true;
  }
  function maybeInjury(p,m,options={}){
    if(!p||p.injury>0)return null;const r=risk(p),random=options.random||Math.random;
    if(random()>=(INCIDENCE.match/60000)*r.multiplier*(m?.derby?1.15:1))return null;
    const injury=injure(p,{source:'match',random});if(injury&&m){m.injured??=[];if(!m.injured.includes(p.id))m.injured.push(p.id);m.injuryEvents??=[];m.injuryEvents.push({playerId:p.id,type:injury.label,days:p.injury,minute:m.minute});}
    return injury;
  }
  function coordinates(c){const city=String(c?.city||'').toLowerCase().trim(),point=cities[city];return {point:point||countries[c?.country]||null,precise:!!point}}
  function travel(homeId,awayId,neutral=false){const home=club(homeId),away=club(awayId),a=coordinates(home),b=coordinates(away);if(homeId===awayId)return {km:0,estimated:true,basis:'Mismo club'};
    if(!a.point||!b.point)return {km:home?.country===away?.country?600:2200,estimated:true,basis:'Distancia orientativa sin ubicación disponible'};
    const rad=x=>x*Math.PI/180,[la,loa]=a.point.map(rad),[lb,lob]=b.point.map(rad),h=Math.sin((la-lb)/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin((loa-lob)/2)**2,km=Math.round(6371*2*Math.asin(Math.min(1,Math.sqrt(h))));
    return {km:Math.max(home?.city&&home.city===away?.city?15:0,km),estimated:true,basis:(a.precise&&b.precise?'Centros urbanos aproximados':'Capitales como referencia orientativa')+(neutral?' · sede neutral no geolocalizada':'')};
  }
  function appearance(p,{id,date=GameState.today,minutes=90,load=1,distance=0,random=Math.random,fatigue=true}){
    const r=state(p,date),time=bound(minutes,0,130);if(!time||!work(p,{id,date,minutes:time,load:Math.round(time*load+Math.min(35,distance/160)),distance:Math.round(distance)}))return false;
    if(fatigue){p.condicion_fisica=bound(p.condicion_fisica-time*(p.posicion==='POR'?.075:.155)*load);r.tissueFatigue=bound(r.tissueFatigue+time*.1*load)}
    if(distance>0){const travelCost=Math.min(5,distance/1800);p.condicion_fisica=bound(p.condicion_fisica-travelCost);r.tissueFatigue=bound(r.tissueFatigue+travelCost*1.4)}
    r.sharpness=bound(r.sharpness+Math.min(8,time*.075));r.lastMatch=date;
    if(fatigue&&!p.injury&&random()<(INCIDENCE.match/60000)*time*risk(p,date).multiplier)injure(p,{source:'match',date,random});return true;
  }
  function afterMatch(m){
    if(!m||!active())return false;m.medical??={minutes:{},lastMinute:m.minute,closed:false};if(m.medical.closed)return false;
    const distance=travel(m.home,m.away,m.neutral),ids=new Set([...Object.keys(m.minutesPlayed||{}),...Object.keys(m.medical.minutes||{})]);
    for(const value of ids){const p=player(Number(value));if(!p)continue;const minutes=Number(m.minutesPlayed?.[value]??m.medical.minutes[value]??0),side=p.clubId===m.home?0:1;
      appearance(p,{id:`match-${m.eventId}-${m.home}-${m.away}`,minutes,load:intensity(m,side),distance:side===1?distance.km*2:0,fatigue:false});
      if(p.injury>0&&!state(p).injury)state(p); // Adopt legacy engine injury without rerolling its duration.
    }
    m.medical.closed=true;return true;
  }
  function afterQuickMatch(event,g,result,lineups){
    if(!active())return false;const journey=travel(g.home,g.away,event?.neutral),length=result?.extraTime?120:90;let count=0;
    for(let side=0;side<2;side++){const ids=lineups?.[side]||WORLD_ENGINE.aiXI?.(side?g.away:g.home)||[];for(const id of ids){const p=player(id);if(p&&appearance(p,{id:`match-${event?.id||event?.date}-${g.home}-${g.away}`,date:event?.date||GameState.today,minutes:length,load:1,distance:side?journey.km*2:0}))count++}}
    return count>0;
  }
  function factor(p){const r=state(p);return bound(.93+r.sharpness*.0007-r.tissueFatigue*.0003,.90,1)}
  function setRehab(id,plan){const p=player(Number(id));if(!p||p.clubId!==GameState.userClub.id||!['Normal','Especialista','Prudente'].includes(plan)||locked())return false;const r=state(p),injury=r.injury;if(!injury||r.rehab===plan)return false;
    const receipts=ensure().receipts,key=injury.id+':specialist';if(plan==='Especialista'&&!receipts[key]){const cost=Math.max(1500,Math.round((p.salario||1500)*.6));if((window.FM_FINANCES?.operatingAvailable?.()??CLUB_AI.availableBudget())<cost){toast('No hay caja disponible para la consulta especializada');return false}MANAGEMENT.transaction(-cost,`Consulta y rehabilitación especializada: ${p.nombre}`,'medico');receipts[key]={date:GameState.today,cost};
      // A consultation narrows uncertainty; it does not promise a faster biological recovery.
      injury.earliest=add(GameState.today,Math.max(1,Math.floor(injury.remaining*.92)));injury.latest=add(GameState.today,Math.ceil(injury.remaining*1.08));}
    r.rehab=plan;if(plan==='Prudente')r.restUntil=injury.latest;notify(p,'Plan de recuperación actualizado',`${p.nombre}: ${plan==='Especialista'?'consulta especializada y controles adicionales, sin garantía de adelantar el alta':plan==='Prudente'?'se prioriza la vuelta gradual y se mantiene descanso individual hasta el extremo superior del pronóstico':'seguimiento habitual del cuerpo médico'}.`);saveGame(true);render();return true;
  }
  function setRest(id,days){const p=player(Number(id));if(!p||p.clubId!==GameState.userClub.id||locked())return false;const r=state(p);r.restUntil=days?add(GameState.today,bound(days,1,7)):null;saveGame(true);render();return true}
  function report(p){const r=state(p),load=risk(p),injury=r.injury;return {condition:Math.round(p.condicion_fisica),sharpness:Math.round(r.sharpness),tissueFatigue:Math.round(r.tissueFatigue),risk:load,injury:injury?{...injury}:null,minuteLimit:minuteLimit(p),restUntil:r.restUntil,lastMatch:r.lastMatch,history:r.history.map(x=>({...x})),rehab:r.rehab,lostDays:r.lostDays||0}}
  function page(){const rows=mine().map(p=>({p,r:report(p)})).sort((a,b)=>(b.p.injury>0)-(a.p.injury>0)||b.r.risk.score-a.r.risk.score),journey=(()=>{const event=window.FM_DEVELOPMENT?.fixtures()[0],g=event&&WORLD_ENGINE.eventGames(event).find(x=>x.home===GameState.userClub.id||x.away===GameState.userClub.id);return g&&g.away===GameState.userClub.id?travel(g.home,g.away,event.neutral):null})();
    return `<section class="card med-centre"><div class="med-heading"><h2>Medicina y rendimiento</h2><span class="badge">${rows.filter(x=>x.p.injury).length} bajas · ${rows.filter(x=>x.r.risk.label==='Alto').length} riesgos altos</span></div><div class="med-legend"><span><b>Condición:</b> energía disponible</span><span><b>Ritmo:</b> preparación competitiva</span><span><b>Fatiga:</b> carga acumulada de tejidos</span></div>${journey?`<div class="med-trip">Próximo viaje: ~${journey.km.toLocaleString('es-AR')} km por tramo. ${esc(journey.basis)}; se computa ida y vuelta para la carga.</div>`:''}<div class="scroll"><table><thead><tr><th>Jugador</th><th>Condición / ritmo</th><th>Carga 7 días</th><th>Estado y pronóstico</th><th>Plan y descanso</th></tr></thead><tbody>${rows.map(({p,r})=>`<tr><td><button data-player="${p.id}">${esc(p.nombre)}</button><small>${p.edad} años · ${p.posicion}</small></td><td>${r.condition}% / ${r.sharpness}%<small>Fatiga ${r.tissueFatigue}% · límite ${r.minuteLimit}′</small></td><td>${r.risk.minutes}′ · ${r.risk.acute} UA<small>${r.risk.label} · ${Math.round(r.risk.travel).toLocaleString('es-AR')} km estimados</small></td><td>${r.injury?`<strong class="red">${esc(r.injury.label)}</strong><small>${esc(r.injury.stage)} · ${date(r.injury.earliest)} a ${date(r.injury.latest)}${r.injury.recurrence?' · recaída':''}</small>`:`${r.risk.returning?'<strong class="gold">Reintegración progresiva</strong>':'Apto'}<small>${r.lastMatch?'Último partido '+date(r.lastMatch):'Sin minutos registrados'}${r.restUntil?' · descanso hasta '+date(r.restUntil):''}</small>`}</td><td>${r.injury?`<select data-med-rehab="${p.id}" ${locked()?'disabled':''}>${['Normal','Prudente','Especialista'].map(v=>`<option ${r.rehab===v?'selected':''}>${v}</option>`).join('')}</select>`:`<button data-med-rest="${p.id}" ${locked()?'disabled':''}>${r.restUntil?'Quitar descanso':'Descanso 2 días'}</button>`}</td></tr>`).join('')}</tbody></table></div><p class="med-note">Las lesiones y pronósticos pertenecen a la simulación de esta carrera. Las unidades de carga y distancias son estimaciones del juego. Tener el alta médica no asegura ritmo ni elimina el riesgo de recaída.</p></section>`;
  }
  document.addEventListener('change',e=>{if(e.target.dataset.medRehab)setRehab(e.target.dataset.medRehab,e.target.value)});
  document.addEventListener('click',e=>{const n=e.target.closest('[data-med-rest]');if(n){const p=player(Number(n.dataset.medRest));setRest(p.id,state(p).restUntil?0:2)}});
  return {incidence:INCIDENCE,ensure,state,types,loads,risk,injure,trainingLoad,recoverPlayer,onDay,minuteLimit,onMinute,maybeInjury,travel,appearance,afterMatch,afterQuickMatch,factor,setRehab,setRest,report,page};
})();
