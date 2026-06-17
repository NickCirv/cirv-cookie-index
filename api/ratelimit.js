'use strict';

// Simple per-key daily fixed-window limiter. In-memory — fine for a single
// instance; a multi-instance deployment would swap this for Redis (same shape).
const buckets = new Map();

function dayNumber(now) {
  return Math.floor(now / 86400000);
}

function checkLimit(keyHash, limit, now, store = buckets) {
  const day = dayNumber(now);
  let b = store.get(keyHash);
  if (!b || b.day !== day) {
    b = { day, count: 0 };
    store.set(keyHash, b);
  }
  b.count++;
  return { allowed: b.count <= limit, remaining: Math.max(0, limit - b.count), limit };
}

function _reset() {
  buckets.clear();
}

module.exports = { checkLimit, dayNumber, _reset };
