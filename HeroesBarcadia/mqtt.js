// mqtt.js
// ===== SISTEMA MULTIJUGADOR MQTT =====
var mqttClient = null;
var myId = Math.random().toString(36).substr(2, 9);
var currentRoom = null;
var playersData = {};   // { id: { name, offline } } -> solo presencia/nombres
var myName = 'Jugador';
var claimResolved = false;
var ROOM_PREFIX = 'heroesbarcadia/room/';

// ===== VENCIMIENTO DE SALAS ABANDONADAS =====
var ROOM_STALE_MS = 12 * 60 * 60 * 1000; // 12 horas

// ===== OCULTAR JUGADORES RECIEN LLEGADOS HASTA CONFIRMAR QUE NO SON UN RECLAMO =====
var hiddenJoiningIds = {};
var confirmedDuplicateIds = {};
var joinGraceTimers = {};

function hideJoiningId(id) { hiddenJoiningIds[id] = true; }
function isJoiningHidden(id) { return !!hiddenJoiningIds[id]; }
function scheduleRevealIfNoClaim(id) {
    if (joinGraceTimers[id]) clearTimeout(joinGraceTimers[id]);
    joinGraceTimers[id] = setTimeout(function() {
        delete joinGraceTimers[id];
        if (!hiddenJoiningIds[id]) return;
        if (id === myId && pendingClaim) return;
        if (confirmedDuplicateIds[id]) return;
        if (id === myId && typeof verificarDuplicadoPropioLocal === 'function' && verificarDuplicadoPropioLocal()) {
            return;
        }
        revealJoiningId(id);
    }, 1800);
}
function revealJoiningId(id) {
    delete hiddenJoiningIds[id];
    delete confirmedDuplicateIds[id];
    if (joinGraceTimers[id]) { clearTimeout(joinGraceTimers[id]); delete joinGraceTimers[id]; }
    renderLeaderboard();
}
function forgetJoiningId(id) {
    delete hiddenJoiningIds[id];
    delete confirmedDuplicateIds[id];
    if (joinGraceTimers[id]) { clearTimeout(joinGraceTimers[id]); delete joinGraceTimers[id]; }
}
window.isJoiningHidden = isJoiningHidden;

var gameStarted = false;
var gameInitiator = null;
var hostId = null;
var hostClaimTimer = null;
var hostHeartbeatInterval = null;
var presencePingInterval = null;

function marcarJugadorOffline(id, offline) {
    if (!playersData[id]) return;
    if (!!playersData[id].offline === !!offline) return;
    playersData[id].offline = !!offline;
    renderLeaderboard();
    if (typeof actualizarUI === 'function') actualizarUI();
}

function hostIsPresent() {
    return !!(hostId && playersData[hostId] && !playersData[hostId].offline);
}
window.hostIsPresent = hostIsPresent;

function hostConfirmedAbsent() {
    return !!(hostId && playersData[hostId] && playersData[hostId].offline);
}
window.hostConfirmedAbsent = hostConfirmedAbsent;

// Si entro con un nombre que ya existe y yo no tengo heroe, ofrezco el reclamo.
function verificarDuplicadoPropioLocal() {
    if (claimResolved) return false;
    if (tengoProgreso()) return false;
    if (!myName) return false;
    for (var id in playersData) {
        if (id !== myId && playersData[id] && playersData[id].name === myName) {
            claimResolved = true;
            confirmedDuplicateIds[myId] = true;
            hideJoiningId(myId);
            if (joinGraceTimers[myId]) {
                clearTimeout(joinGraceTimers[myId]);
                delete joinGraceTimers[myId];
            }
            pendingClaim = { oldId: id, name: myName };
            showClaimModal(pendingClaim);
            return true;
        }
    }
    return false;
}

var lastSeenAt = {};
var PRESENCE_TIMEOUT_MS = 50000;
var presenceCheckInterval = null;

function marcarVisto(id) {
    if (!id || id === myId) return;
    lastSeenAt[id] = Date.now();
}

