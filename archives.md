---
layout: page
title: Archives
---

## Exploits

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "exploit" %}
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