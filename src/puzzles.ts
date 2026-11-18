export const topics = ['Mixed', 'Abs', 'Round', 'Min', 'Max', 'Pow', 'Sqrt'] as const;
export type Topic = (typeof topics)[number];

export type Puzzle = Readonly<{
  id: string;
  topic: Topic;
  expression: string;
  expected: number;
  displayAnswer: string;
  explanation: string;
}>;

const puzzle = (id: string, topic: Topic, expression: string, displayAnswer: string, explanation: string): Puzzle =>
  ({ id, topic, expression, expected: Number(displayAnswer), displayAnswer, explanation });

export const puzzles: readonly Puzzle[] = [
  puzzle('A1', 'Abs', 'Math.Abs(-7)', '7', 'The westward offset is −7. Its magnitude is 7 tiles.'),
  puzzle('R1', 'Round', 'Math.Round(97.75562)', '98', 'The battery reading is closer to 98 than to 97.'),
  puzzle('N1', 'Min', 'Math.Min(8, 5)', '5', 'Of the two travel distances, 5 is shorter.'),
  puzzle('X1', 'Max', 'Math.Max(4, 7)', '7', 'The range must cover both routes, so it must cover 7 m.'),
  puzzle('P1', 'Pow', 'Math.Pow(4, 2)', '16', 'A square tray with 4 slots on each side holds 4 × 4 seeds.'),
  puzzle('S1', 'Sqrt', 'Math.Sqrt(49)', '7', 'A square tray of 49 slots has 7 on each side, since 7 × 7 = 49.'),
  puzzle('A2', 'Abs', 'Math.Abs(2 - 8)', '6', 'First calculate 2 − 8 = −6, then take its magnitude.'),
  puzzle('R2', 'Round', 'Math.Round(4.72, 1)', '4.7', 'The second argument requests one decimal place. The nearest tenth is 4.7.'),
  puzzle('N2', 'Min', 'Math.Min(6 + 3, 7)', '7', 'Add the two parts of the first route to get 9. The second route is shorter at 7.'),
  puzzle('X2', 'Max', 'Math.Max(-8, -3)', '-3', 'The higher of the two below-zero greenhouse readings is −3.'),
  puzzle('P2', 'Pow', 'Math.Pow(0.5, 2)', '0.25', 'A square half a meter on each side has area 0.5 × 0.5 = 0.25 square meters.'),
  puzzle('S2', 'Sqrt', 'Math.Sqrt(6.25)', '2.5', 'A square with area 6.25 square meters has side length 2.5 m, since 2.5 × 2.5 = 6.25.'),
  puzzle('M1', 'Mixed', 'Math.Abs(2 - 8) + Math.Abs(5 - 3)', '8', 'The two cardinal leg lengths are 6 and 2. Add them to get 8.'),
  puzzle('M2', 'Mixed', 'Math.Min(Math.Abs(2 - 8), Math.Abs(6 - 8))', '2', 'The two route lengths are 6 and 2. Pick the shorter one.'),
  puzzle('M3', 'Mixed', 'Math.Max(Math.Round(4.72), Math.Round(6.18))', '6', 'Round the two readings to 5 and 6. Pick the larger value.'),
  puzzle('M4', 'Mixed', 'Math.Sqrt(Math.Pow(5, 2))', '5', 'Squaring 5 gives 25. The square root of 25 gives the original side length.'),
];

export class PuzzleDecks {
  private decks = new Map<Topic, Puzzle[]>();
  private previous = new Map<Topic, Puzzle>();

  private readonly random: () => number;

  constructor(random = Math.random) {
    this.random = random;
  }

  draw(topic: Topic) {
    let deck = this.decks.get(topic);
    if (!deck?.length) {
      deck = puzzles.filter(item => topic === 'Mixed' || item.topic === topic);
      for (let index = deck.length - 1; index > 0; index--) {
        const swap = Math.floor(this.random() * (index + 1));
        [deck[index], deck[swap]] = [deck[swap], deck[index]];
      }
      this.decks.set(topic, deck);
    }
    // Preserve a topic’s boundary even if the teacher used a different deck in between.
    if (deck.length > 1 && deck.at(-1) === this.previous.get(topic)) {
      const last = deck.length - 1;
      [deck[0], deck[last]] = [deck[last], deck[0]];
    }
    const next = deck.pop()!;
    this.previous.set(topic, next);
    return next;
  }
}
