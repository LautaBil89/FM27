"""Cross-system regressions for the 2026-10-18 gameplay upgrade."""
import json
import unittest
import test_offer_form as fixture

class ProfessionalUpgrade(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    seed=fixture.OfferFormScenarios.seed
    def setUp(self):
        fixture.OfferFormScenarios.setUp(self)
        self.page.set_default_timeout(60000)
        self.page.evaluate('async()=>{await FM_CAREER_LOCKS.acquire(GameState)}')
    tearDown=fixture.OfferFormScenarios.tearDown

    def test_import_rejects_invalid_nested_state_without_replacing_current(self):
        r=self.page.evaluate("""()=>{const before=GameState,cash=GameState.userClub.presupuesto_dolares,errors=[];for(const key of ['registration','development','medicine','financialAccounts','programmes']){const copy=structuredClone(GameState);copy.world[key]={version:1,clubs:{boca:{domestic:null,academy:null,training:null}},players:null};try{WORLD_STORAGE.importState(copy,{confirm:false})}catch(e){errors.push(key)}}return{errors,same:before===GameState,cash:cash===GameState.userClub.presupuesto_dolares}}""")
        self.assertEqual(len(r['errors']),5,r);self.assertTrue(r['same']);self.assertTrue(r['cash'])

    def test_two_tabs_cannot_overwrite_and_can_fork_an_independent_copy(self):
        self.page.evaluate('async()=>{await FM_CAREERS.saveCurrent()}')
        other=self.context.new_page();other.set_default_timeout(60000)
        other.goto(fixture.URL,wait_until='domcontentloaded');other.wait_for_selector('aside')
        other.wait_for_function('FM_CAREER_LOCKS.blocked()')
        primary=self.page.evaluate('()=>{GameState.userClub.presupuesto_dolares=1234567;const saved=saveGame(true);return {saved,blocked:FM_CAREER_LOCKS.blocked(),toast:document.querySelector("#toast")?.textContent,cash:WORLD_STORAGE.decode(JSON.parse(localStorage.getItem(KEY))).userClub.presupuesto_dolares}}')
        self.assertTrue(primary['saved'],primary)
        self.assertEqual(primary['cash'],1234567,primary)
        r=other.evaluate('()=>{GameState.userClub.presupuesto_dolares=999;return {saved:saveGame(true),cash:WORLD_STORAGE.decode(JSON.parse(localStorage.getItem(KEY))).userClub.presupuesto_dolares}}')
        self.assertFalse(r['saved']);self.assertEqual(r['cash'],1234567,{'primary':primary,'secondary':r})
        original=self.page.evaluate('GameState.careerId')
        other.evaluate('async()=>{await FM_CAREERS.forkCurrent()}')
        self.assertNotEqual(other.evaluate('GameState.careerId'),original)
        self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),1234567)
        self.assertFalse(other.evaluate('FM_CAREER_LOCKS.blocked()'))
        other.close()

    def test_promotions_keep_health_age_and_observed_homegrown_history(self):
        r=self.page.evaluate("""()=>{FM_REGISTRATION.list('boca');const p=FM_DEVELOPMENT.ensure().academy[0];p.condicion_fisica=35;const ok=FM_DEVELOPMENT.promote(p.id),q=player(p.id),condition=q.condicion_fisica,registered=q.registered;const year=Number(GameState.today.slice(0,4));FM_IDENTITY.update(q,(year+1)+'-01-01');const age=q.edad;FM_IDENTITY.update(q,(year+3)+'-01-03');return{ok,condition,registered,listed:FM_REGISTRATION.list('boca').includes(q.id),age,expected:year+1-q.birthYear,trained:FM_REGISTRATION.trained(q,'boca',true),history:q.trainingHistory}}""")
        self.assertTrue(r['ok']);self.assertEqual(r['condition'],35)
        self.assertFalse(r['registered']);self.assertFalse(r['listed'])
        self.assertEqual(r['age'],r['expected']);self.assertTrue(r['trained'],r)

    def test_exemptions_preserve_separate_foreign_intake_limits(self):
        r=self.page.evaluate("""()=>{const english=GameState.world.clubs.find(c=>c.country==='Inglaterra').id,p=squad(english).find(p=>p.edad<21);FM_REGISTRATION.unregister(p.id,english);const exemptEligible=FM_REGISTRATION.eligible(p,english),id=GameState.world.clubs.find(c=>c.country==='Italia').id;GameState.userClub.id=id;for(const pid of FM_REGISTRATION.list(id).slice())FM_REGISTRATION.unregister(pid,id);const players=GameState.players.filter(p=>p.clubId&&club(p.clubId)?.country==='Argentina'&&p.edad<21&&p.nationalities?.length===1&&p.nacionalidad==='Argentina').slice(0,3),results=[];for(const p of players){const from=p.clubId;p.clubId=id;WORLD_ENGINE.reindex();FM_REGISTRATION.onTransfer(p,from,id);results.push(FM_REGISTRATION.register(p.id,id,'domestic',{transfer:true}).ok)}return{exemptEligible,results}}""")
        self.assertTrue(r['exemptEligible']);self.assertEqual(r['results'],[True,True,False])

    def test_reserve_without_seven_players_has_no_fictional_scorers_or_minutes(self):
        r=self.page.evaluate("""()=>{FM_LIFECYCLE.reserveEnsure();const s=FM_LIFECYCLE.ensure().reserve,c=Object.values(s.competitions).find(c=>c.kind==='reserve'),g=c.fixtures[0];for(const id of [g.home,g.away])for(const p of s.clubs[id].youth){p.injury=300;p.condicion_fisica=0;}FM_LIFECYCLE.reserveDay(g.date);return {result:g.result,lineups:g.lineups,stats:g.lineups.flat().map(id=>player(id)?.reserveMinutes||0),points:c.standings[g.home].pts}}""")
        self.assertTrue(r['result']['administrative']);self.assertEqual(r['result']['scorers'],[])
        self.assertTrue(all(n==0 for n in r['stats']));self.assertEqual(r['points'],0)

    def test_quick_match_cards_minutes_and_historical_rows_are_consistent(self):
        r=self.page.evaluate("""()=>{const e=GameState.calendar.find(e=>!e.done&&e.type==='LPF'&&e.games.some(g=>g.home!=='boca'&&g.away!=='boca')),g=structuredClone(e.games.find(g=>g.home!=='boca'&&g.away!=='boca'));delete g.quickStatsRecorded;delete g.statisticsRecorded;let n=0;const random=Math.random;Math.random=()=>++n===15?.9:0;try{WORLD_ENGINE.simulatedStats(g,{home:2,away:1},e)}finally{Math.random=random}const red=g.cardSummary.filter(c=>c.type==='roja directa'||c.type==='doble amarilla'),counts=red.map(c=>red.filter(x=>x.playerId===c.playerId).length),pid=g.quickLineups[0].find(id=>g.playerMinutes[id]>0),p=player(pid),before=JSON.stringify(p.careerStats);WORLD_ENGINE.simulatedStats(g,{home:2,away:1},e);return{counts,minutes:Object.values(g.playerMinutes),rows:FM_STATS.rows(pid),same:before===JSON.stringify(p.careerStats),teamMinutes:g.quickLineups.map(ids=>ids.reduce((n,id)=>n+g.playerMinutes[id],0)),scorerGoals:g.scorers.length}}""")
        self.assertTrue(all(n==1 for n in r['counts']),r)
        self.assertTrue(all(0<=n<=90 for n in r['minutes']),r)
        self.assertTrue(all(n<=990 for n in r['teamMinutes']),r)
        self.assertTrue(r['rows']);self.assertTrue(r['same']);self.assertEqual(r['scorerGoals'],3)

    def test_postponement_moves_only_one_match(self):
        r=self.page.evaluate("""()=>{const e=GameState.calendar.find(e=>!e.done&&e.type==='LPF'&&e.leagueId==='ARG1'&&e.games.length>1),old=e.date,count=e.games.length,result=FM_SEASONS.postpone(e.id,'Lluvia en un estadio',null,{silent:true});return{ok:result.ok,reason:result.reason,old,current:e.date,originalGames:e.games.length,count,movedGames:result.event?.games.length,newDate:result.event?.date}}""")
        self.assertTrue(r['ok'],r);self.assertEqual(r['old'],r['current']);self.assertEqual(r['originalGames'],r['count']-1);self.assertEqual(r['movedGames'],1);self.assertGreater(r['newDate'],r['old'])

    def test_staff_counter_and_waiting_purchase_have_correct_inbox_actions(self):
        r=self.page.evaluate("""()=>{const p=GameState.players.find(p=>p.clubId&&p.clubId!=='boca'),o={id:'waiting-test',type:'buy',playerId:p.id,fromClub:p.clubId,toClub:'boca',stage:'club',status:'pending',awaitingUser:false,fee:1000,wage:100};GameState.offers.push(o);const m=FM_INBOX.push({title:'Esperando respuesta',body:'El club evalúa',type:'mercado',action:'offer',offerId:o.id,playerId:p.id}),e=FM_OFFICE.office().staff[0];FM_GOVERNANCE.proposeStaff(e.id,{salary:50,bonus:0,years:2});GameState.today=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10);FM_GOVERNANCE.processStaff(GameState.today);const counter=GameState.inbox.find(m=>m.title==='Contraoferta del empleado');return{purchasePending:FM_INBOX.isPending(m),staffPending:FM_INBOX.isPending(counter),actions:FM_INBOX.actionsFor(counter)}}""")
        self.assertFalse(r['purchasePending']);self.assertTrue(r['staffPending']);self.assertIn('staff-review',[a['id'] for a in r['actions']])

    def test_training_routes_and_sessions_have_real_load_and_are_idempotent(self):
        r=self.page.evaluate("""()=>{const staff=FM_OFFICE.office().staff.find(e=>e.role==='Ojeador'),country='España',plan=FM_PROGRAMMES.route(staff.id,country,2),target=GameState.players.find(p=>club(p.clubId)?.country===country),beforeArrival=FM_PROGRAMMES.available(staff,target);GameState.today=FM_PROGRAMMES.ensure().routes[staff.id].arrives;FM_PROGRAMMES.onDay(GameState.today);const afterArrival=FM_PROGRAMMES.available(staff,target),raw={enabled:true,load:1,staffId:'auto'};for(let i=0;i<7;i++){raw['am'+i]='possession';raw['pm'+i]='finishing'}FM_PROGRAMMES.configure(raw);const first=FM_PROGRAMMES.applySession('am'),duplicate=FM_PROGRAMMES.applySession('am'),second=FM_PROGRAMMES.applySession('pm'),history=FM_PROGRAMMES.ensure().training.history;return{route:plan.ok,beforeArrival,afterArrival,first,duplicate,second,history:history.length,distinct:history.map(h=>h.period)}}""")
        self.assertTrue(r['route'],r);self.assertFalse(r['beforeArrival']);self.assertTrue(r['afterArrival'])
        self.assertTrue(r['first']);self.assertFalse(r['duplicate']);self.assertTrue(r['second']);self.assertEqual(r['history'],2)

    def test_agency_fees_and_contingent_payments_settle_once(self):
        r=self.page.evaluate("""()=>{GameState.userClub.wageBudget=10000000;const p=player(1068088),from=p.clubId,cash=GameState.userClub.presupuesto_dolares,result=MARKET_CONTRACTS.executeTransfer({id:'agent-test',playerId:p.id,fromClub:from,toClub:'boca',dealType:'permanent',fee:10000,wage:100,years:2,agentFee:250,contingencies:[{kind:'appearances',threshold:2,amount:500,beneficiary:'seller'}]});if(!result.ok)throw Error(result.reason);const paid=cash-GameState.userClub.presupuesto_dolares,condition=FM_AGENTS.ensure().conditions.find(c=>c.offerId==='agent-test');p.appearances+=2;FM_AGENTS.onResult();MARKET_CONTRACTS.settle(GameState.today);const after=GameState.userClub.presupuesto_dolares;MARKET_CONTRACTS.settle(GameState.today);return{paid,condition:condition.status,amount:FM_AGENTS.ensure().conditions.find(c=>c.id===condition.id).amount,rows:MARKET_CONTRACTS.ensure().payments.filter(x=>x.id==='contingent-'+condition.id),same:after===GameState.userClub.presupuesto_dolares,extraPaid:cash-paid-after}}""")
        self.assertEqual(r['paid'],10250);self.assertEqual(len(r['rows']),1);self.assertEqual(r['rows'][0]['status'],'paid');self.assertEqual(r['extraPaid'],500);self.assertTrue(r['same'])

    def test_projects_promises_trials_and_press_are_executable(self):
        r=self.page.evaluate("""()=>{GameState.userClub.presupuesto_dolares=100000000;const p=mine()[0],promise=FM_PROJECTS.promise(p.id,'minutes',90,90),project=FM_PROJECTS.startProject('stadium'),capacity=club('boca').capacity;p.careerStats=[['2026','boca','LPF',1,90,0,0,0,0,7]];p.minutes=0;FM_PROJECTS.reviewPromises(GameState.today);const free=player(1068088);free.clubId=null;WORLD_ENGINE.reindex();const trial=FM_AGENTS.invite(free.id,7);GameState.today=project.project.due;FM_PROJECTS.onDay(GameState.today);FM_AGENTS.onDay(GameState.today);const conference=FM_PROJECTS.ensure().press.find(p=>p.status==='open');const press=FM_PROJECTS.answerPress(conference.id,'ambitious');return{promise:promise.promise.status,project:project.project.status,capacity:club('boca').capacity,oldCapacity:capacity,trial:trial.trial.status,free:free.clubId===null,press:press.ok,reviewDate:conference.followup}}""")
        self.assertEqual(r['promise'],'fulfilled');self.assertEqual(r['project'],'completed');self.assertGreater(r['capacity'],r['oldCapacity']);self.assertEqual(r['trial'],'completed');self.assertTrue(r['free']);self.assertTrue(r['press']);self.assertTrue(r['reviewDate'])

    def test_national_duty_blocks_club_and_records_separate_caps(self):
        r=self.page.evaluate("""()=>{const start=GameState.today,end=new Date(Date.parse(start)+8*86400000).toISOString().slice(0,10),e=FM_NATIONALS.setup({start,end},2026),p=Object.values(e.rosters).flat().map(player).find(p=>p.clubId==='boca');if(!p)throw Error('No hay internacional del club en la muestra');const block=FM_NATIONALS.unavailable(p,{date:start}),clubAppearances=p.appearances;GameState.today=end;FM_NATIONALS.onDay(end);const caps=p.internationalStats?.caps||0;GameState.today=new Date(Date.parse(end)+3*86400000).toISOString().slice(0,10);FM_NATIONALS.onDay(GameState.today);return{block,caps,clubSame:clubAppearances===p.appearances,returned:!p.nationalDuty,matches:e.fixtures.filter(g=>g.result).length}}""")
        self.assertTrue(r['block']);self.assertGreater(r['caps'],0);self.assertTrue(r['clubSame']);self.assertTrue(r['returned']);self.assertGreater(r['matches'],0)

    def test_reference_update_leaves_current_career_unchanged_and_applies_to_next(self):
        r=self.page.evaluate("""async()=>{const p=mine().find(p=>p.realIdentity),id=p.id,name=p.nombre,career=GameState.careerId,ref=WORLD_DATABASE.players.find(r=>r.playerId===id);await FM_DATA_UPDATES.install({format:'FM27-REFERENCE-PATCH',version:1,source:{url:'https://www.transfermarkt.com/',asOf:'2026-10-18'},players:[{playerId:id,name:'Nombre corregido de referencia'}]});const unchanged=p.nombre===name&&ref.name===name;await FM_CAREERS.saveCurrent();await FM_CAREERS.beginNew();WORLD_ENGINE.createWorldCareer('DT base actualizada','boca');await FM_CAREERS.saveCurrent();const updated=player(id).nombre;await FM_CAREERS.load(career);return{unchanged,updated,old:player(id).nombre,expected:name}}""")
        self.assertTrue(r['unchanged']);self.assertEqual(r['updated'],'Nombre corregido de referencia');self.assertEqual(r['old'],r['expected'])

    def test_all_professional_tabs_and_mobile_primary_action_are_visible(self):
        self.page.evaluate('FM_PRO.open("club")')
        for tab in ['club','statistics','market','scouting','training','nationals','analysis','press','data']:
            self.page.click('[data-pro-tab="'+tab+'"]')
            self.assertTrue(self.page.locator('.pro-body').is_visible())
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.evaluate('()=>{view="dashboard";render()}')
        rect=self.page.locator('.world-next-match-actions button').bounding_box()
        self.assertIsNotNone(rect);self.assertLessEqual(rect['y']+rect['height'],844)

if __name__=='__main__':unittest.main(verbosity=2)
