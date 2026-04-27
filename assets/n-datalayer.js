const click_cart_upsell_event = (upsell_item_id, upsell_item_name) => {
    const event = new CustomEvent('datalayer.pushCustomEvent', {
        detail: {
            event: 'click_cart_upsell',
            url: window.location.pathname,
            upsell_item_id: upsell_item_id,
            upsell_item_name: upsell_item_name,
            unix_time: Math.floor(Date.now() / 1000)
        }
    });

    document.dispatchEvent(event);
}

const purchase_form_landing_event = (target, element, product_variant_id) => {

    const event = new CustomEvent('datalayer.pushCustomEvent', {
        detail: {
            event: 'purchase-form-landing',
            url: window.location.pathname,
            product_variant_id: product_variant_id,
            product_category: document.querySelector('.' + target + ' .variant__input:checked')?.dataset.name,
            product_name: element.getAttribute("data-product-name"),
            product_type: element.getAttribute("data-product-type"),
            product_price: element.getAttribute("data-product-price"),
            preselected: element.getAttribute("data-preselected"),
            product_selling_plan: document.querySelector('.' + target + ' input[name="selling_plan"]')?.disabled ? '0' : document.querySelector('.' + target + ' input[name="selling_plan"]')?.value,
            unix_time: Math.floor(Date.now() / 1000)
        }
    });

    //skip default position of the form
    if(event.detail.product_category === undefined) return;

    document.dispatchEvent(event);
}

const purchase_form_event = (target, element, product_variant_id) => {

    const event = new CustomEvent('datalayer.pushCustomEvent', {
        detail: {
            event: 'purchase-form',
            url: window.location.pathname,
            product_variant_id: product_variant_id,
            product_category: document.querySelector('.' + target + ' .bundle__input:checked')?.dataset.name,
            product_name: element.getAttribute("data-product-name"),
            product_type: element.getAttribute("data-product-type"),
            product_price: element.getAttribute("data-product-price"),
            preselected: element.getAttribute("data-preselected"),
            unix_time: Math.floor(Date.now() / 1000)
        }
    });

    //skip default position of the form
    if(event.detail.product_category === undefined) return;

    document.dispatchEvent(event);
}


document.addEventListener('datalayer.pushCustomEvent', (event) => {
    console.log(event.detail);
    window.dataLayer.push(event.detail);
});
