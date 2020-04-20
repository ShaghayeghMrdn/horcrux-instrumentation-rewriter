/*
This module processes the raw timing info file first 
Then uses this against the original timing info file to find the best case list of nodes 
*/

var fs = require('fs'),
    program = require('commander'),
    util = require('util');

program
    .option("-i, --original [original]", "path to the original timing info (processed) file")
    .option("-r , --replay [replay]","path to the replay timing info (raw) file")
    .option("-o, --output [output]", "path to the output file")
    .parse(process.argv);


var processTimingInfo = function(tInfo){
    var node2time = {};
    Object.keys(tInfo).forEach((invoc)=>{
        var data = tInfo[invoc];
        var [node, count] = invoc.split("_count");
        if (count == 0)
            node2time[node] = 0;

        if (data.length == 2 && data[1] > data[0])
            node2time[node] += data[1] - data[0]
    })
    return node2time;
}

var getChildren = function(o){
    var node2children = {};
    o.forEach((entry)=>{
        var [mNode, time, cNode] = entry;
        if (!(mNode in node2children))
            node2children[mNode] = [];
        if (cNode)
            node2children[cNode].push([mNode,time])
    })
    return node2children;
}

var bestCaseNodes = function(o,r){
    var bcNodes = [];
    var node2children = getChildren(o);
    o.forEach((entry)=>{
        var [node, time,cNode] = entry;
        if (r[node]) {
            if (time && r[node]<=time[1]) {
                bcNodes.push([node, time, r[node]])
                //add children
                node2children[node].forEach((child)=>{
                    bcNodes.push([...child, node])
                })
            }
        } else 
        bcNodes.push([...entry])
    })
    return bcNodes;
}


var originalTime = JSON.parse(fs.readFileSync(program.original,"utf-8"));
var replayTime = JSON.parse(fs.readFileSync(program.replay,"utf-8")).value;

var replayProc = processTimingInfo(replayTime);

var bcNodes = bestCaseNodes(originalTime, replayProc);

fs.writeFileSync(program.output, JSON.stringify(bcNodes));