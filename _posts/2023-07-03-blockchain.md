---
title: "Blockchain 101"
date: 2023-07-03 02:12:43
author: "Pixis"
layout: post
permalink: /blockchain/
disqus_identifier: 0000-0000-0000-00b6
cover: assets/uploads/2023/06/blockchain_banner.png
description: "Une blockchain représente un registre (ou base de données) décentralisé. Il n'y a pas une entité centrale qui décide de la validité ou non d'une transaction, mais bien des milliers de personnes ou machines qui travaillent pour vérifier et valider ces transactions, le tout étant régit par des règles et concepts mathématiques bien précis."
tags:
  - "Blockchain"
translation:
  - en
---


Depuis plusieurs années, je m'intéresse à un sujet dont vous avez probablement entendu parler, les **blockchains**. Je trouve ça fascinant qu'une technologie permette à des milliers de personnes de s'accorder sur énormément de sujets **sans besoin d'intermédiaire**. La décentralisation est un sujet qui à mon sens a beaucoup de potentiel, et nous verrons sur le long terme si cette technologie perdurera ou non. Quoiqu'il en soit, en l'état, ça bouillonne, ça bouillonne fort ! Plus récemment, j'ai commencé à m'intéresser à la blockchain **Ethereum**, aux **smart contracts**, et à la **sécurité des smart contracts**. On va parler de tout ça ici, c'est parti.

<!--more-->

Avant de plonger dans la sécurité des smarts contracts, il est important de rappeler quelques **concepts clés sur les blockchains**. Qu'est-ce que c'est, comment ça fonctionne, quels sont les acteurs en jeu, nous verrons tout ceci dans cet article introductif. L'idée n'est pas de rentrer dans les détails, mais d'avoir une **vue d'ensemble** du fonctionnement général des blockchains. Les spécificités techniques variant beaucoup d'une blockchain à l'autre, nous les verrons en temps voulu dans les prochains articles.

## Définition

Il y a mille et une définitions pour le terme **blockchain** (ou chaîne de blocs, mais on continuera avec le terme blockchain). Ce que je trouve important à comprendre, c'est que ça représente un registre (ou base de données) décentralisé. Il n'y a pas une entité centrale qui décide de la validité ou non d'une transaction, mais bien des milliers de personnes ou machines qui travaillent pour vérifier et valider ces transactions, le tout étant régit par des règles et concepts mathématiques.

Finalement, on peut simplifier une blockchain en imaginant que c'est un immense tableau Excel dans lequel il est possible d'ajouter des lignes, les unes à la suite des autres. Il est également possible de lire l'intégralité du fichier Excel, depuis sa création. Cependant, il n'est pas possible d'aller modifier une ligne déjà écrite et validée. C'est du _append only_.

Bien entendu, c'est simplificateur, car des blockchains comme Ethereum ajoute, en plus de transactions classiques, une machine virtuelle avec son espace de stockage, son architecture etc. On en parlera dans le prochain article.

## Transactions

Ces transactions, à quoi ça correspond ? Tout simplement à des transferts de _coins_ d'un compte à un autre. Si Alice veut envoyer 1 _coin_ à Bob, c'est une transaction.

> Un **coin**, c'est la cryptomonnaie de la blockchain. Pour la blockchain Bitcoin, c'est le Bitcoin, pour la blockchain Ethereum c'est l'Ether, pour Solana c'est le Sol, etc.

Pour savoir si Alice a suffisamment de _coins_, il suffit de lire l'historique des transactions. **Tout** l'historique. Si un jour elle a reçu `3` _coins_, qu'elle en a dépensés `2`, puis qu'elle en a reçus `4`, on peut savoir, à l'instant T, que Alice a `3-2+4` donc `5` _coins_. Elle a alors le droit de dépenser 1 _coin_, tout va bien.

[![Alice balance](/assets/uploads/2023/06/alice_balance.png)](/assets/uploads/2023/06/alice_balance.png)

