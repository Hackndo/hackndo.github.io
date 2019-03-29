---
title: "Délégation Kerberos - Fonctionnement"
date: 2019-03-29 12:17:22
author: "Pixis"
layout: post
permalink: /constrained-unconstrained-delegation/
disqus_identifier: 0000-0000-0000-00ab
cover: assets/uploads/2019/02/impersonation.png
description: "Au sein d'un Active Directory, des services peuvent être utilisés par des utilisateurs. Il arrive parfois que ces services doivent en contacter d'autres, au nom de l'utilisateur, comme un service web pourrait avoir besoin de contacter un serveur de fichiers. Afin d'autoriser un service à accéder à un autre service au nom de l'utilisateur, une solution a été mise en place : La délégation Kerberos."
tags:
  - "Active Directory"
  - Windows
---

Au sein d'un Active Directory, des services peuvent être utilisés par des utilisateurs. Il arrive parfois que ces services doivent en contacter d'autres, au nom de l'utilisateur, comme un service web pourrait avoir besoin de contacter un serveur de fichiers. Afin d'autoriser un service à accéder à un autre service **au nom de l'utilisateur**, une solution a été mise en place (introduite à partir de Windows Server 2000) pour répondre à ce besoin : **La délégation Kerberos.**

<!--more-->

## Principe de la délégation

Pour comprendre le principe de la délégation Kerberos, prenons un exemple concret. Une machine héberge un service Web qui, via une jolie interface, permet à un utilisateur d'accéder à son dossier personnel, hébergé sur un serveur de fichiers. Nous sommes donc dans la situation suivante :

[![Etat actuel](/assets/uploads/2019/02/webfsuser.png)](/assets/uploads/2019/02/webfsuser.png)

Le serveur Web est en frontal, et c'est lui qui va chercher les informations à la place de l'utilisateur sur le serveur de fichiers afin d'afficher le contenu d'un dossier, par exemple.

