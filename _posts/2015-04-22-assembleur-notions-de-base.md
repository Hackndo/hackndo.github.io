---
title: 'Assembleur &#8211; Notions de base'
date: 2015-04-22
author: "Hackndo"
layout: post
permalink: /assembleur-notions-de-base/
tags:
  - tuto
---
Salut tout le monde, voici un nouvel article qui va permettre, je pense, d'éclaircir bon nombre de notions que j'ai déjà abordées dans mes articles précédents, et qui permettront également de faciliter la compréhension des articles à venir.

Cet article à un but modeste : Comprendre la sortie d'un &#8216;disass main' sur un programme relativement simple (Mais si ! vous savez, cette commande dans gdb qui permet de désassembler un &#8211; i.e. produire le code assembleur d'un &#8211; binaire)

<pre lang="asm">(gdb) set disassembly-flavor intel
(gdb) disass main
Dump of assembler code for function main:
   0x080483f2 <+0>:     push   ebp
   0x080483f3 <+1>:     mov    ebp,esp
   0x080483f5 <+3>:     sub    esp,0x18
   0x080483f8 <+6>:     mov    DWORD PTR [esp+0x4],0x2
   0x08048400 <+14>:    mov    DWORD PTR [esp],0x28
   0x08048407 <+21>:    call   0x80483dc <add>
   0x0804840c <+26>:    mov    DWORD PTR [ebp-0x4],eax
   0x0804840f <+29>:    mov    eax,DWORD PTR [ebp-0x4]
   0x08048412 <+32>:    leave  
   0x08048413 <+33>:    ret    
End of assembler dump.
(gdb) set disassembly-flavor att
(gdb) disass main
Dump of assembler code for function main:
   0x080483f2 <+0>:     push   %ebp
   0x080483f3 <+1>:     mov    %esp,%ebp
   0x080483f5 <+3>:     sub    $0x18,%esp
   0x080483f8 <+6>:     movl   $0x2,0x4(%esp)
   0x08048400 <+14>:    movl   $0x28,(%esp)
   0x08048407 <+21>:    call   0x80483dc <add>
   0x0804840c <+26>:    mov    %eax,-0x4(%ebp)
   0x0804840f <+29>:    mov    -0x4(%ebp),%eax
   0x08048412 <+32>:    leave  
   0x08048413 <+33>:    ret    
End of assembler dump.</pre>

Mais diantres, que veut dire ce charabia ? Et puis pourquoi la même commande a produit deux résultats différents ? C'est ce que nous allons voir maintenant, ce code n'aura plus de secrets pour vous&#8230;

# Syntaxe

Dans une premier temps, nous allons expliquer pourquoi la même commande a produit deux résultats (pas vraiment) différents. C'est tout simplement une question de syntaxe. Il existe deux principales syntaxes pour représenter du langage assembleur x86 : La syntaxe Intel (plutôt retrouvée dans les environnements Windows) et la syntaxe AT&T (retrouvée dans les environnements Unix). Les différences entre ces deux syntaxes sont minimes. Avant de les lister, voyons la structure commune de ces deux syntaxes :

<pre lang="asm">OPERATION [ARG1 [, ARG2]]</pre>

L'opération est le nom de l'opération à effectuer. Les opérations prennent 0, 1 ou 2 arguments.

Pour supprimer toutes ambiguïtés entre les deux syntaxes, voici les différences :

## Ordre des paramètres

Lorsqu'une opération prend deux paramètres et que l'opération n'est pas commutative (i.e. **a OP b** et **b OP a** ne donnent pas le même résultat), il est important de connaître l'ordre de ces paramètres. Si nous voulions par exemple copier le nombre 42 dans le registre EAX, voici les deux syntaxes que noue retrouverions :

### Intel :

<pre lang="asm">OPERATION DESTINATION, SOURCE</pre>

Exemple :

<pre lang="asm">mov eax, 42</pre>

### AT&T :

<pre lang="asm">OPERATION SOURCE, DESTINATION</pre>

Exemple :

<pre lang="asm">mov $42, %eax</pre>

## Taille des paramètres

### Intel :

Comme la taille des paramètres ne doit être indiquée que pour les paramètres non immédiats (non constant, donc avec une taille inconnue) c'est à dire les registres, elle est tout simplement intégrée au nom du registre :

**RAX, EAX, AX, AL** impliquent respectivement qword (64 bits), long (double word, 32 bits), word (16 bits) et byte (octet 8 bits).

### AT&T :

Les noms des opérations sont suffixées avec une lettre correspondant à la taille des paramètres manipulés.

q, l, w et b (comme vus pour la syntaxe Intel)

<pre lang="asm">movl $42, %eax</pre>

42 sera copié dans eax, sur une taille de 32 bits (l'espace non occupé sera mis à zéro)

## Préfixe de variable

### Intel :

Les variables ne sont pas préfixées comme nous avons pu le voir :

<pre lang="asm">mov eax, 42</pre>

### AT&T :

En revanche, en ce qui concerne la syntaxe AT&T, nous trouvons un **$** devant les valeurs immédiates (i.e. les constantes) et un **%** devant les registres, comme dans cet exemple :

<pre lang="asm">movl $42, %eax</pre>

## Adresse effective

Lorsqu'on parle de variables en mémoire, l'adresse effective représente l'adresse de la case mémoire où est stockée la variable. En assembleur x86, nous avons différents éléments pour définir une adresse mémoire

  * **base** : Registre de 32 bits (contenant le plus souvent une adresse)
  * **index** _(Optionnel)_ : Registre de 32 bits (contenant le plus souvent une adresse)
  * **scale** _(Optionnel)_ : Facteur valant 1, 2, 4 ou 8 multipliant **index**
  * **disp** _(Optionnel)_ : Déplacement (_displacement_), ajouté ou déduit à la fin du calcul
  * **segreg** _(Optionnel)_ : Segment mémoire (_Segment Register_) indiquant le segment dans lequel se trouve la donnée

### Intel :

<pre lang="asm">segreg:[base+index*scale+disp]</pre>

Le calcul est effectué, puis les crochets indiquent que le résultat est une adresse mémoire (l'adresse effective), comme dans cet exemple :

<pre lang="asm">mov eax, [ebx + ecx*2 + 0x80848c48]</pre>

Dans cet exemple, le double du contenue de ecx est ajouté au contenu de ebx, auquel on ajoute l'offset indiquée (ici 0x8084c48), ce qui nous donne une nouvelle adresse. La valeur contenue à cette adresse est assignée à eax.

Prenons un cas plus simple, pour être certains de ne pas nous emmêler les pinceaux. Soient :

<pre lang="asm">ebx = 0x80000000
ecx = 0x00000002</pre>

Si on trouve l'instruction

<pre lang="asm">mov eax, [ebx + ecx*2 + 0x0000000a]</pre>

Alors le contenu des crochet se décompose de la manière suivante

<pre lang="asm">ebx + 2*ecx = 0x80000004</pre>

Puis on ajoute l'offset

<pre lang="asm">0x80000004 + 0x0000000a = 0x8000000e</pre>

Ensuite, on cherche ce qu'il y a en mémoire à l'adresse 0x8000000e, et ce qu'on y trouve, on le met dans eax.

### AT&T :

La syntaxe est particulière et assez peu intuitive comparée à celle d'Intel. Sa forme générique est

<pre lang="asm">%segreg:disp(base,index,scale)</pre>

Comme dans l'exemple suivant :

<pre lang="asm">movl 0x80848c48(%ebx,%ecx,4), %eax</pre>

Exemple qui a le même comportement que celui donné pour Intel.

Voilà la fin d'un rapide résumé des différences entre les deux syntaxes les plus retrouvées. Dans l'ensemble de mes articles, **j'utilise la syntaxe Intel**, qui, bien qu'elle soit connotée &#8220;Windows&#8221;, me semble beaucoup plus claire donc adaptée à ces articles.

Nous allons voir maintenant les instructions les plus rencontrées lorsque l'on désassemble un programme. Cette liste est loin d'être exhaustive, mais elle permettra de s'y retrouver dans la majorité des exemples que j'ai donnés ou que je fournirai plus tard.

# Instructions communes

## Opérations mathématiques

### SUB

Permet de soustraire une valeur à une autre

<pre lang="asm">sub eax, 42</pre>

eax = eax &#8211; 42

### ADD

Permet d'additionner deux valeurs

<pre lang="asm">add eax, 42</pre>

eax = eax + 42

## Opérations logiques

### AND

Effectue un ET logique

<pre lang="asm">AND 0x5, 0x7</pre>

5 est représenté en binaire par 0101 et 7 par 1110 donc un ET logique donne 0100 = 0x4. Ce code n'est pas utile, puisque le résultat n'est sauvé nulle part, on fera cette opération avec au moins un des deux paramètre qui est un registre.

### XOR

Effectue un XOR logique. Souvent utilisé pour initialiser une variable à 0 via XOR var, var

<pre lang="asm">XOR eax, eax</pre>

Ce code est très souvent retrouvé pour initialiser le registre eax à zéro, puisqu'un xor ne donne 1 que si les bits sont différents.

## Assignations

### MOV

Assigne une valeur à une variable

<pre lang="asm">mov eax, 0x00000042</pre>

eax va contenir l'adresse 0x00000042

### LEA

Assigne l'adresse d'une variable à une variable. LEA a une particularité, c'est que le deuxième argument est entre crochets, mais contrairement à d'habitude, cela ne veut pas dire qu'il sera déréférencé (c'est à dire que ça ne signifie pas que le résultat sera la variable située à l'adresse entre crochets).

<pre lang="asm">LEA eax, [ebp - 0xc]</pre>

Si ebp avait pour valeur 0xbffff484, alors ebp &#8211; 0xc a pour valeur 0xbffff478, et c'est bien cette adresse (et non la valeur contenu à cette adresse) qui sera stockée dans eax.

## Manipulation de la pile

### PUSH

Pousse l'argument passé à PUSH au sommet de la pile

<pre lang="asm">PUSH ebp</pre>

La valeur contenue dans ebp est mise sur le dessus de la pile

### POP

Retire l'élément au sommet de la pile, et l'assigne à la valeur passée en argument

<pre lang="asm">POP ebp</pre>

L'élément qui était au sommet de la pile est assigné à ebp, et est retiré de la pile

## Tests

### CMP

Compare les deux valeurs passées en argument

<pre lang="asm">CMP ecx, 0x10</pre>

Pour comparer ces deux éléments, une soustraction signée ecx &#8211; 0x10 est effectuée

### TEST EAX, EAX

Cette opération est logiquement équivalente à

<pre lang="asm">cmp eax, 0</pre>

Donc ce test permet de savoir si eax est positif ou non. Cependant, CMP effectue une soustraction, ce qui est plus lent que TEST qui effectue un AND. Mais le résultat est le même.

### Jumps

Il existe de nombreuses instruction qui sautent à un autre endroit du code. Une instruction qui saute quelque soit la condition, et d'autres qui dépendent du résultat d'un test précédemment effectué. Sans condition, nous avons l'instruction

**JMP**

<pre lang="asm">JMP 0x80844264</pre>

qui va sauter à l'instruction située à l'adresse indiquée, quoiqu'il arrive.

Cependant, il existe de multiple sauts conditionnels. Nous n'allons pas tous les voir en détails ici, seulement ceux que nous retrouvons le plus. Ils seront présentés par paire, la condition et sa négation, représentée par un N (Not)

**JE &#8211; JNE**

Egal (Equal) &#8211; différent (Non Equal)

**JZ &#8211; JNZ**

Nul (Zero) &#8211; Non null (Non Zero)

**JA/JB &#8211; JNA/JNB (Non signé)**

Supérieur strictement (Above)/Inférieur strictement (Below) &#8211; Inférieur ou égal/Supérieur ou égal

**JAE/JBE &#8211; JNAE/JNBE**

Supérieur ou égal (Above or Equal)/Inférieur ou égal (Below or Equal) &#8211; Strictement inférieur/Strictement supérieur

**JG/JL (Signé)**

Supérieur (Greater)/ Inférieur (Lower)

## Fonctions

### CALL adresse

L'instruction call permet de faire appel au code d'une autre fonction située à un espace mémoire différent. L'adresse qui lui est passée en argument permet de trouver ce code. Cet appel est en fait un condensé de deux instructions. La première permet de sauvegarder l'instruction qui suit le call (pour le retour de la fonction, afin de reprendre le fil d'exécution du programme) et la deuxième permet d'effectivement sauter à la fonction recherchée. Comme nous l'avons vu dans un article précédent sur le [fonctionnement de la pile](http://blog.hackndo.com/?p=246 "Fonctionnement de la pile"), le registre qui contient l'instruction suivante est EIP. Un call est donc finalement la suite de ces deux instructions :

<pre lang="asm">PUSH EIP
JMP adresse</pre>

### LEAVE

A l'inverse LEAVE permet de préparer la sortie d'une fonction en récupérant les variables enregistrée lors du début de la fonction afin de retrouver le contexte d'exécution tel qu'il avait été enregistré juste avant d'exécuter le code de la fonction, tout détruisant ce qu'il restait du stackframe :

<pre lang="asm">MOV ESP, EBP
POP EBP</pre>

## RET

Enfin, l'instruction RET permet de finaliser le travail de LEAVE en récupérant l'adresse de l'instruction à exécuter après le call, adresse qui avait été enregistrée sur la pile lors de l'instruction CALL, et de sauter à cette adresse

<pre lang="asm">POP EIP</pre>

Comme EIP a été modifiée, c'est l'instruction qui se situe à l'adresse contenue dans EIP qui sera ensuite effectuée.

## Misc

En dernier, une instruction qui peut paraître anodine comme ça, mais qui a sont importance certaine : L'instruction **NOP** (No OPeration). Cette instruction &#8230; ne fait rien. Si le processeur tombe sur cette instruction, il va tout simplement ne rien faire, et passer à l'instruction suivante.

&nbsp;

Voilà, vous avez tous les éléments en main pour comprendre le programme désassemblé fourni au début de l'article. Y arriverez-vous ?

&#8230;

Comme je suis de bonne humeur, nous allons le faire ensemble ! Retroussez vos manches, c'est parti !

# Mise en pratique

Rappelons le code du début de l'article, et ne prenons que la version dans la syntaxe Intel.

<pre lang="asm">(gdb) disass main
Dump of assembler code for function main:
   0x080483f2 <+0>:     push   ebp
   0x080483f3 <+1>:     mov    ebp,esp
   0x080483f5 <+3>:     sub    esp,0x18
   0x080483f8 <+6>:     mov    DWORD PTR [esp+0x4],0x2
   0x08048400 <+14>:    mov    DWORD PTR [esp],0x28
   0x08048407 <+21>:    call   0x80483dc <add>
   0x0804840c <+26>:    mov    DWORD PTR [ebp-0x4],eax
   0x0804840f <+29>:    mov    eax,DWORD PTR [ebp-0x4]
   0x08048412 <+32>:    leave  
   0x08048413 <+33>:    ret    
End of assembler dump.</pre>

Pour que vous puissiez suivre, je ferai référence aux lignes telles qu'indiquées entre chevrons dans le code désassemblé. Par exemple, la ligne +3 correspond à l'instruction **sub esp, 0x18**

Allons-y ! Nous avons donc le code assembleur de la fonction main d'un programme que nous ne connaissons pas. La fonction main est une fonction comme une autre du point de vue du processeur, il convient donc, comme n'importe quelle fonction, de commencer par les 3 premières lignes typiques d'un début de fonction, qu'on appelle le prologue. Ces lignes permettent en sommes de sauvegarder l'état de la fonction précédente, et de préparer la pile pour les variables locales de la fonction courante.

La ligne +0

<pre lang="asm">0x080483f2 <+0>:     push   ebp</pre>

permet de pousser le registre EBP sur la pile. Pour rappel, EBP (Base Pointer) est le registre qui contient l'adresse du début du stackframe de la fonction courante. Comme nous entrons dans une fonction, il faut sauvegarder le début du stackframe de la fonction précédente, ce que fait cette ligne +0. Une fois ceci fait, il faut maintenant donner la valeur de notre nouvelle base de stackframe à EBP. Comme nous entrons à peine dans la fonction, nous n'avons encore rien empilé qui soit propre à la fonction, donc le sommet de la pile actuel correspond à la base du futur stackframe de la fonction main. Et où est contenue l'adresse du sommet de la pile ? Vous vous en souvenez, dans ESP (Stack Pointer ! Si ça vous est inconnu, je vous invite à relire l'article sur le [fonctionnement de la pile](http://blog.hackndo.com/fonctionnement-de-la-pile/ "Fonctionnement de la pile")). La ligne +1 enregistre alors le contenu de ESP dans EBP

<pre lang="asm">0x080483f3 <+1>:     mov    ebp,esp</pre>

Voilà, notre registre EBP est prêt, il pointe sur le début du stackframe de la fonction _main_. Que fait la ligne suivante, ligne +3 ?

<pre lang="asm">0x080483f5 <+3>:     sub    esp,0x18</pre>

Tout juste, elle soustrait 0x18 au registre esp. 0x18 en hexadécimal, ça fait 1&#215;16 + 8&#215;1 = 24 en décimal. Rappelons que la pile grossit **vers le bas** pour les processeurs x86, cela veut dire que plus elle grossit, plus l'adresse du sommet de pile diminue. En soustrayant 24 de ESP, cela veut dire qu'on a fait grossir la pile de 24 octets. 24 octets sont alors alloués à la fonction _main_ pour ses variables locales.

Voilà, nous avons le registre EBP qui pointe sur le début du stackframe, le registre ESP qui pointe sur le sommet de la pile, 24 octets plus loin.

Les deux lignes suivantes sont relativement similaires :

<pre lang="asm">0x080483f8 <+6>:     mov    DWORD PTR [esp+0x4],0x2
0x08048400 <+14>:    mov    DWORD PTR [esp],0x28</pre>

Ce sont deux instructions MOV, mais un peu plus compliquées que ce que nous avons vu jusque là. La première des deux lignes (+6) met la valeur 0x2 dans DWORD PTR [esp+0x4]. DWORD signifie que 0x2 va prendre la place d'un double word (32 bits). Or 0x2 pouvant être stockée sur un octet, les 3 autres seront initialisé à 0. PTR [esp+0x4] indique que 0x2 va être stocké à l'adresse esp+0x4. Rappelons encore que ESP contient l'adresse du sommet de la pile, donc ESP + 0x4 contient l'adresse du deuxième emplacement de la pile (Une variable étant de la taille d'un DWORD, donc de 4 octets, sur une architecture 32 bits &#8211; parce que oui, 32 bits = 4 octets). La ligne 6 met donc le nombre 4 en deuxième position sur la pile.

Avec ces explications, que fait la ligne +14 ?

Elle met la valeur 0x28 (40 en décimal) à l'adresse contenue dans ESP, donc 0x28 est placé au sommet de la pile. Voici où nous en sommes :

![img]({{ site.baseurl }}assets/uploads/2015/04/img_55382697a63ab.png?w=640" alt="" srcset="http://i0.wp.com/blog.hackndo.com/assets/uploads/2015/04/img_55382697a63ab.png?w=363 363w, http://i0.wp.com/blog.hackndo.com/assets/uploads/2015/04/img_55382697a63ab.png?resize=300%2C275 300w" sizes="(max-width: 363px) 100vw, 363px" data-recalc-dims="1)

Mais pourquoi donc placer ces valeurs arbitrairement comme ça ? Pourquoi sur la pile ? Quelle utilité ? Regardons la ligne suivante :

<pre lang="asm">0x08048407 <+21>:    call   0x80483dc <add></pre>

Une instruction CALL ! Elle fait appel à la fonction située à l'adresse 0x80483dc, et gdb nous a même retrouvé le nom de cette fonction, qui s'appelle **add**. Fort bien, nous allons pouvoir désassembler **add** pour voir de quoi il en retourne !

<pre lang="asm">(gdb) disass add
Dump of assembler code for function add:
   0x080483dc <+0>:     push   ebp
   0x080483dd <+1>:     mov    ebp,esp
   0x080483df <+3>:     sub    esp,0x10
   0x080483e2 <+6>:     mov    eax,DWORD PTR [ebp+0xc]
   0x080483e5 <+9>:     mov    edx,DWORD PTR [ebp+0x8]
   0x080483e8 <+12>:    add    eax,edx
   0x080483ea <+14>:    mov    DWORD PTR [ebp-0x4],eax
   0x080483ed <+17>:    mov    eax,DWORD PTR [ebp-0x4]
   0x080483f0 <+20>:    leave  
   0x080483f1 <+21>:    ret    
End of assembler dump.

</pre>

Nous retrouvons le même schéma sur les trois premières lignes que celui de la fonction _main_, le prologue de la fonction qui sauvegarde EBP de la fonction précédente (la fonction _main_), puis assigne ESP à EBP pour initialiser le début de la stackframe, et enfin qui décale le sommet de la pile de 16 octets pour que la fonction _add_ puisse travailler avec ses variables locales.

Ensuite les lignes +6 et +9 sont similaires

<pre lang="asm">0x080483e2 <+6>:     mov    eax,DWORD PTR [ebp+0xc]
0x080483e5 <+9>:     mov    edx,DWORD PTR [ebp+0x8]</pre>

Ce sont deux instructions MOV qui initialisent eax et edx. Si on regarde l'instruction à la ligne +12, on remarque que ces deux registres vont être additionnés. Par ailleurs, le nom de la fonction étant **add**, il y a fort à parier que le but de cette fonction est d'additionner deux nombres. Bref, revenons-en à nos deux lignes : Nous avons déjà vu la syntaxe DWORD PTR [ebp + 0xc] dans la fonction main. Cela signifie que nous allons chercher à l'adresse EBP + 0xc, et nous allons prendre le double word (32 bits) qui se situe là bas. Qu'y a-t-il à EBP + 0xc ? Un petit schéma de l'état de la pile s'impose

<img class=" size-full wp-image-566  aligncenter" src="http://i2.wp.com/blog.hackndo.com/assets/uploads/2015/04/img_553826170a520.png?w=640" alt="" srcset="http://i2.wp.com/blog.hackndo.com/assets/uploads/2015/04/img_553826170a520.png?w=505 505w, http://i2.wp.com/blog.hackndo.com/assets/uploads/2015/04/img_553826170a520.png?resize=269%2C300 269w" sizes="(max-width: 505px) 100vw, 505px" data-recalc-dims="1" />

À EBP &#8211; 0xc se trouve &#8230; 0x2 ! Oui, 0x2 car pour lire une case mémoire, le processeur va commencer à EBP &#8211; 0xc puis va lire la case suivante EBP &#8211; 0xc + 0x1 etc. Or la pile étant inversée, la lecture de la valeur se fait dans le sens inverse, on remonte donc dans le schéma précédent.

Ainsi, à EBP &#8211; 0xc se trouve 0x2, et à EBP &#8211; 0x8 se trouve 0x28. EAX va donc valloir 0x2 et EDX va recevoir la valeur 0x28. Nous avons vu que la ligne suivante additionnait les deux valeurs et enregistrait le résultat dans eax

<pre lang="asm">0x080483e8 <+12>:    add    eax,edx</pre>

Les deux lignes qui suivent sont un petit peu plus complexes à comprendre

<pre lang="asm">0x080483ea <+14>:    mov    DWORD PTR [ebp-0x4],eax
0x080483ed <+17>:    mov    eax,DWORD PTR [ebp-0x4]</pre>

La première ligne permet de sauvegarder le résultat du calcul en case ebp-0x4, première case libre de la stackframe. La seconde permet de récupérer cette valeur, et la met dans eax. Conventionnellement, eax est le registre utilisé pour enregistrer le résultat d'une fonction que l'on veut retourner (return something;).

Les deux dernières lignes permettent de retrouver l'état des registres avant d'exécuter la fonction.

<pre lang="asm">0x080483f0 <+20>:    leave  
0x080483f1 <+21>:    ret </pre>

L'instruction LEAVE est en fait un condensé des deux opérations suivantes, comme nous l'avons vu au début de cet article :

<pre lang="asm">MOV ESP, EBP
POP EBP</pre>

La première permet de rebaser le sommet de la pile au niveau de EBP, donc ça supprime tout le reste de la pile, et la deuxième permet de récupérer l'ancienne valeur de EBP pour pouvoir retourner à la fonction _main_. Pour cela, la fonction RET, équivalente à l'opération suivante :

<pre lang="asm">POP EIP</pre>

permet de récupérer la valeur de EIP sauvegardée lors du **call**, et saute à cette instruction pour continuer la suite du programme :

<pre lang="asm">0x0804840c <+26>:    mov    DWORD PTR [ebp-0x4],eax
0x0804840f <+29>:    mov    eax,DWORD PTR [ebp-0x4]</pre>

Nous avons vu précédemment que le résultat de add était retourné dans eax. Ce résultat est sauvegardé dans la première case de la stackframe, puis est à nouveau assignée à eax exactement comme la fin de la fonction _add_. Encore une fois, cela signifie que c'est la valeur de retour de la fonction main.

Nous quittons ensuite la fonction _main_ comme nous avons quitté la fonction _add_ :

<pre lang="asm">0x080483f0 <+20>:    leave  
0x080483f1 <+21>:    ret</pre>

Parfait ! Nous avons tout vu !

Avez-vous deviné le code C du programme après cette étude ? Deux nombres 0x2 (2) et 0x28 (40) sont envoyés à la fonction _add_, qui retourne leur somme, que retourne également la fonction _main_ :

<pre class="lang:c">#include <stdio.h>
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
}</pre>

Vous aviez la même chose ? Félicitations ! J'espère que cet article vous aura été utile. Si des notions ou des paragraphes ont besoin d'être clarifiés, n'hésitez pas à poster des commentaires, je suis ouvert à toutes propositions !