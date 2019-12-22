---
title: Introduction à gdb
date: 2015-05-17
author: "Pixis"
layout: post
permalink: /introduction-a-gdb/
disqus_identifier: 0000-0000-0000-0009
description: "GDB est un outil extrêmement puissant. Voici un article qu l'introduit avec une mise en pratique."
cover: assets/uploads/2015/05/gdb_visual.jpg
tags:
    - Linux
---

Que le programmeur qui n'a jamais mis des `printf`, `var_dump`, `echo`, `print`, `System.out`, `console.log`, `cout` plein son code pour savoir d'où venait un bug se dénonce. Que le programmeur qui ne s'est jamais arraché les cheveux pour un programme qui plantait violemment sans crier garde me jette la pierre (C'est une expression, hein !). Heureusement, il existe pléthore de débogueurs (_debuggers_), libres ou non, dont un qui est particulièrement reconnu, le débogueur de GNU nommé **GDB** (GNU Project Debugger), que nous allons introduire dans cette introduction.

<!--more-->

Rapidement, un debugger permet de lancer un programme, placer des points d'arrêt (_breakpoints_) à certains endroits, parfois sous certaines conditions, exécuter les instructions pas à pas, étudier et modifier la mémoire (RAM, Registres) ... Bref, tous les outils essentiels pour pouvoir étudier correctement le comportement d'un programme.

GDB est portable (cross-platform), donc les commandes que nous allons voir ici pourront être effectuées sur tous les OS pourvu que GDB soit installé, et les exemples pris ici ont été effectués sur Linux. C'est un outil très puissant, avec de nombreuses fonctionnalités qu'il serait difficile de lister et expliquer exhaustivement, c'est pourquoi nous verrons ici ce qui me paraissait être le plus important (... parmi les fonctionnalités que je connais. Si vous en connaissez d'autres ou des astuces permettant d’accélérer/simplifier des choses, n'hésitez pas à m'en faire part dans les commentaires, je les intégrerai dans cet article).

# Lancement

Il existe différentes manières de lancer gdb et de charger un binaire dans une session gdb, voici quelques commandes utiles

## Hors gdb

Pour lancer gdb, rien de plus simple. Dans un shell/terminal/console, lancez la commande suivante

```bash
$ gdb

(gdb)
```

Cette commande permet de lancer une session gdb. Pour l'instant, aucun programme n'est chargé dans gdb. Mais déjà, nous pouvons faire des choses qui nous serons utiles tout au long de nos debug. Pour avoir la liste des commandes disponibles, il suffit de lancer la commande **help**

```bash
(gdb) help
List of classes of commands:

aliases -- Aliases of other commands
breakpoints -- Making program stop at certain points
data -- Examining data
files -- Specifying and examining files
internals -- Maintenance commands
obscure -- Obscure features
running -- Running the program
stack -- Examining the stack
status -- Status inquiries
support -- Support facilities
tracepoints -- Tracing of program execution without stopping the program
user-defined -- User-defined commands

Type "help" followed by a class name for a list of commands in that class.
Type "help all" for the list of all commands.
Type "help" followed by command name for full documentation.
Type "apropos word" to search for commands related to "word".
Command name abbreviations are allowed if unambiguous.
(gdb)
```

Voici d'autres commandes :

```bash
# Charge le binaire "binary" dans gdb
gdb binary

# Charge le binaire "binary" avec les arguments "args..."
gdb --args <binary> <args...>

# Lance gdb qui s'attache par la suite au processus PID avec les symboles du binaire "binary"
gdb --pid <PID> --symbols <binary>
```

## Dans gdb

```bash
# Envoyer les arguments au binaire qui va être lancé
(gdb) set args <args...>

# Lancer le binaire
(gdb) run

# Lancer le binaire, et lui envoyer un flux dans stdin
(gdb) r < <(perl -e 'print "A"x5')

# Tuer le binaire en cours
(gdb) kill
```

# Calculs

Avant de s'occuper des binaires, gdb permet d'effectuer des calculs très simplement, dans différentes bases les plus utilisées (binaire, octale, hexa, décimale) et même d'afficher les caractères correspondants aux valeurs ASCII.

```bash
# On peut afficher les variables sous différents formats, de la manière suivante : p/<format>
# Les formats les plus employés sont
# c    Caractère
# f    Float
# o    Octal
# s    Chaine de caractères
# t    Binaire
# x    Hexadécimal

(gdb) p 10+12
$1 = 22
(gdb) p/x 10+12
$2 = 0x16
(gdb) p 0x10
$3 = 16
(gdb) p 0x10 + 10
$4 = 26
(gdb) p/x 0x10 + 10
$5 = 0x1a
(gdb) p/t 12
$6 = 1100
```

