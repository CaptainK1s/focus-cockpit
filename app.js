const state = {
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  running: false,
  interval: null,
  sessions: 0,
  minutesDone: 0,
  streak: 0,
  currentSound: null,
  audioContext: null,
  audioNodes: [],
  beatTimer: null,
  tasks: []
};

const $ = (selector) => document.querySelector(selector);
const ring = $("#progressRing");
const circumference = 2 * Math.PI * 101;

ring.style.strokeDasharray = circumference;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function updateClock() {
  $("#clock").textContent = new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date());
}

function renderTimer() {
  $("#time").textContent = formatTime(state.remainingSeconds);
  const progress = 1 - state.remainingSeconds / state.totalSeconds;
  ring.style.strokeDashoffset = circumference * progress;
  $("#progressBar").style.width = `${Math.round(progress * 100)}%`;
  $("#progressPercent").textContent = `${Math.round(progress * 100)}%`;
  document.title = `${formatTime(state.remainingSeconds)} - Focus Cockpit`;
}

function setTimerMinutes(minutes, label = "Deep Work") {
  state.totalSeconds = minutes * 60;
  state.remainingSeconds = state.totalSeconds;
  $("#minutes").value = minutes;
  $("#minutesOutput").textContent = `${minutes} min`;
  $("#modeTitle").textContent = label;
  $("#timerHint").textContent = "Ready when you are";
  renderTimer();
}

function stopTimer() {
  clearInterval(state.interval);
  state.interval = null;
  state.running = false;
  $("#startPause").textContent = "Start";
  $("#energyLabel").textContent = state.currentSound === "rave" ? "Rave" : "Standby";
}

function completeSession() {
  stopTimer();
  state.sessions += 1;
  state.streak += 1;
  state.minutesDone += Math.round(state.totalSeconds / 60);
  $("#timerHint").textContent = "Session complete";
  renderStats();
  saveState();
}

function tick() {
  state.remainingSeconds -= 1;
  if (state.remainingSeconds <= 0) {
    state.remainingSeconds = 0;
    renderTimer();
    completeSession();
    chime();
    return;
  }
  renderTimer();
}

function toggleTimer() {
  if (state.running) {
    stopTimer();
    $("#timerHint").textContent = "Paused";
    return;
  }

  state.running = true;
  $("#startPause").textContent = "Pause";
  $("#timerHint").textContent = "In the pocket";
  $("#energyLabel").textContent = "Active";
  state.interval = setInterval(tick, 1000);
}

function renderStats() {
  $("#sessions").textContent = state.sessions;
  $("#minutesDone").textContent = state.minutesDone;
  $("#streak").textContent = state.streak;
}

function renderTasks() {
  const list = $("#tasks");
  list.innerHTML = "";
  state.tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task${task.done ? " is-done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      renderTasks();
      saveState();
    });

    const label = document.createElement("span");
    label.textContent = task.title;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "x";
    remove.setAttribute("aria-label", `Remove ${task.title}`);
    remove.addEventListener("click", () => {
      state.tasks = state.tasks.filter((candidate) => candidate.id !== task.id);
      renderTasks();
      saveState();
    });

    item.append(checkbox, label, remove);
    list.append(item);
  });

  const open = state.tasks.filter((task) => !task.done).length;
  $("#taskCount").textContent = `${open} open`;
}

function addTask(title) {
  state.tasks.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title,
    done: false
  });
  renderTasks();
  saveState();
}

function saveState() {
  localStorage.setItem("focus-cockpit", JSON.stringify({
    sessions: state.sessions,
    minutesDone: state.minutesDone,
    streak: state.streak,
    tasks: state.tasks
  }));
}

function loadState() {
  const saved = JSON.parse(localStorage.getItem("focus-cockpit") || "{}");
  state.sessions = saved.sessions || 0;
  state.minutesDone = saved.minutesDone || 0;
  state.streak = saved.streak || 0;
  state.tasks = saved.tasks || [];
}

function createNoise(type, volume) {
  const context = state.audioContext;
  const gain = context.createGain();
  gain.gain.value = volume;
  gain.connect(context.destination);

  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.value = type === "sine" ? 180 : 90;
  oscillator.connect(gain);
  oscillator.start();
  state.audioNodes.push(oscillator, gain);
}

function createTone(frequency, duration, volume, type = "sine") {
  const context = state.audioContext;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration + 0.02);
  state.audioNodes.push(oscillator, gain);
}

