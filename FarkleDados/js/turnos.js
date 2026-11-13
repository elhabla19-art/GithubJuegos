// ===== GESTIÓN DE TURNOS Y ESTADO DE LA PARTIDA =====

let turnOrder = [];
let playerColors = {};
let currentTurnIndex = 0;
let gameStarted = false;
let gameFinished = false;
let pendingOrder = [];
// Jugador que llego primero a la meta: dispara la ultima ronda para los demas.
let finalTriggerId = null;

let isRoomCreator = false;
let hostId = null;

// ----------------------------------------------------------------------
// Funciones de estado de turnos
// ----------------------------------------------------------------------

function isMyTurn() {
    return gameStarted && !gameFinished && turnOrder.length > 0 && turnOrder[currentTurnIndex] === myId;
}

function afterTurnBecameMine() {
    cancelEndTurnReminder();
    if (isMyTurn()) {
        // Solo se reinicia el turno si es nuevo (no en una resincronizacion a mitad de turno).
        if (!myTurn.started) {
            myTurn = freshTurn();
            myTurn.started = true;
            showEventToast('¡Es tu turno!');
            broadcastLiveTurn();
        }
    } else if (myTurn.started) {
        myTurn = freshTurn();
    }
}

function endTurn() {
    if (!isMyTurn() || myTurn.result === null) return;
    cancelEndTurnReminder();
    // Aqui se aplica recien la decision FINAL del turno (plantarse o Farkle); cualquier
    // deshacer intermedio no dejo rastro en el puntaje ni en el registro.
    commitTurnResult();
    flushPendingEvents();
    sfxTurnEnd();
    myTurn = freshTurn();
    saveState();
    const nextIndex = (currentTurnIndex + 1) % turnOrder.length;
    broadcastTurnAdvance(nextIndex);
    applyTurnAdvance(nextIndex, finalTriggerId);
}

function applyTurnAdvance(nextIndex, trigger) {
    if (typeof awaitingResync !== 'undefined') awaitingResync = false;
    if (trigger) finalTriggerId = trigger;
    currentTurnIndex = nextIndex;
    liveTurnData = null;
    // Ultima ronda: termina cuando el turno vuelve a quien llego primero a la meta.
    const ended = !!finalTriggerId && turnOrder[nextIndex] === finalTriggerId;
    if (ended) gameFinished = true;
    afterTurnBecameMine();
    renderTurnBanner();
    renderDice();
    renderScores();
    renderLeaderboard();
    updateStartButton();
    if (ended) showGameOverModal();
}

function broadcastTurnAdvance(nextIndex) {
    publishRoom({ action: 'turn_advance', id: myId, nextIndex, finalTriggerId });
}

// ----------------------------------------------------------------------
// Inicio de partida
// ----------------------------------------------------------------------

function startGame() {
    if (!isRoomCreator || gameStarted || pendingOrder.length === 0) return;
    turnOrder = [...pendingOrder];
    // Los colores ya se asignaron (y se fueron mostrando) durante la sala de espera.
    // Aqui solo nos aseguramos de que todos tengan uno, sin reasignar los que ya tenian,
    // para que el color se mantenga igual entre la sala de espera y la partida.
    playerColors = computeStickyColors(turnOrder, playerColors);
    Object.keys(playersData).forEach(id => {
        if (playersData[id]) playersData[id].color = playerColors[id];
    });
    currentTurnIndex = 0;
    gameStarted = true;
    gameFinished = false;
    finalTriggerId = null;
    broadcastGameStart();
    afterTurnBecameMine();
    renderTurnBanner();
    renderDice();
    renderScores();
    renderLeaderboard();
    updateStartButton();
    saveState();
}

function broadcastGameStart() {
    publishRoom({ action: 'game_start', id: myId, turnOrder, colors: playerColors, hostId });
}

function broadcastGameStateSync() {
    publishRoom({ action: 'game_state_sync', id: myId, turnOrder, colors: playerColors, currentTurnIndex, finalTriggerId, hostId });
}

// ----------------------------------------------------------------------
// Orden de jugadores (solo actualización, sin UI)
// ----------------------------------------------------------------------

