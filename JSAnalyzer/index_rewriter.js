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

const makeId = function (type, path, node) {
    // This should be consistent with makeId in index_plugin.js & index.js.
    if (node.id)
        var loc = node.id.loc;
    else var loc = node.loc;
    return path + '-'
         + type + '-'
         + loc.start.line + '-'
         + loc.start.column + '-'
         + loc.end.line + '-'
         + loc.end.column;
};

/* Helper function/var for detecting in-built function and overrides */
const inBuiltOverrides = ["tostring", "tojson", "toprimitive", "typeof"];
const isInBuiltFunction = function(fn){
    if (!fn)
        return false;
    try {
        var _e = eval(fn);
        if (typeof _e == "function")
            return true;
        return false;
    } catch (e){
        return false;
    }
}

/*
Marks the function containing the node provided as argument, as uncacheable
*/
const markFunctionUnCacheable = function(node, reason){
    var functionNode = util.getFunctionIdentifier(node);
    if (functionNode){
        if(!uncacheableFunctions[reason])
            uncacheableFunctions[reason]=[];
        if (uncacheableFunctions[reason].indexOf(functionNode)<0)
            uncacheableFunctions[reason].push(functionNode);
    }
}


function instrument(src, options) {
    var shebang = '', m;
    if (m = /^(#![^\n]+)\n/.exec(src)) {
        shebang = m[1];
        src = src.slice(shebang.length);
    }

    if (options.cg){
        // options.myCg includes only the root invocations that are within this piece of JS
        options.myCg = options.cg.filter(node => node.indexOf(options.path) >= 0);
        console.log(`Only instrumenting ${options.myCg.length} function(s) from "${options.path}" script`);
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
        let ASTNodes = []; // List of all the nodes in the abstract syntax tree
        let ASTSourceMap = new Map();
        let instrumentedNodes = [];

        let fala = function () {
            var m = falafel.apply(this, arguments);
            return {
                map: function () { return '' },
                chunks: m.chunks,
                toString: function () { return m.toString() },
            };
        };
        let update = function (node) {
            node.update(Array.prototype.slice.call(arguments, 1).join(''));
        };

        content = globalWrapper.wrap(content, fala);
        result.wrappedSrc = content;

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


        // Mark the root invocations that are given in the roots (cg) file
        if (options.cg) {
            ASTNodes.forEach(node => {
                if (node.type == "FunctionDeclaration" || node.type == "FunctionExpression") {
                    var index = makeId('function', options.path, node);
                    if (options.myCg.indexOf(index) >= 0) {
                        console.log("[Static analyzer] Function matching reported a match")
                        instrumentedNodes.push(node);
                    } else {
                        markFunctionUnCacheable(node,"RTI");
                    }
                }
            });
        }

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
            else if ((node.type == "FunctionDeclaration" || node.type == "FunctionExpression")) {

                var fnName = util.getNameFromFunction(node);
                if ((options.rti || options.cg) &&
                    instrumentedNodes.indexOf(node) >= 0 &&
                    ((fnName && inBuiltOverrides.filter(e => fnName.toLowerCase().indexOf(e) >= 0).length)
                    || isInBuiltFunction(fnName))) {
                    console.log("[Static Analyzer] Unhandled: in built overrides in source code," + fnName);
                    markFunctionUnCacheable(node,"RTI");
                }

                var index = makeId('function', options.path, node);
                if ((options.myRti || options.myCg) && uncacheableFunctions["RTI"].indexOf(node) >= 0)
                    return;

                // dropping the enclosing {}s
                var nodeBody = node.body.source().substring(1, node.body.source().length-1);
                let newBody = '{\nlet body = ' + JSON.stringify(nodeBody) + ';\n}';
                update(node.body, newBody);
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