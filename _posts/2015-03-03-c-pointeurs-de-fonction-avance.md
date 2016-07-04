---
title: 'C &#8211; Pointeurs de fonction (Trick)'
date: 2015-03-03
author: "Hackndo"
layout: post
permalink: /c-pointeurs-de-fonction-avance/
tags:
  - tuto
---
Voici un petit mémo sur les pointeurs de fonction. Pour rappel, un pointeur est une variable qui contient une adresse mémoire d'une donnée. La donnée peut être un int, un float, un tableau, etc. Mais ça peut aussi être l'adresse d'une fonction. Mais qu'est ce que ça veut dire que l'adresse d'une fonction ?

Lorsqu'on compile un programme, le code est en fait transformé en instructions machine que peut comprendre le processeur. Ce code est stocké sur le disque dur. Une fois qu'on exécute le programme, alors le code est copié dans la mémoire vive de la machine, et c'est seulement ensuite qu'il sera exécuté. Il est donc écrit dans la mémoire vive, dans le segment qu'on appelle **segment _text_**. Les instructions sont lues les unes à la suite des autres par défaut. Mais parfois il peut y avoir des instructions qui, explicitement, demandent au processeur de sauter à une case mémoire en particulier, notamment lors de l'appel de fonction (avec l'instruction **call**). C'est cette adresse (qu'on appelle point d'entrée ou _Entry Point_) qui contient,la première instruction de la fonction, qui est ce qu'on appelle **l'adresse de la fonction**.

Voici un schéma d'une portion du segment _text_ de la mémoire vive allouée à l'exécutable :

<p style="text-align: center;">
  ![img]({{ site.baseurl }}assets/uploads/2015/03/img_54f50475e7615.png?w=640" alt="" data-recalc-dims="1)
</p>

Je disais donc qu'un pointeur pouvait contenir l'adresse d'une fonction. Comment déclare-t-on cela ?

<pre class="lang:c">int (*ptr)(float, int);</pre>

En fait, cette déclaration est composée de trois partie. La première **int** signifie que la valeur de retour de la fonction qui sera pointée devra être de type int. Ensuite **ptr** est le nom du pointeur. Enfin **float, int** représente les types d'argument que doit prendre en paramètre la fonction qui sera pointée.

<p style="text-align: center;">
  <img class="alignnone size-full wp-image-405 " src="http://i2.wp.com/blog.hackndo.com/assets/uploads/2015/03/img_54f577a2f3431.png?w=640" alt="" data-recalc-dims="1" />
</p>

Ainsi :

<pre class="lang:c">int myFunction(float f, int i); // ptr pourra pointer vers cette fonction
void myOtherFunction();         // ptr ne pourra pas pointer vers cette fonction</pre>

Cependant, pour l'instant, ptr ne pointe vers rien du tout. Il faut lui donner l'adresse de la fonction. Comment faire ? et bien tout simplement comme ça :

<pre class="lang:c">int myFunction(float f, int i);
int (*ptr)(float, int);
ptr = &myFunction; // Ou bien ptr = myFunction car myFunction, sans les parenthèses () représente déjà l'adresse de la fonction. &myFunction == myFunction => true
</pre>

Pour exécuter la fonction, il suffit alors de déréférencer le pointeur, ce qui donnera la valeur de la fonction, et de lui passer les arguments nécessaires :

<pre class="lang:c">int myFunction(float f, int i);
int (*ptr)(float, int);
ptr = myFunction;
int retour = (*ptr)(2.0, 3);
</pre>

**retour** contiendra alors la valeur de retour de la fonction myFunction, pointée par ptr.
  
On peut également définir un pointeur &#8220;temporaire anonyme&#8221; vers une fonction en une ligne, de la manière suivante :

<pre class="lang:c">(int(*)(float, int))myFunc;</pre>

Je l'appelle anonyme parce qu'il n'a pas de nom (contrairement à la déclaration de **ptr** dans l'exemple précédent) et n'ayant pas de nom, on ne pourra pas l'utiliser à la ligne suivante, expliquant pourquoi je le qualifie de temporaire.
  
Et pour l'exécuter dans la même ligne, il suffit encore de le déréférencer et lui passer les arguments :

<pre class="lang:c">(*(int(*)(float, int))myFunc)(2.0, 4);</pre>

Si vous avez bien suivi, ce pointeur anonyme temporaire est en fait égal à &#8230; l'adresse de la fonction ! Et pour s'en convaincre, le code suivant :

<pre class="lang:c">if (myFunc == (int(*)(float, int))myFunc) {
    printf("Les deux éléments sont similaires. Ils contiennent tous les deux l'adresse de la fonction myFunc.");
}</pre>