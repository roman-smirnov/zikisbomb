import test from 'node:test';
import assert from 'node:assert/strict';
import { complete } from '../src/game.ts';
import { PuzzleDecks, puzzles, topics } from '../src/puzzles.ts';

test('the classroom bank has 16 unique questions with enterable answers and explanations', () => {
  assert.equal(puzzles.length, 16);
  assert.equal(new Set(puzzles.map(item => item.id)).size, 16);
  assert.equal(new Set(puzzles.map(item => item.expression)).size, 16);
  for (const puzzle of puzzles) {
    assert.ok(complete(puzzle.displayAnswer));
    assert.equal(puzzle.expected, Number(puzzle.displayAnswer));
    assert.ok(puzzle.explanation.length);
  }
});

test('each deck visits every eligible question before repeating', () => {
  const decks = new PuzzleDecks(() => .43);
  for (const topic of topics) {
    const expected = topic === 'Mixed' ? puzzles : puzzles.filter(item => item.topic === topic);
    assert.equal(expected.length, topic === 'Mixed' ? 16 : 2);
    const round = expected.map(() => decks.draw(topic));
    assert.deepEqual(new Set(round), new Set(expected));
    assert.notEqual(decks.draw(topic), round.at(-1));
  }
});

test('a deck keeps its place and avoids a boundary repeat across topic changes', () => {
  const decks = new PuzzleDecks(() => .999);
  const first = decks.draw('Abs');
  decks.draw('Pow');
  const second = decks.draw('Abs');
  assert.notEqual(first, second);
  decks.draw('Round');
  assert.equal(decks.draw('Abs'), first);
});
