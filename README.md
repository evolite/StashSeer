# Stasharr Config

My personal scripts for managing adult content with StashDB + Whisparr + Stash.

## What This Does

- **Stasharr.js** - Tampermonkey script that adds download buttons to StashDB pages
- **StashIdentifier.ps1** - PowerShell script to update Stash metadata from StashDB

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

3. **For browser script:** Copy `Stasharr.js` into Tampermonkey and update the hardcoded values at the top

## How It Works

### Stasharr.js (Browser Script)
- Runs on StashDB.org pages
- Adds download/monitor/play buttons to scene pages
- Connects to local Whisparr (port 6969) and Stash (port 9999)
- Shows real-time status: Download → Monitored → Playing

### StashIdentifier.ps1 (Metadata Script)
- Fetches metadata from StashDB GraphQL
- Updates titles, tags, performers, studios in Stash
- Run this periodically to keep metadata fresh

## My Config

- **Whisparr:** `http://localhost:6969` (API key in .env)
- **Stash:** `http://localhost:9999` (API key in .env)
- **Download path:** `/data/`
- **Tags:** ID 1 for new scenes

## Notes

- `.env` file is gitignored so API keys don't get committed
- Browser script needs manual config since browsers can't read .env files
- PowerShell script auto-loads .env if present
- Both scripts have fallback values if env vars aren't set
