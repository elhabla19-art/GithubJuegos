// robar.js - EcoTrole
// Toda la mecanica de robo de objetos (Reloj/Celular/Billetera) vive aqui.
//
// Reglas:
// - Cualquiera puede abrir el zoom de un jugador desde el leaderboard para
//   ver su carta de Habilidad y los items que aun conserva.
// - Solo los ladrones pueden interactuar con los items para robar.
// - Antes del Apagon, tocar un item lo "pre-marca" (se puede marcar/desmarcar
//   libremente, solo 1 seleccion pendiente a la vez).
// - En cuanto ocurre el Apagon (se acabo el tiempo o se consumio el 3er punto),
//   la pre-seleccion pendiente se roba de forma definitiva. Si el ladron no
//   habia pre-marcado nada, lo que toque MIENTRAS dura el Apagon tambien se
//   roba de inmediato y sin poder deshacerlo.
// - Cada ladron solo puede concretar 1 robo por Apagon; el cupo se libera
//   cuando arranca una nueva ronda del temporizador.

var objetosRobados = 0;       // contador global (cuenta para la condicion de victoria de los ladrones)
var miPreRobo = null;         // { targetId, item } - mi seleccion pendiente (antes del Apagon)
var miRoboUsadoEsteApagon = false; // ya concrete un robo en este Apagon, debo esperar la proxima ronda
var jugadorEnZoom = null;     // id del jugador mostrado actualmente en el zoom de jugador

function estaEnApagon() {
    return typeof getEstadoActual === 'function' && getEstadoActual() === ESTADO_TEMPORIZADOR.TERMINADO;
}

function soyLadronActivo() {
    return miRol === ROLES.LADRON;
}

// --- Zoom de jugador (habilidad + items) ---

function abrirZoomJugador(targetId) {
    if (!playersData[targetId]) return;
    jugadorEnZoom = targetId;
    var modal = document.getElementById('playerZoomModal');
    if (modal) modal.style.display = 'flex';
    renderizarZoomJugador();
}

function cerrarZoomJugador() {
    var modal = document.getElementById('playerZoomModal');
    if (modal) modal.style.display = 'none';
    jugadorEnZoom = null;
}

function renderizarZoomJugador() {
    if (!jugadorEnZoom) return;
    var modal = document.getElementById('playerZoomModal');
    if (!modal || modal.style.display !== 'flex') return; // solo refrescar si esta abierto

    var target = playersData[jugadorEnZoom];
    if (!target) {
        cerrarZoomJugador();
        return;
    }

    var content = document.getElementById('playerZoomContent');
    if (!content) return;
    content.innerHTML = '';

    var titulo = document.createElement('div');
    titulo.className = 'zoom-info';
    titulo.innerHTML = 'Habilidad de <span>' + target.name + (jugadorEnZoom === myId ? ' (Tu)' : '') + '</span>';
    content.appendChild(titulo);

    if (target.habilidad) {
        var img = document.createElement('img');
        img.src = target.habilidad.imagen;
        img.alt = 'Habilidad ' + target.habilidad.numero;
        content.appendChild(img);
    } else {
        var sinHab = document.createElement('div');
        sinHab.className = 'empty-message';
        sinHab.textContent = 'Aun no tiene una carta de Habilidad asignada.';
        content.appendChild(sinHab);
    }

    var itemsTitulo = document.createElement('div');
    itemsTitulo.className = 'zoom-info';
    itemsTitulo.style.marginTop = '4px';
    itemsTitulo.textContent = 'Objetos que aun tiene:';
    content.appendChild(itemsTitulo);

    var itemsRow = document.createElement('div');
    itemsRow.className = 'robo-items-row';

    var puedeInteractuar = soyLadronActivo() && !miRoboUsadoEsteApagon;
    var enApagon = estaEnApagon();
    var itemsActuales = target.items || [];
    var ordenItems = ['reloj', 'celular', 'billetera'];

    for (var i = 0; i < ordenItems.length; i++) {
        var item = ordenItems[i];
        var tieneItem = itemsActuales.indexOf(item) !== -1;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'robo-item-btn';
        btn.textContent = ITEM_EMOJIS[item] || '';
        btn.title = item.charAt(0).toUpperCase() + item.slice(1);

        if (!tieneItem) {
            btn.classList.add('robado');
            btn.disabled = true;
        } else if (!puedeInteractuar) {
            btn.disabled = true;
        } else {
            var esMiSeleccion = miPreRobo && miPreRobo.targetId === jugadorEnZoom && miPreRobo.item === item;
            if (esMiSeleccion) btn.classList.add('seleccionado');
            if (enApagon) btn.classList.add('apagon-activo');
            btn.addEventListener('click', function(it) {
                return function(e) {
                    e.stopPropagation();
                    clicItemZoomJugador(jugadorEnZoom, it);
                };
            }(item));
        }

        itemsRow.appendChild(btn);
    }

    content.appendChild(itemsRow);
}

// --- Interaccion con los items ---

function clicItemZoomJugador(targetId, item) {
    if (!soyLadronActivo()) return;
    if (miRoboUsadoEsteApagon) return;

    var target = playersData[targetId];
    if (!target || !target.items || target.items.indexOf(item) === -1) return; // ya no lo tiene

    if (estaEnApagon()) {
        // Definitivo: se roba de inmediato, sin opcion a deshacer.
        ejecutarRoboLocal(targetId, item);
    } else {
        // Pre-robo: se puede marcar o desmarcar libremente antes del Apagon.
        if (miPreRobo && miPreRobo.targetId === targetId && miPreRobo.item === item) {
            miPreRobo = null;
        } else {
            miPreRobo = { targetId: targetId, item: item };
        }
        if (typeof saveSession === 'function') saveSession();
        renderizarZoomJugador();
        if (typeof actualizarIndicadorPreRobo === 'function') actualizarIndicadorPreRobo();
    }
}

