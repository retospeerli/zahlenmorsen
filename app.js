const MORSE_MAP = {
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----."
};

const DIGITS = Object.keys(MORSE_MAP);

const setupScreen = document.getElementById("setupScreen");
const appScreen = document.getElementById("appScreen");

const numberLengthSlider = document.getElementById("numberLengthSlider");
const numberLengthLabel = document.getElementById("numberLengthLabel");

const startBtn = document.getElementById("startBtn");
const backBtn = document.getElementById("backBtn");

const unitSlider = document.getElementById("unitSlider");
const freqSlider = document.getElementById("freqSlider");
const toleranceSlider = document.getElementById("toleranceSlider");
const unitLabel = document.getElementById("unitLabel");
const freqLabel = document.getElementById("freqLabel");
const toleranceLabel = document.getElementById("toleranceLabel");

const screenTitle = document.getElementById("screenTitle");
const screenInfo = document.getElementById("screenInfo");
const targetText = document.getElementById("targetText");
const hintText = document.getElementById("hintText");

const playBtn = document.getElementById("playBtn");
const clearBtn = document.getElementById("clearBtn");
const finishBtn = document.getElementById("finishBtn");
const nextBtn = document.getElementById("nextBtn");

const morseKey = document.getElementById("morseKey");
const livePattern = document.getElementById("livePattern");
const liveDecode = document.getElementById("liveDecode");
const feedback = document.getElementById("feedback");

const recognizedTextEl = document.getElementById("recognizedText");
const charCountEl = document.getElementById("charCount");
const statusTextEl = document.getElementById("statusText");

let appMode = "practice_free";
let expectedText = "";
let recognizedChars = [];
let currentInputSymbols = "";
let currentTaskLabel = "";
let currentSubtraction = null;

let audioCtx = null;
let oscillator = null;
let gainNode = null;

let isPressing = false;
let pressStartTime = 0;
let finalizeLetterTimer = null;

const toleranceSettings = [
  { name: "streng", dotMaxFactor: 1.8, letterPauseFactor: 2.6 },
  { name: "mittel", dotMaxFactor: 2.2, letterPauseFactor: 3.0 },
  { name: "grosszuegig", dotMaxFactor: 2.8, letterPauseFactor: 3.6 }
];

function init() {
  updateLabels();
  updateModeFromRadios();
  setupEventListeners();
  updateStartUI();
  resetAppState();
}

function setupEventListeners() {
  unitSlider.addEventListener("input", updateLabels);
  freqSlider.addEventListener("input", updateLabels);
  toleranceSlider.addEventListener("input", updateLabels);
  numberLengthSlider.addEventListener("input", updateLabels);

  document.querySelectorAll('input[name="appMode"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      updateModeFromRadios();
      updateStartUI();
    });
  });

  startBtn.addEventListener("click", startApp);
  backBtn.addEventListener("click", goBack);

  playBtn.addEventListener("click", playTarget);
  clearBtn.addEventListener("click", clearCurrentAttempt);
  finishBtn.addEventListener("click", finishAttempt);
  nextBtn.addEventListener("click", newTask);

  morseKey.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handlePressStart();
  });

  morseKey.addEventListener("pointerup", (e) => {
    e.preventDefault();
    handlePressEnd();
  });

  morseKey.addEventListener("pointerleave", () => {
    if (isPressing) handlePressEnd();
  });

  morseKey.addEventListener("pointercancel", () => {
    if (isPressing) handlePressEnd();
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (!appScreen.classList.contains("hidden") && !e.repeat) {
        handlePressStart();
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (!appScreen.classList.contains("hidden")) {
        handlePressEnd();
      }
    }
  });

  window.addEventListener("blur", () => {
    if (isPressing) handlePressEnd();
  });
}

function updateModeFromRadios() {
  const checked = document.querySelector('input[name="appMode"]:checked');
  appMode = checked ? checked.value : "practice_free";
}

function updateStartUI() {
  const showLength =
    appMode === "practice_number" || appMode === "exam_number";
  document.getElementById("numberConfig").style.display = showLength ? "block" : "none";
}

function updateLabels() {
  unitLabel.textContent = `${unitSlider.value} ms`;
  freqLabel.textContent = `${freqSlider.value} Hz`;
  toleranceLabel.textContent = toleranceSettings[Number(toleranceSlider.value)].name;
  numberLengthLabel.textContent = numberLengthSlider.value;
}

function getUnit() {
  return Number(unitSlider.value);
}

function getFrequency() {
  return Number(freqSlider.value);
}

function getTolerance() {
  return toleranceSettings[Number(toleranceSlider.value)];
}

function getNumberLength() {
  return Number(numberLengthSlider.value);
}

