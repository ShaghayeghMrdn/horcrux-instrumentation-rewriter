/*
This package will stress test the instrumentation framework
*/

var PATH_TO_INSTRUMENT_SCRIPT="../instrumentation/instrument.js"
var TMP_FILE = "tmp"
const { exec } = require('child_process');
const fondue = require('../JSAnalyzer/index.js')
const beautify = require('js-beautify');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');
const nanotimer = require('nanotimer');


function BeautifyDump(src){
    fs.writeFileSync("beauty.js", beautify.js_beautify(src.toString()));
}


function instrumentAndExecute(src, debug){
    var instrumented = fondue.instrument(src, {e2eTesting:true, execution_cache_toggle:1});
    var sandbox = { __tracer: undefined, console: console, require: require, performance : {timing:{loadEventEnd:0}}, window : {}, localStorage : {getItem: function(){return {} }}};

    //Dump for debugging
    if (debug)
        BeautifyDump(instrumented);

    var output = vm.runInNewContext(instrumented, sandbox);
    var tracer = sandbox.__tracer;
}

function instrumnetBasicTest(){
    var src = ' \
        window = {}; \
        alias = {};\
        window[1] = 2;\
        var anotherGlobal = 1; \
        var newReadGlobal = 2;\
        function first(arg1) { \
            var alias1 = window; \
            anotherGlobal = anotherGlobal + 2; \
            alias["new_key"] = 3 + window[1];\
            alias1 = 2;\
            console.log(JSON.stringify(alias));\
            second({1:2});\
        }\
        function second(arg2){\
            var alias2 = arg2; \
            newReadGlobal = newReadGlobal;\
            if (ayush || goel || loser) {};\
            var local = arg2[1]; \
        }\
        first(1);\
    ';
    instrumentAndExecute(src, true);
}

function snippetfromGoogleSimple(){
    var src = "\
    function sample(){ \
        var s = document.getElementById('searchform');\
    var w = document['body'] && document.body['offsetWidth'];\
    if (s && w && w >= _j) {\
        s.className += ' big';\
      }\
    }\
        ";
    instrumentAndExecute(src, true);
}

function simpleSignaturePropogation(){
    var src ='\
        var global1,global2, global3=0; \
        function top1 () {\
            global1 = 2 + global3;\
            top2();\
        }\
        function top2(){\
            global2 = 2;\
            top3();\
        }\
        function top3(){\
            global3 = 3;\
        }\
    ';

    instrumentAndExecute(src, true);
}

function main(){
    // instrumnetBasicTest();
    simpleSignaturePropogation();
}


main();