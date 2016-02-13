var ErrorHandler = require('../utils/ErrorHandler.js');
var cssToXPath = require('css-to-xpath');

module.exports = function findStrategy() {

    var value = arguments[0],
        relative = (arguments.length > 1 ? arguments[1] : false),
        using, query, tag, classOrId, classOrIdName, xpathPrefix;

    if (relative) {
        xpathPrefix = './';
    } else {
        xpathPrefix = '//';
    }

    if (typeof value !== 'string') {
        throw new ErrorHandler.ProtocolError('selector needs to be typeof `string`');
    }

    if (arguments.length === 3) {
        return {
            using: arguments[0],
            value: arguments[1]
        };
    }

    // check value type
    // use id strategy if value starts with # and doesnt contain any other CSS selector-relevant character
    if (value.indexOf('#') === 0 && value.search(/(\s|>|\.|[|])/) === -1) {
        using = 'id';
        value = value.slice(1);

    // use xPath strategy if value starts with //
    } else if (value.indexOf('/') === 0 || value.indexOf('(') === 0 ||
               value.indexOf('../') === 0 || value.indexOf('./') === 0 ||
               value.indexOf('*/') === 0) {
        using = 'xpath';

    // use link text startegy if value startes with =
    } else if (value.indexOf('=') === 0) {
        using = 'link text';
        value = value.slice(1);

    // any selector containing given text (or any element containing text)
    } else if (/\*=(?![^\[]*\])(.+)?/.test(value)) {
        using = 'xpath';
        query = value.split(/\*=(?![^\[]*\])(.+)?/);
        query[0] = query[0].trim(); // selector
        query[1] = query[1].trim(); // text
        // selector and text
        if (query[0]) {
            // return element which directly contains text if last element is *
            if (query[0].charAt(query[0].length - 1) === '*') {
                query[0] = query[0].slice(0, -1).trim();
                value = '(' + cssToXPath(query[0]) + '//*[not(self::script) and not(self::style)][contains(., ' + xPathStringLiteral(query[1]) + ')])[last()]';
            // otherwise return the element which is specified in selector
            } else {
                value = cssToXPath(query[0]) + '[contains(., ' + xPathStringLiteral(query[1]) + ')]';
            }
        // only text
        } else {
            value = '(.//*[not(self::script) and not(self::style)][contains(., ' + xPathStringLiteral(query[1]) + ')])[last()]';
        }

    // use partial link text startegy if value startes with *=
    } else if (value.indexOf('*=') === 0) {
        using = 'partial link text';
        value = value.slice(2);

    // use tag name strategy if value contains a tag
    // e.g. "<div>" or "<div />"
    } else if (value.search(/<[a-zA-Z\-]+( \/)*>/g) >= 0) {
        using = 'tag name';
        value = value.replace(/<|>|\/|\s/g, '');

    // use name strategy if value queries elements with name attributes
    // e.g. "[name='myName']" or '[name="myName"]'
    } else if (value.search(/^\[name=("|')([a-zA-z0-9\-_ ]+)("|')\]$/) >= 0) {
        using = 'name';
        value = value.match(/^\[name=("|')([a-zA-z0-9\-_ ]+)("|')\]$/)[2];

    // any element with given text e.g. h1=Welcome
    } else if (value.search(/^[a-z0-9]*=(.)+$/) >= 0) {
        query = value.split(/=/);
        tag = query.shift();

        using = 'xpath';
        value = xpathPrefix + (tag.length ? tag : '*') + '[normalize-space() = "' + query.join('=') + '"]';

    // any element containing given text
    } else if (value.search(/^[a-z0-9]*\*=(.)+$/) >= 0) {
        query = value.split(/\*=/);
        tag = query.shift();

        using = 'xpath';
        value = xpathPrefix + (tag.length ? tag : '*') + '[contains(., "' + query.join('*=') + '")]';

    // any element with certian class or id + given content
    } else if (value.search(/^[a-z0-9]*(\.|#)-?[_a-zA-Z]+[_a-zA-Z0-9-]*=(.)+$/) >= 0) {
        query = value.split(/=/);
        tag = query.shift();

        classOrId = tag.substr(tag.search(/(\.|#)/), 1) === '#' ? 'id' : 'class';
        classOrIdName = tag.slice(tag.search(/(\.|#)/) + 1);

        tag = tag.substr(0, tag.search(/(\.|#)/));
        using = 'xpath';
        value = xpathPrefix + (tag.length ? tag : '*') + '[contains(@' + classOrId + ', "' + classOrIdName + '") and normalize-space() = "' + query.join('=') + '"]';

    // any element with certian class or id + has certain content
    } else if (value.search(/^[a-z0-9]*(\.|#)-?[_a-zA-Z]+[_a-zA-Z0-9-]*\*=(.)+$/) >= 0) {
        query = value.split(/\*=/);
        tag = query.shift();

        classOrId = tag.substr(tag.search(/(\.|#)/), 1) === '#' ? 'id' : 'class';
        classOrIdName = tag.slice(tag.search(/(\.|#)/) + 1);

        tag = tag.substr(0, tag.search(/(\.|#)/));
        using = 'xpath';
        value = xpathPrefix + (tag.length ? tag : '*') + '[contains(@' + classOrId + ', "' + classOrIdName + '") and contains(., "' + query.join('*=') + '")]';

    // allow to move up to the parent or select current element
    } else if (value === '..' || value === '.')  {
        using = 'xpath';

    // if nothing fits with the supported strategies we fall back to the css selector strategy
    } else {
        using = 'css selector';
    }

    return {
        using: using,
        value: value
    };
};

// http://stackoverflow.com/a/3425925
function xPathStringLiteral(s) {
  if (s.indexOf('"') === -1)
    return '"'+s+'"';
  if (s.indexOf("'") === -1)
    return "'"+s+"'";
  return 'concat("'+s.replace(/"/g, '",\'"\',"')+'")'
}
