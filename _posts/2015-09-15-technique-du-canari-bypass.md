---
title: 'Technique du Canari : Bypass'
date: 2015-09-15
author: "Pixis"
layout: post
permalink: /technique-du-canari-bypass/
disqus_identifier: 0000-0000-0000-0002
description: "Explication du canary, et comment le bypasser quand il utilise des forks"
cover: assets/uploads/2015/09/9537298100_c67c2e1071_b.jpg
tags:
  - "User Land"
  - Linux
---

Salut, aujourd'hui j'ai travaillé sur un binaire qui avait une technique qui permettait de limiter les dégâts causés par un buffer overflow. Cela s'appelle **Stack-Smashing Protector** (appelée aussi SSP). C'est une extention de gcc. Dans le cas du binaire que j'ai étudié, pour se protéger des buffer overflows, gcc ajoute une valeur secrète sur la stack, appelée **canari**, juste avant l'adresse contenue dans EBP. Un dépassement de tampon est en général utilisé pour réécrire EIP, qui se trouve être juste derrière l'adresse contenue dans EBP. Donc si jamais cela se passait, la valeur secrète serait également réécrite. Une vérification de cette valeur est effectuée avant de sortir de la fonction, et si elle a été modifiée, alors le programme s'arrête brutalement et nous jette des tomates à la figure.

<!--more-->

Les figures suivantes illustrent les deux issues possibles.


![Canary ok](/assets/uploads/2015/09/canari_ok.png)

![Canary ko](/assets/uploads/2015/09/canari_ko.png)


## Exemple

Nous allons voir ici un exemple de ce type de protection. Pour cela, nous allons reprendre le programme utilisé dans l'[article sur le buffer overflow](/buffer-overflow/)

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void func(char *arg)
{
    char buffer[64];
    strcpy(buffer,arg);
    printf("%s\n", buffer);
}

int main(int argc, char *argv[])
{
    if(argc != 2) printf("binary \n");
    else func(argv[1]);
    return 0;
}
```

Cependant, cette fois-ci, nous allons le compiler d'une différente manière, pour que cette protection soit mise en place

```bash
$ gcc -Wall -m32 -fstack-protector -o canari canari.c
```

Nous avons maintenant un binaire qui possède cette protection. L'outil [check.sh](http://www.trapkit.de/tools/checksec.sh){:target="blank"} nous permet de nous en assurer :

```bash
$ ./checksec.sh --file canari
RELRO      STACK CANARY   NX           PIE      RPATH      RUNPATH      FILE
No RELRO   Canary found   NX enabled   No PIE   No RPATH   No RUNPATH   canari
```

Essayons alors de provoquer un bête overflow

```bash
$ ./canari $(perl -e 'print "A"x100')

AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
*** stack smashing detected ***: ./canari terminated
```

Ouch. Voilà, on s'est pris la tomate. Au moins, c'est clair, nous ne pouvons plus badiner avec la pile. Snif.

Mais alors, il s'est passé quoi exactement ? Regardons à quoi ressemble notre nouveau binaire dans gdb

```bash
$ gdb -q canari
Reading symbols from /home/betezed/blog/exemples/canari...(no debugging symbols found)...done.
gdb-peda$ disas main
Dump of assembler code for function main:
 0x080484f3 <+0>:  push ebp
 0x080484f4 <+1>:  mov ebp,esp
 0x080484f6 <+3>:  and esp,0xfffffff0
 0x080484f9 <+6>:  sub esp,0x10
 0x080484fc <+9>:  cmp DWORD PTR [ebp+0x8],0x2
 0x08048500 <+13>: je 0x8048510 <main+29>
 0x08048502 <+15>: mov DWORD PTR [esp],0x80485c0
 0x08048509 <+22>: call 0x8048380 <puts@plt>
 0x0804850e <+27>: jmp 0x8048520 <main+45>
 0x08048510 <+29>: mov eax,DWORD PTR [ebp+0xc]
 0x08048513 <+32>: add eax,0x4
 0x08048516 <+35>: mov eax,DWORD PTR [eax]
 0x08048518 <+37>: mov DWORD PTR [esp],eax
 0x0804851b <+40>: call 0x80484ac 
 0x08048520 <+45>: mov eax,0x0
 0x08048525 <+50>: leave 
 0x08048526 <+51>: ret 
