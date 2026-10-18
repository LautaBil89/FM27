/* Exclusive editors use Web Locks where available, with a lease for older/file browsers. */
window.FM_CAREER_LOCKS=(()=>{
  const owner=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random(),prefix='fm27-editor:',held=new Map(),TTL=90000;
  const idOf=s=>s?.careerId,key=id=>prefix+id;
  let notice='',channel=null;
  function read(id){try{return JSON.parse(localStorage.getItem(key(id))||'null')}catch{return null}}
  function publish(id){const row={owner,until:Date.now()+TTL};localStorage.setItem(key(id),JSON.stringify(row));channel?.postMessage({id,owner});}
  function conflict(id){const h=held.get(id);if(h)h.blocked=true;notice='Esta carrera está abierta en otra pestaña. Cerrala allí o creá una copia independiente.';window.WORLD_STORAGE?.cancelPending();window.FM_OFFICE?.stop?.(notice);if(GameState?.match)GameState.match.paused=true;clearInterval(timer);timer=null;queueMicrotask(renderBanner);}
  function lease(id){const row=read(id);if(row&&row.owner!==owner&&row.until>Date.now())return false;publish(id);return read(id)?.owner===owner;}
  async function acquire(state){const id=idOf(state);if(!id)return true;const previous=held.get(id);if(previous)return previous.promise;const h={blocked:false,ready:false,release:null,promise:null};held.set(id,h);
    h.promise=(async()=>{if(!navigator.locks?.request){h.ready=lease(id);if(!h.ready)conflict(id);return h.ready}return new Promise(resolve=>{navigator.locks.request(key(id),{ifAvailable:true},async lock=>{if(!lock){conflict(id);resolve(false);return}h.ready=true;publish(id);resolve(true);await new Promise(done=>{h.release=done;});}).catch(()=>{h.ready=lease(id);if(!h.ready)conflict(id);resolve(h.ready);});});})();return h.promise;
  }
  function guard(state){const id=idOf(state);if(!id)return true;const h=held.get(id);if(!h){acquire(state);return false}const row=read(id);if(h.blocked||!h.ready||row&&row.owner!==owner&&row.until>Date.now()){if(h.ready)conflict(id);return false}publish(id);return true;}
  function release(id){const h=held.get(id);h?.release?.();held.delete(id);if(read(id)?.owner===owner)localStorage.removeItem(key(id));}
  function blocked(){const id=idOf(GameState);return !!held.get(id)?.blocked;}
  function renderBanner(){document.querySelector('[data-career-conflict]')?.remove();if(!blocked())return;const content=document.querySelector('#content');if(content)content.insertAdjacentHTML('afterbegin','<div class="fm-conflict" data-career-conflict role="alert">'+esc(notice)+' <button data-career-fork>Crear copia independiente</button></div>');}
  try{channel=new BroadcastChannel('fm27-editors');channel.onmessage=({data})=>{if(data.owner!==owner&&held.get(data.id)?.ready&&read(data.id)?.owner!==owner)conflict(data.id);};}catch{}
  addEventListener('storage',event=>{if(event.key===key(idOf(GameState))){const row=read(idOf(GameState));if(row&&row.owner!==owner&&row.until>Date.now()){conflict(idOf(GameState));renderBanner();}}});
  setInterval(()=>{for(const [id,h]of held)if(h.ready&&!h.blocked){const row=read(id);if(row?.owner!==owner&&row?.until>Date.now())conflict(id);else publish(id);}},10000);
  addEventListener('pagehide',()=>{window.WORLD_STORAGE?.flushSave();for(const id of [...held.keys()])release(id);});
  document.addEventListener('click',async event=>{if(event.target.closest('[data-career-fork]'))try{await window.FM_CAREERS?.forkCurrent?.();}catch(error){toast(error.message||'No se pudo crear la copia independiente');}});
  document.addEventListener('click',event=>{if(!blocked())return;const b=event.target.closest('button');if(!b||b.matches('[data-view],[data-pro-tab],[data-career-fork],[data-careers-open],[data-careers-close],[data-careers-export],[data-pro-open],[data-action="export"],[data-action="close"]'))return;event.preventDefault();event.stopImmediatePropagation();toast(notice);},true);
  document.addEventListener('submit',event=>{if(blocked()){event.preventDefault();event.stopImmediatePropagation();toast(notice);}},true);
  return{acquire,guard,release,blocked,renderBanner,get notice(){return notice}};
})();
