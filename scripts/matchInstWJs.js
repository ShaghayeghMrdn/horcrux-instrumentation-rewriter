

var program = require("commander");
var fs = require('fs');
var util = require('util');
var {cpuProfileParser} = require("../devtool-cpu-model/analyze_cpu_profile.js");

program
    .option("-i, --inst [inst]", "instrumented call graph")
    .option("-j, --jsProfile [jsProfile]","chrome profiler output")
    .option("-r, --replay [replay]","replay timing numbers")
    .option("-o, --output [output]","path to the output file")
    .parse(process.argv)


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

var origLog = console.log;

console.log = function(){
    var verboseLog = [program.jsProfile,":",...arguments];
    origLog.apply(this, verboseLog);
}

var rtisMatched = [];
var inst2match = {};
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
    astNode.ttime = 0
    astNode.stime = 0
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
                    astNode.ttime += rtiNode.total
                    astNode.stime += rtiNode.self
                    astNode.rti = rtiNode
                    foundMatch = rtiNode;
                    break;
                } else if (astLoc.s_cn == rtiLoc.cn) {
                    astNode.ttime += rtiNode.total
                    astNode.stime += rtiNode.self
                    astNode.rti = rtiNode
                    foundMatch = rtiNode;
                    break;
                } else if ( (Number.parseInt(astLoc.s_cn)+"function".length) == rtiLoc.cn) {
                    astNode.ttime += rtiNode.total
                    astNode.stime += rtiNode.self
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

var getUserDefinedTime = function(cpu){
    var time = 0;
    cpu.parsed.children.forEach((child)=>{
        if (child.profileNode.url.startsWith("http"))
            time += child.self
    })
    return time;
}

var matchFunctionWithRTI = function(astNodeArray, proccProf){
    var matched = {};
    astNodeArray.forEach((func,i)=>{
        var fStruct = {f:func}
            if (_matchFunctionWithRTI(fStruct, proccProf)) {
                // matched.push(fStruct);
                matched[func]=fStruct;
                inst2match[func]=fStruct
            }
        });
    return matched;
}

var unique = function(arr){
    return [...new Set(arr.map(e=>e.split("_count")[0])) ] 
}

var patchSigWithTime = function(sig, matched, fn2invoc){
    Object.keys(sig).forEach((invoc)=>{
        var fn = invoc.split("_count")[0];
        if (!matched[fn]) return;
        var fnTime = matched[fn].stime;
        var invocTime = fnTime/fn2invoc[fn];
        sig[invoc].push(["time",invocTime]);
    });
}

var getInvocations = function(cg){
    var fn2invocs = {};
    Object.keys(cg).forEach((invoc)=>{
        var fn = invoc.split("_count")[0];
        if (!(fn in fn2invocs))
            fn2invocs[fn]=0;
        fn2invocs[fn]++;
    });
    return fn2invocs;
}

var unique2 = function(arrT){
    var arrStr = arrT.map(e=>JSON.stringify(e));
    var u = [...new Set(arrStr)];
    return u.map(e=>JSON.parse(e));
}

var createParentCG = function(cg){
    var parentCG = {};
    Object.keys(cg).forEach((invoc)=>{
        var children = cg[invoc];
        children.forEach((c)=>{
            parentCG[c]=invoc;
        })
    })

    return parentCG;
}



var invocation2childrenMem = {};
var _getAllChildren = function(cg, invocation){
    var c = [];
    if (invocation2childrenMem[invocation] != null)
        return invocation2childrenMem[invocation]
    cg[invocation].forEach((child)=>{
        var grandChildren = _getAllChildren(cg,child)
        // c = c.concat(grandChildren)
        c.push(child);
        try {
            /*If too many grandchildren, doesn't matter what they exactly are
            since we are only interested in the number of nodes in subtree*/
            c.push(...grandChildren)
        } catch (e){
            c = new Array(grandChildren.length);
        }
    })
    invocation2childrenMem[invocation] = c;
    return c;
}

var getAllChildren = function(cg,timeCgArr){
    var invocation2children = {};
    Object.keys(cg).forEach((invoc)=>{
        if (timeCgArr.indexOf(invoc.split('_count')[0])>=0)
            invocation2children[invoc] = _getAllChildren(cg, invoc);
    })
    console.log("Computed recursive children..");
    return invocation2children;
}

var node2children = {}
var invocation2time = {}
var node2invocations = {};
var subTreeTime;
var getSubtreeTime = function(timeCgArr, origCg){
    var timeCgArr_f = timeCgArr.map(e=>e.f)
    var invocation2children = getAllChildren(origCg, timeCgArr_f);
    Object.keys(invocation2children).forEach((invocation)=>{
        var node = invocation.split("_count")[0];
        if (invocation.indexOf("count0")>=0){
            node2invocations[node]=1;
            node2children[node]=[];
        } else {
            node2invocations[node]++;
        }
        // if (!(node in node2children))
        //     node2children[node]=[];
        var children = invocation2children[invocation];
        // node2children[node] = [invocation,...children,...node2children[node]];
        node2children[node].push(invocation)
        try {
            node2children[node].push(...children);
        } catch (e) {
            // console.log(e, children.length);
            node2children[node] = new Array(children.length);
        }
        // if (invocation2children[invocation]){
        //     node2children
        //     node2children[node] = node2children[node].concat(invocation2children[invocation]);
        // }
    })

    console.log("Computed node to children..")
    var subTree2time = {};
    timeCgArr.forEach((node)=>{
        subTree2time[node.f]=[node.ttime/(node2children[node.f].length), node.ttime]
        invocation2time[node.f] = node.stime/node2invocations[node.f];
    })
    subTreeTime = subTree2time;
    return subTree2time

}

var nodeInSubTree = function(nodes, node){
    nodes.forEach((n)=>{
        var c = node2children[n[0]];
        if (!c) return false;
        c = unique(c);
        if (c.indexOf(node)>=0)
            return n[0];
    })
    return false;
}

var existsInArray = function(arr, entry){
    var fnNames = arr.map(e=>e.f)
    return fnNames.indexOf(entry)>=0
}

var finalNodes; 
var arrayIntersection = function(ar1, ar2){
    var interS = [];
    ar1.forEach((a1)=>{
        ar2.forEach((a2)=>{
            if (a1 == a2)
                interS.push(a1);
        })
    })
    return interS;
}

var _getNodeFromName = function(fnName, cgArray){
    for (e of cgArray){
        if (e.f == fnName)
            return e;
    }
}

/*Underlying assumption is that all invocations of a particular node
originate from the same node, ie a child's total is included in a parent's 
total and child's self is included in a parent's total*/
var checkIfChildAdded = function(parent, selectedNodes, cgArray){
    /*Check if a child is already added*/
    var children = unique(node2children[parent.f])
    var selectedNodesNames = selectedNodes.map(e=>e.f);
    var childSelected = arrayIntersection(children, selectedNodesNames);
    parent.modttime = parent.ttime;
    childSelected.forEach((c)=>{
        var n = _getNodeFromName(c, cgArray)
        if (n)
            parent.modttime -= n.stime;
    })
    /*check if a parent is already added*/
    // if (parent.)
}

var getNodestoInst = function(timeCgArr, proccProf){
    var minNodeTime = 0.1;
    var userDefinedTime = getUserDefinedTime(proccProf);
    var timeCgArr_f = timeCgArr.map(e=>e.f);
    var sortedSubTreeTime = Object.entries(subTreeTime).sort((b,a)=>{return a[1][0]-b[1][0]})
    var sortedTimeArray = timeCgArr.sort((a,b)=>{return b.stime - a.stime})
    var threshholdTime = userDefinedTime*.8;
    var currTotalTime = 0, finalNodes = [], nodeIdx= 0;
    console.log("Processing final nodes...")
    var parentNodes = [];
    // while (currTotalTime<threshholdTime){
       while (true){
        if (nodeIdx >= sortedTimeArray.length){
            console.log("Couldn't fill up the desired time")
            // throw new Error("Couldn't fill the time threshold given constraints")
            break;
        }
        var _curNode = sortedTimeArray[nodeIdx],_n,
            curNode = _curNode;
        if (curNode.stime <= minNodeTime){
            /*Reached nodes with less than threshold time, no point of adding 
            these nodes to fill up the knapsack*/
            console.log("Couldn't fill up the desired time\n Below the threshold");
            break;
        }
        // _n = finalNodes.indexOf(curNode)
        // if (_n >= 0){
        //     var node = finalNodes[_n];
        //     node.child = false
        //     nodeIdx++;
        //     // checkIfChildAdded(curNode, finalNodes, timeCgArr);
        //     currTotalTime += node.ttime;
        //     continue;
        // }

        // var _children = unique(node2children[curNode.f]),
        //     children = _children.filter(e=> e && e!=curNode.f && !existsInArray(finalNodes, e))
        //     .map(e=>inst2match[e] || {f:e, stime:0})
        //     .map((e)=>{e.child = true; return e;})
        //     .filter(e=>e);

        // if (children.length>50){
        //     nodeIdx++
        //     continue
        // }
        // curNode.child = false;
        // checkIfChildAdded(curNode, finalNodes, timeCgArr);
        finalNodes.push(curNode)
        // parentNodes.push(curNode);
        // finalNodes = finalNodes.concat(children);
        // var childrenTime = children.reduce((acc,cur)=>{return acc + cur.stime},0); 
        // console.log("Verify: ", curNode.stime, childrenTime, curNode.ttime);
        // console.log(curNode.stime + childrenTime, curNode.ttime);
        // console.log("Main node: " ,curNode.f, curNode.stime, curNode.ttime, " children time: " , childrenTime);
        nodeIdx++
        // var curTime = curNode[1][1];
        // currTotalTime += curNode.stime + childrenTime;
        currTotalTime += curNode.stime;
    }
    console.log("Time selected " + currTotalTime);
    return finalNodes.map((e)=>{if (e.child) return [e.f,e.stime,-1]; else return [e.f,e.stime,e.ttime, e.rti.profileNode.callFrame]});
}

var getNodesWithRuntime = function(cpu){
    var nodes = [];
    cpu.parsed.children.forEach((child)=>{
        if (child.profileNode.url.startsWith("http") && child.self > 0)
            nodes.push(child);
    })
    return nodes.map((e)=>{return {self:e.self, total: e.total, callUID: e.callUID, functionName: e.functionName,
                 url: e.url, raw: e.profileNode.callFrame}});
}


var getInvocationsFor80Time = function(nodes, invocations){
    var fn2invoc = {};
    invocations.forEach((invoc)=>{
        var fn = invoc.split("_count")[0];
        if (!(fn in fn2invoc))
            fn2invoc[fn]=0;
        fn2invoc[fn]++;
    });

    var totalTime = nodes.map(e=>e.stime).reduce((acc,cur)=>{return acc+cur},0),
        threshT = totalTime*.8, curTime = 0, numInvocs = 0;

    var sortedNodes = nodes.sort((a,b)=>{return b.stime - a.stime}), indx = 0;
    while (curTime < threshT){
        curTime += sortedNodes[indx].stime;
        numInvocs += fn2invoc[sortedNodes[indx].f];
        indx++;
    }
    return numInvocs/Object.values(fn2invoc).reduce((acc,cur)=>{return acc+cur},0);

}
/*
Simply processes the chrome cpuprofile and returns nodes
with selfTime > 0
*/
function selfTimeNodes(){
    var jsProfile = JSON.parse(fs.readFileSync(program.jsProfile, "utf-8"));
    var proccProf = cpuProfileParser(jsProfile);
    var selfTimeNodes = getNodesWithRuntime(proccProf);
    console.log(`Number of cpu profile nodes: ${proccProf.parsed.children.length} Number of selfTimeNodes: ${selfTimeNodes.length}`);
    program.output && fs.writeFileSync(program.output, JSON.stringify((selfTimeNodes) ));
}

/*Takes the callgraph and the inbuilt jsProfile and returns an array of nodes to be instrumented
based on their runtime and callgraph information*/
function i2j(){
    var cg = JSON.parse(fs.readFileSync(program.inst, "utf-8")).value;
    var jsProfile = JSON.parse(fs.readFileSync(program.jsProfile, "utf-8"));
    var fn2invoc = getInvocations(cg);
    var uniqueCg = unique(Object.keys(cg));
    // var uniqueCg = cg;
    var proccProf = cpuProfileParser(jsProfile);
    var cpuTimeWoProgram = proccProf.raw.total - (proccProf.raw.idleNode.self + proccProf.raw.programNode.self);
    // console.log("Number of inst nodes: ", uniqueCg.length, " and number of jsProfiler nodes: ", proccProf.parsed.children.length);

    var matched = matchFunctionWithRTI(uniqueCg, proccProf);
    patchSigWithTime(cg, matched, fn2invoc);
    // program.output && fs.writeFileSync(program.output, JSON.stringify(cg));
    // console.log("Number of matched nodes: " + matched.length + " total time inside matched "  + matched.map(e=>e.stime).reduce((acc,cur)=>{return acc+cur}) 
    //     + " and total user defined time " + getUserDefinedTime(proccProf) + " actual scripting time " + cpuTimeWoProgram)
    // console.log(matched.map(e=>e.stime).reduce((acc,cur)=>{return acc+cur},0) , getUserDefinedTime(proccProf));
    // // console.log(getInvocationsFor80Time(matched, Object.keys(cg)))

    // var subTree2time = getSubtreeTime(matched, cg)
    // // // console.log(Object.entries(subTree2time).sort((b,a)=>{return a[1]-b[1]}).slice(0,10))
    // var finalNodes = getNodestoInst(matched,proccProf);
    // console.log("Final:" + unique2(finalNodes).length)
    // console.log("Final time: " ,finalNodes.reduce((acc, cur)=>{if (cur[1]>=0 )return acc+cur[1]; else return acc},0));
    // program.output && fs.writeFileSync(program.output, JSON.stringify(unique2(finalNodes) ));
}

/*Taken two instNodes files and creates a new one where the replay time
is less than the original time*/
function i2i() {
    var original = JSON.parse(fs.readFileSync(program.inst, "utf-8"));
    var replay = JSON.parse(fs.readFileSync(program.replay, "utf-8"));

    var finalNodes = [];
    original.forEach((n)=>{
        var on = n[0];
        var _i = replay.map(e=>e[0]).indexOf(on);
        if (_i >= 0){
            var rn = replay[_i][1];
            if (!rn.Rtime  || rn.Rtime < rn.Otime){
                finalNodes.push(n);
            } else {
                //Remove the original time, so the static analyzer marks it for skipping
                finalNodes.push([n[0],null,n[2]]);
            }
            return;
        }
        finalNodes.push(n);
    })
    program.output && fs.writeFileSync(program.output, JSON.stringify(finalNodes));
}

if (!program.inst) selfTimeNodes();
else if (program.jsProfile) i2j();
else if (program.replay) i2i();