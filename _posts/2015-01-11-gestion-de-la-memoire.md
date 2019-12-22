---
title: "Gestion de la mémoire"
date: 2015-01-11
author: "Pixis"
layout: post
permalink: /memory-allocation/
redirect_from:
  - "/gestion-de-la-memoire/"
  - "/gestion-de-la-memoire"

disqus_identifier: 0000-0000-0000-000F
description: "Aujourd'hui, je vais tenter de rassembler tout ce que j'ai pu comprendre sur la gestion de la mémoire lors de l'exécution d'un programme."
cover: assets/uploads/2015/01/hacking.jpg
tags:
  - "User Land"
  - Linux
---
Aujourd'hui, je vais tenter de rassembler tout ce que j'ai pu comprendre sur la gestion de la mémoire lors de l'exécution d'un programme. Cet article est écrit en vu de comprendre l'exploitation de certaines failles applicatives, telles que le _buffer overflow_, le _heap overflow_ ou encore la _format string_, failles que je décrirai dans les prochains articles.

<!--more-->

## Mémoire virtuelle

Les processus tournant sur une machine ont besoin de mémoire, et dans un ordinateur, la quantité de mémoire est limitée. Il faut donc que les processus aillent chercher de la mémoire disponible pour pouvoir travailler. Cependant, les processus tournent de nos jours dans des systèmes d'exploitation multi-tâches. Plusieurs processus s'exécutent en même temps. Que se passerait-il si deux processus voulaient accéder, au même instant, à la même zone mémoire ? Et surtout, si jamais un processus écrivait dans une zone mémoire, puis un autre processus écrasait cette même zone mémoire avec ses propres données, alors le processus A, le pauvre, pensera retrouver ses données, mais il trouvera en fait les données de B. Et là, c'est le drame ! Il faudrait alors que les processus communiquent en permanence entre eux pour savoir qui fait quoi, où et quand. Ce serait une vraie perte de temps et d'une complexité effroyable pour ce problème.

[![img_54b50cc491e11](/assets/uploads/2015/01/img_54b50cc491e11.png)](/assets/uploads/2015/01/img_54b50cc491e11.png)

C'est là qu'intervient la mémoire virtuelle : Les processus ne vont plus piocher directement dans la mémoire physique. On les met dans des bacs à sable (_sand box_), en leur allouant une plage de mémoire **virtuelle** (de 4Go pour les machines 32 bits), en leur faisant croire qu'ils sont les seuls à s'exécuter sur la machine. C'est alors que le kernel intervient, et effectue le lien entre les différentes plages de mémoires virtuelles et la mémoire réelle. Ceci est fait par le biais de tables de pages (_page tables_). Voici un schéma pour y voir plus clair :

[![img_54b50ce3eda87](/assets/uploads/2015/01/img_54b50ce3eda87.png)](/assets/uploads/2015/01/img_54b50ce3eda87.png)

Le processus n'a alors plus à se soucier de l'implémentation de la mémoire. Toutes les opérations bas niveau sont gérées par le noyau de l'OS. C'est une sorte de couche d'abstraction qui simplifie la vie du processus.

Chaque processus a sa propre table de pages. Cependant, si l'adressage virtuel est activé, il s'applique à tous les programmes qui tournent sur la machine, **kernel compris**. Ainsi, il faut réserver une portion de l'espace virtuel de chaque programme pour le noyau !

## Segmentation de la mémoire

