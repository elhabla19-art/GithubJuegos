// twist.js
// ===== CARTA TWIST (objetivo comun para todos los jugadores) =====
// Las cartas Twist NO forman parte del mazo de corredores: son un objetivo
// externo al juego (se juega fuera de la pagina) del que solo existe UNA
// revelada a la vez, igual para todos los jugadores de la sala. En total
// hay 13 cartas Twist.
//
// Ciclo de vida de cartaTwistActual:
// - Se elige al azar la primera vez que alguien presiona "Twist" (si no hay
//   ninguna revelada todavia) y se sincroniza a todos.
// - Se mantiene igual mientras se cierra/reabre el modal de zoom.
// - Se limpia automaticamente al terminar cada ronda (cuando se descartan
//   las cartas activas del mazo, ver aplicarDescarteActivas en juego.js) y
//   al reiniciar la partida (ver resetLocalGame en juego.js). En ambos
//   casos la funcion ya corre en TODOS los clientes (por evento local o via
//   sync/reset_all), asi que no hace falta un broadcast especial para
//   limpiarla: solo para elegir una nueva.

var TOTAL_CARTAS_TWIST = 13;
var cartaTwistActual = null; // { numero, imagen } o null si no hay ninguna revelada todavia

function getImagenTwist(numero) {
    return 'imagenes/Twist_' + numero + '.png';
}
window.getImagenTwist = getImagenTwist;

function elegirCartaTwistAleatoria() {
    var numero = Math.floor(Math.random() * TOTAL_CARTAS_TWIST) + 1;
    return { numero: numero, imagen: getImagenTwist(numero) };
}

// Limpia la carta Twist actual (sin cerrar el modal ni tocar la red; eso lo
// decide quien la llama, segun el contexto: fin de ronda o reinicio).
function limpiarCartaTwist() {
    cartaTwistActual = null;
}
window.limpiarCartaTwist = limpiarCartaTwist;

// Muestra la carta Twist actual en el modal de zoom. Si todavia no hay
// ninguna, elige una al azar y la sincroniza para que todos vean la misma.
function mostrarTwist() {
    if (!cartaTwistActual) {
        cartaTwistActual = elegirCartaTwistAleatoria();
        if (typeof saveSession === 'function') saveSession();
        if (typeof broadcastState === 'function') broadcastState('sync');
    }

    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    if (!modal || !content) {
        showNotice('No se pudo abrir la carta Twist.');
        return;
    }

    content.innerHTML = '';
    var img = document.createElement('img');
    img.src = cartaTwistActual.imagen;
    img.alt = 'Twist ' + cartaTwistActual.numero;
    content.appendChild(img);

    var info = document.createElement('div');
    info.className = 'zoom-info';
    info.innerHTML = 'Twist <span>#' + cartaTwistActual.numero + '</span>';
    content.appendChild(info);

    modal.style.display = 'flex';
}
window.mostrarTwist = mostrarTwist;