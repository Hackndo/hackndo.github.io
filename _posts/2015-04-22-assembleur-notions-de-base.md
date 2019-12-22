---
title: 'Assembleur - Notions de base'
date: 2015-04-22
author: "Pixis"
layout: post
permalink: /assembly-basics/
redirect_from:
    - /assembleur-notions-de-base/
    - /assembleur-notions-de-base
disqus_identifier: 0000-0000-0000-000A
description: "L'assembleur est obscur pour vous ? Voici un article qui vous permettra d'y voir plus clair."
cover: assets/uploads/2015/04/BACKGROUND.jpg
tags:
    - Linux
---
Salut tout le monde, voici un nouvel article qui va permettre, je pense, d'éclaircir bon nombre de notions que j'ai déjà abordées dans mes articles précédents, et qui permettront également de faciliter la compréhension des articles à venir.

Cet article a un but modeste : Comprendre la sortie d'un `disass main` sur un programme relativement simple (Mais si ! vous savez, cette commande dans gdb qui permet de désassembler - i.e. produire le code assembleur - un binaire)

<!--more-->

```bash
(gdb) set disassembly-flavor intel
(gdb) disass main
Dump of assembler code for function main:
   0x080483f2 <+0>:     push   ebp
   0x080483f3 <+1>:     mov    ebp,esp
   0x080483f5 <+3>:     sub    esp,0x18
   0x080483f8 <+6>:     mov    DWORD PTR [esp+0x4],0x2
   0x08048400 <+14>:    mov    DWORD PTR [esp],0x28
   0x08048407 <+21>:    call   0x80483dc <add>
   0x0804840c <+26>:    mov    DWORD PTR [ebp-0x4],eax
   0x0804840f <+29>:    mov    eax,DWORD PTR [ebp-0x4]
   0x08048412 <+32>:    leave  
   0x08048413 <+33>:    ret    
End of assembler dump.
(gdb) set disassembly-flavor att
(gdb) disass main
Dump of assembler code for function main:
   0x080483f2 <+0>:     push   %ebp
   0x080483f3 <+1>:     mov    %esp,%ebp
   0x080483f5 <+3>:     sub    $0x18,%esp
   0x080483f8 <+6>:     movl   $0x2,0x4(%esp)
   0x08048400 <+14>:    movl   $0x28,(%esp)
   0x08048407 <+21>:    call   0x80483dc <add>
   0x0804840c <+26>:    mov    %eax,-0x4(%ebp)
   0x0804840f <+29>:    mov    -0x4(%ebp),%eax
   0x08048412 <+32>:    leave  
   0x08048413 <+33>:    ret    
End of assembler dump.
```

Mais diantres, que veut dire ce charabia ? Et puis pourquoi la même commande a produit deux résultats différents ? C'est ce que nous allons voir maintenant, ce code n'aura plus de secrets pour vous...;

## Syntaxe

Dans un premier temps, nous allons expliquer pourquoi la même commande a produit deux résultats (pas vraiment) différents. C'est tout simplement une question de syntaxe. Il existe deux principales syntaxes pour représenter du langage assembleur x86 : La syntaxe Intel (plutôt retrouvée dans les environnements Windows) et la syntaxe AT&T (retrouvée dans les environnements Unix). Les différences entre ces deux syntaxes sont minimes. Avant de les lister, voyons la structure commune de ces deux syntaxes :

```text
OPERATION [ARG1 [, ARG2]]
```

L'opération est le nom de l'opération à effectuer. Les opérations prennent 0, 1 ou 2 arguments.

Pour supprimer toutes ambiguïtés entre les deux syntaxes, voici les différences :

### Ordre des paramètres

Lorsqu'une opération prend deux paramètres et que l'opération n'est pas commutative (i.e. **a OP b** et **b OP a** ne donnent pas le même résultat), il est important de connaître l'ordre de ces paramètres. Si nous voulions par exemple copier le nombre 42 dans le registre `EAX`, voici les deux syntaxes que nous retrouverions :

#### Intel :

```nasm
OPERATION DESTINATION, SOURCE
```

Exemple :

```nasm
mov eax, 42
```

#### AT&T :

```nasm
OPERATION SOURCE, DESTINATION
```

Exemple :

```text
mov $42, %eax
```

### Taille des paramètres

#### Intel :

Comme la taille des paramètres ne doit être indiquée que pour les paramètres non immédiats (non constant, donc avec une taille inconnue) c'est à dire les registres, elle est tout simplement intégrée au nom du registre :

