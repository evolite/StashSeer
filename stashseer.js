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

/**
 * Retrieves the current configuration from Tampermonkey storage
 * @returns {Object} Configuration object with all settings
 */
function getConfig() {
  return {
    whisparrBaseUrl: GM_getValue('whisparrBaseUrl', 'http://localhost:6969'),
    whisparrApiKey: GM_getValue('whisparrApiKey', ''),
    whisparrRootFolderPath: GM_getValue('whisparrRootFolderPath', '/data/'),
    localStashRootUrl: GM_getValue('localStashRootUrl', 'http://localhost:9999'),
    stashApiKey: GM_getValue('stashApiKey', ''),
    cfAccessClientId: GM_getValue('cfAccessClientId', ''),
    cfAccessClientSecret: GM_getValue('cfAccessClientSecret', ''),
    whisparrNeedsCloudflare: GM_getValue('whisparrNeedsCloudflare', false),
    stashNeedsCloudflare: GM_getValue('stashNeedsCloudflare', false),
  };
}

/**
 * Saves configuration to Tampermonkey storage
 * @param {Object} config - Configuration object to save
 */
function setConfig(config) {
  GM_setValue('whisparrBaseUrl', config.whisparrBaseUrl);
  GM_setValue('whisparrApiKey', config.whisparrApiKey);
  GM_setValue('whisparrRootFolderPath', config.whisparrRootFolderPath);
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

// Get current configuration
const config = getConfig();
const whisparrBaseUrl = config.whisparrBaseUrl;
const whisparrApiKey = config.whisparrApiKey;
const whisparrRootFolderPath = config.whisparrRootFolderPath;
const localStashRootUrl = config.localStashRootUrl;
const localStashGraphQlEndpoint = `${localStashRootUrl}/graphql`;
const localStashAuthHeaders = { ApiKey: config.stashApiKey };
const cfAccessClientId = config.cfAccessClientId || '';
const cfAccessClientSecret = config.cfAccessClientSecret || '';

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
    check: `<svg viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/></svg>`,
    whisparr: `<svg viewBox="0 0 16 16"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"/><path d="M8 4a.5.5 0 0 1 .5.5V6a.5.5 0 0 1-1 0V4.5A.5.5 0 0 1 8 4zM3.732 5.732a.5.5 0 0 1 .707 0l.915.914a.5.5 0 1 1-.708.708l-.914-.915a.5.5 0 0 1 0-.707zM2 10a.5.5 0 0 1 .5-.5h1.586a.5.5 0 0 1 0 1H2.5A.5.5 0 0 1 2 10zm9.5 0a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 0 1H12a.5.5 0 0 1-.5-.5zm.754-4.246a.389.389 0 0 0-.527-.02L7.547 9.31a.91.91 0 1 0 1.302 1.258l3.434-4.297a.389.389 0 0 0-.029-.518z"/></svg>`,
    stash: `<svg viewBox="0 0 16 16"><path d="M0 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm8 1a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm2 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0z"/></svg>`,
    settings: `<svg viewBox="0 0 16 16"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/></svg>`,
  };

  /**
   * Escapes HTML to prevent XSS attacks
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Creates button controls for Whisparr integration
   * @returns {Object} Object containing downloadElm and updateStatus function
   */
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
      const newWindow = window.open(whisparrBaseUrl, '_blank');
      if (newWindow) {
        newWindow.focus();
      } else {
        console.warn('Failed to open Whisparr in new window. Check popup blocker.');
      }
    });

    // Add Stash button
    stashButtonElm.innerHTML = `${icons.stash}<span>Stash</span>`;
    stashButtonElm.classList.add('btn-stash');
    stashButtonElm.addEventListener('click', () => {
      const newWindow = window.open(localStashRootUrl, '_blank');
      if (newWindow) {
        newWindow.focus();
      } else {
        console.warn('Failed to open Stash in new window. Check popup blocker.');
      }
    });

    // Add Settings button
    settingsButtonElm.innerHTML = `${icons.settings}<span>Settings</span>`;
    settingsButtonElm.classList.add('btn-settings');
    settingsButtonElm.addEventListener('click', () => {
      showSettingsDialog();
    });

    let lastOnClickValue;

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
          // Allow HTML for links (controlled content only, not user input)
          statusElm.innerHTML = newStatus.extra;
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

  /**
   * Shows the settings dialog for configuring API keys and URLs
   */
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
        <div style="margin-bottom: 1rem;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Whisparr Root Folder Path:</label>
          <input type="text" name="whisparrRootFolderPath" value="${escapeHtml(currentConfig.whisparrRootFolderPath)}" 
                 style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
        </div>
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
        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
          <button type="button" id="cancelBtn" style="padding: 0.5rem 1rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #4a5568; color: white; cursor: pointer;">Cancel</button>
          <button type="submit" style="padding: 0.5rem 1rem; border: 1px solid #4d9fff; border-radius: 0.25rem; background: #4d9fff; color: white; cursor: pointer;">Save</button>
        </div>
      </form>
    `;

    dialog.appendChild(content);
    document.body.appendChild(dialog);

    const form = content.querySelector('#settingsForm');
    const cancelBtn = content.querySelector('#cancelBtn');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const newConfig = {
        whisparrBaseUrl: formData.get('whisparrBaseUrl'),
        whisparrApiKey: formData.get('whisparrApiKey'),
        localStashRootUrl: formData.get('localStashRootUrl'),
        stashApiKey: formData.get('stashApiKey'),
        whisparrRootFolderPath: formData.get('whisparrRootFolderPath'),
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

  /**
   * Adds download button to the scene page
   * @param {HTMLElement} downloadElm - The download button element to add
   * @returns {Promise<void>}
   * @throws {Error} If parent element is not found within timeout
   */
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
            const { downloadElm, updateStatus } = createButton();
            await addButtonToScenePage(downloadElm);
            const stashId = location.pathname.split('/')[2];
            
            // Validate stashId (StashDB uses UUID format)
            if (!stashId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stashId)) {
              console.error('Invalid stashId format:', stashId);
              updateStatus({
                button: `${icons.error}<span>Error</span>`,
                className: 'btn-error',
                extra: 'Invalid scene ID format',
              });
              return;
            }
            
            await checkIfAvailable(stashId, updateStatus);
          } catch (error) {
            console.error('Error adding button to scene page:', error);
          }
        }
      }
    }
  });

  const observerConfig = { subtree: true, childList: true };
  observer.observe(document, observerConfig);

  // Cleanup observer when page unloads
  window.addEventListener('beforeunload', () => {
    observer.disconnect();
  });

  // Track active queue pollers per movie to avoid duplicates
  const activeQueuePollers = new Map(); // movieId -> intervalId

  function formatBytes(bytes) {
    if (bytes === 0 || !isFinite(bytes)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
  }

  function formatSeconds(seconds) {
    if (seconds == null || !isFinite(seconds) || seconds < 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  }

  /**
   * Starts polling Whisparr queue for a movie and updates the button extra with progress
   * @param {number} movieId
   * @param {Function} updateStatus
   */
  function startQueueProgressPolling(movieId, updateStatus) {
    if (activeQueuePollers.has(movieId)) return; // already polling

    const intervalId = setInterval(async () => {
      try {
        const queue = await fetchWhisparr('/queue/details?all=true');
        const item = queue.find((q) => q.movieId === movieId);
        if (!item) {
          // Not in queue anymore; stop polling
          clearInterval(intervalId);
          activeQueuePollers.delete(movieId);
          return;
        }

        const total = item.size || item.sizeNz || 0;
        const left = item.sizeleft != null ? item.sizeleft : (item.sizeLeft || 0);
        const done = total && left != null ? (total - left) : null;
        const percent = total && left != null ? Math.max(0, Math.min(100, Math.round(((total - left) / total) * 100))) : null;
        const timeleft = item.timeleftSeconds != null ? item.timeleftSeconds : (item.timeleft || null);

        const percentLabel = percent != null ? `${percent}%` : 'Downloading';

        updateStatus({
          button: `${icons.loading}<span>${percentLabel}</span>`,
          className: 'btn-loading',
          extra: '',
        });

        // If complete (left is 0), stop polling
        if (left === 0) {
          clearInterval(intervalId);
          activeQueuePollers.delete(movieId);
        }
      } catch (e) {
        // Keep polling; transient errors are expected
        // No console spam here to avoid noise
      }
    }, 5000);

    activeQueuePollers.set(movieId, intervalId);
  }

  /**
   * Checks if a scene is available in Stash or Whisparr
   * @param {string} stashId - The StashDB scene ID
   * @param {Function} updateStatus - Function to update button status
   * @returns {Promise<void>}
   */
  async function checkIfAvailable(stashId, updateStatus) {
    let whisparrScene;

    // First check if scene already exists in Stash
    updateStatus({
      button: `${icons.loading}<span>Checking Stash...</span>`,
      className: 'btn-loading',
      extra: '',
    });

    const localStashSceneId = await getLocalStashSceneIdByStashId(stashId);
    if (localStashSceneId) {
      const stashUrl = `${localStashRootUrl}/scenes/${localStashSceneId}`;
      updateStatus({
        button: `${icons.play}<span>Play</span>`,
        className: 'btn-play',
        extra: '',
        onClick: () => {
          const newWindow = window.open(stashUrl, '_blank');
          if (newWindow) {
            newWindow.focus();
          } else {
            console.warn('Failed to open Stash scene. Check popup blocker.');
          }
        },
      });
      return;
    }

    // If not in Stash, check if scene exists in Whisparr but is unmonitored and has no file (previously deleted)
    updateStatus({
      button: `${icons.loading}<span>Checking Whisparr...</span>`,
      className: 'btn-loading',
      extra: '',
    });

    try {
      let existingScene = await fetchSceneWithQueueStatus(stashId);

      // Check if scene exists, is unmonitored, and has no file (previously added and since deleted in stash)
      if (existingScene && !existingScene.monitored && !existingScene.hasFile) {

        // If not in queue, it was previously added but unmonitored
        if (!existingScene.queueStatus) {
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
                console.error('Error enabling monitoring:', error);
                updateStatus({
                  button: `${icons.error}<span>Error</span>`,
                  className: 'btn-error',
                  extra: 'Failed to enable monitoring',
                });
              }
            },
          });
          return;
        }
      }

      // Only add scene if it already exists in Whisparr, otherwise show "Monitor" button
      if (existingScene) {
        whisparrScene = existingScene;
      } else {
        // Scene doesn't exist in Whisparr yet, show "Monitor" button to let user add it
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
              whisparrScene = await ensureSceneAddedAsMonitored(stashId);
              
              // Check status after adding
              if (whisparrScene.hasFile) {
                const localStashSceneId = await getLocalStashSceneId(whisparrScene);
                const stashUrl = `${localStashRootUrl}/scenes/${localStashSceneId}`;
                updateStatus({
                  button: `${icons.play}<span>Play</span>`,
                  className: 'btn-play',
                  extra: '',
                  onClick: () => {
                    const newWindow = window.open(stashUrl, '_blank');
                    if (newWindow) {
                      newWindow.focus();
                    } else {
                      console.warn('Failed to open Stash scene. Check popup blocker.');
                    }
                  },
                });
              } else {
                updateStatusToMonitored();
              }
            } catch (error) {
              console.error('Error adding scene to Whisparr:', error);
              updateStatus({
                button: `${icons.error}<span>Error</span>`,
                className: 'btn-error',
                extra: 'Failed to add scene to Whisparr',
              });
            }
          },
        });
        return;
      }
    } catch (error) {
      console.error('Error checking scene in Whisparr:', error);
      updateStatus({
        button: `${icons.error}<span>Error</span>`,
        className: 'btn-error',
        extra: 'Error checking scene in Whisparr',
      });
      throw error;
    }

    // Now handle scenes that exist in Whisparr
    if (!whisparrScene) {
      return; // Should not happen, but safety check
    }

    /**
     * Updates button to show scene is currently monitored
     * Click action: Disables monitoring for the scene
     */
    function updateStatusToMonitored() {
      updateStatus({
        button: `${icons.monitor}<span>Monitored</span>`,
        className: 'btn-monitor',
        extra: '',
        onClick: async () => {
          // Disable monitoring
          if (!whisparrScene || !whisparrScene.id) {
            console.error('Cannot toggle monitoring: scene not found');
            return;
          }

          try {
            whisparrScene = await monitorScene(false, whisparrScene);
            updateStatusToUnmonitored();
          } catch (error) {
            console.error('Error disabling monitoring:', error);
          }
        },
      });
    }

    /**
     * Updates button to show scene is currently unmonitored
     * Click action: Enables monitoring for the scene
     */
    function updateStatusToUnmonitored() {
      updateStatus({
        button: `${icons.monitorOff}<span>Monitor</span>`,
        className: 'btn-monitor',
        extra: '',
        onClick: async () => {
          // Enable monitoring
          if (!whisparrScene || !whisparrScene.id) {
            // Scene doesn't exist yet, add it as monitored
            try {
              whisparrScene = await ensureSceneAddedAsMonitored(stashId);
              updateStatusToMonitored();
              return;
            } catch (error) {
              console.error('Error adding scene as monitored:', error);
              return;
            }
          }

          // Scene exists, enable monitoring
          try {
            whisparrScene = await monitorScene(true, whisparrScene);
            updateStatusToMonitored();
          } catch (error) {
            console.error('Error enabling monitoring:', error);
          }
        },
      });
    }

    if (whisparrScene.hasFile) {
      const localStashSceneId = await getLocalStashSceneId(whisparrScene);
      const stashUrl = `${localStashRootUrl}/scenes/${localStashSceneId}`;
      updateStatus({
        button: `${icons.play}<span>Play</span>`,
        className: 'btn-play',
        extra: '',
        onClick: () => {
          const newWindow = window.open(stashUrl, '_blank');
          if (newWindow) {
            newWindow.focus();
          } else {
            console.warn('Failed to open Stash scene. Check popup blocker.');
          }
        },
      });
      return;
    } else if (whisparrScene.queueStatus) {
      updateStatus({
        button: `${icons.loading}<span>Downloading</span>`,
        className: 'btn-loading',
        extra: '',
      });
      if (whisparrScene.id) {
        startQueueProgressPolling(whisparrScene.id, updateStatus);
      }
      return;
    } else if (whisparrScene.monitored) {
      // Double-check live queue even if queueStatus wasn't attached earlier
      try {
        const queue = await fetchWhisparr('/queue/details?all=true');
        const qItem = queue.find((q) => q.movieId === whisparrScene.id);
        if (qItem) {
          updateStatus({
            button: `${icons.loading}<span>Downloading</span>`,
            className: 'btn-loading',
            extra: '',
          });
          if (whisparrScene.id) {
            startQueueProgressPolling(whisparrScene.id, updateStatus);
          }
          return;
        }
      } catch (e) {
        // ignore errors and fall back to monitored state
      }
      updateStatusToMonitored();
      return;
    }

    let fileDownloadAvailability;

    updateStatus({
      button: `${icons.loading}<span>Checking download availability...</span>`,
      className: 'btn-loading',
      extra: '',
    });

    try {
      fileDownloadAvailability = await getFileDownloadAvailability(whisparrScene);
    } catch (error) {
      console.error('Error checking if scene available for download:', error);
      updateStatus({
        button: `${icons.error}<span>Error</span>`,
        className: 'btn-error',
        extra: 'Error checking download availability',
      });
      throw error;
    }

    switch (fileDownloadAvailability) {
      case 'available for download':
        updateStatus({
          button: `${icons.download}<span>Download</span>`,
          className: 'btn-download',
          extra: '',
          onClick: async () => {
            updateStatus({
              button: `${icons.loading}<span>Downloading</span>`,
              className: 'btn-loading',
              extra: 'Searching Whisparr for releases...',
              onClick: () => {},
            });
            await downloadVideo(whisparrScene);
            updateStatus({
              button: `${icons.loading}<span>Downloading</span>`,
              className: 'btn-loading',
              extra: '',
            });
            if (whisparrScene.id) {
              startQueueProgressPolling(whisparrScene.id, updateStatus);
            }
          },
        });
        break;
      case 'already downloading':
        updateStatus({
          button: `${icons.loading}<span>Downloading</span>`,
          className: 'btn-loading',
          extra: '',
        });
        if (whisparrScene.id) {
          startQueueProgressPolling(whisparrScene.id, updateStatus);
        }
        break;
      case 'not available for download':
        updateStatusToUnmonitored();
        break;
      default:
        updateStatus({
          button: `${icons.error}<span>Unknown</span>`,
          className: 'btn-error',
          extra: 'Unknown file availability',
        });
    }
  }

  /**
   * Fetches a scene from Whisparr by stashId and adds queue status if no file exists
   * @param {string} stashId - The StashDB scene ID
   * @returns {Promise<Object|null>} The Whisparr scene object or null if not found
   */
  async function fetchSceneWithQueueStatus(stashId) {
    const scenes = await fetchWhisparr('/movie');
    const scene = scenes.find((s) => s.stashId === stashId);
    
    if (scene && !scene.hasFile) {
      const queue = await fetchWhisparr('/queue/details?all=true');
      scene.queueStatus = queue.find((queueItem) => queueItem.movieId === scene.id);
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
      return await fetchWhisparr('/movie', {
        body: {
          addOptions: {
            monitor: 'none',
            searchForMovie: false,
          },
          foreignId: stashId,
          monitored: false,
          qualityProfileId: DEFAULT_QUALITY_PROFILE_ID,
          rootFolderPath: whisparrRootFolderPath,
          stashId,
          tags: [],
          title: 'added via stashdb extension',
        },
      });
    } catch (error) {
      console.error('Error adding scene to Whisparr:', error);
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
      const newScene = await fetchWhisparr('/movie', {
        body: {
          addOptions: {
            monitor: 'none',
            searchForMovie: false,
          },
          foreignId: stashId,
          monitored: true,
          qualityProfileId: DEFAULT_QUALITY_PROFILE_ID,
          rootFolderPath: whisparrRootFolderPath,
          stashId,
          tags: [],
          title: 'added via stashdb extension',
        },
      });

      // Trigger MoviesSearch after delay for the newly added monitored scene
      setTimeout(async () => {
        try {
          await triggerMoviesSearch([newScene.id]);
        } catch (error) {
          console.error('Failed to trigger MoviesSearch for new scene:', error);
        }
      }, SEARCH_TRIGGER_DELAY_MS);

      return newScene;
    } catch (error) {
      console.error('Error adding monitored scene to Whisparr:', error);
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
      console.error('Error triggering movies search:', error);
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
          console.error('Failed to trigger MoviesSearch after enabling monitoring:', error);
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
    } if (
      releases.some((release) =>
        release.rejections.some((rejection) =>
          rejection.startsWith('Release in queue already')
        )
      )
    ) {
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
      const scene = stashRes.data.findScenes.scenes[0];
      if (scene) {
        return scene.id;
      }
    } catch (error) {
      console.warn('Stash search by URL failed:', error);
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
      const scene = stashRes.data.findScenes.scenes[0];
      if (scene) {
        return scene.id;
      }
    } catch (error) {
      console.warn('Stash search by stash_id field failed:', error);
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
      console.error('Error getting local Stash scene ID:', error);
      return undefined;
    }
  }

  const fetchWhisparr = factoryFetchApi(
    `${whisparrBaseUrl}/api/v3/`, 
    { 'X-Api-Key': whisparrApiKey },
    config.whisparrNeedsCloudflare
  );

  /**
   * Executes a GraphQL query against the local Stash instance
   * @param {Object} request - GraphQL request object with query and variables
   * @returns {Promise<Object>} GraphQL response
   */
  async function localStashGraphQl(request) {
    const fetchLocalStash = factoryFetchApi(
      localStashGraphQlEndpoint, 
      localStashAuthHeaders,
      config.stashNeedsCloudflare
    );
    return fetchLocalStash('', { body: request });
  }

  /**
   * Factory function for creating fetch API wrappers
   * @param {string} baseUrl - Base URL for API requests
   * @param {Object} defaultHeaders - Default headers to include in requests
   * @param {boolean} addCloudflareHeaders - Whether to add Cloudflare Zero Trust headers
   * @returns {Function} Fetch wrapper function
   */
  function factoryFetchApi(baseUrl, defaultHeaders, addCloudflareHeaders = false) {
    return async (subPath, options = {}) => {
      // Build headers with proper priority order
      const headers = {
        ...defaultHeaders,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options?.headers || {}),
      };
      
      // Add Cloudflare Zero Trust headers only if requested
      if (addCloudflareHeaders) {
        if (cfAccessClientId) {
          headers['CF-Access-Client-Id'] = cfAccessClientId;
        }
        if (cfAccessClientSecret) {
          headers['CF-Access-Client-Secret'] = cfAccessClientSecret;
        }
      }
      
      const res = await fetch(new URL(subPath.replace(/^\/*/g, ''), baseUrl), {
        method: options.body ? 'POST' : options.method || 'GET',
        mode: 'cors',
        credentials: 'omit',
        ...options,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        headers,
      });
      if (!res.ok) {
        let body;
        try {
          body = await res.json();
        } catch (error) {
          console.warn('Failed to parse error response body:', error);
        }
        const error = new Error(`HTTP ${res.status}: ${res.statusText}`);
        error.statusCode = res.status;
        error.resBody = body;
        throw error;
      }
      return res.json();
    };
  }
}());
