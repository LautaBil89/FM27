#!/usr/bin/env python3
"""Exercise real country calendars and season transitions in an isolated browser.

This focused sporting stress run simulates the chosen country's divisions and
cups, plus continental rounds involving them. Other countries are retained for
save compatibility but their full domestic schedules are not simulated. User
match receipts are suppressed by the engine's background simulation option.
Financial settlement correctness is covered by separate functional tests.
"""
import argparse,json,os,shutil,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--years',type=int,default=5)
    parser.add_argument('--league',default='ARG1')
    parser.add_argument('--output',default='/tmp/fm27-long-career.json')
    args=parser.parse_args()
    if not 1<=args.years<=20:parser.error('--years must be between 1 and 20')
    result={'league':args.league,'yearsRequested':args.years,'mode':'focused-country-sporting','years':[],'pageErrors':[]}
    started=time.monotonic()
    with sync_playwright() as pw:
        executable=os.environ.get('FM27_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome')
        browser=pw.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}),args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(viewport={'width':1440,'height':960})
        page=context.new_page();page.set_default_timeout(120000)
        page.on('pageerror',lambda error:result['pageErrors'].append(str(error)))
        page.route('https://**/*',lambda route:route.abort())
        page.goto(os.environ.get('FM27_TEST_URL','http://127.0.0.1:8070/index.html'),wait_until='domcontentloaded')
        country=page.evaluate('(id)=>WORLD_DATABASE.leagues.find(l=>l.id===id)?.country',args.league)
        if not country:raise ValueError('Unknown league '+args.league)
        page.fill('#manager','DT simulación prolongada')
        page.select_option('#worldCareerCountry',label=country)
        page.select_option('#worldCareerLeague',args.league)
        if page.locator('#careerCompetitionFormat').count():page.select_option('#careerCompetitionFormat','realistic')
        page.click('[data-action="new"]')
        page.wait_for_function('GameState?.version===3')
        page.wait_for_function('!document.documentElement.classList.contains("career-library-busy")')
        page.evaluate("""()=>{window.longCareer={seen:[],games:0,events:0,lastMonth:null};window.longInitialIds=new Set(GameState.players.map(p=>p.id));WORLD_STORAGE.cancelPending();}
        """)
        for step in range(args.years):
            report=page.evaluate("""(leagueId)=>{
              const season=FM_SEASONS.leagueSeason(leagueId),year=season.year,country=WORLD_ENGINE.league(leagueId).country,ids=FM_SEASONS.pairedLeagues(leagueId),clubIds=new Set(GameState.world.clubs.filter(c=>c.country===country).map(c=>c.id));
              const selected=e=>e.type==='LPF'?ids.includes(e.leagueId):e.type==='CUP'?e.country===country||GameState.world.extraCompetitions?.cups?.[e.extraCupId]?.country===country:e.games.some(g=>clubIds.has(g.home)||clubIds.has(g.away));
              const currentYear=e=>e.type==='LPF'?(e.seasonYear??year)===year:e.extraCupId?(GameState.world.extraCompetitions?.cups?.[e.extraCupId]?.year??year)===year:Number(e.date.slice(0,4))===year;
              let iterations=0,done=0,stalled=0;
              while(iterations++<5000){
                const pending=GameState.calendar.filter(e=>!e.done&&selected(e)&&currentYear(e)).sort((a,b)=>a.date.localeCompare(b.date)||WORLD_CLOCK.eventSlot(a)-WORLD_CLOCK.eventSlot(b));
                if(!pending.length)break;
                const event=pending.find(e=>FM_SEASONS.eventReady(e)&&(!FM_EXTRA_CUPS.owns(e)||FM_EXTRA_CUPS.ready(e)));
                if(!event){stalled=pending.length;break;}
                GameState.today=event.date>GameState.today?event.date:GameState.today;WORLD_CLOCK.ensure().slot=3;GameState.finished=false;
                const month=GameState.today.slice(0,7);
                for(const p of GameState.players)FM_IDENTITY.update(p,GameState.today);
                if(longCareer.lastMonth!==month){FM_PRO.onDay(GameState.today);CLUB_AI.onDayAdvance(GameState.today);MARKET_CONTRACTS.progressContracts(GameState.today);FM_REGISTRATION.onDayAdvance(GameState.today);FM_GOVERNANCE.onDay(GameState.today);FM_EXTRA_CUPS.onDay(GameState.today);longCareer.lastMonth=month;}
                for(const id of clubIds)for(const p of squad(id)){FM_MEDICINE.recoverPlayer(p,GameState.today);if(!p.injury)p.condicion_fisica=Math.max(70,p.condicion_fisica);}
                const before=event.games.length,ok=WORLD_ENGINE.completeOne(null,event,{background:true});if(!ok){stalled=pending.length;break;}done++;longCareer.events++;longCareer.games+=before;
              }
              FM_SEASONS.checkCompletion();const closed=FM_SEASONS.registry().history.filter(h=>ids.includes(h.leagueId)&&h.year===year);
              const rosterErrors=[];for(const id of clubIds){const roster=squad(id);if(roster.length+(MARKET_CONTRACTS.returnSlots(id)||0)>40)rosterErrors.push(id+':'+roster.length);}
              const ageErrors=GameState.players.filter(p=>clubIds.has(p.clubId)&&p.edad!==FM_IDENTITY.age(p,GameState.today)).slice(0,5).map(p=>p.id);
              let serialized=false,saveError='',encodedBytes=0,compressedBytes=0,largestBlocks=[];try{WORLD_STORAGE.validate(GameState);const raw=WORLD_STORAGE.serialize(GameState);compressedBytes=raw.length*2;WORLD_STORAGE.decode(JSON.parse(raw));serialized=true;}catch(error){saveError=error.message;const payload=WORLD_STORAGE.encode(GameState);encodedBytes=JSON.stringify(payload).length*2;largestBlocks=Object.entries(payload.state.world).map(([key,value])=>[key,JSON.stringify(value)?.length*2||0]).sort((a,b)=>b[1]-a[1]).slice(0,10);}
              const output={year,day:GameState.today,events:done,expectedClosures:ids.length,closed:closed.map(h=>({league:h.leagueId,champion:h.champion,ranking:h.ranking.length})),stalled,rosterErrors,ageErrors,serialized,saveError,encodedBytes,compressedBytes,largestBlocks,players:GameState.players.length,gamesTotal:longCareer.games,generated:GameState.players.filter(p=>!longInitialIds.has(p.id)).length};
              if(!stalled&&closed.length===ids.length){GameState.finished=false;GameState.today=ids.map(id=>FM_SEASONS.leagueSeason(id).rolloverDate).sort().at(-1);for(const p of GameState.players)FM_IDENTITY.update(p,GameState.today);if(!FM_SEASONS.rollover(leagueId)){output.rolloverFailed=true;output.movements=ids.map(id=>FM_PYRAMIDS.movementSummary(id)).filter(Boolean);output.unfinished=GameState.calendar.filter(e=>ids.includes(e.leagueId)&&!e.done).map(e=>({id:e.id,type:e.type,phase:e.pyramidPhase,games:e.games.length}));}}
              return output;
            }""",args.league)
            persistence=page.evaluate('''async()=>{try{await FM_CAREERS.saveCurrent();const raw=localStorage.getItem(KEY),restored=WORLD_STORAGE.decode(JSON.parse(raw));const exported=WORLD_STORAGE.exportText(GameState),imported=WORLD_STORAGE.decode(JSON.parse(exported));return{persisted:restored.careerId===GameState.careerId&&restored.today===GameState.today&&imported.careerId===GameState.careerId&&imported.players.length===GameState.players.length,storedBytes:raw.length*2,exportBytes:new TextEncoder().encode(exported).length,exportFormat:JSON.parse(exported).format};}catch(error){const seen=new Set(),clubs=new Set(GameState.world.clubs.map(c=>c.id));return{persisted:false,persistenceError:error.message,invalidPlayers:GameState.players.filter(p=>{const bad=!Number.isSafeInteger(p.id)||p.id<1||seen.has(p.id)||typeof p.nombre!=='string'||!['POR','DEF','MED','DEL'].includes(p.posicion)||p.clubId!=null&&!clubs.has(p.clubId);seen.add(p.id);return bad}).slice(0,10).map(p=>({id:p.id,name:p.nombre,club:p.clubId,position:p.posicion})),clubs:GameState.world.clubs.length};}}''')
            report.update(persistence)
            result['years'].append(report)
            result['seconds']=round(time.monotonic()-started,2)
            Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
            print(json.dumps(report,ensure_ascii=False),flush=True)
            if report['stalled'] or len(report['closed'])!=report['expectedClosures'] or report['rosterErrors'] or report['ageErrors'] or not report['serialized'] or not report['persisted'] or report.get('rolloverFailed'):
                context.close();browser.close();return 1
        result['passed']=not result['pageErrors'] and len(result['years'])==args.years
        result['seconds']=round(time.monotonic()-started,2)
        Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        context.close();browser.close()
    return 0 if result['passed'] else 1

if __name__=='__main__':sys.exit(main())
