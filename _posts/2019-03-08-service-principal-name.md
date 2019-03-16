---
title: "Service Principal Name (SPN)"
date: 2019-03-08 09:17:22
author: "Pixis"
layout: post
permalink: /service-principal-name-spn/
disqus_identifier: 0000-0000-0000-00a9
cover: assets/uploads/2019/02/spn.png
description: "Pour la suite des articles, la notion de SPN (Service Principal Name) va être abordée. Cet article permet de faire un point sur cette notion afin de comprendre ce que sont ces SPN, à quoi ils servent et comment ils sont utilisés."
tags:
  - "Active Directory"
  - Windows
---

Pour la suite des articles, la notion de SPN (Service Principal Name) va être abordée. Cet article permet de faire un point sur cette notion afin de comprendre ce que sont ces "SPN", à quoi ils servent et comment ils sont utilisés.

<!--more-->

## Qu'est-ce qu'un SPN

Nous nous plaçons dans un environnement Active Directory. Pour comprendre la notion de SPN, il faut comprendre ce qu'est la notion de service au sein d'un active directory.

Un service est en fait une fonctionnalité, un logiciel, quelque chose qui peut être utilisé par d'autres membres de l'AD (Active Directory). On peut avoir par exemple un serveur web, un partage réseau, un service DNS, un service d'impression, etc. Pour identifier un service, nous avons besoin de deux éléments à minima. Le même service peut tourner sur différentes machines, donc il faut spécifier **la machine**, et une machine peut héberger plusieurs services, donc il faut, évidemment, spécifier **le service**.

C'est en combinant ces informations que nous pouvons désigner un service de manière précise. Cette combinaison représente son **Service Principal Name**, ou **SPN**. Il se présente de la sorte :

```
classe_du_service/hostname_ou_FQDN
```

La classe du service est en fait un nom un peu générique qui correspond au service. Par exemple, tous les serveurs web sont regroupés dans la classe "www", les services SQL sont dans la classe "SqlServer" etc.

Si jamais le service présente un port particulier, ou si on veut le préciser pour éviter toute ambiguïté, il est possible de l'ajouter à la fin :

```
classe_du_service/hostname_ou_FQDN:port
```

Enfin, un nom peut être donné au SPN, mais c'est tout à fait arbitraire et optionnel.

```
classe_du_service/hostname_ou_FQDN:port/nom_arbitraire
```

Ainsi, dans mon Active Directory, j'ai deux machines proposant des services web, `WEB-SERVER-01` et `WEB-SERVER-02`, et chacune de ces deux machines propose d'autres services.

Si je veux désigner le serveur web sur `WEB-SERVER-01`, le SPN se présente de la façon suivante :

```
www/WEB-SERVER-01
```

ou

```
www/WEB-SERVER-01.adsec.local
```

Dans la vraie vie, voici le SPN d'un service dans un ticket Kerberos :

[![SPN](/assets/uploads/2019/02/SPN_ST.png)](/assets/uploads/2019/02/SPN_ST.png)

Ce ticket est destiné à l'utilisation du service `www` sur la machine `WEB-SERVER-01` dans le domaine `adsec.local`.

## Exemples