function scheduleRaveBeat() {
  const volume = Number($("#volume").value) / 1000;
  const beatMs = 60000 / Number($("#tempo").value);
  let step = 0;

  state.beatTimer = setInterval(() => {
    createTone(step % 4 === 0 ? 72 : 86, 0.12, volume * 4.2, "sine");
    if (step % 2 === 1) createTone(740, 0.045, volume * 1.4, "square");
    if (step % 8 === 6) createTone(1180, 0.08, volume * 0.9, "sawtooth");
    step = (step + 1) % 16;
  }, beatMs);
}

function setEnergyLabel(sound) {
  const labels = {
    low: "Low",
    flow: "Flow",
    drive: "Drive",
    rave: "Rave"
  };
  $("#ambienceLabel").textContent = labels[sound] || "Standby";
  $("#energyLabel").textContent = labels[sound] || "Standby";
}

function playAmbience(sound) {
  stopAmbience();
  const volume = Number($("#volume").value) / 1000;
  state.audioContext = state.audioContext || new AudioContext();

  if (sound === "low") {
    createNoise("sine", volume * 0.9);
  } else if (sound === "flow") {
    createNoise("sine", volume * 1.6);
    createNoise("square", volume * 0.35);
  } else if (sound === "drive") {
    createNoise("sawtooth", volume * 0.8);
    createNoise("triangle", volume * 0.6);
  } else if (sound === "rave") {
    createNoise("triangle", volume * 0.32);
    scheduleRaveBeat();
  } else {
    createNoise("triangle", volume * 1.2);
  }

  state.currentSound = sound;
  setEnergyLabel(sound);
  document.body.classList.toggle("is-rave", sound === "rave");
  document.querySelectorAll(".sound").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.sound === sound);
  });
}

function stopAmbience() {
  clearInterval(state.beatTimer);
  state.beatTimer = null;
  state.audioNodes.forEach((node) => {
    try {
      if (typeof node.stop === "function") node.stop();
      node.disconnect();
    } catch (error) {
      // Nodes may already be stopped; disconnecting is best effort.
    }
  });
  state.audioNodes = [];
  state.currentSound = null;
  $("#ambienceLabel").textContent = "Standby";
  $("#energyLabel").textContent = state.running ? "Active" : "Standby";
  document.body.classList.remove("is-rave");
  document.querySelectorAll(".sound").forEach((button) => button.classList.remove("is-active"));
}

function chime() {
  const context = state.audioContext || new AudioContext();
  const gain = context.createGain();
  const oscillator = context.createOscillator();
  oscillator.frequency.value = 660;
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.7);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.75);
}

document.querySelectorAll(".mode").forEach((button) => {
  button.addEventListener("click", () => {
    stopTimer();
    document.querySelectorAll(".mode").forEach((mode) => mode.classList.remove("is-active"));
    button.classList.add("is-active");
    setTimerMinutes(Number(button.dataset.minutes), button.dataset.label);
  });
});

$("#minutes").addEventListener("input", (event) => {
  stopTimer();
  document.querySelectorAll(".mode").forEach((mode) => mode.classList.remove("is-active"));
  setTimerMinutes(Number(event.target.value), "Custom Focus");
});

$("#startPause").addEventListener("click", toggleTimer);
$("#reset").addEventListener("click", () => {
  stopTimer();
  state.remainingSeconds = state.totalSeconds;
  $("#timerHint").textContent = "Reset";
  renderTimer();
});

$("#taskForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#taskInput");
  const title = input.value.trim();
  if (!title) return;
  addTask(title);
  input.value = "";
});

document.querySelectorAll(".sound").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.currentSound === button.dataset.sound) {
      stopAmbience();
    } else {
      playAmbience(button.dataset.sound);
    }
  });
});

$("#volume").addEventListener("input", (event) => {
  $("#volumeOutput").textContent = `${event.target.value}%`;
  if (state.currentSound) playAmbience(state.currentSound);
});

$("#tempo").addEventListener("input", (event) => {
  const label = `${event.target.value} BPM`;
  $("#tempoOutput").textContent = label;
  $("#bpmReadout").textContent = label;
  if (state.currentSound === "rave") playAmbience("rave");
});

loadState();
renderStats();
renderTasks();
renderTimer();
updateClock();
setInterval(updateClock, 1000);
