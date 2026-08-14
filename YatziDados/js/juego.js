// ===== CONFIGURACION DE CATEGORIAS =====
function countsOf(dice) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    dice.forEach(d => c[d]++);
    return c;
}
function sumAll(dice) { return dice.reduce((a, b) => a + b, 0); }
function sumOfNumber(dice, n) { return dice.filter(d => d === n).length * n; }
function hasCountAtLeast(dice, n) { return countsOf(dice).some(c => c >= n); }
function isFullHouse(dice) {
    const c = countsOf(dice).filter(x => x > 0);
    return c.length === 2 && c.includes(3) && c.includes(2);
}
function isSmallStraight(dice) {
    const set = new Set(dice);
    return [[1,2,3,4],[2,3,4,5],[3,4,5,6]].some(seq => seq.every(n => set.has(n)));
}
function isLargeStraight(dice) {
    const set = new Set(dice);
    return [[1,2,3,4,5],[2,3,4,5,6]].some(seq => seq.every(n => set.has(n)) && set.size === 5);
}
function isYatzy(dice) { return dice.every(d => d === dice[0]); }

const CATEGORIES = [
    { id: 'ones',   section: 'upper', label: 'Unos',    iconType: 'die', dieValue: 1, calc: d => sumOfNumber(d, 1) },
    { id: 'twos',   section: 'upper', label: 'Doses',   iconType: 'die', dieValue: 2, calc: d => sumOfNumber(d, 2) },
    { id: 'threes', section: 'upper', label: 'Treses',  iconType: 'die', dieValue: 3, calc: d => sumOfNumber(d, 3) },
    { id: 'fours',  section: 'upper', label: 'Cuatros', iconType: 'die', dieValue: 4, calc: d => sumOfNumber(d, 4) },
    { id: 'fives',  section: 'upper', label: 'Cincos',  iconType: 'die', dieValue: 5, calc: d => sumOfNumber(d, 5) },
    { id: 'sixes',  section: 'upper', label: 'Seises',  iconType: 'die', dieValue: 6, calc: d => sumOfNumber(d, 6) },
    { id: 'threeKind',     section: 'lower', label: '3 del mismo número',    iconType: 'text', icon: '3X',  calc: d => hasCountAtLeast(d, 3) ? sumAll(d) : 0 },
    { id: 'fourKind',      section: 'lower', label: '4 del mismo número',    iconType: 'text', icon: '4X',  calc: d => hasCountAtLeast(d, 4) ? sumAll(d) : 0 },
    { id: 'fullHouse',     section: 'lower', label: 'Full (3+2)',            iconType: 'house', calc: d => isFullHouse(d) ? 25 : 0 },
    { id: 'smallStraight', section: 'lower', label: 'Secuencia de 4',        iconType: 'cards', sub: 'SMALL', calc: d => isSmallStraight(d) ? 30 : 0 },
    { id: 'largeStraight', section: 'lower', label: 'Secuencia de 5',        iconType: 'cards', sub: 'LARGE', calc: d => isLargeStraight(d) ? 40 : 0 },
    { id: 'yatzy',         section: 'lower', label: 'Yatzy (5 iguales)',     iconType: 'yatzy', calc: d => isYatzy(d) ? 50 : 0 },
    { id: 'chance',        section: 'lower', label: 'Probabilidad',         iconType: 'text', icon: '?', calc: d => sumAll(d) }
];

const TOOLTIP_TEXT = {
    ones: 'Cuenta y suma solo los números uno.',
    twos: 'Cuenta y suma solo los números dos.',
    threes: 'Cuenta y suma solo los números tres.',
    fours: 'Cuenta y suma solo los números cuatro.',
    fives: 'Cuenta y suma solo los números cinco.',
    sixes: 'Cuenta y suma solo los números seis.',
    threeKind: 'Suma el total de todos los dados.',
    fourKind: 'Suma el total de todos los dados.',
    fullHouse: 'Puntuación fija: 25 (3 del mismo número y 2 del mismo número).',
    smallStraight: 'Puntuación fija: 30 (secuencia de 4 números consecutivos).',
    largeStraight: 'Puntuación fija: 40 (secuencia de 5 números consecutivos).',
    yatzy: 'Puntuación fija: 50 (5 dados con el mismo número).',
    chance: 'Suma cualquier combinación de los 5 dados.',
    bonus: 'Anota al menos 63 puntos en tu lado superior y obtén 35 puntos extra.'
};

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

