/* Visual reconstruction uses real shot records; it never rolls another result. */
(() => {
  const original=tick;
  function adaptAI(m){
    m.aiAdjustments??=[];const milestone=m.minute>=75?75:m.minute>=60?60:null;if(!milestone||m.aiAdjustments.includes(milestone)||m.done)return false;
    const side=1-m.userSide,margin=m.score[side]-m.score[m.userSide],t=m.aiTactics??={};
    if(margin<0){t.mentality='Ofensiva';t.pressing=milestone===75?85:70;t.tempo=75;t.line=65;t.style='Gegenpress'}
    else if(margin>0){t.mentality='Cauta';t.pressing=40;t.tempo=40;t.line=35;t.style='Salida de Contragolpe'}
    else {t.mentality='Equilibrada';t.pressing=55;t.tempo=60}
    m.aiAdjustments.push(milestone);log(`📋 El rival ${margin<0?'adelanta líneas para buscar el resultado':margin>0?'protege la ventaja y prepara el contragolpe':'ajusta el ritmo para el tramo final'}.`);return true;
  }
  tick=function(){
    const m=GameState?.match;if(!GameState?.worldVersion||!m||m.paused||m.done)return original();
    const length=m.chances?.length||0,start={...(m.ball||{x:50,y:50})};original();if(GameState.match!==m)return;
    const chances=(m.chances||[]).slice(length);m.keyPlays??=[];
    for(const chance of chances){
      const attack=chance.side===m.userSide,actor=player(chance.playerId),keeper=m.lineups[1-chance.side].find(id=>player(id)?.posicion==='POR');
      m.keyPlays.push({minute:chance.minute,side:chance.side,playerId:chance.playerId,keeperId:keeper||null,type:chance.type,outcome:chance.outcome,xg:chance.xg,start:{x:clamp(start.x,4,96),y:clamp(start.y,4,96)},end:{x:50,y:attack?6:94},name:actor?.nombre||''});
    }
    m.keyPlays=m.keyPlays.slice(-12);const changed=adaptAI(m);if((chances.length||changed)&&view==='match')render();
  };
  function decorate(){
    const m=GameState?.match,pitch=document.querySelector('#content .pitch');if(!m||!pitch||!GameState.worldVersion)return;
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
