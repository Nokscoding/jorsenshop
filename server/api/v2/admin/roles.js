import {db,json,only} from '../../_lib/shared.js';
import {requireStaff,validWriteOrigin} from '../_lib/identity.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Méthode interdite'});
 const actor=await requireStaff(req,res,['admin','gerant']);if(!actor)return;
 const sql=db();
 if(req.method==='GET'){
  const rows=await sql`SELECT r.auth_user_id AS id,u.name,u.email,r.role,r.enabled
    FROM v2_user_roles r LEFT JOIN neon_auth."user" u ON u.id::text=r.auth_user_id
    WHERE r.enabled=true AND r.role IN('gerant','investisseur','livreur','admin')
    ORDER BY r.role,u.name LIMIT 100`;
  return json(res,200,{roles:rows});
 }
 if(!only(req,res,'POST')||!validWriteOrigin(req,res))return;
 const b=req.body||{},role=String(b.role||''),
  email=String(b.email||'').trim().toLowerCase();
 if(!['admin','gerant','investisseur','livreur'].includes(role)||!/.+@.+\..+/.test(email)||
   email.length>254)return json(res,400,{error:'Rôle ou email incorrect'});
 if(role!=='livreur'&&actor.role!=='admin')
   return json(res,403,{error:'Seul un administrateur peut attribuer ce rôle'});
 try{
  const users=await sql`SELECT id FROM neon_auth."user" WHERE lower(email)=${email} LIMIT 1`;
  if(!users.length)return json(res,404,{error:'Ce compte doit se créer avant attribution du rôle'});
  const id=String(users[0].id);
  await sql`INSERT INTO v2_user_roles(auth_user_id,role,enabled)
    VALUES(${id},${role},true)
    ON CONFLICT(auth_user_id,role) DO UPDATE SET enabled=true`;
  return json(res,200,{ok:true,role,email});
 }catch{return json(res,503,{error:'Autorisation non enregistrée'})}
}
