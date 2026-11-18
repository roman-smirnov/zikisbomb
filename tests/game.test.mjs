import test from 'node:test';
import assert from 'node:assert/strict';
import { complete, editable, formatTime, GameController, remaining } from '../src/game.ts';
import { puzzles } from '../src/puzzles.ts';

function round(id = 'R2') {
  let now = 0;
  const game = new GameController(() => now);
  const puzzle = puzzles.find(item => item.id === id);
  game.apply({ type: 'start', puzzle });
  return {
    game,
    at: value => { now = value; },
    enter: value => game.apply({ type: 'edit', value }),
    submit: () => game.apply({ type: 'submit' }),
    remaining: () => remaining(game.state, now),
  };
}

test('starts immediately at a full 01:00, independent of sampling', () => {
  const run = round();
  assert.equal(run.game.state.phase, 'playing');
  assert.equal(formatTime(run.remaining()), '01:00');
  run.at(1_001);
  assert.equal(formatTime(run.remaining()), '00:59');
});

test('expiry wins at the exact deadline even for a correct answer', () => {
  const run = round();
  run.enter('4.7');
  run.at(60_000);
  const result = run.submit();
  assert.equal(result.phase, 'expired');
  assert.equal(result.frozenRemaining, 0);
  assert.equal(result.revealed, false);
});

test('correct decimal with comma and trailing zero freezes remaining time', () => {
  const run = round();
  run.enter('4,70');
  assert.equal(run.game.state.answer, '4.70');
  run.at(51_047);
  assert.equal(run.submit().phase, 'success');
  run.at(73_000);
  assert.equal(run.remaining(), 8_953);
  assert.equal(run.game.state.revealed, false);
  assert.equal(run.game.apply({ type: 'reveal' }).revealed, true);
});

test('rejects a wrong answer once, clears it, and releases the retry gate', () => {
  const run = round('X2');
  run.enter('3');
  run.at(1_000);
  assert.equal(run.submit().phase, 'retry');
  assert.equal(run.game.state.answer, '');
  assert.equal(run.remaining(), 49_000);
  run.enter('-3');
  assert.equal(run.game.state.answer, '');
  run.submit();
  assert.equal(run.remaining(), 49_000);
  run.at(1_800);
  run.enter('-3');
  assert.equal(run.submit().phase, 'success');
});

test('a fatal penalty reveals expiry immediately', () => {
  const run = round();
  run.at(52_000);
  run.enter('14');
  assert.equal(run.submit().phase, 'expired');
  assert.equal(run.remaining(), 0);
});

test('pause holds the remaining time and retry gate until resume', () => {
  const run = round();
  run.enter('14');
  run.at(1_000);
  run.submit();
  run.at(1_200);
  run.game.apply({ type: 'pause' });
  run.at(80_000);
  run.game.apply({ type: 'sample' });
  assert.equal(run.remaining(), 48_800);
  assert.equal(run.game.state.phase, 'retry');
  run.game.apply({ type: 'resume' });
  run.at(80_599);
  assert.equal(run.game.apply({ type: 'sample' }).phase, 'retry');
  run.at(80_600);
  assert.equal(run.game.apply({ type: 'sample' }).phase, 'playing');
  assert.equal(run.remaining(), 48_200);
});

test('incomplete input has no time penalty and invalid whole strings cannot edit', () => {
  const run = round();
  for (const value of ['', '-', '.', '-.']) {
    assert.ok(editable(value));
    assert.ok(!complete(value));
    run.enter(value);
    assert.ok(run.submit().incomplete);
    assert.equal(run.remaining(), 60_000);
  }
  run.enter('-.25');
  assert.equal(run.game.state.answer, '-.25');
  for (const value of ['1e2', '4 7', '4.7.0', '+4', '1234567', '4.70 #']) {
    run.enter(value);
    assert.equal(run.game.state.answer, '-.25');
  }
  assert.ok(complete('123456.'));
});

test('start and end clear stale state while reveal works only after the round', () => {
  const run = round();
  assert.equal(run.game.apply({ type: 'reveal' }).revealed, false);
  run.enter('4.7');
  run.submit();
  run.game.apply({ type: 'reveal' });
  const next = run.game.start('Min');
  assert.equal(next.puzzle.topic, 'Min');
  assert.equal(next.revealed, false);
  assert.equal(next.answer, '');
  assert.equal(run.game.apply({ type: 'end' }).puzzle, undefined);
  assert.equal(run.game.state.phase, 'ready');
});