End of assembler dump.
gdb-peda$ disas func
Dump of assembler code for function func:
 0x080484ac <+0>:  push ebp
 0x080484ad <+1>:  mov ebp,esp
 0x080484af <+3>:  sub esp,0x78
 0x080484b2 <+6>:  mov eax,DWORD PTR [ebp+0x8]
 0x080484b5 <+9>:  mov DWORD PTR [ebp-0x5c],eax
 0x080484b8 <+12>: mov eax,gs:0x14
 0x080484be <+18>: mov DWORD PTR [ebp-0xc],eax
 0x080484c1 <+21>: xor eax,eax
 0x080484c3 <+23>: mov eax,DWORD PTR [ebp-0x5c]
 0x080484c6 <+26>: mov DWORD PTR [esp+0x4],eax
 0x080484ca <+30>: lea eax,[ebp-0x4c]
 0x080484cd <+33>: mov DWORD PTR [esp],eax
 0x080484d0 <+36>: call 0x8048370 <strcpy@plt>
 0x080484d5 <+41>: lea eax,[ebp-0x4c]
 0x080484d8 <+44>: mov DWORD PTR [esp],eax
 0x080484db <+47>: call 0x8048380 <puts@plt>
 0x080484e0 <+52>: mov eax,DWORD PTR [ebp-0xc]
 0x080484e3 <+55>: xor eax,DWORD PTR gs:0x14
 0x080484ea <+62>: je 0x80484f1 <func+69>
 0x080484ec <+64>: call 0x8048360 <__stack_chk_fail@plt>
 0x080484f1 <+69>: leave 
 0x080484f2 <+70>: ret 
End of assembler dump.
gdb-peda$ 
```

Bon, nous avons les versions désassemblées de la fonction `main` et de la fonction `func`. La fonction `main` ne semble pas avoir été modifiée. En revanche, la fonction `func` a une fin assez étrange :

```bash
0x080484e0 <+52>: mov eax,DWORD PTR [ebp-0xc]
0x080484e3 <+55>: xor eax,DWORD PTR gs:0x14
0x080484ea <+62>: je 0x80484f1 <func+69>
0x080484ec <+64>: call 0x8048360 <__stack_chk_fail@plt>
```

Nous remarquons ces 4 lignes qui ne sont pas habituelles. Une valeur est prise sur la pile, juste avant `EBP`, puis elle est comparée à une valeur située sur le segment gs à l'adresse `0x14`. Ce segment est propre au processus en cours d'exécution. C'est en fait la valeur secrète dont nous parlions tout à l'heure, générée aléatoirement à chaque exécution. Pour nous en convaincre, plaçons un breakpoint à l'adresse `0x080484e3` pour voir le contenu de `EAX` lorsque le comportement est normal (Donc que nous n'avons pas réécrit le canari)

```bash
gdb-peda$ r
...
gdb-peda$ i r eax
eax 0xdad6e600 0xdad6e600
gdb-peda$ 
gdb-peda$ r
...
gdb-peda$ i r eax
eax 0x9a9c0100 0x9a9c0100
```

On voit que deux canaris sont générés d'une exécution à l'autre, et n'ont aucun rapport entre eux. Mais comme nous n'avons rien modifié à ce niveau là, les instructions suivantes :

```bash
0x080484e3 <+55>: xor eax,DWORD PTR gs:0x14
 0x080484ea <+62>: je 0x80484f1 <func+69>
```

comparent ce canari avec la valeur originale. Comme elle n'est pas modifiée, le xor donne la valeur 0 et le jump `JE` est pris, sautant l'appel à `__stack_chk_fail`, donc évitant le lancé de tomates.

Maintenant, tentons un buffer overflow

```bash
gdb-peda$ r $(perl -e 'print "A"x100')
...

