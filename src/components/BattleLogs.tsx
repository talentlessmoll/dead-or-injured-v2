import { Guess } from "../types";
import { Target, ShieldAlert, Terminal, Sparkles } from "lucide-react";
import { useState } from "react";

interface BattleLogsProps {
  guesses: Guess[];
  playerId: string;
  opponentId: string | null;
  opponentName?: string;
  playerName?: string;
}

export default function BattleLogs({
  guesses,
  playerId,
  opponentId,
  opponentName = "OPPONENT",
  playerName = "YOU",
}: BattleLogsProps) {
  const [activeTab, setActiveTab] = useState<"player" | "opponent">("player");

  // Filter guesses
  const playerGuesses = guesses.filter((g) => g.playerId === playerId);
  const opponentGuesses = opponentId ? guesses.filter((g) => g.playerId === opponentId) : [];

  const renderGuessRow = (guess: Guess, index: number, total: number) => {
    return (
      <div
        key={guess.timestamp + "-" + index}
        className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-900 rounded-lg hover:border-slate-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-slate-600 font-bold uppercase">
            #{String(total - index).padStart(2, "0")}
          </span>
          <span className="font-mono text-lg font-bold text-slate-100 tracking-wider">
            {guess.code}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Dead Score Badge */}
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-950/20 border border-emerald-500/20 rounded-md text-emerald-400 font-mono text-xs">
            <Target className="w-3.5 h-3.5" />
            <span className="font-bold">{guess.dead}</span>
            <span className="text-[9px] text-emerald-600 font-medium tracking-tight">DEAD</span>
          </div>

          {/* Injured Score Badge */}
          <div className="flex items-center gap-1 px-2 py-1 bg-amber-950/20 border border-amber-500/20 rounded-md text-amber-400 font-mono text-xs">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="font-bold">{guess.injured}</span>
            <span className="text-[9px] text-amber-600 font-medium tracking-tight">INJURED</span>
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyState = (name: string) => {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-slate-900 rounded-xl bg-slate-950/10">
        <Terminal className="w-5 h-5 text-slate-700 animate-pulse mb-2" />
        <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">
          No records registered for {name}
        </p>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col h-full">
      {/* Mobile Tab Selectors */}
      <div className="flex md:hidden bg-slate-900/60 p-1 border border-slate-900 rounded-lg mb-3">
        <button
          onClick={() => setActiveTab("player")}
          className={`flex-1 py-1.5 rounded-md font-mono text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
            activeTab === "player"
              ? "bg-slate-800 text-emerald-400 border border-slate-700/50"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          My Strikes ({playerGuesses.length})
        </button>
        {opponentId && (
          <button
            onClick={() => setActiveTab("opponent")}
            className={`flex-1 py-1.5 rounded-md font-mono text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
              activeTab === "opponent"
                ? "bg-slate-800 text-amber-400 border border-slate-700/50"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Enemy Strikes ({opponentGuesses.length})
          </button>
        )}
      </div>

      {/* Desktop side-by-side or responsive display */}
      <div className="hidden md:grid grid-cols-2 gap-4 h-full">
        {/* Your Guesses Column */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" /> MY DECODING HISTORY
            </h4>
            <span className="text-[10px] font-mono text-slate-600">
              {playerGuesses.length} ATTEMPTS
            </span>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] pr-1">
            {playerGuesses.length > 0
              ? [...playerGuesses]
                  .reverse()
                  .map((g, idx) => renderGuessRow(g, idx, playerGuesses.length))
              : renderEmptyState(playerName)}
          </div>
        </div>

        {/* Opponent's Guesses Column */}
        {opponentId ? (
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-mono font-bold tracking-widest text-amber-500 uppercase flex items-center gap-1">
                <Terminal className="w-3 h-3" /> OPPONENT DECODING HISTORY
              </h4>
              <span className="text-[10px] font-mono text-slate-600">
                {opponentGuesses.length} ATTEMPTS
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] pr-1">
              {opponentGuesses.length > 0
                ? [...opponentGuesses]
                    .reverse()
                    .map((g, idx) => renderGuessRow(g, idx, opponentGuesses.length))
                : renderEmptyState(opponentName)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center h-full border border-dashed border-slate-900 rounded-xl p-6 bg-slate-950/20 text-center">
            <Terminal className="w-6 h-6 text-slate-800 mb-2" />
            <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">
              Awaiting tactical threat connection
            </p>
          </div>
        )}
      </div>

      {/* Mobile Tab Contents */}
      <div className="block md:hidden">
        {activeTab === "player" ? (
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            {playerGuesses.length > 0
              ? [...playerGuesses]
                  .reverse()
                  .map((g, idx) => renderGuessRow(g, idx, playerGuesses.length))
              : renderEmptyState(playerName)}
          </div>
        ) : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            {opponentGuesses.length > 0
              ? [...opponentGuesses]
                  .reverse()
                  .map((g, idx) => renderGuessRow(g, idx, opponentGuesses.length))
              : renderEmptyState(opponentName)}
          </div>
        )}
      </div>
    </div>
  );
}
