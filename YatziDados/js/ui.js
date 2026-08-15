// ===== ICONOS: puntos de dado (SVG), casa y cartas =====
const DIE_PATTERNS = {
    1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
};
const PIP_POS = [
    [20, 20], [50, 20], [80, 20],
    [20, 50], [50, 50], [80, 50],
    [20, 80], [50, 80], [80, 80]
];
function pipsHTML(value) {
    if (!value) return '<span class="pip-empty">?</span>';
    const active = DIE_PATTERNS[value] || [];
    let dots = '';
    active.forEach(i => {
        const [cx, cy] = PIP_POS[i];
        dots += `<circle class="pip-dot" cx="${cx}" cy="${cy}" r="13"/><circle class="pip-shine" cx="${cx - 4}" cy="${cy - 4}" r="4"/>`;
    });
    return `<svg class="dice-svg" viewBox="0 0 100 100">${dots}</svg>`;
}
const HOUSE_SVG = '<svg class="cat-icon-svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M9.5 19.5V14h5v5.5"/></svg>';
const CARDS_SVG = '<svg class="cat-icon-svg" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="12" height="15" rx="2" transform="rotate(-12 8.5 14.5)"/><rect x="8" y="3" width="12" height="15" rx="2"/></svg>';

function catIconHTML(cat) {
    switch (cat.iconType) {
        case 'die': return pipsHTML(cat.dieValue);
        case 'house': return HOUSE_SVG;
        case 'cards': return CARDS_SVG + `<span class="cat-sub">${cat.sub}</span>`;
        case 'yatzy': return '<span class="cat-yatzy">YATZY</span>';
        default: return `<span>${cat.icon}</span>`;
    }
}

// ===== TEMA DE COLOR POR JUGADOR =====
function myColorHex() { return colorHexOf(playerColors[myId]); }
function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
function blendHex(hex, baseHex, ratio) {
    // ratio = proporción del color del jugador mezclado sobre el fondo base (0 = fondo puro, 1 = color puro)
    const h1 = hex.replace('#', ''), h2 = baseHex.replace('#', '');
    const r1 = parseInt(h1.substr(0, 2), 16), g1 = parseInt(h1.substr(2, 2), 16), b1 = parseInt(h1.substr(4, 2), 16);
    const r2 = parseInt(h2.substr(0, 2), 16), g2 = parseInt(h2.substr(2, 2), 16), b2 = parseInt(h2.substr(4, 2), 16);
    const r = Math.round(r1 * ratio + r2 * (1 - ratio));
    const g = Math.round(g1 * ratio + g2 * (1 - ratio));
    const b = Math.round(b1 * ratio + b2 * (1 - ratio));
    return `rgb(${r},${g},${b})`;
}
function applyBoardTheme() {
    const board = document.querySelector('.board-container');
    if (!board) return;
    const hex = myColorHex();
    const solidBg = blendHex(hex, '#1c1c26', 0.22);
    board.style.borderColor = hexToRgba(hex, 0.7);
    board.style.boxShadow = `0 0 0 1px ${hexToRgba(hex, 0.28)} inset, 0 10px 28px ${hexToRgba(hex, 0.14)}`;
    board.style.background = solidBg;
    board.style.setProperty('--player-color', hex);
}
function readableTextOn(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#1a1a1a' : '#ECE5DB';
}

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

// ===== ANIMACIONES DE CELDAS =====
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

