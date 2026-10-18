"""Contract signatures must preserve consent, ownership and dated cash flows."""
import unittest
import test_offer_form as fixture


class MarketConsents(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def test_signed_exit_cannot_be_cancelled_by_termination(self):
        r=self.page.evaluate("""()=>{
          CLUB_AI.ensure();const p=mine().find(p=>CLUB_AI.canRelease(p).ok),target='river';
          squad(target).slice(-3).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();
          CLUB_AI.economy(target).cash=1e9;CLUB_AI.economy(target).wageBudget=1e8;
          GameState.today='2026-04-10';const o={id:'signed-exit',type:'sell',dealType:'permanent',playerId:p.id,fromClub:'boca',toClub:target,fee:1000,wage:p.salario,bonus:0,years:3,releaseClause:0};
          const signed=MARKET_CONTRACTS.agreeTransfer(o),cash=CLUB_AI.cash(),before=p.clubId,rows=JSON.stringify(MARKET_CONTRACTS.ensure().registrations),quote=MARKET_CONTRACTS.terminationQuote(p),result=MARKET_CONTRACTS.terminateContract(p.id,true);
          return {signed,quote,result,atomic:cash===CLUB_AI.cash()&&before===p.clubId&&rows===JSON.stringify(MARKET_CONTRACTS.ensure().registrations)};
        }""")
        self.assertTrue(r['signed']['deferred']);self.assertFalse(r['quote']['ok']);self.assertFalse(r['result']['ok']);self.assertTrue(r['atomic'])

    def test_sale_rivalry_compares_the_other_club(self):
        r=self.page.evaluate("""()=>{const p=mine().find(p=>CLUB_AI.canRelease(p).ok),c=club('river'),o={type:'sell',fromClub:'boca',toClub:'river'};c.rivales=[];c.rivals=[];c.rival=null;const base=MARKET_CONTRACTS.clubNegotiation(p,o).resistance;c.rivales=['boca'];const rival=MARKET_CONTRACTS.clubNegotiation(p,o).resistance;return {base,rival}}""")
        self.assertAlmostEqual(r['rival']-r['base'],.15,places=5)

    def test_selling_requires_player_consent_and_can_fail(self):
        r=self.page.evaluate("""()=>{
          const p=mine().find(p=>p.edad>=24&&CLUB_AI.canRelease(p).ok),c=CLUB_AI.economy('river');squad('river').slice(-4).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();c.cash=1e9;c.wageBudget=1e8;c.reputation=1;GameState.userClub.reputacion=99;
          const o={id:'consent-refused',type:'sell',dealType:'permanent',playerId:p.id,fromClub:'boca',toClub:'river',fee:1000,wage:p.salario,bonus:0,years:3,releaseClause:0,playingTime:'Proyecto',status:'pending',expiresAt:'2026-02-01'};GameState.offers.unshift(o);
          const cash=CLUB_AI.cash(),first=CLUB_AI.respondToSaleOffer(o.id,true),waiting=o.awaitingPlayerConsent&&p.clubId==='boca'&&cash===CLUB_AI.cash();GameState.today='2026-01-04';MARKET_CONTRACTS.processSaleConsent();return {first,waiting,status:o.status,owner:p.clubId,cashUnchanged:cash===CLUB_AI.cash(),reason:o.reason};
        }""")
        self.assertTrue(r['first']);self.assertTrue(r['waiting']);self.assertEqual(r['status'],'rejected');self.assertEqual(r['owner'],'boca');self.assertTrue(r['cashUnchanged']);self.assertIn('nivel',r['reason'])

    def test_buyer_revises_personal_wage_before_sale_completes(self):
        r=self.page.evaluate("""()=>{
          const p=mine().find(p=>p.edad<=23&&CLUB_AI.canRelease(p).ok),c=CLUB_AI.economy('river');squad('river').slice(-4).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();c.cash=1e9;c.wageBudget=1e8;
          const o={id:'consent-pay',type:'sell',dealType:'permanent',playerId:p.id,fromClub:'boca',toClub:'river',fee:1000,wage:100,bonus:0,years:3,releaseClause:0,playingTime:'Rotación',status:'pending',expiresAt:'2026-02-01'};GameState.offers.unshift(o);const cash=CLUB_AI.cash();CLUB_AI.respondToSaleOffer(o.id,true);GameState.today='2026-01-04';MARKET_CONTRACTS.processSaleConsent();const revised={status:o.status,owner:p.clubId,wage:o.wage,cash:CLUB_AI.cash()};GameState.today='2026-01-05';MARKET_CONTRACTS.processSaleConsent();const after=CLUB_AI.cash();MARKET_CONTRACTS.processSaleConsent();return {revised,status:o.status,owner:p.clubId,salary:p.salario,cash,after,once:after===CLUB_AI.cash()};
        }""")
        self.assertEqual(r['revised']['owner'],'boca');self.assertEqual(r['revised']['status'],'pending');self.assertGreater(r['revised']['wage'],100);self.assertEqual(r['revised']['cash'],r['cash']);self.assertEqual(r['owner'],'river');self.assertEqual(r['status'],'accepted');self.assertEqual(r['salary'],r['revised']['wage']);self.assertEqual(r['after']-r['cash'],1000);self.assertTrue(r['once'])

    def test_medical_report_requires_explicit_signature_and_charges_once(self):
        r=self.page.evaluate("""()=>{
          const p=player(1068088);mine().slice(-4).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();GameState.userClub.wageBudget=1e8;FM_DEPTH.inviteRival=()=>null;
          const result=MARKET_CONTRACTS.submitOffer({stage:'club',playerId:p.id,fee:1000000}),o=result.offer,from=p.clubId,cash=CLUB_AI.cash();GameState.today='2026-01-04';MARKET_CONTRACTS.processOffers();
          const personal=MARKET_CONTRACTS.submitPlayerTerms(o.id,{wage:Math.ceil(p.salario*2/100)*100,years:3,bonus:0,releaseClause:p.clausula_rescision,playingTime:'Rotación'});GameState.today='2026-01-05';MARKET_CONTRACTS.processOffers();const waiting=o.awaitingMedical&&p.clubId===from&&cash===CLUB_AI.cash();GameState.today='2026-01-06';MARKET_CONTRACTS.processMedical();MARKET_CONTRACTS.openMedical(o.id);return {result:result.ok,personal:personal.ok,waiting,id:o.id,report:o.medicalReport,cash,from};
        }""")
        self.assertTrue(r['result']);self.assertTrue(r['personal']);self.assertTrue(r['waiting']);self.assertIn('verdict',r['report']);self.assertTrue(self.page.locator('[data-medical-decision="accept"]').is_visible())
        self.page.locator('[data-medical-decision="accept"]').click()
        after=self.page.evaluate("""id=>{const o=GameState.offers.find(o=>o.id===id),cash=CLUB_AI.cash(),again=MARKET_CONTRACTS.respondMedical(id,true);return {cash,again,status:o.status,owner:player(o.playerId).clubId}}""",r['id'])
        self.assertEqual(after['owner'],'boca');self.assertEqual(after['status'],'accepted');self.assertEqual(r['cash']-after['cash'],1000000);self.assertFalse(after['again']['ok'])

    def test_owner_renews_loaned_player_without_raising_borrower_bill(self):
        r=self.page.evaluate("""()=>{
          const p=mine().find(p=>CLUB_AI.canRelease(p).ok&&p.edad>=24);p.salario=1000;p.contract=2028;p.contractEnd='2028-12-31';squad('river').slice(-4).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();CLUB_AI.economy('river').cash=1e9;CLUB_AI.economy('river').wageBudget=1e8;GameState.userClub.wageBudget=1e8;
          const moved=MARKET_CONTRACTS.executeTransfer({id:'owner-loan',type:'sell',dealType:'loan',playerId:p.id,fromClub:'boca',toClub:'river',fee:0,wage:1000,years:1,wageShare:50,loanMonths:6,playingTime:'Rotación',appearanceBonus:22});const loan=MARKET_CONTRACTS.activeLoan(p),borrower=MARKET_CONTRACTS.loanWageFor(p,'river'),cash=CLUB_AI.cash();
          const submitted=FM_RENEWALS.submit(p.id,{confirmed:true,years:4,wage:3000,bonus:10000,releaseClause:0,playingTime:'Titular',appearanceBonus:11});GameState.today='2026-01-04';FM_RENEWALS.process();const row=FM_RENEWALS.current(p.id)||FM_RENEWALS.all().find(r=>r.playerId===p.id);return {moved:moved.ok,submitted:submitted.ok,status:row.status,salary:p.salario,owner:MARKET_CONTRACTS.ownerClub(p),borrowerBefore:borrower,borrowerAfter:MARKET_CONTRACTS.loanWageFor(p,'river'),role:p.squadRole,bonus:p.contractBonuses.appearance,ownerBonus:loan.ownerBonuses.appearance,cost:cash-CLUB_AI.cash(),end:p.contractEnd};
        }""")
        self.assertTrue(r['moved']);self.assertTrue(r['submitted']);self.assertEqual(r['status'],'accepted');self.assertEqual(r['owner'],'boca');self.assertEqual(r['salary'],3000);self.assertEqual(r['borrowerBefore'],r['borrowerAfter']);self.assertEqual(r['role'],'Rotación');self.assertEqual(r['bonus'],22);self.assertEqual(r['ownerBonus'],11);self.assertEqual(r['cost'],10000)

    def test_release_clause_bypasses_seller_coverage_with_real_budget(self):
        r=self.page.evaluate("""()=>{
          mine().filter(p=>WORLD_ENGINE.isForeign(p,'boca')).slice(0,2).forEach(p=>p.clubId=null);mine().slice(-3).forEach(p=>p.clubId=null);WORLD_ENGINE.reindex();GameState.userClub.wageBudget=1e8;
          const p=GameState.players.filter(p=>p.clubId&&club(p.clubId)?.country==='España'&&p.posicion==='POR'&&p.edad>=18&&p.clausula_rescision>0&&p.clausula_rescision<CLUB_AI.availableBudget()).sort((a,b)=>a.clausula_rescision-b.clausula_rescision)[0],from=p.clubId;
          const other=squad(from).filter(q=>q.posicion==='POR'&&q.id!==p.id);other.slice(1).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();const slots=CLUB_AI.canReceive(p,'boca',0),budget=CLUB_AI.availableBudget(),coverage=CLUB_AI.canRelease(p),result=MARKET_CONTRACTS.submitOffer({stage:'club',playerId:p.id,fee:p.clausula_rescision,activateClause:true,installments:0,upfrontPercent:100});return {name:p.nombre,slots,budget,fee:p.clausula_rescision,coverage,result:result.ok,reason:result.reason};
        }""")
        self.assertTrue(r['slots']['ok']);self.assertGreaterEqual(r['budget'],r['fee']);self.assertFalse(r['coverage']['ok']);self.assertTrue(r['result'],r)

    def test_loan_amendment_counter_preserves_old_terms_until_agreement(self):
        r=self.page.evaluate("""()=>{
          const p=player(1068088);p.contract=2029;p.contractEnd='2029-12-31';mine().slice(-4).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();GameState.userClub.wageBudget=1e8;
          const moved=MARKET_CONTRACTS.executeTransfer({id:'amend-loan',type:'buy',dealType:'loan',playerId:p.id,fromClub:p.clubId,toClub:'boca',fee:0,wage:p.salario,years:1,wageShare:100,loanMonths:6}),loan=MARKET_CONTRACTS.activeLoan(p),before={end:loan.endDate,share:loan.wageShare,cash:CLUB_AI.cash()},sent=MARKET_CONTRACTS.proposeLoanAmendment(loan.id,{extraMonths:3,wageShare:0,fee:0,purchaseMode:'option',purchaseFee:Math.max(10000,p.valor_mercado),wage:100,bonus:0,years:3});
          GameState.today='2026-01-04';MARKET_CONTRACTS.processLoanAmendments();const row=MARKET_CONTRACTS.loanAmendment(loan.id),counter=structuredClone(row.counter),unchanged=before.end===loan.endDate&&before.share===loan.wageShare&&before.cash===CLUB_AI.cash();const again=MARKET_CONTRACTS.proposeLoanAmendment(loan.id,counter);GameState.today='2026-01-05';MARKET_CONTRACTS.processLoanAmendments();return {moved:moved.ok,sent:sent.ok,unchanged,counter,again:again.ok,status:row.status,end:loan.endDate,expected:counter.endDate,share:loan.wageShare,agreedSalary:loan.purchaseTerms?.wage,charged:before.cash-CLUB_AI.cash()};
        }""")
        self.assertTrue(r['moved']);self.assertTrue(r['sent']);self.assertTrue(r['unchanged']);self.assertTrue(r['again']);self.assertEqual(r['status'],'accepted');self.assertEqual(r['end'],r['expected']);self.assertEqual(r['share'],r['counter']['wageShare']);self.assertEqual(r['charged'],r['counter']['fee']);self.assertEqual(r['agreedSalary'],r['counter']['wage'])

    def test_future_loan_contract_is_validated_and_only_applies_at_purchase(self):
        r=self.page.evaluate("""()=>{
          const p=player(1068088);p.contract=2030;p.contractEnd='2030-12-31';p.contractWageEscalator={percent:10,nextDate:'2027-01-03'};mine().slice(-4).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();GameState.userClub.wageBudget=1e8;
          const from=p.clubId,cash=CLUB_AI.cash(),salary=p.salario,terms={wage:salary*2,years:2,bonus:250,releaseClause:12345,playingTime:'Titular'},base={id:'future-signed-contract',type:'buy',dealType:'loan',playerId:p.id,fromClub:from,toClub:'boca',fee:0,wage:salary,years:1,wageShare:100,loanMonths:6,purchaseMode:'option',purchaseFee:Math.max(10000,p.valor_mercado),purchaseTerms:terms};
          const invalid=MARKET_CONTRACTS.executeTransfer({...base,purchaseTerms:{...terms,wage:-1}}),atomic=p.clubId===from&&CLUB_AI.cash()===cash;
          const moved=MARKET_CONTRACTS.executeTransfer(base),loan=MARKET_CONTRACTS.activeLoan(p),during={salary:p.salario,end:p.contractEnd,cash:CLUB_AI.cash()},bought=MARKET_CONTRACTS.purchaseLoan(loan.id),after=CLUB_AI.cash(),again=MARKET_CONTRACTS.purchaseLoan(loan.id);
          return {invalid,atomic,moved:moved.ok,during,bought:bought.ok,again,terms,salary,salaryAfter:p.salario,endAfter:p.contractEnd,cost:cash-after,price:loan.purchaseFee,owner:MARKET_CONTRACTS.ownerClub(p),role:p.squadRole,escalator:p.contractWageEscalator||null};
        }""")
        self.assertFalse(r['invalid']['ok']);self.assertTrue(r['atomic']);self.assertTrue(r['moved']);self.assertEqual(r['during']['salary'],r['salary']);self.assertEqual(r['during']['end'],'2030-12-31')
        self.assertTrue(r['bought']);self.assertFalse(r['again']['ok']);self.assertEqual(r['salaryAfter'],r['terms']['wage']);self.assertEqual(r['endAfter'],'2028-12-31');self.assertEqual(r['cost'],r['price']+250);self.assertEqual(r['owner'],'boca');self.assertEqual(r['role'],'Titular');self.assertIsNone(r['escalator'])

    def test_old_mandatory_loan_returns_after_fourteen_days_and_claim_can_be_settled_once(self):
        r=self.page.evaluate("""()=>{
          const p=player(1068088),from=p.clubId;p.contract=2030;p.contractEnd='2030-12-31';mine().slice(-4).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();GameState.userClub.wageBudget=1e8;
          const moved=MARKET_CONTRACTS.executeTransfer({id:'legacy-mandatory',type:'buy',dealType:'loan',playerId:p.id,fromClub:from,toClub:'boca',fee:0,loanMonths:6,wageShare:100,purchaseMode:'mandatory',purchaseFee:Math.max(10000,p.valor_mercado)}),loan=MARKET_CONTRACTS.activeLoan(p);loan.endDate='2026-01-04';
          const cash=CLUB_AI.cash(),seller=CLUB_AI.cash(from);GameState.today='2026-01-04';MARKET_CONTRACTS.returnLoans();const grace={owner:p.clubId,status:loan.status,resolution:loan.defaultResolutionDate,cash:CLUB_AI.cash()};GameState.today='2026-01-17';MARKET_CONTRACTS.returnLoans();const beforeDeadline=loan.status==='active'&&p.clubId==='boca';GameState.today='2026-01-18';MARKET_CONTRACTS.returnLoans();
          const claim=MARKET_CONTRACTS.ensure().purchaseClaims.find(row=>row.loanId===loan.id),reserved=MARKET_CONTRACTS.reserved(),after=JSON.stringify({p,loan,claim}),returned={owner:p.clubId,status:loan.status,returnDate:loan.returnDate,cash:CLUB_AI.cash(),seller:CLUB_AI.cash(from)};MARKET_CONTRACTS.returnLoans();const once=after===JSON.stringify({p,loan,claim}),quote=MARKET_CONTRACTS.quotePurchaseClaim(claim.id),unconfirmed=MARKET_CONTRACTS.settlePurchaseClaim(claim.id),stillPending=claim.status==='pending'&&CLUB_AI.cash()===cash;GameState.userClub.presupuesto_dolares=0;const blocked=MARKET_CONTRACTS.settlePurchaseClaim(claim.id,true),blockedAtomic=claim.status==='pending'&&CLUB_AI.cash()===0&&CLUB_AI.cash(from)===seller;GameState.userClub.presupuesto_dolares=cash;
          MARKET_CONTRACTS.openPurchaseClaim(claim.id);return {moved:moved.ok,grace,beforeDeadline,returned,from,cash,seller,claimId:claim.id,claimAmount:claim.amount,reserved,once,quote,unconfirmed,stillPending,blocked,blockedAtomic};
        }""")
        self.assertTrue(r['moved']);self.assertEqual(r['grace']['owner'],'boca');self.assertEqual(r['grace']['status'],'active');self.assertEqual(r['grace']['resolution'],'2026-01-18');self.assertTrue(r['beforeDeadline'])
        self.assertEqual(r['returned']['owner'],r['from']);self.assertEqual(r['returned']['status'],'defaulted');self.assertEqual(r['returned']['returnDate'],'2026-01-18');self.assertEqual(r['returned']['cash'],r['cash']);self.assertEqual(r['returned']['seller'],r['seller']);self.assertEqual(r['reserved'],0);self.assertTrue(r['once']);self.assertFalse(r['unconfirmed']['ok']);self.assertTrue(r['stillPending']);self.assertFalse(r['blocked']['ok']);self.assertTrue(r['blockedAtomic'])
        self.page.locator('[data-contract-claim-settle]').click()
        after=self.page.evaluate("""id=>{const row=MARKET_CONTRACTS.ensure().purchaseClaims.find(r=>r.id===id),cash=CLUB_AI.cash(),seller=CLUB_AI.cash(row.toClub),again=MARKET_CONTRACTS.settlePurchaseClaim(id,true);return {status:row.status,compensation:row.compensation,mode:row.settlementMode,cash,seller,again}}""",r['claimId'])
        self.assertEqual(after['status'],'settled');self.assertEqual(after['mode'],'simulated-mutual-agreement');self.assertEqual(after['compensation'],r['quote']['compensation']);self.assertEqual(r['cash']-after['cash'],after['compensation']);self.assertEqual(after['seller']-r['seller'],after['compensation']);self.assertFalse(after['again']['ok'])

    def test_mandatory_purchase_with_signed_personal_terms_becomes_real_unpaid_debt(self):
        r=self.page.evaluate("""()=>{
          const p=player(1068088),from=p.clubId;p.contract=2030;p.contractEnd='2030-12-31';mine().slice(-4).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();GameState.userClub.wageBudget=1e8;
          const terms={wage:p.salario*2,years:2,bonus:250,releaseClause:12345,playingTime:'Titular'},moved=MARKET_CONTRACTS.executeTransfer({id:'debt-mandatory',type:'buy',dealType:'loan',playerId:p.id,fromClub:from,toClub:'boca',fee:0,loanMonths:6,wageShare:100,purchaseMode:'mandatory',purchaseFee:Math.max(10000,p.valor_mercado),purchaseTerms:terms}),loan=MARKET_CONTRACTS.activeLoan(p);loan.endDate='2026-01-04';GameState.userClub.presupuesto_dolares=0;
          const seller=CLUB_AI.cash(from);GameState.today='2026-01-04';MARKET_CONTRACTS.returnLoans();const grace={status:loan.status,owner:p.clubId,debts:MARKET_CONTRACTS.ensure().payments.length};GameState.today='2026-01-18';MARKET_CONTRACTS.returnLoans();const state=MARKET_CONTRACTS.ensure(),debts=state.payments.filter(row=>row.offerId==='purchase-'+loan.id),unpaid={status:loan.status,owner:MARKET_CONTRACTS.ownerClub(p),salary:p.salario,cash:CLUB_AI.cash(),seller:CLUB_AI.cash(from),debts:structuredClone(debts),reserved:MARKET_CONTRACTS.reserved(),claims:state.purchaseClaims.length};
          MARKET_CONTRACTS.returnLoans();MARKET_CONTRACTS.settle();const once=state.payments.filter(row=>row.offerId==='purchase-'+loan.id).length===2&&CLUB_AI.cash()===0&&CLUB_AI.cash(from)===seller;
          GameState.userClub.presupuesto_dolares=loan.purchaseFee+terms.bonus;MARKET_CONTRACTS.settle();const paid={cash:CLUB_AI.cash(),seller:CLUB_AI.cash(from),statuses:debts.map(row=>row.status),reserved:MARKET_CONTRACTS.reserved()};MARKET_CONTRACTS.settle();return {moved:moved.ok,grace,unpaid,terms,fee:loan.purchaseFee,seller,once,paid,paidOnce:CLUB_AI.cash(from)===paid.seller&&CLUB_AI.cash()===paid.cash};
        }""")
        self.assertTrue(r['moved']);self.assertEqual(r['grace'],{'status':'active','owner':'boca','debts':0});self.assertEqual(r['unpaid']['status'],'purchased');self.assertEqual(r['unpaid']['owner'],'boca');self.assertEqual(r['unpaid']['salary'],r['terms']['wage']);self.assertEqual(r['unpaid']['cash'],0);self.assertEqual(r['unpaid']['seller'],r['seller']);self.assertEqual(r['unpaid']['claims'],0)
        self.assertEqual(sum(row['amount'] for row in r['unpaid']['debts']),r['fee']+r['terms']['bonus']);self.assertEqual(r['unpaid']['reserved'],r['fee']+r['terms']['bonus']);self.assertTrue(all(row['status']=='pending' and row['dueDate']=='2026-01-18' for row in r['unpaid']['debts']));self.assertTrue(r['once']);self.assertEqual(r['paid']['cash'],0);self.assertEqual(r['paid']['seller']-r['seller'],r['fee']);self.assertEqual(r['paid']['statuses'],['paid','paid']);self.assertEqual(r['paid']['reserved'],0);self.assertTrue(r['paidOnce'])

    def test_unregistrable_signed_purchase_returns_without_cancelling_the_claim(self):
        r=self.page.evaluate("""()=>{
          const p=player(1068088),from=p.clubId;p.contract=2030;p.contractEnd='2030-12-31';mine().slice(-4).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();GameState.userClub.wageBudget=1e8;
          const terms={wage:p.salario*2,years:2,bonus:250,releaseClause:0,playingTime:'Rotación'},moved=MARKET_CONTRACTS.executeTransfer({id:'ineligible-mandatory',type:'buy',dealType:'loan',playerId:p.id,fromClub:from,toClub:'boca',fee:0,loanMonths:6,wageShare:100,purchaseMode:'mandatory',purchaseFee:Math.max(10000,p.valor_mercado),purchaseTerms:terms}),loan=MARKET_CONTRACTS.activeLoan(p);loan.endDate='2026-01-04';
          const template=mine().find(q=>q.id!==p.id);while(mine().length<34){GameState.players.push({...structuredClone(template),id:-900000-GameState.players.length,clubId:'boca'});WORLD_ENGINE.reindex()}
          const cash=CLUB_AI.cash(),seller=CLUB_AI.cash(from);GameState.today='2026-01-04';MARKET_CONTRACTS.returnLoans();GameState.today='2026-01-18';MARKET_CONTRACTS.returnLoans();const claim=MARKET_CONTRACTS.ensure().purchaseClaims.find(row=>row.loanId===loan.id),snapshot=JSON.stringify({p,loan,claim});MARKET_CONTRACTS.returnLoans();return {moved:moved.ok,status:loan.status,owner:p.clubId,from,reason:claim.reason,claimStatus:claim.status,amount:claim.amount,fee:loan.purchaseFee,cashUnchanged:cash===CLUB_AI.cash()&&seller===CLUB_AI.cash(from),debts:MARKET_CONTRACTS.ensure().payments.length,reserved:MARKET_CONTRACTS.reserved(),once:snapshot===JSON.stringify({p,loan,claim})};
        }""")
        self.assertTrue(r['moved']);self.assertEqual(r['status'],'defaulted');self.assertEqual(r['owner'],r['from']);self.assertEqual(r['claimStatus'],'pending');self.assertIn('plazas',r['reason']);self.assertEqual(r['amount'],r['fee']);self.assertTrue(r['cashUnchanged']);self.assertEqual(r['debts'],0);self.assertEqual(r['reserved'],0);self.assertTrue(r['once'])

    def test_medical_signature_outside_window_becomes_registration_without_stale_medical_flags(self):
        r=self.page.evaluate("""()=>{
          const p=player(1068088),from=p.clubId;p.contract=2030;p.contractEnd='2030-12-31';mine().slice(-4).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();GameState.userClub.wageBudget=1e8;GameState.today='2026-04-10';
          const o={id:'medical-future-registration',status:'pending',stage:'medical',type:'buy',dealType:'permanent',playerId:p.id,fromClub:from,toClub:'boca',fee:10000,wage:p.salario*2,years:3,bonus:0,releaseClause:0,playingTime:'Rotación',awaitingMedical:true,awaitingUser:true,medicalReport:MARKET_CONTRACTS.medicalAssessment(p)};GameState.offers.unshift(o);const cash=CLUB_AI.cash(),signed=MARKET_CONTRACTS.respondMedical(o.id,true),stored=MARKET_CONTRACTS.ensure().registrations.find(row=>row.offerId===o.id),after={stage:o.stage,registration:o.awaitingRegistration,medical:o.awaitingMedical,user:o.awaitingUser,owner:p.clubId,cash:CLUB_AI.cash(),storedMedical:stored?.offer.awaitingMedical};MARKET_CONTRACTS.restoreAgreements();const again=MARKET_CONTRACTS.respondMedical(o.id,true);return {signed,after,from,cash,again,rows:MARKET_CONTRACTS.ensure().registrations.filter(row=>row.offerId===o.id).length};
        }""")
        self.assertTrue(r['signed']['ok'],r);self.assertTrue(r['signed']['deferred']);self.assertEqual(r['after']['stage'],'registration');self.assertTrue(r['after']['registration']);self.assertFalse(r['after']['medical']);self.assertFalse(r['after']['storedMedical']);self.assertFalse(r['after']['user']);self.assertEqual(r['after']['owner'],r['from']);self.assertEqual(r['after']['cash'],r['cash']);self.assertFalse(r['again']['ok']);self.assertEqual(r['rows'],1)

if __name__=='__main__':unittest.main()
