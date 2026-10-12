import {publicCities} from '../../../v2/shipping-policy.mjs';
export default function handler(req,res){
  res.setHeader('Cache-Control','public, max-age=180');
  if(req.method!=='GET') return res.status(405).json({error:'Méthode non autorisée'});
  return res.status(200).json({cities:publicCities(),currency:'CDF'});
}
