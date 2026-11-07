// juego.js
// ===== ESTADO DE LA PARTIDA =====
// Todo lo que cambia durante el juego vive en "partida" y lleva un numero de
// version. Cada accion (iniciar, mover, pasar turno...) sube la version, y los
// demas clientes solo aceptan datos con version mayor. Asi nunca se pisa un
// estado nuevo con uno viejo (por ejemplo un "sync" retenido que llega tarde).
//
// partida = {
//   version, iniciada,
//   hexes: [{ id, q, r, tipo, monstruo, desbloqueado, despejado, duenoId }],
//   jugadores: { idJugador: { heroe: 1..8, posicion: idHexagono } },
//   orden: [idJugador...],  // orden de turnos
//   turnoIdx, ronda, movido, // movido = ya se movio en este turno
//   combate: null | { pid, hexId, origenId } // enemigo revelado esperando Atacar/Retirada
// }
// jugadores[id] = { heroe, posicion, vida, botin, potenciadores }
function nuevaPartidaVacia(version) {
    return {
        version: version || 0,
        iniciada: false,
        hexes: [],
        jugadores: {},
        orden: [],
        turnoIdx: 0,
        ronda: 1,
        movido: false,
        combate: null
    };
}
var partida = nuevaPartidaVacia();

function siguienteVersion() {
    return Math.max((partida.version || 0) + 1, Date.now());
}

function aplicarPartida(p) {
    partida = p || nuevaPartidaVacia();
    gameStarted = !!partida.iniciada;
}

function tengoProgreso() {
    return !!(partida && partida.jugadores && partida.jugadores[myId]);
}
window.tengoProgreso = tengoProgreso;

function soyAnfitrionOLocal() {
    return !currentRoom || hostId === myId;
}

function turnoActualId() {
    if (!partida.iniciada || !partida.orden.length) return null;
    return partida.orden[partida.turnoIdx % partida.orden.length];
}
function esMiTurno() { return turnoActualId() === myId; }

function jugadoresVisibles() {
    return Object.keys(playersData).filter(function(id) {
        return !(typeof isJoiningHidden === 'function' && isJoiningHidden(id));
    });
}

// ===== INICIAR PARTIDA: asigna heroes y coloca el tablero (solo anfitrion) =====
function iniciarJuego() {
    if (currentRoom && hostId !== myId) {
        showNotice(hostId ? 'Solo el anfitrion de la sala puede repartir los heroes.' : 'Todavia no hay un anfitrion asignado en la sala. Espera un momento e intenta de nuevo.');
        return;
    }
    if (partida.iniciada) {
        showNotice('La partida ya esta en curso. Usa "Reiniciar Todo" para empezar otra.');
        return;
    }
    var ids = jugadoresVisibles();
    if (ids.length === 0) {
        showNotice('No hay jugadores en la sala. Espera a que alguien se una.');
        return;
    }
    if (ids.length > MAX_JUGADORES) {
        showNotice('El tablero admite maximo ' + MAX_JUGADORES + ' jugadores (uno por lado del hexagono central). Hay ' + ids.length + ' en la sala.');
        return;
    }

    var orden = mezclar(ids);
    var heroes = mezclar(rangoNumeros(TOTAL_HEROES));
    var hexes = generarTablero(orden);

    var jugadores = {};
    for (var i = 0; i < orden.length; i++) {
        var inicio = null;
        for (var h = 0; h < hexes.length; h++) {
            if (hexes[h].tipo === 'inicio' && hexes[h].duenoId === orden[i]) { inicio = hexes[h]; break; }
        }
        jugadores[orden[i]] = {
            heroe: heroes[i], posicion: inicio ? inicio.id : hexId(0, 0),
            vida: VIDA_INICIAL_HEROE, botin: 0, potenciadores: 0
        };
    }

    aplicarPartida({
        version: siguienteVersion(),
        iniciada: true,
        hexes: hexes,
        jugadores: jugadores,
        orden: orden,
        turnoIdx: 0,
        ronda: 1,
        movido: false,
        combate: null
    });
    gameInitiator = myId;

    broadcastStart(partida);
    actualizarUI();
    saveSession();
}
window.iniciarJuego = iniciarJuego;

