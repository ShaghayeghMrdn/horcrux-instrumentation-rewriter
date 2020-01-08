/*
This package will stress test the instrumentation framework


List down the different components of my system and then we will compile tests of every component individually 

The only way to ensure the system is completely correct is to manually store the expected signature and 
then compare the system's output against the actual signature. 

- Static analyser
    - No way to test the correctness of the static analyzer, apart from running it against different types of source code 
      and make sure there are no runtime exceptions. 

- Dynamic analysis 
   - Record
    - Ensuring the callgraph length is as intended
    - Ensure that the list of  non cacheable codes is as intended, with the corresponding correct reason
    - Code contains no runtime exceptions, and the error log file is empty
    - The signature processing happens without any errors/parent paths not not being found
    - The final stored signature is equal to what was expected
    Specifics/Components
      - Ensuring intermediate reads are removed
      - Ensuring the references aren't broken for writes that are globals 
      - Ensure correct replay of in built API calls
        - Different types of API calls 
      - Ensure errors were also replayed
      - 

      Mimic the dynamic/diverse web characteristics
      - Hard to exhaustively think of every possible js construct and come up with a test case
      - However try and go for more complex objects as opposed to simple objects
      - pass, window , global and dom objects whereever possible. 

      Write functions in such a way, and if replayed incorrectly, the execution throws runtime exception. 
*/

var PATH_TO_INSTRUMENT_SCRIPT="../instrumentation/instrument.js"
var PATH_TO_TEST_WEBSITE="file:///" + __dirname +"/";
var PATH_TO_TEST_WEBSITE="http://goelayu4929.eecs.umich.edu:99/"
// var PATH_TO_TEST_WEBSITE ="file:///Users/ayushgoel/Google_Drive/GradSchool/Research/webPerformance/WebPeformance/tests/"
var TMP_FILE = "tmp"
const { spawn } = require('child_process');
const { spawnSync } = require('child_process');
const beautify = require('js-beautify');
const vm = require('vm');
const fs = require('fs');
const assert = require('assert');
const nanotimer = require('nanotimer');
var PATH_TO_REPLAY_SCRIPT = "../scripts/inspectChrome.js";
var mkdirp = require('mkdirp');
var config;
var properties = require('properties');
const PATH_TO_PROPERTIES = "../JSAnalyzer/" + "/tracer.ini";
properties.parse(PATH_TO_PROPERTIES, {path: true, sections: true}, function(err, obj){ config = obj ;})

var OUTPUT = "output/"
var program = require('commander');

var testResults = {total:0, passed:[], failed:[]};

var evalStringFile = "EVALFile"

var instrumentation_plugins = {
    record : "record.js",
    ND : "ND.js"
}

program
    .option('-t, --test [test]', 'Specific test to run')
    .option('-i, --inst [inst]', 'Type of instrumentation to perform')
    .option('-p, --pattern [pattern]','Pattern of instrumentation, cg,caching')
    .parse(process.argv);


function BeautifyDump(filename, src){
    fs.writeFileSync(filename, beautify.js_beautify(src.toString()));
}


function instrumentAndExecute(src, testName, evalString){
    var src = '<script>' + src + '</script>'; 
    var content = "This is test website. <script src = 'abc.com' integrity='sha512-bphhLbLcXT9eMxqQAvdA=='></script>\n<script src = '' integrity='sha512-bphhLbLcXT9cdscdsceMxqQAvdA=='></script>\n" + src;
    testResults.total++;
    var fondue = require('../JSAnalyzer/index.js')
    var instrumentor = require('../instrumentation/' + "record.js");
    var instrumented = instrumentor.instrumentHTML(content, {e2eTesting:true, origPath: "test", path:"test",
     useProxy: true, cg:["a","b","c","d","e","fn1","inner","w"],cgTime:[1,2,3,4,5,6,7,null], pattern:program.pattern, pageLoaded: config[program.pattern].pageLoaded, invocation_limit:config[program.pattern].invocation_limit,
         pattern:program.pattern});
    var sandbox = { __tracer: undefined, console: console, require: require, performance : {timing:{loadEventEnd:0}}, window : {}, localStorage : {getItem: function(){return {} }}};

    //Dump for debugging
    // if (debug)
    //     BeautifyDump(instrumentAndExecute.caller.name + ".js", instrumented);

    // var output = vm.runInNewContext(instrumented, sandbox);
    // var tracer = sandbox.__tracer;
    // console.log(sandbox.__tracer.getCustomCache())
    launchInsideChrome(src, instrumented.toString(), testName, evalString);
}

