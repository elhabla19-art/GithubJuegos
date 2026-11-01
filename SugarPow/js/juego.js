// juego.js
// ===== CONFIGURACION =====
var cartas = [];
var misSelecciones = [];
var MAX_SELECCIONES = 2;

// 30 cartas en total: 10 por cada tipo.
//   1-10  -> Menta      (imagenes/Menta_1.png ... Menta_10.png)
//   11-20 -> Chocolate  (imagenes/Chocolate_1.png ... Chocolate_10.png)
//   21-30 -> Caramelo   (imagenes/Caramelo_1.png ... Caramelo_10.png)
var CARTAS_POR_TIPO = 10;
var TIPOS_CARTA = [
    { tipo: 'menta',     prefijo: 'ME', archivo: 'Menta' },
    { tipo: 'chocolate', prefijo: 'CH', archivo: 'Chocolate' },
    { tipo: 'caramelo',  prefijo: 'CA', archivo: 'Caramelo' }
];
var TOTAL_IMAGENES = CARTAS_POR_TIPO * TIPOS_CARTA.length; // 30

var cartaActivaId = null;
var tandaActual = -1;
var mazoRestante = [];
var LOTES_POR_CICLO = 2;
var cicloTandaInicio = 0;

function getIndiceTipo(numero) {
    return Math.min(TIPOS_CARTA.length - 1, Math.floor((numero - 1) / CARTAS_POR_TIPO));
}

// Numero de la carta DENTRO de su tipo (1-10), igual al del archivo de imagen
function getNumeroEnTipo(numero) {
    return ((numero - 1) % CARTAS_POR_TIPO) + 1;
}

function getTipoCarta(numero) {
    return TIPOS_CARTA[getIndiceTipo(numero)].tipo;
}

function getPrefijoCarta(numero) {
    return TIPOS_CARTA[getIndiceTipo(numero)].prefijo;
}

function getImagenCarta(numero) {
    return 'imagenes/' + TIPOS_CARTA[getIndiceTipo(numero)].archivo + '_' + getNumeroEnTipo(numero) + '.png';
}

// Texto mostrado en etiquetas: "ME - #3"
function getEtiquetaCarta(numero) {
    return getPrefijoCarta(numero) + ' - #' + getNumeroEnTipo(numero);
}

window.getPrefijoCarta = getPrefijoCarta;
window.getImagenCarta = getImagenCarta;
window.getTipoCarta = getTipoCarta;
window.getNumeroEnTipo = getNumeroEnTipo;
window.getEtiquetaCarta = getEtiquetaCarta;

function seleccionarCarta(cartaId) {
    var carta = null;
    for (var i = 0; i < cartas.length; i++) {
        if (cartas[i].id === cartaId) {
            carta = cartas[i];
            break;
        }
    }
    if (!carta) {
        console.error('Carta no encontrada:', cartaId);
        return;
    }
    if (carta.tanda !== tandaActual) {
        showNotice('Esta carta no pertenece al lote actual.');
        return;
    }
    if (carta.seleccionadoPor) {
        showNotice('Esta carta ya fue seleccionada por ' + carta.seleccionadoPor);
        return;
    }
    if (carta.descartada) {
        showNotice('Esta carta ya fue descartada.');
        return;
    }
    var seleccionadasEnTanda = misSelecciones.filter(function(id) {
        var c = null;
        for (var j = 0; j < cartas.length; j++) {
            if (cartas[j].id === id) {
                c = cartas[j];
                break;
            }
        }
        return c && c.tanda === tandaActual && !c.descartada;
    });
    if (seleccionadasEnTanda.length >= MAX_SELECCIONES) {
        showNotice('Ya seleccionaste tus 2 cartas de este lote.');
        return;
    }
    carta.seleccionadoPor = myName;
    carta.seleccionadoPorId = myId;
    misSelecciones.push(cartaId);
    if (!playersData[myId]) {
        playersData[myId] = { name: myName, selecciones: [], cartasGanadoras: [], activeCardId: null };
    }
    playersData[myId].selecciones = misSelecciones.slice();
    broadcastSelect(cartaId);
    renderizarCartas();
    renderizarMisCorredores();
    actualizarUI();
    renderLeaderboard();
    saveSession();
    verificarSiguienteLote();
}
window.seleccionarCarta = seleccionarCarta;

