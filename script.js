let currentDifficulty = "beginner";
let minuend = 5;
let subtrahend = 3;
let selected = null;

// --- CLOUD CLASSROOM MODE ---
// Requires Firebase config in firebase-config.js and Realtime Database rules.
let activeClassCode = localStorage.getItem("simsActiveClassCode") || "";
let activeStudentName = localStorage.getItem("simsActiveStudentName") || "";
let classroomClasses = [];
let teacherClassUnsub = null;
let currentClassUnsub = null;

const db = () => firebase.database();
const cleanCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function ensureCloudReady(){
  if(!window.firebase || !firebase.apps.length) throw new Error("Firebase is not configured. Edit firebase-config.js first.");
}

async function makeClassCode(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for(let i=0;i<20;i++){
    const code=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
    const snap=await db().ref("classes/"+code).once("value");
    if(!snap.exists()) return code;
  }
  throw new Error("Could not create a unique class code. Please try again.");
}

async function createClass(){
  const msg=document.getElementById("classCreateMessage");
  const name=document.getElementById("className").value.trim();
  const subject=document.getElementById("classSubject").value.trim()||"SIMS Integer Subtraction";
  if(!name){ msg.textContent="Please enter a class name."; return; }
  try{
    await ensureCloudReady(); msg.textContent="Creating cloud classroom...";
    const code=await makeClassCode();
    const cls={code,name,subject,mode:document.getElementById("teacherMode").value,difficulty:document.getElementById("teacherDifficulty").value,questions:Number(document.getElementById("teacherQuestions").value),createdAt:firebase.database.ServerValue.TIMESTAMP};
    await db().ref("classes/"+code+"/meta").set(cls);
    await db().ref("classes/"+code+"/students").set({});
    msg.innerHTML="✅ Cloud class created! Share code <strong>"+code+"</strong> with your students.";
    subscribeTeacherClasses(); showClassAnalytics(code);
  }catch(e){ msg.textContent="❌ "+e.message; }
}

function subscribeTeacherClasses(){
  if(!window.firebase || !firebase.apps.length) return;
  if(teacherClassUnsub) db().ref("classes").off("value",teacherClassUnsub);
  teacherClassUnsub=snap=>{
    const raw=snap.val()||{};
    classroomClasses=Object.entries(raw).map(([code,v])=>({code,...(v.meta||{}),students:Object.values(v.students||{}),attempts:Object.values(v.attempts||{})}));
    renderTeacherClasses();
  };
  db().ref("classes").on("value",teacherClassUnsub);
}

function renderTeacherClasses(){
  const el=document.getElementById("teacherClassList"); if(!el) return;
  if(!classroomClasses.length){ el.innerHTML="<p>No cloud classes yet. Create your first class above.</p>"; return; }
  el.innerHTML=classroomClasses.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(c=>`<div class="class-item"><h4>${escapeHtml(c.name)}</h4><p>${escapeHtml(c.subject)} · ${c.difficulty}</p><div class="class-code">${c.code}</div><p>👥 ${c.students.length} student(s)</p><div class="class-actions"><button onclick="showClassAnalytics('${c.code}')">📊 Live Dashboard</button><button onclick="copyClassCode('${c.code}')">📋 Copy Code</button></div></div>`).join("");
}

function copyClassCode(code){ navigator.clipboard?.writeText(code); document.getElementById("classCreateMessage").textContent="Class code copied: "+code; }

function showClassAnalytics(code){
  const box=document.getElementById("classAnalytics"); if(!box) return;
  box.classList.remove("hidden");
  if(!window.firebase || !firebase.apps.length){ box.textContent="Firebase is not configured."; return; }
  if(currentClassUnsub) db().ref("classes/"+currentClassUnsub.code).off("value",currentClassUnsub.fn);
  const fn=snap=>renderClassAnalytics(code,snap.val()||{});
  currentClassUnsub={code,fn}; db().ref("classes/"+code).on("value",fn);
}

