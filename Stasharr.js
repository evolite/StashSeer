// ==UserScript==
// @name         StashBox - Whisparr v3
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  try to take over the world!
// @author       You
// @match        https://stashdb.org/
// @match        https://stashdb.org/*
// @icon.disabled         https://www.google.com/s2/favicons?sz=64&domain=stashdb.org
// @updateURL
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

// Configuration - Uses Tampermonkey storage API
// First time setup: Click the Settings button to configure your API keys
// Values persist across browser sessions

function getConfig() {
  return {
    whisparrBaseUrl: GM_getValue('whisparrBaseUrl', 'http://localhost:6969'),
    whisparrApiKey: GM_getValue('whisparrApiKey', ''),
    whisparrNewSiteTags: GM_getValue('whisparrNewSiteTags', [1]),
    whisparrRootFolderPath: GM_getValue('whisparrRootFolderPath', '/data/'),
    localStashRootUrl: GM_getValue('localStashRootUrl', 'http://localhost:9999'),
    stashApiKey: GM_getValue('stashApiKey', '')
  }
}

function setConfig(config) {
  GM_setValue('whisparrBaseUrl', config.whisparrBaseUrl)
  GM_setValue('whisparrApiKey', config.whisparrApiKey)
  GM_setValue('whisparrNewSiteTags', config.whisparrNewSiteTags)
  GM_setValue('whisparrRootFolderPath', config.whisparrRootFolderPath)
  GM_setValue('localStashRootUrl', config.localStashRootUrl)
  GM_setValue('stashApiKey', config.stashApiKey)
}

// Get current configuration
const config = getConfig()
const whisparrBaseUrl = config.whisparrBaseUrl
const whisparrApiKey = config.whisparrApiKey
const whisparrNewSiteTags = config.whisparrNewSiteTags
const whisparrRootFolderPath = config.whisparrRootFolderPath
const localStashRootUrl = config.localStashRootUrl
const localStashGraphQlEndpoint = localStashRootUrl + '/graphql'
const localStashAuthHeaders = {'ApiKey': config.stashApiKey}

