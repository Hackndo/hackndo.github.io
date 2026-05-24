/* hackndo - scripts du theme (vanilla JS, sans dependance) */
(function () {
  'use strict';

  var sidebar = document.querySelector('.sidebar');
  var toggle = document.querySelector('.nav-toggle');
  var desktop = window.matchMedia('(min-width: 900px)');

  /* Menu mobile : ouverture/fermeture du tiroir lateral */
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      var open = sidebar.classList.toggle('is-open');
      toggle.classList.toggle('is-active', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    });
  }

  /* Bureau : la sidebar (position:sticky) defile avec la page puis se fige
     quand on atteint son bas. On regle le decalage "top" selon sa hauteur :
       - si elle tient dans l'ecran  -> top = 0 (figee en haut)
       - si elle est plus haute       -> top = viewport - hauteur (negatif),
         pour qu'elle s'arrete une fois son bas aligne avec le bas de l'ecran. */
  function setSidebarOffset() {
    if (!sidebar) return;
    if (!desktop.matches) { sidebar.style.top = ''; return; }
    var diff = window.innerHeight - sidebar.offsetHeight;
    sidebar.style.top = (diff < 0 ? diff : 0) + 'px';
  }
  setSidebarOffset();
  window.addEventListener('load', setSidebarOffset);
  window.addEventListener('resize', setSidebarOffset);
  if (desktop.addEventListener) {
    desktop.addEventListener('change', setSidebarOffset);
  } else if (desktop.addListener) {
    desktop.addListener(setSidebarOffset);
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
    setSidebarOffset();
  }

  /* Ancres au survol des titres (fournies par anchor.min.js) */
  if (window.anchors) {
    anchors.options.visible = 'hover';
    anchors.add('.post__content h2, .post__content h3, .post__content h4, .post__content h5, .post__content h6');
  }
})();
