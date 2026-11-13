// "var" instead of "const": this script is re-executed when the purchase form
// section is swapped by the purchase-form selector (see n-product-page-async-section.js),
// and a top-level "const" would throw "Identifier has already been declared".
var __section_landing = document.currentScript.getAttribute('data-section');
var __form_landing = document.currentScript.getAttribute('data-form');


__landing__initTemplate(__landing__getProductType());

document.querySelectorAll('.' + __section_landing + ' .purchase_form_landing_product_type_item').forEach(function(element) {
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

    if (__landing__isSupplyFirst()) {
        __landing__renderSupplyFirst(source);
        return;
    }

    //const template_form = document.getElementById(__form_landing + '-source-' + source);

    let template_name = __form_landing + '-source-' + source;

    let checkedInput = document.querySelector('.' + __section_landing + ' input[type="radio"][name="delivery-type-landing"]:checked');
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

    let checkedInput = document.querySelector('.' + __section_landing + ' input[type="radio"][name="purchase_form_landing_product_type_'+ __form_landing + '"]:checked');

    if (!checkedInput) {
        checkedInput = document.querySelector('.' + __section_landing + ' input[type="radio"][name="purchase_form_landing_product_type_'+ __form_landing + '"]');
    }
    
    if (checkedInput) {
        checkedInput.checked = true;
        const purchase_form_landing_product_type_item = checkedInput.closest('.purchase_form_landing_product_type_item');
        if (purchase_form_landing_product_type_item && purchase_form_landing_product_type_item.id) {
            return purchase_form_landing_product_type_item.id;
        }
    }

    return false;
}

function __landing__initProduct() {

    if(!__landing__initProductCard()) {

        let checkedInput = document.querySelector('.' + __section_landing + ' input[type="radio"][name="purchase_form_landing_product_variant_'+ __form_landing + '"]:checked');

        if (!checkedInput) {
            checkedInput = document.querySelector('.' + __section_landing + ' input[type="radio"][name="purchase_form_landing_product_variant_'+ __form_landing + '"]');
        }

        if(checkedInput)
        {
            checkedInput.checked = true;
            const purchase_form_landing_product_variant_selector = checkedInput.closest('.purchase_form_landing_product_variant_selector');

            if (purchase_form_landing_product_variant_selector) {
                purchase_form_landing_product_variant_selector.click();
            }
        }
    }          
}

function __landing__initProductCard() {
    const activeSelector = document.querySelector('.' + __section_landing + ' .supply-cards-labels li.purchase_form_landing_product_variant_selector.active');

    if (activeSelector) {
        const activeInput = __landing__getSelectorInput(activeSelector);
        if (activeInput) activeInput.checked = true;
        activeSelector.click();
        return true;
    }

    return false;
}

function __landing__getSelectorInput(element)
{
    let input = element.querySelector('.' + __section_landing + 'input[type="radio"][name="purchase_form_landing_product_variant_'+ __form_landing + '"]');
    if (input) return input;

    const label = element.querySelector('label[for]');
    if (label) {
        input = document.getElementById(label.getAttribute('for'));
        if (input && input.type === 'radio') return input;
    }

    return null;
}

function __landing__initScripts() {
    document.querySelectorAll('.' + __section_landing + ' .purchase_form_landing_product_variant_selector').forEach(el => {
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
    const gift = this.getAttribute("data-gift");
    const gift_selling_plan = this.getAttribute("data-gift-selling-plan");
    const included_gift = this.getAttribute("data-included-gift");
    const discount_code = this.getAttribute("data-discount-code");

    if (this.matches('.supply-cards-labels li.purchase_form_landing_product_variant_selector')) {
        document.querySelectorAll('.' + __section_landing + ' .supply-cards-labels li.purchase_form_landing_product_variant_selector.active').forEach(el => el.classList.remove('active'));
        this.classList.add('active');
    }

    __landing__updateProductCheckbox(this);
    __landing__updateProductFormButton(product_variant_id, soldout);
    __landing__clearPreorderBoxes();
    __landing__tooglePreorderBox(preorder, product_variant_id);
    __landing__updateSellingPlan(this, product_selling_plan, soldout, preorder);
    __landing__updateStickyButton(variant_title, this);
    __landing__BackInStock(soldout);
    __landing__SubscriptionForm(this,product_selling_plan);
    __landing__applyDiscount(gift, discount_code, gift_selling_plan, included_gift);

    // The subscribe label is set by __landing__updateSellingPlan only when the
    // "Subscribe / One-Time" selector exists on the page. In every other case
    // (no selector, sold out, or one-time chosen) use the variant's own label.
    const subscriptionBox = document.getElementById('purchase_form_landing_subscription');
    const useSubscribeLabel = product_selling_plan && soldout != 'true' && subscriptionBox && !__landing_isSellingPlanDisabled();

    if (!useSubscribeLabel) {
        __landing_updateButtonLabel(this);
    }

    const payTodayContainer = document.querySelector("." + __section_landing + " .pay_today");
    if (payTodayContainer) {
        payTodayContainer.textContent = this.getAttribute("data-pay") || "";
    }

    setTimeout(() => {
        purchase_form_landing_event(__section_landing, this, product_variant_id);
    }, 500)

}

function __landing__applyDiscount(gift, discount_code, gift_selling_plan, included_gift) {
    // The "Gift included" box (section `gift` block) follows the variant's
    // `included_gift` setting only; the regular `gift` keeps the in-card notice.
    const giftBox = document.querySelector('.' + __section_landing + ' .c-gift-included-box');
    if (giftBox) giftBox.classList.toggle('hide', !(gift && included_gift));

    const form = document.querySelector('.' + __section_landing + ' .c-order-button form[action="/cart/add"]');
    if (!form) return;

    if(gift)
    {
        __landing__setHiddenInput(form, 'properties[_gift]', gift);
    }
    else
    {
        __landing__removeHiddenInput(form, 'properties[_gift]');
    }

    if(gift && gift_selling_plan)
    {
        __landing__setHiddenInput(form, 'properties[_gift_selling_plan]', gift_selling_plan);
    }
    else
    {
        __landing__removeHiddenInput(form, 'properties[_gift_selling_plan]');
    }

    if(discount_code)
    {
        __landing__setHiddenInput(form, 'properties[_discount_code]', discount_code);
    }
    else
    {
        __landing__removeHiddenInput(form, 'properties[_discount_code]');
    }
}

function __landing__setHiddenInput(form, name, value) {
    let input = form.querySelector('input[name="' + name + '"]');
    if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        form.appendChild(input);
    }
    input.value = value;
}

function __landing__removeHiddenInput(form, name) {
    const input = form.querySelector('input[name="' + name + '"]');
    if (input) {
        input.remove();
    }
}

function __landing__SubscriptionForm(element, product_selling_plan) {
    // Button label is handled in __landing__handlerProductVariantSelector:
    // __landing__updateSellingPlan sets the subscribe label, and the block after
    // it falls back to the one-time label. Resetting it here would override the
    // subscribe label with the variant's one-time "data-per".

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

function __landing__updateStickyButton(variant_title, element) {
    const input = __landing__findStickyInput(variant_title, element);
    if (input && !input.checked) {
        input.checked = true;

        // "change" refreshes the sticky dropdown label (cta-bar.js). No "click" here:
        // the sticky bar selects the form option on click, which would loop back to this handler.
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (typeof selectOption === "function") {
        selectOption(variant_title);
    }
}

// Sticky options are matched by title first. When titles differ
// (e.g. "6 Months" in the sticky bar vs "180 Days Supply" in the form), match by position.
function __landing__findStickyInput(variant_title, element) {
    const inputs = [...document.querySelectorAll('.cta-bar__selector input[type="radio"]')];
    if (!inputs.length) return null;

    if (variant_title) {
        const byTitle = inputs.find(input => input.getAttribute('data-variant-title') === variant_title);
        if (byTitle) return byTitle;
    }

    if (!element || !element.parentElement) return null;

    const selectors = [...element.parentElement.children].filter(el => el.classList.contains('purchase_form_landing_product_variant_selector'));
    return inputs[selectors.indexOf(element)] || null;
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

    // "Hide subscription option" on the subscription block: only one-time purchase
    // is offered, so the selling plan is never submitted.
    if (subscriptionBox.dataset.onetimeOnly === 'true') {
        sellingPlanInput.setAttribute('disabled', 'disabled');
        return;
    }

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
    document.querySelectorAll('.' + __section_landing + ' input[type="radio"][name="purchase_form_landing_product_variant_'+ __form_landing + '"').forEach(input => {
      input.checked = false;
    });

    const input = __landing__getSelectorInput(element);
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
            // A sold-out button gets type="button": the BookEasy app re-enables every
            // type="submit" button of a /cart/add form once its scripts load.
            if (soldout === 'true') {
                idInput.value = "";
                if (button) {
                    button.type = 'button';
                    button.disabled = true;
                }
            } else {
                idInput.value = product_variant_id;
                if (button) {
                    button.type = 'submit';
                    button.disabled = false;
                }
            }
        }
    }
}

function __landing__setVariantFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const variantId = params.get("variant");

  if (!variantId) return;
    
  if (variantId) {
    const el = document.querySelector('.' + __section_landing + ' .purchase_form_landing_product_variant_selector[data-product_variant_id="' + variantId + '"]');
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

// "Supply first" mode (section setting "supply_first", list type only).
// Every supply card is shown at once, and the product type row shows only the
// types that have the selected supply. The cards are cloned from the same
// per-type templates as in the classic mode, so the cart logic keeps reading
// the card data attributes. Cards with the same heading (data-variant-title)
// are one supply; a card is taken from the chosen type when that type has the
// supply, otherwise from the first type that has it.
function __landing__getWrapper() {
    return document.querySelector('.' + __section_landing + '.purchase-form-wrapper');
}

function __landing__isSupplyFirst() {
    const wrapper = __landing__getWrapper();
    return !!(wrapper && wrapper.dataset.supplyFirst === 'true');
}

function __landing__getSupplyFirstGroups() {
    let suffix = '';
    const delivery = document.querySelector('.' + __section_landing + ' input[type="radio"][name="delivery-type-landing"]:checked');
    if (delivery && delivery.value == 'subscription') {
        suffix = '-subscription';
    }

    const groups = [];
    document.querySelectorAll('.' + __section_landing + ' .purchase_form_landing_product_type_item').forEach(tile => {
        const template = document.getElementById(__form_landing + '-source-' + tile.id + suffix);
        if (!template) return;

        const content = template.content.cloneNode(true);
        const cards = [...content.querySelectorAll('.purchase_form_landing_product_variant_selector')];
        cards.forEach(card => {
            card.dataset.formula = tile.id;
        });

        groups.push({ id: tile.id, content: content, cards: cards });
    });

    return groups;
}

function __landing__renderSupplyFirst(formula) {
    const wrapper = __landing__getWrapper();
    const target = document.getElementById(__form_landing + '-body-' + __section_landing);
    if (!wrapper || !target) return;

    const groups = __landing__getSupplyFirstGroups();
    if (!groups.length) return;

    const supplies = [];
    const formulasBySupply = {};
    groups.forEach(group => group.cards.forEach(card => {
        const supply = card.dataset.variantTitle;
        if (!formulasBySupply[supply]) {
            formulasBySupply[supply] = [];
            supplies.push(supply);
        }
        formulasBySupply[supply].push(group.id);
    }));
    if (!supplies.length) return;

    wrapper.__landing_formulasBySupply = formulasBySupply;

    const hasSupply = (group, supply) => group.cards.some(card => card.dataset.variantTitle === supply);

    // Keep the supply the shopper has selected; on first render use the preselected card.
    let supply = null;
    const checkedInput = target.querySelector('input[type="radio"][name="purchase_form_landing_product_variant_' + __form_landing + '"]:checked');
    const checkedCard = checkedInput ? checkedInput.closest('.purchase_form_landing_product_variant_selector') : null;
    if (checkedCard) {
        supply = checkedCard.dataset.variantTitle;
    }

    if (!supply || !formulasBySupply[supply]) {
        const preferred = groups.find(group => group.id === formula);
        const pool = (preferred ? preferred.cards : []).concat(...groups.map(group => group.cards));
        const preselected = pool.find(card => {
            const input = card.querySelector('input[type="radio"]');
            return input && input.checked;
        });
        supply = preselected ? preselected.dataset.variantTitle : supplies[0];
    }

    const fragment = document.createDocumentFragment();
    const list = groups[0].content.querySelector('.c-supply-selector__list').cloneNode(false);
    fragment.appendChild(list);

    supplies.forEach(item => {
        const group = groups.find(g => g.id === formula && hasSupply(g, item)) || groups.find(g => hasSupply(g, item));
        list.appendChild(group.cards.find(card => card.dataset.variantTitle === item));
    });

    // Preorder texts and boxes are looked up by variant id, so they are kept for every type.
    let preorderBoxAdded = false;
    groups.forEach(group => {
        group.content.querySelectorAll('.c-supply-selector__list > :not(.purchase_form_landing_product_variant_selector)').forEach(node => {
            fragment.appendChild(node);
        });

        [...group.content.children].forEach(node => {
            if (node.classList.contains('c-supply-selector__list')) return;
            if (node.classList.contains('preorder_box')) {
                if (preorderBoxAdded) return;
                preorderBoxAdded = true;
            }
            fragment.appendChild(node);
        });
    });

    target.innerHTML = '';
    target.appendChild(fragment);

    __landing__initScripts();
    target.querySelectorAll('.purchase_form_landing_product_variant_selector').forEach(card => {
        card.addEventListener('click', __landing__handlerSupplyFirstCard);
    });
    __landing__bindForm();

    if (typeof __gpd_update === "function") {
        __gpd_update();
    }

    const selected = [...target.querySelectorAll('.purchase_form_landing_product_variant_selector')].find(card => card.dataset.variantTitle === supply);
    if (selected) {
        const input = __landing__getSelectorInput(selected);
        if (input) input.checked = true;
        selected.click();
    }

    __landing__setVariantFromUrl();
}

function __landing__handlerSupplyFirstCard(e) {
    if (e.target.tagName === 'INPUT') return; //to skip second click

    __landing__updateSupplyFirstTiles(this.dataset.variantTitle, this.dataset.formula);
}

function __landing__updateSupplyFirstTiles(supply, formula) {
    const wrapper = __landing__getWrapper();
    const formulas = (wrapper && wrapper.__landing_formulasBySupply && wrapper.__landing_formulasBySupply[supply]) || [];
    const list = document.querySelector('.' + __section_landing + ' .c-options-selector__list');
    const animate = !!(list && list.classList.contains('is-supply-first-ready'));

    document.querySelectorAll('.' + __section_landing + ' .purchase_form_landing_product_type_item').forEach(tile => {
        const visible = formulas.includes(tile.id);
        const wasHidden = tile.classList.contains('hide');

        tile.classList.toggle('hide', !visible);

        // The row changes because of a click below it, so the swap is animated to be noticed.
        if (visible && wasHidden && animate) {
            tile.classList.remove('is-entering');
            void tile.offsetWidth;
            tile.classList.add('is-entering');
            tile.addEventListener('animationend', () => tile.classList.remove('is-entering'), { once: true });
        }

        const input = tile.querySelector('input[type="radio"]');
        if (input) input.checked = tile.id === formula;
    });

    if (list) {
        list.classList.toggle('c-options-selector__list--single', formulas.length === 1);
        list.classList.add('is-supply-first-ready');
    }
}
