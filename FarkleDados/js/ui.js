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
let _cardsMaskSeq = 0;
function rotatePoint(x, y, cx, cy, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const dx = x - cx, dy = y - cy;
    return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
}
function cardsIconSVG(count) {
    const w = 6, h = 10, rx = 1.2, px = 12, py = 17;
    const frontTilt = 16;
    const spreadTable = { 2: 36, 4: 64, 5: 72 };
    const spread = spreadTable[count] || 16 * (count - 1);
    const step = count > 1 ? spread / (count - 1) : 0;
    const angles = [];
    for (let i = 0; i < count; i++) angles.push(frontTilt - spread + i * step);
    const fx = px - w / 2, fy = py - h;
    const rectAt = angle => `<rect x="${fx}" y="${fy}" width="${w}" height="${h}" rx="${rx}" transform="rotate(${angle} ${px} ${py})"/>`;
    const rectAtFill = (angle, fill) => `<rect x="${fx}" y="${fy}" width="${w}" height="${h}" rx="${rx}" transform="rotate(${angle} ${px} ${py})" fill="${fill}"/>`;

    // El abanico queda inclinado de forma asimetrica (angulos de frontTilt-spread a
    // frontTilt), asi que su contorno real no coincide con el viewBox fijo 0 0 24 24:
    // se ve corrido hacia un lado dentro de la casilla. Calculamos aqui el contorno
    // real (las 4 esquinas de cada carta, rotadas) para usarlo como viewBox y para
    // darle a la mascara una region explicita (ver mas abajo).
    const corners = [[fx, fy], [fx + w, fy], [fx, fy + h], [fx + w, fy + h]];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    angles.forEach(angle => {
        corners.forEach(([x, y]) => {
            const [rx2, ry2] = rotatePoint(x, y, px, py, angle);
            minX = Math.min(minX, rx2); maxX = Math.max(maxX, rx2);
            minY = Math.min(minY, ry2); maxY = Math.max(maxY, ry2);
        });
    });
    const pad = 1;
    const vbX = minX - pad, vbY = minY - pad, vbW = (maxX - minX) + pad * 2, vbH = (maxY - minY) + pad * 2;

    // Region explicita, generosa, para cada <mask>. Sin esto, un <mask> sin x/y/width/height
    // propios usa una region por defecto basada en porcentajes del viewport actual; al haber
    // cambiado el viewBox fijo (0 0 24 24) por uno dinamico mas chico, esa region por defecto
    // dejaba de cubrir todo el dibujo y recortaba trozos de las cartas traseras. Con una region
    // explicita mas grande que el propio viewBox, la mascara siempre cubre todo el icono.
    const maskPad = 20;
    const maskRegionAttrs = `x="${vbX - maskPad}" y="${vbY - maskPad}" width="${vbW + maskPad * 2}" height="${vbH + maskPad * 2}"`;

    // Cada carta trasera se enmascara solo donde las cartas de adelante la cubren, para que
    // las lineas de sus bordes no se vean cruzando por encima/en el centro de las cartas
    // que estan delante (tal como se penso originalmente).
    let defs = '';
    let body = '';
    for (let i = 0; i < count; i++) {
        if (i === count - 1) {
            body += rectAt(angles[i]);
            continue;
        }
        const maskId = `cardsFanMask${++_cardsMaskSeq}`;
        let coverRects = '';
        for (let j = i + 1; j < count; j++) coverRects += rectAtFill(angles[j], 'black');
        defs += `<mask id="${maskId}" maskUnits="userSpaceOnUse" ${maskRegionAttrs}><rect ${maskRegionAttrs} fill="white"/>${coverRects}</mask>`;
        body += `<g mask="url(#${maskId})">${rectAt(angles[i])}</g>`;
    }

    return `<svg class="cat-icon-svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" fill="none" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
        <defs>${defs}</defs>
        ${body}
    </svg>`;
}

// ===== TEMA DE COLOR POR JUGADOR =====
function myColorHex() { return colorHexOf(playerColors[myId]); }
function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
function blendHex(hex, baseHex, ratio) {
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
}
function readableTextOn(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#1a1a1a' : '#ECE5DB';
}

