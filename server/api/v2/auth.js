import {json,rateLimit} from '../_lib/shared.js';
import {authFetch,currentUser,validWriteOrigin} from './_lib/identity.js';
function relayCookies(response){
 const list=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[];
 return list.map(cookie=>{
  const parts=cookie.split(';').map(x=>x.trim()).filter(x=>! /^(Domain|Path|SameSite|Secure|HttpOnly)(=|$)/i.test(x));
  const head=parts.shift();if(!head||!head.includes('='))return null;
  return [head,...parts,'Path=/','HttpOnly','Secure','SameSite=Lax'].join('; ');
 }).filter(Boolean);
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const action=String(req.query?.action||'session');
 if(!['signup','login','logout','session'].includes(action))return json(res,404,{error:'Action inconnue'});
 if(action==='session'){
  if(req.method!=='GET')return json(res,405,{error:'Méthode interdite'});
  const user=await currentUser(req);return json(res,200,{authenticated:!!user,user});
 }
 if(req.method!=='POST')return json(res,405,{error:'Méthode interdite'});
 if(!validWriteOrigin(req,res))return;
 try{
  if(!await rateLimit(req,action==='login'?'v2_login':'v2_signup',action==='signup'?6:12,15))
    return json(res,429,{error:'Trop de tentatives'});
 }catch{return json(res,503,{error:'Connexion momentanément indisponible'})}
 const body=req.body||{};let path,payload={};
 if(action==='signup'||action==='login'){
  const email=String(body.email||'').trim().toLowerCase();
  const password=String(body.password||'');
  if(email.length>254||!/.+@.+\..+/.test(email)||password.length<8||password.length>128)
    return json(res,400,{error:'Email ou mot de passe invalide (8 caractères minimum)'});
  payload={email,password};
  if(action==='signup'){
   const name=String(body.name||'').trim().replace(/\s+/g,' ');
   if(name.length<2||name.length>100)
    return json(res,400,{error:'Indiquez votre nom complet'});
   payload.name=name;
  }
  path=action==='signup'?'/sign-up/email':'/sign-in/email';
 }else path='/sign-out';
 try{
  const upstream=await authFetch(req,path,{method:'POST',body:JSON.stringify(payload)});
  const cookies=relayCookies(upstream);if(cookies.length)res.setHeader('Set-Cookie',cookies);
  if(!upstream.ok){
    const errorResult=await upstream.json().catch(()=>({}));
    const code=String(errorResult.code||errorResult.error?.code||'AUTH_REJECTED').replace(/[^A-Z0-9_]/gi,'').slice(0,55);
    const safeStatus=[400,401,403,404,409,422,429,500,502,503].includes(upstream.status)?upstream.status:400;
    console.warn('Neon Auth upstream rejected request', {action,status:upstream.status,code});
    const userFacing=code==='USER_ALREADY_EXISTS'?'Cette adresse possède déjà un compte. Connectez-vous.':
      code==='INVALID_EMAIL'?'Adresse e-mail invalide.':
      code==='PASSWORD_TOO_SHORT'?'Le mot de passe est trop court.':
      safeStatus===429?'Trop de tentatives. Veuillez patienter.':
      action==='signup'?'Inscription refusée par le service d’authentification.':
      'Connexion refusée par le service d’authentification.';
    return json(res,safeStatus,{error:userFacing+' (code '+code+', HTTP '+upstream.status+')',code});
  }
  return json(res,200,{ok:true});
 }catch(e){
  console.error('Neon auth',e?.name);
  return json(res,503,{error:'Authentification momentanément indisponible'});
 }
}
