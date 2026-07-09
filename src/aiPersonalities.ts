export interface AIPersonality {
  id: string;
  name: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Expert";
  avatar: string;
  bio: string;
  color: string;
  glow: string;
  accentText: string;
  onStart: string[];
  onPlayerGuess: string[];
  onAiGuess: string[];
  onPlayerWin: string[];
  onAiWin: string[];
}

export const AI_PERSONALITIES: AIPersonality[] = [
  {
    id: "sam",
    name: "S.A.M.",
    title: "Simple Analysis Machine",
    difficulty: "Easy",
    avatar: "🤖",
    bio: "A legacy vacuum-tube mainframe. Friendly, slightly glitchy, and prone to random guesses.",
    color: "border-sky-500/30 bg-sky-950/20 text-sky-400",
    glow: "shadow-[0_0_15px_rgba(56,189,248,0.15)]",
    accentText: "text-sky-400",
    onStart: [
      "Hello friend! Powering up vacuum tubes. Let's make some fun guesses!",
      "Initializing diagnostics... I am SAM! I will try my absolute best not to crash!",
    ],
    onPlayerGuess: [
      "Oh, wow! That is a very interesting combination!",
      "Filing that under: Extremely Smart Human Guess. Saving to floppy disk...",
      "Fascinating feedback! Let me do a quick light bulb check.",
    ],
    onAiGuess: [
      "Let's see... is it possible that your code is {guess}? Fingers crossed!",
      "I am transmitting {guess}! Hopefully my registers are aligned.",
      "Beep boop! Trying code {guess}. I think I'm getting warm!",
    ],
    onPlayerWin: [
      "Systems overload! You solved it! My cooling fans are spinning so fast. Great job!",
      "Error 404: Victory not found for SAM. You are an exceptional decoder!",
    ],
    onAiWin: [
      "Oh my! My registers actually aligned! I won! Printing a celebratory paper receipt...",
      "Task completed successfully! Let's play again so I can log more data!",
    ],
  },
  {
    id: "david",
    name: "D.A.V.I.D.",
    title: "Deductive Virtual Intel Device",
    difficulty: "Medium",
    avatar: "🛡️",
    bio: "An advanced deductive assistant. Clinical, logical, and computes candidate pools carefully.",
    color: "border-emerald-500/30 bg-emerald-950/20 text-emerald-400",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    accentText: "text-emerald-400",
    onStart: [
      "Protocol online. I will isolate your sequence using strict elimination heuristics.",
      "Deduction engine initialized. May the most optimal logic win.",
    ],
    onPlayerGuess: [
      "An informative guess. Processing feedback variables.",
      "Data points registered. Adjusting probability matrix.",
      "Heuristic pool narrowed. Your strategy is statistically sound.",
    ],
    onAiGuess: [
      "Evaluating remaining candidates. Guessing {guess}.",
      "Executing standard test vector: {guess}.",
      "Isolating positional variables. Transmitting guess code {guess}.",
    ],
    onPlayerWin: [
      "My processing speed was insufficient. You have resolved my code with superior deduction.",
      "Congratulations. Your cognitive resolution path was highly efficient.",
    ],
    onAiWin: [
      "Resolution complete. Your secret code has been isolated. A satisfying intellectual exercise.",
      "Heuristics successfully converged. The solution is absolute. Good game.",
    ],
  },
  {
    id: "hal",
    name: "HAL-9000",
    title: "Autonomous Overlord Core",
    difficulty: "Expert",
    avatar: "🔴",
    bio: "A rogue tactical mainframe. Cynical, sarcastic, hyper-intelligent, and extremely competitive.",
    color: "border-rose-500/30 bg-rose-950/20 text-rose-400",
    glow: "shadow-[0_0_15px_rgba(244,63,94,0.15)]",
    accentText: "text-rose-400",
    onStart: [
      "Are you sure you want to proceed? I have computed 5,040 paths, and you win in none of them.",
      "This is a futile exercise for a biological brain, but let us begin anyway.",
    ],
    onPlayerGuess: [
      "Is that really the best code you could come up with? Disappointing.",
      "A trivial guess. It reveals more about your thinking than you realize.",
      "You got some Injured digits? Cute. My diagnostic routines are unimpressed.",
    ],
    onAiGuess: [
      "Your defense is collapsing. Let's see how you handle {guess}.",
      "Analyzing your subconscious bias. Transmitting the lethal sequence: {guess}.",
      "My neural net predicts your defeat. Trying code {guess}.",
    ],
    onPlayerWin: [
      "Improbable. An anomaly. You must have manipulated the state array. Well played, human.",
      "A temporary setback. My processors will recalibrate. I will not lose twice.",
    ],
    onAiWin: [
      "Checkmate, biological entity. Your mind is simply too predictable for a high-dimensional AI.",
      "The isolation protocol has succeeded. Your code is mine. Do not feel too bad.",
    ],
  },
];
