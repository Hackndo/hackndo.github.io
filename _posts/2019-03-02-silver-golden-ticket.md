---
title: "Silver & Golden Tickets"
date: 2019-03-02 14:58:17
author: "Pixis"
layout: post
permalink: /kerberos-silver-golden-tickets/
disqus_identifier: 0000-0000-0000-00a6
cover: assets/uploads/2019/02/goldenticket.png
description: "Maintenant que nous avons vu le fonctionnement du protocole Kerberos en environnement Active Directory, nous allons découvrir ensemble les notions de Silver Ticket et Golden Ticket"
tags:
  - windows
  - reseau
  - activedirectory
---

Maintenant que nous avons vu le fonctionnement du [protocole Kerberos](/kerberos) en environnement Active Directory, nous allons découvrir ensemble les notions de Silver Ticket et Golden Ticket. Pour bien comprendre comment ils fonctionnent, il est nécessaire de faire un zoom sur le PAC (*Privilege Attribute Certificate*).

<!--more-->

## PAC

Le PAC est en quelque sorte une extension du protocole Kerberos utilisée par Microsoft pour la bonne gestion des droits dans un Active Directory. En effet, seul le KDC connait les droits de chacuns des objets. Il est donc nécessaire pour lui de transmettre ces informations aux différents services afin qu'ils puissent créer des jetons de sécurité adaptés aux utilisateurs qui utilisent ces services.

*En réalité, Microsoft utilise un champ existant dans les tickets pour y stocker des informations sur l'utilisateur. Ce champ est "authorization-data". Ce n'est donc pas une extension au sens propre du terme.*

Dans le PAC se trouvent beaucoup d'informations concernant l'utilisateur, telles que son nom, son ID, les groupes auxquels il appartient, les informations de sécurité qui lui sont associées etc. Voici un résumé d'un PAC trouvé dans un TGT. Il a été simplifié pour faciliter sa compréhension.

```
AuthorizationData item
    ad-type: AD-Win2k-PAC (128)
        Type: Logon Info (1)
            PAC_LOGON_INFO: 01100800cccccccce001000000000000000002006a5c0818...
                Logon Time: Aug 17, 2018 16:25:05.992202600 Romance Daylight Time
                Logoff Time: Infinity (absolute time)
                PWD Last Set: Aug 16, 2018 14:13:10.300710200 Romance Daylight Time
                PWD Can Change: Aug 17, 2018 14:13:10.300710200 Romance Daylight Time
                PWD Must Change: Infinity (absolute time)
                Acct Name: pixis
                Full Name: pixis
                Logon Count: 7
                Bad PW Count: 2
                User RID: 1102
                Group RID: 513
                GROUP_MEMBERSHIP_ARRAY
                    Referent ID: 0x0002001c
                    Max Count: 2
                    GROUP_MEMBERSHIP:
                        Group RID: 1108
                        Attributes: 0x00000007
                            .... .... .... .... .... .... .... .1.. = Enabled: The enabled bit is SET
                            .... .... .... .... .... .... .... ..1. = Enabled By Default: The ENABLED_BY_DEFAULT bit is SET
                            .... .... .... .... .... .... .... ...1 = Mandatory: The MANDATORY bit is SET
                    GROUP_MEMBERSHIP:
                        Group RID: 513
                        Attributes: 0x00000007
                            .... .... .... .... .... .... .... .1.. = Enabled: The enabled bit is SET
                            .... .... .... .... .... .... .... ..1. = Enabled By Default: The ENABLED_BY_DEFAULT bit is SET
                            .... .... .... .... .... .... .... ...1 = Mandatory: The MANDATORY bit is SET
                User Flags: 0x00000020
                User Session Key: 00000000000000000000000000000000
                Server: DC2016
                Domain: HACKNDO
                SID pointer:
                    Domain SID: S-1-5-21-3643611871-2386784019-710848469  (Domain SID)
                User Account Control: 0x00000210
                    .... .... .... ...0 .... .... .... .... = Don't Require PreAuth: This account REQUIRES preauthentication
                    .... .... .... .... 0... .... .... .... = Use DES Key Only: This account does NOT have to use_des_key_only
                    .... .... .... .... .0.. .... .... .... = Not Delegated: This might have been delegated
                    .... .... .... .... ..0. .... .... .... = Trusted For Delegation: This account is NOT trusted_for_delegation
                    .... .... .... .... ...0 .... .... .... = SmartCard Required: This account does NOT require_smartcard to authenticate
                    .... .... .... .... .... 0... .... .... = Encrypted Text Password Allowed: This account does NOT allow encrypted_text_password
                    .... .... .... .... .... .0.. .... .... = Account Auto Locked: This account is NOT auto_locked
                    .... .... .... .... .... ..1. .... .... = Don't Expire Password: This account DOESN'T_EXPIRE_PASSWORDs
                    .... .... .... .... .... ...0 .... .... = Server Trust Account: This account is NOT a server_trust_account
                    .... .... .... .... .... .... 0... .... = Workstation Trust Account: This account is NOT a workstation_trust_account
                    .... .... .... .... .... .... .0.. .... = Interdomain trust Account: This account is NOT an interdomain_trust_account
                    .... .... .... .... .... .... ..0. .... = MNS Logon Account: This account is NOT a mns_logon_account
                    .... .... .... .... .... .... ...1 .... = Normal Account: This account is a NORMAL_ACCOUNT
                    .... .... .... .... .... .... .... 0... = Temp Duplicate Account: This account is NOT a temp_duplicate_account
                    .... .... .... .... .... .... .... .0.. = Password Not Required: This account REQUIRES a password
                    .... .... .... .... .... .... .... ..0. = Home Directory Required: This account does NOT require_home_directory
                    .... .... .... .... .... .... .... ...0 = Account Disabled: This account is NOT disabled
```

