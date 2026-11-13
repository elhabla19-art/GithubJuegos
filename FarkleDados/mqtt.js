// ===== ESTADO DE LA SALA / CONEXION =====
let mqttClient = null;
let currentRoom = null;
let playersData = {};

let claimResolved = false;
let pendingClaim = null;

// ===== OCULTAR JUGADORES RECIEN LLEGADOS HASTA CONFIRMAR QUE NO SON UN RECLAMO =====
// Cuando alguien se une con un nombre que ya existe en la sala (tipicamente porque se
// desconecto y volvio a entrar sin usar "Reconectar"), no lo mostramos en el leaderboard
// de inmediato: esperamos a que se resuelva el modal de reclamo (aceptar = se fusiona con
// su id anterior y el nuevo desaparece sin haberse mostrado nunca; rechazar = se revela
// como jugador nuevo). Si nadie ofrece un reclamo en un margen breve, asumimos que es
// realmente un jugador nuevo y lo revelamos igual.
let hiddenJoiningIds = new Set();
let confirmedDuplicateIds = new Set();
let joinGraceTimers = {};
// Se pone en true tras una reconexion silenciosa de MQTT (corte breve sin recarga de
// pagina) mientras la partida ya estaba en curso, para forzar que se acepte el proximo
// game_state_sync y así ponernos al dia con cualquier turn_advance que se haya perdido.
let awaitingResync = false;

function hideJoiningId(id) {
    hiddenJoiningIds.add(id);
}
function scheduleRevealIfNoClaim(id) {
    clearTimeout(joinGraceTimers[id]);
    joinGraceTimers[id] = setTimeout(() => {
        delete joinGraceTimers[id];
        if (!hiddenJoiningIds.has(id)) return;
        // Si es mi propio id y todavia tengo un reclamo pendiente por resolver, no lo
        // revelamos: se espera a que el jugador presione "Si, soy yo" / "No, soy otro".
        if (id === myId && pendingClaim) return;
        if (confirmedDuplicateIds.has(id)) return;
        revealJoiningId(id);
    }, 1800);
}
function revealJoiningId(id) {
    hiddenJoiningIds.delete(id);
    confirmedDuplicateIds.delete(id);
    clearTimeout(joinGraceTimers[id]);
    delete joinGraceTimers[id];
    updatePendingOrder();
    renderLeaderboard();
    updateStartButton();
}
function forgetJoiningId(id) {
    hiddenJoiningIds.delete(id);
    confirmedDuplicateIds.delete(id);
    clearTimeout(joinGraceTimers[id]);
    delete joinGraceTimers[id];
}

// ===== PRESENCIA (SOLO LAST WILL) =====
// Unica fuente de deteccion: el testamento MQTT (ver "will" en connectToRoom).
// Es solo visual (etiqueta "Desconectado"), nunca mueve turnos ni borra progreso.
function publishRoom(payload) {
    if (!mqttClient || !currentRoom) return;
    mqttClient.publish(`farkle_app_xyz/room/${currentRoom}`, JSON.stringify(payload));
}

