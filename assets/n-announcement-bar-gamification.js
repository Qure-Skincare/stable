(function () {
    var BAR_ID = 'announcement-bar';
    var pending = false;

    function refresh() {
        var bar = document.getElementById(BAR_ID);
        if (!bar || !bar.dataset.sectionId || pending) return;
        pending = true;

        fetch(location.pathname + '?section_id=' + bar.dataset.sectionId, { priority: 'low' })
            .then(function (res) { return res.text(); })
            .then(function (html) {
                var temp = document.createElement('div');
                temp.innerHTML = html;
                var next = temp.querySelector('#' + BAR_ID);
                var current = document.getElementById(BAR_ID);
                if (!next || !current) return;

                if (typeof morphdom === 'function') {
                    morphdom(current, next);
                } else {
                    current.replaceWith(next);
                }
            })
            .catch(function (error) {
                console.error('Announcement bar: refresh failed', error);
            })
            .finally(function () {
                pending = false;
            });
    }

    document.addEventListener('cart.requestComplete', refresh);
})();
