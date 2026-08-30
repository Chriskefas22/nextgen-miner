export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || '';

  if (!turnstileSiteKey) {
    return res.status(503).json({
      turnstileSiteKey: '',
      error: 'turnstile_site_key_not_configured'
    });
  }

  return res.status(200).json({
    turnstileSiteKey
  });
}
