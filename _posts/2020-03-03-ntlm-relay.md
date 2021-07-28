---
title: "Relai NTLM"
date: 2020-04-01 10:11:52
author: "Pixis"
layout: post
permalink: /ntlm-relay/
disqus_identifier: 0000-0000-0000-00b4
cover: assets/uploads/2020/03/ntlm_relay_banner.png
description: "Le relai NTLM est une technique consistant à se mettre entre un client et un serveur pour effectuer des actions sur le serveur en se faisant passer pour le client. Les protections telles que le SMB Signing ou le MIC permettent de limiter les actions d'un attaquant. Cet article descend dans le détail de cette technique pour en comprendre le fonctionnement et ses limites."
tags:
  - "Active Directory"
  - Windows
translation:
  - en
---

Le relai NTLM est une technique consistant à se mettre entre un client et un serveur pour effectuer des actions sur le serveur en se faisant passer pour le client. Correctement utilisée, elle peut être très puissante et peut permettre de prendre le contrôle d'un domaine Active Directory sans avoir d'identifiants au préalable. L'objet de cet article est d'expliquer le relai NTLM, et de présenter ses limites.

<!--more-->

## Préliminaire

Cet article n'est pas voué à être un tutoriel à suivre à la lettre pour mener à bien une attaque, mais il permettra au lecteur de comprendre en détail le **fonctionnement technique** de cette attaque, ses limites, et peut être une base pour commencer à développer ses propres outils, ou comprendre comment fonctionnent les outils actuels.

Par ailleurs, et afin d'éviter toute confusion, voici quelques rappels :

* **Hash NT** et **Hash LM** sont des versions de condensat des mots de passe des utilisateurs. Les hash LM sont totalement obsolètes, et ne seront pas mentionnés dans cet article. Le hash NT est communément appelé, à tord à mon sens, "hash NTLM". Cette désignation prête à confusion avec le nom du protocole, NTLM. Ainsi, lorsque nous parlerons du condensat du mot de passe de l'utilisateur, nous parlerons bien de **hash NT**.
* **NTLM** est donc le nom du **protocole** d'authentification. Il existe aussi en version 2. Dans cet article, si la version influe sur l'explication, alors NTLMv1 et NTLMv2 seront les termes employés. Sinon, le terme NTLM sera employé pour regrouper l'ensemble des versions du protocole.
* **Hash NTLMv1** et **Hash NTLMv2** seront les terminologies utilisées pour parler de la réponse au challenge envoyée par le client, pour les version 1 et 2 du protocole NTLM.
* **Net-NTLMv1** et **Net-NTLMv2** sont des néo-terminologies utilisées lorsque le hash NT est appelé hash NTLM afin de distinguer le hash NTLM du protocole. Comme nous n'utilisons pas la terminologie hash NTLM, ces deux terminologies ne seront pas utilisées.
* **Hash Net-NTLMv1** et **Hash Net-NTLMv2** sont également des terminologies visant à éviter la confusion, mais ne seront également pas utilisées dans cet article.

## Introduction

