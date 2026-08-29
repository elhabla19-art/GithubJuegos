// zoom.js - EcoTrole
var cartaEnZoom = null;

// permitirActivar: true solo para cartas de Accion en la mano del jugador (muestra boton "Activar")
function abrirZoom(carta, permitirActivar) {
    if (permitirActivar === undefined) permitirActivar = false;
    cartaEnZoom = carta;
    var modal = document.getElementById('zoomModal');
    var content = document.getElementById('zoomContent');

    content.innerHTML = '';
    var img = document.createElement('img');
    img.src = carta.imagen;
    img.alt = 'Carta ' + carta.numero;
    content.appendChild(img);

    var info = document.createElement('div');
    info.className = 'zoom-info';
    var etiqueta = carta.tipo === 'habilidad' ? 'Habilidad' : 'Accion';
    var prefijo = carta.tipo === 'habilidad' ? 'HAB' : 'ACC';
    info.innerHTML = etiqueta + ' <span>' + prefijo + ' #' + carta.numero + '</span>';
    content.appendChild(info);

    if (permitirActivar && carta.tipo === 'accion') {
        var activarBtn = document.createElement('button');
        activarBtn.className = 'modal-btn btn-primary zoom-activar-btn';
        activarBtn.style.marginTop = '4px';
        activarBtn.textContent = 'Activar';
        activarBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            activarCartaEnZoom();
        });
        content.appendChild(activarBtn);
    }

    modal.style.display = 'flex';
}

function activarCartaEnZoom() {
    if (!cartaEnZoom || cartaEnZoom.tipo !== 'accion') return;
    var cartaId = cartaEnZoom.id;
    cerrarZoom();
    if (typeof activarAccion === 'function') {
        activarAccion(cartaId);
    }
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
});

window.abrirZoom = abrirZoom;
window.cerrarZoom = cerrarZoom;
window.activarCartaEnZoom = activarCartaEnZoom;