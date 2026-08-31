// mqtt.js - EcoTrole
var mqttClient = null;
var myId = Math.random().toString(36).substr(2, 9);
var currentRoom = null;
var playersData = {};
var myName = 'Jugador';
var claimResolved = false;
var removedPlayersRegistry = {};
var ROOM_STALE_MS = 12 * 60 * 60 * 1000;

var hiddenJoiningIds = {};
var confirmedDuplicateIds = {};
var joinGraceTimers = {};
var hostId = null;
var hostClaimTimer = null;
var hostHeartbeatInterval = null;
var presencePingInterval = null;
var lastSeenAt = {};
var PRESENCE_TIMEOUT_MS = 50000;
var presenceCheckInterval = null;

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

function hostConfirmedAbsent() {
    return !!(hostId && playersData[hostId] && playersData[hostId].offline);
}

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

function connectToRoom(code, isReconnect) {
    if (isReconnect === undefined) isReconnect = false;

    claimResolved = isReconnect;
    pendingClaim = null;

    if (!isReconnect) {
        playersData = {};
        juegoIniciado = false;
        rolesAsignados = false;
        miRol = null;
        miHabilidad = null;
        misCartas = [];
        misItems = [];
        mazoAccionesRestantes = [];
        accionesRestantes = 0;
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

    var roomTopic = 'ecotrole/room/' + code;
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
                rol: null,
                habilidad: null,
                items: [],
                acciones: [],
                estadoJuego: null,
                offline: false
            };
        } else {
            playersData[myId].name = myName;
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
        }, 4000); // antes 15000: mas frecuente para que la auto-recuperacion
                  // (self-heal) actue casi de inmediato si alguien se perdio
                  // el reparto de roles o una decision.

        if (presencePingInterval) clearInterval(presencePingInterval);
        presencePingInterval = setInterval(function() {
            if (mqttClient && currentRoom) {
                mqttClient.publish('ecotrole/room/' + currentRoom, JSON.stringify({ action: 'ping', id: myId }));
            }
        }, 20000);

        if (presenceCheckInterval) clearInterval(presenceCheckInterval);
        presenceCheckInterval = setInterval(chequearPresenciaStale, 10000);

        saveSession();
    });

    mqttClient.on('message', function(topic, message) {
        // Verificar que el mensaje no esté vacío
        if (!message || message.length === 0) {
            try {
                if (mqttClient) {
                    mqttClient.publish(topic, '', { qos: 1, retain: true });
                }
            } catch (e) {}
            return;
        }

        try {
            var data = JSON.parse(message.toString());
        } catch (parseError) {
            console.warn('Mensaje MQTT no válido recibido, limpiando...');
            try {
                if (mqttClient) {
                    mqttClient.publish(topic, '', { qos: 1, retain: true });
                }
            } catch (e) {}
            return;
        }

        // Procesamiento de mensajes
        try {
            if (data.action === 'sync' || data.action === 'start_game') {
                // BUG CRITICO CORREGIDO: start_game se publicaba con "timestamp",
                // pero aqui solo se leia "updatedAt" -> siempre daba Infinity -> el
                // mensaje se descartaba como "viejo" antes de asignar roles a nadie
                // salvo el anfitrion (que aplica su rol localmente, sin pasar por MQTT).
                var marcaTiempo = data.updatedAt || data.timestamp;
                var antiguedadMs = marcaTiempo ? (Date.now() - marcaTiempo) : 0;
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
                delete playersData[data.id];
                if (hostId === data.id) {
                    hostId = null;
                }
                renderLeaderboard();
                actualizarUI();
                saveSession();
                return;
            }

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
                if (data.targetId === myId && !claimResolved) {
                    claimResolved = true;
                    pendingClaim = {
                        oldId: data.offeredId,
                        name: data.name,
                        rol: data.rol || null,
                        habilidad: data.habilidad || null,
                        items: data.items || [],
                        acciones: data.acciones || [],
                        estadoJuego: data.estadoJuego || null,
                        cartas: data.cartas || []
                    };
                    showClaimModal(pendingClaim);
                }
                return;
            }

            if (data.action === 'claim_declined') {
                revealJoiningId(data.id);
                return;
            }

            if (data.id && data.name && data.action !== 'request_state' && data.action !== 'remove' && data.action !== 'sync') {
                if (!playersData[data.id]) {
                    playersData[data.id] = { name: data.name, rol: null, habilidad: null, items: [], acciones: [], estadoJuego: null };
                }
                playersData[data.id].name = data.name;
                renderLeaderboard();
            }

            if (data.action === 'reset_all') {
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
                }
            }

            if (data.action === 'start_game') {
                // Guardia anti-duplicados: si ya tengo mi rol para esta partida,
                // ignoro reprocesar (puede llegar mas de una vez por reintentos
                // de red o por el eco del propio anfitrion). Reprocesar de nuevo
                // borraria y regeneraria mis cartas, perdiendo las que haya
                // dibujado despues del primer reparto.
                if (rolesAsignados && miRol) {
                    return;
                }

                juegoIniciado = true;
                rolesAsignados = true;
                juegoIniciador = data.id;
                hostId = data.hostId || hostId;

                if (typeof resetVictoria === 'function') resetVictoria();
                if (typeof resetRobos === 'function') resetRobos();

                for (var id in data.roles) {
                    if (!playersData[id]) {
                        playersData[id] = { name: id, rol: null, habilidad: null, items: [], acciones: [], estadoJuego: null };
                    }
                    playersData[id].rol = data.roles[id];
                    playersData[id].items = ITEMS_FIJOS.slice();
                    playersData[id].estadoJuego = ESTADO_JUGADOR.ACTIVO;
                    if (data.habilidades && data.habilidades[id]) {
                        playersData[id].habilidad = data.habilidades[id];
                    }

                    if (id === myId) {
                        miRol = data.roles[id];
                        miHabilidad = (data.habilidades && data.habilidades[id]) || null;
                        misItems = ITEMS_FIJOS.slice();
                        misCartas = [];

                        if (miHabilidad) {
                            misCartas.push({
                                id: 'hab-' + Date.now() + '-' + Math.random(),
                                numero: miHabilidad.numero,
                                imagen: miHabilidad.imagen,
                                tipo: 'habilidad',
                                esMia: true
                            });
                        }

                        var misNumsAccion = (data.acciones && data.acciones[id]) || [];
                        var idsAccion = [];
                        for (var a = 0; a < misNumsAccion.length; a++) {
                            var numAccion = misNumsAccion[a];
                            var cartaAccion = {
                                id: 'acc-' + Date.now() + '-' + Math.random() + '-' + a,
                                numero: numAccion,
                                imagen: getImagenAccion(numAccion),
                                tipo: 'accion',
                                esMia: true
                            };
                            misCartas.push(cartaAccion);
                            idsAccion.push(cartaAccion.id);
                        }
                        playersData[id].acciones = idsAccion;
                    }
                }

                if (data.mazoAcciones) {
                    mazoAccionesRestantes = data.mazoAcciones.slice();
                    accionesRestantes = mazoAccionesRestantes.length;
                }

                renderizarMisCartas();
                actualizarUI();
                saveSession();
                return;
            }

            if (data.action === 'accion_obtenida') {
                if (data.id === myId) {
                    // Ya se procesó localmente
                } else {
                    if (playersData[data.id]) {
                        if (!playersData[data.id].acciones) {
                            playersData[data.id].acciones = [];
                        }
                        playersData[data.id].acciones.push(data.carta.id);
                    }
                    // Quitamos exactamente ese numero de nuestra copia local del mazo
                    // compartido, para que todos vean el mismo mazo restante.
                    if (data.carta && typeof data.carta.numero === 'number') {
                        var posNum = mazoAccionesRestantes.indexOf(data.carta.numero);
                        if (posNum !== -1) mazoAccionesRestantes.splice(posNum, 1);
                    }
                    if (data.accionesRestantes !== undefined) {
                        accionesRestantes = data.accionesRestantes;
                    } else {
                        accionesRestantes = mazoAccionesRestantes.length;
                    }
                }
                renderLeaderboard();
                actualizarUI();
                saveSession();
                return;
            }

            if (data.action === 'accion_activada') {
                if (data.id === myId) {
                    // Ya se procesó localmente
                } else {
                    if (playersData[data.id] && playersData[data.id].acciones) {
                        var posId = playersData[data.id].acciones.indexOf(data.cartaId);
                        if (posId !== -1) playersData[data.id].acciones.splice(posId, 1);
                    }
                    if (typeof data.numero === 'number' && mazoAccionesRestantes.indexOf(data.numero) === -1) {
                        mazoAccionesRestantes.push(data.numero);
                    }
                    accionesRestantes = mazoAccionesRestantes.length;
                }
                renderLeaderboard();
                actualizarUI();
                saveSession();
                return;
            }

            if (data.action === 'decision') {
                // Solo el anfitrion genera estas decisiones (Meta / Expulsar).
                if (data.id === myId) {
                    // Ya se procesó localmente al presionar el boton.
                } else if (typeof aplicarDecision === 'function') {
                    aplicarDecision(data.targetId, data.subAccion);
                }
                return;
            }

            if (data.action === 'robo_ejecutado') {
                if (data.id === myId) {
                    // Ya se procesó localmente al presionar el boton.
                } else if (typeof aplicarRobo === 'function') {
                    aplicarRobo(data.targetId, data.item);
                }
                return;
            }

            if (data.action === 'sync') {
                if (data.juegoIniciado !== undefined) {
                    juegoIniciado = data.juegoIniciado;
                }
                if (data.rolesAsignados !== undefined) {
                    rolesAsignados = data.rolesAsignados;
                }
                if (data.mazoAccionesRestantes !== undefined) {
                    mazoAccionesRestantes = data.mazoAccionesRestantes;
                }
                if (data.accionesRestantes !== undefined) {
                    accionesRestantes = data.accionesRestantes;
                }
                if (data.hostId !== undefined) {
                    hostId = data.hostId;
                }
                if (data.juegoTerminado !== undefined) {
                    juegoTerminado = data.juegoTerminado;
                }
                if (data.equipoGanador !== undefined) {
                    equipoGanador = data.equipoGanador;
                }
                if (data.motivoVictoria !== undefined) {
                    motivoVictoria = data.motivoVictoria;
                }
                if (data.objetosRobados !== undefined && typeof objetosRobados !== 'undefined') {
                    // Nunca retrocede: si llega un 'sync' viejo/reordenado, no
                    // queremos que el contador de objetos robados baje.
                    objetosRobados = Math.max(objetosRobados, data.objetosRobados);
                    if (typeof actualizarContadorRobos === 'function') actualizarContadorRobos();
                }
                if (data.playersData) {
                    for (var pid in data.playersData) {
                        var remoteP = data.playersData[pid];
                        if (pid !== myId) {
                            if (!playersData[pid]) {
                                playersData[pid] = { name: remoteP.name, rol: null, habilidad: null, items: [], acciones: [], estadoJuego: null };
                            }
                            playersData[pid].name = remoteP.name;
                            playersData[pid].rol = remoteP.rol || null;
                            playersData[pid].habilidad = remoteP.habilidad || null;
                            playersData[pid].items = remoteP.items || [];
                            playersData[pid].acciones = remoteP.acciones || [];
                            playersData[pid].estadoJuego = remoteP.estadoJuego || null;
                        } else {
                            if (rolesAsignados && !miRol && remoteP.rol) {
                                // AUTO-RECUPERACION 1: si el juego ya empezo pero yo (por algun
                                // mensaje perdido) nunca recibi mi rol/habilidad/items, los recupero
                                // de la copia que el anfitrion tiene de mi en su ultimo sync.
                                miRol = remoteP.rol;
                                misItems = (remoteP.items && remoteP.items.length) ? remoteP.items.slice() : ITEMS_FIJOS.slice();
                                if (remoteP.habilidad) {
                                    var yaTengoHabilidad = misCartas.some(function(c) {
                                        return c.tipo === 'habilidad';
                                    });
                                    if (!yaTengoHabilidad) {
                                        miHabilidad = remoteP.habilidad;
                                        misCartas.push({
                                            id: 'hab-' + Date.now() + '-' + Math.random(),
                                            numero: remoteP.habilidad.numero,
                                            imagen: remoteP.habilidad.imagen,
                                            tipo: 'habilidad',
                                            esMia: true
                                        });
                                    }
                                }
                                if (playersData[myId]) {
                                    playersData[myId].rol = miRol;
                                    playersData[myId].habilidad = miHabilidad;
                                    playersData[myId].items = misItems;
                                }
                            }

                            // AUTO-RECUPERACION 2: el anfitrion ya me marco "Meta" o "Expulsado"
                            // (con su posible conversion de rol) pero yo nunca recibi ese
                            // mensaje 'decision'. Lo aplico aqui para no quedar desincronizado.
                            if (remoteP.estadoJuego && remoteP.estadoJuego !== ESTADO_JUGADOR.ACTIVO &&
                                playersData[myId] && playersData[myId].estadoJuego !== remoteP.estadoJuego) {
                                miRol = remoteP.rol || miRol;
                                playersData[myId].rol = miRol;
                                playersData[myId].estadoJuego = remoteP.estadoJuego;
                                if (typeof revisarVictoria === 'function') revisarVictoria();
                            }
                        }
                    }
                }
                actualizarUI();
                saveSession();
                if (typeof actualizarBannerVictoria === 'function') actualizarBannerVictoria();
                if (typeof notificarVictoriaSiCorresponde === 'function') notificarVictoriaSiCorresponde();
                return;
            }

            if (data.action === 'request_state') {
                broadcastState('sync');
                if (typeof window.broadcastSincronizarTiempo === 'function') {
                    window.broadcastSincronizarTiempo();
                }
                return;
            }

            if (data.action === 'join' || data.action === 'sync') {
                var isNewJoin = data.action === 'join' && !playersData[data.id];
                if (!playersData[data.id]) {
                    playersData[data.id] = {
                        name: data.name,
                        rol: null,
                        habilidad: null,
                        items: [],
                        acciones: [],
                        estadoJuego: null
                    };
                } else {
                    playersData[data.id].name = data.name;
                }

                if (isNewJoin) {
                    hideJoiningId(data.id);
                    scheduleRevealIfNoClaim(data.id);
                }

                renderLeaderboard();

                if (data.action === 'join') {
                    for (var id in playersData) {
                        if (id !== data.id && playersData[id].name === data.name) {
                            broadcastClaimOffer(data.id, id);
                            break;
                        }
                    }
                }
                return;
            }

            // === NUEVOS HANDLERS PARA PUNTOS ===
            if (data.action === 'punto_consumido') {
                if (typeof window.recibirPuntoConsumido === 'function') {
                    window.recibirPuntoConsumido(data);
                }
                return;
            }

            if (data.action === 'puntos_reset') {
                if (typeof window.recibirPuntosReset === 'function') {
                    window.recibirPuntosReset(data);
                }
                return;
            }

            // === HANDLERS PARA EL TEMPORIZADOR (faltaban - causaban que el tiempo no corriera para todos) ===
            if (data.action === 'tiempo_inicio') {
                if (typeof window.recibirTiempoInicio === 'function') {
                    window.recibirTiempoInicio(data);
                }
                return;
            }

            if (data.action === 'tiempo_pausa') {
                if (typeof window.recibirTiempoPausa === 'function') {
                    window.recibirTiempoPausa(data);
                }
                return;
            }

            if (data.action === 'tiempo_reanudar') {
                if (typeof window.recibirTiempoReanudar === 'function') {
                    window.recibirTiempoReanudar(data);
                }
                return;
            }

            if (data.action === 'tiempo_terminado') {
                if (typeof window.recibirTiempoTerminado === 'function') {
                    window.recibirTiempoTerminado(data);
                }
                return;
            }

            if (data.action === 'tiempo_sync') {
                if (typeof window.recibirTiempoSync === 'function') {
                    window.recibirTiempoSync(data);
                }
                return;
            }

        } catch (e) {
            console.error('Error procesando mensaje MQTT', e);
        }
    });

    mqttClient.on('error', function(err) {
        hideLoading();
        showNotice('Error de red. Revisa tu internet.', 'Sin conexion');
    });
}

