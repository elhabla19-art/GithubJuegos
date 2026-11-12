// acciones.js
// ===== INTERFAZ PARA USAR CARTAS Y HABILIDADES =====
// Las reglas de cada efecto estan en efectos.js. Aqui solo se piden las
// elecciones (jugador, carta, hexagono) y se lanza la accion a todos.

var seleccionHex = null;   // { ids: {hexId:true}, cb } mientras se elige un hexagono en el tablero

// ===== AYUDAS DE MODAL =====
function abrirContenido(fn) {
    var m = document.getElementById('zoomModal');
    var c = document.getElementById('zoomContent');
    c.innerHTML = '';
    fn(c);
    m.style.display = 'flex';
}
function ocultarModal() {
    var m = document.getElementById('zoomModal');
    if (m) m.style.display = 'none';
}
function modalVisible() {
    var m = document.getElementById('zoomModal');
    return !!m && m.style.display === 'flex';
}
function descarteForzadoPendiente() {
    var j = partida.jugadores[myId];
    return !!(partida.iniciada && j && (j.manoPot || []).length > maxPot(j));
}
function cerrarOVolver() {
    if (combatePendienteMio()) { abrirCombate(); return; }
    ocultarModal();
    sincronizarDescarte();
    sincronizarPendiente();
}
function finAccionUI() {
    if (combatePendienteMio()) abrirCombate();
    else if (!(modalVisible() && document.querySelector('#zoomContent .descarte-forzado'))) ocultarModal();
    sincronizarDescarte();
    sincronizarPendiente();
}
function elTitulo(c, texto) {
    var t = document.createElement('div');
    t.className = 'zoom-info';
    var s = document.createElement('span');
    s.textContent = texto;
    t.appendChild(s);
    c.appendChild(t);
}
function elTexto(c, texto) {
    var d = document.createElement('div');
    d.className = 'zoom-stats';
    d.style.whiteSpace = 'pre-line';
    d.textContent = texto;
    c.appendChild(d);
}
function elBoton(c, texto, clase, fn) {
    var b = document.createElement('button');
    b.className = 'modal-btn ' + clase;
    b.textContent = texto;
    b.addEventListener('click', fn);
    c.appendChild(b);
    return b;
}

function otrosJugadores() {
    return partida.orden.filter(function(pid) { return pid !== myId && partida.jugadores[pid]; });
}

function confirmar(titulo, texto, okTxt, fn) {
    abrirContenido(function(c) {
        elTitulo(c, titulo);
        elTexto(c, texto);
        elBoton(c, okTxt, 'btn-primary', fn);
        elBoton(c, 'Cancelar', 'btn-secondary', cerrarOVolver);
    });
}

// ===== SELECTORES =====
function elegirJugador(o) {
    if (!o.candidatos.length) { showNotice(o.vacio || 'No hay jugadores validos para elegir.'); return; }
    abrirContenido(function(c) {
        elTitulo(c, o.titulo);
        if (o.texto) elTexto(c, o.texto);
        o.candidatos.forEach(function(pid) {
            var j = partida.jugadores[pid];
            var b = elBoton(c, '', 'btn-outline', function() { o.cb(pid); });
            b.style.display = 'flex'; b.style.alignItems = 'center'; b.style.gap = '10px';
            var im = document.createElement('img');
            im.src = getImagenHeroe(j.heroe);
            im.style.cssText = 'width:36px;height:36px;border-radius:50%;object-fit:cover;max-height:none;';
            b.appendChild(im);
            var sp = document.createElement('span');
            sp.textContent = nom(pid) + ' \u00b7 ' + getNombreHeroe(j.heroe) + ' \u00b7 Vida ' + getVida(j);
            b.appendChild(sp);
        });
        elBoton(c, 'Cancelar', 'btn-secondary', cerrarOVolver);
    });
}

function elegirJugadores(o) {   // hasta o.max jugadores
    if (!o.candidatos.length) { showNotice('No hay jugadores validos para elegir.'); return; }
    var sel = {};
    abrirContenido(function(c) {
        elTitulo(c, o.titulo);
        elTexto(c, o.texto || ('Elige hasta ' + o.max + '.'));
        var botones = {};
        var ok;
        function actualizar() {
            var n = Object.keys(sel).length;
            ok.disabled = n < (o.min === undefined ? 1 : o.min) || n > o.max;
            o.candidatos.forEach(function(pid) { botones[pid].className = 'modal-btn ' + (sel[pid] ? 'btn-primary' : 'btn-outline'); });
        }
        o.candidatos.forEach(function(pid) {
            botones[pid] = elBoton(c, nom(pid) + ' \u00b7 Vida ' + getVida(partida.jugadores[pid]), 'btn-outline', function() {
                if (sel[pid]) delete sel[pid];
                else if (Object.keys(sel).length < o.max) sel[pid] = true;
                actualizar();
            });
        });
        ok = elBoton(c, 'Confirmar', 'btn-danger', function() { o.cb(Object.keys(sel)); });
        elBoton(c, 'Cancelar', 'btn-secondary', cerrarOVolver);
        actualizar();
    });
}

// items: [{ n: numeroDeCarta }]; se eligen o.cantidad cartas; cb recibe los numeros
function elegirCartas(o) {
    if (o.items.length < o.cantidad) { showNotice(o.vacio || 'No hay suficientes cartas para elegir.'); return; }
    var sel = {};
    abrirContenido(function(c) {
        elTitulo(c, o.titulo);
        if (o.texto) elTexto(c, o.texto);
        var grid = document.createElement('div');
        grid.className = 'mano-container';
        c.appendChild(grid);
        var ok;
        var cartas = [];
        function actualizar() {
            ok.disabled = Object.keys(sel).length !== o.cantidad;
            cartas.forEach(function(el, i) { el.classList.toggle('carta-sel', !!sel[i]); });
        }
        o.items.forEach(function(it, i) {
            var info = getInfoCarta(o.tipo, it.n);
            var d = document.createElement('div');
            d.className = 'carta-mini';
            d.style.width = '80px';
            var im = document.createElement('img');
            im.src = info.imagen;
            im.alt = info.titulo;
            d.appendChild(im);
            d.addEventListener('click', function() {
                if (sel[i]) delete sel[i];
                else if (Object.keys(sel).length < o.cantidad) sel[i] = true;
                actualizar();
            });
            grid.appendChild(d);
            cartas.push(d);
        });
        ok = elBoton(c, 'Confirmar', 'btn-danger', function() {
            o.cb(Object.keys(sel).map(function(i) { return o.items[i].n; }));
        });
        if (!o.sinCancelar) elBoton(c, 'Cancelar', 'btn-secondary', cerrarOVolver);
        actualizar();
    });
    return true;
}

// Par o impar (el dado se tira fuera de la pagina). o.noQuiero agrega la opcion de no usarlo.
function elegirParImpar(o) {
    abrirContenido(function(c) {
        elTitulo(c, o.titulo);
        if (o.texto) elTexto(c, o.texto);
        elBoton(c, 'Salio par', 'btn-primary', function() { o.cb('par'); });
        elBoton(c, 'Salio impar', 'btn-outline', function() { o.cb('impar'); });
        if (o.noQuiero) elBoton(c, 'No quiero hacerlo', 'btn-secondary', function() { o.cb('no'); });
        else elBoton(c, 'Cancelar', 'btn-secondary', cerrarOVolver);
    });
}

// Ordenar cartas tocandolas en el orden deseado (1 = la primera)
function elegirOrden(o) {
    var orden = [];
    abrirContenido(function(c) {
        elTitulo(c, o.titulo);
        if (o.texto) elTexto(c, o.texto);
        var grid = document.createElement('div');
        grid.className = 'mano-container';
        c.appendChild(grid);
        var ok;
        var els = [];
        function actualizar() {
            ok.disabled = orden.length !== o.items.length;
            els.forEach(function(el, i) {
                var pos = orden.indexOf(i);
                el.classList.toggle('carta-sel', pos !== -1);
                el.querySelector('.carta-mini-badge').textContent = pos === -1 ? '' : String(pos + 1);
                el.querySelector('.carta-mini-badge').style.display = pos === -1 ? 'none' : '';
            });
        }
        o.items.forEach(function(n, i) {
            var info = getInfoCarta(o.tipo, n);
            var d = document.createElement('div');
            d.className = 'carta-mini';
            d.style.width = '80px';
            var im = document.createElement('img');
            im.src = info.imagen;
            im.alt = info.titulo;
            d.appendChild(im);
            var b = document.createElement('div');
            b.className = 'carta-mini-badge';
            d.appendChild(b);
            d.addEventListener('click', function() {
                var p = orden.indexOf(i);
                if (p !== -1) orden.splice(p, 1); else orden.push(i);
                actualizar();
            });
            grid.appendChild(d);
            els.push(d);
        });
        ok = elBoton(c, 'Confirmar orden', 'btn-danger', function() { o.cb(orden.map(function(i) { return o.items[i]; })); });
        elBoton(c, 'Cancelar', 'btn-secondary', cerrarOVolver);
        actualizar();
    });
}

