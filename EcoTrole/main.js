// main.js - EcoTrole
document.addEventListener('DOMContentLoaded', function() {
    mostrarDatosURL();
    var session = loadSession();
    var banner = document.getElementById('sessionBanner');
    var reconnectBtn = document.getElementById('reconnectBtn');
    if (session && banner) {
        document.getElementById('sessionBannerText').textContent =
            'Tenías una partida abierta en la sala ' + session.roomCode + ' como "' + session.myName + '".';
        banner.style.display = 'block';
        if (reconnectBtn) {
            reconnectBtn.disabled = false;
            reconnectBtn.style.opacity = '1';
            reconnectBtn.style.cursor = 'pointer';
        }
    } else {
        if (reconnectBtn) {
            reconnectBtn.disabled = true;
            reconnectBtn.style.opacity = '0.5';
            reconnectBtn.style.cursor = 'not-allowed';
        }
    }
    renderizarMisCartas();
    actualizarUI();
});

function mostrarDatosURL() {
    var nombre = localStorage.getItem('ecotrole_nombre_prefill');
    var sala = localStorage.getItem('ecotrole_sala_prefill');
    if (nombre || sala) {
        var display = document.getElementById('urlDataDisplay');
        if (display) {
            display.style.display = 'block';
            document.getElementById('urlPlayerName').textContent = nombre || '---';
            document.getElementById('urlRoomCode').textContent = sala || '---';
            console.log('Datos configurados:', { nombre: nombre, sala: sala });
        }
    }
}

function entrarSala() {
    var nombre = localStorage.getItem('ecotrole_nombre_prefill');
    var sala = localStorage.getItem('ecotrole_sala_prefill');
    if (!nombre) {
        showNotice('No se ha configurado un nombre. Usa ?nombre=XXX en la URL.');
        return;
    }
    if (!sala || sala.length !== 4) {
        showNotice('No se ha configurado una sala valida. Usa ?sala=XXXX en la URL.');
        return;
    }
    sala = sala.toUpperCase();
    
    playersData = {};
    juegoIniciado = false;
    rolesAsignados = false;
    miRol = null;
    miHabilidad = null;
    misCartas = [];
    mazoAccionesRestantes = [];
    accionesRestantes = 0;
    hostId = null;
    
    var session = loadSession();
    if (session && session.roomCode === sala && session.myName === nombre) {
        myId = session.myId;
        myName = session.myName;
        misCartas = session.misCartas || [];
        juegoIniciado = session.juegoIniciado || false;
        rolesAsignados = session.rolesAsignados || false;
        miRol = session.miRol || null;
        miHabilidad = session.miHabilidad || null;
    misItems = session.misItems || [];
        mazoAccionesRestantes = session.mazoAccionesRestantes || [];
        accionesRestantes = session.accionesRestantes || 0;
        hostId = session.hostId || null;
        if (session.playersData) {
            playersData = session.playersData;
        }
        localStorage.removeItem('ecotrole_nombre_prefill');
        localStorage.removeItem('ecotrole_sala_prefill');
        renderizarMisCartas();
        actualizarUI();
        renderLeaderboard();
        connectToRoom(sala, true);
        return;
    }
    
    myName = nombre;
    myId = Math.random().toString(36).substr(2, 9);
    localStorage.removeItem('ecotrole_nombre_prefill');
    localStorage.removeItem('ecotrole_sala_prefill');
    renderizarMisCartas();
    actualizarUI();
    renderLeaderboard();
    connectToRoom(sala, false);
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
    misItems = session.misItems || [];
    mazoAccionesRestantes = session.mazoAccionesRestantes || [];
    accionesRestantes = session.accionesRestantes || 0;
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

window.entrarSala = entrarSala;
window.reconnectToSession = reconnectToSession;
window.dismissSession = dismissSession;