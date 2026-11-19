import { choosePuzzle, puzzles, type Puzzle } from './puzzles.ts';

export type Phase = 'ready' | 'intro' | 'playing' | 'incorrectFeedback' | 'success' | 'failureTransition' | 'missionFailed' | 'educationalReveal';
export type Config = Readonly<{duration:number;penalty:number;intro:number;feedback:number;failure:number}>;
export const defaults: Config = Object.freeze({ duration: 60_000, penalty: 10_000, intro: 2_000, feedback: 800, failure: 4_000 });
export function validateConfig(config: Config): Config {
  for (const key of ['duration','penalty','intro','feedback','failure'] as const) if (!Number.isFinite(config[key]) || config[key] < 0) throw new Error(`Invalid ${key}`);
  if (config.duration < 1000 || config.duration > 600000 || config.penalty > 600000 || config.failure !== 4000) throw new Error('Invalid round configuration');
  return Object.freeze({...config});
}
export type State = { runId: number; eventId: number; phase: Phase; puzzle: Puzzle; entered: number; deadline: number | null; answer: string; paused: boolean; pauseReason: string; frozenRemaining: number; playingAt: number };
export type Action = { type: 'sample' | 'title' | 'pause' | 'resume' | 'submit' | 'reveal' } | { type: 'start'; puzzle?: Puzzle } | { type: 'edit'; value: string };
export type Effect = { type: 'reset' | 'key' | 'denied' | 'success' | 'failure' | 'pause' | 'resume'; key?: string; runId: number; eventId: number };
export const initial = (runId = 0, puzzle = puzzles[0]!): State => ({ runId, eventId: 0, phase: 'ready', puzzle, entered: 0, deadline: null, answer: '', paused: false, pauseReason: '', frozenRemaining: defaults.duration, playingAt: 0 });
export const editable = (text: string) => /^-?\d*(?:\.\d*)?$/.test(text) && text.replace(/[-.]/g,'').length <= 6;
export const complete = (text: string) => editable(text) && /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text);
export const activePhase = (phase: Phase) => ['intro','playing','incorrectFeedback','failureTransition'].includes(phase);
export function remaining(s: State, now: number, config = defaults): number {
  if (s.phase === 'success') return s.frozenRemaining;
  if (['failureTransition','missionFailed','educationalReveal'].includes(s.phase)) return 0;
  return s.deadline === null ? config.duration : Math.max(0, s.deadline - now);
}
export function formatTime(ms: number) { const secs = Math.ceil(ms / 1000); return `${Math.floor(secs / 60).toString().padStart(2,'0')}:${(secs % 60).toString().padStart(2,'0')}`; }
/** Pure atomic transitions. Input samples expiry first; an exact-deadline answer loses. */
export function transition(previous: State, action: Action, now: number, config = defaults): { state: State; effects: Effect[] } {
  let s = { ...previous }; const effects: Effect[] = [];
  const emit = (type: Effect['type'], key?: string) => { s.eventId++; effects.push({type,key,runId:s.runId,eventId:s.eventId}); };
  const enter = (phase: Phase) => { s.phase = phase; s.entered = now; };
  const fail = (penalty=false) => { enter('failureTransition'); s.answer = ''; emit('failure',penalty?'penalty':undefined); };
  if (action.type === 'start' || action.type === 'title') {
    s = initial(s.runId + 1, action.type === 'start' ? action.puzzle ?? s.puzzle : s.puzzle); s.entered = now;
    if (action.type === 'start') s.phase = 'intro';
    emit('reset'); return {state:s,effects};
  }
  if (s.paused) {
    if (action.type === 'resume') { s.paused = false; emit('resume'); }
    return {state:s,effects};
  }
  // Intro entry uses the actual processing time: loading/stalls cannot consume the full countdown.
  if (s.phase === 'intro' && now - s.entered >= config.intro) { enter('playing'); s.playingAt = now; s.deadline = now + config.duration; }
  if (['playing','incorrectFeedback'].includes(s.phase) && remaining(s,now,config) <= 0) fail();
  if (s.phase === 'incorrectFeedback' && now - s.entered >= config.feedback) enter('playing');
  if (s.phase === 'failureTransition' && now - s.entered >= config.failure) enter('missionFailed');
  if (action.type === 'pause' && activePhase(s.phase)) { s.paused = true; emit('pause'); }
  if (action.type === 'edit' && s.phase === 'playing' && editable(action.value)) { s.answer = action.value; emit('key', action.value.length < previous.answer.length ? 'Backspace' : action.value.slice(-1)); }
  if (action.type === 'submit' && s.phase === 'playing' && complete(s.answer)) {
    emit('key','Enter');
    if (Number(s.answer) === s.puzzle.expected) { s.frozenRemaining = remaining(s,now,config); enter('success'); emit('success'); }
    else { s.answer = ''; s.deadline! -= config.penalty; if (remaining(s,now,config) <= 0) fail(true); else { enter('incorrectFeedback'); emit('denied'); } }
  }
  if (action.type === 'reveal' && s.phase === 'missionFailed') enter('educationalReveal');
  return {state:s,effects};
}
export class GameController {
  state = initial(); private origin: number; private pausedAt: number | null = null; private pausedTotal = 0;
  onEffects: (effects: Effect[]) => void = () => {};
  private clock: () => number; readonly config: Config;
  private lastPuzzle?: Puzzle;
  private random: () => number;
  constructor(clock: () => number = () => performance.now(), config = defaults, random: () => number = Math.random) { this.clock = clock; this.config = validateConfig(config); this.random = random; this.origin = clock(); }
  time() { return (this.pausedAt ?? this.clock()) - this.origin - this.pausedTotal; }
  dispatch(action: Action, reason = '') {
    if (action.type === 'start') { this.lastPuzzle = choosePuzzle(this.lastPuzzle, this.random); action = {type:'start',puzzle:this.lastPuzzle}; }
    if (action.type === 'start' || action.type === 'title') { this.origin = this.clock(); this.pausedTotal = 0; this.pausedAt = null; }
    const now = this.time(); const wasPaused = this.state.paused;
    const result = transition(this.state,action,now,this.config); this.state = result.state;
    if (!wasPaused && this.state.paused) { this.pausedAt = this.clock(); this.state.pauseReason = reason; }
    if (wasPaused && !this.state.paused && this.pausedAt !== null) { this.pausedTotal += this.clock() - this.pausedAt; this.pausedAt = null; }
    if (result.effects.length) this.onEffects(result.effects); return this.state;
  }
  sample() { return this.dispatch({type:'sample'}); }
  get remaining() { return remaining(this.state,this.time(),this.config); }
}
export function keyEdit(answer: string, key: string, repeat = false): string | null {
  if (key === 'Backspace') return answer.slice(0,-1);
  if (repeat) return null;
  const next = key === '-' && !answer ? '-' : key === '.' && !answer.includes('.') ? answer + '.' : /^\d$/.test(key) ? answer + key : null;
  return next !== null && editable(next) ? next : null;
}
export function failureVisual(elapsed: number) {
  const t = Math.max(0,Math.min(1,(elapsed-400)/2200));
  return { black: t*t*(3-2*t), title: Math.max(0,Math.min(1,(elapsed-3300)/700)), silent: elapsed >= 2800 };
}
