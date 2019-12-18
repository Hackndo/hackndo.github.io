---
title: "Pass the Hash"
date: 2019-12-17 23:01:21
author: "Pixis"
layout: post
permalink: /pass-the-hash/
disqus_identifier: 0000-0000-0000-00b1
cover: assets/uploads/2019/09/pass_the_hash.png
description: "La technique du Pass the Hash est extrêmement utilisée lors de mouvement latéral, composante essentielle dans une attaque. Nous allons détailler comment cette technique fonctionne, quelles sont ses possibilités et ses limites."
tags:
  - "Active Directory"
  - Windows
---

Durant les tests d'intrusion internes, le mouvement latéral est une composante essentielle pour l'auditeur afin de chercher des informations en vue d'élever ses privilèges sur le système d'information. La technique dite du **Pass the Hash** est extrêmement utilisée dans cette situation pour devenir administrateur sur un ensemble de machines. Nous allons détailler ici le fonctionnement de cette technique.

<!--more-->

## Protocole NTLM

Le protocole NTLM est un protocole d'authentification utilisé dans les environnement Microsoft. Il permet notamment à un utilisateur de prouver qui il est auprès d'un serveur pour pouvoir utiliser un service proposé par ce serveur.

> Note : Dans cet article, le terme "serveur" est employé dans le sens client/serveur. Le "serveur" peut très bien être un poste de travail.

[![NTLM](/assets/uploads/2019/09/NTLM_Basic.png)](/assets/uploads/2019/09/NTLM_Basic.png)

Deux cas de figure peuvent se présenter :

* Soit l'utilisateur utilise les identifiants d'un compte local du serveur, auquel cas le serveur possède le secret de l'utilisateur dans sa base locale et il pourra authentifier l'utilisateur;
* Soit, dans un environnement Active Directory, l'utilisateur utilise un compte de domaine lors de l'authentification, et le serveur devra alors dialoguer avec le contrôleur de domaine pour vérifier les informations fournies par l'utilisateur.

Dans les deux cas, l'authentification commence par une phase de **challenge/réponse** (ou stimulation/réponse) entre le client et le serveur.

### Challenge - Réponse

Le principe du challenge/réponse est utilisé pour que le serveur vérifie que l'utilisateur connaisse le secret du compte avec lequel il s'authentifie, sans pour autant faire transiter le mot de passe sur le réseau. Trois étapes composent cet échange :

1. **Négotiation** : Le client indique au serveur qu'il veut s'authentifier auprès de lui ([NEGOTIATE_MESSAGE](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/b34032e5-3aae-4bc6-84c3-c6d80eadf7f2)).
2. **Challenge** : Le serveur envoie un challenge au client. Ce n'est rien d'autre qu'une valeur aléatoire de 64 bits qui change à chaque demande d'authentification ([CHALLENGE_MESSAGE](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/801a4681-8809-4be9-ab0d-61dcfe762786)).
3. **Réponse** : Le client chiffre le challenge précédemment reçu en utilisant une version hashée de son mot de passe comme clé, et renvoie cette version chiffrée au serveur, avec son nom d'utilisateur et éventuellement son domaine ([AUTHENTICATE_MESSAGE](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/033d32cc-88f9-4483-9bf2-b273055038ce)).

[![NTLM Challenge Response](/assets/uploads/2019/09/NTLM_Challenge_Response.png)](/assets/uploads/2019/09/NTLM_Challenge_Response.png)

Voici une capture d'écran de mon lab. On voit que l'utilisateur **Administrateur** tente de se connecter sur la machine **LKAPP01.lion.king**

[![NTLM Challenge Response](/assets/uploads/2019/11/ntlm_authentication_ws.png)](/assets/uploads/2019/11/ntlm_authentication_ws.png)

Les échanges NTLM sont encadrés en rouge en haut, et dans la partie basse se trouvent les informations contenues dans la réponse du serveur `CHALLENGE_MESSAGE`. On y trouve notamment le challenge.

Suite à ces échanges, le serveur est en possession de deux choses :

1. Le challenge qu'il a envoyé au client
2. La réponse du client qui a été chiffrée avec son secret

