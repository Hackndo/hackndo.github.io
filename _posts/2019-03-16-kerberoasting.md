---
title: "Kerberoasting"
date: 2019-03-15 08:02:44
author: "Pixis"
layout: post
permalink: /kerberoasting/
disqus_identifier: 0000-0000-0000-00aa
cover: assets/uploads/2019/02/kerberoasting.png
description: "A l'aide des notions abordées précédemment, nous avons tous les éléments en main pour expliquer le principe de l'attaque Kerberoasting, basée sur la demande de TGS et sur les attributs SPN de comptes d'Active Directory."
tags:
  - "Active Directory"
  - Windows
translation:
  - en
---

A l'aide des notions abordées précédemment, nous avons tous les éléments en main pour expliquer le principe de l'attaque **Kerberoasting**, basée sur la demande de TGS et sur les attributs [SPN](/service-principal-name-spn) de comptes d'Active Directory.

<!--more-->

## Principe

L'article sur le [fonctionnement de kerberos](/kerberos) a permis de comprendre comment un utilisateur demandait un TGS auprès du contrôleur de domaine. La réponse [KRB_TGS_REP](/kerberos/#krb_tgs_rep) est composée de deux parties. Une première partie est le TGS dont le contenu est chiffré avec le secret du service demandé, et une deuxième partie est une clé de session qui sera utilisée entre l'utilisateur et le service. Le tout est chiffré avec le secret de l'utilisateur.

[![Ticket pour le service](/assets/uploads/2018/05/tgsrep.png)](/assets/uploads/2018/05/tgsrep.png)

Un utilisateur de l'Active Directory peut demander un TGS pour n'importe quel service auprès du KDC. En effet, ce dernier n'a pas pour rôle de vérifier les droits du demandeur. Il a seulement pour rôle de fournir les informations de sécurité liées à l'utilisateur (via le [PAC](/kerberos-silver-golden-tickets/#pac)). C'est le service qui doit vérifier les droits de l'utilisateur en lisant son PAC dont une copie est fournie dans le TGS.

Ainsi, il est possible d'effectuer des demandes de TGS en indiquant des [SPN](/service-principal-name-spn) arbitraires, et si ces [SPN](/service-principal-name-spn) sont enregistrés dans l'Active Directory, le KDC fournira un morceau d'information chiffré avec la clé secrète du compte exécutant le service. L'attaquant peut, avec cette information, tenter de trouver le mot de passe en clair du compte via une attaque par exhausitivité (brute force).

Heureusement, la plupart des comptes qui exécutent les services sont les comptes machines (sous la forme `NOMDEMACHINE$`) et leurs mots de passe sont très longs et aléatoires, donc ils ne sont pas vraiment vulnérables à ce type d'attaque. Il existe cependant des services qui sont exécutés par des comptes de services avec des mots de passe choisis par des humains. Ce sont ces comptes qui sont bien plus simples à compromettre via des attaques de type brute-force, donc ce sont ces comptes qui seront visés dans une attaque **Kerberoast**.

Afin de lister ces comptes, un filtre LDAP peut être utilisé afin d'extraire les comptes de type utilisateur possédant un attribut `servicePrincipalName` non vide. Ce filtre est le suivant :

```
&(objectCategory=person)(objectClass=user)(servicePrincipalName=*)
```

Voici alors un script simple en PowerShell qui permet de récupérer les utilisateurs avec au moins un [SPN](/service-principal-name-spn) :

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

Dans le lab, un faux [SPN](/service-principal-name-spn) a été placé sur l'utilisateur "support account".

[![SPN on User](/assets/uploads/2019/03/SPNOnUser.png)](/assets/uploads/2019/03/SPNOnUser.png)

Ainsi, lors de la recherche LDAP, voici ce que ça donne :

[![SPN MapListpings](/assets/uploads/2019/03/SPNListUsersPowershell.png)](/assets/uploads/2019/03/SPNListUsersPowershell.png)

Bien entendu, il existe plusieurs outils permettant d'automatiser cette tâche. Je citerai ici l'outil [Invoke-Kerberoast.ps1](https://github.com/EmpireProject/Empire/blob/master/data/module_source/credentials/Invoke-Kerberoast.ps1) de [@Harmj0y](https://twitter.com/harmj0y), outil qui s'occupe de lister les comptes utilisateurs avec un ou plusieurs [SPN](/service-principal-name-spn), effectuer des demandes de TGS pour ces comptes et extraire la partie chiffrée dans un format qui peut être cracké (par John par exemple).

```
Invoke-Kerberoast -domain adsec.local | Export-CSV -NoTypeInformation output.csv
john --session=Kerberoasting output.csv
```

On espère alors trouver des mots de passe, ce qui dépend de la politique de mot de passe de l'entreprise pour ces comptes.

## Protection

Pour se protéger de ce type d'attaque, il faut éviter d'avoir des [SPN](/service-principal-name-spn) sur des comptes utilisateurs, au profit des comptes machines.

Si c'est vraiment nécessaire, alors il faut utiliser la fonctionnalité "Managed Service Accounts" (MSA) de Microsoft qui permet de faire en sorte que le mot de passe du compte soit robuste et changé régulièrement et automatiquement. Pour cela, il suffit d'ajouter un compte de service (seulement via PowerShell) :

```powershell
New-ADServiceAccount sql-service
```

Puis il convient de l'installer sur la machine

```powershell
Install-ADServiceAccount sql-service
```

Enfin, il faut assigner cet utilisateur au service.

[![Assignation du compte de service](/assets/uploads/2019/02/set-account-service.png)](/assets/uploads/2019/02/set-account-service.png)

## Conclusion

L'attaque Kerberoast permet de récupérer de nouveaux comptes au sein d'un Active Directory pour une tentative de mouvement latéral. Les comptes alors compromis peuvent avoir des droits plus élevés, ce qui est parfois le cas sur la machine qui héberge le service. Il est alors important d'un point de vue défensif de maîtriser l'attribut [SPN](/service-principal-name-spn) des comptes de domaine pour éviter que des comptes à mot de passe faible soient vulnérables à cette attaque.
