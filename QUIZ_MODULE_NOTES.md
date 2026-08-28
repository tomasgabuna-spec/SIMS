# SIMS Quiz Challenge Module

## Included
- 80 offline-ready multiple-choice questions.
- 20 questions each for Easy, Average, Difficult, and Advanced.
- 10 randomly selected questions per quiz round.
- Four answer choices per question.
- Immediate feedback and score.
- Results saved locally in `localStorage`.
- Philippine-context scenarios: school canteens, jeepneys, barangay projects, Baguio temperatures, rice, school funds, relief packs, etc.

## Question-quality checks
- Word problems explicitly identify starting values, changes, and the quantity requested.
- Signed quantities are used consistently for temperatures, elevations, balances, and displacement.
- Multi-step items preserve the order of operations described in the scenario.
- Percentage and fraction items were recalculated from the displayed quantities.
- Advanced distractors are generated as numerical near-misses while keeping exactly one keyed value.
- Grammar was reviewed for concise classroom English and natural Philippine-context wording.

## Offline behavior
The quiz is part of the existing app shell and is cached by the service worker. The cache version was incremented to `sims-cache-v2` so browsers can receive the updated quiz module.