// Elegir un hexagono directamente en el tablero
function elegirHex(o) {
    if (!o.ids.length) { showNotice(o.vacio || 'No hay hexagonos validos para elegir.'); return; }
    var mapa = {};
    o.ids.forEach(function(id) { mapa[id] = true; });
    seleccionHex = {
        ids: mapa,
        onCancel: o.onCancel || null,
        cb: function(id) { cancelarSeleccionHex(true); o.cb(id); }
    };
    ocultarModal();
    var banner = document.getElementById('seleccionBanner');
    document.getElementById('seleccionTexto').textContent = o.titulo;
    if (banner) banner.style.display = 'flex';
    renderizarTablero();
}
// Elegir una celda libre del tablero (para recolocar una habitacion)
function elegirCelda(o) {
    if (!o.celdas.length) { showNotice(o.vacio || 'No hay ubicaciones validas.'); return; }
    var mapa = {};
    o.celdas.forEach(function(c) { mapa[c.id] = c; });
    seleccionHex = {
        ids: {},
        fantasmas: mapa,
        onCancel: o.onCancel || null,
        cb: function(id) { var c = mapa[id]; cancelarSeleccionHex(true); o.cb(c); }
    };
    ocultarModal();
    var banner = document.getElementById('seleccionBanner');
    document.getElementById('seleccionTexto').textContent = o.titulo;
    if (banner) banner.style.display = 'flex';
    renderizarTablero();
}
function cancelarSeleccionHex(sinVolver) {
    var alCancelar = seleccionHex && seleccionHex.onCancel;
    seleccionHex = null;
    var banner = document.getElementById('seleccionBanner');
    if (banner) banner.style.display = 'none';
    renderizarTablero();
    if (!sinVolver) { if (alCancelar) alCancelar(); else cerrarOVolver(); }
}
window.cancelarSeleccionHex = cancelarSeleccionHex;

// Vistazo privado a un hexagono oculto (Botin 15): no cambia nada
function abrirVistazo(hexId) {
    var h = buscarHex(hexId);
    if (!h) return;
    var ct = getContenidoHex(h);
    abrirContenido(function(c) {
        elTitulo(c, 'Vistazo secreto');
        var im = document.createElement('img');
        im.src = ct.imagen;
        im.alt = ct.titulo;
        c.appendChild(im);
        elTexto(c, ct.titulo + '\n' + descripcionContenido(ct, null) + '\n(Solo tu lo ves; la habitacion sigue boca abajo.)');
        elBoton(c, 'Cerrar', 'btn-secondary', cerrarOVolver);
    });
}

// ===== EJECUTAR UNA ACCION =====
function ejecutarAccion(tipo, n, params, despues) {
    if (!aplicarAccion(tipo, myId, n, params, siguienteVersion())) {
        showNotice('No se pudo aplicar la accion (el estado cambio).');
        finAccionUI();
        return;
    }
    broadcastAccion(tipo, n, params, partida.version);
    actualizarUI();
    saveSession();
    finAccionUI();
    if (despues) despues();
}

// ===== BOTIN =====
function hexesDesocupadosLibres() {
    var oc = hexesOcupados();
    return partida.hexes.filter(function(h) { return hexRevelado(h) && h.clase !== 'guardian' && !oc[h.id] && !(h.trampas > 0); }).map(function(h) { return h.id; });
}

// Contenido del enemigo del combate propio (monstruo, jefe o guardian), o null
function contenidoCombate() {
    var c = partida.combate;
    if (!c || c.tipo === 'duelo') return null;
    var h = buscarHex(c.hexId);
    return h ? getContenidoHex(h) : null;
}

// Por que NO se puede activar una carta de Botin ahora (null = se puede)
function botinDisponible(n) {
    var j = partida.jugadores[myId];
    if (!j || !partida.iniciada || !DATOS_BOTIN[n]) return 'Aun no participas.';
    if (partida.ganador) return 'La partida ya termino.';
    if (j.bloqueoBotin === 'enTurno') return 'Un oponente (Potenciador 12) te impide jugar Cartas botin en este turno.';
    var momento = DATOS_BOTIN[n][0];
    var c = partida.combate;
    var mio = esMiTurno();
    var ct = contenidoCombate();
    var combateMio = !!(ct && c.pid === myId);
    var combateAjeno = !!(ct && c.pid !== myId);
    var contenidoMio = combateMio ? ct.clase : null;

    if (momento === M_TURNO || momento === M_DURANTE) {
        if (!mio) return 'Solo se activa durante tu turno.';
    } else if (momento === M_OPONENTE) {
        if (!combateAjeno) return 'Solo se activa en el turno de un oponente, antes de que pelee.';
    } else if (momento === M_ENTRE) {
        if (mio) return 'Se activa entre turnos, cuando juega otro jugador.';
    }
    switch (n) {
        case 9: if (contenidoMio !== 'monstruo') return 'Solo antes de luchar contra un Monstruo.'; break;
        case 21: if (contenidoMio !== 'monstruo' && contenidoMio !== 'jefe') return 'Solo en una batalla contra un Monstruo o Jefe.'; break;
        case 26: if (contenidoMio !== 'monstruo') return 'Solo cuando revelas un Monstruo.'; break;
        case 33:
            if (contenidoMio !== 'monstruo' && contenidoMio !== 'jefe') return 'Solo contra un Monstruo o Jefe que acabas de revelar.';
            if (!otrosJugadores().length) return 'Necesitas otro jugador.';
            break;
        case 1: case 16: case 22:
            if (combateAjeno && ct.clase === 'guardian') return 'No afecta al Guardian.';
            break;
        case 2: if (partida.combate) return 'Resuelve primero el combate.'; break;
        case 10:
            if (partida.combate) return 'Resuelve primero el combate.';
            if (partida.movido) return 'Ya entraste a un hexagono este turno (cuenta como accion).';
            break;
        case 11:
            if (!(partida.ultimaRetirada && partida.ultimaRetirada.pid === myId)) return 'Solo justo despues de perder una batalla contra un Monstruo o Jefe.';
            break;
        case 20:
            if (!(partida.ultimoBotin && partida.ultimoBotin.pid !== myId)) return 'Solo justo despues de que un oponente juegue una Carta botin.';
            break;
    }
    return null;
}
window.botinDisponible = botinDisponible;

// Por que NO se puede activar un Potenciador manual ahora (null = se puede)
function potDisponible(n) {
    var j = partida.jugadores[myId];
    if (!j || !partida.iniciada) return 'Aun no participas.';
    if (partida.ganador) return 'La partida ya termino.';
    if (!tienePot(j, n)) return 'Esta boca abajo.';
    var fuera = POT_FUERA_DE_TURNO.indexOf(n) !== -1;
    if (!fuera && !esMiTurno()) return 'Solo se activa durante tu turno.';
    if (POT_SIN_LIMITE.indexOf(n) === -1 && yaUsadoTurno(j, 'p' + n)) return 'Ya lo activaste en este turno.';
    var ct = contenidoCombate();
    switch (n) {
        case 24: case 41: if (!partida.derrotoEnTurno) return 'Solo despues de derrotar a un Monstruo en este turno.'; break;
        case 37: if (!cercaDePortal(myId)) return 'Debes estar en un Portal Magico o junto a uno.'; break;
        case 48: if ((j.manoBotin || []).length >= 2) return 'Solo con menos de 2 Cartas botin en la mano.'; break;
        case 60: if (!(ct && partida.combate.pid === myId && ct.clase === 'monstruo')) return 'Solo antes de luchar contra un Monstruo.'; break;
        case 22: if (!(j.manoBotin || []).length) return 'Necesitas una Carta botin para dar.'; break;
    }
    return null;
}
window.potDisponible = potDisponible;

