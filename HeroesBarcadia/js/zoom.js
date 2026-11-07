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
            var ct = getContenidoHex(hex);
            img.src = ct.imagen;
            img.alt = ct.titulo;
            titulo = ct.titulo.replace(/</g, '&lt;');
            detalle = descripcionContenido(ct, hex);
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
    var op = (partida.iniciada && esMiTurno()) ? calcularOpciones(myId) : { mover: {}, entrar: {} };
    if (op.mover[hex.id]) {
        var pasos = op.mover[hex.id];
        var btn = document.createElement('button');
        btn.className = 'btn-choose';
        btn.textContent = 'Moverme aqui (' + pasos + (pasos === 1 ? ' paso)' : ' pasos)');
        btn.addEventListener('click', function() {
            cerrarZoom();
            moverJugador(hex.id);
        });
        content.appendChild(btn);
    } else if (op.entrar[hex.id]) {
        var btnE = document.createElement('button');
        btnE.className = 'btn-choose';
        btnE.textContent = 'Entrar';
        btnE.addEventListener('click', function() {
            cerrarZoom();
            entrarHex(hex.id); // revela al enemigo y abre el combate
        });
        content.appendChild(btnE);
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

function descripcionContenido(ct, hex) {
    var lineas = [];
    if (ct.combate) {
        lineas.push('Nivel ' + ct.nivelTxt + ' \u00b7 Dano ' + ct.dano);
        lineas.push('Recompensa: ' + textoRecompensa(ct));
        if (ct.requierePot) lineas.push('Requiere ' + ct.requierePot + ' Potenciadores en la mano');
        if (hex && hex.despejado) lineas.push('Derrotado');
    } else if (ct.clase === 'recompensa') {
        lineas.push(textoRecompensa(ct));
        if (hex && hex.despejado) lineas.push('Ya recogida');
    } else if (ct.clase === 'portal') {
        lineas.push('Portal Magico');
    }
    return lineas.join('\n');
}

// Cambia cuando algo que afecta al combate cambia (nivel, bono, salud, cartas)
function claveCombate() {
    var c = partida.combate;
    if (!c) return null;
    var j = partida.jugadores[myId];
    return c.hexId + '|' + (c.nivelMod || 0) + '|' + (j ? (j.manoPot || []).join(',') + '|' + (j.manoBotin || []).length + '|' + getVida(j) : '');
}

function abrirCombate() {
    var c = partida.combate;
    if (!c) return;
    var hex = buscarHex(c.hexId);
    if (!hex) return;
    var ct = getContenidoHex(hex);
    var j = partida.jugadores[myId];
    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    content.innerHTML = '';

    var img = document.createElement('img');
    img.src = ct.imagen;
    img.alt = ct.titulo;
    content.appendChild(img);

    var info = document.createElement('div');
    info.className = 'zoom-info';
    var mod = c.nivelMod || 0;
    var nivelTxt = ct.nivelTxt;
    if (ct.nivel !== undefined && mod) nivelTxt = ct.nivel + (mod > 0 ? ' +' : ' ') + mod + ' = ' + (ct.nivel + mod);
    else if (mod) nivelTxt += ' (' + (mod > 0 ? '+' : '') + mod + ')';
    info.innerHTML = ct.titulo.replace(/</g, '&lt;') + ' \u00b7 Nivel <span>' + nivelTxt + '</span>';
    content.appendChild(info);

    var st = document.createElement('div');
    st.className = 'zoom-stats';
    st.style.whiteSpace = 'pre-line';
    var txt = 'Dano ' + ct.dano;
    if (ct.clase !== 'guardian') txt += '\nRecompensa: ' + textoRecompensa(ct);
    var tengoPot = j ? (j.manoPot || []).length : 0;
    var faltaPot = !!(ct.requierePot && tengoPot < ct.requierePot);
    if (ct.requierePot) txt += '\nPara luchar necesitas ' + ct.requierePot + ' Potenciadores (tienes ' + tengoPot + ')';
    if (ct.clase === 'monstruo' || ct.clase === 'jefe') {
        var bono = calcularBonoAtaque(myId, ct);
        txt += '\nBono de ataque: ' + (bono.total > 0 ? '+' : '') + bono.total + (bono.fuentes.length ? ' (' + bono.fuentes.join(', ') + ')' : '');
    }
    st.textContent = txt;
    content.appendChild(st);

    var fila = document.createElement('div');
    fila.className = 'row-btns';
    fila.style.width = '100%';
    var bR = document.createElement('button');
    bR.className = 'modal-btn btn-outline';
    bR.textContent = 'Retirada (-' + ct.dano + ' vida)';
    bR.addEventListener('click', retirarse);
    var bA = document.createElement('button');
    bA.className = 'modal-btn btn-danger';
    bA.textContent = 'Atacar';
    bA.disabled = faltaPot;
    bA.addEventListener('click', atacar);
    fila.appendChild(bR);
    fila.appendChild(bA);
    content.appendChild(fila);

    var bAcc = document.createElement('button');
    bAcc.className = 'modal-btn btn-secondary';
    bAcc.textContent = 'Cartas y habilidades';
    bAcc.addEventListener('click', abrirAcciones);
    content.appendChild(bAcc);

    combateMostrado = claveCombate();
    modal.style.display = 'flex';
}

function nombreJugador(pid) {
    return playersData[pid] ? playersData[pid].name : '---';
}

// ===== FIN DEL JUEGO =====
var victoriaMostrada = null;
function sincronizarVictoria() {
    if (!partida.ganador) { victoriaMostrada = null; return; }
    if (victoriaMostrada === partida.ganador) return;
    victoriaMostrada = partida.ganador;
    cerrarZoom();
    var yo = partida.ganador === myId;
    showNotice(yo ? 'Derrotaste al Guardian de la Bebida. Ganaste el juego!'
                  : nombreJugador(partida.ganador) + ' derroto al Guardian de la Bebida y gano el juego.',
               'Fin del juego');
}

// Se llama desde actualizarUI: abre el combate si me toca (tambien tras recargar)
function sincronizarModalCombate() {
    if (combatePendienteMio()) {
        if (combateMostrado !== claveCombate()) abrirCombate();
    } else if (combateMostrado !== null) {
        // El combate se resolvio (p. ej. el anfitrion me retiro): cerrar el modal
        combateMostrado = null;
        var m = document.getElementById('zoomModal');
        if (m) m.style.display = 'none';
    }
}

// ===== VER UNA CARTA (Botin, Potenciador o Regla) =====
function abrirZoomCarta(tipo, n, mia) {
    if (combatePendienteMio() && !mia) { abrirCombate(); return; }
    var info = getInfoCarta(tipo, n);
    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    content.innerHTML = '';
    var img = document.createElement('img');
    img.src = info.imagen;
    img.alt = info.titulo;
    content.appendChild(img);
    var t = document.createElement('div');
    t.className = 'zoom-info';
    t.textContent = info.titulo;
    content.appendChild(t);
    var textos = [info.momento, info.texto].filter(function(x) { return !!x; });
    textos.forEach(function(tx, i) {
        var d = document.createElement('div');
        d.className = 'zoom-stats';
        d.textContent = tx;
        if (i === 0 && info.momento) d.style.fontWeight = 'bold';
        content.appendChild(d);
    });
    if (mia && tipo === 'botin') {
        var bU = document.createElement('button');
        bU.className = 'btn-choose';
        bU.textContent = 'Usar carta (se descarta)';
        bU.addEventListener('click', function() { usarBotin(n); });
        content.appendChild(bU);
    }
    if (mia && tipo === 'potenciador') {
        if (POT_USABLES.indexOf(n) !== -1) {
            var bP = document.createElement('button');
            bP.className = 'btn-choose';
            bP.textContent = 'Usar (una vez por turno)';
            bP.addEventListener('click', function() { usarPot(n); });
            content.appendChild(bP);
        }
        var bD = document.createElement('button');
        bD.className = 'modal-btn btn-outline';
        bD.textContent = 'Descartar';
        bD.addEventListener('click', function() { descartarPot(n); });
        content.appendChild(bD);
    }
    var btnC = document.createElement('button');
    btnC.className = 'modal-btn btn-secondary';
    btnC.textContent = 'Cerrar';
    btnC.addEventListener('click', mia ? cerrarOVolver : cerrarZoom);
    content.appendChild(btnC);
    modal.style.display = 'flex';
}

// ===== RECOMPENSA tras derrotar a un enemigo =====
function abrirRecompensa(r) {
    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    content.innerHTML = '';
    var t = document.createElement('div');
    t.className = 'zoom-info';
    t.innerHTML = '<span>' + (r.titulo || 'Victoria').replace(/</g, '&lt;') + '</span>';
    content.appendChild(t);
    if (r.extra) {
        var ex = document.createElement('div');
        ex.className = 'zoom-stats';
        ex.textContent = r.extra;
        content.appendChild(ex);
    }

    var cartas = [];
    r.botin.forEach(function(n) { cartas.push(['botin', n]); });
    r.potenciadores.forEach(function(n) { cartas.push(['potenciador', n]); });
    var d = document.createElement('div');
    d.className = 'zoom-stats';
    d.textContent = r.enemigo.clase === 'portal' ? 'Portal Magico descubierto (todavia sin efecto).'
        : (cartas.length ? 'Recompensa: ' + textoRecompensa(r.enemigo) : 'Sin recompensa');
    content.appendChild(d);

    var faltan = (r.enemigo.botin - r.botin.length) + (r.enemigo.potenciadores - r.potenciadores.length);
    if (faltan > 0) {
        var f = document.createElement('div');
        f.className = 'zoom-stats';
        f.textContent = 'El mazo se agoto: faltaron ' + faltan + ' carta(s).';
        content.appendChild(f);
    }
    if (cartas.length) {
        var fila = document.createElement('div');
        fila.className = 'recompensa-fila';
        cartas.forEach(function(c) {
            var im = document.createElement('img');
            var info = getInfoCarta(c[0], c[1]);
            im.src = info.imagen;
            im.alt = info.titulo;
            im.addEventListener('click', function() { abrirZoomCarta(c[0], c[1]); });
            fila.appendChild(im);
        });
        content.appendChild(fila);
    }
    var btn = document.createElement('button');
    btn.className = 'modal-btn btn-primary';
    btn.textContent = 'Continuar';
    btn.addEventListener('click', function() { cerrarZoom(); sincronizarDescarte(); });
    content.appendChild(btn);
    modal.style.display = 'flex';
}

// ===== REGLAS ACTIVAS (el anfitrion puede sacar la siguiente) =====
function abrirReglas() {
    if (combatePendienteMio()) { abrirCombate(); return; }
    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    content.innerHTML = '';
    var t = document.createElement('div');
    t.className = 'zoom-info';
    t.innerHTML = '<span>Reglas activas</span>';
    content.appendChild(t);

    if (!partida.reglasActivas.length) {
        var v = document.createElement('div');
        v.className = 'empty-message';
        v.textContent = 'Todavia no hay reglas activas.';
        content.appendChild(v);
    }
    partida.reglasActivas.forEach(function(n) {
        var info = getInfoCarta('regla', n);
        var fila = document.createElement('div');
        fila.className = 'regla-fila';
        var im = document.createElement('img');
        im.src = info.imagen;
        im.alt = info.titulo;
        im.addEventListener('click', function() { abrirZoomCarta('regla', n); });
        fila.appendChild(im);
        var tx = document.createElement('div');
        tx.className = 'regla-texto';
        var h = document.createElement('b');
        h.textContent = info.titulo;
        tx.appendChild(h);
        var p = document.createElement('span');
        p.textContent = info.texto;
        tx.appendChild(p);
        fila.appendChild(tx);
        content.appendChild(fila);
    });

    if (soyAnfitrionOLocal() && partida.iniciada) {
        var restantes = partida.mazos.reglas.length;
        var btn = document.createElement('button');
        btn.className = 'btn-choose';
        btn.textContent = 'Sacar regla (quedan ' + restantes + ')';
        btn.disabled = restantes === 0;
        btn.addEventListener('click', sacarRegla);
        content.appendChild(btn);
    }
    var btnC = document.createElement('button');
    btnC.className = 'modal-btn btn-secondary';
    btnC.textContent = 'Cerrar';
    btnC.addEventListener('click', cerrarZoom);
    content.appendChild(btnC);
    modal.style.display = 'flex';
}

function cerrarZoom() {
    if (combatePendienteMio()) return; // no se puede cerrar sin elegir
    if (typeof descarteForzadoPendiente === 'function' && descarteForzadoPendiente()) return;
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
window.abrirZoomCarta = abrirZoomCarta;
window.abrirRecompensa = abrirRecompensa;
window.abrirReglas = abrirReglas;
window.sincronizarVictoria = sincronizarVictoria;
