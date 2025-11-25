// ==UserScript==
// @name         StashSeer
// @namespace    http://tampermonkey.net/
// @version      0.3.1
// @description  Integration between StashDB, Whisparr, and Stash - adds download/monitor/play buttons to StashDB scene pages
// @author       AI Guided
// @match        https://stashdb.org/
// @match        https://stashdb.org/*
// @icon         https://raw.githubusercontent.com/stashapp/StashDB-Docs/refs/heads/main/favicon.ico
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

// Configuration - Uses Tampermonkey storage API
// First time setup: Click the Settings button to configure your API keys
// Values persist across browser sessions

/** Get configuration from Tampermonkey storage. */
function getConfig() {
  // Support multiple root folders (array), with backward compatibility
  let whisparrRootFolders = GM_getValue('whisparrRootFolders', null);
  if (!whisparrRootFolders) {
    // Migrate from old single folder setting
    const oldPath = GM_getValue('whisparrRootFolderPath', '/data/');
    whisparrRootFolders = oldPath ? [oldPath] : [];
  }
  
  return {
    whisparrBaseUrl: GM_getValue('whisparrBaseUrl', 'http://localhost:6969'),
    whisparrApiKey: GM_getValue('whisparrApiKey', ''),
    whisparrRootFolders: whisparrRootFolders, // Array of root folder paths
    localStashRootUrl: GM_getValue('localStashRootUrl', 'http://localhost:9999'),
    stashApiKey: GM_getValue('stashApiKey', ''),
    cfAccessClientId: GM_getValue('cfAccessClientId', ''),
    cfAccessClientSecret: GM_getValue('cfAccessClientSecret', ''),
    whisparrNeedsCloudflare: GM_getValue('whisparrNeedsCloudflare', false),
    stashNeedsCloudflare: GM_getValue('stashNeedsCloudflare', false),
  };
}

/** Save configuration to Tampermonkey storage. */
function setConfig(config) {
  GM_setValue('whisparrBaseUrl', config.whisparrBaseUrl);
  GM_setValue('whisparrApiKey', config.whisparrApiKey);
  // Save as array - ensure it's always an array
  const rootFolders = Array.isArray(config.whisparrRootFolders) 
    ? config.whisparrRootFolders 
    : (config.whisparrRootFolders ? [config.whisparrRootFolders] : []);
  GM_setValue('whisparrRootFolders', rootFolders);
  // Keep old key for backward compatibility but prefer new array
  GM_setValue('localStashRootUrl', config.localStashRootUrl);
  GM_setValue('stashApiKey', config.stashApiKey);
  GM_setValue('cfAccessClientId', config.cfAccessClientId);
  GM_setValue('cfAccessClientSecret', config.cfAccessClientSecret);
  GM_setValue('whisparrNeedsCloudflare', config.whisparrNeedsCloudflare || false);
  GM_setValue('stashNeedsCloudflare', config.stashNeedsCloudflare || false);
}

// Constants
const POLLING_INTERVAL_MS = 50;
const SEARCH_TRIGGER_DELAY_MS = 500;
const DEFAULT_QUALITY_PROFILE_ID = 1;
const MAX_ELEMENT_WAIT_MS = 10000; // 10 seconds max wait for DOM elements
const QUEUE_POLL_INTERVAL_MS = 3000; // Poll Whisparr queue
const STASHDB_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Error handler is defined later inside the IIFE to access `icons`

// Input validation utilities
const Validator = {
  /** Validate StashDB UUID format. */
  isValidStashId(stashId) {
    return stashId && typeof stashId === 'string' && STASHDB_UUID_REGEX.test(stashId);
  },

  /** Validate Stash GraphQL response (findScenes). */
  isValidStashResponse(response) {
    return response && 
           response.data && 
           response.data.findScenes && 
           Array.isArray(response.data.findScenes.scenes);
  },

  /** Validate Whisparr queue item. */
  isValidQueueItem(item) {
    return item && 
           typeof item === 'object' && 
           typeof item.movieId === 'number';
  },
};

// Helper to get fresh config (used dynamically instead of caching)
function getFreshConfig() {
  return getConfig();
}

