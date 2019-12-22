---
title: 'Pointeurs de fonction en C'
date: 2015-03-03
author: "Pixis"
layout: post
permalink: /c-pointeurs-de-fonction/
disqus_identifier: 0000-0000-0000-000C
description: "Voici un petit mémo sur les pointeurs de fonction."
cover: assets/uploads/2015/03/shellcode.jpg
tags:
    - Misc
---
Voici un petit mémo sur les pointeurs de fonction. Pour rappel, un pointeur est une variable qui contient une adresse mémoire d'une donnée. La donnée peut être un int, un float, un tableau, etc. Mais ça peut aussi être l'adresse d'une fonction. Mais qu'est ce que ça veut dire que l'adresse d'une fonction ?

<!--more-->

## Comment ça marche ?

Lorsqu'on compile un programme, le code est en fait transformé en instructions machine que peut comprendre le processeur. Ce code est stocké sur le disque dur. Une fois qu'on exécute le programme, alors le code est copié dans la mémoire vive de la machine, et c'est seulement ensuite qu'il sera exécuté. Il est donc écrit dans la mémoire vive, dans le segment qu'on appelle **segment _text_**. Les instructions sont lues les unes à la suite des autres par défaut. Mais parfois il peut y avoir des instructions qui, explicitement, demandent au processeur de sauter à une case mémoire en particulier, notamment lors de l'appel de fonction (avec l'instruction `call`). C'est cette adresse (qu'on appelle point d'entrée ou _Entry Point_) qui contient,la première instruction de la fonction, qui est ce qu'on appelle **l'adresse de la fonction**.

Voici un schéma d'une portion du segment _text_ de la mémoire vive allouée à l'exécutable :

[![img_54f50475e7615](/assets/uploads/2015/03/img_54f50475e7615.png)](/assets/uploads/2015/03/img_54f50475e7615.png)

Je disais donc qu'un pointeur pouvait contenir l'adresse d'une fonction. Comment déclare-t-on cela ?

```c
int (*ptr)(float, int);
```

En fait, cette déclaration est composée de trois partie. La première **int** signifie que la valeur de retour de la fonction qui sera pointée devra être de type int. Ensuite **ptr** est le nom du pointeur. Enfin **float, int** représente les types d'argument que doit prendre en paramètre la fonction qui sera pointée.


[![img_54f577a2f3431](/assets/uploads/2015/03/img_54f577a2f3431.png)](/assets/uploads/2015/03/img_54f577a2f3431.png)


Ainsi :

```c
int myFunction(float f, int i); // ptr pourra pointer vers cette fonction
void myOtherFunction();         // ptr ne pourra pas pointer vers cette fonction
```

Cependant, pour l'instant, `ptr` ne pointe vers rien du tout. Il faut lui donner l'adresse de la fonction. Comment faire ? et bien tout simplement comme ça :

```c
int myFunction(float f, int i);
int (*ptr)(float, int);
ptr = &myFunction;
/*
 * Ou bien ptr = myFunction car myFunction, sans les parenthèses ()
 * représente déjà l'adresse de la fonction.
 * &myFunction == myFunction => true
 */

```

Pour exécuter la fonction, il suffit alors de déréférencer le pointeur, ce qui donnera la valeur de la fonction, et de lui passer les arguments nécessaires :

```c
int myFunction(float f, int i);
int (*ptr)(float, int);
ptr = myFunction;
int retour = (*ptr)(2.0, 3);

```

`retour` contiendra alors la valeur de retour de la fonction `myFunction`, pointée par `ptr`.

## Temporaire et anonyme
  
On peut également définir un pointeur "temporaire anonyme" vers une fonction en une ligne, de la manière suivante :

```c
(int(*)(float, int))myFunc;
```

Je l'appelle anonyme parce qu'il n'a pas de nom (contrairement à la déclaration de `ptr` dans l'exemple précédent) et n'ayant pas de nom, on ne pourra pas l'utiliser à la ligne suivante, expliquant pourquoi je le qualifie de temporaire.
  
Et pour l'exécuter dans la même ligne, il suffit encore de le déréférencer et lui passer les arguments :

```c
(*(int(*)(float, int))myFunc)(2.0, 4);
```

Si vous avez bien suivi, ce pointeur anonyme temporaire est en fait égal à... l'adresse de la fonction ! Et pour s'en convaincre, le code suivant :

```c
if (myFunc == (int(*)(float, int))myFunc) {
    printf("Les deux éléments sont similaires.\n");
    printf("Ils contiennent tous les deux l'adresse de myFunc.");
}
```

Voilà, un bref rappel sur les pointeurs de fonction, et une explication d'une syntaxe un peu particulière comme celle du dernier exemple.