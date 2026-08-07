const $=s=>document.querySelector(s);
const SETTINGS_KEY='triple20_settings';
const TOURNAMENT_HISTORY_KEY='triple20_tournaments';
const MEMBER_TOURNAMENT_KEY='triple20_member_tournament';
const LIVE_RECOVERY_KEY='triple20_live_recovery';
const ACCESS_COUNT_KEY='triple20_access_count';
const ACCESS_DAILY_KEY='triple20_access_daily';
const ACCESS_SESSION_KEY='triple20_access_counted';
const SHOP_CONFIG_URL='shop-products.json';
const SHOP_DATA_KEY='triple20_recommendations';
const SHOP_CATEGORIES=[['all','Alle'],['darts','Darts'],['autodarts','Autodarts']];
const SHOP_FALLBACK={products:[]};
let shopConfig=SHOP_FALLBACK,shopCategory='all',shopLoaded=false,shopProductTarget='',shopAdminEditId='',shopAdminImage='',applyingRoute=false;
let resultGraphicBlob=null,resultGraphicFilename='Triple20_Ergebnis.png';
let tournamentRegistrationCounts={},tournamentRegistrations=[],registrationsLoading=false;
const CHECKIN_STORAGE_KEY='triple20_admin_checkins';
let adminCheckInEventKey='';
let recommendationClickStats={},recommendationClicksLoading=false;
const PENDING_RECOMMENDATION_CLICKS_KEY='triple20_pending_recommendation_clicks';
const SUPABASE_URL='https://hidjvylnxmtlvtiomktu.supabase.co';
const TRIPLE20_PUBLIC_URL='https://triple20.at/';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_IzH5CLw7baFsaU005Bqh7w_lRMlrMLo';
const PUSH_FUNCTION_NAME='triple20-push';
// Die geöffnete Saison ist eine persönliche Browser-Auswahl und darf nicht
// durch den regelmäßigen Cloud-Abgleich anderer Geräte überschrieben werden.
const CLOUD_DATA_KEYS=['dartTournament','tripleTwentySeasons','triple20_settings','triple20_tournaments'];
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
const legacyShopConfig=safeJsonParse(localStorage.getItem(SHOP_DATA_KEY)||'null');
if(!Array.isArray(appSettings.recommendations?.products)&&Array.isArray(legacyShopConfig?.products)){appSettings={...appSettings,recommendations:legacyShopConfig};saveSettings()}
const state=JSON.parse(localStorage.getItem('dartTournament')||'null')||{players:[],started:false,matches:[],settings:{}};
const liveRecovery=safeJsonParse(localStorage.getItem(LIVE_RECOVERY_KEY)||'null');
const stateHasLive=!!(state.started||Object.values(state.competitions||{}).some(competition=>competition?.started)),recoveryHasLive=!!(liveRecovery?.started||Object.values(liveRecovery?.competitions||{}).some(competition=>competition?.started));
if(!stateHasLive&&recoveryHasLive){Object.keys(state).forEach(key=>delete state[key]);Object.assign(state,liveRecovery)}
const SEASON_KEY='tripleTwentySeasons';
const seasonStore=loadSeasons();
let selectedSeasonId=localStorage.getItem('tripleTwentySelectedSeason')||'';
let manualTournamentOpen=false;
let seasonFormOpen=false;
let publicPastExpanded=false;
const expandedSeasonTournamentIds=new Set();
const COMPETITION_KEYS=['players','playerProfileIds','started','matches','settings','groups','withdrawn','endedEarly','savedToHistory','seasonImportedTo','seasonTournamentId','scheduledEventId','groupStage','scoreAudit','scoreUndoStack'];
function emptyCompetition(){return{players:[],playerProfileIds:{},started:false,matches:[],settings:{}}}
function competitionSnapshot(source=state){const out={};for(const key of COMPETITION_KEYS)if(source[key]!==undefined)out[key]=structuredClone(source[key]);return{...emptyCompetition(),...out}}
function ensureTournamentDayState(target=state){
  if(!target.competitions){
    const legacy=competitionSnapshot(target);
    target.competitions={men:legacy,women:emptyCompetition()};
    target.activeCompetition='men';
    target.eventName=target.eventName||legacy.settings?.eventName||legacy.settings?.name||'Freitag-Abend-Cup';
  }
  target.competitions.men=target.competitions.men||emptyCompetition();
  target.competitions.women=target.competitions.women||emptyCompetition();
  target.activeCompetition=['men','women'].includes(target.activeCompetition)?target.activeCompetition:'men';
  target.eventName=target.eventName||'Freitag-Abend-Cup';
  return target;
}
function syncActiveCompetition(){ensureTournamentDayState();state.competitions[state.activeCompetition]=competitionSnapshot()}
function loadActiveCompetition(){
  ensureTournamentDayState();
  const next=competitionSnapshot(state.competitions[state.activeCompetition]);
  for(const key of COMPETITION_KEYS)delete state[key];
  Object.assign(state,next);
}
function competitionLabel(key=state.activeCompetition){return key==='women'?'Damen':'Herren'}
function competitionTitle(){return `${state.eventName||'Spieltag'} – ${competitionLabel()}`}
function replaceTournamentState(next){Object.keys(state).forEach(key=>delete state[key]);Object.assign(state,next||emptyCompetition());ensureTournamentDayState();loadActiveCompetition()}
ensureTournamentDayState();loadActiveCompetition();
function emptyMemberTournament(){return{players:[],playerProfileIds:{},started:false,matches:[],settings:{},memberLocal:true}}
function loadMemberTournament(){return safeJsonParse(localStorage.getItem(MEMBER_TOURNAMENT_KEY)||'null')||emptyMemberTournament()}
function save(){
  if(isMember()&&T20Cloud.tournamentViewMode==='live')return;
  syncActiveCompetition();
  if(isMember()){state.memberLocal=true;localStorage.setItem(MEMBER_TOURNAMENT_KEY,JSON.stringify(state));return}
  if(isAdmin()){delete state.memberLocal;delete state.guestLocal}
  localStorage.setItem('dartTournament',JSON.stringify(state));
  if(isAdmin()){const live=!!(state.started||Object.values(state.competitions||{}).some(competition=>competition?.started));if(live)localStorage.setItem(LIVE_RECOVERY_KEY,JSON.stringify(state));else localStorage.removeItem(LIVE_RECOVERY_KEY)}
}
async function publishLiveTournament({notifyOnError=false}={}){
  if(!isAdmin())return false;
  if(!T20Cloud.client){if(notifyOnError)alert('Die Cloud-Verbindung ist noch nicht bereit. Bitte warte kurz und starte das Turnier anschließend erneut.');return false}
  await T20Cloud.syncAll({force:true});
  const published=!T20Cloud.pendingSync;
  if(!published&&notifyOnError)alert('Das Turnier wurde auf diesem PC gestartet, konnte aber nicht in die Cloud veröffentlicht werden. Bitte prüfe die Internetverbindung und den Statusbalken.');
  return published;
}
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
  const visibleSection=['publicHomeSection','authSection','settingsSection','seasonSection','shopSection','setupSection','tournamentSection'].find(id=>!$('#'+id)?.classList.contains('hidden'))||'';
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
  Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,incomingState);ensureTournamentDayState();loadActiveCompetition();
  const seasons=loadSeasons();seasonStore.seasons=seasons.seasons||[];
  selectedSeasonId=localStorage.getItem('tripleTwentySelectedSeason')||'';
  appSettings=loadSettings();
  const legacyRecommendations=safeJsonParse(localStorage.getItem(SHOP_DATA_KEY)||'null'),recommendations=Array.isArray(appSettings.recommendations?.products)?appSettings.recommendations:legacyRecommendations;
  if(Array.isArray(recommendations?.products)){shopConfig=recommendations;shopLoaded=true}
  linkKnownMemberIds();
  applyTheme();applyTournamentDefaults();renderPlayers();renderSettingsForm();renderSeasonView();renderTournament();
  if(!$('#shopSection')?.classList.contains('hidden'))renderShop();
  if(visibleSection==='publicHomeSection')showHome(false);
  else if(visibleSection==='authSection')showLogin();
  else if(visibleSection==='settingsSection')showSettings();
  else if(visibleSection==='seasonSection')showSeason();
  else if(visibleSection==='shopSection')showShop();
  else if(visibleSection==='tournamentSection'||visibleSection==='setupSection')showTournament();
}
function backupPreview(data=collectTriple20Data()){const seasons=data.tripleTwentySeasons?.seasons||[],tournaments=data.triple20_tournaments||[],current=data.dartTournament||{};return `${seasons.length} Saison(en), ${tournaments.length} gespeicherte Turnier(e), aktuelles Turnier: ${current.started?'läuft':'nicht gestartet'}${current.players?.length?`, ${current.players.length} Spieler`:''}`;}
function setSyncStatus(text,cls='view-only'){const bar=$('#syncStatusBar'),label=$('#syncStatusText');if(!bar||!label)return;bar.className=`sync-status ${cls}`;label.textContent=text;const last=$('#syncLastSaved');if(last)last.textContent=T20Cloud?.lastSyncAt?`Letzte Synchronisierung: ${new Date(T20Cloud.lastSyncAt).toLocaleString('de-AT')}`:'Noch nicht synchronisiert'}
function isAdmin(){return !!window.T20Cloud?.isAdmin}
function isMember(){return !!window.T20Cloud?.user&&!isAdmin()}
function assertAdminAction(){if(isAdmin())return true;alert('Nur die Turnierleitung darf Daten ändern. Du bist aktuell im Nur-Ansicht-Modus.');return false}
function canEditCurrentTournament(){return isAdmin()}
function assertTournamentAction(){if(canEditCurrentTournament())return true;alert('Dieses Vereinsturnier kann nur von der Turnierleitung geändert werden.');return false}
function renderReadonlyMode(){
  const admin=isAdmin(),member=isMember(),guest=!admin&&!member,readonly=!admin;
  document.body.classList.toggle('view-only',readonly);
  document.body.classList.toggle('admin-mode',admin);
  document.body.classList.toggle('member-mode',member);
  document.body.classList.toggle('guest-mode',guest);
  ['seasonActionSelect','addToSeasonBtn'].forEach(id=>{$('#'+id)?.classList.toggle('hidden',readonly)});
  document.querySelectorAll('#setupSection input,#setupSection select,#setupSection button').forEach(control=>{const disabled=!T20Cloud.authResolved||(member&&!state.memberLocal);control.disabled=disabled;control.setAttribute('aria-disabled',String(disabled))});
  document.querySelectorAll('.score-controls select,.score-controls button').forEach(control=>{const disabled=!canEditCurrentTournament()||!!state.endedEarly;control.disabled=disabled;control.setAttribute('aria-disabled',String(disabled))});
  document.querySelectorAll('#withdrawCard input,#withdrawCard select,#withdrawCard button,#qualificationCard button,#undoLastScoreBtn,#endTournamentBtn,#finishReset,#seasonImportCard input,#seasonImportCard select,#seasonImportCard button').forEach(control=>{const disabled=!canEditCurrentTournament();control.disabled=disabled;control.setAttribute('aria-disabled',String(disabled))});
  $('#showSettingsBtn')?.classList.toggle('hidden',!admin);
  $('#showSeasonBtn')?.classList.remove('hidden');
  const loginBtn=$('#showLoginBtn');if(loginBtn)loginBtn.textContent=admin?'Konto':member?'Mein Profil':'Anmelden';
  renderNavigation();
  if(readonly&&$('#settingsSection')&&!$('#settingsSection').classList.contains('hidden'))showLogin();
}
function replaceCloudPanelHtml(panel,html){
  const active=document.activeElement,activeId=active?.id||'',selection=active&&typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null;
  const values=Object.fromEntries([...panel.querySelectorAll('input[id],textarea[id],select[id]')].filter(input=>input.type!=='file').map(input=>[input.id,input.value]));
  const openDetails=new Set([...panel.querySelectorAll('details[id][open]')].map(details=>details.id));
  panel.innerHTML=html.replaceAll('sechsstelligen','achtstelligen').replaceAll('sechsstellige','achtstellige');
  const otpInput=panel.querySelector('#memberOtpCode');if(otpInput){otpInput.maxLength=8;otpInput.pattern='[0-9]{8}';otpInput.placeholder='8-stelliger Code'}
  Object.entries(values).forEach(([id,value])=>{const input=panel.querySelector(`#${id}`);if(input)input.value=value});
  openDetails.forEach(id=>{const details=panel.querySelector(`#${id}`);if(details)details.open=true});
  const nextActive=activeId?panel.querySelector(`#${activeId}`):null;
  if(nextActive){nextActive.focus({preventScroll:true});if(selection&&typeof nextActive.setSelectionRange==='function')nextActive.setSelectionRange(selection[0],selection[1])}
}
function renderAdminMembers(){
  const c=T20Cloud,profiles=c.adminProfiles||[];
  const cards=profiles.map(profile=>{
    const adminProfile=profile.id===c.user?.id,name=profile.display_name||(adminProfile?'Turnierleitung':'Name noch nicht eingetragen'),nickname=profile.nickname||(adminProfile?'Administrator':'Spitzname fehlt'),initial=esc((profile.nickname||profile.display_name||(adminProfile?'A':'?')).trim().charAt(0).toUpperCase()||'?'),photo=c.adminProfileAvatars?.[profile.id],avatar=photo?`<img src="${esc(photo)}" alt="">`:initial;
    const joined=profile.created_at?new Date(profile.created_at).toLocaleDateString('de-AT'):'–';
    const online=c.onlineUserIds?.has(profile.id);
    const lastSeen=online?'Jetzt online':profile.last_seen_at?`Zuletzt online: ${new Intl.DateTimeFormat('de-AT',{dateStyle:'medium',timeStyle:'short'}).format(new Date(profile.last_seen_at))}`:'Zuletzt online: noch nicht erfasst';
    return `<article class="admin-member-card ${adminProfile?'admin-account':''}"><span class="profile-avatar">${avatar}</span><div><strong>${esc(nickname)} <i class="online-dot ${online?'is-online':''}" title="${online?'Online':'Offline'}"></i></strong><span>${esc(name)}</span><small>${adminProfile?'Administratorkonto · ':''}Registriert seit ${esc(joined)}</small><small>${esc(lastSeen)}</small></div></article>`;
  }).join('');
  return `<section class="admin-members"><div class="admin-section-heading"><div><h3>Registrierte Mitglieder</h3><p class="view-note">${profiles.length} Profil${profiles.length===1?'':'e'} vorhanden</p></div><button id="refreshMembersBtn" class="secondary" type="button" ${c.adminProfilesBusy?'disabled':''}>${c.adminProfilesBusy?'Wird geladen …':'Aktualisieren'}</button></div><div class="admin-member-grid">${cards||'<p class="view-note">Noch keine Mitgliederprofile vorhanden.</p>'}</div></section>`;
}
const PushNotifications={
  supported:'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window,
  busy:false,enabled:false,error:'',message:'',subscriberCount:null,
  async registration(){return withTimeout(navigator.serviceWorker.ready,10000,'Die installierte App konnte den Push-Dienst nicht starten. Bitte Triple20 vollständig schließen, neu öffnen und das Update bestätigen.')},
  async invoke(body){const client=requireSupabaseClient(),result=await withTimeout(client.functions.invoke(PUSH_FUNCTION_NAME,{body}),15000,'Die Supabase-Push-Funktion antwortet nicht. Bitte die Function-Logs prüfen.');const {data,error}=result;if(error){let detail='';try{detail=await error.context?.json?.()}catch{}throw new Error(detail?.error||error.message||'Fehler in der Supabase-Push-Funktion.')}return data||{}},
  async refresh({render=true}={}){
    this.error='';
    if(!this.supported||!T20Cloud.user){this.enabled=false;if(render)renderCloudPanel();return}
    try{const registration=await this.registration(),subscription=await registration.pushManager.getSubscription();this.enabled=!!subscription;if(isAdmin()){const config=await this.invoke({action:'config'});this.subscriberCount=Number.isFinite(+config.subscriberCount)?+config.subscriberCount:null}}
    catch(error){console.warn('Push-Status konnte nicht geladen werden:',error);this.error='Push-Dienst ist noch nicht vollständig eingerichtet.'}
    if(render)renderCloudPanel();
  },
  async enable(){
    if(this.busy||!T20Cloud.user)return;this.busy=true;this.error='';this.message='';renderCloudPanel();
    try{if(!this.supported)throw new Error('Push-Nachrichten werden von diesem Browser nicht unterstützt.');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Benachrichtigungen wurden nicht erlaubt. Du kannst die Freigabe in den Browser-Einstellungen ändern.');const {publicKey}=await this.invoke({action:'config'});if(!publicKey)throw new Error('Der Push-Dienst ist noch nicht fertig eingerichtet.');const registration=await this.registration();let subscription=await withTimeout(registration.pushManager.getSubscription(),8000,'Vorhandene Push-Anmeldung konnte nicht geprüft werden.');if(!subscription)subscription=await withTimeout(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(publicKey)}),15000,'Das Gerät konnte nicht für Push registriert werden. Bitte Benachrichtigungen in den iPhone-Einstellungen erlauben.');const json=subscription.toJSON(),client=requireSupabaseClient(),result=await withTimeout(client.from('triple20_push_subscriptions').upsert({user_id:T20Cloud.user.id,endpoint:json.endpoint,p256dh:json.keys?.p256dh,auth:json.keys?.auth,user_agent:navigator.userAgent,updated_at:new Date().toISOString()},{onConflict:'endpoint'}),12000,'Die Geräteanmeldung konnte nicht online gespeichert werden.'),{error}=result;if(error)throw error;this.enabled=true;this.message='Push-Nachrichten sind auf diesem Gerät aktiviert.'}
    catch(error){console.error('Push aktivieren fehlgeschlagen:',error);this.error=error?.message||'Push-Nachrichten konnten nicht aktiviert werden.'}
    finally{this.busy=false;renderCloudPanel()}
  },
  async disable(){
    if(this.busy||!T20Cloud.user)return;this.busy=true;this.error='';this.message='';renderCloudPanel();
    try{const registration=await this.registration(),subscription=await registration.pushManager.getSubscription();if(subscription){const client=requireSupabaseClient();await client.from('triple20_push_subscriptions').delete().eq('endpoint',subscription.endpoint);await subscription.unsubscribe()}this.enabled=false;this.message='Push-Nachrichten wurden auf diesem Gerät deaktiviert.'}
    catch(error){this.error=error?.message||'Push-Nachrichten konnten nicht deaktiviert werden.'}
    finally{this.busy=false;renderCloudPanel()}
  },
  async send(title,body,url){
    if(this.busy||!isAdmin())return;this.busy=true;this.error='';this.message='';renderCloudPanel();
    try{const result=await this.invoke({action:'send',title:title.trim(),body:body.trim(),url:url?.trim()||'/'});this.message=`Nachricht versendet: ${result.sent||0} Geräte erreicht${result.removed?`, ${result.removed} alte Anmeldung entfernt`:''}.`;this.subscriberCount=result.subscriberCount??this.subscriberCount}
    catch(error){console.error('Push-Versand fehlgeschlagen:',error);this.error=error?.context?.message||error?.message||'Nachricht konnte nicht versendet werden.'}
    finally{this.busy=false;renderCloudPanel()}
  },
  async sendLiveTournament(){
    // Nur ein über den offiziellen Admin-Check-in übernommener Termin besitzt
    // eine scheduledEventId. Frei gestartete Trainings- und Testturniere lösen
    // bewusst keine Nachricht an alle Mitglieder aus.
    if(!isAdmin()||!state.scheduledEventId)return;
    const eventKey=`${state.scheduledEventId}|${state.activeCompetition||'open'}`;
    const title=`Jetzt live: ${state.eventName||'Dartturnier'}`,body=`Der Bewerb ${competitionLabel()} wurde gestartet. Spielplan und Ergebnisse sind jetzt live verfügbar.`;
    try{await this.invoke({action:'live',eventKey,title,body,url:'/?bereich=live'})}
    catch(error){console.warn('Automatische Live-Nachricht konnte nicht versendet werden:',error)}
  }
};
window.PushNotifications=PushNotifications;
function urlBase64ToUint8Array(value){const padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(base64);return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)))}
function renderMemberPush(){const p=PushNotifications,ios=/iphone|ipad|ipod/i.test(navigator.userAgent),standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;if(!p.supported)return `<section class="push-card"><div><span class="eyebrow">BENACHRICHTIGUNGEN</span><h3>Auf diesem Browser nicht verfügbar</h3><p>Bitte verwende einen aktuellen Browser.${ios&&!standalone?' Auf iPhone und iPad muss Triple20 zuerst zum Home-Bildschirm hinzugefügt werden.':''}</p></div></section>`;return `<section class="push-card ${p.enabled?'is-enabled':''}"><div><span class="eyebrow">BENACHRICHTIGUNGEN</span><h3>${p.enabled?'Push ist aktiviert':'Nichts mehr verpassen'}</h3><p>${p.enabled?'Dieses Gerät erhält Hinweise zu Spieltagen und wichtigen Vereinsmeldungen.':'Erhalte Hinweise zu neuen Spieltagen, Änderungen und wichtigen Vereinsmeldungen.'}</p>${ios&&!standalone?'<small>Auf iPhone/iPad: Triple20 zuerst über „Teilen → Zum Home-Bildschirm“ installieren und dort öffnen.</small>':''}</div><button id="${p.enabled?'disablePushBtn':'enablePushBtn'}" class="${p.enabled?'secondary':'primary'}" type="button" ${p.busy?'disabled':''}>${p.busy?'BITTE WARTEN …':p.enabled?'Deaktivieren':'PUSH AKTIVIEREN'}</button>${p.error?`<p class="login-error">${esc(p.error)}</p>`:''}${p.message?`<p class="login-success">${esc(p.message)}</p>`:''}</section>`}
function renderAdminPush(){const p=PushNotifications,count=p.subscriberCount===null?'–':p.subscriberCount;return `<section class="admin-push"><div class="admin-section-heading"><div><span class="eyebrow">PUSH-NACHRICHTEN</span><h3>Mitglieder direkt informieren</h3><p class="view-note">${count} aktivierte${count===1?'s Gerät':' Geräte'} erreichbar</p></div></div><form id="adminPushForm" class="admin-push-form"><label>Titel<input id="pushTitle" maxlength="60" value="Triple20" required></label><label>Nachricht<textarea id="pushBody" maxlength="180" placeholder="z. B. Anmeldung für Freitag ist geöffnet." required></textarea></label><label>Ziel in der App<select id="pushUrl"><option value="/">Startseite</option><option value="/?bereich=saison">Saisonwertung</option><option value="/?bereich=live">Live-Turnier</option><option value="/?bereich=konto">Konto</option></select></label><button class="primary" type="submit" ${p.busy?'disabled':''}>${p.busy?'WIRD GESENDET …':'AN ALLE SENDEN'}</button></form>${p.error?`<p class="login-error">${esc(p.error)}</p>`:''}${p.message?`<p class="login-success">${esc(p.message)}</p>`:''}</section>`}
function upcomingAdminEvents(){
  const today=todayIso();return publicTournamentRecords().filter(item=>(item.planned||item.date>=today)&&item.date>=today).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.startTime||'').localeCompare(b.startTime||''));
}
function adminCheckInStore(){return safeJsonParse(localStorage.getItem(CHECKIN_STORAGE_KEY)||'{}',{})}
function saveAdminCheckIn(eventKey,data){const store=adminCheckInStore();store[eventKey]=data;localStorage.setItem(CHECKIN_STORAGE_KEY,JSON.stringify(store))}
function checkInData(event){
  const eventKey=registrationEventKey(event),saved=adminCheckInStore()[eventKey],registered=tournamentRegistrations.filter(row=>row.event_key===eventKey);
  if(saved&&Array.isArray(saved.ids)&&Array.isArray(saved.guests))return saved;
  return{ids:registered.map(row=>row.user_id),guests:[]};
}
function renderAdminCheckIn(){
  if(!adminCheckInEventKey)return'';
  const event=upcomingAdminEvents().find(item=>registrationEventKey(item)===adminCheckInEventKey);if(!event)return'';
  const data=checkInData(event),selected=new Set(data.ids),registeredIds=new Set(tournamentRegistrations.filter(row=>row.event_key===adminCheckInEventKey).map(row=>row.user_id)),profiles=[...(T20Cloud.adminProfiles||[])].sort((a,b)=>Number(registeredIds.has(b.id))-Number(registeredIds.has(a.id))||(a.nickname||a.display_name||'').localeCompare(b.nickname||b.display_name||'','de'));
  const rows=profiles.map(profile=>{const name=profile.nickname||profile.display_name||'Profil ohne Namen',registered=registeredIds.has(profile.id);return `<label class="checkin-member ${selected.has(profile.id)?'is-present':''}"><input type="checkbox" data-checkin-user="${esc(profile.id)}" ${selected.has(profile.id)?'checked':''}><span class="profile-avatar">${esc(name.trim().charAt(0).toUpperCase()||'?')}</span><span><b>${esc(name)}</b><small>${registered?'Angemeldet':'Mitglied'}</small></span><strong>${selected.has(profile.id)?'Anwesend':'Fehlt'}</strong></label>`}).join('');
  const guests=data.guests.map((name,index)=>`<span class="checkin-guest">${esc(name)}<button type="button" data-checkin-remove-guest="${index}" aria-label="${esc(name)} entfernen">×</button></span>`).join('');
  return `<section class="admin-checkin"><div class="admin-section-heading"><div><span class="eyebrow">TURNIER-CHECK-IN</span><h3>${esc(event.name||'Spieltag')}</h3><p class="view-note">${publicDate(event.date)}${publicStartTime(event)?` · ${esc(publicStartTime(event))}`:''} · ${esc(event.competitionLabel||'Offen')}</p></div><button class="secondary" type="button" data-checkin-close>Schließen</button></div><div class="checkin-summary"><b>${selected.size+data.guests.length}</b><span>anwesend</span><small>${registeredIds.size} vorher angemeldet</small></div><div class="checkin-list">${rows||'<p class="view-note">Noch keine Mitgliederprofile vorhanden.</p>'}</div><form id="checkInGuestForm" class="checkin-guest-form"><input id="checkInGuestName" maxlength="30" placeholder="Gast hinzufügen"><button class="secondary" type="submit">Hinzufügen</button></form>${guests?`<div class="checkin-guests">${guests}</div>`:''}<button class="primary checkin-transfer" type="button" data-checkin-transfer>ANWESENDE INS TURNIER ÜBERNEHMEN <span>→</span></button></section>`;
}
function renderAdminDashboard(){
  const upcoming=upcomingAdminEvents(),next=upcoming[0],nextKey=next?registrationEventKey(next):'',registered=next?tournamentRegistrationCounts[nextKey]||0:0,live=Object.values(state.competitions||{}).filter(item=>item?.started).length,online=T20Cloud.onlineUserIds?.size||0,lastSync=T20Cloud.lastSyncAt?new Date(T20Cloud.lastSyncAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'}):'–';
  return `<section class="admin-dashboard"><div class="admin-section-heading"><div><span class="eyebrow">ADMIN-DASHBOARD</span><h3>Vereinsbetrieb auf einen Blick</h3></div><button class="secondary" type="button" data-admin-home>Öffentliche Startseite</button></div><div class="admin-dashboard-grid"><article><small>Mitglieder</small><b>${T20Cloud.adminProfiles?.length||0}</b><span>${online} gerade online</span></article><article><small>Nächstes Turnier</small><b>${next?publicDate(next.date):'–'}</b><span>${next?esc(next.name||'Spieltag'):'Kein Termin geplant'}</span></article><article><small>Anmeldungen</small><b>${registered}</b><span>${next?'für den nächsten Termin':'Kein Termin gewählt'}</span></article><article><small>Live</small><b>${live}</b><span>${live===1?'Bewerb läuft':live?'Bewerbe laufen':'Derzeit kein Bewerb'}</span></article></div><div class="admin-dashboard-actions">${next?`<button class="primary" type="button" data-admin-checkin="${esc(nextKey)}">CHECK-IN FÜR NÄCHSTES TURNIER <span>→</span></button>`:'<button class="primary" type="button" data-admin-home>TERMIN EINTRAGEN <span>→</span></button>'}<button class="secondary" type="button" data-admin-tournament>Turnierverwaltung öffnen</button><small>Letzter Cloud-Abgleich: ${esc(lastSync)}</small></div>${upcoming.length>1?`<div class="admin-upcoming-list"><h4>Weitere Termine</h4>${upcoming.slice(1,5).map(event=>{const key=registrationEventKey(event);return `<button type="button" data-admin-checkin="${esc(key)}"><span>${publicDate(event.date)} · ${esc(event.name||'Spieltag')}</span><b>${tournamentRegistrationCounts[key]||0} Anmeldungen</b></button>`}).join('')}</div>`:''}</section>${renderAdminCheckIn()}`;
}
function renderPersonalMemberOverview(){
  const c=T20Cloud,userId=c.user?.id||'',nickname=c.profile?.nickname?.trim()||'',seasons=[...(seasonStore.seasons||[])].sort((a,b)=>Number(!!a.archived)-Number(!!b.archived)||(b.startDate||'').localeCompare(a.startDate||''));
  const ownRows=seasons.map(season=>{const rows=calculateSeasonStandings(season),row=rows.find(item=>(userId&&item.profileId===userId)||(nickname&&normalizedPlayerName(item.name)===normalizedPlayerName(nickname)));return row?{season,row,rank:rows.indexOf(row)+1}:null}).filter(Boolean);
  const current=ownRows.find(item=>!item.season.archived&&(!item.season.startDate||item.season.startDate<=todayIso())&&(!item.season.endDate||item.season.endDate>=todayIso()))||ownRows.find(item=>!item.season.archived)||ownRows[0];
  const next=publicTournamentRecords().filter(item=>(item.planned||item.date>todayIso())&&item.date>=todayIso()).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.startTime||'').localeCompare(b.startTime||''))[0];
  if(!current)return `<section class="personal-overview personal-overview-empty"><div><span class="eyebrow">MEINE ÜBERSICHT</span><h3>Noch keine Saisonzuordnung</h3><p>Dein Profil ist noch mit keinem Spieler in einer Saison verknüpft. Bitte die Turnierleitung, dein Mitgliederprofil einmalig zuzuordnen.</p></div>${next?`<aside><small>Nächster Spieltag</small><b>${esc(next.name||next.eventName||'Spieltag')}</b><span>${publicDate(next.date)}${publicStartTime(next)?` · ${esc(publicStartTime(next))}`:''}</span></aside>`:''}</section>`;
  const {season,row,rank}=current,recent=row.entries.filter(entry=>entry.present).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,3),balance=row.wins+row.losses?`${row.wins} : ${row.losses}`:'0 : 0';
  return `<section class="personal-overview"><div class="personal-overview-head"><div><span class="eyebrow">MEINE ÜBERSICHT</span><h3>${esc(season.name)}</h3><p>${esc(row.name)} · Persönliche Saisonwerte</p></div><div class="personal-overview-actions"><button class="secondary" type="button" data-member-profile="${esc(playerProfileReference(row))}">Mein öffentliches Profil</button><button class="secondary" type="button" data-member-season="${esc(season.id)}">Rangliste öffnen</button></div></div><div class="personal-stat-grid"><article><small>Rang</small><b>${rank}</b></article><article><small>Punkte</small><b>${row.cleanPoints}</b></article><article><small>Turniere</small><b>${row.played}</b></article><article><small>Siege : Niederlagen</small><b>${balance}</b></article></div><div class="personal-overview-detail"><section><h4>Letzte Ergebnisse</h4>${recent.length?`<div class="personal-results">${recent.map(entry=>`<div><span><b>${publicDate(entry.date)}</b>${esc(entry.name||'Spieltag')}</span><strong>${entry.rank?`${entry.rank}. Platz · `:''}${entry.points} Pkt.</strong></div>`).join('')}</div>`:'<p class="view-note">Noch kein gespielter Termin vorhanden.</p>'}</section><section class="personal-next-event"><h4>Nächster Spieltag</h4>${next?`<b>${esc(next.name||next.eventName||'Spieltag')}</b><p>${publicDate(next.date)}${publicStartTime(next)?` · ${esc(publicStartTime(next))}`:''}</p><small>${esc([next.competitionLabel,next.seasonName].filter(Boolean).join(' · ')||'Weitere Informationen folgen')}</small><button class="link-btn" type="button" data-member-home>Alle Termine öffnen</button>`:'<p class="view-note">Derzeit ist kein zukünftiger Spieltag eingetragen.</p>'}</section></div></section>`;
}
function renderCloudPanel(){
  const panel=$('#cloudAdminPanel');if(!panel||!window.T20Cloud)return;
  const c=T20Cloud,summary=backupPreview();
  if(c.authHandoffActive){panel.innerHTML=`<section class="auth-handoff"><span>✓</span><h3>Anmeldung erfolgreich</h3><p>Triple20 ist bereits in einem anderen Tab geöffnet. Dieser Tab wird geschlossen.</p><div><button id="closeAuthTabBtn" class="primary" type="button">DIESES FENSTER SCHLIESSEN</button><button id="continueAuthTabBtn" class="secondary" type="button">HIER WEITER</button></div></section>`;return}
  if(!c.session){const memberLogin=c.otpEmail?`<form id="memberCodeForm" class="member-code-form"><label>Anmeldecode für <b>${esc(c.otpEmail)}</b><input id="memberOtpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="6-stelliger Code" required></label><button class="primary" type="submit">${c.otpVerifyBusy?'Wird geprüft …':'CODE BESTÄTIGEN'}</button><button id="changeMemberEmailBtn" class="secondary" type="button">Andere E-Mail</button><button id="resendMemberCodeBtn" class="link-btn" type="button" ${c.magicLinkBusy?'disabled':''}>${c.magicLinkBusy?'Code wird gesendet …':'Neuen Code senden'}</button></form>`:`<form id="memberLoginForm" class="member-login"><input id="memberEmail" type="email" placeholder="E-Mail-Adresse" autocomplete="email" required><button class="primary" type="submit">${c.magicLinkBusy?'Code wird gesendet …':'ANMELDECODE ANFORDERN'}</button></form>`;replaceCloudPanelHtml(panel,`<div class="account-grid"><section><h3>Mitglieder-Anmeldung</h3><p class="view-note">Du erhältst einen sechsstelligen Code per E-Mail. Gib ihn direkt hier in der installierten Triple20-App ein. Die Anmeldung bleibt gespeichert, bis du dich bewusst abmeldest.</p><p id="loginError" class="login-error">${esc(c.authError||'')}</p><p class="login-success ${c.authMessage?'':'hidden'}">${esc(c.authMessage||'')}</p>${memberLogin}</section><section><h3>Turnierleitung</h3><p class="view-note">Administratoren melden sich weiterhin mit Passwort an.</p><form id="adminLoginForm" class="cloud-login"><input id="adminEmail" type="email" placeholder="Admin-E-Mail" autocomplete="email" required><input id="adminPassword" type="password" placeholder="Passwort" autocomplete="current-password" required><button id="adminLoginBtn" class="secondary" type="submit">${c.loginBusy?'Wird angemeldet …':'Anmelden'}</button></form></section></div>`);return}
  if(!c.isAdmin){
    const p=c.profile||{},initial=esc((p.nickname||p.display_name||c.user?.email||'?').trim().charAt(0).toUpperCase()||'?'),avatar=c.avatarSignedUrl?`<img src="${esc(c.avatarSignedUrl)}" alt="Profilfoto">`:initial,nickname=p.nickname||'Spitzname noch nicht eingetragen';
    replaceCloudPanelHtml(panel,`<section class="member-profile"><div class="profile-heading"><div><span class="profile-avatar">${avatar}</span><div><h3>${esc(nickname)}</h3><p class="view-note">${esc(p.display_name||'Vor- und Zuname fehlen')} · ${esc(c.user?.email||'')}</p></div></div><button id="memberLogoutBtn" class="secondary" type="button">Abmelden</button></div>${renderPersonalMemberOverview()}<details id="memberAccountSettings" class="member-account-settings"><summary><span><b>Profil &amp; Benachrichtigungen</b><small>Push, Profilfoto und persönliche Daten verwalten</small></span><i aria-hidden="true">⌄</i></summary><div class="member-account-settings-body">${renderMemberPush()}<section class="member-profile-settings"><div class="member-settings-heading"><span class="eyebrow">PROFIL</span><h3>Persönliche Angaben</h3></div><div class="avatar-actions"><label class="secondary avatar-upload">${c.avatarBusy?'Bild wird verarbeitet …':'Profilfoto auswählen'}<input id="profileAvatarInput" type="file" accept="image/*" ${c.avatarBusy?'disabled':''}></label>${p.avatar_url?`<button id="removeAvatarBtn" class="danger" type="button" ${c.avatarBusy?'disabled':''}>Foto entfernen</button>`:''}<small>iPhone-Fotos, JPEG, PNG oder WebP · wird auf 512 × 512 Pixel verkleinert · maximal 1 MB</small></div><p id="loginError" class="login-error">${esc(c.authError||'')}</p><p class="login-success ${c.authMessage?'':'hidden'}">${esc(c.authMessage||'')}</p><form id="memberProfileForm" class="profile-form"><label>Spitzname<input id="profileNickname" maxlength="30" value="${esc(p.nickname||'')}" placeholder="Öffentlicher Spielname" required></label><label>Vor- und Zuname<input id="profileDisplayName" maxlength="60" value="${esc(p.display_name||'')}" placeholder="z. B. Markus Mustermann" autocomplete="name" required></label><button class="primary" type="submit">${c.profileBusy?'Wird gespeichert …':'PROFIL SPEICHERN'}</button></form><p class="view-note">Der Spitzname wird bei Turnieren und Ranglisten angezeigt. Der vollständige Name bleibt im geschützten Profil.</p></section></div></details></section>`);return
  }
  replaceCloudPanelHtml(panel,`${renderAdminDashboard()}${renderAdminPush()}${renderAdminMembers()}${renderAccessStats()}<h3>Online-Speicherung</h3><p class="view-note">${esc(summary)}</p><div class="cloud-actions"><button id="backupDownloadBtn" class="cloud-action-btn" type="button">Backup herunterladen</button><label class="cloud-action-btn backup-file">Backup einspielen<input id="backupImportInput" type="file" accept="application/json"></label><button id="uploadLocalBtn" class="cloud-action-btn" type="button">Lokale Daten in die Cloud übernehmen</button><button id="loadCloudBtn" class="cloud-action-btn" type="button">Cloud-Daten laden</button><button id="forceCloudBtn" class="cloud-action-btn danger-cloud" type="button">Cloud überschreiben</button><button id="adminLogoutBtn" class="cloud-action-btn" type="button">Abmelden</button></div>`);
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
  const asImage=blob=>new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Bild konnte nicht direkt geöffnet werden.'))};image.src=url});
  try{return await createImageBitmap(file)}catch{}
  try{return await asImage(file)}catch{}
  const sources=['https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js','https://unpkg.com/heic2any@0.0.4/dist/heic2any.min.js'];let loadError=null;
  if(typeof window.heic2any!=='function')for(const source of sources){try{await loadScript(source);if(typeof window.heic2any==='function')break}catch(error){loadError=error}}
  if(typeof window.heic2any!=='function')throw loadError||new Error('Die iPhone-Fotokonvertierung konnte nicht geladen werden.');
  const converted=await window.heic2any({blob:file,toType:'image/jpeg',quality:.9}),jpeg=Array.isArray(converted)?converted[0]:converted;
  try{return await createImageBitmap(jpeg)}catch{return await asImage(jpeg)}
}
function drawAvatarCrop(){
  const canvas=$('#avatarCropCanvas'),bitmap=AvatarCrop.bitmap;if(!canvas||!bitmap)return;
  const size=canvas.width,scale=Math.max(size/bitmap.width,size/bitmap.height)*AvatarCrop.zoom,maxX=Math.max(0,(bitmap.width*scale-size)/2),maxY=Math.max(0,(bitmap.height*scale-size)/2);
  AvatarCrop.panX=Math.max(-maxX,Math.min(maxX,AvatarCrop.panX));AvatarCrop.panY=Math.max(-maxY,Math.min(maxY,AvatarCrop.panY));
  const context=canvas.getContext('2d');context.clearRect(0,0,size,size);context.drawImage(bitmap,(size-bitmap.width*scale)/2+AvatarCrop.panX,(size-bitmap.height*scale)/2+AvatarCrop.panY,bitmap.width*scale,bitmap.height*scale);
}
async function openAvatarCrop(file){
  if(!file||(!file.type.startsWith('image/')&&!/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name||''))){T20Cloud.authError='Bitte eine Bilddatei auswählen.';renderCloudPanel();return}
  if(file.size>50*1024*1024){T20Cloud.authError='Das Ausgangsbild ist größer als 50 MB.';renderCloudPanel();return}
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
function authRedirectErrorMessage(){
  const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.replace(/^#/,'')),description=query.get('error_description')||hash.get('error_description'),code=query.get('error_code')||hash.get('error_code')||query.get('error')||hash.get('error');
  if(!description&&!code)return'';
  return `Der Anmeldelink ist ungültig, abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen Link an.${description?` (${description.replaceAll('+',' ')})`:''}`;
}
function cleanAuthRedirectUrl(){
  const url=new URL(location.href),authKeys=['code','token_hash','type','error','error_code','error_description'];
  authKeys.forEach(key=>url.searchParams.delete(key));
  if(/[=#&](access_token|refresh_token|expires_in|token_type|error|error_code|error_description)=/.test(url.hash))url.hash='';
  history.replaceState({},document.title,url.pathname+(url.searchParams.size?`?${url.searchParams}`:'')+url.hash);
}
window.T20Cloud={
  authResolved:false,
  liveTournamentState:null,tournamentViewMode:'local',
  client:null,ready:false,initPromise:null,authListenerStarted:false,session:null,user:null,isAdmin:false,profile:null,avatarSignedUrl:'',online:false,syncing:false,authBusy:false,sessionProcessingPromise:null,authRedirectSessionPromise:null,authRedirectSessionResolve:null,loginBusy:false,magicLinkBusy:false,otpVerifyBusy:false,otpEmail:'',profileBusy:false,avatarBusy:false,authHandoffActive:false,authHandoffCloseTimer:null,adminProfilesBusy:false,adminProfiles:[],adminProfileAvatars:{},publicMembers:[],publicMemberAvatars:{},presenceChannel:null,onlineUserIds:new Set(),lastSeenTimer:null,lastSeenVisibilityBound:false,authMessage:'',authError:'',loadBusy:false,pendingSync:localStorage.getItem('triple20_pending_sync')==='1',lastSyncAt:localStorage.getItem('triple20_last_sync')||'',cloudUpdated:{},loadedCloudData:null,pollTimer:null,memberPollTimer:null,authRedirectPending:/[?#&](code|token_hash|access_token|refresh_token|error|error_code|error_description)=/.test(location.href),
  async finishAuthRedirect(){cleanAuthRedirectUrl();this.authHandoffActive=false;this.authMessage='Anmeldung erfolgreich. Du kannst diesen Tab weiterverwenden.';showLogin();renderCloudPanel()},
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
          if(this.authRedirectPending)this.authRedirectSessionPromise=new Promise(resolve=>{this.authRedirectSessionResolve=resolve});
          this.client.auth.onAuthStateChange((event,session)=>{if(session&&this.authRedirectSessionResolve){this.authRedirectSessionResolve(session);this.authRedirectSessionResolve=null}setTimeout(()=>this.setSession(session||null,{authEvent:event}),0)});
          this.authListenerStarted=true;
        }
        this.ready=true;
        renderCloudPanel();
        await this.restoreSessionAfterInit();
        try{await this.loadPublicMembers()}catch(error){console.warn('Öffentliche Spielerprofile konnten nicht geladen werden:',error)}
        this.startPolling();
        setLoginError('');
      }catch(error){
        console.error('Supabase-Initialisierung fehlgeschlagen:',error);
        this.client=null;supabaseClient=null;this.ready=false;this.authResolved=true;this.initPromise=null;
        setSyncStatus('Offline – lokale Kopie','offline');
        renderReadonlyMode();renderCloudPanel();setLoginError(error.message);
      }
    })();
    return this.initPromise;
  },
  async restoreSessionAfterInit(){
    try{
      let session=null,lastError=null;
      for(let attempt=0;attempt<3;attempt++){try{const result=await withTimeout(this.client.auth.getSession(),10000,'Gespeicherte Sitzung konnte nicht rechtzeitig geladen werden.');if(result.error)throw result.error;session=result.data.session;lastError=null;break}catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,600))}}
      if(lastError&&!session)throw lastError;
      if(!session&&this.authRedirectPending){
        session=await Promise.race([this.authRedirectSessionPromise||Promise.resolve(null),new Promise(resolve=>setTimeout(()=>resolve(null),8000))]);
        if(!session){const result=await this.client.auth.getSession();if(result.error)throw result.error;session=result.data.session}
        if(!session){this.authError=authRedirectErrorMessage()||'Der Anmeldelink konnte nicht bestätigt werden. Er ist möglicherweise abgelaufen oder bereits verwendet. Bitte fordere einen neuen Link an.';this.authMessage='';this.authRedirectPending=false;cleanAuthRedirectUrl();await this.setSession(null);showLogin();renderCloudPanel();return}
      }
      await this.setSession(session||null);
      renderCloudPanel();
      try{await this.loadCloud({initial:true});if(this.isAdmin&&state.started)await publishLiveTournament({notifyOnError:true})}catch(e){console.warn('Cloud-Startladen fehlgeschlagen',e)}
    }catch(error){
      console.warn('Session nach Start konnte nicht geladen werden:',error);
      this.authError=authRedirectErrorMessage()||`Anmeldung konnte nicht abgeschlossen werden: ${error?.message||'Bitte fordere einen neuen Link an.'}`;this.authMessage='';this.authRedirectPending=false;cleanAuthRedirectUrl();setSyncStatus('Nur Ansicht','view-only');showLogin();renderCloudPanel();
    }
  },
  setSession(session,options={}){
    if(!session&&options.authEvent==='INITIAL_SESSION'&&this.session)return Promise.resolve();
    if(session?.access_token&&this.session?.access_token===session.access_token&&this.authResolved)return this.sessionProcessingPromise||Promise.resolve();
    const previous=this.sessionProcessingPromise||Promise.resolve();
    const current=previous.catch(error=>console.warn('Vorherige Sitzungsverarbeitung fehlgeschlagen:',error)).then(()=>this.processSession(session,options));
    this.sessionProcessingPromise=current;
    return current.finally(()=>{if(this.sessionProcessingPromise===current)this.sessionProcessingPromise=null});
  },
  async processSession(session,{loadCloud=false}={}){
    this.authBusy=true;
    try{
      if(!session&&this.presenceChannel)await this.stopPresence();
      this.session=session;this.user=session?.user||null;this.authResolved=true;this.isAdmin=false;this.profile=null;this.avatarSignedUrl='';
      if(this.user){
        this.authMessage=this.authRedirectPending?'Anmeldung erfolgreich. Dein Profil wird geladen …':'';
        renderReadonlyMode();renderCloudPanel();setSyncStatus('Anmeldung bestätigt …','saving');
        if(this.authRedirectPending){this.authRedirectPending=false;cleanAuthRedirectUrl();showLogin();renderCloudPanel()}
      }
      if(this.user)this.isAdmin=await this.checkAdmin(this.user.id);
      if(this.isAdmin){
        const stranded=loadMemberTournament(),hasStrandedLive=!!(stranded.started||Object.values(stranded.competitions||{}).some(competition=>competition?.started));
        if(hasStrandedLive&&!state.started&&!Object.values(state.competitions||{}).some(competition=>competition?.started)){replaceTournamentState(structuredClone(stranded));delete state.memberLocal;delete state.guestLocal;localStorage.removeItem(MEMBER_TOURNAMENT_KEY);save()}
        else if(state.memberLocal||state.guestLocal)save();
      }
      if(this.user&&!this.isAdmin&&state.guestLocal){Object.keys(state).forEach(key=>delete state[key]);Object.assign(state,{players:[],playerProfileIds:{},started:false,matches:[],settings:{}});localStorage.removeItem('dartTournament');localStorage.removeItem('triple20_pending_sync');this.pendingSync=false}
      if(this.user&&!this.isAdmin)this.tournamentViewMode='live';
      if(this.isAdmin&&localStorage.getItem('triple20_identity_pending')==='1'){this.pendingSync=true;localStorage.setItem('triple20_pending_sync','1');localStorage.removeItem('triple20_identity_pending')}
      if(this.user&&this.isAdmin)try{await this.loadAdminProfiles()}catch(error){console.warn('Mitgliederprofile konnten nach der Anmeldung nicht geladen werden:',error)}
      if(this.user&&this.isAdmin)try{await loadTournamentRegistrations()}catch(error){console.warn('Turnieranmeldungen konnten nach der Anmeldung nicht geladen werden:',error)}
      if(this.user&&!this.isAdmin)try{this.profile=await this.loadProfile()}catch(error){console.warn('Profil konnte nach der Anmeldung nicht geladen werden:',error);this.profile={id:this.user.id,display_name:'',nickname:'',avatar_url:null};this.authError='Du bist angemeldet, aber dein Profil konnte noch nicht geladen werden. Bitte aktualisiere die Seite.'}
      if(this.user){this.startPresence();this.startLastSeenTracking()}
      renderReadonlyMode();renderCloudPanel();
      if(this.user)PushNotifications.refresh().catch(error=>console.warn('Push-Status konnte nicht geprüft werden:',error));
      if(!$('#setupSection')?.classList.contains('hidden')||!$('#tournamentSection')?.classList.contains('hidden'))showTournament();
      if(this.user&&!this.isAdmin){this.authMessage='';setSyncStatus('Angemeldet – Mitglied','view-only');renderCloudPanel();return}
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
  async stopPresence(){clearInterval(this.lastSeenTimer);this.lastSeenTimer=null;if(this.presenceChannel&&this.client)await this.client.removeChannel(this.presenceChannel);this.presenceChannel=null;this.onlineUserIds=new Set()},
  async touchLastSeen(){
    if(!this.client||!this.user||document.visibilityState==='hidden')return;
    const {error}=await this.client.rpc('triple20_touch_last_seen_v1');
    if(error)console.warn('„Zuletzt online“ konnte nicht aktualisiert werden:',error);
  },
  startLastSeenTracking(){
    clearInterval(this.lastSeenTimer);this.touchLastSeen();
    this.lastSeenTimer=setInterval(()=>this.touchLastSeen(),5*60*1000);
    if(!this.lastSeenVisibilityBound){document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&this.user)this.touchLastSeen()});this.lastSeenVisibilityBound=true}
  },
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
    const client=requireSupabaseClient(),{data,error}=await client.from('triple20_profiles').select('id,display_name,nickname,avatar_url,created_at,last_seen_at').order('nickname',{ascending:true,nullsFirst:false});
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
  async sendLoginCode(email=this.otpEmail){
    if(this.magicLinkBusy)return;const cleanEmail=email.trim().toLowerCase();if(!cleanEmail)return;
    this.magicLinkBusy=true;this.authMessage='';this.authError='';renderCloudPanel();
    try{if(!this.ready||!this.client)await this.init();if(!this.client)throw new Error('Supabase konnte nicht initialisiert werden.');const {error}=await withTimeout(this.client.auth.signInWithOtp({email:cleanEmail,options:{shouldCreateUser:false}}),15000,'Der Anmeldecode konnte nicht rechtzeitig versendet werden.');if(error)throw error;this.otpEmail=cleanEmail;this.authMessage='Der sechsstellige Anmeldecode wurde versendet. Bitte prüfe auch den Spam-Ordner.'}
    catch(error){console.error('Mitglieder-Anmeldecode fehlgeschlagen:',error);this.authMessage='';this.authError=`Anmeldecode konnte nicht gesendet werden: ${error?.message||'Bitte später erneut versuchen.'}`}
    finally{this.magicLinkBusy=false;renderCloudPanel();setTimeout(()=>$('#memberOtpCode')?.focus(),0)}
  },
  async verifyLoginCode(token){
    if(this.otpVerifyBusy||!this.otpEmail)return;const cleanToken=String(token||'').replace(/\D/g,'');if(cleanToken.length!==8){this.authError='Bitte den vollständigen achtstelligen Code eingeben.';this.authMessage='';renderCloudPanel();return}
    this.otpVerifyBusy=true;this.authError='';this.authMessage='Code wird geprüft …';renderCloudPanel();
    try{if(!this.ready||!this.client)await this.init();const {data,error}=await withTimeout(this.client.auth.verifyOtp({email:this.otpEmail,token:cleanToken,type:'email'}),15000,'Die Prüfung dauert zu lange. Bitte erneut versuchen.');if(error)throw error;if(!data?.session)throw new Error('Keine gültige Anmeldung erhalten.');this.otpEmail='';this.authMessage='Anmeldung erfolgreich.';await this.setSession(data.session)}
    catch(error){console.error('Anmeldecode prüfen fehlgeschlagen:',error);this.authMessage='';this.authError=`Code ungültig oder abgelaufen: ${error?.message||'Bitte einen neuen Code anfordern.'}`}
    finally{this.otpVerifyBusy=false;renderCloudPanel()}
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
    if(this.isAdmin&&this.client){clearTimeout(this.syncTimer);await this.syncAll({force:true});if(this.pendingSync){alert('Abmeldung abgebrochen: Die letzten Änderungen konnten noch nicht in der Cloud gespeichert werden. Bitte prüfe die Internetverbindung und versuche es erneut.');return}}
    try{await this.stopPresence();if(this.client)await this.client.auth.signOut()}catch(e){console.warn('Abmeldung fehlgeschlagen',e)}
    localStorage.removeItem('triple20_admin_uid');
    this.session=null;this.user=null;this.isAdmin=false;this.profile=null;this.avatarSignedUrl='';this.authMessage='';this.authError='';
    if(state.memberLocal)replaceTournamentState({players:[],playerProfileIds:{},started:false,matches:[],settings:{},guestLocal:true});
    renderReadonlyMode();renderCloudPanel();setSyncStatus('Nur Ansicht','view-only');showHome();
  },
  async fetchCloud(){const client=requireSupabaseClient();const {data,error}=await client.from('triple20_data').select('data_key,data,updated_at').in('data_key',CLOUD_DATA_KEYS);if(error)throw error;this.online=true;return data||[]},
  rowsToObject(rows){return Object.fromEntries(CLOUD_DATA_KEYS.map(k=>{const row=rows.find(r=>r.data_key===k);if(row?.updated_at)this.cloudUpdated[k]=row.updated_at;return[k,row?row.data:null]}))},
  async loadCloud({initial=false}={}){
    if(this.loadBusy)return;
    this.loadBusy=true;
    try{
      const rows=await this.fetchCloud(),cloud=this.rowsToObject(rows),hasCloud=rows.length&&Object.values(cloud).some(v=>v!==null&&v!==undefined);
      this.loadedCloudData=cloud;this.lastSyncAt=new Date().toISOString();localStorage.setItem('triple20_last_sync',this.lastSyncAt);
      if(this.user&&!this.isAdmin){const selectedCompetition=state.activeCompetition||'men';this.liveTournamentState=structuredClone(cloud.dartTournament||{players:[],playerProfileIds:{},started:false,matches:[],settings:{}});if(this.liveTournamentState.competitions?.[selectedCompetition])this.liveTournamentState.activeCompetition=selectedCompetition;applyTriple20Data({...cloud,dartTournament:this.liveTournamentState});setSyncStatus('Angemeldet – Mitglied','view-only');return}
      if(this.isAdmin&&this.pendingSync){await this.syncAll();return}
      if(!hasCloud){setSyncStatus(this.isAdmin&&hasMeaningfulLocalData()?'Online – Cloud leer, lokale Daten vorhanden':'Online – aktuell','online');renderCloudPanel();return}
      if(!this.user){applyTriple20Data(cloud);setSyncStatus('Öffentliche Daten aktuell','view-only');return}
      if(!this.isAdmin&&(state.started||state.players?.length||state.matches?.length)){setSyncStatus('Offline – lokales Turnier','offline');renderCloudPanel();return}
      if(initial&&!hasMeaningfulLocalData()){applyTriple20Data(cloud);setSyncStatus(this.isAdmin?'Online – aktuell':'Nur Ansicht',this.isAdmin?'online':'view-only');return}
      if(!this.isAdmin){applyTriple20Data(cloud);setSyncStatus('Nur Ansicht','view-only');return}
      setSyncStatus('Online – aktuell','online');renderCloudPanel();
    }catch(e){console.warn('Cloud laden fehlgeschlagen',e);this.online=false;setSyncStatus('Offline – lokale Kopie','offline')}
    finally{this.loadBusy=false}
  },
  queueSync(key){if(!this.isAdmin)return;this.pendingSync=true;localStorage.setItem('triple20_pending_sync','1');clearTimeout(this.syncTimer);if(!this.client||!navigator.onLine){setSyncStatus('Offline – sicher auf diesem Gerät gespeichert','offline');return}setSyncStatus('Änderungen werden gespeichert …','saving');this.syncTimer=setTimeout(()=>this.syncAll(),700)},
  async syncAll({force=false}={}){
    if(!this.isAdmin||!this.client)return;
    clearTimeout(this.syncTimer);
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
  startPolling(){clearInterval(this.pollTimer);clearInterval(this.memberPollTimer);this.pollTimer=setInterval(()=>this.loadCloud(),15000);this.memberPollTimer=setInterval(()=>{if(!this.user)return;this.loadPublicMembers().then(()=>{if(!$('#seasonSection')?.classList.contains('hidden'))renderSeasonView()}).catch(error=>console.warn('Mitgliedsnamen konnten nicht aktualisiert werden',error))},60000)}
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
function normalizedPlayerName(name){return (name||'').trim().replace(/\s+/g,' ').toLowerCase()}
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
  if(!T20Cloud.user&&!state.guestLocal){Object.keys(state).forEach(key=>delete state[key]);Object.assign(state,{players:[],playerProfileIds:{},started:false,matches:[],settings:{},guestLocal:true})}
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
  const season=selectedSeason(),entered=new Set(state.players.map(player=>player.toLowerCase())),choices=new Map();
  seasonMembers(season).forEach(storedName=>{const profileId=season?.memberProfileIds?.[storedName]||memberIdForName(storedName),name=currentMemberNickname(profileId,storedName).trim();if(name)choices.set(profileId?`id:${profileId}`:`name:${name.toLowerCase()}`,{name,profileId})});
  registeredMemberProfiles().forEach(profile=>{const name=profile.nickname.trim();choices.set(`id:${profile.id}`,{name,profileId:profile.id})});
  const members=[...choices.values()].filter(member=>!entered.has(member.name.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name,'de'));
  box.className=`registered-player-choices ${members.length?'':'hidden'}`;
  box.innerHTML=members.length?`<div class="registered-player-title"><strong>Gespeicherte Mitglieder</strong><small>Zum Hinzufügen anklicken</small></div><div class="registered-player-grid">${members.map(member=>{const photo=member.profileId?T20Cloud.adminProfileAvatars?.[member.profileId]||memberAvatarUrl(member.profileId):'',avatar=photo?`<img src="${esc(photo)}" alt="">`:esc(member.name.charAt(0).toUpperCase());return `<button type="button" class="registered-player" data-add-profile="${esc(member.name)}" data-profile-id="${esc(member.profileId||'')}"><span class="profile-avatar">${avatar}</span><span>${esc(member.name)}</span><b>+</b></button>`}).join('')}</div>`:'';
}
function renderPlayers(){
  if(!T20Cloud.user&&!state.guestLocal&&(state.players?.length||state.matches?.length)){ $('#playerList').innerHTML='';$('#playerCount').textContent='0 Spieler eingetragen';$('#memberSuggestions').innerHTML='';$('#registeredPlayerChoices')?.classList.add('hidden');$('#startBtn').disabled=true;return }
  if(!state.started)state.players=sortBySeasonWins(state.players);
  $('#playerList').innerHTML=state.players.map((p,i)=>`<div class="player"><b><span>${i+1}</span>${esc(p)}</b><button data-remove="${i}" aria-label="${esc(p)} entfernen">×</button></div>`).join('');
  $('#playerCount').textContent=`${state.players.length} Spieler eingetragen`;
  renderMemberSuggestions();
  renderRegisteredPlayerChoices();
  $('#startBtn').disabled=state.players.length<2;save();
}
function renderTournamentSubnav(){const nav=$('#tournamentSubnav');if(!nav)return;nav.classList.add('hidden');nav.innerHTML=''}
function setTournamentViewMode(mode){if(!isMember()||!['local','live'].includes(mode)||T20Cloud.tournamentViewMode===mode)return;if(T20Cloud.tournamentViewMode==='local')save();T20Cloud.tournamentViewMode=mode;replaceTournamentState(mode==='live'?structuredClone(T20Cloud.liveTournamentState||{players:[],playerProfileIds:{},started:false,matches:[],settings:{}}):loadMemberTournament());renderPlayers();showTournament()}
function renderCompetitionNav(){
  const nav=$('#competitionNav');if(!nav)return;
  ensureTournamentDayState();
  nav.innerHTML=['men','women'].map(key=>{const competition=key===state.activeCompetition?competitionSnapshot():state.competitions[key],prepared=competition.started||competition.players?.length,open=competition.matches?.filter(match=>match.sa===null).length||0,status=competition.started?` · ${open} offen`:prepared?' · vorbereitet':'';return `<button type="button" class="${key===state.activeCompetition?'active':''}" data-competition="${key}">${competitionLabel(key)}${status}</button>`}).join('');
}
function setActiveCompetition(key){
  if(!['men','women'].includes(key)||key===state.activeCompetition)return;
  if(!state.started&&$('#tournamentName')?.value.trim())state.eventName=$('#tournamentName').value.trim();
  syncActiveCompetition();state.activeCompetition=key;loadActiveCompetition();save();renderPlayers();showTournament();
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
function swissPairings(players,history,scores={}){
  const gap=(a,b)=>Math.abs((scores[a]||0)-(scores[b]||0));
  if(players.length<2)return{pairs:[],repeats:0,scoreGap:0};
  if(players.length>16){const rest=[...players],pairs=[];while(rest.length>1){const a=rest.shift(),order=rest.map((b,i)=>i).sort((i,j)=>Number(hasPlayed(history,a,rest[i]))-Number(hasPlayed(history,a,rest[j]))||gap(a,rest[i])-gap(a,rest[j])||i-j),opponent=order[0]??0;pairs.push([a,rest.splice(opponent,1)[0]])}return{pairs,repeats:pairs.filter(p=>hasPlayed(history,p[0],p[1])).length,scoreGap:pairs.reduce((sum,p)=>sum+gap(p[0],p[1]),0)}}
  const memo=new Map(),solve=list=>{
    if(list.length<2)return{pairs:[],repeats:0,scoreGap:0};
    const key=list.join('\u0000');if(memo.has(key))return memo.get(key);
    const a=list[0],rest=list.slice(1),order=rest.map((b,i)=>i).sort((i,j)=>Number(hasPlayed(history,a,rest[i]))-Number(hasPlayed(history,a,rest[j]))||gap(a,rest[i])-gap(a,rest[j])||i-j);let best=null;
    for(const i of order){const b=rest[i],repeat=hasPlayed(history,a,b)?1:0,pairGap=gap(a,b);if(best&&repeat>best.repeats)continue;const tail=solve(rest.filter((_,idx)=>idx!==i)),candidate={pairs:[[a,b],...tail.pairs],repeats:repeat+tail.repeats,scoreGap:pairGap+tail.scoreGap};if(!best||candidate.repeats<best.repeats||(candidate.repeats===best.repeats&&candidate.scoreGap<best.scoreGap))best=candidate}
    const result=best||{pairs:[],repeats:0,scoreGap:0};memo.set(key,result);return result;
  };
  return solve(players);
}
function swissRound(round,history=[]){
  const active=activeSwissPlayers(),arr=[],rows=round===1?[]:standingsFor(active,history),ranked=round===1?seasonSeededPlayers(active):rows.map(r=>r.name),scores=Object.fromEntries((round===1?ranked.map(name=>({name,pts:0})):rows).map(r=>[r.name,r.pts||0])),players=[...ranked];
  if(players.length%2){
    const bye=[...players].reverse().find(p=>!history.some(m=>m.a===p&&m.b==='Freilos'))||players.at(-1);
    players.splice(players.indexOf(bye),1);arr.push({a:bye,b:'Freilos',sa:1,sb:0,round,bracket:'swiss'});
  }
  swissPairings(players,history,scores).pairs.forEach(([a,b])=>arr.push({a,b,sa:null,sb:null,round,bracket:'swiss'}));
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
$('#startBtn').addEventListener('click',async()=>{state.eventName=$('#tournamentName').value.trim()||'Dartturnier';state.withdrawn=[];state.scoreAudit=[];state.scoreUndoStack=[];delete state.endedEarly;delete state.savedToHistory;delete state.seasonImportedTo;delete state.seasonTournamentId;state.settings={name:competitionTitle(),eventName:state.eventName,competition:state.activeCompetition,mode:$('#mode').value,legs:+$('#legs').value,start:+$('#startScore').value,groupCount:+$('#groupCount').value,qualifiers:+$('#qualifiers').value,swissRounds:+$('#swissRounds').value};state.matches=makeMatches();state.started=true;save();renderTournament();const published=await publishLiveTournament({notifyOnError:true});if(published)await PushNotifications.sendLiveTournament()});

function playerLosses(){const losses=Object.fromEntries(state.players.map(p=>[p,0]));state.matches.filter(m=>m.sa!==null&&m.b!=='Freilos').forEach(m=>{losses[m.sa>m.sb?m.b:m.a]++});return losses}
function standingsFor(players,matches=state.matches){return players.map(name=>{const played=matches.filter(m=>m.sa!==null&&(m.a===name||m.b===name));let w=0,lf=0,la=0;played.forEach(m=>{const own=m.a===name?m.sa:m.sb,other=m.a===name?m.sb:m.sa;lf+=own;la+=other;if(own>other)w++});return{name,p:played.length,w,l:played.length-w,lf,la,pts:w*2}}).sort((a,b)=>b.pts-a.pts||(b.lf-b.la)-(a.lf-a.la)||b.lf-a.lf)}
function standings(){return standingsFor(state.players)}
function modeName(){return state.settings.mode==='roundrobin'?'Jeder gegen jeden':state.settings.mode==='swiss'?'Schweizer System':state.settings.mode==='double'?'Doppel-K.-o.-Turnier':'K.-o.-Turnier'}
function champion(){
  if(state.endedEarly)return standings()[0]?.name||'';
  if(state.settings.mode==='roundrobin')return state.groups?.length>1?'':state.matches.every(m=>m.sa!==null)?standings()[0]?.name:'';
  if(state.settings.mode==='swiss'){const active=activeSwissPlayers();if(active.length<=1&&state.matches.every(m=>m.sa!==null))return active[0]||standings()[0]?.name||'';return state.matches.every(m=>m.sa!==null)&&Math.max(...state.matches.map(m=>m.round||1))>=(state.settings.swissRounds||4)?standings()[0]?.name:''}
  const limit=state.settings.mode==='double'?2:1,losses=playerLosses(),active=state.players.filter(p=>losses[p]<limit);
  return active.length===1&&state.matches.every(m=>m.sa!==null)?active[0]:'';
}
function renderTournament(){
  const route=new URLSearchParams(location.search);if(route.get('bereich')==='live')selectLiveCompetition(route.get('bewerb')||'men');
  renderTournamentSubnav();renderCompetitionNav();$('#memberLiveEmpty')?.classList.add('hidden');
  if(isMember()&&T20Cloud.tournamentViewMode==='live'&&!state.started){$('#setupSection').classList.add('hidden');$('#tournamentSection').classList.add('hidden');$('#memberLiveEmpty')?.classList.remove('hidden');renderReadonlyMode();return}
  if(!T20Cloud.user&&!state.started){$('#setupSection').classList.add('hidden');$('#tournamentSection').classList.add('hidden');$('#memberLiveEmpty')?.classList.remove('hidden');renderReadonlyMode();return}
  if(!state.started){$('#setupSection').classList.remove('hidden');$('#tournamentSection').classList.add('hidden');$('#tournamentName').value=state.eventName||'Freitag-Abend-Cup';renderReadonlyMode();return}
  const noBracket=state.settings.mode==='roundrobin'||state.settings.mode==='swiss';
  $('#setupSection').classList.add('hidden');$('#tournamentSection').classList.remove('hidden');$('#bracketTab').classList.toggle('hidden',noBracket);
  if(noBracket&&$('#bracketTab').classList.contains('active')){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelector('[data-tab="matches"]').classList.add('active');$('#matchesView').classList.remove('hidden');$('#bracketView').classList.add('hidden');$('#tableView').classList.add('hidden')}
  $('#liveCompetitionLabel').textContent=`${competitionLabel().toUpperCase()} · LIVE-TURNIER`;$('#liveTitle').textContent=state.eventName||state.settings.eventName||state.settings.name;$('#liveMeta').textContent=`${state.players.length} Teilnehmende · ${modeName()} · ${state.settings.start}`;
  const refreshed=T20Cloud.lastSyncAt?new Date(T20Cloud.lastSyncAt).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'';$('#liveViewerStatus').textContent=refreshed?`Automatisch aktuell · zuletzt ${refreshed} Uhr`:'Automatische Aktualisierung alle 15 Sekunden';
  $('#showLiveQrBtn')?.classList.toggle('hidden',!isAdmin());
  $('#renameEventBtn')?.classList.toggle('hidden',!isAdmin());
  $('#undoLastScoreBtn')?.classList.toggle('hidden',!isAdmin()||!(state.scoreUndoStack||[]).length||!!state.seasonImportedTo);
  $('#endTournamentBtn')?.classList.toggle('hidden',!isAdmin()||!!champion());
  const done=state.matches.filter(m=>m.sa!==null).length;$('#progressText').textContent=(state.matches.length?Math.round(done/state.matches.length*100):0)+'%';
  const indexedMatches=state.matches.map((match,index)=>({match,index})),viewerOrder=isAdmin()?indexedMatches:[...indexedMatches].sort((a,b)=>Number(a.match.sa!==null)-Number(b.match.sa!==null)||a.index-b.index),firstOpenIndex=viewerOrder.find(item=>item.match.sa===null&&item.match.b!=='Freilos')?.index;
  $('#matchList').innerHTML=viewerOrder.map(({match:m,index:i})=>{const current=!isAdmin()&&i===firstOpenIndex,completed=m.sa!==null;return `<article class="match ${completed?'done':''} ${current?'current-live-match':''}">${current?'<div class="current-live-label">AKTUELL · NÄCHSTES SPIEL</div>':''}<div class="match-no">${m.group!==undefined?'Gruppe '+String.fromCharCode(65+m.group)+' · ':''}Runde ${m.round} · ${m.bracket==='lower'?'Verlierer':m.bracket==='grand'?'Finale':'Spiel'} ${String(i+1).padStart(2,'0')}</div><div class="players-match"><span class="${m.sa>m.sb?'winner-player':''}">${esc(m.a)}</span><b>${completed?m.sa+' : '+m.sb:'VS'}</b><span class="${m.sb>m.sa?'winner-player':''}">${esc(m.b)}</span></div><div class="score-controls">${m.b==='Freilos'?'Weiter':`<select data-sa="${i}">${options(m.sa)}</select><span>:</span><select data-sb="${i}">${options(m.sb)}</select><button data-save="${i}" aria-label="${completed?'Ergebnis korrigieren':'Ergebnis speichern'}" title="${completed?'Ergebnis korrigieren':'Ergebnis speichern'}">${completed?'Ändern':'✓'}</button>`}</div></article>`}).join('');
  renderScoreHistory();renderTable();renderBracket();renderQualification();renderWithdrawCard();const winner=champion();$('#winnerCard').classList.toggle('hidden',!winner);if(winner){$('#winnerName').textContent=winner;saveTournamentToHistory()}renderSeasonImport(winner);save();renderReadonlyMode();
}
function options(current){let s='<option value="">–</option>';for(let i=0;i<=state.settings.legs;i++)s+=`<option ${current===i?'selected':''}>${i}</option>`;return s}
function renderWithdrawCard(){
  const card=$('#withdrawCard');if(!card)return;
  const visible=state.started&&state.settings.mode==='swiss'&&!champion()&&canEditCurrentTournament();
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
  if(!canEditCurrentTournament()||!state.started||state.settings.mode!=='swiss'||!name)return;
  state.withdrawn=state.withdrawn||[];if(state.withdrawn.includes(name))return;
  const status=canRebuildSwissRound();if(!status)return;
  const {round,roundStarted,current}=status,hasOpenMatch=current.some(m=>(m.a===name||m.b===name));
  state.withdrawn.push(name);
  if(!roundStarted||hasOpenMatch)rebuildSwissRound(round);
  save();renderTournament();
}
function joinSwissPlayer(name){
  name=(name||'').trim();if(!canEditCurrentTournament()||!state.started||state.settings.mode!=='swiss'||!name)return;
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
function scoreMatchLabel(match,index){return `Runde ${match.round||1} · ${match.a} gegen ${match.b} · Spiel ${index+1}`}
function pushScoreAudit(entry){state.scoreAudit=state.scoreAudit||[];state.scoreAudit.push({id:`score-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,at:new Date().toISOString(),actor:'Administrator',...entry});state.scoreAudit=state.scoreAudit.slice(-30)}
function renderScoreHistory(){
  const card=$('#scoreHistoryCard');if(!card)return;const entries=(state.scoreAudit||[]).slice(-8).reverse();card.classList.toggle('hidden',!isAdmin()||!entries.length);if(!isAdmin()||!entries.length){card.innerHTML='';return}
  card.innerHTML=`<div class="score-history-heading"><div><span class="eyebrow">ÄNDERUNGSPROTOKOLL</span><h3>Letzte Ergebnisänderungen</h3></div><small>Nur für Administratoren sichtbar</small></div><div class="score-history-list">${entries.map(entry=>`<article><span>${entry.action==='undo'?'↶':entry.action==='correct'?'↻':'✓'}</span><div><b>${esc(entry.label||'Spiel')}</b><small>${esc(entry.actor||'Administrator')} · ${entry.action==='undo'?'Rückgängig gemacht':entry.action==='correct'?`${esc(entry.before||'–')} → ${esc(entry.after||'–')}`:`Ergebnis ${esc(entry.after||'–')} gespeichert`} · ${new Date(entry.at).toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})} Uhr</small></div></article>`).join('')}</div>`;
}
function detachCompletedScoreRecord(){
  if(state.seasonImportedTo){alert('Dieses Turnier wurde bereits in die Saisonwertung übernommen. Ergebnisse können danach nicht mehr verändert werden.');return false}
  if(state.savedToHistory){localStorage.setItem(TOURNAMENT_HISTORY_KEY,JSON.stringify(loadTournamentHistory().filter(item=>item.id!==state.savedToHistory)));delete state.savedToHistory}
  delete state.endedEarly;return true
}
async function saveMatchScore(index,sa,sb){
  const match=state.matches[index];if(!match)return;const oldScore=match.sa===null?null:`${match.sa}:${match.sb}`,newScore=`${sa}:${sb}`;if(oldScore===newScore){alert('Dieses Ergebnis ist bereits gespeichert.');return}if(!detachCompletedScoreRecord())return;
  const laterMatches=state.settings.mode==='roundrobin'?[]:state.matches.filter(item=>(item.round||1)>(match.round||1));if(laterMatches.some(item=>item.sa!==null&&item.b!=='Freilos')){alert('In einer späteren Runde wurden bereits Ergebnisse gespeichert. Bitte mache zuerst die jeweils letzten Ergebnisse rückgängig.');return}
  const matchesBefore=structuredClone(state.matches),label=scoreMatchLabel(match,index);if(laterMatches.length)state.matches=state.matches.filter(item=>(item.round||1)<=(match.round||1));const target=state.matches[index];if(!target)return;target.sa=sa;target.sb=sb;advanceElimination();state.scoreUndoStack=state.scoreUndoStack||[];state.scoreUndoStack.push({at:new Date().toISOString(),label,matchesBefore});state.scoreUndoStack=state.scoreUndoStack.slice(-20);pushScoreAudit({action:oldScore===null?'save':'correct',label,before:oldScore,after:newScore});renderTournament();await publishLiveTournament()
}
async function undoLastScore(){
  if(!isAdmin()||!state.started)return;const stack=state.scoreUndoStack||[],last=stack.at(-1);if(!last)return;if(!confirm(`Letzte Ergebnisänderung rückgängig machen?\n\n${last.label}`))return;if(!detachCompletedScoreRecord())return;state.matches=structuredClone(last.matchesBefore||[]);stack.pop();pushScoreAudit({action:'undo',label:last.label});save();renderTournament();await publishLiveTournament({notifyOnError:true})
}
$('#matchList').addEventListener('click',async e=>{const i=e.target.dataset.save;if(i===undefined)return;if(!assertTournamentAction())return;const a=$(`[data-sa="${i}"]`).value,b=$(`[data-sb="${i}"]`).value;if(a===''||b===''||a===b){alert('Bitte ein eindeutiges Ergebnis eintragen.');return}if(Math.max(+a,+b)!==state.settings.legs){alert(`Der Sieger benötigt ${state.settings.legs} Legs.`);return}await saveMatchScore(+i,+a,+b)});
$('#withdrawCard').addEventListener('click',e=>{
  if((e.target.id==='withdrawPlayerBtn'||e.target.id==='joinPlayerBtn')&&!assertTournamentAction())return;
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
function tournamentByes(name,matches){return matches.filter(m=>m.a===name&&m.b==='Freilos').length}
function pointsForWins(wins,pointSystem=defaultPointSystem()){return pointSystem[Math.min(5,wins)]??0}
function buildCurrentTournamentRecord(){
  const rows=standings(),pointSystem=defaultPointSystem(),date=$('#seasonTournamentDate')?.value||todayIso(),stats={};
  document.querySelectorAll('[data-stat-player]').forEach(row=>{const p=row.dataset.statPlayer;stats[p]={max180:+(row.querySelector('[data-stat-180]')?.value||0),checkout:+(row.querySelector('[data-stat-checkout]')?.value||0)}});
  const playerProfileIds=Object.fromEntries(state.players.map(name=>[name,state.playerProfileIds?.[name]||memberIdForName(name)]).filter(([,id])=>id));
  const results=state.players.map(name=>{const wins=tournamentWins(name,state.matches),losses=tournamentLosses(name,state.matches),byes=tournamentByes(name,state.matches),row=rows.find(r=>r.name===name)||{},profileId=playerProfileIds[name]||'';return{name,profileId,wins,losses,byes,rank:(rows.findIndex(r=>r.name===name)+1)||0,legsFor:row.lf||0,legsAgainst:row.la||0,points:pointsForWins(wins,pointSystem)+byes,max180:stats[name]?.max180||0,checkout:stats[name]?.checkout||0}});
  return{id:`tournament-${Date.now()}`,scheduledEventId:state.scheduledEventId||'',name:competitionTitle(),eventName:state.eventName||'',competition:state.activeCompetition,competitionLabel:competitionLabel(),date,mode:state.settings.mode,players:[...state.players],participantCount:state.players.length,winner:rows[0]?.name||'',top3:rows.slice(0,3).map(r=>r.name),playerProfileIds,settings:{...state.settings,name:competitionTitle(),eventName:state.eventName,competition:state.activeCompetition},matches:state.matches.map(m=>({...m})),results,createdAt:new Date().toISOString()};
}
function loadTournamentHistory(){try{const data=JSON.parse(localStorage.getItem(TOURNAMENT_HISTORY_KEY)||'[]');return Array.isArray(data)?data:[]}catch{return[]}}
function saveTournamentToHistory(){
  if(!T20Cloud.user||state.savedToHistory||!state.matches?.length||(!state.endedEarly&&!state.matches.every(m=>m.sa!==null)))return;
  const history=loadTournamentHistory(),record=buildCurrentTournamentRecord();history.push(record);localStorage.setItem(TOURNAMENT_HISTORY_KEY,JSON.stringify(history));state.savedToHistory=record.id;save();
}
function exportCurrentTournamentJson(){const record=state.savedToHistory?loadTournamentHistory().find(t=>t.id===state.savedToHistory)||buildCurrentTournamentRecord():buildCurrentTournamentRecord();downloadFile(`${(record.name||'Turnier').replaceAll(' ','_')}.json`,'application/json',JSON.stringify(record,null,2))}
function seasonMembers(season=selectedSeason()){return [...new Set((season?.members!==undefined?season.members:season?.players)||[])].sort((a,b)=>a.localeCompare(b,'de'))}
function saveSeasonMembers(season,names){season.members=[...new Set(names.map(n=>n.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));season.memberProfileIds=season.memberProfileIds||{};season.members.forEach(name=>{const id=season.memberProfileIds[name]||memberIdForName(name);if(id)season.memberProfileIds[name]=id});season.players=[...new Set([...(season.tournaments||[]).flatMap(t=>t.players||[]),...season.members])].sort((a,b)=>a.localeCompare(b,'de'));saveSeason(season)}
function renderMemberSuggestions(){const list=$('#memberSuggestions'),season=selectedSeason();if(!list)return;if(!T20Cloud.user){list.innerHTML='';return}const entered=new Set(state.players.map(p=>p.toLowerCase())),names=seasonMembers(season).map(storedName=>currentMemberNickname(season?.memberProfileIds?.[storedName],storedName)),unique=[...new Map(names.filter(Boolean).map(name=>[name.toLowerCase(),name])).values()];list.innerHTML=unique.filter(name=>!entered.has(name.toLowerCase())).map(name=>`<option value="${esc(name)}"></option>`).join('')}
function addSeasonMember(name){const season=selectedSeason();if(!season||!name.trim())return;const members=seasonMembers(season);if(members.some(p=>p.toLowerCase()===name.trim().toLowerCase())){alert('Dieses Mitglied ist bereits eingetragen.');return}saveSeasonMembers(season,[...members,name.trim()]);renderMemberSuggestions()}
function removeSeasonMember(name){const season=selectedSeason();if(!season)return;if(!confirm(`${name} aus der Mitgliederliste entfernen? Bereits gespeicherte Spieltage bleiben erhalten.`))return;saveSeasonMembers(season,seasonMembers(season).filter(p=>p!==name));renderMemberSuggestions()}
function linkSeasonMemberProfile(storedName,profileId){
  if(!isAdmin())return;const season=selectedSeason(),profile=(T20Cloud.adminProfiles||[]).find(item=>item.id===profileId);if(!season||!profile)return;
  const nickname=profile.nickname?.trim()||profile.display_name?.trim()||'diesem Benutzer';
  if(!confirm(`„${storedName}“ mit dem Benutzer „${nickname}“ verknüpfen? Die bisherigen Saisonergebnisse bleiben erhalten.`))return;
  const sameName=name=>(name||'').trim().toLowerCase()===storedName.trim().toLowerCase();season.memberProfileIds=season.memberProfileIds||{};season.memberProfileIds[storedName]=profileId;
  for(const tournament of season.tournaments||[]){tournament.playerProfileIds=tournament.playerProfileIds||{};for(const name of tournament.players||[])if(sameName(name))tournament.playerProfileIds[name]=profileId;for(const result of tournament.results||[])if(sameName(result.name))result.profileId=profileId}
  state.playerProfileIds=state.playerProfileIds||{};for(const name of state.players||[])if(sameName(name))state.playerProfileIds[name]=profileId;save();saveSeason(season);alert(`„${storedName}“ ist jetzt mit „${nickname}“ verknüpft.`)
}
function addTournamentToSeason(seasonId,tournament){
  if(!isClubMode())return null;
  const season=seasonStore.seasons.find(s=>s.id===seasonId);if(!season)return null;
  season.memberProfileIds={...(season.memberProfileIds||{}),...(tournament.playerProfileIds||{})};
  season.tournaments=season.tournaments||[];season.members=[...new Set([...(season.members||season.players||[]),...(tournament.players||[])])].sort((a,b)=>a.localeCompare(b,'de'));season.players=[...new Set([...(season.players||[]),...(season.members||[]),...(tournament.players||[])])].sort((a,b)=>a.localeCompare(b,'de'));
  const plannedIndex=tournament.scheduledEventId?season.tournaments.findIndex(item=>item.planned&&item.id===tournament.scheduledEventId):-1;if(plannedIndex>=0){const planned=season.tournaments[plannedIndex];tournament.date=tournament.date||planned.date;tournament.startTime=tournament.startTime||planned.startTime;season.tournaments.splice(plannedIndex,1,tournament)}else season.tournaments.push(tournament);season.tournaments.sort((a,b)=>a.date.localeCompare(b.date));season.stats=calculateSeasonStatisticsSummary(season);saveSeason(season);return season;
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
function manualMatchRow(players,round=1){
  const options=players.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
  return `<div class="manual-match-row" data-manual-match><label>Runde<input type="number" min="1" max="30" value="${round}" data-manual-round></label><label>Spieler 1<select data-manual-a><option value="">Auswählen …</option>${options}</select></label><label>Ergebnis<input type="number" min="0" max="30" data-manual-sa placeholder="0"></label><span class="manual-match-separator">:</span><label>Ergebnis<input type="number" min="0" max="30" data-manual-sb placeholder="0"></label><label>Spieler 2<select data-manual-b><option value="">Auswählen …</option>${options}</select></label><button class="danger manual-match-remove" type="button" data-remove-manual-match aria-label="Paarung entfernen">×</button></div>`;
}
function renderManualTournamentForm(season=selectedSeason()){
  const button=`<div class="manual-toggle-row"><button type="button" class="secondary" id="toggleManualTournament">${manualTournamentOpen?'Nachtrag ausblenden':'+ Spieltag manuell nachtragen'}</button></div>`;
  if(!manualTournamentOpen)return button;
  const players=manualTournamentPlayers(season);
  if(!players.length)return button+`<div class="card slim-card manual-tournament-card"><h3>Spieltag manuell nachtragen</h3><p class="empty-line">Lege zuerst unter „Mitglieder“ die Spieler an. Danach kannst du hier den gespielten Schweizer Spieltag eintragen.</p></div>`;
  return button+`<form id="manualTournamentForm" class="card slim-card manual-tournament-card"><h3>Spieltag manuell nachtragen</h3><p>Teilnehmer markieren und pro Spieler Siege, Niederlagen, 180er und höchstes Checkout eintragen. Darunter können die einzelnen Paarungen und Ergebnisse erfasst werden.</p><div class="grid"><label>Datum<input id="manualTournamentDate" type="date" value="${todayIso()}" required></label><label>Turniername<input id="manualTournamentName" value="Dienstagsturnier" maxlength="50"></label></div><div class="table-wrap manual-entry-table"><table><thead><tr><th>Dabei</th><th>Spieler</th><th>Siege</th><th>Niederlagen</th><th>180er</th><th>Checkout</th></tr></thead><tbody>${players.map(p=>`<tr data-manual-player="${esc(p)}"><td><input type="checkbox" data-manual-present checked></td><td><b>${esc(p)}</b></td><td><input type="number" min="0" max="20" value="0" data-manual-wins></td><td><input type="number" min="0" max="20" value="0" data-manual-losses></td><td><input type="number" min="0" max="99" value="0" data-manual-180></td><td><input type="number" min="0" max="170" value="0" data-manual-checkout></td></tr>`).join('')}</tbody></table></div><section class="manual-matches"><div class="manual-matches-head"><div><h4>Paarungen</h4><p>Runde, Spieler und Ergebnis jeder Begegnung eintragen.</p></div><button class="secondary" type="button" id="addManualMatch">+ Paarung</button></div><div id="manualMatchRows">${manualMatchRow(players)}</div></section><button class="primary" type="submit">SPIELTAG IN SAISON SPEICHERN <span>→</span></button></form>`;
}
function buildManualTournamentRecord(){
  const season=selectedSeason(),pointSystem=defaultPointSystem(),date=$('#manualTournamentDate')?.value||todayIso(),name=$('#manualTournamentName')?.value.trim()||'Dienstagsturnier';
  const results=[...document.querySelectorAll('[data-manual-player]')].filter(row=>row.querySelector('[data-manual-present]')?.checked).map(row=>{
    const player=row.dataset.manualPlayer,wins=+(row.querySelector('[data-manual-wins]')?.value||0),losses=+(row.querySelector('[data-manual-losses]')?.value||0),max180=+(row.querySelector('[data-manual-180]')?.value||0),checkout=+(row.querySelector('[data-manual-checkout]')?.value||0);
    return{name:player,profileId:season?.memberProfileIds?.[player]||memberIdForName(player),wins,losses,byes:0,max180,checkout,points:pointsForWins(wins,pointSystem),rank:0,legsFor:0,legsAgainst:0};
  }).sort((a,b)=>b.wins-a.wins||a.losses-b.losses||b.max180-a.max180||b.checkout-a.checkout||a.name.localeCompare(b.name,'de'));
  results.forEach((r,i)=>r.rank=i+1);
  const playerProfileIds=Object.fromEntries(results.filter(r=>r.profileId).map(r=>[r.name,r.profileId]));
  const matches=[...document.querySelectorAll('[data-manual-match]')].map(row=>({round:+(row.querySelector('[data-manual-round]')?.value||1),a:row.querySelector('[data-manual-a]')?.value||'',b:row.querySelector('[data-manual-b]')?.value||'',sa:row.querySelector('[data-manual-sa]')?.value,sb:row.querySelector('[data-manual-sb]')?.value})).filter(m=>m.a||m.b||m.sa!==''||m.sb!=='').map(m=>({...m,sa:m.sa===''?null:+m.sa,sb:m.sb===''?null:+m.sb}));
  return{id:`manual-tournament-${Date.now()}`,name,date,mode:'swiss',manual:true,players:results.map(r=>r.name),playerProfileIds,participantCount:results.length,winner:results[0]?.name||'',top3:results.slice(0,3).map(r=>r.name),settings:{mode:'swiss',name,manual:true},matches,results,createdAt:new Date().toISOString()};
}
function addManualTournamentFromForm(){
  const season=selectedSeason();if(!season)return;
  const tournament=buildManualTournamentRecord();
  if(tournament.participantCount<2){alert('Bitte mindestens zwei Teilnehmer markieren.');return}
  const participants=new Set(tournament.players),invalid=tournament.matches.find(m=>!m.a||!m.b||m.sa===null||m.sb===null||m.a===m.b||!participants.has(m.a)||!participants.has(m.b)||m.sa===m.sb);
  if(invalid){alert('Bitte alle begonnenen Paarungen vollständig ausfüllen. Die Spieler müssen verschieden und als Teilnehmer markiert sein; ein Ergebnis darf nicht unentschieden sein.');return}
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
  const tournaments=(season.tournaments||[]).filter(tournament=>!tournament.planned&&(!tournament.date||tournament.date<=todayIso())),players=new Map(),knownIds=new Map();
  Object.entries(season.memberProfileIds||{}).forEach(([name,id])=>{if(id){knownIds.set(normalizedPlayerName(name),id);knownIds.set(normalizedPlayerName(currentMemberNickname(id,name)),id)}});
  for(const tournament of tournaments){Object.entries(tournament.playerProfileIds||{}).forEach(([name,id])=>{if(id){knownIds.set(normalizedPlayerName(name),id);knownIds.set(normalizedPlayerName(currentMemberNickname(id,name)),id)}});for(const result of tournament.results||[])if(result.profileId){knownIds.set(normalizedPlayerName(result.name),result.profileId);knownIds.set(normalizedPlayerName(currentMemberNickname(result.profileId,result.name)),result.profileId)}}
  const resolveId=(name,id='')=>id||knownIds.get(normalizedPlayerName(name))||memberIdForName(name),addPlayer=(name,id='')=>{id=resolveId(name,id);const display=id?currentMemberNickname(id,name):name,key=resultIdentity(display,id),displayKey=resultIdentity(display),existing=players.get(key)||players.get(displayKey)||[...players.values()].find(player=>normalizedPlayerName(player.name)===normalizedPlayerName(display));if(existing){if(id&&!existing.profileId){players.delete(existing.key);existing.key=key;existing.profileId=id;existing.name=display;players.set(key,existing)}return}players.set(key,{key,name:display,profileId:id})};
  for(const name of season.members||[])addPlayer(name,season.memberProfileIds?.[name]);
  for(const name of season.players||[])addPlayer(name,season.memberProfileIds?.[name]);
  for(const tournament of tournaments){
    for(const name of tournament.players||[])addPlayer(name,tournament.playerProfileIds?.[name]||memberIdForName(name));
    for(const result of tournament.results||[])addPlayer(result.name,result.profileId||tournament.playerProfileIds?.[result.name]||memberIdForName(result.name));
  }
  return [...players.values()].map(player=>{
    const entries=tournaments.map(t=>{const r=(t.results||[]).find(x=>{const id=resolveId(x.name,x.profileId||t.playerProfileIds?.[x.name]),display=id?currentMemberNickname(id,x.name):x.name;return player.profileId&&id?player.profileId===id:normalizedPlayerName(player.name)===normalizedPlayerName(display)}),byes=r?(r.byes??tournamentByes(r.name,t.matches||[])):0,points=r?(r.points||0)+(r.byes===undefined?byes:0):0;return r?{tournamentId:t.id,date:t.date,name:t.name,present:true,points,wins:r.wins||0,losses:r.losses||0,byes,max180:r.max180||0,checkout:r.checkout||0,rank:r.rank||0}:{tournamentId:t.id,date:t.date,name:t.name,present:false,points:0,wins:0,losses:0,byes:0,max180:0,checkout:0,rank:0}});
    const configuredDrops=season.dropCount||0,effectiveDrops=tournaments.length>configuredDrops?configuredDrops:0,dropped=calculateDropResults(entries,effectiveDrops),used=dropped.filter(e=>!e.dropped),played=entries.filter(e=>e.present),wins=entries.reduce((sum,e)=>sum+e.wins,0),losses=entries.reduce((sum,e)=>sum+e.losses,0),byes=entries.reduce((sum,e)=>sum+(e.byes||0),0),max180=entries.reduce((sum,e)=>sum+e.max180,0),checkout=Math.max(0,...entries.map(e=>e.checkout||0));
    return{name:player.name,profileId:player.profileId,totalPoints:entries.reduce((sum,e)=>sum+e.points,0),cleanPoints:used.reduce((sum,e)=>sum+e.points,0),played:played.length,wins,losses,byes,max180,checkout,dropResults:dropped.filter(e=>e.dropped),entries:dropped,participation:tournaments.length?played.length/tournaments.length:0,winRate:wins+losses?wins/(wins+losses):0};
  }).sort((a,b)=>b.cleanPoints-a.cleanPoints||b.wins-a.wins||b.played-a.played||a.name.localeCompare(b.name,'de'));
}
function seasonStats(season=selectedSeason()){const rows=calculateSeasonStandings(season);return{max180:[...rows].sort((a,b)=>b.max180-a.max180)[0],checkout:[...rows].sort((a,b)=>b.checkout-a.checkout)[0],played:[...rows].sort((a,b)=>b.played-a.played)[0],participation:[...rows].sort((a,b)=>b.participation-a.participation||b.played-a.played)[0],wins:[...rows].sort((a,b)=>b.wins-a.wins)[0],winRate:[...rows].filter(r=>r.wins+r.losses>0).sort((a,b)=>b.winRate-a.winRate||b.wins-a.wins)[0]}}
function calculateSeasonStatisticsSummary(season=selectedSeason()){const s=seasonStats(season),pick=(row,key)=>row?{player:row.name,value:row[key]||0}:null;return{updatedAt:new Date().toISOString(),max180:pick(s.max180,'max180'),checkout:pick(s.checkout,'checkout'),played:pick(s.played,'played'),participation:s.participation?{player:s.participation.name,value:s.participation.participation}:null,wins:pick(s.wins,'wins'),winRate:s.winRate?{player:s.winRate.name,value:s.winRate.winRate}:null}}
function renderSeasonImport(winner){
  const card=$('#seasonImportCard');if(!card)return;const complete=!!winner&&state.matches.length&&(state.endedEarly||state.matches.every(m=>m.sa!==null));
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
  const ownId=T20Cloud.user?.id||'',ownNickname=T20Cloud.profile?.nickname||'';
  const mobile=`<div class="season-mobile-ranking">${rows.map((r,i)=>{const own=!!(ownId&&r.profileId===ownId)||(!isAdmin()&&ownNickname&&normalizedPlayerName(r.name)===normalizedPlayerName(ownNickname)),podium=i<3?` podium-${i+1}`:'';return `<article class="season-mobile-player${podium}${own?' is-own-player':''}"><button class="season-mobile-summary" type="button" data-season-mobile-toggle="${esc(r.name)}" aria-expanded="false"><span class="season-mobile-rank">${i+1}</span><span class="season-mobile-name"><b>${esc(r.name)}</b>${own?'<small>Dein Profil</small>':''}</span><span class="season-mobile-points"><b>${r.cleanPoints}</b><small>Punkte</small></span><span class="season-mobile-chevron">⌄</span></button><div class="season-mobile-details hidden" data-season-mobile-details="${esc(r.name)}"><div><span>Gesamtpunkte</span><b>${r.totalPoints}</b></div><div><span>Turniere</span><b>${r.played}</b></div><div><span>Siege</span><b>${r.wins}</b></div><div><span>Niederlagen</span><b>${r.losses}</b></div><div><span>Freilose</span><b>${r.byes||0}</b></div><div><span>180er</span><b>${r.max180}</b></div><div><span>High Finish</span><b>${r.checkout}</b></div><div class="season-mobile-drops"><span>Streicher</span><b>${r.dropResults.map(entry=>`<i>${entry.present?entry.points:0}</i>`).join('')||'–'}</b></div><button class="link-btn season-mobile-profile" type="button" data-season-player="${esc(r.name)}">Spielerdetails öffnen</button></div></article>`}).join('')||'<div class="empty-card">Noch keine Rangliste vorhanden.</div>'}</div>`;
  const desktop=`<div class="table-wrap season-desktop-ranking"><table><thead><tr><th>#</th><th>Spieler</th><th>Gesamt</th><th>Bereinigt</th><th>Turniere</th><th>Siege</th><th>Freilose</th><th>Niederl.</th><th>180er</th><th>High Finish</th><th>Streicher</th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-season-player="${esc(r.name)}"><td>${i+1}</td><td><button class="link-btn" data-season-player="${esc(r.name)}">${esc(r.name)}</button></td><td>${r.totalPoints}</td><td><b>${r.cleanPoints}</b></td><td>${r.played}</td><td>${r.wins}</td><td>${r.byes||0}</td><td>${r.losses}</td><td>${r.max180}</td><td>${r.checkout}</td><td>${r.dropResults.map(e=>`<span class="drop-pill">${e.present?e.points:0}</span>`).join(' ')||'–'}</td></tr>`).join('')}</tbody></table></div>`;
  $('#seasonStandings').innerHTML=mobile+desktop;
}
function renderSeasonMembers(season=selectedSeason(),rows=calculateSeasonStandings(season)){
  const wins=Object.fromEntries(rows.map(r=>[r.name,r.wins||0])),memberMap=new Map();seasonMembers(season).forEach(storedName=>{const profileId=season.memberProfileIds?.[storedName]||memberIdForName(storedName),name=currentMemberNickname(profileId,storedName),key=profileId?`id:${profileId}`:`name:${normalizedPlayerName(name)}`,existing=memberMap.get(key);if(!existing||normalizedPlayerName(storedName)===normalizedPlayerName(name))memberMap.set(key,{storedName,name,profileId})});const members=[...memberMap.values()].sort((a,b)=>(wins[b.name]||0)-(wins[a.name]||0)||a.name.localeCompare(b.name,'de'));
  const profiles=isAdmin()?(T20Cloud.adminProfiles||[]).filter(profile=>profile.nickname?.trim()):[];
  $('#seasonMembers').innerHTML=`<div class="card slim-card"><h3>Mitglieder</h3><p>Diese Liste wird für neue Dienstagsturniere als Setzliste verwendet: mehr Saison-Siege = weiter oben.</p><form id="memberForm" class="player-form"><input id="memberName" placeholder="Mitgliedsname" maxlength="30" autocomplete="off"><button type="submit">+ Mitglied</button></form><div class="member-list">${members.map((p,i)=>{const linkedId=season?.memberProfileIds?.[p.storedName],linked=profiles.find(profile=>profile.id===linkedId),mapping=isAdmin()?(linked?`<small class="member-linked">✓ Verknüpft mit ${esc(linked.nickname)}</small>`:profiles.length?`<div class="member-link-control"><select aria-label="Benutzer für ${esc(p.storedName)} auswählen"><option value="">Benutzer zuordnen …</option>${profiles.map(profile=>`<option value="${esc(profile.id)}">${esc(profile.nickname)}${profile.display_name?` · ${esc(profile.display_name)}`:''}</option>`).join('')}</select><button class="secondary" type="button" data-link-member="${esc(p.storedName)}">Zuordnen</button></div>`:'<small>Registrierte Benutzer im Konto aktualisieren</small>'):'';return `<div class="member-row"><b><span>${i+1}</span>${esc(p.name)}</b><small>${wins[p.name]||0} Saison-Siege</small>${mapping}<button class="danger" data-remove-member="${esc(p.storedName)}">Entfernen</button></div>`}).join('')||'<p class="empty-line">Noch keine Mitglieder eingetragen.</p>'}</div></div>`;
}
function tournamentPlayerName(tournament,name){
  const id=tournament.playerProfileIds?.[name]||(tournament.results||[]).find(result=>result.name===name)?.profileId||'';
  return currentMemberNickname(id,name);
}
function tournamentMatchesHtml(tournament){
  const matches=(tournament.matches||[]).filter(m=>m.a&&m.b).sort((a,b)=>(a.round||1)-(b.round||1));
  if(!matches.length)return '<p class="empty-line">Für diesen Spieltag wurden keine einzelnen Paarungen gespeichert.</p>';
  return `<div class="season-pairings">${matches.map(m=>`<div class="season-pairing"><small>Runde ${m.round||1}</small><b>${esc(tournamentPlayerName(tournament,m.a))}</b><strong>${m.sa??'–'} : ${m.sb??'–'}</strong><b>${esc(tournamentPlayerName(tournament,m.b))}</b></div>`).join('')}</div>`;
}
function renderSeasonTournaments(season=selectedSeason()){
  const tournaments=[...(season?.tournaments||[])].sort((a,b)=>{const aPlanned=!!a.planned,bPlanned=!!b.planned;if(aPlanned!==bPlanned)return aPlanned?-1:1;return aPlanned?String(a.date||'').localeCompare(String(b.date||'')):String(b.date||'').localeCompare(String(a.date||''))}),list=tournaments.length?`<div class="match-list">${tournaments.map(t=>{const planned=!!t.planned,expanded=expandedSeasonTournamentIds.has(String(t.id)),summary=planned?`Geplanter Termin · ${esc(t.competitionLabel||'Offen')}`:`Sieger: ${esc(tournamentPlayerName(t,t.winner)||'–')} · Top 3: ${(t.top3||[]).map(name=>esc(tournamentPlayerName(t,name))).join(', ')||'–'}`;return `<article class="match season-match"><div class="match-no">${esc(t.date)}${planned?' · Geplant':` · ${t.participantCount||0} Teilnehmer${t.manual?' · Manuell':''}`}</div><div><b>${esc(t.name)}</b><p>${summary}</p>${planned?'':`<div class="season-detail ${expanded?'':'hidden'}" id="details-${esc(t.id)}"><h4>Platzierungen</h4><div class="season-results">${(t.results||[]).sort((a,b)=>a.rank-b.rank).map(r=>`<span>${r.rank}. ${esc(tournamentPlayerName(t,r.name))} · ${r.wins}S/${r.losses}N${(r.byes??tournamentByes(r.name,t.matches||[]))?` · ${r.byes??tournamentByes(r.name,t.matches||[])} Freilos`:''} · ${r.points+(r.byes===undefined?tournamentByes(r.name,t.matches||[]):0)} Pkt.${r.max180?` · ${r.max180}x180`:''}${r.checkout?` · HF ${r.checkout}`:''}</span>`).join('')}</div><h4>Paarungen</h4>${tournamentMatchesHtml(t)}</div>`}</div><div class="season-match-actions">${planned?'':`<button class="secondary" data-tournament-detail="${esc(t.id)}">${expanded?'Details ausblenden':'Details anzeigen'}</button>`}${isAdmin()?`<button class="secondary" data-rename-tournament="${esc(t.id)}">Spieltag umbenennen</button>`:''}<button class="danger" data-delete-tournament="${esc(t.id)}">Löschen</button></div></article>`}).join('')}</div>`:'<div class="empty-card">Noch keine Turniere in dieser Saison.</div>';
  $('#seasonTournaments').innerHTML=renderManualTournamentForm(season)+list;
}
function renameSeasonTournament(tournamentId){
  if(!isAdmin())return;
  const selected=selectedSeason(),target=selected?.tournaments?.find(tournament=>tournament.id===tournamentId);if(!target)return;
  const sharedEventName=target.eventName||'',oldEventName=sharedEventName||target.name||'Spieltag',next=prompt('Neuer Name des Spieltags:',oldEventName);if(next===null)return;
  const eventName=next.trim();if(!eventName){alert('Bitte einen Namen für den Spieltag eingeben.');return}
  const updateRecord=record=>{record.eventName=eventName;record.name=record.competition?`${eventName} – ${record.competitionLabel||competitionLabel(record.competition)}`:eventName;record.settings={...(record.settings||{}),eventName,name:record.name}};
  for(const season of seasonStore.seasons||[])for(const record of season.tournaments||[])if(record.id===target.id||(sharedEventName&&record.eventName===sharedEventName&&record.date===target.date))updateRecord(record);
  const history=loadTournamentHistory();let historyChanged=false;for(const record of history)if(record.id===target.id||(sharedEventName&&record.eventName===sharedEventName&&record.date===target.date)){updateRecord(record);historyChanged=true}if(historyChanged)localStorage.setItem(TOURNAMENT_HISTORY_KEY,JSON.stringify(history));
  if(state.seasonTournamentId===target.id||state.savedToHistory===target.id){state.eventName=eventName;for(const [key,competition] of Object.entries(state.competitions||{})){competition.settings=competition.settings||{};competition.settings.eventName=eventName;competition.settings.name=`${eventName} – ${competitionLabel(key)}`}state.settings={...(state.settings||{}),eventName,name:competitionTitle()};save()}
  persistSeasons();renderSeasonView();renderNavigation();
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

function playerProfileReference(row={}){return row.profileId||row.name||''}
function findPublicPlayer(reference=''){
  const decoded=decodeURIComponent(reference||''),normalized=normalizedPlayerName(decoded),matches=[];
  for(const season of seasonStore.seasons||[]){
    const rows=calculateSeasonStandings(season),row=rows.find(item=>(decoded&&item.profileId===decoded)||normalizedPlayerName(item.name)===normalized);
    if(row)matches.push({season,row,rank:rows.indexOf(row)+1});
  }
  if(!matches.length)return null;
  const preferred=matches.find(item=>!item.season.archived&&(!item.season.startDate||item.season.startDate<=todayIso())&&(!item.season.endDate||item.season.endDate>=todayIso()))||matches.find(item=>!item.season.archived)||matches[0];
  return{reference:playerProfileReference(preferred.row),name:preferred.row.name,profileId:preferred.row.profileId||'',matches,preferred};
}
function publicPlayerUrl(reference){const url=new URL(TRIPLE20_PUBLIC_URL);url.searchParams.set('bereich','spieler');url.searchParams.set('spieler',reference);return url.href}
function publicPlayerProfileHtml(player){
  if(!player)return `<div class="public-player-empty card"><span>🎯</span><h1 id="playerProfileTitle">Spielerprofil nicht gefunden</h1><p>Das Profil ist möglicherweise noch nicht mit einer Saisonwertung verknüpft.</p><button class="secondary" type="button" data-profile-back>Zur Startseite</button></div>`;
  const allEntries=player.matches.flatMap(({season,row})=>row.entries.filter(entry=>entry.present).map(entry=>({...entry,seasonName:season.name}))),recent=[...allEntries].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,6),played=allEntries.length,wins=allEntries.reduce((sum,item)=>sum+(item.wins||0),0),losses=allEntries.reduce((sum,item)=>sum+(item.losses||0),0),max180=allEntries.reduce((sum,item)=>sum+(item.max180||0),0),checkout=Math.max(0,...allEntries.map(item=>item.checkout||0)),podiums=allEntries.filter(item=>item.rank&&item.rank<=3).length,winRate=wins+losses?Math.round(wins/(wins+losses)*100):0;
  const photo=memberAvatarUrl(player.profileId),initial=esc((player.name||'?').charAt(0).toUpperCase()),avatar=photo?`<img src="${esc(photo)}" alt="Profilfoto von ${esc(player.name)}">`:initial;
  const seasons=player.matches.map(({season,row,rank})=>`<article><span>${season.archived?'ARCHIV':'SAISON'}</span><h3>${esc(season.name)}</h3><div><b>Rang ${rank}</b><strong>${row.cleanPoints} Punkte</strong></div><small>${row.played} Turniere · ${row.wins} Siege · ${row.max180} × 180</small><button class="link-btn" type="button" data-profile-season="${esc(season.id)}">Rangliste öffnen</button></article>`).join('');
  return `<div class="public-player-back"><button class="secondary" type="button" data-profile-back>← Zurück</button></div><header class="public-player-hero"><span class="profile-avatar public-player-avatar">${avatar}</span><div><span class="eyebrow">TRIPLE20 · SPIELERPROFIL</span><h1 id="playerProfileTitle">${esc(player.name)}</h1><p>${esc(appSettings.club.name||'Dartclub Achensee')} · Persönliche Dartstatistik</p></div><button class="primary public-player-share" type="button" data-profile-share="${esc(player.reference)}">PROFIL TEILEN <span>↗</span></button></header><div class="public-player-stats"><article><small>Turniere</small><b>${played}</b></article><article><small>Siege</small><b>${wins}</b></article><article><small>Siegquote</small><b>${winRate}%</b></article><article><small>Podestplätze</small><b>${podiums}</b></article><article><small>180er</small><b>${max180}</b></article><article><small>High Finish</small><b>${checkout||'–'}</b></article></div><div class="public-player-layout"><section><div class="public-player-heading"><span>FORM</span><h2>Letzte Ergebnisse</h2></div>${recent.length?`<div class="public-player-results">${recent.map(item=>`<article><time>${publicDate(item.date)}</time><div><b>${esc(item.name||'Spieltag')}</b><small>${esc(item.seasonName)}</small></div><strong>${item.rank?`${item.rank}. Platz`:''}${item.rank&&item.points?' · ':''}${item.points?`${item.points} Pkt.`:''}</strong></article>`).join('')}</div>`:'<p class="public-empty">Noch keine Ergebnisse vorhanden.</p>'}</section><section><div class="public-player-heading"><span>SAISONEN</span><h2>Ranglisten</h2></div><div class="public-player-seasons">${seasons}</div></section></div>`;
}
function showPlayerProfile(reference='',updateUrl=true){
  hideMainSections();$('#playerProfileSection')?.classList.remove('hidden');const player=findPublicPlayer(reference);$('#playerProfileContent').innerHTML=publicPlayerProfileHtml(player);renderNavigation();if(updateUrl)updateAppUrl('spieler',{spieler:player?.reference||reference});
}
async function sharePlayerProfile(reference){
  const player=findPublicPlayer(reference);if(!player)return;const url=publicPlayerUrl(player.reference),data={title:`${player.name} · Triple20`,text:`Spielerprofil von ${player.name} auf Triple20`,url};
  try{if(navigator.share){await navigator.share(data);return}await navigator.clipboard.writeText(url);alert('Profil-Link wurde kopiert.')}catch(error){if(error?.name!=='AbortError')prompt('Profil-Link kopieren:',url)}
}
function exportSeasonJson(){const season=selectedSeason();if(!season)return;downloadFile(`${season.name.replaceAll(' ','_')}.json`,'application/json',JSON.stringify(season,null,2))}
function exportStandingsCsv(){const season=selectedSeason();if(!season)return;const rows=calculateSeasonStandings(season),head=['Platz','Spieler','Gesamtpunkte','Bereinigte Punkte','Turniere','Siege','Niederlagen','180er','Höchstes Checkout'];const csv=[head.join(';'),...rows.map((r,i)=>[i+1,r.name,r.totalPoints,r.cleanPoints,r.played,r.wins,r.losses,r.max180,r.checkout].map(v=>`"${String(v).replaceAll('"','""')}"`).join(';'))].join('\n');downloadFile(`${season.name.replaceAll(' ','_')}_rangliste.csv`,'text/csv;charset=utf-8',csv)}

function publicDate(value){if(!value)return'Datum offen';const date=new Date(`${value}T12:00:00`);return Number.isNaN(date.getTime())?esc(value):date.toLocaleDateString('de-AT',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}
function publicStartTime(record={}){const value=record.startTime||record.settings?.startTime||record.settings?.start||'';return /^\d{2}:\d{2}$/.test(value)?`${value} Uhr`:''}
function publicTournamentKey(record={}){
  const baseName=(record.eventName||record.name||'').trim().replace(/\s+[–-]\s+(Herren|Damen)$/i,'').replace(/\s+/g,' ').toLowerCase();
  const competition=record.competition||(/damen/i.test(record.competitionLabel||record.name||'')?'women':/herren/i.test(record.competitionLabel||record.name||'')?'men':'open');
  return `${record.date||''}|${baseName}|${competition}`;
}
function publicTournamentRecords(){
  // Eine abgeschlossene Turnierfassung hat Vorrang vor dem ursprünglich
  // geplanten Termin. Abgeschlossene Saisonfassungen bleiben weiterhin die
  // offizielle Quelle gegenüber einer älteren lokalen Historie.
  const history=loadTournamentHistory(),completedScheduleIds=new Set(history.map(record=>record.scheduledEventId).filter(Boolean));
  const seasonRecords=(seasonStore.seasons||[]).flatMap(season=>(season.tournaments||[]).filter(tournament=>!tournament.planned||!completedScheduleIds.has(tournament.id)).map(tournament=>({...tournament,seasonName:season.name})));
  const records=[...history,...seasonRecords];
  const unique=new Map();
  records.forEach(record=>{const key=publicTournamentKey(record),old=unique.get(key),completedBeatsPlanned=old&&!old.planned&&record.planned,next=completedBeatsPlanned?{...record,...old}:{...(old||{}),...record};unique.set(key,{...next,seasonName:record.seasonName||old?.seasonName||''})});
  return [...unique.entries()].map(([key,value])=>({...value,_publicKey:key})).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.name||'').localeCompare(b.name||'','de'));
}
function publicEventShareUrl(){return TRIPLE20_PUBLIC_URL}
function publicEventCalendarText(tournament={}){
  const date=(tournament.date||'').replaceAll('-',''),time=(tournament.startTime||tournament.settings?.startTime||'19:00').replace(':','');
  if(!/^\d{8}$/.test(date)||!/^\d{4}$/.test(time))return'';
  const localStart=new Date(`${tournament.date}T${time.slice(0,2)}:${time.slice(2)}:00`),localEnd=new Date(localStart.getTime()+4*60*60*1000),localStamp=value=>`${value.getFullYear()}${String(value.getMonth()+1).padStart(2,'0')}${String(value.getDate()).padStart(2,'0')}T${String(value.getHours()).padStart(2,'0')}${String(value.getMinutes()).padStart(2,'0')}00`,utcStamp=value=>value.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),ics=value=>String(value||'').replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;');
  const title=tournament.name||tournament.eventName||'Triple20 Spieltag',details=[tournament.competitionLabel,tournament.seasonName].filter(Boolean).join(' · '),uid=`${tournament.id||`${date}-${time}`}@triple20`;
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Triple20//Spieltermine//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${ics(uid)}`,`DTSTAMP:${utcStamp(new Date())}`,`DTSTART;TZID=Europe/Vienna:${localStamp(localStart)}`,`DTEND;TZID=Europe/Vienna:${localStamp(localEnd)}`,`SUMMARY:${ics(title)}`,`DESCRIPTION:${ics(`${details}${details?'\n':''}Aktuelle Informationen in der Triple20-App.`)}`,`URL:${publicEventShareUrl()}`,'BEGIN:VALARM','TRIGGER:-PT2H','ACTION:DISPLAY',`DESCRIPTION:${ics(title)} beginnt in 2 Stunden`,'END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
}
function addPublicEventToCalendar(key){
  const tournament=publicTournamentRecords().find(item=>item._publicKey===key),content=tournament&&publicEventCalendarText(tournament);if(!content){alert('Für diesen Termin fehlen Datum oder Startzeit.');return}
  const filename=`Triple20_${(tournament.name||'Spieltag').replace(/[^a-z0-9äöüß]+/gi,'_').replace(/^_|_$/g,'')}_${tournament.date}.ics`;downloadFile(filename,'text/calendar;charset=utf-8',content);
}
function sharePublicEventOnWhatsApp(key){
  const tournament=publicTournamentRecords().find(item=>item._publicKey===key);if(!tournament)return;
  const title=tournament.name||tournament.eventName||'Triple20 Spieltag',date=publicDate(tournament.date),time=publicStartTime(tournament),details=[tournament.competitionLabel,tournament.seasonName].filter(Boolean).join(' · '),message=[`🎯 ${title}`,`📅 ${date}${time?` um ${time.replace(' Uhr','')}`:''}`,details?`🏆 ${details}`:'','',`Alle Informationen findest du in der Triple20-App:`,publicEventShareUrl()].filter(line=>line!==null&&line!==undefined).join('\n');
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`,'_blank','noopener,noreferrer');
}
function resultGraphicPlayers(tournament={}){
  const ranked=[...(tournament.results||[])].filter(item=>item?.name).sort((a,b)=>(b.points||0)-(a.points||0)||(b.wins||0)-(a.wins||0)||(a.losses||0)-(b.losses||0)||((b.legsFor||0)-(b.legsAgainst||0))-((a.legsFor||0)-(a.legsAgainst||0))||(a.rank||999)-(b.rank||999)||String(a.name).localeCompare(String(b.name),'de'));if(ranked.length)return ranked.slice(0,3);
  const names=[tournament.winner,...(tournament.top3||[])].filter(Boolean);return [...new Set(names)].slice(0,3).map((name,index)=>({name,rank:index+1}));
}
function drawResultGraphic(tournament={}){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),width=1080,height=1350;canvas.width=width;canvas.height=height;
  const blue='#0e6bff',navy='#06101d',muted='#a9bad0',white='#ffffff',roundRect=(x,y,w,h,r,fill,stroke='')=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}},fitText=(text,maxWidth,startSize,minSize=34)=>{let size=startSize;do{ctx.font=`900 ${size}px Helvetica Neue,Arial,sans-serif`;if(ctx.measureText(text).width<=maxWidth)return size;size-=2}while(size>minSize);return minSize};
  const gradient=ctx.createLinearGradient(0,0,width,height);gradient.addColorStop(0,'#02060c');gradient.addColorStop(.58,navy);gradient.addColorStop(1,'#0a2246');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);const glow=ctx.createRadialGradient(870,180,10,870,180,520);glow.addColorStop(0,'rgba(14,107,255,.42)');glow.addColorStop(1,'rgba(14,107,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
  ctx.fillStyle=blue;ctx.font='900 29px Helvetica Neue,Arial,sans-serif';ctx.fillText('TRIPLE20 · ERGEBNIS',76,95);const title=(tournament.name||tournament.eventName||'Dartturnier').toUpperCase(),titleSize=fitText(title,928,76,44);ctx.fillStyle=white;ctx.font=`900 ${titleSize}px Helvetica Neue,Arial,sans-serif`;ctx.fillText(title,76,190,928);ctx.fillStyle=muted;ctx.font='700 30px Helvetica Neue,Arial,sans-serif';ctx.fillText(`${publicDate(tournament.date)}${tournament.competitionLabel?` · ${tournament.competitionLabel}`:''}${tournament.seasonName?` · ${tournament.seasonName}`:''}`,76,245,928);
  const players=resultGraphicPlayers(tournament),labels=['SIEGER','2. PLATZ','3. PLATZ'],cardY=[330,565,775],cardH=[195,175,175];players.forEach((player,index)=>{const y=cardY[index],h=cardH[index],circle=index===0?112:92;roundRect(76,y,928,h,28,index===0?'rgba(14,107,255,.2)':'rgba(255,255,255,.055)',index===0?blue:'rgba(169,186,208,.3)');roundRect(106,y+42,circle,circle,999,index===0?blue:'rgba(255,255,255,.12)');ctx.fillStyle=white;ctx.textAlign='center';ctx.font=`900 ${index===0?58:46}px Helvetica Neue,Arial,sans-serif`;ctx.fillText(String(index+1),106+circle/2,y+42+circle*.68);ctx.textAlign='left';ctx.fillStyle=index===0?'#77b2ff':muted;ctx.font='900 23px Helvetica Neue,Arial,sans-serif';ctx.fillText(labels[index],250,y+66);const name=String(player.name||'–'),nameSize=fitText(name,700,index===0?56:48,32);ctx.fillStyle=white;ctx.font=`900 ${nameSize}px Helvetica Neue,Arial,sans-serif`;ctx.fillText(name,250,y+125,700);const detail=[player.points!==undefined?`${player.points} Punkte`:'',player.wins!==undefined?`${player.wins} Siege`:''].filter(Boolean).join(' · ');if(detail){ctx.fillStyle=muted;ctx.font='700 24px Helvetica Neue,Arial,sans-serif';ctx.fillText(detail,250,y+162,700)}});
  const statsY=players.length>=3?1010:players.length===2?810:600,participants=tournament.participantCount||tournament.players?.length||0,matches=tournament.matches?.length||0;roundRect(76,statsY,928,120,24,'rgba(255,255,255,.06)','rgba(169,186,208,.22)');ctx.fillStyle=muted;ctx.font='800 24px Helvetica Neue,Arial,sans-serif';ctx.fillText('TEILNEHMENDE',110,statsY+45);ctx.fillText('SPIELE',550,statsY+45);ctx.fillStyle=white;ctx.font='900 42px Helvetica Neue,Arial,sans-serif';ctx.fillText(String(participants||'–'),110,statsY+92);ctx.fillText(String(matches||'–'),550,statsY+92);ctx.fillStyle=white;ctx.font='900 42px Helvetica Neue,Arial,sans-serif';ctx.fillText('TRIPLE',76,1260);ctx.fillStyle=blue;ctx.fillText('20',222,1260);ctx.fillStyle=muted;ctx.font='700 22px Helvetica Neue,Arial,sans-serif';ctx.textAlign='right';ctx.fillText('triple20.at',1004,1258);ctx.textAlign='left';return canvas;
}
async function openResultGraphic(key){
  const tournament=publicTournamentRecords().find(item=>item._publicKey===key);if(!tournament)return;if(!resultGraphicPlayers(tournament).length){alert('Für diesen Spieltag ist noch kein Ergebnis gespeichert.');return}
  const canvas=drawResultGraphic(tournament),blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',.95));if(!blob){alert('Die Ergebnisgrafik konnte nicht erstellt werden.');return}resultGraphicBlob=blob;resultGraphicFilename=`Triple20_${(tournament.name||'Ergebnis').replace(/[^a-z0-9äöüß]+/gi,'_').replace(/^_|_$/g,'')}_${tournament.date||todayIso()}.png`;const src=URL.createObjectURL(blob);$('#resultGraphicOverlay')?.remove();document.body.insertAdjacentHTML('beforeend',`<div id="resultGraphicOverlay" class="result-graphic-overlay" role="dialog" aria-modal="true" aria-labelledby="resultGraphicTitle"><section class="result-graphic-dialog"><button id="closeResultGraphicBtn" class="live-qr-close" type="button" aria-label="Ergebnisgrafik schließen">×</button><span class="eyebrow">ERGEBNIS TEILEN</span><h2 id="resultGraphicTitle">Grafik ist bereit</h2><p>Für WhatsApp, Instagram und andere soziale Netzwerke.</p><img src="${src}" alt="Ergebnisgrafik für ${esc(tournament.name||'den Spieltag')}"><div><button id="shareResultGraphicBtn" class="primary" type="button">GRAFIK TEILEN <span>↗</span></button><button id="downloadResultGraphicBtn" class="secondary" type="button">PNG SPEICHERN</button></div></section></div>`);
}
function closeResultGraphic(){const image=$('#resultGraphicOverlay img');if(image?.src?.startsWith('blob:'))URL.revokeObjectURL(image.src);$('#resultGraphicOverlay')?.remove()}
function downloadResultGraphic(){if(resultGraphicBlob)downloadFile(resultGraphicFilename,'image/png',resultGraphicBlob)}
async function shareResultGraphic(){const file=resultGraphicBlob&&new File([resultGraphicBlob],resultGraphicFilename,{type:'image/png'});if(!file)return;if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({title:'Triple20 Ergebnis',text:'Aktuelles Ergebnis aus der Triple20-App',files:[file]});return}catch(error){if(error?.name==='AbortError')return}}downloadResultGraphic();alert('Die direkte Teilen-Funktion ist in diesem Browser nicht verfügbar. Die Grafik wurde deshalb als PNG gespeichert.')}
function registrationEventKey(tournament={}){return String(tournament.id||tournament._publicKey||'').slice(0,160)}
function registrationHtml(tournament={}){
  const eventKey=registrationEventKey(tournament),count=tournamentRegistrationCounts[eventKey]||0,own=tournamentRegistrations.find(item=>item.event_key===eventKey&&item.user_id===T20Cloud.user?.id),adminRows=isAdmin()?tournamentRegistrations.filter(item=>item.event_key===eventKey):[];
  const names=adminRows.length?`<details class="registration-names"><summary>${count} Anmeldung${count===1?'':'en'} anzeigen</summary><span>${adminRows.map(item=>esc(item.nickname||'Mitglied')).join(', ')}</span></details>`:`<small>${count} angemeldet</small>`;
  if(isAdmin())return `<div class="event-registration admin-registration">${names}</div>`;
  if(!T20Cloud.user)return `<div class="event-registration"><small>${count} angemeldet</small><button class="secondary" type="button" data-event-login>Zur Teilnahme anmelden</button></div>`;
  return `<div class="event-registration"><small>${count} angemeldet${own?' · Du bist dabei':''}</small><button class="${own?'danger':'primary'}" type="button" data-event-registration="${esc(eventKey)}" data-registration-action="${own?'cancel':'join'}">${own?'Teilnahme absagen':'Ich bin dabei'}</button></div>`;
}
async function loadTournamentRegistrations(){
  if(registrationsLoading||!T20Cloud.client)return;registrationsLoading=true;
  try{
    const [{data:counts,error:countError},{data:rows,error:rowError}]=await Promise.all([T20Cloud.client.rpc('triple20_registration_counts'),T20Cloud.user?T20Cloud.client.from('triple20_tournament_registrations').select('event_key,user_id,nickname,updated_at'):Promise.resolve({data:[]})]);
    if(countError)throw countError;if(rowError)throw rowError;tournamentRegistrationCounts=Object.fromEntries((counts||[]).map(item=>[item.event_key,+item.registration_count||0]));tournamentRegistrations=rows||[];
    if(!$('#publicHomeSection')?.classList.contains('hidden'))renderPublicHome({refreshRegistrations:false});
    if(isAdmin()&&!$('#authSection')?.classList.contains('hidden'))renderCloudPanel();
  }catch(error){console.warn('Teilnahmeanmeldungen konnten nicht geladen werden:',error)}finally{registrationsLoading=false}
}
async function changeTournamentRegistration(eventKey,action){
  if(!T20Cloud.user||isAdmin()){if(!T20Cloud.user)showLogin();return}if(!T20Cloud.client){alert('Die Anmeldung benötigt momentan eine Internetverbindung.');return}
  const button=document.querySelector(`[data-event-registration="${CSS.escape(eventKey)}"]`);if(button)button.disabled=true;
  try{
    if(action==='cancel'){const {error}=await T20Cloud.client.from('triple20_tournament_registrations').delete().eq('event_key',eventKey).eq('user_id',T20Cloud.user.id);if(error)throw error}
    else{const nickname=T20Cloud.profile?.nickname?.trim()||'Mitglied',{error}=await T20Cloud.client.from('triple20_tournament_registrations').upsert({event_key:eventKey,user_id:T20Cloud.user.id,nickname,updated_at:new Date().toISOString()},{onConflict:'event_key,user_id'});if(error)throw error}
    while(registrationsLoading)await new Promise(resolve=>setTimeout(resolve,80));await loadTournamentRegistrations();
  }catch(error){console.error('Teilnahmeanmeldung fehlgeschlagen:',error);alert('Die Teilnahme konnte nicht gespeichert werden. Bitte prüfe die Internetverbindung oder die Supabase-Einrichtung.')}finally{if(button)button.disabled=false}
}
function updateAdminCheckInUser(userId,present){
  const event=upcomingAdminEvents().find(item=>registrationEventKey(item)===adminCheckInEventKey);if(!event)return;
  const data=checkInData(event),ids=new Set(data.ids);present?ids.add(userId):ids.delete(userId);saveAdminCheckIn(adminCheckInEventKey,{...data,ids:[...ids]});renderCloudPanel();
}
function addAdminCheckInGuest(name){
  const event=upcomingAdminEvents().find(item=>registrationEventKey(item)===adminCheckInEventKey),clean=(name||'').trim().replace(/\s+/g,' ');if(!event||!clean)return;
  const data=checkInData(event);if(data.guests.some(item=>item.toLowerCase()===clean.toLowerCase()))return;data.guests.push(clean);saveAdminCheckIn(adminCheckInEventKey,data);renderCloudPanel();
}
function removeAdminCheckInGuest(index){
  const event=upcomingAdminEvents().find(item=>registrationEventKey(item)===adminCheckInEventKey);if(!event)return;const data=checkInData(event);data.guests.splice(index,1);saveAdminCheckIn(adminCheckInEventKey,data);renderCloudPanel();
}
function transferAdminCheckInToTournament(){
  if(!isAdmin())return;const event=upcomingAdminEvents().find(item=>registrationEventKey(item)===adminCheckInEventKey);if(!event)return;
  const data=checkInData(event),profiles=new Map((T20Cloud.adminProfiles||[]).map(profile=>[profile.id,profile])),members=data.ids.map(id=>profiles.get(id)).filter(Boolean).map(profile=>({id:profile.id,name:(profile.nickname||profile.display_name||'').trim()})).filter(item=>item.name),guests=data.guests.map(name=>({id:'',name:name.trim()})).filter(item=>item.name),unique=new Map([...members,...guests].map(item=>[item.name.toLowerCase(),item])),players=[...unique.values()];
  if(players.length<2){alert('Für ein Turnier müssen mindestens zwei anwesende Personen ausgewählt sein.');return}
  const targetCompetition=['men','women'].includes(event.competition)?event.competition:(state.activeCompetition||'men');ensureTournamentDayState();const targetState=targetCompetition===state.activeCompetition?competitionSnapshot(state):competitionSnapshot(state.competitions?.[targetCompetition]||emptyCompetition());
  if((targetState.started||targetState.players?.length||targetState.matches?.length)&&!confirm(`Der vorbereitete Bewerb „${competitionLabel(targetCompetition)}“ wird durch den Check-in ersetzt. Fortfahren?`))return;
  syncActiveCompetition();state.activeCompetition=targetCompetition;loadActiveCompetition();
  for(const key of COMPETITION_KEYS)delete state[key];Object.assign(state,emptyCompetition(),{players:players.map(item=>item.name),playerProfileIds:Object.fromEntries(players.filter(item=>item.id).map(item=>[item.name,item.id])),scheduledEventId:event.id||'',settings:{}});state.eventName=event.eventName||event.name||'Dartturnier';syncActiveCompetition();save();
  $('#tournamentName').value=state.eventName;applyTournamentDefaults();renderPlayers();adminCheckInEventKey='';showTournament();document.querySelector('#setupSection')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function publicEventRow(tournament,status){
  const results=tournament.results||[],matches=tournament.matches||[],winner=tournament.winner||[...results].sort((a,b)=>(a.rank||999)-(b.rank||999))[0]?.name||'';
  const participantText=(tournament.participantCount||tournament.players?.length)?`${tournament.participantCount||tournament.players.length} Teilnehmende`:'';
  const meta=[tournament.seasonName,tournament.competitionLabel,participantText,matches.length?`${matches.length} Spiele`:''].filter(Boolean).join(' · ');
  const key=esc(tournament._publicKey||tournament.id||''),share=status==='future'?`<div class="public-event-share"><button class="secondary" type="button" data-public-calendar="${key}" aria-label="${esc(tournament.name||'Termin')} zum Kalender hinzufügen">Kalender</button><button class="secondary whatsapp-share" type="button" data-public-whatsapp="${key}" aria-label="${esc(tournament.name||'Termin')} über WhatsApp teilen">WhatsApp</button></div>`:`<button class="secondary result-graphic-button" type="button" data-result-graphic="${key}">Ergebnisgrafik</button>`,remove=isAdmin()?`<button class="danger public-delete-event" type="button" data-public-delete="${key}">Löschen</button>`:'';
  const startTime=publicStartTime(tournament),rawTime=tournament.startTime||tournament.settings?.startTime||tournament.settings?.start||'',dateTime=[tournament.date,rawTime].filter(Boolean).join('T');
  return `<article class="public-event-row"><time datetime="${esc(dateTime)}"><span>${publicDate(tournament.date)}</span>${startTime?`<b>${esc(startTime)}</b>`:''}</time><div><h3>${esc(tournament.name||tournament.eventName||'Spieltag')}</h3><p>${esc(meta||'Weitere Angaben folgen')}</p>${status==='future'?registrationHtml(tournament):''}</div><div class="public-event-result"><strong>${status==='future'?'Geplant':winner?`Sieger: ${esc(winner)}`:'Beendet'}</strong>${share}${remove}</div></article>`;
}
async function createPublicSchedule(){
  if(!isAdmin())return;
  const season=seasonStore.seasons.find(item=>item.id===$('#publicScheduleSeason')?.value),date=$('#publicScheduleDate')?.value,startTime=$('#publicScheduleTime')?.value,name=$('#publicScheduleName')?.value.trim(),competition=$('#publicScheduleCompetition')?.value||'open';
  if(!season||!date||!startTime||!name){alert('Bitte Datum, Startzeit, Bezeichnung und Saison vollständig auswählen.');return}
  if(date<todayIso()&&!confirm('Das gewählte Datum liegt in der Vergangenheit. Termin trotzdem eintragen?'))return;
  const label=competition==='women'?'Damen':competition==='men'?'Herren':'Offen',record={id:`scheduled-${Date.now()}`,name,date,startTime,competition,competitionLabel:label,planned:true,players:[],participantCount:0,matches:[],results:[],createdAt:new Date().toISOString()};
  season.tournaments=season.tournaments||[];season.tournaments.push(record);season.tournaments.sort((a,b)=>(a.date||'').localeCompare(b.date||''));saveSeason(season);renderPublicHome();await T20Cloud.syncAll({force:true});if(T20Cloud.pendingSync){alert('Der Termin ist lokal gespeichert, konnte aber noch nicht veröffentlicht werden. Bitte prüfe die Internetverbindung und melde dich noch nicht ab.');return}$('#publicScheduleName').value='';alert('Der zukünftige Spieltermin wurde veröffentlicht und online gespeichert.');
}
async function deletePublicTournament(key){
  if(!isAdmin()||!key)return;
  const record=publicTournamentRecords().find(item=>item._publicKey===key);if(!record)return;
  if(!confirm(`„${record.name||record.eventName||'Spieltag'}“ vom ${publicDate(record.date)} wirklich löschen? Der Eintrag wird auch aus Saison und Turnierhistorie entfernt.`))return;
  const registrationKey=registrationEventKey(record);if(T20Cloud.client&&registrationKey)try{const {error}=await T20Cloud.client.from('triple20_tournament_registrations').delete().eq('event_key',registrationKey);if(error)throw error}catch(error){console.warn('Teilnahmeanmeldungen konnten beim Löschen des Termins nicht entfernt werden:',error)}
  const same=item=>publicTournamentKey(item)===key;
  for(const season of seasonStore.seasons||[])season.tournaments=(season.tournaments||[]).filter(item=>!same(item));
  persistSeasons();localStorage.setItem(TOURNAMENT_HISTORY_KEY,JSON.stringify(loadTournamentHistory().filter(item=>!same(item))));renderSeasonView();renderPublicHome();await T20Cloud.syncAll({force:true});if(T20Cloud.pendingSync)alert('Der Eintrag wurde lokal gelöscht, konnte aber noch nicht mit der Cloud synchronisiert werden. Bitte noch nicht abmelden.');
}
function liveCompetitionCards(){
  ensureTournamentDayState();
  return ['men','women'].map(key=>({key,label:competitionLabel(key),data:key===state.activeCompetition?competitionSnapshot(state):competitionSnapshot(state.competitions?.[key]||emptyCompetition())})).filter(item=>item.data.started).map(item=>{
    const tournament=item.data,done=(tournament.matches||[]).filter(match=>match.sa!==null).length,total=(tournament.matches||[]).length,next=(tournament.matches||[]).filter(match=>match.sa===null&&match.b!=='Freilos').slice(0,3);
    return `<article class="public-live-card"><div><span class="live-dot">LIVE</span><small>${esc(item.label)}</small></div><h3>${esc(state.eventName||tournament.settings?.eventName||tournament.settings?.name||'Vereinsturnier')}</h3><p>${done} von ${total} Spielen beendet · ${tournament.players?.length||0} Teilnehmende</p><div class="public-live-matches">${next.map(match=>`<div><span>${esc(match.a)}</span><b>vs.</b><span>${esc(match.b)}</span></div>`).join('')||'<p>Alle Spiele dieses Bewerbs sind beendet.</p>'}</div><button class="secondary public-live-open" type="button" data-open-live="${item.key}">Vollständigen Spielplan öffnen</button></article>`;
  });
}
function renderPublicHome({refreshRegistrations=true}={}){
  const status=$('#publicHomeStatus');if(!status)return;
  const records=publicTournamentRecords(),today=todayIso(),upcoming=records.filter(item=>item.planned||(item.date&&item.date>today)),past=records.filter(item=>!item.planned&&(!item.date||item.date<=today)).sort((a,b)=>(b.date||'').localeCompare(a.date||'')),live=liveCompetitionCards();
  status.innerHTML=T20Cloud.authResolved?'':'<span class="public-loading">Aktuelle Vereinsdaten werden geladen …</span>';
  $('#publicAdminSchedule')?.classList.toggle('hidden',!isAdmin());
  if(isAdmin()){const select=$('#publicScheduleSeason');if(select)select.innerHTML=(seasonStore.seasons||[]).map(season=>`<option value="${esc(season.id)}" ${season.id===selectedSeason()?.id?'selected':''}>${esc(season.name)}${season.archived?' · Archiv':''}</option>`).join('')||'<option value="">Zuerst eine Saison erstellen</option>';const date=$('#publicScheduleDate');if(date&&!date.value)date.value=todayIso()}
  $('#publicLiveGames').innerHTML=live.join('')||'<div class="public-empty"><span>○</span><p>Derzeit läuft kein Spiel. Sobald ein Turnier startet, erscheint es hier automatisch.</p></div>';
  $('#publicUpcomingGames').innerHTML=upcoming.map(item=>publicEventRow(item,'future')).join('')||'<div class="public-empty"><p>Derzeit sind keine zukünftigen Spieltage eingetragen.</p></div>';
  const visiblePast=publicPastExpanded?past:past.slice(0,2),pastToggle=past.length>2?`<button class="secondary public-past-toggle" type="button" data-public-past-toggle aria-expanded="${publicPastExpanded}">${publicPastExpanded?'Weniger anzeigen':`Mehr anzeigen (${past.length-2})`} <span>${publicPastExpanded?'↑':'↓'}</span></button>`:'';
  $('#publicPastGames').innerHTML=visiblePast.map(item=>publicEventRow(item,'past')).join('')+pastToggle||'<div class="public-empty"><p>Noch keine vergangenen Spiele vorhanden.</p></div>';
  $('#publicSeasonRankings').innerHTML=(seasonStore.seasons||[]).map(season=>{const rows=calculateSeasonStandings(season);return `<article class="public-ranking-card"><div><span>${season.archived?'ARCHIV':'SAISON'}</span><h3>${esc(season.name)}</h3><small>${publicDate(season.startDate)} – ${publicDate(season.endDate)}</small></div>${rows.length?`<ol>${rows.slice(0,5).map(row=>`<li><button class="public-player-link" type="button" data-public-player="${esc(playerProfileReference(row))}">${esc(row.name)}</button><b>${row.cleanPoints} Pkt.</b></li>`).join('')}</ol>`:'<p>Noch keine Wertung vorhanden.</p>'}<button class="link-btn" type="button" data-season-open="${esc(season.id)}">Vollständige Rangliste öffnen</button></article>`}).join('')||'<div class="public-empty"><p>Noch keine Saisonranglisten vorhanden.</p></div>';
  if(refreshRegistrations)loadTournamentRegistrations();
}

function updateAppUrl(area,extras={},replace=false){
  if(applyingRoute)return;
  const url=new URL(location.href);url.searchParams.set('bereich',area);
  ['produkt','kategorie','bewerb','spieler'].forEach(key=>{const value=extras[key];if(value)url.searchParams.set(key,value);else url.searchParams.delete(key)});
  const next=url.pathname+(url.searchParams.size?`?${url.searchParams}`:'')+url.hash;
  history[replace?'replaceState':'pushState']({},document.title,next);
}
async function applyAppRoute(){
  const params=new URLSearchParams(location.search),area=params.get('bereich')||'start',product=params.get('produkt')||'',category=params.get('kategorie')||'',competition=params.get('bewerb')||'men',player=params.get('spieler')||'';
  applyingRoute=true;
  try{
    if(area==='empfehlungen'||product){await showShop({productId:product,category,updateUrl:false});return}
    if(area==='spieler'&&player){showPlayerProfile(player,false);return}
    if(area==='saison'){showSeason(false);return}
    if(area==='konto'){showLogin(false);return}
    if(area==='einstellungen'){showSettings(false);return}
    if(area==='live'){showLive(competition,false);return}
    if(area==='turnier'){showTournament(false);return}
    showHome(false);
  }finally{applyingRoute=false}
}
function hideMainSections(){['publicHomeSection','playerProfileSection','dashboardSection','authSection','settingsSection','seasonSection','shopSection','tournamentSubnav','competitionNav','memberLiveEmpty','setupSection','tournamentSection'].forEach(id=>$('#'+id)?.classList.add('hidden'))}
function renderNavigation(){
  const admin=isAdmin(),member=isMember(),guest=!admin&&!member;
  $('.club-settings-block')?.classList.remove('hidden');
  $('#showSettingsBtn')?.classList.toggle('hidden',!admin);
  $('#showSeasonBtn')?.classList.remove('hidden');
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
function showHome(updateUrl=true){hideMainSections();$('#publicHomeSection')?.classList.remove('hidden');renderPublicHome();renderNavigation();if(updateUrl)updateAppUrl('start')}
function showDashboard(){showHome()}
function selectLiveCompetition(key){
  if(!['men','women'].includes(key)||key===state.activeCompetition)return;
  syncActiveCompetition();state.activeCompetition=key;loadActiveCompetition();
}
function showLive(key='men',updateUrl=true){const competition=['men','women'].includes(key)?key:'men';if(updateUrl)updateAppUrl('live',{bewerb:competition});selectLiveCompetition(competition);showTournament(false)}
function livePublicUrl(key=state.activeCompetition){const url=new URL(TRIPLE20_PUBLIC_URL);url.searchParams.set('bereich','live');url.searchParams.set('bewerb',['men','women'].includes(key)?key:'men');return url.href}
function renderLiveQrCode(key=state.activeCompetition){
  const box=$('#liveQrCode'),link=$('#liveQrLink'),url=livePublicUrl(key);if(link){link.href=url;link.textContent=url}if(!box)return;box.innerHTML='';
  if(typeof QRCode==='function')new QRCode(box,{text:url,width:260,height:260,colorDark:'#07111f',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});else box.innerHTML='<p>Der QR-Code konnte nicht geladen werden. Bitte verwende den angezeigten Link.</p>';
  document.querySelectorAll('[data-live-qr-competition]').forEach(button=>button.classList.toggle('active',button.dataset.liveQrCompetition===key));
}
function openLiveQr(){
  if(!isAdmin())return;$('#liveQrOverlay')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div id="liveQrOverlay" class="live-qr-overlay" role="dialog" aria-modal="true" aria-labelledby="liveQrTitle"><section class="live-qr-dialog"><button id="closeLiveQrBtn" class="live-qr-close" type="button" aria-label="QR-Code schließen">×</button><span class="eyebrow">ZUSCHAUER-LINK</span><h2 id="liveQrTitle">Live-Spielplan öffnen</h2><p>QR-Code scannen und den Spielplan ohne Anmeldung ansehen.</p><div class="live-qr-switch"><button class="secondary" type="button" data-live-qr-competition="men">Herren</button><button class="secondary" type="button" data-live-qr-competition="women">Damen</button></div><div id="liveQrCode" class="live-qr-code"></div><a id="liveQrLink" class="live-qr-link" href="#" target="_blank" rel="noopener"></a><button id="copyLiveQrLinkBtn" class="primary" type="button">LINK KOPIEREN <span>⧉</span></button></section></div>`);renderLiveQrCode(state.activeCompetition||'men');
}
function showLogin(updateUrl=true){hideMainSections();$('#authSection')?.classList.remove('hidden');renderCloudPanel();renderNavigation();if(updateUrl)updateAppUrl('konto')}
function showSettings(updateUrl=true){if(!isAdmin()){showLogin(updateUrl);return}hideMainSections();$('#settingsSection').classList.remove('hidden');renderSettingsForm();renderNavigation();if(updateUrl)updateAppUrl('einstellungen')}
function validPartnerUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&/(^|\.)amazon\.de$/i.test(url.hostname)}catch{return false}}
function validProductImage(value){return typeof value==='string'&&(/^product-images\/[a-z0-9][a-z0-9._-]*\.(?:avif|jpe?g|png|webp)$/i.test(value)||/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value))}
function shopIcon(icon='target'){return({target:'🎯',camera:'📷',club:'👥',starter:'✨',case:'💼',light:'💡',board:'◉',tools:'🔧'})[icon]||'🎯'}
async function flushRecommendationClicks(){
  const pending=safeJsonParse(localStorage.getItem(PENDING_RECOMMENDATION_CLICKS_KEY)||'[]',[]);if(!pending.length||!T20Cloud.client||!navigator.onLine)return;
  try{const {error}=await T20Cloud.client.from('triple20_recommendation_clicks').insert(pending.map(productId=>({product_id:productId})));if(error)throw error;localStorage.removeItem(PENDING_RECOMMENDATION_CLICKS_KEY)}catch(error){console.warn('Empfehlungsklicks konnten noch nicht übertragen werden:',error)}
}
function trackRecommendationClick(productId){
  if(!/^[a-z0-9-]{1,80}$/.test(productId||''))return;const pending=safeJsonParse(localStorage.getItem(PENDING_RECOMMENDATION_CLICKS_KEY)||'[]',[]);pending.push(productId);localStorage.setItem(PENDING_RECOMMENDATION_CLICKS_KEY,JSON.stringify(pending.slice(-100)));flushRecommendationClicks();
}
async function loadRecommendationClickStats(){
  if(!isAdmin()||recommendationClicksLoading||!T20Cloud.client)return;recommendationClicksLoading=true;
  try{await flushRecommendationClicks();const {data,error}=await T20Cloud.client.from('triple20_recommendation_clicks').select('product_id');if(error)throw error;recommendationClickStats={};for(const row of data||[])recommendationClickStats[row.product_id]=(recommendationClickStats[row.product_id]||0)+1;renderShopAdmin()}
  catch(error){console.warn('Klickstatistik konnte nicht geladen werden:',error)}finally{recommendationClicksLoading=false}
}
async function loadShopConfig(){
  if(shopLoaded)return shopConfig;
  const legacy=safeJsonParse(localStorage.getItem(SHOP_DATA_KEY)||'null'),managed=Array.isArray(appSettings.recommendations?.products)?appSettings.recommendations:legacy;
  if(Array.isArray(managed?.products)){shopConfig=managed;shopLoaded=true;return shopConfig}
  try{const response=await fetch(`${SHOP_CONFIG_URL}?v=2`,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();shopConfig={products:Array.isArray(data.products)?data.products:[]}}
  catch(error){shopConfig=SHOP_FALLBACK;console.info('Empfehlungen konnten nicht geladen werden.',error)}
  shopLoaded=true;return shopConfig;
}
function renderShop(){
  const filters=$('#shopCategoryFilters'),grid=$('#shopProductGrid'),status=$('#shopStatus');if(!filters||!grid)return;
  renderShopAdmin();
  filters.innerHTML=SHOP_CATEGORIES.map(([id,label])=>`<button type="button" class="shop-filter ${shopCategory===id?'active':''}" data-shop-category="${id}" aria-pressed="${shopCategory===id}">${esc(label)}</button>`).join('');
  const products=(shopConfig.products||[]).filter(product=>product.enabled!==false&&(shopCategory==='all'||product.category===shopCategory));
  if(!products.length){grid.innerHTML='';status.innerHTML=`<div class="shop-empty"><span>🎯</span><h2>Noch keine Empfehlungen</h2><p>${isAdmin()?'Lege oben eine neue Empfehlung an.':'Weitere Empfehlungen folgen.'}</p></div>`;return}
  status.innerHTML='';grid.innerHTML=products.map(product=>{
    const hasLink=validPartnerUrl(product.url),tags=(product.tags||[]).slice(0,3).map(tag=>`<span>${esc(tag)}</span>`).join('');
    const action=hasLink?`<a class="shop-link" href="${esc(product.url)}" target="_blank" rel="sponsored noopener noreferrer" data-shop-click="${esc(product.id||'')}" aria-label="${esc(product.title)} bei Amazon ansehen (Werbung)">Bei Amazon ansehen <span>↗</span></a>`:'<span class="shop-link disabled" aria-disabled="true">Link folgt</span>';
    const visual=validProductImage(product.image)?`<img src="${esc(product.image)}" alt="${esc(product.imageAlt||product.title||'Produktbild')}" loading="lazy">`:`<span aria-hidden="true">${shopIcon(product.icon)}</span>`;
    const productId=/^[a-z0-9-]+$/.test(product.id||'')?product.id:'';
    return `<article class="shop-product ${productId&&productId===shopProductTarget?'is-targeted':''}"${productId?` id="produkt-${productId}" data-shop-product="${productId}"`:''}><div class="shop-product-heading"><div class="shop-ad-label">WERBUNG · PARTNERLINK</div><p class="shop-product-kicker">${esc(SHOP_CATEGORIES.find(([id])=>id===product.category)?.[1]||'Empfehlung')}</p><h2>${esc(product.title||'Empfehlung')}</h2></div><div class="shop-product-visual">${visual}<small>${validProductImage(product.image)?'Eigenes Produktbild':'Eigene Empfehlung'}</small></div><div class="shop-product-body"><p>${esc(product.description||'')}</p><div class="shop-tags">${tags}</div>${action}</div></article>`
  }).join('');
  if(shopProductTarget)requestAnimationFrame(()=>document.querySelector(`[data-shop-product="${shopProductTarget}"]`)?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function shopProductId(title=''){const base=title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'empfehlung';let id=base,n=2;while((shopConfig.products||[]).some(product=>product.id===id&&product.id!==shopAdminEditId))id=`${base}-${n++}`;return id}
function renderShopAdmin(){
  const panel=$('#shopAdminPanel'),list=$('#shopAdminList'),stats=$('#shopAdminClickStats');if(!panel||!list)return;
  panel.classList.toggle('hidden',!isAdmin());if(!isAdmin())return;
  const products=shopConfig.products||[],total=Object.values(recommendationClickStats).reduce((sum,value)=>sum+value,0);if(stats)stats.innerHTML=`<article><span>Partnerlink-Klicks insgesamt</span><b>${total}</b><small>Keine personenbezogenen Daten</small></article>`;
  list.innerHTML=products.map((product,index)=>`<article class="shop-admin-item ${product.enabled===false?'is-disabled':''}"><span class="shop-admin-thumb">${validProductImage(product.image)?`<img src="${esc(product.image)}" alt="">`:`<i>${shopIcon(product.icon)}</i>`}</span><div><b>${esc(product.title||'Unbenannte Empfehlung')}</b><small>${esc(SHOP_CATEGORIES.find(([id])=>id===product.category)?.[1]||'Empfehlung')} · ${product.enabled===false?'Ausgeblendet':'Öffentlich'} · ${recommendationClickStats[product.id]||0} Klicks</small></div><div class="shop-admin-item-actions"><button class="secondary" type="button" data-shop-move="up" data-shop-id="${esc(product.id)}" ${index===0?'disabled':''} aria-label="Nach oben">↑</button><button class="secondary" type="button" data-shop-move="down" data-shop-id="${esc(product.id)}" ${index===products.length-1?'disabled':''} aria-label="Nach unten">↓</button><button class="secondary" type="button" data-shop-edit="${esc(product.id)}">Bearbeiten</button><button class="danger" type="button" data-shop-delete="${esc(product.id)}">Löschen</button></div></article>`).join('')||'<p class="view-note">Noch keine Empfehlungen vorhanden.</p>';
}
function resetShopAdminForm(){shopAdminEditId='';shopAdminImage='';$('#shopAdminForm')?.reset();if($('#shopAdminProductId'))$('#shopAdminProductId').value='';if($('#shopAdminEnabled'))$('#shopAdminEnabled').checked=true;$('#shopAdminImagePreview').innerHTML='<span>🎯</span>';$('#shopAdminForm')?.classList.add('hidden')}
function openShopAdminForm(id=''){
  if(!isAdmin())return;const product=(shopConfig.products||[]).find(item=>item.id===id);shopAdminEditId=product?.id||'';shopAdminImage=product?.image||'';
  $('#shopAdminProductId').value=shopAdminEditId;$('#shopAdminTitleInput').value=product?.title||'';$('#shopAdminCategory').value=product?.category||'darts';$('#shopAdminDescription').value=product?.description||'';$('#shopAdminTags').value=(product?.tags||[]).join(', ');$('#shopAdminUrl').value=product?.url||'';$('#shopAdminEnabled').checked=product?.enabled!==false;
  $('#shopAdminImagePreview').innerHTML=validProductImage(shopAdminImage)?`<img src="${esc(shopAdminImage)}" alt="Produktbild-Vorschau">`:'<span>🎯</span>';$('#shopAdminForm').classList.remove('hidden');$('#shopAdminTitleInput').focus();$('#shopAdminForm').scrollIntoView({behavior:'smooth',block:'nearest'});
}
async function prepareShopImage(file){
  if(!file||(!file.type.startsWith('image/')&&!/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name||'')))throw new Error('Bitte eine Bilddatei auswählen.');if(file.size>50*1024*1024)throw new Error('Das Ausgangsbild ist größer als 50 MB.');
  const bitmap=await decodeAvatarImage(file),size=900,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const context=canvas.getContext('2d');context.fillStyle='#f7f8fa';context.fillRect(0,0,size,size);const scale=Math.min((size-60)/bitmap.width,(size-60)/bitmap.height),width=bitmap.width*scale,height=bitmap.height*scale;context.drawImage(bitmap,(size-width)/2,(size-height)/2,width,height);bitmap.close?.();return canvas.toDataURL('image/webp',.82)
}
function persistShopConfig(){
  if(!isAdmin())return false;appSettings={...appSettings,recommendations:{products:shopConfig.products||[]}};saveSettings();localStorage.removeItem(SHOP_DATA_KEY);shopLoaded=true;renderShop();return true
}
function saveShopAdminProduct(){
  if(!isAdmin())return;const title=$('#shopAdminTitleInput').value.trim(),url=$('#shopAdminUrl').value.trim();if(!title)return;if(!validPartnerUrl(url)){alert('Bitte einen gültigen Amazon.de-Partnerlink eintragen.');return}
  const existing=(shopConfig.products||[]).find(product=>product.id===shopAdminEditId),product={...existing,id:existing?.id||shopProductId(title),category:$('#shopAdminCategory').value,title,description:$('#shopAdminDescription').value.trim(),tags:$('#shopAdminTags').value.split(',').map(tag=>tag.trim()).filter(Boolean).slice(0,3),icon:existing?.icon||'target',image:shopAdminImage,imageAlt:`${title} Produktbild`,url,enabled:$('#shopAdminEnabled').checked};
  if(existing)Object.assign(existing,product);else shopConfig.products=[...(shopConfig.products||[]),product];persistShopConfig();resetShopAdminForm();alert('Die Empfehlung wurde gespeichert und wird mit der Cloud synchronisiert.')
}
function deleteShopAdminProduct(id){if(!isAdmin())return;const product=(shopConfig.products||[]).find(item=>item.id===id);if(!product||!confirm(`Empfehlung „${product.title}“ wirklich löschen?`))return;shopConfig.products=shopConfig.products.filter(item=>item.id!==id);persistShopConfig();resetShopAdminForm()}
function moveShopAdminProduct(id,direction){if(!isAdmin())return;const products=shopConfig.products||[],index=products.findIndex(item=>item.id===id),next=index+(direction==='up'?-1:1);if(index<0||next<0||next>=products.length)return;[products[index],products[next]]=[products[next],products[index]];persistShopConfig()}
async function showShop({productId='',category='',updateUrl=true}={}){
  hideMainSections();$('#shopSection')?.classList.remove('hidden');renderNavigation();await loadShopConfig();
  const target=(shopConfig.products||[]).find(product=>product.enabled!==false&&product.id===productId);
  shopProductTarget=target?.id||'';shopCategory=target?.category||(SHOP_CATEGORIES.some(([id])=>id===category)?category:'all');renderShop();
  if(isAdmin())loadRecommendationClickStats();else flushRecommendationClicks();
  if(updateUrl)updateAppUrl('empfehlungen',{produkt:shopProductTarget,kategorie:shopProductTarget?'':shopCategory==='all'?'':shopCategory});
}
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
function showTournament(updateUrl=true){hideMainSections();$('#competitionNav')?.classList.remove('hidden');renderTournament();renderNavigation();if(updateUrl)updateAppUrl('turnier')}
function showSeason(updateUrl=true){if(!isClubMode()){showHome(updateUrl);return}hideMainSections();$('#seasonSection').classList.remove('hidden');renderSeasonView();renderNavigation();if(updateUrl)updateAppUrl('saison')}
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
  if(e.target.id==='memberLoginForm')T20Cloud.sendLoginCode($('#memberEmail').value.trim());
  if(e.target.id==='memberCodeForm')T20Cloud.verifyLoginCode($('#memberOtpCode').value);
  if(e.target.id==='memberProfileForm')T20Cloud.saveProfile($('#profileDisplayName').value,$('#profileNickname').value);
  if(e.target.id==='adminPushForm')PushNotifications.send($('#pushTitle').value,$('#pushBody').value,$('#pushUrl').value);
  if(e.target.id==='checkInGuestForm')addAdminCheckInGuest($('#checkInGuestName')?.value||'');
});
$('#cloudAdminPanel').addEventListener('click',e=>{
  const memberProfile=e.target.closest('[data-member-profile]');if(memberProfile){showPlayerProfile(memberProfile.dataset.memberProfile);return}
  const memberSeason=e.target.closest('[data-member-season]');if(memberSeason){selectedSeasonId=memberSeason.dataset.memberSeason;persistSeasons();showSeason();return}
  if(e.target.closest('[data-member-home]')){showHome();return}
  if(e.target.id==='adminLogoutBtn'||e.target.id==='memberLogoutBtn')T20Cloud.signOut();
  if(e.target.id==='removeAvatarBtn')T20Cloud.removeAvatar();
  if(e.target.id==='refreshMembersBtn')T20Cloud.refreshAdminProfiles();
  if(e.target.id==='changeMemberEmailBtn'){T20Cloud.otpEmail='';T20Cloud.authMessage='';T20Cloud.authError='';renderCloudPanel();return}
  if(e.target.id==='resendMemberCodeBtn'){T20Cloud.sendLoginCode();return}
  if(e.target.id==='enablePushBtn')PushNotifications.enable();
  if(e.target.id==='disablePushBtn')PushNotifications.disable();
  const checkIn=e.target.closest('[data-admin-checkin]');if(checkIn){adminCheckInEventKey=checkIn.dataset.adminCheckin;renderCloudPanel();return}
  if(e.target.closest('[data-checkin-close]')){adminCheckInEventKey='';renderCloudPanel();return}
  const removeGuest=e.target.closest('[data-checkin-remove-guest]');if(removeGuest){removeAdminCheckInGuest(+removeGuest.dataset.checkinRemoveGuest);return}
  if(e.target.closest('[data-checkin-transfer]')){transferAdminCheckInToTournament();return}
  if(e.target.closest('[data-admin-home]')){showHome();return}
  if(e.target.closest('[data-admin-tournament]')){showTournament();return}
  if(e.target.id==='closeAuthTabBtn'){try{window.close()}catch{}}
  if(e.target.id==='continueAuthTabBtn'){clearTimeout(T20Cloud.authHandoffCloseTimer);T20Cloud.authHandoffActive=false;showLogin()}
  if(e.target.id==='backupDownloadBtn')backupTriple20Data();
  if(e.target.id==='uploadLocalBtn')T20Cloud.uploadLocalWithBackup();
  if(e.target.id==='loadCloudBtn')T20Cloud.loadCloudConfirmed();
  if(e.target.id==='forceCloudBtn'){if(confirm('Lokale Daten wirklich in der Cloud überschreiben?'))T20Cloud.syncAll({force:true})}
});
$('#cloudAdminPanel').addEventListener('change',e=>{if(e.target.id==='backupImportInput')handleBackupImport(e.target.files?.[0]);if(e.target.id==='profileAvatarInput'&&e.target.files?.[0])openAvatarCrop(e.target.files[0]).catch(error=>{T20Cloud.authError=`Bild konnte nicht geöffnet werden: ${error?.message||'Unbekannter Fehler'}`;renderCloudPanel()});if(e.target.matches('[data-checkin-user]'))updateAdminCheckInUser(e.target.dataset.checkinUser,e.target.checked)});
document.addEventListener('click',e=>{if(e.target.id==='cancelAvatarCropBtn'||e.target.id==='avatarCropOverlay')closeAvatarCrop();if(e.target.id==='saveAvatarCropBtn')saveAvatarCrop()});
$('#showTournamentBtn').addEventListener('click',()=>showTournament());
$('#showHomeBtn')?.addEventListener('click',()=>showHome());
$('#publicHomeSection')?.addEventListener('submit',event=>{if(event.target.id!=='publicScheduleForm')return;event.preventDefault();createPublicSchedule()});
$('#publicHomeSection')?.addEventListener('click',event=>{const player=event.target.closest('[data-public-player]');if(player){showPlayerProfile(player.dataset.publicPlayer);return}const live=event.target.closest('[data-open-live]');if(live){showLive(live.dataset.openLive);return}if(event.target.closest('[data-event-login]')){showLogin();return}const registration=event.target.closest('[data-event-registration]');if(registration){changeTournamentRegistration(registration.dataset.eventRegistration,registration.dataset.registrationAction);return}const calendar=event.target.closest('[data-public-calendar]');if(calendar){addPublicEventToCalendar(calendar.dataset.publicCalendar);return}const whatsapp=event.target.closest('[data-public-whatsapp]');if(whatsapp){sharePublicEventOnWhatsApp(whatsapp.dataset.publicWhatsapp);return}const graphic=event.target.closest('[data-result-graphic]');if(graphic){openResultGraphic(graphic.dataset.resultGraphic);return}const remove=event.target.closest('[data-public-delete]');if(remove){deletePublicTournament(remove.dataset.publicDelete);return}if(event.target.closest('[data-public-past-toggle]')){publicPastExpanded=!publicPastExpanded;renderPublicHome({refreshRegistrations:false});return}const nav=event.target.closest('[data-public-nav]');if(nav?.dataset.publicNav==='turnier'){showTournament();return}if(nav?.dataset.publicNav==='saison'){showSeason();return}const seasonButton=event.target.closest('[data-season-open]');if(seasonButton){selectedSeasonId=seasonButton.dataset.seasonOpen;persistSeasons();showSeason()}});
document.addEventListener('click',event=>{if(event.target.id==='closeResultGraphicBtn'||event.target.id==='resultGraphicOverlay'){closeResultGraphic();return}if(event.target.id==='downloadResultGraphicBtn'){downloadResultGraphic();return}if(event.target.closest('#shareResultGraphicBtn'))shareResultGraphic()});
document.addEventListener('click',e=>{const modeButton=e.target.closest('[data-tournament-mode]');if(modeButton){setTournamentViewMode(modeButton.dataset.tournamentMode);return}const competitionButton=e.target.closest('[data-competition]');if(competitionButton){const liveRoute=new URLSearchParams(location.search).get('bereich')==='live';if(liveRoute||!isAdmin())showLive(competitionButton.dataset.competition);else setActiveCompetition(competitionButton.dataset.competition)}});
$('#showLiveQrBtn')?.addEventListener('click',openLiveQr);
document.addEventListener('click',async event=>{if(event.target.id==='closeLiveQrBtn'||event.target.id==='liveQrOverlay'){$('#liveQrOverlay')?.remove();return}const switchButton=event.target.closest('[data-live-qr-competition]');if(switchButton){renderLiveQrCode(switchButton.dataset.liveQrCompetition);return}const copyButton=event.target.closest('#copyLiveQrLinkBtn');if(copyButton){const value=$('#liveQrLink')?.href||'';try{await navigator.clipboard.writeText(value);copyButton.firstChild.textContent='LINK KOPIERT '}catch{prompt('Live-Link kopieren:',value)}}});
$('#showSeasonBtn').addEventListener('click',()=>showSeason());
$('#showShopBtn').addEventListener('click',()=>showShop());
$('#showSettingsBtn').addEventListener('click',()=>showSettings());
$('#shopCategoryFilters')?.addEventListener('click',e=>{const button=e.target.closest('[data-shop-category]');if(!button)return;shopProductTarget='';shopCategory=button.dataset.shopCategory;renderShop();updateAppUrl('empfehlungen',{kategorie:shopCategory==='all'?'':shopCategory})});
$('#shopProductGrid')?.addEventListener('click',event=>{const link=event.target.closest('[data-shop-click]');if(link)trackRecommendationClick(link.dataset.shopClick)});
$('#shopAdminPanel')?.addEventListener('submit',event=>{if(event.target.id!=='shopAdminForm')return;event.preventDefault();saveShopAdminProduct()});
$('#shopAdminPanel')?.addEventListener('click',event=>{
  const edit=event.target.closest('[data-shop-edit]'),remove=event.target.closest('[data-shop-delete]'),move=event.target.closest('[data-shop-move]');
  if(event.target.closest('#shopAdminNewBtn')){openShopAdminForm();return}
  if(event.target.closest('#shopAdminCancelBtn')){resetShopAdminForm();return}
  if(edit){openShopAdminForm(edit.dataset.shopEdit);return}
  if(remove){deleteShopAdminProduct(remove.dataset.shopDelete);return}
  if(move)moveShopAdminProduct(move.dataset.shopId,move.dataset.shopMove)
});
$('#shopAdminImageInput')?.addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;const input=event.target;input.disabled=true;try{shopAdminImage=await prepareShopImage(file);$('#shopAdminImagePreview').innerHTML=`<img src="${esc(shopAdminImage)}" alt="Produktbild-Vorschau">`}catch(error){alert(`Bild konnte nicht verarbeitet werden: ${error?.message||'Unbekannter Fehler'}`)}finally{input.disabled=false;input.value=''}});
$('#showLoginBtn').addEventListener('click',()=>showLogin());
window.addEventListener('popstate',applyAppRoute);
$('#themeMode').addEventListener('change',e=>renderThemePreview(e.target.value));
$('#settingsForm').addEventListener('submit',e=>{e.preventDefault();const themeMode=$('#themeMode').value,preset=themeModes[themeMode]||themeModes.light;updateSettings({appName:'Triple20',mode:$('#settingsMode').value,themeMode,club:{enabled:$('#settingsMode').value==='club',name:$('#settingsClubName').value.trim(),logo:$('#settingsClubLogo').value.trim(),color:$('#settingsClubColor').value,seasonMode:$('#settingsSeasonMode').value,dropResults:appSettings.club.dropResults,pointSystem:{5:+$('#points5').value,4:+$('#points4').value,3:+$('#points3').value,2:+$('#points2').value,1:+$('#points1').value,0:+$('#points0').value}},tournament:{defaultMode:$('#settingsDefaultMode').value,defaultFormat:$('#settingsDefaultFormat').value,defaultLegs:+$('#settingsDefaultLegs').value},theme:{...preset.theme}});applyTournamentDefaults();showDashboard()});
function createCurrentSeasonFromAction(){const h=currentHalfYear(),existing=seasonStore.seasons.find(s=>s.name===h.name);seasonFormOpen=false;if(existing){selectedSeasonId=existing.id;persistSeasons();renderSeasonView();return}createSeason({name:h.name,startDate:h.start,endDate:h.end,dropCount:+$('#seasonDrops').value||0})}
$('#seasonActionSelect').addEventListener('change',e=>{const action=e.target.value;e.target.value='';if(!action)return;if(action==='edit'){seasonFormOpen=!seasonFormOpen;renderSeasonView();return}if(action==='current'){createCurrentSeasonFromAction();return}const season=selectedSeason();if(!season)return;if(action==='archive'){if(!confirm(`${season.name} archivieren?`))return;season.archived=true;saveSeason(season);return}if(action==='delete'){if(!confirm(`Saison „${season.name}“ wirklich endgültig löschen? Alle Spieltage und Saisonpunkte dieser Saison werden entfernt.`))return;deleteSeason(season.id)}});
$('#seasonForm').addEventListener('submit',e=>{e.preventDefault();updateSeasonFromForm()});
$('#seasonSelect').addEventListener('change',e=>{selectedSeasonId=e.target.value;seasonFormOpen=false;manualTournamentOpen=false;expandedSeasonTournamentIds.clear();persistSeasons();renderSeasonView()});
document.querySelectorAll('.season-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.season-tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');['standings','members','tournaments','stats','honors'].forEach(tab=>$('#season'+tab[0].toUpperCase()+tab.slice(1)).classList.toggle('hidden',b.dataset.seasonTab!==tab))}));
$('#seasonStandings').addEventListener('click',e=>{const toggle=e.target.closest('[data-season-mobile-toggle]');if(toggle){const name=toggle.dataset.seasonMobileToggle,details=[...document.querySelectorAll('[data-season-mobile-details]')].find(item=>item.dataset.seasonMobileDetails===name),open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));toggle.closest('.season-mobile-player')?.classList.toggle('is-open',!open);details?.classList.toggle('hidden',open);return}const el=e.target.closest('[data-season-player]');if(el){const row=calculateSeasonStandings().find(item=>item.name===el.dataset.seasonPlayer);showPlayerProfile(playerProfileReference(row||{name:el.dataset.seasonPlayer}))}});
$('#playerProfileSection')?.addEventListener('click',event=>{if(event.target.closest('[data-profile-back]')){history.length>1?history.back():showHome();return}const share=event.target.closest('[data-profile-share]');if(share){sharePlayerProfile(share.dataset.profileShare);return}const season=event.target.closest('[data-profile-season]');if(season){selectedSeasonId=season.dataset.profileSeason;persistSeasons();showSeason()}});
$('#seasonMembers').addEventListener('submit',e=>{if(e.target.id!=='memberForm')return;e.preventDefault();addSeasonMember($('#memberName').value);$('#memberName').value=''});
$('#seasonMembers').addEventListener('click',e=>{const name=e.target.dataset.removeMember;if(name)removeSeasonMember(name);const linkName=e.target.dataset.linkMember;if(linkName){const profileId=e.target.closest('.member-link-control')?.querySelector('select')?.value;if(!profileId){alert('Bitte zuerst einen registrierten Benutzer auswählen.');return}linkSeasonMemberProfile(linkName,profileId)}});
$('#seasonTournaments').addEventListener('submit',e=>{if(e.target.id!=='manualTournamentForm')return;e.preventDefault();addManualTournamentFromForm()});
$('#seasonTournaments').addEventListener('click',e=>{
  const detailId=e.target.dataset.tournamentDetail,renameId=e.target.dataset.renameTournament,deleteId=e.target.dataset.deleteTournament;
  if(e.target.id==='toggleManualTournament'){manualTournamentOpen=!manualTournamentOpen;renderSeasonTournaments();return}
  if(e.target.id==='addManualMatch'){const rows=$('#manualMatchRows'),players=manualTournamentPlayers();if(rows)rows.insertAdjacentHTML('beforeend',manualMatchRow(players,Math.max(1,...[...rows.querySelectorAll('[data-manual-round]')].map(input=>+input.value||1))));return}
  if(e.target.dataset.removeManualMatch!==undefined){e.target.closest('[data-manual-match]')?.remove();return}
  if(detailId){const box=document.getElementById(`details-${detailId}`);if(box){const willOpen=box.classList.contains('hidden');box.classList.toggle('hidden',!willOpen);if(willOpen)expandedSeasonTournamentIds.add(String(detailId));else expandedSeasonTournamentIds.delete(String(detailId));e.target.textContent=willOpen?'Details ausblenden':'Details anzeigen'}return}
  if(renameId){renameSeasonTournament(renameId);return}
  if(deleteId){const season=selectedSeason(),tournament=season?.tournaments?.find(t=>t.id===deleteId);if(!season||!tournament)return;if(!confirm(`Spieltag „${tournament.name}“ vom ${tournament.date} wirklich aus der Saison löschen?`))return;deleteTournamentFromSeason(season.id,deleteId)}
});
$('#seasonPlayerDetail').addEventListener('click',e=>{if(e.target.classList.contains('close-detail'))$('#seasonPlayerDetail').innerHTML=''});
$('#winnerCard').addEventListener('click',e=>{if(e.target.id==='exportCurrentTournamentBtn'){exportCurrentTournamentJson();return}if(e.target.id==='seasonFromWinnerBtn'){showSeason();return}if(e.target.id!=='addToSeasonBtn')return;const id=$('#seasonImportSelect')?.value;if(!id)return;const tournament=buildCurrentTournamentRecord();addTournamentToSeason(id,tournament);state.seasonImportedTo=id;state.seasonTournamentId=tournament.id;save();renderSeasonImport(champion());alert('Turnier wurde in die Saisonwertung übernommen.')});
$('#exportSeasonJsonBtn').addEventListener('click',exportSeasonJson);
$('#exportStandingsCsvBtn').addEventListener('click',exportStandingsCsv);
function renameEvent(){
  if(!isAdmin())return;
  const next=prompt('Neuer Name des Spieltags:',state.eventName||'');
  if(next===null)return;
  const name=next.trim();if(!name){alert('Bitte einen Namen für den Spieltag eingeben.');return}
  state.eventName=name;
  for(const [key,competition] of Object.entries(state.competitions||{})){competition.settings=competition.settings||{};competition.settings.eventName=name;competition.settings.name=`${name} – ${competitionLabel(key)}`}
  state.settings={...(state.settings||{}),eventName:name,name:competitionTitle()};
  if(state.savedToHistory){const history=loadTournamentHistory(),record=history.find(item=>item.id===state.savedToHistory);if(record){record.eventName=name;record.name=competitionTitle();record.settings={...(record.settings||{}),eventName:name,name:competitionTitle()};localStorage.setItem(TOURNAMENT_HISTORY_KEY,JSON.stringify(history))}}
  if(state.seasonImportedTo&&state.seasonTournamentId){const season=seasonStore.seasons.find(item=>item.id===state.seasonImportedTo),record=season?.tournaments?.find(item=>item.id===state.seasonTournamentId);if(record){record.eventName=name;record.name=competitionTitle();record.settings={...(record.settings||{}),eventName:name,name:competitionTitle()};persistSeasons()}}
  save();renderTournament();renderNavigation();
}
async function endTournamentEarly(){
  if(!isAdmin()||!state.started||state.endedEarly)return;
  const played=state.matches.filter(match=>match.sa!==null&&match.b!=='Freilos').length;
  if(!played){alert('Das Turnier kann erst beendet werden, wenn mindestens ein reguläres Spiel abgeschlossen ist.');return}
  const leader=standings()[0]?.name||'der aktuelle Tabellenführer';
  if(!confirm(`Turnier vorzeitig beenden?\n\nAktueller Tabellenführer: ${leader}\nGespielte Partien: ${played} von ${state.matches.filter(match=>match.b!=='Freilos').length}\n\nDanach kann das Turnier wie gewohnt in die Saisonwertung übernommen werden.`))return;
  state.endedEarly=true;save();renderTournament();await publishLiveTournament({notifyOnError:true});
}
async function reset(){if(state.started&&!confirm(`Den Bewerb „${competitionLabel()}“ wirklich löschen? Der andere Bewerb bleibt erhalten.`))return;for(const key of COMPETITION_KEYS)delete state[key];Object.assign(state,emptyCompetition());syncActiveCompetition();save();renderPlayers();renderTournament();showTournament();await publishLiveTournament({notifyOnError:true})}
$('#resetBtn').onclick=reset;$('#undoLastScoreBtn').onclick=undoLastScore;$('#endTournamentBtn').onclick=endTournamentEarly;$('#finishReset').onclick=reset;$('#renameEventBtn').onclick=renameEvent;registerAccess();applyTheme();applyTournamentDefaults();fillSeasonForm();renderPlayers();renderSettingsForm();renderNavigation();renderSeasonView();applyAppRoute();T20Cloud.init().finally(applyAppRoute);
