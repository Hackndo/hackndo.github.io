---
layout: page
title: Archives
---

## User-Land

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "userland" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Kernel-Land

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "kernelland" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Crypto

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "crypto" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Tutos

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "tuto" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Web

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "web" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## CTF

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "CTF" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Autres

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "other" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}