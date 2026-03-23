// OSCEMaster — Gumroad Licence Validator
// Deploy this to Vercel (free)
// Set environment variable: GUMROAD_ACCESS_TOKEN = your Gumroad access token

export default async function handler(req, res) {
  // Allow CORS from any origin (your HTML file can be opened from anywhere)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ valid: false, error: 'Method not allowed' });

  const { licenceKey } = req.body;

  if (!licenceKey || typeof licenceKey !== 'string') {
    return res.status(400).json({ valid: false, error: 'No licence key provided' });
  }

  const token = process.env.GUMROAD_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ valid: false, error: 'Server config error' });
  }

  try {
    // Gumroad licence verification API
    const gumroadRes = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_permalink: process.env.GUMROAD_PRODUCT_PERMALINK,
        license_key: licenceKey.trim(),
        increment_uses_count: 'false'
      })
    });

    const data = await gumroadRes.json();

    if (!data.success) {
      return res.status(200).json({ valid: false, error: 'Invalid licence key' });
    }

    const purchase = data.purchase;

    // Check subscription is still active (not cancelled/refunded)
    if (purchase.refunded || purchase.chargebacked) {
      return res.status(200).json({ valid: false, error: 'This licence has been refunded' });
    }

    // Check subscription is still active
    if (purchase.subscription_cancelled_at) {
      return res.status(200).json({
        valid: false,
        error: 'Your subscription has been cancelled. Renew at gumroad.com to continue.'
      });
    }

    // All good — return valid with user info
    return res.status(200).json({
      valid: true,
      email: purchase.email,
      name: purchase.full_name || '',
      since: purchase.created_at,
      plan: 'monthly'
    });

  } catch (err) {
    console.error('Validation error:', err);
    return res.status(500).json({ valid: false, error: 'Validation server error. Try again.' });
  }
}
