/* Add anchors */
anchors.options.visible = 'hover';
anchors.add('h2, h3, h4, h5, h6');

/* Do not display logo of screen height is too small and logo is not completly displayed */
function is_displayed() {
    var siteLogo = document.getElementById("site-logo");
    var height = document.getElementById("site-logo").getBoundingClientRect().top;
    if(height > 0) {
        siteLogo.style.opacity= '1';
    }
}

/* Table of content */

var ToC =
  "<nav role='navigation' class='table-of-contents'>" +
    "<div class=\"title\">Dans cet article</div>" +
    "<ul>";

if($("article h2").length > 0) {
    $("article h2").each(function() {

      el = $(this);
      title = el.text();
      link = "#" + el.attr("id");

      newLine =
        "<li>" +
          "» <a href='" + link + "'>" +
          title +
          "</a>" +
        "</li>";

      ToC += newLine;

    });

    ToC +=
       "</ul>" +
      "</nav>";

    $("article").prepend(ToC);
}