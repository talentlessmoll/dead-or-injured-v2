import { Guess, LeaderboardRecord, ScratchpadState } from "./types";

// Get deduced code from positional matrix using smart logical deduction
export function getDeducedCodeWithSmartInference(state: ScratchpadState): string[] {
  const deduced = ["", "", "", ""];
  const matrix = state.matrix || Array(10).fill(null).map(() => Array(4).fill("neutral"));
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
}

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

// Get local leaderboard records
export function getLocalLeaderboard(): LeaderboardRecord[] {
  try {
    const raw = localStorage.getItem("doi_leaderboard");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LeaderboardRecord[];
  } catch (e) {
    console.error("Failed to parse local leaderboard:", e);
    return [];
  }
}

// Save local leaderboard records
export function saveLocalLeaderboard(records: LeaderboardRecord[]): void {
  try {
    localStorage.setItem("doi_leaderboard", JSON.stringify(records));
  } catch (e) {
    console.error("Failed to save local leaderboard:", e);
  }
}

// Add a single record to the local leaderboard
export function addLeaderboardRecord(record: LeaderboardRecord): LeaderboardRecord[] {
  const current = getLocalLeaderboard();
  const exists = current.some((r) => r.matchId === record.matchId);
  if (exists) return current;
  const updated = [record, ...current];
  saveLocalLeaderboard(updated);
  return updated;
}

// Get AI guess based on selected personality
export function getAIGuessByPersonality(
  personalityId: string,
  aiHistory: Guess[],
  userSecret: string
): string {
  if (personalityId === "sam") {
    // S.A.M. has a 35% chance to make a fully random guess (Easy)
    if (Math.random() < 0.35) {
      return generateRandomCode();
    }
  }
  
  // D.A.V.I.D. and HAL-9000 (and S.A.M.'s other turns) use the smart algorithm
  return getSmartAIGuess(aiHistory, userSecret);
}

// Merge two leaderboards and return the unified unique de-duplicated list
export function mergeLeaderboards(
  local: LeaderboardRecord[],
  remote: LeaderboardRecord[]
): LeaderboardRecord[] {
  const mergedMap = new Map<string, LeaderboardRecord>();
  
  // Put local ones first
  local.forEach((r) => mergedMap.set(r.matchId, r));
  
  // Put remote ones (remote will overwrite if matchId exists, or we can keep the one with a winner or higher turns)
  remote.forEach((r) => {
    const existing = mergedMap.get(r.matchId);
    if (!existing) {
      mergedMap.set(r.matchId, r);
    } else {
      // If remote has a winner or is newer, keep it
      if (!existing.winnerId && r.winnerId) {
        mergedMap.set(r.matchId, r);
      } else if (r.timestamp > existing.timestamp) {
        mergedMap.set(r.matchId, r);
      }
    }
  });

  const mergedList = Array.from(mergedMap.values());
  // Sort descending by timestamp
  mergedList.sort((a, b) => b.timestamp - a.timestamp);
  return mergedList;
}

// Get P2P blacklisted/deleted player IDs
export function getDeletedPlayerIds(): string[] {
  try {
    const raw = localStorage.getItem("doi_deleted_player_ids");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as string[];
  } catch (e) {
    console.error("Failed to parse deleted player IDs:", e);
    return [];
  }
}

// Save P2P blacklisted/deleted player IDs
export function saveDeletedPlayerIds(ids: string[]): void {
  try {
    localStorage.setItem("doi_deleted_player_ids", JSON.stringify(ids));
  } catch (e) {
    console.error("Failed to save deleted player IDs:", e);
  }
}

// Save specific deleted player ID
export function addDeletedPlayerId(id: string): string[] {
  const current = getDeletedPlayerIds();
  if (current.includes(id)) return current;
  const updated = [...current, id];
  saveDeletedPlayerIds(updated);
  return updated;
}


