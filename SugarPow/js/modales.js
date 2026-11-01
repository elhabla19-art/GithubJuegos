// modales.js
// ===== TODAS LAS FUNCIONES DE MODALES =====
// Este archivo contiene TODAS las funciones que manejan la interfaz de modales
// (abrir, cerrar, mostrar/ocultar), EXCEPTO las de zoom (que estan en zoom.js).

// ===== VARIABLES GLOBALES DE MODALES =====
var pendingRemoveId = null;   // ID del jugador a eliminar (modal de eliminar)
var pendingClaim = null;     // Datos del jugador en reclamo (modal de reclamo)

// ===== 1. MODALES GENERICOS (sistema) =====
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
        text.textContent = 'Ya hay un jugador "' + claim.name + '" en la sala con ' + 
                          (claim.selecciones ? claim.selecciones.length : 0) + 
                          ' cartas seleccionadas y ' + (claim.puntos || 0) +
                          ' puntos. Eres tu (te desconectaste antes)?';
    }
    if (modal) modal.style.display = 'flex';
}

function acceptClaim() {
    if (!pendingClaim) return;
    var staleTempId = myId;

    broadcastRemove(staleTempId);

    delete playersData[staleTempId];
    delete puntosPorJugador[staleTempId];
    forgetJoiningId(staleTempId);

    myId = pendingClaim.oldId;
    misSelecciones = pendingClaim.selecciones.slice();

    if (!puntosPorJugador[myId] || puntosPorJugador[myId] < (pendingClaim.puntos || 0)) {
        puntosPorJugador[myId] = pendingClaim.puntos || 0;
    }

    if (!playersData[myId]) {
        playersData[myId] = { name: myName, selecciones: [], cartasGanadoras: [], activeCardId: null };
    }
    playersData[myId].name = myName;
    playersData[myId].selecciones = misSelecciones.slice();
    playersData[myId].cartasGanadoras = (pendingClaim.cartasGanadoras || []).slice();

    if (cartas.length > 0) {
        for (var i = 0; i < cartas.length; i++) {
            if (cartas[i].seleccionadoPorId === myId) {
                cartas[i].seleccionadoPor = myName;
                cartas[i].seleccionadoPorId = myId;
            }
        }
        renderizarCartas();
        renderizarMisCorredores();
    }

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
        mqttClient.publish('sugarpow/room/' + currentRoom, JSON.stringify({ action: 'claim_declined', id: myId }));
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
    } else {
        console.error('resetGameModal no encontrado en el HTML.');
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
    broadcastReset();
    resetLocalGame();
    broadcastState('sync');
}

// 3b. Eliminar jugador
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
        textEl.textContent = 'Eliminar a "' + nombre + '" de la sala? Sus cartas ya elegidas quedan como registro, pero no podra seguir jugando salvo que vuelva a entrar.';
    }
    var modal = document.getElementById('removePlayerModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        pendingRemoveId = null;
        console.error('removePlayerModal no encontrado en el HTML.');
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
    if (!id) return;
    if (hostId !== myId) return;
    if (!playersData[id]) return;

    var activeCardDelEliminado = playersData[id].activeCardId || null;
    if (activeCardDelEliminado) {
        for (var ci = 0; ci < cartas.length; ci++) {
            if (cartas[ci].id === activeCardDelEliminado && !cartas[ci].descartada) {
                cartas[ci].descartada = true;
            }
        }
    }

    var removedSnapshot = {
        name: playersData[id].name,
        selecciones: (playersData[id].selecciones || []).slice(),
        cartasGanadoras: (playersData[id].cartasGanadoras || []).slice(),
        puntos: puntosPorJugador[id] || 0
    };
    removedPlayersRegistry[removedSnapshot.name] = {
        oldId: id,
        selecciones: removedSnapshot.selecciones,
        cartasGanadoras: removedSnapshot.cartasGanadoras,
        puntos: removedSnapshot.puntos
    };

    delete playersData[id];
    delete puntosPorJugador[id];
    broadcastRemove(id, removedSnapshot);
    broadcastState('sync');

    renderLeaderboard();
    actualizarUI();
    saveSession();
}

