# RepLog — Spec Addenda (post-brainstorm requirements)

Date: 2026-06-22. Extends `2026-06-22-replog-design.md`. Captured after Wave 1.

## A1. Import mode: screen-recording (video)

Users can import a **screen recording of their Notes app** (scroll through, optionally tap
into a note and back out), and RepLog extracts everything workout-related, ignoring the rest.

All client-side, no key:
1. Upload a video (iPhone screen recording, `.mov`/`.mp4`).
2. Sample frames (~1 fps) via a hidden `<video>` + `<canvas>`; **perceptual-hash-dedupe**
   adjacent frames so static/idle stretches aren't OCR'd twice.
3. Tesseract OCRs the sampled frames (throttled, progress UI).
4. **Stitch + dedupe** overlapping OCR text across frames into one corpus (scrolling overlaps).
5. Feed the corpus through the normal parse pipeline.

**Caveat:** iPhone recordings are HEVC `.mov`. Safari decodes HEVC; Chrome often cannot. Video
import is most reliable in Safari (or an H.264 recording). On a decode failure, surface a clear
message and fall back to screenshots/paste (which stay bulletproof). Cap total frames with a
visible notice if a recording is very long.

"Click into a note then close" is **not required** — scrolling past previews suffices; opening a
note just yields a cleaner full-text frame, which only helps.

## A2. Relevance filter (core for ALL import modes)

A screenshot/recording/paste may contain unrelated notes. The import flow keeps a note-segment
only if the parser finds workout signals (split keyword, `weight × reps`, exercise lines,
date+bodyweight). Unrelated segments are dropped. The Review screen shows kept results plus a
collapsible **"N unrelated notes skipped"** the user can peek at / override.

Implement as `isWorkoutRelated(segment): boolean` (or a confidence score) used by `parseNotes`
and the import flow; benefits screenshots and paste too, not just video.

## A3. Distribution / tutorial

- The web app is the universal path: one **public hosted URL** (Vercel) → open on phone or
  laptop → "Add to Home Screen" (installable PWA), data stays on each user's own device.
- Repo is **public** → `TUTORIAL.md` includes a from-source/self-host track (clone, `npm install`,
  `npm run dev`, build + deploy your own).

## A4. Expo (React Native) mobile app — separate repo, AFTER web v1

The native mobile app will be built with **Expo** (React Native), as its own repo (web and mobile
are separate codebases). It reuses the framework-free logic modules (`parser`, `analytics`,
`coach`, `catalog`) unchanged — only the UI layer is rebuilt in RN. `TUTORIAL.md` will document
the expo.dev setup: `npx create-expo-app`, `npx expo start` + Expo Go (QR-scan to run on a phone
instantly), and EAS build/submit for the App Store. Not part of web v1.
