// mqtt.js
// ===== SISTEMA MULTIJUGADOR MQTT =====
var mqttClient = null;
var myId = Math.random().toString(36).substr(2, 9);
var currentRoom = null;
var playersData = {};
var myName = 'Jugador';
var claimResolved = false;

// ===== REGISTRO DE JUGADORES EXPULSADOS (para el reclamo "eres tu?") =====
var removedPlayersRegistry = {};

// ===== VENCIMIENTO DE SALAS ABANDONADAS =====
var ROOM_STALE_MS = 12 * 60 * 60 * 1000; // 12 horas

// ===== OCULTAR JUGADORES RECIEN LLEGADOS HASTA CONFIRMAR QUE NO SON UN RECLAMO =====
var hiddenJoiningIds = {};
var confirmedDuplicateIds = {};
var joinGraceTimers = {};

function hideJoiningId(id) {
    hiddenJoiningIds[id] = true;
}
function isJoiningHidden(id) {
    return !!hiddenJoiningIds[id];
}
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

function verificarDuplicadoPropioLocal() {
    if (claimResolved) return false;
    if (misSelecciones.length !== 0) return false;
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
            pendingClaim = {
                oldId: id,
                name: myName,
                selecciones: playersData[id].selecciones || [],
                cartasGanadoras: playersData[id].cartasGanadoras || [],
                puntos: puntosPorJugador[id] || 0
            };
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
        if (hostClaimTimer) {
            clearTimeout(hostClaimTimer);
            hostClaimTimer = null;
        }
        broadcastHostClaim();
        broadcastState('sync');
        if (typeof actualizarUI === 'function') actualizarUI();
        renderLeaderboard();
        saveSession();
    }, jitter);
}
window.claimHost = claimHost;

function mergeCartas(incomingCartas) {
    if (!incomingCartas || !incomingCartas.length) return;
    var localById = {};
    for (var i = 0; i < cartas.length; i++) {
        localById[cartas[i].id] = cartas[i];
    }
    var merged = [];
    for (var j = 0; j < incomingCartas.length; j++) {
        var inc = incomingCartas[j];
        var loc = localById[inc.id];
        if (!loc) {
            merged.push(inc);
            continue;
        }
        merged.push({
            id: inc.id,
            numero: inc.numero,
            imagen: inc.imagen,
            tanda: inc.tanda !== undefined ? inc.tanda : loc.tanda,
            descartada: !!(loc.descartada || inc.descartada),
            esGanadora: !!(loc.esGanadora || inc.esGanadora),
            nombreGanador: loc.nombreGanador || inc.nombreGanador || null,
            seleccionadoPor: loc.seleccionadoPor || inc.seleccionadoPor || null,
            seleccionadoPorId: loc.seleccionadoPorId || inc.seleccionadoPorId || null
        });
    }
    cartas = merged;
}
window.mergeCartas = mergeCartas;

function activeCardIdSaneado(id) {
    if (!id) return null;
    for (var i = 0; i < cartas.length; i++) {
        if (cartas[i].id === id) {
            return cartas[i].descartada ? null : id;
        }
    }
    return id;
}
window.activeCardIdSaneado = activeCardIdSaneado;

function sanearMiActivaLocal() {
    if (!playersData[myId]) return;
    var actual = playersData[myId].activeCardId;
    if (!actual) return;
    var saneado = activeCardIdSaneado(actual);
    if (saneado !== actual) {
        playersData[myId].activeCardId = saneado;
        broadcastSetActive(myId, saneado);
        renderizarMisCorredores();
        if (typeof actualizarUI === 'function') actualizarUI();
        saveSession();
    }
}
window.sanearMiActivaLocal = sanearMiActivaLocal;

