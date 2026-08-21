# SIMS Real Cloud Classroom

GitHub-ready version of the SIMS classroom project.

## Classroom workflow

Teacher creates a class → receives a class code → students join from their own devices → student activity/results are stored in Firebase → teacher dashboard displays the results.

## Firebase setup

See `FIREBASE_SETUP.md` for the Firebase configuration and deployment instructions.

## Important security note

Do not commit Firebase Admin SDK/service-account credentials, private keys, `.env` files, or other secrets.

For a browser-based Firebase app, the Firebase web configuration is normally public; database/auth security must be enforced with Firebase Security Rules.
