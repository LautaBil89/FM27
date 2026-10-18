/* Source-labelled lower divisions and actual exchanges with the top flight. */
window.FM_PYRAMIDS=(()=>{
 'use strict';
 const DAY=86400000,copy=x=>structuredClone(x),iso=n=>new Date(n).toISOString().slice(0,10);
 const ui={league:'',tab:'table',phase:'',group:'',round:''};
 const rules={
  GB2:{upper:'GB1',mode:'english',direct:2,promotions:3,name:'46 fechas · dos ascensos y playoff',source:'https://www.efl.com/competitions/sky-bet-championship/'},
  ES2:{upper:'ES1',mode:'spanish',direct:2,promotions:3,name:'42 fechas · dos ascensos y playoff',source:'https://www.laliga.com/laliga-hypermotion/clasificacion'},
  IT2:{upper:'IT1',mode:'italian',direct:2,promotions:3,name:'38 fechas · ascenso directo y playoff condicional',source:'https://www.legab.it/serie-bkt/regolamenti'},
  L2:{upper:'L1',mode:'german',direct:2,promotions:2,indirect:true,name:'34 fechas · dos ascensos y promoción',source:'https://www.bundesliga.com/en/2bundesliga/table'},
  FR2:{upper:'FR1',mode:'french',direct:2,promotions:2,indirect:true,name:'34 fechas · playoff y promoción',source:'https://ligue2.fr/competitions/ligue2bkt'},
  BRA2:{upper:'BRA1',mode:'brazil',direct:2,promotions:4,name:'38 fechas · dos ascensos y dos cruces de playoff',source:'https://www.cbf.com.br/futebol-brasileiro/competicoes/campeonato-brasileiro-serie-b/2026'},
  CHI2:{upper:'CHI1',mode:'chilean',direct:1,promotions:2,name:'30 fechas · campeón y liguilla de ascenso',source:'https://www.transfermarkt.com.ar/liga-de-ascenso/startseite/wettbewerb/CL2B/saison_id/2025'},
  URU2:{upper:'URU1',mode:'uruguayan',direct:2,promotions:3,name:'Competencia, fase regular y playoff',source:'https://www.rsssf.org/tablesu/uru2026.html'},
  PAR2:{upper:'PAR1',mode:'direct',direct:2,promotions:2,name:'30 fechas · dos ascensos directos',source:'https://www.transfermarkt.com.ar/division-intermedia/startseite/wettbewerb/PAR2/saison_id/2025'},
  ECU2:{upper:'ECU1',mode:'ecuadorian',direct:2,promotions:2,name:'22 fechas y hexagonales · dos ascensos',source:'https://www.transfermarkt.com.ar/liga-pro-serie-b/startseite/wettbewerb/EC2L/saison_id/2025'},
  PER2:{upper:'PER1',mode:'peruvian',direct:0,promotions:2,name:'Grupos regionales, campeonato y definición',referenceDefinition:'2025; fase inicial de 2026',source:'https://www.rsssf.org/tablesp/peru2025.html'},
  COL2:{upper:'COL1',mode:'colombian',direct:0,promotions:2,name:'Dos torneos, cuadrangulares y definición de ascenso',source:'https://dimayor.com.co/torneo-betplay-dimayor/'},
  VEN2:{upper:'VEN1',mode:'venezuelan',direct:0,promotions:1,name:'Dos grupos regionales, playoffs y final absoluta',referenceDefinition:'Formato de carrera basado en las fases publicadas; sorteos y criterios regionales adaptados',source:'https://www.transfermarkt.com.ar/liga-futve-2/startseite/wettbewerb/VN2A/saison_id/2025'},
  BOL2:{upper:'BOL1',mode:'bolivian',direct:1,promotions:1,indirect:true,name:'Copa regional · seis grupos y eliminatorias',referenceDefinition:'Fase nacional 2025; pool histórico adaptado',source:'https://www.rsssf.org/tablesb/bol2025.html'}
 };
 const enabled=()=>GameState?.world?.pyramids?.version===1;
 /* Generated windows preserve sporting phase order; they are not official fixture dates. */
 function phaseWindows(id,year){
  const d=(m,n,next=false)=>`${Number(year)+(next?1:0)}-${String(m).padStart(2,'0')}-${String(n).padStart(2,'0')}`;
  const european={
   GB2:{LIGA:[d(8,1),d(5,2,true)],SEMIFINAL:[d(5,6,true),d(5,10,true)],FINAL:[d(5,17,true),d(5,17,true)]},
   ES2:{LIGA:[d(8,15),d(5,23,true)],SEMIFINAL:[d(5,27,true),d(5,31,true)],FINAL:[d(6,4,true),d(6,8,true)]},
   IT2:{LIGA:[d(8,22),d(5,16,true)],PRELIMINAR:[d(5,19,true),d(5,19,true)],SEMIFINAL:[d(5,23,true),d(5,27,true)],FINAL:[d(5,31,true),d(6,4,true)]},
   L2:{LIGA:[d(8,1),d(5,16,true)],PROMOCION:[d(5,23,true),d(5,27,true)]},
   FR2:{LIGA:[d(8,15),d(5,16,true)],PLAYOFF_45:[d(5,19,true),d(5,19,true)],PLAYOFF_3:[d(5,23,true),d(5,23,true)],PROMOCION:[d(5,30,true),d(6,3,true)]}
  };
  if(european[id])return european[id];
  const range=(m,a,n,b)=>[d(m,a),d(n,b)];
  return {
   BRA2:{LIGA:range(3,21,11,21),ASCENSO:range(11,25,11,29)},
   CHI2:{LIGA:range(2,21,10,24),CUARTOS:range(10,28,11,1),SEMIFINAL:range(11,5,11,9),FINAL:range(11,13,11,17)},
   PAR2:{LIGA:range(3,7,10,17)},
   ECU2:{INICIAL:range(3,14,7,25),HEXAGONALES:range(8,1,11,7)},
   URU2:{COMPETENCIA:range(3,7,4,18),FINAL_COMPETENCIA:range(4,25,4,25),REGULAR:range(5,2,11,7),REPECHAJE:range(11,11,11,11),SEMIFINAL:range(11,15,11,19),FINAL:range(11,23,11,27)},
   PER2:{REGIONAL:range(3,7,6,27),CAMPEONATO:range(7,4,9,5),CUARTOS:range(9,12,9,12),SEMIFINAL:range(9,16,9,20),FINAL:range(9,24,9,28),TERCER_PUESTO:range(9,24,9,28),SEGUNDO_ASCENSO:range(10,3,10,7)},
   COL2:{APERTURA:range(1,17,5,2),APERTURA_GRUPOS:range(5,6,5,27),APERTURA_FINAL:range(5,31,6,4),CLAUSURA:range(7,18,10,31),CLAUSURA_GRUPOS:range(11,4,11,25),CLAUSURA_FINAL:range(11,29,12,3),GRAN_FINAL:range(12,7,12,11),SEGUNDO_ASCENSO:range(12,15,12,19)},
   VEN2:{APERTURA:range(1,31,5,23),APERTURA_CUARTOS:range(5,27,5,31),APERTURA_SEMIFINAL:range(6,4,6,8),APERTURA_FINAL:range(6,12,6,16),CLAUSURA:range(7,18,11,7),CLAUSURA_CUARTOS:range(11,11,11,15),CLAUSURA_SEMIFINAL:range(11,19,11,23),CLAUSURA_FINAL:range(11,27,12,1),FINAL_ABSOLUTA:range(12,5,12,9)},
   BOL2:{NACIONAL:range(5,30,7,4),OCTAVOS:range(7,11,7,15),CUARTOS:range(7,22,7,26),SEMIFINAL:range(8,2,8,6),FINAL:range(8,13,8,17),PROMOCION:range(12,24,12,28)}
  }[id]||{};
 }
 const league=id=>GameState?.world?.leagues.find(l=>l.id===id);
 const state=id=>GameState?.world?.pyramids?.leagues?.[id];
 const blank=ids=>Object.fromEntries(ids.map(id=>[id,{id,pj:0,g:0,e:0,p:0,gf:0,gc:0,pts:0}]));
 const clubName=id=>club(id)?.nombre||id;
 function ordered(table){return Object.values(table||{}).sort((a,b)=>b.pts-a.pts||(b.gf-b.gc)-(a.gf-a.gc)||b.gf-a.gf||clubName(a.id).localeCompare(clubName(b.id)))}
 function add(t,id,gf,gc){const row=t?.[id];if(!row)return;row.pj++;row.gf+=gf;row.gc+=gc;if(gf>gc){row.g++;row.pts+=3}else if(gf===gc){row.e++;row.pts++}else row.p++}
 function initialize(){if(!GameState?.worldVersion)return;GameState.world.pyramids??={version:1,leagues:{},history:[],movementKeys:[]};ensureSquads()}
 function ensureSquads(){
  if(!GameState?.worldVersion)return;let next=Math.max(1999999,...GameState.players.map(p=>p.id))+1,changed=false;
  for(const c of GameState.world.clubs.filter(c=>c.supplemental)){
   const pool=GameState.players.filter(p=>p.clubId===c.id),coverage={POR:2,DEF:6,MED:6,DEL:4};
   for(const [pos,min]of Object.entries(coverage))for(let n=pool.filter(p=>p.posicion===pos).length;n<min&&(pool.length<32||pos==='POR');n++){
    const p=makePlayer(window.WORLD_ENGINE?.nextPlayerId?.()??next++,c.id,pos,Math.max(35,c.rating-8),c.country);p.nombre=`Reserva ${pos} ${n+1} (simulada)`;p.realIdentity=false;p.synthetic=true;p.identitySource='Reserva ficticia del simulador · plantilla sin cobertura publicada suficiente';delete p.transfermarkt;p.nacionalidad=c.country;p.nationalities=[c.country];p.registrationArgentina=false;p.edad=19+(p.id%5);p.birthYear=Number(GameState.today.slice(0,4))-p.edad;p.contract=GameState.year+2;p.registered=true;p.potential=Math.min(80,c.rating+5);p.appearances=0;p.minutes=0;p.goals=0;p.assists=0;p.form=[];p.trainingFocus='Equipo';p.trainingProgress=0;p.moraleHistory=[];p.personalidad='Profesional';p.shirtNumber=pool.length+1;
    GameState.players.push(p);pool.push(p);changed=true;
   }
  }
  if(changed)WORLD_ENGINE.reindex();return changed;
 }
 function local(e){return enabled()&&!!e?.pyramid&&!!rules[e.leagueId]}
 function seedRank(id,team){const s=state(id);return s?.seeds?.indexOf(team)??99}
 function eligible(id,ids){const upper=league(rules[id].upper);return ids.filter(pid=>{const c=club(pid);return !c?.reserveParentId||!upper?.clubIds.includes(c.reserveParentId)})}
 function regularDates(total,start,compress=false){
  const out=[];for(let i=0;i<total;i++){let value=+new Date(start+'T12:00:00Z')+Math.round(i*(compress?266/Math.max(1,total-1):7))*DAY;
   const d=new Date(value);while(![3,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()+1);value=+d;if(out.length&&value<=+new Date(out.at(-1)))value=+new Date(out.at(-1))+3*DAY;out.push(iso(value));}return out;
 }
 function buildLeagueCalendar(id,year,startDate=null){
  if(!rules[id]||!league(id))return[];initialize();const l=league(id),r=rules[id],old=state(id);
  const s=GameState.world.pyramids.leagues[id]={year,upper:r.upper,tables:{},stages:{},completed:[],promoted:[],relegated:[],champion:null,runner:null,seeds:[],seasonDone:false,movementDone:false,previous:old?.previous||[]};
  l.standings=blank(l.clubIds);const events=[];const europe=l.confederation==='UEFA';let base=startDate||`${year}-${europe?'08-01':id==='BOL2'?'06-06':'03-07'}`;
  const start=+new Date(base+'T12:00:00Z');
  function ev(phase,round,day,games=[],annual=false,kind='regular',leg=1){const e={id:`${year}-${id}-PY-${phase}-${round}`,type:'LPF',leagueId:id,date:typeof day==='string'?day:iso(start+Math.round(day)*DAY),round,pyramid:true,pyramidPhase:phase,localCompetition:`${id}:${phase}`,phase:kind,pyramidLeg:leg,annual,games,done:false};events.push(e);return e}
  function rr(phase,sets,double,offset=0,annual=true,compressed=false){
   s.tables[phase]=Object.fromEntries(Object.entries(sets).map(([g,ids])=>[g,blank(ids)]));let count=0;
   const schedules=Object.entries(sets).map(([key,ids])=>[key,WORLD_ENGINE.roundRobin(ids,double)]);for(const [,rounds]of schedules)count=Math.max(count,rounds.length);
   const dates=regularDates(count,iso(start+offset*DAY),compressed);
   for(let i=0;i<count;i++){const e=ev(phase,i+1,dates[i],schedules.flatMap(([key,rounds])=>(rounds[i]||[]).map(g=>({...g,pyramidGroup:key}))),annual);e.pyramidLast=i===count-1}
   return count;
  }
  function groupSlots(phase,count,offset,annual=false){s.tables[phase]={};for(let i=0;i<count;i++){const e=ev(phase,i+1,offset+i*7,[],annual);e.pyramidLast=i===count-1;e.pyramidGroups=true}}
  function ko(phase,offset,legs=2,neutral=false,advantage=false){s.stages[phase]={ties:[],advantage};for(let leg=1;leg<=legs;leg++){const e=ev(phase,leg,offset+(leg-1)*4,[],false,'knockout',leg);e.pyramidLast=leg===legs;e.neutral=neutral;e.pyramidAdvantage=advantage;if(phase==='PROMOCION')e.interdivisionUpper=r.upper}}
  const all=l.clubIds,rrCount=(all.length-1+(all.length%2))*2;
  if(['english','spanish','italian','german','french','brazil','chilean','direct'].includes(r.mode)){
   rr('LIGA',{General:all},true,0,true,europe&&rrCount>38);const last=+new Date(events.at(-1).date),after=Math.round((last-start)/DAY)+7;
   if(['english','spanish'].includes(r.mode)){ko('SEMIFINAL',after,2,false,r.mode==='spanish');ko('FINAL',after+11,r.mode==='english'?1:2,r.mode==='english',r.mode==='spanish')}
   if(r.mode==='italian'){ko('PRELIMINAR',after,1,false,true);ko('SEMIFINAL',after+7,2,false,true);ko('FINAL',after+18,2,false,true)}
   if(r.mode==='french'){ko('PLAYOFF_45',after,1);ko('PLAYOFF_3',after+4,1);ko('PROMOCION',after+11,2)}
   if(r.mode==='german')ko('PROMOCION',after,2);
   if(r.mode==='brazil')ko('ASCENSO',after,2);
   if(r.mode==='chilean'){ko('CUARTOS',after,2);ko('SEMIFINAL',after+11,2);ko('FINAL',after+22,2)}
  }else if(r.mode==='ecuadorian'){
   rr('INICIAL',{General:all},true);groupSlots('HEXAGONALES',10,22*7);
  }else if(r.mode==='uruguayan'){
   const presetA=['tm-3829','tm-34318','tm-41308','tm-18077','tm-20762','tm-18122','tm-17494'];const a=presetA.filter(x=>all.includes(x)),rest=all.filter(x=>!a.includes(x));while(a.length<Math.ceil(all.length/2))a.push(rest.shift());
   rr('COMPETENCIA',{A:a,B:rest},false);ko('FINAL_COMPETENCIA',7*7,1,true);rr('REGULAR',{General:all},true,8*7);ko('REPECHAJE',34*7,1);ko('SEMIFINAL',35*7,2);ko('FINAL',37*7,2);
  }else if(r.mode==='peruvian'){
   const north=['tm-31337','tm-19520','tm-78641','tm-71432','tm-11622','tm-114373','tm-6889','tm-11247','tm-114390'];const a=north.filter(x=>all.includes(x)),rest=all.filter(x=>!a.includes(x));while(a.length<Math.ceil(all.length/2))a.push(rest.shift());
   rr('REGIONAL',{Norte:a,Sur:rest},true);groupSlots('CAMPEONATO',10,18*7);ko('CUARTOS',29*7,1);ko('SEMIFINAL',30*7,2);ko('FINAL',32*7,2);ko('TERCER_PUESTO',32*7,2);ko('SEGUNDO_ASCENSO',34*7,2);
  }else if(r.mode==='colombian'){
   for(const [phase,offset]of [['APERTURA',0],['CLAUSURA',24*7]]){rr(phase,{General:all},false,offset);groupSlots(phase+'_GRUPOS',6,offset+15*7);ko(phase+'_FINAL',offset+21*7,2)}ko('GRAN_FINAL',47*7,2);ko('SEGUNDO_ASCENSO',49*7,2);
  }else if(r.mode==='venezuelan'){
   const east=['tm-29750','tm-73062','tm-117712','tm-93377','tm-76267','tm-139764','tm-17194','tm-105806'];const a=east.filter(x=>all.includes(x)),rest=all.filter(x=>!a.includes(x));
   for(const [phase,offset]of [['APERTURA',0],['CLAUSURA',26*7]]){rr(phase,{Oriental:a,Occidental:rest},true,offset);ko(phase+'_CUARTOS',offset+18*7,2);ko(phase+'_SEMIFINAL',offset+20*7,2);ko(phase+'_FINAL',offset+22*7,2)}ko('FINAL_ABSOLUTA',50*7,2);
  }else if(r.mode==='bolivian'){
   const sets={};for(let i=0;i<6;i++)sets[String.fromCharCode(65+i)]=all.slice(i*4,i*4+4);rr('NACIONAL',sets,true,0,false);for(const [i,p]of ['OCTAVOS','CUARTOS','SEMIFINAL','FINAL'].entries())ko(p,(7+i*2)*7,2);ko('PROMOCION',15*7,2);
  }
  l.rounds=events.map(e=>e.id);l.format=r.mode;return events;
 }
 function buildCalendar(events){
  if(!enabled())return events;const ids=GameState.world.leagues.filter(l=>rules[l.id]).map(l=>l.id),start=`${GameState.year}-01-24`,end=`${GameState.year}-12-20`;
  const generated=ids.flatMap(id=>{
   const list=buildLeagueCalendar(id,GameState.year,start),last=list.map(e=>e.date).sort().at(-1);
   /* Legacy annual careers retain their annual boundary; independent seasons reshape these later. */
   if(last>end){const from=+new Date(start),span=+new Date(last)-from,target=+new Date(end)-from;for(const e of list){e.date=iso(from+Math.floor((+new Date(e.date)-from)*target/span/DAY)*DAY);e.calendarProvenance='Fechas adaptadas al calendario anual de la carrera, no fixture oficial.'}}
   return list;
  });
  return [...events.filter(e=>!ids.includes(e.leagueId)),...generated];
 }
 function updateTables(e,g,result){if(!local(e)||e.phase==='knockout')return;const t=state(e.leagueId).tables[e.pyramidPhase]?.[g.pyramidGroup||'General'];for(const [id,gf,gc]of [[g.home,result.home,result.away],[g.away,result.away,result.home]])add(t,id,gf,gc)}
 function fillGroups(id,phase,sets,carry=false,bonus={}){
  const s=state(id);if(Object.keys(s.tables[phase]||{}).length)return;s.tables[phase]={};
  for(const [key,ids]of Object.entries(sets)){s.tables[phase][key]=carry?Object.fromEntries(ids.map(pid=>[pid,copy(league(id).standings[pid])])):blank(ids);for(const pid of ids)if(bonus[pid])s.tables[phase][key][pid].pts+=bonus[pid];const rounds=WORLD_ENGINE.roundRobin(ids,true);for(let i=0;i<rounds.length;i++){const e=GameState.calendar.find(e=>e.pyramid&&e.leagueId===id&&e.pyramidPhase===phase&&e.round===i+1);if(e){e.games.push(...rounds[i].map(g=>({...g,pyramidGroup:key})));e.done=false}}}
 }
 function ties(id,phase,pairs){
  const s=state(id),stage=s?.stages[phase];if(!stage||stage.ties.length)return;const events=GameState.calendar.filter(e=>e.pyramid&&e.leagueId===id&&e.pyramidPhase===phase).sort((a,b)=>a.pyramidLeg-b.pyramidLeg);
  for(const [i,[high,low]]of pairs.entries()){if(!high||!low||high===low)continue;const t={id:`${s.year}-${id}-${phase}-${i}`,home:high,away:low,legs:[],winner:null};for(const e of events){const last=e===events.at(-1),g={home:events.length===1||last?high:low,away:events.length===1||last?low:high,result:null,tieId:t.id,eventId:e.id,neutral:!!e.neutral};e.games.push(g);e.done=false;t.legs.push(g)}stage.ties.push(t)}
 }
 function currentTie(e,g){return state(e.leagueId)?.stages[e.pyramidPhase]?.ties.find(t=>t.id===g?.tieId)}
 function totals(t,g=null,result=null){const sum={[t.home]:0,[t.away]:0};for(const leg of t.legs){const r=leg===g?result:leg.result;if(r){sum[leg.home]+=r.home;sum[leg.away]+=r.away}}return sum}
 function tied(e,g,score){if(!local(e)||e.phase!=='knockout')return false;const t=currentTie(e,g);if(!t||t.legs.at(-1)!==g)return false;const sum=totals(t,g,{home:score[0],away:score[1]});return sum[t.home]===sum[t.away]}
 function needsPenalties(m,e,g){if(!local(e))return null;return !e.pyramidAdvantage&&tied(e,g,m.score)}
 function extraRequired(e){return local(e)&&e.phase==='knockout'&&['GB2','ES2','IT2','L2','FR2'].includes(e.leagueId)&&e.pyramidLast}
 function shootout(){let home=0,away=0;for(let i=0;i<5;i++){home+=Math.random()<.76;away+=Math.random()<.76}for(let i=0;home===away&&i<100;i++){home+=Math.random()<.76;away+=Math.random()<.76}if(home===away)home++;return{home,away}}
 function settle(id,phase){const stage=state(id).stages[phase];if(!stage?.ties.length||stage.ties.some(t=>t.legs.some(g=>!g.result)))return null;for(const t of stage.ties){if(t.winner)continue;const score=totals(t),last=t.legs.at(-1);t.aggregate={home:score[t.home],away:score[t.away]};if(score[t.home]===score[t.away]){if(stage.advantage){t.winner=t.home;t.sportingAdvantage=true}else{last.result.pen??=shootout();t.winner=last.result.pen.home>last.result.pen.away?last.home:last.away}}else t.winner=score[t.home]>score[t.away]?t.home:t.away;last.result.winner=t.winner}return stage.ties.map(t=>t.winner)}
 const loser=t=>t.winner===t.home?t.away:t.home;
 function promote(id,ids){const s=state(id);for(const pid of eligible(id,ids))if(!s.promoted.includes(pid))s.promoted.push(pid)}
 function crown(id,pid){const s=state(id);if(!pid||s.champion)return;s.champion=pid;if(pid===GameState.userClub.id){MANAGEMENT.transaction(600000,`Campeón de ${league(id).name}`,'premios');GameState.userClub.reputacion=clamp(GameState.userClub.reputacion+5)}news('Campeón del ascenso',`${clubName(pid)} gana ${league(id).name}.`)}
 function phaseDone(id,phase){const ev=GameState.calendar.filter(e=>e.pyramid&&e.leagueId===id&&e.pyramidPhase===phase);return ev.length>0&&ev.every(e=>e.done||e.games.length&&e.games.every(g=>g.result))}
 function sportingRows(id){const s=state(id);return eligible(id,ordered(league(id).standings).map(r=>r.id))}
 function seedRegular(id){
  const s=state(id),r=rules[id],rows=ordered(league(id).standings),ids=eligible(id,rows.map(r=>r.id));s.seeds=ids;crown(id,rows[0]?.id);promote(id,ids.slice(0,r.direct));
  if(['english','spanish'].includes(r.mode))ties(id,'SEMIFINAL',[[ids[2],ids[5]],[ids[3],ids[4]]]);
  if(r.mode==='italian'){
   if(league(id).standings[ids[2]].pts-league(id).standings[ids[3]].pts>14){promote(id,[ids[2]]);s.seasonDone=true}else{
    const candidates=ids.slice(2,8).filter(pid=>league(id).standings[ids[2]].pts-league(id).standings[pid].pts<=14);s.italianCandidates=candidates;
    if(candidates.length===1){promote(id,candidates);s.seasonDone=true}
    else if(candidates.length===2)ties(id,'FINAL',[[candidates[0],candidates[1]]]);
    else if(candidates.length===3){s.italianFinalBye=candidates[0];ties(id,'SEMIFINAL',[[candidates[1],candidates[2]]])}
    else if(candidates.length===4)ties(id,'SEMIFINAL',[[candidates[0],candidates[3]],[candidates[1],candidates[2]]]);
    else if(candidates.length===5){s.italianPreliminaryBye=candidates[2];ties(id,'PRELIMINAR',[[candidates[3],candidates[4]]])}
    else ties(id,'PRELIMINAR',[[candidates[2],candidates[5]],[candidates[3],candidates[4]]]);
   }
  }
  if(r.mode==='brazil')ties(id,'ASCENSO',[[ids[2],ids[5]],[ids[3],ids[4]]]);
  if(r.mode==='french')ties(id,'PLAYOFF_45',[[ids[3],ids[4]]]);
  if(r.mode==='chilean'){s.chileanBye=ids[1];ties(id,'CUARTOS',[[ids[2],ids[7]],[ids[3],ids[6]],[ids[4],ids[5]]])}
  if(r.mode==='german')s.indirectCandidate=ids[2];
  if(r.mode==='direct')s.seasonDone=true;
 }
 function completePhase(e){
  const id=e.leagueId,s=state(id),r=rules[id],p=e.pyramidPhase;if(!e.pyramidLast||s.completed.includes(p)||!phaseDone(id,p))return;
  if(e.phase==='knockout'){
   const w=settle(id,p);if(!w)return;s.completed.push(p);
   if(p==='PROMOCION'){s.indirectWinner=w[0];s.indirectLoser=loser(s.stages[p].ties[0]);if(league(r.upper).clubIds.includes(s.indirectLoser))promote(id,[w[0]]);s.seasonDone=true;return}
   if(['english','spanish','chilean','italian'].includes(r.mode)){
    if(p==='CUARTOS'){const ids=[s.chileanBye,...w].sort((a,b)=>s.seeds.indexOf(a)-s.seeds.indexOf(b));ties(id,'SEMIFINAL',[[ids[0],ids[3]],[ids[1],ids[2]]])}
    else if(p==='PRELIMINAR'){if(s.italianPreliminaryBye)ties(id,'SEMIFINAL',[[s.seeds[2],w[0]],[s.seeds[3],s.italianPreliminaryBye]]);else ties(id,'SEMIFINAL',[[s.seeds[2],w[1]],[s.seeds[3],w[0]]])}
    else if(p==='SEMIFINAL')ties(id,'FINAL',s.italianFinalBye?[[s.italianFinalBye,w[0]]]:[[w[0],w[1]]]);
    else if(p==='FINAL'){promote(id,w);s.seasonDone=true}
   }else if(r.mode==='brazil'){promote(id,w);s.seasonDone=true}
   else if(r.mode==='french'){if(p==='PLAYOFF_45')ties(id,'PLAYOFF_3',[[s.seeds[2],w[0]]]);else if(p==='PLAYOFF_3')s.indirectCandidate=w[0]}
   else if(r.mode==='uruguayan'){
    if(p==='FINAL_COMPETENCIA')s.competitionWinner=w[0];else if(p==='REPECHAJE')seedUruguayPlayoff(id,w[0]);else if(p==='SEMIFINAL')ties(id,'FINAL',[[w[0],w[1]]]);else if(p==='FINAL'){promote(id,w);s.seasonDone=true}
   }else if(r.mode==='bolivian'){
    const next={OCTAVOS:'CUARTOS',CUARTOS:'SEMIFINAL',SEMIFINAL:'FINAL'}[p];if(next)ties(id,next,w.slice(0,w.length/2).map((pid,i)=>[pid,w[w.length-1-i]]));else if(p==='FINAL'){crown(id,w[0]);promote(id,w);s.runner=loser(s.stages[p].ties[0]);s.indirectCandidate=s.runner}
   }else if(r.mode==='peruvian'){
    if(p==='CUARTOS')ties(id,'SEMIFINAL',[[s.peruByes[0],w[1]],[s.peruByes[1],w[0]]]);
    else if(p==='SEMIFINAL'){ties(id,'FINAL',[[w[0],w[1]]]);ties(id,'TERCER_PUESTO',s.stages[p].ties.map(t=>loser(t)).reduce((out,pid,i,arr)=>i===0?[[pid,arr[1]]]:out,[]))}
    else if(p==='FINAL'){crown(id,w[0]);promote(id,w);s.runner=loser(s.stages[p].ties[0]);if(s.thirdWinner)ties(id,'SEGUNDO_ASCENSO',[[s.runner,s.thirdWinner]])}
    else if(p==='TERCER_PUESTO'){s.thirdWinner=w[0];if(s.runner)ties(id,'SEGUNDO_ASCENSO',[[s.runner,w[0]]])}
    else if(p==='SEGUNDO_ASCENSO'){promote(id,w);s.seasonDone=true}
   }else if(r.mode==='colombian'){
    if(p.endsWith('_FINAL')&&p!=='GRAN_FINAL'){s.shortWinners??={};s.shortWinners[p.startsWith('APERTURA')?'APERTURA':'CLAUSURA']=w[0];if(s.shortWinners.CLAUSURA){const a=s.shortWinners.APERTURA,b=s.shortWinners.CLAUSURA;if(a===b){crown(id,a);promote(id,[a,sportingRows(id).find(pid=>pid!==a)]);s.seasonDone=true}else ties(id,'GRAN_FINAL',[[a,b]])}}
    else if(p==='GRAN_FINAL'){crown(id,w[0]);promote(id,w);const runner=loser(s.stages[p].ties[0]),best=sportingRows(id).find(pid=>pid!==w[0]);if(runner===best){promote(id,[runner]);s.seasonDone=true}else ties(id,'SEGUNDO_ASCENSO',[[best,runner]])}
    else if(p==='SEGUNDO_ASCENSO'){promote(id,w);s.seasonDone=true}
   }else if(r.mode==='venezuelan'){
    const prefix=p.startsWith('APERTURA')?'APERTURA':'CLAUSURA';if(p.endsWith('_CUARTOS'))ties(id,prefix+'_SEMIFINAL',[[w[0],w[3]],[w[1],w[2]]]);else if(p.endsWith('_SEMIFINAL'))ties(id,prefix+'_FINAL',[[w[0],w[1]]]);else if(p==='FINAL_ABSOLUTA'){crown(id,w[0]);promote(id,w);s.seasonDone=true}else if(p.endsWith('_FINAL')){s.shortWinners??={};s.shortWinners[prefix]=w[0];if(s.shortWinners.CLAUSURA){if(s.shortWinners.APERTURA===w[0]){crown(id,w[0]);promote(id,w);s.seasonDone=true}else ties(id,'FINAL_ABSOLUTA',[[s.shortWinners.APERTURA,w[0]]])}}
   }
   return;
  }
  s.completed.push(p);
  if(p==='LIGA')seedRegular(id);
  if(r.mode==='ecuadorian'){
   if(p==='INICIAL'){const rows=ordered(s.tables[p].General).map(r=>r.id);fillGroups(id,'HEXAGONALES',{Ascenso:rows.slice(0,6),Permanencia:rows.slice(6)},true)}else{const ids=eligible(id,ordered(s.tables[p].Ascenso).map(r=>r.id));crown(id,ids[0]);promote(id,ids.slice(0,2));s.seasonDone=true}
  }
  if(r.mode==='uruguayan'){
   if(p==='COMPETENCIA'){const groups=Object.values(s.tables[p]);ties(id,'FINAL_COMPETENCIA',[[ordered(groups[0])[0].id,ordered(groups[1])[0].id]])}else if(p==='REGULAR'){const ids=sportingRows(id);s.seeds=ids;crown(id,ids[0]);promote(id,ids.slice(0,2));const candidates=ids.slice(2,6),winner=s.competitionWinner;if(winner&&!ids.slice(0,2).includes(winner)&&!candidates.includes(winner)){s.uruguayBase=candidates.slice(0,3);ties(id,'REPECHAJE',[[candidates[3],winner]])}else{s.uruguayBase=candidates;seedUruguayPlayoff(id)}}
  }
  if(r.mode==='bolivian'&&p==='NACIONAL'){
   const groups=Object.values(s.tables[p]).map(ordered),qualified=groups.flatMap(g=>g.slice(0,2).map(r=>r.id)),thirds=groups.map(g=>g[2]).sort((a,b)=>b.pts-a.pts||(b.gf-b.gc)-(a.gf-a.gc)||b.gf-a.gf).slice(0,4).map(r=>r.id);const ids=[...qualified,...thirds];s.seeds=ids;ties(id,'OCTAVOS',ids.slice(0,8).map((pid,i)=>[pid,ids[15-i]]));
  }
  if(r.mode==='peruvian'){
   if(p==='REGIONAL'){const groups=Object.values(s.tables[p]).map(ordered),a=groups[0].slice(0,6).map(r=>r.id),b=groups[1].slice(0,6).map(r=>r.id),bonus={};for(const g of groups){bonus[g[0].id]=2;bonus[g[1].id]=1}fillGroups(id,'CAMPEONATO',{A:[...a.filter((_,i)=>i%2===0),...b.filter((_,i)=>i%2===1)],B:[...b.filter((_,i)=>i%2===0),...a.filter((_,i)=>i%2===1)]},false,bonus)}
   else{const groups=Object.values(s.tables[p]).map(t=>eligible(id,ordered(t).map(r=>r.id)));s.peruByes=groups.map(g=>g[0]);ties(id,'CUARTOS',[[groups[0][1],groups[1][2]],[groups[1][1],groups[0][2]]])}
  }
  if(r.mode==='colombian'){
   if(p==='APERTURA'||p==='CLAUSURA'){const ids=ordered(s.tables[p].General).slice(0,8).map(r=>r.id);fillGroups(id,p+'_GRUPOS',{A:[ids[0],ids[3],ids[4],ids[7]],B:[ids[1],ids[2],ids[5],ids[6]]});s.groupSeeds??={};s.groupSeeds[p+'_GRUPOS']={A:ids[0],B:ids[1]}}
   else {const table=s.tables[p],seeds=s.groupSeeds?.[p]||{},leaders=Object.entries(table).map(([g,t])=>Object.values(t).sort((a,b)=>b.pts-a.pts||Number(b.id===seeds[g])-Number(a.id===seeds[g])||(b.gf-b.gc)-(a.gf-a.gc))[0].id);ties(id,p.replace('_GRUPOS','_FINAL'),[[leaders[0],leaders[1]]])}
  }
  if(r.mode==='venezuelan'){
   const groups=Object.values(s.tables[p]).map(t=>eligible(id,ordered(t).map(r=>r.id)).slice(0,4));ties(id,p+'_CUARTOS',groups[0].map((pid,i)=>[pid,groups[1][3-i]]));
  }
 }
 function seedUruguayPlayoff(id,extra=null){const s=state(id),ids=[...(s.uruguayBase||[]),...(extra?[extra]:[])].sort((a,b)=>s.seeds.indexOf(a)-s.seeds.indexOf(b));ties(id,'SEMIFINAL',[[ids[0],ids[3]],[ids[1],ids[2]]])}
 function allDone(id,current=null){const events=GameState.calendar.filter(e=>e.type==='LPF'&&e.leagueId===id);return events.length>0&&events.every(e=>e.done||e.id===current?.id||e.games.length===0&&(!e.pyramid||!state(id)?.stages[e.pyramidPhase]?.ties?.length))}
 function topSummary(id){const value=window.FM_REGULATIONS?.enabled()?FM_REGULATIONS.summary()?.[id]:null;if(value)return value;const rows=ordered(league(id).standings),r=Object.values(rules).find(r=>r.upper===id);return{ranking:rows.map(r=>r.id),relegated:rows.slice(-r.promotions).map(r=>r.id),playoff:r.indirect?[rows.at(-r.promotions-1).id]:[]}}
 function ensureInterdivision(id,current=null){const s=state(id),r=rules[id];if(!r.indirect||!s?.indirectCandidate||s.stages.PROMOCION?.ties.length||!allDone(r.upper,current))return;const summary=topSummary(r.upper),opponent=summary.playoff?.[0]||ordered(league(r.upper).standings).at(-r.promotions-1)?.id;if(!opponent)return;ties(id,'PROMOCION',[[opponent,s.indirectCandidate]]);const relevant=GameState.calendar.filter(e=>[id,r.upper].includes(e.leagueId)&&(!e.pyramid||e.pyramidPhase!=='PROMOCION')),last=relevant.map(e=>e.date).sort().at(-1),floor=GameState.today>last?GameState.today:last;for(const e of GameState.calendar.filter(e=>e.pyramid&&e.leagueId===id&&e.pyramidPhase==='PROMOCION')){e.date=iso(+new Date(floor)+(e.pyramidLeg===1?4:8)*DAY);e.interdivisionUpper=r.upper}if(window.FM_SEASONS?.active?.())FM_SEASONS.sort();else GameState.calendar.sort((a,b)=>a.date.localeCompare(b.date)||WORLD_CLOCK.eventSlot(a)-WORLD_CLOCK.eventSlot(b)||a.id.localeCompare(b.id));s.indirectOpponent=opponent}
 function onEventComplete(e){if(!enabled())return;if(local(e))completePhase(e);for(const [id,r]of Object.entries(rules))if([id,r.upper].includes(e.leagueId))ensureInterdivision(id,e)}
 function readyForExchange(id,current=null){const r=rules[id],s=state(id);return !!s&&s.seasonDone&&s.promoted.length>=r.promotions&&allDone(id,current)&&allDone(r.upper,current)&&(!r.indirect||!!s.indirectWinner)}
 function movementSummary(id){const r=rules[id],s=state(id);if(!s)return null;const top=topSummary(r.upper),down=[...(top.relegated||[])];if(s.indirectLoser&&league(r.upper).clubIds.includes(s.indirectLoser))down.push(s.indirectLoser);return{year:s.year,leagueId:id,upper:r.upper,champion:s.champion,promoted:[...s.promoted],relegated:[...new Set(down)],playoff:s.indirectCandidate?{candidate:s.indirectCandidate,opponent:s.indirectOpponent||null,winner:s.indirectWinner||null}:null,ready:readyForExchange(id),movementDone:s.movementDone}}
 function pendingUserPromotion(){if(!enabled())return false;const user=GameState.userClub.id;for(const [id,r]of Object.entries(rules)){const s=state(id);if(r.indirect&&r.upper===GameState.world.userLeagueId&&s&&!s.indirectWinner&&(topSummary(r.upper).playoff||[]).includes(user))return true}return false}
 function onLeagueSeasonEnd(leagueId,record){
  if(!enabled()||!record)return;const id=rules[leagueId]?leagueId:Object.keys(rules).find(id=>rules[id].upper===leagueId),s=id&&state(id);if(!s)return;const movement=movementSummary(id);
  if(leagueId===id){record.champion=s.champion;record.promoted=[...s.promoted];record.sporting={...(record.sporting||{}),pyramid:copy(movement)}}
  const upperRecord=leagueId===rules[id].upper?record:GameState.world.seasonCalendar?.history?.findLast(h=>h.leagueId===rules[id].upper&&h.year===s.year);
  if(upperRecord){upperRecord.relegated=[...movement.relegated];upperRecord.sporting={...(upperRecord.sporting||{}),pyramid:copy(movement)}}
 }
 function beforeLeagueRollover(leagueId,completedSummary=null){
  if(!enabled())return true;const id=rules[leagueId]?leagueId:Object.keys(rules).find(id=>rules[id].upper===leagueId);if(!id||!state(id))return true;const s=state(id),r=rules[id],key=`${id}:${completedSummary?.year??s.year}`;if(GameState.world.pyramids.movementKeys.includes(key)||s.movementDone)return true;
  ensureInterdivision(id);if(!readyForExchange(id))return false;const summary=movementSummary(id),up=league(r.upper),down=league(id),promoted=summary.promoted,relegated=summary.relegated;
  if(promoted.length!==relegated.length||new Set([...promoted,...relegated]).size!==promoted.length+relegated.length)return false;
  const upCount=up.clubIds.length,downCount=down.clubIds.length;up.clubIds=[...up.clubIds.filter(pid=>!relegated.includes(pid)),...promoted];down.clubIds=[...down.clubIds.filter(pid=>!promoted.includes(pid)),...relegated];if(up.clubIds.length!==upCount||down.clubIds.length!==downCount)throw Error('Intercambio de divisiones inconsistente');
  for(const pid of promoted){club(pid).leagueId=up.id;club(pid).relegated=false}for(const pid of relegated){club(pid).leagueId=down.id;club(pid).relegated=true}s.movementDone=true;GameState.world.pyramids.movementKeys.push(key);GameState.world.pyramids.history.unshift({...summary,date:GameState.today,movementDone:true});GameState.world.pyramids.history=GameState.world.pyramids.history.slice(0,140);
  const current=club(GameState.userClub.id);if(current){GameState.world.userLeagueId=current.leagueId;GameState.userClub.leagueId=current.leagueId;GameState.userClub.country=current.country}
  WORLD_ENGINE.reindex();news('Ascensos y descensos',`${league(r.upper).country}: suben ${promoted.map(clubName).join(', ')}; bajan ${relegated.map(clubName).join(', ')}.`);return true;
 }
 function exchangeAnnual(){if(!enabled())return;for(const id of Object.keys(rules))if(state(id)&&!beforeLeagueRollover(id))throw Error(`La definición deportiva de ${league(id).name} todavía no terminó`)}
 function summary(){if(!enabled())return{};return Object.fromEntries(Object.keys(rules).filter(id=>state(id)).map(id=>[id,movementSummary(id)]))}
 function hydrate(candidate=GameState){const p=candidate?.world?.pyramids;if(!p)return;p.movementKeys??=[];p.history??=[];p.leagues??={};const events=new Map(candidate.calendar.map(e=>[e.id,e]));for(const s of Object.values(p.leagues))for(const stage of Object.values(s.stages||{}))for(const t of stage.ties||[])t.legs=t.legs.map(g=>events.get(g.eventId)?.games.find(x=>x.tieId===t.id)||g)}
 function competitionLabel(e){return local(e)?`${league(e.leagueId).name} · ${e.pyramidPhase.replaceAll('_',' ')}${e.phase==='knockout'?` · ${e.pyramidLeg===1?'Ida / único':'Vuelta'}`:` · Fecha ${e.round}`}`:null}
 function renderTable(t,id){return `<div class="ws-list"><table><thead><tr><th>#</th><th>Club</th><th>PJ</th><th>DG</th><th>PTS</th></tr></thead><tbody>${ordered(t).map((r,i)=>`<tr class="${r.id===GameState.userClub.id?'mine':''}"><td>${i+1}</td><td><button data-world-club="${esc(r.id)}">${esc(clubName(r.id))}</button>${club(r.id)?.reserveParentId?' <small title="Filial: no asciende a la división de su primer equipo">B</small>':''}</td><td>${r.pj}</td><td>${r.gf-r.gc}</td><td>${r.pts}</td></tr>`).join('')}</tbody></table></div>`}
 function renderLeague(id){
  const s=state(id),r=rules[id],l=league(id);if(!s||!r)return'';if(ui.league!==id){ui.league=id;ui.phase=Object.keys(s.tables)[0];ui.group='';ui.tab='table';ui.round=''}
  const phases=[...Object.keys(s.tables),...Object.keys(s.stages)],phase=phases.includes(ui.phase)?ui.phase:phases[0],groups=Object.keys(s.tables[phase]||{}),group=groups.includes(ui.group)?ui.group:groups[0],stage=s.stages[phase],movement=movementSummary(id);let body='';
  if(ui.tab==='rules')body=`<div class="ws-reader"><h3>${esc(r.name)}</h3><p>${esc(describe(id))}</p><p>${esc(r.referenceDefinition||'Formato de la temporada de referencia '+l.sourceSeason)}. Las fechas y los sorteos pertenecen a la carrera.</p><p>Los filiales no ascienden a la división de su primer equipo. El intercambio de primera y segunda se realiza una sola vez tras terminar ambas competiciones y la promoción, si corresponde. La tercera categoría queda fuera de la simulación.</p>${l.historicalPool?'<p class="pyramid-warning">Bolivia: pool histórico adaptado de RSSSF 2025, con clubes reales y reservas ficticias explícitas. No representa el sorteo oficial de 2026 ni las ligas departamentales completas.</p>':''}<p>Los atributos, salarios y presupuestos son estimaciones del juego. La ficha del club distingue participantes reales, suplementos históricos y reservas simuladas.</p><a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">Consultar fuente del formato ↗</a></div>`;
  else if(ui.tab==='movement')body=`<div class="ws-reader"><h3>${s.movementDone?'Intercambio realizado':s.seasonDone?'Clasificación deportiva definida':'Ascensos en disputa'}</h3><p><b>Ascienden:</b> ${s.promoted.map(clubName).map(esc).join(', ')||'Pendientes'}</p><p><b>Descienden desde Primera:</b> ${movement.relegated.map(clubName).map(esc).join(', ')||'Pendientes'}</p>${s.indirectCandidate?`<p><b>Promoción:</b> ${esc(clubName(s.indirectCandidate))} vs ${s.indirectOpponent?esc(clubName(s.indirectOpponent)):'rival pendiente'} · ${s.indirectWinner?'ganó '+esc(clubName(s.indirectWinner)):'sin definir'}</p>`:''}<p>La pertenencia cambia al iniciar la siguiente temporada de ambas categorías.</p></div>`;
  else if(ui.tab==='fixtures'){const events=GameState.calendar.filter(e=>e.pyramid&&e.leagueId===id),e=events.find(e=>e.id===ui.round)||events.find(e=>!e.done)||events.at(-1);body=`<label class="field">Jornada<select data-pyramid-round>${events.map(x=>`<option value="${x.id}" ${x===e?'selected':''}>${esc(x.pyramidPhase)} · ${x.round} · ${date(x.date)}</option>`).join('')}</select></label><div class="ws-list">${e?.games.map(g=>`<article class="arg-tie"><span>${esc(clubName(g.home))}</span><b>${g.result?g.result.home+'–'+g.result.away:'vs'}</b><span>${esc(clubName(g.away))}</span></article>`).join('')||'<p>Participantes pendientes o cruce condicional no necesario.</p>'}</div>`}
  else body=`<div class="nw-fields"><label class="field">Fase<select data-pyramid-phase>${phases.map(p=>`<option value="${p}" ${p===phase?'selected':''}>${p.replaceAll('_',' ')}</option>`).join('')}</select></label>${groups.length>1?`<label class="field">Grupo<select data-pyramid-group>${groups.map(g=>`<option ${g===group?'selected':''}>${esc(g)}</option>`).join('')}</select></label>`:''}</div>${group?renderTable(s.tables[phase][group],id):stage?.ties.length?`<div class="ws-list">${stage.ties.map(t=>`<article class="arg-tie"><div>${esc(clubName(t.home))} <b>${t.aggregate?.home??'–'}</b></div><div>${esc(clubName(t.away))} <b>${t.aggregate?.away??'–'}</b></div><small>${t.winner?'Clasificó '+esc(clubName(t.winner)):'Pendiente'}${t.sportingAdvantage?' · ventaja deportiva':''} · ${t.legs.map(g=>g.result?`${g.result.home}–${g.result.away}${g.result.pen?' (pen.)':''}`:date(GameState.calendar.find(e=>e.id===g.eventId)?.date)).join(' / ')}</small></article>`).join('')}</div>`:'<p class="muted">Los participantes se definen por las fases anteriores. Algunos cruces sólo se disputan si son necesarios.</p>'}`;
  return `<section class="ws-workspace pyramid-workspace"><div class="reg-heading"><strong>${esc(r.name)}</strong><span>${s.champion?'Campeón: '+esc(clubName(s.champion)):'Temporada '+s.year}</span></div><nav class="ws-tabs">${[['table','Fases y tabla'],['fixtures','Calendario'],['movement','Ascensos'],['rules','Reglamento']].map(([key,name])=>`<button data-pyramid-tab="${key}" class="${ui.tab===key?'selected':''}">${name}</button>`).join('')}</nav><section class="ws-panel arg-panel">${body}</section></section>`;
 }
 function describe(id){return {
 GB2:'24 equipos, 46 jornadas de ida y vuelta. Dos ascensos directos; del tercero al sexto juegan semifinales de ida y vuelta y final única neutral por el tercer ascenso.',ES2:'22 equipos, 42 jornadas. Dos ascensos directos y playoff de tercero a sexto con semifinales y final de ida y vuelta. En empate tras la prórroga prevalece la mejor clasificación regular; no se decide por penales.',IT2:'20 equipos y 38 jornadas. Dos ascensos directos. Si el tercero supera al cuarto por más de catorce puntos, asciende directamente. En caso contrario participan hasta seis clubes que estén a catorce puntos del tercero: preliminar, semifinales y final. La mejor posición regular resuelve empates.',L2:'18 equipos y 34 fechas. Primero y segundo ascienden. El tercero juega una promoción de ida y vuelta contra el puesto 16 de Bundesliga, sin gol visitante.',FR2:'18 equipos y 34 fechas. Los dos primeros ascienden. Quinto visita al cuarto; su ganador visita al tercero. El vencedor disputa ida y vuelta con el puesto 16 de Ligue 1.',BRA2:'20 equipos y 38 fechas. Desde la edición 2026 ascienden primero y segundo; tercero contra sexto y cuarto contra quinto definen otras dos plazas en cruces de ida y vuelta.',CHI2:'16 equipos y 30 jornadas. El campeón asciende; del segundo al octavo disputan liguilla. El segundo entra en semifinales; tercero contra octavo, cuarto contra séptimo y quinto contra sexto juegan cuartos. El ganador de la final asciende.',URU2:'14 clubes. Competencia en dos series de siete a una rueda y final entre ganadores. Sus seis partidos de grupos suman a la anual; la fase regular agrega 26 partidos. Ascienden los dos primeros; tercero a sexto juegan por el tercer ascenso. El ganador de Competencia conserva acceso al playoff si queda fuera de esos puestos.',PAR2:'16 equipos, treinta fechas de ida y vuelta y ascenso para los dos primeros.',ECU2:'12 equipos, 22 jornadas iniciales. Dos hexagonales de seis a ida y vuelta, conservando los puntos. Los dos primeros clubes habilitados del hexagonal de ascenso suben a Serie A.',PER2:'18 equipos en dos grupos regionales de nueve, ida y vuelta. Los seis primeros de cada grupo pasan a dos grupos de campeonato, con bonificación de referencia de dos puntos al primero y uno al segundo. Tres por grupo entran en playoffs: líderes a semifinales y segundos/terceros a cuartos. Se juega final, tercer puesto y definición del segundo ascenso; definición de referencia 2025 adaptada al cuadro 2026.',COL2:'Dos torneos con fase regular, dos cuadrangulares de cuatro y final de ida y vuelta. Los campeones disputan la gran final por el primer ascenso. El subcampeón asciende si también es el mejor de la reclasificación entre los no ascendidos; de lo contrario disputa la segunda plaza con ese líder. Si un club gana ambos torneos, asciende junto al mejor restante de la reclasificación.',VEN2:'Dos zonas regionales y torneos Apertura y Clausura. Los cuatro primeros habilitados de cada zona disputan cuartos cruzados, semifinales y final de ida y vuelta. Los dos campeones definen el ascenso; ganar ambos torneos lo concede directamente. El reparto regional y las fechas son adaptaciones de carrera.',BOL2:'Fase nacional de una copa de ascenso regional: seis grupos de cuatro a ida y vuelta; clasifican los dos primeros y los cuatro mejores terceros. Octavos, cuartos, semifinales y final de ida y vuelta. El campeón asciende y el subcampeón juega promoción con el penúltimo de Primera. No se presenta como una liga nacional regular.'
 }[id]||''}
 const base={...FM_COMPETITIONS};
 FM_COMPETITIONS.initializeNewCareer=function(){base.initializeNewCareer();initialize()};
 FM_COMPETITIONS.buildCalendar=events=>buildCalendar(base.buildCalendar(events));
 FM_COMPETITIONS.updatesTable=e=>local(e)?!!e.annual:base.updatesTable(e);
 FM_COMPETITIONS.updateTables=(e,g,r)=>local(e)?updateTables(e,g,r):base.updateTables(e,g,r);
 FM_COMPETITIONS.onEventComplete=e=>{if(!local(e))base.onEventComplete(e);onEventComplete(e)};
 FM_COMPETITIONS.needsPenalties=(m,e,g)=>local(e)?needsPenalties(m,e,g):base.needsPenalties(m,e,g);
 FM_COMPETITIONS.competitionLabel=e=>competitionLabel(e)||base.competitionLabel(e);
 FM_COMPETITIONS.hydrate=candidate=>{base.hydrate(candidate);hydrate(candidate)};
 FM_COMPETITIONS.objectiveResult=(place,goal,fallback)=>{const id=GameState?.world?.userLeagueId;if(enabled()&&rules[id]){if(goal.includes('campe'))return state(id)?.champion===GameState.userClub.id;if(goal.includes('ascen'))return state(id)?.promoted.includes(GameState.userClub.id);if(goal.includes('descenso'))return true}if(enabled()&&goal.includes('descenso')){const lowerId=Object.keys(rules).find(lowerId=>rules[lowerId].upper===id);if(lowerId&&state(lowerId))return !movementSummary(lowerId).relegated.includes(GameState.userClub.id)}return base.objectiveResult(place,goal,fallback)};
 if(typeof seasonReport==='function'){const previousReport=seasonReport;seasonReport=function(){const id=GameState?.world?.userLeagueId;if(!enabled()||!GameState.finished)return previousReport();if(rules[id]){const s=state(id);return `${league(id).name}: campeón ${clubName(s.champion)}. ${s.promoted.includes(GameState.userClub.id)?'Tu club consiguió el ascenso.':'Tu club conserva su plaza en esta categoría.'}`}const lowerId=Object.keys(rules).find(lowerId=>rules[lowerId].upper===id),s=lowerId&&state(lowerId);if(s?.indirectWinner&&s.indirectLoser===GameState.userClub.id)return `${previousReport()} La derrota en la promoción confirmó el descenso a ${league(lowerId).name}.`;return previousReport()}}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-pyramid-tab]');if(b){ui.tab=b.dataset.pyramidTab;render()}});
 document.addEventListener('change',e=>{if(e.target.hasAttribute('data-pyramid-phase')){ui.phase=e.target.value;ui.group='';render()}if(e.target.hasAttribute('data-pyramid-group')){ui.group=e.target.value;render()}if(e.target.hasAttribute('data-pyramid-round')){ui.round=e.target.value;render()}});
 return {rules,ui,enabled,initialize,hydrate,ensureSquads,local,ordered,phaseWindows,buildCalendar,buildLeagueCalendar,updatesTable:e=>!!e.annual,updateTables,onEventComplete,onLeagueSeasonEnd,needsPenalties,extraRequired,tied,competitionLabel,summary,movementSummary,pendingUserPromotion,beforeLeagueRollover,exchangeAnnual,readyForExchange,ensureInterdivision,render:renderLeague,describe,eligible};
})();
