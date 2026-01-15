document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEYS = {
    AUTO_LOGIN: 'scf_auto_login',
    FOCUS_MODE: 'scf_focus_mode'
  };

  const autoLoginToggle = document.getElementById('autoLogin');
  const focusModeToggle = document.getElementById('focusMode');
  const openExtensionsLink = document.getElementById('openExtensions');

  // Load saved settings
  chrome.storage.local.get([STORAGE_KEYS.AUTO_LOGIN, STORAGE_KEYS.FOCUS_MODE], (result) => {
    autoLoginToggle.checked = result[STORAGE_KEYS.AUTO_LOGIN] || false;
    focusModeToggle.checked = result[STORAGE_KEYS.FOCUS_MODE] || false;
  });

  // Save settings on change
  autoLoginToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ [STORAGE_KEYS.AUTO_LOGIN]: e.target.checked });
  });

  focusModeToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ [STORAGE_KEYS.FOCUS_MODE]: e.target.checked });
  });

  // Open extensions page
  openExtensionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions' });
  });
});
