---
title: "Use After Free"
date: 2019-02-24 11:02:38
author: "Pixis"
layout: post
permalink: /use-after-free/
disqus_identifier: 0000-0000-0000-00a4
cover: assets/uploads/2019/02/uafbanner.png
description: "Aujourd'hui, nous allons découvrir ensemble une nouvelle zone mémoire, le tas (ou la Heap), en explicitant une vulnérabilité relativement commune dans les programmes récents, appelée use-after-free."
tags:
  - Linux
  - "User Land"
---

Nous nous sommes intéressés à différentes vulnérabilités qui mettaient en jeu la pile suite à des overflows ([Buffer Overflow](/buffer-overflow/), [Ret2Libc](/retour-a-la-libc/), [ROP](/return-oriented-programming)). Aujourd'hui, nous allons découvrir ensemble une nouvelle zone mémoire, le tas (ou la Heap), en explicitant une vulnérabilité relativement commune dans les programmes récents, appelée "use-after-free".

<!--more-->

## La Heap

Contrairement à la pile dont le fonctionnement a été expliqué dans [cet article](https://beta.hackndo.com/stack-introduction/), la *heap* (le tas) est une zone mémoire utilisée pour des allocations dynamiques. Pour cela, tous les espaces mémoires dans la *heap* peuvent être utilisés à n'importe quel moment. Il n'y a plus de notion d'empilement, dépilement. N'importe quel bloc peut être alloué ou libéré à tout instant.

On comprend assez intuitivement que ce système est beaucoup plus souple, mais qu'en contrepartie, il est plus lent et complexe, puisqu'il faut garder un état de la mémoire afin de savoir si un bloc est alloué ou non.

Mais alors, comment alloue-t-on de la mémoire, ou comment la libère-t-on, et que se passe-t-il en réalité ?

## Malloc/Free

Nous allons parler ici de deux fonctions, `malloc()` et `free()`, bien qu'il en existe d'autres (`calloc()` par exemple). Le principe reste le même.

### Malloc

La fonction `malloc()` demande à l'OS de lui allouer un bloc mémoire d'une certaine taille. Si cette allocation est possible, alors `malloc()` va renvoyer un pointeur vers le début de ce bloc.

[![Malloc](/assets/uploads/2019/02/malloc.png)](/assets/uploads/2019/02/malloc.png)


En C, voici ce que le schéma ci-dessus représente.

```c
char *pointeur;
pointeur = malloc(32);
# D'après le schéma ci-dessus, la valeur de "pointeur" sera 0x55e700000010
```

L'OS va donc trouver 32 octets disponibles, et renvoyer l'adresse de ce bloc mémoire qui sera ici assigné à la variable `pointeur`. Le développeur peut alors utiliser cet espace mémoire pour stocker de l'information, par exemple une chaine de caractères, de la façon suivante :

```c
strncpy(pointeur, "Hello World!", 13);
```

Les caractères `['H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd', '!', '\x00']` seront placés dans la zone mémoire allouée par `malloc()`.

### Free

Une fois que la mémoire allouée n'est plus utilisée, il faut penser à la libérer à l'aide de la fonction `free()`.

```c
// Cette zone mémoire n'est plus utile
free(pointeur);
```

Dans cet état, la variable `pointeur` contient toujours l'adresse de la zone mémoire utilisée précédemment, sauf que celle-ci n'est plus allouée. Si une nouvelle allocation est demandée, il y a des chances pour que cette zone mémoire soit réutilisée. Dans ce cas, `pointeur` pointera vers cette zone nouvellement allouée, mais dont les données n'ont plus rien à voir. Pour ne pas se retrouver dans cet état, il faut donc également penser à réinialiser le pointeur.

```c
pointeur = NULL;
```

Voici un petit programme d'exemple qui montre ces différentes actions.

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char ** argv) {
        // Deux pointeurs sont déclarés et initialisé à NULL
        char *pointeurA = NULL;
        char *pointeurB = NULL;

        // Une zone mémoire va être allouée, et le premier pointeur va pointer dessus
        pointeurA = malloc(16);
        printf("La variable pointeurA pointe vers %p\n", pointeurA);

        // On ajoute de la donnée dans cette zone mémoire
        strncpy(pointeurA, "Hello World!", 12);
        printf("Voici ce qui est à l'adresse %p, pointée par pointeurA : %s\n", pointeurA, pointeurA);

        // Nous n'avons plus besoin de pointeurA, nous allons donc libérer la zone mémoire
        free(pointeurA);
        pointeurA = NULL;
        printf("La zone mémoire a été libérée !\n");

        /*
         *   [...]
         */

        // Plus tard dans le programme, nous avons besoin d'une nouvelle zone mémoire.
        pointeurB = malloc(16);
        printf("La variable pointeurB pointe vers %p\n", pointeurB);
        // Puis on la libère
        free(pointeurB);
        pointeurB = NULL;
        return 0;
}
```

Une fois compilé, ce code donne la sortie suivante :

```
La variable pointeurA pointe vers 0x55e703641010
Voici ce qui est à l'adresse 0x55e703641010, pointée par pointeurA : Hello World!
La zone mémoire a été libérée !
La variable pointeurB pointe vers 0x55e703641010
```

On remarque une chose importante : Après libération du bloc mémoire pointé par `pointeurA`, lors de la nouvelle allocation, la même adresse est utilisée (`0x55f8d82d1010`) et assignée à `pointeurB`, puisque ce bloc mémoire était à nouveau libre. 

## Use-After-Free

### L'erreur

Quand tout est correctement fait, il n'y a pas vraiment d'exploitation possible. Deux erreurs peuvent alors être commises par les programmeurs.

* Soit ils oublient de **libérer la mémoire** : Dans ce cas, le programme présentera une fuite mémoire puisqu'il ne libèrera jamais de la mémoire allouée. Ce n'est pas un problème de sécurité, mais c'est tout de même une mauvaise pratique.
* Soit ils oublient de **réinitialiser un pointeur** après une libération de la mémoire : Dans ce cas, si jamais le pointeur est utilisé plus tard pour une raison quelconque, il pointera vers une zone mémoire non initialisée, voire réutilisée pour d'autres raisons, ce qui peut faire crasher le programme, mais peut également être exploité.

C'est dans ce deuxième cas qu'on appelle l'exploitation "Use after free", puisqu'on utilise un pointeur après qu'il a été libéré, sans pour autant avoir été réinitialisé.

### Exemple

Voici un petit bout de programme qui présente un danger potentiel. Les commentaires devraient être suffisamment explicites pour comprendre ce qu'il se passe.

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char ** argv) {
        // Deux pointeurs admin et prénom, qui n'ont rien à voir l'un et l'autre dans le code
        char *admin = NULL;
        char *prenom = NULL;

        // Par défaut, l'utilisateur qui lance ce programme n'est pas administrateur. C'est tout.
        admin = malloc(32);
        admin[0] = 0;

        /*
         * Du code, du code, du code [...]
         */

        // Un moment, dans le code, la zone mémoire de admin est libérée, mais la variable admin n'est pas réinitialisée !
        free(admin);

        /*
         * Et encore du code [...]
         */

        // Et puis une autre allocation de mémoire est faite.
        // Sauf que comme admin a été libéré, cette nouvelle zone mémoire réutilise cet espace !
        prenom = malloc(32);
        strncpy(prenom, "pixis", 5);

        /*
         * Toujours du code [...]
         */
        
        // Ici, admin pointe toujours vers la zone mémoire initiale, qui a été réutilisée par "prenom".
        // Du coup, admin[0] vaut "p", admin[1] vaut "i", etc.
        // Ainsi, d'après cette vérification, nous sommes administrateur !
        if (admin == NULL || admin[0] == 0) {
                printf("Cette section est interdite !\n");
                return -1;
        }
        
        printf("Zone d'administration super secrète !\n");

        /*
         * Et puis du code [...]
         */

        free(prenom);
        prenom = NULL;
        return 0;
}
```

