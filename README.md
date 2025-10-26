# Stasharr

Tampermonkey script for StashDB integration with Whisparr and Stash.

## What

Adds download/monitor/play buttons to StashDB scene pages. Auto-checks if scenes exist in local Stash or are available in Whisparr.

## Setup

1. Install Tampermonkey
2. Add `Stasharr.js` to Tampermonkey
3. Visit StashDB.org → Click any scene
4. Click **Settings** button → Configure:
   - Whisparr URL + API key
   - Stash URL + API key
   - Root folder path
   - Tag IDs for new scenes

## Usage

Browse StashDB scenes, buttons show:
- **Play** - Scene exists in local Stash
- **Download** - Available to download via Whisparr
- **Monitor** - Enable monitoring (auto-triggers search)
- **Monitored** - Already being monitored
- **Downloading** - Currently in queue

---

*Code is AI generated*
