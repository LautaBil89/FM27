/* Possession sequences feed the result engine. Coordinates and diagnostics are records,
   rather than a second simulation of the same chance. */
window.FM_SIMULATION=(()=>{
  const bound=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
  const number=(n,f=50)=>Number.isFinite(Number(n))?Number(n):f;
  let actionModifiers=null,actionContexts=null,actionFactors=null;
  const active=(m,side)=>m.lineups[side].filter(id=>player(id)&&!m.red.includes(id)&&!m.injured.includes(id));
  const keeperId=(m,side)=>window.FM_MATCH_RULES?.keeperId(m,side)??active(m,side).find(id=>player(id).posicion==='POR');
  const attribute=(p,key)=>window.FM_ATTRIBUTES?.skill(p,key)??number(p?.[key]??p?.[({penales:'tiro',remate:'tiro',cabeceo:'tiro',balon_parado:'tiro'})[key]],55);
  const mean=(items,fn,f=55)=>items.length?items.reduce((n,p)=>n+fn(p),0)/items.length:f;
  function weighted(items,weight){if(!items.length)return null;let roll=Math.random()*items.reduce((n,p)=>n+Math.max(.01,weight(p)),0);for(const p of items){roll-=Math.max(.01,weight(p));if(roll<=0)return p}return items.at(-1)}
  const emptyPlayer=()=>({passes:0,completedPasses:0,received:0,dribbles:0,tackles:0,interceptions:0,touches:0});
  const emptyTeam=()=>({buildUps:0,finalThirdEntries:0,regains:0,counters:0,losses:0,setPieces:0,pressRecoveries:0,progressivePasses:0,crosses:0,completedCrosses:0});
  const basePlan=()=>({inPossession:{buildUp:'Mixta',progression:'Mixta',finalThird:'Equilibrado',crosses:'Mixtos'},outOfPossession:{block:'Medio',trap:'Equilibrada',marking:'Zonal'},transition:{onLoss:'Equilibrada',onWin:'Equilibrada',keeper:'Central'},setPieces:{corner:'Primer palo',freeKick:'Directo',defending:'Mixta',familiarity:35}});
  function plan(t){const d=basePlan(),p=window.FM_TACTICS?.matchPlan?.(t)||t||{};return Object.fromEntries(Object.entries(d).map(([key,value])=>[key,{...value,...p[key]}]))}
  const tactics=(m,side)=>side===m.userSide?GameState.tactics:m.aiTactics;
  const worldPoint=(m,side,progress,x=50)=>({x:Number(bound(x,3,97).toFixed(2)),y:Number(bound(side===m.userSide?100-progress:progress,3,97).toFixed(2))});
  const progressAt=(m,side,p)=>side===m.userSide?100-p.y:p.y;
  function ensure(m){
    m.simulation??={version:1,owner:null,carrier:null,progress:24,lateral:50,nextChain:1,chains:[],playerActions:{},teamMetrics:[emptyTeam(),emptyTeam()],positions:{},lastShot:null,snapshots:[],observations:[],aiDecisions:[]};
    const s=m.simulation;s.chains??=[];s.playerActions??={};s.teamMetrics??=[emptyTeam(),emptyTeam()];s.positions??={};s.snapshots??=[];s.observations??=[];s.aiDecisions??=[];s.nextChain=Math.max(1,number(s.nextChain,1));
    for(const side of [0,1]){s.teamMetrics[side]={...emptyTeam(),...s.teamMetrics[side]};for(const id of m.lineups[side])s.playerActions[id]??=emptyPlayer()}
    if(![0,1].includes(s.owner))s.owner=Math.random()<.5?0:1;
    s.progress=bound(s.progress??24,3,97);s.lateral=bound(s.lateral??50,3,97);
    if(!active(m,s.owner).includes(s.carrier))s.carrier=choosePlayer(m,s.owner,s.progress)?.id??null;
    return s;
  }
  function tuning(m){return window.FM_CALIBRATION?.active()?FM_CALIBRATION.tuning(currentEvent()?.leagueId||club(m.home)?.leagueId):null}
  function fitness(p){return .72+bound(p.condicion_fisica,0,100)*.0028}
  function cohesion(p){if(actionModifiers?.has(p.id))return actionModifiers.get(p.id);const v=window.FM_DRESSING_ROOM?.matchModifier?.(p),value=typeof v==='number'?bound(v,.95,1.05):1;actionModifiers?.set(p.id,value);return value}
  function skill(p,key){return attribute(p,key)*fitness(p)*cohesion(p)*(window.FM_MEDICINE?FM_MEDICINE.factor(p):1)}
  function choosePlayer(m,side,progress,exclude=null){
    const ids=active(m,side),t=tactics(m,side),slots=window.FM_TACTICS?.slots(t.formation)||FORMATIONS[t.formation]||FORMATIONS['4-3-3'];
    return weighted(ids.filter(id=>id!==exclude&&(progress<=25||id!==keeperId(m,side))).map(player),p=>{
      const i=m.lineups[side].indexOf(p.id),slot=slots[i]||p.posicion,front=['DC','EI','ED','MP','DEL'].includes(slot),back=['DFC','LI','LD','DEF'].includes(slot);
      const expected=p.id===keeperId(m,side)?8:front?77:back?31:53;
      const instruction=window.FM_TACTICS?.instructionsFor?.(p.id,t)||{};
      const target=expected+(instruction.duty==='Ataque'?8:instruction.duty==='Defensa'?-8:0)+(instruction.runs==='Venir a recibir'?-8:instruction.runs==='Atacar espacios'?8:0);
      return Math.max(.02,1-Math.abs(progress-target)/75)*(p.id===keeperId(m,side)&&progress>25?.02:1)*(.65+skill(p,'pase')/150);
    });
  }
  function initialPositions(m,side){
    const t=tactics(m,side),layout=window.FM_TACTICS?.formationLayout?.(t.formation);
    if(layout)return m.lineups[side].map((id,i)=>({id,x:side===m.userSide?layout[i]?.[1]??50:100-(layout[i]?.[1]??50),y:side===m.userSide?layout[i]?.[2]??50:100-(layout[i]?.[2]??50)}));
    return positions(m.lineups[side],t.formation||'4-3-3',side!==m.userSide);
  }
  function move(m,s){
    for(const side of [0,1]){
      const t=tactics(m,side),p=plan(t),own=side===s.owner,live=new Set(active(m,side));
      for(const base of initialPositions(m,side)){
        if(!live.has(base.id)){delete s.positions[base.id];continue}
        const person=player(base.id),instruction=window.FM_TACTICS?.instructionsFor?.(base.id,t)||{},baseProgress=progressAt(m,side,base);
        let progress=baseProgress;
        if(person.id!==keeperId(m,side)){
          progress+=(own?8:-5)+(number(t.line)-50)*.12+(p.outOfPossession.block==='Alto'?5:p.outOfPossession.block==='Bajo'?-5:0);
          progress+=(own?(s.progress-50)*.18:(50-s.progress)*.12);
          progress+=instruction.duty==='Ataque'?6:instruction.duty==='Defensa'?-5:0;
          if(own&&instruction.runs==='Atacar espacios')progress+=5;
          if(own&&instruction.runs==='Venir a recibir')progress-=5;
          if(!own&&p.outOfPossession.marking==='Individual')progress+=(100-s.progress-progress)*.12;
        }
        let lateral=50+(base.x-50)*(.70+number(t.width)*.006)+(s.lateral-50)*.08;
        if(!own&&p.outOfPossession.trap==='Dentro')lateral=50+(lateral-50)*.85;
        if(!own&&p.outOfPossession.trap==='Fuera')lateral=50+(lateral-50)*1.08;
        if(s.coveringPlayer?.id===base.id&&s.coveringPlayer.until>=m.minute)progress=Math.min(progress,40);
        if(base.id===s.carrier){progress=s.progress;lateral=s.lateral}
        const dest=worldPoint(m,side,bound(progress,person.id===keeperId(m,side)?3:10,person.id===keeperId(m,side)?17:94),lateral);
        s.positions[base.id]={id:base.id,...dest};
      }
    }
    m.ball=worldPoint(m,s.owner,s.progress,s.lateral);
  }
  function positionsFor(m,side){if(!m?.simulation)return initialPositions(m,side).filter(p=>active(m,side).includes(p.id));return active(m,side).map(id=>m.simulation.positions[id]||initialPositions(m,side).find(p=>p.id===id)).filter(Boolean)}
  function context(m,side){
    if(actionContexts?.has(side))return actionContexts.get(side);
    const a=active(m,side).map(player),b=active(m,1-side).map(player),t=tactics(m,side),op=tactics(m,1-side),p=plan(t),q=plan(op),own=actionFactors?.[side],other=actionFactors?.[1-side];
    const rawPassing=mean(a,x=>skill(x,'pase')),rawDefense=mean(b.filter(x=>x.posicion==='DEF'||x.posicion==='MED'),x=>skill(x,'defensa'));
    const result={a,b,t,op,p,q,rawPassing,passing:number(own?.build,rawPassing),attack:number(own?.attack,mean(a.filter(x=>x.id!==keeperId(m,side)),x=>skill(x,'tiro'))),press:number(other?.defense,mean(b.filter(x=>x.id!==keeperId(m,1-side)),x=>(skill(x,'defensa')+skill(x,'fisico'))/2)),pace:mean(a.filter(x=>x.id!==keeperId(m,side)),x=>skill(x,'ritmo')),defense:number(other?.defense,rawDefense)};
    actionContexts?.set(side,result);return result;
  }
  function action(chain,type,side,p,receiver,from,to,success=true,extra={}){chain.actions.push({type,side,playerId:p?.id??null,receiverId:receiver?.id??null,from:{...from},to:{...to},success,...extra})}
  function loss(m,s,chain,actor,reason){
    const side=s.owner,opp=1-side,from=worldPoint(m,side,s.progress,s.lateral),c=context(m,side),defender=weighted(active(m,opp).map(player).filter(p=>p.id!==keeperId(m,opp)),p=>{const instruction=window.FM_TACTICS?.instructionsFor?.(p.id,c.op)||{};return skill(p,'defensa')*(p.posicion==='DEF'?1.4:p.posicion==='MED'?1.2:.5)*(Number(instruction.markingTarget)===actor?.id?1.5:1)*(instruction.pressing==='Intensa'?1.1:instruction.pressing==='Contener'?.9:1)});
    s.teamMetrics[side].losses++;s.teamMetrics[opp].regains++;
    if(defender){s.playerActions[defender.id].interceptions++;s.playerActions[defender.id].tackles++;if(m.playerStats?.[defender.id])m.playerStats[defender.id].tackles++}
    action(chain,'intercepción',opp,defender,actor,from,from,true,{reason});
    const pressing=(c.p.transition.onLoss==='Contrapresión'||c.t.style==='Gegenpress'&&c.p.transition.onLoss!=='Reagrupar')&&s.progress>45;
    const recover=pressing&&Math.random()<bound(.20+(mean(c.a,p=>skill(p,'defensa'))-c.passing)*.002,.10,.34);
    if(recover){s.teamMetrics[side].pressRecoveries++;s.teamMetrics[side].regains++;s.carrier=choosePlayer(m,side,s.progress)?.id;s.progress=bound(s.progress+3,3,96);action(chain,'recuperación',side,player(s.carrier),null,from,worldPoint(m,side,s.progress,s.lateral),true,{reason:'Contrapresión tras pérdida'});return}
    s.owner=opp;s.progress=100-s.progress;s.carrier=defender?.id??choosePlayer(m,opp,s.progress)?.id;
    const counter=plan(tactics(m,opp)).transition.onWin==='Contraatacar'||tactics(m,opp).style==='Salida de Contragolpe';
    if(counter){s.teamMetrics[opp].counters++;s.transition=3;const covered=s.coveringPlayer?.side===side&&s.coveringPlayer.until>=m.minute;s.counterCovered=covered?3:0;s.progress=bound(s.progress+(covered?0:5),3,92)}else{s.transition=0;s.counterCovered=0}
  }
  function shot(m,s,chain,c,kind='open'){
    const side=s.owner,crossing=kind==='cross',setPiece=kind==='corner'||kind==='freeKick',live=active(m,side).map(player).filter(p=>p.id!==keeperId(m,side));if(!live.length)return null;
    const cover=live.find(p=>p.id===Number(c.p.setPieces.stayBack)),specialist=live.find(p=>p.id===Number(kind==='corner'?c.p.setPieces.cornerTaker:c.p.setPieces.freeKickTaker));
    const players=setPiece?live.filter(p=>p.id!==cover?.id&&(kind==='freeKick'&&c.p.setPieces.freeKick==='Directo'||p.id!==specialist?.id)):live;if(!players.length)return null;
    if(setPiece&&cover)s.coveringPlayer={id:cover.id,side,until:m.minute+2};
    const target=Number(c.p.setPieces.corner==='Segundo palo'?c.p.setPieces.farPost:c.p.setPieces.corner==='Corto'?c.p.setPieces.edgeOfArea:c.p.setPieces.nearPost);
    const penalty=!setPiece&&Math.random()<.012;
    let shooter=(penalty&&(players.find(p=>p.id===Number(c.t.penaltyTaker))||[...players].sort((a,b)=>attribute(b,'penales')-attribute(a,'penales'))[0]))||(!penalty&&!setPiece&&!crossing&&players.find(p=>p.id===s.carrier))||(setPiece&&players.find(p=>p.id===target))||weighted(players,p=>(p.posicion==='DEL'?4:p.posicion==='MED'?1.5:.6)*(crossing||setPiece?skill(p,'fisico')*.6+skill(p,'tiro')*.4:skill(p,'tiro')));
    if(kind==='freeKick'&&c.p.setPieces.freeKick==='Directo')shooter=players.find(p=>p.id===Number(c.p.setPieces.freeKickTaker))||[...players].sort((a,b)=>skill(b,'tiro')-skill(a,'tiro'))[0];
    const takerId=kind==='corner'?c.p.setPieces.cornerTaker:kind==='freeKick'?c.p.setPieces.freeKickTaker:null;
    const possessionStart=chain.actions.findLastIndex(a=>a.type==='intercepción'||a.type==='recuperación');
    const lastPass=chain.actions.slice(possessionStart+1).findLast(a=>a.side===side&&a.success&&a.type==='pase'&&a.receiverId===shooter.id);
    const lastCross=crossing&&chain.actions.findLast(a=>a.side===side&&a.success&&a.type==='centro');
    const supplier=penalty||kind==='freeKick'&&c.p.setPieces.freeKick==='Directo'?null:(takerId&&live.find(p=>p.id===Number(takerId)&&p.id!==shooter.id))||(lastCross&&live.find(p=>p.id===lastCross.playerId&&p.id!==shooter.id))||(lastPass&&live.find(p=>p.id===lastPass.playerId&&p.id!==shooter.id))||null;
    if(lastCross){lastCross.receiverId=shooter.id;s.playerActions[shooter.id].received++}
    const from=worldPoint(m,side,s.progress,s.lateral),to=worldPoint(m,side,98,50),paceGap=c.pace-mean(c.b.filter(p=>p.posicion==='DEF'),p=>skill(p,'ritmo'));
    const highLine=number(c.op.line)-50+(c.q.outOfPossession.block==='Alto'?15:c.q.outOfPossession.block==='Bajo'?-15:0);
    const breakaway=s.transition>0&&!(s.counterCovered>0)&&highLine>5&&paceGap>-8;
    let type=penalty?'penal':kind==='corner'?'córner':kind==='freeKick'?(c.p.setPieces.freeKick==='Directo'?'tiro libre':'pelota parada'):crossing?'cabeza':breakaway?'mano a mano':s.progress>=77?'área':'lejos';
    let xg=type==='mano a mano'?.22:type==='área'?.10:type==='cabeza'?.075:type==='córner'?.085:type==='tiro libre'?.045:type==='pelota parada'?.075:.032;
    const familiarity=bound(c.p.setPieces.familiarity??35,0,100);
    xg+=bound((c.attack-c.defense)*.00065,-.025,.035);
    if(setPiece)xg+=(familiarity-35)*.00025+(skill(shooter,'fisico')-c.defense)*.0005-(c.q.setPieces.defending==='Individual'?(c.defense-55)*.00025:0);
    if(crossing)xg+=(skill(shooter,c.p.inPossession.crosses==='Rasos'?'ritmo':'fisico')-c.defense)*.0005;
    if(c.p.inPossession.finalThird==='Elaborar'&&s.progress>=80)xg+=.018;
    if(s.transition>0)xg+=bound((highLine+paceGap)*.0005-(s.counterCovered>0?.018:0),-.018,.032);
    const reason=setPiece?`Pelota parada · ${kind==='corner'?c.p.setPieces.corner:c.p.setPieces.freeKick}${familiarity>=60?' · rutina entrenada':''}`:breakaway?'Recuperación y pase al espacio detrás de la línea rival':crossing?`Progresión por banda y centro ${c.p.inPossession.crosses.toLowerCase()}`:c.p.inPossession.finalThird==='Elaborar'?'Combinación paciente hasta encontrar un pase dentro del área':s.progress<77?'Remate exterior ante el bloque defensivo':'Progresión y recepción en zona de remate';
    action(chain,'remate',side,shooter,supplier,from,to,true,{reason});
    chain.side=side;chain.shooterId=shooter.id;chain.supplierId=supplier?.id??null;chain.context=type;chain.reason=reason;chain.end=to;chain.outcome='remate';
    const result={side,shooterId:shooter.id,supplierId:penalty?null:supplier?.id??null,type,xg:penalty?.76:bound(xg,.012,.38),reason:penalty?'Falta dentro del área tras la progresión ofensiva':reason,chainId:chain.id};
    s.lastShot=result;s.owner=1-side;s.progress=15;s.lateral=50;s.carrier=keeperId(m,1-side)??choosePlayer(m,1-side,15)?.id;s.transition=0;
    return result;
  }
  function step(m,factors={}){
    actionModifiers=new Map();actionContexts=new Map();actionFactors=[factors.home,factors.away];const s=ensure(m);s.lastShot=null;
    const chain={id:`seq-${s.nextChain++}`,minute:m.minute,side:s.owner,start:worldPoint(m,s.owner,s.progress,s.lateral),end:null,actions:[],outcome:'circulación',reason:''};
    const tempo=mean([0,1],side=>number(tactics(m,side).tempo)),count=Math.round(bound(10+(tempo-50)*.035,8,13)),time=[0,0];let pending=null;
    for(let i=0;i<count;i++){
      const side=s.owner,c=context(m,side),actor=player(s.carrier)||choosePlayer(m,side,s.progress);if(!actor){s.owner=1-side;continue}s.carrier=actor.id;s.playerActions[actor.id]??=emptyPlayer();s.playerActions[actor.id].touches++;time[side]++;
      const from=worldPoint(m,side,s.progress,s.lateral),metrics=s.teamMetrics[side],direct=c.p.inPossession.buildUp==='Directa'||c.p.inPossession.buildUp==='Mixta'&&c.t.style==='Salida de Contragolpe'||c.p.transition.onWin==='Contraatacar'&&s.transition>0;
      const instruction=window.FM_TACTICS?.instructionsFor?.(actor.id,c.t)||{};
      const width=c.p.inPossession.progression==='Bandas',central=c.p.inPossession.progression==='Centro';
      if(i===0&&s.progress<35)metrics.buildUps++;
      const cornerAvailable=(m.stats[side].corners||0)>(s.consumedCorners?.[side]||0);
      if(cornerAvailable&&Math.random()<.45){
        s.consumedCorners??=[0,0];s.consumedCorners[side]=(m.stats[side].corners||0);metrics.setPieces++;s.progress=85;s.lateral=c.p.setPieces.corner==='Segundo palo'?77:23;
        const taker=active(m,side).map(player).find(p=>p.id===Number(c.p.setPieces.cornerTaker))||actor;
        const cornerPoint=worldPoint(m,side,97,s.lateral<50?3:97);action(chain,'córner',side,taker,null,cornerPoint,worldPoint(m,side,85,s.lateral));
        if(c.p.setPieces.corner==='Corto'){
          const recipients=active(m,side).map(player).filter(p=>p.id!==keeperId(m,side)&&p.id!==taker.id&&p.id!==Number(c.p.setPieces.stayBack));
          const receiver=recipients.find(p=>p.id===Number(c.p.setPieces.edgeOfArea))||weighted(recipients,p=>skill(p,'pase'));
          if(receiver){s.progress=77;s.carrier=receiver.id;s.playerActions[taker.id].passes++;s.playerActions[taker.id].completedPasses++;s.playerActions[receiver.id].received++;m.stats[side].passes++;m.stats[side].completedPasses++;action(chain,'pase',side,taker,receiver,cornerPoint,worldPoint(m,side,77,s.lateral),true,{reason:'Córner corto al apoyo designado'})}
          continue;
        }
        pending=shot(m,s,chain,c,'corner');break;
      }
      const shotProbability=bound(.025+(s.progress-75)*.0018+(number(c.t.tempo)-50)*.00025+(c.t.mentality==='Ofensiva'?.012:c.t.mentality==='Cauta'?-.008:0)+(instruction.shooting==='Disparar más'?.035:instruction.shooting==='Buscar pase'?-.018:0),.012,.12);
      const willing=instruction.shooting==='Disparar más'?s.progress>=59:c.p.inPossession.finalThird==='Elaborar'?s.progress>=80:s.progress>=67;
      if(willing&&Math.random()<shotProbability*(tuning(m)?.shotFrequency??1)){pending=shot(m,s,chain,c);break}
      const cross=s.progress>60&&(s.lateral<28||s.lateral>72)&&c.p.inPossession.finalThird==='Centros'&&Math.random()<.38;
      if(cross){metrics.crosses++;const completion=bound(.40+(skill(actor,'pase')-c.defense)*.004,.20,.67);s.playerActions[actor.id].passes++;m.stats[side].passes++;if(Math.random()<completion){metrics.completedCrosses++;m.stats[side].completedPasses++;s.playerActions[actor.id].completedPasses++;action(chain,'centro',side,actor,null,from,worldPoint(m,side,85,50),true);s.progress=85;s.lateral=50;pending=shot(m,s,chain,c,'cross');break}action(chain,'centro',side,actor,null,from,worldPoint(m,side,82,50),false);loss(m,s,chain,actor,'Centro despejado por la defensa');continue}
      const dribble=actor.id!==keeperId(m,side)&&Math.random()<.10+(instruction.risk==='Arriesgado'?.04:0)+(instruction.dribbling==='Encarar'?.13:instruction.dribbling==='Soltar rápido'?-.08:0);
      if(dribble){const success=Math.random()<bound(.64+(skill(actor,'regate')-c.defense)*.004,.28,.86);if(success){const before=s.progress;s.progress=bound(s.progress+7+Math.random()*9,4,96);s.playerActions[actor.id].dribbles++;if(before<67&&s.progress>=67)metrics.finalThirdEntries++;action(chain,'conducción',side,actor,null,from,worldPoint(m,side,s.progress,s.lateral));}else{action(chain,'conducción',side,actor,null,from,from,false);loss(m,s,chain,actor,'El defensor gana el duelo individual')}continue}
      const short=c.p.inPossession.buildUp==='Corta'||c.p.inPossession.buildUp==='Mixta'&&c.t.style==='Tiki-Taka'||instruction.passing==='Cortos',risk=instruction.risk==='Arriesgado'?1:instruction.risk==='Seguro'?-1:0;
      let distance=(direct||instruction.passing==='Directos'?16:short?7:11)+Math.random()*9+(risk*3);
      if(actor.id===keeperId(m,side)&&c.p.transition.keeper==='Largo')distance=28+Math.random()*14;
      if(c.p.transition.onWin==='Conservar'&&s.transition>0)distance*=.65;
      if(instruction.runs==='Venir a recibir')distance*=.80;
      if(s.progress>75)distance*=.43;
      if(Math.random()<(short?.19:.12))distance=-distance*.6;
      const nextProgress=bound(s.progress+distance,5,96);let receiver=choosePlayer(m,side,nextProgress,actor.id);if(!receiver)continue;
      let nextX=bound(s.lateral+(Math.random()-.5)*(width?42:central?18:30),8,92);
      if(width&&Math.random()<.55)nextX=Math.random()<.5?15:85;
      if(central)nextX=50+(nextX-50)*.72;
      if(actor.id===keeperId(m,side)&&c.p.transition.keeper!=='Largo'){
        const flanks=c.p.transition.keeper==='Laterales',slots=window.FM_TACTICS?.slots(c.t.formation)||[];
        const outlets=active(m,side).filter(id=>id!==actor.id).map(player).filter(p=>flanks?['LI','LD'].includes(slots[m.lineups[side].indexOf(p.id)]):['DFC','MCD'].includes(slots[m.lineups[side].indexOf(p.id)]));
        receiver=weighted(outlets,p=>skill(p,'pase'))||receiver;
        if(flanks){const slot=slots[m.lineups[side].indexOf(receiver.id)];nextX=slot==='LI'?(side===m.userSide?15:85):side===m.userSide?85:15}else nextX=50+(Math.random()-.5)*22;
      }
      if(instruction.width==='Abrirse')nextX=nextX<50?bound(nextX-12,8,42):bound(nextX+12,58,92);
      if(instruction.width==='Cerrar hacia adentro')nextX=50+(nextX-50)*.55;
      const press=number(c.op.pressing)+(c.op.style==='Gegenpress'?7:0)+(c.q.outOfPossession.block==='Alto'&&s.progress<50?12:0)+(c.q.transition.onLoss==='Contrapresión'&&s.transition>0?10:0);
      const completion=bound(.85+(skill(actor,'pase')-c.press)*.002+(c.passing-c.rawPassing)*.0018+(short?.045:0)-(direct||actor.id===keeperId(m,side)&&c.p.transition.keeper==='Largo'?.065:0)-(press-50)*.001-risk*.025-(m.weather==='Lluvia leve'?.018:0)+(c.p.transition.onWin==='Conservar'&&s.transition>0?.025:0)+(side===0&&!m.neutral?.006+(tuning(m)?.homeBias??0):0),.54,.96);
      const success=Math.random()<completion,to=worldPoint(m,side,nextProgress,nextX);
      s.playerActions[actor.id].passes++;m.stats[side].passes++;
      action(chain,'pase',side,actor,receiver,from,to,success,{reason:direct?'Pase directo':short?'Apoyo corto':'Pase de progresión'});
      if(success){const before=s.progress;m.stats[side].completedPasses++;s.playerActions[actor.id].completedPasses++;s.playerActions[receiver.id]??=emptyPlayer();s.playerActions[receiver.id].received++;s.progress=nextProgress;s.lateral=nextX;s.carrier=receiver.id;if(distance>18)metrics.progressivePasses++;if(before<67&&s.progress>=67)metrics.finalThirdEntries++}
      else loss(m,s,chain,actor,press>=70?'La presión fuerza un pase impreciso':direct?'La defensa intercepta el pase largo':'Pase interceptado');
      if(s.transition>0)s.transition--;if(s.counterCovered>0)s.counterCovered--;
    }
    // A late free kick is a recorded attacking restart, never an extra result roll.
    if(!pending&&m.minute>0&&Math.random()<.008){const c=context(m,s.owner);s.teamMetrics[s.owner].setPieces++;s.progress=76;action(chain,'tiro libre',s.owner,player(Number(c.p.setPieces.freeKickTaker))||player(s.carrier),null,worldPoint(m,s.owner,76,50),worldPoint(m,s.owner,86,50));pending=shot(m,s,chain,c,'freeKick')}
    chain.end??=worldPoint(m,s.owner,s.progress,s.lateral);if(!pending&&chain.actions.some(a=>!a.success))chain.outcome='pérdida y recuperación';chain.side=pending?.side??chain.side;
    s.chains.push(chain);s.chains=s.chains.slice(-150);s.lastChain=chain.id;
    move(m,s);
    const share=time[0]+time[1]?time[0]/(time[0]+time[1])*100:50;
    s.snapshots.push({minute:m.minute,shots:m.stats.map(x=>x.shots||0),xg:m.stats.map(x=>x.xg||0),entries:s.teamMetrics.map(x=>x.finalThirdEntries),losses:s.teamMetrics.map(x=>x.losses),counters:s.teamMetrics.map(x=>x.counters)});s.snapshots=s.snapshots.slice(-35);
    actionModifiers=null;actionContexts=null;actionFactors=null;return {homeShare:share,side:pending?.side??s.owner,shot:!!pending,shotBoost:0,chainId:chain.id};
  }
  function shotContext(m,side){const c=m.simulation?.lastShot;if(!c||c.side!==side)return null;const ids=active(m,side);if(!ids.includes(c.shooterId))return null;return {...c,shooter:player(c.shooterId),supplier:ids.includes(c.supplierId)?player(c.supplierId):null}}
  function recordChance(m,chance){const s=m.simulation,c=s?.lastShot,chain=s?.chains.find(p=>p.id===c?.chainId);if(!c||!chain||chance.side!==c.side)return;chance.chainId=chain.id;chance.reason=chain.reason;chance.shotLocation={...(chain.actions.findLast(a=>a.type==='remate')?.from||chain.start)};chance.sequencePoints=chain.actions.filter(a=>a.side===chance.side&&a.success).map(a=>({...a.to}));chain.outcome=chance.outcome;chain.xg=chance.xg;chain.playerId=chance.playerId;chain.shooterId=chance.playerId;const remate=chain.actions.findLast(a=>a.type==='remate');if(remate)remate.playerId=chance.playerId;if(chance.outcome==='gol'||chance.outcome==='anulado'){s.owner=1-chance.side;s.progress=50;s.lateral=50;s.carrier=choosePlayer(m,s.owner,50)?.id;move(m,s)}}
  function diagnostics(m=GameState?.match,side=m?.userSide){if(!m?.simulation)return [];const s=m.simulation,a=s.teamMetrics[side],b=s.teamMetrics[1-side],stats=m.stats[side],r=[],t=tactics(m,side),p=plan(t),last=s.chains.slice(-15),recentLosses=last.flatMap(c=>c.actions).filter(a=>a.type==='intercepción'&&a.side!==side).length;
    if(m.minute>=10&&recentLosses>=8)r.push({kind:'build',text:p.inPossession.buildUp==='Directa'?'Los envíos directos están cortando la circulación. Acercá apoyos si querés sostener la pelota.':'La presión rival está interrumpiendo la salida. Un pase directo puede saltar la primera línea.',evidence:`${recentLosses} intercepciones rivales en los últimos ${last.length} minutos; ${stats.completedPasses||0}/${stats.passes||0} pases completados.`});
    if(a.finalThirdEntries>=4)r.push({kind:'progress',text:`El equipo llega al último tercio ${p.inPossession.progression==='Bandas'?'buscando las bandas':p.inPossession.progression==='Centro'?'por dentro':'combinando carriles'}. ${stats.shots<3?'Falta convertir esas entradas en remates.':'Las ocasiones nacen de esa progresión.'}`,evidence:`${a.finalThirdEntries} entradas al último tercio · ${stats.shots||0} remates · ${Number(stats.xg||0).toFixed(2)} xG.`});
    if(b.counters>=3&&number(t.line)>60)r.push({kind:'space',text:'El rival encuentra transiciones con espacio detrás de tu línea. Bajá el bloque o conservá más jugadores por detrás de la pelota.',evidence:`${b.counters} recuperaciones con intención de contraatacar; línea defensiva ${number(t.line)}/100.`});
    if(a.pressRecoveries>0)r.push({kind:'press',text:'La contrapresión está generando recuperaciones inmediatas, con una carga física adicional.',evidence:`${a.pressRecoveries} recuperaciones tras pérdida registradas.`});
    if(a.crosses>=3)r.push({kind:'cross',text:a.completedCrosses/a.crosses<.35?'La defensa está despejando la mayoría de los centros. Probá centros rasos o combinaciones por dentro.':'Los centros están encontrando un receptor dentro del área.',evidence:`${a.completedCrosses}/${a.crosses} centros conectados.`});
    if(!r.length)r.push({kind:'observe',text:'Todavía no hay suficiente evidencia para pedir un cambio de plan.',evidence:`${m.minute} minutos · ${a.finalThirdEntries} entradas al último tercio · ${a.losses} pérdidas registradas.`});return r.slice(0,5)}
  function analysisHTML(m=GameState?.match){return `<section class="card sim-analysis"><h2>Lectura de las jugadas</h2><div class="sim-analysis-list">${diagnostics(m).map(r=>`<article><strong>${esc(r.text)}</strong><p class="small muted">${esc(r.evidence)}</p></article>`).join('')}</div><p class="small muted">Observaciones basadas en pases, recuperaciones y remates registrados. Las instrucciones cambian probabilidades y espacios; no garantizan resultados.</p></section>`}
  return {ensure,step,shotContext,recordChance,positions:positionsFor,diagnostics,analysisHTML,plan,context,active};
})();
