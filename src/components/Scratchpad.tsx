import React, { useState } from "react";
import { X, Check, HelpCircle, FileText, Grid, Hash, RotateCcw, AlertCircle, Zap } from "lucide-react";
import { ScratchpadState } from "../types";

interface ScratchpadProps {
  state: ScratchpadState;
  onChange: (newState: ScratchpadState) => void;
  onAutofill?: (code: string) => void;
}

export default function Scratchpad({ state, onChange, onAutofill }: ScratchpadProps) {
  const [activeTab, setActiveTab] = useState<"matrix" | "digits">("matrix");

  // Ensure matrix is initialized (for backwards compatibility if state loaded from legacy)
  const matrix = state.matrix || Array(10).fill(null).map(() => Array(4).fill("neutral"));

  // Find deduced digits from the matrix using standard and smart logical deduction
  const getDeducedCodeWithSmartInference = (): string[] => {
    let deduced = ["", "", "", ""];
    const explicitYesDigits = new Set<number>();
    
    // 1. Pass: Find explicit "yes" positions
    for (let p = 0; p < 4; p++) {
      for (let d = 0; d < 10; d++) {
        if (matrix[d] && matrix[d][p] === "yes") {
          deduced[p] = d.toString();
          explicitYesDigits.add(d);
          break;
        }
      }
    }
    
    // 2. Pass: Smart Inference
    // For each position that is still empty, let's find which digits can possibly go there.
    // A digit can go to position p if:
    // - matrix[d][p] !== "no"
    // - d is not already explicitly confirmed in another position
    // If there is exactly one such digit, we can infer it!
    let changed = true;
    while (changed) {
      changed = false;
      for (let p = 0; p < 4; p++) {
        if (deduced[p] !== "") continue;
        
        const candidates: number[] = [];
        for (let d = 0; d < 10; d++) {
          if (explicitYesDigits.has(d)) continue;
          if (matrix[d] && matrix[d][p] !== "no") {
            candidates.push(d);
          }
        }
        
        if (candidates.length === 1) {
          const inferredDigit = candidates[0];
          deduced[p] = inferredDigit.toString();
          explicitYesDigits.add(inferredDigit);
          changed = true;
        }
      }
    }
    
    return deduced;
  };

  const deducedArray = getDeducedCodeWithSmartInference();
  const deducedCode = deducedArray.join("");
  const hasDeducedDigits = deducedArray.some(c => c !== "");

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

  // Matrix Position Click Handler
  const handleMatrixCellClick = (digit: number, posIndex: number) => {
    const newMatrix = matrix.map((row) => [...row]);
    const currentVal = newMatrix[digit][posIndex];

    let nextVal: "neutral" | "yes" | "no" = "neutral";
    if (currentVal === "neutral") {
      nextVal = "no";
    } else if (currentVal === "no") {
      nextVal = "yes";
    } else {
      nextVal = "neutral";
    }

    newMatrix[digit][posIndex] = nextVal;

    // Smart Deduction Helper:
    // If we confirmed D at pos P:
    // 1. Set other positions of D to "no"
    // 2. Set other digits at pos P to "no"
    // 3. Mark the overall digit confirmed state as true
    const updatedConfirmed = [...state.confirmed];
    const updatedEliminated = [...state.eliminated];

    if (nextVal === "yes") {
      // Clear this digit from other positions, clear other digits from this position
      for (let p = 0; p < 4; p++) {
        if (p !== posIndex) {
          newMatrix[digit][p] = "no";
        }
      }
      for (let d = 0; d < 10; d++) {
        if (d !== digit) {
          newMatrix[d][posIndex] = "no";
        }
      }
      updatedConfirmed[digit] = true;
      updatedEliminated[digit] = false;
    } else if (currentVal === "yes" && nextVal === "neutral") {
      // If we removed a confirm, reset confirmed state
      updatedConfirmed[digit] = false;
    }

    onChange({
      ...state,
      confirmed: updatedConfirmed,
      eliminated: updatedEliminated,
      matrix: newMatrix,
    });
  };

  const resetScratchpad = () => {
    onChange({
      eliminated: Array(10).fill(false),
      confirmed: Array(10).fill(false),
      maybe: Array(10).fill(false),
      notes: "",
      matrix: Array(10).fill(null).map(() => Array(4).fill("neutral")),
    });
  };

  const getMatrixCellClasses = (digit: number, posIndex: number) => {
    const val = matrix[digit][posIndex];
    if (val === "yes") {
      return "bg-emerald-950/40 border-emerald-500 text-emerald-400 font-bold shadow-[0_0_8px_rgba(16,185,129,0.2)]";
    }
    if (val === "no") {
      return "bg-red-950/20 border-red-900/60 text-red-500 font-medium";
    }
    return "bg-slate-900/30 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300";
  };

  return (
    <div id="smart-scratchpad" className="w-full bg-slate-950/40 border border-slate-900 rounded-xl p-4 flex flex-col h-full">
      {/* Header with main title & Reset */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2">
        <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 flex items-center gap-1.5 uppercase">
          <Grid className="w-3.5 h-3.5 text-emerald-400" /> DEDUCTIVE MATRIX
        </h3>
        <button
          onClick={resetScratchpad}
          className="text-[10px] font-mono text-slate-500 hover:text-slate-300 uppercase cursor-pointer flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Reset Ledger
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 bg-slate-950/80 border border-slate-900 rounded-lg mb-3">
        <button
          onClick={() => setActiveTab("matrix")}
          className={`flex-1 py-1 px-2 text-[10px] font-mono font-bold uppercase rounded transition-all cursor-pointer ${
            activeTab === "matrix"
              ? "bg-emerald-500 text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Positional Matrix
        </button>
        <button
          onClick={() => setActiveTab("digits")}
          className={`flex-1 py-1 px-2 text-[10px] font-mono font-bold uppercase rounded transition-all cursor-pointer ${
            activeTab === "digits"
              ? "bg-emerald-500 text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Digit Flags
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 min-h-[220px]">
        {activeTab === "digits" ? (
          <div>
            <p className="text-[10px] text-slate-500 font-mono mb-3 uppercase tracking-tight">
              Tap digits to cycle state: <span className="text-slate-400">Neutral</span> →{" "}
              <span className="text-red-500/70">Trash</span> →{" "}
              <span className="text-emerald-400">Confirm</span> →{" "}
              <span className="text-amber-400">Maybe</span>
            </p>

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
          </div>
        ) : (
          <div>
            {/* Explanatory text */}
            <p className="text-[9px] text-slate-500 font-mono mb-2 uppercase tracking-normal leading-tight">
              Cycle cell status: <span className="text-slate-400">Neutral</span> →{" "}
              <span className="text-rose-500">✕ (No)</span> →{" "}
              <span className="text-emerald-400">✔ (Yes)</span>. Confirming auto-resolves cross-correlations!
            </p>

            {/* Matrix Board */}
            <div className="border border-slate-900 rounded-lg overflow-hidden bg-slate-950/20 text-[11px] font-mono">
              {/* Header row */}
              <div className="grid grid-cols-5 bg-slate-950/60 border-b border-slate-900 py-1 text-center font-bold text-slate-500 text-[9px] tracking-wider uppercase">
                <div className="border-r border-slate-900 py-1 flex items-center justify-center gap-0.5">
                  <Hash className="w-2.5 h-2.5 text-slate-500" /> DIGIT
                </div>
                <div className="py-1">1st</div>
                <div className="py-1">2nd</div>
                <div className="py-1">3rd</div>
                <div className="py-1">4th</div>
              </div>

              {/* Data rows */}
              <div className="divide-y divide-slate-900/60">
                {Array.from({ length: 10 }).map((_, digit) => {
                  const isDigitConfirmed = state.confirmed[digit];
                  const isDigitEliminated = state.eliminated[digit];

                  return (
                    <div
                      key={digit}
                      className={`grid grid-cols-5 items-center text-center transition-colors ${
                        isDigitConfirmed
                          ? "bg-emerald-950/5"
                          : isDigitEliminated
                          ? "bg-red-950/5 opacity-50"
                          : ""
                      }`}
                    >
                      {/* Digit label */}
                      <div
                        onClick={() => handleDigitClick(digit)}
                        className={`font-bold border-r border-slate-900 py-1.5 h-full flex items-center justify-center cursor-pointer select-none transition-colors ${
                          isDigitConfirmed
                            ? "text-emerald-400 bg-emerald-950/10"
                            : isDigitEliminated
                            ? "text-slate-600 line-through decoration-red-900 bg-slate-950/20"
                            : "text-slate-300 hover:bg-slate-900/40"
                        }`}
                        title="Click to toggle overall digit status"
                      >
                        {digit}
                        {isDigitConfirmed && <Check className="w-2 h-2 ml-1 text-emerald-400" />}
                        {isDigitEliminated && <X className="w-2 h-2 ml-1 text-rose-500" />}
                      </div>

                      {/* Position cells */}
                      {Array.from({ length: 4 }).map((_, pIdx) => {
                        const cellVal = matrix[digit][pIdx];

                        return (
                          <div key={pIdx} className="p-0.5 h-full">
                            <button
                              onClick={() => handleMatrixCellClick(digit, pIdx)}
                              className={`w-full h-full py-1 rounded text-center font-mono font-bold transition-all flex items-center justify-center cursor-pointer border ${getMatrixCellClasses(
                                digit,
                                pIdx
                              )}`}
                            >
                              {cellVal === "yes" ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : cellVal === "no" ? (
                                <X className="w-3 h-3 text-rose-500 opacity-80" />
                              ) : (
                                <span className="opacity-0">·</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deductive Autofill Guess Trigger */}
      {onAutofill && hasDeducedDigits && (
        <button
          onClick={() => onAutofill(deducedCode)}
          className="mt-3 w-full py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-[11px] font-bold uppercase rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:scale-[1.01] active:scale-95"
          title="Auto-fills the draft guess code input field with current deduction"
        >
          <Zap className="w-3 h-3 text-slate-950 animate-bounce" />
          <span>Autofill Guess:</span>
          <div className="flex gap-1 ml-1">
            {deducedArray.map((char, idx) => (
              <span
                key={idx}
                className={`inline-block w-5 h-5 leading-5 text-center rounded text-xs font-bold border ${
                  char 
                    ? "bg-slate-950 border-emerald-400 text-emerald-400" 
                    : "bg-slate-950/40 border-slate-800 text-slate-600"
                }`}
              >
                {char || "·"}
              </span>
            ))}
          </div>
        </button>
      )}

      {/* Notes Area */}
      <div className="mt-3">
        <textarea
          value={state.notes}
          onChange={(e) => onChange({ ...state, notes: e.target.value })}
          placeholder="Write candidates, patterns, possible guesses here..."
          className="w-full h-14 bg-slate-950/60 border border-slate-900 rounded-lg p-2 text-xs text-slate-300 font-mono placeholder:text-slate-700 focus:outline-none focus:border-slate-700 resize-none"
        />
      </div>
    </div>
  );
}
