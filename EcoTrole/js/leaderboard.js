// leaderboard.js - EcoTrole
// Solo muestra el nombre de los jugadores en el leaderboard
var REMOVE_ICON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14"><line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

function renderLeaderboard() {
    var list = document.getElementById('playersList');
    list.innerHTML = '';
    var playerIds = Object.keys(playersData);

    if (playerIds.length === 0) {
        list.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Esperando jugadores...</div>';
        return;
    }

    var playersArr = [];
    for (var i = 0; i < playerIds.length; i++) {
        var id = playerIds[i];
        if (typeof isJoiningHidden === 'function' && isJoiningHidden(id)) {
            continue;
        }
        var data = playersData[id];
        playersArr.push({
            id: id,
            name: data.name,
            offline: !!data.offline,
            rol: data.rol || null,
            estadoJuego: data.estadoJuego || null
        });
    }

    playersArr.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

    for (var p = 0; p < playersArr.length; p++) {
        var player = playersArr[p];
        var isMe = player.id === myId;
        var isHost = (typeof hostId !== 'undefined') && hostId === player.id;
        var soyAnfitrion = (typeof hostId !== 'undefined') && hostId === myId;

        var card = document.createElement('div');
        card.className = 'player-card' +
            (isMe ? ' me' : '') +
            (isHost ? ' is-host' : '') +
            (player.offline ? ' pc-offline' : '');

        var badgeHtml = '';
        if (isHost) {
            badgeHtml += ' <span class="pc-host-tag">Anfitrion</span>';
        }
        if (player.offline) {
            badgeHtml += ' <span class="pc-offline-tag">Desconectado</span>';
        }
        // Revelacion de rol: solo se muestra una vez que el jugador llego a la
        // Meta o fue Expulsado (definido en roles.js / decision del anfitrion).
        var revelado = player.estadoJuego && player.rol &&
            typeof ESTADO_JUGADOR !== 'undefined' && player.estadoJuego !== ESTADO_JUGADOR.ACTIVO;
        if (revelado) {
            var infoRol = (typeof ROLES_INFO !== 'undefined' && ROLES_INFO[player.rol]) || null;
            var nombreRol = infoRol ? infoRol.nombre : player.rol;
            var emojiRol = infoRol ? infoRol.emoji : '';
            badgeHtml += ' <span class="pc-rol-tag ' + player.rol + '">' + emojiRol + ' ' + nombreRol + '</span>';
            var esMeta = player.estadoJuego === (typeof ESTADO_JUGADOR !== 'undefined' ? ESTADO_JUGADOR.META : 'meta');
            badgeHtml += ' <span class="pc-estado-tag ' + player.estadoJuego + '">' +
                (esMeta ? '🏁 Meta' : '🚫 Expulsado') + '</span>';
        }

        var canClaimHostHere = isHost && player.offline && !isMe;

        var rightHtml = '';
        if (canClaimHostHere) {
            rightHtml += '<button type="button" class="modal-btn btn-primary pc-claim-host-btn" data-claim-host="1">Ser anfitrion</button>';
        }
        if (soyAnfitrion && !isMe) {
            rightHtml += '<button type="button" class="pc-remove-btn" data-remove-id="' + player.id + '" title="Eliminar jugador">' + REMOVE_ICON_SVG + '</button>';
        }

        var headerHtml = '<div class="player-card-header">' +
            '<span class="pc-name">' + player.name + (isMe ? ' (Tu)' : '') + badgeHtml + '</span>' +
            '<span class="pc-right">' + rightHtml + '</span>' +
        '</div>';

        card.innerHTML = headerHtml;

        var claimBtn = card.querySelector('[data-claim-host="1"]');
        if (claimBtn) {
            claimBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (typeof claimHost === 'function') {
                    claimHost();
                }
            });
        }
        var removeBtn = card.querySelector('[data-remove-id]');
        if (removeBtn) {
            removeBtn.addEventListener('click', function(pid) {
                return function(e) {
                    e.stopPropagation();
                    if (typeof solicitarEliminarJugador === 'function') {
                        solicitarEliminarJugador(pid);
                    }
                };
            }(removeBtn.getAttribute('data-remove-id')));
        }

        list.appendChild(card);
    }
}