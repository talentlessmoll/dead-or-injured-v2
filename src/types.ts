export interface Player {
  id: string;
  name: string;
  secretCode: string | null; // 4-digit unique digit string
}

export interface Guess {
  playerId: string;
  code: string; // 4-digit guess
  dead: number;
  injured: number;
  timestamp: number;
}

export type GameStatus = 'waiting' | 'setup' | 'playing' | 'ended';

export interface GameRoom {
  roomId: string;
  players: Player[];
  guesses: Guess[];
  status: GameStatus;
  turn: string | null; // Player ID of whose turn it is
  winnerId: string | null;
  updatedAt: number;
  isTimed?: boolean;
  timerDuration?: number; // in seconds
  missedTurnsCount?: Record<string, number>;
}

export interface ScratchpadState {
  eliminated: boolean[]; // index 0-9 corresponding to digits '0'-'9'
  confirmed: boolean[];  // index 0-9 corresponding to digits '0'-'9'
  maybe: boolean[];      // index 0-9 corresponding to digits '0'-'9'
  notes: string;         // text notes
  matrix?: ("neutral" | "yes" | "no")[][];
}

export interface SinglePlayerState {
  playerCode: string | null;
  aiCode: string | null;
  guesses: Guess[];
  status: GameStatus;
  turn: 'player' | 'ai' | null;
  winner: 'player' | 'ai' | null;
  aiGuesses: Guess[]; // CPU's guesses against player
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface LeaderboardRecord {
  matchId: string;
  gameMode: "online" | "single" | "local" | "wifi";
  player1Name: string;
  player1Id: string;
  player2Name: string;
  player2Id: string;
  winnerName: string | null;
  winnerId: string | null;
  turnsUsed: number;
  timestamp: number;
}


