// zoom.js
var cartaEnZoom = null;

function abrirZoom(carta, mostrarBoton, soloVisualizacion) {
    if (mostrarBoton === undefined) mostrarBoton = true;
    if (soloVisualizacion === undefined) soloVisualizacion = false;
    cartaEnZoom = carta;
    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');

    if (!soloVisualizacion && carta.seleccionadoPor && carta.seleccionadoPorId !== myId) {
        showNotice('Esta carta ya fue seleccionada por ' + carta.seleccionadoPor);
        return;
    }

    content.innerHTML = '';
    var img = document.createElement('img');
    img.src = carta.imagen;
    img.alt = 'Corredor ' + carta.numero;
    content.appendChild(img);
    var info = document.createElement('div');
    info.className = 'zoom-info';
    var prefijo = getPrefijoCarta(carta.numero);
    info.innerHTML = 'Corredor <span>' + prefijo + ' - #' + carta.numero + '</span>';
    content.appendChild(info);

    if (mostrarBoton && !carta.seleccionadoPor) {
        var btn = document.createElement('button');
        btn.className = 'btn-choose';
        btn.textContent = 'Escoger';
        btn.addEventListener('click', function() {
            if (cartaEnZoom && !cartaEnZoom.seleccionadoPor) {
                if (typeof window.seleccionarCarta === 'function') {
                    window.seleccionarCarta(cartaEnZoom.id);
                } else {
                    showNotice('Error: funcion de seleccion no disponible.');
                }
            }
            cerrarZoom();
        });
        content.appendChild(btn);
    }
    modal.style.display = 'flex';
}

function cerrarZoom() {
    document.getElementById('zoomModal').style.display = 'none';
    cartaEnZoom = null;
}

document.addEventListener('DOMContentLoaded', function() {
    var modal = document.getElementById('zoomModal');
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            cerrarZoom();
        }
    });

    // Cerrar modal de intercambio al hacer clic fuera
    var intercambioModal = document.getElementById('intercambioModal');
    if (intercambioModal) {
        intercambioModal.addEventListener('click', function(e) {
            if (e.target === intercambioModal) {
                cerrarIntercambio();
            }
        });
    }
});