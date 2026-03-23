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

The Pixoo64 only works when your phone is on your **home WiFi network** (it's a local device, not cloud-connected).

1. In the app, go to the **PIXOO64** tab
2. Find your Pixoo's IP address in the **Divoom app** → Device → IP
3. Enter it and tap **Test**
4. Choose what to display and tap **Send to Pixoo64**

---

## Updating the app later

Any time you push new code to GitHub, Netlify automatically rebuilds and deploys. No manual steps needed.

---

## Troubleshooting

**"Cannot find module" error** → Run `npm install` first

**Supabase not syncing** → Check that you copied the correct URL and anon key into Netlify environment variables (Site settings → Environment variables), then go to Netlify → your site → Deploys → Trigger deploy

**Pixoo64 not responding** → Make sure your phone is on home WiFi (same network as the Pixoo). The Pixoo IP may change — re-check in the Divoom app.

**Data lost** → Use the Export button in Settings to download a backup. Import it to restore.
