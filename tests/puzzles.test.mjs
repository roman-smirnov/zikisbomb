import {test} from 'node:test';
import assert from 'node:assert/strict';
import {puzzles, choosePuzzle} from '../src/puzzles.ts';
import {GameController, complete, defaults, initial, transition} from '../src/game.ts';

function deepestMathCall(line) {
  const parentheses = [];
  let depth = 0;
  for (const [token] of line.matchAll(/Math\.\w+\(|[()]/g)) {
    if (token === ')') {
      parentheses.pop();
      continue;
    }
    const isCall = token.startsWith('Math.');
    if (isCall) depth = Math.max(depth, parentheses.filter(Boolean).length);
    parentheses.push(isCall);
  }
  return depth;
}

test('the bank covers the six Garden Math methods with enterable answers', () => {
  assert.equal(puzzles.length, 16);
  assert.equal(new Set(puzzles.map(p => p.id)).size, puzzles.length);
  const methods = new Set(['Abs', 'Round', 'Min', 'Max', 'Pow', 'Sqrt']);
  for (const method of ['Abs', 'Round', 'Min', 'Max', 'Pow', 'Sqrt']) {
    assert.equal(puzzles.filter(p => p.topic === method).length, 2);
  }
  const byDepth = [0, 0, 0];
  for (const puzzle of puzzles) {
    const lines = puzzle.code.split('\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^(?:int|double) result = .+;$/);
    assert.equal(lines[1], 'Console.WriteLine(result);');
    const calls = Array.from(lines[0].matchAll(/Math\.(\w+)\(/g), match => match[1]);
    assert.equal(calls.length, 3);
    assert.equal(calls.every(method => methods.has(method)), true);
    assert.equal(new Set(calls).size, 3);
    const depth = deepestMathCall(lines[0]);
    byDepth[depth]++;
    if (depth < 2) assert.match(lines[0], / [-+*/] /);
    assert.ok(complete(puzzle.displayAnswer));
    assert.equal(puzzle.expected, Number(puzzle.displayAnswer));
    assert.ok(puzzle.explanation.length);
  }
  assert.deepEqual(byDepth, [8, 5, 3]);
  assert.equal(puzzles.filter(p => p.code.startsWith('int ') && p.code.includes(' / ')).length, 1);
});

test('every puzzle is reachable, and every previous puzzle is excluded', () => {
  assert.equal(new Set(puzzles.map(p => p.code)).size, puzzles.length);
  for (const previous of [undefined, ...puzzles]) {
    const choices = puzzles.filter(p => p !== previous);
    const selected = choices.map((_, i) => choosePuzzle(previous, () => (i + .5) / choices.length));
    assert.deepEqual(selected, choices);
    assert.ok(!selected.includes(previous));
  }
});

test('each selected puzzle owns answer checking through failure and reveal', () => {
  for (const puzzle of puzzles) {
    let {state} = transition(initial(), {type:'start', puzzle}, 0);
    ({state} = transition(state, {type:'sample'}, defaults.intro));
    if (puzzle.expected !== 6) {
      ({state} = transition(state, {type:'edit', value:'6'}, defaults.intro));
      ({state} = transition(state, {type:'submit'}, defaults.intro));
      assert.equal(state.phase, 'incorrectFeedback', puzzle.code);
      ({state} = transition(state, {type:'sample'}, defaults.intro + defaults.feedback));
    }
    const now = defaults.intro + defaults.feedback;
    const playing = state;
    ({state} = transition(state, {type:'edit', value:puzzle.displayAnswer.includes('.') ? `${puzzle.displayAnswer}0` : `${puzzle.displayAnswer}.0`}, now));
    ({state} = transition(state, {type:'submit'}, now));
    assert.equal(state.phase, 'success', puzzle.code);
    assert.equal(state.puzzle, puzzle);

    ({state} = transition(playing, {type:'sample'}, 100_000));
    ({state} = transition(state, {type:'sample'}, 100_000 + defaults.failure));
    ({state} = transition(state, {type:'reveal'}, 100_000 + defaults.failure));
    assert.equal(state.phase, 'educationalReveal');
    assert.equal(state.puzzle, puzzle);
  }
});

test('rematch and title/start choose a new puzzle, while pause and sampling keep it', () => {
  let now = 0;
  const game = new GameController(() => now, defaults, () => .999999);
  game.dispatch({type:'start'});
  const first = game.state.puzzle;
  now = defaults.intro; game.sample();
  game.dispatch({type:'pause'}); now += 10_000; game.sample();
  game.dispatch({type:'resume'});
  assert.equal(game.state.puzzle, first);
  game.dispatch({type:'start'});
  const second = game.state.puzzle;
  assert.notEqual(second, first);
  assert.equal(game.state.answer, '');
  game.dispatch({type:'title'});
  game.dispatch({type:'start'});
  assert.notEqual(game.state.puzzle, second);
});
