(function () {
    var title = document.querySelector('.c-supply-selector__title');
    var radios = document.querySelectorAll('input[name="delivery-type-landing"]');

    function updateTitle() {
        var checked = document.querySelector('input[name="delivery-type-landing"]:checked');
        if (!title || !checked) return;

        var subscription = checked.value === 'subscription';

        if (title.hasAttribute('data-hide-on-subscription')) {
            title.style.display = subscription ? 'none' : '';
        }

        title.innerHTML = subscription ? subscribe_and_save : one_time_purchase;
    }

    radios.forEach(function (radio) {
        radio.addEventListener('change', updateTitle);
    });


    updateTitle();
})();
