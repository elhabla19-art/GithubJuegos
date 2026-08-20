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
        mqttClient.publish('magical_athlete/room/' + currentRoom, JSON.stringify({ action: 'claim_declined', id: myId }));
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
        textEl.textContent = 'Eliminar a "' + nombre + '" de la sala? Sus corredores ya elegidos quedan como registro, pero no podra seguir jugando salvo que vuelva a entrar.';
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

// ===== 3c. Mazos (elegir que mazos participan al repartir corredores) =====
// La configuracion/logica de mazos (que mazos existen, cuales estan
// activos, a que numeros de carta corresponden) vive en mazos.js. Aqui solo
// se maneja la interfaz del modal.
function abrirMazosModal() {
    if (currentRoom && hostId !== myId) {
        if (!hostId) {
            showNotice('Todavia no hay un anfitrion asignado en la sala. Espera un momento e intenta de nuevo.');
        } else {
            showNotice('Solo el anfitrion de la sala puede elegir los mazos.');
        }
        return;
    }
    var modal = document.getElementById('mazosModal');
    var contenido = document.getElementById('mazosContenido');
    if (!modal || !contenido) {
        showNotice('No se pudo abrir la seleccion de mazos.');
        return;
    }
    if (typeof MAZOS_INFO === 'undefined' || typeof cargarMazosActivos !== 'function') {
        showNotice('No se pudo cargar la configuracion de mazos.');
        return;
    }
    var mazos = cargarMazosActivos();
    contenido.innerHTML = '';

    for (var i = 0; i < MAZOS_INFO.length; i++) {
        var info = MAZOS_INFO[i];
        var fila = document.createElement('label');
        fila.className = 'mazo-fila';

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'mazo-checkbox';
        checkbox.dataset.mazoKey = info.key;
        checkbox.checked = mazos[info.key] !== false;

        var texto = document.createElement('span');
        texto.textContent = info.label;

        fila.appendChild(checkbox);
        fila.appendChild(texto);
        contenido.appendChild(fila);
    }

    modal.style.display = 'flex';
}

function cerrarMazosModal() {
    var modal = document.getElementById('mazosModal');
    if (modal) modal.style.display = 'none';
}

function guardarMazosDesdeModal() {
    var contenido = document.getElementById('mazosContenido');
    if (!contenido) {
        cerrarMazosModal();
        return;
    }
    var checkboxes = contenido.querySelectorAll('.mazo-checkbox');
    var seleccionados = 0;
    var nuevo = {};
    for (var i = 0; i < checkboxes.length; i++) {
        var cb = checkboxes[i];
        var activo = !!cb.checked;
        nuevo[cb.dataset.mazoKey] = activo;
        if (activo) seleccionados++;
    }
    if (seleccionados === 0) {
        showNotice('Debes dejar al menos un mazo activo.');
        return;
    }
    if (typeof guardarMazosActivos === 'function') {
        guardarMazosActivos(nuevo);
    }
    cerrarMazosModal();
}

// ===== 4. MODALES DE JUEGO =====

// 4a. Intercambio (cartas 17 y 33, y expansion 31)
function mostrarModalSeleccion(cartasDisponibles, titulo, callback) {
    var modal = document.getElementById('intercambioModal');
    var contenido = document.getElementById('intercambioContenido');
    var tituloElem = document.getElementById('intercambioTitulo');
    if (!modal) {
        showNotice('Error: no se encontro el modal de intercambio.');
        return;
    }
    tituloElem.textContent = titulo || 'Selecciona una carta';
    contenido.innerHTML = '';

    cartasDisponibles.forEach(function(carta) {
        var div = document.createElement('div');
        div.className = 'carta-opcion';
        var img = document.createElement('img');
        img.src = carta.imagen;
        img.alt = '#' + carta.numero;
        img.loading = 'lazy';
        div.appendChild(img);
        var span = document.createElement('span');
        span.textContent = '#' + carta.numero;
        div.appendChild(span);

        div.addEventListener('click', function(e) {
            e.stopPropagation();
            cerrarIntercambio();
            callback(carta);
        });
        contenido.appendChild(div);
    });

    modal.style.display = 'flex';
}

