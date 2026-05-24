/* hackndo - scripts du theme (vanilla JS, sans dependance) */
(function () {
  'use strict';

  /* Menu mobile : ouverture/fermeture du tiroir lateral */
  var toggle = document.querySelector('.nav-toggle');
  var sidebar = document.querySelector('.sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      var open = sidebar.classList.toggle('is-open');
      toggle.classList.toggle('is-active', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    });
  }

  /* Contenu d'article : sommaire + ancres */
  var content = document.querySelector('.post__content');
  if (!content) return;

  /* Table des matieres a partir des titres h2 (avant l'ajout des ancres) */
  var headings = content.querySelectorAll('h2');
  if (headings.length > 0) {
    var nav = document.createElement('nav');
    nav.className = 'toc';
    nav.setAttribute('aria-label', 'Sommaire');

    var html = '<p class="toc__title">Dans cet article</p><ul>';
    headings.forEach(function (heading) {
      if (!heading.id) return;
      html += '<li><a href="#' + heading.id + '">' + heading.textContent + '</a></li>';
    });
    html += '</ul>';
    nav.innerHTML = html;

    content.insertBefore(nav, content.firstChild);
  }

  /* Ancres au survol des titres (fournies par anchor.min.js) */
  if (window.anchors) {
    anchors.options.visible = 'hover';
    anchors.add('.post__content h2, .post__content h3, .post__content h4, .post__content h5, .post__content h6');
  }
})();
