"""Integration regressions for audited world transitions and public management UI."""
import unittest
import test_offer_form as fixture


class AuditIntegration(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def test_complete_world_roundtrip_and_cup_navigation(self):
        result=self.page.evaluate("""()=>{
          WORLD_STORAGE.validate(GameState);
          const before={clubs:GameState.world.clubs.length,players:GameState.players.length,events:GameState.calendar.length,cash:GameState.userClub.presupuesto_dolares};
          const restored=WORLD_STORAGE.decode(JSON.parse(WORLD_STORAGE.serialize(GameState)));WORLD_STORAGE.validate(restored);
          const cups=FM_EXTRA_CUPS.all();
          return {before,after:{clubs:restored.world.clubs.length,players:restored.players.length,events:restored.calendar.length,cash:restored.userClub.presupuesto_dolares},
            european:cups.filter(c=>['UCL','UEL','UEC'].includes(c.type)).map(c=>({type:c.type,count:c.participants.length})),national:cups.filter(c=>c.type==='CUP').length,
            unsafeJobs:FM_DEPTH.ensure().jobs.filter(j=>club(j.clubId)?.external).length};
        }""")
        self.assertEqual(result['before'],result['after'])
        self.assertEqual([c['count'] for c in result['european']],[36,36,36])
        self.assertEqual(result['national'],15)
        self.assertEqual(result['unsafeJobs'],0)
        self.page.evaluate("view='tables';render()")
        self.page.click('[data-world-tab="extra"]')
        self.assertGreater(self.page.locator('[data-extra-cup] option').count(),10)
        self.page.select_option('[data-extra-cup]','UCL:2025')
        self.assertIn('Champions',self.page.locator('#content').inner_text())
        guest=self.page.evaluate("GameState.world.clubs.find(c=>c.external).id")
        self.page.evaluate("(id)=>{WORLD_UI.state.tab='world';WORLD_UI.state.worldClub=id;render()}",guest)
        self.assertGreater(self.page.locator('a[href^="https://www.uefa.com/"]').count(),0)
        self.page.locator('#content [data-ws-tab]').filter(has_text='Plantilla del club').click()
        self.assertIn('reservas ficticias',self.page.locator('#content').inner_text())

    def test_quick_match_uses_ai_formation_records_form_and_cards_once(self):
        result=self.page.evaluate("""()=>{
          const e=GameState.calendar.find(e=>e.type==='LPF'&&e.leagueId==='ARG1'&&!e.done&&e.games.some(g=>g.home!==GameState.userClub.id&&g.away!==GameState.userClub.id)),g=e.games.find(g=>g.home!==GameState.userClub.id&&g.away!==GameState.userClub.id);
          const economy=CLUB_AI.economy(g.home);economy.formation='4-4-2';
          // Isolate formation selection from injuries, foreign quotas and ability gaps.
          for(const p of squad(g.home)){for(const key of ['ritmo','tiro','pase','regate','defensa','fisico'])p[key]=70;p.condicion_fisica=100;p.injury=0;p.ban=0;p.suspensions={};p.registered=true;p.nationalities=[club(g.home).country];p.nacionalidad=club(g.home).country;}
          FM_REGISTRATION.list(g.home).splice(0,100,...squad(g.home).map(p=>p.id));const selected=aiXI(g.home);

          const before=new Map(squad(g.home).map(p=>[p.id,{minutes:p.minutes,form:p.form?.length||0,yellow:p.yellowSeason||0}]));
          const old=Math.random;Math.random=()=>.4;try{WORLD_ENGINE.simulatedStats(g,{home:2,away:1},e)}finally{Math.random=old}
          const changed=squad(g.home).filter(p=>p.minutes>(before.get(p.id)?.minutes||0));
          const totals=changed.map(p=>({minutes:p.minutes-before.get(p.id).minutes,form:p.form.length-before.get(p.id).form,last:p.lastRating,pos:p.posicion}));
          const yellows=squad(g.home).reduce((sum,p)=>sum+(p.yellowSeason||0)-before.get(p.id).yellow,0),minutes=changed.reduce((n,p)=>n+p.minutes,0);
          WORLD_ENGINE.simulatedStats(g,{home:2,away:1},e);
          return {totals,yellows,forwards:selected.slice(-2).every(id=>FM_PLAYER.naturalPositions(player(id)).includes('DC')),selectedObserved:selected.every(id=>changed.some(p=>p.id===id))&&changed.every(p=>g.quickLineups[0].includes(p.id)),idempotent:changed.reduce((n,p)=>n+p.minutes,0)===minutes};
        }""")
        self.assertGreaterEqual(len(result['totals']),11)
        self.assertLessEqual(len(result['totals']),14)
        self.assertTrue(all(0<p['minutes']<=90 and p['form']>=0 and p['last']>=1 for p in result['totals']))
        self.assertEqual(sum(p['minutes'] for p in result['totals']),990)
        self.assertGreater(result['yellows'],0)
        self.assertTrue(result['forwards'])
        self.assertTrue(result['selectedObserved'])
        self.assertTrue(result['idempotent'])

    def test_snapshot_date_prepares_past_results_without_charging_incoming_manager(self):
        result=self.page.evaluate("""()=>{
          const id=GameState.userClub.id,budget=WORLD_DATABASE.clubs.find(c=>c.id===id).budget;
          WORLD_ENGINE.createWorldCareer('DT fecha de base',id,null,{competitionFormat:'realistic',calendarMode:'realistic',startMode:'snapshot'});
          const day=String(WORLD_DATABASE.metadata.retrievedAt).slice(0,10);
          WORLD_STORAGE.validate(GameState);
          return {day,today:GameState.today,start:FM_SEASONS.careerStart(),cash:GameState.userClub.presupuesto_dolares,budget,
            pastUserPending:GameState.calendar.filter(e=>!e.done&&e.date<day&&fixture(e)&&e.games.length).map(e=>({id:e.id,date:e.date})),
            completedUser:GameState.calendar.filter(e=>e.done&&e.date<day&&fixture(e)).length,next:WORLD_CLOCK.nextFixture()?.date,
            signDates:mine().every(p=>p.contractSignedDate===day)};
        }""")
        self.assertEqual(result['today'],result['day'])
        self.assertEqual(result['start'],result['day'])
        self.assertEqual(result['cash'],result['budget'])
        self.assertEqual(result['pastUserPending'],[])
        self.assertGreater(result['completedUser'],1)
        self.assertGreaterEqual(result['next'],result['day'])
        self.assertTrue(result['signDates'])

    def test_future_preliminaries_roundtrip_then_resolve_into_two_group_draws(self):
        result=self.page.evaluate("""()=>{
          GameState.today='2027-01-02';GameState.year=2027;
          const rankings=Object.fromEntries(GameState.world.leagues.filter(l=>l.tier===1&&l.confederation==='CONMEBOL').map(l=>[l.id,WORLD_ENGINE.sortedRows(l.standings,l.id).map(r=>r.id)]));
          const events=WORLD_ENGINE.makeContinentalCalendar(2027,rankings);
          GameState.calendar=GameState.calendar.filter(e=>!['LIB','SUD'].includes(e.type)).concat(events).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));WORLD_ENGINE.hydrateWorldState();
          WORLD_STORAGE.validate(GameState);const restored=WORLD_STORAGE.decode(JSON.parse(WORLD_STORAGE.serialize(GameState)));
          const pending={cups:Object.keys(restored.world.cups).length,lib:restored.world.extraCompetitions.cups['LIB_PRE:2027'].participants.length,sud:restored.world.extraCompetitions.cups['SUD_PRE:2027'].participants.length};
          GameState.world.initializingHistory=true;try{
            for(let i=0;i<100;i++){
              const e=GameState.calendar.filter(e=>['LIB_PRE','SUD_PRE'].includes(e.type)&&!e.done).sort((a,b)=>a.date.localeCompare(b.date)).find(e=>FM_EXTRA_CUPS.ready(e));if(!e)break;
              GameState.today=e.date;WORLD_CLOCK.ensure().slot=3;if(!WORLD_ENGINE.completeOne(null,e,{background:true}))throw Error('La fase previa no pudo completarse: '+e.id);
            }
          }finally{delete GameState.world.initializingHistory}
          WORLD_STORAGE.validate(GameState);
          const groups=Object.fromEntries(['LIB','SUD'].map(k=>[k,{participants:GameState.world.cups[k].participants.length,groups:GameState.world.cups[k].groups.length,unique:new Set(GameState.world.cups[k].participants).size}]));
          return {pending,status:GameState.world.extraCompetitions.preliminaries[2027].status,groups,allUnique:new Set([...GameState.world.cups.LIB.participants,...GameState.world.cups.SUD.participants]).size};
        }""")
        self.assertEqual(result['pending'],{'cups':0,'lib':47,'sud':44})
        self.assertEqual(result['status'],'resolved')
        self.assertEqual(result['allUnique'],64)
        for cup in result['groups'].values():
            self.assertEqual(cup,{'participants':32,'groups':8,'unique':32})
