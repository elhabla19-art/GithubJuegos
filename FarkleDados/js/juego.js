// ===== PUNTUACION DE FARKLE =====
const TARGET_SCORE = 10000;     // meta: al llegarla, los demas juegan una ultima ronda
const OPEN_THRESHOLD = 500;     // minimo en un turno para "entrar" al marcador
const MAX_FARKLES = 3;          // 3 Farkles seguidos = penalizacion
const FARKLE_PENALTY = 1000;
const DICE_COUNT = 6;

function countsOf(dice) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    dice.forEach(d => c[d]++);
    return c;
}
function distinctCounts(dice) { return countsOf(dice).slice(1).filter(x => x > 0); }

// Devuelve { score, valid }. valid = TODOS los dados de la seleccion puntuan.
function scoreSelection(dice) {
    if (!dice.length) return { score: 0, valid: false };
    const c = countsOf(dice);
    if (dice.length === 6) {
        const d = distinctCounts(dice);
        if (d.length === 6) return { score: 1500, valid: true };                                   // escalera 1-6
        if (d.length === 3 && d.every(n => n === 2)) return { score: 1500, valid: true };          // tres pares
        if (d.length === 2 && d.every(n => n === 3)) return { score: 2500, valid: true };          // dos trios
        if (d.length === 2 && d.includes(4) && d.includes(2)) return { score: 1500, valid: true }; // cuatro + par
    }
    let total = 0, valid = true;
    for (let f = 1; f <= 6; f++) {
        const n = c[f];
        if (!n) continue;
        if (n >= 3) total += (f === 1 ? 1000 : f * 100) * Math.pow(2, n - 3);
        else if (f === 1) total += 100 * n;
        else if (f === 5) total += 50 * n;
        else valid = false;
    }
    return { score: total, valid };
}

// ¿Hay al menos un dado que puntue en esta tirada? Si no, es Farkle.
function hasScoringDice(dice) {
    const c = countsOf(dice);
    if (c[1] > 0 || c[5] > 0 || c.some(n => n >= 3)) return true;
    return dice.length === 6 && scoreSelection(dice).valid;
}

const PLAYER_COLORS = [
    { id: 'rojo', hex: '#C7403F' },
    { id: 'azul', hex: '#4A6FA5' },
    { id: 'verde_oscuro', hex: '#265F56' },
    { id: 'amarillo', hex: '#D6A518' },
    { id: 'rosado', hex: '#E0729A' },
    { id: 'naranja', hex: '#D9822B' },
    { id: 'morado', hex: '#8B5FBF' },
    { id: 'celeste', hex: '#5BC0DE' },
    { id: 'lila', hex: '#B39DDB' },
    { id: 'verde_limon', hex: '#9CCC65' }
];
function colorHexOf(colorId) {
    const found = PLAYER_COLORS.find(c => c.id === colorId);
    return found ? found.hex : '#808BC3';
}

// ===== ASIGNACION "PEGAJOSA" DE COLORES (nunca duplicados, se mantienen por jugador) =====
// Reutiliza el color que cada jugador ya tenia (si sigue siendo valido y no esta tomado
// por otro jugador en el mismo calculo) y solo asigna colores nuevos a quien no tiene.
// Esto garantiza que 2 jugadores nunca compartan color y que el color de un jugador
// se mantenga igual desde la sala de espera, durante la partida y en el resumen final.
function computeStickyColors(order, existingColors) {
    existingColors = existingColors || {};
    const colors = {};
    const used = new Set();
    order.forEach(id => {
        const existing = existingColors[id];
        if (existing && PLAYER_COLORS.some(c => c.id === existing) && !used.has(existing)) {
            colors[id] = existing;
            used.add(existing);
        }
    });
    const allIds = PLAYER_COLORS.map(c => c.id);
    order.forEach((id, idx) => {
        if (colors[id]) return;
        const free = allIds.find(cid => !used.has(cid));
        const chosen = free || allIds[idx % allIds.length];
        colors[id] = chosen;
        used.add(chosen);
    });
    return colors;
}


