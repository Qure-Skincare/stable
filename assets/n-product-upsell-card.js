async function upsellCardHandleClick(e) {
    e.preventDefault();

    const variantId = this.dataset.variantId;

    if (!variantId) {
        return;
    }

    const input = [{ id: variantId, quantity: 1 }];

    try {
        if (window.CartDrawer && typeof window.CartDrawer.addToCartJson === 'function') {
            await window.CartDrawer.addToCartJson(input);
        } else if (typeof addToCartJson === 'function') {
            await addToCartJson(input);
        }
    } catch (err) {
        console.error('upsell-card addToCart failed:', err);
    }
}

document.querySelectorAll('.js-upsell-card-cta').forEach(function (btn) {
    btn.addEventListener('click', upsellCardHandleClick);
});