function resetAppState() {
  recognizedChars = [];
  currentInputSymbols = "";
  livePattern.textContent = "–";
  liveDecode.textContent = "…";
  recognizedTextEl.textContent = "–";
  charCountEl.textContent = "0";
  statusTextEl.textContent = "Bereit";
  setFeedback("Noch keine Eingabe.", "neutral");
}

function clearCurrentAttempt() {
  clearLetterTimer();
  resetAppState();
}

function setFeedback(text, type = "neutral") {
  feedback.textContent = text;
  feedback.className = `feedback ${type}`;
}

function updateRecognizedUI() {
  const text = recognizedChars.join("");
  recognizedTextEl.textContent = text || "–";
  charCountEl.textContent = String(text.length);
  liveDecode.textContent = text || "…";
}

function patternToChar(pattern) {
  for (const [char, morse] of Object.entries(MORSE_MAP)) {
    if (morse === pattern) return char;
  }
  return null;
}

function randomDigit() {
  return DIGITS[Math.floor(Math.random() * DIGITS.length)];
}

function randomNumberString(length) {
  let result = "";
  for (let i = 0; i < length; i++) {
    let digit = randomDigit();
    if (i === 0 && length > 1) {
      while (digit === "0") {
        digit = randomDigit();
      }
    }
    result += digit;
  }
  return result;
}

function generateSubtractionTask() {
  const a = Math.floor(Math.random() * 900) + 100; // 100-999
  const b = Math.floor(Math.random() * (a + 1));   // 0-a
  const result = a - b;

  return {
    text: `${a} - ${b}`,
    answer: String(result)
  };
}

function configureTask() {
  currentSubtraction = null;

  if (appMode === "practice_free") {
    currentTaskLabel = "FREIES MORSEN";
    expectedText = "";
    screenTitle.textContent = "Uebungsmodus";
    screenInfo.textContent = "Freies Morsen mit Ziffern. Die App schreibt mit, was sie versteht.";
    hintText.textContent = "Morse frei. Es wird nichts bewertet.";
    statusTextEl.textContent = "Freies Ueben";
    targetText.textContent = currentTaskLabel;
    return;
  }

  if (appMode === "practice_digit") {
    expectedText = randomDigit();
    currentTaskLabel = expectedText;
    screenTitle.textContent = "Uebung: Ziffer";
    screenInfo.textContent = "Morse die gezeigte Ziffer.";
    hintText.textContent = "Eine Ziffer morsen und dann ueberpruefen.";
    statusTextEl.textContent = "Ziffer ueben";
    targetText.textContent = currentTaskLabel;
    return;
  }

  if (appMode === "practice_number") {
    expectedText = randomNumberString(getNumberLength());
    currentTaskLabel = expectedText;
    screenTitle.textContent = "Uebung: Zahl";
    screenInfo.textContent = "Morse die gezeigte Zahl.";
    hintText.textContent = "Die ganze Zahl morsen und dann ueberpruefen.";
    statusTextEl.textContent = "Zahl ueben";
    targetText.textContent = currentTaskLabel;
    return;
  }

  if (appMode === "exam_number") {
    expectedText = randomNumberString(getNumberLength());
    currentTaskLabel = expectedText;
    screenTitle.textContent = "Pruefung: Zahl";
    screenInfo.textContent = "Morse die gezeigte Zahl korrekt.";
    hintText.textContent = "Wenn du korrekt bist, erscheint der Pruefungshinweis.";
    statusTextEl.textContent = "Pruefung laeuft";
    targetText.textContent = currentTaskLabel;
    return;
  }

  if (appMode === "exam_subtraction") {
    currentSubtraction = generateSubtractionTask();
    expectedText = currentSubtraction.answer;
    currentTaskLabel = currentSubtraction.text;
    screenTitle.textContent = "Pruefung: Subtraktion";
    screenInfo.textContent = "Loese die Rechnung im Kopf und morse das Resultat.";
    hintText.textContent = "Wenn das Resultat stimmt, erscheint der Pruefungshinweis.";
    statusTextEl.textContent = "Pruefung laeuft";
    targetText.textContent = currentTaskLabel;
  }
}

function startApp() {
  updateModeFromRadios();
  resetAppState();
  configureTask();

  setupScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");

  ensureAudio();
}

function newTask() {
  clearLetterTimer();
  resetAppState();
  configureTask();
}