> Notons que c'est le fonctionnement de Bitcoin, mais pour d'autres blockchains, il arrive que le solde de chaque compte soit maintenu à jour (dans la blockchain ou non) afin d'éviter de devoir recalculer les soldes des utilisateurs à chaque transaction.

Voilà ce que contient une blockchain classique. Un état des dépenses de tous les utilisateurs, depuis la création de la blockchain.

## Utilisateur

Pour être un utilisateur d'une blockchain, il faut être en possession d'un couple de clés asymétriques : Une clé publique et une clé privée. La clé privée, évidemment gardée jalousement par chaque utilisateur, permet de signer toutes ses transactions. C'est de cette manière que, quand Alice prétend envoyer `1` _coin_ à un destinataire, il est possible de vérifier que c'est bien Alice qui est à l'initiative de cette transaction. Elle l'a signée avec sa clé privée, et tout le monde peut vérifier que cette signature est valide avec sa clé publique.

On comprend donc qu'en réalité, dans une blockchain, on ne sait pas que l'utilisateur est **Alice**. Un utilisateur est plutôt défini par une adresse (dérivée de sa clé publique). Donc quand Alice souhaite effectuer une transaction, du point de vue de la blockchain, c'est son adresse qui est la source de la transaction.

Par ailleurs, pour communiquer avec la blockchain, l'utilisateur passera par le biais d'un **client**. Ce n'est rien d'autre qu'un programme qui sait comment générer des transactions, communiquer avec le réseau etc. L'utilisateur pourrait tout coder lui⁻même, mais ce n'est pas pratique. C'est un peu comme le fait d'utiliser un navigateur internet pour aller sur internet. C'est plus pratique que d'écrire du code qui permette de faire des requêtes HTTP.

## Validation

C'est très bien, mais qui valide ces transactions ? Qui fait le calcul pour vérifier que Alice a bien au moins 1 _coin_ à envoyer à quelqu'un ? Et que c'est bien Alice qui effectue la transaction ?

C'est là qu'interviennent les notions de **blocs** et de **validateurs**. Pour qu'une blockchain fonctionne correctement, il faut que plusieurs personnes se mettent au travail pour valider les transactions. Ils créent ce qu'on appelle des nœuds (_nodes_) qui seront capables de s'annoncer auprès du réseau pour en faire partie, récupérer toutes les transactions passées et celles en attente de validation. C'est un vrai réseau _peer-to-peer_. Dès qu'un utilisateur souhaite effectuer une transaction (**1**), le client qu'il utilise pour effectuer sa transaction enverra un message de broadcast pour indiquer qu'une nouvelle transaction a été envoyée (via [NewPooledTransactionHashes](https://eips.ethereum.org/EIPS/eip-2464)) (**2**). Le (ou les) nœud alentours recevra cette information et récupérera la transaction pour la **vérifier** (vérification de la signature, des fonds disponibles, etc.) (**3**), mais elle ne sera pas encore **validée** pour autant. Elle va rejoindre la liste d'attente des transactions qui ont été envoyées mais pas encore validées, appelée le **mempool**. Ce nœud préviendra également d'autres nœuds (**4**) qui eux-mêmes feront le travail de vérification (**6**) et ajouteront cette transaction à leur mempool, etc.

[![Tx Propagation](/assets/uploads/2023/06/tx_propagation.png)](/assets/uploads/2023/06/tx_propagation.png)

Il y a donc tout un tas de transactions en attente d'être validées, et c'est là qu'entre en jeu la magie de la blockchain. En effet, il va falloir valider des transactions, et que tous les nœuds du réseau se mettent d'accord sur les transactions validées, et l'ordre dans lequel elles sont validées.

Chaque nœud crée alors un bloc, dont la taille est limitée (cette limite diffère d'une blockchain à l'autre) en choisissant des transactions en attente dans le mempool. Une fois ce bloc créé, tous les nœuds seront en compétition pour que leur bloc soit le nouveau bloc de référence. Le bloc construit par celui qui remporte la compétition devient le dernier bloc de la chaîne. Il est ajouté aux blocs précédemment validés, les transactions qu'il contenait ne sont plus dans le mempool, puisqu'elles ont été validées, et donc tous les nœuds doivent reconstruire un nouveau bloc avec les transactions qui ne sont pas encore validées pour tenter, à nouveau, de remporter cette compétition.

