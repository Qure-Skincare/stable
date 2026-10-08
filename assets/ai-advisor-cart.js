/*
 * Qure AI advisor: silent add-to-cart for the theme's cart drawer, without patching
 * assets/n-footer-cart-drawer.js.
 *
 * The drawer's addToCartJson(items) applies the site-wide discount code and threshold gifts,
 * but opens the drawer twice: first by clicking #cartCanvasBtn (synchronously, before any
 * request), then again from reloadDrawer() when the cart.requestComplete event it dispatches
 * carries source "addToCartJson". This wrapper adds addToCartJson(items, { silent: true }):
 * the same call, with that click swallowed and that event re-dispatched as source
 * "ai_advisor", so the drawer re-renders in the background and the chat stays on top.
 *
 * Include after the drawer script, e.g. from snippets/ai-advisor.liquid with `defer`.
 */
(function () {
  var EVENT = 'cart.requestComplete';
  var wrapped = false;

  function install() {
    var drawer = window.CartDrawer;
    if (!drawer || typeof drawer.addToCartJson !== 'function' || wrapped) return !!wrapped;
    wrapped = true;
    var original = drawer.addToCartJson;

    drawer.addToCartJson = function (items, options) {
      if (!options || !options.silent) return original.call(drawer, items);

      var button = document.getElementById('cartCanvasBtn');
      var swallowClick = function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      var relabel = function (event) {
        var detail = event.detail || {};
        if (detail.source !== 'addToCartJson') return;
        event.stopImmediatePropagation();
        document.dispatchEvent(new CustomEvent(EVENT, { detail: Object.assign({}, detail, { source: 'ai_advisor' }) }));
      };
      if (button) button.addEventListener('click', swallowClick, true);
      document.addEventListener(EVENT, relabel, true);

      var pending;
      try {
        pending = original.call(drawer, items);
      } finally {
        // showCart() has already run by now: the click is issued before the first await.
        if (button) button.removeEventListener('click', swallowClick, true);
      }
      var done = function () {
        document.removeEventListener(EVENT, relabel, true);
      };
      return Promise.resolve(pending).then(
        function (result) {
          done();
          return result || drawer.getCartState();
        },
        function (error) {
          done();
          throw error;
        },
      );
    };
    drawer.supportsSilentAdd = true;
    return true;
  }

  if (install()) return;
  // The theme's script loader may define CartDrawer after this file has run.
  var tries = 0;
  var timer = setInterval(function () {
    if (install() || ++tries > 240) clearInterval(timer);
  }, 250);
})();
