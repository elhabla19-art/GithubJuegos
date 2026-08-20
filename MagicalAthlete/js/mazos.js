// mazos.js
// ===== SELECCION DE MAZOS ACTIVOS (Base / Expansion / Noficiales) =====
// Ajuste local (por dispositivo): decide que numeros de carta entran al
// mazoRestante cuando se presiona "Corredores". No se sincroniza por MQTT:
// quien presiona "Corredores" primero es quien decide, y el mazoRestante ya
// filtrado viaja completo a todos via broadcastStart/broadcastState, igual
// que el resto del estado de la partida.

var MAZOS_KEY = 'magical_athlete_mazos_v1';

// Mapa: tipo de carta (segun getTipoCarta) -> clave usada para guardar
var MAZOS_INFO = [
    { key: 'base', label: 'Base', tipo: 'base' },
    { key: 'expansion', label: 'Expansion', tipo: 'expansion' },
    { key: 'noficial', label: 'Noficiales', tipo: 'noficial' }
];

function cargarMazosActivos() {
    try {
        var raw = localStorage.getItem(MAZOS_KEY);
        if (raw) {
            var data = JSON.parse(raw);
            // Por si en el futuro se agrega un mazo nuevo: cualquier clave
            // que falte en lo guardado se asume activa por defecto.
            var resultado = {};
            for (var i = 0; i < MAZOS_INFO.length; i++) {
                var key = MAZOS_INFO[i].key;
                resultado[key] = (data[key] !== undefined) ? !!data[key] : true;
            }
            return resultado;
        }
    } catch (e) {
        console.error('No se pudo leer la seleccion de mazos', e);
    }
    // Por defecto, todos los mazos activos
    var porDefecto = {};
    for (var j = 0; j < MAZOS_INFO.length; j++) {
        porDefecto[MAZOS_INFO[j].key] = true;
    }
    return porDefecto;
}

function guardarMazosActivos(mazos) {
    try {
        localStorage.setItem(MAZOS_KEY, JSON.stringify(mazos));
    } catch (e) {
        console.error('No se pudo guardar la seleccion de mazos', e);
    }
}

// Devuelve true si el numero de carta pertenece a un mazo actualmente activo
function mazoActivoParaNumero(numero) {
    var mazos = cargarMazosActivos();
    var tipo = (typeof getTipoCarta === 'function') ? getTipoCarta(numero) : 'base';
    for (var i = 0; i < MAZOS_INFO.length; i++) {
        if (MAZOS_INFO[i].tipo === tipo) {
            return mazos[MAZOS_INFO[i].key] !== false;
        }
    }
    return true;
}

// ===== MODAL =====
function abrirMazosModal() {
    var modal = document.getElementById('mazosModal');
    var contenido = document.getElementById('mazosContenido');
    if (!modal || !contenido) {
        showNotice('No se pudo abrir la seleccion de mazos.');
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
    guardarMazosActivos(nuevo);
    cerrarMazosModal();
}

window.mazoActivoParaNumero = mazoActivoParaNumero;
window.abrirMazosModal = abrirMazosModal;
window.cerrarMazosModal = cerrarMazosModal;
window.guardarMazosDesdeModal = guardarMazosDesdeModal;