// ===== RECORDATORIO DE FINALIZAR TURNO =====
// Si el jugador ya anoto un puntaje (markedThisTurn) pero no presiona "Finalizar Turno",
// le mostramos un modal con sonido para recordarselo, repitiendo el aviso si lo ignora.
const END_TURN_REMINDER_FIRST_DELAY = 10000;  // ms antes del primer aviso
const END_TURN_REMINDER_REPEAT_DELAY = 20000; // ms entre avisos si se sigue ignorando
let endTurnReminderTimer = null;

function scheduleEndTurnReminder(delay = END_TURN_REMINDER_FIRST_DELAY) {
    clearTimeout(endTurnReminderTimer);
    endTurnReminderTimer = setTimeout(() => {
        if (turnReady()) showEndTurnReminder();
    }, delay);
}
function cancelEndTurnReminder() {
    clearTimeout(endTurnReminderTimer);
    endTurnReminderTimer = null;
    const modal = document.getElementById('endTurnReminderModal');
    if (modal) modal.style.display = 'none';
}
function showEndTurnReminder() {
    const modal = document.getElementById('endTurnReminderModal');
    if (!modal) return;
    modal.style.display = 'flex';
    sfxReminder();
    // Si lo sigue ignorando, se lo volvemos a recordar mas adelante.
    scheduleEndTurnReminder(END_TURN_REMINDER_REPEAT_DELAY);
}
function closeEndTurnReminder() {
    const modal = document.getElementById('endTurnReminderModal');
    if (modal) modal.style.display = 'none';
}
function endTurnFromReminder() {
    cancelEndTurnReminder();
    endTurn();
}

// ===== TOAST DE EVENTOS =====
let pendingEvents = [];
// Cola de mensajes a mostrar en el toast: si llegan varios casi al mismo tiempo
// (ej. "Es tu turno" justo despues de un YATZY/BONO del jugador anterior), se
// muestran uno tras otro en vez de que el ultimo pise al que estaba en pantalla.
let toastQueue = [];
let toastShowing = false;
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
    toastQueue.push(text);
    processToastQueue();
}
function processToastQueue() {
    if (toastShowing || toastQueue.length === 0) return;
    toastShowing = true;
    const el = document.getElementById('eventToast');
    el.textContent = toastQueue.shift();
    el.classList.add('show');
    clearTimeout(showEventToast._t);
    showEventToast._t = setTimeout(() => {
        el.classList.remove('show');
        // Pequena pausa (coincide con la transicion de salida en CSS, 0.35s) antes de
        // mostrar el siguiente, para que no se corten uno al otro.
        setTimeout(() => { toastShowing = false; processToastQueue(); }, 350);
    }, 3500);
}
function broadcastEvent(text) {
    publishRoom({ action: 'event_toast', id: myId, text });
}

// ===== DADOS =====
function currentTurnPlayerId() { return turnOrder[currentTurnIndex]; }

// Datos del turno que se dibujan: el mio (interactivo) o el "en vivo" del jugador en turno
function viewTurn() {
    if (isMyTurn()) return { mine: true, ...myTurn };
    const live = gameStarted && liveTurnData && liveTurnData.id === currentTurnPlayerId() ? liveTurnData : null;
    if (live) return { mine: false, roll: live.roll || [], selected: live.selected || [], selScore: live.selScore || 0, points: live.points || 0, result: live.result || null };
    return { mine: false, roll: Array(DICE_COUNT).fill(null), selected: [], selScore: 0, points: 0, result: null };
}

function renderDice() {
    const row = document.getElementById('diceRow');
    if (!row) return;
    row.innerHTML = '';
    const t = viewTurn();
    const interactive = t.mine && t.result !== 'bank';
    t.roll.forEach((val, idx) => {
        const cell = document.createElement('div');
        cell.className = 'die-cell' + (val ? ' filled' : '')
            + (t.selected.includes(idx) ? ' selected' : '')
            + (t.result === 'farkle' ? ' farkle' : '')
            + (!t.mine ? ' readonly' : (!interactive ? ' disabled' : ''));
        cell.innerHTML = pipsHTML(val);
        if (interactive) attachDieHandlers(cell, idx);
        row.appendChild(cell);
    });
}

function attachDieHandlers(cell, idx) {
    cell.addEventListener('click', () => tapDie(idx));
}

