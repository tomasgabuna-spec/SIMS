let currentDifficulty = "beginner";
let minuend = 5;
let subtrahend = 3;
let selected = null;

// --- WORD PROBLEMS MODE ---
let isWordProblem = false;

// Fixed set of Philippine integer-subtraction word problems.
// Each entry's m (minuend) and s (subtrahend) match the intended
// answer: difference = m - s, plotted as coordinate (m, s) on the grid.
const wordProblems = [
  { text: "At a weather station in Baguio City, the temperature was 7°C in the afternoon and 3°C at night. What was the change in temperature from afternoon to night?", m: 3, s: 7 },
  { text: "A diver near Batangas was 2 m below sea level, then descended until the diver was 6 m below sea level. What was the change in elevation?", m: -6, s: -2 },
  { text: "Liza had ₱8 in her e-wallet, then paid ₱5 for a printing fee. What was her new balance?", m: 8, s: 5 },
  { text: "At dawn in Benguet, the temperature was -2°C. By noon, it was 5°C. How many degrees warmer was noon than dawn?", m: 5, s: -2 },
  { text: "An elevator in a Manila building started 3 floors below ground level and stopped 1 floor below ground level. What was the change in floor position?", m: -1, s: -3 },
  { text: "A hiker on Mount Apo was at an elevation 4 m above a reference point, then went down to 1 m above that point. What was the change in elevation?", m: 1, s: 4 },
  { text: "A sari-sari store recorded a ₱3 loss on Monday and a ₱2 gain on Tuesday. How much greater was Tuesday's result than Monday's?", m: 2, s: -3 },
  { text: "The temperature inside a cold-storage room in Davao was -6°C. It rose to -1°C. By how many degrees did it rise?", m: -1, s: -6 },
  { text: "A fisherman in Palawan marked sea level as 0. A sinker was 5 m below sea level and was pulled up until it was 2 m below sea level. What was the change in elevation?", m: -2, s: -5 },
  { text: "Carlo's jeepney fare card had ₱9. He spent ₱7. How much remained?", m: 9, s: 7 },
  { text: "At a science exhibit in Quezon City, a thermometer read 4°C, then read -3°C. What was the change in temperature?", m: -3, s: 4 },
  { text: "A point on a rice-terrace model is 6 m above a reference line. Another point is 2 m above the same line. How much lower is the second point?", m: 2, s: 6 },
  { text: "Mia's class-fund balance changed from -₱4 to -₱1 after she paid part of what she owed. What was the change in her balance?", m: -1, s: -4 },
  { text: "A submarine model was at 1 m below the waterline, then moved to 7 m below the waterline. What was its change in elevation?", m: -7, s: -1 },
  { text: "A delivery rider was 2 km east of the barangay hall and later was 5 km east of it. How much farther east was the rider?", m: 5, s: 2 },
  { text: "In Sagada, the morning temperature was -4°C. It increased by 7°C in the afternoon. What was the afternoon temperature, and what subtraction sentence verifies the increase?", m: 3, s: -4 },
  { text: "A diver in Cebu started 3 m below sea level and ended 8 m below sea level. The dive computer shows final elevation minus starting elevation. What value should it display?", m: -8, s: -3 },
  { text: "A student's canteen account was -₱3. After a parent added ₱8, what was the new balance?", m: 5, s: -3 },
  { text: "A tide marker in Iloilo showed 2 m above the reference level in the morning and 4 m below it in the evening. What was the change in level?", m: -4, s: 2 },
  { text: "A courier traveled 8 km north from a depot, then returned until only 3 km separated the courier from the depot. How much of the northward distance was reduced?", m: 8, s: 3 },
  { text: "A vendor's daily result was a ₱2 gain on Saturday and a ₱5 loss on Sunday. By how much did the result change from Saturday to Sunday?", m: -5, s: 2 },
];

