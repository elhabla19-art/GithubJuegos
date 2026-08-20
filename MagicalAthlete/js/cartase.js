// cartase.js
// ===== CARTAS ESPECIALES: 17, 33 y EXPANSION_31 =====

// Variable global para el grupo de copias visuales de la Expansion_31
var gruposExpansion31 = {};

// Número de la carta especial "Expansion_31" (acumulativa, sin límite)
var EXPANSION_31_NUMERO = TOTAL_IMAGENES_BASE + 31; // 67

// Exponer al ámbito global
window.EXPANSION_31_NUMERO = EXPANSION_31_NUMERO;
window.gruposExpansion31 = gruposExpansion31;

// ===== INTERCAMBIO POR CARTA 17 =====
function intercambiarPor17(cartaActual) {
    if (!mazoRestante || mazoRestante.length === 0) {
        showNotice('No quedan corredores en el mazo para copiar.');
        return;
    }
    var candidatosNumeros = mazoRestante.filter(function(n) {
        return n !== 17 && n !== 33;
    });
    if (candidatosNumeros.length === 0) {
        showNotice('No quedan corredores disponibles en el mazo para copiar.');
        return;
    }
    var mezclados = candidatosNumeros.slice();
    for (var i = mezclados.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = mezclados[i];
        mezclados[i] = mezclados[j];
        mezclados[j] = temp;
    }
    var seleccionables = mezclados.slice(0, Math.min(3, mezclados.length)).map(function(n) {
        return { numero: n, imagen: getImagenCarta(n) };
    });

    mostrarModalSeleccion(seleccionables, 'Elige un corredor para copiar (17) - solo tu lo veras asi', function(elegido) {
        copiasVisuales[cartaActual.id] = { numero: elegido.numero, imagen: elegido.imagen };
        playersData[myId].activeCardId = cartaActual.id;
        broadcastSetActive(myId, cartaActual.id);
        broadcastState('sync');
        renderizarCartas();
        renderizarMisCorredores();
        actualizarUI();
        saveSession();
    });
}

// ===== INTERCAMBIO POR CARTA 33 =====
function intercambiarPor33(cartaActual) {
    var vistos = {};
    var ganadoras = cartas.filter(function(c) {
        if (c.id === cartaActual.id) return false;
        if (!c.esGanadora) return false;
        if (c.numero === 17 || c.numero === 33) return false;
        if (vistos[c.numero]) return false;
        vistos[c.numero] = true;
        return true;
    });
    if (ganadoras.length === 0) {
        showNotice('No hay cartas ganadoras disponibles (o son especiales).');
        return;
    }

    mostrarModalSeleccion(ganadoras, 'Elige una carta ganadora para copiar (33) - solo tu la veras asi', function(cartaElegida) {
        copiasVisuales[cartaActual.id] = { numero: cartaElegida.numero, imagen: cartaElegida.imagen };
        playersData[myId].activeCardId = cartaActual.id;
        broadcastSetActive(myId, cartaActual.id);
        broadcastState('sync');
        renderizarCartas();
        renderizarMisCorredores();
        actualizarUI();
        saveSession();
    });
}

// ===== EXPANSION_31 (acumulativa) =====
function generarCartaAleatoriaVisual() {
    var numero;
    do {
        numero = Math.floor(Math.random() * TOTAL_IMAGENES) + 1;
    } while (numero === 17 || numero === 33);
    return { numero: numero, imagen: getImagenCarta(numero) };
}

function activarExpansion31(carta) {
    if (!gruposExpansion31[carta.id]) {
        gruposExpansion31[carta.id] = [{ numero: carta.numero, imagen: carta.imagen }];
    }
    playersData[myId].activeCardId = carta.id;
    broadcastSetActive(myId, carta.id);
    broadcastState('sync');
    renderizarMisCorredores();
    actualizarUI();
    saveSession();
    mostrarGrupoExpansion31(carta.id);
}

