# RepLog Tutorial

RepLog turns the messy workout notes on your phone into a coach. It reads your
notes (screenshots, pasted text, or a screen recording), tracks every all-time
best and when it happened, maps your training splits over time, and tells you
what is lacking, which muscles are underdeveloped relative to their antagonists.

Everything runs **on your own device**. There is no account, no server, and no
cost. Your data lives in your browser and never leaves it.

---

## A. Use it (phone or laptop)

RepLog is a website you can also install like an app.

1. Open **`https://benasbarciauskas.github.io/RepLog/`** in your browser.
2. Install it to your home screen so it opens full-screen and works offline:
   - **iPhone / iPad (Safari):** tap the **Share** button, then
     **Add to Home Screen**.
   - **Android (Chrome):** tap the **⋮** menu, then **Install app** (or
     **Add to Home screen**).
   - **Desktop (Chrome / Edge):** click the **Install** icon in the address bar.
3. Launch RepLog from your home screen. After the first load it works **offline**,
   the whole app is cached on your device.

Your workouts, notes, and any custom exercises stay on the device you added it to.
Nothing is uploaded or synced. Clearing your browser data (or using
**Clear all data** inside the app) removes them.

> Just want to look around first? On the Import screen (or the empty Dashboard)
> tap **Try with sample data** to load a few demo workouts, then explore the
> Dashboard and Coach. **Clear all data** resets it whenever you like.

---

## B. Import your notes

RepLog has three ways to bring your notes in. All three are parsed on-device.

### Screenshots

1. Screenshot your Notes app (one screenshot or many).
2. Open RepLog, go to **Import**, choose **Screenshots**, and drop or pick the
   images.
3. RepLog reads the text from each image and parses it.

### Paste

1. Copy the text of your notes.
2. Go to **Import**, choose **Paste**, and paste it into the box.
3. RepLog parses the text directly.

You can paste **anything**, full notes, grocery lists and all. RepLog
automatically filters out everything that is not a workout.

### Video

1. Record your screen while you scroll through your notes.
2. Go to **Import**, choose **Video**, and select the recording.
3. RepLog samples frames, reads each one, stitches the text, and parses it.

> **Video works best in Safari.** iPhone screen recordings are saved as HEVC,
> which Chrome often cannot decode. If a video import fails, open RepLog in
> Safari, or fall back to **Screenshots** or **Paste**, which always work.

### Review and save

After importing, RepLog shows the **Review** screen with the parsed workouts:
dates, bodyweight, the split, and every `exercise: weight × reps` line. Anything
the parser was unsure about is flagged. Fix anything that is off, add unknown
exercises to your catalog, then tap **Confirm & save**.

**Nothing is saved until you confirm.** Once saved, your Dashboard (all-time
bests, PR timeline, bodyweight trend, split history) and your Coach
("what's lacking") update instantly.

---

## C. Log a workout live

Beyond importing past notes, you can log sessions as you train.

1. Open **Log** (the centre tab) and tap **Start empty workout** — or start from a saved **Routine**.
2. Tap **Add exercise** and search the catalog (or add your own).
3. For each set, enter weight and reps. The **PREV** column shows what you lifted last time. Mark a set done with the check, and a **rest timer** starts automatically (adjust or skip it). Tap **plates** to see the plates per side. Flag warm-up sets and log **RPE** if you want.
4. Add sets and exercises as you go. The session saves continuously, so you can close the app and resume right where you left off.
5. Tap **Finish** to review and save the session (it joins your history and updates the Dashboard + Coach), or **Discard** to drop it.

**Save as a routine:** turn the current session into a reusable template from the logger, then start future workouts from **Routines** in one tap.

---

## D. Run from source (developers)

RepLog is a static React + Vite app with no backend.

### Prerequisites

- **Node.js 20+** and npm.

### Run locally

```bash
git clone https://github.com/benasbarciauskas/RepLog
cd RepLog
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

### Build and deploy your own

```bash
npm run build      # outputs static files to dist/
npm run preview    # preview the production build locally
```

Deploy the `dist/` folder to any static host. This repo ships to **GitHub Pages**
via `.github/workflows/deploy.yml` (it builds with the `/RepLog/` base path). Any
static host works, though — for example, **Vercel**:

1. Import the repo into Vercel (framework preset: **Vite**).
2. Build command `npm run build`, output directory `dist`.
3. Add an SPA rewrite so client-side routes resolve, a `vercel.json` with:

   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

The app is installable as a PWA out of the box (`manifest.webmanifest` + service
worker are emitted by the build), so the deployed site works offline.

### Useful scripts

```bash
npm test        # run the unit/integration tests once
npm run lint    # eslint
```

---

## E. Native app via Expo (`mobile/`)

RepLog ships a native iOS/Android app built with **Expo + expo-router**, in the
[`mobile/`](mobile/) folder. It reuses this web app's parser, analytics, and coach
logic directly (via a `mobile/core` symlink to `src/`), stores data on-device with
`expo-sqlite`, and keeps the same on-device, no-account, no-cost principle.

### Run it on your phone (Expo Go)

```bash
cd mobile
npm install        # first time only
npx expo start
```

This prints a **QR code**. Install **Expo Go** from the App Store / Play Store, then
scan the QR code (iOS Camera app, or the Expo Go app on Android) to run RepLog live
on your device, with hot reload as you edit.

> The app reuses the shared core from `../src` through the `mobile/core` symlink, so
> run it from inside a full clone of this repo — not a copy of `mobile/` on its own.

### AI parse on mobile

Same optional feature as the web app: add your own free **OpenRouter** key in
**Settings → AI parsing** to turn messy notes into workouts. The key is stored only
on the device and is excluded from exported backups.

### Build & submit a real binary (EAS / expo.dev)

```bash
npm install -g eas-cli
eas login                      # uses your free expo.dev account
cd mobile
eas build --platform ios       # or --platform android / all — builds in the cloud
eas submit --platform ios      # uploads to App Store Connect
```

`eas build` produces a signed binary on **expo.dev**; `eas submit` ships it to the
store. You can also push instant JS-only updates with `eas update`. The native app
keeps the same on-device, no-account, no-cost principle as the web version.

---

## See also

- [`README.md`](README.md) — overview and feature list.
- [`DESIGN.md`](DESIGN.md) — the visual design system.
