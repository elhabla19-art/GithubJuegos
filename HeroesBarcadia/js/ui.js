// ui.js
var SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}

// ===== TABLERO (con desplazamiento y zoom) =====
var mapaZoom = null;          // pixeles por unidad del SVG; null = calcular al abrir
var mapaGeom = null;          // { minX, minY, zoom } para convertir posiciones a pixeles
var mapaUltimoTurno = undefined;
var mapaArrastro = false;     // true justo despues de arrastrar el mapa (evita clics accidentales)
var MAPA_ZOOM_MIN = 0.3, MAPA_ZOOM_MAX = 1.8;

function renderizarTablero() {
    var cont = document.getElementById('tablero');
    if (!cont) return;
    var scrollX = cont.scrollLeft, scrollY = cont.scrollTop;
    cont.innerHTML = '';
    var controles = document.getElementById('mapaControles');

    if (!partida.iniciada || !partida.hexes.length) {
        cont.innerHTML = '<div class="tablero-vacio">Presiona "Heroes" para comenzar la partida</div>';
        mapaZoom = null; mapaGeom = null; mapaUltimoTurno = undefined;
        if (controles) controles.style.display = 'none';
        return;
    }
    if (controles) controles.style.display = 'flex';

    var dim = hexDimensiones();
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var fantasmas = (seleccionHex && seleccionHex.fantasmas) ? Object.keys(seleccionHex.fantasmas).map(function(k) { return seleccionHex.fantasmas[k]; }) : [];
    partida.hexes.concat(fantasmas).forEach(function(h) {
        var c = hexAPixel(h.q, h.r);
        minX = Math.min(minX, c.x - dim.w / 2); maxX = Math.max(maxX, c.x + dim.w / 2);
        minY = Math.min(minY, c.y - dim.h / 2); maxY = Math.max(maxY, c.y + dim.h / 2);
    });
    var pad = 24;
    var vbW = maxX - minX + pad * 2, vbH = maxY - minY + pad * 2;
    if (mapaZoom === null) {   // primera vez: que quepa a lo ancho, sin hacerse demasiado pequeno
        mapaZoom = Math.max(0.45, Math.min(0.9, (cont.clientWidth || 600) / vbW));
    }
    var svg = svgEl('svg', {
        'class': 'tablero-svg',
        viewBox: (minX - pad) + ' ' + (minY - pad) + ' ' + vbW + ' ' + vbH
    });
    svg.style.width = Math.round(vbW * mapaZoom) + 'px';
    svg.style.height = Math.round(vbH * mapaZoom) + 'px';
    mapaGeom = { minX: minX - pad, minY: minY - pad, zoom: mapaZoom };

    var defs = svgEl('defs', {});
    var R = HEX_SIZE * 0.3;
    var clip = svgEl('clipPath', { id: 'fichaClip' });
    clip.appendChild(svgEl('circle', { cx: 0, cy: 0, r: R }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    // Fichas de jugadores agrupadas por hexagono
    var fichasPorHex = {};
    partida.orden.forEach(function(pid) {
        var j = partida.jugadores[pid];
        if (!j) return;
        (fichasPorHex[j.posicion] = fichasPorHex[j.posicion] || []).push(pid);
    });

    var opciones = esMiTurno() ? calcularOpciones(myId) : { mover: {}, entrar: {} };
    var miPos = partida.jugadores[myId] ? partida.jugadores[myId].posicion : null;
    var turnoId = turnoActualId();

    partida.hexes.forEach(function(h) {
        var c = hexAPixel(h.q, h.r);
        var g = svgEl('g', { 'class': 'hex hex-' + h.tipo, 'data-id': h.id });

        var w = dim.w * HEX_ESCALA_IMG, ht = dim.h * HEX_ESCALA_IMG;
        g.appendChild(svgEl('image', {
            href: getImagenTile(h),
            x: c.x - w / 2, y: c.y - ht / 2, width: w, height: ht,
            preserveAspectRatio: 'xMidYMid meet'
        }));

        // Enemigos (monstruos, jefes, guardian) de los hexagonos descubiertos
        var cont = (h.tipo === 'calabozo' && h.desbloqueado) ? getContenidoHex(h) : null;
        if (cont && cont.overlay) {
            var mw = dim.w * 0.8, mh = dim.h * 0.8;
            g.appendChild(svgEl('image', {
                'class': 'hex-monstruo' + (h.despejado ? ' despejado' : ''),
                href: cont.imagen,
                x: c.x - mw / 2, y: c.y - mh / 2 - HEX_SIZE * 0.08, width: mw, height: mh,
                preserveAspectRatio: 'xMidYMid meet'
            }));
        }

        // Trampas: puntos naranjas en hexagonos revelados
        var nt = h.trampas || 0;
        if (nt > 0 && (h.tipo !== 'calabozo' || h.desbloqueado)) {
            for (var ti = 0; ti < nt; ti++) {
                var tp = svgEl('circle', {
                    'class': 'trampa',
                    cx: c.x - HEX_SIZE * 0.22 + ti * HEX_SIZE * 0.22,
                    cy: c.y - HEX_SIZE * 0.55,
                    r: HEX_SIZE * 0.1
                });
                var tt = svgEl('title', {});
                tt.textContent = 'Trampa';
                tp.appendChild(tt);
                g.appendChild(tp);
            }
        }

        // Capa de interaccion / resaltado
        var clases = 'hex-hit';
        if (opciones.rival && opciones.rival[h.id]) clases += ' duelo';
        else if (opciones.mover[h.id] === 1) clases += ' alc1';
        else if (opciones.mover[h.id] === 2) clases += ' alc2';
        else if (opciones.entrar[h.id]) clases += ' entrar';
        else if (opciones.entrarVia && opciones.entrarVia[h.id]) clases += ' entrar-via';
        if (h.id === miPos) clases += ' actual';
        if (seleccionHex && seleccionHex.ids[h.id]) clases += ' sel';
        g.appendChild(svgEl('polygon', { 'class': clases, points: hexPuntos(c.x, c.y) }));

        // Fichas
        var fichas = fichasPorHex[h.id] || [];
        var n = fichas.length;
        var sep = Math.min(R * 2.1, (dim.w * 0.8) / Math.max(n, 1));
        fichas.forEach(function(pid, i) {
            var heroe = partida.jugadores[pid].heroe;
            var fx = c.x + (i - (n - 1) / 2) * sep;
            var fy = c.y + HEX_SIZE * (HEX_ORIENTACION === 'flat' ? 0.45 : 0.55);
            var ficha = svgEl('g', { transform: 'translate(' + fx + ',' + fy + ')', 'class': 'ficha' });
            ficha.appendChild(svgEl('image', {
                href: getImagenHeroe(heroe),
                x: -R, y: -R, width: R * 2, height: R * 2,
                preserveAspectRatio: 'xMidYMid slice',
                'clip-path': 'url(#fichaClip)'
            }));
            var aro = 'ficha-aro' + (pid === turnoId ? ' turno' : '') + (pid === myId ? ' yo' : '');
            ficha.appendChild(svgEl('circle', { cx: 0, cy: 0, r: R, 'class': aro }));
            var t = svgEl('title', {});
            t.textContent = (playersData[pid] ? playersData[pid].name : pid) + ' - ' + getNombreHeroe(heroe);
            ficha.appendChild(t);
            g.appendChild(ficha);
        });

        g.addEventListener('click', function() {
            if (mapaArrastro) return;
            if (seleccionHex) {
                if (seleccionHex.ids[h.id]) seleccionHex.cb(h.id);
                return;
            }
            abrirZoomHex(h.id);
        });
        svg.appendChild(g);
    });

    // Potenciadores abandonados en la mazmorra
    var abandonadosPorHex = {};
    partida.descartePot.forEach(function(n) {
        var ub = partida.potUbic ? partida.potUbic[n] : null;
        if (ub) abandonadosPorHex[ub] = (abandonadosPorHex[ub] || 0) + 1;
    });
    partida.hexes.forEach(function(h) {
        var cnt = abandonadosPorHex[h.id];
        if (!cnt) return;
        var c = hexAPixel(h.q, h.r);
        var mk = svgEl('rect', {
            'class': 'pot-abandonado', x: c.x + HEX_SIZE * 0.3, y: c.y - HEX_SIZE * 0.62,
            width: HEX_SIZE * 0.22, height: HEX_SIZE * 0.22, transform: 'rotate(45 ' + (c.x + HEX_SIZE * 0.41) + ' ' + (c.y - HEX_SIZE * 0.51) + ')'
        });
        var tt = svgEl('title', {});
        tt.textContent = cnt + ' Potenciador(es) abandonado(s)';
        mk.appendChild(tt);
        svg.appendChild(mk);
    });

    // Ubicaciones posibles al recolocar una habitacion
    fantasmas.forEach(function(f) {
        var c = hexAPixel(f.q, f.r);
        var poly = svgEl('polygon', { 'class': 'hex-fantasma', points: hexPuntos(c.x, c.y) });
        poly.addEventListener('click', function() { if (!mapaArrastro && seleccionHex) seleccionHex.cb(f.id); });
        svg.appendChild(poly);
    });

    cont.appendChild(svg);

    // Mantener donde estaba el desplazamiento; centrar en mi heroe al empezar y al llegar mi turno
    var turnoAhora = turnoActualId();
    var centrar = (mapaUltimoTurno === undefined) || (turnoAhora !== mapaUltimoTurno && turnoAhora === myId);
    mapaUltimoTurno = turnoAhora;
    if (centrar) centrarEnMiHeroe();
    else { cont.scrollLeft = scrollX; cont.scrollTop = scrollY; }
}

// Lleva la vista del mapa hasta mi heroe (o al portal si no participo)
function centrarEnMiHeroe() {
    var cont = document.getElementById('tablero');
    if (!cont || !mapaGeom) return;
    var j = partida.jugadores[myId];
    var h = (j && buscarHex(j.posicion)) || buscarHex(hexId(0, 0));
    if (!h) return;
    var c = hexAPixel(h.q, h.r);
    cont.scrollLeft = (c.x - mapaGeom.minX) * mapaGeom.zoom - cont.clientWidth / 2;
    cont.scrollTop = (c.y - mapaGeom.minY) * mapaGeom.zoom - cont.clientHeight / 2;
}

// Acercar / alejar manteniendo el centro de la vista
function cambiarZoomMapa(factor) {
    var cont = document.getElementById('tablero');
    if (!cont || mapaZoom === null) return;
    var antes = mapaZoom;
    var cx = (cont.scrollLeft + cont.clientWidth / 2) / antes;
    var cy = (cont.scrollTop + cont.clientHeight / 2) / antes;
    mapaZoom = Math.max(MAPA_ZOOM_MIN, Math.min(MAPA_ZOOM_MAX, antes * factor));
    renderizarTablero();
    cont.scrollLeft = cx * mapaZoom - cont.clientWidth / 2;
    cont.scrollTop = cy * mapaZoom - cont.clientHeight / 2;
}
function mapaZoomMas() { cambiarZoomMapa(1.25); }
function mapaZoomMenos() { cambiarZoomMapa(0.8); }
function mapaAjustar() {   // vuelve al zoom inicial y vuelve a centrar
    mapaZoom = null;
    mapaUltimoTurno = undefined;
    renderizarTablero();
}

// Arrastrar el mapa con el mouse (en pantallas tactiles se desplaza con el dedo)
document.addEventListener('DOMContentLoaded', function() {
    var cont = document.getElementById('tablero');
    if (!cont) return;
    cont.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        var x0 = e.clientX, y0 = e.clientY, sl = cont.scrollLeft, st = cont.scrollTop, movido = false;
        function mover(ev) {
            var dx = ev.clientX - x0, dy = ev.clientY - y0;
            if (!movido && Math.abs(dx) + Math.abs(dy) > 6) { movido = true; cont.classList.add('arrastrando'); }
            if (movido) { cont.scrollLeft = sl - dx; cont.scrollTop = st - dy; }
        }
        function soltar() {
            document.removeEventListener('mousemove', mover);
            document.removeEventListener('mouseup', soltar);
            cont.classList.remove('arrastrando');
            if (movido) { mapaArrastro = true; setTimeout(function() { mapaArrastro = false; }, 60); }
        }
        document.addEventListener('mousemove', mover);
        document.addEventListener('mouseup', soltar);
    });
});
window.centrarEnMiHeroe = centrarEnMiHeroe;
window.mapaZoomMas = mapaZoomMas;
window.mapaZoomMenos = mapaZoomMenos;
window.mapaAjustar = mapaAjustar;

