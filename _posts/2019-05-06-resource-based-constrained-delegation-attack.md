---
title: "Resource-Based Constrained Delegation - Risques"
date: 2019-05-05 10:28:42
author: "Pixis"
layout: post
permalink: /resource-based-constrained-delegation-attack/
disqus_identifier: 0000-0000-0000-00ad
cover: assets/uploads/2019/04/rbcd_baneer.png
description: "Cet article montre comment abuser de la délégation contrainte basée sur les ressources (resource based constrained delegation) afin de prendre le contrôle de machines."
tags:
  - "Active Directory"
  - Windows
---

Cet article montre comment abuser de la délégation contrainte basée sur les ressources (resource-based constrained delegation) afin de prendre le contrôle de machines.

<!--more-->

Il repose sur du contenu d'excellente qualité. J'ai tenté de résumer avec des mots simples une petite partie du travail de [Elad Shamir](https://twitter.com/elad_shamir). Son article [Wagging the Dog: Abusing Resource-Based Constrained Delegation to Attack Active Directory](https://shenaniganslabs.io/2019/01/28/Wagging-the-Dog.html) est incroyable de détails et de recherches. D'autres articles ont suivi, notamment celui de [Dirk-jan](https://twitter.com/_dirkjan) ([The worst of both worlds: Combining NTLM Relaying and Kerberos delegation ](https://dirkjanm.io/worst-of-both-worlds-ntlm-relaying-and-kerberos-delegation/)) ou celui de [Harmj0y](https://twitter.com/harmj0y) ([A Case Study in Wagging the Dog: Computer Takeover](https://www.harmj0y.net/blog/activedirectory/a-case-study-in-wagging-the-dog-computer-takeover/)), me permettant d'assembler toutes les pièces et de rédiger cet article.

Vous êtes prêts ? Let's dive in.

## Rappels : Resource-Based Constrained Delegation

Dans cet article, le terme "Resource-Based" sera utilisé pour parler de cette délégation.

Contrairement à la [délégation complète](/unconstrained-delegation-attack), la délégation Resource-Based est un poil plus compliquée. L'idée générale est que ce sont les ressources de fin de chaine qui décident si oui ou non un service peut s'authentifier auprès d'elles en tant qu'un autre utilisateur. Ces ressources ont donc une liste de comptes en lesquels elles ont confiance. Si une ressource fait confiance au compte `WEBSERVER$`, alors quand un utilisateur s'authentifiera auprès de `WEBSERVER$`, il pourra lui même s'authentifier auprès de cette ressource en tant que l'utilisateur.

En revanche, si un autre utilisateur s'authentifie auprès d'un compte qui ne fait pas partie de la liste de confiance du service (par exemple `FILESERVER$` ou `Sql_SVC` dans le schéma ci-dessous), ce compte ne pourra pas se faire passer pour cet utilisateur auprès du service.

[![Resource Based Constrained Delegation](/assets/uploads/2019/02/resource_based_constrained_delegation_schema.png)](/assets/uploads/2019/02/resource_based_constrained_delegation_schema.png)

Concrètement, comme expliqué dans l'[article sur la délégation](/constrained-unconstrained-delegation/#kerberos-constrained-delegation), la ressource finale, à droite sur le schéma, a un attribut appelé `msDS-AllowedToActOnBehalfOfOtherIdentity ` qui contient la liste des comptes en lesquels elle a confiance. 

Par ailleurs, pour que cette délégation fonctionne, l'attribut `ADS_UF_NOT_DELEGATED` de l'utilisateur ne doit pas être positionné. C'est un attribut qui permet d'interdire la délégation en vue de protéger le compte des attaques liées à la délégation.

Notons également que pour relayer l'authentification d'un utilisateur, le compte de service "relai" (`WEBSERVER$` dans le schéma) doit avoir un TGS provenant de l'utilisateur.

**Si l'utilisateur s'authentifie via Kerberos**, aucun soucis, le service "relai" est en possession du TGS de l'utilisateur, donc le mécanisme (**S4U2Proxy**) est simple, le compte de service envoie le TGS de l'utilisateur au contrôleur de domaine pour que celui-ci lui renvoie un TGS valide pour accéder à la ressource désirée (si bien sûr le compte de service fait partie de la liste de confiance de la ressource).

[![Resource Based Constrained Delegation Detailed](/assets/uploads/2019/02/resource_based_constrained_delegation_schema_detailed.png)](/assets/uploads/2019/02/resource_based_constrained_delegation_schema_detailed.png)

En revanche, **si l'utilisateur s'authentifie d'une autre manière** (NTLM par exemple), le compte de service n'a pas reçu de TGS. Il va alors devoir faire une première demande pour avoir un TGS transférable au nom de l'utilisateur, c'est le mécanisme **S4U2Self**, puis il utilisera ce TGS transférable pour faire le processus expliqué juste avant, **S4U2Proxy**.

[![S4U2Self](/assets/uploads/2019/02/s4u2self.png)](/assets/uploads/2019/02/s4u2self.png)

## Comportement "by design"

Maintenant que ces rappels sont faits, il est intéressant de creuser un peu. En effet, on se rend compte que le mécanisme **S4U2Self** peut être assez dangereux, parce qu'un service peut finalement demander un TGS **au nom de n'importe quel utilisateur**. Dans le processus normal, il demande un TGS au nom de l'utilisateur qui s'est authentifié auprès de lui, mais rien ne l'oblige à se limiter à ce compte.

Heureusement, cette possibilité de demander des TGS transférables au nom de n'importe qui (S4U2Self) n'est possible que pour les comptes ayant l'attribut `TrustedToAuthForDelegation` de positionné, ce qui n'est pas un attribut positionné par défaut, et qu'on trouve rarement en entreprise.

Plus précisemment, **tous les comptes de service peuvent faire un S4U2Self**, mais seuls ceux avec l'attribut `TrustedToAuthForDelegation` recevront un TGS **transférable**, condition à priori nécessaire pour S4U2Proxy (cf. [la documentation Microsoft](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-sfu/ad98268b-f75b-42c3-b09b-959282770642)).

Ainsi, par exemple, lors d'une délégation contrainte (**pas** Resource-Based), si un compte machine demande un TGS via S4U2Self sans avoir l'attribut `TrustedToAuthForDelegation`, ce compte recevra un TGS **non transférable**, et lors de la demande de TGS pour une ressource (S4U2Proxy), ce sera refusé puisque ce TGS ne peut pas être transféré.

En revanche, et **c'est là que c'est super incroyable**, dans le cas de la délégation **Resource-Based**, si de la même manière un compte machine demande un TGS via S4U2Self sans avoir l'attribut `TrustedToAuthForDelegation`, ce compte recevra un TGS **qui sera toujours non transférable**, mais lors de la demande de TGS pour une ressource (S4U2Proxy), cette demande **SERA ACCEPTÉE** (cf. encore [la documentation Microsoft](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-sfu/c6f6f8b3-1209-487b-881d-d0908a413bb7)).

[![S4U2Self without transferable](/assets/uploads/2019/04/s4u2selfok.png)](/assets/uploads/2019/04/s4u2selfok.png)

Dans cet exemple, le `SERVEUR1$` n'a pas l'attribut `TrustedToAuthForDelegation` de positionné, mais il est déclaré dans la liste de confiance de `Service B`. Lors de sa demande de TGS pour un utilisateur lambda via S4U2Self, le contrôleur de domaine lui envoie un TGS **non transférable**, cependant en passant ce TGS à la requête S4U2Proxy afin de récupérer un TGS pour utiliser le `Service B`, il n'y a aucun soucis, ça fonctionne, et `SERVEUR1$` peut utiliser `Service B` en tant que l'utilisateur choisi.

Au cas où ce n'est toujours pas clair, ça veut dire que `SERVEUR1$` peut s'authentifier auprès de `Service B` en tant que **n'importe quel utilisateur**.

Et ouais.

## Attribut Machine-Account-Quota

Pour pouvoir décrire un chemin d'attaque complet, il faut également parler de l'attribut [msds-MachineAccountQuota](https://docs.microsoft.com/en-us/windows/desktop/adschema/a-ms-ds-machineaccountquota) qui est positionné sur le domaine. Cet attribut décrit le nombre de comptes machines qu'un utilisateur du domaine peut créer. Cet attribut vaut 10 par défaut. Cela signifie que, par défaut, un utilisateur peut joindre 10 machines au domaine, ou qu'il peut créer 10 comptes machine, en choisissant notamment leur nom et leur mot de passe.

Ce comportement peut être modifié [par GPO](https://social.technet.microsoft.com/wiki/contents/articles/5446.active-directory-how-to-prevent-authenticated-users-from-joining-workstations-to-a-domain.aspx), mais voilà, par défaut, c'est 10.

Cet ajout peut être fait directement dans les paramètres d'une machine Windows, mais également via LDAP. Cette fonctionnalité est notamment disponible dans l'outil [Powermad](https://github.com/Kevin-Robertson/Powermad) de [Kévin Robertson](https://twitter.com/kevin_robertson).

```powershell
New-MachineAccount -MachineAccount NOUVELLEMACHINE -Password $(ConvertTo-SecureString "Hackndo123+!" -AsPlainText -Force)
```

Cette fonctionnalité est importante parce que dans les histoires de délégation, les comptes concernés sont des comptes de service, c'est à dire des comptes avec un ou plusieurs SPN. Un utilisateur du domaine n'a pas d'attribut SPN, mais il peut créer un compte machine qui lui possède par défaut plusieurs SPN.

## Exploitation

Nous avons maintenant tous les éléments en main pour décrire un chemin d'attaque. Il en existe d'autres, bien sûr, mais ce chemin permet d'assembler toutes les pièces du puzzle.

Nous nous plaçons dans le cas d'une position *man-in-the-middle* en utilisant le fait que IPv6 est majoritairement activé dans les réseaux d'entreprise, et que d'un point de vue OS, c'est ce protocole qu'il faut utiliser en priorité, avant IPv4. Un attaquant peut alors se positionner en serveur DHCP IPv6 et répondre aux équipements alentours.

[![MITM6 Wpad](/assets/uploads/2019/04/mitm6_wpad.png)](/assets/uploads/2019/04/mitm6_wpad.png)


Par ailleurs, il est possible de relayer une authentification HTTP d'une machine en une authentification LDAPS vers une autre. Nous relaierons les connexions vers le contrôleur de domaine.

Lorsque la machine `DESKTOP-01` va se connecter au réseau (reboot, branchement du cable réseau), le compte `DESKTOP-01$` va se connecter en HTTP à notre machine du fait de notre position *man-in-the-middle*. C'est à ce moment que le relai va être effectif.

Deux actions vont être effectuées via LDAPS, en utilisant cette authentification relayée, en tant que `DESKTOP-01$`.

1. Un compte machine `HACKNDO$` va être créé, puisque le compte `DESKTOP-01$` est un compte du domaine, et a le droit d'ajouter 10 comptes machines au domaine, par défaut.
2. Le compte machine `DESKTOP-01$` a le droit de modifier certains de ses attributs, dont l'attribut `msDS-AllowedToActOnBehalfOfOtherIdentity`, qui est la liste des machines de confiance pour la délégation "Resource-Based". On va donc modifier cet attribut pour ajouter `HACKNDO$` à cette liste de confiance.

[![Relai LDAP](/assets/uploads/2019/04/relai_ldap.png)](/assets/uploads/2019/04/relai_ldap.png)

Maintenant, nous avons la main sur le compte `HACKNDO$`, puisque nous avons choisi son nom et son mot de passe lors de la création, et ce compte a la confiance de `DESKTOP-01$`.

Il suffit alors de se connecter en tant que `HACKNDO$`, faire une demande de TGS au nom d'un administrateur via `S4U2Self`. Le contrôleur de domaine va nous répondre avec un TGS **non transférable**. Nous demandons ensuite un TGS pour utiliser le service `CIFS` de `DESKTOP-01` (`CIFS/DESKTOP-01`) en fournissant le TGS précédemment demandé (S4U2Proxy). Comme nous l'avons vu au début, bien qu'il ne soit pas transférable, il est tout de même accepté, et le contrôleur de domaine nous envoie un TGS en tant que l'administrateur pour utiliser le service `CIFS` de `DESKTOP-01`.

Voici un petit schéma récapitulatif :

[![Processus complet](/assets/uploads/2019/04/process_complete_relay.png)](/assets/uploads/2019/04/process_complete_relay.png)

Il est possible de répéter l'opération pour demander un TGS en vue de pouvoir gérer les services. Ainsi, en envoyant un exécutable de type "reverse-shell" sur la machine avec le ticket `CIFS`, puis en créant et démarrant un service utilisant cet executable à l'aide d'un ticket `SCHEDULE`, il est possible de prendre la main sur la machine en tant que SYSTEM.

## Résumé

L'opération étant un peu complexe, voici les différentes étapes résumées :

1. Ajouter une machine `M` au domaine (via un relai d'authentification, via un compte de domaine déjà possédé, ...)
2. Ajouter cette machine `M` à la liste de confiance de la cible `C` (i.e. l'ajouter à l'attribut `msDS-AllowedToActOnBehalfOfOtherIdentity` en relayant l'authentification de la machine cible, puisqu'elle a le droit de changer son propre attribut)
3. Faire une demande de TGS pour un ticket au nom d'un administrateur via S4U2Self
4. Une fois en possession de ce ticket, l'envoyer au contrôleur de domaine pour demander un TGS vers la cible `C` via S4U2Proxy.
5. Enjoy ce nouveau ticket valide, en tant que l'administrateur choisi. D'autres tickets peuvent être demandés avec l'étape 4.

## Conclusion

La délégation "Resource-Based" est un procédé complexe, tellement complexe que des problématiques de sécurité sont introduites dans l'implémentation de la fonctionnalité.

Ce qu'il faut finalement retenir, c'est qu'il est possible de prendre la main sur une machine lorsqu'on a la possibilité de modifier sa liste de confiance dans le cadre de la délégation basée sur les ressources.

Pour s'en prémunir, plusieurs actions sont possibles. Tout d'abord, il faut implémenter le [channel binding](https://support.microsoft.com/en-us/help/4034879/how-to-add-the-ldapenforcechannelbinding-registry-entry) au niveau de LDAP afin d'empêcher le relai vers LDAPS. Ensuite, il faut limiter la possibilité de création de comptes machines sur le domaine à des groupes définis d'utilisateurs. Enfin, en lien avec cet exemple, IPv6 devrait être désactivé dans les réseaux d'entreprise, puisqu'il ne répond à aucun besoin.

Cet article étant relativement dense, il serait tout à fait normal que des points ne soient pas tout à fait clairs. Si vous avez des questions, n'hésitez pas à les poser en commentaire ou sur [Discord](https://discord.gg/9At6SUZ){:target="blank"}. Vous pouvez toujours suivre la sortie de nouveaux articles sur mon twitter [@hackanddo](https://twitter.com/HackAndDo){:target="blank"}.

Enfin, n'hésitez pas à faire un tour sur les ressources citées, notamment l'article de [Elad Shamir](https://twitter.com/elad_shamir) qui est un travail de recherche complet et super intéressant.

## Ressources

* [Wagging the Dog: Abusing Resource-Based Constrained Delegation to Attack Active Directory](https://shenaniganslabs.io/2019/01/28/Wagging-the-Dog.html) par [Elad Shamir](https://twitter.com/elad_shamir)
* [The worst of both worlds: Combining NTLM Relaying and Kerberos delegation ](https://dirkjanm.io/worst-of-both-worlds-ntlm-relaying-and-kerberos-delegation/) par [Dirk-jan](https://twitter.com/_dirkjan)
* [A Case Study in Wagging the Dog: Computer Takeover](https://www.harmj0y.net/blog/activedirectory/a-case-study-in-wagging-the-dog-computer-takeover/) par [Harmj0y](https://twitter.com/harmj0y)