gdb-peda$ i r eax
eax 0x41414141 0x41414141
```

Et voilà, nous avons remplacé le canari. Malheur ! Si nous exécutons les quelques instructions qui suivent

```bash
gdb-peda$ ni
gdb-peda$ ni

[-------------------------------------code-------------------------------------]
   0x80484e0 <func+52>: mov eax,DWORD PTR [ebp-0xc]
   0x80484e3 <func+55>: xor eax,DWORD PTR gs:0x14
   0x80484ea <func+62>: je 0x80484f1 <func+69>
=> 0x80484ec <func+64>: call 0x8048360 <__stack_chk_fail@plt>
   0x80484f1 <func+69>: leave 
   0x80484f2 <func+70>: ret 
   0x80484f3 :    push ebp
   0x80484f4 <main+1>:  mov ebp,esp
```

Comme attendu, nous ne prenons pas le saut `JE` à la ligne `func+62` et tombons tout droit dans le `call` à `__stack_chk_fail` qui termine notre programme.

## Exploitation

MAIS nous n'allons pas nous laisser faire.

Le canari est généré aléatoirement pour chaque processus au run-time, souvent en piochant des octets dans `/dev/urandom` (Autant dire que je vous souhaite bon courage si vous essayez de prédire ce que va être généré). Donc on ne peut pas essayer de le bruteforcer, à priori !

En effet, il y a un cas dans lequel nous pouvons nous en sortir sans trop de difficultés, c'est celui que j'ai rencontré :

Si le binaire est un serveur qui accepte des connexions entrantes, deux cas se présentent.

  * Soit **le binaire effectue un `fork()`** lorsqu'il reçoit une connexion, donc le processus est littéralement dupliqué, la valeur du canari comprise.
  * Soit **le binaire effectue un `fork()` puis un `execve()`**. Lorsque `execve()` est appelé, les sections text, data,  bss et la pile du processus qui fait cet appel sont remplacées par les sections du programme qui est chargé en mémoire. Donc le canari est renouvelé.

Dans le premier cas, nous comprenons bien ce que cela implique : Le canari a été généré une fois lorsque le serveur a été lancé, et à chaque fois que nous nous connectons, cette valeur est copiée dans notre fork sans être modifiée. Intéressant !

Il suffit alors de remplir le buffer suffisamment pour ne remplacer que la première valeur du canari. Les chances sont faibles pour que ce soit la bonne valeur. Cependant, il n'y a que 256 possibilités (valeur maximale d'un octet). Donc en un maximum de 256 essais, nous pouvons trouver le premier caractère du canari.

Pour des systèmes 32 bits, le canari a une taille de 4 octets, tandis que pour les systèmes 64 bits, le canari a une taille de 8 octets. Cela signifie que pour un système 32 bits, il faut un maximum de 4\*256 = 1024 tentatives pour trouver le canari, et 2048 tentatives pour un système 64 bits. Et ça, c'est très faisable !

Voici un schéma qui résume ce brute force pour un système 32 bits :

![Bruteforce Canari](/assets/uploads/2015/09/bf_canari1.png)

Dans le premier dessin en haut à gauche, nous voyons le buffer qui s'arrête juste avant le canari, ce dernier ayant une valeur qui nous est encore inconnue. Nous ajoutons alors un octet au buffer `\x00` pour écraser le premier octet du canari. Mais comme ce n'est pas le bon octet, le programme se ferme. Nous essayons alors l'octet suivant `\x01` mais le programme se ferme à nouveau. Lorsque nous essayons `\xCA`, cette fois-ci tout va bien. Nous avons découvert le premier octet secret ! Nous passons alors au deuxième octet (deuxième colonne dans ce schéma), et ainsi de suite jusqu'à découvrir le Canari dans sa totalité !

Une fois cette valeur découverte, il ne reste plus qu'à faire une exploitation de buffer overflow classique. Pour cela, je vous conseille de lire l'article sur [les buffer overflows](/buffer-overflow/) ou celui sur [le retour à la libc](/retour-a-la-libc/)

À vos claviers !