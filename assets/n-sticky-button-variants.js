(() => {
    const stickyButton = document.querySelector('.add-cart-sticky-button');
    if (stickyButton) {
        stickyButton.addEventListener('click', function () {
            const form = document.querySelector('.purchase-form-wrapper form[data-static="true"]');
            if (!form) return;
            form.requestSubmit();
        });
    }

    const stickyInputs = [...document.querySelectorAll('.cta-bar__selector input[type="radio"]')];
    if (!stickyInputs.length) return;

    // Option selectors of the landing purchase form, in display order.
    // Resolved on every call: the form body is re-rendered from templates.
    const getFormSelectors = () => {
        if (typeof __section_landing === 'undefined' || !__section_landing) return [];

        const first = document.querySelector('.' + __section_landing + ' .purchase_form_landing_product_variant_selector');
        if (!first || !first.parentElement) return [];

        return [...first.parentElement.children].filter(el => el.classList.contains('purchase_form_landing_product_variant_selector'));
    };

    // Match by title first, fall back to the option position
    const findFormSelector = (input) => {
        const selectors = getFormSelectors();
        const title = input.getAttribute('data-variant-title');

        return selectors.find(el => el.getAttribute('data-variant-title') === title) || selectors[stickyInputs.indexOf(input)] || null;
    };

    stickyInputs.forEach((input) => {
        input.addEventListener('click', () => {
            const selector = findFormSelector(input);
            if (selector) selector.click();
        });
    });

    // Initial state: reflect the option already selected in the form
    const current = getFormSelectors().find(el => {
        const radio = el.querySelector('input[type="radio"]');
        return el.classList.contains('active') || (radio && radio.checked);
    });

    if (current && typeof __landing__updateStickyButton === 'function') {
        __landing__updateStickyButton(current.getAttribute('data-variant-title'), current);
    }
})();