// Muestra lo que se obtuvo al entrar a una habitacion por una carta (Botin 10 / 33)
function mostrarUltimaEntrada() {
    var u = partida.ultimaEntrada;
    if (!u || u.pid !== myId) return;
    partida.ultimaEntrada = null;
    abrirRecompensa(u);
}

function hexesParaTrampa(pid) {
    return partida.hexes.filter(function(h) { return puedeTrampa(h, pid); }).map(function(h) { return h.id; });
}

// Flujo de elecciones de una carta de Botin. fin(params, despues) lanza la accion.
function flujoBotin(n, fin) {
    var j = partida.jugadores[myId];
    var ops = otrosJugadores();
    var oc = hexesOcupados();
    switch (n) {
        case 3: case 28:
            elegirJugador({ titulo: n === 3 ? 'Inflige 10 de dano a...' : 'Intercambiar Cartas botin con...', candidatos: ops,
                cb: function(o) { fin({ objetivo: o }); } });
            break;
        case 4:
            elegirHex({ titulo: 'Elige la habitacion para la trampa (revelada y no ocupada por otro jugador)',
                ids: hexesParaTrampa(myId), vacio: 'No hay habitaciones validas para colocar una trampa.',
                cb: function(h0) {
                    if (!tienePot(j, 33)) { fin({ hex: h0 }); return; }
                    // Potenciador 33: 3 trampas en habitaciones distintas; las otras 2 adyacentes a la primera
                    var cand33 = vecinosDe(buscarHex(h0)).filter(function(h) { return puedeTrampa(h, myId); }).map(function(h) { return h.id; });
                    if (!cand33.length) { fin({ hex: h0, extra: [] }); return; }
                    elegirHex({ titulo: 'Potenciador 33: 2a trampa (adyacente a la primera)', ids: cand33,
                        cb: function(h1) {
                            var resto = cand33.filter(function(x) { return x !== h1; });
                            if (!resto.length) { fin({ hex: h0, extra: [h1] }); return; }
                            elegirHex({ titulo: 'Potenciador 33: 3a trampa (otra habitacion adyacente)', ids: resto,
                                cb: function(h2) { fin({ hex: h0, extra: [h1, h2] }); } });
                        } });
                } });
            break;
        case 10:
            elegirHex({ titulo: 'Revela una habitacion adyacente y muevete hacia ella',
                ids: vecinosDe(buscarHex(j.posicion)).filter(function(h) { return h.tipo === 'calabozo' && !h.desbloqueado; }).map(function(h) { return h.id; }),
                vacio: 'No hay habitaciones adyacentes sin revelar.',
                cb: function(h) { fin({ hex: h }, mostrarUltimaEntrada); } });
            break;
        case 11:
            confirmar('Botin 11', 'Acabas de perder una batalla contra un Monstruo o Jefe. Se ignora el resultado y los que participaron vuelven a tirar (la batalla se repite).',
                'Si, usarla', function() { fin({}); });
            break;
        case 12:
            elegirJugador({ titulo: 'Robar un Potenciador a...', vacio: 'Ningun oponente tiene Potenciadores.',
                candidatos: ops.filter(function(o) { return partida.jugadores[o].manoPot.length; }),
                cb: function(o) {
                    elegirCartas({ titulo: 'Potenciador de ' + nom(o), tipo: 'potenciador', cantidad: 1,
                        items: partida.jugadores[o].manoPot.map(function(x) { return { n: x }; }),
                        cb: function(nums) { fin({ objetivo: o, pot: Number(nums[0]) }); } });
                } });
            break;
        case 13:
            var cands13 = ops.filter(function(o) { return destinos13(o).length; });
            elegirJugador({ titulo: 'Mover a...', vacio: 'Ningun oponente tiene una habitacion adyacente valida.', candidatos: cands13,
                cb: function(o) {
                    elegirHex({ titulo: 'Elige la habitacion donde ira ' + nom(o), ids: destinos13(o),
                        cb: function(h) { fin({ objetivo: o, hex: h }); } });
                } });
            break;
        case 14:
            elegirJugador({ titulo: 'Robar una Carta botin (al azar) a...', vacio: 'Ningun oponente tiene Cartas botin.',
                candidatos: ops.filter(function(o) { return partida.jugadores[o].manoBotin.length; }),
                cb: function(o) { fin({ objetivo: o, idx: Math.floor(Math.random() * 1000) }); } });
            break;
        case 15:
            elegirHex({ titulo: 'Elige una habitacion sin revelar para echar un vistazo',
                ids: partida.hexes.filter(function(h) { return h.tipo === 'calabozo' && !h.desbloqueado; }).map(function(h) { return h.id; }),
                cb: function(h) { fin({ hex: h }, function() { abrirVistazo(h); }); } });
            break;
        case 17:
            elegirHex({ titulo: 'Elige una habitacion revelada, desocupada y sin trampas', ids: hexesDesocupadosLibres(),
                cb: function(h) { fin({ hex: h }); } });
            break;
        case 18:
            elegirHex({ titulo: 'Elige un Monstruo o Jefe derrotado (habitacion desocupada)',
                ids: partida.hexes.filter(function(h) {
                    if (h.tipo !== 'calabozo' || !h.desbloqueado || !h.despejado || oc[h.id]) return false;
                    var ct = getContenidoHex(h);
                    return ct.combate && ct.clase !== 'guardian';
                }).map(function(h) { return h.id; }),
                cb: function(h) { fin({ hex: h }); } });
            break;
        case 23:
            elegirJugadores({ titulo: 'Sanar 5 puntos a...', candidatos: ops, max: 3,
                cb: function(lista) { fin({ objetivos: lista }); } });
            break;
        case 24:
            var rnd24 = {};
            ops.forEach(function(o) { rnd24[o] = Math.floor(Math.random() * 1000); });
            elegirJugador({ titulo: 'Quien saco el numero mas alto?', texto: 'Cada oponente puso 1 Carta botin al centro (al azar). El ganador se queda con todas.',
                candidatos: [myId].concat(ops),
                cb: function(g) { fin({ rnd: rnd24, ganador: g }); } });
            break;
        case 25:
            elegirJugador({ titulo: 'Quien recibira el dano en tu lugar?', candidatos: ops,
                cb: function(o) {
                    abrirContenido(function(c) {
                        elTitulo(c, 'Cuanto dano ibas a recibir?');
                        elTexto(c, 'Recuperas ese dano y ' + nom(o) + ' lo recibe.');
                        [5, 10, 15, 20].forEach(function(m) { elBoton(c, String(m), 'btn-outline', function() { fin({ objetivo: o, monto: m }); }); });
                        elBoton(c, 'Cancelar', 'btn-secondary', cerrarOVolver);
                    });
                } });
            break;
        case 27:
            var otras = [];
            var saltada = false;
            j.manoBotin.forEach(function(x) {
                if (x === 27 && !saltada) { saltada = true; return; }   // esta misma carta
                otras.push({ n: x });
            });
            elegirCartas({ titulo: 'Descarta 2 Cartas botin mas', texto: 'Se descartan junto con esta carta y robas un Potenciador.',
                tipo: 'botin', cantidad: 2, items: otras, vacio: 'Necesitas otras 2 Cartas botin en tu mano.',
                cb: function(nums) { fin({ descartar: nums.map(Number) }); } });
            break;
        case 29:
            var rnd = {};
            ops.forEach(function(o) { rnd[o] = Math.floor(Math.random() * 1000); });
            fin({ rnd: rnd });
            break;
        case 30:
            elegirJugador({ titulo: 'Quien recibio mas dedos?', texto: 'Esa persona recibe 10 de dano.', candidatos: ops,
                cb: function(o) { fin({ objetivo: o }); } });
            break;
        case 31:
            elegirJugadores({ titulo: 'Quien sonrio o se rio primero?', texto: 'Recibe 10 de dano (si nadie lo hizo, confirma sin elegir).',
                candidatos: ops, max: 1, min: 0, cb: function(lista) { fin({ objetivos: lista }); } });
            break;
        case 32:
            flujoReubicar(function(hab, celda) { fin({ hex: hab, q: celda.q, r: celda.r }); }, null);
            break;
        case 33:
            elegirJugador({ titulo: 'Quien lucha contra el monstruo en tu lugar?', candidatos: ops,
                cb: function(o) {
                    abrirContenido(function(c) {
                        elTitulo(c, 'Resultado de ' + nom(o));
                        elTexto(c, 'Si gana, recibes la recompensa y ocupas la habitacion. Si pierde, recibe el dano por ti.');
                        elBoton(c, nom(o) + ' gano', 'btn-primary', function() { fin({ objetivo: o, gano: true }, mostrarUltimaEntrada); });
                        elBoton(c, nom(o) + ' perdio', 'btn-outline', function() { fin({ objetivo: o, gano: false }); });
                        elBoton(c, 'Cancelar', 'btn-secondary', cerrarOVolver);
                    });
                } });
            break;
        case 7:
            var intercambiables = partida.hexes.filter(function(h) {
                return h.tipo === 'calabozo' && !oc[h.id] && h.clase !== 'guardian';
            }).map(function(h) { return h.id; });
            elegirHex({ titulo: 'Intercambio: elige la 1a habitacion desocupada', ids: intercambiables,
                cb: function(a) {
                    elegirHex({ titulo: 'Ahora elige la 2a habitacion', ids: intercambiables.filter(function(x) { return x !== a; }),
                        cb: function(b) { fin({ a: a, b: b }); } });
                } });
            break;
        default:
            fin({});
    }
}