// Tocar un dado = ingresar o corregir su valor (los puntos se eligen en las opciones de abajo)
function tapDie(idx) {
    if (!isMyTurn() || myTurn.result === 'bank') return;
    openDicePicker(idx);
}
function openDicePicker(idx) {
    if (!isMyTurn() || myTurn.result === 'bank') return;
    primeAudio();
    sfxButton();
    activeDiceIndex = idx;
    document.getElementById('diceModal').style.display = 'flex';
}
function setDiceValue(val) {
    if (activeDiceIndex === null || !isMyTurn()) return;
    const idx = activeDiceIndex;
    activeDiceIndex = null;
    document.getElementById('diceModal').style.display = 'none';
    myTurn.roll[idx] = val;
    myTurn.selected = [];
    myTurn.picks = {};
    evaluateRoll();
    sfxDiceTap();
    turnChanged();
    const row = document.getElementById('diceRow');
    if (row && row.children[idx]) {
        const cell = row.children[idx];
        cell.classList.remove('pop-anim');
        void cell.offsetWidth;
        cell.classList.add('pop-anim');
    }
}
function closeDiceModal() { activeDiceIndex = null; document.getElementById('diceModal').style.display = 'none'; }

// ===== PANEL DEL TURNO =====
function renderScores() {
    renderTurnPanel();
    updateTotalScore();
    updateEndTurnButton();
    applyBoardTheme();
    updateStartButton();
}

function mine0() { return isMyTurn(); }

function renderTurnPanel() {
    const $ = id => document.getElementById(id);
    const t = viewTurn();
    const keepBtn = $('keepBtn'), bankBtn = $('bankBtn'), undoBtn = $('undoBtn');
    if (!keepBtn) return;

    let selScore = 0, selValid = true;
    if (t.selected.length) {
        selScore = mine0() ? selectionInfo().score : t.selScore;
        selValid = selScore > 0;
    }
    $('turnPointsValue').textContent = t.points;
    const selEl = $('selectionValue');
    selEl.textContent = t.selected.length ? (selValid ? '+' + selScore : '✕') : '0';
    selEl.classList.toggle('invalid', t.selected.length > 0 && !selValid);

    const mine = t.mine;
    const canKeep = mine && t.result === null && rollComplete(t) && t.selected.length > 0 && selValid && selScore > 0;
    keepBtn.disabled = !canKeep;
    keepBtn.textContent = canKeep ? `Apartar (+${selScore})` : 'Apartar dados';
    const total = mine ? bankTotal() : 0;
    bankBtn.disabled = !(mine && canBankNow());
    bankBtn.textContent = total > 0 ? `Plantarse (${total})` : 'Plantarse';
    undoBtn.disabled = !(mine && canUndo());

    let hint;
    if (!gameStarted) hint = 'Esperando que el anfitrion inicie la partida.';
    else if (gameFinished) hint = 'La partida termino.';
    else if (!mine) {
        const cur = playersData[currentTurnPlayerId()];
        const n = cur ? cur.name : 'Jugador';
        if (t.result === 'bank') hint = `${n} se planta con ${t.points} pts.`;
        else if (t.result === 'farkle') hint = `${n} hizo FARKLE.`;
        else hint = `${n} lleva ${t.points} pts en este turno.`;
    } else if (t.result === 'bank') hint = `Te plantas con ${t.points} pts. Presiona "Finalizar Turno".`;
    else if (t.result === 'farkle') hint = 'FARKLE: pierdes los puntos del turno. Presiona "Finalizar Turno" (o corrige un dado manteniendolo presionado).';
    else if (rollEmpty(t)) hint = `Lanza tus ${t.roll.length} dados y toca cada casilla para ingresar su valor.`;
    else if (!rollComplete(t)) hint = `Faltan ${t.roll.filter(v => v === null).length} dados por ingresar.`;
    else hint = 'Elige abajo las combinaciones que quieres apartar (toca otra vez para sumar mas dados).';
    if (mine && t.result === null && !myState.onBoard && total > 0 && total < OPEN_THRESHOLD) {
        hint += ` Necesitas ${OPEN_THRESHOLD} pts para entrar al marcador.`;
    }
    $('turnHint').textContent = hint;
    renderOptions(t);

    $('farkleMeter').textContent = gameStarted
        ? `Farkles seguidos: ${myState.farkles}/${MAX_FARKLES} · ${myState.onBoard ? 'En marcador' : 'Fuera del marcador (min. ' + OPEN_THRESHOLD + ')'}`
        : '';
}

function updateTotalScore() {
    const el = document.getElementById('myTotalScore');
    if (el) el.textContent = myState.score;
}

