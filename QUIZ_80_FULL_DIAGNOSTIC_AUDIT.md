# SIMS Quiz Challenge — Full 80-Question Diagnostic Audit

## Audit standard
Every item was checked for grammar, arithmetic, units, operation order, answer uniqueness, Philippine-context appropriateness, difficulty, and distractor quality. Each question now stores four explicit teacher-authored choices and feedback; the app no longer generates answer choices from the correct answer at runtime.

## Difficulty progression
- Easy (20): one-step subtraction and straightforward quantity remaining/change situations.
- Average (20): signed integers, changes across zero/reference levels, and interpretation of final minus initial.
- Difficult (20): 3–4 step integer operations and mixed gains/losses.
- Advanced (20): percentages, fractions, equal sharing, multi-step budgeting, and signed reasoning.

## Diagnostic distractor design
Wrong choices are tied to common errors such as reversing subtraction order, ignoring the sign of a change, treating every change as an addition, stopping before the final operation, using an incorrect percentage, or dividing by the wrong group count. Feedback states the verified result and the misconception represented by the selected distractor.

## Implementation
- `quizBank` contains explicit `options`, `correct`, and `hint` fields for all 80 items.
- Answer choices are shuffled only after the teacher-authored choices are loaded.
- Feedback is specific to the selected option rather than only showing the correct calculation.
- Correct answer values are checked against the stored correct choice.
- Quiz remains offline-ready.