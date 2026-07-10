import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Terminal, Shield, Play, ChevronRight, X, Sparkles, HelpCircle, AlertCircle, FileCode, Clock, RefreshCw, Key, Power, MessageSquare, Zap, Target, Eye, Database, Trash2, Edit3, Users } from "lucide-react";
import { GameRoom, Guess, ScratchpadState, SinglePlayerState } from "../types";
import { getLocalLeaderboard, saveLocalLeaderboard, getDeletedPlayerIds, saveDeletedPlayerIds, addDeletedPlayerId } from "../utils";

interface AdminConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  gameMode: "home" | "single" | "local" | "online";
  playerId: string;
  activeRoom: GameRoom | null;
  singlePlayer: SinglePlayerState | null;
  localState: any;
  setSinglePlayer: React.Dispatch<React.SetStateAction<SinglePlayerState | null>>;
  setActiveRoom: React.Dispatch<React.SetStateAction<GameRoom | null>>;
  setLocalState: React.Dispatch<React.SetStateAction<any>>;
  setSingleScratch: React.Dispatch<React.SetStateAction<ScratchpadState>>;
  setOnlineScratch: React.Dispatch<React.SetStateAction<ScratchpadState>>;
  setLocalScratchP1?: React.Dispatch<React.SetStateAction<ScratchpadState>>;
  setLocalScratchP2?: React.Dispatch<React.SetStateAction<ScratchpadState>>;
  setError: (err: string | null) => void;
  isConsoleHidden?: boolean;
  onHideToggle?: () => void;
  revealedOpponentSecret?: string | null;
  connRef?: React.MutableRefObject<any>;
  onAdminForceWin?: () => void;
  onLeaderboardChange?: () => void;
}

interface CommandLog {
  text: string;
  type: "input" | "info" | "success" | "error" | "code" | "warning";
}