function updatePendingOrder() {
    // Mantiene el orden de llegada: los que ya estaban conservan su posición,
    // los nuevos se añaden al final. Los que estan ocultos esperando resolucion
    // de un reclamo de nombre duplicado todavia no entran al orden.
    const currentIds = Object.keys(playersData);
    // Eliminar los que ya no están
    pendingOrder = pendingOrder.filter(id => currentIds.includes(id));
    // Añadir los nuevos al final
    currentIds.forEach(id => {
        if (!pendingOrder.includes(id) && !(typeof hiddenJoiningIds !== 'undefined' && hiddenJoiningIds.has(id))) {
            pendingOrder.push(id);
        }
    });
    // Notificar cambios en el botón de inicio
    updateStartButton();
}

// ----------------------------------------------------------------------
// Sala de espera: el anfitrión asigna colores y orden de forma autoritativa
// ----------------------------------------------------------------------

// Recalcula los colores (de forma "pegajosa", sin duplicados) para el orden
// actual y lo transmite a todos, para que la vista previa de la sala de espera
// sea igual en todos los dispositivos y coincida con los colores de la partida.
function hostSyncPregameOrder() {
    if (!isRoomCreator || gameStarted) return;
    playerColors = computeStickyColors(pendingOrder, playerColors);
    Object.keys(playerColors).forEach(id => {
        if (playersData[id]) playersData[id].color = playerColors[id];
    });
    broadcastOrderUpdate();
    renderLeaderboard();
    updateStartButton();
    applyBoardTheme();
}

function broadcastOrderUpdate() {
    publishRoom({ action: 'order_update', id: myId, order: pendingOrder, colors: playerColors, hostId });
}

// Solo el anfitrión puede reordenar/eliminar, y solo antes de iniciar la partida.
function reorderPendingPlayer(id, direction) {
    if (!isRoomCreator || gameStarted) return;
    const idx = pendingOrder.indexOf(id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= pendingOrder.length) return;
    const tmp = pendingOrder[idx];
    pendingOrder[idx] = pendingOrder[swapIdx];
    pendingOrder[swapIdx] = tmp;
    hostSyncPregameOrder();
}
function movePlayerUp(id) { reorderPendingPlayer(id, -1); }
function movePlayerDown(id) { reorderPendingPlayer(id, 1); }

function hostRemovePlayer(id) {
    if (!isRoomCreator || gameStarted || id === myId) return;
    delete playersData[id];
    pendingOrder = pendingOrder.filter(pid => pid !== id);
    delete playerColors[id];
    broadcastRemove(id);
    hostSyncPregameOrder();
    renderLeaderboard();
}

// ----------------------------------------------------------------------
// Eliminar jugador durante la partida: solo a quien ya figura como
// desconectado, con confirmacion (a diferencia del "X" instantaneo del lobby)
// ----------------------------------------------------------------------

let pendingRemoveId = null;

// Antes de iniciar: elimina al instante. Durante la partida: solo si esta
// desconectado, y pide confirmacion antes de sacarlo del orden de turnos.
function requestRemovePlayer(id) {
    if (!isRoomCreator || id === myId || !playersData[id]) return;
    if (!gameStarted) { hostRemovePlayer(id); return; }
    if (!playersData[id].offline) return;
    pendingRemoveId = id;
    const name = playersData[id].name || 'este jugador';
    const text = document.getElementById('removePlayerText');
    if (text) text.textContent = `"${name}" figura como desconectado. ¿Quieres sacarlo de la partida y del orden de turnos? Su puntaje ya anotado se mantiene en el registro.`;
    const modal = document.getElementById('removePlayerModal');
    if (modal) modal.style.display = 'flex';
}
function closeRemovePlayerModal() {
    pendingRemoveId = null;
    const modal = document.getElementById('removePlayerModal');
    if (modal) modal.style.display = 'none';
}
function confirmRemovePlayer() {
    const id = pendingRemoveId;
    closeRemovePlayerModal();
    if (id) hostRemovePlayerDuringGame(id);
}

