const falafel = require('falafel');
const fs = require('fs');
const util = require('./util.js');
const IIFE_NAME = "__HORCRUX__";

/* Shaghayegh: I probably will not need these staticInfo,
but they are defined here to follow the instrumentor interface
needed in record.js */
const staticInfo = {};
const uncacheableFunctions = util.uncacheableFunctions;
staticInfo.rtiDebugInfo = {totalNodes:[], matchedNodes:[], ALLUrls : [], matchedUrls: [], ND:[]};
staticInfo.uncacheableFunctions = uncacheableFunctions;

/** Checks if the location referred by otherIndex is enclosed in current loc
 * @param {string} otherIndex taken from signature or call graph
 * @param {SourceLocation} currentLoc current node.loc object
 * @return {boolean} returns true if other index is enclosed
 */
function isEnclosed (otherIndex, currentLoc) {
    const parts = otherIndex.split('-');
    const start_line = parts[parts.length-4],   // loc.start.line
        start_col = parts[parts.length-3],      // loc.start.column
        end_line = parts[parts.length-2],       // loc.end.line
        end_col = parts[parts.length-1];        // loc.end.column

    const defStartsInside = (
        (start_line > currentLoc.start.line) ||
        (start_line == currentLoc.start.line &&
            start_col > currentLoc.start.column));

    const defEndsInside = (
        (end_line < currentLoc.end.line) ||
        (end_line == currentLoc.end.line &&
            end_col < currentLoc.end.column));

    return (defStartsInside && defEndsInside);
}


/** Rewriting helper function:
 * returns an array containing the definitions of callee functions called by
 * current function (identified by currentLoc). Nested functions that are
 * defined inside the current function body are excluded!
 */
function getNestedFnBodies (calleeIndexes, currentLoc, origPath, srcLines) {
    // look up the needed definitions in options.htmlLines
    const calleeDefs = [];
    calleeIndexes.forEach(function(calleeIndex) {
        const parts = calleeIndex.split('-');
        let calleePath = '';
        // parts[parts.length-5] -> "function" keyword
        // therefore to build callee original path just go up to -5, but
        let calleePathBound = parts.length - 5;
        // parts[parts.length-6] -> might be a number if callee was in HTML
        // parts[parts.length-7] -> might be "script" if callee was in HTML
        if (parts.length > 7 &&
            parts[parts.length-7] == 'script' &&
            parseInt(parts[parts.length-6]) != 'NaN') {
            // then the callee was defined inside an HTML, skip -6 and -7
            calleePathBound -= 2;
        }
        for (let i = 0; i < calleePathBound; ++i) {
            calleePath += (parts[i] + '-');
        }
        // remove the extra '-' at the end
        calleePath = calleePath.slice(0, -1);
        if (calleePath != origPath) {
            // TODO: later have to figure out how to get function bodies that
            // are not defined in this file and to get those files wrapped src
            console.log(`WARN: ${calleePath} function called in ${origPath}`);
            return;
        }
        const start_line = parts[parts.length-4],   // loc.start.line
            start_col = parts[parts.length-3],      // loc.start.column
            end_line = parts[parts.length-2],       // loc.end.line
            end_col = parts[parts.length-1];        // loc.end.column

        if (!isEnclosed(calleeIndex, currentLoc)) {
            // callee is defined outside currentFn
            let fnDef = "";
            if (end_line > srcLines.length ||
                end_col > srcLines[end_line-1].length) {
                console.error(`ERROR: ${calleeIndex} falls out of src!`);
                return;
            }
            if (start_line == end_line) {
                const line = srcLines[start_line-1];
                fnDef += line.substring(start_col-1, end_col);
            } else {
                let i = start_line-1;
                fnDef += srcLines[i].substring(start_col-1) + '\n';
                // attention: i is increased and then condition is evaluated
                while ((++i) < end_line-1) {
                    fnDef += srcLines[i] + '\n';
                }
                // add the last line: now i is end_line-1
                fnDef += srcLines[i].substring(0, end_col);
            }
            calleeDefs.push(fnDef+'\n');
        }
    });
    return calleeDefs;
};

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
    // if (node.id)
    //     var loc = node.id.loc;
    var loc = node.loc;
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
    // options.cg should not be null at this point, have checked in reocrd.js
    options.myCg = options.cg.filter(node => node.indexOf(options.path) >= 0);
    const rootNum = options.myCg.length;
    console.log(`>>>>>[${options.path}]: instrument ${rootNum} function(s)`);

    var shebang = '', m;
    if (m = /^(#![^\n]+)\n/.exec(src)) {
        shebang = m[1];
        console.log(`INFO: shebang: ${shebang}`);
        src = src.slice(shebang.length);
    }

    const instrumented = traceFilter(src, options);
    var output = {
        toString: function () {
            return shebang + instrumented.toString();
        }
    };
    return output;
}