function runReplayScript(url, testName, port, mode, evalFunction){

    mk = spawnSync("mkdir -p output/" + mode + "/" + testName + "/", {shell:true});
    var nodeCommand = "node " + PATH_TO_REPLAY_SCRIPT + " -u " + url  + " -l -o "+OUTPUT+"/"+mode+"/" +testName+"/ --log -n -c -j -p " + port + " --mode " + mode ;
    if (evalFunction)
        nodeCommand += " --correctness"
    console.log("Running chrome with command: " + nodeCommand);
    chromeps = spawnSync(nodeCommand, {shell:true} );

    return chromeps;
}

function constructEvalFunction(evalString){
    var evalFunction = `function evalCorrectness(){ ` + 
        ` return `+ evalString + `;} 
        evalCorrectness();`;
        return evalFunction;
}

function launchInsideChrome(origSrc, src, testName, evalString){
    var url = PATH_TO_TEST_WEBSITE;
    url += testName + ".html"
    var htmlFile = testName + ".html",
    origHtmlFile = testName + ".orig.html"
    console.log("Writing to file: " + htmlFile );
    fs.writeFileSync(htmlFile, src);
    fs.writeFileSync(origHtmlFile, "This is test website. " + origSrc);
    console.log("created html file " + testName);

    var mode = program.inst;

    var output = OUTPUT + "/" +mode+"/"+ testName + "/";
    spawnSync("mkdir -p " + output, {shell:true});
    var port = Math.floor(Math.random() * (9500 - 9222)) + 9222;

    if (evalString){
        var evalFunction = constructEvalFunction(evalString);
        fs.writeFileSync(evalStringFile, evalFunction);
    }

    var chromeps = runReplayScript(url, testName, port, mode);

    
    // redirect chrome process output
    console.log(chromeps.stdout.toString());
    console.log(chromeps.stderr.toString());

    var chromeps = runReplayScript(url, testName, port, "replay");

    console.log(chromeps.stdout.toString());
    console.log(chromeps.stderr.toString());



    //     testResults.failed.push(testName)
    // else testResults.passed.push(testName)
}

function logger(src,testName, evalString){
    console.log("\n[TEST " + testName+"] : Starting...");
    console.log("[TEST " + testName+"] : Running test...");
    instrumentAndExecute(src, testName, evalString);
    console.log("[TEST "+ testName+"] : Test completed...");
    console.log("[TEST "+ testName+"] : Running verifier...");
}

var reader = function(path){
    return JSON.parse(fs.readFileSync(path, "utf-8"));
}

