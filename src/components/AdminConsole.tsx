import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Terminal, Shield, Play, ChevronRight, X, Sparkles, HelpCircle, AlertCircle, FileCode } from "lucide-react";
import { GameRoom, Guess, ScratchpadState, SinglePlayerState } from "../types";

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
}: AdminConsoleProps) {
  const [commandInput, setCommandInput] = useState("");
  const [history, setHistory] = useState<CommandLog[]>([
    { text: "SYSTEM OPERATIONAL // PORT STATUS: LISTENING", type: "info" },
    { text: "TYPE '/help' FOR THE COMPLETE LIST OF AVAILABLE PROTOCOLS", type: "info" }
  ]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

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

  // Deduce Remaining Possible Codes based on historical guesses
  const runSolver = (guesses: Guess[]) => {
    if (guesses.length === 0) {
      log("NO GUESS DATA ON RECORD. AT LEAST 1 HISTORIC GUESS REQUIRED TO INITIATE CONSTRAINTS.", "warning");
      return;
    }

    log("INITIATING DEDUCTIVE GRID ANALYSIS...", "info");

    // 1. Generate all unique 5040 combinations
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

    // 2. Filter against historic guesses of the active player
    let filtered = [...candidates];
    for (const g of guesses) {
      filtered = filtered.filter((cand) => {
        const { dead, injured } = calculateScore(g.code, cand);
        return dead === g.dead && injured === g.injured;
      });
    }

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

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    log(`> ${cmd}`, "input");
    setCommandInput("");

    const parts = cmd.split(" ");
    const command = parts[0].toLowerCase();
    const arg = parts[1] || "";

    switch (command) {
      case "/help": {
        log("AVAILABLE IN-GAME OPERATING CODES:", "info");
        log("  /reveal          - EXPOSES opponent/AI secret code registers", "success");
        log("  /solve           - ANALYZES constraints & returns remaining logical possibilities", "success");
        log("  /win             - FORCES instant operational victory conditions", "success");
        log("  /setcode <code>  - INJECTS custom 4-digit unique code to target registers", "success");
        log("  /scratchall      - SYNCS scratchpad perfectly with opponent secret code", "success");
        log("  /logs            - DUMPS structured match telemetry parameters", "success");
        log("  /clear           - PURGES developer console logs", "success");
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
              // P1 is guessing P2's code, so change P2's code
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
        let secretCode = "";
        if (gameMode === "single" && singlePlayer) {
          secretCode = singlePlayer.aiCode || "";
        } else if (gameMode === "online" && activeRoom) {
          const opp = activeRoom.players.find((p) => p.id !== playerId);
          secretCode = revealedOpponentSecret || (opp?.secretCode && opp.secretCode !== "LOCKED" ? opp.secretCode : "");
        } else if (gameMode === "local" && localState) {
          secretCode = localState.turn === "p1" ? localState.p2Code : localState.p1Code;
        }

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
          // Both scratchpads updated if present
          if (localState) {
            setSingleScratch(newScratch);
            setOnlineScratch(newScratch);
          }
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

      default: {
        log(`REJECTED: UNRECOGNIZED PROTOCOL '${command}'. ENTER '/help' FOR CODES.`, "error");
        break;
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.96, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 10 }}
          className="w-full max-w-2xl bg-slate-900 border border-emerald-500/30 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.15)] flex flex-col h-[520px] max-h-[85vh]"
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
                    ADMIN V1.2
                  </span>
                </h3>
                <p className="font-mono text-[9px] text-slate-500 uppercase mt-0.5">
                  Authorized operator debugging and logic solver terminal
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onHideToggle && (
                <button
                  onClick={() => {
                    onHideToggle();
                  }}
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

          {/* Scrolling output log */}
          <div className="flex-1 overflow-y-auto p-5 font-mono text-xs space-y-2 bg-slate-950">
            {history.map((h, i) => (
              <div
                key={i}
                className={`leading-relaxed break-words py-0.5 px-2 rounded ${
                  h.type === "input"
                    ? "text-slate-200 bg-slate-900/40 font-bold"
                    : h.type === "success"
                    ? "text-emerald-400 bg-emerald-950/10 border-l-2 border-emerald-500"
                    : h.type === "error"
                    ? "text-rose-400 bg-rose-950/10 border-l-2 border-rose-500"
                    : h.type === "code"
                    ? "text-cyan-400 bg-cyan-950/10 border-l-2 border-cyan-500"
                    : h.type === "warning"
                    ? "text-amber-400 bg-amber-950/10 border-l-2 border-amber-500"
                    : "text-slate-400"
                }`}
              >
                {h.text}
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>

          {/* Quick Shortcuts Deck */}
          <div className="px-5 py-3 bg-slate-900/40 border-t border-slate-800 flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest mr-2">
              QUICK COMMANDS:
            </span>
            {[
              { label: "REVEAL CODES", value: "/reveal" },
              { label: "LOGICAL SOLVER", value: "/solve" },
              { label: "AUTO SCRATCH", value: "/scratchall" },
              { label: "WIN BATTLE", value: "/win" },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() => {
                  setCommandInput(btn.value);
                }}
                className="px-2.5 py-1 bg-slate-950 hover:bg-emerald-950/30 text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/20 rounded-md text-[10px] font-mono transition-all cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Input line */}
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
