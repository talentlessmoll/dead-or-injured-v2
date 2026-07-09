import React, { useState } from "react";
import { motion } from "motion/react";
import { Trophy, TrendingUp, Users, Smartphone, Bot, X, Calendar, Flame, Zap, ShieldAlert } from "lucide-react";
import { LeaderboardRecord } from "../types";
import { getLocalLeaderboard, saveLocalLeaderboard } from "../utils";

interface LeaderboardProps {
  onClose: () => void;
  currentPlayerName: string;
}

export default function Leaderboard({ onClose, currentPlayerName }: LeaderboardProps) {
  const [records, setRecords] = useState<LeaderboardRecord[]>(() => getLocalLeaderboard());
  const [filterMode, setFilterMode] = useState<"all" | "single" | "local" | "online">("all");

  const handleClearHistory = () => {
    if (window.confirm("ARE YOU SURE YOU WANT TO DISINTEGRATE ALL MATCH HISTORY? THIS ACTION IS IRREVERSIBLE.")) {
      saveLocalLeaderboard([]);
      setRecords([]);
    }
  };

  // Filter records
  const filteredRecords = records.filter((r) => {
    if (filterMode === "all") return true;
    return r.gameMode === filterMode;
  });

  // Calculate stats based on CURRENT PLAYER NAME (or overall)
  const stats = React.useMemo(() => {
    let totalGames = 0;
    let wins = 0;
    let totalTurnsInWins = 0;
    let singlePlayerCount = 0;
    let singlePlayerWins = 0;
    let onlineCount = 0;
    let onlineWins = 0;
    let localCount = 0;

    records.forEach((r) => {
      totalGames++;
      
      // Determine if currentPlayerName is involved
      const isP1 = r.player1Name.trim().toLowerCase() === currentPlayerName.trim().toLowerCase();
      const isP2 = r.player2Name.trim().toLowerCase() === currentPlayerName.trim().toLowerCase();
      
      const pNameLower = currentPlayerName.trim().toLowerCase();
      const winnerNameLower = r.winnerName?.trim().toLowerCase();

      if (r.gameMode === "single") {
        singlePlayerCount++;
        if (r.winnerId === "player") {
          singlePlayerWins++;
          wins++;
          totalTurnsInWins += r.turnsUsed;
        }
      } else if (r.gameMode === "online") {
        onlineCount++;
        if (winnerNameLower === pNameLower) {
          onlineWins++;
          wins++;
          totalTurnsInWins += r.turnsUsed;
        } else if (!winnerNameLower && r.winnerId === r.player1Id && isP1) {
          wins++;
          totalTurnsInWins += r.turnsUsed;
        } else if (!winnerNameLower && r.winnerId === r.player2Id && isP2) {
          wins++;
          totalTurnsInWins += r.turnsUsed;
        }
      } else {
        localCount++;
        // Local pass & play
        if (winnerNameLower === pNameLower) {
          wins++;
          totalTurnsInWins += r.turnsUsed;
        }
      }
    });

    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    const avgTurns = wins > 0 ? (totalTurnsInWins / wins).toFixed(1) : "0";

    return {
      totalGames,
      wins,
      winRate,
      avgTurns,
      singlePlayerCount,
      singlePlayerWins,
      onlineCount,
      onlineWins,
      localCount,
    };
  }, [records, currentPlayerName]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 overflow-y-auto px-4 py-6 md:py-12 flex justify-center"
    >
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-8 relative h-fit shadow-2xl">
        {/* Header HUD */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-mono font-bold uppercase tracking-widest text-slate-100">
                DECENTRALIZED LEDGER
              </h2>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">
                Mesh Synced & Local Match Records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 border border-transparent hover:border-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Box about Decentralized Mesh */}
        <div className="mb-6 p-3 bg-emerald-950/20 border border-emerald-500/15 rounded-xl text-slate-300 font-mono text-[11px] leading-relaxed">
          <span className="text-emerald-400 font-bold uppercase mr-1">⚡ CO-OP MESH NETWORKING:</span>
          Each time you connect with a peer, your terminal automatically exchanges match history logs. Any games your peer has played (with anyone) propagate to your local storage, and vice-versa, forming a distributed serverless ledger of achievements!
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-8">
          <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
              TOTAL RECORDED
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-slate-100">{stats.totalGames}</span>
              <span className="text-[10px] font-mono text-slate-500">MATCHES</span>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
              YOUR PERSONAL WINS
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-emerald-400">{stats.wins}</span>
              <span className="text-[10px] font-mono text-slate-500">VICTORIES</span>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
              PERSONAL WIN RATE
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-amber-400">{stats.winRate}%</span>
              <span className="text-[10px] font-mono text-slate-500">RATIO</span>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
              AVG EFFICIENCY
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-blue-400">{stats.avgTurns}</span>
              <span className="text-[10px] font-mono text-slate-500">GUESSES / WIN</span>
            </div>
          </div>
        </div>

        {/* Filter Bar & Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex gap-1.5 p-1 bg-slate-950 border border-slate-800/80 rounded-xl w-full sm:w-auto">
            {[
              { id: "all", label: "All Logs" },
              { id: "single", label: "vs AI Practice" },
              { id: "online", label: "Online Duels" },
              { id: "local", label: "Pass & Play" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilterMode(btn.id as any)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                  filterMode === btn.id
                    ? "bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {records.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="px-3 py-1.5 hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 border border-transparent hover:border-rose-900/40 rounded-xl font-mono text-[10px] font-bold uppercase cursor-pointer"
            >
              WIPE HISTORY
            </button>
          )}
        </div>

        {/* Records List */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/30">
          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <Zap className="w-8 h-8 text-slate-700 animate-pulse mb-3" />
              <p className="font-mono text-xs text-slate-500 uppercase tracking-widest">
                NO SEEDED DATA IN CURRENT PROTOCOL
              </p>
              <p className="text-[10px] text-slate-600 font-mono mt-1">
                Completed matches will automatically compile here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
              {filteredRecords.map((r, i) => {
                const isSingle = r.gameMode === "single";
                const isOnline = r.gameMode === "online";
                const isLocal = r.gameMode === "local";

                // Format Date
                const formattedDate = new Date(r.timestamp).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                // Check if current user is involved
                const pNameLower = currentPlayerName.trim().toLowerCase();
                const isUserP1 = r.player1Name.trim().toLowerCase() === pNameLower;
                const isUserP2 = r.player2Name.trim().toLowerCase() === pNameLower;
                const isUserWinner = r.winnerName?.trim().toLowerCase() === pNameLower;

                // Identify if this is a propagated mesh record
                const isMeshPropagated = isOnline && !isUserP1 && !isUserP2;

                return (
                  <div
                    key={r.matchId || `record_${i}`}
                    className={`p-4 font-mono text-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isMeshPropagated
                        ? "bg-emerald-950/5 hover:bg-emerald-950/10 border-l-2 border-emerald-500/30"
                        : "hover:bg-slate-900/40 border-l-2 border-slate-700/30"
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      {/* Badge / Mode Header */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            isSingle
                              ? "bg-amber-950/60 border border-amber-800/40 text-amber-400"
                              : isOnline
                              ? "bg-emerald-950/60 border border-emerald-800/40 text-emerald-400"
                              : "bg-blue-950/60 border border-blue-800/40 text-blue-400"
                          }`}
                        >
                          {isSingle ? "vs AI" : isOnline ? "Online Duel" : "Pass & Play"}
                        </span>
                        {isMeshPropagated && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" /> MESH RECORD
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formattedDate}
                        </span>
                      </div>

                      {/* Opponents and secret code status */}
                      <div className="text-slate-200 mt-1">
                        <span className={`font-bold ${isUserP1 ? "text-emerald-400" : "text-slate-300"}`}>
                          {r.player1Name}
                        </span>{" "}
                        <span className="text-slate-500">VS</span>{" "}
                        <span className={`font-bold ${isUserP2 ? "text-emerald-400" : "text-slate-300"}`}>
                          {r.player2Name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-start sm:self-center">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 block">VICTOR</span>
                        <span
                          className={`font-bold uppercase ${
                            isUserWinner
                              ? "text-emerald-400"
                              : r.winnerId === "player" && isUserP1
                              ? "text-emerald-400"
                              : r.winnerName
                              ? "text-slate-300"
                              : "text-slate-500"
                          }`}
                        >
                          {r.winnerName || (r.winnerId === "ai" ? "CPU ALGORITHM" : "UNKNOWN")}
                        </span>
                      </div>

                      <div className="h-6 w-px bg-slate-800" />

                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 block">EFFICIENCY</span>
                        <span className="font-bold text-slate-200">{r.turnsUsed} TURNS</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
