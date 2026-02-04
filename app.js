// ===== DOM ELEMENTS =====
const $ = id => document.getElementById(id);

const elements = {
    totalTime: $('totalTime'),
    fastTime: $('fastTime'),
    slowTime: $('slowTime'),
    testingMode: $('testingMode'),
    inputPanel: $('inputPanel'),
    timerPanel: $('timerPanel'),
    infoPanel: $('infoPanel'),
    conditioningBtnWrapper: $('conditioningBtnWrapper'),
    timerTime: $('timerTime'),
    timerPhase: $('timerPhase'),
    timerCycle: $('timerCycle'),
    progressCircle: $('progressCircle'),
    progressGlow: $('progressGlow'),
    gradientStart: $('gradientStart'),
    gradientEnd: $('gradientEnd'),
    phaseIcon: $('phaseIcon'),
    motivationText: $('motivationText'),
    startBtn: $('startBtn'),
    pauseBtn: $('pauseBtn'),
    stopBtn: $('stopBtn'),
    newRoundBtn: $('newRoundBtn'),
    settingsBtn: $('settingsBtn'),
    conditioningBtn: $('conditioningBtn'),
    timerControls: $('timerControls'),
    completedControls: $('completedControls'),
    statTotal: $('statTotal'),
    statCycles: $('statCycles'),
    statFast: $('statFast'),
    statRest: $('statRest'),
    infoCycles: $('infoCycles'),
    infoRest: $('infoRest'),
    conditioningModal: $('conditioningModal'),
    modalClose: $('modalClose'),
    ageRange: $('ageRange'),
    weeklyActivity: $('weeklyActivity'),
    fitnessLevel: $('fitnessLevel'),
    targetDuration: $('targetDuration'),
    hasInjury: $('hasInjury'),
    weeklyActivityValue: $('weeklyActivityValue'),
    suggestedTotal: $('suggestedTotal'),
    suggestedFast: $('suggestedFast'),
    suggestedSlow: $('suggestedSlow'),
    suggestionNote: $('suggestionNote'),
    riskLevel: $('riskLevel'),
    applyBtn: $('applyBtn'),
    particles: $('particles')
};

// ===== CONSTANTS =====
const PHASES = { IDLE: 'idle', YAVAS: 'yavas', HIZLI: 'hizli', DINLENME: 'dinlenme', COMPLETED: 'completed' };
const PHASE_NAMES = { idle: 'Hazır', yavas: 'Yavaş', hizli: 'Hızlı', dinlenme: 'Dinlenme', completed: 'Tamamlandı' };
const PHASE_ICONS = { idle: 'flame', yavas: 'wind', hizli: 'zap', dinlenme: 'heart', completed: 'trophy' };
const CIRCUMFERENCE = 2 * Math.PI * 118;

const MOTIVATIONS = {
    yavas: ['Isınmaya devam!', 'Temponu koru', 'Nefesini düzenle', 'Hazırlan...'],
    hizli: ['HIZLAN!', 'Maksimum güç!', 'Devam et!', 'Son sprint!', 'Durma!'],
    dinlenme: ['Toparlan', 'Nefes al', 'Bir sonraki tura hazırlan', 'İyi gidiyorsun'],
    completed: ['Harika iş!', 'Tebrikler!', 'Antrenman tamam!']
};

// ===== STATE =====
let state = { phase: PHASES.IDLE, timeRemaining: 0, currentCycle: 0, totalCycles: 0, isRunning: false, isPaused: false, progress: 100 };
let phaseStartTime = null, pausedTime = 0, lastCountdownSec = -1, animationFrameId = null, audioContext = null;

// ===== AUDIO =====
function getAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
}

function playBeep(freq = 800, dur = 150, type = 'sine') {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur / 1000);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur / 1000);
    } catch (e) { console.warn('Audio failed:', e); }
}

function playTransitionBeep() { playBeep(880, 200, 'square'); setTimeout(() => playBeep(1100, 150, 'square'), 120); }
function playCountdownBeep() { playBeep(660, 80, 'sine'); }
function playCompletionSound() { playBeep(880, 150); setTimeout(() => playBeep(1100, 150), 150); setTimeout(() => playBeep(1320, 300), 300); }

// ===== PARTICLES =====
function createParticles() {
    elements.particles.innerHTML = '';
    for (let i = 0; i < 15; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = 60 + Math.random() * 40 + '%';
        p.style.animationDelay = Math.random() * 3 + 's';
        p.style.animationDuration = (2 + Math.random() * 2) + 's';
        elements.particles.appendChild(p);
    }
}

