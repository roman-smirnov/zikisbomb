import { PuzzleDecks, type Puzzle, type Topic } from './puzzles.ts';

export const duration = 60_000;
export const penalty = 10_000;
const retryDelay = 800;

export type Outcome = 'success' | 'expired';
export type Phase = 'ready' | 'playing' | 'retry' | Outcome;
export type RoundState = Readonly<{
  phase: Phase;
  puzzle?: Puzzle;
  deadline: number;
  retryUntil: number;
  answer: string;
  incomplete: boolean;
  pausedAt?: number;
  frozenRemaining: number;
  revealed: boolean;
}>;

type Action =
  | { type: 'sample' | 'end' | 'submit' | 'pause' | 'resume' | 'reveal' }
  | { type: 'start'; puzzle: Puzzle }
  | { type: 'edit'; value: string };

const ready: RoundState = {
  phase: 'ready', deadline: 0, retryUntil: 0, answer: '', incomplete: false, frozenRemaining: duration, revealed: false,
};

export const active = (phase: Phase) => phase === 'playing' || phase === 'retry';
export const finished = (phase: Phase): phase is Outcome => phase === 'success' || phase === 'expired';
export const normalize = (text: string) => text.replace(',', '.');
export const editable = (text: string) => /^-?\d*(?:\.\d*)?$/.test(text) && text.replace(/[-.]/g, '').length <= 6;
export const complete = (text: string) => editable(text) && /\d/.test(text);

export function remaining(state: RoundState, now: number) {
  return active(state.phase) ? Math.max(0, state.deadline - (state.pausedAt ?? now)) : state.frozenRemaining;
}

export function formatTime(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return [Math.floor(seconds / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

export function transition(state: RoundState, action: Action, now: number): RoundState {
  if (action.type === 'start') return { ...ready, phase: 'playing', puzzle: action.puzzle, deadline: now + duration };
  if (action.type === 'end') return ready;
  if (state.pausedAt !== undefined) {
    if (action.type !== 'resume') return state;
    const elapsed = now - state.pausedAt;
    return { ...state, pausedAt: undefined, deadline: state.deadline + elapsed, retryUntil: state.retryUntil + elapsed };
  }
  if (!active(state.phase)) {
    return action.type === 'reveal' && finished(state.phase) && !state.revealed ? { ...state, revealed: true } : state;
  }

  const expire = (): RoundState => ({ ...state, phase: 'expired', answer: '', incomplete: false, frozenRemaining: 0 });
  const timeLeft = remaining(state, now);
  // Sample the deadline before processing any input, including a correct answer.
  if (timeLeft <= 0) return expire();
  if (state.phase === 'retry' && now >= state.retryUntil) state = { ...state, phase: 'playing' };
  if (action.type === 'pause') return { ...state, pausedAt: now };
  if (state.phase !== 'playing') return state;
  if (action.type === 'edit') {
    const answer = normalize(action.value);
    return editable(answer) ? { ...state, answer, incomplete: false } : state;
  }
  if (action.type !== 'submit') return state;
  if (!complete(state.answer)) return { ...state, incomplete: true };
  if (Number(state.answer) === state.puzzle!.expected) {
    return { ...state, phase: 'success', frozenRemaining: timeLeft };
  }
  if (timeLeft <= penalty) return expire();
  return { ...state, phase: 'retry', answer: '', deadline: state.deadline - penalty, retryUntil: now + retryDelay };
}

export class GameController {
  state = ready;
  private decks: PuzzleDecks;
  readonly clock: () => number;

  constructor(clock = () => performance.now(), random = Math.random) {
    this.clock = clock;
    this.decks = new PuzzleDecks(random);
  }

  apply(action: Action, now = this.clock()) {
    this.state = transition(this.state, action, now);
    return this.state;
  }

  start(topic: Topic) {
    return this.apply({ type: 'start', puzzle: this.decks.draw(topic) });
  }
}
