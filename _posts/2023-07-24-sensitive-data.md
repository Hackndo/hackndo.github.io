---
title: "Données sensibles d'un smart contract"
date: 2023-10-03 08:09:08
author: "Pixis"
layout: post
permalink: /sensitive-data/
disqus_identifier: 0000-0000-0000-00bb
cover: assets/uploads/2023/10/sensitive_data.png
description: "Toutes les données enregistrées par un smart contract sont stockées sur la blockchain, donc peuvent être lues par tout le monde. Si jamais des données sensibles sont enregistrées par un smart contract, un attaquant sera en capacité de les lire."
tags:
  - "Blockchain"
translation:
  - en
---

Vous vous souvenez des différents espaces de stockages auxquels a accès l'EVM ? Celui comparable au disque dur d'un ordinateur est le **account storage**. C'est cette zone mémoire dans laquelle l'état du contrat est enregistré. Mais vous vous souvenez aussi que la blockchain Ethereum est une machine a états décentralisée, accessible en lecture à tout le monde ? Vous voyez où je veux en venir ? Toutes les données enregistrées par un smart contract peuvent être lues par tout le monde. Si jamais des données sensibles sont enregistrées par un smart contract, nous serons en capacité de les lire.

<!--more-->

## Rappels sur la mémoire

La mémoire de l'EVM est organisée de la manière suivante :

[![EVM Storage](/assets/uploads/2023/06/evm_storage.png)](/assets/uploads/2023/06/evm_storage.png)

Nous avons décrit dans l'article sur l'[EVM](/ethereum-virtual-machine/) l'utilité des différentes zones mémoires, et leur organisation.

Ce qui nous intéresse dans cet article, c'est le **account storage**, le stockage permanent du compte du smart contract. C'est dans cette zone de stockage que le contrat enregistrera ses variables qui doivent être persistantes sur la blockchain. Par exemple, si un smart contract gère une inscription à un événement, il est nécessaire que la liste des inscrits soit enregistrée, et puisse être modifiée. C'est typiquement pour ce type d'informations que l'**acount storage** est utilisé.

Voici pour rappel à quoi ressemble cette zone mémoire :

[![Account Storage](/assets/uploads/2023/06/account_storage.png)](/assets/uploads/2023/06/account_storage.png)

Elle est organisée en **slots**, qui fonctionnent comme un index. Il y a `2**256` emplacements, et dans chaque emplacement on peut stocker `256` bits.

