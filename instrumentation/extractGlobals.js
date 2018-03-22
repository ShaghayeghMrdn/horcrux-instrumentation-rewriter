


var falafel = require('falafel');
var fondue = require('../modifiedFondue/index.js');
var beautify = require('js-beautify');
var vm = require('vm');
var fs = require('fs');

src = ' \
var global; \
function local(){ \
    var a = "new local variable"; \
    aliasGlobal = global; \
    aliasGlobal = "some value" \
}\
'

src2 = ' \
    var global;\
    var global2 = {}; \
    function outer(arg1, arg2){ \
        var somevar = 3; \
        var b = arg1; \
        var anotherVar = global2; \
        console.log("going to set first global variable"); \
        anotherVar.x = arg1; \
        return function inner() {\
            var someInnerVar; \
            somevar = b; \
            console.log("executing inner funciton"); \
            someInnerVar = global2; \
            someInnerVar.y = 4; \
        } \
    } \
    \
    \
    a = outer(1,2); \
    a();\
'

performance = {}
performance.timing = {}

if (process.argv[2] == "falafel"){
    prevNpde = null;
    falafel(src2, function(node){
        // console.log("node source is: " + node.source() + " " + node.type + " " + Object.keys(node));
        if (node.parent != undefined) { 
            // console.log("it's parent is : " + node.parent.source() + " with type: " + node.parent.type);
        }
        if (node.type == "AssignmentExpression"){
            // console.log(node.left);
            if (node.left.type == "Identifier"){
                // console.log("variable: " + node.left.source() + "is local: " + checkIfLocal(node, node.left.source()))
            }
        } 
        if(node.type == "MemberExpression"){
            // console.log(node.computed + " "  + node.object + " " + node.property);
        }
        if (node.type == "VariableDeclarator"){
            if ((ind = node.source().indexOf("=")) > 0) {
                // console.log("Variable found is  : " + node.source().substring(0,ind).trim())
                variable = node.source().substring(0,ind).trim();
                attachLocals(node, variable);
            } else {
                // console.log("variable found is :" + node.source());
                variable = node.source();
                attachLocals(node, variable);
            }
        }
        if (node.type == "FunctionDeclaration"){
            console.log("params: " + list);
        }
        prevNode = node;
    });
}

function attachLocals(node, variable){
    console.log("current node: " + node.type + "with parent " + node.parent.type)
    parent = node.parent;
    while (parent.type != "FunctionDeclaration" && parent.parent != undefined){
        parent = parent.parent;
    }
    if (parent.type == "FunctionDeclaration"){
        if (parent.variables == undefined){
            parent.variables = []
        }
        parent.variables.push(variable)
    }

}

function checkIfLocal(node, variable){
    console.log("checking variable for localness: " + variable)
    parent = node.parent;
    while (parent != undefined && parent.parent != undefined){
        if (parent.variables != undefined){
            console.log("checking inside: " + parent.variables);
            if (parent.variables.includes(variable)){
                return true;
            }
        }
        parent = parent.parent;
    }
    return false;
}

function getArgs(func) {
  // First match everything inside the function argument parens.
  var args = func.source().match(/function\s.*?\(([^)]*)\)/)[1];
 
  // Split the arguments string into an array comma delimited.
  return args.split(",").map(function(arg) {
    // Ensure no inline comments are parsed and trim the whitespace.
    return arg.replace(/\/\*.*\*\//, "").trim();
  }).filter(function(arg) {
    // Ensure no undefineds are added.
    return arg;
  });
}


instrumented = fondue.instrument(src2);
fs.writeFileSync("beauty.js", beautify.js_beautify(instrumented.toString()));
var sandbox = { __tracer: undefined, console: console, require: require, performance : {timing:{loadEventEnd:0}} };
var output = vm.runInNewContext(instrumented, sandbox);
var tracer = sandbox.__tracer;


var functions = {};
var uniqueFunctions = [];
var callsites = {}
var ids = [];
var nodesHandle = tracer.trackNodes();
var MAXRESULT = 100000;
tracer.newNodes(nodesHandle).forEach(function (n) {
    if (n.type === 'function') {
        functions[n.id] = n;
        ids.push(n.id);
    } else if (n.type == 'callsite'){
        callsites[n.id] = n;    
    }
});

var logHandle = tracer.trackLogs({ids: ids});
var invocations = tracer.logDelta(logHandle, MAXRESULT);

console.log("Number of functions: " + Object.keys(functions).length);
console.log("Number of invocations: " + JSON.stringify(invocations));

var modifiedFunctionCounter = 0
invocations.forEach(function(entry){
    if (entry.globalDelta){
        if (entry.globalDelta[2] - entry.globalDelta[1] > 1){
            console.log(JSON.stringify(entry));
            modifiedFunctionCounter++;
        }
    }
    if (uniqueFunctions.indexOf(entry.nodeId) < 0){
        uniqueFunctions.push(entry.nodeId);
    }
});

