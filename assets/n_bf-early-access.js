(function () {
    var PASSWORD = 'QURE-BF26-X9T4G7';
    var REDIRECT_URL = '/pages/exclusive-holiday-bundle';
    var COOKIE_NAME = 'qure_bf26_early_access';

    var section = document.querySelector('.bf-early-access');
    if (!section) return;

    var form = section.querySelector('form');
    var input = section.querySelector('input[type="password"]');
    if (!form || !input || typeof bfEarlyAccess === 'undefined') return;

    function setCookie() {
        var maxAge = 60 * 60 * 24 * (parseInt(bfEarlyAccess.days, 10) || 30);
        document.cookie = COOKIE_NAME + '=1; path=/; max-age=' + maxAge + '; SameSite=Lax';
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        if (input.value.trim() === PASSWORD) {
            setCookie();
            window.location.href = REDIRECT_URL;
            return;
        }

        input.setCustomValidity('Incorrect password');
        input.reportValidity();
        setTimeout(function () { input.setCustomValidity(''); }, 1500);
    });
})();
