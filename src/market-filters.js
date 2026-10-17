/* Search decisions use the manager's observations, never hidden potential. */
window.FM_MARKET_FILTERS = (() => {
  const VERSION = 2, DAY = 86400000;
  const positions = {POR:'Arquero',DFC:'Central',LI:'Lateral izquierdo',LD:'Lateral derecho',MCD:'Mediocentro defensivo',MC:'Mediocampista central',MP:'Mediapunta',EI:'Extremo izquierdo',ED:'Extremo derecho',DC:'Delantero centro'};
  const core = {ritmo:'Ritmo',tiro:'Remate',pase:'Pase',regate:'Regate',defensa:'Defensa',fisico:'Físico'};
  const attributes={pase:'Pases',control:'Primer toque',regate:'Regate',tecnica:'Técnica',remate:'Remate',cabeceo:'Cabeceo',centros:'Centros',entradas:'Entradas',marcaje:'Marcaje',tiros_lejanos:'Tiros lejanos',balon_parado:'Balón parado',penales:'Penales',anticipacion:'Anticipación',decisiones:'Decisiones',concentracion:'Concentración',colocacion:'Colocación',vision:'Visión',desmarques:'Desmarques',trabajo_equipo:'Trabajo en equipo',determinacion:'Determinación',valentia:'Valentía',serenidad:'Serenidad',aceleracion:'Aceleración',velocidad:'Velocidad',agilidad:'Agilidad',equilibrio:'Equilibrio',resistencia:'Resistencia',fuerza:'Fuerza',salto:'Salto',recuperacion:'Recuperación',reflejos:'Reflejos',blocaje:'Blocaje',uno_contra_uno:'Uno contra uno',salidas:'Salidas',mando_area:'Mando del área',saque_mano:'Saque de mano'};
  const tabs = [['identity','Identidad y lugar'],['contract','Contrato y costo'],['football','Perfil deportivo'],['condition','Estado y rendimiento'],['scouting','Seguimiento']];
  const ranges = {
    age:[0,60],value:[0,1e10],wage:[0,1e8],clause:[0,1e11],height:[0,250],
    quality:[1,99],potential:[1,99],condition:[0,100],moral:[0,100],
    appearances:[0,1000],minutes:[0,100000],goals:[0,1000],assists:[0,1000],
    coverage:[0,100],confidence:[0,100],form:[0,10],
    ...Object.fromEntries(Object.keys(core).map(k=>[k,[1,99]]))
  };
  const defaults = () => ({version:VERSION,position:'ALL',group:'ALL',nationality:'ALL',country:'all',league:'all',club:'all',foot:'all',foreign:'all',identity:'all',status:'all',loan:'all',health:'all',contractMonths:'all',shortlist:false,withinBudget:false,observation:'all',rules:[],...Object.fromEntries(Object.keys(ranges).flatMap(k=>[[k+'Min',''],[k+'Max','']]))});
  let scope = 'market', draft = null, dialog = null, returnFocus = null, activeTab = 'identity';
  let contextState = null, contextDay = '', contextClub = '', clubIndex = new Map(), initialized = new Set(), snapshots = new WeakMap(),preparedBudget=null;
  const active = () => !!GameState?.worldVersion;
  const norm = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const num = n => Number.isFinite(Number(n)) ? Number(n) : 0;
  const selected = (a,b) => String(a)===String(b) ? 'selected' : '';

  function refreshContext() {
    if (contextState!==GameState||contextClub!==GameState.userClub.id) {
      contextState=GameState;contextClub=GameState.userClub.id;initialized=new Set();clubIndex=new Map((GameState.world.clubs||[]).map(c=>[c.id,c]));snapshots=new WeakMap();contextDay=GameState.today;preparedBudget=null;
    } else if(contextDay!==GameState.today) {contextDay=GameState.today;snapshots=new WeakMap();preparedBudget=null;}
  }
  function normalize(source={}) {
    const f={...defaults()};
    for(const key of Object.keys(f))if(source[key]!==undefined)f[key]=source[key];
    f.version=VERSION;
    for(const [key,[lo,hi]] of Object.entries(ranges))for(const edge of ['Min','Max']){
      const value=source[key+edge];f[key+edge]=value==null||value===''?'':Math.min(hi,Math.max(lo,num(value)));
    }
    for(const key of ['shortlist','withinBudget'])f[key]=source[key]===true;
    f.rules=Array.isArray(source.rules)?source.rules.filter(r=>r&&Object.hasOwn(attributes,r.attribute)).slice(0,36).map(r=>({attribute:r.attribute,min:r.min==null||r.min===''?'':Math.max(1,Math.min(20,num(r.min))),max:r.max==null||r.max===''?'':Math.max(1,Math.min(20,num(r.max)))})):[];
    for(const key of ['position','group','nationality','country','league','club','foot','foreign','identity','status','loan','health','contractMonths','observation'])f[key]=String(f[key]);
    return f;
  }
  function get(which='market') {
    if(!active())return defaults();refreshContext();
    if(initialized.has(which))return FM_OFFICE.filters[which];
    const office=FM_OFFICE.ensure(),f=FM_OFFICE.filters[which];
    if(!initialized.has(which)){
      const old={...(office.filters[which]||f)};
      if(old.version!==VERSION){
        if(which==='market'){
          const ui=window.WORLD_UI?.state||{},prefs=GameState.world.depth?.preferences||{},saved=prefs.worldFilters||{};
          old.group=prefs.marketPos||'ALL';old.country=ui.marketCountry||saved.marketCountry||'all';old.league=ui.marketLeague||saved.marketLeague||'all';old.club=ui.marketClub||saved.marketClub||'all';
          const age=ui.marketAge||saved.marketAge;if(age&&age!=='all')old.ageMax=num(age);
          old.withinBudget=!!(ui.marketBudget||saved.marketBudget);
        }else{
          const previous=GameState.world.depth?.preferences?.scouting||{};
          old.group=previous.position||'ALL';if(previous.age&&previous.age!==40)old.ageMax=previous.age;
        }
      }
      Object.keys(f).forEach(k=>delete f[k]);Object.assign(f,normalize(old));office.filters[which]=structuredClone(f);initialized.add(which);
    }
    return f;
  }
  function prepare(which='market') {
    const f=get(which);preparedBudget=f.withinBudget?(window.FM_FINANCES?.available?FM_FINANCES.available(GameState.userClub.id):GameState.userClub.presupuesto_dolares):null;
    return f;
  }
  function within(value,f,key) {
    const lo=f[key+'Min'],hi=f[key+'Max'];
    if(lo===''&&hi==='')return true;
    if(value==null||!Number.isFinite(Number(value)))return false;
    return (lo===''||Number(value)>=Number(lo))&&(hi===''||Number(value)<=Number(hi));
  }
  function snapshot(p) {
    const d=GameState.world.scoutNetwork?.players?.[p.id]?.[GameState.userClub.id],r=GameState.world.depth?.reports?.[p.id],legacy=GameState.scouting?.reports?.[p.id];
    const token=[d?.observations?.length||0,d?.preferredStaffId||'',r?.updated||'',r?.level||0,legacy?.date||'',p.clubId,p.valor_mercado].join(':');
    const old=snapshots.get(p);if(old?.token===token)return old.value;
    const value=window.FM_SCOUT_NETWORK?.filterSnapshot?FM_SCOUT_NETWORK.filterSnapshot(p):{quality:overall(p),potential:null,attributes:p,coverage:15,confidence:0};
    snapshots.set(p,{token,value});return value;
  }
  function matches(p,which='market') {
    if(!p||!active())return false;
    const f=typeof which==='string'?get(which):normalize(which),team=clubIndex.get(p.clubId);
    if(f.group!=='ALL'&&p.posicion!==f.group||f.position!=='ALL'&&!FM_PLAYER.naturalPositions(p).includes(f.position))return false;
    const nations=p.nationalities?.length?p.nationalities:p.transfermarkt?.nationalities?.length?p.transfermarkt.nationalities:[p.nacionalidad];
    if(f.nationality!=='ALL'&&!nations.includes(f.nationality)||f.country!=='all'&&team?.country!==f.country||f.league!=='all'&&team?.leagueId!==f.league)return false;
    if(f.club==='free'&&p.clubId||!['all','free'].includes(f.club)&&p.clubId!==f.club)return false;
    if(f.status==='free'&&p.clubId||f.status==='contracted'&&!p.clubId)return false;
    if(f.loan==='notLoaned'&&p.loanId||f.loan==='loaned'&&!p.loanId)return false;
    if(f.identity==='real'&&!p.realIdentity||f.identity==='simulated'&&p.realIdentity)return false;
    if(f.foreign!=='all'&&WORLD_ENGINE.isForeign(p,GameState.userClub.id)!==(f.foreign==='foreign'))return false;
    const foot=norm(p.transfermarkt?.foot||p.foot);
    if(f.foot==='right'&&!/derech|right/.test(foot)||f.foot==='left'&&!/izquier|left/.test(foot)||f.foot==='both'&&!/ambid|both|dos pies/.test(foot)||f.foot==='unknown'&&foot)return false;
    if(f.health==='fit'&&p.injury>0||f.health==='injured'&&!(p.injury>0))return false;
    if(f.shortlist&&!GameState.scouting?.shortlist?.includes(p.id))return false;
    if(f.withinBudget&&(typeof transferCost==='function'?transferCost(p):p.valor_mercado)>(preparedBudget??(window.FM_FINANCES?.available?FM_FINANCES.available(GameState.userClub.id):GameState.userClub.presupuesto_dolares)))return false;
    if(f.contractMonths!=='all'){
      if(!p.clubId)return false;
      const end=window.MARKET_CONTRACTS?.contractEnd(p)||`${p.contract}-12-31`,days=Math.ceil((Date.parse(end)-Date.parse(GameState.today))/DAY);
      if(!Number.isFinite(days)||days>Number(f.contractMonths)*30.5)return false;
    }
    const factual={age:p.edad,value:p.valor_mercado,wage:p.salario,clause:p.clausula_rescision,height:p.transfermarkt?.heightCm||p.heightCm,condition:p.condicion_fisica,moral:p.moral,appearances:p.appearances||0,minutes:p.minutes||0,goals:p.goals||0,assists:p.assists||0,form:p.form?.length?p.form.reduce((n,x)=>n+Number(x),0)/p.form.length:null};
    for(const [key,value]of Object.entries(factual))if(!within(value,f,key))return false;
    const observed=['quality','potential','coverage','confidence',...Object.keys(core)];
    if(f.observation!=='all'||f.rules.length||observed.some(k=>f[k+'Min']!==''||f[k+'Max']!=='')){
      const r=GameState.world.depth?.reports?.[p.id];
      if(f.observation==='active'&&r?.status!=='active'||f.observation==='complete'&&!(r?.completed||!r&&GameState.scouting?.reports?.[p.id])||f.observation==='none'&&(r||GameState.scouting?.reports?.[p.id]))return false;
      const estimate=snapshot(p);
      for(const key of observed){const value=Object.hasOwn(core,key)?estimate.attributes?.[key]:estimate[key];if(!within(value,f,key))return false;}
      if(f.rules.length){
        estimate.details??=FM_PLAYER.attributes({...p,...estimate.attributes},{observed:false});
        for(const rule of f.rules){const score=Math.max(1,Math.min(20,Math.round(estimate.details[rule.attribute]/5)));if(rule.min!==''&&score<Number(rule.min)||rule.max!==''&&score>Number(rule.max))return false;}
      }
    }
    return true;
  }
  function count(f) {const base=defaults();return Object.keys(base).filter(k=>!['version','rules'].includes(k)&&f[k]!==base[k]).length+f.rules.filter(r=>r.min!==''||r.max!=='').length;}
  function toolbar(which='market') {
    const f=get(which),n=count(f),parts=[];
    if(f.position!=='ALL')parts.push(positions[f.position]||f.position);
    if(f.nationality!=='ALL')parts.push(f.nationality);
    if(f.ageMin!==''||f.ageMax!=='')parts.push(`${f.ageMin||'0'}–${f.ageMax||'60'} años`);
    if(f.country!=='all')parts.push(f.country);
    if(f.status==='free'||f.club==='free')parts.push('Agentes libres');
    if(n>parts.length)parts.push(`+${n-parts.length} condiciones`);
    return `<button type="button" class="mf-open ${n?'mf-active':''}" data-market-filters-open="${which}" aria-haspopup="dialog">${window.FMUI?.icon('filter')||'⚙'} Filtros${n?` <span>${n}</span>`:''}</button><span class="mf-summary" title="${esc(parts.join(' · '))}">${esc(parts.join(' · ')||'Sin restricciones')}</span>${n?`<button type="button" class="mf-clear" data-market-filters-clear="${which}" aria-label="Quitar todos los filtros">Limpiar</button>`:''}${which==='scouting'?FM_OFFICE.scoutSelectorHTML():''}`;
  }
  function select(key,label,options) {return `<label class="mf-field">${label}<select data-mf-key="${key}">${options.map(([value,text])=>`<option value="${esc(String(value))}" ${selected(draft[key],value)}>${esc(text)}</option>`).join('')}</select></label>`;}
  function range(key,label,step=1) {const [min,max]=ranges[key];return `<fieldset class="mf-range"><legend>${label}</legend><label><span>Desde</span><input type="number" data-mf-key="${key}Min" min="${min}" max="${max}" step="${step}" value="${draft[key+'Min']}" placeholder="Sin mínimo"></label><label><span>Hasta</span><input type="number" data-mf-key="${key}Max" min="${min}" max="${max}" step="${step}" value="${draft[key+'Max']}" placeholder="Sin máximo"></label></fieldset>`;}
  function checkbox(key,label) {return `<label class="mf-check"><input type="checkbox" data-mf-key="${key}" ${draft[key]?'checked':''}> ${label}</label>`;}
  function attributeRules(){return `<section class="mf-attribute-rules"><div><h3>Atributos específicos · 1–20</h3><button type="button" data-mf-add-rule ${draft.rules.length>=36?'disabled':''}>+ Añadir condición</button></div>${draft.rules.map((r,i)=>`<div class="mf-attribute-rule"><label>Atributo<select data-mf-rule="${i}" data-mf-rule-key="attribute">${Object.entries(attributes).map(([key,label])=>`<option value="${key}" ${selected(r.attribute,key)}>${label}</option>`).join('')}</select></label><label>Mínimo<input type="number" min="1" max="20" value="${r.min}" data-mf-rule="${i}" data-mf-rule-key="min" placeholder="1"></label><label>Máximo<input type="number" min="1" max="20" value="${r.max}" data-mf-rule="${i}" data-mf-rule-key="max" placeholder="20"></label><button type="button" data-mf-remove-rule="${i}" aria-label="Quitar condición ${i+1}">×</button></div>`).join('')||'<p>Sumá condiciones de técnica, mentalidad, físico o arquería.</p>'}</section>`;}
  function sections() {
    const worlds=GameState.world,sort=(a,b)=>a.localeCompare(b,'es');
    const nations=[...new Set(GameState.players.flatMap(p=>p.nationalities?.length?p.nationalities:[p.nacionalidad]).filter(Boolean))].sort(sort),countries=[...new Set(worlds.leagues.map(l=>l.country))].sort(sort);
    const leagues=worlds.leagues.filter(l=>draft.country==='all'||l.country===draft.country),teams=worlds.clubs.filter(c=>c.id!==GameState.userClub.id&&(draft.country==='all'||c.country===draft.country)&&(draft.league==='all'||c.leagueId===draft.league)).sort((a,b)=>sort(a.nombre,b.nombre));
    const all=(label)=>[['all',label]],group=[['ALL','Todas las líneas'],['POR','Arqueros'],['DEF','Defensores'],['MED','Mediocampistas'],['DEL','Delanteros']];
    return {
      identity:`${select('position','Puesto natural exacto',[['ALL','Cualquier puesto'],...Object.entries(positions).map(([k,v])=>[k,`${v} (${k})`])])}${select('group','Línea del equipo',group)}${select('nationality','Nacionalidad (incluye doble ciudadanía)',[['ALL','Todas las nacionalidades'],...nations.map(n=>[n,n])])}${range('age','Edad en años')}${select('country','País donde juega',[...all('Todos los países'),...countries.map(n=>[n,n])])}${select('league','Liga de origen',[...all('Todas las ligas'),...leagues.map(l=>[l.id,l.name])])}${select('club','Club de origen',[...all('Todos los clubes'),['free','Agentes libres'],...teams.map(c=>[c.id,c.nombre])])}${select('foreign','Cupo en mi liga',[...all('Cualquier inscripción'),['local','No ocupa cupo extranjero'],['foreign','Ocupa cupo extranjero']])}${select('identity','Identidad',[...all('Todos los jugadores'),['real','Identidades reales'],['simulated','Cantera y reservas simuladas']])}`,
      contract:`${select('status','Situación del pase',[...all('Cualquier situación'),['free','Agente libre'],['contracted','Bajo contrato']])}${select('loan','Cesión actual',[...all('Cualquier situación'),['notLoaned','Sin préstamo activo'],['loaned','Actualmente cedido']])}${select('contractMonths','Vencimiento del contrato',[...all('Cualquier vencimiento'),['6','Dentro de 6 meses'],['12','Dentro de 12 meses'],['24','Dentro de 24 meses']])}${range('value','Valor de mercado del juego · USD',1000)}${range('wage','Salario semanal · USD',100)}${range('clause','Cláusula de rescisión · USD',1000)}${checkbox('withinBudget','Precio estimado dentro del presupuesto disponible')}<p class="mf-note">Los importes y contratos corresponden a esta carrera. El precio final y la voluntad de negociar se acuerdan con el club y el jugador.</p>`,
      football:`${select('foot','Pie preferido',[...all('Cualquier pie'),['right','Derecho'],['left','Izquierdo'],['both','Ambidiestro'],['unknown','Sin dato publicado']])}${range('height','Altura publicada · cm')}${range('quality','Calidad estimada · 1–99')}${range('potential','Desarrollo estimado · 1–99')}${Object.entries(core).map(([k,label])=>range(k,`${label} estimado · 1–99`)).join('')}${attributeRules()}<p class="mf-note">La búsqueda usa la estimación central disponible de tu red de ojeo. El potencial oculto del jugador no se revela. Sin observaciones, los atributos parten de una impresión general.</p>`,
      condition:`${select('health','Estado médico',[...all('Cualquier estado'),['fit','Sin lesión activa'],['injured','Con lesión activa']])}${range('condition','Condición física · %')}${range('moral','Moral · %')}${range('form','Nota media de los últimos partidos · 0–10',0.1)}${range('appearances','Partidos de esta temporada')}${range('minutes','Minutos de esta temporada')}${range('goals','Goles de esta temporada')}${range('assists','Asistencias de esta temporada')}<p class="mf-note">Los registros corresponden a los partidos simulados en la carrera. Si no hay notas recientes, el jugador no cumple un filtro de nota media.</p>`,
      scouting:`${select('observation','Estado de la observación',[...all('Cualquier seguimiento'),['none','Sin encargo ni informe'],['active','Observación en curso'],['complete','Con informe completo']])}${range('coverage','Cobertura del informe · %')}${range('confidence','Confianza de la evaluación · %')}${checkbox('shortlist','Sólo jugadores de mi lista de seguimiento')}<p class="mf-note">En Red de ojeo, la búsqueda se aplica a tu lista de seguimiento. Los informes aportan estimaciones y pierden vigencia con el tiempo.</p>`
    };
  }
  function body() {
    const contents=sections();return `<header class="mf-header"><div><div class="fm-kicker">${scope==='market'?'Centro de fichajes':'Red de ojeo'}</div><h2 id="mf-title">Filtros de jugadores</h2><p>Combiná condiciones para encontrar el perfil que buscás.</p></div><button type="button" data-mf-close aria-label="Cerrar filtros">×</button></header><nav class="mf-tabs" aria-label="Grupos de filtros">${tabs.map(([key,label])=>`<button type="button" role="tab" aria-selected="${activeTab===key}" aria-controls="mf-panel-${key}" id="mf-tab-${key}" data-mf-tab="${key}" class="${activeTab===key?'selected':''}">${label}</button>`).join('')}</nav><form id="market-filter-form" novalidate><div class="mf-content">${tabs.map(([key])=>`<section id="mf-panel-${key}" role="tabpanel" aria-labelledby="mf-tab-${key}" class="mf-grid" ${activeTab===key?'':'hidden'}>${contents[key]}</section>`).join('')}</div><p class="mf-error" role="alert" hidden></p><footer class="mf-footer"><button type="button" data-mf-reset>Restablecer filtros</button><span class="small muted">Se aplican todas las condiciones juntas.</span><button type="button" data-mf-close>Cancelar</button><button type="submit" class="primary">Aplicar filtros</button></footer></form>`;
  }
  function open(which='market',button=null) {
    if(!active()||!['market','scouting'].includes(which))return;
    if(FM_OFFICE.running.active)FM_OFFICE.stop('Avance pausado para buscar jugadores');
    close(false);scope=which;draft=structuredClone(get(which));activeTab='identity';returnFocus=button||document.activeElement;
    dialog=document.createElement('dialog');dialog.id='market-filters-dialog';dialog.className='mf-dialog';dialog.setAttribute('aria-labelledby','mf-title');dialog.innerHTML=body();document.body.append(dialog);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
    dialog.showModal();dialog.querySelector('[data-mf-key="position"]')?.focus();
  }
  function close(restore=true) {if(dialog){dialog.close();dialog.remove();dialog=null;}draft=null;if(restore&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
  function persist(which,value) {
    const target=get(which);Object.keys(target).forEach(k=>delete target[k]);Object.assign(target,normalize(value));FM_OFFICE.ensure().filters[which]=structuredClone(target);
    if(which==='market'&&window.WORLD_UI)WORLD_UI.state.marketPage=0;
    snapshots=new WeakMap();WORLD_STORAGE.scheduleSave();
  }
  function validate() {
    for(const [key,[lo,hi]]of Object.entries(ranges)){
      for(const edge of ['Min','Max']){const value=draft[key+edge];if(value!==''&&(!Number.isFinite(Number(value))||Number(value)<lo||Number(value)>hi))return {key:key+edge,message:`El valor debe estar entre ${lo} y ${hi}.`};}
      if(draft[key+'Min']!==''&&draft[key+'Max']!==''&&Number(draft[key+'Min'])>Number(draft[key+'Max']))return {key:key+'Min',message:'El mínimo no puede ser mayor que el máximo.'};
    }
    for(const [i,r]of draft.rules.entries()){
      for(const edge of ['min','max'])if(r[edge]!==''&&(!Number.isFinite(Number(r[edge]))||Number(r[edge])<1||Number(r[edge])>20))return {rule:i,message:'Los atributos específicos admiten valores entre 1 y 20.'};
      if(r.min!==''&&r.max!==''&&Number(r.min)>Number(r.max))return {rule:i,message:'El mínimo del atributo no puede ser mayor que el máximo.'};
    }
    if(draft.status==='contracted'&&draft.club==='free')return {key:'status',message:'Agentes libres y bajo contrato son condiciones incompatibles.'};
    return null;
  }
  function showTab(key) {activeTab=key;dialog.querySelectorAll('[data-mf-tab]').forEach(b=>{const on=b.dataset.mfTab===key;b.classList.toggle('selected',on);b.setAttribute('aria-selected',String(on));});dialog.querySelectorAll('[role="tabpanel"]').forEach(p=>p.hidden=p.id!==`mf-panel-${key}`);}
  document.addEventListener('click',e=>{
    const opener=e.target.closest('[data-market-filters-open]');if(opener){open(opener.dataset.marketFiltersOpen,opener);return;}
    const clear=e.target.closest('[data-market-filters-clear]');if(clear){persist(clear.dataset.marketFiltersClear,defaults());render();return;}
    if(!dialog||!dialog.contains(e.target))return;
    if(e.target.closest('[data-mf-close]')){close();return;}
    const tab=e.target.closest('[data-mf-tab]');if(tab){showTab(tab.dataset.mfTab);return;}
    if(e.target.closest('[data-mf-add-rule]')){if(draft.rules.length<36)draft.rules.push({attribute:'pase',min:'',max:''});dialog.querySelector('.mf-attribute-rules').outerHTML=attributeRules();dialog.querySelector(`[data-mf-rule="${draft.rules.length-1}"]`)?.focus();return;}
    const remove=e.target.closest('[data-mf-remove-rule]');if(remove){draft.rules.splice(Number(remove.dataset.mfRemoveRule),1);dialog.querySelector('.mf-attribute-rules').outerHTML=attributeRules();return;}
    if(e.target.closest('[data-mf-reset]')){draft=defaults();dialog.innerHTML=body();}
  });
  function readInput(e) {
    const input=e.target;if(!dialog?.contains(input))return;
    if(input.dataset.mfRule!=null){const r=draft.rules[Number(input.dataset.mfRule)];if(r)r[input.dataset.mfRuleKey]=input.value;return;}
    if(!input.dataset.mfKey)return;
    draft[input.dataset.mfKey]=input.type==='checkbox'?input.checked:input.value;
    if(['country','league'].includes(input.dataset.mfKey)&&e.type==='change'){
      if(input.dataset.mfKey==='country')draft.league='all';draft.club='all';const focused=input.dataset.mfKey;dialog.innerHTML=body();dialog.querySelector(`[data-mf-key="${focused}"]`)?.focus();
    }
  }
  document.addEventListener('input',readInput);document.addEventListener('change',readInput);
  document.addEventListener('submit',e=>{
    if(e.target.id!=='market-filter-form')return;e.preventDefault();
    const error=validate();if(error){const input=error.rule!=null?dialog.querySelector(`[data-mf-rule="${error.rule}"]`):dialog.querySelector(`[data-mf-key="${error.key}"]`);showTab(input.closest('[role="tabpanel"]').id.replace('mf-panel-',''));const box=dialog.querySelector('.mf-error');box.hidden=false;box.textContent=error.message;input.focus();return;}
    const which=scope,value=structuredClone(draft);persist(which,value);close(false);render();document.querySelector(`[data-market-filters-open="${which}"]`)?.focus({preventScroll:true});
  });
  return {get,prepare,matches,toolbar,open,close,defaults};
})();
