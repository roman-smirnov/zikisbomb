import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './style.css';
import { GardenAudio } from './audio.ts';
import { active, duration, editable, finished, formatTime, GameController, normalize, remaining } from './game.ts';
import { topics, type Topic } from './puzzles.ts';
import type { GardenScene } from './scene.ts';

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

const topic = element<HTMLSelectElement>('topic');
for (const name of topics) topic.add(new Option(name === 'Mixed' ? name : `Math.${name}`, name));
const input = element<HTMLInputElement>('answer');
const form = element<HTMLFormElement>('answer-form');
const teacher = element<HTMLDialogElement>('teacher-dialog');
const pauseButton = element<HTMLButtonElement>('pause');
const submit = element<HTMLButtonElement>('submit');
const reveal = element<HTMLButtonElement>('reveal');
const resume = element<HTMLButtonElement>('resume');
const keys = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-key]'));
const world = element('world');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const game = new GameController();
const audio = new GardenAudio();
const soundStorageKey = 'zikisbomb:sound';
let garden: GardenScene | undefined;
let disposed = false;
let displayedPuzzle = '';
let shownPhase = game.state.phase;
let shownPause = false;
let shownReveal = false;
let shownIncomplete = false;
let shownTime = '';

try {
  audio.enabled = localStorage.getItem(soundStorageKey) === 'on';
} catch {
  // The browser may block storage in private or embedded sessions.
}

function announce(message: string) {
  element('announcement').textContent = message;
}

function focusAnswer() {
  if (!teacher.open && game.state.phase === 'playing' && game.state.pausedAt === undefined) {
    input.focus({ preventScroll: true });
  }
}

function showCode(expression: string) {
  const code = element('challenge');
  const source = `Console.WriteLine(${expression});`;
  const tokens = source.split(/([A-Za-z]+|\d+(?:\.\d+)?|[(,])/);
  code.replaceChildren(...tokens.filter(Boolean).flatMap(token => {
    if (token === '(' || token === ',') {
      return [document.createTextNode(token), document.createElement('wbr')];
    }
    if (!/^[A-Za-z0-9]/.test(token)) return [document.createTextNode(token)];
    const span = document.createElement('span');
    span.className = /^\d/.test(token) ? 'token-number' : 'token-call';
    span.textContent = token;
    return [span];
  }));
}

function render(now = game.clock()) {
  const state = game.state;
  const paused = state.pausedAt !== undefined;
  const live = active(state.phase);
  const done = finished(state.phase);
  const timeLeft = remaining(state, now);
  const time = formatTime(timeLeft);
  if (time !== shownTime) {
    element('time').textContent = time;
    shownTime = time;
  }
  const clock = element('clock');
  clock.dataset.state = paused ? 'paused' : done ? state.phase : timeLeft <= 10_000 ? 'low' : 'running';

  const puzzle = state.puzzle;
  if (puzzle && puzzle.id !== displayedPuzzle) {
    showCode(puzzle.expression);
    displayedPuzzle = puzzle.id;
  }
  element('ready').hidden = state.phase !== 'ready';
  element('teacher-end').hidden = state.phase === 'ready';
  element('round').hidden = state.phase === 'ready';
  clock.hidden = state.phase === 'ready';
  pauseButton.hidden = !live || paused;
  form.hidden = !live || paused;
  element('paused').hidden = !paused;
  if (input.value !== state.answer) input.value = state.answer;
  const locked = state.phase !== 'playing' || paused;
  input.disabled = submit.disabled = locked;
  for (const key of keys) key.disabled = locked;
  if (state.incomplete) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');

  const feedback = element('feedback');
  feedback.hidden = !state.incomplete && state.phase !== 'retry';
  feedback.textContent = state.phase === 'retry' ? 'Try again · −10 seconds' : state.incomplete ? 'Enter a number.' : '';

  const result = element('result');
  result.hidden = !done;
  result.dataset.outcome = state.phase;
  const resultTitle = element('result-title');
  if (state.phase !== shownPhase) {
    resultTitle.textContent = done ? (state.phase === 'success' ? 'Garden safe' : 'Time’s up') : '';
  }
  const solution = element('solution');
  solution.hidden = !state.revealed;
  reveal.hidden = state.revealed;
  if (state.revealed && !shownReveal && puzzle) {
    const answerLine = document.createElement('p');
    const value = document.createElement('output');
    value.textContent = puzzle.displayAnswer;
    answerLine.append('Printed value ', value);
    const explanation = document.createElement('p');
    explanation.textContent = puzzle.explanation;
    solution.replaceChildren(answerLine, explanation);
    solution.tabIndex = -1;
    solution.focus({ preventScroll: true });
  } else if (!state.revealed && shownReveal) {
    solution.replaceChildren();
  }

  if (state.phase !== shownPhase) {
    if (state.phase === 'playing') {
      if (shownPhase === 'ready' || finished(shownPhase)) audio.play('start');
      focusAnswer();
    }
    if (state.phase === 'retry') {
      audio.play('retry');
      announce('Try again. Ten seconds deducted.');
    }
    if (done) {
      audio.stop();
      audio.play(state.phase === 'success' ? 'success' : 'expired');
      resultTitle.focus({ preventScroll: true });
    }
  }
  if (paused && !shownPause) {
    if (!teacher.open) resume.focus({ preventScroll: true });
    announce('Round paused.');
  } else if (!paused && shownPause && live) {
    announce('Round resumed.');
    focusAnswer();
  }
  if (state.incomplete && !shownIncomplete) {
    announce('Enter a number.');
    focusAnswer();
  }

  garden?.update({ phase: state.phase, paused, time, low: live && timeLeft <= 10_000, reduced: motion.matches });
  shownPhase = state.phase;
  shownPause = paused;
  shownReveal = state.revealed;
  shownIncomplete = state.incomplete;
}

const tick = () => {
  const now = game.clock();
  const before = game.state;
  game.apply({ type: 'sample' }, now);
  if (before !== game.state || shownTime !== formatTime(remaining(game.state, now))) render(now);
};

function start() {
  audio.stop();
  audio.wake();
  const next = game.start(topic.value as Topic);
  render(next.deadline - duration);
  focusAnswer();
}

function end() {
  if (teacher.open) teacher.close();
  audio.stop();
  game.apply({ type: 'end' });
  announce('');
  render();
  element('start').focus({ preventScroll: true });
}

function edit(value: string, cursor?: number) {
  if (!editable(normalize(value))) {
    const oldLength = input.value.length;
    input.value = game.state.answer;
    const restored = Math.max(0, (cursor ?? oldLength) - (oldLength - input.value.length));
    input.setSelectionRange(restored, restored);
    return;
  }
  game.apply({ type: 'edit', value });
  render();
  if (cursor !== undefined && game.state.phase === 'playing') input.setSelectionRange(cursor, cursor);
}

function togglePause() {
  if (!active(game.state.phase)) return;
  audio.stop();
  if (game.state.pausedAt !== undefined) audio.wake();
  game.apply({ type: game.state.pausedAt === undefined ? 'pause' : 'resume' });
  render();
}

function toggleTeacher() {
  if (teacher.open) {
    teacher.close();
    return;
  }
  teacher.showModal();
  if (active(game.state.phase) && game.state.pausedAt === undefined) togglePause();
}

function syncSound() {
  element('sound-label').textContent = audio.enabled ? 'Sound on' : 'Sound off';
  element('sound').setAttribute('aria-pressed', String(audio.enabled));
}

function toggleSound() {
  audio.enabled = !audio.enabled;
  if (audio.enabled) audio.wake();
  else audio.stop();
  try {
    localStorage.setItem(soundStorageKey, audio.enabled ? 'on' : 'off');
  } catch {
    // The current tab still retains the setting.
  }
  syncSound();
  if (matchMedia('(pointer: fine)').matches) focusAnswer();
}

async function fullscreen() {
  const notice = element('notice');
  notice.hidden = true;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    notice.textContent = 'Fullscreen is unavailable in this browser.';
    notice.hidden = false;
    announce(notice.textContent);
  }
  focusAnswer();
}

