/* hackndo - scripts du theme (vanilla JS, sans dependance) */
(function () {
  'use strict';

  var sidebar = document.querySelector('.cd-side-nav');
  var sidebarTrigger = document.querySelector('.cd-nav-trigger');
  var mainContent = document.querySelector('.cd-main-content');

  /* Detecte le mode courant via le contenu CSS de .cd-main-content::before */
  function currentMode() {
    if (!mainContent) return 'desktop';
    return window.getComputedStyle(mainContent, '::before')
      .getPropertyValue('content').replace(/['"]/g, '');
  }

  /* Mobile : ouverture/fermeture du menu lateral via le bouton hamburger */
  if (sidebarTrigger && sidebar) {
    sidebarTrigger.addEventListener('click', function (event) {
      event.preventDefault();
      sidebar.classList.toggle('nav-is-visible');
      sidebarTrigger.classList.toggle('nav-is-visible');
    });
  }

  /* Desktop : fixe la sidebar pendant le defilement */
  var scrolling = false;
  function checkSidebarPosition() {
    if (sidebar && mainContent && currentMode() !== 'mobile') {
      var sidebarHeight = sidebar.offsetHeight;
      var windowHeight = window.innerHeight;
      var mainContentHeight = mainContent.offsetHeight;
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      if ((scrollTop + windowHeight > sidebarHeight) && (mainContentHeight - sidebarHeight !== 0)) {
        sidebar.classList.add('is-fixed');
        sidebar.style.bottom = '0';
      } else {
        sidebar.classList.remove('is-fixed');
        sidebar.removeAttribute('style');
      }
    }
    scrolling = false;
  }
  checkSidebarPosition();
  window.addEventListener('scroll', function () {
    if (!scrolling) {
      scrolling = true;
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(checkSidebarPosition);
      } else {
        setTimeout(checkSidebarPosition, 250);
      }
    }
  }, { passive: true });

  var article = document.querySelector('article');

  /* Table des matieres a partir des titres h2 de l'article */
  if (article) {
    var headings = article.querySelectorAll('h2');
    if (headings.length > 0) {
      var nav = document.createElement('nav');
      nav.setAttribute('role', 'navigation');
      nav.className = 'table-of-contents';

      var html = '<div class="title">Dans cet article</div><ul>';
      headings.forEach(function (heading) {
        if (!heading.id) return;
        html += '<li>&raquo; <a href="#' + heading.id + '">' + heading.textContent + '</a></li>';
      });
      html += '</ul>';
      nav.innerHTML = html;

      article.insertBefore(nav, article.firstChild);
    }
  }

  /* Ancres au survol des titres (fournies par anchor.min.js) */
  if (window.anchors) {
    anchors.options.visible = 'hover';
    anchors.add('article h2, article h3, article h4, article h5, article h6');
  }
})();
