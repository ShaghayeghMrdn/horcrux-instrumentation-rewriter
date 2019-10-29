
/*
This module takes in as input the runtime invocation data and the processed runtime information 
data as produced from the Chrome js profiler
It outputs the time spent in each of the categories on invocation


*/

var program = require("commander");
var fs = require('fs');
var util = require('util');
var {cpuProfileParser} = require("../devtool-cpu-model/analyze_cpu_profile.js");

var INSTTHRESHOLD = 5;

program
    .option("-c, --callGraph [callGraph]", "path to the callGraph data file")
    .option("-l, --leafNodes [leafNodes]", "path to file containing leaf nodes")
    .option("-r, --rti [rti]" , "path to the raw captured rti file")
    .option("-o, --output [output]", "path to the output file")
    .parse(process.argv);

// console.log(process.argv);

var getUniqueFunctions = function(invocationObj){
    var uniqueFunctionsPerCategory = {};
    Object.keys(invocationObj).forEach((category)=>{
        if (category == "Function") {
            uniqueFunctionsPerCategory.Function = getUniqueFunctions(invocationObj.Function);
            return;
        }
        var fnPerCategory = invocationObj[category];
        if (!uniqueFunctionsPerCategory[category])
            uniqueFunctionsPerCategory[category] = [];
        fnPerCategory.forEach((invocation)=>{
            if ((ind=invocation.indexOf("_count"))>=0) {
                var functionID = invocation.substr(0,ind);
                if (uniqueFunctionsPerCategory[category].map(el=>JSON.stringify(el)).indexOf(JSON.stringify({f:functionID, time:0})) < 0)
                    uniqueFunctionsPerCategory[category].push({f:functionID, time:0});
            }
        })
    })
    return uniqueFunctionsPerCategory;
}

var getPathFromID = function(functionID){
    var location;
    var splitObj = functionID.split('-');
    var objLen = splitObj.length;

    if (objLen  == 6 )
        return splitObj[0];
    else if (splitObj[objLen - 7] == "script"){
        location = splitObj.slice(0,objLen-7).join("-")
    } else{
        location = splitObj.slice(0,objLen-5).join("-")
    }
    
    return location;

}

var getNodeLocationFromID = function(functionID){
    var locObj = {s_ln:0, s_cn:0, e_ln:0, e_cn:0};
    var splitObj = functionID.split('-');
    var objLen = splitObj.length;
    locObj = {
        s_ln: splitObj[objLen-4],
        s_cn: splitObj[objLen-3],
        e_ln: splitObj[objLen-2],
        e_cn: splitObj[objLen-1]
    }

    return locObj;

}

var getCorrespondingInvocationFromId = function(id){
    var nnodes = cpu.raw._idToNode.size;
    var matchedNodes =[];
    for (var i=1;i<=nnodes;i++){
        var node = cpu.raw._idToNode.get(i);
        if (JSON.stringify(node.callFrame)== JSON.stringify(cpu.raw._idToNode.get(id).callFrame))
            matchedNodes.push(cpu.raw._idToNode.get(i));
    }
    return matchedNodes;
}

var getTimeFromId = function( id){
    var BUind = cpu.parsed.children.map((r)=>{return r.profileNode.id}).indexOf(id);
    if (BUind>=0) {
        return cpu.parsed.children[BUind].self;
    }
    else { 
        var ttime = 0;
        return ttime;
        const reducer = (accumulator, currentValue) => accumulator + currentValue.self;
        var matchingNodes = getCorrespondingInvocationFromId(id);
        ttime = matchingNodes.length ? matchingNodes.reduce(reducer,0) + cpu.raw._idToNode.get(id).self 
        : cpu.raw._idToNode.get(id).self ;
        return ttime;
    }

}

