function registerExclusiveDiscount(code) {
    // The drawer re-sends siteDiscount() via cart/update.js { discount } on every
    // mutation, replacing the cart's applied codes — the offer code must be in
    // that global before the add, or the next mutation wipes it from the cart.
    var codes = String(window.footer_cart_drawer_discount || '')
        .split(',')
        .map(function (c) { return c.trim(); })
        .filter(Boolean);

    if (codes.indexOf(code) === -1) {
        codes.push(code);
    }

    window.footer_cart_drawer_discount = codes.join(',');
}

// The drawer bundle can itself still be loading (sapp defers it until first
// interaction — often this very click), so resolve the add function by
// polling briefly instead of dropping the click.
function waitForAddToCart(timeoutMs) {
    return new Promise(function (resolve) {
        var waited = 0;

        (function check() {
            if (window.CartDrawer && typeof window.CartDrawer.addToCartJson === 'function') {
                return resolve(window.CartDrawer.addToCartJson);
            }
            if (typeof addToCartJson === 'function') {
                return resolve(addToCartJson);
            }
            if (waited >= timeoutMs) {
                return resolve(null);
            }
            waited += 100;
            setTimeout(check, 100);
        })();
    });
}

var exclusiveOfferInFlight = false;

async function handleExclusiveOfferClick(e) {
    e.preventDefault();

    if (exclusiveOfferInFlight) return;
    exclusiveOfferInFlight = true;

    const discountCode = typeof exclusive_offer_discount_code !== 'undefined' && exclusive_offer_discount_code
        ? exclusive_offer_discount_code
        : 'FREEN&DOFFER';
    const product1VariantId = typeof exclusive_product_variant_id !== 'undefined' && exclusive_product_variant_id
        ? exclusive_product_variant_id
        : (typeof exclusive_product !== 'undefined' && exclusive_product ? exclusive_product.variant_id : undefined);
    const product2VariantId = typeof exclusive_product2_black_variant_id !== 'undefined' && exclusive_product2_black_variant_id
        ? exclusive_product2_black_variant_id
        : (typeof exclusive_product2 !== 'undefined' && exclusive_product2 ? exclusive_product2.variant_id : undefined);

    registerExclusiveDiscount(discountCode);

    const input = [
        { id: product1VariantId, quantity: 1 },
        { id: product2VariantId, quantity: 1 }
    ];

    try {
        const addToCart = await waitForAddToCart(8000);

        if (addToCart) {
            await addToCart(input);
        } else {
            // Drawer never arrived: mutate the cart directly and land on /cart.
            await fetch('/cart/add.js', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: input })
            });
            await fetch('/cart/update.js', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discount: discountCode })
            });
            window.location.href = '/cart';
            return;
        }

        // Checkout cookie fallback, strictly AFTER the add: the 302 it follows
        // loads a full page response, and running it in parallel with
        // cart/add.js races for the cart session — the add can land in a cart
        // that gets replaced, leaving an empty cart.
        try {
            await fetch('/discount/' + encodeURIComponent(discountCode), { credentials: 'same-origin' });
        } catch (err) {
            console.error('exclusive-offer applyDiscount failed:', err);
        }
    } catch (err) {
        console.error('exclusive-offer addToCart failed:', err);
    } finally {
        exclusiveOfferInFlight = false;
    }
}

var exclusiveOfferButtonsSelector = '.add-cart-button:not([data-label-alt]), #sticky-cta-button, .helmet-home__ordering-btn';

document.querySelectorAll(exclusiveOfferButtonsSelector).forEach(function (btn) {
    if (!btn.disabled) {
        btn.innerHTML = exclusive_button_label;
    }
});

// Delegated in capture phase: buttons rendered after this script loads (sticky
// CTA) are still intercepted, and the offer handler runs before the theme's
// own form-submit interception.
document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest(exclusiveOfferButtonsSelector) : null;

    if (!btn || btn.disabled) return;

    handleExclusiveOfferClick(e);
}, true);