function emptyScores() {
    const s = {};
    CATEGORIES.forEach(c => s[c.id] = null);
    return s;
}
function upperSum(scores) {
    return ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes']
        .reduce((sum, id) => sum + (scores[id] || 0), 0);
}
function upperBonus(scores) { return upperSum(scores) >= 63 ? 35 : 0; }
function lowerSum(scores) {
    return ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yatzy', 'chance']
        .reduce((sum, id) => sum + (scores[id] || 0), 0);
}
function totalScore(scores, extraYatzys) {
    return upperSum(scores) + upperBonus(scores) + lowerSum(scores) + (extraYatzys || 0) * 100;
}

// ===== ESTADO DEL JUGADOR =====
let myName = "Jugador";
let myId = Math.random().toString(36).substr(2, 9);
let myScores = emptyScores();
let myExtraYatzys = 0;
let myBonusAnnounced = false;
let myDice = [null, null, null, null, null];
let activeDiceIndex = null;
let markedThisTurn = false;
let jokerModeActive = false;
let lastMarkedCatId = null;
let lastMarkedWasJoker = false;

// ===== ESTADO DE TURNOS =====
let pendingOrder = [];
let turnOrder = [];
let playerColors = {};
let currentTurnIndex = 0;
let gameStarted = false;
let gameFinished = false;

function isMyTurn() {
    return gameStarted && turnOrder.length > 0 && turnOrder[currentTurnIndex] === myId;
}

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
        mqttClient.publish(`yatzy_app_xyz/room/${currentRoom}`, JSON.stringify({ action: 'log_entry', id: myId, entry }));
    }
}
function renderLog() {
    const el = document.getElementById('gameLogList');
    if (!el) return;
    if (gameLog.length === 0) { el.innerHTML = '<p class="log-empty">Sin movimientos todavia.</p>'; return; }
    el.innerHTML = gameLog.slice().reverse().map(e => {
        const time = new Date(e.ts).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let verb, targetHtml = '';
        if (e.kind === 'score') {
            const cat = CATEGORIES.find(c => c.id === e.catId);
            if (e.action === 'unmark') {
                verb = 'deshizo su anotación en';
                targetHtml = `<span class="log-target">${cat ? cat.label : e.catId}</span>`;
            } else {
                verb = e.auto ? 'anotó (comodín)' : 'anotó';
                targetHtml = `<span class="log-target">${cat ? cat.label : e.catId}: ${e.value}</span>`;
            }
        } else if (e.kind === 'yatzy_extra') {
            if (e.action === 'undo') { verb = 'deshizo su Yatzy extra (-100)'; }
            else { verb = 'logró un YATZY EXTRA'; targetHtml = '<span class="log-target">+100</span>'; }
        } else if (e.kind === 'end_turn') {
            verb = 'finalizó su turno';
        } else if (e.kind === 'reset') {
            verb = 'reinició la partida para todos';
        } else return '';
        return `<div class="log-entry"><span class="log-time">${time}</span><span class="log-player">${e.playerName}</span><span class="log-verb">${verb}</span>${targetHtml}</div>`;
    }).join('');
}

// ===== LOGICA DE COMODIN (JOKER) =====
function jokerEligibleCategories() {
    if (!myDice.every(d => d !== null) || !isYatzy(myDice)) return [];
    const upperIdMap = { 1: 'ones', 2: 'twos', 3: 'threes', 4: 'fours', 5: 'fives', 6: 'sixes' };
    const upperId = upperIdMap[myDice[0]];
    let eligible = [];
    if (myScores[upperId] === null) eligible.push(upperId);
    else ['fullHouse', 'smallStraight', 'largeStraight'].forEach(id => { if (myScores[id] === null) eligible.push(id); });
    if (eligible.length === 0) CATEGORIES.forEach(c => { if (myScores[c.id] === null) eligible.push(c.id); });
    return eligible;
}

