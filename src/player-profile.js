/* A full player workspace for expanded careers. Historic source data stays separate. */
(() => {
  const legacyDetails = details;
  const active = () => Boolean(GameState?.worldVersion && GameState.world);
  const state = { id: null, tab: 'summary', compare: null, compareQuery: '', metric: 'overall', back: 'squad' };
  const tabs = [['summary','Resumen'],['attributes','Atributos'],['progress','Evolución'],['stats','Estadísticas'],['contract','Contrato'],['health','Estado físico'],['sources','Fuentes']];
  const core = ['ritmo','tiro','pase','regate','defensa','fisico'];
  const labels = { ritmo:'Velocidad',tiro:'Remate',pase:'Pase',regate:'Regate',defensa:'Defensa',fisico:'Fortaleza',overall:'Calidad',potential:'Potencial',value:'Valor',condition:'Condición',moral:'Moral' };
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const observedPlayer = p => window.FM_SCOUT_NETWORK?.observedPlayer ? FM_SCOUT_NETWORK.observedPlayer(p) : p;
  const observedRange = (p,value,scale=99) => window.FM_SCOUT_NETWORK?.observedRange ? FM_SCOUT_NETWORK.observedRange(p,value,scale) : window.FM_DEPTH?FM_DEPTH.range(p,value,scale):value;
  const skill = (p,key) => clamp(number(observedPlayer(p)[key]) || 50,1,99);
  const initial = p => p.nombre.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('');
  const own = p => p.clubId === GameState.userClub.id;
  const currentClub = p => p.clubId ? club(p.clubId)?.nombre || 'Club' : 'Agente libre';
  const score20 = value => clamp(Math.round(value/5),1,20);
  const compactCash = value => number(value)>=1e6 ? `USD ${(number(value)/1e6).toLocaleString('es-AR',{maximumFractionDigits:2})} M` : money(number(value));
  const safeDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? date(value) : String(value || '');
  const positionNames = {POR:'Arquero',DFC:'Defensor central',LI:'Lateral izquierdo',LD:'Lateral derecho',MCD:'Mediocentro defensivo',MC:'Mediocentro',MP:'Mediapunta',EI:'Extremo izquierdo',ED:'Extremo derecho',DC:'Delantero centro'};
  function naturalPositions(p) {
    const published = norm(p.transfermarkt?.positionDetail || p.positionDetail || '');
    const found = [];
    const check = (code, expression) => { if(expression.test(published))found.push(code); };
    check('POR',/goalkeeper|arquero|portero/);
    check('DFC',/centre.back|center.back|defensor central|defensa central/);
    check('LI',/left.back|left wing.back|lateral izquierdo|carrilero izquierdo/);
    check('LD',/right.back|right wing.back|lateral derecho|carrilero derecho/);
    check('MCD',/defensive midfield|mediocentro defensivo|pivote/);
    check('MC',/central midfield|centre midfield|mediocentro(?! defensivo)|volante central/);
    check('MP',/attacking midfield|mediapunta|segundo delantero|second striker/);
    check('EI',/left winger|left midfield|extremo izquierdo|interior izquierdo/);
    check('ED',/right winger|right midfield|extremo derecho|interior derecho/);
    check('DC',/centre.forward|center.forward|striker|delantero centro/);
    return [...new Set(found.length ? found : [{POR:'POR',DEF:'DFC',MED:'MC',DEL:'DC'}[p.posicion] || 'MC'])];
  }
  const attributeGroups = [
    ['Técnicos',[['pase','Pases'],['control','Primer toque'],['regate','Regate'],['tecnica','Técnica'],['remate','Remate'],['cabeceo','Cabeceo'],['centros','Centros'],['entradas','Entradas'],['marcaje','Marcaje'],['tiros_lejanos','Tiros lejanos'],['balon_parado','Balón parado'],['penales','Penales']]],
    ['Mentales',[['anticipacion','Anticipación'],['decisiones','Decisiones'],['concentracion','Concentración'],['colocacion','Colocación'],['vision','Visión'],['desmarques','Desmarques'],['trabajo_equipo','Trabajo en equipo'],['determinacion','Determinación'],['valentia','Valentía'],['serenidad','Serenidad']]],
    ['Físicos',[['aceleracion','Aceleración'],['velocidad','Velocidad'],['agilidad','Agilidad'],['equilibrio','Equilibrio'],['resistencia','Resistencia'],['fuerza','Fuerza'],['salto','Salto'],['recuperacion','Recuperación']]]
  ];
  function attributes(p) {
    const seed = number(p.transfermarkt?.playerId || p.id) >>> 0;
    const mix = (key,weights,index) => {
      const weighted = Object.entries(weights).reduce((sum,[name,weight])=>sum+skill(p,name)*weight,0);
      const jitter = (((Math.imul(seed ^ Math.imul(index+7,2654435761),1597334677) >>> 0) % 11) - 5);
      return Math.round(clamp(weighted + jitter,1,99));
    };
    const definitions = {
      pase:{pase:1},control:{pase:.45,regate:.55},regate:{regate:1},tecnica:{pase:.45,regate:.4,tiro:.15},remate:{tiro:1},cabeceo:{fisico:.55,tiro:.25,defensa:.2},centros:{pase:.6,regate:.25,tiro:.15},entradas:{defensa:.85,fisico:.15},marcaje:{defensa:1},tiros_lejanos:{tiro:.7,pase:.3},balon_parado:{pase:.55,tiro:.45},penales:{tiro:.8,pase:.2},
      anticipacion:{defensa:.5,pase:.3,ritmo:.2},decisiones:{pase:.6,defensa:.4},concentracion:{defensa:.7,fisico:.3},colocacion:{defensa:.8,pase:.2},vision:{pase:.85,regate:.15},desmarques:{ritmo:.45,tiro:.35,regate:.2},trabajo_equipo:{pase:.55,defensa:.25,fisico:.2},determinacion:{fisico:.65,defensa:.35},valentia:{fisico:.6,defensa:.4},serenidad:{pase:.45,tiro:.4,defensa:.15},
      aceleracion:{ritmo:.85,regate:.15},velocidad:{ritmo:1},agilidad:{ritmo:.6,regate:.4},equilibrio:{fisico:.55,regate:.45},resistencia:{fisico:.75,ritmo:.25},fuerza:{fisico:1},salto:{fisico:.8,defensa:.2},recuperacion:{fisico:1},
      reflejos:{defensa:.7,ritmo:.3},blocaje:{defensa:.85,fisico:.15},uno_contra_uno:{defensa:.7,fisico:.3},salidas:{defensa:.6,ritmo:.25,fisico:.15},mando_area:{defensa:.65,fisico:.35},saque_mano:{pase:.65,fisico:.35}
    };
    return Object.fromEntries(Object.entries(definitions).map(([key,weights],index)=>[key,mix(key,weights,index)]));
  }
  const roleDefinitions = {
    'Arquero':{positions:['POR'],weights:{defensa:.55,fisico:.3,pase:.15}},
    'Arquero líbero':{positions:['POR'],weights:{defensa:.4,pase:.3,ritmo:.2,fisico:.1}},
    'Defensor central':{positions:['DFC'],weights:{defensa:.6,fisico:.25,pase:.15}},
    'Lateral':{positions:['LI','LD'],weights:{defensa:.4,ritmo:.3,pase:.2,fisico:.1}},
    'Carrilero':{positions:['LI','LD','EI','ED'],weights:{ritmo:.35,pase:.25,regate:.25,defensa:.15}},
    'Pivote':{positions:['MCD','MC'],weights:{defensa:.45,pase:.35,fisico:.2}},
    'Organizador':{positions:['MC','MP','MCD'],weights:{pase:.6,regate:.25,defensa:.15}},
    'Volante mixto':{positions:['MC','MCD'],weights:{pase:.3,fisico:.25,defensa:.25,ritmo:.2}},
    'Interior':{positions:['MC','MP','EI','ED'],weights:{pase:.4,regate:.35,ritmo:.25}},
    'Mediapunta':{positions:['MP','MC'],weights:{pase:.4,regate:.35,tiro:.25}},
    'Extremo':{positions:['EI','ED'],weights:{ritmo:.4,regate:.35,pase:.15,tiro:.1}},
    'Delantero avanzado':{positions:['DC'],weights:{tiro:.5,ritmo:.35,regate:.15}},
    'Delantero completo':{positions:['DC'],weights:{tiro:.35,regate:.25,fisico:.2,pase:.2}},
    'Hombre objetivo':{positions:['DC'],weights:{fisico:.5,tiro:.35,pase:.15}}
  };
  function roleFit(p,role,slot) {
    const entry = roleDefinitions[role] || roleDefinitions[Object.keys(roleDefinitions).find(name=>norm(name)===norm(role))];
    if(!entry)return overall(p);
    const positions = naturalPositions(p);
    const suitable = positions.some(pos=>entry.positions.includes(pos));
    let fit = Object.entries(entry.weights).reduce((sum,[key,weight])=>sum+skill(p,key)*weight,0) - (suitable?0:14);
    if(slot && !positions.includes(slot)) {
      const groups = {POR:'POR',DFC:'DEF',LI:'DEF',LD:'DEF',MCD:'MED',MC:'MED',MP:'MED',EI:'DEL',ED:'DEL',DC:'DEL'};
      const close = positions.some(pos=>groups[pos]===groups[slot] || (['EI','ED'].includes(pos)&&['MC','MP'].includes(slot)));
      fit -= close ? 6 : 15;
    }
    return Math.round(clamp(fit,1,99));
  }
  const recommendations = p => Object.keys(roleDefinitions).filter(role=>naturalPositions(p).some(pos=>roleDefinitions[role].positions.includes(pos))).map(role=>({role,fit:roleFit(p,role)})).sort((a,b)=>b.fit-a.fit).slice(0,3);
  const assessment = (p,potential=false) => window.FM_SCOUT_NETWORK ? FM_SCOUT_NETWORK.assessment(p,{kind:potential?'potential':'quality'}) : {low:potential?null:overall(p),high:potential?null:overall(p),estimate:potential?null:overall(p),confidence:0};
  const potentialText = p => window.FM_DEPTH?.potentialRange ? FM_DEPTH.potentialRange(p) : 'Sin evaluación';
  const contractEnd = p => window.MARKET_CONTRACTS?.contractEnd ? MARKET_CONTRACTS.contractEnd(p) : `${p.contract}-12-31`;
  const contractDays = p => Math.max(0,Math.ceil((Date.parse(contractEnd(p))-Date.parse(GameState.today))/86400000));
  const seasonLabel = p => window.FM_SEASONS?.active() ? FM_SEASONS.leagueSeason(club(p.clubId)?.leagueId)?.label || GameState.year : GameState.year;
  const personalityText = p => own(p) ? `${p.personalidad||'Sin evaluación'} · valoración simulada del cuerpo técnico` : window.FM_SCOUT_NETWORK?.risks(p).find(r=>r.label==='Personalidad')?.text || 'Sin evidencia suficiente';
  function relativeStars(p,potential=false) {
    const members = mine();
    const average = members.reduce((sum,item)=>sum+overall(item),0)/Math.max(1,members.length);
    const estimate=assessment(p,potential).estimate;
    return estimate===null?null:Math.round(clamp(3+(estimate-average)/10,.5,5)*2)/2;
  }
  const stars = (p,potential=false) => {
    const a=assessment(p,potential);
    if(potential || a.low!==a.high || window.FM_DEPTH&&FM_DEPTH.knowledge(p).level<100)return `<span class="small fp-estimated-rating">${potential?potentialText(p):window.FM_DEPTH?FM_DEPTH.range(p):`${a.low}–${a.high}`} / 99${window.FM_SCOUT_NETWORK?` · confianza ${a.confidence}%`:''}</span>`;
    const value=relativeStars(p,potential);
    return `<span class="fp-stars" aria-label="${value} de 5 estrellas, respecto de tu plantel">${Array.from({length:5},(_,index)=>`<span class="${value>=index+1?'fp-star-full':value>=index+.5?'fp-star-half':'fp-star-empty'}">★</span>`).join('')}</span>`;
  };
  function ensureProgress() {
    if(!active())return null;
    GameState.world.playerProgress ??= {};
    const progress=GameState.world.playerProgress;
    for(const [id,records] of Object.entries(progress)) {
      if(!Array.isArray(records)){delete progress[id];continue;}
      progress[id]=records.filter(record=>record && /^\d{4}-\d{2}-\d{2}$/.test(record.date || '')).slice(-24);
      for(const record of progress[id])if(Object.hasOwn(record,'potential'))delete record.potential;
    }
    const ids=Object.keys(progress);
    if(ids.length>100) {
      const keep=new Set(mine().map(p=>String(p.id)));
      ids.filter(id=>!keep.has(id)).sort((a,b)=>(progress[b].at(-1)?.date || '').localeCompare(progress[a].at(-1)?.date || '')).slice(Math.max(0,100-keep.size)).forEach(id=>delete progress[id]);
    }
    return progress;
  }
  function captureProgress() {
    const progress=ensureProgress();if(!progress)return;
    const day=GameState.today,month=String(day).slice(0,7);
    for(const p of mine()) {
      const records=progress[p.id] ||= [];
      if(records.at(-1)?.date.slice(0,7)===month)continue;
      const observed=assessment(p,true);
      records.push({date:day,season:GameState.year,overall:overall(p),potentialLow:observed.low,potentialHigh:observed.high,potentialEstimate:observed.estimate,potentialConfidence:observed.confidence,value:number(p.valor_mercado),condition:Math.round(number(p.condicion_fisica)),moral:Math.round(number(p.moral)),core:core.map(key=>number(p[key])),apps:number(p.appearances),goals:number(p.goals),assists:number(p.assists),minutes:number(p.minutes)});
      progress[p.id]=records.slice(-24);
    }
    ensureProgress();
  }
  function open(id) {
    if(!active())return legacyDetails(id);
    const p=player(Number(id));if(!p)return;
    if(view!=='player')state.back=view;
    state.id=p.id;state.tab='summary';state.compare=null;state.compareQuery='';
    if(GameState.match&&!GameState.match.done&&!GameState.match.paused){GameState.match.paused=true;clearInterval(timer);saveGame(true);}
    $('#details')?.close();view='player';render();
  }
  details = function(id) {return active()?open(id):legacyDetails(id);};
  const fact = (label,value) => `<div class="fp-fact"><span>${esc(label)}</span><strong>${value}</strong></div>`;
  const availability = p => p.injury ? `${p.injury} días de lesión` : p.ban ? (GameState.worldVersion&&window.WORLD_ENGINE?.discipline?Object.entries(WORLD_ENGINE.discipline.pending(p)).map(([key,n])=>`${({LPF:'Liga',LIB:'Libertadores',SUD:'Sudamericana',ALL:'Todas las competiciones'})[key]||key}: ${n} pendiente${n===1?'':'s'}`).join(' · '):`${p.ban} partido${p.ban===1?'':'s'} de sanción`) : p.registered===false ? 'Sin inscripción' : 'Disponible';
  const comparisonOptions = p => {
    const query=norm(state.compareQuery.trim());
    let choices=query?GameState.players.filter(item=>item.id!==p.id && norm(`${item.nombre} ${currentClub(item)}`).includes(query)).slice(0,40):GameState.players.filter(item=>item.id!==p.id && (own(item)||item.clubId===p.clubId)).sort((a,b)=>a.posicion.localeCompare(b.posicion)||a.nombre.localeCompare(b.nombre));
    const selected=state.compare?player(state.compare):null;if(selected&&!choices.some(item=>item.id===selected.id))choices.unshift(selected);
    return choices;
  };
  const comparePicker = p => `<div class="fp-compare-control"><label for="fp-compare-query">Comparar jugador</label><input id="fp-compare-query" value="${esc(state.compareQuery)}" placeholder="Buscar nombre o club" autocomplete="off"><select id="fp-compare-player" aria-label="Jugador para comparar"><option value="">Sin comparación</option>${comparisonOptions(p).map(item=>`<option value="${item.id}" ${state.compare===item.id?'selected':''}>${esc(item.nombre)} · ${esc(currentClub(item))}</option>`).join('')}</select></div>`;
  const statusCards = p => `<div class="fp-metrics">${fact('Condición',`${Math.round(number(p.condicion_fisica))}%`)}${fact('Moral',esc(morale(p)))}${fact('Nota de forma',number(p.estado_forma).toFixed(1))}${fact('Disponibilidad',esc(availability(p)))}</div>`;
  function miniPitch(p) {
    const dots={POR:[50,89],DFC:[50,70],LI:[15,69],LD:[85,69],MCD:[50,56],MC:[50,43],MP:[50,28],EI:[17,23],ED:[83,23],DC:[50,12]};
    const natural=naturalPositions(p);
    return `<div class="fp-mini-pitch" role="img" aria-label="Posición: ${esc(natural.map(code=>positionNames[code]).join(', '))}"><div class="fp-pitch-half"></div><div class="fp-pitch-circle"></div><div class="fp-pitch-box top"></div><div class="fp-pitch-box bottom"></div>${Object.entries(dots).map(([code,[x,y]])=>`<span class="fp-position ${natural.includes(code)?'natural':''}" style="left:${x}%;top:${y}%">${code}</span>`).join('')}</div>`;
  }
  function summary(p,other) {
    const top=recommendations(p),a=attributes(p),possibleStrengths=p.posicion==='POR'?[['reflejos','Reflejos'],['blocaje','Blocaje'],['uno_contra_uno','Uno contra uno'],['salidas','Salidas'],['mando_area','Mando del área'],['saque_mano','Saque de mano'],...attributeGroups.slice(1).flatMap(([,items])=>items)]:attributeGroups.flatMap(([,items])=>items),strengths=possibleStrengths.sort(([first],[second])=>a[second]-a[first]).slice(0,4);
    const identityPosition=p.transfermarkt?.positionDetail||p.positionDetail;
    return `${statusCards(p)}<div class="fp-summary-grid"><section class="card fp-rating-card"><h2>Informe del cuerpo técnico</h2>${fact('Calidad actual',stars(p))}${fact('Potencial',stars(p,true))}<p class="small muted">Estrellas relativas a tu plantel. Calidad ${window.FM_DEPTH?FM_DEPTH.range(p):overall(p)}/99; potencial ${potentialText(p)}/99.</p><h3>Roles recomendados</h3>${top.map(item=>`<div class="fp-role-row"><span>${esc(item.role)}</span><b>${observedRange(p,item.fit)}%</b><div class="fp-role-bar"><span style="width:${item.fit}%"></span></div></div>`).join('')}<h3>Puntos fuertes estimados</h3><div class="fp-strengths">${strengths.map(([key,label])=>`<span>${label}<b>${observedRange(p,score20(a[key]),20)}</b></span>`).join('')}</div></section><section class="card"><h2>Posición de referencia</h2><div class="fp-position-section">${miniPitch(p)}<div><strong>${esc(naturalPositions(p).map(code=>positionNames[code]).join(' / '))}</strong><p class="small muted">${identityPosition?'La posición publicada orienta la familiaridad inicial del jugador.':'La posición se estima a partir de la categoría del motor.'}</p><div class="fp-position-tags">${naturalPositions(p).map(code=>`<span>${code}</span>`).join('')}</div><p class="small">Pie: <b>${esc(p.transfermarkt?.foot||p.foot||'Sin dato')}</b><br>Altura: <b>${p.transfermarkt?.heightCm?`${p.transfermarkt.heightCm} cm`:'Sin dato'}</b></p></div></div></section><section class="card"><h2>Temporada ${esc(String(seasonLabel(p)))}</h2>${statTiles(p)}<h3>Últimas notas registradas</h3>${formChart(p)}<p class="small muted">Registros de la carrera. ${number(p.appearances)?`${number(p.minutes)} minutos jugados esta temporada.`:'Todavía no disputó partidos en esta temporada.'}</p></section><section class="card"><h2>${other?'Comparación de jugadores':'Situación del jugador'}</h2>${other?comparisonSummary(p,other):`${fact('Club',esc(currentClub(p)))}${fact('Valor en la carrera',compactCash(p.valor_mercado))}${fact('Contrato vigente',safeDate(contractEnd(p)))}${fact('Personalidad estimada',esc(personalityText(p)))}<p class="small muted">${own(p)?'Forma parte de tu plantel. Revisá su contrato, evolución y encaje antes de decidir sus minutos.':'Compará su nivel con tu plantel y solicitá un informe antes de negociar.'}</p>`}</section>${window.FM_SCOUT_NETWORK?FM_SCOUT_NETWORK.reportHTML(p):''}</div>`;
  }
  function comparisonSummary(p,other) {
    return `<div class="fp-comparison-names"><strong>${esc(p.nombre)}</strong><strong>${esc(other.nombre)}</strong></div>${[['Calidad',overall(p),overall(other)],['Potencial',potentialText(p),potentialText(other)],['Edad',p.edad,other.edad],['Goles',number(p.goals),number(other.goals)],['Minutos',number(p.minutes),number(other.minutes)]].map(([name,left,right])=>`<div class="fp-comparison-row"><b>${window.FM_DEPTH&&name==='Calidad'?FM_DEPTH.range(p):left}</b><span>${name}</span><b>${window.FM_DEPTH&&name==='Calidad'?FM_DEPTH.range(other):right}</b></div>`).join('')}<button class="fp-inline-button" data-player="${other.id}">Abrir ficha de ${esc(other.nombre)}</button>`;
  }
  function attributePage(p,other) {
    const current=attributes(p),compared=other?attributes(other):null;
    let groups=attributeGroups;
    if(p.posicion==='POR')groups=[['Arquería',[['reflejos','Reflejos'],['blocaje','Blocaje'],['uno_contra_uno','Uno contra uno'],['salidas','Salidas'],['mando_area','Mando del área'],['saque_mano','Saque de mano'],['pase','Pases'],['control','Primer toque'],['tecnica','Técnica']]],...attributeGroups.slice(1)];
    return `<div class="fp-attribute-notice">Atributos estimados · escala 1–20${other?` · comparación con ${esc(other.nombre)}`:''}</div><div class="fp-attributes-grid">${groups.map(([name,rows])=>`<section class="card"><h2>${name}</h2>${other?`<div class="fp-attribute-head"><span>Atributo</span><span>Jugador</span><span>Comparado</span></div>`:''}${rows.map(([key,label])=>{
      const val=score20(current[key]),compare=compared?score20(compared[key]):null;
      return `<div class="fp-attribute-row"><span>${label}</span><b class="${val>=15?'great':val>=11?'good':'ordinary'}">${observedRange(p,val,20)}</b>${compared?`<b class="${compare>val?'great':compare<val?'ordinary':'good'}">${observedRange(other,compare,20)}</b>`:''}</div>`;
    }).join('')}</section>`).join('')}</div><div class="card"><h2>Atributos que utiliza el motor</h2><div class="fp-core-grid">${core.map(key=>fact(labels[key],`${observedRange(p,skill(p,key))}<small> / 99</small>`)).join('')}</div><p class="small muted">Los atributos detallados se calculan desde estos seis valores y una variación estable por jugador. Son estimaciones del juego; no proceden de una base oficial de Football Manager.</p></div>`;
  }
  const statTiles = p => `<div class="fp-stat-tiles">${[['Partidos',p.appearances],['Goles',p.goals],['Asistencias',p.assists],['Minutos',p.minutes]].map(([name,value])=>`<div><strong>${number(value)}</strong><span>${name}</span></div>`).join('')}</div>`;
  function formChart(p) {
    const notes=(p.form||[]).filter(value=>Number.isFinite(value)).slice(-5);
    if(!notes.length)return `<p class="fp-empty">Las notas aparecerán después de sus partidos.</p>`;
    return `<div class="fp-form-chart" aria-label="Últimas notas: ${notes.join(', ')}">${notes.map((value,index)=>`<div><span class="fp-form-bar ${value>=7?'high':value<6?'low':''}" style="height:${Math.max(8,value/10*75)}px"><b>${value.toFixed(1)}</b></span><small>${index+1}</small></div>`).join('')}</div>`;
  }
  function progressValue(record,key) {
    return key==='potential'?number(record.potentialEstimate):core.includes(key)?number(record.core?.[core.indexOf(key)]):number(record[key]);
  }
  function progressChart(records,key) {
    const width=640,height=210,padding=35,values=records.map(record=>progressValue(record,key)),lowest=Math.min(...(key==='potential'?records.map(r=>r.potentialLow):values)),highest=Math.max(...(key==='potential'?records.map(r=>r.potentialHigh):values)),gap=key==='value'?Math.max(10000,(highest-lowest)*.15):Math.max(2,(highest-lowest)*.15),min=Math.max(0,lowest-gap),max=Math.max(min+1,highest+gap);
    const x=index=>padding+(records.length===1?(width-padding*2)/2:index*(width-padding*2)/(records.length-1));
    const y=value=>height-padding-((value-min)/(max-min))*(height-padding*2);
    const line=values.map((value,index)=>`${index?'L':'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
    const axis=value=>key==='value'?(value>=1e6?`${(value/1e6).toFixed(1)} M`:`${Math.round(value/1000)} mil`):Math.round(value);
    return `<svg class="fp-progress-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(labels[key])}: ${records.map((record,index)=>`${record.date}: ${key==='potential'?record.potentialLow+'–'+record.potentialHigh:values[index]}`).join('; ')}">${[0,.5,1].map(ratio=>{const value=min+(max-min)*ratio;return `<line x1="${padding}" y1="${y(value)}" x2="${width-padding}" y2="${y(value)}" class="fp-chart-grid"/><text x="3" y="${y(value)+4}" class="fp-chart-label">${axis(value)}</text>`}).join('')}${key==='potential'?`<path d="${records.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(r.potentialHigh).toFixed(1)}`).join(' ')} ${records.slice().reverse().map((r,j)=>`L${x(records.length-1-j).toFixed(1)},${y(r.potentialLow).toFixed(1)}`).join(' ')} Z" class="fp-chart-range"/>`:''}<path d="${line}" class="fp-chart-line"/>${values.map((value,index)=>`<circle cx="${x(index)}" cy="${y(value)}" r="4" class="fp-chart-dot"><title>${safeDate(records[index].date)} · ${key==='value'?compactCash(value):key==='potential'?records[index].potentialLow+'–'+records[index].potentialHigh:value}</title></circle>`).join('')}<text x="${padding}" y="${height-6}" class="fp-chart-label">${esc(records[0].date)}</text>${records.length>1?`<text x="${width-padding}" y="${height-6}" text-anchor="end" class="fp-chart-label">${esc(records.at(-1).date)}</text>`:''}</svg>`;
  }
  function progressPage(p) {
    const allRecords=ensureProgress()?.[p.id] || [];
    if(state.metric==='potential'&&!allRecords.some(r=>Number.isFinite(r.potentialEstimate)))state.metric='overall';
    const records=state.metric==='potential'?allRecords.filter(r=>Number.isFinite(r.potentialEstimate)&&Number.isFinite(r.potentialLow)&&Number.isFinite(r.potentialHigh)):allRecords;
    if(!records.length)return `<section class="card fp-empty-card"><h2>Evolución durante la carrera</h2><p>${own(p)?'El cuerpo técnico empezará a registrar su evolución desde este momento.':'El seguimiento mensual se registra para los jugadores de tu plantel.'}</p><p class="muted">No hay un historial observado para este jugador. Sus atributos actuales se pueden consultar en Atributos.</p></section>`;
    const first=progressValue(records[0],state.metric),last=progressValue(records.at(-1),state.metric),change=last-first;
    return `<section class="card"><div class="fp-section-heading"><div><h2>Evolución observada en tu carrera</h2><p class="small muted">${records.length} registro${records.length===1?'':'s'} mensual${records.length===1?'':'es'} · hasta 24 meses</p></div><label>Métrica<select id="fp-progress-metric">${['overall','potential',...core,'condition','moral','value'].map(key=>`<option value="${key}" ${state.metric===key?'selected':''}>${labels[key]}</option>`).join('')}</select></label></div>${progressChart(records,state.metric)}<div class="fp-progress-summary">${fact('Primer registro',state.metric==='potential'?records[0].potentialLow+'–'+records[0].potentialHigh:state.metric==='value'?compactCash(first):String(first))}${fact('Último registro',state.metric==='potential'?records.at(-1).potentialLow+'–'+records.at(-1).potentialHigh:state.metric==='value'?compactCash(last):String(last))}${fact(state.metric==='potential'?'Confianza última opinión':'Variación',state.metric==='potential'?`${records.at(-1).potentialConfidence}%`:`${change>0?'+':''}${state.metric==='value'?compactCash(change):change}`)}</div><p class="small muted">${records.length===1?'Hay una medición inicial. Se necesita otro mes para observar cambios.':'Cada punto corresponde al primer registro del mes, después de avanzar el tiempo.'} ${state.metric==='potential'?'La banda muestra el intervalo observado por el empleado, sin revelar el techo interno. Los cambios también pueden reflejar otra opinión o una nueva evaluación. ':''}Este gráfico contiene registros de la simulación, sin atribuirles un historial deportivo externo.</p></section><section class="card"><h2>Registro del cuerpo técnico</h2><div class="scroll"><table><thead><tr><th>Fecha</th><th>Calidad</th><th>Condición</th><th>Moral</th><th>Valor de carrera</th></tr></thead><tbody>${records.slice().reverse().map(record=>`<tr><td>${safeDate(record.date)}</td><td>${record.overall}</td><td>${record.condition}%</td><td>${record.moral}%</td><td>${compactCash(record.value)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function statisticsPage(p,other) {
    const minutes=number(p.minutes),goals=number(p.goals),assists=number(p.assists),cards=number(p.yellowSeason||p.seasonYellow),red=number(p.redSeason);
    return `<section class="card"><div class="fp-section-heading"><h2>Rendimiento en la temporada ${esc(String(seasonLabel(p)))}</h2><span class="badge">Estadísticas de la carrera</span></div>${statTiles(p)}<div class="fp-core-grid">${fact('Goles / 90 min',minutes?(goals*90/minutes).toFixed(2):'—')}${fact('Asistencias / 90 min',minutes?(assists*90/minutes).toFixed(2):'—')}${fact('Amarillas',String(cards))}${fact('Expulsiones',String(red))}${fact('Última nota registrada',p.lastRating?number(p.lastRating).toFixed(1):'—')}${fact('Forma actual',number(p.estado_forma).toFixed(1))}</div>${!number(p.appearances)?'<p class="fp-empty">Todavía no hay partidos registrados en esta temporada.</p>':''}</section><div class="fp-two-columns"><section class="card"><h2>Últimas notas registradas</h2>${formChart(p)}<p class="small muted">Notas guardadas por el motor de la carrera, en orden cronológico. Se conservan hasta cinco.</p></section>${other?`<section class="card"><h2>Comparación de temporada</h2>${comparisonSummary(p,other)}</section>`:`<section class="card"><h2>Lectura del rendimiento</h2><p>${minutes?`Disputó ${minutes} minutos en ${number(p.appearances)} partidos, con ${goals+assists} participaciones directas en goles.`:'Aún no hay minutos suficientes para evaluar su temporada.'}</p><p class="small muted">Las estadísticas se reinician al comenzar una nueva temporada. El gráfico de Evolución conserva los registros mensuales del plantel.</p></section>`}</div>`;
  }
  function playerActions(p) {
    const live=Boolean(GameState.match&&!GameState.match.done);
    const loan=GameState.world.ai?.contracts?.loans?.find(item=>item.id===p.loanId&&item.status==='active');
    return own(p)?`<button data-renew="${p.id}" ${live||loan?'disabled':''}>Renovar contrato</button><button data-sell="${p.id}" ${live||loan?'disabled':''}>${GameState.transferListed?.includes(p.id)?'Retirar de transferibles':'Poner a la venta'}</button>`:`<button data-shortlist="${p.id}">${GameState.scouting?.shortlist?.includes(p.id)?'Quitar seguimiento':'Seguir jugador'}</button><button data-scout="${p.id}">Pedir informe</button><button class="primary" data-buy="${p.id}" ${live||loan?'disabled':''}>Negociar fichaje</button>`;
  }
  function contractPage(p) {
    const listed=GameState.transferListed?.includes(p.id),loan=GameState.world.ai?.contracts?.loans?.find(item=>item.id===p.loanId&&item.status==='active');
    const deferred=GameState.world.ai?.contracts?.payments?.filter(item=>item.playerId===p.id&&item.status==='pending')||[];
    return `<div class="fp-two-columns"><section class="card"><h2>Contrato de la carrera</h2>${fact('Club actual',esc(currentClub(p)))}${fact('Vencimiento',safeDate(contractEnd(p)))}${fact('Salario semanal',compactCash(p.salario))}${p.contractWageEscalator?fact('Aumento anual pactado',`${number(p.contractWageEscalator.percent)}% · próximo ${safeDate(p.contractWageEscalator.nextDate)}`):''}${fact('Salario anual aproximado',compactCash(number(p.salario)*52))}${fact('Cláusula de rescisión',compactCash(p.clausula_rescision))}${fact('Valor en la carrera',compactCash(p.valor_mercado))}${p.sellOn?fact('Porcentaje de futura venta',`${number(p.sellOn.percent)}% para ${esc(club(p.sellOn.beneficiaryClub)?.nombre||'el club de origen')}`):''}<p class="small muted">Condiciones de la simulación. Los contratos publicados por la fuente se consultan por separado en Fuentes.</p></section><section class="card"><h2>Situación contractual</h2>${fact('Inscripción',p.registered===false?'Sin inscripción':'Inscripto')}${fact('Mercado',loan?'En préstamo':listed?'Declarado transferible':p.clubId?'Bajo contrato':'Agente libre')}${fact('Tiempo de contrato',`${contractDays(p)} días · hasta ${safeDate(contractEnd(p))}`)}${loan?`${fact('Dueño del pase',esc(club(loan.ownerClub)?.nombre||loan.ownerClub))}${fact('Regreso previsto',esc(safeDate(loan.endDate)))}${fact('Aporte salarial del prestatario',`${number(loan.wageShare)}%`)}<p class="fp-contract-notice">El pase pertenece al club de origen. La cesión conserva su fecha de regreso; el prestatario no puede venderlo ni renovar su contrato.</p>`:''}${deferred.length?fact('Cuotas de pase pendientes',`${deferred.length} · ${compactCash(deferred.reduce((sum,item)=>sum+number(item.amount),0))}`):''}<p>${own(p)?contractDays(p)<=365?'Su contrato vence pronto. Revisá las condiciones antes de que termine la temporada.':'Tiene contrato vigente. Evaluá su rendimiento y el presupuesto salarial antes de renovar.':'Las condiciones se negocian con el club vendedor y el jugador. El presupuesto, los cupos y el mercado determinan si puede incorporarse.'}</p><div class="fp-actions">${playerActions(p)}</div>${GameState.match&&!GameState.match.done?'<p class="small muted">Las operaciones de contrato y mercado se retoman al finalizar el partido.</p>':''}</section></div>`;
  }
  function healthPage(p) {
    if(!window.FM_MEDICINE)return '<section class="card"><h2>Estado físico</h2><p>No hay un parte médico disponible.</p></section>';
    if(!own(p))return `<section class="card"><h2>Revisión médica de incorporación</h2><p>${p.injury?'La carrera registra una lesión activa.':'No hay una lesión activa registrada públicamente en esta carrera.'} El seguimiento deportivo no da acceso al historial médico privado ni reemplaza el reconocimiento de incorporación.</p><p class="small muted">Los informes médicos completos, cargas y planes de rehabilitación están disponibles para tu plantel.</p></section>`;
    const r=FM_MEDICINE.report(p),injury=r.injury;
    return `<div class="fp-two-columns fp-medical"><section class="card"><h2>Condición y preparación</h2>${fact('Condición física',`${r.condition}%`)}${fact('Ritmo competitivo',`${r.sharpness}%`)}${fact('Fatiga acumulada',`${r.tissueFatigue}%`)}${fact('Riesgo de lesión',`${esc(r.risk.label)} · ${r.risk.score}/100`)}${fact('Límite recomendado',`${r.minuteLimit} minutos`)}${fact('Carga últimos 7 días',`${r.risk.minutes} minutos · ${r.risk.acute} UA`)}${fact('Viajes estimados (7 días)',`${Math.round(r.risk.travel).toLocaleString('es-AR')} km`)}${fact('Último partido',r.lastMatch?safeDate(r.lastMatch):'Sin registro')}<p class="small muted">La condición mide energía disponible; el ritmo representa preparación para competir. Descansar recupera energía, mientras los minutos progresivos ayudan a recuperar ritmo.</p></section><section class="card"><h2>Parte médico y rehabilitación</h2>${injury?`${fact('Diagnóstico simulado',esc(injury.label))}${fact('Fase de recuperación',esc(injury.stage))}${fact('Pronóstico de regreso',`${safeDate(injury.earliest)} a ${safeDate(injury.latest)}`)}${fact('Seguimiento',esc(r.rehab))}${fact('Recaída',injury.recurrence?'Sí · recuperación más prudente':'No registrada')}<div class="fp-medical-actions"><label>Plan de rehabilitación<select data-med-rehab="${p.id}" ${locked()?'disabled':''}>${['Normal','Especialista','Prudente'].map(plan=>`<option ${r.rehab===plan?'selected':''}>${plan}</option>`).join('')}</select></label></div>`:`${fact('Situación',r.risk.returning?'Alta médica · reintegración progresiva':'Apto para competir')}<p>${r.risk.returning?'El alta no equivale a estar listo para jugar un partido completo. El límite de minutos y el riesgo de recaída siguen vigentes.':'La carga, el descanso y la exposición a partidos modifican su riesgo individual.'}</p>`}${fact('Descanso individual',r.restUntil?safeDate(r.restUntil):'Sin descanso especial')}<label class="fp-rest-choice">Descanso<select data-fp-med-rest="${p.id}" ${locked()?'disabled':''}>${Array.from({length:8},(_,days)=>`<option value="${days}" ${days===(r.restUntil?Math.max(0,Math.ceil((Date.parse(r.restUntil)-Date.parse(GameState.today))/86400000)):0)?'selected':''}>${days?days+' día'+(days===1?'':'s'):'Sin descanso especial'}</option>`).join('')}</select></label><p class="small muted">Pronósticos, lesiones y distancias pertenecen a la simulación; no son antecedentes sanitarios reales del futbolista.</p></section><section class="card"><h2>Historial médico de la carrera</h2><div class="scroll"><table><thead><tr><th>Fecha</th><th>Diagnóstico</th><th>Duración inicial</th><th>Recaída</th></tr></thead><tbody>${r.history.map(row=>`<tr><td>${safeDate(row.date)}</td><td>${esc(FM_MEDICINE.types[row.type]?.label||row.type)}</td><td>${row.days} días</td><td>${row.recurrence?'Sí':'No'}</td></tr>`).join('')||'<tr><td colspan="4">Sin lesiones registradas en esta carrera.</td></tr>'}</tbody></table></div></section></div>`;
  }
  function sourcesPage(p) {
    return `<div class="fp-source-tab">${window.WORLD_UI.profileSource(p)}${window.FM_SCOUT_NETWORK?FM_SCOUT_NETWORK.sourceHTML(p):''}${p.transfermarkt?.contractEnd?`<section class="card"><h2>Contrato publicado de referencia</h2>${fact('Vencimiento registrado en la base',esc(safeDate(p.transfermarkt.contractEnd)))}<p class="small muted">Referencia de la fuente histórica. No reemplaza el contrato ni las negociaciones de esta carrera.</p></section>`:''}<section class="card"><h2>Datos de la simulación</h2><p>${p.realIdentity?'La identidad y la posición de referencia proceden de la base histórica indicada arriba.':p.synthetic?'Esta identidad corresponde a una reserva ficticia para completar una plantilla sin cobertura suficiente.':'Este jugador fue creado por las inferiores del simulador.'} Los atributos deportivos, potencial, personalidad, salario, contrato, cláusula y valor en USD se estiman para la carrera.</p><p>La escala detallada de atributos se deriva de los seis valores del motor y una variación estable por jugador. Las estrellas comparan su calidad con el plantel que dirigís. La recomendación de rol considera sus atributos y su posición de referencia.</p><p>Las estadísticas y la evolución mensual se registran durante esta partida. Las cifras de Transfermarkt conservan la fecha disponible y no se actualizan automáticamente.</p><p class="small muted">Retrato: monograma ilustrado propio. Afiliación de referencia: ${esc(p.transfermarkt?.sourceSeason || p.transfermarkt?.season || 'base histórica')}.</p></section></div>`;
  }
  function renderPage() {
    if(!active())return '';
    let p=player(state.id);if(!p){p=mine()[0];state.id=p?.id;}
    if(!p)return '<section class="card"><h2>Jugador no disponible</h2><button data-view="squad">Volver al plantel</button></section>';
    const other=state.compare?player(state.compare):null;
    const renderers={summary:()=>summary(p,other),attributes:()=>attributePage(p,other),progress:()=>window.FM_DEPTH&&FM_DEPTH.knowledge(p).level<100?'<div class="card"><h2>Seguimiento pendiente</h2><p>Completá la observación para evaluar la evolución de sus atributos. Las estadísticas de partidos siguen disponibles.</p></div>':progressPage(p),stats:()=>statisticsPage(p,other),contract:()=>contractPage(p),health:()=>healthPage(p),sources:()=>sourcesPage(p)};
    return `<div class="fp-workspace"><div class="fp-back-row"><button data-fp-back>← ${state.back==='match'?'Volver al partido':'Volver'}</button>${GameState.match&&!GameState.match.done?'<span class="badge">Partido pausado</span>':''}</div><header class="fp-header"><div class="fp-monogram" aria-label="Monograma de ${esc(p.nombre)}">${esc(initial(p))}</div><div class="fp-identity"><div class="fm-kicker">${esc(currentClub(p))}</div><h2>${esc(p.nombre)}</h2><p>${p.edad} años · ${esc(p.nacionalidad)} · ${esc(naturalPositions(p).map(code=>positionNames[code]).join(' / '))}</p><div class="fp-header-status"><span class="fp-status ${p.injury||p.ban?'unavailable':''}">${esc(availability(p))}</span><span class="small">${own(p)?'Tu plantel':'Jugador observado'}${p.realIdentity?'':' · Identidad simulada'}</span></div></div><div class="fp-header-rating"><label>Calidad en tu plantel</label>${stars(p)}<strong>${window.FM_DEPTH?FM_DEPTH.range(p):overall(p)}<small> / 99</small></strong></div></header><nav class="fp-tabs" aria-label="Secciones de la ficha">${tabs.map(([id,label])=>`<button data-fp-tab="${id}" class="${state.tab===id?'selected':''}" aria-current="${state.tab===id?'page':'false'}">${label}</button>`).join('')}</nav>${['summary','attributes','stats'].includes(state.tab)?comparePicker(p):''}<div class="fp-tab-content">${(renderers[state.tab]||renderers.summary)()}</div></div>`;
  }
  document.addEventListener('click',event=>{
    if(!active())return;
    const tab=event.target.closest('[data-fp-tab]');if(tab){state.tab=tab.dataset.fpTab;render();return;}
    if(event.target.closest('[data-fp-back]')){view=state.back==='player'?'squad':state.back;render();}
  });
  document.addEventListener('change',event=>{
    if(!active())return;
    if(event.target.id==='fp-compare-player'){state.compare=event.target.value?Number(event.target.value):null;render();}
    if(event.target.id==='fp-progress-metric'){state.metric=event.target.value;render();}
    if(event.target.hasAttribute('data-fp-med-rest'))window.FM_MEDICINE?.setRest(Number(event.target.dataset.fpMedRest),Number(event.target.value));
  });
  document.addEventListener('input',event=>{
    if(!active()||event.target.id!=='fp-compare-query')return;
    state.compareQuery=event.target.value;const start=event.target.selectionStart;render();const replacement=$('#fp-compare-query');replacement?.focus({preventScroll:true});if(replacement&&Number.isFinite(start))replacement.setSelectionRange(start,start);
  });
  window.FM_PLAYER={open,renderPage,attributes,naturalPositions,roleFit,relativeStars,captureProgress,ensure:ensureProgress,state};
})();