var rtisMatched = [];
var _matchFunctionWithRTI = function(astNode){
    //Simply iterate the call graph;
    var rti = cpu.raw, myRti = [];
    var astLoc = getNodeLocationFromID(astNode.f);
    var astPath = getPathFromID(astNode.f);
    var foundMatch = false;
    cpu.parsed.children.forEach((child)=>{
        if (child.profileNode.url.endsWith(astPath))
            myRti.push(child);
    })
    // for (var iter = 1;iter <= rti._idToNode.size;iter++){
    //     var rtiNode = rti._idToNode.get(iter);
    //     if (rtiNode.url.endsWith(astPath))
    //         myRti.push(rtiNode);
    // }
    for (rtiNode of myRti) {
        var rtiLoc = {ln:1+rtiNode.profileNode.callFrame.lineNumber, cn:rtiNode.profileNode.callFrame.columnNumber};
        if (rtiNode.profileNode.url.endsWith(astPath)){
            if (astLoc.s_ln == rtiLoc.ln) {
                // Now lets try and match against different column numbers
                if (astLoc.e_cn == rtiLoc.cn) {
                    astNode.time += rtiNode.self
                    astNode.rti = rtiNode
                    foundMatch = rtiNode;
                    break;
                } else if (astLoc.s_cn == rtiLoc.cn) {
                    astNode.time += rtiNode.self
                    astNode.rti = rtiNode
                    foundMatch = rtiNode;
                    break;
                } else if ( (Number.parseInt(astLoc.s_cn)+"function".length) == rtiLoc.cn) {
                    astNode.time += rtiNode.self
                    astNode.rti = rtiNode
                    foundMatch = rtiNode;
                    break;
                }
            }
        }
    };
    // if (!foundMatch)
    //     console.error("Match not found for" + astNode.f)
    if (foundMatch){
        rtisMatched.push(foundMatch);
        return true;
    }
    return false;
}

var matchFunctionWithRTI = function(astNodeArray){
    var matched = [];
    astNodeArray.forEach((func,i)=>{
            if (_matchFunctionWithRTI(func))
                matched.push(func);
        });
    return matched;
}

var gTime = 0
var reduce = function(arr){
    var ttime = 0;
    arr.forEach((el)=>{ttime+=el.time})
    gTime+=ttime;
    return ttime;
}

var processUnmatchedRTIs = function(){
    var unmatchedRTIs = [];
    cpu.parsed.children.filter(e=>e.profileNode.callFrame.url.startsWith("http")).forEach((child)=>{
        if (rtisMatched.indexOf(child)<0)
            unmatchedRTIs.push(child);
    })    
    console.log("Total unmatched rtis: " + unmatchedRTIs.length + " compared to " + cpu.parsed.children.filter(e=>e.profileNode.callFrame.url.startsWith("http")).length);
    console.log(unmatchedRTIs.sort((a,b)=>{return b.self - a.self}).slice(0,5).map((e)=>{return [e.profileNode.callFrame, e.self]}));
}

var cpu;


function main(){
    var invocationObj = JSON.parse(fs.readFileSync(program.callGraph, "utf-8")).value;
    var functionPerCategoryObj = getUniqueFunctions(invocationObj);
    var cpuRawInput = JSON.parse(fs.readFileSync(program.rti, "utf-8"));
    var upperBound = {};
    cpu = cpuProfileParser(cpuRawInput);

    Object.keys(functionPerCategoryObj).forEach((category)=>{
        var fnPerCategory = functionPerCategoryObj[category];
        if (category == "Function"){
            Object.keys(functionPerCategoryObj[category]).forEach((category2)=>{
                var fnPerCategory = functionPerCategoryObj[category][category2];
                // console.log(category2, fnPerCategory.length)
                matchFunctionWithRTI(fnPerCategory);
            });
        } else
            matchFunctionWithRTI(fnPerCategory);
        
    });

    Object.keys(functionPerCategoryObj).forEach((category)=>{
        var fnPerCategory = functionPerCategoryObj[category];
        if (category == "Function"){
            upperBound[category] = {}
            Object.keys(functionPerCategoryObj[category]).forEach((category2)=>{
                var fnPerCategory = functionPerCategoryObj[category][category2];
                upperBound[category][category2] = reduce(fnPerCategory);
            });
        } else
            upperBound[category]= reduce(fnPerCategory);
        
    });
    upperBound.TOTAL = gTime;
    console.log("computed upperBound");
    fs.writeFileSync(program.output, JSON.stringify(upperBound));

}

var invocationsPerFunction = function(cg){
    var function2invocation = {};
    cg.forEach((nodeId)=>{
        fn = nodeId.split("_count")[0];
        if (!function2invocation[fn])
            function2invocation[fn]=0
        function2invocation[fn]++;
    })
    return function2invocation;
}

var timePerInvocation = function(invocationsPerFunction, nodeTime){
    var perInvocationTime = {};
    nodeTime.forEach((fn)=>{
        perInvocationTime[fn.f] = fn.time/invocationsPerFunction[fn.f];
    })

    return perInvocationTime;
}