Ce qui, à l'exécution, donne :

```
Zone d'administration super secrète !
```
Cet exemple montre clairement le problème de l'utilisation d'un pointeur après qu'il a été libéré. 

C'est évidemment un exemple un peu trivial, qui permet seulement d'illustrer le comportement du use-after-free, mais cette vulnérabilité peut être retrouvée dans des programmes qui gèrent la création et suppression d'objets, l'authentification, ...

Si par exemple une structure de ce type est manipulée :

```c
struct user {
    int id;
    char *name;
    int isAdmin;
}
```

Il suffit qu'une instance soit allouée puis supprimée, et que suite à cela, une autre allocation écrase cette zone mémoire en faisant en sorte que l'offset correspondant à "isAdmin" soit à 1 pour que lors d'une prochaine utilisation de l'objet, l'utilisateur soit considéré comme un administrateur.

## Conclusion

Lors d'un CTF, j'ai créé un challenge vulnérable qu'il fallait exploiter en utilisant cette technique. Le voici :

```c
/**
 * Filename: uaf.c
 * Author: pixis
 * Description: Pown challenge
 * Usage: ./uaf
 * Compilation: gcc -fPIE -fstack-protector-all -D_FORTIFY_SOURCE=2 -Wl,-z,now -Wl,-z,relro -o uaf uaf.c
 **/

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_NAME_SIZE   16

typedef struct player {
  char name[MAX_NAME_SIZE];
  int64_t isAdmin;
} player_t;

char *game_title=NULL;

/* 
Prevent double free
*/
int is_player_freed=1;
int is_title_freed=1;


int main(int Count, char *Strings[])
{   
    char line[128];
    player_t *player = NULL;
    while(1) {
        printf(
            "  _______ _    _ ______    _____          __  __ ______ \n"
            " |__   __| |  | |  ____|  / ____|   /\\   |  \\/  |  ____|\n"
            "    | |  | |__| | |__    | |  __   /  \\  | \\  / | |__   \n"
            "    | |  |  __  |  __|   | | |_ | / /\\ \\ | |\\/| |  __|  \n"
            "    | |  | |  | | |____  | |__| |/ ____ \\| |  | | |____ \n"
            "    |_|  |_|  |_|______|  \\_____/_/    \\_\\_|  |_|______|\n"
            "                                                        \n"
            "                                                        \n"
            "\n"
            "Game information\n"
            "----------------\n"
            "\tPlayer name\t-->\t%s\n"
            "\tGame title\t-->\t%s\n"
            "\n"
            "Commands\n"
            "--------\n"
            "\tset <Player name>\t-\tSet player's name\n"
            "\ttitle <Game title>\t-\tSet game's title\n"
            "\tdel\t\t\t-\tDelete player's name\n"
            "\tlogin\t\t\t-\t[ADMIN AREA] Login into the game\n"
            "\texit\t\t\t-\tExit :(\n"
            "\n"
            "> ",
            player == NULL ? "(Not set)" : player->name, game_title == NULL ? "(Not set)" : game_title);

        if (fgets(line, sizeof(line), stdin) == NULL) break;


        if (strncmp(line, "set ", 4) == 0) {
            if (strlen(line + 4) > 1 && strlen(line + 4) <= MAX_NAME_SIZE) {
                // Free old player if set
                if (player != NULL && is_player_freed == 0) {
                    free(player);
                    is_player_freed = 1;
                }
                player = malloc(sizeof(player_t));
                
                // Fresh new player
                memset(player, 0, sizeof(player_t));
                
                is_player_freed = 0;
                
                // Replace trailing \n with \0
                strncpy(player->name, line + 4, strlen(line+4)-1);
                player->name[strlen(line+4)] = 0;

                // You're not admin, duh.
                player->isAdmin = 0;
            } else {
                printf("Maximum name size is %d characters\n", MAX_NAME_SIZE-1);
            }
        }

        if (strncmp(line, "title ", 6) == 0) {
            // Free old title if set
            if (game_title != NULL && is_title_freed == 0) {
                free(game_title);
                is_title_freed = 1;
            }

            game_title = strndup(line+6, strlen(line+6)-1);
            is_title_freed = 0;
        }

        if (strncmp(line, "del", 3) == 0) {
            // Free player if set
            if (player != NULL && is_player_freed == 0) {
                free(player);
                is_player_freed = 1;
            }
        }

        if (strncmp(line, "login", 5) == 0) {
            // If you're admin, go get your cookie !
            if (player != NULL) {
                printf("%s\n", player->isAdmin == 0 ? "Nop" : "Well done, you're administrator !");
            }
        }

        if (strncmp(line, "exit", 4) == 0) {
            // Exit nicely without memory leaks
            if (player != NULL && is_player_freed == 0) {
                free(player);
            }
            if (game_title != NULL && is_title_freed == 0) {
                free(game_title);
            }
            
            // I'm quite polite.
            printf("'k Bye !\n");

            return EXIT_SUCCESS;
        }
    }
    return EXIT_SUCCESS;
}
```

Cet article devrait vous donner toutes les billes nécessaires pour comprendre la gestion de la mémoire lors de l'allocation et libération des zones mémoires dans ce programme en vue de l'exploiter.

J'espère que cet article pour permet de comprendre les mécanismes inhérents à cette vulnérabilité, n'hésitez pas à partager vos exemples de programmes vulnérables ou d'exploitation du programme fourni.
