/*
* This module takes in input the cpu profile and runs
* analytical operations on it
* Note that it takes in the raw JS Profile
Usage: node cpuProfile.js <path to the js profile>
*/
var program = require('commander');
var fs = require('fs');
var {cpuProfileParser} = require("../devtool-cpu-model/analyze_cpu_profile.js");

program
    .version("0.1.0")
    .option("-i, --input [input]","path to the input js Profile")
    .option('-o, --output [output]', 'path to the output file')
    .parse(process.argv)


var cpuRawInput = JSON.parse(fs.readFileSync(program.input, "utf-8"));
var cpu = cpuProfileParser(cpuRawInput);
var cpuTime = cpu.raw.total - (cpu.raw.idleNode.self + cpu.raw.programNode.self);


var sumTotalTime = function(cpu, overall) {
    var cpuTime = 0, cpuTime = 0;
    var ignoreRTI = ["idle", "garbage collector"];
    if (!overall)
        ignoreRTI.push("program");
    cpu.forEach((node)=>{
        if (ignoreRTI.filter(fn => node.functionName.indexOf(fn)>=0).length > 0)
            return;
        cpuTime += node.self
    })
    return cpuTime;
}

function topKFnFromRTI(rti, k){
    var ignoreRTI = ["program", "idle", "garbage collector"]
    var sortedRTI = rti.sort((a,b)=>{return b.self - a.self});
    var relevantRTI = [], percent =0, rtiLength = sortedRTI.length, rtiCounter =0;
    for (var rtiIter = 0; rtiIter < rtiLength && percent <= k ; rtiIter++) {
        var curFn = sortedRTI[rtiIter]
        if (ignoreRTI.filter(fn => curFn.functionName.indexOf(fn)>=0).length > 0)
            continue;
        relevantRTI.push(curFn);
        rtiCounter++;
        percent = (rtiCounter/rtiLength)*100;
    }
    // console.log(rtiCounter +  "of " + rtiLength + "gives us " + k + " percent");
    return relevantRTI;
}  

function recurseSubtree(allNodes, rootNode){
    var nodesInSubtree = [];

    function updateSubTree(child){
        nodesInSubtree.push(child);
    }

    function recurse(root){
        if (root.children.length) {
            root.children.forEach((child)=>{
                var childNodeIndex = allNodes.map((rtiNode)=>{return rtiNode.callUID}).indexOf(child)
                var childNode = allNodes[childNodeIndex];
                recurse(childNode);
                updateSubTree(childNode);
            });
        }
    }

    recurse(rootNode);
    return nodesInSubtree;
}


var getSubTree = function(rootNode){
    var listOfIds = [];

    function update(id){
        listOfIds.push(id);
    }

    function recurseChildren(root){
        root.children.forEach((child)=>{
            if (listOfIds.indexOf(child.id)>=0) return;
            update(child.id);
            recurseChildren(child);
        });
    }

    recurseChildren(rootNode);
    return listOfIds;
}
/*
Returns list of node ids accounting for
k% of total runtime
*/
function topKRti(rti, k){
    var rti = rti.children;
    var listOfIds = [];
    var _sortedRTI = rti.filter((f)=>{return f.profileNode.depth!=0});
    var sortedRTI = _sortedRTI.sort((a,b)=>{return b.self - a.self});
    var threshhold = k*cpuTime/100, curTime = 0;
    for (var rtiIter = 0; rtiIter < rti.length && curTime <= threshhold; rtiIter++){
        var curFn = sortedRTI[rtiIter];
        if (listOfIds.indexOf(curFn.profileNode.id)>=0) continue;
        listOfIds.push(curFn.profileNode.id);
        var subTree = getSubTree(curFn.profileNode);
        listOfIds = listOfIds.concat(subTree);
        var subtreeTime = 0; subTree.forEach((st)=>{subtreeTime+= cpu.raw._idToNode.get(st).self})
        // console.log("ASSERT : " +  (subtreeTime + curFn.self) == curFn.total);
        curTime += subtreeTime + curFn.self
    }

    return listOfIds;
}

// function topKRti(allRti, k){
//     var rti = computeCategories(allRti)["urlWithHttp"];
//     var sortedRTI = rti.sort((a,b)=>{return b.total - a.total});
//     var totalTime = sumTotalTime(rti)
//     var relevantRTI=[], threshhold = k*totalTime/100, curTime=0;
//     for (var rtiIter = 0; rtiIter < rti.length && curTime <= threshhold; rtiIter++) {
//         var curFn = sortedRTI[rtiIter];
//         if (relevantRTI.indexOf(curFn)>=0)
//             continue;
//         relevantRTI.push(curFn);

//         var subTree = recurseSubtree(allRti, curFn);
//         //Append the entire sub tree to the list of functions
//         // var _children = subTree.forEach((child)=>{
//         //     var childIndex = sortedRTI.map((rtiNode)=>{return rtiNode.callUID}).indexOf(child);
//         //     return sortedRTI[childIndex];
//         // })
//         relevantRTI = relevantRTI.concat(subTree); 
//         curTime+=curFn.total
//     }

//     return relevantRTI;
// }

var computeCategories = function(cpu){
    var categories = ["urlWithHttp", "urlNoHttp", "nourl"]
    var result = {};

    cpu.forEach((node)=>{
        if (node.url.startsWith("http")){
            if (!result[categories[0]]) 
                result[categories[0]] = []
            result[categories[0]].push(node)
        } else if (node.url != "") {
            if (!result[categories[1]]) 
                result[categories[1]] = []
            result[categories[1]].push(node)
        } else {
            if (!result[categories[3]]) 
                result[categories[3]] = []
            result[categories[3]].push(node)
        }
    })
    return result;
}

function main(){
    // var totalTime = sumTotalTime(cpu, true);
    // var top20RTI = topKFnFromRTI(cpu, 20);
    // var timeoftop20= sumTotalTime(top20RTI, false);
    // var categorizedCPU = computeCategories(cpu);
    // var timeOnlyUrl = sumTotalTime(categorizedCPU["urlWithHttp"], false);
    // var top20RTIOnlyUrl = topKFnFromRTI(categorizedCPU["urlWithHttp"], 20);
    // var time80OnlyUrl = topKRti(cpu,80);
    // var timeoftop20OnlyUrl = sumTotalTime(top20RTIOnlyUrl, false);
    // var timeof80rtiOnlyUrl = sumTotalTime(time80OnlyUrl);

    var top80percentRTI = topKRti(cpu.parsed, 80);
    var output = {};
    top80percentRTI = top80percentRTI.map((id)=>{
        var child = cpu.raw._idToNode.get(id);
        if (child.url.startsWith("http"))
            return {self:child.self, total: child.total, callUID: child.callUID, functionName: child.functionName,
                url: child.url, raw: child.callFrame};
    }).filter(node => node);
    // console.log(top80percentRTI.filter((f)=>{ return cpu.raw._idToNode.get(f).url.startsWith("http")}).map((m)=>{return cpu.raw._idToNode.get(m).callFrame}))
    // console.log(top80percentRTI);

    fs.writeFileSync(program.output, JSON.stringify(top80percentRTI)); 
    
}

main();


