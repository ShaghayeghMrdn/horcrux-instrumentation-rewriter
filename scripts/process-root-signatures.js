/*
This modules process root signatures 
Uses the root invocations to get root functions
Uses signature information to extract root signatures
Uses timing information to patch the root signatures with their times

*/

const fs = require('fs'),
    program = require('commander');

program
    .option('-t, --timing [timing]','timing information')
    .option('-s, --sig [sig]','signature information')
    .option('-r, --roots [roots]','root invocations')
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

var pruneSig = function(sig){
    if (!sig) return []];
    return sig
        .filter(e=>e[0].indexOf("global")>=0)
        .map(e=>JSON.stringify([e[0],e[1]]));
}

var getRootFns = function(rootInvocs){
    var rootFns = [];
    var _rootFns = [...new Set(rootInvocs.map(e=>e.split("_count")[0]))];
    _rootFns.forEach((r)=>{
        if (rootInvocs.filter(e=>e.indexOf(r)>=0).length == 1)
            rootFns.push(r);
    });
    return rootFns;
}

/*
Overwrite set add 
*/

var cumulateRootSigs = function(rootFns, sigData, timingInfo){
    // var rootFns = root.map(e=>e.split("_count")[0]);q
    var rootFnSig = {};
    rootFns.forEach((fn)=>{
        rootFnSig[fn] = {
            sig:null,
            time:null
        }
    });

    var fn2count = {};
    Object.keys(timingInfo).forEach((invoc)=>{
        if (rootFns.filter(e=>invoc.indexOf(e)>=0).length){
            //invocation is a root invocation
            // console.log(invoc);
            var [fn,count] = invoc.split("_count");
            if (!(fn in fn2count))
                fn2count[fn] = count;
            if (count < fn2count[fn])
                console.error('out of order invocs', invoc,fn2count[fn])
            if (count > 0){
                delete rootFnSig[fn];
                return;
                // throw new Error('multiple invocations for the same root node' + invoc);
            }
            var sig = sigData[invoc];
            var sigVars = pruneSig(sig);
            rootFnSig[fn].sig = new Set(sigVars);

            var time = timingInfo[invoc];
            if (time && time.length == 2)
                rootFnSig[fn].time = time[1] - time[0];
        }
    });

    //convert sets to array for printing purposes
    Object.keys(rootFnSig).forEach((fn)=>{
        rootFnSig[fn].sig = rootFnSig[fn].sig ? [...rootFnSig[fn].sig].map(e=>JSON.parse(e)) : [];
    });

    return rootFnSig;
}

function main(){
    var ti = parse(program.timing).value, 
        sig = parse(program.sig).value,
        _roots = parse(program.roots).value;

    if (!sig || !ti || !_roots) return;
    if (!(Object.keys(sig).length)) return;

    var roots = getRootFns(_roots);
    var accSigs = cumulateRootSigs(roots, sig, ti);
    program.output &&
        fs.writeFileSync(program.output, JSON.stringify(accSigs));
}

main();