Pour finaliser l'authentification, il ne reste plus au serveur qu'à vérifier la validité de la réponse envoyée par le client. Mais juste avant ça, faisons un petit point sur le secret du client.

### Secret d'authentification

Nous avons dit que le client utilise comme clé une version hashée de son mot de passe, et ce pour la raison suivante : Eviter de stocker les mots de passe des utilisateurs en clair sur le serveur. C'est donc un condensat du mot de passe qui est enregistré à la place. Ce condensat est aujourd'hui le **hash NT**, qui n'est rien d'autre que le résultat de la fonction [MD4](https://fr.wikipedia.org/wiki/MD4), sans sel, rien.

```
hashNT = MD4(password)
```

Donc pour résumer, lorsque le client s'authentifie, il utilise l'emprunte MD4 de son mot de passe pour chiffrer le challenge. Voyons alors ce qu'il se passe du côté du serveur, une fois cette réponse reçue.

## Authentification

Comme expliqué tout à l'heure, il existe deux scénarios différents. Le premier est que le compte utilisé pour l'authentification est un compte local, c'est à dire que le serveur a connaissance de ce compte, et il a une copie du secret du compte. Le deuxième est qu'un compte de domaine est utilisé, auquel cas le serveur n'a pas connaissance de ce compte ou son secret. Il devra déléguer l'authentification au contrôleur de domaine.

### Compte local

Dans le cas où l'authentification se fait avec un compte local, le serveur va chiffrer le challenge qu'il a envoyé au client avec la clé secrète de l'utilisateur, ou plutôt avec le hash MD4 du secret de l'utilisateur. Il vérifiera ainsi si le résultat de son opération est égal à la réponse du client, prouvant que l'utilisateur possède le bon secret. Le cas contraire, la clé utilisée par l'utilisateur n'est pas la bonne puisque le chiffrement du challenge ne donne pas celui attendu.

Pour pouvoir effectuer cette opération, le serveur a besoin de stocker les utilisateurs locaux et le condensat de leur secret. Le nom de cette base de donnée est la **SAM** (Security Accounts Manager). La SAM peut être trouvée dans la base de registre, notamment avec l'outil `regedit` mais uniquement lorsqu'on y accède en tant que **SYSTEM**. On peut l'ouvrir en tant que **SYSTEM** avec psexec :

```
psexec.exe -i -s regedit.exe
```

[![SAM in registry](/assets/uploads/2019/11/SAM_registry.png)](/assets/uploads/2019/11/SAM_registry.png)

Une copie se trouve également sur disque à l'emplacement `C:\Windows\System32\SAM`.

Elle contient donc les utilisateurs locaux et le condensat de leur mot de passe, mais aussi la liste des groupes locaux.

Donc pour résumer, voici le processus de vérification.

[![SAM verification](/assets/uploads/2019/11/SAM_verification.png)](/assets/uploads/2019/11/SAM_verification.png)

Comme le serveur envoie un challenge (**1**) et que le client chiffre ce challenge avec le hash de son secret puis le renvoie au serveur, avec son nom d'utilisateur (**2**), le serveur va chercher le hash du mot de passe de l'utilisateur dans sa base SAM (**3**). Une fois en possession de ce condensat, il va lui aussi chiffrer le challenge précédemment envoyé avec ce hash (**4**), et il pourra ainsi confronter son résultat à celui renvoyé par l'utilisateur. Si c'est le même (**5**) alors l'utilisateur est bien authentifié ! Le cas contraire, l'utilisateur n'a pas fourni le bon secret.

### Compte de domaine

Dans le cas où l'authentification se fait avec un compte du domaine, le hash NT de l'utilisateur n'est plus stocké sur le serveur, mais sur le contrôleur de domaine. Le serveur auprès duquel veut s'authentifier l'utilisateur reçoit alors la réponse à son challenge, mais il n'est pas en mesure de vérifier si cette réponse est valide. Il va déléguer cette tâche au contrôleur de domaine.

Pour cela, il va utiliser le service **Netlogon**, service qui est capable d'établir une connexion sécurisée avec le contrôleur de domaine. Cette connexion sécurisée s'appelle **Secure Channel**. Elle est possible puisque le serveur possède son propre mot de passe, et le contrôleur de domaine connait le hash de ce mot de passe. Ils peuvent alors, de la même manière, effectuer un challenge/réponse pour s'échanger une clé de session et communiquer de manière sécurisée.

Je ne vais pas rentrer dans les détails, mais l'idée est donc que le serveur va envoyer différents éléments au contrôleur de domaine dans une structure appelée [NETLOGON_NETWORK_INFO](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nrpc/e17b03b8-c1d2-43a1-98db-cf8d05b9c6a8):

* Le nom d'utilisateur du client (Identity)
* Le challenge envoyé précédemment au client (LmChallenge)
* La réponse au challenge envoyée par le client (NtChallengeResponse)

> Je ne parle pas de LmChallengeResponse puisque dans cet article, je m'intéresse seulement au hash NT, pas au hash LM qui est complètement obsolète.

Le contrôleur de domaine va chercher le hash NT de l'utilisateur dans sa base de données. Pour le contrôleur de domaine, ce n'est pas dans la SAM, puisque c'est un compte du domaine qui s'authentifie. Cette fois-ci c'est dans un fichier appelé **NTDS.DIT**, qui est la base de données de tous les utilisateurs. Une fois le hash NT récupéré, il va calculer la réponse attendue avec ce hash et le challenge, et va confronter ce résultat à la réponse du client.

Un message sera ensuite envoyé au serveur ([NETLOGON_VALIDATION_SAM_INFO4](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nrpc/bccfdba9-0c38-485e-b751-d4de1935781d)) indiquant si oui ou non le client est authentifié, et il enverra également tout un tas d'informations concernant l'utilisateur. Ce sont d'ailleurs les mêmes informations que celles qu'on retrouve dans le [PAC](https://beta.hackndo.com/kerberos-silver-golden-tickets/#pac) lors d'une [authentification Kerberos](https://beta.hackndo.com/kerberos/).

Donc pour résumer, voici le processus de vérification avec un contrôleur de domaine.

[![SAM verification](/assets/uploads/2019/11/DC_verification.png)](/assets/uploads/2019/11/DC_verification.png)

De la même manière que tout à l'heure, le serveur envoie un challenge (**1**) et le client chiffre ce challenge avec le hash de son secret puis le renvoie au serveur, accompagné de son nom d'utilisateur et le nom du domaine (**2**). Cette fois-ci, le serveur va envoyer ces informations au contrôleur de domaine dans un **Secure Channel** à l'aide du service **Netlogon** (**3**). Une fois en possession de ces informations, le contrôleur de domaine va lui aussi chiffrer le challenge en utilisant le hash de l'utilisateur, trouvé dans sa base de données (**4**), et il pourra ainsi confronter son résultat à celui renvoyé par l'utilisateur. Si c'est le même (**5**) alors l'utilisateur est bien authentifié. Le cas contraire, l'utilisateur n'a pas fourni le bon secret. Dans les deux cas, le contrôleur de domaine transmet l'information au serveur (**6**).

## Limites du hash NT

Si vous avez bien suivi, vous aurez compris qu'en fait, le mot de passe en clair n'est jamais utilisé dans ces échanges, mais bien la version hashée du mot de passe, appelé hash NT. Ce hash est un condensat simple du mot de passe en clair.

Donc en fait, si on y réfléchit bien, **voler le mot de passe en clair ou voler le hash revient exactement au même**. Comme c'est le hash qui est utilisé pour répondre au challenge/réponse, être en possession du hash permet de s'authentifier auprès d'un serveur. Avoir le mot de passe en clair n'est absolument pas utile. 

Finalement, on peut même dire qu'**avoir le hash NT revient à avoir le mot de passe en clair**, dans la majorité des cas.

## Pass the Hash

On comprend donc bien que si un attaquant connait le hash NT d'un administrateur local d'une machine, il peut tout à fait s'authentifier auprès de cette machine en utilisant ce condensat. De la même manière, s'il possède le hash NT d'un utilisateur de domaine qui fait partie d'un groupe d'administration local d'une machine, il peut également s'authentifier auprès de cette machine en tant qu'administrateur local.

### Administrateur local du parc

Maintenant, plaçons nous dans un environnement d'entreprise : Un nouveau collaborateur arrive, et un poste lui est fourni. Le département informatique ne s'amuse pas à installer et configurer depuis zéro un système Windows pour chaque collaborateur. Non, l'informaticien est paresseux, et s'il peut automatiser, il automatise.

Ce qui est très courant est le scénario suivant : Une version du système Windows est installée et configurée pour répondre à tous les besoins de base d'un nouveau collaborateur. Cette version de base appelée **master** est enregistrée dans un coin, et une copie de cette version est fournie à chaque nouvel arrivant.

Cela implique que le compte administrateur local **est le même** sur tous les postes qui ont bénéficié du même **master**.

Vous voyez où je veux en venir ? Si jamais un seul de ces postes est compromis et que l'attaquant extrait le hash NT de l'administrateur du poste, comme tous les autres postes ont le même compte d'admin avec le même mot de passe, et bien ils auront également le même hash NT. L'attaquant peut alors utiliser le hash trouvé sur le poste compromis et le rejouer sur tous les autres postes pour s'authentifier dessus.

C'est ce qu'on appelle passer le hash, ou plus communément la technique du **Pass the hash**.

[![Pass the hash](/assets/uploads/2019/11/pass-the-hash-schema.png)](/assets/uploads/2019/11/pass-the-hash-schema.png)

Prenons un exemple, nous avons trouvé que le hash NT de l'utilisateur `Administrateur` est `20cc650a5ac276a1cfc22fbc23beada1`. Nous pouvons le rejouer sur une autre machine en espérant que cette machine ait été configurée de la même manière.

[![PTH Local](/assets/uploads/2019/11/pass-the-hash-local.png)](/assets/uploads/2019/11/pass-the-hash-local.png)

Bingo, ce hash fonctionne également sur la nouvelle machine, et nous avons la main dessus.

### Compte de domaine à privilèges

Il existe une autre manière d'utiliser la technique du **Pass the hash**. Imaginons que pour l'administration du parc à distance, il existe un groupe "HelpDesk" dans l'Active Directory. Pour que les membres de ce groupe puissent intervenir sur les machines des utilisateurs, le groupe est ajouté au groupe local "Administrateurs" de chaque machine. Ce groupe local contient les entités ayant les droits d'administration sur la machine.

On peut d'ailleurs les lister avec la commande suivante

```bash
# Machine française
net localgroup Administrateurs

# ~Reste du monde
net localgroup Administrators
```

On obtiendra alors un résultat comme celui-ci :

```
Nom alias       Administrateur
Commentaire     Les membres du groupe Administrateurs disposent d'un accès complet et illimité à l'ordinateur et au domaine

Membres

-------------------------
Administrateur
ADSEC\Admins du domaine
ADSEC\HelpDesk
```

Nous avons donc le groupe du domaine `ADSEC\HelpDesk` qui fait partie des administrateurs de la machine. Si jamais un attaquant vole le hash NT d'un des membres de ce groupe, il peut tout à fait demander à s'authentifier sur les machines ayant `ADSEC\HelpDesk` dans la liste des administrateurs.

L'avantage par rapport au compte local, c'est que quelque soit le master utilisé pour mettre en place les machines, le groupe sera ajouté par [GPO](/gpo-abuse-with-edit-settings/#group-policy-object) à la configuration de la machine. Les chances sont plus grandes pour que ce compte ait des droits d'administration plus étendus, indépendamment des OS et des mises en service des machines.

Lors de la demande d'authentification, le serveur va donc déléguer l'authentification au contrôleur de domaine, et si l'authentification réussit, alors le contrôleur de domaine va envoyer au serveur des informations sur l'utilisateur telles que son nom, **la liste des groupes auxquels il appartient**, la date d'expiration de son mot de passe etc.

Le serveur va donc savoir que l'utilisateur fait partie du groupe **HelpDesk**, et lui donnera un accès administrateur.

Prenons un nouvel exemple, nous avons trouvé que le hash NT de l'utilisateur `jsnow` est `89db9cd74150fc8d8559c3c19768ca3f`. Ce compte fait partie du groupe `HelpDesk` qui est administrateur local de toutes les machines du parc. Rejouons alors son hash sur une autre machine.

[![PTH Domain](/assets/uploads/2019/11/pass-the-hash-domain.png)](/assets/uploads/2019/11/pass-the-hash-domain.png)

De la même manière, l'authentification a fonctionné et nous sommes administrateur de la cible.

## Automatisation

Maintenant que nous avons compris le fonctionnement de l'authentification NTLM, et pourquoi un hash NT pouvait être utilisé pour s'authentifier auprès d'autres machines, il serait utile de pouvoir automatiser la connexion sur les différentes cibles pour récupérer autant d'informations que possible en parallélisant les tâches.

Pour cela, l'outil [CrackMapExec](https://github.com/byt3bl33d3r/CrackMapExec) est idéal. Il prend en entrée une liste de machines cibles, des identifiants, avec un mot de passe en clair ou un hash NT, et il peut exécuter des commandes sur les cibles pour lesquelles l'authentification a fonctionné.

```bash
# Compte local d'administration
crackmapexec smb --local-auth -u Administrateur -H 20cc650a5ac276a1cfc22fbc23beada1 10.10.0.1 -x whoami

# Compte de domaine
crackmapexec smb -u jsnow -H 89db9cd74150fc8d8559c3c19768ca3f -d adsec.local  10.10.0.1 -x whoami
```

Voici un exemple dans lequel l'utilisateur `simba` est administrateur de tous les postes de travail.

[![SAM verification](/assets/uploads/2019/11/crackmapexec.png)](/assets/uploads/2019/11/crackmapexec.png)

Le Pass the hash a été effectué sur quelques machines qui sont alors compromises. Un argument a été passé à CrackMapExec pour énumérer les utilisateurs actuellement connectés sur ces machines.

Avoir la liste des utilisateurs connectés, c'est bien, mais avoir leur mot de passe ou leur hash NT (ce qui est pareil), c'est mieux ! Pour ça, j'ai développé l'outil [lsassy](https://github.com/hackndo/lsassy) dont je parle dans l'article [Extraction des secrets de lsass à distance](/remote-lsass-dump-passwords/#nouveaux-outils). Et en pratique, et bien ça donne ça :

[![Lsassy verification](/assets/uploads/2019/11/crackmapexec_lsassy.png)](/assets/uploads/2019/11/crackmapexec_lsassy.png)

Nous récupérons tous les hash NT des utilisateurs connectés. Ceux des comptes machine ne sont pas affichés puisque nous sommes déjà administrateur de ces machines, ils ne nous sont donc pas utiles.

## Conclusion

L'authentification NTLM est aujourd'hui encore beaucoup utilisée en entreprise. D'expérience, je n'ai encore jamais vu d'environnement ayant réussi à désactiver NTLM sur l'ensemble de son parc. La technique du Pass the hash reste donc très efficace.

Cette technique est inhérente au protocole NTLM, cependant il est possible de limiter les dégats en évitant d'avoir le même mot de passe d'administration locale sur tous les postes. La solution [LAPS](https://blogs.technet.microsoft.com/arnaud/2015/11/25/local-admin-password-solution-laps/) de Microsoft est une solution parmi d'autres pour gérer automatiquement les mots de passe des administrateurs en faisant en sorte que ce mot de passe (donc aussi le hash NT) soit différent sur tous les postes.

Par ailleurs, mettre en place une [administration en SILO](https://www.sstic.org/media/SSTIC2017/SSTIC-actes/administration_en_silo/SSTIC2017-Article-administration_en_silo-bordes.pdf) permet d'éviter les élévations de privilèges au sein du système d'information. Des administrateurs dédiés à des zones de criticité différentes (bueautique, serveur, contrôleurs de domaine, ...) se connectent uniquement sur leur zone, et ne peuvent pas accéder à une zone différente. Si ce type d'administration est mise en place et qu'une machine d'une zone est compromise, l'attaquant ne pourra pas utiliser les identifiants trouvés pour atteindre une autre zone.

En attendant, cette technique a encore de beaux jours devant elle !

Si vous avez des questions, n'hésitez pas à les poser ici ou sur [Discord](https://discord.gg/9At6SUZ) et je me ferai une joie de tenter d'y répondre. De la même manière, si vous voyez des coquilles, je suis tout ouïe. A la prochaine !