function usarBotin(n) {
    var razon = botinDisponible(n);
    if (razon) { showNotice(razon); return; }
    if (n === 20) {
        // Copia la ultima carta jugada por un oponente
        var n2 = partida.ultimoBotin.n;
        flujoBotin(n2, function(params, despues) { ejecutarAccion('botin', 20, { copia: n2, p: params }, despues); });
        return;
    }
    flujoBotin(n, function(params, despues) { ejecutarAccion('botin', n, params, despues); });
}
function destinos13(o) {
    var pos = buscarHex(partida.jugadores[o].posicion);
    var oc = hexesOcupados();
    return pos ? vecinosDe(pos).filter(function(h) { return hexRevelado(h) && h.clase !== 'guardian' && !oc[h.id] && !(h.trampas > 0); }).map(function(h) { return h.id; }) : [];
}
window.usarBotin = usarBotin;

// ===== POTENCIADORES =====
function usarPot(n) {
    var j = partida.jugadores[myId];
    if (!j || !tienePot(j, n)) return;
    var razonDisp = potDisponible(n);
    if (razonDisp) { showNotice(razonDisp); return; }
    var ops = otrosJugadores();
    function fin(params, despues) { ejecutarAccion('pot', n, params, despues); }
    var oc = hexesOcupados();

    switch (n) {
        case 2:
            elegirJugador({ titulo: 'Intercambiar con el Potenciador de...', vacio: 'Ningun oponente tiene Potenciadores.',
                candidatos: ops.filter(function(o) { return partida.jugadores[o].manoPot.length; }),
                cb: function(o) {
                    elegirCartas({ titulo: 'Potenciador de ' + nom(o), tipo: 'potenciador', cantidad: 1,
                        items: partida.jugadores[o].manoPot.map(function(x) { return { n: x }; }),
                        cb: function(nums) { fin({ objetivo: o, pot: Number(nums[0]) }); } });
                } });
            break;
        case 10:
            var mazoP = partida.mazos.potenciadores;
            if (!mazoP.length) { showNotice('No quedan Potenciadores en el mazo.'); return; }
            elegirCartas({ titulo: 'Elige un Potenciador del mazo (' + mazoP.length + ' restantes)',
                texto: 'El Topo vuelve al mazo y el mazo se baraja.', tipo: 'potenciador', cantidad: 1,
                items: mazoP.slice().sort(function(a, b) { return a - b; }).map(function(x) { return { n: x }; }),
                cb: function(nums) {
                    var elegido = Number(nums[0]);
                    var nuevo = mazoP.filter(function(x) { return x !== elegido; });
                    nuevo.push(10);
                    fin({ pot: elegido, nuevoMazo: mezclar(nuevo) });
                } });
            break;
        case 12:
            elegirParImpar({ titulo: 'Potenciador 12', texto: 'Tiraste el dado: salio par o impar?',
                cb: function(r) {
                    if (r !== 'par') { fin({ par: false }); return; }
                    var adj12 = vecinosDe(buscarHex(j.posicion)).map(function(h) { return h.id; });
                    elegirJugador({ titulo: 'Que oponente adyacente no podra jugar Cartas botin en su proximo turno?',
                        vacio: 'No hay oponentes en habitaciones adyacentes.',
                        candidatos: ops.filter(function(o) { return adj12.indexOf(partida.jugadores[o].posicion) !== -1; }),
                        cb: function(o) { fin({ par: true, objetivo: o }); } });
                } });
            break;
        case 14: case 45:
            elegirJugadores({ titulo: n === 14 ? 'Quienes NO se levantaron?' : 'Quienes NO te hicieron un cumplido?',
                texto: 'Selecciona a quienes no lo hicieron: reciben 5 de dano (puedes no elegir a nadie).',
                candidatos: ops, max: ops.length, min: 0,
                cb: function(lista) { fin({ objetivos: lista }); } });
            break;
        case 21:
            elegirJugador({ titulo: 'Un 20 en los dados: 10 de dano a...', candidatos: ops,
                cb: function(o) { fin({ objetivo: o }); } });
            break;
        case 22:
            elegirJugador({ titulo: 'Potenciador 22: a que oponente le das una Carta botin?', candidatos: ops,
                cb: function(o) {
                    elegirCartas({ titulo: 'Que Carta botin le das a ' + nom(o) + '?', tipo: 'botin', cantidad: 1,
                        items: j.manoBotin.map(function(x) { return { n: x }; }),
                        cb: function(cartaSel) {
                            elegirParImpar({ titulo: 'Dado de ' + nom(o), texto: 'Tira el dado: par = +4 de ataque, impar = +1.',
                                cb: function(r) { fin({ objetivo: o, carta: Number(cartaSel[0]), par: r === 'par' }); } });
                        } });
                } });
            break;
        case 23:
            if (j.manoBotin.length < 2) { showNotice('Necesitas al menos 2 Cartas botin en tu mano.'); return; }
            elegirCartas({ titulo: 'Devuelve 2 Cartas botin al mazo', texto: 'Luego robas 2 nuevas.', tipo: 'botin', cantidad: 2,
                items: j.manoBotin.map(function(x) { return { n: x }; }),
                cb: function(nums) {
                    var dev = nums.map(Number);
                    fin({ devolver: dev, nuevoMazo: mezclar(partida.mazos.botin.concat(dev)) });
                } });
            break;
        case 24:
            if (!partida.derrotoEnTurno) { showNotice('Solo puedes teletransportarte despues de derrotar a un Monstruo en este turno.'); return; }
            elegirHex({ titulo: 'Teletransportarte a una habitacion revelada, desocupada y sin trampas', ids: hexesDesocupadosLibres(),
                cb: function(h) { fin({ hex: h }); } });
            break;
        case 35:
            elegirHex({ titulo: 'Mira una habitacion adyacente sin revelar',
                ids: vecinosDe(buscarHex(j.posicion)).filter(function(h) { return h.tipo === 'calabozo' && !h.desbloqueado; }).map(function(h) { return h.id; }),
                vacio: 'No hay habitaciones adyacentes sin revelar.',
                cb: function(h) { fin({ hex: h }, function() { abrirVistazo(h); }); } });
            break;
        case 37:
            if (!cercaDePortal(myId)) { showNotice('Debes estar en un Portal Magico o en una habitacion adyacente a uno.'); return; }
            elegirHex({ titulo: 'Teletransportarte a una habitacion desocupada y sin trampas', ids: hexesDesocupadosLibres(),
                cb: function(h) { fin({ hex: h }); } });
            break;
        case 39:
            var ady = vecinosDe(buscarHex(j.posicion)).map(function(h) { return h.id; });
            elegirJugador({ titulo: '5 de dano a un oponente adyacente', vacio: 'No hay oponentes en habitaciones adyacentes.',
                candidatos: ops.filter(function(o) { return ady.indexOf(partida.jugadores[o].posicion) !== -1; }),
                cb: function(o) { fin({ objetivo: o }); } });
            break;
        case 41:
            if (!partida.derrotoEnTurno) { showNotice('Solo puedes usarlo despues de derrotar a un Monstruo en este turno.'); return; }
            elegirParImpar({ titulo: 'Potenciador 41', texto: 'Tiraste el dado: salio par o impar?', cb: function(r) { fin({ par: r === 'par' }); } });
            break;
        case 43:
            var origenes = partida.hexes.filter(function(h) {
                return h.tipo === 'calabozo' && h.desbloqueado && h.clase === 'recompensa' && h.numero === 3 && !oc[h.id];
            }).map(function(h) { return h.id; });
            elegirHex({ titulo: 'Elige una habitacion con un Potenciador', ids: origenes, vacio: 'No hay habitaciones reveladas con Potenciador (y desocupadas).',
                cb: function(a) {
                    elegirHex({ titulo: 'Elige la habitacion adyacente con la que intercambiar',
                        ids: vecinosDe(buscarHex(a)).filter(function(h) { return h.tipo === 'calabozo' && h.clase !== 'guardian' && !oc[h.id]; }).map(function(h) { return h.id; }),
                        cb: function(b) { fin({ a: a, b: b }); } });
                } });
            break;
        case 48:
            if (j.manoBotin.length >= 2) { showNotice('Solo puedes usarlo con menos de 2 Cartas botin en la mano.'); return; }
            elegirJugador({ titulo: 'Pedir una Carta botin (al azar) a...', vacio: 'Ningun oponente tiene Cartas botin.',
                candidatos: ops.filter(function(o) { return partida.jugadores[o].manoBotin.length; }),
                cb: function(o) { fin({ objetivo: o, idx: Math.floor(Math.random() * 1000) }); } });
            break;
        case 50:
            elegirParImpar({ titulo: 'Potenciador 50', texto: 'Tiraste el dado: salio par o impar?',
                cb: function(r) {
                    if (r !== 'par') { fin({ par: false }); return; }
                    elegirJugador({ titulo: 'Voltear el Potenciador de...', vacio: 'Ningun oponente tiene Potenciadores.',
                        candidatos: ops.filter(function(o) { return partida.jugadores[o].manoPot.length; }),
                        cb: function(o) {
                            elegirCartas({ titulo: 'Potenciador de ' + nom(o), tipo: 'potenciador', cantidad: 1,
                                items: partida.jugadores[o].manoPot.map(function(x) { return { n: x }; }),
                                cb: function(nums) { fin({ par: true, objetivo: o, pot: Number(nums[0]) }); } });
                        } });
                } });
            break;
        case 54:
            var top5 = partida.mazos.botin.slice(0, 5);
            if (!top5.length) { showNotice('No quedan Cartas botin en el mazo.'); return; }
            elegirOrden({ titulo: 'Primeras ' + top5.length + ' Cartas botin del mazo', texto: 'Toca las cartas en el orden en que quieres que queden (1 = la de arriba).',
                tipo: 'botin', items: top5, cb: function(orden) { fin({ orden: orden }); } });
            break;
        case 55:
            elegirParImpar({ titulo: 'Potenciador 55', texto: 'Tiraste el dado: salio par o impar?',
                cb: function(r) {
                    if (r !== 'par') { fin({ par: false }); return; }
                    elegirJugador({ titulo: 'Robar las cartas Trampa de...', candidatos: ops,
                        cb: function(o) { fin({ par: true, objetivo: o }); } });
                } });
            break;
        case 57:
            elegirParImpar({ titulo: 'Potenciador 57', texto: 'Tiraste el dado: salio par o impar?',
                cb: function(r) {
                    if (r !== 'par') { fin({ par: false }); return; }
                    var adj = vecinosDe(buscarHex(j.posicion)).map(function(h) { return h.id; });
                    elegirJugador({ titulo: 'Intercambiar lugar con...', vacio: 'No hay oponentes en habitaciones adyacentes.',
                        candidatos: ops.filter(function(o) { return adj.indexOf(partida.jugadores[o].posicion) !== -1; }),
                        cb: function(o) { fin({ par: true, objetivo: o }); } });
                } });
            break;
        case 60:
            if (!combatePendienteMio() || partida.combate.tipo === 'duelo') { showNotice('Se usa cuando estas a punto de luchar contra un Monstruo.'); return; }
            elegirCartas({ titulo: 'Descarta una Carta botin', texto: 'El Monstruo pierde 3 de Nivel en esta batalla.',
                tipo: 'botin', cantidad: 1, vacio: 'No tienes Cartas botin.',
                items: j.manoBotin.map(function(x) { return { n: x }; }),
                cb: function(nums) { fin({ descartar: Number(nums[0]) }); } });
            break;
        default:
            fin({});
    }
}

