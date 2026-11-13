// ===== LEADERBOARD =====
const REMOVE_ICON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14"><line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

function renderLeaderboard() {
    const list = document.getElementById('playersList');
    if (!list) return;
    list.innerHTML = '';

    const showHostControls = isRoomCreator && !gameStarted;
    // Durante la partida el anfitrion solo puede eliminar a jugadores desconectados,
    // pidiendo confirmacion (a diferencia del "X" instantaneo de antes de iniciar).
    const showIngameRemove = isRoomCreator && gameStarted;

    // Jugadores recien unidos que todavia podrian ser un reclamo de nombre duplicado
    // (alguien que se desconecto y volvio a entrar) no se muestran hasta que se resuelva.
    const isHidden = (id) => typeof hiddenJoiningIds !== 'undefined' && hiddenJoiningIds.has(id);

    let arr;
    if (!gameStarted) {
        // Antes de iniciar: se muestra en el orden de turnos (pendingOrder), para que el
        // anfitrion pueda reordenar y ver de inmediato el color/posicion de cada quien.
        arr = pendingOrder.filter(id => playersData[id]).map(id => ({ id, ...playersData[id] }));
        Object.keys(playersData).forEach(id => {
            if (!arr.some(p => p.id === id)) arr.push({ id, ...playersData[id] });
        });
    } else {
        arr = Object.keys(playersData).map(id => ({ id, ...playersData[id] })).sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    arr = arr.filter(p => !isHidden(p.id));

    arr.forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'player-card';
        card.style.borderLeftColor = colorHexOf(p.color);
        const isTurn = gameStarted && turnOrder[currentTurnIndex] === p.id;

        // Antes de iniciar la partida no hay puntaje que mostrar (siempre es 0), asi que
        // el boton de eliminar (X) ocupa ese mismo lugar en vez de amontonarse junto a las
        // flechas de orden. Las flechas de orden van aparte, a su izquierda.
        let orderHTML = '';
        let scoreSlotHTML = `<span class="pc-score">${p.score || 0}</span>`;
        let ingameRemoveHTML = '';
        if (showHostControls) {
            const canRemove = p.id !== myId;
            orderHTML = `
                <span class="pc-order-controls">
                    <button type="button" class="pc-order-btn" data-act="up" ${idx === 0 ? 'disabled' : ''} title="Subir">&#9650;</button>
                    <button type="button" class="pc-order-btn" data-act="down" ${idx === arr.length - 1 ? 'disabled' : ''} title="Bajar">&#9660;</button>
                </span>`;
            scoreSlotHTML = canRemove
                ? `<button type="button" class="pc-remove-btn" data-act="remove" title="Eliminar">${REMOVE_ICON_SVG}</button>`
                : '';
        } else if (showIngameRemove && p.id !== myId && p.offline) {
            ingameRemoveHTML = `<button type="button" class="pc-remove-btn pc-remove-btn-ingame" data-act="remove-ingame" title="Eliminar de la partida (desconectado)">${REMOVE_ICON_SVG}</button>`;
        }

        // Boton "Ser anfitrion" directamente en la fila de quien era el anfitrion,
        // visible para cualquiera (no solo el actual anfitrion) apenas figura offline.
        const canClaimHostHere = p.id === hostId && p.offline && p.id !== myId;
        const claimHostHTML = canClaimHostHere
            ? `<button type="button" class="modal-btn btn-primary pc-claim-host-btn" data-act="claim-host">Ser anfitrion</button>`
            : '';

        const offlineTagHTML = p.offline ? '<span class="pc-offline-tag">Desconectado</span>' : '';

        card.classList.toggle('pc-offline', !!p.offline);
        card.innerHTML = `
            <span class="pc-name">
                <span style="width:10px;height:10px;border-radius:50%;background:${colorHexOf(p.color)};display:inline-block;flex-shrink:0;"></span>
                ${p.name}${p.id === myId ? ' (Tu)' : ''}${isTurn ? '<span class="pc-turn-tag">TURNO</span>' : ''}${offlineTagHTML}
            </span>
            <span class="pc-right">
                ${claimHostHTML}
                ${scoreSlotHTML}
                ${orderHTML}
                ${ingameRemoveHTML}
            </span>`;

        if (showHostControls) {
            const upBtn = card.querySelector('[data-act="up"]');
            const downBtn = card.querySelector('[data-act="down"]');
            const removeBtn = card.querySelector('[data-act="remove"]');
            if (upBtn) upBtn.addEventListener('click', (e) => { e.stopPropagation(); movePlayerUp(p.id); });
            if (downBtn) downBtn.addEventListener('click', (e) => { e.stopPropagation(); movePlayerDown(p.id); });
            if (removeBtn) removeBtn.addEventListener('click', (e) => { e.stopPropagation(); hostRemovePlayer(p.id); });
        } else {
            if (showIngameRemove && p.id !== myId && p.offline) {
                const removeIngameBtn = card.querySelector('[data-act="remove-ingame"]');
                if (removeIngameBtn) removeIngameBtn.addEventListener('click', (e) => { e.stopPropagation(); requestRemovePlayer(p.id); });
            }
            card.addEventListener('click', () => openViewPlayer(p.id));
        }

        if (canClaimHostHere) {
            const claimBtn = card.querySelector('[data-act="claim-host"]');
            if (claimBtn) claimBtn.addEventListener('click', (e) => { e.stopPropagation(); claimHost(); });
        }

        list.appendChild(card);
    });
    refreshViewPlayerIfOpen();
}