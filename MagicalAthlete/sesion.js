// sesion.js (sin cambios)
// ===== PERSISTENCIA DE SESION (RECONEXION) =====
var SESSION_KEY = 'magical_athlete_session_v1';
var REGISTRY_KEY = 'magical_athlete_players_v1';

// ===== DETECCION DE PARAMETROS URL =====
(function detectarYGuardarParamsURL() {
    var urlParams = new URLSearchParams(window.location.search);
    var nombre = urlParams.get('nombre');
    var sala = urlParams.get('sala');
    console.log('MagicalAthlete - Parametros URL:', { nombre: nombre, sala: sala });
    if (nombre) {
        localStorage.setItem('magical_athlete_nombre_prefill', nombre);
    }
    if (sala && sala.length >= 4) {
        localStorage.setItem('magical_athlete_sala_prefill', sala.toUpperCase());
    }
})();

function getPrefilledName() {
    var name = localStorage.getItem('magical_athlete_nombre_prefill');
    if (name) {
        localStorage.removeItem('magical_athlete_nombre_prefill');
        return name;
    }
    return null;
}

function getPrefilledRoom() {
    var room = localStorage.getItem('magical_athlete_sala_prefill');
    if (room && room.length === 4) {
        localStorage.removeItem('magical_athlete_sala_prefill');
        return room;
    }
    return null;
}

function saveSession() {
    if (!currentRoom) return;
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            roomCode: currentRoom,
            myId: myId,
            myName: myName,
            misSelecciones: misSelecciones,
            cartas: cartas,
            gameStarted: gameStarted,
            puntosPorJugador: puntosPorJugador,
            estadoRonda: estadoRonda,
            cartaActivaId: cartaActivaId,
            playersData: playersData,
            tandaActual: tandaActual,
            cicloTandaInicio: cicloTandaInicio,
            mazoRestante: mazoRestante,
            copiasVisuales: copiasVisuales,
            gruposExpansion31: gruposExpansion31,
            cartaTwistActual: cartaTwistActual || null,
            hostId: hostId || null,
            updatedAt: Date.now()
        }));
    } catch (e) {
        console.error('No se pudo guardar la sesion', e);
    }
}

function loadSession() {
    try {
        var raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
            var data = JSON.parse(raw);
            puntosPorJugador = data.puntosPorJugador || {};
            estadoRonda = data.estadoRonda || { usado3: false, usado2: false, ganadorCartaId: null, jugadorGanador: null };
            cartaActivaId = data.cartaActivaId || null;
            tandaActual = data.tandaActual !== undefined ? data.tandaActual : -1;
            cicloTandaInicio = data.cicloTandaInicio !== undefined ? data.cicloTandaInicio : 0;
            mazoRestante = data.mazoRestante || [];
            copiasVisuales = data.copiasVisuales || {};
            gruposExpansion31 = data.gruposExpansion31 || {};
            cartaTwistActual = data.cartaTwistActual || null;
            hostId = data.hostId || null;
            if (data.playersData) {
                playersData = data.playersData;
                var seenNames = {};
                var toRemove = [];
                for (var id in playersData) {
                    var name = playersData[id].name;
                    if (seenNames[name] !== undefined) {
                        toRemove.push(id);
                    } else {
                        seenNames[name] = id;
                    }
                    // El estado "desconectado" es transitorio de la conexion en
                    // vivo (se detecta con el testamento MQTT y se confirma con
                    // cualquier mensaje que llegue). No debe arrastrarse desde
                    // una sesion vieja guardada en localStorage: asumimos que
                    // todos estan en linea hasta que la red diga lo contrario,
                    // para no mostrar un "Desconectado" fantasma al recargar.
                    if (playersData[id]) {
                        playersData[id].offline = false;
                    }
                }
                for (var i = 0; i < toRemove.length; i++) {
                    delete playersData[toRemove[i]];
                }
            }
            return data;
        }
        return null;
    } catch (e) {
        return null;
    }
}

function clearSession() {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
}

function clearRoomData(room) {
    try {
        var registry = loadRegistry();
        var keysToRemove = [];
        for (var key in registry) {
            if (key.startsWith(room + '::')) {
                keysToRemove.push(key);
            }
        }
        for (var i = 0; i < keysToRemove.length; i++) {
            delete registry[keysToRemove[i]];
        }
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
        console.error('No se pudo limpiar los datos de la sala', e);
    }
}

function registryKey(room, name) {
    return room + '::' + name;
}

function loadRegistry() {
    try {
        var raw = localStorage.getItem(REGISTRY_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveRegistryEntry(room, name, id, selecciones) {
    try {
        var registry = loadRegistry();
        registry[registryKey(room, name)] = {
            id: id,
            selecciones: selecciones,
            updatedAt: Date.now()
        };
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
        console.error('No se pudo guardar el registro de jugador', e);
    }
}

function getRegistryEntry(room, name) {
    var registry = loadRegistry();
    return registry[registryKey(room, name)] || null;
}

function reconnectToSession() {
    var session = loadSession();
    if (!session) {
        showNotice('No hay sesion guardada para reconectar.');
        return;
    }
    document.getElementById('lobbyModal').style.display = 'none';
    myId = session.myId;
    myName = session.myName;
    misSelecciones = session.misSelecciones || [];
    cartas = session.cartas || [];
    gameStarted = session.gameStarted || false;
    puntosPorJugador = session.puntosPorJugador || {};
    estadoRonda = session.estadoRonda || { usado3: false, usado2: false, ganadorCartaId: null, jugadorGanador: null };
    cartaActivaId = session.cartaActivaId || null;
    tandaActual = session.tandaActual !== undefined ? session.tandaActual : -1;
    cicloTandaInicio = session.cicloTandaInicio !== undefined ? session.cicloTandaInicio : 0;
    mazoRestante = session.mazoRestante || [];
    copiasVisuales = session.copiasVisuales || {};
    gruposExpansion31 = session.gruposExpansion31 || {};
    cartaTwistActual = session.cartaTwistActual || null;
    hostId = session.hostId || null;
    if (session.playersData) {
        playersData = session.playersData;
    }
    renderizarCartas();
    renderizarMisCorredores();
    actualizarUI();
    connectToRoom(session.roomCode, true);
}

function dismissSession() {
    var session = loadSession();
    if (session && session.roomCode) {
        clearRoomData(session.roomCode);
    }
    clearSession();
    var banner = document.getElementById('sessionBanner');
    if (banner) banner.style.display = 'none';
    var reconnectBtn = document.getElementById('reconnectBtn');
    if (reconnectBtn) {
        reconnectBtn.disabled = true;
        reconnectBtn.style.opacity = '0.5';
        reconnectBtn.style.cursor = 'not-allowed';
    }
}