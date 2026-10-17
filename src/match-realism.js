/* Visual reconstruction uses real shot records; it never rolls another result. */
(() => {
  const original=tick;
  function adaptAI(m){
    m.aiAdjustments??=[];const milestone=[75,60,45,35,20].find(n=>m.minute>=n);if(!milestone||m.aiAdjustments.includes(milestone)||m.done)return false;
    // Evaluate once at each checkpoint. A balanced match does not force a change.
    m.aiAdjustments.push(milestone);m.aiAdjustments=m.aiAdjustments.slice(-8);
    const side=1-m.userSide,margin=m.score[side]-m.score[m.userSide],t=m.aiTactics??={},s=m.simulation;
    const own=m.stats[side],rival=m.stats[m.userSide],metrics=s?.teamMetrics?.[side],other=s?.teamMetrics?.[m.userSide];
    const before={mentality:t.mentality,tempo:t.tempo,line:t.line,pressing:t.pressing,width:t.width};let reason='',evidence='';
    const shift=(key,delta)=>t[key]=clamp(Number(t[key]??50)+delta,20,85);
    const setPhase=(key,field,value)=>{t.phases??={};t.phases[key]??={};t.phases[key][field]=value};
    if(margin<0&&milestone>=60){t.mentality=milestone>=75?'Ofensiva':'Positiva';shift('line',10);shift('pressing',12);shift('tempo',8);setPhase('transition','onLoss','Contrapresión');reason='adelanta el bloque y busca recuperar cerca del área';evidence=`Pierde por ${Math.abs(margin)} gol${margin<-1?'es':''} a los ${m.minute} minutos`}
    else if(margin>0&&milestone>=60){t.mentality='Cauta';shift('line',-10);shift('pressing',-8);shift('tempo',-7);setPhase('transition','onWin','Contraatacar');setPhase('transition','onLoss','Reagrupar');reason='protege la ventaja y prepara la salida rápida';evidence=`Defiende una ventaja de ${margin} gol${margin>1?'es':''}`}
    else if(metrics&&m.minute>=20&&own.passes>=35&&own.completedPasses/own.passes<.72){shift('tempo',-6);setPhase('inPossession','buildUp','Directa');setPhase('transition','keeper','Largo');reason='salta la primera presión con una salida más directa';evidence=`Sólo ${Math.round(own.completedPasses/own.passes*100)}% de sus ${own.passes} pases encontraron destino`}
    else if(other&&other.crosses>=4&&other.completedCrosses>=2){shift('width',8);setPhase('outOfPossession','trap','Dentro');reason='cubre las bandas y orienta la circulación hacia el centro';evidence=`Tu equipo conectó ${other.completedCrosses} de ${other.crosses} centros`}
    else if(metrics&&metrics.counters>=3&&Number(GameState.tactics.line)>60){setPhase('transition','onWin','Contraatacar');setPhase('inPossession','buildUp','Directa');reason='busca con más frecuencia el espacio detrás de tu defensa';evidence=`Registró ${metrics.counters} transiciones y observó tu línea adelantada`}
    else if(other&&other.finalThirdEntries>=Math.max(7,(metrics?.finalThirdEntries||0)*1.6)&&Number(rival.xg||0)>Number(own.xg||0)+.25){shift('line',-7);setPhase('outOfPossession','block','Medio');setPhase('transition','onWin','Contraatacar');reason='reduce el espacio entre líneas y guarda una salida de contraataque';evidence=`Tu equipo suma ${other.finalThirdEntries} entradas al último tercio y ${Number(rival.xg||0).toFixed(2)} xG`}
    if(!reason)return false;
    const decision={minute:m.minute,side,reason,evidence,before,after:{mentality:t.mentality,tempo:t.tempo,line:t.line,pressing:t.pressing,width:t.width}};
    if(s){s.aiDecisions??=[];s.aiDecisions.push(decision);s.aiDecisions=s.aiDecisions.slice(-8)}
    log(`📋 El DT rival ${reason}. ${evidence}.`);return true;
  }
  tick=function(){
    const m=GameState?.match;if(!GameState?.worldVersion||!m||m.paused||m.done)return original();
    const length=m.chances?.length||0,start={...(m.ball||{x:50,y:50})};original();if(GameState.match!==m)return;
    const chances=(m.chances||[]).slice(length);m.keyPlays??=[];
    for(const chance of chances){
      window.FM_SIMULATION?.recordChance(m,chance);
      const attack=chance.side===m.userSide,actor=player(chance.playerId),keeper=m.lineups[1-chance.side].find(id=>player(id)?.posicion==='POR');
      m.keyPlays.push({minute:chance.minute,side:chance.side,playerId:chance.playerId,keeperId:keeper||null,type:chance.type,outcome:chance.outcome,xg:chance.xg,start:{x:clamp(start.x,4,96),y:clamp(start.y,4,96)},end:{x:50,y:attack?6:94},name:actor?.nombre||'',chainId:chance.chainId,sequencePoints:chance.sequencePoints,reason:chance.reason});
    }
    m.keyPlays=m.keyPlays.slice(-60);const changed=adaptAI(m);
    // The result engine saves before this wrapper attaches recorded plays and decisions.
    // Complete that same checkpoint, including the five-minute extra-time checkpoints.
    if(m.paused||m.done)saveGame(true);else if(m.minute%15===0||(m.extraTime&&m.minute%5===0))WORLD_STORAGE.scheduleSave();
    if((chances.length||changed)&&view==='match')render();
  };
  function decorate(){
    const m=GameState?.match,pitch=document.querySelector('#content .pitch');if(!m||!pitch||!GameState.worldVersion||pitch.dataset.mcManaged)return;
    const key=m.keyPlays?.at(-1);const mode=GameState.world.matchPresentation||'animated';
    const bar=document.createElement('div');bar.className='mr-caption';bar.innerHTML=`<span>${key?`${key.minute}′ · ${key.outcome==='gol'?'¡GOL!':key.outcome==='atajado'?'Atajada':key.outcome==='anulado'?'VAR · anulado':'Remate desviado'} · ${esc(key.name)} · xG ${Number(key.xg||0).toFixed(2)}`:'Representación de las jugadas del partido'}</span><button data-mr-mode="${mode==='animated'?'static':'animated'}">${mode==='animated'?'Animadas':'Estáticas'}</button>`;pitch.append(bar);if(!key)return;
    const point=p=>pitch.dataset.horizontal?{x:100-p.y,y:p.x}:p,start=point(key.start),end=point(key.end);
    const animated=mode==='animated'&&!m.paused&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&key.minute===m.minute;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('mr-play');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-label',`Última ocasión: ${key.name}, ${key.outcome}, minuto ${key.minute}`);
    svg.innerHTML=`<path d="M ${start.x} ${start.y} Q 50 50 ${end.x} ${end.y}" fill="none" stroke="#f4d46b" stroke-width=".65" stroke-dasharray="2 1"/><circle cx="${start.x}" cy="${start.y}" r="2.1" fill="#d9bbef" data-play-actor="${key.playerId}"/><circle cx="${end.x}" cy="${end.y}" r="1" fill="#fff">${animated?`<animate attributeName="cx" from="${start.x}" to="${end.x}" dur=".7s" fill="freeze"/><animate attributeName="cy" from="${start.y}" to="${end.y}" dur=".7s" fill="freeze"/>`:''}</circle>`;pitch.append(svg);
  }
  document.addEventListener('click',e=>{const actor=e.target.closest('[data-play-actor]');if(actor)return details(Number(actor.dataset.playActor));const button=e.target.closest('[data-mr-mode]');if(button){GameState.world.matchPresentation=button.dataset.mrMode;saveGame(true);render()}});
  window.FM_MATCH_REALISM={decorate,adaptAI};
})();
