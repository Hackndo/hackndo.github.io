---
title: "Ecrire et contourner un EDR côté noyau - Partie 1 : Kernel & Drivers"
date: 2021-10-25 12:02:32
author: "Pixis"
layout: post
permalink: /write-and-bypass-kernel-edr-part-1/
disqus_identifier: 0000-0000-0000-00b5
cover: assets/uploads/2021/10/edr_banneer.png
description: "Cet article traite du fonctionnement des EDR côté noyau. Quelques notions sur l'architecture Windows vont être rappelées avant d'évoquer le fonctionnement d'un EDR côté utilisateur (User-Land), puis de descendre dans le noyau (Kernel-Land). Nous détaillerons les structures manipulées du côté noyau dans le but d'expliquer le fonctionnement d'un pilote, ou driver. Tous ces éléments nous permettront alors d'écrire notre premier driver, pour ensuite l'enrichir et le transformer en EDR avec lequel on peut communiquer depuis le User-Land. Nous finirons en écrivant un autre driver qui aura pour but de contourner les protections que nous avons mises en places."
tags:
  - Windows
  - Kernel
translation:
  - en
---

Dans cette série d'articles nous allons un peu changer de sujet (Active Directory) pour nous intéresser aux EDR. Plus particulièrement, nous allons nous intéresser au fonctionnement des EDR côté noyau. Avant de rentrer dans le vif du sujet, quelques notions sur l'architecture Windows vont être rappelées avant d'évoquer le fonctionnement d'un EDR côté utilisateur (User-Land), puis de descendre dans le noyau (Kernel-Land). Nous expliquerons alors comment ces deux mondes communiquent, puis nous détaillerons les structures manipulées du côté noyau dans le but d'expliquer le fonctionnement d'un pilote, ou _driver_. Tous ces éléments nous permettront alors d'écrire notre premier _driver_, pour ensuite l'enrichir et le transformer en EDR avec lequel on peut communiquer depuis le User-Land. Nous finirons en écrivant un autre _driver_ qui aura pour but de contourner les protections que nous avons mises en places.

Sacré programme, n'est-ce pas ? Buckle up, et c'est parti.

<!--more-->

## Préambule