let wordProblemQueue = [];

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getNextWordProblem() {
  if (wordProblemQueue.length === 0) {
    wordProblemQueue = shuffleArray(wordProblems);
  }
  return wordProblemQueue.pop();
}

// --- TIME TRIAL MODE ---
let isTimeTrial = false;
let timeTrialDuration = 60;   // seconds per round
let timeLeft = 0;
let timerInterval = null;
let timeTrialScore = 0;
let timeTrialSolved = 0;
let bestTimeTrialScore =
  Number(localStorage.getItem("simsTimeTrialBest")) || 0;

let score = Number(localStorage.getItem("simsScore")) || 0;
let correct = Number(localStorage.getItem("simsCorrect")) || 0;
let questions = Number(localStorage.getItem("simsQuestions")) || 0;
let streak = Number(localStorage.getItem("simsStreak")) || 0;
let bestStreak = Number(localStorage.getItem("simsBest")) || 0;

// --- ACHIEVEMENT TRACKING ---
let advancedCorrect = Number(localStorage.getItem("simsAdvancedCorrect")) || 0;
let negativeCorrect = Number(localStorage.getItem("simsNegativeCorrect")) || 0;

const range = 10;

function toggleMenu() {
  document.getElementById("sidebar").classList.toggle("open");
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
  });

  document.getElementById(id).classList.add("active");
  document.getElementById("sidebar").classList.remove("open");
}

function showHome() {
  showScreen("home");
}

function showLearn() {
  showScreen("learn");
}

function showTeacher() {
  showScreen("teacher");
}

function showProgress() {
  updateProgress();
  showScreen("progress");
}

function generateNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem() {
  if (isWordProblem) {
    const wp = getNextWordProblem();
    minuend = wp.m;
    subtrahend = wp.s;

    document.getElementById("problemLabel").textContent = "WORD PROBLEM";
    document.getElementById("problem").textContent = wp.text;
    document.getElementById("problem").classList.add("word-problem-text");
    document.getElementById("problemSubtext").textContent =
      "Figure out the two quantities, then select their coordinate on the SIMS grid.";
  } else {
    if (currentDifficulty === "beginner") {
      minuend = generateNumber(1, 9);
      subtrahend = generateNumber(1, minuend);
    }

    if (currentDifficulty === "intermediate") {
      minuend = generateNumber(-8, 8);
      subtrahend = generateNumber(-8, 8);
    }

    if (currentDifficulty === "advanced") {
      minuend = generateNumber(-10, 10);
      subtrahend = generateNumber(-10, 10);
    }

    document.getElementById("problemLabel").textContent = "PROBLEM";
    document.getElementById("problem").textContent =
      `${formatNumber(minuend)} − (${formatNumber(subtrahend)}) = ?`;
    document.getElementById("problem").classList.remove("word-problem-text");
    document.getElementById("problemSubtext").textContent =
      "Find the correct coordinate on the SIMS grid.";
  }

  selected = null;

  document.getElementById("selectedText").textContent =
    "Selected Coordinate: —";

  document.getElementById("submitBtn").disabled = true;

  document.getElementById("feedback").className = "feedback hidden";
  document.getElementById("explanation").classList.add("hidden");

  document.querySelectorAll("#explanation input[type=checkbox]")
    .forEach(cb => cb.checked = false);

  document.getElementById("reasonWarning").classList.add("hidden");
  document.getElementById("stepWarning").classList.add("hidden");

  document.querySelectorAll(".reason-flagged")
    .forEach(el => el.classList.remove("reason-flagged"));

  createGrid();
}

function formatNumber(n) {
  return n < 0 ? `−${Math.abs(n)}` : n;
}

function createGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  // Create the coordinate cells
  for (let y = range; y >= -range; y--) {
    for (let x = -range; x <= range; x++) {

      const cell = document.createElement("div");
      cell.className = "cell";

      // X-axis
      if (y === 0) {
        cell.classList.add("axis-x");
      }

      // Y-axis
      if (x === 0) {
        cell.classList.add("axis-y");
      }

      // Origin
      if (x === 0 && y === 0) {
        cell.classList.add("origin");
        cell.innerHTML = "<span>0</span>";
      }

      // X-axis numbers
      if (y === 0 && x !== 0) {
        cell.innerHTML = `<span class="axis-number">${x}</span>`;
      }

      // Y-axis numbers
      if (x === 0 && y !== 0) {
        cell.innerHTML = `<span class="axis-number">${y}</span>`;
      }

      // Difference label (x - y) shown in every non-axis cell
      if (x !== 0 && y !== 0) {
        cell.innerHTML = `<span class="diff-number">${x - y}</span>`;
      }

      cell.title = `Coordinate (${x}, ${y}) → Difference: ${x - y}`;

      cell.addEventListener("click", () => {
        document.querySelectorAll(".cell").forEach(c =>
          c.classList.remove("selected")
        );

        cell.classList.add("selected");

        selected = { x, y };

        document.getElementById("selectedText").textContent =
          `Selected Coordinate: (${formatNumber(x)}, ${formatNumber(y)})`;

        document.getElementById("submitBtn").disabled = false;
      });

      grid.appendChild(cell);
    }
  }

  // Add X-axis label (now positioned on the left, like the Y-axis was)
  const xLabel = document.createElement("div");
  xLabel.className = "axis-label y-label";
  xLabel.style.color = "var(--primary)";
  xLabel.innerHTML = "X-AXIS <span>(MINUEND)</span>";
  grid.appendChild(xLabel);

  // Add Y-axis label (now positioned at the bottom, like the X-axis was)
  const yLabel = document.createElement("div");
  yLabel.className = "axis-label x-label";
  yLabel.style.color = "var(--secondary)";
  yLabel.innerHTML = "Y-AXIS <span>(SUBTRAHEND)</span>";
  grid.appendChild(yLabel);

  // Add origin label
  const originLabel = document.createElement("div");
  originLabel.className = "origin-label";
  originLabel.textContent = "ORIGIN (0,0)";
  grid.appendChild(originLabel);
}


function startGame(level = "beginner") {
  isTimeTrial = false;
  isWordProblem = false;
  stopTimer();

  currentDifficulty = level;

  document.getElementById("levelBadge").textContent =
    level.toUpperCase();

  document.getElementById("timerStat").classList.add("hidden");
  document.getElementById("timeTrialResults").classList.add("hidden");

  showScreen("game");
  generateProblem();
}

function startWordProblems(level = "beginner") {
  isTimeTrial = false;
  isWordProblem = true;
  stopTimer();

  wordProblemQueue = [];

  currentDifficulty = level;

  document.getElementById("levelBadge").textContent = "WORD PROBLEM";

  document.getElementById("timerStat").classList.add("hidden");
  document.getElementById("timeTrialResults").classList.add("hidden");

  showScreen("game");
  generateProblem();
}

