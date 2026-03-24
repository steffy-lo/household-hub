# Household Hub

Household Hub is a shared household planning app for couples, families, roommates, and anyone managing home life together. It combines weekly chore assignments, shared tasks, events, grocery tracking, and a Divoom Pixoo64 display into one lightweight dashboard with real-time sync.

<img width="1302" height="806" alt="Household Hub screenshot" src="https://github.com/user-attachments/assets/a6c5aa19-bbca-457c-8326-a09487c3a34f" />

## Demo

https://github.com/user-attachments/assets/995dca7a-9fed-431a-a1b8-00e1e85b6e34

## What This Project Is

Household Hub is designed to make shared home coordination feel simple and visible.

Instead of splitting chores, errands, reminders, and grocery notes across different chat threads and apps, this project keeps them in one place:

- weekly household duties with member rotation
- shared to-do tasks
- upcoming events and appointments
- grocery items and check-off lists
- Pixoo64 support for showing a live household summary on a physical display

The app is intentionally simple and collaborative. Everyone looks at the same shared state, and changes sync in real time across devices.

## Who It Is For

This project is useful for:

- couples sharing recurring home responsibilities
- families coordinating chores and schedules
- roommates who want a visible shared system instead of ad hoc messages
- people who enjoy ambient home dashboards, especially with a Pixoo64

If you want a household command center that works on phones and can also live on a desk or shelf as a pixel display, this is what the project is built for.

## Core Features

- Real-time sync with Supabase so all household members see the same data
- Weekly duties view with assignment rotation
- Shared task list with assignees and due dates
- Events board with compact Pixoo-friendly date rendering
- Grocery list with check-off flow
- Settings screen for household members, colors, backups, and reset
- Pixoo64 integration with a rotating four-frame display:
  - chores
  - to-do
  - events
  - grocery
- Custom duty sprites so household categories like laundry or floor cleaning can have their own 8x8 icons

## How The Pixoo64 Fits In

The Pixoo64 integration is not a separate toy feature. It is a display layer for the same household data used in the main app.

The Pixoo view renders the current shared data into a compact 64x64 pixel animation. It automatically rotates between:

- `CHORES`
- `TO-DO`
- `EVENTS`
- `GROCERY`

Long item names scroll horizontally when needed, and the live preview in the app uses the same rendering logic as the display upload flow.

## Tech Stack

- React
- Vite
- Supabase
- Browser canvas rendering for Pixoo64 frame generation
- Optional local Pixoo proxy / sender scripts for device communication

## Project Structure

- [/Users/losteffy/Documents/GitHub/household-hub/src/App.jsx](/Users/losteffy/Documents/GitHub/household-hub/src/App.jsx)
  Main application UI, data flows, Pixoo renderer, and Pixoo upload logic.
- [/Users/losteffy/Documents/GitHub/household-hub/src/supabase.js](/Users/losteffy/Documents/GitHub/household-hub/src/supabase.js)
  Supabase client setup.
- [/Users/losteffy/Documents/GitHub/household-hub/pixoo-proxy.js](/Users/losteffy/Documents/GitHub/household-hub/pixoo-proxy.js)
  Local HTTP bridge for browser-based Pixoo control.
- [/Users/losteffy/Documents/GitHub/household-hub/scripts/send-pixoo.mjs](/Users/losteffy/Documents/GitHub/household-hub/scripts/send-pixoo.mjs)
  Headless sender script for direct Pixoo uploads outside the UI.

# 🏠 Household Hub — Deployment Guide

A shared household planner with real-time sync across all family members' phones, plus Pixoo64 LED display control.

---

## What you'll set up (all free, ~20 minutes)

| Service | Purpose | Cost |
|---------|---------|------|
| **Supabase** | Database — syncs data across all phones in real time | Free |
| **Netlify** | Hosts the web app at a public URL | Free |

---

## Step 1 — Set up Supabase (the database)

1. Go to **https://supabase.com** → click **Start your project** → sign up with GitHub or email

2. Click **New project** → give it a name (e.g. `household-hub`) → choose a region close to you → click **Create new project** and wait ~1 minute

3. In the left sidebar click **SQL Editor** → click **New query** → paste this SQL and click **Run**:

```sql
-- Create the data table
create table household_data (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Allow anyone to read and write (no login required)
alter table household_data enable row level security;

create policy "allow_all" on household_data
  for all using (true) with check (true);

-- Enable real-time sync
alter publication supabase_realtime add table household_data;
```

4. In the left sidebar click **Project Settings** (gear icon) → **API**

5. Copy two things — you'll need them in Step 3:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public** key (long string under "Project API Keys")

