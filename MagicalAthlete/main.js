// main.js (sin cambios)
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
    renderizarCartas();
    renderizarMisCorredores();
    actualizarUI();
});

function mostrarDatosURL() {
    var nombre = localStorage.getItem('magical_athlete_nombre_prefill');
    var sala = localStorage.getItem('magical_athlete_sala_prefill');
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
    var nombre = localStorage.getItem('magical_athlete_nombre_prefill');
    var sala = localStorage.getItem('magical_athlete_sala_prefill');
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
    gameStarted = false;
    gameInitiator = null;
    hostId = null;
    
    var session = loadSession();
    if (session && session.roomCode === sala && session.myName === nombre) {
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
        hostId = session.hostId || null;
        if (session.playersData) {
            playersData = session.playersData;
        }
        localStorage.removeItem('magical_athlete_nombre_prefill');
        localStorage.removeItem('magical_athlete_sala_prefill');
        renderizarCartas();
        renderizarMisCorredores();
        actualizarUI();
        renderLeaderboard();
        connectToRoom(sala, true);
        return;
    }
    
    myName = nombre;
    myId = Math.random().toString(36).substr(2, 9);
    localStorage.removeItem('magical_athlete_nombre_prefill');
    localStorage.removeItem('magical_athlete_sala_prefill');
    renderizarCartas();
    renderizarMisCorredores();
    actualizarUI();
    renderLeaderboard();
    connectToRoom(sala, false);
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

window.entrarSala = entrarSala;
window.reconnectToSession = reconnectToSession;
window.dismissSession = dismissSession;
window.acceptClaim = acceptClaim;
window.declineClaim = declineClaim;
window.iniciarJuego = iniciarJuego;
window.resetGlobalGame = resetGlobalGame;
window.mostrarGanadores = mostrarGanadores;
window.resetRound = resetRound;