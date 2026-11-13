// ===== SONIDOS (sintetizados, sin archivos externos) =====
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}
function primeAudio() { getAudioCtx(); }
function playTone(freq, start, duration, type = 'sine', peak = 0.16) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + start;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
}
function sfxDiceTap() { playTone(500 + Math.random() * 90, 0, 0.08, 'square', 0.10); }
function sfxLock() { playTone(660, 0, 0.11, 'triangle', 0.14); playTone(880, 0.07, 0.14, 'triangle', 0.11); }
function sfxYatzy() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone(f, i * 0.1, 0.22, 'triangle', 0.15)); }
function sfxBonus() { [660, 880, 1108, 1318].forEach((f, i) => playTone(f, i * 0.06, 0.16, 'sine', 0.13)); }
function sfxUndo() { playTone(260, 0, 0.1, 'sawtooth', 0.08); playTone(180, 0.05, 0.12, 'sawtooth', 0.07); }
function sfxTurnEnd() { playTone(340, 0, 0.12, 'sine', 0.09); playTone(230, 0.09, 0.18, 'sine', 0.07); }
function sfxButton() { playTone(720, 0, 0.05, 'square', 0.05); }
function sfxWin() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => playTone(f, i * 0.12, 0.3, 'triangle', 0.15)); }
function sfxFarkle() { playTone(220, 0, 0.18, 'sawtooth', 0.10); playTone(150, 0.12, 0.3, 'sawtooth', 0.09); }
function sfxReminder() { playTone(430, 0, 0.35, 'sine', 0.06); }

// ===== ANIMACIONES DE CELDAS (pop / shake) =====
function triggerPop(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.classList.remove('pop-anim');
    void el.offsetWidth;
    el.classList.add('pop-anim');
}
function triggerShake(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.classList.remove('shake-anim');
    void el.offsetWidth;
    el.classList.add('shake-anim');
}