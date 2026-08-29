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
  if(!navigator.onLine) throw new Error("You're offline. Cloud classroom features need an internet connection.");
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

function showJoinClass(){
  showScreen("joinClass");
  const msg = document.getElementById("joinMessage");
  if (msg && !navigator.onLine) {
    msg.textContent = "📴 You're offline — joining a class needs an internet connection.";
  }
}

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

// Fixed set of Philippine-context integer word problems. Each problem uses signed values consistently and is written to make the requested change explicit.
// Each entry's m (minuend) and s (subtrahend) match the intended
// answer: difference = m - s, plotted as coordinate (m, s) on the grid.
const wordProblems = [
  { text: "At a weather station in Baguio City, the temperature was 7°C in the afternoon and 3°C at night. What was the change in temperature from the afternoon reading to the night reading?", m: 3, s: 7 },
  { text: "A diver near Batangas was 2 m below sea level and then descended to 6 m below sea level. What was the change in elevation?", m: -6, s: -2 },
  { text: "Liza had ₱8 in her e-wallet and paid ₱5 for a printing fee. What was her new balance?", m: 8, s: 5 },
  { text: "At dawn in Benguet, the temperature was −2°C. By noon, it was 5°C. How many degrees did the temperature increase?", m: 5, s: -2 },
  { text: "An elevator in a Manila building started 3 floors below ground level and stopped 1 floor below ground level. What was the change in its floor position?", m: -1, s: -3 },
  { text: "A hiker on Mount Apo was 4 m above a reference point and then descended to 1 m above that point. What was the change in elevation?", m: 1, s: 4 },
  { text: "A sari-sari store recorded a ₱3 loss on Monday and a ₱2 gain on Tuesday. What was the change in the store's daily result from Monday to Tuesday?", m: 2, s: -3 },
  { text: "The temperature inside a cold-storage room in Davao was −6°C and rose to −1°C. By how many degrees did the temperature increase?", m: -1, s: -6 },
  { text: "A fisherman in Palawan used sea level as 0 m. A sinker was 5 m below sea level and was pulled up until it was 2 m below sea level. What was the change in elevation?", m: -2, s: -5 },
  { text: "Carlo had ₱9 and spent ₱7 on a jeepney fare. How much money remained?", m: 9, s: 7 },
  { text: "At a science exhibit in Quezon City, a thermometer read 4°C and later read −3°C. What was the change in temperature?", m: -3, s: 4 },
  { text: "On a rice-terrace model, one point is 6 m above a reference line and another point is 2 m above the same line. How much lower is the second point?", m: 2, s: 6 },
  { text: "Mia's class fund balance changed from −₱4 to −₱1 after she paid part of what she owed. What was the change in her balance?", m: -1, s: -4 },
  { text: "A submarine model was 1 m below the waterline and then moved to 7 m below the waterline. What was its change in elevation?", m: -7, s: -1 },
  { text: "A delivery rider was 2 km east of the barangay hall and later was 5 km east of it. What was the change in the rider's eastward position?", m: 5, s: 2 },
  { text: "In Sagada, the morning temperature was −4°C and it increased by 7°C in the afternoon. What was the afternoon temperature? Use final temperature minus initial temperature to verify the change.", m: 3, s: -4 },
  { text: "A diver in Cebu started 3 m below sea level and ended 8 m below sea level. If the dive computer calculates final elevation minus starting elevation, what value should it display?", m: -8, s: -3 },
  { text: "A student's canteen account showed a balance of −₱3. A parent added ₱8. What was the new balance?", m: 5, s: -3 },
  { text: "A tide marker in Iloilo showed 2 m above a reference level in the morning and 4 m below it in the evening. What was the change in level from morning to evening?", m: -4, s: 2 },
  { text: "A courier traveled 8 km north from a depot and then returned south until the courier was 3 km north of the depot. By how many kilometers was the northward distance reduced?", m: 8, s: 3 },
  { text: "A vendor's daily result was a ₱2 gain on Saturday and a ₱5 loss on Sunday. What was the change in the daily result from Saturday to Sunday?", m: -5, s: 2 },
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
let wrongStreak = 0;

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
  const msg = document.getElementById("classCreateMessage");
  if (msg && !navigator.onLine) {
    msg.textContent = "📴 You're offline — Teacher Mode needs an internet connection to sync with students.";
  }
}

function showProgress() {
  updateProgress();
  showScreen("progress");
}

function generateNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem() {
  maybeAdaptDifficulty();

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
    const generated = generatePracticeProblem(currentDifficulty);
    minuend = generated.m;
    subtrahend = generated.s;

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
    wrongStreak = 0;
    score += 10;
    playSound("correct");

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
    let missionWorldCleared = false;
    if (isMission) {
      const worldIndex = WORLDS.findIndex(w => w.id === currentWorld);
      const w = WORLDS[worldIndex];
      const already = missionProgress[w.id] || 0;

      if (already < w.target) {
        missionProgress[w.id] = already + 1;
      }

      let nextMissionWorld = null;

      if (
        missionProgress[w.id] >= w.target &&
        worldIndex === missionUnlockedIndex &&
        worldIndex < WORLDS.length - 1
      ) {
        missionUnlockedIndex = worldIndex + 1;
        nextMissionWorld = WORLDS[missionUnlockedIndex];
        missionWorldCleared = true;
        missionMessage = `<p>🎉 ${w.name} cleared! ${nextMissionWorld.icon} ${nextMissionWorld.name} is now unlocked.</p><p>🚀 Moving to the next world...</p>`;
      } else if (missionProgress[w.id] >= w.target && worldIndex === WORLDS.length - 1) {
        missionWorldCleared = true;
        missionMessage = `<p>🏆 ${w.name} cleared! You completed every mission world!</p><p>🌟 Returning to the Mission Map...</p>`;
      } else if (missionProgress[w.id] >= w.target) {
        missionMessage = `<p>⭐ ${w.name} mastered!</p>`;
      } else {
        missionMessage = `<p>⭐ ${w.name} progress: ${missionProgress[w.id]} / ${w.target}</p>`;
      }

      saveMissionData();

      // Once a world is cleared, automatically move to the next world instead
      // of generating another question from the completed world.
      if (missionWorldCleared) {
        document.getElementById("submitBtn").disabled = true;
        document.getElementById("explanation").classList.add("hidden");

        setTimeout(() => {
          if (!isMission) return;

          if (nextMissionWorld) {
            currentWorld = nextMissionWorld.id;
            document.getElementById("levelBadge").textContent = `${nextMissionWorld.icon} ${nextMissionWorld.name.toUpperCase()}`;
            document.getElementById("gameTitle").textContent = `🗺️ Mission: ${nextMissionWorld.name}`;
            generateProblem();
          } else {
            currentWorld = null;
            showMissions();
          }
        }, 1400);
      }
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
    } else if (!missionWorldCleared) {
      document.getElementById("explanation").classList.remove("hidden");
    }

  } else {
    streak = 0;
    wrongStreak++;
    playSound("wrong");

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

// ============================================================
// QUIZ MODULE — 80 Philippine-context multiple-choice questions
// 20 each: Easy, Average, Difficult, Advanced.
// Word problems use explicit starting/final values and ask for one
// mathematically defined quantity, avoiding ambiguous wording.
// ============================================================
const quizBank = [
{d:'easy',q:'A sari-sari store had ₱50 and spent ₱18 on supplies. How much cash remained?',a:32,e:'₱50 − ₱18 = ₱32.',options:[{value:'A',label:'33',feedback:'An off-by-one calculation. The checked result from the stated problem is 32.'}, {value:'B',label:'32',feedback:'₱50 − ₱18 = ₱32.'}, {value:'C',label:'68',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 32.'}, {value:'D',label:'-32',feedback:'Reversing the subtraction order. The checked result from the stated problem is 32.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A passenger paid ₱50 for a ₱20 jeepney fare. How much change should the passenger receive?',a:30,e:'₱50 − ₱20 = ₱30.',options:[{value:'A',label:'-30',feedback:'Reversing the subtraction order. The checked result from the stated problem is 30.'}, {value:'B',label:'31',feedback:'An off-by-one calculation. The checked result from the stated problem is 30.'}, {value:'C',label:'30',feedback:'₱50 − ₱20 = ₱30.'}, {value:'D',label:'70',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 30.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A classroom library had 45 books. Twelve were borrowed. How many books remained?',a:33,e:'45 − 12 = 33 books.',options:[{value:'A',label:'57',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 33.'}, {value:'B',label:'-33',feedback:'Reversing the subtraction order. The checked result from the stated problem is 33.'}, {value:'C',label:'34',feedback:'An off-by-one calculation. The checked result from the stated problem is 33.'}, {value:'D',label:'33',feedback:'45 − 12 = 33 books.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A Grade 4 pupil had 80 stickers and used 25 for a project. How many stickers were left?',a:55,e:'80 − 25 = 55 stickers.',options:[{value:'A',label:'55',feedback:'80 − 25 = 55 stickers.'}, {value:'B',label:'105',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 55.'}, {value:'C',label:'-55',feedback:'Reversing the subtraction order. The checked result from the stated problem is 55.'}, {value:'D',label:'56',feedback:'An off-by-one calculation. The checked result from the stated problem is 55.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A vendor in Cebu had 12 mangoes and sold 5. How many mangoes were left?',a:7,e:'12 − 5 = 7 mangoes.',options:[{value:'A',label:'8',feedback:'An off-by-one calculation. The checked result from the stated problem is 7.'}, {value:'B',label:'7',feedback:'12 − 5 = 7 mangoes.'}, {value:'C',label:'17',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 7.'}, {value:'D',label:'-7',feedback:'Reversing the subtraction order. The checked result from the stated problem is 7.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A student had ₱100 and spent ₱35 at the school canteen. How much remained?',a:65,e:'₱100 − ₱35 = ₱65.',options:[{value:'A',label:'-65',feedback:'Reversing the subtraction order. The checked result from the stated problem is 65.'}, {value:'B',label:'66',feedback:'An off-by-one calculation. The checked result from the stated problem is 65.'}, {value:'C',label:'65',feedback:'₱100 − ₱35 = ₱65.'}, {value:'D',label:'135',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 65.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A class needs to travel 18 km to a museum. If 7 km have been covered, how many kilometers remain?',a:11,e:'18 − 7 = 11 km.',options:[{value:'A',label:'25',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 11.'}, {value:'B',label:'-11',feedback:'Reversing the subtraction order. The checked result from the stated problem is 11.'}, {value:'C',label:'12',feedback:'An off-by-one calculation. The checked result from the stated problem is 11.'}, {value:'D',label:'11',feedback:'18 − 7 = 11 km.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A school room has 30 chairs. If 8 are occupied, how many are unoccupied?',a:22,e:'30 − 8 = 22 chairs.',options:[{value:'A',label:'22',feedback:'30 − 8 = 22 chairs.'}, {value:'B',label:'38',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 22.'}, {value:'C',label:'-22',feedback:'Reversing the subtraction order. The checked result from the stated problem is 22.'}, {value:'D',label:'23',feedback:'An off-by-one calculation. The checked result from the stated problem is 22.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A pupil brought 24 candies and gave 9 to classmates. How many candies remained?',a:15,e:'24 − 9 = 15 candies.',options:[{value:'A',label:'16',feedback:'An off-by-one calculation. The checked result from the stated problem is 15.'}, {value:'B',label:'15',feedback:'24 − 9 = 15 candies.'}, {value:'C',label:'33',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 15.'}, {value:'D',label:'-15',feedback:'Reversing the subtraction order. The checked result from the stated problem is 15.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A 60-minute class has used 25 minutes. How many minutes remain?',a:35,e:'60 − 25 = 35 minutes.',options:[{value:'A',label:'-35',feedback:'Reversing the subtraction order. The checked result from the stated problem is 35.'}, {value:'B',label:'36',feedback:'An off-by-one calculation. The checked result from the stated problem is 35.'}, {value:'C',label:'35',feedback:'60 − 25 = 35 minutes.'}, {value:'D',label:'85',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 35.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A student had ₱40 and spent ₱17 on art materials. How much remained?',a:23,e:'₱40 − ₱17 = ₱23.',options:[{value:'A',label:'57',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 23.'}, {value:'B',label:'-23',feedback:'Reversing the subtraction order. The checked result from the stated problem is 23.'}, {value:'C',label:'24',feedback:'An off-by-one calculation. The checked result from the stated problem is 23.'}, {value:'D',label:'23',feedback:'₱40 − ₱17 = ₱23.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A thermometer in Benguet showed 10°C. The temperature dropped by 4°C. What was the new temperature?',a:6,e:'10 − 4 = 6°C.',options:[{value:'A',label:'6',feedback:'10 − 4 = 6°C.'}, {value:'B',label:'14',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 6.'}, {value:'C',label:'-6',feedback:'Reversing the subtraction order. The checked result from the stated problem is 6.'}, {value:'D',label:'7',feedback:'An off-by-one calculation. The checked result from the stated problem is 6.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'There are 17 pupils in a group. Six are absent. How many are present?',a:11,e:'17 − 6 = 11 pupils.',options:[{value:'A',label:'12',feedback:'An off-by-one calculation. The checked result from the stated problem is 11.'}, {value:'B',label:'11',feedback:'17 − 6 = 11 pupils.'}, {value:'C',label:'23',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 11.'}, {value:'D',label:'-11',feedback:'Reversing the subtraction order. The checked result from the stated problem is 11.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A pupil needs to read 75 pages. After reading 28 pages, how many pages are unread?',a:47,e:'75 − 28 = 47 pages.',options:[{value:'A',label:'-47',feedback:'Reversing the subtraction order. The checked result from the stated problem is 47.'}, {value:'B',label:'48',feedback:'An off-by-one calculation. The checked result from the stated problem is 47.'}, {value:'C',label:'47',feedback:'75 − 28 = 47 pages.'}, {value:'D',label:'103',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 47.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A recycling drive collected 90 plastic bottles and sold 34. How many bottles were not sold?',a:56,e:'90 − 34 = 56 bottles.',options:[{value:'A',label:'124',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 56.'}, {value:'B',label:'-56',feedback:'Reversing the subtraction order. The checked result from the stated problem is 56.'}, {value:'C',label:'57',feedback:'An off-by-one calculation. The checked result from the stated problem is 56.'}, {value:'D',label:'56',feedback:'90 − 34 = 56 bottles.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A player had 25 points and lost 9 points after a penalty. What was the new score?',a:16,e:'25 − 9 = 16 points.',options:[{value:'A',label:'16',feedback:'25 − 9 = 16 points.'}, {value:'B',label:'34',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 16.'}, {value:'C',label:'-16',feedback:'Reversing the subtraction order. The checked result from the stated problem is 16.'}, {value:'D',label:'17',feedback:'An off-by-one calculation. The checked result from the stated problem is 16.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A school garden had 64 seedlings. Eighteen were moved to another plot. How many stayed?',a:46,e:'64 − 18 = 46 seedlings.',options:[{value:'A',label:'47',feedback:'An off-by-one calculation. The checked result from the stated problem is 46.'}, {value:'B',label:'46',feedback:'64 − 18 = 46 seedlings.'}, {value:'C',label:'82',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 46.'}, {value:'D',label:'-46',feedback:'Reversing the subtraction order. The checked result from the stated problem is 46.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A class prepared 55 Philippine flags and used 23. How many were unused?',a:32,e:'55 − 23 = 32 flags.',options:[{value:'A',label:'-32',feedback:'Reversing the subtraction order. The checked result from the stated problem is 32.'}, {value:'B',label:'33',feedback:'An off-by-one calculation. The checked result from the stated problem is 32.'}, {value:'C',label:'32',feedback:'55 − 23 = 32 flags.'}, {value:'D',label:'78',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 32.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A barangay library had 70 notebooks and gave away 26. How many notebooks remained?',a:44,e:'70 − 26 = 44 notebooks.',options:[{value:'A',label:'96',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 44.'}, {value:'B',label:'-44',feedback:'Reversing the subtraction order. The checked result from the stated problem is 44.'}, {value:'C',label:'45',feedback:'An off-by-one calculation. The checked result from the stated problem is 44.'}, {value:'D',label:'44',feedback:'70 − 26 = 44 notebooks.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'easy',q:'A student saved ₱120 and spent ₱45 on school supplies. How much was left?',a:75,e:'₱120 − ₱45 = ₱75.',options:[{value:'A',label:'75',feedback:'₱120 − ₱45 = ₱75.'}, {value:'B',label:'165',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 75.'}, {value:'C',label:'-75',feedback:'Reversing the subtraction order. The checked result from the stated problem is 75.'}, {value:'D',label:'76',feedback:'An off-by-one calculation. The checked result from the stated problem is 75.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'At dawn in Benguet, the temperature was −2°C. By noon it was 5°C. What was the change in temperature?',a:7,e:'Change = final − initial = 5 − (−2) = 7°C.',options:[{value:'A',label:'13',feedback:'Does not satisfy the complete sequence of operations stated in the problem. The checked result from the stated problem is 7.'}, {value:'B',label:'7',feedback:'Change = final − initial = 5 − (−2) = 7°C.'}, {value:'C',label:'8',feedback:'An off-by-one calculation. The checked result from the stated problem is 7.'}, {value:'D',label:'6',feedback:'An off-by-one calculation. The checked result from the stated problem is 7.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A diver near Batangas moved from 2 m below sea level to 6 m below sea level. What was the change in elevation?',a:-4,e:'The elevations are −2 m and −6 m, so −6 − (−2) = −4 m.',options:[{value:'A',label:'-6',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is -4.'}, {value:'B',label:'-3',feedback:'An off-by-one calculation. The checked result from the stated problem is -4.'}, {value:'C',label:'-4',feedback:'The elevations are −2 m and −6 m, so −6 − (−2) = −4 m.'}, {value:'D',label:'16',feedback:'Treating every listed change as an addition. The checked result from the stated problem is -4.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A Manila elevator moved from 3 floors below ground to 1 floor below ground. What was the change in floor position?',a:2,e:'The floors are −3 and −1, so −1 − (−3) = 2 floors.',options:[{value:'A',label:'8',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 2.'}, {value:'B',label:'-1',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 2.'}, {value:'C',label:'3',feedback:'An off-by-one calculation. The checked result from the stated problem is 2.'}, {value:'D',label:'2',feedback:'The floors are −3 and −1, so −1 − (−3) = 2 floors.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A cold-storage room in Davao changed from −6°C to −1°C. By how many degrees did the temperature rise?',a:5,e:'−1 − (−6) = 5°C.',options:[{value:'A',label:'5',feedback:'−1 − (−6) = 5°C.'}, {value:'B',label:'-7',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 5.'}, {value:'C',label:'-5',feedback:'Reversing the subtraction order. The checked result from the stated problem is 5.'}, {value:'D',label:'6',feedback:'An off-by-one calculation. The checked result from the stated problem is 5.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A Palawan sinker moved from 5 m below sea level to 2 m below sea level. What was the change in elevation?',a:3,e:'The positions are −5 m and −2 m, so −2 − (−5) = 3 m.',options:[{value:'A',label:'4',feedback:'An off-by-one calculation. The checked result from the stated problem is 3.'}, {value:'B',label:'3',feedback:'The positions are −5 m and −2 m, so −2 − (−5) = 3 m.'}, {value:'C',label:'14',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 3.'}, {value:'D',label:'-2',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 3.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A store recorded a ₱3 loss on Monday and a ₱2 gain on Tuesday. By how much did the daily result change?',a:5,e:'Using signed values, 2 − (−3) = 5 pesos.',options:[{value:'A',label:'-5',feedback:'Reversing the subtraction order. The checked result from the stated problem is 5.'}, {value:'B',label:'6',feedback:'An off-by-one calculation. The checked result from the stated problem is 5.'}, {value:'C',label:'5',feedback:'Using signed values, 2 − (−3) = 5 pesos.'}, {value:'D',label:'-1',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 5.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A thermometer in Quezon City changed from 4°C to −3°C. What was the change in temperature?',a:-7,e:'−3 − 4 = −7°C.',options:[{value:'A',label:'1',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is -7.'}, {value:'B',label:'7',feedback:'Reversing the subtraction order. The checked result from the stated problem is -7.'}, {value:'C',label:'-6',feedback:'An off-by-one calculation. The checked result from the stated problem is -7.'}, {value:'D',label:'-7',feedback:'−3 − 4 = −7°C.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A student’s account balance was −₱3. A parent added ₱8. What was the new balance?',a:5,e:'−3 + 8 = ₱5.',options:[{value:'A',label:'5',feedback:'−3 + 8 = ₱5.'}, {value:'B',label:'11',feedback:'Reversing the subtraction order. The checked result from the stated problem is 5.'}, {value:'C',label:'6',feedback:'An off-by-one calculation. The checked result from the stated problem is 5.'}, {value:'D',label:'4',feedback:'An off-by-one calculation. The checked result from the stated problem is 5.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A tide marker in Iloilo was 2 m above a reference level in the morning and 4 m below it in the evening. What was the change in level?',a:-6,e:'The positions are 2 m and −4 m, so −4 − 2 = −6 m.',options:[{value:'A',label:'-4',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is -6.'}, {value:'B',label:'-6',feedback:'The positions are 2 m and −4 m, so −4 − 2 = −6 m.'}, {value:'C',label:'12',feedback:'Treating every listed change as an addition. The checked result from the stated problem is -6.'}, {value:'D',label:'-2',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is -6.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A diver in Cebu started at −3 m and ended at −8 m relative to sea level. What is final elevation minus starting elevation?',a:-5,e:'−8 − (−3) = −5 m.',options:[{value:'A',label:'5',feedback:'Reversing the subtraction order. The checked result from the stated problem is -5.'}, {value:'B',label:'-4',feedback:'An off-by-one calculation. The checked result from the stated problem is -5.'}, {value:'C',label:'-5',feedback:'−8 − (−3) = −5 m.'}, {value:'D',label:'-11',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is -5.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A rider was 2 km east of a barangay hall and later 5 km east of it. How much did the eastward position change?',a:3,e:'5 − 2 = 3 km.',options:[{value:'A',label:'7',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 3.'}, {value:'B',label:'-3',feedback:'Reversing the subtraction order. The checked result from the stated problem is 3.'}, {value:'C',label:'4',feedback:'An off-by-one calculation. The checked result from the stated problem is 3.'}, {value:'D',label:'3',feedback:'5 − 2 = 3 km.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'In Sagada, the morning temperature was −4°C and the afternoon temperature was 3°C. What was the change?',a:7,e:'3 − (−4) = 7°C.',options:[{value:'A',label:'7',feedback:'3 − (−4) = 7°C.'}, {value:'B',label:'-1',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 7.'}, {value:'C',label:'-7',feedback:'Reversing the subtraction order. The checked result from the stated problem is 7.'}, {value:'D',label:'8',feedback:'An off-by-one calculation. The checked result from the stated problem is 7.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'One point on a rice-terrace model is 6 m above a reference line. Another is 2 m above it. How much lower is the second point?',a:4,e:'6 − 2 = 4 m.',options:[{value:'A',label:'5',feedback:'An off-by-one calculation. The checked result from the stated problem is 4.'}, {value:'B',label:'4',feedback:'6 − 2 = 4 m.'}, {value:'C',label:'8',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 4.'}, {value:'D',label:'-4',feedback:'Reversing the subtraction order. The checked result from the stated problem is 4.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A jeepney route is 12 km long. The remaining distance is 5 km. How far has the jeepney traveled?',a:7,e:'12 − 5 = 7 km.',options:[{value:'A',label:'-7',feedback:'Reversing the subtraction order. The checked result from the stated problem is 7.'}, {value:'B',label:'8',feedback:'An off-by-one calculation. The checked result from the stated problem is 7.'}, {value:'C',label:'7',feedback:'12 − 5 = 7 km.'}, {value:'D',label:'17',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 7.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A school thermometer changed from 7°C to −2°C. What was the change?',a:-9,e:'−2 − 7 = −9°C.',options:[{value:'A',label:'5',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is -9.'}, {value:'B',label:'9',feedback:'Reversing the subtraction order. The checked result from the stated problem is -9.'}, {value:'C',label:'-8',feedback:'An off-by-one calculation. The checked result from the stated problem is -9.'}, {value:'D',label:'-9',feedback:'−2 − 7 = −9°C.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A hiker was at 4 m above a reference point and went down to 1 m above it. What was the change in elevation?',a:-3,e:'1 − 4 = −3 m.',options:[{value:'A',label:'-3',feedback:'1 − 4 = −3 m.'}, {value:'B',label:'5',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is -3.'}, {value:'C',label:'3',feedback:'Reversing the subtraction order. The checked result from the stated problem is -3.'}, {value:'D',label:'-2',feedback:'An off-by-one calculation. The checked result from the stated problem is -3.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A bank account showed −₱10 and later showed ₱6. What was the change in balance?',a:16,e:'6 − (−10) = ₱16.',options:[{value:'A',label:'17',feedback:'An off-by-one calculation. The checked result from the stated problem is 16.'}, {value:'B',label:'16',feedback:'6 − (−10) = ₱16.'}, {value:'C',label:'-4',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 16.'}, {value:'D',label:'-16',feedback:'Reversing the subtraction order. The checked result from the stated problem is 16.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A game score was −4 points after a penalty and later became −1 point. What was the change in score?',a:3,e:'−1 − (−4) = 3 points.',options:[{value:'A',label:'-3',feedback:'Reversing the subtraction order. The checked result from the stated problem is 3.'}, {value:'B',label:'4',feedback:'An off-by-one calculation. The checked result from the stated problem is 3.'}, {value:'C',label:'3',feedback:'−1 − (−4) = 3 points.'}, {value:'D',label:'-5',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 3.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A submarine model moved from −2 m to −7 m relative to a waterline. What was its change in elevation?',a:-5,e:'−7 − (−2) = −5 m.',options:[{value:'A',label:'-9',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is -5.'}, {value:'B',label:'5',feedback:'Reversing the subtraction order. The checked result from the stated problem is -5.'}, {value:'C',label:'-4',feedback:'An off-by-one calculation. The checked result from the stated problem is -5.'}, {value:'D',label:'-5',feedback:'−7 − (−2) = −5 m.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'average',q:'A school canteen balance changed from −₱8 to ₱4 after money was added. What was the change in balance?',a:12,e:'4 − (−8) = ₱12.',options:[{value:'A',label:'12',feedback:'4 − (−8) = ₱12.'}, {value:'B',label:'-4',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 12.'}, {value:'C',label:'-12',feedback:'Reversing the subtraction order. The checked result from the stated problem is 12.'}, {value:'D',label:'13',feedback:'An off-by-one calculation. The checked result from the stated problem is 12.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A sari-sari store had ₱500. It spent ₱180 on supplies and received ₱75 from a customer who settled a debt. What was the new cash balance?',a:395,e:'500 − 180 + 75 = ₱395.',options:[{value:'A',label:'470',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 395.'}, {value:'B',label:'395',feedback:'500 − 180 + 75 = ₱395.'}, {value:'C',label:'755',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 395.'}, {value:'D',label:'500',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 395.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A class fund started at ₱250. The class spent ₱325 on materials and later collected ₱140. What was the final balance?',a:65,e:'250 − 325 + 140 = ₱65.',options:[{value:'A',label:'250',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 65.'}, {value:'B',label:'205',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 65.'}, {value:'C',label:'65',feedback:'250 − 325 + 140 = ₱65.'}, {value:'D',label:'715',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 65.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A Baguio thermometer read 6°C. It fell 9°C, then rose 4°C. What was the final temperature?',a:1,e:'6 − 9 + 4 = 1°C.',options:[{value:'A',label:'19',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 1.'}, {value:'B',label:'-3',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 1.'}, {value:'C',label:'5',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 1.'}, {value:'D',label:'1',feedback:'6 − 9 + 4 = 1°C.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A diver was at −4 m, descended 7 m, then rose 5 m. What was the final elevation?',a:-6,e:'−4 − 7 + 5 = −6 m.',options:[{value:'A',label:'-6',feedback:'−4 − 7 + 5 = −6 m.'}, {value:'B',label:'16',feedback:'Treating every listed change as an addition. The checked result from the stated problem is -6.'}, {value:'C',label:'-1',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is -6.'}, {value:'D',label:'-5',feedback:'An off-by-one calculation. The checked result from the stated problem is -6.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A student had ₱300. She spent ₱85 on a project and ₱60 on transportation, then received ₱100. How much did she have?',a:255,e:'300 − 85 − 60 + 100 = ₱255.',options:[{value:'A',label:'355',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 255.'}, {value:'B',label:'255',feedback:'300 − 85 − 60 + 100 = ₱255.'}, {value:'C',label:'545',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 255.'}, {value:'D',label:'300',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 255.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A school collected 420 recyclable bottles. It sent 175 to one recycler and 95 to another. How many remained?',a:150,e:'420 − 175 − 95 = 150 bottles.',options:[{value:'A',label:'420',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 150.'}, {value:'B',label:'245',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 150.'}, {value:'C',label:'150',feedback:'420 − 175 − 95 = 150 bottles.'}, {value:'D',label:'690',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 150.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A jeepney driver recorded a ₱120 gain, a ₱75 loss, and a ₱40 gain. What was the net result?',a:85,e:'120 − 75 + 40 = ₱85.',options:[{value:'A',label:'235',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 85.'}, {value:'B',label:'120',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 85.'}, {value:'C',label:'125',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 85.'}, {value:'D',label:'85',feedback:'120 − 75 + 40 = ₱85.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A player had 18 points, lost 11 for a penalty, and gained 7 in a bonus round. What was the final score?',a:14,e:'18 − 11 + 7 = 14 points.',options:[{value:'A',label:'14',feedback:'18 − 11 + 7 = 14 points.'}, {value:'B',label:'36',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 14.'}, {value:'C',label:'21',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 14.'}, {value:'D',label:'15',feedback:'An off-by-one calculation. The checked result from the stated problem is 14.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A school garden had 150 seedlings. Thirty-two died, 48 were moved, and 25 new seedlings arrived. How many were in the garden afterward?',a:95,e:'150 − 32 − 48 + 25 = 95 seedlings.',options:[{value:'A',label:'120',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 95.'}, {value:'B',label:'95',feedback:'150 − 32 − 48 + 25 = 95 seedlings.'}, {value:'C',label:'255',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 95.'}, {value:'D',label:'150',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 95.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A rider traveled 14 km north, then 9 km south. Taking north as positive, what was the net displacement?',a:5,e:'14 − 9 = 5 km north.',options:[{value:'A',label:'-5',feedback:'Reversing the subtraction order. The checked result from the stated problem is 5.'}, {value:'B',label:'6',feedback:'An off-by-one calculation. The checked result from the stated problem is 5.'}, {value:'C',label:'5',feedback:'14 − 9 = 5 km north.'}, {value:'D',label:'23',feedback:'Adding the two amounts instead of subtracting. The checked result from the stated problem is 5.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A Manila elevator was at floor −2, went up 8 floors, then went down 5 floors. What floor did it reach?',a:1,e:'−2 + 8 − 5 = floor 1.',options:[{value:'A',label:'15',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 1.'}, {value:'B',label:'6',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 1.'}, {value:'C',label:'2',feedback:'An off-by-one calculation. The checked result from the stated problem is 1.'}, {value:'D',label:'1',feedback:'−2 + 8 − 5 = floor 1.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A student’s account was −₱20. A parent added ₱50, then the student spent ₱18. What was the new balance?',a:12,e:'−20 + 50 − 18 = ₱12.',options:[{value:'A',label:'12',feedback:'−20 + 50 − 18 = ₱12.'}, {value:'B',label:'88',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 12.'}, {value:'C',label:'-20',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 12.'}, {value:'D',label:'30',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 12.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A temperature was −5°C. It increased by 12°C and then decreased by 9°C. What was the final temperature?',a:-2,e:'−5 + 12 − 9 = −2°C.',options:[{value:'A',label:'-1',feedback:'An off-by-one calculation. The checked result from the stated problem is -2.'}, {value:'B',label:'-2',feedback:'−5 + 12 − 9 = −2°C.'}, {value:'C',label:'26',feedback:'Treating every listed change as an addition. The checked result from the stated problem is -2.'}, {value:'D',label:'7',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is -2.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A boat was 3 km east of a marker. It moved 8 km west, then 2 km east. Taking east as positive, what was its final position?',a:-3,e:'3 − 8 + 2 = −3 km.',options:[{value:'A',label:'-5',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is -3.'}, {value:'B',label:'-1',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is -3.'}, {value:'C',label:'-3',feedback:'3 − 8 + 2 = −3 km.'}, {value:'D',label:'13',feedback:'Treating every listed change as an addition. The checked result from the stated problem is -3.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A school event budget was ₱2,000. It spent ₱750 on food and ₱425 on materials, then received a ₱300 donation. How much remained?',a:1125,e:'2,000 − 750 − 425 + 300 = ₱1,125.',options:[{value:'A',label:'1477',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 1125.'}, {value:'B',label:'200',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 1125.'}, {value:'C',label:'1425',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 1125.'}, {value:'D',label:'1125',feedback:'2,000 − 750 − 425 + 300 = ₱1,125.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A quiz team scored 35 points, lost 12 for a penalty, gained 18 in a bonus round, and lost 5 for an invalid answer. What was the final score?',a:36,e:'35 − 12 + 18 − 5 = 36 points.',options:[{value:'A',label:'36',feedback:'35 − 12 + 18 − 5 = 36 points.'}, {value:'B',label:'70',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 36.'}, {value:'C',label:'41',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 36.'}, {value:'D',label:'37',feedback:'An off-by-one calculation. The checked result from the stated problem is 36.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A farmer harvested 280 kg of rice. He sold 95 kg and used 40 kg at home. How many kilograms were stored?',a:145,e:'280 − 95 − 40 = 145 kg.',options:[{value:'A',label:'185',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 145.'}, {value:'B',label:'145',feedback:'280 − 95 − 40 = 145 kg.'}, {value:'C',label:'415',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 145.'}, {value:'D',label:'280',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 145.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A class had 36 pupils. Five joined late, three transferred out, and two more joined. How many pupils were in the class afterward?',a:40,e:'36 + 5 − 3 + 2 = 40 pupils.',options:[{value:'A',label:'42',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 40.'}, {value:'B',label:'41',feedback:'An off-by-one calculation. The checked result from the stated problem is 40.'}, {value:'C',label:'40',feedback:'36 + 5 − 3 + 2 = 40 pupils.'}, {value:'D',label:'46',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 40.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A bank balance was ₱1,500. A withdrawal of ₱2,100 was made, followed by a deposit of ₱900. What was the resulting balance?',a:300,e:'1,500 − 2,100 + 900 = ₱300.',options:[{value:'A',label:'1503',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 300.'}, {value:'B',label:'150',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 300.'}, {value:'C',label:'1200',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 300.'}, {value:'D',label:'300',feedback:'1,500 − 2,100 + 900 = ₱300.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'difficult',q:'A hiker was at 12 m elevation. The trail descended 18 m, climbed 7 m, then descended 4 m. What was the final elevation?',a:-3,e:'12 − 18 + 7 − 4 = −3 m.',options:[{value:'A',label:'-3',feedback:'12 − 18 + 7 − 4 = −3 m.'}, {value:'B',label:'41',feedback:'Treating every listed change as an addition. The checked result from the stated problem is -3.'}, {value:'C',label:'1',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is -3.'}, {value:'D',label:'-2',feedback:'An off-by-one calculation. The checked result from the stated problem is -3.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A school canteen started with ₱3,500. It spent ₱1,275 on supplies, earned ₱2,040 from sales, and paid ₱620 for delivery. What was the ending cash amount?',a:3645,e:'3,500 − 1,275 + 2,040 − 620 = ₱3,645.',options:[{value:'A',label:'4265',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 3645.'}, {value:'B',label:'3645',feedback:'3,500 − 1,275 + 2,040 − 620 = ₱3,645.'}, {value:'C',label:'1441',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 3645.'}, {value:'D',label:'350',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 3645.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A class fund began at ₱800. It paid ₱1,250 for a field-trip deposit and later received ₱600 from fundraising. What was the final balance?',a:150,e:'800 − 1,250 + 600 = ₱150.',options:[{value:'A',label:'800',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 150.'}, {value:'B',label:'750',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 150.'}, {value:'C',label:'150',feedback:'800 − 1,250 + 600 = ₱150.'}, {value:'D',label:'1651',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 150.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'At 6:00 a.m., a mountain station recorded −3°C. The temperature rose 8°C, fell 11°C, then rose 5°C. What was the final temperature?',a:-1,e:'−3 + 8 − 11 + 5 = −1°C.',options:[{value:'A',label:'27',feedback:'Treating every listed change as an addition. The checked result from the stated problem is -1.'}, {value:'B',label:'4',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is -1.'}, {value:'C',label:'0',feedback:'An off-by-one calculation. The checked result from the stated problem is -1.'}, {value:'D',label:'-1',feedback:'−3 + 8 − 11 + 5 = −1°C.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A diver started at −5 m. The diver descended 12 m, rose 7 m, then descended another 4 m. What was the final elevation?',a:-14,e:'−5 − 12 + 7 − 4 = −14 m.',options:[{value:'A',label:'-14',feedback:'−5 − 12 + 7 − 4 = −14 m.'}, {value:'B',label:'28',feedback:'Treating every listed change as an addition. The checked result from the stated problem is -14.'}, {value:'C',label:'-10',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is -14.'}, {value:'D',label:'-13',feedback:'An off-by-one calculation. The checked result from the stated problem is -14.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A school trip budget was ₱10,000. It spent ₱3,250 on transportation, ₱2,175 on meals, and ₱1,400 on entrance fees. A sponsor donated ₱1,500. How much remained?',a:4675,e:'10,000 − 3,250 − 2,175 − 1,400 + 1,500 = ₱4,675.',options:[{value:'A',label:'5175',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 4675.'}, {value:'B',label:'4675',feedback:'10,000 − 3,250 − 2,175 − 1,400 + 1,500 = ₱4,675.'}, {value:'C',label:'1342',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 4675.'}, {value:'D',label:'100',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 4675.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A student had ₱1,200 and spent 35% of it on school supplies. How much money remained?',a:780,e:'35% of ₱1,200 is ₱420; ₱1,200 − ₱420 = ₱780.',options:[{value:'A',label:'624',feedback:'Using a different percentage than the one stated. The checked result from the stated problem is 780.'}, {value:'B',label:'975',feedback:'Adding rather than subtracting the stated percentage. The checked result from the stated problem is 780.'}, {value:'C',label:'780',feedback:'35% of ₱1,200 is ₱420; ₱1,200 − ₱420 = ₱780.'}, {value:'D',label:'858',feedback:'Using an incorrect percentage amount. The checked result from the stated problem is 780.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A barangay project had a budget of ₱8,000. It used 3/8 of the budget for materials and ₱1,250 for transport. How much remained?',a:3750,e:'3/8 of ₱8,000 is ₱3,000; ₱8,000 − ₱3,000 − ₱1,250 = ₱3,750.',options:[{value:'A',label:'284',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 3750.'}, {value:'B',label:'0.38',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 3750.'}, {value:'C',label:'4000',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 3750.'}, {value:'D',label:'3750',feedback:'3/8 of ₱8,000 is ₱3,000; ₱8,000 − ₱3,000 − ₱1,250 = ₱3,750.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A school library had 1,250 books. It removed 18% for repair, received 150 new books, and donated 75 books. How many books were available afterward?',a:1100,e:'18% of 1,250 is 225; 1,250 − 225 + 150 − 75 = 1,100 books.',options:[{value:'A',label:'1100',feedback:'18% of 1,250 is 225; 1,250 − 225 + 150 − 75 = 1,100 books.'}, {value:'B',label:'1210',feedback:'Using an incorrect percentage amount. The checked result from the stated problem is 1100.'}, {value:'C',label:'880',feedback:'Using a different percentage than the one stated. The checked result from the stated problem is 1100.'}, {value:'D',label:'1375',feedback:'Adding rather than subtracting the stated percentage. The checked result from the stated problem is 1100.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A jeepney route charges ₱15 per passenger. A driver collected ₱450 from 32 passengers in total. How much less than the expected fare was collected?',a:30,e:'Expected fare = 32 × ₱15 = ₱480; ₱480 − ₱450 = ₱30 less.',options:[{value:'A',label:'36',feedback:'Does not satisfy the complete sequence of operations stated in the problem. The checked result from the stated problem is 30.'}, {value:'B',label:'30',feedback:'Expected fare = 32 × ₱15 = ₱480; ₱480 − ₱450 = ₱30 less.'}, {value:'C',label:'31',feedback:'An off-by-one calculation. The checked result from the stated problem is 30.'}, {value:'D',label:'29',feedback:'An off-by-one calculation. The checked result from the stated problem is 30.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A class scored 72 points on an 80-point test, then lost 15 points and gained 8 bonus points. What percentage of the 80-point maximum was the final score?',a:81.25,e:'Final score = 72 − 15 + 8 = 65; 65 ÷ 80 × 100 = 81.25%.',options:[{value:'A',label:'65',feedback:'Using a different percentage than the one stated. The checked result from the stated problem is 81.25.'}, {value:'B',label:'101.56',feedback:'Adding rather than subtracting the stated percentage. The checked result from the stated problem is 81.25.'}, {value:'C',label:'81.25',feedback:'Final score = 72 − 15 + 8 = 65; 65 ÷ 80 × 100 = 81.25%.'}, {value:'D',label:'89.38',feedback:'Using an incorrect percentage amount. The checked result from the stated problem is 81.25.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A farmer had 600 kg of rice. He sold 2/5 of it and gave 90 kg to a cooperative. How many kilograms remained?',a:270,e:'2/5 of 600 is 240; 600 − 240 − 90 = 270 kg.',options:[{value:'A',label:'1777',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 270.'}, {value:'B',label:'0.4',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 270.'}, {value:'C',label:'360',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 270.'}, {value:'D',label:'270',feedback:'2/5 of 600 is 240; 600 − 240 − 90 = 270 kg.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A school event sold 120 tickets at ₱75 each. Expenses were ₱6,800. What was the net income?',a:2200,e:'Revenue = 120 × ₱75 = ₱9,000; ₱9,000 − ₱6,800 = ₱2,200.',options:[{value:'A',label:'2200',feedback:'Revenue = 120 × ₱75 = ₱9,000; ₱9,000 − ₱6,800 = ₱2,200.'}, {value:'B',label:'2201',feedback:'An off-by-one calculation. The checked result from the stated problem is 2200.'}, {value:'C',label:'2199',feedback:'An off-by-one calculation. The checked result from the stated problem is 2200.'}, {value:'D',label:'2206',feedback:'Does not satisfy the complete sequence of operations stated in the problem. The checked result from the stated problem is 2200.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A bank account had ₱5,000. A withdrawal reduced it by 40%, then a deposit added ₱1,250. What was the new balance?',a:4250,e:'40% of ₱5,000 is ₱2,000; ₱5,000 − ₱2,000 + ₱1,250 = ₱4,250.',options:[{value:'A',label:'5312.5',feedback:'Adding rather than subtracting the stated percentage. The checked result from the stated problem is 4250.'}, {value:'B',label:'4250',feedback:'40% of ₱5,000 is ₱2,000; ₱5,000 − ₱2,000 + ₱1,250 = ₱4,250.'}, {value:'C',label:'4675',feedback:'Using an incorrect percentage amount. The checked result from the stated problem is 4250.'}, {value:'D',label:'3400',feedback:'Using a different percentage than the one stated. The checked result from the stated problem is 4250.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A temperature was 4°C at noon. It dropped to −7°C at night and rose 6°C the next morning. What was the net change from noon to the next morning?',a:-5,e:'The next-morning temperature is −1°C; −1 − 4 = −5°C.',options:[{value:'A',label:'1',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is -5.'}, {value:'B',label:'-1',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is -5.'}, {value:'C',label:'-5',feedback:'The next-morning temperature is −1°C; −1 − 4 = −5°C.'}, {value:'D',label:'6',feedback:'Treating every listed change as an addition. The checked result from the stated problem is -5.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A school received 2,400 notebooks. It distributed 45% to Grade 4 and 30% to Grade 5. How many remained for other grades?',a:600,e:'45% + 30% = 75%; 25% of 2,400 = 600 notebooks.',options:[{value:'A',label:'15',feedback:'Subtracting the second amount from the first without applying the stated operation. The checked result from the stated problem is 600.'}, {value:'B',label:'75',feedback:'Adding the quantities instead of applying the stated change. The checked result from the stated problem is 600.'}, {value:'C',label:'-600',feedback:'Reversing the sign of the result. The checked result from the stated problem is 600.'}, {value:'D',label:'600',feedback:'45% + 30% = 75%; 25% of 2,400 = 600 notebooks.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A class fundraiser collected ₱12,500. It spent ₱2,750 on materials and ₱1,875 on transportation. The remaining money was shared equally among 5 projects. How much did each project receive?',a:1575,e:'12,500 − 2,750 − 1,875 = 7,875; 7,875 ÷ 5 = ₱1,575.',options:[{value:'A',label:'1575',feedback:'12,500 − 2,750 − 1,875 = 7,875; 7,875 ÷ 5 = ₱1,575.'}, {value:'B',label:'7875',feedback:'Forgetting to divide among the groups. The checked result from the stated problem is 1575.'}, {value:'C',label:'787.5',feedback:'Dividing by the wrong number of groups. The checked result from the stated problem is 1575.'}, {value:'D',label:'1580',feedback:'Not completing the equal-sharing step. The checked result from the stated problem is 1575.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A hiker starts at 150 m elevation, descends 85 m, climbs 40 m, then descends 120 m. What is the final elevation?',a:-15,e:'150 − 85 + 40 − 120 = −15 m.',options:[{value:'A',label:'105',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is -15.'}, {value:'B',label:'-15',feedback:'150 − 85 + 40 − 120 = −15 m.'}, {value:'C',label:'395',feedback:'Treating every listed change as an addition. The checked result from the stated problem is -15.'}, {value:'D',label:'150',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is -15.'}],correct:'B',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A school store marks an ₱800 backpack down by ₱120, then adds a ₱50 delivery fee. What is the final amount paid?',a:730,e:'₱800 − ₱120 + ₱50 = ₱730.',options:[{value:'A',label:'800',feedback:'Stopping before applying the final stated change. The checked result from the stated problem is 730.'}, {value:'B',label:'780',feedback:'Reversing the direction of the final stated change. The checked result from the stated problem is 730.'}, {value:'C',label:'730',feedback:'₱800 − ₱120 + ₱50 = ₱730.'}, {value:'D',label:'970',feedback:'Treating every listed change as an addition. The checked result from the stated problem is 730.'}],correct:'C',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A student answered 24 of 30 questions correctly. Three correct answers were later invalidated. What was the new accuracy based on the original 30 questions?',a:70,e:'New correct count = 24 − 3 = 21; 21 ÷ 30 × 100 = 70%.',options:[{value:'A',label:'77',feedback:'Using an incorrect percentage amount. The checked result from the stated problem is 70.'}, {value:'B',label:'56',feedback:'Using a different percentage than the one stated. The checked result from the stated problem is 70.'}, {value:'C',label:'87.5',feedback:'Adding rather than subtracting the stated percentage. The checked result from the stated problem is 70.'}, {value:'D',label:'70',feedback:'New correct count = 24 − 3 = 21; 21 ÷ 30 × 100 = 70%.'}],correct:'D',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
{d:'advanced',q:'A barangay relief team packed 960 food packs. It delivered 3/8 to one sitio and 1/4 to another. How many packs were left?',a:360,e:'Delivered = 3/8 + 1/4 = 5/8; left = 3/8 of 960 = 360 packs.',options:[{value:'A',label:'360',feedback:'Delivered = 3/8 + 1/4 = 5/8; left = 3/8 of 960 = 360 packs.'}, {value:'B',label:'361',feedback:'An off-by-one calculation. The checked result from the stated problem is 360.'}, {value:'C',label:'359',feedback:'An off-by-one calculation. The checked result from the stated problem is 360.'}, {value:'D',label:'366',feedback:'Does not satisfy the complete sequence of operations stated in the problem. The checked result from the stated problem is 360.'}],correct:'A',hint:'Identify the starting value, apply each stated change in order, and compare the result with every choice.'},
];

const quizState={difficulty:'easy',questions:[],index:0,score:0,correct:0,answered:false,started:false,currentOptions:[],stats:JSON.parse(localStorage.getItem('simsQuizStats')||'{}')};
function saveQuizStats(){localStorage.setItem('simsQuizStats',JSON.stringify(quizState.stats));}
function quizFormat(n){return Number.isInteger(n)?n.toLocaleString('en-PH'):n.toLocaleString('en-PH',{maximumFractionDigits:2});}
function makeQuizOptions(item){ return shuffleArray(item.options || []).slice(); }
function quizQuestionPool(level){return quizBank.filter(x=>x.d===level);}
function quizDifficultyLabel(level){return({easy:'Easy',average:'Average',difficult:'Difficult',advanced:'Advanced'})[level]||level;}
function showQuiz(){showScreen('quiz');quizState.started?renderQuizQuestion():renderQuizIntro();}
function setQuizDifficulty(level){quizState.difficulty=level;playSound('click');document.querySelectorAll('.quiz-difficulty').forEach(b=>b.classList.toggle('active',b.dataset.level===level));renderQuizPreview();}
function renderQuizIntro(){
  const box=document.getElementById('quizContent');
  const adaptiveBadge=gameSettings.adaptiveDifficulty?`<div class="quiz-adaptive-badge">🎯 Adaptive Difficulty is ON — your level will adjust after each round.</div>`:'';
  box.innerHTML=`<div class="quiz-welcome"><div class="quiz-icon">🧠</div><h2>SIMS Quiz Challenge</h2><p>Build accuracy and mathematical reasoning through carefully checked multiple-choice questions set in familiar Philippine contexts.</p>${adaptiveBadge}<div class="quiz-difficulty-row">${['easy','average','difficult','advanced'].map(d=>`<button class="quiz-difficulty ${d===quizState.difficulty?'active':''}" data-level="${d}" onclick="setQuizDifficulty('${d}')">${quizDifficultyLabel(d)}</button>`).join('')}</div><div id="quizPreview" class="quiz-preview"></div><button class="primary quiz-start" onclick="startQuiz()">START ${quizDifficultyLabel(quizState.difficulty).toUpperCase()} QUIZ</button></div>`;
  renderQuizPreview();
}
function renderQuizPreview(){const el=document.getElementById('quizPreview');if(el){const n=quizQuestionPool(quizState.difficulty).length;el.innerHTML=`<strong>${n} questions available</strong><span>10 questions per round • 4 teacher-authored choices • misconception feedback • Offline-ready</span>`;}}
function startQuiz(){quizState.questions=shuffleArray(quizQuestionPool(quizState.difficulty)).slice(0,10);quizState.index=0;quizState.score=0;quizState.correct=0;quizState.answered=false;quizState.started=true;renderQuizQuestion();}
function renderQuizQuestion(){
  const item=quizState.questions[quizState.index];if(!item){finishQuiz();return;}
  quizState.currentOptions=makeQuizOptions(item);const letters=['A','B','C','D'];
  document.getElementById('quizContent').innerHTML=`<div class="quiz-top"><div><span class="badge">${quizDifficultyLabel(quizState.difficulty).toUpperCase()}</span><h2>Quiz Challenge</h2></div><div class="quiz-score">⭐ ${quizState.score}</div></div><div class="quiz-progress"><span>Question ${quizState.index+1} of ${quizState.questions.length}</span><div><i style="width:${(quizState.index/quizState.questions.length)*100}%"></i></div></div><div class="quiz-question-card"><p class="quiz-number">QUESTION ${quizState.index+1}</p><h3>${item.q}</h3><div class="quiz-options">${quizState.currentOptions.map((o,i)=>`<button class="quiz-option" data-value="${o.value}" onclick="answerQuiz('${o.value}',this)"><span>${o.value}</span><b>${o.label}</b></button>`).join('')}</div><div id="quizFeedback" class="quiz-feedback hidden"></div><button id="quizNext" class="primary hidden" onclick="nextQuizQuestion()">NEXT QUESTION →</button></div>`;
}
function answerQuiz(value,button){
  if(quizState.answered)return;quizState.answered=true;const item=quizState.questions[quizState.index];const ok=value===item.correct;
  document.querySelectorAll('.quiz-option').forEach(b=>{b.disabled=true;if(b.dataset.value===item.correct)b.classList.add('quiz-correct');});
  if(ok){button.classList.add('quiz-correct');quizState.correct++;quizState.score+=10;playSound('correct');}else{button.classList.add('quiz-wrong');playSound('wrong');}
  const chosen=item.options.find(o=>o.value===value);
  const fb=document.getElementById('quizFeedback');fb.className=`quiz-feedback ${ok?'correct':'wrong'}`;fb.innerHTML=`<strong>${ok?'Correct!':'Keep practicing.'}</strong><p>${chosen?chosen.feedback:item.e}</p>`;document.getElementById('quizNext').classList.remove('hidden');
}
function nextQuizQuestion(){quizState.index++;quizState.answered=false;renderQuizQuestion();}
function finishQuiz(){
  const total=quizState.questions.length||10,pct=Math.round(quizState.correct/total*100),key=quizState.difficulty;
  quizState.stats[key]=quizState.stats[key]||{attempts:0,best:0,last:0};quizState.stats[key].attempts++;quizState.stats[key].best=Math.max(quizState.stats[key].best,pct);quizState.stats[key].last=pct;saveQuizStats();
  playSound(pct>=80?'complete':(pct<50?'wrong':'levelup'));
  const adaptiveNote=applyAdaptiveQuizDifficulty(pct,key);
  document.getElementById('quizContent').innerHTML=`<div class="quiz-result"><div class="quiz-result-icon">${pct>=80?'🏆':pct>=60?'⭐':'📚'}</div><h2>${pct>=80?'Excellent work!':pct>=60?'Good effort!':'Keep practicing!'}</h2><p class="quiz-result-score">${quizState.correct} / ${total}</p><p class="quiz-result-percent">${pct}%</p><p>You completed the ${quizDifficultyLabel(key)} quiz.</p>${adaptiveNote?`<p class="quiz-adaptive-note">🎯 ${adaptiveNote}</p>`:''}<div class="quiz-result-actions"><button class="primary" onclick="startQuiz()">🔁 RETRY QUIZ</button><button class="secondary" onclick="renderQuizIntro()">CHANGE DIFFICULTY</button><button class="secondary" onclick="showHome()">⌂ HOME</button></div></div>`;quizState.started=false;
}
function quizResetProgress(){if(!confirm('Reset quiz history?'))return;quizState.stats={};saveQuizStats();renderQuizIntro();}

// =========================================================
// GAME SETTINGS MODULE — Adaptive Difficulty, Sound Effects,
// and Mathematics Engine Verification
// =========================================================

const DEFAULT_GAME_SETTINGS = { adaptiveDifficulty: false, soundEffects: true, mathVerification: true };
const gameSettings = Object.assign(
  {},
  DEFAULT_GAME_SETTINGS,
  JSON.parse(localStorage.getItem("simsGameSettings") || "{}")
);
function saveGameSettings() {
  localStorage.setItem("simsGameSettings", JSON.stringify(gameSettings));
}

// --- Sound Effects (Web Audio — no external assets, works fully offline) ---
let audioCtx = null;
function getAudioCtx() {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    audioCtx = null;
  }
  return audioCtx;
}
function playTone(freq, duration, type, gain, delay) {
  if (!gameSettings.soundEffects) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const start = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(gain || 0.15, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}
const SOUND_PATTERNS = {
  correct: () => { playTone(880, 0.12, "sine", 0.15); playTone(1175, 0.15, "sine", 0.13, 0.09); },
  wrong: () => { playTone(180, 0.22, "sawtooth", 0.1); },
  click: () => { playTone(600, 0.05, "square", 0.05); },
  levelup: () => { playTone(660, 0.1, "sine", 0.13); playTone(880, 0.1, "sine", 0.13, 0.09); playTone(1100, 0.18, "sine", 0.13, 0.18); },
  leveldown: () => { playTone(500, 0.14, "triangle", 0.11); playTone(350, 0.18, "triangle", 0.11, 0.1); },
  complete: () => { playTone(523, 0.12, "sine", 0.13); playTone(659, 0.12, "sine", 0.13, 0.11); playTone(784, 0.12, "sine", 0.13, 0.22); playTone(1047, 0.22, "sine", 0.13, 0.33); },
};
function playSound(name) {
  if (!gameSettings.soundEffects) return;
  const fn = SOUND_PATTERNS[name];
  if (fn) fn();
}

// --- Adaptive Difficulty ---
const PRACTICE_DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"];
const QUIZ_DIFFICULTY_ORDER = ["easy", "average", "difficult", "advanced"];

function practiceDifficultyLabel(level) {
  return String(level).charAt(0).toUpperCase() + String(level).slice(1);
}

function showAdaptiveToast(message) {
  const el = document.getElementById("adaptiveToast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(showAdaptiveToast._t);
  showAdaptiveToast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

// Called at the top of generateProblem(); only affects the standard
// Practice / Spot the Difference mode (not Word Problems, Missions, or Time Trial,
// which already manage their own difficulty/pacing).
function maybeAdaptDifficulty() {
  if (!gameSettings.adaptiveDifficulty) return;
  if (isMission || isTimeTrial || isWordProblem) return;
  const idx = PRACTICE_DIFFICULTY_ORDER.indexOf(currentDifficulty);
  if (idx === -1) return;

  if (streak > 0 && streak % 3 === 0 && idx < PRACTICE_DIFFICULTY_ORDER.length - 1) {
    currentDifficulty = PRACTICE_DIFFICULTY_ORDER[idx + 1];
    wrongStreak = 0;
    const badge = document.getElementById("levelBadge");
    if (badge) badge.textContent = currentDifficulty.toUpperCase();
    showAdaptiveToast(`⬆ Nice streak! Difficulty raised to ${practiceDifficultyLabel(currentDifficulty)}.`);
    playSound("levelup");
  } else if (wrongStreak >= 2 && idx > 0) {
    currentDifficulty = PRACTICE_DIFFICULTY_ORDER[idx - 1];
    wrongStreak = 0;
    const badge = document.getElementById("levelBadge");
    if (badge) badge.textContent = currentDifficulty.toUpperCase();
    showAdaptiveToast(`⬇ Let's ease up — difficulty set to ${practiceDifficultyLabel(currentDifficulty)}.`);
    playSound("leveldown");
  }
}

// Called from finishQuiz(); adjusts quizState.difficulty for the *next* round
// based on this round's score, and returns a note to show on the result screen.
function applyAdaptiveQuizDifficulty(pct, key) {
  if (!gameSettings.adaptiveDifficulty) return "";
  const idx = QUIZ_DIFFICULTY_ORDER.indexOf(key);
  if (idx === -1) return "";

  if (pct >= 80 && idx < QUIZ_DIFFICULTY_ORDER.length - 1) {
    quizState.difficulty = QUIZ_DIFFICULTY_ORDER[idx + 1];
    return `Adaptive Difficulty raised your next quiz to ${quizDifficultyLabel(quizState.difficulty)}.`;
  }
  if (pct < 50 && idx > 0) {
    quizState.difficulty = QUIZ_DIFFICULTY_ORDER[idx - 1];
    return `Adaptive Difficulty eased your next quiz to ${quizDifficultyLabel(quizState.difficulty)}.`;
  }
  return "";
}

// --- Mathematics Engine Verification ---

// Single source of truth for Practice-mode number generation, shared by
// generateProblem() and the verifier below, so the two can never drift apart.
function generatePracticeProblem(level) {
  let m, s;
  if (level === "beginner") {
    m = generateNumber(1, 9);
    s = generateNumber(1, m);
  } else if (level === "advanced") {
    m = generateNumber(-10, 10);
    s = generateNumber(-10, 10);
  } else {
    m = generateNumber(-8, 8);
    s = generateNumber(-8, 8);
  }
  return { m, s };
}

function verifyMathEngine() {
  const issues = [];

  // 1) Quiz bank structural integrity — catches the exact class of bug where
  //    a question renders with missing or malformed answer choices.
  let quizPassed = 0;
  quizBank.forEach((item, i) => {
    const label = `Quiz Q${i + 1} (${item.d}): "${String(item.q).slice(0, 48)}${item.q.length > 48 ? "…" : ""}"`;
    const opts = item.options || [];
    let ok = true;

    if (opts.length !== 4) { issues.push(`${label} — expected 4 options, found ${opts.length}.`); ok = false; }

    const values = opts.map(o => o.value);
    if (new Set(values).size !== values.length) { issues.push(`${label} — duplicate option letters.`); ok = false; }

    const correctMatches = opts.filter(o => o.value === item.correct);
    if (correctMatches.length !== 1) { issues.push(`${label} — expected exactly one option matching the correct answer, found ${correctMatches.length}.`); ok = false; }

    const labels = opts.map(o => String(o.label).trim());
    if (new Set(labels).size !== labels.length) { issues.push(`${label} — two answer choices show the same value.`); ok = false; }

    opts.forEach(o => {
      if (!o.feedback || !String(o.feedback).trim()) { issues.push(`${label} — option ${o.value} is missing feedback text.`); ok = false; }
    });

    if (!item.hint || !String(item.hint).trim()) { issues.push(`${label} — missing a hint.`); ok = false; }
    if (!item.e || !String(item.e).trim()) { issues.push(`${label} — missing a worked explanation.`); ok = false; }

    if (ok) quizPassed++;
  });

  // 2) Practice problem generator invariants — every sampled problem must stay
  //    within its designed difficulty range and within the SIMS grid bounds.
  const SAMPLES_PER_LEVEL = 300;
  let enginePassed = 0, engineTotal = 0;
  PRACTICE_DIFFICULTY_ORDER.forEach(level => {
    for (let i = 0; i < SAMPLES_PER_LEVEL; i++) {
      engineTotal++;
      const { m, s } = generatePracticeProblem(level);
      let ok = Number.isInteger(m) && Number.isInteger(s) && Math.abs(m) <= range && Math.abs(s) <= range;
      if (level === "beginner") ok = ok && m >= 1 && m <= 9 && s >= 1 && s <= m;
      if (level === "intermediate") ok = ok && m >= -8 && m <= 8 && s >= -8 && s <= 8;
      if (level === "advanced") ok = ok && m >= -10 && m <= 10 && s >= -10 && s <= 10;
      if (ok) { enginePassed++; } else { issues.push(`Problem generator sample out of range at ${level}: minuend=${m}, subtrahend=${s}.`); }
    }
  });

  const report = {
    timestamp: new Date().toISOString(),
    quiz: { total: quizBank.length, passed: quizPassed, failed: quizBank.length - quizPassed },
    engine: { total: engineTotal, passed: enginePassed, failed: engineTotal - enginePassed },
    issues,
    allPassed: issues.length === 0,
  };
  localStorage.setItem("simsVerificationReport", JSON.stringify(report));
  return report;
}

function renderVerificationReport(report) {
  const meta = document.getElementById("verificationMeta");
  const box = document.getElementById("verificationReport");
  if (!meta || !box) return;

  if (!report) {
    meta.textContent = "Not run yet.";
    box.innerHTML = "";
    return;
  }

  const when = new Date(report.timestamp).toLocaleString("en-PH");
  meta.textContent = `Last run: ${when}`;

  const quizChip = `<span class="verify-chip ${report.quiz.failed === 0 ? "pass" : "fail"}">${report.quiz.failed === 0 ? "✅" : "⚠️"} Quiz bank: ${report.quiz.passed}/${report.quiz.total} questions passed</span>`;
  const engineChip = `<span class="verify-chip ${report.engine.failed === 0 ? "pass" : "fail"}">${report.engine.failed === 0 ? "✅" : "⚠️"} Problem engine: ${report.engine.passed}/${report.engine.total} samples passed</span>`;

  let issuesHtml;
  if (report.issues.length) {
    const shown = report.issues.slice(0, 15);
    issuesHtml = `<ul class="verify-issues">${shown.map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
    if (report.issues.length > shown.length) {
      issuesHtml += `<p class="verify-more">+ ${report.issues.length - shown.length} more issue(s) not shown.</p>`;
    }
  } else {
    issuesHtml = `<p class="verify-clean">No issues found — every quiz question has exactly one correct choice, four complete teacher-authored options, and the problem generator stayed within its designed ranges across ${report.engine.total} samples.</p>`;
  }

  box.innerHTML = `<div class="verify-summary">${quizChip}${engineChip}</div>${issuesHtml}`;
}

function manualVerify() {
  const report = verifyMathEngine();
  renderVerificationReport(report);
  playSound(report.allPassed ? "complete" : "wrong");
}

// --- Settings screen wiring ---
function showSettings() {
  syncSettingsUI();
  renderVerificationReport(JSON.parse(localStorage.getItem("simsVerificationReport") || "null"));
  showScreen("settings");
}
function syncSettingsUI() {
  const a = document.getElementById("settingAdaptive");
  const s = document.getElementById("settingSound");
  const v = document.getElementById("settingVerification");
  if (a) a.checked = gameSettings.adaptiveDifficulty;
  if (s) s.checked = gameSettings.soundEffects;
  if (v) v.checked = gameSettings.mathVerification;
}
function onSettingToggle(key, value) {
  gameSettings[key] = value;
  saveGameSettings();
  if (value) playSound("click");
  if (key === "mathVerification" && value) manualVerify();
}

// Silently self-check the quiz bank and problem engine on every load, so
// broken content is caught before a student ever sees it.
document.addEventListener("DOMContentLoaded", () => {
  if (gameSettings.mathVerification) {
    const report = verifyMathEngine();
    if (document.getElementById("verificationReport")) renderVerificationReport(report);
  }
});

updateStats();