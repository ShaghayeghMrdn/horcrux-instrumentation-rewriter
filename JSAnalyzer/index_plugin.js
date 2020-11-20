

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
var staticInfo = {};
var uncacheableFunctions = util.uncacheableFunctions;
staticInfo.rtiDebugInfo = {totalNodes:[], matchedNodes:[], ALLUrls : [], matchedUrls: [], ND:[]};
staticInfo.uncacheableFunctions = uncacheableFunctions;

var IIFE_NAME="__HORCRUX__";


function mergeInto(options, defaultOptions) {
    for (var key in options) {
        if (options[key] !== undefined) {
            defaultOptions[key] = options[key];
        }
    }
    return defaultOptions;
}

var makeId = function (type, path, node) {
    // if (node.id)
    //     var loc = node.id.loc;
    var loc = node.loc
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
    // options.proxyName = options.tracer_name +"PROXY";
    options.proxyName = "window";
    if (options.include_prefix) {
        prefix += instrumentationPrefix(options);
        options.prefix = prefix;
        // console.log(options.prefix);
    }

    if (options.cg){
        console.log("List of functions to be instrumented: " + options.cg.length);
        options.myCg = options.cg.filter(node=>node.indexOf(options.path)>=0);
        if (options.e2eTesting) options.myCg = options.cg;
        console.log("Only instrumenting the following functions from the current script " + options.myCg.length);
    } else if (options.rti){
        var percent = 20;
        console.log("[instrument] List of functions to be instrumented " + JSON.stringify(options.rti.map(el=> el.functionName)));
        //Need exact url match, hence append path with ".com"
        var urlMatchEndRegex = new RegExp("\\..{2,3}" + util.escapeRegExp2(options.origPath),'g');
        var urlMatchExactRegex = new RegExp("https?\:\/\/" + options.origPath);
        var _logStringRTI = options.rti.map((el)=>{ if(el.url.match(urlMatchEndRegex) || el.url.match(urlMatchExactRegex))return el.functionName}).filter(fn => fn != null);
        options.myRti = options.rti.map((el)=>{ if(el.url.match(urlMatchEndRegex) || el.url.match(urlMatchExactRegex)) return el}).filter(fn => fn != null);
        console.log("[instrument] Only instrumenting the following functions from the current script: " + options.origPath + " : " + JSON.stringify(_logStringRTI));

        // Logging matching information
        staticInfo.rtiDebugInfo.totalNodes = options.myRti
        var ALLUrls = options.rti.map((el)=>{return el.url}).filter((el,ind,self)=>self.indexOf(el)==ind);
        var matchedUrls = options.myRti.map((el)=>{return el.url}).filter((el,ind,self)=>self.indexOf(el)==ind);
        staticInfo.rtiDebugInfo.ALLUrls = ALLUrls;
        staticInfo.rtiDebugInfo.matchedUrls = staticInfo.rtiDebugInfo.matchedUrls.concat(matchedUrls);
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
        var inBuiltOverrides = ["tostring", "tojson", "toprimitive","typeof"];
        var isInBuiltFunction = function(fn){
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

        var markFunctionUnCacheable = function(node, reason){
            var functionNode = util.getFunctionIdentifier(node);
            if (functionNode){
                if(!uncacheableFunctions[reason])
                    uncacheableFunctions[reason]=[];
                if (uncacheableFunctions[reason].indexOf(functionNode)<0)
                    uncacheableFunctions[reason].push(functionNode);
            }
        }

        var isNonDeterministic = function(src) {
            var checks = ["new Date", "Math.random()"];
            if (checks.filter(e=>src.indexOf(e)>=0).length > 0){
                console.log('function source is ', src);
                return true;
            }
            // return ((src.indexOf("random") >= 0) || (src.indexOf("Date") >= 0));
        }


        var instrumentedNodes = [];
        m = fala({
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

        if (options.rti) {
            var remainingRTINodes =[];
            options.myRti.forEach((rtiNode)=>{
                var matchedNode = util.matchASTNodewithRTINode(rtiNode, ASTNodes, options, ASTSourceMap);
                if (matchedNode){
                    instrumentedNodes.push(matchedNode);
                    // staticInfo.rtiDebugInfo.matchedNodes.push(rtiNode);
                }
            })

            ASTNodes.forEach((node)=>{
                if (node.type == "FunctionDeclaration" || node.type == "FunctionExpression") {
                    if (instrumentedNodes.indexOf(node)<0){
                        markFunctionUnCacheable(node,"RTI");
                    }
                }
            })
        }
        else if (options.cg) {
            var instrumentedNodes = [], remainingRTINodes =[];
            ASTNodes.forEach((node)=>{
                if (node.type == "FunctionDeclaration" || node.type == "FunctionExpression") {
                    var index = makeId('function', options.path, node);
                    if (options.myCg.indexOf(index)>=0){
                        // staticInfo.rtiDebugInfo.matchedNodes.push(node);
                        instrumentedNodes.push(node);
                    } else {
                        markFunctionUnCacheable(node,"RTI");
                    }
                }

            });
        }




        var interceptDecl = "___tracerINT";
        total = 0
        totalInJs = 0

        var insideFunction = function(node){
            var parent = node.parent;
            while (parent){
                if ((parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"))
                    return true;
                parent = parent.parent;
            }
            return false;
        }

        ASTNodes.forEach((node)=>{
            if (node.type === "Program") {
                /*
                Is Js is appended with whitespaces, remove it before updating the program node
                since the whitespace is included in the program source in falafel v 2.1.0
                */

                if (options.jsInHTML){
                    update(node, node.source().replace(/^\s+|\s+$/g, ''));
                }

                /*
                Some JS files don't have access to the global execution context and they have a dynamically generated
                html file, therefore create dummy tracer functions, just to avoid runtime errors.
                */

                var tracerCheck = `\n(function(){if (typeof __tracer == 'undefined' && typeof window != 'undefined')
                 { __tracer = {cacheInit:(arg)=>{},
                    exitFunction: (arg,ret)=>{return ret}};
                 }
                })();\n`;
                var tracerCheck = `\n(function(){if (typeof __tracer == 'undefined' && typeof window != 'undefined')
                 { __tracer = window.top.__tracer;
                 }
                })();\n`;
                if (node.source().indexOf("__tracer") >=0)
                    update(node, options.prefix,tracerCheck,sourceNodes(node))
                else
                    update(node, options.prefix,sourceNodes(node))
            } else if (node.type == "CallExpression" || node.type == "NewExpression") {
                return;
                var _functionId = util.getFunctionIdentifier(node);
                if (_functionId) {
                    // var finalCallee = util.getFinalObjectFromCallee(node.callee);
                    if (node.callee.type == "MemberExpression"){
                        update(node.callee.object, interceptDecl);
                        update(node, "( (" + interceptDecl + " = (",ASTSourceMap.get(node.callee.object),")) , ",options.tracer_name,
                        '.logCallee(', node.callee.source(),',',node.source(),"))");
                    } else if (node.callee.type =="Identifier" || node.callee.type == "ThisExpression"){
                        update(node, ' ',options.tracer_name+".logCallee(",node.callee.source(),',',node.source(),")");
                    } else {
                        update(node.callee, interceptDecl);
                        update(node, "( (" + interceptDecl + " = (",ASTSourceMap.get(node.callee),")) , ",options.tracer_name,
                        '.logCallee(', node.callee.source(),',',node.source(),"))");
                    }

                    // if (node.callee.type == "SequenceExpression")
                    //     update(node, ' ',options.tracer_name+".logCallee((",node.callee.source(),'),',node.source(),")");
                    // else
                    //     update(node, ' ',options.tracer_name+".logCallee(",node.callee.source(),',',node.source(),")");
                }
            }


            else if ((node.type == "FunctionDeclaration" || node.type == "FunctionExpression")) {


                var fnName = util.getNameFromFunction(node)
                if  ((options.rti || options.cg) && instrumentedNodes.indexOf(node)>=0 && ((fnName && inBuiltOverrides.filter(e=>fnName.toLowerCase().indexOf(e)>=0).length)
                    || isInBuiltFunction(fnName)) ) {
                    console.log("[Static Analyzer] Unhandled: in built overrides in source code," + fnName);
                    markFunctionUnCacheable(node,"RTI");
                }

                var index = makeId('function', options.path, node);
                if ( (options.myRti || options.myCg)&& uncacheableFunctions["RTI"].indexOf(node)>=0)
                    return;

                var isRoot = node.id && node.id.name.indexOf(IIFE_NAME)>=0 ? true : false;

                if (isNonDeterministic(node.source())){
                    staticInfo.rtiDebugInfo.ND.push(index);
                }

                var nodeBody = node.body.source().substring(1, node.body.source().length-1);
                staticInfo.rtiDebugInfo.matchedNodes.push([index,node.time]);
                update(node.body, '{ \n try {',options.tracer_name,'.cacheInit(',JSON.stringify(index),',',JSON.stringify(isRoot),');\n',
                    node.body.source().substring(1, node.body.source().length-1),'\n');

                var _traceEnd = options.tracer_name + ".exitFunction(";// + args + ");";
                // if (options.myRti && instrumentedNodes.indexOf(node)<0){
                //  update(node.body,'{\n' ,node.body.source(),'\n', _traceEnd, JSON.stringify(index),',arguments);\n}\n');
                //  return;
                // }

                // if (!containsReturn)
                    update(node.body, node.body.source(),' \n } finally {',
                         _traceEnd, JSON.stringify(index), ',true);\n }}');
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
        // console.log("[STATIC] " , total, totalInJs )
        return processed
    } catch (e) {
        console.error('[PARSING EXCEPTION]' + e);
        return processed;
    }
}

module.exports = {
    instrument: instrument,
    staticInfo: staticInfo
};
