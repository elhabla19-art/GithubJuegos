// leaderboard.js
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
        // Jugadores recien unidos que todavia podrian ser un reclamo de nombre
        // duplicado (alguien que se desconecto y volvio a entrar) no se
        // muestran hasta que se resuelva.
        if (typeof isJoiningHidden === 'function' && isJoiningHidden(id)) {
            continue;
        }
        var data = playersData[id];
        var puntos = puntosPorJugador[id] || 0;
        playersArr.push({
            id: id,
            name: data.name,
            puntos: puntos,
            selecciones: data.selecciones || [],
            activeCardId: data.activeCardId || null,
            offline: !!data.offline
        });
    }

    playersArr.sort(function(a, b) {
        return b.puntos - a.puntos;
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

        card.addEventListener('click', function(pid) {
            return function() {
                var todosEligieron = typeof todosEligieronCarta === 'function' && !todosEligieronCarta();
                if (todosEligieron) {
                    return;
                }

                var activeId = playersData[pid] ? playersData[pid].activeCardId : null;
                if (activeId) {
                    var carta = null;
                    for (var i = 0; i < cartas.length; i++) {
                        if (cartas[i].id === activeId) {
                            carta = cartas[i];
                            break;
                        }
                    }
                    if (carta) {
                        abrirZoom(carta, false, true);
                    } else {
                        showNotice('La carta activa de este jugador ya no esta disponible.');
                    }
                } else {
                    showNotice('Este jugador no tiene una carta activa seleccionada.');
                }
            };
        }(player.id));

        var badgeHtml = '';
        if (isHost) {
            badgeHtml += ' <span class="pc-host-tag">Anfitrion</span>';
        }
        if (player.offline) {
            badgeHtml += ' <span class="pc-offline-tag">Desconectado</span>';
        }
        if (player.activeCardId) {
            badgeHtml += ' <span style="background:#118C3C; color:white; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:bold; margin-left:6px;">Listo</span>';
        }

        // Igual que en Yatzy: el boton "Ser anfitrion" se muestra en la propia
        // fila del anfitrion cuando este figura desconectado (para que sea obvio
        // a quien se le esta ofreciendo el puesto), visible para cualquiera menos
        // el propio anfitrion offline.
        var canClaimHostHere = isHost && player.offline && !isMe;

        // Los botones ("Ser anfitrion" / eliminar) van ANTES que "Puntos: X"
        // dentro de pc-right, para que los puntos queden siempre pegados al
        // borde derecho (en columna, alineados entre todas las filas) y los
        // botones -cuando existen- aparezcan a su izquierda, en vez de
        // empujar el texto de puntos fuera de su posicion habitual.
        var rightHtml = '';
        if (canClaimHostHere) {
            rightHtml += '<button type="button" class="modal-btn btn-primary pc-claim-host-btn" data-claim-host="1">Ser anfitrion</button>';
        }
        if (soyAnfitrion && !isMe) {
            rightHtml += '<button type="button" class="pc-remove-btn" data-remove-id="' + player.id + '" title="Eliminar jugador">' + REMOVE_ICON_SVG + '</button>';
        }
        rightHtml += '<span class="pc-score">Puntos: ' + player.puntos + '</span>';

        var headerHtml = '<div class="player-card-header">' +
            '<span class="pc-name">' + player.name + (isMe ? ' (Tu)' : '') + badgeHtml + '</span>' +
            '<span class="pc-right">' + rightHtml + '</span>' +
        '</div>';

        var seleccionesHtml = '<div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">';
        if (player.selecciones.length === 0) {
            seleccionesHtml += '<span style="font-size:0.7rem; color:var(--text-muted);">Sin selecciones</span>';
        } else {
            for (var s = 0; s < player.selecciones.length; s++) {
                var cId = player.selecciones[s];
                var carta = null;
                for (var j = 0; j < cartas.length; j++) {
                    if (cartas[j].id === cId) {
                        carta = cartas[j];
                        break;
                    }
                }
                if (carta) {
                    var prefijo = getPrefijoCarta(carta.numero);
                    seleccionesHtml += '<span style="font-size:0.7rem; background:#2a2a4a; padding:2px 6px; border-radius:4px;">' + prefijo + ' - #' + carta.numero + '</span>';
                }
            }
        }
        seleccionesHtml += '</div>';
        card.innerHTML = headerHtml + seleccionesHtml;

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