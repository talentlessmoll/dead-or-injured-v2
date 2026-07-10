import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GameRoom, Player, Guess, GameStatus } from "./src/types.js";

// Helper function to check if digit is unique
function hasUniqueDigits(code: string): boolean {
  if (code.length !== 4) return false;
  if (!/^\d{4}$/.test(code)) return false;
  const set = new Set(code);
  return set.size === 4;
}

// Helper to calculate score
function calculateScore(guess: string, secret: string) {
  let dead = 0;
  let injured = 0;
  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) {
      dead++;
    } else if (secret.includes(guess[i])) {
      injured++;
    }
  }
  return { dead, injured };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url} (Headers: ${JSON.stringify(req.headers)})`);
    next();
  });

  app.use(express.json());

  // In-memory room store
  const rooms = new Map<string, GameRoom>();

  // Room code generator
  function generateRoomId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No easily confused characters (like O, 0, I, 1)
    let code = "";
    do {
      code = "";
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (rooms.has(code));
    return code;
  }

  // Periodic cleanup of inactive rooms (older than 2 hours)
  setInterval(() => {
    const now = Date.now();
    const expiry = 2 * 60 * 60 * 1000; // 2 hours
    for (const [roomId, room] of rooms.entries()) {
      if (now - room.updatedAt > expiry) {
        rooms.delete(roomId);
        console.log(`Cleaned up inactive room ${roomId}`);
      }
    }
  }, 15 * 60 * 1000); // Run every 15 mins

  // --- API Routes ---
  
  // WiFi LAN scan/discovery routes
  app.post("/api/wifi/host", (req, res) => {
    const { playerId, name, hostPeerId, wifiSsid } = req.body;
    if (!playerId || !name || !hostPeerId) {
      res.status(400).json({ error: "playerId, name, and hostPeerId are required" });
      return;
    }

    let clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    if (clientIp.includes(",")) {
      clientIp = clientIp.split(",")[0].trim();
    }

    // Generate a clean room ID with a WIFI- prefix
    const roomId = `WIFI-${generateRoomId()}`;
    const newRoom: GameRoom = {
      roomId,
      players: [{ id: playerId, name: name.trim().slice(0, 16), secretCode: null }],
      guesses: [],
      status: "waiting",
      turn: null,
      winnerId: null,
      updatedAt: Date.now(),
      isWifi: true,
      wifiIp: clientIp,
      hostPeerId,
    };

    rooms.set(roomId, newRoom);
    console.log(`[WiFi] Hosted room ${roomId} by ${name} (${playerId}) on IP ${clientIp} using PeerJS ${hostPeerId}`);
    res.status(201).json(newRoom);
  });

  app.get("/api/wifi/lobbies", (req, res) => {
    let clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    if (clientIp.includes(",")) {
      clientIp = clientIp.split(",")[0].trim();
    }

    const activeLobbies: any[] = [];
    const now = Date.now();
    const expiry = 1 * 60 * 60 * 1000; // 1 hour expiry for WiFi rooms

    for (const [roomId, room] of rooms.entries()) {
      if (room.isWifi && room.wifiIp === clientIp && room.status === "waiting") {
        if (now - room.updatedAt < expiry) {
          activeLobbies.push({
            roomId: room.roomId,
            hostName: room.players[0]?.name || "Unknown",
            hostId: room.players[0]?.id || "",
            hostPeerId: room.hostPeerId,
            updatedAt: room.updatedAt,
          });
        } else {
          rooms.delete(roomId);
        }
      }
    }

    res.json(activeLobbies);
  });

  app.get("/api/wifi/rooms/:roomId", (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId.toUpperCase());
    if (!room || !room.isWifi) {
      res.status(404).json({ error: "WiFi room not found" });
      return;
    }
    res.json({
      roomId: room.roomId,
      hostPeerId: room.hostPeerId,
      hostName: room.players[0]?.name || "Unknown",
    });
  });

  app.post("/api/wifi/leave", (req, res) => {
    const { roomId } = req.body;
    if (roomId) {
      rooms.delete(roomId.toUpperCase());
      console.log(`[WiFi] Removed room ${roomId} upon host termination`);
    }
    res.json({ success: true });
  });

  // Get Client IP
  app.get("/api/ip", (req, res) => {
    let clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    if (clientIp.includes(",")) {
      clientIp = clientIp.split(",")[0].trim();
    }
    res.json({ ip: clientIp });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", activeRooms: rooms.size });
  });

  // Create a room
  app.post("/api/rooms", (req, res) => {
    const { playerId, name } = req.body;
    if (!playerId || !name) {
      res.status(400).json({ error: "playerId and name are required" });
      return;
    }

    const roomId = generateRoomId();
    const newRoom: GameRoom = {
      roomId,
      players: [{ id: playerId, name: name.trim().slice(0, 16), secretCode: null }],
      guesses: [],
      status: "waiting",
      turn: null,
      winnerId: null,
      updatedAt: Date.now(),
    };

    rooms.set(roomId, newRoom);
    console.log(`Created room ${roomId} by player ${name} (${playerId})`);
    res.status(201).json(newRoom);
  });

  // Join a room
  app.post("/api/rooms/:roomId/join", (req, res) => {
    const { roomId } = req.params;
    const { playerId, name } = req.body;

    const code = roomId.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    if (!playerId || !name) {
      res.status(400).json({ error: "playerId and name are required" });
      return;
    }

    // Check if player is already in the room
    const existingPlayer = room.players.find((p) => p.id === playerId);
    if (existingPlayer) {
      room.updatedAt = Date.now();
      res.json(room);
      return;
    }

    if (room.players.length >= 2) {
      res.status(400).json({ error: "Room is full (max 2 players)" });
      return;
    }

    room.players.push({
      id: playerId,
      name: name.trim().slice(0, 16),
      secretCode: null,
    });

    // If we have 2 players, transition to 'setup' phase
    if (room.players.length === 2) {
      room.status = "setup";
    }

    room.updatedAt = Date.now();
    console.log(`Player ${name} (${playerId}) joined room ${code}`);
    res.json(room);
  });

  // Submit secret lock code
  app.post("/api/rooms/:roomId/setup", (req, res) => {
    const { roomId } = req.params;
    const { playerId, secretCode } = req.body;

    const code = roomId.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    if (room.status !== "setup") {
      res.status(400).json({ error: "Game is not in setup phase" });
      return;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      res.status(403).json({ error: "You are not a player in this room" });
      return;
    }

    if (!secretCode || !hasUniqueDigits(secretCode)) {
      res.status(400).json({ error: "Secret code must be exactly 4 unique digits" });
      return;
    }

    player.secretCode = secretCode;

    // Check if both players have submitted their codes
    const allSubmitted = room.players.every((p) => p.secretCode !== null);
    if (allSubmitted && room.players.length === 2) {
      room.status = "playing";
      // Pick random player for first turn
      const firstTurnIndex = Math.floor(Math.random() * 2);
      room.turn = room.players[firstTurnIndex].id;
    }

    room.updatedAt = Date.now();
    console.log(`Player ${player.name} in room ${code} locked secret code`);
    res.json(room);
  });

  // Submit a guess
  app.post("/api/rooms/:roomId/guess", (req, res) => {
    const { roomId } = req.params;
    const { playerId, code: guessCode } = req.body;

    const code = roomId.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    if (room.status !== "playing") {
      res.status(400).json({ error: "Game is not active" });
      return;
    }

    if (room.turn !== playerId) {
      res.status(400).json({ error: "It is not your turn" });
      return;
    }

    if (!guessCode || !hasUniqueDigits(guessCode)) {
      res.status(400).json({ error: "Guess must be exactly 4 unique digits" });
      return;
    }

    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) {
      res.status(403).json({ error: "You are not a player in this room" });
      return;
    }

    // Identify opponent and verify secret
    const opponentIndex = 1 - playerIndex;
    const opponent = room.players[opponentIndex];
    if (!opponent || !opponent.secretCode) {
      res.status(500).json({ error: "Opponent secret code is not set" });
      return;
    }

    // Calculate dead & injured score
    const score = calculateScore(guessCode, opponent.secretCode);

    // Add guess
    const newGuess: Guess = {
      playerId,
      code: guessCode,
      dead: score.dead,
      injured: score.injured,
      timestamp: Date.now(),
    };
    room.guesses.push(newGuess);

    // Check if player won
    if (score.dead === 4) {
      room.status = "ended";
      room.winnerId = playerId;
      room.turn = null;
    } else {
      // Toggle turn
      room.turn = opponent.id;
    }

    room.updatedAt = Date.now();
    console.log(`Room ${code}: Player ${room.players[playerIndex].name} guessed ${guessCode} -> ${score.dead} Dead, ${score.injured} Injured`);
    res.json(room);
  });

  // Rematch / Restart game
  app.post("/api/rooms/:roomId/restart", (req, res) => {
    const { roomId } = req.params;
    const { playerId } = req.body;

    const code = roomId.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    // Verify requesting player belongs to room
    const isPlayer = room.players.some((p) => p.id === playerId);
    if (!isPlayer) {
      res.status(403).json({ error: "You are not a player in this room" });
      return;
    }

    // Reset room state
    room.guesses = [];
    room.status = "setup";
    room.turn = null;
    room.winnerId = null;
    room.players.forEach((p) => {
      p.secretCode = null;
    });
    room.updatedAt = Date.now();

    console.log(`Room ${code} reset for a new match`);
    res.json(room);
  });

  // Leave room
  app.post("/api/rooms/:roomId/leave", (req, res) => {
    const { roomId } = req.params;
    const { playerId } = req.body;

    const code = roomId.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    // Remove player
    room.players = room.players.filter((p) => p.id !== playerId);

    if (room.players.length === 0) {
      rooms.delete(code);
      console.log(`Deleted empty room ${code}`);
    } else {
      // Remaining player is left alone, reset to waiting
      room.status = "waiting";
      room.guesses = [];
      room.turn = null;
      room.winnerId = null;
      room.players.forEach((p) => {
        p.secretCode = null;
      });
      room.updatedAt = Date.now();
      console.log(`Player left room ${code}. Room reset to waiting.`);
    }

    res.json({ success: true });
  });

  // Get Room State (with safety sanitization)
  app.get("/api/rooms/:roomId", (req, res) => {
    const { roomId } = req.params;
    const playerId = req.query.playerId as string;

    const code = roomId.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    // SECURE SANITIZATION:
    // We must never expose the other player's secretCode over the network.
    // Map players list and nullify secretCode for other players.
    const sanitizedPlayers = room.players.map((p) => ({
      id: p.id,
      name: p.name,
      // Only show secret code if requested by that player
      secretCode: p.id === playerId ? p.secretCode : null,
      hasSubmittedCode: p.secretCode !== null,
    }));

    const sanitizedRoom = {
      ...room,
      players: sanitizedPlayers,
    };

    res.json(sanitizedRoom);
  });

  // --- Vite & Client integration ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
