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
    // var net = netRaw.split('\n');
    // if (!net || !net.length) return;
    // net.pop();// remove the last entry since it is an empty line
    // net = net.map(e=>JSON.parse(e));
    // reqSent = (net.filter(e=>e['Network.requestWillBeSent']).map(e=>e['Network.requestWillBeSent'].request.url));
    reqRecv = (net.filter(e=>e['Network.responseReceived'] /*&& e['Network.responseReceived'].response.mimeType.indexOf("xhr")>=0*/).map(e=>e['Network.responseReceived'].response.url));
    process.stdout.write(util.format(net.length));
    // fs.writeFileSync("urls", JSON.stringify(reqSent))
    // reqRecv.forEach((k)=>{
    //     console.log(k);
    // })
    // ar = [...reqSent]
    // ar.forEach((k)=>{''
    //     console.log(k.split('/').slice(2).join("/"));
    //     // console.log(k);
    // });
} else if( flag == "-net2") {
    var net  = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    reqSent = (net.filter(e=>e['Network.requestWillBeSent']).map(e=>e['Network.requestWillBeSent'].request.url));
    process.stdout.write(util.format(reqSent.length));
} else if (flag == "-net3"){
    var net  = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    process.stdout.write(util.format(net.length));
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
    if (cs.value){
        process.stdout.write(util.format(cs.value.hits.length, cs.value.misses.empty.length))
    }
} else if (flag == "-reduce") {
    var leafNodes  = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var total = leafNodes.reduce((acc, cur)=>{return acc + cur[1]},0);
    process.stdout.write(util.format(total + " "));
} else if (flag == "-reducec") {
    var leafNodes  = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var total = leafNodes.reduce((acc, cur)=>{return acc + cur.self},0);
    process.stdout.write(util.format(total + " "));
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
    var leafNodes = JSON.parse(fs.readFileSync(process.argv[4], "utf-8"));
    var callGraph = JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value;
    var totalInvocs = 0;
    var processInvocations = function(cg){
        var leafGraph = [], nonLeafGraph = [], node2invocations = {},tinvocs = 0;
        if (!cg) return [];
        (cg).forEach((nodeId)=>{
            var fnName = nodeId.split("_count")[0];
            // if (leafGraph.indexOf(fnName) >=0 || nonLeafGraph.indexOf(fnName)>=0) return;
            // var _isLeaf = Object.entries(cg).filter(e=>e[0].indexOf(fnName)>=0).filter(e=>e[1]>0).length;
            // if (_isLeaf) leafGraph.push(fnName)
            // else nonLeafGraph.push(fnName);

            if (!node2invocations[fnName])
                node2invocations[fnName] = 0
            node2invocations[fnName]++;
        })
        return node2invocations;
    }
    node2invocations =  processInvocations(callGraph);
    leafNodes.forEach((lg)=>{
        if (node2invocations[lg[0]]) {
            // console.log(lg[0], node2invocations[lg[0]].length);
            totalInvocs += node2invocations[lg[0]];
        }
    })
    process.stdout.write(util.format(totalInvocs + " "));

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
    var data = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    if (data.value){
        var sum = Object.values(data.value).reduce((acc, cur)=>{return acc+Number.parseInt(cur)},0);
        console.log(sum);
    }

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