function applyJokerScore(catId) {
    if (myScores[catId] !== null) return;
    const jokerFixed = { fullHouse: 25, smallStraight: 30, largeStraight: 40 };
    const value = jokerFixed[catId] !== undefined ? jokerFixed[catId] : CATEGORIES.find(c => c.id === catId).calc(myDice);
    lockCategory(catId, value, { joker: true });
}

function grantExtraYatzy() {
    myExtraYatzys++;
    logMove('yatzy_extra', {});
    const msg = `⭐⭐ ${myName} logró otro YATZY! +100 bono`;
    queueEvent('extra_yatzy', msg);
    jokerModeActive = true;
    saveState();
    renderScores();
    sfxYatzy();
    triggerPop('cat-yatzy');
}

// ===== ANOTAR CATEGORIA =====
function handleCategoryTap(catId) {
    if (!gameStarted || !isMyTurn()) return;

    if (jokerModeActive) {
        // Deshacer el Yatzy extra antes de elegir donde usar el comodin (toca la casilla de Yatzy otra vez)
        if (catId === 'yatzy') { undoExtraYatzy(); return; }
        if (myScores[catId] !== null) return;
        const eligible = jokerEligibleCategories();
        if (!eligible.includes(catId)) return;
        applyJokerScore(catId);
        return;
    }

    if (markedThisTurn) {
        // Deshacer: toca de nuevo la misma casilla que acabas de anotar este turno.
        if (catId === lastMarkedCatId) undoLastCategory();
        return;
    }

    if (myScores[catId] === null) {
        if (!myDice.every(d => d !== null)) return;
        lockCategory(catId, CATEGORIES.find(c => c.id === catId).calc(myDice));
    } else if (catId === 'yatzy' && myDice.every(d => d !== null) && isYatzy(myDice)) {
        grantExtraYatzy();
    }
}

function undoLastCategory() {
    if (!lastMarkedCatId) return;
    const wasJoker = lastMarkedWasJoker;
    const catId = lastMarkedCatId;
    myScores[catId] = null;
    logMove('score', { catId, action: 'unmark' });
    dequeueEvent('yatzy');
    checkBonusJustCompleted();
    lastMarkedCatId = null;
    lastMarkedWasJoker = false;
    markedThisTurn = false;
    if (wasJoker) jokerModeActive = true; // vuelve a ofrecer las casillas de comodin para elegir de nuevo
    saveState();
    renderDice(); renderScores();
    sfxUndo();
    triggerShake(`score-${catId}`);
}

function undoExtraYatzy() {
    if (myExtraYatzys <= 0) return;
    myExtraYatzys--;
    jokerModeActive = false;
    logMove('yatzy_extra', { action: 'undo' });
    dequeueEvent('extra_yatzy');
    saveState();
    renderScores();
    sfxUndo();
    triggerShake('cat-yatzy');
}

function lockCategory(catId, value, opts = {}) {
    myScores[catId] = value;
    markedThisTurn = true;
    jokerModeActive = false;
    lastMarkedCatId = catId;
    lastMarkedWasJoker = !!opts.joker;
    logMove('score', { catId, value, auto: !!opts.joker });

    const isYatzyScore = (catId === 'yatzy' && value === 50);
    if (isYatzyScore) {
        const msg = `⭐ ${myName} hizo YATZY! (+50)`;
        queueEvent('yatzy', msg);
    }
    saveState();
    checkBonusJustCompleted();
    renderDice(); renderScores();
    triggerPop(`score-${catId}`);
    isYatzyScore ? sfxYatzy() : sfxLock();
}

function checkBonusJustCompleted() {
    if (!myBonusAnnounced && upperBonus(myScores) === 35) {
        queueEvent('bonus', `🎉 ${myName} consiguió el BONO +35!`);
        sfxBonus();
        triggerPop('bonusCell');
    } else if (upperBonus(myScores) !== 35) {
        dequeueEvent('bonus');
    }
}