---

## Step 2 — Upload code to GitHub

> GitHub is where your code lives — Netlify reads from it to build your site automatically.

1. Go to **https://github.com** → sign up or log in

2. Click the **+** button (top right) → **New repository**
   - Name: `household-hub`
   - Keep it **Private**
   - Click **Create repository**

3. On your computer, open a terminal (Mac: search "Terminal", Windows: search "PowerShell")

4. Run these commands one at a time:
```bash
# Install Node.js first if you don't have it: https://nodejs.org (download LTS version)

cd path/to/household-hub    # Navigate to the folder you downloaded
npm install                  # Install dependencies
```

5. Then push to GitHub (replace YOUR_USERNAME with your GitHub username):
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/household-hub.git
git push -u origin main
```

---

## Step 3 — Deploy to Netlify

1. Go to **https://netlify.com** → sign up with GitHub (use the same account)

2. Click **Add new site → Import an existing project** → choose **GitHub** → select your `household-hub` repository

3. Netlify auto-detects Vite. Confirm these build settings (they should be pre-filled):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`

4. Click **Add environment variables** and add:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | Your Supabase Project URL from Step 1 |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key from Step 1 |

5. Click **Deploy site** — wait about 1 minute

6. Netlify gives you a URL like `household-hub-abc123.netlify.app` 🎉

   > Optional: click **Domain settings → Options → Edit site name** to get a cleaner URL like `my-household-hub.netlify.app`

---

## Step 4 — Share with your household

- **Bookmark the Netlify URL** on everyone's phone
- **Add to home screen**: On iPhone tap Share → "Add to Home Screen". On Android tap the menu → "Add to Home Screen"
- Everyone sees the **same live data** — changes sync instantly across all devices!

---

## Pixoo64 Setup

The Pixoo64 is a local network device with no HTTPS support. Because the app is served over HTTPS on Netlify, browsers refuse to call plain `http://` addresses — even on your LAN.

The solution is a **Cloudflare Tunnel**: a free service that gives your local proxy script a real `https://` URL. The browser calls that URL over HTTPS (allowed), Cloudflare routes it through an encrypted tunnel to your PC, and your PC forwards it to the Pixoo over plain HTTP on your LAN.

```
Netlify app (HTTPS)
      ↓  https://xxxx.trycloudflare.com  ✅
Cloudflare ──── encrypted tunnel ────▶ cloudflared on your PC
                                               ↓  http://  ✅ (local LAN)
                                          Pixoo64 (192.168.1.x)
```

### One-time setup

1. **Install Node.js** if you don't have it: https://nodejs.org (LTS version)

2. **Install cloudflared**:
   - Mac: `brew install cloudflared`
   - Windows: `winget install --id Cloudflare.cloudflared`
   - Linux: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

### Every time you want to control the Pixoo

1. Open a terminal in the project folder and run:
```bash
node pixoo-proxy.js 192.168.1.42
```
Replace `192.168.1.42` with your Pixoo's actual IP (find it in the Divoom app → Device → IP address).

2. Wait a few seconds — it will print something like:
```
╔══════════════════════════════════════════════════════╗
║  ✅  Tunnel is LIVE — copy this URL into the app     ║
╠══════════════════════════════════════════════════════╣
║  https://random-words-here.trycloudflare.com         ║
╚══════════════════════════════════════════════════════╝
```

3. Open the Household Hub app → **PIXOO64** tab

4. Paste the `https://….trycloudflare.com` URL into the **Proxy URL** field

5. Click **Test** → you should see "✓ Connected!"

6. Choose a display mode and click **Send to Pixoo64**

7. Press `Ctrl+C` in the terminal when done.

> **Note:** The tunnel URL changes every time you restart the proxy. Just paste the new URL into the app and click Test again. The URL is only active while the script is running.
---

## Backups And Data Safety

The Settings screen includes:

- export backup
- import backup
- reset all data

If you are using this with a real household, exporting a backup occasionally is a good idea.

## Troubleshooting

**"Cannot find module" error** → Run `npm install` first

**Supabase not syncing** → Check that you copied the correct URL and anon key into Netlify environment variables (Site settings → Environment variables), then go to Netlify → your site → Deploys → Trigger deploy

**Pixoo64 not responding** → Make sure the proxy is running (`node pixoo-proxy.js <ip>`) and that you've entered `localhost:8080` (not the Pixoo IP) in the app. The Pixoo's IP can change after a router restart — re-check it in the Divoom app and restart the proxy with the new IP.

**Data lost** → Use the Export button in Settings to download a backup. Import it to restore.