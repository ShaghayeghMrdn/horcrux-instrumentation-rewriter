/*
This module matches the the abstract syntax tree nodes with the nodes obtained
from Chrome's cpu profile 

API: match(ASTarray, procProf)
    Arguments:
        - ASTarray : array containing AST nodes to be matched
        - procProf: Parsed Chrome's cpu profile
    Returns:
        - A dict with key AST name, value, the matched node

*/



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
        return true;
    }
    console.log(`no match for ${astNode.f}`);
    return false;
}

var matchFunctionWithRTI = function(astNodeArray, proccProf){
    var matched = {};
    astNodeArray.forEach((func,i)=>{
        var fStruct = {f:func}
            if (_matchFunctionWithRTI(fStruct, proccProf)) {
                // matched.push(fStruct);
                matched[func]=fStruct;
            }
        });
    return matched;
}

module.exports = {
    match:matchFunctionWithRTI
}