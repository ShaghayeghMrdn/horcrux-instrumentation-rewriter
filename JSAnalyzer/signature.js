var scope = require('./scopeAnalyzer.js');

var _handleReads = function(node){
        /*
    The following read types are available for the assignment expression RHS:
    - Identifier
    - Literal (ignored)
    - CallExpression
    - Object Expression 
    - Logical Expression
    - Binary Expression
    - Unary expression
    - New expression
    - Array expression
    - Memberexpression
      Function Expression
      New Expression
      updateExpression

   */
    var readArray = [];

    var readRecursively = function(node){
        // console.log("checking for " + node.source() + "with type " + node.type)
        if (node == null || node.type == "Literal")
            return;
        if (node.type == "Identifier") {
            readArray.push(node)
            return;
        } /*else if (node.type == "BinaryExpression" || node.type == "LogicalExpression") {
            readRecursively(node.left);
            readRecursively(node.right);
        }*/ else if (node.type == "MemberExpression") {
            readRecursively(node.object);
            if (node.computed)
                readRecursively(node.property);
        } else if (node.type == "UnaryExpression" || node.type == "UpdateExpression") {
                readRecursively(node.argument);
        } else if (node.type == "ConditionalExpression") {
            readRecursively(node.test);
            readRecursively(node.consequent);
            readRecursively(node.alternate);
        } else if (node.type == "ObjectExpression") {
            node.properties.forEach(function(elem){
                readRecursively(elem);
            });
            // readArray.push(node);
        } else if (node.type == "ArrayExpression") {
            node.elements.forEach(function (elem) {
                readRecursively(elem);
            });
            //Excluding call expression check here because it is already accounted for the in the main loop index.js
        } else if (/*node.type == "CallExpression" ||*/ node.type == "NewExpression") {
            node.arguments.forEach(function(arg){
                readRecursively(arg);
            });
        } else if (node.type == "FunctionExpression") {
            node.params.forEach(function(arg){
                readRecursively(arg);
            })
        } else if (node.type == "AssignmentExpression"){
            /* DOn't need to handle this case, as the right hand side assignment expression will handle it's own reads during the assignment expression node type callback*/
            // readArray = handleAssignmentExpressions(node);
        } else if (node.type == "SequenceExpression"){
            node.expressions.forEach(function(exp){
                readRecursively(exp);
            })
        }
    }

    readRecursively(node);
    return readArray; 
}


var handleReads = function(node) {
    // console.log("handling for reads: " +  node.source() + " " + node.type);

    var readArray = _handleReads(node);
    // console.log("readArray returned" + readArray.map(function(e){ return e.source()}));
    // console.log(readArray);
    if (readArray == null) return [];
    var globalReads = [];
    readArray.forEach(function(read){
        if (scope.IsLocalVariable(read) > 0  ) {
            globalReads.push(read);
        }

    });
    return globalReads;
}

module.exports = {
    handleReads: handleReads
}