// ===== CONEXION MQTT =====
function connectToRoom(code, isReconnect = false) {
    showLoading(isReconnect ? "Reconectando a la sala..." : "Conectando con la sala...");
    claimResolved = isReconnect;
    pendingClaim = null;
    gameLog = [];
    seenLogIds = new Set();

    // La libreria de MQTT reintenta la conexion sola ante un corte breve (pantalla
    // bloqueada, wifi inestable, etc.), sin recargar la pagina: el evento 'connect'
    // se vuelve a disparar con el mismo estado local (gameStarted, turnOrder, etc. NO
    // se reinician). Si durante ese corte se perdio un 'turn_advance', nuestro estado
    // queda desactualizado y nadie nos avisa. hasConnectedOnce distingue esta
    // reconexion silenciosa de la primera conexion real, para forzar que se acepte
    // el proximo game_state_sync y ponernos al dia aunque gameStarted ya sea true.
    let hasConnectedOnce = false;

    mqttClient = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
        // Testamento MQTT: si la conexion se corta de forma abrupta, el broker
        // publica esto por nosotros. Unica fuente de deteccion (no hay heartbeat).
        will: {
            topic: `farkle_app_xyz/room/${code}`,
            payload: JSON.stringify({ action: 'presence_lost', id: myId }),
            qos: 0,
            retain: false
        }
    });

    mqttClient.on('connect', () => {
        currentRoom = code;
        mqttClient.subscribe(`farkle_app_xyz/room/${code}`);
        const isSilentReconnect = hasConnectedOnce;
        hasConnectedOnce = true;
        if (isSilentReconnect && gameStarted) {
            awaitingResync = true;
        }
        playersData[myId] = { name: myName, color: playerColors[myId] || null, ...publicState() };
        if (!isReconnect && !isSilentReconnect) {
            // Puede que ya haya un jugador con este nombre en la sala (volvi a entrar
            // sin usar "Reconectar"). Nos ocultamos hasta saber si corresponde un reclamo.
            hideJoiningId(myId);
            scheduleRevealIfNoClaim(myId);
        }
        updatePendingOrder();
        joinSuccess(code);
        broadcastSync('join');
        persistSession();

        // Si nadie responde con un anfitrion dentro de este margen, me reclamo host.
        const claimDelay = 1400 + Math.random() * 900;
        setTimeout(() => {
            if (currentRoom === code && !hostId) claimHost();
        }, claimDelay);
    });

    mqttClient.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());

            // Cualquier mensaje de otro jugador lo marca como presente de nuevo
            // (excepto presence_lost, que dice lo contrario y se maneja abajo).
            if (data.id && data.id !== myId && data.action !== 'presence_lost' && playersData[data.id] && playersData[data.id].offline) {
                playersData[data.id].offline = false;
                renderLeaderboard();
            }

            if (data.action === 'presence_lost') {
                if (data.id !== myId && playersData[data.id]) {
                    playersData[data.id].offline = true;
                    renderLeaderboard();
                }
                return;
            }

            // En 'remove' el "id" es el jugador removido, no el emisor.
            if (data.action === 'remove') {
                if (data.id === myId) {
                    handleRemovedFromRoom();
                } else {
                    delete playersData[data.id];
                    pendingOrder = pendingOrder.filter(id => id !== data.id);
                    forgetJoiningId(data.id);
                    updatePendingOrder();
                    renderLeaderboard();
                    updateStartButton();
                    if (isRoomCreator && !gameStarted) hostSyncPregameOrder();
                }
                return;
            }

            // Igual que 'remove': "id" es el jugador removido, no el emisor.
            if (data.action === 'ingame_remove') {
                if (data.id === myId) {
                    handleRemovedFromRoom();
                } else {
                    applyIngameRemoval(data.id, data.turnOrder, data.nextIndex);
                }
                return;
            }

            if (data.id === myId) return;

            if (data.hostId && (!hostId || !hostIsPresent())) {
                hostId = data.hostId;
                refreshHostStatus();
            }

            if (data.action === 'order_update') {
                if (!gameStarted) {
                    if (Array.isArray(data.order)) pendingOrder = data.order.slice();
                    if (data.colors) {
                        playerColors = data.colors;
                        Object.keys(playerColors).forEach(id => { if (playersData[id]) playersData[id].color = playerColors[id]; });
                    }
                    renderLeaderboard();
                    updateStartButton();
                    applyBoardTheme();
                }
                return;
            }

            if (data.action === 'claim_offer') {
                // Se confirma que el que se acaba de unir es (probablemente) alguien que
                // ya estaba en la sala: se mantiene oculto en todas las pantallas hasta
                // que se resuelva el reclamo (aceptar lo elimina sin haberse mostrado
                // nunca; rechazar lo revela como jugador nuevo).
                if (data.targetId) {
                    confirmedDuplicateIds.add(data.targetId);
                    hideJoiningId(data.targetId);
                    clearTimeout(joinGraceTimers[data.targetId]);
                    renderLeaderboard();
                }
                if (data.targetId === myId && !claimResolved && isFreshPlayer() && data.state) {
                    claimResolved = true;
                    pendingClaim = { oldId: data.offeredId, name: data.name, score: data.score, state: data.state, color: data.color || null };
                    showClaimModal(pendingClaim);
                }
                return;
            }

            if (data.action === 'claim_declined') {
                // El jugador que se unio confirmo que es una persona distinta: ahora si
                // se muestra como un jugador nuevo normal.
                revealJoiningId(data.id);
                return;
            }

            if (!claimResolved && data.name === myName && isFreshPlayer() && hasProgress(data)) {
                claimResolved = true;
                confirmedDuplicateIds.add(myId);
                hideJoiningId(myId);
                clearTimeout(joinGraceTimers[myId]);
                pendingClaim = { oldId: data.id, name: data.name, score: data.score, state: pickState(data), color: data.color || null };
                showClaimModal(pendingClaim);
                return;
            }

            if (data.action === 'game_start') {
                turnOrder = data.turnOrder;
                playerColors = data.colors;
                Object.keys(playerColors).forEach(id => { if (playersData[id]) playersData[id].color = playerColors[id]; });
                if (playersData[myId]) playersData[myId].color = playerColors[myId];
                currentTurnIndex = 0;
                gameStarted = true;
                gameFinished = false;
                finalTriggerId = null;
                liveTurnData = null;
                afterTurnBecameMine();
                renderTurnBanner();
                renderDice();
                renderScores();
                renderLeaderboard();
                updateStartButton();
                saveState();
                return;
            }

            if (data.action === 'game_state_sync') {
                if (!gameStarted || awaitingResync) {
                    turnOrder = data.turnOrder;
                    playerColors = data.colors;
                    currentTurnIndex = data.currentTurnIndex;
                    finalTriggerId = data.finalTriggerId || null;
                    gameStarted = true;
                    awaitingResync = false;
                    Object.keys(playerColors).forEach(id => { if (playersData[id]) playersData[id].color = playerColors[id]; });
                    if (playersData[myId]) playersData[myId].color = playerColors[myId];
                    afterTurnBecameMine();
                    renderTurnBanner();
                    renderDice();
                    renderScores();
                    renderLeaderboard();
                    updateStartButton();
                    // Re-emitir nuestro estado (color incluido) para clientes que ya
                    // tenian gameStarted=true e ignoraron este mensaje.
                    saveState();
                }
                return;
            }

            if (data.action === 'turn_advance') { applyTurnAdvance(data.nextIndex, data.finalTriggerId); return; }
            if (data.action === 'live_turn') { liveTurnData = data; if (!isMyTurn()) { renderDice(); renderScores(); } return; }
            if (data.action === 'game_reset') { applyGameReset(); return; }
            if (data.action === 'log_entry') { addLogEntry(data.entry, false); return; }
            if (data.action === 'event_toast') { showEventToast(data.text); return; }

            const isNewJoin = data.action === 'join' && !playersData[data.id];
            playersData[data.id] = { name: data.name, color: data.color, ...pickState(data) };

            if (isNewJoin) {
                // Ocultamos al recien llegado hasta saber si corresponde a un jugador que
                // ya estaba en la sala (reclamo) o si es realmente nuevo.
                hideJoiningId(data.id);
                scheduleRevealIfNoClaim(data.id);
            }

            updatePendingOrder();
            renderLeaderboard();

            if (data.action === 'join') {
                broadcastSync();
                if (gameStarted) broadcastGameStateSync();
                else if (isRoomCreator) hostSyncPregameOrder();
                const cachedMatch = Object.keys(playersData).find(id =>
                    id !== data.id && playersData[id].name === data.name
                );
                if (cachedMatch) broadcastClaimOffer(data.id, cachedMatch);
            }
        } catch (e) { console.error("Mensaje invalido", e); }
    });

    mqttClient.on('error', () => { hideLoading(); showNotice("Error de red. Revisa tu internet.", "Sin conexion"); });
}