function hostRemovePlayerDuringGame(id) {
    if (!isRoomCreator || !gameStarted || id === myId || !playersData[id] || !playersData[id].offline) return;

    const removedIdx = turnOrder.indexOf(id);
    const newTurnOrder = turnOrder.filter(pid => pid !== id);
    let newIndex = currentTurnIndex;
    if (removedIdx !== -1) {
        if (newTurnOrder.length === 0) {
            newIndex = 0;
        } else {
            // Si el eliminado estaba ANTES del turno actual, el indice se corre uno
            // hacia la izquierda para seguir apuntando al mismo jugador de siempre.
            // Si el eliminado ERA el turno actual, el indice ya "apunta" al siguiente
            // jugador tal cual (el arreglo se corrio una posicion en su lugar), asi que
            // no se toca (solo el ajuste de vuelta al principio de abajo, si corresponde).
            if (removedIdx < currentTurnIndex) newIndex -= 1;
            if (newIndex >= newTurnOrder.length) newIndex = 0;
        }
    }

    applyIngameRemoval(id, newTurnOrder, newIndex);
    broadcastIngameRemoval(id, newTurnOrder, newIndex);
}

// Aplica la eliminacion localmente. La usan tanto el anfitrion (que la origina)
// como el resto de clientes (via el mensaje 'ingame_remove'), para que el estado
// de turnos quede identico en todas las pantallas.
function applyIngameRemoval(id, newTurnOrder, newIndex) {
    delete playersData[id];
    pendingOrder = pendingOrder.filter(pid => pid !== id);
    delete playerColors[id];
    turnOrder = Array.isArray(newTurnOrder) ? newTurnOrder : turnOrder.filter(pid => pid !== id);
    currentTurnIndex = newIndex || 0;
    if (finalTriggerId === id) finalTriggerId = turnOrder[currentTurnIndex] || null;
    afterTurnBecameMine();
    renderTurnBanner();
    renderDice();
    renderScores();
    renderLeaderboard();
    updateStartButton();
    saveState();
}

function broadcastIngameRemoval(id, newTurnOrder, newIndex) {
    publishRoom({ action: 'ingame_remove', id, turnOrder: newTurnOrder, nextIndex: newIndex });
}

// ----------------------------------------------------------------------
// Reinicio de la partida
// ----------------------------------------------------------------------

function requestGameReset() {
    if (!isRoomCreator) return;
    document.getElementById('resetGameModal').style.display = 'flex';
}

function confirmGameReset() {
    closeResetGameModal();
    broadcastGameReset();
    applyGameReset();
}

function applyGameReset() {
    myState = freshState();
    myTurn = freshTurn();
    liveTurnData = null;
    finalTriggerId = null;
    gameStarted = false;
    gameFinished = false;
    turnOrder = [];
    currentTurnIndex = 0;
    pendingEvents = [];
    cancelEndTurnReminder();
    closeRemovePlayerModal();

    Object.keys(playersData).forEach(id => {
        Object.assign(playersData[id], freshState());
        // El color NO se borra: debe mantenerse asignado al jugador entre partidas.
    });

    logMove('reset', {});
    document.getElementById('gameOverModal').style.display = 'none';
    renderTurnBanner();
    renderDice();
    renderScores();
    renderLeaderboard();
    updateStartButton();
    saveState();
    // Volvemos a mostrar los controles de orden/eliminar de la sala de espera con los
    // mismos colores que ya tenian los jugadores.
    if (isRoomCreator) hostSyncPregameOrder();
}

function broadcastGameReset() {
    publishRoom({ action: 'game_reset', id: myId });
}

// ----------------------------------------------------------------------
// Fin de la partida
// ----------------------------------------------------------------------


// ----------------------------------------------------------------------
// Gestión de anfitrión (host)
// ----------------------------------------------------------------------

function refreshHostStatus() {
    isRoomCreator = (hostId !== null && hostId === myId);
    updateStartButton();
}

function hostIsPresent() {
    return hostId !== null && !!playersData[hostId] && !playersData[hostId].offline;
}

function claimHost() {
    // Margen aleatorio para evitar que dos jugadores reclamen el puesto a la vez.
    const claimJitter = 200 + Math.random() * 700;
    setTimeout(() => {
        // Si alguien mas ya se convirtio en anfitrion (o el original volvio), no pisamos ese reclamo.
        if (hostId && hostId !== myId && hostIsPresent()) return;
        hostId = myId;
        isRoomCreator = true;
        broadcastSync();
        if (gameStarted) broadcastGameStateSync();
        else hostSyncPregameOrder();
        renderLeaderboard();
        updateStartButton();
    }, claimJitter);
}