import {db,json,only} from '../_lib/shared.js';
import {requireUser,validWriteOrigin} from './_lib/identity.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Méthode interdite'});
 const user=await requireUser(req,res);if(!user)return;
 const sql=db();
 if(req.method==='GET'){
  const rows=await sql`SELECT full_name,city_code,phone,address
    FROM v2_customer_profiles WHERE auth_user_id=${user.id}`;
  return json(res,200,{user,profile:rows[0]||null});
 }
 if(!only(req,res,'POST')||!validWriteOrigin(req,res))return;
 const b=req.body||{},city=String(b.city||'').toLowerCase(),
 name=String(b.name||'').trim(),phone=String(b.phone||'').trim(),address=String(b.address||'').trim();
 if(name.length>100||phone.length>32||address.length>350||!['lubumbashi','likasi','fungurume','kolwezi'].includes(city))
   return json(res,400,{error:'Profil invalide'});
 try{
  await sql`INSERT INTO v2_customer_profiles(auth_user_id,email,full_name,city_code,phone,address)
    VALUES(${user.id},${user.email},${name},${city},${phone},${address})
    ON CONFLICT(auth_user_id) DO UPDATE SET email=EXCLUDED.email,
      full_name=EXCLUDED.full_name,city_code=EXCLUDED.city_code,phone=EXCLUDED.phone,
      address=EXCLUDED.address,updated_at=now()`;
  return json(res,200,{ok:true,city});
 }catch{return json(res,503,{error:'Profil non enregistré'})}
}
