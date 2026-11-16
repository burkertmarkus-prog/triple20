const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync(new URL('../app.js',`file://${__filename}`).pathname,'utf8');
const start=app.indexOf('function loadClubDuels()');
const end=app.indexOf('\nfunction updateAppUrl(',start);
assert.ok(start>=0&&end>start,'Vereinsduell-Funktionen wurden nicht gefunden');

let id=0;
const context={
  CLUB_DUELS_KEY:'triple20_club_duels',
  crypto:{randomUUID:()=>`id-${++id}`},
  localStorage:{getItem:()=>null,setItem:()=>{}},
  safeJsonParse:(value,fallback=null)=>{try{return JSON.parse(value)}catch{return fallback}},
  esc:value=>String(value),
  Intl,Date,Set,Math,JSON,structuredClone,
  $:()=>null,isAdmin:()=>false,T20Cloud:{publicMembers:[]},appSettings:{club:{name:'DCA'}},todayIso:()=> '2026-09-18'
};
vm.createContext(context);
vm.runInContext(`${app.slice(start,end)}\nglobalThis.__duelTest={parseClubRoster,clubDuelMatches,clubDuelScore,clubDuelLegsToWin,mergeClubDuelStores};`,context);

const {parseClubRoster,clubDuelMatches,clubDuelScore,clubDuelLegsToWin,mergeClubDuelStores}=context.__duelTest;
assert.deepEqual([...parseClubRoster('Burki\nVetti, Burki; Bani')],['Burki','Vetti','Bani']);

const matches=clubDuelMatches({firstSingles:4,doubles:2,lastSingles:4});
assert.equal(matches.length,10);
assert.deepEqual(JSON.parse(JSON.stringify(matches.map(match=>match.label))),[
  'Offenes Einzel 1','Offenes Einzel 2','Offenes Einzel 3','Offenes Einzel 4',
  'Offenes Doppel 1','Offenes Doppel 2',
  'Offenes Einzel 5','Offenes Einzel 6','Offenes Einzel 7','Offenes Einzel 8'
]);
assert.deepEqual(JSON.parse(JSON.stringify(matches.map(match=>match.section))),[1,1,1,1,2,2,3,3,3,3]);
assert.equal(clubDuelLegsToWin({singleLegsToWin:3,doubleLegsToWin:2},matches[0]),3);
assert.equal(clubDuelLegsToWin({singleLegsToWin:3,doubleLegsToWin:3},matches[4]),3);

matches[0].homeLegs=3;matches[0].guestLegs=1;
matches[1].homeLegs=2;matches[1].guestLegs=3;
assert.deepEqual(JSON.parse(JSON.stringify(clubDuelScore({matches}))),{home:1,guest:1,homeLegs:5,guestLegs:4,played:2});

const base={id:'duel-1',createdAt:'2026-09-18T10:00:00Z',updatedAt:'2026-09-18T10:00:00Z',status:'live',homeClub:'DCA',guestClub:'Gast',matches:[{id:'m1',homeLegs:null,guestLegs:null},{id:'m2',homeLegs:null,guestLegs:null}]};
const deviceA=structuredClone(base),deviceB=structuredClone(base);
deviceA.matches[0]={...deviceA.matches[0],homeLegs:3,guestLegs:1,updatedAt:'2026-09-18T10:01:00Z'};deviceA.updatedAt='2026-09-18T10:01:00Z';
deviceB.matches[1]={...deviceB.matches[1],homeLegs:2,guestLegs:3,updatedAt:'2026-09-18T10:02:00Z'};deviceB.updatedAt='2026-09-18T10:02:00Z';
const merged=JSON.parse(JSON.stringify(mergeClubDuelStores({duels:[deviceA]},{duels:[deviceB]})));
assert.deepEqual(merged.duels[0].matches.map(match=>[match.homeLegs,match.guestLegs]),[[3,1],[2,3]],'Ergebnisse verschiedener Geräte werden zusammengeführt');
const deleted={...structuredClone(deviceA),status:'deleted',deletedAt:'2026-09-18T10:03:00Z',updatedAt:'2026-09-18T10:03:00Z'};
assert.equal(mergeClubDuelStores({duels:[deleted]},{duels:[deviceB]}).duels[0].deletedAt,deleted.deletedAt,'Eine Löschung wird auf einem zweiten Gerät nicht wiederbelebt');

console.log('OK: TDSV-Vorlage, Rosters, Gesamtstand und Zwei-Geräte-Zusammenführung geprüft.');
