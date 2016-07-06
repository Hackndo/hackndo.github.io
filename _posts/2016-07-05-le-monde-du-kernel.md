---
title: "Le monde du kernel"
date: 2016-07-05  17:48:43
author: "hackndo"
layout: post
permalink: /le-monde-du-kernel/
disqus_identifier: 0000-0000-0000-0013
cover: assets/uploads/2016/07/kernel_1.jpg
tags:
  - kernelland
---

Bonjour à tous. Aujourd'hui, je commence une série d'articles qui va concerner le monde du kernel. Je signale maintenant que le livre [A guide to kernel exploitation - Exploiting the core](https://github.com/isislovecruft/library/raw/master/computer%20science%20theory/exploit%20development/A%20Guide%20to%20Kernel%20Exploitation%20Attacking%20the%20Core%20(2011).pdf) est la source principale de cette série.

Je l'ai lu en long, large et travers, mais il est en anglais et relativement long, donc je tente ici d'en faire une synthèse claire et digérable en français pour en faire profiter le plus de monde. J'espère qu'à la suite de cette lecture, vous aurez une compréhension suffisamment globale et profonde des rouages du kernel pour passer la barrière du copier/coller lors de lectures de tutoriaux pratiques.

Je ne me contente évidemment pas d'un simple résumé, je tente le plus possible d'ajouter des schémas ou des exemples pour rendre cette série la plus agréable à lire possible.

## Introduction

Lorsque vous utilisez votre ordinateur tous les jours, en allant sur internet, en regardant des films, ou encore en codant, une grosse machinerie est en route pour vous simplifier la vie. Pour utiliser votre wifi ou écouter de la musique, il faut à un moment donné communiquer avec le matériel, et pourtant vous n'avez pas besoin de connaitre le constructeur de votre carte réseau, ni celui de votre carte son. Si c'est possible, c'est parce que vous utilisez un système d'exploitation (ou OS, Operating System) qui sert de couche d'abstraction pour ces différentes contraintes. Et le coeur de l'OS est ce qu'on appelle le noyau (kernel).

![img]({{ site.baseurl }}assets/uploads/2016/06/Screen-Shot-2016-06-14-at-23.20.15.png)

Pour travailler sereinement et de manière sûre, le kernel a besoin de poser des barrières entre les actions critiques et les autres. Pour cela, il le fait au niveau matériel et au niveau logiciel.

* Au niveau **matériel**, la majorité des CPU ont des jeux d'instruction qui proposent deux modes d'exécution. Le premier est un mode privilégié dans lequel toutes les instructions sont disponibles tandis que le second est un mode non privilégié, ne donnant accès qu'à une partie des instructions.
* Au niveau **logiciel**, le kernel s'arrange pour avoir accès aux plages mémoires de tous les processus en cours d'exécution, tout en interdisant l'accès de sa propre plage mémoire aux autre processus. La plage mémoire du kernel est appelée Kernel-Land, tandis que la plage mémoire que voit chaque processus est appelée User-Land

Biensûr, ces protections, bien que nécessaires, ne sont pas suffisantes. De nos jours, tous les systèmes informatiques sont multi-utilisateurs et multi-tâches. Il ne faut par exemple pas qu'un utilisateur puisse s'accaparer toute la mémoire, ou toute la bande passante. Il faut également qu'il y ait la possibilité d'ajouter, supprimer ou modifier des utilisateurs, ou encore la possibilité de modifier le kernel pour le mettre à jour par exemple. Pour répondre à ces besoins, tous les utilisateurs ont un identifiant unique appelé UID (User ID), mais il y a un UID qui est spécial, et qui permet d'avoir des droits plus élevés que tous les autres. C'est celui de l'administrateur chez windows, ou du root chez Unix, généralement le 0. Cet utilisateur peut donc modifier le kernel, gérer les utilisateurs etc. C'est le tout puissant, c'est celui qu'on veut usurper quand il en vient à l'exploitation d'un système.

## Pourquoi le kernel ?

Depuis longtemps, les attaquants se concentrent sur le User-Land, ce qui a logiquement entrainé la prise de mesures de sécurité notamment de la part des développeurs d'OS. Les mesures de sécurité sont majoritairement logicielles et codées dans le kernel (ASLR, Canary, NX etc.). Ça parait donc logique que l'attention des attaquants s'est tournée vers le kernel.

Mais attention, écrire des exploits pour profiter de vulnérabilités dans le kernel n'est pas aussi simple que dans le User-Land. En effet, s'il y a une erreur dans le User-Land, l'application crash. S'il y a une erreur dans le Kernel-Land, le kernel crash. Et le kernel, c'est le coeur de l'OS, donc s'il crash, la machine ne peut plus fonctionner, donc elle s'éteint. Et ça, c'est balo, parce qu'on ne peut plus rien faire. Par ailleurs, nous avons dit que le kernel était protégé de manière matérielle et logicielle, donc il est plus compliqué de trouver des infos, d'autant plus que TOUS les processus en cours affectent l'état du kernel, donc il change rapidement, pas simple. Enfin, le kernel est extrêmement gros et complexe, donc l'attaquant doit comprendre en profondeur tous les méchanismes pour exploiter des vulnérabilités.

## Quelles sont les vulnérabilités du kernel ?

Sans être exhaustif, il existe différentes vulnérabilités.

Le kernel est responsable du _scheduling_ des différentes tâches pour simuler un comportement multi-tâches. Nous ne rentrerons pas dans les détails du scheduling, mais le fait que le kernel switch d'une tâche à l'autre permet l'utilisation de race conditions. C'est à dire qu'entre deux instructions peut s'écouler un temps plus ou moins long, et pour peu que la première instruction soit un check sur des droits et que la deuxième soit une action si les droits sont vérifiés, il est possible de modifier des éléments entre le check et l'action prise, pour que l'action s'effectue sur autre chose que prévu.

Par ailleurs, pour switcher d'un processus à l'autre, le kernel doit mémoriser des informations telles que les fichiers ouverts, les droits du processus, et quelles pages mémoires sont utilisées par celui-ci. Si nous trouvons où sont stockées ces infos et que nous les modifions, ça peut devenir intéressant.

Ensuite, le kernel est responsable de la gestion de la mémoire virtuelle. L'artigle sur [la gestion de la mémoire]({{ site.baseurl }}gestion-de-la-memoire/) en parle rapidement, mais ajoutons ici quelques informations et termes. La mémoire physique est divisée en _frames_, et la mémoire virtuelle en _pages_. Lorsqu'un processus a besoin d'espace mémoire, il demande à la mémoire physique de lui allouer des _pages_. C'est la table de pages qui fait le lien entre les _pages_ et les _frames_, avec une table de pages par processus.

![img]({{ site.baseurl }}assets/uploads/2016/06/Screen-Shot-2016-07-05-at-20.56.49.png)

Oui, il y a beaucoup de flèches. L'idée, c'est de montrer qu'à gauche, côté mémoire virtuelle, nous avons les _pages_ qui trouvent leur emplacement grace aux tables de pages qui font la traduction avec la mémoire physique découpée en _frames_.

Deux implémentations existent pour la séparation des pages allouées entre kernel et utilisateur.

* La première, c'est que la plage de mémoire virtuelle attribuée à un processus est **partagée**. Une partie pour le processus, l'autre partie pour le kernel. Pour cela, les entrées de la table de page du kernel sont répliquées dans la table de page du processus. C'est cette implémentation qui a été représentée dans le schéma précédent.
* La seconde, c'est que le kernel et le processus ont tous les deux une **zone mémoire complète et indépendente**.

![img]({{ site.baseurl }}assets/uploads/2016/06/Screen-Shot-2016-06-14-at-23.30.17.png)

La première implémentation est la plus intéressante. En effet, le CPU peut avoir deux contextes d'exécution. 

Le premier, qui ne nous intéresse pas vraiment, est le mode superviseur. C'est lorsqu'aucun processus n'est attaché au contexte. Ça arrive par exemple avec des interruptions réseau ou disque.

Mais dans le deuxième, le contexte processus (_process context_), un processus est associé, appelé le _backing process_, ce qui signifie que quelque part dans le kernel se trouvent les infos du processus en cours, et ça c'est cool pour nous. Comme on controle le _backing process_, on contrôle le user-land. Et comme on est dans le cas où la plage mémoire est partagée avec le kernel-land, si on trouve une faille dans le kernel, on peut rediriger le flot d'exécution dans le user-land, qu'on contrôle. Parfait! Voici un petit schéma qui illustre ces propos :

![img]({{ site.baseurl }}assets/uploads/2016/06/Screen-Shot-2016-07-05-at-21.28.07.png)

Comme la mémoire du kernel est répliquée pour tous les processus, on peut créer notre processus à nous, et exploiter la vulnérabilité dans le kernel qui nous permet de rediriger le flot d'exécution du kernel vers une partie de code qu'on a préparée, code qui va aller changer les infos de notre processus en cours pour lui donner des droits plus élevés.

Alors, prêts à plonger dans ce nouveau monde ?

[ La suite est en pleine rédaction - Stay tuned ]