function connectToRoom(code, isReconnect) {
    if (isReconnect === undefined) isReconnect = false;

    claimResolved = isReconnect;
    pendingClaim = null;

    if (!isReconnect) {
        playersData = {};
        puntosPorJugador = {};
        estadoRonda = { usado3: false, usado2: false, ganadorCartaId: null, jugadorGanador: null };
        cartas = [];
        misSelecciones = [];
        cartaActivaId = null;
        tandaActual = -1;
        cicloTandaInicio = 0;
        mazoRestante = [];
        copiasVisuales = {};
        gruposExpansion31 = {};
        cartaTwistActual = null;
        gameStarted = false;
        gameInitiator = null;
        hostId = null;
    }

    if (hostClaimTimer) {
        clearTimeout(hostClaimTimer);
        hostClaimTimer = null;
    }
    if (hostHeartbeatInterval) {
        clearInterval(hostHeartbeatInterval);
        hostHeartbeatInterval = null;
    }
    if (presencePingInterval) {
        clearInterval(presencePingInterval);
        presencePingInterval = null;
    }
    if (presenceCheckInterval) {
        clearInterval(presenceCheckInterval);
        presenceCheckInterval = null;
    }
    lastSeenAt = {};

    showLoading(isReconnect ? 'Reconectando a la sala...' : 'Conectando con la sala...');
    claimResolved = isReconnect;
    pendingClaim = null;

    var roomTopic = 'magical_athlete/room/' + code;
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
        var topic = roomTopic;
        mqttClient.subscribe(topic);
        var isSilentReconnect = hasConnectedOnce;
        hasConnectedOnce = true;

        if (playersData[myId]) {
            playersData[myId].offline = false;
        }

        if (!playersData[myId]) {
            playersData[myId] = { 
                name: myName, 
                selecciones: misSelecciones || [],
                cartasGanadoras: [],
                activeCardId: null,
                offline: false
            };
        } else {
            playersData[myId].name = myName;
            playersData[myId].selecciones = misSelecciones || [];
            if (playersData[myId].activeCardId === undefined) {
                playersData[myId].activeCardId = null;
            }
        }

        if (!isReconnect && !isSilentReconnect) {
            hideJoiningId(myId);
            scheduleRevealIfNoClaim(myId);
        }
        
        joinSuccess(code);
        broadcastState('join');
        broadcastRequestState();

        if (hostClaimTimer) {
            clearTimeout(hostClaimTimer);
            hostClaimTimer = null;
        }
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
                    renderLeaderboard();
                    saveSession();
                }
            }, 1800 + Math.random() * 900);
        }

        if (hostHeartbeatInterval) clearInterval(hostHeartbeatInterval);
        hostHeartbeatInterval = setInterval(function() {
            if (hostId === myId && currentRoom) {
                broadcastState('sync');
            }
        }, 15000);

        if (presencePingInterval) clearInterval(presencePingInterval);
        presencePingInterval = setInterval(function() {
            if (mqttClient && currentRoom) {
                mqttClient.publish('magical_athlete/room/' + currentRoom, JSON.stringify({ action: 'ping', id: myId }));
            }
        }, 20000);

        if (presenceCheckInterval) clearInterval(presenceCheckInterval);
        presenceCheckInterval = setInterval(chequearPresenciaStale, 10000);

        saveSession();
    });

    mqttClient.on('message', function(topic, message) {
        try {
            var data = JSON.parse(message.toString());

            if (data.action === 'sync' || data.action === 'start') {
                var antiguedadMs = data.updatedAt ? (Date.now() - data.updatedAt) : Infinity;
                if (antiguedadMs > ROOM_STALE_MS) {
                    try {
                        if (mqttClient) {
                            mqttClient.publish(topic, '', { qos: 1, retain: true });
                        }
                    } catch (e) {}
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
                if (data.removedName) {
                    removedPlayersRegistry[data.removedName] = {
                        oldId: data.id,
                        selecciones: data.removedSelecciones || [],
                        cartasGanadoras: data.removedCartasGanadoras || [],
                        puntos: data.removedPuntos || 0
                    };
                }
                delete playersData[data.id];
                delete puntosPorJugador[data.id];
                forgetJoiningId(data.id);
                if (hostId === data.id) {
                    hostId = null;
                }
                renderLeaderboard();
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
                if (data.targetId === myId && !claimResolved && misSelecciones.length === 0) {
                    claimResolved = true;
                    pendingClaim = { 
                        oldId: data.offeredId, 
                        name: data.name, 
                        selecciones: data.selecciones || [],
                        cartasGanadoras: data.cartasGanadoras || [],
                        puntos: data.puntos || 0
                    };
                    showClaimModal(pendingClaim);
                }
                return;
            }

            if (data.action === 'claim_declined') {
                revealJoiningId(data.id);
                return;
            }

            var duplicadoId = null;
            var duplicadoInfo = null;
            if (data.name === myName && data.id && data.id !== myId) {
                duplicadoId = data.id;
                duplicadoInfo = {
                    selecciones: data.selecciones || [],
                    cartasGanadoras: data.cartasGanadoras || [],
                    puntos: (data.puntosPorJugador && data.puntosPorJugador[data.id]) || data.puntos || 0
                };
            } else if (data.playersData) {
                for (var pidDup in data.playersData) {
                    if (pidDup !== myId && data.playersData[pidDup] && data.playersData[pidDup].name === myName) {
                        duplicadoId = pidDup;
                        duplicadoInfo = {
                            selecciones: data.playersData[pidDup].selecciones || [],
                            cartasGanadoras: data.playersData[pidDup].cartasGanadoras || [],
                            puntos: (data.puntosPorJugador && data.puntosPorJugador[pidDup]) || 0
                        };
                        break;
                    }
                }
            }
            if (!claimResolved && duplicadoId && misSelecciones.length === 0) {
                claimResolved = true;
                confirmedDuplicateIds[myId] = true;
                hideJoiningId(myId);
                if (joinGraceTimers[myId]) {
                    clearTimeout(joinGraceTimers[myId]);
                    delete joinGraceTimers[myId];
                }
                pendingClaim = { 
                    oldId: duplicadoId, 
                    name: myName, 
                    selecciones: duplicadoInfo.selecciones,
                    cartasGanadoras: duplicadoInfo.cartasGanadoras,
                    puntos: duplicadoInfo.puntos || (puntosPorJugador[duplicadoId]) || 0
                };
                showClaimModal(pendingClaim);
                return;
            }

            if (data.id && data.name && data.action !== 'request_state' && data.action !== 'remove' && data.action !== 'sync' && data.action !== 'set_active') {
                if (!playersData[data.id]) {
                    playersData[data.id] = { name: data.name, selecciones: [], cartasGanadoras: [], activeCardId: null };
                }
                playersData[data.id].name = data.name;
                if (data.selecciones) {
                    playersData[data.id].selecciones = data.selecciones;
                }
                if (data.cartasGanadoras) {
                    playersData[data.id].cartasGanadoras = data.cartasGanadoras;
                }
                renderLeaderboard();
            }

            if (data.action === 'reset_all') {
                var seenNames = {};
                var toRemove = [];
                for (var id in playersData) {
                    var name = playersData[id].name;
                    if (seenNames[name] !== undefined) {
                        toRemove.push(id);
                    } else {
                        seenNames[name] = id;
                    }
                }
                for (var i = 0; i < toRemove.length; i++) {
                    delete playersData[toRemove[i]];
                    delete puntosPorJugador[toRemove[i]];
                }
                resetLocalGame();
                return;
            }

            if (data.action === 'host_claim') {
                if (!hostId || hostConfirmedAbsent()) {
                    hostId = data.id;
                    if (hostClaimTimer) {
                        clearTimeout(hostClaimTimer);
                        hostClaimTimer = null;
                    }
                    actualizarUI();
                    renderLeaderboard();
                    saveSession();
                } else if (data.id !== hostId && data.id < hostId) {
                    hostId = data.id;
                    if (hostClaimTimer) {
                        clearTimeout(hostClaimTimer);
                        hostClaimTimer = null;
                    }
                    if (hostHeartbeatInterval && hostId !== myId) {
                        clearInterval(hostHeartbeatInterval);
                        hostHeartbeatInterval = null;
                    }
                    actualizarUI();
                    renderLeaderboard();
                    saveSession();
                }
                return;
            }

            if (data.hostId && data.hostId !== hostId) {
                if (!hostId || hostConfirmedAbsent() || data.hostId < hostId) {
                    hostId = data.hostId;
                    if (hostClaimTimer) {
                        clearTimeout(hostClaimTimer);
                        hostClaimTimer = null;
                    }
                    if (hostHeartbeatInterval && hostId !== myId) {
                        clearInterval(hostHeartbeatInterval);
                        hostHeartbeatInterval = null;
                    }
                }
            }

            if (data.action === 'start') {
                gameStarted = true;
                gameInitiator = data.id;
                cartas = data.cartas || [];
                tandaActual = data.tandaActual !== undefined ? data.tandaActual : 0;
                mazoRestante = data.mazoRestante || [];
                if (data.nuevoCiclo) {
                    cicloTandaInicio = tandaActual;
                }
                if (data.id !== myId && data.esPrimerLote) {
                    misSelecciones = [];
                    puntosPorJugador = {};
                    cartaActivaId = null;
                    copiasVisuales = {};
                    gruposExpansion31 = {};
                    if (playersData[myId]) playersData[myId].activeCardId = null;
                }
                estadoRonda = { usado3: false, usado2: false, ganadorCartaId: null, jugadorGanador: null };
                if (data.cartaTwistActual !== undefined) {
                    cartaTwistActual = data.cartaTwistActual;
                }
                for (var pid in playersData) {
                    if (!puntosPorJugador[pid]) {
                        puntosPorJugador[pid] = 0;
                    }
                    if (playersData[pid] && playersData[pid].activeCardId === undefined) {
                        playersData[pid].activeCardId = null;
                    }
                }
                sanearMiActivaLocal();
                renderizarCartas();
                renderizarMisCorredores();
                actualizarUI();
                saveSession();
            }

            if (data.action === 'puntaje_global') {
                var jugadorId = data.id;
                var tipo = data.tipo;
                var nuevosPuntos = data.puntos;
                if (jugadorId === myId) {
                    puntosPorJugador[myId] = nuevosPuntos;
                } else {
                    if (!puntosPorJugador[jugadorId]) {
                        puntosPorJugador[jugadorId] = 0;
                    }
                    puntosPorJugador[jugadorId] = nuevosPuntos;
                }
                if (tipo === '+3' || tipo === '+2') {
                    estadoRonda.usado3 = (tipo === '+3');
                    estadoRonda.usado2 = (tipo === '+2');
                    if (tipo === '+3') {
                        estadoRonda.ganadorCartaId = data.cartaId || null;
                        estadoRonda.jugadorGanador = data.id;
                        for (var i = 0; i < cartas.length; i++) {
                            if (cartas[i].id === data.cartaId) {
                                cartas[i].esGanadora = true;
                                cartas[i].nombreGanador = data.name || null;
                                break;
                            }
                        }
                        if (playersData[jugadorId]) {
                            if (!playersData[jugadorId].cartasGanadoras) {
                                playersData[jugadorId].cartasGanadoras = [];
                            }
                            if (playersData[jugadorId].cartasGanadoras.indexOf(data.cartaId) === -1) {
                                playersData[jugadorId].cartasGanadoras.push(data.cartaId);
                            }
                        }
                    }
                    if (tipo === '+2') {
                        if (typeof window.aplicarDescarteActivas === 'function') {
                            window.aplicarDescarteActivas(estadoRonda.jugadorGanador);
                        }
                        setTimeout(function() {
                            reiniciarRonda();
                        }, 500);
                    }
                }
                actualizarUI();
                saveSession();
            }

            if (data.action === 'estado_ronda') {
                estadoRonda = data.estado;
                actualizarUI();
                saveSession();
            }

            if (data.action === 'set_active') {
                var jugadorId = data.id;
                var activeCardId = data.activeCardId;
                if (playersData[jugadorId]) {
                    playersData[jugadorId].activeCardId = activeCardId;
                } else {
                    playersData[jugadorId] = { name: data.name || jugadorId, selecciones: [], cartasGanadoras: [], activeCardId: activeCardId };
                }
                renderizarMisCorredores();
                actualizarUI();
                saveSession();
            }

            if (data.action === 'select') {
                var cartaId = data.cartaId;
                var jugadorNombre = data.name;
                var jugadorId = data.id;
                var selecciones = data.selecciones || [];
                var tandaSelect = data.tandaActual !== undefined ? data.tandaActual : 0;
                
                for (var i = 0; i < cartas.length; i++) {
                    if (cartas[i].id === cartaId) {
                        cartas[i].seleccionadoPor = jugadorNombre;
                        cartas[i].seleccionadoPorId = jugadorId;
                        break;
                    }
                }
                
                if (playersData[jugadorId]) {
                    playersData[jugadorId].selecciones = selecciones;
                }
                
                if (jugadorId === myId) {
                    misSelecciones = selecciones.slice();
                }
                
                renderizarCartas();
                renderizarMisCorredores();
                renderLeaderboard();
                actualizarUI();
                saveSession();
                if (typeof window.verificarSiguienteLote === 'function') {
                    window.verificarSiguienteLote();
                }
            }

            if (data.action === 'sync') {
                if (data.cartas) {
                    mergeCartas(data.cartas);
                    renderizarCartas();
                }
                if (data.tandaActual !== undefined) {
                    tandaActual = data.tandaActual;
                }
                if (data.cicloTandaInicio !== undefined) {
                    cicloTandaInicio = data.cicloTandaInicio;
                }
                if (data.mazoRestante !== undefined) {
                    mazoRestante = data.mazoRestante;
                }
                if (data.gameStarted !== undefined) {
                    gameStarted = data.gameStarted;
                }
                if (data.gameInitiator) {
                    gameInitiator = data.gameInitiator;
                }
                if (data.playersData) {
                    for (var pid in data.playersData) {
                        if (pid !== myId) {
                            if (!playersData[pid]) {
                                playersData[pid] = { name: data.playersData[pid].name, selecciones: [], cartasGanadoras: [], activeCardId: null };
                            }
                            playersData[pid].name = data.playersData[pid].name;
                            playersData[pid].selecciones = data.playersData[pid].selecciones || [];
                            playersData[pid].cartasGanadoras = data.playersData[pid].cartasGanadoras || [];
                            if (data.playersData[pid].activeCardId !== undefined) {
                                playersData[pid].activeCardId = activeCardIdSaneado(data.playersData[pid].activeCardId);
                            }
                        }
                    }
                }
                if (data.puntosPorJugador) {
                    for (var pid in data.puntosPorJugador) {
                        if (pid !== myId) {
                            puntosPorJugador[pid] = data.puntosPorJugador[pid];
                        }
                    }
                }
                if (data.estadoRonda) {
                    estadoRonda = data.estadoRonda;
                }
                if (data.cartaTwistActual !== undefined) {
                    cartaTwistActual = data.cartaTwistActual;
                }
                sanearMiActivaLocal();
                actualizarUI();
                saveSession();
            }

            if (data.action === 'request_state') {
                broadcastState('sync');
            }

            if (data.action === 'join' || data.action === 'sync') {
                var isNewJoin = data.action === 'join' && !playersData[data.id];
                if (!playersData[data.id]) {
                    playersData[data.id] = {
                        name: data.name,
                        selecciones: data.selecciones || [],
                        cartasGanadoras: data.cartasGanadoras || [],
                        activeCardId: data.activeCardId !== undefined ? activeCardIdSaneado(data.activeCardId) : null
                    };
                } else {
                    playersData[data.id].name = data.name;
                    playersData[data.id].selecciones = data.selecciones || [];
                    playersData[data.id].cartasGanadoras = data.cartasGanadoras || [];
                    if (data.activeCardId !== undefined) {
                        playersData[data.id].activeCardId = activeCardIdSaneado(data.activeCardId);
                    }
                }

                if (isNewJoin) {
                    hideJoiningId(data.id);
                    scheduleRevealIfNoClaim(data.id);
                }

                renderLeaderboard();

                var cachedMatch = null;
                if (data.action === 'join') {
                    for (var id in playersData) {
                        if (id !== data.id && playersData[id].name === data.name) {
                            cachedMatch = id;
                            break;
                        }
                    }
                    if (cachedMatch) {
                        broadcastClaimOffer(data.id, cachedMatch);
                    } else if (removedPlayersRegistry[data.name]) {
                        var respaldo = removedPlayersRegistry[data.name];
                        broadcastClaimOffer(data.id, respaldo.oldId, {
                            name: data.name,
                            selecciones: respaldo.selecciones,
                            cartasGanadoras: respaldo.cartasGanadoras,
                            puntos: respaldo.puntos
                        });
                    }
                }
            }

            verificarDuplicadoPropioLocal();

        } catch(e) { 
            console.error('Mensaje invalido', e); 
        }
    });

    mqttClient.on('error', function(err) {
        hideLoading();
        showNotice('Error de red. Revisa tu internet.', 'Sin conexion');
    });
}

