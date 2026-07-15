const $=s=>document.querySelector(s);
const SETTINGS_KEY='triple20_settings';
const TOURNAMENT_HISTORY_KEY='triple20_tournaments';
const defaultSettings={
  appName:'Triple20',
  mode:'club',
  club:{enabled:true,name:'',logo:'',seasonMode:'halfyear',pointSystem:{5:25,4:20,3:15,2:10,1:7,0:5},dropResults:4,color:'#0E6BFF'},
  tournament:{defaultMode:'swiss',defaultFormat:'single',defaultLegs:2},
  theme:{background:'#EEF5FF',card:'#FFFFFF',primary:'#0E6BFF',accent:'#55A7FF',text:'#122033'}
};
let appSettings=loadSettings();
const state=JSON.parse(localStorage.getItem('dartTournament')||'null')||{players:[],started:false,matches:[],settings:{}};
const SEASON_KEY='tripleTwentySeasons';
const seasonStore=loadSeasons();
let selectedSeasonId=localStorage.getItem('tripleTwentySelectedSeason')||'';
let manualTournamentOpen=false;
let seasonFormOpen=false;
function save(){localStorage.setItem('dartTournament',JSON.stringify(state))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mergeSettings(base,stored){const out={...base,...(stored||{})};out.club={...base.club,...(stored?.club||{}),pointSystem:{...base.club.pointSystem,...(stored?.club?.pointSystem||{})}};out.tournament={...base.tournament,...(stored?.tournament||{})};out.theme={...base.theme,...(stored?.theme||{})};out.club.enabled=out.mode==='club';return out}
function migrateFriendlyTheme(stored){const t=stored?.theme;if(t?.background==='#05070A'&&t?.card==='#111820'&&t?.text==='#F7F7F7')stored.theme={...defaultSettings.theme};return stored}
function loadSettings(){try{return mergeSettings(defaultSettings,migrateFriendlyTheme(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null')))}catch{return mergeSettings(defaultSettings,{})}}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(appSettings))}
function updateSettings(patch){appSettings=mergeSettings(appSettings,patch);saveSettings();applyTheme();renderNavigation();renderSettingsForm();renderSeasonView();return appSettings}
function setAppMode(mode){updateSettings({mode,club:{...appSettings.club,enabled:mode==='club'}})}
function isClubMode(){return true}
function applyTheme(){const t=appSettings.theme||defaultSettings.theme,r=document.documentElement;r.style.setProperty('--cream',t.background);r.style.setProperty('--paper',`${t.card}f2`);r.style.setProperty('--blue',t.primary);r.style.setProperty('--blue-2',t.primary);r.style.setProperty('--green',t.primary);r.style.setProperty('--orange',t.primary);r.style.setProperty('--accent',t.accent);r.style.setProperty('--ink',t.text);r.style.setProperty('--line','#CAD8EA');if(document.body)document.body.style.background=`radial-gradient(circle at 15% 0%, ${t.primary}22, transparent 34%), linear-gradient(180deg, #F8FBFF 0%, ${t.background} 48%, #FFFFFF 100%)`;document.title=`${appSettings.appName||'Triple20'} – Dartturniere`;const brand=$('.brand strong');if(brand)brand.innerHTML=esc(appSettings.appName||'Triple20').replace(/20/g,'<span>20</span>');const sub=$('#brandSubtitle');if(sub)sub.textContent=isClubMode()&&appSettings.club.name?appSettings.club.name:'Turnierleitung';const footer=$('#footerAppName');if(footer)footer.textContent=appSettings.appName||'Triple20'}
function shuffle(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function todayIso(){return new Date().toISOString().slice(0,10)}
function currentHalfYear(date=new Date()){const y=date.getFullYear(),h=date.getMonth()<6?'H1':'H2';return{year:y,half:h,name:`${y} ${h}`,start:`${y}-${h==='H1'?'01-01':'07-01'}`,end:`${y}-${h==='H1'?'06-30':'12-31'}`}}
function downloadFile(name,type,content){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);a.remove()}
function currentSeasonWinsMap(){const rows=calculateSeasonStandings(selectedSeason());return Object.fromEntries(rows.map(r=>[r.name,r.wins||0]))}
function sortBySeasonWins(players){const wins=currentSeasonWinsMap();return [...players].sort((a,b)=>(wins[b]||0)-(wins[a]||0)||a.localeCompare(b,'de'))}

function renderPlayers(){
  if(!state.started)state.players=sortBySeasonWins(state.players);
  $('#playerList').innerHTML=state.players.map((p,i)=>`<div class="player"><b><span>${i+1}</span>${esc(p)}</b><button data-remove="${i}" aria-label="${esc(p)} entfernen">×</button></div>`).join('');
  $('#playerCount').textContent=`${state.players.length} Spieler eingetragen`;
  renderMemberSuggestions();
  $('#startBtn').disabled=state.players.length<2;save();
}
$('#playerForm').addEventListener('submit',e=>{e.preventDefault();const input=$('#playerName'),name=input.value.trim();if(!name)return;if(state.players.some(p=>p.toLowerCase()===name.toLowerCase())){alert('Dieser Spieler ist bereits eingetragen.');return}state.players.push(name);input.value='';renderPlayers();input.focus()});
$('#playerList').addEventListener('click',e=>{const i=e.target.dataset.remove;if(i!==undefined){state.players.splice(+i,1);renderPlayers()}});
function toggleModeOptions(){const mode=$('#mode').value;$('#groupOptions').classList.toggle('hidden',mode!=='roundrobin');$('#swissOptions').classList.toggle('hidden',mode!=='swiss')}
$('#mode').addEventListener('change',toggleModeOptions);toggleModeOptions();

function addPairs(target,players,round,bracket='upper'){
  for(let i=0;i<players.length-1;i+=2)target.push({a:players[i],b:players[i+1],sa:null,sb:null,round,bracket});
  if(players.length%2)target.push({a:players.at(-1),b:'Freilos',sa:1,sb:0,round,bracket});
}
function hasPlayed(matches,a,b){return matches.some(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a))}
function withdrawnPlayers(){return state.withdrawn||[]}
function activeSwissPlayers(){return state.players.filter(p=>!withdrawnPlayers().includes(p))}
function seasonSeededPlayers(players){return sortBySeasonWins(players)}
function swissPairings(players,history){
  if(players.length<2)return{pairs:[],repeats:0};
  if(players.length>16){const rest=[...players],pairs=[];while(rest.length>1){const a=rest.shift();let opponent=rest.findIndex(b=>!hasPlayed(history,a,b));if(opponent<0)opponent=0;pairs.push([a,rest.splice(opponent,1)[0]])}return{pairs,repeats:pairs.filter(p=>hasPlayed(history,p[0],p[1])).length}}
  const a=players[0],rest=players.slice(1),order=rest.map((b,i)=>i).sort((i,j)=>Number(hasPlayed(history,a,rest[i]))-Number(hasPlayed(history,a,rest[j])));
  let best=null;
  for(const i of order){
    const b=rest[i],repeat=hasPlayed(history,a,b)?1:0;
    if(best&&repeat>=best.repeats)continue;
    const tail=swissPairings(rest.filter((_,idx)=>idx!==i),history),total=repeat+tail.repeats;
    if(!best||total<best.repeats){best={pairs:[[a,b],...tail.pairs],repeats:total};if(total===0)break}
  }
  return best||{pairs:[],repeats:0};
}
function swissRound(round,history=[]){
  const active=activeSwissPlayers(),arr=[],ranked=round===1?seasonSeededPlayers(active):standingsFor(active,history).map(r=>r.name),players=[...ranked];
  if(players.length%2){
    const bye=[...players].reverse().find(p=>!history.some(m=>m.a===p&&m.b==='Freilos'))||players.at(-1);
    players.splice(players.indexOf(bye),1);arr.push({a:bye,b:'Freilos',sa:1,sb:0,round,bracket:'swiss'});
  }
  swissPairings(players,history).pairs.forEach(([a,b])=>arr.push({a,b,sa:null,sb:null,round,bracket:'swiss'}));
  return arr;
}
function makeMatches(){
  const arr=[];
  if(state.settings.mode==='roundrobin'){
    const amount=Math.min(state.settings.groupCount||1,state.players.length),groups=Array.from({length:amount},()=>[]);shuffle(state.players).forEach((p,i)=>groups[i%amount].push(p));state.groups=groups;
    groups.forEach((players,group)=>{let ps=[...players];if(ps.length%2)ps.push(null);const count=ps.length;for(let round=1;round<count;round++){for(let i=0;i<count/2;i++){const a=ps[i],b=ps[count-1-i];if(a&&b)arr.push({a,b,sa:null,sb:null,round,group})}ps=[ps[0],ps[count-1],...ps.slice(1,count-1)]}});arr.sort((a,b)=>a.round-b.round||a.group-b.group);
  }else if(state.settings.mode==='swiss'){state.groups=[];arr.push(...swissRound(1,[]))}
  else addPairs(arr,shuffle(state.players),1,'upper');
  return arr;
}
$('#startBtn').addEventListener('click',()=>{state.withdrawn=[];delete state.savedToHistory;delete state.seasonImportedTo;state.settings={name:$('#tournamentName').value.trim()||'Dartturnier',mode:$('#mode').value,legs:+$('#legs').value,start:+$('#startScore').value,groupCount:+$('#groupCount').value,qualifiers:+$('#qualifiers').value,swissRounds:+$('#swissRounds').value};state.matches=makeMatches();state.started=true;save();renderTournament()});

function playerLosses(){const losses=Object.fromEntries(state.players.map(p=>[p,0]));state.matches.filter(m=>m.sa!==null&&m.b!=='Freilos').forEach(m=>{losses[m.sa>m.sb?m.b:m.a]++});return losses}
function standingsFor(players,matches=state.matches){return players.map(name=>{const played=matches.filter(m=>m.sa!==null&&(m.a===name||m.b===name));let w=0,lf=0,la=0;played.forEach(m=>{const own=m.a===name?m.sa:m.sb,other=m.a===name?m.sb:m.sa;lf+=own;la+=other;if(own>other)w++});return{name,p:played.length,w,l:played.length-w,lf,la,pts:w*2}}).sort((a,b)=>b.pts-a.pts||(b.lf-b.la)-(a.lf-a.la)||b.lf-a.lf)}
function standings(){return standingsFor(state.players)}
function modeName(){return state.settings.mode==='roundrobin'?'Jeder gegen jeden':state.settings.mode==='swiss'?'Schweizer System':state.settings.mode==='double'?'Doppel-K.-o.-Turnier':'K.-o.-Turnier'}
function champion(){
  if(state.settings.mode==='roundrobin')return state.groups?.length>1?'':state.matches.every(m=>m.sa!==null)?standings()[0]?.name:'';
  if(state.settings.mode==='swiss'){const active=activeSwissPlayers();if(active.length<=1&&state.matches.every(m=>m.sa!==null))return active[0]||standings()[0]?.name||'';return state.matches.every(m=>m.sa!==null)&&Math.max(...state.matches.map(m=>m.round||1))>=(state.settings.swissRounds||4)?standings()[0]?.name:''}
  const limit=state.settings.mode==='double'?2:1,losses=playerLosses(),active=state.players.filter(p=>losses[p]<limit);
  return active.length===1&&state.matches.every(m=>m.sa!==null)?active[0]:'';
}
function renderTournament(){
  if(!state.started){$('#setupSection').classList.remove('hidden');$('#tournamentSection').classList.add('hidden');return}
  const noBracket=state.settings.mode==='roundrobin'||state.settings.mode==='swiss';
  $('#setupSection').classList.add('hidden');$('#tournamentSection').classList.remove('hidden');$('#bracketTab').classList.toggle('hidden',noBracket);
  if(noBracket&&$('#bracketTab').classList.contains('active')){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelector('[data-tab="matches"]').classList.add('active');$('#matchesView').classList.remove('hidden');$('#bracketView').classList.add('hidden');$('#tableView').classList.add('hidden')}
  $('#liveTitle').textContent=state.settings.name;$('#liveMeta').textContent=`${state.players.length} Spieler · ${modeName()} · ${state.settings.start}`;
  const done=state.matches.filter(m=>m.sa!==null).length;$('#progressText').textContent=Math.round(done/state.matches.length*100)+'%';
  $('#matchList').innerHTML=state.matches.map((m,i)=>`<article class="match ${m.sa!==null?'done':''}"><div class="match-no">${m.group!==undefined?'Gruppe '+String.fromCharCode(65+m.group)+' · ':''}Runde ${m.round} · ${m.bracket==='lower'?'Verlierer':m.bracket==='grand'?'Finale':'Spiel'} ${String(i+1).padStart(2,'0')}</div><div class="players-match"><span class="${m.sa>m.sb?'winner-player':''}">${esc(m.a)}</span><b>${m.sa===null?'VS':m.sa+' : '+m.sb}</b><span class="${m.sb>m.sa?'winner-player':''}">${esc(m.b)}</span></div><div class="score-controls">${m.b==='Freilos'?'Weiter':`<select data-sa="${i}">${options(m.sa)}</select><span>:</span><select data-sb="${i}">${options(m.sb)}</select><button data-save="${i}">✓</button>`}</div></article>`).join('');
  renderTable();renderBracket();renderQualification();renderWithdrawCard();const winner=champion();$('#winnerCard').classList.toggle('hidden',!winner);if(winner){$('#winnerName').textContent=winner;saveTournamentToHistory()}renderSeasonImport(winner);save();
}
function options(current){let s='<option value="">–</option>';for(let i=0;i<=state.settings.legs;i++)s+=`<option ${current===i?'selected':''}>${i}</option>`;return s}
function renderWithdrawCard(){
  const card=$('#withdrawCard');if(!card)return;
  const visible=state.started&&state.settings.mode==='swiss'&&!champion();
  card.classList.toggle('hidden',!visible);if(!visible)return;
  const active=activeSwissPlayers(),withdrawn=withdrawnPlayers();
  const entered=new Set(state.players.map(p=>p.toLowerCase())),suggestions=seasonMembers(selectedSeason()).filter(p=>!entered.has(p.toLowerCase()));
  card.innerHTML=`<div><h3>Ein-/Ausstieg im Schweizer System</h3><p>Nach einer abgeschlossenen Runde kannst du Spieler aus dem weiteren Turnier nehmen oder neue Spieler ab der nächsten ungespielten Runde hinzufügen. Danach wird diese Runde neu gepaart.</p>${withdrawn.length?`<div class="withdrawn-list">Ausgestiegen: ${withdrawn.map(p=>`<span>${esc(p)}</span>`).join('')}</div>`:''}</div><div class="swiss-change-actions"><div class="withdraw-actions"><select id="withdrawPlayerSelect">${active.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select><button id="withdrawPlayerBtn" class="danger" ${active.length<1?'disabled':''}>Spieler steigt aus</button></div><div class="withdraw-actions"><input id="joinPlayerName" placeholder="Neuer Spieler" list="lateJoinSuggestions"><datalist id="lateJoinSuggestions">${suggestions.map(p=>`<option value="${esc(p)}"></option>`).join('')}</datalist><button id="joinPlayerBtn" class="secondary">Spieler steigt ein</button></div></div>`;
}
function canRebuildSwissRound(){
  const round=Math.max(...state.matches.map(m=>m.round||1)),current=state.matches.filter(m=>(m.round||1)===round),roundStarted=current.some(m=>m.sa!==null&&m.b!=='Freilos'),roundOpen=current.some(m=>m.sa===null);
  if(roundStarted&&roundOpen){alert('Bitte die aktuelle Runde erst fertig spielen. Danach kann die nächste Runde neu gepaart werden.');return null}
  return{round,current,roundStarted,roundOpen};
}
function rebuildSwissRound(round){
  state.matches=state.matches.filter(m=>(m.round||1)!==round);
  if(round<=(state.settings.swissRounds||4)&&activeSwissPlayers().length>1)state.matches.push(...swissRound(round,state.matches));
}
function withdrawSwissPlayer(name){
  if(!state.started||state.settings.mode!=='swiss'||!name)return;
  state.withdrawn=state.withdrawn||[];if(state.withdrawn.includes(name))return;
  const status=canRebuildSwissRound();if(!status)return;
  const {round,roundStarted,current}=status,hasOpenMatch=current.some(m=>(m.a===name||m.b===name));
  state.withdrawn.push(name);
  if(!roundStarted||hasOpenMatch)rebuildSwissRound(round);
  save();renderTournament();
}
function joinSwissPlayer(name){
  name=(name||'').trim();if(!state.started||state.settings.mode!=='swiss'||!name)return;
  if(state.players.some(p=>p.toLowerCase()===name.toLowerCase())){alert('Dieser Spieler ist bereits im Turnier eingetragen.');return}
  const status=canRebuildSwissRound();if(!status)return;
  const {round,roundStarted}=status,targetRound=roundStarted?round+1:round;
  if(targetRound>(state.settings.swissRounds||4)){alert('Es gibt keine weitere Schweizer Runde mehr, in die der Spieler einsteigen kann.');return}
  state.players.push(name);state.players=sortBySeasonWins(state.players);
  const season=selectedSeason();if(season&&!seasonMembers(season).some(p=>p.toLowerCase()===name.toLowerCase()))saveSeasonMembers(season,[...seasonMembers(season),name]);
  rebuildSwissRound(targetRound);
  save();renderTournament();
}
function advanceElimination(){
  if(state.settings.mode==='roundrobin')return;
  if(state.settings.mode==='swiss'){
    const round=Math.max(...state.matches.map(m=>m.round||1)),current=state.matches.filter(m=>(m.round||1)===round);
    if(current.some(m=>m.sa===null)||round>=(state.settings.swissRounds||4)||state.matches.some(m=>(m.round||1)===round+1))return;
    if(activeSwissPlayers().length<2)return;
    state.matches.push(...swissRound(round+1,state.matches));return;
  }
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
$('#withdrawCard').addEventListener('click',e=>{
  if(e.target.id==='withdrawPlayerBtn'){const name=$('#withdrawPlayerSelect')?.value;if(!name)return;if(!confirm(`${name} aus dem weiteren Turnier nehmen?`))return;withdrawSwissPlayer(name)}
  if(e.target.id==='joinPlayerBtn'){const name=$('#joinPlayerName')?.value;if(!name)return;if(!confirm(`${name} ab der nächsten Runde ins Turnier aufnehmen?`))return;joinSwissPlayer(name)}
});

function tableHtml(rows,title=''){return `<div class="group-table">${title?`<h3>${title}</h3>`:''}<div class="table-wrap"><table><thead><tr><th>#</th><th>Spieler</th><th>Sp.</th><th>S</th><th>N</th><th>Legs</th><th>Pkt.</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.name)}</b></td><td>${r.p}</td><td>${r.w}</td><td>${r.l}</td><td>${r.lf}:${r.la}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div></div>`}
function renderTable(){if(state.settings.mode==='roundrobin'&&state.groups?.length>1)$('#tableView').innerHTML=state.groups.map((players,i)=>tableHtml(standingsFor(players,state.matches.filter(m=>m.group===i)),`Gruppe ${String.fromCharCode(65+i)}`)).join('');else $('#tableView').innerHTML=tableHtml(standings())}
function qualifiedPlayers(){if(!state.groups?.length)return[];return state.groups.flatMap((players,i)=>standingsFor(players,state.matches.filter(m=>m.group===i)).slice(0,Math.min(state.settings.qualifiers||1,players.length)).map(r=>r.name))}
function renderQualification(){const visible=state.settings.mode==='roundrobin'&&state.groups?.length>1&&state.matches.every(m=>m.sa!==null),card=$('#qualificationCard');card.classList.toggle('hidden',!visible);if(visible)$('#qualifiedPlayers').innerHTML=qualifiedPlayers().map(p=>`<span>${esc(p)}</span>`).join('')}
$('#qualificationCard').addEventListener('click',e=>{const mode=e.target.dataset.finals;if(!mode)return;const qualified=qualifiedPlayers();if(qualified.length<2){alert('Für eine Finalrunde müssen mindestens zwei Spieler weiterkommen.');return}state.groupStage={players:[...state.players],groups:state.groups,matches:state.matches};state.players=qualified;state.groups=[];state.settings.mode=mode;state.settings.name+=' – Finalrunde';state.matches=makeMatches();save();renderTournament()});

function defaultPointSystem(){return appSettings.club?.pointSystem||{5:25,4:20,3:15,2:10,1:7,0:5}}
function loadSeasons(){try{const data=JSON.parse(localStorage.getItem(SEASON_KEY)||'{"seasons":[]}');return Array.isArray(data.seasons)?data:{seasons:[]}}catch{return{seasons:[]}}}
function persistSeasons(){localStorage.setItem(SEASON_KEY,JSON.stringify(seasonStore));if(selectedSeasonId)localStorage.setItem('tripleTwentySelectedSeason',selectedSeasonId)}
function createSeason(data={}){
  if(!isClubMode())return null;
  const half=currentHalfYear(),season={id:data.id||`season-${Date.now()}`,name:data.name||half.name,startDate:data.startDate||half.start,endDate:data.endDate||half.end,tournaments:data.tournaments||[],players:data.players||[],members:data.members||data.players||[],pointSystem:data.pointSystem||defaultPointSystem(),dropCount:+(data.dropCount??appSettings.club.dropResults??0),stats:data.stats||{},archived:!!data.archived,createdAt:data.createdAt||new Date().toISOString()};
  saveSeason(season);return season;
}
function saveSeason(season){if(!isClubMode()||!season)return season;const i=seasonStore.seasons.findIndex(s=>s.id===season.id);if(i>=0)seasonStore.seasons[i]=season;else seasonStore.seasons.push(season);selectedSeasonId=season.id;persistSeasons();renderSeasonView();return season}
function selectedSeason(){return seasonStore.seasons.find(s=>s.id===selectedSeasonId)||seasonStore.seasons.find(s=>!s.archived)||seasonStore.seasons[0]}
function seasonForDate(date=todayIso()){return isClubMode()?seasonStore.seasons.find(s=>!s.archived&&s.startDate<=date&&s.endDate>=date):null}
function deleteSeason(seasonId){
  if(!isClubMode())return null;
  const i=seasonStore.seasons.findIndex(s=>s.id===seasonId);if(i<0)return null;
  const deleted=seasonStore.seasons.splice(i,1)[0],next=seasonStore.seasons.find(s=>!s.archived)||seasonStore.seasons[0];
  selectedSeasonId=next?.id||'';if(selectedSeasonId)localStorage.setItem('tripleTwentySelectedSeason',selectedSeasonId);else localStorage.removeItem('tripleTwentySelectedSeason');
  localStorage.setItem(SEASON_KEY,JSON.stringify(seasonStore));renderSeasonView();return deleted;
}
function updateSeasonFromForm(){
  const season=selectedSeason(),data={name:$('#seasonName').value.trim()||currentHalfYear().name,startDate:$('#seasonStart').value,endDate:$('#seasonEnd').value,dropCount:+$('#seasonDrops').value};
  seasonFormOpen=false;
  if(!season)return createSeason(data);
  season.name=data.name;season.startDate=data.startDate;season.endDate=data.endDate;season.dropCount=data.dropCount;season.stats=calculateSeasonStatisticsSummary(season);saveSeason(season);return season;
}
function tournamentWins(name,matches){return matches.filter(m=>m.sa!==null&&m.b!=='Freilos'&&(m.a===name||m.b===name)&&((m.a===name&&m.sa>m.sb)||(m.b===name&&m.sb>m.sa))).length}
function tournamentLosses(name,matches){return matches.filter(m=>m.sa!==null&&m.b!=='Freilos'&&(m.a===name||m.b===name)&&((m.a===name&&m.sa<m.sb)||(m.b===name&&m.sb<m.sa))).length}
function pointsForWins(wins,pointSystem=defaultPointSystem()){return pointSystem[Math.min(5,wins)]??0}
function buildCurrentTournamentRecord(){
  const rows=standings(),pointSystem=defaultPointSystem(),date=$('#seasonTournamentDate')?.value||todayIso(),stats={};
  document.querySelectorAll('[data-stat-player]').forEach(row=>{const p=row.dataset.statPlayer;stats[p]={max180:+(row.querySelector('[data-stat-180]')?.value||0),checkout:+(row.querySelector('[data-stat-checkout]')?.value||0)}});
  const results=state.players.map(name=>{const wins=tournamentWins(name,state.matches),losses=tournamentLosses(name,state.matches),row=rows.find(r=>r.name===name)||{};return{name,wins,losses,rank:(rows.findIndex(r=>r.name===name)+1)||0,legsFor:row.lf||0,legsAgainst:row.la||0,points:pointsForWins(wins,pointSystem),max180:stats[name]?.max180||0,checkout:stats[name]?.checkout||0}});
  return{id:`tournament-${Date.now()}`,name:state.settings.name||'Turnier',date,mode:state.settings.mode,players:[...state.players],participantCount:state.players.length,winner:rows[0]?.name||'',top3:rows.slice(0,3).map(r=>r.name),settings:{...state.settings},matches:state.matches.map(m=>({...m})),results,createdAt:new Date().toISOString()};
}
function loadTournamentHistory(){try{const data=JSON.parse(localStorage.getItem(TOURNAMENT_HISTORY_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}
function saveTournamentToHistory(){
  if(state.savedToHistory||!state.matches?.length||!state.matches.every(m=>m.sa!==null))return;
  const history=loadTournamentHistory(),record=buildCurrentTournamentRecord();history.push(record);localStorage.setItem(TOURNAMENT_HISTORY_KEY,JSON.stringify(history));state.savedToHistory=record.id;save();
}
function exportCurrentTournamentJson(){const record=state.savedToHistory?loadTournamentHistory().find(t=>t.id===state.savedToHistory)||buildCurrentTournamentRecord():buildCurrentTournamentRecord();downloadFile(`${(record.name||'Turnier').replaceAll(' ','_')}.json`,'application/json',JSON.stringify(record,null,2))}
function seasonMembers(season=selectedSeason()){return [...new Set((season?.members!==undefined?season.members:season?.players)||[])].sort((a,b)=>a.localeCompare(b,'de'))}
function saveSeasonMembers(season,names){season.members=[...new Set(names.map(n=>n.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));season.players=[...new Set([...(season.tournaments||[]).flatMap(t=>t.players||[]),...season.members])].sort((a,b)=>a.localeCompare(b,'de'));saveSeason(season)}
function renderMemberSuggestions(){const list=$('#memberSuggestions'),season=selectedSeason();if(!list)return;const entered=new Set(state.players.map(p=>p.toLowerCase()));list.innerHTML=seasonMembers(season).filter(p=>!entered.has(p.toLowerCase())).map(p=>`<option value="${esc(p)}"></option>`).join('')}
function addSeasonMember(name){const season=selectedSeason();if(!season||!name.trim())return;const members=seasonMembers(season);if(members.some(p=>p.toLowerCase()===name.trim().toLowerCase())){alert('Dieses Mitglied ist bereits eingetragen.');return}saveSeasonMembers(season,[...members,name.trim()]);renderMemberSuggestions()}
function removeSeasonMember(name){const season=selectedSeason();if(!season)return;if(!confirm(`${name} aus der Mitgliederliste entfernen? Bereits gespeicherte Spieltage bleiben erhalten.`))return;saveSeasonMembers(season,seasonMembers(season).filter(p=>p!==name));renderMemberSuggestions()}
function addTournamentToSeason(seasonId,tournament){
  if(!isClubMode())return null;
  const season=seasonStore.seasons.find(s=>s.id===seasonId);if(!season)return null;
  season.tournaments=season.tournaments||[];season.members=[...new Set([...(season.members||season.players||[]),...(tournament.players||[])])].sort((a,b)=>a.localeCompare(b,'de'));season.players=[...new Set([...(season.players||[]),...(season.members||[]),...(tournament.players||[])])].sort((a,b)=>a.localeCompare(b,'de'));
  season.tournaments.push(tournament);season.tournaments.sort((a,b)=>a.date.localeCompare(b.date));season.stats=calculateSeasonStatisticsSummary(season);saveSeason(season);return season;
}
function deleteTournamentFromSeason(seasonId,tournamentId){
  if(!isClubMode())return null;
  const season=seasonStore.seasons.find(s=>s.id===seasonId);if(!season)return null;
  season.tournaments=(season.tournaments||[]).filter(t=>t.id!==tournamentId);
  season.players=[...new Set([...(season.members||[]),...(season.tournaments||[]).flatMap(t=>t.players||[])])].sort((a,b)=>a.localeCompare(b,'de'));
  season.stats=calculateSeasonStatisticsSummary(season);saveSeason(season);return season;
}
function manualTournamentPlayers(season=selectedSeason()){
  const rows=calculateSeasonStandings(season),wins=Object.fromEntries(rows.map(r=>[r.name,r.wins||0]));
  return seasonMembers(season).sort((a,b)=>(wins[b]||0)-(wins[a]||0)||a.localeCompare(b,'de'));
}
function renderManualTournamentForm(season=selectedSeason()){
  const button=`<div class="manual-toggle-row"><button type="button" class="secondary" id="toggleManualTournament">${manualTournamentOpen?'Nachtrag ausblenden':'+ Spieltag manuell nachtragen'}</button></div>`;
  if(!manualTournamentOpen)return button;
  const players=manualTournamentPlayers(season);
  if(!players.length)return button+`<div class="card slim-card manual-tournament-card"><h3>Spieltag manuell nachtragen</h3><p class="empty-line">Lege zuerst unter „Mitglieder“ die Spieler an. Danach kannst du hier den gespielten Schweizer Spieltag eintragen.</p></div>`;
  return button+`<form id="manualTournamentForm" class="card slim-card manual-tournament-card"><h3>Spieltag manuell nachtragen</h3><p>Für bereits gespielte Schweizer Turniere: Teilnehmer markieren und pro Spieler Siege, Niederlagen, 180er und höchstes Checkout eintragen. Die Saisonpunkte werden automatisch berechnet.</p><div class="grid"><label>Datum<input id="manualTournamentDate" type="date" value="${todayIso()}" required></label><label>Turniername<input id="manualTournamentName" value="Dienstagsturnier" maxlength="50"></label></div><div class="table-wrap manual-entry-table"><table><thead><tr><th>Dabei</th><th>Spieler</th><th>Siege</th><th>Niederlagen</th><th>180er</th><th>Checkout</th></tr></thead><tbody>${players.map(p=>`<tr data-manual-player="${esc(p)}"><td><input type="checkbox" data-manual-present checked></td><td><b>${esc(p)}</b></td><td><input type="number" min="0" max="20" value="0" data-manual-wins></td><td><input type="number" min="0" max="20" value="0" data-manual-losses></td><td><input type="number" min="0" max="99" value="0" data-manual-180></td><td><input type="number" min="0" max="170" value="0" data-manual-checkout></td></tr>`).join('')}</tbody></table></div><button class="primary" type="submit">SPIELTAG IN SAISON SPEICHERN <span>→</span></button></form>`;
}
function buildManualTournamentRecord(){
  const pointSystem=defaultPointSystem(),date=$('#manualTournamentDate')?.value||todayIso(),name=$('#manualTournamentName')?.value.trim()||'Dienstagsturnier';
  const results=[...document.querySelectorAll('[data-manual-player]')].filter(row=>row.querySelector('[data-manual-present]')?.checked).map(row=>{
    const player=row.dataset.manualPlayer,wins=+(row.querySelector('[data-manual-wins]')?.value||0),losses=+(row.querySelector('[data-manual-losses]')?.value||0),max180=+(row.querySelector('[data-manual-180]')?.value||0),checkout=+(row.querySelector('[data-manual-checkout]')?.value||0);
    return{name:player,wins,losses,max180,checkout,points:pointsForWins(wins,pointSystem),rank:0,legsFor:0,legsAgainst:0};
  }).sort((a,b)=>b.wins-a.wins||a.losses-b.losses||b.max180-a.max180||b.checkout-a.checkout||a.name.localeCompare(b.name,'de'));
  results.forEach((r,i)=>r.rank=i+1);
  return{id:`manual-tournament-${Date.now()}`,name,date,mode:'swiss',manual:true,players:results.map(r=>r.name),participantCount:results.length,winner:results[0]?.name||'',top3:results.slice(0,3).map(r=>r.name),settings:{mode:'swiss',name,manual:true},matches:[],results,createdAt:new Date().toISOString()};
}
function addManualTournamentFromForm(){
  const season=selectedSeason();if(!season)return;
  const tournament=buildManualTournamentRecord();
  if(tournament.participantCount<2){alert('Bitte mindestens zwei Teilnehmer markieren.');return}
  addTournamentToSeason(season.id,tournament);manualTournamentOpen=false;
  alert('Spieltag wurde manuell in die Saisonwertung übernommen.');
}
function calculateDropResults(entries,dropCount=0){
  const marked=entries.map((e,i)=>({...e,index:i,dropped:false}));
  [...marked].sort((a,b)=>a.points-b.points||Number(a.present)-Number(b.present)||a.date.localeCompare(b.date)).slice(0,Math.min(dropCount,marked.length)).forEach(e=>{marked[e.index].dropped=true});
  return marked;
}
function calculateSeasonStandings(season=selectedSeason()){
  if(!isClubMode()||!season)return[];
  const tournaments=season.tournaments||[],players=[...new Set([...(season.members||[]),...(season.players||[]),...tournaments.flatMap(t=>t.players||[])])].sort((a,b)=>a.localeCompare(b,'de'));
  return players.map(name=>{
    const entries=tournaments.map(t=>{const r=(t.results||[]).find(x=>x.name===name);return r?{tournamentId:t.id,date:t.date,name:t.name,present:true,points:r.points||0,wins:r.wins||0,losses:r.losses||0,max180:r.max180||0,checkout:r.checkout||0,rank:r.rank||0}:{tournamentId:t.id,date:t.date,name:t.name,present:false,points:0,wins:0,losses:0,max180:0,checkout:0,rank:0}});
    const dropped=calculateDropResults(entries,season.dropCount||0),used=dropped.filter(e=>!e.dropped);
    const played=entries.filter(e=>e.present),wins=entries.reduce((s,e)=>s+e.wins,0),losses=entries.reduce((s,e)=>s+e.losses,0),max180=entries.reduce((s,e)=>s+e.max180,0),checkout=Math.max(0,...entries.map(e=>e.checkout||0));
    return{name,totalPoints:entries.reduce((s,e)=>s+e.points,0),cleanPoints:used.reduce((s,e)=>s+e.points,0),played:played.length,wins,losses,max180,checkout,dropResults:dropped.filter(e=>e.dropped),entries:dropped,participation:tournaments.length?played.length/tournaments.length:0,winRate:wins+losses?wins/(wins+losses):0};
  }).sort((a,b)=>b.cleanPoints-a.cleanPoints||b.wins-a.wins||b.played-a.played||a.name.localeCompare(b.name,'de'));
}
function seasonStats(season=selectedSeason()){const rows=calculateSeasonStandings(season);return{max180:[...rows].sort((a,b)=>b.max180-a.max180)[0],checkout:[...rows].sort((a,b)=>b.checkout-a.checkout)[0],played:[...rows].sort((a,b)=>b.played-a.played)[0],participation:[...rows].sort((a,b)=>b.participation-a.participation||b.played-a.played)[0],wins:[...rows].sort((a,b)=>b.wins-a.wins)[0],winRate:[...rows].filter(r=>r.wins+r.losses>0).sort((a,b)=>b.winRate-a.winRate||b.wins-a.wins)[0]}}
function calculateSeasonStatisticsSummary(season=selectedSeason()){const s=seasonStats(season),pick=(row,key)=>row?{player:row.name,value:row[key]||0}:null;return{updatedAt:new Date().toISOString(),max180:pick(s.max180,'max180'),checkout:pick(s.checkout,'checkout'),played:pick(s.played,'played'),participation:s.participation?{player:s.participation.name,value:s.participation.participation}:null,wins:pick(s.wins,'wins'),winRate:s.winRate?{player:s.winRate.name,value:s.winRate.winRate}:null}}
function renderSeasonImport(winner){
  const card=$('#seasonImportCard');if(!card)return;const complete=!!winner&&state.matches.length&&state.matches.every(m=>m.sa!==null);
  card.classList.toggle('hidden',!complete);if(!complete)return;
  if(!isClubMode()){card.innerHTML='<h3>Turnier abgeschlossen</h3><p>Dieses Turnier wurde lokal gespeichert. Du kannst es als JSON exportieren.</p><button id="exportCurrentTournamentBtn" class="primary">TURNIER EXPORTIEREN <span>→</span></button>';return}
  const seasons=seasonStore.seasons.filter(s=>!s.archived);
  if(state.seasonImportedTo){const s=seasonStore.seasons.find(x=>x.id===state.seasonImportedTo);card.innerHTML=`<h3>Saisonwertung</h3><p>Dieses Turnier wurde bereits in ${esc(s?.name||'eine Saison')} übernommen.</p>`;return}
  if(!seasons.length){card.innerHTML='<h3>In Saisonwertung übernehmen</h3><p>Lege zuerst im Modul „Saison“ eine Saison an.</p><button id="seasonFromWinnerBtn" class="secondary">Zur Saisonverwaltung</button>';return}
  const current=seasonForDate(todayIso())||seasons[0],stats=state.players.map(p=>`<div class="season-stat-row" data-stat-player="${esc(p)}"><b>${esc(p)}</b><label>180er<input type="number" min="0" value="0" data-stat-180></label><label>Höchstes Checkout<input type="number" min="0" max="170" value="0" data-stat-checkout></label></div>`).join('');
  card.innerHTML=`<h3>In Saisonwertung übernehmen</h3><div class="grid"><label>Saison<select id="seasonImportSelect">${seasons.map(s=>`<option value="${esc(s.id)}" ${s.id===current.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Turnierdatum<input id="seasonTournamentDate" type="date" value="${todayIso()}"></label></div><div class="season-stats-input">${stats}</div><button id="addToSeasonBtn" class="primary">IN SAISONWERTUNG ÜBERNEHMEN <span>→</span></button>`;
}
function renderSeasonView(){
  if(!isClubMode()){$('#seasonSection')?.classList.add('hidden');return}
  const season=selectedSeason();$('#seasonSelect').innerHTML=seasonStore.seasons.length?seasonStore.seasons.map(s=>`<option value="${esc(s.id)}" ${s.id===season?.id?'selected':''}>${esc(s.name)}${s.archived?' · Archiv':''}</option>`).join(''):'<option value="">Keine Saison vorhanden</option>';
  renderSeasonHeader(season);
  renderSeasonForm(season);
  if(!season){$('#seasonOverview').innerHTML='<div class="empty-card">Noch keine Saison vorhanden. Erstelle die aktuelle Halbjahreswertung mit einem Klick.</div>';['seasonStandings','seasonMembers','seasonTournaments','seasonStats','seasonHonors','seasonPlayerDetail'].forEach(id=>$('#'+id).innerHTML='');renderMemberSuggestions();return}
  const rows=calculateSeasonStandings(season),current=seasonForDate(todayIso());
  $('#seasonOverview').innerHTML=`<div class="season-cards"><article><span>Aktuelle Saison</span><b>${esc(current?.name||'Keine aktive Saison')}</b></article><article><span>Geladene Saison</span><b>${esc(season.name)}${season.archived?' · Archiv':''}</b><small>${season.startDate} bis ${season.endDate}</small></article><article><span>Turniere</span><b>${season.tournaments?.length||0}</b></article><article><span>Streicher</span><b>${season.dropCount||0}</b></article></div>`;
  renderSeasonStandings(season,rows);renderSeasonMembers(season,rows);renderSeasonTournaments(season);renderSeasonStats(season,rows);renderSeasonHonors(season,rows);renderMemberSuggestions();
}
function renderSeasonHeader(season=selectedSeason()){
  const summary=$('#seasonCurrentSummary'),toggle=$('#toggleSeasonFormBtn');if(!summary)return;
  if(!season){summary.innerHTML='<span>Geladene Saison</span><b>Keine Saison</b><small>Erstelle die aktuelle Saison oder öffne die Einstellungen.</small>';if(toggle)toggle.textContent=seasonFormOpen?'Formular ausblenden':'Neue Saison';return}
  summary.innerHTML=`<span>Geladene Saison</span><b>${esc(season.name)}${season.archived?' · Archiv':''}</b><small>${esc(season.startDate)} bis ${esc(season.endDate)} · ${season.tournaments?.length||0} Spieltage · ${season.dropCount||0} Streicher</small>`;
  if(toggle)toggle.textContent=seasonFormOpen?'Bearbeitung ausblenden':'Saison bearbeiten';
}
function renderSeasonForm(season=selectedSeason()){
  const h=currentHalfYear(),s=season||{name:h.name,startDate:h.start,endDate:h.end,dropCount:0};
  $('#seasonForm').classList.toggle('hidden',!seasonFormOpen);
  $('#seasonFormTitle').textContent=season?'Geladene Saison bearbeiten':'Neue Saison erstellen';
  $('#seasonFormSubmit').innerHTML=season?'SAISON-ÄNDERUNGEN SPEICHERN <span>→</span>':'SAISON SPEICHERN <span>→</span>';
  $('#seasonName').value=s.name||h.name;$('#seasonStart').value=s.startDate||h.start;$('#seasonEnd').value=s.endDate||h.end;$('#seasonDrops').value=String(s.dropCount??0);
}
function renderSeasonStandings(season=selectedSeason(),rows=calculateSeasonStandings(season)){
  $('#seasonStandings').innerHTML=`<div class="table-wrap"><table><thead><tr><th>#</th><th>Spieler</th><th>Gesamt</th><th>Bereinigt</th><th>Turniere</th><th>Siege</th><th>Niederl.</th><th>180er</th><th>High Finish</th><th>Streicher</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-season-player="${esc(r.name)}"><td>${i+1}</td><td><button class="link-btn" data-season-player="${esc(r.name)}">${esc(r.name)}</button></td><td>${r.totalPoints}</td><td><b>${r.cleanPoints}</b></td><td>${r.played}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.max180}</td><td>${r.checkout}</td><td>${r.dropResults.map(e=>`<span class="drop-pill">${e.present?e.points:0}</span>`).join(' ')||'–'}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderSeasonMembers(season=selectedSeason(),rows=calculateSeasonStandings(season)){
  const wins=Object.fromEntries(rows.map(r=>[r.name,r.wins||0])),members=seasonMembers(season).sort((a,b)=>(wins[b]||0)-(wins[a]||0)||a.localeCompare(b,'de'));
  $('#seasonMembers').innerHTML=`<div class="card slim-card"><h3>Mitglieder</h3><p>Diese Liste wird für neue Dienstagsturniere als Setzliste verwendet: mehr Saison-Siege = weiter oben.</p><form id="memberForm" class="player-form"><input id="memberName" placeholder="Mitgliedsname" maxlength="30" autocomplete="off"><button type="submit">+ Mitglied</button></form><div class="member-list">${members.map((p,i)=>`<div class="member-row"><b><span>${i+1}</span>${esc(p)}</b><small>${wins[p]||0} Saison-Siege</small><button class="danger" data-remove-member="${esc(p)}">Entfernen</button></div>`).join('')||'<p class="empty-line">Noch keine Mitglieder eingetragen.</p>'}</div></div>`;
}
function renderSeasonTournaments(season=selectedSeason()){
  const tournaments=season?.tournaments||[],list=tournaments.length?`<div class="match-list">${tournaments.map(t=>`<article class="match season-match"><div class="match-no">${esc(t.date)} · ${t.participantCount} Teilnehmer${t.manual?' · Manuell':''}</div><div><b>${esc(t.name)}</b><p>Sieger: ${esc(t.winner||'–')} · Top 3: ${(t.top3||[]).map(esc).join(', ')||'–'}</p><div class="season-detail hidden" id="details-${esc(t.id)}">${(t.results||[]).sort((a,b)=>a.rank-b.rank).map(r=>`<span>${r.rank}. ${esc(r.name)} · ${r.wins}S/${r.losses}N · ${r.points} Pkt.${r.max180?` · ${r.max180}x180`:''}${r.checkout?` · HF ${r.checkout}`:''}</span>`).join('')}</div></div><div class="season-match-actions"><button class="secondary" data-tournament-detail="${esc(t.id)}">Details anzeigen</button><button class="danger" data-delete-tournament="${esc(t.id)}">Löschen</button></div></article>`).join('')}</div>`:'<div class="empty-card">Noch keine Turniere in dieser Saison.</div>';
  $('#seasonTournaments').innerHTML=renderManualTournamentForm(season)+list;
}
function renderSeasonStats(season=selectedSeason(),rows=calculateSeasonStandings(season)){
  const s=seasonStats(season),card=(title,row,value)=>`<article><span>${title}</span><b>${row?esc(row.name):'–'}</b><small>${value}</small></article>`;
  $('#seasonStats').innerHTML=`<div class="season-cards stats-cards">${card('Meiste 180er',s.max180,s.max180?.max180||0)}${card('Höchstes Checkout',s.checkout,s.checkout?.checkout||0)}${card('Meiste Teilnahmen',s.played,s.played?.played||0)}${card('Beste Teilnahmequote',s.participation,`${Math.round((s.participation?.participation||0)*100)}%`)}${card('Meiste Siege',s.wins,s.wins?.wins||0)}${card('Beste Siegquote',s.winRate,`${Math.round((s.winRate?.winRate||0)*100)}%`)}</div>`;
}
function renderSeasonHonors(season=selectedSeason(),rows=calculateSeasonStandings(season)){
  const s=seasonStats(season);$('#seasonHonors').innerHTML=`<div class="honors"><article><span>🥇</span><b>Vereinsmeister</b><p>${esc(rows[0]?.name||'–')}</p></article><article><span>🥈</span><b>Vizemeister</b><p>${esc(rows[1]?.name||'–')}</p></article><article><span>🥉</span><b>Platz 3</b><p>${esc(rows[2]?.name||'–')}</p></article><article><span>🎯</span><b>Meiste 180er</b><p>${esc(s.max180?.name||'–')}</p></article><article><span>🔥</span><b>Höchstes Checkout</b><p>${esc(s.checkout?.name||'–')} · ${s.checkout?.checkout||0}</p></article><article><span>📅</span><b>Beste Teilnahmequote</b><p>${esc(s.participation?.name||'–')} · ${Math.round((s.participation?.participation||0)*100)}%</p></article></div>`;
}
function renderPlayerSeasonDetail(name){
  const season=selectedSeason(),row=calculateSeasonStandings(season).find(r=>r.name===name);if(!row)return;
  $('#seasonPlayerDetail').innerHTML=`<div class="card player-detail"><button class="secondary close-detail">Schließen</button><h3>${esc(name)}</h3><p>Teilnahmequote: ${Math.round(row.participation*100)}% · Siege: ${row.wins} · Niederlagen: ${row.losses} · 180er: ${row.max180} · High Finish: ${row.checkout}</p><div class="table-wrap"><table><thead><tr><th>Datum</th><th>Turnier</th><th>Status</th><th>S/N</th><th>Punkte</th><th>180er</th><th>Checkout</th></tr></thead><tbody>${row.entries.map(e=>`<tr class="${e.dropped?'dropped-row':''}"><td>${e.date}</td><td>${esc(e.name)}</td><td>${e.present?'Gespielt':'Fehltermin'}${e.dropped?' · gestrichen':''}</td><td>${e.wins}/${e.losses}</td><td>${e.points}</td><td>${e.max180}</td><td>${e.checkout}</td></tr>`).join('')}</tbody></table></div></div>`;$('#seasonPlayerDetail').scrollIntoView({behavior:'smooth',block:'start'});
}
function exportSeasonJson(){const season=selectedSeason();if(!season)return;downloadFile(`${season.name.replaceAll(' ','_')}.json`,'application/json',JSON.stringify(season,null,2))}
function exportStandingsCsv(){const season=selectedSeason();if(!season)return;const rows=calculateSeasonStandings(season),head=['Platz','Spieler','Gesamtpunkte','Bereinigte Punkte','Turniere','Siege','Niederlagen','180er','Höchstes Checkout'];const csv=[head.join(';'),...rows.map((r,i)=>[i+1,r.name,r.totalPoints,r.cleanPoints,r.played,r.wins,r.losses,r.max180,r.checkout].map(v=>`"${String(v).replaceAll('"','""')}"`).join(';'))].join('\n');downloadFile(`${season.name.replaceAll(' ','_')}_rangliste.csv`,'text/csv;charset=utf-8',csv)}

function hideMainSections(){['dashboardSection','settingsSection','seasonSection','setupSection','tournamentSection'].forEach(id=>$('#'+id)?.classList.add('hidden'))}
function renderNavigation(){
  $('.club-settings-block')?.classList.remove('hidden');
}
function renderDashboard(){
  if(!$('#dashboardCards')||!$('#dashboardPanel'))return;
  const rows=isClubMode()?calculateSeasonStandings().slice(0,3):[],history=loadTournamentHistory().slice(-5).reverse(),season=selectedSeason(),clubName=appSettings.club.name;
  const cards=isClubMode()?[
    ['🎯','Neues Turnier','Schweizer System oder anderer Modus','showTournamentBtn'],
    ['🏆','Aktuelle Saison',season?`${season.name} · ${season.tournaments?.length||0} Spieltage`:'Saison anlegen','showSeasonBtn'],
    ['📊','Statistiken','Rangliste und Ehrungen','showSeasonBtn'],
    ['👥','Mitglieder','Spieler im aktuellen Turnier verwalten','showTournamentBtn'],
    ['🕘','Turnierhistorie',`${history.length} gespeicherte Turniere`,'showDashboardBtn'],
    ['⚙','Einstellungen',clubName||'Verein konfigurieren','showSettingsBtn']
  ]:[
    ['🎯','Neues Turnier','Einzelturnier starten','showTournamentBtn'],
    ['🕘','Letzte Turniere',`${history.length} gespeicherte Turniere`,'showDashboardBtn'],
    ['👥','Spieler','Spieler fürs aktuelle Turnier','showTournamentBtn'],
    ['⬇','Export','Turniere als JSON sichern','showDashboardBtn'],
    ['⚙','Einstellungen','Modus und Design','showSettingsBtn']
  ];
  $('#dashboardCards').innerHTML=cards.map(c=>`<button class="dash-card" data-nav-click="${c[3]}"><span>${c[0]}</span><b>${esc(c[1])}</b><small>${esc(c[2])}</small></button>`).join('');
  const top=isClubMode()?`<section class="card slim-card"><h3>${esc(clubName||'Vereinsmodus')}</h3><p>${season?`Aktuelle/geladene Saison: ${esc(season.name)}`:'Noch keine Saison angelegt.'}</p>${rows.length?`<div class="table-wrap"><table><thead><tr><th>Platz</th><th>Spieler</th><th>Punkte</th><th>Teilnahmen</th><th>Siege</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td><b>${esc(r.name)}</b></td><td>${r.cleanPoints}</td><td>${r.played}</td><td>${r.wins}</td></tr>`).join('')}</tbody></table></div>`:'<p>Noch keine Rangliste vorhanden.</p>'}</section>`:
    `<section class="card slim-card"><h3>Letzte Turniere</h3>${history.length?`<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Turnier</th><th>Modus</th><th>Sieger</th><th>Teilnehmer</th></tr></thead><tbody>${history.map(t=>`<tr><td>${esc(t.date||'')}</td><td><b>${esc(t.name)}</b></td><td>${esc(t.mode)}</td><td>${esc(t.winner||'–')}</td><td>${t.participantCount||0}</td></tr>`).join('')}</tbody></table></div>`:'<p>Noch keine abgeschlossenen Turniere gespeichert.</p>'}</section>`;
  $('#dashboardPanel').innerHTML=top;
}
function showDashboard(){showTournament()}
function showSettings(){hideMainSections();$('#settingsSection').classList.remove('hidden');renderSettingsForm();renderNavigation()}
function renderSettingsForm(){
  $('#settingsMode').value='club';$('#settingsDefaultMode').value=appSettings.tournament.defaultMode||'swiss';$('#settingsDefaultFormat').value=appSettings.tournament.defaultFormat||'single';$('#settingsDefaultLegs').value=String(appSettings.tournament.defaultLegs||2);
  $('#settingsClubName').value=appSettings.club.name||'';$('#settingsClubLogo').value=appSettings.club.logo||'';$('#settingsClubColor').value=appSettings.club.color||appSettings.theme.primary;$('#settingsSeasonMode').value=appSettings.club.seasonMode||'halfyear';$('#settingsDropResults').value=String(appSettings.club.dropResults??4);
  [5,4,3,2,1,0].forEach(n=>{$(`#points${n}`).value=appSettings.club.pointSystem[n]});
  $('#themePrimary').value=appSettings.theme.primary;$('#themeBackground').value=appSettings.theme.background;$('#themeCard').value=appSettings.theme.card;$('#themeAccent').value=appSettings.theme.accent;$('#themeText').value=appSettings.theme.text;renderNavigation();
}
function applyTournamentDefaults(){if($('#mode'))$('#mode').value=appSettings.tournament.defaultMode||'swiss';if($('#legs'))$('#legs').value=String(appSettings.tournament.defaultLegs||2);toggleModeOptions()}
function renderModeGate(){}

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
  if(state.settings.mode==='roundrobin'||state.settings.mode==='swiss'){$('#bracketGrid').innerHTML='';return}
  if(state.settings.mode==='knockout'){$('#bracketGrid').innerHTML=singleBracket();return}
  const upperRounds=Math.max(1,Math.ceil(Math.log2(state.players.length))),lowerRounds=Math.max(1,upperRounds*2-2);
  const upperStages=projectedUpper(upperRounds),lowerStages=projectedLower(lowerRounds,upperStages,upperRounds),realFinal=state.matches.find(m=>m.bracket==='grand');
  const projectedFinal={a:knownWinner(upperStages.at(-1)?.[0])||'Sieger Gewinnerbaum',b:knownWinner(lowerStages.at(-1)?.[0])||'Sieger Verliererbaum',sa:null,sb:null,preview:true};
  const final=`<section class="grand-final"><span>🏆</span><h3>Großes Finale</h3>${bracketCard(realFinal||projectedFinal,'Finalist')}</section>`;
  $('#bracketGrid').innerHTML=`<div class="double-bracket-layout">${doubleLane('lower','Verliererrunde',lowerStages,lowerRounds,upperRounds)}${final}${doubleLane('upper','Gewinnerrunde',upperStages,upperRounds,upperRounds)}</div>`;
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#matchesView').classList.toggle('hidden',b.dataset.tab!=='matches');$('#bracketView').classList.toggle('hidden',b.dataset.tab!=='bracket');$('#tableView').classList.toggle('hidden',b.dataset.tab!=='table')}));
function showTournament(){hideMainSections();renderTournament();if(!state.started)$('#setupSection').classList.remove('hidden');else $('#tournamentSection').classList.remove('hidden');renderNavigation()}
function showSeason(){if(!isClubMode()){showDashboard();return}hideMainSections();$('#seasonSection').classList.remove('hidden');renderSeasonView();renderNavigation()}
function fillSeasonForm(){const h=currentHalfYear();$('#seasonName').value=h.name;$('#seasonStart').value=h.start;$('#seasonEnd').value=h.end;$('#seasonDrops').value='0'}
function closeMenu(){const hero=$('.hero'),btn=$('#menuToggle');hero?.classList.remove('nav-open');if(btn)btn.setAttribute('aria-expanded','false')}
$('#menuToggle')?.addEventListener('click',e=>{e.stopPropagation();const hero=$('.hero'),open=!hero.classList.contains('nav-open');hero.classList.toggle('nav-open',open);e.currentTarget.setAttribute('aria-expanded',String(open))});
document.addEventListener('click',e=>{if(!e.target.closest('.hero'))closeMenu()});
$('.main-actions')?.addEventListener('click',e=>{if(e.target.closest('button'))closeMenu()});
$('#showTournamentBtn').addEventListener('click',showTournament);
$('#showSeasonBtn').addEventListener('click',showSeason);
$('#showSettingsBtn').addEventListener('click',showSettings);
$('#settingsForm').addEventListener('submit',e=>{e.preventDefault();updateSettings({appName:'Triple20',mode:$('#settingsMode').value,club:{enabled:$('#settingsMode').value==='club',name:$('#settingsClubName').value.trim(),logo:$('#settingsClubLogo').value.trim(),color:$('#settingsClubColor').value,seasonMode:$('#settingsSeasonMode').value,dropResults:+$('#settingsDropResults').value,pointSystem:{5:+$('#points5').value,4:+$('#points4').value,3:+$('#points3').value,2:+$('#points2').value,1:+$('#points1').value,0:+$('#points0').value}},tournament:{defaultMode:$('#settingsDefaultMode').value,defaultFormat:$('#settingsDefaultFormat').value,defaultLegs:+$('#settingsDefaultLegs').value},theme:{primary:$('#themePrimary').value,background:$('#themeBackground').value,card:$('#themeCard').value,accent:$('#themeAccent').value,text:$('#themeText').value}});applyTournamentDefaults();showDashboard()});
$('#createCurrentSeasonBtn').addEventListener('click',()=>{const h=currentHalfYear(),existing=seasonStore.seasons.find(s=>s.name===h.name);seasonFormOpen=false;if(existing){selectedSeasonId=existing.id;persistSeasons();renderSeasonView();return}createSeason({name:h.name,startDate:h.start,endDate:h.end,dropCount:+$('#seasonDrops').value||0})});
$('#toggleSeasonFormBtn').addEventListener('click',()=>{seasonFormOpen=!seasonFormOpen;renderSeasonView()});
$('#seasonForm').addEventListener('submit',e=>{e.preventDefault();updateSeasonFromForm()});
$('#seasonSelect').addEventListener('change',e=>{selectedSeasonId=e.target.value;seasonFormOpen=false;manualTournamentOpen=false;persistSeasons();renderSeasonView()});
$('#archiveSeasonBtn').addEventListener('click',()=>{const season=selectedSeason();if(!season)return;if(!confirm(`${season.name} archivieren?`))return;season.archived=true;saveSeason(season)});
$('#deleteSeasonBtn').addEventListener('click',()=>{const season=selectedSeason();if(!season)return;if(!confirm(`Saison „${season.name}“ wirklich endgültig löschen? Alle Spieltage und Saisonpunkte dieser Saison werden entfernt.`))return;deleteSeason(season.id)});
document.querySelectorAll('.season-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.season-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');['standings','members','tournaments','stats','honors'].forEach(tab=>$('#season'+tab[0].toUpperCase()+tab.slice(1)).classList.toggle('hidden',b.dataset.seasonTab!==tab))}));
$('#seasonStandings').addEventListener('click',e=>{const el=e.target.closest('[data-season-player]');if(el)renderPlayerSeasonDetail(el.dataset.seasonPlayer)});
$('#seasonMembers').addEventListener('submit',e=>{if(e.target.id!=='memberForm')return;e.preventDefault();addSeasonMember($('#memberName').value);$('#memberName').value=''});
$('#seasonMembers').addEventListener('click',e=>{const name=e.target.dataset.removeMember;if(name)removeSeasonMember(name)});
$('#seasonTournaments').addEventListener('submit',e=>{if(e.target.id!=='manualTournamentForm')return;e.preventDefault();addManualTournamentFromForm()});
$('#seasonTournaments').addEventListener('click',e=>{
  const detailId=e.target.dataset.tournamentDetail,deleteId=e.target.dataset.deleteTournament;
  if(e.target.id==='toggleManualTournament'){manualTournamentOpen=!manualTournamentOpen;renderSeasonTournaments();return}
  if(detailId){const box=document.getElementById(`details-${detailId}`);if(box){box.classList.toggle('hidden');e.target.textContent=box.classList.contains('hidden')?'Details anzeigen':'Details ausblenden'}return}
  if(deleteId){const season=selectedSeason(),tournament=season?.tournaments?.find(t=>t.id===deleteId);if(!season||!tournament)return;if(!confirm(`Spieltag „${tournament.name}“ vom ${tournament.date} wirklich aus der Saison löschen?`))return;deleteTournamentFromSeason(season.id,deleteId)}
});
$('#seasonPlayerDetail').addEventListener('click',e=>{if(e.target.classList.contains('close-detail'))$('#seasonPlayerDetail').innerHTML=''});
$('#winnerCard').addEventListener('click',e=>{if(e.target.id==='exportCurrentTournamentBtn'){exportCurrentTournamentJson();return}if(e.target.id==='seasonFromWinnerBtn'){showSeason();return}if(e.target.id!=='addToSeasonBtn')return;const id=$('#seasonImportSelect')?.value;if(!id)return;const tournament=buildCurrentTournamentRecord();addTournamentToSeason(id,tournament);state.seasonImportedTo=id;save();renderSeasonImport(champion());alert('Turnier wurde in die Saisonwertung übernommen.')});
$('#exportSeasonJsonBtn').addEventListener('click',exportSeasonJson);
$('#exportStandingsCsvBtn').addEventListener('click',exportStandingsCsv);
function reset(){if(state.started&&!confirm('Das aktuelle Turnier wirklich löschen?'))return;Object.assign(state,{players:[],started:false,matches:[],settings:{}});delete state.seasonImportedTo;delete state.savedToHistory;save();location.reload()}
$('#resetBtn').onclick=reset;$('#finishReset').onclick=reset;applyTheme();applyTournamentDefaults();fillSeasonForm();renderPlayers();renderSettingsForm();renderNavigation();renderSeasonView();showTournament();