// Potenciador 5 (pasivo): al elegir un hexagono oculto aparece la opcion "Potenciador"
function usarPot5(hexId) {
    var j = partida.jugadores[myId];
    if (!j || !tienePot(j, 5)) return;
    if (!esMiTurno()) { showNotice('Este Potenciador se usa durante tu turno.'); return; }
    if (yaUsadoTurno(j, 'p5')) { showNotice('Ya usaste este Potenciador en este turno.'); return; }
    ejecutarAccion('pot', 5, { hex: hexId }, function() { abrirVistazo(hexId); });
}
window.usarPot5 = usarPot5;
window.usarPot = usarPot;

function descartarPot(n) {
    confirmar('Descartar Potenciador #' + n, 'Quedara abandonado en la mazmorra. ' + (DATOS_POTENCIADORES[n] || ''), 'Descartar',
        function() { ejecutarAccion('desc', null, { nums: [n] }); });
}
window.descartarPot = descartarPot;

// Maximo de Potenciadores (3, o 4 con el #4): al pasarte hay que descartar
function abrirDescarteForzado() {
    var j = partida.jugadores[myId];
    if (!j) return;
    if (seleccionHex) cancelarSeleccionHex(true);
    var k = j.manoPot.length - maxPot(j);
    elegirCartas({
        titulo: 'Demasiados Potenciadores',
        texto: 'Solo puedes tener ' + maxPot(j) + '. Elige ' + k + ' para descartar; los demas te los quedas.',
        tipo: 'potenciador', cantidad: k, sinCancelar: true,
        items: j.manoPot.map(function(x) { return { n: x }; }),
        cb: function(nums) { ejecutarAccion('desc', null, { nums: nums.map(Number), forzado: true }); }
    });
    var marca = document.createElement('div');
    marca.className = 'descarte-forzado';
    marca.style.display = 'none';
    document.getElementById('zoomContent').appendChild(marca);
}
function sincronizarDescarte() {
    if (!descarteForzadoPendiente()) return;
    if (modalVisible() && document.querySelector('#zoomContent .descarte-forzado')) return;
    abrirDescarteForzado();
}
window.sincronizarDescarte = sincronizarDescarte;
window.descarteForzadoPendiente = descarteForzadoPendiente;

