var getArgs = function (node) {
    var args = [];
    if (node.params.length > 0){
        node.params.forEach(function (param) {
            args.push(param.source())
        });
    }
    return args;
}

/* fetches the identifier from the node
 by recursively referencing the object in case of member expression
 or returns null if no identifier is found
 */
var getIdentifierFromMemberExpression = function (node) {
    // console.log("Finding indentifier from member " + node.source());
    if (node.type == "Identifier"){
        return node;
    }
    if (node.type == "MemberExpression"){
        return getIdentifierFromMemberExpression(node.object)
    }
    return null;
}

var getIdentifierFromAssignmentExpression = function (node) {
    // console.log("Finding Identifier from AssignmentExpression " + node.source());
    if (node.type == "Identifier"){
        return node;
    }
    if (node.type == "AssignmentExpression"){
        return getIdentifierFromAssignmentExpression(node.right)
    }
    return null;
}

var escapeRegExp = function(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|\']/g, "\\$&");
}


var overWriteToString = function () {
    var s = [];
    for (var k in this) {
        if (this.hasOwnProperty(k) && typeof this[k] != 'function') s.push(k + ':' + this[k]);
    }
    return '{' + s.join() + '}';
};

/** comparator for positions in the form { line: XXX, column: YYY } */
var comparePositions = function (a, b) {
    if (a.line !== b.line) {
        return a.line < b.line ? -1 : 1;
    }
    if (a.column !== b.column) {
        return a.column < b.column ? -1 : 1;
    }
    return 0;
};

function contains(start, end, pos) {
    var startsBefore = comparePositions(start, pos) <= 0;
    var endsAfter    = comparePositions(end,   pos) >= 0;
    return startsBefore && endsAfter;
}

var containsRange = function (start1, end1, start2, end2) {
    return contains(start1, end1, start2) && contains(start1, end1, end2);
}

var customMergeDeep = function (signature1, signature2) {
    // console.log("calling custom deep merge with keys: " + Object.keys(signature1));
    for (let key in signature1){
        // console.log("iterating through the key: " + key + Object.keys(signature1));;
        if (signature1[key] && signature1[key].constructor == Array) {
            if (signature2[key]) {
                for (let elem in signature2[key]) {
                    signature1[key].push(signature2[key][elem]);
                }
            }
        } else if (signature1[key] && signature1[key].constructor == Object){
            if (signature2[key]) {
                for (let elem in signature2[key]) {
                    signature1[key][elem] = signature2[key][elem];
                }
            }
        }
    }
}


var zip= rows=>rows[0].map((_,c)=>rows.map(row=>row[c]));


module.exports = {
    getArgs: getArgs,
    getIdentifierFromAssignmentExpression: getIdentifierFromAssignmentExpression,
    getIdentifierFromMemberExpression: getIdentifierFromMemberExpression,
    escapeRegExp: escapeRegExp,
    containsRange: containsRange,
    customMergeDeep: customMergeDeep
}