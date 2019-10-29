//This module processes the timing Information 
var fs = require('fs'),
    program = require('commander'),
    util = require('util');
var _g = getSumOfNodes, _p = console.log, _r= pruneNodes;

program
    .option("-c, --callGraph [callGraph]", "path to the callGraph data file")
    .option("-n, --nonLeaf [nonLeaf]", "path to the non leaf nodes data file")
    .option("-r, --rti [rti]" , "path to the captured timing info")
    // .option("-p, --pattern [pattern]", "specific pattern to match a function node")
    .option("-o, --output [output]", "path to the output file")
    .parse(process.argv);


try {
    var leafInvocations = [];

    if (program.callGraph) {
        var callGraph =  JSON.parse(fs.readFileSync(program.callGraph, "utf-8")).value;
        var invocations = callGraph
        var nonLeafNodes = JSON.parse(fs.readFileSync(program.nonLeaf, "utf-8")).value;
        // var childrenInvocs =getParentNodes();
        // process.exit();
    }
    if (program.rti) invocation2time = JSON.parse(fs.readFileSync(program.rti, "utf-8")).value;
} catch (e){
    throw e;
    return;
}

var node2time = {};

function getParentNodes(){
    console.log("processing parent nodes");
    var parents = [];
    var children = [];

    var childBuffer = [];
    var recursivelyGetChildren = function(invocId){
        var _children = callGraph[invocId];
        if (_children.length)
            childBuffer = childBuffer.concat(_children);

        _children.forEach((childId)=>{
            if (children.indexOf(childId)<0)
                recursivelyGetChildren(childId);
        })
    }

    //Get all children functions first
    invocations.forEach((invocId)=>{
        var _children = callGraph[invocId];
        if (_children.length)
            children = children.concat(_children);
    });

    console.log("children length: " + children.length);

    //Make the list unique so that look ups get faster
    children = [...new Set(children)];

    console.log("children length: " + children.length);
    return children;
    // invocations.forEach((invocId)=>{
    //     if (children.indexOf(invocId)<0)
    //         parents.push(invocId);
    // });

    // //sanity test
    // console.log("Total invocations:" + invocations.length + "\n Parent Nodes: " + parents.length + "\nChildren nodes: " + children.length);
    // console.log(invocations.length == (parents.length + children.length));
    // fs.writeFileSync("tmp",JSON.stringify(parents));
    // fs.writeFileSync("tmp3",JSON.stringify(children));
}

function makeUnique(list){
    var u = [...new Set(list.map(e=>e.split("_count")[0]))];
    return u;
}


var processLeafNodes = function(){
    var uniqInovcs = makeUnique(invocations);
    var uniqueNonLeafs = makeUnique(nonLeafNodes);
    var leafNodes = [];
    uniqInovcs.forEach((invoc)=>{
        if (uniqueNonLeafs.indexOf(invoc)<0)
            leafNodes.push(invoc);
    });

    return leafNodes;
}

// var processLeafNodes = function(cg){
//     var leafGraph = [];
//     var nonLeafs = [];
//     if (!cg) return leafGraph;
//     Object.keys(cg).forEach((nodeId)=>{
//         var node = cg[nodeId];
//         var fnName = nodeId.split("_count")[0];
//         if (nonLeafs.indexOf(fnName)>=0) return;
//         if (!node.length){
//             if (leafGraph.indexOf(fnName)<0)
//                 leafGraph.push(fnName);
//         }
//         else nonLeafs.push(fnName);
//     })

//     return leafGraph;
// }

// var processLeafNodes = function(cg){
//     var leafGraph = [], nonLeafGraph = [], node2invocations = {},tinvocs = 0;
//     if (!cg) return [];
//     Object.keys(cg).forEach((nodeId)=>{
//         var fnName = nodeId.split("_count")[0];
//         // if (leafGraph.indexOf(fnName) >=0 || nonLeafGraph.indexOf(fnName)>=0) return;
//         // var _isLeaf = Object.entries(cg).filter(e=>e[0].indexOf(fnName)>=0).filter(e=>e[1]>0).length;
//         // if (_isLeaf) leafGraph.push(fnName)
//         // else nonLeafGraph.push(fnName);

//         if (!node2invocations[fnName])
//             node2invocations[fnName] = [];
//         node2invocations[fnName].push(cg[nodeId].length);
//         if (cg[nodeId].length == 0)
//             leafInvocations.push(nodeId);
//     })

//     Object.keys(node2invocations).forEach((nodeId)=>{
//         if (!node2invocations[nodeId].filter(e=>e>0).length){
//             leafGraph.push(nodeId);
//             tinvocs += node2invocations[nodeId].length;
//         }
//     })
//     // process.stdout.write(util.format(tinvocs + " "));
//     return leafGraph;
// }