// ===== ESTADO DEL JUGADOR =====
let myName = "Jugador";
let myId = Math.random().toString(36).substr(2, 9);

function freshState() { return { score: 0, onBoard: false, farkles: 0, turns: [] }; }
let myState = freshState();
// Solo lo que se comparte con la sala / se guarda en sesion
function pickState(o) {
    return { score: o.score || 0, onBoard: !!o.onBoard, farkles: o.farkles || 0, turns: Array.isArray(o.turns) ? o.turns : [] };
}
function publicState() { return pickState({ ...myState, turns: myState.turns.slice(-40) }); }
function hasProgress(s) { return !!s && ((s.score || 0) !== 0 || !!s.onBoard || (Array.isArray(s.turns) && s.turns.length > 0)); }
function isFreshPlayer() { return !hasProgress(myState); }

// Estado del turno en curso (solo vive en el dispositivo de quien juega; los demas lo ven via 'live_turn')
function freshTurn() {
    return { started: false, diceLeft: DICE_COUNT, roll: Array(DICE_COUNT).fill(null), selected: [], picks: {}, points: 0, result: null, stack: [] };
}
let myTurn = freshTurn();
let liveTurnData = null;     // turno en vivo del jugador al que le toca (si no soy yo)
let activeDiceIndex = null;

// ===== LOG COMPARTIDO =====
let gameLog = [];
let seenLogIds = new Set();
const LOG_MAX_ENTRIES = 300;

