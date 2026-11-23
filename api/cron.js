// Never mark a reminder sent without successful push delivery.
export default function handler(req,res){
  if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'});
  return res.status(503).json({ok:false,sent:0,error:'Web Push delivery is not configured'});
}
