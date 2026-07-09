# 🎯 Dead or Injured — Tactical Code-Breaking Duel

Dead or Injured is a highly polished, interactive, full-stack multiplayer browser game of logic and deduction based on the classic *Bulls and Cows* code-breaking game (similar to Mastermind). Players compete to crack each other's secret 4-digit codes using dead/injured scoring, and keep notes on an interactive strategic scratchpad.

---

## 🕹️ Game Rules & Scoring

Both players lock in a secret **4-digit code** consisting of unique (non-repeating) numbers from `0` to `9`. Each turn, players submit a 4-digit guess and receive immediate feedback:

- 🟢 **Dead**: A digit is correct and occupies the **exact correct position**.
- 🟡 **Injured**: A digit is correct but is in the **wrong position**.

### Example Scenario
- **Target Secret Code**: `1` `3` `8` `0`
- **Player's Guess**: `1` `8` `0` `5`
- **Result**: `1 Dead` (the digit `1` is correct and in position 1), `2 Injured` (the digits `8` and `0` are in the target, but placed incorrectly).
- **Goal**: Break the opponent's code (achieve `4 Dead`) in the fewest turns possible.

---

## 🚀 Key Features

- **🌐 Zero-Backend WebRTC Multiplayer (PeerJS)**: Players can play together over any internet connection without needing cloud workers, databases, or traditional server coordination. Fully serverless peer-to-peer multiplayer!
- **📸 QR Scanner & Shareable Links**: Seamlessly invite friends to a match by clicking **Share Link**, copying the game coordinates, or presenting/scanning a dynamic **QR Code** generated on-the-fly using the device's camera.
- **🤖 Adaptive AI Opponent (Single Player)**: Play offline against a tactical computer opponent. The AI dynamically logs, analyzes possibilities, and adapts its guesses with increasing intelligence.
- **📱 Local Pass & Play**: Share a single device and engage in a head-to-head match, completed with a transition screen overlay to keep your code private during handovers.
- **📝 Interactive Tactile Scratchpad**: Keep track of safe, eliminated, and potential positions for every digit (`0`-`9`) on an elegant visual matrix.
- **📺 Tactical Terminal UI**: Styled in a slate-colored dark cosmetic layout with high-contrast emerald colors, clean typographic scales, smooth entry transitions, and tactile audio feedback.

---

## 🛠️ Architecture & Core Technologies

- **Frontend**: React 18, Vite, TypeScript
- **Styling & Theme**: Tailwind CSS, custom tactile glows, and `lucide-react` icons
- **Animations**: `motion/react` (Framer Motion)
- **Peer-to-Peer Signaling**: **PeerJS (WebRTC)** for direct serverless browser-to-browser socket data transfers.
- **QR Code Engine**: `qrcode` (local generation) & `html5-qrcode` (camera viewport capturing).

---

## 💻 Developer Setup & Installation

Follow these steps to run the project locally:

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```
The server binds to port `3000` automatically. Open `http://localhost:3000` in your browser.

### 3. Verify and Build the Applet
To build the static production files:
```bash
npm run build
```

---

## 🔍 How Serverless Multiplayer Works
1. **The Host** generates a clean 4-character room code (e.g. `KXYZ`). This instantiates a PeerJS server ID under `doi-KXYZ`.
2. **The Guest** scans the host's QR code or pastes the share link (`/?room=KXYZ`). The client reads the code, connects directly to `doi-KXYZ`, and launches an encrypted WebRTC data channel connection.
3. **No Database Needed**: Game actions, secret code lock confirmations, and guesses are exchanged safely directly between the two peer browsers.

Enjoy code-breaking! 🕵️‍♂️
