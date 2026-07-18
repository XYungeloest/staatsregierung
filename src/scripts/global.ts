document.addEventListener('click', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-print-page]')) {
    window.print();
  }
});
