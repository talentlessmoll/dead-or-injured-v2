import React, { useState } from "react";
import { motion } from "motion/react";
import { Target, Users, Bot, Smartphone, HelpCircle, Terminal, User, Trophy, Wifi } from "lucide-react";

interface MainMenuProps {
  playerName: string;
  onUpdatePlayerName: (name: string) => void;
  onSelectMode: (mode: "online" | "single" | "local" | "wifi") => void;
  onShowInstructions: () => void;
  onShowLeaderboard: () => void;
}

export default function MainMenu({
  playerName,
  onUpdatePlayerName,
  onSelectMode,
  onShowInstructions,
  onShowLeaderboard,
}: MainMenuProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);

  const handleSubmitName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdatePlayerName(tempName.trim().slice(0, 16));
      setIsEditingName(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8">
      {/* HUD Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-8 max-w-md w-full"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-emerald-400 text-xs font-mono mb-4 tracking-wider">
          <Terminal className="w-3 h-3 animate-pulse" /> READY TO PLAY
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-100 tracking-tight leading-none">
          DEAD OR <span className="text-emerald-400 font-mono">INJURED</span>
        </h1>
        <p className="text-slate-400 mt-2 text-sm tracking-wide font-mono uppercase">
          Code-Breaking Logic Game
        </p>
      </motion.div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-8 backdrop-blur-md"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Call-Sign</p>
              {isEditingName ? (
                <form onSubmit={handleSubmitName} className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-sm font-mono focus:outline-none focus:border-emerald-500 w-36"
                    maxLength={16}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="text-emerald-400 hover:text-emerald-300 font-mono text-xs px-2 py-1 bg-emerald-950/40 border border-emerald-500/20 rounded"
                  >
                    SAVE
                  </button>
                </form>
              ) : (
                <h3 className="text-slate-200 font-mono font-medium text-lg leading-tight flex items-center gap-2">
                  {playerName}
                  <button
                    onClick={() => {
                      setTempName(playerName);
                      setIsEditingName(true);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 underline cursor-pointer"
                  >
                    edit
                  </button>
                </h3>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onShowInstructions}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 hover:border-slate-600 rounded-lg text-slate-300 text-[11px] sm:text-xs transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>HOW TO PLAY</span>
            </button>
            <button
              onClick={onShowLeaderboard}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg text-emerald-400 text-[11px] sm:text-xs font-mono tracking-wide transition-colors cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span>LEADERBOARD</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Mode Selection Grid */}
      <div className="grid grid-cols-1 gap-4 w-full max-w-md">
        {/* ONLINE MULTIPLAYER */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => onSelectMode("online")}
          className="group relative flex items-center justify-between p-5 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/80 rounded-xl text-left transition-all duration-300 shadow-lg shadow-slate-950/50 cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-lg text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-300">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                ONLINE DUEL
              </h3>
              <p className="text-xs text-slate-400 mt-1 mr-4">
                Sync instantly via room code or QR code to battle friends in real-time.
              </p>
            </div>
          </div>
          <div className="absolute top-3 right-3 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded tracking-widest">
            REALTIME
          </div>
        </motion.button>

        {/* LOCAL WIFI MULTIPLAYER */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          onClick={() => onSelectMode("wifi")}
          className="group relative flex items-center justify-between p-5 bg-slate-900 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900/80 rounded-xl text-left transition-all duration-300 shadow-lg shadow-slate-950/50 cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-cyan-950/60 border border-cyan-500/30 rounded-lg text-cyan-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-all duration-300">
              <Wifi className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">
                LOCAL WIFI
              </h3>
              <p className="text-xs text-slate-400 mt-1 mr-4">
                Scan your local network to discover and play against nearby terminals instantly.
              </p>
            </div>
          </div>
          <div className="absolute top-3 right-3 text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded tracking-widest">
            LAN SCAN
          </div>
        </motion.button>

        {/* VS AI MODE */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={() => onSelectMode("single")}
          className="group relative flex items-center justify-between p-5 bg-slate-900 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900/80 rounded-xl text-left transition-all duration-300 shadow-lg shadow-slate-950/50 cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-950/60 border border-amber-500/30 rounded-lg text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all duration-300">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                VS AI PRACTICE
              </h3>
              <p className="text-xs text-slate-400 mt-1 mr-4">
                Hone your code-breaking skills offline against a smart deduction algorithm.
              </p>
            </div>
          </div>
          <div className="absolute top-3 right-3 text-[10px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded tracking-widest">
            SOLO AI
          </div>
        </motion.button>

        {/* LOCAL PASS AND PLAY */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          onClick={() => onSelectMode("local")}
          className="group relative flex items-center justify-between p-5 bg-slate-900 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-900/80 rounded-xl text-left transition-all duration-300 shadow-lg shadow-slate-950/50 cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-950/60 border border-blue-500/30 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-slate-950 transition-all duration-300">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                PASS & PLAY
              </h3>
              <p className="text-xs text-slate-400 mt-1 mr-4">
                Play on a single phone with hidden-screen layout handoffs.
              </p>
            </div>
          </div>
          <div className="absolute top-3 right-3 text-[10px] font-mono text-blue-400 bg-blue-950/60 border border-blue-800/40 px-2 py-0.5 rounded tracking-widest">
            DEVICE
          </div>
        </motion.button>
      </div>

      {/* Footer Branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 0.6 }}
        className="mt-12 text-center text-xs font-mono text-slate-500 uppercase tracking-widest"
      >
        Dead or Injured Codebreaker v1.0
      </motion.div>
    </div>
  );
}
