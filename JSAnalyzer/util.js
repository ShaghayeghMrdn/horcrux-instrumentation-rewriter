

var javascriptReservedWords = ['Promise','XMLHttpRequest','$','Array','abstract','arguments','await','boolean','break','byte','case','catch','char','class','const','continue','Date','debugger','define','default','delete','do','double','else','enum','eval','export','extends','false','Function','final','finally','float','for','Function','function','goto','if','implements','iframe','import','in','instanceof','int','interface','let','long','Map','native','new','null','Object','package','private','protected','public','RegExp','return','short','static','super','String','switch','Scanner','synchronized','this','throw','throws','transient','true','try','typeof','Uint8Array','var','void','volatile','while','with','yield', 'Maps', 'Sets', 'WeakMaps', 'WeakSets', 'Int8Array', 'Uint8Array','Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array','require','Number', 'Math','Date', 'JSON', 'PROXY','Reflect', 'ArrayBuffer','Symbol','Error'];

var getArgs = function (node) {
    var args = [];
    if (node.params.length > 0){
        node.params.forEach(function (param) {
            args.push(param.source())
        });
    }
    return args;
}

/* MAJOR TODO 
don't put the entire base variable in the logs 
only put the exact variable being modified
also do alias replacement and local variable replacement before 
creating the log array*/
var logReadsHelper = function(read, alias) {
    var outputArray = [];
    outputArray.push("`" + escapeRegExp(alias) + "`");
    outputArray.push(read.source());
    return outputArray;
}

var logWritesHelper = function(node, aliasValue) {
    /*Special handle for sequence expressions as their parenthesis get removed during source-ing. */
    if (node.right.type == "SequenceEpxression")
        var outputString = ",(" + node.right.source() + '),' + '\`' + aliasValue.replace(/[\`]/g, "\\$&") + '\`'; 
    var outputString = ",(" + node.right.source() + '),' + '\`' + aliasValue.replace(/[\`]/g, "\\$&") + '\`';
    return outputString;
}

var getFunctionIdentifier = function(node) {
    if (node == null) return null;
    parent = node.parent;
    while (parent != undefined){
        if (parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression") {
            return parent.loc;
        }  
        parent = parent.parent;
    }
    return null;
}

var getIdentifierFromGenericExpression = function (node) {
    if (node == null) return null;
    else if (node.type == "Identifier") {
        return node;
    }
    else if (node.type == "MemberExpression") return getIdentifierFromGenericExpression(node.object);
    else if (node.type == "AssignmentExpression") {
            return getIdentifierFromGenericExpression(node.right);
    }
    else if (node.type == "CallExpression") return getIdentifierFromGenericExpression(node.callee);

}

var getAllIdentifiersFromMemberExpression = function(node) {
    if (!node && node.type != "MemberExpression" && node.type != "CallExpression") return [];
    var properties = [];
    var recurseThroughProps = function(node){
        if (!node) return;
        if (node.type == "Identifier")
            properties.push(node);
        else if (node.type == "MemberExpression") {
            recurseThroughProps(node.object); 
            recurseThroughProps(node.property);
        } else if (node.type == "CallExpression") {
            recurseThroughProps(node.callee);
            node.arguments.forEach(function(arg){
                recurseThroughProps(arg);
            })
        }
    }
    recurseThroughProps(node);
    return properties;
}

var checkForWindowObject = function(arrayOfIdentifiers){
    if (arrayOfIdentifiers == null) return 0;
    if (arrayOfIdentifiers.length == 0 ) return 0;
    arrayOfIdentifiers.forEach(function(identifier){
        if (identifier.source() == "window") return 1;
    });
    return 0;
}

var checkIfReservedWord = function(node){
    if (!node) return 0;
    return  javascriptReservedWords.includes(node.source());
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
    else if (node.type == "MemberExpression"){
        return getIdentifierFromMemberExpression(node.object)
    } else {
        return node;
    }
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

var escapeRegExp2 = function(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|\']/g, "\\$&");
}

var escapeRegExp = function(str) {
    return str.replace(/[\`]/g, "\\$&");
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
    logReadsHelper: logReadsHelper,
    logWritesHelper: logWritesHelper,
    getAllIdentifiersFromMemberExpression:getAllIdentifiersFromMemberExpression,
    getIdentifierFromAssignmentExpression: getIdentifierFromAssignmentExpression,
    getIdentifierFromMemberExpression: getIdentifierFromMemberExpression,
    getIdentifierFromGenericExpression: getIdentifierFromGenericExpression,
    getFunctionIdentifier: getFunctionIdentifier,
    escapeRegExp: escapeRegExp,
    containsRange: containsRange,
    customMergeDeep: customMergeDeep,
    checkForWindowObject: checkForWindowObject,
    checkIfReservedWord:checkIfReservedWord
}