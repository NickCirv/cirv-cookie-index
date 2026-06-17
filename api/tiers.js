'use strict';

// Subscription tiers. Price IDs live in env (Stripe dashboard), never in code.
// rateLimit = requests per rolling day.
const TIERS = {
  free: { name: 'Free', rateLimit: 100, priceEnv: null },
  starter: { name: 'Starter', rateLimit: 5000, priceEnv: 'STRIPE_PRICE_STARTER' },
  pro: { name: 'Pro', rateLimit: 50000, priceEnv: 'STRIPE_PRICE_PRO' },
  bulk: { name: 'Bulk', rateLimit: 500000, priceEnv: 'STRIPE_PRICE_BULK' },
};

function priceForTier(tier, env = process.env) {
  const def = TIERS[tier];
  return def && def.priceEnv ? env[def.priceEnv] || null : null;
}

function tierForPrice(priceId, env = process.env) {
  if (!priceId) return null;
  for (const [tier, def] of Object.entries(TIERS)) {
    if (def.priceEnv && env[def.priceEnv] && env[def.priceEnv] === priceId) return tier;
  }
  return null;
}

module.exports = { TIERS, priceForTier, tierForPrice };
