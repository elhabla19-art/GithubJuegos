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
    if (op.rival && op.rival[hex.id]) {
        var rv = op.rival[hex.id];
        var bRt = document.createElement('button');
        bRt.className = 'btn-choose';
        bRt.textContent = 'Retar a ' + nom(rv.pid) + ' (' + rv.costo + (rv.costo === 1 ? ' paso)' : ' pasos)');
        bRt.addEventListener('click', function() { cerrarZoom(); retarJugador(hex.id); });
        content.appendChild(bRt);
    } else {
        // Un hexagono revelado sin completar ofrece Mover (solo pisarlo) y Entrar (luchar)
        if (op.mover[hex.id]) {
            var pasos = op.mover[hex.id];
            var btn = document.createElement('button');
            btn.className = 'btn-choose';
            btn.textContent = 'Mover (' + pasos + (pasos === 1 ? ' paso)' : ' pasos)') + ((hex.trampas || 0) > 0 ? ' \u2013 con trampa' : '');
            btn.addEventListener('click', function() {
                cerrarZoom();
                moverJugador(hex.id);
            });
            content.appendChild(btn);
        }
        if (op.entrar[hex.id]) {
            var btnE = document.createElement('button');
            btnE.className = 'btn-choose';
            btnE.textContent = 'Entrar';
            btnE.addEventListener('click', function() {
                cerrarZoom();
                entrarHex(hex.id); // revela al enemigo y abre el combate
            });
            content.appendChild(btnE);
        } else if (op.entrarVia && op.entrarVia[hex.id]) {
            var via = op.entrarVia[hex.id];
            var btnV = document.createElement('button');
            btnV.className = 'btn-choose';
            btnV.textContent = 'Entrar' + (via.rival ? ' (retando antes a ' + nom(via.rival) + (via.trampa ? ', tras la trampa' : '') + ')'
                : (via.trampa ? ' (resolviendo antes la trampa)' : ' (moviendote antes)'));
            btnV.addEventListener('click', function() {
                cerrarZoom();
                entrarHex(hex.id);   // encadena: trampa, reto, movimiento y luego abre el hexagono
            });
            content.appendChild(btnV);
        }
    }
    // Potenciador 5 (pasivo): al elegir un hexagono oculto aparece "Potenciador" junto a Entrar
    var jz = partida.jugadores[myId];
    if (partida.iniciada && jz && hex.tipo === 'calabozo' && !hex.desbloqueado && esMiTurno() &&
        tienePot(jz, 5) && !yaUsadoTurno(jz, 'p5')) {
        var bPot5 = document.createElement('button');
        bPot5.className = 'btn-choose';
        bPot5.textContent = 'Potenciador';
        bPot5.addEventListener('click', function() { cerrarZoom(); usarPot5(hex.id); });
        content.appendChild(bPot5);
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
    return c.hexId + '|' + (c.nivelMod || 0) + (c.ventaja ? 'V' : '') + (c.desventaja ? 'D' : '') + '|' + (j ? (j.manoPot || []).join(',') + '|' + (j.manoBotin || []).length + '|' + getVida(j) : '');
}

// Modal del duelo contra otro jugador
function abrirCombateDuelo(c) {
    var rj = partida.jugadores[c.rivalId];
    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');
    content.innerHTML = '';
    var img = document.createElement('img');
    img.src = rj ? getImagenHeroe(rj.heroe) : '';
    img.alt = 'Rival';
    content.appendChild(img);
    var info = document.createElement('div');
    info.className = 'zoom-info';
    info.innerHTML = 'Duelo contra <span></span>';
    info.querySelector('span').textContent = nom(c.rivalId);
    content.appendChild(info);
    var st = document.createElement('div');
    st.className = 'zoom-stats';
    st.textContent = 'El perdedor recibe 10 de dano.';
    content.appendChild(st);
    var yo = calcularBonoAtaque(myId, { clase: 'duelo' });
    var el = calcularBonoAtaque(c.rivalId, { clase: 'duelo' });
    [['Tu dado', yo], ['Dado de ' + nom(c.rivalId), el]].forEach(function(p) {
        if (!p[1].fuentes.length) return;
        var bd = document.createElement('div');
        bd.className = 'bono-dado' + (p[1].total < 0 ? ' negativo' : '');
        bd.innerHTML = '<b></b>';
        bd.querySelector('b').textContent = p[0] + ': ' + (p[1].total >= 0 ? '+' : '') + p[1].total;
        var fu = document.createElement('div');
        fu.className = 'bono-fuentes';
        fu.textContent = p[1].fuentes.join(' \u00b7 ');
        bd.appendChild(fu);
        content.appendChild(bd);
    });
    var fila = document.createElement('div');
    fila.className = 'row-btns';
    fila.style.width = '100%';
    var bR = document.createElement('button');
    bR.className = 'modal-btn btn-outline';
    bR.textContent = 'Retirarse (-10 vida)';
    bR.addEventListener('click', retirarse);
    var bA = document.createElement('button');
    bA.className = 'modal-btn btn-danger';
    bA.textContent = 'Atacar';
    bA.addEventListener('click', atacar);
    fila.appendChild(bR);
    fila.appendChild(bA);
    content.appendChild(fila);
    var bAcc = document.createElement('button');
    bAcc.className = 'modal-btn btn-secondary';
    bAcc.textContent = 'Cartas';
    bAcc.addEventListener('click', abrirAcciones);
    content.appendChild(bAcc);
    combateMostrado = claveCombate();
    modal.style.display = 'flex';
}

