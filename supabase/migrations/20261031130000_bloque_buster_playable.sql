update public.games
set playable = true,
    max_score = 2080,
    long = 'Mueve la paleta con las flechas y rebota la pelota para pulverizar cinco muros de bloques de neón: parrilla, pirámide, tablero de ajedrez, filas con huecos y un marco con cruz. Cada bloque suma 10 puntos, tienes 3 vidas y la pelota gana un 10 % de velocidad en cada nivel. Desde la pausa puedes saltar a cualquier nivel.'
where id = 'bloque-buster';
