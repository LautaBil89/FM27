/* Persistent career universe with optional independent country seasons. Real identities, simulated sporting and financial progression. */
(() => {
  const legacy = {newCareer, currentEvent, fixture, completeEvent, advance, finishMatch, nextSeason, seasonReport, autoLineup, startMatch, available, aiXI,club,player,squad,foreigners};
  const DAY = 86400000;
  const isWorld = () => GameState?.worldVersion === 1;
  const copy = value => structuredClone(value);
  const blankTable = ids => Object.fromEntries(ids.map(id => [id, {id,pj:0,g:0,e:0,p:0,gf:0,gc:0,pts:0}]));
  const iso = value => new Date(value).toISOString().slice(0,10);
  const dayAt = (year, month, day) => iso(Date.UTC(year,month-1,day));
  function continentalDate(year,month,day,type,final=false){const value=new Date(Date.UTC(year,month-1,day)),desired=final?(type==='LIB'?6:0):(type==='LIB'?2:3);value.setUTCDate(value.getUTCDate()+desired-value.getUTCDay());return iso(value)}
  const age = (birth, today) => {const [y,m,d]=birth.split('-').map(Number),[cy,cm,cd]=today.split('-').map(Number);return cy-y-((cm<m||(cm===m&&cd<d))?1:0)};
  let indexedState=null, indexedLength=-1, playersById=new Map(), clubsById=new Map(), squadsById=new Map();
  let identityState=null;
  function nextPlayerId(){
    if(!isWorld())return Math.max(0,...GameState.players.map(p=>p.id))+1;
    const w=GameState.world;
    if(identityState!==GameState){
      const reserves=Object.values(w.lifecycle?.reserve?.clubs||{}).flatMap(c=>c.youth||[]),academies=Object.values(w.development?.clubs||{}).flatMap(c=>c.academy||[]);
      w.nextPlayerIdentity=Math.max(Number(w.nextPlayerIdentity)||1,...GameState.players.map(p=>p.id+1),...Object.keys(w.lifecycle?.retired||{}).map(id=>Number(id)+1),...reserves.map(p=>p.id+1),...academies.map(p=>p.id+1));identityState=GameState;
    }
    return w.nextPlayerIdentity++;
  }
  function indexState(force=false) {
    if(!GameState)return;
    if(!force&&indexedState===GameState&&indexedLength===GameState.players.length)return;
    indexedState=GameState;indexedLength=GameState.players.length;
    playersById=new Map(GameState.players.map(p=>[p.id,p]));
    clubsById=new Map((isWorld()?GameState.world.clubs:[...GameState.league,...GameState.continental,...(GameState.external||[])]).map(c=>[c.id,c]));
    squadsById=new Map();for(const p of GameState.players){if(!squadsById.has(p.clubId))squadsById.set(p.clubId,[]);squadsById.get(p.clubId).push(p)}
  }
  club=id=>{if(!isWorld())return legacy.club(id);indexState();return clubsById.get(id)};
  player=id=>{if(!isWorld())return legacy.player(id);indexState();return playersById.get(Number(id))||GameState.world.lifecycle?.retired?.[Number(id)]?.player||GameState.world.lifecycle?.retired?.[Number(id)]||window.FM_LIFECYCLE?.lookup(Number(id))};
  squad=id=>{if(!isWorld())return legacy.squad(id);indexState();return [...(squadsById.get(id)||[])]};
  const league = id => (isWorld()?GameState.world.leagues:WORLD_DATABASE.leagues).find(l=>l.id===id);
  const userLeague = () => isWorld()?league(GameState.world.userLeagueId):null;
  function countryOfClub(id){return club(id)?.country||'Argentina'}
  function isForeign(p,clubId=GameState?.userClub.id){if(!p)return false;if(window.FM_REGISTRATION?.isForeign)return FM_REGISTRATION.isForeign(p,clubId);const country=countryOfClub(clubId),nationalities=p.nationalities||p.transfermarkt?.nationalities||[p.nacionalidad];return !nationalities.includes(country)&&!(country==='Argentina'&&p.registrationArgentina)}
  function foreignLimit(clubId=GameState?.userClub.id){if(!isWorld())return 6;const registration=window.FM_REGISTRATION?.profile?.(clubId);if(Number.isFinite(registration?.foreignSquad))return registration.foreignSquad;const limit=league(club(clubId)?.leagueId)?.foreignLimit;return Number.isFinite(limit)&&limit>=0?limit:99}
  foreigners=id=>isWorld()?squad(id).filter(p=>p.registered!==false&&isForeign(p,id)).length:legacy.foreigners(id);
  function hasContinentalCompetition(id){return [...Object.values(GameState.world.cups||{}),...Object.values(GameState.world.extraCompetitions?.cups||{}).filter(c=>['UCL','UEL','UEC','LIB_PRE','SUD_PRE'].includes(c.type))].some(c=>c.participants?.includes(id)&&!c.winner&&c.status!=='completed')}
  function qualificationSlots(l=userLeague()) {
    if(!l)return{lib:4,sud:4,relegation:2,promotion:0,champions:0,europa:0,conference:0};
    const relegation=window.FM_REGULATIONS?.enabled()?FM_REGULATIONS.rules[l.id]?.relegation|| (l.id==='ARG1'?2:0):l.id==='ARG1'?2:0;
    if(l.tier===2)return{lib:0,sud:0,relegation:0,promotion:window.FM_PYRAMIDS?.rules[l.id]?.promotions||2,champions:0,europa:0,conference:0};
    if(l.confederation==='UEFA')return{lib:0,sud:0,relegation,promotion:0,champions:4,europa:2,conference:1};
    const references=WORLD_DATABASE.startingCups;
    const count=type=>references?.[type]?.teams?.filter(id=>WORLD_DATABASE.clubs.find(c=>c.id===id)?.country===l.country).length;
    return {lib:count('LIB')??(['ARG1','BRA1'].includes(l.id)?4:3),sud:count('SUD')??(['ARG1','BRA1'].includes(l.id)?6:['COL1','CHI1','ECU1','PAR1'].includes(l.id)?3:2),relegation,promotion:0,champions:0,europa:0,conference:0};
  }
  function hydratePlayerIdentity(p,ref) {
    const nationalities=copy(ref.nationalities||[]),country=nationalities[0]||'Argentina';
    Object.assign(p,{nombre:ref.name,realIdentity:true,fecha_nacimiento:ref.dateOfBirth,birthYear:Number(ref.dateOfBirth.slice(0,4)),posicion:ref.position,positionDetail:ref.positionDetail,nacionalidad:country,nationalities,foot:ref.foot||'Sin dato publicado',heightCm:ref.heightCm,shirtNumber:ref.shirtNumber||ref.playerId%25+1,registrationArgentina:nationalities.includes('Argentina'),argentineCitizen:country!=='Argentina'&&nationalities.includes('Argentina')});
    p.transfermarkt={playerId:ref.playerId,publishedName:ref.name,profileUrl:ref.profileUrl,sourceUrl:ref.sourceUrl,marketValueEUR:ref.marketValueEUR,valuationDate:ref.valuationDate,valuationCutoff:null,retrievedAt:ref.retrievedAt,season:ref.sourceSeason,dateOfBirth:ref.dateOfBirth,positionDetail:ref.positionDetail,nationalities:copy(nationalities),foot:ref.foot,heightCm:ref.heightCm,shirtNumber:ref.shirtNumber,sourceType:ref.sourceType,valuationSourceUrl:ref.valuationSourceUrl||ref.sourceUrl,valuationSourceType:ref.valuationSourceType||ref.sourceType,contractEnd:ref.contractEnd,valuationStatus:Number.isFinite(ref.marketValueEUR)?(ref.valuationDate?'published_dated':'published_undated'):'not_published'};
    if(ref.realIdentity===false||ref.synthetic){p.realIdentity=false;p.synthetic=true;p.marketValueOrigin='Reserva simulada para completar el plantel; identidad ficticia';delete p.transfermarkt;p.nombre=ref.name.includes('(reserva simulada)')?ref.name:ref.name+' (reserva simulada)'}
    return p;
  }
  function playerFromReference(ref,team=null,id=ref.playerId,careerStart=GameState?.today||'2026-01-17') {
    const c=team||WORLD_DATABASE.clubs.find(c=>c.id===ref.clubId),year=2026;
    const seeded=salt=>{let n=(id*2654435761+salt*7919)>>>0;return n%17-8};
    const value=Number.isFinite(ref.marketValueEUR)&&ref.marketValueEUR>0?Math.round(ref.marketValueEUR*1.1):null;
    const years=age(ref.dateOfBirth,careerStart),valueRating=value?Math.round(48+Math.log10(Math.max(50000,value)/50000)*12):null;
    const rating=clamp(valueRating??((c?.rating||65)-5+seeded(8)*.6),40,94);
    const p={id,clubId:ref.clubId,edad:years,ritmo:clamp(rating+seeded(1),25,99),tiro:clamp(rating+seeded(2),25,99),pase:clamp(rating+seeded(3),25,99),regate:clamp(rating+seeded(4),25,99),defensa:clamp(rating+seeded(5),25,99),fisico:clamp(rating+seeded(6),25,99),condicion_fisica:100,moral:70,estado_forma:6.5,injury:0,ban:0,contract:year+2,goals:0,assists:0,minutes:0,appearances:0,seasonYellow:0,yellowSeason:0,redSeason:0,yellowCards:{LPF:0,LIB:0,SUD:0},form:[],registered:true,trainingFocus:'Equipo',trainingProgress:0,moraleHistory:[],personalidad:['Profesional','Ambicioso','Reservado','Líder'][id%4]};
    hydratePlayerIdentity(p,ref);
    const validReference=typeof ref.contractEnd==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(ref.contractEnd)&&Number.isFinite(Date.parse(ref.contractEnd))&&iso(Date.parse(ref.contractEnd))===ref.contractEnd&&ref.contractEnd>=careerStart,cross=['Inglaterra','España','Italia','Alemania','Francia'].includes(c?.country);p.contractEnd=validReference?ref.contractEnd:`${Number(careerStart.slice(0,4))+2}-${cross?'06-30':'12-31'}`;p.contract=Number(p.contractEnd.slice(0,4));p.contractDateSource=validReference?'published-reference':'career-estimate';p.contractSignedDate=careerStart;
    if(p.posicion==='POR'){p.defensa=rating;p.fisico=rating;p.pase=clamp(rating-6,1,99);p.tiro=25;p.regate=35}
    else if(p.posicion==='DEF'){p.defensa=clamp(rating+3,1,99);p.tiro=clamp(rating-24,1,99)}
    else if(p.posicion==='MED'){p.pase=clamp(rating+3,1,99);p.defensa=clamp(rating-10,1,99)}
    else{p.tiro=clamp(rating+3,1,99);p.defensa=clamp(rating-30,1,99)}
    p.potential=clamp(rating+(years<22?12:years<26?6:1),1,95);
    p.role={POR:'Arquero',DEF:'Defensor central',MED:'Centrocampista',DEL:'Delantero avanzado'}[p.posicion];
    p.valor_mercado=value||Math.max(50000,Math.round(Math.pow(Math.max(1,rating-45),2.3)*1800*(years<25?1.2:years>32?.35:.8)/10000)*10000);
    p.salario=Math.max(100,Math.round(p.valor_mercado/450/100)*100);p.clausula_rescision=Math.round(p.valor_mercado*2.2);
    p.marketValueOrigin=value?'Referencia Transfermarkt EUR convertida a USD de juego':'Estimación de juego; sin tasación utilizable';
    return p;
  }
  function hydrateWorldState(state=GameState) {
    if(!state?.worldVersion)return state;
    const w=state.world,byId=new Map(w.clubs.map(c=>[c.id,c]));
    const local=w.leagues.find(l=>l.id===w.userLeagueId);
    state.league=local.clubIds.map(id=>byId.get(id));state.continental=w.clubs.filter(c=>!local.clubIds.includes(c.id));state.external=[];
    state.standings=local.standings;state.annual=local.standings;
    state.userClub.leagueId=local.id;state.userClub.country=local.country;
    state.cup=w.cups.LIB;
    const events=new Map(state.calendar.map(e=>[e.id,e]));
    for(const cup of Object.values(w.cups))for(const stage of cup.stages)for(const tie of stage.ties)for(let i=0;i<tie.legs.length;i++){
      const old=tie.legs[i],event=events.get(old.eventId),game=event?.games.find(g=>g.tieId===tie.id);
      if(game)tie.legs[i]=game;
    }
    for(const l of w.leagues){l.format??=l.clubIds.length>24||l.doubleRound===false?'single':'double';l.rounds??=[]}
    window.FM_COMPETITIONS?.hydrate(state);ensureClock(state);
    if(state===GameState)indexState(true);
    return state;
  }
  function seededShuffle(array,seed) {
    const out=[...array];let state=seed>>>0;for(let i=out.length-1;i>0;i--){state=(state*1664525+1013904223)>>>0;const j=state%(i+1);[out[i],out[j]]=[out[j],out[i]]}return out;
  }
  function roundRobin(ids,doubleRound=true) {
    const ring=[...ids];if(ring.length%2)ring.push(null);const rounds=[];
    for(let r=0;r<ring.length-1;r++){const games=[];for(let i=0;i<ring.length/2;i++){let a=ring[i],b=ring[ring.length-1-i];if(!a||!b)continue;if((r+i)%2)[a,b]=[b,a];games.push({home:a,away:b,result:null})}rounds.push(games);ring.splice(1,0,ring.pop())}
    return doubleRound?[...rounds,...rounds.map(games=>games.map(g=>({home:g.away,away:g.home,result:null})))]:rounds;
  }
  function sortedRows(table,leagueId=null){const l=isWorld()&&window.FM_REGULATIONS?.enabled()?(leagueId?league(leagueId):GameState.world.leagues.find(l=>l.standings===table)):null;if(l&&FM_REGULATIONS.rules[l.id])return FM_REGULATIONS.ordered(table,l.id);return Object.values(table).sort((a,b)=>b.pts-a.pts||(b.gf-b.gc)-(a.gf-a.gc)||b.gf-a.gf||String(club(a.id)?.nombre||a.id).localeCompare(String(club(b.id)?.nombre||b.id)))}
  function countryDraw(teams,seed,preliminary=[]) {
    const exceptions=new Set(preliminary.filter(id=>teams.includes(id))),sorted=[...teams.filter(id=>!exceptions.has(id))].sort((a,b)=>club(b).rating-club(a).rating||a.localeCompare(b)).concat([...exceptions]);
    const pots=Array.from({length:4},(_,i)=>sorted.slice(i*8,i*8+8));
    const groups=Array.from({length:8},(_,i)=>({id:String.fromCharCode(65+i),teams:[]}));
    const order=pots.flatMap((pot,pi)=>seededShuffle(pot,seed+pi*313));
    function place(index){if(index===32)return true;const pi=Math.floor(index/8),id=order[index],country=countryOfClub(id),options=seededShuffle(groups.map((_,i)=>i),seed+index*191+pi*733);for(const gi of options){const g=groups[gi];if(g.teams.length!==pi||g.teams.some(t=>countryOfClub(t)===country)&&!exceptions.has(id))continue;g.teams.push(id);if(place(index+1))return true;g.teams.pop()}return false}
    if(!place(0))throw Error('No se pudo construir un sorteo continental sin repetir países');
    return groups;
  }
  function qualifiedTeams(previous=null) {
    previous=window.FM_COMPETITIONS?.qualificationRankings(previous)||previous;
    const LIB=[],SUD=[],sources=[],archived=GameState.world.seasonCalendar?.cupHistory?.at(-1),holders=[GameState.world.cups.LIB?.winner||archived?.LIB?.winner,GameState.world.cups.SUD?.winner||archived?.SUD?.winner].filter((id,i,a)=>id&&club(id)&&a.indexOf(id)===i);
    for(const l of GameState.world.leagues.filter(l=>l.confederation==='CONMEBOL'&&l.tier===1)){
      const source=previous?.[l.id]?.filter(id=>l.clubIds.includes(id))||[],ranked=[...source,...l.clubIds.filter(id=>!source.includes(id)).sort((a,b)=>club(b).rating-club(a).rating||a.localeCompare(b))],titleholders=holders.filter(id=>club(id).country===l.country),cupWinner=window.FM_EXTRA_CUPS?.domesticWinner(l.country,Number(GameState.today.slice(0,4))-1),domesticWinner=['Argentina','Brasil','Chile','Colombia','Ecuador','Paraguay'].includes(l.country)&&cupWinner?[cupWinner]:[],ordered=[...titleholders,...domesticWinner,...ranked].filter((id,i,a)=>a.indexOf(id)===i),slots=qualificationSlots(l);
      LIB.push(...ordered.slice(0,slots.lib));sources.push({ordered,slots});
    }
    for(const {ordered,slots}of sources)SUD.push(...ordered.filter(id=>!LIB.includes(id)).slice(0,slots.sud));
    if(LIB.length!==32||SUD.length!==32||new Set([...LIB,...SUD]).size!==64)throw Error('La distribución continental requiere 32 clubes distintos por copa');
    return{LIB,SUD};
  }
  const knockoutDates = (year,type) => type==='LIB'?{R16:[[8,4],[8,11]],QF:[[9,8],[9,15]],SF:[[10,6],[10,13]],FINAL:[[11,21]]}:{PLAYOFF:[[7,7],[7,14]],R16:[[8,5],[8,12]],QF:[[9,9],[9,16]],SF:[[10,7],[10,14]],FINAL:[[11,22]]};
  function makeContinentalCalendar(year,previous=null){const events=[],w=GameState.world;
    const preparation=!previous?.__resolvedCups&&window.FM_EXTRA_CUPS?.prepareContinental(year,previous);if(preparation){w.cups={};return preparation.events;}
    const starting=year===2026&&!previous&&WORLD_DATABASE.startingCups;
    const eligible=previous?.__resolvedCups|| (starting?{LIB:copy(starting.LIB.teams),SUD:copy(starting.SUD.teams)}:qualifiedTeams(previous));w.cups={};
    const realistic=window.FM_SEASONS?.active(),groupDays=realistic?[[4,7],[4,14],[4,28],[5,5],[5,19],[5,26]]:[[3,10],[3,24],[4,7],[4,21],[5,5],[5,19]];
    for(const type of ['LIB','SUD']){
      const groups=starting?copy(starting[type].groups).map(g=>({id:g.id,teams:g.teams})):countryDraw(eligible[type],year+(type==='LIB'?11:37),type==='LIB'?w.extraCompetitions?.preliminaries?.[year]?.libQualified?.slice(-4):w.extraCompetitions?.preliminaries?.[year]?.libLosers);
      const cup={id:type,year,name:type==='LIB'?'Copa Libertadores':'Copa Sudamericana',participants:eligible[type],groups,groupTables:Object.fromEntries(groups.map(g=>[g.id,blankTable(g.teams)])),rounds:[],stages:[],winner:null,groupDone:false,sourceUrl:starting?.[type]?.sourceUrl||null,realStartingGroups:!!starting,sourceFormat:'32 clubes; 8 grupos; ida y vuelta; cruces de ida y vuelta y final única. Grupos iniciales reales 2026; cupos siguientes por tabla anual simulada.'};
      w.cups[type]=cup;const groupSchedules=groups.map(g=>({id:g.id,rounds:roundRobin(g.teams,true)}));
      for(let r=0;r<6;r++){const [month,day]=groupDays[r],id=`${year}-${type}-G-${r+1}`,games=groupSchedules.flatMap(g=>g.rounds[r].map(game=>({...game,group:g.id})));events.push({id,date:continentalDate(year,month,day,type),type,phase:'groups',stage:null,round:r+1,games,done:false});cup.rounds.push(id)}
      const datesByStage=knockoutDates(year,type);if(realistic){if(type==='SUD')datesByStage.PLAYOFF=[[7,21],[7,28]];datesByStage.SF=[[10,20],[10,27]]}for(const [stage,dates]of Object.entries(datesByStage))dates.forEach(([m,d],i)=>events.push({id:`${year}-${type}-${stage}-${i+1}`,date:continentalDate(year,m,d,type,stage==='FINAL'),type,phase:'knockout',stage,neutral:stage==='FINAL',leg:i+1,round:i+1,games:[],done:false}));
    }
    return events;
  }
  function makeWorldCalendar(previous=null) {
    const year=GameState.year,events=[],w=GameState.world,retainedExtras=GameState.calendar.filter(e=>window.FM_EXTRA_CUPS?.owns(e));
    const start=Date.UTC(year,0,24),saturday=new Date(start);while(saturday.getUTCDay()!==6)saturday.setUTCDate(saturday.getUTCDate()+1);
    for(const l of w.leagues){l.standings=blankTable(l.clubIds);l.format=l.clubIds.length>24||l.doubleRound===false?'single':'double';l.rounds=[];const rounds=roundRobin(l.clubIds,l.format==='double');for(let r=0;r<rounds.length;r++){const id=`${year}-${l.id}-${r+1}`;events.push({id,date:iso(+saturday+r*7*DAY),type:'LPF',leagueId:l.id,round:r+1,games:rounds[r],done:false});l.rounds.push(id)}}
    events.push(...makeContinentalCalendar(year,previous));
    let calendar=window.FM_COMPETITIONS?.buildCalendar(events)||events;calendar=window.FM_SEASONS?.reshape(calendar,{initial:true})||calendar;
    const rebuiltIds=new Set(calendar.map(e=>e.id));GameState.calendar=[...calendar,...retainedExtras.filter(e=>!rebuiltIds.has(e.id))].sort((a,b)=>a.date.localeCompare(b.date)||eventSlot(a)-eventSlot(b)||a.id.localeCompare(b.id));
    GameState.eventIndex=0;GameState.today=window.FM_SEASONS?.careerStart()||GameState.calendar[0].date;hydrateWorldState();
  }
  function eventGames(event){return event?.games||[]}
  fixture=e=>isWorld()?eventGames(e).find(g=>g.home===GameState.userClub.id||g.away===GameState.userClub.id)||null:legacy.fixture(e);
  function competitionLabel(e=currentEvent()) {
    const local=window.FM_COMPETITIONS?.competitionLabel(e);if(local)return local;
    if(!e)return'Fin de temporada';if(window.FM_EXTRA_CUPS?.owns(e))return FM_EXTRA_CUPS.label(e);if(e.type==='LPF')return`${league(e.leagueId)?.name||'Liga'} · Fecha ${e.round}`;
    const name=e.type==='LIB'?'Libertadores':'Sudamericana';return e.phase==='groups'?`${name} · Grupos · Fecha ${e.round}`:`${name} · ${{PLAYOFF:'Playoff',R16:'Octavos',QF:'Cuartos',SF:'Semifinales',FINAL:'Final'}[e.stage]||'Eliminatorias'}${e.stage==='FINAL'?'':` · ${e.leg===1?'Ida':'Vuelta'}`}`;
  }
  function buildStage(type,key,pairs) {
    const cup=GameState.world.cups[type];if(cup.stages.some(s=>s.key===key))return;
    const names={PLAYOFF:'Playoff de acceso',R16:'Octavos de final',QF:'Cuartos de final',SF:'Semifinales',FINAL:'Final'};
    const stage={key,name:names[key],ties:[]},legs=key==='FINAL'?1:2;
    pairs.forEach(([home,away],i)=>{
      const year=cup.year??GameState.year,tie={id:`${year}-${type}-${key}-T${i+1}`,home,away,legs:[],aggregate:null,winner:null};
      for(let leg=1;leg<=legs;leg++){const e=GameState.calendar.find(e=>e.id===`${year}-${type}-${key}-${leg}`);const game={home:leg===1?home:away,away:leg===1?away:home,tieId:tie.id,eventId:e.id,result:null,...(key==='FINAL'?{neutral:true}:{})};tie.legs.push(game);e.games.push(game)}stage.ties.push(tie);
    });cup.stages.push(stage);
  }
  function seededCross(first,second,seed,avoidCountries=true,avoidGroups=null) {
    const high=seededShuffle(first,seed),low=seededShuffle(second,seed+19),used=new Set(),pairs=[];
    function draw(i){if(i===high.length)return true;for(const id of low){if(used.has(id)||id===high[i])continue;if(avoidCountries&&countryOfClub(id)===countryOfClub(high[i]))continue;if(avoidGroups&&avoidGroups(id)===avoidGroups(high[i]))continue;used.add(id);pairs.push([id,high[i]]);if(draw(i+1))return true;pairs.pop();used.delete(id)}return false}
    if(draw(0))return pairs;
    if(avoidCountries)return seededCross(first,second,seed,false,avoidGroups);
    if(avoidGroups)return seededCross(first,second,seed,false,null);
    throw Error('No se pudo construir el cuadro de eliminatorias');
  }
  function afterGroups(type) {
    const cup=GameState.world.cups[type];cup.groupDone=true;cup.groupWinners=cup.groups.map(g=>sortedRows(cup.groupTables[g.id])[0].id);cup.groupRunners=cup.groups.map(g=>sortedRows(cup.groupTables[g.id])[1].id);cup.groupThirds=cup.groups.map(g=>sortedRows(cup.groupTables[g.id])[2].id);
    if(type==='LIB'){const groupOf=id=>cup.groups.find(g=>g.teams.includes(id))?.id;buildStage('LIB','R16',seededCross(cup.groupWinners,cup.groupRunners,(cup.year??GameState.year)+151,true,groupOf))}
    const lib=GameState.world.cups.LIB,sud=GameState.world.cups.SUD;
    if(lib.groupDone&&sud.groupDone)buildStage('SUD','PLAYOFF',seededCross(sud.groupRunners,lib.groupThirds,(sud.year??GameState.year)+191,true));
  }
  function currentTie(m=GameState.match){const e=currentEvent(),g=fixture(e);if(!isWorld()||!GameState.world.cups[e?.type]||!g?.tieId)return null;return GameState.world.cups[e.type].stages.find(s=>s.key===e.stage)?.ties.find(t=>t.id===g.tieId)||null}
  function aggregateFor(tie,currentGame=null,result=null) {
    const sum={[tie.home]:0,[tie.away]:0};for(const g of tie.legs){const r=g===currentGame?result:g.result;if(!r)continue;sum[g.home]+=r.home;sum[g.away]+=r.away}return sum;
  }
  function needsPenalties(m) {
    if(!isWorld()||!m)return false;const e=currentEvent(),g=fixture(e);if(window.FM_EXTRA_CUPS?.owns(e))return FM_EXTRA_CUPS.needsPenalties(m,e,g);const local=window.FM_COMPETITIONS?.needsPenalties(m,e,g);if(local!=null)return local;if(!e||e.type==='LPF'||e.phase==='groups')return false;
    const tie=currentTie(m);if(!tie||g!==tie.legs.at(-1))return false;const agg=aggregateFor(tie,g,{home:m.score[0],away:m.score[1]});return agg[tie.home]===agg[tie.away];
  }
  function settleTie(type,stageKey) {
    const cup=GameState.world.cups[type],stage=cup.stages.find(s=>s.key===stageKey);if(!stage)return;
    for(const tie of stage.ties){if(tie.legs.some(g=>!g.result))continue;const totals=aggregateFor(tie),last=tie.legs.at(-1);tie.aggregate={home:totals[tie.home],away:totals[tie.away]};
      if(totals[tie.home]!==totals[tie.away])tie.winner=totals[tie.home]>totals[tie.away]?tie.home:tie.away;
      else{last.result.pen??=penalties(last.home,last.away);tie.winner=last.result.pen.home>last.result.pen.away?last.home:last.away;last.result.winner=tie.winner}
    }
    if(!stage.ties.length||stage.ties.some(t=>!t.winner))return;
    const winners=stage.ties.map(t=>t.winner);
    if(stageKey==='FINAL'){cup.winner=winners[0];if(cup.winner===GameState.userClub.id&&!GameState.world.initializingHistory){MANAGEMENT.transaction(type==='LIB'?5000000:2500000,`Campeón de ${cup.name}`,'premios');GameState.userClub.reputacion=clamp(GameState.userClub.reputacion+(type==='LIB'?10:6))}news(`Campeón de ${cup.name}`,`${club(cup.winner).nombre} levanta el trofeo continental.`)}
    else if(stageKey==='PLAYOFF')buildStage(type,'R16',seededCross(cup.groupWinners,winners,(cup.year??GameState.year)+223,true));
    else{const next={R16:'QF',QF:'SF',SF:'FINAL'}[stageKey];buildStage(type,next,Array.from({length:winners.length/2},(_,i)=>[winners[i*2],winners[i*2+1]]))}
  }
  function registerSquad(id) {const foreign=squad(id).filter(p=>isForeign(p,id)).sort((a,b)=>overall(b)-overall(a));for(const p of squad(id))p.registered=true;for(const p of foreign.slice(typeof registrationLimit==='function'?registrationLimit(id):foreignLimit(id)))p.registered=false}
  let processingEvent=null;
  function syncSuspensions(p){
    const rows=Object.entries(p.suspensions||{}).filter(([,n])=>Number.isInteger(n)&&n>0);
    p.suspensions=Object.fromEntries(rows);p.ban=Math.max(0,...rows.map(([,n])=>n));
    p.banCompetition=rows.length===1&&rows[0][0]!=='ALL'?rows[0][0]:null;
  }
  function suspensionMap(p){
    if(!p)return {};
    const legacy=Math.max(0,Math.trunc(Number(p.ban)||0));
    if(!p.suspensions||typeof p.suspensions!=='object'||Array.isArray(p.suspensions)){
      if(!legacy)return {};
      p.suspensions={[p.banCompetition||'ALL']:legacy};
    }else{
      const entries=Object.entries(p.suspensions).filter(([,n])=>Number.isInteger(n)&&n>0);
      const maximum=Math.max(0,...entries.map(([,n])=>n)),competition=entries.length===1&&entries[0][0]!=='ALL'?entries[0][0]:null;
      // Existing careers and legacy controls can still write the flat fields.
      if(!legacy&&maximum)p.suspensions={};
      else if(legacy&&(legacy!==maximum||(p.banCompetition||null)!==competition))p.suspensions[p.banCompetition||'ALL']=legacy;
    }
    syncSuspensions(p);return p.suspensions;
  }
  function suspensionRemaining(p,event=null){
    const bans=suspensionMap(p);if(!event)return Math.max(0,...Object.values(bans));
    return Math.max(bans.ALL||0,bans[competitionKey(event)]||0);
  }
  function competitionKey(event){return event?.competitionKey||event?.extraCupId||event?.type||'LPF'}
  function awardSuspension(m,p,reason){
    const event=GameState.calendar.find(e=>e.id===m.eventId)||currentEvent(),key=competitionKey(event);
    const bans=suspensionMap(p);p.suspensions={...bans,[key]:Math.max(bans[key]||0,1)};
    p.banReason=reason;syncSuspensions(p);m.newBans??=[];if(!m.newBans.includes(p.id))m.newBans.push(p.id);
  }
  function serveSuspensions(event,m=null){
    const playing=new Set((event.games||[]).flatMap(g=>[g.home,g.away]));
    for(const p of GameState.players){
      if(!playing.has(p.clubId)||!p.ban||m?.newBans?.includes(p.id)||m?.red?.includes(p.id))continue;
      const bans=suspensionMap(p);for(const key of new Set(['ALL',competitionKey(event)]))if(bans[key]>0)bans[key]--;
      syncSuspensions(p);
    }
  }
  function canPlay(p,event=null){
    if(!p||p.retired||p.injury!==0)return false;
    const context=event||processingEvent||(p.clubId===GameState.userClub.id?nextUserEvent():currentEvent());
    return (window.FM_REGISTRATION?.eligible?FM_REGISTRATION.eligible(p,p.clubId,context):p.registered!==false)&&suspensionRemaining(p,context)===0;
  }
  available=p=>isWorld()?canPlay(p):legacy.available(p);

  aiXI=function(id){
    if(!isWorld())return legacy.aiXI(id);
    const tactics=window.CLUB_AI?.tacticsFor(id)||{formation:'4-3-3'},formation=tactics.formation||'4-3-3';
    const slots=window.FM_TACTICS?.slots(formation)||FORMATIONS[formation]||FORMATIONS['4-3-3'];
    const pool=squad(id).filter(available),ids=[],used=new Set(),cap=window.FM_REGISTRATION?.profile(id)?.foreignMatch??99;
    const groups={POR:'POR',DFC:'DEF',LI:'DEF',LD:'DEF',MCD:'MED',MC:'MED',MP:'MED',EI:'DEL',ED:'DEL',DC:'DEL'},foreign=new Map(pool.map(p=>[p.id,isForeign(p,id)])),fitness=new Map(pool.map(p=>[p.id,overall(p)*p.condicion_fisica/100])),scores=new Map();let foreignersUsed=0;
    // Evaluate every player/position once; sorting repeatedly recalculated eligibility and profiles.
    for(const slot of new Set(slots)){const broad=groups[slot]||slot;scores.set(slot,new Map(pool.map(p=>[p.id,(window.FM_TACTICS?.positionFit(p,slot)||((p.posicion===broad)?100:55))*.3+fitness.get(p.id)])))}
    for(const slot of slots){
      const broad=groups[slot]||slot,rank=scores.get(slot);let selected=null;
      for(const p of pool){if(used.has(p.id)||foreign.get(p.id)&&foreignersUsed>=cap||(broad==='POR'?p.posicion!=='POR':p.posicion==='POR'))continue;if(!selected||rank.get(p.id)>rank.get(selected.id)||rank.get(p.id)===rank.get(selected.id)&&p.id<selected.id)selected=p;}
      if(selected){ids.push(selected.id);used.add(selected.id);if(foreign.get(selected.id))foreignersUsed++;}
    }
    return ids;
  };
  autoLineup=function(){if(!isWorld())return legacy.autoLineup();if(GameState.match&&!GameState.match.done)return;indexState(true);if(window.FM_TACTICS){if(FM_TACTICS.validateLineup().valid)return;if(FM_TACTICS.autoSelect())return}legacy.autoLineup()};
  function basicDefaults(s) {
    s.nextMessageId??=1;s.inbox??=[];s.external??=[];s.training??={focus:'Posesión',intensity:'Normal',lastReport:'El cuerpo técnico prepara la primera semana.',sessions:0};s.scouting??={shortlist:[],reports:{},budget:25000};s.finance??={ledger:[],seasonIncome:0,seasonExpense:0,openingBalance:s.userClub.presupuesto_dolares};s.offers??=[];s.transferListed??=[];s.history??=[];s.lastMatch??=null;
    s.userClub.ticketPrice??=18;s.userClub.wageBudget??=300000;s.tactics.roles??={};
  }
  const PERIODS=Object.freeze([{label:'Mañana',time:'08:00'},{label:'Mediodía',time:'12:00'},{label:'Tarde',time:'18:00'},{label:'Noche',time:'21:00'}]);
  const eventSlot=event=>event?.type==='LPF'?2:3;
  function nextUserEvent(state=GameState) {
    if(!state?.worldVersion)return null;
    return state.calendar.find(e=>!e.done&&e.games.some(g=>g.home===state.userClub.id||g.away===state.userClub.id))||null;
  }
  currentEvent=function(){return isWorld()?(nextUserEvent()||GameState.calendar.find(e=>!e.done)||null):legacy.currentEvent()};
  function ensureClock(state=GameState) {
    if(!state?.worldVersion)return null;
    if(!state.world.clock){
      const event=state.match?state.calendar.find(e=>e.id===state.match.eventId):nextUserEvent(state);
      state.world.clock={version:1,slot:state.finished?3:event&&event.date<=state.today?eventSlot(event):0,ticks:0,lastTrainingDate:state.today,lastProcessedDay:state.today,lastMatchNotice:null,recent:[]};
    }
    return state.world.clock;
  }
  function seasonStartDay(year) {
    const saturday=new Date(Date.UTC(year,0,24));while(saturday.getUTCDay()!==6)saturday.setUTCDate(saturday.getUTCDate()+1);
    return iso(+saturday-7*DAY);
  }
  function startPreseason() {
    GameState.today=window.FM_SEASONS?.careerStart()||seasonStartDay(GameState.year);
    GameState.world.clock={version:1,slot:0,ticks:0,lastTrainingDate:null,lastProcessedDay:GameState.today,lastMatchNotice:null,recent:[]};
    GameState.finance.lastFinancialDate=GameState.today;
    for(const p of GameState.players)if(p.fecha_nacimiento)p.edad=age(p.fecha_nacimiento,GameState.today);
    if(window.FM_SEASONS?.active()){FM_SEASONS.warmStart();clockEntry('Comienza la preparación',`El calendario de tu país define la pretemporada. Las otras ligas ya tienen los resultados correspondientes a esta fecha. Cada día tiene cuatro turnos.`);return}
    clockEntry('Comienza la preparación',`Tenés una semana para preparar el plantel antes del inicio de la temporada. Cada día tiene cuatro turnos.`);
  }
  function eventDue(event) {return !!event&&!event.done&&(event.date<GameState.today||event.date===GameState.today&&ensureClock().slot>=eventSlot(event));}
  function matchReady(event=nextUserEvent()) {return !!event&&eventDue(event)&&!!fixture(event);}
  function clockEntry(title,body) {
    const clock=ensureClock();if(!clock)return;
    clock.recent.unshift({date:GameState.today,slot:clock.slot,title,body});clock.recent=clock.recent.slice(0,32);
  }
  function clockInfo() {
    const clock=ensureClock();if(!clock)return null;
    return {slot:clock.slot,...PERIODS[clock.slot],date:GameState.today,progress:clock.slot+1,nextLabel:clock.slot===3?'Mañana · próximo día':PERIODS[clock.slot+1].label,ready:matchReady(),nextEvent:nextUserEvent()};
  }
  function processDueEvents() {
    if(!isWorld()||GameState.match||GameState.finished)return 0;
    let processed=0;
    for(let i=GameState.eventIndex;i<GameState.calendar.length;i++){
      const event=GameState.calendar[i];if(event.date>GameState.today)break;
      if(eventDue(event)&&!fixture(event)&&completeOne(null,event))processed++;
    }
    window.FM_SEASONS?.checkCompletion();
    if(processed)clockEntry('Resultados del día',`Se disputaron ${processed} fechas de otras ligas y copas. Podés revisar sus resultados en Competiciones.`);
    const event=nextUserEvent(),clock=ensureClock();
    if(matchReady(event)&&clock.lastMatchNotice!==event.id){
      clock.lastMatchNotice=event.id;const game=fixture(event),rival=game.home===GameState.userClub.id?game.away:game.home;
      clockEntry('Tu partido está listo',`${competitionLabel(event)}: hoy enfrentás a ${club(rival).nombre}. Prepará la convocatoria y entrá al Centro de partido.`);
      MANAGEMENT.addMessage('Llegó la hora del partido',`${competitionLabel(event)}. ${club(game.home).nombre} recibe a ${club(game.away).nombre}.`, 'partidos',{action:'matchday',eventId:event.id});
    }
    return processed;
  }
  function advanceTurn(options={}) {
    if(!isWorld())return legacy.advance();
    const silent=!!options.silent,clock=ensureClock();
    const finish=changed=>{if(!silent){WORLD_STORAGE.scheduleSave();render()}return changed};
    if(GameState.match){if(!silent)view='match';return finish(false)}
    if(GameState.finished){if(!silent)view='dashboard';return finish(false)}
    processDueEvents();
    if(matchReady()){if(!silent)view='match';return finish(false)}
    if(GameState.finished)return finish(false);
    clock.slot=(clock.slot+1)%4;clock.ticks++;
    if(clock.slot===0){
      const nextDate=iso(+new Date(GameState.today)+DAY);recoverTo(nextDate);settleFinances(nextDate);clock.lastProcessedDay=nextDate;
      const injuries=mine().filter(p=>p.injury>0).length;
      clockEntry('Parte de la mañana',`Recuperación del plantel y actualización del mercado. ${injuries} jugador${injuries===1?' sigue':'es siguen'} en rehabilitación.`);
    }else if(clock.slot===1&&clock.lastTrainingDate!==GameState.today){
      MANAGEMENT.applyTraining(1);window.FM_TACTICS?.trainFamiliarity(1);clock.lastTrainingDate=GameState.today;
      clockEntry('Entrenamiento del plantel',GameState.training.lastReport);
    }else if(clock.slot===2){
      clockEntry('Agenda de la tarde',`${mine().filter(available).length} jugadores disponibles. Revisá las instrucciones y la convocatoria para el próximo partido.`);
    }else if(clock.slot===3){
      const pending=GameState.offers.filter(o=>o.status==='pending').length;
      clockEntry('Cierre de jornada',`${pending} negociación${pending===1?' pendiente':'es pendientes'}. La bandeja de entrada reúne las novedades y decisiones del club.`);
    }
    window.FM_OFFICE?.onTurn();window.CLUB_AI?.processUserOffers();processDueEvents();indexState(true);autoLineup();window.FM_PLAYER?.captureProgress();
    return finish(true);
  }
  function createWorldCareer(managerName,clubId,objective='Clasificar a Libertadores',options={}) {
    const name=String(managerName||'').trim(),reference=WORLD_DATABASE.clubs.find(c=>c.id===clubId);if(!name)return toast('Ingresá el nombre del DT');if(!reference||reference.external||reference.careerSelectable===false)return toast('Elegí un club de la base de datos');
    if(window.FM_CAREERS?.preserveCurrent()===false)return toast('No se pudo conservar la carrera anterior');
    clearInterval(timer);const meta=reference;
    objective=window.FM_OFFICE?.objectiveFor(clubId)||objective;
    GameState={version:3,worldVersion:1,careerId:window.FM_CAREERS?.identity(),manager:name,year:2026,today:'2026-01-24',userClub:{...copy(meta),presupuesto_dolares:meta.budget,presupuesto_pesos:meta.budget*FX,cupos_extranjeros_usados:0,confianza_directiva:70,presion_hinchada:35,reputacion:meta.reputation,wageBudget:meta.wageBudget,ticketPrice:18,objective},world:{userLeagueId:meta.leagueId,leagues:copy(WORLD_DATABASE.leagues),clubs:copy(WORLD_DATABASE.clubs).map(c=>({...c,form:[],relegated:false})),cups:{},rules:'Temporadas anuales simplificadas: ida y vuelta en ligas de hasta 24 clubes; una vuelta en Argentina, con ascenso y descenso entre sus dos divisiones. Copas con cupos por tabla anual y sorteos simulados.'},league:[],continental:[],external:[],players:[],calendar:[],standings:null,annual:null,eventIndex:0,tactics:{formation:'4-3-3',style:'Gegenpress',xi:[],bench:[],mentality:'Equilibrada',tempo:50,width:50,line:50,pressing:50,roles:{},captain:null,penaltyTaker:null},news:[],match:null,finished:false,databaseSnapshot:'Transfermarkt · mundo ampliado · planteles seleccionados 2026 / 2025–26',dataSource:{name:'Transfermarkt',season:'2026 / 2025–26',retrievedAt:WORLD_DATABASE.metadata?.retrievedAt||new Date().toISOString().slice(0,10),eurToUsd:1.10,verifiedPlayers:WORLD_DATABASE.players.length,datedValues:WORLD_DATABASE.players.filter(p=>p.valuationDate&&p.marketValueEUR).length},nextMessageId:1,inbox:[],training:{focus:'Posesión',intensity:'Normal',lastReport:'El cuerpo técnico prepara la primera semana.',sessions:0},scouting:{shortlist:[],reports:{},budget:25000},finance:{ledger:[],seasonIncome:0,seasonExpense:0,openingBalance:meta.budget},offers:[],transferListed:[],history:[],lastMatch:null};
    window.GameState=GameState;GameState.today=options.startMode==='snapshot'?String(WORLD_DATABASE.metadata?.retrievedAt||'2026-10-14').slice(0,10):options.calendarMode==='realistic'&&window.FM_SEASONS?FM_SEASONS.definition(meta.leagueId,GameState.year).preseason:seasonStartDay(GameState.year);GameState.players=WORLD_DATABASE.players.map(ref=>playerFromReference(ref));indexState(true);
    for(const c of GameState.world.clubs)registerSquad(c.id);
    GameState.userClub.wageBudget=Math.max(meta.wageBudget,Math.ceil(MANAGEMENT.wageBill()*1.15/1000)*1000);
    if(options.competitionFormat!=='classic')window.FM_COMPETITIONS?.initializeNewCareer();else window.FM_PYRAMIDS?.initialize();
    window.FM_SEASONS?.initialize(options);
    window.CLUB_AI?.ensure();window.FM_FINANCES?.ensure();makeWorldCalendar();window.FM_EXTRA_CUPS?.ensure();startPreseason();GameState.tactics.captain=mine().sort((a,b)=>b.edad-a.edad)[0]?.id||null;GameState.tactics.penaltyTaker=mine().sort((a,b)=>b.tiro-a.tiro)[0]?.id||null;
    window.CLUB_AI?.ensure();window.FM_TACTICS?.ensure();window.FM_PLAYER?.captureProgress();
    autoLineup();window.FM_DRESSING_ROOM?.ensure();news('Bienvenido al fútbol mundial',`${name} asume en ${meta.nombre}. ${GameState.world.leagues.length} ligas y ${GameState.world.clubs.length} clubes disputan la temporada en paralelo.`);
    MANAGEMENT.addMessage('Reglamento de carrera',GameState.world.rules,'sistema');
    MANAGEMENT.addMessage('Datos de jugadores',`${GameState.players.filter(p=>p.realIdentity).length.toLocaleString('es-AR')} identidades reales provienen de fuentes de planteles identificadas. Hay ${GameState.players.filter(p=>!p.realIdentity).length.toLocaleString('es-AR')} reservas ficticias, marcadas explícitamente, para completar planteles sin cobertura suficiente. Las fichas conservan su fuente, temporada y fecha de tasación cuando existe. Los planteles son selecciones históricas de participantes, con atributos, salarios y contratos simulados; no constituyen un registro oficial de inscripciones actuales. Los juveniles futuros sí son generados por las inferiores.`, 'sistema');
    saveGame(true);view='dashboard';render();return GameState;
  }
  newCareer=function(){if(typeof WORLD_DATABASE==='undefined')return legacy.newCareer();return createWorldCareer($('#manager')?.value,$('#club')?.value,$('#objective')?.value,{competitionFormat:$('#careerCompetitionFormat')?.value||'realistic',calendarMode:$('#careerCalendarMode')?.value||'realistic',startMode:$('#careerStartMode')?.value||'season'})};
  function recoverTo(nextDate) {
    while(GameState.today<nextDate){const day=iso(+new Date(GameState.today)+DAY);if(window.FM_MEDICINE)FM_MEDICINE.onDay(day);for(const p of GameState.players){if(!window.FM_MEDICINE){p.condicion_fisica=clamp(p.condicion_fisica+4);p.injury=Math.max(0,p.injury-1)}if(p.fecha_nacimiento)p.edad=age(p.fecha_nacimiento,day)}GameState.today=day;window.FM_SEASONS?.onDay(day);window.CLUB_AI?.onDayAdvance(day);window.FM_DRESSING_ROOM?.onDayAdvance(day);window.FM_DEPTH?.progress(day);window.FM_OFFICE?.onDay(day);window.FM_DEVELOPMENT?.onDay(day);window.FM_GOVERNANCE?.onDay(day);settleFinances(day);window.FM_FINANCES?.onDay(day);window.FM_INCIDENTS?.onDay(day);window.FM_LIFECYCLE?.onDay(day);window.FM_EXTRA_CUPS?.onDay(day);window.FM_PLAYER?.captureProgress();}
  }
  function settleFinances(day) {
    if(window.FM_FINANCES?.settleLegacy)return FM_FINANCES.settleLegacy(day);
    const f=GameState.finance;f.lastFinancialDate??=day;const weeks=Math.floor((new Date(day)-new Date(f.lastFinancialDate))/(7*DAY));if(weeks<=0)return;
    MANAGEMENT.transaction(-MANAGEMENT.wageBill()*weeks,`Salarios del plantel · ${weeks} semana${weeks>1?'s':''}`,'salarios');MANAGEMENT.transaction(Math.round((club(GameState.userClub.id).capacity||30000)*1.8)*weeks,'Patrocinio semanal','patrocinio');f.lastFinancialDate=iso(+new Date(f.lastFinancialDate)+weeks*7*DAY);
    if(GameState.userClub.presupuesto_dolares<0){GameState.userClub.confianza_directiva=clamp(GameState.userClub.confianza_directiva-3);news('Equilibrio financiero', 'La directiva solicita ventas o una reducción de salarios para recuperar la caja.')}
  }
  function userImpact(g,r,event) {
    const u=GameState.userClub,side=g.home===u.id?0:1,gf=side===0?r.home:r.away,ga=side===0?r.away:r.home,win=gf>ga,draw=gf===ga,mult=isDerby(g)?2:1,delta=(win?8:draw?0:-8)*mult;
    const premium=window.FM_EXTRA_CUPS?.owns(event)?FM_EXTRA_CUPS.prize?.(event)||200000:event.type==='LIB'?1500000:event.type==='SUD'?600000:league(event.leagueId)?.tier===2?80000:200000;
    MANAGEMENT.transaction(win?premium:draw?Math.round(premium*.3):Math.round(premium*.15),`Resultado · ${competitionLabel(event)}`,'premios');u.confianza_directiva=clamp(u.confianza_directiva+(win?4:draw?0:-4)*mult);u.presion_hinchada=clamp(u.presion_hinchada-delta);u.reputacion=clamp(u.reputacion+(event.type==='LPF'?(win?1:0):(win?event.type==='LIB'?4:2:draw?0:-1)));for(const p of mine())p.moral=clamp(p.moral+delta);
    if(g.home===u.id&&!event.neutral){const c=club(u.id),occupation=clamp(.65+u.reputacion/350+(isDerby(g)?.12:0)-(u.ticketPrice-18)*.012,.25,.98),attendance=Math.round((c.capacity||30000)*occupation);MANAGEMENT.transaction(attendance*u.ticketPrice,`Recaudación: ${attendance.toLocaleString('es-AR')} espectadores`,'estadio');if(GameState.match)GameState.match.attendance=attendance}
    news(win?'La gente se ilusiona':draw?'Un empate para analizar':'La prensa aprieta',`${club(g.home).nombre} ${r.home}–${r.away} ${club(g.away).nombre}. ${competitionLabel(event)}.${isDerby(g)?' El clásico deja huella en el vestuario.':''}`);
  }
  function recordLiveMatch(m,result) {
    const measured=Object.values(m.minutesPlayed||{}).some(n=>Number(n)>0);
    const performances=Object.entries(m.ratings).filter(([key])=>player(Number(key))&&(!measured||Number(m.minutesPlayed?.[key])>0));
    const best=performances.slice().sort((a,b)=>b[1]-a[1])[0];
    window.FM_MATCH_ARCHIVE?.record(m,result,processingEvent||currentEvent());
    GameState.lastMatch={fixtureId:m.eventId,date:GameState.today,home:m.home,away:m.away,result:copy(result),stats:copy(m.stats),feed:m.feed.slice(0,8),motm:best?Number(best[0]):null};
    for(const [key,rating]of performances){const p=player(Number(key));p.estado_forma=clamp(rating,1,10);p.form??=[];p.form.push(Number(rating.toFixed(1)));p.form=p.form.slice(-5);p.lastRating=rating;p.appearances++;p.minutes+=(m.minutesPlayed?.[Number(key)]||0);p.seasonYellow=p.yellowSeason||p.seasonYellow||0}
    MANAGEMENT.addMessage('Informe del partido',`${club(m.home).nombre} ${result.home}–${result.away} ${club(m.away).nombre}. Revisá el rendimiento y las estadísticas del encuentro.`, 'partidos',{action:'match',matchDate:GameState.today,fixtureId:m.eventId});
    for(const event of m.injuryEvents||[]){const p=player(event.playerId);if(p?.clubId===GameState.userClub.id)MANAGEMENT.addMessage('Parte médico',`${p.nombre}: ${event.type}, ${p.injury} días estimados de recuperación.`, 'medico',{action:'medical',playerId:p.id});}
  }
  function simulatedStats(g,r,event=processingEvent||currentEvent()) {
    if(g.quickStatsRecorded)return;
    const lineups=[],minutes=r.extraTime?120:90,key=competitionKey(event),newBans=[],cards=[];
    const tuning=window.FM_CALIBRATION?.tuning(event?.leagueId||club(g.home)?.leagueId)||{};
    for(const [side,id,goals,conceded]of [[0,g.home,r.home,r.away],[1,g.away,r.away,r.home]]){
      const xi=aiXI(id);lineups.push(xi);const attackers=xi.filter(pid=>player(pid).posicion!=='POR');
      const notes=new Map(xi.map(pid=>[pid,clamp(6.1+Math.random()*1.1+(goals>conceded?.2:0),1,10)]));
      for(let n=0;n<goals&&attackers.length;n++){
        const scorer=player(pick(attackers));scorer.goals++;notes.set(scorer.id,clamp(notes.get(scorer.id)+.6,1,10));
        const suppliers=attackers.filter(pid=>pid!==scorer.id);if(suppliers.length&&Math.random()<.78){const p=player(pick(suppliers));p.assists++;notes.set(p.id,clamp(notes.get(p.id)+.25,1,10));}
      }
      const derby=isDerby(g)?1.3:1,count=Math.min(7,Math.floor((1+Math.random()*3)*(tuning.yellowFrequency||1)*derby));
      const perMatch={};
      for(let n=0;n<count&&attackers.length;n++){
        const eligible=attackers.filter(pid=>(perMatch[pid]||0)<2);if(!eligible.length)break;const p=player(pick(eligible));p.yellowCards??={LPF:0,LIB:0,SUD:0};p.yellowCards[key]=(p.yellowCards[key]||0)+1;p.yellowSeason=(p.yellowSeason||0)+1;p.seasonYellow=p.yellowSeason;perMatch[p.id]=(perMatch[p.id]||0)+1;
        const red=perMatch[p.id]>=2,threshold=key==='LPF'?5:3;
        cards.push({side,playerId:p.id,type:red?'doble amarilla':'amarilla'});
        if(red){p.redSeason=(p.redSeason||0)+1;awardSuspension({eventId:event?.id,newBans},p,'Doble amarilla');}
        else if(p.yellowCards[key]%threshold===0)awardSuspension({eventId:event?.id,newBans},p,'Acumulación de amarillas');
        notes.set(p.id,clamp(notes.get(p.id)-(red?1:.2),1,10));
      }
      if(attackers.length&&Math.random()<.035*(tuning.redFrequency||1)*derby){const p=player(pick(attackers));p.redSeason=(p.redSeason||0)+1;awardSuspension({eventId:event?.id,newBans},p,'Roja directa');cards.push({side,playerId:p.id,type:'roja directa'});notes.set(p.id,clamp(notes.get(p.id)-1,1,10));}
      for(const pid of xi){const p=player(pid),note=notes.get(pid);p.appearances++;p.minutes+=minutes;p.estado_forma=note;p.lastRating=note;p.form??=[];p.form.push(Number(note.toFixed(2)));p.form=p.form.slice(-5);if(!window.FM_MEDICINE){p.condicion_fisica=clamp(p.condicion_fisica-(r.extraTime?17:13));if(Math.random()<.001)p.injury=rnd(7,21)}}
    }
    g.quickStatsRecorded=true;g.cardSummary=cards;g.newBans=[...new Set(newBans)];
    window.FM_MEDICINE?.afterQuickMatch(event,g,r,lineups);
    window.FM_LIFECYCLE?.observeQuickMatch(event,g,r,lineups);
    window.FM_SCOUT_NETWORK?.observeQuickMatch?.(event,g,r,lineups);
  }
  function finishSeason() {
    if(window.FM_SEASONS?.active())return FM_SEASONS.finishUserSeason();
    if(GameState.finished)return;GameState.finished=true;const l=userLeague(),rows=sortedRows(l.standings),place=rows.findIndex(r=>r.id===GameState.userClub.id)+1,slots=qualificationSlots(l),goal=GameState.userClub.objective.toLowerCase(),championGoal=goal.includes('campe'),qualifying=slots.lib||slots.champions||slots.promotion;
    const fallback=championGoal?place===1:goal.includes('mitad')?place<=Math.ceil(rows.length/2):goal.includes('europeos')?place<=slots.champions+slots.europa+slots.conference:goal.includes('descenso')?place<=rows.length-slots.relegation:place<=qualifying;
    const success=window.FM_COMPETITIONS?.objectiveResult(place,goal,fallback)??fallback,formats=window.FM_COMPETITIONS?.seasonSummary();GameState.userClub.confianza_directiva=clamp(GameState.userClub.confianza_directiva+(success?15:-15));if(place===1&&!(formats&&['ARG1','ARG2'].includes(l.id))&&!(window.FM_REGULATIONS?.enabled()&&FM_REGULATIONS.rules[l.id]))MANAGEMENT.transaction(l.tier===2?1000000:3000000,`Campeón de ${l.name}`,'premios');
    const rankings=Object.fromEntries(GameState.world.leagues.map(l=>[l.id,sortedRows(l.standings).map(r=>r.id)]));
    for(const league of GameState.world.leagues)for(const c of league.clubIds.map(club))c.relegated=qualificationSlots(league).relegation>0&&rankings[league.id].slice(-qualificationSlots(league).relegation).includes(c.id);
    if(formats)for(const id of league('ARG1').clubIds)club(id).relegated=formats.relegated.includes(id);
    const domestic=window.FM_REGULATIONS?.enabled()?FM_REGULATIONS.summary():null;if(domestic){for(const [id,s]of Object.entries(domestic))for(const pid of league(id).clubIds)club(pid).relegated=s.relegated.includes(pid);FM_REGULATIONS.archive()}
    const qualified=window.FM_COMPETITIONS?.qualificationRankings(rankings)?.[l.id]||rows.map(r=>r.id);
    GameState.history.unshift({clubId:GameState.userClub.id,year:GameState.year,leagueId:l.id,position:place,points:l.standings[GameState.userClub.id].pts,champion:domestic?.[l.id]?.champion|| (formats&&l.id==='ARG1'?formats.champions.CLAUSURA:formats&&l.id==='ARG2'?formats.nacionalChampion:rows[0].id),cup:GameState.world.cups.LIB.winner,sudCup:GameState.world.cups.SUD.winner,objectiveMet:success,qualified:qualified.slice(0,slots.lib),sudamericana:qualified.slice(slots.lib,slots.lib+slots.sud),worldRankings:rankings,...(formats?{sportingFormats:formats}:{}),...(domestic?{domesticFormats:domestic}:{})});
    news('Informe de fin de temporada',seasonReport());MANAGEMENT.addMessage(success?'Objetivo cumplido':'Balance de la directiva',`Puesto ${place} en ${l.name}. Confianza ${GameState.userClub.confianza_directiva}%. La tabla define las plazas continentales y los movimientos entre las divisiones argentinas.`, 'directiva',{action:'tables'});
  }
  function completeOne(result=null,event=currentEvent(),options={}) {
    const background=options.background===true;
    if(result&&!fixture(event)&&matchReady())event=nextUserEvent();
    if(!eventDue(event)||fixture(event)&&!result&&!background||window.FM_SEASONS?.eventReady?.(event)===false||window.FM_EXTRA_CUPS?.owns(event)&&FM_EXTRA_CUPS.ready?.(event)===false)return false;
    if(!background)settleFinances(GameState.today);const userGame=fixture(event),m=GameState.match?.eventId===event.id?GameState.match:null;
    const beforeStats=userGame?Object.fromEntries(mine().map(p=>[p.id,{minutes:p.minutes,goals:p.goals,appearances:p.appearances}])):null;
    processingEvent=event;
    try {
    for(const g of event.games){const mineGame=g===userGame,r=mineGame&&result?copy(result):simulated({...g,leagueId:event.leagueId||club(g.home)?.leagueId},false),regular=!window.FM_EXTRA_CUPS?.owns(event)&&(window.FM_COMPETITIONS?.updatesTable(event)??true);r.pen??=null;if(event.phase==='groups'||event.type==='LPF'&&regular&&event.phase!=='knockout')r.pen=null;
      if(!m||!mineGame){if(window.FM_EXTRA_CUPS?.owns(event))FM_EXTRA_CUPS.simulateExtra?.(event,g,r);else window.FM_REGULATIONS?.simulateExtra(event,g,r)}else if(m.extraTime)r.extraTime={home:m.regulationScore[0],away:m.regulationScore[1]};
      if(event.localCompetition&&window.FM_COMPETITIONS?.needsPenalties({score:[r.home,r.away]},event,g)&&!r.pen)r.pen=penalties(g.home,g.away);
      g.result=r;
      if(window.FM_EXTRA_CUPS?.owns(event)){FM_EXTRA_CUPS.recordResult(event,g,r)}else if(event.type==='LPF'){if(regular)updateTable(league(event.leagueId).standings,g,r);window.FM_COMPETITIONS?.updateTables(event,g,r)}else if(event.phase==='groups')updateTable(GameState.world.cups[event.type].groupTables[g.group],g,r);
      if(mineGame&&!background)userImpact(g,r,event);if(!(mineGame&&m))simulatedStats(g,r);
      for(const [side,id]of [[0,g.home],[1,g.away]]){const c=club(id);c.form??=[];c.form.push((side===0?r.home:r.away)>(side===0?r.away:r.home)?'G':r.home===r.away?'E':'P');c.form=c.form.slice(-5)}
    }
    if(m&&result){recordLiveMatch(m,result);window.FM_MEDICINE?.afterMatch(m);window.FM_SCOUT_NETWORK?.observeMatch(m)}
    window.MARKET_CONTRACTS?.recordLoanAppearances?.();
    if(userGame&&!background)window.FM_DRESSING_ROOM?.onMatchResult(event,userGame,userGame.result);
    if(userGame&&!background)window.MARKET_CONTRACTS?.onMatchResult?.(event,userGame,userGame.result,beforeStats);
    serveSuspensions(event,{...(m||{}),newBans:[...(m?.newBans||[]),...event.games.flatMap(g=>g.newBans||[])]});
    if(window.FM_EXTRA_CUPS?.owns(event))FM_EXTRA_CUPS.onEventComplete(event);else if(event.type!=='LPF'){if(event.phase==='groups'&&event.round===6)afterGroups(event.type);else if(event.phase==='knockout')settleTie(event.type,event.stage)}
    window.FM_COMPETITIONS?.onEventComplete(event);
    event.done=true;window.FM_SEASONS?.onEventComplete(event);const remaining=GameState.calendar.findIndex(e=>!e.done);GameState.eventIndex=remaining<0?GameState.calendar.length:remaining;
    if(m){GameState.match=null;clearInterval(timer)}if(!background&&!GameState.calendar.some(e=>!e.done))finishSeason();
    return true;
    }finally{processingEvent=null}
  }
  function seekUserFixture() {processDueEvents();GameState.userClub.cupos_extranjeros_usados=foreigners(GameState.userClub.id);indexState(true);return nextUserEvent()}
  completeEvent=function(userResult=null){if(!isWorld())return legacy.completeEvent(userResult);if(!completeOne(userResult))return false;processDueEvents();if(window.CLUB_AI)CLUB_AI.processUserOffers();else MANAGEMENT.processOffers();indexState(true);autoLineup();view='dashboard';saveGame(true);render();return true};
  finishMatch=function(){if(!isWorld())return legacy.finishMatch();if(!GameState.match?.done)return;const m=GameState.match;if(needsPenalties(m)&&!m.pen)m.pen=penalties(m.home,m.away);if(currentEvent()?.phase==='groups')m.pen=null;completeEvent(getMatchResult())};
  advance=function(){return advanceTurn()};
  seasonReport=function(){if(!isWorld())return legacy.seasonReport();const l=userLeague(),rows=sortedRows(l.standings),place=rows.findIndex(r=>r.id===GameState.userClub.id)+1,slots=qualificationSlots(l);return `Campeón de ${l.name}: ${club(rows[0].id).nombre}. Tu club terminó ${place}º con ${l.standings[GameState.userClub.id].pts} puntos. ${l.tier===2?(place<=2?'Ascendió a Primera División.':'Continúa en Primera Nacional.'):l.id==='ARG1'&&place>rows.length-2?'Descendió a Primera Nacional.':place<=slots.lib?'Clasificó a Libertadores.':place<=slots.lib+slots.sud?'Clasificó a Sudamericana.':slots.champions&&place<=slots.champions?'Terminó en zona europea de Champions · clasificación a copas UEFA.':'Continúa en su liga.'}`};
  function exchangeArgentina(rankings) {
    const first=league('ARG1'),second=league('ARG2');if(!first||!second)return;const moves=window.FM_COMPETITIONS?.promotions(rankings),relegated=moves?.relegated||rankings.ARG1.slice(-2),promoted=moves?.promoted||rankings.ARG2.slice(0,2);if(relegated.length!==2||promoted.length!==2)throw Error('Deben definirse dos ascensos y dos descensos antes de iniciar otra temporada');first.clubIds=[...first.clubIds.filter(id=>!relegated.includes(id)),...promoted];second.clubIds=[...second.clubIds.filter(id=>!promoted.includes(id)),...relegated];
    for(const id of relegated)club(id).leagueId='ARG2';for(const id of promoted)club(id).leagueId='ARG1';const user=club(GameState.userClub.id);GameState.world.userLeagueId=user.leagueId;GameState.userClub.leagueId=user.leagueId;
    news('Ascensos y descensos',`Suben ${promoted.map(id=>club(id).nombre).join(' y ')}. Bajan ${relegated.map(id=>club(id).nombre).join(' y ')}.`);
  }
  function newYouth(id,c,pos) {
    const p=makePlayer(id,c.id,pos,c.rating-rnd(12,20),c.country);p.edad=rnd(17,20);p.birthYear=GameState.year-p.edad;p.realIdentity=false;p.nombre+=' (juvenil)';p.contract=GameState.year+3;p.registrationArgentina=c.country==='Argentina';p.nationalities=[c.country];p.registered=true;p.potential=clamp(overall(p)+rnd(5,17),1,95);p.role={POR:'Arquero',DEF:'Defensor central',MED:'Centrocampista',DEL:'Delantero avanzado'}[pos];p.form=[];p.appearances=0;p.assists=0;p.minutes=0;p.seasonYellow=0;p.trainingFocus='Equipo';p.trainingProgress=0;p.moraleHistory=[];p.personalidad='Profesional';p.shirtNumber=id%25+1;return window.FM_DEPTH?FM_DEPTH.youth(c,p):p;
  }
  nextSeason=function(){
    if(!isWorld())return legacy.nextSeason();if(!GameState.finished)return;if(window.FM_SEASONS?.active())return FM_SEASONS.resumeCareer();const activateRegulations=!!GameState.world.nextRegulations,historicalTotals=activateRegulations&&!GameState.world.regulationsVersion?Object.fromEntries(GameState.world.leagues.map(l=>[l.id,copy(l.standings)])):null;if(activateRegulations&&GameState.world.competitionFormatsVersion)FM_REGULATIONS.initialize();const activateFormat=(GameState.world.nextCompetitionFormat==='realistic'||activateRegulations)&&!GameState.world.competitionFormatsVersion,previousTotals=activateFormat?copy(league('ARG1').standings):null,previousYear=GameState.year;window.CLUB_AI?.beforeNextSeason(GameState.world.nextCalendarMode==='realistic'&&window.FM_SEASONS?FM_SEASONS.definition(GameState.world.userLeagueId,GameState.year+1).preseason:seasonStartDay(GameState.year+1));const previous=GameState.history[0],rankings=previous.worldRankings;exchangeArgentina(rankings);window.FM_PYRAMIDS?.exchangeAnnual?.();window.FM_DEVELOPMENT?.seasonEnd?.(GameState.year);window.FM_MEDICINE?.seasonEnd?.(GameState.year);GameState.year++;window.FM_FINANCES?.onSeason?.(GameState.year);GameState.finished=false;GameState.match=null;GameState.lastMatch=null;GameState.offers=GameState.offers.map(o=>o.status==='pending'&&!o.awaitingRegistration?{...o,status:'expired'}:o);GameState.transferListed=[];GameState.today=seasonStartDay(GameState.year);
    window.MARKET_CONTRACTS?.recordLoanAppearances?.();
    for(const p of GameState.players){if(p.fecha_nacimiento)p.edad=age(p.fecha_nacimiento,GameState.today);else p.edad=GameState.year-p.birthYear;p.goals=0;p.assists=0;p.minutes=0;p.appearances=0;p.seasonYellow=0;p.yellowSeason=0;p.redSeason=0;p.yellowCards={LPF:0,LIB:0,SUD:0};p.form=[];if(!window.FM_MEDICINE){p.injury=0;p.condicion_fisica=100}p.trainingProgress=0;if(p.contract<GameState.year){if(p.clubId===GameState.userClub.id)MANAGEMENT.addMessage('Fin de contrato',`${p.nombre} terminó su contrato y queda libre.`, 'contratos');p.clubId=null;p.contract=GameState.year+1}if(p.edad>33&&!window.FM_DEVELOPMENT?.seasonEnd){p.ritmo=clamp(p.ritmo-1,1,99);p.fisico=clamp(p.fisico-1,1,99)}}
    indexState(true);
    for(const c of GameState.world.clubs){c.form=[];c.relegated=false;const pool=squad(c.id);let size=pool.length+(window.MARKET_CONTRACTS?.returnSlots(c.id)||0)+(window.MARKET_CONTRACTS?.futureSlots?.(c.id)||0);for(const [pos,minimum]of [['POR',3],['DEF',7],['MED',7],['DEL',5]]){let existing=pool.filter(p=>p.posicion===pos).length;while(existing<minimum&&size<32){GameState.players.push(newYouth(nextPlayerId(),c,pos));existing++;size++;}}}
    indexState(true);for(const c of GameState.world.clubs)registerSquad(c.id);if(activateFormat){FM_COMPETITIONS.initializeNewCareer();GameState.world.competitionHistory=[{year:previousYear,totals:previousTotals}];delete GameState.world.nextCompetitionFormat}if(historicalTotals&&GameState.world.regulations){GameState.world.regulations.history=[{year:previousYear,totals:historicalTotals}]}delete GameState.world.nextRegulations;if(GameState.world.nextCalendarMode==='realistic'){FM_SEASONS.initialize({calendarMode:'realistic'});delete GameState.world.nextCalendarMode}makeWorldCalendar(rankings);startPreseason();GameState.finance.seasonIncome=0;GameState.finance.seasonExpense=0;GameState.finance.openingBalance=GameState.userClub.presupuesto_dolares;
    const changed=previous.leagueId!==GameState.world.userLeagueId;MANAGEMENT.transaction(userLeague().tier===2?1500000:previous.position<=4?6000000:3000000,'Aporte para la nueva temporada','directiva');if(changed)GameState.userClub.reputacion=clamp(GameState.userClub.reputacion+(userLeague().tier===2?-8:8));
    window.CLUB_AI?.afterNextSeason();window.FM_TACTICS?.ensure();window.FM_PLAYER?.captureProgress();
    GameState.userClub.wageBudget=Math.max(GameState.userClub.wageBudget,Math.ceil(MANAGEMENT.wageBill()*1.1/1000)*1000);autoLineup();news('Nuevo proyecto',`Temporada ${GameState.year}. ${GameState.userClub.nombre} disputa ${userLeague().name}. La tabla del año anterior define las plazas continentales. Las nuevas promociones juveniles son identidades ficticias de las inferiores.`);view='dashboard';saveGame(true);render();
  };
  function refillLeague(id){indexState(true);for(const c of league(id).clubIds.map(club)){const pool=squad(c.id);let size=pool.length+(window.MARKET_CONTRACTS?.returnSlots(c.id)||0)+(window.MARKET_CONTRACTS?.futureSlots?.(c.id)||0);for(const [pos,minimum]of [['POR',3],['DEF',7],['MED',7],['DEL',5]]){let existing=pool.filter(p=>p.posicion===pos).length;while(existing<minimum&&size<32){GameState.players.push(newYouth(nextPlayerId(),c,pos));existing++;size++}}}indexState(true)}
  startMatch=function(){if(!isWorld())return legacy.startMatch();if(GameState.match){view='match';render();return}if(!matchReady())return toast('Todavía no es la hora del partido. Continuá avanzando los turnos del día.');processDueEvents();const target=nextUserEvent();if(!target||!eventDue(target))return;GameState.eventIndex=GameState.calendar.indexOf(target);if(!fixture(currentEvent()))return;indexState(true);const already=GameState.match;const result=legacy.startMatch();if(!already&&GameState.match&&window.CLUB_AI){const m=GameState.match;m.neutral=!!(fixture(currentEvent())?.neutral||currentEvent()?.neutral);const rival=m.userSide===0?m.away:m.home;m.aiTactics={...m.aiTactics,...CLUB_AI.tacticsFor(rival)};saveGame(true);}return result;};
  Object.assign(actions,{new:()=>newCareer(),finish:()=>finishMatch(),advance:()=>advance(),season:()=>nextSeason(),kickoff:()=>startMatch(),continue:()=>{if(!isWorld()){if(GameState.match){view='match';render()}else if(GameState.finished){view='dashboard';render()}else if(fixture(currentEvent())){view='match';render()}else legacy.advance()}else advanceTurn()}});
  actions.auto=()=>{if(locked())return;if(isWorld()&&window.FM_TACTICS)FM_TACTICS.autoSelect();else legacy.autoLineup();saveGame(true);render()};
  window.WORLD_CLOCK={periods:PERIODS,ensure:ensureClock,info:clockInfo,nextFixture:nextUserEvent,ready:matchReady,latest:()=>ensureClock()?.recent||[],advance:advanceTurn,processDueEvents,eventSlot};
  window.WORLD_ENGINE={hasContinentalCompetition,nextPlayerId,canPlay,discipline:{remaining:suspensionRemaining,pending:p=>({...suspensionMap(p)}),award:awardSuspension,serve:serveSuspensions},league,allLeagues:()=>isWorld()?GameState.world.leagues:WORLD_DATABASE.leagues,allClubs:()=>isWorld()?GameState.world.clubs:WORLD_DATABASE.clubs,userLeague,competitionLabel,competitionKey,eventGames,qualificationSlots,tableFor:id=>league(id)?.standings||{},createWorldCareer,hydrateWorldState,hydrate:hydrateWorldState,hydratePlayerIdentity,playerFromReference,isForeign,foreignLimit,needsPenalties,roundRobin,sortedRows,reindex:()=>indexState(true),seekUserFixture,completeOne,makeWorldCalendar,makeContinentalCalendar,basicDefaults,registerSquad,refillLeague,exchangeArgentina,seasonStartDay,recoverTo,settleFinances,qualifiedTeams,recordLiveMatch,simulatedStats};
})();
