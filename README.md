# StashSeer

Tampermonkey script for StashDB integration with Whisparr and Stash.

Browsing StashDB scenes and manually managing downloads in Whisparr is tedious; this script adds download/monitor/play buttons directly to StashDB pages so you can manage content without leaving the browser.

## What

Adds download/monitor/play buttons to StashDB scene pages. Auto-checks if scenes exist in local Stash or are available in Whisparr.

## Setup

1. Install Tampermonkey
2. Add `stashseer.js` to Tampermonkey
3. Configure Whisparr: Settings → Media Management → File Management → Enable **Unmonitor Deleted Movies**
4. Visit StashDB.org → Click any scene
5. Click **Settings** button → Configure:
   - Whisparr URL + API key
   - Stash URL + API key
   - Root folder path

## Usage

Browse StashDB scenes, buttons show:
- **Play** - Scene exists in local Stash
- **Download** - Available to download via Whisparr
- **Monitor** - Enable monitoring (auto-triggers search)
- **Monitored** - Already being monitored
- **Downloading** - Currently in queue
- **Previously Added** - Scene was added to Whisparr but file was deleted (click to re-monitor)

---

*Code is AI generated*