function chequearPresenciaStale() {
    var now = Date.now();
    for (var id in playersData) {
        if (id === myId) continue;
        if (isJoiningHidden(id)) continue;
        var visto = lastSeenAt[id];
        if (visto === undefined) continue;
        if (!playersData[id].offline && (now - visto) > PRESENCE_TIMEOUT_MS) {
            marcarJugadorOffline(id, true);
        }
    }
}

function claimHost() {
    var jitter = 200 + Math.random() * 600;
    setTimeout(function() {
        if (isJoiningHidden(myId)) return;
        if (hostId && hostId !== myId && hostIsPresent()) {
            renderLeaderboard();
            return;
        }
        hostId = myId;
        if (hostClaimTimer) { clearTimeout(hostClaimTimer); hostClaimTimer = null; }
        broadcastHostClaim();
        broadcastState('sync');
        actualizarUI();
        saveSession();
    }, jitter);
}
window.claimHost = claimHost;

function limpiarIntervalos() {
    if (hostClaimTimer) { clearTimeout(hostClaimTimer); hostClaimTimer = null; }
    if (hostHeartbeatInterval) { clearInterval(hostHeartbeatInterval); hostHeartbeatInterval = null; }
    if (presencePingInterval) { clearInterval(presencePingInterval); presencePingInterval = null; }
    if (presenceCheckInterval) { clearInterval(presenceCheckInterval); presenceCheckInterval = null; }
}

