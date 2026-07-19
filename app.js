const $=s=>document.querySelector(s);
const SETTINGS_KEY='triple20_settings';
const TOURNAMENT_HISTORY_KEY='triple20_tournaments';
const ACCESS_COUNT_KEY='triple20_access_count';
const ACCESS_DAILY_KEY='triple20_access_daily';
const ACCESS_SESSION_KEY='triple20_access_counted';
const SUPABASE_URL='https://hidjvylnxmtlvtiomktu.supabase.co';
const TRIPLE20_PUBLIC_URL='https://burkertmarkus-prog.github.io/triple20/';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_IzH5CLw7baFsaU005Bqh7w_lRMlrMLo';
const CLOUD_DATA_KEYS=['dartTournament','tripleTwentySeasons','tripleTwentySelectedSeason','triple20_settings','triple20_tournaments'];
let supabaseClient=null;
let T20_SUPPRESS_SYNC=false;
const nativeSetItem=localStorage.setItem.bind(localStorage),nativeRemoveItem=localStorage.removeItem.bind(localStorage);
localStorage.setItem=(key,value)=>{nativeSetItem(key,value);if(!T20_SUPPRESS_SYNC&&CLOUD_DATA_KEYS.includes(key)&&window.T20Cloud)window.T20Cloud.queueSync(key)};
localStorage.removeItem=key=>{nativeRemoveItem(key);if(!T20_SUPPRESS_SYNC&&CLOUD_DATA_KEYS.includes(key)&&window.T20Cloud)window.T20Cloud.queueSync(key)};
const defaultSettings={
  appName:'Triple20',
  mode:'club',
  club:{enabled:true,name:'',logo:'',seasonMode:'halfyear',pointSystem:{5:25,4:20,3:15,2:10,1:7,0:5},dropResults:4,color:'#0E6BFF'},
  tournament:{defaultMode:'swiss',defaultFormat:'single',defaultLegs:2},
  themeMode:'light',
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
const themeModes={
  light:{label:'Hell & freundlich',theme:{background:'#EEF5FF',card:'#FFFFFF',primary:'#0E6BFF',accent:'#55A7FF',text:'#122033'}},
  classic:{label:'Triple20 Blau',theme:{background:'#05070A',card:'#111820',primary:'#0E6BFF',accent:'#55A7FF',text:'#F7F7F7'}},
  midnight:{label:'Mitternacht',theme:{background:'#07111F',card:'#101B2A',primary:'#1683FF',accent:'#8FC4FF',text:'#F4F8FF'}},
  steel:{label:'Stahlgrau',theme:{background:'#E9EEF5',card:'#F9FBFF',primary:'#245B9A',accent:'#6D93C7',text:'#172233'}},
  warm:{label:'Warmup',theme:{background:'#FFF4E8',card:'#FFFFFF',primary:'#F97316',accent:'#FDBA74',text:'#23170F'}}
};
function themeModeForTheme(theme=appSettings.theme){return Object.entries(themeModes).find(([,m])=>Object.keys(m.theme).every(k=>String(m.theme[k]).toLowerCase()===String(theme?.[k]).toLowerCase()))?.[0]||appSettings.themeMode||'light'}
function applyTheme(){const t=appSettings.theme||defaultSettings.theme,r=document.documentElement;r.style.setProperty('--cream',t.background);r.style.setProperty('--paper',`${t.card}f2`);r.style.setProperty('--blue',t.primary);r.style.setProperty('--blue-2',t.primary);r.style.setProperty('--green',t.primary);r.style.setProperty('--orange',t.primary);r.style.setProperty('--accent',t.accent);r.style.setProperty('--ink',t.text);r.style.setProperty('--line','#CAD8EA');if(document.body)document.body.style.background=`radial-gradient(circle at 15% 0%, ${t.primary}22, transparent 34%), linear-gradient(180deg, #F8FBFF 0%, ${t.background} 48%, #FFFFFF 100%)`;document.title=`${appSettings.appName||'Triple20'} – Dartturniere`;const brand=$('.brand strong');if(brand)brand.innerHTML=esc(appSettings.appName||'Triple20').replace(/20/g,'<span>20</span>');const sub=$('#brandSubtitle');if(sub)sub.textContent=isClubMode()&&appSettings.club.name?appSettings.club.name:'Turnierleitung';const footer=$('#footerAppName');if(footer)footer.textContent=appSettings.appName||'Triple20'}
function shuffle(values){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function todayIso(){return new Date().toISOString().slice(0,10)}
function currentHalfYear(date=new Date()){const y=date.getFullYear(),h=date.getMonth()<6?'H1':'H2';return{year:y,half:h,name:`${y} ${h}`,start:`${y}-${h==='H1'?'01-01':'07-01'}`,end:`${y}-${h==='H1'?'06-30':'12-31'}`}}
function registerAccess(){
  let count=Math.max(0,parseInt(localStorage.getItem(ACCESS_COUNT_KEY)||'0',10)||0);
  if(sessionStorage.getItem(ACCESS_SESSION_KEY)!=='1'){
    count+=1;
    localStorage.setItem(ACCESS_COUNT_KEY,String(count));
    const daily=safeJsonParse(localStorage.getItem(ACCESS_DAILY_KEY)||'{}',{}),day=localDateKey();
    daily[day]=(parseInt(daily[day],10)||0)+1;
    localStorage.setItem(ACCESS_DAILY_KEY,JSON.stringify(daily));
    sessionStorage.setItem(ACCESS_SESSION_KEY,'1');
  }
  return count;
}
function localDateKey(date=new Date()){const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,'0'),day=String(date.getDate()).padStart(2,'0');return `${year}-${month}-${day}`}
function accessStats(now=new Date()){
  const daily=safeJsonParse(localStorage.getItem(ACCESS_DAILY_KEY)||'{}',{}),today=localDateKey(now);
  const weekStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const sumSince=start=>Object.entries(daily).reduce((sum,[day,value])=>sum+(day>=localDateKey(start)&&day<=today?(parseInt(value,10)||0):0),0);
  return{today:parseInt(daily[today],10)||0,week:sumSince(weekStart),month:sumSince(monthStart),total:Math.max(0,parseInt(localStorage.getItem(ACCESS_COUNT_KEY)||'0',10)||0)};
}
function renderAccessStats(){
  if(!isAdmin())return'';
  const stats=accessStats();
  return `<section class="access-stats" aria-label="Zugriffsstatistik"><h3>App-Aufrufe</h3><div class="access-stat-grid"><article><span>Heute</span><b>${stats.today}</b></article><article><span>Diese Woche</span><b>${stats.week}</b></article><article><span>Dieser Monat</span><b>${stats.month}</b></article><article><span>Insgesamt</span><b>${stats.total}</b></article></div><p class="view-note">Ein Aufruf pro Browsersitzung auf diesem Gerät.</p></section>`;
}
function downloadFile(name,type,content){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();URL.revokeObjectURL(a.href);a.remove()}
function requireSupabaseClient(){const client=window.T20Cloud?.client||supabaseClient;if(!client)throw new Error('Supabase-Client wurde nicht initialisiert.');return client}
function setLoginError(message=''){const box=$('#loginError');if(box){box.textContent=message;box.classList.toggle('hidden',!message)}}
function withTimeout(promise,ms,message){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))])}
function loadScript(src){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.src===src&&s.dataset.loaded==='1');if(existing){resolve();return}const s=document.createElement('script');s.src=src;s.async=true;s.dataset.dynamic='1';s.onload=()=>{s.dataset.loaded='1';resolve()};s.onerror=()=>reject(new Error(`Bibliothek konnte nicht geladen werden: ${src}`));document.head.appendChild(s)})}
async function ensureSupabaseLibrary(){
  if(window.supabase?.createClient)return;
  const sources=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','https://unpkg.com/@supabase/supabase-js@2'];
  let lastError=null;
  for(const src of sources){
    try{await withTimeout(loadScript(`${src}?t20=${Date.now()}`),8000,'Supabase-Bibliothek lädt zu lange.');if(window.supabase?.createClient)return}
    catch(e){lastError=e}
  }
  throw lastError||new Error('Die Supabase-Bibliothek konnte nicht geladen werden.');
}
function safeJsonParse(value,fallback=null){try{return JSON.parse(value)}catch{return fallback}}
function localValueForKey(key){const raw=localStorage.getItem(key);if(raw===null)return null;if(key==='tripleTwentySelectedSeason')return raw;return safeJsonParse(raw,raw)}
function hasMeaningfulLocalData(){return !!(state.players?.length||state.matches?.length||seasonStore.seasons?.length||loadTournamentHistory().length)}
function collectTriple20Data(){return Object.fromEntries(CLOUD_DATA_KEYS.map(k=>[k,localValueForKey(k)]))}
function backupTriple20Data(prefix='triple20_backup'){const data={createdAt:new Date().toISOString(),app:'Triple20',data:collectTriple20Data()};downloadFile(`${prefix}_${new Date().toISOString().slice(0,19).replaceAll(':','-')}.json`,'application/json',JSON.stringify(data,null,2));return data}
function applyTriple20Data(data){
  const visibleSection=['authSection','settingsSection','seasonSection','setupSection','tournamentSection'].find(id=>!$('#'+id)?.classList.contains('hidden'))||'';
  if(!data)return;
  T20_SUPPRESS_SYNC=true;
  try{
    for(const key of CLOUD_DATA_KEYS){
      if(!(key in data))continue;
      const value=data[key];
      if(value===null||value===undefined)localStorage.removeItem(key);
      else localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));
    }
  }finally{T20_SUPPRESS_SYNC=false}
  const incomingState=safeJsonParse(localStorage.getItem('dartTournament')||'null')||{players:[],started:false,matches:[],settings:{}};
  Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,incomingState);
  const seasons=loadSeasons();seasonStore.seasons=seasons.seasons||[];
  selectedSeasonId=localStorage.getItem('tripleTwentySelectedSeason')||'';
  appSettings=loadSettings();
  linkKnownMemberIds();
  applyTheme();applyTournamentDefaults();renderPlayers();renderSettingsForm();renderSeasonView();renderTournament();
  if(visibleSection==='authSection')showLogin();
  else if(visibleSection==='settingsSection')showSettings();
  else if(visibleSection==='seasonSection')showSeason();
  else if(visibleSection==='tournamentSection'||visibleSection==='setupSection')showTournament();
}
function backupPreview(data=collectTriple20Data()){const seasons=data.tripleTwentySeasons?.seasons||[],tournaments=data.triple20_tournaments||[],current=data.dartTournament||{};return `${seasons.length} Saison(en), ${tournaments.length} gespeicherte Turnier(e), aktuelles Turnier: ${current.started?'läuft':'nicht gestartet'}${current.players?.length?`, ${current.players.length} Spieler`:''}`;}
function setSyncStatus(text,cls='view-only'){const bar=$('#syncStatusBar'),label=$('#syncStatusText');if(!bar||!label)return;bar.className=`sync-status ${cls}`;label.textContent=text;const last=$('#syncLastSaved');if(last)last.textContent=T20Cloud?.lastSyncAt?`Letzte Synchronisierung: ${new Date(T20Cloud.lastSyncAt).toLocaleString('de-AT')}`:'Noch nicht synchronisiert'}
function isAdmin(){return !!window.T20Cloud?.isAdmin}
function isMember(){return !!window.T20Cloud?.user&&!isAdmin()}
function assertAdminAction(){if(isAdmin())return true;alert('Nur die Turnierleitung darf Daten ändern. Du bist aktuell im Nur-Ansicht-Modus.');return false}
function renderReadonlyMode(){
  const admin=isAdmin(),member=isMember(),guest=!admin&&!member,readonly=!admin;
  document.body.classList.toggle('view-only',readonly);
  document.body.classList.toggle('admin-mode',admin);
  document.body.classList.toggle('member-mode',member);
  document.body.classList.toggle('guest-mode',guest);
  ['seasonActionSelect','addToSeasonBtn'].forEach(id=>{$('#'+id)?.classList.toggle('hidden',readonly)});
  $('#showSettingsBtn')?.classList.toggle('hidden',!admin);
  $('#showSeasonBtn')?.classList.toggle('hidden',guest);
  const loginBtn=$('#showLoginBtn');if(loginBtn)loginBtn.textContent=admin?'Konto':member?'Mein Profil':'Anmelden';
  renderNavigation();
  if(readonly&&$('#settingsSection')&&!$('#settingsSection').classList.contains('hidden'))showLogin();
  if(guest&&$('#seasonSection')&&!$('#seasonSection').classList.contains('hidden'))showTournament();
}
function replaceCloudPanelHtml(panel,html){
  const active=document.activeElement,activeId=active?.id||'',selection=active&&typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null;
  const values=Object.fromEntries([...panel.querySelectorAll('input[id]')].filter(input=>input.type!=='file').map(input=>[input.id,input.value]));
  panel.innerHTML=html;
  Object.entries(values).forEach(([id,value])=>{const input=panel.querySelector(`#${id}`);if(input)input.value=value});
  const nextActive=activeId?panel.querySelector(`#${activeId}`):null;
  if(nextActive){nextActive.focus({preventScroll:true});if(selection&&typeof nextActive.setSelectionRange==='function')nextActive.setSelectionRange(selection[0],selection[1])}
}
function renderAdminMembers(){
  const c=T20Cloud,profiles=c.adminProfiles||[];
  const cards=profiles.map(profile=>{
    const adminProfile=profile.id===c.user?.id,name=profile.display_name||(adminProfile?'Turnierleitung':'Name noch nicht eingetragen'),nickname=profile.nickname||(adminProfile?'Administrator':'Spitzname fehlt'),initial=esc((profile.nickname||profile.display_name||(adminProfile?'A':'?')).trim().charAt(0).toUpperCase()||'?'),photo=c.adminProfileAvatars?.[profile.id],avatar=photo?`<img src="${esc(photo)}" alt="">`:initial;
    const joined=profile.created_at?new Date(profile.created_at).toLocaleDateString('de-AT'):'–';
    const online=c.onlineUserIds?.has(profile.id);
    return `<article class="admin-member-card ${adminProfile?'admin-account':''}"><span class="profile-avatar">${avatar}</span><div><strong>${esc(nickname)} <i class="online-dot ${online?'is-online':''}" title="${online?'Online':'Offline'}"></i></strong><span>${esc(name)}</span><small>${adminProfile?'Administratorkonto · ':''}${online?'Jetzt online · ':''}Registriert seit ${esc(joined)}</small></div></article>`;
  }).join('');
  return `<section class="admin-members"><div class="admin-section-heading"><div><h3>Registrierte Mitglieder</h3><p class="view-note">${profiles.length} Profil${profiles.length===1?'':'e'} vorhanden</p></div><button id="refreshMembersBtn" class="secondary" type="button" ${c.adminProfilesBusy?'disabled':''}>${c.adminProfilesBusy?'Wird geladen …':'Aktualisieren'}</button></div><div class="admin-member-grid">${cards||'<p class="view-note">Noch keine Mitgliederprofile vorhanden.</p>'}</div></section>`;
}
function renderCloudPanel(){
  const panel=$('#cloudAdminPanel');if(!panel||!window.T20Cloud)return;
  const c=T20Cloud,summary=backupPreview();
  if(c.authHandoffActive){panel.innerHTML=`<section class="auth-handoff"><span>✓</span><h3>Anmeldung erfolgreich</h3><p>Triple20 ist bereits in einem anderen Tab geöffnet. Dieser Tab wird geschlossen.</p><div><button id="closeAuthTabBtn" class="primary" type="button">DIESES FENSTER SCHLIESSEN</button><button id="continueAuthTabBtn" class="secondary" type="button">HIER WEITER</button></div></section>`;return}
  if(!c.session){replaceCloudPanelHtml(panel,`<div class="account-grid"><section><h3>Mitglieder-Anmeldung</h3><p class="view-note">Mit deiner beim Verein hinterlegten E-Mail-Adresse erhältst du einen einmaligen Anmeldelink.</p><p id="loginError" class="login-error">${esc(c.authError||'')}</p><p class="login-success ${c.authMessage?'':'hidden'}">${esc(c.authMessage||'')}</p><form id="memberLoginForm" class="member-login"><input id="memberEmail" type="email" placeholder="E-Mail-Adresse" autocomplete="email" required><button class="primary" type="submit">${c.magicLinkBusy?'Link wird gesendet …':'ANMELDELINK SENDEN'}</button></form></section><section><h3>Turnierleitung</h3><p class="view-note">Administratoren melden sich weiterhin mit Passwort an.</p><form id="adminLoginForm" class="cloud-login"><input id="adminEmail" type="email" placeholder="Admin-E-Mail" autocomplete="email" required><input id="adminPassword" type="password" placeholder="Passwort" autocomplete="current-password" required><button id="adminLoginBtn" class="secondary" type="submit">${c.loginBusy?'Wird angemeldet …':'Anmelden'}</button></form></section></div>`);return}
  if(!c.isAdmin){const p=c.profile||{},initial=esc((p.nickname||p.display_name||c.user?.email||'?').trim().charAt(0).toUpperCase()||'?'),avatar=c.avatarSignedUrl?`<img src="${esc(c.avatarSignedUrl)}" alt="Profilfoto">`:initial,nickname=p.nickname||'Spitzname noch nicht eingetragen';replaceCloudPanelHtml(panel,`<section class="member-profile"><div class="profile-heading"><div><span class="profile-avatar">${avatar}</span><div><h3>${esc(nickname)}</h3><p class="view-note">${esc(p.display_name||'Vor- und Zuname fehlen')} · ${esc(c.user?.email||'')}</p></div></div><button id="memberLogoutBtn" class="secondary" type="button">Abmelden</button></div><div class="avatar-actions"><label class="secondary avatar-upload">${c.avatarBusy?'Bild wird verarbeitet …':'Profilfoto auswählen'}<input id="profileAvatarInput" type="file" accept="image/jpeg,image/png,image/webp" ${c.avatarBusy?'disabled':''}></label>${p.avatar_url?`<button id="removeAvatarBtn" class="danger" type="button" ${c.avatarBusy?'disabled':''}>Foto entfernen</button>`:''}<small>JPEG, PNG oder WebP · wird auf 512 × 512 Pixel verkleinert · maximal 1 MB</small></div><p id="loginError" class="login-error">${esc(c.authError||'')}</p><p class="login-success ${c.authMessage?'':'hidden'}">${esc(c.authMessage||'')}</p><form id="memberProfileForm" class="profile-form"><label>Spitzname<input id="profileNickname" maxlength="30" value="${esc(p.nickname||'')}" placeholder="Öffentlicher Spielname" required></label><label>Vor- und Zuname<input id="profileDisplayName" maxlength="60" value="${esc(p.display_name||'')}" placeholder="z. B. Markus Mustermann" autocomplete="name" required></label><button class="primary" type="submit">${c.profileBusy?'Wird gespeichert …':'PROFIL SPEICHERN'}</button></form><p class="view-note">Der Spitzname wird bei Turnieren und Ranglisten angezeigt. Der vollständige Name bleibt im geschützten Profil.</p></section>`);return}
  panel.innerHTML=`${renderAdminMembers()}${renderAccessStats()}<h3>Online-Speicherung</h3><p class="view-note">${esc(summary)}</p><div class="cloud-actions"><button id="backupDownloadBtn" class="cloud-action-btn" type="button">Backup herunterladen</button><label class="cloud-action-btn backup-file">Backup einspielen<input id="backupImportInput" type="file" accept="application/json"></label><button id="uploadLocalBtn" class="cloud-action-btn" type="button">Lokale Daten in die Cloud übernehmen</button><button id="loadCloudBtn" class="cloud-action-btn" type="button">Cloud-Daten laden</button><button id="forceCloudBtn" class="cloud-action-btn danger-cloud" type="button">Cloud überschreiben</button><button id="adminLogoutBtn" class="cloud-action-btn" type="button">Abmelden</button></div>`;
}
async function handleBackupImport(file){
  if(!file||!isAdmin())return;
  const text=await file.text();let parsed;
  try{parsed=JSON.parse(text)}catch{alert('Die Backup-Datei ist kein gültiges JSON.');return}
  const data=parsed.data||parsed;
  if(!data||!CLOUD_DATA_KEYS.some(k=>k in data)){alert('Das Backup enthält keine erkennbaren Triple20-Daten.');return}
  const preview=backupPreview(data);
  backupTriple20Data('triple20_vor_import');
  if(!confirm(`Backup einspielen?\n\nInhalt: ${preview}\n\nDie aktuellen lokalen Daten wurden vorher als JSON gesichert.`))return;
  applyTriple20Data(data);
  await T20Cloud.syncAll({force:true});
  alert('Backup wurde lokal eingespielt und online gespeichert.');
}
const AvatarCrop={bitmap:null,zoom:1,panX:0,panY:0,drag:null};
function closeAvatarCrop(){AvatarCrop.bitmap?.close?.();Object.assign(AvatarCrop,{bitmap:null,zoom:1,panX:0,panY:0,drag:null});$('#avatarCropOverlay')?.remove()}
async function decodeAvatarImage(file){
  try{return await createImageBitmap(file)}catch{
    return await new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Das ausgewählte Bildformat konnte nicht geöffnet werden.'))};image.src=url});
  }
}
function drawAvatarCrop(){
  const canvas=$('#avatarCropCanvas'),bitmap=AvatarCrop.bitmap;if(!canvas||!bitmap)return;
  const size=canvas.width,scale=Math.max(size/bitmap.width,size/bitmap.height)*AvatarCrop.zoom,maxX=Math.max(0,(bitmap.width*scale-size)/2),maxY=Math.max(0,(bitmap.height*scale-size)/2);
  AvatarCrop.panX=Math.max(-maxX,Math.min(maxX,AvatarCrop.panX));AvatarCrop.panY=Math.max(-maxY,Math.min(maxY,AvatarCrop.panY));
  const context=canvas.getContext('2d');context.clearRect(0,0,size,size);context.drawImage(bitmap,(size-bitmap.width*scale)/2+AvatarCrop.panX,(size-bitmap.height*scale)/2+AvatarCrop.panY,bitmap.width*scale,bitmap.height*scale);
}
async function openAvatarCrop(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file?.type)){T20Cloud.authError='Bitte ein JPEG-, PNG- oder WebP-Bild auswählen.';renderCloudPanel();return}
  if(file.size>10*1024*1024){T20Cloud.authError='Das Ausgangsbild ist größer als 10 MB.';renderCloudPanel();return}
  closeAvatarCrop();AvatarCrop.bitmap=await decodeAvatarImage(file);AvatarCrop.zoom=1;AvatarCrop.panX=0;AvatarCrop.panY=0;
  document.body.insertAdjacentHTML('beforeend',`<div id="avatarCropOverlay" class="avatar-crop-overlay" role="dialog" aria-modal="true" aria-labelledby="avatarCropTitle"><section class="avatar-crop-dialog"><h3 id="avatarCropTitle">Profilbild ausrichten</h3><p>Verschiebe das Bild mit dem Finger oder der Maus. Mit dem Regler kannst du hineinzoomen.</p><div class="avatar-crop-frame"><canvas id="avatarCropCanvas" width="512" height="512"></canvas></div><label>Bildgröße<input id="avatarCropZoom" type="range" min="1" max="3" value="1" step="0.01"></label><div class="avatar-crop-actions"><button id="cancelAvatarCropBtn" class="secondary" type="button">Abbrechen</button><button id="saveAvatarCropBtn" class="primary" type="button">AUSSCHNITT ÜBERNEHMEN</button></div></section></div>`);
  const canvas=$('#avatarCropCanvas');drawAvatarCrop();
  canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture(event.pointerId);AvatarCrop.drag={id:event.pointerId,x:event.clientX,y:event.clientY}});
  canvas.addEventListener('pointermove',event=>{if(AvatarCrop.drag?.id!==event.pointerId)return;const ratio=canvas.width/canvas.getBoundingClientRect().width;AvatarCrop.panX+=(event.clientX-AvatarCrop.drag.x)*ratio;AvatarCrop.panY+=(event.clientY-AvatarCrop.drag.y)*ratio;AvatarCrop.drag.x=event.clientX;AvatarCrop.drag.y=event.clientY;drawAvatarCrop()});
  const end=event=>{if(AvatarCrop.drag?.id===event.pointerId)AvatarCrop.drag=null};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  $('#avatarCropZoom').addEventListener('input',event=>{AvatarCrop.zoom=+event.target.value;drawAvatarCrop()});
}
async function saveAvatarCrop(){
  const canvas=$('#avatarCropCanvas');if(!canvas||!AvatarCrop.bitmap)return;
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.86));if(!blob)return;
  closeAvatarCrop();await T20Cloud.uploadAvatar(new File([blob],'avatar.webp',{type:'image/webp'}));
}
const T20TabCoord={
  id:globalThis.crypto?.randomUUID?.()||`tab-${Date.now()}-${Math.random()}`,channel:null,pendingResolve:null,pendingTimer:null,
  init(){
    if(typeof BroadcastChannel==='undefined')return;
    this.channel=new BroadcastChannel('triple20-auth-tabs');
    this.channel.onmessage=event=>{const message=event.data||{};if(message.id===this.id)return;if(message.type==='probe')this.channel.postMessage({type:'alive',id:this.id});if(message.type==='alive'&&this.pendingResolve){clearTimeout(this.pendingTimer);const resolve=this.pendingResolve;this.pendingResolve=null;resolve(true)}};
  },
  hasOtherTab(){
    if(!this.channel)return Promise.resolve(false);
    return new Promise(resolve=>{this.pendingResolve=resolve;this.channel.postMessage({type:'probe',id:this.id});this.pendingTimer=setTimeout(()=>{if(this.pendingResolve===resolve)this.pendingResolve=null;resolve(false)},700)});
  }
};
T20TabCoord.init();
window.T20Cloud={
  client:null,ready:false,initPromise:null,authListenerStarted:false,session:null,user:null,isAdmin:false,profile:null,avatarSignedUrl:'',online:false,syncing:false,authBusy:false,loginBusy:false,magicLinkBusy:false,profileBusy:false,avatarBusy:false,authHandoffActive:false,authHandoffCloseTimer:null,adminProfilesBusy:false,adminProfiles:[],adminProfileAvatars:{},publicMembers:[],publicMemberAvatars:{},presenceChannel:null,onlineUserIds:new Set(),authMessage:'',authError:'',loadBusy:false,pendingAuthSession:null,pendingSync:localStorage.getItem('triple20_pending_sync')==='1',lastSyncAt:localStorage.getItem('triple20_last_sync')||'',cloudUpdated:{},loadedCloudData:null,pollTimer:null,memberPollTimer:null,authRedirectPending:/[?#&](code|token_hash|access_token|refresh_token)=/.test(location.href),
  async finishAuthRedirect(){
    const otherTab=await T20TabCoord.hasOtherTab();
    if(!otherTab){showLogin();return}
    this.authHandoffActive=true;showLogin();renderCloudPanel();
    clearTimeout(this.authHandoffCloseTimer);this.authHandoffCloseTimer=setTimeout(()=>{try{window.close()}catch{}},900);
  },
  async init(){
    if(this.initPromise)return this.initPromise;
    this.initPromise=(async()=>{
      try{
        await ensureSupabaseLibrary();
        if(!SUPABASE_PUBLISHABLE_KEY||SUPABASE_PUBLISHABLE_KEY.includes('HIER_'))throw new Error('Supabase Publishable Key fehlt.');
        if(!this.client){
          this.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
          supabaseClient=this.client;
        }
        if(!this.authListenerStarted){
          this.client.auth.onAuthStateChange((_event,session)=>{this.pendingAuthSession=session||null;setTimeout(()=>{if(!this.loginBusy)this.processPendingAuthSession()},0)});
          this.authListenerStarted=true;
        }
        this.ready=true;
        await this.loadPublicMembers();
        renderCloudPanel();
        await this.restoreSessionAfterInit();
        this.startPolling();
        setLoginError('');
      }catch(error){
        console.error('Supabase-Initialisierung fehlgeschlagen:',error);
        this.client=null;supabaseClient=null;this.ready=false;this.initPromise=null;
        setSyncStatus('Offline – lokale Kopie','offline');
        renderReadonlyMode();renderCloudPanel();setLoginError(error.message);
      }
    })();
    return this.initPromise;
  },
  async restoreSessionAfterInit(){
    try{
      let {data:{session},error}=await withTimeout(this.client.auth.getSession(),5000,'Gespeicherte Sitzung konnte nicht rechtzeitig geladen werden.');
      if(error)throw error;
      if(!session&&this.authRedirectPending){
        for(let attempt=0;attempt<20&&!session;attempt++){
          await new Promise(resolve=>setTimeout(resolve,150));
          const result=await this.client.auth.getSession();
          if(result.error)throw result.error;
          session=result.data.session;
        }
      }
      await this.setSession(session||null);
      renderCloudPanel();
      this.loadCloud({initial:true}).catch(e=>console.warn('Cloud-Startladen fehlgeschlagen',e));
    }catch(error){
      console.warn('Session nach Start konnte nicht geladen werden:',error);
      setSyncStatus('Nur Ansicht','view-only');
      renderCloudPanel();
    }
  },
  async processPendingAuthSession(){if(this.authBusy){setTimeout(()=>this.processPendingAuthSession(),0);return}const session=this.pendingAuthSession;this.pendingAuthSession=null;await this.setSession(session||null)},
  async setSession(session,options={}){return this.processSession(session,options)},
  async processSession(session,{loadCloud=false}={}){
    if(this.authBusy)return;
    this.authBusy=true;
    try{
      if(!session&&this.presenceChannel)await this.stopPresence();
      this.session=session;this.user=session?.user||null;this.isAdmin=false;this.profile=null;this.avatarSignedUrl='';
      if(this.user)this.isAdmin=await this.checkAdmin(this.user.id);
      if(this.isAdmin&&localStorage.getItem('triple20_identity_pending')==='1'){this.pendingSync=true;localStorage.setItem('triple20_pending_sync','1');localStorage.removeItem('triple20_identity_pending')}
      if(this.user&&this.isAdmin)await this.loadAdminProfiles();
      if(this.user&&!this.isAdmin)this.profile=await this.loadProfile();
      if(this.user)this.startPresence();
      renderReadonlyMode();renderCloudPanel();
      if(this.user&&!this.isAdmin){setSyncStatus('Angemeldet – Mitglied','view-only');if(this.authRedirectPending){this.authRedirectPending=false;await this.finishAuthRedirect()}return}
      setSyncStatus(this.isAdmin?'Online – aktuell':'Nur Ansicht',this.isAdmin?'online':'view-only');
      if(loadCloud)await this.loadCloud({initial:true});
    }catch(e){console.warn('Session-Verarbeitung fehlgeschlagen',e);this.session=null;this.user=null;this.isAdmin=false;renderReadonlyMode();renderCloudPanel();setSyncStatus('Nur Ansicht','view-only');setLoginError('Anmeldung konnte nicht vollständig geprüft werden. Bitte später erneut versuchen.')}
    finally{this.authBusy=false}
  },
  async startPresence(){
    if(!this.client||!this.user)return;
    if(this.presenceChannel)await this.client.removeChannel(this.presenceChannel);
    const channel=this.client.channel('triple20-online',{config:{presence:{key:this.user.id}}});this.presenceChannel=channel;
    channel.on('presence',{event:'sync'},()=>{this.onlineUserIds=new Set(Object.keys(channel.presenceState()));if(this.isAdmin)renderCloudPanel()});
    channel.subscribe(async status=>{if(status==='SUBSCRIBED')await channel.track({user_id:this.user.id,nickname:this.profile?.nickname||this.user.email||'',online_at:new Date().toISOString()})});
  },
  async stopPresence(){if(this.presenceChannel&&this.client)await this.client.removeChannel(this.presenceChannel);this.presenceChannel=null;this.onlineUserIds=new Set()},
  async checkAdmin(uid){try{const client=requireSupabaseClient();const {data,error}=await withTimeout(client.from('triple20_admins').select('user_id').eq('user_id',uid).maybeSingle(),10000,'Adminprüfung dauert zu lange.');if(error)throw error;const ok=data?.user_id===uid;if(ok)localStorage.setItem('triple20_admin_uid',uid);return ok}catch(e){console.warn('Adminprüfung fehlgeschlagen',e);return localStorage.getItem('triple20_admin_uid')===uid}},
  async loadPublicMembers(){
    if(!this.client)return[];
    const {data,error}=await this.client.rpc('triple20_public_members');
    if(error)throw error;
    this.publicMembers=(data||[]).filter(member=>member.id&&member.nickname);this.publicMemberAvatars={};
    await Promise.all(this.publicMembers.map(async member=>{const {data:signed,error:signedError}=await this.client.storage.from('triple20-avatars').createSignedUrl(`${member.id}/avatar.webp`,3600);if(!signedError&&signed?.signedUrl)this.publicMemberAvatars[member.id]=signed.signedUrl}));
    linkKnownMemberIds();
    return this.publicMembers;
  },
  async loadAdminProfiles(){
    if(!this.isAdmin||!this.user)return[];
    const client=requireSupabaseClient(),{data,error}=await client.from('triple20_profiles').select('id,display_name,nickname,avatar_url,created_at').order('nickname',{ascending:true,nullsFirst:false});
    if(error)throw error;
    this.adminProfiles=data||[];this.adminProfileAvatars={};
    await Promise.all(this.adminProfiles.filter(profile=>profile.avatar_url).map(async profile=>{
      const {data:signed,error:signedError}=await client.storage.from('triple20-avatars').createSignedUrl(profile.avatar_url,3600);
      if(!signedError&&signed?.signedUrl)this.adminProfileAvatars[profile.id]=signed.signedUrl;
    }));
    renderMemberSuggestions();renderRegisteredPlayerChoices();
    return this.adminProfiles;
  },
  async refreshAdminProfiles(){
    if(!this.isAdmin||this.adminProfilesBusy)return;
    this.adminProfilesBusy=true;this.authError='';renderCloudPanel();
    try{await this.loadAdminProfiles()}catch(error){console.error('Mitglieder laden fehlgeschlagen:',error);this.authError='Mitglieder konnten nicht aktualisiert werden.'}
    finally{this.adminProfilesBusy=false;renderCloudPanel()}
  },
  async loadProfile(){const client=requireSupabaseClient();const {data,error}=await client.from('triple20_profiles').select('id,display_name,nickname,avatar_url,updated_at').eq('id',this.user.id).maybeSingle();if(error)throw error;const profile=data||{id:this.user.id,display_name:'',nickname:'',avatar_url:null};this.avatarSignedUrl='';if(profile.avatar_url){const {data:signed,error:signedError}=await client.storage.from('triple20-avatars').createSignedUrl(profile.avatar_url,3600);if(!signedError)this.avatarSignedUrl=signed?.signedUrl||''}return profile},
  async prepareAvatar(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file?.type))throw new Error('Bitte ein JPEG-, PNG- oder WebP-Bild auswählen.');
    if(file.size>10*1024*1024)throw new Error('Das Ausgangsbild ist größer als 10 MB.');
    const bitmap=await createImageBitmap(file),scale=Math.min(1,512/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
    const encode=quality=>new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));let blob=await encode(.84);if(blob?.size>1048576)blob=await encode(.68);if(!blob||blob.size>1048576)throw new Error('Das Bild konnte nicht auf unter 1 MB verkleinert werden.');return blob;
  },
  async uploadAvatar(file){
    if(!this.user||this.isAdmin||this.avatarBusy)return;this.avatarBusy=true;this.authMessage='';this.authError='';renderCloudPanel();
    try{const blob=await this.prepareAvatar(file),path=`${this.user.id}/avatar.webp`,client=requireSupabaseClient(),{error:uploadError}=await client.storage.from('triple20-avatars').upload(path,blob,{contentType:'image/webp',upsert:true,cacheControl:'3600'});if(uploadError)throw uploadError;const {data,error}=await client.from('triple20_profiles').update({avatar_url:path}).eq('id',this.user.id).select('id,display_name,nickname,avatar_url,updated_at').single();if(error)throw error;this.profile=data;const {data:signed,error:signedError}=await client.storage.from('triple20-avatars').createSignedUrl(path,3600);if(signedError)throw signedError;this.avatarSignedUrl=signed?.signedUrl||'';this.authMessage='Profilfoto wurde gespeichert.'}
    catch(error){console.error('Profilfoto hochladen fehlgeschlagen:',error);this.authError=`Profilfoto konnte nicht gespeichert werden: ${error?.message||'Bitte später erneut versuchen.'}`}
    finally{this.avatarBusy=false;renderCloudPanel()}
  },
  async removeAvatar(){
    if(!this.user||this.isAdmin||this.avatarBusy||!this.profile?.avatar_url)return;this.avatarBusy=true;this.authMessage='';this.authError='';renderCloudPanel();
    try{const client=requireSupabaseClient(),path=this.profile.avatar_url,{error:removeError}=await client.storage.from('triple20-avatars').remove([path]);if(removeError)throw removeError;const {data,error}=await client.from('triple20_profiles').update({avatar_url:null}).eq('id',this.user.id).select('id,display_name,nickname,avatar_url,updated_at').single();if(error)throw error;this.profile=data;this.avatarSignedUrl='';this.authMessage='Profilfoto wurde entfernt.'}
    catch(error){console.error('Profilfoto entfernen fehlgeschlagen:',error);this.authError=`Profilfoto konnte nicht entfernt werden: ${error?.message||'Bitte später erneut versuchen.'}`}
    finally{this.avatarBusy=false;renderCloudPanel()}
  },
  async sendMagicLink(email){
    if(this.magicLinkBusy)return;this.magicLinkBusy=true;this.authMessage='';this.authError='';renderCloudPanel();
    try{if(!this.ready||!this.client)await this.init();if(!this.client)throw new Error('Supabase konnte nicht initialisiert werden.');const {error}=await withTimeout(this.client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:TRIPLE20_PUBLIC_URL}}),15000,'Der Anmeldelink konnte nicht rechtzeitig versendet werden.');if(error)throw error;this.authMessage='Wenn die Adresse freigeschaltet ist, wurde ein Anmeldelink gesendet. Bitte prüfe auch den Spam-Ordner.'}
    catch(error){console.error('Mitglieder-Anmeldelink fehlgeschlagen:',error);this.authMessage='';this.authError=`Anmeldelink konnte nicht gesendet werden: ${error?.message||'Bitte später erneut versuchen.'}`}
    finally{this.magicLinkBusy=false;renderCloudPanel()}
  },
  async saveProfile(displayName,nickname){
    if(!this.user||this.isAdmin||this.profileBusy)return;
    const cleanName=displayName.trim().replace(/\s+/g,' '),cleanNickname=nickname.trim().replace(/\s+/g,' ');
    if(!cleanNickname){this.authError='Bitte einen Spitznamen eintragen.';this.authMessage='';renderCloudPanel();return}
    if(cleanName.split(' ').length<2){this.authError='Bitte Vor- und Zunamen vollständig eintragen.';this.authMessage='';renderCloudPanel();return}
    this.profileBusy=true;this.authMessage='';this.authError='';renderCloudPanel();
    try{const client=requireSupabaseClient();const {data,error}=await client.from('triple20_profiles').update({display_name:cleanName,nickname:cleanNickname}).eq('id',this.user.id).select('id,display_name,nickname,avatar_url,updated_at').single();if(error)throw error;this.profile=data;await this.loadPublicMembers();this.authMessage='Profil wurde gespeichert.'}
    catch(error){console.error('Profil speichern fehlgeschlagen:',error);this.authMessage='';this.authError=error?.code==='23505'?'Dieser Spitzname wird bereits verwendet. Bitte wähle einen anderen.':`Profil konnte nicht gespeichert werden: ${error?.message||'Bitte später erneut versuchen.'}`}
    finally{this.profileBusy=false;renderCloudPanel()}
  },
  async signIn(email,password){
    const loginError=$('#loginError');
    if(this.loginBusy)return;
    this.loginBusy=true;
    let failed=false;
    renderCloudPanel();
    try{
      if(loginError)loginError.textContent='';
      if(!this.ready||!this.client)await this.init();
      if(!this.client)throw new Error('Supabase konnte nicht initialisiert werden.');
      setSyncStatus('Wird angemeldet …','saving');
      const {data,error}=await withTimeout(this.client.auth.signInWithPassword({email,password}),15000,'Anmeldung dauert zu lange. Bitte Verbindung prüfen und erneut versuchen.');
      if(error)throw error;
      if(!data?.session?.user)throw new Error('Keine gültige Sitzung erhalten.');
      this.pendingAuthSession=null;
      await this.setSession(data.session||null);
      this.loadCloud({initial:true}).catch(e=>console.warn('Cloud nach Login konnte nicht geladen werden',e));
    }catch(error){
      failed=true;
      console.error('Anmeldung fehlgeschlagen:',error);
      this.session=null;this.user=null;this.isAdmin=false;renderReadonlyMode();renderCloudPanel();setSyncStatus('Nur Ansicht','view-only');
      setLoginError(`Anmeldung fehlgeschlagen: ${error?.message||'Bitte E-Mail und Passwort prüfen.'}`);
    }
    finally{this.loginBusy=false;if(!failed)renderCloudPanel();if(!this.isAdmin&&$('#syncStatusText')?.textContent==='Wird angemeldet …')setSyncStatus('Nur Ansicht','view-only')}
  },
  async signOut(){
    try{await this.stopPresence();if(this.client)await this.client.auth.signOut()}catch(e){console.warn('Abmeldung fehlgeschlagen',e)}
    localStorage.removeItem('triple20_admin_uid');
    this.pendingAuthSession=null;this.session=null;this.user=null;this.isAdmin=false;this.profile=null;this.avatarSignedUrl='';this.authMessage='';this.authError='';
    renderReadonlyMode();renderCloudPanel();setSyncStatus('Nur Ansicht','view-only');showTournament();
  },
  async fetchCloud(){const client=requireSupabaseClient();const {data,error}=await client.from('triple20_data').select('data_key,data,updated_at').in('data_key',CLOUD_DATA_KEYS);if(error)throw error;this.online=true;return data||[]},
  rowsToObject(rows){return Object.fromEntries(CLOUD_DATA_KEYS.map(k=>{const row=rows.find(r=>r.data_key===k);if(row?.updated_at)this.cloudUpdated[k]=row.updated_at;return[k,row?row.data:null]}))},
  async loadCloud({initial=false}={}){
    if(this.loadBusy)return;
    this.loadBusy=true;
    try{
      const rows=await this.fetchCloud(),cloud=this.rowsToObject(rows),hasCloud=rows.length&&Object.values(cloud).some(v=>v!==null&&v!==undefined);
      this.loadedCloudData=cloud;this.lastSyncAt=new Date().toISOString();localStorage.setItem('triple20_last_sync',this.lastSyncAt);
      if(this.isAdmin&&this.pendingSync){await this.syncAll();return}
      if(!hasCloud){setSyncStatus(this.isAdmin&&hasMeaningfulLocalData()?'Online – Cloud leer, lokale Daten vorhanden':'Online – aktuell','online');renderCloudPanel();return}
      if(!this.isAdmin&&(state.started||state.players?.length||state.matches?.length)){setSyncStatus('Offline – lokales Turnier','offline');renderCloudPanel();return}
      if(initial&&!hasMeaningfulLocalData()){applyTriple20Data(cloud);setSyncStatus(this.isAdmin?'Online – aktuell':'Nur Ansicht',this.isAdmin?'online':'view-only');return}
      if(!this.isAdmin){applyTriple20Data(cloud);setSyncStatus('Nur Ansicht','view-only');return}
      setSyncStatus('Online – aktuell','online');renderCloudPanel();
    }catch(e){console.warn('Cloud laden fehlgeschlagen',e);this.online=false;setSyncStatus('Offline – lokale Kopie','offline')}
    finally{this.loadBusy=false}
  },
  queueSync(key){if(!this.isAdmin||!this.client)return;clearTimeout(this.syncTimer);this.syncTimer=setTimeout(()=>this.syncAll(),700)},
  async syncAll({force=false}={}){
    if(!this.isAdmin||!this.client)return;
    this.pendingSync=true;localStorage.setItem('triple20_pending_sync','1');
    setSyncStatus('Wird gespeichert …','saving');
    try{
      const rows=await this.fetchCloud();
      if(!force){
        const changed=rows.some(r=>this.cloudUpdated[r.data_key]&&r.updated_at&&r.updated_at!==this.cloudUpdated[r.data_key]);
        if(changed){
          setSyncStatus('Konflikt erkannt','conflict');
          const choice=prompt('Die Online-Daten wurden zwischenzeitlich auf einem anderen Gerät geändert.\n\n1 = Online-Version laden\n2 = lokale Version als JSON sichern\n3 = lokale Version trotzdem überschreiben','1');
          if(choice==='1'){await this.loadCloudConfirmed();return}
          if(choice==='2'){backupTriple20Data('triple20_konflikt_lokal');return}
          if(choice!=='3'||!confirm('Lokale Version wirklich trotzdem in der Cloud überschreiben?'))return;
          backupTriple20Data('triple20_konflikt_lokal');
        }
      }
      const payload=CLOUD_DATA_KEYS.map(k=>({data_key:k,data:localValueForKey(k)}));
      const client=requireSupabaseClient();
      const {data,error}=await client.from('triple20_data').upsert(payload,{onConflict:'data_key'}).select('data_key,updated_at');
      if(error)throw error;(data||[]).forEach(r=>this.cloudUpdated[r.data_key]=r.updated_at);
      this.pendingSync=false;localStorage.removeItem('triple20_pending_sync');this.lastSyncAt=new Date().toISOString();localStorage.setItem('triple20_last_sync',this.lastSyncAt);setSyncStatus('Online gespeichert','saved');renderCloudPanel();
    }catch(e){console.warn('Cloud speichern fehlgeschlagen',e);this.pendingSync=true;localStorage.setItem('triple20_pending_sync','1');setSyncStatus('Offline – lokale Kopie','offline')}
  },
  async uploadLocalWithBackup(){if(!isAdmin())return;const summary=backupPreview();backupTriple20Data('triple20_vor_cloud_upload');if(!confirm(`Lokale Triple20-Daten in die Cloud übernehmen?\n\n${summary}\n\nEin JSON-Backup wurde heruntergeladen.`))return;await this.syncAll({force:true})},
  async loadCloudConfirmed(){if(!this.loadedCloudData)await this.loadCloud();if(!this.loadedCloudData)return;backupTriple20Data('triple20_vor_cloud_laden');if(!confirm('Cloud-Daten laden? Die aktuelle lokale Version wurde vorher als Backup gesichert.'))return;applyTriple20Data(this.loadedCloudData);setSyncStatus('Online – aktuell','online')},
  startPolling(){clearInterval(this.pollTimer);clearInterval(this.memberPollTimer);this.pollTimer=setInterval(()=>this.loadCloud(),15000);this.memberPollTimer=setInterval(()=>this.loadPublicMembers().then(()=>{if(!$('#seasonSection')?.classList.contains('hidden'))renderSeasonView()}).catch(error=>console.warn('Mitgliedsnamen konnten nicht aktualisiert werden',error)),60000)}
};
function memberIdForName(name){
  const normalized=(name||'').trim().toLowerCase();
  return (T20Cloud.publicMembers||[]).find(member=>member.nickname.trim().toLowerCase()===normalized)?.id||'';
}
function currentMemberNickname(id,fallback=''){
  return (T20Cloud.publicMembers||[]).find(member=>member.id===id)?.nickname||fallback;
}
function memberAvatarUrl(id){return T20Cloud.publicMemberAvatars?.[id]||T20Cloud.adminProfileAvatars?.[id]||(T20Cloud.user?.id===id?T20Cloud.avatarSignedUrl:'')||''}
function resultIdentity(name,id=''){return id?`id:${id}`:`name:${(name||'').trim().toLowerCase()}`}
function linkKnownMemberIds(){
  if(!T20Cloud.publicMembers?.length)return false;
  let changed=false;
  state.playerProfileIds=state.playerProfileIds||{};
  (state.players||[]).forEach(name=>{const id=state.playerProfileIds[name]||memberIdForName(name);if(id&&!state.playerProfileIds[name]){state.playerProfileIds[name]=id;changed=true}});
  for(const season of seasonStore.seasons||[]){
    season.memberProfileIds=season.memberProfileIds||{};
    for(const name of season.members||season.players||[]){const id=season.memberProfileIds[name]||memberIdForName(name);if(id&&!season.memberProfileIds[name]){season.memberProfileIds[name]=id;changed=true}}
    for(const tournament of season.tournaments||[]){
      tournament.playerProfileIds=tournament.playerProfileIds||{};
      for(const name of tournament.players||[]){const id=tournament.playerProfileIds[name]||memberIdForName(name);if(id&&!tournament.playerProfileIds[name]){tournament.playerProfileIds[name]=id;changed=true}}
      for(const result of tournament.results||[]){const id=result.profileId||tournament.playerProfileIds[result.name]||memberIdForName(result.name);if(id&&!result.profileId){result.profileId=id;changed=true}}
    }
  }
  if(changed){localStorage.setItem('dartTournament',JSON.stringify(state));localStorage.setItem(SEASON_KEY,JSON.stringify(seasonStore));localStorage.setItem('triple20_identity_pending','1');if(isAdmin())T20Cloud.queueSync(SEASON_KEY)}
  return changed;
}
function currentSeasonWinsMap(){const rows=calculateSeasonStandings(selectedSeason());return Object.fromEntries(rows.map(r=>[r.name,r.wins||0]))}
function sortBySeasonWins(players){if(!isAdmin())return [...players];const wins=currentSeasonWinsMap();return [...players].sort((a,b)=>(wins[b]||0)-(wins[a]||0)||a.localeCompare(b,'de'))}

