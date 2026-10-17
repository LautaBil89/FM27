/* Tactical workbench: instructions and practice belong to the simulated career. */
(() => {
  const oldTactics = tactics;
  const active = () => GameState?.worldVersion === 1;
  const live = () => Boolean(GameState?.match);
  const bound = (value, low, high) => Math.min(high, Math.max(low, Number(value) || 0));
  const copy = value => structuredClone(value);
  const playerAt = id => id == null ? null : player(Number(id));
  const owned = p => Boolean(p && p.clubId === GameState?.userClub.id);
  const eligible = p => owned(p) && available(p);
  const validFormation = value => Object.hasOwn(FORMATIONS, value);
  const ui = {selectedSlot: 0, moveSource: null, alternative: null, renameId: null, phase: 'inPossession', setPieceTab:'attack'};
  const POSITION_LABELS = {POR:'Arquero',DFC:'Central',LI:'Lateral izquierdo',LD:'Lateral derecho',MCD:'Mediocentro defensivo',MC:'Mediocampista',MP:'Mediapunta',EI:'Banda izquierda',ED:'Banda derecha',DC:'Delantero centro'};
  const LAYOUTS = {
    '4-3-3': [['POR',50,88],['LI',13,70],['DFC',38,73],['DFC',62,73],['LD',87,70],['MC',25,47],['MCD',50,55],['MC',75,47],['EI',17,23],['DC',50,18],['ED',83,23]],
    '4-4-2': [['POR',50,88],['LI',13,71],['DFC',38,74],['DFC',62,74],['LD',87,71],['EI',13,44],['MC',38,50],['MC',62,50],['ED',87,44],['DC',35,20],['DC',65,20]],
    '3-5-2': [['POR',50,88],['DFC',25,74],['DFC',50,76],['DFC',75,74],['LI',12,47],['MC',33,45],['MCD',50,58],['MC',67,45],['LD',88,47],['DC',35,20],['DC',65,20]],
    '4-2-3-1': [['POR',50,88],['LI',13,72],['DFC',38,76],['DFC',62,76],['LD',87,72],['MCD',35,57],['MC',65,57],['EI',17,32],['MP',50,37],['ED',83,32],['DC',50,16]],
    '5-3-2': [['POR',50,88],['LI',10,63],['DFC',30,74],['DFC',50,77],['DFC',70,74],['LD',90,63],['MC',25,45],['MCD',50,54],['MC',75,45],['DC',35,20],['DC',65,20]],
    '4-1-4-1': [['POR',50,88],['LI',13,73],['DFC',38,76],['DFC',62,76],['LD',87,73],['MCD',50,59],['EI',12,37],['MC',37,42],['MC',63,42],['ED',88,37],['DC',50,17]]
  };
  const INSTRUCTIONS = {
    runs:{label:'Desmarques',values:['Equilibrados','Atacar espacios','Venir a recibir'],default:'Equilibrados'},
    passing:{label:'Pases',values:['Equilibrados','Cortos','Directos'],default:'Equilibrados'},
    risk:{label:'Riesgo con balón',values:['Equilibrado','Seguro','Arriesgado'],default:'Equilibrado'},
    tackling:{label:'Entradas',values:['Normal','Suave','Fuerte'],default:'Normal'},
    marking:{label:'Marcaje',values:['Zonal','Individual'],default:'Zonal'},
    duty:{label:'Deber individual',values:['Defensa','Apoyo','Ataque'],default:'Apoyo'},
    dribbling:{label:'Conducción',values:['Equilibrada','Encarar','Soltar rápido'],default:'Equilibrada'},
    shooting:{label:'Remate',values:['Seleccionar','Disparar más','Buscar pase'],default:'Seleccionar'},
    width:{label:'Ubicación',values:['Natural','Abrirse','Cerrar hacia adentro'],default:'Natural'},
    pressing:{label:'Presión individual',values:['Equipo','Intensa','Contener'],default:'Equipo'}
  };
  const PHASES = {
    inPossession:{label:'Con pelota',description:'Elegí cómo salir, progresar y terminar las jugadas.',fields:{
      buildUp:{label:'Salida desde el fondo',values:['Corta','Mixta','Directa'],default:'Mixta'},
      progression:{label:'Canal de progresión',values:['Centro','Bandas','Mixta'],default:'Mixta'},
      finalThird:{label:'Último tercio',values:['Elaborar','Equilibrado','Centros'],default:'Equilibrado'},
      crosses:{label:'Tipo de centro',values:['Rasos','Mixtos','Aéreos'],default:'Mixtos'}}},
    outOfPossession:{label:'Sin pelota',description:'Definí dónde recuperar y hacia dónde orientar al rival.',fields:{
      block:{label:'Altura del bloque',values:['Bajo','Medio','Alto'],default:'Medio'},
      trap:{label:'Orientar la presión',values:['Equilibrada','Fuera','Dentro'],default:'Equilibrada'},
      marking:{label:'Sistema de marcas',values:['Zonal','Individual'],default:'Zonal'}}},
    transition:{label:'Transiciones',description:'La reacción tras una pérdida o recuperación cambia el riesgo y el desgaste.',fields:{
      onLoss:{label:'Después de perderla',values:['Reagrupar','Equilibrada','Contrapresión'],default:'Equilibrada'},
      onWin:{label:'Después de recuperarla',values:['Conservar','Equilibrada','Contraatacar'],default:'Equilibrada'},
      keeper:{label:'Distribución del arquero',values:['Central','Laterales','Largo'],default:'Central'}}}
  };
  const SET_PIECES = {
    corner:{label:'Córner ofensivo',values:['Primer palo','Segundo palo','Corto','Área chica'],default:'Primer palo'},
    freeKick:{label:'Tiro libre',values:['Directo','Centro','Corto'],default:'Directo'},
    defending:{label:'Defensa de pelota parada',values:['Zonal','Mixta','Individual'],default:'Mixta'},
    practice:{label:'Ensayo semanal',values:['Mínimo','Equilibrado','Prioritario'],default:'Equilibrado'}
  };
  const ROLES = {
    POR:['Arquero','Arquero líbero'], DFC:['Defensor central'],
    LI:['Lateral','Carrilero'], LD:['Lateral','Carrilero'],
    MCD:['Pivote','Organizador','Volante mixto'],
    MC:['Organizador','Volante mixto','Interior','Pivote'],
    MP:['Mediapunta','Organizador','Interior'],
    EI:['Extremo','Interior','Delantero avanzado'], ED:['Extremo','Interior','Delantero avanzado'],
    DC:['Delantero avanzado','Delantero completo','Hombre objetivo']
  };
  function slots(formation=GameState?.tactics?.formation) {
    if(LAYOUTS[formation])return LAYOUTS[formation].map(item=>item[0]);
    return (FORMATIONS[formation] || FORMATIONS['4-3-3']).map(pos=>({POR:'POR',DEF:'DFC',MED:'MC',DEL:'DC'}[pos]));
  }
  function formationLayout(formation) {
    if(LAYOUTS[formation])return LAYOUTS[formation];
    const rows=[];for(const pos of ['POR','DEF','MED','DEL']){
      const indexes=(FORMATIONS[formation] || FORMATIONS['4-3-3']).map((item,index)=>item===pos?index:-1).filter(index=>index>=0);
      indexes.forEach((index,offset)=>rows[index]=[slots(formation)[index],100*(offset+1)/(indexes.length+1),{POR:88,DEF:73,MED:48,DEL:22}[pos]]);
    }return rows;
  }
  function naturalPositions(p) {
    return window.FM_PLAYER?.naturalPositions?.(p) || [{POR:'POR',DEF:'DFC',MED:'MC',DEL:'DC'}[p?.posicion] || 'MC'];
  }
  function coarseSlot(slot) {return slot==='POR'?'POR':['DFC','LI','LD'].includes(slot)?'DEF':['MC','MCD','MP'].includes(slot)?'MED':'DEL'}
  function positionFit(p, slot) {
    if(!p)return 0;
    const naturals=naturalPositions(p);
    if(naturals.includes(slot))return 100;
    const neighbours={LI:['LD'],LD:['LI'],DFC:['MCD'],MCD:['MC','DFC'],MC:['MCD','MP'],MP:['MC','EI','ED'],EI:['ED','MP'],ED:['EI','MP'],DC:['EI','ED']};
    if((neighbours[slot] || []).some(pos=>naturals.includes(pos)))return 75;
    if(p.posicion===coarseSlot(slot) || (['EI','ED'].includes(slot)&&p.posicion==='MED'))return 60;
    return p.posicion==='POR'||slot==='POR'?0:35;
  }
  function rolesFor(slot) {return ROLES[slot] || ROLES.MC}
  function roleFor(p,t=GameState.tactics,slot='MC') {
    const list=rolesFor(slot),selected=t.roles?.[p?.id];
    return list.includes(selected)?selected:list[0];
  }
  function roleFit(p,role,slot) {
    if(!p)return 0;
    const score=window.FM_PLAYER?.roleFit?.(p,role,slot);
    return Number.isFinite(score)?Math.round(bound(score,0,100)):Math.round(bound(overall(p)*.75+positionFit(p,slot)*.25,0,100));
  }
  function instructionsFor(id,t=GameState.tactics) {
    const stored=t.instructions?.[id] || {};
    const result=Object.fromEntries(Object.entries(INSTRUCTIONS).map(([key,spec])=>[key,spec.values.includes(stored[key])?stored[key]:spec.default]));
    const marker=playerAt(id),target=playerAt(stored.markingTarget);
    result.markingTarget=marker&&target&&target.clubId!==marker.clubId?target.id:null;
    return result;
  }
  function phasePlan(t=GameState?.tactics) {
    return Object.fromEntries(Object.entries(PHASES).map(([phase,spec])=>[phase,Object.fromEntries(Object.entries(spec.fields).map(([key,field])=>[key,field.values.includes(t?.phases?.[phase]?.[key])?t.phases[phase][key]:field.default]))]));
  }
  function setPiecePlan(t=GameState?.tactics) {
    const stored=t?.setPieces||{},result=Object.fromEntries(Object.entries(SET_PIECES).map(([key,spec])=>[key,spec.values.includes(stored[key])?stored[key]:spec.default]));
    const ids=(t?.xi||[]).map(playerAt).filter(p=>p&&p.posicion!=='POR');
    const belongs=p=>Boolean(p&&(t!==GameState?.tactics?ids.some(item=>item.clubId===p.clubId):owned(p)));
    const choose=(key,score)=>{const selected=playerAt(stored[key]);return belongs(selected)&&selected.posicion!=='POR'?selected.id:[...ids].sort((a,b)=>score(b)-score(a))[0]?.id??null};
    result.cornerTaker=choose('cornerTaker',p=>p.pase*.75+p.tiro*.25);
    result.freeKickTaker=choose('freeKickTaker',p=>p.tiro*.75+p.pase*.25);
    const assigned=new Set();
    for(const key of ['nearPost','farPost','edgeOfArea','stayBack']){const p=playerAt(stored[key]);result[key]=belongs(p)&&p.posicion!=='POR'&&!assigned.has(p.id)?p.id:null;if(result[key])assigned.add(result[key])}
    const familiarity=stored.familiarity?.[setPieceFingerprint(result)];
    result.familiarity=bound(typeof familiarity==='number'?familiarity:familiarity?.value??35,0,100);
    return result;
  }
  function matchPlan(t=GameState?.tactics) {return {...phasePlan(t),setPieces:setPiecePlan(t)}}
  function setPieceFingerprint(plan) {return [plan.corner,plan.freeKick,plan.defending].join('|')}
  function phaseFingerprint(t) {
    const phases=phasePlan(t),changed=[];
    for(const [phase,spec] of Object.entries(PHASES))for(const [key,field] of Object.entries(spec.fields))if(phases[phase][key]!==field.default)changed.push(`${phase}.${key}:${phases[phase][key]}`);
    return changed.join('|');
  }
  function setPhase(phase,key,value) {
    const t=ensure(),spec=Object.hasOwn(PHASES,phase)&&Object.hasOwn(PHASES[phase].fields,key)?PHASES[phase].fields[key]:null;if(!t||!spec||!spec.values.includes(value))return false;
    t.phases[phase][key]=value;WORLD_STORAGE.scheduleSave();return true;
  }
  function setPiece(key,value) {
    const t=ensure();if(!t)return false;
    if(Object.hasOwn(SET_PIECES,key)){if(!SET_PIECES[key].values.includes(value))return false;t.setPieces[key]=value}
    else if(['cornerTaker','freeKickTaker','nearPost','farPost','edgeOfArea','stayBack'].includes(key)){
      const id=value===''||value==null?null:Number(value),p=playerAt(id);
      if(id!=null&&(!owned(p)||p.posicion==='POR'))return false;
      if(['nearPost','farPost','edgeOfArea','stayBack'].includes(key)&&id!=null){
        const duplicate=['nearPost','farPost','edgeOfArea','stayBack'].some(other=>other!==key&&t.setPieces[other]===id);
        if(duplicate){toast('Cada ejecutante ocupa una función en la jugada preparada.');return false}
      }
      t.setPieces[key]=id;
    }else return false;
    WORLD_STORAGE.scheduleSave();return true;
  }
  function markingOpponents() {
    const m=GameState?.match;
    if(m){const side=1-m.userSide;return (m.lineups?.[side]||[]).filter(id=>!m.red?.includes(id)&&!m.injured?.includes(id)).map(playerAt).filter(p=>p&&p.posicion!=='POR')}
    const fixture=window.WORLD_CLOCK?.nextFixture?.(),game=fixture?.game||fixture?.games?.find(g=>g.home===GameState?.userClub.id||g.away===GameState?.userClub.id);
    if(!game)return [];
    const opponent=game.home===GameState.userClub.id?game.away:game.home;
    return squad(opponent).filter(p=>available(p)&&p.posicion!=='POR').sort((a,b)=>overall(b)-overall(a));
  }
  function setMarkingTarget(id,targetId) {
    const t=ensure(),p=playerAt(id),target=targetId===''||targetId==null?null:Number(targetId);
    if(!t||!owned(p)||p.posicion==='POR'||target!=null&&!markingOpponents().some(item=>item.id===target))return false;
    t.instructions[p.id]={...instructionsFor(p.id,t),markingTarget:target};WORLD_STORAGE.scheduleSave();return true;
  }
  function ensure() {
    if(!active())return null;
    const t=GameState.tactics;
    t.roles=t.roles&&typeof t.roles==='object'&&!Array.isArray(t.roles)?t.roles:{};
    t.instructions=t.instructions&&typeof t.instructions==='object'&&!Array.isArray(t.instructions)?t.instructions:{};
    t.phases=phasePlan(t);
    const currentSetPieces=t.setPieces&&typeof t.setPieces==='object'&&!Array.isArray(t.setPieces)?t.setPieces:{};
    const normalisedSetPieces=setPiecePlan(t);delete normalisedSetPieces.familiarity;
    t.setPieces={...normalisedSetPieces,familiarity:currentSetPieces.familiarity&&typeof currentSetPieces.familiarity==='object'&&!Array.isArray(currentSetPieces.familiarity)?currentSetPieces.familiarity:{}};
    const setKeys=Object.keys(t.setPieces.familiarity);if(setKeys.length>12)setKeys.sort((a,b)=>(Number(t.setPieces.familiarity[b]?.revision)||0)-(Number(t.setPieces.familiarity[a]?.revision)||0)).slice(12).forEach(key=>delete t.setPieces.familiarity[key]);
    t.familiarity=t.familiarity&&typeof t.familiarity==='object'&&!Array.isArray(t.familiarity)?t.familiarity:{};
    t.savedPlans=Array.isArray(t.savedPlans)?t.savedPlans.filter(plan=>plan&&typeof plan==='object'&&validFormation(plan.formation)&&typeof plan.id==='string').slice(0,5):[];
    t.nextPlanId=Math.max(1,Math.floor(Number(t.nextPlanId)||1));
    const ownIds=new Set(mine().map(p=>String(p.id)));
    for(const key of Object.keys(t.instructions))if(!ownIds.has(key))delete t.instructions[key];
    for(const key of Object.keys(t.roles))if(!ownIds.has(key))delete t.roles[key];
    const keys=Object.keys(t.familiarity);
    if(keys.length>12)keys.sort((a,b)=>(Number(t.familiarity[b]?.revision)||0)-(Number(t.familiarity[a]?.revision)||0)||String(t.familiarity[b]?.lastDate || '').localeCompare(String(t.familiarity[a]?.lastDate || ''))).slice(12).forEach(key=>delete t.familiarity[key]);
    return t;
  }
  function fingerprint(t) {
    const base=[t.formation || '4-3-3',t.style || 'Gegenpress',t.mentality || 'Equilibrada',...['tempo','width','line','pressing'].map(key=>Math.round(bound(t[key]??50,10,90)/20)),...slots(t.formation).map((slot,index)=>roleFor(playerAt(t.xi?.[index]),t,slot))].join('|');
    const phases=phaseFingerprint(t);return phases?base+'|'+phases:base;
  }
  function familiarity(t=GameState?.tactics) {
    if(!t)return 35;
    const item=t.familiarity?.[fingerprint(t)];
    return bound(typeof item==='number'?item:item?.value ??35,0,100);
  }
  function trainFamiliarity(days) {
    const t=ensure();if(!t)return 0;
    const duration=bound(days,0,31);if(!duration)return familiarity(t);
    const key=fingerprint(t),old=t.familiarity[key],value=familiarity(t),focus=GameState.training?.focus || 'Posesión';
    const intensity=GameState.training?.intensity==='Baja'?.75:GameState.training?.intensity==='Alta'?1.15:1;
    const practice=focus==='Recuperación'?.38:focus==='Posesión'||focus==='Defensa'?1:.8;
    const routineAllocation=t.setPieces.practice==='Prioritario'?.85:t.setPieces.practice==='Mínimo'?1.08:1;
    const gain=duration*.8*intensity*practice*routineAllocation*(.5+(100-value)/100);
    t.practiceCounter=Math.min(Number.MAX_SAFE_INTEGER-1,(Number(t.practiceCounter)||0)+1);
    t.familiarity[key]={value:Number(bound(value+gain,0,100).toFixed(2)),trainedDays:Math.min(20000,(Number(old?.trainedDays)||0)+duration),lastDate:GameState.today,revision:t.practiceCounter};
    const routine=setPiecePlan(t),routineKey=setPieceFingerprint(routine),previous=t.setPieces.familiarity[routineKey];
    const rehearsal=routine.practice==='Prioritario'?1.3:routine.practice==='Mínimo'?.35:.75;
    t.setPieces.familiarity[routineKey]={value:Number(bound(routine.familiarity+duration*rehearsal*intensity*(.55+(100-routine.familiarity)/100),0,100).toFixed(2)),trainedDays:Math.min(20000,(Number(previous?.trainedDays)||0)+duration),lastDate:GameState.today,revision:t.practiceCounter};
    ensure();return t.familiarity[key]?.value ??familiarity(t);
  }
  function phaseModifiers(t=GameState?.tactics,opponent=null) {
    const p=matchPlan(t),enemy=opponent?matchPlan(opponent):null,ids=t?.xi||[],members=ids.map(playerAt).filter(Boolean),average=key=>members.length?members.reduce((sum,item)=>sum+(Number(item[key])||65),0)/members.length:65;
    const technical=(average('pase')-65)/100,pace=(average('ritmo')-65)/100,physical=(average('fisico')-65)/100;
    const result={possession:1,progression:1,chanceQuality:1,width:1,press:1,transition:1,stamina:1,foulRisk:1,setPieceAttack:1,setPieceDefence:1};
    if(p.inPossession.buildUp==='Corta'){result.possession+=.055+technical*.12;result.progression-=.018;if(enemy?.outOfPossession.block==='Alto')result.progression+=technical*.20-.025}
    if(p.inPossession.buildUp==='Directa'){result.possession-=.065;result.progression+=.035+physical*.12;result.chanceQuality-=.015}
    if(p.inPossession.progression==='Bandas'){result.width+=.15;result.progression+=pace*.12;result.chanceQuality+=enemy?.outOfPossession.trap==='Dentro'?.035:enemy?.outOfPossession.trap==='Fuera'?-.025:0}
    if(p.inPossession.progression==='Centro'){result.width-=.12;result.possession+=technical*.1;result.chanceQuality+=enemy?.outOfPossession.trap==='Fuera'?.035:enemy?.outOfPossession.trap==='Dentro'?-.025:0}
    if(p.inPossession.finalThird==='Elaborar'){result.progression-=.035;result.chanceQuality+=.04+technical*.12;result.possession+=.025}
    if(p.inPossession.finalThird==='Centros'){result.progression+=.04;result.chanceQuality+=physical*.12-.025}
    if(p.outOfPossession.block==='Alto'){result.press+=.15;result.stamina+=.055;result.transition+=.025;result.foulRisk+=.035}
    if(p.outOfPossession.block==='Bajo'){result.press-=.15;result.stamina-=.035;result.transition-=.025}
    if(p.outOfPossession.marking==='Individual'){result.stamina+=.03;result.foulRisk+=.035}
    if(p.transition.onLoss==='Contrapresión'){result.press+=.12;result.stamina+=.065;result.transition+=.04}
    if(p.transition.onLoss==='Reagrupar'){result.press-=.08;result.stamina-=.025;result.transition-=.015}
    if(p.transition.onWin==='Contraatacar'){result.transition+=.14+pace*.12;result.possession-=.045}
    if(p.transition.onWin==='Conservar'){result.transition-=.1;result.possession+=.045}
    const rehearsed=(p.setPieces.familiarity-35)*.0015;result.setPieceAttack+=rehearsed;result.setPieceDefence+=rehearsed*.8;
    const membersOut=members.filter(item=>item.posicion!=='POR'),n=Math.max(1,membersOut.length),count=(key,value)=>membersOut.filter(item=>instructionsFor(item.id,t)[key]===value).length/n;
    result.stamina+=count('pressing','Intensa')*.06-count('pressing','Contener')*.035;
    result.press+=count('pressing','Intensa')*.08-count('pressing','Contener')*.06;
    result.chanceQuality+=count('shooting','Buscar pase')*.025-count('shooting','Disparar más')*.025;
    result.width+=count('width','Abrirse')*.10-count('width','Cerrar hacia adentro')*.10;
    result.progression+=count('dribbling','Encarar')*.025-count('dribbling','Soltar rápido')*.01;
    return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,Number(bound(value,key==='press'?.65:.8,key==='press'?1.35:1.25).toFixed(4))]));
  }
  function playerMatchFactor(p,t,expected) {
    if(!p||!t)return 1;
    const m=t===GameState?.tactics?GameState?.match:null,ids=m?.lineups?.[m.userSide] || t.xi;
    const index=ids?.indexOf(p.id) ??-1,slot=index>=0?slots(t.formation)[index]:({POR:'POR',DEF:'DFC',MED:'MC',DEL:'DC'}[expected] || expected || 'MC');
    const role=roleFor(p,t,slot),fit=roleFit(p,role,slot),instruction=instructionsFor(p.id,t);
    let factor=.945+fit*.0006+(familiarity(t)-35)*.0003;
    if(instruction.runs==='Atacar espacios')factor+=(p.ritmo-65)*.0004;
    if(instruction.runs==='Venir a recibir')factor+=(p.pase-65)*.0003;
    if(instruction.passing==='Cortos')factor+=(p.pase-65)*.0003;
    if(instruction.passing==='Directos')factor+=(p.fisico+p.ritmo-130)*.00015;
    if(instruction.risk==='Arriesgado')factor+=(p.pase+p.regate-130)*.0002;
    if(instruction.marking==='Individual')factor+=(p.defensa+p.fisico-130)*.00015;
    return bound(factor,.90,1.06);
  }
  function teamMatchModifiers(t=GameState?.tactics) {
    if(!t)return {attack:1,defence:1,movement:1,stamina:1,foulRisk:1};
    const m=t===GameState?.tactics?GameState?.match:null,ids=m?.lineups?.[m.userSide] || t.xi || [];
    const members=ids.filter(id=>!m?.red?.includes(id)&&!m?.injured?.includes(id)).map(playerAt).filter(Boolean);
    const denominator=Math.max(1,members.length);
    const count=(key,value)=>members.filter(p=>instructionsFor(p.id,t)[key]===value).length/denominator;
    const practice=(familiarity(t)-35)*.00035;
    return {
      attack:bound(1+practice+count('duty','Ataque')*.06-count('duty','Defensa')*.035+count('risk','Arriesgado')*.025-count('risk','Seguro')*.018,.94,1.11),
      defence:bound(1+practice+count('duty','Defensa')*.055-count('duty','Ataque')*.04+count('marking','Individual')*.015,.94,1.10),
      movement:bound(1+count('runs','Atacar espacios')*.06-count('runs','Venir a recibir')*.018,.97,1.07),
      stamina:bound(1+count('runs','Atacar espacios')*.07+count('marking','Individual')*.04-count('duty','Defensa')*.025,.96,1.12),
      foulRisk:bound(1+count('tackling','Fuerte')*.20-count('tackling','Suave')*.15+count('marking','Individual')*.03,.85,1.23)
    };
  }
  function lineupArray(t=GameState.tactics) {return [...Array.from({length:11},(_,index)=>t.xi?.[index]??null),...Array.from({length:7},(_,index)=>t.bench?.[index]??null)]}
  function permittedAt(p,index) {return eligible(p)&&(index>=11||(index===0?p.posicion==='POR':p.posicion!=='POR'))}
  function commitLineup(all) {
    const ids=all.filter(id=>id!=null);
    if(new Set(ids).size!==ids.length)return false;
    const limit=(window.FM_REGISTRATION?FM_REGISTRATION.profile(GameState.userClub.id).foreignMatch:window.WORLD_ENGINE.foreignLimit()),foreign=ids.filter(id=>window.WORLD_ENGINE.isForeign(playerAt(id))).length;
    if(foreign>limit){toast(`La convocatoria supera el límite de ${limit} extranjeros.`);return false}
    GameState.tactics.xi=all.slice(0,11);GameState.tactics.bench=all.slice(11,18);ui.moveSource=null;ui.alternative=null;WORLD_STORAGE.scheduleSave();return true;
  }
  function swapSlots(from,to) {
    if(!active()||live()){if(active())toast('Durante el partido, cambiá jugadores desde el banco de suplentes.');return false}
    from=Number(from);to=Number(to);if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||from>17||to<0||to>17||from===to)return false;
    const all=lineupArray(),a=playerAt(all[from]),b=playerAt(all[to]);
    if(a&&!permittedAt(a,to)||b&&!permittedAt(b,from)){toast('El arquero ocupa el primer puesto. Elegí jugadores disponibles para intercambiar.');return false}
    [all[from],all[to]]=[all[to],all[from]];const result=commitLineup(all);if(result)ui.selectedSlot=to;return result;
  }
  function assignSlot(index,id) {
    if(!active()||live()){if(active())toast('La convocatoria se prepara antes del partido.');return false}
    index=Number(index);id=Number(id);if(!Number.isInteger(index)||index<0||index>17)return false;
    const p=playerAt(id);if(!permittedAt(p,index)){toast(index===0?'El primer puesto necesita un arquero disponible.':'Elegí un jugador disponible y apto para ese puesto.');return false}
    const all=lineupArray(),previous=playerAt(all[index]),other=all.indexOf(id);
    if(other===index)return true;
    if(other>=0){
      if(previous&&permittedAt(previous,other))all[other]=previous.id;
      else {
        const used=new Set(all.filter(value=>value!==all[index]&&value!==id));used.add(id);
        const replacement=mine().filter(candidate=>permittedAt(candidate,other)&&!used.has(candidate.id)).sort((a,b)=>selectionScore(b,other)-selectionScore(a,other))[0];
        all[other]=replacement?.id??null;
      }
    }
    all[index]=id;const result=commitLineup(all);if(result)ui.selectedSlot=index;return result;
  }
  function selectionScore(p,index,t=GameState.tactics) {
    if(index>=11)return overall(p)*(.65+p.condicion_fisica*.0035);
    const slot=slots(t.formation)[index],role=roleFor(p,t,slot);
    return overall(p)*.50+roleFit(p,role,slot)*.30+positionFit(p,slot)*.12+p.condicion_fisica*.08;
  }
  function selectLineup(t=GameState.tactics,preferred=[]) {
    const pool=mine().filter(eligible),chosen=[],limit=(window.FM_REGISTRATION?FM_REGISTRATION.profile(GameState.userClub.id).foreignMatch:window.WORLD_ENGINE.foreignLimit());let foreign=0;
    const canSelect=(p,index)=>!chosen.includes(p.id)&&permittedAt(p,index)&&(!window.WORLD_ENGINE.isForeign(p)||foreign<limit);
    for(let index=0;index<18;index++){
      const wanted=pool.find(p=>p.id===preferred[index]&&canSelect(p,index));
      const options=pool.filter(p=>canSelect(p,index)).sort((a,b)=>selectionScore(b,index,t)-selectionScore(a,index,t));
      // Reserve one goalkeeper on the bench whenever the registered squad has two.
      const reserve=index===11?options.find(p=>p.posicion==='POR'):null;
      const selected=wanted || reserve || options[0];
      chosen.push(selected?.id??null);if(selected&&window.WORLD_ENGINE.isForeign(selected))foreign++;
    }return chosen;
  }
  function autoSelect() {
    if(!active()||live())return false;
    const t=ensure(),all=selectLineup(t);return commitLineup(all);
  }
  function validateLineup() {
    if(!active())return {valid:true,issues:[]};
    const all=lineupArray(),issues=[];
    if(all.slice(0,11).some(id=>id==null))issues.push('Completá los once titulares.');
    if(all.slice(11).some(id=>id==null))issues.push('Completá los siete suplentes.');
    if(new Set(all.filter(id=>id!=null)).size!==all.filter(id=>id!=null).length)issues.push('Un jugador está asignado más de una vez.');
    if(playerAt(all[0])?.posicion!=='POR'||all.slice(1,11).some(id=>playerAt(id)?.posicion==='POR'))issues.push('El once necesita un arquero en el primer puesto y diez jugadores de campo.');
    const registrationReason=window.FM_REGISTRATION?.lineupReason(all.filter(id=>id!=null));if(registrationReason)issues.push(registrationReason);
    const missing=all.filter(id=>id!=null&&!eligible(playerAt(id)));if(missing.length)issues.push(`${missing.length} convocado${missing.length===1?' no está':'s no están'} disponible${missing.length===1?'':'s'}.`);
    const limit=(window.FM_REGISTRATION?FM_REGISTRATION.profile(GameState.userClub.id).foreignMatch:window.WORLD_ENGINE.foreignLimit());if(all.filter(id=>id!=null&&window.WORLD_ENGINE.isForeign(playerAt(id))).length>limit)issues.push(`La convocatoria supera el cupo de ${limit} extranjeros.`);
    return {valid:issues.length===0,issues};
  }
  const TEAM_FIELDS=['formation','style','mentality','tempo','width','line','pressing','captain','penaltyTaker'];
  function snapshot(t) {
    const ids=lineupArray(t).filter(id=>id!=null);
    const result=Object.fromEntries(TEAM_FIELDS.map(key=>[key,t[key]??(key==='mentality'?'Equilibrada':['tempo','width','line','pressing'].includes(key)?50:null)]));
    result.xi=[...t.xi];result.bench=[...t.bench];result.roles=Object.fromEntries(ids.filter(id=>t.roles[id]).map(id=>[id,t.roles[id]]));
    result.instructions=Object.fromEntries(ids.filter(id=>t.instructions[id]).map(id=>[id,instructionsFor(id,t)]));result.phases=copy(phasePlan(t));
    result.setPieces=setPiecePlan(t);delete result.setPieces.familiarity;return result;
  }
  function savePlan(name) {
    const t=ensure();if(!t||live())return null;
    const cleaned=String(name||'').trim().slice(0,40);if(!cleaned){toast('Dale un nombre al plan.');return null}
    if(t.savedPlans.length>=5){toast('Podés guardar hasta cinco planes. Eliminá uno para agregar otro.');return null}
    const id=`plan-${t.nextPlanId++}`;t.savedPlans.push({id,name:cleaned,...snapshot(t),savedDate:GameState.today});saveGame(true);toast(`Plan «${cleaned}» guardado.`);return id;
  }
  function loadPlan(id) {
    const t=ensure();if(!t||live())return false;
    const plan=t.savedPlans.find(item=>item.id===String(id));if(!plan)return false;
    const candidate={...t,...Object.fromEntries(TEAM_FIELDS.map(key=>[key,plan[key]??t[key]])),roles:copy(plan.roles||{}),instructions:copy(plan.instructions||{}),phases:phasePlan(plan),setPieces:{...copy(plan.setPieces||{}),familiarity:t.setPieces.familiarity}};
    candidate.formation=plan.formation;candidate.style=STYLES.includes(plan.style)?plan.style:t.style;
    for(const key of ['tempo','width','line','pressing'])candidate[key]=bound(candidate[key],10,90);
    candidate.mentality=['Cauta','Equilibrada','Ofensiva','Positiva'].includes(candidate.mentality)?candidate.mentality:'Equilibrada';
    const preferred=lineupArray(plan),all=selectLineup(candidate,preferred),replacements=all.filter((value,index)=>value!==preferred[index]).length;
    for(const key of TEAM_FIELDS)t[key]=candidate[key];t.roles=candidate.roles;t.instructions=candidate.instructions;t.phases=candidate.phases;t.setPieces=candidate.setPieces;
    for(const key of ['captain','penaltyTaker'])if(!owned(playerAt(t[key])))t[key]=all.find(value=>value!=null)??null;
    if(!commitLineup(all))return false;
    ensure();toast(`Plan «${String(plan.name||'Plan').slice(0,40)}» cargado.${replacements?` Se reemplazaron ${replacements} puestos sin disponibilidad.`:''}`);return true;
  }
  function renamePlan(id,name) {
    const t=ensure();if(!t||live())return false;
    const plan=t.savedPlans.find(item=>item.id===String(id)),cleaned=String(name||'').trim().slice(0,40);
    if(!plan||!cleaned){toast('Ingresá un nombre para el plan.');return false}
    plan.name=cleaned;ui.renameId=null;WORLD_STORAGE.scheduleSave();return true;
  }
  function deletePlan(id) {
    const t=ensure();if(!t||live())return false;
    const old=t.savedPlans.length;t.savedPlans=t.savedPlans.filter(plan=>plan.id!==String(id));if(old===t.savedPlans.length)return false;
    if(ui.renameId===id)ui.renameId=null;WORLD_STORAGE.scheduleSave();return true;
  }
  function setInstruction(id,key,value) {
    const t=ensure(),p=playerAt(id),spec=Object.hasOwn(INSTRUCTIONS,key)?INSTRUCTIONS[key]:null;if(!t||!owned(p)||!spec||!spec.values.includes(value))return false;
    t.instructions[p.id]={...instructionsFor(p.id,t),[key]:value};WORLD_STORAGE.scheduleSave();return true;
  }
  function recommendations(index=ui.selectedSlot) {
    if(!active())return [];
    index=Number(index);return mine().filter(p=>permittedAt(p,index)).sort((a,b)=>selectionScore(b,index)-selectionScore(a,index)).slice(0,6);
  }
  function badgeFor(p,slot) {
    if(!p)return '<span class="tw-fit bad">Sin asignar</span>';
    if(!eligible(p))return `<span class="tw-fit bad">${p.injury?'Lesionado':p.registered===false?'Sin inscribir':'Suspendido'}</span>`;
    const fit=positionFit(p,slot);return `<span class="tw-fit ${fit===100?'good':fit>=60?'partial':'bad'}">${fit===100?'Natural':fit>=60?'Adaptable':'Fuera de posición'}</span>`;
  }
  function selectOptions(values,selected) {return values.map(value=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(value)}</option>`).join('')}
  function slotButton(index,layout=null) {
    const t=GameState.tactics,id=lineupArray(t)[index],p=playerAt(id),slot=index<11?slots(t.formation)[index]:'SUP',fit=index<11?positionFit(p,slot):100;
    const name=p?p.nombre.split(' ').slice(-2).join(' '):'Sin asignar',label=p?`${index<11?POSITION_LABELS[slot]:`Suplente ${index-10}`}: ${p.nombre}, ${Math.round(p.condicion_fisica)}% de condición`:`${index<11?POSITION_LABELS[slot]:`Suplente ${index-10}`}, sin asignar`;
    return `<button type="button" class="tw-player-chip ${index<11?'tw-pitch-chip':'tw-bench-chip'} ${ui.selectedSlot===index?'selected':''} ${ui.moveSource===index?'moving':''} ${p&&!eligible(p)||fit<60?'warning':''}" data-tw-slot="${index}" draggable="${!live()&&Boolean(p)}" aria-label="${esc(label)}${live()?'':'. Seleccionar para intercambiar'}" aria-pressed="${ui.moveSource===index}" ${layout?`style="left:${layout[1]}%;top:${layout[2]}%"`:''}><span class="tw-shirt">${p?.shirtNumber || (index+1)}${p&&index<11?`<i class="tw-position-dot ${fit===100?'good':fit>=60?'partial':'bad'}"></i>`:''}</span><strong>${esc(name)}</strong><span class="tw-chip-detail">${slot} · ${p?`${Math.round(p.condicion_fisica)}%`:'—'}</span></button>`;
  }
  function pitchView() {
    const t=GameState.tactics;
    return `<section class="card tw-pitch-card"><div class="fm-panel-title"><h2>${esc(t.formation)}</h2><span class="badge">${esc(t.style)}</span></div><div class="tw-pitch" aria-label="Cancha táctica, once titular"><svg viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true"><rect x="3" y="3" width="94" height="114" fill="none"/><path d="M3 60H97M32 3V22H68V3M39 3V11H61V3M32 117V98H68V117M39 117V109H61V117"/><circle cx="50" cy="60" r="12"/><circle cx="50" cy="60" r=".6" fill="currentColor"/><path d="M41 22a11 11 0 0 0 18 0M41 98a11 11 0 0 1 18 0"/></svg>${formationLayout(t.formation).map((layout,index)=>slotButton(index,layout)).join('')}</div><div class="tw-interaction-note" aria-live="polite">${live()?'Partido en curso: ajustá las instrucciones. Los cambios se realizan desde la pantalla del partido.':ui.moveSource!=null?`Seleccionaste ${esc(playerAt(lineupArray()[ui.moveSource])?.nombre || 'un puesto vacío')}. Elegí el destino para intercambiar. <button data-tw-cancel>Cancelar</button>`:'Arrastrá un jugador o seleccioná origen y destino. Con teclado: Enter para seleccionar, flechas para recorrer, Escape para cancelar.'}</div><div class="tw-fit-legend"><span><i class="good"></i>Natural</span><span><i class="partial"></i>Adaptable</span><span><i class="bad"></i>Fuera de posición</span></div><div class="tw-bench-title">Banco de suplentes <span>7 puestos</span></div><div class="tw-bench">${Array.from({length:7},(_,index)=>slotButton(index+11)).join('')}</div></section>`;
  }
  function teamOptions() {
    const t=GameState.tactics,value=familiarity(t),limit=(window.FM_REGISTRATION?FM_REGISTRATION.profile(GameState.userClub.id).foreignMatch:window.WORLD_ENGINE.foreignLimit());
    const foreign=lineupArray(t).filter(id=>id!=null&&window.WORLD_ENGINE.isForeign(playerAt(id))).length;
    return `<section class="card tw-team-options"><h2>Instrucciones del equipo</h2><label class="field">Formación<select data-tw-team="formation" ${live()?'disabled':''}>${selectOptions(Object.keys(FORMATIONS),t.formation)}</select></label><label class="field">Estilo<select data-tw-team="style">${selectOptions(STYLES,t.style)}</select></label><label class="field">Mentalidad<select data-tw-team="mentality">${selectOptions(['Cauta','Equilibrada','Ofensiva'],t.mentality || 'Equilibrada')}</select></label>${[['tempo','Ritmo'],['width','Amplitud'],['line','Línea defensiva'],['pressing','Presión']].map(([key,label])=>`<div class="tw-slider"><div><label for="tw-${key}">${label}</label><output id="tw-${key}-value">${t[key]??50}%</output></div><input id="tw-${key}" type="range" min="10" max="90" step="10" value="${t[key]??50}" data-tw-team="${key}"></div>`).join('')}<div class="tw-familiarity"><div><strong>Familiaridad táctica</strong><span data-tw-familiarity>${Math.round(value)}%</span></div><div class="tw-progress"><i style="width:${value}%"></i></div><p>${value<50?'El equipo está aprendiendo este planteo.':value<80?'Los movimientos empiezan a salir con fluidez.':'El equipo domina este planteo.'} Aumenta con el entrenamiento al avanzar las jornadas.</p></div><label class="field">Capitán<select data-tw-team="captain" ${live()?'disabled':''}>${mine().map(p=>`<option value="${p.id}" ${p.id===t.captain?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></label><label class="field">Penales<select data-tw-team="penaltyTaker" ${live()?'disabled':''}>${mine().filter(p=>p.posicion!=='POR').map(p=>`<option value="${p.id}" ${p.id===t.penaltyTaker?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></label><div class="tw-quota">${limit>=32?'Inscripción extranjera libre':`${foreign} de ${limit} cupos extranjeros en la convocatoria`}</div></section>`;
  }
  function assessment(t=GameState?.tactics) {
    if(!t)return [];
    const plan=matchPlan(t),members=(t.xi||[]).map(playerAt).filter(Boolean),notes=[];
    const average=key=>members.length?members.reduce((sum,p)=>sum+(Number(p[key])||0),0)/members.length:65;
    if(plan.inPossession.buildUp==='Corta'&&average('pase')<66)notes.push({level:'warning',text:'La salida corta exige pases precisos. Tu once está por debajo de 66 de promedio en pase; el rival puede recuperar cerca del área.'});
    if(plan.outOfPossession.block==='Alto'&&plan.transition.onLoss==='Contrapresión')notes.push({level:average('condicion_fisica')<78?'warning':'info',text:`Bloque alto y contrapresión demandan piernas. Condición media del once: ${Math.round(average('condicion_fisica'))}%. Prepará recambios.`});
    if(plan.inPossession.finalThird==='Centros'&&plan.inPossession.crosses==='Aéreos'){
      const forward=members.filter(p=>p.posicion==='DEL').sort((a,b)=>b.fisico-a.fisico)[0];
      if(forward)notes.push({level:forward.fisico<65?'warning':'info',text:`Los centros aéreos buscan el duelo físico. ${forward.nombre} es tu atacante más fuerte (${forward.fisico}/99).`});
    }
    if(plan.transition.onWin==='Contraatacar'&&average('ritmo')<65)notes.push({level:'warning',text:'El contraataque necesita velocidad y apoyos cercanos. Este once puede sufrir para ganar metros después de recuperar.'});
    if(plan.outOfPossession.marking==='Individual')notes.push({level:'info',text:'Las marcas individuales aumentan el seguimiento, el esfuerzo y las faltas. Revisá quién queda libre cuando el rival intercambia posiciones.'});
    const attacking=members.filter(p=>instructionsFor(p.id,t).duty==='Ataque').length;
    if(attacking>=6)notes.push({level:'warning',text:`Hay ${attacking} jugadores con deber de ataque. Podés perder cobertura al quedar por delante de la pelota.`});
    if(!notes.length)notes.push({level:'info',text:'El plan mantiene un reparto equilibrado de riesgos. La calidad de pase, el ritmo, los roles y la respuesta rival decidirán su eficacia.'});
    return notes.slice(0,3);
  }
  function phaseSummary(t=GameState?.tactics) {
    const p=matchPlan(t);return `Salida ${p.inPossession.buildUp.toLocaleLowerCase('es')} · ${p.inPossession.progression==='Mixta'?'progresión mixta':`por ${p.inPossession.progression.toLocaleLowerCase('es')}`} · bloque ${p.outOfPossession.block.toLocaleLowerCase('es')} · ${p.transition.onWin==='Equilibrada'?'transición equilibrada':p.transition.onWin.toLocaleLowerCase('es')}`;
  }
  function phaseFields(phase,t=GameState?.tactics) {
    const plan=phasePlan(t),spec=Object.hasOwn(PHASES,phase)?PHASES[phase]:null;if(!spec)return '';
    return Object.entries(spec.fields).map(([key,field])=>`<label class="field">${esc(field.label)}<select data-tw-phase="${phase}" data-tw-phase-field="${key}">${selectOptions(field.values,plan[phase][key])}</select></label>`).join('');
  }
  function phasesView() {
    const selected=Object.hasOwn(PHASES,ui.phase)||ui.phase==='assessment'?ui.phase:'inPossession',spec=PHASES[selected]||PHASES.inPossession;
    return `<section class="card tw-phases"><div class="fm-panel-title"><div><h2>Plan por fases</h2><p class="small muted">${esc(phaseSummary())}</p></div><span class="badge">${live()?'Ajuste en vivo':'Identidad colectiva'}</span></div><nav class="tw-phase-tabs" aria-label="Fases del juego">${Object.entries(PHASES).map(([key,p])=>`<button data-tw-phase-tab="${key}" aria-selected="${selected===key}" class="${selected===key?'selected':''}">${esc(p.label)}</button>`).join('')}<button data-tw-phase-tab="assessment" aria-selected="${selected==='assessment'}" class="${selected==='assessment'?'selected':''}">Lectura</button></nav><div class="tw-phase-body ${selected==='assessment'?'tw-phase-assessment':''}"><div class="tw-phase-main"><h3>${esc(spec.label)}</h3><p class="small muted">${esc(spec.description)}</p><div class="tw-phase-fields">${phaseFields(selected)}</div><div class="tw-phase-impact"><strong>Qué cambia en el partido</strong><p>${selected==='inPossession'?'La salida corta prioriza apoyos y pases; la directa saltea líneas. Elaborar reduce apuros y mejora la selección del remate. Los centros dependen del ejecutante, los receptores y la marca rival.':selected==='outOfPossession'?'El bloque alto acerca la recuperación al arco rival y expone la espalda. El bloque bajo protege el área y cede terreno. Orientar la presión modifica por dónde puede progresar el rival.':'La contrapresión busca recuperar de inmediato y consume más energía. Reagrupar protege la estructura. Contraatacar acelera la progresión; conservar ofrece apoyos y sostiene la posesión.'}</p></div></div><aside class="tw-phase-advice"><h3>Lectura del cuerpo técnico</h3>${assessment().map(note=>`<p class="tw-tactical-note ${note.level}">${esc(note.text)}</p>`).join('')}<div class="tw-phase-familiarity"><span>Familiaridad con el plan</span><strong>${Math.round(familiarity())}%</strong></div><div class="tw-progress"><i style="width:${familiarity()}%"></i></div><p class="small muted">Cambiar el plan necesita entrenamiento. Las decisiones siguen disponibles durante el partido.</p></aside></div></section>`;
  }
  function setPieceSelect(key,label,selected,players,optional=true) {
    return `<label class="field">${esc(label)}<select data-tw-set-piece="${key}">${optional?'<option value="">Sin función fija</option>':''}${players.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.nombre)} · ${key.includes('Taker')?p.pase+' pase / '+p.tiro+' tiro':p.fisico+' físico'}</option>`).join('')}</select></label>`;
  }
  function setPiecesView() {
    const routine=setPiecePlan(),members=mine().filter(p=>p.posicion!=='POR').sort((a,b)=>b.pase-a.pase),tab=['attack','roles','defence'].includes(ui.setPieceTab)?ui.setPieceTab:'attack';
    return `<section class="card tw-set-pieces"><div class="fm-panel-title"><div><h2>Pelota parada preparada</h2><p class="small muted">Rutinas ensayadas, ejecutantes y cobertura de la segunda pelota.</p></div><span class="badge">${Math.round(routine.familiarity)}% ensayado</span></div><nav class="tw-phase-tabs" aria-label="Pelota parada">${[['attack','Ejecución'],['roles','Movimientos'],['defence','Defensa y ensayo']].map(([key,label])=>`<button data-tw-set-tab="${key}" aria-selected="${tab===key}" class="${tab===key?'selected':''}">${label}</button>`).join('')}</nav><div class="tw-set-body">${tab==='attack'?`<div class="tw-phase-fields">${['corner','freeKick'].map(key=>`<label class="field">${SET_PIECES[key].label}<select data-tw-set-piece="${key}">${selectOptions(SET_PIECES[key].values,routine[key])}</select></label>`).join('')}${setPieceSelect('cornerTaker','Ejecutante de córners',routine.cornerTaker,members,false)}${setPieceSelect('freeKickTaker','Ejecutante de tiros libres',routine.freeKickTaker,[...members].sort((a,b)=>b.tiro-a.tiro),false)}</div><p class="tw-tactical-note">La precisión del ejecutante, el duelo del receptor, la marca y el ensayo determinan la ocasión. Si un especialista no está en cancha, ejecuta el compañero disponible más apto.</p>`:tab==='roles'?`<div class="tw-phase-fields">${[['nearPost','Atacar primer palo'],['farPost','Atacar segundo palo'],['edgeOfArea','Esperar rebote'],['stayBack','Cubrir el contraataque']].map(([key,label])=>setPieceSelect(key,label,routine[key],members)).join('')}</div><p class="tw-tactical-note">Cada jugador ocupa una sola función preparada. El ejecutante no puede ser el receptor de su propio envío; el motor elige una alternativa disponible cuando hace falta.</p>`:`<div class="tw-phase-fields">${['defending','practice'].map(key=>`<label class="field">${SET_PIECES[key].label}<select data-tw-set-piece="${key}">${selectOptions(SET_PIECES[key].values,routine[key])}</select></label>`).join('')}</div><div class="tw-set-familiarity"><strong>Rutina: ${Math.round(routine.familiarity)}% de familiaridad</strong><div class="tw-progress"><i style="width:${routine.familiarity}%"></i></div><p class="small muted">El ensayo se realiza al entrenar. Priorizar esta rutina acelera su aprendizaje y reserva menos tiempo para la familiaridad del plan colectivo. El ensayo mínimo hace lo contrario. Al cambiar el destino del córner, el tiro libre o la marca, el equipo necesita practicar esa nueva variante.</p></div><p class="tw-tactical-note">Zonal protege espacios, individual sigue rivales y mixta combina ambas. Los rechaces y los contragolpes dependen también de la cobertura que dejaste.</p>`}</div></section>`;
  }
  function inspector() {
    const t=GameState.tactics,index=ui.selectedSlot,id=lineupArray(t)[index],p=playerAt(id),slot=index<11?slots(t.formation)[index]:(p?naturalPositions(p)[0]:'MC');
    const choices=mine().filter(candidate=>permittedAt(candidate,index)).sort((a,b)=>selectionScore(b,index)-selectionScore(a,index));
    const role=roleFor(p,t,slot),instruction=instructionsFor(id,t),candidate=playerAt(ui.alternative);
    const candidates=recommendations(index).filter(item=>item.id!==id),alternate=candidate&&candidates.some(item=>item.id===candidate.id)?candidate:candidates[0];
    return `<section class="card tw-inspector"><div class="fm-kicker">${index<11?`Titular ${index+1} · ${esc(POSITION_LABELS[slot])}`:`Suplente ${index-10}`}</div><h2>${p?esc(p.nombre):'Puesto sin asignar'}</h2>${p?`<div class="tw-player-meta"><span>${p.edad} años · ${esc(p.posicion)}</span><button class="fm-text-button" data-player="${p.id}">Ver ficha</button></div>${index<11?badgeFor(p,slot):''}<div class="tw-player-readiness"><span>Condición <strong class="${p.condicion_fisica<65?'red':''}">${Math.round(p.condicion_fisica)}%</strong></span><span>Media <strong>${overall(p)}</strong></span></div>`:'<p class="muted">Seleccioná un jugador disponible para este puesto.</p>'}<label class="field">Asignar jugador<select data-tw-assign="${index}" ${live()?'disabled':''}><option value="" ${!id?'selected':''}>Elegí un jugador</option>${choices.map(item=>`<option value="${item.id}" ${item.id===id?'selected':''}>${esc(item.nombre)} · ${item.posicion} · ${Math.round(item.condicion_fisica)}%</option>`).join('')}</select></label>${p?`<label class="field">Rol<select data-tw-role="${p.id}" data-tw-role-slot="${esc(slot)}">${selectOptions(rolesFor(slot),role)}</select></label><div class="tw-role-fit"><span>Aptitud para el rol</span><strong>${roleFit(p,role,slot)} / 100</strong></div><div class="tw-progress"><i style="width:${roleFit(p,role,slot)}%"></i></div><div class="tw-individual-title">Instrucciones individuales</div><div class="tw-individual-fields">${Object.entries(INSTRUCTIONS).map(([key,spec])=>`<label class="field">${esc(spec.label)}<select data-tw-instruction="${key}" data-tw-player="${p.id}">${selectOptions(spec.values,instruction[key])}</select></label>`).join('')}${p.posicion!=='POR'?`<label class="field tw-marking-target">Rival a seguir<select data-tw-mark-target="${p.id}"><option value="">Sin referencia fija</option>${markingOpponents().map(target=>`<option value="${target.id}" ${instruction.markingTarget===target.id?'selected':''}>${esc(target.nombre)} · ${target.posicion}</option>`).join('')}</select></label>`:''}</div>`:''}<div class="tw-alternatives"><h3>Comparar alternativas</h3>${alternate?`<label class="field">Alternativa para este puesto<select data-tw-compare>${candidates.map(item=>`<option value="${item.id}" ${item.id===alternate.id?'selected':''}>${esc(item.nombre)}</option>`).join('')}</select></label><div class="tw-comparison"><div><span>Jugador</span><strong>${p?esc(p.nombre.split(' ').slice(-1).join(' ')):'Actual'}</strong><strong>${esc(alternate.nombre.split(' ').slice(-1).join(' '))}</strong></div>${[['Calidad',p?overall(p):0,overall(alternate)],['Condición',p?Math.round(p.condicion_fisica):0,Math.round(alternate.condicion_fisica)],['Aptitud de rol',p?roleFit(p,role,slot):0,roleFit(alternate,role,slot)],['Posición',p?positionFit(p,slot):0,positionFit(alternate,slot)]].map(([label,a,b])=>`<div><span>${label}</span><b>${a || '—'}</b><b class="${b>a?'green':''}">${b}</b></div>`).join('')}</div><button class="tw-use-alternative" data-tw-use="${alternate.id}" ${live()?'disabled':''}>Asignar a ${esc(alternate.nombre)}</button>`:'<p class="small muted">No hay otra alternativa disponible para este puesto.</p>'}</div></section>`;
  }
  function plansView() {
    const t=GameState.tactics;
    return `<section class="card tw-plans"><div class="fm-panel-title"><div><h2>Planes de partido</h2><p class="small muted">Guardá formación, convocatoria, roles e instrucciones. Los jugadores ausentes se reemplazan al cargar.</p></div><span class="badge">${t.savedPlans.length} / 5</span></div><div class="tw-save-plan"><label class="field">Nombre del nuevo plan<input data-tw-plan-name maxlength="40" placeholder="Por ejemplo: presión en casa" ${live()?'disabled':''}></label><button data-tw-save ${live()||t.savedPlans.length>=5?'disabled':''}>Guardar plan actual</button></div><div class="tw-plan-list">${t.savedPlans.map(plan=>`<article><div><strong>${esc(String(plan.name || 'Plan').slice(0,40))}</strong><span>${esc(plan.formation)} · ${esc(plan.style || 'Gegenpress')}</span></div><div class="tw-plan-actions"><button data-tw-load="${esc(plan.id)}" ${live()?'disabled':''}>Cargar</button><button data-tw-rename="${esc(plan.id)}" ${live()?'disabled':''} aria-label="Renombrar ${esc(String(plan.name || 'Plan').slice(0,40))}">Renombrar</button><button data-tw-delete="${esc(plan.id)}" ${live()?'disabled':''} aria-label="Eliminar ${esc(String(plan.name || 'Plan').slice(0,40))}">Eliminar</button></div>${ui.renameId===plan.id?`<form class="tw-rename-form" data-tw-rename-form="${esc(plan.id)}"><label class="field">Nuevo nombre<input name="planName" maxlength="40" value="${esc(String(plan.name || '').slice(0,40))}" required></label><button type="submit">Confirmar nombre</button><button type="button" data-tw-rename-cancel>Cancelar</button></form>`:''}</article>`).join('') || '<p class="small muted tw-no-plans">Todavía no guardaste un plan. Prepará variantes para proteger una ventaja o buscar el partido.</p>'}</div></section>`;
  }
  function squadView() {
    const t=GameState.tactics,all=lineupArray(t),members=mine().sort((a,b)=>['POR','DEF','MED','DEL'].indexOf(a.posicion)-['POR','DEF','MED','DEL'].indexOf(b.posicion)||overall(b)-overall(a));
    return `<section class="card tw-reserves"><div class="fm-panel-title"><h2>Plantel disponible</h2><span class="small muted">Asignación rápida al puesto seleccionado</span></div><div class="scroll"><table><thead><tr><th>Jugador</th><th>Posición natural</th><th>Condición</th><th>Convocatoria</th><th>Acción</th></tr></thead><tbody>${members.map(p=>{const index=all.indexOf(p.id),state=p.registered===false?'Sin inscribir':p.injury?`${p.injury} días de lesión`:!available(p)?'Suspendido':index<0?'Fuera de convocatoria':index<11?'Titular':'Suplente';return `<tr class="${index===ui.selectedSlot?'tw-selected-row':''}"><td><button class="fm-player-link" data-player="${p.id}">${esc(p.nombre)}</button><span class="fm-player-sub">${p.edad} años · Media ${overall(p)}</span></td><td>${esc(naturalPositions(p).join(' / '))}</td><td><span class="${p.condicion_fisica<65?'red':'green'}">${Math.round(p.condicion_fisica)}%</span></td><td><span class="tw-fit ${eligible(p)?index<0?'partial':'good':'bad'}">${esc(state)}</span></td><td><button data-tw-use="${p.id}" ${live()||!permittedAt(p,ui.selectedSlot)?'disabled':''}>${index===ui.selectedSlot?'Asignado':'Asignar'}</button></td></tr>`}).join('')}</tbody></table></div></section>`;
  }
  function renderWorkbench() {
    if(!active())return oldTactics();ensure();ui.selectedSlot=Math.round(bound(ui.selectedSlot,0,17));
    const check=validateLineup();
    return `<div class="fm-page-intro"><div><div class="fm-kicker">Cuerpo técnico</div><h2>Laboratorio táctico</h2><p>Prepará el equipo, compará alternativas y entrená tu identidad de juego.</p></div><button data-tw-auto ${live()?'disabled':''}>Elegir mejor equipo</button></div>${!check.valid&&!live()?`<div class="tw-lineup-warning" role="status">${check.issues.map(issue=>`<span>${esc(issue)}</span>`).join('')}</div>`:''}<div class="tw-workbench">${teamOptions()}${pitchView()}${inspector()}</div>${phasesView()}${setPiecesView()}${plansView()}${squadView()}`;
  }
  function repaint(focusSlot=null) {render();if(focusSlot!=null)document.querySelector(`[data-tw-slot="${focusSlot}"]`)?.focus()}
  function handleSlot(index) {
    if(live()){ui.selectedSlot=index;ui.moveSource=null;ui.alternative=null;repaint(index);return}
    if(ui.moveSource==null){ui.moveSource=index;ui.selectedSlot=index;ui.alternative=null}
    else if(ui.moveSource===index){ui.moveSource=null}
    else {const from=ui.moveSource;if(!swapSlots(from,index))ui.moveSource=null;ui.selectedSlot=index;ui.alternative=null}
    repaint(index);
  }
  tactics=function(){return active()?renderWorkbench():oldTactics()};
  document.addEventListener('click',event=>{
    if(!active())return;
    const node=event.target.closest('[data-tw-slot],[data-tw-cancel],[data-tw-auto],[data-tw-use],[data-tw-save],[data-tw-load],[data-tw-rename],[data-tw-delete],[data-tw-rename-cancel],[data-tw-phase-tab],[data-tw-set-tab]');if(!node)return;
    event.preventDefault();event.stopImmediatePropagation();if(node.disabled)return;
    if(node.hasAttribute('data-tw-phase-tab')){if(Object.hasOwn(PHASES,node.dataset.twPhaseTab)||node.dataset.twPhaseTab==='assessment')ui.phase=node.dataset.twPhaseTab;return repaint()}
    if(node.hasAttribute('data-tw-set-tab')){if(['attack','roles','defence'].includes(node.dataset.twSetTab))ui.setPieceTab=node.dataset.twSetTab;return repaint()}
    if(node.hasAttribute('data-tw-slot'))return handleSlot(Number(node.dataset.twSlot));
    if(node.hasAttribute('data-tw-cancel')){ui.moveSource=null;return repaint(ui.selectedSlot)}
    if(node.hasAttribute('data-tw-auto')){if(autoSelect())toast('Convocatoria elegida según posición, rol y condición.');return repaint()}
    if(node.hasAttribute('data-tw-use')){assignSlot(ui.selectedSlot,Number(node.dataset.twUse));return repaint()}
    if(node.hasAttribute('data-tw-save')){const input=document.querySelector('[data-tw-plan-name]');savePlan(input?.value);return repaint()}
    if(node.hasAttribute('data-tw-load')){loadPlan(node.dataset.twLoad);return repaint()}
    if(node.hasAttribute('data-tw-delete')){deletePlan(node.dataset.twDelete);return repaint()}
    if(node.hasAttribute('data-tw-rename')){if(!live())ui.renameId=node.dataset.twRename;repaint();document.querySelector('[data-tw-rename-form] input')?.focus();return}
    if(node.hasAttribute('data-tw-rename-cancel')){ui.renameId=null;return repaint()}
  },true);
  document.addEventListener('change',event=>{
    if(!active())return;
    const node=event.target;
    if(node.hasAttribute('data-tw-phase')){event.stopImmediatePropagation();setPhase(node.dataset.twPhase,node.dataset.twPhaseField,node.value);return repaint()}
    if(node.hasAttribute('data-tw-set-piece')){event.stopImmediatePropagation();setPiece(node.dataset.twSetPiece,node.value);return repaint()}
    if(node.hasAttribute('data-tw-mark-target')){event.stopImmediatePropagation();setMarkingTarget(Number(node.dataset.twMarkTarget),node.value);return repaint()}
    if(node.hasAttribute('data-tw-assign')){event.stopImmediatePropagation();assignSlot(Number(node.dataset.twAssign),Number(node.value));return repaint()}
    if(node.hasAttribute('data-tw-compare')){ui.alternative=Number(node.value);return repaint()}
    if(node.hasAttribute('data-tw-instruction')){setInstruction(Number(node.dataset.twPlayer),node.dataset.twInstruction,node.value);return repaint()}
    if(node.hasAttribute('data-tw-role')){
      const p=playerAt(node.dataset.twRole),slot=node.dataset.twRoleSlot;
      if(owned(p)&&rolesFor(slot).includes(node.value)){ensure().roles[p.id]=node.value;WORLD_STORAGE.scheduleSave();repaint()}return;
    }
    if(node.hasAttribute('data-tw-team')){
      const t=ensure(),key=node.dataset.twTeam,value=node.value;
      if(key==='formation'){
        if(live()||!validFormation(value))return;
        t.formation=value;autoSelect();
      }else if(key==='style'){if(!STYLES.includes(value))return;t.style=value}
      else if(key==='mentality'){if(!['Cauta','Equilibrada','Ofensiva'].includes(value))return;t.mentality=value}
      else if(['tempo','width','line','pressing'].includes(key))t[key]=bound(value,10,90);
      else if(['captain','penaltyTaker'].includes(key)){const p=playerAt(value);if(live()||!owned(p)||key==='penaltyTaker'&&p.posicion==='POR')return;t[key]=p.id}
      else return;
      ui.moveSource=null;WORLD_STORAGE.scheduleSave();return repaint();
    }
  },true);
  document.addEventListener('input',event=>{
    const node=event.target;if(!active()||!node.hasAttribute('data-tw-team')||node.type!=='range')return;
    const output=document.getElementById(`tw-${node.dataset.twTeam}-value`);if(output)output.textContent=`${node.value}%`;
  });
  document.addEventListener('submit',event=>{
    if(!active()||!event.target.hasAttribute('data-tw-rename-form'))return;
    event.preventDefault();event.stopImmediatePropagation();renamePlan(event.target.dataset.twRenameForm,new FormData(event.target).get('planName'));repaint();
  },true);
  document.addEventListener('keydown',event=>{
    if(!active())return;
    const node=event.target.closest('[data-tw-slot]');if(!node)return;
    const index=Number(node.dataset.twSlot);
    if(event.key==='Escape'){event.preventDefault();ui.moveSource=null;return repaint(index)}
    const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-1,ArrowDown:1}[event.key];
    if(offset){event.preventDefault();const next=(index+offset+18)%18;document.querySelector(`[data-tw-slot="${next}"]`)?.focus()}
  });
  document.addEventListener('dragstart',event=>{
    if(!active()||live())return;
    const node=event.target.closest('[data-tw-slot]');if(!node)return;
    const index=Number(node.dataset.twSlot);event.dataTransfer.setData('text/plain',`fm27-slot:${index}`);event.dataTransfer.effectAllowed='move';ui.moveSource=index;node.classList.add('moving');
  });
  document.addEventListener('dragover',event=>{
    if(!active()||live()||ui.moveSource==null)return;
    const node=event.target.closest('[data-tw-slot]');if(!node)return;event.preventDefault();event.dataTransfer.dropEffect='move';
  });
  document.addEventListener('drop',event=>{
    if(!active()||live())return;
    const node=event.target.closest('[data-tw-slot]');if(!node)return;
    const value=event.dataTransfer.getData('text/plain'),match=/^fm27-slot:(\d{1,2})$/.exec(value);if(!match)return;
    event.preventDefault();event.stopImmediatePropagation();const to=Number(node.dataset.twSlot);swapSlots(Number(match[1]),to);ui.moveSource=null;repaint(to);
  });
  document.addEventListener('dragend',()=>{if(active()){ui.moveSource=null;document.querySelectorAll('.tw-player-chip.moving').forEach(node=>node.classList.remove('moving'))}});
  window.FM_TACTICS={ensure,render:renderWorkbench,slots,formationLayout,naturalPositions,positionFit,roleFor,instructionsFor,playerMatchFactor,teamMatchModifiers,matchPlan,phaseModifiers,phaseSummary,assessment,phaseFields,phasesView,setPiecesView,setPhase,setPiece,setMarkingTarget,markingOpponents,trainFamiliarity,familiarity,recommendations,validateLineup,assignSlot,swapSlots,autoSelect,savePlan,loadPlan,renamePlan,deletePlan,setInstruction};
})();
