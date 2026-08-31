// juego.js - EcoTrole
var cartas = [];
var misCartas = [];
var misItems = []; // ['reloj', 'celular', 'billetera'] - se entregan fijos al repartir roles
// NOTA: ROLES, ESTADO_JUGADOR y las condiciones de victoria viven en roles.js
var TOTAL_HABILIDADES = 10;
var TOTAL_ACCIONES = 30;
var CARTAS_ACCION_INICIALES = 3; // cuantas cartas de Accion recibe cada jugador al repartir
var MAX_CARTAS_ACCION = 3;       // tope de cartas de Accion que se pueden tener en mano
var ITEMS_FIJOS = ['reloj', 'celular', 'billetera'];
var juegoIniciado = false;
var juegoIniciador = null;
var rolesAsignados = false;

function getImagenHabilidad(numero) {
    return 'imagenes/Habilidad_' + numero + '.png';
}

function getImagenAccion(numero) {
    return 'imagenes/Accion_' + numero + '.png';
}

function getTipoCarta(numero, tipo) {
    if (tipo === 'habilidad') return 'habilidad';
    if (tipo === 'accion') return 'accion';
    return 'desconocido';
}

function getPrefijoCarta(numero, tipo) {
    if (tipo === 'habilidad') return 'HAB';
    if (tipo === 'accion') return 'ACC';
    return '??';
}

function contarMisCartasAccion() {
    return misCartas.filter(function(c) { return c.tipo === 'accion'; }).length;
}

function barajar(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
    return arr;
}

function iniciarJuego() {
    var numJugadores = Object.keys(playersData).length;
    if (numJugadores === 0) {
        showNotice('No hay jugadores en la sala. Espera a que alguien se una.');
        return;
    }

    if (hostId !== myId) {
        showNotice('Solo el anfitrion puede repartir los roles.');
        return;
    }

    if (rolesAsignados) {
        showNotice('Los roles ya fueron asignados. Usa "Reiniciar" para volver a repartir.');
        return;
    }

    var mazoHabilidades = barajar((function() {
        var arr = [];
        for (var i = 1; i <= TOTAL_HABILIDADES; i++) arr.push(i);
        return arr;
    })());

    var mazoAcciones = barajar((function() {
        var arr = [];
        for (var i = 1; i <= TOTAL_ACCIONES; i++) arr.push(i);
        return arr;
    })());

    var jugadores = Object.keys(playersData);

    var numLadrones = Math.max(1, Math.floor(jugadores.length / 3));
    if (numLadrones > jugadores.length - 1) numLadrones = jugadores.length - 1;

    var jugadoresMezclados = barajar(jugadores.slice());

    var rolAsignado = {};
    var habilidadesPorJugador = {};
    var accionesPorJugador = {};
    var indiceHabilidad = 0;

    for (var i = 0; i < jugadoresMezclados.length; i++) {
        var id = jugadoresMezclados[i];

        // --- Rol ---
        rolAsignado[id] = (i < numLadrones) ? ROLES.LADRON : ROLES.PASAJERO;

        // --- Habilidad (1 por jugador mientras alcance el mazo) ---
        if (indiceHabilidad < mazoHabilidades.length) {
            var numHabilidad = mazoHabilidades[indiceHabilidad];
            habilidadesPorJugador[id] = {
                numero: numHabilidad,
                imagen: getImagenHabilidad(numHabilidad),
                tipo: 'habilidad'
            };
            indiceHabilidad++;
        }

        // --- Cartas de Accion iniciales (3 por jugador mientras alcance el mazo) ---
        var misNumsAccion = [];
        for (var k = 0; k < CARTAS_ACCION_INICIALES; k++) {
            if (mazoAcciones.length === 0) break;
            misNumsAccion.push(mazoAcciones.shift());
        }
        accionesPorJugador[id] = misNumsAccion;
    }

    juegoIniciado = true;
    juegoIniciador = myId;
    rolesAsignados = true;
    mazoAccionesRestantes = mazoAcciones;
    accionesRestantes = mazoAcciones.length;

    if (typeof resetVictoria === 'function') resetVictoria();
    if (typeof resetRobos === 'function') resetRobos();

    aplicarRolesLocales(rolAsignado, habilidadesPorJugador, accionesPorJugador);

    // Foto fija del mazo restante en el momento del reparto: se usa solo para
    // los mensajes de red (incluidos los reintentos); el mazo "vivo" que se usa
    // para sacar cartas sigue siendo mazoAccionesRestantes.
    var mazoAccionesParaEnviar = mazoAcciones.slice();

    broadcastStartGame(rolAsignado, habilidadesPorJugador, accionesPorJugador, mazoAccionesParaEnviar);
    // Reintentos: el broker publico / la red movil pueden perder el primer
    // mensaje. Reenviamos el mismo reparto un par de veces mas; los clientes
    // que ya lo procesaron simplemente lo ignoran (ver guardia en mqtt.js).
    setTimeout(function() {
        broadcastStartGame(rolAsignado, habilidadesPorJugador, accionesPorJugador, mazoAccionesParaEnviar);
    }, 900);
    setTimeout(function() {
        broadcastStartGame(rolAsignado, habilidadesPorJugador, accionesPorJugador, mazoAccionesParaEnviar);
    }, 2200);

    renderizarMisCartas();
    actualizarUI();
    saveSession();
}

