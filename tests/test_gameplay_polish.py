"""Existing gameplay must reward coherent decisions, not repeated clicks or stale state."""
import unittest
import test_offer_form as fixture


class GameplayPolish(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def tomorrow(self):
        self.page.evaluate('()=>{GameState.today=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10);MARKET_CONTRACTS.processOffers()}')

    def test_worse_transfer_bids_consume_patience_without_buying_discounts(self):
        r=self.page.evaluate('''()=>{GameState.userClub.presupuesto_dolares=100000000;GameState.userClub.wageBudget=10000000;player(1068088).valor_mercado=100000;const q=MARKET_CONTRACTS.submitOffer({stage:'club',playerId:1068088,fee:100,installments:0,upfrontPercent:100});return {ok:q.ok,id:q.offer?.id}}''')
        self.assertTrue(r['ok'],r);oid=r['id'];self.tomorrow()
        first=self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).counter.fee',oid)
        self.assertTrue(self.page.evaluate('(id)=>MARKET_CONTRACTS.counterOffer(id,{fee:50}).ok',oid));self.tomorrow()
        r=self.page.evaluate('(id)=>{const o=GameState.offers.find(o=>o.id===id);return {fee:o.counter.fee,progress:o.bargaining,rounds:o.counterRounds}}',oid)
        self.assertEqual(r['fee'],first);self.assertEqual(r['progress']['concessions'],0);self.assertEqual(r['rounds'],1)
        self.assertTrue(self.page.evaluate('(id)=>MARKET_CONTRACTS.counterOffer(id,{fee:200}).ok',oid));self.tomorrow()
        self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).bargaining.concessions',oid),1)
        self.assertLessEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).counter.fee',oid),first)
        self.page.evaluate('saveGame(true)');self.page.reload(wait_until='domcontentloaded')
        self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).bargaining.concessions',oid),1)

    def test_renewal_uses_best_package_and_keeps_guaranteed_terms_unchanged(self):
        r=self.page.evaluate('''()=>{GameState.userClub.wageBudget=10000000;const p=mine().find(p=>p.posicion==='MED');p.salario=1000;const old={wage:p.salario,end:p.contractEnd},q=FM_RENEWALS.submit(p.id,{wage:200,bonus:0,years:5,playingTime:'Rotación',confirmed:true});return {ok:q.ok,id:q.negotiation?.id,pid:p.id,old}}''')
        self.assertTrue(r['ok'],r);oid=r['id'];self.tomorrow()
        first=self.page.evaluate('(id)=>FM_RENEWALS.byId(id).counter.wage',oid)
        proposal=self.page.evaluate('(id)=>FM_RENEWALS.submit(FM_RENEWALS.byId(id).playerId,{wage:100,bonus:0,confirmed:true})',oid)
        self.assertTrue(proposal['ok'],proposal);self.tomorrow()
        value=self.page.evaluate('(id)=>{const r=FM_RENEWALS.byId(id);return {wage:r.counter.wage,progress:r.bargaining,current:player(r.playerId).salario}}',oid)
        self.assertEqual(value['wage'],first);self.assertEqual(value['progress']['concessions'],0);self.assertEqual(value['current'],1000)

    def test_club_depth_does_not_count_one_versatile_player_four_times(self):
        r=self.page.evaluate('''()=>{const id='river',pool=squad(id);for(const p of pool){p.learnedPositions=[];p.transfermarkt={...p.transfermarkt,positionDetail:{POR:'Goalkeeper',DEF:'Centre-Back',MED:'Central Midfield',DEL:'Centre-Forward'}[p.posicion]};}const p=pool.find(p=>p.posicion==='DEF');p.learnedPositions=['LI','LD','EI','ED'];CLUB_AI.economy(id).formation='4-3-3';const s=CLUB_AI.summaryOf(id);return {coverage:s.exactNeeds.filter(n=>['LI','LD','EI','ED'].includes(n.slot)).reduce((n,r)=>n+r.count,0),needs:s.exactNeeds.filter(n=>['LI','LD','EI','ED'].includes(n.slot)),assigned:s.exactNeeds.reduce((n,r)=>n+r.count,0),players:pool.length}}''')
        self.assertLessEqual(r['coverage'],1,r);self.assertLessEqual(r['assigned'],r['players'],r)
        self.assertGreaterEqual(sum(n['score']>=18 for n in r['needs']),3,r)

    def test_loan_interest_uses_loan_cost_rather_than_the_price_of_the_whole_player(self):
        r=self.page.evaluate('''()=>{const p=mine().find(p=>p.posicion==='DEL'&&p.edad<=28&&!p.loanId);p.salario=1000;p.valor_mercado=1000000;p.contractEnd='2030-12-31';p.contract=2030;for(const k of ['ritmo','tiro','pase','regate','defensa','fisico'])p[k]=80;const e=CLUB_AI.economy('river');e.cash=100000;e.wageBudget=10000000;e.reputation=85;const forwards=squad('river').filter(q=>q.posicion==='DEL');for(const q of forwards.slice(1))q.clubId=null;for(const k of ['ritmo','tiro','pase','regate','defensa','fisico'])forwards[0][k]=50;WORLD_ENGINE.reindex();const loan=CLUB_AI.interestFor(p.id,{dealType:'loan'}),permanent=CLUB_AI.interestFor(p.id);return {loan:loan.some(b=>b.id==='river'),permanent:permanent.some(b=>b.id==='river'),loanRows:loan.map(b=>b.id)}}''')
        self.assertTrue(r['loan'],r);self.assertFalse(r['permanent'],r)

    def test_ai_keeps_starting_quality_and_protects_a_lone_specialist(self):
        r=self.page.evaluate('''()=>{const pool=squad('river');for(const p of pool){p.learnedPositions=[];p.transfermarkt={...p.transfermarkt,positionDetail:{POR:'Goalkeeper',DEF:'Centre-Back',MED:'Central Midfield',DEL:'Centre-Forward'}[p.posicion]};}const keepers=pool.filter(p=>p.posicion==='POR');for(const [i,p]of keepers.entries()){p.attributes={};for(const k of ['ritmo','tiro','pase','regate','defensa','fisico'])p[k]=i?40:90;}const specialist=pool.find(p=>p.posicion==='DEF');specialist.learnedPositions=['LI'];CLUB_AI.economy('river').formation='4-3-3';const s=CLUB_AI.summaryOf('river');return {quality:s.exactNeeds.find(n=>n.slot==='POR').quality,best:overall(keepers[0]),release:CLUB_AI.canRelease(specialist,'river')}}''')
        self.assertEqual(r['quality'],r['best']);self.assertFalse(r['release']['ok']);self.assertIn('LI',r['release']['reason'])

    def test_training_mode_switch_does_not_give_a_second_morning_session(self):
        r=self.page.evaluate('''()=>{const t=FM_PROGRAMMES.ensure().training;t.enabled=false;const before=GameState.training.sessions,regular=MANAGEMENT.applyTraining(1);t.enabled=true;const blocked=FM_PROGRAMMES.applySession('am'),blockedPM=FM_PROGRAMMES.applySession('pm');GameState.today=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10);const am=FM_PROGRAMMES.applySession('am'),duplicate=FM_PROGRAMMES.applySession('am'),pm=FM_PROGRAMMES.applySession('pm');t.enabled=false;const secondRegular=MANAGEMENT.applyTraining(1);return {regular,blocked,blockedPM,am,duplicate,pm,secondRegular,delta:GameState.training.sessions-before}}''')
        self.assertEqual(r,{'regular':True,'blocked':False,'blockedPM':False,'am':True,'duplicate':False,'pm':True,'secondRegular':False,'delta':3})

    def test_custom_training_respects_individual_rest_and_age_development(self):
        r=self.page.evaluate('''()=>{const members=mine().filter(p=>p.posicion==='MED').slice(0,3),[young,old,rest]=members;for(const [i,p]of members.entries()){p.fecha_nacimiento=(i===1?'1986':'2006')+'-01-01';p.edad=i===1?40:20;p.injury=0;p.condicion_fisica=100;p.moral=80;p.potential=99;p.trainingFocus='Equipo';const e=FM_DEVELOPMENT.evolution(p);e.ceiling=99;e.phaseYear=Number(GameState.today.slice(0,4));e.rate=1;e.phase='Consolidación';const med=FM_MEDICINE.state(p);med.tissueFatigue=0;med.injury=null;med.restUntil=null;const q=FM_DEVELOPMENT.playerPlan(p);q.load='Normal';q.attribute=null;q.restUntil=null;}FM_DEVELOPMENT.playerPlan(rest).restUntil='2030-01-01';const t=FM_PROGRAMMES.ensure().training;t.enabled=true;t.week.forEach(d=>d.am='possession');const oldTrain=FM_ATTRIBUTES.train,gains={};FM_ATTRIBUTES.train=(p,key,gain)=>{gains[p.id]=gain;return {improved:false}};try{FM_PROGRAMMES.applySession('am')}finally{FM_ATTRIBUTES.train=oldTrain}return {young:gains[young.id],old:gains[old.id],rested:!(rest.id in gains),restLoad:FM_DEVELOPMENT.playerPlan(rest).weeklyLoad}}''')
        self.assertGreater(r['young'],r['old'],r);self.assertTrue(r['rested']);self.assertEqual(r['restLoad'],0)

    def test_training_recognizes_own_result_in_an_unfinished_round(self):
        r=self.page.evaluate('''()=>{const e=FM_DEVELOPMENT.fixtures()[0],g=WORLD_ENGINE.eventGames(e).find(g=>[g.home,g.away].includes(GameState.userClub.id));e.done=false;e.date=new Date(Date.parse(GameState.today)-86400000).toISOString().slice(0,10);g.result={home:1,away:0};const phase=FM_DEVELOPMENT.schedule().phase;e.date=GameState.today;return {phase,listed:FM_DEVELOPMENT.fixtures().some(f=>f.id===e.id)}}''')
        self.assertEqual(r['phase'],'Recuperación');self.assertFalse(r['listed'])

    def test_ai_counts_played_gate_receipts_in_an_unfinished_round(self):
        r=self.page.evaluate('''()=>{const ai=CLUB_AI.ensure(),home='river',away=GameState.userClub.id,start=GameState.today,due=new Date(Date.parse(start)+7*86400000).toISOString().slice(0,10);ai.lastDay=start;ai.lastFinancialDate=start;GameState.calendar.push({id:'partial-receipt',type:'LPF',leagueId:'ARG1',date:start,done:false,games:[{home,away,result:{home:1,away:0}},{home:away,away:home}]});GameState.world.clubs=GameState.world.clubs.filter(c=>[home,away].includes(c.id));const original=MARKET_CONTRACTS.registrationOpen;MARKET_CONTRACTS.registrationOpen=()=>false;try{GameState.today=due;CLUB_AI.onDayAdvance(due);const first=CLUB_AI.economy(home).operatingReport.matchday;CLUB_AI.onDayAdvance(due);return {receipt:first,second:CLUB_AI.economy(home).operatingReport.matchday}}finally{MARKET_CONTRACTS.registrationOpen=original}}''')
        self.assertGreater(r['receipt'],0);self.assertEqual(r['receipt'],r['second'])

    def test_neutral_travel_is_symmetric_and_repeated_recording_is_idempotent(self):
        r=self.page.evaluate('''()=>{const home=GameState.userClub.id,away=GameState.world.clubs.find(c=>c.leagueId==='GB1').id,a=mine()[1],b=squad(away)[1],e={id:'neutral-test',date:GameState.today,neutral:true},g={home,away,playerMinutes:{[a.id]:20,[b.id]:20}};for(const p of [a,b])p.injury=0;const random=Math.random;Math.random=()=>.999;try{FM_MEDICINE.afterQuickMatch(e,g,{},[[a.id],[b.id]]);const first=[FM_MEDICINE.loads(a).travel,FM_MEDICINE.loads(b).travel];FM_MEDICINE.afterQuickMatch(e,g,{},[[a.id],[b.id]]);return {first,second:[FM_MEDICINE.loads(a).travel,FM_MEDICINE.loads(b).travel]}}finally{Math.random=random}}''')
        self.assertGreater(r['first'][0],0);self.assertEqual(r['first'][0],r['first'][1]);self.assertEqual(r['first'],r['second'])

    def start_match(self):
        self.page.evaluate('''()=>{const e=WORLD_CLOCK.nextFixture();GameState.today=e.date;WORLD_CLOCK.ensure().slot=WORLD_CLOCK.eventSlot(e);startMatch();clearInterval(timer);timer=null;GameState.match.paused=true}''')

    def test_ai_doses_pressure_and_reorganizes_with_fewer_players(self):
        self.start_match()
        r=self.page.evaluate('''()=>{const m=GameState.match,side=1-m.userSide,before=JSON.stringify(GameState.tactics);m.minute=60;m.score[side]=0;m.score[m.userSide]=1;m.aiTactics.pressing=80;m.aiAdjustments=[];for(const id of m.lineups[side])player(id).condicion_fisica=45;const fatigue=FM_MATCH_REALISM.adaptAI(m),pressure=m.aiTactics.pressing;m.minute=75;m.score[side]=1;m.score[m.userSide]=0;m.red.push(...m.lineups[side].slice(1,3));const fewer=FM_MATCH_REALISM.adaptAI(m),after={line:m.aiTactics.line,press:m.aiTactics.pressing};const repeated=FM_MATCH_REALISM.adaptAI(m);return {fatigue,pressure,fewer,after,repeated,userUnchanged:before===JSON.stringify(GameState.tactics)}}''')
        self.assertTrue(r['fatigue']);self.assertLessEqual(r['pressure'],65);self.assertTrue(r['fewer']);self.assertLessEqual(r['after']['press'],48);self.assertFalse(r['repeated']);self.assertTrue(r['userUnchanged'])

    def test_match_tuning_uses_its_fixture_and_is_calculated_once_per_minute(self):
        self.start_match()
        r=self.page.evaluate('''()=>{const m=GameState.match,original=currentEvent,tune=FM_CALIBRATION.tuning,calls=[];currentEvent=()=>({leagueId:'GB1'});FM_CALIBRATION.tuning=id=>{calls.push(id);return tune(id)};try{FM_SIMULATION.step(m);return {calls,expected:GameState.calendar.find(e=>e.id===m.eventId).leagueId||club(m.home).leagueId}}finally{currentEvent=original;FM_CALIBRATION.tuning=tune}}''')
        self.assertEqual(r['calls'],[r['expected']],r)

    def test_inbox_keeps_one_current_decision_and_retains_it_among_news(self):
        r=self.page.evaluate('''()=>{const o={id:'polish-offer',playerId:1068088,fromClub:player(1068088).clubId,toClub:'boca',type:'buy',dealType:'permanent',stage:'player',status:'pending',awaitingUser:true,counter:{wage:1200},fee:10000,wage:1000,years:3};GameState.offers.unshift(o);const first=FM_INBOX.push({title:'Propuesta inicial',body:'Mensaje inicial',offerId:o.id,playerId:o.playerId,action:'offer',type:'mercado'}),last=FM_INBOX.push({title:'Contraoferta actual',body:'Revisar salario',offerId:o.id,playerId:o.playerId,action:'offer',type:'mercado'});const pending=[FM_INBOX.isPending(first),FM_INBOX.isPending(last)],actions=FM_INBOX.actionsFor(first);for(let i=0;i<170;i++)MANAGEMENT.addMessage('Noticia '+i,'Información','prensa');return {pending,actions,retained:GameState.inbox.some(m=>m.id===last.id),length:GameState.inbox.length}}''')
        self.assertEqual(r['pending'],[False,True]);self.assertTrue(r['retained']);self.assertEqual(r['length'],150)
        self.assertIn('offer-current',[a['id'] for a in r['actions']]);self.assertNotIn('counter-accept',[a['id'] for a in r['actions']])
        m=self.page.evaluate('''()=>{const m=MANAGEMENT.addMessage('Planificar preparación','Revisá el microciclo','directiva',{action:'training',sender:'Cuerpo técnico',eventId:'preseason'});return {sender:m.sender,event:m.eventId,actions:FM_INBOX.actionsFor(m).map(a=>a.id)}}''')
        self.assertEqual(m,{'sender':'Cuerpo técnico','event':'preseason','actions':['go-training']})

    def test_closed_offer_does_not_display_pending_medical_or_registration(self):
        r=self.page.evaluate('''()=>{const o={id:'closed-offer',playerId:1068088,fromClub:player(1068088).clubId,toClub:'boca',type:'buy',dealType:'permanent',stage:'medical',status:'rejected',reason:'Sin acuerdo',awaitingMedical:true,awaitingRegistration:true,awaitingUser:true,fee:10000,wage:1000};GameState.offers.unshift(o);const m=FM_INBOX.push({title:'Propuesta rechazada',body:'Sin acuerdo',offerId:o.id,playerId:o.playerId,action:'offer',type:'mercado'});view='inbox';GameState.world.inboxUI.selected=m.id;render();return {text:document.querySelector('.fm-inbox-reader').textContent,pending:FM_INBOX.isPending(m),actions:FM_INBOX.actionsFor(m)}}''')
        self.assertFalse(r['pending']);self.assertIn('Oferta rechazada',r['text']);self.assertNotIn('Reconocimiento médico programado',r['text']);self.assertNotIn('medical-report',[a['id'] for a in r['actions']])

    def test_inbox_typing_and_selection_keep_the_same_input_node(self):
        self.page.evaluate('()=>{view="inbox";render();window.polishInput=document.getElementById("inboxSearch")}')
        field=self.page.locator('#inboxSearch');field.press_sequentially('contrato',delay=200);self.page.wait_for_timeout(220)
        r=self.page.evaluate('()=>({same:polishInput===document.getElementById("inboxSearch"),focus:document.activeElement.id,value:polishInput.value})')
        self.assertEqual(r,{'same':True,'focus':'inboxSearch','value':'contrato'})
        self.page.evaluate('()=>{polishInput.setSelectionRange(1,5,"backward");render()}')
        self.assertEqual(self.page.evaluate('[document.activeElement.selectionStart,document.activeElement.selectionEnd,document.activeElement.selectionDirection]'),[1,5,'backward'])


if __name__=='__main__':unittest.main(verbosity=2)
