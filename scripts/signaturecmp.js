//This module takes as input two files containing
//stringified signatures
//it compares the two signature  files and reports on matching signature percentage
const fs = require('fs'),
    util = require('util'),
    program = require('commander'),
    {cpuProfileParser} = require("../devtool-cpu-model/analyze_cpu_profile.js");

const PATH_TO_SIGNATURE="/home/goelayu/research/WebPeformance/outputm2/modified/mobile/sig/imc",
    PATH_TO_SIGNATURE2="/home/goelayu/research/WebPeformance/outputm2/modified/mobile/sig/imc2",
    PATH_TO_PROFILE="/home/goelayu/research/WebPeformance/outputm2/orig/mobile//imc",
    PATH_TO_ALIASURLS="/home/goelayu/research/WebPeformance/scripts/aliasURlS/",
    PATH_TO_PAIRS_DICT="/home/goelayu/research/WebPeformance/scripts/sites/pairDict_top";

program
    // .option('-s, --sig [sig]', 'path to the signature file')
    // .option('-i, --inst [inst]','path to the node timing profile')
    // .option('-c, --cpu [cpu]','path to the chrome cpu profile')
    .option('-t, --type [type]','type of time interval for signature comparision')
    .option('-s, --site, [site]', 'the name of the site')
    .option('-p, --pairs','Set to true if comparing pairs')
    .option('-v, --verbose', 'verbose log')
    // .option('-s, --sanity', 'sanity test signature')
    .parse(process.argv);


var getUserDefinedTime = function(cpu){
    var time = 0;
    cpu.parsed.children.forEach((child)=>{
        if (child.profileNode.url.startsWith("http"))
            time += child.self
    })
    return time;
}

var parseFile = function(f){
    // console.log(f);
    return JSON.parse(fs.readFileSync(f),"utf-8");
}

var getPathFromID = function(functionID){
    var location;
    var splitObj = functionID.split('-');
    var objLen = splitObj.length;

    if (objLen  == 6 )
        return splitObj[0];
    else if (splitObj[objLen - 7] == "script"){
        location = splitObj.slice(0,objLen-7).join("-")
    } else{
        location = splitObj.slice(0,objLen-5).join("-")
    }
    
    return location;

}

var getNodeLocationFromID = function(functionID){
    var locObj = {s_ln:0, s_cn:0, e_ln:0, e_cn:0};
    var splitObj = functionID.split('-');
    var objLen = splitObj.length;
    locObj = {
        s_ln: splitObj[objLen-4],
        s_cn: splitObj[objLen-3],
        e_ln: splitObj[objLen-2],
        e_cn: splitObj[objLen-1]
    }

    return locObj;

}

var rtisMatched = [];
var _matchFunctionWithRTI = function(astNode,cpu){
    //Simply iterate the call graph;
    var rti = cpu.raw, myRti = [];
    var astLoc = getNodeLocationFromID(astNode.f);
    var astPath = getPathFromID(astNode.f);
    var foundMatch = false;
    cpu.parsed.children.forEach((child)=>{
        if (child.profileNode.url.endsWith(astPath))
            myRti.push(child);
    })
    // for (var iter = 1;iter <= rti._idToNode.size;iter++){
    //     var rtiNode = rti._idToNode.get(iter);
    //     if (rtiNode.url.endsWith(astPath))
    //         myRti.push(rtiNode);
    // }
    for (rtiNode of myRti) {
        var rtiLoc = {ln:1+rtiNode.profileNode.callFrame.lineNumber, cn:rtiNode.profileNode.callFrame.columnNumber};
        if (rtiNode.profileNode.url.endsWith(astPath)){
            if (astLoc.s_ln == rtiLoc.ln) {
                // Now lets try and match against different column numbers
                if (astLoc.e_cn == rtiLoc.cn) {
                    astNode.time = rtiNode.self
                    astNode.rti = rtiNode
                    foundMatch = rtiNode;
                    break;
                } else if (astLoc.s_cn == rtiLoc.cn) {
                    astNode.time = rtiNode.self
                    astNode.rti = rtiNode
                    foundMatch = rtiNode;
                    break;
                } else if ( (Number.parseInt(astLoc.s_cn)+"function".length) == rtiLoc.cn) {
                    astNode.time = rtiNode.self
                    astNode.rti = rtiNode
                    foundMatch = rtiNode;
                    break;
                }
            }
        }
    };
    // if (!foundMatch)
    //     console.error("Match not found for" + astNode.f)
    if (foundMatch){
        rtisMatched.push(foundMatch);
        return true;
    }
    return false;
}

var matchFunctionWithRTI = function(astNodeArray,cpu){
    var matched = [];
    astNodeArray.forEach((f,i)=>{
            func = {f:f}
            if (_matchFunctionWithRTI(func,cpu))
                matched.push(func);
        });
    // console.log(matched);
    return matched;
}

