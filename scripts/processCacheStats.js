//This module processes the cache statistics obtained from the replay run
var fs = require('fs'),
    program = require('commander'),
    util = require('util');

program
    .option("-c, --cacheStats [cacheStats]", "path to the cachestats data file")
    .option("-t , --timing [timing]","path to the timing info file")
    .option("-r , --replay [replay]","path to the replay timing file")
    .option("-n,--nc [nc]","non cacheability reason")
    .option("-f, --filter [filter] , order in which output is to be listed | asc or desc")
    .option("-o, --output [output]", "path to the output file")
    .option("-s --sig [sig]"," sig sizes")
    .option("--type [type]","Type of output")
    .parse(process.argv);


var cacheStats, callGraph = [], node2count = {},nodes;

//a 3 tuple for each function
var node2stats = {}, node2time = {}, nc = {}, replayTiming = {},
    node2callFrame = {}, _ss = {}, ss = {};

var processInputs = function(){
    try {
        cacheStats = JSON.parse(fs.readFileSync(program.cacheStats,"utf-8")).value;
        timingInfo = JSON.parse(fs.readFileSync(program.timing,"utf-8"))
        if (program.replay) {
            replayTiming = JSON.parse(fs.readFileSync(program.replay,"utf-8")).value;
            replayTiming = processReplayTiming(replayTiming)
        }
        if (program.nc) {
            _nc = JSON.parse(fs.readFileSync(program.nc,"utf-8")).value;
            nc = uniqueNC(_nc);





        }

        if (program.sig){
            _ss = JSON.parse(fs.readFileSync(program.sig,"utf-8")).value;
            ss = processSigSizes(_ss);
        }

        callGraph = callGraph.concat(cacheStats.hits);
        callGraph = callGraph.concat(cacheStats.misses.mismatch);
        callGraph = callGraph.concat(cacheStats.misses.error.map(e=>e[0]));
        callGraph = callGraph.concat(cacheStats.misses.empty);


        //populate node2time
        timingInfo.forEach((entry)=>{
            node2time[entry[0]] = entry[2] >=0 ? entry[2] : 0
            node2callFrame[entry[0]] = entry[2] >=0 ?  entry[3]: null;
        })

        // Object.keys(_replayTiming).forEach((invoc)=>{
        //     var [node, count] = invoc.split("_count")
        //     if (count == 0)
        //         replayTiming[node]=0;
        //     replayTiming[node] += _replayTiming[invoc][1] - _replayTiming[invoc][0];
        // })
    } catch (e){
        console.error("Error while processing input files...\n Exiting ...\n",e);
    }
}

var processSigSizes = function(ss){
    var proc = {};
    Object.keys(ss).forEach((i)=>{
        var n = i.split("_count")[0];
        if (!(n in proc))
            proc[n]=0;
        proc[n] += ss[i];
    })
    return proc;
}

var processReplayTiming = function(rt){
    var proc = {};
    Object.keys(rt).forEach((i)=>{
        var n = i.split("_count")[0];
        if (!(n in proc))
            proc[n]=0;
        if (!rt[i] || rt[i].length < 2) return;
        var len = rt[i].length;
        proc[n] += rt[i][len-1] - rt[i][0]; 
        // proc[n] += (rt[i] && rt[i].length == 2) ? rt[i][1] - rt[i][0] : 0;
    })
    return proc;
}

var uniqueNC = function(d){
    var newD = {};
    Object.keys(d).forEach((invoc)=>{
        var n = invoc.split("_count")[0];
        newD[n] = d[invoc];
    })
    return newD;
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
            node2stats[node] = {hits:0,mismatch:0,empty:0,error:0,Otime:0};
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
        var relSum = Object.entries(node2stats[node]).filter(e=>e[0]!="empty").reduce((acc,cur)=>{return cur[1]+acc},0)
        node2stats[node].hitRate = node2stats[node].hits/sum;
        node2stats[node].missRate = (relSum-node2stats[node].hits)/sum;
        node2stats[node].sum = sum;
        node2stats[node].Otime = node2time[node];
        node2stats[node].cf = node2callFrame[node];
        if (program.replay)
            node2stats[node].Rtime = replayTiming[node];
        // node2stats[node].Rtime = replayTiming[node]
        if (program.nc)
            node2stats[node].nc = nc[node];

        if (program.sig)
            node2stats[node].ss = ss[node];
    })
}

