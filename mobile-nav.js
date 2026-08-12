// Menu hamburger mobile/tablette (<=900px) — bouton unique partagé par toutes
// les pages publiques. Chaque page .dc.html est un composant React qui se
// re-rend en entier au moindre setState (ex: frappe dans un champ de
// formulaire), donc tout élément injecté À L'INTÉRIEUR de l'arbre React
// (le <x-dc>) serait effacé au prochain rendu. On évite ça comme navguard.js :
// le bouton est ajouté en dehors de la racine React (enfant direct de
// <body>), et l'ouverture/fermeture du menu passe uniquement par une classe
// sur <html> lue par responsive.css — rien n'est modifié dans le DOM généré
// par React, donc rien ne peut être écrasé par un re-render.
//
// Le bouton est en position:absolute (pas fixed) : il doit défiler avec la
// page et disparaître au scroll, exactement comme Compte/Panier dans le
// header — pas rester collé à l'écran en permanence. Sur ce site, <body> est
// lui-même le conteneur de scroll (overflow-y interne) mais reste
// position:static ; un absolute sans ancêtre positionné remonte alors
// jusqu'à la zone racine (qui ne défile pas), pas jusqu'au contenu qui
// défile. Solution sans toucher au <body> global (qui pourrait affecter
// d'autres éléments absolute du site) : un petit wrapper position:relative,
// height:0, inséré tout en haut de <body> — il défile normalement avec le
// reste du contenu, et le bouton s'y positionne en absolute par rapport à
// lui.
(function () {
  var OPEN_CLASS = 'nasap-nav-open';

  function setOpen(btn, open) {
    document.documentElement.classList.toggle(OPEN_CLASS, open);
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function init() {
    if (document.querySelector('.nasap-nav-toggle')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nasap-nav-toggle';
    btn.setAttribute('aria-label', 'Menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';

    btn.addEventListener('click', function () {
      setOpen(btn, !document.documentElement.classList.contains(OPEN_CLASS));
    });

    // referme le menu si on clique un lien à l'intérieur (navigation) ou en
    // dehors du menu/bouton (clic sur le fond de page)
    document.addEventListener('click', function (e) {
      if (!document.documentElement.classList.contains(OPEN_CLASS)) return;
      if (e.target.closest('.nasap-nav-toggle')) return;
      if (e.target.closest('a')) { setOpen(btn, false); return; }
      setOpen(btn, false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setOpen(btn, false);
    });

    var anchor = document.createElement('div');
    anchor.className = 'nasap-nav-toggle-anchor';
    anchor.appendChild(btn);
    document.body.insertBefore(anchor, document.body.firstChild);
  }

  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