Cependant, le serveur web ne sait pas ce qui appartient à l'utilisateur sur le serveur de fichiers. Ce n'est pas son rôle à lui de décortiquer le [PAC](/silver-golden-ticket/#pac) de l'utilisateur pour faire une demande spécifique au serveur de fichiers. C'est là qu'entre en jeu la **délégation**. Ce mécanisme permet au serveur web de prendre la place de l'utilisateur, et de s'authentifier au nom de celui-ci auprès du serveur de fichiers. Ainsi, du point de vue du serveur de fichiers, c'est l'utilisateur qui fait la demande, et le serveur de fichiers va pouvoir vérifier les droits de cet utilisateur, puis renvoyer les informations auxquelles ce compte a accès. C'est de cette manière que le serveur web peut ensuite afficher ces informations dans une jolie interface.

[![Impersonation](/assets/uploads/2019/02/impersonation.png)](/assets/uploads/2019/02/impersonation.png)

## Constrained & Unconstrained Delegation

La possibilité de relayer des identifiants peut être donnée à une machine ou un utilisateur de service, c'est à dire qui possède au moins un attibut [SPN](/service-principal-name-spn).

Il existe aujourd'hui trois manières d'autoriser une machine ou un compte de service de prendre la place d'un utilisateur pour communiquer avec un ou plusieurs autre(s) service(s) : La **Unconstrained Delegation**, la **Constrained Delegation** et la **Resource Based Constrained Delegation**.

### Kerberos Unconstrained Delegation - KUD

Dans le cas d'une **Unconstrained Delegation** (KUD), le serveur ou le compte de service qui se voit attribuer ce droit est en mesure de se faire passer pour l'utilisateur pour communiquer avec **n'importe quel service** sur **n'importe quelle machine**.

C'est historiquement le seul choix qu'il y avait lors de l'instauration du principe de délégation, mais il a été complété par le principe de la **Constrained Delegation**.

[![Unconstrained Delegation](/assets/uploads/2019/02/unconstrained_delegation_schema.png)](/assets/uploads/2019/02/unconstrained_delegation_schema.png)


Voici un exemple, dans mon lab, d'une machine qui est en **Unconstrained Delegation** :

[![Unconstrained Delegation](/assets/uploads/2019/02/unconstrained_delegation.png)](/assets/uploads/2019/02/unconstrained_delegation.png)

### Kerberos Constrained Delegation - KCD

Si une machine ou un compte de service possède le flag **Constrained Delegation** (KCD), alors une liste de services autorisés sera associée à ce droit. Par exemple, dans le cas du serveur web de l'introduction, la machine hébergeant le serveur web aura le drapeau **KCD** avec comme précision que ce serveur ne peut relayer les informations de l'utilisateur qu'au service `CIFS` du serveur `SERVEUR01`.

[![Constrained Delegation](/assets/uploads/2019/02/constrained_delegation_schema.png)](/assets/uploads/2019/02/constrained_delegation_schema.png)

C'est donc le serveur relayant les informations de l'utilisateur qui possède l'information des services ([SPN](/service-principal-name-spn)) autorisés.

En d'autres termes, le serveur en frontal va dire "je suis autorisé à m'authentifier en tant que l'utilisateur auprès de cette liste de [SPN](/service-principal-name-spn) : [...]".

Dans mon lab, le serveur web est `WEB-SERVER-01` et celui qui possède le partage de fichiers est `WEB-SERVER-02`. Voici donc à quoi ressemble la liste des services pour lesquels `WEB-SERVER-01` peut se faire passer pour l'utilisateur :

[![Delegation CIFS](/assets/uploads/2019/02/delegation_cifs.png)](/assets/uploads/2019/02/delegation_cifs.png)

**\<note\>**

De ma compréhension, le statut délégation ne peut être appliqué qu'à une machine ou un utilisateur de service (i.e. ayant au moins un attribut [SPN](/service-principal-name-spn)).
- Dans le premier cas (Machine), cela implique que **tous** les services hébergés sur la machine peuvent relayer les informations de l'utilisateur.
- Dans le deuxième cas (compte de service), cela veut dire que quel que soit le serveur sur lequel tournent les services exécutés par ce compte de service, ils -- ces services -- auront tous la possibilité de délégation.

Je trouve ce comportement étonnant, j'aurais pensé qu'il était possible de décider que seul un service précis sur une machine précise pouvait relayer les informations de l'utilisateur, mais il me semble, en l'état, que cette granularité n'existe pas.

Si ma compréhension est incorrecte, n'hésitez pas à me le remonter dans les commentaires ou sur [twitter](https://twitter.com/HackAndDo).

**\</note\>**

### Resource Based Kerberos Constrained Delegation - RBKCD

Enfin, nous avons le cas de la **Resource Based Constrained Delegation** (RBKCD). Apparue avec Windows Server 2012, cette solution permet de palier à quelques problèmes liés à la **KCD** (Responsabilité, délégation inter-domaines, ...). Sans trop aller dans les détails, la responsabilité de la délégation est déplacée. Alors que dans **KCD**, c'est au niveau du serveur qui délègue qu'on indique les [SPN](/service-principal-name-spn) autorisés, dans le cas du **RBKCD**, c'est au niveau des services finaux qu'on indique la liste des services qui peuvent communiquer avec eux via délégation. Ainsi, le schéma est le suivant :

[![Resource Based Constrained Delegation](/assets/uploads/2019/02/resource_based_constrained_delegation_schema.png)](/assets/uploads/2019/02/resource_based_constrained_delegation_schema.png)

La responsabilité est déplacée, c'est au niveau du serveur qui reçoit les connexions avec délégation que se trouve l'information de si oui ou non cette délégation est acceptée.

En d'autres termes, c'est le service final qui dit "j'autorise cette liste de compte [...] à s'authentifier chez moi au nom d'un utilisateur".

## Détails techniques

Maintenant que le principe est compris (du moins je l'espère), nous allons détailler un peu ce process. Concrètement, comment est-ce qu'une machine ou un compte peut se faire passer pour un utilisateur auprès d'un service ? C'est ce que nous allons voir maintenant. Les détails entre les différentes techniques sont relativement différents, c'est pourquoi chacune d'entre elle sera expliquée séparemment. Accrochez vous, *it's gonna get dirty*.

### Kerberos Unconstrained Delegation - KUD

Comme nous l'avons vu, dans ce cas, le serveur ou le compte de service peut s'authentifier au nom de l'utilisateur auprès de n'importe quel autre service. Pour que cela soit possible, il faut deux prérequis :

* Le premier est que le compte qui veut déléguer une authentification possède le drapeau `ADS_UF_TRUSTED_FOR_DELEGATION` présent dans [ADS_USER_FLAG_ENUM](https://docs.microsoft.com/en-us/windows/desktop/api/iads/ne-iads-ads_user_flag). Pour pouvoir changer cette information, il faut avoir le droit `SeEnableDelegationPrivilege` qui est la plupart du temps seulement existant pour les administrateurs de domaine. Voici comment ce drapeau est placé sur le compte (machine ou compte de service):

[![Unconstrained Delegation](/assets/uploads/2019/02/unconstrained_delegation.png)](/assets/uploads/2019/02/unconstrained_delegation.png)


* Le deuxième est que le compte utilisateur qui va être relayé soit effectivement "relayable". Pour cela, il **ne faut pas** faut que le drapeau [ADS_UF_NOT_DELEGATED](https://docs.microsoft.com/en-us/windows/desktop/api/iads/ne-iads-ads_user_flag) soit positionné. Par défaut, aucun compte de l'AD n'a ce drapeau de positionné, ils sont donc tous "relayables".

Concrètement, lors des échanges avec le contrôleur de domaine tels que décrits dans l'article [Kerberos en Active Directory](/kerberos), lorsque l'utilisateur fait une demande de TGS ([KRB_TGS_REQ](/kerberos/#krb_tgs_req)), il précisera le [SPN](/service-principal-name-spn) du service qu'il souhaite consommer. C'est à ce moment que le contrôleur de domaine va chercher les deux prérequis :

* Est-ce que le drapeau `ADS_UF_TRUSTED_FOR_DELEGATION` est positionné dans les attributs du compte associé au [SPN](/service-principal-name-spn) 
* Est-ce que le drapeau `ADS_UF_NOT_DELEGATED` n'est **pas** positionné pour l'utilisateur qui fait la demande

Si les deux prérequis sont vérifiés, alors le contrôleur de domaine va répondre à l'utilisateur avec un [KRB_TGS_REQ](/kerberos/#krb_tgs_req) contenant les informations classiques, mais il va également intégrer dans sa réponse **une copie du TGT** de l'utilisateur, ainsi qu'une nouvelle clé de session associée.

[![TGT Copy](/assets/uploads/2019/02/cop_tgt.png)](/assets/uploads/2019/02/cop_tgt.png)

Une fois en possession de ces éléments, l'utilisateur va continuer le processus classique en envoyant une requête auprès du service ([KRB_AP_REQ](/kerberos/#krb_ap_req)) en lui envoyant le TGS et un authentifiant. Le service va être en mesure de déchiffrer le contenu du TGS, vérifier l'identité de l'utilisateur en déchiffrant l'authentifiant, mais surtout il va pouvoir récupérer la copie du TGT ainsi que la clé de session associée pour, ensuite, se faire passer pour l'utilisateur auprès du contrôleur de domaine.

[![TGT Memory](/assets/uploads/2019/02/tgt_memory.png)](/assets/uploads/2019/02/tgt_memory.png)

En effet, maintenant en possession d'une copie du TGT de l'utilisateur ainsi que d'une clé de session valide, le service peut s'authentifier auprès de n'importe quel autre service au nom de l'utilisateur en faisant une demande de TGS au contrôleur de domaine, en lui fournissant ce TGT et en chiffrant un authentifiant avec la clé de session. C'est le principe de la **Unconstrained Delegation**.

Voici un schéma récapitulatif :

[![Unconstrained Delegation Detailed](/assets/uploads/2019/02/unconstrained_delegation_detailed.png)](/assets/uploads/2019/02/unconstrained_delegation_detailed.png)


### Kerberos Constrained Delegation

Pour la **Constrained Delegation**, une liste de [SPN](/service-principal-name-spn) ou de comptes autorisés sera fournie pour indiquer les services/comptes acceptés pour la délégation. De ce fait, le processus n'est pas le même. Le service concerné ne sera pas en possession du TGT de l'utilisateur, sinon il n'y a aucun moyen de contrôler les authentifications du service. Un mécanisme différent est utilisé.

Mettons nous dans le cas où l'utilisateur s'authentifie auprès du `Service A` puis que ce `Service A` doit s'authentifier auprès du `Service B` en tant que l'utilisateur.

L'utilisateur fait une requête de TGS, puis l'envoie au `Service A`. Ce service devant s'authentifier en tant que l'utilisateur auprès de `Service B`, il va demander un TGS au KDC au nom de l'utilisateur. Cette demande est régie par l'extension [S4U2Proxy](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-sfu/bde93b0e-f3c9-4ddf-9f44-e1453be7af5a). Pour indiquer au contrôleur de domaine qu'il veut s'authentifier au nom de quelqu'un d'autre, deux attributs seront définis dans la demande de ticket [KRB_TGS_REQ](/kerberos/#krb_tgs_req) :

* le champ `additional-tickets`, d'habitude vide, doit cette fois contenir le TGS de l'utilisateur en question (sous condition que le drapeau `ADS_UF_NOT_DELEGATED` ne soit **pas** positionné pour l'utilisateur qui fait la demande. Si c'était le cas, le TGS de l'utilisateur ne serait pas `forwardable`, et le contrôleur de domaine ne l'accepterait pas dans la suite du processus)
* Le drapeau [cname-in-addl-tkt](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-sfu/17b9af82-d45a-437d-a05c-79547fe969f5), qui doit être positionné pour indiquer au DC qu'il ne doit pas utiliser les informations du serveur, mais celle du ticket présent dans `additional-tickets`, c'est à dire les informations de l'utilisateur pour lequel le service veut se faire passer.

C'est lors de cette demande que le contrôleur de domaine, en voyant ces informations, va vérifier que `Service A` a le droit de s'authentifier auprès de `Service B` au nom de l'utilisateur.

#### Constrained Delegation - Classique

Dans le cas classique de **Constrained Delegation** (donc quand l'information est située au niveau de `Service A`), cette information est présente dans l'attribut [msDS-AllowedToDelegateTo](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-ada2/86261ca1-154c-41fb-8e5f-c6446e77daaa) **de l'objet (compte) demandeur**, donc de `Service A`, attribut qui spécifie la liste des [SPN](/service-principal-name-spn) autorisés pour la délégation. Par exemple ici l'attribut `msDS-AllowedToDelegateTo` contiendra `cifs/WEB-SERVER-02`.

[![Delegation CIFS](/assets/uploads/2019/02/delegation_cifs.png)](/assets/uploads/2019/02/delegation_cifs.png)

Si le [SPN](/service-principal-name-spn) cible est bien présent, alors le KDC renvoie un TGS valide, avec le nom de l'utilisateur, pour le service demandé. Voici un schéma récapitulatif :

[![Constrained Delegation Detailed](/assets/uploads/2019/02/constrained_delegation_schema_detailed.png)](/assets/uploads/2019/02/constrained_delegation_schema_detailed.png)


#### Constrained Delegation - Resource Based

Le KDC va cette fois aller voir les attributs de **Service B** (et non plus de `Service A`). Il va vérifier que le compte associé à `Service A` est bien présent dans l'attribut [msDS-AllowedToActOnBehalfOfOtherIdentity](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-ada2/cea4ac11-a4b2-4f2d-84cc-aebb4a4ad405) du compte lié à `Service B`.

[![Resource Based Constrained Delegation Detailed](/assets/uploads/2019/02/resource_based_constrained_delegation_schema_detailed.png)](/assets/uploads/2019/02/resource_based_constrained_delegation_schema_detailed.png)

Comme le montre le schéma, le fonctionnement technique est similaire, cependant les responsabilités de chaques entités sont radicalement différentes.

### Extension S4U2Self

Si vous êtes encore là et que vous avez bien suivi, vous aurez remarqué que nous n'avons pas abordé dans cet article la notion de transition de protocole. En effet, dans ce qui a été expliqué concernant la délégation contrainte, nous partions du principe que le `Service A` était en possession d'un ticket de service provenant de `USER`, ticket qui était ajouté dans le champ `additional-tickets` de la demande de TGS (**S4U2Proxy**). Mais il arrive que l'utilisateur s'authentifie auprès du serveur d'une autre manière que via le protocole Kerberos (par exemple via NTLM, ou même un formulaire web). Dans ce cas, le serveur n'est pas en possession d'un TGS envoyé par l'utilisateur. Ainsi, `Service A` ne peut pas, en l'état, remplir le champ `additional-tickets` comme il le faisait dans les cas précédemment décrits.

C'est pourquoi il y a une étape supplémentaire, possible grâce à l'extension [S4U2Self](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-sfu/02636893-7a1f-4357-af9a-b672e3e3de13), que `Service A` doit effectuer. Cette étape lui permet d'obtenir un TGS pour un utilisateur **choisi arbitrairement**. Pour cela, il effectue une demande de TGS classique ([KRB_TGS_REQ](/kerberos/#krb_tgs_req)) sauf qu'au lieu de mettre son nom à lui dans le bloc `PA-FOR-USER` (présent dans la partie préauthentification), il met le nom d'un utilisateur **qu'il choisit**.

Evidemment, on pourrait croire que c'est une capacité très puissante et dangereuse puisqu'en fait, pour tous services `S` et `T` pour lesquels il y aurait une délégation possible de `S` vers `T`, le `Service S` pourrait se faire passer pour n'importe quel utilisateur auprès de `Service T`. Heureusement, ce n'est pas le cas. En effet, si le drapeau [ADS_UF_TRUSTED_TO_AUTHENTICATE_FOR_DELEGATION](https://docs.microsoft.com/en-us/windows/desktop/api/iads/ne-iads-ads_user_flag) n'est pas positionné sur l'objet associé au `Service S`, alors le ticket qu'il récupèrera ne sera pas tranférable (*forwardable*) et ne pourra donc pas être utilisé pour une délégation contrainte (classique ou resource based).

Pour que le compte puisse avoir ce drapeau, il faut le préciser ici dans l'interface graphique :

[![Drapeau S4U2Self](/assets/uploads/2019/02/s4u2self_gui.png)](/assets/uploads/2019/02/s4u2self_gui.png)

Attention, le schéma récapitulatif se complique, mais j'espère qu'il reste relativement clair.

[![S4U2Self](/assets/uploads/2019/02/s4u2self.png)](/assets/uploads/2019/02/s4u2self.png)


D'expérience, il est rare de trouver des comptes au sein d'un domaine qui possèdent ce drapeau. Si cependant un compte de ce type est compromis, alors tous les services auxquels ce compte est en droit de s'authentifier via délégation seront également compromis, puisque l'attaquant peut créer des tickets de service au nom d'utilisateurs arbitraires, notamment des utilisateurs administrateurs des services ciblés.

## Conclusion

Je pensais faire un article qui allait décrire le principe de Constrained et Unconstrained Delegation ainsi que les attaques associées, cependant les explications sont beaucoup plus denses que prévues, ainsi cet article reste consacré à l'explication. Les attaques associées seront présentées dans d'autres articles, que je citerai ici, au fil de leurs sorties.

Si vous avez des questions ou remarques, n'hésitez pas, je suis tout ouïe.

## Ressources

Grands mercis à eux pour leurs explications claires.

* [S4U2Pwnage - Harmj0y](https://www.harmj0y.net/blog/activedirectory/s4u2pwnage/)
* [ADSecurity - Pyrotek3](http://adsecurity.org/)
* [Secrets d’authentification épisode II Kerberos contre-attaque - Aurélien Bordes](https://www.sstic.org/media/SSTIC2014/SSTIC-actes/secrets_dauthentification_pisode_ii__kerberos_cont/SSTIC2014-Article-secrets_dauthentification_pisode_ii__kerberos_contre-attaque-bordes_2.pdf)
* [Wagging the dog - Edla Shamir](https://shenaniganslabs.io/2019/01/28/Wagging-the-Dog.html)