// ===== RECLAMO DE NOMBRE =====
function showClaimModal(claim) {
    document.getElementById('claimText').textContent = `Ya hay un jugador "${claim.name}" en la sala con ${claim.score} pts. ¿Eres tu (te desconectaste antes)?`;
    document.getElementById('claimModal').style.display = 'flex';
}
function acceptClaim() {
    if (!pendingClaim) return;
    const staleTempId = myId;
    broadcastRemove(staleTempId);
    delete playersData[staleTempId];
    pendingOrder = pendingOrder.filter(id => id !== staleTempId);
    delete playerColors[staleTempId];
    forgetJoiningId(staleTempId);
    myId = pendingClaim.oldId;
    myState = { ...freshState(), ...pendingClaim.state };
    // Recuperamos el color con el que veniamos jugando bajo esa identidad.
    if (pendingClaim.color) playerColors[myId] = pendingClaim.color;
    refreshHostStatus();
    saveState();
    renderScores();
    updatePendingOrder();
    updateStartButton();
    if (isRoomCreator && !gameStarted) hostSyncPregameOrder();
    if (gameStarted) {
        // Puede que la partida ya nos haya "pasado" el turno mientras nos reconectabamos
        // con un id temporal: al recuperar el id real hay que refrescar el banner/dados
        // para que se reconozca de inmediato si es nuestro turno.
        afterTurnBecameMine();
        renderTurnBanner();
        renderDice();
    }
    renderLeaderboard();
    document.getElementById('claimModal').style.display = 'none';
    pendingClaim = null;
}
function declineClaim() {
    pendingClaim = null;
    document.getElementById('claimModal').style.display = 'none';
    // Confirmamos que somos un jugador distinto: nos revelamos y avisamos al resto
    // de la sala para que tambien nos muestren en el leaderboard.
    revealJoiningId(myId);
    publishRoom({ action: 'claim_declined', id: myId });
}

