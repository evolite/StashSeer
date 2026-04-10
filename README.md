# StashSeer

Tampermonkey script for StashDB integration with Whisparr and Stash.

## What

Adds download/monitor/play buttons to StashDB scene pages. Auto-checks if scenes exist in local Stash or are available in Whisparr.

<img width="387" height="47" alt="image" src="https://github.com/user-attachments/assets/78c11c47-ca63-4d04-840a-c88a70dc0336" />

## Usage

Browse StashDB scenes, buttons show:
- **Play** - Scene exists in local Stash
- **Download** - Available to download via Whisparr
- **Monitor** - Enable monitoring (auto-triggers search)
- **Monitored** - Already being monitored
- **Downloading** - Currently in queue
- **Previously Added** - Scene was added to Whisparr but file was deleted in Stash (aslong as "Unmonitor Deleted Movies" is set) (click to re-monitor) 

   <img width="761" height="107" alt="image" src="https://github.com/user-attachments/assets/de1f687c-8fd8-470b-8115-2ffd15ab5803" />


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
