'use strict';

// Thin Stripe wrapper. The client is created from an env secret and injected
// everywhere else, so tests run with a fake and make zero live calls.

function getStripe(secretKey) {
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set');
  return require('stripe')(secretKey);
}

async function createCheckout(stripe, { priceId, email, successUrl, cancelUrl, tier }) {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tier },
    subscription_data: { metadata: { tier } },
  });
}

async function createPortal(stripe, { customerId, returnUrl }) {
  return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
}

// Verifies the Stripe-Signature header against the raw body. Throws on mismatch.
function verifyWebhook(stripe, rawBody, signature, secret) {
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

module.exports = { getStripe, createCheckout, createPortal, verifyWebhook };
