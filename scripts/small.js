// Small node file to be run inside shell commands
var fs = require('fs');
var util = require('util')
var {spawnSync} = require('child_process');

if (process.argv.length < 4) {
	console.error("Invalid command: Usage: node small.js <flag> <filename>");
	process.exit();
} /*else if (process.argv[2] != "-sum" && process.argv[2] != "-simple" && process.argv[2] != "-complex" && process.argv[2] != "-plt"
    && process.argv[2] != "-fn" && process.argv[2] != "-cache" && process.argv[2] != "-js" && process.argv[2]!= "-invoc"
    && process.argv[2] != "-jsProfile" && process.argv[2]!="--mem" ) {
    console.error("Invalid flag, only -simple and -complex supported");
    process.exit();
}*/
// console.log(process.argv);

var flag = process.argv[2];
var arraySum = (accumulator, currentValue) => {return accumulator + Number(currentValue);};

function topKFromRTI(rti, k){
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
var computeCategories = function(){
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

var processInvocationProperties = function(invoObj,totalValue){
    Object.keys(invoObj).forEach((key)=>{
        if (key == "Function")
            invoObj[key] = processInvocationProperties(invoObj[key], invoObj.TOTAL);
        else {
            // invoObj[key] = invoObj[key].filter((node)=>{return node.indexOf("_count")>=0});
            var ttime = totalValue ? totalValue : invoObj.TOTAL;
            // if (key != "RTI" && key != "DOM" && key != "ND" && key != "antiLocal" && key != "noarg")
            if (key =="TOTAL")
                process.stdout.write(util.format(invoObj[key]));
        }
    });
    // console.log(invoObj.TOTAL);
}
var median = function(values){
    values.sort(function(a,b){
    return a-b;
  });

  if(values.length ===0) return 0

  var half = Math.floor(values.length / 2);

  if (values.length % 2)
    return values[half];
  else
    return (values[half - 1] + values[half]) / 2.0;
}

var processInvocations = function(invocations1, invocations2){
    // var fnToCount = {};
    // console.log("processing invocations");
    // invocations.forEach((invoc)=>{
    //     var fn = invoc.split("_count")[0];
    //     if (!fnToCount[fn]) 
    //         fnToCount[fn] = 0;
    //     fnToCount[fn]++
    // })
    // Object.values(fnToCount).forEach((c)=>{
    //     console.log(c);
    // })
    // return median(Object.values(fnToCount));
    var match = [];
    // console.log(invocations1.length,invocations2.length)
    invocations1.forEach((invoc)=>{
        if (invocations2.indexOf(invoc)>=0)
            match.push(invoc);
    })
    // console.log(invocations2.length)
    return match.length/invocations1.length;
}

if (flag == "-simple") {

    try {
    input = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));

    process.stdout.write(util.format(input["JS Frame"] + " "));
    } catch(e) {
        process.stdout.write(" na ");
    }
} else if (flag == "-complex") {
    input = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))
    var fnStats = input.fnStats.value
    const reducer = (accumulator, current) =>  { return accumulator + current };
    console.log(fnStats.noarg, fnStats.prim, fnStats.prim_objects, fnStats.else, Object.values(fnStats).reduce(reducer));
} else if (flag == "-plt") {
    try {
    	input = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    	process.stdout.write(util.format(input.loadTime + " "));
    } catch (e){
        process.stdout.write(util.format( " na "));
    }
} else if (flag == "-net"){
    var net  = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var total = 0, reused =0;
    net.forEach((data)=>{
        total++;
        if (data.response.connectionReused)
            reused++
        // if (data.)
        if (data.response.timing) 
            console.log(  data.response.timing.connectEnd -data.response.timing.connectStart)
    })
    // console.log(reused, total, reused/total);
} else if( flag == "-inter") {
    var ar1  = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var ar2  = JSON.parse(fs.readFileSync(process.argv[4], "utf-8"));
    var ar3  = JSON.parse(fs.readFileSync(process.argv[5], "utf-8"));

    //filter child nodes
    ar1 = ar1.filter(e=>e[2]!= -1)
    ar2 = ar2.filter(e=>e[2]!= -1)
    ar3 = ar3.filter(e=>e[2]!= -1)

    var inter12 = [];
    ar1.forEach((a1)=>{
        ar2.forEach((a2)=>{
            if (a1[0] == a2[0])
                inter12.push([a1[0],a1[1],a2[1]])
        })
    })
    console.log(inter12);
    var inter123 = [];
    //intersection of inter12 with ar3
    ar3.forEach((a3)=>{
        inter12.forEach((i)=>{
            if (i[0] == a3[0])
                inter123.push([...i,a3[1]])
        })
    })
    console.log("Max nodes: ", Math.max(ar1.length, ar2.length, ar3.length), " with intersection ", inter123.length);
    console.log(inter123);

} 
else if (flag == "-cg") {
    cg = JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value;
    var processLeafNodes = function(cg){
        var leafGraph = [];
        if (!cg) return null;
        Object.keys(cg).forEach((nodeId)=>{
            var node = cg[nodeId];
            // var fnName = nodeId.split("_count")[0];
            // if (nonLeafs.indexOf(fnName)>=0) return;
            if (!node.length)
                leafGraph.push(node);
            // else nonLeafs.push(fnName);
    })

        return leafGraph.length;
    }
    console.log(processLeafNodes(cg))

} else if (flag == "-cache"){
    cs = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    cs.forEach((node)=>{
        if (node[1].Rtime > node[1].Otime)
            console.log(node);
    })
} else if (flag == "-reduce") {
    var setup  = JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value;
    var total = Object.values(setup).reduce((acc, cur)=>{return acc + cur},0);
    process.stdout.write(util.format(total + " "));
} else if (flag == "-hit"){
    var stats  = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var replayT  = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;
    var hits  = JSON.parse(fs.readFileSync(process.argv[5], "utf-8")).value.hits;
    var perInvocTime = {};
    stats.forEach((s)=>{
        perInvocTime[s[0]] = s[1].Otime/s[1].sum;
    })

    var orig = read = write = 0; 
    hits.forEach((invoc)=>{
        var fn = invoc.split("_count")[0];

        var t = perInvocTime[fn];
        orig += t;
        read += replayT[invoc][1] - replayT[invoc][0];
        write += replayT[invoc][2] - replayT[invoc][1];
    })
    console.log(orig, read, write);


}  else if (flag == "-miss") {
    var stats  = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var replayT  = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;
    var cs  = JSON.parse(fs.readFileSync(process.argv[5], "utf-8")).value.misses;
    var perInvocTime = {};
    stats.forEach((s)=>{
        perInvocTime[s[0]] = s[1].Otime/s[1].sum;
    })

    var orig = read = write = 0; 
    ["mismatch", "error","empty"].forEach((cat)=>{
        cs[cat].forEach((invoc)=>{

            if (cat == "error") invoc = invoc[0];
            var fn = invoc.split("_count")[0];

            var t = perInvocTime[fn];
            orig += t;
            var len = replayT[invoc].length -1;
            read += replayT[invoc][len] - replayT[invoc][0];
        })
    })
    console.log(orig, read);
}  else if (flag == "-sig") {
    var timing  = JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value;
    var sigSizes  = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;
    var hits = JSON.parse(fs.readFileSync(process.argv[5], "utf-8")).value.hits;
    var proc = {};
    hits.forEach((invoc)=>{
        var [n,count] = invoc.split("_count")
        if ( !(n in proc) ){
            proc[n] = {};
            proc[n].time = 0;
            proc[n].len = 0;
        }
        proc[n].time += timing[invoc][1] - timing[invoc][0];
        proc[n].len += sigSizes[invoc] ? sigSizes[invoc] :0 ; 
    })
    Object.keys(proc).forEach((n)=>{
        console.log(proc[n].time, proc[n].len)
    })
    // process.stdout.write(util.format(total + " "));
} 
else if (flag == "-map") {
    var leafNodes =  JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var timingInfo1 = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;
    // var timingInfo2 = JSON.parse(fs.readFileSync(process.argv[5], "utf-8")).value;
    // var ttime1 = 0, tinvocs = 0;
    // leafNodes = Object.keys(leafNodes.value);
    var node2time = {}, ttime1 = 0;
    // var computeTotalTime = function(timingPairs){
    //     var _node2time = {};
    //     if (!timingPairs.length) {
    //         console.log("returning since pair length " + timingPairs.length);
    //         return 0;
    //     }
    //     var ttime = 0, startTime=0, endTime = 0;
    //     //alternate approach, slower but more reliable
    //     timingPairs.forEach((p)=>{
    //         var n = p.n.split("_end"), node = n[0];
    //         var isStart = n.length == 1;
    //         if (isStart && _node2time[node])
    //             console.error("Start time for same node encountered twice");
    //         else if (isStart)
    //             _node2time[node] = [p.t];
    //         else if (!isStart && !_node2time[node]) {
    //             console.error("No start node for " + node);
    //         }
    //         else if(!isStart && _node2time[node]){
    //             //update the node2time value
    //             _node2time[node].push(p.t);
    //         }
    //     })
    //     Object.keys(invocation2time).forEach((k)=>{
    //        _node2time[k] =  _node2time[k].length == 2 ? _node2time[k][1] - _node2time[k][0] : 0;
    //     })
    //     ttime = Object.values(_node2time).reduce((current, accumulator)=>{return current+accumulator},0);
    //     return ttime;
    // }
    // leafNodes.forEach((lg)=>{
    //     lg = lg[0];
    //     var pair1 = Object.keys(timingInfo1).filter(e=>e.indexOf(lg)>=0);
    //     if (pair1.length >= 2)  { 
    //         var _t = computeTotalTime(pair1);
    //         ttime1 += _t; node2time[lg] = _t;
    //         if (_t == 0) console.error("Total time for invocation is zero");
    //     }
        
    // })
    leafNodes.forEach((lg)=>{
        lg = lg[0];
        // node2time[lg] = 0;
        var timeInfo = Object.keys(timingInfo1).filter(e=>e.indexOf(lg)>=0);
        timeInfo.forEach((t)=>{
            if (timingInfo1[t].length == 2) {
                if (node2time[lg] == null) node2time[lg] = 0;
                node2time[lg]+= timingInfo1[t][1] - timingInfo1[t][0];
                ttime1 += timingInfo1[t][1] - timingInfo1[t][0];
            }
        })
    })
    process.stdout.write(util.format(ttime1 + " "));
    expensiveNodes = Object.entries(node2time).sort((a,b)=>{return b[1] - a[1]});
    fs.writeFileSync(process.argv[5], JSON.stringify(expensiveNodes));
} else if (flag == "-map2"){
     var leafNodes =  JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var timingInfo1 = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;
    // var timingInfo2 = JSON.parse(fs.readFileSync(process.argv[5], "utf-8")).value;
    // var ttime1 = 0, tinvocs = 0;
    leafNodes = Object.keys(leafNodes.value);
    var node2time = {}, ttime1 = 0;
    leafNodes.forEach((lg)=>{
        var time = timingInfo1[lg];
        if (time && time.length == 2) {
            if (node2time[lg] == null) node2time[lg] = 0;
            node2time[lg]+= time[1] - time[0];
            ttime1 += time[1] - time[0];
        }
    })
  
    process.stdout.write(util.format(ttime1 + " "));
    expensiveNodes = Object.entries(node2time).sort((a,b)=>{return b[1] - a[1]});
    fs.writeFileSync(process.argv[5], JSON.stringify(expensiveNodes));

} else if (flag == "-invoc"){
    var recordInvocs = JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value;
    var replayInvocs = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;
    var timing = JSON.parse(fs.readFileSync(process.argv[5], "utf-8"));

    var rNode2invocs = {}, node2invocs = {record:{}, replay:{}};
    var relevantNodes = timing.filter(e=>e[2]>0).map(e=>e[0])
    recordInvocs.forEach((i)=>{
        var [n,count] = i.split("_count");
        if (count == 0)
            node2invocs.record[n]=[]
        node2invocs.record[n].push(i);
    })
    replayInvocs.forEach((i)=>{
        var [n,count] = i.split("_count");
        if (count == 0)
            node2invocs.replay[n]=[]
        node2invocs.replay[n].push(i);
    })
    // console.log(relevantNodes)
    relevantNodes.forEach((rN)=>{
        rNode2invocs[rN] = [node2invocs.record[rN] ? node2invocs.record[rN].length : 0,
             node2invocs.replay[rN]? node2invocs.replay[rN].length:0];
    });
    // console.log(rNode2invocs);
    console.log(Object.values(rNode2invocs).map(e=>e[0]).reduce((acc,cur)=>{return acc+cur},0),
        Object.values(rNode2invocs).map(e=>e[1]).reduce((acc,cur)=>{return acc+cur},0));


} else if (flag == "-bc") {
    var lnOrig = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var lnReplay = JSON.parse(fs.readFileSync(process.argv[4], "utf-8"));
    var origTime=0, replayTime = 0, bcTime = 0;
    var bcNodes = []
    lnReplay.forEach((node)=>{
        replayTime += node[1];
        var origNodeInd = lnOrig.findIndex(e=>e[0]==node[0]);
        if (origNodeInd<0) {
            console.error("original node not found");
            return
        };
        origTime += lnOrig[origNodeInd][1];
        bcTime += node[1] > lnOrig[origNodeInd][1] ? lnOrig[origNodeInd][1] : node[1];
        if (node[1] < lnOrig[origNodeInd][1]) {
            // console.log(lnOrig[origNodeInd],node)
            bcNodes.push(lnOrig[origNodeInd])
        }

    })
    console.log(origTime, replayTime, bcTime);
    (process.argv.length == 6) && fs.writeFileSync(process.argv[5], JSON.stringify(bcNodes))

} else if (flag == "-uniq") {
     var cg = Object.keys(JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value)
     console.log([...(new Set(cg.map(e=>e.split("_count")[0])))].length);
} else if (flag == "--mem"){
    var memMsg = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var sizeR = /[0-9]* MB/g, sizes = [];
    while (m = sizeR.exec(memMsg)){ sizes.push(Number.parseInt(m[0].split(' ')[0])) }
    // console.log(Math.max(...sizes))    
    process.stdout.write(Math.max(...sizes) + " ");
} else if (flag == "-sum"){
    var data = JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value;
    var sum = Object.values(data).reduce((acc, cur)=>{if (cur.length == 2) return acc+cur[1]-cur[0]; else return acc},0);
    console.log(sum);

 } else if (flag == "-dictComp") {
    var dict1 = JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value;
    var dict2 = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;
    var def = JSON.parse(fs.readFileSync("./defaultMinheap", "utf-8")).result.value;
    var defaultKeys = Object.keys(def);
    var srcDict = Object.keys(dict1).length > Object.keys(dict2).length ? dict1 : dict2
    var dstDict = srcDict == dict1 ? dict2 : dict1;
    var total = 0, match = 0, inbuilt = 0;
    Object.keys(srcDict).forEach((key)=>{
        if (def[key] === undefined) total++
        else inbuilt++;
        if (srcDict[key] === dstDict[key] && def[key] == undefined)  {
           match++;
        }
    })
    process.stdout.write(util.format(match,total,match/total + " "));
 } else if (flag == "-sigMatch") {
    var sig1 = JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value;
    var sig2 = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;

    var srcSig = Object.keys(sig1).length <= Object.keys(sig2).length ? sig1 : sig2
    var dstSig = srcSig == sig1 ? sig2 : sig1;
    keys1 = makeUnique(Object.keys(srcSig)), keys2 = makeUnique(Object.keys(dstSig));
    total = keys1.length, match = [];
    var dstLib2key = genLibToKeys(dstSig);
    keys1.forEach((key1)=>{
        var f = false
        for (m of match){
            if (matchSignature(srcSig[key1], key1, srcSig[m],m)){
                // console.log("already matched before")
                f = true;
                break;
            }
        }
        if (f){
            match.push(key1);
            return;
        }
        var key1Lib = key1.split("-function-")[0];
        if (!dstLib2key[key1Lib]) return false;
        for (key2 of dstLib2key[key1Lib]){
            if (matchSignature(srcSig[key1], key1, dstSig[key2], key2)){
                f = true;
                break;
            }
        }
        if (f){
            match.push(key1);
        }
    })
    console.log(total, match.length);



 } else if (flag == "-nc"){
    var aggrReasonTime = {},
        rCount = {}
    var files = fs.readdirSync(process.argv[3]),
        nFiles = files.length;
    files.forEach((f)=>{
        var filename = process.argv[3]+f;
        var ncStats = JSON.parse(fs.readFileSync(filename, "utf-8"));
        Object.keys(ncStats).forEach((r)=>{
            if (!(r in aggrReasonTime)){
                rCount[r] = 0
                aggrReasonTime[r] = 0;
            }
            rCount[r]++;
            aggrReasonTime[r] += ncStats[r];
            // aggrReasons[r].push(ncStats[r]);
        });

        /*pretty print*/

    })

    Object.keys(aggrReasonTime).forEach((r)=>{
        aggrReasonTime[r] = aggrReasonTime[r]/(rCount[r]); 
        console.log(aggrReasonTime[r] + "," + r)
    })
 } else if (flag == "-replayOverhead") {
    var timeInfo = JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value;
    var sigSizes = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;

    var proc = {};
    Object.keys(timeInfo).forEach((invoc)=>{
        proc[invoc] = {}
        proc[invoc].time = timeInfo[invoc][1] - timeInfo[invoc][0]
        proc[invoc].sig = sigSizes[invoc];
    })
    fs.writeFileSync(process.argv[5], JSON.stringify(proc));
 }

