// leaderboard.js
var REMOVE_ICON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14"><line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

function escaparHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderLeaderboard() {
    var list = document.getElementById('playersList');
    if (!list) return;
    list.innerHTML = '';

    // Con partida iniciada se muestra en orden de turnos; antes, en orden de llegada.
    var ids = Object.keys(playersData).filter(function(id) {
        return !(typeof isJoiningHidden === 'function' && isJoiningHidden(id));
    });
    if (partida.iniciada) {
        ids.sort(function(a, b) {
            var ia = partida.orden.indexOf(a), ib = partida.orden.indexOf(b);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });
    }

    if (ids.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Esperando jugadores...</div>';
        return;
    }

    var turnoId = turnoActualId();
    var soyAnfitrion = (typeof hostId !== 'undefined') && hostId === myId;

    ids.forEach(function(pid) {
        var data = playersData[pid];
        var isMe = pid === myId;
        var isHost = hostId === pid;
        var offline = !!data.offline;
        var j = partida.jugadores[pid];

        var card = document.createElement('div');
        card.className = 'player-card' + (isMe ? ' me' : '') + (isHost ? ' is-host' : '') +
            (offline ? ' pc-offline' : '') + (pid === turnoId ? ' en-turno' : '');
        card.addEventListener('click', function() {
            if (!j) { showNotice('Este jugador todavia no tiene un heroe.'); return; }
            abrirZoomHeroe(pid);
        });

        var badges = '';
        if (isHost) badges += ' <span class="pc-host-tag">Anfitrion</span>';
        if (offline) badges += ' <span class="pc-offline-tag">Desconectado</span>';
        if (pid === turnoId) badges += ' <span class="pc-turno-tag">Turno</span>';

        var rightHtml = '';
        if (isHost && offline && !isMe) {
            rightHtml += '<button type="button" class="modal-btn btn-primary pc-claim-host-btn" data-claim-host="1">Ser anfitrion</button>';
        }
        if (soyAnfitrion && !isMe) {
            rightHtml += '<button type="button" class="pc-remove-btn" data-remove-id="' + escaparHtml(pid) + '" title="Eliminar jugador">' + REMOVE_ICON_SVG + '</button>';
        }

        var avatar = j
            ? '<img class="pc-hero" src="' + getImagenHeroe(j.heroe) + '" alt="' + getNombreHeroe(j.heroe) + '">'
            : '<span class="pc-hero pc-hero-vacio">?</span>';
        var heroeTxt = j ? (getNombreHeroe(j.heroe) + ' \u00b7 Vida ' + getVida(j) + ' \u00b7 Botin ' + (j.manoBotin || []).length + ' \u00b7 Pot. ' + (j.manoPot || []).length) : 'Sin heroe';

        card.innerHTML =
            '<div class="player-card-header">' +
                '<span class="pc-name">' + avatar + '<span class="pc-name-text">' + escaparHtml(data.name) + (isMe ? ' (Tu)' : '') + '</span>' + badges + '</span>' +
                '<span class="pc-right">' + rightHtml + '</span>' +
            '</div>' +
            '<div class="pc-sub">' + heroeTxt + '</div>';

        // Los Potenciadores son equipo visible para todos
        if (j && (j.manoPot || []).length) {
            var fila = document.createElement('div');
            fila.className = 'pc-pots';
            j.manoPot.forEach(function(n) {
                var im = document.createElement('img');
                im.src = getImagenPotenciador(n);
                im.alt = 'Potenciador ' + n;
                im.title = 'Potenciador #' + n;
                im.addEventListener('click', function(e) { e.stopPropagation(); abrirZoomCarta('potenciador', n, false); });
                fila.appendChild(im);
            });
            card.appendChild(fila);
        }

        var claimBtn = card.querySelector('[data-claim-host="1"]');
        if (claimBtn) {
            claimBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (typeof claimHost === 'function') claimHost();
            });
        }
        var removeBtn = card.querySelector('[data-remove-id]');
        if (removeBtn) {
            removeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                solicitarEliminarJugador(pid);
            });
        }
        list.appendChild(card);
    });
}
