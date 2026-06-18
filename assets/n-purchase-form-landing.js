const __section_landing = document.currentScript.getAttribute('data-section');
const __form_landing = document.currentScript.getAttribute('data-form');


__landing__initTemplate(__landing__getProductType());

document.querySelectorAll('.' + __section_landing + ' .purchase_form_lading_product_type_item').forEach(function(element) {
    element.addEventListener('click', function(e) {
        if (e.target.tagName === 'INPUT') return; //to skip second click
        const id = this.id;
        __landing__initTemplate(id);
    });
});

document.querySelectorAll('.' + __section_landing + ' .e-pill-tabs--selector').forEach(function(element) {
    element.addEventListener('click', function(e) {
        __landing__initTemplate(__landing__getProductType());
    });
});

function __landing__initTemplate(source) {
    if(!source) return;

    //const template_form = document.getElementById(__form_landing + '-source-' + source);

    let template_name = __form_landing + '-source-' + source;

    let checkedInput = document.querySelector('.' + __section_landing + ' input[type="radio"][name="delivery-type"]:checked');
    if(checkedInput) {
        if(checkedInput.value == 'subscription') {
            template_name = __form_landing + '-source-' + source + '-subscription';
        }
    }

    const template_form = document.getElementById(template_name);
    const target = document.getElementById(__form_landing + '-body-' + __section_landing);

    if (template_form && target) {
        const content = template_form.content.cloneNode(true);
        target.innerHTML = '';
        target.appendChild(content);
        __landing__initScripts();
        __landing__initProduct();
        __landing__bindForm();

        if (typeof __gpd_update === "function") {
            __gpd_update();
        }

        __landing__setVariantFromUrl();
    }               
}

function __landing__getProductType() {

    let checkedInput = document.querySelector('.' + __section_landing + ' input[type="radio"][name="purchase_form_lading_product_type_'+ __form_landing + '"]:checked');

    if (!checkedInput) {
        checkedInput = document.querySelector('.' + __section_landing + ' input[type="radio"][name="purchase_form_lading_product_type_'+ __form_landing + '"]');
    }
    
    if (checkedInput) {
        checkedInput.checked = true;
        const purchase_form_lading_product_type_item = checkedInput.closest('.purchase_form_lading_product_type_item');
        if (purchase_form_lading_product_type_item && purchase_form_lading_product_type_item.id) {
            return purchase_form_lading_product_type_item.id;
        }
    }

    return false;
}

function __landing__initProduct() {
    let checkedInput = document.querySelector('.' + __section_landing + ' input[type="radio"][name="purchase_form_lading_product_variant_'+ __form_landing + '"]:checked');

    if (!checkedInput) {
        checkedInput = document.querySelector('.' + __section_landing + ' input[type="radio"][name="purchase_form_lading_product_variant_'+ __form_landing + '"]');
    }

    if(checkedInput)
    {
        checkedInput.checked = true;
        const purchase_form_lading_product_variant_selector = checkedInput.closest('.purchase_form_lading_product_variant_selector');

        if (purchase_form_lading_product_variant_selector) {
            purchase_form_lading_product_variant_selector.click();
        }


    }           
}

function __landing__initScripts() {
    document.querySelectorAll('.' + __section_landing + ' .purchase_form_lading_product_variant_selector').forEach(el => {
        el.addEventListener('click', __landing__handlerProductVariantSelector);
    });
}

function __landing__handlerProductVariantSelector(e) {
    if (e.target.tagName === 'INPUT') return;  //to skip second click

    const product_variant_id = this.getAttribute("data-product_variant_id");
    const soldout = this.getAttribute("data-soldout");
    const preorder = this.getAttribute("data-preorder");
    const product_selling_plan = this.getAttribute("data-product-selling-plan");
    const variant_title = this.getAttribute("data-variant-title");

    __landing__updateProductCheckbox(this);
    __landing__updateProductFormButton(product_variant_id, soldout);
    __landing__clearPreorderBoxes();
    __landing__tooglePreorderBox(preorder, product_variant_id);
    __landing__updateSellingPlan(this, product_selling_plan, soldout, preorder);
    __landing__updateStickyButton(variant_title);
    __landing__BackInStock(soldout);
    __landing__SubscriptionForm(this,product_selling_plan);

    if(!product_selling_plan) {
        __landing_updateButtonLabel(this);
    }
    else {
        if(soldout == 'true') {
            __landing_updateButtonLabel(this);
        }
        else {
            if(__landing_isSellingPlanDisabled()) {
                __landing_updateButtonLabel(this);
            }
        }
    }

    const payTodayContainer = document.querySelector("." + __section_landing + " .pay_today");
    if (payTodayContainer) {
        payTodayContainer.textContent = this.getAttribute("data-pay") || "";
    }

    setTimeout(() => {
        purchase_form_landing_event(__section_landing, this, product_variant_id);
    }, 500)

}

