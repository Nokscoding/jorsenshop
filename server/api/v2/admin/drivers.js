import {db,json} from '../../_lib/shared.js';
import {requireStaff} from '../_lib/identity.js';
export default async function handler(req,res){
 if(req.method!=='GET')return json(res,405,{error:'Méthode interdite'});
 const staff=await requireStaff(req,res);if(!staff)return;
 try{
  const sql=db();
  const rows=await sql`SELECT r.auth_user_id AS id,COALESCE(u.name,'Livreur') AS name
   FROM v2_user_roles r LEFT JOIN neon_auth.user u
     ON u.id=r.auth_user_id
   WHERE r.role='livreur' AND r.enabled=true ORDER BY name LIMIT 100`;
  return json(res,200,{drivers:rows});
 }catch{return json(res,503,{error:'Liste des livreurs indisponible'})}
}