function goBack() {
  stopTone();
  clearLetterTimer();
  isPressing = false;
  setupScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function startTone() {
  ensureAudio();
  stopTone();

  oscillator = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = getFrequency();
  gainNode.gain.value = 0.18;

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
}

function stopTone() {
  if (oscillator) {
    try {
      oscillator.stop();
    } catch (err) {
      // ignore
    }
    oscillator.disconnect();
    oscillator = null;
  }

  if (gainNode) {
    gainNode.disconnect();
    gainNode = null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playMorsePattern(pattern) {
  const unit = getUnit();

  for (let i = 0; i < pattern.length; i++) {
    const symbol = pattern[i];
    const duration = symbol === "." ? unit : unit * 3;

    startTone();
    await sleep(duration);
    stopTone();

    if (i < pattern.length - 1) {
      await sleep(unit);
    }
  }
}

async function playTarget() {
  let textToPlay = "";

  if (appMode === "practice_free") {
    const current = recognizedChars.join("");
    if (!current) {
      setFeedback("Im freien Modus kann nur bereits erkannter Text vorgespielt werden.", "warning");
      return;
    }
    textToPlay = current;
  } else if (appMode === "exam_subtraction") {
    textToPlay = expectedText;
  } else {
    textToPlay = expectedText;
  }

  if (!textToPlay) return;

  playBtn.disabled = true;
  finishBtn.disabled = true;
  clearBtn.disabled = true;
  nextBtn.disabled = true;
  morseKey.disabled = true;

  const unit = getUnit();

  for (let i = 0; i < textToPlay.length; i++) {
    const ch = textToPlay[i];
    const pattern = MORSE_MAP[ch];
    if (!pattern) continue;

    await playMorsePattern(pattern);

    if (i < textToPlay.length - 1) {
      await sleep(unit * 3);
    }
  }

  await sleep(unit * 2);

  playBtn.disabled = false;
  finishBtn.disabled = false;
  clearBtn.disabled = false;
  nextBtn.disabled = false;
  morseKey.disabled = false;
}

function handlePressStart() {
  if (isPressing) return;

  ensureAudio();
  clearLetterTimer();

  isPressing = true;
  pressStartTime = performance.now();
  morseKey.classList.add("active");
  startTone();
}

function handlePressEnd() {
  if (!isPressing) return;

  isPressing = false;
  stopTone();
  morseKey.classList.remove("active");

  const duration = performance.now() - pressStartTime;
  const unit = getUnit();
  const tolerance = getTolerance();

  const symbol = duration < unit * tolerance.dotMaxFactor ? "." : "-";
  currentInputSymbols += symbol;
  livePattern.textContent = currentInputSymbols;

  const waitMs = unit * tolerance.letterPauseFactor;

  clearLetterTimer();
  finalizeLetterTimer = setTimeout(() => {
    finalizeCurrentChar();
  }, waitMs);
}

function clearLetterTimer() {
  if (finalizeLetterTimer) {
    clearTimeout(finalizeLetterTimer);
    finalizeLetterTimer = null;
  }
}

function finalizeCurrentChar() {
  if (!currentInputSymbols) return;

  const typedPattern = currentInputSymbols;
  const decoded = patternToChar(typedPattern);

  currentInputSymbols = "";
  livePattern.textContent = "–";

  if (!decoded) {
    recognizedChars.push("?");
    updateRecognizedUI();
    setFeedback(`Die Folge ${typedPattern} wurde als ? gespeichert.`, "warning");
    return;
  }

  recognizedChars.push(decoded);
  updateRecognizedUI();
  setFeedback(`Erkannt: ${decoded}`, "neutral");
}

function finishAttempt() {
  clearLetterTimer();

  if (currentInputSymbols) {
    finalizeCurrentChar();
  }

  const recognized = recognizedChars.join("");

  if (appMode === "practice_free") {
    statusTextEl.textContent = "Frei gemorst";
    setFeedback(`Erkannt wurde: ${recognized || "∅"}`, "neutral");
    return;
  }

  if (!recognized) {
    statusTextEl.textContent = "Keine Eingabe";
    setFeedback("Es wurde noch nichts erkannt.", "warning");
    return;
  }

  if (recognized === expectedText) {
    if (appMode === "practice_digit" || appMode === "practice_number") {
      statusTextEl.textContent = "Richtig";
      setFeedback(`Richtig! Du hast ${expectedText} korrekt gemorst.`, "success");
      return;
    }

    statusTextEl.textContent = "Bestanden";
    setFeedback("Richtig gemorst. Das Loesungswort wird gemorst: 8820", "success");
    return;
  }

  if (appMode === "practice_digit" || appMode === "practice_number") {
    statusTextEl.textContent = "Noch nicht richtig";
    setFeedback(`Nicht ganz richtig. Erkannt wurde: ${recognized}. Gesucht war: ${expectedText}.`, "error");
    return;
  }

  statusTextEl.textContent = "Nicht bestanden";
  setFeedback(`Nicht korrekt. Erkannt wurde: ${recognized}. Versuche es noch einmal.`, "error");
}

init();
