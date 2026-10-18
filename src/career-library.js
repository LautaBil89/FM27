/* Independent careers live in IndexedDB; KEY remains a compatibility cache for the active game. */
window.FM_CAREERS=(()=>{
  const DB='fm27-career-library',STORE='careers';
  let connection=null,pending=Promise.resolve(),initializing=null,busy=false;
  const deleted=new Set(),ui={entries:[],notice:'',error:false,loading:false};
  const identity=()=> 'career-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2));
  function ensureIdentity(state){
    if(!state)return null;
    if(typeof state.careerId!=='string'||!/^career-[a-zA-Z0-9-]{8,100}$/.test(state.careerId)){state.careerId=identity();state.careerMigrated=true;}
    if(typeof state.careerName!=='string'||!state.careerName.trim())state.careerName=`${state.manager} · ${state.userClub.nombre}`.slice(0,80);
    state.careerName=state.careerName.trim().slice(0,80);return state.careerId;
  }
  function openDB(){
    if(connection)return connection;
    connection=new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(Error('El navegador no permite abrir el archivo de carreras. La partida activa sigue conservada; podés exportarla a JSON.'));
      const request=indexedDB.open(DB,2);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});if(!db.objectStoreNames.contains('metadata')){const meta=db.createObjectStore('metadata',{keyPath:'id'}),r=request.transaction.objectStore(STORE).openCursor();r.onsuccess=()=>{const c=r.result;if(!c)return;const{raw,...row}=c.value;meta.put(row);c.continue();};}};
      request.onerror=()=>reject(request.error||Error('No se pudo abrir el archivo de carreras'));
      request.onblocked=()=>reject(Error('Cerrá las otras pestañas del juego para abrir el archivo de carreras'));
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
    }).catch(error=>{connection=null;throw error;});return connection;
  }
  async function transaction(mode,operation){
    const db=await openDB();return new Promise((resolve,reject)=>{
      const tx=db.transaction([STORE,'metadata'],mode),request=operation(tx.objectStore(STORE),tx.objectStore('metadata')); let result;
      if(request)request.onsuccess=()=>{result=request.result;};
      tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error('No se pudo acceder a la carrera'));tx.onabort=()=>reject(tx.error||Error('La operación de guardado fue cancelada'));
    });
  }
  function queue(operation){const job=pending.catch(()=>{}).then(operation);pending=job;job.catch(error=>{ui.notice=error.name==='QuotaExceededError'?'No hay espacio para guardar otra carrera. La anterior sigue conservada. Exportá una copia.':error.message;ui.error=true;});return job;}
  function metadata(raw,state){return {id:state.careerId,name:state.careerName,manager:state.manager,clubId:state.userClub.id,clubName:state.userClub.nombre,date:state.today,year:state.year,updatedAt:Date.now(),raw};}
  function onSaved(raw,source){
    if(!source?.careerId||deleted.has(source.careerId))return;
    const row=metadata(raw,source);
    queue(async()=>{if(deleted.has(row.id))return;await transaction('readwrite',(store,meta)=>{const{raw,...small}=row;meta.put(small);return store.put(row);});});
  }
  async function flush(){try{await pending;return true;}catch{return false;}}
  async function initialize(){
    if(initializing)return initializing;
    initializing=(async()=>{
      if(!GameState)return true;
      ensureIdentity(GameState);
      if(window.FM_CAREER_LOCKS&&!await FM_CAREER_LOCKS.acquire(GameState))throw Error(FM_CAREER_LOCKS.notice);
      // Migrate a single-slot save in place, then preserve it before any new career can start.
      if(!await WORLD_STORAGE.saveAsync(true))throw Error('No se pudo conservar la partida actual');
      if(!await flush())throw Error(ui.notice||'No se pudo archivar la partida actual');return true;
    })().catch(error=>{ui.notice=error.message;ui.error=true;return false;});return initializing;
  }
  function pause(){
    window.FM_OFFICE?.stop?.('Gestión de carreras');clearInterval(timer);timer=null;
    if(GameState?.match&&!GameState.match.done)GameState.match.paused=true;
  }
  function preserveCurrent(){if(!GameState)return true;ensureIdentity(GameState);return saveGame(true);}
  async function saveCurrent(){
    if(!GameState)return true;ensureIdentity(GameState);
    if(window.FM_CAREER_LOCKS&&!await FM_CAREER_LOCKS.acquire(GameState))throw Error(FM_CAREER_LOCKS.notice);
    if(!await WORLD_STORAGE.saveAsync(true))throw Error('No se pudo guardar la partida actual; no se cambió de carrera.');
    if(!await flush())throw Error(ui.notice||'No se pudo conservar la partida actual');ui.error=false;return true;
  }
  async function list(){
    await flush();const rows=await transaction('readonly',(store,meta)=>meta.getAll());
    ui.entries=rows.map(({raw,...meta})=>meta).sort((a,b)=>b.updatedAt-a.updatedAt);return ui.entries;
  }
  function resetSessionUI(){
    for(const node of document.querySelectorAll('dialog[open]'))if(node.id!=='careers-dialog')node.close();
    if(window.FM_WORKSPACE)FM_WORKSPACE.ui.menu=false;
    if(window.FM_INTEGRITY){FM_INTEGRITY.ui.entries=[];FM_INTEGRITY.ui.loaded=false;FM_INTEGRITY.ui.notice='';}
    // Different careers can share a fixture ID; never reuse another career's live-match shell.
    document.querySelector('#content')?.replaceChildren();
  }
  async function beginNew(){
    await initialize();pause();await saveCurrent();
    WORLD_STORAGE.cancelPending();window.FM_CAREER_LOCKS?.release(GameState?.careerId);resetSessionUI();GameState=null;window.GameState=null;view='dashboard';close();render();return true;
  }
  async function load(id){
    if(GameState?.careerId===id){close();return true;}
    await initialize();await flush();const row=await transaction('readonly',store=>store.get(id));
    if(!row)throw Error('La carrera seleccionada ya no está disponible');
    const candidate=WORLD_STORAGE.decode(JSON.parse(row.raw));candidate.careerId=row.id;candidate.careerName=row.name;
    pause();await saveCurrent();if(window.FM_CAREER_LOCKS&&!await FM_CAREER_LOCKS.acquire(candidate))throw Error(FM_CAREER_LOCKS.notice);const outgoing=GameState?.careerId;WORLD_STORAGE.importState(candidate,{confirm:false,render:false});if(outgoing&&outgoing!==candidate.careerId)window.FM_CAREER_LOCKS?.release(outgoing);
    resetSessionUI();close();render();toast('Carrera cargada: '+row.name);return true;
  }
  async function rename(id,name){
    name=String(name||'').trim().slice(0,80);if(!name)throw Error('Escribí un nombre para la carrera');
    await flush();const row=await transaction('readonly',store=>store.get(id));if(!row)throw Error('La carrera ya no está disponible');
    if(GameState?.careerId===id){GameState.careerName=name;await saveCurrent();}
    else{if(window.FM_CAREER_LOCKS&&!await FM_CAREER_LOCKS.acquire({careerId:id}))throw Error(FM_CAREER_LOCKS.notice);try{row.name=name;await queue(()=>transaction('readwrite',(store,meta)=>{const{raw,...small}=row;meta.put(small);return store.put(row);}));}finally{window.FM_CAREER_LOCKS?.release(id);}}
    ui.notice='Nombre de carrera actualizado';ui.error=false;return true;
  }
  async function remove(id,confirmDeletion=true){
    const row=await transaction('readonly',store=>store.get(id));if(!row)throw Error('La carrera ya no está disponible');
    if(window.FM_CAREER_LOCKS&&!await FM_CAREER_LOCKS.acquire({careerId:id}))throw Error(FM_CAREER_LOCKS.notice);
    if(confirmDeletion&&!confirm(`¿Eliminar «${row.name}»? Sólo se eliminará esta carrera; las demás se conservan.`)){if(GameState?.careerId!==id)window.FM_CAREER_LOCKS?.release(id);return false;}
    const active=GameState?.careerId===id;
    if(active){pause();WORLD_STORAGE.cancelPending();}
    deleted.add(id);
    try{await flush();await queue(()=>transaction('readwrite',(store,meta)=>{meta.delete(id);return store.delete(id);}));}
    catch(error){deleted.delete(id);throw error;}
    let recoveryWarning='';try{await window.FM_INTEGRITY?.removeCareer?.(id);}catch(error){recoveryWarning=' No se pudo acceder al archivo de puntos de recuperación: '+(error.message||'almacenamiento no disponible');}
    if(active){window.FM_CAREER_LOCKS?.release(id);localStorage.removeItem(KEY);resetSessionUI();GameState=null;window.GameState=null;view='dashboard';render();}
    else if(!GameState){try{const cached=localStorage.getItem(KEY);if(cached&&WORLD_STORAGE.decode(JSON.parse(cached)).careerId===id)localStorage.removeItem(KEY);}catch{}}
    if(!active)window.FM_CAREER_LOCKS?.release(id);ui.notice='Carrera eliminada. Las demás partidas se conservaron.'+recoveryWarning;ui.error=!!recoveryWarning;return true;
  }
  function download(row){
    const candidate=WORLD_STORAGE.decode(JSON.parse(row.raw));candidate.careerId=row.id;candidate.careerName=row.name;
    const blob=new Blob([WORLD_STORAGE.exportText(candidate)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`FM27-${row.name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ -]/g,'').slice(0,60)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  async function exportCareer(id){
    if(GameState?.careerId===id){ensureIdentity(GameState);download(metadata(WORLD_STORAGE.serialize(GameState),GameState));}
    else{await flush();const row=await transaction('readonly',store=>store.get(id));if(!row)throw Error('La carrera ya no está disponible');download(row);}
    ui.notice='Copia de carrera exportada';ui.error=false;
  }
  async function importCareer(raw){
    const candidate=WORLD_STORAGE.decode(raw);candidate.careerId=identity();candidate.careerName=(String(candidate.careerName||'').trim()||`${candidate.manager} · ${candidate.userClub.nombre}`).slice(0,80);delete candidate.careerMigrated;
    pause();await saveCurrent();const serialized=WORLD_STORAGE.serialize(candidate);
    await queue(()=>transaction('readwrite',(store,meta)=>{const row=metadata(serialized,candidate),{raw,...small}=row;meta.put(small);return store.put(row);}));
    if(window.FM_CAREER_LOCKS&&!await FM_CAREER_LOCKS.acquire(candidate))throw Error(FM_CAREER_LOCKS.notice);const outgoing=GameState?.careerId;WORLD_STORAGE.importState(candidate,{confirm:false,render:false});if(outgoing&&outgoing!==candidate.careerId)window.FM_CAREER_LOCKS?.release(outgoing);resetSessionUI();close();render();toast('Carrera importada. Tus otras partidas se conservaron.');return true;
  }
  async function forkCurrent(){if(!GameState)return false;const outgoing=GameState.careerId;if(!window.FM_CAREER_LOCKS?.blocked())await saveCurrent();const candidate=structuredClone(GameState);candidate.careerId=identity();delete candidate.careerMigrated;candidate.careerName=((candidate.careerName||candidate.manager)+' · copia').slice(0,80);if(window.FM_CAREER_LOCKS&&!await FM_CAREER_LOCKS.acquire(candidate))throw Error(FM_CAREER_LOCKS.notice);WORLD_STORAGE.importState(candidate,{confirm:false,render:false});window.FM_CAREER_LOCKS?.release(outgoing);await saveCurrent();resetSessionUI();render();return true;}
  function importFile(){
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.addEventListener('change',()=>run(async()=>{const file=input.files[0];if(!file)return;if(file.size>WORLD_STORAGE.maxImportBytes)throw Error('La copia supera el límite de 50 MB');await importCareer(JSON.parse(await file.text()));}));input.click();
  }
  function dialog(){let node=document.getElementById('careers-dialog');if(!node){node=document.createElement('dialog');node.id='careers-dialog';node.className='careers-dialog';node.setAttribute('aria-label','Mis carreras');document.body.append(node);}return node;}
  function paint(){
    const node=dialog(),current=GameState?.careerId;
    node.innerHTML=`<div class="careers-heading"><div><h2>Mis carreras</h2><p>Cada carrera tiene su propio autoguardado. Crear otra conserva las anteriores.</p></div><button data-careers-close aria-label="Cerrar mis carreras">✕</button></div><div class="careers-controls"><button class="primary" data-careers-new>Nueva carrera</button>${GameState?`<button data-careers-save>Guardar carrera actual</button><button data-careers-export="${esc(current)}">Exportar actual</button>`:''}<button data-careers-import>Importar carrera</button></div><p class="careers-notice ${ui.error?'red':''}" role="status">${esc(ui.loading?'Cargando carreras…':ui.notice||'Se guardan en este navegador. Exportá un JSON para trasladarlas a otro dispositivo.')}</p><div class="careers-list">${ui.entries.map(row=>`<article class="careers-item ${row.id===current?'is-current':''}"><div class="careers-item-title"><strong>${esc(row.name)}</strong>${row.id===current?'<span class="badge">ACTUAL</span>':''}</div><p>${esc(row.manager)} · ${esc(row.clubName)}</p><p class="small muted">${esc(row.date)} · Temporada ${row.year} · Guardada ${esc(new Date(row.updatedAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}))}</p><div class="careers-item-controls"><button class="primary" data-careers-load="${esc(row.id)}">${row.id===current?'Continuar':'Cargar'}</button><button data-careers-export="${esc(row.id)}">Exportar</button><button class="danger" data-careers-delete="${esc(row.id)}">Eliminar</button></div><form data-careers-rename="${esc(row.id)}" class="careers-rename"><input name="careerName" maxlength="80" value="${esc(row.name)}" aria-label="Nombre de ${esc(row.name)}" required><button type="submit">Renombrar</button></form></article>`).join('')||(!ui.loading?'<div class="empty">Todavía no hay carreras archivadas. Creá una o importá un archivo JSON.</div>':'')}</div>`;
    node.querySelectorAll('button').forEach(b=>{if(!b.hasAttribute('data-careers-close'))b.disabled=busy;});
  }
  function close(){document.getElementById('careers-dialog')?.close();}
  async function show(){pause();ui.loading=true;ui.error=false;paint();const node=dialog();if(!node.open)node.showModal();try{await initialize();if(GameState)await saveCurrent();await list();}catch(error){ui.notice=error.message;ui.error=true;}finally{ui.loading=false;paint();}}
  async function run(operation){
    if(busy)return false;busy=true;document.documentElement.classList.add('career-library-busy');if(document.getElementById('careers-dialog')?.open)paint();
    try{return await operation();}catch(error){ui.notice=error.message;ui.error=true;toast(error.message);return false;}
    finally{busy=false;document.documentElement.classList.remove('career-library-busy');if(document.getElementById('careers-dialog')?.open){try{await list();}catch{}paint();}}
  }
  function decorate(){
    const sidebar=document.querySelector('.fm-sidebar-bottom');if(sidebar&&!sidebar.querySelector('[data-careers-open]'))sidebar.insertAdjacentHTML('afterbegin','<button class="careers-open" data-careers-open>Mis carreras</button>');
    const footer=document.querySelector('.ws-welcome-footer')||document.querySelector('.fm-welcome-form');if(!GameState&&footer&&!footer.querySelector('[data-careers-open]'))footer.insertAdjacentHTML('afterbegin','<button class="careers-open" data-careers-open>Mis carreras guardadas</button>');
    const drawer=document.querySelector('.ws-menu');if(drawer&&!drawer.querySelector('[data-careers-open]'))drawer.insertAdjacentHTML('beforeend','<button data-careers-open>Mis carreras</button><button data-careers-new>Nueva carrera</button>');
  }
  const priorRender=render;render=function(){priorRender();decorate();window.FM_CAREER_LOCKS?.renderBanner();};
  const priorNew=actions.new;
  actions.new=()=>run(async()=>{if(window.FM_DATA_UPDATES)await FM_DATA_UPDATES.ready;await initialize();await saveCurrent();const result=priorNew();if(GameState){ensureIdentity(GameState);if(window.FM_CAREER_LOCKS)await FM_CAREER_LOCKS.acquire(GameState);WORLD_STORAGE.scheduleSave();}return result;});
  resetGame=()=>run(beginNew);window.resetGame=resetGame;actions.reset=resetGame;
  actions.save=()=>run(async()=>{await saveCurrent();toast('Carrera guardada');});actions.import=importFile;
  for(const type of ['click','submit','keydown'])document.addEventListener(type,event=>{
    if(!busy||event.target.closest?.('[data-careers-close]'))return;
    if(type==='keydown'&&![' ','Enter'].includes(event.key))return;
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-careers-open],[data-careers-close],[data-careers-new],[data-careers-save],[data-careers-import],[data-careers-load],[data-careers-export],[data-careers-delete]');if(!b||b.disabled)return;
    if(b.hasAttribute('data-careers-close'))return close();
    if(b.hasAttribute('data-careers-open'))return run(show);
    if(b.hasAttribute('data-careers-import'))return importFile();
    if(b.hasAttribute('data-careers-new'))return run(beginNew);
    if(b.hasAttribute('data-careers-save'))return run(async()=>{await saveCurrent();ui.notice='Carrera guardada';ui.error=false;});
    if(b.dataset.careersLoad)return run(()=>load(b.dataset.careersLoad));
    if(b.dataset.careersExport)return run(()=>exportCareer(b.dataset.careersExport));
    if(b.dataset.careersDelete)return run(()=>remove(b.dataset.careersDelete));
  });
  document.addEventListener('submit',event=>{const form=event.target.closest('[data-careers-rename]');if(!form)return;event.preventDefault();run(()=>rename(form.dataset.careersRename,new FormData(form).get('careerName')));});
  queueMicrotask(()=>{initialize();});
  return {forkCurrent,identity,ensureIdentity,onSaved,flush,initialize,preserveCurrent,saveCurrent,list,beginNew,load,rename,remove,exportCareer,importCareer,show,ui};
})();
