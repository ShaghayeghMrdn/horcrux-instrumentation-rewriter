/*
This module takes in a complete call graph and outputs a processed version of it 
*/

var program = require('commander'),
    fs = require('fs'),
    {spawnSync} = require('child_process'),
    util = require('util');

program
    .option('-i, --input [input]','input call graph file')
    .option('-o, --output [output]','output call graph file')
    .option('--verbose', 'enable verbose logging')
    .parse(process.argv);


var uniqueFunctions = function(fn){
    return new Set(fn.map(e=>e.split("_count")[0]))
}

var getTimeFromNodeArray = function(nodeArr){
    //filter out all the end calls 
    var ttime =0;
    var startTimeNodes = nodeArr.filter(e=>e.name.indexOf("_end")<0&& e.name.indexOf("_count")>=0);
    var endTimeNodes = nodeArr.filter(e=>e.name.indexOf("_end")>=0);
    console.log(startTimeNodes.length, endTimeNodes.length);
    startTimeNodes.forEach((startNode,ind)=>{
        if (startNode.name.indexOf("_count")>=0) {
            var _endNodeInd;
            if (endTimeNodes[ind].name.indexOf(startNode.name)>=0){
                // console.log("imm found");
                _endNodeInd = ind;
            }
            else _endNodeInd = endTimeNodes.findIndex(e=>e.name.indexOf(startNode.name)>=0); 
            if (!_endNodeInd)
                return;
            var endNode = endTimeNodes[_endNodeInd];
            if (!endNode) return;
            ttime += endNode.time - startNode.time;
            // nodeArr.splice(_endNodeInd,1);
        }
    })

    return ttime;

}

var processLeafNodes = function(cg){
    var leafGraph = [];

    if (!cg) return leafGraph;
    Object.keys(cg).forEach((nodeId)=>{
        var node = cg[nodeId];
        if (!node.length)
            leafGraph.push(nodeId);
    })

    return leafGraph;
}

var dirExists = function(dir){
    if (!fs.existsSync(dir)){
        spawnSync("mkdir -p  " + dir,{shell:true});
    }
}


function main(){
    try {
        var cg = JSON.parse(fs.readFileSync(program.input, "utf-8"));
        cg = cg.value;
        if (!cg) throw new Error("Empty call graph")
    } catch (e){
        console.error("Error while processing call graph file " + e);
        return;
    }
    var leafNodes = processLeafNodes(cg);

    if (program.verbose){
        // process.stdout.write(util.format(uniqueFunctions(Object.keys(cg)).size ,uniqueFunctions(leafNodes).size,));
        process.stdout.write(util.format(getTimeFromNodeArray(cg) ,));
    }

    dirExists(program.output.split("/").splice(program.output.split("/").length -1,1).join("/"));
    fs.writeFileSync(program.output, JSON.stringify(leafNodes));
}

main();