function cicloTerminado() {
    if (tandaActual < 0) return true;
    for (var i = 0; i < cartas.length; i++) {
        var c = cartas[i];
        if (c.tanda >= cicloTandaInicio && c.tanda <= tandaActual && !c.descartada) {
            return false;
        }
    }
    return true;
}
window.cicloTerminado = cicloTerminado;

function todosLotesCicloCompletos() {
    if (tandaActual < cicloTandaInicio + LOTES_POR_CICLO - 1) return false;
    for (var i = 0; i < cartas.length; i++) {
        var c = cartas[i];
        if (c.tanda >= cicloTandaInicio && c.tanda <= tandaActual && !c.seleccionadoPor) {
            return false;
        }
    }
    return true;
}
window.todosLotesCicloCompletos = todosLotesCicloCompletos;

function repartirSiguienteLoteAutomatico() {
    var numJugadores = Object.keys(playersData).length;
    if (numJugadores === 0) return;
    var cartasPorLote = numJugadores * 2;
    if (mazoRestante.length < cartasPorLote) return;

    tandaActual++;
    var nuevasCartas = [];
    for (var k = 0; k < cartasPorLote; k++) {
        var numero = mazoRestante.shift();
        nuevasCartas.push({
            id: 'carta-' + tandaActual + '-' + k,
            numero: numero,
            imagen: getImagenCarta(numero),
            seleccionadoPor: null,
            seleccionadoPorId: null,
            descartada: false,
            tanda: tandaActual
        });
    }
    cartas = cartas.concat(nuevasCartas);
    broadcastStart(cartas, tandaActual, mazoRestante, false, false);
    renderizarCartas();
    renderizarMisCorredores();
    actualizarUI();
    saveSession();
}
window.repartirSiguienteLoteAutomatico = repartirSiguienteLoteAutomatico;

function verificarSiguienteLote() {
    if (tandaActual < 0) return;
    if (tandaActual >= cicloTandaInicio + LOTES_POR_CICLO - 1) return;
    var quedanDisponibles = false;
    for (var i = 0; i < cartas.length; i++) {
        if (cartas[i].tanda === tandaActual && !cartas[i].seleccionadoPor) {
            quedanDisponibles = true;
            break;
        }
    }
    if (quedanDisponibles) return;
    var esAnfitrion = !currentRoom || !hostId || hostId === myId;
    if (!esAnfitrion) return;
    repartirSiguienteLoteAutomatico();
}
window.verificarSiguienteLote = verificarSiguienteLote;