function avisarSalidaExplicita() {
    try {
        if (mqttClient && currentRoom && myId) {
            mqttClient.publish(
                'magical_athlete/room/' + currentRoom,
                JSON.stringify({ action: 'presence_lost', id: myId }),
                { qos: 0 }
            );
        }
    } catch (e) {}
}
window.addEventListener('pagehide', avisarSalidaExplicita);
window.addEventListener('beforeunload', avisarSalidaExplicita);

function broadcastState(action) {
    if (action === undefined) action = 'sync';
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: action,
            id: myId,
            name: myName,
            selecciones: misSelecciones || [],
            cartas: cartas || [],
            tandaActual: tandaActual,
            cicloTandaInicio: cicloTandaInicio,
            mazoRestante: mazoRestante || [],
            gameStarted: gameStarted,
            gameInitiator: gameInitiator || null,
            playersData: playersData,
            puntosPorJugador: puntosPorJugador,
            estadoRonda: estadoRonda,
            cartaTwistActual: cartaTwistActual || null,
            hostId: hostId || null,
            updatedAt: Date.now()
        });
        var opts = { qos: 1 };
        if (action === 'sync') {
            opts.retain = true;
        }
        mqttClient.publish(topic, payload, opts);
    }
}

function broadcastRequestState() {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'request_state',
            id: myId
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastHostClaim() {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'host_claim',
            id: myId
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastStart(cartasArray, tanda, mazo, esPrimerLote, nuevoCiclo) {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'start',
            id: myId,
            name: myName,
            cartas: cartasArray,
            tandaActual: tanda !== undefined ? tanda : 0,
            cicloTandaInicio: cicloTandaInicio,
            mazoRestante: mazo || [],
            esPrimerLote: !!esPrimerLote,
            nuevoCiclo: !!nuevoCiclo,
            gameStarted: true,
            playersData: playersData,
            puntosPorJugador: puntosPorJugador,
            estadoRonda: estadoRonda,
            cartaTwistActual: cartaTwistActual || null,
            hostId: hostId || null,
            updatedAt: Date.now()
        });
        mqttClient.publish(topic, payload, { qos: 1, retain: true });
        gameStarted = true;
        gameInitiator = myId;
        tandaActual = tanda !== undefined ? tanda : 0;
        mazoRestante = mazo || [];
    }
}