(async function () {
  'use strict';

GM_addStyle(`
body {
  min-width: unset;
}
.navbar, .navbar-nav {
  flex-wrap: wrap;
  flex-grow: 1;
}
.navbar > .navbar-nav:last-child {
  justify-content: end;
}
.SearchField {
  max-width: 400px;
  width: 100%;
}

/* Whisparr Download Button Styles */
.downloadInWhisparr {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-left: 0;
}

.downloadInWhisparr button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
  min-width: auto;
  height: 2.25em;
  padding: 0.4em 0.75em;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.25rem;
  background: rgba(33, 37, 41, 0.6);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
  backdrop-filter: blur(8px);
  white-space: nowrap;
}

.downloadInWhisparr button:hover {
  background: rgba(52, 58, 64, 0.8);
  border-color: rgba(255, 255, 255, 0.2);
}

.downloadInWhisparr button:active {
  transform: scale(0.98);
}

.downloadInWhisparr button svg {
  width: 1em;
  height: 1em;
  fill: currentColor;
}

/* Specific button states */
.downloadInWhisparr button.btn-download {
  background: rgba(13, 110, 253, 0.15);
  border-color: rgba(13, 110, 253, 0.3);
  color: #4d9fff;
}

.downloadInWhisparr button.btn-download:hover {
  background: rgba(13, 110, 253, 0.25);
  border-color: rgba(13, 110, 253, 0.5);
}

.downloadInWhisparr button.btn-play {
  background: rgba(25, 135, 84, 0.15);
  border-color: rgba(25, 135, 84, 0.3);
  color: #5cd88c;
}

.downloadInWhisparr button.btn-play:hover {
  background: rgba(25, 135, 84, 0.25);
  border-color: rgba(25, 135, 84, 0.5);
}

.downloadInWhisparr button.btn-monitor {
  background: rgba(108, 117, 125, 0.15);
  border-color: rgba(108, 117, 125, 0.3);
  color: #adb5bd;
}

.downloadInWhisparr button.btn-monitor:hover {
  background: rgba(108, 117, 125, 0.25);
  border-color: rgba(108, 117, 125, 0.5);
}

.downloadInWhisparr button.btn-error {
  background: rgba(220, 53, 69, 0.15);
  border-color: rgba(220, 53, 69, 0.3);
  color: #ff6b7a;
  cursor: not-allowed;
}

.downloadInWhisparr button.btn-loading {
  opacity: 0.7;
  pointer-events: none;
}

.downloadInWhisparr button.btn-loading svg {
  animation: spin 1s linear infinite;
}

.downloadInWhisparr button.btn-whisparr {
  background: rgba(156, 39, 176, 0.15);
  border-color: rgba(156, 39, 176, 0.3);
  color: #ce93d8;
}

.downloadInWhisparr button.btn-whisparr:hover {
  background: rgba(156, 39, 176, 0.25);
  border-color: rgba(156, 39, 176, 0.5);
}

.downloadInWhisparr button.btn-stash {
  background: rgba(139, 90, 43, 0.15);
  border-color: rgba(139, 90, 43, 0.3);
  color: #d4a574;
}

.downloadInWhisparr button.btn-stash:hover {
  background: rgba(139, 90, 43, 0.25);
  border-color: rgba(139, 90, 43, 0.5);
}

.downloadInWhisparr button.btn-settings {
  background: rgba(108, 117, 125, 0.15);
  border-color: rgba(108, 117, 125, 0.3);
  color: #adb5bd;
}

.downloadInWhisparr button.btn-settings:hover {
  background: rgba(108, 117, 125, 0.25);
  border-color: rgba(108, 117, 125, 0.5);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.downloadInWhisparr span {
  font-size: 0.875em;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.4;
}

.downloadInWhisparr span a {
  color: #4d9fff;
  text-decoration: none;
  transition: color 0.15s ease;
}

.downloadInWhisparr span a:hover {
  color: #80b3ff;
  text-decoration: underline;
}

`);

  // SVG Icons
  const icons = {
    download: `<svg viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`,
    play: `<svg viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>`,
    loading: `<svg viewBox="0 0 16 16"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/></svg>`,
    monitor: `<svg viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>`,
    monitorOff: `<svg viewBox="0 0 16 16"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/></svg>`,
    deleted: `<svg viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M11.854 4.146a.5.5 0 0 0-.708 0l-3 3a.5.5 0 0 0 0 .708l3 3a.5.5 0 0 0 .708-.708l-2.146-2.146 2.146-2.146a.5.5 0 0 0 0-.708zm-4.708 0a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L7.707 7.854 4.854 5a.5.5 0 0 1 0-.708z"/></svg>`,
    error: `<svg viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>`,
    whisparr: `<svg viewBox="0 0 16 16"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"/><path d="M8 4a.5.5 0 0 1 .5.5V6a.5.5 0 0 1-1 0V4.5A.5.5 0 0 1 8 4zM3.732 5.732a.5.5 0 0 1 .707 0l.915.914a.5.5 0 1 1-.708.708l-.914-.915a.5.5 0 0 1 0-.707zM2 10a.5.5 0 0 1 .5-.5h1.586a.5.5 0 0 1 0 1H2.5A.5.5 0 0 1 2 10zm9.5 0a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 0 1H12a.5.5 0 0 1-.5-.5zm.754-4.246a.389.389 0 0 0-.527-.02L7.547 9.31a.91.91 0 1 0 1.302 1.258l3.434-4.297a.389.389 0 0 0-.029-.518z"/></svg>`,
    stash: `<svg viewBox="0 0 16 16"><path d="M0 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm8 1a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm2 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0z"/></svg>`,
    settings: `<svg viewBox="0 0 16 16"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/></svg>`,
  };

  // Error handling utilities (placed here to access `icons` in scope)
  const ErrorHandler = {
    /** Log errors with consistent formatting. */
    logError(context, error, userMessage = null) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] ${context}:`, error);
      if (userMessage) {
        console.error(`User message: ${userMessage}`);
      }
    },

    /** Handle API errors and update UI status. */
    handleApiError(operation, error, updateStatus) {
      this.logError(`API Error in ${operation}`, error);
      let userMessage = `Error during ${operation}`;
      if (error && error.statusCode) {
        userMessage += ` (HTTP ${error.statusCode})`;
      }
      updateStatus({
        button: `${icons.error}<span>Error</span>`,
        className: 'btn-error',
        extra: userMessage,
      });
    }
  };

  /** Escape HTML to prevent XSS. */
  function escapeHtml(text) {
    if (typeof text !== 'string') {
      return '';
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /** Build a concise user-facing error string for connection tests. */
  function formatUserError(error) {
    if (!error) return 'Unknown error';
    const parts = [];
    if (error.statusCode) parts.push(`HTTP ${error.statusCode}`);
    if (error.message) parts.push(error.message.replace(/^Error:\s*/, ''));
    if (error.resBody && typeof error.resBody === 'object') {
      const msg = error.resBody.message || error.resBody.error || error.resBody.reason;
      if (msg) parts.push(String(msg));
    }
    return parts.filter(Boolean).join(' - ') || 'Unknown error';
  }

  /** Test connection to Whisparr and optionally fetch root folders. */
  async function testWhisparrConnectionAndFolders(config = null) {
    // Try fetching root folders; this also validates API key and URL
    const folders = await fetchWhisparr('/rootfolder', {
      retryAttempts: 1,
      retryOnStatus: [429, 500, 502, 503, 504],
    }, config);
    if (!Array.isArray(folders)) {
      throw new Error('Unexpected response for root folders');
    }
    return folders.map((f) => ({ id: f.id, path: f.path }));
  }

  /** Test connection to local Stash using a minimal GraphQL query.
   * Some GraphQL servers return HTTP 400 for schema errors but still indicate reachability.
   * We accept 400 when the payload looks like a GraphQL error response.
   */
  async function testStashConnection(config = null) {
    try {
      const res = await localStashGraphQl({
        variables: {},
        query: `query { __typename }`,
      }, config);
      if (!res || typeof res !== 'object') {
        throw new Error('Invalid GraphQL response');
      }
      return true;
    } catch (err) {
      // Treat HTTP 400 with GraphQL error payload as reachable (auth/URL likely fine)
      if (err && err.statusCode === 400 && err.resBody && (Array.isArray(err.resBody.errors) || typeof err.resBody.data !== 'undefined')) {
        return true;
      }
      throw err;
    }
  }

  /**
   * Shows a dialog to select a root folder when multiple are configured
   * @param {Array<string>} folders - Array of root folder paths
   * @returns {Promise<string|null>} Selected folder path or null if cancelled
   */
  async function showRootFolderSelectionDialog(folders) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: #2d3748;
        padding: 2rem;
        border-radius: 0.5rem;
        max-width: 500px;
        width: 90%;
        color: white;
      `;

      content.innerHTML = `
        <h3 style="margin-top: 0; color: #4d9fff;">Select Root Folder</h3>
        <p style="color: #cbd5e0; margin-bottom: 1rem;">Please select which root folder to use for this scene:</p>
        <div id="folderList" style="margin-bottom: 1.5rem;"></div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
          <button type="button" id="cancelFolderBtn" style="padding: 0.5rem 1rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #4a5568; color: white; cursor: pointer;">Cancel</button>
          <button type="button" id="confirmFolderBtn" disabled style="padding: 0.5rem 1rem; border: 1px solid #4d9fff; border-radius: 0.25rem; background: #4d9fff; color: white; cursor: pointer; opacity: 0.5;">Select</button>
        </div>
      `;

      dialog.appendChild(content);
      document.body.appendChild(dialog);

      const folderList = content.querySelector('#folderList');
      const cancelBtn = content.querySelector('#cancelFolderBtn');
      const confirmBtn = content.querySelector('#confirmFolderBtn');
      let selectedFolder = null;

      // Create radio buttons for each folder
      folders.forEach((folder, index) => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; cursor: pointer; margin: 0.5rem 0; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; transition: all 0.2s;';
        label.style.color = 'white';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'rootFolder';
        radio.value = folder;
        radio.style.cssText = 'width: 1.25rem; height: 1.25rem; cursor: pointer;';
        if (index === 0) {
          radio.checked = true;
          selectedFolder = folder;
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = '1';
        }
        
        radio.addEventListener('change', () => {
          if (radio.checked) {
            selectedFolder = folder;
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            // Update visual selection
            folderList.querySelectorAll('label').forEach(l => {
              l.style.borderColor = '#4a5568';
              l.style.background = '#1a202c';
            });
            label.style.borderColor = '#4d9fff';
            label.style.background = '#2c5282';
          }
        });
        
        const span = document.createElement('span');
        span.textContent = folder;
        
        label.appendChild(radio);
        label.appendChild(span);
        folderList.appendChild(label);
        
        // Set initial selection styling
        if (index === 0) {
          label.style.borderColor = '#4d9fff';
          label.style.background = '#2c5282';
        }
      });

      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(dialog);
        resolve(null);
      });

      confirmBtn.addEventListener('click', () => {
        document.body.removeChild(dialog);
        resolve(selectedFolder);
      });

      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          document.body.removeChild(dialog);
          resolve(null);
        }
      });
    });
  }

  /**
   * Gets the root folder to use, automatically selecting if single, prompting if multiple
   * @returns {Promise<string|null>} Selected root folder path or null if cancelled/error
   */
  async function getRootFolderPath() {
    const currentConfig = getConfig();
    const folders = currentConfig.whisparrRootFolders || [];
    
    if (folders.length === 0) {
      ErrorHandler.logError('Root folder selection', new Error('No root folders configured'));
      return null;
    }
    
    if (folders.length === 1) {
      // Single folder - use it automatically
      return folders[0];
    }
    
    // Multiple folders - prompt user to select
    return await showRootFolderSelectionDialog(folders);
  }

  /** Create Whisparr/Stash control buttons and status updater. */
  function createButton() {
    const containerElm = document.createElement('div');
    const dlButtonElm = document.createElement('button');
    const whisparrButtonElm = document.createElement('button');
    const stashButtonElm = document.createElement('button');
    const settingsButtonElm = document.createElement('button');
    const statusElm = document.createElement('span');
    containerElm.classList.add('downloadInWhisparr');
    dlButtonElm.innerHTML = `${icons.loading}<span>Loading...</span>`;
    dlButtonElm.classList.add('btn-loading');

    // Add Whisparr button
    whisparrButtonElm.innerHTML = `${icons.whisparr}<span>Whisparr</span>`;
    whisparrButtonElm.classList.add('btn-whisparr');
    whisparrButtonElm.addEventListener('click', () => {
      openInNewTab(whisparrBaseUrl);
    });

    // Add Stash button
    stashButtonElm.innerHTML = `${icons.stash}<span>Stash</span>`;
    stashButtonElm.classList.add('btn-stash');
    stashButtonElm.addEventListener('click', () => {
      openInNewTab(localStashRootUrl);
    });

    // Add Settings button
    settingsButtonElm.innerHTML = `${icons.settings}<span>Settings</span>`;
    settingsButtonElm.classList.add('btn-settings');
    settingsButtonElm.addEventListener('click', () => {
      showSettingsDialog();
    });

    let lastOnClickValue;

    function setControlledHtml(element, html) {
      if (typeof html !== 'string') {
        element.textContent = '';
        return;
      }
      const temp = document.createElement('div');
      temp.innerHTML = html;
      // allow only <a> tags; strip others
      const allNodes = Array.from(temp.querySelectorAll('*'));
      for (const node of allNodes) {
        if (node.tagName.toLowerCase() !== 'a') {
          const text = node.textContent || '';
          node.replaceWith(document.createTextNode(text));
        }
      }
      const links = temp.querySelectorAll('a');
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href)) {
          const text = a.textContent || '';
          a.replaceWith(document.createTextNode(text));
        } else {
          a.rel = 'noopener noreferrer';
          a.target = '_blank';
        }
      }
      element.innerHTML = temp.innerHTML;
    }

    function updateStatus(newStatus) {
      if (typeof newStatus === 'string') {
        statusElm.innerHTML = escapeHtml(newStatus);
      } else {
        if (typeof newStatus.button !== 'undefined') {
          dlButtonElm.innerHTML = newStatus.button;
        }
        if (typeof newStatus.className !== 'undefined') {
          dlButtonElm.className = newStatus.className;
        }
        if (typeof newStatus.extra !== 'undefined') {
          // Controlled HTML with allowlist sanitizer
          setControlledHtml(statusElm, newStatus.extra);
        }
        if (typeof newStatus.onClick !== 'undefined') {
          if (lastOnClickValue) {
            dlButtonElm.removeEventListener('click', lastOnClickValue);
          }
          dlButtonElm.addEventListener('click', newStatus.onClick);
          lastOnClickValue = newStatus.onClick;
        }
      }
    }

    updateStatus('Loading...');
    containerElm.appendChild(dlButtonElm);
    containerElm.appendChild(whisparrButtonElm);
    containerElm.appendChild(stashButtonElm);
    containerElm.appendChild(settingsButtonElm);
    containerElm.appendChild(statusElm);
    return { downloadElm: containerElm, updateStatus };
  }

  /** Show the settings dialog for API keys and URLs. */
  function showSettingsDialog() {
    const currentConfig = getConfig();

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: #2d3748;
      padding: 2rem;
      border-radius: 0.5rem;
      max-width: 500px;
      width: 90%;
      color: white;
    `;

    // Use escapeHtml to prevent XSS
    content.innerHTML = `
      <h3 style="margin-top: 0; color: #4d9fff;">Stasharr Settings</h3>
      <form id="settingsForm">
        <div style="margin-bottom: 1rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Whisparr Base URL:</label>
          <input type="text" name="whisparrBaseUrl" value="${escapeHtml(currentConfig.whisparrBaseUrl)}" 
                 style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <label style="font-weight: 500;">Whisparr API Key:</label>
            <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500; font-size: 0.875rem;">
              <input type="checkbox" name="whisparrNeedsCloudflare" ${currentConfig.whisparrNeedsCloudflare ? 'checked' : ''} 
                     style="width: 1.25rem; height: 1.25rem; cursor: pointer;">
              Cloudflare Enabled
            </label>
          </div>
          <input type="password" name="whisparrApiKey" value="${escapeHtml(currentConfig.whisparrApiKey)}" 
                 style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
        </div>
        <!-- Root folder text input removed; selection will be provided after Test Connections -->
        <div style="margin-bottom: 1rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Stash Root URL:</label>
          <input type="text" name="localStashRootUrl" value="${escapeHtml(currentConfig.localStashRootUrl)}" 
                 style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
        </div>
        <div style="margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <label style="font-weight: 500;">Stash API Key:</label>
            <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500; font-size: 0.875rem;">
              <input type="checkbox" name="stashNeedsCloudflare" ${currentConfig.stashNeedsCloudflare ? 'checked' : ''} 
                     style="width: 1.25rem; height: 1.25rem; cursor: pointer;">
              Cloudflare Enabled
            </label>
          </div>
          <input type="password" name="stashApiKey" value="${escapeHtml(currentConfig.stashApiKey)}" 
                 style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
        </div>
        <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #4a5568;">
          <h4 style="margin: 0 0 0.5rem 0; color: #9f7aea; font-size: 0.875rem;">Cloudflare Zero Trust (Optional)</h4>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">CF-Access-Client-Id:</label>
            <input type="password" name="cfAccessClientId" value="${escapeHtml(currentConfig.cfAccessClientId)}" 
                   style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">CF-Access-Client-Secret:</label>
            <input type="password" name="cfAccessClientSecret" value="${escapeHtml(currentConfig.cfAccessClientSecret)}" 
                   style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
          </div>
        </div>
        <div id="testResults" style="margin-bottom: 1rem; color: #cbd5e0; font-size: 0.9rem;"></div>
        <div id="rootFolderSelectRow" style="display: none; margin-bottom: 1rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Select Whisparr root folder(s):</label>
          <div id="rootFolderCheckboxes" style="max-height: 200px; overflow-y: auto; border: 1px solid #4a5568; border-radius: 0.25rem; padding: 0.5rem; background: #1a202c;"></div>
          <div style="margin-top: 0.5rem; font-size: 0.875rem; color: #cbd5e0;">You can select multiple folders. When adding scenes, you'll be prompted to choose one if multiple are configured.</div>
        </div>
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
          <button type="button" id="cancelBtn" style="padding: 0.5rem 1rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #4a5568; color: white; cursor: pointer;">Cancel</button>
          <button type="button" id="testBtn" style="padding: 0.5rem 1rem; border: 1px solid #4d9fff; border-radius: 0.25rem; background: #4d9fff; color: white; cursor: pointer;">Test Connections</button>
          <span id="testSpinner" style="align-self:center; margin-left: 0.25rem; display: none; opacity: 0.9; color: #cbd5e0;">Testing...</span>
          <button type="submit" id="saveBtn" style="display:none; padding: 0.5rem 1rem; border: 1px solid #4d9fff; border-radius: 0.25rem; background: #4d9fff; color: white; cursor: pointer;">Save</button>
        </div>
      </form>
    `;

    dialog.appendChild(content);
    document.body.appendChild(dialog);

    const form = content.querySelector('#settingsForm');
    const cancelBtn = content.querySelector('#cancelBtn');
    const saveBtn = content.querySelector('#saveBtn');
    const testBtn = content.querySelector('#testBtn');
    const testSpinner = content.querySelector('#testSpinner');
    const testResults = content.querySelector('#testResults');
    const rootFolderSelectRow = content.querySelector('#rootFolderSelectRow');
    const rootFolderCheckboxes = content.querySelector('#rootFolderCheckboxes');
    const setSaveVisibility = (visible) => {
      if (!saveBtn) return;
      saveBtn.style.display = visible ? 'inline-block' : 'none';
    };
    const setSaveEnabled = (enabled) => {
      if (!saveBtn) return;
      saveBtn.disabled = !enabled;
      saveBtn.style.opacity = enabled ? '1' : '0.6';
      saveBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    };
    // Hide Save until test runs successfully
    setSaveVisibility(false);

    // Handle Test Connections
    testBtn?.addEventListener('click', async () => {
      testResults.innerHTML = '';
      testSpinner.style.display = 'inline-block';
      testBtn.disabled = true;
      setSaveVisibility(false);
      setSaveEnabled(false);
      const addLine = (ok, label, message = '') => {
        const icon = ok ? '✔️' : '❌';
        const color = ok ? '#9ae6b4' : '#feb2b2';
        const extra = message ? ` - ${escapeHtml(message)}` : '';
        const line = document.createElement('div');
        line.style.margin = '0.25rem 0';
        line.innerHTML = `<span style="color:${color}">${icon}</span> <strong>${escapeHtml(label)}</strong>${extra}`;
        testResults.appendChild(line);
      };
      try {
        // Read form values to build config for testing
        const formData = new FormData(form);
        const testConfig = {
          whisparrBaseUrl: formData.get('whisparrBaseUrl'),
          whisparrApiKey: formData.get('whisparrApiKey'),
          localStashRootUrl: formData.get('localStashRootUrl'),
          stashApiKey: formData.get('stashApiKey'),
          whisparrRootFolders: currentConfig.whisparrRootFolders || [], // Use current saved folders for checkbox state
          cfAccessClientId: formData.get('cfAccessClientId'),
          cfAccessClientSecret: formData.get('cfAccessClientSecret'),
          whisparrNeedsCloudflare: formData.get('whisparrNeedsCloudflare') === 'on',
          stashNeedsCloudflare: formData.get('stashNeedsCloudflare') === 'on',
        };
        
        // Run both tests in parallel with dynamic config
        const [whisparrRes, stashRes] = await Promise.all([
          (async () => {
            try {
              const folders = await testWhisparrConnectionAndFolders(testConfig);
              return { ok: true, folders };
            } catch (e) {
              return { ok: false, error: e };
            }
          })(),
          (async () => {
            try {
              await testStashConnection(testConfig);
              return { ok: true };
            } catch (e) {
              return { ok: false, error: e };
            }
          })(),
        ]);

        if (whisparrRes.ok) {
          addLine(true, 'Whisparr', 'Connected');
          // Populate folders as checkboxes
          rootFolderCheckboxes.innerHTML = '';
          const currentSelected = currentConfig.whisparrRootFolders || [];
          for (const f of whisparrRes.folders) {
            const label = document.createElement('label');
            label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; cursor: pointer; margin: 0.25rem 0;';
            label.style.color = 'white';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = f.path;
            checkbox.checked = currentSelected.includes(f.path);
            checkbox.style.cssText = 'width: 1.25rem; height: 1.25rem; cursor: pointer;';
            
            const span = document.createElement('span');
            span.textContent = f.path;
            
            label.appendChild(checkbox);
            label.appendChild(span);
            rootFolderCheckboxes.appendChild(label);
          }
          rootFolderSelectRow.style.display = whisparrRes.folders.length ? 'block' : 'none';
        } else {
          addLine(false, 'Whisparr', formatUserError(whisparrRes.error));
          rootFolderSelectRow.style.display = 'none';
        }

        if (stashRes.ok) {
          addLine(true, 'Stash', 'Connected');
        } else {
          addLine(false, 'Stash', formatUserError(stashRes.error));
        }

        // Only allow Save when both services are OK and at least one root folder is selected
        const updateSaveButton = () => {
          const selectedFolders = Array.from(rootFolderCheckboxes.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
          const canShowSave = !!(whisparrRes.ok && stashRes.ok && selectedFolders.length > 0);
          setSaveVisibility(canShowSave);
          setSaveEnabled(canShowSave);
        };
        
        // Update save button when checkboxes change
        rootFolderCheckboxes.addEventListener('change', updateSaveButton);
        updateSaveButton();
      } finally {
        testSpinner.style.display = 'none';
        testBtn.disabled = false;
      }
    });

    // No longer needed - handled in checkbox change listener

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      // Get all selected root folders
      const selectedFolders = Array.from(rootFolderCheckboxes.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
      
      const newConfig = {
        whisparrBaseUrl: formData.get('whisparrBaseUrl'),
        whisparrApiKey: formData.get('whisparrApiKey'),
        localStashRootUrl: formData.get('localStashRootUrl'),
        stashApiKey: formData.get('stashApiKey'),
        whisparrRootFolders: selectedFolders, // Array of selected root folders
        cfAccessClientId: formData.get('cfAccessClientId'),
        cfAccessClientSecret: formData.get('cfAccessClientSecret'),
        whisparrNeedsCloudflare: formData.get('whisparrNeedsCloudflare') === 'on',
        stashNeedsCloudflare: formData.get('stashNeedsCloudflare') === 'on',
      };

      // Validate required fields
      if (!newConfig.whisparrBaseUrl || !newConfig.whisparrApiKey) {
        alert('Whisparr Base URL and API Key are required!');
        return;
      }

      if (!newConfig.localStashRootUrl || !newConfig.stashApiKey) {
        alert('Stash Root URL and API Key are required!');
        return;
      }

      // Validate URL format
      try {
        new URL(newConfig.whisparrBaseUrl);
        new URL(newConfig.localStashRootUrl);
      } catch (error) {
        alert('Invalid URL format! Please check your URLs.');
        return;
      }

      // Ensure user has tested and selected at least one root folder before saving
      if (selectedFolders.length === 0) {
        alert('Please run Test Connections and select at least one Whisparr root folder before saving.');
        return;
      }

      setConfig(newConfig);
      document.body.removeChild(dialog);
      alert('Settings saved! Refresh the page to apply changes.');
    });

    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        document.body.removeChild(dialog);
      }
    });
  }

  /** Add the download button into the scene page tabs. */
  async function addButtonToScenePage(downloadElm) {
    const startTime = Date.now();
    let parentElement;

    while (!parentElement && (Date.now() - startTime) < MAX_ELEMENT_WAIT_MS) {
      parentElement = document.querySelector('.NarrowPage > .nav-tabs');
      if (!parentElement) {
        await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
      }
    }

    if (!parentElement) {
      throw new Error('Timeout waiting for parent element (.NarrowPage > .nav-tabs)');
    }

    parentElement.appendChild(downloadElm);
  }

  const observer = new MutationObserver(async (mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1 && node.classList.contains('scene-info')) {
          try {
            // Remove any existing controls to avoid duplicates and stale state
            const tabs = document.querySelector('.NarrowPage > .nav-tabs');
            if (tabs) {
              const existing = tabs.querySelector('.downloadInWhisparr');
              if (existing) existing.remove();
            }

            const { downloadElm, updateStatus } = createButton();
            await addButtonToScenePage(downloadElm);
            const stashId = location.pathname.split('/')[2];
            
            // Validate stashId (StashDB uses UUID format)
            if (!Validator.isValidStashId(stashId)) {
              ErrorHandler.logError('Scene ID validation', new Error('Invalid stashId format'), stashId);
              updateStatus({
                button: `${icons.error}<span>Error</span>`,
                className: 'btn-error',
                extra: 'Invalid scene ID format',
              });
              return;
            }
            
            await checkIfAvailable(stashId, updateStatus);
          } catch (error) {
            ErrorHandler.logError('Button addition to scene page', error);
          }
        }
      }
    }
  });

  const observerConfig = { subtree: true, childList: true };
  observer.observe(document.body, observerConfig);

  // Cleanup mechanisms
  const CleanupManager = {
    /**
     * Performs all necessary cleanup operations
     * @returns {void}
     */
    cleanup() {
      // Stop all queue polling
      QueuePollingManager.stopAllPolling();
      
      // Disconnect mutation observer
      observer.disconnect();
    },
  };

  // Cleanup observer when page unloads
  window.addEventListener('beforeunload', () => {
    CleanupManager.cleanup();
  });

  // Also cleanup on page visibility change (when tab becomes hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Optionally reduce polling frequency when tab is hidden
      // For now, we keep normal polling but could implement this optimization
    }
  });

  // Queue polling management with proper cleanup
  const QueuePollingManager = {
    activePollers: new Map(), // movieId -> { intervalId, updateStatus, startTime }
    maxPollingDuration: 30 * 60 * 1000, // 30 minutes max polling

    /**
     * Starts polling Whisparr queue for a movie
     * @param {number} movieId - The movie ID to poll
     * @param {Function} updateStatus - Function to update button status
     * @returns {void}
     */
    startPolling(movieId, updateStatus) {
      if (this.activePollers.has(movieId)) {
        return; // Already polling
      }

      const startTime = Date.now();
    const intervalId = setInterval(async () => {
      try {
          await this.pollQueueItem(movieId, updateStatus, startTime);
        } catch (error) {
          ErrorHandler.logError('Queue polling', error);
        }
      }, QUEUE_POLL_INTERVAL_MS);

      this.activePollers.set(movieId, { intervalId, updateStatus, startTime });
    },

    /**
     * Polls a single queue item and handles completion/timeout
     * @param {number} movieId - The movie ID being polled
     * @param {Function} updateStatus - Function to update button status
     * @param {number} startTime - When polling started
     * @returns {Promise<void>}
     */
    async pollQueueItem(movieId, updateStatus, startTime) {
      const pollerInfo = this.activePollers.get(movieId);
      if (!pollerInfo) return;

      // Check for timeout
      if (Date.now() - startTime > this.maxPollingDuration) {
        this.stopPolling(movieId);
        updateStatus({
          button: `${icons.error}<span>Timeout</span>`,
          className: 'btn-error',
          extra: 'Download polling timed out',
        });
        return;
      }

        const queue = await fetchWhisparr('/queue/details?all=true');
        const items = Array.isArray(queue) ? queue : (Array.isArray(queue?.records) ? queue.records : []);
        const item = items.find((q) => q.movieId === movieId);
      
        if (!item) {
        // Not in queue anymore; stop polling and update final state
        this.stopPolling(movieId);
        await this.handleQueueCompletion(movieId, updateStatus);
        return;
      }

      // Update progress
      const progress = this.calculateProgress(item);
      updateStatus({
        button: `${icons.loading}<span>${progress.label}</span>`,
        className: 'btn-loading',
        extra: '',
      });

      // If complete, stop polling
      if (progress.isComplete) {
        this.stopPolling(movieId);
      }
    },

    /**
     * Calculates download progress from queue item
     * @param {Object} item - Queue item
     * @returns {Object} Progress information
     */
    calculateProgress(item) {
      if (typeof item.progress === 'number' && isFinite(item.progress)) {
        const pct = Math.max(0, Math.min(100, Math.round(item.progress)));
        return { label: `${pct}%`, isComplete: pct >= 100, percent: pct };
      }
      const pickNumber = (...candidates) => {
        for (const v of candidates) {
          if (typeof v === 'number' && isFinite(v)) return v;
        }
        return null;
      };
      const total = pickNumber(item.size, item.sizeNz, item.sizeBytes, item.sizebytes);
      const left = pickNumber(item.sizeLeft, item.sizeleft, item.sizeLeftBytes, item.sizeleftBytes);
      if (total == null || left == null || total <= 0 || left < 0) {
        const label = typeof item.status === 'string' && item.status ? item.status : 'Downloading';
        return { label, isComplete: false, percent: null };
      }
      const percent = Math.max(0, Math.min(100, Math.round(((total - left) / total) * 100)));
      return { label: `${percent}%`, isComplete: left === 0 || percent >= 100, percent };
    },

    /**
     * Handles completion of queue item
     * @param {number} movieId - The movie ID
     * @param {Function} updateStatus - Function to update button status
     * @returns {Promise<void>}
     */
    async handleQueueCompletion(movieId, updateStatus) {
      try {
            const movies = await fetchWhisparr('/movie');
            const movie = movies.find((m) => m.id === movieId);
        
            if (movie && movie.hasFile) {
              const localStashSceneId = await getLocalStashSceneId(movie);
              if (localStashSceneId) {
                const stashUrl = `${localStashRootUrl}/scenes/${localStashSceneId}`;
                updateStatus({
                  button: `${icons.play}<span>Play</span>`,
                  className: 'btn-play',
                  extra: '',
                  onClick: () => {
                    const newWindow = window.open(stashUrl, '_blank');
                    if (newWindow) newWindow.focus();
                  },
                });
            return;
          }
        }
        
              updateStatus({
                button: `${icons.monitor}<span>Monitored</span>`,
                className: 'btn-monitor',
                extra: '',
              });
      } catch (error) {
        ErrorHandler.logError('Queue completion handling', error);
            updateStatus({
              button: `${icons.monitor}<span>Monitored</span>`,
              className: 'btn-monitor',
              extra: '',
            });
          }
    },

    /**
     * Stops polling for a specific movie
     * @param {number} movieId - The movie ID
     * @returns {void}
     */
    stopPolling(movieId) {
      const pollerInfo = this.activePollers.get(movieId);
      if (pollerInfo) {
        clearInterval(pollerInfo.intervalId);
        this.activePollers.delete(movieId);
      }
    },

    /**
     * Stops all active polling
     * @returns {void}
     */
    stopAllPolling() {
      for (const [movieId, pollerInfo] of this.activePollers) {
        clearInterval(pollerInfo.intervalId);
      }
      this.activePollers.clear();
    }
  };

  /** Start polling Whisparr queue for a movie and update progress. */
  function startQueueProgressPolling(movieId, updateStatus) {
    QueuePollingManager.startPolling(movieId, updateStatus);
  }

  /** Check if a scene exists in local Stash. */
  async function checkStashAvailability(stashId) {
    try {
      const localStashSceneId = await getLocalStashSceneIdByStashId(stashId);
      return localStashSceneId;
    } catch (error) {
      ErrorHandler.logError('Stash availability check', error);
      return null;
    }
  }

  /** Check Whisparr for existing movie status by stashId. */
  async function checkWhisparrStatus(stashId) {
    try {
      const existingScene = await fetchSceneWithQueueStatus(stashId);
      return existingScene;
    } catch (error) {
      ErrorHandler.logError('Whisparr status check', error);
      throw error;
    }
  }

  /** Handle end-to-end download flow based on Whisparr state. */
  async function handleDownloadFlow(whisparrScene, updateStatus) {
    if (!whisparrScene) {
      return;
    }

    if (whisparrScene.hasFile) {
      await handleSceneWithFile(whisparrScene, updateStatus);
      return;
    }

    if (whisparrScene.queueStatus) {
      await handleSceneInQueue(whisparrScene, updateStatus);
      return;
    }

    if (whisparrScene.monitored) {
      await handleMonitoredScene(whisparrScene, updateStatus);
      return;
    }

    await handleUnmonitoredScene(whisparrScene, updateStatus);
  }

  /** Handle a scene that already has a file. */
  async function handleSceneWithFile(whisparrScene, updateStatus) {
    try {
      const localStashSceneId = await getLocalStashSceneId(whisparrScene);
      if (!localStashSceneId) {
        updateStatus({
          button: `${icons.monitor}<span>Monitored</span>`,
          className: 'btn-monitor',
          extra: '',
        });
        return;
      }
      const stashUrl = `${localStashRootUrl}/scenes/${localStashSceneId}`;
      updateStatus({
        button: `${icons.play}<span>Play</span>`,
        className: 'btn-play',
        extra: '',
        onClick: () => {
          openInNewTab(stashUrl);
        },
      });
    } catch (error) {
      ErrorHandler.handleApiError('getting Stash scene ID', error, updateStatus);
    }
  }

  /** Handle a scene that is currently in the queue. */
  async function handleSceneInQueue(whisparrScene, updateStatus) {
    updateStatus({
      button: `${icons.loading}<span>Downloading</span>`,
      className: 'btn-loading',
      extra: '',
    });
    if (whisparrScene.id) {
      startQueueProgressPolling(whisparrScene.id, updateStatus);
    }
  }

  /** Handle a monitored scene and check if it is in queue. */
  async function handleMonitoredScene(whisparrScene, updateStatus) {
    try {
      const queue = await fetchWhisparr('/queue/details?all=true');
      const qItem = queue.find((q) => q.movieId === whisparrScene.id);
      if (qItem) {
        await handleSceneInQueue(whisparrScene, updateStatus);
        return;
      }
    } catch (error) {
      ErrorHandler.logError('Queue check for monitored scene', error);
    }
    
    updateStatusToMonitored(whisparrScene, updateStatus);
  }

  /** Handle an unmonitored scene by checking availability. */
  async function handleUnmonitoredScene(whisparrScene, updateStatus) {
          updateStatus({
      button: `${icons.loading}<span>Checking download availability...</span>`,
                className: 'btn-loading',
                extra: '',
              });

    try {
      const fileDownloadAvailability = await getFileDownloadAvailability(whisparrScene);
      await handleDownloadAvailability(whisparrScene, fileDownloadAvailability, updateStatus);
    } catch (error) {
      ErrorHandler.handleApiError('checking download availability', error, updateStatus);
    }
  }

  /** Handle different download availability states. */
  async function handleDownloadAvailability(whisparrScene, availability, updateStatus) {
    switch (availability) {
      case 'available for download':
                updateStatus({
          button: `${icons.download}<span>Download</span>`,
          className: 'btn-download',
                  extra: '',
          onClick: async () => {
            await initiateDownload(whisparrScene, updateStatus);
          },
        });
        break;
      case 'already downloading':
        await handleSceneInQueue(whisparrScene, updateStatus);
        break;
      case 'not available for download':
        updateStatusToUnmonitored(whisparrScene, updateStatus);
        break;
      default:
                updateStatus({
          button: `${icons.error}<span>Unknown</span>`,
                  className: 'btn-error',
          extra: 'Unknown file availability',
        });
    }
  }

  /** Initiate a movie search/download in Whisparr. */
  async function initiateDownload(whisparrScene, updateStatus) {
        updateStatus({
      button: `${icons.loading}<span>Downloading</span>`,
              className: 'btn-loading',
              extra: '',
      onClick: () => {},
    });
    
    try {
      await downloadVideo(whisparrScene);
                updateStatus({
        button: `${icons.loading}<span>Downloading</span>`,
        className: 'btn-loading',
                  extra: '',
      });
      if (whisparrScene.id) {
        startQueueProgressPolling(whisparrScene.id, updateStatus);
              }
            } catch (error) {
      ErrorHandler.handleApiError('initiating download', error, updateStatus);
    }
    }

    /** Update button to show scene is monitored. */
  function updateStatusToMonitored(whisparrScene, updateStatus) {
      updateStatus({
        button: `${icons.monitor}<span>Monitored</span>`,
        className: 'btn-monitor',
        extra: '',
        onClick: async () => {
          if (!whisparrScene || !whisparrScene.id) {
          ErrorHandler.logError('Monitoring toggle', new Error('Scene not found'));
            return;
          }

          try {
            whisparrScene = await monitorScene(false, whisparrScene);
          updateStatusToUnmonitored(whisparrScene, updateStatus);
          } catch (error) {
          ErrorHandler.handleApiError('disabling monitoring', error, updateStatus);
          }
        },
      });
    }

    /** Update button to show scene is unmonitored. */
  function updateStatusToUnmonitored(whisparrScene, updateStatus) {
      updateStatus({
        button: `${icons.monitorOff}<span>Monitor</span>`,
        className: 'btn-monitor',
        extra: '',
        onClick: async () => {
          if (!whisparrScene || !whisparrScene.id) {
            // Scene doesn't exist yet, add it as monitored
            try {
            whisparrScene = await ensureSceneAddedAsMonitored(whisparrScene.stashId);
            updateStatusToMonitored(whisparrScene, updateStatus);
              return;
            } catch (error) {
            ErrorHandler.handleApiError('adding scene as monitored', error, updateStatus);
              return;
            }
          }

          // Scene exists, enable monitoring
          try {
            whisparrScene = await monitorScene(true, whisparrScene);
          updateStatusToMonitored(whisparrScene, updateStatus);
          } catch (error) {
          ErrorHandler.handleApiError('enabling monitoring', error, updateStatus);
          }
        },
      });
    }

  /** Check availability in Stash first, then Whisparr. */
  async function checkIfAvailable(stashId, updateStatus) {
    // First check if scene already exists in Stash
    updateStatus({
      button: `${icons.loading}<span>Checking Stash...</span>`,
      className: 'btn-loading',
      extra: '',
    });

    const localStashSceneId = await checkStashAvailability(stashId);
    if (localStashSceneId) {
      const stashUrl = `${localStashRootUrl}/scenes/${localStashSceneId}`;
      updateStatus({
        button: `${icons.play}<span>Play</span>`,
        className: 'btn-play',
        extra: '',
        onClick: () => {
          openInNewTab(stashUrl);
        },
      });
      return;
    }

    // If not in Stash, check Whisparr status
    updateStatus({
      button: `${icons.loading}<span>Checking Whisparr...</span>`,
      className: 'btn-loading',
      extra: '',
    });

    try {
      const existingScene = await checkWhisparrStatus(stashId);

      // Handle previously added but unmonitored scenes
      if (existingScene && !existingScene.monitored && !existingScene.hasFile && !existingScene.queueStatus) {
        updateStatus({
          button: `${icons.deleted}<span>Previously Added</span>`,
          className: 'btn-monitor',
          onClick: async () => {
            updateStatus({
              button: `${icons.loading}<span>Enabling monitoring...</span>`,
              className: 'btn-loading',
          extra: '',
            });
            try {
              await monitorScene(true, existingScene);
            updateStatus({
                button: `${icons.monitor}<span>Monitored</span>`,
                className: 'btn-monitor',
          extra: '',
            });
            } catch (error) {
              ErrorHandler.handleApiError('enabling monitoring', error, updateStatus);
            }
          },
        });
        return;
      }

      // Handle scenes that don't exist in Whisparr yet
      if (!existingScene) {
        updateStatus({
          button: `${icons.monitorOff}<span>Monitor</span>`,
          className: 'btn-monitor',
          extra: '',
          onClick: async () => {
            updateStatus({
              button: `${icons.loading}<span>Adding to Whisparr...</span>`,
          className: 'btn-loading',
          extra: '',
        });
            try {
              const whisparrScene = await ensureSceneAddedAsMonitored(stashId);
              
              if (whisparrScene.hasFile) {
                await handleSceneWithFile(whisparrScene, updateStatus);
              } else {
                updateStatusToMonitored(whisparrScene, updateStatus);
              }
            } catch (error) {
              ErrorHandler.handleApiError('adding scene to Whisparr', error, updateStatus);
            }
          },
        });
        return;
      }

      // Handle existing scenes in Whisparr
      await handleDownloadFlow(existingScene, updateStatus);

    } catch (error) {
      ErrorHandler.handleApiError('checking scene in Whisparr', error, updateStatus);
    }
  }

  /** Fetch Whisparr movie by stashId and attach queue status. */
  async function fetchSceneWithQueueStatus(stashId) {
    const scenes = await fetchWhisparr('/movie');
    
    if (!Array.isArray(scenes)) {
      ErrorHandler.logError('Invalid scenes response', new Error('Expected array'));
      return null;
    }
    
    const scene = scenes.find((s) => s.stashId === stashId);
    
    if (scene && !scene.hasFile) {
      const queue = await fetchWhisparr('/queue/details?all=true');
      
      if (Array.isArray(queue)) {
        scene.queueStatus = queue.find((queueItem) => 
          Validator.isValidQueueItem(queueItem) && queueItem.movieId === scene.id
        );
      }
    }
    
    return scene || null;
  }

  /**
   * Ensures a scene is added to Whisparr (unmonitored)
   * @param {string} stashId - The StashDB scene ID
   * @returns {Promise<Object>} The Whisparr scene object
   */
  async function ensureSceneAdded(stashId) {
    const scene = await fetchSceneWithQueueStatus(stashId);
    if (scene) {
      return scene;
    }

    try {
      const rootFolderPath = await getRootFolderPath();
      if (!rootFolderPath) {
        throw new Error('Root folder selection cancelled or unavailable');
      }

      return await fetchWhisparr('/movie', {
        body: {
          addOptions: {
            monitor: 'none',
            searchForMovie: false,
          },
          foreignId: stashId,
          monitored: false,
          qualityProfileId: DEFAULT_QUALITY_PROFILE_ID,
          rootFolderPath: rootFolderPath,
          stashId,
          tags: [],
          title: 'added via stashdb extension',
        },
        retryAttempts: 3,
        retryDelayMs: 1500,
        retryOnStatus: [400, 409, 429, 500, 502, 503, 504],
      });
    } catch (error) {
      ErrorHandler.logError('Adding scene to Whisparr', error);
      throw error;
    }
  }

  /**
   * Ensures a scene is added to Whisparr as monitored
   * @param {string} stashId - The StashDB scene ID
   * @returns {Promise<Object>} The Whisparr scene object
   */
  async function ensureSceneAddedAsMonitored(stashId) {
    const scene = await fetchSceneWithQueueStatus(stashId);
    if (scene) {
      return scene;
    }

    try {
      const rootFolderPath = await getRootFolderPath();
      if (!rootFolderPath) {
        throw new Error('Root folder selection cancelled or unavailable');
      }

      const newScene = await fetchWhisparr('/movie', {
        body: {
          addOptions: {
            monitor: 'none',
            searchForMovie: false,
          },
          foreignId: stashId,
          monitored: true,
          qualityProfileId: DEFAULT_QUALITY_PROFILE_ID,
          rootFolderPath: rootFolderPath,
          stashId,
          tags: [],
          title: 'added via stashdb extension',
        },
        retryAttempts: 3,
        retryDelayMs: 1500,
        retryOnStatus: [400, 409, 429, 500, 502, 503, 504],
      });

      // Trigger MoviesSearch after delay for the newly added monitored scene
      setTimeout(async () => {
        try {
          await triggerMoviesSearch([newScene.id]);
        } catch (error) {
          ErrorHandler.logError('MoviesSearch trigger for new scene', error);
        }
      }, SEARCH_TRIGGER_DELAY_MS);

      return newScene;
    } catch (error) {
      ErrorHandler.logError('Adding monitored scene to Whisparr', error);
      throw error;
    }
  }

  /**
   * Triggers a movie search in Whisparr
   * @param {Array<number>|null} movieIds - Optional array of movie IDs to search
   * @returns {Promise<Object>} Command response
   */
  async function triggerMoviesSearch(movieIds = null) {
    try {
      const commandBody = {
        name: 'MoviesSearch',
      };

      // If specific movie IDs are provided, search only those movies
      if (movieIds && movieIds.length > 0) {
        commandBody.movieIds = movieIds;
      }

      const response = await fetchWhisparr('/command', {
        body: commandBody,
      });
      return response;
    } catch (error) {
      ErrorHandler.logError('Triggering movies search', error);
      throw error;
    }
  }

  /**
   * Updates monitoring status of a scene in Whisparr
   * @param {boolean} monitor - Whether to monitor the scene (true = enabled, false = disabled)
   * @param {Object} whisparrScene - The Whisparr scene object
   * @returns {Promise<Object>} Updated scene object
   */
  async function monitorScene(monitor, whisparrScene) {
    const result = await fetchWhisparr(`/movie/${whisparrScene.id}`, {
      method: 'PUT',
      body: {
        foreignId: whisparrScene.foreignId,
        monitored: monitor,
        qualityProfileId: whisparrScene.qualityProfileId,
        rootFolderPath: whisparrScene.rootFolderPath,
        stashId: whisparrScene.stashId,
        title: whisparrScene.title,
        path: whisparrScene.path,
        tags: whisparrScene.tags,
      },
    });

    // If we're enabling monitoring, trigger a MoviesSearch to find missing movies
    if (monitor) {
      setTimeout(async () => {
        try {
          await triggerMoviesSearch([whisparrScene.id]);
        } catch (error) {
          ErrorHandler.logError('MoviesSearch after enabling monitoring', error);
          // Don't throw error here - monitoring was successful, search failure is not critical
        }
      }, SEARCH_TRIGGER_DELAY_MS);
    }

    return result;
  }

  /**
   * Checks if a file is available for download in Whisparr
   * @param {Object} whisparrScene - The Whisparr scene object
   * @returns {Promise<string>} Download availability status
   */
  async function getFileDownloadAvailability(whisparrScene) {
    const releases = await fetchWhisparr(`release?movieId=${whisparrScene.id}`);

    if (releases.some((release) => release.approved)) {
      return 'available for download';
    }
    
    if (releases.some((release) => 
      Array.isArray(release.rejections) &&
      release.rejections.some((rejection) => 
        typeof rejection === 'string' && rejection.startsWith('Release in queue already')
      )
    )) {
      return 'already downloading';
    }
    
    return 'not available for download';
  }

  /**
   * Initiates download of a video in Whisparr
   * @param {Object} whisparrScene - The Whisparr scene object
   * @returns {Promise<void>}
   */
  async function downloadVideo(whisparrScene) {
    await fetchWhisparr('/command', {
      body: {
        name: 'MoviesSearch',
        movieIds: [whisparrScene.id],
      },
    });
  }

  /**
   * Finds a scene ID in local Stash by StashDB ID
   * @param {string} stashId - The StashDB scene ID
   * @returns {Promise<string|null>} The local Stash scene ID or null if not found
   */
  async function getLocalStashSceneIdByStashId(stashId) {
    // Try multiple approaches to find the scene in Stash

    // First try: Search by URL (most reliable)
    try {
      const stashRes = await localStashGraphQl({
        variables: {
          scene_filter: {
            url: {
              modifier: 'EQUALS',
              value: `https://stashdb.org/scenes/${stashId}`,
            },
          },
        },
        query: `
          query ($scene_filter: SceneFilterType) {
            findScenes(scene_filter: $scene_filter) {
              scenes {
                id
                url
              }
            }
          }
        `,
      });
      
      if (!Validator.isValidStashResponse(stashRes)) {
        ErrorHandler.logError('Invalid Stash response (URL search)', new Error('Invalid GraphQL response format'));
        return null;
      }
      
      const scene = stashRes.data.findScenes.scenes[0];
      if (scene && scene.id) {
        return scene.id;
      }
    } catch (error) {
      ErrorHandler.logError('Stash search by URL', error);
    }

    // Second try: Search by stash_id field directly
    try {
      const stashRes = await localStashGraphQl({
        variables: {
          scene_filter: {
            stash_id_endpoint: {
              endpoint: '',
              modifier: 'EQUALS',
              stash_id: stashId,
            },
          },
        },
        query: `
          query ($scene_filter: SceneFilterType) {
            findScenes(scene_filter: $scene_filter) {
              scenes {
                id
              }
            }
          }
        `,
      });
      
      if (!Validator.isValidStashResponse(stashRes)) {
        ErrorHandler.logError('Invalid Stash response (stash_id search)', new Error('Invalid GraphQL response format'));
        return null;
      }
      
      const scene = stashRes.data.findScenes.scenes[0];
      if (scene && scene.id) {
        return scene.id;
      }
    } catch (error) {
      ErrorHandler.logError('Stash search by stash_id field', error);
    }

    return null;
  }

  /**
   * Gets local Stash scene ID from a Whisparr scene
   * @param {Object} whisparrScene - The Whisparr scene object
   * @returns {Promise<string|undefined>} The local Stash scene ID
   */
  async function getLocalStashSceneId(whisparrScene) {
    try {
      const stashRes = await localStashGraphQl({
        variables: {
          scene_filter: {
            stash_id_endpoint: {
              endpoint: '',
              modifier: 'EQUALS',
              stash_id: whisparrScene.stashId,
            },
          },
        },
        query: `
          query ($scene_filter: SceneFilterType) {
            findScenes(scene_filter: $scene_filter) {
              scenes {
                id
              }
            }
          }
        `,
      });
      return stashRes.data.findScenes.scenes[0]?.id;
    } catch (error) {
      ErrorHandler.logError('Getting local Stash scene ID', error);
      return undefined;
    }
  }

  // Create fetch functions that read config dynamically
  function fetchWhisparr(subPath, options = {}, config = null) {
    const cfg = config || getFreshConfig();
    const fetchFn = factoryFetchApi(
      `${cfg.whisparrBaseUrl}/api/v3/`, 
      { 'X-Api-Key': cfg.whisparrApiKey },
      cfg.whisparrNeedsCloudflare,
      15000,
      cfg.cfAccessClientId,
      cfg.cfAccessClientSecret
    );
    return fetchFn(subPath, options);
  }

  function fetchLocalStash(subPath, options = {}, config = null) {
    const cfg = config || getFreshConfig();
    const fetchFn = factoryFetchApi(
      `${cfg.localStashRootUrl}/graphql`,
      { ApiKey: cfg.stashApiKey },
      cfg.stashNeedsCloudflare,
      15000,
      cfg.cfAccessClientId,
      cfg.cfAccessClientSecret
    );
    return fetchFn(subPath, options);
  }

  /**
   * Executes a GraphQL query against the local Stash instance
   * @param {Object} request - GraphQL request object with query and variables
   * @param {Object|null} config - Optional config object to use instead of saved config
   * @returns {Promise<Object>} GraphQL response
   */
  async function localStashGraphQl(request, config = null) {
    return fetchLocalStash('', { body: request }, config);
  }

  /**
   * Opens a URL in a new tab with security protections
   * @param {string} url - URL to open
   * @returns {Window|null} The opened window or null if blocked
   */
  function openInNewTab(url) {
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (newWindow) {
      try {
        newWindow.opener = null;
      } catch (_) {
        // Ignore if opener cannot be set
      }
      newWindow.focus();
    } else {
      console.warn('Failed to open URL in new window. Check popup blocker.');
    }
    return newWindow;
  }

  /**
   * Factory function for creating fetch API wrappers
   * @param {string} baseUrl - Base URL for API requests
   * @param {Object} defaultHeaders - Default headers to include in requests
   * @param {boolean} addCloudflareHeaders - Whether to add Cloudflare Zero Trust headers
   * @param {number} defaultTimeoutMs - Default timeout in milliseconds
   * @returns {Function} Fetch wrapper function
   */
  function factoryFetchApi(baseUrl, defaultHeaders, addCloudflareHeaders = false, defaultTimeoutMs = 15000, cfAccessClientId = null, cfAccessClientSecret = null) {
    return async (subPath, options = {}) => {
      const retryAttempts = Number.isFinite(options.retryAttempts) ? options.retryAttempts : 2;
      const retryDelayMs = Number.isFinite(options.retryDelayMs) ? options.retryDelayMs : 1000;
      const retryOnStatus = Array.isArray(options.retryOnStatus) && options.retryOnStatus.length > 0
        ? options.retryOnStatus
        : [429, 500, 502, 503, 504, 520, 522, 524];
      const retryOnNetworkErrors = options.retryOnNetworkErrors !== false;

      let lastError;
      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? defaultTimeoutMs);
        try {
          const hasBody = options.body !== undefined && options.body !== null;
          const method = options.method || (hasBody ? 'POST' : 'GET');

          const headers = {
            ...defaultHeaders,
            ...(hasBody && typeof options.body === 'object' ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
            ...(addCloudflareHeaders && cfAccessClientId ? { 'CF-Access-Client-Id': cfAccessClientId } : {}),
            ...(addCloudflareHeaders && cfAccessClientSecret ? { 'CF-Access-Client-Secret': cfAccessClientSecret } : {}),
          };

          const url = new URL(String(subPath || '').replace(/^\/*/g, ''), baseUrl);
          const body = hasBody && typeof options.body === 'object' ? JSON.stringify(options.body) : options.body;

          const res = await fetch(url, {
            method,
            mode: 'cors',
            credentials: 'omit',
            ...options,
            method, // ensure method is not overridden by spread
            headers,
            body,
            signal: controller.signal,
          }).finally(() => clearTimeout(timeoutId));

          if (!res.ok) {
            let parsed;
            try {
              parsed = await res.json();
            } catch (_) {}
            const error = new Error(`HTTP ${res.status}: ${res.statusText}`);
            error.statusCode = res.status;
            error.resBody = parsed;
            // Decide whether to retry
            if (attempt < retryAttempts && retryOnStatus.includes(res.status)) {
              const backoff = retryDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
              await new Promise((r) => setTimeout(r, backoff));
              continue;
            }
            throw error;
          }
          return res.json();
        } catch (err) {
          lastError = err;
          const isAbortError = err && (err.name === 'AbortError');
          const isNetwork = err && (isAbortError || err.message === 'Failed to fetch');
          if (attempt < retryAttempts && retryOnNetworkErrors && isNetwork) {
            const backoff = retryDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    };
  }
}());
