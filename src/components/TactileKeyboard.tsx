import { X, Delete, Check } from "lucide-react";

interface TactileKeyboardProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  title?: string;
  submitLabel?: string;
  disabled?: boolean;
}

export default function TactileKeyboard({
  value,
  onChange,
  onSubmit,
  title = "ENTER DIGITS",
  submitLabel = "SUBMIT PROTOCOL",
  disabled = false,
}: TactileKeyboardProps) {
  const currentDigits = value.split("");

  const handleKeyPress = (digit: string) => {
    if (disabled) return;
    if (currentDigits.length >= 4) return;
    // Enforce the Golden Rule: No repeats!
    if (currentDigits.includes(digit)) return;

    onChange(value + digit);
  };

  const handleBackspace = () => {
    if (disabled) return;
    if (value.length === 0) return;
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled) return;
    onChange("");
  };

  const isSubmitDisabled = disabled || value.length !== 4;

  return (
    <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col items-center">
      <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest mb-3">
        {title}
      </h3>

      {/* Code Slot Visual Display */}
      <div className="flex gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => {
          const digit = currentDigits[i];
          const isActive = currentDigits.length === i;

          return (
            <div
              key={i}
              className={`w-12 h-14 border rounded-xl flex items-center justify-center font-mono text-2xl font-bold transition-all duration-150 ${
                digit
                  ? "bg-slate-950 border-emerald-500/50 text-emerald-400 text-glow"
                  : isActive
                  ? "bg-slate-900 border-slate-600 animate-pulse"
                  : "bg-slate-950 border-slate-800 text-slate-700"
              }`}
            >
              {digit || "•"}
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

            return (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digitStr)}
                disabled={disabled || isUsed}
                className={`h-12 rounded-lg font-mono text-lg font-semibold flex items-center justify-center border transition-all cursor-pointer select-none ${
                  isUsed
                    ? "bg-slate-950/40 border-slate-950/60 text-slate-800"
                    : "bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700 active:scale-95"
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
            disabled={disabled || value.length === 0}
            className="h-12 rounded-lg font-mono text-xs font-medium flex items-center justify-center border bg-slate-900/40 border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 active:scale-95 disabled:opacity-40 cursor-pointer select-none"
          >
            CLEAR
          </button>

          <button
            type="button"
            onClick={() => handleKeyPress("0")}
            disabled={disabled || currentDigits.includes("0")}
            className={`h-12 rounded-lg font-mono text-lg font-semibold flex items-center justify-center border transition-all cursor-pointer select-none ${
              currentDigits.includes("0")
                ? "bg-slate-950/40 border-slate-950/60 text-slate-800"
                : "bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700 active:scale-95"
            }`}
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            disabled={disabled || value.length === 0}
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