var traceFilter = function (content, options) {
    let instrumented = content;

    if (content.trim() === '') {
        return instrumented;
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

        const fala = function () {
            var m = falafel.apply(this, arguments);
            return {
                map: function () { return '' },
                chunks: m.chunks,
                toString: function () { return m.toString() },
            };
        };
        const update = function (node) {
            node.update(Array.prototype.slice.call(arguments, 1).join(''));
        };

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
                        // console.log("[Static analyzer] Function matching reported a match")
                        instrumentedNodes.push(node);
                    } else {
                        markFunctionUnCacheable(node, "RTI");
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
                    update(node, '\n', node.source().replace(/^\s+|\s+$/g, ''), '\n');
                }
            }
            else if ((node.type == "FunctionDeclaration" || node.type == "FunctionExpression")) {

                var fnName = util.getNameFromFunction(node);
                if ((options.rti || options.cg) &&
                    instrumentedNodes.indexOf(node) >= 0 &&
                    ((fnName && inBuiltOverrides.filter(e => fnName.toLowerCase().indexOf(e) >= 0).length)
                    || isInBuiltFunction(fnName))) {
                    console.log("[Static Analyzer] Unhandled: in built overrides in source code," + fnName);
                    markFunctionUnCacheable(node, "RTI");
                }
                /* If a node is marked as uncacheable: it is either a built-in
                function invocation or non-root invocation. Therefore, there is
                no need to rewrite it's body. */
                if (uncacheableFunctions["RTI"].indexOf(node) >= 0)
                    return;

                let index = makeId('function', options.path, node);
                // dropping the enclosing {}s
                let nodeBody = node.body.source().substring(1, node.body.source().length-1);
                const rootSignature = options.signature[index];
                if (!rootSignature || !rootSignature["sig"]) {
                    console.log(`WARN: no signature for ${index}` +
                                " ... not changing the body!");
                    return;
                }
                let touchDOM = false;
                const dependencies = [];
                rootSignature["sig"].forEach((dependency) => {
                    if (dependency[0] == 'DOM_read'
                        || dependency[0] == 'DOM_write') {
                        touchDOM = true;
                        return;
                    }
                    if (typeof dependency[0] !== "string" ||
                        typeof dependency[1] !== "string") {
                        console.log(`WARN: ignored [${dependency}]: ${index}`);
                        return;
                    } else {
                        // if closure variable dependencies are enclosed in
                        // the function body, then skip that dependency
                        const firstUnder = dependency[0].indexOf('_');
                        const lastUnder = dependency[0].lastIndexOf('_');
                        console.assert(firstUnder != -1,
                            `Expected at least one '_' in ${dependency[0]}`);
                        if (dependency[0].substring(0, firstUnder) == 'closure') {
                            const location = dependency[0].substring(firstUnder+1, lastUnder);
                            // console.log(location, 'vs', node.loc);
                            if (!isEnclosed(location, node.loc)) {
                                dependencies.push(dependency);
                            }
                        } else {
                            dependencies.push(dependency);
                        }
                        // if the first part of variable name is 'document'
                        // then the function is touching DOM
                        const parts = dependency[1].split(';;;;');
                        // variable name starts with ;;;; so skip index 0
                        if (parts[1] == 'document') {
                            touchDOM = true;
                        }
                    }
                });

                const calleeFunctions = options.callGraph[index];
                if (!Array.isArray(calleeFunctions)) {
                    console.error(`Error: no callGraph entry for ${index}`);
                    return;
                }
                const fnDefs = getNestedFnBodies(calleeFunctions, node.loc,
                    options.origPath, options.srcLines);

                const newBody = '{\n\tconst body = ' +
                                JSON.stringify(nodeBody) + ';\n' +
                                '\tconst fnDefs= ' +
                                JSON.stringify(fnDefs) + ';\n' +
                                '\tconst signature = ' +
                                JSON.stringify(dependencies) + ';\n' +
                                `\t__callScheduler__("${index}", ` +
                                `body, signature, touchDOM = ${touchDOM});\n` +
                                '}';
                // console.log(newBody);
                update(node.body, newBody);
            }

        });

        instrumented = falafelOutput;
        return instrumented;
    } catch (e) {
        console.error('[PARSING EXCEPTION] ' + e);
        throw e;
    }
    // } finally {
    //     return instrumented;
    // }
}

module.exports = {
    instrument: instrument,
    staticInfo: staticInfo
};