Ainsi, nous allons voir ici comment est **segmentée** la mémoire d'un programme compilé lorsqu'il est chargé en mémoire afin de créer un processus (Son **image**, une sorte d'instance, si ça vous parle).
  
On retrouve les 3 sections suivantes :

  1. Texte (_.text_)
  2. Données (_.data_)
  3. bss (_.bss_)

Et les 2 zones mémoire suivantes :

  1. Tas (_heap_)
  2. Pile (_stack_)

[![img_54b40db038230](/assets/uploads/2015/01/img_54b40db038230.png)](/assets/uploads/2015/01/img_54b40db038230.png)

Chacune de ces zones représente une partie de la mémoire allouée au processus en question.

Rapidement, la première **section** **texte** (._text_) est celle qui contient le code du programme, et plus exactement les instructions en langage machine. C'est une section en lecture seule, une fois qu'elle a été définie, elle est immuable. Elle sert seulement à stocker du code, pas des variables. Des erreurs de programmation peuvent entraîner cette fameuse erreur : "Segmentation Fault", qui indique à l'utilisateur qu'une écriture non autorisée a tenté d'être faite dans cette zone mémoire.

Du fait de son immuabilité, c'est une zone mémoire de taille fixe. Le programme démarrera donc au début de ce segment, puis il va lire les instructions une par une. Cependant, cette lecture n'est pas linéaire. En effet, avec le code haut niveau que nous produisons, il existe beaucoup de structures de contrôles qui engendrent des appels à des bout de code qui ne sont pas les uns à la suite des autres. On expliquera par la suite comment l'exécution du programme fonctionne, notamment avec l'aide des registres.

La section de **données** (_data_) et la section **bss** stockent les variables globales et statiques du programme. Si ces données sont initialisées, elles sont enregistrées dans la section _data_, tandis que les autres sont dans la section bss. Ce sont également des zones mémoires de taille fixe. Malgré la possibilité en écriture, les variables finales et statiques ne changeront pas au cours de l'exécution du programme ou du contexte. C'est parce qu'elles sont dans cette zone mémoire qu'elles peuvent persister.

Nous pouvons prendre un exemple en C. Soit le programme suivant, vide. examinons la taille de ses différentes sections.

```c
#include <stdio.h>

int main(void) {
    return 0;
}
```

```bash
hackndo@becane:~/exemples$ gcc memory.c -o memory
hackndo@becane:~/exemples$ size memory

text data bss dec  hex filename
1073 560  8   1641 669 memory
```


Maintenant, ajoutons une variable globale non initialisée et étudions les tailles des différentes sections à nouveau

```c
#include <stdio.h>

int global;

int main(void) {
    return 0;
}
```

```bash
hackndo@becane:~/exemples$ gcc memory.c -o memory
hackndo@becane:~/exemples$ size memory

text data bss dec  hex filename
1073 560  12  1641 669 memory
```

On remarque que la section bss a augmenté de 4 octets pour stocker la variable statique non-initialisée. Si de la même manière on ajoute une variable statique à l'intérieur de la fonction `main()`

```c
#include <stdio.h>

int global;

int main(void) {
    static int var;
    return 0;
}
```

```bash
hackndo@becane:~/exemples$ gcc memory.c -o memory
hackndo@becane:~/exemples$ size memory

text data bss dec  hex filename
1073 560  16  1641 669 memory
```

Encore une fois, on remarque que bss a augmenté de 4 octets pour stocker cette variable. Si maintenant on initialise la variable `var`

```c
#include <stdio.h>

int global;

int main(void) {
    static int var = 10;
    return 0;
}
```

```bash
hackndo@becane:~/exemples$ gcc memory.c -o memory
hackndo@becane:~/exemples$ size memory

text data bss dec  hex filename
1073 564  12  1641 669 memory
```

Cette fois-ci, la variable n'est plus stockée dans la section bss, mais dans la section data, puisqu'on remarque qu'elle est passée de 560 à 564 alors que la section bss a diminué de 4 octets. Enfin, si on initialise également la variable globale `global`

```c
#include <stdio.h>

int global = 200;

int main(void) {
    static int var = 10;
    return 0;
}
```

```bash
hackndo@becane:~/exemples$ gcc memory.c -o memory
hackndo@becane:~/exemples$ size memory

text data bss dec  hex filename
1073 568  8   1641 669 memory
```

Les deux variables sont stockées dans la section data, et non plus dans la section bss.

Le **tas** (_heap_) est, quant à lui, manipulable par le programmeur. C'est la zone dans laquelle sont écrites les zones mémoires allouées dynamiquement (_malloc()_ ou _calloc()_). Tout comme la pile, cette zone mémoire n'a pas de taille fixe. Elle augmente et diminue en fonction des demandes du programmeur, qui peut réserver ou supprimer des blocs via des algorithmes d'allocation ou de libération pour une utilisation future. Plus la taille du tas augmente, plus les adresses mémoires augmentent, et s'approchent des adresses mémoires de la pile. La taille des variables dans le tas n'est pas limitée (sauf limite physique de la mémoire), contrairement à la pile.

Par ailleurs, les variables stockées dans le tas sont accessibles partout dans le programme, par l'intermédiaire des pointeurs. Cependant, l'accès aux variables stockées dans le tas ne se faisant qu'avec des pointeurs, cela ralentit un peu ces accès, contrairement aux accès dans la pile.

La **pile** (_stack_) possède également une taille variable, mais plus sa taille augmente, plus les adresses mémoires diminuent, en s'approchant du haut du tas. C'est ici qu'on retrouve les variables locales des fonctions ainsi que le cadre de pile (_stack frame_) de ces fonctions. La _stack frame_ d'une fonction est une zone mémoire, dans la pile, dans laquelle toutes les informations, nécessaires à l'appel de cette fonction, sont stockées. S'y trouvent également les variables locales de la fonction.

Vous avez donc j'espère une idée plus claire de la segmentation de la mémoire lors de l'exécution d'un programme. Cependant il manque une notion importante qui est la gestion des registres. En expliquant leur fonctionnement et leur utilité, nous seront à même de mieux comprendre la notion de stack frame.


## Registres


Les registres sont des emplacements mémoire qui sont à l'intérieur du processeur. Or dans un ordinateur, les emplacements mémoire les plus proches du processeur sont ceux à qui il est le plus rapide d'accéder, mais également les plus chers. Ainsi, plus on s'éloigne du processeur, plus les accès sont longs, mais les coûts sont faibles. Les registres sont les emplacements mémoire les plus proches (puisqu'ils sont internes au processeur), c'est alors la mémoire la plus rapide de l'ordinateur. Cette pyramide de la mémoire est représentée dans la figure suivante, qui oppose le coût de la mémoire à son temps d'accès par le processeur :


