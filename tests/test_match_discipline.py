"""Competition bans and recorded appearances follow the actual match context."""
import unittest
import test_offer_form as fixture

class MatchDiscipline(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def match(self,cup=False):
        self.page.evaluate("""cup=>{const e=WORLD_CLOCK.nextFixture();if(cup)e.type='LIB';GameState.today=e.date;WORLD_CLOCK.ensure().slot=WORLD_CLOCK.eventSlot(e);startMatch();clearInterval(timer);timer=null;GameState.match.paused=true;view='dashboard';render()}""",cup)

    def test_real_red_card_retains_pending_league_ban_and_survives_reload(self):
        self.match(True)
        result=self.page.evaluate("""()=>{const m=GameState.match,e=GameState.calendar.find(e=>e.id===m.eventId),random=Math.random,injure=FM_MEDICINE.maybeInjury;for(const id of m.lineups.flat()){player(id).ban=1;player(id).banCompetition='LPF'}FM_MEDICINE.maybeInjury=()=>null;Math.random=()=>0;m.paused=false;tick();Math.random=random;FM_MEDICINE.maybeInjury=injure;m.paused=true;
          const p=player(m.red[0]);if(!p)throw Error('No se produjo la expulsión de prueba');const lib=available(p);e.type='LPF';const league=available(p);e.type='LIB';window.disciplinePid=p.id;saveGame(true);return{league,lib,pending:WORLD_ENGINE.discipline.pending(p),id:p.id};}""")
        self.assertFalse(result['league']);self.assertFalse(result['lib'])
        self.assertEqual(result['pending'],{'LPF':1,'LIB':1})
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        pending=self.page.evaluate('(id)=>WORLD_ENGINE.discipline.pending(player(id))',result['id'])
        self.assertEqual(pending,{'LPF':1,'LIB':1})

    def test_serves_only_played_competition_and_not_the_new_sanction(self):
        result=self.page.evaluate("""()=>{const p=mine()[0],m={eventId:WORLD_CLOCK.nextFixture().id,newBans:[],red:[]};p.ban=2;p.banCompetition='LIB';const e=WORLD_CLOCK.nextFixture(),oldType=e.type;e.type='LPF';WORLD_ENGINE.discipline.award(m,p,'Roja de prueba');WORLD_ENGINE.discipline.serve({type:'LPF',games:[{home:'boca',away:'river'}]},m);const newly=WORLD_ENGINE.discipline.pending(p);WORLD_ENGINE.discipline.serve({type:'LIB',games:[{home:'boca',away:'river'}]});const continental=WORLD_ENGINE.discipline.pending(p);WORLD_ENGINE.discipline.serve({type:'LPF',games:[{home:'boca',away:'river'}]});const local=WORLD_ENGINE.discipline.pending(p);e.type=oldType;return{newly,continental,local}}""")
        self.assertEqual(result['newly'],{'LIB':2,'LPF':1})
        self.assertEqual(result['continental'],{'LIB':1,'LPF':1})
        self.assertEqual(result['local'],{'LIB':1})

    def test_actual_league_fixture_serves_league_ban_without_serving_cup_ban(self):
        result=self.page.evaluate("""()=>{const e=GameState.calendar.find(e=>!e.done&&e.type==='LPF'&&fixture(e)),p=mine().find(p=>!GameState.tactics.xi.includes(p.id));p.ban=2;p.banCompetition='LIB';WORLD_ENGINE.discipline.award({eventId:e.id,newBans:[]},p,'Suspensión local pendiente');const apps=p.appearances;GameState.today=e.date;WORLD_CLOCK.ensure().slot=WORLD_CLOCK.eventSlot(e);const completed=WORLD_ENGINE.completeOne({home:1,away:0},e);return{completed,pending:WORLD_ENGINE.discipline.pending(p),apps:p.appearances-apps}}""")
        self.assertTrue(result['completed']);self.assertEqual(result['pending'],{'LIB':2})
        self.assertEqual(result['apps'],0)


    def test_legacy_flat_bans_and_clearing_controls_remain_compatible(self):
        result=self.page.evaluate("""()=>{const p=mine()[0];p.ban=2;p.banCompetition='LPF';const legacy=WORLD_ENGINE.discipline.pending(p);p.ban=0;const cleared=WORLD_ENGINE.discipline.pending(p);p.ban=3;p.banCompetition='SUD';return{legacy,cleared,updated:WORLD_ENGINE.discipline.pending(p),lp:WORLD_ENGINE.discipline.remaining(p,{type:'LPF'}),sud:WORLD_ENGINE.discipline.remaining(p,{type:'SUD'})}}""")
        self.assertEqual(result['legacy'],{'LPF':2});self.assertEqual(result['cleared'],{})
        self.assertEqual(result['updated'],{'SUD':3});self.assertEqual(result['lp'],0);self.assertEqual(result['sud'],3)

    def test_real_rollover_does_not_erase_unserved_suspension(self):
        result=self.page.evaluate("""()=>{const p=mine()[0];p.ban=2;p.banCompetition='LIB';const reg=FM_SEASONS.registry(),year=FM_SEASONS.leagueSeason('ARG1').year;reg.movementKeys??=[];reg.movementKeys.push('ARG:'+year);for(const lid of FM_SEASONS.pairedLeagues('ARG1')){const l=WORLD_ENGINE.league(lid),s=FM_SEASONS.leagueSeason(lid);s.status='completed';if(GameState.today<s.rolloverDate)GameState.today=s.rolloverDate;reg.history.push({leagueId:lid,year,ranking:[...l.clubIds],clubIds:[...l.clubIds],standings:structuredClone(l.standings),champion:l.clubIds[0]})}const rolled=FM_SEASONS.rollover('ARG1');return{rolled,pending:WORLD_ENGINE.discipline.pending(p)}}""")
        self.assertTrue(result['rolled']);self.assertEqual(result['pending'],{'LIB':2})

    def test_pre_kickoff_substitution_is_not_an_appearance_or_motm(self):
        self.match()
        result=self.page.evaluate("""()=>{const m=GameState.match,e=GameState.calendar.find(e=>e.id===m.eventId),side=m.userSide,into=m.bench[side].find(id=>player(id).posicion!=='POR'),out=m.lineups[side].find(id=>player(id).posicion===player(into).posicion),p=player(out),old={apps:p.appearances,minutes:p.minutes,form:JSON.stringify(p.form)};if(!substitute(out,into))throw Error('No se pudo hacer el cambio');for(const id of m.lineups.flat())m.minutesPlayed[id]=90;m.minutesPlayed[out]=0;m.ratings[out]=10;m.minute=90;m.done=true;const completed=WORLD_ENGINE.completeOne({home:1,away:0},e);return{completed,apps:p.appearances-old.apps,minutes:p.minutes-old.minutes,form:JSON.stringify(p.form)===old.form,motm:GameState.lastMatch.motm,out,into,intoApps:player(into).appearances}}""")
        self.assertTrue(result['completed']);self.assertEqual(result['apps'],0)
        self.assertEqual(result['minutes'],0);self.assertTrue(result['form'])
        self.assertNotEqual(result['motm'],result['out']);self.assertGreater(result['intoApps'],0)

    def test_dressing_room_opportunities_follow_cup_eligibility(self):
        result=self.page.evaluate("""()=>{const p=mine()[0],room=FM_DRESSING_ROOM.ensure(),r=room.players[p.id];r.lastMinutes=p.minutes;r.opportunities=0;FM_REGISTRATION.list('boca','LIB');FM_REGISTRATION.unregister(p.id,'boca');p.ban=1;p.banCompetition='LPF';FM_DRESSING_ROOM.onMatchResult({id:'room-cup-available',type:'LIB'});const cup=r.opportunities;FM_DRESSING_ROOM.onMatchResult({id:'room-league-suspended',type:'LPF'});const league=r.opportunities;FM_REGISTRATION.unregister(p.id,'boca','LIB');FM_DRESSING_ROOM.onMatchResult({id:'room-cup-unregistered',type:'LIB'});return{cup,league,unregistered:r.opportunities}}""")
        self.assertEqual(result['cup'],1);self.assertEqual(result['league'],1);self.assertEqual(result['unregistered'],1)
