// Do not accept or claim to register push endpoints until real delivery is configured.
export default function handler(req,res){
  return res.status(503).json({ok:false,error:'Web Push delivery is not configured. Reminders are available in-app only.'});
}
