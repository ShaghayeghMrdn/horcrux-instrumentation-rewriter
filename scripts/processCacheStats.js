//This module processes the cache statistics obtained from the replay run
var fs = require('fs'),
    program = require('commander'),
    util = require('util');

program
    .option("-c, --cacheStats [cacheStats]", "path to the cachestats data file")
    .option("-t , --timing [timing]","path to the timing info file")
    .option("-f, --filter [filter] , order in which output is to be listed | asc or desc")
    .option("-o, --output [output]", "path to the output file")
    .parse(process.argv);


var cacheStats, callGraph = [], node2count = {},nodes;

//a 3 tuple for each function
var node2stats = {}, node2time = {};

var processInputs = function(){
    try {
        cacheStats = JSON.parse(fs.readFileSync(program.cacheStats,"utf-8")).value;
        timingInfo = JSON.parse(fs.readFileSync(program.timing,"utf-8")).value;

        callGraph = callGraph.concat(cacheStats.hits);
        callGraph = callGraph.concat(cacheStats.misses.mismatch);
        callGraph = callGraph.concat(cacheStats.misses.error.map(e=>e[0]));
        callGraph = callGraph.concat(cacheStats.misses.empty);
    } catch (e){
        console.log("Error while processing input files...\n Exiting ...");
    }
}

var getUniqueNodes = function(){
    var _nodes,
    _nodes = callGraph.map(e=>e.split("_count")[0]);
    _nodes = [...new Set(_nodes)];

    //Also process the total count
    callGraph.forEach((invocId)=>{
        var node = invocId.split("_count")[0];
        if (!node2count[node]){
            node2count[node] = 0;
            node2stats[node] = {hits:0,mismatch:0,empty:0,error:0,time:0};
        }
        node2count[node]++;

    });

    nodes =  _nodes;

}

var processCS = function(){
    var iter = function(arr,label){
        arr.forEach((a)=>{
            if (toString.call(a).indexOf("Array")>=0)
                a = a[0];
            var n = a.split("_count")[0];
            node2stats[n][label]++;
        })
    }

    iter(cacheStats.hits,"hits");
    iter(cacheStats.misses.mismatch,"mismatch");
    iter(cacheStats.misses.empty,"empty");
    iter(cacheStats.misses.error,"error");

    Object.keys(node2stats).forEach((node)=>{
        var sum = Object.values(node2stats[node]).reduce((cur,acc)=>{return cur+acc},0)
        node2stats[node].hitRate = node2stats[node].hits/sum;
        node2stats[node].missRate = (sum-node2stats[node].hits)/sum;
        node2stats[node].sum = sum;
        node2stats[node].time = node2time[node];
    })
}

var processTimingInfo = function(){

    var ttime1 = 0, tinvocs = 0;

    var computeTotalTime = function(timingPairs){
        var _node2time = {};
        if (!timingPairs.length) {
            console.log("returning since pair length " + timingPairs.length);
            return 0;
        }
        var ttime = 0, startTime=0, endTime = 0;
        timingPairs.forEach((p)=>{
            var n = p.n.split("_end"), node = n[0];
            var isStart = n.length == 1;
            if (isStart && _node2time[node])
                console.error("Start time for same node encountered twice");
            else if (isStart)
                _node2time[node] = [p.t];
            else if (!isStart && !_node2time[node]) {
                console.error("No start node for " + node);
            }
            else if(!isStart && _node2time[node]){
                //update the node2time value
                _node2time[node].push(p.t);
            }
        })
        Object.keys(_node2time).forEach((k)=>{
           _node2time[k] =  _node2time[k].length == 2 ? _node2time[k][1] - _node2time[k][0] : 0;
        })
        ttime = Object.values(_node2time).reduce((current, accumulator)=>{return current+accumulator},0);
        return ttime;
    }
    nodes.forEach((lg)=>{
        var pair1 = timingInfo.filter(e=>e.n.indexOf(lg)>=0);
        if (pair1.length >= 2)  { ttime1 += computeTotalTime(pair1); node2time[lg] = computeTotalTime(pair1);}
        
    })
}

var printOutput = function(){
    var order = program.filter ? program.filter ==  "asc" ? "asc" : "desc" : "asc";
    // var output = Object.entries(node2stats).sort((a,b)=>{return order == "asc" ? a[1].hitRate - b[1].hitRate : b[1].hitRate - a[1].hitRate}).splice(0,20);
    var output = Object.entries(node2stats).filter(e=>e[1].hitRate<0.8).sort((a,b)=>{return b[1].time - a[1].time}).splice(0,20);
    var outputOrig = (node2stats);
    console.log(Object.keys(node2stats).length);
    if (program.output)
        fs.writeFileSync(program.output, JSON.stringify(output));
    else console.log(outputOrig);
}

processInputs();
getUniqueNodes();
processTimingInfo();
processCS();
printOutput();