;(async function() {
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

img {
  //filter: blur(4px);
}
`);

// SVG Icons
const icons = {
  download: `<svg viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`,
  play: `<svg viewBox="0 0 16 16"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>`,
  loading: `<svg viewBox="0 0 16 16"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/></svg>`,
  monitor: `<svg viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>`,
  monitorOff: `<svg viewBox="0 0 16 16"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/></svg>`,
  error: `<svg viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>`,
  check: `<svg viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.267.267 0 0 1 .02-.022z"/></svg>`,
  whisparr: `<svg viewBox="0 0 16 16"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2z"/><path d="M8 4a.5.5 0 0 1 .5.5V6a.5.5 0 0 1-1 0V4.5A.5.5 0 0 1 8 4zM3.732 5.732a.5.5 0 0 1 .707 0l.915.914a.5.5 0 1 1-.708.708l-.914-.915a.5.5 0 0 1 0-.707zM2 10a.5.5 0 0 1 .5-.5h1.586a.5.5 0 0 1 0 1H2.5A.5.5 0 0 1 2 10zm9.5 0a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 0 1H12a.5.5 0 0 1-.5-.5zm.754-4.246a.389.389 0 0 0-.527-.02L7.547 9.31a.91.91 0 1 0 1.302 1.258l3.434-4.297a.389.389 0 0 0-.029-.518z"/></svg>`,
  settings: `<svg viewBox="0 0 16 16"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/></svg>`
};

function createButton() {
  const containerElm = document.createElement("div");
  const dlButtonElm = document.createElement("button");
  const whisparrButtonElm = document.createElement("button");
  const settingsButtonElm = document.createElement("button");
  const statusElm = document.createElement("span");
  containerElm.classList.add("downloadInWhisparr")
  dlButtonElm.innerHTML = `${icons.loading}<span>Loading...</span>`
  dlButtonElm.classList.add("btn-loading")
  
  // Add Whisparr button
  whisparrButtonElm.innerHTML = `${icons.whisparr}<span>Whisparr</span>`
  whisparrButtonElm.classList.add("btn-whisparr")
  whisparrButtonElm.addEventListener("click", () => {
    window.open(whisparrBaseUrl, '_blank').focus()
  })

  // Add Settings button
  settingsButtonElm.innerHTML = `${icons.settings}<span>Settings</span>`
  settingsButtonElm.classList.add("btn-settings")
  settingsButtonElm.addEventListener("click", () => {
    showSettingsDialog()
  })

  let lastOnClickValue

  function updateStatus(newStatus) {
    if (typeof newStatus === "string") {
      statusElm.innerHTML = newStatus
    } else {
      if (typeof newStatus.button !== "undefined") {
        dlButtonElm.innerHTML = newStatus.button
      }
      if (typeof newStatus.className !== "undefined") {
        dlButtonElm.className = newStatus.className
      }
      if (typeof newStatus.extra !== "undefined") {
        statusElm.innerHTML = newStatus.extra
      }
      if (typeof newStatus.onClick !== "undefined") {
        if (lastOnClickValue) {
          dlButtonElm.removeEventListener("click", lastOnClickValue)
        }
        dlButtonElm.addEventListener("click", newStatus.onClick)
        lastOnClickValue = newStatus.onClick
      }
    }
  }

  updateStatus("Loading...")
  containerElm.appendChild(dlButtonElm)
  containerElm.appendChild(whisparrButtonElm)
  containerElm.appendChild(settingsButtonElm)
  containerElm.appendChild(statusElm)
  return {downloadElm: containerElm, updateStatus}
}

function showSettingsDialog() {
  const currentConfig = getConfig()
  
  const dialog = document.createElement('div')
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
  `
  
  const content = document.createElement('div')
  content.style.cssText = `
    background: #2d3748;
    padding: 2rem;
    border-radius: 0.5rem;
    max-width: 500px;
    width: 90%;
    color: white;
  `
  
  content.innerHTML = `
    <h3 style="margin-top: 0; color: #4d9fff;">Stasharr Settings</h3>
    <form id="settingsForm">
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Whisparr Base URL:</label>
        <input type="text" name="whisparrBaseUrl" value="${currentConfig.whisparrBaseUrl}" 
               style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Whisparr API Key:</label>
        <input type="password" name="whisparrApiKey" value="${currentConfig.whisparrApiKey}" 
               style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Stash Root URL:</label>
        <input type="text" name="localStashRootUrl" value="${currentConfig.localStashRootUrl}" 
               style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Stash API Key:</label>
        <input type="password" name="stashApiKey" value="${currentConfig.stashApiKey}" 
               style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Root Folder Path:</label>
        <input type="text" name="whisparrRootFolderPath" value="${currentConfig.whisparrRootFolderPath}" 
               style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">New Site Tags (comma-separated):</label>
        <input type="text" name="whisparrNewSiteTags" value="${currentConfig.whisparrNewSiteTags.join(',')}" 
               style="width: 100%; padding: 0.5rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #1a202c; color: white;">
      </div>
      <div style="display: flex; gap: 1rem; justify-content: flex-end;">
        <button type="button" id="cancelBtn" style="padding: 0.5rem 1rem; border: 1px solid #4a5568; border-radius: 0.25rem; background: #4a5568; color: white; cursor: pointer;">Cancel</button>
        <button type="submit" style="padding: 0.5rem 1rem; border: 1px solid #4d9fff; border-radius: 0.25rem; background: #4d9fff; color: white; cursor: pointer;">Save</button>
      </div>
    </form>
  `
  
  dialog.appendChild(content)
  document.body.appendChild(dialog)
  
  const form = content.querySelector('#settingsForm')
  const cancelBtn = content.querySelector('#cancelBtn')
  
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const formData = new FormData(form)
    const newConfig = {
      whisparrBaseUrl: formData.get('whisparrBaseUrl'),
      whisparrApiKey: formData.get('whisparrApiKey'),
      localStashRootUrl: formData.get('localStashRootUrl'),
      stashApiKey: formData.get('stashApiKey'),
      whisparrRootFolderPath: formData.get('whisparrRootFolderPath'),
      whisparrNewSiteTags: formData.get('whisparrNewSiteTags').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    }
    setConfig(newConfig)
    document.body.removeChild(dialog)
    alert('Settings saved! Refresh the page to apply changes.')
  })
  
  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(dialog)
  })
  
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      document.body.removeChild(dialog)
    }
  })
}

async function addButtonToScenePage(downloadElm) {
  let parentElement

  while (!parentElement) {
      parentElement = document.querySelector(".NarrowPage > .nav-tabs")
      await new Promise(resolve => setTimeout(resolve, 50))
  }

  parentElement.appendChild(downloadElm)
}

let observer = new MutationObserver(async function(mutations) {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            console.log("added node")
            if (node.nodeType === 1 && (node.classList.contains("scene-info"))) {
              console.log("🎬 Stasharr script activated - scene page detected")
              console.log("added scene node")
              const {downloadElm, updateStatus} = createButton()
              await addButtonToScenePage(downloadElm)
              const stashId = location.pathname.split("/")[2]
              console.log("Extracted stashId from URL:", stashId)
              await checkIfAvaliable(stashId, updateStatus)
            }
        }

    }
});

const config = {subtree: true, childList: true};
observer.observe(document, config);

async function checkIfAvaliable(stashId, updateStatus) {
    let whisparrScene
    
    console.log("=== Starting checkIfAvaliable for stashId:", stashId, "===")
    
    // First check if scene already exists in Stash
    updateStatus({
      button: `${icons.loading}<span>Checking Stash...</span>`,
      className: "btn-loading",
      extra: ``
    })

    console.log("Checking Stash first for stashId:", stashId)
    const localStashSceneId = await getLocalStashSceneIdByStashId(stashId)
    console.log("Stash scene ID found:", localStashSceneId)
    if (localStashSceneId) {
      const stashUrl = `${localStashRootUrl}/scenes/${localStashSceneId}`
      console.log("Scene found in Stash, showing Play button:", stashUrl)
      updateStatus({
          button: `${icons.play}<span>Play</span>`,
          className: "btn-play",
          extra: "",
          onClick: () => window.open(stashUrl, '_blank').focus()
      })
      return
    }

    // If not in Stash, check Whisparr
    updateStatus({
      button: `${icons.loading}<span>Checking Whisparr...</span>`,
      className: "btn-loading",
      extra: ``
    })

    try {
      console.log("Connecting to Whisparr...")
      whisparrScene = await ensureSceneAdded(stashId)
      console.log("✅ Whisparr connection successful, scene:", whisparrScene)
    } catch(error) {
      console.error("❌ Whisparr connection failed:", error)
      updateStatus({
        button: `${icons.error}<span>Error</span>`,
        className: "btn-error",
        extra: `Error adding scene in Whisparr`
      })
      throw error
    }

    function updateStatusToMonitored() {
      updateStatus({
          button: `${icons.monitor}<span>Monitored</span>`,
          className: "btn-monitor",
          extra: "",
          onClick: async () => {
            // If scene doesn't exist in Whisparr yet, add it as monitored
            if (!whisparrScene || !whisparrScene.id) {
              try {
                whisparrScene = await ensureSceneAddedAsMonitored(stashId)
                updateStatusToMonitored()
                return
              } catch (error) {
                console.error("Error adding scene as monitored:", error)
                return
              }
            }
            
            // If scene exists, toggle monitoring
            whisparrScene = await monitorScene(true, whisparrScene)
            updateStatusToMonitored()
          }
      })
    }

    function updateStatusToUnmonitored() {
        updateStatus({
          button: `${icons.monitorOff}<span>Monitor</span>`,
          className: "btn-monitor",
          extra: "",
          onClick: async () => {
            // If scene doesn't exist in Whisparr yet, add it as monitored
            if (!whisparrScene || !whisparrScene.id) {
              try {
                whisparrScene = await ensureSceneAddedAsMonitored(stashId)
                updateStatusToMonitored()
                return
              } catch (error) {
                console.error("Error adding scene as monitored:", error)
                return
              }
            }
            
            // If scene exists, toggle monitoring
            whisparrScene = await monitorScene(true, whisparrScene)
            updateStatusToMonitored()
          }
        })
    }

    if (whisparrScene.hasFile) {
      const localStashSceneId = await getLocalStashSceneId(whisparrScene)
      const stashUrl = `${localStashRootUrl}/scenes/${localStashSceneId}`
      updateStatus({
          button: `${icons.play}<span>Play</span>`,
          className: "btn-play",
          extra: "",
          onClick: () => window.open(stashUrl, '_blank').focus()
      })
      return
    } else if (whisparrScene.monitored) {
      updateStatusToMonitored()
      return
    } else if (whisparrScene.queueStatus) {
      updateStatus({
        button: `${icons.loading}<span>Downloading</span>`,
        className: "btn-loading",
        extra: `View <a href="${whisparrBaseUrl}/activity/queue">queue</a>`
      })
      return
    }

    let fileDownloadAvailablity

    updateStatus({
      button: `${icons.loading}<span>Checking...</span>`,
      className: "btn-loading",
      extra: ``
    })

    try {
      fileDownloadAvailablity = await getFileDownloadAvailablity(whisparrScene)
    } catch(error) {
      updateStatus({
        button: `${icons.error}<span>Error</span>`,
        className: "btn-error",
        extra: `Error checking if scene available for download`
      })
      throw error
    }

    switch (fileDownloadAvailablity) {
      case "available for download":
        updateStatus({
          button: `${icons.download}<span>Download</span>`,
          className: "btn-download",
          extra: "",
          onClick: async () => {
            updateStatus({
              button: `${icons.loading}<span>Downloading</span>`,
              className: "btn-loading",
              extra: "Adding to download queue...",
              onClick: () => {}
            })
            await downloadVideo(whisparrScene)
            updateStatus({
              extra: `Added to <a href="${whisparrBaseUrl}/activity/queue">download queue</a>.`
            })
          }
        })
        break;
      case "already downloading":
        updateStatus({
          button: `${icons.loading}<span>Downloading</span>`,
          className: "btn-loading",
          extra: `View <a href="${whisparrBaseUrl}/activity/queue">queue</a>`
        })
        break;
      case "not available for download":
        updateStatusToUnmonitored()
        break;
      default:
        updateStatus({
          button: `${icons.error}<span>Unknown</span>`,
          className: "btn-error",
          extra: "Unknown file availability"
        })
    }
}

function updateStatusToMonitored() {
      updateStatus({
          button: `${icons.monitor}<span>Monitored</span>`,
          className: "btn-monitor",
          extra: "",
          onClick: async () => {
            whisparrScene = await monitorScene(false, whisparrScene)
            updateStatusToUnmonitored()
          }
      })
    }

    function updateStatusToUnmonitored() {
        updateStatus({
          button: `${icons.monitorOff}<span>Monitor</span>`,
          className: "btn-monitor",
          extra: "",
          onClick: async () => {
            // If scene doesn't exist in Whisparr yet, add it as monitored
            if (!whisparrScene || !whisparrScene.id) {
              try {
                whisparrScene = await ensureSceneAddedAsMonitored(stashId)
                updateStatusToMonitored()
                return
              } catch (error) {
                console.error("Error adding scene as monitored:", error)
                return
              }
            }
            
            // If scene exists, toggle monitoring
            whisparrScene = await monitorScene(true, whisparrScene)
            updateStatusToMonitored()
          }
        })

    }

    if (whisparrScene.hasFile) {
      const localStashSceneId = await getLocalStashSceneId(whisparrScene)
      const stashUrl = `${localStashRootUrl}/scenes/${localStashSceneId}`
      updateStatus({
          button: `${icons.play}<span>Play</span>`,
          className: "btn-play",
          extra: "",
          onClick: () => window.open(stashUrl, '_blank').focus()
      })
      return
    } else if (whisparrScene.monitored) {
      updateStatusToMonitored()
      return
    } else if (whisparrScene.queueStatus) {
      updateStatus({
        button: `${icons.loading}<span>Downloading</span>`,
        className: "btn-loading",
        extra: `View <a href="${whisparrBaseUrl}/activity/queue">queue</a>`
      })
      return
    }

    let fileDownloadAvailablity

    updateStatus({
      button: `${icons.loading}<span>Checking...</span>`,
      className: "btn-loading",
      extra: ``
    })

    try {
      fileDownloadAvailablity = await getFileDownloadAvailablity(whisparrScene)
    } catch(error) {
      updateStatus({
        button: `${icons.error}<span>Error</span>`,
        className: "btn-error",
        extra: `Error checking if scene available for download`
      })
      throw error
    }

    switch (fileDownloadAvailablity) {
      case "available for download":
        updateStatus({
          button: `${icons.download}<span>Download</span>`,
          className: "btn-download",
          extra: "",
          onClick: async () => {
            updateStatus({
              button: `${icons.loading}<span>Adding...</span>`,
              className: "btn-loading",
              extra: "",
              onClick: () => {}
            })
            await downloadVideo(whisparrScene)
            updateStatus({
              button: `${icons.check}<span>Queued</span>`,
              className: "btn-download",
              extra: `View <a href="${whisparrBaseUrl}/activity/queue">queue</a>`
            })
          }
        })
        break;
      case "already downloading":
        updateStatus({
          button: `${icons.loading}<span>Downloading</span>`,
          className: "btn-loading",
          extra: `View <a href="${whisparrBaseUrl}/activity/queue">queue</a>`
        })
        break;
      case "not available for download":
        updateStatusToUnmonitored()
        break;
      default:
        updateStatus({
          button: `${icons.error}<span>Unknown</span>`,
          className: "btn-error",
          extra: "Unknown file availability"
        })
    }
}

async function ensureSceneAdded(stashId) {
  const scenes = await fetchWhisparr("/movie")
  const scene = scenes.find(scene => scene.stashId === stashId)
  if (scene) {
    if (!scene.hasFile) {
      const queue = await fetchWhisparr("/queue/details?all=true")
      scene.queueStatus = queue.find(queueItem => queueItem.movieId === scene.id)
    }
    return scene
  }

  try {
    return await fetchWhisparr(
      "/movie",
      {
        body: {
          addOptions: {
              monitor: "none",
              searchForMovie: false,
          },
          foreignId: stashId,
          monitored:	false,
          qualityProfileId: 1,
          rootFolderPath: whisparrRootFolderPath,
          stashId: stashId,
          tags: whisparrNewSiteTags,
          title: "added via stashdb extention",
        }
      }
    );
  } catch(error) {
    console.error(error.statusCode, error.resBody)
    throw error
  }
}

async function ensureSceneAddedAsMonitored(stashId) {
  const scenes = await fetchWhisparr("/movie")
  const scene = scenes.find(scene => scene.stashId === stashId)
  if (scene) {
    if (!scene.hasFile) {
      const queue = await fetchWhisparr("/queue/details?all=true")
      scene.queueStatus = queue.find(queueItem => queueItem.movieId === scene.id)
    }
    return scene
  }

  try {
    const newScene = await fetchWhisparr(
      "/movie",
      {
        body: {
          addOptions: {
              monitor: "none",
              searchForMovie: false,
          },
          foreignId: stashId,
          monitored: true,
          qualityProfileId: 1,
          rootFolderPath: whisparrRootFolderPath,
          stashId: stashId,
          tags: whisparrNewSiteTags,
          title: "added via stashdb extention",
        }
      }
    );
    
    // Trigger MoviesSearch after 5 seconds for the newly added monitored scene
    setTimeout(async () => {
      try {
        await triggerMoviesSearch([newScene.id]);
        console.log(`MoviesSearch triggered for newly added monitored movie ${newScene.id} (5s delay)`);
      } catch (error) {
        console.error("Failed to trigger MoviesSearch for new scene:", error);
      }
    }, 5000);
    
    return newScene;
  } catch(error) {
    console.error(error.statusCode, error.resBody)
    throw error
  }
}

async function triggerMoviesSearch(movieIds = null) {
  try {
    const commandBody = {
      name: "MoviesSearch"
    };
    
    // If specific movie IDs are provided, search only those movies
    if (movieIds && movieIds.length > 0) {
      commandBody.movieIds = movieIds;
    }
    
    const response = await fetchWhisparr("/command", {
      body: commandBody
    });
    console.log("MoviesSearch command triggered:", response);
    return response;
  } catch (error) {
    console.error("Error triggering MoviesSearch:", error);
    throw error;
  }
}

async function monitorScene(monitor, whisparrScene) {
  const result = await fetchWhisparr(
    `/movie/${whisparrScene.id}`,
    {
      method: "PUT",
      body: {
        foreignId: whisparrScene.foreignId,
        monitored: monitor,
        qualityProfileId: whisparrScene.qualityProfileId,
        rootFolderPath:	whisparrScene.rootFolderPath,
        stashId: whisparrScene.stashId,
        title: whisparrScene.title,
        path: whisparrScene.path,
        tags: monitor
          ? whisparrScene.tags.filter(tag => !whisparrNewSiteTags.includes(tag))
          : [...whisparrScene.tags, ...whisparrNewSiteTags]
      }
    }
  );

  // If we're enabling monitoring, trigger a MoviesSearch to find missing movies
  if (monitor) {
    // Wait 5 seconds to let Whisparr process the monitoring change
    setTimeout(async () => {
      try {
        await triggerMoviesSearch([whisparrScene.id]);
        console.log(`MoviesSearch triggered for movie ${whisparrScene.id} after enabling monitoring (5s delay)`);
      } catch (error) {
        console.error("Failed to trigger MoviesSearch:", error);
        // Don't throw error here - monitoring was successful, search failure is not critical
      }
    }, 5000);
  }

  return result;
}

async function removeAutoTags(whisparrScene) {
  return await fetchWhisparr(
    `/movie/${whisparrScene.id}`,
    {
      method: "PUT",
      body: {
        foreignId: whisparrScene.foreignId,
        monitored: whisparrScene.monitored,
        qualityProfileId: whisparrScene.qualityProfileId,
        rootFolderPath:	whisparrScene.rootFolderPath,
        stashId: whisparrScene.stashId,
        title: whisparrScene.title,
        path: whisparrScene.path,
        tags: whisparrScene.tags.filter(tag => !whisparrNewSiteTags.includes(tag))
      }
    }
  );
}

async function getFileDownloadAvailablity(whisparrScene) {
  const releases = await fetchWhisparr(`release?movieId=${whisparrScene.id}`);

  if (releases.some(release => release.approved)) {
    return "available for download"
  } else if (
    releases.some(
      release => release.rejections.some(rejection => rejection.startsWith("Release in queue already"))
    )
  ) {
    return "already downloading"
  } else {
    return "not available for download"
  }
}

async function downloadVideo(whisparrScene) {
  await fetchWhisparr(
    "/command",
    {
      body: {
        name: "MoviesSearch",
        movieIds: [whisparrScene.id]
      }
    }
  );
  await removeAutoTags(whisparrScene)
}

async function getLocalStashSceneIdByStashId(stashId) {
  // Try multiple approaches to find the scene in Stash
  
  // First try: Search by stash_id_endpoint
  try {
    const stashRes = await localStashGraphQl({
        "variables": {
          "scene_filter": {
            "stash_id_endpoint": {
              "endpoint": "",
              "modifier": "EQUALS",
              "stash_id": stashId
            }
          }
        },
        query: `
          query ($scene_filter: SceneFilterType) {
            findScenes(scene_filter: $scene_filter) {
              scenes {
                id
                stash_id
              }
            }
          }
        `
      }
    );
    const scene = stashRes.data.findScenes.scenes[0];
    if (scene) {
      return scene.id;
    }
  } catch (error) {
    console.log("Stash search by stash_id_endpoint failed:", error);
  }
  
  // Second try: Search by stash_id field directly
  try {
    const stashRes = await localStashGraphQl({
        "variables": {
          "scene_filter": {
            "stash_id": {
              "modifier": "EQUALS",
              "value": stashId
            }
          }
        },
        query: `
          query ($scene_filter: SceneFilterType) {
            findScenes(scene_filter: $scene_filter) {
              scenes {
                id
                stash_id
              }
            }
          }
        `
      }
    );
    const scene = stashRes.data.findScenes.scenes[0];
    if (scene) {
      return scene.id;
    }
  } catch (error) {
    console.log("Stash search by stash_id field failed:", error);
  }
  
  return null;
}

async function getLocalStashSceneId(whisparrScene) {
  console.log("Querying Stash GraphQL for stashId:", whisparrScene.stashId)
  const stashRes = await localStashGraphQl({
      "variables": {
        "scene_filter": {
          "stash_id_endpoint": {
            "endpoint": "",
            "modifier": "EQUALS",
            "stash_id": whisparrScene.stashId
          }
        }
      },
      query: `
        query ($scene_filter: SceneFilterType) {
          findScenes(scene_filter: $scene_filter) {
            scenes {
              id
            }
          }
        }
      `
  });
  console.log("Stash GraphQL response:", stashRes)
  const sceneId = stashRes.data.findScenes.scenes[0]?.id
  console.log("Extracted scene ID:", sceneId)
  return sceneId
}

const fetchWhisparr = factoryFetchApi(`${whisparrBaseUrl}/api/v3/`, {"X-Api-Key": whisparrApiKey})

async function localStashGraphQl(request) {
  console.log("Making Stash GraphQL request to:", localStashGraphQlEndpoint)
  const fetchLocalStash = factoryFetchApi(localStashGraphQlEndpoint, localStashAuthHeaders)
  const result = await fetchLocalStash("", {body: request})
  console.log("Stash GraphQL request successful:", result)
  return result
}

function factoryFetchApi(baseUrl, defaultHeaders) {
  return async (subPath, options = {}) => {
    const res = await fetch(
      new URL(subPath.replace(/^\/*/,''), baseUrl),
      {
        method: options.body ? "POST" : "GET",
        mode: "cors",
        ...options,
        ...(options.body ? {body: JSON.stringify(options.body)} : {}),
        headers: {
            ...defaultHeaders,
            "X-Api-Key": whisparrApiKey,
            ...(options.body ? {"Content-Type": "application/json"} : {}),
            ...(options?.headers || {})
        },
      }
    )
    if (!res.ok) {
      let body
      try {
        body = await res.json()
      } catch (error) {}
      const error = new Error()
      error.statusCode = res.status
      error.resBody = body
      throw error
    }
    return res.json()
  }
}
})();