function startTimeTrial() {
  isTimeTrial = true;
  isWordProblem = false;
  currentDifficulty = "intermediate";
  timeTrialScore = 0;
  timeTrialSolved = 0;
  timeLeft = timeTrialDuration;

  document.getElementById("levelBadge").textContent = "TIME TRIAL";
  document.getElementById("timerStat").classList.remove("hidden");
  document.getElementById("timeTrialResults").classList.add("hidden");
  document.getElementById("timeLeft").textContent = timeLeft;

  showScreen("game");
  generateProblem();

  stopTimer();
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById("timeLeft").textContent = timeLeft;

    if (timeLeft <= 5) {
      document.getElementById("timerStat").classList.add("time-low");
    }

    if (timeLeft <= 0) {
      endTimeTrial();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  document.getElementById("timerStat").classList.remove("time-low");
}

function endTimeTrial() {
  stopTimer();
  isTimeTrial = false;

  if (timeTrialScore > bestTimeTrialScore) {
    bestTimeTrialScore = timeTrialScore;
    localStorage.setItem("simsTimeTrialBest", bestTimeTrialScore);
  }

  document.getElementById("feedback").className = "feedback hidden";
  document.getElementById("explanation").classList.add("hidden");
  document.getElementById("submitBtn").disabled = true;

  document.getElementById("ttSolved").textContent = timeTrialSolved;
  document.getElementById("ttScore").textContent = timeTrialScore;
  document.getElementById("ttBest").textContent = bestTimeTrialScore;

  document.getElementById("timeTrialResults").classList.remove("hidden");

  saveData();
  updateStats();
}

function submitAnswer() {
  if (!selected) return;

  questions++;

  const isCorrect =
    selected.x === minuend &&
    selected.y === subtrahend;

  const feedback = document.getElementById("feedback");

  if (isCorrect) {
    const difference = minuend - subtrahend;

    correct++;
    streak++;
    score += 10;

    if (streak > bestStreak) {
      bestStreak = streak;
    }

    // Track progress toward "Integer Master" (Advanced difficulty)
    if (currentDifficulty === "advanced") {
      advancedCorrect++;
    }

    // Track progress toward "Negative Number Expert"
    if (minuend < 0 || subtrahend < 0) {
      negativeCorrect++;
    }

    if (isTimeTrial) {
      timeTrialSolved++;
      timeTrialScore += 10 + streak; // speed/streak bonus in Time Trial
    }

    feedback.className = "feedback correct";
    feedback.innerHTML = isTimeTrial ? `
      <h2>✓ CORRECT! 🎉</h2>
      <p>${formatNumber(minuend)} − (${formatNumber(subtrahend)}) = ${difference}</p>
      <p>+${10 + streak} POINTS — Next problem incoming...</p>
    ` : `
      <h2>✓ CORRECT! 🎉</h2>
      <p>${formatNumber(minuend)} − (${formatNumber(subtrahend)}) = ${difference}</p>
      <p>+10 POINTS</p>
    `;

    if (isTimeTrial) {
      document.getElementById("submitBtn").disabled = true;
      setTimeout(() => {
        if (isTimeTrial) generateProblem();
      }, 700);
    } else {
      document.getElementById("explanation").classList.remove("hidden");
    }

  } else {
    streak = 0;

    feedback.className = "feedback wrong";
    feedback.innerHTML = isTimeTrial ? `
      <h2>NOT YET</h2>
      <p>Locate the minuend on X and the subtrahend on Y. Keep going!</p>
    ` : `
      <h2>NOT YET</h2>
      <p>Try again. Start by locating the minuend on the X-axis.</p>
      <button class="secondary" onclick="showHint()">💡 SHOW HINT</button>
    `;
  }

  saveData();
  updateStats();
}

function showHint() {
  const feedback = document.getElementById("feedback");

  feedback.className = "feedback";
  feedback.innerHTML = isWordProblem ? `
    💡 Hint: This scenario means
    <strong>${formatNumber(minuend)} − (${formatNumber(subtrahend)})</strong>.
    Find <strong>${formatNumber(minuend)}</strong> on the X-axis and
    <strong>${formatNumber(subtrahend)}</strong> on the Y-axis.
  ` : `
    💡 Hint: Find <strong>${formatNumber(minuend)}</strong>
    on the X-axis and
    <strong>${formatNumber(subtrahend)}</strong>
    on the Y-axis.
  `;
}

function getCorrectReasonId() {
  if (minuend >= 0 && subtrahend >= 0) return "reasonPP";
  if (minuend >= 0 && subtrahend < 0) return "reasonPN";
  if (minuend < 0 && subtrahend >= 0) return "reasonNP";
  return "reasonNN";
}

function nextQuestion() {
  const stepIds = ["stepMinuend", "stepSubtrahend", "stepIntersection"];
  const stepWarning = document.getElementById("stepWarning");
  const reasonIds = ["reasonPP", "reasonPN", "reasonNP", "reasonNN"];
  const correctId = getCorrectReasonId();
  const warning = document.getElementById("reasonWarning");

  document.querySelectorAll(".reason-flagged")
    .forEach(el => el.classList.remove("reason-flagged"));

  // Require all three "how I found the answer" steps to be checked
  const uncheckedSteps = stepIds.filter(id =>
    !document.getElementById(id).checked
  );

  if (uncheckedSteps.length > 0) {
    uncheckedSteps.forEach(id => {
      document.getElementById("stepRow" + id.slice(4))
        .classList.add("reason-flagged");
    });

    stepWarning.classList.remove("hidden");
    return;
  }

  stepWarning.classList.add("hidden");

  const wrongIds = reasonIds.filter(id =>
    id !== correctId && document.getElementById(id).checked
  );

  if (wrongIds.length > 0) {
    wrongIds.forEach(id => {
      document.getElementById("reasonRow" + id.slice(6))
        .classList.add("reason-flagged");
    });

    warning.textContent =
      "⚠ That's not the rule that applies to this problem. Uncheck it and select the correct one before continuing.";
    warning.classList.remove("hidden");
    return;
  }

  if (!document.getElementById(correctId).checked) {
    document.getElementById("reasonRow" + correctId.slice(6))
      .classList.add("reason-flagged");

    warning.textContent =
      "⚠ Check the rule you applied for this problem before continuing.";
    warning.classList.remove("hidden");
    return;
  }

  warning.classList.add("hidden");
  generateProblem();
}

function updateStats() {
  document.getElementById("score").textContent = score;
  document.getElementById("streak").textContent = streak;
  document.getElementById("correct").textContent = correct;
}

function setBadgeState(key, current, target) {
  const capped = Math.min(current, target);
  const unlocked = current >= target;

  document.getElementById(`badge-${key}-progress`).textContent =
    `${capped} / ${target}`;

  document.getElementById(`badge-${key}-status`).textContent =
    unlocked ? "✅" : "🔒";

  document.getElementById(`badge-${key}`).classList.toggle("unlocked", unlocked);

  return unlocked;
}

function updateProgress() {
  const accuracy =
    questions === 0 ? 0 : Math.round((correct / questions) * 100);

  document.getElementById("accuracy").textContent =
    accuracy + "%";

  document.getElementById("questions").textContent =
    questions;

  document.getElementById("totalCorrect").textContent =
    correct;

  document.getElementById("bestStreak").textContent =
    bestStreak;

  // Each badge's own task/threshold:
  const unlockedFirst = setBadgeState("first", correct, 1);
  const unlockedHundred = setBadgeState("hundred", correct, 100);
  const unlockedIntegerMaster = setBadgeState("integer", advancedCorrect, 25);
  const unlockedNegativeExpert = setBadgeState("negative", negativeCorrect, 20);
  const unlockedFastThinker = setBadgeState("fast", bestTimeTrialScore, 100);

  // SIMS Champion: unlock all 5 other achievements
  const unlockedCount = [
    unlockedFirst,
    unlockedHundred,
    unlockedIntegerMaster,
    unlockedNegativeExpert,
    unlockedFastThinker,
  ].filter(Boolean).length;

  setBadgeState("champion", unlockedCount, 5);
}

function saveData() {
  localStorage.setItem("simsScore", score);
  localStorage.setItem("simsCorrect", correct);
  localStorage.setItem("simsQuestions", questions);
  localStorage.setItem("simsStreak", streak);
  localStorage.setItem("simsBest", bestStreak);
  localStorage.setItem("simsAdvancedCorrect", advancedCorrect);
  localStorage.setItem("simsNegativeCorrect", negativeCorrect);
}

function teacherStart() {
  const level =
    document.getElementById("teacherDifficulty").value;
  const mode =
    document.getElementById("teacherMode").value;

  if (mode === "word") {
    startWordProblems(level);
  } else {
    startGame(level);
  }
}

updateStats();