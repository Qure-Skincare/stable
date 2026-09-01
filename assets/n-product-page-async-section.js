(function () {
    const pageUrl = window.location.pathname;
    const cache = {};

    function fetchSection(sectionId) {
        if (!cache[sectionId]) {
            cache[sectionId] = fetch(`${pageUrl}?sections=${sectionId}`)
                .then(res => res.json())
                .then(data => {
                    if (!data[sectionId]) {
                        throw new Error('Section not found in response: ' + sectionId);
                    }

                    let html = data[sectionId].trim();

                    const tempWrap = document.createElement('div');
                    tempWrap.innerHTML = html;

                    const tpl = tempWrap.querySelector('template#async');

                    if (tpl) {
                        html = tpl.innerHTML.trim();
                    }

                    return html;
                });

            // Drop failed requests from the cache so the next attempt retries.
            cache[sectionId].catch(() => { delete cache[sectionId]; });
        }

        return cache[sectionId];
    }

    function activateScripts(container) {
        container.querySelectorAll('script').forEach(oldScript => {
            const newScript = document.createElement('script');

            [...oldScript.attributes].forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });

            if (!oldScript.src) {
                newScript.textContent = oldScript.textContent;
            }

            oldScript.replaceWith(newScript);
        });
    }

    function loadSection(container, sectionId) {
        container.setAttribute('data-async-section-id', sectionId);

        return fetchSection(sectionId)
            .then(html => {
                // Guard against out-of-order responses when the user switches quickly.
                if (container.getAttribute('data-async-section-id') !== sectionId) return;

                container.innerHTML = html;
                activateScripts(container);
            })
            .catch(err => console.error(err));
    }

    const containers = document.querySelectorAll('[data-async-section-id]');

    containers.forEach(container => {
        loadSection(container, container.getAttribute('data-async-section-id'))
            .then(() => {
                if (typeof showKlaviyoPopup === 'function') {
                    showKlaviyoPopup();
                }
            });
    });

    // Purchase form selector: a checked radio with [data-form] swaps the async
    // section to "<template_id>__<data-form>".
    document.addEventListener('change', function (e) {
        const input = e.target;

        if (!input.matches('input[type="radio"][data-form]') || !input.checked) return;

        const form = input.getAttribute('data-form');

        containers.forEach(container => {
            const templateId = container.getAttribute('data-async-section-id').split('__')[0];
            loadSection(container, `${templateId}__${form}`);
        });
    });
})();
