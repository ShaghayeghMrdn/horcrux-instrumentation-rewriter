
// This module does the following
/*
First argument: list of invocations (non cacheable nodes)
Second argument: cache statisitcs: dicst <key:functionName, value: cacheHitRate>

Produces the following output
1st column                         | 2nd Column
time inside non cacheable nodes |   Best case time based on cache hit percentages
*/

var fs = require('fs'),
    invoc2time = {};

var node2time = JSON.parse(fs.readFileSync(process.argv[2],"utf-8"));
var cacheStats = JSON.parse(fs.readFileSync(process.argv[3],"utf-8"));
var timingInfo = JSON.parse(fs.readFileSync(process.argv[4],"utf-8")).value;

var processTimingInfo = function(){
    var ttime = 0, startTime=0, endTime = 0, _node2time = {};
    var timingPairs = timingInfo;
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
    invoc2time = _node2time;
    return ttime;
}

var processBestCaseNumbers = function(){
    var bcTime = 0,
        ncTime = 0;
    node2time.forEach((node)=>{
        if (!cacheStats[node[0]]) {
            console.error("no cache data for node " + node[0]);
            return;
        }
        var t = node[1];
        var mr = cacheStats[node[0]].missRate;
        bcTime += mr*t;

        var ncr = cacheStats[node[0]].empty/cacheStats[node[0]].sum;
        ncTime += ncr*t;
    })
    return [bcTime, ncTime];
}

processTimingInfo();
var [bcTime,ncTime] = processBestCaseNumbers();
var origTime = node2time.map(e=>e[1]).reduce((curr,acc)=>{return curr+acc},0);
console.log(origTime, ncTime, bcTime);


