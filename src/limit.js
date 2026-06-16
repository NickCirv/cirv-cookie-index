'use strict';

// Minimal concurrency limiter — runs at most `n` async thunks simultaneously.
// No dependency; the queue drains as slots free up.
function pLimit(n) {
  const queue = [];
  let active = 0;
  const next = () => {
    if (active >= n || queue.length === 0) return;
    active++;
    const { thunk, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(thunk)
      .then(resolve, reject)
      .finally(() => {
        active--;
        next();
      });
  };
  return (thunk) =>
    new Promise((resolve, reject) => {
      queue.push({ thunk, resolve, reject });
      next();
    });
}

module.exports = { pLimit };