# Informations

Quelques informations nécessaires lorsque vous avez chargé un binaire et que vous êtes en train de le déboguer

```bash
#disassemble : Renvoie le code assembleur correspondant aux instructions hexadécimales du binaire
(gdb) disas ma_fonction

#info registers : Renvoie les informations des registres à l'instant t
(gdb) i r

#info breakpoints : Permet de lister les breakpoints et leurs états
(gdb) i b
```

# Affichage

## Syntaxe

Comme expliqué dans l'article sur les [notions de base d'assembleur](/assembly-basics/), il existe deux syntaxes pour lire de l'assembleur : AT&T et Intel. Pour passer de l'une à l'autre, voici comment faire :

### AT&T

```bash
(gdb) set disassembly-flavor att
(gdb) disass main
Dump of assembler code for function main:
   0x080483f2 <+0>:    push   %ebp
   0x080483f3 <+1>:    mov    %esp,%ebp
   ...
End of assembler dump.
```

### Intel

```bash
(gdb) set disassembly-flavor intel
(gdb) disass main
Dump of assembler code for function main:
0x080483f2 <+0>:    push   ebp
0x080483f3 <+1>:    mov    ebp,esp
...
End of assembler dump.
```

## Debug

Lors d'une phase de debug, il peut être utile d'avoir sous les yeux le code machine qui s'exécute ainsi que l'état des différents registres.


_Notez cependant que si vous utilisez ces fenêtres, vous ne serez plus en mesure d'utiliser la flèche du haut pour revenir dans votre historique, puisque les flèches haut et bas servent à monter et descendre dans la fenêtre affichant le code assembleur._

```bash
# Permet d'ouvrir deux fenêtre console.
# L'une affiche le code assembleur
(gdb) layout asm
# L'autre affiche l'état des registres.
(gdb) layout regs
# Si un registre change lorsqu'on avance d'une instruction, il est mis en surbrillance.
```

Voici un exemple du rendu :

```bash
┌──Register group: general─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│eax            0xbff73ef4       -1074315532         ecx            0x86c2e41d       -2034047971         edx            0x1      1                           ebx            0xb76f0ff4       -1217458188           │
│esp            0xbff73e40       0xbff73e40          ebp            0xbff73e48       0xbff73e48          esi            0x0      0                           edi            0x0      0                             │
│eip            0x8048826        0x8048826 <main+6>  eflags         0x282    [ SF IF ]                   cs             0x23     35                          ss             0x2b     43                            │
│ds             0x2b     43                          es             0x2b     43                          fs             0x0      0                           gs             0x63     99                            │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
│                                                                                                                                                                                                                  │
   ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
B+ │0x8048823 <main+3>      and    esp,0xfffffff0                                                                                                                                                                  │
  >│0x8048826 <main+6>      sub    esp,0x150                                                                                                                                                                       │
   │0x804882c <main+12>     mov    eax,0x80487fc                                                                                                                                                                   │
   │0x8048831 <main+17>     mov    DWORD PTR [esp+0x4],eax                                                                                                                                                         │
   │0x8048835 <main+21>     mov    DWORD PTR [esp],0x11                                                                                                                                                            │
   │0x804883c <main+28>     call   0x8048510 <signal@plt>                                                                                                                                                          │
   │0x8048841 <main+33>     mov    DWORD PTR [esp+0x8],0x0                                                                                                                                                         │
   │0x8048849 <main+41>     mov    DWORD PTR [esp+0x4],0x1                                                                                                                                                         │
   │0x8048851 <main+49>     mov    DWORD PTR [esp],0x2                                                                                                                                                             │
   │0x8048858 <main+56>     call   0x80485b0 <socket@plt>                                                                                                                                                          │
   │0x804885d <main+61>     mov    DWORD PTR [esp+0x13c],eax                                                                                                                                                       │
   │0x8048864 <main+68>     cmp    DWORD PTR [esp+0x13c],0x0                                                                                                                                                       │
   │0x804886c <main+76>     jns    0x8048886 <main+102>                                                                                                                                                            │
   │0x804886e <main+78>     mov    DWORD PTR [esp],0x8048ad2                                                                                                                                                       │
   │0x8048875 <main+85>     call   0x8048590 <perror@plt>                                                                                                                                                          │
   │0x804887a <main+90>     mov    DWORD PTR [esp],0x1                                                                                                                                                             │
   │0x8048881 <main+97>     call   0x8048610 <exit@plt>                                                                                                                                                            │
   └───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
child process 20368 In: main                                                                                                                                                               Line: ??   PC: 0x8048826
(gdb) ni
```

