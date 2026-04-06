# StashSeer

Tampermonkey script for StashDB integration with Whisparr and Stash.

## What

Adds download/monitor/play buttons to StashDB scene pages. Auto-checks if scenes exist in local Stash or are available in Whisparr.

## Usage

Browse StashDB scenes, buttons show:
- **Play** - Scene exists in local Stash
- **Download** - Available to download via Whisparr
- **Monitor** - Enable monitoring (auto-triggers search)
- **Monitored** - Already being monitored
- **Downloading** - Currently in queue
- **Previously Added** - Scene was added to Whisparr but file was deleted (click to re-monitor)

## Requirements

- Whisparr v3 (only v3 is supported)
- Tampermonkey browser extension

## Setup

1. Install Tampermonkey
2. Add `stashseer.js` to Tampermonkey
3. Configure Whisparr: Settings → Media Management → File Management → Enable **Unmonitor Deleted Movies**
4. Visit StashDB.org → Click any scene
5. Click **Settings** button → Configure:
   - Whisparr URL + API key
   - Whisparr Root Folder(s) - Select one or more root folders (if multiple, you'll be prompted to choose when adding scenes)
   - Stash URL + API key
   - Cloudflare Zero Trust credentials (if using):
     - CF-Access-Client-Id
     - CF-Access-Client-Secret
     - Enable Cloudflare for Whisparr and/or Stash as needed
6. If using Cloudflare Zero Trust, ensure your application settings allow stashdb.org in CORS settings


---

*Code is AI generated*
