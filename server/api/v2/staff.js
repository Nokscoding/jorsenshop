import {db,json} from '../_lib/shared.js';
import {requireUser,staffRole} from './_lib/identity.js';
export default async function handler(req,res){
 if(req.method!=='GET')return json(res,405,{error:'Méthode interdite'});
 const user=await requireUser(req,res);if(!user)return;
 const role=await staffRole(user,['admin','gerant','investisseur','livreur']);
 if(!role)return json(res,403,{error:'Compte professionnel non autorisé'});
 return json(res,200,{user,role});
}
