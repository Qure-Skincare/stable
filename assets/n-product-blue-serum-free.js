(function () {
    'use strict';

    const GLOBAL_FLAG = '__blueSerumFreeClickBound';
    const BLOCK_SELECTOR = '.c-blue-serum-free';
    const SECTION_SELECTOR = '.shopify-section, .hero-product';
    const BUTTON_SELECTOR =
        '.c-buy-block form[action$="/cart/add"] [type="submit"], #sticky-cta-button';
    const ITEM_PARAM = /^items\[(\d+)\]\[(id|selling_plan|quantity)\]$/;

    const link = typeof blue_serum_free_link === 'string' ? blue_serum_free_link : '';
    const variantId = typeof blue_serum_free_variant_id === 'string' ? blue_serum_free_variant_id : '';
    const sellingPlanId = typeof blue_serum_free_selling_plan_id === 'string' ? blue_serum_free_selling_plan_id : '';

    if (window[GLOBAL_FLAG]) return;
    if (!link && !(variantId && sellingPlanId)) return;
    window[GLOBAL_FLAG] = true;

    // The Skio one-click link nests the real add-to-cart URL inside return_to
    // (/cart/clear?return_to=/cart/add?items...&return_to=/checkout), possibly
    // several levels deep, so return_to is unwrapped until a /cart/add URL is found.
    const findAddUrl = (href) => {
        let url = new URL(href, window.location.origin);

        for (let depth = 0; depth < 5; depth++) {
            if (url.pathname.endsWith('/cart/add')) return url;

            const next = url.searchParams.get('return_to');
            if (!next) return null;

            url = new URL(next, window.location.origin);
        }

        return null;
    };

    const parseItems = (url) => {
        const byIndex = {};

        url.searchParams.forEach((value, key) => {
            const match = ITEM_PARAM.exec(key);
            if (!match) return;

            const index = match[1];
            byIndex[index] = byIndex[index] || {};
            byIndex[index][match[2]] = value;
        });

        return Object.keys(byIndex)
            .sort((a, b) => a - b)
            .map((index) => byIndex[index])
            .filter((item) => item.id);
    };

    const addUrl = link ? findAddUrl(link) : null;
    const linkItems = addUrl ? parseItems(addUrl) : [];
    const returnTo = addUrl ? addUrl.searchParams.get('return_to') || '/cart' : '/cart';

    // Link mode: a plain /cart/add URL with the section product first, then the
    // items from the Skio link, landing where the link's own return_to points.
    // /cart/clear from the link is dropped so the visitor's cart is kept.
    const buildUrl = (productId) => {
        const url = new URL('/cart/add', window.location.origin);
        const lineItems = [{ id: productId, quantity: '1' }].concat(linkItems);

        lineItems.forEach((item, index) => {
            url.searchParams.set('items[' + index + '][id]', item.id);
            url.searchParams.set('items[' + index + '][quantity]', item.quantity || '1');
            if (item.selling_plan) {
                url.searchParams.set('items[' + index + '][selling_plan]', item.selling_plan);
            }
        });
        url.searchParams.set('return_to', returnTo);

        return url.pathname + url.search;
    };

    const getAddToCartJson = () => {
        if (window.CartDrawer && typeof window.CartDrawer.addToCartJson === 'function') {
            return window.CartDrawer.addToCartJson;
        }
        if (typeof addToCartJson === 'function') {
            return addToCartJson;
        }
        return null;
    };

    let inFlight = false;

    // Drawer mode: the section product plus the configured serum variant on its
    // selling plan. The parent variant id is stored on the serum line, the same
    // way n-product-optional-subscription.js does, so the drawer's orphan cleanup
    // removes the serum once the product line is gone.
    const addThroughDrawer = async (productId) => {
        const addToCartJsonFn = getAddToCartJson();
        if (!addToCartJsonFn || inFlight) return;
        inFlight = true;

        try {
            await addToCartJsonFn([
                { id: productId, quantity: 1 },
                {
                    id: variantId,
                    quantity: 1,
                    selling_plan: sellingPlanId,
                    properties: { _optional_subscription_parent: String(productId) }
                }
            ]);
        } catch (err) {
            console.error('blue-serum-free addToCart failed:', err);
        } finally {
            inFlight = false;
        }
    };

    // Only the buy button of the section that renders the block, plus the sticky
    // CTA; sibling /cart/add forms (cross-sell, upsells) keep their own behaviour.
    const isTargetButton = (button) => {
        if (button.id === 'sticky-cta-button') return true;

        const section = button.closest(SECTION_SELECTOR);
        return Boolean(section && section.querySelector(BLOCK_SELECTOR));
    };

    // Capture phase, stopped here: the theme's own form-submit interception and
    // the other cart handlers would otherwise add the product a second time.
    document.addEventListener('click', (event) => {
        const button = event.target.closest(BUTTON_SELECTOR);
        if (!button || button.disabled || !isTargetButton(button)) return;

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const form = button.closest('form');
        const productId = form ? new FormData(form).get('id') : null;

        if (link) {
            window.location.href = linkItems.length > 0 && productId ? buildUrl(productId) : link;
            return;
        }

        if (productId) addThroughDrawer(productId);
    }, true);
})();
