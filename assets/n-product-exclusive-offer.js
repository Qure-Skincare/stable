async function handleClick(e) {
    e.preventDefault();

    const discountCode = typeof exclusive_offer_discount_code !== 'undefined' && exclusive_offer_discount_code
        ? exclusive_offer_discount_code
        : 'FREEN&DOFFER';
    const product2VariantId = typeof exclusive_product2_black_variant_id !== 'undefined' && exclusive_product2_black_variant_id
        ? exclusive_product2_black_variant_id
        : (typeof exclusive_product2 !== 'undefined' && exclusive_product2 ? exclusive_product2.variant_id : undefined);

    const input = [
        { id: exclusive_product.variant_id, quantity: 1 },
        { id: product2VariantId, quantity: 1 }
    ];

    try {
        if (window.CartDrawer && typeof window.CartDrawer.addToCartJson === 'function') {
            await window.CartDrawer.addToCartJson(input);
        } else if (typeof addToCartJson === 'function') {
            await addToCartJson(input);
        }
    } catch (err) {
        console.error('exclusive-offer addToCart failed:', err);
    }

    try {
        await fetch('/discount/' + encodeURIComponent(discountCode), { credentials: 'same-origin' });
    } catch (err) {
        console.error('exclusive-offer applyDiscount failed:', err);
    }
}

var cartButtons = document.querySelectorAll('.add-cart-button, #sticky-cta-button, .helmet-home__ordering-btn');

cartButtons.forEach(function (btn) {
    if (!btn.disabled) {
        btn.innerHTML = exclusive_button_label;
    }
    btn.addEventListener('click', handleClick);
});
