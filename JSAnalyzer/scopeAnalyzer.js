

var util = require('./util.js');



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

    // var alias = getAliasFromActual(node);

    if (parentNode.globalWrites){
        for (let i = parentNode.globalWrites.length-1; i >= 0; i--){
            if (IsLocalVariable(parentNode.globalWrites[i]) <=0 )
                parentNode.globalWrites.splice(i, 1);
        }
    }

    if (parentNode.globalReads){
        for (let i = parentNode.globalReads.length-1; i >= 0; i--){
            if (IsLocalVariable(parentNode.globalReads[i]) <=0 )
                parentNode.globalReads.splice(i, 1);
        }
    }

    if (parentNode.globalAlias) {
        for (let elem in parentNode.globalAlias ) {
            if (IsLocalVariable(parentNode.globalAlias[elem]) <=0 )
                delete parentNode.globalAlias[elem];
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
        if (node.id && parent.localVariables.map(function(e){return e.source()}).indexOf(node.id.name) < 0) parent.localVariables.push(node.id);
        else if (parent.localVariables.map(function(e){return e.source()}).indexOf(node.source()) < 0) parent.localVariables.push(node);
        
        // remove variable from the signature
        removeLocalVariables(parent);
    }

}

/* 
Returns 0 for local and -1 for non variables (literals, integers etc)
Returns 1 for global
*/
var IsLocalVariable = function (node){

    if (node == null || typeof(node) == "undefined") return 0;


    else if (node.type == "ConditionalExpression"){
        return (IsLocalVariable(node.consequent) || IsLocalVariable(node.alternate))
    } else if (node.type == "ObjectExpression" || node.type == "Literal" || 
        node.type == "NewExpression" || node.type == "BinaryExpression" || node.type == "LogicalExpression"
        || node.type == "ArrayExpression" || node.type == "" || node.type == "FunctionExpression" || node.type == "CallExpression"){     // TODO handle all the dom modifications: For now the callexpression like document.getElementbyId('') will be marked as local. 
        return 0;
    } else if (node.type == "UnaryExpression")
        return IsLocalVariable(node.argument)
    else if (node.type == "MemberExpression")
        node = util.getIdentifierFromMemberExpression(node);
    else if (node.type == "AssignmentExpression")
        node = util.getIdentifierFromAssignmentExpression(node);

    if (node == null ) return 0;
    parent = node.parent;
    while (parent != undefined && parent.parent != undefined){
        if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression"){
            functionArguments = util.getArgs(parent);
            if (parent.localVariables == undefined) parent.localVariables = []
            if (parent.localVariables.map(function(e){return e.source()}).includes(node.name) || functionArguments.includes(node.name)){
                return 0;
            }
        }
        parent = parent.parent;
    }
    // console.log("variable: " + node.source() + "is not a local : ");
    return 1;
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
            // parent.globalVariables.__proto__.toString = overWriteToString;
        }

        if (node.source() in parent.globalAlias || Object.values(parent.globalAlias).map(function(e){return e.source()}).includes(node.source()) ) return;
        if (otherArgs != undefined){
            if (node.id) parent.globalAlias[node.id.name] = otherArgs; // if passing from variable declaration, ie node = "a = 1"
            else parent.globalAlias[node.source()] = otherArgs; // if being passed from assignment expression, ie node = a
        } else {
            console.log("[global but not alias]probably not going to enter this branch ever");
            parent.globalAlias["ERROR"] = (node.source());
        }
        try { localIndex = parent.localVariables.map(function(e){return e.source()}).indexOf(node.source());
        if (localIndex > -1) parent.localVariables.splice(localIndex, 1);
        } catch(err) {}
    }
}

var addGlobalWrites = function(node) {
    parent = node.parent;
    while (parent != undefined){
        
        if (parent != undefined && ( parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression" )){
            if (parent.globalWrites == undefined){
                parent.globalWrites = [];
            }
            // if (node.id && parent.globalWrites.map(function(e){return e.source()}).indexOf(node.id.name) < 0) parent.globalWrites.push(node.id);
            if (parent.globalWrites.map(function(e){return e.source()}).indexOf(node.source()) < 0) parent.globalWrites.push(Object.assign({}, node));
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
    parent = node.parent;
    while (parent != undefined){
    
        if ( parent != undefined &&  (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression")){
            if (parent.globalReads == undefined){
                parent.globalReads = [];
            }
            if (node.id && parent.globalReads.map(function(e){return e.source()}).indexOf(node.id.name) < 0) parent.globalReads.push(node.id);
            else if (parent.globalReads.map(function(e){return e.source()}).indexOf(node.source()) < 0) parent.globalReads.push(node);
            return;
        }   
        parent = parent.parent;
    }
}


module.exports = {
    addGlobalReads: addGlobalReads,
    addGlobalWrites: addGlobalWrites,
    addLocalVariable: addLocalVariable,
    addGlobalAlias: addGlobalAlias,
    removeLocalVariables, removeLocalVariables,
    IsLocalVariable: IsLocalVariable

}