function renderTurnBanner() {
    const banner = document.getElementById('turnBanner');
    const resetBtn = document.getElementById('resetGameBtn');
    if (resetBtn) resetBtn.style.display = (isRoomCreator && gameStarted && currentRoom) ? 'block' : 'none';
    updateStartButton();
    if (!banner) return;
    if (!gameStarted) {
        banner.textContent = 'Esperando inicio...';
        banner.classList.remove('my-turn');
        return;
    }
    if (gameFinished) { banner.textContent = 'Partida terminada'; banner.classList.remove('my-turn'); return; }
    if (turnOrder.length === 0) { banner.textContent = ''; banner.classList.remove('my-turn'); return; }
    const currentId = turnOrder[currentTurnIndex];
    const currentName = (playersData[currentId] && playersData[currentId].name) || (currentId === myId ? myName : '??');
    const last = finalTriggerId ? ' · ¡ULTIMA RONDA!' : '';
    if (currentId === myId) { banner.textContent = 'Tu turno — lanza los dados' + last; banner.classList.add('my-turn'); }
    else { banner.textContent = `Turno de: ${currentName}` + last; banner.classList.remove('my-turn'); }
    updateEndTurnButton();
}

// ===== BOTONES =====
function updateStartButton() {
    const btn = document.getElementById('startGameBtn');
    if (!btn) return;
    const visible = isRoomCreator && !gameStarted && currentRoom;
    btn.style.display = visible ? 'block' : 'none';
    btn.disabled = !visible;
}
function updateEndTurnButton() {
    const btn = document.getElementById('endTurnBtn');
    if (!btn) return;
    btn.disabled = !(isMyTurn() && myTurn.result !== null);
}

// ===== OPCIONES DE PUNTAJE (misma estructura que las categorias del Yatzy) =====
// Columna izquierda: trios (figura del dado). Columna derecha: sueltos y combinaciones.
const OPTION_COLUMNS = {
    upperCol: ['t1', 't2', 't3', 't4', 't5', 't6'],
    lowerCol: ['s1', 's5', 'straight', 'fourpair', 'pairs3', 'twotrip']
};

function optionIconHTML(def) {
    switch (def.key) {
        case 's1': return '<span class="cat-symbol">100</span>';
        case 's5': return '<span class="cat-symbol">50</span>';
        case 'straight': return cardsIconSVG(5) + '<span class="cat-sub">LARGE</span>';
        case 'fourpair': return '<span class="cat-symbol">4•2</span>';
        case 'pairs3': return '<span class="cat-symbol">2•2•2</span>';
        case 'twotrip': return '<span class="cat-symbol">3•3</span>';
        default: return pipsHTML(def.face);
    }
}

function optionTipText(def) {
    const money = n => optionPoints(def.key, n);
    if (def.kind === 'single') return `Necesitas al menos un dado con el ${def.face}. Cada uno vale ${money(1)} puntos. Toca la casilla otra vez para apartar mas de uno.`;
    if (def.kind === 'triple') return `Necesitas 3 dados con el ${def.face}: vale ${money(3)} puntos. Cada dado extra igual duplica el valor (4 = ${money(4)}, 5 = ${money(5)}, 6 = ${money(6)}).`;
    const extra = {
        straight: 'Necesitas los 6 dados distintos: 1, 2, 3, 4, 5 y 6.',
        pairs3: 'Necesitas 3 pares de numeros distintos (por ejemplo 2-2, 4-4 y 6-6).',
        fourpair: 'Necesitas 4 dados iguales y un par de otro numero (por ejemplo 3-3-3-3 y 5-5).',
        twotrip: 'Necesitas dos trios de numeros distintos (por ejemplo 3-3-3 y 5-5-5).'
    }[def.key];
    return `${extra} Usa los 6 dados y vale ${def.pts} puntos.`;
}
function showTooltip(key) {
    const def = optionDef(key);
    if (!def) return;
    document.getElementById('tooltipTitle').textContent = def.label;
    document.getElementById('tooltipText').textContent = optionTipText(def);
    document.getElementById('tooltipModal').style.display = 'flex';
}

