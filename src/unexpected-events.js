/* Sucesos ficticios de la carrera: una tirada diaria, decisiones persistentes. */
window.FM_INCIDENTS = (() => {
  const tiers=[{name:'Cotidiana',weight:24,cooldown:35},{name:'Poco habitual',weight:12,cooldown:60},{name:'Inusual',weight:5,cooldown:100},{name:'Extraordinaria',weight:1.5,cooldown:180},{name:'Insólita',weight:.25,cooldown:365}];
  // Each effect is immediate, bounded, and described before the decision.
  const definitions=[
    ['boots',0,'Problemas con los botines','Una entrega de botines llegó con talles equivocados. El utilero propone resolverlo antes de entrenar.','Comprar reemplazos',{cost:1,morale:2},'Usar el material de reserva',{condition:-1}],
    ['school',0,'Invitación de una escuela','Una escuela del barrio invita al plantel a una actividad solidaria.','Organizar la visita',{cost:.4,morale:1,pressure:-3},'Enviar un saludo grabado',{pressure:-1}],
    ['bus',0,'El micro necesita una reparación','El transporte contratado tiene una avería. Hay que organizar el traslado al entrenamiento.','Contratar un reemplazo',{cost:.8,condition:1},'Compartir vehículos',{condition:-2}],
    ['meal',0,'Nuevo menú del plantel','El nutricionista propone mejorar el servicio de comidas de esta semana.','Aprobar el servicio',{cost:.8,condition:2},'Mantener el menú habitual',{}],
    ['birthday',0,'Cumpleaños en el vestuario','El grupo propone una pequeña reunión después del entrenamiento para fortalecer la convivencia.','Organizar la reunión',{cost:.3,morale:2},'Felicitar al grupo',{morale:1}],
    ['rain',1,'Lluvia en el predio','Las canchas auxiliares están anegadas. Se puede alquilar un espacio cubierto.','Alquilar instalaciones',{cost:1.2,condition:1},'Entrenar en espacios reducidos',{condition:-2}],
    ['interview',1,'Entrevista con el capitán','Un medio propone una entrevista especial sobre la convivencia del equipo.','Preparar la entrevista',{cost:.4,pressure:-3},'Priorizar la privacidad',{morale:1}],
    ['family',1,'Jornada de las familias','Los futbolistas piden abrir un entrenamiento para sus familias.','Organizar la jornada',{cost:.7,morale:3},'Reservar el entrenamiento',{morale:-1}],
    ['grass',1,'Desgaste del césped','El encargado detectó una zona dañada en la cancha de entrenamiento.','Reparar de inmediato',{cost:1.5,condition:1},'Reducir el espacio de trabajo',{condition:-2}],
    ['supporters',1,'Banderazo organizado','Una agrupación propone recibir al equipo en el predio, con acceso controlado.','Financiar la organización',{cost:.6,morale:2,pressure:-2},'Agradecer sin abrir el predio',{pressure:1}],
    ['sponsor',2,'Campaña publicitaria sorpresa','Un patrocinador ofrece un ingreso extra a cambio de una jornada promocional del plantel.','Participar en la campaña',{income:3,condition:-2},'Proteger el descanso',{condition:1}],
    ['power',2,'Corte de luz en el gimnasio','Una falla externa dejó sin energía el gimnasio antes de la sesión.','Alquilar un generador',{cost:1.4},'Hacer trabajo alternativo',{condition:-1,morale:1}],
    ['oldboys',2,'Visita de exjugadores','Un grupo de referentes históricos ofrece compartir una charla con el plantel.','Organizar el encuentro',{cost:.8,morale:4,pressure:-1},'Enviar un agradecimiento',{}],
    ['lostkit',2,'Equipaje deportivo demorado','Parte de la indumentaria quedó retenida por un error logístico del proveedor.','Pagar un envío urgente',{cost:1.2},'Usar equipos alternativos',{morale:-2}],
    ['community',2,'Reconocimiento del barrio','Una asociación local quiere reconocer el trabajo social del club en un acto público.','Participar y colaborar',{cost:1,reputation:1,pressure:-4},'Recibir el reconocimiento a distancia',{pressure:-1}],
    ['film',3,'Un rodaje quiere usar el predio','Una productora ofrece alquilar una zona del predio para una escena, sin usar imágenes de los jugadores.','Aceptar el rodaje',{income:5,condition:-3,morale:-1},'Mantener la rutina',{morale:1}],
    ['collector',3,'Subasta de una camiseta histórica','Un coleccionista propone financiar una subasta solidaria junto al club.','Aportar a la organización',{cost:1.5,reputation:2,pressure:-5},'Difundir la iniciativa',{pressure:-1}],
    ['music',3,'Una canción del club se vuelve viral','Una canción creada por hinchas está circulando en todo el país. El área de comunicación propone acompañarla.','Producir una versión oficial',{cost:1,morale:4,pressure:-4},'Compartir la versión original',{morale:2}],
    ['scientists',3,'Prueba de equipamiento deportivo','Una universidad invita al club a probar sensores de recuperación durante una jornada.','Participar con supervisión',{cost:1,condition:4},'Mantener el protocolo habitual',{}],
    ['reunion',3,'Reencuentro de una generación campeona','Una generación histórica del club propone una visita al vestuario y una actividad con hinchas.','Organizar el homenaje',{cost:2,morale:5,reputation:1},'Hacer un homenaje digital',{morale:2}],
    ['goat',4,'¡Una cabra invadió el entrenamiento!','Un animal de una propiedad vecina entró al predio. El personal puede devolverlo con ayuda especializada.','Pedir asistencia y recuperar la sesión',{cost:.4,morale:3},'Suspender la sesión y esperar al dueño',{condition:2,morale:1}],
    ['cat',4,'Un gato adoptó el banco de suplentes','Un gato apareció en el predio y el plantel quiere organizar su cuidado con una protectora.','Financiar el cuidado responsable',{cost:.5,morale:5,pressure:-2},'Coordinar su adopción con una protectora',{morale:2}],
    ['mascot',4,'El disfraz de la mascota viajó al club equivocado','Un intercambio de paquetes dejó al club con una mascota de otro deporte. Comunicación propone aprovechar la confusión.','Publicar el intercambio y devolverlo',{cost:.4,morale:4,pressure:-3},'Resolverlo discretamente',{}],
    ['replica',4,'La réplica de la copa no pasa por la puerta','La réplica encargada para una exposición llegó con un pedestal demasiado grande.','Adaptar la exposición',{cost:1,morale:3,pressure:-3},'Exponer solo fotografías',{pressure:1}],
    ['balloon',4,'Un globo publicitario aterrizó en el predio','Un globo sin pasajeros de una campaña local cayó sobre una cancha auxiliar vacía. La empresa ofrece compensar al club.','Aceptar la compensación y limpiar',{income:2,condition:-1},'Donar la compensación al barrio',{reputation:2,pressure:-4}]
  ].map(([id,tier,title,body,a,x,b,y])=>({id,tier,title,body,choices:[{id:'a',label:a,effect:x},{id:'b',label:b,effect:y}]}));
  const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const state=()=>GameState.world.incidents??=( {nextId:1,lastDay:null,lastClub:null,history:[],cooldowns:{},lastEvents:{}} );
  const get=id=>state().history.find(e=>e.id===String(id));
  const definition=e=>definitions.find(d=>d.id===e?.definitionId);
  const pending=id=>{const e=get(id);return !!e&&e.status==='pending'&&e.clubId===GameState.userClub.id&&e.deadline>=GameState.today};
  function effectsText(x,unit){return [x.cost?`Costo: ${money(Math.round(x.cost*unit))}`:'',x.income?`Ingreso: ${money(Math.round(x.income*unit))}`:'',...Object.entries({morale:'Moral del plantel',condition:'Condición',pressure:'Presión de la hinchada',reputation:'Reputación'}).filter(([k])=>x[k]).map(([k,label])=>`${label}: ${x[k]>0?'+':''}${x[k]}`)].filter(Boolean).join(' · ')||'Sin cambios económicos ni deportivos';}
  function choices(id){const e=get(id),d=definition(e);return pending(id)?d.choices.map(c=>({...c,label:`${c.label} — ${effectsText(c.effect,e.unit)}`,disabled:!!c.effect.cost&&CLUB_AI.availableBudget(e.clubId)<Math.round(c.effect.cost*e.unit)})):[];}
  function notify(e){const d=definition(e);if(!d)return;FM_INBOX.push({title:d.title,body:`Situación ficticia de esta carrera · ${tiers[d.tier].name}. ${d.body}\nRespondé hasta el ${date(e.deadline)}. Sin respuesta: ${d.choices[1].label}.\n${d.choices.map(c=>`${c.label}: ${effectsText(c.effect,e.unit)}`).join('\n')}${e.outcome?'\nResolución: '+e.outcome:''}`,type:'plantel',action:'incident',incidentId:e.id,sourceKey:`incident:${e.id}`});}
  function ensureMessages(){if(!GameState?.world)return;for(const e of state().history){if(e.status==='pending'&&e.clubId!==GameState.userClub.id)e.status='cancelled';if(pending(e.id))notify(e);}}
  function resolve(id,choiceId,automatic=false){
    const e=get(id),d=definition(e),c=d?.choices.find(c=>c.id===choiceId);
    if(!e||!c||e.status!=='pending'||e.clubId!==GameState.userClub.id||locked()||(!automatic&&e.deadline<GameState.today))return {ok:false,reason:'La situación ya no admite esa decisión.'};
    const x=c.effect,amount=Math.round(((x.income||0)-(x.cost||0))*e.unit);
    if(amount<0&&(CLUB_AI.availableBudget(e.clubId)<-amount))return {ok:false,reason:'No hay presupuesto disponible para esta opción.'};
    if(amount&&!CLUB_AI.transaction(e.clubId,amount,d.title,'other'))return {ok:false,reason:'No se pudo registrar el movimiento financiero.'};
    for(const p of mine()){if(x.morale)p.moral=clamp(p.moral+x.morale,0,100);if(x.condition)p.condicion_fisica=clamp(p.condicion_fisica+x.condition,0,100);}
    if(x.pressure)GameState.userClub.presion_hinchada=clamp(GameState.userClub.presion_hinchada+x.pressure,0,100);
    if(x.reputation)GameState.userClub.reputacion=clamp(GameState.userClub.reputacion+x.reputation,0,100);
    e.status=automatic?'expired':'resolved';e.choice=choiceId;e.resolvedDate=GameState.today;e.outcome=`${automatic?'Aplicada por vencimiento: ':''}${c.label}. ${effectsText(x,e.unit)}`;
    const m=GameState.inbox.find(m=>m.incidentId===e.id);if(m)m.body+='\nResolución: '+e.outcome;
    if(automatic)FM_INBOX.push({title:`Resolución: ${d.title}`,body:e.outcome,type:'plantel',sourceKey:`incident-result:${e.id}`});
    WORLD_STORAGE.scheduleSave();return {ok:true};
  }
  function create(definitionId,day=GameState.today){
    const s=state(),d=definitions.find(d=>d.id===definitionId),clubId=GameState.userClub.id;
    if(!d||day!==GameState.today||locked()||s.history.some(e=>e.clubId===clubId&&e.status==='pending'))return null;
    const unit=Math.round(Math.max(100,Math.min(25000,CLUB_AI.wageBill(clubId)*.015)));
    const e={id:`unexpected-${s.nextId++}`,definitionId:d.id,clubId,date:day,deadline:addDays(day,3),unit,status:'pending'};
    s.history.push(e);s.history=s.history.slice(-100);s.cooldowns[clubId+':'+d.id]=addDays(day,tiers[d.tier].cooldown);s.lastEvents[clubId]=day;notify(e);return e;
  }
  function onDay(day,random=Math.random){
    if(!GameState?.world||locked()||day!==GameState.today)return;
    const s=state(),clubId=GameState.userClub.id;
    for(const e of s.history.filter(e=>e.status==='pending')){
      if(e.clubId!==clubId)e.status='cancelled';
      else if(e.deadline<day)resolve(e.id,'b',true);
    }
    if(s.lastDay===day&&s.lastClub===clubId)return;
    s.lastDay=day;s.lastClub=clubId;
    if(GameState.finished||GameState.world.depth?.dismissed||s.history.some(e=>e.status==='pending')||s.lastEvents[clubId]&&addDays(s.lastEvents[clubId],6)>day)return;
    // Absolute probabilities: ineligible events become quiet days, never extra rare events.
    const roll=random();if(!Number.isFinite(roll)||roll<0||roll>=1)return;
    const total=definitions.reduce((n,d)=>n+tiers[d.tier].weight,0);let cursor=roll*total/.16;
    for(const d of definitions){cursor-=tiers[d.tier].weight;if(cursor<0){if(!s.cooldowns[clubId+':'+d.id]||s.cooldowns[clubId+':'+d.id]<=day)create(d.id,day);return;}}
  }
  return {definitions:definitions.map(d=>({id:d.id,title:d.title,tier:tiers[d.tier].name,weight:tiers[d.tier].weight})),onDay,create,get,pending,choices,resolve,ensureMessages};
})();