function connectToRoom(code, isReconnect) {
    if (isReconnect === undefined) isReconnect = false;

    claimResolved = isReconnect;
    pendingClaim = null;

    if (!isReconnect) {
        playersData = {};
        aplicarPartida(nuevaPartidaVacia());
        gameInitiator = null;
        hostId = null;
    }

    limpiarIntervalos();
    lastSeenAt = {};

    showLoading(isReconnect ? 'Reconectando a la sala...' : 'Conectando con la sala...');

    var roomTopic = ROOM_PREFIX + code;
    var hasConnectedOnce = false;

    mqttClient = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
        will: {
            topic: roomTopic,
            payload: JSON.stringify({ action: 'presence_lost', id: myId }),
            qos: 0,
            retain: false
        }
    });

    mqttClient.on('connect', function() {
        currentRoom = code;
        mqttClient.subscribe(roomTopic);
        var isSilentReconnect = hasConnectedOnce;
        hasConnectedOnce = true;

        if (!playersData[myId]) {
            playersData[myId] = { name: myName, offline: false };
        } else {
            playersData[myId].name = myName;
            playersData[myId].offline = false;
        }

        if (!isReconnect && !isSilentReconnect) {
            hideJoiningId(myId);
            scheduleRevealIfNoClaim(myId);
        }

        joinSuccess(code);
        broadcastState('join');
        broadcastRequestState();

        if (hostClaimTimer) { clearTimeout(hostClaimTimer); hostClaimTimer = null; }
        if (!hostId || !hostIsPresent()) {
            hostClaimTimer = setTimeout(function intentarAutoreclamoHost() {
                if (isJoiningHidden(myId)) {
                    hostClaimTimer = setTimeout(intentarAutoreclamoHost, 700);
                    return;
                }
                if (!hostId || !hostIsPresent()) {
                    hostId = myId;
                    broadcastHostClaim();
                    broadcastState('sync');
                    actualizarUI();
                    saveSession();
                }
            }, 1800 + Math.random() * 900);
        }

        if (hostHeartbeatInterval) clearInterval(hostHeartbeatInterval);
        hostHeartbeatInterval = setInterval(function() {
            if (hostId === myId && currentRoom) broadcastState('sync');
        }, 15000);

        if (presencePingInterval) clearInterval(presencePingInterval);
        presencePingInterval = setInterval(function() {
            if (mqttClient && currentRoom) {
                mqttClient.publish(ROOM_PREFIX + currentRoom, JSON.stringify({ action: 'ping', id: myId }));
            }
        }, 20000);

        if (presenceCheckInterval) clearInterval(presenceCheckInterval);
        presenceCheckInterval = setInterval(chequearPresenciaStale, 10000);

        actualizarUI();
        saveSession();
    });

    mqttClient.on('message', function(topic, message) {
        try {
            var raw = message.toString();
            if (!raw) return; // mensaje retenido borrado
            var data = JSON.parse(raw);

            if (data.action === 'sync' || data.action === 'start') {
                var antiguedadMs = data.updatedAt ? (Date.now() - data.updatedAt) : Infinity;
                if (antiguedadMs > ROOM_STALE_MS) {
                    try { if (mqttClient) mqttClient.publish(topic, '', { qos: 1, retain: true }); } catch (e) {}
                    return;
                }
            }

            if (data.action === 'presence_lost') {
                if (data.id !== myId) {
                    marcarJugadorOffline(data.id, true);
                    delete lastSeenAt[data.id];
                }
                return;
            }

            if (data.id) marcarVisto(data.id);
            if (data.id && data.id !== myId && playersData[data.id] && playersData[data.id].offline) {
                marcarJugadorOffline(data.id, false);
            }

            if (data.action === 'ping') return;

            if (data.action === 'remove') {
                if (data.id === myId) {
                    handleRemovedFromRoom();
                    return;
                }
                quitarJugadorDeJuego(data.id);
                delete playersData[data.id];
                forgetJoiningId(data.id);
                if (hostId === data.id) hostId = null;
                actualizarUI();
                saveSession();
                return;
            }

            if (data.id === myId) return;

            if (data.action === 'claim_offer') {
                if (data.targetId) {
                    confirmedDuplicateIds[data.targetId] = true;
                    hideJoiningId(data.targetId);
                    if (joinGraceTimers[data.targetId]) {
                        clearTimeout(joinGraceTimers[data.targetId]);
                        delete joinGraceTimers[data.targetId];
                    }
                    renderLeaderboard();
                }
                if (data.targetId === myId && !claimResolved && !tengoProgreso()) {
                    claimResolved = true;
                    pendingClaim = { oldId: data.offeredId, name: data.name };
                    showClaimModal(pendingClaim);
                }
                return;
            }

            if (data.action === 'claim_declined') {
                revealJoiningId(data.id);
                return;
            }

            // ---- Deteccion de nombre duplicado (reclamo) ----
            var duplicadoId = null;
            if (data.name === myName && data.id && data.id !== myId) {
                duplicadoId = data.id;
            } else if (data.playersData) {
                for (var pidDup in data.playersData) {
                    if (pidDup !== myId && data.playersData[pidDup] && data.playersData[pidDup].name === myName) {
                        duplicadoId = pidDup;
                        break;
                    }
                }
            }
            if (!claimResolved && duplicadoId && !tengoProgreso()) {
                claimResolved = true;
                confirmedDuplicateIds[myId] = true;
                hideJoiningId(myId);
                if (joinGraceTimers[myId]) {
                    clearTimeout(joinGraceTimers[myId]);
                    delete joinGraceTimers[myId];
                }
                pendingClaim = { oldId: duplicadoId, name: myName };
                showClaimModal(pendingClaim);
                return;
            }

            // ---- Registrar al emisor ----
            if (data.id && data.name && data.action !== 'request_state' && data.action !== 'sync') {
                if (!playersData[data.id]) playersData[data.id] = { name: data.name, offline: false };
                playersData[data.id].name = data.name;
                renderLeaderboard();
            }

            if (data.action === 'reset_all') {
                var seenNames = {};
                var toRemove = [];
                for (var id in playersData) {
                    var name = playersData[id].name;
                    if (seenNames[name] !== undefined) toRemove.push(id);
                    else seenNames[name] = id;
                }
                for (var i = 0; i < toRemove.length; i++) delete playersData[toRemove[i]];
                resetLocalGame(data.version);
                return;
            }

            if (data.action === 'host_claim') {
                if (!hostId || hostConfirmedAbsent()) {
                    hostId = data.id;
                    if (hostClaimTimer) { clearTimeout(hostClaimTimer); hostClaimTimer = null; }
                    actualizarUI();
                    saveSession();
                } else if (data.id !== hostId && data.id < hostId) {
                    hostId = data.id;
                    if (hostClaimTimer) { clearTimeout(hostClaimTimer); hostClaimTimer = null; }
                    if (hostHeartbeatInterval && hostId !== myId) {
                        clearInterval(hostHeartbeatInterval);
                        hostHeartbeatInterval = null;
                    }
                    actualizarUI();
                    saveSession();
                }
                return;
            }

            if (data.hostId && data.hostId !== hostId) {
                if (!hostId || hostConfirmedAbsent() || data.hostId < hostId) {
                    hostId = data.hostId;
                    if (hostClaimTimer) { clearTimeout(hostClaimTimer); hostClaimTimer = null; }
                    if (hostHeartbeatInterval && hostId !== myId) {
                        clearInterval(hostHeartbeatInterval);
                        hostHeartbeatInterval = null;
                    }
                }
            }

            // ---- Acciones de juego (todas versionadas) ----
            if (data.action === 'start') {
                if (data.partida && data.partida.version >= partida.version) {
                    aplicarPartida(data.partida);
                    gameInitiator = data.id;
                    cerrarZoom();
                    actualizarUI();
                    saveSession();
                }
            }

            if (data.action === 'mover') {
                if (data.version > partida.version && aplicarMovimiento(data.pid, data.hexId, data.version)) {
                    actualizarUI();
                    saveSession();
                }
            }

            if (data.action === 'pasar') {
                if (data.version > partida.version && aplicarPasarTurno(data.version)) {
                    actualizarUI();
                    saveSession();
                }
            }

            if (data.action === 'atacar') {
                if (data.version > partida.version && aplicarAtacar(data.version)) {
                    actualizarUI();
                    saveSession();
                }
            }

            if (data.action === 'retirada') {
                if (data.version > partida.version && aplicarRetirada(data.version)) {
                    actualizarUI();
                    saveSession();
                }
            }

            if (data.action === 'sync') {
                if (data.partida && data.partida.version >= partida.version) {
                    aplicarPartida(data.partida);
                }
                if (data.gameInitiator) gameInitiator = data.gameInitiator;
                if (data.playersData) {
                    for (var pid in data.playersData) {
                        if (pid !== myId && data.playersData[pid]) {
                            if (!playersData[pid]) playersData[pid] = { name: data.playersData[pid].name, offline: false };
                            playersData[pid].name = data.playersData[pid].name;
                        }
                    }
                }
                actualizarUI();
                saveSession();
            }

            if (data.action === 'request_state') {
                broadcastState('sync');
            }

            if (data.action === 'join' || data.action === 'sync') {
                var isNewJoin = data.action === 'join' && !playersData[data.id];
                if (!playersData[data.id]) {
                    playersData[data.id] = { name: data.name, offline: false };
                } else {
                    playersData[data.id].name = data.name;
                }

                if (isNewJoin) {
                    hideJoiningId(data.id);
                    scheduleRevealIfNoClaim(data.id);
                }
                renderLeaderboard();

                if (data.action === 'join') {
                    var cachedMatch = null;
                    for (var cid in playersData) {
                        if (cid !== data.id && playersData[cid].name === data.name) {
                            cachedMatch = cid;
                            break;
                        }
                    }
                    if (cachedMatch) broadcastClaimOffer(data.id, cachedMatch);
                }
            }

            verificarDuplicadoPropioLocal();

        } catch (e) {
            console.error('Mensaje invalido', e);
        }
    });

    mqttClient.on('error', function() {
        hideLoading();
        showNotice('Error de red. Revisa tu internet.', 'Sin conexion');
    });
}