// ===== MI HEROE Y TURNO =====
function renderizarMiHeroe() {
    var cont = document.getElementById('my-hero-container');
    var turnoEl = document.getElementById('turnoDisplay');
    var movEl = document.getElementById('movimientoDisplay');
    if (!cont) return;
    cont.innerHTML = '';
    cont.className = 'hero-panel';

    var turnoId = turnoActualId();
    if (turnoEl) {
        turnoEl.className = 'turno-display' + (esMiTurno() ? ' mio' : '');
        if (partida.ganador) {
            var gn = playersData[partida.ganador] ? playersData[partida.ganador].name : '---';
            turnoEl.textContent = 'Fin del juego \u00b7 Gano ' + gn;
        } else if (!partida.iniciada) {
            turnoEl.textContent = 'Partida sin iniciar';
        } else if (esMiTurno()) {
            turnoEl.textContent = 'Ronda ' + partida.ronda + ' \u00b7 \u00a1Es tu turno!';
        } else {
            var nombre = turnoId && playersData[turnoId] ? playersData[turnoId].name : '---';
            turnoEl.textContent = 'Ronda ' + partida.ronda + ' \u00b7 Turno de ' + nombre;
        }
    }
    if (movEl) {
        if (!partida.iniciada || !esMiTurno() || partida.ganador) {
            movEl.textContent = '';
        } else if (partida.combate && partida.combate.pid === myId) {
            movEl.textContent = 'Elige Atacar o Retirada.';
        } else {
            var rest = maxPasosTurno() - (partida.pasos || 0);
            movEl.textContent = 'Pasos libres: ' + rest + (partida.movido ? ' \u00b7 Ya entraste a un hexagono.' : ' \u00b7 Aun puedes entrar a un hexagono (rojo).') +
                ' Puedes caminar y entrar en el orden que quieras.';
        }
    }

    var j = partida.jugadores[myId];
    if (!j) {
        var vacio = document.createElement('div');
        vacio.className = 'empty-message';
        vacio.textContent = partida.iniciada ? 'No participas en esta partida (entraste despues de repartir).' : 'Aun no tienes heroe';
        cont.appendChild(vacio);
        return;
    }

    // Vida: 10 cuadros del rojo al verde; los perdidos quedan como silueta punteada
    var vida = getVida(j);
    var barra = document.createElement('div');
    barra.className = 'vida-cuadros';
    barra.title = 'Vida ' + vida + ' / ' + VIDA_INICIAL_HEROE;
    for (var i = 0; i < 10; i++) {
        var pct = Math.max(0, Math.min(1, (vida - i * 10) / 10));
        var q = document.createElement('div');
        q.className = 'vida-cuadro' + (pct === 0 ? ' vacio' : '');
        q.style.setProperty('--c', 'hsl(' + Math.round(i * 12) + ', 78%, 46%)');
        if (pct > 0) {
            var rel = document.createElement('div');
            rel.className = 'vida-cuadro-relleno';
            rel.style.width = (pct * 100) + '%';
            q.appendChild(rel);
        }
        barra.appendChild(q);
    }
    cont.appendChild(barra);
    var num = document.createElement('div');
    num.className = 'vida-num';
    num.textContent = vida + ' / ' + VIDA_INICIAL_HEROE;
    cont.appendChild(num);

    // Carta del heroe
    var wrap = document.createElement('div');
    wrap.className = 'my-card-wrapper hero-wrapper' + (esMiTurno() ? ' activa' : '');
    var imgBox = document.createElement('div');
    imgBox.className = 'my-card-img';
    imgBox.addEventListener('click', function() { abrirZoomHeroe(myId); });
    var img = document.createElement('img');
    img.src = getImagenHeroe(j.heroe);
    img.alt = getNombreHeroe(j.heroe);
    imgBox.appendChild(img);
    wrap.appendChild(imgBox);
    cont.appendChild(wrap);
}