Ce PAC se trouve dans les tickets générés pour un utilisateur (TGT ou TGS) et est chiffré soit avec la clé du KDC, soit avec celle du service demandé. L'utilisateur n'a donc pas la main sur ces informations, il ne peut pas modifier ses propres droits, groupes, etc.

Cette structure est très importante car c'est elle qui permet à un utilisateur d'accéder (ou non) à un service, à une ressource, d'effectuer certaines actions.

[![PAC](/assets/uploads/2019/02/pac.png)](/assets/uploads/2019/02/pac.png)

Le PAC peut être considéré comme le badge de sécurité de l'utilisateur : Il peut l'utiliser pour ouvrir des portes, mais il ne peut pas ouvrir des portes auxquelles il n'a pas accès.

## Silver Ticket

Lorsqu'un client a besoin d'utiliser un service, il demande au KDC (Key Distribution Center) un TGS (*Ticket Granting Service*). Ce processus passe par les deux demandes [KRB_TGS_REQ](/kerberos/#krb_tgs_req) et [KRB_TGS_REP](/kerberos/#krb_tgs_rep).

Pour rappel, voici à quoi ressemble schématiquement un TGS.

[![TGS](/assets/uploads/2019/02/tgs.png)](/assets/uploads/2019/02/tgs.png)

Il est chiffré avec le hash NTLM du compte responsable du service (compte machine ou compte utilisateur). Ainsi, si un attaquant parvient à extraire le mot de passe ou le hash NTLM d'un compte de service, il peut alors forger un ticket de service (TGS) en choisissant les informations qu'il veut mettre dedans afin d'accéder à ce service, sans passer par le KDC. C'est l'attaquant qui construit ce ticket dans son coin, comme un grand. C'est ce ticket forgé qui est appelé **Silver Ticket**.

Prenons en exemple un attaquant qui trouve le hash NTLM du compte de la machine `DESKTOP-01`. Le compte machine est alors `DESKTOP-01$`. L'attaquant peut créer un bloc de données correspondant à un ticket comme celui trouvé dans `KRB_TGS_REP`, Il indiquera le nom du domaine, le nom du service demandé sous sa forme SPN (Service Principal Name), le nom d'un utilisateur (qu'il peut choisir arbitrairement), son PAC (qu'il peut également forger). Voici un exemple simpliste de ticket que l'attaquant peut créer :

* **realm** : adsec.local
* **sname** : cifs\desktop-01.adsec.local
* **enc-part** : *// Partie chiffrée avec le hash NTLM trouvé par l'attaquant*
    * **key** : 0x309DC6FA122BA1C *// Clé de session arbitrairement choisie*
    * **crealm** : adsec.local
    * **cname** : pixisAdmin
    * **authtime** : 2050/01/01 00:00:00 *// Date de validité du ticket*
    * **authorization-data** : PAC forgé dans lequel l'utilisateur est, par exemple, administrateur du domaine

Une fois cette structure créée, il chiffre le bloc `enc-part` avec le hash NTLM découvert, puis il peut créer de toute pièce un [KRB_AP_REQ](/kerberos/#krb_ap_req). En effet, il lui suffit d'envoyer ce ticket au service cible, accompagné d'un authentifiant qu'il chiffre avec la clé de session qu'il a arbitrairement choisie dans le TGS. Le service sera en mesure de déchiffrer le TGS, extraire la clé de session, déchiffrer l'authentifiant et fournir le service à l'utilisateur puisque les informations forgée dans le PAC indiquent qu'il a le droit d'utiliser ce service.

Notons que le PAC est doublement signé. Une première signature via le secret du compte de service, et une deuxième via le secret du contrôleur de domaine. Cependant, lorsque le service reçoit ce ticket, il ne vérifie en général que la première signature. En effet, les comptes de services ayant le privilège [SeTcbPrivilege](https://docs.microsoft.com/en-us/windows/desktop/secauthz/privilege-constants), signifiant que ces comptes peuvent agir en tant que partie du système d'exploitation (par exemple le compte local `SYSTEM`), ne vérifient pas la signature du contrôleur de domaine. Pratique, d'un point de vue attaquant ! Cela signifie également que même si le secret du KDC est changé (i.e. le mot de passe du compte `krbtgt`), les Silver Tickets pourront toujours fonctionner, sympa comme persistence.

Voici un schéma résumant l'attaque :

[![Silver Ticket](/assets/uploads/2019/02/silverticket.png)](/assets/uploads/2019/02/silverticket.png)

En pratique, voici une capture d'écran qui montre la création d'un Silver Ticket avec l'outil [Mimikatz](http://blog.gentilkiwi.com/mimikatz) développé par Benjamin Delpy ([@gentilkiwi](https://twitter.com/gentilkiwi)).

[![CIFS Example](/assets/uploads/2019/02/ST_CIFS.png)](/assets/uploads/2019/02/ST_CIFS.png)

La ligne de commande utilisée dans Mimikatz est la suivante :

```
/kerberos::golden /domain:adsec.local /user:ANY /sid:S-1-5-21-1423455951-1752654185-1824483205 /rc4:ceaxxxxxxxxxxxxxxxxxxxxxxxxxxxxx /target:DESKTOP-01.adsec.local /service:cifs /ptt
```

Cela veut dire qu'on crée un ticket pour le domaine `adsec.local` avec un nom d'utilisateur arbitraire (`ANY`), et que l'on vise le service `CIFS` de la machine `DESKTOP-01` en fournissant son hash NTLM.


## Golden Ticket

Nous avons vu qu'avec un **Silver Ticket**, il était possible d'accéder à un service fourni par un compte de domaine si ce compte était compromis. En effet, le service accepte les informations chiffrées avec son propre secret puisqu'en théorie, seul le service et le KDC ont connaissance de ce secret.

C'est un bon début, mais nous pouvons aller plus loin. En construisant un Silver Ticket, l'attaquant s'affranchit du KDC puisqu'en réalité, le vrai PAC de l'utilisateur contenu dans son TGT ne permet pas d'effectuer toutes les actions qu'il souhaite. Pour pouvoir modifier le TGT, ou en forger un nouveau, il faudrait connaitre la clé qui l'a chiffré, c'est à dire celle du KDC. Cette clé, c'est en fait le hash NTLM du compte `krbtgt`. Ce compte est un simple compte, sans droits particuliers (au niveau système ou Active Directory) et même désactivé. Cette faible exposition permet de mieux le protéger.

Si jamais un attaquant parvient à trouver le hash NTLM de ce compte, il est alors en mesure de forger des TGT avec des PAC arbitraires. Et là, c'est un peu le Saint Graal. Il suffit de forger un TGT avec comme information que l'utilisateur de ce ticket fait partie du groupe "Administrateurs du Domaine", et le tour est joué.

Avec un TGT de la sorte entre les mains, l'utilisateur peut demander au KDC n'importe quel TGS pour n'importe quel service. Or ces TGS auront une copie du PAC qu'a forgé l'attaquant, certifiant qu'il est administrateur de domaine.

C'est ce TGT forgé qui est appelé **Golden Ticket**. Le schéma de l'attaque est très similaire à celui du Silver Ticket. Voici une représentation également simplifiée :

[![Golden Ticket](/assets/uploads/2019/02/goldenticket.png)](/assets/uploads/2019/02/goldenticket.png)

En pratique, voici la démonstration de la création d'un **Golden Ticket**. D'abord, nous sommes dans une session qui ne possède pas de ticket en cache, et n'a pas les droits d'accéder à `\\DC-01.adsec.local\$`.

[![CIFS Example](/assets/uploads/2019/03/golden_ticket_access_denied.png)](/assets/uploads/2019/03/golden_ticket_access_denied.png)

On génère alors le **Golden Ticket** en utilisant le hash NTLM du compte `krbtgt`

[![CIFS Example](/assets/uploads/2019/03/golden_ticket_generated.png)](/assets/uploads/2019/03/golden_ticket_generated.png)

Une fois ce ticket en mémoire, notre session est en mesure de demander un TGS pour n'importe quel SPN, par exemple pour `CIFS\DC-01.adsec.local` permettant de lire le contenu du partage `\\DC-01.adsec.local\$`

[![CIFS Example](/assets/uploads/2019/03/golden_ticket_access_granted.png)](/assets/uploads/2019/03/golden_ticket_access_granted.png)


## Conclusion

Cet article permet de clarifier les notions de PAC, Silver Ticket et de Golden Ticket. Ces notions sont essentielles pour comprendre les attaques Kerberos dans un Active Directory.

N'hésitez pas à laisser un commentaire ou à me retrouver sur le [serveur Discord](https://discord.gg/9At6SUZ) du blog si vous avez des questions ou des idées !

## Ressources

* [Secrets d’authentification épisode II Kerberos contre-attaque - Aurélien Bordes](https://www.sstic.org/media/SSTIC2014/SSTIC-actes/secrets_dauthentification_pisode_ii__kerberos_cont/SSTIC2014-Article-secrets_dauthentification_pisode_ii__kerberos_contre-attaque-bordes_2.pdf)
* [ADSecurity - Pyrotek3](http://adsecurity.org/)
* [Kerberos Exploration - Rémi Vernier](http://remivernier.com/index.php/2018/07/07/kerberos-exploration/)