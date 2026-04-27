document.addEventListener('click', function(event) {
    var trigger = event.target.closest('.trigger-klaviyo-popup');
    if (trigger) {
        event.preventDefault();
        var showPopup = document.querySelector('.show-klaviyo-popup');
        if (showPopup) {
            showPopup.click();
        }
    }
});


document.addEventListener('click', function(event) {
    var trigger = event.target.closest('.trigger-klaviyo-popup-landing');
    if (trigger) {
        event.preventDefault();
        var showPopup = document.querySelector('.show-klaviyo-popup-landing');
        if (showPopup) {
            showPopup.click();
        }
    }
});


function showKlaviyoPopup() {
    var klaviyoButtons = document.querySelectorAll('.show-klaviyo-popup, .show-klaviyo-popup-landing');
    var klaviyoModal = document.getElementById('reusableKlaviyoModal');
    var klaviyoContainer = document.getElementById('KlaviyoContainer');

    if (!klaviyoModal || !klaviyoContainer || !klaviyoButtons.length) return;

    // Will store the klaviyoForm currently shown, for hiding later
    var currentForm = null;

    klaviyoButtons.forEach(function(button){
        button.addEventListener('click', function(){
            var formId = button.getAttribute('data-form-id');
            var klaviyoForm = document.querySelector('.' + formId);

            if (!klaviyoForm) return;

            // Save the reference for hiding after

            currentForm = klaviyoForm;
            klaviyoForm.style.setProperty('display', 'block', 'important');
            klaviyoContainer.appendChild(klaviyoForm);
        });
    });

    klaviyoModal.addEventListener('shown.bs.modal', function () {
        // Modal shown, form is already appended by click event
    });

    klaviyoModal.addEventListener('hidden.bs.modal', function () {
    if (currentForm) {
        currentForm.style.display = 'none';
        currentForm = null;
    }
    });

    // Initialize modal component
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        new bootstrap.Modal(klaviyoModal, { backdrop: true, keyboard: true });
    }
}

showKlaviyoPopup();