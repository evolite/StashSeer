# Stasharr Config

My personal scripts for managing content with StashDB + Whisparr + Stash.

## What This Does

- **Stasharr.js** - Tampermonkey script that adds download buttons to StashDB pages

## Quick Setup

1. **For browser script:** Copy `Stasharr.js` into Tampermonkey, load stashdb.org and click on a scene then click the Settings button to configure

## How It Works

### Stasharr.js (Browser Script)
- Runs on StashDB.org pages
- Adds download/monitor/play buttons to scene pages
- Connects to local Whisparr (port 6969) and Stash (port 9999)
- Shows real-time status: Download → Monitored → Playing
- Settings button for easy API key configuration
- Automatically triggers MoviesSearch when enabling monitoring

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
4. When you enable monitoring, it automatically searches for missing movies