function genLibToKeys(sig){
    var lib2key = {};
    Object.keys(sig).forEach((key)=>{
        var lib = key.split("-function-")[0];
        if (!lib2key[lib])
            lib2key[lib] = []
        lib2key[lib].push(key);
    })
    return lib2key;
}

 function matchSignature(sig1, name1, sig2, name2){
    var libName1 = name1.split("-function-")[0], 
        libName2 = name2.split("-function-")[0];
    if (libName1 != libName2) return false;
    var sig1_reads = sig1.filter(e=>e[0].indexOf("argument_reads")>=0),
        sig2_reads =  sig2.filter(e=>e[0].indexOf("argument_reads")>=0);

    var sig1_writes = sig1.filter(e=>e[0].indexOf("argument_writes")>=0),
    sig2_writes =  sig2.filter(e=>e[0].indexOf("argument_writes")>=0);

    for (one of sig1_reads){
        var f = false;
        for (two of sig2_reads){
            if (JSON.stringify([one[1],one[2]]) == JSON.stringify([two[1], two[2]])){
                f = true
                break
            }
        }
        if (!f) return false;
    }
    // console.log("read states match")
    // return true;
    for (one of sig1_writes){
        var f = false;
        for (two of sig2_writes){
            if (JSON.stringify([one[1],one[2]]) == JSON.stringify([two[1], two[2]])){
                f = true
                break
            }
        }
        if (!f) return false;
    }
    // console.log("entire sig matches")
    return true

 }

 function makeUnique(list){
    return list;
    var u = [...new Set(list.map(e=>e.split("_count")[0]))];
    return u;
}