var getTimeWithSig = function(sig, cpu){
    var t = 0;
    var fnsExecuted = [...new Set(Object.keys(sig).map(e=>e.split("_count")[0]))];
    var fnsWithTime = matchFunctionWithRTI(fnsExecuted,cpu);
    return fnsWithTime.reduce((acc,cur)=>{return acc + cur.time},0);
}

var logTimes = function(proccCpu, node2time, signature){
    var UDTime = getUserDefinedTime(proccCpu);
    var instTime = node2time.reduce((acc, cur)=>{return acc + cur.self},0)
    var sigTime = getTimeWithSig(signature,proccCpu)
    console.log(UDTime, instTime, sigTime);
}

var binSignature = function(sig){
    var fn2sig = {};
    Object.keys(sig).forEach((s)=>{
        var fn = s.split("_count")[0];
        if (!(fn in fn2sig))
            fn2sig[fn]=[];
        var _sig = sig[s].filter(e=>typeof e == 'object');
        fn2sig[fn].push([_sig.length, _sig.toString()]);
    })

    return fn2sig;
}

var _compareSignature = function(srcSigStr, srcLen,  dstSig){
    return srcLen == dstSig[0] && 
     (srcSigStr == dstSig[1]);
}

var getCanonicalFnName = function(srcFn, pairs){
    return srcFn;
    var _dstFn, dstFn;
    for (var k in pairs){
        if (srcFn.indexOf(k)>=0){
            _dstFn = pairs[k];
            break;
        };
    }
    return _dstFn ? srcFn.replace(srcFn.split('-function')[0],_dstFn) :
        srcFn;
}

var isFirstDomain = function(sig,site){
    return !sig.length || sig[sig.length - 1][1].startsWith(`https://${site}/`) 
        || sig[sig.length - 1][1].startsWith(`https://${site.replace('www','')}/`)
}

var compareSignatures = function(srcSig, dstSig, fnPairs, site){

    var srcFns = [...new Set(Object.keys(srcSig).map(e=>e.split("_count")[0]))],
        dstFns = [...new Set(Object.keys(dstSig).map(e=>e.split("_count")[0]))];

    // srcFns.forEach((sf)=>{
    //     if (dstFns.indexOf(sf)<0)
    //         console.log(sf);
    // });
    // process.exit();

    var binDstSig = binSignature(dstSig);

    var srcFn2Invocs = {};
    var totalMatched = 0;

    Object.keys(srcSig).forEach((s)=>{
        var fn = s.split("_count")[0],
            sig = srcSig[s].filter(e=> typeof e == 'object' && e[0] != "ec");
        if (!(fn in srcFn2Invocs))
            srcFn2Invocs[fn]={matched:[], noCand : [], total:[], 
                context : [0,0], cache:{}, nFrames : [new Set, new Set]};
        var [sigStr, sigLen] = [sig.toString(), sig.length];

        if (srcFn2Invocs[fn].cache[sigStr] !== undefined){
            if (srcFn2Invocs[fn].cache[sigStr]){
                srcFn2Invocs[fn].matched.push(s);
                if (isFirstDomain(srcFn2Invocs[fn].cache[sigStr], site)){
                    srcFn2Invocs[fn].context[1]++
                }
            } else srcFn2Invocs[fn].noCand.push(s);
            if (isFirstDomain(srcSig[s], site)){
                    srcFn2Invocs[fn].context[0]++
            }
            srcFn2Invocs[fn].total.push(s);
            return;
        }

        srcFn2Invocs[fn].cache[sigStr] = false;

        var candDstSig = binDstSig[fn] || [],
            foundMatch = false;

        if (!candDstSig.length){
            var aliasFn = getCanonicalFnName(fn, fnPairs);
            candDstSig = binDstSig[aliasFn] || [];
        }

        if (!candDstSig.length)
            srcFn2Invocs[fn].noCand.push(s);

        for (var d of candDstSig){
            if (_compareSignature(sigStr, sigLen, d)){
                srcFn2Invocs[fn].matched.push(s);
                foundMatch = true;
                srcFn2Invocs[fn].cache[sigStr] = srcSig[s].length ? srcSig[s] : [];
                if (isFirstDomain(srcSig[s], site)){
                    srcFn2Invocs[fn].context[1]++
                    srcSig[s].length && srcFn2Invocs[fn].nFrames[1].add(srcSig[s][srcSig[s].length-1][1])
                }
                break;
            }
        }
        if (isFirstDomain(srcSig[s], site)){
             srcFn2Invocs[fn].context[0]++;
             srcSig[s].length && srcFn2Invocs[fn].nFrames[0].add(srcSig[s][srcSig[s].length-1][1])
         }
        srcFn2Invocs[fn].total.push(s);
    });

    return srcFn2Invocs;
}

