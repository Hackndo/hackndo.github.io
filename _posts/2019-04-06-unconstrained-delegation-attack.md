---
title: "Unconstrained Delegation - Risques"
date: 2019-04-12 11:28:42
author: "Pixis"
layout: post
permalink: /unconstrained-delegation-attack/
disqus_identifier: 0000-0000-0000-00ac
cover: assets/uploads/2019/04/unconstrained_admin.png
description: "Cet article montre comment abuser de la délégation sans contrainte (Unconstrained Delegation) afin de récupérer le TGT d'un utilisateur, permettant ainsi de s'authentifier auprès de n'importe quel service en son nom."
tags:
  - "Active Directory"
  - Windows
---

Suite à l'article sur la [délégation Kerberos](/constrained-unconstrained-delegation), nous allons maintenant voir comment abuser de la délégation sans contrainte (Unconstrained Delegation) afin de récupérer le TGT d'un utilisateur, nous permettant ainsi de nous authentifier auprès de n'importe quel service en son nom.

<!--more-->


## Rappels : Unconstrained Delegation

Comme nous l'avons vu dans l'article sur la [délégation Kerberos](/constrained-unconstrained-delegation), lorsqu'un compte possède le drapeau "Unconstrained Delegation" (`ADS_UF_TRUSTED_FOR_DELEGATION`), si les informations d'authentification de l'utilisateur faisant une demande de TGS pour un service proposé par ce compte peuvent être relayées, alors le contrôleur de domaine va répondre à l'utilisateur avec un [KRB_TGS_REQ](/kerberos/#krb_tgs_req) contenant les informations classiques telles que le TGS, mais il va également intégrer dans sa réponse **une copie du TGT** de l'utilisateur, ainsi qu'une nouvelle clé de session associée.

[![Unconstrained Delegation](/assets/uploads/2019/02/cop_tgt.png)](/assets/uploads/2019/02/cop_tgt.png)


Concrètement, le compte de service qui recevra ce TGS **aura aussi une copie du TGT de l'utilisateur**, ainsi qu'une clé de session valide pour utiliser ce TGT.

## Exploitation

Cela signifie que maintenant, avec ces informations, le service peut demander n'importe quel TGS au nom de l'utilisateur. Je répète : il peut demander **n'importe. quel. TGS. au nom de l'utilisateur**. Il peut se faire passer pour l'utilisateur pour s'authentifier auprès de n'importe quel service.

[![Unconstrained Delegation](/assets/uploads/2019/02/unconstrained_delegation_schema.png)](/assets/uploads/2019/02/unconstrained_delegation_schema.png)


Du coup, si l'utilisateur en question possède des droits d'administration pour certaines tâches, le service qui possède maintenant une copie du TGT de cet utilisateur possède également des droits d'administration pour ces tâches. Par exemple, sur ce schéma, un utilisateur est administrateur local d'un contrôleur de domaine. Cet utilisateur se connecte au serveur compromis qui est en "Unconstrained Delegation".

[![Unconstrained Delegation](/assets/uploads/2019/04/unconstrained_admin.png)](/assets/uploads/2019/04/unconstrained_admin.png)

Et bien l'attaquant possède maintenant une copie du TGT de cet utilisateur, et peut se faire passer pour lui auprès du contrôleur de domaine, donc être administrateur local de celui-ci.

Ainsi, les comptes ayant la délégation sans contrainte sont des cibles prioritaires pour les attaquants, puisqu'une fois un de ces comptes compromis, il suffit d'attendre des authentifications d'utilisateurs pour pouvoir s'authentifier n'importe où en leur nom. Si un administrateur de domaine s'authentifie auprès d'un service proposé par ce compte, alors l'attaquant a gagné, le domaine est totalement compromis.

## Par l'exemple

Nous allons ici présenter un exemple qui a été effectué dans mon lab, ADSEC. Il y a ici la machine `WEB-SERVER-01` qui est en "Unconstrained Delegation".

[![Unconstrained Delegation](/assets/uploads/2019/04/server_01_unconstrained.png)](/assets/uploads/2019/04/server_01_unconstrained.png)


Il est possible de s'authentifier auprès de cette machine pour utiliser ses partages réseau. Nous imaginons qu'un attaquant ait réussi à compromettre cette machine, et qu'il est administrateur local de cette machine.

L'attaquant doit alors attendre qu'un utilisateur à privilèges se connecte sur la machine. Il va donc monitorer les connexions et inspecter les TGS afin de voir si un TGT est présent dans l'un deux. Pour cela, il utilise l'outil [Rubeus](https://github.com/GhostPack/Rubeus) développé par [@Harmj0y](https://twitter.com/harmj0y). (D'autres outils existent tels que [kekeo](https://github.com/gentilkiwi/kekeo/) de [@gentilkiwi](https://twitter.com/gentilkiwi) par exemple.)

```
.\Rubeus monitor /interval:5
```

[![Rubeus Monitor](/assets/uploads/2019/04/wait_for_connexion.png)](/assets/uploads/2019/04/wait_for_connexion.png)

Il se trouve qu'à un moment donné, le compte `support-account`, **administrateur de domaine**, doit aller voir quelque chose sur le disque dur de `WEB-SERVER-01`. Pour cela, il se connecte au partage réseau du serveur `\\WEB-SERVER-01\c$`.

[![Connexion from DA](/assets/uploads/2019/04/connexion_from_domain_admin.png)](/assets/uploads/2019/04/connexion_from_domain_admin.png)

Cette connexion est détectée par Rubeus, puisqu'un événement [4624](https://www.ultimatewindowssecurity.com/securitylog/encyclopedia/event.aspx?eventID=4624) (Successful logon) est généré dans le journal d'événements de `WEB-SERVER-01`. Comme cette machine est en "Unconstrained Delegation", le TGS envoyé par l'administrateur de domaine contient une copie de son TGT, copie qui va être extrait par Rubeus.

[![Connexion success on Rubeus](/assets/uploads/2019/04/connexion_success.png)](/assets/uploads/2019/04/connexion_success.png)

Maintenant en possession du TGT d'un administrateur de domaine (encodé en base 64 dans cette capture), l'attaquant peut demander un TGS pour utiliser le service LDAP du contrôleur de domaine `DC-01`. Rubeus permet de faire cette requête.

```
.\Rubeus.exe asktgs /ticket:<ticket en base64> /service:ldap/dc-01.adsec.local /ptt
```

[![Get LDAP TGS](/assets/uploads/2019/04/get_ldap_tgs.png)](/assets/uploads/2019/04/get_ldap_tgs.png)

Tout fonctionne comme prévu, nous pouvons vérifier la présence du TGS en mémoire, pour l'utilisateur `support-account` (puisque l'attaquant a utilisé son TGT), et pour le service LDAP du contrôleur de domaine.

[![Get LDAP TGS](/assets/uploads/2019/04/get_ldap_tgs_success.png)](/assets/uploads/2019/04/get_ldap_tgs_success.png)


Avec ce TGS, il est possible de demander au contrôleur de domaine de se synchroniser avec l'attaquant. Ici, l'attaquant a uniquement demandé de synchroniser le compte `krbtgt` en vue de faire un "Golden Ticket".


[![DCSync](/assets/uploads/2019/04/dc_sync.png)](/assets/uploads/2019/04/dc_sync.png)

Avec le hash NT du compte `krbtgt`, l'attaquant peut tout faire sur l'Active Directory.

## Conclusion

Cette démonstration montre l'impact immense que peut avoir la compromission d'une machine en "Unconstrained Delegation". C'est pourquoi ces machines doivent être surveillées, mais devraient surtout être en [Constrained Delegation](/constrained-unconstrained-delegation/#kerberos-constrained-delegation---kcd) afin de maitriser les services auxquels elles peuvent se connecter lors de la délégation d'authentification. Par ailleurs, les comptes sensibles devraient avoir l'option "Account is sensitive and cannot be delegated" d'activée, ce qui n'était pas le cas dans l'exemple précédent.

[![DCSync](/assets/uploads/2019/04/account_sensitive.png)](/assets/uploads/2019/04/account_sensitive.png)

Si l'option est activée pour ce compte, alors le contrôleur de domaine saura qu'aucun service n'aura le droit de relayer les informations d'authentification de cet utilisateur. Ainsi, concernant la délégation sans contrainte, le contrôleur de domaine ne vas pas inclure une copie du TGT lors de la demande de TGS.

Il y aura toujours un événement 4624 sur le serveur, mais aucune copie de TGT ne sera disponible.

[![DCSync](/assets/uploads/2019/04/no_ticket.png)](/assets/uploads/2019/04/no_ticket.png)

J'espère que cet article vous a plu, si vous avez des remarques ou des questions, n'hésitez pas à les poser ici ou sur [Discord](https://discord.gg/9At6SUZ){:target="blank"}. Vous pouvez toujours suivre la sortie de nouveaux articles sur mon twitter [@hackanddo](https://twitter.com/HackAndDo){:target="blank"}.