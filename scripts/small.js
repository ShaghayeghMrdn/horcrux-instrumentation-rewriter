// Small node file to be run inside shell commands
var fs = require('fs');
var util = require('util')

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
} else if (flag == "-sum"){
	input = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
	process.stdout.write(util.format(Object.values(input).map((e)=>{return Number(e);}).reduce(arraySum) + " "));

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
    cs1 = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    cs2 = JSON.parse(fs.readFileSync(process.argv[4], "utf-8"));
    if (cs1.value && cs2.value && Object.keys(cs1.value).length != 0){
        process.stdout.write(util.format( (Object.keys(cs1.value).length - Object.keys(cs2.value).length)/Object.keys(cs1.value).length ));
        // console.log(" ",cs.value.hits.length,);
        // Object.keys(cs.value).forEach((key)=>{
        //     console.log(cs.value[key],key)
        // })
        // var sum = Object.values(cs.value).reduce((acc, cur)=>{return acc+ cur},0);
        // console.log(sum);
    } else {
        // process.stdout.write(util.format("undefined"));
    }
    // let misses = cs.value.misses + cs.value.nulls;
    // process.stdout.write(util.format(cs.value.hits  + "  "  + misses));
} else if (flag == "-cache"){
    cs = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    if (cs.value){
        process.stdout.write(util.format(cs.value.hits.length, cs.value.misses.empty.length))
    }
} 
else if (flag == "-map") {
    var leafNodes =  JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var timingInfo1 = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;
    var timingInfo2 = JSON.parse(fs.readFileSync(process.argv[5], "utf-8")).value;
    var ttime1 = 0, ttime2=0;
    var node2time = {};
    leafNodes.forEach((lg)=>{
        lg = lg[0];
        var pair1 = timingInfo1.filter(e=>e.n.indexOf(lg)>=0);
        var pair2 = timingInfo2.filter(e=>e.n.indexOf(lg)>=0);
        if (pair1.length >= 2)  { ttime1 += pair1[1].t - pair1[0].t; node2time[lg] = pair1[1].t - pair1[0].t;}
        if (pair2.length >= 2) ttime2 += pair2[1].t - pair2[0].t;
    })
    console.log(ttime1, ttime2);
    expensiveNodes = Object.entries(node2time).sort((a,b)=>{return b[1] - a[1]}).slice(0,10);
    fs.writeFileSync(process.argv[6], JSON.stringify(expensiveNodes));
} else if (flag == "-invoc"){
    var leafNodes = JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value;
    var timingInfo = JSON.parse(fs.readFileSync(process.argv[4], "utf-8")).value;

    var node2time = {};
    leafNodes.forEach((lg)=>{
        var pair = timingInfo.filter(e=>e.n.indexOf(lg)>=0);
        if (pair.length >= 2) node2time[lg] = pair[1].t - pair[0].t;
    })
    expensiveNodes = Object.entries(node2time).sort((a,b)=>{return b[1] - a[1]}).slice(0,10);
    console.log("Done processing expensive leaf nodes");
    fs.writeFileSync(process.argv[5], JSON.stringify(expensiveNodes));

} else if (flag == "-uniq") {
     var cg = Object.keys(JSON.parse(fs.readFileSync(process.argv[3], "utf-8")).value)
     console.log([...(new Set(cg.map(e=>e.split("_count")[0])))].length);
} else if (flag == "--mem"){
    var memMsg = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var sizeR = /[0-9]* MB/g, sizes = [];
    while (m = sizeR.exec(memMsg)){ sizes.push(Number.parseInt(m[0].split(' ')[0])) }
    // console.log(Math.max(...sizes))    
    process.stdout.write(Math.max(...sizes) + " ");

}






