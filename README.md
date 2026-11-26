# 🎄 Julbordsnotan

A 16-bit, pixel-style web app for splitting a julbord bill with friends.

1. **The host** pastes the receipt text. The app turns it into rows (quantity, item, unit price) that you can fix by hand. You add your Swish number and an optional tip, then get a link to share.
2. **Friends** open the link, pick a name and press **+** on what they ate and drank. The number left of each item goes down for everyone, live.
3. Each person sees **their own bill**: items, plus their share of the tip, which is split evenly among everyone who has claimed something. They also see your Swish number, the amount to pay and a **"Jag har swishat"** button.
4. **Kvar på notan** at the top counts down to **0 kr**. It covers both unclaimed items and amounts that are claimed but not yet paid. At zero you get fireworks and a jingle. 🎅

Extras: pixel snowfall, chiptune sound effects, and lo-fi Christmas music you switch on with the ♪ button. The music is an original melody with sleigh bells and vinyl crackle, synthesised with WebAudio. *Tomtens lista* sorts players into snälla (paid) and stygga (not paid) and hands out titles such as TOMTEBOSS, ÖLKUNG and SNAPSMÄSTARE.

## Run locally (demo mode)

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

With no Firebase config (`js/config.js` → `null`), everything is stored in `localStorage` in your own browser. That's good for testing, but your friends can't reach the link.

## Setup for real use (free)

### 1. Firebase (shared database)
1. Go to <https://console.firebase.google.com> → **Add project** (Google Analytics is not needed).
2. **Build → Firestore Database → Create database** (production mode, region `eur3` or `europe-north1`).
3. On the **Rules** tab, paste the contents of [`firestore.rules`](firestore.rules) and click **Publish**.
4. **Project settings (⚙️) → Your apps → Web (`</>`)** → register an app. Copy the `firebaseConfig` object.
5. Paste it into [`js/config.js`](js/config.js):
   ```js
   export const FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", ... };
   ```
   (Firebase web keys are not secret. Access is controlled by the rules.)

### 2. GitHub Pages (hosting)
1. Merge into `main` (or pick this branch directly).
2. In the repo: **Settings → Pages → Build and deployment → Deploy from a branch**, then choose the branch and `/ (root)`.
3. The app goes live at `https://<user>.github.io/julbordsnotan/`.

## Good to know
- Each bill is a single Firestore document. Every **+** runs as a transaction, so two people can't take the last beer at the same time.
- After a bill is created, friends can only change who claimed what and who has paid. The rules stop them from editing prices, the tip or the Swish number.
- Anyone with the link can play, and can also "be" someone else by picking their name (useful when switching phones). It's built for friends, not for strangers.
- The receipt parser handles forms like `8 st Julbord 595,00 4 760,00`, `Julöl 6 x 79,00 474,00`, `3x Snaps 69` and `Glögg 2 st à 45 90,00`. It skips rows such as totals, VAT and card payments. Enter the receipt's total in the check field and the app will warn you if the rows don't add up.

## Files
| File | What it does |
|---|---|
| `index.html`, `css/style.css` | Page and pixel styling |
| `js/app.js` | Views: create bill, join, claim items, pay |
| `js/calc.js` | Bill math in öre (whole numbers), tip split |
| `js/parse.js` | Receipt parser |
| `js/store.js` | Firestore / localStorage adapter |
| `js/audio.js` | Sound effects and lo-fi music (WebAudio) |
| `js/sprites.js`, `js/fx.js` | Pixel sprites, snow, confetti |
