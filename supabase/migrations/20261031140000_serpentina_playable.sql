update public.games
set playable = true,
    max_score = 2970,
    long = 'Una serpiente de luz recorre una cuadrícula de 20×15 buscando fruta. Muévela con las flechas o WASD: cada pieza suma 10 puntos y la alarga, y cada 5 frutas subes de nivel y ganas velocidad. Los muros se atraviesan y reaparecen por el lado opuesto; solo pierdes si te muerdes la cola.'
where id = 'serpentina';
