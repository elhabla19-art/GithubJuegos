// cartas.js
// ===== DATOS DE LOS MAZOS: BOTIN, POTENCIADORES Y REGLAS =====
// Botin: [momento, efecto, copias en el mazo]  -> imagenes/botin/Botin_N.jpg
// Potenciadores: texto (1 copia cada uno)       -> imagenes/potenciadores/Potenciador_N.jpg
// Reglas: [nombre, texto] (1 copia cada una)    -> imagenes/reglas/Reglas_N.jpg
// De momento los efectos NO se ejecutan: las cartas se roban, se ven y se guardan.

var M_OPONENTE = 'Turno de un oponente (antes de pelear)';
var M_TURNO = 'En tu turno';
var M_DURANTE = 'Durante tu turno';
var M_ENTRE = 'Entre turnos';
var M_CUALQUIERA = 'En cualquier momento';

var TOTAL_BOTIN = 33;
var TOTAL_POTENCIADORES = 63;
var TOTAL_REGLAS = 10;

var DATOS_BOTIN = {
    1: [M_OPONENTE, 'El Monstruo objetivo obtiene +4 de Nivel sólo durante esta batalla', 2],
    2: [M_TURNO, 'Puedes completar una segunda acción este turno', 6],
    3: [M_ENTRE, 'Inflige 10 puntos de daño a un oponente de tu elección', 6],
    4: [M_ENTRE, 'Coloca una trampa en una habitación desocupada, excepto el punto inicial. Se pueden poner hasta 3 trampas en la misma habitación', 13],
    5: [M_ENTRE, 'Recuperas 10 puntos de Salud', 6],
    6: [M_ENTRE, 'Recuperas 20 puntos de Salud', 2],
    7: [M_ENTRE, 'Intercambia las posiciones de dos habitaciones desocupadas, que no sean el Depósito de Bebidas', 3],
    8: [M_ENTRE, 'Inflige 5 puntos de daño a todos los oponentes', 2],
    9: [M_TURNO, 'El Monstruo con el que estás a punto de luchar recibe una reducción de -4 de Nivel sólo por esta batalla', 2],
    10: [M_TURNO, 'Revela una habitación y muévete hacia ella. Si es un Monstruo o Jefe, primero debes derrotarlo. Si es el Guardián de la Bebida no puedes pelear con él. Esto cuenta como una acción', 5],
    11: [M_TURNO, 'Si acabas de perder una batalla contra un Monstruo o un Jefe, ignora el resultado y Todos los jugadores que participaron en la batalla deben volver a tirar', 6],
    12: [M_ENTRE, 'Roba un Potenciador a un oponente de tu elección', 6],
    13: [M_ENTRE, 'Elige un oponente. Muévelo a una habitación adyacente a su posición actual, que esté revelada, desocupada y sin trampas', 2],
    14: [M_ENTRE, 'Roba una Carta botín a un oponente de tu elección. No puedes ver sus cartas', 4],
    15: [M_ENTRE, 'Elige una habitación que no esté revelada. Echa un vistazo sin mostrarla a tus oponentes y colócala boca abajo en su posición', 4],
    16: [M_OPONENTE, 'El Monstruo objetivo obtiene +2 de Nivel solo por esta batalla', 4],
    17: [M_DURANTE, 'Muévete a una habitación revelada que no esté ocupada, sin Trampas, excepto el Depósito de Bebidas. No cuenta como una acción', 6],
    18: [M_ENTRE, 'Elige cualquier Monstruo o Jefe que haya sido derrotado y cuya habitación no esté ocupada. Dale la vuelta y se activará nuevamente', 3],
    19: [M_ENTRE, 'Después de jugar esta carta, el primer oponente que haga contacto visual contigo recibe 10 puntos de daño. Esto permanece vigente hasta que se inflija daño', 1],
    20: [M_ENTRE, 'Juega esta carta inmediatamente después de que un oponente juegue una Carta botín. Resuelve el efecto de su carta como si tu la hubieras jugado', 4],
    21: [M_TURNO, 'Solo para esta batalla contra un Monstruo o Jefe, tira el dado dos veces y usa el más alto como tu ataque. Esta carta niega el efecto de la carta Desventaja', 4],
    22: [M_OPONENTE, 'Solo para esta batalla contra un Monstruo o Jefe, el oponente tira el dado dos veces y usa el más bajo como su ataque. Esta carta niega el efecto de la carta Ventaja', 4],
    23: [M_ENTRE, 'Puedes elegir hasta tres oponentes y sanar a cada uno de ellos 5 puntos de Salud. Cúrate 5 puntos de Salud por cada oponente que hayas sanado', 2],
    24: [M_ENTRE, 'Cada oponente coloca 1 Carta botín boca abajo al centro. Todos tiran el dado. El jugador con el número más alto se queda con todas las cartas', 2],
    25: [M_CUALQUIERA, 'Si vas a recibir daño por cualquier razón, elige un oponente para que lo reciba en tu lugar', 2],
    26: [M_TURNO, 'Si revelas un Monstruo puedes entrar en la habitación sin pelear ni recibir recompensas. Al salir debes voltear boca abajo la habitación', 2],
    27: [M_ENTRE, 'Descarta esta carta junto con otras 2 Cartas botín. Roba un Potenciador', 2],
    28: [M_ENTRE, 'Descarta esta carta. Intercambia el resto de tus Cartas botín con las de un oponente de tu elección', 3],
    29: [M_ENTRE, 'Tus oponentes deben pasar 1 potenciador al jugador situado a su derecha. Si no tienen potenciadores, deben pasar una Carta botín en su lugar', 1],
    30: [M_ENTRE, 'Cuenta hasta tres. En tres, cada jugador debe señalar a un oponente. El jugador que más dedos lo señalen recibe 10 puntos de daño. No puedes ser el objetivo', 1],
    31: [M_ENTRE, 'Cuando juegues esta carta, todos tus oponentes deben poner una intensa "Cara de Batalla". El primero en sonreír o reírse, recibe 10 puntos de daño', 1],
    32: [M_ENTRE, 'Coloca una habitación desocupada en una ubicación diferente, excepto el Depósito de Bebidas. No pueden existir islas', 2],
    33: [M_DURANTE, 'Elige un oponente. Debe luchar contra el Monstruo que has revelado. Si pierde, recibirá el daño por ti. Si gana, recibirás la recompensa y ocuparás la habitación', 4]
};

