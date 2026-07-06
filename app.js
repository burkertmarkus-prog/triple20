const $=s=>document.querySelector(s);
const state=JSON.parse(localStorage.getItem('dartTournament')||'null')||{players:[],started:false,matches:[],settings:{}};
function save(){localStorage.setItem('dartTournament',JSON.stringify(state))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function shuffle(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

function renderPlayers(){
  $('#playerList').innerHTML=state.players.map((p,i)=>`<div class="player"><b><span>${i+1}</span>${esc(p)}</b><button data-remove="${i}" aria-label="${esc(p)} entfernen">×</button></div>`).join('');
  $('#playerCount').textContent=`${state.players.length} Spieler eingetragen`;
  $('#startBtn').disabled=state.players.length<2;save();
}
$('#playerForm').addEventListener('submit',e=>{e.preventDefault();const input=$('#playerName'),name=input.value.trim();if(!name)return;if(state.players.some(p=>p.toLowerCase()===name.toLowerCase())){alert('Dieser Spieler ist bereits eingetragen.');return}state.players.push(name);input.value='';renderPlayers();input.focus()});
$('#playerList').addEventListener('click',e=>{const i=e.target.dataset.remove;if(i!==undefined){state.players.splice(+i,1);renderPlayers()}});
function toggleGroupOptions(){$('#groupOptions').classList.toggle('hidden',$('#mode').value!=='roundrobin')}
$('#mode').addEventListener('change',toggleGroupOptions);toggleGroupOptions();

function addPairs(target,players,round,bracket='upper'){
  for(let i=0;i<players.length-1;i+=2)target.push({a:players[i],b:players[i+1],sa:null,sb:null,round,bracket});
  if(players.length%2)target.push({a:players.at(-1),b:'Freilos',sa:1,sb:0,round,bracket});
}
function makeMatches(){
  const arr=[];
  if(state.settings.mode==='roundrobin'){
    const amount=Math.min(state.settings.groupCount||1,state.players.length),groups=Array.from({length:amount},()=>[]);shuffle(state.players).forEach((p,i)=>groups[i%amount].push(p));state.groups=groups;
    groups.forEach((players,group)=>{let ps=[...players];if(ps.length%2)ps.push(null);const count=ps.length;for(let round=1;round<count;round++){for(let i=0;i<count/2;i++){const a=ps[i],b=ps[count-1-i];if(a&&b)arr.push({a,b,sa:null,sb:null,round,group})}ps=[ps[0],ps[count-1],...ps.slice(1,count-1)]}});arr.sort((a,b)=>a.round-b.round||a.group-b.group);
  }else addPairs(arr,shuffle(state.players),1,'upper');
  return arr;
}
$('#startBtn').addEventListener('click',()=>{state.settings={name:$('#tournamentName').value.trim()||'Dartturnier',mode:$('#mode').value,legs:+$('#legs').value,start:+$('#startScore').value,groupCount:+$('#groupCount').value,qualifiers:+$('#qualifiers').value};state.matches=makeMatches();state.started=true;save();renderTournament()});

function playerLosses(){const losses=Object.fromEntries(state.players.map(p=>[p,0]));state.matches.filter(m=>m.sa!==null&&m.b!=='Freilos').forEach(m=>{losses[m.sa>m.sb?m.b:m.a]++});return losses}
function standingsFor(players,matches=state.matches){return players.map(name=>{const played=matches.filter(m=>m.sa!==null&&m.b!=='Freilos'&&(m.a===name||m.b===name));let w=0,lf=0,la=0;played.forEach(m=>{const own=m.a===name?m.sa:m.sb,other=m.a===name?m.sb:m.sa;lf+=own;la+=other;if(own>other)w++});return{name,p:played.length,w,l:played.length-w,lf,la,pts:w*2}}).sort((a,b)=>b.pts-a.pts||(b.lf-b.la)-(a.lf-a.la)||b.lf-a.lf)}
function standings(){return standingsFor(state.players)}
function modeName(){return state.settings.mode==='roundrobin'?'Jeder gegen jeden':state.settings.mode==='double'?'Doppel-K.-o.-Turnier':'K.-o.-Turnier'}
function champion(){
  if(state.settings.mode==='roundrobin')return state.groups?.length>1?'':state.matches.every(m=>m.sa!==null)?standings()[0]?.name:'';
  const limit=state.settings.mode==='double'?2:1,losses=playerLosses(),active=state.players.filter(p=>losses[p]<limit);
  return active.length===1&&state.matches.every(m=>m.sa!==null)?active[0]:'';
}
function renderTournament(){
  if(!state.started){$('#setupSection').classList.remove('hidden');$('#tournamentSection').classList.add('hidden');return}
  $('#setupSection').classList.add('hidden');$('#tournamentSection').classList.remove('hidden');$('#bracketTab').classList.toggle('hidden',state.settings.mode==='roundrobin');
  $('#liveTitle').textContent=state.settings.name;$('#liveMeta').textContent=`${state.players.length} Spieler · ${modeName()} · ${state.settings.start}`;
  const done=state.matches.filter(m=>m.sa!==null).length;$('#progressText').textContent=Math.round(done/state.matches.length*100)+'%';
  $('#matchList').innerHTML=state.matches.map((m,i)=>`<article class="match ${m.sa!==null?'done':''}"><div class="match-no">${m.group!==undefined?'Gruppe '+String.fromCharCode(65+m.group)+' · ':''}Runde ${m.round} · ${m.bracket==='lower'?'Verlierer':m.bracket==='grand'?'Finale':'Spiel'} ${String(i+1).padStart(2,'0')}</div><div class="players-match"><span class="${m.sa>m.sb?'winner-player':''}">${esc(m.a)}</span><b>${m.sa===null?'VS':m.sa+' : '+m.sb}</b><span class="${m.sb>m.sa?'winner-player':''}">${esc(m.b)}</span></div><div class="score-controls">${m.b==='Freilos'?'Weiter':`<select data-sa="${i}">${options(m.sa)}</select><span>:</span><select data-sb="${i}">${options(m.sb)}</select><button data-save="${i}">✓</button>`}</div></article>`).join('');
  renderTable();renderBracket();renderQualification();const winner=champion();$('#winnerCard').classList.toggle('hidden',!winner);if(winner)$('#winnerName').textContent=winner;save();
}
function options(current){let s='<option value="">–</option>';for(let i=0;i<=state.settings.legs;i++)s+=`<option ${current===i?'selected':''}>${i}</option>`;return s}
function advanceElimination(){
  if(state.settings.mode==='roundrobin')return;
  while(true){
    const round=Math.max(...state.matches.map(m=>m.round||1)),current=state.matches.filter(m=>(m.round||1)===round);
    if(current.some(m=>m.sa===null))return;
    const limit=state.settings.mode==='double'?2:1,losses=playerLosses(),active=state.players.filter(p=>losses[p]<limit);
    if(active.length<=1)return;
    const next=round+1;
    const winners=matches=>matches.map(m=>m.sa>m.sb?m.a:m.b);
    if(state.settings.mode==='knockout'){addPairs(state.matches,winners(current),next,'upper');continue}
    if(active.length===2){const ordered=[...active].sort((a,b)=>losses[a]-losses[b]);addPairs(state.matches,ordered,next,'grand');continue}
    const upperGames=current.filter(m=>m.bracket==='upper'),lowerGames=current.filter(m=>m.bracket==='lower');
    const upperWinners=winners(upperGames),lowerWinners=winners(lowerGames);
    const upperLosers=upperGames.filter(m=>m.b!=='Freilos').map(m=>m.sa>m.sb?m.b:m.a);
    if(upperWinners.length)addPairs(state.matches,upperWinners,next,'upper');
    const lowerEntrants=[];
    if(lowerWinners.length){const max=Math.max(lowerWinners.length,upperLosers.length);for(let i=0;i<max;i++){if(lowerWinners[i])lowerEntrants.push(lowerWinners[i]);if(upperLosers[i])lowerEntrants.push(upperLosers[i])}}
    else lowerEntrants.push(...upperLosers);
    if(lowerEntrants.length)addPairs(state.matches,lowerEntrants,next,'lower');
  }
}
$('#matchList').addEventListener('click',e=>{const i=e.target.dataset.save;if(i===undefined)return;const a=$(`[data-sa="${i}"]`).value,b=$(`[data-sb="${i}"]`).value;if(a===''||b===''||a===b){alert('Bitte ein eindeutiges Ergebnis eintragen.');return}if(Math.max(+a,+b)!==state.settings.legs){alert(`Der Sieger benötigt ${state.settings.legs} Legs.`);return}state.matches[i].sa=+a;state.matches[i].sb=+b;advanceElimination();renderTournament()});

function tableHtml(rows,title=''){return `<div class="group-table">${title?`<h3>${title}</h3>`:''}<div class="table-wrap"><table><thead><tr><th>#</th><th>Spieler</th><th>Sp.</th><th>S</th><th>N</th><th>Legs</th><th>Pkt.</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.name)}</b></td><td>${r.p}</td><td>${r.w}</td><td>${r.l}</td><td>${r.lf}:${r.la}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div></div>`}
function renderTable(){if(state.settings.mode==='roundrobin'&&state.groups?.length>1)$('#tableView').innerHTML=state.groups.map((players,i)=>tableHtml(standingsFor(players,state.matches.filter(m=>m.group===i)),`Gruppe ${String.fromCharCode(65+i)}`)).join('');else $('#tableView').innerHTML=tableHtml(standings())}
function qualifiedPlayers(){if(!state.groups?.length)return[];return state.groups.flatMap((players,i)=>standingsFor(players,state.matches.filter(m=>m.group===i)).slice(0,Math.min(state.settings.qualifiers||1,players.length)).map(r=>r.name))}
function renderQualification(){const visible=state.settings.mode==='roundrobin'&&state.groups?.length>1&&state.matches.every(m=>m.sa!==null),card=$('#qualificationCard');card.classList.toggle('hidden',!visible);if(visible)$('#qualifiedPlayers').innerHTML=qualifiedPlayers().map(p=>`<span>${esc(p)}</span>`).join('')}
$('#qualificationCard').addEventListener('click',e=>{const mode=e.target.dataset.finals;if(!mode)return;const qualified=qualifiedPlayers();if(qualified.length<2){alert('Für eine Finalrunde müssen mindestens zwei Spieler weiterkommen.');return}state.groupStage={players:[...state.players],groups:state.groups,matches:state.matches};state.players=qualified;state.groups=[];state.settings.mode=mode;state.settings.name+=' – Finalrunde';state.matches=makeMatches();save();renderTournament()});
function bracketCard(m,label='Sieger der Vorrunde'){
  if(!m)return `<div class="bracket-game placeholder"><div class="bracket-player"><span>${label}</span><small>–</small></div><div class="bracket-player"><span>${label}</span><small>–</small></div></div>`;
  return `<div class="bracket-game ${m.preview?'preview':''}"><div class="bracket-player ${m.sa!==null&&m.sa>m.sb?'won':''}"><span>${esc(m.a)}</span><small>${m.sa===null?'–':m.sa}</small></div><div class="bracket-player ${m.sb!==null&&m.sb>m.sa?'won':''}"><span>${esc(m.b)}</span><small>${m.sb===null?'–':m.sb}</small></div></div>`;
}
function singleBracket(){
  const total=Math.max(1,Math.ceil(Math.log2(state.players.length))),columns=[];
  for(let round=1;round<=total;round++){const games=state.matches.filter(m=>(m.round||1)===round),count=Math.max(1,Math.ceil(state.players.length/2**round));const cards=Array.from({length:count},(_,i)=>bracketCard(games[i],round===total?'Finalist':'Sieger der Vorrunde')).join('');columns.push(`<section class="bracket-round"><h3>${round===total?'Finale':'Runde '+round}</h3><div class="bracket-games">${cards}</div></section>`)}
  return `<div class="bracket-grid">${columns.join('')}</div>`;
}
function groupedMatches(kind){const all=state.matches.filter(m=>m.bracket===kind),rounds=[...new Set(all.map(m=>m.round))].sort((a,b)=>a-b);return rounds.map(r=>all.filter(m=>m.round===r))}
function knownWinner(m){return m&&m.sa!==null?(m.sa>m.sb?m.a:m.b):''}
function knownLoser(m){return m&&m.sa!==null&&m.b!=='Freilos'?(m.sa>m.sb?m.b:m.a):''}
function previewPairs(inputs,count,fallback){const games=[];for(let i=0;i<count;i++)games.push({a:inputs[i*2]||fallback,b:inputs[i*2+1]||fallback,sa:null,sb:null,preview:true});return games}
function projectedUpper(roundCount){
  const actual=groupedMatches('upper'),stages=[];
  for(let stage=0;stage<roundCount;stage++){const count=Math.max(1,2**(roundCount-stage-1));if(actual[stage]?.length)stages.push(actual[stage]);else{const previous=stages[stage-1]||[],inputs=[];for(let i=0;i<count*2;i++)inputs.push(knownWinner(previous[i])||`Sieger aus Gewinner-Spiel ${stage}`);stages.push(previewPairs(inputs,count,'Sieger aus offenem Spiel'))}}
  return stages;
}
function projectedLower(roundCount,upperStages,upperRounds){
  const actual=groupedMatches('lower'),stages=[];
  for(let stage=0;stage<roundCount;stage++){
    const count=Math.max(1,2**(upperRounds-1-Math.ceil((stage+1)/2)));
    if(actual[stage]?.length){stages.push(actual[stage]);continue}
    const inputs=[];
    if(stage===0){for(const [i,game] of (upperStages[0]||[]).entries())inputs.push(knownLoser(game)||`Verlierer aus Gewinner-Spiel ${i+1}`)}
    else{const lowerWinners=(stages[stage-1]||[]).map(m=>knownWinner(m)||`Sieger aus Verliererspiel ${stage}`),upperLosers=(upperStages[stage]||[]).map(m=>knownLoser(m)||`Verlierer aus Gewinner-Spiel ${stage+1}`),max=Math.max(lowerWinners.length,upperLosers.length);for(let i=0;i<max;i++){if(lowerWinners[i])inputs.push(lowerWinners[i]);if(upperLosers[i])inputs.push(upperLosers[i])}}
    stages.push(previewPairs(inputs,count,'Noch offen'));
  }
  return stages;
}
function doubleLane(kind,title,stages,roundCount,upperRounds){
  const columns=[];
  for(let stage=1;stage<=roundCount;stage++){
    const games=stages[stage-1]||[];
    const planned=kind==='upper'?Math.max(1,2**(upperRounds-stage)):Math.max(1,2**(upperRounds-1-Math.ceil(stage/2)));
    const count=Math.max(planned,games.length);
    const label=kind==='lower'?'Verlierer aus dem Gewinnerbaum':'Sieger der Vorrunde';
    columns.push(`<section class="bracket-round"><h3>${title} ${stage}</h3><div class="bracket-games">${Array.from({length:count},(_,i)=>bracketCard(games[i],label)).join('')}</div></section>`);
  }
  return `<section class="bracket-side ${kind==='lower'?'loser-side':'winner-side'}"><h2>${title}n</h2><div class="bracket-grid">${columns.join('')}</div></section>`;
}
function renderBracket(){
  if(state.settings.mode==='roundrobin'){$('#bracketGrid').innerHTML='';return}
  if(state.settings.mode==='knockout'){$('#bracketGrid').innerHTML=singleBracket();return}
  const upperRounds=Math.max(1,Math.ceil(Math.log2(state.players.length))),lowerRounds=Math.max(1,upperRounds*2-2);
  const upperStages=projectedUpper(upperRounds),lowerStages=projectedLower(lowerRounds,upperStages,upperRounds),realFinal=state.matches.find(m=>m.bracket==='grand');
  const projectedFinal={a:knownWinner(upperStages.at(-1)?.[0])||'Sieger Gewinnerbaum',b:knownWinner(lowerStages.at(-1)?.[0])||'Sieger Verliererbaum',sa:null,sb:null,preview:true};
  const final=`<section class="grand-final"><span>🏆</span><h3>Großes Finale</h3>${bracketCard(realFinal||projectedFinal,'Finalist')}</section>`;
  $('#bracketGrid').innerHTML=`<div class="double-bracket-layout">${doubleLane('lower','Verliererrunde',lowerStages,lowerRounds,upperRounds)}${final}${doubleLane('upper','Gewinnerrunde',upperStages,upperRounds,upperRounds)}</div>`;
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#matchesView').classList.toggle('hidden',b.dataset.tab!=='matches');$('#bracketView').classList.toggle('hidden',b.dataset.tab!=='bracket');$('#tableView').classList.toggle('hidden',b.dataset.tab!=='table')}));
function reset(){if(state.started&&!confirm('Das aktuelle Turnier wirklich löschen?'))return;Object.assign(state,{players:[],started:false,matches:[],settings:{}});save();location.reload()}
$('#resetBtn').onclick=reset;$('#finishReset').onclick=reset;renderPlayers();if(state.started)renderTournament();
