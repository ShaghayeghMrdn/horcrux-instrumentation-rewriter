/*
This module compares the total ast time with the total cpu prof time
*/

const fs = require('fs'),
    program = require('commander'),
    nodeMatcher = require('./ast-prof-matcher'),
    {cpuProfileParser} = require("../devtool-cpu-model/analyze_cpu_profile.js"),
    util = require('util');

program
    .option('-a, --ast [ast]','path to the ast file')
    .option('-p, --prof [prof]','path to the cpu profile')
    .parse(process.argv);


var readAndParseFile = function(f){
    var p = JSON.parse(fs.readFileSync(f,"utf-8"));
    return p;
}

var getUserDefinedTime = function(cpu){
    var time = 0;
    var topUDFns = []
    cpu.parsed.children.sort((a,b)=>{return b.self - a.self}).forEach((child)=>{
        if (child.profileNode.url.startsWith("http")){
            // console.log(child.profileNode.callFrame, child.self);
            time += child.self
        } else {
            // console.log(child.profileNode.callFrame)
        }
    })
    return time;
}

var unique = function(arr){
    return [...new Set(arr.map(e=>e.split("_count")[0])) ] 
}

var computeTotalASTTime = function(astTimeArray){
    var fn2time = {};
    Object.keys(astTimeArray).forEach((invoc)=>{
        if (astTimeArray[invoc].length != 2) return;
        var fn = invoc.split("_count")[0];
        if (!(fn in fn2time))
            fn2time[fn]=0;
        fn2time[fn]+= astTimeArray[invoc][1] - astTimeArray[invoc][0];
    });
    return fn2time;
}


var compareASTProfTime = function(ast, prof){
    // var astNodes = Object.keys(ast);
    // var fns = unique(astNodes);
    // var fn2time = computeTotalASTTime(ast);
    var astFn2Prof = nodeMatcher.match(ast,prof);

    var astTime = profTime = 0;
    Object.keys(astFn2Prof).forEach((fn)=>{
        astTime += astFn2Prof[fn].ttime;
    });
    process.stdout.write(util.format(astTime, getUserDefinedTime(prof)));
}

function main(){
    var astTimeArray = readAndParseFile(program.ast);
    var cpuProf = cpuProfileParser(readAndParseFile(program.prof));

    compareASTProfTime(astTimeArray, cpuProf);
}

main();