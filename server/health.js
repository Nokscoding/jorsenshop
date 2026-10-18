import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({error:"Méthode non autorisée"});
  if (!process.env.DATABASE_URL) return res.status(503).json({ok:false,error:"Base non configurée"});
  try {
    const sql=neon(process.env.DATABASE_URL);
    await sql`SELECT 1 AS ping`;
    return res.status(200).json({ok:true,database:"connected"});
  } catch(e) {
    console.error("[Jorsenshop health]",e?.name||"DatabaseError");
    return res.status(503).json({ok:false,error:"Base indisponible"});
  }
}
