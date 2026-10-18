/* Rows are compact, permanent season/club/competition aggregates, independent of report retention. */
window.FM_STATS=(()=>{
  const columns=['Temporada','Club','Competición','PJ','Minutos','Goles','Asistencias','Amarillas','Rojas','Suma de notas'];
  function record(event,g,result,data={}){
    if(!event||!g||g.statisticsRecorded||GameState.world.initializingHistory)return false;
    const year=event.seasonYear??Number(event.date.slice(0,4)),competition=event.extraCupId||event.localCompetition||event.type;
    for(let side=0;side<2;side++)for(const id of new Set(data.lineups?.[side]||[])){
      const p=player(id),played=Number(data.minutes?.[id]||0);if(!p||played<=0)continue;
      const clubId=side?g.away:g.home,season=event.type==='LPF'?(FM_SEASONS.leagueSeason(club(clubId)?.leagueId)?.label||String(year)):String(year);p.careerStats??=[];
      let row=p.careerStats.find(r=>r[0]===season&&r[1]===clubId&&r[2]===competition);if(!row){row=[season,clubId,competition,0,0,0,0,0,0,0];p.careerStats.push(row);}
      row[3]++;row[4]+=played;row[5]+=(data.scorers||[]).filter(r=>r.playerId===id).length;row[6]+=(data.assists||[]).filter(r=>r.playerId===id).length;
      row[7]+=(data.cards||[]).filter(c=>c.playerId===id&&c.type!=='roja directa').length;row[8]+=(data.cards||[]).filter(c=>c.playerId===id&&(c.type==='roja directa'||c.type==='doble amarilla')).length;row[9]+=Math.max(0,Number(data.ratings?.[id])||6.5);
    }
    g.statisticsRecorded=true;return true;
  }
  function recordLive(m,result,event){const g=event?.games.find(g=>g.home===m.home&&g.away===m.away);if(!g)return false;const ids=[...new Set([...Object.keys(m.ratings||{}),...Object.keys(m.minutesPlayed||{})].map(Number))],lineups=[[],[]],scorers=[],assists=[],cards=[];for(const id of ids){const p=player(id);if(!p)continue;const side=p.clubId===m.home?0:1;lineups[side].push(id);for(let n=0;n<(m.playerStats?.[id]?.goals||0);n++)scorers.push({playerId:id});for(let n=0;n<(m.playerStats?.[id]?.assists||0);n++)assists.push({playerId:id});for(let n=0;n<(m.yellow?.[id]||0);n++)cards.push({playerId:id,type:'amarilla'});if(m.red?.includes(id))cards.push({playerId:id,type:'roja directa'});}return record(event,g,result,{lineups,minutes:m.minutesPlayed,ratings:m.ratings,scorers,assists,cards});}
  function rows(id,filter={}){return (player(Number(id))?.careerStats||[]).filter(r=>(!filter.club||r[1]===filter.club)&&(!filter.season||r[0]===filter.season)&&(!filter.competition||r[2]===filter.competition)).map(r=>({season:r[0],clubId:r[1],competition:r[2],appearances:r[3],minutes:r[4],goals:r[5],assists:r[6],yellow:r[7],red:r[8],rating:r[3]?r[9]/r[3]:0}));}
  function table(id){return `<div class="scroll"><table><thead><tr>${['Temporada','Club','Competición','PJ','Min','G','A','TA','TR','Nota'].map(x=>'<th>'+x+'</th>').join('')}</tr></thead><tbody>${rows(id).map(r=>`<tr><td>${esc(r.season)}</td><td>${esc(club(r.clubId)?.nombre||r.clubId)}</td><td>${esc(r.competition)}</td><td>${r.appearances}</td><td>${r.minutes}</td><td>${r.goals}</td><td>${r.assists}</td><td>${r.yellow}</td><td>${r.red}</td><td>${r.rating.toFixed(2)}</td></tr>`).join('')||'<tr><td colspan="10">Se registrarán las participaciones desde esta actualización. Los totales anteriores permanecen en la ficha.</td></tr>'}</tbody></table></div>`;}
  function page(){const selected=ui.playerId&&player(ui.playerId)?.clubId===GameState.userClub.id?ui.playerId:mine()[0]?.id;return `<section class="card pro-fill"><h2>Trayectoria estadística</h2><label>Jugador <select data-pro-stat-player>${mine().map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></label>${table(selected)}</section>`;}
  const ui={playerId:null};document.addEventListener('change',e=>{if(e.target.hasAttribute('data-pro-stat-player')){ui.playerId=Number(e.target.value);render();}});
  return{record,recordLive,rows,table,page,columns};
})();
