// sesion.js - EcoTrole
var SESSION_KEY = 'ecotrole_session_v1';
var REGISTRY_KEY = 'ecotrole_players_v1';

(function detectarYGuardarParamsURL() {
    var urlParams = new URLSearchParams(window.location.search);
    var nombre = urlParams.get('nombre');
    var sala = urlParams.get('sala');
    console.log('EcoTrole - Parametros URL:', { nombre: nombre, sala: sala });
    if (nombre) {
        localStorage.setItem('ecotrole_nombre_prefill', nombre);
    }
    if (sala && sala.length >= 4) {
        localStorage.setItem('ecotrole_sala_prefill', sala.toUpperCase());
    }
})();

function getPrefilledName() {
    var name = localStorage.getItem('ecotrole_nombre_prefill');
    if (name) {
        localStorage.removeItem('ecotrole_nombre_prefill');
        return name;
    }
    return null;
}

function getPrefilledRoom() {
    var room = localStorage.getItem('ecotrole_sala_prefill');
    if (room && room.length === 4) {
        localStorage.removeItem('ecotrole_sala_prefill');
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
            misCartas: misCartas || [],
            juegoIniciado: juegoIniciado || false,
            rolesAsignados: rolesAsignados || false,
            miRol: miRol || null,
            miHabilidad: miHabilidad || null,
            playersData: playersData,
            mazoObjetosRestantes: mazoObjetosRestantes || [],
            objetosRestantes: objetosRestantes || 0,
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
            juegoIniciado = data.juegoIniciado || false;
            rolesAsignados = data.rolesAsignados || false;
            miRol = data.miRol || null;
            miHabilidad = data.miHabilidad || null;
            mazoObjetosRestantes = data.mazoObjetosRestantes || [];
            objetosRestantes = data.objetosRestantes || 0;
            hostId = data.hostId || null;
            if (data.playersData) {
                playersData = data.playersData;
                for (var id in playersData) {
                    if (playersData[id]) {
                        playersData[id].offline = false;
                    }
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
    misCartas = session.misCartas || [];
    juegoIniciado = session.juegoIniciado || false;
    rolesAsignados = session.rolesAsignados || false;
    miRol = session.miRol || null;
    miHabilidad = session.miHabilidad || null;
    mazoObjetosRestantes = session.mazoObjetosRestantes || [];
    objetosRestantes = session.objetosRestantes || 0;
    hostId = session.hostId || null;
    if (session.playersData) {
        playersData = session.playersData;
    }
    renderizarMisCartas();
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

window.SESSION_KEY = SESSION_KEY;
window.REGISTRY_KEY = REGISTRY_KEY;
window.saveSession = saveSession;
window.loadSession = loadSession;
window.clearSession = clearSession;
window.reconnectToSession = reconnectToSession;
window.dismissSession = dismissSession;
window.getRegistryEntry = getRegistryEntry;