import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Peer from "peerjs";
import { Html5Qrcode } from "html5-qrcode";
import {
  Target,
  Users,
  Bot,
  Smartphone,
  HelpCircle,
  X,
  RotateCcw,
  LogOut,
  ChevronRight,
  ShieldAlert,
  Terminal,
  Lock,
  Unlock,
  Play,
  ArrowLeft,
  Sparkles,
  QrCode,
  Camera,
} from "lucide-react";

import {
  GameRoom,
  Guess,
  ScratchpadState,
  SinglePlayerState,
  Player as RoomPlayer,
} from "./types";
import {
  hasUniqueDigits,
  generateRandomCode,
  calculateScore,
  getSmartAIGuess,
} from "./utils";

import MainMenu from "./components/MainMenu";
import Scratchpad from "./components/Scratchpad";
import TactileKeyboard from "./components/TactileKeyboard";
import BattleLogs from "./components/BattleLogs";
import RoomLobby from "./components/RoomLobby";

// Helper to generate a fast unique player ID
function generatePlayerId(): string {
  return "p_" + Math.random().toString(36).substring(2, 11);
}

// Initial state for Scratchpad
const initialScratchpad = (): ScratchpadState => ({
  eliminated: Array(10).fill(false),
  confirmed: Array(10).fill(false),
  maybe: Array(10).fill(false),
  notes: "",
});