Le relai NTLM repose, comme son nom l'indique, sur l'authentification NTLM. Le fonctionnement de NTLM a été vu dans [l'article sur pass-the-hash](/pass-the-hash/#protocole-ntlm). Je vous invite à lire au moins la partie sur le protocole NTLM et sur les authentifications locales et distantes.

Pour rappel, le protocole NTLM est utilisé pour authentifier un client auprès d'un serveur. Ce qu'on appelle client et serveur sont les deux parties de l'échange. Le client est celui qui souhaite s'authentifier, et le serveur est celui qui valide, ou non, l'authentification du client.

[![NTLM](/assets/uploads/2020/03/ntlm_basic.png)](/assets/uploads/2020/03/ntlm_basic.png)

Cette authentification se déroule en 3 étapes :

1. D'abord le client indique au serveur qu'il veut s'authentifier.
2. Le serveur répond alors avec un défi, ou un challenge, qui n'est rien d'autre qu'une suite aléatoire de caractères.
3. Le client chiffre ce défi avec son secret, et renvoie le résultat au serveur, c'est sa réponse.

Ce procédé s'appelle **challenge/response**.

[![NTLM Challenge Response](/assets/uploads/2020/03/ntlm_challenge_response.png)](/assets/uploads/2020/03/ntlm_challenge_response.png)

L'intérêt de cet échange, c'est que le secret de l'utilisateur ne transite jamais sur le réseau. C’est ce qu’on appelle une [preuve à divulgation nulle de connaissance](https://fr.wikipedia.org/wiki/Preuve_%C3%A0_divulgation_nulle_de_connaissance).

## Relai NTLM

Avec ces informations, nous pouvons aisément imaginer le scénario suivant : Un attaquant arrive à se positionner entre le client et le serveur, et ne fait que relayer les informations de l'un vers l'autre.

Comme il est en position d'homme du milieu, cela signifie que du point de vue du client, la machine de l'attaquant est le serveur auprès duquel il souhaite s'authentifier, et du point de vue du serveur, l'attaquant est un client comme un autre qui souhaite s'authentifier.

Sauf que l'attaquant ne souhaite pas "juste" s'authentifier auprès du serveur. Il souhaite le faire en se faisant passer pour le client. Or, il ne connait pas le secret du client, et même s'il écoute les conversations, comme ce secret n'est jamais transmis sur le réseau, l'attaquant n'est pas en mesure d’extraire un quelconque secret pour ensuite s'authentifier auprès du serveur. Mais alors, comment ça fonctionne ?

### Relai de messages

Lors d'une authentification NTLM, un client peut prouver à un serveur qu'il est bien qui il prétend être, et pour cela, il chiffre une information fournie par le serveur en utilisant son mot de passe. L'idée est alors que l'attaquant va se positionner en "passe plat", en laissant le client travailler, et en passant les plats du client vers le serveur, et les réponse du serveur vers le client.

Tout ce que le client doit envoyer au serveur, c'est l'attaquant qui le recevra, et il renverra les messages tels quels au vrai serveur, et tous les messages que le serveur envoie au client, c'est également l'attaquant qui les recevra, et ils les transmettra au client, tels quels.

[![Relai NTLM](/assets/uploads/2020/03/ntlm_relay_basic.png)](/assets/uploads/2020/03/ntlm_relay_basic.png)

Et tout ça, ça fonctionne bien ! En effet, du point de vue du client, donc la partie de gauche sur le schéma, une authentification NTLM a lieu entre l'attaquant et lui, avec toutes les briques nécessaires. Le client envoie une demande d'authentification dans son premier message, ce à quoi l'attaquant répond avec un défi, ou *challenge*. En recevant ce challenge, le client construit sa réponse à l'aide de son secret, et envoie finalement le dernier message de l'authentification contenant notamment le challenge chiffré.

En l'état, l'attaquant ne peut (presque) rien faire de cet échange. Mais heureusement, il y a la partie droite du schéma. En effet, du point de vue du serveur, l'attaquant est un client comme un autre. Il a envoyé un premier message pour demander à s'authentifier, et le serveur a répondu avec un challenge. Comme **l'attaquant a envoyé ce même challenge au vrai client**, le vrai client a **chiffré ce challenge** avec **son secret**, et a répondu **avec une réponse valide**. L'attaquant peut donc envoyer cette **réponse valide** au serveur.

C'est là que réside tout l'intérêt de cette attaque. En effet, du point de vue du serveur, l'attaquant s'est authentifié auprès de lui en utilisant le secret de la victime, mais cela de manière transparente pour le serveur. Il n'a aucune idée du fait que l'attaquant rejouait ses réponses auprès du client pour que le client lui donne les bonnes réponses.

Ainsi, du point de vue du serveur, voilà ce qu'il s'est passé :

[![Relai NTLM - Point de vue du serveur](/assets/uploads/2020/03/ntlm_relay_server_pov.png)](/assets/uploads/2020/03/ntlm_relay_server_pov.png)

A la fin de ces échanges, l'attaquant est authentifié sur le serveur avec les identifiants du client.

### Net-NTLMv1 et Net-NTLMv2

Pour information, c'est cette **réponse valide** relayée par l'attaquant dans le message 3, donc le chiffrement du challenge avec le secret, qu'on appelle communément le hash Net-NTLMv1 ou Net-NTLMv2, mais qu'on appellera ici **Hash NTLMv1** ou **Hash NTLMv2**, comme indiqué dans le paragraphe préliminaire.

Pour être exact, ce n'est pas tout à fait le chiffrement du challenge, mais un condensat qui utilise le secret du client. C'est la fonction HMAC_MD5 qui est [utilisée dans le cas de NTLMv2](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/5e550938-91d4-459f-b67d-75d70009e3f3) par exemple. On peut tenter de casser ce type de hash par force brute. La cryptographie associée au [calcul du hash NTLMv1](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/464551a8-9fc4-428e-b3d3-bc5bfb2e73a5) est obsolète, et le hash NT qui a servi à créer le hash peut être retrouvé très rapidement. En revanche pour NTLMv2 ça prend beaucoup plus de temps. Il est donc préférable et conseillé de ne pas autoriser les authentification avec NTLMv1 sur un réseau de production.

## En pratique

A titre d'exemple, j'ai monté un petit lab avec plusieurs machines. Il y a notamment un client **DESKTOP01** dont l'adresse IP est **192.168.56.221** et un serveur **WEB01** avec comme IP **192.168.56.211**. Ma machine est celle de l'attaquant, avec l'adresse IP **192.168.56.1**. Nous nous trouvons donc dans la situation suivante :

[![Relai NTLM - Exemple](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing.png)](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing.png)

L'attaquant a donc réussi à se mettre en position d'homme du milieu. Il existe différentes techniques pour y parvenir, que ce soit via un abus des configurations par défaut de IPv6 dans un environnement Windows, ou des protocoles LLMNR et NBT-NS. Quoiqu'il en soit, l'attaquant fait croire au client que c'est lui, le serveur. Ainsi, lorsque le client tente de s'authentifier, c'est auprès de l'attaquant qu'il va effectuer cette opération.

L'outil que j'utilise pour effectuer cette attaque est [ntlmrelayx](https://github.com/SecureAuthCorp/impacket/blob/master/examples/ntlmrelayx.py), outil présent dans la suite Impacket. Cet outil est présenté en détails dans [cet article](https://www.secureauth.com/blog/playing-relayed-credentials) par [Agsolino](https://twitter.com/agsolino), le développeur de Impacket.

```sh
ntlmrelayx.py -t 192.168.56.221
```

L'outil crée différents serveurs, dont un serveur SMB pour cet exemple, et il écoute dessus. S'il reçoit une connexion sur ce serveur, il relaiera cette connexion vers la cible que nous lui fournissons, soit **192.168.56.221** dans cet exemple. 

D'un point de vue réseau, voici une capture de l'échange, avec l'attaquant qui relaie les informations vers la cible.

[![Relai NTLM - PCAP](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing_pcap.png)](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing_pcap.png)

En vert se trouvent les échanges entre le client **DESKTOP01** et l'attaquant, et en rouge les échanges entre l'attaquant et le serveur **WEB01**. Nous voyons bien les 3 messages effectués entre **DESKTOP01** et l'attaquant, et entre l'attaquant et le serveur **WEB01**.

Et pour bien comprendre la notion de **relai**, nous pouvons vérifier que lorsque le serveur **WEB01** envoie un challenge à l'attaquant, l'attaquant renvoie exactement la même chose au client **DESKTOP01**.

Voilà le challenge envoyé par **WEB01** à l'attaquant :

[![Relai NTLM - Challenge](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing_pcap_challenge_1.png)](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing_pcap.png)

Lorsque l'attaquant reçoit ce challenge, il l'envoie à son tour, sans le modifier, au client **DESKTOP01**. Dans cet exemple, le challenge est `b6515172c37197b0`, et il est transmis au client :

[![Relai NTLM - Challenge](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing_pcap_challenge_2.png)](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing_pcap.png)

Le client va alors calculer la réponse en utilisant son secret, comme nous l'avons vu dans les paragraphes précédents, et il va envoyer cette réponse en indiquant qui il est (**jsnow**), sur quelle machine il se trouve (**DESKTOP01**), et dans cet exemple il indique que c'est un utilisateur du domaine, donc il fournit le nom du domaine (**ADSEC**).

[![Relai NTLM - Response](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing_pcap_response_1.png)](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing_pcap.png)

L'attaquant qui reçoit tout ça ne se pose pas de questions. Il envoie exactement les mêmes informations au serveur. Il prétend donc être l'utilisateur **jsnow** sur la machine **DESKTOP01** et faisant partie du domaine **ADSEC**, et il envoie également la réponse qui a été calculée par le client, appelée **NTLM Response** dans ces captures d'écran, mais que nous pouvons également appeler **Hash NTLMv2**. 

[![Relai NTLM - Response](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing_pcap_response_2.png)](/assets/uploads/2020/03/ntlm_relay_example_smb_smb_no_signing_pcap.png)

Nous voyons bien que l'attaquant a joué le rôle de relai dans cet échange. Il n'a fait que passer les informations du client vers le serveur et vice versa, sauf qu'in fine, le serveur pense que l'attaquant s'est authentifié avec succès, et l'attaquant peut alors effectuer des actions sur le serveur en se faisant passer pour **ADSEC\jsnow**.

## Authentification vs Session

Maintenant que nous avons compris le principe de base du relai NTLM, la question qui se pose est de savoir comment, concrètement, est-ce qu'on peut effectuer des actions sur un serveur après avoir relayé l'authentification NTLM ? D'ailleurs, qu'entend-on par "actions" ? Qu'est-il possible de faire ?

Pour répondre à cette question, il faut d'abord éclaircir une chose fondamentale. Lorsqu'un client s'authentifie auprès d'un serveur pour y faire *quelque chose*, nous devons distinguer deux choses

1. **L'authentification**, permettant au serveur de vérifier que le client est bien qui il prétend être.
2. **La session**, durant laquelle le client va pouvoir faire des *actions*.

Ainsi, si le client s'est correctement authentifié, il pourra alors accéder aux ressources proposées par le serveur, telles que les partages réseau, l'accès à un annuaire LDAP, un serveur HTTP ou encore une base de données SQL. Cette liste n'est évidemment pas exhaustive.

Pour gérer ces deux étapes, il faut que le protocole utilisé puisse encapsuler l'authentification, donc l'échange des messages NTLM.

[![NTLM encapsulé](/assets/uploads/2020/03/ntlm_smb.png)](/assets/uploads/2020/03/ntlm_smb.png)

Bien entendu, si tous les protocoles devaient intégrer le fonctionnement de NTLM, ça deviendrait rapidement un joyeux bazar. C'est pourquoi Microsoft met à disposition une interface sur laquelle il est possible de se reposer pour gérer l'authentification, et des paquets ont été spécialement développés pour gérer différents types d'authentification.

### SSPI & NTLMSSP

L'interface SSPI, ou *Security Support Provider Interface*, est une interface proposée par Microsoft permettant d'uniformiser l'authentification, quel que soit le type d'authentification utilisé. Différents paquets peuvent se brancher sur cette interface afin de gérer différents types d'authentification.

Dans notre cas, c'est le paquet NTLMSSP (*NTLM Security Support Provider*) qui nous intéresse, mais il y a également un paquet pour l'authentification Kerberos, par exemple.

Sans rentrer dans les détails, l'interface SSPI met à disposition plusieurs fonctions, dont `AcquireCredentialsHandle`, `InitializeSecurityContext` et `AcceptSecurityContext`.

Lors d'une authentification NTLM, le client et le serveur vont faire appel à ces différentes fonctions. Les étapes ne sont décrites que succintement ici.

1. Le client appelle `AcquireCredentialsHandle` afin d'avoir accès indirectement aux identifiants de l'utilisateur.
2. Le client appelle ensuite `InitializeSecurityContext`, fonction qui, appelée pour la première fois, créera un message de type 1, donc de type **NEGOTIATE**. Nous le savons puisque nous nous intéressons à NTLM, mais pour un programmeur, peu importe ce qu'est ce message. Tout ce qui compte est de l'envoyer au serveur.
3. Le serveur, en recevant le message, appelle la fonction `AcceptSecurityContext`. Cette fonction créera alors le message de type 2, c'est à dire le **CHALLENGE**.
4. En recevant ce message, le client appellera de nouveau `InitializeSecurityContext` mais cette fois en passant le **CHALLENGE** en argument. Le paquet NTLMSSP s'occupe de tout pour calculer la réponse en chiffrant le défi, et produira le dernier message **AUTHENTICATE**.
5. En recevant ce dernier message, le serveur fait également de nouveau appel à `AcceptSecurityContext`, et la vérification de l'authentification sera effectuée automatiquement.

[![NTLMSSP](/assets/uploads/2020/03/ntlm_ssp.png)](/assets/uploads/2020/03/ntlm_ssp.png)

La raison pour laquelle ces étapes sont expliquées, c'est pour montrer qu'en réalité, du point de vue du client ou du serveur, **la structure des 3 messages qui sont échangés n'a pas d'importance**. Nous savons, nous, avec les connaissances du protocole NTLM, à quoi correspondent ces messages, mais le client comme le serveur n'en ont rien à faire. Ces messages sont d'ailleurs décrits dans la documentation Microsoft comme **des jetons opaques**, ou *opaque tokens*.

Cela signifie que ces 5 étapes sont totalement indépendantes du type de client, ou du type de serveur. Elles fonctionnent quel que soit le protocole utilisé pourvu que le protocole ait quelque chose de prévu pour permettre d'échanger d'une manière ou d'une autre cette structure opaque du client vers le serveur.

[![NTLMSSP Opaque](/assets/uploads/2020/03/ntlm_ssp_opaque.png)](/assets/uploads/2020/03/ntlm_ssp_opaque.png)


Les protocoles se sont donc adaptés pour trouver un moyen de caler une structure NTLMSSP, Kerberos, ou autre, dans un champ précis, et si le client ou le serveur voit qu'il y a de la donnée dans ce champ, il ne fait que la passer à `InitializeSecurityContext` ou `AcceptSecurityContext`.

Ce point est assez important, puisqu'il montre clairement que la couche applicative (HTTP, SMB, SQL, ...) est complètement indépendante de la couche d'authentification (NTLM, Kerberos, ...). Par conséquent, il faut des mesures de sécurité **et** pour la couche d'authentification, **et** pour la couche applicative.

Pour mieux comprendre, nous allons voir les deux exemples de protocoles applicatifs **SMB** et **HTTP**. Il est assez facile de trouver de la documentation pour les autres protocoles, c'est un peu toujours le même principe.

### Intégration avec HTTP

Voilà à quoi ressemble une requête HTTP basique.

```
GET /index.html HTTP/1.1
Host: beta.hackndo.com
User-Agent: Mozilla/5.0
Accept: text/html
Accept-Language: fr
```

Les éléments obligatoires dans cet exemple sont les suivants : le verbe HTTP (**GET**), la page demandée (**index.html**), la version du protocole (**HTTP/1.1**), ou l’en-tête **Host** (beta.hackndo.com).

Mais il est tout à fait possible d'ajouter d'autres en-têtes arbitraires. Au mieux, le serveur distant est au courant que ces en-têtes seront présents, et il saura les gérer, et au pire il les ignorera. On peut ainsi avoir la même requête avec quelques informations en plus.

```
GET /index.html HTTP/1.1
Host: beta.hackndo.com
User-Agent: Mozilla/5.0
Accept: text/html
Accept-Language: fr
X-Name: pixis
Favorite-Food: Beer 'coz yes, beer is food
```

C'est cette fonctionnalité qui est utilisée pour pouvoir transférer des messages NTLM du client vers le serveur. Il a été décidé que le client envoie ses messages dans un en-tête appelé `Authorization` et le serveur dans un en-tête appelé `WWW-Authenticate`. Si jamais un client tente d'accéder à un site internet demandant une authentification, le serveur va répondre en ajoutant l'en-tête `WWW-Authenticate`, et en mettant comme valeur les différents mécanismes d'authentification qu'il supporte. Pour NTLM, il indiquera tout simplement `NTLM`.

Le client sachant qu'une authentification NTLM est nécessaire, va envoyer le premier message dans l'en-tête `Authorization`, encodé en base 64 car le message ne contient pas que des caractères imprimables. Le serveur répondra avec un challenge dans l'en-tête `WWW-Authenticate`, le client calculera la réponse qu'il enverra dans `Authorization` et si l'authentification est acceptée, le serveur renverra un code de retour **200** indiquant que tout s'est correctement déroulé.

```
>    GET /index.html HTTP/1.1
>    Host: beta.hackndo.com
>    User-Agent: Mozilla/5.0
>    Accept: text/html
>    Accept-Language: fr

  <    HTTP/1.1 401 Unauthorized
  < => WWW-Authenticate: NTLM
  <    Content-type: text/html
  <    Content-Length: 0

>    GET /index.html HTTP/1.1
>    Host: beta.hackndo.com
>    User-Agent: Mozilla/5.0
>    Accept: text/html
>    Accept-Language: fr
> => Authorization: NTLM <NEGOCIATE en base 64>

  <    HTTP/1.1 401 Unauthorized
  < => WWW-Authenticate: NTLM <CHALLENGE en base 64>
  <    Content-type: text/html
  <    Content-Length: 0

>    GET /index.html HTTP/1.1
>    Host: beta.hackndo.com
>    User-Agent: Mozilla/5.0
>    Accept: text/html
>    Accept-Language: fr
> => Authorization: NTLM <RESPONSE en base 64>

  <    HTTP/1.1 200 OK
  < => WWW-Authenticate: NTLM
  <    Content-type: text/html
  <    Content-Length: 0
  <    Connection: close
```

Tant que la session TCP est ouverte, l'authentification sera effective. Dès que la session se termine, en revanche, le serveur n'aura plus le contexte de sécurité du client, et une nouvelle authentification devra avoir lieu. Ca peut souvent arriver, et grâce aux mécanismes de SSO (*Single Sign On*) de Microsoft, c'est souvent transparent pour l'utilisateur.

### Intégration avec SMB

Prenons un autre exemple fréquemment rencontré en entreprise. C’est le protocole SMB, utilisé pour accéder à des partages réseau, mais pas que.

Le protocole SMB fonctionne en utilisant des commandes. Elles sont [documentées par Microsoft](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cifs/5cd5747f-fe0b-40a6-89d0-d67f751f8232), il en existe un grand nombre. On peut noter par exemple `SMB_COM_OPEN`, `SMB_COM_CLOSE` ou `SMB_COM_READ`, des commandes permettant d'ouvrir, fermer ou lire un fichier.

Et bien SMB possède également une commande dédiée à la configuration d'une session SMB, et cette commande est `SMB_COM_SESSION_SETUP_ANDX`. [Deux champs sont dédiés](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-cifs/3a3cdd47-5b43-4276-91f5-645b82b0938f) au contenu des messages NTLM dans cette commande.

* Authentification LM/LMv2 : OEMPassword
* Authentification NTLM/NTLMv2 : UnicodePassword

Ce qu'il faut retenir, c'est qu'il existe une commande SMB spécifique possédant un espace dédié aux différents messages échangés lors d'une authentification NTLM.

Voici un exemple de packet SMB contenant la réponse d'un serveur à une authentification.

[![NTLM dans un packet SMB](/assets/uploads/2020/03/ntlm_smb_pcap_example.png)](/assets/uploads/2020/03/ntlm_smb_pcap_example.png)
HKEY_LOCAL_MACHINE\System\CurrentControlSet\Services\LanmanServer\Parameters

Ces deux exemples montrent bien que le contenu des messages NTLM est indépendant du protocole. Il peut être inclus dans n'importe quel protocole qui le supporte.

Il est alors très important de bien distinguer la partie authentification, donc les échanges NTLM, de la partie applicative, ou la partie session, qui est la suite des échanges via le protocole utilisé une fois que le client est authentifié. Ca peut donc être la navigation sur le site internet via HTTP ou des manipulations de fichiers sur un partage réseau si on utilise SMB.

[![Authentification vs Session](/assets/uploads/2020/03/ntlm_auth_vs_session.png)](/assets/uploads/2020/03/ntlm_auth_vs_session.png)

Comme ces informations sont indépendantes, cela signifie qu'un attaquant en situation d'homme du milieu peut très bien recevoir une authentification via HTTP, par exemple, et la relayer vers un serveur mais en utilisant SMB. C'est ce qu'on appelle du **relai cross-protocole**.

[![Cross protocole](/assets/uploads/2020/03/ntlm_relay_cross_protocol.png)](/assets/uploads/2020/03/ntlm_relay_cross_protocol.png)


En ayant tous ces aspects en tête, les chapitres suivants vont mettre en lumière les différentes faiblesses existantes ou ayant existé, et les mécanismes de sécurité qui entrent en jeu pour les combler.

## Signature de la session

### Principe

Une signature, c'est un mécanisme qui permet d'authentifier celui qui envoie un élément, et de garantir que cet élément n'a pas été modifié entre l'envoi et la réception. Par exemple, si l'utilisateur `jdoe` envoie le texte `I love hackndo`, et signe numériquement ce document, alors quiconque recevra ce document et sa signature pourra vérifier que c'est bien `jdoe` qui l'a édité, et sera assuré qu'il a bien écrit cette phrase, et pas une autre, puisque la signature garantit que le document n'a pas été modifié.

Le principe de signature peut être appliqué à n'importe quel échange, pour peu que le protocole le supporte. C'est par exemple le cas de [SMB](https://support.microsoft.com/en-us/help/887429/overview-of-server-message-block-signing), [LDAP](https://support.microsoft.com/en-us/help/4520412/2020-ldap-channel-binding-and-ldap-signing-requirements-for-windows) et même de [HTTP](https://tools.ietf.org/id/draft-cavage-http-signatures-08.html). En pratique, la signature des flux HTTP est rarement mise en place.

[![Signature d'un paquet de session](/assets/uploads/2020/03/ntlm_session_signing.png)](/assets/uploads/2020/03/ntlm_session_signing.png)


Mais du coup, c'est quoi l'intérêt de signer des paquets ? Et bien comme discuté précédemment, la session et l'authentification sont deux étapes distinctes lorsqu'un client veut utiliser un service. Etant donné qu'un attaquant peut se placer en homme du milieu, et relayer les messages d'authentification, il peut se faire passer pour le client auprès du serveur.

C'est là que la signature des flux entre en jeu. Même si l'attaquant a réussi à s'authentifier auprès du serveur en tant que le client, il ne sera pas en mesure, **ensuite**, **indépendamment de l'authentification**, de signer les paquets. En effet, pour pouvoir signer un paquet, il faut **avoir connaissance du secret** du signataire.

Or dans le relai NTLM, l'attaquant **veut se faire passer pour un client**, mais il n'a **pas connaissance de son secret**. Il n'est donc pas en mesure de signer quoi que ce soit au nom du client. Comme il ne peut pas signer le paquet, le serveur recevant le paquet va soit voir que la signature n'est pas présente, soit qu'elle n'existe pas, et rejettera la demande de l'attaquant.

[![Absence de signature d'un paquet de session après relai NTLM](/assets/uploads/2020/03/ntlm_session_signing_failed.png)](/assets/uploads/2020/03/ntlm_session_signing_failed.png)

Vous le comprenez donc bien, si les paquets doivent nécessairement être signés après l'authentification, alors l'attaquant ne peut plus opérer, puisqu'il n'a pas connaissance du secret du client. L'attaque échouera donc. C'est une mesure très efficace pour se protéger du relai NTLM.

C'est très bien tout ça, mais comment est-ce que le client et le serveur se mettent d'accord sur le fait de signer ou non les paquets ? Et bien c'est une très bonne question. Oui, je sais, c'est moi qui la pose, mais ça n'enlève rien à sa pertinence.

Pour cela, deux éléments entrent en jeu. 

1. Le premier permet d'indiquer si la signature des flux est **supportée**. Cela est fait lors de la négociation NTLM.
2. Le deuxième permet d'indiquer si la signature des flux sera effectivement **mise en place** obligatoirement, optionnellement, ou pas du tout. C'est un réglage qui se fait au niveau du client et du serveur.

### Négociation

Cette négociation permet de savoir si le client et/ou le serveur supportent la signature des flux (mais pas que), et se fait pendant l'échange NTLM. Donc je vous ai un peu menti tout à l'heure, les deux échanges ne sont pas complètement indépendants. (D'ailleurs, j'ai dit que comme c'était indépendant, on pouvait changer de protocole entre le client et le serveur, mais il y a des limites, nous les verrons dans le chapitre sur le MIC dans l'authentification NTLM.)

En fait, dans les messages NTLM, il y a d'autres autres informations que le challenge et la réponse qui sont échangées. Il y a également des drapeaux de négociation, ou *Negotiate Flags*. Ces drapeaux indiquent ce que supporte l'entité qui les envoie.

On trouve plusieurs drapeaux, mais celui qui nous intéresse ici c'est **NEGOTIATE_SIGN**.

[![NEGOTIATE_SIGN](/assets/uploads/2020/03/ntlm_negotiate_flags.png)](/assets/uploads/2020/03/ntlm_negotiate_flags.png)

Lorsque ce drapeau est mis à **1** par le client, cela signifie que le client **supporte** la signature des flux. Attention, ça ne veut pas dire qu'il **va forcément signer** ses flux. Juste qu'il en est capable. 

De même lors de la réponse du serveur, s'il supporte la signature des flux alors le drapeau sera également positionné à **1**.

Cette négociation permet donc à chacune des deux parties, client et serveur, d'indiquer à l'autre s'il est en mesure de signer les flux. Pour certains protocoles, même si le client et le serveur supportent la signature, ce n'est pas pour autant que forcément les flux seront signés.

### Implémentation

Maintenant qu'on a vu comment les deux parties indiquent à l'autre leur **capacité** à signer les flux, il faut qu'ils se mettent d'accord sur le fait de signer les flux. Cette fois-ci, cette décision est faite en fonction du protocole. Ca sera donc décidé d'une certaine manière pour SMBv1, d'une autre pour SMBv2, et d'une autre encore pour LDAP. Mais l'idée reste la même.

En fonction du protocole, il existe en général 2 voire 3 options pour savoir si les flux seront signés. Les 3 options sont :

* Désactivé : Cela signifie que la signature des flux n'est pas gérée.
* Activé : Cette option indique que la machine peut gérer les flux signés, mais elle ne requiert pas qu'ils le soient. 
* Obligatoire : Ceci indique enfin que la fonctionnalité de signature des flux est non seulement gérée, mais que les flux **doivent** être signés pour que la session continue.

Nous allons voir ici l'exemple de deux protocoles, SMB et LDAP.

### SMB

#### Matrice de signature 

Une matrice est fournie dans la [documentation Microsoft](https://docs.microsoft.com/fr-fr/archive/blogs/josebda/the-basics-of-smb-signing-covering-both-smb1-and-smb2) pour savoir si les flux SMB sont signés ou non en fonction des paramètres côté client et côté serveur. Je l'ai reprise dans ce tableau. Notez cependant que pour SMBv2 et supérieur, la signature est forcément gérée, le paramètre **Disabled** n'existe plus.

[![Table des signatures](/assets/uploads/2020/03/ntlm_signing_table.png)](/assets/uploads/2020/03/ntlm_signing_table.png)

On note une différence lorsque les deux parties sont en *Enabled*. En effet, en SMBv1, le paramètre par défaut pour les serveurs était *Disabled*. Ainsi, tout le traffic SMB entre les clients et les serveurs n'était pas signé. Ca permettait d'éviter de surchager les serveurs en leur évitant de calculer des signatures à chaque envoi de paquet SMB. Comme le statut *Disabled* n'existe plus pour SMBv2, et que les serveurs sont maintenant en *Enabled* par défaut, afin de garder ce gain de charge, le comportement entre deux parties *Enable* a été modifié, et la signature des flux n'est plus mise en place dans ce cas. Il faut nécessairement que le client et/ou le serveur requiert la signature pour que les flux SMB soient signés.

#### Paramétrage

Afin de paramétrer un serveur, il convient de modifier les clés `EnableSecuritySignature` et `RequireSecuritySignature` dans la ruche `HKEY_LOCAL_MACHINE\System\CurrentControlSet\Services\LanmanServer\Parameters`.

[![Signature SMB requise](/assets/uploads/2020/03/ntlm_sig_dc.png)](/assets/uploads/2020/03/ntlm_sig_dc.png)

Cette capture d'écran a été faite sur un contrôleur de domaine. Par défaut, les contrôleurs de domaine requièrent la signature des flux SMB quand un client s'authentifie auprès d'eux. En effet, la GPO appliquée aux contrôleurs de domaine contient cette entrée :

[![Signature SMB requise GPO](/assets/uploads/2020/03/ntlm_sig_dc_gpo.png)](/assets/uploads/2020/03/ntlm_sig_dc_gpo.png)

En revanche, on peut voir sur cette capture qu'au dessus, le même paramètre appliqué à **Microsoft network client** n'est pas appliqué. Donc lorsque le contrôleur de domaine agit en tant que serveur SMB, les flux doivent être signés, mais si une connexion provient **du** contrôleur de domaine **en direction** d'un serveur, cette signature n'est pas requise.

#### Mise en place

Maintenant que l'on sait où se configure la signature des flux SMB, on peut voir ce paramètre appliqué lors d'une connexion. Elle se fait juste avant l'authentification. En fait, lorsqu'un client se connecte au serveur SMB, les étapes sont les suivantes :

1. Négociation de la version de SMB et de la signature des flux
2. Authentification
3. Session SMB avec les paramètres négociés

Voici un exemple de négociation de la signature des flux :

[![Signature SMB enabled pcap](/assets/uploads/2020/03/ntlm_sig_pcap.png)](/assets/uploads/2020/03/ntlm_sig_pcap.png)

On voit une réponse d'un serveur indiquant qu'il possède le paramètre "Enable", mais qu'il ne requiert pas la signature des flux.


Pour résumer, voici comment se déroule une négociation puis une authentification puis une session :

[![Négociation authentification session](/assets/uploads/2020/03/ntlm_nego_vs_auth_vs_session.png)](/assets/uploads/2020/03/ntlm_nego_vs_auth_vs_session.png)

1. Dans la phase de négociation, les deux parties indiquent leurs prérequis : Est-ce que la signature est requise pour l'un des deux ?
2. Dans la phase d'authentification, les deux parties indiquent ce qu'ils supportent. Est-ce qu'il sont **capables** de signer les flux ?
3. Dans la phase de session, si les **capabilités** et les **prérequis** sont compatibles, la session s'effectue en appliquant ce qui a été négocié.

Par exemple si un client **DESKTOP01** veut communiquer avec un contrôleur de domaine **DC01**, **DESKTOP01** indique qu'il ne requiert pas de signature des flux, mais que cette fonctionnalité est activée.

[![Negociation DESKTOP01](/assets/uploads/2020/03/ntlm_ex1.png)](/assets/uploads/2020/03/ntlm_ex1.png)

**DC01** indique en retour que non seulement la fonctionnalité est activée, mais qu'il la requiert.

[![Negociation DC01](/assets/uploads/2020/03/ntlm_ex2.png)](/assets/uploads/2020/03/ntlm_ex2.png)

La phase d'authentification arrive, le client et le serveur mettent le drapeau `NEGOCIATE_SIGN` à **1** puisqu'ils supportent tous les deux la signature des flux.

[![NEGOTIATE_SIGN](/assets/uploads/2020/03/ntlm_negotiate_flags.png)](/assets/uploads/2020/03/ntlm_negotiate_flags.png)

Une fois cette authentification terminée, la session se poursuit, et les échanges SMB sont effectivement signés.

[![Session signing](/assets/uploads/2020/03/ntlm_ex3.png)](/assets/uploads/2020/03/ntlm_ex3.png)

### LDAP

#### Matrice de signature

Pour LDAP, il y a également trois niveaux :

* Désactivé (None) : Cela signifie que la signature des flux n'est pas gérée.
* Négociée (Negociated Signing) : Cette option indique que la machine peut gérer la signature des flux, et que si la machine avec qui elle communique la gère aussi, alors ils seront signés.
* Obligatoire (Required) : Ceci indique enfin que la fonctionnalité de signature des flux est non seulement gérée, mais que les flux **doivent** être signés pour que la session continue.

Comme vous pouvez le lire, le niveau intermédiaire, *Negociated Signing* diffère du cas SMBv2, car cette fois, si le client et le serveur sont en capacité de signer les flux, alors ils le feront. Tandis que pour SMBv2, les flux n'étaient signés **que** si l'un des deux étaient en niveau *Required*.

Nous avons donc pour LDAP une matrice ressemblant à celle de SMBv1, sauf pour les comportements par défaut.

[![Table des signatures LDAP](/assets/uploads/2020/03/ntlm_ldap_signing_table.png)](/assets/uploads/2020/03/ntlm_ldap_signing_table.png)

La différence avec SMB est que dans un domaine Active Directory, **toutes** les machines sont en *Negociated Signing*. Le contrôleur de domaine n'est pas en *Required*.

#### Paramétrage

Pour le **contrôleur de domaine**, la clé de registre `ldapserverintegrity` se trouve dans la ruche `HKEY_LOCAL_MACHINE\System\CurrentControlSet\Services\NTDS\Parameters` et peut valoir 0, 1 ou 2 en fonction du niveau. Elle est à **1** sur le contrôleur de domaine, par défaut.

[![Clé de registre serveurs](/assets/uploads/2020/03/ntlm_ldap_signing_registry_server.png)](/assets/uploads/2020/03/ntlm_ldap_signing_registry_server.png)

Pour les **clients**, cette clé se trouve dans la ruche `HKEY_LOCAL_MACHINE\System\CurrentControlSet\Services\ldap`

[![Clé de registre client](/assets/uploads/2020/03/ntlm_ldap_signing_registry_client.png)](/assets/uploads/2020/03/ntlm_ldap_signing_registry_client.png)

Elle est également à **1** pour les clients. Donc comme nous l'avons vu, comme tous les clients et les contrôleurs de domaine sont en *Negociated Signing*, **tous les flux LDAP sont signés par défaut**.

#### Mise en place

Contrairement à SMB, il n'y a pas de drapeau dans LDAP qui indique si les flux seront signés ou non. A la place, LDAP utilise les drapeaux positionné dans la négociation NTLM. En effet, il n'y a pas besoin d'avoir plus d'information. Dans le cas ou le client et le serveur supportent la signature LDAP, alors le drapeau `NEGOTIATE_SIGN` sera positionné et les flux seront signés.

Si une des deux parties requiert la signature des flux, et que l'autre ne la gère pas, alors tout simplement la session ne débutera pas. Celui qui requiert la signature des flux ignorera les paquets non signés.

Nous comprenons alors que, contrairement à SMB, si nous sommes entre un client et un serveur et que nous voulons relayer une authentification vers le serveur en utilisant LDAP, il faut deux choses :

1. Il faut que le serveur ne requiert pas la signature des flux, ce qui est le cas pour toutes les machines par défaut
2. Il faut que le client ne positionne pas le drapeau `NEGOTIATE_SIGN` à **1**. S'il le fait, alors la signature sera attendue par le serveur, et comme nous ne connaissons pas le secret du client, nous ne pourrons pas communiquer avec lui.

Pour le point **2**, il arrive que des clients ne positionnent pas ce drapeau, mais malheureusement, le client SMB de Windows le positionne ! Ainsi, en l'état, il n'est pas possible de relayer une authentification SMB vers du LDAP.

Et pourquoi pas seulement changer le drapeau `NEGOTIATE_FLAG` à la volée ? Et bien ... Les messages NTLM sont également signés. C'est ce que nous allons voir dans le prochain paragraphe.

## Signature de l'authentification (MIC)

Nous avons vu comment une session pouvait être protégée contre un attaquant en situation d'homme du milieu. Maintenant, pour comprendre l'intérêt de ce chapitre, intéressons-nous à un cas bien particulier.

### Cas limite

Imaginons qu'un attaquant arrive à se mettre en position d'homme du milieu entre un client et un contrôleur de domaine, et qu'il reçoive une demande d'authentification via SMB. Sachant qu'un contrôleur de domaine impose la signature des messages SMB, il n'est pas possible pour l'attaquant de relayer cette authentification via SMB. Il est en revanche possible de changer de protocole, comme nous l'avons vu plus haut, et l'attaquant décide de relayer vers le protocole **LDAPS**, puisque comme on l'a vu, les données d'authentification sont indépendantes du protocole utilisé.

[![Cross protocole LDAPS](/assets/uploads/2020/03/ntlm_relay_cross_protocol_ldaps.png)](/assets/uploads/2020/03/ntlm_relay_cross_protocol_ldaps.png)


Enfin, **presque** indépendantes.

**Presque**, parce que nous avons vu que dans les données d'authentification, il y avait le drapeau `NEGOTIATE_SIGN` qui était seulement présent pour indiquer si le client et le serveur supportaient la signature des flux. Et dans certains cas, ce drapeau est pris en compte, comme on l'a vu avec LDAP.

Et bien pour LDAPS, ce drapeau est également pris en compte par le serveur. Si un serveur reçoit une demande d'authentification avec le drapeau `NEGOTIATE_SIGN` positionné à **1**, il refuse d'authentifier le client. En effet, LDAPS c'est LDAP enrobé (oui j'aime le terme) de TLS, et c'est TLS qui gère la signature (et le chiffrement) des flux. Ainsi, un client LDAPS n'a aucune raison d'indiquer qu'il est en mesure de signer ses flux, et s'il prétend pouvoir le faire, le serveur lui rit au nez et claque la porte.

Or dans notre attaque, le client que nous relayons voulait s'authentifier via SMB, donc il indique que oui, il supporte la signature des flux, donc oui, il met le drapeau `NEGOTIATE_SIGN` à **1**. Mais si nous relayons son authentification, sans rien modifier, via LDAPS, et bien le serveur LDAPS va voir ce drapeau, et ne va pas nous autoriser à communiquer avec lui.

Comme proposé avec le relai de SMB vers LDAP, nous pourrions tout simplement modifier le message NTLM à la volée, et enlever le drapeau. Si nous le pouvions, nous le ferions, et effectivement, ça fonctionnerait bien. Sauf qu'il y a également une **signature au niveau NTLM**.

Cette signature, elle s'appelle le **MIC**, ou *Message Integrity Code*.

### Le MIC

Le MIC, c'est une signature qui est envoyée uniquement dans le dernier message d'une authentification NTLM, le message **AUTHENTICATE**. Elle prend en compte les 3 messages reçus. Le MIC est calculé avec la fonction **HMAC_MD5**, en utilisant comme clé un truc qui dépend du secret du client, appelé la **clé de session**.

```
HMAC_MD5(Clé de session, NEGOTIATE_MESSAGE + CHALLENGE_MESSAGE + AUTHENTICATE_MESSAGE)
```

Ce qui est important, c'est que la clé de session **dépend du secret du client**. Un attaquant ne peut donc pas re-calculer le MIC.

Voilà un exemple de MIC :

[![MIC NTLM](/assets/uploads/2020/03/ntlm_mic.png)](/assets/uploads/2020/03/ntlm_mic.png)

Du coup, si un seul des 3 messages a été modifié, le MIC ne sera plus valide, puisque la concaténation des 3 messages ne sera pas la même. On ne peut donc pas modifier le drapeau `NEGOTIATE_SIGN` à la volée, comme proposé dans notre exemple.

Et si on enlevait juste le MIC ? Parce que oui, le MIC est optionnel.

Non, ça ne marchera pas, car il y a un autre drapeau qui indique qu'un MIC sera présent, **msAvFlags**. Il est présent également dans la réponse et s'il indique **0x00000002**, cela signifie au serveur qu'un MIC **doit** être présent. Donc si le serveur ne voit pas le MIC, il saura qu'il y a baleine sous caillou, et il refusera l'authentification. Si le drapeau dit qu'il doit y avoir un MIC, il **doit** y avoir un MIC.

[![MIC AV NTLM](/assets/uploads/2020/03/ntlm_mic_av.png)](/assets/uploads/2020/03/ntlm_mic_av.png)

Très bien, et si jamais on change ce drapeau, on le met à **0**, et on enlève le MIC, il se passe quoi ? Comme il n'y a plus de MIC, on ne peut plus vérifier que le message a été modifié ?

...

Et bien, si. Il se trouve que le **hash NTLMv2**, qui est donc la réponse au challenge envoyé par le serveur, est un hash qui prend en compte non seulement le challenge (évidemment), mais également tous les drapeaux de la réponse. Et vous l'aurez deviné, le drapeau indiquant la présence d'un MIC fait partie de cette réponse.

Modifier ou retirer ce drapeau rendrait le **hash NTLMv2** invalide, puisque la donnée aura été modifiée. Ce schéma permet de représenter tout ça. 

[![MIC Protection](/assets/uploads/2020/03/ntlm_mic_protection.png)](/assets/uploads/2020/03/ntlm_mic_protection.png)

Le MIC protège l'intégrité des 3 messages, le drapeau msAvFlags protège la présence du MIC, et le hash NTLMv2 protège la présence du drapeau. L'attaquant, n'ayant pas connaissance du secret de l'utilisateur, ne peut pas recalculer ce hash.

Vous l'aurez donc compris, en l'état, nous ne pouvons rien faire dans ce cas là, et ça c'est grâce au MIC.

### Drop the MIC

Un petit retour sur une vulnérabilité récente trouvée par [Preempt](https://www.preempt.com) que vous comprendrez aisément maintenant.

C'est la [CVE-2019-1040](https://www.preempt.com/blog/drop-the-mic-cve-2019-1040/) joliement nommée **Drop the MIC**. Cette vulnérabilité montrait que dans le cas où on ne faisait que retirer le MIC, même si le drapeau indiquait sa présence, le serveur acceptait l'authentification sans broncher. C'était évidemment un bug qui a été corrigé depuis.

Elle a été intégrée dans l'outil [ntlmrelayx](https://github.com/SecureAuthCorp/impacket/blob/master/examples/ntlmrelayx.py) via l'utilisation du paramètre `--remove-mic`.

Reprenons alors notre exemple de tout à l'heure, mais cette fois avec un contrôleur de domaine encore vulnérable. Voilà ce que ça donne en pratique.

[![Drop the MIC](/assets/uploads/2020/03/ntlm_removemic.png)](/assets/uploads/2020/03/ntlm_removemic.png)

Notre attaque fonctionne. Amazing.

Pour information, une autre vunérabilité a été trouvée par la même équipe, et s'appelle logiquement [Drop The MIC 2](https://www.preempt.com/blog/drop-the-mic-2-active-directory-open-to-more-ntlm-attacks/)

## Clé de session

Depuis tout à l'heure, nous parlons de signature de la session ou de l'authentification, en disant que pour signer quelque chose, il faut avoir connaissance du secret de l'utilisateur. Nous avons indiqué dans le chapitre sur le MIC qu'en réalité, ce n'est pas exactement le secret de l'utilisateur qui est utilisé, mais une clé appelée **clé de session**, qui dépend directement du secret de l'utilisateur.

Pour vous donner une idée, voici comment est calculée la clé de session pour NTLMv1 et NTLMv2

```
# Pour NTLMv1
Clé = MD4(Hash NT)

# Pour NTLMv2
Hash NTLMv2 = HMAC_MD5(hash NT, Uppercase(Username) + UserDomain)
Clé = HMAC_MD5(Hash NTLMv2, HMAC_MD5(Hash NTLMv2, Réponse NTLMv2 + Challenge))
```

Rentrer dans les explications ne serait pas très utile, mais on voit clairement une différence de complexité d'une version à l'autre. Toute manière je le répète, **n'utilisez pas NTLMv1 dans un réseau de production**.

Avec ces informations, nous comprenons bien que le client peut calculer cette clé de son côté, puisqu'il a toutes les informations en main pour le faire.

Le serveur en revanche, ne peut pas toujours faire ça tout seul, comme un grand. Dans le cas d'une [authentification locale](https://beta.hackndo.com/pass-the-hash/#compte-local), il n'y a pas de problème puisque le serveur connait le hash NT de l'utilisateur.

En revanche lors d'une [authentification avec un compte de domaine](https://beta.hackndo.com/pass-the-hash/#compte-de-domaine), le serveur va devoir demander au contrôleur de domaine de calculer cette clé de session à sa place, et de la lui renvoyer. Nous avons vu dans l'article sur pass-the-hash que le serveur envoie une demande au contrôleur de domaine dans une structure [NETLOGON_NETWORK_INFO](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nrpc/e17b03b8-c1d2-43a1-98db-cf8d05b9c6a8) et que le contrôleur de domaine répond avec une structure [NETLOGON_VALIDATION_SAM_INFO4](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nrpc/bccfdba9-0c38-485e-b751-d4de1935781d). C'est dans cette réponse du contrôleur de domaine que se trouve la clé de session, en cas d'authentification réussie.

[![Session key](/assets/uploads/2020/03/ntlm_session_key_struct.png)](/assets/uploads/2020/03/ntlm_session_key_struct.png)

La question qui se pose alors, c'est de savoir ce qui empêche un attaquant de faire la même demande que le serveur cible auprès du contrôleur de domaine. Et bien avant la [CVE-2015-005](https://www.coresecurity.com/advisories/windows-pass-through-authentication-methods-improper-validation), rien ! 

> What we found while implementing the NETLOGON protocol [12] is the domain controller not verifying whether the authentication information being sent, was actually meant to the domain-joined machine that is requesting this operation (e.g. NetrLogonSamLogonWithFlags()). What this means is that **any domain-joined machine can verify any pass-through authentication against the domain controller**, and to get the base key for cryptographic operations for any session within the domain.

Donc évidemment, Microsoft a corrigé ce bug. Pour vérifier que seul le serveur sur lequel s'authentifie l'utilisateur a le droit de demander la clé de session, le contrôleur de domaine va vérifier que la machine cible présente dans la réponse `AUTHENTICATE` est la même que la machine effectuant la requête NetLogon.

Dans la réponse `AUTHENTICATE`, nous avons vu la présence d'un drapeau `msAvFlags` indiquant la présence ou non du MIC, mais il y a également d'autres informations, telle que le nom Netbios de la machine cible de l'authentification.

[![Computer name](/assets/uploads/2020/03/ntlm_computer_name.png)](/assets/uploads/2020/03/ntlm_computer_name.png)

C'est ce nom là qui est comparé avec la machine effectuant la requête NetLogon. Ainsi, si l'attaquant essaie de faire une requête NetLogon pour avoir la clé de session, le nom de l'attaquant ne correspondant pas au nom de la machine dans la réponse NTLM, le contrôleur de domaine va rejeter la demande.

[![NetLogon NTLM clé de session](/assets/uploads/2020/03/ntlm_netlogon_session_key.png)](/assets/uploads/2020/03/ntlm_netlogon_session_key.png)

Enfin, de la même manière que `msAvFlags`, nous ne pouvons pas modifier le nom de la machine à la volée dans la réponse NTLM, car il est pris en compte dans le calcul de la réponse NTLMv2.

Une vulnérabilité similaire à **Drop the MIC 2** a été découverte récemment par l'équipe de Preempt. Voici le [lien](https://www.preempt.com/blog/your-session-key-is-my-session-key-how-to-retrieve-the-session-key-for-any-authentication/) vers leur article si vous êtes curieux.

## Channel Binding

Nous allons parler d'une dernière notion. Plusieurs fois nous avons répété que la couche d'authentification, donc les messages NTLM, était quasi-indépendante de la couche applicative, du protocole utilisé (SMB, LDAP, ...). Je dis "quasi" parce que nous avons vu que certains protocoles utilisent les drapeaux des messages NTLM pour savoir si la session doit être signée ou non.

Quoiqu'il en soit, en l'état, il est tout à fait possible pour un attaquant de récupérer un message NTLM dans un protocole A, et de le renvoyer dans un protocole B. C'est le principe du **relai cross-protocole** que nous avons déjà évoqué.

[![Cross protocole](/assets/uploads/2020/03/ntlm_relay_cross_protocol.png)](/assets/uploads/2020/03/ntlm_relay_cross_protocol.png)

Et bien une nouvelle protection existe pour contrer cette attaque. C'est la protection appelée **channel binding**, ou liaison de canaux, en bon français. Le principe de cette protection, c'est de lier la couche authentification avec le protocole utilisé, voire avec la couche TLS dans laquelle tout est parfois encapsulé (LDAPS ou HTTPS par exemple). L'idée générale étant que dans le dernier message NTLM `AUTHENTICATE`, il y ait une information non modifiable par un attaquant qui indique le service souhaité, et potentiellement une autre information qui contienne une emprunte du certificat du serveur avec qui elle communique.

Nous allons voir ces deux principes un peu plus en détail, mais ne vous inquiétez pas, c'est relativement simple à comprendre.

### Liaison avec le service

Cette première protection est assez simple à comprendre. Si un client souhaite s'authentifier auprès d'un serveur pour utiliser un service spécifique, l'information identifiant le service sera ajoutée dans la reponse NTLM.

De cette manière, lorsque le serveur légitime reçoit cette authentification, il peut voir le service qui a été demandé par le client, et s'il diffère de ce qui est vraiment demandé, il n'accepte pas de fournir le service.

Le nom du service se trouvant dans la réponse NTLM, il est protégé par la réponse **NtProofStr** qui est un HMAC_MD5 de cette information, du challenge, et d'autres informations comme le **msAvFlags**. Elle est, je le rappelle, calculée avec le secret du client.

Dans l'exemple présenté dans le dernier schéma, nous voyons un client qui tente de s'authentifier via HTTP auprès du serveur. Sauf que le serveur, c'est un attaquant, et l'attaquant rejoue cette authentification auprès du serveur légitime, pour accéder non plus à un service web (via HTTP), mais un partage réseau (SMB).

Sauf que le client a indiqué le service qu'il souhaitait utiliser dans sa réponse NTLM, et comme l'attaquant ne peut pas le modifier, il est obligé de le relayer tel quel. Le serveur reçoit alors le dernier message, compare le service demandé demandé par l'attaquant avec le service renseigné dans le message NTLM, et refuse la connexion en s'apercevant que les deux services ne correspondent pas.

[![Cross protocole example](/assets/uploads/2020/03/ntlm_service_binding.png)](/assets/uploads/2020/03/ntlm_service_binding.png)

Concrètement, ce qu'on appelle **service**, c'est en fait le **SPN** ou **Service Principal Name** qui est renseigné dans le dernier message NTLM. J'ai consacré [un article entier](/service-principal-name-spn) à l'explication de cette notion, je vous invite à vous y réferrer si nécessaire.

Voilà une capture d'écran d'un client qui envoie le SPN dans sa réponse NTLM.

[![Service binding](/assets/uploads/2020/03/ntlm_service_binding_pcap.png)](/assets/uploads/2020/03/ntlm_service_binding_pcap.png)

Nous voyons qu'il indique bien vouloir utiliser le service **CIFS** (équivalent de SMB, juste une différentes terminologie). Relayer ça vers un serveur LDAP qui prend en compte cette information résultera en un beau refus de la part du serveur.

Mais comme vous pouvez le voir, il n'y a pas que le nom du service dans le SPN (CIFS). Il y a également la cible de l'authentification, ici l'adresse IP de l'attaquant. Cela implique que si un attaquant relaie ce message à un serveur, et que le serveur vérifie le SPN, il verra qu'il n'est pas destination indiquée dans le SPN et refusera la connexion.

Ainsi, cette protection, si supportée par tous les clients et serveurs, et si requise pour tous les serveurs, protège de tout relai NTLM.

### Liaison avec la couche TLS

Cette fois-ci, cette protection a pour but de lier la couche d'authentification, donc toujours les messages NTLM, à la couche TLS qui peut potentiellement être utilisée.

Si le client souhaite utiliser un protocole encapsulé dans TLS (HTTPS, LDAPS par exemple), il va établir une session TLS avec le serveur, et il va créer un condensat du certificat du serveur qu'il va mettre dans sa réponse NTLM. Ce condensat est appéle **Channel Binding Token**, ou CBT. Le serveur légitime va alors recevoir le message NTLM à la fin de l'authentification, lire le condensat indiqué dans la réponse, et le comparer avec le vrai condensat de son certificat. S'il est différent, c'est qu'il n'est pas le destinataire original de cet 
échange.

Encore une fois, ce condensat se trouvant dans la réponse NTLM, il est protégé par la réponse **NtProofStr**, comme pour le **SPN** du **Service Binding**.

De cette manière, les deux attaques suivantes ne sont plus possibles :

1. Si un attaquant souhaite relayer une information d'un client utilisant un protocole sans couche TLS vers un protocole avec couche TLS (HTTP vers LDAPS, par exemple), l'attaquant ne sera pas en mesure d'ajouter le condensat du certificat du serveur cible dans la réponse NTLM, puisqu'il ne peut pas la recalculer.
2. Si un attaquant souhaite relayer un protocole avec TLS vers un autre protocole avec TLS, lors de l'établissement de la session TLS entre le client et lui, il ne pourra pas fournir le certificat du serveur, puisqu'il ne correspond pas à l'identité de l'attaquant. Il devra donc fournir un certificat "maison", identifiant l'attaquant. Le client va alors faire un condensat de ce certificat, et lorsque l'attaquant relaiera la réponse NTLM au serveur légitime, le condensat dans la réponse ne sera pas le même que le condensat du vrai certificat, donc le serveur rejettera la connexion.

Voilà un schéma un peu barbu pour représenter le 2ème cas.

[![Channel binding](/assets/uploads/2020/03/ntlm_channel_binding_tls.png)](/assets/uploads/2020/03/ntlm_channel_binding_tls.png)

Il montre l'établissement de deux sessions TLS. L'une entre le client et l'attaquant (en rouge) et une entre l'attaquant et le serveur (en bleu). Le client va récupérer le certificat de l'attaquant, et en calculer un condensat, **cert hash**, en rouge.

A la fin des échanges NTLM, ce condensat sera mis dans la réponse NTLM, et sera protégée puisqu'il fait partie de la donnée chiffrée de la réponse NTLM. Quand le serveur recevra ce condensat, il va calculer le condensat de son propre certificat, et en voyant que ce n'est pas le même, il refusera la connexion.

Encore une fois, Preempt a récemment [trouvé une vulnérabilité](https://www.preempt.com/blog/how-to-easily-bypass-epa-to-compromise-any-web-server-that-supports-windows-integrated-authentication/) qui a depuis été corrigée à ce sujet.


## Que peut-on relayer ?

Avec toutes ces informations, vous devriez être capables de savoir les quels protocoles peuvent être relayés vers quels protocoles. Nous avons vu qu'il était impossible de relayer du SMB vers du LDAP ou du LDAPS, par exemple. En revanche, tout client qui ne positionne pas le drapeau `NEGOTIATE_SIGN` peut être relayé vers LDAP si la signature n'est pas imposée, ou LDAPS si le channel binding n'est pas requis.

Comme il existe beaucoup de cas, voici un tableau qui en résume certains.

[![Résumé du relai NTLM](/assets/uploads/2020/03/ntlm_resume.png)](/assets/uploads/2020/03/ntlm_resume.png)

Concernant LDAPS ou HTTPS en client, je les ai mis dans le tableau, sous réserve que la CA qui a généré le certificat de l'attaquant soit acceptée par le client. Par ailleurs, d'autres protocoles pourraient être ajoutés, comme SQL ou SMTP, mais j'avoue ne pas avoir lu la documentations de tous les protocoles de la planète.

## Bannir. NTLMv1.

J'ajoute un petit fun fact que m'a suggéré d'ajouter [Marina Simakov](https://twitter.com/simakov_marina), c'est que comme on l'a vu, le hash NTLMv2 d'un client prend en compte le challenge du serveur, mais aussi notamment le drapeau `msAvFlags` qui indique la présence ou non d'un MIC, ou le champ indiquant le nom de la machine cible lors de l'authentification, ou encore le SPN ou le CBT pour le channel binding.

Et bien le protocole NTLMv1 ne fait pas ça. Il ne prend en compte que le challenge du serveur. En fait, il n'y a plus les informations complémentaires comme le nom de la cible, le drapeau `msAvFlags`, le SPN ou le CBT.

Ainsi, si une authentification NTLMv1 est autorisée par un serveur, l'attaquant peut simplement enlever le MIC et ainsi relayer des authentifications vers LDAP ou LDAPS, par exemple. Mais il peut aussi (et surtout) effectuer des requêtes NetLogon pour récupérer la clé de session. En effet, le contrôleur de domaine n'a aucun moyen de vérifier si l'attaquant a le droit, ou non, de faire cette demande. Et comme il ne va pas bloquer un parc de production qui ne serait pas complètement à jour, et bien il va gentiment la donner, pour des "raisons de rétro-compatibilité".

Une fois en possession de la clé de session, l'attaquant peut alors signer tous les paquets qu'il souhaite. Ainsi, il peut même discuter avec les machines qui requièrent la signature des flux.

C'est le comportement "by design" donc ça ne peut pas être corrigé. Donc je le répète, **n'autorisez pas NTLMv1 dans un réseau de production**.

## Conclusion

Et bien, ça fait beaucoup d'informations à digérer.

Nous avons vu ici le **fonctionnement du relai NTLM**, en prenant bien conscience que l'authentification et la session qui s'en suit sont deux notions distinctes permettant de faire du **relai cross-protocole** dans beaucoup de cas. Bien que le protocole englobe d'une manière ou d'une autre les données d'authentification, elles sont pour lui opaques, et gérées par SSPI.

Nous avons également montré en quoi la **signature des flux** pouvait protéger le serveur d'attaques de type homme du milieu. Pour cela, la cible doit attendre une signature des flux de la part du client, sinon l'attaquant pourra se faire passer pour quelqu'un d'autre sans avoir à signer les messages qu'il envoie. 

Nous avons vu que le MIC était très important pour protéger les échanges NTLM, notamment le drapeau indiquant si les flux seront signés pour certains protocoles, ou les informations sur le channel binding.

Nous avons d'ailleurs terminé en montrant comment le channel binding permettait de faire le lien entre la couche d'authentification et la couche de session, soit via le nom du service, soit via une liaison avec le certificat du serveur.

J'espère que ce long article vous a permis de mieux comprendre ce qu'il se passait lors d'une attaque de relai NTLM. Vous comprenez j'espère mieux les briques qui entrent en jeu, et les protections existantes.

Cet article étant assez conséquent, il est tout à fait probable que des coquilles se soient glissées à l'intérieur. N'hésitez pas à me contacter sur [twitter](https://twitter.com/hackanddo) ou sur mon [serveur Discord](https://discord.gg/NyjPhRb) pour discuter de tout ça.