// ===== 4. MODALES DE JUEGO =====

// 3c. Eliminar carta (solo anfitrion): registrar quien elimino a quien
var elimVictimaId = null;   // id del jugador cuya carta en uso fue eliminada
var elimKillerId = null;    // id del jugador que dio el ultimo golpe

function cartaEnUsoDe(pid) {
    var d = playersData[pid];
    if (!d || !d.activeCardId) return null;
    var c = buscarCartaPorId(d.activeCardId);
    return (c && !c.descartada) ? c : null;
}

function abrirEliminarModal() {
    if (hostId !== myId) {
        showNotice(hostId ? 'Solo el anfitrion de la sala puede eliminar cartas.' : 'Todavia no hay un anfitrion asignado en la sala. Espera un momento e intenta de nuevo.');
        return;
    }
    var modal = document.getElementById('eliminarModal');
    if (!modal) {
        showNotice('No se pudo abrir el dialogo de eliminar carta.');
        return;
    }
    elimVictimaId = null;
    elimKillerId = null;
    renderEliminarModal();
    modal.style.display = 'flex';
}

function cerrarEliminarModal() {
    var modal = document.getElementById('eliminarModal');
    if (modal) modal.style.display = 'none';
    elimVictimaId = null;
    elimKillerId = null;
}

function renderEliminarModal() {
    var cVic = document.getElementById('elimVictimas');
    var cKil = document.getElementById('elimKillers');
    var resumen = document.getElementById('elimResumen');
    var btn = document.getElementById('elimConfirmBtn');
    if (!cVic || !cKil) return;
    cVic.innerHTML = '';
    cKil.innerHTML = '';

    var ids = Object.keys(playersData).filter(function(id) {
        return !(typeof isJoiningHidden === 'function' && isJoiningHidden(id));
    });

    var hayVictimas = false;
    ids.forEach(function(pid) {
        var carta = cartaEnUsoDe(pid);
        if (!carta) return;
        hayVictimas = true;
        var op = document.createElement('button');
        op.type = 'button';
        op.className = 'elim-opcion' + (elimVictimaId === pid ? ' seleccionada' : '');
        var img = document.createElement('img');
        img.src = carta.imagen;
        img.alt = getEtiquetaCarta(carta.numero);
        op.appendChild(img);
        var txt = document.createElement('span');
        txt.textContent = playersData[pid].name + ' \u2014 ' + getEtiquetaCarta(carta.numero) +
            ' (' + getPuntosCarta(carta.numero) + ' pts)';
        op.appendChild(txt);
        op.addEventListener('click', function() {
            elimVictimaId = pid;
            if (elimKillerId === pid) elimKillerId = null;
            renderEliminarModal();
        });
        cVic.appendChild(op);
    });
    if (!hayVictimas) {
        var vacio = document.createElement('div');
        vacio.className = 'empty-message';
        vacio.textContent = 'Ningun jugador tiene una carta en uso.';
        cVic.appendChild(vacio);
    }

    ids.forEach(function(pid) {
        if (pid === elimVictimaId) return;
        var op = document.createElement('button');
        op.type = 'button';
        op.className = 'elim-opcion elim-jugador' + (elimKillerId === pid ? ' seleccionada' : '');
        op.textContent = playersData[pid].name;
        op.addEventListener('click', function() {
            elimKillerId = pid;
            renderEliminarModal();
        });
        cKil.appendChild(op);
    });

    var listo = !!(elimVictimaId && elimKillerId && cartaEnUsoDe(elimVictimaId) && playersData[elimKillerId]);
    if (btn) btn.disabled = !listo;
    if (resumen) {
        if (listo) {
            var cr = cartaEnUsoDe(elimVictimaId);
            resumen.textContent = playersData[elimKillerId].name + ' elimina la carta ' + getEtiquetaCarta(cr.numero) +
                ' de ' + playersData[elimVictimaId].name + ' y gana ' + getPuntosCarta(cr.numero) + ' puntos.';
        } else {
            resumen.textContent = 'Elige la carta eliminada y quien la elimino.';
        }
    }
}