// ===== HABILIDAD DEL HEROE =====
function crearBotonHabilidad() {
    var j = partida.jugadores[myId];
    if (!j) return null;
    var cfg = null;
    var combateMonstruo = false;
    if (combatePendienteMio() && partida.combate.tipo !== 'duelo') {
        var hx = buscarHex(partida.combate.hexId);
        combateMonstruo = !!hx && getContenidoHex(hx).clase === 'monstruo';
    }
    switch (j.heroe) {
        case 1:
            cfg = { t: 'Intercambiar Potenciador', ok: j.manoPot.length > 0 && partida.descartePot.length > 0,
                fn: function() {
                    elegirCartas({ titulo: 'Tu Potenciador a entregar', tipo: 'potenciador', cantidad: 1,
                        items: j.manoPot.map(function(x) { return { n: x }; }),
                        cb: function(mio) {
                            elegirCartas({ titulo: 'Potenciador abandonado a tomar', tipo: 'potenciador', cantidad: 1,
                                items: partida.descartePot.map(function(x) { return { n: x }; }),
                                cb: function(ab) { ejecutarAccion('hab', 'h1', { mio: Number(mio[0]), ab: Number(ab[0]) }); } });
                        } });
                } };
            break;
        case 3:
            cfg = { t: 'Tirar dado (salud en 0)', ok: getVida(j) === 0 && !(j.usos && j.usos.h3),
                fn: function() {
                    abrirContenido(function(c) {
                        elTitulo(c, 'Heroe 3: tira el dado');
                        elTexto(c, 'Tira el dado en la mesa. Que salio?');
                        elBoton(c, 'Salio par', 'btn-primary', function() { ejecutarAccion('hab', 'h3', { par: true }); });
                        elBoton(c, 'Salio impar', 'btn-outline', function() { ejecutarAccion('hab', 'h3', { par: false }); });
                        elBoton(c, 'Cancelar', 'btn-secondary', cerrarOVolver);
                    });
                } };
            break;
        case 5:
            cfg = { t: 'Teletransportar al inicio', ok: esMiTurno() && !partida.combate && !partida.ganador && !(j.usos && j.usos.h5) && !inicioOcupado(j),
                fn: function() { confirmar('Heroe 5', 'Vuelves a tu punto inicial. Solo puedes hacerlo una vez en el juego.', 'Teletransportarme',
                    function() { ejecutarAccion('hab', 'h5', {}); }); } };
            break;
        case 7:
            cfg = { t: 'Sanar 5 (salio par)', ok: true,
                fn: function() { confirmar('Heroe 7', 'Un oponente uso una Carta botin para curarse y en tu dado salio un numero par: te sanas 5 puntos.', 'Sanarme 5',
                    function() { ejecutarAccion('hab', 'h7', {}); }); } };
            break;
        case 8:
            cfg = { t: 'Cantar (-1 Nivel)', ok: combateMonstruo && !yaUsadoTurno(j, 'h8'),
                fn: function() { confirmar('Heroe 8', 'Cantas al Monstruo: pierde 1 Nivel solo en esta batalla (una vez por turno).', 'Cantar',
                    function() { ejecutarAccion('hab', 'h8', {}); }); } };
            break;
    }
    if (!cfg) return null;
    var b = document.createElement('button');
    b.className = 'modal-btn btn-secondary';
    b.textContent = cfg.t;
    b.disabled = !cfg.ok;
    b.addEventListener('click', cfg.fn);
    return b;
}

// ===== MENU: CARTAS Y HABILIDADES (tambien dentro del combate) =====
function abrirAcciones() {
    var j = partida.jugadores[myId];
    if (!j) { showNotice('Aun no tienes heroe.'); return; }
    abrirContenido(function(c) {
        elTitulo(c, 'Cartas');
        var h1 = document.createElement('h4'); h1.textContent = 'Cartas Botin (' + j.manoBotin.length + ')'; c.appendChild(h1);
        var m1 = document.createElement('div'); m1.className = 'mano-container'; c.appendChild(m1);
        pintarMano(m1, j.manoBotin, 'botin');
        var h2 = document.createElement('h4'); h2.textContent = 'Potenciadores (' + j.manoPot.length + '/' + maxPot(j) + ')'; c.appendChild(h2);
        var m2 = document.createElement('div'); m2.className = 'mano-container'; c.appendChild(m2);
        pintarMano(m2, j.manoPot, 'potenciador');
        elTexto(c, 'Mazos: Botin ' + partida.mazos.botin.length + ' \u00b7 Potenciadores ' + partida.mazos.potenciadores.length + ' \u00b7 Reglas ' + partida.mazos.reglas.length);
        var hb = crearBotonHabilidad();
        if (hb) c.appendChild(hb);
        botonesExtraCartas(c, j);
        if (j.mirada) {
            var bm = elBoton(c, 'Contacto visual (Botin 19 armada)', 'btn-outline', function() {
                elegirJugador({ titulo: 'Quien hizo contacto visual contigo?', candidatos: otrosJugadores(),
                    cb: function(o) { ejecutarAccion('hab', 'mirada', { objetivo: o }); } });
            });
            bm.style.marginTop = '6px';
        }
        elBoton(c, 'Cerrar', 'btn-secondary', cerrarOVolver);
    });
}
window.abrirAcciones = abrirAcciones;

// ===== REGISTRO =====
function renderRegistro() {
    var el = document.getElementById('registroList');
    if (!el) return;
    el.innerHTML = '';
    var r = partida.registro.slice(-15).reverse();
    if (!r.length) {
        el.innerHTML = '<div class="empty-message">Sin eventos todavia</div>';
        return;
    }
    r.forEach(function(t) {
        var d = document.createElement('div');
        d.className = 'registro-item';
        d.textContent = t;
        el.appendChild(d);
    });
}
window.renderRegistro = renderRegistro;

// ===== TRAMPA: al moverte a un hexagono con trampa =====
function abrirTrampa(hex, costo, previoId, retarPid) {
    var j = partida.jugadores[myId];
    abrirContenido(function(c) {
        elTitulo(c, 'Trampa');
        var n = hex.trampas || 1;
        var t = 'Hay ' + n + (n === 1 ? ' trampa' : ' trampas') + ' en este hexagono.' +
            (retarPid ? '\nRetar cuenta como movimiento: primero hay que resolver la trampa.' : '') +
            '\nDesactivar: ' + (retarPid ? 'se quitan las trampas y sigue el duelo.' : 'te quedas en el hexagono y las trampas se quitan.') +
            '\nRetroceder: vuelves al hexagono anterior y terminas de moverte' + (retarPid ? ' (no hay duelo).' : '.');
        if (tienePot(j, 31)) t += '\nPotenciador #31: tira un 5 o mas para desarmar la trampa.';
        elTexto(c, t);
        elBoton(c, 'Desactivar', 'btn-primary', function() {
            ocultarModal();
            if (retarPid) hacerReto(retarPid, costo, true);
            else hacerMovimiento(hex.id, costo, 'desactivar', previoId);
        });
        elBoton(c, 'Retroceder', 'btn-outline', function() { ocultarModal(); hacerMovimiento(hex.id, costo, 'retroceder', previoId); });
        elBoton(c, 'Cancelar', 'btn-secondary', function() { entradaPendiente = null; cerrarOVolver(); });
    });
}
window.abrirTrampa = abrirTrampa;

function inicioOcupado(j) {
    var ini = null;
    partida.hexes.forEach(function(h) { if (h.tipo === 'inicio' && h.duenoId === myId) ini = h; });
    return !ini || !!hexesOcupadosPorOtros(myId)[ini.id];
}

// ===== RESPUESTAS PENDIENTES (Potenciadores 42 y 59) =====
// Las respuestas pendientes se resuelven en orden: solo te toca la primera de la cola
function pendienteMio() {
    var pe = partida.pendientes[0];
    return (pe && pe.pid === myId) ? pe : null;
}
function pendienteForzadoPendiente() { return !!(partida.iniciada && pendienteMio()); }
window.pendienteForzadoPendiente = pendienteForzadoPendiente;

function abrirPendiente() {
    var pe = pendienteMio();
    if (!pe) return;
    if (seleccionHex) cancelarSeleccionHex(true);
    function resolver(modo, objetivo) { ejecutarAccion('pend', pe.tipo, { modo: modo, objetivo: objetivo }); }
    if (pe.tipo === 'caos') { abrirCaos(); return; }
    if (pe.tipo === 'caos14') { abrirCaos14(pe); return; }
    if (pe.tipo === 'caos17') { abrirCaos17(pe); return; }
    if (pe.tipo === 'caos12') { abrirCaos12(); return; }
    abrirContenido(function(c) {
        var marca = document.createElement('div');
        marca.className = 'pendiente-forzado';
        marca.style.display = 'none';
        c.appendChild(marca);
        if (pe.tipo === 'p42') {
            elTitulo(c, 'Potenciador 42');
            elTexto(c, 'Perdiste 10 o mas de salud contra un Monstruo. Puedes tirar el dado: si sale par, un oponente y tu se reparten el dano (5 y 5).');
            elBoton(c, 'Salio par', 'btn-primary', function() {
                elegirJugador({ titulo: 'Compartir el dano con...', candidatos: otrosJugadores(),
                    cb: function(o) { resolver('par', o); } });
            });
            elBoton(c, 'Salio impar', 'btn-outline', function() { resolver('impar'); });
            elBoton(c, 'No quiero hacerlo', 'btn-secondary', function() { resolver('no'); });
        } else {
            elTitulo(c, 'Potenciador 59');
            elTexto(c, 'Perdiste contra un Monstruo. Tira el dado: si sale par robas una Carta botin.');
            elBoton(c, 'Salio par', 'btn-primary', function() { resolver('par'); });
            elBoton(c, 'Salio impar', 'btn-outline', function() { resolver('impar'); });
            elBoton(c, 'No quiero hacerlo', 'btn-secondary', function() { resolver('no'); });
        }
    });
}
function sincronizarPendiente() {
    if (!pendienteForzadoPendiente() || descarteForzadoPendiente()) return;
    if (modalVisible() && document.querySelector('#zoomContent .pendiente-forzado')) return;
    abrirPendiente();
}
window.sincronizarPendiente = sincronizarPendiente;