function logMove(kind, payload) {
    const entry = {
        logId: `${myId}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ts: Date.now(), playerName: myName, kind, ...payload
    };
    addLogEntry(entry, true);
}
function addLogEntry(entry, shouldBroadcast) {
    if (!entry || seenLogIds.has(entry.logId)) return;
    seenLogIds.add(entry.logId);
    gameLog.push(entry);
    if (gameLog.length > LOG_MAX_ENTRIES) gameLog.splice(0, gameLog.length - LOG_MAX_ENTRIES);
    renderLog();
    if (shouldBroadcast && currentRoom && mqttClient) {
        publishRoom({ action: 'log_entry', id: myId, entry });
    }
}
function renderLog() {
    const el = document.getElementById('gameLogList');
    if (!el) return;
    if (gameLog.length === 0) { el.innerHTML = '<p class="log-empty">Sin movimientos todavia.</p>'; return; }
    el.innerHTML = gameLog.slice().reverse().map(e => {
        const time = new Date(e.ts).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let verb, targetHtml = '';
        if (e.kind === 'bank') {
            verb = 'se planto y sumo';
            targetHtml = `<span class="log-target">+${e.value} (total ${e.total})</span>`;
        } else if (e.kind === 'farkle') {
            verb = 'hizo FARKLE';
            if (e.lost > 0) targetHtml = `<span class="log-target log-bad">-${e.lost} del turno</span>`;
        } else if (e.kind === 'penalty') {
            verb = `perdio ${FARKLE_PENALTY} por ${MAX_FARKLES} Farkles seguidos`;
        } else if (e.kind === 'reset') {
            verb = 'reinicio la partida para todos';
        } else return '';
        return `<div class="log-entry"><span class="log-time">${time}</span><span class="log-player">${e.playerName}</span><span class="log-verb">${verb}</span>${targetHtml}</div>`;
    }).join('');
}

// ===== LOGICA DEL TURNO =====
function rollComplete(t) { return t.roll.length > 0 && t.roll.every(v => v !== null); }
function rollEmpty(t) { return t.roll.every(v => v === null); }
function turnReady() { return isMyTurn() && myTurn.result !== null; }
function selectionInfo() {
    const t = myTurn;
    let score = 0;
    Object.keys(t.picks).forEach(k => { score += optionPoints(k, t.picks[k]); });
    return { score, valid: score > 0 };
}
function snapshotTurn() {
    const t = myTurn;
    return { diceLeft: t.diceLeft, roll: t.roll.slice(), selected: t.selected.slice(), picks: { ...t.picks }, points: t.points, result: t.result };
}

// Se llama cada vez que cambia algo del turno propio
function turnChanged() {
    renderDice();
    renderScores();
    broadcastLiveTurn();
}
function broadcastLiveTurn() {
    if (!isMyTurn()) return;
    publishRoom({ action: 'live_turn', id: myId, roll: myTurn.roll, selected: myTurn.selected, selScore: selectionInfo().score, points: myTurn.points, result: myTurn.result });
}

// Revisa si la tirada completa es un Farkle (ningun dado puntua)
function evaluateRoll() {
    const t = myTurn;
    if (t.result === 'bank') return;
    if (rollComplete(t) && !hasScoringDice(t.roll)) {
        if (t.result !== 'farkle') {
            t.result = 'farkle';
            t.selected = [];
            t.picks = {};
            showEventToast('¡FARKLE! Ningun dado puntua');
            sfxFarkle();
            scheduleEndTurnReminder();
        }
    } else if (t.result === 'farkle') {
        t.result = null;
        cancelEndTurnReminder();
    }
}

// ===== OPCIONES DE PUNTAJE (como las categorias del Yatzy) =====
// Cada opcion solo se puede elegir si la tirada actual cumple el criterio.
const OPTION_CATALOG = [
    { key: 's1', kind: 'single', face: 1, label: 'Unos sueltos' },
    { key: 's5', kind: 'single', face: 5, label: 'Cincos sueltos' },
    { key: 't1', kind: 'triple', face: 1, label: 'Trio de 1s' },
    { key: 't2', kind: 'triple', face: 2, label: 'Trio de 2s' },
    { key: 't3', kind: 'triple', face: 3, label: 'Trio de 3s' },
    { key: 't4', kind: 'triple', face: 4, label: 'Trio de 4s' },
    { key: 't5', kind: 'triple', face: 5, label: 'Trio de 5s' },
    { key: 't6', kind: 'triple', face: 6, label: 'Trio de 6s' },
    { key: 'straight', kind: 'special', label: 'Escalera 1-6', pts: 1500 },
    { key: 'pairs3', kind: 'special', label: 'Tres pares', pts: 1500 },
    { key: 'fourpair', kind: 'special', label: '4 iguales + par', pts: 1500 },
    { key: 'twotrip', kind: 'special', label: 'Dos trios', pts: 2500 }
];
function optionDef(key) { return OPTION_CATALOG.find(o => o.key === key); }
function optionMinQty(def) { return def.kind === 'triple' ? 3 : 1; }

function optionPoints(key, qty) {
    const def = optionDef(key);
    if (!def || !qty) return 0;
    if (def.kind === 'special') return def.pts;
    if (def.kind === 'single') return (def.face === 1 ? 100 : 50) * qty;
    return (def.face === 1 ? 1000 : def.face * 100) * Math.pow(2, qty - 3);
}

function specialMatches(key, roll) {
    if (roll.length !== 6) return false;
    const d = distinctCounts(roll);
    if (key === 'straight') return d.length === 6;
    if (key === 'pairs3') return d.length === 3 && d.every(n => n === 2);
    if (key === 'twotrip') return d.length === 2 && d.every(n => n === 3);
    if (key === 'fourpair') return d.length === 2 && d.includes(4) && d.includes(2);
    return false;
}

// Cantidad maxima que se puede elegir ahora de esta opcion (0 = no disponible)
function optionMax(key, t) {
    if (!rollComplete(t) || t.result !== null) return 0;
    const def = optionDef(key);
    const picks = t.picks;
    const anyOther = Object.keys(picks).some(k => k !== key && picks[k] > 0);
    const specialPicked = Object.keys(picks).some(k => optionDef(k).kind === 'special' && picks[k] > 0);
    if (def.kind === 'special') {
        if (!specialMatches(key, t.roll)) return 0;
        return anyOther ? 0 : 1;
    }
    if (specialPicked) return 0;
    const c = countsOf(t.roll);
    if (def.kind === 'single') return c[def.face] - (picks['t' + def.face] || 0);
    const avail = c[def.face] - (picks['s' + def.face] || 0);
    return avail >= 3 ? avail : 0;
}

// Asigna a cada opcion elegida los dados concretos que usa (para resaltarlos)
function recomputeSelected(t) {
    const sel = [];
    const special = Object.keys(t.picks).some(k => optionDef(k).kind === 'special' && t.picks[k] > 0);
    if (special) t.roll.forEach((_, i) => sel.push(i));
    else {
        for (let f = 1; f <= 6; f++) {
            const idx = [];
            t.roll.forEach((v, i) => { if (v === f) idx.push(i); });
            const n = (t.picks['t' + f] || 0) + (t.picks['s' + f] || 0);
            sel.push(...idx.slice(0, n));
        }
    }
    t.selected = sel;
}

// Tocar una opcion la elige; si admite mas dados, tocarla de nuevo suma uno mas; al llegar al maximo se quita.
function cycleOption(key) {
    const t = myTurn;
    if (!isMyTurn() || t.result !== null) return;
    const def = optionDef(key);
    const cur = t.picks[key] || 0;
    const max = optionMax(key, t);
    const min = optionMinQty(def);
    if (cur === 0) { if (max < min) return; t.picks[key] = min; }
    else if (cur < max) t.picks[key] = cur + 1;
    else delete t.picks[key];
    recomputeSelected(t);
    sfxDiceTap();
    turnChanged();
}

function keepDice() {
    const t = myTurn;
    if (!isMyTurn() || t.result !== null || !rollComplete(t)) return;
    const info = selectionInfo();
    if (!info.valid || info.score <= 0) return;
    t.stack.push(snapshotTurn());
    t.points += info.score;
    t.diceLeft -= t.selected.length;
    if (t.diceLeft === 0) {
        t.diceLeft = DICE_COUNT;
        showEventToast('¡Dados calientes! Tira los 6 de nuevo');
        sfxBonus();
    } else sfxLock();
    t.roll = Array(t.diceLeft).fill(null);
    t.selected = [];
    t.picks = {};
    turnChanged();
}

// Total que se llevaria el jugador si se planta ahora (0 = no puede plantarse)
function bankTotal() {
    const t = myTurn;
    if (!isMyTurn() || t.result !== null) return 0;
    if (rollEmpty(t)) return t.points;
    if (rollComplete(t)) {
        const info = selectionInfo();
        return (info.valid && info.score > 0) ? t.points + info.score : 0;
    }
    return 0;
}
function canBankNow() {
    const total = bankTotal();
    return total > 0 && (myState.onBoard || total >= OPEN_THRESHOLD);
}

function bankPoints() {
    if (!canBankNow()) return;
    const t = myTurn;
    t.stack.push(snapshotTurn());
    if (!rollEmpty(t)) {                       // se planta apartando la seleccion actual
        t.points += selectionInfo().score;
        t.diceLeft -= t.selected.length;
        if (t.diceLeft === 0) t.diceLeft = DICE_COUNT;
        t.roll = Array(t.diceLeft).fill(null);
        t.selected = [];
        t.picks = {};
    }
    t.result = 'bank';
    scheduleEndTurnReminder();
    sfxLock();
    turnChanged();
}

// Un solo boton "Deshacer": cancela plantarse -> borra la tirada actual -> revierte el ultimo apartado
function undoTurnStep() {
    const t = myTurn;
    if (!isMyTurn()) return;
    if (t.result === 'bank') {
        t.result = null;
        cancelEndTurnReminder();
    } else if (!rollEmpty(t)) {
        t.roll = Array(t.diceLeft).fill(null);
        t.selected = [];
        t.picks = {};
        t.result = null;
        cancelEndTurnReminder();
    } else if (t.stack.length) {
        Object.assign(t, t.stack.pop());
        t.result = null;
    } else return;
    sfxUndo();
    turnChanged();
}
function canUndo() {
    const t = myTurn;
    return isMyTurn() && (t.result === 'bank' || !rollEmpty(t) || t.stack.length > 0);
}

// Aplica de forma definitiva el resultado del turno (se llama al "Finalizar Turno")
function commitTurnResult() {
    const t = myTurn;
    if (t.result === 'bank') {
        myState.score += t.points;
        myState.onBoard = true;
        myState.farkles = 0;
        myState.turns.push({ t: 'bank', pts: t.points });
        logMove('bank', { value: t.points, total: myState.score });
        if (!finalTriggerId && myState.score >= TARGET_SCORE) {
            finalTriggerId = myId;
            queueEvent('target', `${myName} llego a ${TARGET_SCORE}! Ultima ronda para los demas`);
        }
    } else if (t.result === 'farkle') {
        myState.farkles++;
        myState.turns.push({ t: 'farkle', pts: 0 });
        logMove('farkle', { lost: t.points });
        queueEvent('farkle', `${myName} hizo FARKLE!`);
        if (myState.farkles >= MAX_FARKLES) {
            myState.score = Math.max(0, myState.score - FARKLE_PENALTY);
            myState.farkles = 0;
            myState.turns.push({ t: 'penalty', pts: -FARKLE_PENALTY });
            logMove('penalty', {});
            queueEvent('penalty', `${myName} perdio ${FARKLE_PENALTY} por ${MAX_FARKLES} Farkles seguidos`);
        }
    }
    if (myState.turns.length > 60) myState.turns.splice(0, myState.turns.length - 60);
}

// ===== GUARDAR / SINCRONIZAR ESTADO =====
function saveState() {
    updateTotalScore();
    if (currentRoom) {
        playersData[myId] = { name: myName, color: playerColors[myId] || null, ...publicState() };
        renderLeaderboard();
        broadcastSync();
        persistSession();
        persistRegistry();
    }
}
function broadcastSync(action = 'sync') {
    publishRoom({ action, id: myId, name: myName, color: playerColors[myId] || null, ...publicState(), hostId });
}

// ===== LOBBY: ENTRAR SALA =====
function entrarSala() {
    var nombre = localStorage.getItem('farkle_nombre_prefill');
    var sala = localStorage.getItem('farkle_sala_prefill');

    if (!nombre) {
        showNotice('No se ha configurado un nombre. Usa ?nombre=XXX en la URL.', 'Falta nombre');
        return;
    }
    if (!sala || sala.length !== 4) {
        showNotice('No se ha configurado una sala valida. Usa ?sala=XXXX en la URL.', 'Sala invalida');
        return;
    }

    myName = nombre;
    myId = Math.random().toString(36).substr(2, 9);
    myState = freshState();
    myTurn = freshTurn();
    liveTurnData = null;
    finalTriggerId = null;
    isRoomCreator = false;
    hostId = null;
    cancelEndTurnReminder();

    localStorage.removeItem('farkle_nombre_prefill');
    localStorage.removeItem('farkle_sala_prefill');

    connectToRoom(sala.toUpperCase());
}

// ===== EXITO AL UNIRSE (CORREGIDO) =====
function joinSuccess(code) {
    hideLoading();
    document.getElementById('lobbyModal').style.display = 'none';
    var info = document.getElementById('roomInfoDisplay');
    info.style.display = 'inline-block';
    info.textContent = 'SALA: ' + code;
    document.getElementById('gameArea').style.display = 'flex';
    document.getElementById('leaderboardPanel').style.display = 'flex';
    document.getElementById('gameLogPanel').style.display = 'flex';
    // Renderizar todo el estado inicial
    renderDice();
    renderScores();
    renderLeaderboard();
    renderLog();
    renderTurnBanner(); // mostrará "Esperando inicio..." si gameStarted es false
    updateStartButton(); // mostrar/ocultar botón de inicio según rol y estado
    updateEndTurnButton(); // deshabilitar Finalizar Turno
}

// ===== UTILIDADES =====
function showLoading(text) { document.getElementById('loadingText').textContent = text; document.getElementById('loadingModal').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingModal').style.display = 'none'; }