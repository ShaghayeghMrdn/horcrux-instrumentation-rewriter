

var util = require('./util.js');
var properties = require ("properties");
var propertyObj = {};
const PATH_TO_PROPERTIES = __dirname + "/DOMHelper.ini";
properties.parse(PATH_TO_PROPERTIES, {path: true, sections: true}, function(err, obj){ propertyObj = obj ;})


// var getAliasFromActual = function(node) {
//     parent = node.parent;
//     while ((parent.type != "FunctionDeclaration" && parent.type != "FunctionExpression") && parent.parent != undefined){
//         parent = parent.parent;
//     }
//     if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
//      if (parent.globalAlias) {
//          for (let elem in parent.globalAlias) {
//              if (node.source() == parent.globalAlias[elem].source())
//                  return elem;
//          }
//      }
//     }        
// }

var removeLocalVariables = function(parentNode) {
    /*
    Straightforward removal: if a local variable exists in the global reads/write set without any member expression, or other forms of expression
    then it will get removed, otherwise, if a local variable was earlier assumed to be globa;l
    */

    if (parentNode.globalAlias) {
        for (let elem in parentNode.globalAlias ) {
            if (IsLocalVariable(parentNode.globalAlias[elem]) <=0 ) {
                delete parentNode.globalAlias[elem];
                if (parentNode.localVariables == undefined){
                    parentNode.localVariables = []
                } 
                parentNode.localVariables.push(parentNode.globalAliasMap[elem]);
            }
        } 
    }

    // var alias = getAliasFromActual(node);
    if (parentNode.globalWrites){
        for (let i = parentNode.globalWrites.length-1; i >= 0; i--){
            if (IsLocalVariable(parentNode.globalWrites[i]) <=0 ) {
                parentNode.globalWrites.splice(i, 1);
            }
        }
    }

    if (parentNode.globalReads){
        for (let i = parentNode.globalReads.length-1; i >= 0; i--){
            if (IsLocalVariable(parentNode.globalReads[i]) <=0 ) {
                parentNode.globalReads.splice(i, 1);
            }
        }
    }

}

var addLocalVariable = function (node) {
    parent = node.parent;
    while ((parent.type != "FunctionDeclaration" && parent.type != "FunctionExpression") && parent.parent != undefined){
        parent = parent.parent;
    }
    if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
        if (parent.localVariables == undefined){
            parent.localVariables = []
        }
        if (node.source() == "" ) console.log("adding empty local vars");
        if (node.id){
            if (parent.localVariables.map(function(e){return e.source()}).indexOf(node.id.name) < 0) 
            parent.localVariables.push(node.id);
        } else {
            if (parent.localVariables.map(function(e){return e.source()}).indexOf(node.source()) < 0) 
                parent.localVariables.push(node);
        }
        
        // remove variable from the signature
        removeLocalVariables(parent);

        // console.log("[]adding local variable " + node.source() + " with keys:  " + Object.keys(node) + JSON.stringify(parent.loc));
        // console.log("local args looks like: " + parent.localVariables.map(function(e){return e.source()}));
    }

}

var handleDOMMethods = function(node, standAlone) {
    var localMethods = Object.keys(propertyObj.local);
    var globalDOMMethods = Object.keys(propertyObj.global);
    var isLocal;
    localMethods.forEach(function(localmethod){
        if (!standAlone) {
            if (node.source().includes(localmethod)) {
                isLocal = 1;
            }
        }
    });

    globalDOMMethods.forEach(function(DOMMethod){
        if (!isLocal && node.callee.source().toLowerCase().includes(DOMMethod.toLowerCase())) {
            isLocal = 0
        }
    });
    return isLocal;
}

/* 
Returns 0 for local and -1 for non variables (literals, integers etc)
Returns 1 for global
*/
var IsLocalVariable = function (node){
    var identNode;
    if (node == null || typeof(node) == "undefined") return 0;
    else if (node.type == "ConditionalExpression"){
        return (IsLocalVariable(node.consequent) || IsLocalVariable(node.alternate))
    } else if (node.type == "ObjectExpression" || node.type == "Literal" || 
        node.type == "NewExpression" || node.type == "BinaryExpression" || node.type == "LogicalExpression"
        || node.type == "ArrayExpression" || node.type == "" || node.type == "FunctionExpression"){     // TODO handle all the dom modifications: For now the callexpression like document.getElementbyId('') will be marked as local. 
        return 0;
    } else if (node.type == "UnaryExpression")
        return IsLocalVariable(node.argument)
    else if (node.type == "MemberExpression" || node.type == "AssignmentExpression" || node.type == "FunctionExpression" || node.type == "CallExpression" || node.type == "Identifier")
        identNode = util.getIdentifierFromGenericExpression(node);
    // console.log("the identifier node we got:  " + identNode.);
    if (identNode == null ) return 0;
    if (node.type == "CallExpression"){
        var callexpression = handleDOMMethods(node, false);
        if (callexpression == null)
            return 0;
        else return !callexpression;
    } 
    parent = identNode.parent;
    while (parent != undefined && parent.parent != undefined){
        if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
            functionArguments = util.getArgs(parent);
            if (parent.localVariables == undefined) parent.localVariables = []
            if (parent.localVariables.map(function(e){return e.source()}).includes(identNode.name) || functionArguments.includes(identNode.name)){
                return 0;
            }
        }
        parent = parent.parent;
    }
    return 1;
}

