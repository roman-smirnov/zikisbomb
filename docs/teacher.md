# Classroom quick start

Open the title screen before introducing the activity. Tell the story aloud, then press **Start game**. The original arming cue plays before the timed question. The class has 60 seconds to evaluate three Math calls and predict the output. The first line assigns the result to a variable. The second line prints it.

Enter a number using the keyboard or numpad and submit with **Enter**. Use a decimal point for fractional values. For example, `4.7` and `4.70` are equivalent. A wrong number costs ten seconds. An incomplete entry leaves the timer to run normally.

Use **Pause** or **Shift P** for discussion. Opening **Teacher controls** also pauses the round. Close the panel and use **Resume game** to continue. Use **Show answer** after a failed round to reveal the two statements, printed value, and worked explanation. **Restart game** draws a different question.

The pool covers `Abs`, `Round`, `Min`, `Max`, `Pow`, and `Sqrt`. In a rounding discussion, use `Math.Round(2.5)` → 2 and `Math.Round(3.5)` → 4 to demonstrate midpoint-to-even. The timed questions use non-midpoint rounding examples.

The bank includes eight arithmetic-first puzzles, five with a `Math` method applied to a calculation, and three that nest all the calls. In the arithmetic rounds, ask students to substitute the values returned by the calls, then apply operator precedence. Compare the integer-division round, where 7 ÷ 2 gives 3, with the round where `Math.Sqrt(9) / Math.Abs(2)` gives 1.5 because `Math.Sqrt` returns a `double`.
