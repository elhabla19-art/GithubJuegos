// zoom.js - EcoTrole
var cartaEnZoom = null;

function abrirZoom(carta, mostrarBoton, soloVisualizacion) {
    if (mostrarBoton === undefined) mostrarBoton = true;
    if (soloVisualizacion === undefined) soloVisualizacion = false;
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
    var prefijo = carta.tipo === 'habilidad' ? 'HAB' : 'OBJ';
    info.innerHTML = (carta.tipo === 'habilidad' ? 'Habilidad' : 'Objeto') + ' <span>' + prefijo + ' #' + carta.numero + '</span>';
    content.appendChild(info);

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
});

window.abrirZoom = abrirZoom;
window.cerrarZoom = cerrarZoom;