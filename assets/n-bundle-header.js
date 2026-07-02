document.addEventListener("click", function (e) {
    const target = e.target.closest("[data-product-handle]");
    if (!target) return;
  
    const handle = target.getAttribute("data-product-handle");
  
    // ищем элемент с таким же handle (например, id или data-атрибут)
    const block = document.getElementById(handle);
  
    if (block) {
      block.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });