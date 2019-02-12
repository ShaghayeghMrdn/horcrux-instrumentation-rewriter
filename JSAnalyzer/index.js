

var falafel = require('falafel');
var falafelMap = require('falafel-map');
var fs = require('fs');
var basename = require('path').basename;
var esprima = require('esprima');
var mergeDeep = require('deepmerge');
var scope = require('./scopeAnalyzer.js');
var util = require('./util.js');
var signature = require('./signature.js');
var properties = require ("properties");
var e2eTesting = false;
var path = require('path');
var scriptName = path.basename(__filename);
var functionCounter = 0;
// Use to store simple function names indexed by their complex counterparts
var simpleFunctions = {};
var propertyObj = {};
const PATH_TO_PROPERTIES = __dirname + "/DOMHelper.ini";
properties.parse(PATH_TO_PROPERTIES, {path: true, sections: true}, function(err, obj){ propertyObj = obj ;})

var logPrefix;
var _oldLogger = console.log;
console.log = function(arg, filename = __filename){
	filename = filename.split('/').pop()
	process.stdout.write("[" + filename + "]");
	_oldLogger(arg);
}
// adds keys from options to defaultOptions, overwriting on conflicts & returning defaultOptions
function mergeInto(options, defaultOptions) {
	for (var key in options) {
		if (options[key] !== undefined) {
			defaultOptions[key] = options[key];
		}
	}
	return defaultOptions;
}

function template(s, vars) {
	for (var p in vars) {
		s = s.replace(new RegExp('{' + p + '}', 'g'), vars[p]);
	}
	return s;
}

function topKFromRTI(rti, k){
	var ignoreRTI = ["program", "idle", "garbage collector"]
	var ignoreURLS = ["extensions::"]
	var sortedRTI = rti.sort((a,b)=>{return b.self - a.self});
	var relevantRTI = [], percent =0, rtiLength = sortedRTI.length, rtiCounter =0;
	for (var rtiIter = 0; rtiIter < rtiLength && percent <= k ; rtiIter++) {
		var curFn = sortedRTI[rtiIter]
		if (ignoreRTI.filter(fn => curFn.functionName.indexOf(fn)>=0).length > 0 || 
			ignoreURLS.filter(url => curFn.url.indexOf(url)>=0).length>0)
			continue;
		relevantRTI.push(curFn);
		rtiCounter++;
		percent = (rtiCounter/rtiLength)*100;
	}
	// console.log(rtiCounter +  "of " rtiLength + "gives us " + JSON.stringify(relevantRTI));
	return relevantRTI;
}	

function userDefinedFunctions(rti){
	return rti.map((node)=>{if (node.url.startsWith("http")) return node}).filter((node=>{ if (node) return node}));
}

/**
 * options:
 *   name (__tracer): name for the global tracer object
 *   nodejs (false): true to enable Node.js-specific functionality
 *   maxInvocationsPerTick (4096): stop collecting trace information for a tick
 *       with more than this many invocations
 **/
function instrumentationPrefix(options) {
	options = mergeInto(options, {
		name: '__tracer',
		nodejs: false,
		maxInvocationsPerTick: 28192,
	});
	// the inline comments below are markers for building the browser version of fondue
	var tracerSource = /*tracer.js{*/fs.readFileSync(__dirname + '/tracer.js', 'utf8')/*}tracer.js*/;
	if (!options.proxyName)
		options.proxyName = options.name +"PROXY";
	return template(tracerSource, {
		name: options.name,
		version: JSON.stringify(require('./package.json').version),
		nodejs: options.nodejs,
		maxInvocationsPerTick: options.maxInvocationsPerTick,
		e2eTesting: options.e2eTesting,
		proxyName: options.proxyName
	});
}

/**
 * options:
 *   path (<anonymous>): path of the source being instrumented
 *       (should be unique if multiple instrumented files are to be run together)
 *   include_prefix (true): include the instrumentation thunk
 *   tracer_name (__tracer): name for the global tracer object
 *   nodejs (false): true to enable Node.js-specific functionality
 *   maxInvocationsPerTick (4096): stop collecting trace information for a tick
 *       with more than this many invocations
 **/
function instrument(src, options) {
	// Since the fondue module is loaded once, re initialize the counter for every new src file
	functionCounter = 0;
	logPrefix = options.origPath;
	// The following code snippet incorporates runtime information if provided
	if (options.rti) {
		var percent = 20;
		console.log("[instrument] List of functions to be instrumented " + JSON.stringify(options.rti.map(el=> el.functionName)));

		var _logStringRTI = options.rti.map((el)=>{ if(el.url.endsWith(options.origPath))return el.functionName}).filter(fn => fn != null);
		options.myRti = options.rti.map((el)=>{ if(el.url.endsWith(options.origPath))return el}).filter(fn => fn != null);
		console.log("[instrument] Only instrumenting the following functions from the current script: " + options.origPath + " : " + JSON.stringify(_logStringRTI));
	}

	var defaultOptions = {
		include_prefix: true,
		tracer_name: '__tracer',
		e2eTesting: false,
	};
	e2eTesting = options.e2eTesting;
	options = mergeInto(options, defaultOptions);
	var prefix = '', shebang = '', output, m;

	if (m = /^(#![^\n]+)\n/.exec(src)) {
		shebang = m[1];
		src = src.slice(shebang.length);
	}
	// console.log(options);
	options.proxyName = options.tracer_name +"PROXY";
	if (options.include_prefix) {
		prefix += instrumentationPrefix(options);
		options.prefix = prefix;
		// console.log(options.prefix);
	}

	if (src.indexOf("/*theseus" + " instrument: false */") !== -1) {
		output = shebang + prefix + src;
	} else {
		var m = traceFilter(src, options);
		output = {
			map: m.map,
			toString: function () {
				return shebang + m.toString();
			},
		};
	}

	return output;
}



var makeId = function (type, path, loc) {
	if (e2eTesting) {
		// console.log(functionCounter);
		var origPath = path + '-'
	     + type + '-'
	     + loc.start.line + '-'
	     + loc.start.column + '-'
	     + loc.end.line + '-'
	     + loc.end.column;
	    if (simpleFunctions[origPath])
	    	return simpleFunctions[origPath];
		var id = "function_" + functionCounter;
		functionCounter = functionCounter + 1;
		// console.log( " function counter is " + functionCounter)
		simpleFunctions[origPath] = id;
		return id;
	}
	return path + '-'
	     + type + '-'
	     + loc.start.line + '-'
	     + loc.start.column + '-'
	     + loc.end.line + '-'
	     + loc.end.column;
};

var traceFilter = function (content, options) {
	// console.log(options)
	if (content.trim() === '') {
		return content;
	}
	var defaultOptions = {
		path: '<anonymous>',
		prefix: '',
		tracer_name: '__tracer',
		trace_function_entry: true,
		trace_function_creation: false,
		trace_function_calls: false,
		trace_branches: false,
		trace_switches: false,
		trace_loops: false,
		source_map: false,
		execution_cache_toggle : 0,
	};
	options = mergeInto(options, defaultOptions);
	// console.log(options);

	var processed = content;

	try {
		var fala, update, sourceNodes, functionNameToLocation = {}; // Dictionary: key is function name, value is an array containing all the locations it was defined. 
		var uncacheableFunctions = util.uncacheableFunctions;

		var ASTNodes = []; // List of all the nodes in the abstract syntax tree
		var ASTSourceMap = new Map();
		var functionToCallees = {};
		var fala = function () {
			var m = falafel.apply(this, arguments);
			return {
				map: function () { return '' },
				chunks: m.chunks,
				toString: function () { return m.toString() },
			};
		};
		var update = function (node) {
			node.update(Array.prototype.slice.call(arguments, 1).join(''));
		};
		var sourceNodes = function (node) {
			return node.source();
		};

		var addCalleesToCaller = function(node){

			// This scenario will be handled in the second pass itself, as this function is declared and invoked at the same time. 
			if (node.callee.type == "FunctionExpression")
				return

			parent = node.parent;
			while (parent != undefined ) {
				if ((parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression")){
					var functionName;
					if (parent.id) functionName = parent.id.name;
					else {
						if (parent.parent.type == "VariableDeclarator")
							functionName = parent.parent.id.name;
						else if (parent.parent.type == "AssignmentExpression") {
							functionName = parent.parent.left.source();
						}				
					}
					if (functionName){
						if (functionToCallees[functionName] == undefined)
							functionToCallees[functionName] = [];
						if (functionToCallees[functionName].indexOf(node.callee.source()) < 0)
							functionToCallees[functionName].push(node.callee.source());
					}
					return;
				}
				parent = parent.parent;
			}
		}

		var childrenOfConditionalExpression = function(node) {
			parent = node.parent;
			while (parent != undefined ) {
				if (parent.type == "ConditionalExpression") return true;
				parent = parent.parent;
			}
			return false;
		}

		// Handle propagation for those callees with multiple declaration sites TODO
		var propogateSignature = function (node) {
			if (node == undefined || node == null) return;

			var functionName;
			if (node.id) functionName = node.id.name;
			else {
				if (node.parent.type == "VariableDeclarator")
					functionName = node.parent.id.name;
				else if (node.parent.type == "AssignmentExpression") {
					functionName = node.parent.left.source();
				}				
			}
			_propogateSignature(functionName, node);
		}

		var _propogateSignature = function(functionName, node) {
			if (functionName && functionToCallees[functionName]){
				functionToCallees[functionName].forEach(function(callee){
					if (functionName != callee && !( functionToCallees[callee] && functionToCallees[callee].indexOf(functionName) >= 0) ) {
						var metadata;
						if (functionNameToLocation[callee]){
							metadata = makeId('function', options.path, functionNameToLocation[callee][0]);
						}
						// console.log("metadata is " + metadata + " propogating: " + functionToMetadata[metadata]);
						if (metadata) {
							util.customMergeDeep(functionToMetadata[makeId('function', options.path, node.loc)],functionToMetadata[metadata])
						}
						_propogateSignature(callee, node);
					}
				})
			}
		}

		var printFriendlyAlias = function(obj) {
			var output = {};
			for (let key in obj){
				output[key] = obj[key].source();
			}

			return output;
		}

		var markFunctionUnCacheable = function (node) {
		    parent = node.parent;
		    while (parent != undefined){
		        
		        if (parent != undefined && ( parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression" )){
		        	parent.uncacheable = true;
		            return;
		        }   
		        parent = parent.parent;
		    }
		}

		var isNonDeterministc = function(src) {
			return ((src.indexOf("random") >= 0) || (src.indexOf("Date") >= 0));
		}

		var rewriteArguments = function(argReads){
			argReads.forEach((arg)=>{
				var proxyPrefix = "argP";
				var argIndex = arg.ind;
				var argNode = arg.val;
				update(argNode, "argP"+argIndex);
			})
		}

		var _insertArgumentProxy = function(argumentObj){
			var outStr ='var argumentProxy = new Proxy(arguments,' + options.tracer_name +'.argProxyHandler);\n';
			for (var i=0;i<argumentObj.length;i++){
				let argProxyStr = "var argP" + i + " = argumentProxy[" + i + "];\n"
				outStr+=argProxyStr;
			}
			return outStr;
		}

		var insertArgumentProxy = function(fnNode){
			if (!fnNode.params.length) return;
			var argProxyStr = _insertArgumentProxy(fnNode.params);
			update(fnNode.body, argProxyStr, fnNode.body.source());
		}

		// console.log(esprima.parse(content));
		m = fala({
			source: content,
			loc: true,
			range: true,
			sourceFilename: options.sourceFilename || options.path,
			generatedFilename: options.generatedFilename || options.path,
			// tolerant: true,
		}, function (node) {
			var loc = {
				path: options.path,
				start: node.loc.start,
				end: node.loc.end
			};
			// Add every node to the list
			ASTNodes.push(node);
			ASTSourceMap.set(node, node.source());

			if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
				if (options.timing) {
					var index = makeId('function', options.path, node.loc);
				}
				// console.log(node.parent.source());
				var functionName;
				if (node.id) { 
					functionName = node.id.name;

					// also add as local variable for the parent scope. 
					// Hacky code: modifying the parent link, should never do that. 
					node.id.parent = node.parent;
					scope.addLocalVariable(node);
				}
				else {
					if (node.parent.type == "VariableDeclarator")
						functionName = node.parent.id.name;
					else if (node.parent.type == "AssignmentExpression") {
						functionName = node.parent.left.source();
					}				
				}

				/*
				function name to location is used during signature propogation 
				and there can be commented out as long as the code
				for enabling signature propagation is commented out.
				*/
				// if (functionName){
				// 	if (!(functionNameToLocation[functionName]))
				// 		functionNameToLocation[functionName] = [];
				// 	console.log(functionNameToLocation[functionName])
				// 	functionNameToLocation[functionName].push(node.loc);
				// }	

			} else if (node.type == "ForInStatement" || node.type == "ForOfStatement"){
				if (node.left.type == "Identifier")
					scope.addLocalVariable(node.left);

			} else if (node.type == "TryStatement") {
				if (node.handlers[0] && node.handlers[0].param)
					scope.addLocalVariable(node.handlers[0].param);
			} else if (node.type == "IfStatement") {
					var readArray = [];
					var {readArray, local, argReads, antiLocal} = signature.handleReads(node.test);
					scope.addGlobalReads(readArray);


			} else if (node.type === 'VariableDeclarator') {
						scope.addLocalVariable(node);

			// Handles any global variable being assigned any value
			// or a local variable becoming an alias of a global variable
			} else if (node.type == "AssignmentExpression"){

				// dont' handle those assignment expressions which are a child of conditional expressions as they 
				// may or may not get executed
				// TODO Handle even these assignment expressions 
				// if (childrenOfConditionalExpression(node)) {
				// 	//do no-op
				// }
				// if (scope.IsLocalVariable(node.left) > 0){
				// 	// addGlobalVariable(node.left);
				// 	scope.addGlobalWrites(node.left);

				// } else if (scope.IsLocalVariable(node.right) > 0){
				// 	// if (node.right.type == "Identifier" || node.right.type == "MemberExpression")
				// 	// if (!options.useProxy || (options.useProxy && node.right.source() != "window")) 
				// 		/* Just read the comment on line number 320 above */
				// 		// scope.addGlobalAlias(node.left, node.right);
				// 		scope.addLocalVariable(node.left);
				// } else {
				// 	scope.addLocalVariable(node.left);
				// }

				scope.addGlobalReads(signature.handleReads(node.right).readArray);
			} else if (node.type == "CallExpression") {
				
				// Check if the arguments passed are global or not
				if (node.arguments) {
					var globalReads = [];
					node.arguments.forEach(function(param){
						globalReads = globalReads.concat(signature.handleReads(param).readArray);
					});
					// add global arguments to read set
					scope.addGlobalReads(globalReads);
				}

				// add global arguments to the write set as well (conservative approach) - the value may or may not be written to
				// globalReads.forEach(function(read){
				// 	scope.addGlobalWrites(read);
				// });

				// addCalleesToCaller(node);

				/*
				Handle DOM standalone expressions which have expression statement as their parent
				or sequence expression as their parent. 
				*/
				var globalDOMMethods = Object.keys(propertyObj.global);
				var localDOMMethods = Object.keys(propertyObj.local);
				var isLocal = false;

				if (node.parent.type == "SequenceExpression" || node.parent.type == "ExpressionStatement") {

					// First check if a local DOM method
					localDOMMethods.forEach(function(DOMMethod){
						if (node.callee.source().toLowerCase().includes(DOMMethod.toLowerCase()))
							isLocal = true;
					});
					globalDOMMethods.forEach(function(DOMMethod){
						if (!isLocal && node.callee.source().toLowerCase().includes(DOMMethod.toLowerCase())) {
							scope.addGlobalWrites(node);
							var _functionId = util.getFunctionIdentifier(node);
							if (_functionId) {
								var functionId = makeId('function', options.path, _functionId);
								if (uncacheableFunctions.indexOf(functionId) < 0){

									// uncacheableFunctions.push(functionId);
									}
								}
							}
					});
				}
			} 
		});

		if (options.myRti) {
			var instrumentedNodes = [], remainingRTINodes =[];
			options.myRti.forEach((rtiNode)=>{
				var matchedNode = util.matchASTNodewithRTINode(rtiNode, ASTNodes, options, ASTSourceMap);
				if (matchedNode){
					instrumentedNodes.push(matchedNode);
				} else
				remainingRTINodes.push(rtiNode);
			})

			if (remainingRTINodes.length){
				//Throw error since not all rti nodes found a match. 
				console.error("Match not found for " + remainingRTINodes.length + " number of RTI nodes");
				console.error("Quiting instrumentation");
				return processed;
			}
		}

		/* In this second iteration of the AST we will freeze the debug info 
		ie all the global writes, reads and aliases 
		*/
		ASTNodes.forEach(function(node) {

			if (node.type == "FunctionDeclaration" || node.type == "FunctionExpression") {
				if (node.globalReads) node.globalReads = node.globalReads.map(function(e){ return e.source();});
				if (node.globalWrites) node.globalWrites = node.globalWrites.map(function(e){ return e.source();});
				if (node.globalAlias) node.globalAlias = printFriendlyAlias(node.globalAlias);
				var index = makeId('function', options.path, node.loc);

				if (isNonDeterministc(node.source()) && uncacheableFunctions.indexOf(node) < 0)
					uncacheableFunctions.push(node);

				if (options.myRti && instrumentedNodes.indexOf(node)<0)
					uncacheableFunctions.push(node)
			}
		});

		/*
			The 3rd and final iteration over the AST to actually instrument
			logging code
		*/
		ASTNodes.forEach(function(node) {
			// console.log("current node: " + node.source() + " " + node.type);
			if (node.type === "Program") { 
				// console.log(node.source())
				update(node, options.prefix,
					sourceNodes(node))
			} else if ( (node.type === 'VariableDeclaration' || node.type === 'VariableDeclarator')) {
				if (node.type == "VariableDeclarator"){
					var _functionId = util.getFunctionIdentifier(node);
					if (_functionId){
						if (node.init) {
							var {readArray, local, argReads, antiLocal} = signature.handleReads(node.init);
							if (options.useProxy) {
								rewriteArguments(argReads);
								readArray.forEach(function(read){
									if (util.checkIfReservedWord(read)) return;
									if (read.source() == "window")
										update(read, options.proxyName)
									else
										update(read, options.proxyName, '.', read.source());
								})
							}
						} 
					}

			    }
			    // update(node, sourceNodes(node));
			
			// Handles any global variable being assigned any value
			// or a local variable becoming an alias of a global variable
			} else if (node.type == "AssignmentExpression" || node.type == "LogicalExpression" || node.type == "BinaryExpression"){
				var _functionId = util.getFunctionIdentifier(node);
				if (_functionId) {
					var {readArray,local,argReads, antiLocal} = signature.handleReads(node.right);
					var functionId = makeId('function', options.path, _functionId);
				// 	if (uncacheableFunctions.indexOf(functionId) >= 0) return;
				    rewriteArguments(argReads);
					readArray.forEach(function(read){
						var newRead = util.logReadsHelper(read, scope.checkAndReplaceAlias(read));
						// console.log(read.source());
						if (options.caching)
							update(read, options.tracer_name, '.logRead(', JSON.stringify(functionId),',[', newRead, '],[', util.getAllIdentifiersFromMemberExpression(read),'])');
						if (options.useProxy) {
							if (util.checkIfReservedWord(read)) return;
							if (read.source() == "window")
									update(read, options.proxyName)
								else
									update(read, options.proxyName, '.', read.source());
						}
					});

					var {readArray, local,argReads, antiLocal} = signature.handleReads(node.left);
					/*
					If writing to anti local, mark the function as uncacheable.
					*/
					// if (node.type == "AssignmentExpression" && antiLocal.length) {
					// 	uncacheableFunctions.push(functionId);
					// 	return;
					// }
					rewriteArguments(argReads);
					readArray.forEach(function(read){
						if (util.checkIfReservedWord(read)) return;
						if (read.source() == "window")
							update(read, options.proxyName)
						else
							update(read, options.proxyName, '.', read.source());
					});

				}

				// Detect if the __proto__ is being set to a proxy object
				if (node.type == "AssignmentExpression" && node.left.source().indexOf("__proto__") >= 0) {
					update(node, node.left.source(), node.operator, options.tracer_name, '.handleProtoAssignments(', node.right.source(), ')');
				}
				// Handle object comparisons if one of the object is wrapped in a proxy
				// if (node.type == "BinaryExpression" && (node.operator == "==" || node.operator == "!=" || node.operator == "===" || node.operator == "!==")){
				// 	update(node ,'(',options.tracer_name,'.handleProxyComparisons(', node.left.source(), '))',node.operator, '(' ,options.tracer_name, '.handleProxyComparisons(', node.right.source(), '))');
				// }
				// dont' handle those assignment expressions which are a child of conditional expressions as they 
				// may or may not get executed
				if (scope.IsLocalVariable(node.left) > 0){
					var newWrite = util.logWritesHelper(node, scope.checkAndReplaceAlias(node.left));
					if (options.caching)
						update(node,node.left.source(),node.operator, options.tracer_name,'.logWrite(',JSON.stringify(functionId),newWrite,',[', util.getAllIdentifiersFromMemberExpression(node.left),'])');
					if (options.useProxy) {
			
					}
				} else if (scope.IsLocalVariable(node.right) > 0){
					
				}

			} else if (node.type == "UpdateExpression") {
				var _functionId = util.getFunctionIdentifier(node);
				if (_functionId) {
					var {readArray,local,argReads, antiLocal} = signature.handleReads(node.argument);
					var functionId = makeId('function', options.path, _functionId);
					// if (antiLocal.length) {
					// 	uncacheableFunctions.push(functionId);
					// 	return;
					// }
					rewriteArguments(argReads);
					readArray.forEach((read) => {
						if (util.checkIfReservedWord(read)) return;
						if (read.source() == "window")
							update(read, options.proxyName)
						else
							update(read, options.proxyName, '.', read.source());
					});
				}
			} else if (node.type == "IfStatement") {
					var {readArray,local, argReads, antiLocal} = signature.handleReads(node.test);
					var _functionId = util.getFunctionIdentifier(node);
					if (_functionId) {
						// 	var functionId = makeId('function', options.path, _functionId);
						// 	if (uncacheableFunctions.indexOf(functionId) >= 0) return;
						rewriteArguments(argReads);
						readArray.forEach(function(read){
							var newRead = util.logReadsHelper(read,scope.checkAndReplaceAlias(read));
							if (options.caching)
								update(read, options.tracer_name, '.logRead(', JSON.stringify(functionId),',[', newRead, '],[', util.getAllIdentifiersFromMemberExpression(read),'])');
							if (options.useProxy){
								if (util.checkIfReservedWord(read)) return;
								if (read.source() == "window")
									update(read, options.proxyName)
								else
									update(read, options.proxyName, '.', read.source());
							}
								
						});
							
					}
					// scope.addGlobalReads(readArray);


			} else if (node.type == "CallExpression") {

				// check if the define/require/requirejs expression from requireJS is used or not
				var ignoreCallees = ["require", "define", "requirejs"]
				if (ignoreCallees.includes(node.callee.source())) {
					// console.log(node.callee.source());
					update(node, ASTSourceMap.get(node));
					return;
				}

				// // console.log(node.callee.source().includes("apply"))
				/* Any meta function object call won't be instrumented as it is not handled by the proxy handler as of now*/
				if (node.callee.type != "FunctionExpression" && ["bind","apply","call"].some(r=>{return node.callee.source().includes(r)})){
					// console.log(node.callee.source() + " with type " + node.callee.type );
					// update(node, ASTSourceMap.get(node));
					return;
				}

				/* Is the function invocation itself a global read or not?????
				   If the function invocation (ie call expression ) is made via a window API
				   like window.Localstorage.getItem
				*/
				var invocationIsRead = false;
				var {readArray, argReads, antiLocal} = invocationIsRead || node.callee.source().includes("window")? signature.handleReads(node.callee) : {readArray: [], local:[], argReads: [], antiLocal:{}};
				// console.log(readArray)
				rewriteArguments(argReads);
				readArray.forEach(function(read){
					if (options.useProxy){
						if (util.checkIfReservedWord(read)) return;
						if (read.source() == "window") {
							update(read, options.proxyName)
						}
						else{
							update(read, options.proxyName, '.', read.source());
						}
					}
				});

				// Check if the arguments passed are global or not
				if (node.arguments) {
					var globalReads = [];
					node.arguments.forEach(function(param){
						var {readArray, local,argReads, antiLocal} = signature.handleReads(param);
						globalReads = globalReads.concat(readArray);
					});
					var _functionId = util.getFunctionIdentifier(node);
					/* Either the call expression is inside a function or it is a self invoking call expression in the global scope*/
					if (_functionId || node.callee.type == "FunctionExpression") {
						rewriteArguments(argReads);
						globalReads.forEach(function(read){
							var newRead = util.logReadsHelper(read,scope.checkAndReplaceAlias(read));
							if (options.caching)
								update(read, options.tracer_name, '.logRead(', JSON.stringify(functionId),',[', newRead, '],[', util.getAllIdentifiersFromMemberExpression(read),'])');
							if (options.useProxy){
								if (util.checkIfReservedWord(read)) return;
								if (read.source() == "window") {
									// update(read, options.proxyName)
								}
								else{
									// console.log(read.source());
									// console.log(node.callee.source());
									update(read, options.proxyName, '.', read.source());
								}
							}
						});
					}
				}

				var globalDOMMethods = Object.keys(propertyObj.global);
				var localDOMMethods = Object.keys(propertyObj.local);
				var isLocal = false;


				if (node.parent.type == "SequenceExpression" || node.parent.type == "ExpressionStatement") {

					// First check if a local DOM method
					localDOMMethods.forEach(function(DOMMethod){
						if (node.callee.source().toLowerCase().includes(DOMMethod.toLowerCase()))
							isLocal = true;
					});
					globalDOMMethods.forEach(function(DOMMethod){
						if (!isLocal && node.callee.source().toLowerCase().includes(DOMMethod.toLowerCase())) {
							// checkAndReplaceAlias(node);
							var _functionId = util.getFunctionIdentifier(node);
							if (_functionId) {
								var functionId = makeId('function', options.path, _functionId);
								if (uncacheableFunctions.indexOf(functionId) == -1) {
									// uncacheableFunctions.push(functionId);
								}
								// update(node, options.tracer_name,'.setMutationContext(', node.source(),',', JSON.stringify(functionId), ')');
							}
						}
					});
				}
			} else if (node.type == "ReturnStatement" && node.argument) {
				var _functionId = util.getFunctionIdentifier(node);
				if (_functionId) {
					var functionId = makeId('function', options.path, _functionId);
					if (node.argument.type == "SequenceExpression" ) {
						var returnValue = node.argument.expressions[node.argument.expressions.length - 1];
						var preReturns = node.argument.expressions.slice(0,-1).map(function(e){return e.source()}).join();
						if (options.caching || options.useProxy)
							update(node, 'return ',preReturns ,',', options.tracer_name, 
							'.logReturnValue(', JSON.stringify(functionId), ',',returnValue.source() ,');');
						// if (options.useProxy)
							// update(node, 'return ',preReturns ,',', options.tracer_name, 
							// '.logReturnValue(', JSON.stringify(functionId), ',', returnValue.source(),
							// 	',',options.proxyName,'.',returnValue.source(),");");
					} else {
						if (options.caching || options.useProxy)
							update(node, "return ", options.tracer_name, '.logReturnValue(', JSON.stringify(functionId), ',', node.argument.source(),");");
						// if (options.useProxy)
						// 	update(node, "return ", options.tracer_name, '.logReturnValue(', JSON.stringify(functionId), ',', node.argument.source(),
						// 		',',options.proxyName,'.',node.argument.source(),");");
					}
				} else {console.log("ERROR analyses says return is outside function " + ASTSourceMap.get(node))}
			/* This function expression might be a part of the call expression as well however that will be taken care of inside the call expression check itself. */
			} else if ((node.type == "FunctionDeclaration" || node.type == "FunctionExpression")) {
				if (uncacheableFunctions.indexOf(node)>=0){
					return;
				}
				var index = makeId('function', options.path, node.loc);
				var isCacheable = true;
				var nodeBody = node.body.source().substring(1, node.body.source().length-1);
				// console.log(uncacheableFunctions);
				update(node.body, '\n',options.tracer_name,'.cacheInit(',JSON.stringify(index),',arguments);\n',
					nodeBody);

				insertArgumentProxy(node);

				var args = node;
				var serializedArgs = {};
				var returnValue = node.returnValue ? node.returnValue.source() : "null";
				if (args.globalWrites) serializedArgs.globalWrites = args.globalWrites;
				if (args.globalReads) serializedArgs.globalReads = args.globalReads;
				if (args.localVariables) serializedArgs.localVariables = args.localVariables.map(function(elem){return elem.source()});
				if (args.globalAlias) serializedArgs.globalAlias = args.globalAlias;
				serializedArgs.returnValue = returnValue;
				// serializedArgs = {};
				var _traceBegin = "" + options.tracer_name + ".cacheAndReplay(";// + args + ")) return;"
				var _traceEnd = options.tracer_name + ".exitFunction(";// + args + ");";
				// if (options.myRti && instrumentedNodes.indexOf(node)<0){
				// 	update(node.body,'{\n' ,node.body.source(),'\n', _traceEnd, JSON.stringify(index),',arguments);\n}\n');
				// 	return;
				// }

				update(node.body, '{ try {\n', ' var __tracerRet; \nif ( __tracerRet = ', _traceBegin, JSON.stringify(index) ,', arguments,',
				 ')) \n return __tracerRet; \n',
				 node.body.source(),'} \n finally { ', _traceEnd, JSON.stringify(index),',arguments', ');} \n }');
				//This is only to add performance api calls to the functions. 
				// update(node.body, '{', 'try { \n performance.now();\n', sourceNodes(node.body), '\n} finally {performance.now();}}',)
			// } else if (node.type == "ArrowFunctionExpression"){
			// 	var index = makeId('function', options.path, node.loc);
			// 	var isCacheable = true;
			// 	var nodeBody = node.body.source().substring(1, node.body.source().length-1);
			// 	// console.log(uncacheableFunctions);
			// 	if (uncacheableFunctions.indexOf(index) >= 0 || isNonDeterministc(node.source())){
			// 		return;
			// 	}
			// 	update(node.body, '\n',options.tracer_name,'.cacheInit(',JSON.stringify(index),');\n',
			// 		nodeBody);

			// 	var args = node;
			// 	var serializedArgs = {};
			// 	var returnValue = node.returnValue ? node.returnValue.source() : "null";
			// 	if (args.globalWrites) serializedArgs.globalWrites = args.globalWrites;
			// 	if (args.globalReads) serializedArgs.globalReads = args.globalReads;
			// 	if (args.localVariables) serializedArgs.localVariables = args.localVariables.map(function(elem){return elem.source()});
			// 	if (args.globalAlias) serializedArgs.globalAlias = args.globalAlias;
			// 	serializedArgs.returnValue = returnValue;
			// 	// serializedArgs = {};
			// 	var _traceBegin = "" + options.tracer_name + ".cacheAndReplay(";// + args + ")) return;"
			// 	var _traceEnd = options.tracer_name + ".exitFunction(";// + args + ");";
			// 	if (options.myRti && instrumentedNodes.indexOf(node)<0){
			// 		update(node.body,'{\n' ,node.body.source(),'\n', _traceEnd, JSON.stringify(index),');\n}\n');
			// 		return;
			// 	}

			// 	update(node.body, '{ try {\n', ' var __tracerRet; \nif ( __tracerRet = ', _traceBegin, JSON.stringify(index) ,',',
			// 	 ')) \n return __tracerRet; \n',
			// 	 node.body.source(),'} \n finally { ', _traceEnd, JSON.stringify(index), ');} \n }');
			// 	//This is only to add performance api calls to the functions. 
			// 	// update(node.body, '{', 'try { \n performance.now();\n', sourceNodes(node.body), '\n} finally {performance.now();}}',)
			}
		});
		processed = m;

	} catch (e) {
		console.error('[PARSING EXCEPTION]', options.path, e.stack);
		// mostly exception imples that it is a json file. 
		return content;
	}

	return processed;
};


module.exports = {
	instrument: instrument,
	instrumentationPrefix: instrumentationPrefix,
};
