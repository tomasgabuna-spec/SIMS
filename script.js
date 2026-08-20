let currentDifficulty = "beginner";
let minuend = 5;
let subtrahend = 3;
let selected = null;

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

  document.getElementById("problem").textContent =
    `${formatNumber(minuend)} − (${formatNumber(subtrahend)}) = ?`;

  selected = null;

  document.getElementById("selectedText").textContent =
    "Selected Coordinate: —";

  document.getElementById("submitBtn").disabled = true;

  document.getElementById("feedback").className = "feedback hidden";
  document.getElementById("explanation").classList.add("hidden");

  document.querySelectorAll("#explanation input[type=checkbox]")
    .forEach(cb => cb.checked = false);

  document.getElementById("reasonWarning").classList.add("hidden");

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

      cell.title = `Coordinate (${x}, ${y})`;

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
  stopTimer();

  currentDifficulty = level;

  document.getElementById("levelBadge").textContent =
    level.toUpperCase();

  document.getElementById("timerStat").classList.add("hidden");
  document.getElementById("timeTrialResults").classList.add("hidden");

  showScreen("game");
  generateProblem();
}

function startTimeTrial() {
  isTimeTrial = true;
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
  feedback.innerHTML = `
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
  const reasonIds = ["reasonPP", "reasonPN", "reasonNP", "reasonNN"];
  const correctId = getCorrectReasonId();
  const warning = document.getElementById("reasonWarning");

  document.querySelectorAll(".reason-flagged")
    .forEach(el => el.classList.remove("reason-flagged"));

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

  if (questions >= 1) {
    document.getElementById("achievementText").textContent =
      "🏅 FIRST SOLVE — You solved your first SIMS problem!";
  }

  if (questions >= 10) {
    document.getElementById("achievementText").textContent =
      "🏆 INTEGER EXPLORER — You completed 10 problems!";
  }
}

function saveData() {
  localStorage.setItem("simsScore", score);
  localStorage.setItem("simsCorrect", correct);
  localStorage.setItem("simsQuestions", questions);
  localStorage.setItem("simsStreak", streak);
  localStorage.setItem("simsBest", bestStreak);
}

function teacherStart() {
  const level =
    document.getElementById("teacherDifficulty").value;

  startGame(level);
}

updateStats();