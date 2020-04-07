var CLASS_NAME = 'zige';
var SPAN_ATTR_NAME = 'zige-margin';
var DEFAULT_AUTO_MARGIN_SIZE = '0.25em';

/**
 * Unicode Blocks Regex
 */
// CJK Unified Ideographs
// CJK Compatibility Ideographs
// Kanggxi Radicals (2f00-2fdf)
// CJK Stokes (31C0–31EF)
// Hangual Jamo (1100-11ff)
// Hangual Syllables (ac00-d7af)
// Hiragana (3040-309f)
// Katakana (30a0-30ff)
// Katakana Phonetic Extensions (31f0-31ff)
var CJK_SCRIPT = /[\u4e00-\u9ffc\uf900-\ufaff\u2f00-\u2fdf\u31c0-\u31ef\u1100-\u11ff\ua700-\ud7af\u3040-\u309f\u30a0-\u31ff]/;

// General Punctuation
// CJK Symbols and Punctuation
// CJK Compatibility Forms
// Halfwidth and Fullwidth Forms
// [Disabled*] Small Form Variants (ff50-fe6f)
// Vertical Forms (fe10-fe1f)
var CJK_SYMBOL = /[\u2000-\u206f\u3000-\u303f\ufe30-\ufe4f\uff00-\uffef\ufe10-\ufe1f]/;

/// Basic Latin
var ALPHABET_SCRIPT = /[\u0030-\u0039\u0041-\u005a\u0061-\u007a]/;
var ALPHABET_SYMBOL = /[\u0021-\u007e\u2000-\u206f]/;

/**
 * Traverse the node tree.
 * When the child node is a readable node:
 *   If it does not have child nodes:
 *     Find spans in it 
 *   Else:
 *     Traverse child node
 * 
 * DFS find all the lowest level atomic nodes and store them in a list.
 * 
 * When looking for spans in a atomic node:
 *   Find the spans in the middle
 *   Find the starting and ending spans if applicable 
 */

class AlphabetSpan {
    constructor(node, startOffset, endOffset, leftSpaceEnabled, rightSpaceEnabled) {
        this.node = node;
        this.startOffset = startOffset;
        this.endOffset = endOffset;
        this.leftSpaceEnabled = leftSpaceEnabled;
        this.rightSpaceEnabled = rightSpaceEnabled;
    }

    get text() {
        return this.node.textContent.slice(this.startOffset, this.endOffset);
    }

    createSpanElement() {
        var spanElem = document.createElement('span');
        var kbType = String();
        if (this.leftSpaceEnabled) kbType += 'l';
        if (this.rightSpaceEnabled) kbType += 'r';
        spanElem.setAttribute(SPAN_ATTR_NAME, kbType);
        spanElem.innerHTML = this.text;
        return spanElem;
    }
}

class CharacterType {
    static isAlphabetScript(character) {
        return character.match(ALPHABET_SCRIPT) != null;
    }

    static isCJKScript(character) {
        return character.match(CJK_SCRIPT) != null;
    }

    static isAlphabetSymbol(character) {
        return character.match(ALPHABET_SYMBOL) != null;
    }

    static isCJKSymbol(character) {
        return character.match(CJK_SYMBOL) != null;
    }

    static isAlphabet(character) {
        return this.isAlphabetScript(character) || this.isAlphabetSymbol(character);
    }

    static isCJK(character) {
        return this.isCJKScript(character) || this.isCJKSymbol(character);
    }
}


function getOrderedLeafNodes(master) {
    var results = [];

    if (master.nodeType == 1 && master.hasChildNodes) {
        // if `master` is an element node and has child nodes 
        // then recursively add its leaf nodes
        var children = master.childNodes;
        for (var i = 0; i < children.length; i++) {
            var childLeafs = getOrderedLeafNodes(children[i]);
            results = results.concat(childLeafs);
        }
        return results;
    }
    if (master.nodeType == 3) {
        // if `master` is a text node
        results.push(master);
        return results;
    } else return results;
    // other types of nodes are not visible so should not influence the typesetting
}