function broadcastSelect(cartaId) {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'select',
            id: myId,
            name: myName,
            cartaId: cartaId,
            selecciones: misSelecciones || [],
            tandaActual: tandaActual
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastPuntajeGlobal(tipo) {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'puntaje_global',
            id: myId,
            name: myName,
            tipo: tipo,
            puntos: puntosPorJugador[myId],
            cartaId: estadoRonda.ganadorCartaId || null
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastEstadoRonda() {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'estado_ronda',
            id: myId,
            estado: estadoRonda
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastRemove(idToRemove, removedSnapshot) {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'remove',
            id: idToRemove,
            removedName: removedSnapshot ? removedSnapshot.name : null,
            removedSelecciones: removedSnapshot ? removedSnapshot.selecciones : null,
            removedCartasGanadoras: removedSnapshot ? removedSnapshot.cartasGanadoras : null,
            removedPuntos: removedSnapshot ? removedSnapshot.puntos : null
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastReset() {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'reset_all',
            id: myId,
            name: myName
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastClaimOffer(targetId, offeredId, overrideData) {
    if (mqttClient && currentRoom) {
        var cached = overrideData || playersData[offeredId];
        if (!cached) return;
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'claim_offer',
            targetId: targetId,
            offeredId: offeredId,
            name: cached.name,
            selecciones: cached.selecciones || [],
            cartasGanadoras: cached.cartasGanadoras || [],
            puntos: overrideData ? (overrideData.puntos || 0) : (puntosPorJugador[offeredId] || 0)
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastSetActive(playerId, activeCardId) {
    if (mqttClient && currentRoom) {
        var topic = 'magical_athlete/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'set_active',
            id: playerId,
            activeCardId: activeCardId
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}
window.broadcastSetActive = broadcastSetActive;

function handleRemovedFromRoom() {
    hideLoading();

    ['claimModal', 'resetGameModal', 'removePlayerModal', 'zoomModal', 'ganadoresModal', 'intercambioModal'].forEach(function(id) {
        var modal = document.getElementById(id);
        if (modal) modal.style.display = 'none';
    });
    pendingRemoveId = null;

    if (hostClaimTimer) { clearTimeout(hostClaimTimer); hostClaimTimer = null; }
    if (hostHeartbeatInterval) { clearInterval(hostHeartbeatInterval); hostHeartbeatInterval = null; }
    if (presencePingInterval) { clearInterval(presencePingInterval); presencePingInterval = null; }
    if (mqttClient) { try { mqttClient.end(true); } catch (e) {} mqttClient = null; }

    currentRoom = null;
    playersData = {};
    puntosPorJugador = {};
    estadoRonda = { usado3: false, usado2: false, ganadorCartaId: null, jugadorGanador: null };
    cartas = [];
    misSelecciones = [];
    cartaActivaId = null;
    tandaActual = -1;
    cicloTandaInicio = 0;
    mazoRestante = [];
    copiasVisuales = {};
    gruposExpansion31 = {};
    cartaTwistActual = null;
    gameStarted = false;
    gameInitiator = null;
    hostId = null;

    renderizarCartas();
    renderizarMisCorredores();
    actualizarUI();
    renderLeaderboard();

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