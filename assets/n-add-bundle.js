function installNAddBundleTouchPrimaryPress(btn) {
  if (btn.dataset.nAddBundleTouchPress === '1') return;
  if (!window.matchMedia('(hover: none)').matches) return;
  btn.dataset.nAddBundleTouchPress = '1';

  function token(name) {
    var v = getComputedStyle(btn).getPropertyValue(name).trim();
    if (!v) v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v;
  }

  function clearPress() {
    btn.style.removeProperty('background-color');
    btn.style.removeProperty('color');
    btn.style.removeProperty('border-color');
  }

  function applyPress() {
    if (btn.disabled) return;
    var bg = token('--btn-primary-bg-hover');
    var fg = token('--btn-primary-color-hover');
    if (!bg || !fg) return;
    btn.style.backgroundColor = bg;
    btn.style.color = fg;
    btn.style.borderColor = token('--btn-primary-bg-hover') || bg;
  }

  btn._nBundleApplyPress = applyPress;
  btn._nBundleClearPress = clearPress;

  btn.addEventListener('touchstart', applyPress, { passive: true });
  btn.addEventListener('touchcancel', clearPress, { passive: true });

  document.addEventListener(
    'touchstart',
    function (e) {
      if (!btn.contains(e.target)) clearPress();
    },
    true
  );
}

function initNAddBundle() {
  document.querySelectorAll('.js-add-bundle').forEach(function (btn) {
    if (btn.dataset.nAddBundleInit === '1') return;
    btn.dataset.nAddBundleInit = '1';

    installNAddBundleTouchPrimaryPress(btn);

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      if (btn.dataset.nAddBundleBusy === '1') return;
      var raw = btn.getAttribute('data-cart-items');
      if (!raw) return;
      var items;
      try {
        items = JSON.parse(raw);
      } catch (e) {
        return;
      }
      if (!items || !items.length) return;
      if (window.matchMedia('(hover: none)').matches && typeof btn._nBundleApplyPress === 'function') {
        btn._nBundleApplyPress();
      }
      btn.dataset.nAddBundleBusy = '1';
      var done = function () {
        delete btn.dataset.nAddBundleBusy;
      };
      var root =
        window.Shopify && window.Shopify.routes && window.Shopify.routes.root
          ? window.Shopify.routes.root
          : '/';
      items
        .reduce(function (chain, item) {
          return chain.then(function () {
            return fetch(root + 'cart/add.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items: [item] }),
              credentials: 'same-origin'
            }).catch(function () {});
          });
        }, Promise.resolve())
        .then(function () {
          document.dispatchEvent(
            new CustomEvent('cart.requestComplete', { detail: { source: 'addToCartJson' } })
          );
        })
        .catch(function () {})
        .finally(done);
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNAddBundle);
} else {
  initNAddBundle();
}
