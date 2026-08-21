# SIMS Real School System Setup

This version uses Firebase Realtime Database so teacher and student devices share the same cloud data.

1. Create a Firebase project at Firebase Console.
2. Add a Web App and copy its config into `firebase-config.js`.
3. Create a Realtime Database.
4. For quick testing only, use open test rules. Before production, add authentication and teacher ownership rules.
5. Upload these files to Firebase Hosting, TiinyHost, Netlify, or another HTTPS static host.
6. Open the same hosted URL on the teacher laptop and student devices.

Flow: Teacher creates Grade 7-A -> unique 6-character code -> students join on their own devices -> every answer writes to the cloud -> teacher LIVE Dashboard updates automatically.

Important: Firebase config alone is not secret access control. For a production school deployment, add Firebase Authentication and database rules restricting each teacher to their own classes.