export default function App() {
  // Persistent profile info
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("Guesser");

  // Core navigation state
  const [gameMode, setGameMode] = useState<"home" | "single" | "local" | "online">("home");
  const [showInstructions, setShowInstructions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft input values
  const [draftCode, setDraftCode] = useState<string>("");

  // PeerJS and WebRTC State
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<any>(null);
  const [isHost, setIsHost] = useState<boolean>(false);

  // QR Scanner State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  // Online Multiplayer State
  const [roomCodeInput, setRoomCodeInput] = useState<string>("");
  const [activeRoom, setActiveRoom] = useState<GameRoom | null>(null);
  const [onlineScratch, setOnlineScratch] = useState<ScratchpadState>(initialScratchpad());

  // Single Player (vs AI) State
  const [singlePlayer, setSinglePlayer] = useState<SinglePlayerState | null>(null);
  const [singleScratch, setSingleScratch] = useState<ScratchpadState>(initialScratchpad());
  const [aiThinking, setAiThinking] = useState(false);

  // Local Pass & Play State
  const [localState, setLocalState] = useState<{
    p1Name: string;
    p2Name: string;
    p1Code: string | null;
    p2Code: string | null;
    guesses: Guess[];
    status: "setup" | "playing" | "ended";
    turn: "p1" | "p2";
    winner: "p1" | "p2" | null;
    p1Scratch: ScratchpadState;
    p2Scratch: ScratchpadState;
    handoffActive: boolean; // True during handover transition to cover screen
  } | null>(null);

  // Initialize Player ID and Name from localStorage
  useEffect(() => {
    let pid = localStorage.getItem("doi_player_id");
    if (!pid) {
      pid = generatePlayerId();
      localStorage.setItem("doi_player_id", pid);
    }
    setPlayerId(pid);

    const pName = localStorage.getItem("doi_player_name");
    if (pName) {
      setPlayerName(pName);
    }

    // Check if room code was passed via URL parameters
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      setGameMode("online");
      setRoomCodeInput(roomParam.toUpperCase());
    }
  }, []);

  const handleUpdatePlayerName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem("doi_player_name", name);
  };

  // --- ONLINE MULTIPLAYER ACTIONS ---

  const cleanupPeerConnection = () => {
    if (connRef.current) {
      try {
        connRef.current.close();
      } catch (e) {}
      connRef.current = null;
    }
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (e) {}
      peerRef.current = null;
    }
    stopQrScanner();
  };

  const startQrScanner = async () => {
    setIsScanning(true);
    setError(null);
    
    // We delay slightly to let the modal or DOM container render
    setTimeout(async () => {
      try {
        const qrScanner = new Html5Qrcode("qr-reader");
        html5QrcodeRef.current = qrScanner;
        
        await qrScanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.75;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            // Success! Stop scanner first
            stopQrScanner();
            // Process the room code
            handleJoinOnlineRoom(decodedText);
          },
          (errorMessage) => {
            // Intermittent scanning noise, ignore
          }
        );
      } catch (err: any) {
        console.error("Camera scan start failure:", err);
        setError(`Camera access failed: ${err.message || "Please ensure camera permissions are allowed."}`);
        setIsScanning(false);
      }
    }, 200);
  };

  const stopQrScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
      } catch (e) {
        console.error("Stop scanner error:", e);
      }
      html5QrcodeRef.current = null;
    }
    setIsScanning(false);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupPeerConnection();
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const setupConnectionListeners = (conn: any, hostRole: boolean, code: string) => {
    conn.on("open", () => {
      setError(null);
      if (!hostRole) {
        // Guest sends JOIN message once connection is open
        conn.send({
          type: "JOIN",
          playerId,
          playerName: playerName.trim().slice(0, 16),
        });
      }
    });

    conn.on("data", (data: any) => {
      handleIncomingData(data, hostRole, code);
    });

    conn.on("close", () => {
      setError("Opponent disconnected. Signal lost.");
      handleOnlineLeave();
    });

    conn.on("error", (err: any) => {
      setError(`Signal transmission error: ${err.message || "Unknown"}`);
      handleOnlineLeave();
    });
  };

  const handleIncomingData = (data: any, hostRole: boolean, code: string) => {
    if (!data || !data.type) return;

    switch (data.type) {
      case "JOIN": {
        if (hostRole) {
          // Host receives join request
          setActiveRoom((prevRoom) => {
            if (!prevRoom) return null;
            
            // Check if player already in lobby
            const exists = prevRoom.players.some((p) => p.id === data.playerId);
            if (exists) return prevRoom;

            const updatedPlayers = [
              ...prevRoom.players,
              { id: data.playerId, name: data.playerName, secretCode: null },
            ];

            const updatedRoom: GameRoom = {
              ...prevRoom,
              players: updatedPlayers,
              status: "setup", // transition to setup phase since we have 2 players!
              updatedAt: Date.now(),
            };

            // Send full room state back to guest
            setTimeout(() => {
              connRef.current?.send({
                type: "ROOM_STATE",
                room: updatedRoom,
              });
            }, 100);

            return updatedRoom;
          });
        }
        break;
      }

      case "ROOM_STATE": {
        if (!hostRole) {
          // Guest receives room state update from host
          setActiveRoom(data.room);
        }
        break;
      }

      case "LOCK_CODE": {
        // A player has locked their secret code
        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;

          const updatedPlayers = prevRoom.players.map((p) => {
            if (p.id === data.playerId) {
              return { ...p, secretCode: "LOCKED" }; // hide code but mark as locked
            }
            return p;
          });

          // Check if both sides are ready
          const allLocked = updatedPlayers.every((p) => p.secretCode !== null);
          let newStatus = prevRoom.status;
          let newTurn = prevRoom.turn;

          if (allLocked && updatedPlayers.length === 2) {
            newStatus = "playing";
            // Host chooses random first turn
            if (hostRole) {
              const firstTurnIndex = Math.floor(Math.random() * 2);
              newTurn = updatedPlayers[firstTurnIndex].id;

              // Broadcast start game to guest
              setTimeout(() => {
                connRef.current?.send({
                  type: "START_GAME",
                  turn: newTurn,
                });
              }, 100);
            }
          }

          return {
            ...prevRoom,
            players: updatedPlayers,
            status: newStatus,
            turn: newTurn,
            updatedAt: Date.now(),
          };
        });
        break;
      }

      case "START_GAME": {
        if (!hostRole) {
          // Guest transitions to playing state with selected turn
          setActiveRoom((prevRoom) => {
            if (!prevRoom) return null;
            return {
              ...prevRoom,
              status: "playing",
              turn: data.turn,
              updatedAt: Date.now(),
            };
          });
        }
        break;
      }

      case "GUESS": {
        // Receive guess from peer
        // Calculate score against our own secret code
        const opponentGuessCode = data.code;
        
        // Find our secret code
        const mySecretCode = localStorage.getItem(`doi_secret_code_${code}`) || draftCode;
        if (!mySecretCode) {
          setError("Synchronization lost: Local lock code is undefined.");
          return;
        }

        const score = calculateScore(opponentGuessCode, mySecretCode);

        // Create new guess object
        const newGuess: Guess = {
          playerId: data.playerId,
          code: opponentGuessCode,
          dead: score.dead,
          injured: score.injured,
          timestamp: Date.now(),
        };

        // If dead is 4, game ended (opponent wins)
        const gameEnded = score.dead === 4;

        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;

          const updatedGuesses = [...prevRoom.guesses, newGuess];
          let newStatus = prevRoom.status;
          let winnerId = prevRoom.winnerId;
          let nextTurn = prevRoom.turn;

          if (gameEnded) {
            newStatus = "ended";
            winnerId = data.playerId;
            nextTurn = null;

            // Send GAME_OVER with our secret code so opponent can display it
            setTimeout(() => {
              connRef.current?.send({
                type: "GAME_OVER",
                winnerId: data.playerId,
                opponentSecret: mySecretCode,
                guess: newGuess,
              });
            }, 100);
          } else {
            // Toggle turn back to us
            nextTurn = playerId;

            // Send GUESS_RESULT to opponent
            setTimeout(() => {
              connRef.current?.send({
                type: "GUESS_RESULT",
                guess: newGuess,
                nextTurn: playerId,
              });
            }, 100);
          }

          return {
            ...prevRoom,
            guesses: updatedGuesses,
            status: newStatus,
            winnerId,
            turn: nextTurn,
            updatedAt: Date.now(),
          };
        });
        break;
      }

      case "GUESS_RESULT": {
        // We guessed and got the results back from opponent
        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;
          return {
            ...prevRoom,
            guesses: [...prevRoom.guesses, data.guess],
            turn: data.nextTurn,
            updatedAt: Date.now(),
          };
        });
        break;
      }

      case "GAME_OVER": {
        // Opponent informs us that the game has ended (either we won, or they did)
        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;

          // Update opponent's secretCode so it's shown in the final view
          const updatedPlayers = prevRoom.players.map((p) => {
            if (p.id !== playerId) {
              return { ...p, secretCode: data.opponentSecret };
            }
            return p;
          });

          return {
            ...prevRoom,
            players: updatedPlayers,
            guesses: [...prevRoom.guesses, data.guess],
            status: "ended",
            winnerId: data.winnerId,
            turn: null,
            updatedAt: Date.now(),
          };
        });
        break;
      }

      case "REMATCH": {
        // Opponent wants a rematch, reset everything
        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;
          
          const resetPlayers = prevRoom.players.map((p) => ({
            ...p,
            secretCode: null,
          }));

          return {
            ...prevRoom,
            guesses: [],
            status: "setup",
            turn: null,
            winnerId: null,
            players: resetPlayers,
            updatedAt: Date.now(),
          };
        });
        setOnlineScratch(initialScratchpad());
        setDraftCode("");
        break;
      }

      default:
        break;
    }
  };

  const handleCreateOnlineRoom = () => {
    try {
      setError(null);
      
      // Clean up any existing connection
      cleanupPeerConnection();

      // Generate a clean 4-character room code
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const peerId = `doi-${code}`;
      const peer = new Peer(peerId);
      peerRef.current = peer;
      setIsHost(true);

      peer.on("open", () => {
        const initialRoom: GameRoom = {
          roomId: code,
          players: [{ id: playerId, name: playerName.trim().slice(0, 16), secretCode: null }],
          guesses: [],
          status: "waiting",
          turn: null,
          winnerId: null,
          updatedAt: Date.now(),
        };
        setActiveRoom(initialRoom);
        setDraftCode("");
        setOnlineScratch(initialScratchpad());
      });

      peer.on("connection", (conn) => {
        connRef.current = conn;
        setupConnectionListeners(conn, true, code);
      });

      peer.on("error", (err: any) => {
        console.error("Peer error:", err);
        if (err.type === "unavailable-id") {
          // If ID taken, retry
          handleCreateOnlineRoom();
        } else {
          setError(`Network establishment failed: ${err.message || err.type}`);
          cleanupPeerConnection();
        }
      });

    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleJoinOnlineRoom = (codeOverride?: string) => {
    const rawCode = (codeOverride || roomCodeInput).trim().toUpperCase();
    if (!rawCode) {
      setError("Please enter a room code");
      return;
    }

    // Extract the actual 4-6 character room code if a full URL or query was provided
    let code = rawCode;
    if (rawCode.includes("?ROOM=")) {
      const parts = rawCode.split("?ROOM=");
      if (parts[1]) {
        code = parts[1].split("&")[0];
      }
    } else if (rawCode.includes("ROOM=")) {
      const parts = rawCode.split("ROOM=");
      if (parts[1]) {
        code = parts[1].split("&")[0];
      }
    } else if (rawCode.startsWith("HTTP://") || rawCode.startsWith("HTTPS://")) {
      try {
        const urlObj = new URL(rawCode.toLowerCase());
        const roomParam = urlObj.searchParams.get("room");
        if (roomParam) {
          code = roomParam.toUpperCase();
        }
      } catch (e) {
        // Fallback: search for room code pattern in URL
        const match = rawCode.match(/ROOM=([A-Z0-9]+)/);
        if (match && match[1]) {
          code = match[1];
        }
      }
    }

    // Remove any non-alphanumeric characters
    code = code.replace(/[^A-Z0-9]/g, "");

    if (!code || code.length < 3 || code.startsWith("HTTP")) {
      setError("Invalid room code. Please use a 4-character code (e.g. ABCD) or paste a valid match link.");
      return;
    }

    try {
      setError(null);
      cleanupPeerConnection();

      // Create peer with a random client ID to connect to host
      const peer = new Peer();
      peerRef.current = peer;
      setIsHost(false);

      peer.on("open", () => {
        // Attempt to connect to the host
        const conn = peer.connect(`doi-${code}`);
        connRef.current = conn;
        setupConnectionListeners(conn, false, code);

        // Pre-create local waiting room representation
        setActiveRoom({
          roomId: code,
          players: [
            { id: "HOST_STUB", name: "Awaiting Coordinates...", secretCode: null },
            { id: playerId, name: playerName.trim().slice(0, 16), secretCode: null }
          ],
          guesses: [],
          status: "waiting",
          turn: null,
          winnerId: null,
          updatedAt: Date.now(),
        });
        setOnlineScratch(initialScratchpad());
        setDraftCode("");
      });

      peer.on("error", (err: any) => {
        console.error("Peer join error:", err);
        setError(`Failed to connect to room ${code}. Make sure code is correct.`);
        cleanupPeerConnection();
      });

    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOnlineSetupLock = () => {
    if (!activeRoom) return;
    if (!hasUniqueDigits(draftCode)) {
      setError("Secret code must contain 4 unique digits");
      return;
    }

    // Save our secret code in localStorage
    localStorage.setItem(`doi_secret_code_${activeRoom.roomId}`, draftCode);

    // Update locally
    setActiveRoom((prevRoom) => {
      if (!prevRoom) return null;

      const updatedPlayers = prevRoom.players.map((p) => {
        if (p.id === playerId) {
          return { ...p, secretCode: draftCode };
        }
        return p;
      });

      // Send LOCK_CODE message to opponent
      connRef.current?.send({
        type: "LOCK_CODE",
        playerId,
      });

      // Check if both sides are ready
      const allLocked = updatedPlayers.every((p) => p.secretCode !== null);
      let newStatus = prevRoom.status;
      let newTurn = prevRoom.turn;

      if (allLocked && updatedPlayers.length === 2) {
        newStatus = "playing";
        if (isHost) {
          const firstTurnIndex = Math.floor(Math.random() * 2);
          newTurn = updatedPlayers[firstTurnIndex].id;

          // Broadcast start game to guest
          setTimeout(() => {
            connRef.current?.send({
              type: "START_GAME",
              turn: newTurn,
            });
          }, 100);
        }
      }

      return {
        ...prevRoom,
        players: updatedPlayers,
        status: newStatus,
        turn: newTurn,
        updatedAt: Date.now(),
      };
    });

    setDraftCode("");
    setError(null);
  };

  const handleOnlineGuessSubmit = () => {
    if (!activeRoom) return;
    if (!hasUniqueDigits(draftCode)) {
      setError("Guesses must contain 4 unique digits");
      return;
    }

    // Send guess to opponent
    connRef.current?.send({
      type: "GUESS",
      playerId,
      code: draftCode,
    });

    setDraftCode("");
    setError(null);
  };

  const handleOnlineRematch = () => {
    if (!activeRoom) return;

    // Send REMATCH signal to opponent
    connRef.current?.send({
      type: "REMATCH",
    });

    // Reset locally
    setActiveRoom((prevRoom) => {
      if (!prevRoom) return null;
      
      const resetPlayers = prevRoom.players.map((p) => ({
        ...p,
        secretCode: null,
      }));

      return {
        ...prevRoom,
        guesses: [],
        status: "setup",
        turn: null,
        winnerId: null,
        players: resetPlayers,
        updatedAt: Date.now(),
      };
    });

    setOnlineScratch(initialScratchpad());
    setDraftCode("");
    setError(null);
  };

  const handleOnlineLeave = () => {
    cleanupPeerConnection();
    setActiveRoom(null);
    setGameMode("home");
    setDraftCode("");
  };

  // --- SINGLE PLAYER (VS AI) ACTIONS ---

  const handleStartSinglePlayer = () => {
    setGameMode("single");
    setError(null);
    setDraftCode("");
    setSingleScratch(initialScratchpad());
    setSinglePlayer({
      playerCode: null,
      aiCode: generateRandomCode(),
      guesses: [],
      status: "setup",
      turn: "player",
      winner: null,
      aiGuesses: [],
    });
  };

  const handleSingleSetupLock = () => {
    if (!singlePlayer) return;
    if (!hasUniqueDigits(draftCode)) {
      setError("Secret code must contain 4 unique digits");
      return;
    }

    setSinglePlayer({
      ...singlePlayer,
      playerCode: draftCode,
      status: "playing",
    });
    setDraftCode("");
    setError(null);
  };

  const handleSingleGuessSubmit = () => {
    if (!singlePlayer || !singlePlayer.aiCode || !singlePlayer.playerCode) return;
    if (!hasUniqueDigits(draftCode)) {
      setError("Guesses must contain 4 unique digits");
      return;
    }

    setError(null);
    // Score player guess
    const score = calculateScore(draftCode, singlePlayer.aiCode);
    const playerGuess: Guess = {
      playerId: "player",
      code: draftCode,
      dead: score.dead,
      injured: score.injured,
      timestamp: Date.now(),
    };

    const nextGuesses = [...singlePlayer.guesses, playerGuess];

    if (score.dead === 4) {
      // Player wins!
      setSinglePlayer({
        ...singlePlayer,
        guesses: nextGuesses,
        status: "ended",
        winner: "player",
        turn: null,
      });
      setDraftCode("");
      return;
    }

    // Trigger AI Turn
    setSinglePlayer({
      ...singlePlayer,
      guesses: nextGuesses,
      turn: "ai",
    });
    setDraftCode("");

    // Simulate AI thinking and taking its turn
    setAiThinking(true);
    setTimeout(() => {
      setSinglePlayer((current) => {
        if (!current || current.status !== "playing" || !current.playerCode) return current;

        // Smart guess calculation
        const aiGuessCode = getSmartAIGuess(current.aiGuesses, current.playerCode);
        const aiScore = calculateScore(aiGuessCode, current.playerCode);

        const aiGuess: Guess = {
          playerId: "ai",
          code: aiGuessCode,
          dead: aiScore.dead,
          injured: aiScore.injured,
          timestamp: Date.now(),
        };

        const updatedGuesses = [...current.guesses, aiGuess];
        const updatedAiGuesses = [...current.aiGuesses, aiGuess];

        setAiThinking(false);

        if (aiScore.dead === 4) {
          // AI wins
          return {
            ...current,
            guesses: updatedGuesses,
            aiGuesses: updatedAiGuesses,
            status: "ended",
            winner: "ai",
            turn: null,
          };
        }

        return {
          ...current,
          guesses: updatedGuesses,
          aiGuesses: updatedAiGuesses,
          turn: "player",
        };
      });
    }, 1500);
  };

  // --- LOCAL PASS & PLAY ACTIONS ---

  const handleStartLocalMatch = () => {
    setGameMode("local");
    setError(null);
    setDraftCode("");
    setLocalState({
      p1Name: "Player 1",
      p2Name: "Player 2",
      p1Code: null,
      p2Code: null,
      guesses: [],
      status: "setup",
      turn: "p1",
      winner: null,
      p1Scratch: initialScratchpad(),
      p2Scratch: initialScratchpad(),
      handoffActive: false,
    });
  };

  const handleLocalSetupLock = () => {
    if (!localState) return;
    if (!hasUniqueDigits(draftCode)) {
      setError("Secret code must contain 4 unique digits");
      return;
    }

    if (localState.turn === "p1") {
      // Player 1 locks code, handover to Player 2
      setLocalState({
        ...localState,
        p1Code: draftCode,
        turn: "p2",
        handoffActive: true,
      });
    } else {
      // Player 2 locks code, game starts!
      setLocalState({
        ...localState,
        p2Code: draftCode,
        turn: "p1",
        status: "playing",
        handoffActive: true,
      });
    }
    setDraftCode("");
    setError(null);
  };

  const handleLocalGuessSubmit = () => {
    if (!localState || !localState.p1Code || !localState.p2Code) return;
    if (!hasUniqueDigits(draftCode)) {
      setError("Guesses must contain 4 unique digits");
      return;
    }

    setError(null);
    const isP1 = localState.turn === "p1";
    const targetSecret = isP1 ? localState.p2Code : localState.p1Code;
    const score = calculateScore(draftCode, targetSecret);

    const newGuess: Guess = {
      playerId: isP1 ? "p1" : "p2",
      code: draftCode,
      dead: score.dead,
      injured: score.injured,
      timestamp: Date.now(),
    };

    const nextGuesses = [...localState.guesses, newGuess];

    if (score.dead === 4) {
      // Active player wins
      setLocalState({
        ...localState,
        guesses: nextGuesses,
        status: "ended",
        winner: isP1 ? "p1" : "p2",
      });
    } else {
      // Handover to the other player
      setLocalState({
        ...localState,
        guesses: nextGuesses,
        turn: isP1 ? "p2" : "p1",
        handoffActive: true,
      });
    }
    setDraftCode("");
  };

  // --- RENDERS ---

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* GLOBAL ERROR BANNER */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="bg-red-950/80 border-b border-red-500 text-red-200 px-4 py-3 text-xs font-mono text-center flex items-center justify-center gap-2 relative z-50 uppercase tracking-wider"
          >
            <ShieldAlert className="w-4 h-4 text-red-500 animate-bounce" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="absolute right-4 text-red-400 hover:text-red-200">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HOME PAGE / MAIN MENU */}
      {gameMode === "home" && (
        <MainMenu
          playerName={playerName}
          onUpdatePlayerName={handleUpdatePlayerName}
          onSelectMode={(mode) => {
            if (mode === "single") handleStartSinglePlayer();
            else if (mode === "local") handleStartLocalMatch();
            else setGameMode("online");
          }}
          onShowInstructions={() => setShowInstructions(true)}
        />
      )}

      {/* ONLINE LOBBY / MULTIPLAYER CONNECTIONS */}
      {gameMode === "online" && !activeRoom && (
        <div className="flex flex-col items-center justify-center p-4 min-h-[85vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-800">
              <ArrowLeft
                className="w-5 h-5 text-slate-400 hover:text-slate-100 cursor-pointer"
                onClick={() => {
                  stopQrScanner();
                  setGameMode("home");
                }}
              />
              <h2 className="text-md font-mono font-bold uppercase tracking-wider text-slate-300">
                TACTICAL ONLINE DUEL
              </h2>
            </div>

            <p className="text-xs text-slate-400 font-mono uppercase tracking-tight mb-6">
              Establish a secure code-breaker room or coordinate join protocol.
            </p>

            <div className="space-y-4">
              {/* Host room option */}
              <button
                onClick={handleCreateOnlineRoom}
                className="w-full h-12 bg-emerald-950/30 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 hover:border-emerald-500 rounded-xl font-mono text-sm font-bold tracking-widest text-emerald-400 transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.05)] cursor-pointer"
              >
                <Play className="w-4 h-4" />
                CREATE CO-OP LOBBY
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800/60"></div>
                <span className="flex-shrink mx-4 text-slate-600 text-[10px] font-mono tracking-widest uppercase">
                  OR JOIN SESSION
                </span>
                <div className="flex-grow border-t border-slate-800/60"></div>
              </div>

              {/* Join input option */}
              <div className="space-y-2">
                <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
                  ROOM ACCESS CODE OR MATCH LINK
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomCodeInput}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      if (val.includes("?ROOM=")) {
                        const parts = val.split("?ROOM=");
                        if (parts[1]) {
                          setRoomCodeInput(parts[1].split("&")[0].slice(0, 6));
                        }
                      } else if (val.includes("ROOM=")) {
                        const parts = val.split("ROOM=");
                        if (parts[1]) {
                          setRoomCodeInput(parts[1].split("&")[0].slice(0, 6));
                        }
                      } else {
                        setRoomCodeInput(val);
                      }
                    }}
                    placeholder="E.G. KXYZ"
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 text-center font-mono font-bold tracking-widest text-lg text-emerald-400 uppercase focus:outline-none placeholder:text-slate-800"
                    maxLength={300}
                  />
                  <button
                    onClick={() => handleJoinOnlineRoom()}
                    className="px-6 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl font-mono text-xs font-bold text-slate-200 uppercase tracking-wider transition-all cursor-pointer"
                  >
                    JOIN
                  </button>
                </div>
              </div>

              {/* Scan QR Code button option */}
              <div className="pt-2">
                <button
                  onClick={isScanning ? stopQrScanner : startQrScanner}
                  className={`w-full h-11 border rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                    isScanning
                      ? "bg-rose-950/40 border-rose-500/30 text-rose-400 hover:bg-rose-900/40"
                      : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  {isScanning ? "CANCEL CAMERA SCAN" : "SCAN INVITE QR CODE"}
                </button>
              </div>

              {/* Live QR Viewfinder Portal */}
              <AnimatePresence>
                {isScanning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col items-center gap-3"
                  >
                    <div className="text-center">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest animate-pulse flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        CAMERA FEED FEEDBACK ACTIVE
                      </p>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-tight mt-0.5">
                        CENTER THE HOST'S INVITE QR CODE WITHIN THE VIEWPORT
                      </p>
                    </div>

                    {/* Scanner container element with custom styling */}
                    <div className="relative w-64 h-64 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 flex items-center justify-center shadow-inner">
                      {/* Interactive Target Reticle Corners */}
                      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-500 z-10" />
                      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-500 z-10" />
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-500 z-10" />
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-500 z-10" />
                      
                      {/* Laser Line Scan effect */}
                      <div className="absolute w-full h-[1.5px] bg-emerald-400/80 left-0 animate-scan shadow-[0_0_8px_rgba(16,185,129,0.8)] z-10 pointer-events-none" />

                      {/* Actual Html5Qrcode rendering target */}
                      <div id="qr-reader" className="w-full h-full object-cover [&_video]:object-cover" />
                    </div>

                    <button
                      onClick={stopQrScanner}
                      className="text-[10px] font-mono text-rose-400 hover:text-rose-300 uppercase tracking-wider cursor-pointer"
                    >
                      ABORT FEED
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}

      {/* ONLINE ROOM WAITING LOBBY */}
      {gameMode === "online" && activeRoom && activeRoom.status === "waiting" && (
        <RoomLobby
          room={activeRoom}
          playerId={playerId}
          onLeave={handleOnlineLeave}
        />
      )}

      {/* ONLINE MATCHMAKING ACTIVE BATTLE & SETUP */}
      {gameMode === "online" && activeRoom && activeRoom.status !== "waiting" && (
        <div className="flex-1 max-w-6xl w-full mx-auto p-4 flex flex-col md:grid md:grid-cols-12 gap-5 min-h-[90vh]">
          {/* Top Info Bar (Takes full width in mobile, grid in desktop) */}
          <div className="col-span-12 flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900/40 border border-slate-900 rounded-xl gap-3">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 font-mono text-xs rounded-md">
                ROOM: {activeRoom.roomId}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Opponent:{" "}
                <span className="text-slate-100 font-bold uppercase">
                  {activeRoom.players.find((p) => p.id !== playerId)?.name || "Opponent"}
                </span>
              </span>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 font-mono text-xs">
              {activeRoom.status === "playing" && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">TURN STATE:</span>
                  {activeRoom.turn === playerId ? (
                    <span className="text-emerald-400 font-bold animate-pulse uppercase tracking-wider">
                      ★ YOUR TERMINAL ACTIVE
                    </span>
                  ) : (
                    <span className="text-amber-500 font-bold uppercase tracking-wider">
                      OPPONENT TRANSMITTING...
                    </span>
                  )}
                </div>
              )}
              <button
                onClick={handleOnlineLeave}
                className="text-xs text-red-400 hover:text-red-300 uppercase cursor-pointer"
              >
                LEAVE DUEL
              </button>
            </div>
          </div>

          {/* SETUP LOCK SCREEN */}
          {activeRoom.status === "setup" && (
            <div className="col-span-12 flex flex-col items-center justify-center py-10">
              <div className="w-full max-w-md">
                {activeRoom.players.find((p) => p.id === playerId)?.hasSubmittedCode ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center"
                  >
                    <Lock className="w-12 h-12 text-emerald-400 mx-auto animate-pulse mb-4" />
                    <h3 className="font-display font-bold text-lg text-slate-100 uppercase tracking-wide">
                      Your code is secure
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-2 uppercase tracking-normal leading-relaxed">
                      LOCKED AND ENCRYPTED. Awaiting opponent code authorization protocol.
                    </p>
                  </motion.div>
                ) : (
                  <TactileKeyboard
                    value={draftCode}
                    onChange={setDraftCode}
                    onSubmit={handleOnlineSetupLock}
                    title="SET YOUR SECRET 4-DIGIT UNIQUE CODE"
                    submitLabel="LOCK CODE IN SAFE"
                  />
                )}
              </div>
            </div>
          )}

          {/* ACTIVE PLAY PROTOCOL */}
          {activeRoom.status === "playing" && (
            <>
              {/* Left Column: Log and Input */}
              <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
                {/* Battle Logs Dashboard */}
                <div className="flex-1 bg-slate-900/20 border border-slate-900 rounded-xl p-4">
                  <BattleLogs
                    guesses={activeRoom.guesses}
                    playerId={playerId}
                    opponentId={activeRoom.players.find((p) => p.id !== playerId)?.id || null}
                    opponentName={activeRoom.players.find((p) => p.id !== playerId)?.name || "Opponent"}
                    playerName="YOU"
                  />
                </div>

                {/* Tactile Keypad */}
                <TactileKeyboard
                  value={draftCode}
                  onChange={setDraftCode}
                  onSubmit={handleOnlineGuessSubmit}
                  disabled={activeRoom.turn !== playerId}
                  title={
                    activeRoom.turn === playerId
                      ? "YOUR TURN: ENTER 4-DIGIT CODE TO GUESS"
                      : "OPPONENT'S TURN: ANALYZING COMBINATIONS"
                  }
                  submitLabel="TRANSMIT GUESS CODE"
                />
              </div>

              {/* Right Column: Scratchpad (Sticky) */}
              <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
                <Scratchpad state={onlineScratch} onChange={setOnlineScratch} />
              </div>
            </>
          )}

          {/* ENDED / ENDGAME RECAP SCREEN */}
          {activeRoom.status === "ended" && (
            <div className="col-span-12 flex flex-col items-center justify-center py-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl text-center"
              >
                {activeRoom.winnerId === playerId ? (
                  <div className="mb-4">
                    <div className="w-14 h-14 bg-emerald-950/60 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-bounce">
                      🏆
                    </div>
                    <h2 className="text-2xl font-display font-bold text-emerald-400 uppercase tracking-tight">
                      TACTICAL VICTORY
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-widest">
                      Enemy lock completely deciphered!
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <div className="w-14 h-14 bg-red-950/60 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto text-red-500 mb-3 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse">
                      ☠
                    </div>
                    <h2 className="text-2xl font-display font-bold text-red-400 uppercase tracking-tight">
                      SYSTEM DEFEAT
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-widest">
                      Enemy cracked your lock first!
                    </p>
                  </div>
                )}

                {/* Match summaries codes */}
                <div className="grid grid-cols-2 gap-3 my-6 p-4 bg-slate-950/40 border border-slate-900 rounded-xl font-mono text-xs">
                  <div>
                    <span className="text-slate-600 block uppercase text-[9px] tracking-widest">
                      YOUR LOCK
                    </span>
                    <span className="text-slate-200 text-lg font-bold">
                      {activeRoom.players.find((p) => p.id === playerId)?.secretCode || "UNKNOWN"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 block uppercase text-[9px] tracking-widest">
                      ENEMY LOCK
                    </span>
                    <span className="text-emerald-400 text-lg font-bold">
                      {activeRoom.players.find((p) => p.id !== playerId)?.secretCode || "UNKNOWN"}
                    </span>
                  </div>
                </div>

                {/* Action Rematch / Leave */}
                <div className="space-y-3">
                  <button
                    onClick={handleOnlineRematch}
                    className="w-full h-11 bg-emerald-500 text-slate-950 hover:bg-emerald-400 border border-emerald-500 rounded-xl font-mono text-xs font-bold uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                  >
                    INITIATE REMATCH
                  </button>
                  <button
                    onClick={handleOnlineLeave}
                    className="w-full h-11 border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-400 hover:text-slate-200 font-mono text-xs font-bold uppercase rounded-xl cursor-pointer"
                  >
                    RETURN TO HOME
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* VS AI (SINGLE PLAYER) INTERFACES */}
      {gameMode === "single" && singlePlayer && (
        <div className="flex-1 max-w-6xl w-full mx-auto p-4 flex flex-col md:grid md:grid-cols-12 gap-5 min-h-[90vh]">
          {/* Header Dashboard */}
          <div className="col-span-12 flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900/40 border border-slate-900 rounded-xl gap-3">
            <div className="flex items-center gap-3">
              <ArrowLeft
                className="w-5 h-5 text-slate-400 hover:text-slate-100 cursor-pointer"
                onClick={() => setGameMode("home")}
              />
              <span className="px-2.5 py-1 bg-amber-950/40 border border-amber-500/20 text-amber-400 font-mono text-xs rounded-md">
                SOLO VS COGNITIVE AI
              </span>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 font-mono text-xs">
              {singlePlayer.status === "playing" && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">TURN STATE:</span>
                  {singlePlayer.turn === "player" ? (
                    <span className="text-emerald-400 font-bold animate-pulse uppercase tracking-wider">
                      ★ DECODER ACTIVE
                    </span>
                  ) : (
                    <span className="text-amber-500 font-bold uppercase tracking-wider">
                      AI CRUNCHING DATA...
                    </span>
                  )}
                </div>
              )}
              <button
                onClick={() => setGameMode("home")}
                className="text-xs text-red-400 hover:text-red-300 uppercase cursor-pointer"
              >
                ABORT PROTOCOL
              </button>
            </div>
          </div>

          {/* Setup Lock Code Form */}
          {singlePlayer.status === "setup" && (
            <div className="col-span-12 flex flex-col items-center justify-center py-10">
              <div className="w-full max-w-md">
                <TactileKeyboard
                  value={draftCode}
                  onChange={setDraftCode}
                  onSubmit={handleSingleSetupLock}
                  title="SET YOUR SECRET 4-DIGIT UNIQUE CODE (THE AI CANNOT CHEAT)"
                  submitLabel="LOCK CODE IN SECURE CELL"
                />
              </div>
            </div>
          )}

          {/* Active play loop */}
          {singlePlayer.status === "playing" && (
            <>
              {/* Left Column: Log and Input */}
              <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
                {/* Battle Logs Dashboard */}
                <div className="flex-1 bg-slate-900/20 border border-slate-900 rounded-xl p-4">
                  <BattleLogs
                    guesses={singlePlayer.guesses}
                    playerId="player"
                    opponentId="ai"
                    opponentName="COGNITIVE AI"
                    playerName="YOU"
                  />
                </div>

                {/* Tactile Keypad */}
                <TactileKeyboard
                  value={draftCode}
                  onChange={setDraftCode}
                  onSubmit={handleSingleGuessSubmit}
                  disabled={singlePlayer.turn !== "player" || aiThinking}
                  title={
                    singlePlayer.turn === "player"
                      ? "YOUR TURN: ENTER 4-DIGIT CODE TO GUESS"
                      : "AI ANALYZING TRANS-ARRAY CANDIDATES"
                  }
                  submitLabel="TRANSMIT GUESS CODE"
                />
              </div>

              {/* Right Column: Scratchpad (Sticky) */}
              <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
                <Scratchpad state={singleScratch} onChange={setSingleScratch} />
              </div>
            </>
          )}

          {/* Ending screen VS AI */}
          {singlePlayer.status === "ended" && (
            <div className="col-span-12 flex flex-col items-center justify-center py-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl text-center"
              >
                {singlePlayer.winner === "player" ? (
                  <div className="mb-4">
                    <div className="w-14 h-14 bg-emerald-950/60 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-bounce">
                      🏆
                    </div>
                    <h2 className="text-2xl font-display font-bold text-emerald-400 uppercase tracking-tight">
                      TACTICAL VICTORY
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-widest">
                      AI security completely decimated!
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <div className="w-14 h-14 bg-red-950/60 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto text-red-500 mb-3 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse">
                      ☠
                    </div>
                    <h2 className="text-2xl font-display font-bold text-red-400 uppercase tracking-tight">
                      SYSTEM DEFEAT
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-widest">
                      AI solved your encryption structure first!
                    </p>
                  </div>
                )}

                {/* Match summaries codes */}
                <div className="grid grid-cols-2 gap-3 my-6 p-4 bg-slate-950/40 border border-slate-900 rounded-xl font-mono text-xs">
                  <div>
                    <span className="text-slate-600 block uppercase text-[9px] tracking-widest">
                      YOUR LOCK
                    </span>
                    <span className="text-slate-200 text-lg font-bold">
                      {singlePlayer.playerCode}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 block uppercase text-[9px] tracking-widest">
                      AI LOCK
                    </span>
                    <span className="text-emerald-400 text-lg font-bold">
                      {singlePlayer.aiCode}
                    </span>
                  </div>
                </div>

                {/* Action Rematch / Leave */}
                <div className="space-y-3">
                  <button
                    onClick={handleStartSinglePlayer}
                    className="w-full h-11 bg-emerald-500 text-slate-950 hover:bg-emerald-400 border border-emerald-500 rounded-xl font-mono text-xs font-bold uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                  >
                    INITIATE PRACTICE REMATCH
                  </button>
                  <button
                    onClick={() => setGameMode("home")}
                    className="w-full h-11 border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-400 hover:text-slate-200 font-mono text-xs font-bold uppercase rounded-xl cursor-pointer"
                  >
                    RETURN TO MAIN MENU
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* LOCAL PASS AND PLAY MODE */}
      {gameMode === "local" && localState && (
        <div className="flex-1 max-w-6xl w-full mx-auto p-4 flex flex-col md:grid md:grid-cols-12 gap-5 min-h-[90vh]">
          {/* Header */}
          <div className="col-span-12 flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-900/40 border border-slate-900 rounded-xl gap-3">
            <div className="flex items-center gap-3">
              <ArrowLeft
                className="w-5 h-5 text-slate-400 hover:text-slate-100 cursor-pointer"
                onClick={() => setGameMode("home")}
              />
              <span className="px-2.5 py-1 bg-blue-950/40 border border-blue-500/20 text-blue-400 font-mono text-xs rounded-md">
                LOCAL DUEL (PASS & PLAY)
              </span>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 font-mono text-xs">
              {localState.status === "playing" && !localState.handoffActive && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">ACTIVE CONTROLS:</span>
                  <span className="text-blue-400 font-bold uppercase tracking-wider">
                    {localState.turn === "p1" ? localState.p1Name : localState.p2Name}'S TERMINAL
                  </span>
                </div>
              )}
              <button
                onClick={() => setGameMode("home")}
                className="text-xs text-red-400 hover:text-red-300 uppercase cursor-pointer"
              >
                TERMINATE MATCH
              </button>
            </div>
          </div>

          {/* INTERSTITIAL HANDOFF SCREEN (CRITICAL FOR PRIVATE VIEWS!) */}
          {localState.handoffActive ? (
            <div className="col-span-12 flex flex-col items-center justify-center py-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl"
              >
                <div className="w-16 h-16 bg-blue-950/60 border-2 border-blue-500 rounded-full flex items-center justify-center mx-auto text-blue-400 mb-6 shadow-[0_0_15px_rgba(59,130,246,0.3)] animate-pulse">
                  🔄
                </div>

                <h3 className="text-2xl font-display font-bold text-slate-200 uppercase tracking-tight">
                  SCREEN LOCK ENGAGED
                </h3>

                <p className="text-sm text-slate-400 font-mono mt-3 uppercase tracking-normal leading-relaxed">
                  {localState.status === "setup" ? (
                    <>
                      HAND THE DEVICE OVER TO{" "}
                      <span className="text-blue-400 font-extrabold">{localState.p2Name}</span> TO
                      INITIATE CODES.
                    </>
                  ) : (
                    <>
                      HAND THE DEVICE OVER TO{" "}
                      <span className="text-blue-400 font-extrabold">
                        {localState.turn === "p1" ? localState.p1Name : localState.p2Name}
                      </span>
                      .
                    </>
                  )}
                </p>

                <p className="text-xs text-slate-600 font-mono mt-6 uppercase tracking-wider italic">
                  * DO NOT CHEAT OR PEEK AT TERMINAL STATES *
                </p>

                <button
                  onClick={() => setLocalState({ ...localState, handoffActive: false })}
                  className="w-full h-12 mt-8 bg-blue-500 text-slate-950 hover:bg-blue-400 font-mono font-bold tracking-widest text-sm uppercase rounded-xl cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.2)] active:scale-95 transition-all"
                >
                  CONFIRM MY IDENTITY
                </button>
              </motion.div>
            </div>
          ) : (
            <>
              {/* LOCK/SETUP SCREEN */}
              {localState.status === "setup" && (
                <div className="col-span-12 flex flex-col items-center justify-center py-10">
                  <div className="w-full max-w-md">
                    <TactileKeyboard
                      value={draftCode}
                      onChange={setDraftCode}
                      onSubmit={handleLocalSetupLock}
                      title={`LOCK SECRET: ${
                        localState.turn === "p1" ? localState.p1Name : localState.p2Name
                      }, ENTER YOUR 4-DIGIT CODE`}
                      submitLabel="LOCK CODE IN SECURE CELL"
                    />
                  </div>
                </div>
              )}

              {/* PLAY PHASE */}
              {localState.status === "playing" && (
                <>
                  {/* Left Column: Log and Input */}
                  <div className="col-span-12 md:col-span-7 flex flex-col gap-4">
                    {/* Battle Logs Dashboard */}
                    <div className="flex-1 bg-slate-900/20 border border-slate-900 rounded-xl p-4">
                      <BattleLogs
                        guesses={localState.guesses}
                        playerId={localState.turn}
                        opponentId={localState.turn === "p1" ? "p2" : "p1"}
                        opponentName={localState.turn === "p1" ? localState.p2Name : localState.p1Name}
                        playerName="YOU"
                      />
                    </div>

                    {/* Tactile Keypad */}
                    <TactileKeyboard
                      value={draftCode}
                      onChange={setDraftCode}
                      onSubmit={handleLocalGuessSubmit}
                      title={`${
                        localState.turn === "p1" ? localState.p1Name : localState.p2Name
                      }: INPUT GUESS`}
                      submitLabel="TRANSMIT GUESS CODE"
                    />
                  </div>

                  {/* Right Column: Scratchpad */}
                  <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
                    <Scratchpad
                      state={localState.turn === "p1" ? localState.p1Scratch : localState.p2Scratch}
                      onChange={(newScratch) => {
                        setLocalState({
                          ...localState,
                          p1Scratch: localState.turn === "p1" ? newScratch : localState.p1Scratch,
                          p2Scratch: localState.turn === "p2" ? newScratch : localState.p2Scratch,
                        });
                      }}
                    />
                  </div>
                </>
              )}

              {/* GAME OVER */}
              {localState.status === "ended" && (
                <div className="col-span-12 flex flex-col items-center justify-center py-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl text-center"
                  >
                    <div className="mb-4">
                      <div className="w-14 h-14 bg-emerald-950/60 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-bounce">
                        🏆
                      </div>
                      <h2 className="text-2xl font-display font-bold text-emerald-400 uppercase tracking-tight">
                        TACTICAL VICTORY
                      </h2>
                      <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-widest">
                        {localState.winner === "p1" ? localState.p1Name : localState.p2Name} is the Master Codebreaker!
                      </p>
                    </div>

                    {/* Match summaries codes */}
                    <div className="grid grid-cols-2 gap-3 my-6 p-4 bg-slate-950/40 border border-slate-900 rounded-xl font-mono text-xs">
                      <div>
                        <span className="text-slate-600 block uppercase text-[9px] tracking-widest">
                          {localState.p1Name}'S LOCK
                        </span>
                        <span className="text-slate-200 text-lg font-bold">
                          {localState.p1Code}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-600 block uppercase text-[9px] tracking-widest">
                          {localState.p2Name}'S LOCK
                        </span>
                        <span className="text-emerald-400 text-lg font-bold">
                          {localState.p2Code}
                        </span>
                      </div>
                    </div>

                    {/* Action Rematch / Leave */}
                    <div className="space-y-3">
                      <button
                        onClick={handleStartLocalMatch}
                        className="w-full h-11 bg-emerald-500 text-slate-950 hover:bg-emerald-400 border border-emerald-500 rounded-xl font-mono text-xs font-bold uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                      >
                        INITIATE NEW DUEL
                      </button>
                      <button
                        onClick={() => setGameMode("home")}
                        className="w-full h-11 border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-400 hover:text-slate-200 font-mono text-xs font-bold uppercase rounded-xl cursor-pointer"
                      >
                        RETURN TO MAIN MENU
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* HOW TO PLAY INSTRUCTION OVERLAY PANEL */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative"
            >
              <button
                onClick={() => setShowInstructions(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                <HelpCircle className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h3 className="text-md font-mono font-bold uppercase text-slate-200">
                  DECODE SYSTEM MANUAL
                </h3>
              </div>

              <div className="font-mono text-xs text-slate-400 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div>
                  <h4 className="text-emerald-400 font-bold uppercase mb-1">
                    Phase 1: The Secret Lock
                  </h4>
                  <p className="leading-relaxed">
                    Both you and your opponent secretly choose a 4-digit combination. Every digit
                    must be completely unique. No repeats. (e.g. <span className="text-emerald-400">5724</span> is legal, <span className="text-red-500">5524</span> is illegal due to repeating 5s).
                  </p>
                </div>

                <div>
                  <h4 className="text-emerald-400 font-bold uppercase mb-1">
                    Phase 2: Turns and Strikes
                  </h4>
                  <p className="leading-relaxed">
                    Take turns guessing each other's combination. For every guess, the system
                    returns two metrics:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>
                      <span className="text-emerald-400 font-bold">DEAD:</span> Digit exists in the
                      code and is in the <span className="text-emerald-300">correct position</span>.
                    </li>
                    <li>
                      <span className="text-amber-400 font-bold">INJURED:</span> Digit exists in the
                      code, but is in the <span className="text-amber-300">incorrect position</span>.
                    </li>
                  </ul>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg">
                  <h5 className="font-bold uppercase text-[10px] text-slate-500 mb-1">
                    Real Match Example:
                  </h5>
                  <p className="leading-normal">
                    Opponent Code: <span className="text-slate-200">5724</span>
                    <br />
                    Your Guess Code: <span className="text-slate-200">5279</span>
                  </p>
                  <ul className="list-disc pl-5 mt-1 text-[11px] text-slate-500 space-y-0.5">
                    <li>5 is in the 1st position → <span className="text-emerald-400">1 DEAD</span></li>
                    <li>2 is in the code but wrong position → <span className="text-amber-400">1 INJURED</span></li>
                    <li>7 is in the code but wrong position → <span className="text-amber-400">1 INJURED</span></li>
                    <li>9 is not in the code → Nothing</li>
                    <li>Feedback score: <span className="text-emerald-400">1 Dead, 2 Injured</span></li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-emerald-400 font-bold uppercase mb-1">
                    Phase 3: The Deduction
                  </h4>
                  <p className="leading-relaxed">
                    Use the <span className="text-emerald-400">Tactical Scratchpad</span> to mark off
                    digits you've eliminated (red Trash), digits you are certain exist (green
                    Confirm), or suspects (yellow Maybe) to narrow down possibilities.
                  </p>
                </div>

                <div>
                  <h4 className="text-emerald-400 font-bold uppercase mb-1">
                    Phase 4: Endgame victory
                  </h4>
                  <p className="leading-relaxed">
                    The first codebreaker to decode all 4 digits in their exact correct positions (
                    <span className="text-emerald-400">4 DEAD</span>) wins the game!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowInstructions(false)}
                className="w-full h-11 mt-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold uppercase rounded-xl cursor-pointer"
              >
                ENGAGE DECIPHER PROTOCOLS
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