Alors que je me suis enfin plongé dans ces recherches, je suis tombé sur le livre [Windows Kernel Programming](https://www.amazon.fr/Windows-Kernel-Programming-Pavel-Yosifovich/dp/1977593372) de Pavel Yosifovich. Ce livre est une vraie mine d'or, et la majorité de ce que j'ai compris (ou de ce que je pense comprendre) vient de ce livre. Cette série d'articles sera donc en grande partie basée sur les connaissances que j'ai acquises en lisant ce livre. Je remercie donc vivement l'auteur, Pavel Yosifovich, pour ce contenu d'une très grande qualité.

Je tiens également à citer ces ressources très intéressantes qui m'ont permis d'apercevoir le fonctionnement des drivers. L'excellent article [Windows Kernel Ps Callbacks Experiments](http://blog.deniable.org/posts/windows-callbacks/), l'article [Pimp my PID - get SYSTEM using Windows kernel](https://v1k1ngfr.github.io/pimp-my-pid/) de [Viking](https://twitter.com/vikingfr), ou encore [Kernel Karnage – Part 1](https://blog.nviso.eu/2021/10/21/kernel-karnage-part-1/). Chacun de ces articles m'a apporté son lot de connaissances et de compréhension.

Pour autant, et c'est un peu la raison d'être de mon blog, je veux également me prêter à l'exercice pour mettre de l'ordre dans tout ce bazar qui se bouscule dans ma tête.

## Objectifs

Cette série d'articles aura plusieurs objectifs. La méthodologie pour les atteindre va être de zoomer de plus en plus sur les parties d'un système d’exploitation qui nous intéressent pour les deux objectifs finaux, à savoir écrire un micro-EDR qui va fonctionner niveau noyau, et écrire un driver qui aura pour but de contourner cet EDR.


## Espaces utilisateur et noyau

Pour atteindre ces objectifs, nous allons alors passer par plusieurs étapes. Nous commencerons avec une vision très macro du fonctionnement d'un système d'exploitation. Cette étape peut s'appliquer à Linux et Windows, et nous permettra d'avoir la _global picture_. Nous allons tenter de comprendre les notions d'espace utilisateur, d'espace noyau (_User-Land_ et _Kernel-Land_), et les interactions entre ces deux espaces.

### Processus

Tout d'abord abordons la notion de **processus**. Un processus c'est un peu l'enveloppe d'un programme qui est en cours d'exécution. Dès qu'un programme est lancé, un processus est créé, et est propre à l'instance du programme lancé. On trouvera dans un processus un ou plusieurs **threads**, qui sont les éléments qui vont vraiment exécuter le code. Il y a également un espace d'adressage virtuel qui représente la mémoire physique (RAM) de l'ordinateur. Ainsi, si une machine a 16Go de RAM, chaque processus contiendra 16Go de RAM dite virtuelle. Du point de vue du processus, il y a bien 16Go de RAM accessible. Dans un processus, nous pouvons également trouver un jeton, ou _token_, qui est un objet représentant le contexte de sécurité dans lequel se trouve le processus (qui a lancé le processus, les droits et privilèges de ce processus, etc.), et bien entendu le programme qui est exécuté.

[![Processus](/assets/uploads/2021/10/processus_schema.png)](/assets/uploads/2021/10/processus_schema.png)

### Mémoire virtuelle

Nous avons déjà parlé de la [mémoire virtuelle](https://beta.hackndo.com/memory-allocation/#m%C3%A9moire-virtuelle) dans un précédent article, donc nous ne détaillerons pas la couche d'abstraction entre la mémoire virtuelle et la mémoire physique. Rappelons cependant que bien que tous les processus partagent la même mémoire physique, ils n'ont pour autant accès qu'à leur propre mémoire virtuelle. Du point de vue de chaque processus, l'ensemble de la mémoire lui est dédiée, et les autres processus n'existent pas. Pour que cela fonctionne, une table de pages est située entre la mémoire virtuelle de chaque processus et la mémoire physique. C'est grâce à elle que chaque processus pense avoir accès à toute la mémoire physique.

[![Virtual memory](/assets/uploads/2015/01/img_54b50ce3eda87.png)](/assets/uploads/2015/01/img_54b50ce3eda87.png)

Sauf que pour correctement fonctionner, les processus ont différents besoins comme un accès au matériel physique (clavier, souris, carte graphique), des accès à des fichiers, et ces processus ont surtout besoin d'un chef d'orchestre pour décider quel thread a le droit d'exécuter des instructions à quel moment.

Et bien le code qui régit tout ça se trouve dans un espace particulier, le noyau, ou _kernel_. C'est la couche qui gère justement tous ces besoins bas niveaux, et qui est commune à tous les processus. En effet, que ce soit notepad.exe ou sublime.exe qui essaie d'accéder en lecture et écriture à un fichier, le code correspondant restera le même. Le kernel, c'est en fait un peu comme un gros ensemble de bibliothèques que les processus peuvent (indirectement) utiliser pour ne pas avoir à réinventer la roue, et pour s'abstraire de beaucoup de complexité. On est content de pouvoir développer un programme une seule fois, quelle que soit la marque du disque dur, ou de la carte graphique, pour afficher une fenêtre. Non ?

Pour que ce partage de code soit possible, dans la mémoire virtuelle de chaque processus, il y a une zone mémoire réservée au kernel.

[![Processus kernel memory](/assets/uploads/2021/10/processus_kernel_memory.png)](/assets/uploads/2021/10/processus_kernel_memory.png)

Tout ce code est extrêmement critique puisqu'il régit le fonctionnement d'un système d'exploitation, et donc n'est pas accessible directement par les applications. 

C'est pourquoi les communications entre la zone utilisateur et la zone noyau sont très codifiées, et utilisent un principe d'appels systèmes pour interagir.


### Appels système

Le noyau propose aux applications beaucoup de fonctionnalités, un peu à la manière d'une API. Pour chacune de ces fonctionnalités, un identifiant est associé. Du côté du noyau, il y a une table qui fait la correspondance entre un numéro et la fonctionnalité associée. Cette table est appelée la SSDT (_System Service Dispatch Table_). Lorsqu'une instruction précise est envoyée par une application, appelée **syscall**, le noyau comprend qu'une action de sa part est attendue. Le noyau (ou plus exactement le _System Service Dispatcher_) va alors regarder le numéro du syscall qui a été envoyé par l'application, et va donner le relais à la fonction associée à ce numéro dans la SSDT. C'est alors au tour de la fonction côté noyau d'exécuter des actions, et de retourner une valeur à l'application.

### Conclusion

Nous avons brièvement expliqué ce qu'était un processus, et comment le code de l'exécutable associé au processus peut communiquer avec le kernel pour effectuer des actions bas niveau. Cependant, nous comprenons bien que l'exécutable ne peut pas directement exécuter du code côté noyau, et c'est tant mieux. Il ne peut que demander d'utiliser telle ou telle fonctionnalité que le noyau veut bien exposer. 

Si des processus pouvaient exécuter du code côté kernel, une petite erreur dans le code pourrait avoir des conséquences désastreuses. De la mémoire critique ou du code nécessaire au bon fonctionnement du système d'exploitation pourrait être écrasé. D'ailleurs, une erreur dans le code exécuté côté kernel entraînera quasi-systématiquement un plantage pur et simple du système d'exploitation, avec ce bel écran que nous connaissons tous, le **Blue Screen Of Death**, ou BSOD (qui n'a/est pas toujours bleu, d'ailleurs).

[![BOSD](/assets/uploads/2021/10/bsod.png)](/assets/uploads/2021/10/bsod.png)


## Les drivers

Il existe cependant beaucoup de raisons pour lesquelles il est important de pouvoir exécuter du code côté kernel. Un exemple évident concerne les constructeurs de périphériques. Pour que des applications puissent avoir accès à leurs périphériques, il est nécessaire que les constructeurs développent du code qui sera enregistré dans le noyau et qui permettra aux applications de profiter des fonctionnalités du périphérique sans pour autant connaître ou comprendre le fonctionnement physique du matériel. 

D'autres besoins peuvent exister, dont un qui nous intéresse particulièrement, c'est le besoin qu'on les EDR (_Endpoint Detection and Response_) de surveiller tout ce qu'il se passe sur le système, et de pouvoir agir si nécessaire, sans que les applications ne soient en mesure de les arrêter. Trop facile sinon.

Il existe beaucoup de moyens de surveiller et gérer les applications du côté utilisateur, et l'article [A tale of EDR bypass methods](https://s3cur3th1ssh1t.github.io/A-tale-of-EDR-bypass-methods/) de [S3cur3Th1sSh1t](https://twitter.com/ShitSecure) décrit une grande partie de ces techniques, et dresse un état de l'art des contournement existant. On comprend assez rapidement que ce qu'implémentent les EDR du côté utilisateur se contourne souvent facilement.

Cependant, il existe moins de documentation sur les techniques utilisées par les EDR côté kernel pour surveiller ce qu'il se passe sur une machine, et contourner ces mesures est moins évident que du côté espace utilisateur.

Pour pouvoir exécuter du code du côté du noyau, nous allons nous intéresser au fonctionnement d'un pilote, ou _driver_. Un _driver_ est un programme qui va, justement, être exécuté dans l'espace kernel. Lessgo.

## Structure d'un driver

Pour pouvoir écrire un driver, il faut comprendre comment celui-ci est structuré. Tout d'abord, un driver possède un point d'entrée. C'est la fonction qui va être appelée lorsque ce driver sera exécuté dans le noyau. De la même manière qu'en C, un exécutable doit avoir une fonction `main`, ou une DLL doit avoir `DLLMain`, un driver doit avoir une fonction `DriverEntry`. Cette fonction doit renvoyer un numéro indiquant si tout s'est bien passé ou non. Ce numéro est de type `NTSTATUS`. Cette fonction prend également deux arguments, le premier est un pointeur vers un objet driver `DriverObject`, et le deuxième une chaîne de caractères `RegistryPath`.


```c
#include <ntddk.h>

NTSTATUS DriverEntry(_In_ PDRIVER_OBJECT DriverObject, _In_ PUNICODE_STRING RegistryPath) {
    return STATUS_SUCCESS;
}
```

L'objet driver `DriverObject` est en fait une structure qui est en partie initialisée par le noyau avant d'appeler le driver en question. C'est une structure que le driver lui-même va compléter, et qui va notamment servir à indiquer quelles sont les fonctionnalités offertes par ce driver et où se trouvent les fonctions associées à ces fonctionnalités.

Cet objet doit être également complété en indiquant où se trouve la fonction qui sera appelée quand le driver sera supprimé (_Unload_). Cette fonction est super importante puisqu'elle permettra de nettoyer tout ce qui doit l'être lorsque le driver est arrêté. Autant quand un processus utilisateur est arrêté, le noyau peut nettoyer derrière lui et éviter les fuites mémoire, autant quand c'est dans le noyau qu'on a des fuites mémoire, elles seront là jusqu'au prochain redémarrage. C'est donc important de correctement gérer sa mémoire, et de la libérer dans sa fonction d'unload.

Pour déclarer où se trouve la fonction d'unload, il suffit de l'indiquer dans la structure DriverObject reçue en paramètre de DriverEntry.

```c
#include <ntddk.h>


void EDRUnload(_In_ PDRIVER_OBJECT DriverObject) {
}


NTSTATUS DriverEntry(_In_ PDRIVER_OBJECT DriverObject, _In_ PUNICODE_STRING RegistryPath) {
    /* On indique que la fonction EDRUnload est la fonction à appeler lorsque le driver est arrêté */
    DriverObject->DriverUnload = EDRUnload;
    return STATUS_SUCCESS;
}

```

Simple n'est-ce pas ? Dès qu'on allouera des ressources, il faudra penser à les libérer, potentiellement dans cette nouvelle fonction `EDRUnload` que nous venons de définir.

Outre la gestion de l'arrêt du driver, des fonctionnalités peuvent être définies par l'objet DriverObject. Il y a par exemple le fait qu'une application puisse effectuer des opérations de lecture avec ce driver. C'est par exemple ce que fait Process Explorer quand il ne fait que lire les processus en cours d'exécution. Ce sont des informations collectées par le driver, et renvoyées à l'application. Il existe également des opérations d'écriture, ou des actions plus génériques que nous verrons plus tard.

Ces fonctionnalités s'appellent des _Dispatch Routines_. C'est un tableau de pointeurs de fonctions dont les index sont [décris sur le site de Microsoft](https://docs.microsoft.com/en-us/windows-hardware/drivers/ifs/ifs-reference). Nous parlions de fonctionnalité de lecture, correspondant à l'index [IRP_MJ_READ](https://docs.microsoft.com/en-us/windows-hardware/drivers/ifs/irp-mj-read), ou écriture [IRP_MJ_WRITE](https://docs.microsoft.com/en-us/windows-hardware/drivers/ifs/irp-mj-write), mais il y en a d'autres. Voici un tableau permettant d'avoir un aperçu des plus communes.

| Index                  | Description
|:-----------------------|:--------------------------------------|
| IRP_MJ_CREATE          | Opération de création ou d'ouverture  |
| IRP_MJ_CLOSE           | Opération de fermeture                |
| IRP_MJ_READ            | Opération de lecture                  |
| IRP_MJ_WRITE           | Opération d'écriture                  |
| IRP_MJ_DEVICE_CONTROL  | Appels de codes de contrôle           |

Ce tableau se situe dans le membre `MajorFunction` de l'objet driver. Ainsi, si nous souhaitons pouvoir interagir avec le driver depuis une application utilisateur, il faudra à minima implémenter la fonction associée à `IRP_MJ_CREATE` pour ouvrir le driver, `IRP_MJ_CLOSE` pour le fermer, et `IRP_MJ_READ`, `IRP_MJ_WRITE` et/ou `IRP_MJ_DEVICE_CONTROL`. Nous verrons un peu plus tard à quoi correspondent ces codes de contrôle. Commençons par les deux premières permettant d'accéder au driver.

```c
#include <ntddk.h>

void EDRUnload(_In_ PDRIVER_OBJECT DriverObject);
NTSTATUS EDRCreateClose(_In_ PDEVICE_OBJECT DeviceObject, _In_ PIRP Irp);

NTSTATUS DriverEntry(_In_ PDRIVER_OBJECT DriverObject, _In_ PUNICODE_STRING RegistryPath) {
    /* On indique que la fonction EDRUnload est la fonction à appeler lorsque le driver est arrêté */
    DriverObject->DriverUnload = EDRUnload;

    /* Déclaration des méthodes appelées lors d'une demande d'ouverture et de fermeture du driver */
    DriverObject->MajorFunction[IRP_MJ_CREATE] = EDRCreateClose;
    DriverObject->MajorFunction[IRP_MJ_CLOSE] = EDRCreateClose;
    return STATUS_SUCCESS;
}

void EDRUnload(_In_ PDRIVER_OBJECT DriverObject) {

}

NTSTATUS EDRCreateClose(_In_ PDEVICE_OBJECT DeviceObject, _In_ PIRP Irp) {
    /* Des actions sont à prendre ici pour valider l'ouverture ou la fermeture du driver */
    return STATUS_SUCCESS;
}
```

Vous pouvez constater que la même fonction a été utilisée pour les deux opérations. En effet, dans la plupart des cas, cette fonction permet seulement de valider l'ouverture ou la fermeture du driver, et on n'a pas besoin d'y ajouter plus de logique. Des tests pourraient être faits pour s'assurer que c'est tel ou tel utilisateur qui effectue cette ouverture, mais pour simplifier nous utiliserons cette fonction commune pour toujours valider les demandes.

Nous pouvons ensuite ajouter une fonction associée à `IRP_MJ_DEVICE_CONTROL`. Cette fonctionnalité est très pratique puisqu'elle permet au client applicatif et au driver de communiquer au travers de codes de contrôle. Pour simplifier, le client peut envoyer un code `LIST`, `ADD`, ou `CLEAN` par exemple, et du côté du driver, il y aura une condition qui testera ce code de contrôle. En fonction de sa valeur, telle ou telle action sera prise.

Pour déclarer cette fonction, pas de surprise.

```c
#include <ntddk.h>

void EDRUnload(_In_ PDRIVER_OBJECT DriverObject);
NTSTATUS EDRCreateClose(_In_ PDEVICE_OBJECT DeviceObject, _In_ PIRP Irp);
NTSTATUS EDRDeviceControl(_In_ PDEVICE_OBJECT DeviceObject, _In_ PIRP Irp);

NTSTATUS DriverEntry(_In_ PDRIVER_OBJECT DriverObject, _In_ PUNICODE_STRING RegistryPath) {
    /* Déclaration de la méthode appelée lors de la fermeture du driver */
    DriverObject->DriverUnload = EDRUnload;

    /* Déclaration des méthodes appelées lors d'une demande d'ouverture et de fermeture du driver */
    DriverObject->MajorFunction[IRP_MJ_CREATE] = EDRCreateClose;
    DriverObject->MajorFunction[IRP_MJ_CLOSE] = EDRCreateClose;

    /* Déclaration de la méthode qui gérera les codes de contrôle */
    DriverObject->MajorFunction[IRP_MJ_DEVICE_CONTROL] = EDRDeviceControl;
    return STATUS_SUCCESS;
}

void EDRUnload(_In_ PDRIVER_OBJECT DriverObject) {

}

NTSTATUS EDRCreateClose(_In_ PDEVICE_OBJECT DeviceObject, _In_ PIRP Irp) {
    /* Des actions sont à prendre ici pour valider l'ouverture ou la fermeture du driver */
    return STATUS_SUCCESS;
}

NTSTATUS EDRDeviceControl(_In_ PDEVICE_OBJECT DeviceObject, _In_ PIRP Irp) {
    /* Une logique peut être implémentée ici pour traiter des requêtes d'applications */
    return STATUS_SUCCESS;
}
```

Nous avançons sur la structure d'un driver, mais ça serait pas mal de le compiler et de le tester, n'est-ce pas ?

En l'état, ça ne fonctionnera pas, et en plus, rien ne sera visible. Donc avant de passer à une première compilation, ajoutons quelques informations de debug avec la fonction `KdPrint` (une macro, pour être plus exact). Cette fonction s'utilise de la manière suivante :

```c
KdPrint(("Voici un message !\n"));
```

On notera le double jeu de parenthèses, du fait que ce soit une macro et non une fonction.

En utilisant l'utilitaire [DbgView](https://docs.microsoft.com/en-us/sysinternals/downloads/debugview) de la suite [Sysinternals](https://docs.microsoft.com/en-us/sysinternals/), nous pourrons lire les messages de debug que nous aurons placé dans notre code.

## Première compilation

Pour pouvoir compiler ce projet, il faut installer Visual Studio, le SDK Windows 10 (avec les outils de débogage), et le **Windows 10 Driver Kit**, à installer en dernier pour qu'il installe correctement l'extension dans Visual Studio. Il y a peut-être d'autres manières de le faire, mais personnellement dans cet ordre ça a bien marché.

Il convient alors de créer un projet Visual Studio de type **Empty WDM Driver**.

[![WDM Project creation](/assets/uploads/2021/10/project_wdm.png)](/assets/uploads/2021/10/project_wdm.png)


Un fichier **EDR.inf** a été généré lors de la création de ce projet, mais nous n'en avons pas besoin donc nous pouvons le supprimer.

[![Remove .inf file](/assets/uploads/2021/10/project_remove_inf.png)](/assets/uploads/2021/10/project_remove_inf.png)

Ensuite, vous pouvez créer un fichier source, par exemple **Edr.cpp** dans le dossier **Sources**.

[![Source file creation](/assets/uploads/2021/10/project_add_class.png)](/assets/uploads/2021/10/project_add_class.png)

Vous pourrez alors copier le squelette de driver que nous avons créé jusqu'ici. Notez cependant que le projet ne compilera pas dans cet état. En effet, lorsqu'on compile un driver, le compilateur renverra des erreurs lorsque certains avertissements sont rencontrés. Un exemple d'avertissement considéré comme une erreur est celui indiquant qu'une variable n'est pas utilisée. Pour éviter cette erreur, la macro `UNREFERENCED_PARAMETER` peut être utilisée pour indiquer qu'on sait que ce paramètre existe, mais qu'on ne va pas l'utiliser.

Par ailleurs, la fonction `DriverEntry` doit être exportée lors de la compilation sans que son nom ne soit modifié. Or C++ permet la surcharge de méthodes, et renomme les méthodes avec différentes informations pour gérer ces surcharges. Pour éviter ce comportement, l'instruction `extern "C"` doit être ajoutée juste avant la fonction `DriverEntry`.

Enfin, ajoutons quelques informations de debug avec la fonction `KdPrint`.


```c
#include <ntddk.h>

void EDRUnload(_In_ PDRIVER_OBJECT DriverObject);
NTSTATUS EDRCreateClose(_In_ PDEVICE_OBJECT DeviceObject, _In_ PIRP Irp);
NTSTATUS EDRDeviceControl(_In_ PDEVICE_OBJECT DeviceObject, _In_ PIRP Irp);

extern "C"
NTSTATUS DriverEntry(_In_ PDRIVER_OBJECT DriverObject, _In_ PUNICODE_STRING RegistryPath) {
    UNREFERENCED_PARAMETER(RegistryPath);

    KdPrint(("Le driver a été démarré\n"));

    /* Déclaration de la méthode appelée lors de la fermeture du driver */
    DriverObject->DriverUnload = EDRUnload;

    /* Déclaration des méthodes appelées lors d'une demande d'ouverture et de fermeture du driver */
    DriverObject->MajorFunction[IRP_MJ_CREATE] = EDRCreateClose;
    DriverObject->MajorFunction[IRP_MJ_CLOSE] = EDRCreateClose;
    DriverObject->MajorFunction[IRP_MJ_DEVICE_CONTROL] = EDRDeviceControl;

    KdPrint(("Le driver a été correctement initialisé\n"));
    return STATUS_SUCCESS;
}

void EDRUnload(_In_ PDRIVER_OBJECT DriverObject) {
    UNREFERENCED_PARAMETER(DriverObject);
    KdPrint(("Le driver a été arrêté\n"));
}

NTSTATUS EDRCreateClose(_In_ PDEVICE_OBJECT DeviceObject, _In_ PIRP Irp) {
    UNREFERENCED_PARAMETER(DeviceObject);
    UNREFERENCED_PARAMETER(Irp);

    KdPrint(("Le driver a été ouvert ou fermé\n"));
    /* Des actions sont à prendre ici pour valider l'ouverture ou la fermeture du driver */
    return STATUS_SUCCESS;
}

NTSTATUS EDRDeviceControl(_In_ PDEVICE_OBJECT DeviceObject, _In_ PIRP Irp) {
    UNREFERENCED_PARAMETER(DeviceObject);
    UNREFERENCED_PARAMETER(Irp);

    KdPrint(("Un code de contrôle a été envoyé au driver\n"));
    /* Une logique peut être implémentée ici pour traiter des requêtes d'applications */
    return STATUS_SUCCESS;
}
```

Une dernière petite étape avant de pouvoir compiler le driver, il faut désactiver une protection de compilation contre [certaines attaques](/meltdown-spectre/). C'est mieux d'avoir les éléments qui permettent de faire les vérifications, mais pour nos besoins de tests, on se contentera de désactiver l'option.

[![Disable Spectre](/assets/uploads/2021/10/project_spectre_disable.png)](/assets/uploads/2021/10/project_spectre_disable.png)

Maintenant, le driver peut être compilé ! Cette compilation produit notamment un fichier **EDR.sys**, qui est le driver que nous pourrons charger. Il ne fait rien, mais c'est quand même déjà beaucoup.

[![Compilation](/assets/uploads/2021/10/project_first_compilation.png)](/assets/uploads/2021/10/project_first_compilation.png)

## Chargement du driver

Nous avons donc compilé notre premier driver, **EDR.sys**. Malheureusement (ou heureusement) nous ne pouvons pas le charger directement dans notre kernel. Les versions récentes de Windows demandent plusieurs prérequis pour accepter de charger un driver, notamment qu'il soit signé par une autorité de certification reconnue par Microsoft, et signé par Microsoft lui même ! Est-ce qu'on s'arrête là alors ? 

Comme nous sommes en phase de recherche et d'apprentissage, il existe une solution pour tout de même charger notre driver. Pour cela, je vous conseille **extrêmement fortement** de faire vos tests dans une machine virtuelle, ou du moins une machine de tests. Pour rappel, si votre driver plante, ça fait planter la machine. Pas de demi mesure (_moi j'te mesure à ton usure au demi_ - Svinkels).

Une fois que votre machine de tests est lancée, vous pouvez la mettre en mode développement, c'est à dire qu'elle acceptera de charger des drivers non signés. Pour cela, il suffit de lancer dans une console en tant qu'administrateur la commande suivante :

```bash
bcdedit /set testsigning on
```

Après un redémarrage, votre machine est prête à installer votre driver, on y arrive ! Je vous conseille également de télécharger l'utilitaire [DbgView](https://docs.microsoft.com/en-us/sysinternals/downloads/debugview) de la suite [Sysinternals](https://docs.microsoft.com/en-us/sysinternals/) dont on a parlé tout à l'heure, car il vous permettra de voir les messages envoyés par vos fonctions `KdPrint`.

[![Dbgview](/assets/uploads/2021/10/dbgview_opened.png)](/assets/uploads/2021/10/dbgview_opened.png)

Ensuite, pour enregistrer votre driver, la commande `sc.exe` peut être utiliser de la manière suivante :

```cmd
sc.exe create EDR type= kernel binPath= C:\chemin\vers\EDR.sys
```

Notez les espaces après les signes `=`, ils sont importants pour la ligne de commande, ne les supprimez pas.

Une fois le driver enregistré, il peut être lancé, à l'aide de la commande `start` de `sc.exe`

```cmd
sc.exe start EDR
```

[![Driver executed](/assets/uploads/2021/10/driver_started.png)](/assets/uploads/2021/10/driver_started.png)

Les messages de debug doivent alors apparaître dans la console de **Dbgview**.

[![Driver messages](/assets/uploads/2021/10/dbgview_messages.png)](/assets/uploads/2021/10/dbgview_messages.png)

Nous sommes donc bien rentrés dans la routine `DriverEntry` et nos méthodes se sont correctement enregistrées. Aucune de ces méthodes enregistrées n'a cependant été appelée, et c'est normal. En revanche, si nous arrêtons le driver, alors la méthode `EDRUnload` va l'être.

```cmd
sc.exe stop EDR
```

[![Driver executed](/assets/uploads/2021/10/dbgview_stoped.png)](/assets/uploads/2021/10/dbgview_stoped.png)

Tout s'est correctement déroulé, félicitations, vous avez développé, lancé et arrêté votre premier driver sous Windows !

## Conclusion

Dans cette première partie, nous avons vu ce qu'était l'espace utilisateur et l'espace noyau, ou kernel, et nous avons défini quelques termes importants pour le reste de cette série. Tandis que le fonctionnement d'un EDR côté utilisateur a été extrêmement bien décrit dans [un article de S3cur3th1ssh1t](https://s3cur3th1ssh1t.github.io/A-tale-of-EDR-bypass-methods/), nous avons pointé du doigt en quoi l'exécution de code côté kernel pouvait être un gros avantage pour les EDR.

Nous avons alors décrit ce qu'était un driver, et détaillé la structure de base qui permet à un driver d'être compilé et chargé. Nous partirons de ce squelette dans les prochaines parties pour mettre en pratique des fonctionnalités proposées par le kernel pour surveiller voire modifier le comportement des applications côté utilisateur. Cette même structure pourra être utilisée dans la troisième partie qui décrira comment écrire un driver permettant de contourner, ou supprimer ces protections.

Je vous donne donc rendez-vous pour la partie 2 de cette série !