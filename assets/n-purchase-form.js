const __section = document.currentScript.getAttribute('data-section');
const __form = document.currentScript.getAttribute('data-form');

document.addEventListener('DOMContentLoaded', function() {

    initTemplate(getProductType());

    document.querySelectorAll('.' + __section + ' .purchase_form_product_type_item').forEach(function(element) {
        element.addEventListener('click', function(e) {
            if (e.target.tagName === 'INPUT') return; //to skip second click
            const id = this.id;
            initTemplate(id);
        });
    });

    function initTemplate(source) {
        if(!source) return;

        const template_form = document.getElementById(__form + '-source-' + source);
        const target = document.getElementById(__form + '-body-' + __section);

        if (template_form && target) {
            const content = template_form.content.cloneNode(true);
            target.innerHTML = '';
            target.appendChild(content);
            initScripts();
            initProduct();
            bindForm();

            if (typeof __gpd_update === "function") {
                __gpd_update();
            }
        }               
    }

    function getProductType() {

        let checkedInput = document.querySelector('.' + __section + ' input[type="radio"][name="purchase_form_product_type_'+ __form + '"]:checked');

        if (!checkedInput) {
            checkedInput = document.querySelector('.' + __section + ' input[type="radio"][name="purchase_form_product_type_'+ __form + '"]');
        }
        
        if (checkedInput) {
            checkedInput.checked = true;
            const purchase_form_product_type_item = checkedInput.closest('.purchase_form_product_type_item');
            if (purchase_form_product_type_item && purchase_form_product_type_item.id) {
                return purchase_form_product_type_item.id;
            }
        }

        return false;
    }

    function initProduct() {
        let checkedInput = document.querySelector('.' + __section + ' input[type="radio"][name="purchase_form_product_variant_'+ __form + '"]:checked');

        if (!checkedInput) {
            checkedInput = document.querySelector('.' + __section + ' input[type="radio"][name="purchase_form_product_variant_'+ __form + '"]');
        }

        if(checkedInput)
        {
            checkedInput.checked = true;
            const purchase_form_product_variant_selector = checkedInput.closest('.purchase_form_product_variant_selector');

            if (purchase_form_product_variant_selector) {
                purchase_form_product_variant_selector.click();
            }
        }           
    }

    function initScripts() {
        document.querySelectorAll('.' + __section + ' .purchase_form_product_variant_selector').forEach(el => el.addEventListener('click', __handlerProductVariantSelector));

        document.querySelectorAll('.' + __section + ' .cs_item__accordion').forEach(el => el.addEventListener('click', __handlerItemAccordion));
    }

    function __handlerItemAccordion(e) {
        this.classList.toggle('active');

        const nextEl = this.nextElementSibling;

        if (nextEl) {
            if (nextEl.style.display === '' || nextEl.style.display === 'none') {
                nextEl.style.display = 'block';
                nextEl.style.maxHeight = nextEl.scrollHeight + 'px';
            } else {
                nextEl.style.display = 'none';
                nextEl.style.maxHeight = null;
            }
        }
    }


    function __handlerProductVariantSelector(e) {
        if (e.target.tagName === 'INPUT') return;  //to skip second click

        const product_variant_id = this.getAttribute("data-product_variant_id");
        const soldout = this.getAttribute("data-soldout");
        const preorder = this.getAttribute("data-preorder");
        const block_id = this.getAttribute("data-block-id");

        updateProductFormButton(product_variant_id, soldout);
        clearPreorderBoxes();
        tooglePreorderBox(preorder, product_variant_id);
        backInStock(soldout);

        const purchase_form_pay_in_full = document.querySelector('.' + __section + " .purchase_form_pay_in_full");
        if (purchase_form_pay_in_full) {
            const oldPrice = purchase_form_pay_in_full.querySelector(".e-price__old");
            const currentPrice = purchase_form_pay_in_full.querySelector(".e-price__current");

            if (oldPrice) {
                const oldEl = this.querySelector(".e-price__old");
                if (oldEl) oldPrice.textContent = oldEl.textContent;
            }

            if (currentPrice) {
                const currrentEl = this.querySelector(".e-price__current");
                if (currrentEl) currentPrice.textContent = currrentEl.textContent.trim();
            }
        }

        const btnValue = document.querySelector('.' + __section + " .add-cart-button");
        if (btnValue) btnValue.textContent = this.getAttribute("data-per");

        document.querySelectorAll('.' + __section + " .purchase_form_pay_today .e-price__current").forEach(el => {
            el.textContent = this.getAttribute("data-pay");
        });

        document.querySelectorAll('.' + __section + " .c-buy-block .pay_today").forEach(el => {
            el.textContent = this.getAttribute("data-pay");
        });

        const chosenImg = document.querySelector('.' + __section + " #purchase_form_image");

        if(this.getAttribute("data-image")) {
            if (chosenImg) chosenImg.setAttribute("src", this.getAttribute("data-image"));
        }

        toogleTab(block_id);

        setTimeout(() => {
            if (typeof purchase_form_event === 'function') {
                purchase_form_event(__section, this, product_variant_id);
            }
        }, 500)
    }


    function backInStock(soldout) {
        const element = document.getElementById('back-in-stock');

        if(element) {
            if(soldout == 'true') {
                element.classList.remove('hide');
            }
            else {
                element.classList.add('hide');
            }
        }
    }


    function toogleTab(block_id) {
        const target = document.getElementById("purchase_form_info_item_" + block_id);
        if (target) {
            target.classList.add('show');
        }
    }

    function updateProductFormButton(product_variant_id, soldout) {
        const form = document.querySelector('.' + __section + ' .c-order-button form[action="/cart/add"]');

        if (!product_variant_id) return;

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

    function bindForm() {
        const form = document.querySelector('.' + __section + ' .c-order-button form[action="/cart/add"]');
        if (!form || form.dataset.bound === '1') return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            addToCart(formData);
        }, { passive: false });

        form.dataset.bound = '1';
    }

    function clearPreorderBoxes()
    {
        document.querySelectorAll('.' + __section + ' .' + __form + '-preorder-box-item').forEach(el => {
            el.innerHTML = '';
        });
    }

    function tooglePreorderBox(preorder, product_variant_id) {
        const preorderBox = document.querySelector('.' + __section + ' .preorder_box');
        const targetBox = document.querySelector('.' + __section + ' .' + __form + '-preorder-box__' + product_variant_id);

        if (!preorderBox || !targetBox) return;
        
        if(preorder === 'true')
        {
            if (preorderBox) 
            {
                preorderBox.classList.remove('hide');
                targetBox.appendChild(preorderBox.cloneNode(true));
                preorderBox.classList.add('hide');

                updatePreorderBox(targetBox, product_variant_id);
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

    function updatePreorderBox(targetBox, product_variant_id)
    {
        const preorder_text = document.querySelector('.' + __section + ' .' + __form + '-product-preorder-text__' + product_variant_id);
        if (preorder_text && preorder_text.innerHTML !== '') {
            targetBox.querySelector('.preorder_text').innerHTML = preorder_text.innerHTML;
        }

        const preorder_date_soldout = document.querySelector('.' + __section + ' .' + __form + '-product-preorder_date_soldout__' + product_variant_id);
        if (preorder_date_soldout && preorder_date_soldout.innerHTML !== '') {
            targetBox.querySelector('.preorder_date_soldout').innerHTML = preorder_date_soldout.innerHTML;
        }

        const preorder_date_reserved = document.querySelector('.' + __section + ' .' + __form + '-product-preorder_date_reserved__' + product_variant_id);
        if (preorder_date_reserved && preorder_date_reserved.innerHTML !== '') {
            targetBox.querySelector('.preorder_date_reserved').innerHTML = preorder_date_reserved.innerHTML;
        }

        const preorder_percent = document.querySelector('.' + __section + ' .' + __form + '-product-preorder_percent__' + product_variant_id);
        if (preorder_percent && preorder_percent.innerHTML !== '') {
            targetBox.querySelector('.preorder_percent').innerHTML = preorder_percent.innerHTML;

            const match = preorder_percent.innerHTML.match(/\d+/);
            if (match) {
                const percentText = match[0];
                targetBox.querySelector('.preorder_percent_style').style.setProperty('--data-reserved', percentText + '%');
            }                
        }            
    }
});