function __landing__SubscriptionForm(element, product_selling_plan) {
    __landing_updateButtonLabel(element);

    const details = document.getElementById('subscription-details');

    if(details) {
        if(product_selling_plan) {
            details.classList.remove('hide');
        }
        else {
            details.classList.add('hide');
        }
    }

    const form = document.querySelector('.' + __section_landing + ' .c-order-button form[action="/cart/add"]');
    if (!form) return;

    const sellingPlanInput = form.querySelector('input[name="selling_plan"]');
    if (!sellingPlanInput) return;

    sellingPlanInput.value = product_selling_plan;
}

function __landing__BackInStock(soldout) {
    const element = document.getElementById('back-in-stock-landing');

    if(element) {
        if(soldout == 'true') {
            element.classList.remove('hide');
        }
        else {
            element.classList.add('hide');
        }
    }
}

function __landing__updateStickyButton(variant_title) {
    if(!variant_title)  return;

    const input = document.querySelector('.cta-bar__selector input[type="radio"][data-variant-title="' + variant_title + '"]');
    if (input) {
        input.checked = true;

        //click
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }

    if (typeof selectOption === "function") {
        selectOption(variant_title);
    }
}

function __landing_updateButtonLabel(element) {
    const btnValueContainer = document.querySelector("." + __section_landing + " .add-cart-button");
    if (btnValueContainer) {
        btnValueContainer.textContent = element.getAttribute("data-per") || "";
    }

    const btnStickyValueContainer = document.querySelector(".add-cart-sticky-button");
    if (btnStickyValueContainer) {
        btnStickyValueContainer.textContent = element.getAttribute("data-per") || "";
        btnStickyValueContainer.style.pointerEvents = 'auto';
        btnStickyValueContainer.style.cursor = 'pointer';
    
        if (btnStickyValueContainer.textContent.trim().toLowerCase() === 'sold out') {
            btnStickyValueContainer.style.pointerEvents = 'none';
            btnStickyValueContainer.style.cursor = 'not-allowed';
        }
    }
}

function __landing__updateSellingPlan(element, product_selling_plan, soldout, preorder) {
    if (!product_selling_plan) return;

    const subscriptionBox = document.getElementById('purchase_form_landing_subscription');
    if (!subscriptionBox) return;

    if (soldout == 'true') {
        subscriptionBox.style.display = 'none';
    } else {
        subscriptionBox.style.display = '';
    }

    const form = document.querySelector('.' + __section_landing + ' .c-order-button form[action="/cart/add"]');
    if (!form) return;

    const sellingPlanInput = form.querySelector('input[name="selling_plan"]');
    if (!sellingPlanInput) return;

    sellingPlanInput.value = product_selling_plan;

    __updateSellingPlanButtonLabel(preorder);

    document.querySelectorAll('.' + __section_landing + ' .c-subscribe-selector__item').forEach(el => {
        el.removeEventListener('click', el.__landing_subscriptionClickHandler);
        el.__landing_subscriptionClickHandler = () => {
            if (el.classList.contains('one_time_purchase')) {
                sellingPlanInput.setAttribute('disabled', 'disabled');
                __landing_updateButtonLabel(element);
            } else {
                sellingPlanInput.removeAttribute('disabled');
                __updateSellingPlanButtonLabel(preorder);
            }

            if(__section_landing) {
              purchase_form_landing_event(__section_landing, element, element.dataset.product_variant_id);
            }
        };
        el.addEventListener('click', el.__landing_subscriptionClickHandler);
    });
}

function __updateSellingPlanButtonLabel(preorder) {
    let targetEl = document.querySelector('.save-subscription') || document.querySelector('[data-per]');
    let value;

    if (targetEl) {

        if(preorder == 'true') {
            value = targetEl.getAttribute('data-per-preorder') || targetEl.textContent.trim();
        }
        else {
            value = targetEl.getAttribute('data-per') || targetEl.textContent.trim();
        }
        
        const btnValueContainer = document.querySelector("." + __section_landing + " .add-cart-button");
        if (btnValueContainer) {
            btnValueContainer.textContent = value || "";
        }

        const btnStickyValueContainer = document.querySelector(".add-cart-sticky-button");
        if (btnStickyValueContainer) {
            btnStickyValueContainer.textContent = value || "";
        }
    }
}