var sigMatchTime = function(matchData, cpu, site){
    var tsaved = 0, noCandTime = 0, ttotal = 0,
        tMain = 0, sMain = 0, nFrames = [new Set, new Set];
    Object.keys(matchData).forEach((f)=>{
        var invocs = matchData[f];
        var perc = invocs.matched.length/invocs.total.length,
            noCandPerc = invocs.noCand.length/invocs.total.length;
        var func = {f:f}
        var t = _matchFunctionWithRTI(func, cpu) ? func.time : 0
        // console.log(noCandPerc);
        noCandTime += t*noCandPerc;
        tsaved += t*perc;
        ttotal += t;
        tMain += (invocs.context[0]/invocs.total.length)*t
        sMain += (invocs.context[1]/invocs.total.length)*t

        nFrames[0] = new Set([...nFrames[0], ...invocs.nFrames[0]])
        nFrames[1] = new Set([...nFrames[1], ...invocs.nFrames[1]])
        // if (func.rti.profileNode.callFrame.url.indexOf(site)>=0){
        //     total[0] += t;
        //     saved[0] += t*perc;
        // } else {
        //     total[1] += t;
        //     saved[1] += t*perc;
        //     if (perc>0)
        //         nDomains[1].add(func.rti.profileNode.callFrame.url.split('/')[2])
        //     nDomains[0].add(func.rti.profileNode.callFrame.url.split('/')[2])
        // }


    })
    return [tsaved, noCandTime]
    // return [ttotal, tMain, tsaved, sMain];
    // return [nFrames.map(e=>e.size)];
}

var _urlToFnName = function(url){
    return url.length>50?url.substring(url.length-50,url.length) : url;
}

var processCanonicalUrls = function(urlPairs){
    var namePairs = {};
    urlPairs.forEach((p)=>{
        var _o = _urlToFnName(p[0]),
            _t = _urlToFnName(p[1]);

        namePairs[_o] = _t;
        namePairs[_t] = _o;
    });
    return namePairs;
}

var checkData = function(s,d){
    if (!s || !d || 
        Object.keys(s).length == 0 || Object.keys(d).length == 0
        // || Object.keys(s).length/Object.keys(d).length < 0.2 
        // || Object.keys(d).length/Object.keys(s).length < 0.2 
        ) return true;
}

