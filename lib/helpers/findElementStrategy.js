import { ProtocolError } from '../utils/ErrorHandler'
import cssToXPath from 'css-to-xpath'

const DEFAULT_SELECTOR = 'css selector'

let findStrategy = function (...args) {
    let value = args[0]
    let relative = (args.length > 1 ? args[1] : false)
    let xpathPrefix = relative ? './' : '//'

    /**
     * set default selector
     */
    let using = DEFAULT_SELECTOR

    if (typeof value !== 'string') {
        throw new ProtocolError('selector needs to be typeof `string`')
    }

    if (args.length === 3) {
        return {
            using: args[0],
            value: args[1]
        }
    }

    // check value type
    // use id strategy if value starts with # and doesnt contain any other CSS selector-relevant character
    if (value.indexOf('#') === 0 && value.search(/(\s|>|\.|[|])/) === -1) {
        using = 'id'
        value = value.slice(1)

    // use xPath strategy if value starts with //
    } else if (value.indexOf('/') === 0 || value.indexOf('(') === 0 ||
               value.indexOf('../') === 0 || value.indexOf('./') === 0 ||
               value.indexOf('*/') === 0) {
        using = 'xpath'

    // use link text startegy if value startes with =
    } else if (value.indexOf('=') === 0) {
        using = 'link text'
        value = value.slice(1)

    // any selector containing given text (or any element containing text)
    } else if (/\*=(?![^\[]*\])(.+)?/.test(value)) {
        using = 'xpath'
        let query = value.split(/\*=(?![^\[]*\])(.+)?/)
        let selector = query[0].trim()
        let text = query[1].trim()
        // selector and text
        if (selector) {
            // return element which directly contains text if last element is *
            if (selector.charAt(selector.length - 1) === '*') {
                selector = selector.slice(0, -1).trim()
                value = '(' + cssToXPath(selector) + '//*[not(self::script) and not(self::style)][contains(., ' + xPathStringLiteral(text) + ')])[last()]'
            // otherwise return the element which is specified in selector
            } else {
                value = cssToXPath(selector) + '[contains(., ' + xPathStringLiteral(text) + ')]'
            }
        // only text
        } else {
            value = '(.//*[not(self::script) and not(self::style)][contains(., ' + xPathStringLiteral(text) + ')])[last()]'
        }

    // use partial link text startegy if value startes with *=
    } else if (value.indexOf('*=') === 0) {
        using = 'partial link text'
        value = value.slice(2)

    // recursive element search using the UiAutomator library (Android only)
    } else if (value.indexOf('android=') === 0) {
        using = '-android uiautomator'
        value = value.slice(8)

    // recursive element search using the UIAutomation library (iOS-only)
    } else if (value.indexOf('ios=') === 0) {
        using = '-ios uiautomation'
        value = value.slice(4)

    // recursive element search using accessibility id
    } else if (value.indexOf('~') === 0) {
        using = 'accessibility id'
        value = value.slice(1)

    // use tag name strategy if value contains a tag
    // e.g. "<div>" or "<div />"
    } else if (value.search(/<[a-zA-Z\-]+( \/)*>/g) >= 0) {
        using = 'tag name'
        value = value.replace(/<|>|\/|\s/g, '')

    // use name strategy if value queries elements with name attributes
    // e.g. "[name='myName']" or '[name="myName"]'
    } else if (value.search(/^\[name=("|')([a-zA-z0-9\-_ ]+)("|')\]$/) >= 0) {
        using = 'name'
        value = value.match(/^\[name=("|')([a-zA-z0-9\-_ ]+)("|')\]$/)[2]

    // any element with given text e.g. h1=Welcome
    } else if (value.search(/^[a-z0-9]*=(.)+$/) >= 0) {
        let query = value.split(/=/)
        let tag = query.shift()

        using = 'xpath'
        value = `${xpathPrefix}${tag.length ? tag : '*'}[normalize-space() = "${query.join('=')}"]`

    // any element containing given text
    } else if (value.search(/^[a-z0-9]*\*=(.)+$/) >= 0) {
        let query = value.split(/\*=/)
        let tag = query.shift()

        using = 'xpath'
        value = `${xpathPrefix}${tag.length ? tag : '*'}[contains(., "${query.join('*=')}")]`

    // any element with certian class or id + given content
    } else if (value.search(/^[a-z0-9]*(\.|#)-?[_a-zA-Z]+[_a-zA-Z0-9-]*=(.)+$/) >= 0) {
        let query = value.split(/=/)
        let tag = query.shift()

        let classOrId = tag.substr(tag.search(/(\.|#)/), 1) === '#' ? 'id' : 'class'
        let classOrIdName = tag.slice(tag.search(/(\.|#)/) + 1)

        tag = tag.substr(0, tag.search(/(\.|#)/))
        using = 'xpath'
        value = `${xpathPrefix}${tag.length ? tag : '*'}[contains(@${classOrId}, "${classOrIdName}") and normalize-space() = "${query.join('=')}"]`

    // any element with certian class or id + has certain content
    } else if (value.search(/^[a-z0-9]*(\.|#)-?[_a-zA-Z]+[_a-zA-Z0-9-]*\*=(.)+$/) >= 0) {
        let query = value.split(/\*=/)
        let tag = query.shift()

        let classOrId = tag.substr(tag.search(/(\.|#)/), 1) === '#' ? 'id' : 'class'
        let classOrIdName = tag.slice(tag.search(/(\.|#)/) + 1)

        tag = tag.substr(0, tag.search(/(\.|#)/))
        using = 'xpath'
        value = xpathPrefix + (tag.length ? tag : '*') + '[contains(@' + classOrId + ', "' + classOrIdName + '") and contains(., "' + query.join('*=') + '")]'
        value = `${xpathPrefix}${tag.length ? tag : '*'}[contains(@${classOrId}, "${classOrIdName}") and contains(., "${query.join('*=')}")]`

    // allow to move up to the parent or select current element
    } else if (value === '..' || value === '.') {
        using = 'xpath'
    }

    return {
        using: using,
        value: value
    }
}

// http://stackoverflow.com/a/3425925
function xPathStringLiteral(s) {
  if (s.indexOf('"') === -1) {
      return '"' + s + '"'
  }
  if (s.indexOf("'") === -1) {
      return "'" + s + "'"
  }
  return 'concat("' + s.replace(/"/g, '",\'"\',"')+'")'
}

export default findStrategy
