const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function functionSource(name){
  const start=source.indexOf(`function ${name}(`);assert.notEqual(start,-1,`${name} fehlt`);
  const brace=source.indexOf('){',start)+1;let depth=0;
  for(let i=brace;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&!--depth)return source.slice(start,i+1)}
  throw new Error(`${name} ist unvollständig`);
}
const context={structuredClone};vm.createContext(context);vm.runInContext(`${functionSource('seasonItemTime')}\n${functionSource('mergeSeasonStores')}`,context);
const season=(tournaments,updatedAt)=>({id:'season-1',name:'Liga',updatedAt,tournaments});
const planned=(id,date,createdAt)=>({id,date,name:id,planned:true,createdAt});

const merged=context.mergeSeasonStores(
  {seasons:[season([planned('lokal','2026-10-01','2026-09-21T10:00:00Z')],'2026-09-21T10:00:00Z')]},
  {seasons:[season([planned('cloud','2026-10-08','2026-09-21T10:01:00Z')],'2026-09-21T10:01:00Z')]}
);
assert.equal(merged.seasons[0].tournaments.map(item=>item.id).join(','),'lokal,cloud');

const deleted=context.mergeSeasonStores(
  {seasons:[season([], '2026-09-21T10:02:00Z')],deletedTournamentIds:{cloud:'2026-09-21T10:02:00Z'}},
  {seasons:[season([planned('cloud','2026-10-08','2026-09-21T10:01:00Z')],'2026-09-21T10:01:00Z')]}
);
assert.equal(deleted.seasons[0].tournaments.length,0);

const deletedSeason=context.mergeSeasonStores(
  {seasons:[],deletedSeasonIds:{'season-h2':'2026-11-15T12:00:00Z'}},
  {seasons:[{id:'season-h2',name:'2026 H2',updatedAt:'2026-11-14T12:00:00Z',tournaments:[]}]}
);
assert.equal(deletedSeason.seasons.length,0,'Eine gelöschte Wertung darf durch ältere Cloud-Daten nicht wiederhergestellt werden.');
assert.equal(deletedSeason.deletedSeasonIds['season-h2'],'2026-11-15T12:00:00Z');

const completed=context.mergeSeasonStores(
  {seasons:[season([{id:'result',scheduledEventId:'cloud',date:'2026-10-08',planned:false,updatedAt:'2026-10-08T22:00:00Z'}],'2026-10-08T22:00:00Z')]},
  {seasons:[season([planned('cloud','2026-10-08','2026-09-21T10:01:00Z')],'2026-09-21T10:01:00Z')]}
);
assert.equal(completed.seasons[0].tournaments.map(item=>item.id).join(','),'result');
assert.match(source,/syncKey=season\?SEASON_KEY:TOURNAMENT_HISTORY_KEY/,'Saisontermine und eigenständige Turniere müssen in getrennten Cloud-Bereichen gespeichert werden.');
assert.match(source,/syncAll\(\{force:true,keys:\[syncKey\]\}\)/,'Ein neuer Termin muss gezielt in seinem Datenbereich gespeichert werden.');
assert.match(source,/standalone:!!state\.scheduledStandalone/,'Ein eigenständiges Turnier muss auch im abgeschlossenen Datensatz als solches gekennzeichnet bleiben.');
assert.match(source,/plannedIndex>=0\)history\.splice\(plannedIndex,1,record\)/,'Beim Abschluss muss der geplante eigenständige Termin durch das Ergebnis ersetzt werden.');
assert.match(source,/Die Saisonwertungen bleiben unverändert/,'Der Abschluss eines eigenständigen Turniers muss die fehlende Saisonübernahme eindeutig bestätigen.');
assert.doesNotMatch(html,/id="publicScheduleForm"/,'Die Terminerstellung darf nicht mehr auf der öffentlichen Startseite stehen.');
assert.match(source,/id="publicScheduleSeason"><\/select>/,'Die Saisonauswahl muss in der Turnierleitung verfügbar bleiben.');
assert.match(source,/scheduledTournamentExistsOnline\(record\.id\)/,'Nach dem Speichern muss dieselbe Termin-ID aus Supabase zurückgelesen werden.');
assert.match(source,/if\(tournament\.planned\).*scheduledTournamentExistsOnline\(tournament\.id\)/s,'Ein geplanter Termin darf erst nach Online-Bestätigung geteilt werden.');
assert.match(source,/navigator\.share\(\{title,text:message\}\)/,'Mobil soll die native Teilen-Funktion statt eines zusätzlichen WhatsApp-Browserfensters verwendet werden.');
assert.match(source,/Termin nur lokal – Online-Speicherung fehlt/,'Eine fehlende Cloud-Bestätigung muss sichtbar bleiben.');
console.log('OK: Saisontermine werden geräteübergreifend vereinigt, echte Löschungen und Abschlüsse bleiben erhalten.');