var sanitizeUrls = function(u){
    return u.split('://')[1].replace(/\//g,'_').replace(/\&/g,'-');
}

var _getValidSourceSig = function(subPaths,type,srcStart){
    var ret = [], _srcSig, srcSig;
    for (var i = srcStart; i < subPaths.length;i++){
        var p = subPaths[i];
        _srcSig = `${PATH_TO_SIGNATURE}/top/pairs/b2b/${sanitizeUrls(p)}/signature`;
        try {
            srcSig = parseFile(_srcSig).value;
            if (srcSig && Object.keys(srcSig).length){
                ret = [srcSig, i];
                break;
            }
        } catch (e){
            // do nothing, continue
        }
    };
    return ret;
}

var compareAllTopPairs = function(subPaths, type,srcStart){
    var getSrc = _getValidSourceSig(subPaths,type,srcStart);
    if (!getSrc.length) return Number.MAX_SAFE_INTEGER;

    var dstStart = getSrc[1], srcSig = getSrc[0],
        _dstSig, dstSig;
    var _prof = `${PATH_TO_PROFILE}/top/pairs/b2b/=${sanitizeUrls(subPaths[0])}/jsProfile`, //The profile used was the first url's
        prof = cpuProfileParser(parseFile(_prof));

    for (var i = dstStart+1; i<subPaths.length;i++){
        var p = subPaths[i];
        _dstSig = `${PATH_TO_SIGNATURE}/top/pairs/${type}/${sanitizeUrls(p)}/signature`;
        try {
            dstSig = parseFile(_dstSig).value;
        } catch (e){
            dstSig = {};
        }
        if (checkData(srcSig, dstSig)) continue;


        var fasterRun = Object.keys(srcSig).length > Object.keys(dstSig).length ?
        dstSig : srcSig;
        var slowerRun = fasterRun == srcSig ? dstSig : srcSig;

        var matchData = compareSignatures(fasterRun, slowerRun, []);
        var time = sigMatchTime(matchData, prof);
        console.log(`${time} ${getTimeWithSig(fasterRun,prof)}`);

    }
    return getSrc[1]+1;
}

var getTopPairPaths = function(type, subPaths){
    var srcStart = 0;
    while (srcStart < subPaths.length){
        srcStart = compareAllTopPairs(subPaths,type,srcStart);
    }
}

function main(){
    // var cpu = parseFile(program.cpu),
    //  node2time = parseFile(program.inst),
    //  signature = parseFile(program.sig).value,
    //  proccCpu = cpuProfileParser(cpu);

    var srcSig, dstSig, srcProf, dstProf, canonUrls, fnPairs, urlPairDict, pair = [],
        dstProf, srcProf;

    if (program.pairs){
        urlPairDict = parseFile(PATH_TO_PAIRS_DICT);
        pair = urlPairDict[program.site];

        getTopPairPaths(program.type, pair);
        return;
    }

    switch (program.type){
        case 'b2b': 
            if (pair.length){
                srcSig = PATH_TO_SIGNATURE+"/rand/pairs/b2b/"+sanitizeUrls(pair[1])+"/signature",
                dstSig = PATH_TO_SIGNATURE+"/rand/pairs/b2b/p1/b2b/"+sanitizeUrls(pair[1])+"/signature",
                dstProf = srcProf = PATH_TO_PROFILE + "/rand/pairs/b2b/"+sanitizeUrls(pair[1])+"/jsProfile"
                break;
            }
            srcSig = PATH_TO_SIGNATURE+"/top/b2b/0_context/"+program.site+'/signature',
            dstSig = PATH_TO_SIGNATURE+"/top/b2b/1/"+program.site+'/signature',
            canonUrls = PATH_TO_ALIASURLS+"/b2b/"+ program.site;
            dstProf = srcProf = PATH_TO_PROFILE+"/top/b2b/1/"+program.site+'/jsProfile';
            break;
        case 'hour':
            if (pair.length){
                srcSig = PATH_TO_SIGNATURE+"/rand/pairs/hour/"+sanitizeUrls(pair[1])+"/signature",
                dstSig = PATH_TO_SIGNATURE+"/rand/pairs/b2b/p1/hour/"+sanitizeUrls(pair[1])+"/signature",
                dstProf = srcProf = PATH_TO_PROFILE + "/rand/pairs/hour/"+sanitizeUrls(pair[1])+"/jsProfile"
                break;
            }
            srcSig = PATH_TO_SIGNATURE+"/top/b2b/0_hour/"+program.site+'/signature',
            dstSig = PATH_TO_SIGNATURE+"/top/hour/0/"+program.site+'/signature',
            canonUrls = PATH_TO_ALIASURLS+"/hour/"+ program.site
            dstProf = srcProf = PATH_TO_PROFILE+"/top/hour/0/"+program.site+'/jsProfile';
            break;
        case 'day':
            if (pair.length){
                srcSig = PATH_TO_SIGNATURE+"/rand/pairs/day/"+sanitizeUrls(pair[1])+"/signature",
                dstSig = PATH_TO_SIGNATURE+"/rand/pairs/b2b/p1/day/"+sanitizeUrls(pair[1])+"/signature",
                dstProf = srcProf = PATH_TO_PROFILE + "/rand/pairs/day/"+sanitizeUrls(pair[1])+"/jsProfile"
                break;
            }
            srcSig = PATH_TO_SIGNATURE+"/top/b2b/0_day/"+program.site+'/signature',
            dstSig = PATH_TO_SIGNATURE+"/top/day/0/"+program.site+'/signature',
            canonUrls = PATH_TO_ALIASURLS+"/day/"+ program.site;
            dstProf = srcProf = PATH_TO_PROFILE+"/top/day/0/"+program.site+'/jsProfile';
            break;
    }

    try {
        srcSig = parseFile(srcSig).value, srcProf = cpuProfileParser(parseFile(srcProf)),
            dstSig = parseFile(dstSig).value, dstProf = cpuProfileParser(parseFile(dstProf));

        try {
            fnPairs = processCanonicalUrls(parseFile(canonUrls));
        } catch {
            fnPairs = [];
        }

        if (checkData(srcSig,dstSig)){
            console.log("")
            if (program.verbose) console.log("empty data in one of the signatures");
            return;
        }
    } catch (e){
        console.log("");
        if (program.verbose) console.log(e);
        return;
    }

    // var fasterRun = getUserDefinedTime(srcProf) > getUserDefinedTime(dstProf) ? 
    //  dstSig : srcSig;
    var fasterRun = Object.keys(srcSig).length > Object.keys(dstSig).length ?
        dstSig : srcSig;
    var slowerRun = fasterRun == srcSig ? dstSig : srcSig;
    var fasterProf = fasterRun == srcSig ? srcProf : dstProf

    var matchData = compareSignatures(fasterRun, slowerRun, fnPairs, program.site);
    var time = sigMatchTime(matchData, fasterProf, program.site);
    console.log(`${time} ${getTimeWithSig(fasterRun,fasterProf)}`);
}

main();


