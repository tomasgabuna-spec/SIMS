# SIMS Real Cloud Classroom

GitHub-ready version of the SIMS classroom project.

## Classroom workflow

Teacher creates a class → receives a class code → students join from their own devices → student activity/results are stored in Firebase → teacher dashboard displays the results.

## Offline support (PWA)

The app is installable and works fully offline:

- A service worker (`service-worker.js`) caches the app shell (HTML/CSS/JS/images) on first visit, so it loads with zero internet connection after that.
- Practice, Mission Mode, Word Problems, Time Trial, Progress, and Badges all already save to the browser's `localStorage` and need no internet at all.
- **Teacher Mode** and **Join Class** are the only features that need internet (they sync live over Firebase). When offline, the app shows a friendly banner and disables those cloud calls instead of throwing errors.
- On mobile/desktop browsers, users can "Install" / "Add to Home Screen" via `manifest.json` to get a standalone app icon.

Note: GitHub Pages (or any static host) serves the files over HTTPS, which is required for service workers to register.

## Firebase setup

See `FIREBASE_SETUP.md` for the Firebase configuration and deployment instructions.

## Important security note

Do not commit Firebase Admin SDK/service-account credentials, private keys, `.env` files, or other secrets.

For a browser-based Firebase app, the Firebase web configuration is normally public; database/auth security must be enforced with Firebase Security Rules.


## UI/UX Refresh
The UI has been refreshed for clearer classroom use, including improved visual hierarchy, responsive cards, larger touch targets, focus states, drawer backdrop/Escape handling, refined game/mission/teacher panels, and reduced-motion support. Existing game logic and offline storage behavior are preserved.
