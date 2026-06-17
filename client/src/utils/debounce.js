// Tiny native debounce — drop-in for the one underscore helper we used, so we
// can drop the whole `underscore` dependency. Returns a function that delays
// calling `fn` until `wait` ms have elapsed since the last call; `.cancel()`
// clears a pending call.
export function debounce(fn, wait) {
  let timer;
  function debounced(...args) {
    const ctx = this;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (typeof fn === "function") fn.apply(ctx, args);
    }, wait);
  }
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
