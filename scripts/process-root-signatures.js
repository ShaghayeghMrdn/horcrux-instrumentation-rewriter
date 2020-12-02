/*
This modules process root signatures
Uses the root invocations to get root functions
Uses signature information to extract root signatures
Uses timing information to patch the root signatures with their times

*/

const fs = require('fs'),
    program = require('commander'),
    nodeMatcher = require('./ast-prof-matcher'),
    {cpuProfileParser} = require("../devtool-cpu-model/analyze_cpu_profile.js");

program
    .option('-t, --timing [timing]','timing information')
    .option('-s, --sig [sig]','signature information')
    .option('-r, --roots [roots]','root functions')
    .option('-o, --output [output]','output file')
    .parse(process.argv);




var parse = function(f){
    try {
        return JSON.parse(
            fs.readFileSync(f, "utf-8")
            );
    } catch (e){
        return {value:null};
    }
}

var pruneSig = function(sig) {
    if (!sig) return [];
    const filtered = sig.filter(dep => (dep[0].startsWith("global") ||
            dep[0].startsWith("closure") ||
            dep[0].startsWith("DOM")))
    const stringified = [];
    filtered.forEach((dep) => { // each dependency is a list itself
        // each dependency is a list: scopeAccess, varName (, value)?
        const scopeAccess = dep[0].split('_');
        if (scopeAccess[0] == "global" || scopeAccess[0] == "DOM") {
            stringified.push(JSON.stringify([dep[0], dep[1]]));
        } else { // closure_..._reads/writes
            if (scopeAccess.length >= 3) {
                if (scopeAccess[scopeAccess.length-1] == 'reads') {
                    // include the closure_reads value
                    const value = Array.isArray(dep[2]) ? dep[2][0] : dep[2];
                    stringified.push(JSON.stringify([dep[0], dep[1], value]));
                } else {
                    // no need to print values for closure_writes
                    stringified.push(JSON.stringify([dep[0], dep[1], dep[2]]));
                }
            }
            // else {
            //     console.log(`Expected closure_LOC_reads: ${dep[0]}`);
            // }
        }
    });
    return stringified;
}

var getRootFns = function(rootInvocs){
    var rootFns = [];
     _rootFns = [...new Set(rootInvocs.map(e=>e.split("_count")[0]))];
    // _rootFns.forEach((r)=>{
    //     if (rootInvocs.filter(e=>e.indexOf(r)>=0).length == 1)
    //         rootFns.push(r);
    // });
    return rootFns;
}

var fnToInvocs = function(sigData){
    var fn2invocs = {};
    Object.keys(sigData).forEach((invoc)=>{
        var [fn,count] = invoc.split("_count");
        if (!(fn in fn2invocs))
            fn2invocs[fn]=0;
        fn2invocs[fn]++;
    });
    return fn2invocs;
}

var cumulateRootSigs = function(rootFns, sigData, timingInfo){
    // var rootFns = root.map(e=>e.split("_count")[0]);q
    var rootFnSig = {};
    rootFns.forEach((fn)=>{
        rootFnSig[fn] = {
            sig:null,
            time:null
        }
    });

    // var fn2count = fnToInvocs(sigData);
    // var fn2time = nodeMatcher.match(rootFns, timingInfo )
    // return;
    Object.keys(sigData).forEach((invoc)=>{
        if (rootFns.filter(e=>invoc.indexOf(e)>=0).length){
            //invocation is a root invocation
            // console.log(invoc);
            var [fn,count] = invoc.split("_count");
            // if (!(fn in fn2count))
            //     fn2count[fn] = count;
            // if (count < fn2count[fn])
            //     console.error('out of order invocs', invoc,fn2count[fn])
            // if (count > 0){
            //     delete rootFnSig[fn];
            //     return;
            //     // throw new Error('multiple invocations for the same root node' + invoc);
            // }
            var sig = sigData[invoc];
            var sigVars = pruneSig(sig);
            if (rootFnSig[fn].sig)
                rootFnSig[fn].sig = new Set([...rootFnSig[fn].sig, ...new Set(sigVars)])
            else rootFnSig[fn].sig = new Set(sigVars);

            // if (!fn2time[fn])
            //     console.error(`No match for ${fn}`);
            // rootFnSig[fn].time = fn2time[fn]? fn2time[fn].ttime/fn2count[fn] : -1;
             var time = timingInfo[invoc];
            if (time && time.length == 2){
                if (rootFnSig[fn].time === null) rootFnSig[fn].time = 0;
                rootFnSig[fn].time += time[1] - time[0];
            }
        }
    });

    //convert sets to array for printing purposes
    Object.keys(rootFnSig).forEach((fn)=>{
        if (rootFnSig[fn].time === null) {
            delete rootFnSig[fn];
            return;
        }
        rootFnSig[fn].sig = rootFnSig[fn].sig ? [...rootFnSig[fn].sig].map(e=>JSON.parse(e)) : [];
    });

    return rootFnSig;
}

function main(){
    var ti = parse(program.timing).value,
        sig = parse(program.sig).value,
        roots = parse(program.roots);

    if (!sig || !ti || !roots) return;
    if (!(Object.keys(sig).length)) return;

    // var cpuProf = cpuProfileParser(ti);
    // var roots = getRootFns(_roots);
    var accSigs = cumulateRootSigs(roots, sig, ti);
    program.output &&
        fs.writeFileSync(program.output, JSON.stringify(accSigs, null, 2));
}

main();