function registeredMemberProfiles(){
  return isAdmin()?(T20Cloud.adminProfiles||[]).filter(profile=>profile.nickname?.trim()):[];
}
function addTournamentPlayer(name,profileId=''){
  name=(name||'').trim().replace(/\s+/g,' ');
  if(!name)return false;
  if(state.players.some(player=>player.toLowerCase()===name.toLowerCase())){alert('Dieser Spieler ist bereits eingetragen.');return false}
  state.players.push(name);state.playerProfileIds=state.playerProfileIds||{};const id=profileId||memberIdForName(name);if(id)state.playerProfileIds[name]=id;renderPlayers();return true;
}
function renderRegisteredPlayerChoices(){
  const form=$('#playerForm');if(!form)return;
  let box=$('#registeredPlayerChoices');
  if(!box){box=document.createElement('div');box.id='registeredPlayerChoices';form.insertAdjacentElement('afterend',box)}
  if(!isAdmin()){box.innerHTML='';box.classList.add('hidden');return}
  const entered=new Set(state.players.map(player=>player.toLowerCase()));
  const profiles=registeredMemberProfiles().filter(profile=>!entered.has(profile.nickname.trim().toLowerCase()));
  box.className=`registered-player-choices ${profiles.length?'':'hidden'}`;
  box.innerHTML=profiles.length?`<div class="registered-player-title"><strong>Registrierte Mitglieder</strong><small>Zum Hinzufügen anklicken</small></div><div class="registered-player-grid">${profiles.map(profile=>{const name=profile.nickname.trim(),photo=T20Cloud.adminProfileAvatars?.[profile.id],avatar=photo?`<img src="${esc(photo)}" alt="">`:esc(name.charAt(0).toUpperCase());return `<button type="button" class="registered-player" data-add-profile="${esc(name)}" data-profile-id="${esc(profile.id)}"><span class="profile-avatar">${avatar}</span><span>${esc(name)}</span><b>+</b></button>`}).join('')}</div>`:'';
}
function renderPlayers(){
  if(!state.started)state.players=sortBySeasonWins(state.players);
  $('#playerList').innerHTML=state.players.map((p,i)=>`<div class="player"><b><span>${i+1}</span>${esc(p)}</b><button data-remove="${i}" aria-label="${esc(p)} entfernen">×</button></div>`).join('');
  $('#playerCount').textContent=`${state.players.length} Spieler eingetragen`;
  renderMemberSuggestions();
  renderRegisteredPlayerChoices();
  $('#startBtn').disabled=state.players.length<2;save();
}
$('#playerForm').addEventListener('submit',e=>{e.preventDefault();const input=$('#playerName');if(addTournamentPlayer(input.value)){input.value='';input.focus()}});
$('#playerList').addEventListener('click',e=>{const i=e.target.dataset.remove;if(i!==undefined){state.players.splice(+i,1);renderPlayers()}});
$('#setupSection').addEventListener('click',e=>{const button=e.target.closest('[data-add-profile]');if(button)addTournamentPlayer(button.dataset.addProfile,button.dataset.profileId)});
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
  if(!state.started){$('#setupSection').classList.remove('hidden');$('#tournamentSection').classList.add('hidden');renderReadonlyMode();return}
  const noBracket=state.settings.mode==='roundrobin'||state.settings.mode==='swiss';
  $('#setupSection').classList.add('hidden');$('#tournamentSection').classList.remove('hidden');$('#bracketTab').classList.toggle('hidden',noBracket);
  if(noBracket&&$('#bracketTab').classList.contains('active')){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelector('[data-tab="matches"]').classList.add('active');$('#matchesView').classList.remove('hidden');$('#bracketView').classList.add('hidden');$('#tableView').classList.add('hidden')}
  $('#liveTitle').textContent=state.settings.name;$('#liveMeta').textContent=`${state.players.length} Spieler · ${modeName()} · ${state.settings.start}`;
  const done=state.matches.filter(m=>m.sa!==null).length;$('#progressText').textContent=Math.round(done/state.matches.length*100)+'%';
  $('#matchList').innerHTML=state.matches.map((m,i)=>`<article class="match ${m.sa!==null?'done':''}"><div class="match-no">${m.group!==undefined?'Gruppe '+String.fromCharCode(65+m.group)+' · ':''}Runde ${m.round} · ${m.bracket==='lower'?'Verlierer':m.bracket==='grand'?'Finale':'Spiel'} ${String(i+1).padStart(2,'0')}</div><div class="players-match"><span class="${m.sa>m.sb?'winner-player':''}">${esc(m.a)}</span><b>${m.sa===null?'VS':m.sa+' : '+m.sb}</b><span class="${m.sb>m.sa?'winner-player':''}">${esc(m.b)}</span></div><div class="score-controls">${m.b==='Freilos'?'Weiter':`<select data-sa="${i}">${options(m.sa)}</select><span>:</span><select data-sb="${i}">${options(m.sb)}</select><button data-save="${i}">✓</button>`}</div></article>`).join('');
  renderTable();renderBracket();renderQualification();renderWithdrawCard();const winner=champion();$('#winnerCard').classList.toggle('hidden',!winner);if(winner){$('#winnerName').textContent=winner;saveTournamentToHistory()}renderSeasonImport(winner);save();renderReadonlyMode();
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
  state.players.push(name);state.playerProfileIds=state.playerProfileIds||{};const profileId=memberIdForName(name);if(profileId)state.playerProfileIds[name]=profileId;state.players=sortBySeasonWins(state.players);
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
  const playerProfileIds=Object.fromEntries(state.players.map(name=>[name,state.playerProfileIds?.[name]||memberIdForName(name)]).filter(([,id])=>id));
  const results=state.players.map(name=>{const wins=tournamentWins(name,state.matches),losses=tournamentLosses(name,state.matches),row=rows.find(r=>r.name===name)||{},profileId=playerProfileIds[name]||'';return{name,profileId,wins,losses,rank:(rows.findIndex(r=>r.name===name)+1)||0,legsFor:row.lf||0,legsAgainst:row.la||0,points:pointsForWins(wins,pointSystem),max180:stats[name]?.max180||0,checkout:stats[name]?.checkout||0}});
  return{id:`tournament-${Date.now()}`,name:state.settings.name||'Turnier',date,mode:state.settings.mode,players:[...state.players],participantCount:state.players.length,winner:rows[0]?.name||'',top3:rows.slice(0,3).map(r=>r.name),playerProfileIds,settings:{...state.settings},matches:state.matches.map(m=>({...m})),results,createdAt:new Date().toISOString()};
}
function loadTournamentHistory(){try{const data=JSON.parse(localStorage.getItem(TOURNAMENT_HISTORY_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}
function saveTournamentToHistory(){
  if(!T20Cloud.user||state.savedToHistory||!state.matches?.length||!state.matches.every(m=>m.sa!==null))return;
  const history=loadTournamentHistory(),record=buildCurrentTournamentRecord();history.push(record);localStorage.setItem(TOURNAMENT_HISTORY_KEY,JSON.stringify(history));state.savedToHistory=record.id;save();
}
function exportCurrentTournamentJson(){const record=state.savedToHistory?loadTournamentHistory().find(t=>t.id===state.savedToHistory)||buildCurrentTournamentRecord():buildCurrentTournamentRecord();downloadFile(`${(record.name||'Turnier').replaceAll(' ','_')}.json`,'application/json',JSON.stringify(record,null,2))}
function seasonMembers(season=selectedSeason()){return [...new Set((season?.members!==undefined?season.members:season?.players)||[])].sort((a,b)=>a.localeCompare(b,'de'))}
function saveSeasonMembers(season,names){season.members=[...new Set(names.map(n=>n.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));season.memberProfileIds=season.memberProfileIds||{};season.members.forEach(name=>{const id=season.memberProfileIds[name]||memberIdForName(name);if(id)season.memberProfileIds[name]=id});season.players=[...new Set([...(season.tournaments||[]).flatMap(t=>t.players||[]),...season.members])].sort((a,b)=>a.localeCompare(b,'de'));saveSeason(season)}
function renderMemberSuggestions(){const list=$('#memberSuggestions'),season=selectedSeason();if(!list)return;if(!T20Cloud.user){list.innerHTML='';return}const entered=new Set(state.players.map(p=>p.toLowerCase())),registered=new Set((T20Cloud.publicMembers||[]).map(member=>member.nickname.trim().toLowerCase())),names=seasonMembers(season).filter(name=>!season?.memberProfileIds?.[name]&&!registered.has(name.toLowerCase())),unique=[...new Map(names.filter(Boolean).map(name=>[name.toLowerCase(),name])).values()];list.innerHTML=unique.filter(name=>!entered.has(name.toLowerCase())).map(name=>`<option value="${esc(name)}"></option>`).join('')}
function addSeasonMember(name){const season=selectedSeason();if(!season||!name.trim())return;const members=seasonMembers(season);if(members.some(p=>p.toLowerCase()===name.trim().toLowerCase())){alert('Dieses Mitglied ist bereits eingetragen.');return}saveSeasonMembers(season,[...members,name.trim()]);renderMemberSuggestions()}
function removeSeasonMember(name){const season=selectedSeason();if(!season)return;if(!confirm(`${name} aus der Mitgliederliste entfernen? Bereits gespeicherte Spieltage bleiben erhalten.`))return;saveSeasonMembers(season,seasonMembers(season).filter(p=>p!==name));renderMemberSuggestions()}
function addTournamentToSeason(seasonId,tournament){
  if(!isClubMode())return null;
  const season=seasonStore.seasons.find(s=>s.id===seasonId);if(!season)return null;
  season.memberProfileIds={...(season.memberProfileIds||{}),...(tournament.playerProfileIds||{})};
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
  const season=selectedSeason(),pointSystem=defaultPointSystem(),date=$('#manualTournamentDate')?.value||todayIso(),name=$('#manualTournamentName')?.value.trim()||'Dienstagsturnier';
  const results=[...document.querySelectorAll('[data-manual-player]')].filter(row=>row.querySelector('[data-manual-present]')?.checked).map(row=>{
    const player=row.dataset.manualPlayer,wins=+(row.querySelector('[data-manual-wins]')?.value||0),losses=+(row.querySelector('[data-manual-losses]')?.value||0),max180=+(row.querySelector('[data-manual-180]')?.value||0),checkout=+(row.querySelector('[data-manual-checkout]')?.value||0);
    return{name:player,profileId:season?.memberProfileIds?.[player]||memberIdForName(player),wins,losses,max180,checkout,points:pointsForWins(wins,pointSystem),rank:0,legsFor:0,legsAgainst:0};
  }).sort((a,b)=>b.wins-a.wins||a.losses-b.losses||b.max180-a.max180||b.checkout-a.checkout||a.name.localeCompare(b.name,'de'));
  results.forEach((r,i)=>r.rank=i+1);
  const playerProfileIds=Object.fromEntries(results.filter(r=>r.profileId).map(r=>[r.name,r.profileId]));
  return{id:`manual-tournament-${Date.now()}`,name,date,mode:'swiss',manual:true,players:results.map(r=>r.name),playerProfileIds,participantCount:results.length,winner:results[0]?.name||'',top3:results.slice(0,3).map(r=>r.name),settings:{mode:'swiss',name,manual:true},matches:[],results,createdAt:new Date().toISOString()};
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
  const tournaments=season.tournaments||[],players=new Map();
  const addPlayer=(name,id='')=>{const key=resultIdentity(name,id),display=id?currentMemberNickname(id,name):name;if(!players.has(key))players.set(key,{key,name:display,profileId:id})};
  for(const name of season.members||[])addPlayer(name,season.memberProfileIds?.[name]||memberIdForName(name));
  for(const name of season.players||[])addPlayer(name,season.memberProfileIds?.[name]||memberIdForName(name));
  for(const tournament of tournaments){
    for(const name of tournament.players||[])addPlayer(name,tournament.playerProfileIds?.[name]||memberIdForName(name));
    for(const result of tournament.results||[])addPlayer(result.name,result.profileId||tournament.playerProfileIds?.[result.name]||memberIdForName(result.name));
  }
  return [...players.values()].map(player=>{
    const entries=tournaments.map(t=>{const r=(t.results||[]).find(x=>resultIdentity(x.name,x.profileId||t.playerProfileIds?.[x.name]||memberIdForName(x.name))===player.key);return r?{tournamentId:t.id,date:t.date,name:t.name,present:true,points:r.points||0,wins:r.wins||0,losses:r.losses||0,max180:r.max180||0,checkout:r.checkout||0,rank:r.rank||0}:{tournamentId:t.id,date:t.date,name:t.name,present:false,points:0,wins:0,losses:0,max180:0,checkout:0,rank:0}});
    const dropped=calculateDropResults(entries,season.dropCount||0),used=dropped.filter(e=>!e.dropped),played=entries.filter(e=>e.present),wins=entries.reduce((sum,e)=>sum+e.wins,0),losses=entries.reduce((sum,e)=>sum+e.losses,0),max180=entries.reduce((sum,e)=>sum+e.max180,0),checkout=Math.max(0,...entries.map(e=>e.checkout||0));
    return{name:player.name,profileId:player.profileId,totalPoints:entries.reduce((sum,e)=>sum+e.points,0),cleanPoints:used.reduce((sum,e)=>sum+e.points,0),played:played.length,wins,losses,max180,checkout,dropResults:dropped.filter(e=>e.dropped),entries:dropped,participation:tournaments.length?played.length/tournaments.length:0,winRate:wins+losses?wins/(wins+losses):0};
  }).sort((a,b)=>b.cleanPoints-a.cleanPoints||b.wins-a.wins||b.played-a.played||a.name.localeCompare(b.name,'de'));
}
function seasonStats(season=selectedSeason()){const rows=calculateSeasonStandings(season);return{max180:[...rows].sort((a,b)=>b.max180-a.max180)[0],checkout:[...rows].sort((a,b)=>b.checkout-a.checkout)[0],played:[...rows].sort((a,b)=>b.played-a.played)[0],participation:[...rows].sort((a,b)=>b.participation-a.participation||b.played-a.played)[0],wins:[...rows].sort((a,b)=>b.wins-a.wins)[0],winRate:[...rows].filter(r=>r.wins+r.losses>0).sort((a,b)=>b.winRate-a.winRate||b.wins-a.wins)[0]}}
function calculateSeasonStatisticsSummary(season=selectedSeason()){const s=seasonStats(season),pick=(row,key)=>row?{player:row.name,value:row[key]||0}:null;return{updatedAt:new Date().toISOString(),max180:pick(s.max180,'max180'),checkout:pick(s.checkout,'checkout'),played:pick(s.played,'played'),participation:s.participation?{player:s.participation.name,value:s.participation.participation}:null,wins:pick(s.wins,'wins'),winRate:s.winRate?{player:s.winRate.name,value:s.winRate.winRate}:null}}
function renderSeasonImport(winner){
  const card=$('#seasonImportCard');if(!card)return;const complete=!!winner&&state.matches.length&&state.matches.every(m=>m.sa!==null);
  card.classList.toggle('hidden',!complete);if(!complete)return;
  if(!T20Cloud.user){card.innerHTML='<h3>Turnier abgeschlossen</h3><p>Das Ergebnis wird ohne Anmeldung nicht gespeichert.</p>';return}
  if(!isAdmin()){card.innerHTML='<h3>Turnier abgeschlossen</h3><p>Dieses Turnier wurde lokal/offline gespielt und nicht in eine Saison übernommen.</p><button id="exportCurrentTournamentBtn" class="primary">TURNIER EXPORTIEREN <span>→</span></button>';return}
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
  if($('#seasonActionSelect'))$('#seasonActionSelect').value='';
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
  const wins=Object.fromEntries(rows.map(r=>[r.name,r.wins||0])),members=seasonMembers(season).map(storedName=>({storedName,name:currentMemberNickname(season.memberProfileIds?.[storedName],storedName)})).sort((a,b)=>(wins[b.name]||0)-(wins[a.name]||0)||a.name.localeCompare(b.name,'de'));
  $('#seasonMembers').innerHTML=`<div class="card slim-card"><h3>Mitglieder</h3><p>Diese Liste wird für neue Dienstagsturniere als Setzliste verwendet: mehr Saison-Siege = weiter oben.</p><form id="memberForm" class="player-form"><input id="memberName" placeholder="Mitgliedsname" maxlength="30" autocomplete="off"><button type="submit">+ Mitglied</button></form><div class="member-list">${members.map((p,i)=>`<div class="member-row"><b><span>${i+1}</span>${esc(p.name)}</b><small>${wins[p.name]||0} Saison-Siege</small><button class="danger" data-remove-member="${esc(p.storedName)}">Entfernen</button></div>`).join('')||'<p class="empty-line">Noch keine Mitglieder eingetragen.</p>'}</div></div>`;
}
function tournamentPlayerName(tournament,name){
  const id=tournament.playerProfileIds?.[name]||(tournament.results||[]).find(result=>result.name===name)?.profileId||'';
  return currentMemberNickname(id,name);
}
function renderSeasonTournaments(season=selectedSeason()){
  const tournaments=season?.tournaments||[],list=tournaments.length?`<div class="match-list">${tournaments.map(t=>`<article class="match season-match"><div class="match-no">${esc(t.date)} · ${t.participantCount} Teilnehmer${t.manual?' · Manuell':''}</div><div><b>${esc(t.name)}</b><p>Sieger: ${esc(tournamentPlayerName(t,t.winner)||'–')} · Top 3: ${(t.top3||[]).map(name=>esc(tournamentPlayerName(t,name))).join(', ')||'–'}</p><div class="season-detail hidden" id="details-${esc(t.id)}">${(t.results||[]).sort((a,b)=>a.rank-b.rank).map(r=>`<span>${r.rank}. ${esc(tournamentPlayerName(t,r.name))} · ${r.wins}S/${r.losses}N · ${r.points} Pkt.${r.max180?` · ${r.max180}x180`:''}${r.checkout?` · HF ${r.checkout}`:''}</span>`).join('')}</div></div><div class="season-match-actions"><button class="secondary" data-tournament-detail="${esc(t.id)}">Details anzeigen</button><button class="danger" data-delete-tournament="${esc(t.id)}">Löschen</button></div></article>`).join('')}</div>`:'<div class="empty-card">Noch keine Turniere in dieser Saison.</div>';
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
  const season=selectedSeason(),row=calculateSeasonStandings(season).find(result=>result.name===name);if(!row)return;
  const privateProfile=isAdmin()?(T20Cloud.adminProfiles||[]).find(profile=>profile.id===row.profileId):(T20Cloud.user?.id===row.profileId?T20Cloud.profile:null),photo=memberAvatarUrl(row.profileId),initial=esc((row.name||'?').charAt(0).toUpperCase()),avatar=photo?`<img src="${esc(photo)}" alt="Profilfoto von ${esc(row.name)}">`:initial;
  const fullName=privateProfile?.display_name?`<p class="player-profile-realname">${esc(privateProfile.display_name)}</p>`:'';
  $('#seasonPlayerDetail').innerHTML=`<div class="card player-detail"><button class="secondary close-detail">Schließen</button><div class="player-profile-head"><span class="profile-avatar player-profile-avatar">${avatar}</span><div><span class="eyebrow">SPIELERPROFIL</span><h3>${esc(row.name)}</h3>${fullName}</div></div><div class="season-cards player-profile-stats"><article><span>Turniere</span><b>${row.played}</b></article><article><span>Siege</span><b>${row.wins}</b></article><article><span>Niederlagen</span><b>${row.losses}</b></article><article><span>180er</span><b>${row.max180}</b></article><article><span>High Finish</span><b>${row.checkout}</b></article><article><span>Teilnahme</span><b>${Math.round(row.participation*100)}%</b></article></div><div class="table-wrap"><table><thead><tr><th>Datum</th><th>Turnier</th><th>Status</th><th>S/N</th><th>Punkte</th><th>180er</th><th>Checkout</th></tr></thead><tbody>${row.entries.map(entry=>`<tr class="${entry.dropped?'dropped-row':''}"><td>${entry.date}</td><td>${esc(entry.name)}</td><td>${entry.present?'Gespielt':'Fehltermin'}${entry.dropped?' · gestrichen':''}</td><td>${entry.wins}/${entry.losses}</td><td>${entry.points}</td><td>${entry.max180}</td><td>${entry.checkout}</td></tr>`).join('')}</tbody></table></div></div>`;$('#seasonPlayerDetail').scrollIntoView({behavior:'smooth',block:'start'});
}
function exportSeasonJson(){const season=selectedSeason();if(!season)return;downloadFile(`${season.name.replaceAll(' ','_')}.json`,'application/json',JSON.stringify(season,null,2))}
function exportStandingsCsv(){const season=selectedSeason();if(!season)return;const rows=calculateSeasonStandings(season),head=['Platz','Spieler','Gesamtpunkte','Bereinigte Punkte','Turniere','Siege','Niederlagen','180er','Höchstes Checkout'];const csv=[head.join(';'),...rows.map((r,i)=>[i+1,r.name,r.totalPoints,r.cleanPoints,r.played,r.wins,r.losses,r.max180,r.checkout].map(v=>`"${String(v).replaceAll('"','""')}"`).join(';'))].join('\n');downloadFile(`${season.name.replaceAll(' ','_')}_rangliste.csv`,'text/csv;charset=utf-8',csv)}

function hideMainSections(){['dashboardSection','authSection','settingsSection','seasonSection','setupSection','tournamentSection'].forEach(id=>$('#'+id)?.classList.add('hidden'))}
function renderNavigation(){
  const admin=isAdmin(),member=isMember(),guest=!admin&&!member;
  $('.club-settings-block')?.classList.remove('hidden');
  $('#showSettingsBtn')?.classList.toggle('hidden',!admin);
  $('#showSeasonBtn')?.classList.toggle('hidden',guest);
  const loginBtn=$('#showLoginBtn');if(loginBtn)loginBtn.textContent=admin?'Konto':member?'Mein Profil':'Anmelden';
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
function showLogin(){hideMainSections();$('#authSection')?.classList.remove('hidden');renderCloudPanel();renderNavigation()}
function showSettings(){if(!isAdmin()){showLogin();return}hideMainSections();$('#settingsSection').classList.remove('hidden');renderSettingsForm();renderNavigation()}
function renderSettingsForm(){
  $('#settingsMode').value='club';$('#settingsDefaultMode').value=appSettings.tournament.defaultMode||'swiss';$('#settingsDefaultFormat').value=appSettings.tournament.defaultFormat||'single';$('#settingsDefaultLegs').value=String(appSettings.tournament.defaultLegs||2);
  $('#settingsClubName').value=appSettings.club.name||'';$('#settingsClubLogo').value=appSettings.club.logo||'';$('#settingsClubColor').value=appSettings.club.color||appSettings.theme.primary;$('#settingsSeasonMode').value=appSettings.club.seasonMode||'halfyear';
  [5,4,3,2,1,0].forEach(n=>{$(`#points${n}`).value=appSettings.club.pointSystem[n]});
  const mode=themeModeForTheme();$('#themeMode').value=mode;renderThemePreview(mode);renderNavigation();renderReadonlyMode();
}
function renderThemePreview(mode=$('#themeMode')?.value||themeModeForTheme()){
  const box=$('#themePreview'),preset=themeModes[mode]||themeModes.light;if(!box)return;
  box.innerHTML=Object.entries(preset.theme).map(([key,value])=>`<span title="${esc(key)}" style="background:${esc(value)}"></span>`).join('')+`<small>${esc(preset.label)}</small>`;
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
function showSeason(){if(!isMember()&&!isAdmin()){showTournament();return}if(!isClubMode()){showDashboard();return}hideMainSections();$('#seasonSection').classList.remove('hidden');renderSeasonView();renderNavigation()}
function fillSeasonForm(){const h=currentHalfYear();$('#seasonName').value=h.name;$('#seasonStart').value=h.start;$('#seasonEnd').value=h.end;$('#seasonDrops').value='0'}
function closeMenu(){const hero=$('.hero'),btn=$('#menuToggle');hero?.classList.remove('nav-open');if(btn)btn.setAttribute('aria-expanded','false')}
document.addEventListener('submit',e=>{if(!isAdmin()&&e.target.closest('#settingsForm,#seasonForm,#memberForm,#manualTournamentForm')){e.preventDefault();assertAdminAction()}},true);
document.addEventListener('click',e=>{
  if(isAdmin())return;
  const blocked=e.target.closest('#addToSeasonBtn,#seasonActionSelect,[data-remove-member],[data-delete-tournament],#toggleManualTournament');
  if(blocked){e.preventDefault();e.stopPropagation();assertAdminAction()}
},true);
$('#menuToggle')?.addEventListener('click',e=>{e.stopPropagation();const hero=$('.hero'),open=!hero.classList.contains('nav-open');hero.classList.toggle('nav-open',open);e.currentTarget.setAttribute('aria-expanded',String(open))});
document.addEventListener('click',e=>{if(!e.target.closest('.hero'))closeMenu()});
$('.main-actions')?.addEventListener('click',e=>{if(e.target.closest('button'))closeMenu()});
$('#cloudAdminPanel').addEventListener('submit',e=>{
  e.preventDefault();
  if(e.target.id==='adminLoginForm')T20Cloud.signIn($('#adminEmail').value.trim(),$('#adminPassword').value);
  if(e.target.id==='memberLoginForm')T20Cloud.sendMagicLink($('#memberEmail').value.trim());
  if(e.target.id==='memberProfileForm')T20Cloud.saveProfile($('#profileDisplayName').value,$('#profileNickname').value);
});
$('#cloudAdminPanel').addEventListener('click',e=>{
  if(e.target.id==='adminLogoutBtn'||e.target.id==='memberLogoutBtn')T20Cloud.signOut();
  if(e.target.id==='removeAvatarBtn')T20Cloud.removeAvatar();
  if(e.target.id==='refreshMembersBtn')T20Cloud.refreshAdminProfiles();
  if(e.target.id==='closeAuthTabBtn'){try{window.close()}catch{}}
  if(e.target.id==='continueAuthTabBtn'){clearTimeout(T20Cloud.authHandoffCloseTimer);T20Cloud.authHandoffActive=false;showLogin()}
  if(e.target.id==='backupDownloadBtn')backupTriple20Data();
  if(e.target.id==='uploadLocalBtn')T20Cloud.uploadLocalWithBackup();
  if(e.target.id==='loadCloudBtn')T20Cloud.loadCloudConfirmed();
  if(e.target.id==='forceCloudBtn'){if(confirm('Lokale Daten wirklich in der Cloud überschreiben?'))T20Cloud.syncAll({force:true})}
});
$('#cloudAdminPanel').addEventListener('change',e=>{if(e.target.id==='backupImportInput')handleBackupImport(e.target.files?.[0]);if(e.target.id==='profileAvatarInput'&&e.target.files?.[0])openAvatarCrop(e.target.files[0]).catch(error=>{T20Cloud.authError=`Bild konnte nicht geöffnet werden: ${error?.message||'Unbekannter Fehler'}`;renderCloudPanel()})});
document.addEventListener('click',e=>{if(e.target.id==='cancelAvatarCropBtn'||e.target.id==='avatarCropOverlay')closeAvatarCrop();if(e.target.id==='saveAvatarCropBtn')saveAvatarCrop()});
$('#showTournamentBtn').addEventListener('click',showTournament);
$('#showSeasonBtn').addEventListener('click',showSeason);
$('#showSettingsBtn').addEventListener('click',showSettings);
$('#showLoginBtn').addEventListener('click',showLogin);
$('#themeMode').addEventListener('change',e=>renderThemePreview(e.target.value));
$('#settingsForm').addEventListener('submit',e=>{e.preventDefault();const themeMode=$('#themeMode').value,preset=themeModes[themeMode]||themeModes.light;updateSettings({appName:'Triple20',mode:$('#settingsMode').value,themeMode,club:{enabled:$('#settingsMode').value==='club',name:$('#settingsClubName').value.trim(),logo:$('#settingsClubLogo').value.trim(),color:$('#settingsClubColor').value,seasonMode:$('#settingsSeasonMode').value,dropResults:appSettings.club.dropResults,pointSystem:{5:+$('#points5').value,4:+$('#points4').value,3:+$('#points3').value,2:+$('#points2').value,1:+$('#points1').value,0:+$('#points0').value}},tournament:{defaultMode:$('#settingsDefaultMode').value,defaultFormat:$('#settingsDefaultFormat').value,defaultLegs:+$('#settingsDefaultLegs').value},theme:{...preset.theme}});applyTournamentDefaults();showDashboard()});
function createCurrentSeasonFromAction(){const h=currentHalfYear(),existing=seasonStore.seasons.find(s=>s.name===h.name);seasonFormOpen=false;if(existing){selectedSeasonId=existing.id;persistSeasons();renderSeasonView();return}createSeason({name:h.name,startDate:h.start,endDate:h.end,dropCount:+$('#seasonDrops').value||0})}
$('#seasonActionSelect').addEventListener('change',e=>{const action=e.target.value;e.target.value='';if(!action)return;if(action==='edit'){seasonFormOpen=!seasonFormOpen;renderSeasonView();return}if(action==='current'){createCurrentSeasonFromAction();return}const season=selectedSeason();if(!season)return;if(action==='archive'){if(!confirm(`${season.name} archivieren?`))return;season.archived=true;saveSeason(season);return}if(action==='delete'){if(!confirm(`Saison „${season.name}“ wirklich endgültig löschen? Alle Spieltage und Saisonpunkte dieser Saison werden entfernt.`))return;deleteSeason(season.id)}});
$('#seasonForm').addEventListener('submit',e=>{e.preventDefault();updateSeasonFromForm()});
$('#seasonSelect').addEventListener('change',e=>{selectedSeasonId=e.target.value;seasonFormOpen=false;manualTournamentOpen=false;persistSeasons();renderSeasonView()});
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
function reset(){if(state.started&&!confirm('Das aktuelle Turnier wirklich löschen?'))return;Object.assign(state,{players:[],playerProfileIds:{},started:false,matches:[],settings:{}});delete state.seasonImportedTo;delete state.savedToHistory;save();renderPlayers();renderTournament();showTournament()}
$('#resetBtn').onclick=reset;$('#liveResetBtn').onclick=reset;$('#finishReset').onclick=reset;registerAccess();applyTheme();applyTournamentDefaults();fillSeasonForm();renderPlayers();renderSettingsForm();renderNavigation();renderSeasonView();showTournament();T20Cloud.init();
