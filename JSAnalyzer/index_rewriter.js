const falafel = require('falafel');
const fs = require('fs');
const util = require('./util.js');
const globalWrapper = require('./global-code-wrapper.js');
const IIFE_NAME = "__HORCRUX__";

/* Shaghayegh: I probably will not need these staticInfo,
but they are defined here to follow the instrumentor interface
needed in record.js */
const staticInfo = {};
const uncacheableFunctions = util.uncacheableFunctions;
staticInfo.rtiDebugInfo = {totalNodes:[], matchedNodes:[], ALLUrls : [], matchedUrls: [], ND:[]};
staticInfo.uncacheableFunctions = uncacheableFunctions;


function mergeInto(options, defaultOptions) {
    for (var key in options) {
        if (options[key] !== undefined) {
            defaultOptions[key] = options[key];
        }
    }
    return defaultOptions;
}

var makeId = function (type, path, node) {
    let loc = node.loc;
    return path + '-'
         + type + '-'
         + loc.start.line + '-'
         + loc.start.column + '-'
         + loc.end.line + '-'
         + loc.end.column;
};


function instrument(src, options) {
    var shebang = '', m;
    if (m = /^(#![^\n]+)\n/.exec(src)) {
        shebang = m[1];
        src = src.slice(shebang.length);
    }

    const {wrappedSrc, instrumented} = traceFilter(src, options);
    // console.log(instrumented.toString());
    // console.log('---------------------------');
    var output = {
        toString: function () {
            return shebang + instrumented.toString();
        },
        wrappedSrc: wrappedSrc,
    };
    return output;
}


var traceFilter = function (content, options) {
    let result = {
        wrappedSrc: content,
        instrumented: content,
    };

    if (content.trim() === '') {
        return result;
    }
    var defaultOptions = {
        path: '<anonymous>',
        prefix: '',
        tracer_name: '__tracer',
        trace_function_entry: true,
        trace_function_creation: false,
        trace_function_calls: false,
        trace_branches: false,
        trace_switches: false,
        trace_loops: false,
        source_map: false,
        execution_cache_toggle : 0,
    };
    options = mergeInto(options, defaultOptions);
    // console.log(options);

    try {
        var ASTNodes = []; // List of all the nodes in the abstract syntax tree
        var ASTSourceMap = new Map();
        var fala = function () {
            var m = falafel.apply(this, arguments);
            return {
                map: function () { return '' },
                chunks: m.chunks,
                toString: function () { return m.toString() },
            };
        };
        var update = function (node) {
            node.update(Array.prototype.slice.call(arguments, 1).join(''));
        };

        content = globalWrapper.wrap(content, fala);
        result.wrappedSrc = content;
        // var instrumentedNodes = [];
        let falafelOutput = fala({
            source: content,
            locations: true,
            ranges: true,
            sourceFilename: options.sourceFilename || options.path,
            generatedFilename: options.generatedFilename || options.path,
            // tolerant: true,
        }, function (node) {
            ASTNodes.push(node);
            ASTSourceMap.set(node,node.source());
        });


        ASTNodes.forEach((node) => {
            if (node.type === "Program") {
                /* Ayush: If JS program is perpended  and appended with whitespace,
                remove it before updating the program node since the whitespace
                is included in the program source in falafel v2.1.0.
                Shaghayegh: Added a starting and trailing \n
                in order to have <script> tags in separate lines. */
                if (options.jsInHTML){
                    update(node, '\n',node.source().replace(/^\s+|\s+$/g, ''),'\n');
                }
            }

        });

        result.instrumented = falafelOutput;
    } catch (e) {
        console.error('[PARSING EXCEPTION]' + e);
    } finally {
        return result;
    }
}

module.exports = {
    instrument: instrument,
    staticInfo: staticInfo
};