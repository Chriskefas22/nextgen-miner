export default function handler(req,res){
  const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
  res.status(200).json({ip: ip || null});
}