// ===== TOAST DE EVENTOS =====
let pendingEvents = [];
function queueEvent(tag, text) {
    pendingEvents = pendingEvents.filter(e => e.tag !== tag);
    pendingEvents.push({ tag, text });
}
function dequeueEvent(tag) {
    pendingEvents = pendingEvents.filter(e => e.tag !== tag);
}
function flushPendingEvents() {
    if (pendingEvents.length === 0) return;
    pendingEvents.forEach((e, i) => {
        setTimeout(() => { showEventToast(e.text); broadcastEvent(e.text); }, i * 3800);
    });
    pendingEvents = [];
}
function showEventToast(text) {
    const el = document.getElementById('eventToast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(showEventToast._t);
    showEventToast._t = setTimeout(() => el.classList.remove('show'), 3500);
}
function broadcastEvent(text) {
    if (mqttClient && currentRoom) {
        mqttClient.publish(`yatzy_app_xyz/room/${currentRoom}`, JSON.stringify({ action: 'event_toast', id: myId, text }));
    }
}

// ===== RENDER: TABLERO =====
function renderBoard() {
    const upperCol = document.getElementById('upperCol');
    const lowerCol = document.getElementById('lowerCol');
    upperCol.innerHTML = ''; lowerCol.innerHTML = '';

    CATEGORIES.forEach(cat => {
        const row = document.createElement('div');
        row.className = 'cat-row';
        const catCell = document.createElement('div');
        catCell.className = 'cat-cell';
        catCell.id = `cat-${cat.id}`;
        catCell.innerHTML = catIconHTML(cat);
        catCell.addEventListener('click', () => showTooltip(cat.id));
        const scoreCell = document.createElement('div');
        scoreCell.className = 'score-cell';
        scoreCell.id = `score-${cat.id}`;
        scoreCell.addEventListener('click', () => handleCategoryTap(cat.id));
        row.appendChild(catCell); row.appendChild(scoreCell);
        (cat.section === 'upper' ? upperCol : lowerCol).appendChild(row);
    });

    const bonusRow = document.createElement('div');
    bonusRow.className = 'bonus-row';
    const bonusCat = document.createElement('div');
    bonusCat.className = 'cat-cell'; bonusCat.style.flex = '1.3'; bonusCat.textContent = 'BONO';
    bonusCat.addEventListener('click', () => showTooltip('bonus'));
    const bonusCell = document.createElement('div');
    bonusCell.className = 'bonus-cell'; bonusCell.id = 'bonusCell';
    bonusRow.appendChild(bonusCat); bonusRow.appendChild(bonusCell);
    upperCol.appendChild(bonusRow);
}

function renderDice() {
    const row = document.getElementById('diceRow');
    if (!row) return;
    row.innerHTML = '';
    const interactive = isMyTurn() && !markedThisTurn;
    myDice.forEach((val, idx) => {
        const cell = document.createElement('div');
        cell.className = 'die-cell' + (val ? ' filled' : '') + (!interactive ? ' disabled' : '');
        cell.innerHTML = pipsHTML(val);
        cell.addEventListener('click', () => tapDiceCell(idx));
        row.appendChild(cell);
    });
}

function renderScores() {
    const diceReady = myDice.every(d => d !== null);
    const myTurn = isMyTurn();
    const eligible = jokerModeActive ? jokerEligibleCategories() : [];

    CATEGORIES.forEach(cat => {
        const cell = document.getElementById(`score-${cat.id}`);
        if (!cell) return;
        cell.classList.remove('ghost', 'locked', 'disabled-turn', 'yatzy-again', 'joker-eligible', 'undoable');
        cell.style.borderColor = '';
        cell.style.background = '';
        cell.style.color = '';
        cell.innerHTML = '';

        const lockedVal = myScores[cat.id];
        if (lockedVal !== null) {
            cell.textContent = lockedVal;
            cell.classList.add('locked');
            const myColor = myColorHex();
            cell.style.background = myColor;
            cell.style.borderColor = myColor;
            cell.style.color = readableTextOn(myColor);
            if (markedThisTurn && cat.id === lastMarkedCatId) cell.classList.add('undoable');
            if (jokerModeActive && cat.id === 'yatzy') cell.classList.add('undoable');
        } else {
            if (jokerModeActive) {
                if (eligible.includes(cat.id)) {
                    cell.classList.add('joker-eligible');
                    const jokerFixed = { fullHouse: 25, smallStraight: 30, largeStraight: 40 };
                    const previewVal = jokerFixed[cat.id] !== undefined ? jokerFixed[cat.id] : cat.calc(myDice);
                    cell.textContent = previewVal;
                } else cell.classList.add('disabled-turn');
            } else if (myTurn && diceReady && !markedThisTurn) {
                const preview = cat.calc(myDice);
                cell.textContent = preview;
                cell.classList.add('ghost');
                if (cat.id === 'yatzy' && isYatzy(myDice)) cell.classList.add('yatzy-again');
            } else {
                cell.classList.add('disabled-turn');
            }
        }
    });

    // Casilla de Yatzy ya llena + dados actuales tambien Yatzy -> ofrecer extra
    const yatzyCell = document.getElementById('score-yatzy');
    if (yatzyCell && myScores.yatzy !== null && myTurn && !markedThisTurn && !jokerModeActive && diceReady && isYatzy(myDice)) {
        yatzyCell.classList.add('yatzy-again');
    }

    // Insignia de Yatzys extra (en la casilla de categoria "YATZY", no en el puntaje)
    const catYatzyCell = document.getElementById('cat-yatzy');
    if (catYatzyCell) {
        const existing = catYatzyCell.querySelector('.yatzy-checks');
        if (existing) existing.remove();
        if (myExtraYatzys > 0) {
            const checks = document.createElement('div');
            checks.className = 'yatzy-checks';
            checks.textContent = `×${myExtraYatzys}`;
            catYatzyCell.appendChild(checks);
        }
    }

    updateBonusCell();
    updateTotalScore();
    renderTurnActions();
    checkGameFinished();
    applyBoardTheme();
}

function updateBonusCell() {
    const cell = document.getElementById('bonusCell');
    if (!cell) return;
    const sum = upperSum(myScores);
    if (sum >= 63) { cell.innerHTML = '+35<br>✓'; cell.classList.add('done'); }
    else { cell.innerHTML = `${sum}<br>/63`; cell.classList.remove('done'); }
}
function updateTotalScore() {
    const el = document.getElementById('myTotalScore');
    if (el) el.textContent = totalScore(myScores, myExtraYatzys);
}
function renderTurnActions() {
    const el = document.getElementById('turnActions');
    if (el) el.style.display = (isMyTurn() && markedThisTurn) ? 'flex' : 'none';
}
function renderTurnBanner() {
    const banner = document.getElementById('turnBanner');
    renderHostControls();
    updateHostWarning();
    if (!banner) return;
    if (!gameStarted || turnOrder.length === 0) {
        banner.classList.remove('my-turn');
        banner.textContent = isRoomCreator
            ? 'Presiona "Iniciar Partida" para comenzar'
            : 'Esperando a que el anfitrion inicie la partida...';
        return;
    }
    const currentId = turnOrder[currentTurnIndex];
    const currentName = (playersData[currentId] && playersData[currentId].name) || (currentId === myId ? myName : '??');
    if (currentId === myId) { banner.textContent = 'Tu turno — lanza los dados y anota'; banner.classList.add('my-turn'); }
    else { banner.textContent = `Turno de: ${currentName}`; banner.classList.remove('my-turn'); }
}

// ===== TOOLTIPS =====
function showTooltip(id) {
    let title, text;
    if (id === 'bonus') { title = 'BONO'; text = TOOLTIP_TEXT.bonus; }
    else { const cat = CATEGORIES.find(c => c.id === id); title = cat.label; text = TOOLTIP_TEXT[id]; }
    document.getElementById('tooltipTitle').textContent = title;
    document.getElementById('tooltipText').textContent = text;
    document.getElementById('tooltipModal').style.display = 'flex';
}
function closeTooltip() { document.getElementById('tooltipModal').style.display = 'none'; }

// ===== DADOS =====
function tapDiceCell(index) {
    if (!isMyTurn() || markedThisTurn) return;
    primeAudio();
    sfxButton();
    activeDiceIndex = index;
    document.getElementById('diceModal').style.display = 'flex';
}
function setDiceValue(val) {
    if (activeDiceIndex === null) return;
    myDice[activeDiceIndex] = val;
    const idx = activeDiceIndex;
    activeDiceIndex = null;
    document.getElementById('diceModal').style.display = 'none';
    renderDice(); renderScores();
    sfxDiceTap();
    const row = document.getElementById('diceRow');
    if (row && row.children[idx]) {
        const cell = row.children[idx];
        cell.classList.remove('pop-anim');
        void cell.offsetWidth;
        cell.classList.add('pop-anim');
    }
}
function closeDiceModal() { activeDiceIndex = null; document.getElementById('diceModal').style.display = 'none'; }

// ===== FIN DE LA PARTIDA =====
function showGameOverModal() {
    const arr = turnOrder.map(id => ({ id, ...playersData[id] })).sort((a, b) => (b.score || 0) - (a.score || 0));
    const list = document.getElementById('finalRankList');
    if (list) {
        list.innerHTML = arr.map((p, idx) => {
            const hex = colorHexOf(p.color);
            const isWinner = idx === 0;
            const medal = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
            return `<div class="final-rank-row${isWinner ? ' winner' : ''}" style="border-left-color:${hex};">
                <span class="frank-medal">${medal}</span>
                <span class="frank-name">${p.name}${p.id === myId ? ' (Tu)' : ''}</span>
                <span class="frank-score">${p.score || 0}</span>
            </div>`;
        }).join('');
    }
    const resetBtn = document.getElementById('gameOverResetBtn');
    if (resetBtn) resetBtn.style.display = isRoomCreator ? 'block' : 'none';
    const modal = document.getElementById('gameOverModal');
    if (modal) modal.style.display = 'flex';
    sfxWin();
}
function closeGameOverModal() {
    document.getElementById('gameOverModal').style.display = 'none';
}

function openViewPlayer(id) {
    const p = playersData[id];
    if (!p) return;
    document.getElementById('viewPlayerTitle').textContent = `${p.name}${id === myId ? ' (Tu)' : ''}`;
    const scores = p.scores || {};
    const hex = colorHexOf(p.color);
    const container = document.getElementById('viewPlayerSheet');
    container.innerHTML = '';

    const board = document.createElement('div');
    board.className = 'yatzy-board mini-board';
    const upperCol = document.createElement('div'); upperCol.className = 'yatzy-col';
    const lowerCol = document.createElement('div'); lowerCol.className = 'yatzy-col';
    board.appendChild(upperCol); board.appendChild(lowerCol);

    function buildMiniCol(section, col) {
        CATEGORIES.filter(c => c.section === section).forEach(cat => {
            const row = document.createElement('div');
            row.className = 'cat-row';
            const catCell = document.createElement('div');
            catCell.className = 'cat-cell';
            catCell.innerHTML = catIconHTML(cat);
            const scoreCell = document.createElement('div');
            scoreCell.className = 'score-cell';
            const val = scores[cat.id];
            if (val !== null && val !== undefined) {
                scoreCell.classList.add('locked');
                scoreCell.style.background = hex;
                scoreCell.style.borderColor = hex;
                scoreCell.style.color = readableTextOn(hex);
                scoreCell.textContent = val;
            } else {
                scoreCell.classList.add('disabled-turn');
            }
            row.appendChild(catCell); row.appendChild(scoreCell);
            col.appendChild(row);
        });
    }
    buildMiniCol('upper', upperCol);
    buildMiniCol('lower', lowerCol);

    const bonusRow = document.createElement('div');
    bonusRow.className = 'bonus-row';
    const bonusCat = document.createElement('div');
    bonusCat.className = 'cat-cell'; bonusCat.style.flex = '1.15'; bonusCat.textContent = 'BONO';
    const bonusCell = document.createElement('div');
    bonusCell.className = 'bonus-cell';
    const uSum = upperSum(scores);
    if (uSum >= 63) { bonusCell.innerHTML = '+35<br>✓'; bonusCell.classList.add('done'); }
    else { bonusCell.innerHTML = `${uSum}<br>/63`; }
    bonusRow.appendChild(bonusCat); bonusRow.appendChild(bonusCell);
    upperCol.appendChild(bonusRow);

    container.appendChild(board);

    if (p.extraYatzys) {
        const extra = document.createElement('p');
        extra.style.cssText = 'text-align:center;font-size:0.75rem;color:#EBC21A;margin-top:8px;';
        extra.textContent = `⭐ Yatzys extra: ${p.extraYatzys} (+${p.extraYatzys * 100})`;
        container.appendChild(extra);
    }

    document.getElementById('viewPlayerModal').style.display = 'flex';
}
function closeViewPlayer() { document.getElementById('viewPlayerModal').style.display = 'none'; }

// ===== SALA DE ESPERA / ORDEN DE TURNOS =====
function renderHostControls() {
    const startBtn = document.getElementById('startGameBtn');
    const resetBtn = document.getElementById('resetGameBtn');
    if (startBtn) startBtn.style.display = (isRoomCreator && currentRoom && !gameStarted) ? 'block' : 'none';
    if (resetBtn) resetBtn.style.display = (isRoomCreator && currentRoom && gameStarted) ? 'block' : 'none';
}

function renderPreGame() {
    const panel = document.getElementById('preGamePanel');
    const gameArea = document.getElementById('gameArea');
    renderHostControls();
    if (!panel || !gameArea) return;
    updateHostWarning();

    // Ya no hay una pantalla de espera separada: el tablero se muestra
    // siempre que estamos en una sala. Las acciones quedan bloqueadas
    // (ver isMyTurn/gameStarted) hasta que el anfitrion presione
    // "Iniciar Partida" (la primera vez, o de nuevo tras un Reiniciar).
    panel.style.display = 'none';
    gameArea.style.display = 'flex';

    // El orden de turnos se sigue calculando en segundo plano, segun el
    // orden de llegada a la sala, para cuando el anfitrion inicie la partida.
    const currentIds = Object.keys(playersData);
    currentIds.forEach(id => { if (!pendingOrder.includes(id)) pendingOrder.push(id); });
    pendingOrder = pendingOrder.filter(id => currentIds.includes(id));
}

// ===== AVISO GENERAL (reemplaza alert() nativo) =====
function showNotice(text, title = 'Aviso') {
    document.getElementById('noticeTitle').textContent = title;
    document.getElementById('noticeText').textContent = text;
    document.getElementById('noticeModal').style.display = 'flex';
}
function closeNotice() { document.getElementById('noticeModal').style.display = 'none'; }
