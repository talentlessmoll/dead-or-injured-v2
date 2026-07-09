# 🎯 Dead or Injured: A Tactical Guessing Game

Dead or Injured is a minimalist, fast-paced code-breaking game played with a friend or against a smart AI. It runs entirely serverless and peer-to-peer via **WebRTC (PeerJS)**, meaning two players can pair up directly using simple room codes or dynamic QR code links! No login, database, or server registration is needed.

---

## 🚀 How Peer-to-Peer Connections Work

1. **Host a Room**: One player clicks **"Create Co-op Lobby"** to receive a 4-character room access code (e.g. `KXYZ`) and a custom QR code.
2. **Join a Room**: The second player enters the 4-character room code, clicks the custom **"Scan Invite QR Code"** button to scan, or simply opens the dynamic match link.
3. **No Central Server**: PeerJS brokers the initial handshake, and the rest of the game runs 100% peer-to-peer directly between your browsers. Chats and game states stay client-side and are wiped cleanly when you leave the game.

---

## 🎮 Game Rules

### Phase 1: Set Your Code
* You and your opponent secretly choose a 4-digit code.
* **The Golden Rule**: Every digit must be completely unique. No repeating numbers allowed!
  * ✅ `5724` is legal.
  * ❌ `5524` is illegal (the 5 repeats).
  * ✅ `0123` is legal (0 can go first).

### Phase 2: Take Turns Guessing
* You and your opponent take turns trying to crack each other's secret code.
* Every guess you make returns two clues:
  * **🟢 DEAD**: A digit exists in the code and is in the **exact correct position**.
  * **🟡 INJURED**: A digit exists in the code, but is in the **wrong position**.

### Real Match Example:
* **Opponent's secret code**: `5724`
* **Your guess code**: `5279`
* **Result clues**: `1 Dead, 2 Injured`
  * *5* is in the 1st position → **1 DEAD**
  * *2* is in the code but wrong position → **1 INJURED**
  * *7* is in the code but wrong position → **1 INJURED**
  * *9* is not in the code at all → **Nothing**

### Phase 3: Narrow It Down
* Use the **Tactical Scratchpad** on the screen to cross off digits you know are out (red Trash), lock in confirmed digits (green Confirm), or keep track of potential suspects (yellow Maybe).

### Phase 4: Victory
* The first player to successfully get **4 DEAD** (meaning they have guessed all 4 digits in their exact correct order) wins the game!

---

## 🛠️ Built With

* **React + Vite** for rapid, modern frontend rendering.
* **Tailwind CSS** for tactile, high-contrast visual styling.
* **motion/react** for smooth, playful screen transitions and keypad animations.
* **PeerJS (WebRTC)** for smooth, peer-to-peer multiplayer state synchronization.
* **Html5-Qrcode** for camera QR scanning and instant matchmaking.
