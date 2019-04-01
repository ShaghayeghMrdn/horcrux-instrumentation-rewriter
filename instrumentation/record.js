

var fondue = require("../JSAnalyzer/index.js");
var staticInfo = fondue.staticInfo;
staticInfo.staticUncacheableFunctions = {};
var {spawnSync} = require('child_process');
var makeId = fondue.makeId;
// var fondue = require("fondue");
var fs =require("fs")
var path = require("path")
var program = require('commander');
var vm = require('vm');
var libxmljs = require("libxmljs");
var deterministic = require('deterministic');
var UglifyJS = require('uglify-es')

program
    .version("0.1.0")
    .option("-i, --input [input]","path to the input file")
    .option("-n, --name [name]", "name of the file being instrumented")
    .option("-t , --type [type]", "[HTML | Javascript (js)]", "html")
    .option("-j, --js-profile [file]","profile containing js runtime information")
    .parse(process.argv)

/* 
Instrument any scripts tags inside 
HTML pages
*/

//Create file for communicating information back to the python script
var returnInfoFile = program.input + ".info";
fs.writeFileSync(returnInfoFile,"");

function instrumentHTML(src, fondueOptions) {

    // test if the file is html or javascript
    // certain javascript files have the header "doc"
    var isHtml, isXML;

    try {
        libxmljs.parseXml(src);
        console.log("FOUND AN XML FILE");
        // return src;
    } catch(e){
        //not an xml file so keep the instrumentation going
    }

    try {
        var script = new vm.Script(src);
        isHtml = false;
    } catch (e) {
        isHtml = true;
    }

    if (!isHtml)
        return instrumentJavaScript(src, fondueOptions);


    console.log("Instrumenting a html file");
    var scriptLocs = [];
    var scriptBeginRegexp = /<\s*script[^>]*>/ig;
    var scriptEndRegexp = /<\s*\/\s*script/i;
    var lastScriptEnd = 0;
    var match, newline = /\n/ig;
    var integrityMatch;
    //Traverse the matches to eliminate any integrity checks
    while (integrityMatch = scriptBeginRegexp.exec(src)){
        if (integrityMatch[0].indexOf("integrity")>=0){
            src = src.slice(0,integrityMatch.index) + integrityMatch[0].replace(/integrity=[\"\'][^"^']*[\"\']/,'') +
             src.slice(integrityMatch.index + integrityMatch[0].length,src.length);
        }
    }

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
    // console.log("The location of scripts in html: " + JSON.stringify(scriptLocs));
    // process the scripts in reverse order
    for (var i = scriptLocs.length - 1; i >= 0; i--) {
        var loc = scriptLocs[i];
        var script = src.slice(loc.start, loc.end);
        // console.log("Script to be instrumented: " + script)
        var options = mergeInto(fondueOptions, {});
        //use to store the original value of path
        //since its value is modify to unqiue identify every in html script
        options.origPath = options.path;
        options.path = options.path + "-script-" + i;
        //Add the script offset to be sent to the instrumentation script
        // options.scriptOffset = loc;
        var prefix = src.slice(0, loc.start).replace(/[^\n]/g, " "); // padding it out so line numbers make sense
        // console.log("Instrumenting " + JSON.stringify(loc));
        src = src.slice(0, loc.start) + instrumentJavaScript(prefix + script, options, true) + src.slice(loc.end);
        // console.log("And the final src is :" + src)
    }
    // remove the doctype if there was one (it gets put back below)
    var doctype = "";
    // var doctypeMatch = /^(<!doctype[^\n]+\n)/i.exec(src);
    var doctypeMatch = /^(<!DOCTYPE[ ]+([^ ][^>]+[^ />]+)[ /]*>)/i.exec(src)
    if (doctypeMatch) {
        doctype = doctypeMatch[1];
        src = src.slice(doctypeMatch[1].length);
    }
    mergeStaticInformation_uncacheable(options);
    var deterministicCode = '\n' + deterministic.header + '\n';
    src = doctype + "\n<script>\n" + deterministicCode + fondue.instrumentationPrefix(options) + "\n</script>\n" + src;
    // console.log("ANd the ultimately final source being" + src)
    console.log("[rtiDebugInfo]" + staticInfo.rtiDebugInfo.totalNodes.length,
         staticInfo.rtiDebugInfo.matchedNodes.length);
    computeRTITimeMatched();
    return src;
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
    Object.keys(staticInfo.rtiDebugInfo).forEach((type)=>{
        if (type != "totalNodes" && type != "matchedNodes") return;
        var _tmpTime = staticInfo.rtiDebugInfo[type].reduce((acc, cur)=>{return acc+cur.self},0);
        time[type] = _tmpTime;
    })
    //Dump this time in a file
    fs.writeFileSync(returnInfoFile, time.totalNodes + " " + time.matchedNodes + " " + staticInfo.rtiDebugInfo.ALL + " "+
        // + JSON.stringify(staticInfo.rtiDebugInfo.ALLUrls) + " " + JSON.stringify(staticInfo.rtiDebugInfo.matchedUrls));
        staticInfo.rtiDebugInfo.totalNodes.length + " " + staticInfo.rtiDebugInfo.matchedNodes.length);
}

function dumpStaticInformation_uncacheable(options){
    stringifyUncacheableFunctions(options);
    var staticDumpFileName = "staticDump" + process.pid;
    fs.writeFileSync(staticDumpFileName, JSON.stringify(staticInfo.staticUncacheableFunctions));
}


function instrumentJavaScript(src, fondueOptions, jsInHTML) {
    console.log("Instrumenting a js file")
    var fondueOptions = mergeInto({include_prefix: false}, fondueOptions);
    // src = src.replace(/^\s+|\s+$/g, '');
    if (jsInHTML){
        // console.log("Instrumenting a snippet of js: ");
    }
    src = fondue.instrument(src, fondueOptions).toString();
    if (program.type == "js") {
        console.log("[rtiDebugInfo]" + staticInfo.rtiDebugInfo.totalNodes.length,
         staticInfo.rtiDebugInfo.matchedNodes.length);
        dumpStaticInformation_uncacheable(fondueOptions);
        computeRTITimeMatched();
    }
    src = src.replace(/^\s+|\s+$/g, '');
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

var main = function(){
    //Required for the fondue library, to determine how to instrument
    // create obfuscate path name for readability purposes
    var url = program.name.split(';;;')[0];
    var origPath = program.name.split(';;;;')[1];
    origPath = origPath == "/" ? url + origPath : origPath;
    var path = origPath.length>50?origPath.substring(origPath.length-50,origPath.length) : origPath;
    var fondueOptions = mergeInto({}, {useProxy: true, caching: false,  include_prefix: false, path: path, origPath: origPath, e2eTesting: false });

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
    src = fs.readFileSync(program.input,"utf-8")

    // filename = path.basename(program.input)

    if (program.type == "js"){
        // fondueOptions = mergeInto(fondueOptions, {origPath: fondueOptions.path})
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

