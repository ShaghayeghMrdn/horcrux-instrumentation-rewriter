

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

var propertyObj = {};
const PATH_TO_PROPERTIES = __dirname + "/DOMHelper.ini";
properties.parse(PATH_TO_PROPERTIES, {path: true, sections: true}, function(err, obj){ propertyObj = obj ;})

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
	return template(tracerSource, {
		name: options.name,
		version: JSON.stringify(require('./package.json').version),
		nodejs: options.nodejs,
		maxInvocationsPerTick: options.maxInvocationsPerTick,
		e2eTesting: options.e2eTesting,
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
	var defaultOptions = {
		include_prefix: true,
		tracer_name: '__tracer',
		e2eTesting: false,
	};
	options = mergeInto(options, defaultOptions);
	var prefix = '', shebang = '', output, m;

	if (m = /^(#![^\n]+)\n/.exec(src)) {
		shebang = m[1];
		src = src.slice(shebang.length);
	}

	if (options.include_prefix) {
		prefix += instrumentationPrefix(options);
	}

	if (src.indexOf("/*theseus" + " instrument: false */") !== -1) {
		output = shebang + prefix + src;
	} else {
		var m = traceFilter(src, {
			prefix: prefix,
			path: options.path,
			tracer_name: options.tracer_name,
			sourceFilename: options.sourceFilename,
			generatedFilename: options.generatedFilename,
			execution_cache_toggle: options.execution_cache_toggle,
			caching: options.caching,
		});
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
	return path + '-'
	     + type + '-'
	     + loc.start.line + '-'
	     + loc.start.column + '-'
	     + loc.end.line + '-'
	     + loc.end.column;
};

var traceFilter = function (content, options) {
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
		var uncacheableFunctions =[];

		var ASTNodes = []; // List of all the nodes in the abstract syntax tree
		var functionToCallees = {};
		var fala = function () {
			var m = falafel.apply(this, arguments);
			return {
				map: function () { return '' },
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

		var replaceAliasesWithActuals = function(node) {
			node.globalWrites = _replaceAliasesWithActuals(node, node.globalWrites, true);
			node.globalReads =  _replaceAliasesWithActuals(node, node.globalReads, false);
		}

		var _replaceAliasesWithActuals = function(node, source, nop) {
			if (source == undefined) return;
			var indicesMatched = [];
			var arrayWithSources = [];
			source.forEach(function(entry,it){
				var isExpression = false;
				var isMemberAndComputed = false;
				if (entry.type == "CallExpression") isExpression = true;
				if (entry.type == "MemberExpression" && (entry.property.type == "Identifier" && entry.computed) ) isMemberAndComputed = true;
				var against = node;
				while (against.parent != undefined ) {
					if (against.globalAlias){
						if (isMemberAndComputed) entry = util.getBaseIdentifierFromMemberExpression(entry);
						var identifier = util.getIdentifierFromGenericExpression(entry) || entry;
						var remaining = entry.source().replace(identifier.source(),"");
						if (identifier.source() in against.globalAlias){
							indicesMatched.push(it);
							if (remaining == ""){
								arrayWithSources.push(against.globalAlias[identifier.source()]);
								if (isExpression && nop) arrayWithSources.push("NOP");
							}
							else {
								arrayWithSources.push(against.globalAlias[identifier.source()] + remaining);
								if (isExpression && nop) arrayWithSources.push("NOP");
							}
						}
					}
					against = against.parent;
				}
			});
			source.forEach(function(entry, it){
				if (indicesMatched.indexOf(it) < 0){
					if (entry.type == "MemberExpression" && (entry.property.type == "Identifier" && entry.computed) )
						entry = util.getBaseIdentifierFromMemberExpression(entry);
					arrayWithSources.push(entry.source());
					if (entry.type == "CallExpression" && nop) arrayWithSources.push("NOP");
				}
			})
			return arrayWithSources;
		}

		var replaceAliasWithinAlias = function(node) {
			if (node.globalAlias == undefined) return;
			var indicesMatched = [];
			var sourceVersion = {};
			Object.entries(node.globalAlias).forEach(function(pair){
				var identifier = util.getIdentifierFromGenericExpression(pair[1]) || pair[1];
				var remaining =  pair[1].source().replace(identifier.source(),"");
				if (Object.keys(node.globalAlias).indexOf(identifier.source()) > -1 ){
					indicesMatched.push(pair[0]);
					if (remaining == "") {
						sourceVersion[pair[0]] = node.globalAlias[identifier.source()].source();

					}
					else {
						sourceVersion[pair[0]] = node.globalAlias[identifier.source()].source() + remaining;
					}
				}
			});
			Object.keys(node.globalAlias).forEach(function(key) {
				if (indicesMatched.indexOf(key) < 0) {
					sourceVersion[key] = node.globalAlias[key].source();
				}
			})
			return sourceVersion;
		}

		var checkAndReplaceAlias = function(node) {
			var parent = node.parent;
			var ident = util.getIdentifierFromGenericExpression(node) || node;
			var remaining = node.source().replace(ident.source(), "");
			while (parent != undefined) {
				if (parent.type == "FunctionExpression" || parent.type == "FunctionDeclaration"){
					if (parent.globalAlias && Object.keys(parent.globalAlias).indexOf(ident.source()) > -1 ) {
						if (remaining == "") {
							update(node, parent.globalAlias[ident.source()]);
						} else {
							update(node, parent.globalAlias[ident.source()], remaining);
						}
					}
				}
				parent = parent.parent;
			}
		}

		var buildArgs = function (args, check) {
			if (args) {
				var modifiedArgArray = [];
				var localCounter = 0;
				args.forEach(function(arg, it){
					if (arg != "" && !arg.includes("NOP")) {
						if (args[it + 1] != "NOP") {
							modifiedArgArray.push("`" + util.escapeRegExp(arg) + "`");
							if (check) modifiedArgArray.push("typeof " +  arg + "=='undefined'?null:" + arg );
							else modifiedArgArray.push(arg);
						} else {
							modifiedArgArray.push("\"NOP" + localCounter++ + "\"");
							modifiedArgArray.push("`" + util.escapeRegExp(arg) + "`");
						}
					}
				});

				return modifiedArgArray;
			}
		}

		var printFriendlyAlias = function(obj) {
			var output = {};
			for (let key in obj){
				output[key] = obj[key].source();
			}

			return output;
		}

		var traceReturnValue = function(node) {
			var parent = node.parent;
			while (parent != undefined) {
				if ( parent.type == "FunctionDeclaration" || parent.type == "FunctionExpression" ) {
					if (node.argument.type == "SequenceExpression") {
						parent.returnValue = node.argument.expressions[node.argument.expressions.length - 1];
					} else {
						parent.returnValue = node.argument;
					}
					return;
				}
				parent = parent.parent;
			}
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

		m = fala({
			source: content,
			loc: true,
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

				if (functionName){
					if (!(functionNameToLocation[functionName]))
						functionNameToLocation[functionName] = [];
					functionNameToLocation[functionName].push(node.loc);
				}	

			} else if (node.type == "IfStatement") {
					var readArray = [];
					readArray = signature.handleReads(node.test);
					scope.addGlobalReads(readArray);


			} else if ( (node.type === 'VariableDeclaration' || node.type === 'VariableDeclarator')) {
				if (node.type == "VariableDeclarator"){
					if (node.parent.source().includes("let ")) {
						scope.addLocalVariable(node);
					}
					else if (node.init) {
						if (scope.IsLocalVariable(node.init) == 0) {
							scope.addLocalVariable(node);
						} else {
							if (node.init.type == "Identifier" || node.init.type == "MemberExpression") scope._addGlobalReads(node.init);
							scope.addGlobalAlias(node,node.init);
						}
						scope.addGlobalReads(signature.handleReads(node.init));
					} else {
						scope.addLocalVariable(node);
					}

			    }
			    // update(node, sourceNodes(node));
			
			// Handles any global variable being assigned any value
			// or a local variable becoming an alias of a global variable
			} else if (node.type == "AssignmentExpression"){

				// dont' handle those assignment expressions which are a child of conditional expressions as they 
				// may or may not get executed
				if (childrenOfConditionalExpression(node)) {
					//do no-op
				}
				else if (scope.IsLocalVariable(node.left) > 0){
					// addGlobalVariable(node.left);
					scope.addGlobalWrites(node.left);

				} else if (scope.IsLocalVariable(node.right) > 0){
					if (node.right.type == "Identifier" || node.right.type == "MemberExpression")
						scope._addGlobalReads(node.right);
					scope.addGlobalAlias(node.left, node.right);
				} else {
					scope.addLocalVariable(node.left);
				}

				scope.addGlobalReads(signature.handleReads(node.right));
			} else if (node.type == "CallExpression") {
				
				// Check if the arguments passed are global or not
				if (node.arguments) {
					var globalReads = [];
					node.arguments.forEach(function(param){
						globalReads = globalReads.concat(signature.handleReads(param));
					});
					// add global arguments to read set
					scope.addGlobalReads(globalReads);
				}

				// add global arguments to the write set as well (conservative approach) - the value may or may not be written to
				// globalReads.forEach(function(read){
				// 	scope.addGlobalWrites(read);
				// });

				addCalleesToCaller(node);

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
								if (uncacheableFunctions.indexOf(functionId) < 0)
									uncacheableFunctions.push(functionId);
								}
							}
					});
				}
			} 
		});

		ASTNodes.forEach(function(node) {
			// console.log("parsing node: " + node.source());

			if (node.type == "CallExpression") {
				/*
				There are three types of call expressions to be taken care of while propagating signature:
					- regular expression which was defined in this script, propagate
					- regular expression which was not defined in this script ( ie a native function), therefore no propagation for this one
					- non regular expression, ie a function expression and call expression at the same time, propagate
					- regular expression which was defined multiple times, therefore look through all the definitions and then decide. 
				*/
				// if (node.callee.type == "FunctionExpression") {
				// 	parent = node.parent;
				// 	while (parent != undefined){
				// 		if (parent.type == "FunctionExpression" || parent.type == "FunctionDeclaration"){
				// 			util.customMergeDeep(functionToMetadata[makeId('function', options.path, parent.loc)],functionToMetadata[node.callee.loc])
				// 			return;
				// 		}
				// 		parent = parent.parent;
				// 	}
				// }

			} else if (node.type == "FunctionDeclaration" || node.type == "FunctionExpression") {
				// Handle hoisting
				scope.removeLocalVariables(node);
				node.globalAlias = replaceAliasWithinAlias(node);
			}
		});

		ASTNodes.forEach(function(node) {
			// console.log("current node: " + node.source() + " " + node.type);
			if (node.type === "Program") { 
				update(node, options.prefix,
					sourceNodes(node))
			} 
			else if ( (node.type === 'VariableDeclaration' || node.type === 'VariableDeclarator') && options.caching) {
				if (node.type == "VariableDeclarator"){
					if (node.init) {
						var _functionId = util.getFunctionIdentifier(node);
						if (_functionId) {
							var readArray = signature.handleReads(node.init);
							var functionId = makeId('function', options.path, _functionId);
							if (uncacheableFunctions.indexOf(functionId) >= 0) return;
							readArray.forEach(function(read){
								var newRead = util.logReadsHelper(read);
								update(read, options.tracer_name, '.logRead(', JSON.stringify(functionId),',[', newRead, '])');
							});
						}
						if (scope.IsLocalVariable(node.init) == 0) {

						} else {
						}
					} else {
						scope.addLocalVariable(node);
					}

			    }
			    // update(node, sourceNodes(node));
			
			// Handles any global variable being assigned any value
			// or a local variable becoming an alias of a global variable
			} 
			else if (node.type == "AssignmentExpression" && options.caching){
				var _functionId = util.getFunctionIdentifier(node);
				if (_functionId) {
					var readArray = signature.handleReads(node.right);
					var functionId = makeId('function', options.path, _functionId);
					if (uncacheableFunctions.indexOf(functionId) >= 0) return;
					readArray.forEach(function(read){
						var newRead = util.logReadsHelper(read);
						update(read, options.tracer_name, '.logRead(', JSON.stringify(functionId),',[', newRead, '])');
					});
				}
				// dont' handle those assignment expressions which are a child of conditional expressions as they 
				// may or may not get executed
				if (childrenOfConditionalExpression(node)) {
					//do no-op
				}
				else if (scope.IsLocalVariable(node.left) > 0){

					var _functionId = util.getFunctionIdentifier(node);
					if (_functionId) {
						var functionId = makeId('function', options.path, _functionId);
						if (uncacheableFunctions.indexOf(functionId) >= 0) return;
						checkAndReplaceAlias(node.left);
						update(node,node.left.source(),node.operator, options.tracer_name,'.logWrite(',JSON.stringify(functionId),',',
							node.right.source(),',',
							'\`',node.left.source().replace(/[\`]/g, "\\$&"),'\`',')');
					}
				} else if (scope.IsLocalVariable(node.right) > 0){
					// var _functionId = util.getFunctionIdentifier(node);
					// if (_functionId) {
					// 	if (node.right.type == "Identifier" || node.right.type == "MemberExpression") {
					// 		var functionId = makeId('function', options.path, _functionId);
					// 		var newRead = util.logReadsHelper(node.right);
					// 		update(node.right, options.tracer_name,'.logRead(',JSON.stringify(functionId),',[', newRead, ']);');
					// 		return;
					// 	} else {console.log("LOOKS LIKE AN ALIAS BUT RHS IS TYPE: " + node.right.type);}
					// }
				}

			} else if (node.type == "IfStatement" && options.caching) {
					var readArray = [];
					readArray = signature.handleReads(node.test);
					var _functionId = util.getFunctionIdentifier(node);
					if (_functionId) {
						var functionId = makeId('function', options.path, _functionId);
						if (uncacheableFunctions.indexOf(functionId) >= 0) return;
						readArray.forEach(function(read){
							var newRead = util.logReadsHelper(read);
							update(read, options.tracer_name, '.logRead(', JSON.stringify(functionId),',[', newRead, '])');
						});
					}
					// scope.addGlobalReads(readArray);


			} else if (node.type == "CallExpression" && options.caching) {
				
				// Check if the arguments passed are global or not
				if (node.arguments) {
					var globalReads = [];
					node.arguments.forEach(function(param){
						globalReads = globalReads.concat(signature.handleReads(param));
					});
					var _functionId = util.getFunctionIdentifier(node);
					if (_functionId) {
						var functionId = makeId('function', options.path, _functionId);
						if (uncacheableFunctions.indexOf(functionId) >= 0) return;
						globalReads.forEach(function(read){
							var newRead = util.logReadsHelper(read);
							update(read, options.tracer_name, '.logRead(', JSON.stringify(functionId),',[', newRead, '])');
						});
					}
					// add global arguments to read set
					// scope.addGlobalReads(globalReads);
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
								if (uncacheableFunctions.indexOf(functionId) == -1)
									uncacheableFunctions.push(functionId);
								// update(node, options.tracer_name,'.setMutationContext(', node.source(),',', JSON.stringify(functionId), ')');
							}
						}
					});
				}
			} else if (node.type == "ReturnStatement" && node.argument && options.caching) {
				var _functionId = util.getFunctionIdentifier(node);
				if (_functionId) {
					var functionId = makeId('function', options.path, _functionId);
					if (uncacheableFunctions.indexOf(functionId) >= 0) return;
					if (node.argument.type == "SequenceExpression" ) {
						var returnValue = node.argument.expressions[node.argument.expressions.length - 1];
						var preReturns = node.argument.expressions.slice(0,-1).map(function(e){return e.source()}).join();
						update(node, 'return ',preReturns ,',', options.tracer_name, 
							'.logReturnValue(', JSON.stringify(functionId), ',',returnValue.source() ,');');
					} else {
						update(node, "return ", options.tracer_name, '.logReturnValue(', JSON.stringify(functionId), ',', node.argument.source(),");");
					}
				} else {console.log("ERROR analyses says return is outside function" + node.source())}

			} else if ((node.type == "FunctionDeclaration" || node.type == "FunctionExpression") && options.caching) {
				replaceAliasesWithActuals(node);
				
				// console.log(uncacheableFunctions);
				var index = makeId('function', options.path, node.loc);
				var isCacheable = true;
				if (uncacheableFunctions.indexOf(index) >= 0)
					return;
				var args = node;
				var serializedArgs = {};
				// break into separate arguments
				// var separateReads = [];
				// var separateWrites = [];
				// // console.log("args look like " + JSON.stringify(args.globalWrites) );
				// if (args.globalWrites) separateWrites = buildArgs(args.globalWrites, false);
				// if (args.globalReads) separateReads = buildArgs(args.globalReads, true);

				//Stringify the args object
				var returnValue = node.returnValue ? node.returnValue.source() : "null";
				if (args.globalWrites) serializedArgs.globalWrites = args.globalWrites;
				if (args.globalReads) serializedArgs.globalReads = args.globalReads;
				if (args.localVariables) serializedArgs.localVariables = args.localVariables.map(function(elem){return elem.source()});
				if (args.globalAlias) serializedArgs.globalAlias = args.globalAlias;
				serializedArgs.returnValue = returnValue;
				// serializedArgs = {};
				var _traceBegin = "" + options.tracer_name + ".cacheAndReplay(";// + args + ")) return;"
				var _traceEnd = options.tracer_name + ".dumpCache(";// + args + ");";
				// update(node.body, '{', _traceBegin, JSON.stringify(index),') } catch (err) {}\n try { ', sourceNodes(node.body),'\n } catch (err) {} }')
				update(node.body, '{', 'let ret; if (ret = ', _traceBegin, JSON.stringify(index) ,', arguments,',
				 JSON.stringify(serializedArgs),')) \n{ if (ret == true) return; else return ret; };\n',
				 'try { ', sourceNodes(node.body), '\n} /*catch (e  instanceof EvalError) {console.log("ERROR while replaying cache " + ',JSON.stringify(index),
				 ' + e + e.stack)}*/  finally { ', options.tracer_name ,'.dumpArguments(', JSON.stringify(index), ', arguments )}}');
			}
		});

	processed = m;

	} catch (e) {
		console.error('exception during parsing', options.path, e.stack, content);
		// mostly exception imples that it is a json file. 
		return content;
	}

	return processed;
};


module.exports = {
	instrument: instrument,
	instrumentationPrefix: instrumentationPrefix,
};
