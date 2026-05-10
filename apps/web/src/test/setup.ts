import '@testing-library/jest-dom/vitest'

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = function () {
    return false
  }
  Element.prototype.setPointerCapture = function () {}
  Element.prototype.releasePointerCapture = function () {}
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {}
}

