(()=>{'use strict';
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
window.JORSEN_ENABLE_PUSH=async()=>{
 if(/iPhone|iPad|iPod/i.test(navigator.userAgent)&&
 !((window.matchMedia?.('(display-mode: standalone)').matches)||navigator.standalone))
  throw Error('Sur iPhone, ajoutez Jorsenshop à l’écran d’accueil puis ouvrez l’application.');
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))
  throw Error('Ce navigateur ne prend pas en charge les notifications push.');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error('Notifications non autorisées sur cet appareil.');
 const cfg=await fetch('/api/v2/push',{credentials:'same-origin'}).then(r=>r.json());
 if(!cfg.enabled||!cfg.publicKey)throw Error('Le service push n’est pas encore disponible.');
 const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/'});
 const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({
  userVisibleOnly:true,applicationServerKey:bytes(cfg.publicKey)});
 const res=await fetch('/api/v2/push',{method:'POST',credentials:'same-origin',
  headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()})});
 const o=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(o.error||'Activation impossible');
 return 'Notifications push activées pour cet appareil.';
};
window.JORSEN_DISABLE_PUSH=async()=>{
 try{
  if(!('serviceWorker' in navigator))return;
  const reg=await navigator.serviceWorker.getRegistration('/');
  const sub=await reg?.pushManager?.getSubscription();if(!sub)return;
  await fetch('/api/v2/push',{method:'DELETE',credentials:'same-origin',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON()})}).catch(()=>{});
  await sub.unsubscribe();
 }catch{}
};
})();