function mostrarGrupoExpansion31(cartaId) {
    var zoomModal = document.getElementById('zoomModal');
    if (zoomModal) zoomModal.style.display = 'none';

    if (!gruposExpansion31[cartaId] || gruposExpansion31[cartaId].length === 0) {
        var cartaBase = null;
        for (var i = 0; i < cartas.length; i++) {
            if (cartas[i].id === cartaId) {
                cartaBase = cartas[i];
                break;
            }
        }
        if (!cartaBase) return;
        gruposExpansion31[cartaId] = [{ numero: cartaBase.numero, imagen: cartaBase.imagen }];
    }

    var modal = document.getElementById('intercambioModal');
    var contenido = document.getElementById('intercambioContenido');
    var tituloElem = document.getElementById('intercambioTitulo');
    if (!modal || !contenido || !tituloElem) return;

    tituloElem.textContent = 'Tus corredores (Expansion 31) - solo tu los ves';
    contenido.innerHTML = '';

    var grupo = gruposExpansion31[cartaId];
    grupo.forEach(function(item, idx) {
        var div = document.createElement('div');
        div.className = 'carta-opcion';
        var img = document.createElement('img');
        img.src = item.imagen;
        img.alt = '#' + item.numero;
        img.loading = 'lazy';
        div.appendChild(img);
        var span = document.createElement('span');
        span.textContent = '#' + item.numero;
        div.appendChild(span);
        div.addEventListener('click', function(e) {
            e.stopPropagation();
            abrirZoomGrupoItem(cartaId, idx);
        });
        contenido.appendChild(div);
    });

    var addDiv = document.createElement('div');
    addDiv.className = 'carta-opcion carta-opcion-agregar';
    var addSigno = document.createElement('span');
    addSigno.className = 'agregar-signo';
    addSigno.textContent = '+';
    addDiv.appendChild(addSigno);
    var addLabel = document.createElement('span');
    addLabel.textContent = 'Agregar';
    addDiv.appendChild(addLabel);
    addDiv.addEventListener('click', function(e) {
        e.stopPropagation();
        agregarCartaAGrupo(cartaId);
    });
    contenido.appendChild(addDiv);

    modal.style.display = 'flex';
}

function agregarCartaAGrupo(cartaId) {
    if (!gruposExpansion31[cartaId]) {
        gruposExpansion31[cartaId] = [];
    }
    gruposExpansion31[cartaId].push(generarCartaAleatoriaVisual());
    saveSession();
    mostrarGrupoExpansion31(cartaId);
}

function abrirZoomGrupoItem(cartaId, idx) {
    var grupo = gruposExpansion31[cartaId];
    if (!grupo || !grupo[idx]) return;
    var item = grupo[idx];

    var intercambioModal = document.getElementById('intercambioModal');
    if (intercambioModal) intercambioModal.style.display = 'none';

    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    if (!modal || !content) return;
    content.innerHTML = '';

    var img = document.createElement('img');
    img.src = item.imagen;
    img.alt = 'Corredor ' + item.numero;
    content.appendChild(img);

    var info = document.createElement('div');
    info.className = 'zoom-info';
    var prefijo = getPrefijoCarta(item.numero);
    info.innerHTML = 'Corredor <span>' + prefijo + ' - #' + item.numero + '</span>';
    content.appendChild(info);

    var btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '10px';
    btnRow.style.flexWrap = 'wrap';
    btnRow.style.justifyContent = 'center';

    var btnMas = document.createElement('button');
    btnMas.className = 'btn-choose';
    btnMas.textContent = '+ Agregar otro';
    btnMas.addEventListener('click', function() {
        agregarCartaAGrupo(cartaId);
    });
    btnRow.appendChild(btnMas);

    var btnVolver = document.createElement('button');
    btnVolver.className = 'modal-btn btn-secondary';
    btnVolver.textContent = 'Volver';
    btnVolver.addEventListener('click', function() {
        mostrarGrupoExpansion31(cartaId);
    });
    btnRow.appendChild(btnVolver);

    content.appendChild(btnRow);
    modal.style.display = 'flex';
}

// Exponer funciones globalmente
window.intercambiarPor17 = intercambiarPor17;
window.intercambiarPor33 = intercambiarPor33;
window.activarExpansion31 = activarExpansion31;
window.mostrarGrupoExpansion31 = mostrarGrupoExpansion31;
window.agregarCartaAGrupo = agregarCartaAGrupo;
window.abrirZoomGrupoItem = abrirZoomGrupoItem;