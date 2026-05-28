/**
 * Upsell popup — opens a <dialog> right after the main PDP "Buy Now" submit.
 * Silently adds the main product (no drawer auto-open), then offers an upsell
 * that applies a Shopify discount code on add. No client-side math: prices and
 * discount enforcement come from Shopify.
 */

const upsell_popup_data = (typeof upsell_product_handle !== 'undefined' && upsell_product_handle && window.get_products_data)
    ? window.get_products_data['upsell-popup-' + upsell_product_handle]
    : null;

function upsellPopupInitPrices() {
    const priceEl = document.querySelector('.upsell-popup .upsell-popup__price');
    const oldEl = document.querySelector('.upsell-popup .upsell-popup__old');

    if (!priceEl) return;

    const price = (typeof upsell_button_price_label !== 'undefined' && upsell_button_price_label)
        ? upsell_button_price_label
        : (upsell_popup_data && upsell_popup_data.price ? upsell_popup_data.price : '');
    const oldPrice = (typeof upsell_button_price_old !== 'undefined' && upsell_button_price_old)
        ? upsell_button_price_old
        : '';

    if (price) priceEl.textContent = price;

    if (!oldEl) return;

    if (!oldPrice || oldPrice === price) {
        oldEl.textContent = '';
        oldEl.classList.add('d-none');
    } else {
        oldEl.textContent = oldPrice;
        oldEl.classList.remove('d-none');
    }
}

async function upsellPopupHandleBuyNow(e) {
    const form = e.target;
    if (!form || !form.matches) return;
    if (!form.matches('.hero-product .c-buy-block form[action$="/cart/add"]:not([data-static="true"])')) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const formData = new FormData(form);
    const variantId = formData.get('id');
    const quantity = parseInt(formData.get('quantity'), 10) || 1;
    if (!variantId) return;

    const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root)
        ? window.Shopify.routes.root
        : '/';

    try {
        await fetch(root + 'cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [{ id: variantId, quantity: quantity }] }),
            credentials: 'same-origin'
        });
    } catch (err) {
        console.error('upsell-popup silent add failed:', err);
        return;
    }

    try {
        if (window.CartDrawer && typeof window.CartDrawer.refreshDrawer === 'function') {
            await window.CartDrawer.refreshDrawer();
        }
        if (window.CartDrawer && typeof window.CartDrawer.getCartState === 'function') {
            window.CartDrawer.getCartState().then(function (cart) {
                const counter = document.querySelector('.cart-count');
                if (counter && cart) counter.textContent = cart.item_count;
            }).catch(function () {});
        }
    } catch (err) {
        console.error('upsell-popup refresh failed:', err);
    }

    const dialog = document.getElementById('upsellPopup');
    if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
    }
}

async function upsellPopupHandleAddToCart(e) {
    e.preventDefault();

    const discountCode = typeof upsell_discount_code !== 'undefined' && upsell_discount_code
        ? upsell_discount_code
        : 'MASK&MOFFER';

    if (!upsell_popup_data || !upsell_popup_data.variant_id) {
        console.error('upsell-popup: upsell product data missing');
        return;
    }

    const input = [{ id: upsell_popup_data.variant_id, quantity: 1 }];

    try {
        if (window.CartDrawer && typeof window.CartDrawer.addToCartJson === 'function') {
            await window.CartDrawer.addToCartJson(input);
        } else if (typeof addToCartJson === 'function') {
            await addToCartJson(input);
        }
    } catch (err) {
        console.error('upsell-popup addToCart failed:', err);
    }

    try {
        await fetch('/discount/' + encodeURIComponent(discountCode), { credentials: 'same-origin' });
    } catch (err) {
        console.error('upsell-popup applyDiscount failed:', err);
    }

    const dialog = document.getElementById('upsellPopup');
    if (dialog && typeof dialog.close === 'function') {
        dialog.close();
    }
}

function upsellPopupHandleContinue(e) {
    e.preventDefault();
    const dialog = document.getElementById('upsellPopup');
    if (dialog && typeof dialog.close === 'function') {
        dialog.close();
    }
    document.getElementById('cartCanvasBtn')?.click();
}

(function initUpsellPopup() {
    upsellPopupInitPrices();

    document.addEventListener('submit', upsellPopupHandleBuyNow, true);

    const addBtn = document.querySelector('.upsell-popup .btn--primary');
    if (addBtn) addBtn.addEventListener('click', upsellPopupHandleAddToCart);

    const continueLink = document.querySelector('.upsell-popup__continue');
    if (continueLink) continueLink.addEventListener('click', upsellPopupHandleContinue);
})();
