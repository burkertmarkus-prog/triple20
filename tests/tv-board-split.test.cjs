const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function functionSource(name){
  const start=source.indexOf(`function ${name}(`);assert.notEqual(start,-1,`${name} fehlt`);
  const brace=source.indexOf('{',start);let depth=0;
  for(let index=brace;index<source.length;index++){if(source[index]==='{')depth++;else if(source[index]==='}'&&!--depth)return source.slice(start,index+1)}
  throw new Error(`${name} ist unvollständig`);
}
const context=vm.createContext({state:{tvPausedCompetitions:{},tvBoardAssignments:[]}});
vm.runInContext(['tvCompetitionPaused','tvPlayableMatches','tvRealPlayer','tvMatchIdentity','tvBoardAssignments'].map(functionSource).join('\n'),context);
const players=(prefix,count)=>Array.from({length:count},(_,index)=>`${prefix}${index+1}`);
const pairs=(names,round)=>Array.from({length:names.length/2},(_,index)=>({a:names[index*2],b:names[index*2+1],round,sa:null,sb:null}));
const menPlayers=players('H',32),womenPlayers=players('D',6);
const men={players:menPlayers,settings:{mode:'double',doubleKoPlan:{}},matches:pairs(menPlayers,1)};
const women={players:womenPlayers,settings:{mode:'roundrobin'},matches:[...pairs(womenPlayers,1),...pairs([womenPlayers[0],womenPlayers[2],womenPlayers[4],womenPlayers[1],womenPlayers[3],womenPlayers[5]],2)]};
context.live=[{key:'men',tournament:men},{key:'women',tournament:women}];
const assign=()=>vm.runInContext('tvBoardAssignments(live)',context);

let boards=assign();
assert.deepEqual([...boards].map(item=>item.key),['women','women','women','men'],'Das kleinere Turnier soll anfangs drei Boards erhalten.');
assert.equal(new Set([...boards].flatMap(item=>[item.match.a,item.match.b])).size,8,'Kein Spieler darf auf zwei Boards stehen.');

for(const item of [...boards].filter(item=>item.key==='women').slice(0,2)){item.match.sa=2;item.match.sb=0}
boards=assign();
assert.deepEqual([...boards].map(item=>item.key),['men','men','women','men'],'Zwei freie Damenboards müssen automatisch an spielbereite Herren gehen.');
assert.equal([...boards].find(item=>item.key==='women').match.a,'D5','Das noch laufende Damenspiel muss auf seinem Board bleiben.');

context.state.tvPausedCompetitions={women:true};
const lastWomen=[...boards].find(item=>item.key==='women');lastWomen.match.sa=2;lastWomen.match.sb=0;
boards=assign();
assert.equal([...boards].every(item=>item.key==='men'),true,'Während der Damenpause dürfen nur Herrenspiele nachrücken.');

context.state.tvPausedCompetitions={women:false};
const freedMen=boards[0];freedMen.match.sa=2;freedMen.match.sb=0;
boards=assign();
assert.equal([...boards].find(item=>item.board===freedMen.board).key,'women','Nach Fortsetzen soll das nächste freie Board wieder an das kleinere Turnier gehen.');
assert.equal(new Set([...boards].flatMap(item=>[item.match.a,item.match.b])).size,8,'Auch nach dem Nachrücken darf kein Spieler doppelt eingeteilt sein.');

console.log('OK: automatische Boardverteilung, Pausen und kollisionsfreies Nachrücken geprüft.');
