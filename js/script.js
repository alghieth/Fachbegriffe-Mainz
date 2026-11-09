// ==========================================
// 1. Cookie Helpers (حفظ واسترجاع وحذف الكوكيز)
// ==========================================
function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) {
    try {
      return JSON.parse(decodeURIComponent(match[2]));
    } catch (e) {
      return null;
    }
  }
  return null;
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// ==========================================
// 2. State Management
// ==========================================
// قراءة النتائج المحفوظة في الكوكيز، أو الانتقال لـ LocalStorage كنسخة احتياطية
const savedScore = getCookie("fsp_user_score") || JSON.parse(localStorage.getItem("fsp_user_score"));

const state = {
  currentCard: null,
  attempts: 0,
  isAnswerEvaluated: false, // لمنع احتساب نفس السؤال مرتين
  onlyStarredMode: false,
  score: savedScore || { correct: 0, wrong: 0, streak: 0 }
};

const allTerms = window.MEDICAL_TERMS || [];

// ==========================================
// 3. DOM Elements
// ==========================================
const elements = {
  stars: document.getElementById("stars"),
  answers: document.getElementById("answers"),
  answerBox: document.getElementById("answer-box"),
  answerBtn: document.getElementById("theAnswer"),
  answerRevealBox: document.querySelector(".answer-reveal-box"), // صندوق الإجابة بالكامل
  randomWordBox: document.getElementById("demo"),
  pickRandomBtn: document.getElementById("random-btn"),
  withStarBtn: document.getElementById("withStar"),
  pickWordBtn: document.querySelector(".button-section > button"),
  searchBox: document.getElementById("search"),
  searchResults: document.querySelector(".search-resutl"),
  soundAnswerBtn: document.getElementById("sound"),
  soundQuestionBtn: document.getElementById("question-sound"),
  recordBtn: document.querySelector(".record"),
  helloSection: document.querySelector(".hello")
};

// ==========================================
// 4. Audio & Speech Synthesis
// ==========================================
function speakText(text) {
  if (!text || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";

  const germanVoice = window.speechSynthesis
    .getVoices()
    .find(voice => voice.lang.includes("de"));
  if (germanVoice) utterance.voice = germanVoice;

  window.speechSynthesis.speak(utterance);
}

// ==========================================
// 5. Score & Reset Management
// ==========================================
function updateScore(isCorrect) {
  // عدم الاحتساب إذا تم تقييم الكلمة مسبقاً
  if (state.isAnswerEvaluated) return;

  if (isCorrect) {
    state.score.correct++;
    state.score.streak++;
  } else {
    state.score.wrong++;
    state.score.streak = 0;
  }

  state.isAnswerEvaluated = true; // قفل الكلمة الحالية
  saveScoreState();
  renderScore();
}

function saveScoreState() {
  setCookie("fsp_user_score", state.score, 365);
  localStorage.setItem("fsp_user_score", JSON.stringify(state.score));
}

function resetScore() {
  if (confirm("Möchtest du deinen Punktestand wirklich zurücksetzen? (هل تريد حقاً تصفير النتائج؟)")) {
    state.score = { correct: 0, wrong: 0, streak: 0 };
    deleteCookie("fsp_user_score");
    localStorage.removeItem("fsp_user_score");
    renderScore();
  }
}

function renderScore() {
  let scoreDisplay = document.getElementById("score-display");
  if (!scoreDisplay) {
    scoreDisplay = document.createElement("div");
    scoreDisplay.id = "score-display";
    scoreDisplay.className = "score-bar";
    elements.stars.closest(".quiz-card").insertBefore(scoreDisplay, elements.stars.closest(".term-display-box"));
  }

  scoreDisplay.innerHTML = `
    <div class="score-stats">
      <span>✅ Richtig: <strong>${state.score.correct}</strong></span>
      <span>❌ Falsch: <strong>${state.score.wrong}</strong></span>
      <span>🔥 Streak: <strong>${state.score.streak}</strong></span>
    </div>
    <button id="reset-score-btn" class="btn-reset" title="Statistik zurücksetzen">
      <i class="fa-solid fa-rotate-right"></i> Reset
    </button>
  `;

  document.getElementById("reset-score-btn")?.addEventListener("click", resetScore);
}

// ==========================================
// 6. Interactive Quiz Logic
// ==========================================
function getActiveTerms() {
  if (state.onlyStarredMode) {
    return allTerms.filter(item => item.isStarred);
  }
  return allTerms;
}

function pickOneWord() {
  const activeTerms = getActiveTerms();
  if (activeTerms.length === 0) return;

  const randomIndex = Math.floor(Math.random() * activeTerms.length);
  state.currentCard = activeTerms[randomIndex];
  
  // إعادة تعيين محاولات وتقييم السؤال الجديد
  state.attempts = 0;
  state.isAnswerEvaluated = false;

  // إبراز المصطلح والنجمة
  elements.stars.innerHTML = state.currentCard.isStarred 
    ? `${state.currentCard.term} <span style="color: #ffc107; font-size: 1.3rem;">★</span>` 
    : state.currentCard.term;

  // إخفاء صندوق الإجابة وزر الاستماع بالكامل عند بدء كلمة جديدة
  elements.answers.textContent = state.currentCard.answer;
  if (elements.answerRevealBox) {
    elements.answerRevealBox.style.display = "none";
  }
  elements.answers.style.display = "none";
  
  elements.answerBox.value = "";
  elements.answerBox.focus();

  elements.answerBtn.style.background = "#0284c7";
  elements.answerBtn.textContent = "Antwort prüfen";
}

function checkAnswer() {
  if (!state.currentCard) return;

  const userText = elements.answerBox.value.trim().toLowerCase();
  const correctAnswer = state.currentCard.answer.toLowerCase();

  if (!userText) return;

  state.attempts++;

  // 1. إذا كانت الإجابة صحيحة
  if (correctAnswer.includes(userText)) {
    revealAnswer();
    elements.answerBtn.style.background = "#10b981";
    elements.answerBtn.textContent = "Richtig! Super";
    updateScore(true); // يحسب نقطة صحيحة لمرة واحدة فقط
  } 
  // 2. إذا أخطأ واستنفد 3 محاولات
  else if (state.attempts >= 3) {
    revealAnswer();
    elements.answerBtn.style.background = "#f59e0b";
    elements.answerBtn.textContent = "Richtige Antwort aufgedeckt";
    updateScore(false); // يحسب نقطة خاطئة لمرة واحدة فقط
  } 
  // 3. محاولة خاطئة لكن ما زال لديه فرص
  else if (state.attempts === 1) {
    elements.answerBtn.style.background = "#ef4444";
    elements.answerBtn.textContent = "Falsch! Versuch es noch einmal";
  } else if (state.attempts === 2) {
    elements.answerBtn.style.background = "#ea580c";
    elements.answerBtn.textContent = "Noch 1 Versuch";
  }
}

// دالة مخصصة لإظهار الإجابة وزر الصوت معاً
function revealAnswer() {
  if (elements.answerRevealBox) {
    elements.answerRevealBox.style.display = "flex";
  }
  elements.answers.style.display = "block";
}

function putRandomWord() {
  if (allTerms.length === 0) return;
  const randomCard = allTerms[Math.floor(Math.random() * allTerms.length)];
  elements.randomWordBox.textContent = `${randomCard.term} ➔ ${randomCard.answer}`;
}

// ==========================================
// 7. Instant Search
// ==========================================
elements.searchBox.addEventListener("input", (e) => {
  const query = e.target.value.trim().toLowerCase();
  elements.searchResults.innerHTML = "";

  if (!query) return;

  const matches = allTerms
    .filter(item => item.term.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query))
    .slice(0, 8);

  if (matches.length > 0) {
    const ul = document.createElement("ul");
    matches.forEach(match => {
      const li = document.createElement("li");
      li.className = "list";
      li.innerHTML = `<strong>${match.term}</strong>: ${match.answer} ${match.isStarred ? '<span style="color:#ffc107">★</span>' : ''}`;
      li.addEventListener("click", () => {
        elements.randomWordBox.textContent = `${match.term} ➔ ${match.answer}`;
        elements.searchResults.innerHTML = "";
        elements.searchBox.value = "";
      });
      ul.appendChild(li);
    });
    elements.searchResults.appendChild(ul);
  }
});