[![New block](/assets/uploads/2023/06/blockchain_new_block.png)](/assets/uploads/2023/06/blockchain_new_block.png)


## Consensus

Cette "compétition" dont on parle, c'est le mécanisme de consensus, c'est à dire une manière qui met tout le monde d'accord pour que quelqu'un devienne la nouvelle référence pour le prochain bloc. Il existe beaucoup de mécanismes de consensus. Les deux principaux sont les suivants :

Le **Proof of Work (PoW)**, ou preuve de travail, est un mécanisme de consensus qui requiert que chaque nœud effectue énormément de calculs pour trouver une solution à un problème. Pour simplifier, c'est comme si on vous demandait de fournir une chaine de caractères telle que `md5(bloc + chaine)` commence par dix fois le numéro `0`. Il n'y a pas vraiment de bonne ou mauvaise situ... manière de procéder. On peut tout simplement générer des chaines complètement aléatoires, calculer leur hash md5, jusqu'à trouver, par hasard, une entrée qui satisfasse la condition. Et à un moment donné, de manière complètement aléatoire, quelqu'un peut tester :

```bash
echo -n '[bloc data]aa33bdsk' | md5sum
# Output:
000000000035d3695b3a133766f60d42
```

En étant le premier à trouver cette solution au problème posé, ce sera son bloc qui sera ajouté à la chaîne de blocs existante, et donc les transactions qu'il a prises du mempool qui seront validées.

Le **Proof of Stake (PoS)** , ou preuve d'enjeu, évite que tous les nœuds fassent des calculs. A la place, chaque nœud doit mettre de côté des cryptomonnaies de la blockchain. Chaque nœud prépare son bloc, puis à intervalle régulier, c'est un algorithme qui choisi aléatoirement un nœud parmi ceux qui ont mis des cryptomonnaies de côté. Le nœud choisi verra son bloc validé, et on passe au bloc suivant. Si le nœud ne respecte pas les règles ou essaie de tricher (en modifiant des transactions ou en créant un bloc trop gros, par exemple), la cryptomonnaie qu'il a dû mettre de côté lui sera retirée. _You gotta play by the rules_.

Il en existe d'autres, mais vous avez compris l'idée. Le but est que régulièrement, un nœud valide un bloc, mais qu'il ne soit pas possible pour un même nœud de valider tous les blocs. Tout le monde est en compétition.


## Récompenses

Rassurez-vous, les personnes derrière ces nœuds ne sont pas des amoureux de la blockchain qui travaillent gratuitement. Tout travail mérite salaire, et ça s'applique également à la blockchain. Les personnes qui font partie du réseau en vérifiant et validant les transactions gagnent des récompenses.

Pour envoyer une transaction sur le réseau, les utilisateurs doivent y joindre un petit montant, appelé **frais de transaction** (_gas_ chez Ethereum). Ainsi, quand quelqu'un valide un bloc, il récoltera les frais des transactions qu'il aura validé. On comprend alors qu'en tant qu'utilisateur, si on veut être assuré que notre transaction ne stagne pas _at vitam_ dans le mempool, il faudra payer suffisamment de frais de transactions pour être dans la moyenne, voire dans le haut du panier si on souhaite être prioritaire.

Par ailleurs, à chaque bloc validé, un petit montant de la cryptomonnaie est créé de toute pièce et envoyé au validateur. Le nombre de _coin_ en circulation augmente alors un peu.

## Conclusion

Ces quelques paragraphes permettent j'espère de clarifier le concept global d'une blockchain, et sert d'introduction aux prochains articles qui se concentreront sur la blockchain Ethereum, notamment sur l'Ethereum Virtual Machine qui permet d'exécuter des Smart Contracts, et les enjeux de sécurité associés à cette exécution de code décentralisée. A très vite !