function avisarSalidaExplicita() {
    try {
        if (mqttClient && currentRoom && myId) {
            mqttClient.publish(ROOM_PREFIX + currentRoom, JSON.stringify({ action: 'presence_lost', id: myId }), { qos: 0 });
        }
    } catch (e) {}
}
window.addEventListener('pagehide', avisarSalidaExplicita);
window.addEventListener('beforeunload', avisarSalidaExplicita);

// ===== PUBLICACION =====
function publicar(obj, opts) {
    if (!mqttClient || !currentRoom) return;
    mqttClient.publish(ROOM_PREFIX + currentRoom, JSON.stringify(obj), opts || { qos: 1 });
}

function broadcastState(action) {
    if (action === undefined) action = 'sync';
    var opts = { qos: 1 };
    if (action === 'sync') opts.retain = true;
    publicar({
        action: action,
        id: myId,
        name: myName,
        partida: partida,
        gameInitiator: gameInitiator || null,
        playersData: playersData,
        hostId: hostId || null,
        updatedAt: Date.now()
    }, opts);
}

function broadcastRequestState() { publicar({ action: 'request_state', id: myId }); }
function broadcastHostClaim() { publicar({ action: 'host_claim', id: myId }); }

function broadcastStart(p) {
    publicar({
        action: 'start',
        id: myId,
        name: myName,
        partida: p,
        playersData: playersData,
        hostId: hostId || null,
        updatedAt: Date.now()
    }, { qos: 1, retain: true });
    gameStarted = true;
    gameInitiator = myId;
}