var isGlobalAlias = function(node) {
    var identNode;
    if (node == null || typeof(node) == "undefined") return 0;
    else if (node.type == "ConditionalExpression"){
        return (isGlobalAlias(node.consequent) || isGlobalAlias(node.alternate))
    } else if (node.type == "ObjectExpression" || node.type == "Literal" || 
        node.type == "NewExpression" || node.type == "BinaryExpression" || node.type == "LogicalExpression"
        || node.type == "ArrayExpression" || node.type == "" || node.type == "FunctionExpression"){     // TODO handle all the dom modifications: For now the callexpression like document.getElementbyId('') will be marked as local. 
        return 0;
    } else if (node.type == "UnaryExpression")
        return isGlobalAlias(node.argument)
    else if (node.type == "MemberExpression" || node.type == "AssignmentExpression" || node.type == "FunctionExpression" || node.type == "CallExpression" || node.type == "Identifier")
        identNode = util.getIdentifierFromGenericExpression(node);
    // console.log("the identifier node we got:  " + identNode.);
    if (identNode == null ) return 0;
    if (identNode.source().includes("document")){
        return 0;
    } else {
        // Handling call expressions which are not dom methods
        // Right now will just return as local
        if (node.type == "CallExpression") {
            return 0;
        }
    }
    parent = identNode.parent;
    while (parent != undefined) {
        if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
            if (!parent.globalAlias) return 0;
            else {
                if (identNode.source() in parent.globalAlias) return parent.globalAlias[identNode.source()];
            }
        }
        parent = parent.parent;
    }
    return 0;
}

var addGlobalAlias = function (node, otherArgs) {
    // console.log("adding alias " + node.source() + " " + otherArgs.source() + " with type " + otherArgs.type);
    parent = node;
    while ((parent.type != "FunctionDeclaration" && parent.type != "FunctionExpression") && parent.parent != undefined){
        parent = parent.parent;
    }
    if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
        if (parent.globalAlias == undefined){
            parent.globalAlias = {};
            parent.globalAliasMap = {};
            // parent.globalVariables.__proto__.toString = overWriteToString;
        }

        if (node.source() in parent.globalAlias || Object.values(parent.globalAlias).map(function(e){return e.source()}).includes(node.source()) ) return;
        if (otherArgs != undefined){
            if (node.id) {
             parent.globalAlias[node.id.name] = otherArgs; // if passing from variable declaration, ie node = "a = 1"

            // keep an alias map to store the node form of the key, so that it could be added as a part of the local variable set while variable hoisting analysis. 
             parent.globalAliasMap[node.id.name] = node.id;
            } else {
                parent.globalAlias[node.source()] = otherArgs; // if being passed from assignment expression, ie node = a
                parent.globalAliasMap[node.source()] = node;
            }

            return;
        } else {
            console.log("[global but not alias]probably not going to enter this branch ever");
            parent.globalAlias["ERROR"] = (node.source());
        }
        try { localIndex = parent.localVariables.map(function(e){return e.source()}).indexOf(node.source());
        if (localIndex > -1) parent.localVariables.splice(localIndex, 1);
        } catch(err) {console.log("catch some error while aliasing: " + err)}
    }
}

var addGlobalWrites = function(node) {
    // check if belongs to list of cyclic
    if (Object.keys(propertyObj.cyclic).indexOf(node.source()) >= 0) return;
    parent = node.parent;
    while (parent != undefined){
        
        if (parent != undefined && ( parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression" )){
            if (parent.globalWrites == undefined){
                parent.globalWrites = [];
            }
            // if (node.id && parent.globalWrites.map(function(e){return e.source()}).indexOf(node.id.name) < 0) parent.globalWrites.push(node.id);
            if (parent.globalWrites.map(function(e){return e.source()}).indexOf(node.source()) < 0)
                parent.globalWrites.push(node);
            return;
        }   
        parent = parent.parent;
    }
}

var addGlobalReads = function(nodeArray) {
    nodeArray.forEach(function(node){
        _addGlobalReads(node);
    });
}

var _addGlobalReads = function(node) {
    // console.log("READS: " + node.source() + " " +  node.type);
    if (Object.keys(propertyObj.cyclic).indexOf(node.source()) >= 0) return;
    parent = node.parent;
    while (parent != undefined){
    
        if ( parent != undefined &&  (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression")){
            if (parent.globalReads == undefined){
                parent.globalReads = [];
            }
            if (node.id ) {
                if (parent.globalReads.map(function(e){return e.source()}).indexOf(node.id.name) < 0 && 
                    !(parent.globalWrites && parent.globalWrites.map(function(e){return e.source()}).indexOf(node.id.name) >= 0) && 
                    !(parent.globalAlias && Object.values(parent.globalAlias).map(function(e){return e.source();}).indexOf(node.id.name) >= 0)) 
                    parent.globalReads.push(node.id);
            }
            else if (parent.globalReads.map(function(e){return e.source()}).indexOf(node.source()) < 0 && 
                !(parent.globalWrites && parent.globalWrites.map(function(e){return e.source()}).indexOf(node.source()) >= 0) &&
                !(parent.globalAlias && Object.values(parent.globalAlias).map(function(e){return e.source();}).indexOf(node.source()) >= 0)) 
                parent.globalReads.push(node);
            return;
        }   
        parent = parent.parent;
    }
}


module.exports = {
    addGlobalReads: addGlobalReads,
    _addGlobalReads: _addGlobalReads,
    isGlobalAlias:isGlobalAlias,
    addGlobalWrites: addGlobalWrites,
    addLocalVariable: addLocalVariable,
    addGlobalAlias: addGlobalAlias,
    removeLocalVariables, removeLocalVariables,
    IsLocalVariable: IsLocalVariable

}