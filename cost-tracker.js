// Cost Tracker for Claude API Usage
// Tracks token usage and calculates costs client-side

// Pricing rates per million tokens (as of January 2025)
// Source: https://docs.anthropic.com/en/api/pricing
const PRICING = {
  'claude-haiku-4-5-20251001': {
    name: 'Claude 4.5 Haiku',
    input: 1.00,           // $1.00 per million tokens
    output: 5.00,          // $5.00 per million tokens
    cacheWrite: 1.25,      // $1.25 per million tokens (cache creation)
    cacheRead: 0.10        // $0.10 per million tokens (cache read)
  }
};

class CostTracker {
  constructor() {
    this.currentModel = 'claude-haiku-4-5-20251001';
  }

  /**
   * Calculate cost from usage data returned by Claude API
   * @param {Object} usage - Usage object from Claude API response
   * @param {number} usage.input_tokens - Number of input tokens
   * @param {number} usage.output_tokens - Number of output tokens
   * @param {number} usage.cache_creation_input_tokens - Tokens written to cache
   * @param {number} usage.cache_read_input_tokens - Tokens read from cache
   * @returns {Object} Cost breakdown and total
   */
  calculateCost(usage) {
    if (!usage) {
      console.error('[Cost Tracker] No usage data provided');
      return null;
    }

    const pricing = PRICING[this.currentModel];
    if (!pricing) {
      console.error('[Cost Tracker] Unknown model:', this.currentModel);
      return null;
    }

    // Extract token counts (default to 0 if not present)
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;

    // Calculate costs (divide by 1,000,000 since pricing is per million tokens)
    const inputCost = (inputTokens * pricing.input) / 1_000_000;
    const outputCost = (outputTokens * pricing.output) / 1_000_000;
    const cacheWriteCost = (cacheWriteTokens * pricing.cacheWrite) / 1_000_000;
    const cacheReadCost = (cacheReadTokens * pricing.cacheRead) / 1_000_000;

    const totalCost = inputCost + outputCost + cacheWriteCost + cacheReadCost;

    return {
      model: this.currentModel,
      modelName: pricing.name,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        cacheWrite: cacheWriteTokens,
        cacheRead: cacheReadTokens,
        total: inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens
      },
      costs: {
        input: inputCost,
        output: outputCost,
        cacheWrite: cacheWriteCost,
        cacheRead: cacheReadCost,
        total: totalCost
      },
      timestamp: Date.now()
    };
  }

  /**
   * Track a new API request and update stored usage data
   * @param {Object} usage - Usage object from Claude API response
   * @param {string} requestType - Type of request (e.g., 'summary', 'discussion', 'article')
   * @param {string} storyId - Story ID for context
   */
  async trackRequest(usage, requestType = 'unknown', storyId = null) {
    const costData = this.calculateCost(usage);
    if (!costData) return;

    // Get API key to track costs per key
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
      console.warn('[Cost Tracker] No API key found');
      return;
    }

    // Create a hash of the API key for storage (don't store full key)
    const keyHash = await this.hashApiKey(apiKey);

    // Get existing usage data
    const { costTracking = {} } = await chrome.storage.local.get('costTracking');

    // Initialize tracking for this API key if needed
    if (!costTracking[keyHash]) {
      costTracking[keyHash] = {
        totalCost: 0,
        totalTokens: 0,
        requests: [],
        firstRequest: Date.now(),
        lastRequest: Date.now()
      };
    }

    // Update totals
    costTracking[keyHash].totalCost += costData.costs.total;
    costTracking[keyHash].totalTokens += costData.tokens.total;
    costTracking[keyHash].lastRequest = Date.now();

    // Add individual request record
    const requestRecord = {
      ...costData,
      requestType,
      storyId
    };

    costTracking[keyHash].requests.push(requestRecord);

    // Keep only last 100 requests to avoid storage bloat
    if (costTracking[keyHash].requests.length > 100) {
      costTracking[keyHash].requests = costTracking[keyHash].requests.slice(-100);
    }

    // Save to storage
    await chrome.storage.local.set({ costTracking });

    // Log for debugging
    console.log(`[Cost Tracker] Request tracked: $${costData.costs.total.toFixed(4)} | Type: ${requestType} | Tokens: ${costData.tokens.total}`);

    return costData;
  }

  /**
   * Get current usage statistics for the active API key
   * @returns {Object} Usage statistics
   */
  async getCurrentUsage() {
    const { apiKey, costTracking = {} } = await chrome.storage.local.get(['apiKey', 'costTracking']);

    if (!apiKey) {
      return {
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        avgCostPerRequest: 0
      };
    }

    const keyHash = await this.hashApiKey(apiKey);
    const usage = costTracking[keyHash];

    if (!usage) {
      return {
        totalCost: 0,
        totalTokens: 0,
        requestCount: 0,
        avgCostPerRequest: 0
      };
    }

    return {
      totalCost: usage.totalCost,
      totalTokens: usage.totalTokens,
      requestCount: usage.requests.length,
      avgCostPerRequest: usage.requests.length > 0 ? usage.totalCost / usage.requests.length : 0,
      firstRequest: usage.firstRequest,
      lastRequest: usage.lastRequest,
      recentRequests: usage.requests.slice(-10) // Last 10 requests
    };
  }

  /**
   * Reset usage data for current API key
   */
  async resetUsage() {
    const { apiKey, costTracking = {} } = await chrome.storage.local.get(['apiKey', 'costTracking']);

    if (!apiKey) return;

    const keyHash = await this.hashApiKey(apiKey);
    delete costTracking[keyHash];

    await chrome.storage.local.set({ costTracking });
    console.log('[Cost Tracker] Usage data reset');
  }

  /**
   * Create a hash of the API key for storage (privacy)
   * @param {string} apiKey - The API key
   * @returns {string} Hash of the API key
   */
  async hashApiKey(apiKey) {
    // Simple hash for demo - in production, use crypto.subtle.digest
    // Taking last 8 chars + length as a simple identifier
    return `key_${apiKey.length}_${apiKey.slice(-8)}`;
  }

  /**
   * Format cost for display
   * @param {number} cost - Cost in dollars
   * @returns {string} Formatted cost string
   */
  formatCost(cost) {
    if (cost < 0.01) {
      return `$${cost.toFixed(4)}`;
    }
    return `$${cost.toFixed(2)}`;
  }

  /**
   * Format token count for display
   * @param {number} tokens - Number of tokens
   * @returns {string} Formatted token string
   */
  formatTokens(tokens) {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  }

  /**
   * Get pricing information for current model
   * @returns {Object} Pricing information
   */
  getPricing() {
    return PRICING[this.currentModel];
  }
}

// Create singleton instance
const costTracker = new CostTracker();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CostTracker, costTracker, PRICING };
}
