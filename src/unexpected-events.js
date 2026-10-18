/* Sucesos ficticios de la carrera: una tirada diaria, decisiones persistentes. */
window.FM_INCIDENTS = (() => {
  const tiers=[{name:'Cotidiana',weight:24,cooldown:35},{name:'Poco habitual',weight:12,cooldown:60},{name:'Inusual',weight:5,cooldown:100},{name:'Extraordinaria',weight:1.5,cooldown:180},{name:'Insólita',weight:.25,cooldown:365}];
  // Immediate effects and the dated follow-up are quoted before the decision.
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
  const contexts={
    boots:{reason:'El utilero identifica a un afectado por el material de esta semana.',delay:4,a:{condition:1},b:{condition:-1}},
    school:{reason:'La actividad se coordina con los alumnos durante la semana lectiva.',delay:7,a:{pressure:-2},b:{pressure:-1}},
    bus:{reason:'El traslado afecta la preparación de todo el grupo.',delay:3,a:{condition:1},b:{condition:-1}},
    meal:{reason:'El área médica revisará la respuesta al plan alimentario.',delay:6,a:{condition:1},b:{}},
    birthday:{reason:'El cumpleaños reúne a compañeros alrededor del homenajeado.',scope:'player',delay:4,a:{morale:2},b:{morale:1}},
    rain:{reason:'La temporada de lluvias compromete la disponibilidad de las canchas.',delay:4,a:{condition:1},b:{condition:-1}},
    interview:{reason:'El capitán representa al plantel ante la prensa.',scope:'player',delay:5,a:{pressure:-2,morale:1},b:{morale:1}},
    family:{reason:'Un futbolista que necesita apoyo propone la visita.',scope:'player',delay:5,a:{morale:3},b:{morale:-1}},
    grass:{reason:'El responsable del predio hará una segunda revisión del terreno.',delay:7,a:{condition:1},b:{condition:-1}},
    supporters:{reason:'Los hinchas coordinan el recibimiento del próximo partido.',delay:5,a:{pressure:-2},b:{pressure:1}},
    sponsor:{reason:'La campaña requiere una jornada libre entre compromisos.',delay:6,a:{pressure:-1,condition:-1},b:{condition:1}},
    power:{reason:'La sesión de gimnasio tendrá una revisión posterior de cargas.',delay:3,a:{condition:1},b:{condition:-1}},
    oldboys:{reason:'Un joven del equipo participa en la charla con los referentes.',scope:'player',delay:7,a:{morale:3},b:{}},
    lostkit:{reason:'La demora obliga a seguir la entrega de indumentaria.',delay:4,a:{morale:1},b:{morale:-1}},
    community:{reason:'La comisión vecinal comprobará el compromiso del club.',delay:7,a:{reputation:1,pressure:-2},b:{pressure:-1}},
    film:{reason:'La productora debe devolver las instalaciones después del rodaje.',delay:5,a:{condition:1},b:{morale:1}},
    collector:{reason:'Los socios recibirán el balance público de la subasta.',delay:7,a:{reputation:1,pressure:-2},b:{pressure:-1}},
    music:{reason:'La repercusión depende de cómo acompañe el club a sus hinchas.',delay:6,a:{morale:2,pressure:-1},b:{morale:1}},
    scientists:{reason:'El equipo médico propone seguir la recuperación de un futbolista fatigado.',scope:'player',delay:5,a:{condition:3},b:{}},
    reunion:{reason:'El homenaje retoma una conquista de la historia de esta carrera.',delay:7,a:{morale:2},b:{morale:1}},
    goat:{reason:'El predio deberá recuperar la normalidad tras devolver al animal.',delay:3,a:{morale:1},b:{condition:1}},
    cat:{reason:'La protectora informará sobre el cuidado y la adopción.',delay:7,a:{morale:2,pressure:-1},b:{morale:1}},
    mascot:{reason:'Comunicación seguirá la devolución y la respuesta de los socios.',delay:5,a:{pressure:-2},b:{}},
    replica:{reason:'La exposición celebra un título obtenido en esta carrera.',delay:7,a:{morale:1,pressure:-1},b:{pressure:1}},
    balloon:{reason:'El personal y la asociación vecinal confirmarán la limpieza del predio.',delay:4,a:{condition:1},b:{pressure:-2}}
  };
  const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const state=()=>GameState.world.incidents??=({version:2,nextId:1,lastDay:null,lastClub:null,history:[],cooldowns:{},lastEvents:{}});
  const get=id=>{const e=state().history.find(e=>e.id===String(id));if(e&&e.status==='pending'&&definition(e)&&!e.context)e.context=contextFor(definition(e),e.date);return e;};
  const definition=e=>definitions.find(d=>d.id===e?.definitionId);
  const pending=id=>{const e=get(id);return !!e&&!!definition(e)&&e.status==='pending'&&e.clubId===GameState.userClub.id&&e.deadline>=GameState.today&&!(contexts[e.definitionId]?.scope==='player'&&player(e.context?.playerId)?.clubId!==e.clubId);};
  function contextFor(d,day){
    const members=mine().filter(p=>!p.loanId),healthy=members.filter(p=>!(p.injury>0)),fixture=window.WORLD_CLOCK?.nextFixture?.(),meta=contexts[d.id],prior=state().history.findLast(e=>e.clubId===GameState.userClub.id&&e.definitionId===d.id&&e.status!=='pending');
    let target=members.slice().sort((a,b)=>a.edad-b.edad||a.id-b.id)[0];
    if(d.id==='birthday')target=members.find(p=>p.fecha_nacimiento&&[-1,0,1,2,3].some(n=>addDays(day,n).slice(5)===p.fecha_nacimiento.slice(5)))||target;
    if(d.id==='interview')target=player(GameState.tactics.captain)||members.slice().sort((a,b)=>b.edad-a.edad)[0];
    if(d.id==='family')target=members.slice().sort((a,b)=>a.moral-b.moral)[0];
    if(d.id==='scientists')target=healthy.slice().sort((a,b)=>a.condicion_fisica-b.condicion_fisica)[0]||target;
    const titles=(GameState.world.depth?.honours||[]).filter(h=>h.clubId===GameState.userClub.id),month=Number(day.slice(5,7)),country=club(GameState.userClub.id)?.country||'',northern=['Colombia','Venezuela','Inglaterra','España','Alemania','Italia','Francia'].includes(country),rainy=northern?[10,11,12,1,2,3].includes(month):[3,4,5,6,7,8].includes(month);
    let eligible=members.length>0;
    if(d.id==='birthday')eligible=!!target?.fecha_nacimiento&&[-1,0,1,2,3].some(n=>addDays(day,n).slice(5)===target.fecha_nacimiento.slice(5));
    if(d.id==='school')eligible&&=![0,6].includes(new Date(day+'T12:00:00Z').getUTCDay());
    if(d.id==='rain')eligible&&=rainy;
    if(d.id==='sponsor'||d.id==='film')eligible&&=!fixture||addDays(day,2)<fixture.date;
    if(d.id==='scientists')eligible&&=!!target&&target.condicion_fisica<88;
    if(d.id==='family')eligible&&=!!target&&target.moral<70;
    if(d.id==='reunion'||d.id==='replica')eligible&&=titles.length>0;
    if(d.id==='collector')eligible&&=GameState.userClub.reputacion>=50;
    return {eligible,playerId:target?.id||null,playerName:target?.nombre||'',reason:meta.reason,fixtureId:fixture?.id||null,fixtureDate:fixture?.date||null,previousIncidentId:prior?.id||null,previousResolution:prior?.choice||null,title:titles.at(-1)?.competition||titles.at(-1)?.title||null};
  }
  function effectsText(x,unit,scope='squad',name=''){return [x.cost?`Costo: ${money(Math.round(x.cost*unit))}`:'',x.income?`Ingreso: ${money(Math.round(x.income*unit))}`:'',...Object.entries({morale:scope==='player'?`Moral de ${name}`:'Moral del plantel',condition:scope==='player'?`Condición de ${name}`:'Condición del plantel',pressure:'Presión de la hinchada',reputation:'Reputación'}).filter(([k])=>x[k]).map(([k,label])=>`${label}: ${x[k]>0?'+':''}${x[k]}`)].filter(Boolean).join(' · ')||'Sin cambios económicos ni deportivos';}
  function followText(e,c){const meta=contexts[e.definitionId];return `Seguimiento ${meta.delay} días después de decidir: ${effectsText(meta[c.id]||{},e.unit,meta.scope,e.context?.playerName)}.`;}
  function choices(id){const e=get(id),d=definition(e);return pending(id)&&d?d.choices.map(c=>({...c,label:`${c.label} — ${effectsText(c.effect,e.unit,contexts[d.id]?.scope,e.context?.playerName)}`,disabled:!!c.effect.cost&&CLUB_AI.availableBudget(e.clubId)<Math.round(c.effect.cost*e.unit)})):[];}
  function notify(e){const d=definition(e);if(!d)return;const meta=contexts[d.id],context=e.context||{};FM_INBOX.push({title:d.title,body:`Situación ficticia de esta carrera · ${tiers[d.tier].name}. ${d.body}\n${context.reason||meta.reason}${context.playerName?' Afectado: '+context.playerName+'.':''}${context.fixtureDate?' Próximo partido: '+date(context.fixtureDate)+'.':''}${context.previousIncidentId?' Antecedente de esta carrera: '+context.previousIncidentId+'.':''}\nRespondé hasta el ${date(e.deadline)}. Sin respuesta: ${d.choices[1].label}.\n${d.choices.map(c=>`${c.label}: ${effectsText(c.effect,e.unit,meta.scope,context.playerName)}. ${followText(e,c)}`).join('\n')}${e.outcome?'\nResolución: '+e.outcome:''}`,type:'plantel',action:'incident',playerId:context.playerId,incidentId:e.id,sourceKey:`incident:${e.id}`});}
  function ensureMessages(){if(!GameState?.world)return;for(const e of state().history){if(!definition(e)){e.status='cancelled';continue;}if(e.status==='pending')e.context??=contextFor(definition(e),e.date);if(e.status==='pending'&&(e.clubId!==GameState.userClub.id||contexts[e.definitionId]?.scope==='player'&&player(e.context?.playerId)?.clubId!==e.clubId))e.status='cancelled';if(e.clubId!==GameState.userClub.id&&e.followup?.status==='scheduled')e.followup.status='cancelled';if(pending(e.id))notify(e);}}
  function applyEffects(x,e,scope){const targets=scope==='player'?[player(e.context?.playerId)].filter(p=>p?.clubId===e.clubId):mine();for(const p of targets){if(x.morale)p.moral=clamp(p.moral+x.morale,0,100);if(x.condition)p.condicion_fisica=clamp(p.condicion_fisica+x.condition,0,100);}if(x.pressure)GameState.userClub.presion_hinchada=clamp(GameState.userClub.presion_hinchada+x.pressure,0,100);if(x.reputation)GameState.userClub.reputacion=clamp(GameState.userClub.reputacion+x.reputation,0,100);}
  function resolve(id,choiceId,automatic=false){
    const e=get(id),d=definition(e),c=d?.choices.find(c=>c.id===choiceId),meta=contexts[d?.id];
    if(!e||!c||e.status!=='pending'||e.clubId!==GameState.userClub.id||locked()||(!automatic&&e.deadline<GameState.today)||meta.scope==='player'&&player(e.context?.playerId)?.clubId!==e.clubId)return {ok:false,reason:'La situación ya no admite esa decisión.'};
    const x=c.effect,amount=Math.round(((x.income||0)-(x.cost||0))*e.unit);
    if(amount<0&&CLUB_AI.availableBudget(e.clubId)<-amount)return {ok:false,reason:'No hay presupuesto disponible para esta opción.'};
    if(amount&&!CLUB_AI.transaction(e.clubId,amount,d.title,'other'))return {ok:false,reason:'No se pudo registrar el movimiento financiero.'};
    applyEffects(x,e,meta.scope);
    e.status=automatic?'expired':'resolved';e.choice=choiceId;e.resolvedDate=GameState.today;e.outcome=`${automatic?'Aplicada por vencimiento: ':''}${c.label}. ${effectsText(x,e.unit,meta.scope,e.context?.playerName)}`;
    e.followup={dueDate:addDays(GameState.today,meta.delay),status:'scheduled',effect:{...meta[c.id]},scope:meta.scope||'squad'};
    const m=GameState.inbox.find(m=>m.incidentId===e.id);if(m)m.body+='\nResolución: '+e.outcome+'\nHabrá seguimiento el '+date(e.followup.dueDate)+'.';
    if(automatic)FM_INBOX.push({title:`Resolución: ${d.title}`,body:e.outcome,type:'plantel',sourceKey:`incident-result:${e.id}`});
    window.FM_INTEGRITY?.record('plantel',d.title,e.outcome,{playerId:e.context?.playerId});WORLD_STORAGE.scheduleSave();return {ok:true};
  }
  function create(definitionId,day=GameState.today){
    const s=state(),d=definitions.find(d=>d.id===definitionId),clubId=GameState.userClub.id;
    if(!d||day!==GameState.today||locked()||s.history.some(e=>e.clubId===clubId&&e.status==='pending'))return null;
    const unit=Math.round(Math.max(100,Math.min(25000,CLUB_AI.wageBill(clubId)*.015))),context=contextFor(d,day);
    const e={id:`unexpected-${s.nextId++}`,definitionId:d.id,clubId,date:day,deadline:addDays(day,3),unit,status:'pending',context};
    s.history.push(e);s.history=s.history.slice(-100);s.cooldowns[clubId+':'+d.id]=addDays(day,tiers[d.tier].cooldown);s.lastEvents[clubId]=day;notify(e);return e;
  }
  function processFollowups(day){for(const e of state().history){const f=e.followup;if(!f||f.status!=='scheduled')continue;if(e.clubId!==GameState.userClub.id||!definition(e)||f.scope==='player'&&player(e.context?.playerId)?.clubId!==e.clubId){f.status='cancelled';continue;}if(f.dueDate>day)continue;applyEffects(f.effect,e,f.scope);f.status='applied';f.appliedDate=day;f.outcome=effectsText(f.effect,e.unit,f.scope,e.context?.playerName);FM_INBOX.push({title:'Seguimiento: '+definition(e).title,body:`Situación ficticia de esta carrera. Tras la decisión del ${date(e.resolvedDate)} (${definition(e).choices.find(c=>c.id===e.choice)?.label||'decisión registrada'}), el cuerpo técnico informa: ${f.outcome}.${e.context?.playerName?' Referencia: '+e.context.playerName+'.':''}`,type:'plantel',playerId:e.context?.playerId,sourceKey:`incident-followup:${e.id}`});WORLD_STORAGE.scheduleSave();}}
  function onDay(day,random=Math.random){
    if(!GameState?.world||locked()||day!==GameState.today)return;
    const s=state(),clubId=GameState.userClub.id;ensureMessages();processFollowups(day);
    for(const e of s.history.filter(e=>e.status==='pending'))if(e.deadline<day)resolve(e.id,'b',true);
    if(s.lastDay===day&&s.lastClub===clubId)return;
    s.lastDay=day;s.lastClub=clubId;
    if(GameState.finished||GameState.world.depth?.dismissed||s.history.some(e=>e.status==='pending')||s.lastEvents[clubId]&&addDays(s.lastEvents[clubId],6)>day)return;
    // Ineligible situations become quiet days; their weight never makes rarer events common.
    const roll=random();if(!Number.isFinite(roll)||roll<0||roll>=1)return;
    const total=definitions.reduce((n,d)=>n+tiers[d.tier].weight,0);let cursor=roll*total/.16;
    for(const d of definitions){cursor-=tiers[d.tier].weight;if(cursor<0){if((!s.cooldowns[clubId+':'+d.id]||s.cooldowns[clubId+':'+d.id]<=day)&&contextFor(d,day).eligible)create(d.id,day);return;}}
  }
  return {definitions:definitions.map(d=>({id:d.id,title:d.title,tier:tiers[d.tier].name,weight:tiers[d.tier].weight})),onDay,create,get,pending,choices,resolve,ensureMessages,processFollowups,eligible:(id,day=GameState.today)=>{const d=definitions.find(d=>d.id===id);return !!d&&contextFor(d,day).eligible;}};
})();