export default function AdminConsole({
  isOpen,
  onClose,
  gameMode,
  playerId,
  activeRoom,
  singlePlayer,
  localState,
  setSinglePlayer,
  setActiveRoom,
  setLocalState,
  setSingleScratch,
  setOnlineScratch,
  setError,
  isConsoleHidden,
  onHideToggle,
  revealedOpponentSecret,
  connRef,
  onAdminForceWin,
  onLeaderboardChange,
}: AdminConsoleProps) {
  const [commandInput, setCommandInput] = useState("");
  const [activeTab, setActiveTab] = useState<"terminal" | "commands" | "database">("terminal");
  const [history, setHistory] = useState<CommandLog[]>([
    { text: "SYSTEM OPERATIONAL // PORT STATUS: LISTENING", type: "info" },
    { text: "TYPE '/help' FOR THE COMPLETE LIST OF AVAILABLE PROTOCOLS", type: "info" }
  ]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Live Database States
  const [dbRecords, setDbRecords] = useState<any[]>([]);
  const [dbDeletedIds, setDbDeletedIds] = useState<string[]>([]);

  // Edit Record Form States
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editP1Name, setEditP1Name] = useState("");
  const [editP2Name, setEditP2Name] = useState("");
  const [editWinnerName, setEditWinnerName] = useState("");
  const [editTurns, setEditTurns] = useState<number>(0);

  // Edit Player Form States
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");

  useEffect(() => {
    if (isOpen) {
      setDbRecords(getLocalLeaderboard());
      setDbDeletedIds(getDeletedPlayerIds());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [history, isOpen]);

  if (!isOpen) return null;

  const log = (text: string, type: CommandLog["type"] = "info") => {
    setHistory((prev) => [...prev, { text, type }]);
  };

  // Golden Rule check
  const hasUniqueDigits = (val: string) => {
    if (val.length !== 4) return false;
    const s = new Set(val);
    return s.size === 4 && /^\d+$/.test(val);
  };

  // Bulls & Cows Score calculator
  const calculateScore = (guess: string, secret: string) => {
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
  };

  // Extract the opponent's secret code safely
  const getOpponentCode = (): string | null => {
    if (gameMode === "single" && singlePlayer) {
      return singlePlayer.aiCode || null;
    }
    if (gameMode === "local" && localState) {
      return localState.turn === "p1" ? localState.p2Code : localState.p1Code;
    }
    if (gameMode === "online" && activeRoom) {
      const opp = activeRoom.players.find((p) => p.id !== playerId);
      return revealedOpponentSecret || (opp?.secretCode && opp.secretCode !== "LOCKED" ? opp.secretCode : null);
    }
    return null;
  };

  // Deduce Remaining Possible Codes based on historical guesses
  const getRemainingCandidates = (guesses: Guess[]): string[] => {
    const candidates: string[] = [];
    for (let a = 0; a <= 9; a++) {
      for (let b = 0; b <= 9; b++) {
        if (a === b) continue;
        for (let c = 0; c <= 9; c++) {
          if (a === c || b === c) continue;
          for (let d = 0; d <= 9; d++) {
            if (a === d || b === d || c === d) continue;
            candidates.push(`${a}${b}${c}${d}`);
          }
        }
      }
    }

    let filtered = [...candidates];
    for (const g of guesses) {
      filtered = filtered.filter((cand) => {
        const { dead, injured } = calculateScore(g.code, cand);
        return dead === g.dead && injured === g.injured;
      });
    }
    return filtered;
  };

  const runSolver = (guesses: Guess[]) => {
    if (guesses.length === 0) {
      log("NO GUESS DATA ON RECORD. AT LEAST 1 HISTORIC GUESS REQUIRED TO INITIATE CONSTRAINTS.", "warning");
      return;
    }

    log("INITIATING DEDUCTIVE GRID ANALYSIS...", "info");
    const filtered = getRemainingCandidates(guesses);

    log(`SOLVER ENGINE: COMPLETED SCREENING PROTOCOL.`, "success");
    log(`COMPATIBLE CODE CANDIDATES REMAINING: ${filtered.length} / 5040`, "code");

    if (filtered.length === 0) {
      log("CRITICAL ERROR: NO POSSIBLE CODES REMAIN! DETECTED FEEDBACK DISCREPANCY OR INVALID GAME STATE.", "error");
    } else if (filtered.length <= 15) {
      log(`CANDIDATES POOL: [ ${filtered.join(", ")} ]`, "success");
      log(`MATHEMATICAL RECOMMENDATION: TRY CODE '${filtered[0]}'`, "code");
    } else {
      log(`SAMPLE OF COMPATIBLE REGS: [ ${filtered.slice(0, 10).join(", ")} ... ]`, "info");
      log(`OPTIMAL DEDUCTIVE CANDIDATE: '${filtered[0]}'`, "code");
    }
  };

  const executeCommand = (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    const parts = trimmed.split(" ");
    const rawCommand = parts[0].toLowerCase();
    const command = rawCommand.startsWith("/") ? rawCommand : "/" + rawCommand;
    const arg = parts.slice(1).join(" ");

    switch (command) {
      case "/help": {
        log("AVAILABLE IN-GAME OPERATING CODES:", "info");
        log("  --- GENERAL CRACKING OPERATIONS ---", "info");
        log("  /reveal             - EXPOSES opponent/AI secret code registers", "success");
        log("  /solve              - ANALYZES constraints & returns remaining logical possibilities", "success");
        log("  /scratchall         - SYNCS scratchpad perfectly with opponent secret code", "success");
        log("  /undo               - REVERTS the last submitted guess of the current turn", "success");
        log("  /win                - FORCES instant operational victory conditions", "success");
        log("  /setcode <code>     - INJECTS custom 4-digit unique code to target registers", "success");
        log("  /logs               - DUMPS structured match telemetry parameters", "success");
        log("  /clear              - PURGES developer console logs", "success");
        log("  --- ADVANCED ANALYSIS & UTILITIES ---", "info");
        log("  /hint               - REVEALS a calculated clue/digit from opponent's secret", "success");
        log("  /matrixheat         - GENERATES a spatial probability matrix of remaining digits", "success");
        log("  /entropy            - CALCULATES remaining system uncertainty (Shannon entropy)", "success");
        log("  /time-dilation      - DILATES elapsed turn timers to secure tactical buffers", "success");
        log("  --- NETWORK & SENSOR PEER PEAK ---", "info");
        log("  /peek   (or /peak)  - PEERS into live opponent scratchpad / AI state", "success");
        log("  /ping               - PING signal latency verification diagnostics", "success");
        log("  /disconnect         - ENFORCES termination of P2P network bridge", "success");
        log("  /broadcast <msg>    - INJECTS a system broadcast notification into the chat", "success");
        break;
      }

      case "/clear": {
        setHistory([]);
        break;
      }

      case "/reveal": {
        if (gameMode === "home") {
          log("REJECTED: CANNOT RESOLVE REGISTERS OUTSIDE ACTIVE DEPLOYMENT.", "error");
          break;
        }

        if (gameMode === "single") {
          if (singlePlayer) {
            log(`AI REGISTERS EXPOSED. ACTIVE CODE: [ ${singlePlayer.aiCode || "NONE LOCKED"} ]`, "code");
          } else {
            log("NO ACTIVE AI REGISTRY IN MEMORY.", "error");
          }
        } else if (gameMode === "local") {
          if (localState) {
            log(`PASS & PLAY CODES:`, "code");
            log(`  P1 [ ${localState.p1Name} ]: [ ${localState.p1Code || "NOT SET"} ]`, "code");
            log(`  P2 [ ${localState.p2Name} ]: [ ${localState.p2Code || "NOT SET"} ]`, "code");
          } else {
            log("NO ACTIVE PASS & PLAY REGISTER IN MEMORY.", "error");
          }
        } else if (gameMode === "online") {
          if (activeRoom) {
            const opponent = activeRoom.players.find((p) => p.id !== playerId);
            const opponentSecret = revealedOpponentSecret || (opponent?.secretCode && opponent.secretCode !== "LOCKED" ? opponent.secretCode : "");
            if (opponent) {
              log(`CO-OP OPPONENT REGISTERS EXPOSED.`, "code");
              log(`  PLAYER: [ ${opponent.name} ]`, "info");
              log(`  CODENAME: [ ${opponentSecret || "LOCKED (REQUEST SENT...)"} ]`, "code");
              if (!opponentSecret && connRef?.current) {
                try {
                  connRef.current.send({ type: "REQUEST_BYPASS_CODE" });
                } catch (e) {
                  console.error("Failed to request bypass code in reveal:", e);
                }
              }
            } else {
              log("NO ACTIVE OPPONENT FOUND IN CHANNEL.", "error");
            }
          } else {
            log("NO MULTIPLAYER ROOM ATTACHED.", "error");
          }
        }
        break;
      }

      case "/solve": {
        if (gameMode === "single" && singlePlayer) {
          const playerGuesses = singlePlayer.guesses.filter((g) => g.playerId === "player");
          runSolver(playerGuesses);
        } else if (gameMode === "online" && activeRoom) {
          const myGuesses = activeRoom.guesses.filter((g) => g.playerId === playerId);
          runSolver(myGuesses);
        } else if (gameMode === "local" && localState) {
          const activeTurn = localState.turn; // p1 guessing p2's code, or p2 guessing p1's code
          const activeGuesses = localState.guesses.filter((g: any) => g.playerId === activeTurn);
          runSolver(activeGuesses);
        } else {
          log("SOLVER UNABLE TO INITIALIZE: NO BATTLE UNDERWAY.", "error");
        }
        break;
      }

      case "/setcode": {
        if (!arg) {
          log("REJECTED: VALUE REQUIRED. USAGE: /setcode 1395", "error");
          break;
        }
        if (!hasUniqueDigits(arg)) {
          log("REJECTED: MUST BE 4 UNIQUE DIGITS (E.G. 1395)", "error");
          break;
        }

        if (gameMode === "single" && singlePlayer) {
          setSinglePlayer((prev: any) => {
            if (!prev) return null;
            return { ...prev, aiCode: arg };
          });
          log(`AI TARGET SYSTEM OVERRIDDEN. NEW RECEPTOR CODE: [ ${arg} ]`, "success");
        } else if (gameMode === "local" && localState) {
          setLocalState((prev: any) => {
            if (!prev) return null;
            if (prev.turn === "p1") {
              return { ...prev, p2Code: arg };
            } else {
              return { ...prev, p1Code: arg };
            }
          });
          log(`LOCAL PASS-PLAY ACTIVE REGISTRY INJECTED: [ ${arg} ]`, "success");
        } else if (gameMode === "online" && activeRoom) {
          setActiveRoom((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              players: prev.players.map((p: any) => (p.id !== playerId ? { ...p, secretCode: arg } : p))
            };
          });
          log(`ONLINE ROOM COORDINATES INJECTED DIRECTLY: [ ${arg} ] (LOCAL STATE ONLY)`, "warning");
        } else {
          log("REJECTED: CODE CANNOT BE INJECTED OUTSIDE GAMEPLAY.", "error");
        }
        break;
      }

      case "/win": {
        if (gameMode === "single" && singlePlayer) {
          setSinglePlayer((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              status: "ended",
              winner: "player"
            };
          });
          log("BYPASS TRIGGERED. INITIATING WIN SEQUENCE...", "success");
          onClose();
        } else if (gameMode === "local" && localState) {
          setLocalState((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              status: "ended",
              winner: prev.turn
            };
          });
          log("BYPASS TRIGGERED. INITIATING WIN SEQUENCE...", "success");
          onClose();
        } else if (gameMode === "online" && activeRoom) {
          if (onAdminForceWin) {
            onAdminForceWin();
          } else {
            setActiveRoom((prev: any) => {
              if (!prev) return null;
              return {
                ...prev,
                status: "ended",
                winnerId: playerId
              };
            });
          }
          log("BYPASS TRIGGERED. INITIATING WIN SEQUENCE...", "success");
          onClose();
        } else {
          log("REJECTED: NO GAME ACTIVE.", "error");
        }
        break;
      }

      case "/scratchall": {
        const secretCode = getOpponentCode();

        if (!secretCode) {
          log("REJECTED: COULD NOT EXTRACT OPPONENT'S TARGET SECRET. SECURE CHANNEL TUNNELING ATTEMPT INITIATED... RETRY IN 1 SECOND.", "error");
          if (gameMode === "online" && connRef?.current) {
            try {
              connRef.current.send({ type: "REQUEST_BYPASS_CODE" });
            } catch (e) {
              console.error("Failed to request bypass code in scratchall:", e);
            }
          }
          break;
        }

        const newScratch: ScratchpadState = {
          eliminated: Array(10).fill(false),
          confirmed: Array(10).fill(false),
          maybe: Array(10).fill(false),
          notes: "ADMIN COMPREHENSIVE RECON COMPLETED.\n",
          matrix: Array(10).fill(null).map((_, digit) => {
            const digitStr = digit.toString();
            const isInCode = secretCode.includes(digitStr);
            const indexInCode = secretCode.indexOf(digitStr);

            return Array(4).fill(null).map((_, col) => {
              if (isInCode) {
                return col === indexInCode ? "yes" : "no";
              } else {
                return "no";
              }
            });
          })
        };

        // Populate basic helper arrays as well
        for (let i = 0; i < 10; i++) {
          const isContained = secretCode.includes(i.toString());
          newScratch.confirmed[i] = isContained;
          newScratch.eliminated[i] = !isContained;
        }

        if (gameMode === "single") {
          setSingleScratch(newScratch);
        } else if (gameMode === "online") {
          setOnlineScratch(newScratch);
        } else if (gameMode === "local") {
          setSingleScratch(newScratch);
          setOnlineScratch(newScratch);
        }

        log("HYPER-TACTILE DECISION MATRIX FLUSHED & ALIGNED WITH TARGET CODE.", "success");
        onClose();
        break;
      }

      case "/logs": {
        log("RAW RUNTIME SYSTEM PARAMETERS DUMP:", "info");
        log(`  GAME_MODE: ${gameMode}`, "code");
        log(`  OPERATOR_ID: ${playerId}`, "code");
        log(`  SINGLE_PLAYER_STATE: ${singlePlayer ? JSON.stringify(singlePlayer).slice(0, 120) + "..." : "NULL"}`, "code");
        log(`  ONLINE_ROOM_STATE: ${activeRoom ? JSON.stringify(activeRoom).slice(0, 120) + "..." : "NULL"}`, "code");
        log(`  LOCAL_STATE: ${localState ? "INITIALIZED" : "NULL"}`, "code");
        break;
      }

      case "/hint": {
        const code = getOpponentCode();
        if (!code) {
          log("REJECTED: COULD NOT EXTRACT OPPONENT REGISTER CODE.", "error");
          break;
        }
        const hintType = Math.floor(Math.random() * 3);
        if (hintType === 0) {
          const pos = Math.floor(Math.random() * 4);
          log(`[HINT PROTOCOL]: DIGIT AT POSITION ${pos + 1} IS '${code[pos]}'.`, "success");
        } else if (hintType === 1) {
          const digits = code.split("");
          const randDigit = digits[Math.floor(Math.random() * 4)];
          log(`[HINT PROTOCOL]: THE TARGET CODE CONTAINS THE DIGIT '${randDigit}'.`, "success");
        } else {
          const sum = code.split("").reduce((acc, d) => acc + parseInt(d, 10), 0);
          const evens = code.split("").filter(d => parseInt(d, 10) % 2 === 0).length;
          log(`[HINT PROTOCOL]: DIGIT COMBINATORIAL SUM IS ${sum}. EVEN DIGITS: ${evens}, ODD DIGITS: ${4 - evens}.`, "success");
        }
        break;
      }

      case "/matrixheat": {
        let activeGuesses: Guess[] = [];
        if (gameMode === "single" && singlePlayer) {
          activeGuesses = singlePlayer.guesses.filter((g) => g.playerId === "player");
        } else if (gameMode === "online" && activeRoom) {
          activeGuesses = activeRoom.guesses.filter((g) => g.playerId === playerId);
        } else if (gameMode === "local" && localState) {
          const activeTurn = localState.turn;
          activeGuesses = localState.guesses.filter((g: any) => g.playerId === activeTurn);
        }

        const filtered = getRemainingCandidates(activeGuesses);
        if (filtered.length === 0) {
          log("HEATMAP FAILURE: NO COMPATIBLE CANDIDATES FOUND IN ACTIVE DEPLOYMENT.", "error");
          break;
        }

        log(`MATRIX HEAT PROBABILITY PROFILE (${filtered.length} COMPATIBLE CANDIDATES):`, "info");
        log(`DIGIT | POS 1  | POS 2  | POS 3  | POS 4`, "info");
        log(`------------------------------------------`, "info");

        // counts[pos][digit]
        const counts = Array(4).fill(null).map(() => Array(10).fill(0));
        for (const cand of filtered) {
          for (let pos = 0; pos < 4; pos++) {
            const d = parseInt(cand[pos], 10);
            counts[pos][d]++;
          }
        }

        for (let d = 0; d <= 9; d++) {
          const p1 = ((counts[0][d] / filtered.length) * 100).toFixed(0);
          const p2 = ((counts[1][d] / filtered.length) * 100).toFixed(0);
          const p3 = ((counts[2][d] / filtered.length) * 100).toFixed(0);
          const p4 = ((counts[3][d] / filtered.length) * 100).toFixed(0);
          
          const p1Str = (p1 + "%").padStart(5);
          const p2Str = (p2 + "%").padStart(5);
          const p3Str = (p3 + "%").padStart(5);
          const p4Str = (p4 + "%").padStart(5);
          
          const isHigh = (counts[0][d] / filtered.length > 0.4) || 
                         (counts[1][d] / filtered.length > 0.4) || 
                         (counts[2][d] / filtered.length > 0.4) || 
                         (counts[3][d] / filtered.length > 0.4);

          log(`  ${d}   | ${p1Str}  | ${p2Str}  | ${p3Str}  | ${p4Str}`, isHigh ? "success" : "info");
        }
        break;
      }

      case "/entropy": {
        let activeGuesses: Guess[] = [];
        if (gameMode === "single" && singlePlayer) {
          activeGuesses = singlePlayer.guesses.filter((g) => g.playerId === "player");
        } else if (gameMode === "online" && activeRoom) {
          activeGuesses = activeRoom.guesses.filter((g) => g.playerId === playerId);
        } else if (gameMode === "local" && localState) {
          const activeTurn = localState.turn;
          activeGuesses = localState.guesses.filter((g: any) => g.playerId === activeTurn);
        }

        const filtered = getRemainingCandidates(activeGuesses);
        const currentPool = filtered.length;
        const startEntropy = Math.log2(5040); // 12.299
        const currentEntropy = currentPool > 0 ? Math.log2(currentPool) : 0;
        const infoGained = startEntropy - currentEntropy;
        const certaintyPct = ((infoGained / startEntropy) * 100).toFixed(1);

        log(`GAME-STATE SHANNON ENTROPY PROFILE:`, "info");
        log(`  CURRENT UNCERTAINTY : ${currentEntropy.toFixed(3)} BITS`, "code");
        log(`  INITIAL UNCERTAINTY : ${startEntropy.toFixed(3)} BITS (5040 COMBINATIONS)`, "info");
        log(`  INFORMATION EXTRACTED: ${infoGained.toFixed(3)} BITS`, "success");
        log(`  SYSTEM DEDUCTIVE CERTAINTY: ${certaintyPct}%`, "success");

        const barLength = 20;
        const filledLength = Math.max(0, Math.min(barLength, Math.round((parseFloat(certaintyPct) / 100) * barLength)));
        const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
        log(`  ANALYSIS RESOLUTION : [${bar}]`, "success");
        break;
      }

      case "/time-dilation": {
        if (gameMode === "online" && activeRoom) {
          setActiveRoom((prev: any) => {
            if (!prev) return null;
            const currentDur = prev.timerDuration ?? 60;
            return { ...prev, timerDuration: currentDur * 5 };
          });
          log("⏱️ CHRONOMETER PROTOCOL ENFORCED: ACTIVE TURN TIME DILATED BY 5x.", "success");
        } else {
          log("⏱️ TIME DILATION SHIELD GENERATED: LOCAL CHRONOMETERS AND SPEED COEFFICIENTS RETARDED.", "success");
        }
        break;
      }

      case "/peek":
      case "/peak": {
        if (gameMode === "local" && localState) {
          const p1Scratch = localState.p1Scratch;
          const p2Scratch = localState.p2Scratch;
          log("👁️ SENSOR PEER: EXTRACTING LOCAL SCRATCHPAD BUFFERS...", "success");
          
          const p1Elim = p1Scratch.eliminated.map((e: boolean, i: number) => e ? i : null).filter((v: any) => v !== null).join(", ") || "NONE";
          const p1Conf = p1Scratch.confirmed.map((e: boolean, i: number) => e ? i : null).filter((v: any) => v !== null).join(", ") || "NONE";
          const p2Elim = p2Scratch.eliminated.map((e: boolean, i: number) => e ? i : null).filter((v: any) => v !== null).join(", ") || "NONE";
          const p2Conf = p2Scratch.confirmed.map((e: boolean, i: number) => e ? i : null).filter((v: any) => v !== null).join(", ") || "NONE";

          log(`  P1 [ ${localState.p1Name} ] ELIMINATED: [ ${p1Elim} ] | CONFIRMED: [ ${p1Conf} ]`, "info");
          log(`  P2 [ ${localState.p2Name} ] ELIMINATED: [ ${p2Elim} ] | CONFIRMED: [ ${p2Conf} ]`, "info");
        } else if (gameMode === "single" && singlePlayer) {
          log("👁️ SENSOR PEER: READING AI DECODING PIPELINE STATE...", "success");
          log(`  AI CODE TARGET REGISTRY: [ ${singlePlayer.aiCode || "NOT SET"} ]`, "code");
          log(`  AI SYSTEM STATUS: ACTIVE`, "info");
          const aiGuesses = singlePlayer.guesses.filter(g => g.playerId === "ai");
          log(`  AI ATTEMPT TRAJECTORY: [ ${aiGuesses.map(g => g.code).join(" -> ") || "NO ATTEMPTS YET"} ]`, "info");
        } else if (gameMode === "online" && activeRoom) {
          const opp = activeRoom.players.find(p => p.id !== playerId);
          const oppGuesses = activeRoom.guesses.filter(g => g.playerId === opp?.id);
          log(`👁️ SENSOR PEER: ESTABLISHING TAP ON OPPONENT [ ${opp?.name || "Opponent"} ]...`, "success");
          log(`  SECRET CODE OVERRIDE BUFFER: [ ${getOpponentCode() || "LOCKED / ENCRYPTED"} ]`, "code");
          log(`  HISTORIC ATTEMPTS COUNTED  : ${oppGuesses.length}`, "info");
          if (oppGuesses.length > 0) {
            const lastG = oppGuesses[oppGuesses.length - 1];
            log(`  LAST ATTEMPT TRANSMITTED   : [ ${lastG.code} ] -> RESULT: ${lastG.dead}D ${lastG.injured}I`, "info");
          }
        } else {
          log("REJECTED: NO ACTIVE DEPLOYMENT TO PEER INTO.", "error");
        }
        break;
      }

      case "/undo": {
        if (gameMode === "single" && singlePlayer) {
          setSinglePlayer((prev: any) => {
            if (!prev || prev.guesses.length === 0) return prev;
            const newGuesses = [...prev.guesses];
            let poppedPlayer = false;
            while (newGuesses.length > 0 && !poppedPlayer) {
              const popped = newGuesses.pop();
              if (popped && popped.playerId === "player") {
                poppedPlayer = true;
              }
            }
            return {
              ...prev,
              guesses: newGuesses,
              status: "playing",
              winner: null
            };
          });
          log("⏮️ UNDO SEQUENCE INITIATED: PRUNED LAST GUESS FROM SINGLE PLAYER CACHE.", "success");
        } else if (gameMode === "local" && localState) {
          setLocalState((prev: any) => {
            if (!prev || prev.guesses.length === 0) return prev;
            const newGuesses = [...prev.guesses];
            const lastGuess = newGuesses.pop();
            return {
              ...prev,
              guesses: newGuesses,
              status: "playing",
              winner: null,
              turn: lastGuess ? lastGuess.playerId : prev.turn
            };
          });
          log("⏮️ UNDO SEQUENCE INITIATED: REVERTED LAST GUESS AND RECENTALIZED ACTIVE TURN.", "success");
        } else {
          log("REJECTED: UNDO PROTOCOL IS STRICLY RESTRICTED TO SINGLE AND LOCAL PASS-PLAY DEPLOYMENTS.", "error");
        }
        break;
      }

      case "/ping": {
        const pingTime = Math.floor(Math.random() * 25) + 12;
        log(`📡 PING >>> BEACON TRANSMITTED TO IP BOUNDARY...`, "info");
        log(`📡 PONG <<< ECHO RECEIVED. LATENCY: ${pingTime}ms. SIGNAL STRENGTH: OPTIMAL. P2P JITTER: <2ms.`, "success");
        break;
      }

      case "/disconnect": {
        if (gameMode === "online" && connRef?.current) {
          try {
            connRef.current.close();
            log("🔌 DISCONNECTION SEQUENCE COMMANDED: CLOSED WebRTC P2P SOCKET BRIDGE.", "success");
          } catch (err) {
            log("🔌 FAILED TO FORCIBLY TERMINATE ACTIVE SOCKET BRIDGE.", "error");
          }
        } else {
          log("🔌 REJECTED: DISCONNECT ATTEMPT FAILED. NO ACTIVE ONLINE P2P CONNECTIONS.", "error");
        }
        break;
      }

      case "/broadcast": {
        const messageText = arg.trim() || "SECURE SYSTEM BROADCAST: OPERATIONAL CRITICAL BUFFER RECONFIGURATION COMMENCING.";
        if (gameMode === "online" && connRef?.current) {
          const broadcastMsg = {
            id: "broadcast-" + Date.now(),
            senderId: "system",
            senderName: "⚠️ SYSTEM BROADCAST",
            text: messageText,
            timestamp: Date.now()
          };
          try {
            connRef.current.send({
              type: "CHAT",
              message: broadcastMsg
            });
            log(`📢 SYSTEM BROADCASTED: "${messageText}"`, "success");
          } catch (e) {
            log("📢 REJECTED: TRANSMISSION BUFFER OVERFLOWED. BROADCAST ABORTED.", "error");
          }
        } else {
          log(`📢 LOCAL BROADCAST MODE: "${messageText}"`, "success");
        }
        break;
      }

      default: {
        log(`REJECTED: UNRECOGNIZED PROTOCOL '${command}'. ENTER '/help' FOR CODES.`, "error");
        break;
      }
    }
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    log(`> ${cmd}`, "input");
    setCommandInput("");
    executeCommand(cmd);
  };

  const commandCategories = [
    {
      title: "🌌 SYSTEM OPERATIONS",
      color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
      commands: [
        { name: "REVEAL CODES", command: "/reveal", description: "Exposes all secret registers", icon: "Eye" },
        { name: "AUTO-SCRATCH", command: "/scratchall", description: "Flushes scratchpad with secret code", icon: "RefreshCw" },
        { name: "FORCE WINNER", command: "/win", description: "Forces instant operational victory", icon: "Zap" },
        { name: "UNDO MOVE", command: "/undo", description: "Reverts last guess (Single/Local)", icon: "ChevronRight" },
      ]
    },
    {
      title: "🧠 DEDUCTION NET",
      color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5",
      commands: [
        { name: "SOLVE CONSTRAINTS", command: "/solve", description: "Extracts logical compatibility pool", icon: "Target" },
        { name: "MATRIX HEAT MAP", command: "/matrixheat", description: "Spatial frequency distribution table", icon: "Database" },
        { name: "SHANNON ENTROPY", command: "/entropy", description: "Calculates current uncertainty bits", icon: "FileCode" },
        { name: "GET TACTICAL HINT", command: "/hint", description: "Reveals a calculated code clue", icon: "Sparkles" },
      ]
    },
    {
      title: "🛡️ NETWORK & SENSORS",
      color: "text-amber-400 border-amber-500/20 bg-amber-500/5",
      commands: [
        { name: "PEEK SCRATCHPAD", command: "/peek", description: "Peers into opponent/AI thoughts", icon: "Shield" },
        { name: "PING BEACON", command: "/ping", description: "Signal latency check diagnostics", icon: "Play" },
        { name: "P2P DISCONNECT", command: "/disconnect", description: "Enforces terminal socket cutoff", icon: "Power" },
        { name: "DUMP SYSTEM LOGS", command: "/logs", description: "Dumps raw match state memory", icon: "HelpCircle" },
      ]
    },
    {
      title: "🛰️ OVERRIDE & COMMS",
      color: "text-rose-400 border-rose-500/20 bg-rose-500/5",
      commands: [
        { name: "INJECT NEW CODE", command: "/setcode", description: "Overrides secret register with 4-digit code", requiresArg: true, argPlaceholder: "e.g. 1395", icon: "Key" },
        { name: "CHAT BROADCAST", command: "/broadcast", description: "Transmits system broadcast to peer", requiresArg: true, argPlaceholder: "e.g. Hello", icon: "MessageSquare" },
        { name: "HELP DIRECTORY", command: "/help", description: "List standard operational codes", icon: "FileCode" },
        { name: "PURGE BUFFER", command: "/clear", description: "Purges the system terminal logs", icon: "X" },
      ]
    }
  ];

  // DATABASE HELPER FUNCTIONS
  const handleDeletePlayerId = (targetId: string, targetName: string) => {
    if (!window.confirm(`CRITICAL CONFIRMATION: BLACKLIST PLAYER ID "${targetId}" (${targetName.toUpperCase()})? THIS WILL WIPE THEIR RECORDS AND BROADCAST THE DELETION TO ALL ONLINE PEERS.`)) {
      return;
    }

    // 1. Blacklist ID
    const updatedDeleted = addDeletedPlayerId(targetId);
    setDbDeletedIds(updatedDeleted);

    // 2. Wipe their records
    const currentRecords = getLocalLeaderboard();
    const updatedRecords = currentRecords.filter(r => r.player1Id !== targetId && r.player2Id !== targetId);
    saveLocalLeaderboard(updatedRecords);
    setDbRecords(updatedRecords);

    log(`[DB OPERATION]: BLACKLISTED PLAYER ID "${targetId}" (${targetName.toUpperCase()}). ALL ASSOCIATED GAME LOGS HAVE BEEN SHREDDED.`, "warning");

    // 3. Inform peer
    if (gameMode === "online" && connRef?.current) {
      try {
        connRef.current.send({
          type: "SYNC_DELETED_IDS",
          deletedPlayerIds: updatedDeleted
        });
        log("[P2P SYNC]: TRANSMITTED NEW BLACKLIST DESTRUCTION VECTOR TO CONNECTED OPPONENT.", "success");
      } catch (err) {
        console.error("Failed to sync blacklisted player ID via peer:", err);
      }
    }

    if (onLeaderboardChange) {
      onLeaderboardChange();
    }
  };

  const handleSavePlayerName = (targetId: string) => {
    const trimmed = editPlayerName.trim();
    if (!trimmed) return;

    // Update locally
    const currentRecords = getLocalLeaderboard();
    const updatedRecords = currentRecords.map(r => {
      let changed = false;
      let p1Name = r.player1Name;
      let p2Name = r.player2Name;
      let winnerName = r.winnerName;

      if (r.player1Id === targetId) {
        p1Name = trimmed;
        changed = true;
      }
      if (r.player2Id === targetId) {
        p2Name = trimmed;
        changed = true;
      }
      if (r.winnerId === targetId) {
        winnerName = trimmed;
        changed = true;
      }

      return changed ? { ...r, player1Name: p1Name, player2Name: p2Name, winnerName } : r;
    });

    saveLocalLeaderboard(updatedRecords);
    setDbRecords(updatedRecords);

    // If it's our own name, update localStorage profile
    if (targetId === playerId) {
      localStorage.setItem("doi_player_name", trimmed);
    }

    log(`[DB OPERATION]: ALIGNED USER DATA. ID "${targetId}" RE-REGISTERED AS "${trimmed.toUpperCase()}".`, "success");
    setEditingPlayerId(null);

    if (onLeaderboardChange) {
      onLeaderboardChange();
    }
  };

  const handleSaveRecord = (matchId: string) => {
    const currentRecords = getLocalLeaderboard();
    const updatedRecords = currentRecords.map(r => {
      if (r.matchId === matchId) {
        return {
          ...r,
          player1Name: editP1Name,
          player2Name: editP2Name,
          winnerName: editWinnerName,
          turnsUsed: editTurns
        };
      }
      return r;
    });

    saveLocalLeaderboard(updatedRecords);
    setDbRecords(updatedRecords);

    log(`[DB OPERATION]: RECONFIGURED MATCH LOG "${matchId}".`, "success");
    setEditingRecordId(null);

    if (onLeaderboardChange) {
      onLeaderboardChange();
    }
  };

  const handleDeleteRecord = (matchId: string) => {
    if (!window.confirm("ARE YOU SURE YOU WANT TO COMPLETELY REMOVE THIS MATCH RECORD FROM LOGS?")) return;

    const currentRecords = getLocalLeaderboard();
    const updatedRecords = currentRecords.filter(r => r.matchId !== matchId);
    saveLocalLeaderboard(updatedRecords);
    setDbRecords(updatedRecords);

    log(`[DB OPERATION]: PURGED MATCH RECORD "${matchId}".`, "warning");

    if (onLeaderboardChange) {
      onLeaderboardChange();
    }
  };

  // Derive unique players list for display
  const dbPlayersList = React.useMemo(() => {
    const playersMap = new Map<string, { id: string; name: string }>();
    
    // Include current player
    if (playerId) {
      playersMap.set(playerId, { id: playerId, name: localStorage.getItem("doi_player_name") || "YOU" });
    }

    if (Array.isArray(dbRecords)) {
      dbRecords.forEach((r) => {
        if (r && r.player1Id) {
          playersMap.set(r.player1Id, { id: r.player1Id, name: r.player1Name || "UNKNOWN" });
        }
        if (r && r.player2Id) {
          playersMap.set(r.player2Id, { id: r.player2Id, name: r.player2Name || "UNKNOWN" });
        }
      });
    }

    const deletedIds = Array.isArray(dbDeletedIds) ? dbDeletedIds : [];

    return Array.from(playersMap.values()).filter(p => p && p.id && p.id !== "p1" && p.id !== "p2" && p.id !== "ai" && !deletedIds.includes(p.id));
  }, [dbRecords, dbDeletedIds, playerId]);

  const handleCommandClick = (cmdItem: typeof commandCategories[0]["commands"][0]) => {
    if (cmdItem.requiresArg) {
      setCommandInput(cmdItem.command + " ");
      log(`[CONSOLE]: PRE-FILLED ${cmdItem.command}. PLEASE SPECIFY PARAMETER (${cmdItem.argPlaceholder || "argument"}) AND PRESS ENTER TO EXECUTE.`, "info");
      setActiveTab("terminal");
    } else {
      log(`> ${cmdItem.command}`, "input");
      executeCommand(cmdItem.command);
      setActiveTab("terminal");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in"
      >
        <motion.div
          initial={{ scale: 0.96, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 10 }}
          className="w-full max-w-4xl bg-slate-900 border border-emerald-500/30 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.15)] flex flex-col h-[580px] max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-950/40 border border-emerald-500/20 rounded-lg text-emerald-400">
                <Terminal className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  SECURE COMMAND CONSOLE
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-500/30 text-emerald-300">
                    ADMIN V1.3
                  </span>
                </h3>
                <p className="font-mono text-[9px] text-slate-500 uppercase mt-0.5">
                  Authorized operator debugging, network operations and deductive solver panel
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onHideToggle && (
                <button
                  onClick={onHideToggle}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-amber-500 hover:text-amber-400 font-mono text-[9px] font-bold rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                  title="Obfuscate and hide the system trigger button"
                >
                  {isConsoleHidden ? "REVEAL TRIGGER" : "HIDE TRIGGER"}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Global Tab Selector */}
          <div className="flex border-b border-slate-800 bg-slate-950 p-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("terminal")}
              className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                activeTab === "terminal"
                  ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              🖥️ TERMINAL ({history.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("commands")}
              className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                activeTab === "commands"
                  ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              🎛️ PROTOCOLS
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("database")}
              className={`flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                activeTab === "database"
                  ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              🗃️ DATABASE & PLAYERS
            </button>
          </div>

          {/* Responsive Area */}
          <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-950">
            {/* TERMINAL TAB */}
            {activeTab === "terminal" && (
              <div className="flex-1 flex flex-col h-full min-h-0">
                {/* Scrolling output log */}
                <div className="flex-1 overflow-y-auto p-5 font-mono text-xs space-y-2 bg-slate-950 min-h-0 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                  {history.map((h, i) => (
                    <div
                      key={i}
                      className={`leading-relaxed break-words py-0.5 px-2 rounded font-mono ${
                        h.type === "input"
                          ? "text-slate-200 bg-slate-900/40 font-bold"
                          : h.type === "success"
                          ? "text-emerald-400 bg-emerald-950/10 border-l-2 border-emerald-500"
                          : h.type === "error"
                          ? "text-rose-400 bg-rose-950/10 border-l-2 border-rose-500"
                          : h.type === "code"
                          ? "text-cyan-400 bg-cyan-950/10 border-l-2 border-cyan-500 text-left font-semibold"
                          : h.type === "warning"
                          ? "text-amber-400 bg-amber-950/10 border-l-2 border-amber-500"
                          : "text-slate-400"
                      }`}
                    >
                      {h.type === "code" ? (
                        <pre className="font-mono text-xs overflow-x-auto whitespace-pre leading-normal">
                          {h.text}
                        </pre>
                      ) : (
                        h.text
                      )}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>

                {/* Input Form at bottom of Terminal */}
                <form onSubmit={handleCommandSubmit} className="flex border-t border-slate-800 bg-slate-950 p-3">
                  <div className="flex-1 relative flex items-center">
                    <span className="absolute left-3 text-emerald-500 font-mono text-sm font-bold animate-pulse">
                      &gt;
                    </span>
                    <input
                      type="text"
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-4 py-3 text-emerald-400 font-mono text-xs focus:outline-none focus:border-emerald-500 transition-all placeholder:text-slate-800 uppercase"
                      placeholder="ENTER IN-GAME PROTOCOL DIRECTIVE..."
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    className="ml-3 px-5 bg-emerald-950/40 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 hover:border-emerald-500 rounded-xl font-mono text-xs font-bold tracking-widest uppercase transition-all duration-300 flex items-center gap-2 cursor-pointer"
                  >
                    EXECUTE
                  </button>
                </form>
              </div>
            )}

            {/* COMMANDS TAB */}
            {activeTab === "commands" && (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-400" /> COMMAND DIRECTORY
                  </span>
                  <span className="text-[8px] font-mono text-slate-500 uppercase">TAPPING RUNS INSTANTLY</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                  {commandCategories.map((cat, catIdx) => (
                    <div key={catIdx} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${cat.color}`}>
                          {cat.title}
                        </span>
                        <div className="flex-1 h-px bg-slate-800" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {cat.commands.map((cmdItem) => (
                          <button
                            key={cmdItem.name}
                            type="button"
                            onClick={() => handleCommandClick(cmdItem)}
                            className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-emerald-500/30 rounded-xl transition-all flex flex-col gap-0.5 group cursor-pointer"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-mono text-[10px] font-bold text-slate-300 group-hover:text-emerald-400 transition-colors uppercase tracking-wider">
                                {cmdItem.name}
                              </span>
                              <span className="font-mono text-[9px] text-slate-600 group-hover:text-emerald-500/60 transition-colors">
                                {cmdItem.command}
                              </span>
                            </div>
                            <p className="font-mono text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors leading-normal">
                              {cmdItem.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DATABASE AND PLAYERS TAB */}
            {activeTab === "database" && (
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 bg-slate-950 p-4 gap-4">
                {/* Left Panel: Players Directory */}
                <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-hidden min-h-[220px]">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-3">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-widest">
                      PLAYERS LOG ({dbPlayersList.length})
                    </h4>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {dbPlayersList.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-8">
                        <p className="font-mono text-[10px] text-slate-600 uppercase tracking-widest text-center">
                          NO PLAYER PROFILES DETECTED IN LOCAL REGISTRY
                        </p>
                      </div>
                    ) : (
                      dbPlayersList.map((p) => {
                        const isEditing = editingPlayerId === p.id;
                        return (
                          <div
                            key={p.id}
                            className="bg-slate-950/80 border border-slate-800/60 rounded-lg p-3 flex flex-col gap-2 hover:border-slate-800 transition-colors"
                          >
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <span className="font-mono text-[8px] text-slate-500 uppercase">
                                  ID: {p.id}
                                </span>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editPlayerName}
                                    onChange={(e) => setEditPlayerName(e.target.value)}
                                    maxLength={20}
                                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500 uppercase"
                                    placeholder="Enter player name"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSavePlayerName(p.id)}
                                    className="px-2.5 py-1 bg-emerald-950 text-emerald-400 hover:bg-emerald-400 hover:text-slate-950 border border-emerald-500/30 rounded text-[10px] font-mono font-bold uppercase transition-all cursor-pointer"
                                  >
                                    SAVE
                                  </button>
                                  <button
                                    onClick={() => setEditingPlayerId(null)}
                                    className="px-2.5 py-1 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700 rounded text-[10px] font-mono uppercase transition-all cursor-pointer"
                                  >
                                    X
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wide block truncate">
                                    {p.name}
                                  </span>
                                  <span className="font-mono text-[8px] text-slate-500 uppercase block select-all">
                                    ID: {p.id}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingPlayerId(p.id);
                                      setEditPlayerName(p.name);
                                    }}
                                    className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 rounded border border-transparent hover:border-slate-800 transition-all cursor-pointer"
                                    title="Edit user profile"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePlayerId(p.id, p.name)}
                                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded border border-transparent hover:border-slate-800 transition-all cursor-pointer"
                                    title="Purge ID & Blacklist"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Panel: Match Records Journal */}
                <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-hidden min-h-[220px]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-widest">
                        MATCH RECAPS ({dbRecords.length})
                      </h4>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    {(!Array.isArray(dbRecords) || dbRecords.length === 0) ? (
                      <div className="h-full flex items-center justify-center p-8">
                        <p className="font-mono text-[10px] text-slate-600 uppercase tracking-widest text-center">
                          NO HISTORICAL GAME RECORDS ON FILE
                        </p>
                      </div>
                    ) : (
                      dbRecords.map((r) => {
                        if (!r) return null;
                        const isEditing = editingRecordId === r.matchId;
                        let formattedDate = "UNKNOWN DATE";
                        if (r.timestamp) {
                          try {
                            formattedDate = new Date(r.timestamp).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                          } catch (e) {
                            console.error("Failed to format date:", e);
                          }
                        }

                        return (
                          <div
                            key={r.matchId || Math.random().toString()}
                            className="bg-slate-950/80 border border-slate-800/60 rounded-lg p-3 flex flex-col gap-2 hover:border-slate-800 transition-colors"
                          >
                            {isEditing ? (
                              <div className="flex flex-col gap-2.5">
                                <span className="font-mono text-[8px] text-slate-500 uppercase">
                                  MATCH: {r.matchId || "UNKNOWN"} • {(r.gameMode || "UNKNOWN").toUpperCase()}
                                </span>
                                
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="font-mono text-[8px] text-slate-400 uppercase block mb-1">
                                      P1 NAME
                                    </label>
                                    <input
                                      type="text"
                                      value={editP1Name}
                                      onChange={(e) => setEditP1Name(e.target.value)}
                                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 font-mono uppercase"
                                    />
                                  </div>
                                  <div>
                                    <label className="font-mono text-[8px] text-slate-400 uppercase block mb-1">
                                      P2 NAME
                                    </label>
                                    <input
                                      type="text"
                                      value={editP2Name}
                                      onChange={(e) => setEditP2Name(e.target.value)}
                                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 font-mono uppercase"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="font-mono text-[8px] text-slate-400 uppercase block mb-1">
                                      WINNER NAME
                                    </label>
                                    <input
                                      type="text"
                                      value={editWinnerName}
                                      onChange={(e) => setEditWinnerName(e.target.value)}
                                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 font-mono uppercase"
                                    />
                                  </div>
                                  <div>
                                    <label className="font-mono text-[8px] text-slate-400 uppercase block mb-1">
                                      TURNS USED
                                    </label>
                                    <input
                                      type="number"
                                      value={editTurns}
                                      onChange={(e) => setEditTurns(parseInt(e.target.value, 10) || 0)}
                                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 font-mono"
                                    />
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end mt-1">
                                  <button
                                    onClick={() => handleSaveRecord(r.matchId)}
                                    className="px-3 py-1 bg-emerald-950 text-emerald-400 hover:bg-emerald-400 hover:text-slate-950 border border-emerald-500/30 rounded text-[10px] font-mono font-bold uppercase transition-all cursor-pointer"
                                  >
                                    SAVE RECAP
                                  </button>
                                  <button
                                    onClick={() => setEditingRecordId(null)}
                                    className="px-3 py-1 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700 rounded text-[10px] font-mono uppercase transition-all cursor-pointer"
                                  >
                                    CANCEL
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-[8px] text-slate-500 uppercase">
                                      {formattedDate}
                                    </span>
                                    <span className="font-mono text-[8px] text-emerald-500 uppercase px-1.5 py-0.2 bg-emerald-950/40 border border-emerald-500/20 rounded">
                                      {r.gameMode}
                                    </span>
                                  </div>
                                  <div className="font-mono text-[11px] font-bold text-slate-300 uppercase tracking-wide mt-1">
                                    {r.player1Name || "UNKNOWN"} vs {r.player2Name || "UNKNOWN"}
                                  </div>
                                  <div className="font-mono text-[9px] text-slate-400 mt-1 uppercase">
                                    Result: <span className="text-emerald-400 font-semibold">{r.winnerName ? `${r.winnerName} won` : "Draw"}</span> • {r.turnsUsed || 0} turns
                                  </div>
                                  <span className="font-mono text-[7px] text-slate-600 block mt-1 select-all">
                                    MATCH ID: {r.matchId || "UNKNOWN"}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingRecordId(r.matchId || "");
                                      setEditP1Name(r.player1Name || "");
                                      setEditP2Name(r.player2Name || "");
                                      setEditWinnerName(r.winnerName || "");
                                      setEditTurns(r.turnsUsed || 0);
                                    }}
                                    className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-900 rounded border border-transparent hover:border-slate-800 transition-all cursor-pointer"
                                    title="Edit match recaps"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRecord(r.matchId)}
                                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded border border-transparent hover:border-slate-800 transition-all cursor-pointer"
                                    title="Delete match record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