function overAllVerifier(testName,mode, values){
    var dataPath = OUTPUT + "/" + mode + "/" + testName;
    var cg = reader(dataPath+"/callGraph").value,
        logs = reader(dataPath+"/logs");

    if (mode == "record") {
        var nonCache = reader(dataPath+"/noncacheable").value;
        assert.strictEqual(Object.keys(cg).length, values.cg,'CG length');
        assert.strictEqual(logs.filter(e=>e.type == 'error' || e.exceptionDetails).length,0,'record erors');
        assert.strictEqual(Object.keys(nonCache).length, 0,'nonCache length');
    } else {
        var cacheExists = reader(dataPath+"/cacheExists").value,
            cacheStats = reader(dataPath+"/cacheStats").value;
        assert.strictEqual(cacheExists,'1','cache exists');
        assert.strictEqual(cacheStats.hits.length,values.hits,'cache hits value');
        assert.strictEqual(logs.filter(e=>e.type == "log" && e.args && e.args.length
            && e.args[0].value == "incorrect").length,0,'replay errors'); 
        assert.strictEqual(cacheStats.misses.mismatch.length,values.mismatch,'cache mismatches');
        assert.strictEqual(cacheStats.misses.empty.length,values.empty,'cache empty');
    }

}
/*
Testing 
- writes containing locals, locals with references, globals
- 

*/
function instrumentBasicTest(){
    var src = `
        var gl = {};
        //arg is an object
        function a(arg){
            gl[4] = [1,3,4]
            gl[5] = {1:gl[4], 2:arg[2]};
            hl = gl;
            return gl[5];
        }
        var ret = a({1:"i",2:"j"});
        ret[1].push(8);
        ret[1].length == 4 ? console.log("correct") : console.log("incorrect");
        hl[5][2] == "j" ? console.log("correct") : console.log("incorrect");
    `
    var evalString = ` anotherGlobal == 3 && window["new_key"] == 2 && window.ret == 2
    `;
    logger(src,"instrumentBasicTest")

    /*Generic verifier*/
    overAllVerifier('instrumentBasicTest', "record", {
        cg:1,
        nonCache:0,
    })
    overAllVerifier('instrumentBasicTest', "replay", {
        cg:1,
        hits:1,
        mismatch:0,
        empty:0
    })
    
}
/*
- Calls a function inside a loop.
- Does some compute intensive local work, which doesn't affect the global state
*/
function smalle2eTest() {
    var src = `
        var globalObject = {}
        var globalFunction = function() {console.log("gl called")};
        function a(arg,i) {
            var j =0;
            //this function does some redundant computation first
            for (var i =0; i<10;i++){
                eval('var evalString = "This code content is executed from an eval function";');
                j = j + 2
            }
            arg[4] = 6;
            arg[5] = [globalFunction];
            if (typeof arg[5] == "object")
                console.log("invalid arg")
            var localFunction = function(a, arg) {
                var i = j*3;
                arg[5] = [globalFunction];
                a[i] = {1:2};
                var l = arg[5][0];
                return i;
            };
            if (i>500){
                localFunction(2,{});
            }
            return {g:globalFunction, l:globalObject};
        }
        console.log("Starting to load the page..");
        for ( var i = 0 ; i < 1000; i++) {
            if (i%100 == 0) {
                r = a({},i);
                r.g();
            }
         }


    `;

    logger(src,"smalle2eTest")
    
    overAllVerifier('smalle2eTest', "record", {
        cg:10,
        nonCache:0,
    })
    overAllVerifier('smalle2eTest', "replay", {
        cg:10,
        hits:10,
        mismatch:0,
        empty:0
    })
}



function largeStatesTest(){
    var src =`
        var i = window;
        i.o = {};
        window.prop = [window.o];
        function a(arg,num){
            var j = arg;
            var k = window;
            if (num>5){
                var l = [arg.prop, arg.prop];
                window.w = l;
            }
            return i;
        };
        for (var iter =0;iter<10;iter++) {
            r = a(window,iter);
            if (iter>5) 
                r.w[0].length == 1 ? console.log("correct") : console.log("incorrect");
        }
    `;

    logger(src, "largeStatesTest");

    overAllVerifier('largeStatesTest', "record", {
        cg:10,
        nonCache:0,
    })
    overAllVerifier('largeStatesTest', "replay", {
        cg:10,
        hits:10,
        mismatch:0,
        empty:0
    })

}

function dynamicLHS(){
    var src =`
    function b() {
        var closure = null;
        function a(){
            console.log(closure);
        }
        function setClosure(arg){
            closure=arg
        }
        return [a,setClosure]
    }
    ret = b();
    `;

    logger(src, "dynamicLHS");
}


function cRpR(){
    var src = `
        function b(a){
            if (a.c == true){
            } else
            localStorage && localStorage.getItem(1)
            window.a = localStorage;
        }
        window.c = {d:[1]};
        window.a = {c:{d:{e:{}}}}
        b(window.a);
    `
    logger(src,"cRpR")
}