function broadcastMover(hexId, version) {
    publicar({ action: 'mover', id: myId, name: myName, pid: myId, hexId: hexId, version: version });
}
function broadcastPasar(version) {
    publicar({ action: 'pasar', id: myId, name: myName, version: version });
}
function broadcastAtacar(version) {
    publicar({ action: 'atacar', id: myId, name: myName, version: version });
}
function broadcastRetirada(version) {
    publicar({ action: 'retirada', id: myId, name: myName, version: version });
}
function broadcastRemove(idToRemove) {
    publicar({ action: 'remove', id: idToRemove });
}
function broadcastReset(version) {
    publicar({ action: 'reset_all', id: myId, name: myName, version: version });
}
function broadcastClaimOffer(targetId, offeredId) {
    var cached = playersData[offeredId];
    if (!cached) return;
    publicar({ action: 'claim_offer', targetId: targetId, offeredId: offeredId, name: cached.name });
}

function handleRemovedFromRoom() {
    hideLoading();
    ['claimModal', 'resetGameModal', 'removePlayerModal', 'zoomModal'].forEach(function(id) {
        var modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
    });
    pendingRemoveId = null;

    limpiarIntervalos();
    if (mqttClient) { try { mqttClient.end(true); } catch (e) {} mqttClient = null; }

    currentRoom = null;
    playersData = {};
    aplicarPartida(nuevaPartidaVacia());
    gameInitiator = null;
    hostId = null;
    actualizarUI();

    var info = document.getElementById('roomInfoDisplay');
    if (info) info.style.display = 'none';
    var leaderboardPanel = document.getElementById('leaderboardPanel');
    if (leaderboardPanel) leaderboardPanel.style.display = 'none';

    clearSession();
    var banner = document.getElementById('sessionBanner');
    if (banner) banner.style.display = 'none';
    var reconnectBtn = document.getElementById('reconnectBtn');
    if (reconnectBtn) {
        reconnectBtn.disabled = true;
        reconnectBtn.style.opacity = '0.5';
        reconnectBtn.style.cursor = 'not-allowed';
    }
    var lobby = document.getElementById('lobbyModal');
    if (lobby) lobby.style.display = 'flex';

    showNotice('El anfitrion te elimino de la sala. Debes volver a entrar para unirte de nuevo.', 'Fuera de la partida');
}
window.handleRemovedFromRoom = handleRemovedFromRoom;
