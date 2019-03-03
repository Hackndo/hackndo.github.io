---
title: "AS_REP Toasting"
date: 2019-03-23 20:10:06
author: "Pixis"
layout: post
permalink: /kerberos-asrep-toasting/
disqus_identifier: 0000-0000-0000-00a8
cover: assets/uploads/2019/02/asreqroast_no_auth.png
description: "Lors d'une demande de TGT, l'utilisateur doit, par défaut, s'authentifier auprès du KDC pour que celui-ci lui réponde. Il arrive que cette authentification préalable ne soit pas demandée pour certains comptes, permettant à un attaquant d'abuser de cette configuration"
tags:
  - windows
  - reseau
  - activedirectory
---

Lors d'une demande de TGT, l'utilisateur doit, par défaut, s'authentifier auprès du KDC pour que celui-ci lui réponde. Il arrive que cette authentification préalable ne soit pas demandée pour certains comptes, permettant à un attaquant d'abuser de cette configuration.

<!--more-->

## Préambule

Lorsque nous parlons de la notion de `TGT`, c'est souvent un abus de langage, car nous parlons en fait du `KRB_AS_REP` qui contient le TGT (chiffré par le hash du KDC) et la clé de session (chiffrée avec le hash du compte utilisateur).

Ainsi, dans cet article, la notion de `TGT` fait seulement référence au `TGT` contenu dans la réponse `KRB_AS_REP`. 

## Pré-authentification

Lorsque nous avons parlé du [fonctionnement de Kerberos](https://beta.hackndo.com/kerberos), il a été mis en évidence que dans le premier échange (`KRB_AS_REQ` - `KRB_AS_REP`), le client doit d'abord s'authentifier auprès du KDC avant d'obtenir un TGT. Une partie de la réponse du KDC étant chiffrée avec le secret du compte client (la clé de session), il est important que cette information ne soit pas accessible sans authentification. Dans le cas échéant n'importe qui pourrait demander un TGT pour un compte donné, et tenter de décrypter  la partie chiffrée de la réponse `KRB_AS_REP` pour retrouver le mot de passe de l'utilisateur ciblé.

[![KRB_AS_REP](/assets/uploads/2018/05/asrep.png)](/assets/uploads/2018/05/asrep.png)

C'est pourquoi le client doit, dans sa requête `KRB_AS_REQ`, envoyer un authentifiant qu'il chiffre avec son secret afin que le KDC le déchiffre et renvoie le `KRB_AS_REP` en cas de succès. Si jamais un attaquant demande un TGT pour un compte qu'il ne contrôle pas, il ne sera pas en mesure de chiffrer l'authentifiant de la bonne façon, donc le KDC ne renverra pas les informations attendues.

[![Authentication Required](/assets/uploads/2019/02/asreqroast_auth.png)](/assets/uploads/2019/02/asreqroast_auth.png)

Ce comportement est celui par défaut, il protège les comptes contre cette attaque hors-ligne.

## KRB_AS_REP Roasting

Cependant, pour différentes raisons, il est possible de désactiver le prérequis de pré-authentification pour un ou plusieurs compte(s).

[![Preauthentication Setting](/assets/uploads/2019/02/preauthsettings.png)](/assets/uploads/2019/02/preauthsettings.png)


Ainsi, n'importe qui peut demander un TGT au nom d'un de ces comptes, sans envoyer d'authentifiant, et le KDC renverra un `KRB_AS_REP` au demandeur.

[![Authentication Required](/assets/uploads/2019/02/asreqroast_no_auth.png)](/assets/uploads/2019/02/asreqroast_no_auth.png)

Cela peut se faire avec l'outil [ASREPRoast](https://github.com/HarmJ0y/ASREPRoast) de [@Harmj0y](https://twitter.com/harmj0y).

[![ASREPRoast](/assets/uploads/2019/02/attackasrep.png)](/assets/uploads/2019/02/attackasrep.png)

Une fois en possession de la réponse du KDC `KRB_AS_REP`, l'attaquant peut tenter de trouver en mode hors-ligne le mot de passe en clair de la victime ciblée, par exemple en utilisant John The Ripper avec le format `krb5tgs`.

## Conclusion

Cette technique, décrite dans un [article](https://www.harmj0y.net/blog/activedirectory/roasting-as-reps/) de [Harmj0y](https://twitter.com/harmj0y), est un moyen parmi beaucoup de récupérer des mots de passe en clair au sein d'un environnement Active Directory. Si des comptes à privilèges sont paramétrés pour ne pas nécessiter une pré-authentification, un attaquant peut simplement requêter un TGT pour ce compte et tenter de retrouver en mode hors-ligne le mot de passe du compte. Avec des machines puissantes, la vitesse de cracking peut devenir colossale.