function abrirCombate() {
    var c = partida.combate;
    if (!c) return;
    if (c.tipo === 'duelo') { abrirCombateDuelo(c); return; }
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
    st.textContent = txt;
    content.appendChild(st);
    if (ct.clase === 'monstruo' || ct.clase === 'jefe') {
        var bono = calcularBonoAtaque(myId, ct);
        if (bono.fuentes.length) {
            var bd = document.createElement('div');
            bd.className = 'bono-dado' + (bono.total < 0 ? ' negativo' : '');
            bd.innerHTML = '<b>' + (bono.total >= 0 ? '+' : '') + bono.total + ' a tu dado</b>';
            var fu = document.createElement('div');
            fu.className = 'bono-fuentes';
            fu.textContent = bono.fuentes.join(' \u00b7 ');
            bd.appendChild(fu);
            content.appendChild(bd);
        }
    }

    if (c.ventaja || c.desventaja) {
        var vd = document.createElement('div');
        vd.className = 'bono-dado' + (c.desventaja ? ' negativo' : '');
        vd.innerHTML = '<b></b>';
        vd.querySelector('b').textContent = c.ventaja ? 'Ventaja: tira el dado dos veces y usa el mas alto' : 'Desventaja: tira el dado dos veces y usa el mas bajo';
        content.appendChild(vd);
    }
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
    bAcc.textContent = 'Cartas';
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
    // La carta ya dice cuando se usa y que hace: solo las Reglas muestran texto
    if (tipo === 'regla') {
        var t = document.createElement('div');
        t.className = 'zoom-info';
        t.textContent = info.titulo;
        content.appendChild(t);
        var d = document.createElement('div');
        d.className = 'zoom-stats';
        d.textContent = info.texto;
        content.appendChild(d);
    }
    if (mia && tipo === 'botin') {
        var bU = document.createElement('button');
        var razonB = botinDisponible(n);
        bU.className = 'btn-choose' + (razonB ? ' btn-bloqueado' : '');
        bU.textContent = 'Activar';
        bU.disabled = !!razonB;
        if (razonB) bU.title = razonB;
        bU.addEventListener('click', function() { usarBotin(n); });
        content.appendChild(bU);
        if (razonB) {
            var rz = document.createElement('div');
            rz.className = 'bono-fuentes';
            rz.textContent = razonB;
            content.appendChild(rz);
        }
    }
    if (mia && tipo === 'potenciador') {
        var jm = partida.jugadores[myId];
        var est = jm ? estadoPot(jm, n) : 'activo';
        var bP = document.createElement('button');
        if (est === 'usable') {
            var razonP = potDisponible(n);
            bP.className = 'btn-choose' + (razonP ? ' btn-bloqueado' : '');
            bP.textContent = 'Activar';
            bP.disabled = !!razonP;
            if (razonP) bP.title = razonP;
            bP.addEventListener('click', function() { usarPot(n); });
        } else {
            bP.className = 'btn-choose btn-pressed';
            bP.disabled = true;
            bP.textContent = est === 'activo' ? 'Activo' : (est === 'volteado' ? 'Boca abajo' : 'Activado este turno');
        }
        content.appendChild(bP);
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

    if (partida.iniciada) {
        var restantes = partida.mazos.reglas.length;
        var btn = document.createElement('button');
        btn.className = 'btn-choose';
        btn.textContent = 'Activar una regla al azar (quedan ' + restantes + ')';
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
    if (typeof pendienteForzadoPendiente === 'function' && pendienteForzadoPendiente()) return;
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