// ===== CALCULATIONS =====
function getSettings() {
    return {
        totalTime: parseInt(elements.totalTime.value) || 20,
        fastTime: parseInt(elements.fastTime.value) || 30,
        slowTime: parseInt(elements.slowTime.value) || 30
    };
}

function calculateCycleInfo() {
    const s = getSettings();
    const totalSec = s.totalTime * 60;
    const cycleActive = s.fastTime + s.slowTime;
    let bestCycles = 1, bestRest = 0;
    for (let c = 1; c <= 50; c++) {
        const remaining = totalSec - c * cycleActive;
        const rest = remaining / c;
        if (rest >= 5) { bestCycles = c; bestRest = rest; } 
        else break;
    }
    return { cycleCount: bestCycles, restTime: bestRest };
}

function getPhaseDuration(phase) {
    const s = getSettings();
    const { restTime } = calculateCycleInfo();
    if (phase === PHASES.YAVAS) return s.slowTime;
    if (phase === PHASES.HIZLI) return s.fastTime;
    if (phase === PHASES.DINLENME) return restTime;
    return 0;
}

function getNextPhase(current, cycle) {
    const { cycleCount } = calculateCycleInfo();
    if (current === PHASES.IDLE) return PHASES.YAVAS;
    if (current === PHASES.YAVAS) return PHASES.HIZLI;
    if (current === PHASES.HIZLI) return PHASES.DINLENME;
    if (current === PHASES.DINLENME) return cycle >= cycleCount ? PHASES.COMPLETED : PHASES.YAVAS;
    return PHASES.IDLE;
}

// ===== PHYSIOLOGY-BASED CONDITIONING =====
function calculateSafeSuggestions() {
    const age = elements.ageRange.value;
    const activity = parseInt(elements.weeklyActivity.value);
    const fitness = parseInt(elements.fitnessLevel.value);
    const target = parseInt(elements.targetDuration.value) || 20;
    const hasInjury = elements.hasInjury.checked;
    
    // Age factor (younger = can handle more intensity)
    const ageFactor = { '18-25': 1.2, '26-35': 1.0, '36-45': 0.85, '46-55': 0.7, '56+': 0.55 }[age] || 1;
    
    // Activity factor
    const activityFactor = 0.5 + (activity / 7) * 0.5;
    
    // Fitness multiplier
    const fitnessMult = 0.6 + (fitness / 5) * 0.4;
    
    // Injury penalty
    const injuryMult = hasInjury ? 0.6 : 1;
    
    // Combined score
    const score = ageFactor * activityFactor * fitnessMult * injuryMult;
    
    // Calculate safe values
    let fastTime, slowTime, totalTime, risk, note;
    
    if (score < 0.4) {
        // Very low - beginner/recovery mode
        fastTime = 15;
        slowTime = 45;
        totalTime = Math.min(target, 15);
        risk = 'high';
        note = 'Dikkat: Düşük kondisyon. Uzun ısınma ve kısa sprintler önerilir.';
    } else if (score < 0.6) {
        // Low
        fastTime = 20;
        slowTime = 40;
        totalTime = Math.min(target, 20);
        risk = 'medium';
        note = 'Orta yoğunlukta başlayın, vücudunuzu dinleyin.';
    } else if (score < 0.8) {
        // Medium
        fastTime = 30;
        slowTime = 30;
        totalTime = Math.min(target, 25);
        risk = 'low';
        note = 'Dengeli bir antrenman planı. İyi kondisyondasınız.';
    } else if (score < 1.0) {
        // Good
        fastTime = 40;
        slowTime = 25;
        totalTime = Math.min(target, 30);
        risk = 'low';
        note = 'Yüksek yoğunluklu antrenman için hazırsınız.';
    } else {
        // Excellent
        fastTime = 45;
        slowTime = 20;
        totalTime = target;
        risk = 'low';
        note = 'Mükemmel kondisyon! Maksimum performans moduna geçebilirsiniz.';
    }
    
    // Injury override
    if (hasInjury) {
        fastTime = Math.max(15, fastTime - 10);
        slowTime = Math.min(60, slowTime + 15);
        note = '⚠️ Sakatlık geçmişi nedeniyle daha güvenli değerler önerildi.';
    }
    
    return { totalTime, fastTime, slowTime, risk, note };
}

