// ===== PERSISTENCIA (RECONEXION MISMO DISPOSITIVO) =====
const SESSION_KEY = 'farkle_session_v1';
const REGISTRY_KEY = 'farkle_players_v1';

// ===== DETECCION DE PARAMETROS URL (LINKS DE INVITACION) =====
(function detectarYGuardarParamsURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const nombre = urlParams.get('nombre');
    const sala = urlParams.get('sala');

    if (nombre) {
        localStorage.setItem('farkle_nombre_prefill', nombre);
    }
    if (sala && sala.length >= 4) {
        localStorage.setItem('farkle_sala_prefill', sala.toUpperCase());
    }
})();

function getPrefilledName() {
    const name = localStorage.getItem('farkle_nombre_prefill');
    if (name) {
        localStorage.removeItem('farkle_nombre_prefill');
        return name;
    }
    return null;
}

function getPrefilledRoom() {
    const room = localStorage.getItem('farkle_sala_prefill');
    if (room && room.length === 4) {
        localStorage.removeItem('farkle_sala_prefill');
        return room;
    }
    return null;
}

function persistSession() {
    if (!currentRoom) return;
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            roomCode: currentRoom, myId, myName, state: myState,
            color: playerColors[myId] || null, updatedAt: Date.now()
        }));
    } catch (e) { console.error("No se pudo guardar la sesion", e); }
}
function loadSession() {
    try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

function registryKey(room, name) { return `${room}::${name}`; }
function loadRegistry() {
    try { const raw = localStorage.getItem(REGISTRY_KEY); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
}
function persistRegistry() {
    if (!currentRoom) return;
    try {
        const registry = loadRegistry();
        registry[registryKey(currentRoom, myName)] = { id: myId, state: myState, color: playerColors[myId] || null, updatedAt: Date.now() };
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) { console.error("No se pudo guardar el registro de jugador", e); }
}
function getRegistryEntry(room, name) {
    const registry = loadRegistry();
    return registry[registryKey(room, name)] || null;
}

function reconnectToSession() {
    const session = loadSession();
    if (!session) return;
    myId = session.myId;
    myName = session.myName;
    myState = { ...freshState(), ...(session.state || {}) };
    myTurn = freshTurn();
    isRoomCreator = false;
    // Restauramos el color que tenia antes de perder la conexion, para que al re-unirse
    // se anuncie con su color original en vez de sin color.
    if (session.color) playerColors[myId] = session.color;
    connectToRoom(session.roomCode, true);
}
function dismissSession() {
    clearSession();
    const banner = document.getElementById('sessionBanner');
    if (banner) banner.style.display = 'none';
}