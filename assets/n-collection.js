async function loadCollectionContent(url) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const sourceElement = tempDiv.querySelector('#collection-products');
        const targetElement = document.querySelector('#collection-products');
        
        if (sourceElement && targetElement) {
        targetElement.innerHTML = sourceElement.innerHTML;
        
        await new Promise(resolve => setTimeout(resolve, 0));
        
        if (typeof bindForms === 'function') {
            bindForms();
        }
        }
    } catch (error) {
        console.error('Error loading content:', error);
    }
}

document.querySelectorAll('.filter').forEach(filter => {
    filter.addEventListener('click', function(e) {
        e.preventDefault();
        const url = this.getAttribute('data-url');
        if (url) {
        loadCollectionContent(url);
        }
    });
});