// ===== MOVIMIENTO =====
// Aplica un movimiento (propio o recibido). Devuelve true si cambio algo.
function aplicarMovimiento(pid, hexIdDestino, version) {
    var hex = buscarHex(hexIdDestino);
    var j = partida.jugadores[pid];
    if (!hex || !j) return false;
    var eraNuevo = (hex.tipo === 'calabozo' && !hex.desbloqueado);
    var origenId = j.posicion;
    hex.desbloqueado = true;
    j.posicion = hex.id;
    partida.movido = true;
    // Al descubrir un enemigo, queda pendiente elegir Atacar o Retirada
    partida.combate = eraNuevo ? { pid: pid, hexId: hex.id, origenId: origenId } : null;
    if (version) partida.version = version;
    return { nuevo: eraNuevo };
}

function moverJugador(hexIdDestino) {
    if (!partida.iniciada) return;
    if (!esMiTurno()) { showNotice('No es tu turno.'); return; }
    if (partida.movido) { showNotice('Ya te moviste en este turno. Pasa turno cuando termines.'); return; }
    var alcance = calcularAlcance(myId);
    if (!alcance[hexIdDestino]) { showNotice('Ese hexagono esta fuera de tu alcance.'); return; }

    var r = aplicarMovimiento(myId, hexIdDestino, siguienteVersion());
    broadcastMover(hexIdDestino, partida.version);
    actualizarUI();
    saveSession();
    return r;
}
window.moverJugador = moverJugador;

// ===== TURNOS =====
function aplicarPasarTurno(version) {
    if (!partida.iniciada || !partida.orden.length) return false;
    partida.turnoIdx = (partida.turnoIdx + 1) % partida.orden.length;
    if (partida.turnoIdx === 0) partida.ronda++;
    partida.movido = false;
    if (version) partida.version = version;
    return true;
}

function pasarTurno() {
    if (!partida.iniciada) return;
    var c = partida.combate;
    if (c && c.pid === myId) {
        showNotice('Primero elige Atacar o Retirada.');
        return;
    }
    if (!esMiTurno() && !soyAnfitrionOLocal()) {
        showNotice('Solo puedes pasar tu propio turno.');
        return;
    }
    if (c) {
        // El jugador en combate no responde (p. ej. desconectado): el anfitrion lo retira.
        aplicarRetirada(siguienteVersion());
        broadcastRetirada(partida.version);
    } else {
        aplicarPasarTurno(siguienteVersion());
        broadcastPasar(partida.version);
    }
    actualizarUI();
    saveSession();
}
window.pasarTurno = pasarTurno;

// ===== COMBATE =====
function aplicarAtacar(version) {
    var c = partida.combate;
    if (!c) return false;
    var hex = buscarHex(c.hexId);
    var j = partida.jugadores[c.pid];
    if (!hex || !j) { partida.combate = null; return false; }
    var e = getEnemigo(hex.monstruo);
    hex.despejado = true;
    j.botin = (j.botin || 0) + e.botin;
    j.potenciadores = (j.potenciadores || 0) + e.potenciadores;
    partida.combate = null;
    if (version) partida.version = version;
    return { enemigo: e };
}

function aplicarRetirada(version) {
    var c = partida.combate;
    if (!c) return false;
    var hex = buscarHex(c.hexId);
    var j = partida.jugadores[c.pid];
    var dano = 0;
    if (hex) {
        dano = getEnemigo(hex.monstruo).dano;
        hex.desbloqueado = false;   // el hexagono vuelve a ocultarse
        hex.despejado = false;
    }
    if (j) {
        j.vida = Math.max(0, getVida(j) - dano);
        j.posicion = buscarHex(c.origenId) ? c.origenId : hexId(0, 0);
    }
    partida.combate = null;
    aplicarPasarTurno(version);
    return { dano: dano };
}