var DATOS_POTENCIADORES = {
    1: 'Si recibes daño durante una batalla contra un Jefe, redúcelo en 5 puntos.',
    2: 'Tienes +2 de Ataque contra Monstruos. En tu turno, antes de completar una acción, puedes intercambiar este Potenciador con el de un oponente.',
    3: 'Tienes +2 de Ataque contra Jefes.',
    4: 'Puedes tener hasta 4 Potenciadores en tu mano.',
    5: 'Una vez durante tu turno, puedes ver en secreto una habitación que no se haya revelado y regresarla a su posición original.',
    6: 'Tienes +2 de Ataque en las batallas contra Jefes.',
    7: 'Tienes +2 de Ataque en las batallas contra Monstruos y en Duelos.',
    8: 'Cada vez que un oponente tire un 1, roba 3 Cartas botín.',
    9: 'Si obtienes más Potenciadores de los que puedes conservar, puedes barajar uno de tus potenciadores en el mazo y robar 2 Cartas de botín.',
    10: 'Cuando robes esta carta, busca en el mazo de Potenciadores y toma uno de tu elección, baraja a El Topo nuevamente en el mazo.',
    11: 'Una vez durante tu turno, puedes ponerte de pie, cerrar los ojos y dar tres vueltas y tirar el dado. Si cae en la zona de inicio, roba 2 Cartas botín.',
    12: 'Una vez durante tu turno, puedes tirar el dado. Si obtienes un número par, puedes evitar que un oponente en una habitación adyacente juegue Cartas botín durante su próximo turno.',
    13: 'Cada vez que comience tu turno, debes beber 5 puntos de tu barra de Salud. Tienes +3 en batallas contra Jefes y Monstruos.',
    14: 'Una vez durante tu turno, puedes exigir que todos tus oponentes se levanten y realicen un movimiento de artes marciales, quien decida no hacerlo, recibe 5 puntos de daño.',
    15: 'Una vez durante tu turno, puedes beber 5 puntos de tu barra de Salud. Si lo haces, puedes repetir tu tirada en una batalla contra Monstruos.',
    16: 'Si te sana el efecto de una Carta botín o un Potenciador, puedes sanarte 5 puntos más de Salud.',
    17: 'Una vez durante tu turno, puedes saltar sobre una habitación adyacente para llegar a una habitación revelada, excluyendo el Depósito de Bebidas. Cuenta como una acción.',
    18: 'Si no luchas contra un Monstruo, un Jefe o el Depósito de Bebidas durante tu turno, puedes curarte 5 puntos de Salud.',
    19: 'Tienes +1 de Ataque en las batallas contra Monstruos.',
    20: 'Tienes +1 de Ataque en las batallas contra Monstruos, Jefes y Duelos.',
    21: 'Cada vez que alguien obtenga un 20 en los dados, inflige 10 puntos de daño a un oponente de tu elección.',
    22: 'Antes de pelear contra un Monstruo puedes darle una Carta botín a un oponente, él tira el dado, si es un número par obtienes +4 de Ataque, si no +1.',
    23: 'Una vez durante tu turno, antes de completar una acción, puedes regresar 2 de tus Cartas botín al mazo y robar 2 Cartas botín nuevas.',
    24: 'Una vez durante tu turno, si derrotaste a un Monstruo, puedes Teletransportarte a una habitación revelada, desocupada y sin trampas, excluyendo el Depósito de Bebidas.',
    25: 'Tienes +1 de Ataque contra Monstruos.',
    26: 'Tienes +1 de Ataque contra Monstruos.',
    27: 'Tienes +1 de Ataque contra Monstruos.',
    28: 'Al iniciar tu turno, puedes robar Cartas botín hasta que tengas 3 en tu mano.',
    29: 'Al iniciar tu turno, puedes robar una Carta botín de un oponente que se encuentre en una habitación adyacente.',
    30: 'Obtienes +5 de Ataque en Duelos.',
    31: 'Tira un 5 o más para desarmar las Trampas.',
    32: 'Durante tu turno, antes de una batalla contra un Monstruo o Jefe, puedes beber 5 puntos de tu Salud para obtener +5 en tu tirada.',
    33: 'Cuando vayas a jugar una carta de Trampa, en lugar de colocar 1, coloca 3, pero no en el mismo habitación.',
    34: 'Obtienes +2 de Ataque contra Monstruos.',
    35: 'Una vez durante tu turno, puedes revelar una habitación adyacente y colocarla de nuevo boca abajo.',
    36: 'Si un oponente muere, puedes ver su mano y quedarte con una Carta botín. Si tu mueres, mantén todas tus Cartas botín y roba dos más.',
    37: 'Si estás en un Portal Mágico o en una habitación adyacente a uno, puedes Teletransportarte a una habitación que no esté ocupada y no tenga trampas. No cuenta como acción.',
    38: 'Una vez durante tu turno, puedes moverte a una habitación adicional que no esté ocupada.',
    39: 'Una vez durante tu turno, antes de completar cualquier acción, puedes hacerle 5 puntos de daño a un oponente en una habitación adyacente.',
    40: 'Una vez durante tu turno, puedes beber 5 puntos de tu Salud, si lo haces, roba 2 Cartas botín.',
    41: 'Una vez durante tu turno, si derrotaste a un Monstruo, tira el dado, si obtienes un número par, roba una Carta botín adicional.',
    42: 'Si pierdes 10 puntos de Salud contra un Monstruo, puedes tirar el dado, si obtienes un número par, elige un oponente y en su lugar ambos beben 5 puntos de daño.',
    43: 'Una vez durante tu turno, puedes intercambiar una habitación que tenga un Potenciador con otra habitación adyacente a ella. El Depósito de Bebidas no se puede mover.',
    44: 'Puedes sanarte 5 puntos de Salud cada que uses un Portal Mágico.',
    45: 'Una vez durante tu turno, puedes exigir a cada uno de los oponentes que te haga un cumplido, quien decida no hacerlo, recibe 5 puntos de daño.',
    46: 'Cada vez que un oponente juegue una Carta botín con la palabra "Nivel" en su nombre, recuperas 5 puntos de Salud.',
    47: 'Si tu Salud llega a 0, regresa este Potenciador al mazo, recuperas 20 puntos de Salud, conservas tus Cartas botín y tu posición en el Calabozo.',
    48: 'Una vez durante tu turno, si tienes menos de 2 Cartas botín en tu mano, puedes elegir un oponente para que te de una de sus Cartas botín.',
    49: 'Obtienes +2 de Ataque contra Monstruos.',
    50: 'Una vez durante tu turno, tira el dado, si obtienes un número par, elige el Potenciador de un oponente y colócalo boca abajo, no podrá ser usado hasta terminar su siguiente turno.',
    51: 'Si un oponente te roba una Carta botín o Potenciador, le infliges 5 puntos de daño.',
    52: 'Cuando robes ésta carta, tira el Dado del Caos y resuelve su efecto. Roba un nuevo Potenciador y revuelve ésta carta en el mazo.',
    53: 'Tus oponentes no pueden mover o colocar Trampas en las habitaciones adyacentes a la tuya.',
    54: 'Una vez durante tu turno, puedes ver las primeras 5 Cartas botín del mazo y regresarlas en cualquier orden.',
    55: 'Una vez durante tu turno, tira el dado, si obtienes un número par, puedes ver la mano de un oponente y robar todas sus cartas Trampa.',
    56: 'Durante tu turno, puedes devolver ésta carta al mazo y recuperar 25 puntos de Salud.',
    57: 'Una vez durante tu turno, tira el dado, si obtienes un número par, puedes intercambiar de lugar con un oponente en una habitación adyacente.',
    58: 'Una vez durante tu turno, puedes robar una Carta de botín. Tienes -1 punto de Ataque contra Monstruos.',
    59: 'Cuando pierdas una batalla contra un Monstruo, tira el dado, si obtienes un número par, roba una Carta botín.',
    60: 'Una vez durante tu turno, puedes descartar una Carta botín, si lo haces, reduce el Nivel del Monstruo en 3 puntos.',
    61: 'Tienes +3 de Ataque contra Monstruos de Nivel 10 o superior.',
    62: 'Tienes +1 de Ataque en las batallas contra Jefes.',
    63: 'Tienes +1 de Ataque contra Monstruos, pero si tienes exactamente 3 Cartas botín en tu mano obtienes +3 de Ataque.'
};