function __landing_isSellingPlanDisabled() {
    const form = document.querySelector('.' + __section_landing + ' .c-order-button form[action="/cart/add"]');
    if (!form) return;

    const sellingPlanInput = form.querySelector('input[name="selling_plan"]');
    if (!sellingPlanInput) return;

    return sellingPlanInput.hasAttribute("disabled");
}

function __landing__updateProductCheckbox(element)
{
    document.querySelectorAll('.' + __section_landing + ' input[type="radio"][name="purchase_form_lading_product_variant_'+ __form_landing + '"').forEach(input => {
      input.checked = false;
    });

    const input = element.querySelector('.' + __section_landing + ' input[type="radio"][name="purchase_form_lading_product_variant_'+ __form_landing + '"');
    if (input) {
      input.checked = true;
    }
}

function __landing__updateProductFormButton(product_variant_id, soldout) {
    if (!product_variant_id) return;

    const form = document.querySelector('.' + __section_landing + ' .c-order-button form[action="/cart/add"]');

    if (form) {
        const idInput = form.querySelector('input[name="id"]');
        const button = form.querySelector('.add-cart-button');

        if (idInput) {
            if (soldout === 'true') {
                idInput.value = "";
                if (button) button.disabled = true;
            } else {
                idInput.value = product_variant_id;
                if (button) button.disabled = false;
            }
        }
    }
}

function __landing__setVariantFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const variantId = params.get("variant");

  if (!variantId) return;
    
  if (variantId) {
    const el = document.querySelector('.' + __section_landing + ' .purchase_form_lading_product_variant_selector[data-product_variant_id="' + variantId + '"]');
    if (el) {
      el.click();
      params.delete("variant");
      const newUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  }
}

function __landing__bindForm() {
    const form = document.querySelector('.' + __section_landing + ' .c-order-button form[action="/cart/add"]');
    if (!form || form.dataset.bound === '1') return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        addToCart(formData);
    }, { passive: false });

    form.dataset.bound = '1';
}

function __landing__clearPreorderBoxes()
{
    document.querySelectorAll('.' + __section_landing + ' .' + __form_landing + '-preorder-box-item').forEach(el => {
        el.innerHTML = '';
    });
}

function __landing__tooglePreorderBox(preorder, product_variant_id) {
    const preorderBox = document.querySelector('.' + __section_landing + ' .preorder_box');
    const targetBox = document.querySelector('.' + __section_landing + ' .' + __form_landing + '-preorder-box__' + product_variant_id);

    if (!preorderBox || !targetBox) return;
    
    if(preorder === 'true')
    {
        if (preorderBox) 
        {
            preorderBox.classList.remove('hide');
            targetBox.appendChild(preorderBox.cloneNode(true));
            preorderBox.classList.add('hide');

            __landing__updatePreorderBox(targetBox, product_variant_id);
        }
    }
    else
    {
        if (preorderBox) 
        {
            preorderBox.classList.add('hide');
        }
    }
}

function __landing__updatePreorderBox(targetBox, product_variant_id)
{
    const preorder_text = document.querySelector('.' + __section_landing + ' .' + __form_landing + '-product-preorder-text__' + product_variant_id);
    if (preorder_text && preorder_text.innerHTML !== '') {
        targetBox.querySelector('.preorder_text').innerHTML = preorder_text.innerHTML;
    }

    const preorder_date_soldout = document.querySelector('.' + __section_landing + ' .' + __form_landing + '-product-preorder_date_soldout__' + product_variant_id);
    if (preorder_date_soldout && preorder_date_soldout.innerHTML !== '') {
        targetBox.querySelector('.preorder_date_soldout').innerHTML = preorder_date_soldout.innerHTML;
    }

    const preorder_date_reserved = document.querySelector('.' + __section_landing + ' .' + __form_landing + '-product-preorder_date_reserved__' + product_variant_id);
    if (preorder_date_reserved && preorder_date_reserved.innerHTML !== '') {
        targetBox.querySelector('.preorder_date_reserved').innerHTML = preorder_date_reserved.innerHTML;
    }

    const preorder_percent = document.querySelector('.' + __section_landing + ' .' + __form_landing + '-product-preorder_percent__' + product_variant_id);
    if (preorder_percent && preorder_percent.innerHTML !== '') {
        targetBox.querySelector('.preorder_percent').innerHTML = preorder_percent.innerHTML;

        const match = preorder_percent.innerHTML.match(/\d+/);
        if (match) {
            const percentText = match[0];
            targetBox.querySelector('.preorder_percent_style').style.setProperty('--data-reserved', percentText + '%');
        }                
    }            
}