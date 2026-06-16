function initNMicroinfusionCompleteSystem() {
  document.querySelectorAll('.complete-system').forEach(function (sectionEl) {
    var bundleButton = sectionEl.querySelector('.js-add-bundle');
    if (!bundleButton) return;

    var cards = sectionEl.querySelectorAll('[data-complete-item]');
    if (!cards.length) return;

    var items = [];
    cards.forEach(function (card) {
      var selectedId = parseInt(card.getAttribute('data-selected-variant-id'), 10);
      if (selectedId) {
        items.push({ id: selectedId, quantity: 1 });
      }
    });

    bundleButton.setAttribute('data-cart-items', JSON.stringify(items));
    bundleButton.disabled = items.length === 0;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNMicroinfusionCompleteSystem);
} else {
  initNMicroinfusionCompleteSystem();
}

window.addEventListener('load', initNMicroinfusionCompleteSystem);