function showSolution() {
  game.apply({ type: 'reveal' });
  render();
}

element('start').onclick = start;
element('next').onclick = start;
element('end').onclick = element('teacher-end').onclick = end;
element('teacher').onclick = toggleTeacher;
pauseButton.onclick = resume.onclick = togglePause;
element('sound').onclick = toggleSound;
element('fullscreen').onclick = () => void fullscreen();
reveal.onclick = showSolution;
teacher.addEventListener('close', () => {
  if (game.state.pausedAt !== undefined) resume.focus({ preventScroll: true });
});
element<HTMLInputElement>('volume').oninput = event => { audio.volume = Number((event.target as HTMLInputElement).value); };
input.addEventListener('input', () => edit(input.value, input.selectionStart ?? undefined));
for (const key of keys) {
  key.addEventListener('pointerdown', event => event.preventDefault());
  key.onclick = () => {
    const at = input.selectionStart ?? input.value.length;
    const after = input.selectionEnd ?? at;
    edit(input.value.slice(0, at) + key.dataset.key + input.value.slice(after), at + 1);
  };
}
form.onsubmit = event => {
  event.preventDefault();
  if (game.state.phase !== 'playing' || game.state.pausedAt !== undefined) return;
  audio.wake();
  game.apply({ type: 'submit' });
  render();
};

document.addEventListener('fullscreenchange', () => {
  const label = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  element('fullscreen').setAttribute('aria-label', label);
  element('fullscreen').title = label;
  if (!document.fullscreenElement) focusAnswer();
});

document.addEventListener('keydown', event => {
  if (event.repeat || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || teacher.open) return;
  const target = event.target;
  const isControl = target instanceof HTMLElement && Boolean(target.closest('button, input, select, textarea, a, [contenteditable]'));
  if (event.key === 'Enter' && !isControl) {
    if (game.state.phase === 'ready') start();
    else if (game.state.pausedAt !== undefined) togglePause();
    return;
  }
  switch (event.code) {
    case 'KeyP': if (event.shiftKey) togglePause(); break;
    case 'KeyT': toggleTeacher(); break;
    case 'KeyF': void fullscreen(); break;
    case 'KeyM': toggleSound(); break;
    case 'KeyR':
      if (finished(game.state.phase)) {
        if (event.shiftKey) start();
        else showSolution();
      }
      break;
  }
});

const interval = window.setInterval(tick, 50);
document.addEventListener('visibilitychange', tick);
motion.addEventListener('change', () => render());
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true;
  clearInterval(interval);
  garden?.dispose();
  audio.dispose();
});
syncSound();
render();

void import('./scene.ts').then(async ({ GardenScene }) => {
  if (disposed) return;
  const scene = new GardenScene(element<HTMLCanvasElement>('scene'), element('scene-focus'), status => {
    world.dataset.graphics = status;
  });
  garden = scene;
  render();
  await scene.load();
}).catch(error => {
  garden?.dispose();
  garden = undefined;
  if (disposed) return;
  world.dataset.graphics = 'fallback';
  console.warn('Using the static garden view.', error);
});