var aggregateCS = function(cs){
    var aggrStats = {
        hits:{
            o:0,
            r:0    
        }, 
        mismatch :{
            o:0,
            r:0
        },
        empty :{
            o:0,
            r:0
        }
    };

    Object.keys(node2stats).forEach((node)=>{
        var stat = node2stats[node];
        var invocTO = stat.Otime/stat.sum;
        var invocTR = stat.Rtime/stat.sum;

        if (stat.Otime){
            aggrStats.hits.o += stat.hits * invocTO;
            aggrStats.mismatch.o += stat.mismatch * invocTO + stat.error * invocTO;
            aggrStats.empty.o += stat.empty * invocTO;
        }
        if (stat.Rtime){
            aggrStats.hits.r += stat.hits * invocTR;
            aggrStats.mismatch.r += stat.mismatch * invocTR + stat.error * invocTR;
            aggrStats.empty.r += stat.empty * invocTR;
        }
    })

    return aggrStats;
}

var processNonCacheableReasons = function(){
    // var ncReasons = [...new Set(Object.values(_nc))];
    var aggrReasons = {}
    var node2emptyTime = {};
    // ncReasons.forEach((r)=>{
    //     aggrReasons[r]=0;
    // });

    /*Iterate through the empty cache stats key*/
    cacheStats.misses.empty.forEach((n)=>{
        var reason = _nc[n] ? _nc[n] : "empty";
        var node = n.split("_count")[0];
        var stat = node2stats[node];
        var invocTime = stat.Otime/stat.sum;
        if (!(reason in aggrReasons))
            aggrReasons[reason] = 0;
        aggrReasons[reason]+=invocTime;
    });

    var rt = Object.values(aggrReasons).reduce((acc, cur)=>{return acc + cur},0),emptyTime=0;
    Object.keys(node2stats).forEach((node)=>{
        var stats = node2stats[node];
        var _emptyTime = ((stats.empty)/stats.sum)*stats.Otime;
        emptyTime += _emptyTime
        node2emptyTime[node] = _emptyTime;
    })

    Object.keys(node2emptyTime).forEach((n)=>{
        node2emptyTime[n] = node2emptyTime[n]/emptyTime
    })

    var nonEmptyTime = Object.entries(aggrReasons).reduce((acc,cur)=>{if (cur[0] != "empty") return acc + cur[1]; else return acc+0;},0);

    // Object.keys(aggrReasons).forEach((r)=>{
    //     if (aggrReasons[r])
    //         aggrReasons[r] = aggrReasons[r]/emptyTime;
    // })

    // var sortedReasons = Object.entries(aggrReasons).sort((a,b)=>{return b[1] - a[1]});
    // var rank = 1;
    // sortedReasons.forEach((entry)=>{
    //     aggrReasons[entry[0]]= rank++;
    //     // console.log(entry[0],rank++);
    // })
    
    // console.log(aggrReasons.empty)
    // console.log(rt, emptyTime, Number.parseInt(rt) == Number.parseInt(emptyTime));
    if (program.output)
        fs.writeFileSync(program.output, JSON.stringify(aggrReasons));
    console.log(aggrReasons.empty ? aggrReasons.empty : 0, nonEmptyTime);

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

var computeCacheBenefits = function(){
    var timeSaved = 0, timeTriedToSave = 0, timeExecuted = 0,
        timeTriedToSaveNoError=0, timeEmpty = 0;
    Object.keys(node2stats).forEach((node)=>{
        var stats = node2stats[node];
        timeSaved += stats.hitRate*stats.Otime;
        timeTriedToSave += ((stats.hits + stats.mismatch + stats.error)/stats.sum)*stats.Otime
        timeTriedToSaveNoError += ((stats.hits + stats.mismatch)/stats.sum)*stats.Otime
        timeEmpty += (stats.empty/stats.sum)*stats.Otime;
        timeExecuted += stats.Otime;
        // if (!(isNaN(stats.hitRate))) {
        //     timeSaved += stats.hitRate*stats.Otime
        // }
    })
    console.log(timeSaved, timeTriedToSave, timeEmpty, timeExecuted)
}

var printLLOutput = function(){
    var order = program.filter ? program.filter ==  "asc" ? "asc" : "desc" : "asc";
    // var output = Object.entries(node2stats).sort((a,b)=>{return order == "asc" ? a[1].hitRate - b[1].hitRate : b[1].hitRate - a[1].hitRate}).splice(0,20);
    var output = Object.entries(node2stats).sort((a,b)=>{return b[1].hits - a[1].hits});
    var outputOrig = (node2stats);
    if (program.output)
        fs.writeFileSync(program.output, JSON.stringify(output));
    // else console.log(output);
    computeCacheBenefits();
}

var printHLOutput = function(){
    var aggrStats = aggregateCS(node2stats);
    if (program.output)
        fs.writeFileSync(program.output, JSON.stringify(aggrStats));
    else console.log(aggrStats);
}

processInputs();
getUniqueNodes();
// processTimingInfo();
processCS();
program.type == "savings" ? printLLOutput() : processNonCacheableReasons() 
// processNonCacheableReasons();