function iniciarJuego() {
    var numJugadores = Object.keys(playersData).length;
    if (numJugadores === 0) {
        showNotice('No hay jugadores en la sala. Espera a que alguien se una.');
        return;
    }
    if (gameStarted && !cicloTerminado()) {
        showNotice('Todavia hay cartas en juego. Espera a que todos usen y descarten sus cartas actuales.');
        return;
    }

    var cartasPorLote = numJugadores * 2;
    var esPrimerLote = !gameStarted;

    if (esPrimerLote) {
        mazoRestante = [];
        for (var i = 1; i <= TOTAL_IMAGENES; i++) {
            mazoRestante.push(i);
        }
        for (var i = mazoRestante.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = mazoRestante[i];
            mazoRestante[i] = mazoRestante[j];
            mazoRestante[j] = temp;
        }
        cartas = [];
        misSelecciones = [];
        cartaActivaId = null;
        tandaActual = -1;
        puntosPorJugador = {};
        for (var id in playersData) {
            playersData[id].selecciones = [];
            playersData[id].cartasGanadoras = [];
            playersData[id].activeCardId = null;
            puntosPorJugador[id] = 0;
        }
    }

    if (mazoRestante.length < cartasPorLote) {
        showNotice('No quedan suficientes cartas en el mazo para repartir a todos los jugadores (quedan ' + mazoRestante.length + '). Reinicia la partida para barajar un mazo nuevo.');
        return;
    }


    for (var oid in playersData) {
        if (playersData[oid]) playersData[oid].ordenCartas = [];
    }
    ordenBorrador = [];

    tandaActual++;
    cicloTandaInicio = tandaActual;
    var nuevasCartas = [];
    for (var k = 0; k < cartasPorLote; k++) {
        var numero = mazoRestante.shift();
        nuevasCartas.push({
            id: 'carta-' + tandaActual + '-' + k,
            numero: numero,
            imagen: getImagenCarta(numero),
            seleccionadoPor: null,
            seleccionadoPorId: null,
            descartada: false,
            tanda: tandaActual
        });
    }
    cartas = cartas.concat(nuevasCartas);
    gameStarted = true;

    broadcastStart(cartas, tandaActual, mazoRestante, esPrimerLote, true);
    renderizarCartas();
    renderizarMisCorredores();
    actualizarUI();
    saveSession();
}
window.iniciarJuego = iniciarJuego;

// ===== ORDEN DE JUEGO DE MIS CARTAS =====
// En vez de elegir una carta "para usar", cada jugador elige el orden en que
// jugara sus cartas (borrador local) y lo confirma una sola vez. Despues, al
// eliminarse su carta en uso, la siguiente del orden entra sola (ver
// asegurarActivaPorOrden en combate.js).
var ordenBorrador = [];

function misCartasVivasIds() {
    return misSelecciones.filter(function(id) {
        var c = buscarCartaPorId(id);
        return c && !c.descartada;
    });
}

function ordenConfirmadoMio() {
    var d = playersData[myId];
    return (d && d.ordenCartas) ? d.ordenCartas.filter(cartaVivaId) : [];
}

function alternarOrdenBorrador(cartaId) {
    if (typeof todosLotesCicloCompletos === 'function' && !todosLotesCicloCompletos()) {
        showNotice('Todavia faltan cartas por repartir/escoger. Espera a que todos los jugadores tengan sus 4 cartas antes de ordenar las tuyas.');
        return;
    }
    if (ordenConfirmadoMio().length > 0) {
        showNotice('Ya confirmaste el orden de tus cartas.');
        return;
    }
    var idx = ordenBorrador.indexOf(cartaId);
    if (idx !== -1) {
        ordenBorrador.splice(idx, 1);
    } else {
        ordenBorrador.push(cartaId);
    }
    renderizarMisCorredores();
}

function reiniciarOrdenBorrador() {
    ordenBorrador = [];
    renderizarMisCorredores();
}

function confirmarOrden() {
    if (!playersData[myId]) return;
    if (ordenConfirmadoMio().length > 0) return;
    var vivas = misCartasVivasIds();
    var orden = ordenBorrador.filter(function(id) { return vivas.indexOf(id) !== -1; });
    if (vivas.length === 0 || orden.length !== vivas.length) {
        showNotice('Ordena todas tus cartas antes de confirmar.');
        return;
    }
    playersData[myId].ordenCartas = orden.slice();
    playersData[myId].activeCardId = orden[0];
    ordenBorrador = [];
    broadcastSetActive(myId, orden[0]);
    broadcastState('sync');
    renderizarMisCorredores();
    actualizarUI();
    saveSession();
}
window.alternarOrdenBorrador = alternarOrdenBorrador;
window.reiniciarOrdenBorrador = reiniciarOrdenBorrador;
window.confirmarOrden = confirmarOrden;

