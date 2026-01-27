// Popup script for settings

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const saveBtn = document.getElementById('save-btn');
  const statusEl = document.getElementById('status');

  // Load saved API key
  const { apiKey = '' } = await chrome.storage.local.get('apiKey');
  if (apiKey) {
    apiKeyInput.value = apiKey;
  }

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

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }
});
