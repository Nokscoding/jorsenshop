import {shippingQuote} from '../../v2/shipping-policy.mjs';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Méthode non autorisée'});
  try{
    const {city,mode}=req.body??{};
    if(typeof city!=='string'||city.length>80||mode!=null&&(typeof mode!=='string'||mode.length>30))
      return res.status(400).json({error:'Ville ou mode incorrect'});
    return res.status(200).json({quote:shippingQuote(city,mode)});
  }catch(e){
    return res.status(400).json({error:e instanceof RangeError?e.message:'Impossible de calculer les frais'});
  }
}