var processLeafNodes = function(cg){
    var leafGraph = [];
    var nonLeafs = [];
    if (!cg) return leafGraph;
    Object.keys(cg).forEach((nodeId)=>{
        var node = cg[nodeId];
        if (nonLeafs.indexOf(nodeId.split("_count")[0])>=0) return;
        if (!node.length)
            leafGraph.push(nodeId);
        else nonLeafs.push(nodeId.split("_count")[0]);
    })

    return leafGraph;
}

var getLeafNodesFromProfiler = function(){
    var leafNodes = [];
    var totalNodes = cpu.parsed.children;
    var ibf = ["(program)","(idle)","(garbage collector)"]
    totalNodes.forEach((node)=>{
        if ( (node.self >= node.total) && ibf.indexOf(node.functionName)<0
                && node.children.length == 0 && 
                node.profileNode.callFrame.url.startsWith("http")){
            /*Candidate for potential leaf node*/
            // console.log(node.functionName, node.depth)
            leafNodes.push(node);
        }
    })
    return leafNodes;
}

var handleLeafNodes = function(ln, cpu){
    var _profileRTIs = cpu.parsed.children.filter(e=>e.profileNode.callFrame.url.indexOf("http")>=0);
    var  profileRTIs = _profileRTIs.map(e=>e.profileNode);
    var srcRtis = ln.map((e)=>{return {f: e.f, r: e.r, p:e.p, childLen: e.children, depth: e.depth} });
    var matches = {};
    srcRtis.forEach((rtiCF,ind)=>{
        var _key = rtiCF.r.functionName + ";;"  + rtiCF.f;
        matches[_key] = [];
        var roughMatches = [];
        for (_r in profileRTIs){
            //Matching critera relies on bunch of heuristics
            /*if (profileRTIs[_r].callFrame.functionName == rtiCF.r.functionName && profileRTIs[_r].callFrame.url == rtiCF.r.url 
                && profileRTIs[_r].parent.functionName == rtiCF.p.functionName && profileRTIs[_r].parent.url == rtiCF.p.url && 
                profileRTIs[_r].children.length == rtiCF.childLen && profileRTIs[_r].depth == rtiCF.depth){
            } */
            if (profileRTIs[_r].callFrame.functionName == rtiCF.r.functionName && profileRTIs[_r].callFrame.url == rtiCF.r.url ) /*&& 
                roughMatches.map((e)=>{return JSON.stringify(e.callFrame)}).indexOf(JSON.stringify(profileRTIs[_r].callFrame))<0)*/
                roughMatches.push(profileRTIs[_r]);

             
                // (profileRTIs[_r].children.map(e=>e.functionName).filter(e=>e.indexOf("__tracer")>=0).length  || !profileRTIs[_r].children.length) ){
                // matches[_key].push(profileRTIs[_r]);
                // console.log(" original rti: " + JSON.stringify(rtiCF.r) + " matches with " + JSON.stringify(profileRTIs[_r].callFrame) + " with parent: " + JSON.stringify(_profileRTIs[_r].profileNode.parent.callFrame));
            // }
        }
        for (_profileRTIs of roughMatches){
            if (_profileRTIs.children.map(e=>e.functionName).filter(e=>e.indexOf("__tracer")>=0).length){
                matches[_key].push(_profileRTIs);
                break;
            }
        }

        if (!matches[_key].length){
            for (_profileRTIs of roughMatches){
                if (!_profileRTIs.children.length){
                    matches[_key].push(_profileRTIs);
                    break;
                }
            }
        }

    });

    console.error(Object.entries(matches).map((e)=>{return [e[0], e[1].length] }));
    process.stdout.write(util.format(Object.values(matches).map(e=>e.length).map(e=>e>1?1:e).reduce((acc, cur)=>{return acc + cur},0)));
}

