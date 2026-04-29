function handleClick(e) {
    e.preventDefault();

    __discount = 'FREEN&DOFFER';

    input = [
        { id: exclusive_product.variant_id, quantity: 1 },
        { id: exclusive_product2.variant_id, quantity: 1 }
    ]

    fetch('/discount/' + __discount).then(async () => {
        addToCartJson(input);
    });
}

var cartButtons = document.querySelectorAll('.add-cart-button, #sticky-cta-button');

cartButtons.forEach(function (btn) {
    btn.innerHTML = exclusive_button_label;
    btn.addEventListener('click', handleClick);
});