function confirmarEliminacion() {
    if (hostId !== myId) return;
    var carta = elimVictimaId ? cartaEnUsoDe(elimVictimaId) : null;
    if (!carta || !elimKillerId || !playersData[elimKillerId]) {
        showNotice('Faltan datos para registrar la eliminacion.');
        return;
    }
    var killerId = elimKillerId;
    var killerName = playersData[killerId].name;
    aplicarEliminacion(carta.id, killerId, killerName);
    broadcastEliminar(carta.id, killerId, killerName);
    recalcularPuntos();
    cerrarEliminarModal();
    renderizarMisCorredores();
    renderLeaderboard();
    actualizarUI();
    saveSession();
    broadcastState('sync');
}

// 4. Cartas eliminadas (quien dio el ultimo golpe y cuantos puntos gano)
function mostrarEliminadas() {
    var eliminadas = cartas.filter(function(c) { return !!c.eliminadaPorId; });
    if (eliminadas.length === 0) {
        showNotice('No hay cartas eliminadas aun.');
        return;
    }
    var modal = document.getElementById('ganadoresModal');
    var content = document.getElementById('ganadoresContent');
    if (!modal || !content) {
        showNotice('No se pudo abrir la lista de cartas eliminadas.');
        return;
    }
    content.innerHTML = '';
    var title = document.createElement('h3');
    title.textContent = 'Cartas Eliminadas';
    title.style.color = 'var(--text-main)';
    title.style.marginBottom = '15px';
    content.appendChild(title);

    for (var i = 0; i < eliminadas.length; i++) {
        var c = eliminadas[i];
        var fila = document.createElement('div');
        fila.style.display = 'flex';
        fila.style.alignItems = 'center';
        fila.style.gap = '10px';
        fila.style.marginBottom = '10px';
        fila.style.background = '#2a2a4a';
        fila.style.padding = '8px';
        fila.style.borderRadius = '8px';
        fila.style.width = '100%';
        var img = document.createElement('img');
        img.src = c.imagen;
        img.alt = getEtiquetaCarta(c.numero);
        img.style.width = '60px';
        img.style.height = '80px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '4px';
        fila.appendChild(img);
        var info = document.createElement('div');
        info.style.display = 'flex';
        info.style.flexDirection = 'column';
        info.style.alignItems = 'flex-start';
        var numSpan = document.createElement('span');
        numSpan.textContent = getEtiquetaCarta(c.numero);
        numSpan.style.fontWeight = 'bold';
        info.appendChild(numSpan);
        var lineas = [
            'Dueno: ' + (c.seleccionadoPor || 'Desconocido'),
            'Eliminada por: ' + (c.eliminadaPor || 'Desconocido') + ' (+' + getPuntosCarta(c.numero) + ' pts)'
        ];
        for (var l = 0; l < lineas.length; l++) {
            var sp = document.createElement('span');
            sp.textContent = lineas[l];
            sp.style.color = 'var(--text-muted)';
            sp.style.fontSize = '0.8rem';
            info.appendChild(sp);
        }
        fila.appendChild(info);
        content.appendChild(fila);
    }
    modal.style.display = 'flex';
}

// Exponer funciones globalmente
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
window.mostrarEliminadas = mostrarEliminadas;
window.abrirEliminarModal = abrirEliminarModal;
window.cerrarEliminarModal = cerrarEliminarModal;
window.confirmarEliminacion = confirmarEliminacion;