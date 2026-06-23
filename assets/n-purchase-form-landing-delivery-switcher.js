(function () {
    var title = document.querySelector('.c-supply-selector__title');
    var radios = document.querySelectorAll('input[name="delivery-type-landing"]');

    function updateTitle() {
        var checked = document.querySelector('input[name="delivery-type-landing"]:checked');
        if (!title || !checked) return;
        title.innerHTML = checked.value === 'subscription' ? subscribe_and_save : one_time_purchase;
    }

    radios.forEach(function (radio) {
        radio.addEventListener('change', updateTitle);
    });


    updateTitle();
})();