// Aplica el robo al estado compartido. La llaman tanto quien roba (antes de
// avisar por MQTT) como quienes reciben el aviso de otro ladron.
function aplicarRobo(targetId, item) {
    var target = playersData[targetId];
    if (!target || !target.items) return false;
    var idx = target.items.indexOf(item);
    if (idx === -1) return false; // alguien mas se adelanto

    target.items.splice(idx, 1);
    objetosRobados++;

    if (targetId === myId) {
        misItems = target.items.slice();
    }

    if (typeof renderLeaderboard === 'function') renderLeaderboard();
    if (typeof actualizarUI === 'function') actualizarUI();
    renderizarZoomJugador();
    actualizarContadorRobos();
    if (typeof saveSession === 'function') saveSession();
    if (typeof revisarVictoria === 'function') revisarVictoria();
    return true;
}

// Roba localmente (yo soy quien ejecuta la accion) y avisa a los demas.
// Los ladrones pueden robarse objetos a si mismos (por ejemplo para
// despistar a los demas, ya que el robo se ve igual para todos).
function ejecutarRoboLocal(targetId, item) {
    if (miRol !== ROLES.LADRON) return;
    if (miRoboUsadoEsteApagon) return;

    var exito = aplicarRobo(targetId, item);
    if (exito) {
        miRoboUsadoEsteApagon = true;
        if (miPreRobo && miPreRobo.targetId === targetId && miPreRobo.item === item) {
            miPreRobo = null;
        }
        broadcastRobo(targetId, item);
        if (typeof actualizarIndicadorPreRobo === 'function') actualizarIndicadorPreRobo();
        if (typeof saveSession === 'function') saveSession();
    } else if (typeof showNotice === 'function') {
        showNotice('Ese objeto ya no estaba disponible (probablemente otro ladron se adelanto).');
        miPreRobo = null;
        if (typeof actualizarIndicadorPreRobo === 'function') actualizarIndicadorPreRobo();
    }
}

// Se llama automaticamente (desde tiempo.js) en el instante exacto en que
// ocurre el Apagon, para hacer definitiva cualquier pre-seleccion pendiente.
function onApagonOcurrido() {
    if (miRol !== ROLES.LADRON || !miPreRobo || miRoboUsadoEsteApagon) return;
    var pendiente = miPreRobo;
    ejecutarRoboLocal(pendiente.targetId, pendiente.item);
}

// Se llama automaticamente (desde tiempo.js) cuando arranca una nueva ronda
// del temporizador: libera el cupo de robo para el siguiente Apagon.
function onNuevaRondaTemporizador() {
    miRoboUsadoEsteApagon = false;
    renderizarZoomJugador();
    if (typeof actualizarIndicadorPreRobo === 'function') actualizarIndicadorPreRobo();
}

// --- Contador global e indicador personal ---

function actualizarContadorRobos() {
    var el = document.getElementById('robadosDisplay');
    if (!el) return;
    var total = (typeof OBJETOS_ROBADOS_REQUERIDOS !== 'undefined') ? OBJETOS_ROBADOS_REQUERIDOS : 8;
    el.textContent = 'Objetos robados: ' + objetosRobados + '/' + total;
}

function actualizarIndicadorPreRobo() {
    var el = document.getElementById('miPreRoboIndicador');
    if (!el) return;
    if (miRol === ROLES.LADRON && miPreRobo && playersData[miPreRobo.targetId]) {
        var nombreObjetivo = playersData[miPreRobo.targetId].name;
        el.style.display = 'block';
        el.textContent = 'Tu seleccion: ' + (ITEM_EMOJIS[miPreRobo.item] || '') + ' de ' + nombreObjetivo +
            ' (se roba en el proximo Apagon)';
    } else {
        el.style.display = 'none';
        el.textContent = '';
    }
}

function resetRobos() {
    objetosRobados = 0;
    miPreRobo = null;
    miRoboUsadoEsteApagon = false;
    actualizarContadorRobos();
    actualizarIndicadorPreRobo();
}

// --- Broadcast / recepcion por MQTT ---

function broadcastRobo(targetId, item) {
    if (mqttClient && currentRoom) {
        var topic = 'ecotrole/room/' + currentRoom;
        var payload = JSON.stringify({
            action: 'robo_ejecutado',
            id: myId,
            name: myName,
            targetId: targetId,
            item: item,
            timestamp: Date.now()
        });
        mqttClient.publish(topic, payload, { qos: 1 });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    var modal = document.getElementById('playerZoomModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                cerrarZoomJugador();
            }
        });
    }
    actualizarContadorRobos();
});

window.abrirZoomJugador = abrirZoomJugador;
window.cerrarZoomJugador = cerrarZoomJugador;
window.renderizarZoomJugador = renderizarZoomJugador;
window.clicItemZoomJugador = clicItemZoomJugador;
window.aplicarRobo = aplicarRobo;
window.ejecutarRoboLocal = ejecutarRoboLocal;
window.onApagonOcurrido = onApagonOcurrido;
window.onNuevaRondaTemporizador = onNuevaRondaTemporizador;
window.actualizarContadorRobos = actualizarContadorRobos;
window.actualizarIndicadorPreRobo = actualizarIndicadorPreRobo;
window.resetRobos = resetRobos;
window.broadcastRobo = broadcastRobo;