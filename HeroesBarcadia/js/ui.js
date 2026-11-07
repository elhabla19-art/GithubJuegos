// ui.js
var SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}

// ===== TABLERO =====
function renderizarTablero() {
    var cont = document.getElementById('tablero');
    if (!cont) return;
    cont.innerHTML = '';

    if (!partida.iniciada || !partida.hexes.length) {
        cont.innerHTML = '<div class="tablero-vacio">Presiona "Heroes" para comenzar la partida</div>';
        return;
    }

    var dim = hexDimensiones();
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    partida.hexes.forEach(function(h) {
        var c = hexAPixel(h.q, h.r);
        minX = Math.min(minX, c.x - dim.w / 2); maxX = Math.max(maxX, c.x + dim.w / 2);
        minY = Math.min(minY, c.y - dim.h / 2); maxY = Math.max(maxY, c.y + dim.h / 2);
    });
    var pad = 6;
    var svg = svgEl('svg', {
        'class': 'tablero-svg',
        viewBox: (minX - pad) + ' ' + (minY - pad) + ' ' + (maxX - minX + pad * 2) + ' ' + (maxY - minY + pad * 2)
    });

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

        // Capa de interaccion / resaltado
        var clases = 'hex-hit';
        if (opciones.mover[h.id] === 1) clases += ' alc1';
        else if (opciones.mover[h.id] === 2) clases += ' alc2';
        else if (opciones.entrar[h.id]) clases += ' entrar';
        if (h.id === miPos) clases += ' actual';
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

        g.addEventListener('click', function() { abrirZoomHex(h.id); });
        svg.appendChild(g);
    });

    cont.appendChild(svg);
}

// ===== MI HEROE Y TURNO =====
function renderizarMiHeroe() {
    var cont = document.getElementById('my-hero-container');
    var turnoEl = document.getElementById('turnoDisplay');
    var movEl = document.getElementById('movimientoDisplay');
    if (!cont) return;
    cont.innerHTML = '';

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
        } else if (partida.movido) {
            movEl.textContent = 'Ya entraste a un hexagono. Pulsa "Pasar turno" cuando termines.';
        } else {
            var rest = MAX_PASOS - (partida.pasos || 0);
            movEl.textContent = 'Pasos libres: ' + rest + '. Camina por hexagonos libres (amarillo 1 paso, verde 2) y luego entra a uno sin explorar junto a ti (rojo).';
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

    var wrap = document.createElement('div');
    wrap.className = 'my-card-wrapper hero-wrapper' + (esMiTurno() ? ' activa' : '');
    var imgBox = document.createElement('div');
    imgBox.className = 'my-card-img';
    imgBox.addEventListener('click', function() { abrirZoomHeroe(myId); });
    var img = document.createElement('img');
    img.src = getImagenHeroe(j.heroe);
    img.alt = getNombreHeroe(j.heroe);
    imgBox.appendChild(img);
    var num = document.createElement('div');
    num.className = 'mini-number';
    num.textContent = getNombreHeroe(j.heroe);
    imgBox.appendChild(num);
    wrap.appendChild(imgBox);
    var pos = buscarHex(j.posicion);
    var info = document.createElement('div');
    info.className = 'mini-vida';
    info.textContent = pos ? (pos.tipo === 'centro' ? 'En el portal' : pos.tipo === 'inicio' ? 'En un inicio' : 'En el calabozo') : '';
    wrap.appendChild(info);
    cont.appendChild(wrap);

    // Vida, botin y potenciadores
    var vida = getVida(j);
    var stats = document.createElement('div');
    stats.className = 'hero-stats';
    stats.innerHTML =
        '<div class="vida-texto">Vida ' + vida + ' / ' + VIDA_INICIAL_HEROE + '</div>' +
        '<div class="vida-barra"><div class="vida-relleno" style="width:' + Math.max(0, Math.min(100, vida)) + '%"></div></div>' +
        '<div class="hero-recompensas">Botin: <b>' + (j.manoBotin || []).length + '</b> \u00b7 Potenciadores: <b>' + (j.manoPot || []).length + '</b></div>';
    cont.appendChild(stats);
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
        d.addEventListener('click', function() { abrirZoomCarta(tipo, n); });
        cont.appendChild(d);
    });
}

function renderizarMisCartas() {
    var j = partida.jugadores[myId];
    pintarMano(document.getElementById('my-botin-container'), j ? (j.manoBotin || []) : [], 'botin');
    pintarMano(document.getElementById('my-pot-container'), j ? (j.manoPot || []) : [], 'potenciador');
    var mz = document.getElementById('mazosDisplay');
    if (mz) {
        mz.textContent = partida.iniciada
            ? 'Mazos \u00b7 Botin ' + partida.mazos.botin.length + ' \u00b7 Potenciadores ' + partida.mazos.potenciadores.length + ' \u00b7 Reglas ' + partida.mazos.reglas.length
            : '';
    }
}
