"""Exercise management and lifecycle changes through the built game and its real state."""
import unittest

import test_offer_form as fixture


class ManagementLifecycle(unittest.TestCase):
    setUpClass = classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass = classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp = fixture.OfferFormScenarios.setUp
    tearDown = fixture.OfferFormScenarios.tearDown
    seed = fixture.OfferFormScenarios.seed
    vacancy = fixture.OfferFormScenarios.vacancy

    def test_01_medical_rest_prevents_attribute_training_and_load(self):
        r = self.page.evaluate("""()=>{
            const p=mine().find(p=>p.edad<28&&!p.injury),s=FM_DEVELOPMENT.ensure();
            s.policy.highRiskRest=false;s.policy.restBelow=50;p.condicion_fisica=100;
            FM_MEDICINE.setRest(p.id,2);GameState.training.focus='Físico';GameState.training.intensity='Alta';
            const before=JSON.stringify(FM_ATTRIBUTES.ensure(p)),fatigue=FM_MEDICINE.report(p).tissueFatigue;
            FM_DEVELOPMENT.applyTraining(1);
            const after=FM_MEDICINE.report(p);
            return{same:before===JSON.stringify(p.attributes),progress:p.attributeTrainingProgress||{},fatigue:after.tissueFatigue,
                beforeFatigue:fatigue,load:after.risk.acute,resting:FM_MEDICINE.resting(p),report:GameState.training.lastReport};
        }""")
        self.assertTrue(r['same']);self.assertEqual(r['progress'], {})
        self.assertLessEqual(r['fatigue'], r['beforeFatigue']);self.assertEqual(r['load'], 0)
        self.assertTrue(r['resting']);self.assertIn('recuperación', r['report'])

    def test_02_detailed_training_is_independent_and_scanned_unknowns_stay_estimates(self):
        r=self.page.evaluate("""()=>{
            const p=mine().find(p=>p.posicion==='MED'),a=FM_ATTRIBUTES.ensure(p),before={...a};
            FM_ATTRIBUTES.train(p,'vision',1,99);const changed=Object.keys(a).filter(k=>a[k]!==before[k]);
            const q=GameState.players.find(q=>q.clubId!==GameState.userClub.id&&q.posicion==='MED');
            FM_ATTRIBUTES.ensure(q);const estimate=FM_SCOUT_NETWORK.filterSnapshot(q);q.attributes.vision=99;
            const next=FM_SCOUT_NETWORK.filterSnapshot(q),observed=FM_SCOUT_NETWORK.observedPlayer(q);
            p.learnedPositions=['ED'];return{changed,vision:a.vision-before.vision,
                hiddenStable:estimate.details.vision===next.details.vision,
                observedDoesNotShare:observed.attributes!==q.attributes,
                learned:FM_PLAYER.naturalPositions(p).includes('ED'),keys:FM_ATTRIBUTES.keys.length};
        }""")
        self.assertEqual(r['changed'], ['vision']);self.assertEqual(r['vision'],1)
        self.assertTrue(r['hiddenStable']);self.assertTrue(r['observedDoesNotShare']);self.assertTrue(r['learned'])
        self.assertEqual(r['keys'],36)

    def test_03_monthly_valuation_changes_once_and_keeps_reference_source(self):
        r=self.page.evaluate("""()=>{
            const p=mine()[0],ref=JSON.stringify(p.transfermarkt),before=p.valor_mercado;
            FM_LIFECYCLE.valuation(p);p.injury=120;
            const first=FM_LIFECYCLE.updateValuations('2026-02-01'),price=p.valor_mercado;
            const second=FM_LIFECYCLE.updateValuations('2026-02-20');
            return{first,second,before,price,again:p.valor_mercado,source:JSON.stringify(p.transfermarkt)===ref,
                history:p.valuationHistory.length};
        }""")
        self.assertTrue(r['first']);self.assertFalse(r['second']);self.assertLess(r['price'],r['before'])
        self.assertEqual(r['price'],r['again']);self.assertTrue(r['source']);self.assertEqual(r['history'],1)

    def test_04_reserve_schedule_records_actual_minutes_load_and_one_result(self):
        r=self.page.evaluate("""()=>{
            const s=FM_LIFECYCLE.reserveEnsure(),id=GameState.userClub.id,
              comp=Object.values(s.competitions).find(c=>c.kind==='reserve'),
              game=comp.fixtures.find(g=>g.home===id||g.away===id),
              target=FM_LIFECYCLE.reserveXI(id,'reserve',game.date)[0],before=target.reserveMinutes||0;
            GameState.today=game.date;FM_LIFECYCLE.reserveDay(game.date);
            const result=JSON.stringify(game.result),minutes=target.reserveMinutes;
            FM_LIFECYCLE.reserveDay(game.date);
            const condition=target.condicion_fisica;saveGame(true);
            return{target:target.id,delta:minutes-before,minutes,condition,result:!!game.result,
                same:JSON.stringify(game.result)===result&&target.reserveMinutes===minutes,
                clubs:comp.teams.length,total:GameState.world.clubs.filter(c=>c.leagueId===comp.leagueId).length,
                work:FM_MEDICINE.state(target).work.filter(w=>w.id.startsWith('reserve-')).length};
        }""")
        self.assertEqual(r['delta'],90);self.assertLess(r['condition'],100);self.assertTrue(r['result']);self.assertTrue(r['same'])
        self.assertEqual(r['clubs'],r['total']);self.assertEqual(r['work'],1)
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertTrue(self.page.evaluate('(id)=>[...Object.values(FM_LIFECYCLE.ensure().reserve.clubs).flatMap(c=>c.youth),...FM_DEVELOPMENT.ensure().academy].some(p=>p.id===id&&p.reserveMinutes===90)',r['target']))

    def test_05_retirement_removes_from_active_database_preserves_history_and_blocks_signed_departure(self):
        r=self.page.evaluate("""()=>{
            const p=mine().find(p=>!p.loanId),id=p.id,initial=GameState.players.length;
            const o={id:'retirement-signed',playerId:id,status:'pending',awaitingRegistration:true};GameState.offers.push(o);
            const protectedResult=FM_LIFECYCLE.retire(p);o.status='cancelled';
            const retired=FM_LIFECYCLE.retire(p),again=FM_LIFECYCLE.retire(p);saveGame(true);
            return{id,protectedResult,retired,again,removed:!GameState.players.some(q=>q.id===id),
                count:GameState.players.length,initial,archive:player(id)?.retired,xi:GameState.tactics.xi.includes(id)};
        }""")
        self.assertFalse(r['protectedResult']);self.assertTrue(r['retired']);self.assertFalse(r['again'])
        self.assertTrue(r['removed']);self.assertTrue(r['archive']);self.assertFalse(r['xi']);self.assertEqual(r['count'],r['initial']-1)
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertTrue(self.page.evaluate('(id)=>player(id)?.retired',r['id']))

    def test_06_bank_arrears_accrue_every_maturity_and_repay_without_double_interest(self):
        r=self.page.evaluate("""()=>{
            const b=FM_FINANCES.account(),loan=FM_FINANCES.takeLoan(12000,12).loan;
            GameState.userClub.presupuesto_dolares=0;GameState.today='2026-05-24';FM_FINANCES.onDay(GameState.today);
            const before=FM_FINANCES.arrears(),expense=b.operatingExpense,pending=loan.payments.length;
            GameState.userClub.presupuesto_dolares=100000;GameState.today='2026-05-25';FM_FINANCES.onDay(GameState.today);
            const cash=GameState.userClub.presupuesto_dolares;FM_FINANCES.onDay(GameState.today);
            return{pending,principal:before.principal,interest:before.interest,total:before.total,
                remaining:loan.remaining,paid:loan.payments.filter(p=>p.status==='paid').length,
                arrears:FM_FINANCES.arrears().total,expense,expenseAfter:b.operatingExpense,
                cash,same:cash===GameState.userClub.presupuesto_dolares};
        }""")
        self.assertEqual(r['pending'],4);self.assertEqual(r['principal'],4000);self.assertEqual(r['interest'],400)
        self.assertEqual(r['total'],4400);self.assertEqual(r['remaining'],8000);self.assertEqual(r['paid'],4)
        self.assertEqual(r['arrears'],0);self.assertEqual(r['expenseAfter'],r['expense']);self.assertTrue(r['same'])

    def test_07_fiscal_close_includes_both_calendar_years_and_reallocation_keeps_cash(self):
        r=self.page.evaluate("""()=>{
            const id=GameState.userClub.id,b=FM_FINANCES.account();
            b.board.season=2025;MANAGEMENT.transaction(-1200,'Gasto enero','medico');
            GameState.today='2026-06-30';MANAGEMENT.transaction(-2300,'Gasto junio','medico');FM_FINANCES.onSeason(2026,[id]);
            const statement=b.statements.find(s=>s.kind==='annual'&&s.year===2025);
            const cash=GameState.userClub.presupuesto_dolares,auth=b.board.authorized,wage=GameState.userClub.wageBudget;
            const first=FM_FINANCES.reallocate('salary',100),after=GameState.userClub.presupuesto_dolares;
            const reverse=FM_FINANCES.reallocate('transfers',100);
            return{statement,first:first.ok,reverse:reverse.ok,unchanged:cash===after&&after===GameState.userClub.presupuesto_dolares,
                wage:GameState.userClub.wageBudget===wage,auth:b.board.authorized===auth};
        }""")
        self.assertEqual(r['statement']['expense'],3500);self.assertEqual(r['statement']['result'],-3500)
        self.assertTrue(r['first']);self.assertTrue(r['reverse']);self.assertTrue(r['unchanged']);self.assertTrue(r['wage']);self.assertTrue(r['auth'])

    def test_08_staff_hiring_and_renewal_have_counteroffers_and_charge_once(self):
        r=self.page.evaluate("""()=>{
            const s=FM_GOVERNANCE.ensure(),candidate=FM_DEVELOPMENT.candidates().find(c=>c.role==='Preparador'),
              o=FM_OFFICE.office(),cash=GameState.userClub.presupuesto_dolares,started=GameState.today,
              plus=n=>new Date(Date.parse(started)+n*86400000).toISOString().slice(0,10);
            const proposal=FM_GOVERNANCE.proposeStaff(candidate.id,{salary:candidate.salary-25,bonus:0,years:2});
            GameState.today=plus(1);FM_GOVERNANCE.processStaff(GameState.today);
            const counter=proposal.negotiation.awaitingUser&&!o.staff.some(e=>e.id===candidate.id),
              accepted=FM_GOVERNANCE.respondStaff(proposal.negotiation.id,true).ok;
            GameState.today=plus(2);FM_GOVERNANCE.processStaff(GameState.today);
            const employee=o.staff.find(e=>e.id===candidate.id),paid=cash-GameState.userClub.presupuesto_dolares;
            FM_GOVERNANCE.processStaff(GameState.today);
            const renew=FM_GOVERNANCE.proposeStaff(employee.id,{salary:employee.salary,bonus:0,years:3});
            GameState.today=plus(3);FM_GOVERNANCE.processStaff(GameState.today);
            return{proposal:proposal.ok,counter,accepted,hired:!!employee,paid,bonus:candidate.signingFee,
                once:paid===cash-GameState.userClub.presupuesto_dolares,end:employee.employment.end,started,
                renewal:renew.ok,renewalCounter:renew.negotiation.awaitingUser};
        }""")
        self.assertTrue(r['proposal']);self.assertTrue(r['counter']);self.assertTrue(r['accepted']);self.assertTrue(r['hired'])
        self.assertEqual(r['paid'],r['bonus']);self.assertTrue(r['once'])
        self.assertEqual(r['end'],str(int(r['started'][:4])+2)+r['started'][4:])
        self.assertTrue(r['renewal']);self.assertTrue(r['renewalCounter'])

    def test_09_interview_counter_contract_and_appointment_respect_start_date(self):
        r=self.page.evaluate("""()=>{
            const old=GameState.userClub.id,target='river',s=FM_GOVERNANCE.ensure(),j=FM_GOVERNANCE.publishVacancy(target),
              a=FM_GOVERNANCE.applyJob(j.id).application,counts=GameState.players.length;
            const offer=FM_GOVERNANCE.submitInterview(a.id,{salary:j.salary*2,years:3,startDate:'2026-02-02',plan:'cantera',acceptObjective:true});
            GameState.today='2026-01-26';FM_GOVERNANCE.careerDay(GameState.today);const counter=a.status;
            const signed=FM_GOVERNANCE.signJob(a.id),start=s.pendingAppointment.startDate;
            GameState.today='2026-02-01';FM_GOVERNANCE.careerDay(GameState.today);const still=GameState.userClub.id===old;
            GameState.today=start;FM_GOVERNANCE.careerDay(start);
            return{offer:offer.ok,counter,signed:signed.ok,still,start,club:GameState.userClub.id,
                contract:s.activeContract,pending:s.pendingAppointment,counts:GameState.players.length===counts,
                application:a.status};
        }""")
        self.assertTrue(r['offer']);self.assertEqual(r['counter'],'counter');self.assertTrue(r['signed']);self.assertTrue(r['still'])
        self.assertEqual(r['club'],'river');self.assertEqual(r['contract']['clubId'],'river');self.assertEqual(r['contract']['start'],r['start'])
        self.assertIsNone(r['pending']);self.assertTrue(r['counts']);self.assertEqual(r['application'],'joined')

    def test_10_quick_match_observations_use_actual_minutes_and_deduplicate(self):
        r=self.page.evaluate("""()=>{
            const q=GameState.players.find(p=>p.clubId&&p.clubId!==GameState.userClub.id&&!p.injury),
              other=GameState.world.clubs.find(c=>c.id!==q.clubId&&c.id!==GameState.userClub.id).id;
            FM_DEPTH.ensure().reports[q.id]={status:'active',level:50,started:GameState.today,updated:GameState.today};
            const event={id:'scout-quick-test',date:GameState.today},g={home:q.clubId,away:other},xi=[[q.id],[]];
            const first=FM_LIFECYCLE.observeQuickMatch(event,g,{},xi),second=FM_LIFECYCLE.observeQuickMatch(event,g,{},xi),
              d=FM_SCOUT_NETWORK.dossier(q);
            return{first,second,count:d.matches.length,minutes:d.matches[0]?.minutes,sample:d.observations.at(-1)?.matchSample};
        }""")
        self.assertTrue(r['first']);self.assertFalse(r['second']);self.assertEqual(r['count'],1)
        self.assertEqual(r['minutes'],90);self.assertEqual(r['sample'],1)

    def test_11_academy_recovers_from_reserve_injury_and_uses_calendar_age(self):
        r=self.page.evaluate("""()=>{
            const s=FM_DEVELOPMENT.ensure(),p=s.academy[0],start=GameState.today,
              plus=n=>new Date(Date.parse(start)+n*86400000).toISOString().slice(0,10),
              calendarYear=Number(start.slice(0,4));
            GameState.year=calendarYear-1;s.intakeYear=GameState.year;
            p.birthYear=calendarYear-18;p.edad=17;p.academyProgress=.99;
            FM_MEDICINE.injure(p,{days:2,type:'contusion',date:start,notify:false});
            FM_MEDICINE.state(p).restUntil=plus(3);
            GameState.today=plus(1);FM_DEVELOPMENT.onDay(GameState.today);
            const injured=p.injury,progress=p.academyProgress,age=p.edad;
            GameState.today=plus(2);FM_DEVELOPMENT.onDay(GameState.today);
            return{injured,healed:p.injury===0,age,progress,restProgress:p.academyProgress,
                resting:FM_MEDICINE.resting(p),returning:FM_MEDICINE.report(p).risk.returning};
        }""")
        self.assertEqual(r['injured'],1);self.assertTrue(r['healed']);self.assertEqual(r['age'],18)
        self.assertEqual(r['progress'],.99);self.assertEqual(r['restProgress'],.99)
        self.assertTrue(r['resting']);self.assertTrue(r['returning'])

    def test_12_youth_intakes_keep_a_legal_balanced_team_after_aging(self):
        r=self.page.evaluate("""()=>{
            const s=FM_LIFECYCLE.reserveEnsure(),id=GameState.userClub.id,
              first=s.clubs[id].youth.map(p=>p.id),year=Number(GameState.today.slice(0,4))+2,
              xi=FM_LIFECYCLE.reserveXI(id,'youth',year+'-02-01'),all=s.clubs[id].youth,
              eligible=all.filter(p=>p.edad<=19);
            return{count:xi.length,keepers:xi.filter(p=>p.posicion==='POR').length,
                ages:xi.every(p=>p.edad<=19),eligible:eligible.length,
                fresh:eligible.some(p=>!first.includes(p.id)),unique:new Set(all.map(p=>p.id)).size===all.length};
        }""")
        self.assertEqual(r['count'],11);self.assertEqual(r['keepers'],1);self.assertTrue(r['ages'])
        self.assertGreaterEqual(r['eligible'],16);self.assertTrue(r['fresh']);self.assertTrue(r['unique'])
