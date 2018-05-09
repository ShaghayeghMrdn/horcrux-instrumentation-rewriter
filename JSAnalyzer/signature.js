var scope = require('./scopeAnalyzer.js');

var handleBinaryandLogical = function(node) {
    if (node == undefined || node.type == "AssignmentExpression")
        return [];
    var reads = [];
    // console.log("Handling binary and logical:" + node.source() + "with properties: " + Object.keys(node));
    if (node.type == "Identifier" || node.type == "MemberExpression") {
        reads.push(node)
        return reads
    } else if (node.type == "ObjectExpression") {
        reads = handleObjectExpressions(node);
        return reads;
    }

    reads = reads.concat(handleBinaryandLogical(node.left));
    reads = reads.concat(handleBinaryandLogical(node.right));

    return reads;
}

var handleAssignmentExpressions = function(node){
    var reads = [];
    if (node.type != "AssignmentExpression")
        reads.push(node);
    else 
        reads = reads.concat(handleAssignmentExpressions(node.right))
    return reads;
}

var handleObjectExpressions = function(node) {
    var reads = [];

    node.properties.forEach(function(elem){
        if (elem.value.type == "Identifier")
            reads.push(elem.value)
    });

    return reads;
}

var handleMemberExpression = function(node) {
    var reads = [];

    if (node.property.type == "Identifier")
        reads.push(node.property);

    if (node.object.type == "Identifier") {
        reads.push(node.object);
        return reads;
    } else if (node.object.type == "MemberExpression") {
        reads = reads.concat(handleMemberExpression(node.object));
        return reads;
    }
    return reads;
}

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

    First let's slice out all the variables read.
    Then pass these through the local/global analysis 

    */

    // console.log("Called read array handler" + node.source());
    var readArray = [];
    if (node.type == "Identifier")
        readArray.push(node)
    else if (node.type == "BinaryExpression" || node.type == "LogicalExpression") {
        readArray = handleBinaryandLogical(node)
    }
    else if (node.type == "ObjectExpression")
        readArray = handleObjectExpressions(node)
    else if (node.type == "UnaryExpression") {
        if (node.argument.type == "Identifier")
            readArray.push(node.argument);
    } else if (node.type == "ConditionalExpression") {
        readArray = handleBinaryandLogical(node.test);
        readArray = readArray.concat(_handleReads(node.consequent));
        readArray = readArray.concat(_handleReads(node.alternate));
    } else if (node.type == "MemberExpression") {
        readArray.push(node);
    } else if (node.type == "ArrayExpression") {
        node.elements.forEach(function (elem) {
                readArray.push(elem);
        });
    } else if (node.type == "CallExpression") {
        readArray.push(node);
    } else if (node.type == "AssignmentExpression"){
        // readArray = handleAssignmentExpressions(node);
    }
    return readArray; 
}


var handleReads = function(node) {
    // console.log("handling for reads: " +  node.source() + " " + node.type);

    var readArray = _handleReads(node);
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