function TestPropagation(){
    var src =`
    global = 3; cl1 = {a:{b:{}}};
            global2 = {1:56,e:e}

        var oldLog = console.log;
        console.log = function(){
            oldLog.apply(this,arguments);
        }

        function writesClosures(){
            var local = {a:4},z=setTimeout;
            l={};
            var e = {};
            r.onScriptLoaded = function() {
                        return e._onScriptLoaded()
                    }
            io={};
            cl1.a.b = fn1;
            return fn1;
        }
        writesClosures()
        
        function a(arg1){
            var local1 = {4:5}
            b(3,arg1);
            c(local1, global2);
            global = global2;

            if (typeof abc == "string"){
                console.log(abc)
            }
        }
        function b(arg1,arg2){
            var l = arg2.c
            l[0] = 9;
            global2.e(arg2,cl1.a.b)
            // window.a = function(){}
        }
        function c(arg1,arg2){
            arg1[4]++
            global = global2
            d(arg2)
            return 4;
        }

        function w(ak) {
                var a = new RegExp();
                global = a;
            }

        function d(arg1){
            arg1[9]=0
            return 9;
        }

        function e(arg1,arg2){
            arg1.newkey = "newvalue"
            this.tprop = "tval"
            var l = [1]
            function inner(i){
                ayush = "goel"
                console.log(l,i);
            }
            inner(arg1);
            arg2();

        }
        // e = e.bind(global2)
        var local = {1:2,c:[]}
        // a(local)
        cl1.a.b();
        w(["ayush"])
        // global1234();
    `;
    logger(src,"TestPropagation")
    
}


/*
- send a global argument to the child function
- the child function does no modifications to the global state
*/
function globalArgumentTest() {

    var src = `
        function parent(){
            // newGlobal = 3;
            // newGlobal2 = {1:2};
            var local = {3:4};
            child(local,{});
            console.log(local);
        }
        function child(arg1, arg2){
            arg2 = 4;
            arg1[5] = "new object created inside child";
            newglobal = 4;
        }
        parent();
        window.a = {};
        child(window.a, window.b);
        `
        ; 

    logger(src, "globalArgumentTest");
}

function bindTest(){
    var src = `
        var obj = {1:2, 3:4};
            function outside() {
            innerFunction = function(){
                console.log("the value of this is " + this[2])
            }
            var alias = innerFunction;
            alias.call(window,2);
            alias.apply(window,[]);
        }
        outside();
    `
    logger(src, "bindTest");
}

function bige2eTest(){
    var src = `
        var inputGlobal = 75;
        function changeState(arg1, arg2){
            inputGlobal = "local version";
            if (inputGlobal){
                if (arg1){
                    arg2.b = {3:"created property"};
                }
                // rando(inputGlobal.g, arg2.r)
            } 
            return arg2;
        }

        function badDeveloper(arg) {
            var local = {45:"ayush"}
            arg = local;
            changeState[i]++;
        }
        var bdArg = {45:"string"};
        var semiLocal = {3:4};
        window.changeState = changeState(2, semiLocal);
        if (semiLocal.b){
            console.log("A new property was created inside the function");
        }
        badDeveloper(bdArg[45]);
        console.log("value of bdArg should be a string " + bdArg[45]);
    `;
    logger(src, "bige2eTest");
}

function innerFunctionTest(){
    var src = `
        var local = 5;
        window.a = {4:5};
        window.thisObj = 5;
        function main(arg_main){
            var local = {};
            var localObj = window.a;
            function inner(){
                var a = 5;
                local[3] = 6;
                localObj = 4;
                var read = window.b = {};
                read[4] = 7;
                this.e = this.thisObj + 7;
                return local;
            }

            function containedInnerFunction(arg,arg2,arg3){
                 a = local;
                 var l = arg_main[3];
                arg[2] = a;
                this.f = 4;
                //local++;
                return {1:arg};
            }

            containedInnerFunction({a:3}, window.a);
             inner();
             //check if the changes of inner and containedinner are persistent
             window.f !=4 && console.log("contained inner not evaled");
             (window.a == 4 || window.b[4] != 7 || window.e != 12) && console.log("inner function not eval'ed");

        }
        window.global = main({3:"ayush"});
        // window.global2 = main({});
    `;

    logger(src, "innerFunctionTest");
}

