---
layout: page
title: Archives
---

<form name="category_form">
  <div class="radio-group">
  <input type="radio" id="option-one" name="selector" checked><label for="option-one">Date</label><input type="radio" id="option-two" name="selector"><label for="option-two">Catégories</label>
  </div>
 </form>

<div id="ordered_by_categories" markdown="1" style="display: none;">

## User-Land

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "userland" %}
  {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Kernel-Land

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "kernelland" %}
  {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Hardware

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "hardware" %}
  {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Crypto

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "crypto" %}
  {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Tutos

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "tuto" %}
  {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Web

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "web" %}
  {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## CTF

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "CTF" %}
  {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

## Autres

{% for post in site.posts %}
  {% for tag in post.tags %}
    {% if tag == "other" %}
  {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
    {% break %}
    {% endif %}
  {% endfor %}
{% endfor %}

</div>
<div id="ordered_by_date" markdown="1">

## Tous les articles

{% for post in site.posts %}
  {{ post.date | date_to_string }} &raquo; [ {{ post.title }} ]({{ post.url }})
{% endfor %}

</div>

<script>
    var rad = document.category_form.selector;
    rad[0].onclick = function() {
      document.getElementById("ordered_by_categories").style.display = "none";
      document.getElementById("ordered_by_date").style.display = "block";
    };
    rad[1].onclick = function() {
      document.getElementById("ordered_by_date").style.display = "none";
      document.getElementById("ordered_by_categories").style.display = "block";
    };
</script>