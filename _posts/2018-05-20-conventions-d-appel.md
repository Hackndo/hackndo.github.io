---
title: "Les conventions d'appel"
date: 2018-05-20 21:35:33
author: "Pixis"
layout: post
permalink: /conventions-d-appel/
disqus_identifier: 0000-0000-0000-00a1
cover: assets/uploads/2018/05/conventions-d-appel.png
description: "Voici un article qui n'est pas vraiment technique, pas vraiment compliqué, et pour lequel on trouve de la doc un peu partout, mais c'est le genre d'information que je lis un jour, que j'oublie quelques semaines plus tard, donc que j'ai envie de résumer avec mes mots une bonne fois pour toute"
tags:
  - windows
  - reseau
---


Voici un article qui n'est pas vraiment technique, pas vraiment compliqu&eacute;, et pour lequel on trouve de la doc un peu partout, mais c'est le genre d'information que je lis un jour, que j'oublie quelques semaines plus tard, donc que j'ai envie de r&eacute;sumer avec mes mots une bonne fois pour toute. Allons donc (re)d&eacute;couvrir les conventions d'appel dans le monde x86.

<!--more-->

## Introduction

Lorsqu'un programme est compil&eacute; (i.e. quand le code haut niveau utilis&eacute; par le programmeur est traduit en code machine), il existe diff&eacute;rentes conventions pour les appels de fonctions. Certaines d&eacute;cident que la fonction appelante prend ses responsabilit&eacute;s en nettoyant la pile apr&egrave;s l'appel d'une fonction (CDECL, FASTCALL).

D'autres cependant responsabilisent les fonctions en leur demandant de s'occuper de leur espace m&eacute;moire, et de tout bien nettoyer quand elles ont termin&eacute; (STDCALL).

Il y a &eacute;galement diff&eacute;rentes mani&egrave;res de passer des arguments &agrave; une fonction, par la pile ou par les registres.

Voici alors un article qui permet de clarifier tous ces points, permettant &agrave; chacun d'avoir une rapide synth&egrave;se des diff&eacute;rentes conventions d'appel.

Il est alors n&eacute;cessaire de d&eacute;couper cet article en deux. Une premi&egrave;re partie historique qui &eacute;num&egrave;re les principales conventions d'appel pour les architectures 32 bits, puis une deuxi&egrave;me qui pr&eacute;sente la convention par d&eacute;faut sur les architectures 64 bits.

## 32 bits

Dans les architectures 32 bits, il y a quelques registres disponibles, et quelques conventions d'appel existantes. Voici les principales.


### CDECL (Standard C Calling Convention)

Cette convention est celle utilisée par défaut par la plupart des compilateurs C/C++.

Ici, c'est la fonction appelante qui nettoie la pile pour la fonction qu'elle va appeler.

```nasm
caller:
    push    3        ; Utilisation de 4 octets sur la pile
    push    2        ; Utilisation de 4 octets sur la pile
    push    1        ; Utilisation de 4 octets sur la pile
    call    callee   ; Appel de la fonction
    add     esp, 0xc ; L'espace qui avait été alloué sur la pile pour les variables (12 octets) est nettoyé
```

### STDCALL (Standard Call)

Les arguments sont pouss&eacute;s sur la pile avant l'appel de la fonction, et la fonction appel&eacute;e est responsable du nettoyage de la pile, de telle sorte que lorsque la fonction est termin&eacute;e et que le programme reprend son ex&eacute;cution apr&egrave;s l'appel de la fonction, la pile semble ne pas avoir &eacute;t&eacute; modifi&eacute;e.

Il y a donc un prologue et un &eacute;pilogue dans chaque fonction pour g&eacute;rer la construction et la destruction de la pile n&eacute;cessaire au bon fonctionnement de cette fonction.

Lorsque la fonction appel&eacute;e se termine, il y aura un appel &agrave; l'instruction return avec un argument qui lui sera pass&eacute;, argument correspondant au nombre d'octets &agrave; lib&eacute;rer au moment du retour &agrave; la fonction appelante.

```nasm
caller:
    push    3
    push    2
    push    1
    call callee
```
```nasm
callee:
    push ebp
    mov ebp, esp
    ...
    mov esp, ebp
    pop ebp
    return 0xc       ; Car il y a 3 argument sur 4 octets à libérer, donc 12 octets
```

### FASTCALL (Fast Calling Convention)

Dans cette convention d'appel, les arguments ne sont plus pouss&eacute;s sur la pile, mais enregistr&eacute;s dans des registres. Cependant, dans une architecture 32 bits, seuls 2 registres sont utilisables pour cette convention. S'il y a plus de deux arguments &agrave; passer &agrave; la fonction, les suivants seront pouss&eacute;s sur la pile, comme dans les deux conventions d'appel vues pr&eacute;c&eacute;demment.

Par ailleurs, c'est la fonction appel&eacute;e qui est responsable du nettoyage de la pile.

Cette convention est th&eacute;oriquement plus rapide &agrave; l'ex&eacute;cution car elle r&eacute;duit le nombre de cycles d'instructions.

```nasm
caller:
    mov edx, 3
    mov ecx, 2
    call callee
```
```nasm
callee:
    push ebp
    mov ebp, esp
    ...
    mov esp, ebp
    pop ebp
    return
```

## 64 bits

Suite à l'arrivée de 8 nouveaux registres dans les architectures 64 bits (r8 à r15), c'est la convention FASTCALL qui est devenue celle par défaut. Elle permet alors de passer 4 arguments via les registres, au lieu de 2 comme pour les architectures 32 bits.

S'il y a plus de 4 arguments, les suivants sont poussés sur la pile.

Les registres utilisés sont, dans l'ordre, `rcx`, `rdx`, `r8` et `r9`.

```nasm
caller:
    mov r9, 4
    mov r8, 3
    mov rdx, 2
    mov rcx, 1
    call callee
```


## Récapitulatif

Voici les deux tableaux récapitulatifs qui permettent d'avoir une vision rapide des différentes conventions d'appel abordées dans cet article

### 32 bits

| Convention  | Transmission des arguments   | Responsabilité maintenance pile |
| ----------- |:----------------------------:|:-------------------------------:|
| CDECL       | Poussés sur la pile          | Fonction appelée                |
| STDCALL     | Poussés sur la pile          | Fonction appelante              |
| FASTCALL    | 2 registres puis sur la pile | Fonction appelée                |

### 64 bits

| Convention  | Transmission des arguments   | Responsabilité maintenance pile |
| ----------- |:----------------------------:|:-------------------------------:|
| FASTCALL    | 4 registres puis sur la pile | Fonction appelée                |


J'espère que cet article sur les conventions d'appel remettant les choses au clair, en restant concis et en allant à l'essentiel, vous permettra de vite trouver les informations que vous cherchez sur ce sujet.
