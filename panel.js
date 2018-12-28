const backgroundPageConnection = chrome.runtime.connect({
    name: 'panel'
});

backgroundPageConnection.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId
});

let checkedCnt;
const direction = ['up', 'down', 'left', 'right'];

function getCodeStringForOutline(functionStr, outLineColor) {
    // TODO : keep previous outline style.
    return `(function() {
        var candidates = ${functionStr};
        if (candidates) {
            for (elem of candidates) {
                elem.style.outline = "solid ${outLineColor}";
            }
        }
    })();`;
}
/**
 * Make outline on candidates of specific direction
 * @param {string} dir colored way
 */
function coloring(dir) {
    checkedCnt++;
    const preColor = getCodeStringForOutline(`window.__spatialNavigation__.findCandidates(document.activeElement, '${dir}')`, '#B0C4DE');
    chrome.tabs.executeScript({
        code: preColor
    });
    if (checkedCnt == 4) document.getElementById('Button_all').checked = true;
}

/**
 * Remove outline on candidates of specific direction
 * @param {string} dir decolored way
 */
function decoloring(dir) {
    checkedCnt--;
    const preDecolor = getCodeStringForOutline(`window.__spatialNavigation__.findCandidates(document.activeElement, '${dir}')`, 'transparent');
    chrome.tabs.executeScript({
        code: preDecolor
    });
    if (checkedCnt < 4) document.getElementById('Button_all').checked = false;
}

/**
 * Focusable element button onclick event listener
 */
