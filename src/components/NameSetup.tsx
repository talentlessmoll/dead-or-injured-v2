import React, { useState } from "react";
import { motion } from "motion/react";
import { Terminal, Shield, RefreshCw, UserCheck, AlertTriangle } from "lucide-react";

interface NameSetupProps {
  onSave: (name: string) => void;
  onClose?: () => void;
}

const CYBERPUNK_CODENAMES = [
  "SPECTRE", "CIPHER", "KESTREL", "PHANTOM", "XENON", "NEURAL", "MATRIX", "ZERO_COOL",
  "ACID_BURN", "CHROME", "VORTEX", "APEX", "COBALT", "SYNAPSE", "ORACLE", "MIRAGE",
  "NEXUS", "STRIKER", "FALCON", "VOID", "QUASAR", "AEON", "OBSIDIAN", "TITAN",
  "SHADOW", "VECTOR", "CYBER", "SABER", "BLADE", "HELIX", "PROXY", "DAEMON", "CORTEZ"
];

const RANDOM_SUFFIXES = [
  "9", "77", "101", "X", "01", "99", "88", "404", "SYS", "NET", "CORE", "ALPHA", "OMEGA"
];

export default function NameSetup({ onSave, onClose }: NameSetupProps) {
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(() => getRandomSuggestions());

  function getRandomSuggestions() {
    const shuffled = [...CYBERPUNK_CODENAMES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5).map(base => {
      if (Math.random() > 0.4) {
        const suffix = RANDOM_SUFFIXES[Math.floor(Math.random() * RANDOM_SUFFIXES.length)];
        return `${base}_${suffix}`;
      }
      return base;
    });
  }

  const handleRerollSuggestions = () => {
    setSuggestions(getRandomSuggestions());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();

    if (!cleanName) {
      setError("OPERATOR CALL-SIGN CANNOT BE BLANK");
      return;
    }

    if (cleanName.length < 2) {
      setError("CALL-SIGN MUST BE AT LEAST 2 CHARACTERS");
      return;
    }

    if (cleanName.length > 16) {
      setError("CALL-SIGN MAX LENGTH IS 16 CHARACTERS");
      return;
    }

    if (cleanName.toLowerCase() === "guesser") {
      setError("IDENTIFIER 'GUESSER' IS RESTRICTED / BLACKLISTED");
      return;
    }

    onSave(cleanName);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative z-10"
      >
        {/* Holographic scanner accent */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent animate-pulse" />

        {/* Security badge icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <Shield className="w-7 h-7 animate-pulse" />
          </div>
        </div>

        <div className="text-center mb-6">
          <span className="text-[10px] font-mono text-emerald-500 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/20 uppercase tracking-widest">
            INITIALIZING SECURE LINK
          </span>
          <h2 className="text-2xl font-display font-extrabold text-slate-100 tracking-tight mt-3">
            REGISTER CALL-SIGN
          </h2>
          <p className="text-xs text-slate-400 font-mono uppercase mt-1.5 leading-relaxed max-w-xs mx-auto">
            Every logic operator must define a custom alphanumeric identifier to access tactical terminal networks.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                OPERATOR CODENAME
              </label>
              <span className="text-[8px] font-mono text-slate-500">
                {nameInput.length}/16 CHARS
              </span>
            </div>
            
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
                <Terminal className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => {
                  setError(null);
                  setNameInput(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""));
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-slate-200 font-mono text-sm uppercase tracking-wider focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all placeholder:text-slate-800"
                placeholder="ENTER CALL-SIGN..."
                maxLength={16}
                autoFocus
              />
            </div>
          </div>

          {/* Validation Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-rose-950/20 border border-rose-500/30 text-rose-400 rounded-xl text-[10px] font-mono flex items-start gap-2 uppercase tracking-wide"
            >
              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Suggestions Terminal */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                GENERATE TACTICAL HANDLES
              </span>
              <button
                type="button"
                onClick={handleRerollSuggestions}
                className="text-[9px] font-mono text-emerald-500 hover:text-emerald-400 uppercase tracking-widest flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                REROLL
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    setError(null);
                    setNameInput(sug);
                  }}
                  className={`px-3 py-1.5 bg-slate-950/60 border rounded-lg text-[10px] font-mono transition-all cursor-pointer select-none uppercase ${
                    nameInput.toUpperCase() === sug.toUpperCase()
                      ? "border-emerald-500 text-emerald-400 bg-emerald-950/10 shadow-[0_0_8px_rgba(16,185,129,0.15)] font-bold"
                      : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                  }`}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Trigger */}
          <div className="pt-2 flex gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-mono text-xs font-bold uppercase rounded-xl tracking-wider transition-colors cursor-pointer"
              >
                ABORT
              </button>
            )}
            <button
              type="submit"
              className="flex-[2] py-3 bg-emerald-950/40 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 hover:border-emerald-500 rounded-xl font-mono text-xs font-bold tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.1)] cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              ESTABLISH CODENAME
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