function buildOptionRows() {
    Object.keys(OPTION_COLUMNS).forEach(colId => {
        const col = document.getElementById(colId);
        if (!col) return;
        col.innerHTML = '';
        OPTION_COLUMNS[colId].forEach(key => {
            const def = optionDef(key);
            const row = document.createElement('div');
            row.className = 'cat-row';
            const catCell = document.createElement('div');
            catCell.className = 'cat-cell';
            catCell.innerHTML = optionIconHTML(def);
            catCell.addEventListener('click', () => showTooltip(key));
            const scoreCell = document.createElement('div');
            scoreCell.className = 'score-cell';
            scoreCell.id = `score-${key}`;
            scoreCell.addEventListener('click', () => cycleOption(key));
            row.appendChild(catCell);
            row.appendChild(scoreCell);
            col.appendChild(row);
        });
    });
}

function renderOptions(t) {
    const upper = document.getElementById('upperCol');
    if (!upper) return;
    if (!upper.children.length) buildOptionRows();
    const mine = t.mine && gameStarted && !gameFinished;
    const myColor = myColorHex();
    OPTION_CATALOG.forEach(def => {
        const cell = document.getElementById(`score-${def.key}`);
        if (!cell) return;
        const cur = mine ? (myTurn.picks[def.key] || 0) : 0;
        const max = mine ? optionMax(def.key, myTurn) : 0;
        const min = optionMinQty(def);
        const available = cur > 0 || max >= min;
        const wasSelected = cell.classList.contains('locked');
        cell.classList.remove('locked', 'ghost', 'disabled-turn');
        cell.style.background = ''; cell.style.borderColor = ''; cell.style.color = '';
        cell.innerHTML = '';
        if (cur > 0) {
            cell.textContent = optionPoints(def.key, cur);
            cell.classList.add('locked');
            cell.style.background = myColor; cell.style.borderColor = myColor; cell.style.color = readableTextOn(myColor);
            cell.style.cursor = 'pointer';
            if (cur > min) cell.insertAdjacentHTML('beforeend', `<span class="yatzy-checks">${def.kind === 'single' ? '×' + cur : cur}</span>`);
            if (!wasSelected) triggerPop(cell.id);
        } else if (available) {
            cell.textContent = optionPoints(def.key, min);
            cell.classList.add('ghost');
        } else {
            cell.classList.add('disabled-turn');
        }
    });
}

function closeTooltip() { document.getElementById('tooltipModal').style.display = 'none'; }

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

let viewingPlayerId = null;

function openViewPlayer(id) {
    const p = playersData[id];
    if (!p) { closeViewPlayer(); return; }
    viewingPlayerId = id;
    document.getElementById('viewPlayerTitle').textContent = `${p.name}${id === myId ? ' (Tu)' : ''}`;
    const hex = colorHexOf(p.color);
    const chip = t => t.t === 'bank' ? `<span class="vp-chip bank">+${t.pts}</span>`
        : t.t === 'penalty' ? `<span class="vp-chip penalty">${t.pts}</span>`
        : '<span class="vp-chip farkle">Farkle</span>';
    const turns = (p.turns || []).slice().reverse();
    document.getElementById('viewPlayerSheet').innerHTML = `
        <div class="vp-score" style="border-color:${hex};">${p.score || 0}</div>
        <p class="vp-meta">${p.onBoard ? 'En marcador' : 'Aun sin entrar al marcador'} · Farkles seguidos: ${p.farkles || 0}/${MAX_FARKLES}</p>
        <div class="vp-turns">${turns.length ? turns.map(chip).join('') : '<span class="log-empty">Sin turnos todavia.</span>'}</div>`;
    document.getElementById('viewPlayerModal').style.display = 'flex';
}
function closeViewPlayer() {
    viewingPlayerId = null;
    document.getElementById('viewPlayerModal').style.display = 'none';
}
function refreshViewPlayerIfOpen() {
    if (!viewingPlayerId) return;
    const modal = document.getElementById('viewPlayerModal');
    if (!modal || modal.style.display !== 'flex') { viewingPlayerId = null; return; }
    if (!playersData[viewingPlayerId]) { closeViewPlayer(); return; }
    openViewPlayer(viewingPlayerId);
}

// ===== AVISO GENERAL =====
function showNotice(text, title = 'Aviso') {
    document.getElementById('noticeTitle').textContent = title;
    document.getElementById('noticeText').textContent = text;
    document.getElementById('noticeModal').style.display = 'flex';
}
function closeNotice() { document.getElementById('noticeModal').style.display = 'none'; }

function closeResetGameModal() {
    document.getElementById('resetGameModal').style.display = 'none';
}