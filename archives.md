---
layout: page
title: Archives
---

## Exploits

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "exploit" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ](http://{{ site.url }}{{ post.permalink }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Embedded Systems

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "embedded" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ](http://{{ site.url }}{{ post.permalink }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Systems Security

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "security" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ](http://{{ site.url }}{{ post.permalink }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Software Development

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "software development" %}
  * {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ](http://{{ site.url }}{{ post.permalink }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}