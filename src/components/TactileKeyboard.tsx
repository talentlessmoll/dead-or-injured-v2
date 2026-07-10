import React from "react";
import { Delete, Check } from "lucide-react";

interface TactileKeyboardProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  title?: React.ReactNode;
  submitLabel?: string;
  disabled?: boolean;
  lockedPattern?: string; // e.g. "  5 " (spaces represent empty, non-spaces represent locked deduced positions)
  disabledDigits?: string[]; // digits that should be unclickable (marked as 'X' / eliminated in matrix)
}

export default function TactileKeyboard({
  value,
  onChange,
  onSubmit,
  title = "ENTER DIGITS",
  submitLabel = "SUBMIT PROTOCOL",
  disabled = false,
  lockedPattern = "    ",
  disabledDigits = [],
}: TactileKeyboardProps) {
  const locked = lockedPattern.split("");
  const currentDigits = Array(4).fill(" ");

  // Ensure locked positions are populated, then populate other positions from value
  const lockedSet = new Set(locked.filter(c => c !== " "));
  for (let i = 0; i < 4; i++) {
    if (locked[i] && locked[i] !== " ") {
      currentDigits[i] = locked[i];
    } else if (value[i] && value[i] !== " ") {
      // Clear value digit if it duplicates any locked digits
      if (lockedSet.has(value[i])) {
        currentDigits[i] = " ";
      } else {
        currentDigits[i] = value[i];
      }
    }
  }

  const handleKeyPress = (digit: string) => {
    if (disabled) return;
    
    // Enforce the Golden Rule: No repeats!
    if (currentDigits.includes(digit)) return;

    // Find the first empty slot that is not locked
    const nextEmptyIdx = currentDigits.findIndex((char, idx) => char === " " && (!locked[idx] || locked[idx] === " "));
    if (nextEmptyIdx !== -1) {
      const newDigits = [...currentDigits];
      newDigits[nextEmptyIdx] = digit;
      onChange(newDigits.join(""));
    }
  };

  const handleBackspace = () => {
    if (disabled) return;
    
    // Find the rightmost filled slot that is not locked
    let targetIdx = -1;
    for (let i = 3; i >= 0; i--) {
      if (currentDigits[i] !== " " && (!locked[i] || locked[i] === " ")) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx !== -1) {
      const newDigits = [...currentDigits];
      newDigits[targetIdx] = " ";
      onChange(newDigits.join(""));
    }
  };

  const handleClear = () => {
    if (disabled) return;
    // Clear user-typed digits but preserve the locked ones from scratchpad deduction
    const newDigits = currentDigits.map((char, idx) => {
      return (locked[idx] && locked[idx] !== " ") ? locked[idx] : " ";
    });
    onChange(newDigits.join(""));
  };

  const isSubmitDisabled = disabled || currentDigits.some(char => char === " ");

  const nextActiveIdx = currentDigits.findIndex((char, idx) => char === " " && (!locked[idx] || locked[idx] === " "));

  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col items-center">
      <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest mb-3">
        {title}
      </h3>

      {/* Code Slot Visual Display */}
      <div className="flex gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => {
          const digit = currentDigits[i];
          const isLocked = locked[i] && locked[i] !== " ";
          const isActive = !disabled && nextActiveIdx === i;

          return (
            <div
              key={i}
              onClick={() => {
                if (disabled) return;
                // Tap to clear non-locked filled digits
                if (digit && digit !== " " && !isLocked) {
                  const newDigits = [...currentDigits];
                  newDigits[i] = " ";
                  onChange(newDigits.join(""));
                }
              }}
              className={`w-12 h-14 border rounded-xl flex items-center justify-center font-mono text-2xl font-bold transition-all duration-150 relative select-none ${
                digit && digit !== " "
                  ? isLocked
                    ? "bg-slate-950 border-cyan-500/50 text-cyan-400 text-glow"
                    : "bg-slate-950 border-emerald-500/50 text-emerald-400 text-glow cursor-pointer hover:border-red-500/50 hover:text-red-400"
                  : isActive
                  ? "bg-slate-900 border-slate-600 animate-pulse"
                  : "bg-slate-950 border-slate-800 text-slate-700"
              }`}
            >
              {digit && digit !== " " ? digit : "•"}
              {isLocked && (
                <span className="absolute top-1 right-1 text-[8px] leading-none" title="Deductive Locked">
                  🔒
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Keypad Grid (0-9, Backspace, Clear) */}
      <div className="w-full max-w-sm">
        <div className="grid grid-cols-3 gap-2">
          {/* Digits 1-9 */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
            const digitStr = digit.toString();
            const isUsed = currentDigits.includes(digitStr);
            const isEliminated = disabledDigits?.includes(digitStr);
            const isBtnDisabled = disabled || isUsed || isEliminated;

            return (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digitStr)}
                disabled={isBtnDisabled}
                className={`h-12 rounded-lg font-mono text-lg font-semibold flex items-center justify-center border transition-all select-none ${
                  isUsed
                    ? "bg-slate-950/40 border-slate-950/60 text-slate-800 cursor-not-allowed"
                    : isEliminated
                    ? "bg-slate-950/30 border-red-950/20 text-red-900/40 line-through decoration-red-900/40 cursor-not-allowed opacity-30 animate-pulse"
                    : "bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700 active:scale-95 cursor-pointer"
                }`}
              >
                {digit}
              </button>
            );
          })}

          {/* Bottom Row: Clear (X), 0, Backspace */}
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || currentDigits.every((char, idx) => char === " " || (locked[idx] && locked[idx] !== " "))}
            className="h-12 rounded-lg font-mono text-xs font-medium flex items-center justify-center border bg-slate-900/40 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 active:scale-95 disabled:opacity-40 cursor-pointer select-none"
          >
            CLEAR
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            disabled={disabled || currentDigits.includes("0") || disabledDigits?.includes("0")}
            className={`h-12 rounded-lg font-mono text-lg font-semibold flex items-center justify-center border transition-all select-none ${
              currentDigits.includes("0")
                ? "bg-slate-950/40 border-slate-950/60 text-slate-800 cursor-not-allowed"
                : disabledDigits?.includes("0")
                ? "bg-slate-950/30 border-red-950/20 text-red-900/40 line-through decoration-red-900/40 cursor-not-allowed opacity-30 animate-pulse"
                : "bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700 active:scale-95 cursor-pointer"
            }`}
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            disabled={disabled || currentDigits.every((char, idx) => char === " " || (locked[idx] && locked[idx] !== " "))}
            className="h-12 rounded-lg font-mono text-lg font-semibold flex items-center justify-center border bg-slate-900/40 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 active:scale-95 disabled:opacity-40 cursor-pointer select-none"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Big Submit Button */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitDisabled}
          className={`w-full mt-4 h-12 rounded-xl font-mono font-bold tracking-wider text-sm flex items-center justify-center gap-2 border transition-all select-none ${
            isSubmitDisabled
              ? "bg-slate-950 border-slate-900 text-slate-700"
              : "bg-emerald-950/40 border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 cursor-pointer active:scale-[0.99] shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          }`}
        >
          <Check className="w-4 h-4" />
          <span>{submitLabel}</span>
        </button>
      </div>
    </div>
  );
}
