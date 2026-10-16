/* Training, academy and staff are simulated career systems; source identities stay intact. */
window.FM_DEVELOPMENT=(()=>{
  const DAY=86400000,MAX_STAFF=12,core=['ritmo','tiro','pase','regate','defensa','fisico'];
  const focuses={Recuperación:null,Físico:'fisico',Ataque:'tiro',Defensa:'defensa',Posesión:'pase',Técnica:'regate'};
  const positions={POR:'Arquero',DFC:'Central',LI:'Lateral izquierdo',LD:'Lateral derecho',MCD:'Mediocentro defensivo',MC:'Mediocampista',MP:'Mediapunta',EI:'Extremo izquierdo',ED:'Extremo derecho',DC:'Delantero centro'};
  const workloads={Reducida:.55,Normal:1,Intensa:1.35};
  const active=()=>!!GameState?.worldVersion,hash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h};
  const iso=n=>new Date(n).toISOString().slice(0,10),days=(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/DAY);
  const own=p=>p?.clubId===GameState?.userClub.id,office=()=>FM_OFFICE.office(),cash=()=>window.FM_FINANCES?.operatingAvailable?.()??CLUB_AI.availableBudget();
  const announce=(title,body,type='plantel',extra={})=>FM_INBOX.push({title,body,type,...extra});
  function ensure(){
    if(!active())return null;
    const state=GameState.world.development??={version:2,clubs:{},evolution:{players:{},lastWorldMonth:null,seasons:{}}};state.clubs??={};state.evolution??={players:{},lastWorldMonth:null,seasons:{}};state.evolution.players??={};state.evolution.seasons??={};
    const id=GameState.userClub.id;
    const s=state.clubs[id]??={plans:{},academy:[],intakeYear:0,academyLevel:1,academyPayDate:GameState.today,lastDay:GameState.today,trainingDate:null,history:[],recruitment:{},policy:{restBelow:70,highRiskRest:true,academyMinutes:30},delegation:{individual:'DT',academy:'DT'},reportMonth:null};
    s.plans??={};s.history??=[];s.academy??=[];s.recruitment??={};s.policy??={restBelow:70,highRiskRest:true,academyMinutes:30};s.delegation??={individual:'DT',academy:'DT'};
    for(const p of mine())playerPlan(p,s);
    if(s.intakeYear!==GameState.year)intake(s);
    return s;
  }
  function playerPlan(p,s=ensure()){
    if(!p||!s)return null;
    return s.plans[p.id]??={load:'Normal',position:'NONE',positionProgress:0,attributeProgress:{},weeklyLoad:0,loadDate:GameState.today,restUntil:null,baseline:overall(p),lastReview:null};
  }
  function fixtures(){const id=GameState.userClub.id;return GameState.calendar.filter(e=>!e.done&&e.date>=GameState.today&&(WORLD_ENGINE.eventGames(e)||[]).some(g=>g.home===id||g.away===id)).sort((a,b)=>a.date.localeCompare(b.date))}
  function schedule(day=GameState.today){
    const future=fixtures(),next=future.find(e=>e.date>=day),until=next?days(next.date,day):30;
    const recent=GameState.calendar.filter(e=>e.done&&days(day,e.date)>=0&&days(day,e.date)<=2&&(WORLD_ENGINE.eventGames(e)||[]).some(g=>g.home===GameState.userClub.id||g.away===GameState.userClub.id));
    const average=mine().reduce((n,p)=>n+p.condicion_fisica,0)/Math.max(1,mine().length),style=GameState.tactics.style;
    let focus=GameState.training.focus,intensity=GameState.training.intensity,phase='Construcción';
    if(until===0){focus='Recuperación';intensity='Baja';phase='Activación de partido'}
    else if(recent.some(e=>days(day,e.date)<=1)||average<72){focus='Recuperación';intensity='Baja';phase='Recuperación'}
    else if(until===1){focus=style==='Tiki-Taka'?'Posesión':'Técnica';intensity='Baja';phase='Preparación táctica'}
    else if(until===2){focus=style==='Salida de Contragolpe'?'Defensa':style==='Tiki-Taka'?'Posesión':'Ataque';intensity='Normal';phase='Plan de partido'}
    else if(future.filter(e=>days(e.date,day)<=7&&days(e.date,day)>=0).length>=2){focus='Técnica';intensity='Normal';phase='Calendario congestionado'}
    else {focus=style==='Tiki-Taka'?'Posesión':style==='Salida de Contragolpe'?'Defensa':'Físico';intensity=average>=88&&until>=4?'Alta':'Normal'}
    return {date:day,focus,intensity,phase,daysToMatch:until,nextId:next?.id||null};
  }
  function risk(p){if(window.FM_MEDICINE)return FM_MEDICINE.risk(p).label;const q=playerPlan(p),fatigue=100-p.condicion_fisica,load=q?.weeklyLoad||0;return p.injury?'Lesionado':fatigue>=35||load>=8?'Alto':fatigue>=20||load>=6?'Medio':'Bajo'}
  function coachQuality(){return Math.max(40,...office().staff.filter(e=>['Ayudante','Preparador','Entrenador juvenil'].includes(e.role)).map(e=>e.ability))}
  function positionFamiliarity(p,position){if((p.learnedPositions||[]).includes(position))return 100;const q=own(p)?playerPlan(p):null;return q?.position===position?q.positionProgress:0}
  function evolution(p){
    const root=GameState.world.development??={version:2,clubs:{}},all=root.evolution??={players:{},lastWorldMonth:null,seasons:{}};
    all.players??={};all.seasons??={};
    return all.players[p.id]??={lastDay:GameState.today,ceiling:Math.max(overall(p),Number(p.potential)||overall(p)),ageProgress:{},backgroundProgress:{},phaseYear:0,phase:'Consolidación',rate:1,reviewYear:GameState.year,baseMinutes:Number(p.minutes)||0,changes:[],totalLostDays:0};
  }
  function exactAge(p,day=GameState.today){return p.fecha_nacimiento?Math.max(15,(Date.parse(day)-Date.parse(p.fecha_nacimiento))/(365.2425*DAY)):Number(p.edad)||25}
  function phase(p,day=GameState.today){
    const e=evolution(p),year=Number(day.slice(0,4));if(e.phaseYear!==year){
      const seed=hash(p.id+':trajectory:'+year),roll=seed%100,young=exactAge(p,day)<=24;
      e.phase=roll<17?'Meseta':roll>84&&young?'Despegue':roll>90?'Buen momento de desarrollo':'Consolidación';
      e.rate=e.phase==='Meseta'?.25:e.phase==='Despegue'?1.55:e.phase==='Buen momento de desarrollo'?1.18:.78+(seed%39)/100;e.phaseYear=year;
    }return e;
  }
  function minutesSupport(p,day=GameState.today){
    const since=Math.max(35,days(day,day.slice(0,4)+'-01-01')),expected=Math.min(2200,since*6),actual=Math.max(0,Number(p.minutes)||0);
    return Math.max(.55,Math.min(1.2,.55+actual/Math.max(250,expected)*.5));
  }
  function developmentRate(p,key,{count=1,intensity=1,coach=65,manager=10,day=GameState.today}={}){
    const e=phase(p,day),years=exactAge(p,day),goalkeeper=p.posicion==='POR',ceiling=Math.min(99,e.ceiling),headroom=Math.max(0,ceiling-overall(p));
    const physical=['ritmo','fisico'].includes(key),peak=goalkeeper?29:physical?23:25,maturity=Math.max(.12,Math.min(1.65,1.5-(years-18)*.073-(years>peak?(years-peak)*.07:0)));
    const health=GameState.world.medicine?.players?.[p.id],injuryBrake=p.injury?.12:Math.max(.7,1-(health?.tissueFatigue||0)/180),morale=.75+Math.max(0,Number(p.moral)||0)/200;
    const personality=window.FM_DRESSING_ROOM?.developmentModifier?.(p)||1,exposure=minutesSupport(p,day),headroomFactor=Math.min(1,headroom/5);
    // Every factor describes the simulated career, never a biographical trait inferred from a real name.
    return count*.043*intensity*maturity*(.75+coach/200)*(.8+manager/50)*headroomFactor*personality*e.rate*exposure*injuryBrake*morale;
  }
  function advanceBiology(p,day=GameState.today,background=false){
    const e=phase(p,day),count=Math.min(400,Math.max(0,days(day,e.lastDay)));if(!count)return false;
    const years=exactAge(p,day),goalkeeper=p.posicion==='POR',wide=(FM_PLAYER.naturalPositions(p)||[]).some(code=>['EI','ED','LI','LD'].includes(code));
    const physicalThreshold=goalkeeper?34.5:wide?28.5:p.posicion==='DEF'?30.5:29.5,technicalThreshold=goalkeeper?36.5:33.5,medical=GameState.world.medicine?.players?.[p.id],lost=medical?.lostDays||0;
    const biological=1+(hash(p.id+':aging')%41-20)/100,changes=[];
    for(const key of core){
      const physical=key==='ritmo'||key==='fisico',threshold=physical?physicalThreshold:technicalThreshold,decay=Math.max(0,years-threshold)*(.32+(key==='ritmo'?.12:0))*count/365.2425*biological;
      e.ageProgress[key]=(e.ageProgress[key]||0)+decay;
      while(e.ageProgress[key]>=1&&p[key]>1){p[key]=Math.max(1,p[key]-1);e.ageProgress[key]-=1;changes.push({key,delta:-1})}
      if(background&&!p.injury){
        const gain=developmentRate(p,key,{count,coach:club(p.clubId)?.rating||55,manager:10,day})/6;
        e.backgroundProgress[key]=(e.backgroundProgress[key]||0)+gain;
        if(e.backgroundProgress[key]>=1&&overall(p)<e.ceiling&&p[key]<99){p[key]=Math.min(99,p[key]+1);e.backgroundProgress[key]-=1;changes.push({key,delta:1})}
        e.backgroundProgress[key]=Math.min(.999,e.backgroundProgress[key]);
      }
    }
    // Long absences can alter a career's attainable ceiling. This is bounded and assessed once a year.
    const year=Number(day.slice(0,4));if(e.reviewYear!==year){
      const injuryDays=Math.max(0,lost-e.totalLostDays),drop=injuryDays>=140?Math.min(2,Math.floor(injuryDays/100)):0;
      if(drop)e.ceiling=Math.max(overall(p),e.ceiling-drop);e.totalLostDays=lost;e.reviewYear=year;
    }
    if(changes.length){e.changes.push({date:day,changes});e.changes=e.changes.slice(-18)}e.lastDay=day;return true;
  }
  function potentialRange(p){return window.FM_DEPTH?.potentialRange?FM_DEPTH.potentialRange(p):'Sin evaluación observada'}
  function seasonEnd(year=GameState.year,leagueId=null){
    if(!active())return false;ensure();const e=GameState.world.development.evolution,key=leagueId?`${year}:${leagueId}`:String(year);if(e.seasons[key])return false;
    const members=leagueId?new Set(GameState.world.leagues.find(l=>l.id===leagueId)?.clubIds||[]):null;
    const players=members?GameState.players.filter(p=>members.has(p.clubId)):GameState.players;
    for(const p of players)advanceBiology(p,GameState.today,!own(p));
    const rows=players.filter(own).map(p=>({id:p.id,overall:overall(p),phase:phase(p).phase,minutes:Number(p.minutes)||0}));e.seasons[key]={date:GameState.today,leagueId,players:rows};
    const keys=Object.keys(e.seasons).sort((a,b)=>(e.seasons[a].date||'').localeCompare(e.seasons[b].date||''));while(keys.length>Math.max(12,(GameState.world.leagues?.length||1)*3))delete e.seasons[keys.shift()];return true;
  }
  function applyTraining(input=1){
    if(!active())return legacyTraining(input);
    const s=ensure();if(s.trainingDate===GameState.today)return false;
    const count=Math.max(1,Math.min(7,Math.floor(Number(input)||1))),t=GameState.training;
    if(office().responsibilities.training!=='DT'){const plan=schedule();t.focus=plan.focus;t.intensity=plan.intensity}
    let improvements=0,injuries=0,rested=0,learned=0;
    const coach=coachQuality(),manager=FM_OFFICE.ensure().profile.stats.entrenamiento;
    for(const p of mine()){
      const q=playerPlan(p,s),since=Math.max(0,days(GameState.today,q.loadDate));q.weeklyLoad=Math.max(0,q.weeklyLoad-since*.85);q.loadDate=GameState.today;
      if(p.injury>0)continue;
      const forcedRest=p.condicion_fisica<s.policy.restBelow||(s.policy.highRiskRest&&risk(p)==='Alto')||(q.restUntil&&q.restUntil>=GameState.today),personal=p.trainingFocus&&p.trainingFocus!=='Equipo'?p.trainingFocus:t.focus;
      if(personal==='Recuperación'||forcedRest){if(window.FM_MEDICINE)FM_MEDICINE.trainingLoad(p,0,{recovery:true});else p.condicion_fisica=clamp(p.condicion_fisica+count*(forcedRest?3:2.5));q.weeklyLoad=Math.max(0,q.weeklyLoad-count*.5);rested++;continue}
      const intensity=(t.intensity==='Alta'?1.35:t.intensity==='Baja'?.6:1)*(workloads[q.load]||1),key=focuses[personal]||'fisico';
      const ceiling=Math.min(99,evolution(p).ceiling),headroom=Math.max(0,ceiling-overall(p));
      const gain=developmentRate(p,key,{count,intensity,coach,manager});
      q.attributeProgress[key]=(q.attributeProgress[key]||0)+gain;
      if(q.attributeProgress[key]>=1&&p[key]<99&&headroom>0){p[key]=Math.min(99,p[key]+1);q.attributeProgress[key]-=1;improvements++}
      else q.attributeProgress[key]=Math.min(.99,q.attributeProgress[key]);
      p.trainingProgress=clamp(q.attributeProgress[key],0,.999);q.weeklyLoad+=count*intensity;
      if(window.FM_MEDICINE){const result=FM_MEDICINE.trainingLoad(p,count*intensity);if(result.injured)injuries++}
      else if(intensity>1)p.condicion_fisica=clamp(p.condicion_fisica-count*.75*(intensity-1)*2);
      if(q.position!=='NONE'&&q.positionProgress<100){q.positionProgress=clamp(q.positionProgress+count*.55*(.7+coach/200)*(p.edad<=23?1.2:.8),0,100);if(q.positionProgress>=100){p.learnedPositions=[...new Set([...(p.learnedPositions||[]),q.position])];learned++;announce('Puesto aprendido',`${p.nombre} completó su adaptación a ${positions[q.position]}. Se incorpora como puesto aprendido en la carrera; los datos publicados de origen se conservan.`, 'plantel',{playerId:p.id,action:'tactics'})}}
      if(!window.FM_MEDICINE&&intensity>1.3&&p.condicion_fisica<70&&Math.random()<count*.004){p.injury=3+hash(p.id+GameState.today)%6;injuries++;announce('Parte médico de entrenamiento',`${p.nombre}: sobrecarga tras una sesión de carga alta; ${p.injury} días de baja. La condición y la carga acumulada incidieron en el riesgo.`, 'medico',{playerId:p.id,action:'medical'})}
    }
    t.sessions+=count;s.trainingDate=GameState.today;
    t.lastReport=`${count} día${count===1?'':'s'} de ${t.focus.toLowerCase()}, intensidad ${t.intensity.toLowerCase()}. ${improvements} mejoras de atributo; ${rested} jugadores con recuperación; ${learned} puestos aprendidos; ${injuries} sobrecargas.`;
    s.history.unshift({date:GameState.today,focus:t.focus,intensity:t.intensity,improvements,rested,injuries});s.history=s.history.slice(0,28);
    return true;
  }
  function intake(s){
    const c=club(GameState.userClub.id),seed=hash(c.id+GameState.year),used=new Set(GameState.players.map(p=>p.id));
    s.academy=s.academy.filter(p=>!p.promoted&&GameState.year-(p.birthYear||GameState.year-18)<=20).slice(0,8);
    for(let i=0;i<4;i++){
      let id=800000000+seed%100000000+i;while(used.has(id)||s.academy.some(p=>p.id===id))id++;
      const pos=['POR','DEF','MED','DEL'][(seed+i)%4],p=makePlayer(id,null,pos,Math.max(36,(c.rating||60)-23+(seed+i)%9),c.country);
      p.edad=16+(seed+i)%3;p.birthYear=GameState.year-p.edad;p.nombre+=' (juvenil)';p.realIdentity=false;p.simulated=true;p.registered=false;p.academyClub=c.id;
      p.potential=Math.min(94,overall(p)+8+(seed+i*7)%18);p.contract=GameState.year+3;p.salario=Math.max(100,Math.round(p.salario*.25/25)*25);p.clausula_rescision=p.valor_mercado*2;
      Object.assign(p,{nationalities:[c.country],registrationArgentina:c.country==='Argentina',trainingFocus:'Equipo',trainingProgress:0,form:[],appearances:0,assists:0,minutes:0,seasonYellow:0,personalidad:'Profesional',academyProgress:0,intakeYear:GameState.year,academyOrigin:{clubId:c.id,style:FM_DEPTH.project(c.id).academy,year:GameState.year}});
      s.academy.push(p);
    }
    s.intakeYear=GameState.year;
  }
  function promotionStatus(p){
    if(!p||p.promoted)return {ok:false,reason:'El juvenil ya no está disponible'};
    const receipt=CLUB_AI.canReceive(p,GameState.userClub.id,p.salario);if(!receipt.ok)return receipt;
    if(cash()<p.salario*4)return {ok:false,reason:'No alcanza la caja disponible para cuatro semanas de prima'};
    return {ok:true,reason:''};
  }
  function promote(id){
    if(!active()||locked())return false;const s=ensure(),p=s.academy.find(p=>p.id===Number(id)),check=promotionStatus(p);
    if(!check.ok){toast(check.reason);return false}
    if(GameState.players.some(other=>other.id===p.id)){toast('El jugador ya está registrado');return false}
    MANAGEMENT.transaction(-p.salario*4,`Prima de promoción: ${p.nombre}`,'cantera');
    p.promoted=true;const promoted=structuredClone(p);delete promoted.promoted;promoted.clubId=GameState.userClub.id;promoted.registered=true;promoted.condicion_fisica=100;
    GameState.players.push(promoted);WORLD_ENGINE.reindex();playerPlan(promoted,s);
    announce('Promoción de las inferiores',`${p.nombre}, ${p.edad} años, ${p.posicion}: pasa al primer equipo con contrato hasta ${p.contract}, salario semanal ${money(p.salario)} y prima ${money(p.salario*4)}. Es una identidad juvenil simulada. Asegurá minutos adecuados a su desarrollo.`, 'plantel',{playerId:p.id,action:'tactics'});
    saveGame(true);render();return true;
  }
  function candidates(){
    const s=ensure(),key=String(GameState.year);if(s.recruitment[key])return s.recruitment[key];
    const first=['Federico','Miguel','Ramiro','Leonardo','Esteban','Nicolás','Guillermo','Mariano'],last=['Suárez','Vega','Rojas','Paz','Luna','Sosa','Duarte','Medina'];
    return s.recruitment[key]=Array.from({length:8},(_,i)=>{const seed=hash(GameState.userClub.id+key+i),ability=54+seed%39,salary=Math.round((150+ability*11)/25)*25;return {id:'dev-staff-'+GameState.userClub.id+'-'+key+'-'+i,name:first[i]+' '+last[seed%last.length],role:['Ayudante','Preparador','Entrenador juvenil','Ojeador'][i%4],ability,adaptability:50+seed%46,region:['Argentina','Brasil','Uruguay','Colombia','España','Italia'][seed%6],salary,signingFee:salary*(4+seed%4),status:'available',simulated:true}});
  }
  function staffBudget(){return Math.max(4500,Math.round(GameState.userClub.wageBudget*.12/100)*100)}
  function hire(id){
    if(!active()||locked())return false;const c=candidates().find(c=>c.id===id),o=office();
    if(!c||c.status!=='available'||o.staff.some(e=>e.id===id))return false;
    const total=o.staff.reduce((n,e)=>n+e.salary,0)+c.salary;
    if(o.staff.length>=MAX_STAFF){toast(`Máximo ${MAX_STAFF} empleados; liberá un puesto`);return false}
    if(c.role==='Ojeador'&&o.staff.filter(e=>e.role==='Ojeador').length>=8){toast('Máximo ocho ojeadores en la red');return false}
    if(total>staffBudget()){toast('La contratación supera el presupuesto semanal del cuerpo técnico');return false}
    if(cash()<c.signingFee+c.salary*4){toast('Se necesitan la prima y cuatro semanas de salario disponibles');return false}
    MANAGEMENT.transaction(-c.signingFee,`Contratación de ${c.name}`,'empleados');
    c.status='hired';const employee=structuredClone(c);delete employee.status;o.staff.push(employee);
    announce('Incorporación al cuerpo técnico',`${c.name} se incorpora como ${c.role.toLowerCase()}. Calidad ${c.ability}/99, salario ${money(c.salary)} por semana y prima ${money(c.signingFee)}. Ya puede asumir tareas de su especialidad.`, 'directiva');
    saveGame(true);render();return true;
  }
  function fire(id){
    if(!active()||locked())return false;const o=office(),e=o.staff.find(e=>e.id===id);if(!e)return false;
    if(Object.values(FM_DEPTH.ensure().reports).some(r=>r.status==='active'&&r.staffId===id)){toast('Cancelá o terminá su observación antes de rescindir');return false}
    if(e.role==='Ayudante'&&o.staff.filter(e=>e.role==='Ayudante').length===1){toast('El club necesita conservar un ayudante');return false}
    if(cash()<e.salary*4){toast('No alcanza la caja para cuatro semanas de indemnización');return false}
    MANAGEMENT.transaction(-e.salary*4,`Rescisión de ${e.name}`,'empleados');o.staff=o.staff.filter(e=>e.id!==id);if(o.scoutChoice===id)o.scoutChoice='auto';
    announce('Rescisión de empleado',`${e.name} deja el club. Indemnización: ${money(e.salary*4)}. Su salario ya no integra las próximas liquidaciones semanales.`, 'directiva');saveGame(true);render();return true;
  }
  function onDay(day){
    const s=ensure();if(!s||s.lastDay>=day)return;s.lastDay=day;
    if(office().responsibilities.training!=='DT'){const plan=schedule(day);Object.assign(GameState.training,{focus:plan.focus,intensity:plan.intensity})}
    for(const p of mine()){const q=playerPlan(p,s),elapsed=Math.max(0,days(day,q.loadDate));q.weeklyLoad=Math.max(0,q.weeklyLoad-elapsed*.85);q.loadDate=day;advanceBiology(p,day)}
    const evolutionState=GameState.world.development.evolution,worldMonth=day.slice(0,7);
    if(evolutionState.lastWorldMonth!==worldMonth){for(const p of GameState.players)if(!own(p))advanceBiology(p,day,true);evolutionState.lastWorldMonth=worldMonth}
    if(s.delegation.individual!=='DT')for(const p of mine()){
      const q=playerPlan(p,s);q.load=p.condicion_fisica<s.policy.restBelow?'Reducida':p.edad<=23&&risk(p)==='Bajo'?'Normal':'Reducida';
      p.trainingFocus=p.condicion_fisica<s.policy.restBelow?'Recuperación':'Equipo';
    }
    for(const p of s.academy){
      if(p.promoted)continue;p.edad=GameState.year-p.birthYear;
      const staff=office().staff.filter(e=>e.role==='Entrenador juvenil'),quality=staff.length?Math.max(...staff.map(e=>e.ability)):55;
      advanceBiology(p,day);p.academyProgress=(p.academyProgress||0)+.018*(.8+s.academyLevel*.15)*(quality/70)*phase(p,day).rate;
      if(p.academyProgress>=1&&overall(p)<p.potential){const key=core[hash(p.id+day)%core.length];if(p[key]<p.potential)p[key]++;p.academyProgress-=1}
    }
    const weeks=Math.max(0,Math.floor(days(day,s.academyPayDate)/7));
    if(weeks){const expense=s.academyLevel*250*weeks;MANAGEMENT.transaction(-expense,'Funcionamiento de las inferiores','cantera');s.academyPayDate=iso(Date.parse(s.academyPayDate)+weeks*7*DAY)}
    const month=day.slice(0,7);if(s.reportMonth!==month){s.reportMonth=month;
      const progressed=mine().filter(p=>overall(p)>playerPlan(p,s).baseline),prospects=s.academy.filter(p=>!p.promoted).sort((a,b)=>(window.FM_SCOUT_NETWORK?FM_SCOUT_NETWORK.assessment(b,{kind:'potential'}).estimate:overall(b))-(window.FM_SCOUT_NETWORK?FM_SCOUT_NETWORK.assessment(a,{kind:'potential'}).estimate:overall(a)));
      announce('Informe mensual de desarrollo',`${progressed.length} jugadores mejoraron su calidad desde la llegada al centro. ${mine().filter(p=>risk(p)==='Alto').length} presentan carga alta. Inferiores: ${prospects.length} juveniles en formación${prospects[0]?'; observar a '+prospects[0].nombre:''}. Revisá progreso, minutos y carga antes de promover.`, 'plantel',{action:'tactics'});
      if(s.delegation.academy!=='DT'){
        const p=prospects.find(p=>p.edad>=18&&overall(p)>=Math.min(...mine().filter(m=>m.posicion===p.posicion).map(overall),99)-6&&promotionStatus(p).ok);
        if(p)promote(p.id);
      }
    }
  }
  function option(values,current){return values.map(value=>`<option ${value===current?'selected':''}>${esc(value)}</option>`).join('')}
  function page(){
    const s=ensure(),o=office(),plan=schedule(),next=fixtures()[0],health=mine().filter(p=>p.injury||risk(p)!=='Bajo');
    return `<div class="fm-section-head"><div><span class="small muted">CUERPO TÉCNICO</span><h2>Entrenamiento y desarrollo</h2></div><span class="badge">${GameState.training.sessions} sesiones · ${coachQuality()}/99 cuerpo técnico</span></div>
    <section class="card dev-microcycle"><h2>Microciclo</h2><div class="dev-summary"><strong>${esc(plan.phase)}</strong><span>${next?'Próximo partido: '+date(next.date):'Sin partido próximo'}</span><span>Riesgo alto: ${mine().filter(p=>risk(p)==='Alto').length}</span></div><div class="dev-controls"><label>Enfoque colectivo<select data-training="focus" ${locked()?'disabled':''}>${option(Object.keys(focuses),GameState.training.focus)}</select></label><label>Intensidad<select data-training="intensity" ${locked()?'disabled':''}>${option(['Baja','Normal','Alta'],GameState.training.intensity)}</select></label><label>Planificación<select data-office-responsibility="training"><option value="DT">DT</option><option value="staff" ${o.responsibilities.training!=='DT'?'selected':''}>Ayudante · según calendario</option></select></label></div><div class="scroll"><table><thead><tr><th>Fecha</th><th>Fase recomendada</th><th>Trabajo</th><th>Carga</th></tr></thead><tbody>${Array.from({length:7},(_,i)=>schedule(iso(Date.parse(GameState.today)+i*DAY))).map(r=>`<tr><td>${date(r.date)}</td><td>${esc(r.phase)}</td><td>${esc(r.focus)}</td><td>${r.intensity}</td></tr>`).join('')}</tbody></table></div><p class="dev-explanation">El ayudante baja la carga antes de competir y después de cada partido. Con control del DT, tus opciones se respetan; el umbral individual de descanso siempre protege al jugador.</p><div class="fm-callout">${esc(GameState.training.lastReport)}</div></section>
    <section class="card dev-individual"><h2>Planes individuales</h2><div class="dev-controls"><label>Responsable<select data-dev-delegation="individual">${[['DT','DT'],['staff','Preparador · aplica descansos']].map(([v,l])=>`<option value="${v}" ${s.delegation.individual===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Descanso bajo condición<input type="number" min="50" max="85" data-dev-policy="restBelow" value="${s.policy.restBelow}"></label><label><input type="checkbox" data-dev-policy="highRiskRest" ${s.policy.highRiskRest?'checked':''}> Recuperación con riesgo alto</label></div><div class="scroll"><table><thead><tr><th>Jugador</th><th>Condición / riesgo</th><th>Enfoque</th><th>Carga</th><th>Puesto a aprender</th><th>Progreso</th></tr></thead><tbody>${mine().map(p=>{const q=playerPlan(p,s);return `<tr><td><button data-player="${p.id}">${esc(p.nombre)}</button><small>${p.edad} años · ${overall(p)} / ${potentialRange(p)}</small></td><td>${Math.round(p.condicion_fisica)}%<small>${risk(p)} · carga ${q.weeklyLoad.toFixed(1)}${window.FM_MEDICINE?' · ritmo '+FM_MEDICINE.report(p).sharpness+'%':''}</small></td><td><select data-individual="${p.id}" ${locked()?'disabled':''}>${option(['Equipo',...Object.keys(focuses)],p.trainingFocus||'Equipo')}</select></td><td><select data-dev-load="${p.id}" ${locked()?'disabled':''}>${option(Object.keys(workloads),q.load)}</select></td><td><select data-dev-position="${p.id}" ${locked()?'disabled':''}><option value="NONE">Sin reconversión</option>${Object.entries(positions).filter(([code])=>(p.posicion==='POR')===(code==='POR')).map(([code,label])=>`<option value="${code}" ${q.position===code?'selected':''}>${label}</option>`).join('')}</select></td><td>${Math.round(p.trainingProgress*100)}% atributo<small>${esc(phase(p).phase)} · ${Math.round(minutesSupport(p)*100)}% apoyo por minutos</small><small>${q.position==='NONE'?'Sin puesto nuevo':Math.round(q.positionProgress)+'% '+q.position}</small></td></tr>`}).join('')}</tbody></table></div><p class="dev-explanation">El desarrollo tiene mesetas y despegues; depende de minutos, salud, entrenadores y entorno. El envejecimiento es gradual y distinto para arqueros, centrales y jugadores de banda. El potencial es una estimación del cuerpo técnico.</p></section>
    <section class="card dev-academy"><h2>Inferiores</h2><div class="dev-controls"><label>Inversión semanal<select data-dev-academy-level>${[1,2,3,4].map(level=>`<option value="${level}" ${s.academyLevel===level?'selected':''}>${money(level*250)} · nivel ${level}</option>`).join('')}</select></label><label>Promociones<select data-dev-delegation="academy"><option value="DT">Decide el DT</option><option value="staff" ${s.delegation.academy!=='DT'?'selected':''}>Coordinador · mayores de 18, a 6 puntos del relevo</option></select></label><span class="badge">Camada ${s.intakeYear} · identidades simuladas</span></div><div class="scroll"><table><thead><tr><th>Juvenil</th><th>Edad / puesto</th><th>Calidad / potencial</th><th>Salario semanal</th><th>Primer equipo</th></tr></thead><tbody>${s.academy.map(p=>{const check=promotionStatus(p);return `<tr><td>${esc(p.nombre)}<small>Generado en la carrera · no pertenece a la base real</small></td><td>${p.edad} · ${p.posicion}</td><td>${overall(p)} / ${potentialRange(p)}</td><td>${money(p.salario)}</td><td>${p.promoted?'<span class="green">Promovido</span>':`<button data-dev-promote="${p.id}" ${check.ok?'':'disabled'} title="${esc(check.reason||'Prima: '+money(p.salario*4))}">Promover · ${money(p.salario*4)}</button>${check.ok?'':`<small>${esc(check.reason)}</small>`}`}</td></tr>`}).join('')}</tbody></table></div><p class="dev-explanation">Cuatro ingresos por año. La inversión y los entrenadores juveniles afectan el desarrollo. Cada promoción respeta plazas, salarios, retornos de préstamos y caja. La delegación conserva esos límites.</p></section>
    <section class="card dev-staff"><h2>Contratar empleados</h2><div class="dev-summary"><span>${o.staff.length}/${MAX_STAFF} empleados</span><span>${money(o.staff.reduce((n,e)=>n+e.salary,0))} / ${money(staffBudget())} por semana</span><span>${Math.min(8,o.staff.filter(e=>e.role==='Ojeador').length)} observaciones simultáneas</span></div><div class="scroll"><table><thead><tr><th>Empleado</th><th>Especialidad</th><th>Calidad / adaptación</th><th>Salario / prima</th><th>Situación</th></tr></thead><tbody>${o.staff.map(e=>`<tr><td>${esc(e.name)}</td><td>${esc(e.role)}</td><td>${e.ability} / ${e.adaptability}</td><td>${money(e.salary)} / ${money(e.salary*4)} rescisión</td><td><button data-dev-fire="${esc(e.id)}">Rescindir</button></td></tr>`).join('')}${candidates().filter(c=>c.status==='available').map(c=>`<tr class="dev-candidate"><td>${esc(c.name)}<small>Personal simulado · disponible</small></td><td>${esc(c.role)}</td><td>${c.ability} / ${c.adaptability}</td><td>${money(c.salary)} / ${money(c.signingFee)}</td><td><button data-dev-hire="${esc(c.id)}">Contratar</button></td></tr>`).join('')}</tbody></table></div><p class="dev-explanation">Ayudantes y preparadores mejoran las sesiones; entrenadores juveniles trabajan en inferiores; ojeadores observan candidatos. Las primas se pagan al firmar y los salarios en la liquidación semanal existente. Rescindir cuesta cuatro salarios y exige terminar observaciones activas.</p></section>${window.FM_MEDICINE?.page()||''}`;
  }
  function decorate(){
    if(!active())return;ensure();
    if(view==='office'){const host=document.querySelector('#content .fm-page-intro');if(host&&!host.querySelector('[data-dev-open-staff]')){const b=document.createElement('button');b.dataset.devOpenStaff='';b.textContent='Contratar empleados';host.append(b)}}
  }
  const legacyTraining=MANAGEMENT.applyTraining;MANAGEMENT.applyTraining=applyTraining;
  const natural=FM_PLAYER.naturalPositions;FM_PLAYER.naturalPositions=p=>[...new Set([...natural(p),...(p?.learnedPositions||[]).filter(code=>Object.hasOwn(positions,code))])];
  document.addEventListener('click',e=>{
    const n=e.target.closest('[data-dev-promote],[data-dev-hire],[data-dev-fire],[data-dev-open-staff]');if(!n||!active())return;
    if(n.hasAttribute('data-dev-open-staff')){view='training';FM_WORKSPACE.ui.tabs.training='3';render();return}
    if(n.dataset.devPromote)promote(Number(n.dataset.devPromote));else if(n.dataset.devHire)hire(n.dataset.devHire);else if(n.dataset.devFire)fire(n.dataset.devFire);
  });
  document.addEventListener('change',e=>{
    const n=e.target;if(!active()||locked())return;const s=ensure();let changed=false;
    if(n.dataset.devLoad){const p=player(Number(n.dataset.devLoad));if(own(p)&&Object.hasOwn(workloads,n.value)){playerPlan(p,s).load=n.value;changed=true}}
    if(n.dataset.devPosition){const p=player(Number(n.dataset.devPosition));if(own(p)&&(n.value==='NONE'||Object.hasOwn(positions,n.value))&&(n.value==='NONE'||(p.posicion==='POR')===(n.value==='POR'))){const q=playerPlan(p,s);q.position=n.value;q.positionProgress=(p.learnedPositions||[]).includes(n.value)?100:0;changed=true}}
    if(n.dataset.devPolicy){const key=n.dataset.devPolicy;if(key==='restBelow')s.policy[key]=clamp(Math.round(Number(n.value)||70),50,85);if(key==='highRiskRest')s.policy[key]=n.checked;changed=true}
    if(n.dataset.devDelegation&&['individual','academy'].includes(n.dataset.devDelegation)&&['DT','staff'].includes(n.value)){s.delegation[n.dataset.devDelegation]=n.value;changed=true}
    if(n.hasAttribute('data-dev-academy-level')){s.academyLevel=clamp(Math.round(Number(n.value)||1),1,4);changed=true}
    if(changed){saveGame(true);render()}
  });
  return {ensure,playerPlan,evolution,phase,developmentRate,advanceBiology,potentialRange,seasonEnd,fixtures,schedule,risk,coachQuality,positionFamiliarity,applyTraining,onDay,intake,promotionStatus,promote,candidates,staffBudget,hire,fire,page,decorate};
})();
