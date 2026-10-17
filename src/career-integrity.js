/* Recoverable checkpoints and an evidence log; the primary local save stays authoritative. */
window.FM_INTEGRITY=(()=>{
  const DB='fm27-career-checkpoints',STORE='checkpoints',LIMIT=6;
  const ui={status:'idle',entries:[],notice:'',loaded:false};
  let connection=null,scheduled=null,lastAutomatic='',writing=false;
  const active=()=>GameState?.worldVersion===1;
  const ensure=()=>active()?(GameState.world.integrity??={version:1,journal:[],nextId:1}):null;
  function record(kind,title,detail='',metadata={}){
    const s=ensure();if(!s)return null;
    const entry={id:s.nextId++,date:GameState.today,clubId:GameState.userClub.id,kind:String(kind).slice(0,30),title:String(title).slice(0,180),detail:String(detail).slice(0,1400)};
    for(const key of ['playerId','offerId','fromClub','toClub','fee'])if(typeof metadata[key]==='string'||Number.isFinite(metadata[key]))entry[key]=metadata[key];
    const old=s.journal[0];if(old&&old.date===entry.date&&old.title===entry.title&&old.detail===entry.detail)return old;
    s.journal.unshift(entry);s.journal=s.journal.slice(0,120);return entry;
  }
  function open(){
    if(connection)return connection;
    connection=new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(Error('Este navegador no ofrece almacenamiento para copias locales. Exportá tu carrera a JSON.'));return}
      const request=indexedDB.open(DB,1);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:'id'});store.createIndex('createdAt','createdAt')}};
      request.onerror=()=>reject(request.error||Error('No se pudo abrir el archivo de copias locales'));
      request.onblocked=()=>reject(Error('Cerrá otra pestaña del juego para abrir las copias locales'));
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null};resolve(db)};
    }).catch(error=>{connection=null;throw error});return connection;
  }
  async function list(){
    try{const db=await open();const rows=await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readonly'),r=t.objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});ui.entries=rows.map(({raw,...meta})=>meta).sort((a,b)=>b.createdAt-a.createdAt);ui.loaded=true;return ui.entries}
    catch(error){ui.status='unavailable';ui.notice=error.message;return []}
  }
  async function checkpoint(reason='Copia manual',options={}){
    if(!active()||writing)return null;writing=true;
    const state=options.snapshot?.state||GameState,createdAt=Date.now(),label=String(reason).slice(0,100),id=createdAt+'-'+Math.random().toString(36).slice(2,9);
    try{
      const raw=options.snapshot?.raw||(options.primary?localStorage.getItem(KEY):WORLD_STORAGE.serialize(state));
      if(!raw)throw Error('Todavía no hay una carrera guardada');
      const meta={id,createdAt,clubId:state.userClub.id,clubName:state.userClub.nombre,manager:state.manager,date:state.today,year:state.year,reason:label};
      const db=await open();
      await new Promise((resolve,reject)=>{
        const t=db.transaction(STORE,'readwrite'),store=t.objectStore(STORE);store.put({...meta,raw});
        const request=store.index('createdAt').getAllKeys();request.onsuccess=()=>{for(const key of request.result.slice(0,Math.max(0,request.result.length-LIMIT)))store.delete(key)};
        t.oncomplete=resolve;t.onerror=()=>reject(t.error||Error('No se pudo guardar el punto de recuperación'));t.onabort=()=>reject(t.error||Error('La copia no pudo completarse'));
      });
      lastAutomatic=state.userClub.id+':'+state.today;ui.status='ready';ui.notice='Punto de recuperación guardado: '+label;await list();return meta;
    }catch(error){ui.status='unavailable';ui.notice=error.name==='QuotaExceededError'?'No hay espacio para otra copia local. Exportá la carrera a JSON.':error.message;return null}
    finally{writing=false}
  }
  function schedule(snapshot=null){
    const source=snapshot?.state||GameState;
    if(!active()||!window.indexedDB||lastAutomatic===source.userClub.id+':'+source.today)return;
    if(scheduled)clearTimeout(scheduled);
    scheduled=setTimeout(()=>{scheduled=null;checkpoint('Guardado del día',{primary:true,snapshot})},350);
  }
  async function restore(id,options={}){
    try{
      const db=await open(),row=await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readonly'),r=t.objectStore(STORE).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
      if(!row)throw Error('La copia seleccionada ya no está disponible');
      const payload=JSON.parse(row.raw);WORLD_STORAGE.decode(payload);
      if(window.FM_OFFICE?.running.active)FM_OFFICE.stop('Avance pausado para recuperar una carrera');
      if(!WORLD_STORAGE.importState(payload,{confirm:options.confirm!==false,render:false}))return false;
      record('recuperacion','Carrera recuperada',`${row.reason} · ${row.date}`);saveGame(true);view='career';render();ui.notice='Se recuperó la carrera del '+row.date;return true;
    }catch(error){ui.notice='No se pudo recuperar la carrera: '+error.message;return false}
  }
  function page(){const s=ensure();if(!s)return '';return `<div class="card integrity-panel"><h2>Guardados y recuperación</h2><p>El guardado principal sigue en este navegador. Se conservan hasta seis puntos de recuperación locales; exportá una copia para trasladar o proteger tu carrera fuera de este dispositivo.</p><div class="row"><button data-integrity-save class="primary">Crear punto de recuperación</button><button data-action="export">Exportar JSON</button><button data-integrity-refresh>Actualizar copias</button></div><p class="small" role="status">${esc(ui.notice||'Las copias automáticas se crean después de guardar, como máximo una por fecha de juego.')}</p><div class="scroll"><table><thead><tr><th>Fecha de carrera</th><th>Club / DT</th><th>Punto de recuperación</th><th>Acción</th></tr></thead><tbody>${ui.entries.map(r=>`<tr><td>${date(r.date)}</td><td>${esc(r.clubName)}<small>${esc(r.manager)}</small></td><td>${esc(r.reason)}<small>${esc(new Date(r.createdAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}))}</small></td><td><button data-integrity-restore="${esc(r.id)}">Restaurar esta copia</button></td></tr>`).join('')||'<tr><td colspan="4">No hay copias cargadas. Usá Actualizar copias para consultarlas.</td></tr>'}</tbody></table></div></div><div class="card integrity-panel"><h2>Historial de decisiones</h2><p>Registros de la carrera: decisiones, acuerdos y novedades, con su fecha y contexto. No representan hechos históricos reales.</p><div class="scroll"><table><thead><tr><th>Fecha</th><th>Área</th><th>Decisión / evidencia</th></tr></thead><tbody>${s.journal.map(r=>`<tr><td>${date(r.date)}</td><td>${esc(r.kind)}</td><td><strong>${esc(r.title)}</strong><p>${esc(r.detail)}</p></td></tr>`).join('')||'<tr><td colspan="3">Las próximas decisiones y novedades quedarán registradas aquí.</td></tr>'}</tbody></table></div></div>`}
  function onSaved(raw,source=GameState){schedule({raw,state:{manager:source.manager,today:source.today,year:source.year,userClub:{id:source.userClub.id,nombre:source.userClub.nombre}}})}
  const previousMessage=MANAGEMENT.addMessage;
  MANAGEMENT.addMessage=function(title,body,type,metadata={}){const result=previousMessage.apply(this,arguments);if(['mercado','contratos','directiva','ojeo'].includes(type))record(type,title,body,metadata);return result};
  document.addEventListener('click',async e=>{
    const save=e.target.closest('[data-integrity-save]'),refresh=e.target.closest('[data-integrity-refresh]'),restoreButton=e.target.closest('[data-integrity-restore]');if(!save&&!refresh&&!restoreButton)return;
    const b=save||refresh||restoreButton;b.disabled=true;
    try{if(save){await checkpoint();render()}else if(refresh){await list();render()}else{await restore(restoreButton.dataset.integrityRestore);render()}}finally{if(b.isConnected)b.disabled=false}
  });
  return {ensure,record,checkpoint,list,restore,page,ui,onSaved};
})();