// ===== DADO DEL CAOS =====
function marcaPendiente(c) {
    var marca = document.createElement('div');
    marca.className = 'pendiente-forzado';
    marca.style.display = 'none';
    c.appendChild(marca);
}

function abrirCaos() {
    if (seleccionHex) cancelarSeleccionHex(true);
    abrirContenido(function(c) {
        marcaPendiente(c);
        elTitulo(c, 'Dado del Caos');
        elTexto(c, 'Tira el Dado del Caos (d20) en la mesa. Que numero salio?');
        var grid = document.createElement('div');
        grid.className = 'caos-grid';
        for (var v = 1; v <= 20; v++) {
            (function(valor) {
                var b = document.createElement('button');
                b.className = 'modal-btn btn-outline caos-num';
                b.textContent = String(valor);
                b.addEventListener('click', function() {
                    flujoCaos(valor, function(params, despues) {
                        params.valor = valor;
                        ejecutarAccion('pend', 'caos', params, despues);
                    });
                });
                grid.appendChild(b);
            })(v);
        }
        c.appendChild(grid);
    });
}

// Selecciona par/impar para varios jugadores a la vez (Dado del Caos 15)
function elegirParImparTodos(o) {
    var res = {};
    abrirContenido(function(c) {
        marcaPendiente(c);
        elTitulo(c, o.titulo);
        elTexto(c, o.texto);
        var ok;
        var botones = {};
        function actualizar() {
            ok.disabled = o.jugadores.some(function(x) { return !res[x]; });
            o.jugadores.forEach(function(x) {
                botones[x].par.className = 'modal-btn ' + (res[x] === 'par' ? 'btn-primary' : 'btn-outline');
                botones[x].impar.className = 'modal-btn ' + (res[x] === 'impar' ? 'btn-danger' : 'btn-outline');
            });
        }
        o.jugadores.forEach(function(x) {
            var fila = document.createElement('div');
            fila.className = 'row-btns';
            fila.style.width = '100%';
            var et = document.createElement('div');
            et.className = 'zoom-stats';
            et.textContent = nom(x);
            c.appendChild(et);
            var bp = document.createElement('button'); bp.textContent = 'Par (+10)';
            var bi = document.createElement('button'); bi.textContent = 'Impar (-10)';
            bp.addEventListener('click', function() { res[x] = 'par'; actualizar(); });
            bi.addEventListener('click', function() { res[x] = 'impar'; actualizar(); });
            fila.appendChild(bp); fila.appendChild(bi);
            c.appendChild(fila);
            botones[x] = { par: bp, impar: bi };
        });
        ok = elBoton(c, 'Confirmar', 'btn-danger', function() { o.cb(res); });
        actualizar();
    });
}

// Elegir una habitacion y una nueva ubicacion (sin islas). cb(habitacionId, celda{q,r})
function flujoReubicar(cb, onCancel) {
    var cand = habitacionesReubicables().map(function(h) { return h.id; });
    elegirHex({ titulo: 'Elige una habitacion desocupada para recolocar (no el Jefe Final)', ids: cand,
        vacio: 'No hay habitaciones que se puedan recolocar.', onCancel: onCancel,
        cb: function(hab) {
            elegirCelda({ titulo: 'Elige la nueva ubicacion (junto a otra habitacion, sin islas)', celdas: celdasReubicacion(hab),
                onCancel: onCancel, cb: function(celda) { cb(hab, celda); } });
        } });
}

// Reparte una lista de cartas de Botin entre oponentes, una por una. cb(arregloDePids)
function repartirCartas(cartas, titulo, cb) {
    var ops = otrosJugadores();
    var dist = [];
    function paso(i) {
        if (i >= cartas.length) { cb(dist); return; }
        var info = getInfoCarta('botin', cartas[i]);
        abrirContenido(function(c) {
            marcaPendiente(c);
            elTitulo(c, titulo + ' (' + (i + 1) + '/' + cartas.length + ')');
            var im = document.createElement('img');
            im.src = info.imagen; im.alt = info.titulo;
            c.appendChild(im);
            elTexto(c, 'A que oponente le das esta carta?');
            ops.forEach(function(o) {
                elBoton(c, nom(o), 'btn-outline', function() { dist.push(o); paso(i + 1); });
            });
        });
    }
    paso(0);
}

