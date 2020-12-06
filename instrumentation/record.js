const falafel = require('falafel');
const globalWrapper = require('../JSAnalyzer/global-code-wrapper.js');
const rewriter = require("../JSAnalyzer/index_rewriter.js");
const windowRewriter = require("../JSAnalyzer/index_window.js");
var fondue = require("../JSAnalyzer/index.js");
var fondue_plugin = require("../JSAnalyzer/index_plugin.js");
var fondue_replay = require("../JSAnalyzer/index_replay.js");
var {spawnSync} = require('child_process');
var makeId = fondue.makeId;
var properties = require("properties");
var config;

const PATH_TO_PROPERTIES = "../JSAnalyzer/" + "/tracer.ini";
properties.parse(PATH_TO_PROPERTIES, {path: true, sections: true}, function(err, obj){ config = obj ;})
// var fondue = require("fondue");
var fs =require("fs")
var path = require("path")
var program = require('commander');
var vm = require('vm');
var deterministic = require('deterministic');
var UglifyJS = require('uglify-es')
var jsBeauty = require('js-beautify');

spawnSync("ls ../JSAnalyzer",{shell:true});
var OMNISTRINGIFYPATH = "../JSAnalyzer/omni.min.js";
var omniStringify = fs.readFileSync(OMNISTRINGIFYPATH, "utf-8");
var domJson = fs.readFileSync("../JSAnalyzer/domJson.js","utf-8");
var worker = fs.readFileSync("../JSAnalyzer/worker.js","utf-8");
const horcrux_scheduler = fs.readFileSync("../horcrux-scheduler/scheduler.js", "utf-8");
const horcrux_web_worker = fs.readFileSync("../horcrux-scheduler/worker.js", "utf-8");

var hostDir = "../tests/hostSrc/";
var hostUrl = "http://goelayu4929.eecs.umich.edu:99/hostSrc/";

var hostCounter = 0;

program
    .version("0.1.0")
    .option("-i, --input [input]","path to the input file")
    .option("-n, --name [name]", "name of the file being instrumented")
    .option("-t , --type [type]", "[HTML | Javascript (js)]", "html")
    .option("-j, --js-profile [file]","profile containing js runtime information")
    .option("-c, --cg-info [file]", "an array containing root invocations")
    .option("-p, --pattern [pattern]","instrumentation pattern, either cg, record (signature), or rewrite")
    .option("-s, --signature [file]", "final signature containing function dependencies")
    .option("-g, --call-graph [file]", "final call graph file")
    .option("-w, --wrapped-src-path [file]", "File path to save the globally wrapped HTML file")
    .parse(process.argv)

/*
Instrument any scripts tags inside
HTML pages
*/

var instrumentor;
if (program.pattern == "record")
    instrumentor = fondue;
else if (program.pattern == "cg" || program.pattern == "timing")
    instrumentor = fondue_plugin;
else if (program.pattern == "rewrite")
    instrumentor = rewriter;
else instrumentor = fondue_replay;

var staticInfo = instrumentor.staticInfo;
staticInfo.staticUncacheableFunctions = {};


//Create file for communicating information back to the python script
var returnInfoFile = program.input + ".info";
fs.writeFileSync(returnInfoFile,"");

let fala = function () {
    var m = falafel.apply(this, arguments);
    return {
        map: function () { return '' },
        chunks: m.chunks,
        toString: function () { return m.toString() },
    };
};

