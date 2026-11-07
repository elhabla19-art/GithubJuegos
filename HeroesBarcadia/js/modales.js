// modales.js
// ===== TODAS LAS FUNCIONES DE MODALES =====
// (abrir, cerrar, mostrar/ocultar), EXCEPTO las de zoom (en zoom.js).

var pendingRemoveId = null;   // ID del jugador a eliminar
var pendingClaim = null;      // Datos del jugador en reclamo

// ===== 1. MODALES GENERICOS =====
function showLoading(text) {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingModal').style.display = 'flex';
}
function hideLoading() {
    document.getElementById('loadingModal').style.display = 'none';
}
function showNotice(text, title) {
    if (title === undefined) title = 'Aviso';
    var titleEl = document.getElementById('noticeTitle');
    var textEl = document.getElementById('noticeText');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    var modal = document.getElementById('noticeModal');
    if (modal) modal.style.display = 'flex';
}
function closeNotice() {
    var modal = document.getElementById('noticeModal');
    if (modal) modal.style.display = 'none';
}

// ===== 2. MODAL DE RECLAMO (nombre duplicado) =====
function showClaimModal(claim) {
    var modal = document.getElementById('claimModal');
    var text = document.getElementById('claimText');
    if (text) {
        var j = partida.jugadores[claim.oldId];
        text.textContent = 'Ya hay un jugador "' + claim.name + '" en la sala' +
            (j ? ' con el ' + getNombreHeroe(j.heroe) : '') + '. Eres tu (te desconectaste antes)?';
    }
    if (modal) modal.style.display = 'flex';
}

function acceptClaim() {
    if (!pendingClaim) return;
    var staleTempId = myId;

    broadcastRemove(staleTempId);
    delete playersData[staleTempId];
    forgetJoiningId(staleTempId);

    // Asumo la identidad anterior: el heroe y la posicion ya viven en
    // partida.jugadores bajo ese id, asi que no hay nada que copiar.
    myId = pendingClaim.oldId;
    if (!playersData[myId]) playersData[myId] = { name: myName, offline: false };
    playersData[myId].name = myName;
    playersData[myId].offline = false;

    document.getElementById('claimModal').style.display = 'none';
    pendingClaim = null;
    actualizarUI();
    saveSession();

    broadcastRequestState();
    broadcastState('sync');
}

function declineClaim() {
    pendingClaim = null;
    document.getElementById('claimModal').style.display = 'none';
    revealJoiningId(myId);
    if (mqttClient && currentRoom) {
        mqttClient.publish('heroesbarcadia/room/' + currentRoom, JSON.stringify({ action: 'claim_declined', id: myId }));
    }
}

// ===== 3. MODALES DEL ANFITRION =====

// 3a. Reiniciar partida
function resetGlobalGame() {
    if (!currentRoom) {
        resetLocalGame();
        return;
    }
    if (hostId !== myId) {
        showNotice(hostId ? 'Solo el anfitrion de la sala puede reiniciar la partida.' : 'Todavia no hay un anfitrion asignado en la sala. Espera un momento e intenta de nuevo.');
        return;
    }
    var modal = document.getElementById('resetGameModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        showNotice('No se pudo abrir el dialogo de reinicio. Recarga la pagina e intenta de nuevo.');
    }
}

function closeResetGameModal() {
    var modal = document.getElementById('resetGameModal');
    if (modal) modal.style.display = 'none';
}

function confirmResetGlobalGame() {
    closeResetGameModal();
    if (hostId !== myId) return;
    var v = siguienteVersion();
    resetLocalGame(v);
    broadcastReset(v);
    broadcastState('sync');
}

// 3b. Eliminar jugador
function solicitarEliminarJugador(id) {
    if (hostId !== myId) {
        showNotice('Solo el anfitrion puede eliminar jugadores.');
        return;
    }
    if (id === myId || !playersData[id]) return;
    pendingRemoveId = id;
    var nombre = playersData[id].name || 'este jugador';
    var textEl = document.getElementById('removePlayerText');
    if (textEl) {
        textEl.textContent = 'Eliminar a "' + nombre + '" de la sala? Su heroe saldra del tablero y no podra seguir jugando salvo que vuelva a entrar.';
    }
    var modal = document.getElementById('removePlayerModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        pendingRemoveId = null;
        showNotice('No se pudo abrir el dialogo de eliminar jugador. Recarga la pagina e intenta de nuevo.');
    }
}

function closeRemovePlayerModal() {
    pendingRemoveId = null;
    var modal = document.getElementById('removePlayerModal');
    if (modal) modal.style.display = 'none';
}

function confirmRemovePlayer() {
    var id = pendingRemoveId;
    closeRemovePlayerModal();
    if (!id || hostId !== myId || !playersData[id]) return;

    quitarJugadorDeJuego(id);
    partida.version = siguienteVersion();
    delete playersData[id];
    forgetJoiningId(id);
    broadcastRemove(id);
    broadcastState('sync');

    actualizarUI();
    saveSession();
}

window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showNotice = showNotice;
window.closeNotice = closeNotice;
window.showClaimModal = showClaimModal;
window.acceptClaim = acceptClaim;
window.declineClaim = declineClaim;
window.resetGlobalGame = resetGlobalGame;
window.closeResetGameModal = closeResetGameModal;
window.confirmResetGlobalGame = confirmResetGlobalGame;
window.solicitarEliminarJugador = solicitarEliminarJugador;
window.closeRemovePlayerModal = closeRemovePlayerModal;
window.confirmRemovePlayer = confirmRemovePlayer;
