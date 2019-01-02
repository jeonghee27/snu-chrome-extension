window.addEventListener
    ? window.addEventListener('blur', blurHappened, true)
    : window.attachEvent('onfocusout', blurHappened);

function blurHappened() {
    chrome.runtime.sendMessage({
        request: 'reload'
    });
}

const NEXT_TARGET_HIGHLIGHT = 'next-target-highlight';
const ACTIVE_ELEMENT_HIGHLIGHT = 'active-element-highlight';

let actElement;
let highlightedElement = {
    left: null,
    right: null,
    up: null,
    down: null
};
/**
 * Event handler for initializing.
 */
document.addEventListener('load', function () {
    console.log(window.__spatialNavigation__);
    window.__spatialNavigation__ && window.__spatialNavigation__.enableExperimentalAPIs();
});

/**
 * Event handler for highlight and tooltip.
 */
document.addEventListener('keyup', (e) => {
    const keyCode = e.which || e.keyCode;

    // get keyMode settings.
    chrome.storage.local.get({
        keyMode: 'ARROW',
        isOn: true,
        isVisible: false,
        CurrentOn: false
    }, (items) => {
        if (document.activeElement != undefined) {
            // enable spatial navigation experimental APIs.
            if(!window.__spatialNavigation__.findNextTarget) {
                window.__spatialNavigation__ && window.__spatialNavigation__.enableExperimentalAPIs();
            }

            // Check whether pressed key is arrow key or tab key.
            if ([9, 37, 38, 39, 40].includes(keyCode)) {

                // remove highlight and tooltip.
                if (actElement != null) {
                    actElement.classList.remove(ACTIVE_ELEMENT_HIGHLIGHT);
                }
                for (label in highlightedElement) {
                    if (highlightedElement[label]) {
                        highlightedElement[label].classList.remove(NEXT_TARGET_HIGHLIGHT);

                        if (highlightedElement[label].getAttribute('spatNavTooltip')) {
                            highlightedElement[label].removeAttribute('spatNavTooltip');
                        }
                    }
                }

                // Add only spatNav and visible option are turned on.
                if (items.isOn && items.isVisible) {
                    actElement = document.activeElement;
                    actElement.classList.add(ACTIVE_ELEMENT_HIGHLIGHT);

                    // Add highlight and tooltip.
                    for (label in highlightedElement) {
                        highlightedElement[label] = window.__spatialNavigation__.findNextTarget(actElement, label);

                        if (highlightedElement[label]) {
                            highlightedElement[label].classList.add(NEXT_TARGET_HIGHLIGHT);
                            highlightedElement[label].setAttribute('spatNavTooltip', label);
                        }
                    }
                } else if (items.isOn && items.CurrentOn) {
                    actElement = document.activeElement;
                    actElement.classList.add(ACTIVE_ELEMENT_HIGHLIGHT);
                }
            }
        }
    });
}, false);