function findAlphabetSpans(textNode, previousLeafNode, nextLeafNode) {
    // TODO: do the previous/next leaf node has to be text nodes?
    var result = [];
    var textContent = textNode.textContent;
    for (var i = 0; i < textContent.length; i++) {
        var character = textContent[i];
        if (CharacterType.isAlphabetScript(character)) {
            var startOffset = i;
            for (; i < textContent.length; i++) {
                var followingCharacter = textContent[i];
                if (CharacterType.isAlphabet(followingCharacter) && !CharacterType.isCJK(followingCharacter)) continue;
                else break;
            }
            var endOffset = i;

            // set left right margin
            var leftIsCJKScript = false;
            var rightIsCJKScript = false;
            // TODO: if this node is the first or last node in its parent
            // while the parent is <div>, <p>, or <li> etc
            // (meaning its parent usually breaks lines) then disable it's right or left margin 
            if (startOffset > 0) {
                leftIsCJKScript = CharacterType.isCJKScript(textContent[startOffset - 1]);
            }
            else if (previousLeafNode != null && previousLeafNode.textContent.length > 0)
                leftIsCJKScript = CharacterType.isCJKScript(previousLeafNode.textContent[previousLeafNode.textContent.length - 1]);
            if (endOffset < textContent.length) {
                rightIsCJKScript = CharacterType.isCJKScript(textContent[endOffset]);
            }
            else if (nextLeafNode != null && nextLeafNode.textContent.length > 0)
                rightIsCJKScript = CharacterType.isCJKScript(nextLeafNode.textContent[0]);
            result.push(new AlphabetSpan(textNode, startOffset, endOffset, leftIsCJKScript, rightIsCJKScript));
        }
    }
    return result;
}


function beautifyNode(node, alphabetSpans) {
    if (alphabetSpans.length == 0) return;
    var replacementSpans = [];
    var text = node.textContent;
    var curOffset = 0;
    for (var i = 0; i < alphabetSpans.length; i++) {
        var span = alphabetSpans[i];
        // when span's leftSpaceEnabled and rightSpaceEnabled are false, 
        // skip to the next span without increasing the curOffset
        if (!span.leftSpaceEnabled && !span.rightSpaceEnabled)
            continue;
        // push a textNode of the text before the span
        // and a span node representing the span itself
        if (span.startOffset > curOffset) {
            var rTextNode = document.createTextNode(text.slice(curOffset, span.startOffset));
            replacementSpans.push(rTextNode);
        }
        replacementSpans.push(span.createSpanElement());
        curOffset = span.endOffset;
    }
    if (text.length > curOffset) {
        var rTextNode = document.createTextNode(text.slice(curOffset, text.length));
        replacementSpans.push(rTextNode);
    }
    // console.log("Replacement spans:", replacementSpans);
    replacementSpans.forEach(function (span) {
        node.parentNode.insertBefore(span, node);
    });
    node.parentNode.removeChild(node);
}


function beautify(master) {
    var leafNodes = getOrderedLeafNodes(master);
    // console.log('All leaf nodes:', leafNodes);
    for (var i = 0; i < leafNodes.length; i++) {
        var leaf = leafNodes[i];
        if (!leaf.textContent.trim()) continue;
        if (!CharacterType.isAlphabetScript(leaf.textContent.trim())) continue;

        // console.log('Leaf node:', leaf);
        var previousLeafNode = (i > 0) ? leafNodes[i - 1] : null;
        var nextLeafNode = (i <= leafNodes.length) ? leafNodes[i + 1] : null;
        var alphabetSpans = findAlphabetSpans(leaf, previousLeafNode, nextLeafNode);
        // console.log('AlphabetSpans:', alphabetSpans);
        beautifyNode(leaf, alphabetSpans);
    }
}


function addCSS(className = CLASS_NAME, marginSize = DEFAULT_AUTO_MARGIN_SIZE) {
    var classSelector = (className) ? `.${CLASS_NAME}` : String();
    var cssRule = `${classSelector} span[${SPAN_ATTR_NAME}^='l'] { margin-left: ${marginSize}; }`;
    cssRule += `${classSelector} span[${SPAN_ATTR_NAME}$='r'] { margin-right: ${marginSize}; }`;
    var styleElem = document.createElement('style');
    styleElem.type = 'text/css';
    if (styleElem.styleSheet) CSS.styleSheet.cssText = cssRule; // support for IE;
    else styleElem.appendChild(document.createTextNode(cssRule));
    document.getElementsByTagName("head")[0].appendChild(styleElem);
    // console.log('CSS added', styleElem);
}


window.addEventListener('load', function () {
    var elements = this.document.getElementsByClassName(CLASS_NAME);
    var className = CLASS_NAME;
    // this.console.log('elements =', elements);
    if (elements.length > 0) {
        for (var i = 0; i < elements.length; i++) {
            beautify(elements[i]);
        }
    } else {
        var body = this.document.body;
        beautify(body);
        className = null;
    }
    addCSS(className);
})