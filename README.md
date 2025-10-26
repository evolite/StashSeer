# Stasharr Config

My personal scripts for managing adult content with StashDB + Whisparr + Stash.

## What This Does

- **Stasharr.js** - Tampermonkey script that adds download buttons to StashDB pages
- **WhisparrMissingSearch.ps1** - PowerShell script to search for missing movies in Whisparr

## Quick Setup

1. **Copy config:**
   ```bash
   cp env.example .env
   ```

2. **Edit `.env` with your actual API keys:**
   ```
   WHISPARR_BASE_URL=http://localhost:6969
   WHISPARR_API_KEY=your-whisparr-key
   STASH_ROOT_URL=http://localhost:9999
   STASH_API_KEY=your-stash-key
   ```

3. **For browser script:** Copy `Stasharr.js` into Tampermonkey and click the Settings button to configure

## How It Works

### Stasharr.js (Browser Script)
- Runs on StashDB.org pages
- Adds download/monitor/play buttons to scene pages
- Connects to local Whisparr (port 6969) and Stash (port 9999)
- Shows real-time status: Download → Monitored → Playing
- Settings button for easy API key configuration

### WhisparrMissingSearch.ps1 (Missing Movies Search)
- Searches for missing movies in Whisparr
- Uses Whisparr's MoviesSearch command
- Loads configuration from .env file
- Shows command status and results
- Error handling for API issues

## My Config

- **Whisparr:** `http://localhost:6969` (API key in settings)
- **Stash:** `http://localhost:9999` (API key in settings)
- **Download path:** `/data/`
- **Tags:** ID 1 for new scenes

## Usage

**Browser Script:**
1. Install `Stasharr.js` in Tampermonkey
2. Click Settings button to configure API keys
3. Browse StashDB and use download buttons

**Missing Movies Search:**
```powershell
.\WhisparrMissingSearch.ps1
```

## Notes

- `.env` file is gitignored so API keys don't get committed
- Browser script uses Tampermonkey storage for settings persistence
- PowerShell script auto-loads .env file if present
- Script checks Stash first, then Whisparr if not found