function testReferences(){
    var src = `
        function a(){
            var local = {2:3};
            window.d = function(){};
            window.b = local;
            alert.call(window,"dsds");
            d.prototype.f = (1,2);
        }
        a();
    `;
    logger(src, "testReferences");
}

function windowAPISTest() {
    var src = `
        function fetchLocalStorage() {
            var local = window.localStorage.getItem("ayush");
            return local;
        }

        fetchLocalStorage({});
    `;

    logger(src, "windowAPISTest");
}

function testFunctionStats() {
    var src =`
        // function a(){
        //     d = 4;

        // };
        // for (var i =0;i<100;i++){
        //     a(1,2,3,"string");
        // }
        // for (var i =0;i<100;i++){
        //     a();
        // }
        // for (var i =0;i<100;i++){
        //     a(1,{1:2},45);
        // }
        // for (var i =0;i<100;i++){
        //     a(1,2,3, function(){}, null);
        // }

        function b(){
            if (arguments.length > 0)
                return function f(){};
            (function(){
                window.d = alert;
            })()
            return {1:2}
        }

        function c(){
            if (arguments.length > 0)
                b(3);
            b();
            var t;
            function inner(){
                var d = t + 4;
            }
        }
        b();
        c(function(){});
        c(4,5);
    `

    logger(src, "testFunctionStats");
}



function testThrowError(){
    var src = `
        function a(){
            try{
                window.ab();
            } catch (e){

            }
        }
        function outer(){
            var sm = 3;
            function b(){
                sm++;
            };
            return b;
        }
        outer()();
    `
    logger(src, "testThrowError");
}

function testThisProxy(){
    var src =`
        function a(){
            this.b = 4;
            var l = this.i;
            var n = this;
            this.b.c++;
            // this.e.call(this, this.d);
            someread = document.location.href;
        }
        o ={1:a, e:function(arg){console.log("passed " + arg + " with context " + this); return a = this}}
        o[1]();
    `
    logger(src, "testThisProxy");
}
function testTemp() {
    var src = `
       function a(){
        var {c} = {c:[]};
        window.a = {1:2,3:c.length};
       }
       function b(){
        // window.a[5] = {6:7};
        window.d = window.a;
       }
       function c(){
        // window.a[5] = {6:7};
        window.d = window.a;
       }
       var d = (i) => {
        var j = i + 2;
        a.b.c(i,j);
        return j;
       }
       a();b();c();
    `;
    logger(src, "testTemp");
}

function testInBuiltFn(){

    var src = `
        function a(){
            
        }
    `;
    logger(src, "testInBuiltFn");
}

function testArrayMethods(){
    var src =`
        function mapcb(a){
            return a*2;
        }
        function modifyArray(ar){
            Array.prototype.map.call(ar, mapcb);
        }
        modifyArray([2,3,4,5]);
    `;

    logger(src, "testArrayMethods");
}

function testTryCatch(){
    var src = `
        function a(){
            try{

            } catch (e){
                b = e.message || "param"
                console.log(e.message + "");
            }
        }
    `;
    logger(src, "testTryCatch");
}

function main(){
    if (!program.inst) {
        program.outputHelp();
        return;
    }
    if (program.test) {
        console.log("Only running: " + program.test);
        var tests = program.test.split(',');
        tests.forEach((t)=>{
            eval(t+"()");
        })
        return;
    }
    instrumentBasicTest();
    innerFunctionTest();
    bige2eTest();
    smalle2eTest();
    bindTest();
    globalArgumentTest();
    testTemp();
    testFunctionStats();
    testThisProxy();
    testTemp();
    testArrayMethods();
    testReferences();
    
    console.log(testResults.passed.length + " out of " + testResults.total + " passed");
    console.log(testResults.failed.length + " tests failed: " + JSON.stringify(testResults.failed));
    console.log("FINISHED...")
}

function getGlobal(){
    return this;
}

function discoverTestFunctions(global){
    Object.getOwnPropertyNames(global).forEach((key)=>{
        if (typeof global[key] == "function" )
            console.log(key);
    })

}
// discoverTestFunctions(getGlobal());
main();