// ===== GUARDAR / SINCRONIZAR ESTADO =====
function saveState() {
    updateTotalScore();
    if (currentRoom) {
        playersData[myId] = { name: myName, color: playerColors[myId] || null, scores: { ...myScores }, extraYatzys: myExtraYatzys, score: totalScore(myScores, myExtraYatzys) };
        renderLeaderboard();
        broadcastSync();
        persistSession();
        persistRegistry();
    }
}
function broadcastSync(action = 'sync') {
    if (mqttClient && currentRoom) {
        mqttClient.publish(`yatzy_app_xyz/room/${currentRoom}`, JSON.stringify({
            action, id: myId, name: myName, color: playerColors[myId] || null,
            scores: myScores, extraYatzys: myExtraYatzys, score: totalScore(myScores, myExtraYatzys),
            hostId
        }));
    }
}

// ===== FIN DE LA PARTIDA =====
function checkGameFinished() {
    if (!gameStarted || gameFinished || turnOrder.length === 0) return;
    const allDone = turnOrder.every(id => {
        const p = playersData[id];
        return p && p.scores && Object.values(p.scores).every(v => v !== null);
    });
    if (allDone) {
        gameFinished = true;
        showGameOverModal();
    }
}

// ===== SALA DE ESPERA / ORDEN DE TURNOS =====
// El orden de turnos se asigna automaticamente segun el orden de llegada
// a la sala (ver renderPreGame en ui.js). Ya no es reordenable manualmente.

function startGame() {
    if (!isRoomCreator || pendingOrder.length === 0) return;
    turnOrder = [...pendingOrder];
    const colors = {};
    turnOrder.forEach((id, idx) => { colors[id] = PLAYER_COLORS[idx % PLAYER_COLORS.length].id; });
    playerColors = colors;
    Object.keys(playersData).forEach(id => { if (playersData[id]) playersData[id].color = colors[id]; });
    currentTurnIndex = 0;
    gameStarted = true;
    gameFinished = false;
    broadcastGameStart();
    afterTurnBecameMine();
    renderPreGame(); renderTurnBanner(); renderDice(); renderScores(); renderLeaderboard();
    saveState();
}
function broadcastGameStart() {
    if (mqttClient && currentRoom) {
        mqttClient.publish(`yatzy_app_xyz/room/${currentRoom}`, JSON.stringify({ action: 'game_start', id: myId, turnOrder, colors: playerColors, hostId }));
    }
}
function broadcastGameStateSync() {
    if (mqttClient && currentRoom) {
        mqttClient.publish(`yatzy_app_xyz/room/${currentRoom}`, JSON.stringify({ action: 'game_state_sync', id: myId, turnOrder, colors: playerColors, currentTurnIndex, hostId }));
    }
}

function afterTurnBecameMine() {
    if (isMyTurn()) {
        myDice = [null, null, null, null, null];
        markedThisTurn = false;
        jokerModeActive = false;
        lastMarkedCatId = null;
        lastMarkedWasJoker = false;
    }
}
function endTurn() {
    if (!isMyTurn() || !markedThisTurn) return;
    logMove('end_turn', {});
    if (upperBonus(myScores) === 35) myBonusAnnounced = true;
    flushPendingEvents();
    sfxTurnEnd();
    const nextIndex = (currentTurnIndex + 1) % turnOrder.length;
    broadcastTurnAdvance(nextIndex);
    applyTurnAdvance(nextIndex);
}