# Breakpoints

Les breakpoints sont extrêmement puissants. Ils permettent de mettre en pause l'exécution du programme lorsqu'ils sont rencontrés. Cela permet d'étudier la mémoire à un instant très précis, quand ça nous intéresse. En effet, souvent il y a des millions d'instructions exécutées avant l'appel de la fonction qui nous intéresse, donc mettre à breakpoint au bon endroit fait gagner **énormément** de temps.

## Sans conditions

```bash
(gdb) break main
Breakpoint 1 at 0x80483f8
(gdb) break *0x08048400
Breakpoint 2 at 0x8048400
(gdb) delete 1
(gdb) i b
Num     Type           Disp Enb Address    What
2       breakpoint     keep y   0x08048400 <main+14>
(gdb) disable 2
(gdb) enable 2
(gdb) i b
Num     Type           Disp Enb Address    What
2       breakpoint     keep n   0x08048400 <main+14>
(gdb) delete breakpoints
Delete all breakpoints? (y or n) y
```

## Avec conditions

Soit le programme C suivant :

```c
#include <stdio.h>

int main(void) {
    for (int i=0; i<10; i++) {
        printf("%s\n", "Boucle ...");
    }
}
```

Après compilation, nous le chargeons dans gdb, et nous le désassemblons

```bash
$ gcc boucle.c -std=c99 -m32 -o boucle
$ gdb boucle
(gdb) set disassembly-flavor intel
(gdb) disas main
Dump of assembler code for function main:
   0x0804840c <+0>:     push   ebp
   0x0804840d <+1>:     mov    ebp,esp
   0x0804840f <+3>:     and    esp,0xfffffff0
   0x08048412 <+6>:     sub    esp,0x20
   0x08048415 <+9>:     mov    DWORD PTR [esp+0x1c],0x0
   0x0804841d <+17>:    jmp    0x8048430 <main+36>
   0x0804841f <+19>:    mov    DWORD PTR [esp],0x80484d0
   0x08048426 <+26>:    call   0x80482f0 <puts@plt>
   0x0804842b <+31>:    add    DWORD PTR [esp+0x1c],0x1
   0x08048430 <+36>:    cmp    DWORD PTR [esp+0x1c],0x9
   0x08048435 <+41>:    jle    0x804841f <main+19>
   0x08048437 <+43>:    mov    eax,0x0
   0x0804843c <+48>:    leave
   0x0804843d <+49>:    ret
End of assembler dump.
```

A la ligne `+31`, nous voyons le compteur de notre programme qui s'incrémente. Ici, la boucle est répétée 10 fois, mais il est possible qu'elle soit répétée des millions de fois. Cependant, nous ne voulons voir la comparaison à la ligne `+36` que pour la dernière boucle. Pour cela, nous allons mettre un breakpoint conditionnel : Nous ne breakerons dessus que si le contenu de `esp+0x1c` vaut 10 (donc `0xa`)

```bash
(gdb) b *0x08048430 if *(int*)($esp+0x1c) == 0xa
Breakpoint 1 at 0x8048430
(gdb) r
Starting program: /home/betezed/blog/exemples/boucle
Boucle ...
Boucle ...
Boucle ...
Boucle ...
Boucle ...
Boucle ...
Boucle ...
Boucle ...
Boucle ...
Boucle ...

Breakpoint 1, 0x08048430 in main ()
(gdb) x/x $esp+0x1c
0xbffff39c:    0x0000000a
```

Ce qui aurait pu être fait également de la manière suivante :

```bash
(gdb) b *0x08048430
Breakpoint 1 at 0x8048430
(gdb) cond 1 *(int*)($esp+0x1c) == 0xa
```

Et pour enlever les conditions sur un breakpoint :

```bash
(gdb) cond 1
Breakpoint 1 now unconditional.
```

# Pas à pas

```bash
# nexti : Permet d'avancer d'une (ou <step>) instruction(s), et si c'est un call, le call est exécuté
# jusqu'à son retour.
(gdb) ni <step>
# stepi : Permet d'avancer d'une (ou <step>) instruction(s), en rentrant dans les calls
(gdb) si <step>
# continue : Permet de continuer jusqu'au prochain breakpoint
(gdb) c
```

# Fonctions

Il est possible de définir des fonctions au sein de gdb, permettant de simplifier la répétition d'un ensemble de commandes, ou encore de boucler jusqu'à ce qu'une condition soit vérifiée. Pour cela, il faut lancer la commande `define <ma_fonction>` puis indiquer les instructions voulues, et terminer par `end`. Comme les exemples valent toujours mieux que les beaux discours :

```bash
(gdb) define init_mes_params
Type commands for definition of "init_mes_params".
End with a line saying just "end".
>set disassembly-flavor intel
>break main
>r
>i r
>x/24xw $esp
>end
(gdb) init_mes_params
Breakpoint 1 at 0x804840f

Breakpoint 1, 0x0804840f in main ()
eax            0xbffff454    -1073744812
ecx            0xe97a4d24    -377860828
edx            0x1    1
ebx            0xb7fcfff4    -1208156172
esp            0xbffff3a8    0xbffff3a8
ebp            0xbffff3a8    0xbffff3a8
esi            0x0    0
edi            0x0    0
eip            0x804840f    0x804840f <main+3>
eflags         0x246    [ PF ZF IF ]
cs             0x23    35
ss             0x2b    43
ds             0x2b    43
es             0x2b    43
fs             0x0    0
gs             0x63    99
0xbffff3a8:    0xbffff428    0xb7e85e46    0x00000001    0xbffff454
0xbffff3b8:    0xbffff45c    0xb7fd4000    0x08048320    0xffffffff
0xbffff3c8:    0xb7ffeff4    0x08048252    0x00000001    0xbffff410
0xbffff3d8:    0xb7ff06d6    0xb7fffad0    0xb7fd42e8    0xb7fcfff4
0xbffff3e8:    0x00000000    0x00000000    0xbffff428    0xc6213b34
0xbffff3f8:    0xe97a4d24    0x00000000    0x00000000    0x00000000
(gdb)
```

Il est possible d'utiliser les structures de contrôles, telles que

```c
> if <condition>
>     commandes...
> end
> while <condition>
>     commandes...
> end
```

# .gdbinit

Bien sûr, avec toutes ces informations, vous pouvez vous créer votre petit environnement gdb qui satisfait vos besoins et vos préférences, mais vous n'allez évidemment pas taper toutes les commandes à chaque fois. Il est très fastidieux de devoir taper, à chaque lancement de gdb, les commandes permettant de changer de syntaxe, de breaker sur la fonction main, de désassembler le binaire, d'étudier la pile, si c'est ce que vous voulez faire à chaque fois que vous ouvrez gdb (mais libre à vous de choisir ce que vous voulez)

Pour cela, il vous suffit de créer un fichier `.gdbinit` dans le même dossier depuis lequel vous lancez gdb, et dans ce fichier, vous mettez ligne après ligne les commandes que vous souhaitez lancer. Par exemple :

```bash
$ cat .gdbinit
# Pour toujours avoir la syntaxe intel
set disassembly-flavor intel

# Pour que lors d'un fork, gdb suive le processus enfant, plutôt que le processus parent
set follow-fork-mode child

# Si vous savez que vous devez lancer gdb plusieurs fois pour le binaire que
# vous êtes en train de débuguer, et que les 9 première itérations d'une boucle
# ne vous importent pas, autant breaker tout de suite au moment qui vous intéresse
b *0x8048705 if *(int*)($esp+0x10) == 0xa

# Et lancer le binaire
r

# Ensuite, nous voulons souvent utiliser ces deux fonctions en même temps
# Autant les regrouper dans une même fonction !
define afficher_layouts
layout asm
layout regs
end
$ 
```

Et pour finir, sachez que si vous avez votre `.gdbinit`, mais que vous ne voulez pas l'utiliser pour votre prochaine session gdb, il suffit de passer l'argument `-nx` à gdb pour lui demander d'ignorer ce fichier.

```bash
$ gdb <binary> -nx
```

Voilà, avec cette introduction à gdb, vous devriez pouvoir l'utiliser et profiter de sa force. Il manque un tas de choses, j'en suis conscient, et j'ajouterai des fonctions qui me paraitront pertinentes, que ce soit en les découvrant par moi-même, ou par vos commentaires !

# Pour aller plus loin ...

Si vous sentez que gdb est trop morne, qu'il manque de couleurs, de fonctionnalités, sachez que de nombreuses initiatives existent dans le monde open source afin de vous rendre la vie plus agréable, en vous proposant des `.gdbinit` remarquablement complets et utiles. (_Merci à yaap pour les liens_) Nous pouvons citer, entre autre :\`

* [peda](https://github.com/longld/peda){:target="blank"}
* [dotgdb](https://github.com/dholm/dotgdb){:target="blank"}

N'hésitez pas à les installer, et les modifier selon vos besoins, vous avez (presque) toutes les clés en main pour comprendre comment ils fonctionnent. Notez cependant que ces outils ne sont pas exempts de bugs ou de comportements inattendus. Utilisez les avec discernement, n'hésitez pas à être bon critique !

Bon reverse 😉