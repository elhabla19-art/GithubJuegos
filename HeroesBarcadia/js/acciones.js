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
}
function finAccionUI() {
    if (combatePendienteMio()) abrirCombate();
    else if (!(modalVisible() && document.querySelector('#zoomContent .descarte-forzado'))) ocultarModal();
    sincronizarDescarte();
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
        elTexto(c, 'Elige hasta ' + o.max + '.');
        var botones = {};
        var ok;
        function actualizar() {
            var n = Object.keys(sel).length;
            ok.disabled = n < 1 || n > o.max;
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

// Elegir un hexagono directamente en el tablero
function elegirHex(o) {
    if (!o.ids.length) { showNotice(o.vacio || 'No hay hexagonos validos para elegir.'); return; }
    var mapa = {};
    o.ids.forEach(function(id) { mapa[id] = true; });
    seleccionHex = {
        ids: mapa,
        cb: function(id) { cancelarSeleccionHex(true); o.cb(id); }
    };
    ocultarModal();
    var banner = document.getElementById('seleccionBanner');
    document.getElementById('seleccionTexto').textContent = o.titulo;
    if (banner) banner.style.display = 'flex';
    renderizarTablero();
}
function cancelarSeleccionHex(sinVolver) {
    seleccionHex = null;
    var banner = document.getElementById('seleccionBanner');
    if (banner) banner.style.display = 'none';
    renderizarTablero();
    if (!sinVolver) cerrarOVolver();
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
    return partida.hexes.filter(function(h) { return hexLibre(h) && !oc[h.id]; }).map(function(h) { return h.id; });
}

function usarBotin(n) {
    var j = partida.jugadores[myId];
    if (!j || !DATOS_BOTIN[n]) return;
    if (partida.ganador) { showNotice('La partida ya termino.'); return; }
    var momento = DATOS_BOTIN[n][0];
    var c = partida.combate;
    if ((momento === M_TURNO || momento === M_DURANTE) && !esMiTurno()) {
        showNotice('Esta carta solo se usa durante tu turno.');
        return;
    }
    if (momento === M_OPONENTE && !(c && c.pid !== myId)) {
        showNotice('Esta carta se usa en el turno de un oponente que esta a punto de pelear.');
        return;
    }
    if (n === 9 && !(c && c.pid === myId)) { showNotice('Solo se usa cuando estas a punto de pelear con un monstruo.'); return; }
    if (n === 2 && c) { showNotice('Resuelve primero el combate.'); return; }

    var ops = otrosJugadores();
    var oc = hexesOcupados();
    function fin(params, despues) { ejecutarAccion('botin', n, params, despues); }

    switch (n) {
        case 3: case 28:
            elegirJugador({ titulo: n === 3 ? 'Inflige 10 de dano a...' : 'Intercambiar Cartas botin con...', candidatos: ops,
                cb: function(o) { fin({ objetivo: o }); } });
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
        case 14:
            elegirJugador({ titulo: 'Robar una Carta botin (al azar) a...', vacio: 'Ningun oponente tiene Cartas botin.',
                candidatos: ops.filter(function(o) { return partida.jugadores[o].manoBotin.length; }),
                cb: function(o) { fin({ objetivo: o, idx: Math.floor(Math.random() * 1000) }); } });
            break;
        case 23:
            elegirJugadores({ titulo: 'Sanar 5 puntos a...', candidatos: ops, max: 3,
                cb: function(lista) { fin({ objetivos: lista }); } });
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
        case 13:
            var cands13 = ops.filter(function(o) { return destinos13(o).length; });
            elegirJugador({ titulo: 'Mover a...', vacio: 'Ningun oponente tiene una habitacion adyacente valida.', candidatos: cands13,
                cb: function(o) {
                    elegirHex({ titulo: 'Elige la habitacion donde ira ' + nom(o), ids: destinos13(o),
                        cb: function(h) { fin({ objetivo: o, hex: h }); } });
                } });
            break;
        case 17:
            elegirHex({ titulo: 'Elige una habitacion revelada y desocupada', ids: hexesDesocupadosLibres(),
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
        case 15:
            elegirHex({ titulo: 'Elige una habitacion sin revelar para echar un vistazo',
                ids: partida.hexes.filter(function(h) { return h.tipo === 'calabozo' && !h.desbloqueado; }).map(function(h) { return h.id; }),
                cb: function(h) { fin({ hex: h }, function() { abrirVistazo(h); }); } });
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
function destinos13(o) {
    var pos = buscarHex(partida.jugadores[o].posicion);
    var oc = hexesOcupados();
    return pos ? vecinosDe(pos).filter(function(h) { return hexLibre(h) && !oc[h.id]; }).map(function(h) { return h.id; }) : [];
}
window.usarBotin = usarBotin;

// ===== POTENCIADORES =====
function usarPot(n) {
    var j = partida.jugadores[myId];
    if (!j || !tienePot(j, n)) return;
    if (partida.ganador) { showNotice('La partida ya termino.'); return; }
    if (!esMiTurno()) { showNotice('Este Potenciador se usa durante tu turno.'); return; }
    if (n !== 56 && yaUsadoTurno(j, 'p' + n)) { showNotice('Ya usaste este Potenciador en este turno.'); return; }
    var ops = otrosJugadores();
    function fin(params) { ejecutarAccion('pot', n, params); }
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
        case 39:
            var miHex = buscarHex(j.posicion);
            var ady = vecinosDe(miHex).map(function(h) { return h.id; });
            elegirJugador({ titulo: '5 de dano a un oponente adyacente', vacio: 'No hay oponentes en habitaciones adyacentes.',
                candidatos: ops.filter(function(o) { return ady.indexOf(partida.jugadores[o].posicion) !== -1; }),
                cb: function(o) { fin({ objetivo: o }); } });
            break;
        case 48:
            if (j.manoBotin.length >= 2) { showNotice('Solo puedes usarlo con menos de 2 Cartas botin en la mano.'); return; }
            elegirJugador({ titulo: 'Pedir una Carta botin (al azar) a...', vacio: 'Ningun oponente tiene Cartas botin.',
                candidatos: ops.filter(function(o) { return partida.jugadores[o].manoBotin.length; }),
                cb: function(o) { fin({ objetivo: o, idx: Math.floor(Math.random() * 1000) }); } });
            break;
        case 60:
            if (!combatePendienteMio()) { showNotice('Se usa cuando estas a punto de luchar contra un Monstruo.'); return; }
            elegirCartas({ titulo: 'Descarta una Carta botin', texto: 'El Monstruo pierde 3 de Nivel en esta batalla.',
                tipo: 'botin', cantidad: 1, vacio: 'No tienes Cartas botin.',
                items: j.manoBotin.map(function(x) { return { n: x }; }),
                cb: function(nums) { fin({ descartar: Number(nums[0]) }); } });
            break;
        default:
            fin({});
    }
}
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
        cb: function(nums) { ejecutarAccion('desc', null, { nums: nums.map(Number) }); }
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
    if (combatePendienteMio()) {
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
            cfg = { t: 'Teletransportar al inicio', ok: esMiTurno() && !partida.combate && !partida.ganador && !(j.usos && j.usos.h5),
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
        elTitulo(c, 'Cartas y habilidades');
        var h1 = document.createElement('h4'); h1.textContent = 'Cartas Botin (' + j.manoBotin.length + ')'; c.appendChild(h1);
        var m1 = document.createElement('div'); m1.className = 'mano-container'; c.appendChild(m1);
        pintarMano(m1, j.manoBotin, 'botin');
        var h2 = document.createElement('h4'); h2.textContent = 'Potenciadores (' + j.manoPot.length + '/' + maxPot(j) + ')'; c.appendChild(h2);
        var m2 = document.createElement('div'); m2.className = 'mano-container'; c.appendChild(m2);
        pintarMano(m2, j.manoPot, 'potenciador');
        elTexto(c, 'Habilidad: ' + DATOS_HEROES[j.heroe]);
        var hb = crearBotonHabilidad();
        if (hb) c.appendChild(hb);
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