document.body.addEventListener('click', (event) => {
    const id = event.srcElement.id;
    if (id == 'Whole_page') {
        if (document.getElementById(id).checked) {
            ChangeCheckAll(true);
            document.getElementById('Button_all').checked = true;
            chrome.tabs.executeScript({
                code: getCodeStringForOutline('document.body.focusableAreas({mode: "all"})', '#B0C4DE')
            });
        } else {
            ChangeCheckAll(false);
            chrome.tabs.executeScript({
                code: getCodeStringForOutline('document.body.focusableAreas({mode: "all"})', 'transparent')
            });
            document.getElementById('Button_all').checked = false;
        }
    } else if (id == 'Button_all') {
        if (document.getElementById(id).checked) ChangeCheckAll(true);
        else ChangeCheckAll(false);
    } else {
        let way = id.substr(7);
        if (direction.includes(way)) {
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
    for (let idx = 0; idx < direction.length; idx++) {
        try {
            throw direction[idx];
        } catch (way) {
            document.getElementById('Button_'.concat(way)).checked = checked;
            if (checked) {
                coloring(way);
                checkedCnt = 4;
            } else {
                decoloring(way);
                checkedCnt = 0;
            }
        }
    }
}

/**
 *
 * Send Message on every focus changing event
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // remove all outline
    if (checkedCnt != 0) {
        ChangeCheckAll(false);
        document.getElementById('Whole_page').checked = false;
        document.getElementById('Button_all').checked = false;
        chrome.tabs.executeScript({
            code: getCodeStringForOutline('document.body.focusableAreas({mode: "all"})', 'transparent')
        });
    }

    // show information of Spatnav on devtool
    chrome.devtools.inspectedWindow.eval('document.body.focusableAreas({mode: "all"}).length;', { useContentScriptContext: true }, (result) => {
        document.getElementById('focus_cnt').innerText = result;
    });

    chrome.devtools.inspectedWindow.eval('__spatialNavigation__.isContainer(document.activeElement);', { useContentScriptContext: true }, (result) => {
        document.getElementById('container').innerText = result;
        if (result.toString() == 'true') {
            document.getElementById('container').style.color = '#0057e7';
        } else {
            document.getElementById('container').style.color = '#d62d20';
        }
    });

    chrome.devtools.inspectedWindow.eval('document.activeElement.focusableAreas({mode: "visible"}).map(a => a.outerHTML);', { useContentScriptContext: true }, (result) => {
        const parentDiv = document.getElementById('visible');
        while (parentDiv.firstChild) {
            parentDiv.removeChild(parentDiv.firstChild);
        }
        if (result.length == 0) {
            const content3 = document.createTextNode('None');
            parentDiv.appendChild(content3);
        } else {
            let temp;
            for (let i = 0; i < result.length; i++) {
                const tempId = `visible_list_${i + 1}`;
                const newDiv = document.createElement('div');
                newDiv.id = tempId;
                temp = `[${i + 1}] ${result[i].toString().replace(/(\r\n\t|\n|\r\t)/gm, '')}`;
                const newContent = document.createTextNode(temp);
                newDiv.appendChild(newContent);
                parentDiv.appendChild(newDiv);
            }
        }
    });

    // Make list of focusable areas
    chrome.devtools.inspectedWindow.eval('document.activeElement.focusableAreas({mode: "all"}).map(a => a.outerHTML);', { useContentScriptContext: true }, (result) => {
        const parentDiv = document.getElementById('all');
        while (parentDiv.firstChild) {
            parentDiv.removeChild(parentDiv.firstChild);
        }
        if (result.length == 0) {
            parentDiv.appendChild(document.createTextNode('None'));
        } else {
            let temp;
            for (let i = 0; i < result.length; i++) {
                const tempId = `all_list_${i + 1}`;
                const newDiv = document.createElement('div');
                newDiv.id = tempId;
                temp = `[${i + 1}] ${result[i].toString().replace(/(\r\n\t|\n|\r\t)/gm, '')}`;
                const newContent = document.createTextNode(temp);
                newDiv.appendChild(newContent);
                parentDiv.appendChild(newDiv);
            }
        }
    });

    // Show the result of 'findNextTarget()' and 'spatialNavigationSearch()'.
    for (const dir of direction) {
        chrome.devtools.inspectedWindow.eval(`__spatialNavigation__.findNextTarget(document.activeElement, '${dir}').outerHTML;`, { useContentScriptContext: true }, (result) => {
            if (result === undefined) document.getElementById(dir).innerText = 'undefined';
            else document.getElementById(dir).innerText = result.toString().replace(/(\r\n\t|\n|\r\t)/gm, '');
            document.getElementById(dir).setAttribute('cmd', 'next');
        });

        chrome.devtools.inspectedWindow.eval(`document.activeElement.spatialNavigationSearch('${dir}').outerHTML;`, { useContentScriptContext: true }, (result) => {
            const search_id = 'search_'.concat(dir);
            document.getElementById(search_id).setAttribute('cmd', 'spatnav_search');
            if (result === undefined) { document.getElementById(search_id).innerText = 'undefined'; }
            else { document.getElementById(search_id).innerText = result.toString().replace(/(\r\n\t|\n|\r\t)/gm, ''); }
        });
    }

    // Show the result of 'findCandidates()'.
    function getCodeStringForGetCandidates(dir) {
        return `(function() {
            console.log('${dir}');
            const dis_candidate = [];
            const candidates = __spatialNavigation__.findCandidates(document.activeElement, '${dir}');
            console.log(candidates);
            if(candidates) {
                for(let i = 0; i < candidates.length; i++) {
                    dis_candidate[i] = [candidates[i].outerHTML, __spatialNavigation__.getDistanceFromTarget(document.activeElement, candidates[i], '${dir}')];
                }
            }
            console.log(dis_candidate);
            return dis_candidate;
        })();`;
    }

    // Make list of 4 way candidate
    for (const dir of direction) {
        chrome.devtools.inspectedWindow.eval(getCodeStringForGetCandidates(dir), { useContentScriptContext: true }, (result) => {
            const parentDiv = document.getElementById('candidates-area-' + dir);
            while (parentDiv.firstChild) {
                parentDiv.removeChild(parentDiv.firstChild);
            }
            if (result.length === 0) {
                parentDiv.appendChild(document.createTextNode('None'));
            } else {
                let temp;
                for (let i = 0; i < result.length; i++) {
                    const tempId = `candidates-${dir}${i + 1}`;
                    const newDiv = document.createElement('div');
                    newDiv.setAttribute('id', tempId);
                    temp = `[${i + 1}] distance : ${parseInt(result[i][1])}, ${result[i][0].replace(/(\r\n\t|\n|\r\t)/gm, '')}`;
                    const newContent = document.createTextNode(temp);
                    newDiv.appendChild(newContent);
                    const currentDiv = document.getElementById('candidates-' + dir);
                    parentDiv.insertBefore(newDiv, currentDiv);
                }
            }
        });
    }

    // Make list of container
    chrome.devtools.inspectedWindow.eval("function container_list(){ var temp = document.activeElement.getSpatialNavigationContainer(); var list = []; var i = 0; while( temp != null){ list[i] = temp; i = i + 1; temp = temp.getSpatialNavigationContainer();} return list.map(a=>a.outerHTML);} container_list();", { useContentScriptContext: true }, (result) => {
        if (result === undefined) {
            document.getElementById('container_list').innerText = 'undefined';
        } else {
            let i;
            let temp;
            const parentDiv = document.getElementById('containerlist1');
            while (parentDiv.firstChild) {
                parentDiv.removeChild(parentDiv.firstChild);
            }

            for (i = 0; i < result.length; i++) {
                const tempId = `container_list${i + 1}`;
                const newDiv = document.createElement('div');
                newDiv.setAttribute('id', tempId);
                temp = `[${i + 1}] ${result[i].replace(/(\r\n\t|\n|\r\t)/gm, '')}`;
                const newContent = document.createTextNode(temp);
                newDiv.appendChild(newContent);
                const currentDiv = document.getElementById('container_list');
                parentDiv.insertBefore(newDiv, currentDiv);
            }
        }
    });
});

/**
 * Text element mouseover event listener
 */
document.body.addEventListener('mouseover', (event) => {
    const id = event.srcElement.id;
    if (id) {
        if (direction.includes(id)) mouseOver(id);
        else if (id.includes('search_')) mouseOver(id);
        else if (id.includes('visible_list')) {
            document.getElementById(id).style.color = '#d62d20';
            var index = parseInt(id.substr(13)) - 1;
            chrome.tabs.executeScript({
                code: "var tmp = (document.activeElement.focusableAreas({\"mode\": \"visible\"})[".concat(index, "]); if (tmp) {tmp.style.backgroundColor = \"#FCADAB\"; tmp.style.outline = \"thick #FFC0CB\";}")
            });
        } else if (id.includes('all_list')) {
            document.getElementById(id).style.color = '#d62d20';
            var index = parseInt(id.substr(9)) - 1;
            chrome.tabs.executeScript({
                code: "var tmp = (document.activeElement.focusableAreas({\"mode\": \"all\"})[".concat(index, "]); if (tmp) {tmp.style.backgroundColor = \"#FCADAB\"; tmp.style.outline = \"thick #FFC0CB\";}")
            });
        } else if (id.includes('candidates-up')) {
            document.getElementById(id).style.color = '#d62d20';
            var index = parseInt(id.substr(13)) - 1;
            chrome.tabs.executeScript({
                code: `var temp = __spatialNavigation__.findCandidates(document.activeElement,"up"); if (temp){if (temp[${index}]){temp[${index}].style.backgroundColor = "#FCADAB"; temp[${index}].style.outline = "thick #FFC0CB"}}`
            });
        } else if (id.includes('candidates-down')) {
            document.getElementById(id).style.color = '#d62d20';
            var index = parseInt(id.substr(15)) - 1;
            chrome.tabs.executeScript({
                code: `var temp = __spatialNavigation__.findCandidates(document.activeElement,"down"); if (temp){if (temp[${index}]){temp[${index}].style.backgroundColor = "#FCADAB"; temp[${index}].style.outline = "thick #FFC0CB"}}`
            });
        } else if (id.includes("candidates-left")) {
            document.getElementById(id).style.color = "#d62d20";
            var index = parseInt(id.substr(15)) - 1;
            chrome.tabs.executeScript({
                code: `var temp = __spatialNavigation__.findCandidates(document.activeElement,"left"); if (temp){if (temp[${index}]){temp[${index}].style.backgroundColor = "#FCADAB"; temp[${index}].style.outline = "thick #FFC0CB"}}`
            });
        } else if (id.includes("candidates-right")) {
            document.getElementById(id).style.color = "#d62d20";
            var index = parseInt(id.substr(16)) - 1;
            chrome.tabs.executeScript({
                code: `var temp = __spatialNavigation__.findCandidates(document.activeElement,"right"); if (temp){if (temp[${index}]){temp[${index}].style.backgroundColor = "#FCADAB"; temp[${index}].style.outline = "thick #FFC0CB"}}`
            });
        } else if (id.includes("container_list")) {
            document.getElementById(id).style.color = "#d62d20";
            var index = parseInt(id.substr(14)) - 1;
            chrome.tabs.executeScript({
                code: `var temp = document.activeElement.getSpatialNavigationContainer(); for(var i = 0; i < ${index}; i++) { temp = temp.getSpatialNavigationContainer();} temp.style.backgroundColor = "#FCADAB"; temp.style.outline = "thick #FFC0CB";`
            });
        }
    }
});

/**
 * Text element mouseout event listener
 */
document.body.addEventListener("mouseout", (event) => {
    const id = event.srcElement.id;
    if (id) {
        if (direction.includes(id)) mouseOut(id);
        else if (id.includes('search_')) mouseOut(id);
        else if (id.includes('visible_list')) {
            document.getElementById(id).style.color = 'rgb(61, 60, 60)';
            var index = parseInt(id.substr(13)) - 1;
            chrome.tabs.executeScript({
                code: "var tmp = (document.activeElement.focusableAreas({\"mode\": \"visible\"})[".concat(index, "]); if (tmp) {tmp.style.backgroundColor = \"transparent\"; tmp.style.outline = \"transparent\";}")
            });
        } else if (id.includes('all_list')) {
            document.getElementById(id).style.color = 'rgb(61, 60, 60)';
            var index = parseInt(id.substr(9)) - 1;
            chrome.tabs.executeScript({
                code: "var tmp = (document.activeElement.focusableAreas({\"mode\": \"all\"})[".concat(index, "]); if (tmp) {tmp.style.backgroundColor = \"transparent\"; tmp.style.outline = \"transparent\";}")
            });
        } else if (id.includes('candidates-up')) {
            document.getElementById(id).style.color = 'rgb(61, 60, 60)';
            var index = parseInt(id.substr(13) - 1);
            chrome.tabs.executeScript({
                code: `var temp = __spatialNavigation__.findCandidates(document.activeElement,"up"); if (temp){if (temp[${index}]){temp[${index}].style.backgroundColor = "transparent"; temp[${index}].style.outline = "transparent"}}`
            });
        } else if (id.includes('candidates-down')) {
            document.getElementById(id).style.color = 'rgb(61, 60, 60)';
            var index = parseInt(id.substr(15)) - 1;
            chrome.tabs.executeScript({
                code: `var temp = __spatialNavigation__.findCandidates(document.activeElement,"down"); if (temp){if (temp[${index}]){temp[${index}].style.backgroundColor = "transparent"; temp[${index}].style.outline = "transparent"}}`
            });
        } else if (id.includes('candidates-left')) {
            document.getElementById(id).style.color = 'rgb(61, 60, 60)';
            var index = parseInt(id.substr(15)) - 1;
            chrome.tabs.executeScript({
                code: `var temp = __spatialNavigation__.findCandidates(document.activeElement,"left"); if (temp){if (temp[${index}]){temp[${index}].style.backgroundColor = "transparent"; temp[${index}].style.outline = "transparent"}}`
            });
        } else if (id.includes('candidates-right')) {
            document.getElementById(id).style.color = 'rgb(61, 60, 60)';
            var index = parseInt(id.substr(16)) - 1;
            chrome.tabs.executeScript({
                code: `var temp = __spatialNavigation__.findCandidates(document.activeElement,"right"); if (temp){if (temp[${index}]){temp[${index}].style.backgroundColor = "transparent"; temp[${index}].style.outline = "transparent"}}`
            });
        } else if (id.includes('container_list')) {
            document.getElementById(id).style.color = 'rgb(61, 60, 60)';
            var index = parseInt(id.substr(14)) - 1;
            chrome.tabs.executeScript({
                code: `var temp = document.activeElement.getSpatialNavigationContainer(); for(var i = 0; i < ${index}; i++) { temp = temp.getSpatialNavigationContainer();} temp.style.backgroundColor = "transparent"; temp.style.outline = "transparent";`
            });
        }
    }
});


/**
 * Mouseover / out event of next element text
 * @param {string} way coloring direction
 */
function mouseOut(way) {
    if ((document.getElementById(way).innerText == 'undefined') || (document.getElementById(way) == null)) return;

    document.getElementById(way).style.color = 'rgb(61, 60, 60)';

    if (document.getElementById(way).getAttribute('cmd') == 'next') {
        chrome.tabs.executeScript({
            code: "var tmp = window.__spatialNavigation__.findNextTarget(document.activeElement, \"".concat(way, "\"); if (tmp) {tmp.style.backgroundColor = \"transparent\"; tmp.style.outline = \"transparent\";}")
        });
    } else if (document.getElementById(way).getAttribute("cmd") == "spatnav_search") {
        const realWay = way.substr(7);
        chrome.tabs.executeScript({
            code: "var tmp = document.activeElement.spatialNavigationSearch(\"".concat(realWay, "\"); if (tmp) {tmp.style.backgroundColor = \"transparent\"; tmp.style.outline = \"transparent\";}")
        });
    }
}

function mouseOver(way) {
    if (document.getElementById(way).innerText == 'undefined') return;

    document.getElementById(way).style.color = '#d62d20';

    if (document.getElementById(way).getAttribute('cmd') == 'next') {
        chrome.tabs.executeScript({
            code: "var tmp = window.__spatialNavigation__.findNextTarget(document.activeElement, \"".concat(way, "\"); if (tmp) {tmp.style.backgroundColor = \"#FCADAB\"; tmp.style.outline = \"thick #FFC0CB\";}")
        });
    } else if (document.getElementById(way).getAttribute('cmd') == 'spatnav_search') {
        const realWay = way.substr(7);
        chrome.tabs.executeScript({
            code: "var tmp = document.activeElement.spatialNavigationSearch(\"".concat(realWay, "\"); if (tmp) {tmp.style.backgroundColor = \"#FCADAB\"; tmp.style.outline = \"thick #FFC0CB\";}")
        });
    }
}
