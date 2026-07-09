import { Guess } from "./types";

// Check if string is 4 unique digits
export function hasUniqueDigits(code: string): boolean {
  if (code.length !== 4) return false;
  if (!/^\d{4}$/.test(code)) return false;
  const set = new Set(code);
  return set.size === 4;
}

// Generate a random 4-digit unique code
export function generateRandomCode(): string {
  const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  let code = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * digits.length);
    code += digits.splice(idx, 1)[0];
  }
  return code;
}

// Score a guess against a secret code
export function calculateScore(guess: string, secret: string): { dead: number; injured: number } {
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
}

// Generate all 5,040 valid unique 4-digit codes
export function generateAllPossibleCodes(): string[] {
  const codes: string[] = [];
  for (let a = 0; a <= 9; a++) {
    for (let b = 0; b <= 9; b++) {
      if (b === a) continue;
      for (let c = 0; c <= 9; c++) {
        if (c === a || c === b) continue;
        for (let d = 0; d <= 9; d++) {
          if (d === a || d === b || d === c) continue;
          codes.push(`${a}${b}${c}${d}`);
        }
      }
    }
  }
  return codes;
}

/**
 * Filter the pool of candidates based on past guess feedback.
 * Keeping only those candidates that would yield the EXACT same Dead/Injured
 * scores if they were the secret code.
 */
export function filterCandidates(
  candidates: string[],
  guess: string,
  dead: number,
  injured: number
): string[] {
  return candidates.filter((candidate) => {
    const sc = calculateScore(guess, candidate);
    return sc.dead === dead && sc.injured === injured;
  });
}

/**
 * Gets the next smart guess for the AI.
 * If it's the first turn, guess a strong opener like "0123" or "1234" (or random from candidates).
 * Otherwise, filter down the candidates based on full guess history and pick one of the best.
 */
export function getSmartAIGuess(aiHistory: Guess[], userSecret: string): string {
  let candidates = generateAllPossibleCodes();

  // Replay all previous AI guesses and their scores against the user's secret to filter down the candidate list
  for (const h of aiHistory) {
    const score = calculateScore(h.code, userSecret);
    candidates = filterCandidates(candidates, h.code, score.dead, score.injured);
  }

  if (candidates.length === 0) {
    // Fallback if mismatch
    return generateRandomCode();
  }

  // Select a candidate randomly from the remaining optimal pool
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx];
}