function cerrarIntercambio() {
    var modal = document.getElementById('intercambioModal');
    if (modal) modal.style.display = 'none';
}

// 4b. Ganadores
function mostrarGanadores() {
    var ganadoras = cartas.filter(function(c) { return c.esGanadora; });
    if (ganadoras.length === 0) {
        showNotice('No hay cartas ganadoras aun.');
        return;
    }
    var modal = document.getElementById('ganadoresModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ganadoresModal';
        modal.className = 'modal-overlay';
        modal.style.display = 'none';
        modal.innerHTML = '<div class="modal-box zoom-box"><div id="ganadoresContent" class="zoom-content"></div><button class="modal-btn btn-secondary" onclick="document.getElementById(\'ganadoresModal\').style.display=\'none\'">Cerrar</button></div>';
        document.body.appendChild(modal);
    }
    var content = document.getElementById('ganadoresContent');
    if (!content) {
        content = modal.querySelector('.zoom-content');
    }
    content.innerHTML = '';
    var title = document.createElement('h3');
    title.textContent = 'Cartas Ganadoras';
    title.style.color = 'var(--text-main)';
    title.style.marginBottom = '15px';
    content.appendChild(title);

    for (var i = 0; i < ganadoras.length; i++) {
        var c = ganadoras[i];
        var visual = copiasVisuales[c.id] || null;
        var numeroMostrado = visual ? visual.numero : c.numero;
        var imagenMostrada = visual ? visual.imagen : c.imagen;
        var cardContainer = document.createElement('div');
        cardContainer.style.display = 'flex';
        cardContainer.style.alignItems = 'center';
        cardContainer.style.gap = '10px';
        cardContainer.style.marginBottom = '10px';
        cardContainer.style.background = '#2a2a4a';
        cardContainer.style.padding = '8px';
        cardContainer.style.borderRadius = '8px';
        cardContainer.style.width = '100%';
        var img = document.createElement('img');
        img.src = imagenMostrada;
        img.alt = 'Corredor ' + numeroMostrado;
        img.style.width = '60px';
        img.style.height = '80px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '4px';
        cardContainer.appendChild(img);
        var info = document.createElement('div');
        info.style.display = 'flex';
        info.style.flexDirection = 'column';
        info.style.alignItems = 'flex-start';
        var numSpan = document.createElement('span');
        var prefijo = getPrefijoCarta(numeroMostrado);
        numSpan.textContent = prefijo + ' - #' + numeroMostrado;
        numSpan.style.fontWeight = 'bold';
        info.appendChild(numSpan);
        var dueno = c.nombreGanador || 'Desconocido';
        if (dueno === 'Desconocido') {
            for (var id in playersData) {
                if (playersData[id].cartasGanadoras && playersData[id].cartasGanadoras.indexOf(c.id) !== -1) {
                    dueno = playersData[id].name;
                    break;
                }
            }
        }
        if (dueno === 'Desconocido' && typeof removedPlayersRegistry === 'object' && removedPlayersRegistry) {
            for (var removedName in removedPlayersRegistry) {
                var entry = removedPlayersRegistry[removedName];
                if (entry && entry.cartasGanadoras && entry.cartasGanadoras.indexOf(c.id) !== -1) {
                    dueno = removedName;
                    break;
                }
            }
        }
        var duenoSpan = document.createElement('span');
        duenoSpan.textContent = 'Dueno: ' + dueno;
        duenoSpan.style.color = 'var(--text-muted)';
        duenoSpan.style.fontSize = '0.8rem';
        info.appendChild(duenoSpan);
        cardContainer.appendChild(info);
        content.appendChild(cardContainer);
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
window.abrirMazosModal = abrirMazosModal;
window.cerrarMazosModal = cerrarMazosModal;
window.guardarMazosDesdeModal = guardarMazosDesdeModal;
window.mostrarModalSeleccion = mostrarModalSeleccion;
window.cerrarIntercambio = cerrarIntercambio;
window.mostrarGanadores = mostrarGanadores;