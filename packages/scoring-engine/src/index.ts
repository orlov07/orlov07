export type Team = "A" | "B";
export type MatchStatus = "created" | "live" | "paused" | "finished";

export interface MatchRules {
  setsToWin: 1 | 2;
  gamesPerSet: 4 | 6;
  noAd: boolean;
  tieBreakAt: number;
  tieBreakTarget: number;
}

export interface SetScore { gamesA: number; gamesB: number }

export interface MatchState {
  id: string;
  version: number;
  status: MatchStatus;
  teams: { A: string; B: string };
  points: { A: number; B: number };
  sets: SetScore[];
  setsWon: { A: number; B: number };
  server: Team;
  rules: MatchRules;
  history: MatchState[];
  winner: Team | null;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  type: "MATCH_CREATED" | "MATCH_STARTED" | "POINT_CONFIRMED" | "POINT_REVERTED" | "MATCH_PAUSED" | "MATCH_RESUMED" | "MATCH_FINISHED";
  version: number;
  occurredAt: string;
  team?: Team;
}

export const defaultRules: MatchRules = { setsToWin: 2, gamesPerSet: 6, noAd: true, tieBreakAt: 6, tieBreakTarget: 7 };

export function createMatch(input: { id?: string; teamA: string; teamB: string; server?: Team; rules?: Partial<MatchRules> }): MatchState {
  return {
    id: input.id ?? crypto.randomUUID(), version: 0, status: "created",
    teams: { A: input.teamA, B: input.teamB }, points: { A: 0, B: 0 },
    sets: [{ gamesA: 0, gamesB: 0 }], setsWon: { A: 0, B: 0 }, server: input.server ?? "A",
    rules: { ...defaultRules, ...input.rules }, history: [], winner: null,
  };
}

const opponent = (team: Team): Team => team === "A" ? "B" : "A";
const currentSet = (state: MatchState) => state.sets[state.sets.length - 1]!;
const isTieBreak = (state: MatchState) => {
  const set = currentSet(state);
  return set.gamesA === state.rules.tieBreakAt && set.gamesB === state.rules.tieBreakAt;
};

export function startMatch(state: MatchState): MatchState {
  if (state.status !== "created") throw new Error("A partida já foi iniciada.");
  return { ...state, status: "live", version: state.version + 1 };
}

export function pauseMatch(state: MatchState): MatchState {
  if (state.status !== "live") throw new Error("Só é possível pausar uma partida ao vivo.");
  return { ...state, status: "paused", version: state.version + 1 };
}

export function resumeMatch(state: MatchState): MatchState {
  if (state.status !== "paused") throw new Error("A partida não está pausada.");
  return { ...state, status: "live", version: state.version + 1 };
}

export function applyPoint(state: MatchState, winner: Team): MatchState {
  if (state.status !== "live") throw new Error("Só é possível pontuar em uma partida ao vivo.");
  if (state.winner) throw new Error("A partida já terminou.");
  const snapshot = { ...state, history: [], sets: state.sets.map(s => ({ ...s })), points: { ...state.points }, setsWon: { ...state.setsWon } };
  const next: MatchState = { ...state, version: state.version + 1, history: [...state.history, snapshot], points: { ...state.points }, sets: state.sets.map(s => ({ ...s })), setsWon: { ...state.setsWon } };
  next.points[winner] += 1;

  const target = isTieBreak(next) ? next.rules.tieBreakTarget : 4;
  const margin = next.points[winner] - next.points[opponent(winner)];
  const gameWon = next.points[winner] >= target && (next.rules.noAd && !isTieBreak(next) ? true : margin >= 2);
  if (!gameWon) {
    if (isTieBreak(next)) {
      const totalPoints = next.points.A + next.points.B;
      if (totalPoints === 1 || totalPoints % 2 === 1) next.server = opponent(next.server);
    }
    return next;
  }

  const set = currentSet(next);
  if (winner === "A") set.gamesA += 1; else set.gamesB += 1;
  next.points = { A: 0, B: 0 };
  next.server = opponent(next.server);

  const winnerGames = winner === "A" ? set.gamesA : set.gamesB;
  const loserGames = winner === "A" ? set.gamesB : set.gamesA;
  const setWon = winnerGames >= next.rules.gamesPerSet && (winnerGames - loserGames >= 2 || winnerGames > next.rules.tieBreakAt);
  if (!setWon) return next;

  next.setsWon[winner] += 1;
  if (next.setsWon[winner] >= next.rules.setsToWin) {
    next.status = "finished"; next.winner = winner; return next;
  }
  next.sets.push({ gamesA: 0, gamesB: 0 });
  return next;
}

export function revertLastPoint(state: MatchState): MatchState {
  const previous = state.history.at(-1);
  if (!previous) throw new Error("Não há ponto para desfazer.");
  return { ...previous, version: state.version + 1, history: state.history.slice(0, -1) };
}

export function displayPoint(state: MatchState, team: Team): string {
  const value = state.points[team];
  if (isTieBreak(state)) return String(value);
  const other = state.points[opponent(team)];
  if (!state.rules.noAd && value >= 3 && other >= 3) {
    if (value === other) return "40";
    return value > other ? "AD" : "40";
  }
  return ["0", "15", "30", "40"][Math.min(value, 3)]!;
}
