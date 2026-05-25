/*
 * AIO buy-button toggle.
 *
 * Renders the single `<a class="one-time-purchase">` link inside `.c-buy-block`
 * that:
 *   1. Mirrors the currently active purchase mode (One Time Purchase /
 *      Subscribe & Save) together with the selected variant price.
 *   2. Acts as a toggle: clicking it switches the product list rendered by
 *      `n-purchase-form-landing.js` between the two `product_type` groups by
 *      simulating a click on the opposite radio in
 *      `purchase_form_lading_product_type_*`.
 *
 * Reuses `__landing__initTemplate` from `n-purchase-form-landing.js` so the
 * existing list-loading flow stays the single source of truth.
 */
(function () {
    var script = document.currentScript;
    if (!script) return;

    var sectionId = script.getAttribute('data-section');
    var formName = script.getAttribute('data-form');

    if (!sectionId || !formName) return;

    var typeRadioName = 'purchase_form_lading_product_type_' + formName;
    var variantRadioName = 'purchase_form_lading_product_variant_' + formName;

    function getRoot() {
        return document.querySelector('.' + sectionId);
    }

    function getLink() {
        var root = getRoot();
        return root ? root.querySelector('.one-time-purchase[data-aio-toggle]') : null;
    }

    function getCheckedType(root) {
        return root.querySelector('input[type="radio"][name="' + typeRadioName + '"]:checked');
    }

    function getTypeRadios(root) {
        return root.querySelectorAll('input[type="radio"][name="' + typeRadioName + '"]');
    }

    function getCheckedVariant(root) {
        return root.querySelector('input[type="radio"][name="' + variantRadioName + '"]:checked');
    }

    function readVariantPrice(variantInput) {
        if (!variantInput) return '';
        var item = variantInput.closest('.purchase_form_lading_product_variant_selector');
        if (!item) return '';

        var priceEl = item.querySelector('.igSubPrice, .igPrice');
        if (priceEl) {
            var text = priceEl.textContent.trim();
            if (text) return text;
        }
        return item.getAttribute('data-product-price') || '';
    }

    function updateText() {
        var root = getRoot();
        if (!root) return;
        var link = root.querySelector('.one-time-purchase[data-aio-toggle]');
        if (!link) return;

        var checkedType = getCheckedType(root);
        var typeName = checkedType ? (checkedType.getAttribute('data-name') || '') : '';

        var price = readVariantPrice(getCheckedVariant(root));

        link.textContent = (typeName + (price ? ' ' + price : '')).trim();
    }

    function onToggleClick(e) {
        e.preventDefault();

        var root = getRoot();
        if (!root) return;

        var radios = getTypeRadios(root);
        if (radios.length < 2) return;

        var current = getCheckedType(root) || radios[0];
        var next = null;
        for (var i = 0; i < radios.length; i++) {
            if (radios[i] !== current) {
                next = radios[i];
                break;
            }
        }
        if (!next) return;

        var item = next.closest('.purchase_form_lading_product_type_item');
        if (!item) return;

        radios.forEach(function (r) { r.checked = false; });
        next.checked = true;

        if (typeof __landing__initTemplate === 'function') {
            __landing__initTemplate(item.id);
        } else {
            item.click();
        }

        setTimeout(updateText, 50);
        setTimeout(updateText, 350);
        setTimeout(updateText, 750);
    }

    function bindLink() {
        var link = getLink();
        if (!link) return false;

        if (link.getAttribute('data-aio-init') === '1') return true;
        link.setAttribute('data-aio-init', '1');

        link.addEventListener('click', onToggleClick);
        updateText();

        return true;
    }

    function tryInit(retries) {
        if (bindLink()) return;
        if (retries <= 0) return;
        setTimeout(function () { tryInit(retries - 1); }, 100);
    }

    document.addEventListener('datalayer.pushCustomEvent', function (e) {
        if (!e.detail || e.detail.event !== 'purchase-form-landing') return;
        updateText();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { tryInit(30); });
    } else {
        tryInit(30);
    }
})();
