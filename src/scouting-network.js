/* Assessments belong to the simulated staff. Published identities are never scouting conclusions. */
window.FM_SCOUT_NETWORK=(()=>{
  const DAY=86400000, VERSION=1, ATTRIBUTES=['ritmo','tiro','pase','regate','defensa','fisico'];
  const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0};
  const bound=(n,lo=1,hi=99)=>Math.min(hi,Math.max(lo,n));
  const active=()=>GameState?.worldVersion===1;
  const ageDays=(from,to=GameState.today)=>Math.max(0,Math.floor((Date.parse(to)-Date.parse(from||to))/DAY));
  const own=(p,id=GameState.userClub.id)=>p.clubId===id;
  let npcState=null,npcDay='',npcOpinions=new Map(),npcStaff=new Map();
  function npcCache(){if(npcState!==GameState||npcDay!==GameState.today){npcState=GameState;npcDay=GameState.today;npcOpinions.clear();npcStaff.clear()}return npcOpinions}
  function ensure(){if(!active())return null;const s=GameState.world.scoutNetwork??={version:VERSION,players:{},observedMatches:[]};s.players??={};s.observedMatches??=[];return s}
  function dossier(p,id=GameState.userClub.id){const s=ensure();if(!s||!p)return null;if(id!==GameState.userClub.id)return {observations:[],matches:[],firstSeen:GameState.today};const records=s.players[p.id]??={};return records[id]??={observations:[],matches:[],firstSeen:GameState.today}}
  function staffFor(plan={},id=GameState.userClub.id){
    const current=id===GameState.userClub.id?window.FM_OFFICE?.office()?.staff.find(e=>e.id===plan.staffId):null;
    if(current)return {id:current.id,name:current.name,ability:Number(current.ability)||60,adaptability:Number(current.adaptability)||60,region:current.region||''};
    npcCache();if(id!==GameState.userClub.id&&npcStaff.has(id))return npcStaff.get(id);const c=club(id),seed=hash(id+'-scouting'),staff={id:plan.staffId||id+'-technical-staff',name:plan.staffName||'Cuerpo técnico estimado',ability:bound((c?.rating||60)-5+seed%14,35,90),adaptability:55+seed%30,region:c?.country||'',observationSeed:seed};if(id!==GameState.userClub.id)npcStaff.set(id,staff);return staff;
  }
  function publicQuality(p){
    const value=Number(p.transfermarkt?.marketValueEUR)||Number(p.valor_mercado)||0;
    return bound(value>0?48+Math.log10(Math.max(50000,value)/50000)*12:(club(p.clubId)?.rating||60)-5,25,94);
  }
  function familiarity(p,staff){return staff.region===club(p.clubId)?.country||(p.nationalities||[p.nacionalidad]).includes(staff.region)}
  function outlook(quality,p){const age=Number(p.edad)||25;return bound(quality+(age<=18?12:age<=21?9:age<=24?5:age<=27?2:0),1,97)}
  function makeObservation(p,report={},day=GameState.today,id=GameState.userClub.id,transientDossier=null){
    const d=transientDossier||dossier(p,id),staff=staffFor(report,id),coverage=bound(Number(report.level)||15,0,100),local=familiarity(p,staff),samples=d.matches.length;
    const confidence=Math.round(bound(14+coverage*.43+staff.ability*.24+(local?6:-3)+Math.min(12,samples*2),15,92));
    const spread=Math.ceil(Math.max(3,(100-confidence)/6+(local?0:1)-Math.min(2,samples*.25)));
    const publicSeed=id===GameState.userClub.id?null:Math.imul((Number(p.id)||hash(p.id))^staff.observationSeed,2654435761)>>>0,signed=((publicSeed??hash(p.id+':'+staff.id+':judgement'))%2001-1000)/1000;
    const baseline=coverage>=40?overall(p):publicQuality(p),error=signed*(spread+.5)*(coverage>=40?.86:.6);
    const quality=bound(Math.round(baseline+error));
    const potential=bound(Math.round(outlook(quality,p)+((publicSeed===null?hash('development:'+p.id+':'+staff.id):(Math.imul(publicSeed^0x9e3779b9,1597334677)>>>0))%700-350)/100),1,99);
    const attributes=id===GameState.userClub.id?Object.fromEntries(ATTRIBUTES.map(key=>{const variation=(hash(p.id+':'+staff.id+':'+key)%2001-1000)/1000;return [key,bound(Math.round((coverage>=40?Number(p[key])||baseline:baseline)+variation*spread*.8))]})):undefined;
    return {schema:VERSION,date:day,staff,attributes,coverage,confidence,familiar:local,quality,potential,spread,potentialSpread:Math.ceil(Math.max(5,spread+((p.edad||25)<=21?7:(p.edad||25)<=25?4:2))),matchSample:samples,source:'simulated-observation',basis:coverage>=40?'Seguimiento preparado por el empleado dentro de esta carrera':'Referencia pública y primera impresión; sin evaluación deportiva completa'};
  }
  function capture(p,report,day=GameState.today){
    if(!p||!active())return null;const d=dossier(p),record=makeObservation(p,report,day),same=d.observations.find(o=>o.date===day&&o.staff.id===record.staff.id&&o.coverage===record.coverage);
    if(same)return same;d.observations.push(record);d.observations=d.observations.slice(-24);report.observationSchema=VERSION;report.assessmentDate=day;return record;
  }
  function latest(p,id=GameState.userClub.id){
    if(id!==GameState.userClub.id){const cache=npcCache(),key=id+':'+p.id+':'+p.clubId+':'+p.edad+':'+p.valor_mercado;if(cache.has(key))return cache.get(key);const o=makeObservation(p,{level:own(p,id)?100:15},GameState.today,id);o.source=own(p,id)?'simulated-training-assessment':'reference-impression';cache.set(key,o);if(cache.size>4096)cache.delete(cache.keys().next().value);return o}
    const d=dossier(p,id),observations=d.observations;
    if(own(p,id)&&!d.preferredStaffId&&(!observations.length||ageDays(observations.at(-1).date)>=30)){
      if(!d.coachingSnapshot||d.coachingSnapshot.date.slice(0,7)!==GameState.today.slice(0,7)){const coach=id===GameState.userClub.id?window.FM_OFFICE?.office()?.staff.find(e=>e.role==='Ayudante'):null;d.coachingSnapshot=makeObservation(p,{level:100,staffId:coach?.id},GameState.today,id);d.coachingSnapshot.source='simulated-training-assessment'}return d.coachingSnapshot;
    }
    if(observations.length)return d.preferredStaffId?observations.findLast(o=>o.staff.id===d.preferredStaffId)||observations.at(-1):observations.at(-1);
    const report=id===GameState.userClub.id?window.FM_DEPTH?.ensure()?.reports[p.id]:null;
    const initial=makeObservation(p,{...(report||{}),level:own(p,id)?100:report?.level||15},GameState.today,id);
    initial.source=own(p,id)?'simulated-training-assessment':'reference-impression';if(!d.impression||own(p,id)&&d.impression.date.slice(0,7)!==GameState.today.slice(0,7))d.impression=initial;return d.impression;
  }
  function knowledge(p){
    const r=window.FM_DEPTH?.ensure()?.reports[p.id],legacy=GameState.scouting?.reports?.[p.id],known=own(p),o=latest(p),stale=Math.min(45,Math.floor(ageDays(r?.updated||o.date)/30)*10);
    const preserved=!!(!known&&((r?.completed&&!r.observationSchema)||(!r&&legacy)));
    const level=known?100:Math.max(15,(r?.level||legacy&&100||15)-(r?.completed?stale:0));
    const confidence=Math.round(bound(o.confidence-Math.floor(ageDays(o.date)/30)*5,10,92));
    return {level,coverage:level,confidence,spread:known?0:preserved&&level>=100?0:Math.max(3,o.spread+Math.floor(ageDays(o.date)/30)),legacy:preserved,label:preserved?'Informe anterior conservado':known?'Observación cotidiana del cuerpo técnico':r?.status==='active'?'Observación en curso':level>=100?'Cobertura completa; juicio estimado':'Cobertura parcial',observedMatches:dossier(p).matches.length};
  }
  function assessment(p,{kind='quality',value,scale=99,observerClub=GameState.userClub.id}={}){
    const o=latest(p,observerClub),known=own(p,observerClub),isPotential=kind==='potential',stale=Math.min(10,Math.floor(ageDays(o.date)/30)),k=observerClub===GameState.userClub.id?knowledge(p):null;
    const exactQuality=known||k?.legacy&&k.level>=100;
    const d=observerClub===GameState.userClub.id?dossier(p):null;if(k?.legacy&&d&&d.legacyQualitySnapshot==null){const snapshot=Number(GameState.scouting?.reports?.[p.id]?.rating);d.legacyQualitySnapshot=Number.isFinite(snapshot)&&snapshot>=1&&snapshot<=99?snapshot:overall(p)}
    let center=isPotential?o.potential:known?overall(p):exactQuality?d.legacyQualitySnapshot:o.quality,width=isPotential?o.potentialSpread+stale:exactQuality?0:o.spread+stale;
    if(value!==undefined&&!isPotential){center=Number(value)+(exactQuality?0:(o.quality-overall(p))*scale/99);width=Math.ceil(width*scale/99)}else{center=center*scale/99;width=Math.ceil(width*scale/99)}
    center=bound(Math.round(center),1,scale);const low=bound(center-width,1,scale),high=bound(center+width,1,scale);
    return {low,high,estimate:center,confidence:Math.round(bound(o.confidence-stale*5,10,92)),coverage:k?.level??o.coverage,source:o.source,observedAt:o.date,staffId:o.staff.id,kind};
  }
  function observedPlayer(p,id=GameState.userClub.id){if(own(p,id))return p;const o=latest(p,id),attributes=Object.fromEntries(ATTRIBUTES.map(key=>[key,Number.isFinite(o.attributes?.[key])?o.attributes[key]:o.quality]));return {...p,...attributes,potential:o.potential}}
  function filterSnapshot(p){
    // Scanning the whole database must not create thousands of saved dossiers.
    const d=GameState.world.scoutNetwork?.players?.[p.id]?.[GameState.userClub.id],r=GameState.world.depth?.reports?.[p.id],legacy=GameState.scouting?.reports?.[p.id],known=own(p),observations=d?.observations||[];
    const o=(d?.preferredStaffId&&observations.findLast(o=>o.staff.id===d.preferredStaffId))||observations.at(-1)||d?.impression||makeObservation(p,{...(r||{}),level:known?100:r?.level||15},GameState.today,GameState.userClub.id,{matches:d?.matches||[]});
    const preserved=!known&&((r?.completed&&!r.observationSchema)||(!r&&legacy)),stale=Math.min(45,Math.floor(ageDays(r?.updated||o.date)/30)*10),coverage=known?100:Math.max(15,(r?.level||legacy&&100||15)-(r?.completed?stale:0));
    const oldQuality=Number(legacy?.rating),quality=known?overall(p):preserved&&coverage>=100?(d?.legacyQualitySnapshot??(Number.isFinite(oldQuality)&&oldQuality>=1&&oldQuality<=99?oldQuality:overall(p))):o.quality;
    return {quality:bound(Math.round(quality)),potential:bound(Math.round(o.potential)),attributes:known?Object.fromEntries(ATTRIBUTES.map(k=>[k,p[k]])):Object.fromEntries(ATTRIBUTES.map(k=>[k,o.attributes?.[k]??o.quality])),coverage,confidence:Math.round(bound(o.confidence-Math.floor(ageDays(o.date)/30)*5,10,92))};
  }
  function observedRange(p,value,scale=99){const o=latest(p),exact=own(p)||knowledge(p).legacy&&knowledge(p).level>=100,width=exact?0:Math.ceil((o.spread+Math.min(10,Math.floor(ageDays(o.date)/30)))*scale/99),center=bound(Math.round(Number(value)||1),1,scale),low=bound(center-width,1,scale),high=bound(center+width,1,scale);return low===high?String(center):`${low}–${high}`}
  function range(p,value,scale=99,kind='quality'){const a=assessment(p,{kind,value,scale});return a.low===a.high?String(a.estimate):`${a.low}–${a.high}`}
  const potentialRange=p=>range(p,undefined,99,'potential');
  function prefer(id,staffId){const p=player(Number(id));if(!p)return false;const d=dossier(p);if(staffId&&!d.observations.some(o=>o.staff.id===staffId))return false;d.preferredStaffId=staffId||null;WORLD_STORAGE.scheduleSave();render();return true}
  function canReobserve(p,plan={}){
    const r=window.FM_DEPTH?.ensure()?.reports[p.id];if(!r?.completed)return true;
    const d=dossier(p),staff=staffFor(plan);return !d.observations.some(o=>o.coverage===100&&o.staff.id===staff.id&&ageDays(o.date)<30);
  }
  function recommendation(p,targetClubId=GameState.userClub.id){
    const a=assessment(p,{observerClub:targetClubId}),future=assessment(p,{kind:'potential',observerClub:targetClubId}),group=squad(targetClubId).filter(q=>q.posicion===p.posicion),quality=group.length?group.reduce((n,q)=>n+overall(q),0)/group.length:45,delta=a.estimate-quality;
    const observed=a.coverage>=40,uncertain=a.low<=quality&&a.high>=quality,score=Math.round(delta-Math.max(0,a.high-a.low-8)*.16);
    return {label:!observed?'Falta observación para recomendar':uncertain?'Encaje incierto: comparar otra opinión':a.low>quality+2?'Mejora probable del puesto':a.high<quality-3?'No parece mejorar la cobertura':'Alternativa probable de rotación',score,cost:p.valor_mercado+p.salario*52,confidence:a.confidence,quality:a,potential:future,upside:Math.max(0,future.estimate-a.estimate)};
  }
  function risks(p){
    const d=dossier(p),k=knowledge(p),local=club(p.clubId)?.country===GameState.userClub.country,rows=[];
    rows.push({label:'Adaptación',text:k.level<40?'Sin observación suficiente para evaluar el cambio de entorno':local?'El país de su club coincide con el destino; la adaptación individual sigue siendo incierta':'Cambiaría de país y entorno deportivo; prever acompañamiento, sin asumir que vaya a fallar'});
    rows.push({label:'Personalidad',text:d.matches.length<2?'Sin muestra de partidos observados para describir su conducta':`Se registraron ${d.matches.length} partidos de esta carrera. La conducta observada no permite certificar una personalidad ni su potencial`});
    rows.push({label:'Disponibilidad médica',text:p.injury?'La simulación registra una lesión activa; requiere revisión médica':'No equivale a un reconocimiento médico: el informe deportivo no descarta riesgos físicos'});
    return rows;
  }
  function reportHTML(p){
    const k=knowledge(p),d=dossier(p),opinions=[...new Map(d.observations.slice().reverse().map(o=>[o.staff.id,o])).values()],a=assessment(p),potential=assessment(p,{kind:'potential'});
    return `<section class="card sn-report"><div class="sn-heading"><h2>Opiniones de la red de ojeo</h2><span class="badge">Cobertura ${k.level}% · confianza ${k.confidence}%</span></div><p class="small muted">La cobertura mide el encargo realizado. La confianza expresa una estimación del simulador, sin garantía estadística. Completar una observación no revela el techo real de desarrollo.</p>${opinions.length>1?`<label class="sn-opinion-choice">Opinión de referencia<select data-sn-opinion="${p.id}"><option value="">Última opinión disponible</option>${opinions.map(o=>`<option value="${esc(o.staff.id)}" ${d.preferredStaffId===o.staff.id?'selected':''}>${esc(o.staff.name)} · ${esc(o.date)}</option>`).join('')}</select></label>`:''}<div class="sn-summary"><span>Calidad estimada <b>${a.low===a.high?a.estimate:a.low+'–'+a.high}</b></span><span>Desarrollo estimado <b>${potential.low}–${potential.high}</b></span><span>Partidos observados <b>${d.matches.length}</b></span></div><div class="scroll"><table><thead><tr><th>Observador / fecha</th><th>Cobertura / confianza</th><th>Calidad</th><th>Desarrollo</th><th>Evidencia</th></tr></thead><tbody>${opinions.map(o=>`<tr><td>${esc(o.staff.name)}<small>${esc(o.date)} · habilidad ${o.staff.ability}/99</small></td><td>${o.coverage}% / ${o.confidence}%</td><td>${bound(o.quality-o.spread)}–${bound(o.quality+o.spread)}</td><td>${bound(o.potential-o.potentialSpread)}–${bound(o.potential+o.potentialSpread)}</td><td>${o.matchSample} partidos registrados<small>${esc(o.basis)}</small></td></tr>`).join('')||'<tr><td colspan="5">Primera impresión. Pedí una observación para obtener una opinión firmada; otro empleado puede aportar una segunda evaluación.</td></tr>'}</tbody></table>${risks(p).map(r=>`<p><b>${r.label}.</b> ${esc(r.text)}</p>`).join('')}</div></section>`;
  }
  function sourceHTML(p){
    const ref=p.transfermarkt||{},published=p.realIdentity,synthetic=p.synthetic===true,source=ref.sourceUrl,profile=ref.profileUrl,safeUrl=url=>{try{const u=new URL(url);return /^https?:$/.test(u.protocol)?u.href:''}catch{return ''}},link=(url,text)=>safeUrl(url)?`<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${text}</a>`:text;
    return `<section class="card sn-provenance"><h2>Qué es dato de referencia y qué estima el juego</h2><div class="scroll"><table><thead><tr><th>Origen</th><th>Contenido</th><th>Fecha y alcance</th></tr></thead><tbody><tr><td>${published?'Identidad publicada':synthetic?'Reserva ficticia':'Cantera simulada'}</td><td>${published?'Nombre, nacimiento, nacionalidades y posición publicados; pie y altura cuando están disponibles':synthetic?'Reserva ficticia para completar un plantel sin cobertura publicada suficiente; no es un jugador real ni una incorporación de cantera':'Identidad creada dentro de esta carrera; sin atribución a Transfermarkt'}</td><td>${published?`Temporada ${esc(ref.season||ref.sourceSeason||'sin fecha')} · consulta ${esc(String(ref.retrievedAt||'sin fecha registrada').slice(0,10))}`:'Generación del simulador'}</td></tr><tr><td>Tasación de referencia</td><td>${Number.isFinite(ref.marketValueEUR)?`${esc(String(ref.marketValueEUR))} EUR publicados`:'No hay una tasación publicada utilizable'}</td><td>Fecha de tasación: ${ref.valuationDate?esc(ref.valuationDate):'no informada'}${ref.valuationCutoff?' · corte '+esc(ref.valuationCutoff):''}; no se actualiza en vivo</td></tr><tr><td>Estimaciones de carrera</td><td>Atributos, potencial interno, salario, contrato negociado, cláusulas, personalidad y valor en USD</td><td>No son valoraciones oficiales de Football Manager ni datos contractuales verificados de Transfermarkt</td></tr><tr><td>Observaciones del empleado</td><td>Intervalos, opiniones y riesgos que pueden diferir entre ojeadores</td><td>Se producen dentro de esta simulación; sólo se cuentan partidos realmente registrados en la carrera</td></tr></tbody></table><p>${link(profile,'Perfil de referencia')} · ${link(source,'Plantel fuente')}.</p><p class="small muted">La pertenencia inicial corresponde a la instantánea indicada. Traspasos, estadísticas, contratos y desarrollo posteriores pertenecen a tu partida. La fecha de consulta no convierte los datos en una base en tiempo real.</p></div></section>`;
  }
  function observeMatch(m){
    if(!active()||!m||!m.done||!m.lineups)return false;const s=ensure(),key=String(m.eventId||m.event?.id||m.id||`${m.date||GameState.today}:${m.home}:${m.away}`);if(s.observedMatches.includes(key))return false;
    s.observedMatches.push(key);s.observedMatches=s.observedMatches.slice(-500);
    for(const id of new Set([...m.lineups.flat(),...Object.keys(m.ratings||{}).map(Number)])){const p=player(id);if(!p)continue;const r=window.FM_DEPTH?.ensure()?.reports[id];if(!own(p)&&r?.status!=='active')continue;const d=dossier(p);d.matches.push({id:key,date:m.date||GameState.today,minutes:Number(m.playerMinutes?.[id])||null});d.matches=d.matches.slice(-30);if(r?.status==='active')capture(p,r,m.date||GameState.today)}return true;
  }
  document.addEventListener('change',event=>{if(event.target.hasAttribute('data-sn-opinion'))prefer(event.target.dataset.snOpinion,event.target.value)});
  return {ensure,dossier,staffFor,capture,knowledge,assessment,range,observedPlayer,observedRange,potentialRange,prefer,canReobserve,recommendation,risks,reportHTML,sourceHTML,observeMatch,publicQuality,filterSnapshot};
})();
