// Small node file to be run inside shell commands
var fs = require('fs');
var util = require('util')

if (process.argv.length < 4) {
	console.error("Invalid command: Usage: node small.js <flag> <filename>");
	process.exit();
} else if (process.argv[2] != "-sum" && process.argv[2] != "-simple" && process.argv[2] != "-complex" && process.argv[2] != "-plt"
    && process.argv[2] != "-fn" && process.argv[2] != "-cache" && process.argv[2] != "-js" && process.argv[2]!= "-invoc"
    && process.argv[2] != "-jsProfile" && process.argv[2]!="--mem" ) {
    console.error("Invalid flag, only -simple and -complex supported");
    process.exit();
}

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

var processInvocations = function(invocations){
    var fnToCount = {};
    console.log("processing invocations");
    invocations.forEach((invoc)=>{
        var fn = invoc.split("_count")[0];
        if (!fnToCount[fn]) 
            fnToCount[fn] = 0;
        fnToCount[fn]++
    })
    Object.values(fnToCount).forEach((c)=>{
        console.log(c);
    })
    return median(Object.values(fnToCount));
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
	input = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
	process.stdout.write(util.format(input.loadTime + " "));
} else if (flag == "-sum"){
	input = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
	process.stdout.write(util.format(Object.values(input).map((e)=>{return Number(e);}).reduce(arraySum) + " "));

} else if (flag == "-fn"){
    noncache = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))
    fns = JSON.parse(fs.readFileSync(process.argv[4], "utf-8"))
    // console.log(Object.keys(noncache))
    process.stdout.write(util.format(Object.keys(fns.value).length + " " + Object.keys(noncache.value).length + " "))
} else if (flag == "-cache") {
    cs = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    let misses = cs.value.misses + cs.value.nulls;
    process.stdout.write(util.format(cs.value.hits  + "  "  + misses));
} else if (flag == "-js") {
    cpu = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    timeline = JSON.parse(fs.readFileSync(process.argv[4], "utf-8"));
    timelinecat = JSON.parse(fs.readFileSync(process.argv[5], "utf-8"));
    // console.log(Object.keys(timelinecat));
    var cpuTime = 0, cpuIter = 0, relevantTime = 0;
    cpu.forEach((node)=>{
        if (node.functionName.indexOf("program")>=0 || node.functionName.indexOf("idle")>=0) {
            // console.log(node);
            return;
        }
        cpuTime += node.self
    })

    var relevantRTI = topKFromRTI(cpu, 20);
    relevantRTI.forEach((node)=>{
        if (node.functionName.indexOf("program")>=0 || node.functionName.indexOf("idle")>=0) {
            // console.log(node);
            return;
        }
        relevantTime += node.self
    })

    console.log(cpuTime, timelinecat["scripting"], timeline["JS Frame"]);
    // console.log(relevantTime/cpuTime);
} else if (flag == "-invoc"){
    var invoObj = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))
    console.log(processInvocations(invoObj.value));
    // processInvocationProperties(invoObj);
} else if (flag == "-jsProfile") {
     var rti = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"))
     // process.stdout.write(util.format(rti.length +" "));
     console.log(rti.slice(0,10).map((el)=>{return el.functionName;}))
} else if (flag == "--mem"){
    var memMsg = JSON.parse(fs.readFileSync(process.argv[3], "utf-8"));
    var sizeR = /[0-9]* MB/g, sizes = [];
    while (m = sizeR.exec(memMsg)){ sizes.push(Number.parseInt(m[0].split(' ')[0])) }
    // console.log(Math.max(...sizes))    
    process.stdout.write(Math.max(...sizes) + " ");

}






