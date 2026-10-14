#!/usr/bin/env python3
"""Browser checks for decisions, club autonomy and persistent management state.

These scenarios run the actual embedded world with outside requests blocked.
They check economic and sporting consequences in addition to visible controls.
"""
import json
import calendar
from datetime import date, timedelta
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from playwright.sync_api import sync_playwright


REPO = Path(__file__).resolve().parents[1]
URL = os.environ.get('FM27_TEST_URL', 'http://127.0.0.1:8000/index.html')
KEY = 'fm27-pasion-v1'
ARTIFACTS = Path(tempfile.gettempdir()) / 'fm27-management-qa'


def add_months(value, months):
    """Match calendar months without allowing a short February to overflow."""
    value = date.fromisoformat(value)
    year, month = divmod(value.year * 12 + value.month - 1 + months, 12)
    month += 1
    return date(year, month, min(value.day, calendar.monthrange(year, month)[1])).isoformat()


class ManagementScenarios(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        cls.previous_world = subprocess.check_output(['git', 'show', '75b5b49:index.html'], cwd=REPO)
        cls.pw = sync_playwright().start()
        executable = os.environ.get('FM27_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome')
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        if executable:
            options['executable_path'] = executable
        cls.browser = cls.pw.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 960}, accept_downloads=True)
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors = []
        self.external_requests = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('dialog', lambda dialog: dialog.accept())
        self.page.route('https://**/*', self.block_external)
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.wait_for_selector('#worldCareerCountry')
        self.seed()

    def block_external(self, route):
        self.external_requests.append(route.request.url)
        route.abort()

    def seed(self):
        self.page.evaluate("""()=>{
            let seed=3102026;
            Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
            window.__qaReachReady=()=>{
                if(!window.WORLD_CLOCK||GameState?.version!==3)return;
                let turns=0;
                while(!GameState.finished&&!WORLD_CLOCK.ready()){
                    WORLD_CLOCK.advance({silent:true});
                    if(++turns>1600)throw Error('Daily calendar did not reach a playable fixture');
                }
            };
            // Contract tests isolate settlement from unrelated daily AI trades.
            window.__qaProcessResponse=offer=>{
                if(window.WORLD_CLOCK&&offer.responseDate)GameState.today=offer.responseDate;
                else GameState.eventIndex++;
                CLUB_AI.processUserOffers();
            };
        }""")

    def tearDown(self):
        if self.errors:
            self.page.screenshot(path=str(ARTIFACTS / (self._testMethodName + '-error.png')), full_page=True)
        self.context.close()
        self.assertEqual(self.errors, [], 'Uncaught application errors')

    def career(self, league_id='ARG1', club_id='boca'):
        country = self.page.evaluate('(id)=>WORLD_DATABASE.leagues.find(l=>l.id===id).country', league_id)
        self.page.fill('#manager', 'DT decisiones')
        self.page.locator('#worldCareerCountry').select_option(label=country)
        self.page.locator('#worldCareerLeague').select_option(league_id)
        if club_id is None:
            club_id = self.page.locator('#club option').first.get_attribute('value')
        self.page.locator('#club').select_option(club_id)
        self.page.click('[data-action="new"]')
        self.page.wait_for_function('GameState?.version===3 && !!currentEvent()')
        self.assertTrue(self.page.evaluate('!!window.CLUB_AI && !!window.FM_PLAYER && !!window.FM_TACTICS && !!window.FM_INBOX'))

    def nav(self, target):
        self.page.locator('aside [data-view="' + target + '"]').click()
        self.assertGreater(len(self.page.locator('#content').inner_text()), 100)

    def complete_user_match(self):
        self.page.evaluate('__qaReachReady()')
        self.page.evaluate("""()=>{
            autoLineup();startMatch();clearInterval(timer);timer=null;
            if(!GameState.match)throw Error('No se pudo iniciar el partido');
            view='dashboard';let count=0;
            while(!GameState.match.done){GameState.match.paused=false;tick();if(++count>130)throw Error('Partido detenido')}
            finishMatch();
        }""")

    def assert_no_overflow(self, width=1440):
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width+1)

    def reload_state(self):
        self.page.evaluate('saveGame(true)')
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_selector('aside')
        self.seed()

    def market_target(self):
        """Make one documented roster vacancy and select an affordable real target."""
        return self.page.evaluate("""()=>{
            CLUB_AI.ensure();const user=GameState.userClub.id;
            const vacancy=mine().find(p=>!GameState.tactics.xi.includes(p.id)&&CLUB_AI.canRelease(p,user).ok);
            if(mine().length>=32){if(!vacancy)throw Error('Sin plaza para el escenario');vacancy.clubId=null;WORLD_ENGINE.reindex();autoLineup()}
            const target=GameState.players.filter(p=>p.clubId&&p.clubId!==user&&p.posicion==='MED'&&
                !WORLD_ENGINE.isForeign(p,user)&&CLUB_AI.canRelease(p,p.clubId).ok)
                .sort((a,b)=>a.valor_mercado-b.valor_mercado)[0];
            if(!target)throw Error('Sin objetivo negociable');
            target.valor_mercado=100000;target.salario=1000;target.contract=2028;target.potential=75;
            GameState.today='2026-01-28';
            return {id:target.id,owner:target.clubId,contract:target.contract,wage:target.salario,
                user,openingCash:GameState.userClub.presupuesto_dolares,
                ownerCash:CLUB_AI.cash(target.clubId),userWages:CLUB_AI.wageBill(user),ownerWages:CLUB_AI.wageBill(target.clubId)};
        }""")

    def test_01_player_page_attributes_sources_comparison_and_monthly_evolution(self):
        self.career()
        data = self.page.evaluate("""()=>{
            const p=mine().find(p=>p.transfermarkt?.playerId===166237)||mine()[0],other=mine().find(q=>q.id!==p.id);
            const before=JSON.stringify(p),a=FM_PLAYER.attributes(p),b=FM_PLAYER.attributes(p);
            FM_PLAYER.captureProgress();const initial=JSON.stringify(GameState.world.playerProgress[p.id]);
            FM_PLAYER.captureProgress();const same=JSON.stringify(GameState.world.playerProgress[p.id]);
            const initialPass=p.pase;p.pase=Math.min(99,p.pase+3);GameState.today='2026-03-05';FM_PLAYER.captureProgress();
            saveGame(true);
            return {id:p.id,name:p.nombre,otherId:other.id,otherName:other.nombre,attributes:a,stable:JSON.stringify(a)===JSON.stringify(b),
                noPlayerMutation:before===JSON.stringify({...p,pase:initialPass}),positions:FM_PLAYER.naturalPositions(p),
                stars:FM_PLAYER.relativeStars(p),sameMonth:initial===same,progress:GameState.world.playerProgress[p.id]};
        }""")
        self.assertTrue(data['stable'])
        self.assertTrue(data['noPlayerMutation'], 'Derived attributes must not bloat all player objects')
        self.assertEqual(len(data['attributes']), 36)
        self.assertTrue(all(isinstance(v, (int,float)) and 1<=v<=99 for v in data['attributes'].values()))
        self.assertGreater(len(data['positions']), 0)
        self.assertGreaterEqual(data['stars'], .5)
        self.assertLessEqual(data['stars'], 5)
        self.assertTrue(data['sameMonth'], 'Progress capture must not duplicate a month')
        self.assertEqual(len(data['progress']), 2)
        self.nav('squad')
        self.page.locator('#content [data-player="' + str(data['id']) + '"]').first.click()
        self.assertEqual(self.page.evaluate('view'), 'player')
        self.assertIn(data['name'], self.page.locator('#content').inner_text())
        self.assertFalse(self.page.locator('#details').is_visible())
        self.assertEqual(self.page.locator('#content .fm-data-source').count(), 0)
        for tab in ['attributes','progress','stats','contract','sources']:
            self.page.locator('[data-fp-tab="' + tab + '"]').click()
            self.assertGreater(len(self.page.locator('#content').inner_text()), 200)
            self.assert_no_overflow()
        self.assertGreater(self.page.locator('#content .fm-data-source').count(), 0)
        self.assertIn('Transfermarkt', self.page.locator('#content').inner_text())
        self.assertTrue(self.page.locator('#content a[href*="transfermarkt"]').first.get_attribute('href').startswith('https://'))
        self.page.locator('[data-fp-tab="attributes"]').click()
        self.page.locator('#fp-compare-query').fill(data['otherName'])
        self.page.locator('#fp-compare-player').select_option(str(data['otherId']))
        self.assertIn(data['otherName'], self.page.locator('#content').inner_text())
        self.page.locator('[data-fp-back]').click()
        self.assertEqual(self.page.evaluate('view'), 'squad')
        self.reload_state()
        progress = self.page.evaluate('(id)=>GameState.world.playerProgress[id]', data['id'])
        self.assertEqual(progress, data['progress'])

    def test_02_tactical_keyboard_assignment_plans_instructions_and_live_limits(self):
        self.career()
        self.nav('tactics')
        pair = self.page.evaluate("""()=>{
            const all=[...GameState.tactics.xi,...GameState.tactics.bench];
            for(let source=11;source<18;source++){
                const p=player(all[source]);if(p.posicion==='POR')continue;
                const target=all.slice(1,11).findIndex(id=>player(id).posicion===p.posicion)+1;
                if(target>0)return {source,target,sourcePlayer:p.id,targetPlayer:all[target],all};
            }throw Error('Sin intercambio compatible');
        }""")
        self.page.locator('[data-tw-slot="' + str(pair['source']) + '"]').focus()
        self.page.keyboard.press('Space')
        self.page.locator('[data-tw-slot="' + str(pair['target']) + '"]').focus()
        self.page.keyboard.press('Enter')
        swapped = self.page.evaluate('[...GameState.tactics.xi,...GameState.tactics.bench]')
        self.assertEqual(swapped[pair['target']], pair['sourcePlayer'])
        self.assertEqual(swapped[pair['source']], pair['targetPlayer'])
        self.assertEqual(set(swapped), set(pair['all']))
        self.assertEqual(len(set(swapped)), 18)
        self.page.locator('[data-tw-instruction="passing"]').select_option('Cortos')
        self.page.locator('[data-tw-instruction="tackling"]').select_option('Fuerte')
        self.page.locator('[data-tw-team="style"]').select_option('Garra/Huevo')
        self.page.locator('#tw-pressing').evaluate("node=>{node.value='80';node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}))}")
        self.page.locator('[data-tw-plan-name]').fill('Presión y pases cortos')
        self.page.locator('[data-tw-save]').click()
        saved = self.page.evaluate("""()=>({id:GameState.tactics.savedPlans[0].id,
            xi:[...GameState.tactics.xi],bench:[...GameState.tactics.bench],style:GameState.tactics.style,
            formation:GameState.tactics.formation,pressing:GameState.tactics.pressing,
            roles:structuredClone(GameState.tactics.savedPlans[0].roles),instructions:structuredClone(GameState.tactics.savedPlans[0].instructions)})""")
        self.page.evaluate("""(id)=>{
            GameState.tactics.formation='4-4-2';GameState.tactics.style='Tiki-Taka';GameState.tactics.pressing=20;
            FM_TACTICS.setInstruction(id,'passing','Directos');autoLineup();render();
        }""", pair['sourcePlayer'])
        self.page.locator('[data-tw-load="' + saved['id'] + '"]').click()
        loaded = self.page.evaluate("""()=>({id:GameState.tactics.savedPlans[0].id,
            xi:[...GameState.tactics.xi],bench:[...GameState.tactics.bench],style:GameState.tactics.style,
            formation:GameState.tactics.formation,pressing:GameState.tactics.pressing,
            roles:structuredClone(GameState.tactics.roles),instructions:structuredClone(GameState.tactics.instructions)})""")
        self.assertEqual(loaded, saved)
        effects = self.page.evaluate("""(id)=>{
            const p=player(id),t=GameState.tactics,f=FM_TACTICS.familiarity(t);
            const trained=FM_TACTICS.trainFamiliarity(10),mods=FM_TACTICS.teamMatchModifiers(t);
            const attacker=mine().find(p=>p.posicion==='DEL'),wrong=FM_TACTICS.assignSlot(0,attacker.id);
            const chosen=player(t.bench.find(id=>player(id).posicion!=='POR'));chosen.injury=7;
            const injured=FM_TACTICS.assignSlot(1,chosen.id);chosen.injury=0;
            const outsider=GameState.players.find(p=>p.clubId!==GameState.userClub.id&&p.posicion==='DEF');
            const external=FM_TACTICS.assignSlot(1,outsider.id);
            return {f,trained,mods,wrong,injured,external,valid:FM_TACTICS.validateLineup().valid,
                factor:FM_TACTICS.playerMatchFactor(p,t,p.posicion)};
        }""", pair['sourcePlayer'])
        self.assertGreater(effects['trained'], effects['f'])
        self.assertGreater(effects['mods']['foulRisk'], 1)
        self.assertFalse(effects['wrong'])
        self.assertFalse(effects['injured'])
        self.assertFalse(effects['external'])
        self.assertTrue(effects['valid'])
        self.assertGreaterEqual(effects['factor'], .9)
        self.assertLessEqual(effects['factor'], 1.06)
        self.reload_state()
        self.assertEqual(self.page.evaluate('GameState.tactics.savedPlans[0].name'), 'Presión y pases cortos')
        self.assertEqual(self.page.evaluate('(id)=>GameState.tactics.instructions[id].passing', pair['sourcePlayer']), 'Cortos')
        self.page.evaluate('__qaReachReady()')
        blocked = self.page.evaluate("""(planId)=>{
            startMatch();clearInterval(timer);timer=null;GameState.match.paused=true;
            const before=JSON.stringify({xi:GameState.tactics.xi,bench:GameState.tactics.bench,formation:GameState.tactics.formation});
            const swap=FM_TACTICS.swapSlots(1,2),load=FM_TACTICS.loadPlan(planId);
            const legal=FM_TACTICS.setInstruction(GameState.tactics.xi[1],'tackling','Suave');
            return {swap,load,legal,preserved:before===JSON.stringify({xi:GameState.tactics.xi,bench:GameState.tactics.bench,formation:GameState.tactics.formation})};
        }""", saved['id'])
        self.assertFalse(blocked['swap'])
        self.assertFalse(blocked['load'])
        self.assertTrue(blocked['legal'])
        self.assertTrue(blocked['preserved'])

    def test_08_browsing_live_player_pauses_without_changing_match_or_lineup(self):
        self.career()
        self.page.evaluate('__qaReachReady()')
        self.page.evaluate("""()=>{
            autoLineup();startMatch();clearInterval(timer);timer=null;
            while(GameState.match.minute<21){GameState.match.paused=false;tick()}
            view='match';GameState.match.paused=false;render();
        }""")
        before = self.page.evaluate('({minute:GameState.match.minute,score:[...GameState.match.score],xi:[...GameState.tactics.xi],substitutions:GameState.match.substitutions})')
        self.page.evaluate('FM_PLAYER.open(GameState.match.lineups[GameState.match.userSide][0])')
        self.assertEqual(self.page.evaluate('view'), 'player')
        self.assertTrue(self.page.evaluate('GameState.match.paused'))
        self.page.locator('[data-fp-tab="stats"]').click()
        self.page.locator('[data-fp-back]').click()
        self.assertEqual(self.page.evaluate('view'), 'match')
        after = self.page.evaluate('({minute:GameState.match.minute,score:[...GameState.match.score],xi:[...GameState.tactics.xi],substitutions:GameState.match.substitutions})')
        self.assertEqual(after, before)
        self.assertTrue(self.page.evaluate('GameState.match.paused'))
        self.reload_state()
        self.assertEqual(self.page.evaluate('GameState.match.minute'), before['minute'])
        self.assertTrue(self.page.evaluate('GameState.match.paused'))

    def test_03_inbox_sale_decision_is_atomic_and_medical_actions_are_useful(self):
        self.career()
        scenario = self.page.evaluate("""()=>{
            CLUB_AI.ensure();
            const user=GameState.userClub.id;
            const p=mine().filter(p=>!WORLD_ENGINE.isForeign(p,user)&&CLUB_AI.canRelease(p,user).ok).sort((a,b)=>a.valor_mercado-b.valor_mercado)[0];
            if(!p)throw Error('Sin jugador transferible');
            const fee=100000;p.valor_mercado=100000;p.salario=100;
            const buyer=GameState.world.clubs.find(c=>c.id!==user&&c.country==='Argentina'&&
                CLUB_AI.cash(c.id)>=fee&&CLUB_AI.canReceive(p,c.id,p.salario).ok);
            if(!buyer)throw Error('Sin comprador elegible');
            const offer={id:'qa-sale-atomic',playerId:p.id,type:'sell',fromClub:user,toClub:buyer.id,
                fee,wage:p.salario,years:2,bonus:0,status:'pending',createdAt:GameState.eventIndex,dueAt:GameState.eventIndex+1};
            GameState.offers.unshift(offer);
            const message=FM_INBOX.push({title:'Oferta de prueba por tu jugador',body:'La decisión necesita aprobación del DT.',
                type:'mercado',action:'sale',playerId:p.id,offerId:offer.id,sourceKey:'qa:atomic-sale'});
            const medical=mine().find(q=>q.id!==p.id);medical.injury=7;medical.trainingFocus='Equipo';
            const notice=FM_INBOX.push({title:'Parte médico de prueba',body:'Recuperación y reemplazo para el siguiente partido.',
                type:'medico',action:'medical',playerId:medical.id,sourceKey:'qa:medical'});
            const repeated=FM_INBOX.push({title:'No duplicar el mensaje',body:'Mismo hecho.',sourceKey:'qa:medical'});
            saveGame(true);view='inbox';render();
            return {offerId:offer.id,messageId:message.id,playerId:p.id,buyer:buyer.id,fee,
                balance:GameState.userClub.presupuesto_dolares,buyerBalance:CLUB_AI.cash(buyer.id),
                medicalId:notice.id,medicalPlayer:medical.id,dedup:repeated.id===notice.id};
        }""")
        self.assertTrue(scenario['dedup'])
        self.page.locator('[data-inbox-open="' + str(scenario['messageId']) + '"]').click()
        self.page.locator('[data-inbox-action="sale-accept"]').click()
        after = self.page.evaluate("""(s)=>({
            status:GameState.offers.find(o=>o.id===s.offerId).status,
            playerClub:player(s.playerId).clubId,balance:GameState.userClub.presupuesto_dolares,
            buyerBalance:CLUB_AI.cash(s.buyer),foreigners:foreigners(GameState.userClub.id),
            limit:WORLD_ENGINE.foreignLimit(),xi:GameState.tactics.xi,
            owned:GameState.tactics.xi.every(id=>player(id)?.clubId===GameState.userClub.id)
        })""", scenario)
        self.assertEqual(after['status'], 'accepted')
        self.assertEqual(after['playerClub'], scenario['buyer'])
        self.assertEqual(after['balance'], scenario['balance']+scenario['fee'])
        self.assertEqual(after['buyerBalance'], scenario['buyerBalance']-scenario['fee'])
        self.assertLessEqual(after['foreigners'], after['limit'])
        self.assertTrue(after['owned'])
        self.assertEqual(len(set(after['xi'])), len(after['xi']))
        self.assertEqual(self.page.locator('[data-inbox-action="sale-accept"]').count(), 0)
        repeated = self.page.evaluate("""(s)=>{
            FM_INBOX.execute(s.messageId,'sale-accept');CLUB_AI.respondToSaleOffer(s.offerId,true);
            return {balance:GameState.userClub.presupuesto_dolares,buyerBalance:CLUB_AI.cash(s.buyer),club:player(s.playerId).clubId};
        }""", scenario)
        self.assertEqual(repeated['balance'], after['balance'])
        self.assertEqual(repeated['buyerBalance'], after['buyerBalance'])
        self.assertEqual(repeated['club'], scenario['buyer'])
        self.page.locator('[data-inbox-open="' + str(scenario['medicalId']) + '"]').click()
        self.page.locator('[data-inbox-action="recovery"]').click()
        self.assertEqual(self.page.evaluate('(id)=>player(id).trainingFocus', scenario['medicalPlayer']), 'Recuperación')
        self.assertEqual(self.page.evaluate('(id)=>player(id).injury', scenario['medicalPlayer']), 7)
        self.assertFalse(self.page.evaluate('(id)=>FM_INBOX.isPending(GameState.inbox.find(m=>m.id===id))', scenario['medicalId']))
        self.page.locator('#inboxCategory').select_option('plantel')
        self.page.locator('#inboxSearch').fill('médico de prueba')
        self.assertEqual(self.page.locator('[data-inbox-open]').count(), 1)
        self.reload_state()
        self.nav('inbox')
        self.assertEqual(self.page.locator('#inboxSearch').input_value(), 'médico de prueba')
        self.assertEqual(self.page.locator('#inboxCategory').input_value(), 'plantel')

    def test_04_autonomous_clubs_renew_trade_and_protect_user_players(self):
        self.career()
        result = self.page.evaluate("""()=>{
            CLUB_AI.ensure();
            const user=GameState.userClub.id;
            const own=mine().map(p=>({id:p.id,clubId:p.clubId,salario:p.salario,contract:p.contract}));
            const ownBalance=GameState.userClub.presupuesto_dolares;
            const former=new Map(GameState.players.map(p=>[p.id,{clubId:p.clubId,contract:p.contract}]));
            const team=GameState.world.clubs.find(c=>c.id!==user&&squad(c.id).length>=26);
            const important=squad(team.id).sort((a,b)=>overall(b)-overall(a)).slice(0,8);
            for(const p of important)p.contract=GameState.year;
            const dates=[];
            for(let month=2;month<=10;month++)for(const day of [1,8,15,22]){
                const date=`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                GameState.today=date;CLUB_AI.onDayAdvance(date);dates.push(date);
            }
            const changed=GameState.players.filter(p=>former.get(p.id)?.clubId!==p.clubId);
            const renewed=important.filter(p=>p.contract>GameState.year&&p.clubId===team.id);
            const snapshot=JSON.stringify({ai:GameState.world.ai,players:GameState.players.map(p=>[p.id,p.clubId,p.contract,p.salario])});
            CLUB_AI.onDayAdvance(GameState.today);CLUB_AI.onDayAdvance(GameState.today);
            const repeated=JSON.stringify({ai:GameState.world.ai,players:GameState.players.map(p=>[p.id,p.clubId,p.contract,p.salario])});
            return {
                changed:changed.length,renewed:renewed.length,idempotent:snapshot===repeated,
                own,ownAfter:mine().map(p=>({id:p.id,clubId:p.clubId,salario:p.salario,contract:p.contract})),
                ownBalance,balanceAfter:GameState.userClub.presupuesto_dolares,
                teams:GameState.world.clubs.filter(c=>c.id!==user).map(c=>({
                    id:c.id,cash:CLUB_AI.cash(c.id),players:squad(c.id).length,
                    keepers:squad(c.id).filter(p=>p.posicion==='POR').length,
                    positions:Object.fromEntries(['DEF','MED','DEL'].map(pos=>[pos,squad(c.id).filter(p=>p.posicion===pos).length])),
                    registeredForeign:foreigners(c.id),foreignLimit:WORLD_ENGINE.foreignLimit(c.id)
                })),saveBytes:WORLD_STORAGE.inspect(GameState).localStorageBytes
            };
        }""")
        self.assertGreater(result['changed'], 0, 'Clubs should act during transfer windows')
        self.assertGreater(result['renewed'], 0, 'Important expiring contracts should be evaluated')
        self.assertTrue(result['idempotent'], 'Repeating the same day must not charge or transfer twice')
        self.assertEqual(result['own'], result['ownAfter'], 'AI cannot move or renew the user roster')
        self.assertEqual(result['ownBalance'], result['balanceAfter'], 'AI operations cannot spend user funds')
        for team in result['teams']:
            with self.subTest(club=team['id']):
                self.assertGreaterEqual(team['cash'], 0)
                self.assertGreaterEqual(team['players'], 18)
                self.assertLessEqual(team['players'], 32)
                self.assertGreaterEqual(team['keepers'], 2)
                self.assertTrue(all(total>=2 for total in team['positions'].values()))
                self.assertLessEqual(team['registeredForeign'], team['foreignLimit'])
        self.assertLess(result['saveBytes'], 5*1024*1024)

    def test_05_negotiated_installments_reserve_full_cost_and_settle_once(self):
        self.career()
        target = self.market_target()
        self.page.evaluate('(id)=>buy(id)', target['id'])
        self.page.locator('#negotiation [name="fee"]').fill('1000000')
        self.page.locator('#negotiation [name="wage"]').fill('2000')
        self.page.locator('#negotiation [name="bonus"]').fill('10000')
        self.page.locator('#negotiation [name="installments"]').select_option('3')
        self.page.locator('#negotiation [name="upfrontPercent"]').fill('25')
        self.page.locator('#negotiation [name="sellOnPercent"]').fill('20')
        self.page.locator('#negotiation [name="releaseClause"]').fill('3000000')
        self.page.locator('#negotiation button[type="submit"]').click()
        self.assertFalse(self.page.locator('#details').is_visible())
        pending = self.page.evaluate("""(id)=>({
            offer:GameState.offers.find(o=>o.playerId===id&&o.status==='pending'),
            available:CLUB_AI.availableBudget(GameState.userClub.id),cash:GameState.userClub.presupuesto_dolares,
            club:player(id).clubId
        })""", target['id'])
        self.assertIsNotNone(pending['offer'])
        self.assertEqual(pending['cash'], target['openingCash'])
        self.assertEqual(pending['available'], pending['cash']-1010000)
        self.assertEqual(pending['club'], target['owner'])
        self.assertEqual(pending['offer']['responseDate'], '2026-01-29')
        self.page.evaluate('CLUB_AI.processUserOffers()')
        self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).status', pending['offer']['id']), 'pending')
        accepted = self.page.evaluate("""(id)=>{
            const o=GameState.offers.find(o=>o.playerId===id);
            __qaProcessResponse(o);
            return {status:o.status,awaiting:o.awaitingUser||false,player:player(id),
                cash:GameState.userClub.presupuesto_dolares,ownerCash:CLUB_AI.cash(o.fromClub),
                available:CLUB_AI.availableBudget(GameState.userClub.id),acceptedDate:GameState.today,
                payments:GameState.world.ai.contracts.payments.filter(p=>p.offerId===o.id)};
        }""", target['id'])
        self.assertEqual(accepted['status'], 'accepted')
        self.assertFalse(accepted['awaiting'])
        self.assertEqual(accepted['player']['clubId'], target['user'])
        self.assertEqual(accepted['player']['salario'], 2000)
        self.assertEqual(accepted['player']['clausula_rescision'], 3000000)
        self.assertEqual(accepted['cash'], target['openingCash']-260000)
        self.assertEqual(accepted['ownerCash'], target['ownerCash']+250000)
        self.assertEqual(accepted['available'], accepted['cash']-750000)
        self.assertEqual(len(accepted['payments']), 3)
        self.assertEqual(sum(p['amount'] for p in accepted['payments']), 750000)
        expected_dates = [add_months(accepted['acceptedDate'], months) for months in [1, 2, 3]]
        self.assertEqual([p['dueDate'] for p in accepted['payments']], expected_dates)
        self.reload_state()
        final = self.page.evaluate("""({target,dueDate})=>{
            MARKET_CONTRACTS.settle(dueDate);
            const once={cash:GameState.userClub.presupuesto_dolares,ownerCash:CLUB_AI.cash(target.owner)};
            MARKET_CONTRACTS.settle(dueDate);CLUB_AI.processUserOffers();
            return {once,cash:GameState.userClub.presupuesto_dolares,ownerCash:CLUB_AI.cash(target.owner),
                payments:GameState.world.ai.contracts.payments,available:CLUB_AI.availableBudget(target.user),
                clause:player(target.id).sellOnClause};
        }""", {'target':target, 'dueDate':expected_dates[-1]})
        self.assertEqual(final['once']['cash'], final['cash'])
        self.assertEqual(final['once']['ownerCash'], final['ownerCash'])
        self.assertEqual(final['cash'], target['openingCash']-1010000)
        self.assertEqual(final['ownerCash'], target['ownerCash']+1000000)
        self.assertEqual(final['available'], final['cash'])
        self.assertTrue(all(p['status']=='paid' for p in final['payments']))
        self.assertEqual(final['clause'], {'beneficiaryClub':target['owner'],'ownerClub':target['user'],'percent':20})
        resale = self.page.evaluate("""(target)=>{
            const p=player(target.id),buyer=GameState.world.clubs.find(c=>c.country==='Inglaterra');
            if(!buyer)throw Error('Sin tercer club');
            if(squad(buyer.id).length>=32){const vacancy=squad(buyer.id).find(q=>CLUB_AI.canRelease(q,buyer.id).ok);vacancy.clubId=null;WORLD_ENGINE.reindex()}
            const before={seller:CLUB_AI.cash(target.user),beneficiary:CLUB_AI.cash(target.owner),buyer:CLUB_AI.cash(buyer.id)};
            const offer={playerId:p.id,type:'sell',dealType:'permanent',fromClub:target.user,toClub:buyer.id,fee:1500000,wage:2100,years:3,bonus:0,releaseClause:3500000};
            const first=MARKET_CONTRACTS.executeTransfer(offer),second=MARKET_CONTRACTS.executeTransfer(offer);
            return {before,first,second,seller:CLUB_AI.cash(target.user),beneficiary:CLUB_AI.cash(target.owner),
                buyer:CLUB_AI.cash(buyer.id),clause:player(p.id).sellOnClause||null,club:player(p.id).clubId,to:buyer.id};
        }""", target)
        self.assertTrue(resale['first']['ok'])
        self.assertFalse(resale['second']['ok'])
        self.assertEqual(resale['club'], resale['to'])
        self.assertEqual(resale['seller'], resale['before']['seller']+1200000)
        self.assertEqual(resale['beneficiary'], resale['before']['beneficiary']+300000)
        self.assertEqual(resale['buyer'], resale['before']['buyer']-1500000)
        self.assertIsNone(resale['clause'])

    def test_06_loan_salary_split_owner_reservation_and_return_survive_reload(self):
        self.career()
        target = self.market_target()
        self.page.evaluate('(id)=>buy(id)', target['id'])
        self.page.locator('#negotiation [name="dealType"]').select_option('loan')
        self.assertFalse(self.page.locator('#negotiation [name="sellOnPercent"]').is_visible())
        self.page.locator('#negotiation [name="fee"]').fill('100000')
        self.page.locator('#negotiation [name="loanMonths"]').select_option('6')
        self.page.locator('#negotiation [name="wageShare"]').fill('50')
        self.page.locator('#negotiation button[type="submit"]').click()
        result = self.page.evaluate("""(target)=>{
            const o=GameState.offers.find(o=>o.playerId===target.id);
            __qaProcessResponse(o);
            if(o.awaitingUser){MARKET_CONTRACTS.respondCounter(o.id,true);__qaProcessResponse(o)}
            const p=player(target.id),loan=GameState.world.ai.contracts.loans.find(l=>l.playerId===p.id&&l.status==='active');
            return {status:o.status,share:loan?.wageShare,loan,player:p,acceptedDate:GameState.today,
                ownPart:MARKET_CONTRACTS.loanWageFor(p,target.user),ownerPart:MARKET_CONTRACTS.loanWageFor(p,target.owner),
                ownerSlots:MARKET_CONTRACTS.returnSlots(target.owner),
                userWages:CLUB_AI.wageBill(target.user),ownerWages:CLUB_AI.wageBill(target.owner)};
        }""", target)
        self.assertEqual(result['status'], 'accepted')
        self.assertEqual(result['loan']['endDate'], add_months(result['acceptedDate'], 6))
        self.assertEqual(result['player']['clubId'], target['user'])
        self.assertEqual(result['player']['contract'], target['contract'])
        self.assertEqual(result['player']['salario'], target['wage'])
        self.assertEqual(result['ownPart']+result['ownerPart'], target['wage'])
        self.assertEqual(result['userWages'], target['userWages']+result['ownPart'])
        self.assertEqual(result['ownerWages'], target['ownerWages']-result['ownPart'])
        self.assertEqual(result['ownerSlots'], 1)
        self.reload_state()
        return_date = result['loan']['endDate']
        early_date = (date.fromisoformat(return_date) - timedelta(days=1)).isoformat()
        returned = self.page.evaluate("""({target,returnDate,earlyDate})=>{
            const p=player(target.id);MARKET_CONTRACTS.returnLoans(earlyDate);const early=p.clubId;
            MARKET_CONTRACTS.returnLoans(returnDate);const after=JSON.stringify(GameState.world.ai.contracts.loans);
            MARKET_CONTRACTS.returnLoans(returnDate);
            return {early,club:p.clubId,wage:p.salario,contract:p.contract,loanId:p.loanId||null,
                idempotent:after===JSON.stringify(GameState.world.ai.contracts.loans),
                ownPart:MARKET_CONTRACTS.loanWageFor(p,target.user),ownerPart:MARKET_CONTRACTS.loanWageFor(p,target.owner),
                ownerSlots:MARKET_CONTRACTS.returnSlots(target.owner),
                userWages:CLUB_AI.wageBill(target.user),ownerWages:CLUB_AI.wageBill(target.owner),
                xiOwned:GameState.tactics.xi.every(id=>player(id)?.clubId===target.user)};
        }""", {'target':target, 'returnDate':return_date, 'earlyDate':early_date})
        self.assertEqual(returned['early'], target['user'])
        self.assertEqual(returned['club'], target['owner'])
        self.assertEqual(returned['wage'], target['wage'])
        self.assertEqual(returned['contract'], target['contract'])
        self.assertIsNone(returned['loanId'])
        self.assertTrue(returned['idempotent'])
        self.assertTrue(returned['xiOwned'])
        self.assertEqual(returned['ownPart'], 0)
        self.assertEqual(returned['ownerPart'], target['wage'])
        self.assertEqual(returned['ownerSlots'], 0)
        self.assertEqual(returned['userWages'], target['userWages'])
        self.assertEqual(returned['ownerWages'], target['ownerWages'])

    def test_07_counteroffer_requires_decision_and_invalid_terms_do_not_commit(self):
        self.career()
        target = self.market_target()
        attempts = self.page.evaluate("""(target)=>{
            const baseline=JSON.stringify({cash:GameState.userClub.presupuesto_dolares,offers:GameState.offers,club:player(target.id).clubId});
            const terms={playerId:target.id,dealType:'permanent',fee:200000,wage:2000,years:3,bonus:0,releaseClause:300000};
            const bad=[{...terms,installments:4},{...terms,sellOnPercent:45},{...terms,upfrontPercent:10},
                {...terms,wage:-1},{...terms,wage:0},{...terms,fee:NaN},{...terms,years:7}]
                .map(row=>CLUB_AI.submitOffer(row));
            const intact=baseline===JSON.stringify({cash:GameState.userClub.presupuesto_dolares,offers:GameState.offers,club:player(target.id).clubId});
            const result=CLUB_AI.submitOffer({...terms,fee:0,wage:100,releaseClause:0});
            const offer=GameState.offers.find(o=>o.id===result.offer.id);
            __qaProcessResponse(offer);
            GameState.today='2026-02-04';CLUB_AI.onDayAdvance(GameState.today);
            FM_INBOX.ensure();const m=GameState.inbox.find(m=>m.offerId===offer.id);
            view='inbox';render();
            return {bad:bad.map(r=>r.ok),intact,id:offer.id,messageId:m.id,awaiting:offer.awaitingUser,
                counter:offer.counter,club:player(target.id).clubId,cash:GameState.userClub.presupuesto_dolares};
        }""", target)
        self.assertTrue(attempts['intact'])
        self.assertTrue(all(not ok for ok in attempts['bad']))
        self.assertTrue(attempts['awaiting'])
        self.assertEqual(attempts['club'], target['owner'])
        self.assertEqual(attempts['cash'], target['openingCash'])
        self.page.locator('[data-inbox-open="' + str(attempts['messageId']) + '"]').click()
        self.assertEqual(self.page.locator('[data-inbox-action="counter-accept"]').count(), 1)
        self.page.locator('[data-inbox-action="counter-accept"]').click()
        self.assertFalse(self.page.evaluate('(id)=>!!GameState.offers.find(o=>o.id===id).awaitingUser', attempts['id']))
        self.assertEqual(self.page.evaluate('(id)=>player(id).clubId', target['id']), target['owner'])
        finished = self.page.evaluate("""(info)=>{
            const o=GameState.offers.find(o=>o.id===info.id);
            __qaProcessResponse(o);
            const cash=GameState.userClub.presupuesto_dolares;
            const again=MARKET_CONTRACTS.respondCounter(o.id,true);
            return {status:o.status,fee:o.fee,wage:o.wage,cash,again,after:GameState.userClub.presupuesto_dolares,club:player(o.playerId).clubId};
        }""", attempts)
        self.assertEqual(finished['status'], 'accepted')
        self.assertEqual(finished['fee'], attempts['counter']['fee'])
        self.assertEqual(finished['wage'], attempts['counter']['wage'])
        self.assertEqual(finished['club'], target['user'])
        self.assertFalse(finished['again'])
        self.assertEqual(finished['cash'], finished['after'])
        self.assertEqual(finished['cash'], target['openingCash']-finished['fee'])

    def test_11_mobile_management_views_and_source_links_work_without_network(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.career()
        for target in ['inbox','tactics','squad','market','finances']:
            with self.subTest(view=target):
                self.nav(target)
                self.assert_no_overflow(390)
                self.page.screenshot(path=str(ARTIFACTS / ('mobile-' + target + '.png')), full_page=True)
        self.nav('squad')
        self.page.locator('#content [data-player]').first.click()
        self.assertEqual(self.page.evaluate('view'), 'player')
        for tab in ['summary','attributes','progress','stats','contract','sources']:
            with self.subTest(tab=tab):
                self.page.locator('[data-fp-tab="' + tab + '"]').click()
                self.assert_no_overflow(390)
        self.page.screenshot(path=str(ARTIFACTS / 'mobile-player-sources.png'), full_page=True)
        self.page.set_viewport_size({'width':1440,'height':960})
        self.page.locator('[data-fp-tab="attributes"]').click()
        self.assert_no_overflow()
        self.page.screenshot(path=str(ARTIFACTS / 'desktop-player-attributes.png'), full_page=True)
        self.page.locator('[data-fp-back]').click()
        self.nav('tactics')
        self.page.screenshot(path=str(ARTIFACTS / 'desktop-tactics.png'), full_page=True)
        # Initial optional CDN requests are blocked; navigating never fetches data.
        self.assertFalse(any('ceapi/' in request or 'transfermarkt' in request for request in self.external_requests))

    def test_13_manual_selection_survives_advancing_the_calendar(self):
        self.career()
        self.page.evaluate('__qaReachReady()')
        chosen = self.page.evaluate("""()=>{
            const t=GameState.tactics;
            const reserve=t.bench.map(player).find(p=>p.posicion!=='POR'&&t.xi.some(id=>player(id).posicion===p.posicion));
            const source=11+t.bench.indexOf(reserve.id),target=t.xi.findIndex(id=>player(id).posicion===reserve.posicion);
            if(!FM_TACTICS.swapSlots(source,target))throw Error('No se pudo preparar la variante');
            const lineup=[...t.xi,...t.bench];Math.random=()=>.5;
            completeEvent({home:1,away:0,pen:null,winner:fixture(currentEvent()).home});
            return{before:lineup,after:[...t.xi,...t.bench],played:GameState.annual[GameState.userClub.id].pj};
        }""")
        self.assertEqual(chosen['played'],1)
        self.assertEqual(chosen['after'],chosen['before'])

    def test_12_european_finances_and_reserved_funds_block_unaffordable_spending(self):
        self.career('GB1', None)
        self.nav('finances')
        self.assertIn('localidades', self.page.locator('#content').inner_text())
        self.assert_no_overflow()
        scenario = self.page.evaluate("""()=>{
            const own=mine()[0],foreign=GameState.players.find(p=>p.clubId!==GameState.userClub.id);
            const reserved=1500000;
            GameState.userClub.presupuesto_dolares=reserved+500;
            GameState.userClub.presupuesto_pesos=(reserved+500)*FX;
            GameState.offers.unshift({id:'qa-reserved-cash',playerId:foreign.id,fromClub:foreign.clubId,toClub:GameState.userClub.id,
                type:'buy',status:'pending',fee:reserved,wage:foreign.salario,bonus:0,years:3,dueAt:GameState.eventIndex+100});
            const before={cash:GameState.userClub.presupuesto_dolares,wageBudget:GameState.userClub.wageBudget,
                wage:own.salario,contract:own.contract,ledger:JSON.stringify(GameState.finance.ledger)};
            MANAGEMENT.scout(foreign.id);renew(own.id);actions.wageBudget();
            return {before,after:{cash:GameState.userClub.presupuesto_dolares,wageBudget:GameState.userClub.wageBudget,
                wage:own.salario,contract:own.contract,ledger:JSON.stringify(GameState.finance.ledger)},
                report:GameState.scouting.reports[foreign.id]||null,available:CLUB_AI.availableBudget(GameState.userClub.id)};
        }""")
        self.assertEqual(scenario['after'], scenario['before'])
        self.assertIsNone(scenario['report'])
        self.assertEqual(scenario['available'], 500)

    def test_10_complete_season_keeps_management_history_and_compact_save_bounded(self):
        self.career()
        result = self.page.evaluate("""()=>{
            let count=0;
            while(currentEvent()){
                __qaReachReady();
                if(!currentEvent())break;
                const g=fixture(currentEvent());
                WORLD_ENGINE.completeOne(g?{home:g.home===GameState.userClub.id?3:0,away:g.away===GameState.userClub.id?3:0}:null);
                if(++count>1000)throw Error('Temporada sin final');
            }
            FM_PLAYER.captureProgress();saveGame(true);
            return {finished:GameState.finished,bytes:WORLD_STORAGE.inspect(GameState).localStorageBytes,
                ai:structuredClone(GameState.world.ai),
                players:GameState.players.length,ownPlayers:mine().length,
                progressPlayers:Object.keys(GameState.world.playerProgress||{}).length,
                progressRecords:Object.values(GameState.world.playerProgress||{}).map(records=>records.length),
                history:GameState.history.length,inbox:GameState.inbox.length};
        }""")
        self.assertTrue(result['finished'])
        self.assertEqual(result['players'], 9220)
        self.assertLess(result['bytes'], 5*1024*1024)
        self.assertLessEqual(result['inbox'], 150)
        self.assertLessEqual(result['progressPlayers'], result['ownPlayers']+32)
        self.assertGreater(result['progressPlayers'], 0)
        self.assertTrue(all(1<=count<=24 for count in result['progressRecords']))
        self.assertGreater(result['history'], 0)
        self.reload_state()
        self.assertTrue(self.page.evaluate('GameState.finished'))
        self.assertEqual(self.page.evaluate('GameState.players.length'), 9220)
        self.assertLess(self.page.evaluate('WORLD_STORAGE.inspect(GameState).localStorageBytes'), 5*1024*1024)

    def test_09_previous_world_career_retains_played_economy_and_players(self):
        old_url = URL.replace('index.html', 'previous-management-world.html')
        self.page.route('**/previous-management-world.html',
                        lambda route: route.fulfill(content_type='text/html', body=self.previous_world))
        self.page.goto(old_url, wait_until='domcontentloaded')
        self.seed()
        self.page.fill('#manager', 'DT continuidad')
        self.page.select_option('#club', 'boca')
        self.page.click('[data-action="new"]')
        self.page.wait_for_function('GameState?.worldVersion===1')
        self.complete_user_match()
        self.page.evaluate("""()=>{
            MANAGEMENT.transaction(-23450,'Renovación previa','contratos');
            GameState.tactics.formation='4-4-2';autoLineup();
            const p=mine()[0];p.salario+=700;p.contract=2029;p.moral=63;
            GameState.training.intensity='Ligera';saveGame(true);
        }""")
        before = self.page.evaluate("""()=>({
            today:GameState.today,eventIndex:GameState.eventIndex,year:GameState.year,
            userClub:structuredClone(GameState.userClub),finance:structuredClone(GameState.finance),
            players:structuredClone(GameState.players),standings:structuredClone(GameState.standings),
            formation:GameState.tactics.formation,xi:[...GameState.tactics.xi],bench:[...GameState.tactics.bench],
            training:structuredClone(GameState.training),lastMatch:structuredClone(GameState.lastMatch)
        })""")
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.wait_for_selector('aside')
        after = self.page.evaluate("""()=>({
            today:GameState.today,eventIndex:GameState.eventIndex,year:GameState.year,
            userClub:structuredClone(GameState.userClub),finance:structuredClone(GameState.finance),
            players:structuredClone(GameState.players),standings:structuredClone(GameState.standings),
            formation:GameState.tactics.formation,xi:[...GameState.tactics.xi],bench:[...GameState.tactics.bench],
            training:structuredClone(GameState.training),lastMatch:structuredClone(GameState.lastMatch)
        })""")
        for field in ['today','eventIndex','year','finance','standings','formation','xi','bench','training','lastMatch']:
            self.assertEqual(after[field], before[field], field)
        for key, value in before['userClub'].items():
            self.assertEqual(after['userClub'][key], value, 'Existing club field ' + key)
        players_by_id = {p['id']: p for p in after['players']}
        self.assertEqual(len(players_by_id), len(before['players']))
        for previous in before['players']:
            restored = players_by_id[previous['id']]
            for key, value in previous.items():
                self.assertEqual(restored[key], value, str(previous['id']) + ':' + key)
        self.assertTrue(self.page.evaluate('!!window.CLUB_AI && !!window.FM_TACTICS'))
        self.assertGreater(self.page.evaluate('GameState.standings.boca.pj'), 0)
        self.assertLess(self.page.evaluate('WORLD_STORAGE.inspect(GameState).localStorageBytes'), 5*1024*1024)


if __name__ == '__main__':
    unittest.main(verbosity=2)
