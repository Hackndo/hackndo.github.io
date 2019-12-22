---
title: 'wget - segfault: Résumé'
date: 2015-06-11
author: "Pixis"
layout: post
permalink: /wget-segfault-resume/
disqus_identifier: 0000-0000-0000-0007
description: "Un segfault dans wget ? Analyse technique du pourquoi du comment pour proposer un patch !"
cover: assets/uploads/2015/06/WGETSEGFAULT.jpg
tags:
  - "User Land"
  - Linux
---
Salut à tous, **winw** m'a montré récemment un truc assez sympa. Dans un terminal, tapez la commande

```bash
$ wget -r %3a
Segmentation fault
```

Vous obtiendrez un segfault.

<!--more-->

C'est d'autant plus sympa que wget est un binaire très largement utilisé. Les bugs comme celui-ci se font rares ! On s'est alors demandé ce qu'on pouvait bien en faire, et si on pouvait le corriger. Nous ne nous sommes donc pas arrêtés là, et on a cherché la cause du problème.

## Environnement de debug

Pour cela, nous nous sommes armés de ce bon vieux gdb, ainsi que des sources de la dernière version de wget en date (1.16.3) disponible ici :

<http://ftp.gnu.org/gnu/wget/wget-1.16.3.tar.gz>

Dans un premier temps, nous avons recompilé le binaire afin d'en avoir une version non strippée et donc avoir accès aux symboles. Dans le dossiers des sources de wget :

```bash
$ ./configure --user-prefix=/home/hackndo/wget
$ make && sudo make install
```

## Reproduction du bug

Ensuite nous avons provoqué le segfault dans gdb puis affiché la backtrace pour trouver où se situe le problème

```bash
gdb$ r -r %3a
warning: no loadable sections found in added symbol-file system-supplied DSO at 0x7ffff7ffa000
[Thread debugging using libthread_db enabled]
Using host libthread_db library "/lib/x86_64-linux-gnu/libthread_db.so.1".

Program received signal SIGSEGV, Segmentation fault.
-----------------------------------------------------------------------------------------------------------------------[regs]
RAX: 0x0000000000000006  RBX: 0x0000000000000000  RBP: 0x000000000065FFE0  RSP: 0x00007FFFFFFFDF10  o d I t s z a p c
RDI: 0x00000000FFFFFFFF  RSI: 0x00007FFFF7FF7000  RDX: 0x00007FFFF799CDF0  RCX: 0x00007FFFF76E59D0  RIP: 0x0000000000421ADB
R8 : 0x00007FFFF7FF7001  R9 : 0x00007FFFF7FE9700  R10: 0x0000000000000000  R11: 0x0000000000000246  R12: 0x000000000065FFB0
R13: 0x000000000065F950  R14: 0x00007FFFFFFFE05A  R15: 0x00007FFFFFFFE060
CS: 0033  DS: 0000  ES: 0000  FS: 0000  GS: 0000  SS: 002B
-----------------------------------------------------------------------------------------------------------------------
```

## Recherche de la cause

```bash
=> 0x421adb <getproxy+27>:  mov    esi,DWORD PTR [rbx+0x18]
   0x421ade <getproxy+30>:  mov    edi,0x44af12
   0x421ae3 <getproxy+35>:  xor    eax,eax
   0x421ae5 <getproxy+37>:  call   0x402f10 <printf@plt>
   0x421aea <getproxy+42>:  mov    rdi,QWORD PTR [rip+0x23b2bf]        # 0x65cdb0 <opt+304>
   0x421af1 <getproxy+49>:  mov    rsi,QWORD PTR [rbx+0x10]
   0x421af5 <getproxy+53>:  test   rdi,rdi
   0x421af8 <getproxy+56>:  je     0x421b03 <getproxy+67>
-----------------------------------------------------------------------------------------------------------------------------
0x0000000000421adb in getproxy ()
gdb$ bt
#0  0x0000000000421adb in getproxy ()
#1  0x00000000004226fa in retrieve_url ()
#2  0x00000000004204a0 in retrieve_tree ()
#3  0x0000000000404168 in main ()
```

Le segfault se produit dans la fonction `getproxy` se trouvant dans **retr.c**

```c
getproxy (struct url *u)
```

Après quelques petites recherches, on remarque que le pointeur `u` sur une structure `url` est un pointeur null, et du coup à la ligne

