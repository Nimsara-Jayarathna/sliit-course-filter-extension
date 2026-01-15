document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEYS = {
    AUTO_LOGIN: 'scf_auto_login',
    FOCUS_MODE: 'scf_focus_mode',
    EXTENSION_ENABLED: 'scf_extension_enabled',
    HIDE_SERVICE: 'scf_hide_service_modules'
  };

  const extensionEnabledToggle = document.getElementById('extensionEnabled');
  const autoLoginToggle = document.getElementById('autoLogin');
  const focusModeToggle = document.getElementById('focusMode');
  const hideServiceToggle = document.getElementById('hideService');
  const openExtensionsLink = document.getElementById('openExtensions');

  const updateUIState = (isEnabled) => {
    if (isEnabled) {
      document.body.classList.remove('disabled');
    } else {
      document.body.classList.add('disabled');
    }
  };

  // Load saved settings
  chrome.storage.local.get([STORAGE_KEYS.AUTO_LOGIN, STORAGE_KEYS.FOCUS_MODE, STORAGE_KEYS.EXTENSION_ENABLED, STORAGE_KEYS.HIDE_SERVICE], (result) => {
    // Default enabled to true if undefined
    const isEnabled = result[STORAGE_KEYS.EXTENSION_ENABLED] !== false;
    extensionEnabledToggle.checked = isEnabled;
    autoLoginToggle.checked = result[STORAGE_KEYS.AUTO_LOGIN] || false;
    focusModeToggle.checked = result[STORAGE_KEYS.FOCUS_MODE] || false;
    hideServiceToggle.checked = result[STORAGE_KEYS.HIDE_SERVICE] || false;
    updateUIState(isEnabled);
  });

  // Save settings on change
  extensionEnabledToggle.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.local.set({ [STORAGE_KEYS.EXTENSION_ENABLED]: isEnabled });
    updateUIState(isEnabled);
  });

  autoLoginToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ [STORAGE_KEYS.AUTO_LOGIN]: e.target.checked });
  });

  focusModeToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ [STORAGE_KEYS.FOCUS_MODE]: e.target.checked });
  });

  hideServiceToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ [STORAGE_KEYS.HIDE_SERVICE]: e.target.checked });
  });

  // Open extensions page
  openExtensionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'chrome://extensions' });
  });
});