var mazoAccionesRestantes = [];
var accionesRestantes = TOTAL_ACCIONES;

function aplicarRolesLocales(roles, habilidades, acciones) {
    for (var id in roles) {
        if (!playersData[id]) continue;
        playersData[id].rol = roles[id];
        playersData[id].habilidad = habilidades[id] || null;
        playersData[id].items = ITEMS_FIJOS.slice();
        playersData[id].acciones = playersData[id].acciones || [];
        playersData[id].estadoJuego = ESTADO_JUGADOR.ACTIVO;

        if (id === myId) {
            miRol = roles[id];
            miHabilidad = habilidades[id] || null;
            misItems = ITEMS_FIJOS.slice();
            misCartas = [];

            if (miHabilidad) {
                misCartas.push({
                    id: 'hab-' + Date.now() + '-' + Math.random(),
                    numero: miHabilidad.numero,
                    imagen: miHabilidad.imagen,
                    tipo: 'habilidad',
                    esMia: true
                });
            }

            var misNumsAccion = (acciones && acciones[id]) || [];
            var idsAccion = [];
            for (var a = 0; a < misNumsAccion.length; a++) {
                var numAccion = misNumsAccion[a];
                var cartaAccion = {
                    id: 'acc-' + Date.now() + '-' + Math.random() + '-' + a,
                    numero: numAccion,
                    imagen: getImagenAccion(numAccion),
                    tipo: 'accion',
                    esMia: true
                };
                misCartas.push(cartaAccion);
                idsAccion.push(cartaAccion.id);
            }
            playersData[id].acciones = idsAccion;
        }
    }
    renderizarMisCartas();
    renderLeaderboard();
}

// Se presiona "Accion": mientras tenga menos de MAX_CARTAS_ACCION, puede seguir
// presionando para ir completando su mano hasta llegar a 3.
function obtenerAccion() {
    if (!juegoIniciado) {
        showNotice('Primero debes repartir los roles con "Pasajeros".');
        return;
    }

    if (!playersData[myId] || !playersData[myId].rol) {
        showNotice('Aun no tienes un rol asignado.');
        return;
    }

    if (contarMisCartasAccion() >= MAX_CARTAS_ACCION) {
        showNotice('Ya tienes el maximo de ' + MAX_CARTAS_ACCION + ' cartas de Accion.');
        return;
    }

    if (mazoAccionesRestantes.length === 0) {
        showNotice('No quedan cartas de Accion en el mazo.');
        return;
    }

    var numAccion = mazoAccionesRestantes.shift();
    accionesRestantes = mazoAccionesRestantes.length;

    var cartaAccion = {
        id: 'acc-' + Date.now() + '-' + Math.random(),
        numero: numAccion,
        imagen: getImagenAccion(numAccion),
        tipo: 'accion',
        esMia: true
    };

    misCartas.push(cartaAccion);
    if (!playersData[myId].acciones) {
        playersData[myId].acciones = [];
    }
    playersData[myId].acciones.push(cartaAccion.id);

    broadcastAccionObtenida(cartaAccion);

    renderizarMisCartas();
    actualizarUI();
    saveSession();
}