Il existe un grand nombre de classes de services, en voici une liste built-in tirée de la [documentation de Microsoft](https://docs.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2003/cc772815(v=ws.10)#service-principal-names).

[![Liste SPN](/assets/uploads/2019/02/liste_spn.png)](/assets/uploads/2019/02/liste_spn.png)

Nous reconnaissons quelques classes de services, telles que `CIFS` pour les services en lien avec le partage de fichiers, `DNS`, `WWW` dont nous avons déjà parlé, ou encore `spooler` qui regroupe les services d'impression.

Cette liste n'est pas exhaustive, on ne retrouve par exemple pas de `SqlServer` que l'on recontre habituellement dans les environnements AD, ou encore la classe `LDAP` qui réunit les services d'annuaire.

## Cas particulier - HOST

Il existe un cas particulier que nous rencontrons dans les attributs SPN d'un objet dans l'AD, c'est le SPN `HOST`.

[![HOST SPN](/assets/uploads/2019/02/host_spn.png)](/assets/uploads/2019/02/host_spn.png)

Le SPN `HOST` n'est pas vraiment une classe de service. C'est un SPN qui est un regroupement de classes de services, une sorte d'alias qui regroupe un grand nombre de SPN. Les éléments qu'il regroupe sont définis dans l'attribut "SPN-Mappings" de l'AD. On peut énumérer ces classes via la commande suivante :

```
Get-ADObject -Identity "CN=Directory Service,CN=Windows NT,CN=Services,CN=Configuration,DC=HALO,DC=NET" -properties sPNMappings
```

[![SPN Mappings](/assets/uploads/2019/02/sPNMappings.png)](/assets/uploads/2019/02/sPNMappings.png)


Ainsi, si jamais un utilisateur cherche le SPN `www` sur la machine `WEB-SERVER-01`, l'AD cherchera `www/WEB-SERVER-01` mais il cherchera également `HOST/WEB-SERVER-01`. Si la machine possède le SPN `HOST` alors cela veut dire qu'elle possède le SPN `www` (et beaucoup d'autres).

**Note :** Ce SPN (`HOST`) reste un peu un mystère pour moi. En effet, lors de la génération d'un [Silver Ticket](/kerberos-silver-golden-tickets), si on décide que le SPN est `HOST`, alors on peut effectuer certaines tâches telles que la gestion des services ou la gestion des tâches planifiées. Cependant, bien que `CIFS` soit inclu dans l'attribut `SPN-Mappings`, je n'étais pas en mesure d'accéder au partage `C$` de la machine.

En posant la question sur le [slack de Bloodhound](https://bloodhoundgang.herokuapp.com/), [@pyrotek3](https://twitter.com/pyrotek3) ([ADSecurity.org](https://adsecurity.org/?page_id=8)) m'a répondu ceci :


> I have seen the same thing. You would think that HOST would handle most things for the Windows system, but there are certain types of calls that need more than HOST since its a catch-all. I only figured out what worked through trial and error (and lots of testing).
From what I have seen HOST can provide SPN coverage and is a "catch-all" for standard system SPNs so the same SPNs don't have to be registered on every system. For "privileged" type activity, using CIFS seems to be required. For Silver Tickets, you can use whatever SPN you want (provided the system will respond) since the DC isn't involved and the SPNs registered on the computer account in AD doesn't really matter (since you create the ticket and connect directly to the system bypassing the DC and AD).
It has been a while since I dug into this.

Si quelqu'un est en mesure d'apporter des précisions, n'hésitez pas à les partager via les commentaires ou en me contactant sur Twitter ([@HackAndDo](https://twitter.com/HackAndDo)).

## En pratique

Voici un petit script PowerShell qui permet de lister les SPNs présents dans l'Active Directory. Le filtre utilisé est `(servicePrincipalName=*)` qui retourne les résultats avec l'attribut non nul.

```powershell
$search = New-Object DirectoryServices.DirectorySearcher([ADSI]"")
$search.filter = "(servicePrincipalName=*)"
$results = $search.Findall()
foreach($result in $results)
{
	$userEntry = $result.GetDirectoryEntry()
	Write-host "User : " $userEntry.name "(" $userEntry.distinguishedName ")"
	Write-host "SPNs"        
	foreach($SPN in $userEntry.servicePrincipalName)
	{
		$SPN       
	}
	Write-host ""
}
```

Ce qui donne en lab :

[![SPN MapListpings](/assets/uploads/2019/03/SPNListPowershell.png)](/assets/uploads/2019/03/SPNListPowershell.png)

On voit apparaitre les différents objets possédant au moins un attribut SPN.

Si nous ne voulions voir que les comptes utilisateurs qui possèdent un (ou plusieurs SPNs), voici une solution possible :

```powershell
$search = New-Object DirectoryServices.DirectorySearcher([ADSI]"")
$search.filter = "(&(objectCategory=person)(objectClass=user)(servicePrincipalName=*))"
$results = $search.Findall()
foreach($result in $results)
{
	$userEntry = $result.GetDirectoryEntry()
	Write-host "User : " $userEntry.name "(" $userEntry.distinguishedName ")"
	Write-host "SPNs"        
	foreach($SPN in $userEntry.servicePrincipalName)
	{
		$SPN       
	}
	Write-host ""
}
```

Dans mon lab, voilà le résultat de ce script :

[![SPN MapListpings](/assets/uploads/2019/03/SPNListUsersPowershell.png)](/assets/uploads/2019/03/SPNListUsersPowershell.png)

Cette requête sera pratique pour une attaque que nous décrirons dans le prochain article, le **Kerberoasting**.

## Conclusion

Cet article relativement court a permis de lever le voile sur la notion de SPN qui sera utilisée à diverses reprises. Ce n'est pas quelque chose de compliqué, cependant je trouvais que les documentations étaient toujours vagues. Je complèterai cet article si jamais d'autres éclaircissements sont nécessaires.

Si vous avez des précisions ou des corrections, n'hésitez pas à les partager, comme à chaque fois !
