# Baseball Pitching Counter

A Progressive Web App for tracking opponent player pitches during baseball games. Record pitch types, swing decisions, hits, and misses to analyze player performance.

## Features

- **Player Management**: Add players by number (1-99)
- **Pitch Tracking**: Record pitch type, swing decision, and results
- **Pitch Types**: Track Fastball, Curveball, Slider, Changeup, Cutter, and Splitter
- **Statistics**: View detailed stats per player including:
  - Total pitches
  - Swings vs. doesn't swing
  - Hits and misses
  - Statistics broken down by pitch type
- **Real-time Sync**: Sync data across devices using Firebase (optional)
- **Progressive Web App**: Install on your phone and use offline

## How to Use

### Setup

Since Firebase requires HTTP/HTTPS, you need to run a local server:

**Option 1: Using the Batch File (Windows)**
1. Double-click `run-local-server.bat`
2. Wait for "Starting local server..." message
3. Open your browser to `http://localhost:8000`

**Option 2: Using Python Manually**
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

**Option 3: Deploy to GitHub Pages**
1. Push your code to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Access via `https://yourusername.github.io/repository-name`

### Using the App

#### Adding a Player
1. Enter the opponent's player number (1-99) in the input field
2. Click "Add" or press Enter
3. The player card will appear with quick stats

#### Recording a Pitch
1. Click "Record Pitch" on a player card
2. Select the pitch type (Fastball, Curveball, etc.)
3. Select whether they swung or didn't swing
4. If they swung, select whether they hit or missed
5. Click "Record Pitch" to save

#### Viewing Statistics
1. Click "View Stats" on a player card
2. See detailed statistics including:
   - Overall stats (total pitches, swings, hits, misses)
   - Hit rate percentage
   - Breakdown by each pitch type

#### Game Sync (Multi-Device)
1. Click the link icon (🔗) in the bottom right
2. Set a game name (e.g., "Quitman vs Mineola")
3. Copy the 6-digit Game Code to share with other devices
4. On another device, enter the 6-digit code and click "Connect"
5. Data will sync in real-time across all connected devices

## Technical Details

- **Firebase Firestore**: Real-time data synchronization (optional)
- **Service Worker**: Offline capabilities for PWA
- **Mobile-First Design**: Optimized for touch devices
- **LocalStorage Fallback**: Works offline without Firebase

## Firebase Setup

The app uses the same Firebase project as TV Time Manager. Data is stored in the `pitchingCounterGames` collection, completely separate from other apps.

## Troubleshooting

**Firebase not connecting?**
- Make sure you're accessing via HTTP/HTTPS (not `file://`)
- Check browser console for errors
- Verify Firebase credentials in `firebase-config.js`

**Can't sync data across devices?**
- Ensure you have an internet connection
- Check that Firestore is enabled in your Firebase project
- Verify Firestore rules allow read/write access

**App not working offline?**
- The app works offline for local data
- Firebase sync requires an internet connection

---

Enjoy tracking pitches! ⚾