function instrumentHTML(src, fondueOptions) {

    // test if the file is html or javascript
    // certain javascript files have the header "doc"
    var isHtml, isXML;

    // try {
    //     var validHTML = spawnSync("python html_validator.py " + program.input,{shell:true});
    //     // libxmljs.parseXml(src);
    //     // console.log("FOUND AN XML FILE");
    //     console.log(validHTML);
    //     return src;
    // } catch(e){
    //     //not an xml file so keep the instrumentation going
    // }

    try {
        var script = new vm.Script(src);
        isHtml = false;
    } catch (e) {
        isHtml = true;
    }

    if (IsJsonString(src))
        return src;

    if (!isHtml)
        return instrumentJavaScript(src, fondueOptions);

    //pretty print HTML
    // src = pretty(src);

    //set instrumentor for testing phase which doesn't call the main script
    // if (program.pattern == "record")
    //     instrumentor = fondue;
    // else if (program.pattern == "cg" || program.pattern == "timing")
    //     instrumentor = fondue_plugin;
    // else instrumentor = fondue_replay;
    console.log("Pattern for current instrumentation: " + fondueOptions.pattern);

    console.log("Instrumenting a html file");
    var scriptLocs = [];
    var scriptBeginRegexp = /<\s*script[^>]*>/ig;
    var scriptEndRegexp = /<\s*\/\s*script/i;
    var lastScriptEnd = 0;
    var match, newline = /\n/ig;
    var integrityMatch, integrityLocs = [], newLoc=0;
    var asyncMatch, asyncLocs = [], nLoc = 0;

    //Traverse the matches to eliminate any integrity checks
    while (integrityMatch = scriptBeginRegexp.exec(src)){
        if (integrityMatch[0].indexOf("integrity")>=0){
            integrityLocs.push(integrityMatch);
        }
    }

    // newLoc is used to keep track of the new location after every splice
    integrityLocs.forEach((integrity)=>{
        var _initLen = src.length;
        src = src.slice(0,integrity.index-newLoc) + integrity[0].replace(/integrity=[\"\'][^"^']*[\"\']/,'') +
             src.slice(integrity.index-newLoc + integrity[0].length,src.length);
        var _finalLen = src.length;
        newLoc += _initLen -  _finalLen;
    })

    while (asyncMatch = scriptBeginRegexp.exec(src)){
        if (asyncMatch[0].indexOf("async")>=0){
            asyncLocs.push(asyncMatch);
        }
    }

    //Commenting as simply replacing async with defer gives runtime errors
    // asyncLocs.forEach((asyn)=>{
    //     var _initLen = src.length;
    //     src = src.slice(0,asyn.index-newLoc) + asyn[0].replace(/async/,'defer') +
    //          src.slice(asyn.index-nLoc + asyn[0].length,src.length);
    //     var _finalLen = src.length;
    //     nLoc += _initLen -  _finalLen;
    // })


    while (match = scriptBeginRegexp.exec(src)) {
        var scriptOffset = 0;
        var scriptBegin = match.index + match[0].length;
        if (scriptBegin < lastScriptEnd) {
            continue;
        }

        /*
        The slicing takes care of whether there is. a new line
        immediately after the <Script> tag or not, because
        it will account for the correct offset
        */
        var _prevScript = src.slice(0,scriptBegin+1);
        while(nMatch = newline.exec(_prevScript))
            scriptOffset++;
        var endMatch = scriptEndRegexp.exec(src.slice(scriptBegin));
        if (endMatch) {
            var scriptEnd = scriptBegin + endMatch.index;
            scriptLocs.push({ start: scriptBegin, end: scriptEnd , offset: scriptOffset});
            lastScriptEnd = scriptEnd;
        }
    }
    /***** HORCRUX *****/
    /* First make pass and wrap all IIFE code in anonymous functions
    before instrumentation. Since wrapping code shifts the column indexes.
    The new column indexes are the ones reported by falafel static analyzer
    during each instrumentation. However, the pieces of wrapped code are never
    put together.
    In the rewriting phase, I need to be able to retrieve a function source
    code using the wrapped function locations. So instead of wrapping pieces of
    IIFE one by one, here we wrap IIFEs in one pass and put them together as
    updated src before starting the instrumentation pass (in reverse order)
    where updated (wrapped) script locations are used.
    */
    // iterate over the scripts (forward) and globally wrap each one
    for (let i = 0; i < scriptLocs.length; ++i) {
        const options = mergeInto(fondueOptions, {});
        options.origPath = options.path;
        options.path = options.path + "-script-" + i;
        options.include_prefix = false;
        options.jsInHTML = true;

        let loc = scriptLocs[i];
        const scriptSrc = src.slice(loc.start, loc.end);
        // wrap each IIFE in an anonymous function
        let wrappedSrc = globalWrapper.wrap(scriptSrc, fala);

        // rewrite all global variables to use window.
        wrappedSrc = windowRewriter.instrument(wrappedSrc, options).toString()

        src = src.slice(0, loc.start) + wrappedSrc + src.slice(loc.end);
        // shift the end of this script and the rest of below scripts locations
        const shift = wrappedSrc.length - scriptSrc.length;
        loc.end += shift;
        for (let j = i+1; j < scriptLocs.length; ++j) {
            scriptLocs[j].start += shift;
            scriptLocs[j].end += shift;
        }
        // just to double-check the locations -- remove later
        if (wrappedSrc !== src.slice(loc.start, loc.end)) {
            console.error('---------- BAD NEWS ----------');
        }
    }

    if (program.wrappedSrcPath) {
        console.log(`Wrote to wrappedSrc: ${program.wrappedSrcPath}`);
        fs.writeFileSync(program.wrappedSrcPath, src);
    }
    if (program.pattern == "rewrite") {
        // send in the wrapped HTML source as part of options
        fondueOptions = mergeInto({srcLines: src.split('\n')}, fondueOptions);
    }

    // process the scripts in reverse order
    for (var i = scriptLocs.length - 1; i >= 0; i--) {
        var loc = scriptLocs[i];
        var script = src.slice(loc.start, loc.end);
        // console.log("Script to be instrumented: " + script)

        //use to store the original value of path
        //since its value is modify to unqiue identify every in html script
        var options = mergeInto(fondueOptions, {});
        options.origPath = options.path;
        options.path = options.path + "-script-" + i;
        //Add the script offset to be sent to the instrumentation script
        // options.scriptOffset = loc;
        var prefix = src.slice(0, loc.start).replace(/[^\n]/g, " "); // padding it out so line numbers make sense
        // newlineCount = (prefix.match(/\n/g) || []).length;
        // console.log('# of \\n:', newlineCount);
        if (program.pattern == "timing")
            prefix="";
        // console.log("Instrumenting " + JSON.stringify(loc));
        src = src.slice(0, loc.start) + instrumentJavaScript(prefix + script, options, true) + src.slice(loc.end);
        // console.log("And the final src is :" + src)
    }

    if (!scriptLocs.length)
        var options = mergeInto(fondueOptions, {});
    // remove the doctype if there was one (it gets put back below)
    var doctype = "";
    // var doctypeMatch = /^(<!doctype[^\n]+\n)/i.exec(src);
    var doctypeMatch = /^(<!DOCTYPE[ ]+([^ ][^>]+[^ />]+)[ /]*>)/i.exec(src)
    if (doctypeMatch) {
        doctype = doctypeMatch[1];
        src = src.slice(doctypeMatch[1].length);
    }
    mergeStaticInformation_uncacheable(options);
    if (!hostCounter){
        hostCounter++;
        var deterministicCode = '\n' + deterministic.header + '\n';
        // fs.writeFileSync(hostDir+"/deterministic.js", deterministicCode);
        // fs.writeFileSync(hostDir+"/tracer.js", fondue.instrumentationPrefix(options));
        // fs.writeFileSync(hostDir+"/omni.min.js", omniStringify);
        // fs.writeFileSync(hostDir+"/domJson.js", domJson);
        // fs.writeFileSync(hostDir+"/signatureWorker.js",worker);
        // ret = spawnSync("python ../instrumentation/genInstrumentationFiles.py tracer.js omni.min.js deterministic.js domJson.js signatureWorker.js", {shell:true});
        // console.error(ret.stdout.toString());
        // console.error(ret.stderr.toString());
        // console.log("updated instrumentation files");
    }
    // src = doctype + createScriptTag("omni.min.js") + createScriptTag("deterministic.js")  + createScriptTag("tracer.js") + src;

    /***** HORCRUX *****/
    /* Adding prefixes to to the HTML to do 3 things:
    1. Add the web worker(s) code
    2. Force the determinism on the client side for now (without concolic execution)
    3. Add the Horcrux main scheduler code. */
    if (program.pattern == "rewrite") {
        src = doctype +
            "\n<script id='__horcrux_worker__' type='javascript/worker'>\n" +
            horcrux_web_worker +
            "\n</script>\n" +
            "\n<script>\n" +
            deterministicCode +
            "\n" + horcrux_scheduler +
            "\n</script>\n" + src;
    }
    else if (program.pattern != "timing")
        src = doctype + "\n<script>\n" +  deterministicCode + omniStringify + fondue.instrumentationPrefix(options, program.pattern) + "\n</script>\n" + src;
    // console.log("ANd the ultimately final source being" + src)
    console.log("[rtiDebugInfo]" + staticInfo.rtiDebugInfo.totalNodes.length,
         staticInfo.rtiDebugInfo.matchedNodes.length);
    computeRTITimeMatched();
    return src;
}

function createScriptTag(url){
    var src = "\n<script src =" + hostUrl +  url + "></script>";
    return src;
}

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function stringifyUncacheableFunctions(options){
        //Before returning process the Uncacheable Functions into a stringifiable format
    Object.keys(staticInfo.uncacheableFunctions).forEach((reason)=>{
         staticInfo.staticUncacheableFunctions[reason] = staticInfo.uncacheableFunctions[reason].map((fn)=>{
            var index = makeId("function", options.path, fn);
            return index;
        });
        // options.prefix = options.prefix.replace(new RegExp('{'+reason+'}', 'g'), JSON.stringify(staticUncacheableFunctions));
    });

}

function mergeStaticInformation_uncacheable(options){
    stringifyUncacheableFunctions(options);
    //Fetch the previously obtained static dumps
    var _staticDumpFiles = spawnSync("ls staticDump*", {shell:true});
    var staticDumpFiles = _staticDumpFiles.stdout.toString().trim().split('\n');
    var scriptsStaticInfo = [];
    staticDumpFiles.forEach((dumpFile)=>{
        if (dumpFile != "") {
            var staticUncacheableFunctions = JSON.parse(fs.readFileSync(dumpFile, "utf-8"));
            scriptsStaticInfo.push(staticUncacheableFunctions);
        }
    })

    //Merge with the current static dump
    scriptsStaticInfo.forEach((si)=>{
        Object.keys(si).forEach((reason)=>{
            // console.log("data: " + JSON.stringify(staticInfo.staticUncacheableFunctions), reason)
            staticInfo.staticUncacheableFunctions[reason] =
            staticInfo.staticUncacheableFunctions[reason].concat(si[reason]);
        })
    })

}


function computeRTITimeMatched(){
    var time = {};
    // Object.keys(staticInfo.rtiDebugInfo).forEach((type)=>{
    //     if (type != "totalNodes" && type != "matchedNodes") return;
    //     var _tmpTime = staticInfo.rtiDebugInfo[type].reduce((acc, cur)=>{return acc+cur.self},0);
    //     time[type] = _tmpTime;
    // })
    //Dump this time in a file
    // fs.writeFileSync(returnInfoFile, /*time.totalNodes + " " + time.matchedNodes + " " + */ staticInfo.rtiDebugInfo.ALL + " "+
    //     // + JSON.stringify(staticInfo.rtiDebugInfo.ALLUrls) + " " + JSON.stringify(staticInfo.rtiDebugInfo.matchedUrls));
    //     staticInfo.rtiDebugInfo.totalNodes.length + " " + staticInfo.rtiDebugInfo.matchedNodes.length
    //     + " " + (staticInfo.rtiDebugInfo.totalNodes.time || 0)
    //     + " " + staticInfo.rtiDebugInfo.matchedNodes.reduce((acc,cur)=>{return cur[1] + acc},0));
    fs.writeFileSync(returnInfoFile,staticInfo.rtiDebugInfo.ALL + " " + staticInfo.rtiDebugInfo.totalNodes.length + " " + staticInfo.rtiDebugInfo.matchedNodes.length );
    // fs.writeFileSync(returnInfoFile, JSON.stringify(staticInfo.rtiDebugInfo.ND));
}

function dumpStaticInformation_uncacheable(options){
    stringifyUncacheableFunctions(options);
    var staticDumpFileName = "staticDump" + process.pid;
    fs.writeFileSync(staticDumpFileName, JSON.stringify(staticInfo.staticUncacheableFunctions));
}


function instrumentJavaScript(src, fondueOptions, jsInHTML) {
    console.log("Instrumenting a js file")
    var fondueOptions = mergeInto({include_prefix: false}, fondueOptions);
    fondueOptions.jsInHTML = jsInHTML
    if (IsJsonString(src)) {
        if (jsInHTML)
            return src.replace(/^\s+|\s+$/g, '');
        else return src;
    }

    // if this is an external script source, it has not been globally wrapped
    // and the global variables are not rewritten to use window
    if (!jsInHTML) {
        // wrap each IIFE in an anonymous function
        let wrappedSrc = globalWrapper.wrap(src, fala);
        // rewrite all global variables to use window.
        wrappedSrc = windowRewriter.instrument(wrappedSrc, fondueOptions).toString();
        // update the src
        src = wrappedSrc;
        if (program.wrappedSrcPath) {
            console.log(`Wrote to wrappedSrc: ${program.wrappedSrcPath}`);
            fs.writeFileSync(program.wrappedSrcPath, src);
        }
        if (program.pattern == "rewrite") {
            fondueOptions = mergeInto({srcLines: src.split('\n')}, fondueOptions);
        }
    }

    src = instrumentor.instrument(src, fondueOptions).toString();
    if (program.type == "js") {
        console.log("[rtiDebugInfo]" + staticInfo.rtiDebugInfo.totalNodes.length,
         staticInfo.rtiDebugInfo.matchedNodes.length);
        dumpStaticInformation_uncacheable(fondueOptions);
        computeRTITimeMatched();
    }
    return src;
}

function mergeInto(options, defaultOptions) {
    for (var key in options) {
        if (options[key] !== undefined) {
            defaultOptions[key] = options[key];
        }
    }
    return defaultOptions;
}

var unique = function(arr){
    return [...new Set(arr) ];
}

var main = function(){
    //Required for the fondue library, to determine how to instrument
    // create obfuscate path name for readability purposes
    var url = program.name.split(';;;')[0];
    var origPath = program.name.split(';;;;')[1];
    origPath = origPath == "/" ? url + origPath : origPath;
    var path = origPath.length>50?origPath.substring(origPath.length-50,origPath.length) : origPath;
    var fondueOptions = mergeInto({}, {useProxy: true, caching: false,  include_prefix: false, path: path, origPath: origPath,
        e2eTesting: false, pageLoaded: config[program.pattern].pageLoaded, invocation_limit:config[program.pattern].invocation_limit,
         pattern:program.pattern, proxyName:config[program.pattern].proxyName
     });
    console.log("Options are " + JSON.stringify(fondueOptions))

    if (program.jsProfile) {
        try {
            var rti = JSON.parse(fs.readFileSync(program.jsProfile, "utf-8"));
            fondueOptions = mergeInto(fondueOptions, {rti: rti})
            console.log("rti time:" + rti.reduce((acc, cur)=>{return acc+cur.self},0))
            staticInfo.rtiDebugInfo.ALL = rti.length;
        } catch (err){
            console.error("Error while reading the JS Profile " + err);
        }
    }
    if (program.cgInfo){
        try{
            var _cg = JSON.parse(fs.readFileSync(program.cgInfo),"utf-8");
            // var cg = _cg.map(e=>e[0]);
            var cg = _cg;
            // var cgTime = _cg.map(e=>e[2]);
            // console.log(cg);
            fondueOptions = mergeInto({cg: cg}, fondueOptions);
            staticInfo.rtiDebugInfo.ALL = cg.length;
            // console.log("cg nodes:" + cg);
        } catch (err){
            console.error("Error while reading the call graph Profile " + err);
            fondueOptions = mergeInto(fondueOptions, {cg: [], cgTime:[]});
            return;
        }
    }
    if (program.callGraph && program.signature) {
        try {
            let callGraph = JSON.parse(fs.readFileSync(program.callGraph), "utf-8");
            let sig = JSON.parse(fs.readFileSync(program.signature), "utf-8");
            fondueOptions = mergeInto({signature: sig, callGraph: callGraph}, fondueOptions);
        } catch (err) {
            console.error("Error while parsing either callGraph or signature file", err);
            // fondueOptions = mergeInto(fondueOptions, {signature: {}});
            return;
        }
    }
    if (program.pattern == "rewrite") {
        // check if all the needed files are given
        if (!fondueOptions.cg ||
            !fondueOptions.signature ||
            !fondueOptions.callGraph) {
            console.error("Error while rewriting: " +
                        "one or more of roots(cg), callGraph, or signature" +
                        "files are not provided");
            return;
        }
        if (!program.wrappedSrcPath) {
            console.error("Error: rewriter expected --wrappedSrcPath (-w)");
        }
    }
    src = fs.readFileSync(program.input,"utf-8")

    // filename = path.basename(program.input)

    if (program.type == "js"){
        // Some js files are utf-16 encoded, therefore src might be an invalid file
        try {
            new vm.Script(src);
        } catch (e) {
            var _ucs2_ = fs.readFileSync(program.input,"ucs2")
            /*If still invalid just return the actual source*/
            try {
                new vm.Script(_ucs2_);
                src = _ucs2_;
            } catch (e){

            }

        }
        src = instrumentJavaScript(src, fondueOptions, false)
        // src = src
    } else {
        src = instrumentHTML(src, fondueOptions)
        // src = src
    }

    fs.writeFileSync(program.input, src)
}

if (program.input) main();

module.exports = {
    instrumentJavaScript: instrumentJavaScript,
    instrumentHTML: instrumentHTML
}