var DATOS_REGLAS = {
    1: ['Escudero de Dados', 'El jugador a tu izquierda tira el dado por ti.'],
    2: ['Tocar Tierra', 'Cada vez que un jugador usa un Portal Mágico, todos los demás jugadores deben tocar el suelo con su mano. El último jugador en hacerlo recibe 5 puntos de daño.'],
    3: ['El Campeón Humilde', 'Antes de que un jugador reciba una recompensa por derrotar a un Monstruo o Jefe, debe inclinar la cabeza. Si se olvida de hacerlo y otro jugador lo atrapa, recibe 5 puntos de daño.'],
    4: ['La Recompensa del Bufón', 'Si un jugador tiene 1 o menos Cartas Botín cuando comienza su turno, puede levantarse y hacer un baile divertido. Una vez que haya terminado el baile, puede robar una Carta Botín.'],
    5: ['Un Duendecillo', 'Cada vez que un jugador bebe de su copa de salud, primero debe eliminar a un "pequeño duendecillo" que está sentado en el borde de la copa. Si se olvida de hacerlo en cualquier momento y otro jugador lo descubre, recibirá 5 puntos de daño.'],
    6: ['Botín, botín, botín', 'Cada vez que un jugador juega una Carta Botín, debe anunciarlo sosteniendo la carta sobre su cabeza y diciendo "Botín, botín, botín". Si lo olvida y otro jugador lo descubre, recibe 5 puntos de daño.'],
    7: ['La Táctica del Ladrón', 'Si un jugador roba el dado de otro jugador de la mesa sin que este se dé cuenta, el ladrón puede exigir un rescate de 1 carta de botín para devolverlo. Todos los jugadores deben mantener su dado sobre la mesa y visible en todo momento.'],
    8: ['Bracitos de Duende', 'Todos los jugadores deben tirar su dado con "pequeños brazos de duende". Si se olvidan de hacerlo en cualquier momento y otro jugador los descubre, sufren 5 puntos de daño.'],
    9: ['Quién es el Jefe?', 'Cuando un jugador revela un Jefe, todos los demás jugadores deben tocarse la nariz con el dedo. El último jugador en hacerlo debe tirar los dados para la batalla contra el Jefe.'],
    10: ['El Viejo Acento', 'Durante su turno, todos los jugadores deben hablar con un acento que coincida con el de su personaje. Si olvidan hacerlo en cualquier momento durante su turno, recibirán 5 puntos de daño.']
};