// Se presiona "Activar" en el zoom de una carta de Accion: la carta se descarta
// de la mano y su numero regresa al mazo compartido para que cualquiera la pueda sacar de nuevo.
function activarAccion(cartaId) {
    var idx = -1;
    for (var i = 0; i < misCartas.length; i++) {
        if (misCartas[i].id === cartaId && misCartas[i].tipo === 'accion') {
            idx = i;
            break;
        }
    }
    if (idx === -1) return;

    var carta = misCartas[idx];
    misCartas.splice(idx, 1);

    if (playersData[myId] && playersData[myId].acciones) {
        var posId = playersData[myId].acciones.indexOf(cartaId);
        if (posId !== -1) playersData[myId].acciones.splice(posId, 1);
    }

    mazoAccionesRestantes.push(carta.numero);
    accionesRestantes = mazoAccionesRestantes.length;

    broadcastAccionActivada(cartaId, carta.numero);

    renderizarMisCartas();
    actualizarUI();
    saveSession();
}

function apagon() {
    var estado = window.getEstadoActual ? window.getEstadoActual() : null;
    var puntosV = window.getPuntosVerdes ? window.getPuntosVerdes() : 3;

    // 3. Si el temporizador está corriendo -> se pinta un punto en rojo
    //    (si con esto llegan a 3 rojos, consumirPunto() detiene el tiempo y avisa a todos)
    if (estado === ESTADO_TEMPORIZADOR.CORRIENDO) {
        if (typeof window.consumirPunto === 'function') {
            window.consumirPunto();
        }
        return;
    }

    // 5 y 6. Si el temporizador ya terminó
    if (estado === ESTADO_TEMPORIZADOR.TERMINADO) {
        if (puntosV === 0) {
            // 6. Ya hay 3 rojos -> se reinician los puntos y el tiempo
            if (typeof window.resetearPuntos === 'function') {
                window.resetearPuntos();
            }
        }
        // 5. Aun quedan puntos verdes -> se mantienen tal cual, solo se reinicia el tiempo
        if (typeof window.reiniciarTemporizador === 'function') {
            window.reiniciarTemporizador();
        }
        if (typeof window.iniciarTemporizador === 'function') {
            window.iniciarTemporizador();
        }
        return;
    }

    // 2. Estado inicial (DETENIDO) o PAUSADO -> simplemente arranca el tiempo,
    //    sin tocar los puntos.
    if (typeof window.iniciarTemporizador === 'function') {
        window.iniciarTemporizador();
    }
}

function resetLocalGame() {
    juegoIniciado = false;
    juegoIniciador = null;
    rolesAsignados = false;
    miRol = null;
    miHabilidad = null;
    misItems = [];
    misCartas = [];
    mazoAccionesRestantes = [];
    accionesRestantes = TOTAL_ACCIONES;

    if (typeof window.reiniciarTemporizador === 'function') {
        window.reiniciarTemporizador();
    }
    if (typeof window.resetearPuntos === 'function') {
        window.resetearPuntos();
    }
    if (typeof resetVictoria === 'function') {
        resetVictoria();
    }
    if (typeof resetRobos === 'function') {
        resetRobos();
    }

    for (var id in playersData) {
        playersData[id].rol = null;
        playersData[id].habilidad = null;
        playersData[id].items = [];
        playersData[id].acciones = [];
        playersData[id].estadoJuego = null;
    }

    renderizarMisCartas();
    actualizarUI();
    renderLeaderboard();
    saveSession();
}

function broadcastStartGame(roles, habilidades, acciones, mazoAcciones) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'start_game',
            id: myId,
            name: myName,
            roles: roles,
            habilidades: habilidades,
            acciones: acciones,
            mazoAcciones: mazoAcciones,
            hostId: hostId,
            timestamp: Date.now(),
            updatedAt: Date.now()
        });
        mqttClient.publish(topic, payload, { qos: 1, retain: true });
    }
}

function broadcastAccionObtenida(carta) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'accion_obtenida',
            id: myId,
            name: myName,
            carta: carta,
            accionesRestantes: accionesRestantes
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastAccionActivada(cartaId, numero) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'accion_activada',
            id: myId,
            name: myName,
            cartaId: cartaId,
            numero: numero
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

function broadcastReset() {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'reset_all',
            id: myId,
            name: myName
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

// NOTA: broadcastState() vive unicamente en mqtt.js (fuente unica de verdad).

window.iniciarJuego = iniciarJuego;
window.obtenerAccion = obtenerAccion;
window.activarAccion = activarAccion;
window.apagon = apagon;
window.resetLocalGame = resetLocalGame;
window.broadcastReset = broadcastReset;
window.broadcastStartGame = broadcastStartGame;
window.broadcastAccionObtenida = broadcastAccionObtenida;
window.broadcastAccionActivada = broadcastAccionActivada;