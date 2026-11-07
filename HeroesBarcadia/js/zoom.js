// zoom.js
// ===== VER UN HEXAGONO O UN HEROE EN GRANDE =====
function abrirZoomHex(id) {
    if (combatePendienteMio()) { abrirCombate(); return; }
    var hex = buscarHex(id);
    if (!hex) return;
    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    content.innerHTML = '';

    var revelado = hex.tipo !== 'calabozo' || hex.desbloqueado;
    var img = document.createElement('img');
    var titulo, detalle;
    if (hex.tipo === 'calabozo') {
        if (revelado) {
            img.src = getImagenMonstruo(hex.monstruo);
            img.alt = 'Monstruo ' + hex.monstruo;
            var en = getEnemigo(hex.monstruo);
            titulo = 'Monstruo <span>#' + hex.monstruo + '</span>';
            detalle = 'Nivel ' + en.nivel + ' \u00b7 Dano ' + en.dano + '\n' + textoRecompensa(en) +
                (hex.despejado ? '\nDerrotado' : '');
        } else {
            img.src = getImagenHexagono('calabozo');
            img.alt = 'Hexagono sin explorar';
            titulo = 'Hexagono <span>sin explorar</span>';
            detalle = 'Avanza hasta aqui para descubrir que hay dentro.';
        }
    } else if (hex.tipo === 'centro') {
        img.src = getImagenHexagono('centro');
        img.alt = 'Portal';
        titulo = 'Portal <span>central</span>';
        detalle = 'Desde aqui parten todos los heroes.';
    } else {
        img.src = getImagenHexagono('inicio');
        img.alt = 'Inicio';
        var dueno = hex.duenoId && playersData[hex.duenoId] ? playersData[hex.duenoId].name : '---';
        titulo = 'Inicio de <span>' + dueno.replace(/</g, '&lt;') + '</span>';
        detalle = '';
    }
    content.appendChild(img);

    var info = document.createElement('div');
    info.className = 'zoom-info';
    info.innerHTML = titulo;
    content.appendChild(info);
    if (detalle) {
        var det = document.createElement('div');
        det.className = 'zoom-stats';
        det.textContent = detalle;
        det.style.whiteSpace = 'pre-line';
        content.appendChild(det);
    }

    // Jugadores presentes
    var aqui = partida.orden.filter(function(pid) {
        return partida.jugadores[pid] && partida.jugadores[pid].posicion === hex.id;
    });
    if (aqui.length) {
        var quien = document.createElement('div');
        quien.className = 'zoom-stats';
        quien.textContent = 'Aqui: ' + aqui.map(function(pid) {
            return playersData[pid] ? playersData[pid].name : pid;
        }).join(', ');
        content.appendChild(quien);
    }

    // Acciones
    var miTurno = partida.iniciada && esMiTurno() && !partida.movido;
    var pasos = miTurno ? calcularAlcance(myId)[hex.id] : 0;
    if (pasos) {
        var btn = document.createElement('button');
        btn.className = 'btn-choose';
        btn.textContent = 'Avanzar aqui (' + pasos + (pasos === 1 ? ' paso)' : ' pasos)');
        btn.addEventListener('click', function() {
            cerrarZoom();
            moverJugador(hex.id); // si descubre un enemigo, se abre el combate solo
        });
        content.appendChild(btn);
    }
    var btnC = document.createElement('button');
    btnC.className = 'modal-btn btn-secondary';
    btnC.textContent = 'Cerrar';
    btnC.addEventListener('click', cerrarZoom);
    content.appendChild(btnC);

    modal.style.display = 'flex';
}

function abrirZoomHeroe(pid) {
    if (combatePendienteMio()) { abrirCombate(); return; }
    var j = partida.jugadores[pid];
    if (!j) {
        showNotice('Este jugador todavia no tiene un heroe.');
        return;
    }
    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    content.innerHTML = '';
    var img = document.createElement('img');
    img.src = getImagenHeroe(j.heroe);
    img.alt = getNombreHeroe(j.heroe);
    content.appendChild(img);
    var info = document.createElement('div');
    info.className = 'zoom-info';
    var nombre = (playersData[pid] ? playersData[pid].name : '---').replace(/</g, '&lt;');
    info.innerHTML = nombre + ' \u2014 <span>' + getNombreHeroe(j.heroe) + '</span>';
    content.appendChild(info);
    var btnC = document.createElement('button');
    btnC.className = 'modal-btn btn-secondary';
    btnC.textContent = 'Cerrar';
    btnC.addEventListener('click', cerrarZoom);
    content.appendChild(btnC);
    modal.style.display = 'flex';
}

// ===== COMBATE: el jugador que descubrio un enemigo debe elegir =====
var combateMostrado = null;

function combatePendienteMio() {
    return !!(partida.combate && partida.combate.pid === myId);
}

function abrirCombate() {
    var c = partida.combate;
    if (!c) return;
    var hex = buscarHex(c.hexId);
    if (!hex) return;
    var en = getEnemigo(hex.monstruo);
    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    content.innerHTML = '';

    var img = document.createElement('img');
    img.src = getImagenMonstruo(hex.monstruo);
    img.alt = 'Monstruo ' + hex.monstruo;
    content.appendChild(img);

    var info = document.createElement('div');
    info.className = 'zoom-info';
    info.innerHTML = 'Monstruo <span>#' + hex.monstruo + '</span> \u00b7 Nivel <span>' + en.nivel + '</span>';
    content.appendChild(info);

    var st = document.createElement('div');
    st.className = 'zoom-stats';
    st.style.whiteSpace = 'pre-line';
    st.textContent = 'Dano ' + en.dano + '\nRecompensa: ' + textoRecompensa(en);
    content.appendChild(st);

    var fila = document.createElement('div');
    fila.className = 'row-btns';
    fila.style.width = '100%';
    var bR = document.createElement('button');
    bR.className = 'modal-btn btn-outline';
    bR.textContent = 'Retirada (-' + en.dano + ' vida)';
    bR.addEventListener('click', retirarse);
    var bA = document.createElement('button');
    bA.className = 'modal-btn btn-danger';
    bA.textContent = 'Atacar';
    bA.addEventListener('click', atacar);
    fila.appendChild(bR);
    fila.appendChild(bA);
    content.appendChild(fila);

    combateMostrado = c.hexId;
    modal.style.display = 'flex';
}

// Se llama desde actualizarUI: abre el combate si me toca (tambien tras recargar)
function sincronizarModalCombate() {
    if (combatePendienteMio()) {
        if (combateMostrado !== partida.combate.hexId) abrirCombate();
    } else if (combateMostrado !== null) {
        // El combate se resolvio (p. ej. el anfitrion me retiro): cerrar el modal
        combateMostrado = null;
        var m = document.getElementById('zoomModal');
        if (m) m.style.display = 'none';
    }
}

function cerrarZoom() {
    if (combatePendienteMio()) return; // no se puede cerrar sin elegir
    var modal = document.getElementById('zoomModal');
    if (modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    var modal = document.getElementById('zoomModal');
    modal.addEventListener('click', function(e) {
        if (e.target === modal) cerrarZoom();
    });
});
window.abrirZoomHex = abrirZoomHex;
window.abrirZoomHeroe = abrirZoomHeroe;
window.cerrarZoom = cerrarZoom;

window.abrirCombate = abrirCombate;
window.sincronizarModalCombate = sincronizarModalCombate;
