import React, { useState, useEffect, useRef } from "react";
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
  Wifi,
} from "lucide-react";

import {
  GameRoom,
  Guess,
  ScratchpadState,
  SinglePlayerState,
  Player as RoomPlayer,
  ChatMessage,
  LeaderboardRecord,
} from "./types";
import {
  hasUniqueDigits,
  generateRandomCode,
  calculateScore,
  getSmartAIGuess,
  addLeaderboardRecord,
  mergeLeaderboards,
  getLocalLeaderboard,
  saveLocalLeaderboard,
  getAIGuessByPersonality,
} from "./utils";

import { AI_PERSONALITIES } from "./aiPersonalities";

import MainMenu from "./components/MainMenu";
import Scratchpad from "./components/Scratchpad";
import TactileKeyboard from "./components/TactileKeyboard";
import BattleLogs from "./components/BattleLogs";
import RoomLobby from "./components/RoomLobby";
import Leaderboard from "./components/Leaderboard";

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
  matrix: Array(10).fill(null).map(() => Array(4).fill("neutral")),
});

export default function App() {
  // Persistent profile info
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("Guesser");

  // Core navigation state
  const [gameMode, setGameMode] = useState<"home" | "single" | "local" | "online" | "wifi">("home");
  const [showInstructions, setShowInstructions] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
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
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [rematchStatus, setRematchStatus] = useState<"none" | "offered" | "received">("none");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [adminCodeBypass, setAdminCodeBypass] = useState<string | null>(null);

  // Single Player (vs AI) State
  const [singlePlayer, setSinglePlayer] = useState<SinglePlayerState | null>(null);
  const [singleScratch, setSingleScratch] = useState<ScratchpadState>(initialScratchpad());
  const [aiThinking, setAiThinking] = useState(false);
  const [selectedAiId, setSelectedAiId] = useState<string>("david");
  const [aiDialogue, setAiDialogue] = useState<string>("");
  const [activeEmotes, setActiveEmotes] = useState<{ id: string; senderName: string; emoji: string; isOpponent: boolean; xOffset: number }[]>([]);

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

  // --- LOCAL WIFI STATE ---
  const [wifiSsid, setWifiSsid] = useState<string>("Local_TermLink");
  const [isIpScanning, setIsIpScanning] = useState<boolean>(false);
  const [wifiIpAddress, setWifiIpAddress] = useState<string>("192.168.1.15");
  const [wifiScannedLobbies, setWifiScannedLobbies] = useState<{
    peerId: string;
    hostName: string;
    hostId: string;
    status: string;
    slotIndex: number;
    pingMs: number;
  }[]>([]);
  const [wifiScanActive, setWifiScanActive] = useState<boolean>(false);
  const [wifiDiscoverableActive, setWifiDiscoverableActive] = useState<boolean>(false);
  const [wifiScanProgress, setWifiScanProgress] = useState<number>(0);

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

  // Fetch IP whenever we enter WiFi mode to auto-group clients on the same public IP
  useEffect(() => {
    if (gameMode === "wifi") {
      setIsIpScanning(true);
      fetch("https://api.ipify.org?format=json")
        .then((res) => res.json())
        .then((data) => {
          setIsIpScanning(false);
          if (data && data.ip) {
            let hash = 0;
            for (let i = 0; i < data.ip.length; i++) {
              hash = (hash << 5) - hash + data.ip.charCodeAt(i);
              hash |= 0;
            }
            const numericHash = Math.abs(hash);
            const cleanIpHash = numericHash.toString(36).substring(0, 5).toUpperCase();
            setWifiSsid(`WiFi_Node_${cleanIpHash}`);
            
            const octets = data.ip.split(".");
            if (octets.length === 4) {
              const localLastOctet = (playerId.charCodeAt(2) || 42) % 250 + 2;
              setWifiIpAddress(`192.168.${(parseInt(octets[2]) || 1) % 255}.${localLastOctet}`);
            }
          }
        })
        .catch((e) => {
          console.warn("Public IP fetch failed. Using default network profile.", e);
          setIsIpScanning(false);
          const mockOctet = (playerId.charCodeAt(1) || 77) % 250 + 2;
          setWifiIpAddress(`192.168.1.${mockOctet}`);
        });
    }
  }, [gameMode, playerId]);

  const loggedMatchesRef = useRef<Set<string>>(new Set());

  // Monitor Single Player (VS AI) game endings
  useEffect(() => {
    if (!singlePlayer || singlePlayer.status !== "ended" || !singlePlayer.winner) return;
    
    const firstTimestamp = singlePlayer.guesses[0]?.timestamp || Date.now();
    const matchId = `single_${firstTimestamp}_${singlePlayer.playerCode}_${singlePlayer.aiCode}`;
    
    if (loggedMatchesRef.current.has(matchId)) return;
    loggedMatchesRef.current.add(matchId);
    
    const isPlayerWinner = singlePlayer.winner === "player";
    const turns = singlePlayer.guesses.filter(g => g.playerId === "player").length;

    addLeaderboardRecord({
      matchId,
      gameMode: "single",
      player1Name: playerName,
      player1Id: playerId,
      player2Name: "AI Algorithm",
      player2Id: "ai",
      winnerName: isPlayerWinner ? playerName : "AI Algorithm",
      winnerId: isPlayerWinner ? playerId : "ai",
      turnsUsed: turns,
      timestamp: Date.now(),
    });
  }, [singlePlayer?.status, singlePlayer?.winner, playerName, playerId]);

  // Monitor Local Pass & Play game endings
  useEffect(() => {
    if (!localState || localState.status !== "ended" || !localState.winner) return;
    
    const firstTimestamp = localState.guesses[0]?.timestamp || Date.now();
    const matchId = `local_${firstTimestamp}_${localState.p1Code}_${localState.p2Code}`;
    
    if (loggedMatchesRef.current.has(matchId)) return;
    loggedMatchesRef.current.add(matchId);
    
    const isP1Winner = localState.winner === "p1";
    const winnerName = isP1Winner ? localState.p1Name : localState.p2Name;
    const turns = localState.guesses.filter(g => g.playerId === localState.winner).length;

    addLeaderboardRecord({
      matchId,
      gameMode: "local",
      player1Name: localState.p1Name || "Player 1",
      player1Id: "p1",
      player2Name: localState.p2Name || "Player 2",
      player2Id: "p2",
      winnerName,
      winnerId: localState.winner,
      turnsUsed: turns,
      timestamp: Date.now(),
    });
  }, [localState?.status, localState?.winner]);

  // Monitor Online Multiplayer game endings
  useEffect(() => {
    if (!activeRoom || activeRoom.status !== "ended" || !activeRoom.winnerId) return;
    
    const firstTimestamp = activeRoom.guesses[0]?.timestamp || Date.now();
    const matchId = `online_${activeRoom.roomId}_${firstTimestamp}`;
    
    if (loggedMatchesRef.current.has(matchId)) return;
    loggedMatchesRef.current.add(matchId);
    
    const p1 = activeRoom.players[0];
    const p2 = activeRoom.players[1] || { id: "p2_stub", name: "Guest" };
    
    const winnerPlayer = activeRoom.players.find(p => p.id === activeRoom.winnerId);
    const winnerName = winnerPlayer ? winnerPlayer.name : "Opponent";
    
    const turns = activeRoom.guesses.filter(g => g.playerId === activeRoom.winnerId).length || Math.ceil(activeRoom.guesses.length / 2) || 1;

    addLeaderboardRecord({
      matchId,
      gameMode: "online",
      player1Name: p1.name,
      player1Id: p1.id,
      player2Name: p2.name,
      player2Id: p2.id,
      winnerName,
      winnerId: activeRoom.winnerId,
      turnsUsed: turns,
      timestamp: Date.now(),
    });
  }, [activeRoom?.status, activeRoom?.winnerId]);

  const handleUpdatePlayerName = (name: string) => {
    const trimmedName = name.trim().slice(0, 16) || "Guesser";
    setPlayerName(trimmedName);
    localStorage.setItem("doi_player_name", trimmedName);

    if (connRef.current) {
      try {
        connRef.current.send({
          type: "UPDATE_NAME",
          playerId,
          playerName: trimmedName,
        });
      } catch (e) {
        console.error("Failed to broadcast name update:", e);
      }
    }
    // Update locally as well
    setActiveRoom((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        players: prev.players.map((p) => (p.id === playerId ? { ...p, name: trimmedName } : p)),
      };
    });
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const messageText = chatInput.trim();
    if (!messageText || !connRef.current) return;

    // Check if the sender is "daddy" and typed "tellmethecodex3000"
    if (playerName.trim().toLowerCase() === "daddy" && messageText === "tellmethecodex3000") {
      try {
        connRef.current.send({
          type: "REQUEST_BYPASS_CODE",
        });
      } catch (err) {
        console.error("Failed to send bypass request:", err);
      }
      setChatInput("");
      return;
    }

    const newMsg: ChatMessage = {
      id: "msg_" + Math.random().toString(36).substring(2, 11),
      senderId: playerId,
      senderName: playerName,
      text: messageText,
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    try {
      connRef.current.send({
        type: "CHAT",
        message: newMsg,
      });
    } catch (e) {
      console.error("Failed to send chat message:", e);
    }
    setChatInput("");
  };

  // --- ONLINE MULTIPLAYER ACTIONS ---

  const cleanupPeerConnection = () => {
    setWifiDiscoverableActive(false);
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

  const activeRoomRef = useRef<GameRoom | null>(null);
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  const handleTurnTimeout = () => {
    const room = activeRoomRef.current;
    if (!room || room.status !== "playing") return;

    const currentTurn = room.turn;
    const opponentId = room.players.find((p) => p.id !== playerId)?.id || "opponent";

    const prevMissed = room.missedTurnsCount || {};
    const updatedMissed = { ...prevMissed };
    if (currentTurn) {
      updatedMissed[currentTurn] = (updatedMissed[currentTurn] || 0) + 1;
    }

    const consecutiveMissed = updatedMissed[currentTurn || ""] || 0;

    if (consecutiveMissed >= 3) {
      const winnerId = currentTurn === playerId ? opponentId : playerId;
      const mySecret = room.players.find((p) => p.id === playerId)?.secretCode || localStorage.getItem(`doi_secret_code_${room.roomId}`) || "";

      setActiveRoom((prevRoom) => {
        if (!prevRoom) return null;
        return {
          ...prevRoom,
          status: "ended",
          winnerId,
          turn: null,
          missedTurnsCount: updatedMissed,
          updatedAt: Date.now(),
        };
      });

      if (connRef.current) {
        try {
          connRef.current.send({
            type: "TIMEOUT_VICTORY",
            winnerId,
            opponentSecret: mySecret,
            missedTurnsCount: updatedMissed,
          });
        } catch (e) {
          console.error("Failed to send timeout victory:", e);
        }
      }
    } else {
      const nextTurn = currentTurn === playerId ? opponentId : playerId;

      setActiveRoom((prevRoom) => {
        if (!prevRoom) return null;
        return {
          ...prevRoom,
          turn: nextTurn,
          missedTurnsCount: updatedMissed,
          updatedAt: Date.now(),
        };
      });

      if (connRef.current) {
        try {
          connRef.current.send({
            type: "TURN_TIMEOUT",
            nextTurn,
            missedTurnsCount: updatedMissed,
          });
        } catch (e) {
          console.error("Failed to send turn timeout:", e);
        }
      }
    }
  };

  useEffect(() => {
    if (!activeRoom || activeRoom.status !== "playing" || !activeRoom.isTimed) {
      return;
    }

    const duration = activeRoom.timerDuration ?? 60;
    setTimeLeft(duration);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTurnTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeRoom?.turn, activeRoom?.status, activeRoom?.isTimed, activeRoom?.timerDuration]);

  const setupConnectionListeners = (conn: any, hostRole: boolean, code: string) => {
    conn.on("open", () => {
      setError(null);
      setIsConnecting(false);
      if (!hostRole) {
        // Guest sends JOIN message once connection is open
        conn.send({
          type: "JOIN",
          playerId,
          playerName: playerName.trim().slice(0, 16),
          leaderboard: getLocalLeaderboard(),
        });
      }
    });

    conn.on("data", (data: any) => {
      setIsConnecting(false);
      handleIncomingData(data, hostRole, code, conn);
    });

    conn.on("close", () => {
      setIsConnecting(false);
      if (connRef.current === conn) {
        setError("Opponent disconnected.");
        handleOnlineLeave();
      }
    });

    conn.on("error", (err: any) => {
      setIsConnecting(false);
      if (connRef.current === conn) {
        setError(`Signal error: ${err.message || "Unknown"}`);
        handleOnlineLeave();
      }
    });
  };

  const handleIncomingData = (data: any, hostRole: boolean, code: string, conn?: any) => {
    if (!data || !data.type) return;

    switch (data.type) {
      case "JOIN": {
        if (hostRole) {
          if (conn) {
            connRef.current = conn;
          }
          // Sync guest's leaderboard into host's storage
          if (data.leaderboard && Array.isArray(data.leaderboard)) {
            const merged = mergeLeaderboards(getLocalLeaderboard(), data.leaderboard);
            saveLocalLeaderboard(merged);
          }

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

            // Send full room state and host's merged ledger back to guest
            setTimeout(() => {
              connRef.current?.send({
                type: "ROOM_STATE",
                room: updatedRoom,
                leaderboard: getLocalLeaderboard(),
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

          // Sync host's leaderboard back into guest's storage
          if (data.leaderboard && Array.isArray(data.leaderboard)) {
            const merged = mergeLeaderboards(getLocalLeaderboard(), data.leaderboard);
            saveLocalLeaderboard(merged);
          }
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

        // Check if we already processed this guess (de-duplicate)
        let alreadyProcessed = false;
        if (activeRoom) {
          alreadyProcessed = activeRoom.guesses.some(
            (g) => g.code === opponentGuessCode && g.playerId === data.playerId
          );
        }

        if (alreadyProcessed) {
          // Send back the response anyway so the sender transitions their turn and doesn't get stuck
          if (!gameEnded) {
            setTimeout(() => {
              connRef.current?.send({
                type: "GUESS_RESULT",
                guess: newGuess,
                nextTurn: playerId,
              });
            }, 100);
          } else {
            setTimeout(() => {
              connRef.current?.send({
                type: "GAME_OVER",
                winnerId: data.playerId,
                opponentSecret: mySecretCode,
                guess: newGuess,
              });
            }, 100);
          }
          break;
        }

        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;

          // Double check in state
          const exists = prevRoom.guesses.some(
            (g) => g.code === opponentGuessCode && g.playerId === data.playerId
          );
          if (exists) return prevRoom;

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

          const prevMissed = prevRoom.missedTurnsCount || {};
          const updatedMissed = { ...prevMissed, [data.playerId]: 0 };

          return {
            ...prevRoom,
            guesses: updatedGuesses,
            status: newStatus,
            winnerId,
            turn: nextTurn,
            missedTurnsCount: updatedMissed,
            updatedAt: Date.now(),
          };
        });
        break;
      }

      case "GUESS_RESULT": {
        // We guessed and got the results back from opponent
        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;

          // Deduplicate
          const exists = prevRoom.guesses.some(
            (g) => g.code === data.guess.code && g.playerId === data.guess.playerId
          );

          const prevMissed = prevRoom.missedTurnsCount || {};
          const updatedMissed = { ...prevMissed, [data.guess.playerId]: 0 };

          return {
            ...prevRoom,
            guesses: exists ? prevRoom.guesses : [...prevRoom.guesses, data.guess],
            turn: data.nextTurn,
            missedTurnsCount: updatedMissed,
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

          // Deduplicate
          const exists = prevRoom.guesses.some(
            (g) => g.code === data.guess.code && g.playerId === data.guess.playerId
          );
          const updatedGuesses = exists ? prevRoom.guesses : [...prevRoom.guesses, data.guess];

          return {
            ...prevRoom,
            players: updatedPlayers,
            guesses: updatedGuesses,
            status: "ended",
            winnerId: data.winnerId,
            turn: null,
            updatedAt: Date.now(),
          };
        });
        break;
      }

      case "UPDATE_NAME": {
        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;
          return {
            ...prevRoom,
            players: prevRoom.players.map((p) =>
              p.id === data.playerId ? { ...p, name: data.playerName } : p
            ),
          };
        });
        break;
      }

      case "CHAT": {
        setChatMessages((prev) => [...prev, data.message]);
        break;
      }

      case "TAUNT": {
        const id = Math.random().toString(36).substring(2, 9);
        const xOffset = Math.floor(Math.random() * 60) - 30;
        setActiveEmotes((prev) => [
          ...prev,
          {
            id,
            senderName: data.senderName,
            emoji: data.emoji,
            isOpponent: true,
            xOffset,
          },
        ]);
        setTimeout(() => {
          setActiveEmotes((prev) => prev.filter((e) => e.id !== id));
        }, 2500);
        break;
      }

      case "REMATCH_OFFER": {
        setRematchStatus("received");
        break;
      }

      case "REMATCH_ACCEPT": {
        setRematchStatus("none");
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
        setChatMessages([]);
        setDraftCode("");
        break;
      }

      case "TURN_TIMEOUT": {
        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;
          return {
            ...prevRoom,
            turn: data.nextTurn,
            missedTurnsCount: data.missedTurnsCount,
            updatedAt: Date.now(),
          };
        });
        break;
      }

      case "TIMEOUT_VICTORY": {
        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;

          const updatedPlayers = prevRoom.players.map((p) => {
            if (p.id !== playerId) return { ...p, secretCode: data.opponentSecret };
            return p;
          });

          return {
            ...prevRoom,
            players: updatedPlayers,
            status: "ended",
            winnerId: data.winnerId,
            turn: null,
            missedTurnsCount: data.missedTurnsCount,
            updatedAt: Date.now(),
          };
        });
        break;
      }

      case "REQUEST_BYPASS_CODE": {
        const mySecret = activeRoom?.players.find((p) => p.id === playerId)?.secretCode || localStorage.getItem(`doi_secret_code_${code}`) || "";
        if (mySecret) {
          try {
            connRef.current?.send({
              type: "RESPONSE_BYPASS_CODE",
              secretCode: mySecret,
            });
          } catch (e) {
            console.error("Failed to transmit bypass response:", e);
          }
        }
        break;
      }

      case "RESPONSE_BYPASS_CODE": {
        setAdminCodeBypass(data.secretCode);
        break;
      }

      default:
        break;
    }
  };

  const handleStartWifiMode = () => {
    setGameMode("wifi");
    setWifiScannedLobbies([]);
    setWifiScanActive(false);
    setWifiDiscoverableActive(false);
    cleanupPeerConnection();
  };

  const runWifiNetworkScan = async () => {
    if (wifiScanActive) return;
    setWifiScanActive(true);
    setWifiScanProgress(0);
    setWifiScannedLobbies([]);
    setError(null);

    // Create a temporary Peer to perform scanning
    const scanner = new Peer();
    const tempLobbies: typeof wifiScannedLobbies = [];

    // Wait for the scanner to connect to PeerJS network
    await new Promise<void>((resolve) => {
      scanner.on("open", () => resolve());
      scanner.on("error", () => resolve());
      setTimeout(() => resolve(), 3000);
    });

    const cleanSsid = wifiSsid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const MAX_WIFI_SLOTS = 4;

    for (let i = 0; i < MAX_WIFI_SLOTS; i++) {
      setWifiScanProgress(Math.round((i / MAX_WIFI_SLOTS) * 100));
      const slotId = `doi-wifi-${cleanSsid}-${i}`;
      
      const startTime = Date.now();
      const result = await new Promise<any>((resolve) => {
        let conn: any = null;
        const timeout = setTimeout(() => {
          if (conn) conn.close();
          resolve(null);
        }, 1500);

        try {
          conn = scanner.connect(slotId);
          
          conn.on("open", () => {
            conn.send({
              type: "WIFI_PING",
              playerId,
              playerName: playerName.trim().slice(0, 16),
            });
          });

          conn.on("data", (data: any) => {
            if (data && data.type === "WIFI_PONG") {
              clearTimeout(timeout);
              const pingMs = Date.now() - startTime;
              conn.close();
              resolve({
                peerId: slotId,
                hostName: data.hostName,
                hostId: data.hostId,
                status: data.status,
                slotIndex: i,
                pingMs,
              });
            }
          });

          conn.on("error", () => {
            clearTimeout(timeout);
            resolve(null);
          });
        } catch (e) {
          clearTimeout(timeout);
          resolve(null);
        }
      });

      if (result) {
        tempLobbies.push(result);
        setWifiScannedLobbies([...tempLobbies]);
      }
    }

    setWifiScanProgress(100);
    setTimeout(() => {
      setWifiScanActive(false);
      try {
        scanner.destroy();
      } catch (e) {}
    }, 500);
  };

  const handleHostWifiLobby = async () => {
    if (wifiDiscoverableActive) {
      setWifiDiscoverableActive(false);
      cleanupPeerConnection();
      return;
    }

    try {
      setError(null);
      setIsConnecting(true);
      cleanupPeerConnection();

      const cleanSsid = wifiSsid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const MAX_WIFI_SLOTS = 4;
      let boundPeer: Peer | null = null;
      let boundSlotIndex = -1;

      for (let i = 0; i < MAX_WIFI_SLOTS; i++) {
        const slotId = `doi-wifi-${cleanSsid}-${i}`;
        const isFree = await new Promise<boolean>((resolve) => {
          const testPeer = new Peer(slotId);
          
          testPeer.on("open", () => {
            boundPeer = testPeer;
            boundSlotIndex = i;
            resolve(true);
          });

          testPeer.on("error", () => {
            testPeer.destroy();
            resolve(false);
          });

          setTimeout(() => {
            testPeer.destroy();
            resolve(false);
          }, 1500);
        });

        if (isFree) {
          break;
        }
      }

      if (!boundPeer) {
        setIsConnecting(false);
        setError("WiFi Channel crowded. Clear older slots or change SSID/Channel.");
        return;
      }

      peerRef.current = boundPeer;
      setIsHost(true);
      setWifiDiscoverableActive(true);
      setIsConnecting(false);

      const initialRoom: GameRoom = {
        roomId: `WIFI:${cleanSsid}:${boundSlotIndex}`,
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

      (boundPeer as Peer).on("connection", (conn) => {
        conn.on("data", (data: any) => {
          if (data && data.type === "WIFI_PING") {
            try {
              conn.send({
                type: "WIFI_PONG",
                hostName: playerName.trim().slice(0, 16),
                hostId: playerId,
                status: "waiting",
              });
            } catch (e) {}
            return;
          }

          if (data && data.type === "JOIN") {
            connRef.current = conn;
            setupConnectionListeners(conn, true, `WIFI:${cleanSsid}:${boundSlotIndex}`);
            handleIncomingData(data, true, `WIFI:${cleanSsid}:${boundSlotIndex}`, conn);
          }
        });
      });

      (boundPeer as Peer).on("error", (err: any) => {
        console.error("WiFi Host error:", err);
        setError(`Channel interference: ${err.message || err.type}`);
        setWifiDiscoverableActive(false);
        cleanupPeerConnection();
      });

    } catch (e: any) {
      setIsConnecting(false);
      setWifiDiscoverableActive(false);
      setError(e.message);
    }
  };

  const handleCreateOnlineRoom = () => {
    try {
      setError(null);
      setIsConnecting(true);
      
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
        setIsConnecting(false);
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
          setIsConnecting(false);
          setError(`Network establishment failed: ${err.message || err.type}`);
          cleanupPeerConnection();
        }
      });

    } catch (err: any) {
      setIsConnecting(false);
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
      setIsConnecting(true);
      cleanupPeerConnection();

      // Create peer with a random client ID to connect to host
      const peer = new Peer();
      peerRef.current = peer;
      setIsHost(false);

      peer.on("open", () => {
        // Attempt to connect to the host (support both short room codes and full WiFi Peer IDs)
        const targetId = code.startsWith("doi-") ? code : `doi-${code}`;
        const conn = peer.connect(targetId);
        connRef.current = conn;
        setupConnectionListeners(conn, false, code);

        // Pre-create local waiting room representation
        const displayRoomId = code.startsWith("doi-wifi-") ? "LOCAL WIFI" : code;
        setActiveRoom({
          roomId: displayRoomId,
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
        setIsConnecting(false);
        setError(`Failed to connect to room ${code}. Make sure code is correct.`);
        cleanupPeerConnection();
      });

    } catch (err: any) {
      setIsConnecting(false);
      setError(err.message);
    }
  };

  const handleUpdateSettings = (isTimed: boolean, timerDuration: number) => {
    setActiveRoom((prevRoom) => {
      if (!prevRoom) return null;
      const updatedRoom = {
        ...prevRoom,
        isTimed,
        timerDuration,
        updatedAt: Date.now(),
      };

      if (connRef.current) {
        try {
          connRef.current.send({
            type: "ROOM_STATE",
            room: updatedRoom,
          });
        } catch (e) {
          console.error("Failed to broadcast settings update:", e);
        }
      }
      return updatedRoom;
    });
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

    // Immediately set turn to null to prevent duplicate clicks during network lag
    setActiveRoom((prevRoom) => {
      if (!prevRoom) return null;
      return {
        ...prevRoom,
        turn: null,
        updatedAt: Date.now(),
      };
    });

    setDraftCode("");
    setError(null);
  };

  const handleOnlineRematch = () => {
    if (!activeRoom || !connRef.current) return;

    if (rematchStatus === "received") {
      // We accept the rematch
      try {
        connRef.current.send({
          type: "REMATCH_ACCEPT",
        });
      } catch (e) {
        console.error("Failed to transmit rematch acceptance:", e);
      }
      
      setRematchStatus("none");
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
      setChatMessages([]);
      setDraftCode("");
      setError(null);
    } else {
      // Offer rematch
      setRematchStatus("offered");
      try {
        connRef.current.send({
          type: "REMATCH_OFFER",
        });
      } catch (e) {
        console.error("Failed to send rematch offer:", e);
      }
    }
  };

  const sendTaunt = (emoji: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    const xOffset = Math.floor(Math.random() * 60) - 30;
    
    // Show locally
    setActiveEmotes((prev) => [
      ...prev,
      {
        id,
        senderName: "YOU",
        emoji,
        isOpponent: false,
        xOffset,
      },
    ]);
    
    // Auto-remove
    setTimeout(() => {
      setActiveEmotes((prev) => prev.filter((e) => e.id !== id));
    }, 2500);

    // Send to peer if online
    if ((gameMode === "online" || gameMode === "wifi") && connRef.current) {
      try {
        connRef.current.send({
          type: "TAUNT",
          emoji,
          senderName: playerName,
        });
      } catch (e) {
        console.error("Failed to send taunt:", e);
      }
    } else if (gameMode === "single" && singlePlayer) {
      // In single player vs AI, triggering a taunt sometimes triggers an AI reply!
      const activeAi = AI_PERSONALITIES.find((a) => a.id === selectedAiId);
      if (activeAi && Math.random() < 0.8) {
        setTimeout(() => {
          const aiId = Math.random().toString(36).substring(2, 9);
          const aiXOffset = Math.floor(Math.random() * 60) - 30;
          const aiEmojis = ["😈", "😏", "🧐", "💀", "🤖", "🔥", "😎"];
          const randomAiEmoji = aiEmojis[Math.floor(Math.random() * aiEmojis.length)];
          
          setActiveEmotes((prev) => [
            ...prev,
            {
              id: aiId,
              senderName: activeAi.name,
              emoji: randomAiEmoji,
              isOpponent: true,
              xOffset: aiXOffset,
            },
          ]);

          setTimeout(() => {
            setActiveEmotes((prev) => prev.filter((e) => e.id !== aiId));
          }, 2500);

          const tauntReplies = [
            "Your gestures do not disrupt my matrix.",
            "Amusing code. Now return to the mathematics.",
            "Distraction algorithms evaluated: Negligible effect.",
            "My thermal vents register your enthusiasm.",
            "Calculating reply: Nice try."
          ];
          setAiDialogue(tauntReplies[Math.floor(Math.random() * tauntReplies.length)]);
        }, 1000);
      }
    }
  };

  const handleOnlineLeave = () => {
    cleanupPeerConnection();
    setActiveRoom(null);
    setGameMode("home");
    setDraftCode("");
    setIsConnecting(false);
    setRematchStatus("none");
    setChatMessages([]);
    setChatInput("");
  };

  // --- SINGLE PLAYER (VS AI) ACTIONS ---

  const handleStartSinglePlayer = () => {
    setGameMode("single");
    setError(null);
    setDraftCode("");
    setSingleScratch(initialScratchpad());
    
    // Choose starting dialogue based on personality
    const activeAi = AI_PERSONALITIES.find((a) => a.id === selectedAiId) || AI_PERSONALITIES[1];
    const startQuote = activeAi.onStart[Math.floor(Math.random() * activeAi.onStart.length)];
    setAiDialogue(startQuote);

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
    const activeAi = AI_PERSONALITIES.find((a) => a.id === selectedAiId) || AI_PERSONALITIES[1];

    if (score.dead === 4) {
      // Player wins!
      const winQuote = activeAi.onPlayerWin[Math.floor(Math.random() * activeAi.onPlayerWin.length)];
      setAiDialogue(winQuote);

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

    // Set AI custom reaction to player's guess
    const reactionQuote = activeAi.onPlayerGuess[Math.floor(Math.random() * activeAi.onPlayerGuess.length)]
      .replace("{dead}", score.dead.toString())
      .replace("{injured}", score.injured.toString());
    setAiDialogue(reactionQuote);

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

        // Smart guess calculation based on selected personality
        const aiGuessCode = getAIGuessByPersonality(selectedAiId, current.aiGuesses, current.playerCode);
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
          const lossQuote = activeAi.onAiWin[Math.floor(Math.random() * activeAi.onAiWin.length)];
          setAiDialogue(lossQuote);

          return {
            ...current,
            guesses: updatedGuesses,
            aiGuesses: updatedAiGuesses,
            status: "ended",
            winner: "ai",
            turn: null,
          };
        }

        // Set AI guess announcement quote
        const aiGuessQuote = activeAi.onAiGuess[Math.floor(Math.random() * activeAi.onAiGuess.length)]
          .replace("{guess}", aiGuessCode)
          .replace("{dead}", aiScore.dead.toString())
          .replace("{injured}", aiScore.injured.toString());
        setAiDialogue(aiGuessQuote);

        return {
          ...current,
          guesses: updatedGuesses,
          aiGuesses: updatedAiGuesses,
          turn: "player",
        };
      });
    }, 1800);
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
            else if (mode === "wifi") handleStartWifiMode();
            else setGameMode("online");
          }}
          onShowInstructions={() => setShowInstructions(true)}
          onShowLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {/* LOCAL WIFI SCANNER PANEL */}
      {gameMode === "wifi" && !activeRoom && (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 min-h-[85vh] w-full max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowLeft
                  className="w-5 h-5 text-slate-400 hover:text-slate-100 cursor-pointer"
                  onClick={() => {
                    cleanupPeerConnection();
                    setGameMode("home");
                  }}
                />
                <h2 className="text-sm sm:text-md font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Wifi className="w-4 h-4 animate-pulse text-cyan-400" />
                  Local WiFi Subnet Scanner
                </h2>
              </div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                LAN MULTIPLAYER
              </div>
            </div>

            {/* Network Info Strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 border border-slate-800/60 rounded-xl p-4 mb-6 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">NETWORK SSID (SUBNET KEY)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9_-]/g, "");
                      setWifiSsid(val);
                    }}
                    disabled={wifiScanActive || wifiDiscoverableActive}
                    className="bg-slate-900 border border-slate-800 text-cyan-400 font-bold px-2 py-1 rounded w-full max-w-[200px] text-xs focus:outline-none focus:border-cyan-500/50 uppercase disabled:opacity-50"
                  />
                  <span className="text-[9px] text-slate-500 uppercase" title="Match this exact string on both devices to play over WiFi">
                    [CO-OP COORDINATES]
                  </span>
                </div>
              </div>
              <div className="space-y-1 flex flex-col justify-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">YOUR LOCAL TERMINAL IP</span>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-emerald-400 font-bold">● ONLINE</span>
                  <span className="text-slate-500">|</span>
                  <span>{wifiIpAddress}</span>
                  {isIpScanning && <span className="text-[9px] text-slate-500 animate-pulse">(locating subnet...)</span>}
                </div>
              </div>
            </div>

            {/* Main Action Hub */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* RADAR SWEEP (Search for games) */}
              <div className="col-span-12 md:col-span-6 bg-slate-950/30 border border-slate-800/80 rounded-xl p-4 flex flex-col min-h-[350px]">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                    Radar Sweep
                  </h3>
                  <span className="text-[9px] font-mono text-slate-500 uppercase bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    GUEST TERMINAL
                  </span>
                </div>

                {/* Radar Visual / Action Button */}
                <div className="flex-1 flex flex-col items-center justify-center py-4 relative">
                  {wifiScanActive ? (
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                      {/* Radar sweep animation */}
                      <div className="w-28 h-28 rounded-full border border-cyan-500/20 relative flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/0 via-cyan-500/0 to-cyan-500/10 animate-[spin_3s_linear_infinite]" />
                        <div className="w-16 h-16 rounded-full border border-cyan-500/15" />
                        <div className="w-6 h-6 rounded-full border border-cyan-500/10 bg-cyan-950/30" />
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping absolute" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-mono text-xs font-bold text-cyan-400 animate-pulse uppercase">
                          SWEEPING SUBNET SLOTS...
                        </p>
                        <p className="font-mono text-[9px] text-slate-500 uppercase">
                          Channel Sweep Progress: {wifiScanProgress}%
                        </p>
                      </div>
                    </div>
                  ) : wifiScannedLobbies.length > 0 ? (
                    <div className="w-full space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {wifiScannedLobbies.map((lobby) => (
                        <div
                          key={lobby.peerId}
                          className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 hover:border-cyan-500/30 transition-all font-mono"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-cyan-400 text-xs font-bold">{lobby.hostName}</span>
                              <span className="text-[8px] bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 px-1 py-0.2 rounded uppercase">
                                SLOT {lobby.slotIndex}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[9px] text-slate-500">
                              <span>PING: <span className="text-emerald-400 font-bold">{lobby.pingMs}ms</span></span>
                              <span>•</span>
                              <span className="uppercase text-cyan-500/80">Lobby {lobby.status}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setRoomCodeInput(lobby.peerId);
                              handleJoinOnlineRoom(lobby.peerId);
                            }}
                            className="px-2.5 py-1.5 bg-cyan-950/60 hover:bg-cyan-500 text-cyan-400 hover:text-slate-950 border border-cyan-500/30 hover:border-cyan-500 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                          >
                            CONNECT
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-full text-slate-600">
                        <Target className="w-6 h-6" />
                      </div>
                      <p className="font-mono text-xs text-slate-500 uppercase max-w-[200px] leading-relaxed text-center">
                        No active broadcast terminals found on this network yet.
                      </p>
                    </div>
                  )}
                </div>

                {/* Scan Trigger */}
                <button
                  onClick={runWifiNetworkScan}
                  disabled={wifiScanActive || wifiDiscoverableActive}
                  className="w-full h-11 bg-cyan-950/20 hover:bg-cyan-500 text-cyan-400 hover:text-slate-950 border border-cyan-500/30 hover:border-cyan-500 rounded-xl font-mono text-xs font-bold tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-cyan-950/20 disabled:hover:text-cyan-400 disabled:border-cyan-500/30 cursor-pointer"
                >
                  <Wifi className="w-4 h-4" />
                  {wifiScanActive ? "SWEEPING CHANNELS..." : "SWEEP NETWORK"}
                </button>
              </div>

              {/* BECOME DISCOVERABLE (Broadcast Terminal Beacon) */}
              <div className="col-span-12 md:col-span-6 bg-slate-950/30 border border-slate-800/80 rounded-xl p-4 flex flex-col min-h-[350px]">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    Terminal Broadcast
                  </h3>
                  <span className="text-[9px] font-mono text-slate-500 uppercase bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    HOST TERMINAL
                  </span>
                </div>

                {/* Pulse Visual / Awaiting Joined Connection */}
                <div className="flex-1 flex flex-col items-center justify-center py-4 relative">
                  {wifiDiscoverableActive ? (
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                      {/* Pulse Animation */}
                      <div className="w-24 h-24 rounded-full border border-emerald-500/20 relative flex items-center justify-center">
                        <div className="absolute inset-0 bg-emerald-500/5 rounded-full animate-ping" />
                        <div className="absolute inset-2 bg-emerald-500/10 rounded-full animate-pulse" />
                        <Wifi className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-mono text-xs font-bold text-emerald-400 uppercase">
                          BEACON SIGNAL ACTIVE
                        </p>
                        <p className="font-mono text-[9px] text-slate-500 uppercase max-w-[200px] leading-relaxed text-center">
                          Awaiting guest terminals on SSID: <span className="text-cyan-400 font-bold block">{wifiSsid.toUpperCase()}</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center space-y-3">
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-full text-slate-600">
                        <Wifi className="w-6 h-6" />
                      </div>
                      <p className="font-mono text-xs text-slate-500 uppercase max-w-[200px] leading-relaxed text-center">
                        Become discoverable to nearby terminals on the same local Wi-Fi.
                      </p>
                    </div>
                  )}
                </div>

                {/* Broadcast Trigger */}
                <button
                  onClick={handleHostWifiLobby}
                  disabled={wifiScanActive || isConnecting}
                  className={`w-full h-11 rounded-xl font-mono text-xs font-bold tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                    wifiDiscoverableActive
                      ? "bg-rose-950/20 hover:bg-rose-600 text-rose-400 hover:text-slate-950 border border-rose-500/30 hover:border-rose-500"
                      : "bg-emerald-950/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 hover:border-emerald-500"
                  }`}
                >
                  {isConnecting ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-emerald-400 animate-spin" />
                      <span>TUNING FREQUENCY...</span>
                    </>
                  ) : wifiDiscoverableActive ? (
                    <>
                      <X className="w-4 h-4" />
                      <span>TERMINATE BEACON</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>BROADCAST BEACON</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ONLINE LOBBY / MULTIPLAYER CONNECTIONS */}
      {gameMode === "online" && !activeRoom && (
        <div className="flex flex-col items-center justify-center p-3 sm:p-4 min-h-[85vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl backdrop-blur-md"
          >
            <div className="flex items-center gap-2 mb-4 sm:mb-6 pb-3 border-b border-slate-800">
              <ArrowLeft
                className="w-5 h-5 text-slate-400 hover:text-slate-100 cursor-pointer"
                onClick={() => {
                  stopQrScanner();
                  setGameMode("home");
                }}
              />
              <h2 className="text-sm sm:text-md font-mono font-bold uppercase tracking-wider text-slate-300">
                ONLINE MULTIPLAYER
              </h2>
            </div>

            <p className="text-[11px] sm:text-xs text-slate-400 font-mono uppercase tracking-tight mb-4 sm:mb-6">
              Create a co-op room to invite a friend, or enter their room code below.
            </p>

            <div className="space-y-3 sm:space-y-4">
              {/* Host room option */}
              <button
                onClick={handleCreateOnlineRoom}
                className="w-full h-11 sm:h-12 bg-emerald-950/30 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30 hover:border-emerald-500 rounded-xl font-mono text-xs sm:text-sm font-bold tracking-widest text-emerald-400 transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.05)] cursor-pointer"
              >
                <Play className="w-4 h-4" />
                CREATE CO-OP LOBBY
              </button>

              <div className="relative flex py-1 sm:py-2 items-center">
                <div className="flex-grow border-t border-slate-800/60"></div>
                <span className="flex-shrink mx-3 sm:mx-4 text-slate-600 text-[9px] sm:text-[10px] font-mono tracking-widest uppercase">
                  OR JOIN SESSION
                </span>
                <div className="flex-grow border-t border-slate-800/60"></div>
              </div>

              {/* Join input option */}
              <div className="space-y-2">
                <label className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block">
                  ROOM ACCESS CODE OR MATCH LINK
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
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
                    className="w-full h-11 sm:h-12 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 text-center font-mono font-bold tracking-widest text-md sm:text-lg text-emerald-400 uppercase focus:outline-none placeholder:text-slate-800"
                    maxLength={300}
                  />
                  <button
                    onClick={() => handleJoinOnlineRoom()}
                    className="w-full sm:w-auto h-11 sm:h-12 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded-xl font-mono text-xs font-bold text-slate-200 uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center"
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
      {(gameMode === "online" || gameMode === "wifi") && activeRoom && activeRoom.status === "waiting" && (
        <RoomLobby
          room={activeRoom}
          playerId={playerId}
          onLeave={handleOnlineLeave}
          onUpdateSettings={handleUpdateSettings}
        />
      )}

      {/* ONLINE MATCHMAKING ACTIVE BATTLE & SETUP */}
      {(gameMode === "online" || gameMode === "wifi") && activeRoom && activeRoom.status !== "waiting" && (
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
                <div className="flex items-center gap-3">
                  {activeRoom.isTimed && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 border border-rose-900/40 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-rose-400 font-bold font-mono">
                        {timeLeft}s
                      </span>
                    </div>
                  )}
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
                {activeRoom.players.find((p) => p.id === playerId)?.secretCode !== null ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center"
                  >
                    <Lock className="w-12 h-12 text-emerald-400 mx-auto animate-pulse mb-4" />
                    <h3 className="font-display font-bold text-lg text-slate-100 uppercase tracking-wide">
                      Code Locked!
                    </h3>
                    <p className="text-sm text-slate-400 font-mono mt-2 tracking-normal leading-relaxed">
                      Your code is secure. Waiting for your opponent to lock in their code...
                    </p>
                  </motion.div>
                ) : (
                  <TactileKeyboard
                    value={draftCode}
                    onChange={setDraftCode}
                    onSubmit={handleOnlineSetupLock}
                    title="Set your secret 4-digit code (no duplicates)"
                    submitLabel="Lock Code"
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
                    activeRoom.turn === playerId ? (
                      <span className="text-emerald-400 font-extrabold flex items-center gap-1.5 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        YOUR TURN: GUESS THEIR CODE!
                      </span>
                    ) : (
                      <span className="text-amber-500 font-semibold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        OPPONENT'S TURN: THINKING...
                      </span>
                    )
                  }
                  submitLabel="Lock In Guess"
                />

                {/* Interactive Emote Flare Panel */}
                <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                      BATTLE TAUNTS / FLARES
                    </span>
                    <span className="text-[8px] font-mono text-slate-600">CLICK TO DISRUPT</span>
                  </div>
                  <div className="flex gap-2 justify-between">
                    {["🤔", "😎", "🔥", "💀", "😱", "🎉", "⚡", "❓"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => sendTaunt(emoji)}
                        className="w-9 h-9 flex items-center justify-center text-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg cursor-pointer active:scale-95 transition-all"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Scratchpad and Chat */}
              <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
                <Scratchpad state={onlineScratch} onChange={setOnlineScratch} onAutofill={setDraftCode} />

                {/* Match Chat System (deleted after game) */}
                <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex flex-col h-[280px]">
                  <h4 className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase mb-2 flex items-center justify-between">
                    <span>Match Chat</span>
                    <span className="text-slate-600 text-[9px]">P2P • SESSION ONLY</span>
                  </h4>
                  
                  {/* Message list */}
                  <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1 font-mono text-xs">
                    {chatMessages.length === 0 ? (
                      <p className="text-slate-600 italic text-center py-6 text-[11px]">
                        No messages yet. Say hi to your opponent!
                      </p>
                    ) : (
                      chatMessages.map((m) => (
                        <div key={m.id} className="leading-tight break-all">
                          <span className={m.senderId === playerId ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                            {m.senderName}:{" "}
                          </span>
                          <span className="text-slate-300">{m.text}</span>
                        </div>
                      ))
                    )}
                  </div>
                  
                  {/* Chat input form */}
                  <form onSubmit={handleSendChat} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      maxLength={100}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded-lg border border-slate-700 uppercase cursor-pointer"
                    >
                      Send
                    </button>
                  </form>
                </div>
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
                    <div className="w-14 h-14 bg-emerald-950/60 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 mb-3 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-bounce text-xl flex items-center justify-center">
                      🎉
                    </div>
                    <h2 className="text-2xl font-display font-bold text-emerald-400 uppercase tracking-tight">
                      You Cracked It!
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">
                      You guessed their secret combination first! Awesome job.
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <div className="w-14 h-14 bg-red-950/60 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto text-red-500 mb-3 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse text-xl flex items-center justify-center">
                      😅
                    </div>
                    <h2 className="text-2xl font-display font-bold text-red-400 uppercase tracking-tight">
                      A Close Match!
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">
                      They managed to crack your code first this time.
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
                    disabled={rematchStatus === "offered"}
                    className={`w-full h-11 rounded-xl font-mono text-xs font-bold uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 ${
                      rematchStatus === "offered"
                        ? "bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed"
                        : rematchStatus === "received"
                        ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-500 animate-pulse"
                        : "bg-emerald-500 text-slate-950 hover:bg-emerald-400 border border-emerald-500"
                    }`}
                  >
                    {rematchStatus === "offered" ? (
                      <span>Waiting for opponent...</span>
                    ) : rematchStatus === "received" ? (
                      <span>Accept Rematch!</span>
                    ) : (
                      <span>Request Rematch</span>
                    )}
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
            <div className="col-span-12 flex flex-col items-center justify-center py-6 gap-6">
              <div className="w-full max-w-2xl">
                <h3 className="text-center text-xs font-mono font-bold tracking-wider text-slate-400 mb-4 uppercase">
                  SELECT YOUR AI OPPONENT PERSONALITY
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {AI_PERSONALITIES.map((ai) => {
                    const isSelected = selectedAiId === ai.id;
                    return (
                      <div
                        key={ai.id}
                        onClick={() => {
                          setSelectedAiId(ai.id);
                          const startQuote = ai.onStart[Math.floor(Math.random() * ai.onStart.length)];
                          setAiDialogue(startQuote);
                        }}
                        className={`border rounded-xl p-4 flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden select-none ${
                          isSelected
                            ? `${ai.color} ${ai.glow} border-opacity-100 scale-[1.02]`
                            : "border-slate-900 bg-slate-950/40 text-slate-400 hover:border-slate-850"
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[8px] font-mono font-bold uppercase py-0.5 px-2 rounded-bl">
                            Selected
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{ai.avatar}</span>
                            <div>
                              <h4 className="font-mono font-bold text-sm text-slate-100">{ai.name}</h4>
                              <p className={`text-[9px] font-mono font-bold uppercase ${
                                ai.difficulty === "Easy" ? "text-sky-400" : ai.difficulty === "Medium" ? "text-emerald-400" : "text-rose-400"
                              }`}>
                                {ai.difficulty} DIFFICULTY
                              </p>
                            </div>
                          </div>
                          <p className="text-[10px] font-mono text-slate-500 leading-tight mb-2 uppercase">
                            {ai.title}
                          </p>
                          <p className="text-xs text-slate-400 leading-relaxed mb-4">
                            {ai.bio}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

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
                {/* AI Dialogue Terminal Bubble */}
                {(() => {
                  const activeAi = AI_PERSONALITIES.find((a) => a.id === selectedAiId) || AI_PERSONALITIES[1];
                  return (
                    <div className={`p-4 rounded-xl border relative overflow-hidden transition-all ${activeAi.color} ${activeAi.glow}`}>
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none opacity-40" />
                      
                      <div className="flex items-start gap-3 relative z-10">
                        <span className="text-3xl p-1 bg-slate-950/60 border border-slate-900 rounded-lg">{activeAi.avatar}</span>
                        <div className="flex-1 font-mono">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider">{activeAi.name}</span>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border border-current ${
                              activeAi.difficulty === "Easy" ? "text-sky-400/80 bg-sky-950/20" : activeAi.difficulty === "Medium" ? "text-emerald-400/80 bg-emerald-950/20" : "text-rose-400/80 bg-rose-950/20"
                            }`}>
                              {activeAi.difficulty}
                            </span>
                          </div>
                          
                          <div className="text-xs text-slate-200 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900/60 leading-relaxed italic">
                            {aiThinking ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-amber-400 animate-pulse uppercase font-bold">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                                CRUNCHING DATA MATRIX...
                              </div>
                            ) : (
                              aiDialogue || "Systems active. Awaiting your coordinates."
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Battle Logs Dashboard */}
                <div className="flex-1 bg-slate-900/20 border border-slate-900 rounded-xl p-4">
                  <BattleLogs
                    guesses={singlePlayer.guesses}
                    playerId="player"
                    opponentId="ai"
                    opponentName={AI_PERSONALITIES.find((a) => a.id === selectedAiId)?.name || "COGNITIVE AI"}
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

                {/* Interactive Emote Flare Panel */}
                <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                      BATTLE TAUNTS / FLARES
                    </span>
                    <span className="text-[8px] font-mono text-slate-600">CLICK TO DISRUPT</span>
                  </div>
                  <div className="flex gap-2 justify-between">
                    {["🤔", "😎", "🔥", "💀", "😱", "🎉", "⚡", "❓"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => sendTaunt(emoji)}
                        className="w-9 h-9 flex items-center justify-center text-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg cursor-pointer active:scale-95 transition-all"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Scratchpad (Sticky) */}
              <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
                <Scratchpad state={singleScratch} onChange={setSingleScratch} onAutofill={setDraftCode} />
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
                      VICTORY
                    </h2>
                    <p className="text-xs text-slate-400 font-mono mt-1 uppercase tracking-widest">
                      You cracked the AI's secret code!
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
                      onAutofill={setDraftCode}
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
                        VICTORY
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
                  How to Play
                </h3>
              </div>

              <div className="font-mono text-xs text-slate-400 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div>
                  <h4 className="text-emerald-400 font-bold uppercase mb-1">
                    Step 1: Set Your Code
                  </h4>
                  <p className="leading-relaxed">
                    You and your opponent both secretly choose a 4-digit combination. Every digit
                    must be completely unique. No repeats! (e.g., <span className="text-emerald-400">5724</span> is perfect, <span className="text-red-500">5524</span> won't work because of the duplicate 5s).
                  </p>
                </div>

                <div>
                  <h4 className="text-emerald-400 font-bold uppercase mb-1">
                    Step 2: Take turns guessing
                  </h4>
                  <p className="leading-relaxed">
                    Take turns trying to guess each other's secret code. For every guess you make, you will get back some clues:
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>
                      <span className="text-emerald-400 font-bold">🟢 DEAD:</span> A digit exists in the
                      code and is in the <span className="text-emerald-300">exact correct spot</span>.
                    </li>
                    <li>
                      <span className="text-amber-400 font-bold">🟡 INJURED:</span> A digit exists in the
                      code, but is placed in the <span className="text-amber-300">wrong spot</span>.
                    </li>
                  </ul>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg">
                  <h5 className="font-bold uppercase text-[10px] text-slate-500 mb-1">
                    A quick example:
                  </h5>
                  <p className="leading-normal">
                    Opponent's Code: <span className="text-slate-200">5724</span>
                    <br />
                    Your Guess Code: <span className="text-slate-200">5279</span>
                  </p>
                  <ul className="list-disc pl-5 mt-1 text-[11px] text-slate-500 space-y-0.5">
                    <li>5 is in the 1st position → <span className="text-emerald-400">1 DEAD</span></li>
                    <li>2 is in the code but wrong position → <span className="text-amber-400">1 INJURED</span></li>
                    <li>7 is in the code but wrong position → <span className="text-amber-400">1 INJURED</span></li>
                    <li>9 is not in the code → Nothing</li>
                    <li>Your clue feedback: <span className="text-emerald-400">1 Dead, 2 Injured</span></li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-emerald-400 font-bold uppercase mb-1">
                    Step 3: Keep notes
                  </h4>
                  <p className="leading-relaxed">
                    Use the <span className="text-emerald-400">Scratchpad</span> to mark off
                    digits you've ruled out (red Trash), digits you are certain exist (green
                    Confirm), or suspects (yellow Maybe) to narrow down possibilities.
                  </p>
                </div>

                <div>
                  <h4 className="text-emerald-400 font-bold uppercase mb-1">
                    Step 4: Crack the code!
                  </h4>
                  <p className="leading-relaxed">
                    The first player to decode all 4 digits in their exact correct positions (
                    <span className="text-emerald-400">4 DEAD</span>) wins the game!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowInstructions(false)}
                className="w-full h-11 mt-6 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold uppercase rounded-xl cursor-pointer"
              >
                Let's play!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* IS CONNECTING LOADER SCREEN WITH SVG */}
      <AnimatePresence>
        {isConnecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-xs w-full text-center shadow-2xl flex flex-col items-center"
            >
              <svg
                className="animate-spin h-10 w-10 text-emerald-400 mb-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <h3 className="font-mono text-sm font-bold text-slate-200 uppercase tracking-widest">
                Establishing Link...
              </h3>
              <p className="font-mono text-[10px] text-slate-500 uppercase mt-2">
                Connecting to codebreaker coordinates
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADMIN BYPASS MODAL */}
      <AnimatePresence>
        {adminCodeBypass && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-amber-500/30 p-6 rounded-2xl max-w-xs w-full text-center shadow-[0_0_20px_rgba(245,158,11,0.15)] flex flex-col items-center"
            >
              <div className="w-12 h-12 bg-amber-950/60 border border-amber-500 rounded-full flex items-center justify-center text-amber-500 mb-4 text-lg">
                👁️‍🗨️
              </div>
              <h3 className="font-mono text-xs font-bold text-amber-500 uppercase tracking-widest">
                ADMIN ACCESS BYPASS
              </h3>
              <p className="font-mono text-[10px] text-slate-400 uppercase mt-2">
                CRACKED OPPONENT CODE
              </p>
              <div className="my-4 px-6 py-2.5 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="font-mono text-2xl font-bold tracking-widest text-emerald-400">
                  {adminCodeBypass}
                </span>
              </div>
              <button
                onClick={() => setAdminCodeBypass(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] font-bold uppercase rounded-lg border border-slate-700 cursor-pointer"
              >
                DISMISS TERMINAL
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEADERBOARD MODAL */}
      <AnimatePresence>
        {showLeaderboard && (
          <Leaderboard
            onClose={() => setShowLeaderboard(false)}
            currentPlayerName={playerName}
            currentPlayerId={playerId}
          />
        )}
      </AnimatePresence>

      {/* ACTIVE FLOATING EMOTE FLARES */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <AnimatePresence>
          {activeEmotes.map((e) => (
            <motion.div
              key={e.id}
              initial={{ y: "100vh", opacity: 0, scale: 0.5, x: e.isOpponent ? `calc(15% + ${e.xOffset}px)` : `calc(85% + ${e.xOffset}px)` }}
              animate={{ y: "15vh", opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1.2, 1.5] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.3, ease: "easeOut" }}
              className="absolute bottom-0 flex flex-col items-center"
            >
              <span className="text-5xl filter drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">{e.emoji}</span>
              <span className="bg-slate-950/90 border border-slate-800 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded text-slate-300 mt-1 uppercase tracking-tight shadow-md">
                {e.senderName}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