// ===== REINICIAR PARTIDA (SOLO ANFITRION) =====
function requestGameReset() {
    if (!isRoomCreator) return;
    document.getElementById('resetGameModal').style.display = 'flex';
}
function closeResetGameModal() { document.getElementById('resetGameModal').style.display = 'none'; }
function confirmGameReset() {
    closeResetGameModal();
    broadcastGameReset();
    applyGameReset();
}
function applyGameReset() {
    myScores = emptyScores();
    myExtraYatzys = 0;
    myBonusAnnounced = false;
    markedThisTurn = false;
    jokerModeActive = false;
    lastMarkedCatId = null;
    lastMarkedWasJoker = false;
    gameStarted = false;
    gameFinished = false;
    turnOrder = [];
    currentTurnIndex = 0;
    pendingEvents = [];

    Object.keys(playersData).forEach(id => {
        playersData[id].scores = emptyScores();
        playersData[id].extraYatzys = 0;
        playersData[id].score = 0;
        playersData[id].color = null;
    });

    logMove('reset', {});
    document.getElementById('gameOverModal').style.display = 'none';
    renderPreGame(); renderTurnBanner(); renderDice(); renderScores(); renderLeaderboard();
    saveState();
}
function broadcastGameReset() {
    if (mqttClient && currentRoom) mqttClient.publish(`yatzy_app_xyz/room/${currentRoom}`, JSON.stringify({ action: 'game_reset', id: myId }));
}
function applyTurnAdvance(nextIndex) {
    currentTurnIndex = nextIndex;
    afterTurnBecameMine();
    renderTurnBanner(); renderDice(); renderScores(); renderLeaderboard();
}
function broadcastTurnAdvance(nextIndex) {
    if (mqttClient && currentRoom) {
        mqttClient.publish(`yatzy_app_xyz/room/${currentRoom}`, JSON.stringify({ action: 'turn_advance', id: myId, nextIndex }));
    }
}

// ===== LOBBY: NOMBRE / MODOS =====
function getPlayerName() {
    const name = document.getElementById('playerName').value.trim();
    return name || "Jugador " + Math.floor(Math.random() * 100);
}
function playSolo() {
    document.getElementById('lobbyModal').style.display = 'none';
    myName = getPlayerName();
    myId = Math.random().toString(36).substr(2, 9);
    turnOrder = [myId];
    playerColors = { [myId]: 'rojo' };
    currentTurnIndex = 0;
    gameStarted = true;
    gameFinished = false;
    myScores = emptyScores();
    myExtraYatzys = 0;
    playersData[myId] = { name: myName, color: 'rojo', scores: myScores, extraYatzys: 0, score: 0 };
    document.getElementById('preGamePanel').style.display = 'none';
    document.getElementById('gameArea').style.display = 'flex';
    document.getElementById('leaderboardPanel').style.display = 'none';
    afterTurnBecameMine();
    renderTurnBanner(); renderDice(); renderScores();
}
function showJoinModal() {
    document.getElementById('lobbyModal').style.display = 'none';
    const joinNameInput = document.getElementById('joinPlayerName');
    if (joinNameInput) joinNameInput.value = document.getElementById('playerName').value;
    document.getElementById('joinModal').style.display = 'flex';
}
function backToLobby() {
    document.getElementById('joinModal').style.display = 'none';
    document.getElementById('lobbyModal').style.display = 'flex';
}

// ===== CREAR / UNIRSE A SALA =====
function createRoom() {
    myName = getPlayerName();
    myId = Math.random().toString(36).substr(2, 9);
    myScores = emptyScores();
    myExtraYatzys = 0;
    isRoomCreator = true;
    hostId = myId;
    pendingOrder = [];
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    connectToRoom(code);
}
function joinRoom() {
    myName = getPlayerName();
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (code.length !== 4) { showNotice("El codigo debe tener 4 letras/numeros.", "Codigo invalido"); return; }
    isRoomCreator = false;

    const known = getRegistryEntry(code, myName);
    if (known) {
        myId = known.id;
        myScores = known.scores || emptyScores();
        myExtraYatzys = known.extraYatzys || 0;
        connectToRoom(code, true);
        return;
    }

    myId = Math.random().toString(36).substr(2, 9);
    myScores = emptyScores();
    myExtraYatzys = 0;
    connectToRoom(code);
}

// ===== EXITO AL UNIRSE =====
function joinSuccess(code) {
    hideLoading();
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('joinModal').style.display = 'none';
    const info = document.getElementById('roomInfoDisplay');
    info.style.display = 'inline-block';
    info.textContent = `SALA: ${code}`;
    document.getElementById('leaderboardPanel').style.display = 'flex';
    document.getElementById('gameLogPanel').style.display = 'flex';
    renderPreGame(); renderTurnBanner(); renderDice(); renderScores(); renderLeaderboard(); renderLog();
}

// ===== UTILIDADES =====
function showLoading(text) { document.getElementById('loadingText').textContent = text; document.getElementById('loadingModal').style.display = 'flex'; }
function hideLoading() { document.getElementById('loadingModal').style.display = 'none'; }
