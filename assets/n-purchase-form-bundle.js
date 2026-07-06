const __section = document.currentScript.getAttribute('data-section');
const __form = document.currentScript.getAttribute('data-form');

document.addEventListener('DOMContentLoaded', function() {

    initTemplate(getProductType());

    document.querySelectorAll('.' + __section + ' .bundle_heading').forEach(function(element) {
        element.classList.remove('active');

        element.addEventListener('click', function(e) {
            if (e.target.tagName === 'INPUT') return; //to skip second click
            const id = this.id;
            document.querySelectorAll('.' + __section + ' .nav-link').forEach(el => el.classList.remove('active'));
            element.querySelector('.nav-link')?.classList.add('active')
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
            bindForm();
        }               
    }

    function getProductType() {

        let checkedInput = document.querySelector('.' + __section + ' input[type="radio"][name="bundle_section_'+ __form + '"]:checked');

        if (!checkedInput) {
            checkedInput = document.querySelector('.' + __section + ' input[type="radio"][name="bundle_section_'+ __form + '"]');
        }

        if (checkedInput) {
            checkedInput.checked = true;
            const block = checkedInput.closest('.bundle_heading');
            if (block && block.id) {
                return block.id;
            }
        }

        return false;
    }

    function initScripts() {
        document.querySelectorAll('.' + __section + ' .qure__swiper-wrapper').forEach((wrapper, index) => {
            window.QureEventProductSlider?.initGallerySlider?.(wrapper, index);
        });

        document.querySelectorAll('.' + __section + ' .qure__swiper').forEach(el => {
            window.QureSettingsSwiper?.QureCarousel?.(el);
        });

        initProductVariant();
    }

    function initProductVariant () {
        document.querySelectorAll('.' + __section + ' .variant-select').forEach(select => {

            const apply = () => {
                const opt = select.selectedOptions[0];
                if (!opt) return;

                const handle = opt.dataset.handle;
                const block = handle ? document.querySelector('.custom__block#' + handle) : select.closest('.custom__block');
                if (!block) return;

                const form = block.querySelector('form[action="/cart/add"]') || block.querySelector('form');
                const hiddenId = form?.querySelector('input[type="hidden"][name="id"]');
                const includedProduct = select.closest('.included_product');
                const img = includedProduct ? includedProduct.querySelector('.variantImage') : null;
                const variantTextEl = select.querySelector('.variantText');

                const imgUrl = opt.dataset.image;
                if (img && imgUrl) img.src = imgUrl;

                if (hiddenId) {
                    if (opt.dataset.bundleVariantTitle && opt.dataset.bundleVariantTitle.trim() !== "") {
                        const selectedOptions = block.querySelectorAll('.variant-select option:checked');
                        const bundleTitles = Array.from(selectedOptions).map(opt => opt.dataset.bundleVariantTitle).filter(title => title && title.trim() !== "");
                        const allTitles = bundleTitles.join(' / ');
                        const bundleConfig = window.get_products_data?.['purchase-form-bundle-products-items-' + handle];
                        if (bundleConfig && bundleConfig['variants'][allTitles]) {
                            const vid = bundleConfig['variants'][allTitles];
                            hiddenId.value = vid;
                            hiddenId.setAttribute('value', vid);
                        }
                    } else {
                        const vid = opt.dataset.variantId;
                        hiddenId.value = vid;
                        hiddenId.setAttribute('value', vid);
                    }
                }

                const vText = opt.dataset.variantText;
                if (variantTextEl) {
                    variantTextEl.textContent = vText || "";
                }
            };

            apply();
            select.addEventListener('change', apply, { passive: true });
        });
    }

    function bindForm() {
        document.querySelectorAll('.' + __section + ' form[action="/cart/add"]').forEach((form) => {
            if (form.dataset.bound === '1') return;

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                addToCart(formData);
            }, { passive: false });

            form.dataset.bound = '1';
        });
    }
});