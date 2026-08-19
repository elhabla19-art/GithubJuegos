// puntaje.js (sin cambios)
// ===== LOGICA DE PUNTUACION GLOBAL =====
var puntosPorJugador = {};
var estadoRonda = {
    usado3: false,
    usado2: false,
    ganadorCartaId: null,
    jugadorGanador: null
};

function inicializarPuntos() {
    for (var id in playersData) {
        if (!puntosPorJugador[id]) {
            puntosPorJugador[id] = 0;
        }
    }
}

function asignarPuntoGlobal(tipo) {
    if (!myId || !myName) {
        showNotice('No estas conectado a una sala.');
        return;
    }

    if (!puntosPorJugador[myId]) {
        puntosPorJugador[myId] = 0;
    }

    if (tipo === '+3') {
        if (estadoRonda.usado3) {
            showNotice('1° ya fue usado esta ronda.');
            return;
        }
        var activeId = playersData[myId] ? playersData[myId].activeCardId : null;
        if (!activeId) {
            showNotice('Selecciona una carta activa con el boton "Usar" primero.');
            return;
        }
        var cartaEncontrada = false;
        for (var i = 0; i < cartas.length; i++) {
            if (cartas[i].id === activeId) {
                if (cartas[i].descartada || cartas[i].esGanadora) {
                    showNotice('Esta carta no esta disponible.');
                    return;
                }
                cartas[i].esGanadora = true;
                // BUG FIX: el "Dueno" en el modal de Cartas Ganadoras se
                // buscaba cruzando esta carta contra playersData (y, como
                // respaldo, removedPlayersRegistry) por id de jugador. El
                // problema es que ninguna de esas dos fuentes sobrevive
                // mucho: playersData pierde al jugador si lo expulsan, y
                // removedPlayersRegistry es solo en memoria (se pierde al
                // recargar la pagina o para cualquiera que no haya estado
                // presente en el momento de la expulsion). El nombre del
                // dueno ahora se guarda DIRECTO en la carta -que si viaja
                // completa por sync/localStorage-, asi que sobrevive
                // cualquier combinacion de expulsiones, reconexiones o
                // recargas de pagina.
                cartas[i].nombreGanador = myName;
                cartaEncontrada = true;
                break;
            }
        }
        if (!cartaEncontrada) {
            showNotice('Carta no encontrada.');
            return;
        }
        puntosPorJugador[myId] += 3;
        estadoRonda.usado3 = true;
        estadoRonda.ganadorCartaId = activeId;
        estadoRonda.jugadorGanador = myId;
        if (!playersData[myId].cartasGanadoras) {
            playersData[myId].cartasGanadoras = [];
        }
        if (playersData[myId].cartasGanadoras.indexOf(activeId) === -1) {
            playersData[myId].cartasGanadoras.push(activeId);
        }
        broadcastPuntajeGlobal('+3');
        broadcastEstadoRonda();
        // Refresca el snapshot RETENIDO (sync) con los puntos ya sumados: si
        // nadie mas queda conectado cuando este jugador se desconecte, el
        // "ultimo estado conocido" que recibira alguien que se reconecte ya
        // incluye este punto, en vez de depender del heartbeat cada 15s.
        broadcastState('sync');
        actualizarUI();
        saveSession();
    } else if (tipo === '+2') {
        if (!estadoRonda.usado3) {
            showNotice('Debes usar 1° primero.');
            return;
        }
        if (estadoRonda.usado2) {
            showNotice('2° ya fue usado esta ronda.');
            return;
        }
        if (estadoRonda.jugadorGanador === myId) {
            showNotice('No puedes usar 2°, ya usaste 1°.');
            return;
        }
        puntosPorJugador[myId] += 2;
        estadoRonda.usado2 = true;
        if (typeof window.descartarActivas === 'function') {
            window.descartarActivas(estadoRonda.jugadorGanador);
        } else {
            console.error('descartarActivas no disponible');
        }
        broadcastPuntajeGlobal('+2');
        broadcastEstadoRonda();
        broadcastState('sync');
        actualizarUI();
        saveSession();
        setTimeout(function() {
            reiniciarRonda();
        }, 500);
    } else if (tipo === '+1') {
        puntosPorJugador[myId] += 1;
        broadcastPuntajeGlobal('+1');
        broadcastState('sync');
        actualizarUI();
        saveSession();
    } else if (tipo === '-1') {
        puntosPorJugador[myId] -= 1;
        broadcastPuntajeGlobal('-1');
        broadcastState('sync');
        actualizarUI();
        saveSession();
    }
}

function reiniciarRonda() {
    estadoRonda.usado3 = false;
    estadoRonda.usado2 = false;
    estadoRonda.ganadorCartaId = null;
    estadoRonda.jugadorGanador = null;
    for (var id in playersData) {
        if (playersData[id]) {
            playersData[id].activeCardId = null;
        }
    }
    broadcastEstadoRonda();
    actualizarUI();
    saveSession();
}

function actualizarBotonesGlobales() {
    var btn3 = document.getElementById('btnPuntaje3');
    var btn2 = document.getElementById('btnPuntaje2');
    var btnMenos = document.getElementById('btnPuntajeMenos');
    var btnMas = document.getElementById('btnPuntajeMas');

    if (!btn3 || !btn2 || !btnMenos || !btnMas) return;

    if (estadoRonda.usado3) {
        btn3.disabled = true;
        // BUG FIX: antes, quien tomaba el 1er lugar tambien se quedaba sin
        // poder usar -1/+1 por el resto de la ronda. Esos dos botones son
        // puntaje libre (no dependen de la ronda de corredores) y deben
        // seguir disponibles para TODOS en todo momento; lo unico que debe
        // bloquearse para el ganador del 1er lugar es "2°" (no puede
        // marcarse a si mismo como segundo).
        if (estadoRonda.jugadorGanador === myId) {
            btn2.disabled = true;
        } else {
            btn2.disabled = estadoRonda.usado2;
        }
        btnMenos.disabled = false;
        btnMas.disabled = false;
    } else {
        btn3.disabled = false;
        btn2.disabled = true;
        btnMenos.disabled = false;
        btnMas.disabled = false;
    }
}

window.asignarPuntoGlobal = asignarPuntoGlobal;
window.reiniciarRonda = reiniciarRonda;