function getVida(j) {
    return (j && j.vida !== undefined) ? j.vida : VIDA_INICIAL_HEROE;
}
window.getVida = getVida;

function atacar() {
    var c = partida.combate;
    if (!c || c.pid !== myId) return;
    var r = aplicarAtacar(siguienteVersion());
    broadcastAtacar(partida.version);
    cerrarZoom();
    actualizarUI();
    saveSession();
    if (r) {
        showNotice('El enemigo fue derrotado. Recompensa: ' + textoRecompensa(r.enemigo) + '.', 'Victoria');
    }
}

function retirarse() {
    var c = partida.combate;
    if (!c || c.pid !== myId) return;
    var r = aplicarRetirada(siguienteVersion());
    broadcastRetirada(partida.version);
    cerrarZoom();
    actualizarUI();
    saveSession();
    if (r) {
        showNotice('Te retiraste y recibiste ' + r.dano + ' de dano. Vuelves a tu ultimo hexagono libre y pasa el turno.', 'Retirada');
    }
}
window.atacar = atacar;
window.retirarse = retirarse;

// ===== JUGADOR ELIMINADO O QUE SALE =====
// Determinista: cada cliente lo aplica por su cuenta al recibir "remove".
function quitarJugadorDeJuego(pid) {
    if (!partida.jugadores[pid]) return;
    if (partida.combate && partida.combate.pid === pid) {
        var hc = buscarHex(partida.combate.hexId);
        if (hc) { hc.desbloqueado = false; hc.despejado = false; }
        partida.combate = null;
    }
    var idx = partida.orden.indexOf(pid);
    delete partida.jugadores[pid];
    if (idx !== -1) {
        partida.orden.splice(idx, 1);
        if (idx < partida.turnoIdx) {
            partida.turnoIdx--;
        } else if (idx === partida.turnoIdx) {
            partida.movido = false; // le toca al siguiente, que entra en el mismo indice
        }
        if (partida.orden.length) {
            if (partida.turnoIdx >= partida.orden.length) { partida.turnoIdx = 0; partida.ronda++; }
        } else {
            partida.turnoIdx = 0;
        }
    }
}
window.quitarJugadorDeJuego = quitarJugadorDeJuego;

// ===== UI GENERAL =====
function actualizarUI() {
    var startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        startBtn.disabled = !!partida.iniciada;
        startBtn.textContent = partida.iniciada ? 'Partida en curso' : 'Heroes';
        startBtn.style.display = soyAnfitrionOLocal() ? '' : 'none';
    }
    var passBtn = document.getElementById('passTurnBtn');
    if (passBtn) {
        var combateMio = !!(partida.combate && partida.combate.pid === myId);
        var puedePasar = partida.iniciada && !combateMio &&
            (esMiTurno() || (soyAnfitrionOLocal() && !!turnoActualId()));
        passBtn.style.display = partida.iniciada ? '' : 'none';
        passBtn.disabled = !puedePasar;
        passBtn.textContent = (esMiTurno() || !puedePasar) ? 'Pasar turno' : 'Pasar turno (anfitrion)';
    }
    var resetBtn = document.getElementById('resetGameBtn');
    if (resetBtn) resetBtn.style.display = (hostId === myId) ? '' : 'none';

    renderizarTablero();
    renderizarMiHeroe();
    renderLeaderboard();
    if (typeof sincronizarModalCombate === 'function') sincronizarModalCombate();
}
window.actualizarUI = actualizarUI;

function resetLocalGame(version) {
    aplicarPartida(nuevaPartidaVacia(version || siguienteVersion()));
    gameInitiator = null;
    if (typeof cerrarZoom === 'function') cerrarZoom();
    actualizarUI();
    saveSession();
}
window.resetLocalGame = resetLocalGame;
