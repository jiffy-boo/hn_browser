// Popup script for settings

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const saveBtn = document.getElementById('save-btn');
  const statusEl = document.getElementById('status');
  const resetUsageBtn = document.getElementById('reset-usage-btn');

  // Load saved API key
  const { apiKey = '' } = await chrome.storage.local.get('apiKey');
  if (apiKey) {
    apiKeyInput.value = apiKey;
  }

  // Load and display cost usage data
  await loadCostUsage();

  // Save API key
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    // Basic validation for Claude API key format
    if (!apiKey.startsWith('sk-ant-')) {
      showStatus('Invalid API key format. Claude API keys start with "sk-ant-"', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({ apiKey });
      showStatus('Settings saved successfully!', 'success');

      // Auto-hide after 2 seconds
      setTimeout(() => {
        statusEl.classList.add('hidden');
      }, 2000);
    } catch (error) {
      showStatus('Failed to save settings', 'error');
    }
  });

  // Reset usage data
  resetUsageBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset all usage data? This cannot be undone.')) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({ action: 'resetCostUsage' });
      await loadCostUsage();
      showStatus('Usage data reset successfully!', 'success');

      setTimeout(() => {
        statusEl.classList.add('hidden');
      }, 2000);
    } catch (error) {
      showStatus('Failed to reset usage data', 'error');
    }
  });

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  async function loadCostUsage() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCostUsage' });

      // Update UI with cost data
      document.getElementById('total-cost').textContent = formatCost(response.totalCost);
      document.getElementById('total-requests').textContent = response.requestCount;
      document.getElementById('total-tokens').textContent = formatTokens(response.totalTokens);
      document.getElementById('avg-cost').textContent = formatCost(response.avgCostPerRequest);
    } catch (error) {
      console.error('Failed to load cost usage:', error);
      // Set default values
      document.getElementById('total-cost').textContent = '$0.00';
      document.getElementById('total-requests').textContent = '0';
      document.getElementById('total-tokens').textContent = '0';
      document.getElementById('avg-cost').textContent = '$0.00';
    }
  }

  function formatCost(cost) {
    if (!cost || cost === 0) return '$0.00';
    if (cost < 0.01) {
      return `$${cost.toFixed(4)}`;
    }
    return `$${cost.toFixed(2)}`;
  }

  function formatTokens(tokens) {
    if (!tokens || tokens === 0) return '0';
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return tokens.toString();
  }
});
