// sesion.js
// ===== PERSISTENCIA DE SESION (RECONEXION) =====
var SESSION_KEY = 'heroesbarcadia_session_v1';
var REGISTRY_KEY = 'heroesbarcadia_players_v1';

// ===== DETECCION DE PARAMETROS URL =====
(function detectarYGuardarParamsURL() {
    var urlParams = new URLSearchParams(window.location.search);
    var nombre = urlParams.get('nombre');
    var sala = urlParams.get('sala');
    console.log('HeroesBarcadia - Parametros URL:', { nombre: nombre, sala: sala });
    if (nombre) localStorage.setItem('heroesbarcadia_nombre_prefill', nombre);
    if (sala && sala.length >= 4) localStorage.setItem('heroesbarcadia_sala_prefill', sala.toUpperCase());
})();

function saveSession() {
    if (!currentRoom) return;
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            roomCode: currentRoom,
            myId: myId,
            myName: myName,
            partida: partida,
            playersData: playersData,
            hostId: hostId || null,
            updatedAt: Date.now()
        }));
    } catch (e) {
        console.error('No se pudo guardar la sesion', e);
    }
}

// Solo lee y limpia: NO toca las variables globales (eso lo hacen
// entrarSala / reconnectToSession cuando de verdad se reconecta).
function loadSession() {
    try {
        var raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        var data = JSON.parse(raw);
        if (data.playersData) {
            var seenNames = {};
            var toRemove = [];
            for (var id in data.playersData) {
                var name = data.playersData[id].name;
                if (seenNames[name] !== undefined) toRemove.push(id);
                else seenNames[name] = id;
                // "Desconectado" es transitorio de la conexion en vivo: no se arrastra.
                data.playersData[id].offline = false;
            }
            toRemove.forEach(function(rid) { delete data.playersData[rid]; });
        }
        return data;
    } catch (e) {
        return null;
    }
}

function restaurarDesdeSesion(session) {
    myId = session.myId;
    myName = session.myName;
    hostId = session.hostId || null;
    playersData = session.playersData || {};
    aplicarPartida(session.partida && session.partida.hexes ? session.partida : nuevaPartidaVacia());
}

function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

function loadRegistry() {
    try {
        var raw = localStorage.getItem(REGISTRY_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function clearRoomData(room) {
    try {
        var registry = loadRegistry();
        for (var key in registry) {
            if (key.indexOf(room + '::') === 0) delete registry[key];
        }
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
        console.error('No se pudo limpiar los datos de la sala', e);
    }
}

function reconnectToSession() {
    var session = loadSession();
    if (!session) {
        showNotice('No hay sesion guardada para reconectar.');
        return;
    }
    document.getElementById('lobbyModal').style.display = 'none';
    restaurarDesdeSesion(session);
    actualizarUI();
    connectToRoom(session.roomCode, true);
}

function dismissSession() {
    var session = loadSession();
    if (session && session.roomCode) clearRoomData(session.roomCode);
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