function fn2time(){
    var cpuRawInput = JSON.parse(fs.readFileSync(program.rti, "utf-8"));
    cpu = cpuProfileParser(cpuRawInput);

    if (program.callGraph && program.leafNodes){
        throw new Error("Can't pass both callgraph and leaf nodes file");
    }
    if (program.callGraph) {
        var cg = JSON.parse(fs.readFileSync(program.callGraph, "utf-8")).value;
        if (!cg) return;
    } else if (program.leafNodes){
        var ln = JSON.parse(fs.readFileSync(program.leafNodes, "utf-8"));
        handleLeafNodes(ln, cpu);
        return;
    }

    var cpuTimeWoProgram = cpu.raw.total - (cpu.raw.idleNode.self + cpu.raw.programNode.self);
    var cpuTime = cpu.raw.total - cpu.raw.idleNode.self;
    // process.stdout.write(util.format(cpuTimeWoProgram + " ")); return;
    leafNodes = processLeafNodes(cg);
    cg = Object.keys(cg);
    var function2invocation = invocationsPerFunction(cg);
    var uniqCg = [...new Set(leafNodes.map(e=>e.split("_count")[0]))];
    // console.log(uniqCg.length)
    var nodeTimeArr = uniqCg.map((n)=>{return {f:n, time:0} });
    var matchedNodeTime = matchFunctionWithRTI(nodeTimeArr);
    // processUnmatchedRTIs();
    var perInvocationTime = timePerInvocation(function2invocation, matchedNodeTime);
    // console.log(cpu.parsed.children.sort((a,b)=>{return b.self - a.self}).slice(0,10).map((e)=>{return {f:e.profileNode.callFrame, t:e.self}}))
    // process.stdout.write(util.format(matchedNodeTime.sort((a,b)=>{return b.time - a.time})[0]))
    // // console.log(cg.length,nodeTimeArr.length, matchedNodeTime.length);
    var finalNodes = Object.entries(perInvocationTime).sort((a,b)=>{return b[1] - a[1]}).slice(0,10).map(e=>e[0]);
    var rtiInfo = finalNodes.map((e)=>{var _r = matchedNodeTime.map(e=>e.f).indexOf(e); return {f:e, r:matchedNodeTime[_r].rti.profileNode.callFrame, 
        t:matchedNodeTime[_r].rti.total, s: matchedNodeTime[_r].rti.self, 
        p: matchedNodeTime[_r].rti.profileNode.parent.callFrame,
        children: matchedNodeTime[_r].rti.profileNode.children.length, depth: matchedNodeTime[_r].rti.profileNode.depth, invocations: function2invocation[e] }});
    // process.stdout.write(util.format(rtiInfo));
    // process.stdout.write(util.format(rtiInfo));
    // process.stdout.write(util.format(finalNodes.length, finalNodes.reduce((acc,cur)=>{return acc + function2invocation[cur]},0) + " "));
    // process.stdout.write(util.format(Object.entries(perInvocationTime).sort((a,b)=>{return b[1] - a[1]})[0]));
    fs.writeFileSync(program.output, JSON.stringify(rtiInfo))
    // console.log(cpuTime, cpuTimeWoProgram, cpu.parsed.children.filter)
    // process.stdout.write(util.format(cpuTime, cpuTimeWoProgram, cpu.parsed.children.filter(e=>e.profileNode.callFrame.url.startsWith("http")).reduce((acc,cur)=>{return acc + cur.self},0))) ;
    // var expectedUserTime = cpu.parsed.children.filter(e=>e.profileNode.callFrame.url.startsWith("http")).reduce((acc,cur)=>{return acc + cur.self},0);
    // var calculatedUserTime = reduce(matchedNodeTime);
    // process.stdout.write(util.format(Object.keys(cg).length)) ;
    console.log("Done processing " + program.callgraph)
}

// fn2time();
var cpuRawInput = JSON.parse(fs.readFileSync(program.rti, "utf-8"));
cpu = cpuProfileParser(cpuRawInput);
var cpuTimeWoProgram = cpu.raw.total - (cpu.raw.idleNode.self + cpu.raw.programNode.self);
var cpuTime = cpu.raw.total - cpu.raw.idleNode.self;
var leaf = getLeafNodesFromProfiler();
var leafTime, _leafTime = 0;
leaf.forEach((lNode)=>{
    _leafTime+=lNode.self;
})

process.stdout.write(util.format(_leafTime, leaf.length));
// console.log(cpuTime, cpuTimeWoProgram);
program.output && fs.writeFileSync(program.output, JSON.stringify(cpu.parsed.children.sort((a,b)=>{return b.self - a.self}).slice(0,10).map((e)=>{return {f:e.profileNode.callFrame.functionName, t:e.self}})));
// JSON.stringify(cpu.parsed.children.sort((a,b)=>{return b.self - a.self}).slice(0,10).map((e)=>{return {f:e.profileNode.callFrame.functionName, t:e.self}}))











// main();