# Stasharr Config

Configuration files and scripts for integrating StashDB with Whisparr and Stash media management systems.

## Overview

This repository contains tools and configurations for managing adult content libraries using:
- **StashDB** - Community database for adult content metadata
- **Whisparr** - Automated download manager for adult content
- **Stash** - Self-hosted media management system

## Files

### `Stasharr.js`
A Tampermonkey userscript that adds download functionality to StashDB.org pages. This script:

- **Adds download buttons** to scene pages on StashDB
- **Integrates with Whisparr v3** for automated downloading
- **Connects to local Stash instance** for playback
- **Provides real-time status updates** (Download, Monitored, Playing, etc.)

#### Features:
- One-click scene addition to Whisparr
- Monitor/unmonitor scenes
- Direct playback through local Stash instance
- Queue status tracking
- Modern UI with loading states and error handling

#### Configuration:
Update these variables in the script:
```javascript
const whisparrBaseUrl = 'http://localhost:6969' // Your Whisparr URL
const whisparrApiKey = "your-api-key" // Whisparr API key
const whisparrNewSiteTags = [1] // Tags for new scenes
const whisparrRootFolderPath = "/data/" // Download path
const localStashRootUrl = 'http://localhost:9999' // Your Stash URL
const localStashAuthHeaders = {'ApiKey': 'your-stash-api-key'} // Stash API key
```

### `StashIdentifier.ps1`
PowerShell script for automated metadata management in Stash:

- **Metadata identification** from StashDB
- **Metadata cleaning** and organization
- **Batch processing** of scenes

#### Features:
- Fetches metadata from StashDB GraphQL endpoint
- Updates titles, tags, dates, details, performers, and studios
- Sets cover images and organizes scenes
- Configurable field strategies (OVERWRITE/MERGE)

#### Usage:
```powershell
.\StashIdentifier.ps1
```

## Setup Instructions

### Prerequisites
1. **Whisparr v3** running on `http://localhost:6969`
2. **Stash** running on `http://localhost:9999`
3. **Tampermonkey** browser extension
4. **PowerShell** (for metadata script)

### Installation

1. **Install the userscript:**
   - Copy `Stasharr.js` content
   - Create new script in Tampermonkey
   - Paste and save

2. **Configure API keys:**
   - Get Whisparr API key from Settings → General
   - Get Stash API key from Settings → Security
   - Update both scripts with your credentials

3. **Set up paths:**
   - Configure Whisparr root folder path
   - Ensure Stash can access downloaded content

### Usage

1. **Browse StashDB** with the userscript installed
2. **Click download buttons** on scene pages to add to Whisparr
3. **Monitor downloads** through Whisparr interface
4. **Play content** directly through Stash when downloaded
5. **Run metadata script** periodically to update scene information

## Configuration Notes

- **API Keys**: Keep your API keys secure and don't share them
- **Network Access**: Ensure Whisparr and Stash are accessible from your browser
- **File Paths**: Configure paths according to your system setup
- **Tags**: Customize tag IDs based on your Whisparr configuration

## Contributing

Feel free to contribute to this project by:
- Submitting issues for bugs or feature requests
- Creating pull requests with improvements
- Sharing configuration examples

## License

This project is for personal use. Please respect the terms of service of StashDB, Whisparr, and Stash.
