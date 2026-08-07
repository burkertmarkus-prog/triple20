(()=>{
  const state={registration:null,refreshing:false};
  function showUpdate(registration){
    if(document.querySelector('#pwaUpdateNotice'))return;
    document.body.insertAdjacentHTML('beforeend','<aside id="pwaUpdateNotice" class="pwa-notice" role="status"><div><b>Triple20-Update verfügbar</b><small>Die laufenden Turnierdaten bleiben gespeichert.</small></div><button id="installPwaUpdateBtn" type="button">Jetzt aktualisieren</button><button id="dismissPwaUpdateBtn" type="button" aria-label="Später aktualisieren">×</button></aside>');
    document.querySelector('#installPwaUpdateBtn').onclick=()=>{state.refreshing=true;registration.waiting?.postMessage({type:'SKIP_WAITING'})};
    document.querySelector('#dismissPwaUpdateBtn').onclick=()=>document.querySelector('#pwaUpdateNotice')?.remove();
  }
  function setConnectionState(online){
    document.body.classList.toggle('app-offline',!online);
    if(!online){window.setSyncStatus?.('Offline – sicher auf diesem Gerät gespeichert','offline');return}
    if(window.T20Cloud?.isAdmin&&window.T20Cloud.pendingSync){window.setSyncStatus?.('Verbindung wiederhergestellt – synchronisiere …','saving');window.T20Cloud.syncAll().catch(()=>{})}
    else if(window.T20Cloud?.ready)window.T20Cloud.loadCloud().catch(()=>{});
    window.flushRecommendationClicks?.();window.loadTournamentRegistrations?.();
  }
  async function register(){
    setConnectionState(navigator.onLine);
    if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
    if(!('serviceWorker'in navigator)||location.protocol==='file:')return;
    try{
      const registration=await navigator.serviceWorker.register('./sw.js?v=20260807-1',{scope:'./'});state.registration=registration;
      if(registration.waiting)showUpdate(registration);
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate(registration)})});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(state.refreshing)location.reload()});
      setInterval(()=>registration.update().catch(()=>{}),60*60*1000);
    }catch(error){console.warn('Offline-Modus konnte nicht registriert werden:',error)}
  }
  window.addEventListener('online',()=>setConnectionState(true));
  window.addEventListener('offline',()=>setConnectionState(false));
  window.addEventListener('load',register,{once:true});
})();
