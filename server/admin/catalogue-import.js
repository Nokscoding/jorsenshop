import {db,json,only,requireRole} from '../_lib/shared.js';
export default async function handler(req,res){
 if(!only(req,res,'POST')||!requireRole(req,res,'admin'))return;
 const catalogue=req.body?.products;
 if(!Array.isArray(catalogue)||catalogue.length<1||catalogue.length>150)
   return json(res,400,{error:'Choisir le fichier catalogue.json valide'});
 if(!process.env.CLOUDINARY_CLOUD_NAME)return json(res,503,{error:'Cloudinary non configuré'});
 try{
   const sql=db();
   const rows=await sql`SELECT staff_import_catalogue(${JSON.stringify(catalogue)}::jsonb,${process.env.CLOUDINARY_CLOUD_NAME}) AS result`;
   await sql`INSERT INTO audit_log(action,resource_type,resource_id,metadata)
      VALUES('import_catalogue','catalogue','v1',${JSON.stringify(rows[0].result)}::jsonb)`;
   return json(res,200,{ok:true,...rows[0].result});
 }catch(e){console.error('catalogue import:',e.name);return json(res,400,{error:'Catalogue incorrect ou déjà modifié : import non effectué'})}
}
