/*
This package will stress test the instrumentation framework
*/

var PATH_TO_INSTRUMENT_SCRIPT="../instrumentation/instrument.js"
var PATH_TO_TEST_WEBSITE ="file:///Users/ayushgoel/Google_Drive/GradSchool/Research/webPerformance/WebPeformance/tests/"
var TMP_FILE = "tmp"
const { spawn } = require('child_process');
const fondue = require('../JSAnalyzer/index.js')
const beautify = require('js-beautify');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');
const nanotimer = require('nanotimer');
var PATH_TO_REPLAY_SCRIPT = "../scripts/inspectChrome.js"


function BeautifyDump(filename, src){
    fs.writeFileSync(filename, beautify.js_beautify(src.toString()));
}


function instrumentAndExecute(src, debug){
    var instrumented = fondue.instrument(src, {e2eTesting:true, execution_cache_toggle:1, caching: false, useProxy: true});
    var sandbox = { __tracer: undefined, console: console, require: require, performance : {timing:{loadEventEnd:0}}, window : {}, localStorage : {getItem: function(){return {} }}};

    //Dump for debugging
    // if (debug)
    //     BeautifyDump(instrumentAndExecute.caller.name + ".js", instrumented);

    // var output = vm.runInNewContext(instrumented, sandbox);
    // var tracer = sandbox.__tracer;
    // console.log(sandbox.__tracer.getCustomCache())
    launchInsideChrome(instrumented.toString(), instrumentAndExecute.caller.name);
}

function launchInsideChrome(src, testName){
    var url = PATH_TO_TEST_WEBSITE;
    url += testName + ".html"
    indexHTML = fs.createWriteStream(testName + ".html");
    indexHTML.write("This is test website. \n<script>" + src + "</script>");
    indexHTML.close();
    console.log("created index.html file " + testName);

    var output = "output/" + testName + "/";
    spawn("mkdir -p " + output, {shell:true});
    var port = Math.floor(Math.random() * (9500 - 9000)) + 9000;
    //Launch a chrome process 
    chromeps = spawn("node " + PATH_TO_REPLAY_SCRIPT + " -u " + url  + " -l -o output/"+testName+"/ --log -p " + port + " -c", {shell:true} );
    // chromeps.stdout.on('data', (data) => {
    //   console.log(`${data}`);
    // });
    chromeps.stderr.on('data',(data) => {
        console.log(`${data}`);
    });

    chromeps.on('exit', function(){
        console.log("chrome exited");
    })
}

/*
Handles the following cases
- writing to global
- writing to global using alias
- reading global
- reads global inside if condition
- reads argument
- modifies argument
- returns global object
- calls another function
*/
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
            alias1["new_key"] = 3 + window[1];\
            console.log(JSON.stringify(alias));\
            second({1:2});\
            return newReadGlobal;\
        }\
        function second(arg2){\
            var alias2 = arg2; \
            newReadGlobal = newReadGlobal + 2;\
            if (window[1]) {};\
            var local = arg2[1]; \
            arg[3] = 5;\
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
        var global1,global2, global3; \
        function top1 () {\
            var alias = global3;\
            alias.a = 1;\
            global1 = 2 + alias.a;\
            var inner = function(){ \
                b.n = {};\
            };\
            var global1;\
            var b = alias;\
            document.getElementById("a").setAttribute("ayush"); \
            top2(c,d);\
            return {1:2};\
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

function simpleDOMWriteTest(){
    var src = `
        global1 = 1;
        function main(arg1, arg2){
            console.log("this is the main function");
            var a = arg6;
            var t = 99;
            var b = arguments;
            var c = a.b.window1;
            var d = arg1;
            window.a[c] = {};
            a[c][window.t] = 3;
            window.a[global3] = a[global1][global2] + 3;
            g.b && "ayush" === g.b && (a=1,b=2);
            return a,b,c;
        }
    main({});
    `

    instrumentAndExecute(src, true);
}

function detectRandomness(){
    var src =`
        var a = Math.random;
        function rollDice(){
            var diceResult = Math.random(6);
            return diceResult;
        }

        function findTimeofTheDay(){
            var date = new Date();
            return date;
        }

        function deterministicFunction(){
            var a = someGlobal;
            var changeGlobal = a  + someGlobal2;
            return 45;
        }

        function modifyDOM(){
            var elem = document.createElement('script');
            document.head.insertBefore(elem, "script");
        }
        deterministicFunction();
    `

    instrumentAndExecute(src, true);
}

function simpleWikiSnippetTest() {
    var src = `
    var global1 = 3;
    var global2 = 7;
    var global3 = {};
     function test(arg1, arg2){
        var a = global1;
        var b = window;
        b.a = {};
        b.a.global2 = 3;
        window.a.d = 7;
        b.a.global2 = window.a.d + 4;
        arg2++;
        arg1[2] = 3;
        return a;
     }
     function secondry(){
        var ret = test(global3, 3);
        console.log(ret);
    };
    secondry();
    `
    instrumentAndExecute(src, true);
}

function main(){
    // instrumnetBasicTest();
    // simpleSignaturePropogation();
    // simpleDOMWriteTest();
    detectRandomness();
    simpleWikiSnippetTest();
}


main();