`RAX`, `EAX`, `AX`, `AL` impliquent respectivement qword (64 bits), long (double word, 32 bits), word (16 bits) et byte (octet 8 bits).

#### AT&T :

Les noms des opérations sont suffixés avec une lettre correspondant à la taille des paramètres manipulés.

`q`, `l`, `w` et `b` (comme vus pour la syntaxe Intel)

```text
movl $42, %eax
```

42 sera copié dans `EAX`, sur une taille de 32 bits (l'espace non occupé sera mis à zéro)

### Préfixe de variable

#### Intel :

Les variables ne sont pas préfixées comme nous avons pu le voir :

```nasm
mov eax, 42
```

#### AT&T :

En revanche, en ce qui concerne la syntaxe AT&T, nous trouvons un `$` devant les valeurs immédiates (i.e. les constantes) et un `%` devant les registres, comme dans cet exemple :

```text
movl $42, %eax
```

### Adresse effective

Lorsqu'on parle de variables en mémoire, l'adresse effective représente l'adresse de la case mémoire où est stockée la variable. En assembleur x86, nous avons différents éléments pour définir une adresse mémoire

  * **base** : Registre de 32 bits (contenant le plus souvent une adresse)
  * **index** _(Optionnel)_ : Registre de 32 bits (contenant le plus souvent une adresse)
  * **scale** _(Optionnel)_ : Facteur valant 1, 2, 4 ou 8 multipliant **index**
  * **disp** _(Optionnel)_ : Déplacement (_displacement_), ajouté ou déduit à la fin du calcul
  * **segreg** _(Optionnel)_ : Segment mémoire (_Segment Register_) indiquant le segment dans lequel se trouve la donnée

#### Intel :

```text
segreg:[base+index*scale+disp]
```

Le calcul est effectué, puis les crochets indiquent que le résultat est une adresse mémoire (l'adresse effective), comme dans cet exemple :

```text
mov eax, [ ebx + ecx*2 + 0x80848c48 ]
```

Dans cet exemple, le double du contenu de `ECX` est ajouté au contenu de `EBX`, auquel on ajoute l'offset indiquée (ici `0x8084c48`), ce qui nous donne une nouvelle adresse. La valeur contenue à cette adresse est assignée à `EAX`.

Prenons un cas plus simple, pour être certains de ne pas nous emmêler les pinceaux. Soient :

```nasm
ebx = 0x80000000
ecx = 0x00000002
```

Si on trouve l'instruction

```text
mov eax, [ ebx + ecx*2 + 0x0000000a]
```

Alors le contenu des crochet se décompose de la manière suivante

```nasm
ebx + 2*ecx = 0x80000004
```

Puis on ajoute l'offset

```nasm
0x80000004 + 0x0000000a = 0x8000000e
```

Ensuite, on cherche ce qu'il y a en mémoire à l'adresse `0x8000000e`, et ce qu'on y trouve, on le met dans `EAX`.

#### AT&T :

La syntaxe est particulière et assez peu intuitive comparée à celle d'Intel. Sa forme générique est

```nasm
%segreg:disp(base,index,scale)
```

Comme dans l'exemple suivant :

```text
movl 0x80848c48(%ebx,%ecx,4), %eax
```

Exemple qui a le même comportement que celui donné pour Intel.

Voilà la fin d'un rapide résumé des différences entre les deux syntaxes les plus retrouvées. Dans l'ensemble de mes articles, **j'utilise la syntaxe Intel**, qui, bien qu'elle soit connotée Windows, me semble beaucoup plus claire donc adaptée à ces articles.

Nous allons voir maintenant les instructions les plus rencontrées lorsque l'on désassemble un programme. Cette liste est loin d'être exhaustive, mais elle permettra de s'y retrouver dans la majorité des exemples que j'ai donnés ou que je fournirai plus tard.

## Instructions communes

### Opérations mathématiques

#### SUB

Permet de soustraire une valeur à une autre

```nasm
sub eax, 42
```

eax = eax - 42

#### ADD

Permet d'additionner deux valeurs

```nasm
add eax, 42
```

eax = eax + 42

### Opérations logiques

#### AND

Effectue un ET logique

```nasm
AND 0x5, 0x3
```

5 est représenté en binaire par `101` et 3 par `011` donc un ET logique donne `001 = 0x1`. Ce code n'est pas utile, puisque le résultat n'est sauvé nulle part, on fera cette opération avec au moins un des deux paramètre qui est un registre.

#### XOR

Effectue un XOR logique. Souvent utilisé pour initialiser une variable à 0 via `XOR var, var`

```nasm
XOR eax, eax
```

Ce code est très souvent retrouvé pour initialiser le registre eax à zéro, puisqu'un xor ne donne 1 que si les bits sont différents.

### Assignations

#### MOV

Assigne une valeur à une variable

```nasm
mov eax, 0x00000042
```

`EAX` va contenir la valeur `0x00000042`

#### LEA

Assigne l'adresse d'une variable à une variable. `LEA` a une particularité, c'est que le deuxième argument est entre crochets, mais contrairement à d'habitude, cela ne veut pas dire qu'il sera déréférencé (c'est à dire que ça ne signifie pas que le résultat sera la variable située à l'adresse entre crochets).

```text
LEA eax, [ebp - 0xc]
```

Si `EBP` avait pour valeur `0xbffff484`, alors `ebp - 0xc` a pour valeur `0xbffff478`, et c'est bien cette adresse (et non la valeur contenue à cette adresse) qui sera stockée dans `EAX`.

### Manipulation de la pile

#### PUSH

Pousse l'argument passé à `PUSH` au sommet de la pile

```nasm
PUSH ebp
```

La valeur contenue dans `EBP` est mise sur le dessus de la pile

#### POP

Retire l'élément au sommet de la pile, et l'assigne à la valeur passée en argument. (Si nous voulons être plus exacts, l'élément au sommet de la pile reste là où il est, et le registre `ESP` qui pointe sur le sommet de la pile est mis à jour en pointant vers la valeur précédente sur la pile)

```nasm
POP ebp
```

L'élément qui était au sommet de la pile est assigné à `EBP`, et est retiré de la pile

### Tests

#### CMP

Compare les deux valeurs passées en argument

```nasm
CMP ecx, 0x10
```

Pour comparer ces deux éléments, une soustraction signée `ecx - 0x10` est effectuée

#### TEST EAX, EAX

Cette opération est logiquement équivalente à

```nasm
cmp eax, 0
```

Donc ce test permet de savoir si eax est positif ou non. Cependant, `CMP` effectue une soustraction, ce qui est plus lent que `TEST` qui effectue un `AND`. Mais le résultat est le même.

#### Jumps

Il existe de nombreuses instruction qui sautent à un autre endroit du code. Une instruction qui saute quelque soit la condition, et d'autres qui dépendent du résultat d'un test précédemment effectué. Sans condition, nous avons l'instruction

**JMP**

```nasm
JMP 0x80844264
```

qui va sauter à l'instruction située à l'adresse indiquée, quoiqu'il arrive.

Cependant, il existe de multiple sauts conditionnels. Nous n'allons pas tous les voir en détails ici, seulement ceux que nous retrouvons le plus. Ils seront présentés par paire, la condition et sa négation, représentée par un N (Not)

**JE - JNE**

Egal (Equal) - différent (Non Equal)

**JZ - JNZ**

Nul (Zero) - Non null (Non Zero)

**JA/JB - JNA/JNB (Non signé)**

Supérieur strictement (Above)/Inférieur strictement (Below) - Inférieur ou égal/Supérieur ou égal

**JAE/JBE - JNAE/JNBE**

Supérieur ou égal (Above or Equal)/Inférieur ou égal (Below or Equal) - Strictement inférieur/Strictement supérieur

**JG/JL (Signé)**

Supérieur (Greater)/ Inférieur (Lower)

### Fonctions

#### CALL adresse

L'instruction `call` permet de faire appel au code d'une autre fonction située à un espace mémoire différent. L'adresse qui lui est passée en argument permet de trouver ce code. Cet appel est en fait un condensé de deux instructions. La première permet de sauvegarder l'instruction qui suit le call (pour le retour de la fonction, afin de reprendre le fil d'exécution du programme) et la deuxième permet d'effectivement sauter à la fonction recherchée. Comme nous l'avons vu dans un article précédent sur le [fonctionnement de la pile](/stack-introduction/), le registre qui contient l'instruction suivante est `EIP`. Un call est donc finalement la suite de ces deux instructions :

```nasm
PUSH EIP
JMP adresse
```

#### LEAVE

A l'inverse `LEAVE` permet de préparer la sortie d'une fonction en récupérant les variables enregistrée lors du début de la fonction afin de retrouver le contexte d'exécution tel qu'il avait été enregistré juste avant d'exécuter le code de la fonction, tout détruisant ce qu'il restait du stackframe :

```nasm
MOV ESP, EBP
POP EBP
```

### RET

Enfin, l'instruction `RET` permet de finaliser le travail de `LEAVE` en récupérant l'adresse de l'instruction à exécuter après le call, adresse qui avait été enregistrée sur la pile lors de l'instruction `CALL`, et de sauter à cette adresse

```nasm
POP EIP
```

`EIP` a été modifiée et c'est l'instruction qui se situe à l'adresse contenue dans `EIP` qui sera ensuite traitée.

### Misc

Pour finir, une instruction qui peut paraître anodine comme ça, mais qui a sont importance certaine : L'instruction `NOP` (No OPeration). Cette instruction ... ne fait rien. Si le processeur tombe sur cette instruction, il va tout simplement ne rien faire, et passer à l'instruction suivante.

Voilà, vous avez tous les éléments en main pour comprendre le programme désassemblé fourni au début de l'article. Y arriverez-vous ?

Comme je suis de bonne humeur et que je n'aime pas faire les choses à moitié, nous allons le faire ensemble ! Retroussez vos manches, c'est parti !

## Mise en pratique

Rappelons le code du début de l'article, et ne prenons que la version dans la syntaxe Intel.

```bash
(gdb) disass main
Dump of assembler code for function main:
   0x080483f2 <+0>:     push   ebp
   0x080483f3 <+1>:     mov    ebp,esp
   0x080483f5 <+3>:     sub    esp,0x18
   0x080483f8 <+6>:     mov    DWORD PTR [esp+0x4],0x2
   0x08048400 <+14>:    mov    DWORD PTR [esp],0x28
   0x08048407 <+21>:    call   0x80483dc <add>
   0x0804840c <+26>:    mov    DWORD PTR [ebp-0x4],eax
   0x0804840f <+29>:    mov    eax,DWORD PTR [ebp-0x4]
   0x08048412 <+32>:    leave  
   0x08048413 <+33>:    ret    
End of assembler dump.
```

Pour que vous puissiez suivre, je ferai référence aux lignes telles qu'indiquées entre chevrons dans le code désassemblé. Par exemple, la ligne `+3` correspond à la ligne `0x080483f5 <+3>:     sub    esp,0x18` donc à l'instruction `sub esp, 0x18`

Allons-y ! Nous avons donc le code assembleur de la fonction `main` d'un programme que nous ne connaissons pas. La fonction `main` est une fonction comme une autre du point de vue du processeur, il convient donc, comme n'importe quelle fonction, de commencer par les 3 premières lignes typiques d'un début de fonction (parfois un peu plus, mais le principe reste le même), qu'on appelle le **prologue**. Ces lignes permettent en sommes de sauvegarder l'état de la fonction précédente, et de préparer la pile pour les variables locales de la fonction courante.

La ligne `+0`

```nasm
push    ebp
```

permet de pousser le registre `EBP` sur la pile. Pour rappel, `EBP` (Base Pointer) est le registre qui contient l'adresse du début du stackframe de la fonction courante. Comme nous entrons dans une fonction, il faut sauvegarder le début du stackframe de la fonction précédente, ce que fait cette ligne `+0`. Une fois ceci fait, il faut maintenant donner la valeur de notre nouvelle base de stackframe à `EBP`. Comme nous entrons à peine dans la fonction, nous n'avons encore rien empilé qui soit propre à la fonction, donc le sommet de la pile actuel correspond à la base du futur stackframe de la fonction main. Et où est contenue l'adresse du sommet de la pile ? Vous vous en souvenez, dans `ESP` (Stack Pointer ! Si ça vous est inconnu, je vous invite à relire l'article sur le [fonctionnement de la pile](/stack-introduction/)). La ligne `+1` enregistre alors le contenu de `ESP` dans `EBP`

```nasm
mov    ebp,esp
```

Voilà, notre registre `EBP` est prêt, il pointe sur le début du stackframe de la fonction `main`. Que fait la ligne suivante, ligne +3 ?

```nasm
sub    esp,0x18
```

Tout juste, elle soustrait `0x18` au registre `ESP`. `0x18` en hexadécimal, ça fait `1x16 + 8x1 = 24` en décimal. Rappelons que la pile grossit **vers le bas** pour les processeurs x86, cela veut dire que plus elle grossit, plus l'adresse du sommet de pile diminue. En soustrayant 24 de `ESP`, cela veut dire qu'on a fait grossir la pile de 24 octets. 24 octets sont alors alloués à la fonction `main` pour ses variables locales.

Voilà, nous avons le registre `EBP` qui pointe sur le début du stackframe, le registre `ESP` qui pointe sur le sommet de la pile, 24 octets plus loin.

Les deux lignes suivantes sont relativement similaires :

```text
0x080483f8 <+6>:     mov    DWORD PTR [esp+0x4],0x2
0x08048400 <+14>:    mov    DWORD PTR [esp],0x28
```

Ce sont deux instructions `MOV`, mais un peu plus compliquées que ce que nous avons vu jusque là. La première des deux lignes `+6` met la valeur `0x2` dans `DWORD PTR [esp+0x4]`. `DWORD` signifie que `0x2` va prendre la place d'un double word (32 bits). Or `0x2` pouvant être stockée sur un octet, les 3 autres seront initialisé à 0. `PTR [esp+0x4]` indique que `0x2` va être stocké à l'adresse `esp+0x4`. Rappelons encore que `ESP` contient l'adresse du sommet de la pile, donc `ESP + 0x4` contient l'adresse du deuxième emplacement de la pile (Une variable étant de la taille d'un `DWORD`, donc de 4 octets, sur une architecture 32 bits - parce que oui, 32 bits = 4 octets). La ligne `+6` met donc le nombre 2 en deuxième position sur la pile.

Avec ces explications, que fait la ligne `+14` ?

Elle met la valeur `0x28` (40 en décimal) à l'adresse contenue dans `ESP`, donc `0x28` est placé au sommet de la pile. Voici où nous en sommes :

[![img_55382697a63ab](/assets/uploads/2015/04/img_55382697a63ab.png)](/assets/uploads/2015/04/img_55382697a63ab.png)

Mais pourquoi donc placer ces valeurs arbitrairement comme ça ? Pourquoi sur la pile ? Quelle utilité ? Regardons la ligne suivante :

```nasm
call    0x80483dc <add>
```

Une instruction `CALL` ! Elle fait appel à la fonction située à l'adresse `0x80483dc`, et gdb nous a même retrouvé le nom de cette fonction, qui s'appelle `add()`. Fort bien, nous allons pouvoir désassembler `add` pour voir de quoi il en retourne !

```bash
(gdb) disass add
Dump of assembler code for function add:
   0x080483dc <+0>:     push   ebp
   0x080483dd <+1>:     mov    ebp,esp
   0x080483df <+3>:     sub    esp,0x10
   0x080483e2 <+6>:     mov    eax,DWORD PTR [ebp+0xc]
   0x080483e5 <+9>:     mov    edx,DWORD PTR [ebp+0x8]
   0x080483e8 <+12>:    add    eax,edx
   0x080483ea <+14>:    mov    DWORD PTR [ebp-0x4],eax
   0x080483ed <+17>:    mov    eax,DWORD PTR [ebp-0x4]
   0x080483f0 <+20>:    leave  
   0x080483f1 <+21>:    ret    
End of assembler dump.


```

Nous retrouvons le même schéma sur les trois premières lignes que celui de la fonction `main()`, le prologue de la fonction qui sauvegarde `EBP` de la fonction précédente (la fonction `main`), puis assigne `ESP` à `EBP` pour initialiser le début de la stackframe, et enfin qui décale le sommet de la pile de 16 octets pour que la fonction `add` puisse travailler avec ses variables locales.

Ensuite les lignes `+6` et `+9` sont similaires

```text
0x080483e2 <+6>:     mov    eax,DWORD PTR [ebp+0xc]
0x080483e5 <+9>:     mov    edx,DWORD PTR [ebp+0x8]
```

Ce sont deux instructions `MOV` qui initialisent `eax` et `edx`. Si on regarde l'instruction à la ligne `+12`, `add    eax,edx`, on remarque que ces deux registres vont être additionnés.

Par ailleurs, le nom de la fonction étant `add`, il y a fort à parier que le but de cette fonction est d'additionner deux nombres. Bref, revenons-en à nos deux lignes : Nous avons déjà vu la syntaxe `DWORD PTR [ebp + 0xc]` dans la fonction `main`. Cela signifie que nous allons chercher à l'adresse `EBP + 0xc`, et nous allons prendre le `DWORD` (32 bits) qui se situe là bas. Qu'y a-t-il à `EBP + 0xc` ? Un petit schéma de l'état de la pile s'impose

![stack](/assets/uploads/2015/04/img_553826170a520.png)

Avant l'appel de la fonction, les deux variables `0x2` et `0x28` ont été poussées sur la pile. Ensuite `EIP` a été poussé pendant le `call` et enfin `EBP`, ce qui explique le schéma précédent. Je vous rappelle que la pile part des adresses hautes et grandit en direction des adresses basses, mais qu'une variable en mémoire est lue dans le sens classique, donc des adresses basses vers les adresses hautes. La variable située à l'adresse `EBP - 0xc` a une taille de 4 octets. Ces 4 octets sont `EBP - 0xc + 0x0`, `EBP - 0xc + 0x1`, `EBP - 0xc + 0x2` et `EBP - 0xc + 0x3`. 

Dans le schéma précédent, à `EBP` on trouve la valeur de la sauvegarde du `EBP` de la fonction appelante. Puis à `EBP - 0x4` se trouve la sauvegarde de EIP, à `EBP - 0x8` se trouve une des valeurs poussées avant le `call` et à `EBP - 0xc` se trouve la deuxième valeur. On monte comme ça de 4 en 4 car ces variablez sont des adresses (EBP et EIP) ou des entiers donc ils prennent 4 octets en mémoire.

EAX va donc valloir `0x2` et `EDX` va recevoir la valeur `0x28`. Nous avons vu que la ligne suivante `+12` additionnait les deux valeurs et enregistrait le résultat dans `EAX`

```nasm
add    eax,edx
```

Les deux lignes qui suivent sont un petit peu plus complexes à comprendre

```text
0x080483ea <+14>:    mov    DWORD PTR [ebp-0x4],eax
0x080483ed <+17>:    mov    eax,DWORD PTR [ebp-0x4]
```

La première ligne `+14` permet de sauvegarder le résultat du calcul en case `ebp-0x4`, première case libre de la stackframe. La seconde permet de récupérer cette valeur, et la met dans `EAX`. Conventionnellement, `EAX` est le registre utilisé pour enregistrer le résultat d'une fonction que l'on veut retourner (`return something;`).

Les deux dernières lignes `+20` et `+21` permettent de retrouver l'état des registres avant d'exécuter la fonction.

```nasm
leave  
ret 
```

L'instruction `LEAVE` est en fait un condensé des deux opérations suivantes, comme nous l'avons vu au début de cet article :

```nasm
MOV ESP, EBP
POP EBP
```

La première permet de rebaser le sommet de la pile au niveau de `EBP`, donc ça supprime tout le reste de la pile, et la deuxième permet de récupérer l'ancienne valeur de `EBP` pour pouvoir retourner à la fonction `main`. Pour cela, la fonction `RET`, équivalente à l'opération suivante :

```nasm
POP EIP
```

permet de récupérer la valeur de `EIP` sauvegardée lors du `call`, et saute à cette instruction pour continuer la suite du programme :

```text
0x0804840c <+26>:    mov    DWORD PTR [ebp-0x4],eax
0x0804840f <+29>:    mov    eax,DWORD PTR [ebp-0x4]
```

Nous avons vu précédemment que le résultat de `add` était retourné dans `EAX`. Ce résultat est sauvegardé dans la première case de la stackframe, puis est à nouveau assignée à `EAX` exactement comme la fin de la fonction `add`. Encore une fois, cela signifie que c'est la valeur de retour de la fonction main.

Nous quittons ensuite la fonction `main` comme nous avons quitté la fonction `add` :

```text
0x080483f0 <+20>:    leave  
0x080483f1 <+21>:    ret
```

Parfait ! Nous avons tout vu !

Avez-vous deviné le code C du programme après cette étude ? Deux nombres `0x2` (2) et `0x28` (40) sont envoyés à la fonction `add`, qui retourne leur somme, que retourne également la fonction `main` :

```c
##include <stdio.h>
int add(int a, int b)
{
    int result = a + b;
    return result;
}

int main(int argc)
{
    int answer;
    answer = add(40, 2);
    return answer;
}
```

Vous aviez la même chose ? Félicitations ! J'espère que cet article vous aura été utile. Si des notions ou des paragraphes ont besoin d'être clarifiés, n'hésitez pas à poster des commentaires, je suis ouvert à toutes propositions !
