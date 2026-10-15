(function () {
    'use strict';

    const GLOBAL_FLAG = '__blueSerumFreeClickBound';
    const BLOCK_SELECTOR = '.c-blue-serum-free';
    const SECTION_SELECTOR = '.shopify-section, .hero-product';
    const BUTTON_SELECTOR =
        '.c-buy-block form[action$="/cart/add"] [type="submit"], #sticky-cta-button';

    const link = typeof blue_serum_free_link === 'string' ? blue_serum_free_link : '';

    if (!link || window[GLOBAL_FLAG]) return;
    window[GLOBAL_FLAG] = true;

    // Only the buy button of the section that renders the block, plus the sticky
    // CTA; sibling /cart/add forms (cross-sell, upsells) keep their own behaviour.
    const isTargetButton = (button) => {
        if (button.id === 'sticky-cta-button') return true;

        const section = button.closest(SECTION_SELECTOR);
        return Boolean(section && section.querySelector(BLOCK_SELECTOR));
    };

    // Capture phase: runs before the theme's own form-submit interception and the
    // other cart handlers, so nothing is added to the cart before the redirect.
    document.addEventListener('click', (event) => {
        const button = event.target.closest(BUTTON_SELECTOR);
        if (!button || button.disabled || !isTargetButton(button)) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        window.location.href = link;
    }, true);
})();