function renderClassAnalytics(code,data){
  const box=document.getElementById("classAnalytics"); const meta=data.meta||{};
  const students=Object.entries(data.students||{}).map(([id,s])=>({id,...s}));
  const attempts=Object.values(data.attempts||{}); const total=attempts.length, correct=attempts.filter(a=>a.correct).length;
  const accuracy=total?Math.round(correct/total*100):0;
  const completed=students.filter(s=>s.completed).length;
  const avgScore=students.length?Math.round(students.reduce((n,s)=>n+(s.score||0),0)/students.length):0;
  const mistakes={}; attempts.filter(a=>!a.correct).forEach(a=>mistakes[a.problem||"SIMS problem"]=(mistakes[a.problem||"SIMS problem"]||0)+1);
  const common=Object.entries(mistakes).sort((a,b)=>b[1]-a[1]).slice(0,6);
  box.innerHTML=`<h3>📊 ${escapeHtml(meta.name||code)} — LIVE Dashboard</h3><p>Class code: <strong>${code}</strong> · ${students.length} student(s) · updates automatically</p><div class="analytics-grid"><div class="analytics-stat"><span>Accuracy</span><strong>${accuracy}%</strong></div><div class="analytics-stat"><span>Average Score</span><strong>${avgScore}</strong></div><div class="analytics-stat"><span>Students</span><strong>${students.length}</strong></div><div class="analytics-stat"><span>Completion</span><strong>${students.length?Math.round(completed/students.length*100):0}%</strong></div></div><h4>👥 Student Performance</h4><table class="analytics-table"><thead><tr><th>Student</th><th>Accuracy</th><th>Score</th><th>Completion</th><th>Last Activity</th></tr></thead><tbody>${students.length?students.map(s=>`<tr><td>${escapeHtml(s.name||"Student")}</td><td>${s.attempts?Math.round((s.correct||0)/s.attempts*100):0}%</td><td>${s.score||0}</td><td>${s.completed?"✅ Complete":"⏳ In progress"}</td><td>${s.lastActivity?new Date(s.lastActivity).toLocaleTimeString():"—"}</td></tr>`).join(""):'<tr><td colspan="5">Waiting for students to join...</td></tr>'}</tbody></table><h4 style="margin-top:18px">⚠️ Common Mistakes</h4><div class="mistake-list">${common.length?common.map(([p,n])=>`<span class="mistake-tag">${escapeHtml(p)} × ${n}</span>`).join(""):"<span>No mistakes recorded yet.</span>"}</div>`;
}

function showJoinClass(){ showScreen("joinClass"); }

async function joinClass(){
  const name=document.getElementById("studentName").value.trim(); const code=cleanCode(document.getElementById("joinCode").value); const msg=document.getElementById("joinMessage");
  if(!name||!code){msg.textContent="Please enter your name and class code.";return;}
  try{
    await ensureCloudReady(); const ref=db().ref("classes/"+code); const snap=await ref.child("meta").once("value");
    if(!snap.exists()){msg.textContent="Class code not found.";return;}
    const studentId=localStorage.getItem("simsStudentId")||crypto.randomUUID(); localStorage.setItem("simsStudentId",studentId);
    await ref.child("students/"+studentId).update({name,score:0,correct:0,attempts:0,completed:false,joinedAt:firebase.database.ServerValue.TIMESTAMP,lastActivity:firebase.database.ServerValue.TIMESTAMP});
    activeClassCode=code; activeStudentName=name; localStorage.setItem("simsActiveClassCode",code); localStorage.setItem("simsActiveStudentName",name); localStorage.setItem("simsStudentId",studentId);
    msg.innerHTML=`✅ Joined <strong>${escapeHtml(snap.val().name)}</strong>. Your results will now be sent automatically to the teacher.`;
  }catch(e){msg.textContent="❌ "+e.message;}
}

async function recordClassAttempt(isCorrect){
  if(!activeClassCode||!activeStudentName||!window.firebase||!firebase.apps.length)return;
  const studentId=localStorage.getItem("simsStudentId"); if(!studentId)return;
  try{
    const root=db().ref("classes/"+activeClassCode); const problem=(document.getElementById("problem")?.textContent||"SIMS problem").slice(0,120); const now=Date.now();
    const meta=(await root.child("meta").once("value")).val()||{};
    await root.child("attempts").push({studentId,student:activeStudentName,correct:isCorrect,problem,time:now});
    const sref=root.child("students/"+studentId);
    await sref.transaction(s=>{s=s||{name:activeStudentName,score:0,correct:0,attempts:0}; s.name=activeStudentName;s.attempts=(s.attempts||0)+1;if(isCorrect){s.correct=(s.correct||0)+1;s.score=(s.score||0)+10;}s.lastActivity=now;if(meta.questions&&s.attempts>=meta.questions)s.completed=true;return s;});
  }catch(e){console.warn("Cloud result was not saved",e);}
}

function escapeHtml(value){return String(value).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));}

document.addEventListener("DOMContentLoaded",()=>{setTimeout(subscribeTeacherClasses,300);});

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

// --- MISSION MODE ---
let isMission = false;
let currentWorld = null;