function joinSuccess(code) {
    hideLoading();
    document.getElementById('lobbyModal').style.display = 'none';
    var info = document.getElementById('roomInfoDisplay');
    info.style.display = 'inline-block';
    info.textContent = 'SALA: ' + code;
    document.getElementById('leaderboardPanel').style.display = 'flex';
    renderLeaderboard();
}

function avisarSalidaExplicita() {
    try {
        if (mqttClient && currentRoom && myId) {
            mqttClient.publish(
                'ecotrole/room/' + currentRoom,
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
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: action,
            id: myId,
            name: myName,
            playersData: playersData,
            juegoIniciado: juegoIniciado,
            rolesAsignados: rolesAsignados,
            mazoAccionesRestantes: mazoAccionesRestantes,
            accionesRestantes: accionesRestantes,
            hostId: hostId || null,
            juegoTerminado: (typeof juegoTerminado !== 'undefined') ? juegoTerminado : false,
            equipoGanador: (typeof equipoGanador !== 'undefined') ? equipoGanador : null,
            motivoVictoria: (typeof motivoVictoria !== 'undefined') ? motivoVictoria : '',
            objetosRobados: (typeof objetosRobados !== 'undefined') ? objetosRobados : 0,
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
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'request_state',
            id: myId
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastHostClaim() {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'host_claim',
            id: myId
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastRemove(idToRemove) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'remove',
            id: idToRemove
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastClaimOffer(targetId, offeredId) {
    if (mqttClient && currentRoom) {
        var cached = playersData[offeredId];
        if (!cached) return;
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'claim_offer',
            targetId: targetId,
            offeredId: offeredId,
            name: cached.name,
            rol: cached.rol || null,
            habilidad: cached.habilidad || null,
            items: cached.items || [],
            acciones: cached.acciones || [],
            estadoJuego: cached.estadoJuego || null
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function handleRemovedFromRoom() {
    hideLoading();

    ['claimModal', 'resetGameModal', 'removePlayerModal', 'zoomModal'].forEach(function(id) {
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
    juegoIniciado = false;
    rolesAsignados = false;
    miRol = null;
    miHabilidad = null;
    misCartas = [];
    misItems = [];
    mazoAccionesRestantes = [];
    accionesRestantes = 0;
    hostId = null;

    renderizarMisCartas();
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