[![img_54b3b77f84d31](/assets/uploads/2015/01/img_54b3b77f84d31.png)](/assets/uploads/2015/01/img_54b3b77f84d31.png)


Le processeur x86 32 bits possède (logiquement) 8 registres généraux (EAX, EBX, ECX, EDX, ESP, EBP, ESI, EDI)

_Pour les processeurs 64 bits, il y a 16 registres logiques. Mais dans la réalité, les derniers processeurs en ont 168, pour pouvoir paralléliser les instructions._

On distingue deux groupes :

* Les 4 EAX, EBX, ECX et EDX appelés **A**ccumulateur, **B**ase, **C**ompteur, **D**onnées ont pour rôle de stocker des données temporaires pour le processeur lorsqu'il exécute un programme.
* Les 4 autres registres ESP, EBP, ESI et EDI appelés **P**ointeur de Pile (**S**tack), **P**ointeur de **B**ase, **I**ndex de **S**ource et **I**ndex de **D**estination sont plutôt utilisés en tant que pointeurs et index, comme leur nom l'indique. Par exemple, les deux premiers stockent des adresses 32 bits (désignant des emplacements mémoire) pour délimiter le stack frame courant.

Nous avons également deux autres registres, un peu plus spéciaux :

* Le registre EIP est appelé **P**ointeur d'**I**nstruction. Il contient l'adresse de la prochaine instruction que le processeur doit exécuter.
* Enfin, le registre EFLAGS qui, en réalité, contient des indicateurs, des interrupteurs, des drapeaux (_flags_) essentiellement utilisés pour des comparaisons, mais pas uniquement.

Pour aller plus loin, vous pouvez lire l'article sur [le fonctionnement de la pile](/stack-introduction).