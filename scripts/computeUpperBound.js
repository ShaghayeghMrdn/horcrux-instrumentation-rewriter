
/*
This module takes in as input the runtime invocation data and the processed runtime information 
data as produced from the Chrome js profiler
It outputs the time spent in each of the categories on invocation


*/

var program = require("commander");
var fs = require('fs');
var {cpuProfileParser} = require("../devtool-cpu-model/analyze_cpu_profile.js");

program
    .option("-in, --invocation [invocation]", "path to the invocation data file")
    .option("-r, --rti [rti]" , "path to the raw captured rti file")
    .option("-o, --output [output]", "path to the output file")
    .parse(process.argv);

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
        if (node.callUID == cpu.raw._idToNode.get(id).callUID)
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
        const reducer = (accumulator, currentValue) => accumulator + currentValue.self;
        var matchingNodes = getCorrespondingInvocationFromId(id);
        ttime = matchingNodes.length ? matchingNodes.reduce(reducer,0) + cpu.raw._idToNode.get(id).self 
        : cpu.raw._idToNode.get(id).self ;
        return ttime;
    }

}


var _matchFunctionWithRTI = function(astNode){
    //Simply iterate the call graph;
    var rti = cpu.raw, myRti = [];
    var astLoc = getNodeLocationFromID(astNode.f);
    var astPath = getPathFromID(astNode.f);
    var foundMatch = false;
    for (var iter = 1;iter <= rti._idToNode.size;iter++){
        var rtiNode = rti._idToNode.get(iter);
        if (rtiNode.url.endsWith(astPath))
            myRti.push(rtiNode);
    }
    myRti.forEach((rtiNode)=>{
        // rtiNode = rti._idToNode.get(iter);
        var rtiLoc = {ln:1+rtiNode.callFrame.lineNumber, cn:rtiNode.callFrame.columnNumber};
        if (rtiNode.url.endsWith(astPath)){
            if (astLoc.s_ln == rtiLoc.ln) {
                // Now lets try and match against different column numbers
                if (astLoc.e_cn == rtiLoc.cn) {
                    astNode.time = getTimeFromId(rtiNode.id);
                    foundMatch = true;
                    return true;
                } else if (astLoc.s_cn == rtiLoc.cn) {
                    astNode.time = getTimeFromId(rtiNode.id);
                    foundMatch = true;
                    return true;
                } else if ( (Number.parseInt(astLoc.s_cn)+"function".length) == rtiLoc.cn) {
                    astNode.time = getTimeFromId(rtiNode.id);
                    foundMatch = true;
                    return true;
                }
            }
        }
    });
    if (!foundMatch)
        console.error("Match not found for" + astNode.f)
    return false;
}

var matchFunctionWithRTI = function(astNodeArray){
    astNodeArray.forEach((func,i)=>{
            _matchFunctionWithRTI(func);
        });
}

var gTime = 0
var reduce = function(arr){
    var ttime = 0;
    arr.forEach((el)=>{ttime+=el.time})
    gTime+=ttime;
    return ttime;
}

var cpu;


function main(){
    var invocationObj = JSON.parse(fs.readFileSync(program.invocation, "utf-8")).value;
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



main();