function actualizarUI() {
    if (typeof recalcularPuntos === 'function') recalcularPuntos();
    var startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        var puedeRepartir = !gameStarted || (typeof cicloTerminado === 'function' && cicloTerminado());
        startBtn.disabled = !puedeRepartir;
        if (!gameStarted) {
            startBtn.textContent = 'Cartas';
        } else if (puedeRepartir) {
            startBtn.textContent = 'Nuevas Cartas';
        } else {
            startBtn.textContent = 'Cartas en juego';
        }
    }
    var puntosDisplay = document.getElementById('misPuntosDisplay');
    if (puntosDisplay && puntosPorJugador[myId] !== undefined) {
        puntosDisplay.textContent = 'Puntos: ' + puntosPorJugador[myId];
    }
    var restantesDisplay = document.getElementById('mazoRestanteDisplay');
    if (restantesDisplay) {
        restantesDisplay.textContent = 'Restantes: ' + (mazoRestante ? mazoRestante.length : 0);
    }
    var eliminarBtn = document.getElementById('eliminarCartaBtn');
    if (eliminarBtn) {
        eliminarBtn.style.display = (hostId === myId) ? '' : 'none';
    }
    var resetBtn = document.getElementById('resetGameBtn');
    if (resetBtn) {
        var esAnfitrion = hostId === myId;
        resetBtn.style.display = esAnfitrion ? '' : 'none';
    }
    renderLeaderboard();
    renderizarMisCorredores();

    var juegoTerminado = false;
    if (gameStarted) {
        var quedanCartasEnJuego = false;
        for (var id in playersData) {
            var data = playersData[id];
            if (!data) continue;
            var tieneCartas = false;
            if (data.selecciones) {
                for (var i = 0; i < data.selecciones.length; i++) {
                    var cId = data.selecciones[i];
                    for (var j = 0; j < cartas.length; j++) {
                        if (cartas[j].id === cId && !cartas[j].descartada) {
                            tieneCartas = true;
                            break;
                        }
                    }
                    if (tieneCartas) break;
                }
            }
            if (tieneCartas) {
                quedanCartasEnJuego = true;
                break;
            }
        }
        var numJugadoresActual = Object.keys(playersData).length;
        var alcanzaMazo = mazoRestante.length >= (numJugadoresActual * 2) && numJugadoresActual > 0;
        if (!quedanCartasEnJuego && !alcanzaMazo) {
            juegoTerminado = true;
        }
    }

    if (juegoTerminado) {
        var list = document.getElementById('playersList');
        if (list) {
            var msg = document.createElement('div');
            msg.style.textAlign = 'center';
            msg.style.color = '#F8B195';
            msg.style.fontWeight = 'bold';
            msg.style.padding = '10px';
            msg.textContent = 'Juego terminado: no quedan cartas en el mazo.';
            var oldMsg = list.querySelector('.game-ended-msg');
            if (oldMsg) oldMsg.remove();
            msg.className = 'game-ended-msg';
            list.prepend(msg);
        }
    } else {
        var list2 = document.getElementById('playersList');
        if (list2) {
            var oldMsg2 = list2.querySelector('.game-ended-msg');
            if (oldMsg2) oldMsg2.remove();
        }
    }
}
window.actualizarUI = actualizarUI;

function resetLocalGame() {
    cartas = [];
    misSelecciones = [];
    puntosPorJugador = {};
    cartaActivaId = null;
    tandaActual = -1;
    cicloTandaInicio = 0;
    mazoRestante = [];
    gameStarted = false;
    gameInitiator = null;
    ordenBorrador = [];
    for (var id in playersData) {
        playersData[id].ordenCartas = [];
        playersData[id].selecciones = [];
        playersData[id].cartasGanadoras = [];
        playersData[id].activeCardId = null;
        puntosPorJugador[id] = 0;
    }
    renderizarCartas();
    renderizarMisCorredores();
    actualizarUI();
    renderLeaderboard();
    saveSession();
}
window.resetLocalGame = resetLocalGame;
