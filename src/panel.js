const HOVER_ELEMENT_HIGHLIGHT = 'hover-element-highlight';
const FOCUSABLE_ELEMENT_HIGHLIGHT = 'focusable-element-highlight';
const DIRECTIONS = ['up', 'down', 'left', 'right'];
let checkedCnt;


const backgroundPageConnection = chrome.runtime.connect({
    name: 'panel'
});

backgroundPageConnection.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId
});


function getCodeStringForFocusableElements(functionStr, addClass) {
    // TODO : keep previous outline style.
    return `(function() {
        var candidates = ${functionStr};
        if (candidates) {
            for (element of candidates) {
                ${addClass} ? element.classList.add('${FOCUSABLE_ELEMENT_HIGHLIGHT}') : element.classList.remove('${FOCUSABLE_ELEMENT_HIGHLIGHT}');
            }
        }
    })();`;
}

// Show the result of 'findCandidates()'.
function getCodeStringForGetCandidates(dir) {
    return `(function() {
        const disCandidate = [];
        const candidates = __spatialNavigation__.findCandidates(document.activeElement, '${dir}');
        if(candidates) {
            for(let i = 0; i < candidates.length; i++) {
                disCandidate[i] = [candidates[i].outerHTML, __spatialNavigation__.getDistanceFromTarget(document.activeElement, candidates[i], '${dir}')];
            }
        }
        return disCandidate;
    })();`;
}

// Get containerList
function getCodeStringForContainerList() {
    return `(function () {
        let currentContainer = document.activeElement.getSpatialNavigationContainer();
        const list = [];
        while(currentContainer) {
            list.push(currentContainer.outerHTML);
            currentContainer = currentContainer.getSpatialNavigationContainer();
        }
        return list;
    })();`;
}


function getCodeStringForMouseOverCandidates(dir, childIndex, addClass) {
    // TODO : keep previous outline style.
    return  `(function() {
        let elements = __spatialNavigation__.findCandidates(document.activeElement, '${dir}');
        if (elements && elements[${childIndex}]) {
            ${addClass} ? elements[${childIndex}].classList.add('${HOVER_ELEMENT_HIGHLIGHT}') : elements[${childIndex}].classList.remove('${HOVER_ELEMENT_HIGHLIGHT}');
        }
    })();`;
}


function getCodeStringForMouseOverContainer(childIndex, addClass) {
    return `(function() {
        let element = document.activeElement.getSpatialNavigationContainer();
        for (let i = 0; i < ${childIndex}; i++) {
            element = element.getSpatialNavigationContainer();
        }
        ${addClass} ? element.classList.add('${HOVER_ELEMENT_HIGHLIGHT}') : element.classList.remove('${HOVER_ELEMENT_HIGHLIGHT}');
    })();`;
}

function getCodeStringForMouseOver(functionStr, addClass) {
    return `(function() {
        let element = ${functionStr};
        if (element) {
            ${addClass} ? element.classList.add('${HOVER_ELEMENT_HIGHLIGHT}') : element.classList.remove('${HOVER_ELEMENT_HIGHLIGHT}');
        }
    })();`;
}

/**
 * Make outline on candidates of specific direction
 * @param {string} dir colored dir
 */
function coloring(dir) {
    checkedCnt++;
    chrome.tabs.executeScript({
        code: getCodeStringForFocusableElements(`window.__spatialNavigation__.findCandidates(document.activeElement, '${dir}')`, true)
    });
    if (checkedCnt == 4) document.getElementById('button-all').checked = true;
}

/**
 * Remove outline on candidates of specific direction
 * @param {string} dir decolored dir
 */
function decoloring(dir) {
    checkedCnt--;
    chrome.tabs.executeScript({
        code: getCodeStringForFocusableElements(`window.__spatialNavigation__.findCandidates(document.activeElement, '${dir}')`, false)
    });
    if (checkedCnt < 4) document.getElementById('button-all').checked = false;
}

/**
 * Focusable element button onclick event listener
 */
document.body.addEventListener('click', (event) => {
    const id = event.srcElement.id;
    if (id == 'whole-page') {
        const isChecked = document.getElementById(id).checked;
        ChangeCheckAll(isChecked);
        document.getElementById('button-all').checked = isChecked;
        chrome.tabs.executeScript({
            code: getCodeStringForFocusableElements('document.body.focusableAreas({mode: "all"})', isChecked)
        });
    } else if (id == 'button-all') {
        if (document.getElementById(id).checked) ChangeCheckAll(true);
        else ChangeCheckAll(false);
    } else {
        const way = id.substr(7);
        if (DIRECTIONS.includes(way)) {
            if (document.getElementById(id).checked) coloring(way);
            else decoloring(way);
        }
    }
});

/**
 * Check / UnCheck focusable element button (4way)
 * @param {boolean} checked true = checked, false = unchecked
 */
function ChangeCheckAll(checked) {
    for (const dir of DIRECTIONS) {
        document.getElementById(`button-${dir}`).checked = checked;
        if (checked) {
            coloring(dir);
            checkedCnt = 4;
        } else {
            decoloring(dir);
            checkedCnt = 0;
        }
    }
}

/**
 *
 * Send Message on every focus changing event
 */
