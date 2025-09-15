const { logWarn } = require('./logger');

class TokenBucket {
  constructor(tokensPerInterval, interval, maxBurst = null) {
    this.tokensPerInterval = tokensPerInterval;
    this.interval = interval;
    this.maxBurst = maxBurst || tokensPerInterval;
    this.tokens = this.maxBurst;
    this.lastFill = Date.now();
  }

  fillBucket() {
    const now = Date.now();
    const elapsed = (now - this.lastFill) / 1000;
    this.tokens = Math.min(
      this.maxBurst,
      this.tokens + (elapsed * this.tokensPerInterval / (this.interval / 1000))
    );
    this.lastFill = now;
  }

  tryTake() {
    this.fillBucket();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  getWaitTime() {
    this.fillBucket();
    if (this.tokens >= 1) return 0;
    const tokensNeeded = 1 - this.tokens;
    return (tokensNeeded * this.interval) / this.tokensPerInterval;
  }
}

class DomainRateLimiter {
  constructor(options = {}) {
    this.options = {
      requestsPerSecond: options.requestsPerSecond || 2,
      burstSize: options.burstSize || 5,
      minDelayMs: options.minDelayMs || 500,
      maxDelayMs: options.maxDelayMs || 10000,
      ...options
    };
    this.limiters = new Map();
    this.lastRequestTime = new Map();
  }

  getLimiter(domain) {
    if (!this.limiters.has(domain)) {
      this.limiters.set(domain, new TokenBucket(
        this.options.requestsPerSecond,
        1000,
        this.options.burstSize
      ));
    }
    return this.limiters.get(domain);
  }

  async waitForRateLimit(domain) {
    const limiter = this.getLimiter(domain);
    const lastRequest = this.lastRequestTime.get(domain) || 0;
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequest;
    if (timeSinceLastRequest < this.options.minDelayMs) {
      await this.delay(this.options.minDelayMs - timeSinceLastRequest);
    }
    while (!limiter.tryTake()) {
      const waitTime = Math.min(
        limiter.getWaitTime(),
        this.options.maxDelayMs
      );
      logWarn(`Rate limit hit for ${domain}, waiting ${waitTime}ms`);
      await this.delay(waitTime);
    }
    this.lastRequestTime.set(domain, Date.now());
  }

  clearDomain(domain) {
    this.limiters.delete(domain);
    this.lastRequestTime.delete(domain);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const globalRateLimiter = new DomainRateLimiter();

async function rateLimitedFetch(url, options = {}) {
  try {
    const domain = new URL(url).hostname;
    await globalRateLimiter.waitForRateLimit(domain);
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    throw error;
  }
}

async function withRateLimit(domain, callback) {
  await globalRateLimiter.waitForRateLimit(domain);
  return await callback();
}

module.exports = {
  TokenBucket,
  DomainRateLimiter,
  globalRateLimiter,
  rateLimitedFetch,
  withRateLimit
};
