/*
This package will stress test the instrumentation framework
*/

var PATH_TO_INSTRUMENT_SCRIPT="../instrumentation/instrument.js"
var TMP_FILE = "tmp"
const { exec } = require('child_process');
const fondue = require('../modifiedFondue/index.js')
const beautify = require('js-beautify');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

function BeautifyDump(src){
    fs.writeFileSync("beauty.js", beautify.js_beautify(src.toString()));
}

function instrumentAndVerify(src){
    instrumented = fondue.instrument(src, {e2eTesting:true});
    var sandbox = { __tracer: undefined, console: console, require: require, performance : {timing:{loadEventEnd:0}}, window : {} };

    //Dump for debugging
    // BeautifyDump(instrumented);

    var output = vm.runInNewContext(instrumented, sandbox);
    var tracer = sandbox.__tracer;

    // Nodes contain the local and global variables 
    var nodesWithAnyVars = []

    tracer.nodes().forEach(function(node, it) {
        if (node.localvars != undefined && node.globalvars != undefined) { 
            nodesWithAnyVars.push(node);
        }
    });

    return nodesWithAnyVars;
}
function instrumentAndExecute(src){
    instrumented = fondue.instrument(src, {e2eTesting: true});

    var sandbox = { __tracer: undefined, console: console, require: require, performance : {timing:{loadEventEnd:0}}, window : {} };
    var output = vm.runInNewContext(instrumented, sandbox);
    var tracer = sandbox.__tracer;

    var MAXRESULT = 1000000;

    var functions = {};
    var uniqueFunctions = [];
    var callsites = {}
    var ids = [];
    var ids_callsites = [];
    var nodesHandle = tracer.trackNodes();
    tracer.newNodes(nodesHandle).forEach(function (n) {
        if (n.type === 'function') {
            functions[n.id] = n;
            ids.push(n.id);
        } else if (n.type == 'callsite'){
            callsites[n.id] = n;
            ids_callsites.push(n.id);   
        }
    });

    var logHandle = tracer.trackLogs({ids: ids});
    var invocations = tracer.logDelta(logHandle, MAXRESULT);

    return invocations;
}

function testForLocalGlobalAnalysis(src, localvars, globalvars, ignoreGlobal){
    console.log("..................\n[testForLocalGlobalAnalysis] Running..." );

    var result = instrumentAndVerify(src);


    // console.log(result[0].globalvars)
    // Assert the local and global vars

    assert.equal(result.length, 1);
    console.log("[testForLocalGlobalAnalysis] [PASSED] Length check" );
    assert.deepEqual(result[0].localvars, localvars, "Expected: " + result[0].localvars
        + " But got: " + localvars);
    console.log("[testForLocalGlobalAnalysis] [PASSED] Local variable check" );
    if (!ignoreGlobal)
        assert.deepEqual(result[0].globalvars, globalvars,"Expected: " + result[0].globalvars
        + "But got: " + globalvars);
    console.log("[testForLocalGlobalAnalysis] [PASSED] global variable check" );
}

function testForCallGraphCorrectness(src, args, after){
    console.log("..................\n[testForLocalGlobalAnalysis] Running..." );

    var result = instrumentAndExecute(src);

    // console.log(result[0].arguments);
    // console.log(result[0].globalDelta);
    // Assert the local and global vars

    assert.equal(result.length, 1);
    console.log("[testForCallGraphCorrectness] [PASSED] Invocation Length check" );
    assert.deepEqual(result[0].arguments.length, args);
    console.log("[testForCallGraphCorrectness] [PASSED] Arguments length check" );
    assert.deepEqual(result[0].globalDelta["After"], after);
    console.log("[testForCallGraphCorrectness] [PASSED] global Delta check" );
    console.log("....................\n");
}

function testForLocalGlobalAnalysisSimple(){
    /*
    Tests for the following
    - Global aliasing
    - local variable reading a global variable 
    - local variable referencing an argument
    - modifying a global variable using a local variable alias
    */
    var src = ' \
        window = {}; \
        var anotherGlobal = 2; \
        function local(arg1, arg2) { \
            var a = arg1; \
            var b = window; \
            b.newVar = "newValue"; \
            a = arg2 + 1; \
            var c = anotherGlobal + 3; \
        }\
        \
        /*Calling the function*/ \
        local(1,2); \
    '

    testForLocalGlobalAnalysis(src, ["a","c"], [{"b":"window"}, "b.newVar"]);
}

function testForLocalGlobalAnalysisHoisting(){
    /*
    Tests for variable hoisting

    */
    var src = '\
        var global = {}; \
        function local(arg1, arg2){ \
            /*hoisting some variable*/ \
            local = "newValue"; \
            var local; \
            var local2 = local; \
            local2 = "Some other value"; \
        } \
        local(1,2); \
    '

    testForLocalGlobalAnalysis(src, ["local", "local2"],[], true);
}

function testForCallGraphCorrectnessSimple() {
    var src = ' \
        window = {}; \
        var anotherGlobal = 2; \
        function local(arg1, arg2) { \
            var a = arg1; \
            var b = window; \
            b.newVar = "newValue"; \
            a = arg2 + 1; \
            var c = anotherGlobal + 3; \
        }\
        \
        /*Calling the function*/ \
        local(1,2); \
    '

    testForCallGraphCorrectness(src, 2, { 'b.newVar': 'newValue' });

}
function runTests(){
    testForLocalGlobalAnalysisSimple();
    testForCallGraphCorrectnessSimple();
    testForLocalGlobalAnalysisHoisting();
}

//Invoke the main function
runTests();