// ===== UI UPDATES =====
function updateInfoDisplay() {
    const s = getSettings();
    const { cycleCount, restTime } = calculateCycleInfo();
    elements.infoCycles.textContent = cycleCount;
    elements.infoRest.textContent = restTime.toFixed(1);
    elements.statTotal.textContent = `${s.totalTime} dk`;
    elements.statCycles.textContent = cycleCount;
    elements.statFast.textContent = `${s.fastTime} sn`;
    elements.statRest.textContent = `${restTime.toFixed(0)} sn`;
}

function updateTimerDisplay() {
    const min = Math.floor(state.timeRemaining / 60);
    const sec = Math.floor(state.timeRemaining % 60);
    elements.timerTime.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    elements.timerPhase.textContent = PHASE_NAMES[state.phase];
    elements.timerCycle.textContent = state.phase !== PHASES.IDLE && state.phase !== PHASES.COMPLETED 
        ? `Döngü ${state.currentCycle} / ${state.totalCycles}` : '';
    elements.phaseIcon.innerHTML = `<i data-lucide="${PHASE_ICONS[state.phase]}"></i>`;
    lucide.createIcons();
}

function updateProgressRing() {
    const offset = CIRCUMFERENCE - (state.progress / 100) * CIRCUMFERENCE;
    elements.progressCircle.style.strokeDasharray = CIRCUMFERENCE;
    elements.progressCircle.style.strokeDashoffset = offset;
    elements.progressGlow.style.strokeDasharray = CIRCUMFERENCE;
    elements.progressGlow.style.strokeDashoffset = offset;
    
    const colors = {
        [PHASES.HIZLI]: ['#ef4444', '#dc2626', 'rgba(239, 68, 68, 0.3)'],
        [PHASES.YAVAS]: ['#f97316', '#ea580c', 'rgba(249, 115, 22, 0.3)'],
        [PHASES.DINLENME]: ['#3b82f6', '#2563eb', 'rgba(59, 130, 246, 0.3)']
    };
    const c = colors[state.phase] || ['#6b7280', '#4b5563', 'rgba(107, 114, 128, 0.2)'];
    elements.gradientStart.setAttribute('stop-color', c[0]);
    elements.gradientEnd.setAttribute('stop-color', c[1]);
    elements.progressGlow.style.stroke = c[2];
}

function updateBodyBackground() {
    document.body.classList.remove('phase-hizli', 'phase-yavas', 'phase-dinlenme');
    if (state.phase === PHASES.HIZLI) document.body.classList.add('phase-hizli');
    else if (state.phase === PHASES.YAVAS) document.body.classList.add('phase-yavas');
    else if (state.phase === PHASES.DINLENME) document.body.classList.add('phase-dinlenme');
}

function updateMotivation() {
    const msgs = MOTIVATIONS[state.phase] || [''];
    elements.motivationText.textContent = msgs[Math.floor(Math.random() * msgs.length)];
}

function showTimer() {
    elements.inputPanel.classList.add('hidden');
    elements.infoPanel.classList.add('hidden');
    elements.conditioningBtnWrapper.classList.add('hidden');
    elements.timerPanel.classList.remove('hidden');
    elements.timerControls.classList.remove('hidden');
    elements.completedControls.classList.add('hidden');
}

function showInput() {
    elements.inputPanel.classList.remove('hidden');
    elements.infoPanel.classList.remove('hidden');
    elements.conditioningBtnWrapper.classList.remove('hidden');
    elements.timerPanel.classList.add('hidden');
    document.body.classList.remove('phase-hizli', 'phase-yavas', 'phase-dinlenme');
}

function showCompleted() {
    elements.timerControls.classList.add('hidden');
    elements.completedControls.classList.remove('hidden');
}

function updatePauseButton() {
    elements.pauseBtn.innerHTML = state.isPaused 
        ? '<i data-lucide="play"></i> Devam' 
        : '<i data-lucide="pause"></i> Duraklat';
    lucide.createIcons();
}

