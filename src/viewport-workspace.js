/* Viewport-sized workspaces: navigation stays fixed; long records scroll locally. */
(() => {
  const original=render, ui={tabs:{},menu:false,competitionFormat:'realistic'};
  const active=()=>!GameState||GameState.worldVersion===1;
  const element=(tag,cls)=>{const e=document.createElement(tag);e.className=cls;return e};
  const title=(node,fallback)=>node.querySelector?.('h2,h3')?.textContent||fallback;
  function panels(host,groups,key,fixed=[]) {
    groups=groups.filter(g=>g.nodes?.length);if(!groups.length)return;
    const chosen=groups.some(g=>g.id===ui.tabs[key])?ui.tabs[key]:groups[0].id;ui.tabs[key]=chosen;
    const wrapper=element('section','ws-workspace'),nav=element('nav','ws-tabs'),body=element('div','ws-panels');
    nav.setAttribute('aria-label','Secciones de '+key);
    for(const item of groups){
      const button=element('button',item.id===chosen?'selected':'');button.type='button';button.textContent=item.label;button.dataset.wsTab=item.id;button.dataset.wsKey=key;button.setAttribute('aria-selected',String(item.id===chosen));nav.append(button);
      const panel=element('section','ws-panel '+(item.cls||''));panel.dataset.wsPane=item.id;panel.hidden=item.id!==chosen;
      for(const node of item.nodes)panel.append(node);body.append(panel);
    }
    for(const node of fixed.filter(Boolean))wrapper.append(node);wrapper.append(nav,body);host.replaceChildren(wrapper);
    for(const node of host.querySelectorAll('.scroll')){node.classList.add('ws-list');node.dataset.listRegion='table';const card=node.closest('.card');if(card)card.classList.add('ws-table-card')}
    return wrapper;
  }
  function cardGroups(host,key) {
    const nodes=[...host.children],intro=nodes.filter(n=>n.matches('.fm-page-intro,.fm-section-head,.fm-tabbar,.depth-controls')||['finances','scouting'].includes(key)&&n.matches('.grid.cols3'));
    let cards=nodes.filter(n=>!intro.includes(n));
    cards=cards.flatMap(n=>n.matches('.grid,.fm-dashboard-grid')?[...n.children].flatMap(c=>c.matches('.card')?[c]:[...c.children]):[n]);
    panels(host,cards.map((n,i)=>({id:String(i),label:title(n,`Panel ${i+1}`),nodes:[n],cls:n.querySelector('table')?'':'ws-reader'})),key,intro);
  }
  function welcome() {
    const root=document.querySelector('.world-welcome'),form=root?.querySelector('.fm-welcome-form');if(!form)return;
    root.classList.add('ws-welcome');
    const start=form.querySelector('[data-action="new"]'),importer=form.querySelector('[data-action="import"]'),footer=element('div','ws-welcome-footer');footer.append(start,importer);
    const source=[...form.children].filter(n=>n.matches('.world-source-summary,.fm-welcome-disclosure'));
    const controls=[...form.children].filter(n=>n.matches('.field,.world-career-selectors,.world-career-results,.fm-selected-club'));
    const format=element('label','field');format.innerHTML=`Formato de competiciones<select id="careerCompetitionFormat"><option value="realistic" ${ui.competitionFormat==='realistic'?'selected':''}>Formatos por país · zonas, fases y playoffs</option><option value="classic" ${ui.competitionFormat==='classic'?'selected':''}>Calendario anual clásico</option></select>`;controls.push(format);
    const head=element('div','ws-welcome-heading');head.innerHTML='<strong>FM<span class="gold">27</span></strong><span>Nueva carrera</span>';
    const dt=element('div','office-creation');dt.innerHTML=window.FM_OFFICE?.creationHTML()||'';
    panels(form,[{id:'career',label:'Carrera',nodes:controls,cls:'ws-career-fields'},{id:'manager',label:'Tu DT',nodes:[dt],cls:'ws-reader'},{id:'sources',label:'Datos y reglas',nodes:source,cls:'ws-reader'}],'welcome',[head]);form.append(footer);
  }
  function dashboard(content) {
    const intro=content.querySelector('.fm-page-intro'),metrics=content.querySelector('.fm-metrics'),daily=content.querySelector('.world-daily-agenda'),grid=content.querySelector('.fm-dashboard-grid');
    if(!grid)return;
    const cards=[...grid.querySelectorAll('.card')],fixtureCard=cards.find(n=>n.classList.contains('fm-fixture-card'));
    const summary=element('div','ws-dashboard-summary');if(metrics)summary.append(metrics);if(fixtureCard)summary.append(fixtureCard);
    panels(content,[{id:'summary',label:'Resumen',nodes:[summary]},{id:'activity',label:'Actividad',nodes:daily?[daily]:[]},...cards.filter(n=>n!==fixtureCard).map((n,i)=>({id:'card'+i,label:title(n,'Club'),nodes:[n],cls:'ws-reader'}))],'dashboard',[intro]);
    if(daily){daily.classList.add('ws-day');const reports=daily.querySelector('.world-daily-reports');if(reports)reports.classList.add('ws-list')}
  }
  function market(content) {
    const fixed=[...content.children].filter(n=>n.matches('.fm-page-intro,.fm-metrics'));
    const search=content.querySelector('.fm-table-card'),others=[...content.children].filter(n=>!fixed.includes(n)&&n!==search);
    panels(content,[{id:'search',label:'Buscar jugadores',nodes:search?[search]:[]},{id:'offers',label:'Ofertas y contratos',nodes:others,cls:'ws-reader'}],'market',fixed.filter(n=>!n.classList.contains('fm-metrics')));
    if(search){const filters=search.querySelector('.fm-filters');if(filters)filters.classList.add('ws-market-filters')}
  }
  function competitions(content) {
    const fixed=[...content.children].filter(n=>n.matches('.fm-page-intro,.fm-tabbar'));
    if(window.FM_REGULATIONS&&!FM_REGULATIONS.enabled()&&content.querySelector('#worldTableLeague')){const next=element('div','ws-format-switch');next.innerHTML=`<span>${GameState.world.nextRegulations?'Los nuevos reglamentos se aplicarán el próximo año.':'Tu temporada conserva su formato guardado.'}</span><button data-reg-next>${GameState.world.nextRegulations?'Mantener reglamentos actuales':'Activar formatos por país el próximo año'}</button>`;fixed.push(next)}
    if(window.FM_REGULATIONS?.enabled()&&content.querySelector('#worldTableLeague')&&FM_REGULATIONS.rules[content.querySelector('#worldTableLeague').value]){const body=element('div','ws-competition-formats');body.innerHTML=FM_REGULATIONS.render(content.querySelector('#worldTableLeague').value);const filters=content.querySelector('.fm-filters');if(filters)fixed.push(filters);content.replaceChildren(...fixed,body);return}
    if(window.FM_COMPETITIONS&&!window.FM_REGULATIONS&&!GameState.world.competitionFormatsVersion&&content.querySelector('#worldTableLeague')){
      const next=element('div','ws-format-switch');next.innerHTML=`<span>${GameState.world.nextCompetitionFormat==='realistic'?'El próximo año se jugará con zonas, playoffs y promedios.':'Tu carrera conserva su calendario actual.'}</span><button data-arg-next-format>${GameState.world.nextCompetitionFormat==='realistic'?'Conservar formato clásico':'Activar nuevo formato el próximo año'}</button>`;fixed.push(next);
    }
    if(window.FM_COMPETITIONS?.render&&GameState.world.competitionFormatsVersion&&content.querySelector('#worldTableLeague')&&['ARG1','ARG2'].includes(content.querySelector('#worldTableLeague').value)){
      const body=element('div','ws-competition-formats');body.innerHTML=FM_COMPETITIONS.render(content.querySelector('#worldTableLeague').value);
      const filters=content.querySelector('.fm-filters');if(filters)fixed.push(filters);content.replaceChildren(...fixed,body);return;
    }
    const groups=content.querySelector('.world-cup-groups'),bracket=content.querySelector('.world-bracket');
    if(groups){const header=content.querySelector('.world-cup-header');if(header)fixed.push(header);const cards=[...groups.children],parent=bracket?.closest('.card');panels(content,[...cards.map((n,i)=>({id:'group'+i,label:'Grupo '+String.fromCharCode(65+i),nodes:[n],cls:'ws-reader'})),{id:'bracket',label:'Cruces',nodes:parent?[parent]:[],cls:'ws-reader'}],'cups',fixed);return}
    const nodes=[...content.children].filter(n=>!fixed.includes(n));panels(content,nodes.map((n,i)=>({id:String(i),label:title(n,i?'Resultados':'Posiciones'),nodes:[n],cls:n.querySelector('table')?'':'ws-reader'})),'tables',fixed);
  }
  function tactics(content) {
    const intro=content.querySelector('.fm-page-intro'),pitch=content.querySelector('.tw-pitch-card'),team=content.querySelector('.tw-team-options'),inspector=content.querySelector('.tw-inspector'),plans=content.querySelector('.tw-plans'),roster=content.querySelector('.tw-reserves');if(!pitch)return;
    const bench=element('section','card ws-bench');const benchHead=pitch.querySelector('.tw-bench-title'),benchNodes=pitch.querySelector('.tw-bench');if(benchHead)bench.append(benchHead);if(benchNodes)bench.append(benchNodes);
    const groups=[{id:'pitch',label:'Cancha',nodes:[pitch]},{id:'bench',label:'Banco',nodes:[bench]},{id:'team',label:'Equipo',nodes:[team]},{id:'phases',label:'Fases',nodes:[content.querySelector('.tw-phases')].filter(Boolean)},{id:'set-pieces',label:'Pelota parada',nodes:[content.querySelector('.tw-set-pieces')].filter(Boolean)},{id:'player',label:'Jugador',nodes:[inspector]},{id:'plans',label:'Planes',nodes:[plans]},{id:'squad',label:'Plantel',nodes:[roster]}];
    panels(content,groups,'tactics',[intro]);
    if(team){const children=[...team.children],second=children.filter(n=>n.matches('.tw-familiarity,.tw-quota')||n.querySelector('[data-tw-team="captain"],[data-tw-team="penaltyTaker"]'));panels(team,[{id:'style',label:'Plan de juego',nodes:children.filter(n=>!second.includes(n))},{id:'leaders',label:'Referentes y familiaridad',nodes:second}],'team')}
    if(inspector){const alt=inspector.querySelector('.tw-alternatives'),fields=inspector.querySelector('.tw-individual-fields'),all=[...inspector.children];panels(inspector,[{id:'role',label:'Puesto y rol',nodes:all.filter(n=>n!==fields&&n!==alt&&!n.classList.contains('tw-individual-title'))},{id:'instructions',label:'Instrucciones',nodes:fields?[fields]:[]},{id:'alternatives',label:'Alternativas',nodes:alt?[alt]:[]}],'individual')}
  }
  function profile(content) {
    const page=content.querySelector('.fp-workspace'),body=page?.querySelector('.fp-tab-content');if(!body)return;
    const grid=body.querySelector('.fp-summary-grid,.fp-attributes-grid,.fp-two-columns,.fp-source-tab');
    if(grid){const sections=[...grid.children];panels(body,sections.map((n,i)=>({id:String(i),label:title(n,i?'Detalles':'Informe'),nodes:[n],cls:n.querySelector('table')?'':'ws-reader'})),'profile-'+FM_PLAYER.state.tab)}
    else body.classList.add('ws-reader');
  }
  function inbox(content) {
    const root=content.querySelector('.fm-inbox'),layout=root?.querySelector('.fm-inbox-layout'),reader=layout?.querySelector('.fm-inbox-reader');if(!reader)return;
    const buttons=reader.querySelector('.fm-inbox-actions'),footer=reader.querySelector('.fm-inbox-reader-footer'),text=element('div','ws-inbox-reading');
    for(const child of [...reader.children])if(child!==buttons&&child!==footer)text.append(child);reader.prepend(text);
    const list=layout.querySelector('.fm-inbox-list');list.dataset.listRegion='messages';
    if(innerWidth<=650)panels(layout,[{id:'messages',label:'Mensajes',nodes:[list]},{id:'reading',label:'Lectura y decisiones',nodes:[reader]}],'inbox-mobile');
  }
  function liveMatch(content) {
    if(content.querySelector('.mc-root'))return;
    if(!GameState.match){cardGroups(content,'prematch');return}
    const scoreboard=content.querySelector('.scoreboard')?.closest('.card')||content.querySelector('.card'),cards=[...content.querySelectorAll('.card')].filter(n=>n!==scoreboard&&!n.contains(scoreboard));
    const grid=content.querySelector('.fm-match-grid');if(!cards.length)return;if(window.FM_DEPTH){const reader=element('div','depth-match');reader.innerHTML=FM_DEPTH.analysisHTML();const card=reader.firstElementChild;content.append(card);cards.push(card)}
    const unique=cards.filter(n=>!cards.some(p=>p!==n&&p.contains(n)));
    panels(content,unique.map((n,i)=>({id:String(i),label:n.querySelector('.pitch')?'Cancha':n.querySelector('.feed')?'Relato':title(n,`Partido ${i+1}`),nodes:[n],cls:n.querySelector('.feed,table')?'':'ws-reader'})),'match',[scoreboard]);
    const feed=content.querySelector('.feed');if(feed)feed.classList.add('ws-list');
  }
  function menu(shell) {
    const aside=shell.querySelector('aside'),nav=aside?.querySelector('nav');if(!nav)return;
    if(window.FM_OFFICE){const b=element('button',view==='office'?'active':'');b.dataset.view='office';b.innerHTML='⚙ <span class="fm-nav-label">DT y empleados</span>';nav.append(b)}
    if(window.FM_DEPTH){const b=element('button',view==='career'?'active':'');b.dataset.view='career';b.innerHTML=`${FMUI.icon('trust')}<span class="fm-nav-label">Carrera y proyectos</span>`;nav.append(b)}
    if(window.FM_DRESSING_ROOM){const b=element('button',view==='dressing-room'?'active':'');b.dataset.view='dressing-room';b.innerHTML=`${FMUI.icon('users')}<span class="fm-nav-label">Vestuario</span>`;nav.append(b)}
    const button=element('button','ws-menu-toggle');button.dataset.wsMenu='toggle';button.setAttribute('aria-label','Abrir menú');button.innerHTML='☰';aside.prepend(button);
    const drawer=element('section','ws-menu');drawer.hidden=!ui.menu;drawer.innerHTML=`<div class="row between"><strong>${esc(GameState.userClub.nombre)}</strong><button data-ws-menu="close">Cerrar</button></div><nav>${nav.innerHTML}</nav><div class="row"><button data-action="save">Guardar</button><button data-action="export">Exportar</button><button data-action="import">Importar</button></div>`;shell.append(drawer);
  }
  function layout() {
    document.body.classList.toggle('fm-viewport',active());if(!active())return;
    if(!GameState)return welcome();
    const shell=document.querySelector('.shell'),content=document.querySelector('#content');if(!content)return;shell.dataset.workspaceView=view;
    const handlers={dashboard,market,tables:competitions,tactics,player:profile,inbox,match:liveMatch};
    if(view==='office'&&window.FM_OFFICE){content.innerHTML=FM_OFFICE.page();document.querySelector('.fm-topbar h1').textContent='DT y empleados';cardGroups(content,'office')}
    else if(view==='career'&&window.FM_DEPTH){content.innerHTML=FM_DEPTH.career()+(window.FM_INTEGRITY?.page()||'');document.querySelector('.fm-topbar h1').textContent='Carrera';cardGroups(content,'career')}
    else if(view==='dressing-room'&&window.FM_DRESSING_ROOM){content.innerHTML=FM_DRESSING_ROOM.render();document.querySelector('.fm-topbar h1').textContent='Vestuario'}
    else if(view==='training'&&window.FM_DEVELOPMENT){content.innerHTML=FM_DEVELOPMENT.page();cardGroups(content,'training')}
    else if(handlers[view])handlers[view](content);
    else if(['squad','training','scouting','finances'].includes(view))cardGroups(content,view);
    if(['career','dressing-room'].includes(view)){for(const button of shell.querySelectorAll('aside nav [data-view]'))button.classList.remove('active');const crumb=shell.querySelector('.fm-breadcrumb');if(crumb)crumb.textContent=GameState.userClub.nombre+' / '+(view==='career'?'Carrera':'Vestuario')}
    window.FM_DRESSING_ROOM?.ensure();menu(shell);window.FM_MATCH_REALISM?.decorate();window.FM_DEPTH?.decorate();window.FM_MATCH_CENTRE?.decorate();window.FM_OFFICE?.decorate();window.FM_DEVELOPMENT?.decorate();
  }
  render=function(){const requested=view;if(active()&&view==='match'&&!ui.menu&&!document.querySelector('.ws-menu:not([hidden])')&&window.FM_MATCH_CENTRE?.refresh())return;if(active()&&['dressing-room','career','office'].includes(view))view='squad';try{original()}finally{view=requested}layout()};
  document.addEventListener('click',e=>{if(e.target.closest('[data-view],[data-action]'))ui.menu=false;if(e.target.closest('[data-inbox-open]'))ui.tabs['inbox-mobile']='reading'},true);
  document.addEventListener('click',e=>{const tab=e.target.closest('[data-ws-tab]');if(tab){ui.tabs[tab.dataset.wsKey]=tab.dataset.wsTab;render();return}const b=e.target.closest('[data-ws-menu]');if(b){ui.menu=b.dataset.wsMenu==='toggle'?!ui.menu:false;render()}});
  document.addEventListener('change',e=>{if(e.target.id==='careerCompetitionFormat')ui.competitionFormat=e.target.value});
  window.FM_WORKSPACE={layout,ui,panels,redraw:()=>render()};
})();