Si un contrat (écrit avec Solidity) souhaite enregistrer des variables dans cet espace (qu'on appellera **state variables**), il doit les déclarer en dehors des fonctions.

```java
contract Hackndo {
  /**
   * Variables d'état enregistrées dans le Account Storage
   */
  uint256 id = 7; 
  uint256 totalAmount = 1000;

  /**
   * Code du contrat
   */
  constructor() {
    // Code
  }

  function test() external {
    // Variable locale (non enregistrée sur la blockchain)
    uint256 localVariable = 0;
  }

  function update() external {
    id++;
    totalAmount = 0;
  }
}
```

Les variables `id` et `totalAmount` seront enregistrées dans le **account storage** de ce contrat, et seront accessibles par toutes les fonctions de ce contrat. Si elles sont mises à jour par une fonction (comme `update()`), le **account storage** du contrat sera mis à jour et ces nouvelles valeurs seront disponibles pour les prochaines transactions.

## Visibilité des variables

Avec Solidity, la visibilité d'une variable peut être définie de trois manières différentes :
* `public` : La variable est **accessible en lecture** par d'autres smart contracts. Un `getter` est automatiquement créé. On peut donc la lire en appelant la fonction `id()` ou `totalAmount()` par exemple.
* `internal` : La variable ne peut être lue ou modifiée que par le contrat dans lequel elle est définie, ou les contrats qui héritent de ce contrat. C'est la visibilité par défaut des variables.
* `private` : La variable ne peut pas être lue ou modifiée par d'autres smart contract que celui dans lequel elle est définie.


Les définitions des variables `internal` et `private` présentes dans la [documentation de Solidity](https://docs.soliditylang.org/en/v0.8.20/contracts.html#state-variable-visibility) peut porter à confusion :

> **Internal** state variables can only be accessed from within the contract they are defined in and in derived contracts. They **cannot be accessed externally**. This is the default visibility level for state variables.
> 
> **Private** state variables are like internal ones but they are **not visible** in derived contracts.

Sans méfiance, nous pourrions croire qu'en définissant une variable `internal` ou `private`, cette variable ne pourra être lue par personne d'autre que le contrat lui-même, ou les contrats qui en héritent, donc qu'on pourrait stocker des informations confidentielles.

Les variables `internal` et `private` sont uniquement privées dans le cadre du smart contract. Cependant, **leurs valeurs peuvent être librement lues en dehors de la blockchain par n'importe qui**, donc elles ne cachent pas les données dans ce sens.

## Organisation de l'account storage

En tant qu'attaquant, il est alors nécessaire de bien comprendre comment les variables sont enregistrées dans le **account storage**.

### Ordre de stockage

Le premier élément à comprendre est que les **storage variables** sont stockées par le compilateur de Solidity dans l'ordre de déclaration. Dans l'exemple donné au-dessus, la variable `id` sera stockée en première, puis la variable `totalAmount`.

Si aucune valeur n'est assignée à la variable, elle prendra la valeur par défaut `0x00`, et son slot est tout de même réservé.

Lors de la compilation du smart contract, le compilateur va tenter d'optimiser l'espace de stockage nécessaire. Pour cela, si des variables peuvent rentrer dans le même slot de 32 octets, elles seront mises dans le même slot.

Par exemple, si les variables d'état sont les suivantes :

```java
contract Hackndo {
  /**
   * Variables d'état enregistrées dans le Account Storage
   */
  uint32 var1 = 7; 
  uint32 var2 = 15;
  uint128 var3 = 10;
  uint128 var4 = 9;
  uint32 var5 = 2;
  uint8 var6 = 3;
}
```

La taille d'un slot est de 256 bits. Les 3 premières variables occupent `32+32+128 = 192` bits. On ne peut pas ajouter, dans le même slot, la 4ème variable, car il ne reste plus que 64 bits disponibles. Elle va donc dans le deuxième slot, avec la 5ème et la 6ème variable. En effet, la taille de `var4`, `var5` et `var6` vaut `128+32+8 = 168` bits, ce qui rentre dans un slot.

[![Storage compression](/assets/uploads/2023/06/storage_compression.png)](/assets/uploads/2023/06/storage_compression.png)

Ce qui donne, dans le **storage**, les données suivantes :

```bash
# Slot 0
0x0000000000000000 0000000000000000000000000000000a 0000000f 00000007
#      empty                     var3                 var2     var1

# Slot 1
0x00000000000000000000 0003 00000002 00000000000000000000000000000009
#        empty         var6   var5                 var4
```

### Constant & Immutable

Avec Solidity, les mots clés `constant` et `immutable` peuvent être utilisés sur des variables d'état.

* Si une variable est définie comme `constant`, une valeur **doit** lui être attribuée au moment de sa déclaration, et cette valeur ne pourra plus jamais être changée.
* Si une variable est définie comme `immutable`, une valeur **doit** lui être attribuée, soit **au moment de sa déclaration**, soit dans le **constructeur**.

Ce que ces deux types de variable ont en commun, c'est que toutes les utilisations de ces variables dans le code seront **remplacées par leur valeur par le compilateur avant que le bytecode ne soit enregistré sur la blockchain**. Donc en fait, ces notions de `constant` et `immutable` n'existent pas pour l'EVM. C'est juste quelque chose de pratique pour les développeurs.

Si par exemple, on a le contrat suivant :

```java
contract Hackndo {
  uint256 constant MAX_SUPPLY = 1000;
  uint256 immutable DEST_ADDR;

  constructor(address _dest_addr) {
    DEST_ADDR = _dest_addr;
  }

  function someFunc(uint _value) {
    require(_value < MAX_SUPPLY, "MAX_SUPPLY reached");
    require(msg.sender == DEST_ADDR, "Not allowed");

    // Some code
  }
}
```

Deux variables `MAX_SUPPLY` et `DEST_ADDR` sont déclarées. Cependant, elles seront remplacées par leur valeur lorsque le contrat sera déployé sur la blockchain. Donc finalement, si ce code est déployé par l'adresse `0x1234...`, il est **exactement équivalent à** :

```java
contract Hackndo {

  function someFunc(uint _value) {
    require(_value < 1000, "MAX_SUPPLY reached");
    require(msg.sender == 0x1234..., "Not allowed");

    // Some code
  }
}
```

D'un point de vue _bytecode_, les variables `constant` et `immutable` n'existent pas. Donc si on voit ce type de variable dans un contrat, il ne faut pas les prendre en compte dans le calcul des slots.

## Stockage des variables

Maintenant que nous avons clarifié quelles variables étaient stockées dans le storage, et l'optimisation permettant de limiter la taille de storage utilisée, voyons comment les différents types de variables sont techniquement enregistrés.

### Entiers et booléens

Nous l'avons vu dans les exemples précédents, les entiers (et booléens) sont simplement enregistrés dans le slot qui correspond. La taille maximale d'un entier était 256 bits, il ne pourra jamais être plus grand que la taille prévue par un slot, de 256 bits également.

### Tableau

Lorsqu'un **tableau** a une taille définie, alors ses éléments sont stockés les uns à la suite des autres en suivant les règles déjà vues.

Mais un **tableau** peut avoir une taille **dynamique**. Or, on ne va pas modifier les slots de toutes les variables qui suivent le tableau à chaque fois que la taille de ce dernier change. Chaque élément du tableau a alors un slot particulier dans lequel il est enregistré.

Ainsi, seule la taille du tableau est stockée dans le slot qui suit les règles que nous avons décrites (donc si un tableau dynamique est stocké dans le slot 3, on trouvera sa taille dans ce slot).

Pour trouver le premier élément du tableau, il faut calculer `keccak256(abi.encode(arrayIndex))` (`arrayIndex` serait `3` dans le cas précédent). Ce résultat est un hash de 256 bits, qui correspond au numéro du slot dans lequel se trouve ce premier élément du tableau. Les éléments suivants sont tout simplemenet dans les slots suivants.

### Mapping

Pour un **mapping**, un slot est réservé pour déterminer son index de base mais rien n'est stocké à cet endroit, contrairement aux tableaux pour lesquels la taille est stockée.

En effet, pour accéder à un élément d'un mapping, on n'utilise pas un index, mais la clé de l'élément pour découvrir sa valeur. 

Pour déterminer où se trouve une valeur du mapping en fonction de sa clé, il faut calculer le hash qui concatène la clé de l'élément recherché, et le slot réservé au mapping (`key` + `slot`). Ainsi, la fonction `keccak256(abi.encode(key, slot))` doit être appliquée. Comme pour les tableaux, cette fonction retourne un hash, qui correspond au slot auquel se trouve la valeur de `key`.

### String

Les **chaines de caractères** de moins de 32 octets sont enregistrées dans un slot. Les bits de poids fort sont utilisés pour stocker la chaine, et ceux de poids faible pour indiquer la longueur de la chaine multipliée par 2 `longueur*2`.

Si elle fait 32 octets ou plus, alors le slot réservé à la chaine contient la longueur de la chaine multipliée par deux, auquel on ajoute 1, `longueur*2+1`, et l'emplacement où se trouve la chaine est tout simplement le hash du slot réservé.

Par exemple, si une longue chaine est censée se trouver dans le slot 2, alors l'adresse où se trouve réellement la chaine peut être trouvée avec la fonction `keccak256(abi.encode(2))`.

```bash
➜ bytes32 slot = keccak256(abi.encode(2));
➜ slot
Type: bytes32
└ Data: 0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace
```

> Cette technique de stocker le double de la longueur de la chaine, ou le double auquel on ajoute `1`, permet de savoir si on stocke une chaine inférieure à 32 octets ou supérieure à 32 octets. Si le bit de poids faible de la taille est `1`, c'est que la chaine fait plus de 32 octets. Sinon, elle fait moins que 32 octets. En enlevant ce bit, et en divisant la taille par 2, on obtient la taille réelle de la chaine.

### Structure

Enfin, les variables dans une **structure** sont stockées les unes à la suite des autres, comme si c'était des variables indépendantes. Si, dans la structure, il y a des types dynamiques (tableau, mapping etc.), alors les règles qu'on a vues s'appliquent.

### Exemple

Voici un exemple pour résumer ce qu'on a vu jusque là :

```java
// Définition d'une structure
struct Coin {
    string name;
    uint256 price;
}


// Définition du contrat d'exemple
contract StorageContract {
    uint256 constant MAX_SUPPLY = 1000;
    address immutable DEST_ADDR;
    uint256 totalSupply = 10;
    string author = "pixis";
    string description = "This is an example of storage layout made by pixis. All details in https://hackndo.com";
    uint[] coinsId = [1,2,10,12];
    mapping (string=>address) accounts;
    Coin coin = Coin("PixCoin", 0x1000);

    constructor() {
        DEST_ADDR = msg.sender;
        accounts["pixis"] = msg.sender;
        accounts["empty"] = address(0x0);
    }
}
```

Quand on déploie ce contrat, voici à quoi ressemble le storage :

[![Storage slots examples](/assets/uploads/2023/06/storage_slots_example.png)](/assets/uploads/2023/06/storage_slots_example.png)


Essayons de décortiquer tout ça. Déjà, les deux premières variables `MAX_SUPPLY` et `DEST_ADDR` ne sont pas stockées dans le storage, donc aucun slot n'est réservé pour ces variables.

Ensuite, les variables suivantes ont un slot assigné, dans l'ordre dans lequel elles sont déclarées.

> Pour effectuer les calculs, j'utilise [chisel](https://github.com/foundry-rs/foundry/tree/master/chisel) de la suite **Foundry**.

[![chisel](/assets/uploads/2023/06/chisel_example.png)](/assets/uploads/2023/06/chisel_example.png)


* `totalSupply` est un entier de 256 bits, donc un slot entier lui est réservé, le slot `0`. Sa valeur est `10`, donc 0x0a
* `author` est une chaine de caractères de moins de 32 octets. Elle est donc stockée dans le slot suivant, le slot `1`, au niveau des bits de poids fort. Sa taille, multipliée par deux (` 5*2 = 10 = 0x0a`) est stockée dans les bits de poids faible.
* `description` est quant à elle une chaine de 86 octets, donc supérieure à 32 octets. Ainsi, son slot `2` contient le double de sa taille, auquel on ajoute `1` (rappelez-vous, en ajoutant `1`, ça indique que la chaine fait plus de 32 octets), donc `86*2+1 = 173 = 0xad`. Le slot contenant la chaine correspond au hash du slot de la chaine, donc de `2`. Or `keccak256(abi.encode(2)) = 0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace` donc le slot `0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace` contient la chaine de caractères.
* `coinsId` est un tableau contenant 4 éléments. Sa taille `0x04` est donc renseignée dans son slot `3`. Les slots de ces 4 éléments sont calculés comme suit :
  * Index 0 : `keccak256(abi.encode(3)) = 0xc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b`. Pour les autres éléments, on incrémente le slot de 1 à chaque fois.
  * Index 1 : `0xc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85c`
  * Index 2 : `0xc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85d`
  * Index 3 : `0xc2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85e`
* `accounts` est un mapping dont le slot est `4`. On remarque que ce slot est vide, c'est normal. La taille du mapping n'est pas stockée. Pour trouver la valeur d'une clé en particulier, il faut utiliser la fonction `keccak256(abi.encodePacked(key, slot))` donc :
  * `accounts["pixis"]` se trouve au slot `keccak256(abi.encodePacked("pixis", uint(4))) = 0x47e3196153c18a6193d6b7b92ecf7ea03bc91cce35ccd718094e10f1c50bd1e9`
  * `accounts["empty"]` se trouve au slot `keccak256(abi.encodePacked("empty", uint(4))) = 0xace73dd693559189ef5ccbbc8f81155ea53ec7259b948d81d0791cf64125f053`
* `coin` est une structure contenant deux éléments. Ils sont donc positionnés dans les slots `5` (`name`, inférieur à 32 octets) et `6` (`price`, valant `0x1000`).

Avec toutes ces explications, on est capable de comprendre l'ensemble de l'**account storage** de ce contrat, une fois déployé.

[![Storage slots examples](/assets/uploads/2023/06/storage_slots_example_explained.png)](/assets/uploads/2023/06/storage_slots_example_explained.png)


## Lecture de la mémoire

C'est génial, on est capable de lire et comprendre l'espace de stockage des contrats, mais concrètement, comment est-ce qu'on accède à l'espace de stockage d'un contrat déjà déployé sur la blockchain ?

Différents outils permettent de lire les slots du storage d'un contrat. Personnellement, j'utilise l'outil **cast** de la suite [foundry](https://github.com/foundry-rs/foundry).

En effet, lorsque vous installez **foundry** sur votre machine, différents outils sont installés :

* **Forge**: Framework pour effectuer des tests sur Ethereum
* **Cast**: Outil pour interagir avec les smart contracts et la blockchain
* **Anvil**: Nœud Ethereum local
* **Chisel**: Outil REPL pour exécuter rapidement du code Solidity

L'outil **cast** est très pratique pour lire les slots d'un contrat. La syntaxe est la suivante :

```bash
cast storage 0xcontract_address slot_number [--rpc-url RPC_URL]
```

Par exemple, pour lire le slot `0` du contrat à l'adresse `0x099A3B242dceC87e729cEfc6157632d7D5F1c4ef` sur Ethereum ([contrat pris au hasard](https://etherscan.io/address/0x099a3b242dcec87e729cefc6157632d7d5f1c4ef#code)), la ligne de commande suivante peut être utilisée :

```bash
cast storage 0x099A3B242dceC87e729cEfc6157632d7D5F1c4ef 0 --rpc-url https://eth.llamarpc.com 
0x0000000000000000000000000000000000000000000000000000000000000001
```

Il y a donc la valeur `0x01` dans le slot `0` du contract. Nous pouvons faire une boucle pour lire les 6 premier slots :

```bash
for I in {0..5} 
do
    echo "SLOT $I: " $(cast storage $CONTRACT_ADDR $I --rpc-url $RPC_URL)
done
SLOT 0:  0x0000000000000000000000000000000000000000000000000000000000000001
SLOT 1:  0x0000000000000000000000000000000000000000000000000000000000000000
SLOT 2:  0x00000000000000000000000000000000000000000000000000c6645100000000
SLOT 3:  0x0000000000000000000000000000000000000000000000000000000000000205
SLOT 4:  0x000000000000000000000000000000000000000003f806d77433774f8c683600
SLOT 5:  0x0000000000000000000000000000000000000000000000000000000000c6647c
```

## Mise en pratique

Un contrat est déployé à l'adresse `0x84229eeFb7DB3f1f2B961c61E7CbEfd9D4c665E3` sur le [réseau de test Sepolia](https://www.alchemy.com/overviews/sepolia-testnet).

Ce contrat est un jeu dont le code est :

```java
pragma solidity ^0.8.9;

contract GuessingGame {
    address public owner;
    mapping(address => bool) public hasGuessed;
    uint256 private secretNumber; // Déclarée comme private. Est-ce vraiment privé ?
    
    
    constructor() {
        owner = msg.sender;
        secretNumber = 12345; // Ce n'est pas le vrai numéro
    }

    function guess(uint256 _number) public {
        if (_number == secretNumber) {
            hasGuessed[msg.sender] = true;
        }
    }

    function isWinner(address _addr) public view returns (bool) {
      return hasGuessed[_addr];
    }
}
```

Le but est d'appeler la fonction `guess()` en fournissant un numéro. Si vous tombez sur le bon numéro, vous avez gagné, et vous pourrez le prouver avec la fonction `isWinner()`.

Comme nous l'avons vu dans cet article, la variable `secretNumber` a été déclarée comme `private`, mais cela ne vas pas nous empêcher de récupérer cette valeur. Pour cela, utilisons l'outil `cast`.

> Pour vous inciter à essayer, le résultat fourni an dessous n'est pas le résultat réel. A vous de trouver la vraie valeur secrète ! La logique reste la même.

```bash
RPC_URL=https://rpc2.sepolia.org                                        
CONTRACT_ADDR=0x84229eeFb7DB3f1f2B961c61E7CbEfd9D4c665E3

for I in {0..3}
do
    echo "SLOT $I: " $(cast storage $CONTRACT_ADDR $I --rpc-url $RPC_URL)
done

# Output
SLOT 0:  0x00000000000000000000000031d6273610256e6cefd6f26a503c72bb2bdcfe15
SLOT 1:  0x0000000000000000000000000000000000000000000000000000000000000000
SLOT 2:  0x0000000000000000000000000000000000000000000000000000000042424242
SLOT 3:  0x0000000000000000000000000000000000000000000000000000000000000000
```

Nous voyons que les trois premiers slots sont utilisés. Le premier correspond à la première variable d'état, c'est à dire l'adresse `owner`. La deuxième variable semble vide, mais c'est normal. C'est le slot utilisé par le mapping `hasGuessed`.
`secretNumber` est quant à elle enregistrée dans le 3ème slot, et sa valeur est `0x42424242`.

Félicitations, vous avez découvert une variable secrète dans un contrat déployé sur un réseau Ethereum !

Pour interagir avec le contrat, toujours avec l'utilitaire `cast`, voici comment procéder :

```bash
# Pour créer une transaction, on utilise cast send
# Afin de pouvoir signer la transaction, la clé privée doit être fournie.
cast send $CONTRACT_ADDR "guess(uint256)" "10" --private-key 0xabcdabcd...abcd --rpc-url $RPC_URL


# Pour lire des informations sans modifier le storage, on utilise cast call.
# isWinner() n'écrit rien dans le storage, donc pas besoin de lui donner de clé privée. C'est uniquement de la lecture d'information.
# Si l'output est 0, votre adresse n'a toujours pas trouvé le bon numéro.
# Si l'output est 1, félicitations, vous avez trouvé le numéro secret !
cast call $CONTRACT_ADDR "isWinner(address)" "votre addresse" --rpc-url $RPC_URL
```

A vous de jouer !