function flujoCaos(v, fin) {
    var j = partida.jugadores[myId];
    var ops = otrosJugadores();
    var oc = hexesOcupados();
    var jugadoresTodos = partida.orden.filter(function(x) { return partida.jugadores[x]; });
    switch (v) {
        case 2:
            elegirHex({ titulo: 'Dado del Caos 2: revela una habitacion desocupada',
                ids: partida.hexes.filter(function(h) { return h.tipo === 'calabozo' && !h.desbloqueado && !oc[h.id]; }).map(function(h) { return h.id; }),
                vacio: 'No hay habitaciones sin revelar desocupadas.', onCancel: abrirCaos,
                cb: function(h) { fin({ hex: h }, mostrarUltimaEntrada); } });
            break;
        case 3:
            var g = partida.hexes.filter(function(h) { return h.clase === 'guardian'; })[0];
            if (!g || !g.desbloqueado) { fin({}); break; }
            elegirHex({ titulo: 'Dado del Caos 3: intercambia el Jefe Final con otra habitacion desocupada',
                ids: partida.hexes.filter(function(h) { return h.tipo === 'calabozo' && h.clase !== 'guardian' && !oc[h.id]; }).map(function(h) { return h.id; }),
                onCancel: abrirCaos, cb: function(h) { fin({ hex: h }); } });
            break;
        case 5:
            var abandonados = partida.descartePot.filter(function(n) { return partida.potUbic[n]; });
            if (!abandonados.length) { fin({ mov: [] }); break; }
            var mov5 = [];
            (function paso5(i) {
                if (i >= abandonados.length) { fin({ mov: mov5 }); return; }
                var n = abandonados[i];
                var desde = buscarHex(partida.potUbic[n]);
                var ids = partida.hexes.filter(function(h) { return h.tipo === 'calabozo' && !oc[h.id] && distanciaHex(desde, h) <= 3 && h.id !== desde.id; }).map(function(h) { return h.id; });
                abrirContenido(function(c) {
                    marcaPendiente(c);
                    elTitulo(c, 'Potenciador abandonado #' + n + ' (' + (i + 1) + '/' + abandonados.length + ')');
                    var im = document.createElement('img');
                    im.src = getImagenPotenciador(n); im.alt = 'Potenciador ' + n;
                    c.appendChild(im);
                    elTexto(c, 'Puedes moverlo hasta 3 habitaciones, a una habitacion desocupada.');
                    elBoton(c, 'Moverlo', 'btn-primary', function() {
                        elegirHex({ titulo: 'Elige donde dejar el Potenciador #' + n, ids: ids, vacio: 'No hay habitaciones validas a ese alcance.',
                            onCancel: function() { paso5(i); },
                            cb: function(h) { mov5.push({ n: n, hex: h }); paso5(i + 1); } });
                    });
                    elBoton(c, 'Dejarlo donde esta', 'btn-outline', function() { paso5(i + 1); });
                });
            })(0);
            break;
        case 7:
            var trampas = [];
            partida.hexes.forEach(function(h) { for (var k = 0; k < (h.trampas || 0); k++) trampas.push(h.id); });
            if (!trampas.length) { fin({ mov: [] }); break; }
            var mov7 = [];
            (function paso7(i) {
                if (i >= trampas.length) { fin({ mov: mov7 }); return; }
                var desdeId = trampas[i];
                var ids = partida.hexes.filter(function(h) { return hexRevelado(h) && h.tipo === 'calabozo' && h.clase !== 'guardian' && !oc[h.id] && h.id !== desdeId && (h.trampas || 0) < 3; }).map(function(h) { return h.id; });
                abrirContenido(function(c) {
                    marcaPendiente(c);
                    elTitulo(c, 'Mover trampas (' + (i + 1) + '/' + trampas.length + ')');
                    elTexto(c, 'Puedes mover esta trampa a una habitacion revelada desocupada, o dejarla donde esta.');
                    elBoton(c, 'Moverla', 'btn-primary', function() {
                        elegirHex({ titulo: 'Elige la habitacion para esta trampa', ids: ids, vacio: 'No hay habitaciones validas.',
                            onCancel: function() { paso7(i); },
                            cb: function(h) { mov7.push({ from: desdeId, to: h }); paso7(i + 1); } });
                    });
                    elBoton(c, 'Dejarla donde esta', 'btn-outline', function() { paso7(i + 1); });
                });
            })(0);
            break;
        case 8:
            var izq8 = vecinoOrden(myId, -1), der8 = vecinoOrden(myId, 1);
            var cand8 = [];
            if (izq8) cand8.push(izq8);
            if (der8 && der8 !== izq8) cand8.push(der8);
            elegirJugador({ titulo: 'Dado del Caos 8: igualar tu salud a la de...', texto: 'Tu oponente de la izquierda o de la derecha.',
                candidatos: cand8, vacio: 'No hay oponentes.', cb: function(o) { fin({ objetivo: o }); } });
            break;
        case 9:
            var todas = [];
            jugadoresTodos.forEach(function(x) { todas = todas.concat(partida.jugadores[x].manoBotin || []); });
            fin({ nuevoMazo: mezclar(partida.mazos.botin.concat(todas)) });
            break;
        case 10:
            var derrotados = partida.hexes.filter(function(h) {
                return h.tipo === 'calabozo' && h.clase === 'monstruo' && h.desbloqueado && h.despejado && !oc[h.id];
            }).map(function(h) { return h.id; });
            if (!derrotados.length) { fin({ hexes: [] }); break; }
            elegirHex({ titulo: 'Dado del Caos 10: elige el 1er Monstruo derrotado', ids: derrotados, onCancel: abrirCaos,
                cb: function(h1) {
                    var resto = derrotados.filter(function(x) { return x !== h1; });
                    if (!resto.length) { fin({ hexes: [h1] }); return; }
                    elegirHex({ titulo: 'Elige el 2o Monstruo derrotado', ids: resto, onCancel: abrirCaos,
                        cb: function(h2) { fin({ hexes: [h1, h2] }); } });
                } });
            break;
        case 15:
            elegirParImparTodos({ titulo: 'Dado del Caos 15', texto: 'Todos tiran el dado. Indica que le salio a cada jugador.',
                jugadores: jugadoresTodos, cb: function(res) { fin({ res: res }); } });
            break;
        case 16:
            if (!j.manoPot.length) { fin({}); break; }
            var cen = buscarHex(hexId(0, 0));
            var idsCerca = vecinosDe(cen).filter(function(h) { return !oc[h.id]; }).map(function(h) { return h.id; });
            elegirCartas({ titulo: 'Dado del Caos 16: que Potenciador dejas?', texto: 'Lo dejas en una habitacion desocupada junto al punto de partida.',
                tipo: 'potenciador', cantidad: 1, sinCancelar: true, items: j.manoPot.map(function(x) { return { n: x }; }),
                cb: function(nums) {
                    elegirHex({ titulo: 'Elige la habitacion (junto al punto de partida)', ids: idsCerca, vacio: 'No hay habitaciones desocupadas junto al punto de partida.',
                        onCancel: abrirCaos, cb: function(h) { fin({ pot: Number(nums[0]), hex: h }); } });
                } });
            break;
        case 20:
            if (j.manoBotin.length <= 1) { fin({}); break; }
            elegirCartas({ titulo: 'Dado del Caos 20: con que Carta botin te quedas?', texto: 'Las demas se reparten entre tus oponentes.',
                tipo: 'botin', cantidad: 1, sinCancelar: true, items: j.manoBotin.map(function(x) { return { n: x }; }),
                cb: function(nums) {
                    var keep = Number(nums[0]);
                    var resto = j.manoBotin.slice();
                    resto.splice(resto.indexOf(keep), 1);
                    repartirCartas(resto, 'Dado del Caos 20', function(dist) { fin({ keep: keep, dist: dist }); });
                } });
            break;
        default:
            fin({});   // 1, 4, 6, 11, 12, 13, 14, 17, 18, 19: no piden elecciones ahora
    }
}

// El jugador a la derecha elige a que habitacion mueve a quien tiro el Dado del Caos (14)
function abrirCaos14(pe) {
    if (seleccionHex) cancelarSeleccionHex(true);
    var ids = partida.hexes.filter(function(h) {
        return hexRevelado(h) && h.clase !== 'guardian' && !(h.trampas > 0) && !hexesOcupados()[h.id];
    }).map(function(h) { return h.id; });
    abrirContenido(function(c) {
        marcaPendiente(c);
        elTitulo(c, 'Dado del Caos 14');
        elTexto(c, nom(pe.para) + ' tiro el Dado del Caos: puedes moverlo a cualquier habitacion revelada, desocupada y sin trampas (no el Jefe Final).');
        elBoton(c, 'Elegir habitacion', 'btn-primary', function() {
            elegirHex({ titulo: 'A que habitacion mueves a ' + nom(pe.para) + '?', ids: ids, vacio: 'No hay habitaciones validas.',
                onCancel: abrirCaos14.bind(null, pe),
                cb: function(h) { ejecutarAccion('pend', 'caos14', { hex: h }); } });
        });
        elBoton(c, 'No moverlo', 'btn-secondary', function() { ejecutarAccion('pend', 'caos14', { hex: null }); });
    });
}

// Repartir entre los oponentes las Cartas botin robadas (17)
function abrirCaos17(pe) {
    if (seleccionHex) cancelarSeleccionHex(true);
    repartirCartas(pe.cartas, 'Dado del Caos 17', function(dist) {
        ejecutarAccion('pend', 'caos17', { dist: dist });
    });
}

// Cada jugador recoloca una habitacion (12)
function abrirCaos12() {
    if (seleccionHex) cancelarSeleccionHex(true);
    abrirContenido(function(c) {
        marcaPendiente(c);
        elTitulo(c, 'Dado del Caos 12');
        elTexto(c, 'Elige una habitacion desocupada (no el Jefe Final) y colocala en otro lugar, junto a otra habitacion y sin crear islas.');
        elBoton(c, 'Elegir habitacion', 'btn-primary', function() {
            flujoReubicar(function(hab, celda) { ejecutarAccion('pend', 'caos12', { hex: hab, q: celda.q, r: celda.r }); }, abrirCaos12);
        });
        elBoton(c, 'No puedo / ninguna', 'btn-secondary', function() { ejecutarAccion('pend', 'caos12', {}); });
    });
}

// ===== Goblin (Dado del Caos 18) y respuestas atascadas =====
function botonesExtraCartas(c, j) {
    otrosJugadores().forEach(function(o) {
        if (!partida.jugadores[o].goblin) return;
        var b = elBoton(c, nom(o) + ' no hablo Goblin (-5)', 'btn-outline', function() {
            ejecutarAccion('hab', 'goblin', { objetivo: o });
        });
        b.style.marginTop = '6px';
    });
    var cabeza = partida.pendientes[0];
    if (cabeza && cabeza.pid !== myId && soyAnfitrionOLocal()) {
        var bs = elBoton(c, 'Saltar respuesta pendiente de ' + nom(cabeza.pid), 'btn-secondary', function() {
            ejecutarAccion('pend', 'saltar', {});
        });
        bs.style.marginTop = '6px';
    }
}
