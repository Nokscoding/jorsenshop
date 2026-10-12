import {db,json} from '../../_lib/shared.js';
export function authBase(){
 const raw=process.env.NEON_AUTH_BASE_URL;
 if(!raw)throw new Error('NEON_AUTH_BASE_URL_missing');
 const u=new URL(raw);
 if(u.protocol!=='https:'||!u.hostname.endsWith('.neon.tech')||!u.pathname.endsWith('/auth'))
   throw new Error('Neon Auth URL invalide');
 return u.toString().replace(/\/$/,'');
}
export async function authFetch(req,path,options={}){
 const cookies=String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>
  /^(?:__Secure-|__Host-)?(?:better-auth|neon-auth)\.[A-Za-z0-9_.-]+=/.test(x)).join('; ');
 const headers={'Content-Type':'application/json',Accept:'application/json'};
 if(cookies)headers.Cookie=cookies;
 if(req.headers.origin)headers.Origin=req.headers.origin;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),10000);
 try{
  return await fetch(authBase()+path,{...options,headers:{...headers,...options.headers},signal:controller.signal,redirect:'manual'});
 }finally{clearTimeout(timer)}
}
export async function currentUser(req){
 try{
  const r=await authFetch(req,'/get-session',{method:'GET'});
  if(!r.ok)return null;
  const b=await r.json();const u=(b?.data||b)?.user;
  return typeof u?.id==='string'&&typeof u?.email==='string'?
   {id:u.id,email:u.email,name:String(u.name||'')}:null;
 }catch{return null}
}
export async function requireUser(req,res){
 const user=await currentUser(req);
 if(!user){json(res,401,{error:'Connectez-vous pour continuer'});return null;}
 return user;
}
export async function staffRole(user,roles=['admin','gerant']){
 const sql=db();
 const rows=await sql`SELECT role FROM v2_user_roles WHERE auth_user_id=${user.id}
    AND enabled=true AND role=ANY(${roles}::text[]) LIMIT 1`;
 return rows[0]?.role||null;
}
export async function requireStaff(req,res,roles=['admin','gerant']){
 const user=await requireUser(req,res);if(!user)return null;
 const role=await staffRole(user,roles);
 if(!role){json(res,403,{error:'Accès professionnel interdit'});return null}
 return {...user,role};
}
export function validWriteOrigin(req,res){
 const origin=req.headers.origin;
 if(origin){try{if(new URL(origin).host!==req.headers.host)throw Error('origin')}
 catch{json(res,403,{error:'Origine interdite'});return false}}
 return true;
}