const WORLDS = [
  {
    id: "village",
    name: "Village",
    icon: "🏘️",
    tagline: "Where your journey begins.",
    desc: "Simple whole-number subtraction to warm up.",
    target: 5,
    gen: () => {
      const m = generateNumber(1, 9);
      const s = generateNumber(1, m);
      return { m, s };
    },
  },
  {
    id: "forest",
    name: "Forest",
    icon: "🌲",
    tagline: "The trail gets trickier.",
    desc: "Subtraction that can dip into negative results.",
    target: 5,
    gen: () => ({ m: generateNumber(-4, 9), s: generateNumber(-4, 9) }),
  },
  {
    id: "castle",
    name: "Castle",
    icon: "🏰",
    tagline: "Defend against negative integers.",
    desc: "Mixed positive and negative integers.",
    target: 6,
    gen: () => ({ m: generateNumber(-8, 8), s: generateNumber(-8, 8) }),
  },
  {
    id: "mountain",
    name: "Mountain",
    icon: "⛰️",
    tagline: "Thin air, thicker numbers.",
    desc: "A wider range and tougher combinations.",
    target: 6,
    gen: () => ({ m: generateNumber(-10, 10), s: generateNumber(-10, 10) }),
  },
  {
    id: "galaxy",
    name: "Galaxy",
    icon: "🌌",
    tagline: "Master subtraction among the stars.",
    desc: "The full range, including negative − negative challenges.",
    target: 8,
    gen: () => {
      // Bias toward negative-negative and negative-positive, the hardest rules
      const m = generateNumber(-10, 10);
      const s = Math.random() < 0.6 ? generateNumber(-10, -1) : generateNumber(-10, 10);
      return { m, s };
    },
  },
];

let missionUnlockedIndex =
  Number(localStorage.getItem("simsMissionUnlocked")) || 0;

let missionProgress =
  JSON.parse(localStorage.getItem("simsMissionProgress") || "{}");

function saveMissionData() {
  localStorage.setItem("simsMissionUnlocked", missionUnlockedIndex);
  localStorage.setItem("simsMissionProgress", JSON.stringify(missionProgress));
}

function showMissions() {
  renderMissions();
  showScreen("missions");
}

function renderMissions(selectedId) {
  const path = document.getElementById("missionPath");
  path.innerHTML = "";

  const activeId =
    selectedId ||
    currentWorld ||
    WORLDS[Math.min(missionUnlockedIndex, WORLDS.length - 1)].id;

  WORLDS.forEach((w, i) => {
    if (i > 0) {
      const connector = document.createElement("div");
      connector.className = "mission-connector" + (i <= missionUnlockedIndex ? " done" : "");
      path.appendChild(connector);
    }

    const state = i < missionUnlockedIndex ? "unlocked"
      : i === missionUnlockedIndex ? "current"
      : "locked";

    const node = document.createElement("div");
    node.className = `mission-node ${state}`;

    const statusText = state === "locked"
      ? "🔒 Locked"
      : state === "current"
        ? `${Math.min(missionProgress[w.id] || 0, w.target)} / ${w.target} ⭐`
        : "✅ Cleared";

    node.innerHTML = `
      <div class="mission-node-circle">${w.icon}</div>
      <div class="mission-node-name">${w.name}</div>
      <div class="mission-node-status">${statusText}</div>
    `;

    node.querySelector(".mission-node-circle").addEventListener("click", () => {
      if (state === "locked") {
        renderMissionDetail(w, i, state);
        return;
      }
      renderMissions(w.id);
      renderMissionDetail(w, i, state);
    });

    path.appendChild(node);
  });

  const activeWorld = WORLDS.find(w => w.id === activeId);
  const activeIndex = WORLDS.findIndex(w => w.id === activeId);
  const activeState = activeIndex < missionUnlockedIndex ? "unlocked"
    : activeIndex === missionUnlockedIndex ? "current"
    : "locked";

  renderMissionDetail(activeWorld, activeIndex, activeState);
}

