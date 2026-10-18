import {json,sessionRole,expireCookie,only} from '../_lib/shared.js';
export default async function handler(req,res){
 if(req.method==='POST'){if(!only(req,res,'POST'))return;expireCookie(res);return json(res,200,{ok:true});}
 if(req.method!=='GET')return json(res,405,{error:'Méthode non autorisée'});
 return json(res,200,{role:sessionRole(req)});
}
