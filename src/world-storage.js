/* Compact local saves; exported backups retain the complete, hydrated career. */
const WORLD_STORAGE = (() => {
  const FORMAT = 'FM27-COMPACT', COMPRESSED_FORMAT = 'FM27-COMPACT-LZ', CODEC_VERSION = 1, MAX_IMPORT_BYTES = 50 * 1024 * 1024;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  const missing = Symbol('absent');
  const dbPlayers = new Map(WORLD_DATABASE.players.map(p => [p.playerId, p]));
  const dbClubs = new Map(WORLD_DATABASE.clubs.map(c => [c.id, c]));
  const dbLeagues = new Map(WORLD_DATABASE.leagues.map(l => [l.id, l]));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const same = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
  const copy = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw Error(message); };
  const string = (value, maximum = 150) => typeof value === 'string' && value.length > 0 && value.length <= maximum;
  const integer = (value, minimum = 0, maximum = 10000000) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  const finite = (value, minimum = 0, maximum = 1e13) => Number.isFinite(value) && value >= minimum && value <= maximum;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  const bytes = value => typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(value).length : unescape(encodeURIComponent(value)).length;

  function safeJSON(value, depth = 0) {
    if (depth > 40) fail('estructura demasiado profunda');
    if (typeof value === 'number' && !Number.isFinite(value)) fail('número no válido');
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value) && value.length > 100000) fail('lista demasiado grande');
    for (const key of Object.keys(value)) {
      if (forbidden.has(key)) fail('clave no permitida');
      safeJSON(value[key], depth + 1);
    }
  }

  function mask(indices, count) {
    const values = Array(Math.ceil(count / 6)).fill(0);
    for (const index of indices) values[Math.floor(index / 6)] |= 1 << (index % 6);
    while (values.length && !values[values.length - 1]) values.pop();
    return values.map(n => alphabet[n]).join('');
  }
  function bits(value, count) {
    if (typeof value !== 'string' || value.length > Math.ceil(count / 6)) fail('máscara de guardado no válida');
    const indices = [];
    for (let i = 0; i < value.length; i++) {
      const number = alphabet.indexOf(value[i]);
      if (number < 0) fail('máscara de guardado no válida');
      for (let j = 0; j < 6; j++) if (number & (1 << j)) {
        if (i * 6 + j >= count) fail('columna de guardado no válida');
        indices.push(i * 6 + j);
      }
    }
    return indices;
  }

  function playerReference(p) {
    const id = p.transfermarkt?.playerId ?? p.playerId;
    return p.realIdentity !== false && dbPlayers.has(id) ? id : null;
  }
  const identityTemplates = new Map();
  function identity(reference) {
    if (reference === null) return {};
    if(identityTemplates.has(reference))return identityTemplates.get(reference);
    const ref = dbPlayers.get(reference);
    if (!ref) fail('la base instalada no incluye un jugador de este guardado');
    const template=WORLD_ENGINE.hydratePlayerIdentity({}, ref);identityTemplates.set(reference,template);return template;
  }
  function residual(record, base, preserved) {
    const result = {};
    for (const key of Object.keys(record)) {
      if (record[key] === undefined) continue;
      if (preserved.has(key) || !own(base, key) || !same(record[key], base[key])) result[key] = record[key];
    }
    // An absent field must not reappear merely because it exists in the database template.
    const omitted = Object.keys(base).filter(key => !own(record, key));
    if (omitted.length) result._identityOmitted = omitted;
    return result;
  }

  function packRecords(records, referenceFor, templateFor, preserved = new Set()) {
    const references = records.map(referenceFor);
    const reduced = records.map((record, i) => residual(record, templateFor(references[i]), preserved));
    const keys = [...new Set(reduced.flatMap(record => Object.keys(record)))].sort();
    if (keys.length > 256) fail('demasiados campos en los registros');
    const defaults = [], absentDefaults = [];
    for (let i = 0; i < keys.length; i++) {
      const frequency = new Map();
      for (const record of reduced) {
        const value = own(record, keys[i]) ? record[keys[i]] : missing;
        const token = value === missing ? missing : JSON.stringify(value);
        const found = frequency.get(token);
        if (found) found.count++; else frequency.set(token, {value, count: 1});
      }
      let common = {value: missing, count: 0};
      for (const candidate of frequency.values()) if (candidate.count > common.count) common = candidate;
      if (common.value === missing) { defaults.push(null); absentDefaults.push(i); }
      else defaults.push(common.value);
    }
    const absentSet = new Set(absentDefaults);
    const rows = reduced.map((record, r) => {
      const changed = [], removed = [], values = [];
      for (let i = 0; i < keys.length; i++) {
        const exists = own(record, keys[i]);
        if (exists ? (!absentSet.has(i) && same(record[keys[i]], defaults[i])) : absentSet.has(i)) continue;
        changed.push(i);
        if (exists) values.push(record[keys[i]]); else removed.push(i);
      }
      return [references[r], mask(changed, keys.length), mask(removed, keys.length), ...values];
    });
    return {keys, defaults, absent: mask(absentDefaults, keys.length), rows};
  }

  function unpackRecords(packed, templateFor, maximum) {
    if (!object(packed) || !Array.isArray(packed.keys) || packed.keys.length > 256 || !Array.isArray(packed.defaults) || packed.defaults.length !== packed.keys.length || !Array.isArray(packed.rows) || packed.rows.length > maximum) fail('registros compactos no válidos');
    const keys = packed.keys;
    if (keys.some(key => !string(key, 100) || forbidden.has(key)) || new Set(keys).size !== keys.length) fail('campos compactos no válidos');
    const absent = new Set(bits(packed.absent, keys.length));
    return packed.rows.map(row => {
      if (!Array.isArray(row) || row.length < 3 || row.length > keys.length + 3) fail('fila compacta no válida');
      const changed = bits(row[1], keys.length), removed = new Set(bits(row[2], keys.length));
      if ([...removed].some(i => !changed.includes(i)) || row.length !== 3 + changed.length - removed.size) fail('datos compactos incompletos');
      const result = copy(templateFor(row[0]));
      for (let i = 0; i < keys.length; i++) if (!absent.has(i)) result[keys[i]] = copy(packed.defaults[i]);
      let at = 3;
      for (const index of changed) {
        if (removed.has(index)) delete result[keys[index]];
        else result[keys[index]] = row[at++];
      }
      if (own(result, '_identityOmitted')) {
        if (!Array.isArray(result._identityOmitted) || result._identityOmitted.some(key => !string(key, 100) || forbidden.has(key))) fail('identidad compacta no válida');
        for (const key of result._identityOmitted) delete result[key];
        delete result._identityOmitted;
      }
      return result;
    });
  }

  function table(table, clubs) {
    if (!object(table) || Object.keys(table).length !== clubs.length) fail('tabla de posiciones incompleta');
    for (const id of clubs) {
      const row = table[id];
      if (!object(row) || row.id !== id || !['pj', 'g', 'e', 'p', 'gf', 'gc', 'pts'].every(key => integer(row[key])) || row.pj !== row.g + row.e + row.p || row.pts !== row.g * 3 + row.e) fail('tabla de posiciones no válida');
    }
  }
  function result(score, home, away, clubs) {
    if (score == null) return;
    if (!object(score) || !integer(score.home, 0, 100) || !integer(score.away, 0, 100) || (score.winner != null && (!clubs.has(score.winner) || ![home, away].includes(score.winner)))) fail('resultado no válido');
    if (score.pen != null && (!object(score.pen) || !integer(score.pen.home, 0, 100) || !integer(score.pen.away, 0, 100))) fail('penales no válidos');
  }
  function cupNodes(value, clubs, depth = 0) {
    if (depth > 20) fail('cuadro continental demasiado profundo');
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const child of value) cupNodes(child, clubs, depth + 1); return; }
    if (own(value, 'home') && own(value, 'away') && typeof value.home !== 'number') {
      if (!clubs.has(value.home) || !clubs.has(value.away) || value.home === value.away) fail('cruce continental no válido');
      result(value.result, value.home, value.away, clubs);
      if (value.winner != null && ![value.home, value.away].includes(value.winner)) fail('ganador continental no válido');
    }
    if (Array.isArray(value.teams) && (value.teams.some(id => !clubs.has(id)) || new Set(value.teams).size !== value.teams.length)) fail('grupo continental no válido');
    if (own(value, 'winner') && value.winner != null && !clubs.has(value.winner)) fail('campeón continental no válido');
    for (const child of Object.values(value)) cupNodes(child, clubs, depth + 1);
  }

  function validateIncidents(value,clubs){
    if(value==null)return;
    const known=new Set(['boots','school','bus','meal','birthday','rain','interview','family','grass','supporters','sponsor','power','oldboys','lostkit','community','film','collector','music','scientists','reunion','goat','cat','mascot','replica','balloon']),seen=new Set(),pendingClubs=new Set();let highest=0;
    if(!object(value)||!integer(value.nextId,1,1e9)||!Array.isArray(value.history)||value.history.length>100||!object(value.cooldowns)||!object(value.lastEvents)||(value.lastDay!=null&&!validDate(value.lastDay))||(value.lastClub!=null&&!clubs.has(value.lastClub)))fail('registro de situaciones inesperadas no válido');
    if(Object.keys(value.cooldowns).length>30000||Object.values(value.cooldowns).some(d=>!validDate(d))||Object.entries(value.lastEvents).some(([id,d])=>!clubs.has(id)||!validDate(d)))fail('fechas de situaciones inesperadas no válidas');
    for(const e of value.history){
      if(!object(e)||!string(e.id,100)||!/^unexpected-[1-9]\d*$/.test(e.id)||seen.has(e.id)||!known.has(e.definitionId)||!clubs.has(e.clubId)||!validDate(e.date)||!validDate(e.deadline)||e.deadline<e.date||!finite(e.unit,0,1000000)||!['pending','resolved','expired','cancelled'].includes(e.status)||(e.choice!=null&&!['a','b'].includes(e.choice))||(e.resolvedDate!=null&&!validDate(e.resolvedDate)))fail('situación inesperada desconocida o no válida');
      seen.add(e.id);highest=Math.max(highest,Number(e.id.slice(11)));if(e.status==='pending'){if(pendingClubs.has(e.clubId))fail('situaciones pendientes duplicadas');pendingClubs.add(e.clubId);}
      if(e.context!=null&&(!object(e.context)||(e.context.playerId!=null&&!integer(e.context.playerId,1,Number.MAX_SAFE_INTEGER))||(e.context.playerName!=null&&(typeof e.context.playerName!=='string'||e.context.playerName.length>150))||(e.context.fixtureDate!=null&&!validDate(e.context.fixtureDate))))fail('contexto de situación inesperada no válido');
      const f=e.followup;if(f!=null&&(!object(f)||!validDate(f.dueDate)||!['scheduled','applied','cancelled'].includes(f.status)||!['player','squad'].includes(f.scope)||!object(f.effect)||Object.entries(f.effect).some(([key,n])=>!['morale','condition','pressure','reputation'].includes(key)||!finite(n,-100,100))||(f.appliedDate!=null&&!validDate(f.appliedDate))))fail('seguimiento de situación inesperada no válido');
    }
    if(value.nextId<=highest)fail('secuencia de situaciones inesperadas no válida');
  }
  function validateArchive(value,clubs){
    if(value==null)return;
    if(!object(value)||value.version!==1||!Array.isArray(value.reports)||value.reports.length>120)fail('archivo de partidos no válido');
    const seen=new Set();for(const r of value.reports){
      if(!object(r)||!string(r.fixtureId,200)||seen.has(r.fixtureId)||!validDate(r.date)||!clubs.has(r.home)||!clubs.has(r.away)||r.home===r.away||!object(r.result)||!string(r.competition,250)||!Array.isArray(r.stats)||r.stats.length!==2||r.stats.some(row=>!object(row)||Object.values(row).some(n=>typeof n==='number'&&!finite(n,0,100000)))||!Array.isArray(r.players)||r.players.length>60)fail('informe archivado no válido');
      seen.add(r.fixtureId);result(r.result,r.home,r.away,clubs);
      const players=new Set();for(const p of r.players){if(!object(p)||!integer(p.id,1,Number.MAX_SAFE_INTEGER)||players.has(p.id)||!string(p.name,150)||![0,1].includes(p.side)||!finite(p.rating,0,10)||!finite(p.minutes,0,200)||['goals','assists','shots','yellow'].some(k=>p[k]!=null&&!finite(p[k],0,1000)))fail('rendimiento individual archivado no válido');players.add(p.id);}
      if(!Array.isArray(r.feed)||r.feed.length>400||r.feed.some(f=>!object(f)||!finite(f.minute,0,200)||typeof f.text!=='string'||f.text.length>6000))fail('relato archivado no válido');
      if(r.abandoned!=null&&(!object(r.abandoned)||![0,1].includes(r.abandoned.side)||!string(r.abandoned.reason,6000)||!Array.isArray(r.abandoned.playedScore)||r.abandoned.playedScore.length!==2||r.abandoned.playedScore.some(n=>!integer(n,0,100))))fail('abandono archivado no válido');
      if(r.shootout!=null&&(!Array.isArray(r.shootout)||r.shootout.length>300||r.shootout.some(k=>!object(k)||![0,1].includes(k.side)||!integer(k.playerId,1,Number.MAX_SAFE_INTEGER)||typeof k.scored!=='boolean'||(k.keeperId!=null&&!integer(k.keeperId,1,Number.MAX_SAFE_INTEGER)))))fail('tanda archivada no válida');
      for(const [key,max]of [['lineups',2],['plans',2],['finalPlans',2],['decisions',60],['aiDecisions',12],['chances',100],['keyPlays',60],['chains',60],['teamMetrics',2]])if(r[key]!=null&&(!Array.isArray(r[key])||r[key].length>max))fail('detalle de informe archivado no válido');
    }
  }
  function validateSearches(value,clubs){
    if(value==null)return;
    if(!object(value)||Object.keys(value).length>1200)fail('búsquedas guardadas no válidas');
    for(const [id,scopes]of Object.entries(value)){if(!clubs.has(id)||!object(scopes))fail('club de búsqueda guardada no válido');for(const [scope,rows]of Object.entries(scopes)){
      if(!['market','scouting'].includes(scope)||!Array.isArray(rows)||rows.length>20)fail('lista de búsquedas guardadas no válida');const seen=new Set();
      for(const row of rows){if(!object(row)||!string(row.id,150)||seen.has(row.id)||!string(row.name,60)||typeof row.query!=='string'||row.query.length>120||!object(row.filters))fail('búsqueda guardada no válida');seen.add(row.id);const f=row.filters;
        if(f.positions!=null&&(!Array.isArray(f.positions)||f.positions.length>10||f.positions.some(p=>!['POR','DFC','LI','LD','MCD','MC','MP','EI','ED','DC'].includes(p))))fail('puestos de búsqueda guardada no válidos');
        if(f.rules!=null&&(!Array.isArray(f.rules)||f.rules.length>36||f.rules.some(r=>!object(r)||typeof r.attribute!=='string')))fail('atributos de búsqueda guardada no válidos');
        if(f.groups!=null&&(!Array.isArray(f.groups)||f.groups.length>6||f.groups.some(g=>!object(g)||!['all','any'].includes(g.mode)||!Array.isArray(g.rules)||g.rules.length>12||g.rules.some(r=>!object(r)||typeof r.field!=='string'||!['eq','neq','contains','gte','lte'].includes(r.op)||typeof r.value!=='string'||r.value.length>120))))fail('grupos de búsqueda guardada no válidos');
      }
    }}
  }

  function validatePurchaseClaims(value,clubs){
    if(value==null)return;
    if(!Array.isArray(value)||value.length>10000)fail('reclamaciones de compra no válidas');
    const seen=new Set();
    for(const claim of value){
      if(!object(claim)||!string(claim.id,200)||!string(claim.loanId,150)||claim.id!=='claim-'+claim.loanId||seen.has(claim.id)||!integer(claim.playerId,1,Number.MAX_SAFE_INTEGER)||!clubs.has(claim.fromClub)||!clubs.has(claim.toClub)||claim.fromClub===claim.toClub||!finite(claim.amount,0,1e10)||!['pending','settled'].includes(claim.status)||!validDate(claim.date)||!string(claim.reason,6000))fail('reclamación de compra no válida');
      seen.add(claim.id);
      if(claim.status==='settled'&&(!validDate(claim.settledDate)||claim.settledDate<claim.date||!finite(claim.compensation,0,claim.amount)||claim.settlementMode!=='simulated-mutual-agreement'))fail('liquidación de reclamación de compra no válida');
      if(claim.status==='pending'&&(claim.settledDate!=null||claim.compensation!=null||claim.settlementMode!=null))fail('reclamación pendiente con liquidación incompatible');
    }
  }

  function validateExtraCompetitions(value,clubs,events,today){
    if(value==null)return false;
    if(!object(value)||value.version!==1||!object(value.cups)||Object.keys(value.cups).length>300||!object(value.preliminaries)||Object.keys(value.preliminaries).length>300)fail('copas adicionales no válidas');
    for(const [id,cup]of Object.entries(value.cups)){
      if(!object(cup)||cup.id!==id||!['UCL','UEL','UEC','CUP','LIB_PRE','SUD_PRE'].includes(cup.type)||!integer(cup.year,2020,2300)||!string(cup.name,200)||!Array.isArray(cup.participants)||cup.participants.length<2||cup.participants.length>256||cup.participants.some(id=>!clubs.has(id))||new Set(cup.participants).size!==cup.participants.length||!Array.isArray(cup.stages)||cup.stages.length>20||!Array.isArray(cup.eventIds)||cup.eventIds.length>100||cup.eventIds.some(id=>!string(id,150))||!['league','knockout','completed'].includes(cup.status))fail('competición adicional no válida');
      cupNodes(cup,clubs);if(cup.table!=null)table(cup.table,cup.participants);
      for(const stage of cup.stages){if(!object(stage)||!Array.isArray(stage.ties)||stage.ties.length>128)fail('fase adicional no válida');for(const tie of stage.ties){if(!object(tie)||!cup.participants.includes(tie.home)||!cup.participants.includes(tie.away)||!Array.isArray(tie.legs)||!tie.legs.length||tie.legs.length>2||tie.legs.some(l=>!object(l)||!string(l.eventId,150)||!validDate(l.date)))fail('eliminatoria adicional no válida');}}
    }
    for(const e of events)if(e.extraCupId!=null&&(!value.cups[e.extraCupId]||value.cups[e.extraCupId].type!==e.type||!value.cups[e.extraCupId].eventIds.includes(e.id)||e.games.some(g=>!value.cups[e.extraCupId].participants.includes(g.home)||!value.cups[e.extraCupId].participants.includes(g.away))))fail('referencia de copa adicional no válida');
    for(const [year,p]of Object.entries(value.preliminaries)){
      if(!object(p)||!integer(p.year,2020,2300)||String(p.year)!==year||!['pending','resolved'].includes(p.status)||!object(p.rankings))fail('clasificación preliminar no válida');
      for(const [key,count]of [['direct',28],['phase1',6],['phase2',13],['sudDirect',12],['sudNational',32],['libQualified',32],['sudQualified',28],['libLosers',4]])if(p[key]!=null&&(!Array.isArray(p[key])||p[key].length!==count||p[key].some(id=>!clubs.has(id))||new Set(p[key]).size!==p[key].length))fail('participantes preliminares no válidos');
      if(Object.values(p.rankings).some(ids=>!Array.isArray(ids)||ids.length>100||ids.some(id=>!clubs.has(id))||new Set(ids).size!==ids.length))fail('ranking preliminar no válido');
    }
    const p=value.preliminaries[Number(today.slice(0,4))];if(p?.status!=='pending')return false;
    const lib=value.cups[`LIB_PRE:${p.year}`],sud=value.cups[`SUD_PRE:${p.year}`];
    return !!lib&&lib.type==='LIB_PRE'&&lib.participants.length===47&&!!sud&&sud.type==='SUD_PRE'&&sud.participants.length===44&&['direct','phase1','phase2','sudDirect','sudNational'].every(k=>Array.isArray(p[k]))&&[lib,sud].every(c=>c.eventIds.some(id=>events.some(e=>e.id===id&&e.extraCupId===c.id)));
  }

  function validateSubsystems(s,clubs,ids){
    const optionalObject=(v,label)=>{if(v!=null&&!object(v))fail(label+' no válido');};
    const arr=(v,label,max=40000)=>{if(!Array.isArray(v)||v.length>max)fail(label+' no válido');};
    const idList=(v,label)=>{arr(v,label);if(v.some(id=>!integer(id,1,Number.MAX_SAFE_INTEGER))||new Set(v).size!==v.length)fail(label+' no válido');};
    const r=s.world.registration;if(r!=null){if(!object(r)||!object(r.clubs))fail('inscripciones no válidas');optionalObject(r.internationalIntakes,'altas internacionales');for(const [id,c]of Object.entries(r.clubs)){if(!clubs.has(id)||!object(c)||!object(c.continental))fail('registro de club no válido');idList(c.domestic,'lista doméstica');for(const rows of Object.values(c.continental))idList(rows,'lista continental');}for(const rows of Object.values(r.internationalIntakes||{}))idList(rows,'altas internacionales');}
    const office=s.world.office;if(office!=null){if(!object(office)||!object(office.clubs)||!object(office.profile)||!object(office.profile.stats))fail('oficina no válida');for(const n of Object.values(office.profile.stats))if(!finite(n,1,20))fail('atributo del DT no válido');for(const [id,c]of Object.entries(office.clubs)){if(!clubs.has(id)||!object(c)||!object(c.responsibilities)||!object(c.assignment))fail('delegación de empleados no válida');arr(c.staff,'empleados',100);idList(c.loanListed,'lista de préstamos');const staffIds=new Set();for(const e of c.staff){if(!object(e)||!string(e.id,150)||staffIds.has(e.id)||!string(e.name,150)||!string(e.role,100)||!finite(e.salary,0,1e8)||!finite(e.ability,0,99))fail('empleado no válido');staffIds.add(e.id);if(e.employment!=null&&(!object(e.employment)||!validDate(e.employment.start)||!validDate(e.employment.end)))fail('contrato de empleado no válido');}}}
    for(const p of s.players){if(p.edad!=null&&!integer(p.edad,0,120))fail('edad no válida');if(p.birthYear!=null&&!integer(p.birthYear,1900,2300))fail('año de nacimiento no válido');if(p.dateOfBirth!=null&&!validDate(p.dateOfBirth))fail('nacimiento simulado no válido');if(p.trainingHistory!=null){arr(p.trainingHistory,'historial de formación',200);for(const h of p.trainingHistory)if(!object(h)||!string(h.clubId,100)||!finite(h.months,0,1200)||!finite(h.beforeAge,0,120)||(h.from!=null&&!validDate(h.from))||(h.to!=null&&!validDate(h.to)))fail('formación no válida');}}
    const d=s.world.development;if(d!=null){if(!object(d)||!object(d.clubs))fail('desarrollo no válido');for(const [id,c]of Object.entries(d.clubs)){if(!clubs.has(id)||!object(c)||!object(c.plans))fail('plan de desarrollo no válido');arr(c.academy,'academia',200);optionalObject(c.policy,'política de desarrollo');for(const p of c.academy)if(!object(p)||!integer(p.id,1,Number.MAX_SAFE_INTEGER)||!string(p.nombre,150))fail('juvenil no válido');}}
    const m=s.world.medicine;if(m!=null){if(!object(m)||!object(m.players))fail('medicina no válida');for(const r of Object.values(m.players)){if(!object(r))fail('ficha médica no válida');if(r.history!=null){arr(r.history,'historial médico',500);for(const h of r.history)if(!object(h)||!validDate(h.date)||!string(h.group,60)||!finite(h.days,0,10000))fail('antecedente médico no válido');}if(r.work!=null){arr(r.work,'carga médica',1000);for(const w of r.work)if(!object(w)||!string(w.id,300)||!validDate(w.date)||!finite(w.load,0,100000)||!finite(w.minutes,0,130)||!finite(w.distance,0,100000))fail('carga médica no válida');}if(r.injury!=null&&(!object(r.injury)||!finite(r.injury.remaining,0,10000)||!finite(r.injury.days,0,10000)))fail('lesión no válida');if(r.restUntil!=null&&!validDate(r.restUntil))fail('descanso médico no válido');}}
    const g=s.world.governance;if(g!=null){if(!object(g)||!object(g.clubs))fail('empleados no válidos');for(const k of ['jobs','applications','managerContracts'])if(g[k]!=null)arr(g[k],k,5000);for(const [id,c]of Object.entries(g.clubs)){if(!clubs.has(id)||!object(c))fail('administración de club no válida');optionalObject(c.policy,'delegación');for(const k of ['staffNegotiations','staffHistory','delegated'])if(c[k]!=null)arr(c[k],k,5000);}if(g.activeContract!=null&&(!object(g.activeContract)||!clubs.has(g.activeContract.clubId)||!finite(g.activeContract.salary,0,1e7)||!validDate(g.activeContract.start)||!validDate(g.activeContract.end)))fail('contrato de DT no válido');}
    const f=s.world.financialAccounts;if(f!=null){if(!object(f)||!object(f.clubs))fail('cuentas financieras no válidas');for(const [id,b]of Object.entries(f.clubs)){if(!clubs.has(id)||!object(b)||!object(b.assets)||!object(b.board)||!Array.isArray(b.loans)||!finite(b.board.authorized,0,1e13)||!finite(b.board.spent,0,1e13))fail('cuenta de club no válida');for(const k of ['loans','ledger','statements'])if(b[k]!=null)arr(b[k],k,20000);for(const k of ['periods','assets','board'])optionalObject(b[k],k);for(const loan of b.loans||[])if(!object(loan)||!finite(loan.remaining,0,1e13)||(loan.payments!=null&&!Array.isArray(loan.payments)))fail('crédito no válido');}}
    for(const p of s.players){if(p.careerStats!=null){arr(p.careerStats,'estadísticas históricas',1000);for(const r of p.careerStats)if(!Array.isArray(r)||r.length!==10||!string(r[0],30)||!clubs.has(r[1])||!string(r[2],180)||r.slice(3,9).some(n=>!integer(n,0,1e9))||!finite(r[9],0,1e10))fail('fila estadística no válida');}if(p.internationalStats!=null&&(!object(p.internationalStats)||!integer(p.internationalStats.caps,0,10000)||!integer(p.internationalStats.minutes,0,1e7)||!Array.isArray(p.internationalStats.titles)))fail('trayectoria internacional no válida');if(p.nationalDuty!=null&&(!object(p.nationalDuty)||!string(p.nationalDuty.country,80)||!validDate(p.nationalDuty.from)||!validDate(p.nationalDuty.until)||p.nationalDuty.until<p.nationalDuty.from))fail('convocatoria no válida');}
    const market=s.world.marketDepth;if(market!=null){if(!object(market)||!object(market.agencies))fail('representación no válida');arr(market.conditions,'cláusulas',20000);arr(market.trials,'pruebas',20000);for(const a of Object.values(market.agencies)){if(!object(a)||!string(a.name,120)||!finite(a.relationship,0,100)||!finite(a.feeWeeks,0,52)||!Array.isArray(a.history))fail('agencia no válida');}for(const c of market.conditions)if(!object(c)||!['appearances','qualification','buyback'].includes(c.kind)||!finite(c.amount,0,1e10)||!clubs.has(c.payer)||!validDate(c.start)||!validDate(c.expires))fail('cláusula contingente no válida');for(const t of market.trials)if(!object(t)||!clubs.has(t.clubId)||!integer(t.playerId,1,Number.MAX_SAFE_INTEGER)||!validDate(t.start)||!validDate(t.end))fail('prueba de jugador no válida');}
    const long=s.world.longTerm;if(long!=null){if(!object(long)||!object(long.clubs))fail('plan institucional no válido');for(const k of ['promises','projects','press'])arr(long[k],k,20000);for(const [id,c]of Object.entries(long.clubs))if(!clubs.has(id)||!object(c)||!['develop','balance','win'].includes(c.policy)||!Array.isArray(c.tasks)||!Array.isArray(c.history))fail('plan de club no válido');for(const p of long.projects)if(!object(p)||!clubs.has(p.clubId)||!['stadium','academy','medical','scouting'].includes(p.kind)||!validDate(p.start)||!validDate(p.due)||!finite(p.cost,0,1e12))fail('obra no válida');for(const p of long.promises)if(!object(p)||!clubs.has(p.clubId)||!validDate(p.due)||!['minutes','sale','continental'].includes(p.kind)||!finite(p.target,0,5000))fail('promesa no válida');for(const p of long.press)if(!object(p)||!string(p.question,2000)||!validDate(p.date)||!validDate(p.due))fail('conferencia no válida');}
    const programmes=s.world.programmes;if(programmes!=null){if(!object(programmes)||!object(programmes.clubs))fail('programas no válidos');for(const [id,c]of Object.entries(programmes.clubs)){if(!clubs.has(id)||!object(c)||!object(c.routes)||!object(c.training)||typeof c.training.enabled!=='boolean'||!finite(c.training.load,.5,1.5)||!Array.isArray(c.training.applied)||!Array.isArray(c.training.history)||!Array.isArray(c.training.week)||c.training.week.length!==7||c.training.week.some(d=>!object(d)||!['recovery','possession','finishing','defending','setpieces','matchprep','strength'].includes(d.am)||!['recovery','possession','finishing','defending','setpieces','matchprep','strength'].includes(d.pm)))fail('microciclo no válido');for(const r of Object.values(c.routes))if(!object(r)||!validDate(r.start)||!validDate(r.arrives)||!validDate(r.end)||!finite(r.weekly,0,1e8))fail('ruta de ojeo no válida');}}
    const nationals=s.world.nationals;if(nationals!=null){if(!object(nationals)||!object(nationals.windows)||!Array.isArray(nationals.history))fail('selecciones no válidas');for(const e of Object.values(nationals.windows)){if(!object(e)||!Array.isArray(e.teams)||!object(e.rosters)||!Array.isArray(e.fixtures)||!object(e.tables)||!validDate(e.start)||!validDate(e.end))fail('ventana internacional no válida');for(const g of e.fixtures)if(!object(g)||!validDate(g.date)||!e.teams.includes(g.home)||!e.teams.includes(g.away)||g.home===g.away||(g.result!=null&&(!object(g.result)||!integer(g.result.home,0,100)||!integer(g.result.away,0,100))))fail('partido internacional no válido');}}
    const analysis=s.world.analysisDepth;if(analysis!=null){if(!object(analysis)||!object(analysis.clubs)||!object(analysis.routines))fail('análisis táctico no válido');for(const rows of Object.values(analysis.routines)){arr(rows,'variantes',12);for(const r of rows)if(!object(r)||!string(r.name,60)||!object(r.plan))fail('variante no válida');}}
  }

  function validateWorld(s, aliases = true) {
    if (!object(s) || s.version !== 3 || s.worldVersion !== 1 || !object(s.world) || !Array.isArray(s.world.clubs) || !Array.isArray(s.world.leagues) || !Array.isArray(s.players) || !Array.isArray(s.calendar) || !object(s.userClub) || !object(s.tactics) || !object(s.world.cups)) fail('estructura de carrera mundial incompatible');
    if (!string(s.manager, 100) || !integer(s.year, 2020, 2300) || !validDate(s.today) || !integer(s.eventIndex, 0, s.calendar.length) || !finite(s.userClub.presupuesto_dolares, -1e13) || !finite(s.userClub.presupuesto_pesos, -1e16, 1e16)) fail('datos de carrera no válidos');
    if(own(s,'careerId')&&s.careerId!=null&&(!string(s.careerId,110)||!/^career-[a-zA-Z0-9-]{8,100}$/.test(s.careerId)))fail('identificador de carrera no válido');
    if(own(s,'careerName')&&!string(s.careerName,80))fail('nombre de carrera no válido');
    if (own(s.world, 'clock')) {
      const clock=s.world.clock;
      if (!object(clock) || clock.version!==1 || !integer(clock.slot,0,3) || !integer(clock.ticks,0,1e9) || !validDate(clock.lastProcessedDay) || (clock.lastTrainingDate!==null&&!validDate(clock.lastTrainingDate)) || (clock.lastMatchNotice!==null&&!string(clock.lastMatchNotice,150)) || !Array.isArray(clock.recent) || clock.recent.length>32) fail('reloj de carrera no válido');
      for (const entry of clock.recent) if (!object(entry) || !validDate(entry.date) || !integer(entry.slot,0,3) || !string(entry.title,200) || !string(entry.body,3000)) fail('actividad diaria no válida');
    }
    if (['confianza_directiva', 'presion_hinchada', 'reputacion'].some(key => own(s.userClub, key) && !finite(s.userClub[key], 0, 100)) || (own(s.userClub, 'wageBudget') && !finite(s.userClub.wageBudget)) || (own(s.userClub, 'ticketPrice') && !finite(s.userClub.ticketPrice, 0, 10000))) fail('economía o directiva no válida');
    if (s.players.length > 40000 || s.world.clubs.length > 1200 || !s.world.clubs.length || s.world.leagues.length > 100 || !s.world.leagues.length || s.calendar.length > 12000) fail('tamaño de carrera no válido');
    const clubs = new Set(), leagues = new Map(), membership = new Set();
    for (const c of s.world.clubs) {
      if (!object(c) || !string(c.id, 100) || clubs.has(c.id) || !string(c.nombre, 150) || !string(c.leagueId, 30)) fail('club no válido o duplicado');
      clubs.add(c.id);
    }
    for (const l of s.world.leagues) {
      if (!object(l) || !string(l.id, 30) || leagues.has(l.id) || !Array.isArray(l.clubIds) || l.clubIds.length < 2 || l.clubIds.length > 100 || l.clubIds.some(id => !clubs.has(id) || membership.has(id)) || new Set(l.clubIds).size !== l.clubIds.length) fail('liga no válida o duplicada');
      for (const id of l.clubIds) membership.add(id);
      leagues.set(l.id, l); table(l.standings, l.clubIds);
    }
    const guests=s.world.clubs.filter(c=>c.external===true&&c.leagueId==='UEFA_GUESTS');
    if (membership.size !== clubs.size-guests.length || s.world.clubs.some(c => !(c.external===true&&c.leagueId==='UEFA_GUESTS')&&!leagues.get(c.leagueId)?.clubIds.includes(c.id)) || guests.some(c=>membership.has(c.id))) fail('pertenencia de clubes no válida');
    const userLeague = leagues.get(s.world.userLeagueId);
    if (!userLeague || !userLeague.clubIds.includes(s.userClub.id)) fail('club del entrenador no válido');
    if (Array.isArray(s.external)) for (const c of s.external) {
      if (!object(c) || !string(c.id, 100) || clubs.has(c.id)) fail('club externo no válido o duplicado');
      clubs.add(c.id);
    }
    const ids = new Set(), referenceIds = new Set();
    for (const p of s.players) {
      if (!object(p) || !integer(p.id, 1, Number.MAX_SAFE_INTEGER) || ids.has(p.id) || !string(p.nombre, 150) || !['POR', 'DEF', 'MED', 'DEL'].includes(p.posicion) || (p.clubId != null && !clubs.has(p.clubId))) fail('jugador no válido o duplicado');
      if (!['ritmo', 'tiro', 'pase', 'regate', 'defensa', 'fisico'].every(key => finite(p[key], 1, 99)) || !['condicion_fisica', 'moral'].every(key => finite(p[key], 0, 100)) || !['valor_mercado', 'salario', 'clausula_rescision'].every(key => finite(p[key])) || !integer(p.injury, 0, 100000) || !integer(p.ban, 0, 10000)) fail('atributos de jugador no válidos');
      if (p.fecha_nacimiento != null && !validDate(p.fecha_nacimiento)) fail('fecha de nacimiento no válida');
      const ref = p.transfermarkt?.playerId ?? p.playerId;
      if (p.realIdentity && ref != null) {
        if (!integer(ref, 1, Number.MAX_SAFE_INTEGER) || referenceIds.has(ref)) fail('identidad real duplicada o no válida');
        referenceIds.add(ref);
      }
      if(p.form!=null&&(!Array.isArray(p.form)||p.form.length>100||p.form.some(n=>!finite(n,0,10))))fail('historial de notas no válido');
      if(p.lastRating!=null&&!finite(p.lastRating,0,10))fail('última nota de jugador no válida');
      if(p.attributes!=null&&(!object(p.attributes)||Object.keys(p.attributes).length>50||Object.values(p.attributes).some(n=>!finite(n,1,99))))fail('atributos específicos no válidos');
      ids.add(p.id);
    }
    validateSubsystems(s,clubs,ids);validateIncidents(s.world.incidents,clubs);validateArchive(s.world.matchArchive,clubs);validateSearches(s.world.marketSearches,clubs);validatePurchaseClaims(s.world.ai?.contracts?.purchaseClaims,clubs);
    const lineup = [...(s.tactics.xi || []), ...(s.tactics.bench || [])].filter(id => id != null);
    if (!Array.isArray(s.tactics.xi) || !Array.isArray(s.tactics.bench) || s.tactics.xi.length > 11 || s.tactics.bench.length > 15 || lineup.some(id => !ids.has(id)) || new Set(lineup).size !== lineup.length || !FORMATIONS[s.tactics.formation]) fail('alineación no válida');
    const events = new Set(); let previousDate = '';
    for (const e of s.calendar) {
      if (!object(e) || !string(e.id, 150) || events.has(e.id) || !['LPF','LIB','SUD','UCL','UEL','UEC','CUP','LIB_PRE','SUD_PRE'].includes(e.type) || !validDate(e.date) || e.date < previousDate || typeof e.done !== 'boolean' || !Array.isArray(e.games) || e.games.length > 300 || (e.type === 'LPF' && !leagues.has(e.leagueId))) fail('calendario no válido');
      previousDate = e.date; events.add(e.id);
      const used = new Set();
      for (const g of e.games) {
        if (!object(g) || !clubs.has(g.home) || !clubs.has(g.away) || g.home === g.away || used.has(g.home) || used.has(g.away)) fail('partido del calendario no válido');
        if(e.type==='LPF'){
          const lower=leagues.get(e.leagueId),upper=leagues.get(e.interdivisionUpper);
          const domestic=lower.clubIds.includes(g.home)&&lower.clubIds.includes(g.away);
          const promotion=e.pyramid===true&&e.phase==='knockout'&&e.pyramidPhase==='PROMOCION'&&lower.tier===2&&upper?.tier===1&&upper.country===lower.country&&lower.upperLeagueId===upper.id&&((upper.clubIds.includes(g.home)&&lower.clubIds.includes(g.away))||(lower.clubIds.includes(g.home)&&upper.clubIds.includes(g.away)));
          if(!domestic&&!promotion)fail('partido de otra liga');
        }
        used.add(g.home); used.add(g.away); result(g.result, g.home, g.away, clubs);
      }
    }
    const preliminaryPending=validateExtraCompetitions(s.world.extraCompetitions,clubs,s.calendar,s.today);
    if ((!object(s.world.cups.LIB) || !object(s.world.cups.SUD))&&!preliminaryPending) fail('faltan competiciones continentales');
    for (const cup of Object.values(s.world.cups)) {
      if (!object(cup) || !Array.isArray(cup.groups) || cup.groups.length > 32 || !Array.isArray(cup.stages) || cup.stages.length > 10 || cup.stages.some(stage => !object(stage) || !Array.isArray(stage.ties) || stage.ties.length > 64 || stage.ties.some(tie => !object(tie) || !Array.isArray(tie.legs) || tie.legs.length > 2))) fail('competición continental no válida');
      if (cup.participants != null && (!Array.isArray(cup.participants) || cup.participants.length > 128 || cup.participants.some(id => !clubs.has(id)) || new Set(cup.participants).size !== cup.participants.length)) fail('participantes continentales no válidos');
      cupNodes(cup, clubs);
      if (object(cup.groupTables)) for (const [key, rows] of Object.entries(cup.groupTables)) {
        const group = cup.groups?.find(g => g.id === key);
        if (!group || !Array.isArray(group.teams)) fail('tabla continental sin grupo');
        table(rows, group.teams);
      }
    }
    if (!Array.isArray(s.news) || s.news.length > 5000 || s.news.some(n => !object(n) || !string(n.title, 1000) || typeof n.body !== 'string' || n.body.length > 20000 || !validDate(n.date))) fail('noticias no válidas');
    if (s.scouting != null && (!object(s.scouting) || !Array.isArray(s.scouting.shortlist) || s.scouting.shortlist.some(id => !ids.has(id)) || !object(s.scouting.reports))) fail('ojeo no válido');
    if (s.match) {
      const m = s.match;
      if (!object(m) || !clubs.has(m.home) || !clubs.has(m.away) || m.home === m.away || !integer(m.minute, 0, 130) || ![0, 1].includes(m.userSide) || !Array.isArray(m.lineups) || m.lineups.length !== 2 || m.lineups.some(list => !Array.isArray(list) || list.length > 11) || m.lineups.flat().some(id => !ids.has(id)) || new Set(m.lineups.flat()).size !== m.lineups.flat().length || !Array.isArray(m.score) || m.score.length !== 2 || !m.score.every(n => integer(n, 0, 100)) || !Array.isArray(m.stats) || m.stats.length !== 2 || !object(m.ratings) || !Array.isArray(m.feed) || !['red', 'injured', 'used'].every(key => Array.isArray(m[key]) && m[key].every(id => ids.has(id)))) fail('partido en curso no válido');
      if (Object.entries(m.ratings).some(([id, rating]) => !ids.has(Number(id)) || !finite(rating, 0, 10))) fail('calificaciones del partido no válidas');
      for (const stats of m.stats) if (!object(stats) || Object.values(stats).some(value => typeof value === 'number' && !finite(value, 0, 100000))) fail('estadísticas del partido no válidas');
      if(m.rules!=null&&(!object(m.rules)||!integer(m.rules.bench,0,15)||!integer(m.rules.substitutions,0,6)||!integer(m.rules.windows,0,4)||!integer(m.rules.minimumPlayers,7,7)))fail('reglamento del partido no válido');
      if(m.keeperIds!=null&&(!Array.isArray(m.keeperIds)||m.keeperIds.length!==2||m.keeperIds.some(id=>id!=null&&!ids.has(id))))fail('arqueros del partido no válidos');
      if(m.shootoutOrder!=null&&(!Array.isArray(m.shootoutOrder)||m.shootoutOrder.length!==2||m.shootoutOrder.some(row=>!Array.isArray(row)||row.length>32||row.some(id=>!ids.has(id))||new Set(row).size!==row.length)))fail('orden de penales no válido');
      if(m.pendingPenalties!=null&&typeof m.pendingPenalties!=='boolean')fail('estado de tanda no válido');
      if(m.minimumPlayersPending!=null&&![0,1].includes(m.minimumPlayersPending))fail('equipo con jugadores insuficientes no válido');
      if(m.abandoned!=null&&(!object(m.abandoned)||![0,1].includes(m.abandoned.side)||typeof m.abandoned.reason!=='string'||!Array.isArray(m.abandoned.playedScore)||m.abandoned.playedScore.length!==2||m.abandoned.playedScore.some(n=>!integer(n,0,100))))fail('informe de abandono no válido');
      if(m.pen?.kicks!=null&&(!Array.isArray(m.pen.kicks)||m.pen.kicks.length>300||m.pen.kicks.some(k=>!object(k)||![0,1].includes(k.side)||!ids.has(k.playerId)||typeof k.scored!=='boolean'||(k.keeperId!=null&&!ids.has(k.keeperId)))))fail('tanda de penales no válida');

    }
    if (aliases) {
      if (!Array.isArray(s.league) || s.league.length !== userLeague.clubIds.length || s.league.some(c => !userLeague.clubIds.includes(c.id)) || new Set(s.league.map(c => c.id)).size !== s.league.length || !Array.isArray(s.continental)) fail('clubes de la carrera no válidos');
      table(s.standings, userLeague.clubIds); table(s.annual, userLeague.clubIds);
    }
    return true;
  }

  function encode(s) {
    validateWorld(s);
    const state = {...s, world: {...s.world}};
    state.players = packRecords(s.players, playerReference, identity, new Set(['id', 'clubId']));
    state.world.clubs = packRecords(s.world.clubs, c => dbClubs.has(c.id) ? c.id : null, id => id === null ? {} : dbClubs.get(id), new Set(['id']));
    state.world.leagues = s.world.leagues.map(l => {
      const ref = dbLeagues.get(l.id) || {}, reduced = residual(l, ref, new Set(['id', 'clubIds', 'standings', 'rounds']));
      return reduced;
    });
    delete state.league; delete state.continental; delete state.standings; delete state.annual;
    // The compatibility cup is an alias of the user's continental competition.
    if (s.cup && Object.values(s.world.cups).some(cup => cup === s.cup || same(cup, s.cup))) delete state.cup;
    return {format: FORMAT, codecVersion: CODEC_VERSION, version: 3, worldVersion: s.worldVersion, state};
  }

  function decode(raw) {
    safeJSON(raw);
    if(raw?.format===COMPRESSED_FORMAT){
      if(raw.codecVersion!==1||typeof raw.data!=='string'||raw.data.length>MAX_IMPORT_BYTES||typeof LZString==='undefined')fail('copia comprimida incompatible');
      const unpacked=LZString.decompressFromUTF16(raw.data,MAX_IMPORT_BYTES);
      if(typeof unpacked!=='string'||!unpacked||bytes(unpacked)>MAX_IMPORT_BYTES)fail('copia comprimida dañada o demasiado grande');
      raw=JSON.parse(unpacked);safeJSON(raw);
      if(raw?.format!==FORMAT)fail('contenido comprimido incompatible');
    }
    let state;
    if (raw?.format === FORMAT) {
      if (raw.codecVersion !== CODEC_VERSION || raw.version !== 3 || raw.worldVersion !== 1 || !object(raw.state) || !object(raw.state.world)) fail('versión de guardado compacto incompatible');
      state = copy(raw.state);
      state.players = unpackRecords(state.players, identity, 40000);
      state.world.clubs = unpackRecords(state.world.clubs, id => {
        if (id === null) return {};
        if (!dbClubs.has(id)) fail('la base instalada no incluye un club del guardado');
        return dbClubs.get(id);
      }, 1200);
      if (!Array.isArray(state.world.leagues)) fail('ligas compactas no válidas');
      state.world.leagues = state.world.leagues.map(l => {
        if (!object(l) || !dbLeagues.has(l.id)) fail('la base instalada no incluye una liga del guardado');
        const result = {...copy(dbLeagues.get(l.id)), ...l};
        if (Array.isArray(result._identityOmitted)) { for (const key of result._identityOmitted) delete result[key]; delete result._identityOmitted; }
        return result;
      });
      validateWorld(state, false);
      WORLD_ENGINE.hydrateWorldState(state);
    } else {
      state = copy(raw?.format === 'FM27' && raw.state ? raw.state : raw);
      if (state?.version === 3) { validateWorld(state); WORLD_ENGINE.hydrateWorldState(state); }
      else MANAGEMENT.validateImported(state);
    }
    if (state.version === 3) validateWorld(state);
    if (state.match && !state.match.done) state.match.paused = true;
    return state;
  }

  function serialize(s) {
    const payload = s.version === 3 ? encode(s) : s;
    if (s.version !== 3) MANAGEMENT.validateImported(s);
    const serialized=JSON.stringify(payload);
    if(s.version===3&&serialized.length*2>3800000&&typeof LZString!=='undefined'){
      const compressed=JSON.stringify({format:COMPRESSED_FORMAT,codecVersion:1,data:LZString.compressToUTF16(serialized)});
      if(compressed.length<serialized.length)return compressed;
    }
    return serialized;
  }
  // Autosaves use a single background codec. The public manual save stays synchronous.
  let saveRevision=0,saveTimer=null,saveDirty=false,dirtySince=0,saveWorker=null,workerBusy=false,workerFailed=false,workerState=null,workerRevision=-1,lockWaiting=null;
  function invalidateAutosave(){saveRevision++;if(saveTimer!==null)clearTimeout(saveTimer);saveTimer=null;saveDirty=false;dirtySince=0;lockWaiting=null;}
  function awaitEditor(state){lockWaiting=state;FM_CAREER_LOCKS.acquire(state).then(ok=>{if(lockWaiting!==state)return;lockWaiting=null;if(ok&&GameState===state)scheduleSave();});}
  function saveError(error){toast('No se pudo guardar la carrera: '+(error.name==='QuotaExceededError'?'se agotó el espacio del navegador. Exportá una copia de seguridad.':error.message||'revisá los permisos del navegador.'));}
  const asyncWrites=new Map();let asyncSequence=0;
  function backgroundWorker(){
    if(saveWorker||workerFailed)return saveWorker;
    if(typeof Worker==='undefined'||typeof Blob==='undefined'){workerFailed=true;return null}
    try{
      const definitions={own,object,same,copy,fail,string,integer,finite,validDate,mask,playerReference,identity,residual,packRecords,table,result,cupNodes,validateIncidents,validateArchive,validateSearches,validatePurchaseClaims,validateExtraCompetitions,validateSubsystems,validateWorld,encode,serialize};
      const source=`const FORMAT='${FORMAT}',COMPRESSED_FORMAT='${COMPRESSED_FORMAT}',CODEC_VERSION=${CODEC_VERSION},alphabet=${JSON.stringify(alphabet)},missing=Symbol('absent'),identityTemplates=new Map();let dbPlayers,dbClubs,dbLeagues,FORMATIONS;const WORLD_ENGINE={hydratePlayerIdentity:${WORLD_ENGINE.hydratePlayerIdentity.toString()}};const f=String.fromCharCode,LZString={_compress:${LZString._compress.toString()},compressToUTF16:${LZString.compressToUTF16.toString()}};`+Object.entries(definitions).map(([name,fn])=>`const ${name}=${fn.toString()};`).join('\n')+`self.onmessage=({data})=>{if(data.init){dbPlayers=new Map(data.init.players.map(p=>[p.playerId,p]));dbClubs=new Map(data.init.clubs.map(c=>[c.id,c]));dbLeagues=new Map(data.init.leagues.map(l=>[l.id,l]));FORMATIONS=data.init.formations;return}try{self.postMessage({id:data.id,text:serialize(data.state),snapshot:{careerId:data.state.careerId,careerName:data.state.careerName,careerMigrated:data.state.careerMigrated,manager:data.state.manager,today:data.state.today,year:data.state.year,userClub:{id:data.state.userClub.id,nombre:data.state.userClub.nombre}}})}catch(error){self.postMessage({id:data.id,error:error.message})}};`;
      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
      try{saveWorker=new Worker(url)}finally{URL.revokeObjectURL(url)}
      saveWorker.onmessage=({data})=>{
        if(asyncWrites.has(data.id)){const job=asyncWrites.get(data.id);asyncWrites.delete(data.id);if(data.error)job.reject(Error(data.error));else job.resolve(data);return;}
        workerBusy=false;
        if(data.id===saveRevision&&workerState===GameState){
          if(data.error)saveError(new Error(data.error));
          else try{if(window.FM_CAREER_LOCKS&&!FM_CAREER_LOCKS.guard(GameState))return;localStorage.setItem(KEY,data.text);window.FM_INTEGRITY?.onSaved?.(data.text,data.snapshot);window.FM_CAREERS?.onSaved?.(data.text,data.snapshot)}catch(error){saveError(error)}
        }
        workerState=null;
        if(saveDirty){clearTimeout(saveTimer);saveTimer=setTimeout(runAutosave,0)}
      };
      saveWorker.onerror=event=>{event.preventDefault();for(const job of asyncWrites.values())job.reject(Error('El proceso de guardado no está disponible'));asyncWrites.clear();saveWorker?.terminate();saveWorker=null;workerFailed=true;workerBusy=false;const retry=saveDirty||workerState===GameState&&workerRevision===saveRevision;workerState=null;if(retry)save(true)};
      saveWorker.postMessage({init:{players:WORLD_DATABASE.players,clubs:WORLD_DATABASE.clubs,leagues:WORLD_DATABASE.leagues,formations:FORMATIONS}});
      return saveWorker;
    }catch(error){saveWorker?.terminate();saveWorker=null;workerFailed=true;return null}
  }
  function runAutosave(){
    saveTimer=null;if(!saveDirty)return;if(!GameState){invalidateAutosave();return}if(workerBusy)return;
    if(GameState.version!==3){save(true);return}
    const worker=backgroundWorker();if(!worker){save(true);return}
    window.FM_CAREERS?.ensureIdentity(GameState);if(window.FM_CAREER_LOCKS&&!FM_CAREER_LOCKS.guard(GameState)){saveDirty=false;if(!FM_CAREER_LOCKS.blocked())awaitEditor(GameState);return}saveDirty=false;dirtySince=0;workerBusy=true;workerState=GameState;workerRevision=saveRevision;
    try{worker.postMessage({id:saveRevision,state:GameState})}catch(error){workerBusy=false;workerState=null;save(true)}
  }
  function scheduleSave(){
    if(!GameState)return false;
    saveRevision++;saveDirty=true;dirtySince||=Date.now();clearTimeout(saveTimer);
    saveTimer=setTimeout(runAutosave,Math.max(0,Math.min(350,2000-(Date.now()-dirtySince))));return true;
  }
  function autosavePending(){return !!lockWaiting||saveDirty||workerBusy&&workerRevision===saveRevision||asyncWrites.size>0}
  function flushSave(){return autosavePending()?save(true):true}
  window.addEventListener?.('pagehide',flushSave);
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden)flushSave()});
  async function saveAsync(silent=true){
    if(!GameState)return false;const target=GameState;window.FM_CAREERS?.ensureIdentity(target);
    if(window.FM_CAREER_LOCKS&&!await FM_CAREER_LOCKS.acquire(target))return false;
    invalidateAutosave();const revision=saveRevision,worker=backgroundWorker();if(!worker)return save(silent);
    const id='commit-'+(++asyncSequence),data=await new Promise((resolve,reject)=>{asyncWrites.set(id,{resolve,reject});try{worker.postMessage({id,state:target});}catch(error){asyncWrites.delete(id);reject(error);}});
    if(GameState!==target)return false;if(revision!==saveRevision)return saveAsync(silent);
    if(window.FM_CAREER_LOCKS&&!FM_CAREER_LOCKS.guard(target))return false;
    localStorage.setItem(KEY,data.text);window.FM_INTEGRITY?.onSaved?.(data.text,data.snapshot);window.FM_CAREERS?.onSaved?.(data.text,data.snapshot);if(!silent)toast('Carrera guardada');return true;
  }
  function save(silent = false) {
    invalidateAutosave();
    if (!GameState) return false;
    try {
      window.FM_CAREERS?.ensureIdentity(GameState);if(window.FM_CAREER_LOCKS&&!FM_CAREER_LOCKS.guard(GameState)){if(!FM_CAREER_LOCKS.blocked()){awaitEditor(GameState);return true}return false}const raw=serialize(GameState);localStorage.setItem(KEY,raw);window.FM_INTEGRITY?.onSaved?.(raw,GameState);window.FM_CAREERS?.onSaved?.(raw,GameState);
      if (!silent) toast('Carrera guardada');
      return true;
    } catch (error) {
      toast('No se pudo guardar la carrera: ' + (error.name === 'QuotaExceededError' ? 'se agotó el espacio del navegador. Exportá una copia de seguridad.' : error.message || 'revisá los permisos del navegador.'));
      return false;
    }
  }
  function restore() {
    try {
      const text = localStorage.getItem(KEY);
      if (!text) return false;
      if (bytes(text) > MAX_IMPORT_BYTES) fail('guardado demasiado grande');
      const candidate = decode(JSON.parse(text));
      invalidateAutosave();
      GameState = candidate; window.GameState = candidate;
      if (candidate.version !== 3) MANAGEMENT.ensure();
      return true;
    } catch (error) { toast('No se pudo abrir el guardado: ' + error.message); return false; }
  }
  function importState(raw, options = {}) {
    const candidate = decode(raw);
    if (GameState && options.confirm !== false && !confirm('¿Reemplazar la carrera actual por esta copia de seguridad?')) return false;
    // Persist first: a rejected or oversized import cannot replace the current career.
    if(options.persist!==false&&window.FM_CAREER_LOCKS&&!FM_CAREER_LOCKS.guard(candidate))throw Error('La carrera pertenece a otra pestaña o está preparando su guardado; cargala desde Mis carreras.');
    if (options.persist !== false) localStorage.setItem(KEY, serialize(candidate));
    invalidateAutosave();
    clearInterval(timer); timer = null;
    GameState = candidate; window.GameState = candidate;
    if (candidate.version !== 3) MANAGEMENT.ensure();
    view = GameState.match ? 'match' : 'dashboard';
    if (options.render !== false) render();
    return true;
  }
  function exportText(state){const expanded=JSON.stringify({format:'FM27',exportedAt:new Date().toISOString(),state});return bytes(expanded)>MAX_IMPORT_BYTES?serialize(state):expanded;}
  function exportGame() {
    if (!GameState) return;
    try {
      if (GameState.version === 3) validateWorld(GameState); else MANAGEMENT.validateImported(GameState);
      const blob = new Blob([exportText(GameState)], {type: 'application/json'});
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `FM27-${GameState.userClub.id}-${GameState.year}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000); toast('Copia de seguridad exportada');
    } catch (error) { toast('No se pudo exportar la carrera: ' + error.message); }
  }
  function importGame() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      try {
        if (file.size > MAX_IMPORT_BYTES) fail('el archivo supera el límite de 50 MB');
        const text = await file.text();
        if (bytes(text) > MAX_IMPORT_BYTES) fail('el archivo supera el límite de 50 MB');
        if (importState(JSON.parse(text))) toast('Carrera importada correctamente');
      } catch (error) { toast('No se pudo importar la carrera: ' + (error.name === 'QuotaExceededError' ? 'no hay espacio para guardar la copia en este navegador.' : error.message)); }
    }); input.click();
  }
  saveGame = save; restoreGame = restore;
  window.saveGame = save;
  window.loadGame = function () { if (!restore()) return false; view = GameState.match ? 'match' : 'dashboard'; render(); return true; };
  Object.assign(actions, {save: () => save(), export: exportGame, import: importGame});
  return {saveStatus:()=>({queued:saveDirty,waitingForEditor:!!lockWaiting,busy:workerBusy,commits:asyncWrites.size}),exportText,saveAsync,cancelPending:invalidateAutosave,scheduleSave,flushSave,pending:autosavePending,encode, decode, validate: s => s?.version === 3 ? validateWorld(s) : MANAGEMENT.validateImported(s), serialize, importState, exportGame, importGame, maxImportBytes: MAX_IMPORT_BYTES,
    inspect: s => { const text = serialize(s); return {players: s.players.length, characters: text.length, utf8Bytes: bytes(text), localStorageBytes: text.length * 2, hydratedBytes: bytes(JSON.stringify(s))}; }};
})();
window.WORLD_STORAGE = WORLD_STORAGE;