function getSumOfNodes(nodes, isPruned, isInvoc){
    if (Object.prototype.toString.call(nodes).indexOf("Object")>=0)
        nodes = Object.keys(nodes);
    else if (isPruned) nodes = nodes.map(e=>e[0]);
    var totalTime = 0;
    nodes.forEach((n)=>{
        if (isInvoc){
            if (!invocation2time[n]) return;
            totalTime += invocation2time[n];
        }
        else {
            if (!node2time[n]) return;
            totalTime += node2time[n][0];
        }
    })
    return totalTime;
}

var accumulator = (current, total) => {return current + total};
var computeMax = (max, current) =>{ if (current > max){
    max = current;
    return max; 
} }
var sorter = (a,b) => {return a - b}

function getAllIndexes(arr, val) {
    var indexes = [], i = -1;
    while ((i = arr.indexOf(val, i+1)) != -1){
        indexes.push(i);
    }
    return indexes;
}

function standardDeviation(values){
    var avg = average(values);

    var squareDiffs = values.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
    });

    var avgSquareDiff = average(squareDiffs);

    var stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
    }

    function average(data){
    var sum = data.reduce(function(sum, value){
    return sum + value;
    }, 0);

    var avg = sum / data.length;
    return avg;
}

function pruneNodes(nodes, minTotalT, minInvocT){
    var finalNodes = [], totalInvocations = 0, maxInvocations = 50000000;
    nodes.forEach((n)=>{
        if (!node2time[n]) return;
        var mid = node2time[n][2].length/2;
        if (node2time[n][0] >= minTotalT && node2time[n][2].reduce(accumulator)/node2time[n][2].length >= minInvocT && node2time[n][2].length < maxInvocations){
            // console.log(standardDeviation(node2time[n][2]));
            finalNodes.push([n,node2time[n][0]]);
            totalInvocations += node2time[n][2].length;
        }
    })
    // _p(totalInvocations);
    // process.stdout.write(util.format(totalInvocations));
    return finalNodes.sort((a,b)=>{return b[1] - a[1]});
}

function processTimingEntries(){
    // timingInfo.forEach((TI)=>{
    //     var name = TI.n;
    //     if (name.indexOf("_end")<0){
    //         //entry Time of a function
    //         invocation2time[name] = [TI.t];
    //         if (name.indexOf("_count0")>=0)
    //             invocation2time[name].firstInvoc = true;
    //     } else {
    //         var startName = name.split("_end")[0];
    //         var timeArr = invocation2time[startName];
    //         if (!timeArr){
    //             console.error("found exit time without entry time for " + name);
    //             return;
    //         }
    //         timeArr.push(TI.t);
    //     }
    // })

    Object.keys(invocation2time).forEach((invoc)=>{
        var node = invoc.split("_count")[0];
        if (invocation2time[invoc].length < 2) {
            invocation2time[invoc] = 0;
            console.error(invoc + " missing either startTime or endTime")
            return ;
        }
        if (!node2time[node])
            node2time[node] = [0,0,[]];

        invocation2time[invoc] = invocation2time[invoc][1] - invocation2time[invoc][0];
        node2time[node][0] += invocation2time[invoc];
        node2time[node][2].push(invocation2time[invoc]);
        if (invoc.indexOf("_count0")>=0)
            node2time[node][1] = invocation2time[invoc];
    })


}

function processTimeFile() {
    
    processTimingEntries();
    // console.log(node2time.i[0])

    nodes = Object.keys(node2time);
}

function processPattern(){
    var p = program.pattern;
    matchNodes = invocations.filter(e=>e.indexOf(p)>=0);
    console.log(matchNodes.length);
}

if (program.rti)
    processTimeFile();

if (program.callGraph) var leafNodes = processLeafNodes();
if (program.pattern)
    processPattern();



    /*
    Get time for the following configurations of constraints
    All nodes time 
    All leaf nodes time 
    All leaf nodes with the following contraints (minT = mintotal, minI = min first invocation)
     - (0, 0.5)
     - (10, 0)
     - (10,0.5)
     - ()
    */

    // _p(_g(nodes),_g(leafNodes),_g(_r(leafNodes, 0,0.5)),_g(_r(leafNodes, 10,0)),_g(_r(leafNodes, 10,0.5)),_g(_r(leafNodes,10,0.1)))
    // _p(_g(nodes),_g(_r(leafNodes,0,0)), _g(_r(leafNodes,5,0.02)), _g(_r(leafNodes,5,0.01)))
    /*
    The constraints decided for now (5 0.01)
    */
    var nodesWConst = _r(leafNodes, 0.00, .000);
    // var nodesWConst = _r(leafNodes, 0, .000);
    // _p(nodesWConst.length);
    // console.log(nodes.length, parentInvocations.length, leafNodes.length);
    // process.stdout.write( util.format(_g(leafNodles),_g(nodesWConst,1), nodesWConst.length*100/leafNodes.length));
    process.stdout.write(util.format(_g(leafNodes), nodesWConst.length));
    if (program.output) fs.writeFileSync(program.output, JSON.stringify(nodesWConst));
    // _p("Processed nodes with the given constraints");