// ==========================================
// 8. Speech Recognition
// ==========================================
let recognition;
let isRecording = false;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "de-DE";
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    elements.answerBox.value = event.results[0][0].transcript;
  };

  recognition.onend = () => {
    isRecording = false;
    elements.recordBtn.style.background = "#f1f5f9";
    elements.recordBtn.style.color = "#0f172a";
  };

  recognition.onerror = () => {
    isRecording = false;
    elements.recordBtn.style.background = "#f1f5f9";
    elements.recordBtn.style.color = "#0f172a";
  };
}

function toggleRecording() {
  if (!recognition) return;
  if (!isRecording) {
    recognition.start();
    isRecording = true;
    elements.recordBtn.style.background = "#0284c7";
    elements.recordBtn.style.color = "#ffffff";
  } else {
    recognition.stop();
    isRecording = false;
    elements.recordBtn.style.background = "#f1f5f9";
    elements.recordBtn.style.color = "#0f172a";
  }
}

// ==========================================
// 9. Initializer
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
  // شاشة الترحيب
  if (elements.helloSection) {
    setTimeout(() => {
      elements.helloSection.style.opacity = "0";
      setTimeout(() => (elements.helloSection.style.display = "none"), 800);
    }, 1800);
  }

  // دعم زر Enter
  elements.answerBox?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") checkAnswer();
  });

  // ربط أزرار التحكم
  elements.withStarBtn?.addEventListener("click", pickOneWord);
  elements.answerBtn?.addEventListener("click", checkAnswer);
  elements.pickWordBtn?.addEventListener("click", putRandomWord);
  elements.recordBtn?.addEventListener("click", toggleRecording);

  // نطق الصوت (زر الإجابة لا ينطق إلا إذا كانت معروضة بالفعل)
  elements.soundAnswerBtn?.addEventListener("click", () => {
    if (elements.answers.style.display !== "none") {
      speakText(state.currentCard?.answer);
    }
  });

  elements.soundQuestionBtn?.addEventListener("click", () => speakText(state.currentCard?.term));
  elements.pickRandomBtn?.addEventListener("click", () => speakText(elements.randomWordBox.textContent));

  // تهيئة شريط النقاط والبدء بكلمة أولى
  renderScore();
  pickOneWord();
});