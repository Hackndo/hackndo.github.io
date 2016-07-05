---
title: 'Deep Web & Dark Web'
date: 2015-08-21 12:08:16 -0400
author: "hackndo"
layout: post
permalink: /deep-web-dark-web/
disqus_identifier: 0000-0000-0000-0005
cover: assets/uploads/2015/08/deepweb.jpg
tags:
  - web
---
Ceci est un tout petit article qui permet de remettre très rapidement et très sommairement les choses en place. On me demande très souvent si je suis déjà allé sur le deep web, le dark web, des darknets sans vraiment comprendre ce que c'était, quelles étaient les différences etc. Cet article n'a pas pour vocation de faire une étude, un état des lieux, mais plutôt de faire toucher du doigt au néophyte ce que signifient ces termes. Je propose donc quelques lignes pour pouvoir commencer à expliquer en 5 minutes ce qu'impliquent ces termes.

# Deep Web

Le _deep web_, ou web profond, partie que l'on appelle "cachée" d'internet, est à opposer au web visible. Comme les deux s'opposent, expliquer l'un permet de comprendre l'autre.

Le web visible, c'est le web que l'utilisateur lambda connait, parcourt. Ce sont toutes les pages web référencées par les moteurs de recherche usuels comme Yahoo, Google, Qwant, Bing etc. Un moteur de recherche effectue par définition une recherche dans une base de données qu'il a créée en référençant des pages. Pour cela, il tente de **trouver** toutes les pages web possibles et essaie de **comprendre** leur contenu afin de pouvoir les proposer à l'utilisateur lorsque celui-ci effectue une recherche par mot-clés.

Pendant longtemps, les moteurs de recherche ne comprenaient que les pages écrites en html (trouvables), donc ce n'étaient qu'elles qui étaient indexées. Mais avec le temps, ces moteurs parviennent à comprendre d'autres types de fichiers comme les pdf, les documents word, etc. Donc actuellement, quand vous faites une recherche sur un moteur de recherche classique, vous avez accès à ces types de pages.

Cependant, il existe une multitude de pages ou documents que les moteurs de recherche classiques ne peuvent pas référencer, soit parce qu'ils n'ont tout simplement **pas accès** à la page, soit parce qu'ils ne **peuvent pas la comprendre**.

On trouve dans le lot les pages avec des liens dynamiques (i.e. qui changent en fonction de chaque utilisateur), celles protégées par un mot de passe ou un captcha, les pages sur lesquelles aucun lien ne pointe, les documents non compris par les moteurs de recherche, ou encore les noms de domaines dont la résolution DNS n'est pas standard, avec par exemple une racine qui n'est pas enregistrée chez l'[ICANN](https://www.icann.org/fr). J'entends par là que les racine de nom de domaine connus par l'ICANN sont les .com, .fr, .co, .gouv etc. mais qu'il en existe des non standards, seulement accessibles via des serveurs DNS non standards (Un serveur DNS est grosso modo un serveur qui traduit un nom de domaine comme hackndo.com, newbiecontest.org en l'adresse IP correspondante). Un exemple connu est la racine .onion donc la résolution n'est possible que via le réseau [TOR](https://www.torproject.org/).

Vous voyez, il existe de nombreux, **très** nombreux cas pour lesquels les moteurs de recherches tels que nous les connaissons sont incapables d'indexer une ressource. Toutes ces ressources classiquement inaccessibles forment ce qu'on appelle le _deep web_.

# Dark Web

Une grande confusion existe entre le _dark web_ et le _deep web._ **Non**, le _dark web_ **n'est pas** le _deep web_. Le _dark web_ est une partie du _deep web_. Le _dark web_ repose sur les _darknets_, et un darknet n'est rien d'autre qu'un réseau P2P (_peer-to-peer_, ami-à-ami) dans lequel les utilisateurs sont considérés commes des personnes de confiance, et les échanges sont anonymes, donc les IP ne sont pas publiquement partagées. Un exemple connu de _dark web_ est [Freenet](https://freenetproject.org/), qui n'est finalement rien de plus qu'un **réseau anonyme** et **distribué** fondé sur l'internet.

* * *

J'espère que ces petites lignes vous permettent d'avoir une compréhension un peu plus claire des différences entre ces termes. J'ajouterai qu'il est important de ne pas faire l'amalgame entre **anonymat** et **illégalité**. Si les pratiques illégales tentent d'être anonymes, l'inverse n'est pas toujours vrai. Nous avons très bien le droit de vouloir être anonymes afin de ne pas être surveillés. L'anonymat, c'est la vie privée.

**Ressources**

  * [Reddit : Deep Web](https://www.reddit.com/r/deepweb/)
  * [Wikipédia : Darknet](https://fr.wikipedia.org/wiki/Darknet)
  * [Wikipédia : Dark Web](https://en.wikipedia.org/wiki/Dark_web)
  * [Wikipédia : Deep Web](https://en.wikipedia.org/wiki/Deep_web)
  * [Exploring the deep web: Below the surface (PDF)](https://www.trendmicro.com/cloud-content/us/pdfs/security-intelligence/white-papers/wp_below_the_surface.pdf)

  