// ===== MIS CARTAS (manos de Botin y Potenciadores) y mazos =====
function pintarMano(cont, mano, tipo) {
    if (!cont) return;
    cont.innerHTML = '';
    if (!mano.length) {
        var vacio = document.createElement('div');
        vacio.className = 'empty-message';
        vacio.textContent = 'Sin cartas';
        cont.appendChild(vacio);
        return;
    }
    var cuenta = {};
    mano.forEach(function(n) { cuenta[n] = (cuenta[n] || 0) + 1; });
    Object.keys(cuenta).map(Number).sort(function(a, b) { return a - b; }).forEach(function(n) {
        var info = getInfoCarta(tipo, n);
        var d = document.createElement('div');
        d.className = 'carta-mini';
        var img = document.createElement('img');
        img.src = info.imagen;
        img.alt = info.titulo;
        img.loading = 'lazy';
        d.appendChild(img);
        if (cuenta[n] > 1) {
            var badge = document.createElement('div');
            badge.className = 'carta-mini-badge';
            badge.textContent = '\u00d7' + cuenta[n];
            d.appendChild(badge);
        }
        if (tipo === 'potenciador' && partida.jugadores[myId]) {
            var est = estadoPot(partida.jugadores[myId], n);
            var ins = document.createElement('div');
            ins.className = 'pot-estado ' + est;
            ins.textContent = est === 'activo' ? 'ON' : (est === 'usado' ? '\u2713' : (est === 'volteado' ? '\u2715' : '\u25b6'));
            d.appendChild(ins);
        }
        d.addEventListener('click', function() { abrirZoomCarta(tipo, n, true); });
        cont.appendChild(d);
    });
}
