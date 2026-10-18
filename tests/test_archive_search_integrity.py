"""Persisted new modules reject corrupt records and retain bounded complete reports."""
import json
import subprocess
import unittest
import test_world_storage as fixture

EXTRA=r'''
if(scenario==='feature-schema') {
  const guest={id:'uefa-50064',nombre:'Porto',leagueId:'UEFA_GUESTS',external:true};state.world.clubs.push(guest);
  state.tactics.bench=Array.from({length:15},(_,i)=>i+12);
  const event={id:'UCL-schema',type:'UCL',date:'2027-01-20',games:[{home:clubs[0].id,away:guest.id,result:null}],done:false};state.calendar.push(event);
  state.players[0].attributes={pase:67,vision:87,decisiones:42};state.players[0].form=[6.4,8.2];
  storage.validate(state);const restored=storage.decode(plain(storage.encode(state)));assert.strictEqual(restored.tactics.bench.length,15);assert.strictEqual(restored.world.clubs.at(-1).external,true);assert.strictEqual(restored.players[0].attributes.vision,87);
  const invalid=plain(state);delete invalid.world.clubs.at(-1).external;assert.throws(()=>storage.validate(invalid),/pertenencia/);
}
if(scenario==='feature-corruption') {
  state.world.incidents={nextId:2,lastDay:state.today,lastClub:clubs[0].id,history:[{id:'unexpected-1',definitionId:'boots',clubId:clubs[0].id,date:state.today,deadline:'2026-02-04',unit:400,status:'resolved',choice:'a',resolvedDate:state.today,context:{playerId:1,playerName:'Affected player'},followup:{dueDate:'2026-02-05',status:'scheduled',scope:'player',effect:{morale:2}}}],cooldowns:{},lastEvents:{}};
  state.world.marketSearches={[clubs[0].id]:{market:[{id:'search-1',name:'Perfil doble',query:'Pérez',filters:{positions:['DFC','MCD'],groups:[{mode:'any',rules:[{field:'age',op:'lte',value:'23'}]}]}}]}};
  storage.validate(state);const packed=plain(storage.encode(state)),restored=storage.decode(packed);assert.deepStrictEqual(plain(restored.world.incidents),plain(state.world.incidents));assert.deepStrictEqual(plain(restored.world.marketSearches),plain(state.world.marketSearches));
  context.window.saveGame(true);const old=memory.get(context.KEY),current=context.GameState;
  for(const mutate of [s=>s.world.incidents.history[0].definitionId='not-a-situation',s=>s.world.incidents.history[0].followup.effect.morale='NaN',s=>s.players[0].form=['broken'],s=>s.world.marketSearches[clubs[0].id].market[0].filters.groups={}]){const invalid=plain(state);mutate(invalid);assert.throws(()=>storage.importState(invalid,{confirm:false}));assert.strictEqual(context.GameState,current);assert.strictEqual(memory.get(context.KEY),old);}
}
if(scenario==='feature-archive-size') {
  vm.runInContext(fs.readFileSync(process.argv[1].replace('world-storage.js','vendor/lz-string.js'),'utf8'),context);
  const player={id:1,name:'Jugador de informe',position:'POR',side:0,rating:8.7,minutes:90,goals:0,assists:0,shots:0,yellow:0};
  state.world.matchArchive={version:1,reports:Array.from({length:120},(_,i)=>({fixtureId:'archived-'+i,date:state.today,home:clubs[0].id,away:clubs[1].id,clubId:clubs[0].id,competition:'Liga Profesional',eventType:'LPF',result:{home:i%4,away:i%3},minute:90,stats:[{shots:11,xg:1.42,poss:52},{shots:8,xg:.92,poss:38}],players:[{...player}],lineups:[[1],[]],plans:[null,null],finalPlans:[null,null],decisions:[],aiDecisions:[],feed:Array.from({length:90},(_,m)=>({minute:m,text:'Jugada '+m+' del encuentro '+i})),chances:Array.from({length:25},(_,c)=>({minute:c*3,side:c%2,playerId:1,outcome:'atajado',xg:.12})),keyPlays:[],chains:Array.from({length:60},(_,n)=>({id:n,actions:Array.from({length:8},(_,a)=>({minute:a,playerId:1,type:'pase',x:12+a,y:30+n}))})),teamMetrics:[{},{}],playerActions:{1:{passes:42}},complete:true}))};
  state.world.matchArchive.reports[0].abandoned={side:1,reason:'Menos de siete jugadores disponibles',playedScore:[1,1]};state.world.matchArchive.reports[1].shootout=[{side:0,playerId:1,keeperId:2,scored:true}];
  const info=storage.inspect(state);assert(info.localStorageBytes<5*1024*1024,JSON.stringify(info));const decoded=storage.decode(JSON.parse(storage.serialize(state)));assert.strictEqual(decoded.world.matchArchive.reports.length,120);assert.strictEqual(decoded.world.matchArchive.reports.at(-1).chains.length,60);assert.strictEqual(decoded.world.matchArchive.reports[0].players[0].rating,8.7);assert.deepStrictEqual(plain(decoded.world.matchArchive.reports[0].abandoned),plain(state.world.matchArchive.reports[0].abandoned));assert.strictEqual(decoded.world.matchArchive.reports[1].shootout[0].scored,true);console.log(JSON.stringify(info));
}
if(scenario==='purchase-claims') {
  state.world.ai={contracts:{purchaseClaims:[{id:'claim-loan-12',loanId:'loan-12',playerId:1,fromClub:clubs[0].id,toClub:clubs[1].id,amount:500000,status:'pending',date:state.today,reason:'Compra obligatoria sin contrato definitivo'}]}};
  const restored=storage.decode(plain(storage.encode(state)));assert.deepStrictEqual(plain(restored.world.ai.contracts.purchaseClaims),plain(state.world.ai.contracts.purchaseClaims));
  const claim=state.world.ai.contracts.purchaseClaims[0];Object.assign(claim,{status:'settled',settledDate:state.today,compensation:100000,settlementMode:'simulated-mutual-agreement'});storage.validate(state);
  context.window.saveGame(true);const old=memory.get(context.KEY),current=context.GameState;
  for(const mutate of [r=>r.amount=-1,r=>r.compensation=600000,r=>r.fromClub='missing',r=>r.settledDate='2026-02-31',r=>r.status='pending',r=>r.id='unrelated',r=>r.playerId='1']){const invalid=plain(state);mutate(invalid.world.ai.contracts.purchaseClaims[0]);assert.throws(()=>storage.importState(invalid,{confirm:false}));assert.strictEqual(context.GameState,current);assert.strictEqual(memory.get(context.KEY),old);}
}
if(scenario==='pending-preliminaries') {
  const lib=clubs.slice(0,47).map(c=>c.id),sud=clubs.slice(47,91).map(c=>c.id),metadata={year:2026,status:'pending',rankings:{Argentina:clubs.slice(0,10).map(c=>c.id)},direct:lib.slice(0,28),phase1:lib.slice(28,34),phase2:lib.slice(34),sudDirect:sud.slice(0,12),sudNational:sud.slice(12)};
  const extra={version:1,cups:{},preliminaries:{2026:metadata}};
  for(const [type,participants]of [['LIB_PRE',lib],['SUD_PRE',sud]]){const id=type+':2026',eventId=type+'-r1';extra.cups[id]={id,type,year:2026,name:'Preliminar',participants,stages:[],eventIds:[eventId],status:'knockout'};state.calendar.push({id:eventId,type,date:state.today,extraCupId:id,done:false,games:[{home:participants[participants.length-1],away:participants[participants.length-2],result:null}]});}
  state.calendar.sort((a,b)=>a.date.localeCompare(b.date));state.world.cups={};delete state.cup;state.world.extraCompetitions=extra;
  storage.validate(state);const restored=storage.decode(plain(storage.encode(state)));assert.deepStrictEqual(plain(restored.world.cups),{});assert.strictEqual(restored.world.extraCompetitions.preliminaries[2026].status,'pending');
  const invalid=plain(state);delete invalid.world.extraCompetitions.cups['LIB_PRE:2026'];assert.throws(()=>storage.validate(invalid));
}
'''

class ArchiveSearchIntegrity(unittest.TestCase):
    def run_scenario(self, scenario):
        result=subprocess.run([fixture.NODE,'-e',fixture.HARNESS+EXTRA,str(fixture.REPO/'src/world-storage.js'),scenario],capture_output=True,text=True,timeout=75)
        self.assertEqual(result.returncode,0,result.stderr+result.stdout)
        return result.stdout
    def test_guest_clubs_match_rules_and_independent_attributes_roundtrip(self):
        self.run_scenario('feature-schema')
    def test_corrupt_incidents_or_searches_cannot_replace_career(self):
        self.run_scenario('feature-corruption')
    def test_120_full_match_reports_fit_quota_and_roundtrip(self):
        info=json.loads(self.run_scenario('feature-archive-size'))
        self.assertLess(info['localStorageBytes'],5*1024*1024)
    def test_purchase_claims_roundtrip_and_corrupt_liquidation_is_atomic(self):
        self.run_scenario('purchase-claims')
    def test_pending_conmebol_preliminaries_roundtrip_before_group_draw(self):
        self.run_scenario('pending-preliminaries')
