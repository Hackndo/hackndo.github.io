---
title: "Spray passwords, avoid lockouts"
date: 2024-05-30 14:25:55
author: "Pixis"
layout: post
permalink: /password-spraying-lockout/
disqus_identifier: 0000-0000-0000-00bc
cover: assets/uploads/2024/05/password_spraying_banner.png
description: ""
tags:
  - "Active Directory"
  - Windows
---

Le password spraying, c'est une technique connue qui consiste à tester un même mot de passe sur plusieurs comptes, en espérant que ce mot de passe fonctionne pour l'un d'entre eux. Cette technique est utilisée dans beaucoup de cadres différents : Sur des applications web, du cloud, des services comme SSH, FTP, et bien d'autres. On l'utilise également beaucoup dans des tests d'intrusion au sein d'entreprises utilisant Active Directory. C'est à ce dernier cas que nous allons nous intéresser, parce que bien que la technique paraisse simple, ce n'est pas évident de la mettre en pratique sans effets de bord.

<!--more-->

Cet article est disponible en français sur [le blog de Login Sécurité](https://www.login-securite.com/2024/06/03/spray-passwords-avoid-lockouts/), ou an anglais sur [en.hackndo.com](https://en.hackndo.com/password-spraying-lockout/)

