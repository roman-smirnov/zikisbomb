export const topics = ['Mixed', 'Abs', 'Round', 'Min', 'Max', 'Pow', 'Sqrt'] as const;
export type Topic = (typeof topics)[number];

export type Puzzle = Readonly<{
  id: string;
  topic: Topic;
  code: string;
  expected: number;
  displayAnswer: string;
  explanation: string;
}>;

const puzzle = (
  id: string,
  topic: Topic,
  resultType: 'int' | 'double',
  expression: string,
  displayAnswer: string,
  explanation: string,
): Puzzle => ({
  id,
  topic,
  code: `${resultType} result = ${expression};\nConsole.WriteLine(result);`,
  expected: Number(displayAnswer),
  displayAnswer,
  explanation,
});

export const puzzles: readonly Puzzle[] = Object.freeze([
  // Arithmetic between independent calls.
  puzzle('A2', 'Abs', 'int', 'Math.Abs(-8) - Math.Max(1, 3) + Math.Min(1, 2)', '6',
    'The three calls give 8, 3, and 1. Subtraction and addition have equal precedence, so work left to right. 8 − 3 + 1 is 6.'),
  puzzle('A1', 'Abs', 'int', 'Math.Abs(-4) + Math.Min(2, 3) * Math.Max(1, 2)', '8',
    'The three calls give 4, 2, and 2. Multiply before adding, so 4 + 2 × 2 is 8.'),
  puzzle('N1', 'Min', 'double', 'Math.Sqrt(9) - Math.Min(2, 3) * Math.Abs(3)', '-3',
    'The three calls give 3, 2, and 3. Multiply 2 × 3 first, then subtract 6 from 3.'),
  puzzle('X1', 'Max', 'double', 'Math.Sqrt(9) * Math.Max(1, 4) - Math.Abs(2)', '10',
    'The square root is 3, the larger value is 4, and the absolute value is 2. The calculation is 3 × 4 − 2.'),
  puzzle('P1', 'Pow', 'double', 'Math.Pow(2, 3) + Math.Abs(4) - Math.Sqrt(9)', '9',
    'The calls give 8, 4, and 3. Add 8 and 4, then subtract 3.'),
  puzzle('S1', 'Sqrt', 'double', 'Math.Sqrt(9) / Math.Abs(2) + Math.Round(1.2)', '2.5',
    'The square root returns a double with value 3, so dividing by 2 gives 1.5. Math.Round(1.2) adds 1.'),
  puzzle('N2', 'Min', 'int', 'Math.Abs(-7) / Math.Min(2, 3) + Math.Max(1, 2)', '5',
    'The three calls return the integers 7, 2, and 2. Integer division makes 7 ÷ 2 equal to 3. Then add 2.'),
  puzzle('M1', 'Mixed', 'int', '(Math.Min(2, 5) + Math.Abs(1)) * Math.Max(2, 4)', '12',
    'The sum in parentheses is 2 + 1, which is 3. The last call gives 4, so the result is 3 × 4.'),

  // An outer method receives an arithmetic result.
  puzzle('R1', 'Round', 'double', 'Math.Round(Math.Sqrt(5) + Math.Abs(-1))', '3',
    'The square root of 5 is about 2.24 and the absolute value is 1. Their sum rounds to 3.'),
  puzzle('X2', 'Max', 'int', 'Math.Max(Math.Abs(-2) - Math.Min(4, 5), -3)', '-2',
    'The first argument is 2 − 4, which is −2. Math.Max chooses −2 because it is greater than −3.'),
  puzzle('P2', 'Pow', 'double', 'Math.Pow(Math.Sqrt(16), Math.Min(1, 3) - 2)', '0.25',
    'The square root supplies the base 4. The exponent is 1 − 2, which is −1. Raising 4 to −1 gives 1 ÷ 4.'),
  puzzle('S2', 'Sqrt', 'double', 'Math.Sqrt(Math.Pow(3, 2) + Math.Abs(-7))', '4',
    '3 squared is 9 and the absolute value of −7 is 7. Add them to get 16, then take its square root.'),
  puzzle('M2', 'Mixed', 'double', 'Math.Min(Math.Sqrt(9) + Math.Abs(-1), 1.5)', '1.5',
    'The two inner calls give 3 and 1, so the first argument is 4. Math.Min chooses 1.5.'),

  // Three calls nested from the inside out.
  puzzle('R2', 'Round', 'double', 'Math.Round(Math.Sqrt(Math.Abs(-8)), 1)', '2.8',
    'The absolute value of −8 is 8. Its square root is about 2.828. Rounded to one decimal place, it is 2.8.'),
  puzzle('M3', 'Mixed', 'int', 'Math.Abs(Math.Min(-7, Math.Max(2, 9)))', '7',
    'Math.Max(2, 9) gives 9. Math.Min(-7, 9) gives −7. The absolute value is 7.'),
  puzzle('M4', 'Mixed', 'double', 'Math.Sqrt(Math.Max(25, Math.Pow(6, 2)))', '6',
    '6 squared is 36. Math.Max chooses 36 over 25. The square root of 36 is 6.'),
].map(item => Object.freeze(item)));

export function choosePuzzle(previous?: Puzzle, random: () => number = Math.random): Puzzle {
  const choices = puzzles.filter(puzzle => puzzle !== previous);
  return choices[Math.floor(random() * choices.length)]!;
}