function renderMissionDetail(w, index, state) {
  const detail = document.getElementById("missionDetail");
  const progress = Math.min(missionProgress[w.id] || 0, w.target);
  const pct = Math.round((progress / w.target) * 100);

  if (state === "locked") {
    const prev = WORLDS[index - 1];
    detail.innerHTML = `
      <div class="mission-detail-header">
        <div class="mission-detail-icon">🔒</div>
        <div>
          <h3>${w.name} is locked</h3>
          <p>Clear ${prev.target} problems in ${prev.icon} ${prev.name} to unlock this world.</p>
        </div>
      </div>
    `;
    return;
  }

  detail.innerHTML = `
    <div class="mission-detail-header">
      <div class="mission-detail-icon">${w.icon}</div>
      <div>
        <h3>${w.name}</h3>
        <p>${w.tagline} ${w.desc}</p>
      </div>
    </div>
    <div class="mission-progress-bar"><div class="mission-progress-fill" style="width:${pct}%"></div></div>
    <p class="mission-progress-label">${progress} / ${w.target} correct answers${state === "unlocked" ? " — World cleared!" : " to unlock the next world"}</p>
    <button class="primary" onclick="startMission('${w.id}')">▶ ENTER ${w.name.toUpperCase()}</button>
  `;
}

function startMission(worldId) {
  isTimeTrial = false;
  isWordProblem = false;
  isMission = true;
  stopTimer();

  currentWorld = worldId;
  const w = WORLDS.find(x => x.id === worldId);

  document.getElementById("levelBadge").textContent = `${w.icon} ${w.name.toUpperCase()}`;
  document.getElementById("gameTitle").textContent = `🗺️ Mission: ${w.name}`;

  document.getElementById("timerStat").classList.add("hidden");
  document.getElementById("timeTrialResults").classList.add("hidden");

  showScreen("game");
  generateProblem();
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
  } else if (isMission) {
    const w = WORLDS.find(x => x.id === currentWorld);
    const { m, s } = w.gen();
    minuend = m;
    subtrahend = s;

    document.getElementById("problemLabel").textContent = `${w.icon} ${w.name.toUpperCase()}`;
    document.getElementById("problem").textContent =
      `${formatNumber(minuend)} − (${formatNumber(subtrahend)}) = ?`;
    document.getElementById("problem").classList.remove("word-problem-text");
    document.getElementById("problemSubtext").textContent =
      "Find the correct coordinate on the SIMS grid.";
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
  isMission = false;
  currentWorld = null;
  stopTimer();

  currentDifficulty = level;

  document.getElementById("levelBadge").textContent =
    level.toUpperCase();
  document.getElementById("gameTitle").textContent = "🎯 Spot the Difference";

  document.getElementById("timerStat").classList.add("hidden");
  document.getElementById("timeTrialResults").classList.add("hidden");

  showScreen("game");
  generateProblem();
}

function startWordProblems(level = "beginner") {
  isTimeTrial = false;
  isWordProblem = true;
  isMission = false;
  currentWorld = null;
  stopTimer();

  wordProblemQueue = [];

  currentDifficulty = level;

  document.getElementById("levelBadge").textContent = "WORD PROBLEM";
  document.getElementById("gameTitle").textContent = "📝 Word Problems";

  document.getElementById("timerStat").classList.add("hidden");
  document.getElementById("timeTrialResults").classList.add("hidden");

  showScreen("game");
  generateProblem();
}

function startTimeTrial() {
  isTimeTrial = true;
  isWordProblem = false;
  isMission = false;
  currentWorld = null;
  currentDifficulty = "intermediate";
  timeTrialScore = 0;
  timeTrialSolved = 0;
  timeLeft = timeTrialDuration;

  document.getElementById("levelBadge").textContent = "TIME TRIAL";
  document.getElementById("gameTitle").textContent = "⏱️ Time Trial";
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
renderTeacherClasses();
}

function submitAnswer() {
  if (!selected) return;

  questions++;

  const isCorrect =
    selected.x === minuend &&
    selected.y === subtrahend;

  recordClassAttempt(isCorrect);

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

    let missionMessage = "";
    if (isMission) {
      const worldIndex = WORLDS.findIndex(w => w.id === currentWorld);
      const w = WORLDS[worldIndex];
      const already = missionProgress[w.id] || 0;

      if (already < w.target) {
        missionProgress[w.id] = already + 1;
      }

      if (
        missionProgress[w.id] >= w.target &&
        worldIndex === missionUnlockedIndex &&
        worldIndex < WORLDS.length - 1
      ) {
        missionUnlockedIndex = worldIndex + 1;
        const nextWorld = WORLDS[missionUnlockedIndex];
        missionMessage = `<p>🎉 ${w.name} cleared! ${nextWorld.icon} ${nextWorld.name} is now unlocked.</p>`;
      } else if (missionProgress[w.id] >= w.target) {
        missionMessage = `<p>⭐ ${w.name} mastered!</p>`;
      } else {
        missionMessage = `<p>⭐ ${w.name} progress: ${missionProgress[w.id]} / ${w.target}</p>`;
      }

      saveMissionData();
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
      ${missionMessage}
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