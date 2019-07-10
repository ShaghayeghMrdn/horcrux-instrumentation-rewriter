

var falafel = require('falafel');
var falafelMap = require('falafel-map');
var fs = require('fs');
var basename = require('path').basename;
var esprima = require('esprima');
var mergeDeep = require('deepmerge');
var scope = require('./scopeAnalyzer.js');
var util = require('./util.js');
var signature = require('./signature.js');
var e2eTesting = false;
var anonCounter = 0;
var node2index = new Map();


function mergeInto(options, defaultOptions) {
    for (var key in options) {
        if (options[key] !== undefined) {
            defaultOptions[key] = options[key];
        }
    }
    return defaultOptions;
}

var makeId = function (type, path, node) {
    if (node.id)
        var loc = node.id.loc;
    else var loc = node.loc
    if (e2eTesting) {
        if (node2index.get(node))
            return node2index.get(node);
        // console.log(functionCounter);
        var origPath = path + '-'
         + type + '-'
         + loc.start.line + '-'
         + loc.start.column + '-'
         + loc.end.line + '-'
         + loc.end.column;
        var name = node.id != undefined ? node.id.name : "function_" + anonCounter++;
        
        // functionCounter = functionCounter + 1;
        // console.log( " function counter is " + functionCounter)
        // simpleFunctions[origPath] = id;
        node2index.set(node,name);
        return name;
    }

    return path + '-'
         + type + '-'
         + loc.start.line + '-'
         + loc.start.column + '-'
         + loc.end.line + '-'
         + loc.end.column;
};



function instrument(src, options) {
    // Since the fondue module is loaded once, re initialize the counter for every new src file

    var defaultOptions = {
        include_prefix: true,
        tracer_name: '__tracer',
        e2eTesting: false,
    };
    options = mergeInto(options, defaultOptions);
    e2eTesting = options.e2eTesting;
    var prefix = '', shebang = '', output, m;

    if (m = /^(#![^\n]+)\n/.exec(src)) {
        shebang = m[1];
        src = src.slice(shebang.length);
    }
    // console.log(options);
    options.proxyName = options.tracer_name +"PROXY";
    if (options.include_prefix) {
        prefix += instrumentationPrefix(options);
        options.prefix = prefix;
        // console.log(options.prefix);
    }

    if (options.cg){
        console.log("List of functions to be instrumented: " + options.cg.length);
        options.myCg = options.cg.filter(node=>node.indexOf(options.path)>=0);
        // staticInfo.rtiDebugInfo.totalNodes = options.myCg;
        console.log("Only instrumenting the following functions from the current script " + options.myCg.length);
    }

    if (src.indexOf("/*theseus" + " instrument: false */") !== -1) {
        output = shebang + prefix + src;
    } else {
        var m = traceFilter(src, options);
        output = {
            map: m.map,
            toString: function () {
                return shebang + m.toString();
            },
        };
    }

    return output;
}


var traceFilter = function (content, options) {
    // console.log(options)
    if (content.trim() === '') {
        return content;
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

    var processed = content;

    try {
        var fala, update, sourceNodes, functionNameToLocation = {}; // Dictionary: key is function name, value is an array containing all the locations it was defined. 

        var ASTNodes = []; // List of all the nodes in the abstract syntax tree
        var ASTSourceMap = new Map();
        var functionToCallees = {};
        var functionsContainingThis = [];
        var functionToNonLocals = {};
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
        var sourceNodes = function (node) {
            return node.source();
        };

        m = fala({
            source: content,
            loc: true,
            range: true,
            sourceFilename: options.sourceFilename || options.path,
            generatedFilename: options.generatedFilename || options.path,
            // tolerant: true,
        }, function (node) {
            if (node.type === "Program") { 
                /*
                Some JS files don't have access to the global execution context and they have a dynamically generated
                html file, therefore create dummy tracer functions, just to avoid runtime errors. 
                */
                var tracerCheck = `\n(function(){if (typeof __tracer == 'undefined')
                 { __tracer = {cacheInit:(arg)=>{}, 
                    exitFunction: (arg,ret)=>{return ret}};
                 }
                })();\n`;
                var tracerCheck = `\n(function(){if (typeof __tracer == 'undefined')
                 { __tracer = window.top.__tracer;
                 }
                })();\n`;
                if (node.source().indexOf("__tracer") >=0)
                    update(node, options.prefix,tracerCheck,sourceNodes(node))
                else 
                    update(node, options.prefix,sourceNodes(node))
            } else if ((node.type == "FunctionDeclaration" || node.type == "FunctionExpression")) {
                var containsReturn = false;
                var index = makeId('function', options.path, node);
                // if (options.myCg.indexOf(index)<0) return;
                if (node.containsReturn) containsReturn = true;
                var nodeBody = node.body.source().substring(1, node.body.source().length-1);

                update(node.body, '{ \n try {',options.tracer_name,'.cacheInit(',JSON.stringify(index),',arguments);\n',
                    node.body.source().substring(1, node.body.source().length-1));

                var _traceEnd = options.tracer_name + ".exitFunction(";// + args + ");";
                // if (options.myRti && instrumentedNodes.indexOf(node)<0){
                //  update(node.body,'{\n' ,node.body.source(),'\n', _traceEnd, JSON.stringify(index),',arguments);\n}\n');
                //  return;
                // }

                // if (!containsReturn)
                    update(node.body, node.body.source(),' \n } catch (e){ console.error("[ERROR]" + ', JSON.stringify(index) + '+ " " + e.message', ')}  finally {',
                         _traceEnd, JSON.stringify(index), ');\n }}');
                // else 
                    // update(node.body, node.body.source(),'}');
                
            } /*else if (node.type == "ReturnStatement") {
                var _functionId = util.getFunctionIdentifier(node);
                if (_functionId) {
                    _functionId.containsReturn = true;
                    var functionId = makeId('function', options.path, _functionId);
                    // if (options.myCg.indexOf(functionId)<0) return;
                    var _traceEnd = options.tracer_name + ".exitFunction(";
                    if (node.argument && node.argument.type == "SequenceExpression" ) {
                        var returnValue = node.argument.expressions[node.argument.expressions.length - 1];
                        var preReturns = node.argument.expressions.slice(0,-1).map(function(e){return e.source()}).join();
                        update(node, 'return ',preReturns ,',', options.tracer_name, 
                        '.exitFunction(', JSON.stringify(functionId), ',',returnValue.source() ,',arguments',');');
                    
                    } else {
                            update(node, "return ", options.tracer_name, '.exitFunction(', JSON.stringify(functionId),
                             ',', node.argument?node.argument.source():"null",',arguments',");");
                        }
                    }
                // } else {console.log("ERROR analyses says return is outside function " + ASTSourceMap.get(node))}
            }*/
        });
        processed = m;
        return processed
    } catch (e) {
        return processed;
        console.error('[PARSING EXCEPTION]' + e);
    }
}

module.exports = {
    instrument: instrument
};