var cartButtons = document.querySelectorAll('.add-cart-button:not([data-label-alt]), #sticky-cta-button');

cartButtons.forEach(function (btn) {
    if (!btn.classList.contains('skip_black_friday_label') && !btn.disabled) {
        btn.innerHTML = buy_and_save_button_label;
    }
});