chrome.runtime.onMessage.addListener(() => {
    // remove all outline
    if (checkedCnt != 0) {
        ChangeCheckAll(false);
        document.getElementById('whole-page').checked = false;
        document.getElementById('button-all').checked = false;
        chrome.tabs.executeScript({
            code: getCodeStringForFocusableElements('document.body.focusableAreas({mode: "all"})', false)
        });
    }

    // show information of Spatnav on devtool
    chrome.devtools.inspectedWindow.eval('document.body.focusableAreas({mode: "all"}).length;', { useContentScriptContext: true }, (result) => {
        document.getElementById('focus-cnt').innerText = result;
    });

    chrome.devtools.inspectedWindow.eval('__spatialNavigation__.isContainer(document.activeElement);', { useContentScriptContext: true }, (result) => {
        document.getElementById('container').innerText = result;
        if (result.toString() == 'true') {
            document.getElementById('container').style.color = '#0057e7';
        } else {
            document.getElementById('container').style.color = '#d62d20';
        }
    });


    // Show the result of 'findNextTarget()' and 'spatialNavigationSearch()'.
    for (const dir of DIRECTIONS) {
        chrome.devtools.inspectedWindow.eval(`__spatialNavigation__.findNextTarget(document.activeElement, '${dir}').outerHTML;`, { useContentScriptContext: true }, (result) => {
            if (result === undefined) document.getElementById(dir).innerText = 'undefined';
            else document.getElementById(dir).innerText = result.toString().replace(/(\r\n\t|\n|\r\t)/gm, '');
            document.getElementById(dir).setAttribute('cmd', 'next');
        });

        chrome.devtools.inspectedWindow.eval(`document.activeElement.spatialNavigationSearch('${dir}').outerHTML;`, { useContentScriptContext: true }, (result) => {
            const searchElement = document.getElementById(`search-${dir}`);
            searchElement.setAttribute('cmd', 'spatnav-search');
            if (result === undefined) { searchElement.innerText = 'undefined'; }
            else { searchElement.innerText = result.toString().replace(/(\r\n\t|\n|\r\t)/gm, ''); }
        });
    }


    // Make list of 4 way candidate
    for (const dir of DIRECTIONS) {
        chrome.devtools.inspectedWindow.eval(getCodeStringForGetCandidates(dir), { useContentScriptContext: true }, (result) => {
            const parentDiv = document.getElementById('candidates-area-' + dir);
            while (parentDiv.firstChild) {
                parentDiv.removeChild(parentDiv.firstChild);
            }
            if (result.length === 0) {
                parentDiv.appendChild(document.createTextNode('None'));
            } else {
                const currentDiv = document.getElementById('candidates-' + dir);
                for (let i = 0; i < result.length; i++) {
                    const newDiv = document.createElement('div');
                    newDiv.setAttribute('id', `candidates-${dir}-${i}`);
                    newDiv.className = 'item';
                    const newContent = document.createTextNode(`[${i}] distance : ${parseInt(result[i][1])}, ${result[i][0].replace(/(\r\n\t|\n|\r\t)/gm, '')}`);
                    newDiv.appendChild(newContent);
                    parentDiv.insertBefore(newDiv, currentDiv);
                }
            }
        });
    }


    // Make list of container
    chrome.devtools.inspectedWindow.eval(getCodeStringForContainerList(), { useContentScriptContext: true }, (result) => {
        const parentDiv = document.getElementById('container-list');
        while (parentDiv.firstChild) {
            parentDiv.removeChild(parentDiv.firstChild);
        }

        if (!result.length) {
            document.getElementById('container-list').innerText = 'None';
        } else {
            for (let i = 0; i < result.length; i++) {
                const newDiv = document.createElement('div');
                newDiv.className = 'item';
                newDiv.setAttribute('id', `container-list-${i}`);
                newDiv.innerText = `[${i}] ${result[i].replace(/(\r\n\t|\n|\r\t)/gm, '')}`;
                parentDiv.appendChild(newDiv, parentDiv);
            }
        }
    });
});

function onMouseOverOut(id, isActive) {
    if (DIRECTIONS.includes(id)) {
        const dir = id;
        chrome.tabs.executeScript({
            code: getCodeStringForMouseOver(`window.__spatialNavigation__.findNextTarget(document.activeElement, '${dir}');`, isActive)
        });
    } else if (id.includes('search-')) {
        const dir = id.substr('search-'.length);
        chrome.tabs.executeScript({
            code: getCodeStringForMouseOver(`document.activeElement.spatialNavigationSearch('${dir}');`, isActive)
        });
    } else if (id.includes('container-list-')) {
        const childIndex = parseInt(id.substr('container-list-'.length));
        chrome.tabs.executeScript({
            code: getCodeStringForMouseOverContainer(childIndex, isActive)
        });
    } else {
        for (const dir of DIRECTIONS) {
            if (id.includes(`candidates-${dir}-`)) {
                const childIndex = parseInt(id.substr(`candidates-${dir}-`.length));
                chrome.tabs.executeScript({
                    code: getCodeStringForMouseOverCandidates(dir, childIndex, isActive)
                });
                return;
            }
        }
    }
}

document.body.addEventListener('mouseover', (event) => {
    const id = event.srcElement.id;
    if(id) {
        onMouseOverOut(id, true);
    }
});

document.body.addEventListener('mouseout', (event) => {
    const id = event.srcElement.id;
    if(id) {
        onMouseOverOut(id, false);
    }
});
