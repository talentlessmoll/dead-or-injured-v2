import { ScratchpadState } from "../types";
import { X, Check, HelpCircle, FileText } from "lucide-react";

interface ScratchpadProps {
  state: ScratchpadState;
  onChange: (newState: ScratchpadState) => void;
}

export default function Scratchpad({ state, onChange }: ScratchpadProps) {
  // Cycle through states: neutral -> eliminated -> confirmed -> maybe -> neutral
  const handleDigitClick = (idx: number) => {
    const eliminated = [...state.eliminated];
    const confirmed = [...state.confirmed];
    const maybe = [...state.maybe];

    if (!eliminated[idx] && !confirmed[idx] && !maybe[idx]) {
      // Transition to Eliminated (Cross out)
      eliminated[idx] = true;
    } else if (eliminated[idx]) {
      // Transition to Confirmed (Green check)
      eliminated[idx] = false;
      confirmed[idx] = true;
    } else if (confirmed[idx]) {
      // Transition to Maybe (Orange question mark)
      confirmed[idx] = false;
      maybe[idx] = true;
    } else {
      // Transition back to Neutral
      maybe[idx] = false;
    }

    onChange({
      ...state,
      eliminated,
      confirmed,
      maybe,
    });
  };

  const getDigitClasses = (idx: number) => {
    if (state.eliminated[idx]) {
      return "bg-slate-950/80 border-slate-900 text-slate-700 line-through decoration-red-600/60 decoration-2";
    }
    if (state.confirmed[idx]) {
      return "bg-emerald-950/20 border-emerald-500 text-emerald-400 font-bold shadow-[0_0_8px_rgba(16,185,129,0.15)]";
    }
    if (state.maybe[idx]) {
      return "bg-amber-950/20 border-amber-500 text-amber-400 font-bold shadow-[0_0_8px_rgba(245,158,11,0.15)]";
    }
    return "bg-slate-900/40 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60";
  };

  const resetScratchpad = () => {
    onChange({
      eliminated: Array(10).fill(false),
      confirmed: Array(10).fill(false),
      maybe: Array(10).fill(false),
      notes: "",
    });
  };

  return (
    <div className="w-full bg-slate-950/40 border border-slate-900 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2">
        <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 flex items-center gap-1.5 uppercase">
          <FileText className="w-3.5 h-3.5 text-emerald-400" /> SCRATCHPAD
        </h3>
        <button
          onClick={resetScratchpad}
          className="text-[10px] font-mono text-slate-500 hover:text-slate-300 uppercase cursor-pointer"
        >
          Reset All
        </button>
      </div>

      <p className="text-[10px] text-slate-500 font-mono mb-3 uppercase tracking-tight">
        Tap keys to cycle status: <span className="text-slate-400">Neutral</span> →{" "}
        <span className="text-red-500/70">Trash</span> →{" "}
        <span className="text-emerald-400">Confirm</span> →{" "}
        <span className="text-amber-400">Maybe</span>
      </p>

      {/* Grid of digits 0-9 */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <button
            key={i}
            onClick={() => handleDigitClick(i)}
            className={`h-11 border rounded-lg text-sm font-mono flex flex-col items-center justify-center relative select-none transition-all cursor-pointer ${getDigitClasses(
              i
            )}`}
          >
            <span className="text-base leading-none">{i}</span>

            {/* Micro Icon Overlays */}
            {state.eliminated[i] && (
              <X className="w-2.5 h-2.5 text-red-500 absolute top-1 right-1 opacity-50" />
            )}
            {state.confirmed[i] && (
              <Check className="w-2.5 h-2.5 text-emerald-400 absolute top-1 right-1" />
            )}
            {state.maybe[i] && (
              <HelpCircle className="w-2.5 h-2.5 text-amber-400 absolute top-1 right-1" />
            )}
          </button>
        ))}
      </div>

      {/* Text Notes Box */}
      <div>
        <textarea
          value={state.notes}
          onChange={(e) => onChange({ ...state, notes: e.target.value })}
          placeholder="Write notes here, candidate codes, possible guesses..."
          className="w-full h-16 bg-slate-950/60 border border-slate-900 rounded-lg p-2 text-xs text-slate-300 font-mono placeholder:text-slate-700 focus:outline-none focus:border-slate-700 resize-none"
        />
      </div>
    </div>
  );
}
