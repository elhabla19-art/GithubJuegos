// modales.js - EcoTrole
var pendingRemoveId = null;
var pendingClaim = null;

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

function showClaimModal(claim) {
    var modal = document.getElementById('claimModal');
    var text = document.getElementById('claimText');
    if (text) {
        text.textContent = 'Ya hay un jugador "' + claim.name + '" en la sala. Eres tu (te desconectaste antes)?';
    }
    if (modal) modal.style.display = 'flex';
}

function acceptClaim() {
    if (!pendingClaim) return;
    var staleTempId = myId;

    broadcastRemove(staleTempId);

    delete playersData[staleTempId];
    forgetJoiningId(staleTempId);

    myId = pendingClaim.oldId;
    misCartas = pendingClaim.cartas || [];
    miRol = pendingClaim.rol || null;
    miHabilidad = pendingClaim.habilidad || null;
    misItems = pendingClaim.items || [];

    if (!playersData[myId]) {
        playersData[myId] = { name: myName, rol: null, habilidad: null, items: [], acciones: [], estadoJuego: null };
    }
    playersData[myId].name = myName;
    playersData[myId].rol = pendingClaim.rol || null;
    playersData[myId].habilidad = pendingClaim.habilidad || null;
    playersData[myId].items = pendingClaim.items || [];
    playersData[myId].acciones = pendingClaim.acciones || [];
    playersData[myId].estadoJuego = pendingClaim.estadoJuego || null;

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
        mqttClient.publish('ecotrole/room/' + currentRoom, JSON.stringify({ action: 'claim_declined', id: myId }));
    }
}

function resetGlobalGame() {
    if (!currentRoom) {
        resetLocalGame();
        return;
    }
    if (hostId !== myId) {
        if (!hostId) {
            showNotice('Todavia no hay un anfitrion asignado en la sala. Espera un momento e intenta de nuevo.');
        } else {
            showNotice('Solo el anfitrion de la sala puede reiniciar la partida.');
        }
        return;
    }
    var modal = document.getElementById('resetGameModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeResetGameModal() {
    var modal = document.getElementById('resetGameModal');
    if (modal) modal.style.display = 'none';
}

function confirmResetGlobalGame() {
    closeResetGameModal();
    if (hostId !== myId) return;
    broadcastReset();
    resetLocalGame();
    broadcastState('sync');
}

function solicitarEliminarJugador(id) {
    if (hostId !== myId) {
        showNotice('Solo el anfitrion puede eliminar jugadores.');
        return;
    }
    if (id === myId) return;
    if (!playersData[id]) return;
    pendingRemoveId = id;
    var nombre = playersData[id].name || 'este jugador';
    var textEl = document.getElementById('removePlayerText');
    if (textEl) {
        textEl.textContent = 'Eliminar a "' + nombre + '" de la sala?';
    }
    var modal = document.getElementById('removePlayerModal');
    if (modal) {
        modal.style.display = 'flex';
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
    if (!id) return;
    if (hostId !== myId) return;
    if (!playersData[id]) return;

    delete playersData[id];
    broadcastRemove(id);
    broadcastState('sync');

    renderLeaderboard();
    actualizarUI();
    saveSession();
}

// --- MODAL DE DECISION (SOLO ANFITRION): Meta / Expulsar ---
// La logica de que hace cada decision (conversion de rol, condiciones de
// victoria, etc.) vive en roles.js; aqui solo se arma/actualiza la lista.

function abrirDecisionModal() {
    if (hostId !== myId) {
        showNotice('Solo el anfitrion puede tomar decisiones sobre los jugadores.');
        return;
    }
    if (!rolesAsignados) {
        showNotice('Todavia no se han repartido los roles.');
        return;
    }
    var modal = document.getElementById('decisionModal');
    if (modal) modal.style.display = 'flex';
    renderizarDecisionModal();
}

function closeDecisionModal() {
    var modal = document.getElementById('decisionModal');
    if (modal) modal.style.display = 'none';
}

function renderizarDecisionModal() {
    var modal = document.getElementById('decisionModal');
    if (!modal || modal.style.display !== 'flex') return; // solo refrescar si esta abierto

    var list = document.getElementById('decisionPlayersList');
    if (!list) return;
    list.innerHTML = '';

    var ids = Object.keys(playersData);
    var idsConRol = ids.filter(function(id) { return !!playersData[id].rol; });

    if (idsConRol.length === 0) {
        list.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 10px;">Aun no hay jugadores con rol asignado.</div>';
        return;
    }

    idsConRol.sort(function(a, b) {
        return (playersData[a].name || '').localeCompare(playersData[b].name || '');
    });

    for (var i = 0; i < idsConRol.length; i++) {
        var id = idsConRol[i];
        var p = playersData[id];

        var row = document.createElement('div');
        row.className = 'decision-row';

        var nombreSpan = document.createElement('span');
        nombreSpan.className = 'decision-name';
        nombreSpan.textContent = p.name + (id === myId ? ' (Tu)' : '');
        row.appendChild(nombreSpan);

        var accionesDiv = document.createElement('div');
        accionesDiv.className = 'decision-actions';

        var resuelto = p.estadoJuego && p.estadoJuego !== ESTADO_JUGADOR.ACTIVO;

        if (resuelto) {
            var nombreRol = (ROLES_INFO[p.rol] && ROLES_INFO[p.rol].nombre) || p.rol;
            var estadoSpan = document.createElement('span');
            estadoSpan.className = 'decision-estado-tag ' + p.estadoJuego;
            estadoSpan.textContent = (p.estadoJuego === ESTADO_JUGADOR.META ? 'En la Meta' : 'Expulsado') +
                ' (' + nombreRol + ')';
            accionesDiv.appendChild(estadoSpan);
        } else {
            var metaBtn = document.createElement('button');
            metaBtn.type = 'button';
            metaBtn.className = 'modal-btn btn-primary decision-btn';
            metaBtn.textContent = 'Meta';
            metaBtn.addEventListener('click', function(pid) {
                return function(e) {
                    e.stopPropagation();
                    decisionMeta(pid);
                };
            }(id));
            accionesDiv.appendChild(metaBtn);

            if (p.rol !== ROLES.ESTORBO) {
                var expulsarBtn = document.createElement('button');
                expulsarBtn.type = 'button';
                expulsarBtn.className = 'modal-btn btn-danger decision-btn';
                expulsarBtn.textContent = 'Expulsar';
                expulsarBtn.addEventListener('click', function(pid) {
                    return function(e) {
                        e.stopPropagation();
                        decisionExpulsar(pid);
                    };
                }(id));
                accionesDiv.appendChild(expulsarBtn);
            }
        }

        row.appendChild(accionesDiv);
        list.appendChild(row);
    }
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
window.abrirDecisionModal = abrirDecisionModal;
window.closeDecisionModal = closeDecisionModal;
window.renderizarDecisionModal = renderizarDecisionModal;