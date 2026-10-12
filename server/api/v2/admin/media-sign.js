import crypto from 'node:crypto';
import {json,only,rateLimit} from '../../_lib/shared.js';
import {requireStaff,validWriteOrigin} from '../_lib/identity.js';
export default async function handler(req,res){
 if(!only(req,res,'POST')||!validWriteOrigin(req,res))return;
 const staff=await requireStaff(req,res);if(!staff)return;
 try{if(!await rateLimit(req,'v2_media_sign',50,15))
  return json(res,429,{error:'Trop d’envois de photos'})}
 catch{return json(res,503,{error:'Upload momentanément indisponible'})}
 const cloud=process.env.CLOUDINARY_CLOUD_NAME,
   key=process.env.CLOUDINARY_API_KEY,secret=process.env.CLOUDINARY_API_SECRET;
 if(!cloud||!key||!secret)return json(res,503,{error:'Cloudinary non configuré'});
 const publicId='jorsenshop/catalog/'+crypto.randomUUID().replaceAll('-','');
 const timestamp=Math.floor(Date.now()/1000),overwrite='false';
 const params=`overwrite=${overwrite}&public_id=${publicId}&timestamp=${timestamp}`;
 const signature=crypto.createHash('sha1').update(params+secret).digest('hex');
 return json(res,200,{
  cloudName:cloud,apiKey:key,publicId,timestamp,overwrite,signature,
  uploadUrl:`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`
 });
}