// ===== IMAGENES / INFO =====
function getImagenBotin(n) { return 'imagenes/botin/Botin_' + n + '.jpg'; }
function getImagenPotenciador(n) { return 'imagenes/potenciadores/Potenciador_' + n + '.jpg'; }
function getImagenRegla(n) { return 'imagenes/reglas/Reglas_' + n + '.jpg'; }

// tipo: 'botin' | 'potenciador' | 'regla'
function getInfoCarta(tipo, n) {
    if (tipo === 'botin') {
        var b = DATOS_BOTIN[n] || ['', '', 0];
        return { imagen: getImagenBotin(n), titulo: 'Carta Botín #' + n, momento: b[0], texto: b[1] };
    }
    if (tipo === 'potenciador') {
        return { imagen: getImagenPotenciador(n), titulo: 'Potenciador #' + n, momento: '', texto: DATOS_POTENCIADORES[n] || '' };
    }
    var r = DATOS_REGLAS[n] || ['Regla', ''];
    return { imagen: getImagenRegla(n), titulo: r[0], momento: '', texto: r[1] };
}

// ===== CONSTRUCCION DE MAZOS =====
// Cada mazo es una lista de numeros de carta (los repetidos son copias); el tope es el indice 0.
function construirMazos() {
    var botin = [];
    for (var n = 1; n <= TOTAL_BOTIN; n++) {
        for (var c = 0; c < DATOS_BOTIN[n][2]; c++) botin.push(n);
    }
    return {
        botin: mezclar(botin),
        potenciadores: mezclar(rangoNumeros(TOTAL_POTENCIADORES)),
        reglas: mezclar(rangoNumeros(TOTAL_REGLAS))
    };
}

window.getInfoCarta = getInfoCarta;
window.construirMazos = construirMazos;