// ===== SER REMOVIDO DE LA SALA =====
// El jugador removido pierde el acceso al tablero y debe volver a entrar manualmente.
function handleRemovedFromRoom() {
    hideLoading();

    ['tooltipModal', 'diceModal', 'viewPlayerModal', 'resetGameModal', 'removePlayerModal',
     'endTurnReminderModal', 'gameOverModal', 'claimModal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
    });
    cancelEndTurnReminder();
    viewingPlayerId = null;

    if (mqttClient) { try { mqttClient.end(true); } catch (e) {} mqttClient = null; }
    currentRoom = null;
    playersData = {};
    pendingOrder = [];
    turnOrder = [];
    Object.keys(joinGraceTimers).forEach(id => clearTimeout(joinGraceTimers[id]));
    joinGraceTimers = {};
    hiddenJoiningIds = new Set();
    confirmedDuplicateIds = new Set();
    awaitingResync = false;
    gameStarted = false;
    gameFinished = false;
    finalTriggerId = null;
    liveTurnData = null;
    myTurn = freshTurn();
    myState = freshState();
    isRoomCreator = false;
    hostId = null;

    const gameArea = document.getElementById('gameArea');
    if (gameArea) gameArea.style.display = 'none';
    const logPanel = document.getElementById('gameLogPanel');
    if (logPanel) logPanel.style.display = 'none';
    const info = document.getElementById('roomInfoDisplay');
    if (info) info.style.display = 'none';

    // No se deja reconectar con un clic: el anfitrion lo saco a proposito.
    clearSession();
    const banner = document.getElementById('sessionBanner');
    if (banner) banner.style.display = 'none';
    const reconnectBtn = document.getElementById('reconnectBtn');
    if (reconnectBtn) {
        reconnectBtn.disabled = true;
        reconnectBtn.style.opacity = '0.5';
        reconnectBtn.style.cursor = 'not-allowed';
    }

    // Volver al lobby y avisar.
    const lobby = document.getElementById('lobbyModal');
    if (lobby) lobby.style.display = 'flex';
    showNotice('El anfitrion te saco de la sala. Debes volver a entrar para unirte de nuevo.', 'Fuera de la partida');
}

function broadcastRemove(idToRemove) {
    publishRoom({ action: 'remove', id: idToRemove });
}
function broadcastClaimOffer(targetId, offeredId) {
    const cached = playersData[offeredId];
    if (!cached) return;
    publishRoom({
        action: 'claim_offer', targetId, offeredId, name: cached.name, score: cached.score, state: pickState(cached), color: cached.color || null, offline: !!cached.offline
    });
}