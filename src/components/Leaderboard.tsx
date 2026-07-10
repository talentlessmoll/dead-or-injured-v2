import React, { useState } from "react";
import { motion } from "motion/react";
import { Trophy, Users, X, Calendar, Zap, ArrowRight, UserCheck, Bot, BarChart3, Clock } from "lucide-react";
import { LeaderboardRecord } from "../types";
import { getLocalLeaderboard, saveLocalLeaderboard, getDeletedPlayerIds } from "../utils";

interface LeaderboardProps {
  onClose: () => void;
  currentPlayerName: string;
  currentPlayerId: string;
  onTapCurrentUser?: () => void;
  leaderboardVersion?: number;
}

export default function Leaderboard({ onClose, currentPlayerName, currentPlayerId, onTapCurrentUser, leaderboardVersion = 0 }: LeaderboardProps) {
  const [records, setRecords] = useState<LeaderboardRecord[]>(() => {
    const deleted = getDeletedPlayerIds();
    return getLocalLeaderboard().filter((r) => 
      !deleted.includes(r.player1Id || "") && 
      !deleted.includes(r.player2Id || "")
    );
  });

  React.useEffect(() => {
    const deleted = getDeletedPlayerIds();
    setRecords(getLocalLeaderboard().filter((r) => 
      !deleted.includes(r.player1Id || "") && 
      !deleted.includes(r.player2Id || "")
    ));
  }, [leaderboardVersion]);
  const [activeTab, setActiveTab] = useState<"rankings" | "history">("rankings");
  const [filterMode, setFilterMode] = useState<"all" | "single" | "local" | "online">("all");
  const [selectedPlayerIdFilter, setSelectedPlayerIdFilter] = useState<string>("all");

  const cleanName = (n: string) => {
    if (!n) return n;
    return n.trim().toLowerCase() === "daddy-osayuki" ? "daddy" : n;
  };

  const handleClearHistory = () => {
    if (window.confirm("ARE YOU SURE YOU WANT TO DISINTEGRATE ALL MATCH HISTORY? THIS ACTION IS IRREVERSIBLE.")) {
      saveLocalLeaderboard([]);
      setRecords([]);
    }
  };

  // 1. Resolve unique players from the records list
  const uniquePlayers = React.useMemo(() => {
    const playersMap = new Map<string, { id: string; name: string; lastSeen: number }>();
    
    // Always include the current player profile first
    playersMap.set(currentPlayerId, {
      id: currentPlayerId,
      name: cleanName(currentPlayerName),
      lastSeen: Date.now(),
    });

    records.forEach((r) => {
      // Process Player 1
      if (r.player1Id) {
        const existing = playersMap.get(r.player1Id);
        if (!existing || r.timestamp > existing.lastSeen) {
          playersMap.set(r.player1Id, {
            id: r.player1Id,
            name: cleanName(r.player1Name),
            lastSeen: r.timestamp,
          });
        }
      }
      // Process Player 2
      if (r.player2Id) {
        const existing = playersMap.get(r.player2Id);
        if (!existing || r.timestamp > existing.lastSeen) {
          playersMap.set(r.player2Id, {
            id: r.player2Id,
            name: cleanName(r.player2Name),
            lastSeen: r.timestamp,
          });
        }
      }
    });

    return Array.from(playersMap.values());
  }, [records, currentPlayerId, currentPlayerName]);

  // 2. Compute rankings for unique players (excluding local session generic stubs "p1"/"p2")
  const playerRankings = React.useMemo(() => {
    const rankings = uniquePlayers
      .filter((p) => p.id !== "p1" && p.id !== "p2" && p.id !== "ai") // filter placeholder session IDs & general AI
      .map((player) => {
        let matchesCount = 0;
        let winsCount = 0;
        let totalTurnsInWins = 0;

        records.forEach((r) => {
          const isP1 = r.player1Id === player.id;
          const isP2 = r.player2Id === player.id;

          if (isP1 || isP2) {
            matchesCount++;

            // Check if player won this game
            const isWinner = r.winnerId === player.id || 
              (r.winnerName?.trim().toLowerCase() === player.name.trim().toLowerCase());

            if (isWinner) {
              winsCount++;
              totalTurnsInWins += r.turnsUsed;
            }
          }
        });

        const winRate = matchesCount > 0 ? Math.round((winsCount / matchesCount) * 100) : 0;
        const avgTurns = winsCount > 0 ? parseFloat((totalTurnsInWins / winsCount).toFixed(1)) : 999;

        return {
          id: player.id,
          name: player.name,
          totalMatches: matchesCount,
          wins: winsCount,
          losses: matchesCount - winsCount,
          winRate,
          avgTurns,
        };
      });

    // Sort by wins desc, then winRate desc, then avgTurns asc
    rankings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return a.avgTurns - b.avgTurns;
    });

    return rankings;
  }, [records, uniquePlayers]);

  // 3. Compute stats for the current player based strictly on their sticky Player ID
  const personalStats = React.useMemo(() => {
    let totalGames = 0;
    let wins = 0;
    let totalTurnsInWins = 0;

    records.forEach((r) => {
      const isP1 = r.player1Id === currentPlayerId;
      const isP2 = r.player2Id === currentPlayerId;

      if (isP1 || isP2) {
        totalGames++;
        const isWinner = r.winnerId === currentPlayerId || 
          (r.winnerName?.trim().toLowerCase() === currentPlayerName.trim().toLowerCase());

        if (isWinner) {
          wins++;
          totalTurnsInWins += r.turnsUsed;
        }
      } else if (r.gameMode === "local") {
        // Fallback for local games matching name
        const isWinnerByName = r.winnerName?.trim().toLowerCase() === currentPlayerName.trim().toLowerCase();
        const isP1Name = r.player1Name?.trim().toLowerCase() === currentPlayerName.trim().toLowerCase();
        const isP2Name = r.player2Name?.trim().toLowerCase() === currentPlayerName.trim().toLowerCase();

        if (isP1Name || isP2Name) {
          totalGames++;
          if (isWinnerByName) {
            wins++;
            totalTurnsInWins += r.turnsUsed;
          }
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
    };
  }, [records, currentPlayerId, currentPlayerName]);

  // 4. Filter match history logs
  const filteredRecords = records.filter((r) => {
    // Mode Filter
    if (filterMode !== "all" && r.gameMode !== filterMode) return false;

    // Player ID Filter
    if (selectedPlayerIdFilter !== "all") {
      const isP1 = r.player1Id === selectedPlayerIdFilter;
      const isP2 = r.player2Id === selectedPlayerIdFilter;
      const isP1NameMatch = r.player1Id === "p1" && r.player1Name.trim().toLowerCase() === currentPlayerName.trim().toLowerCase() && selectedPlayerIdFilter === currentPlayerId;
      const isP2NameMatch = r.player2Id === "p2" && r.player2Name.trim().toLowerCase() === currentPlayerName.trim().toLowerCase() && selectedPlayerIdFilter === currentPlayerId;
      
      return isP1 || isP2 || isP1NameMatch || isP2NameMatch;
    }

    return true;
  });

  return (
    <motion.div
      id="leaderboard-modal"
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
          Each time you connect with a peer, your terminals automatically exchange match logs. This forms a distributed serverless ledger where achievements persist, sticky to your unique secret ID even if names change!
        </div>

        {/* Sticky Stats HUD (Only shows for active player) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-8">
          <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
              YOUR PERSONAL GAMES
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-slate-100">{personalStats.totalGames}</span>
              <span className="text-[10px] font-mono text-slate-500">MATCHES</span>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
              YOUR PERSONAL WINS
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-emerald-400">{personalStats.wins}</span>
              <span className="text-[10px] font-mono text-slate-500">VICTORIES</span>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
              PERSONAL WIN RATE
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-amber-400">{personalStats.winRate}%</span>
              <span className="text-[10px] font-mono text-slate-500">RATIO</span>
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
              YOUR AVG EFFICIENCY
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-blue-400">{personalStats.avgTurns}</span>
              <span className="text-[10px] font-mono text-slate-500">GUESSES / WIN</span>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 border-b border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab("rankings")}
            className={`pb-3 px-1 font-mono text-xs font-bold uppercase tracking-wider relative transition-all cursor-pointer ${
              activeTab === "rankings" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>User Rankings</span>
            </div>
            {activeTab === "rankings" && (
              <motion.div layoutId="activeLeaderboardTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 px-1 font-mono text-xs font-bold uppercase tracking-wider relative transition-all cursor-pointer ${
              activeTab === "history" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Match History Log</span>
            </div>
            {activeTab === "history" && (
              <motion.div layoutId="activeLeaderboardTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Tab Content: Rankings */}
        {activeTab === "rankings" ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                PEERS DETECTED IN DECENTRALIZED MESH: {playerRankings.length}
              </span>
              {records.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-3 py-1 hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 border border-transparent hover:border-rose-900/40 rounded-lg font-mono text-[9px] font-bold uppercase cursor-pointer transition-all"
                >
                  WIPE DATA
                </button>
              )}
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/30 font-mono">
              <div className="grid grid-cols-12 bg-slate-950/60 border-b border-slate-800 py-2.5 px-4 text-left font-bold text-slate-500 text-[10px] uppercase tracking-wider">
                <div className="col-span-1">RANK</div>
                <div className="col-span-5">PLAYER PROFILE ID</div>
                <div className="col-span-2 text-center">DUELS</div>
                <div className="col-span-2 text-center">WINS / LOSSES</div>
                <div className="col-span-1 text-center">RATE</div>
                <div className="col-span-1 text-right">EFFICIENCY</div>
              </div>

              {playerRankings.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <Zap className="w-8 h-8 text-slate-700 animate-pulse mb-3" />
                  <p className="font-mono text-xs text-slate-500 uppercase tracking-widest">
                    NO PROFILES COMMITTED TO TERMINAL
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800 max-h-[400px] overflow-y-auto">
                  {playerRankings.map((p, idx) => {
                    const isCurrentUser = p.id === currentPlayerId;
                    const rank = idx + 1;

                    return (
                      <div
                        key={p.id}
                        onClick={isCurrentUser && onTapCurrentUser ? onTapCurrentUser : undefined}
                        className={`grid grid-cols-12 items-center py-3.5 px-4 text-xs transition-colors ${
                          isCurrentUser
                            ? "bg-emerald-950/10 border-l-2 border-emerald-500 cursor-pointer active:bg-emerald-900/20"
                            : "hover:bg-slate-900/30 border-l-2 border-transparent"
                        }`}
                      >
                        {/* Rank */}
                        <div className="col-span-1 font-bold flex items-center">
                          {rank === 1 ? (
                            <span className="text-amber-400 flex items-center gap-0.5" title="Champion">
                              🥇 <span className="text-[11px] font-bold">1</span>
                            </span>
                          ) : rank === 2 ? (
                            <span className="text-slate-300 flex items-center gap-0.5" title="2nd Place">
                              🥈 <span className="text-[11px] font-bold">2</span>
                            </span>
                          ) : rank === 3 ? (
                            <span className="text-amber-700 flex items-center gap-0.5" title="3rd Place">
                              🥉 <span className="text-[11px] font-bold">3</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 pl-1">{rank}</span>
                          )}
                        </div>

                        {/* Profile ID */}
                        <div className="col-span-5 flex items-center gap-2 overflow-hidden">
                          <span className="text-base">{isCurrentUser ? "👤" : "🌐"}</span>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold ${isCurrentUser ? "text-emerald-400" : "text-slate-200"}`}>
                                {p.name}
                              </span>
                              {isCurrentUser && (
                                <span className="bg-emerald-400/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-bold uppercase px-1 py-0.2 rounded font-mono">
                                  YOU
                                </span>
                              )}
                            </div>
                            <span className="text-[8px] text-slate-500 block font-mono">
                              ID: {p.id}
                            </span>
                          </div>
                        </div>

                        {/* Duels */}
                        <div className="col-span-2 text-center text-slate-300 font-bold">
                          {p.totalMatches}
                        </div>

                        {/* Wins / Losses */}
                        <div className="col-span-2 text-center text-[11px]">
                          <span className="text-emerald-400 font-bold">{p.wins}W</span>
                          <span className="text-slate-600 px-1">•</span>
                          <span className="text-rose-400">{p.losses}L</span>
                        </div>

                        {/* Rate */}
                        <div className="col-span-1 text-center font-bold text-amber-400">
                          {p.winRate}%
                        </div>

                        {/* Efficiency */}
                        <div className="col-span-1 text-right font-bold text-blue-400">
                          {p.avgTurns === 999 ? "N/A" : `${p.avgTurns}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Tab Content: History Logs */
          <div className="space-y-4">
            {/* Filter controls */}
            <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
              {/* Game Mode Pills */}
              <div className="flex gap-1.5 p-1 bg-slate-950 border border-slate-800/80 rounded-xl w-full md:w-auto overflow-x-auto">
                {[
                  { id: "all", label: "All Modes" },
                  { id: "single", label: "vs AI Practice" },
                  { id: "online", label: "Online Duels" },
                  { id: "local", label: "Pass & Play" },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setFilterMode(btn.id as any)}
                    className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase transition-all cursor-pointer whitespace-nowrap ${
                      filterMode === btn.id
                        ? "bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* User Selector Dropdown */}
              <div className="w-full md:w-auto flex items-center gap-2">
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider hidden sm:inline">
                  FILTER USER:
                </span>
                <select
                  value={selectedPlayerIdFilter}
                  onChange={(e) => setSelectedPlayerIdFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-1.5 font-mono text-[10px] uppercase focus:outline-none focus:border-emerald-500 cursor-pointer w-full md:w-auto"
                >
                  <option value="all">SHOW ALL MATCH PARTICIPANTS</option>
                  <option value={currentPlayerId}>SHOW MY MATCHES ONLY (YOU)</option>
                  {uniquePlayers
                    .filter((p) => p.id !== currentPlayerId && p.id !== "p1" && p.id !== "p2" && p.id !== "ai")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        SHOW MATCHES FOR: {p.name.toUpperCase()}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Records List */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/30">
              {filteredRecords.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <Zap className="w-8 h-8 text-slate-700 animate-pulse mb-3" />
                  <p className="font-mono text-xs text-slate-500 uppercase tracking-widest">
                    NO RECORD MATCHES MATCH THESE CRITERIA
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
                    const isUserP1 = r.player1Id === currentPlayerId;
                    const isUserP2 = r.player2Id === currentPlayerId;
                    
                    // Or for local matching
                    const pNameLower = currentPlayerName.trim().toLowerCase();
                    const isLocalNameMatch = isLocal && (r.player1Name.trim().toLowerCase() === pNameLower || r.player2Name.trim().toLowerCase() === pNameLower);
                    
                    const isUserInvolved = isUserP1 || isUserP2 || isLocalNameMatch;
                    const isUserWinner = (r.winnerId === currentPlayerId) || 
                      (r.winnerName?.trim().toLowerCase() === pNameLower);

                    // Identify if this is a propagated mesh record
                    const isMeshPropagated = !isUserInvolved;

                    return (
                      <div
                        key={r.matchId || `record_${i}`}
                        className={`p-4 font-mono text-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isMeshPropagated
                            ? "bg-emerald-950/5 hover:bg-emerald-950/10 border-l-2 border-emerald-500/30"
                            : isUserWinner
                            ? "bg-emerald-500/5 hover:bg-emerald-500/10 border-l-2 border-emerald-500/80"
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
                            <span className={`font-bold ${isUserP1 || (isLocal && r.player1Name.trim().toLowerCase() === pNameLower) ? "text-emerald-400" : "text-slate-300"}`}>
                              {cleanName(r.player1Name)}
                            </span>{" "}
                            <span className="text-slate-500">VS</span>{" "}
                            <span className={`font-bold ${isUserP2 || (isLocal && r.player2Name.trim().toLowerCase() === pNameLower) ? "text-emerald-400" : "text-slate-300"}`}>
                              {cleanName(r.player2Name)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 self-start sm:self-center">
                          <div className="text-right">
                            <span className="text-[9px] text-slate-500 block">VICTOR</span>
                            <span
                              className={`font-bold uppercase ${
                                isUserWinner
                                  ? "text-emerald-400 font-bold"
                                  : r.winnerName
                                  ? "text-slate-300"
                                  : "text-slate-500"
                              }`}
                            >
                              {r.winnerName ? cleanName(r.winnerName) : (r.winnerId === "ai" ? "CPU ALGORITHM" : "UNKNOWN")}
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
        )}
      </div>
    </motion.div>
  );
}
