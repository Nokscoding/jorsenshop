import {only,json,issueCookie,checkPassword,rateLimit} from '../_lib/shared.js';
export default async function handler(req,res){
 if(!only(req,res,'POST'))return;
 const role=req.body?.role,pass=req.body?.password;
 if(!['admin','investisseur'].includes(role))return json(res,400,{error:'Rôle incorrect'});
 try{if(!await rateLimit(req,'staff_login',10,15))return json(res,429,{error:'Trop de tentatives. Réessaie dans 15 minutes.'})}catch{return json(res,503,{error:'Connexion temporairement indisponible'})}
 if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)return json(res,503,{error:'Connexion du personnel non configurée'});
 const secret=role==='admin'?process.env.STAFF_ADMIN_PASSWORD_HASH:process.env.STAFF_INVESTOR_PASSWORD_HASH;
 if(!checkPassword(pass,secret))return json(res,401,{error:'Identifiants incorrects'});
 issueCookie(res,role);
 return json(res,200,{ok:true,role});
}