```c
if (no_proxy_match (u->host, (const char **)opt.no_proxy))
```

la tentative d'accès au champ `host` de la structure provoque le segfault.

Très bien, nous avons isolé la cause du segfault. Cependant, comment se fait-il que le pointeur `u` passé à `getproxy` soit nul ? Nous remontons alors un peu la backtrace.
  
Dans `retrieve_url`, toujours dans le même fichier

```c
uerr_t retrieve_url (struct url * orig_parsed, const char *origurl, char **file,
char **newloc, const char *refurl, int *dt, bool recursive,
struct iri *iri, bool register_status)
```

On voit l'appel à `getproxy`

```c
proxy = getproxy (u);
```

Et on voit plus haut que `u` est défini comme ceci :

```c
struct url *u = orig_parsed
```

En mettant un breakpoint à l'entrée de la fonction `retrieve_url`, on se rend compte que le paramètre `orig_parsed` est déjà un pointeur nul. On continue et on remonte la backtrace d'un cran, en allant voir la fonction `retrieve_tree` située dans le fichier `recur.c`

```c
uerr_t retrieve_tree (struct url *start_url_parsed, struct iri *pi)
```

On voit l'appel à la fonction `retrieve_url` ici

```c
status = retrieve_url (url_parsed, url, &file, &redirected, referer,
&dt, false, i, true);
```

Nous avons dit que le paramètre `url_parsed` était nul. Ce pointeur est défini une ligne au dessus :

```c
struct url *url_parsed = url_parse (url, &url_err, i, true);
```

Cette fois-ci, aucun des paramètres passés à `url_parse` ne sont nuls. Cette fonction renvoie donc un pointeur nul. En mettant un breakpoint juste après l'appel à cette fonction, on peut voir ce qu'il y a dans `url_err` : Le numéro 8.
  
Le code d'erreur 8 est défini dans le fichier `url.c` (dans lequel il y a la fonction `url_parse`)

```c
#define PE_INVALID_IPV6_ADDRESS         8
```

Effectivement, dans la fonction `url_parse`, nous avons la vérification suivante :

```c
/* Check if the IPv6 address is valid. */
if (!is_valid_ipv6_address(host_b, host_e))
{
    error_code = PE_INVALID_IPV6_ADDRESS;
    goto error;
}

/* Continue parsing after the closing ']'. */
```

Je vous rappelle que l'argument que nous avons passé à wget était `-r %3a` or `%3a` est le code ASCII de `:` . En amont, wget a détecté notre `:` et a donc considéré que c'était une adresse IPv6. Celle-ci étant invalide, `is_valid_ipv6_address()` renvoie `false`, et nous avons le code d'erreur. Tout est bien et se passe comme prévu par les développeurs à ce moment là.

L'erreur, c'est dans le fichier `recur.c` avec ces lignes :

```c
struct url *url_parsed = url_parse (url, &url_err, i, true);
status = retrieve_url (url_parsed, url, &file, &redirected, referer,
&dt, false, i, true);
```

Il n'y a aucune vérification de faite sur le retour de la fonction `url_parse`, et le pointeur `url_parsed` est utilisé sans vérifier s'il est nul, ou non.
  
Nous avons donc, logiquement, un segfault. De notre point de vue, cet oubli ne permet aucune exploitation, mais c'était une analyse intéressante. Un fix est de vérifier que la fonction `url_parse` a renvoyé un pointeur non nul, de la manière suivante :

```c
struct url *url_parsed = url_parse (url, &url_err, i, true);

if (!url_parsed)
{
    char *error = url_error (url, url_err);
    logprintf (LOG_NOTQUIET, "%s: %s.\n",url, error);
    xfree (error);
    inform_exit_status (URLERROR);
}
else
{
    status = retrieve_url (url_parsed, url, &file, &redirected, referer,
    &dt, false, i, true);
    // [...]
```

Nous avons d'ailleurs proposé un fix à GNU. Nous verrons s'il sera accepté !

Ce problème n'existe pas si le paramètre `-r` est omis, puisque cet oubli de vérification se situe seulement dans le fichier `recur.c`, et nulle part ailleurs.

## Correction du bug

Nous avons envoyé un fix qui a été accepté et [est mergé dans la branche master](https://savannah.gnu.org/bugs/?45289#comment5){:target="blank"} ! Voilà, une petite contribution au monde libre, ça fait plaisir 🙂