// ===== TIMER LOOP =====
function timerLoop() {
    if (!state.isRunning || state.isPaused) return;
    
    const mult = elements.testingMode.checked ? 10 : 1;
    const elapsed = ((Date.now() - phaseStartTime) / 1000) * mult;
    const duration = getPhaseDuration(state.phase);
    const remaining = Math.max(0, duration - elapsed);
    
    const sec = Math.ceil(remaining);
    if (sec <= 5 && sec > 0 && sec !== lastCountdownSec) {
        lastCountdownSec = sec;
        playCountdownBeep();
    }
    
    state.timeRemaining = remaining;
    state.progress = duration > 0 ? (remaining / duration) * 100 : 0;
    
    if (remaining <= 0) {
        const next = getNextPhase(state.phase, state.currentCycle);
        playTransitionBeep();
        
        if (next === PHASES.COMPLETED) {
            playCompletionSound();
            state.phase = PHASES.COMPLETED;
            state.timeRemaining = 0;
            state.progress = 0;
            state.isRunning = false;
            updateTimerDisplay();
            updateProgressRing();
            updateBodyBackground();
            updateMotivation();
            showCompleted();
            return;
        }
        
        if (next === PHASES.YAVAS && state.phase === PHASES.DINLENME) state.currentCycle++;
        
        state.phase = next;
        state.timeRemaining = getPhaseDuration(next);
        state.progress = 100;
        phaseStartTime = Date.now();
        lastCountdownSec = -1;
        
        updateBodyBackground();
        updateMotivation();
    }
    
    updateTimerDisplay();
    updateProgressRing();
    animationFrameId = requestAnimationFrame(timerLoop);
}

// ===== HANDLERS =====
function handleStart() {
    const { cycleCount } = calculateCycleInfo();
    const firstPhase = PHASES.YAVAS;
    
    state = {
        phase: firstPhase,
        timeRemaining: getPhaseDuration(firstPhase),
        currentCycle: 1,
        totalCycles: cycleCount,
        isRunning: true,
        isPaused: false,
        progress: 100
    };
    
    phaseStartTime = Date.now();
    lastCountdownSec = -1;
    
    updateInfoDisplay();
    showTimer();
    updateTimerDisplay();
    updateProgressRing();
    updateBodyBackground();
    updateMotivation();
    
    playTransitionBeep();
    animationFrameId = requestAnimationFrame(timerLoop);
}

function handlePause() {
    if (state.isPaused) {
        phaseStartTime += Date.now() - pausedTime;
        state.isPaused = false;
        animationFrameId = requestAnimationFrame(timerLoop);
    } else {
        pausedTime = Date.now();
        state.isPaused = true;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
    }
    updatePauseButton();
}

function handleStop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    state = { phase: PHASES.IDLE, timeRemaining: 0, currentCycle: 0, totalCycles: 0, isRunning: false, isPaused: false, progress: 100 };
    lastCountdownSec = -1;
    showInput();
    updateInfoDisplay();
}

// ===== MODAL =====
function updateSuggestions() {
    const s = calculateSafeSuggestions();
    elements.suggestedTotal.textContent = `${s.totalTime} dk`;
    elements.suggestedFast.textContent = `${s.fastTime} sn`;
    elements.suggestedSlow.textContent = `${s.slowTime} sn`;
    elements.suggestionNote.textContent = s.note;
    
    const badges = { low: 'Düşük Risk', medium: 'Orta Risk', high: 'Yüksek Risk' };
    elements.riskLevel.innerHTML = `<span class="risk-badge risk-${s.risk}">${badges[s.risk]}</span>`;
}

function openModal() { elements.conditioningModal.classList.add('active'); updateSuggestions(); }
function closeModal() { elements.conditioningModal.classList.remove('active'); }

function applySettings() {
    const s = calculateSafeSuggestions();
    elements.totalTime.value = s.totalTime;
    elements.fastTime.value = s.fastTime;
    elements.slowTime.value = s.slowTime;
    updateInfoDisplay();
    closeModal();
}

// ===== EVENT LISTENERS =====
elements.startBtn.addEventListener('click', handleStart);
elements.pauseBtn.addEventListener('click', handlePause);
elements.stopBtn.addEventListener('click', handleStop);
elements.newRoundBtn.addEventListener('click', handleStart);
elements.settingsBtn.addEventListener('click', handleStop);
elements.conditioningBtn.addEventListener('click', openModal);
elements.modalClose.addEventListener('click', closeModal);
elements.applyBtn.addEventListener('click', applySettings);
elements.conditioningModal.addEventListener('click', e => { if (e.target === elements.conditioningModal) closeModal(); });

elements.weeklyActivity.addEventListener('input', () => { elements.weeklyActivityValue.textContent = elements.weeklyActivity.value; updateSuggestions(); });
elements.ageRange.addEventListener('change', updateSuggestions);
elements.fitnessLevel.addEventListener('input', updateSuggestions);
elements.targetDuration.addEventListener('input', updateSuggestions);
elements.hasInjury.addEventListener('change', updateSuggestions);

elements.totalTime.addEventListener('input', updateInfoDisplay);
elements.fastTime.addEventListener('input', updateInfoDisplay);
elements.slowTime.addEventListener('input', updateInfoDisplay);

// ===== INIT =====
lucide.createIcons();
createParticles();
updateInfoDisplay();
